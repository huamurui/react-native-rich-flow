import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const compiler = require.resolve('typescript/bin/tsc');

rmSync(new URL('../dist/', import.meta.url), { recursive: true, force: true });
for (const options of [
  [],
  ['--module', 'commonjs', '--moduleResolution', 'node', '--outDir', 'dist/cjs'],
]) {
  const result = spawnSync(process.execPath, [compiler, '-p', 'tsconfig.json', ...options], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
mkdirSync(new URL('../dist/cjs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/cjs/package.json', import.meta.url), '{"type":"commonjs"}\n');
