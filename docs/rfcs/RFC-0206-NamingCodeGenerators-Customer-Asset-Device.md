# RFC-0206 — Shared Naming & Code-Generation Utilities (Customer / Asset / Device)

- **RFC**: 0206
- **Title**: Shared Naming & Code-Generation Utilities for Customer, Asset and Device
- **Status**: Draft (design only — **no implementation in this RFC**)
- **Author**: Rodrigo Lago
- **Created**: 2026-06-16
- **Target package**: `myio-js-library` (`src/utils/`, public re-exports in `src/index.ts`)
- **Related**:
  - `src/utils/device.ts` — existing `generateMercosulPlate`, `DEVICE_TYPE_PREFIX_MAP`, `getDeviceTypePrefix` (building blocks reused here)
  - `src/utils/deviceTypeConfig.ts` — `DEVICE_TYPE_CONFIG`, `getDeviceCategory` (single-source device metadata)
  - RFC-0200 — `deviceIcons` shared device-type image map (precedent for "shared config map" utilities)
  - GCDR frontend: `gcdr-frontend/src/pages/customers/CustomerForm.tsx` (`generateCode`), `gcdr-frontend/src/components/customers/CustomerAssetsTab.tsx` (`ASSET_TYPE_CONFIG`)
  - presetup-nextjs: `src/lib/naming-rules.ts` (`generateMercosulPlate`, `pickUniqueMercosul`, `applyCustomerCodeToAssetName`), `src/lib/utils.ts` (`generateAssetIdentifier`)

---

## Summary

Several MYIO front-ends (GCDR frontend, presetup-nextjs, ThingsBoard widgets) each carry their **own** copy of the logic that turns a human name into a stable, collision-resistant **code/identifier** for Customers, Assets and Devices. The rules drift between repos, the Mercosul-plate generator was already lifted into this library (`src/utils/device.ts`), and there is no single, framework-neutral place that owns the **full code grammar**.

This RFC proposes consolidating that grammar into three small, framework-agnostic utility modules in `myio-js-library`, delivered in three phases:

| Phase | Module | Code grammar | Example |
|-------|--------|--------------|---------|
| **1 — Customer** | `src/utils/customer.ts` (new) | `C-<plate>-<plate>` | `C-XDN5R48-JQE6K43` |
| **2 — Asset** | `src/utils/asset.ts` (new) | `A-<plate>-<plate>` | `A-XDN5R48-JQE6K43` |
| **3 — Device** | `src/utils/device.ts` (extend existing) | `D-<TYPE>-<plate>-<plate>` | `D-3F-XDN5R48-JQE6K43` |

Where `<plate>` is the existing 7-char Mercosul plate produced by `generateMercosulPlate()` (alphabet without ambiguous `I/O/0/1`).

Each module is a **utility module, not a UI component** — it ships pure functions (and plain data maps) exported from `src/index.ts`. The naming follows the existing repo convention: a cohesive per-entity module named after the entity (`device.ts` already does this for device helpers), **not** a `*Utils` grab-bag and **not** a single-responsibility `*Code` file that would mislead once more helpers accrete. No React, no DOM, no hard-coded API hosts. The only network-touching helper (customer code uniqueness check) takes an injected config object, following the existing `BaseApiCfg` pattern used by the premium modals.

> This RFC is a forward-looking design document. **It does not implement anything.** Implementation is expected to follow phase by phase, each behind its own PR.

---

## Motivation

### Today the rules are duplicated and divergent

1. **Customer code** — `gcdr-frontend/src/pages/customers/CustomerForm.tsx` defines a private `generateCode(name)` that strips diacritics, drops Portuguese/English stopwords, upper-cases, and joins 5-char tokens with `-` (e.g. `"Central Pré-Setup"` → `CENTR-PRESE`). It is **name-derived**, human-readable, but:
   - not collision-resistant (two customers with similar names collide),
   - not idempotent across renames (rename → different code),
   - duplicated nowhere else, so other apps invent their own.

