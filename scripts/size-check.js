#!/usr/bin/env node

/**
 * Bundle size guard - checks that the built files don't exceed size limits
 * Helps prevent accidental bundle bloat
 */

import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// Size limits in bytes
const SIZE_LIMITS = {
  'dist/index.js': 50 * 1024,        // 50KB for ESM build
  'dist/index.cjs': 50 * 1024,       // 50KB for CJS build
  'dist/myio-js-library.umd.js': 60 * 1024,      // 60KB for UMD build
  'dist/myio-js-library.umd.min.js': 25 * 1024,  // 25KB for minified UMD
  'dist/index.d.ts': 10 * 1024       // 10KB for TypeScript definitions
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function log(message) {
  console.log(`[SIZE CHECK] ${message}`);
}

function checkFileSize(filePath, limit) {
  try {
    const stats = statSync(filePath);
    const size = stats.size;
    const limitFormatted = formatBytes(limit);
    const sizeFormatted = formatBytes(size);
    
    if (size <= limit) {
      log(`✅ ${filePath}: ${sizeFormatted} (limit: ${limitFormatted})`);
      return true;
    } else {
      const overage = formatBytes(size - limit);
      log(`❌ ${filePath}: ${sizeFormatted} exceeds limit of ${limitFormatted} by ${overage}`);
      return false;
    }
  } catch (error) {
    log(`❌ ${filePath}: File not found or inaccessible`);
    return false;
  }
}

function analyzeBundle() {
  try {
    // Get gzipped sizes for better real-world estimates
    const files = Object.keys(SIZE_LIMITS);
    
    log('\n📊 Bundle Analysis:');
    
    for (const file of files) {
      try {
        // Get original size
        const stats = statSync(file);
        const originalSize = stats.size;
        
        // Get gzipped size (approximate)
        const tempFile = `${file}.temp.gz`;
        execSync(`gzip -c "${file}" > "${tempFile}"`, { stdio: 'ignore' });
        const gzippedStats = statSync(tempFile);
        const gzippedSize = gzippedStats.size;
        execSync(`rm "${tempFile}"`, { stdio: 'ignore' });
        
        const compressionRatio = ((originalSize - gzippedSize) / originalSize * 100).toFixed(1);
        
        log(`   ${file}:`);
        log(`     Original: ${formatBytes(originalSize)}`);
        log(`     Gzipped:  ${formatBytes(gzippedSize)} (${compressionRatio}% compression)`);
      } catch (error) {
        log(`   ${file}: Analysis failed`);
      }
    }
  } catch (error) {
    log(`Bundle analysis failed: ${error.message}`);
  }
}

function checkDependencies() {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const dependencies = packageJson.dependencies || {};
    const depCount = Object.keys(dependencies).length;
    
    if (depCount === 0) {
      log(`✅ Dependencies: ${depCount} runtime dependencies (zero-dependency library)`);
      return true;
    } else {
      log(`⚠️  Dependencies: ${depCount} runtime dependencies found`);
      Object.keys(dependencies).forEach(dep => {
        log(`     - ${dep}@${dependencies[dep]}`);
      });
      return false;
    }
  } catch (error) {
    log(`❌ Dependencies check failed: ${error.message}`);
    return false;
  }
}

async function runSizeCheck() {
  log('Starting bundle size check...');
  
  // Ensure the package is built
  try {
    log('Building package...');
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    log('❌ Build failed, cannot check sizes');
    process.exit(1);
  }
  
  let allPassed = true;
  
  // Check individual file sizes
  log('\n📏 File Size Checks:');
  for (const [filePath, limit] of Object.entries(SIZE_LIMITS)) {
    const passed = checkFileSize(filePath, limit);
    if (!passed) allPassed = false;
  }
  
  // Check dependencies
  log('\n📦 Dependency Check:');
  const depsOk = checkDependencies();
  if (!depsOk) {
    log('   Note: Runtime dependencies increase bundle size for consumers');
  }
  
  // Analyze bundle composition
  analyzeBundle();
  
  // Summary
  log('\n📋 Summary:');
  if (allPassed) {
    log('🎉 All size checks passed! Bundle size is within limits.');
    
    // Calculate total bundle size
    const totalSize = Object.keys(SIZE_LIMITS).reduce((sum, file) => {
      try {
        return sum + statSync(file).size;
      } catch {
        return sum;
      }
    }, 0);
    
    log(`📊 Total bundle size: ${formatBytes(totalSize)}`);
    process.exit(0);
  } else {
    log('💥 Some files exceed size limits!');
    log('   Consider:');
    log('   - Removing unused exports');
    log('   - Code splitting for large features');
    log('   - Tree-shaking optimizations');
    log('   - Reviewing dependencies');
    process.exit(1);
  }
}

runSizeCheck().catch(error => {
  log(`💥 Size check failed: ${error.message}`);
  process.exit(1);
});
