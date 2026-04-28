# RFC-0200 — `deviceIcons`: Shared Device-Type Image Map

- **Status**: Draft — Design In Progress
- **Date**: 2026-04-27
- **Author**: MYIO Engineering
- **Related**: RFC-0111 (Device domain/context classification), RFC-0128 (Energy
  equipment subcategorization), RFC-0175 (Solenoid devices)
- **Inspired by**: `myio-app-5.2.0/src/core/devices/icons.ts` (mobile app)

---

## Summary

Introduce a single, library-public `deviceIcons` utility module
(`src/utils/deviceIcons.ts`) that exposes the canonical mapping from
**device-type identifiers** (e.g. `FANCOIL`, `HIDROMETRO`, `TERMOSTATO`) to
**static image URLs**, plus Portuguese display labels and a small set of
helpers (`getDeviceIcon`, `isDeviceIconType`, `DEFAULT_DEVICE_ICON`).

The module mirrors the shape of the mobile app's `core/devices/icons.ts`
(enum-like keys, `Record`-typed maps, type guard, URL accessor) so that the
two codebases can converge over time, while keeping the library's existing
asset host (`dashboard.myio-bas.com/api/images/public/<token>`) for now —
migration to GCDR slug-based URLs is a follow-up RFC.

The utility is exported from `src/index.ts` so it ships in every distribution
format (ESM, CJS, UMD via unpkg) and is consumable by ThingsBoard widgets,
showcase pages, and external integrations.

---

## Motivation

The same device-type → image URL dictionary is currently **duplicated across
at least four locations** in the library, with subtle drift between copies:

| File | Symbol | Notes |
|---|---|---|
| `src/components/template-card-v6/template-card-v6.js:53` | `DEVICE_TYPE_CONFIG` | Adds a `category` field per type; full set, includes solenoid |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/card/template-card-v5.js:49` | `DEVICE_TYPE_CONFIG` | Near-clone of v6's; risks drift |
| `src/components/premium-modals/settings/SettingsModalView.ts:990` | `IMAGES` (private const inside `getDeviceImage`) | Subset of types; no category |
| `src/legacy-spec/legacy-controller.js:63` | `getDeviceImage` (label-based, not type-based) | Legacy, different lookup key |

Plus several `getDeviceIcon` functions that return **emojis** (not URLs) used by
tooltips and modals — different concern, kept out of scope.

Consequences of the current state:

1. **Adding a new device type** (e.g. `BOMBA_ESGOTO`) requires editing 4 files
   and remembering they exist.
2. **Updating an existing URL** (rebrand, image-host migration) is impossible
   to do safely in one place.
3. **External consumers of the library** (ThingsBoard widgets via UMD,
   third-party integrators) have **no public API** to ask "what is the icon
   for `FANCOIL`?" — they must inline their own copy or scrape the rendered
   HTML.
4. The mobile app already converged on a clean module
   (`core/devices/icons.ts`); the library is the only ecosystem that hasn't.

## Guide-Level Explanation

The utility follows the same pattern as the existing
`src/utils/deviceStatus.js` neighbor, which exposes status-emoji maps:

| `deviceStatus.js` (existing) | `deviceIcons.ts` (proposed) |
|---|---|
| `DeviceStatusType` (string-const enum) | `DeviceIconType` |
| `deviceStatusIcons` (status → emoji) | `deviceIcons` (type → URL) |
| `getDeviceStatusIcon(status, type?)` | `getDeviceIcon(type)` |
| `isValidDeviceStatus(s)` | `isDeviceIconType(t)` |
| — | `deviceIconLabels` (UI-friendly Portuguese labels) |
| — | `DEFAULT_DEVICE_ICON` (fallback URL) |

### Example consumer code

**ESM / TypeScript:**

```ts
import {
  DeviceIconType,
  deviceIcons,
  deviceIconLabels,
  getDeviceIcon,
  isDeviceIconType,
} from 'myio-js-library';

const url = getDeviceIcon('FANCOIL');
// → 'https://dashboard.myio-bas.com/api/images/public/4BWMuVIFHnsfqatiV86DmTrOB7IF0X8Y'

