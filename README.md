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
  fetchWithRetry, 
  addNamespace, 
  detectDeviceType,
  strings, 
  numbers 
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
  const text = MyIOJSLibrary.decodePayload('AwAVBwo=', 'key');
  console.log(text); // "hello"
  
  // Add namespace to data
  const data = { temperature: 25, humidity: 60 };
  const namespaced = MyIOJSLibrary.addNamespace(data, 'sensor1');
  console.log(namespaced); // { "temperature (sensor1)": 25, "humidity (sensor1)": 60 }
  
  // Detect device type
  const deviceType = MyIOJSLibrary.detectDeviceType('building', 'floor2-room101');
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
