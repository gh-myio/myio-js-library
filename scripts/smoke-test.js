#!/usr/bin/env node

/**
 * Smoke tests for different module formats
 * Tests basic imports and function calls to ensure the build works correctly
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const testResults = [];

function log(message) {
  console.log(`[SMOKE TEST] ${message}`);
}

function logResult(test, success, error = null) {
  const result = { test, success, error };
  testResults.push(result);
  
  if (success) {
    log(`✅ ${test}`);
  } else {
    log(`❌ ${test}: ${error}`);
  }
}

// Test ESM import in Node.js
function testESMImport() {
  try {
    const testCode = `
import { formatEnergy, fmtPerc, getValueByDatakey } from 'myio-js-library';

// Test basic functionality
const energy = formatEnergy(1234.56, 'kWh');
const percentage = fmtPerc(0.1234);
const value = getValueByDatakey({ test: { nested: 42 } }, 'test.nested');

console.log('ESM Test Results:');
console.log('Energy:', energy);
console.log('Percentage:', percentage);
console.log('Value:', value);

if (energy.includes('1.234,56') && percentage.includes('12,34%') && value === 42) {
  console.log('ESM_SUCCESS');
} else {
  console.log('ESM_FAILED');
}
`;
    
    writeFileSync('test-esm.mjs', testCode);
    const output = execSync('node test-esm.mjs', { encoding: 'utf8' });
    
    if (output.includes('ESM_SUCCESS')) {
      logResult('ESM Import', true);
    } else {
      logResult('ESM Import', false, 'Function outputs incorrect');
    }
    
    // Cleanup
    execSync('rm test-esm.mjs', { stdio: 'ignore' });
  } catch (error) {
    logResult('ESM Import', false, error.message);
  }
}

// Test CJS require in Node.js
function testCJSRequire() {
  try {
    const testCode = `
const { formatEnergy, fmtPerc, getValueByDatakey } = require('myio-js-library');

// Test basic functionality
const energy = formatEnergy(1234.56, 'kWh');
const percentage = fmtPerc(0.1234);
const value = getValueByDatakey({ test: { nested: 42 } }, 'test.nested');

console.log('CJS Test Results:');
console.log('Energy:', energy);
console.log('Percentage:', percentage);
console.log('Value:', value);

if (energy.includes('1.234,56') && percentage.includes('12,34%') && value === 42) {
  console.log('CJS_SUCCESS');
} else {
  console.log('CJS_FAILED');
}
`;
    
    writeFileSync('test-cjs.js', testCode);
    const output = execSync('node test-cjs.js', { encoding: 'utf8' });
    
    if (output.includes('CJS_SUCCESS')) {
      logResult('CJS Require', true);
    } else {
      logResult('CJS Require', false, 'Function outputs incorrect');
    }
    
    // Cleanup
    execSync('rm test-cjs.js', { stdio: 'ignore' });
  } catch (error) {
    logResult('CJS Require', false, error.message);
  }
}

// Test UMD build exists and is valid
function testUMDBuild() {
  try {
    const umdPath = join('dist', 'myio-js-library.umd.js');
    const umdMinPath = join('dist', 'myio-js-library.umd.min.js');
    
    // Check if UMD files exist
    const umdContent = readFileSync(umdPath, 'utf8');
    const umdMinContent = readFileSync(umdMinPath, 'utf8');
    
    // Check for UMD pattern
    if (umdContent.includes('MyIOLibrary') && 
        umdContent.includes('function(global, factory)') &&
        umdMinContent.length > 0) {
      logResult('UMD Build', true);
    } else {
      logResult('UMD Build', false, 'UMD pattern not found or minified file empty');
    }
  } catch (error) {
    logResult('UMD Build', false, error.message);
  }
}

// Test TypeScript definitions
function testTypeScriptDefinitions() {
  try {
    const dtsPath = join('dist', 'index.d.ts');
    const dtsContent = readFileSync(dtsPath, 'utf8');
    
    // Check for key function declarations
    const hasFormatEnergy = dtsContent.includes('formatEnergy');
    const hasFmtPerc = dtsContent.includes('fmtPerc');
    const hasGetValueByDatakey = dtsContent.includes('getValueByDatakey');
    
    if (hasFormatEnergy && hasFmtPerc && hasGetValueByDatakey) {
      logResult('TypeScript Definitions', true);
    } else {
      logResult('TypeScript Definitions', false, 'Missing key function declarations');
    }
  } catch (error) {
    logResult('TypeScript Definitions', false, error.message);
  }
}

// Test package.json exports
function testPackageExports() {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    
    const hasMain = packageJson.main;
    const hasModule = packageJson.module;
    const hasTypes = packageJson.types;
    const hasExports = packageJson.exports;
    
    if (hasMain && hasModule && hasTypes && hasExports) {
      logResult('Package Exports', true);
    } else {
      logResult('Package Exports', false, 'Missing required package.json fields');
    }
  } catch (error) {
    logResult('Package Exports', false, error.message);
  }
}

// Main test runner
async function runSmokeTests() {
  log('Starting smoke tests...');
  
  // Ensure the package is built
  try {
    log('Building package...');
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    log('❌ Build failed, cannot run smoke tests');
    process.exit(1);
  }
  
  // Run tests
  testPackageExports();
  testTypeScriptDefinitions();
  testUMDBuild();
  testESMImport();
  testCJSRequire();
  
  // Summary
  const passed = testResults.filter(r => r.success).length;
  const total = testResults.length;
  
  log(`\nSummary: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    log('🎉 All smoke tests passed!');
    process.exit(0);
  } else {
    log('💥 Some smoke tests failed');
    testResults.filter(r => !r.success).forEach(r => {
      log(`   - ${r.test}: ${r.error}`);
    });
    process.exit(1);
  }
}

runSmokeTests().catch(error => {
  log(`💥 Smoke test runner failed: ${error.message}`);
  process.exit(1);
});