const label = deviceIconLabels[DeviceIconType.HIDROMETRO];
// → 'Hidrômetro'

if (isDeviceIconType(maybeType)) {
  // narrowed to DeviceIconType
}
```

**UMD (ThingsBoard widget, `<script>` tag, unpkg):**

```html
<script src="https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"></script>
<script>
  const url = MyIOLibrary.getDeviceIcon('TERMOSTATO');
  const map = MyIOLibrary.deviceIcons;
  const label = MyIOLibrary.deviceIconLabels.CHILLER; // "Chiller"
</script>
```

**Inside the library (consolidating the four copies):**

```ts
// Before — template-card-v6.js, template-card-v5.js, SettingsModalView.ts each
// keep their own copy.
const IMAGES = { ESCADA_ROLANTE: '...', ELEVADOR: '...', ... };

// After
import { getDeviceIcon } from '../../utils/deviceIcons';
const imageUrl = getDeviceIcon(deviceType);
```

---

## Reference-Level Explanation

### File layout

```
src/utils/deviceIcons.ts          # NEW — single source of truth
src/index.ts                      # adds public re-export block
```

### Module surface

```ts
// src/utils/deviceIcons.ts

/**
 * Canonical device-type identifiers used as image keys.
 * Values match the strings emitted by ThingsBoard `deviceType` /
 * `deviceProfile` attributes (uppercase, snake_case where applicable).
 *
 * NOTE: this mirrors `myio-app-5.2.0/src/core/devices/icons.ts::DeviceIcon`.
 * Keep both in sync when adding new types.
 */
export const DeviceIconType = {
  ESCADA_ROLANTE: 'ESCADA_ROLANTE',
  ELEVADOR: 'ELEVADOR',
  MOTOR: 'MOTOR',
  BOMBA_HIDRAULICA: 'BOMBA_HIDRAULICA',
  BOMBA_CAG: 'BOMBA_CAG',
  BOMBA_INCENDIO: 'BOMBA_INCENDIO',
  BOMBA: 'BOMBA',
  MEDIDOR_3F: '3F_MEDIDOR',
  RELOGIO: 'RELOGIO',
  ENTRADA: 'ENTRADA',
  SUBESTACAO: 'SUBESTACAO',
  FANCOIL: 'FANCOIL',
  CHILLER: 'CHILLER',
  HIDROMETRO: 'HIDROMETRO',
  HIDROMETRO_AREA_COMUM: 'HIDROMETRO_AREA_COMUM',
  HIDROMETRO_SHOPPING: 'HIDROMETRO_SHOPPING',
  CAIXA_DAGUA: 'CAIXA_DAGUA',
  TERMOSTATO: 'TERMOSTATO',
} as const;

export type DeviceIconType =
  typeof DeviceIconType[keyof typeof DeviceIconType];

/** Static URL map (current opaque-token strategy). */
export const deviceIcons: Record<DeviceIconType, string> = {
  ESCADA_ROLANTE:        'https://dashboard.myio-bas.com/api/images/public/EJ997iB2HD1AYYUHwIloyQOOszeqb2jp',
  ELEVADOR:              'https://dashboard.myio-bas.com/api/images/public/rAjOvdsYJLGah6w6BABPJSD9znIyrkJX',
  MOTOR:                 'https://dashboard.myio-bas.com/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT',
  BOMBA_HIDRAULICA:      'https://dashboard.myio-bas.com/api/images/public/rbO2wQb6iKBtX0Ec04DFDcO3Qg04EOoD',
  BOMBA_CAG:             'https://dashboard.myio-bas.com/api/images/public/rbO2wQb6iKBtX0Ec04DFDcO3Qg04EOoD',
  BOMBA_INCENDIO:        'https://dashboard.myio-bas.com/api/images/public/YJkELCk9kluQSM6QXaFINX6byQWI7vbB',
  BOMBA:                 'https://dashboard.myio-bas.com/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT',
  '3F_MEDIDOR':          'https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k',
  RELOGIO:               'https://dashboard.myio-bas.com/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB',
  ENTRADA:               'https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU',
  SUBESTACAO:            'https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU',
  FANCOIL:               'https://dashboard.myio-bas.com/api/images/public/4BWMuVIFHnsfqatiV86DmTrOB7IF0X8Y',
  CHILLER:               'https://dashboard.myio-bas.com/api/images/public/27Rvy9HbNoPz8KKWPa0SBDwu4kQ827VU',
  HIDROMETRO:            'https://dashboard.myio-bas.com/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4',
  HIDROMETRO_AREA_COMUM: 'https://dashboard.myio-bas.com/api/images/public/IbEhjsvixAxwKg1ntGGZc5xZwwvGKv2t',
  HIDROMETRO_SHOPPING:   'https://dashboard.myio-bas.com/api/images/public/OIMmvN4ZTKYDvrpPGYY5agqMRoSaWNTI',
  CAIXA_DAGUA:           'https://dashboard.myio-bas.com/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq',
  TERMOSTATO:            'https://dashboard.myio-bas.com/api/images/public/rtCcq6kZZVCD7wgJywxEurRZwR8LA7Q7',
};

