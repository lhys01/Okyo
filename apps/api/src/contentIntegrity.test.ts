import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(entryPath);
    }
    return entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

test('API source and prompts contain no forbidden recipe messaging or decorative emoji', () => {
  const thisFile = fileURLToPath(import.meta.url);
  const files = sourceFiles(srcDir).filter((file) => file !== thisFile);
  const forbidden = [
    /why you.?ll love this/i,
    new RegExp(['flavor', 'notes'].join('\\s+'), 'i'),
    /inspired[- ]by/i,
    /restaurant[- ]inspired/i,
    /restaurant[- ]style/i,
    new RegExp(['easy', 'swaps'].join('\\s+'), 'i'),
    new RegExp(['why', 'this', 'matters'].join('\\s+'), 'i'),
    new RegExp(['avoid', 'this'].join('\\s+'), 'i'),
  ];
  const decorativeEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const phrase of forbidden) {
      assert.equal(phrase.test(source), false, `${path.relative(srcDir, file)} contains forbidden copy`);
    }
    assert.equal(
      decorativeEmoji.test(source),
      false,
      `${path.relative(srcDir, file)} contains decorative emoji`,
    );
  }
});
