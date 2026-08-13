import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : name.endsWith('.tsx') ? [path] : [];
  });
}

test('every V3 press target and text input has an explicit accessibility contract', () => {
  const root = resolve(process.cwd(), 'src/onboarding-v3');
  const files = [...sourceFiles(root), resolve(process.cwd(), 'src/components/ScanEntryOptions.tsx')];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(sourceFile);
        const props = new Set(node.attributes.properties.flatMap((attribute) => (
          ts.isJsxAttribute(attribute) ? [attribute.name.getText(sourceFile)] : []
        )));
        if (tag === 'Pressable' || tag === 'AnimatedPressable') {
          assert.ok(props.has('accessibilityLabel'), `${file}: ${tag} needs accessibilityLabel`);
          assert.ok(props.has('accessibilityRole'), `${file}: ${tag} needs accessibilityRole`);
        }
        if (tag === 'TextInput') {
          assert.ok(props.has('accessibilityLabel'), `${file}: TextInput needs accessibilityLabel`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
});