/** Friendly Portuguese labels for UI rendering (pickers, tooltips, captions). */
export const deviceIconLabels: Record<DeviceIconType, string> = {
  ESCADA_ROLANTE:        'Escada Rolante',
  ELEVADOR:              'Elevador',
  MOTOR:                 'Motor',
  BOMBA_HIDRAULICA:      'Bomba Hidráulica',
  BOMBA_CAG:             'Bomba CAG',
  BOMBA_INCENDIO:        'Bomba Incêndio',
  BOMBA:                 'Bomba',
  '3F_MEDIDOR':          'Medidor 3F',
  RELOGIO:               'Relógio',
  ENTRADA:               'Entrada',
  SUBESTACAO:            'Subestação',
  FANCOIL:               'Fancoil',
  CHILLER:               'Chiller',
  HIDROMETRO:            'Hidrômetro',
  HIDROMETRO_AREA_COMUM: 'Hidrômetro Área Comum',
  HIDROMETRO_SHOPPING:   'Hidrômetro Shopping',
  CAIXA_DAGUA:           "Caixa d'Água",
  TERMOSTATO:            'Termostato',
};

/** Default fallback URL when type is unknown or not yet mapped. */
export const DEFAULT_DEVICE_ICON =
  'https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k'; // generic 3F_MEDIDOR

/**
 * Resolves the static image URL for a given device type string.
 * Lookup is case-insensitive on the input; the canonical keys are uppercase.
 *
 * @param deviceType - typically `ctx.data` deviceType or deviceProfile attribute
 * @returns the mapped URL, or `DEFAULT_DEVICE_ICON` when not recognised
 */
export function getDeviceIcon(deviceType?: string | null): string {
  const key = String(deviceType || '').toUpperCase();
  return (deviceIcons as Record<string, string>)[key] ?? DEFAULT_DEVICE_ICON;
}

