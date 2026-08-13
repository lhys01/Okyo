#!/usr/bin/env node
/**
 * Okyo — fetch an accurate, license-clear photo for every recommendation recipe.
 *
 * Source: Pexels (https://www.pexels.com/license/) — free for commercial use,
 * no attribution required. We still record the photographer + source URL in
 * assets/food/recipes/_manifest.json so provenance is auditable.
 *
 * Usage (from repo root):
 *   node scripts/fetch-recipe-images.mjs              # fetch until rate limit
 *   node scripts/fetch-recipe-images.mjs --limit=50   # cap this run
 *   node scripts/fetch-recipe-images.mjs --dry-run    # show queries, no network
 *   node scripts/fetch-recipe-images.mjs --redo=<id>  # force re-fetch one recipe
 *
 * The API key is read from PEXELS_API_KEY (env var or the gitignored .env at
 * repo root). It is never written into tracked source.
 *
 * Safe to re-run: recipes that already have an image file are skipped, so you
 * can resume across hourly rate-limit windows without losing progress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPECS = path.join(ROOT, 'apps/mobile/src/data/recommendedRecipes.ts');
const DEST = path.join(ROOT, 'apps/mobile/assets/food/recipes');
const INDEX = path.join(ROOT, 'apps/mobile/assets/food/index.ts');
const MANIFEST = path.join(DEST, '_manifest.json');

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}`));
const DRY_RUN = args.includes('--dry-run');
const LIMIT = Number((flag('limit') || '').split('=')[1] || Infinity);
const REDO = (flag('redo') || '').split('=')[1] || null;
// Re-match every published recipe, replacing images that were picked by hand
// and never relevance-checked (a "Chocolate Mug Cake" that was actually a
// decorated Christmas cake, for instance).
const REDO_ALL = args.includes('--redo-all');

// ── API key ────────────────────────────────────────────────────────────────
function loadKey() {
  if (process.env.PEXELS_API_KEY) return process.env.PEXELS_API_KEY.trim();
  for (const envFile of [path.join(ROOT, '.env'), path.join(ROOT, 'apps/mobile/.env')]) {
    if (!fs.existsSync(envFile)) continue;
    const line = fs
      .readFileSync(envFile, 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith('PEXELS_API_KEY='));
    if (line) return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

// ── Parse recipe id + title straight from the source of truth ──────────────
// Draft recipes are deliberately excluded: they are dish names reserved for the
// library whose ingredients and steps are still placeholder scaffolding.
// Fetching a real, accurate photo for one would make an unfinished recipe look
// authoritative, which is worse than showing an obvious placeholder.
function readRecipes({ includeDrafts = false } = {}) {
  const src = fs.readFileSync(SPECS, 'utf8');
  const body = src.slice(src.indexOf('const specs: RecommendationSpec[] = ['));
  return body
    .split(/\n {2}\{\n/)
    .slice(1)
    .map((chunk) => {
      const grab = (re) => (chunk.match(re) || [])[1];
      const id = grab(/^\s*id: '((?:[^'\\]|\\.)*)'/m);
      const title = grab(/^\s*title: '((?:[^'\\]|\\.)*)'/m);
      const draft = /\n {4}draft: true,/.test(chunk);
      return id && title ? { id, title: title.replace(/\\'/g, "'"), draft } : null;
    })
    .filter((r) => r && (includeDrafts || !r.draft));
}

// ── Query building ─────────────────────────────────────────────────────────
// Appliance/method/marketing words describe HOW a dish is cooked, not what it
// looks like. Left in, Pexels returns photos of air fryers and sheet pans
// instead of food, so we strip them before searching.
const NOISE = [
  'air fryer', 'sheet pan', 'slow cooker', 'instant pot', 'one-pot', 'one pot',
  'stove top', 'stovetop', 'oven baked', 'no-bake', 'no bake', 'make-ahead',
  '5-ingredient', '15-minute', '20-minute', '30-minute', 'weeknight', 'leftover',
  'easy', 'quick', 'simple', 'classic', 'best', 'ultimate', 'perfect', 'homemade',
  'copycat', 'healthy', 'loaded', 'super', 'the', 'a ',
];
// Words that carry no visual meaning on their own at the end of a title.
const TRAILING = ['dinner', 'recipe', 'meal', 'ideas', 'idea', 'bowl dinner'];

function buildQuery(title) {
  let q = title.toLowerCase();
  for (const n of NOISE) q = q.replace(new RegExp(`\\b${n.trim()}\\b`, 'g'), ' ');
  q = q.replace(/\s+/g, ' ').trim();
  for (const t of TRAILING) {
    if (q.endsWith(` ${t}`)) q = q.slice(0, -(t.length + 1)).trim();
  }
  q = q.replace(/\s+/g, ' ').trim();
  return q.length >= 3 ? q : title.toLowerCase().trim();
}

// Progressively simpler fallbacks so we always try something sane. Every rung
// must stay >= 2 words: collapsing "Beef and Barley Stew" down to "beef" would
// match any beef photo on Pexels, which is exactly the wrong-image failure we
// are trying to avoid.
function queryLadder(title) {
  const primary = buildQuery(title);

  // Fallback rungs only. The >=2-word rule applies to these, never to the
  // primary query: a one-word title like "Shakshuka" or "Bibimbap" is already
  // a specific dish, whereas a one-word *fallback* like "beef" is not.
  const fallbacks = [];

  // Drop only a trailing " with ..." clause; keep "and" joins intact.
  const noWith = primary.split(/\s+with\s+/)[0].trim();
  if (noWith && noWith !== primary) fallbacks.push(noWith);

  // Last resort: the final two words usually carry the dish type
  // ("...noodle soup", "...beef stew").
  const words = noWith.split(' ');
  if (words.length > 2) fallbacks.push(words.slice(-2).join(' '));

  const usable = fallbacks.filter((q) => q.split(' ').length >= 2 && q.length >= 5);

  // Bias a bare ingredient toward prepared food, keeping the plain word as a
  // fallback so we still find something if "<x> dish" returns nothing.
  const head = BARE_INGREDIENT.has(primary) ? [`${primary} dish`, primary] : [primary];

  return [...new Set([...head, ...usable])].filter(Boolean);
}

// A bare protein/ingredient name matches raw-produce and live-animal photos
// just as well as cooked food ("Air Fryer Salmon" -> "salmon" -> a live fish).
// For these we search for the prepared dish instead.
const BARE_INGREDIENT = new Set([
  'salmon', 'shrimp', 'chicken', 'steak', 'beef', 'pork', 'tofu', 'cod', 'tuna',
  'meatballs', 'scallops', 'lamb', 'turkey', 'eggs', 'rice', 'noodles', 'pasta',
  'potatoes', 'mushrooms', 'broccoli', 'cauliflower', 'chickpeas', 'lentils',
]);

// ── Result scoring: prefer photos whose alt text actually describes the dish ─
// 'dish'/'plate'/'cooked' are search hints, not descriptors — they must not
// dilute the relevance ratio when they are absent from a photo's alt text.
const STOP = new Set([
  'with', 'and', 'in', 'on', 'of', 'a', 'the', 'style',
  'dish', 'plate', 'cooked',
]);

function scorePhoto(photo, query) {
  const alt = (photo.alt || '').toLowerCase();
  if (!alt) return -1;
  const tokens = query.split(' ').filter((t) => t.length > 2 && !STOP.has(t));
  if (!tokens.length) return 0;
  let hits = 0;
  for (const t of tokens) if (alt.includes(t)) hits += 1;
  let score = hits / tokens.length;
  if (photo.width >= photo.height) score += 0.15; // landscape crops better
  return score;
}

// ── Network ────────────────────────────────────────────────────────────────
async function search(query, key) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
    query,
  )}&per_page=15&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (res.status === 429) return { rateLimited: true, photos: [] };
  if (!res.ok) return { error: `HTTP ${res.status}`, photos: [] };
  const json = await res.json();
  return {
    photos: json.photos || [],
    remaining: Number(res.headers.get('x-ratelimit-remaining') ?? NaN),
  };
}

async function download(photo, dest) {
  const url = `${photo.src.large}`;
  const res = await fetch(url);
  if (!res.ok) return `HTTP ${res.status}`;
  const buf = Buffer.from(await res.arrayBuffer());
  // Verify it is really a JPEG and not an error page. RN decodes by magic
  // bytes, so a .png extension holding JPEG data renders fine.
  if (buf.length < 5000) return `too small (${buf.length}b)`;
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return 'not a JPEG';
  fs.writeFileSync(dest, buf);
  return null;
}

// ── Regenerate the bundled asset map ───────────────────────────────────────
function regenerateIndex() {
  const files = fs
    .readdirSync(DEST)
    .filter((f) => f.endsWith('.png'))
    .sort();
  const entries = files
    .map((f) => {
      const id = f.replace(/\.png$/, '');
      return `  '${id}': require('./recipes/${f}'),`;
    })
    .join('\n');

  const content = `// Category-level fallback images (used by OnboardingUI and inspiration views).
// Keep these pointed at bundled recipe art so deleted legacy samples cannot
// break Metro at compile time.
export const foodAssets = {
  bowl: require('./recipes/garlic-chicken-rice-bowl.png'),
  breakfast: require('./recipes/breakfast-burrito.png'),
  burger: require('./recipes/smash-cheeseburger.png'),
  dessert: require('./recipes/chocolate-mug-cake.png'),
  pasta: require('./recipes/creamy-tomato-rigatoni.png'),
  salad: require('./recipes/greek-salad.png'),
};

// Per-recipe images. GENERATED by scripts/fetch-recipe-images.mjs — do not edit
// by hand; re-run the script instead. Photos are Pexels License (free for
// commercial use). Provenance is recorded in recipes/_manifest.json.
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const recipeAssets: Record<string, number> = {
${entries}
};
`;
  fs.writeFileSync(INDEX, content);
  return files.length;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const recipes = readRecipes();
  fs.mkdirSync(DEST, { recursive: true });

  const manifest = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
    : {};

  const todo = recipes.filter((r) => {
    if (REDO) return r.id === REDO;
    if (REDO_ALL) return true;
    const file = path.join(DEST, `${r.id}.png`);
    if (!fs.existsSync(file)) return true;
    // A leftover placeholder is not a real photo: PNG magic bytes (or a file
    // too small to be a photograph) mean the original download never landed.
    const head = fs.readFileSync(file).subarray(0, 2);
    const isJpeg = head[0] === 0xff && head[1] === 0xd8;
    return !isJpeg || fs.statSync(file).size < 20000;
  });

  console.log(`Recipes total:   ${recipes.length}`);
  console.log(`Already have:    ${recipes.length - todo.length}`);
  console.log(`Need images:     ${todo.length}`);
  console.log('');

  if (DRY_RUN) {
    for (const r of todo.slice(0, 40)) {
      console.log(`  ${r.title}\n    -> ${queryLadder(r.title).join('  |  ')}`);
    }
    if (todo.length > 40) console.log(`  ... and ${todo.length - 40} more`);
    return;
  }

  if (!todo.length) {
    const n = regenerateIndex();
    console.log(`Nothing to fetch. Asset map regenerated with ${n} images.`);
    return;
  }

  const key = loadKey();
  if (!key) {
    console.error(
      'Missing PEXELS_API_KEY.\n' +
        'Add it to the gitignored .env at repo root:\n' +
        '  echo "PEXELS_API_KEY=your_key_here" >> .env\n' +
        'or export it for this shell:\n' +
        '  export PEXELS_API_KEY=your_key_here',
    );
    process.exit(1);
  }

  // Every photo id already claimed by a recipe, so we never hand the same
  // image to two dishes. Seeded from the manifest so this holds across runs.
  const usedPhotoIds = new Set(
    Object.values(manifest)
      .map((e) => e && e.pexelsId)
      .filter(Boolean),
  );

  let ok = 0;
  let failed = 0;
  const misses = [];
  const batch = todo.slice(0, LIMIT === Infinity ? todo.length : LIMIT);

  for (const [i, recipe] of batch.entries()) {
    const prefix = `[${String(i + 1).padStart(3)}/${batch.length}]`;
    let chosen = null;
    let usedQuery = null;
    let stop = false;

    for (const query of queryLadder(recipe.title)) {
      const { photos, rateLimited, error, remaining } = await search(query, key);

      if (rateLimited) {
        console.log(`\n${prefix} Rate limit reached (Pexels allows 200/hour).`);
        stop = true;
        break;
      }
      if (error) {
        console.log(`${prefix} ✗ ${recipe.id} — ${error}`);
        break;
      }
      if (Number.isFinite(remaining) && remaining <= 1) stop = true;

      if (photos.length) {
        const ranked = photos
          .map((p) => ({ p, s: scorePhoto(p, query) }))
          .sort((a, b) => b.s - a.s);
        const isLastRung = query === queryLadder(recipe.title).at(-1);
        // Require a real textual match. On the final rung we relax the bar but
        // never drop it entirely — an unmatched photo is worse than the generic
        // category fallback, because it looks confidently wrong.
        const bar = isLastRung ? 0.34 : 0.5;
        // Skip photos already assigned to another recipe so no two dishes in
        // the library ever show the same image.
        const pick = ranked.find((r) => r.s >= bar && !usedPhotoIds.has(r.p.id));
        if (pick) {
          chosen = pick.p;
          usedQuery = query;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    if (chosen) {
      const dest = path.join(DEST, `${recipe.id}.png`);
      const err = await download(chosen, dest);
      if (err) {
        failed += 1;
        misses.push({ ...recipe, reason: err });
        console.log(`${prefix} ✗ ${recipe.id} — download: ${err}`);
      } else {
        ok += 1;
        usedPhotoIds.add(chosen.id);
        manifest[recipe.id] = {
          title: recipe.title,
          query: usedQuery,
          pexelsId: chosen.id,
          photographer: chosen.photographer,
          sourceUrl: chosen.url,
          alt: chosen.alt,
          license: 'Pexels License — free for commercial use, no attribution required',
        };
        console.log(`${prefix} ✓ ${recipe.id}  ←  "${chosen.alt || usedQuery}"`);
      }
    } else if (!stop) {
      failed += 1;
      misses.push({ ...recipe, reason: 'no confident match' });
      console.log(`${prefix} ✗ ${recipe.id} — no confident match, keeping fallback`);
    }

    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

    if (stop) {
      console.log('Stopping cleanly — re-run this script in an hour to resume.');
      break;
    }
    await new Promise((r) => setTimeout(r, 300)); // be polite
  }

  const total = regenerateIndex();

  console.log('');
  console.log(`Downloaded:      ${ok}`);
  console.log(`Failed/skipped:  ${failed}`);
  console.log(`Bundled images:  ${total}`);
  console.log(`Manifest:        ${path.relative(ROOT, MANIFEST)}`);
  if (misses.length) {
    console.log('');
    console.log('No confident match (these keep their category fallback):');
    for (const m of misses.slice(0, 25)) console.log(`  - ${m.title} (${m.reason})`);
    if (misses.length > 25) console.log(`  ... and ${misses.length - 25} more`);
  }
  console.log('');
  console.log('Next: cd apps/mobile && npx expo start -c');
}

// Exported for scripts/fetch-recipe-images.test.mjs. Only auto-run when this
// file is executed directly, so importing it for tests has no side effects.
export { buildQuery, queryLadder, scorePhoto, readRecipes, loadKey };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
