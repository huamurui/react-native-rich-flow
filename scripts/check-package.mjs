import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'rich-flow-package-check-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (args, cwd = root) => execFileSync(npm, args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
});
try {
  run(['run', 'build']);
  const [archive] = JSON.parse(run(['pack', '--ignore-scripts', '--json', '--pack-destination', temporary]));
  const files = new Set(archive.files.map((file) => file.path));
  for (const required of ['LICENSE', 'expo-module.config.json', 'dist/esm/index.js', 'dist/cjs/index.js',
    'dist/esm/native/index.js', 'dist/esm/native/index.d.ts', 'dist/esm/adapters/index.js',
    'android/build.gradle', 'android/src/main/java/com/richflow/text/RichFlowModule.kt', 'ios/RichFlow.podspec', 'ios/RichFlowModule.swift']) {
    assert.ok(files.has(required), `Missing published file: ${required}`);
  }
  for (const file of files) {
    assert.ok(!/(^|\/)(node_modules|build|Pods|\.gradle|\.git|\.npmrc|\.env)(\/|$)/.test(file), `Unexpected packed path: ${file}`);
    assert.ok(!file.startsWith('example/'), 'The example must stay outside the installed library');
  }
  writeFileSync(join(temporary, 'package.json'), JSON.stringify({ name: 'rich-flow-package-check', private: true, type: 'module' }));
  run(['install', join(temporary, archive.filename), '--ignore-scripts', '--no-audit', '--no-fund'], temporary);
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { compileDocument, getRichTextSelectionText } from 'react-native-rich-flow';
    import { parseMarkdown, parseHtml } from 'react-native-rich-flow/adapters';
    const flow = compileDocument(parseMarkdown('**One**\\n\\nTwo 😀'));
    assert.equal(getRichTextSelectionText(flow, 0, flow.text.length), 'One\\nTwo 😀');
    assert.equal(compileDocument(parseHtml('<p>A &amp; B</p>')).text, 'A & B');
    const require = createRequire(import.meta.url);
    assert.equal(require('react-native-rich-flow').compileDocument(require('react-native-rich-flow/adapters').parseMarkdown('CJS')).text, 'CJS');
  `], { cwd: temporary, stdio: 'inherit' });
  const installed = JSON.parse(readFileSync(join(temporary, 'node_modules/react-native-rich-flow/package.json'), 'utf8'));
  assert.equal(installed.license, 'MIT');
  console.log(`Verified ${archive.files.length} packed files and installed ESM/CommonJS core + adapter consumers.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