/** Type guard — narrows an arbitrary string to `DeviceIconType` if valid. */
export function isDeviceIconType(value: string): value is DeviceIconType {
  return value.toUpperCase() in deviceIcons;
}
```

### Public re-export

In `src/index.ts`, between the existing `deviceStatus` block (lines 73–96)
and the `Device Item Factory` block (line 98):

```ts
// Device Icons utilities (RFC-0200)
export {
  DeviceIconType,
  deviceIcons,
  deviceIconLabels,
  DEFAULT_DEVICE_ICON,
  getDeviceIcon,
  isDeviceIconType,
} from './utils/deviceIcons';
```

The `tsup --dts` pipeline picks the `.ts` source up automatically; no change
to `tsup.config.ts`, `rollup.config.mjs`, or `package.json` is required.

### Bundle-size impact

Estimated ESM/CJS delta: **~3.2 KB** (uncompressed), **~900 B** (gzipped).
Comfortably within the 50 KB / 60 KB / 25 KB / 26 KB limits enforced by
`scripts/size-check.js` and `scripts/check-bundle-size.mjs`.

### Testing

A new unit test file at `tests/utils/deviceIcons.test.ts` covers:

1. Every `DeviceIconType` key has a corresponding `deviceIcons` URL and
   `deviceIconLabels` entry (no orphan keys in either map).
2. `getDeviceIcon` is case-insensitive (`'fancoil'`, `'FANCOIL'`, `'Fancoil'`
   all resolve identically).
3. `getDeviceIcon` falls back to `DEFAULT_DEVICE_ICON` for `null`,
   `undefined`, `''`, and unknown strings.
4. `isDeviceIconType` correctly narrows valid strings and rejects invalid
   ones.
5. `'3F_MEDIDOR'` (the only key with a digit prefix) round-trips through the
   case-insensitive normalisation.

---

## Design Decisions (resolved 2026-04-27)

| # | Question | Decision |
|---|---|---|
| 1 | URL strategy: GCDR slugs (mobile app) vs. legacy opaque tokens (lib) | **Legacy tokens for now.** Migration to GCDR slugs is a follow-up RFC — see *Future Possibilities*. |
| 2 | File format: `.ts` or `.js` with JSDoc | **`.ts`** — better aligns with the rest of `src/components/` and the mobile-app reference; `tsup` handles the build transparently. |
| 3 | Scope: ship the util only, or also migrate the four duplicate consumers | **Util only** in this RFC. Consumer migration is a follow-up refactor PR — keeps blast radius small and risk obvious. |
| 4 | Dynamic icons (TANK by level, TERMOSTATO by status, SOLENOIDE on/off) | **Out of scope.** This RFC delivers the *static* map only. Dynamic resolvers stay in `template-card-v6.js::getDeviceImageUrl` for now, and may be folded in a later RFC. |
| 5 | Categories (`energy`/`water`/`tank`/`temperature`/`solenoid`) | **Out of scope.** The mobile-app reference has no categories; replicating the simpler shape now keeps the surface minimal. The library's `DEVICE_TYPE_CONFIG` keeps its category metadata privately. |

---

## Drawbacks

1. **Duplication remains until follow-up refactor.** This RFC adds a fifth
   copy of the same URL map (the new `deviceIcons.ts`) without removing the
   existing four. The intermediate state is *worse* than today until the
   migration PR lands. Mitigation: schedule the consumer-migration PR
   immediately after this RFC's PR merges.

2. **Public API stability commitment.** Once `deviceIcons` is exported via
   `src/index.ts`, removing or renaming a key is a breaking change for UMD
   consumers (ThingsBoard widgets, third-party integrations). This commits
   the library to the current device-type taxonomy.

3. **No image-host indirection.** The map embeds full URLs (host + path).
   When the asset host changes (rebrand, CDN move, GCDR migration), every
   consumer that cached the URLs must be re-rendered. A slug-based builder
   (`getDeviceIconUrl(DeviceIcon.FANCOIL)` like the mobile app) defers the
   host concern to runtime, but adds one decoding layer for every read.

4. **`'3F_MEDIDOR'` is not a valid TypeScript identifier.** Keeps the const
   workable but means the key must be quoted (`'3F_MEDIDOR'`) wherever it
   appears, including in `Record<DeviceIconType, …>` declarations. The
   mobile app sidesteps this by using `MEDIDOR_3F` as the *enum identifier*
   while keeping `'3F_MEDIDOR'` as the *value*. We adopt the same trick.

---

## Rationale and Alternatives

### Alternative A — Migrate to GCDR slug-based URLs now

Mirror the mobile app's
`https://gcdr-api.a.myio-bas.com/api/v1/public/files/by-slug/device-icons/<slug>?redirect=true`
pattern in this RFC.

**Pros:** semantically clean URLs, single backend for icons across web + mobile,
makes future renames trivial.

**Cons:** requires a backend audit to confirm every device-icon slug exists in
GCDR; changes the host visible to in-the-wild ThingsBoard widgets, which may
have whitelist-based CSP or proxy rules tied to `dashboard.myio-bas.com`;
breaks browser asset cache for currently-rendered dashboards. **Not chosen** —
deferred to a dedicated RFC where the backend dependency can be tracked
explicitly.

