import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';

const mobileRoot = resolve(new URL('..', import.meta.url).pathname);
const assetRoot = resolve(mobileRoot, 'assets');
const sourceRoot = resolve(mobileRoot, 'src');
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const requirePattern = /require\(\s*['\"]([^'\"]+\.(?:png|jpe?g|webp|gif))['\"]\s*\)/g;
const failures = [];

const sourceFiles = [...walk(sourceRoot), ...walk(assetRoot)].filter((file) => sourceExtensions.has(extname(file)));
const references = [];

for (const file of sourceFiles) {
  const contents = readFileSync(file, 'utf8');
  for (const match of contents.matchAll(requirePattern)) {
    const target = resolve(dirname(file), match[1]);
    const lineStart = contents.lastIndexOf('\n', match.index ?? 0) + 1;
    const lineEnd = contents.indexOf('\n', lineStart);
    references.push({
      file,
      line: contents.slice(lineStart, lineEnd === -1 ? contents.length : lineEnd),
      reference: match[1],
      target,
    });
    if (!existsSync(target)) {
      failures.push(`missing asset: ${relative(mobileRoot, file)} -> ${match[1]}`);
      continue;
    }
    validateImageFile(target);
  }
}

for (const file of walk(assetRoot).filter((candidate) => imageExtensions.has(extname(candidate).toLowerCase()))) {
  validateImageFile(file);
}

const fallbackRegistry = resolve(sourceRoot, 'utils', 'imageAssetFallbacks.ts');
const resilientImage = resolve(sourceRoot, 'components', 'ResilientImage.tsx');
const foodImage = resolve(sourceRoot, 'components', 'FoodImage.tsx');
const fallbackSource = readFileSync(fallbackRegistry, 'utf8');
const resilientSource = readFileSync(resilientImage, 'utf8');
const foodImageSource = readFileSync(foodImage, 'utf8');

for (const kind of ['food', 'mascot', 'icon', 'onboarding', 'emptyState', 'tour', 'appIcon', 'decorative']) {
  if (!new RegExp(`\\b${kind}: require\\(`).test(fallbackSource)) {
    failures.push(`missing fallback kind: ${kind}`);
  }
}

const fallbackEntries = [...fallbackSource.matchAll(/^\s*(\w+): require\(['\"]([^'\"]+)['\"]\)/gm)];
const fallbackPaths = new Map();
for (const [, kind, requestedPath] of fallbackEntries) {
  const target = resolve(dirname(fallbackRegistry), requestedPath);
  if (!existsSync(target)) failures.push(`missing ${kind} fallback: ${requestedPath}`);
  fallbackPaths.set(kind, target);
  if (kind !== 'food' && target.includes('/assets/food/')) {
    failures.push(`non-food fallback uses food photography: ${kind} -> ${requestedPath}`);
  }
}
if (new Set(fallbackPaths.values()).size !== fallbackPaths.size) {
  failures.push('different fallback kinds resolve to the same asset');
}
if (/foodAssets/.test(resilientSource)) {
  failures.push('universal rice fallback detected in ResilientImage');
}
if (!/assetKind="food"/.test(foodImageSource)) {
  failures.push('FoodImage must explicitly use the food asset kind');
}

for (const reference of references) {
  const relativeTarget = relative(assetRoot, reference.target).replaceAll('\\', '/');
  if (/assets\/food\/recipes\//.test(relativeTarget) && /(?:kiko|fox|icon|meal|artwork)/i.test(reference.line) && !/(?:food|pizza|mealPhoto|dish)/i.test(reference.line)) {
    failures.push(`non-food logical key points to food photography: ${relative(mobileRoot, reference.file)} -> ${reference.reference}`);
  }
}

if (failures.length > 0) {
  console.error('Asset validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Validated ${references.length} static image references and ${walk(assetRoot).filter((file) => imageExtensions.has(extname(file).toLowerCase())).length} image files.`);
  console.log('No universal food fallback, missing static assets, mismatched extensions, or category-invalid fallback mappings found.');
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function validateImageFile(file) {
  const extension = extname(file).toLowerCase();
  const description = execFileSync('file', ['-b', file], { encoding: 'utf8' });
  const expected = extension === '.png' ? 'PNG image data'
    : extension === '.webp' ? 'Web/P image'
      : extension === '.gif' ? 'GIF image data'
        : 'JPEG image data';
  if (!description.includes(expected)) {
    failures.push(`extension/content mismatch: ${relative(mobileRoot, file)} is ${description.trim()}`);
  }
  if (statSync(file).size === 0) {
    failures.push(`empty image file: ${relative(mobileRoot, file)}`);
  }
}
