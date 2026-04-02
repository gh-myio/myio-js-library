/**
 * gen_override_v2_smart.js
 * Generates override_v2_smart.json — smart average values for 329 missing slots.
 *
 * Algorithm (per OVERRIDE-SLOTS-MARCO-2026.md):
 *   1. Same weekday, ±1 week → average if both, single if one
 *   2. Same weekday, ±2 weeks
 *   3. Same weekday, ±3 weeks
 *   4. Fallback: same UTC hour, d±1, d±2, ... d±7
 *   value: null + _source: "not_found" if nothing found
 *
 * Exclusions from source pool: 12/03, value ≤ 0, value === "SEM DADOS"
 *
 * Run: node gen_override_v2_smart.js
 * Output: override_v2_smart.json  +  override_v2_smart.min.json
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const BASE  = path.resolve(__dirname, '..');
const SRC   = path.join(BASE, '2026-march');
const DEST  = __dirname;

// ─── Load source records ────────────────────────────────────────────────────

const sourceFiles = [
  'responseJsonCentral1.json',
  'responseJsonCentral2.json',
  'responseJsonCentral3.json',
  'responseJsonCentral4.json',
];

let allRecords = [];
for (const f of sourceFiles) {
  const raw = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  allRecords = allRecords.concat(raw);
}
console.log(`Loaded ${allRecords.length} raw records from ${sourceFiles.length} files.`);

// ─── Build source lookup: Map<deviceName, Map<time_interval_string, value>> ─

// Invalid record filter
function isValidRecord(r) {
  // Exclude 12/03
  const ti = (r.time_interval || '').trim();
  if (ti.startsWith('2026-03-12')) return false;
  // Exclude non-numeric or SEM DADOS
  const v = r.value;
  if (v === 'SEM DADOS' || v === null || v === undefined) return false;
  const n = parseFloat(v);
  if (isNaN(n) || n <= 0) return false;
  return true;
}

// Map: deviceName → Map(time_interval → value)
const sourceMap = new Map(); // Map<string, Map<string, number>>

for (const r of allRecords) {
  if (!isValidRecord(r)) continue;
  const dev = (r.deviceName || '').trim();
  const ti  = (r.time_interval || '').trim();
  const val = parseFloat(r.value);
  if (!sourceMap.has(dev)) sourceMap.set(dev, new Map());
  sourceMap.get(dev).set(ti, val);
}

console.log(`Valid source records indexed for ${sourceMap.size} devices.`);

// ─── Helpers ────────────────────────────────────────────────────────────────

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS  = 24 * 60 * 60 * 1000;

function toISO(d) {
  // Returns "YYYY-MM-DDTHH:mm:ss.000Z"
  return d.toISOString().replace(/\.\d{3}Z$/, '.000Z');
}

function lookupValue(devMap, tsMs) {
  // tsMs → ISO string → lookup
  if (!devMap) return undefined;
  const key = toISO(new Date(tsMs));
  return devMap.get(key);
}

function avg2(a, b) {
  return Math.round((a + b) * 100) / 200 * 2 / 2; // round to 2 decimal
  // simpler:
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ─── Smart average for one slot ──────────────────────────────────────────────

function computeSmartValue(deviceName, timeUTC) {
  const devMap = sourceMap.get(deviceName);
  const slotMs = new Date(timeUTC).getTime();

  // 1. Same weekday, weeks ±1, ±2, ±3
  for (const delta of [1, 2, 3]) {
    const prevMs = slotMs - delta * WEEK_MS;
    const nextMs = slotMs + delta * WEEK_MS;
    const prevV  = lookupValue(devMap, prevMs);
    const nextV  = lookupValue(devMap, nextMs);

    // Skip if either candidate falls on 12/03
    const prevDate = new Date(prevMs);
    const nextDate = new Date(nextMs);
    const prevOn12 = prevDate.getUTCMonth() === 2 && prevDate.getUTCDate() === 12;
    const nextOn12 = nextDate.getUTCMonth() === 2 && nextDate.getUTCDate() === 12;

    const prevOk = prevV !== undefined && !prevOn12;
    const nextOk = nextV !== undefined && !nextOn12;

    if (prevOk && nextOk) {
      return { value: round2((prevV + nextV) / 2), _source: `week-${delta}+week+${delta}` };
    }
    if (prevOk) {
      return { value: round2(prevV), _source: `week-${delta}` };
    }
    if (nextOk) {
      return { value: round2(nextV), _source: `week+${delta}` };
    }
  }

  // 2. Fallback: same UTC hour, adjacent days ±1..±7
  for (let d = 1; d <= 7; d++) {
    const prevMs = slotMs - d * DAY_MS;
    const nextMs = slotMs + d * DAY_MS;
    const prevV  = lookupValue(devMap, prevMs);
    const nextV  = lookupValue(devMap, nextMs);

    const prevDate = new Date(prevMs);
    const nextDate = new Date(nextMs);
    const prevOn12 = prevDate.getUTCMonth() === 2 && prevDate.getUTCDate() === 12;
    const nextOn12 = nextDate.getUTCMonth() === 2 && nextDate.getUTCDate() === 12;

    const prevOk = prevV !== undefined && !prevOn12;
    const nextOk = nextV !== undefined && !nextOn12;

    if (prevOk && nextOk) {
      return { value: round2((prevV + nextV) / 2), _source: `day-${d}+day+${d}` };
    }
    if (prevOk) {
      return { value: round2(prevV), _source: `day-${d}` };
    }
    if (nextOk) {
      return { value: round2(nextV), _source: `day+${d}` };
    }
  }

  return { value: null, _source: 'not_found' };
}

// ─── Load missing slots from JSON A ─────────────────────────────────────────

const jsonA = JSON.parse(fs.readFileSync(path.join(DEST, 'override_v1_raw.json'), 'utf8'));

// ─── Build JSON B ────────────────────────────────────────────────────────────

let totalSlots = 0;
let notFound   = 0;
const sourceStats = {};

const deviceListB = jsonA.device_list_interval_values.map(device => {
  const valuesB = device.values_list.map(slot => {
    const { value, _source } = computeSmartValue(device.deviceCentralName, slot.timeUTC);
    totalSlots++;
    if (_source === 'not_found') notFound++;
    sourceStats[_source] = (sourceStats[_source] || 0) + 1;
    return { timeUTC: slot.timeUTC, value, _source };
  });
  return {
    tbName:             device.tbName,
    tbLabel:            device.tbLabel,
    deviceCentralName:  device.deviceCentralName,
    values_list:        valuesB,
  };
});

const jsonB = { device_list_interval_values: deviceListB };

// ─── Write outputs ───────────────────────────────────────────────────────────

const outPretty = path.join(DEST, 'override_v2_smart.json');
const outMin    = path.join(DEST, 'override_v2_smart.min.json');

fs.writeFileSync(outPretty, JSON.stringify(jsonB, null, 2), 'utf8');
fs.writeFileSync(outMin,    JSON.stringify(jsonB),          'utf8');

// ─── Report ──────────────────────────────────────────────────────────────────

console.log('\n=== JSON B — override_v2_smart ===');
console.log(`Total slots: ${totalSlots}`);
console.log(`not_found:   ${notFound}`);
console.log('\nSource distribution:');
const sorted = Object.entries(sourceStats).sort((a, b) => b[1] - a[1]);
for (const [src, count] of sorted) {
  console.log(`  ${src.padEnd(22)} ${count}`);
}
const prettyKB = (fs.statSync(outPretty).size / 1024).toFixed(1);
const minKB    = (fs.statSync(outMin).size    / 1024).toFixed(1);
console.log(`\nWritten: ${outPretty} (${prettyKB} KB)`);
console.log(`Written: ${outMin} (${minKB} KB)`);