### Alternative B — JavaScript with JSDoc instead of TypeScript

Match the existing `src/utils/deviceStatus.js` neighbor.

**Pros:** consistency inside `src/utils/`.

**Cons:** the `Record<DeviceIconType, string>` type and the const-as-const
enum pattern are far cleaner in TS; the rest of the library (premium-modals,
components, services) is `.ts`-dominant. **Not chosen.**

### Alternative C — Single object with all metadata per type

Replicate the existing `DEVICE_TYPE_CONFIG` shape from `template-card-v6.js`:

```ts
export const deviceIcons: Record<DeviceIconType, {
  url: string;
  label: string;
  category: 'energy' | 'water' | 'temperature' | 'tank' | 'solenoid';
}> = { ... };
```

**Pros:** one lookup; categories, labels, URL all in one place.

**Cons:** diverges from the mobile-app `Record<DeviceIcon, string>` shape;
forces consumers that only need URL to destructure; couples three concerns
that may evolve at different rates. **Not chosen** — three separate
`Record<DeviceIconType, X>` maps are simpler and trivially mergeable later
if needed.

### Alternative D — Ship `getDeviceIconDynamic(type, opts)` in this RFC

Include the dynamic-resolution helpers (TANK by water level, TERMOSTATO by
above/below/ok status, SOLENOIDE by on/off) as part of `deviceIcons.ts`.

**Pros:** consolidates the entire `getDeviceImageUrl` logic.

**Cons:** the dynamic logic depends on RFC-0175 (solenoid status) and
percentage/temperature inputs that callers must supply correctly; broader
surface and broader risk. **Not chosen** — keep this RFC scoped to the
zero-input static lookup. Dynamic resolution is a separate RFC.

---

## Prior Art

- **Mobile app (`myio-app-5.2.0`)** — `core/devices/icons.ts` is the direct
  inspiration. This RFC adopts the same shape (enum + `Record` maps + type
  guard + URL accessor) deliberately, so a future "shared core" extraction
  is mechanical.
- **Material Icons / Heroicons** — both ship a frozen enum of icon names
  plus runtime resolvers; informs the decision to keep `DeviceIconType` as
  the canonical identifier rather than an arbitrary string.
- **`src/utils/deviceStatus.js`** — internal precedent for "library-public,
  type-keyed, image/emoji map" shape. We mirror its export style, naming,
  and `index.ts` placement.

---

## Unresolved Questions

1. **Should `solenoidDeviceStatusIcons` be re-exported as well?** It exists
   in `deviceStatus.js` (line 94) but is *not* re-exported in `index.ts`,
   so it's invisible to UMD consumers. This is unrelated to RFC-0200 but
   the same review surfaced it. Suggested fix: a one-line addition to
   `index.ts`, possibly bundled with this RFC's PR.

2. **Should `package.json::exports.types` be corrected?** Currently points
   at `dist/index.d.ts` (a 15-line placeholder); the real types are at
   `dist/index.d.cts`. TypeScript consumers that resolve via `exports.types`
   see no types. Out of scope for RFC-0200 but worth fixing in the same PR.

3. **`MEDIDOR_3F` vs `'3F_MEDIDOR'`** — should we use the mobile-app
   convention of two distinct identifiers (enum key `MEDIDOR_3F`, value
   `'3F_MEDIDOR'`), or accept the quoted-key `'3F_MEDIDOR': '3F_MEDIDOR'`?
   Default position: follow the mobile app (cleaner consumer code).

4. **Documentation link** — should the README or onboarding doc mention this
   utility, or rely on TS-DocBlocks alone?

---

## Future Possibilities

- **RFC-0201 (proposed): `deviceIcons` migration to GCDR slug URLs.** Rewires
  the URL builder to `https://gcdr-api.a.myio-bas.com/api/v1/public/files/by-slug/device-icons/<slug>?redirect=true`,
  introduces `DEVICE_ICON_SLUGS`, and ships a `getDeviceIconUrl(icon)`
  resolver. Requires backend audit; existing `deviceIcons` map becomes a
  pre-computed `Object.fromEntries(... map(getDeviceIconUrl) ...)` derived
  constant.

