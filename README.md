# myio-js-library

A clean, standalone JavaScript SDK for **MYIO** projects.  
Works in **Node.js (>=18)** and modern browsers.  
Distributed as **ESM**, **CJS**, and **UMD** (with a pre-minified build for CDN usage).

---

## 🚀 Features

- 🔑 **Core codecs** — e.g., `decodePayloadBase64Xor`.
- 🌐 **HTTP wrapper** — with retries, timeout, and backoff.
- 🏷️ **Namespace utilities** — add prefixes/suffixes to object keys.
- 📱 **Device detection** — context-aware device type identification.
- 🧩 **String utilities** — normalization helpers.
- 🔢 **Number utilities** — safe fixed formatting, percentages.
- ⚡ **Energy formatting** — Brazilian locale energy unit formatting (kWh, MWh, GWh).
- 📅 **Date utilities** — date formatting, interval detection, São Paulo timezone handling.
- 📊 **CSV export** — data export to CSV format with proper escaping (returns strings, no DOM manipulation).
- 🏷️ **Classification** — energy entity classification utilities.
- 🔍 **Data access** — nested object value retrieval with datakey paths.
- ⚡ **Dual module support** — ESM and CJS.
- 🌍 **Browser-ready** — UMD global + CDN link.

---

## 📦 Installation

```bash
npm install myio-js-library
# or
yarn add myio-js-library
# or
pnpm add myio-js-library
```

## 🛠 Usage

### Node.js (ESM)
```javascript
import { 
  decodePayload, 
  decodePayloadBase64Xor,
  fetchWithRetry, 
  http,
  addNamespace, 
  detectDeviceType,
  strings, 
  numbers,
  formatEnergy,
  formatWaterVolumeM3,
  formatDateToYMD,
  exportToCSV,
  classifyWaterLabel,
  getValueByDatakey
} from 'myio-js-library';

// Decode with string key
const text = decodePayload('AwAVBwo=', 'key'); // "hello"
console.log(text);

// HTTP request with retries
const response = await fetchWithRetry('https://api.example.com/data', {
  retries: 3,
  timeout: 5000
});

// Add namespace to object keys
const data = { temperature: 25, humidity: 60 };
const namespaced = addNamespace(data, 'sensor1'); 
// { "temperature (sensor1)": 25, "humidity (sensor1)": 60 }

// Detect device type from context
const deviceType = detectDeviceType('building', 'floor2-room101');
console.log(deviceType); // "room" or "unknown"
```

### Node.js (CJS)
```javascript
const { 
  decodePayload, 
  fetchWithRetry, 
  addNamespace, 
  detectDeviceType,
  strings, 
  numbers 
} = require('myio-js-library');
```

### Browser (CDN/UMD)
```html
<script src="https://unpkg.com/myio-js-library@0.1.0/dist/myio-js-library.umd.min.js"></script>
<script>
  // Decode payload
  const text = MyIOLibrary.decodePayload('AwAVBwo=', 'key');
  console.log(text); // "hello"
  
  // Add namespace to data
  const data = { temperature: 25, humidity: 60 };
  const namespaced = MyIOLibrary.addNamespace(data, 'sensor1');
  console.log(namespaced); // { "temperature (sensor1)": 25, "humidity (sensor1)": 60 }
  
  // Detect device type
  const deviceType = MyIOLibrary.detectDeviceType('building', 'floor2-room101');
  console.log(deviceType); // "room"
</script>
```

## 📚 API

### Codec Functions

#### `decodePayload(encoded: string, key: string | number | null | undefined): string`

Advanced base64 XOR decoder with flexible key support:
- **String key**: Repeats the key over the bytes (e.g., "abc" -> "abcabcabc...")
- **Number key**: Applies single byte (0-255) to all bytes
- **Empty/null/undefined key**: No XOR applied (plain base64 decode)

```javascript
import { decodePayload } from 'myio-js-library';

// String key (repeating)
const result1 = decodePayload('AwAVBwo=', 'key'); // "hello"

// Number key (single byte)
const result2 = decodePayload('SGVsbG8=', 73); // XOR with 73

// No key (plain decode)
const result3 = decodePayload('aGVsbG8=', ''); // "hello"
```

#### `decodePayloadBase64Xor(encoded: string, xorKey?: number): string`

