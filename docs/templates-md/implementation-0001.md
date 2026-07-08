- Feature Name: `myio-js-library`
- Start Date: 2025-08-26
- RFC PR: [gh-myio/myio-js-library#0001](https://github.com/gh-myio/myio-js-library/pull/0001)
- Implementation Issue: [gh-myio/myio-js-library#0001](https://github.com/gh-myio/myio-js-library/issues/0001)

# Summary
[summary]: #summary

A lightweight, tree-shakeable JavaScript SDK providing reusable utilities for MYIO applications and widgets. The library will offer dual module support (ESM + CJS), TypeScript definitions, and optional UMD builds for browser usage.

# Motivation
[motivation]: #motivation

Currently, MYIO projects lack a centralized, reusable JavaScript library for common utilities and patterns. This leads to:

- **Code duplication** across different MYIO applications
- **Inconsistent implementations** of common functionality like payload decoding, HTTP clients, and utility functions
- **Maintenance overhead** from maintaining similar code in multiple repositories
- **Lack of standardization** in how MYIO applications handle common tasks

The existing `myio-nodered-library` has proven solid as a foundation, but we need a clean, npm-first SDK that can be easily consumed by various MYIO projects including Node-RED flows, ThingsBoard widgets, and web applications.

**Specific use cases this feature addresses:**

1. **Payload Processing**: Standardized decoding of base64-encoded XOR payloads across MYIO applications
2. **HTTP Communication**: Consistent HTTP client with retry logic and timeout handling
3. **Utility Functions**: Common string, date, and number manipulation functions
4. **Cross-Platform Compatibility**: Support for Node.js, browsers, and various module systems
5. **Developer Experience**: Zero-config imports with tree-shaking support

# Guide-level explanation
[guide-level-explanation]: #guide-level-explanation

## Installation and Basic Usage

Developers can install the library via npm and immediately start using utilities:

```bash
npm install myio-js-library
```

```javascript
// ESM (modern)
import { decodePayloadBase64Xor, http } from 'myio-js-library';

// CommonJS (legacy)
const { decodePayloadBase64Xor, http } = require('myio-js-library');

// Browser via CDN
<script src="https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"></script>
```

## Core Functionality

### Payload Decoding
```javascript
// Decode base64-encoded XOR payload (common in MYIO systems)
const decoded = decodePayloadBase64Xor('SGVsbG8=', 73);
console.log(decoded); // "Hello"
```

### HTTP Client
```javascript
// HTTP client with built-in retry and timeout
const response = await http.get('https://api.example.com/data', {
  timeout: 5000,
  retries: 3
});
```

### Utility Functions
```javascript
import { strings, numbers } from 'myio-js-library';

// String utilities
const recipients = strings.normalizeRecipients('user1,user2;user3');

// Number utilities
const percentage = numbers.fmtPerc(0.1234, 2); // "12.34%"
```

## Module System Support

The library supports all major module systems:

- **ESM (default)**: Modern `import`/`export` syntax
- **CommonJS**: Legacy `require()` for older Node.js projects
- **UMD**: Browser `<script>` tags with global `MyIOLibrary` object

## Tree-shaking

The library is designed to be tree-shakeable, meaning bundlers will only include the functions you actually use:

```javascript
// Only the decodePayloadBase64Xor function will be bundled
import { decodePayloadBase64Xor } from 'myio-js-library';
```

# Reference-level explanation
[reference-level-explanation]: #reference-level-explanation

## Package Structure

```
myio-js-library/
├─ src/
│  ├─ index.js            # Barrel exports
│  ├─ codec/
│  │  └─ decodePayload.js # Payload decoding utilities
│  ├─ net/
│  │  └─ http.js          # HTTP client wrapper
│  └─ utils/
│     ├─ strings.js       # String manipulation utilities
│     └─ numbers.js       # Number formatting utilities
├─ dist/
│  ├─ index.mjs           # ESM build
│  ├─ index.cjs           # CommonJS build
│  ├─ index.d.ts          # TypeScript definitions
│  └─ myio-js-library.umd.min.js  # UMD build (minified)
├─ package.json
├─ README.md
├─ CHANGELOG.md
└─ LICENSE
```

## Build System

The library uses `tsup` for primary builds and `rollup` for UMD generation:

```json
{
  "scripts": {
    "build:tsup": "tsup src/index.js --format esm,cjs --dts --clean",
    "build:umd": "rollup -c",
    "minify:umd": "terser dist/myio-js-library.umd.js -o dist/myio-js-library.umd.min.js",
    "build": "npm run clean && npm run build:tsup && npm run build:umd && npm run minify:umd"
  }
}
```

## Package.json Configuration

```json
{
  "name": "myio-js-library",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "sideEffects": false
}
```

## API Design

### Core Functions

```javascript
// Payload decoding
export function decodePayloadBase64Xor(encoded: string, xorKey?: number): string

// HTTP client
export const http = {
  get(url: string, options?: HttpOptions): Promise<Response>,
  post(url: string, data?: any, options?: HttpOptions): Promise<Response>
}

// Utility namespaces
export namespace strings {
  function normalizeRecipients(input: string): string[]
}

export namespace numbers {
  function fmtPerc(value: number, digits?: number): string
}
```

## Interaction with Other Features

- **Node-RED Integration**: Functions can be imported directly in Node-RED function nodes
- **ThingsBoard Widgets**: UMD build allows direct inclusion in widget HTML
- **Web Applications**: ESM build integrates with modern bundlers (Vite, Webpack, esbuild)
- **Legacy Systems**: CommonJS build supports older Node.js environments

## Implementation Details

1. **Tree-shaking**: Each module exports individual functions to enable optimal bundling
2. **Side-effect free**: All modules are marked as side-effect free for better optimization
3. **TypeScript support**: JSDoc comments generate TypeScript definitions
4. **Browser compatibility**: UMD build includes necessary polyfills for older browsers

# Drawbacks
[drawbacks]: #drawbacks

- **Additional dependency**: Projects will need to add another npm dependency
- **Bundle size**: Even with tree-shaking, adds some overhead to final bundles
- **Maintenance burden**: Requires ongoing maintenance, versioning, and support
- **Breaking changes**: Future API changes could impact multiple MYIO projects
- **Learning curve**: Developers need to learn the new API instead of implementing custom solutions

# Rationale and alternatives
[rationale-and-alternatives]: #rationale-and-alternatives

## Why this design?

1. **Dual module support**: Ensures compatibility with both modern and legacy environments
2. **Tree-shaking**: Minimizes bundle size impact by only including used functions
3. **TypeScript definitions**: Provides excellent developer experience with autocomplete and type checking
4. **UMD build**: Enables usage in environments where npm packages aren't available

## Alternative designs considered

### Monorepo with separate packages
- **Pros**: More granular dependency management
- **Cons**: Increased complexity, harder to discover related functionality
- **Decision**: Single package is simpler for the initial scope

### TypeScript-first implementation
- **Pros**: Better type safety during development
- **Cons**: Additional build complexity, larger development dependency footprint
- **Decision**: JavaScript with JSDoc provides sufficient typing with less complexity

### Framework-specific packages
- **Pros**: Optimized for specific use cases (React, Vue, etc.)
- **Cons**: Fragments the ecosystem, more maintenance overhead
- **Decision**: Framework-agnostic approach provides broader utility

## Impact of not implementing

Without this library:
- Code duplication will continue across MYIO projects
- Inconsistent implementations will lead to bugs and maintenance issues
- Developer productivity will remain lower due to reimplementing common functionality
- MYIO ecosystem will lack standardization

# Prior art
[prior-art]: #prior-art

## Similar libraries in other ecosystems

- **Lodash**: Utility library with modular design and tree-shaking support
- **Ramda**: Functional programming utilities with consistent API design
- **Date-fns**: Modular date utility library with excellent tree-shaking
- **Axios**: HTTP client library with consistent API across environments

## Lessons learned

1. **Modular design**: Libraries like Lodash show the importance of allowing selective imports
2. **Consistent API**: Ramda demonstrates the value of predictable function signatures
3. **Documentation**: Well-documented libraries see higher adoption rates
4. **Backward compatibility**: Breaking changes should be minimized and well-communicated

## MYIO-specific context

The existing `myio-nodered-library` provides validation that this approach works well for MYIO use cases. This RFC builds on those learnings while addressing the limitations of the current implementation.

# Unresolved questions
[unresolved-questions]: #unresolved-questions

- **Versioning strategy**: Should we use semantic versioning strictly or adopt a more conservative approach for breaking changes?
- **Testing strategy**: What level of browser compatibility testing is required?
- **Documentation hosting**: Should we use GitHub Pages, a separate documentation site, or rely on README files?
- **Performance benchmarks**: What performance characteristics should we guarantee?
- **Plugin system**: Should the library support plugins or extensions for custom MYIO-specific functionality?

# Future possibilities
[future-possibilities]: #future-possibilities

## Potential extensions

1. **React/Vue components**: Framework-specific components built on top of the core library
2. **CLI tools**: Command-line utilities for common MYIO development tasks
3. **Validation schemas**: JSON schema definitions for common MYIO data structures
4. **Testing utilities**: Helpers for testing MYIO applications
5. **Development tools**: Browser extensions or IDE plugins for MYIO development

## Ecosystem integration

- **Node-RED nodes**: Official Node-RED nodes that use this library internally
- **ThingsBoard widgets**: Widget templates that demonstrate library usage
- **Documentation site**: Comprehensive documentation with interactive examples
- **Community contributions**: Guidelines and tools for community-contributed utilities

## Long-term vision

This library could become the foundation for a broader MYIO JavaScript ecosystem, providing:
- Standardized patterns for MYIO application development
- Shared tooling and utilities across all MYIO projects
- Better developer onboarding through consistent APIs
- Foundation for more advanced MYIO-specific frameworks and tools

The modular design ensures that future additions won't break existing functionality, and the semantic versioning approach will provide clear upgrade paths for consuming applications.