2. **Mercosul plate** — already ported into this library at `src/utils/device.ts` (`generateMercosulPlate`), but the *higher-level* codes that wrap it (`C-…`, `A-…`, `D-…`) live only in presetup-nextjs (`naming-rules.ts`, `AddItemModal.tsx`, `structure-builder.ts`) and in the GCDR backend (`woCode.ts` → `OS-<plate>`).

3. **Asset identifier** — presetup-nextjs has *two* different functions (`generateAssetIdentifier` for sync labels, `applyCustomerCodeToAssetName` for name prefixing) plus `ASSET_TYPE_CONFIG` (icon + color per asset type) duplicated in `gcdr-frontend/.../CustomerAssetsTab.tsx`.

4. **Device** — this library already has **five** device utility files (`deviceInfo.js`, `deviceItem.js`, `deviceStatus.js`, `deviceType.js`, `deviceTypeConfig.ts`). They overlap conceptually and there is no single "device code" grammar. Adding device-code logic without first clarifying these is how the confusion compounds.

### Goal

One authoritative, tested, framework-neutral home for **name → code** generation, shared by every MYIO front-end and consumable from ThingsBoard widgets via the UMD bundle. New apps import; they do not re-invent.

### Non-goals

- Changing already-issued codes in production data (codes are opaque and stable once minted).
- Owning *display name* formatting beyond what is needed to derive codes.
- Server-side enforcement of uniqueness (that stays in the GCDR API; this library only *checks* and *suggests*).

---

## Guide-level explanation

### The code grammar

A **plate** is the 7-character token from the existing generator:

```
format: L L L D L D D          (3 letters, 1 digit, 1 letter, 2 digits)
letters: A-Z without I, O      (24 symbols)
digits:  2-9 (without 0, 1)    (8 symbols)
example: XDN5R48
```

The three entity codes are plates with a 1-char entity prefix and (for device) a type token:

```
Customer:  C-<plate>-<plate>            e.g.  C-XDN5R48-JQE6K43
Asset:     A-<plate>-<plate>            e.g.  A-XDN5R48-JQE6K43
Device:    D-<TYPE>-<plate>-<plate>     e.g.  D-3F-XDN5R48-JQE6K43
```

> **Note on examples.** A device code like `D-3F-ABC1234-…` (seen in informal notes) is *illustrative only*; real plates never contain `0`, `1`, `I` or `O`, so a real device code looks like `D-3F-XDN5R48-JQE6K43`.

Why **two** plates per code? The double-plate space (~2.9 × 10¹⁶ combinations) makes accidental collisions effectively impossible while keeping codes short, copy-pasteable and visually distinct. It mirrors the GCDR work-order precedent (`OS-<plate>`) but with a wider keyspace for top-level entities.

### Phase 1 — Customer

```ts
import {
  generateCustomerCode,
  slugifyCustomerName,
  checkCustomerCodeAvailable,
  pickUniqueCustomerCode,
} from 'myio-js-library';

// Opaque, collision-resistant code (the new standard)
generateCustomerCode();              // "C-XDN5R48-JQE6K43"

// Legacy human-readable abbreviation (ported from gcdr generateCode), kept for
// display/suggestions only — NOT the authoritative code.
slugifyCustomerName('Shopping Pátio Central'); // "SHOPP-PATIO-CENTR"

// Verify against the GCDR API before saving (config injected, no hard-coded host)
await checkCustomerCodeAvailable('C-XDN5R48-JQE6K43', {
  baseUrl: 'https://gcdr.api.example',
  token: '...',
}); // => true (available) | false (taken)

// Generate-and-verify in one shot (retries on collision, like pickUniqueMercosul)
await pickUniqueCustomerCode({ baseUrl, token }); // "C-…-…" guaranteed free
```

### Phase 2 — Asset