Legacy compatibility function for single-byte XOR (defaults to 73).

```javascript
import { decodePayloadBase64Xor } from 'myio-js-library';

const result = decodePayloadBase64Xor('SGVsbG8=', 73);
```

### HTTP Functions

#### `fetchWithRetry(url: string, options?: object): Promise<Response>`

Enhanced fetch wrapper with retry logic, timeout, and exponential backoff.

**Options:**
- `retries?: number` - Number of retry attempts (default: 0)
- `retryDelay?: number` - Base delay between retries in ms (default: 100)
- `timeout?: number` - Request timeout in ms (default: 10000)
- `retryCondition?: (error, response) => boolean` - Custom retry logic
- All standard `fetch` options (method, headers, body, signal, etc.)

```javascript
import { fetchWithRetry } from 'myio-js-library';

const response = await fetchWithRetry('https://api.example.com/data', {
  retries: 3,
  retryDelay: 200,
  timeout: 5000,
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: 'example' })
});
```

#### `http(url: string, options?: object): Promise<Response>`

Alias for `fetchWithRetry`.

### Namespace Utilities

#### `addNamespace(payload: object, namespace?: string): object`

Adds a namespace suffix to all keys in an object. Useful for prefixing data from different sources or sensors.

**Parameters:**
- `payload: object` - The object whose keys will be namespaced (must be a plain object, not array)
- `namespace?: string` - The namespace to append (optional, defaults to empty string)

**Returns:** New object with namespaced keys in format `"originalKey (namespace)"`

**Throws:** Error if payload is not a plain object

```javascript
import { addNamespace } from 'myio-js-library';

// Basic usage
const data = { temperature: 25, humidity: 60 };
const result = addNamespace(data, 'sensor1');
// { "temperature (sensor1)": 25, "humidity (sensor1)": 60 }

// Empty namespace (no suffix added)
const result2 = addNamespace(data, '');
// { "temperature": 25, "humidity": 60 }

// Whitespace handling
const result3 = addNamespace(data, '  room-101  ');
// { "temperature (room-101)": 25, "humidity (room-101)": 60 }
```

### Device Detection Utilities

#### `detectDeviceType(context: string, deviceId: string): string`

Detects device type based on context and device ID patterns. Uses built-in detection contexts for common environments.

**Parameters:**
- `context: string` - The context environment ('building', 'mall', etc.)
- `deviceId: string` - The device identifier to analyze

**Returns:** Detected device type or 'unknown' if no pattern matches

**Built-in contexts:**
- **building**: Detects rooms, floors, elevators, stairs, parking, entrance, exit
- **mall**: Detects stores, corridors, escalators, elevators, parking, entrance, exit, food court, restrooms

```javascript
import { detectDeviceType } from 'myio-js-library';

// Building context
detectDeviceType('building', 'floor2-room101'); // "room"
detectDeviceType('building', 'elevator-A'); // "elevator"
detectDeviceType('building', 'parking-level1'); // "parking"

// Mall context  
detectDeviceType('mall', 'store-nike-001'); // "store"
detectDeviceType('mall', 'corridor-main'); // "corridor"
detectDeviceType('mall', 'food-court-area'); // "food_court"

// Unknown patterns
detectDeviceType('building', 'unknown-device'); // "unknown"
```

#### `getAvailableContexts(): string[]`

Returns list of all available detection contexts.

```javascript
import { getAvailableContexts } from 'myio-js-library';

const contexts = getAvailableContexts();
// ['building', 'mall']
```

#### `addDetectionContext(contextName: string, patterns: object): void`

Adds a new detection context with custom patterns.

**Parameters:**
- `contextName: string` - Name of the new context
- `patterns: object` - Object mapping device types to regex patterns

```javascript
import { addDetectionContext, detectDeviceType } from 'myio-js-library';

// Add custom hospital context
addDetectionContext('hospital', {
  room: /^(room|ward|chamber)-/i,
  operating_room: /^(or|surgery|operating)-/i,
  emergency: /^(er|emergency|trauma)-/i
});

// Use the new context
detectDeviceType('hospital', 'room-icu-101'); // "room"
detectDeviceType('hospital', 'or-surgery-3'); // "operating_room"
```

### String Utilities

#### `strings.normalizeRecipients(val: unknown): string`

Normalizes various list formats into a comma-separated string.

