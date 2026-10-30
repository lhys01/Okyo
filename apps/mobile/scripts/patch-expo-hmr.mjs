import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expoRoot = resolve(mobileRoot, 'node_modules/expo/src/async-require');

let changed = false;

replaceOnce(
  resolve(expoRoot, 'hmr.ts'),
  `  resetErrorOverlay,\n  showLoading,`,
  `  resetErrorOverlay,\n  reload,\n  showLoading,`
);
replaceOnce(
  resolve(expoRoot, 'hmr.ts'),
  `    // "Bundle Splitting – Metro disconnected"\n    window.location.reload();`,
  `    // "Bundle Splitting – Metro disconnected"\n    reload();`
);
replaceOnce(
  resolve(expoRoot, 'hmrUtils.ts'),
  `export function reload() {\n  // "Bundle Splitting – Metro disconnected"\n  window.location.reload();\n}`,
  `export function reload() {\n  // "Bundle Splitting – Metro disconnected"\n  if (\n    process.env.NODE_ENV !== 'production' &&\n    typeof window !== 'undefined' &&\n    window.location &&\n    typeof window.location.reload === 'function'\n  ) {\n    window.location.reload();\n  } else {\n    console.warn('[Expo HMR] Metro disconnected; browser reload is unavailable.');\n  }\n}`
);
replaceOnce(
  resolve(expoRoot, 'hmrUtils.native.ts'),
  `export function reload() {\n  // @ts-expect-error missing types\n  DevSettings.reload('Bundle Splitting – Metro disconnected');\n}`,
  `export function reload() {\n  if (process.env.NODE_ENV !== 'production' && typeof DevSettings?.reload === 'function') {\n    // @ts-expect-error missing types\n    DevSettings.reload('Bundle Splitting – Metro disconnected');\n  } else {\n    console.warn('[Expo HMR] Metro disconnected; native reload is unavailable.');\n  }\n}`
);

console.log(changed ? 'Patched Expo HMR reload handling.' : 'Expo HMR reload handling already patched.');

function replaceOnce(filePath, before, after) {
  const source = readFileSync(filePath, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    throw new Error(`Expected Expo HMR source was not found in ${filePath}`);
  }
  writeFileSync(filePath, source.replace(before, after));
  changed = true;
}
