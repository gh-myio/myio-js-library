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
- 🔌 **Device status** — comprehensive status calculation and management with `calculateDeviceStatus`.
- 🎯 **Goals Panel** — consumption goals setup with annual/monthly targets, versioning, and ThingsBoard integration.
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
  getValueByDatakey,
  calculateDeviceStatus,
  DeviceStatusType,
  openGoalsPanel
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

// Calculate device status
const status = calculateDeviceStatus({
  connectionStatus: "online",
  lastConsumptionValue: 500,
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});
console.log(status); // "power_on"

// Open goals panel for consumption management
const panel = openGoalsPanel({
  customerId: 'customer-uuid',
  token: 'jwt-token',
  shoppingList: [
    { value: 'shop-1', name: 'Shopping Centro' }
  ],
  onSave: (data) => console.log('Goals saved:', data)
});
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

##### `formatWaterByGroup(value: number, group: string): string`

Formats water group totals in m³. For values ≥ 1000, it returns the value in thousands of m³ with a simplified `x 10³` suffix.

**Examples**
```javascript
import { formatWaterByGroup } from 'myio-js-library';

formatWaterByGroup(178, "Caixas D'Água"); // "1,78 m.c.a."
formatWaterByGroup(750, "Lojas");    // "750,00 M³"
formatWaterByGroup(2500, "Lojas");   // "2,50 M³ x 10³ "
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

### Device Status Utilities

The library provides comprehensive device status management utilities for IoT applications, enabling centralized status calculation, validation, and visual mapping.

#### `calculateDeviceStatus(params: object): string`

Calculates device operational status based on connection state and power consumption metrics. This is the primary function for determining device status across MYIO applications.

**Parameters:**
- `connectionStatus: "waiting" | "offline" | "online"` - Device connection state (required)
- `lastConsumptionValue: number | null` - Power consumption in watts (required)
- `limitOfPowerOnStandByWatts: number` - Upper threshold for standby mode in watts (required)
- `limitOfPowerOnAlertWatts: number` - Upper threshold for normal operation (power_on) in watts (required)
- `limitOfPowerOnFailureWatts: number` - Upper threshold for warning mode in watts (required)

**Returns:** Device status string from `DeviceStatusType` enum:
- `"not_installed"` - Device waiting for installation
- `"no_info"` - Device offline, no information available
- `"power_on"` - Device in normal operation
- `"standby"` - Low power consumption mode (0 to standby limit)
- `"warning"` - Elevated consumption (alert limit to failure limit)
- `"failure"` - Critical consumption (above failure limit)
- `"maintenance"` - Invalid state requiring attention

**Decision Logic:**
```
waiting → NOT_INSTALLED
offline → NO_INFO
online + no data → POWER_ON
online + (0 ≤ consumption ≤ standbyLimit) → STANDBY
online + (standbyLimit < consumption ≤ alertLimit) → POWER_ON
online + (alertLimit < consumption ≤ failureLimit) → WARNING
online + (consumption > failureLimit) → FAILURE
invalid → MAINTENANCE
```

**Usage Example:**
```javascript
import { calculateDeviceStatus, DeviceStatusType } from 'myio-js-library';

// Air Conditioner - Normal operation
const acStatus = calculateDeviceStatus({
  connectionStatus: "online",
  lastConsumptionValue: 2500,        // 2.5 kW
  limitOfPowerOnStandByWatts: 500,   // 500W standby
  limitOfPowerOnAlertWatts: 3000,    // 3kW alert
  limitOfPowerOnFailureWatts: 5000   // 5kW failure
});
console.log(acStatus); // "power_on"

// Elevator - Standby
const elevatorStatus = calculateDeviceStatus({
  connectionStatus: "online",
  lastConsumptionValue: 80,          // 80W
  limitOfPowerOnStandByWatts: 150,
  limitOfPowerOnAlertWatts: 800,
  limitOfPowerOnFailureWatts: 1200
});
console.log(elevatorStatus); // "standby"

// Offline device
const offlineStatus = calculateDeviceStatus({
  connectionStatus: "offline",
  lastConsumptionValue: null,
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});
console.log(offlineStatus); // "no_info"
```

**Interactive Demo:**
See [demos/calculate-device-status.html](demos/calculate-device-status.html) for an interactive demonstration with multiple scenarios.

**Complete Documentation:**
See [docs/calculateDeviceStatus.md](docs/calculateDeviceStatus.md) for comprehensive documentation with advanced examples.

#### Device Status Constants and Helper Functions

##### `DeviceStatusType` - Status Type Enum

```javascript
import { DeviceStatusType } from 'myio-js-library';

DeviceStatusType.POWER_ON       // "power_on"
DeviceStatusType.STANDBY        // "standby"
DeviceStatusType.POWER_OFF      // "power_off"
DeviceStatusType.WARNING        // "warning"
DeviceStatusType.FAILURE        // "failure"
DeviceStatusType.MAINTENANCE    // "maintenance"
DeviceStatusType.NO_INFO        // "no_info"
DeviceStatusType.NOT_INSTALLED  // "not_installed"
```

##### `deviceStatusIcons` - Icon Mapping

```javascript
import { deviceStatusIcons, getDeviceStatusIcon } from 'myio-js-library';

// Icon map
deviceStatusIcons[DeviceStatusType.POWER_ON]      // "⚡"
deviceStatusIcons[DeviceStatusType.STANDBY]       // "🔌"
deviceStatusIcons[DeviceStatusType.WARNING]       // "⚠️"
deviceStatusIcons[DeviceStatusType.FAILURE]       // "🚨"
deviceStatusIcons[DeviceStatusType.NO_INFO]       // "❓️"
deviceStatusIcons[DeviceStatusType.NOT_INSTALLED] // "📦"

// Helper function
getDeviceStatusIcon("warning"); // "⚠️"
getDeviceStatusIcon("failure"); // "🚨"
```

##### `getDeviceStatusInfo(deviceStatus: string): object`

Gets comprehensive status information including derived properties.

```javascript
import { getDeviceStatusInfo } from 'myio-js-library';

const info = getDeviceStatusInfo("warning");
console.log(info);
// {
//   deviceStatus: "warning",
//   connectionStatus: "connected",
//   cardStatus: "alert",
//   deviceIcon: "⚠️",
//   connectionIcon: "🟢",
//   shouldFlash: true,
//   isOffline: false,
//   isValid: true
// }
```

##### Status Mapping Functions

```javascript
import {
  mapDeviceStatusToCardStatus,
  mapDeviceToConnectionStatus,
  shouldFlashIcon,
  isDeviceOffline
} from 'myio-js-library';

// Map to simplified card status
mapDeviceStatusToCardStatus("warning");  // "alert"
mapDeviceStatusToCardStatus("power_on"); // "ok"
mapDeviceStatusToCardStatus("failure");  // "fail"

// Map to connection status
mapDeviceToConnectionStatus("no_info");   // "offline"
mapDeviceToConnectionStatus("power_on");  // "connected"

// Visual indicators
shouldFlashIcon("failure");   // true (requires attention)
shouldFlashIcon("warning");   // true (requires attention)
shouldFlashIcon("power_on");  // false (normal operation)

isDeviceOffline("no_info");   // true
isDeviceOffline("standby");   // false
```

##### Validation Functions

```javascript
import {
  isValidDeviceStatus,
  isValidConnectionStatus
} from 'myio-js-library';

isValidDeviceStatus("warning");      // true
isValidDeviceStatus("invalid");      // false

isValidConnectionStatus("connected"); // true
isValidConnectionStatus("unknown");   // false
```

**Complete Integration Example:**
```javascript
import {
  calculateDeviceStatus,
  getDeviceStatusInfo,
  DeviceStatusType
} from 'myio-js-library';

// Calculate status from device data
const deviceStatus = calculateDeviceStatus({
  connectionStatus: device.isOnline ? "online" : "offline",
  lastConsumptionValue: device.powerWatts,
  limitOfPowerOnStandByWatts: 100,
  limitOfPowerOnAlertWatts: 1000,
  limitOfPowerOnFailureWatts: 2000
});