- **RFC-0202 (proposed): Consumer migration.** Replaces `DEVICE_TYPE_CONFIG`
  in `template-card-v5.js` and `template-card-v6.js`, the `IMAGES` const in
  `SettingsModalView.ts`, and the legacy `getDeviceImage` in
  `legacy-spec/legacy-controller.js` with imports from
  `myio-js-library/utils/deviceIcons`. Removes ~120 LOC of duplication.

- **RFC-0203 (proposed): Dynamic icon resolver.** Lifts the
  `getDeviceImageUrl(type, percentage, opts)` helper out of
  `template-card-v6.js` into the public API. Adds TANK/TERMOSTATO/SOLENOIDE
  branching with strongly typed `opts`.

- **Shared icon catalog component**: a Storybook-style showcase page under
  `showcase/` that renders every `DeviceIconType` next to its label and URL,
  for product / design review.

- **Tree-shakable variant**: split each map into its own micro-module so
  consumers that only need `deviceIconLabels` don't pull URL data. Probably
  unnecessary given the small fixed size; reconsider only if the type set
  grows past ~50.

---

## Appendix A — Mobile App Reference

For convenience, the original mobile-app file
(`myio-app-5.2.0/src/core/devices/icons.ts`) is reproduced below. **Do not
edit this section** — it is a snapshot for cross-codebase review.

```ts
export enum DeviceIcon {
  ESCADA_ROLANTE = 'ESCADA_ROLANTE',
  ELEVADOR = 'ELEVADOR',
  // ... (full enum, 18 entries)
  TERMOSTATO = 'TERMOSTATO',
}

export const DEVICE_ICON_SLUGS: Record<DeviceIcon, string> = {
  [DeviceIcon.ESCADA_ROLANTE]: 'escada-rolante',
  // ...
};

export const DEVICE_ICON_LABELS: Record<DeviceIcon, string> = {
  [DeviceIcon.ESCADA_ROLANTE]: 'Escada Rolante',
  // ...
};

export function getDeviceIconUrl(icon: DeviceIcon): string {
  return `https://gcdr-api.a.myio-bas.com/api/v1/public/files/by-slug/device-icons/${DEVICE_ICON_SLUGS[icon]}?redirect=true`;
}

export const DEVICE_ICON_URLS: Record<DeviceIcon, string> = Object.fromEntries(
  (Object.keys(DEVICE_ICON_SLUGS) as DeviceIcon[]).map((key) => [key, getDeviceIconUrl(key)]),
) as Record<DeviceIcon, string>;

export function isDeviceIcon(value: string): value is DeviceIcon {
  return Object.values(DeviceIcon).includes(value as DeviceIcon);
}
```

The library version differs in:

- **No `enum`** — uses `as const` because `enum` interacts awkwardly with
  the JS files in the library that consume the module without a TS compile
  step.
- **No `getDeviceIconUrl(icon)`** — the URLs are stored directly, since we
  retain the legacy opaque-token host. The slug-based builder is reserved
  for a future RFC.
- **Pluralisation** — uses `deviceIcons` / `deviceIconLabels` (camelCase,
  matches `deviceStatusIcons` neighbor) instead of `DEVICE_ICON_URLS` /
  `DEVICE_ICON_LABELS` (SCREAMING_SNAKE).

---

## Appendix B — Change List

| Path | Change |
|---|---|
| `src/utils/deviceIcons.ts` | **Create** — new module per *Reference-Level Explanation* |
| `src/index.ts` | **Edit** — append public re-export block (~10 lines) |
| `tests/utils/deviceIcons.test.ts` | **Create** — unit tests per *Testing* |
| `src/docs/rfcs/RFC-0200-DeviceIcons-SharedDeviceTypeImageMap.md` | **Create** — this document |

No edits to existing consumer files in this PR — those land in the
follow-up consumer-migration PR (proposed RFC-0202).
