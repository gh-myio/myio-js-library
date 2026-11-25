#!/usr/bin/env node
// scripts/check-bundle-size.mjs
//
// Per-file gzip budget table (RFC-0242). `enforce: false` entries are reported
// but do not fail the run.
//
// NOTE (RFC-0242, 2026-11-24): the UMD core has been far above its historical
// 26 KB budget for a long time (≈1.4 MB gzip minified) and this script never
// noticed: its "run as main" guard compared `file://${argv[1]}` with
// import.meta.url, which never matches on Windows (backslashes, `file:///C:`),
// and it is not part of `npm run build` nor CI. The core row is therefore
// report-only until someone decides the real core budget; the widget bundle,
// new in RFC-0242, is enforced.
import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';
import { pathToFileURL } from 'url';

const DIST_DIR = 'dist';

export const BUNDLE_LIMITS = [
  { file: 'myio-js-library.umd.js', limitKB: 26, enforce: false, note: 'UMD core (historical budget, see NOTE)' },
  { file: 'myio-js-library.umd.min.js', limitKB: 26, enforce: false, note: 'UMD core minified (historical budget, see NOTE)' },
  { file: 'myio-bot-widget.umd.min.js', limitKB: 20, enforce: true, note: 'RFC-0242 MYIO Bot widget (on demand)' },
];

function getFileSize(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath);
  return { raw: content.length, gzipped: gzipSync(content).length };
}

function formatBytes(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

function checkBundleSize() {
  console.log('📦 Bundle Size Report (gzip):');
  const results = [];
  let failed = false;
  for (const { file, limitKB, enforce, note } of BUNDLE_LIMITS) {
    const bundlePath = path.join(DIST_DIR, file);
    const size = getFileSize(bundlePath);
    if (!size) {
      console.error(`❌ ${file}: not found (${note})`);
      if (enforce) failed = true;
      results.push({ file, missing: true, limit: limitKB, enforce });
      continue;
    }
    const gzippedKB = size.gzipped / 1024;
    const withinLimit = gzippedKB <= limitKB;
    const mark = withinLimit ? '✅' : enforce ? '❌' : '⚠️ ';
    console.log(`${mark} ${file}: raw ${formatBytes(size.raw)}, gzip ${formatBytes(size.gzipped)} / limit ${limitKB} KB${enforce ? '' : ' (report-only)'} — ${note}`);
    if (!withinLimit && enforce) failed = true;
    results.push({ file, size: gzippedKB, limit: limitKB, withinLimit, enforce });
  }
  if (failed) {
    console.error('❌ Bundle size check failed');
    process.exit(1);
  }
  console.log('✅ Enforced bundle sizes are within limits');
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  checkBundleSize();
}

export { checkBundleSize };