```ts
import {
  generateAssetCode,
  ASSET_TYPE_CONFIG,
  getAssetTypeConfig,
  applyCustomerCodeToAssetName,
} from 'myio-js-library';

generateAssetCode();                 // "A-XDN5R48-JQE6K43"

// Framework-neutral asset-type metadata (icon NAME + color, never a React node)
getAssetTypeConfig('EQUIPMENT');     // { icon: 'Settings2', color: '#ef4444' }

// Name standardization: prefix an asset name with the customer's code
applyCustomerCodeToAssetName('Reservatório Geral', 'C-XDN5R48-JQE6K43');
// "C-XDN5R48-JQE6K43 Reservatório Geral"
```

### Phase 3 — Device

```ts
import { generateDeviceCode, deviceTypeToken } from 'myio-js-library';

deviceTypeToken('3F_MEDIDOR');       // "3F"
generateDeviceCode('3F_MEDIDOR');    // "D-3F-XDN5R48-JQE6K43"
```

Phase 3 also tidies the existing device-utility surface (`deviceInfo.js`, `deviceItem.js`, `deviceStatus.js`, `deviceType.js`, `deviceTypeConfig.ts`) so the device-code additions in `device.ts` have a clear, non-overlapping place to live. See "Reference-level explanation → Phase 3".

---

## Usage — consuming the library

These utilities ship from the published `myio-js-library` package (ESM + CJS +
UMD). Until this RFC's branch is merged to `desenv` and a new version is
published to npm, external apps cannot `npm install` them yet — inside this repo
(showcases, tests) they are importable from `src`/`dist` after a build.

### Import modes

```ts
// ESM / TypeScript (gcdr-frontend, presetup-nextjs, modern apps)
import { generateCustomerCode, generateAssetCode, generateDeviceCode } from 'myio-js-library';

// CommonJS
const { generateCustomerCode } = require('myio-js-library');
```

```html
<!-- UMD — ThingsBoard widget / plain <script> (no bundler) -->
<!-- exposes the global `window.MyIOLibrary` -->
<script>
  const code = window.MyIOLibrary.generateCustomerCode(); // "C-XDN5R48-JQE6K43"
</script>
```

### Customer code

```ts
import {
  generateCustomerCode,
  pickUniqueCustomerCode,
  checkCustomerCodeAvailable,
  slugifyCustomerName,
  isCustomerCode,
} from 'myio-js-library';

// 1) Offline, no API round-trip — fine for previews/suggestions:
generateCustomerCode();                          // "C-XDN5R48-JQE6K43"

// 2) Authoritative mint: generate → verify against GCDR → retry on collision.
//    No host is hard-coded; you inject baseUrl/token (token → "Authorization: Bearer ...").
const code = await pickUniqueCustomerCode({ baseUrl: 'https://gcdr.api.example', token: jwt });

// 3) Validate a code the user typed/pasted:
isCustomerCode('C-XDN5R48-JQE6K43');             // true
await checkCustomerCodeAvailable(code, { baseUrl, token }); // true = available

// 4) Readable name-derived suggestion (legacy gcdr generateCode — display only):
slugifyCustomerName('Shopping Pátio Central');   // "SHOPP-PATIO-CENTR"
```

Replacing gcdr's private `generateCode` in `CustomerForm.tsx`:

```tsx
// suggestion button:
onClick={() => setValue('code', slugifyCustomerName(watch('name')))}
// or mint the opaque, collision-checked standard:
onClick={async () => setValue('code', await pickUniqueCustomerCode({ baseUrl, token }))}
```

### Asset code + type icons

```ts
import { generateAssetCode, getAssetTypeConfig, applyCustomerCodeToAssetName } from 'myio-js-library';

generateAssetCode();                                         // "A-XDN5R48-JQE6K43"
applyCustomerCodeToAssetName('Reservatório Geral', custCode); // idempotent prefix
```

`ASSET_TYPE_CONFIG` / `getAssetTypeConfig` return the lucide **icon name** (a
string) plus a hex color — the library ships no React, so the consumer maps the
name to a component at the call site:

```tsx
import * as Lucide from 'lucide-react';

const cfg = getAssetTypeConfig('EQUIPMENT'); // { icon: 'Settings2', color: '#ef4444' }
const Icon = (Lucide as Record<string, React.FC<{ className?: string; style?: object }>>)[cfg.icon];
return <Icon className="h-4 w-4" style={{ color: cfg.color }} />;
```

### Device code

```ts
import { generateDeviceCode, deviceTypeToken } from 'myio-js-library';

deviceTypeToken('3F_MEDIDOR');       // "3F"
generateDeviceCode('3F_MEDIDOR');    // "D-3F-XDN5R48-JQE6K43"
generateDeviceCode('SW_ILUMINACAO'); // "D-SW-ILUMINACAO-..." (unmapped type → sanitized token)
```

### Exported surface

| Group | Primary functions | Helpers / constants / types |
|-------|-------------------|------------------------------|
| **Customer** (`utils/customer`) | `generateCustomerCode`, `pickUniqueCustomerCode`, `checkCustomerCodeAvailable`, `slugifyCustomerName` | `isCustomerCode`, `CUSTOMER_CODE_RE`, `CUSTOMER_NAME_STOPWORDS`, type `CodeCheckConfig` |
| **Asset** (`utils/asset`) | `generateAssetCode`, `getAssetTypeConfig`, `applyCustomerCodeToAssetName` | `isAssetCode`, `ASSET_CODE_RE`, `ASSET_TYPE_CONFIG`, `assetLocalToken`, types `AssetType` / `AssetTypeConfigEntry` |
| **Device** (`utils/device`) | `generateDeviceCode`, `deviceTypeToken` | `DEVICE_TYPE_CODE_TOKEN`, `DEFAULT_DEVICE_TYPE_TOKEN` (alongside existing `generateMercosulPlate`, `getDeviceTypePrefix`) |

---

## Reference-level explanation

### Framework-neutrality constraints (apply to all phases)

`myio-js-library` ships ESM + CJS + UMD and is consumed inside ThingsBoard widgets with **no React runtime**. Therefore:

1. **No React/DOM imports** in any of these modules.
2. `ASSET_TYPE_CONFIG` stores **icon identifiers as strings** (the `lucide-react` export name) plus a hex color — never the icon component. Consumers map the string to their own icon set:
   ```ts
   // lib (neutral)
   ASSET_TYPE_CONFIG.EQUIPMENT === { icon: 'Settings2', color: '#ef4444' }
   // gcdr-frontend (React) maps name → component at the call site
   const Icon = LUCIDE[cfg.icon];
   ```
3. **No hard-coded API hosts.** The only network helper (`checkCustomerCodeAvailable`) receives a config object compatible with the premium-modals `BaseApiCfg` (`{ baseUrl, token }` and optionally an injected `fetch`).
4. Pure, deterministic functions are unit-tested in `tests/utils/` (the plate generator is already covered in `tests/utils/device.test.ts`).

### Module layout

```
src/utils/
  device.ts            (existing) generateMercosulPlate, getDeviceTypePrefix, … → Phase 3 adds deviceTypeToken, generateDeviceCode here
  deviceTypeConfig.ts  (existing) DEVICE_TYPE_CONFIG, getDeviceCategory, …
  customer.ts          (Phase 1, new) — customer code + name helpers
  asset.ts             (Phase 2, new) — asset code + type config + name helpers
```

Naming rationale: `customer.ts` / `asset.ts` mirror the existing `device.ts`, which already groups several device helpers under the entity name. This keeps the door open for further per-entity helpers (validation, formatting, defaults) without renaming, and avoids both the `*Utils` grab-bag and the too-narrow `*Code` file name. Phase 3 needs **no new file** — the device-code functions live in the existing `device.ts` next to `generateMercosulPlate`/`getDeviceTypePrefix`.

`src/index.ts` re-exports each module under a grouped, RFC-tagged comment, matching the current convention:

```ts
// Customer utilities (RFC-0206, Phase 1)
export {
  generateCustomerCode,
  slugifyCustomerName,
  checkCustomerCodeAvailable,
  pickUniqueCustomerCode,
} from './utils/customer';
export type { CodeCheckConfig } from './utils/customer';
```

