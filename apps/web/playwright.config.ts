import { defineConfig, devices } from '@playwright/test';

const PORT = 4387;

// Runs against the built static site (`npm test` builds first).
// Set BASE_URL to test a deployed copy instead (e.g. a preview URL).
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
  },
  webServer: process.env.BASE_URL
    ? undefined
    : [{
        command: `npx astro preview --port ${PORT} --ignore-lock`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
      }, {
        command: 'npm --prefix ../waitlist start',
        url: 'http://127.0.0.1:4392/health',
        reuseExistingServer: true,
      }],
});