// Get complete status information
const statusInfo = getDeviceStatusInfo(deviceStatus);

// Update UI
if (statusInfo.shouldFlash) {
  element.classList.add('flash-animation');
}

element.innerHTML = `
  <span class="status-icon">${statusInfo.deviceIcon}</span>
  <span class="status-text">${statusInfo.deviceStatus}</span>
  <span class="connection-icon">${statusInfo.connectionIcon}</span>
`;

// Handle critical states
if (deviceStatus === DeviceStatusType.FAILURE) {
  sendAlert(`Device ${device.id} in critical state!`);
}
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

### DateRangePicker Component

#### `createDateRangePicker(input: HTMLInputElement, options?: CreateDateRangePickerOptions): Promise<DateRangeControl>`

Creates a MyIO-styled date range picker with Portuguese localization and timezone-aware output. This component provides a clean, user-friendly interface for selecting date ranges with built-in validation and formatting.

**Parameters:**
- `input: HTMLInputElement` - The input element to attach the date range picker to (required)
- `options?: CreateDateRangePickerOptions` - Configuration options:
  - `presetStart?: string` - Preset start date (ISO string or YYYY-MM-DD)
  - `presetEnd?: string` - Preset end date (ISO string or YYYY-MM-DD)
  - `maxRangeDays?: number` - Maximum range in days (default: 31)
  - `parentEl?: HTMLElement` - Parent element for modal positioning
  - `onApply?: (result: DateRangeResult) => void` - Callback when date range is applied

**Returns:** Promise resolving to `DateRangeControl` object with:
- `getDates(): DateRangeResult` - Get current selected dates
- `setDates(startISO: string, endISO: string): void` - Set date range programmatically
- `destroy(): void` - Clean up and remove the picker

**DateRangeResult Structure:**
```javascript
{
  startISO: string,    // "YYYY-MM-DDTHH:mm:ss-03:00" (São Paulo timezone)
  endISO: string,      // "YYYY-MM-DDTHH:mm:ss-03:00" (São Paulo timezone)
  startLabel: string,  // "DD/MM/YY HH:mm" (display format)
  endLabel: string     // "DD/MM/YY HH:mm" (display format)
}
```

**Key Features:**
- **Portuguese Localization**: All labels, buttons, and formats in Brazilian Portuguese
- **Timezone Aware**: Outputs São Paulo timezone (-03:00) ISO strings
- **Time Selection**: 24-hour format time picker with minute precision
- **Preset Ranges**: Built-in ranges (Hoje, Últimos 7 dias, Últimos 30 dias, Mês Anterior)
- **Range Validation**: Configurable maximum range enforcement (default: 31 days)
- **Premium Styling**: MyIO brand colors and consistent design
- **No Dependencies**: Self-contained with automatic CDN loading of required libraries
- **Accessibility**: Full keyboard navigation and screen reader support

**Usage Example:**
```javascript
import { createDateRangePicker } from 'myio-js-library';

const input = document.getElementById('date-range');
const picker = await createDateRangePicker(input, {
  maxRangeDays: 31,
  presetStart: '2025-09-01',
  presetEnd: '2025-09-25',
  onApply: (result) => {
    console.log('Date range selected:', result);
    // result.startISO: "2025-09-01T00:00:00-03:00"
    // result.endISO: "2025-09-25T23:59:59-03:00"
    // result.startLabel: "01/09/25 00:00"
    // result.endLabel: "25/09/25 23:59"
  }
});

// Get current selection
const dates = picker.getDates();
console.log('Current range:', dates.startISO, 'to', dates.endISO);

// Set new range programmatically
picker.setDates('2025-10-01T00:00:00-03:00', '2025-10-31T23:59:59-03:00');

// Clean up when done
picker.destroy();
```

**UMD Usage (ThingsBoard widgets):**
```html
<script src="https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"></script>
<script>
  const { createDateRangePicker } = MyIOLibrary;
  
  (async () => {
    const input = document.getElementById('dateRange');
    const picker = await createDateRangePicker(input, {
      maxRangeDays: 31,
      onApply: (result) => {
        // Update your dashboard with the selected date range
        updateDashboard(result.startISO, result.endISO);
      }
    });
    
    // Set default to current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    picker.setDates(
      startOfMonth.toISOString(),
      endOfMonth.toISOString()
    );
  })();
</script>
```

**Preset Ranges:**
- **Hoje**: Current day (00:00 to 23:59)
- **Últimos 7 dias**: Last 7 days including today
- **Últimos 30 dias**: Last 30 days including today
- **Mês Anterior**: Previous month (full month)

**Error Handling:**
The component includes robust error handling:
- Automatic fallback to native date inputs if dependencies fail to load
- Graceful degradation with user-friendly error messages
- Console warnings for debugging in development