**Supported inputs:**
- Arrays: `['a', 'b', 'c']` → `"a,b,c"`
- JSON strings: `'["a", "b", "c"]'` → `"a,b,c"`
- Delimited strings: `"a; b, c"` → `"a,b,c"`

```javascript
import { strings } from 'myio-js-library';

strings.normalizeRecipients(['user1', 'user2']); // "user1,user2"
strings.normalizeRecipients('["a", "b"]'); // "a,b"
strings.normalizeRecipients('a; b, c'); // "a,b,c"
```

### Number Utilities

#### `formatNumberReadable(value: unknown, locale?: string, minimumFractionDigits?: number, maximumFractionDigits?: number): string`

Formats numbers for Brazilian locale with robust input handling. Safely handles strings, numbers, and other types with sensible defaults.

**Parameters:**
- `value: unknown` - Value to format (number, string, or any other type)
- `locale?: string` - Locale string (default: 'pt-BR')
- `minimumFractionDigits?: number` - Minimum decimal places (default: 2)
- `maximumFractionDigits?: number` - Maximum decimal places (default: 2)

**Features:**
- Handles string inputs with comma decimal separators (e.g., "12,34" → 12.34)
- Normalizes -0 to 0
- Returns "-" for null, undefined, NaN, or invalid inputs
- Configurable locale and decimal places

```javascript
import { formatNumberReadable } from 'myio-js-library';

// Basic usage
formatNumberReadable(1234.56); // "1.234,56"
formatNumberReadable(1000); // "1.000,00"
formatNumberReadable(12.3); // "12,30"

// String inputs (handles comma separators)
formatNumberReadable("1234,56"); // "1.234,56"
formatNumberReadable("12.34"); // "12,34"

// Invalid inputs
formatNumberReadable(null); // "-"
formatNumberReadable(NaN); // "-"
formatNumberReadable("invalid"); // "-"

// Custom locale and precision
formatNumberReadable(1234.56, 'en-US'); // "1,234.56"
formatNumberReadable(1234.56, 'pt-BR', 0, 0); // "1.235"
formatNumberReadable(1234.56, 'pt-BR', 1, 3); // "1.234,560"
```

#### `numbers.fmtPerc(x: number, digits?: number): string`

Formats a ratio (0-1) as a percentage string.

```javascript
import { numbers } from 'myio-js-library';

numbers.fmtPerc(0.1234); // "12.34%"
numbers.fmtPerc(0.1234, 1); // "12.3%"
numbers.fmtPerc(NaN); // "—"
```

#### `numbers.toFixedSafe(x: number, digits?: number): string`

Safely formats a number to fixed decimals (returns "—" for invalid numbers).

```javascript
import { numbers } from 'myio-js-library';

numbers.toFixedSafe(3.14159, 2); // "3.14"
numbers.toFixedSafe(NaN); // "—"
numbers.toFixedSafe(Infinity); // "—"
```

### Energy Formatting Utilities

#### `formatEnergy(value: number, unit?: string): string`

Formats energy values with Brazilian locale formatting and appropriate units. If no unit is provided, automatically selects the most appropriate unit based on the value magnitude.

**Parameters:**
- `value: number` - The energy value to format
- `unit?: string` - Optional unit ('kWh', 'MWh', 'GWh'). If not provided, automatically determined based on value

**Auto-unit selection:**
- Values ≥ 1,000,000: Converts to GWh
- Values ≥ 1,000: Converts to MWh  
- Values < 1,000: Uses kWh

```javascript
import { formatEnergy } from 'myio-js-library';

// With explicit unit
formatEnergy(1234.56, 'kWh'); // "1.234,56 kWh"
formatEnergy(1000, 'MWh'); // "1.000,00 MWh"

// Auto-unit selection
formatEnergy(500); // "500,00 kWh"
formatEnergy(1500); // "1,50 MWh"
formatEnergy(2500000); // "2,50 GWh"

// Invalid values
formatEnergy(null); // "-"
formatEnergy(NaN); // "-"
```

#### `formatAllInSameUnit(values: Array<{value: number, unit: string}>, targetUnit: string): string[]`

Converts and formats multiple energy values to the same unit.