### Phase 1 — `customer.ts`

Proposed public surface (signatures are illustrative, not an implementation):

```ts
/** Opaque customer code: "C-<plate>-<plate>". */
export function generateCustomerCode(): string;

/**
 * Legacy name-derived abbreviation, ported verbatim from gcdr's generateCode:
 * NFD-strip diacritics → drop stopwords → UPPER → 5-char tokens joined by '-'.
 * Provided for display/suggestions and backward compatibility, NOT as the
 * authoritative code. Stopword set is exported so apps can extend it.
 */
export function slugifyCustomerName(name: string): string;
export const CUSTOMER_NAME_STOPWORDS: ReadonlySet<string>;

export interface CodeCheckConfig {
  baseUrl: string;
  token?: string;
  fetch?: typeof fetch;        // injectable for non-browser / test contexts
  signal?: AbortSignal;
}

/** true if no existing customer carries this exact code. */
export function checkCustomerCodeAvailable(
  code: string,
  cfg: CodeCheckConfig,
): Promise<boolean>;

/** generate → check → retry (bounded, e.g. 256 attempts) until a free code is found. */
export function pickUniqueCustomerCode(cfg: CodeCheckConfig): Promise<string>;
```

**Uniqueness check — API contract.** The GCDR API has **no dedicated code-availability endpoint today**. `customerService` exposes `GET /customers` with a `search` param and there is a `GET /wo/customers/by-code/:code` precedent. Two viable strategies, to be settled with backend (see Unresolved questions):

- **A (no backend change):** `GET /customers?search=<code>&limit=…`, then client-side exact-match on `code`. Simple, but `search` is fuzzy and paginated.
- **B (recommended, backend adds it):** `GET /customers/check-code?code=<code>` → `{ available: boolean }`, or `HEAD /customers/by-code/:code` (404 = available). Authoritative and O(1).

`checkCustomerCodeAvailable` should be written so the strategy is an internal detail; callers only see `Promise<boolean>`.

### Phase 2 — `asset.ts`

```ts
/** Opaque asset code: "A-<plate>-<plate>". */
export function generateAssetCode(): string;

export type AssetType = 'LOCATION' | 'BUILDING' | 'FLOOR' | 'ROOM' | 'EQUIPMENT' | 'OTHER';

export interface AssetTypeConfigEntry {
  icon: string;   // lucide-react export name, e.g. 'Settings2'
  color: string;  // hex, e.g. '#ef4444'
}

/** Framework-neutral mirror of gcdr's CustomerAssetsTab ASSET_TYPE_CONFIG. */
export const ASSET_TYPE_CONFIG: Record<AssetType, AssetTypeConfigEntry>;
export function getAssetTypeConfig(type: string): AssetTypeConfigEntry; // OTHER fallback

/** Prefix an asset name with a customer code (standardization), idempotent. */
export function applyCustomerCodeToAssetName(assetName: string, customerCode: string): string;

/** Extract the local token of an asset name (inverse helper, for re-standardization). */
export function assetLocalToken(assetName: string): string;
```

Canonical `ASSET_TYPE_CONFIG` values (mirrored from gcdr, components replaced by names):

```ts
LOCATION:  { icon: 'MapPin',     color: '#3b82f6' }
BUILDING:  { icon: 'Building2',  color: '#8b5cf6' }
FLOOR:     { icon: 'Layers',     color: '#f59e0b' }
ROOM:      { icon: 'DoorOpen',   color: '#10b981' }
EQUIPMENT: { icon: 'Settings2',  color: '#ef4444' }
OTHER:     { icon: 'Box',        color: '#6b7280' }
```

> Note: presetup-nextjs `generateAssetIdentifier(asset, customerName, parentPath?)` (hierarchy-prefixed *sync label*) is a **different** concern from the opaque `A-<plate>-<plate>` code. Phase 2 standardizes the opaque code + the type config + name prefixing. Whether the hierarchy-based sync identifier also moves into the library is deferred (Future possibilities), because it is tightly coupled to the presetup import pipeline.

