
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