```javascript
import { formatAllInSameUnit } from 'myio-js-library';

const values = [
  { value: 1, unit: 'kWh' },
  { value: 1, unit: 'MWh' },
  { value: 1, unit: 'GWh' }
];

formatAllInSameUnit(values, 'kWh');
// ['1,00 kWh', '1.000,00 kWh', '1.000.000,00 kWh']
```

#### `fmtPerc(value: number): string`

Formats percentage values with Brazilian locale formatting.

**Note:** This function uses Brazilian locale formatting (comma as decimal separator). This is a change from the original behavior which used dot notation. For values less than 0.1%, it returns the formatted percentage rather than "<0,1".

```javascript
import { fmtPerc } from 'myio-js-library';

fmtPerc(0.1234); // "12,34%"
fmtPerc(0.5); // "50,00%"
fmtPerc(0.001); // "0,10%"
fmtPerc(null); // "-"
fmtPerc(NaN); // "-"
```

### Date Utilities

#### `formatDateToYMD(date: Date | number | string): string`

Formats dates to YYYY-MM-DD format.

```javascript
import { formatDateToYMD } from 'myio-js-library';

formatDateToYMD(new Date('2023-12-25')); // "2023-12-25"
formatDateToYMD('2023-01-15T12:00:00Z'); // "2023-01-15"
formatDateToYMD('invalid'); // ""
```

#### `determineInterval(startDate: Date | string | number, endDate: Date | string | number): string`

Determines appropriate time interval based on date range.

```javascript
import { determineInterval } from 'myio-js-library';

const start = new Date('2023-01-01');
const end = new Date('2023-01-05');
determineInterval(start, end); // "day"

const longRange = new Date('2023-06-01');
determineInterval(start, longRange); // "month"
```

#### `getSaoPauloISOString(date: Date | string | number, edge?: 'start' | 'end'): string`

Gets ISO string for date at day edge in São Paulo timezone.

```javascript
import { getSaoPauloISOString } from 'myio-js-library';

const date = new Date('2023-01-01T12:00:00Z');
getSaoPauloISOString(date, 'start'); // ISO string for start of day in SP timezone
getSaoPauloISOString(date, 'end'); // ISO string for end of day in SP timezone
```

#### `getDateRangeArray(startDate: Date | string | number, endDate: Date | string | number, interval?: 'day' | 'week' | 'month' | 'year'): Date[]`

Generates array of dates within specified range.

```javascript
import { getDateRangeArray } from 'myio-js-library';

const start = new Date('2023-01-01');
const end = new Date('2023-01-03');
const dates = getDateRangeArray(start, end, 'day');
// [Date('2023-01-01'), Date('2023-01-02'), Date('2023-01-03')]
```

### CSV Export Utilities

#### `exportToCSV(data: Record<string, any>[], headers: string[], filename?: string): string`

Exports data to CSV format with proper escaping.

```javascript
import { exportToCSV } from 'myio-js-library';

const data = [
  { name: 'John', age: 30, city: 'New York' },
  { name: 'Jane', age: 25, city: 'Los Angeles' }
];
const headers = ['name', 'age', 'city'];

const csv = exportToCSV(data, headers);
// "name,age,city\nJohn,30,New York\nJane,25,Los Angeles"
```

#### `exportToCSVAll(storesData: Record<string, Record<string, any>[]>, headers: string[], filename?: string): string`

Exports data for multiple stores/entities to CSV format.

```javascript
import { exportToCSVAll } from 'myio-js-library';

const storesData = {
  'Store A': [
    { product: 'Apple', price: 1.50 },
    { product: 'Banana', price: 0.75 }
  ],
  'Store B': [
    { product: 'Orange', price: 2.00 }
  ]
};
const headers = ['product', 'price'];

const csv = exportToCSVAll(storesData, headers);
// "Store,product,price\nStore A,Apple,1.5\nStore A,Banana,0.75\nStore B,Orange,2"
```

### Classification Utilities

#### `classify(entity: Record<string, any>, criteria: Record<string, any>): {category: string, subcategory?: string, confidence: number}`

Classifies energy entities based on their characteristics.

```javascript
import { classify } from 'myio-js-library';

const entity = { type: 'consumption', powerRating: 5000 };
const criteria = {};

const result = classify(entity, criteria);
// { category: 'energy_consumption', subcategory: 'medium_scale', confidence: 1.0 }
```

### Water-Specific Utilities

#### Water Formatting Functions

