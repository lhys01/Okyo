// @ts-check
import { defineConfig } from 'astro/config';

// Static site only: no server, no adapter, no environment variables.
export default defineConfig({
  site: 'https://okyoapp.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  vite: { build: { sourcemap: false } },
});
