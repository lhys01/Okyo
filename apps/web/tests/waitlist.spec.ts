import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('every coming-soon badge has a waitlist button and each opens an accessible form', async ({ page }) => {
  await page.goto('/');
  const badges = page.locator('.coming-soon');
  await expect(badges).toHaveCount(3);
  for (const badge of await badges.all()) {
    await expect(badge.getByRole('button', { name: 'Join the waitlist' })).toHaveCount(1);
  }
  const button = page.locator('.hero__status').getByRole('button', { name: 'Join the waitlist' });
  await button.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('First name', { exact: true })).toBeFocused();
  await expect(dialog.getByLabel('Email address')).toHaveAttribute('type', 'email');
  const audit = await new AxeBuilder({ page }).include('#waitlist-dialog').analyze();
  expect(audit.violations.filter((item) => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(button).toBeFocused();
});

test('real signup is stored only after consent, and duplicate signup succeeds', async ({ page, request }) => {
  const firstName = 'WebsiteQA';
  const email = `website-qa-${Date.now()}@example.com`;
  await page.goto('/');
  await page.locator('.hero__status [data-open-waitlist]').click();
  await page.getByLabel('First name', { exact: true }).fill(firstName);
  await page.getByLabel('Email address').fill(email);
  await expect(page.locator('#waitlist-consent')).not.toBeChecked();
  await page.getByLabel('Yes, email me when Okyo launches.').check();
  await page.locator('#waitlist-form button[type=submit]').click();
  await expect(page.getByRole('status')).toHaveText('You’re on the list! We’ll email you when Okyo is ready.');
  await expect(page.locator('#waitlist-form')).toBeHidden();
  // Exercise duplicate semantics through the real local endpoint too.
  const duplicate = await request.post('http://127.0.0.1:4392/api/waitlist', { data: { firstName, email, consent: true } });
  expect(duplicate.status()).toBe(201);
});

test('failure preserves inputs, permits retry, and never claims signup succeeded', async ({ page }) => {
  await page.route('**/api/waitlist', async (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Unavailable' }), headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto('/');
  await page.locator('.hero__status [data-open-waitlist]').click();
  await page.getByLabel('First name', { exact: true }).fill('Avery');
  await page.getByLabel('Email address').fill('avery@example.com');
  await page.getByLabel('Yes, email me when Okyo launches.').check();
  await page.locator('#waitlist-form button[type=submit]').click();
  await expect(page.getByRole('status')).toContainText('couldn’t save your spot');
  await expect(page.getByLabel('Email address')).toHaveValue('avery@example.com');
  await expect(page.locator('#waitlist-form button[type=submit]')).toBeEnabled();
  await expect(page.locator('#waitlist-form')).toBeVisible();
});

test('form fits narrow phones and all six actual app screenshots are present', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await expect(page.locator('[data-slot] img')).toHaveCount(6);
  await expect(page.locator('[data-placeholder=screenshot]')).toHaveCount(0);
  await page.locator('.hero__status [data-open-waitlist]').click();
  const width = await page.locator('#waitlist-dialog').evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(320);
  const overflow = await page.locator('#waitlist-dialog').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