##### `formatWaterVolumeM3(value: number, locale?: string): string`

Formats water volume in cubic meters (M³) using Brazilian locale formatting.

```javascript
import { formatWaterVolumeM3 } from 'myio-js-library';

formatWaterVolumeM3(12.345); // "12,35 M³"
formatWaterVolumeM3(1000.5); // "1.000,50 M³"
formatWaterVolumeM3(12.345, 'en-US'); // "12.35 M³"
formatWaterVolumeM3(null); // "-"
```

##### `formatTankHeadFromCm(valueCm: number, locale?: string): string`

Formats tank head from centimeters to meters of water column (m.c.a.).

```javascript
import { formatTankHeadFromCm } from 'myio-js-library';

formatTankHeadFromCm(178); // "1,78 m.c.a."
formatTankHeadFromCm(250); // "2,50 m.c.a."
formatTankHeadFromCm(null); // "-"
```

##### `calcDeltaPercent(prev: number, current: number): {value: number, type: string}`

Calculates percentage difference between two values and determines the type of change.

```javascript
import { calcDeltaPercent } from 'myio-js-library';

calcDeltaPercent(100, 120); // { value: 20, type: "increase" }
calcDeltaPercent(120, 100); // { value: 16.67, type: "decrease" }
calcDeltaPercent(100, 100); // { value: 0, type: "neutral" }
calcDeltaPercent(0, 100); // { value: 100, type: "increase" }
```

##### `formatEnergyByGroup(value: number, group: string): string`

Formats energy/water values based on group type (from MAIN_WATER controller).

```javascript
import { formatEnergyByGroup } from 'myio-js-library';

formatEnergyByGroup(178, "Caixas D'Água"); // "1,78 m.c.a."
formatEnergyByGroup(12.345, "Lojas"); // "12,35 M³"
formatEnergyByGroup(1000000, "Lojas"); // "1,00 M³ (GWh scale)"
```

#### Water Date Utilities

##### `formatDateForInput(date: Date): string`

Formats a Date object into a 'YYYY-MM-DD' string for HTML input fields.

```javascript
import { formatDateForInput } from 'myio-js-library';

formatDateForInput(new Date(2025, 7, 26)); // "2025-08-26"
formatDateForInput(new Date('invalid')); // ""
```

##### `parseInputDateToDate(inputDateStr: string): Date | null`

Parses a 'YYYY-MM-DD' string into a Date object at midnight local time.

```javascript
import { parseInputDateToDate } from 'myio-js-library';

parseInputDateToDate('2025-08-26'); // Date object at 2025-08-26 00:00:00
parseInputDateToDate('invalid'); // null
```

##### `timeWindowFromInputYMD(startYmd: string, endYmd: string, tzOffset?: string): {startTs: number, endTs: number}`

Creates a time window from two input date strings with timezone offset.

```javascript
import { timeWindowFromInputYMD } from 'myio-js-library';

timeWindowFromInputYMD('2025-08-01', '2025-08-26', '-03:00');
// { startTs: 1722470400000, endTs: 1724630399999 }
```

##### `getSaoPauloISOStringFixed(dateStr: string, endOfDay?: boolean): string`

Gets São Paulo ISO string with fixed offset.

```javascript
import { getSaoPauloISOStringFixed } from 'myio-js-library';

getSaoPauloISOStringFixed('2025-08-26'); // "2025-08-26T00:00:00.000-03:00"
getSaoPauloISOStringFixed('2025-08-26', true); // "2025-08-26T23:59:59.999-03:00"
```

##### `averageByDay(data: TimedValue[]): Array<{day: string, average: number}>`

Calculates the average value per day from time-series data.

```javascript
import { averageByDay } from 'myio-js-library';

const data = [
  { ts: new Date('2025-08-26T10:00:00'), value: 100 },
  { ts: new Date('2025-08-26T14:00:00'), value: 200 },
  { ts: new Date('2025-08-27T10:00:00'), value: 150 }
];

averageByDay(data);
// [
//   { day: '2025-08-26', average: 150 },
//   { day: '2025-08-27', average: 150 }
// ]
```

#### Water CSV Utilities

##### `buildWaterReportCSV(rows: WaterRow[], meta: object): string`

Builds a CSV string for water consumption reports.

