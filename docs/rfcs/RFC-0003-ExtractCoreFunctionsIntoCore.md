- Feature Name: `extract-core-functions-into-core`
- Start Date: 2025-08-27
- RFC PR: [myio-js-library#0000](https://github.com/gh-myio/myio-js-library/pull/0000)
- Tracking Issue: [myio-js-library#0000](https://github.com/gh-myio/myio-js-library/issues/0000)

# Summary

Systematically extract shared, stable JavaScript functions from existing MYIO codebases into the npm package `myio-js-library`. The outcome is a small, tree-shakeable SDK that provides consistent utilities (codec, net, strings, numbers, etc.), dual module outputs (ESM + CJS), typed via `.d.ts`, and compatible with Node ≥ 18 and modern browsers. We will add codemods and guardrails to migrate consumers with minimal churn and a clear deprecation story.

# Motivation

* **Deduplication & consistency:** Consolidate repeated helpers (e.g., Base64+XOR decode, HTTP with retries) to a single, maintained source of truth.
* **Reliability:** Centralize tests and hardening (timeouts, backoff, error semantics) to reduce regressions across apps.
* **Velocity:** New projects import battle‑tested functions immediately.
* **Size & performance:** Tree‑shakeable modules and stable APIs minimize bundle bloat.
* **Governance:** Versioned releases (SemVer + CHANGELOG) and deprecation policy.

# Guide-level explanation

## Goals & Non‑Goals

**Goals**

1. Define a **repeatable extraction process** (inventory → design → moduleization → tests → types → publish → migrate).
2. Provide **codemods** to rewrite imports in consumers automatically.
3. Ensure **browser/Node portability** for selected helpers; segregate Node‑only logic explicitly.
4. Ship **clear APIs** with options objects, documented error shapes, and `.d.ts` types.

**Non‑Goals**

* Porting UI components, frameworks, or Node‑RED flows.
* Shipping project‑specific stateful logic (env coupling, secrets).
* Changing business semantics (beyond necessary normalization/cleanup).

## Proposed Initial Scope (v0.2.0)

* `codec/decodePayload(encoded, key)` — base64 decode + XOR with string/number key.
* `codec/decodePayloadBase64Xor(encoded, xorKey=73)` — 1‑byte XOR legacy.
* `net/fetchWithRetry(url, { retries, retryDelay, timeout, retryCondition, ...RequestInit })` — timeout + retries + exponential backoff.
* `utils/strings.normalizeRecipients(val)` — normalização robusta.
* `utils/numbers.{ fmtPerc, toFixedSafe }` — helpers numéricos.

*Rationale:* já implementados/testados na `0.1.0`; apenas formalizar contrato público.

# Reference-level explanation

## Definitions

* **Candidate function:** Any utility or helper used in ≥2 codebases or with high call frequency.
* **Adapter/Bridge:** Thin wrapper kept in consumer repos to preserve old signatures during migration.
* **Codemod:** Automated AST transform that updates import paths/usages.

## Requirements

* **API Shape:** Prefer **pure functions**; if side effects, document clearly. Use an **options object** for extensibility (e.g., `{ timeout, retries }`).
* **Portability:** No Node‑specifics in browser modules (e.g., `Buffer`, `fs`). Use runtime feature detection and split modules if needed (`net/` may be Node‑biased; `codec/` must be universal).
* **Types:** Hand‑written `.d.ts` maintained in `src/types` (copied to `dist/`), or TS in future.
* **Errors:** Throw `Error` with **stable message format**; do not expose raw fetch internals.
* **Build:** ESM `.js` (with `"type":"module"`) + CJS `.cjs` via tsup; optional UMD for browsers.
* **Docs:** README API table + per‑module JSDoc.
* **Tests:** Vitest; coverage ≥ 90% lines on extracted modules.
* **Security:** Zero secrets; no implicit network calls.

## Candidate Discovery (Inventory)

We will create a small discovery script to enumerate potential extraction targets.

**Heuristics**

* Frequency of use (search across repos).
* Low dependency footprint (few imports, no app‑specific state).
* Purity (few side effects); portability (runs in Node + browser if intended).
* Clear name and stable behavioral contract.

**Deliverable**: `tools/inventory/candidates.json`

```json
[
  {
    "name": "decodePayload",
    "path": "<repo>/src/utils/codec/decodePayload.js",
    "category": "codec",
    "deps": ["TextEncoder", "TextDecoder"],
    "browserSafe": true,
    "callSites": 47
  },
  {
    "name": "fetchWithRetry",
    "path": "<repo>/src/net/http.js",
    "category": "net",
    "deps": ["fetch"],
    "browserSafe": true,
    "callSites": 32
  }
]
```

## API Design Principles

1. **Naming:** Short, descriptive, consistent (e.g., `codec/`, `net/`, `strings/`, `numbers/`).
2. **Parameters:** Prefer `{ ...options }` for extensibility; avoid positional booleans.
3. **Return Types:** Deterministic; avoid polymorphic returns that depend on flags.
4. **Errors:** Standardize messages (`HTTP ${status}: ${statusText}`; `Invalid base64`).
5. **Docs & Examples:** Inline JSDoc + README examples.

## Extraction Process

**Phase A — Spec & Acceptance**

* For each candidate, draft a mini spec: signature, examples, error cases, portability notes.
* Tag open questions (e.g., encoding edge cases).

**Phase B — Moduleization**

* Move/port code into `myio-js-library/src/<category>/...`.
* Remove app‑specific branches (feature flags antigos, logs internos).
* Add input validation & error normalization.

**Phase C — Types & Tests**

* Update `src/types/index.d.ts`.
* Add/extend unit tests; cover edge cases e.g. Unicode, large payloads, 429 retry.

**Phase D — Build & Docs**

* `npm run build` → verify ESM/CJS/UMD + `.d.ts`.
* Update README API sections.

**Phase E — Publish**

* Publish `0.2.0` with release notes: added modules, any behavior harmonization.

**Phase F — Consumer Migration**

* Add **codemods** to rewrite imports (see Codemods section below).
* Provide adapters (temporary) quando assinatura antiga divergir.
* Set **deprecation warnings** nos locais antigos.

# Drawbacks

* **Migration overhead:** Initial effort required to refactor existing codebases to use the new library.
* **Dependency management:** Introduces a new external dependency that needs to be maintained and versioned.
* **Potential breaking changes:** During 0.x versions, minor releases may include limited breaking changes.
* **Bundle size considerations:** While tree-shakeable, improper usage could increase bundle size.

# Rationale and alternatives

## Why is this design the best in the space of possible designs?

This approach provides the optimal balance between reusability, maintainability, and migration ease:

- **Systematic extraction process** ensures consistent quality and reduces ad-hoc decisions
- **Codemods** minimize manual migration effort
- **Tree-shakeable modules** prevent bundle bloat
- **Dual module outputs** (ESM + CJS) ensure broad compatibility
- **TypeScript definitions** improve developer experience

## What other designs have been considered?

**Alternative 1: Monolithic utility library**
- **Rationale for not choosing**: Would increase bundle size and reduce tree-shaking effectiveness

**Alternative 2: Copy-paste approach**
- **Rationale for not choosing**: Perpetuates code duplication and maintenance burden

**Alternative 3: Framework-specific solutions**
- **Rationale for not choosing**: Reduces reusability across different project types

## What is the impact of not doing this?

- Continued code duplication across projects
- Inconsistent behavior between similar functions
- Higher maintenance burden and increased likelihood of bugs
- Difficulty in testing utility functions in isolation

# Prior art

This approach follows established patterns in the JavaScript ecosystem:

- **Lodash**: Modular utility functions with tree-shaking support
- **date-fns**: Focused utility library with clear module boundaries
- **Ramda**: Functional programming utilities with consistent API design

# Unresolved questions

1. Should we expose subpath exports (`myio-js-library/codec`) for finer tree‑shaking?
2. Do we want a separate `node/` subpath for Node‑only helpers (e.g., streams, fs)?
3. Should error classes be customized (e.g., `HttpError`) or keep using standard `Error`?
4. What should be the deprecation timeline for legacy function signatures?

# Future possibilities

- **Expanded module coverage**: Additional domains like data validation, caching, and analytics
- **React integration**: Hooks and components built on top of core utilities
- **Performance optimizations**: Memoization and caching for expensive operations
- **Internationalization**: Multi-language support for formatting functions
- **Plugin system**: Extensible architecture for custom utility modules

## Compatibility Strategy

* **Adapters:** Pequenas funções em consumidores que chamam a nova API preservando assinaturas antigas durante a transição.
* **Deprecation:** `console.warn` (ambientado por NODE\_ENV) + JSDoc `@deprecated` com link para nova função.
* **Feature Parity:** Verificar que resultados e erros são equivalentes ou documentar mudanças intencionais.

## Codemods (Automated Migrations)

**Goal:** Atualizar imports e, quando seguro, chamadas de função.

### Import Rewrite (jscodeshift)

* Replace:
  * `import { decodePayload } from '../../utils/codec'` → `import { decodePayload } from 'myio-js-library';`
  * `const { fetchWithRetry } = require('../net/http')` → `const { fetchWithRetry } = require('myio-js-library');`

**Skeleton (ESM)**

```js
// transforms/import-rewrite.js
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  function isTargetLocal(p) {
    return /\b(utils|net|codec)\b/.test(p) && /\.\.|\//.test(p);
  }

  root.find(j.ImportDeclaration)
    .filter(path => isTargetLocal(path.value.source.value))
    .forEach(path => {
      path.value.source.value = 'myio-js-library';
    });

  return root.toSource();
}
```

### Options Object Normalization

* If consumers pass positional params, codemod can wrap into `{ ... }` when unambiguous. Otherwise, adapters remain in consumer code.

## Testing Strategy

* **Unit:** 100% of new public APIs with edge cases.
* **Contract Tests:** Validate error messages, retry behavior, timeouts deterministically via fake timers.
* **Cross‑Env:** Run on Node 18 & 20 in CI; smoke in a browser‑like env if applicable.

## Public API Reference

```ts
// codec
export function decodePayload(encoded: string, key: string | number): string;
export function decodePayloadBase64Xor(encoded: string, xorKey?: number): string;

// net
export function fetchWithRetry(
  url: string | URL,
  options?: RequestInit & {
    retries?: number; retryDelay?: number; timeout?: number;
    retryCondition?: (error?: unknown, response?: Response) => boolean;
  }
): Promise<Response>;
export const http: typeof fetchWithRetry;

// utils
export namespace strings {
  function normalizeRecipients(val: unknown): string;
}
export namespace numbers {
  function fmtPerc(x: number, digits?: number): string;
  function toFixedSafe(x: number, digits?: number): string;
}
```
