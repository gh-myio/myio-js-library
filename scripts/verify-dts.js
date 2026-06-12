// Guards the published type definitions. Historically a postbuild step copied
// a 16-line stub over the tsup-generated dist/index.d.ts, so every published
// release shipped without real types. This script replaces that step: it only
// validates, never writes.
import { existsSync, statSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '../dist');

const MIN_DTS_BYTES = 100 * 1024; // real index.d.ts is ~880 KB; stub was <1 KB
const REQUIRED_EXPORTS = ['InfoTooltip', 'ColumnSummaryTooltip'];

const checks = [
  { file: 'index.d.ts', minBytes: MIN_DTS_BYTES, mustContain: REQUIRED_EXPORTS },
  { file: 'index.d.cts', minBytes: MIN_DTS_BYTES, mustContain: REQUIRED_EXPORTS },
  { file: 'tooltips.d.ts', minBytes: 1024, mustContain: REQUIRED_EXPORTS },
  { file: 'tooltips.d.cts', minBytes: 1024, mustContain: REQUIRED_EXPORTS },
];

let failed = false;
for (const { file, minBytes, mustContain } of checks) {
  const path = resolve(dist, file);
  if (!existsSync(path)) {
    console.error(`[verify-dts] MISSING: dist/${file}`);
    failed = true;
    continue;
  }
  const size = statSync(path).size;
  if (size < minBytes) {
    console.error(`[verify-dts] dist/${file} is ${size} bytes (< ${minBytes}) — looks like a stub, not generated types`);
    failed = true;
    continue;
  }
  const content = readFileSync(path, 'utf8');
  const missing = mustContain.filter((name) => !content.includes(name));
  if (missing.length) {
    console.error(`[verify-dts] dist/${file} is missing expected declarations: ${missing.join(', ')}`);
    failed = true;
    continue;
  }
  console.log(`[verify-dts] dist/${file} OK (${(size / 1024).toFixed(1)} KB)`);
}

if (failed) process.exit(1);
console.log('[verify-dts] All type definition files verified.');