**Styling:**
The component includes premium MyIO styling with:
- Purple brand colors (#4A148C)
- Consistent button styling and hover effects
- Responsive design for mobile and desktop
- Portuguese month names and day abbreviations

### Premium Date Range Input Component

#### `createInputDateRangePickerInsideDIV(params: CreateInputDateRangePickerInsideDIVParams): Promise<DateRangeInputController>`

Creates a complete, beautifully styled date range input inside a target DIV container, combining the functionality of `createDateRangePicker` with premium MyIO styling. This component automatically creates the HTML structure, injects styling, and provides a clean API for ThingsBoard widgets and other applications.

**Parameters:**
- `params: CreateInputDateRangePickerInsideDIVParams` - Configuration object:
  - `containerId: string` - The DIV id where the input will be created (required)
  - `inputId: string` - The id to set on the created input (required)
  - `label?: string` - Optional label text (default: "Período de Datas")
  - `placeholder?: string` - Input placeholder (default: "Clique para selecionar período")
  - `pickerOptions?: CreateDateRangePickerOptions` - Pass-through options for createDateRangePicker
  - `classNames?: object` - Custom CSS classes for wrapper, label, input, and helper
  - `injectStyles?: boolean` - Inject premium MyIO styling (default: true)
  - `showHelper?: boolean` - Show helper text with format info (default: true)

**Returns:** Promise resolving to `DateRangeInputController` object with:
- `input: HTMLInputElement` - The created input element
- `container: HTMLElement` - The target container element
- `wrapper: HTMLElement` - The wrapper element created by this component
- `picker: DateRangeControl` - The date range picker instance
- `getDisplayValue(): string` - Get current display value from input
- `getDates(): DateRangeResult` - Get current date range data
- `setDates(startISO: string, endISO: string): void` - Set date range programmatically
- `setHelperText(text: string, type?: 'default' | 'success' | 'error'): void` - Update helper text
- `destroy(): void` - Clean up and remove all created elements

**Key Features:**
- **Automatic HTML Creation**: Creates complete styled input structure inside target DIV
- **Premium MyIO Styling**: Beautiful styling matching demos/energy.html with purple brand colors
- **Container-Based**: Works with any DIV container, perfect for ThingsBoard widgets
- **Accessibility Built-in**: ARIA labels, keyboard navigation, screen reader support
- **Responsive Design**: Mobile-friendly with proper touch targets
- **Error Handling**: Robust validation and graceful error recovery
- **Memory Management**: Proper cleanup with destroy() method

**Usage Example:**
```javascript
import { createInputDateRangePickerInsideDIV } from 'myio-js-library';

const controller = await createInputDateRangePickerInsideDIV({
  containerId: 'date-picker-container',
  inputId: 'energy-date-range',
  label: 'Período de Análise',
  pickerOptions: {
    presetStart: '2025-09-01',
    presetEnd: '2025-09-25',
    onApply: (result) => {
      console.log('Date range selected:', result);
      // result.startISO: "2025-09-01T00:00:00-03:00"
      // result.endISO: "2025-09-25T23:59:59-03:00"
      loadEnergyData(result.startISO, result.endISO);
    }
  }
});

// Get current selection
const dates = controller.getDates();
console.log('Current range:', dates.startISO, 'to', dates.endISO);

// Update helper text
controller.setHelperText('Período válido selecionado', 'success');

// Clean up when done
controller.destroy();
```

**ThingsBoard Widget Integration:**
```html
<script src="https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"></script>
<script>
  const { createInputDateRangePickerInsideDIV } = MyIOLibrary;
  
  // In your widget's onInit function
  self.onInit = async function() {
    try {
      // Create date range picker in existing container
      self.dateRangePicker = await createInputDateRangePickerInsideDIV({
        containerId: 'widget-date-container',
        inputId: 'energy-widget-dates',
        label: 'Período de Datas',
        placeholder: 'Selecione o período de análise',
        pickerOptions: {
          maxRangeDays: 31,
          onApply: (result) => {
            // Update widget state and reload data
            updateWidgetData(result.startISO, result.endISO);
          }
        }
      });
      
      console.log('[ENERGY] Date range picker initialized successfully');
    } catch (error) {
      console.error('[ENERGY] Failed to initialize date picker:', error);
      // Fallback to legacy implementation
      initLegacyDatePicker();
    }
  };

  // Clean up on widget destroy
  self.onDestroy = function() {
    if (self.dateRangePicker) {
      self.dateRangePicker.destroy();
    }
  };
</script>
```

**Premium Styling Features:**
- **MyIO Brand Colors**: Purple theme (#4A148C) with hover effects
- **Responsive Layout**: Adapts to mobile and desktop with proper spacing
- **Accessibility**: High contrast mode support, reduced motion support
- **Visual Feedback**: Hover states, focus indicators, success/error states
- **Typography**: Roboto font family with proper line heights
- **Shadow Effects**: Subtle shadows and smooth transitions

**Migration from Basic Implementation:**
```javascript
// OLD: Manual HTML + basic styling
var $inputStart = $('input[name="startDatetimes"]');
MyIOLibrary.createDateRangePicker($inputStart[0], options);

// NEW: Automatic creation + premium styling
const controller = await MyIOLibrary.createInputDateRangePickerInsideDIV({
  containerId: 'date-container',
  inputId: 'startDatetimes',
  label: 'Período de Datas',
  pickerOptions: options
});
```

### Premium Modal Components

The library includes four premium modal components for ThingsBoard dashboards that provide comprehensive device analytics and reporting capabilities.

#### Token Authentication

Both AllReportModal and DeviceReportModal use a dual-token authentication system to access different API endpoints:

- **`api.tbJwtToken`** - Used for ThingsBoard API endpoints (/) for device management and configuration
- **`api.ingestionToken`** - Used for Data API endpoints (https://data.apps.myio-bas.com) for telemetry data access

**Important**: The tokens are automatically applied based on the target endpoint. You must provide the appropriate token in the API configuration:

```javascript
// Example API configuration with both tokens
const apiConfig = {
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  dataApiBaseUrl: 'https://data.apps.myio-bas.com',
  tbJwtToken: 'jwt-token-for-thingsboard-apis',      // For ThingsBoard endpoints
  ingestionToken: 'ingestion-token-for-data-apis'    // For Data API endpoints
};
```

The modals will automatically select the correct token based on the API endpoint being called:
- Data API calls (data.apps.myio-bas.com) → Uses `ingestionToken`
- ThingsBoard API calls (/) → Uses `tbJwtToken`

#### `openDashboardPopupReport(params: OpenDeviceReportParams): ModalHandle`

Opens a device-specific daily consumption report modal with built-in date range picker, sortable table, and CSV export functionality.

**Parameters:**
- `ingestionId: string` - Data ingestion identifier (required)
- `deviceId?: string` - Optional device ID for additional metadata
- `identifier?: string` - Device identifier/code (e.g., "ENTRADA-001", "CHILLER-A")
- `label?: string` - Human-readable label/name (e.g., "Outback", "Shopping Center Norte")
- `ui?: object` - UI configuration (theme, width)
- `api: object` - API configuration:
  - `clientId?: string` - Client ID for data API
  - `clientSecret?: string` - Client secret for data API
  - `dataApiBaseUrl?: string` - Data API base URL
  - `ingestionToken?: string` - Token for data ingestion access

**Returns:** `ModalHandle` object with:
- `close(): void` - Close the modal
- `on(event: 'close'|'loaded'|'error', handler: Function): void` - Event listeners

**Key Features:**
- **Built-in Date Range Picker**: No need to specify dates in parameters
- **Automatic Data Loading**: Fetches daily consumption data for selected period
- **Sortable Table**: Click column headers to sort by date or consumption
- **CSV Export**: Download report data with proper Brazilian formatting
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Graceful error display and recovery

**Usage Example:**
```javascript
import { openDashboardPopupReport } from 'myio-js-library';

const modal = openDashboardPopupReport({
  ingestionId: 'abc123-ingestion-id',
  deviceId: 'device-uuid',
  identifier: 'ENTRADA-001',
  label: 'Outback Shopping',
  api: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    dataApiBaseUrl: 'https://api.data.apps.myio-bas.com',
    ingestionToken: 'your-ingestion-token'
  }
});

modal.on('loaded', (data) => {
  console.log('Report loaded:', data.count, 'days');
});

modal.on('close', () => {
  console.log('Modal closed');
});
```

#### `openDashboardPopupAllReport(params: OpenAllReportParams): ModalHandle`

Opens a customer-level energy consumption report modal with real-time data from the Customer Totals API. This modal provides comprehensive reporting across all devices for a customer with advanced sorting, filtering, and export capabilities.

**Parameters:**
- `customerId: string` - ThingsBoard customer ID (required)
- `ui?: object` - UI configuration (theme, width)
- `api: object` - API configuration:
  - `clientId?: string` - Client ID for data API authentication
  - `clientSecret?: string` - Client secret for data API authentication
  - `dataApiBaseUrl?: string` - Data API base URL (default: 'https://api.data.apps.myio-bas.com')
- `filters?: object` - Optional filtering configuration:
  - `excludeLabels?: (RegExp | string)[]` - Patterns to exclude devices by label
- `fetcher?: Function` - Optional custom fetcher for testing/mocking

**Returns:** `ModalHandle` object with:
- `close(): void` - Close the modal
- `on(event: 'close'|'loaded'|'error', handler: Function): void` - Event listeners

**Key Features:**
- **Real Customer Totals API Integration**: Calls `/api/v1/telemetry/customers/{customerId}/energy/devices/totals`
- **Built-in Date Range Picker**: Interactive date selection with validation
- **Robust Data Processing**: Handles pagination, fallback chains, and data normalization
- **Sortable Table Structure**: Sticky totals row + sortable columns (Identifier, Name, Consumption)
- **Portuguese Locale Support**: Brazilian number formatting and sorting
- **Comprehensive Error Handling**: Network failures, authentication, and validation errors
- **CSV Export**: Consistent formatting with UI using `MyIOLibrary.formatEnergy`
- **Production Ready**: Authentication via `fetchWithAuth` pattern with automatic token refresh

**Usage Example:**
```javascript
import { openDashboardPopupAllReport } from 'myio-js-library';

const modal = openDashboardPopupAllReport({
  customerId: '73d4c75d-c311-4e98-a852-10a2231007c4',
  api: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    dataApiBaseUrl: 'https://api.data.apps.myio-bas.com'
  },
  filters: {
    excludeLabels: [
      /bomba.*secund[aá]ria/i,     // Regex patterns
      /^administra[cç][aã]o\s*1$/i,
      'Entrada Principal'           // Exact string matches
    ]
  }
});

modal.on('loaded', (data) => {
  console.log('Customer report loaded:', data.count, 'devices');
  console.log('Total consumption:', data.totalKwh, 'kWh');
});

modal.on('error', (error) => {
  console.error('Report error:', error.message);
});
```

**UMD Usage (ThingsBoard widgets):**
```html
<script src="https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"></script>
<script>
  const { openDashboardPopupAllReport } = MyIOLibrary;
  
  const modal = openDashboardPopupAllReport({
    customerId: 'your-customer-id',
    api: {
      clientId: 'your-client-id',
      clientSecret: 'your-client-secret'
    }
  });
  
  modal.on('loaded', (data) => {
    console.log('All stores report loaded with', data.count, 'devices');
    console.log('Grand total:', data.totalKwh, 'kWh');
  });
</script>
```

**Data Flow:**
```
User clicks "Carregar" 
→ Format timestamps with timezone offset
→ Call Customer Totals API with fetchWithAuth
→ Process response with mapCustomerTotalsResponse
→ Apply sorting with applySorting (Portuguese locale)
→ Update table with updateAllReportTable
→ Update totals with updateGrandTotal
→ Enable CSV export with habilitarBotaoExportAll
```

**API Integration:**
```
GET ${DATA_API_HOST}/api/v1/telemetry/customers/{customerId}/energy/devices/totals
  ?startTime=2025-09-01T00%3A00%3A00-03%3A00
  &endTime=2025-09-25T23%3A59%3A59-03%3A00

Authorization: Bearer ${MyIOAuth.getToken()}
```

**Migration from Legacy Implementation:**
```javascript
// OLD: Mock/placeholder data
MyIOLibrary.openDashboardPopupAllReport({
  // Used mock data or device-by-device calls
});

// NEW: Real Customer Totals API
MyIOLibrary.openDashboardPopupAllReport({
  customerId: 'your-customer-id',        // ✅ Real customer ID
  api: {
    clientId: 'your-client-id',          // ✅ Real API credentials
    clientSecret: 'your-client-secret'
  }
  // ✅ Calls real Customer Totals API endpoint
  // ✅ Handles pagination automatically
  // ✅ Robust error handling and recovery
});
```

**UMD Usage (ThingsBoard widgets):**
```html
<script src="https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"></script>
<script>
  const { openDashboardPopupReport } = MyIOLibrary;

  const modal = openDashboardPopupReport({
    ingestionId: 'demo-ingestion-123',
    deviceId: 'demo-device-123',
    identifier: 'ENTRADA-001',
    label: 'Outback',
    api: {
      clientId: 'demo-client',
      clientSecret: 'demo-secret',
      dataApiBaseUrl: 'https://api.data.apps.myio-bas.com',
      ingestionToken: 'demo-ingestion-token'
    }
  });

  modal.on('loaded', (data) => {
    console.log('Device report loaded with', data.count, 'days of data');
  });
</script>
```

#### `openDashboardPopupWaterTank(params: OpenDashboardPopupWaterTankOptions): Promise<{ close: () => void }>`

Opens a water tank telemetry modal that fetches data directly from ThingsBoard REST API (NOT Ingestion API). Displays real-time water level data with visual indicators, interactive charts, and CSV export functionality. Specifically designed for TANK and CAIXA_DAGUA device types.

**Parameters:**
- `deviceId: string` - ThingsBoard device UUID (required)
- `tbJwtToken: string` - ThingsBoard JWT token for REST API authentication (required)
- `startTs: number` - Start timestamp in milliseconds (required)
- `endTs: number` - End timestamp in milliseconds (required)
- `label?: string` - Display label for the device (default: deviceId)
- `currentLevel?: number` - Current water level percentage 0-100 (optional)
- `deviceType?: string` - Device type (TANK, CAIXA_DAGUA, etc.)
- `slaveId?: string | number` - Slave device ID (optional)
- `centralId?: string` - Central controller ID (optional)
- `telemetryKeys?: string[]` - Telemetry keys to fetch (default: ['waterLevel', 'nivel', 'level'])
- `aggregation?: string` - Aggregation method: NONE, MIN, MAX, AVG, SUM, COUNT (default: 'NONE')
- `limit?: number` - Maximum data points to fetch (default: 1000, max: 10000)
- `timezone?: string` - Timezone (default: 'America/Sao_Paulo')
- `ui?: object` - UI configuration:
  - `title?: string` - Modal title (default: "Water Tank - {label}")
  - `width?: number` - Modal width in pixels (default: 900)
  - `height?: number` - Modal height in pixels (default: 600)
  - `showExport?: boolean` - Show CSV export button (default: true)
  - `showLevelIndicator?: boolean` - Show visual level indicator (default: true)
- `onOpen?: (context) => void` - Callback when modal opens
- `onClose?: () => void` - Callback when modal closes
- `onError?: (error) => void` - Callback on error
- `onDataLoaded?: (data) => void` - Callback when telemetry data is loaded

**Returns:** Promise resolving to an object with:
- `close(): void` - Method to close the modal programmatically

**Key Features:**
- **ThingsBoard Telemetry API Integration**: Fetches data directly from `/api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries`
- **Real-time Level Visualization**: Interactive canvas chart showing water level trends
- **Status-Based Color Coding**: Critical (<20%), Low (20-40%), Medium (40-70%), Good (70-90%), Full (>90%)
- **Summary Statistics**: Current level, average, minimum, maximum values
- **Device Metadata Display**: Shows device ID, label, type, slave ID, central ID
- **CSV Export**: Download telemetry data with proper Brazilian formatting
- **Responsive Design**: Adapts to different screen sizes with smooth animations
- **Error Handling**: Graceful error display with user-friendly messages

**Usage Example:**
```javascript
import { openDashboardPopupWaterTank } from 'myio-js-library';

// Basic usage
const modal = await openDashboardPopupWaterTank({
  deviceId: 'water-tank-uuid-123',
  tbJwtToken: localStorage.getItem('jwt_token'),
  startTs: Date.now() - 86400000 * 7, // Last 7 days
  endTs: Date.now(),
  label: 'Water Tank - Building A',
  currentLevel: 75.5
});

// Close programmatically
modal.close();

// Advanced usage with callbacks and customization
const modal = await openDashboardPopupWaterTank({
  deviceId: 'caixa-dagua-uuid-456',
  tbJwtToken: myToken,
  startTs: startTimestamp,
  endTs: endTimestamp,
  label: 'Caixa D\'Água Principal',
  deviceType: 'CAIXA_DAGUA',
  currentLevel: 82.3,
  slaveId: 'SLAVE-001',
  centralId: 'CENTRAL-A',
  telemetryKeys: ['waterLevel', 'nivel_agua', 'level'],
  aggregation: 'AVG',
  limit: 500,
  ui: {
    title: 'Análise de Nível - Caixa Principal',
    width: 1000,
    height: 700,
    showExport: true
  },
  onOpen: (context) => {
    console.log('Modal opened for device:', context.device.label);
    console.log('Time range:', new Date(context.timeRange.startTs), '-', new Date(context.timeRange.endTs));
  },
  onDataLoaded: (data) => {
    console.log('Telemetry loaded:', data.telemetry.length, 'points');
    console.log('Summary:', data.summary);
  },
  onClose: () => {
    console.log('Modal closed');
  },
  onError: (error) => {
    console.error('Error:', error.message);
    alert(`Failed to load water tank data: ${error.message}`);
  }
});
```

**UMD Usage (ThingsBoard widgets):**
```html
<script src="https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"></script>
<script>
  const { openDashboardPopupWaterTank } = MyIOLibrary;

  // In your widget action handler
  async function handleDashboardAction() {
    const jwtToken = localStorage.getItem('jwt_token');
    const deviceId = entityId.id;
    const startTs = ctx.timeWindow.minTime;
    const endTs = ctx.timeWindow.maxTime;

    try {
      const modal = await openDashboardPopupWaterTank({
        deviceId: deviceId,
        tbJwtToken: jwtToken,
        startTs: startTs,
        endTs: endTs,
        label: entityName,
        deviceType: 'CAIXA_DAGUA',
        currentLevel: currentLevelValue,
        onOpen: (context) => {
          console.log('Water tank modal opened');
        },
        onError: (error) => {
          console.error('Modal error:', error);
          showNotification(error.message, 'error');
        }
      });
    } catch (error) {
      console.error('Failed to open water tank modal:', error);
    }
  }
</script>
```

**ThingsBoard API Integration:**
```
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries
  ?keys=waterLevel,nivel,level
  &startTs={startMillis}
  &endTs={endMillis}
  &limit=1000

Headers:
  X-Authorization: Bearer {tbJwtToken}
```

**Level Status Color Coding:**
- **Critical** (<20%): Red (#e74c3c) - Risk of running dry
- **Low** (20-40%): Orange (#e67e22) - Needs attention
- **Medium** (40-70%): Yellow (#f39c12) - Normal range
- **Good** (70-90%): Green (#27ae60) - Optimal level
- **Full** (>90%): Blue (#3498db) - Near capacity

**Data Structure Returned:**
```javascript
{
  deviceId: 'device-uuid',
  telemetry: [
    { ts: 1704067200000, value: 75.5, key: 'waterLevel' },
    { ts: 1704153600000, value: 72.3, key: 'waterLevel' }
  ],
  summary: {
    currentLevel: 75.5,      // Most recent reading
    avgLevel: 73.8,          // Average over period
    minLevel: 65.2,          // Minimum level
    maxLevel: 82.1,          // Maximum level
    totalReadings: 245,      // Number of data points
    firstReadingTs: 1704067200000,
    lastReadingTs: 1704672000000
  },
  metadata: {
    keys: ['waterLevel', 'nivel', 'level'],
    aggregation: 'NONE',
    limit: 1000
  }
}
```

**Error Handling:**
The modal includes comprehensive error handling with specific error codes:
- `VALIDATION_ERROR` - Invalid parameters provided
- `AUTH_ERROR` - Authentication failed (invalid or expired token)
- `TOKEN_EXPIRED` - JWT token has expired
- `NETWORK_ERROR` - Network request failed
- `NO_DATA` - Device not found or no telemetry available
- `UNKNOWN_ERROR` - Unexpected error occurred

**Integration with TELEMETRY Widget:**
The modal automatically integrates with the v5.2.0 TELEMETRY widget controller:
```javascript
// Automatic device type detection and routing
if (deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA') {
  // Opens water tank modal (uses TB telemetry API)
  await MyIOLibrary.openDashboardPopupWaterTank({
    deviceId: deviceId,
    tbJwtToken: jwtToken,
    startTs: startTimestamp,
    endTs: endTimestamp,
    label: deviceLabel,
    currentLevel: levelPercentage
  });
} else {
  // Opens energy/water modal (uses Ingestion API)
  await MyIO.openDashboardPopupEnergy({...});
}
```

**Migration from Legacy API:**
```javascript
// OLD API (deprecated)
MyIOLibrary.openDashboardPopupReport({
  ingestionId: 'demo-ingestion-123',
  deviceLabel: 'Entrada Subestação',    // ❌ Deprecated
  storeLabel: 'Outback',                // ❌ Deprecated
  date: { start: '2025-09-01', end: '2025-09-25' }, // ❌ Deprecated
  api: { tbJwtToken: 'jwt-token' }      // ❌ Deprecated
});

// NEW API (recommended)
MyIOLibrary.openDashboardPopupReport({
  ingestionId: 'demo-ingestion-123',
  identifier: 'ENTRADA-001',           // ✅ Clear device identifier
  label: 'Outback',                    // ✅ Clear human-readable name
  api: { ingestionToken: 'ingestion-token' } // ✅ Clear token purpose
});
```

### MYIO Components - Drag-to-Footer Dock Implementation

The library includes three main interactive components for building comparative selection interfaces:

#### `MyIOSelectionStore` - Global Selection Management

A singleton store for managing device selection state, multi-unit totals, and analytics.

```javascript
import { MyIOSelectionStore } from 'myio-js-library';

// Register entities for selection
MyIOSelectionStore.registerEntity({
  id: 'device-001',
  name: 'Solar Panel North',
  icon: 'energy',
  group: 'RENEWABLE_ENERGY',
  lastValue: 145.6,
  unit: 'kWh'
});

// Listen to selection changes
MyIOSelectionStore.on('selection:change', (data) => {
  console.log('Selection changed:', data.selectedIds);
  console.log('Totals:', data.totals);
});

// Manage selections
MyIOSelectionStore.add('device-001');
MyIOSelectionStore.toggle('device-002');
MyIOSelectionStore.clear();

// Get current state
const selectedIds = MyIOSelectionStore.getSelectedIds();
const totals = MyIOSelectionStore.getTotals();
const display = MyIOSelectionStore.getMultiUnitTotalDisplay();
// Returns: "Energy: 1,234 kWh | Water: 567 m³"

// Open comparison modal
MyIOSelectionStore.openComparison();
```

**Key Features:**
- **Global state management** - Singleton pattern for app-wide selection state
- **Multi-unit calculations** - Automatic totals for energy (kWh), water (m³), temperature (°C)
- **Event system** - React to selection changes with custom callbacks
- **Analytics integration** - Built-in tracking for user interactions
- **Time-series data** - Cached data fetching for chart visualization
- **Accessibility** - Screen reader announcements and ARIA support

#### `MyIODraggableCard` - Interactive Device Cards

Reusable card components with drag-and-drop, checkbox synchronization, and accessibility.

```javascript
import { MyIODraggableCard } from 'myio-js-library';

const container = document.getElementById('device-grid');
const entity = {
  id: 'pump-001',
  name: 'Water Pump Main',
  icon: 'water',
  group: 'HYDRAULIC_SYSTEM',
  lastValue: 234.7,
  unit: 'm³',
  status: 'ok'
};

// Create draggable card
const card = new MyIODraggableCard(container, entity, {
  showCheckbox: true,
  draggable: true,
  className: 'custom-card'
});

// Update entity data
card.updateEntity({
  lastValue: 156.8,
  status: 'alert'
});

// Manual selection control
card.setSelected(true);

// Cleanup
card.destroy();
```

**Key Features:**
- **Drag & Drop** - HTML5 drag API with touch support (long-press on mobile)
- **Checkbox sync** - Two-way synchronization with SelectionStore
- **Keyboard navigation** - Full accessibility with Tab, Enter, Space, Delete
- **Visual states** - Connection status, data freshness, selection indicators
- **Auto-formatting** - Brazilian locale number formatting
- **Icon system** - Built-in SVG icons for energy, water, temperature, etc.

#### `MyIOChartModal` - Comparative Visualization

Interactive chart modal with Chart.js integration and export functionality.

```javascript
import { MyIOChartModal } from 'myio-js-library';

// The modal automatically integrates with SelectionStore
// When user selects devices and clicks "Compare", modal opens automatically

// Manual control (optional)
const data = {
  entities: MyIOSelectionStore.getSelectedEntities(),
  totals: MyIOSelectionStore.getTotals(),
  count: MyIOSelectionStore.getSelectionCount()
};

await MyIOChartModal.open(data);

// Export functions
MyIOChartModal.exportCsv();  // Downloads CSV file
MyIOChartModal.exportPng();  // Downloads chart as PNG
MyIOChartModal.exportPdf();  // Placeholder for future implementation

MyIOChartModal.close();
```

**Key Features:**
- **Chart.js integration** - Auto-loads Chart.js from CDN
- **Multiple chart types** - Line charts and bar charts
- **Time range selection** - 7, 14, or 30-day comparisons
- **Export functionality** - CSV and PNG export with timestamps
- **Responsive design** - Adapts to container size
- **Accessibility** - ARIA dialog, keyboard navigation, focus management
- **Analytics tracking** - Automatic event tracking for user interactions

#### Complete Integration Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Device Comparison Dashboard</title>
</head>
<body>
  <div class="app">
    <div class="device-grid" id="deviceGrid"></div>
    <div class="selection-summary" id="summary"></div>
    <button id="compareBtn">Compare Selected</button>
  </div>

  <!-- Load MYIO library -->
  <script src="https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"></script>
  <script>
    const { MyIOSelectionStore, MyIODraggableCard, MyIOChartModal } = MyIOLibrary;

    // Setup analytics
    MyIOSelectionStore.setAnalytics({
      track: (event, data) => {
        console.log('Analytics:', event, data);
        // Send to your analytics service
      }
    });

    // Listen to selection changes
    MyIOSelectionStore.on('selection:change', (data) => {
      document.getElementById('summary').textContent = 
        MyIOSelectionStore.getMultiUnitTotalDisplay();
      
      document.getElementById('compareBtn').disabled = data.selectedIds.length < 2;
    });

    // Create device cards
    const devices = [
      { id: 'dev1', name: 'Solar Panel A', icon: 'energy', lastValue: 150, unit: 'kWh' },
      { id: 'dev2', name: 'Water Tank B', icon: 'water', lastValue: 75, unit: 'm³' }
    ];

    devices.forEach(device => {
      MyIOSelectionStore.registerEntity(device);
      new MyIODraggableCard(document.getElementById('deviceGrid'), device);
    });

    // Compare button
    document.getElementById('compareBtn').addEventListener('click', () => {
      MyIOSelectionStore.openComparison();
    });
  </script>
</body>
</html>
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

#### `renderCardCompenteHeadOffice(containerEl: HTMLElement, params: object): object`

Renders premium device cards for MYIO SIM Head Office dashboards with atomic styling and comprehensive event handling. This component provides a self-contained, fully-styled card interface matching the Head Office visual requirements.

**Parameters:**
- `containerEl: HTMLElement` - The container element where the card will be rendered (required)
- `params: object` - Configuration object with the following properties:
  - `entityObject: EntityObject` - Device/entity data and metadata (required)
  - `handleActionDashboard?: Function` - Callback for dashboard menu action
  - `handleActionReport?: Function` - Callback for report menu action
  - `handleActionSettings?: Function` - Callback for settings menu action
  - `handleSelect?: Function` - Callback for selection checkbox toggle
  - `handInfo?: Function` - Callback for info icon click (optional)
  - `handleClickCard?: Function` - Callback for card body click
  - `useNewComponents?: boolean` - Enable new component features (default: false)
  - `enableSelection?: boolean` - Show selection checkbox (default: false)
  - `enableDragDrop?: boolean` - Enable drag and drop functionality (default: false)
  - `i18n?: object` - Custom internationalization labels

**Entity Object Structure:**
```javascript
{
  entityId: string,              // Unique identifier (required)
  labelOrName: string,           // Display name (e.g., "Elevador Social Norte 01")
  deviceIdentifier?: string,     // Device code (e.g., "ELV-002")
  entityType?: string,           // Entity type (e.g., "DEVICE")
  deviceType?: string,           // Device type (ELEVATOR, ESCADA_ROLANTE, CHILLER, PUMP, etc.)
  slaveId?: string | number,     // Slave identifier
  ingestionId?: string | number, // Ingestion identifier
  centralId?: string,            // Central system ID
  centralName?: string,          // Central system name
  
  // Primary metric
  val?: number | null,           // Current value (e.g., power in kW)
  valType?: string,              // Value type (power_kw, flow_m3h, temp_c, custom)
  timaVal?: number | null,       // Timestamp of value (ms)
  
  // Efficiency
  perc?: number,                 // Efficiency percentage (0-100)
  
  // Status
  connectionStatus?: string,     // ONLINE, OFFLINE, ALERT, FAILURE, RUNNING, PAUSED
  connectionStatusTime?: number, // Last connection timestamp (ms)
  
  // Secondary metrics
  temperatureC?: number | null,  // Temperature in Celsius
  operationHours?: number | null,// Operation hours (e.g., 12.847)
  
  // Optional identifiers
  updatedIdentifiers?: object,   // Additional identification data
}
```

**Returns:** Object with control methods:
- `update(next: Partial<EntityObject>): void` - Update card with new data
- `destroy(): void` - Remove card and cleanup event handlers
- `getRoot(): HTMLElement` - Get the root DOM element

**Key Features:**
- **Atomic CSS Injection**: Self-contained styling with no external CSS dependencies
- **Visual States**: Connection status chips (Em operação, Alerta, Falha, Offline)
- **Efficiency Bar**: Segmented progress bar with percentage display
- **3-Dot Menu**: Dropdown menu with dashboard, report, and settings actions
- **Selection Support**: Optional checkbox for multi-selection interfaces
- **Drag & Drop**: Optional drag and drop functionality for card reordering
- **Accessibility**: Full keyboard navigation and ARIA support
- **Responsive Design**: Adapts to container size with proper text truncation
- **Alert Borders**: Visual indicators for alert and failure states

**Usage Example:**
```javascript
import { renderCardCompenteHeadOffice } from 'myio-js-library';

const container = document.getElementById('card-container');
const card = renderCardCompenteHeadOffice(container, {
  entityObject: {
    entityId: 'elv-001',
    labelOrName: 'Elevador Social Norte 01',
    deviceIdentifier: 'ELV-001',
    deviceType: 'ELEVATOR',
    val: 15.2,
    valType: 'power_kw',
    perc: 94,
    connectionStatus: 'RUNNING',
    temperatureC: 28,
    operationHours: 12.847
  },
  handleActionDashboard: (ev, entity) => {
    console.log('Open dashboard for:', entity.labelOrName);
  },
  handleActionReport: (ev, entity) => {
    console.log('Generate report for:', entity.labelOrName);
  },
  handleActionSettings: (ev, entity) => {
    console.log('Open settings for:', entity.labelOrName);
  },
  handleSelect: (checked, entity) => {
    console.log('Selection changed:', checked, entity.entityId);
  },
  handleClickCard: (ev, entity) => {
    console.log('Card clicked:', entity.labelOrName);
  },
  useNewComponents: true,
  enableSelection: true,
  enableDragDrop: true
});

// Update card with new values
card.update({
  val: 18.4,
  perc: 88,
  temperatureC: 27,
  operationHours: 13.5
});

// Clean up when done
card.destroy();
```

**UMD Usage (ThingsBoard widgets):**
```html
<script src="https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"></script>
<script>
  const { renderCardCompenteHeadOffice } = MyIOLibrary;
  
  const container = document.getElementById('cards-grid');
  const entities = [
    {
      entityId: 'esc-001',
      labelOrName: 'Escada Rolante Sul 02',
      deviceIdentifier: 'ESC-001',
      deviceType: 'ESCADA_ROLANTE',
      val: 8.7,
      valType: 'power_kw',
      perc: 87,
      connectionStatus: 'RUNNING',
      temperatureC: 26,
      operationHours: 7.405
    }
  ];
  
  entities.forEach(entity => {
    const cell = document.createElement('div');
    container.appendChild(cell);
    
    renderCardCompenteHeadOffice(cell, {
      entityObject: entity,
      handleActionDashboard: (e, ent) => openDashboard(ent),
      handleActionReport: (e, ent) => openReport(ent),
      handleActionSettings: (e, ent) => openSettings(ent),
      handleSelect: (checked, ent) => toggleSelection(ent, checked),
      handleClickCard: (e, ent) => openQuickView(ent),
      useNewComponents: true,
      enableSelection: true
    });
  });
</script>
```

**Visual Components:**
- **Header**: Device icon, title, device code, 3-dot menu
- **Status Row**: Colored chip indicating operational status
- **Primary Metric**: Large value display with unit and "Atual" suffix
- **Efficiency Bar**: Horizontal progress bar with percentage
- **Footer Metrics**: Temperature, operation time, last update time

**CSS Theming Variables:**
```css
:root {
  --myio-card-radius: 16px;
  --myio-card-shadow: 0 2px 8px rgba(10, 31, 68, .06);
  --myio-card-bg: #fff;
  --myio-card-border: #e9eef5;
  --myio-chip-ok-bg: #e8f7ff;
  --myio-chip-ok-fg: #007ecc;
  --myio-chip-alert-bg: #fff4e5;
  --myio-chip-alert-fg: #b96b00;
  --myio-chip-failure-bg: #ffeaea;
  --myio-chip-failure-fg: #b71c1c;
}
```

For complete technical documentation and implementation details, see: [RFC-0007-renderCardCompenteHeadOffice](src/docs/rfcs/RFC-0007-renderCardCompenteHeadOffice.md)

### Demand Modal Component

#### `openDemandModal(params: DemandModalParams): Promise<DemandModalInstance>`

Opens a fully-styled demand/consumption modal with interactive Chart.js visualization, zoom/pan controls, PDF export, and ThingsBoard telemetry integration. This component implements RFC 0015 specifications with comprehensive accessibility and internationalization support.

**Parameters:**
- `params: DemandModalParams` - Configuration object:
  - `token: string` - JWT token for ThingsBoard authentication (required)
  - `deviceId: string` - ThingsBoard device UUID (required)
  - `startDate: string` - ISO date string "YYYY-MM-DD" (required)
  - `endDate: string` - ISO date string "YYYY-MM-DD" (required)
  - `label?: string` - Device/store label (default: "Dispositivo")
  - `container?: HTMLElement | string` - Mount container (default: document.body)
  - `onClose?: () => void` - Callback when modal closes
  - `locale?: 'pt-BR' | 'en-US' | string` - Locale for formatting (default: 'pt-BR')
  - `pdf?: DemandModalPdfConfig` - PDF export configuration
  - `styles?: Partial<DemandModalStyles>` - Style customization tokens

**Returns:** Promise resolving to `DemandModalInstance` object with:
- `destroy(): void` - Clean up modal and resources

**Key Features:**
- **Interactive Chart.js Visualization**: Smooth line chart with purple stroke and light fill
- **Zoom/Pan Controls**: Mouse wheel zoom, drag selection, Ctrl+pan, Reset Zoom button
- **PDF Export**: A4 portrait report with chart image, metadata, and data table
- **Peak Demand Highlighting**: Yellow pill showing maximum demand value and timestamp
- **Fullscreen Mode**: Toggle to expand modal to full viewport with chart resize
- **ThingsBoard Integration**: Fetches telemetry data using consumption endpoint
- **Internationalization**: Portuguese/English localization with proper date/number formatting
- **Accessibility**: Focus trap, ARIA labels, keyboard navigation (ESC to close)
- **Responsive Design**: Mobile-friendly with touch-optimized controls
- **Dynamic Library Loading**: Chart.js, zoom plugin, and jsPDF loaded on-demand
- **Customizable Styling**: CSS variables and style tokens for theming

**Usage Example:**
```javascript
import { openDemandModal } from 'myio-js-library';

// Basic usage
const modal = await openDemandModal({
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  deviceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  label: 'Loja Centro'
});

// Advanced usage with customization
const modal = await openDemandModal({
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  deviceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  label: 'Shopping Center Norte',
  locale: 'en-US',
  styles: {
    primaryColor: '#1976D2',      // Blue theme
    accentColor: '#FF9800',       // Orange highlights
    borderRadius: '12px'          // Rounded corners
  },
  pdf: {
    enabled: true,
    fileName: 'demand-report-jan2024.pdf'
  },
  onClose: () => {
    console.log('Modal closed');
  }
});

// Clean up when needed
modal.destroy();
```

**UMD Usage (ThingsBoard widgets):**
```html
<script src="https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"></script>
<script>
  const { openDemandModal } = MyIOLibrary;
  
  // In your widget action handler
  async function openDemandChart() {
    try {
      const modal = await openDemandModal({
        token: ctx.defaultSubscription.subscriptionContext.user.token,
        deviceId: entityId.id,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        label: entityLabel,
        onClose: () => {
          console.log('Demand modal closed');
        }
      });
    } catch (error) {
      console.error('Failed to open demand modal:', error);
    }
  }
</script>
```

**ThingsBoard API Integration:**
The component fetches telemetry data from ThingsBoard REST API:
```
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries
  ?keys=consumption
  &startTs={startMillis}
  &endTs={endMillis}
  &limit=50000
  &intervalType=MILLISECONDS
  &interval=54000000
  &agg=SUM
  &orderBy=ASC

Headers:
  X-Authorization: Bearer {token}
```

**Data Processing:**
- Converts cumulative consumption to demand (kW) using time deltas
- Filters out negative values (meter resets)
- Converts Wh to kWh when necessary
- Computes peak demand value and timestamp
- Sorts data chronologically for chart display

**Styling Customization:**
```javascript
const customStyles = {
  // Color tokens
  primaryColor: '#4A148C',      // Header and chart line color
  accentColor: '#FFC107',       // Peak demand pill color
  dangerColor: '#f44336',       // Error state color
  backgroundColor: '#ffffff',   // Modal background
  overlayColor: 'rgba(0, 0, 0, 0.5)', // Backdrop color
  
  // Layout tokens
  borderRadius: '8px',          // Card border radius
  buttonRadius: '6px',          // Button border radius
  pillRadius: '20px',           // Peak pill border radius
  zIndex: 10000,                // Modal z-index
  
  // Typography tokens
  fontFamily: 'Roboto, Arial, sans-serif',
  fontSizeMd: '16px',
  fontWeightBold: '600'
};

const modal = await openDemandModal({
  // ... other params
  styles: customStyles
});
```

**Error Handling:**
- Network failures show user-friendly error messages
- Invalid tokens display authentication errors
- Empty datasets show "no data" message
- Library loading failures gracefully degrade
- All errors are caught and displayed in the UI

**Performance Considerations:**
- External libraries loaded dynamically (Chart.js, jsPDF)
- Chart rendering optimized for large datasets
- Memory cleanup on modal destroy
- Debounced resize handling
- Efficient data processing pipeline

For complete technical specifications, see: [RFC-0015-MyIO-DemandModal-Component](src/docs/rfcs/RFC-0015-MyIO-DemandModal-Component.md)

---

### Goals Panel Component

#### `openGoalsPanel(params: GoalsPanelParams): GoalsPanelInstance`

Opens a comprehensive Consumption Goals Setup Panel for managing annual and monthly energy/water consumption targets. This component implements RFC-0075 specifications with shopping-level and asset-level goal management, validation, versioning, and ThingsBoard Server Scope integration.

**Parameters:**
- `params: GoalsPanelParams` - Configuration object:
  - `customerId: string` - ThingsBoard Customer ID (Holding) (required)
  - `token: string` - JWT token for ThingsBoard API (required when not using mock data)
  - `api?: { baseUrl: string }` - ThingsBoard API configuration
  - `data?: object` - Initial goals data structure (for testing with mock data)
  - `shoppingList?: Array<{value: string, name: string}>` - List of shopping centers
  - `onSave?: (data: object) => void | Promise<void>` - Callback when goals are saved
  - `onClose?: () => void` - Callback when modal is closed
  - `styles?: Partial<GoalsPanelStyles>` - Custom styling overrides
  - `locale?: 'pt-BR' | 'en-US'` - Locale for i18n (default: 'pt-BR')

**Returns:** `GoalsPanelInstance` object with:
- `close(): void` - Close the modal
- `getState(): object` - Get current modal state
- `setYear(year: number): void` - Change the current year
- `refresh(): void` - Reload goals data from API

**Key Features:**
- **Two-Level Goal Management**: Shopping (Annual/Monthly) and Per Asset tabs
- **Annual Goal Definition**: Set total annual consumption target with unit selection (kWh/m³)
- **Monthly Distribution**: Distribute annual goal across 12 months with auto-fill option
- **Asset-Level Goals**: Define specific goals per asset (e.g., Common Area, Food Court)
- **Progress Visualization**: Real-time progress bar showing monthly sum vs annual goal
- **Validation Rules**: Ensures monthly sum ≤ annual goal, non-negative values
- **Year Navigation**: Switch between years with previous/next controls
- **Shopping Selector**: Multi-shopping support with dropdown selector
- **Versioning System**: MetaTag (ISO8601|author) tracking per year
- **History Tracking**: Maintains version history with change reasons
- **ThingsBoard Integration**: Persists to Customer Server Scope attributes
- **Internationalization**: Portuguese/English localization
- **Accessibility**: Focus trap, ARIA labels, keyboard navigation (ESC to close)
- **Responsive Design**: Mobile-friendly grid layouts
- **Customizable Styling**: Theme tokens for colors, fonts, and dimensions

**Data Structure:**
```javascript
// Goals data structure (stored in ThingsBoard Server Scope)
{
  "version": 1,
  "history": [
    {
      "tag": "2025-11-12T10:30:00Z|user@myio",
      "reason": "Initial setup",
      "diff": { "year": 2025, "changed": ["annual.total"] }
    }
  ],
  "years": {
    "2025": {
      "annual": {
        "total": 1200000,
        "unit": "kWh"
      },
      "monthly": {
        "01": 90000,
        "02": 88000,
        "03": 95000,
        // ... months 04-12
      },
      "assets": {
        "asset-uuid-1": {
          "label": "Common Area",
          "annual": { "total": 300000, "unit": "kWh" },
          "monthly": {
            "01": 22000,
            "02": 21000,
            // ... months 03-12
          }
        },
        "asset-uuid-2": {
          "label": "Food Court",
          "annual": { "total": 450000, "unit": "kWh" },
          "monthly": { /* ... */ }
        }
      },
      "metaTag": "2025-11-12T10:30:00Z|user@myio"
    }
  }
}
```

**Usage Example:**
```javascript
import { openGoalsPanel } from 'myio-js-library';

// Basic usage with ThingsBoard integration
const panel = openGoalsPanel({
  customerId: 'customer-uuid-holding',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  api: {
    baseUrl: 'https://thingsboard.myio.com.br'
  },
  shoppingList: [
    { value: 'shopping-1-uuid', name: 'Shopping Centro' },
    { value: 'shopping-2-uuid', name: 'Shopping Norte' }
  ],
  onSave: async (goalsData) => {
    console.log('Goals saved:', goalsData);
    // Refresh dashboard or trigger other actions
    await refreshDashboard();
  },
  onClose: () => {
    console.log('Goals panel closed');
  }
});

// Advanced usage with mock data for testing
const mockData = {
  version: 1,
  history: [],
  years: {
    "2025": {
      annual: { total: 1200000, unit: 'kWh' },
      monthly: {
        "01": 95000, "02": 92000, "03": 98000,
        "04": 100000, "05": 102000, "06": 105000,
        "07": 108000, "08": 110000, "09": 103000,
        "10": 98000, "11": 95000, "12": 94000
      },
      assets: {},
      metaTag: '2025-11-12T10:00:00Z|admin@myio'
    }
  }
};

const panel = openGoalsPanel({
  customerId: 'test-customer',
  token: 'test-token',
  data: mockData,
  locale: 'en-US',
  styles: {
    primaryColor: '#2E7D32',
    accentColor: '#FFA726',
    borderRadius: '12px'
  }
});

// Programmatic control
panel.setYear(2026);           // Switch to year 2026
console.log(panel.getState()); // Get current state
panel.refresh();               // Reload data
panel.close();                 // Close modal
```

**ThingsBoard Widget Integration:**
```javascript
// In your ThingsBoard widget HTML action button
<script>
  function openGoalsSetup() {
    const customerId = ctx.custom?.customerId || ctx.defaultSubscription?.targetEntityId?.id;
    const token = ctx.defaultSubscription?.subscriptionContext?.user?.token;

    if (!customerId || !token) {
      console.error('Missing required context');
      return;
    }

    openGoalsPanel({
      customerId: customerId,
      token: token,
      api: {
        baseUrl: window.location.origin
      },
      onSave: async (goalsData) => {
        // Update widget or trigger refresh
        ctx.updateAliases();
        console.log('Goals updated:', goalsData);
      }
    });
  }
</script>
```

**Shopping Tab Features:**
- **Unit Selection**: Choose between kWh (energy) or m³ (water)
- **Annual Goal Input**: Define total annual consumption target
- **Shopping Selector**: Select specific shopping center (if multiple available)
- **Monthly Grid**: 12-month input grid with individual values
- **Auto-Fill Button**: Proportionally distribute annual goal across months
- **Progress Indicator**: Visual bar showing monthly sum vs annual goal
  - Green: Sum < 95% of annual
  - Orange: Sum between 95-100% of annual
  - Red: Sum > 100% of annual (validation error)

**Assets Tab Features:**
- **Asset List**: Expandable list of configured assets
- **Search/Filter**: Search for specific assets
- **Add Asset**: Create new asset goals with custom label
- **Per-Asset Goals**: Define annual and monthly goals for each asset
- **Delete Asset**: Remove asset goals with confirmation
- **Expand/Collapse**: Click asset header to expand details

**Validation Rules:**
1. Annual goal must be ≥ 0
2. All monthly values must be ≥ 0
3. Sum of monthly values ≤ annual goal (Shopping and each Asset)
4. Month keys must be valid: "01" through "12"
5. Unit must be consistent within the same year
6. If monthly is empty, only annual goal is validated

**Error Handling:**
- Clear inline validation errors with specific messages
- Real-time progress bar color indication
- Scroll to error section on validation failure
- Confirm dialog for unsaved changes
- User-friendly error messages in selected locale

**Styling Customization:**
```javascript
const customStyles = {
  // Color tokens
  primaryColor: '#4A148C',      // Header, tabs, buttons
  accentColor: '#FFC107',       // Highlights and accents
  successColor: '#28a745',      // Success states, valid progress
  errorColor: '#dc3545',        // Error states, invalid values
  warningColor: '#fd7e14',      // Warning states, near-limit

  // Layout tokens
  borderRadius: '8px',          // Card border radius
  fontFamily: "'Roboto', Arial, sans-serif",
  zIndex: 10000                 // Modal z-index
};

const panel = openGoalsPanel({
  // ... other params
  styles: customStyles
});
```

**Internationalization:**
The component supports Portuguese (pt-BR) and English (en-US) locales:

```javascript
// Portuguese (default)
openGoalsPanel({ locale: 'pt-BR' });

// English
openGoalsPanel({ locale: 'en-US' });
```

Translated strings include:
- Modal title and labels
- Button texts
- Month names
- Validation error messages
- Confirmation dialogs
- Success messages

**Versioning and History:**
Each save operation:
1. Increments document version number
2. Adds history entry with:
   - `tag`: ISO8601 timestamp + author identifier
   - `reason`: Description of changes
   - `diff`: Summary of what changed
3. Updates year `metaTag` with current timestamp and author
4. Persists to ThingsBoard Customer Server Scope

**ThingsBoard API Integration:**
The component interacts with ThingsBoard REST API:

```javascript
// Read goals
GET /api/plugins/telemetry/CUSTOMER/{customerId}/values/attributes/SERVER_SCOPE
  ?keys=consumptionGoals

// Write goals
POST /api/plugins/telemetry/CUSTOMER/{customerId}/SERVER_SCOPE
{
  "consumptionGoals": {
    // Full goals data structure
  }
}

Headers:
  X-Authorization: Bearer {token}
```

**Dashboard Integration:**
Goals data can be consumed by dashboard widgets to show Goal vs Actual comparisons:

```javascript
// Read from Server Scope in widget
const goalsAttr = ctx.data[0]?.latest?.SERVER_SCOPE?.consumptionGoals;
const goalsData = JSON.parse(goalsAttr?.value || '{}');

// Get current year and month goals
const currentYear = new Date().getFullYear().toString();
const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
const monthlyGoal = goalsData.years?.[currentYear]?.monthly?.[currentMonth];

// Compare with actual consumption
const actualConsumption = getActualConsumption(); // from telemetry
const achievementPercent = (actualConsumption / monthlyGoal) * 100;

// Display in widget
displayGoalComparison(monthlyGoal, actualConsumption, achievementPercent);
```

**Performance Considerations:**
- Minimal DOM manipulation with batch updates
- Event delegation for dynamic content
- Efficient monthly sum calculations
- Lightweight CSS-in-JS injection
- No external dependencies (vanilla JS)
- Focus trap optimization
- Smooth animations with CSS transitions

**Accessibility Features:**
- Semantic HTML structure with proper roles
- ARIA labels and descriptions
- Focus trap within modal
- Keyboard navigation support
- Screen reader friendly
- High contrast error states
- Tab order management

**Browser Compatibility:**
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires ES6+ support
- Uses modern DOM APIs
- Responsive design for mobile/tablet

For complete technical specifications and implementation details, see: [RFC-0075-GoalsPanel](src/docs/rfcs/RFC-0075-GoalsPanel.md)

---

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