### Phase 3 — device code in `device.ts` (+ device-utils cleanup)

Device code grammar embeds an uppercase **type token**. These functions are added to the **existing** `src/utils/device.ts` (no new file), next to `generateMercosulPlate` and `getDeviceTypePrefix`:

```ts
/** Short uppercase, hyphen-safe token for the device code, e.g. "3F_MEDIDOR" → "3F". */
export function deviceTypeToken(deviceType: string): string;

/** Device code: "D-<TYPE>-<plate>-<plate>", e.g. "D-3F-XDN5R48-JQE6K43". */
export function generateDeviceCode(deviceType: string): string;
```

`deviceTypeToken` is **distinct** from the existing `getDeviceTypePrefix` (which returns a human *name* prefix like `'3F COMP.'`). The code token is a compact uppercase taxonomy key. Its exact mapping table must be reconciled with `DEVICE_TYPE_CONFIG` and the device taxonomy — which is exactly why Phase 3 is gated behind a cleanup of the overlapping device utilities:

- `deviceType.js` — type *detection* from raw strings.
- `deviceTypeConfig.ts` — type → `{ category, image }`.
- `device.ts` — `DEVICE_TYPE_PREFIX_MAP`, `getDeviceTypePrefix` (name prefixes); **gains** `deviceTypeToken` + `generateDeviceCode` in Phase 3.
- `deviceInfo.js` / `deviceItem.js` / `deviceStatus.js` — orthogonal (domain/context, item factory, status).

Phase 3 should (a) document the responsibility of each file, (b) decide where the **type-token table** lives (likely alongside `DEVICE_TYPE_CONFIG` as the single source), and only then (c) add the device-code functions to `device.ts`. No device-code work should land before that reconciliation.

### Testing

Each phase adds tests under `tests/utils/` (`customer.test.ts`, `asset.test.ts`, and additions to the existing `device.test.ts`):
- Grammar/format assertions (regex `^C-[A-HJ-NP-Z2-9]{3}\d…$` style, adapted to the no-`I/O/0/1` alphabet).
- Determinism of `slugifyCustomerName` / `applyCustomerCodeToAssetName` (idempotency).
- `checkCustomerCodeAvailable` / `pickUniqueCustomerCode` with an injected `fetch` mock (no real network).

---

## Phased delivery plan

| Phase | Scope | Depends on | Exit criteria |
|-------|-------|-----------|----------------|
| **1 — Customer** | `customer.ts` + exports + tests; uniqueness-check contract agreed with backend | existing `generateMercosulPlate` | `generateCustomerCode`, `slugifyCustomerName`, `checkCustomerCodeAvailable`, `pickUniqueCustomerCode` exported & tested; gcdr `CustomerForm` can import `slugifyCustomerName` to replace its private `generateCode` |
| **2 — Asset** | `asset.ts` + `ASSET_TYPE_CONFIG` (icon-name form) + name-prefix helpers + tests | Phase 1 (shared plate plumbing) | gcdr `CustomerAssetsTab` can import `ASSET_TYPE_CONFIG`/`getAssetTypeConfig`; `generateAssetCode`, `applyCustomerCodeToAssetName` exported & tested |
| **3 — Device** | device-utils responsibility doc + type-token table location decided + device-code added to existing `device.ts` + tests | Phases 1–2 + device-utils cleanup | `deviceTypeToken`, `generateDeviceCode` exported & tested; no regressions in the 5 existing device utils |

Each phase is an independent PR into `desenv`. Phases do not block production data; they are additive.

---

## Drawbacks

