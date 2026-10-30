import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { SUPPORT_EMAIL } from '../src/config/site';
import { toSection } from '../scripts/sync-legal-drafts.mjs';

const ROUTES = ['/', '/privacy', '/terms', '/support', '/delete-account'] as const;
// Public legal routes share the current in-app text; approval is a separate launch gate.
const DRAFT_ROUTES: string[] = [];
const FOOTER_HREFS = ['/privacy', '/terms', '/support', '/delete-account'];
const VIEWPORTS = [
  [320, 568],
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
] as const;
const DIST = join(import.meta.dirname, '..', 'dist');

function distFiles(dir = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? distFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('response', (res) => res.status() >= 400 && errors.push(`${res.status()} ${res.url()}`));
  return errors;
}

for (const route of ROUTES) {
  test.describe(`route ${route}`, () => {
    test('loads with one h1, title, canonical, and no errors', async ({ page }) => {
      const errors = trackErrors(page);
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page).toHaveTitle(/Okyo/);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBe(route === '/' ? 'https://okyoapp.com' : `https://okyoapp.com${route}`);
      expect(errors).toEqual([]);
    });

    test('footer links, support email, landmarks', async ({ page }) => {
      await page.goto(route);
      for (const href of FOOTER_HREFS) {
        await expect(page.locator(`footer a[href="${href}"]`)).toHaveCount(1);
      }
      const mailtos = await page.locator('a[href^="mailto:"]').evaluateAll((links) =>
        links.map((link) => link.getAttribute('href')),
      );
      expect(mailtos.length).toBeGreaterThan(0);
      for (const href of mailtos) expect(href).toBe(`mailto:${SUPPORT_EMAIL}`);
      await expect(page.locator('header')).toHaveCount(1);
      await expect(page.locator('main#main')).toHaveCount(1);
      await expect(page.locator('footer')).toHaveCount(1);
    });

    test('images and Manrope load', async ({ page }) => {
      await page.goto(route);
      await page.evaluate(async () => {
        for (const img of Array.from(document.images)) {
          img.loading = 'eager';
          if (!img.complete) await new Promise((done) => img.addEventListener('load', done, { once: true }));
        }
        await document.fonts.ready;
      });
      const broken = await page.evaluate(() =>
        Array.from(document.images).filter((img) => img.naturalWidth === 0).map((img) => img.src),
      );
      expect(broken).toEqual([]);
      expect(await page.evaluate(() => document.fonts.check('800 16px Manrope'))).toBe(true);
    });

    test('images keep their natural aspect ratio (nothing stretched)', async ({ page }) => {
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await page.evaluate(async () => {
          for (const img of Array.from(document.images)) {
            img.loading = 'eager';
            if (!img.complete) await new Promise((done) => img.addEventListener('load', done, { once: true }));
          }
        });
        const stretched = await page.evaluate(() =>
          Array.from(document.images)
            .filter((img) => img.naturalWidth > 0 && img.clientWidth > 0)
            .filter((img) => {
              const natural = img.naturalWidth / img.naturalHeight;
              const shown = img.clientWidth / img.clientHeight;
              return Math.abs(shown - natural) / natural > 0.02;
            })
            .map((img) => img.currentSrc),
        );
        expect(stretched, `${width}px`).toEqual([]);
      }
    });

    test('has no serious or critical axe violations', async ({ page }) => {
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        const { violations } = await new AxeBuilder({ page }).analyze();
        const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`), `${width}px`).toEqual([]);
      }
    });

    test('indexing matches draft status', async ({ page }) => {
      await page.goto(route);
      const robots = page.locator('meta[name="robots"]');
      if (DRAFT_ROUTES.includes(route)) {
        await expect(robots).toHaveAttribute('content', /noindex/);
        await expect(page.getByText('DRAFT — NOT IN EFFECT')).toBeVisible();
      } else {
        await expect(robots).toHaveCount(0);
        await expect(page.locator('[data-draft]')).toHaveCount(0);
      }
    });

    test('no horizontal scroll at any viewport', async ({ page }) => {
      await page.goto(route);
      for (const [width, height] of VIEWPORTS) {
        await page.setViewportSize({ width, height });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${width}x${height}`).toBeLessThanOrEqual(0);
      }
    });

    test('stays readable at 200% text size', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(route);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test('unknown routes return the custom 404 page', async ({ page }) => {
  for (const path of ['/nope', '/privacy/extra']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.locator('h1')).toHaveText("This page isn't on the menu.");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  }
});

test('internal links all resolve', async ({ page, request }) => {
  const hrefs = new Set<string>();
  for (const route of ROUTES) {
    await page.goto(route);
    for (const href of await page.locator('a[href^="/"]').evaluateAll((a) => a.map((l) => l.getAttribute('href')))) {
      if (href) hrefs.add(href.split('#')[0] || '/');
    }
  }
  for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
});

test('keyboard: first Tab reaches the skip link and it moves focus to main', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
});

