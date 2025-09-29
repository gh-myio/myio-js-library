#!/usr/bin/env node
// scripts/check-bundle-size.mjs
import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';

const BUNDLE_SIZE_LIMIT_KB = 26;
const DIST_DIR = 'dist';

function getFileSize(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const content = fs.readFileSync(filePath);
  const gzipped = gzipSync(content);
  
  return {
    raw: content.length,
    gzipped: gzipped.length
  };
}

function formatBytes(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

function checkBundleSize() {
  const bundlePath = path.join(DIST_DIR, 'myio-js-library.umd.js');
  const size = getFileSize(bundlePath);
  
  if (!size) {
    console.error('❌ Bundle file not found:', bundlePath);
    process.exit(1);
  }
  
  const gzippedKB = size.gzipped / 1024;
  const isWithinLimit = gzippedKB <= BUNDLE_SIZE_LIMIT_KB;
  
  console.log('📦 Bundle Size Report:');
  console.log(`   Raw: ${formatBytes(size.raw)}`);
  console.log(`   Gzipped: ${formatBytes(size.gzipped)}`);
  console.log(`   Limit: ${BUNDLE_SIZE_LIMIT_KB} KB`);
  
  if (isWithinLimit) {
    console.log('✅ Bundle size is within limits');
  } else {
    console.error(`❌ Bundle size exceeds limit by ${formatBytes((gzippedKB - BUNDLE_SIZE_LIMIT_KB) * 1024)}`);
    process.exit(1);
  }
  
  return { size: gzippedKB, limit: BUNDLE_SIZE_LIMIT_KB, withinLimit: isWithinLimit };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkBundleSize();
}

export { checkBundleSize };
