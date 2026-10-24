import { test } from '@playwright/test';

// Review aid, not an assertion: `SCREENSHOTS=1 npx playwright test screenshots`
// writes full-page captures to test-results/screens/.
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to capture review screenshots');

const ROUTES = ['/', '/privacy', '/terms', '/support', '/delete-account', '/nope'];

for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
  for (const route of ROUTES) {
    test(`capture ${route} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.evaluate(async () => {
        for (const img of Array.from(document.images)) img.loading = 'eager';
        await document.fonts.ready;
      });
      await page.waitForLoadState('networkidle');
      const name = route === '/' ? 'home' : route.slice(1);
      await page.screenshot({ path: `test-results/screens/${name}-${width}.png`, fullPage: true });
    });
  }
}