test('homepage: coming-soon status, no App Store link, no pricing or subscription talk', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Coming soon on iPhone').first()).toBeVisible();
  await expect(page.locator('a[href*="apps.apple.com"]')).toHaveCount(0);
  await expect(page.locator('img[src*="badge" i], img[alt*="app store" i]')).toHaveCount(0);
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/okyo pro|subscription|\$\s?\d|per week|\/\s?week|yearly|free trial/i);
  expect(text).not.toMatch(/app store|testflight|download on the/i);
});

test('homepage screenshot slots are all different screens', async ({ page }) => {
  await page.goto('/');
  const slots = await page.locator('[data-slot]').evaluateAll((els) => els.map((el) => el.getAttribute('data-slot')));
  expect(slots.length).toBeGreaterThan(0);
  expect(new Set(slots).size).toBe(slots.length);
  const sources = await page.locator('[data-slot] img').evaluateAll((images) =>
    images.map((image) => image.getAttribute('src')),
  );
  expect(sources).toHaveLength(6);
  expect(new Set(sources).size, 'a screenshot file is reused for two slots').toBe(sources.length);
});

test('reduced motion turns off smooth scrolling; dark preference keeps the light theme', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/');
  const styles = await page.evaluate(() => ({
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
    background: getComputedStyle(document.body).backgroundColor,
  }));
  expect(styles.scroll).toBe('auto');
  expect(styles.background).toBe('rgb(255, 253, 254)');
});

test('layout holds when images fail to load', async ({ page }) => {
  await page.route(/\.(png|webp|avif)$/, (route) => route.abort());
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const missingAlt = await page.locator('img:not([alt])').count();
  expect(missingAlt).toBe(0);
});

test.describe('built output', () => {
  const textFiles = () => distFiles().filter((f) => /\.(html|js|css|txt|xml|json)$/.test(f));

  test('contains no secrets, app API hosts, or private env-style keys', () => {
    const secret = /sk_live|sk_test|pk_live|pk_test|phc_|sk-or-|OPENROUTER|DATABASE_URL|postgres:\/\/|BEGIN PRIVATE KEY|api\.okyo\.app|CLERK_|EXPO_PUBLIC_/;
    for (const file of textFiles()) expect(readFileSync(file, 'utf8'), file).not.toMatch(secret);
  });

  test('builds exactly the approved pages', () => {
    const pages = readdirSync(DIST).filter((f) => f.endsWith('.html')).sort();
    expect(pages).toEqual(['404.html', 'delete-account.html', 'index.html', 'privacy.html', 'support.html', 'terms.html']);
  });

  test('sitemap lists only indexable pages', () => {
    const xml = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
    expect(locs).toEqual(['https://okyoapp.com', 'https://okyoapp.com/delete-account', 'https://okyoapp.com/support']);
  });

  test('launch gate requires explicit approval of the current legal text', () => {
    let output = '';
    let exitCode = 0;
    try {
      execFileSync('node', [join(import.meta.dirname, '..', 'scripts', 'check-launch-ready.mjs')], { stdio: 'pipe' });
    } catch (error) {
      const failure = error as { status: number; stderr: Buffer };
      exitCode = failure.status;
      output = failure.stderr.toString();
    }
    expect(exitCode).toBe(1);
    for (const reason of ['Legal publication review is pending']) {
      expect(output).toContain(reason);
    }
  });

  test('homepage makes no unsupported claims', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    const forbidden = /testimonial|★|#1\b|users love|clinically|guarantee|lose weight|weight loss|doctor|official recipe|exact calories|\d[\d,.]*\+?\s*(users|downloads|reviews|ratings)/i;
    expect(html).not.toMatch(forbidden);
  });

  test('draft legal pages carry the same version as the in-app legal documents', () => {
    const appLegal = join(import.meta.dirname, '..', '..', 'mobile', 'src', 'legal', 'legalDocuments.ts');
    test.skip(!existsSync(appLegal), 'mobile app source not present');
    const appVersion = readFileSync(appLegal, 'utf8').match(/LEGAL_DOCUMENTS_VERSION\s*=\s*'([^']+)'/)?.[1];
    expect(appVersion).toBeTruthy();
    for (const page of ['privacy', 'terms']) {
      const md = readFileSync(join(import.meta.dirname, '..', 'src', 'legal-drafts', `${page}.md`), 'utf8');
      expect(md.match(/^version: "([^"]+)"/m)?.[1], page).toBe(appVersion);
    }
  });

  test('legal sync keeps the main title as h1 and demotes appended documents', () => {
    const main = toSection('# Privacy Policy\n\n## Contact\nEmail us.', { isMain: true });
    expect(main.title).toBe('Privacy Policy');
    expect(main.text).not.toMatch(/^# /m);
    expect(main.text).toMatch(/^## Contact$/m);
    const extra = toSection('# Subscription Terms\n\n## Payment\nVia Apple.', { isMain: false });
    expect(extra.text).toMatch(/^## Subscription Terms$/m);
    expect(extra.text).toMatch(/^### Payment$/m);
  });
});
