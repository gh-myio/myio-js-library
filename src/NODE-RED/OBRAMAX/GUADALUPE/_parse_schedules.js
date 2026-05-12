/**
 * One-off parser for stored_schedules.log (Node-RED context inspector dump).
 * Reads the .log line-by-line and emits a JSON object whose shape matches
 * what `flow.get('stored_schedules')` would return.
 *
 *   node _parse_schedules.js > _stored_schedules.json
 *
 * Throwaway — delete after the parsed block is merged into
 * `context_data_flow_guadalupe_2026_05_12_11_56.json`.
 */

const fs = require('fs');
const path = require('path');

const lines = fs
  .readFileSync(path.join(__dirname, 'stored_schedules.log'), 'utf8')
  .split(/\r?\n/);

const out = {};
let currentKey = null;     // top-level schedule name (e.g. "SPT3: COMP1")
let currentIdx = -1;       // index within the array (0,1,2,...)
let currentEntry = null;   // the entry object being built
let inDaysWeek = false;

function pushEntry() {
  if (currentKey != null && currentEntry != null) {
    out[currentKey][currentIdx] = currentEntry;
    currentEntry = null;
    inDaysWeek = false;
  }
}

function parseValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  // strip surrounding quotes if present
  const m = raw.match(/^"(.*)"$/);
  return m ? m[1] : raw;
}

for (const raw of lines) {
  const line = raw.trim();
  if (!line || line === 'object') continue;

  // top-level array declaration: `KEYNAME: array[N]`
  const arrMatch = line.match(/^(.+?):\s*array\[(\d+)\]$/);
  if (arrMatch) {
    pushEntry();
    currentKey = arrMatch[1];
    out[currentKey] = new Array(Number(arrMatch[2])).fill(null);
    currentIdx = -1;
    continue;
  }

  // array element declaration: `N: object`
  const elemMatch = line.match(/^(\d+):\s*object$/);
  if (elemMatch) {
    pushEntry();
    currentIdx = Number(elemMatch[1]);
    currentEntry = { type: null, startHour: null, endHour: null, daysWeek: {}, retain: null };
    inDaysWeek = false;
    continue;
  }

  // nested daysWeek object header
  if (line === 'daysWeek: object') {
    inDaysWeek = true;
    continue;
  }

  // generic `key: value`
  const kvMatch = line.match(/^([^:]+):\s*(.+)$/);
  if (!kvMatch || !currentEntry) continue;
  const key = kvMatch[1].trim();
  const value = parseValue(kvMatch[2].trim());

  if (inDaysWeek && ['mon','tue','wed','thu','fri','sat','sun','holiday'].includes(key)) {
    currentEntry.daysWeek[key] = value;
    // 'holiday' is the last in the daysWeek block — close it
    if (key === 'holiday') inDaysWeek = false;
  } else if (['type','startHour','endHour','retain'].includes(key)) {
    currentEntry[key] = value;
  }
}
pushEntry();

// audit summary on stderr
const totalKeys = Object.keys(out).length;
const totalEntries = Object.values(out).reduce((a, v) => a + v.length, 0);
const filled = Object.values(out)
  .reduce((a, v) => a + v.filter(x => x && x.type).length, 0);
process.stderr.write(
  `parsed: ${totalKeys} keys, ${totalEntries} array slots, ${filled} entries filled\n`
);

process.stdout.write(JSON.stringify(out, null, 2));
