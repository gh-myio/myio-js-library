# myio-js-library

A clean, standalone JavaScript SDK for **MYIO** projects.  
Works in **Node.js (>=18)** and modern browsers.  
Distributed as **ESM**, **CJS**, and **UMD** (with a pre-minified build for CDN usage).

---

## 🚀 Features

- 🔑 **Core codecs** — e.g., `decodePayloadBase64Xor`.
- 🌐 **HTTP wrapper** — with retries, timeout, and backoff.
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
import { decodePayload, fetchWithRetry, strings, numbers } from 'myio-js-library';

// Decode with string key
const text = decodePayload('AwAVBwo=', 'key'); // "hello"
console.log(text);

// HTTP request with retries
const response = await fetchWithRetry('https://api.example.com/data', {
  retries: 3,
  timeout: 5000
});
```

### Node.js (CJS)
```javascript
const { decodePayload, fetchWithRetry, strings, numbers } = require('myio-js-library');
```

### Browser (CDN/UMD)
```html
<script src="https://unpkg.com/myio-js-library@0.1.0/dist/myio-js-library.umd.min.js"></script>
<script>
  const text = MyIOJSLibrary.decodePayload('AwAVBwo=', 'key');
  console.log(text); // "hello"
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
