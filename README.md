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
import { decodePayloadBase64Xor, http, strings, numbers } from 'myio-js-library';

const text = decodePayloadBase64Xor('SGVsbG8=', 73);
console.log(text);
```

### Node.js (CJS)
```javascript
const { decodePayloadBase64Xor, http, strings, numbers } = require('myio-js-library');
```

### Browser (CDN/UMD)
```html
<script src="https://unpkg.com/myio-js-library@0.1.0/dist/myio-js-library.umd.min.js"></script>
<script>
  const text = MyIOJSLibrary.decodePayloadBase64Xor('SGVsbG8=', 73);
  console.log(text);
</script>
```

## 📚 API

### `decodePayloadBase64Xor(encoded: string, xorKey?: number): string`

Decodes a base64 string and XORs each byte with the provided key.

### `http(url, opts?): Promise<Response>`

Fetch wrapper with retries and timeout.

### `strings.normalizeRecipients(val: unknown): string`

Normalizes a list (array/string/JSON array) into a comma-separated string.

### `numbers.fmtPerc(x: number, digits?: number): string`

Formats a number 0..1 into a percentage string.

### `numbers.toFixedSafe(x: number, digits?: number): string`

Safely formats a number to fixed decimals (returns "—" if invalid).

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