- **Two parallel "code" concepts for customers** (opaque `C-<plate>-<plate>` vs. legacy readable `slugifyCustomerName`) can confuse consumers. Mitigation: documentation is explicit that the plate-based code is authoritative and the slug is display/suggestion-only.
- **`ASSET_TYPE_CONFIG` as icon *names*** pushes a small mapping burden onto React consumers (string → component). This is the price of framework-neutrality; the alternative (shipping React) is worse for the UMD/TB target.
- **Uniqueness check depends on a backend contract that does not exist yet.** Phase 1 cannot be fully "done" until strategy A or B is agreed. Phase 1 can ship the pure generators first and the check second.
- **Phase 3 is partly a cleanup of pre-existing debt** (5 overlapping device files). Scope can creep; the RFC deliberately gates device-code work behind a small, documented reconciliation rather than a full refactor.

---

## Rationale and alternatives

- **Why double-plate, not single?** A single plate (~1.7 × 10⁸) is fine for work orders but thin for top-level Customer/Asset identity across the whole MYIO fleet. Double-plate is still short and removes collision anxiety.
- **Why keep the name-derived slug at all?** Operators like readable suggestions while typing (`Wand2` button in `CustomerForm`). Porting it preserves that UX while making the *stored* code opaque and stable.
- **Why utility modules, not "components"?** The library's `src/utils/` already houses framework-neutral logic (`deviceTypeConfig.ts`, `device.ts`). Calling these "components" (as in the original request) would imply React; in this library they are modules of pure functions + data maps. This keeps them usable from ThingsBoard widgets.
- **Alternative: a single `naming.ts` for all three.** Rejected — Customer/Asset/Device have different prefixes, different consumers, and Phase 3 needs the device-taxonomy reconciliation. Three small modules keep each phase shippable and the blast radius small.

---

## Prior art

- `src/utils/device.ts` — `generateMercosulPlate` already lives here (ported from presetup/data-ingestion `naming-rules.ts`); this RFC builds the higher-level grammar on top.
- presetup-nextjs `src/lib/naming-rules.ts` — `pickUniqueMercosul(taken)` (256-attempt collision avoidance) is the model for `pickUniqueCustomerCode`; `applyCustomerCodeToAssetName` / `assetLocalToken` are ported in Phase 2.
- GCDR backend `gcdr/src/services/work-orders/woCode.ts` — `OS-<plate>` is the existing single-plate precedent.
- RFC-0200 (`deviceIcons`) — precedent for "consolidate duplicated config maps into a shared, framework-neutral export".

---

## Unresolved questions

1. **Customer code-check endpoint** — strategy A (`GET /customers?search=`) vs. B (new `GET /customers/check-code` / `HEAD /customers/by-code/:code`). Needs backend agreement. (Blocks the `checkCustomerCodeAvailable` part of Phase 1, not the generators.)
2. **Device type-token table** — does the token derive from `deviceType`, `deviceProfile`, or a new explicit map? Where does it live (inside `DEVICE_TYPE_CONFIG` or a sibling)? Resolve during the Phase 3 device-utils reconciliation.
3. **Asset sync identifier** — should presetup's hierarchy-based `generateAssetIdentifier` move into the library too, or stay coupled to the import pipeline? (Leaning: stay, for now.)
4. **Migration of existing readable codes** — production customers currently hold readable codes (e.g. `CENTR-PRESE`). Do we keep them and only mint plate-codes for *new* entities (recommended), or backfill? Backfill is out of scope here.
5. **Icon-name coupling** — `ASSET_TYPE_CONFIG` uses `lucide-react` names. If a consumer uses a different icon set, it must maintain its own name map. Acceptable?

---

## Future possibilities

- A generic `pickUnique<T>(generate, isTaken, attempts)` helper shared by customer/asset/device/work-order code minting.
- Move presetup's hierarchy-aware `generateAssetIdentifier` and `computeNewName` (mercosul re-standardization, `extractMercosulPlate`) into the library as a Phase 4, unifying the import pipeline's naming with this grammar.
- A tiny `@myio/icons` name→component adapter for React consumers, so `ASSET_TYPE_CONFIG.icon` resolves without per-app boilerplate.
- Extend the grammar to other top-level entities (e.g. `G-<plate>` for gateways/centrals) under the same generator.
```