```javascript
import { buildWaterReportCSV } from 'myio-js-library';

const rows = [
  {
    formattedDate: '26/08/2025',
    day: 'Segunda-feira',
    avgConsumption: '12,50',
    minDemand: '10,00',
    maxDemand: '15,00',
    totalConsumption: '300,00'
  }
];

const meta = {
  issueDate: '26/08/2025 - 23:19',
  name: 'Loja A',
  identifier: 'SCP001'
};

buildWaterReportCSV(rows, meta);
// "DATA EMISSÃO;26/08/2025 - 23:19\nTotal;300.00\nLoja:;Loja A;SCP001\n..."
```

##### `buildWaterStoresCSV(rows: StoreRow[], meta: object): string`

Builds a CSV string for all stores water consumption report.

```javascript
import { buildWaterStoresCSV } from 'myio-js-library';

const rows = [
  {
    entityLabel: 'Loja A',
    deviceId: 'DEV001',
    consumptionM3: 150.5
  }
];

const meta = {
  issueDate: '26/08/2025 - 23:19'
};

buildWaterStoresCSV(rows, meta);
// "DATA EMISSÃO;26/08/2025 - 23:19\nTotal;150.50\nLoja;Identificador;Consumo\n..."
```

##### `toCSV(rows: (string|number)[][], delimiter?: string): string`

Basic CSV generation function that converts 2D array to CSV string.

```javascript
import { toCSV } from 'myio-js-library';

const rows = [
  ['Header1', 'Header2'],
  ['Value1', 'Value2'],
  ['Value3', 'Value4']
];

toCSV(rows); // "Header1;Header2\nValue1;Value2\nValue3;Value4"
toCSV(rows, ','); // "Header1,Header2\nValue1,Value2\nValue3,Value4"
```

#### Water Classification Utilities

##### `classifyWaterLabel(label: string): string`

Classifies water device labels into predefined categories.

```javascript
import { classifyWaterLabel } from 'myio-js-library';

classifyWaterLabel('Caixa Superior'); // "Caixas D'Água"
classifyWaterLabel('Administração'); // "Área Comum"
classifyWaterLabel('Loja 101'); // "Lojas"
classifyWaterLabel(''); // "Lojas" (default)
```

##### `classifyWaterLabels(labels: string[]): object`

Classifies multiple labels and returns a summary.

```javascript
import { classifyWaterLabels } from 'myio-js-library';

const labels = ['Caixa Superior', 'Loja 101', 'Administração'];
classifyWaterLabels(labels);
// {
//   "Caixas D'Água": 1,
//   "Lojas": 1,
//   "Área Comum": 1,
//   total: 3
// }
```

##### `getWaterCategories(): string[]`

Gets all possible water classification categories.

```javascript
import { getWaterCategories } from 'myio-js-library';

getWaterCategories(); // ["Caixas D'Água", "Lojas", "Área Comum"]
```

##### `isWaterCategory(label: string, category: string): boolean`

Checks if a label belongs to a specific category.

```javascript
import { isWaterCategory } from 'myio-js-library';

isWaterCategory('Caixa Superior', "Caixas D'Água"); // true
isWaterCategory('Loja 101', "Caixas D'Água"); // false
```

### Data Access Utilities

#### `getValueByDatakey(data: any, datakey: string): any`

Retrieves values from nested objects using datakey paths with dot notation and array indices.

```javascript
import { getValueByDatakey } from 'myio-js-library';

const data = {
  sensor: {
    temperature: 25,
    readings: [10, 20, 30]
  }
};

getValueByDatakey(data, 'sensor.temperature'); // 25
getValueByDatakey(data, 'sensor.readings[1]'); // 20
getValueByDatakey(data, 'nonexistent.path'); // undefined
```

#### `getValueByDatakeyLegacy(dataList: any[], dataSourceNameTarget: string, dataKeyTarget: string): any`

Legacy compatibility function for ThingsBoard widgets. Searches for values in data lists by matching dataSourceName and dataKey properties.

```javascript
import { getValueByDatakeyLegacy } from 'myio-js-library';

const dataList = [
  { dataSourceName: 'sensor1', dataKey: 'temperature', value: 25 },
  { dataSourceName: 'sensor1', dataKey: 'humidity', value: 60 },
  { dataSourceName: 'sensor2', dataKey: 'temperature', value: 22 }
];

getValueByDatakeyLegacy(dataList, 'sensor1', 'temperature'); // 25
getValueByDatakeyLegacy(dataList, 'sensor2', 'humidity'); // undefined
```

