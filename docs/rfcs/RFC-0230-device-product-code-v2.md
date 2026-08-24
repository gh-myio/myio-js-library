- Feature Name: `device-product-code-v2`
- Start Date: 2026-08-19
- RFC PR: (leave this empty)
- Tracking Issue: (leave this empty)
- Source Specs (external repo, **not** RFC-numbered, status **DRAFT** as of authoring):
  - `gcdr.git/docs/specs/rules-devices-code/v2/DEVICE-PRODUCT-CODE-NUMBERING.md` (authored 2026-08-17)
  - `gcdr.git/docs/specs/rules-devices-code/v2/DEVICE-NAME-SPEC.md` (authored 2026-08-17)
  - `gcdr.git/docs/specs/rules-devices-code/v2/DEVICE-BOX-PROFILE.md` (authored 2026-08-17) — **out of scope**, see [Reference-level explanation](#reference-level-explanation).

  These two specs are the algorithmic source of truth this RFC conforms to. Both are marked as drafts with their own open questions (see [Unresolved questions](#unresolved-questions)); this RFC does not attempt to resolve them on GCDR's behalf. **Spec-drift risk:** if either spec's status changes from DRAFT → RATIFIED, or its own "open questions" section is edited, this RFC must be revisited before implementation begins.

# Summary
[summary]: #summary

Add a new, dependency-free TypeScript module, `src/utils/devices/device-product-code/`, that implements MYIO's **v2 factory device product-code** scheme (a 4-byte packed bit-field serial, `B1.B2.B3.B4`) and its companion **v2 canonical device name** format (`PREFIX YYMMDD-NNNN`), with lossless bidirectional conversion, validation, and a versioned codec designed to accommodate a future v3 (the v2 scheme has a hard 2041 ceiling). The module is exported from `src/index.ts` under a `DeviceProductCode*` naming family, explicitly disambiguated from the unrelated, already-shipped `generateDeviceCode()` / `generateMercosulPlate()` placeholder-ID generators in `src/utils/devices/device.ts`. Tests live under `tests/utils/devices/device-product-code/`.

This is a **documentation-only RFC**. No component code, tests, or `src/index.ts` changes are included — this document is written for review and future approval before any implementation work starts.

# Motivation
[motivation]: #motivation

- **A new, real numbering scheme now exists and has no home.** GCDR introduced a v2 factory serial-number spec on 2026-08-17: a deterministic code that encodes a device's real manufacturing date, its daily production sequence, and its product type, plus a human-readable canonical name that is losslessly convertible to/from that code. Today this logic exists **only** as reference JavaScript embedded inside two markdown spec documents, duplicated a second time (by hand) inside two standalone HTML demo pages already living in `gcdr.git`. There is no single, tested, typed source of truth.
- **Confirmed near-term consumers are external to ThingsBoard.** In the roundtable discussion that produced this RFC (see [Prior art](#prior-art) for the discussion record), the repo owner confirmed the primary consumers are: (1) the two existing standalone HTML pages in `gcdr.git` (`myio-generate-device-name.html`, `myio-generate-product-code-v2.html`), which today embed their own copy of the algorithm and should instead consume a shared, tested implementation; and (2) an eventual manufacturing-side service that generates codes **one at a time**, on demand, during production. Neither consumer is a ThingsBoard widget. This positions the new module as a **portable, headless utility library** — not a UI widget, and not something that needs to render anything.
- **Naming collision risk with existing code.** `src/utils/devices/device.ts` already exports `generateDeviceCode(deviceType?)` and `generateMercosulPlate()`, which produce a **random placeholder identifier** (`D-{TYPE}-{plate}-{plate}`) for devices that haven't been manufactured/provisioned yet (mirrored by `C-`/`A-` variants for customers and assets). This is a different job entirely — no manufacture date, no daily sequence, not decodable — but it shares the words "device" and "code". Left unaddressed, this is the kind of ambiguity that gets the wrong function imported in a future PR. This RFC treats disambiguation as a first-class requirement, not an afterthought.
- **The name format is already load-bearing in a live pipeline, indirectly.** `DEVICE-NAME-SPEC.md` explains that the canonical name's `PREFIX ` + space (not hyphen) separator exists specifically so `CENTRAL_PRE_SETUP/attributes-sync.js`'s `handleDeviceType()` word-boundary keyword matching keeps working. This RFC's module does not modify that production file, but its validation logic must guard the exact detail (`space`, not `hyphen`) that keeps the two systems compatible.

# Guide-level explanation
[guide]: #guide-level-explanation

## Where it lives

`src/utils/devices/device-product-code/` — **not** `src/components/device` as originally scoped. The module has no rendering, no DOM, no UI state; it is pure parse/encode/validate/format logic. Every existing sibling module for device-domain logic already lives under `src/utils/devices/` (`device.ts`, `deviceTypeConfig.ts`, `deviceClassificationProfile.ts`, `deviceIcons.ts`, `deviceInfo.js`, `deviceStatus.js`, `deviceType.js`) — this keeps the new module consistent with that convention rather than implying a UI component that doesn't exist. (This is a deliberate correction from the initial ask; confirmed with the repo owner during the roundtable review.)

## Public API (illustrative — names are a proposal, not final)

```ts
// Encode fields (manufacture date, daily sequence, product type) into a code.
// The daily sequence itself is caller-supplied — this module does not allocate
// or persist counters; that is the manufacturing service's responsibility.
encodeDeviceProductCode(fields: DeviceProductCodeFieldsV2): DeviceProductCodeV2

// Parse a "B1.B2.B3.B4" string into a validated value object.
decodeDeviceProductCode(code: string): DeviceProductCodeV2

// Serialize back to the dotted "B1.B2.B3.B4" string.
formatDeviceProductCode(value: DeviceProductCodeV2): string

// Convert to/from the canonical human-readable name, "PREFIX YYMMDD-NNNN".
deviceProductCodeToName(value: DeviceProductCodeV2): string
deviceNameToDeviceProductCode(name: string): DeviceProductCodeV2

// Standalone validators — independently exported so validation logic is
// unit-testable (and its branch coverage measurable) without going through
// encode/decode.
validateDeviceProductCode(code: string): DeviceProductCodeValidationResult
validateDeviceProductName(name: string): DeviceProductCodeValidationResult
```

```ts
// Example: the worked example from DEVICE-NAME-SPEC.md §6
const code = decodeDeviceProductCode('17.2.25.15');
// => { year: 2027, month: 1, day: 2, seq3: 0, seq: 25, productType: 15 }

deviceProductCodeToName(code);
// => '3F 270102-0025'

deviceNameToDeviceProductCode('3F 270102-0025');
// => same value object as `code` above (round-trip)
```

## Disambiguation from the existing `generateDeviceCode`

| | `generateDeviceCode()` (existing, `device.ts`) | This RFC's module (new) |
|---|---|---|
| Format | `D-{TYPE}-{plate}-{plate}` | `B1.B2.B3.B4` (code) / `PREFIX YYMMDD-NNNN` (name) |
| Nature | Random, non-deterministic | Deterministic — derived from real manufacture date + sequence |
| Decodable? | No — opaque placeholder | Yes — losslessly round-trips to its source fields |
| Used for | Pre-provisioning placeholder, before a real device exists | Real factory-assigned serial, once a device is manufactured |
| Exported names | `generateDeviceCode`, `generateMercosulPlate` | `encodeDeviceProductCode`, `decodeDeviceProductCode`, `DeviceProductCodeV2`, … (never bare `DeviceCode`) |

The legacy `generateDeviceCode` JSDoc gains an `@see` pointer to this new module once it exists, so it surfaces via editor autocomplete. No behavior of the legacy function changes.

# Reference-level explanation
[reference]: #reference-level-explanation

## Data model

A v2 code is 4 bytes, dotted-decimal, each byte a packed bit-field (`DEVICE-PRODUCT-CODE-NUMBERING.md` §1–2):

| Byte | Bits | Field | Range | Meaning |
|---|---|---|---|---|
| B1 | high 4 | `year` | 0–15 | year − 2026 (2026–2041) |
| B1 | low 4 | `month` | 1–12 | calendar month |
| B2 | high 3 | `seq3` | 0–7 | secondary/block sequential |
| B2 | low 5 | `day` | 1–31 | day of month |
| B3 | all 8 | `seq` | 1–254 | daily sequential (0, 255 reserved) |
| B4 | all 8 | `productType` | registry (§ below) | product type byte |

The canonical name (`DEVICE-NAME-SPEC.md` §1–2) is `PREFIX YYMMDD-NNNN` — **one space** after `PREFIX`, hyphen between date and unit, regex `^[A-Z0-9]{2,12} \d{6}-\d{4}$`. `NNNN` merges `seq3`/`seq` into a single "unit of the day" (`unit = seq3*254 + seq`, range `0001`–`2032`).

## Design patterns

Three patterns, chosen to match the shape of the actual problem (a versioned, dual-serialization Value Object with an evolving type registry) rather than added for their own sake:

1. **Value Object** — `DeviceProductCodeV2` is an immutable object carrying `{ year, month, day, seq3, seq, productType }`. It is the single point of truth; both `formatDeviceProductCode` and `deviceProductCodeToName` are pure projections of it, which is what makes the round-trip invariant (`decode(encode(x)) === x`, both directions) meaningfully testable.
2. **Strategy (versioned codec)** — a `Codec` interface (`{ version, encode, decode, validate }`) with `V2Codec` as the only implementation today. This exists specifically because the spec itself states the 4-bit year field runs out in 2041 and a v3 will be needed; a `resolveCodec(version?)` entry point means a future `V3Codec` slots into the same contract without a breaking rewrite of every consumer.
3. **Registry — two distinct ones, not one:**
   - `productTypeRegistry` — closed, bijective, currently 5 entries (`12=HIDR, 14=REM, 15=3F, 16=TEMP (draft), 17=TANK (draft)`). This is the **only** mapping used by `encode`/`decode`/`format` — it is what makes the code↔name conversion lossless.
   - `functionalKeywordRegistry` — open, lossy, mirrors the broader keyword vocabulary from `CENTRAL_PRE_SETUP/attributes-sync.js`'s `handleDeviceType()` (e.g. `COMPRESSOR`, `MOTOR`, `ELEVADOR`). It exists for **name formatting/display context only** and is explicitly **not** wired into `decodeDeviceProductCode`/`deviceNameToDeviceProductCode` — a name using a functional-keyword prefix cannot be losslessly converted back to a code without the product-type byte supplied separately (see [Non-goals](#non-goals)). This module mirrors that vocabulary for documentation/consistency purposes; it does not replace or call into `attributes-sync.js`, and `attributes-sync.js` is not modified by this RFC.

## Proposed file layout

```
src/utils/devices/device-product-code/
  index.ts                        # public facade — this is what src/index.ts re-exports
  types.ts                        # DeviceProductCodeV2, DeviceProductCodeFieldsV2, error/result types
  codecs/
    codec.ts                      # Codec interface
    v2.ts                         # V2Codec — bit-packing per §1–2 above
    registry.ts                   # CODEC_REGISTRY + resolveCodec(version?)
  registry/
    productTypeRegistry.ts        # closed, bijective, lossless (12/14/15/16/17 <-> HIDR/REM/3F/TEMP/TANK)
    functionalKeywordRegistry.ts  # open, lossy, mirrored from attributes-sync.js for context only
  name.ts                         # PREFIX YYMMDD-NNNN <-> DeviceProductCodeV2
  errors.ts                       # DeviceProductCodeError, with a typed `reason` discriminant
```

## Version / scheme ambiguity (external, unresolved)

`DEVICE-PRODUCT-CODE-NUMBERING.md` §8 flags, as its "critical open question", that v1 and v2 codes share the exact same 4-byte dotted string shape but mean different things, with **no version marker in the payload itself**. This RFC does not resolve that ambiguity — it cannot; the byte layout is owned by GCDR, not this library. Concretely:

- `decodeDeviceProductCode` always operates against the **v2** scheme (this module does not implement v1 at all — v1 is legacy/archived per the spec).
- `resolveCodec(version?)` exists as the forward-compatible seam: once GCDR settles how a v3 code (or a v1/v2 cutover) is distinguished — a manufacture-date cutover, a version registry lookup, or a marker byte — this module can add that resolution logic in one place without changing every call site.
- The module **must not** silently guess a scheme. If a future caller needs multi-version support before GCDR resolves the ambiguity, that is an explicit, visible parameter — not inferred.

## Draft/unratified registry values

`TEMP=16` and `TANK=17` are marked "proposed" in the source spec, not ratified. `productTypeRegistry` carries them with an explicit `status: 'draft'` marker (or equivalent) and a code comment citing the spec section. This RFC does not block on ratification — blocking would be disproportionate to a two-entry table — but implementations must not present draft entries as equivalent in confidence to the three ratified ones (`HIDR`, `REM`, `3F`).

## Validation rules

Per `DEVICE-NAME-SPEC.md` §5 and `DEVICE-PRODUCT-CODE-NUMBERING.md` §4:

| Check | Rule |
|---|---|
| Code shape | 4 dotted decimal bytes, each 0–255 |
| Name shape | matches `^[A-Z0-9]{2,12} \d{6}-\d{4}$` (space, not hyphen, after prefix) |
| Prefix | in `productTypeRegistry`, or the `T{B4}` fallback for an unrecognized type byte |
| Year | `26`–`41` (2026–2041) |
| Month | `01`–`12` |
| Day | `01`–`31` (calendar-impossible dates, e.g. Feb 30, are **not** rejected by the bit-field alone — see [Unresolved questions](#unresolved-questions)) |
| Seq3 | `0`–`7` |
| Seq | `1`–`254` (`0` and `255` are reserved) |
| NNNN (name) | `0001`–`2032` |
| Round-trip | `decode(encode(x)) === x` and `nameToCode(codeToName(x)) === x` both hold |

Validation failures are surfaced as a typed `DeviceProductCodeError` with a `reason` discriminant (e.g. `'invalid-shape' | 'month-out-of-range' | 'unknown-prefix' | ...`) rather than a generic thrown `Error`, so failure branches are individually assertable in tests.

## Testing strategy

Tests live under `tests/utils/devices/device-product-code/` (Vitest, matching the existing `tests/utils/devices/` convention), and must cover:

1. **Round-trip invariants** — `decode(encode(x)) === x` and both directions of `name ↔ code`, across the full valid domain (deterministic enumeration, or property-based testing via a new `fast-check` devDependency — either is acceptable; the RFC does not mandate one, but the choice and its trade-off must be recorded in the implementing PR).
2. **Boundary years** — both edges of `2026`/`2041` (valid) and `2025`/`2042` (invalid, both sides of the range, not just the ceiling).
3. **Malformed/invalid inputs, 100% branch coverage on validation** — month `0`/`13`, day `0`/`32`, seq `0`/`255`, seq3 out of `0`–`7`, `NNNN` out of `0001`–`2032`, unknown product-type byte, and a name string that fails the regex (lowercase prefix, prefix `>12` chars, missing digit groups, etc.).
4. **Space-vs-hyphen regression guardrail** — a name with a hyphen instead of a space after the prefix must be **rejected**; this is a direct guardrail against colliding with `attributes-sync.js`'s word-boundary matching, cited in the test as such.
5. **Functional-prefix (registry §3b) non-invertibility** — a name using a functional keyword prefix (e.g. `COMPRESSOR ...`) must fail `deviceNameToDeviceProductCode` with a clear, typed error (not silently default to a wrong product type), since the product-type byte cannot be derived from a functional keyword alone.
6. **Golden fixtures transcribed verbatim from the spec** — the four worked examples in `DEVICE-NAME-SPEC.md` §6 become literal test fixtures, each with a comment citing the spec file and section. Any future edit to those worked examples in `gcdr.git` requires a matching fixture update in the same PR — this keeps the spec and the test suite from silently diverging.

## Export surface (`src/index.ts`)

A new grouped block, appended at the end of the file per the existing convention (see the RFC-0203/tickets export block for the pattern), headed by a comment identifying it as RFC-0230:

```ts
// RFC-0230 — Device Product Code v2 (factory serial + canonical name)
export {
  encodeDeviceProductCode,
  decodeDeviceProductCode,
  formatDeviceProductCode,
  deviceProductCodeToName,
  deviceNameToDeviceProductCode,
  validateDeviceProductCode,
  validateDeviceProductName,
} from './utils/devices/device-product-code';
export type {
  DeviceProductCodeV2,
  DeviceProductCodeFieldsV2,
  DeviceProductCodeValidationResult,
} from './utils/devices/device-product-code';
```

## Non-goals
[non-goals]: #non-goals

- **Does not modify, replace, or deprecate `generateDeviceCode()` / `generateMercosulPlate()`.** They solve a different problem (random pre-provisioning placeholder vs. real deterministic factory serial) at a different point in a device's lifecycle.
- **Does not implement the BOX device profile** (`DEVICE-BOX-PROFILE.md`). That spec is a GCDR database/backend concern (Postgres migration, new `box_id` FK, new API endpoints) with 7 of its own open decisions and no identified frontend consumer — out of scope for a shared frontend library RFC.
- **Does not migrate `CENTRAL_PRE_SETUP/attributes-sync.js`** (or any TS rewrite of it) to consume `functionalKeywordRegistry`. That file is a live production pipeline; changing its behavior is a separate, higher-stakes change tracked as a follow-up (see [Future possibilities](#future-possibilities)), not bundled into this RFC.
- **Does not allocate, persist, or track the daily sequence counter (`seq`/`seq3`).** Those are caller-supplied inputs to `encodeDeviceProductCode`. Sequence allocation is the manufacturing service's responsibility (state that belongs to a backend/database, not this library).
- **Does not build a rendering/presentation component** (badge, label, autocomplete). No confirmed consumer needs one today (see [Prior art](#prior-art)); if one emerges, it is a thin, separate follow-up built on top of this codec.

# Drawbacks
[drawbacks]: #drawbacks

- Two separate registries (`productTypeRegistry` vs. `functionalKeywordRegistry`) add conceptual surface for what is, numerically, a small feature (5 + ~15 entries). The alternative — one merged registry — was rejected because it would blur the lossless/lossy distinction that the round-trip guarantee depends on.
- The module depends on external, still-DRAFT specs in a sibling repo (`gcdr.git`) that are not version-pinned or published as a package. Spec drift is a real, named risk (see header block) with no automated detection today — only the documented process convention of revisiting this RFC on spec status change.
- Introducing a second "device code" concept into the same package, however well-disambiguated, still adds a burden of care for anyone skimming `index.ts`'s export list.

# Rationale and alternatives
[rationale]: #rationale-and-alternatives

- **Why not extend `generateDeviceCode`?** Its contract (random, non-decodable, pre-provisioning placeholder) is fundamentally incompatible with the new scheme (deterministic, decodable, real factory data). Overloading it would violate single responsibility and could silently change behavior for existing callers.
- **Why not leave the logic embedded in the two `gcdr.git` HTML pages?** No reuse across the two confirmed consumers, no type safety, no tests, and every future consumer (including the eventual manufacturing service) would re-copy the same reference JavaScript a third time — the exact drift risk this RFC exists to close.
- **Why a Strategy-pattern codec instead of one hardcoded v2 function?** The source spec states outright that the 4-bit year field exhausts in 2041 and a v3 revision will be required. Building the versioning seam now avoids a breaking API change later; the cost today (one interface, one implementation) is small.
- **Why `src/utils/devices/` instead of `src/components/device`?** Consistency with every existing device-domain module in the repo, and the module has no UI/rendering responsibility to justify a `components/` home. Confirmed with the repo owner during the roundtable review that produced this document.

# Prior art
[prior-art]: #prior-art

- `src/utils/devices/device.ts` (`generateMercosulPlate`, `generateDeviceCode`) and its siblings `src/utils/customer.ts` (`C-` prefix), `src/utils/asset.ts` (`A-` prefix) — the existing placeholder-ID generation family this RFC deliberately does not touch, beyond disambiguation.
- **RFC-0202** (`deviceTypeConfig.ts` single source of truth) and **RFC-0207** (`deviceClassificationProfile.ts`) — prior consolidations of duplicated device-domain logic in this repo; this RFC follows the same motivation pattern (kill silent duplication before it causes divergence) applied to a new problem.
- This RFC's content was shaped by a BMAD party-mode roundtable (2026-08-19) with four independent reviewers — Winston (architecture: relocated the module out of `src/components/`, proposed the Strategy/Value-Object/Registry pattern set and the file layout), Amelia (testing: defined the exhaustive test matrix and the golden-fixture policy), Mary (evidence/scope: separated blocking vs. deferrable open questions, flagged the missing-consumer risk), and John (JTBD: pressed for a concrete consumer before scoping the API, which the repo owner then confirmed). Their full responses and the resulting scope decisions (module location, consumer identity) are part of this session's discussion record.

# Unresolved questions
[unresolved]: #unresolved-questions

The following are owned by the source specs (`gcdr.git`) or deferred to the implementing PR — not resolved by this RFC:

- **v1/v2 code-string disambiguation.** No mechanism exists yet for a reader to tell which scheme a raw `B1.B2.B3.B4` string uses (`DEVICE-PRODUCT-CODE-NUMBERING.md` §8, called out there as "the critical open question"). This library assumes v2-only until GCDR resolves it.
- **Type-byte ratification** for `TEMP=16` / `TANK=17` (currently proposed, not ratified).
- **Year field width** — spec currently commits to 2-digit `YY`; a 4-digit `YYYY` alternative was raised but not adopted in the source spec.
- **`NNNN` semantics** — whether `seq3`+`seq` should stay merged into one visible unit number (current spec choice) or split into a visible `PREFIX YYMMDD-B{seq3}-{seq}` block form.
- **Calendar-impossible dates** (e.g. Feb 30) — the bit-field validation alone does not reject these; whether this library's `validateDeviceProductCode`/`validateDeviceProductName` should add a calendar check is left to the implementing PR.
- **Exact public function/type names** — the API sketch in this document is illustrative and intentionally not final; naming is expected to be finalized at implementation-PR review, respecting only the hard constraint that no export uses the bare word `DeviceCode`.
- **Property-based vs. deterministic-enumeration testing** — both are acceptable per this RFC; the implementing PR records which was chosen and why.

# Future possibilities
[future]: #future-possibilities

- A **v3 codec** once the 2026–2041 range is exhausted, or sooner if GCDR revises the byte layout — the `Codec`/`resolveCodec` seam exists specifically to make this additive.
- **Migrating `CENTRAL_PRE_SETUP/attributes-sync.js`** (or a future TypeScript rewrite of it) to consume `functionalKeywordRegistry` from this module instead of its own inline keyword matching — this would close the duplicated-logic gap noted in [Reference-level explanation](#reference-level-explanation), but is a production-pipeline change requiring its own RFC and rollout plan, not bundled here.
- A **thin presentational layer** (a formatter/badge/label rendering `PREFIX YYMMDD-NNNN · displayName`) built on top of this codec, if and when a concrete UI consumer is identified. No such consumer exists today (see [Non-goals](#non-goals)).
- **BOX device profile** (`DEVICE-BOX-PROFILE.md`) code/name parsing support, once its own GCDR-side backend RFC (schema, API surface) is ratified and a frontend consumer is identified.
