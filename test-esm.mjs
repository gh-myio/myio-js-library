
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