#### `findValue(data: any, keyOrPath: string, legacyDataKey?: string): any`

Unified function that supports both modern path-based access and legacy ThingsBoard-style data access.

```javascript
import { findValue } from 'myio-js-library';

// Modern usage (path-based)
const modernData = { sensor: { temperature: 25 } };
findValue(modernData, 'sensor.temperature'); // 25

// Legacy usage (ThingsBoard-style)
const legacyData = [
  { dataSourceName: 'sensor1', dataKey: 'temperature', value: 25 }
];
findValue(legacyData, 'sensor1', 'temperature'); // 25
```

### ThingsBoard Utilities

#### `getEntityInfoAndAttributesTB(deviceId: string, opts: TBFetchOptions): Promise<TBEntityInfo>`

Fetches a ThingsBoard device and its `SERVER_SCOPE` attributes with one call. Provides robust parsing and sensible defaults for direct UI use.

**Parameters:**
- `deviceId: string` - The ThingsBoard device ID
- `opts: TBFetchOptions` - Configuration options:
  - `jwt: string` - Bearer token for authentication (required)
  - `baseUrl?: string` - ThingsBoard base URL (default: '', supports relative or absolute URLs)
  - `scope?: string` - Attribute scope (default: 'SERVER_SCOPE')
  - `attributeKeys?: string[]` - Specific attribute keys to fetch (optional)
  - `fetcher?: typeof fetch` - Custom fetch implementation (default: globalThis.fetch)

**Returns:** Promise resolving to `TBEntityInfo` object with:
- `label: string` - Device label (fallback to name or 'Sem etiqueta')
- `andar: string` - Floor information from 'floor' attribute
- `numeroLoja: string` - Store number from 'NumLoja' attribute
- `identificadorMedidor: string` - Meter ID from 'IDMedidor' attribute
- `identificadorDispositivo: string` - Device ID from 'deviceId' attribute
- `guid: string` - GUID from 'guid' attribute
- `consumoDiario: number` - Daily consumption from 'maxDailyConsumption' attribute
- `consumoMadrugada: number` - Night consumption from 'maxNightConsumption' attribute

**UMD Usage (ThingsBoard widgets):**
```html
<script src="https://unpkg.com/myio-js-library@0.1.4/dist/myio-js-library.umd.min.js"></script>
<script>
  (async () => {
    const { getEntityInfoAndAttributesTB } = MyIOLibrary;
    const jwt = localStorage.getItem('jwt_token'); // or your JWT source
    const deviceId = 'YOUR_DEVICE_ID';

    try {
      const info = await getEntityInfoAndAttributesTB(deviceId, { jwt });
      console.log('TB entity info:', info);
      // {
      //   label: 'My Device',
      //   andar: '1',
      //   numeroLoja: 'A-12',
      //   identificadorMedidor: 'ID-123',
      //   identificadorDispositivo: 'DEV-456',
      //   guid: '...',
      //   consumoDiario: 10.5,
      //   consumoMadrugada: 1.2
      // }
    } catch (error) {
      console.error('Failed to fetch device info:', error);
    }
  })();
</script>
```

**ESM Usage:**
```javascript
import { getEntityInfoAndAttributesTB } from 'myio-js-library';

const info = await getEntityInfoAndAttributesTB('DEVICE_ID', {
  jwt: process.env.TB_JWT!,
  baseUrl: 'https://thingsboard.example.com'
});
```

**Error Handling:**
The function throws meaningful errors for:
- Missing `deviceId` parameter
- Missing `jwt` token
- HTTP failures (device not found, authentication issues, etc.)
- Missing fetch implementation

**Robust Parsing:**
- Numbers are safely coerced from strings (handles comma decimal separators)
- Invalid numbers default to 0
- Missing string attributes default to empty string
- Handles null/undefined values gracefully

#### `renderCardComponent(options: RenderCardOptions): jQuery`

Generates interactive device cards for ThingsBoard dashboard interfaces. Creates dynamic HTML cards with flip animations, action buttons, and real-time status indicators for IoT devices.

**Parameters:**
- `options: RenderCardOptions` - Configuration object with the following properties:
  - `entityObject: EntityObject` - Device/entity data and metadata (required)
  - `handleActionDashboard?: Function` - Callback for dashboard action button
  - `handleActionReport?: Function` - Callback for report action button  
  - `handleActionSettings?: Function` - Callback for settings action button
  - `handleSelect?: Function` - Callback for selection checkbox
  - `handInfo?: boolean` - Flag to show/hide info button
  - `handleClickCard?: Function` - Callback for card click events

**Entity Object Structure:**
```javascript
{
  entityId: string,           // Unique identifier for the entity
  labelOrName: string,        // Display name for the device
  entityType: string,         // Type classification of the entity
  deviceType: string,         // Specific device type (MOTOR, HIDROMETRO, etc.)
  slaveId: string,           // Slave device identifier
  ingestionId: string,       // Data ingestion identifier
  val: number,               // Current consumption/measurement value
  centralId: string,         // Central system identifier
  updatedIdentifiers: Object, // Updated identification data (default: {})
  isOn: boolean,             // Device operational status (default: false)
  perc: number,              // Percentage value (default: 0)
  group: string,             // Device grouping classification
  connectionStatus: string,   // Connection status ("online"/"offline")
  centralName: string,       // Name of the central system
  connectionStatusTime: string, // Timestamp of last connection
  timaVal: string,           // Timestamp of last telemetry value
  valType: string,           // Value type ("ENERGY", "WATER", "TANK")
}
```

**Returns:** jQuery object representing the complete device card DOM element with all event handlers attached.

**Key Features:**
- **Flip Card Animation**: 3D CSS transforms for front/back card views
- **Dynamic Value Formatting**: Handles different value types (ENERGY, WATER, TANK) with appropriate units
- **Status Indicators**: Visual feedback for connection status and data freshness
- **Device Image Mapping**: Maps device types to specific images with fallback support
- **Event Management**: Comprehensive event handling with proper propagation control
- **MyIO Library Integration**: Includes fallback mechanism for formatting functions

**Usage Example:**
```javascript
import { renderCardComponent } from 'myio-js-library';

const deviceCard = renderCardComponent({
  entityObject: {
    entityId: "device-001",
    labelOrName: "Motor Principal",
    deviceType: "MOTOR",
    val: 1250.5,
    valType: "ENERGY",
    connectionStatus: "online",
    // ... other properties
  },
  handleActionDashboard: (entity) => {
    console.log('Dashboard clicked for:', entity.labelOrName);
  },
  handleActionReport: (entity) => {
    console.log('Report clicked for:', entity.labelOrName);
  },
  handInfo: true,
});

// Append to container
$('#device-container').append(deviceCard);
```

**UMD Usage (ThingsBoard widgets):**
```html
<script src="https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"></script>
<script>
  const { renderCardComponent } = MyIOLibrary;
  
  const card = renderCardComponent({
    entityObject: {
      entityId: "device-001",
      labelOrName: "Hidrometro Loja A",
      deviceType: "HIDROMETRO",
      val: 125.5,
      valType: "WATER",
      connectionStatus: "online"
    },
    handleActionDashboard: (entity) => {
      // Navigate to device dashboard
      window.location.href = `/dashboard/${entity.entityId}`;
    }
  });
  
  $('#cards-container').append(card);
</script>
```

**Visual States:**
- **Connection Status**: Online (green indicators), Offline (red border, blinking animation)
- **Data Freshness**: Recent (<30min: green), Moderate (30min-24h: orange), Stale (>24h: red)
- **Animation Effects**: Hover scale, flip rotation, flash indicators, border blink

**Dependencies:**
- **jQuery**: Required for DOM manipulation and event handling
- **MyIO Library**: Optional, with built-in fallbacks for formatting functions
- **Modern Browser**: CSS3 transforms and animations support

For complete technical documentation, see: [renderCardComponent Technical Documentation](src/thingsboard/main-dashboard-shopping/v-4.0.0/card/renderCardComponent-documentation.md)

## 🧪 Development

```bash
# install dependencies
npm install

# run tests
npm test

# build (esm+cjs+umd+min)
npm run build
```

## 🔄 Versioning

Uses [SemVer](https://semver.org/).

Managed via [Changesets](https://github.com/changesets/changesets) for changelogs & automated npm publishing.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📜 License

MIT © 2025 MYIO
