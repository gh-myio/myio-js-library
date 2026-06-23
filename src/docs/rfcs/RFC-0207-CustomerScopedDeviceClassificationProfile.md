# RFC-0207 — Customer-Scoped Device Classification Profile

- **RFC**: 0207
- **Title**: Customer-Scoped Device Classification Profile (SERVER_SCOPE JSON + MENU management modal)
- **Status**: Implemented (v1) — A0/A1/A1b (single-source resolver + bug #1/#2 fixes, golden-tested) + Phase B (customer SERVER_SCOPE attribute load in MAIN_VIEW.onInit + premium MENU management modal `openDeviceProfileModal`). Branch `feat/rfc-0207-b-attribute-and-menu` → PR to `desenv`.
  **+ v2 redesign — PROPOSED (2026-06-23), not yet implemented**: fully configurable group/subcategory **tree** (create groups at will, nest subcategories, config-driven labels, unique allocation, UPPERCASE, predefined deviceProfile catalog, computed residual/total nodes), with persistence ownership moved to MAIN_VIEW and config-driven tooltips. See **§ Addendum — RFC-0207 v2** at the end. The v1 sections below describe what shipped; v2 supersedes the *schema* and *groups/categories model*.
- **Author**: Rodrigo Lago
- **Created**: 2026-06-18
- **Target**: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/` (MAIN_VIEW, MENU, TELEMETRY, TELEMETRY_INFO) + `src/utils/`
- **Related**:
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/DEVICE-CLASSIFICATION-MAP.md` — current (hard-coded) classification map this RFC replaces.
  - RFC-0111 — unified device domain/context classification (`src/utils/deviceInfo.js`).
  - RFC-0128 — energy equipment subcategorization (`src/utils/equipmentCategory.js`).
  - RFC-0200 — `deviceIcons` shared device-type map (precedent for "shared config map").
  - `integration_setup` customer SERVER_SCOPE attribute (precedent for customer-scoped JSON config; see `MENU`/`GCDR-Upsell-Setup`).

---

## Summary

Device classification in the v-5.2.0 shopping dashboard is driven by **hard-coded
constants** scattered across `MAIN_VIEW/controller.js` (e.g. `DEVICE_CLASSIFICATION_CONFIG`,
`ENTRADA_PROFILES`, `OCULTOS_PATTERNS`, `CLIMATIZACAO_IDENTIFIERS_SET`) and partially
mirrored — divergently — in `src/utils/equipmentCategory.js`. Two parallel code paths use
**different criteria** (`deviceProfile` exact for the Entrada/Lojas/Área-Comum **columns**
vs `deviceProfile` + `identifier` substring/prefix for the TELEMETRY_INFO **breakdown**),
which produces the three known bugs documented in `DEVICE-CLASSIFICATION-MAP.md`.

This RFC proposes a **single, customer-scoped classification profile**: one JSON document
stored in a **SERVER_SCOPE attribute on the current customer**, loaded **once in
`MAIN_VIEW.onInit`**, exposed on `window.MyIOUtils`, and consumed by every classifier
(column grouping + breakdown). A new **MENU modal — "Gestão de Perfil de Dispositivos"
(Device Profile Management)** — provides a premium UI to view and edit that map. The
existing hard-coded values become a **built-in default seed** (fallback when the attribute
is absent), not the source of truth.

> **Implementation status:** delivered in phases. **A0** — pure single-source resolver
> (`src/utils/deviceClassificationProfile.ts`) + MAIN_VIEW delegation, proven equivalent by
> golden tests. **A1/A1b** — bug #1 (CAG `Set.has` → substring) and bug #2 (column vs
> breakdown unified through `resolveCategory`). **Phase B** — `setActiveProfile`/`getActiveProfile`,
> the customer SERVER_SCOPE `deviceClassificationProfile` loaded in `MAIN_VIEW.onInit`, the
> premium MENU modal `openDeviceProfileModal` (view/edit/preview/save, permission-gated), and
> the bug #3 dead-key removal in TELEMETRY. **Follow-up #1** — `conditional`-rule editor in
> the modal. **Follow-up #2** — water/temperature domains: the resolver is now domain-generic
> (`resolveGroup(item, profile, domain)`), the DEFAULT seed encodes `water` and `temperature`
> faithfully (proven equivalent to `categorizeItemsByGroupWater`/`Temperature` by a zero-diff
> golden), `MAIN_VIEW` delegates both, and the modal gained Energia/Água/Temperatura tabs.
> **Follow-up #3** — the TELEMETRY card-filter path (`_getEnergyGroupKey`) now delegates to the
> resolver, behind a reviewed *migration snapshot* (it keys off `deviceProfile` now, not
> `deviceType`; the `null` "always-shown" contract is preserved). **Cleanup** — the legacy
> parallel classifier bodies were removed from `categorizeItemsByGroup`/`Water`/`Temperature`,
> `classifyDevice`, `buildSummary`, and `_getEnergyGroupKey`; the resolver is now the sole
> classifier (graceful degrade + error log if the library bundle is missing). **`inferLabelWidget`
> migrated** too (behind its own migration snapshot): the per-category card filter (TELEMETRY
> `getItemsFromState` filters `areacomum` by `item.labelWidget`) now derives `labelWidget` from
> the resolver, so the displayed cards match the breakdown counts — closing the count≠cards gap
> A1/A1b created for identifier-only devices ("CAG 01", "ELV-…"). Exported helpers
> (`isOcultosDevice`, `classifyDeviceByDeviceType/Identifier`) are intentionally retained.
> Only `equipmentCategory.js` (public util, not used by this dashboard) remains for parity later.
> **Operational gate:** the `dist` must be published so the deployed widgets carry the resolver exports.

---

## Motivation

### The rules are hard-coded, duplicated, and divergent

Per `DEVICE-CLASSIFICATION-MAP.md`, classification lives in at least three places with
**inconsistent semantics**:

1. **Columns** (`categorizeItemsByGroup`, `MAIN_VIEW:3161`) — `deviceProfile` **exact**
   match against fixed Sets (`3F_MEDIDOR`, `{TRAFO,ENTRADA,RELOGIO,SUBESTACAO}`,
   `OCULTOS_PATTERNS`).
2. **Breakdown** (`classifyDeviceByDeviceType`, `MAIN_VIEW:700`) — `deviceProfile` Set
   **plus** `identifier` prefix/Set matching.
3. **Library util** (`equipmentCategory.js`) — same intent but uses `identifier.includes()`
   (substring), **diverging** from the widget.

This causes concrete defects (all in `DEVICE-CLASSIFICATION-MAP.md §3`):

- **CAG via `Set.has` exact**: `"CAG 01"`, `"BOMBA CAG 2"` fall into **Outros** instead of
  **Climatização** (only the `CAG-` prefix saves them); the library util would classify them
  correctly (`includes`) — opposite behavior.
- **Column vs breakdown mismatch**: a device can be **Área Comum** in the column and
  **Outros** in the breakdown.
- **Dead config key**: `DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceProfiles` is read in
  TELEMETRY but never defined in MAIN_VIEW → silently `[]`.

### Why a customer-scoped attribute

- Each shopping (customer) has its **own** device naming conventions, profiles, and edge
  cases. Hard-coding "CAG", "ELV-", "3F_MEDIDOR" forces a code release for every new pattern.
- Operators (MyIO / holding admins) need to **fix a misclassified device** without waiting
  for a widget deploy — editing a JSON on the customer is immediate.
- A single document used by **all** classifiers removes the divergence by construction.

### Goals

1. Move all classification rules into **one editable JSON** per customer (SERVER_SCOPE).
2. Load it **once** in `MAIN_VIEW.onInit`; expose on `window.MyIOUtils`; every classifier
   reads from it (no more scattered constants).
3. Provide a **premium MENU modal** to view/edit the map (permission-gated).
4. Keep the current hard-coded values as a **versioned default seed** → zero behavior change
   when the attribute is absent (safe migration).

### Non-goals

- Changing the *event flow* (`myio:telemetry:update`, `areacomum_breakdown`, `STATE.energy.*`).
- Re-architecting domains (energy/water/temperature) — only the rule **source** changes.
- Per-device manual override storage (possible future, see §Future possibilities).

---

## Guide-level explanation

### The artifact: one JSON on the current customer

A SERVER_SCOPE attribute named **`deviceClassificationProfile`** on the **current customer**
holds the entire rule set. Example (energy domain):

```jsonc
{
  "schemaVersion": 1,
  "updatedAt": "2026-06-18T19:24:13.000Z",
  "updatedBy": "victor@myio.com.br",
  "matching": { "caseInsensitive": true },          // global match options
  "domains": {
    "energy": {
      "groups": {                                    // → columns Entrada / Lojas / Área Comum
        "ocultos":   { "profilePatterns": ["ARQUIVADO","SEM_DADOS","DESATIVADO","REMOVIDO","INATIVO"] },
        "lojas":     { "deviceProfiles": ["3F_MEDIDOR"] },
        "entrada":   { "deviceProfiles": ["TRAFO","ENTRADA","RELOGIO","SUBESTACAO"] },
        "areacomum": { "fallback": true }            // residual
      },
      "categories": {                                // → TELEMETRY_INFO breakdown
        "climatizacao": {
          "deviceProfiles": ["CHILLER","AR_CONDICIONADO","HVAC","FANCOIL"],
          "identifierPrefixes": ["CAG-","FANCOIL-","CHILLER-"],
          "identifierContains": ["CAG","FANCOIL"],   // unified substring rule (fixes CAG bug)
          "conditional": [ { "deviceTypes": ["BOMBA","MOTOR"], "whenIdentifierContains": ["CAG","FANCOIL"] } ]
        },
        "elevadores":       { "deviceProfiles": ["ELEVADOR"],      "identifierPrefixes": ["ELV-","ELEVADOR-"] },
        "escadas_rolantes": { "deviceProfiles": ["ESCADA_ROLANTE"],"identifierPrefixes": ["ESC-","ESCADA-","ESCADA_"] },
        "outros":           { "fallback": true }
      }
    },
    "water":       { "groups": { "entrada": {...}, "lojas": {...}, "banheiros": {...}, "caixadagua": {...}, "areacomum": { "fallback": true }, "ocultos": {...} } },
    "temperature": { "groups": { /* … */ } }
  }
}
```

Two rule families, **one document**:
- `domains.<d>.groups` → the **column** bucket (Entrada / Lojas / Área Comum / Ocultos), the
  residual being the one with `"fallback": true`.
- `domains.<d>.categories` → the **breakdown** subcategory (Climatização / Elevadores /
  Escadas Rolantes / Outros).

### The lifecycle

1. **`MAIN_VIEW.onInit`** fetches the attribute for the current customer (one API call).
2. If present → it becomes the active profile. If absent/invalid → the **built-in default
   profile** (current hard-coded values) is used, and a one-time warning is logged.
3. The profile is published on `window.MyIOUtils.deviceClassificationProfile` and the
   classifier functions (`categorizeItemsByGroup`, `classifyDevice*`) read **from it**.
4. `TELEMETRY` / `TELEMETRY_INFO` keep consuming `window.MyIOUtils.classifyDevice` exactly as
   today — they don't know the rules moved to an attribute.

### The MENU modal — "Gestão de Perfil de Dispositivos"

A new MENU entry opens a premium modal that:
- Renders the current profile as an **editable map**: groups and categories, each with its
  device-profiles / identifier-prefixes / contains lists (chips, add/remove).
- Shows a **live preview**: given the customer's current devices (from the orchestrator),
  show how many land in each group/category — and surface **unmatched / fallback** devices so
  the operator sees what's currently "Outros"/"Área Comum" and can add a rule.
- **Validates** (no duplicate profile across groups, exactly one `fallback` per family).
- **Saves** back to the SERVER_SCOPE attribute, bumping `schemaVersion`/`updatedAt`/`updatedBy`,
  then triggers a re-classification (re-dispatch of the orchestrator events).
- Is **permission-gated**: edit is allowed only for MyIO users or holding admins
  (`isHolding && isUserAdmin`) — consistent with the alarm-edit gating direction; others see
  the map **read-only**.

---

## Reference-level explanation

### Attribute

| Field | Value |
| --- | --- |
| Scope | `SERVER_SCOPE` |
| Entity | the **current customer** (`window.MyIOUtils.customerTB_ID`) |
| Key | `deviceClassificationProfile` |
| Type | JSON (object) |
| Read | `GET /api/plugins/telemetry/CUSTOMER/{customerId}/values/attributes/SERVER_SCOPE?keys=deviceClassificationProfile` |
| Write | `POST /api/plugins/telemetry/CUSTOMER/{customerId}/SERVER_SCOPE` (body `{ deviceClassificationProfile: {...} }`) |

(Mirrors the existing `integration_setup` attribute access pattern.)

### Schema (v1)

- `schemaVersion: number` — gate for future migrations.
- `matching.caseInsensitive: boolean` — global; values compared upper-cased.
- `domains: { [domain]: { groups, categories? } }` — `energy` required; `water`/`temperature`
  optional (water adds `banheiros`/`caixadagua`).
- **Group rule** object: `{ deviceProfiles?: string[], profilePatterns?: string[], fallback?: boolean }`.
  - `deviceProfiles` → exact match (case-insensitive) on `item.deviceProfile`.
  - `profilePatterns` → substring match (for "ocultos").
  - exactly **one** group per domain must have `fallback: true`.
- **Category rule** object: `{ deviceProfiles?, identifierPrefixes?, identifierContains?, conditional?, fallback? }`.
  - `deviceProfiles` → exact on `deviceProfile`.
  - `identifierPrefixes` → `identifier.startsWith(p)`.
  - `identifierContains` → `identifier.includes(s)` (**this is the unified rule** that fixes
    the CAG `Set.has` bug — substring everywhere).
  - `conditional[]` → `{ deviceTypes, whenIdentifierContains }` for BOMBA/MOTOR-style devices.
  - exactly one category per domain has `fallback: true` ("outros").

### Resolution order (deterministic)

Groups (per domain): `ocultos` → explicit `deviceProfiles`/`profilePatterns` matches in
declared order → `fallback`. Categories: explicit `deviceProfiles` → `identifierPrefixes` →
`identifierContains` → `conditional` → `fallback`. First match wins; documented and stable.

### Code changes (design)

1. **New util** `src/utils/deviceClassificationProfile.ts`:
   - `DEFAULT_DEVICE_CLASSIFICATION_PROFILE` — the current hard-coded values, expressed in the
     schema (single seed; also re-exported so non-customer contexts/SIM have a default).
   - `resolveGroup(item, profile, domain)` and `resolveCategory(item, profile, domain)` —
     pure functions implementing the resolution order above.
   - `validateProfile(profile)` → `string[]` of errors (used by the modal).
   - `normalizeProfile(raw)` → fills defaults, upper-cases when `caseInsensitive`.
   - Exported from `src/index.ts` (so MENU modal + widgets + SIM share one implementation).
2. **MAIN_VIEW**: in `onInit`, fetch the attribute → `normalizeProfile` (or default) →
   `window.MyIOUtils.deviceClassificationProfile`. Replace the bodies of
   `categorizeItemsByGroup` / `classifyDeviceByDeviceType` / `classifyDeviceByIdentifier` to
   delegate to `resolveGroup` / `resolveCategory` using the loaded profile. **Delete** the
   scattered constants (`DEVICE_CLASSIFICATION_CONFIG`, `ENTRADA_PROFILES`,
   `OCULTOS_PATTERNS`, `CLIMATIZACAO_IDENTIFIERS_SET`, …).
3. **TELEMETRY / TELEMETRY_INFO**: no change to event flow; they already read
   `window.MyIOUtils.classifyDevice` and `STATE.energy.*`. Remove `_getEnergyGroupKey`'s
   private re-derivation (`TELEMETRY:1126`) in favor of the shared resolver.
4. **MENU**: new modal component (premium UI) reading/writing the attribute; a new menu item
   "Gestão de Perfil de Dispositivos".

### Load sequence / timing

The attribute fetch is awaited **before** the first classification pass in `onInit`
(it gates the orchestrator's `categorizeItemsByGroup`). If the fetch fails, fall back to the
default profile and proceed (fail-open to *default behavior*, never to "no classification").
On save from the modal, the profile is updated in `window.MyIOUtils` and the orchestrator
re-runs classification + re-dispatches `myio:*` events so the columns/breakdown refresh
without a page reload.

### Permission gating

Edit is allowed only when the user is a MyIO user (`@myio.com.br`) **or** holding admin
(`isHolding === true && isUserAdmin === true`) — reuse the `canEditAlarmRules`-style resolver
(`src/utils/superAdminUtils.ts`). Non-privileged users open the modal **read-only**.

---

## Drawbacks

- **A bad attribute can break classification.** Mitigated by `validateProfile` on save +
  schema validation on load + default fallback on invalid JSON.
- **Another async dependency in `onInit`** (one more attribute fetch before first render).
  Mitigated by parallelizing with existing customer-attr fetches and the default fallback.
- **Drift between customers**: each customer's profile can diverge. This is the *point*, but
  it means support must inspect the attribute when diagnosing classification issues (the MENU
  modal + the map doc make this observable).
- **Migration surface**: the current values must be transcribed faithfully into the default
  seed, or behavior changes silently. Mitigated by a golden test comparing old-constants vs
  default-profile classification over a device fixture.

---

## Rationale and alternatives

- **Keep hard-coded (status quo)** — rejected: causes the 3 documented bugs, needs a release
  per pattern, and the two code paths keep diverging.
- **One global config (not per customer)** — rejected: shoppings have genuinely different
  naming conventions; a global map would either be too loose or need per-customer exceptions
  anyway.
- **Store on each device (per-device override)** — heavier and harder to reason about at a
  glance; better as a *future* complement (see below). The customer-level profile covers the
  rule-based 95%.
- **`deviceProfile`-only (drop identifier rules)** — rejected: real devices rely on identifier
  prefixes (`CAG-`, `ELV-`, `ESC-`) where the profile is generic (BOMBA/MOTOR). The unified
  `identifierContains` + `identifierPrefixes` is what fixes the CAG bug.
- **GCDR-served config** — possible later; the SERVER_SCOPE attribute is the lowest-friction
  store that the dashboard already reads (`integration_setup` precedent) and an operator can
  edit in-place.

---

## Prior art

- **RFC-0200 `deviceIcons`** — precedent for a shared, data-driven map replacing duplicated
  per-repo constants.
- **`integration_setup` attribute** — precedent for a customer-scoped JSON config read by the
  dashboard (GCDR creds, tickets). Same access pattern, same place.
- **RFC-0111 / RFC-0128** — the domain/context and equipment-subcategory logic this RFC
  unifies behind one editable source.
- **ThingsBoard SERVER_SCOPE attributes** — standard mechanism for entity-scoped config.

---

## Unresolved questions

1. **Attribute key name & namespacing** — `deviceClassificationProfile` standalone, or nested
   under `integration_setup` (one customer-config blob)? Standalone is simpler to edit/diff;
   nested keeps all dashboard config in one attribute.
2. **Inheritance** — should a child customer inherit the holding's profile and override only
   deltas, or always carry a full document? (Head-office dashboards orchestrate many customers.)
3. **Re-classification trigger** — on save, re-dispatch orchestrator events vs require reload?
   (Design assumes in-place re-dispatch.)
4. **Water/temperature parity** — ✅ RESOLVED (follow-up #2): all three domains defined in the
   same schema; resolver is domain-generic; `water`/`temperature` are optional and fall back to
   the DEFAULT seed when a customer profile omits them.
5. **Where the default seed lives** — `src/utils/deviceClassificationProfile.ts` exported, so
   the SIM and non-attribute contexts share it; confirm SIM (`MYIO-SIM`) consumes the same.

---

## Future possibilities

- **Per-device override** layer (SERVER_SCOPE on the device) resolved *before* the customer
  profile, for the rare device that defies the rules.
- **Dry-run / preview diff** in the modal: "applying this change moves N devices from Outros →
  Climatização" before saving.
- **Profile templates** per shopping operator (Soul Malls, OBRAMAX…) seeded from a library of
  known conventions.
- **Export/import** the profile as JSON/CSV from the modal (audit, copy between customers).
- **Lint endpoint**: validate every customer's profile against its live device set (find
  devices still landing in fallback) — surfaces misclassification fleet-wide.

---

## Addendum — Roundtable Decision (2026-06-18): Phasing & Scope

> Status: this addendum supersedes the original "single golden test" claim in
> *Reference-level explanation* and refines the *Unresolved questions* section.
> Authored by the BMAD roundtable (Amelia, Winston, John, Sally; curated by Paige,
> measurement plan by Mary).

The roundtable split the work along **two orthogonal axes**: a *technical* delivery
axis (3 PRs, each with its own reversion boundary) and a *product* axis (3 slices,
each promoted by data rather than by date). They share a spine — the pure resolver
and the DEFAULT seed — but answer different questions ("did we break anything?" vs
"is anyone asking for this?").

### Technical axis — 3 PRs, 3 reversion boundaries

| PR | Change | Gate / Test | Changes production behavior? |
|----|--------|-------------|------------------------------|
| **A0** — Refactor to single source | Extract pure `resolveGroup(item, profile)` / `resolveCategory(item, profile)` into a new util. DEFAULT seed **faithfully reproduces the current constants, bugs included** (the `Set.has` exact-match path is preserved on purpose). Also lands (all behavior-preserving): `validateProfile` rejects a category missing `deviceProfiles` (closes bug #3's silent `[]`), runtime fallback to DEFAULT when the attribute is absent/corrupt, and a guard in `categorizeItemsByGroup` against `onDataUpdated` firing during the `onInit` await. | **Equivalence golden** — old-constants path vs `resolver + DEFAULT` over a real device fixture, asserting **zero diff**. | **No.** Pure refactor + lifecycle hygiene. |
| **A1** — Bug fix | Flip `Set.has` → `identifierContains` (substring), unifying with `equipmentCategory.js` (already `.includes()`). Fixes bug #1 (CAG), #2 (column exact-match vs breakdown substring now resolve through one function), #3. Migrate the `inferLabelWidget` substring path (MAIN_VIEW:866) too. | **Migration snapshot** — lists each device that changes bucket *by name* ("CAG 01: Outros→Climatização"); CI fails if the diff diverges from the human-reviewed snapshot. PR description **must** include a `device identifier \| bucket before \| bucket after` table. | **Yes — deliberately.** This is the bug fix. |
| **B** — Customer attribute + UI | SERVER_SCOPE attribute as a **best-effort override**: any fetch/parse/validate failure → silent fallback to seed + audit log, never blocks render. Seed-in-code is the operational source of truth; the attribute only overrides. Standalone attribute key carrying `schemaVersion`. Holding-inheritance and water/temperature parity are **out of MVP**. | Validation via `validateProfile` (from A0); audit-log assertion on the fallback path. | **No** by default (override is opt-in per customer). |

#### Why A0's golden and A1's snapshot are *different* tests (and must stay that way)

This is the subtle correction to the original RFC, which described a single
"golden: old constants vs DEFAULT → zero change" test. That framing is
**self-contradictory** once the bugs are fixed — a DEFAULT that fixes CAG cannot
also be byte-identical to the buggy constants.

| | A0 — Equivalence golden | A1 — Migration snapshot |
|---|--------------------------|--------------------------|
| **Question it answers** | "Did the refactor change *anything*?" | "*What exactly* did the bug fix change?" |
| **Expected diff** | **Zero** — any diff fails the build | **Non-empty and reviewed** — the diff *is* the deliverable |
| **What a failure means** | The refactor leaked a behavior change | The fix touched buckets nobody approved |
| **Lifespan** | Frozen — guards the refactor boundary forever | Snapshot is re-baselined once, by a human, at A1 |

Collapsing these into one test is how a "harmless refactor" silently ships a
classification change. They are kept separate on purpose.

### Product axis — fix now, UI promoted by data

| Slice | What ships | Promotion gate / metric |
|-------|-----------|--------------------------|
| **1 — Fix + externalize** (now, no gate) | The 3-bug fix in code + the JSON seed externalized to SERVER_SCOPE (staff edit it directly via ThingsBoard admin — **no modal**). PLUS instrumentation: a **per-customer counter** of devices landing in `Outros` / fallback. | Ships immediately. The counter feeds the gates below. |
| **2 — Read-only transparency UI** | A panel showing *what's in `Outros`*, *why each device is there* (which rule matched, or none), and *orphans with no rule*. Read-only — **no write, no live re-classification**. Serves diagnosis (operator) + onboarding (staff). | After the fix: **≥ 5 devices/customer across ≥ 3 customers** still land in `Outros` *for lack of a rule* (not a bug) over **2 monthly cycles**. |
| **3 — Edit map + create-rule-by-demonstration** | Editing the map and authoring rules in plain language by demonstration. The word **"prefix" is never shown to the user**. | Slice 2 is *actually used* by real operators (usage telemetry over **2 months**). |

### Measurement plan — making the promotion gates falsifiable

The Slice 2 gate is only real if we measure **genuine orphans** (no explicit rule
matched), not bug-symptom fallbacks. This requires the resolver to expose **why** it
returned the fallback.

- **Orphan definition**: a device is an `orphan` iff `resolveCategory(device)` returns
  the fallback category **and** `matchedBy === 'fallback'`, where the resolver returns
  `{ category, matchedBy }` with `matchedBy ∈ { 'deviceProfile', 'identifier',
  'explicit-other', 'fallback' }`. A device that matched an explicit rule whose target
  *is* "Outros" (`explicit-other`) is **not** an orphan.
- **Capture point**: extend the existing `areacomum_breakdown` event with
  `orphans: { count, deviceIds[], suggestedPatterns[] }`, accumulated in the same loop
  that already calls `resolveCategory`; mirror to `window.STATE[domain].orphans` for the
  Slice 2 read-side. A best-effort daily telemetry write of `count` per `customerId`
  provides durability for the two monthly series — it consumes the computed count, never
  recomputes (anti-double-counting).
- **Baseline (answers "how many deploys in 6 months")**: two converging vectors —
  *retrospective* (mine `git log` + RFC-0111/0128 + `DEVICE-CLASSIFICATION-MAP.md`
  errata for past classification fixes) and *prospective* (the A1 migration-snapshot
  move-count is a direct proxy for accumulated misclassification pain). Devices moved by
  the snapshot are **fixed, not orphaned** — they do not count toward orphans.
- **Promotion rule (falsifiable)**: promote Slice 2 iff `orphan_count(customer) >= 5`
  across `>= 3 customers`, sustained over `2 monthly cycles`, all `matchedBy ===
  'fallback'`. A **negative** result (fewer orphans) **kills Slice 2** — the fix was
  enough, and that is a successful outcome, not a failure.
- **`suggestedPatterns`**: for each orphan, compute the would-be rule (common identifier
  substring like `CAG`, or common uncovered `deviceProfile`). This both qualifies the
  metric and pre-bakes Slice 3's rule-by-demonstration; the *distribution* of patterns
  over the two cycles answers the new open question below by data.

### Resolves these Unresolved Questions

Mapping back to the RFC's existing *Unresolved questions* list:

| Unresolved question | Resolution |
|---------------------|------------|
| Attribute key naming | **Standalone key**, carrying its own `schemaVersion`. |
| Holding / customer inheritance | **Out of MVP.** |
| What triggers re-classification | **Best-effort override** — attribute read on load; failure falls back to seed silently + audit log. No live re-classification in MVP. |
| Water / temperature parity | ✅ **Implemented** (follow-up #2) — domain-generic resolver + seed + delegation + modal tabs. |
| Where the default seed lives | **In code, as the operational source of truth.** The customer attribute only *overrides* it. |

### New open question (John → Sally)

| # | Question | Why it matters |
|---|----------|----------------|
| Q-new | In Slice 2, do orphans appear **grouped by suggested pattern** ("3 devices containing 'CAG' with no rule") or **device-by-device**? | Grouping plants the seed of *rule-by-demonstration* for Slice 3 — the read-only view's information architecture pre-shapes whether Slice 3 feels natural or bolted-on. Decided by the `suggestedPatterns` distribution (see measurement plan). |

---

## Addendum — RFC-0207 v2: Fully Configurable Group/Subcategory Tree (proposed, 2026-06-23)

> **Status:** PROPOSED — design only, **not implemented**. Authored from operator
> feedback. This addendum **supersedes the v1 schema and the fixed
> groups/categories model**; the v1 resolver, seed, modal, and load/save remain
> the implementation baseline to evolve.
> **Related:** `src/docs/CLIMATIZACAO-SUBCATEGORIES-DUPLICATION-MAP.md` (the
> hard-coded subcategory labels this redesign removes).

### A. Why v2 (what v1 still doesn't solve)

v1 unified the *rules' source* and fixed the 3 classification bugs, **but**:

1. **Groups are fixed.** The column buckets are a closed set (`entrada`, `lojas`,
   `areacomum`, `ocultos`) and the energy breakdown is a closed set
   (`climatizacao`, `elevadores`, `escadas_rolantes`, `outros`). An operator
   **cannot create a new group** (e.g. *Estacionamento*) without a code release.
   *Reflection point raised by the operator:* nothing should cap the set — groups
   must be **operator-defined**.
2. **Subcategories are not modeled.** The climatização sub-breakdown
   (**Chillers / Fancoils / Bombas Hidráulicas / Outros HVAC**) lives as
   **hard-coded labels + inline rules** in `MAIN_VIEW`, `MYIO-SIM/MAIN` and
   `TELEMETRY_INFO` (see the duplication map). There is **no nesting** in the
   profile and the labels are not config-driven.
3. **No per-customer structural variation.** Customer A may want *Elevadores* split
   into *Elev. Social* + *Elev. Carga*; customer B may want *Estacionamento* with
   *Coberto* + *Externo*. v1 can't express either.

### B. New requirements

| # | Requirement |
|---|-------------|
| R1 | **Arbitrary groups** — the operator creates group cards at will: each with `key`, `label`, **`description`**, and rules. The 5 current groups become just the *default seed*, not a hard limit. |
| R2 | **Arbitrary nesting (subcategories)** — any node may have `children`, recursively. Examples: Climatização → {Chillers, Fancoils, Bombas Hidráulicas, Outros HVAC}; Elevadores → {Elev. Social, Elev. Carga}; Estacionamento → {Coberto, Externo}. |
| R3 | **Three rule kinds, period** — `deviceProfile` **exact match** + `identifier` **contém / exato / prefixo**. **Drop** `deviceType` entirely, drop `combinedContains` ("texto contém"), drop `conditional`. (The modal already removed "texto contém" and the deviceType conditional in v1's UI cleanup.) |
| R4 | **Config-driven labels/icons** — no hard-coded subcategory label or icon anywhere; everything renders from the node's `label`/`icon`. |
| R5 | **Unique allocation** — a given `deviceProfile`, or a given identifier rule, may belong to **exactly one node** in the whole domain tree. E.g. `MOTOR` cannot be in both *Climatização* and *Outros Equipamentos*. The modal **blocks** duplicate allocation; `validateProfile` rejects it. |
| R6 | **UPPERCASE** — `deviceProfile` and `identifier` values are normalized to **UPPERCASE** on input and storage. (Identifiers are otherwise free text.) |
| R7 | **Predefined deviceProfile catalog** — when adding a `deviceProfile`, the modal shows a **dropdown** from a shared catalog plus **"Outro (digitar)…"** (mirrors `BULK_DEVICE_TYPE_OPTIONS` in `openUpsellModal.ts`). Identifiers remain free-text inputs. |
| R8 | **Computed nodes (by flag)** — besides classification nodes, the tree carries **derived** cards: a **residual** ("Pontos Não-Mapeados" = `Entrada − Σ(consumers)`) and an **aggregate total** ("Total Consumidores" = `Σ(consumers) [+ Área Comum]`). These have **no rules**; their value is computed from other nodes. |
| R9 | **Node roles** — `entrada` (supply), `consumer` (counts toward consumption), `fallback` (collects devices that matched no sibling rule), `residual`/`total` (computed), `ocultos` (archived/hidden, short-circuits). |

### C. New JSON schema (v2) — a recursive node tree

`schemaVersion: 2`. Each domain holds an ordered `tree` of **nodes** instead of the
flat `groups` + `categories` of v1.

```jsonc
{
  "schemaVersion": 2,
  "updatedAt": "2026-06-23T12:00:00.000Z",
  "updatedBy": "operator@myio.com.br",
  "matching": { "caseInsensitive": true, "upperCase": true },

  // Catalog powering the modal "Adicionar deviceProfile" dropdown (+ "Outro").
  // Lifted/shared from openUpsellModal.BULK_DEVICE_TYPE_OPTIONS.
  "deviceProfileCatalog": [
    "3F_MEDIDOR","CHILLER","FANCOIL","AR_CONDICIONADO","BOMBA_HIDRAULICA","BOMBA_CAG",
    "BOMBA_INCENDIO","COMPRESSOR","VENTILADOR","MOTOR","ELEVADOR","ESCADA_ROLANTE",
    "RELOGIO","ENTRADA","SUBESTACAO","TRAFO"
  ],

  "domains": {
    "energy": {
      "tree": [
        {
          "key": "entrada", "label": "Entrada", "role": "entrada",
          "description": "Medição de fornecimento/entrada.",
          "rules": { "deviceProfiles": ["TRAFO","ENTRADA","RELOGIO","SUBESTACAO"] }
        },
        {
          "key": "lojas", "label": "Lojas", "role": "consumer",
          "rules": { "deviceProfiles": ["3F_MEDIDOR"] }
        },
        {
          "key": "climatizacao", "label": "Climatização", "role": "consumer",
          "icon": "❄️",
          "rules": { "deviceProfiles": ["HVAC","AR_CONDICIONADO"] },
          "children": [
            { "key": "chillers",  "label": "Chillers",  "icon": "❄️", "rules": { "deviceProfiles": ["CHILLER"], "identifierPrefixes": ["CHILLER-"] } },
            { "key": "fancoils",  "label": "Fancoils",  "icon": "🌀", "rules": { "deviceProfiles": ["FANCOIL"], "identifierPrefixes": ["FANCOIL-"] } },
            { "key": "bombas_hidraulicas", "label": "Bombas Hidráulicas", "icon": "💧", "rules": { "deviceProfiles": ["BOMBA_HIDRAULICA"], "identifierContains": ["CAG"] } },
            { "key": "outros_hvac", "label": "Outros HVAC", "role": "fallback" }
          ]
        },
        {
          "key": "elevadores", "label": "Elevadores", "role": "consumer", "icon": "🛗",
          "rules": { "deviceProfiles": ["ELEVADOR"], "identifierPrefixes": ["ELV-"] },
          // OPTIONAL per-customer split into sub-subcategories:
          "children": [
            { "key": "elev_social", "label": "Elev. Social", "rules": { "identifierContains": ["SOCIAL"] } },
            { "key": "elev_carga",  "label": "Elev. Carga",  "rules": { "identifierContains": ["CARGA"] } }
          ]
        },
        { "key": "escadas_rolantes", "label": "Esc. Rolantes", "role": "consumer", "icon": "🎢",
          "rules": { "deviceProfiles": ["ESCADA_ROLANTE"], "identifierPrefixes": ["ESC-"] } },
        { "key": "outros", "label": "Outros Equipamentos", "role": "consumer", "icon": "⚙️",
          "rules": { /* explicit profiles/identifiers */ } },

        // Computed cards (no rules):
        { "key": "nao_mapeados", "label": "Pontos Não-Mapeados", "role": "residual",
          "formula": { "op": "subtract", "from": "entrada",
                       "subtract": ["lojas","climatizacao","elevadores","escadas_rolantes","outros"] } },
        { "key": "total_consumidores", "label": "Total Consumidores", "role": "total",
          "formula": { "op": "sum", "of": ["lojas","climatizacao","elevadores","escadas_rolantes","outros","nao_mapeados"] } },

        { "key": "ocultos", "label": "Ocultos", "role": "ocultos",
          "rules": { "deviceProfiles": ["ARQUIVADO","SEM_DADOS","DESATIVADO","REMOVIDO","INATIVO"] } }
      ]
    },
    "water":       { "tree": [ /* same node shape */ ] },
    "temperature": { "tree": [ /* same node shape */ ] }
  }
}
```

**Node shape:**

```ts
interface ClassificationNode {
  key: string;            // stable id, unique within the domain tree
  label: string;          // display name (config-driven; no hard-coded labels)
  description?: string;   // operator note, shown in the modal card
  icon?: string;          // optional emoji/icon for tooltips/breakdown
  role?: 'entrada' | 'consumer' | 'fallback' | 'residual' | 'total' | 'ocultos';
  rules?: NodeRules;      // present on classification nodes (omit on computed)
  children?: ClassificationNode[];   // subcategories (recursive)
  formula?: NodeFormula;  // present on computed nodes (residual/total)
}

interface NodeRules {           // R3 — only these three kinds
  deviceProfiles?: string[];    // exact match (UPPERCASE) on item.deviceProfile
  identifierExact?: string[];   // identifier === value (UPPERCASE)
  identifierContains?: string[];// identifier.includes(value)
  identifierPrefixes?: string[];// identifier.startsWith(value)
}

interface NodeFormula {         // R8 — computed cards
  op: 'subtract' | 'sum';
  from?: string;                // for subtract: base node key (e.g. 'entrada')
  subtract?: string[];          // for subtract: node keys to subtract
  of?: string[];                // for sum: node keys to add
}
```

### D. Resolution algorithm (generic tree walk)

Replaces the v1 `resolveGroup`/`resolveCategory` pair with **one** generic walker
over the node tree (per domain):

1. **Ocultos short-circuit** — if the device matches any `role:'ocultos'` node, it's hidden.
2. **Depth-first, deepest-match-wins** — walk the tree; a device is allocated to the
   **deepest** node whose `rules` match. Because allocation is **unique (R5)**, at most
   one node can claim it, so order is not load-bearing — but the walk is still
   deterministic (declared order) for ties that validation should have prevented.
3. **Per-level fallback** — a device that matches no sibling at a level lands in that
   level's `role:'fallback'` node (e.g. *Outros HVAC* inside Climatização; *Outros
   Equipamentos* at the top consumer level), if one exists.
4. **Aggregation** — a parent node's value = Σ(children) + own directly-matched devices.
5. **Computed nodes last** — after classification, evaluate `formula` nodes
   (`residual`/`total`) from the already-computed node values.

The resolver returns `{ nodePath: string[], matchedBy }` so the breakdown, the
`labelWidget` card filter, and the orphan metric (from v1's measurement plan) all
derive from one call.

### E. Unique-allocation invariant (R5) + validation

`validateProfile(profile)` (extended) must reject:

- the **same `deviceProfile`** present in more than one node of a domain tree;
- the **same identifier rule** (exact/contains/prefix value) in more than one node;
- a `formula` referencing an unknown node `key`;
- more than one `fallback` among **siblings** (one residual bucket per level);
- empty `label`/`key`, or duplicate `key` within the domain.

The modal enforces R5 **at edit time**: when an operator drags/types a `deviceProfile`
already allocated elsewhere, it's blocked with a pointer to the owning node.

### F. Predefined deviceProfile catalog (R7)

- Add a shared catalog (lift `BULK_DEVICE_TYPE_OPTIONS` from
  `src/components/premium-modals/upsell/openUpsellModal.ts` into a shared util, or
  carry it on the profile as `deviceProfileCatalog`).
- In `openDeviceProfileModal`, the **"Adicionar"** action for a `deviceProfile` field
  opens a **`<select>`** (catalog + **"Outro (digitar)…"**) instead of a free text
  chip input — exactly the upsell pattern. **Identifier** fields stay free-text chips
  (UPPERCASED on commit).

### G. Modal changes (`openDeviceProfileModal`)

- **Create/rename/describe** group cards and subcategories; **nest** (add child node);
  reorder; mark a node's `role` (consumer / fallback / residual / total / ocultos).
- `deviceProfile` add → catalog dropdown + "Outro"; identifier add → free text.
- All values shown/stored **UPPERCASE**.
- Live preview already lists devices per node (v1 + the (i)/"+" popover); extend it to
  the nested tree and flag **unique-allocation conflicts**.
- (v1 already: standard header, "texto contém"/conditional removed, expand/collapse-all.)

### H. TELEMETRY_INFO cards (energy example, generated from the tree)

The cards are **rendered from the tree**, not hard-coded:

```
- Entrada                         (role: entrada)
- Lojas                           (consumer)
- Climatização                    (consumer)  ├─ Chillers / Fancoils / Bombas Hidráulicas / Outros HVAC
- Elevadores                      (consumer)  ├─ (opt.) Elev. Social / Elev. Carga
- Esc. Rolantes                   (consumer)
- Outros Equipamentos             (consumer / fallback)
- Pontos Não-Mapeados             (residual = Entrada − Σ(consumers))
- Total Consumidores              (total = Σ(consumers) [+ Área Comum])
```

Subcategory breakdown (the (i)/"+" detail) comes from each node's `children` and
labels — **no hard-coded "Bombas Hidráulicas"** anywhere.

### I. Architecture & ownership

- **MAIN_VIEW is the sole owner of persistence.** Load (SERVER_SCOPE GET), normalize
  (v1→v2 migration), expose `window.MyIOUtils.deviceClassificationProfile`, **save**
  (SERVER_SCOPE POST), and re-dispatch orchestrator events on save — all here. The
  endpoint URL/keys live **only** in MAIN_VIEW.
- **MENU is endpoint-agnostic.** It only opens `openDeviceProfileModal`, passing
  **callbacks** (`getProfile()`, `saveProfile(next)`) provided by MAIN_VIEW (or it
  dispatches an event MAIN_VIEW handles). The MENU must **not** know the attribute key
  or call the TB API. *(v1 currently fetches/POSTs inside the modal — v2 moves that to
  MAIN_VIEW.)*
- **Tooltips are config-driven.** `src/utils/EnergySummaryTooltip.ts`,
  `WaterSummaryTooltip.ts`, `TempSensorSummaryTooltip.ts` render groups/subcategories,
  **labels and icons from the profile tree** — no hard-coded category names.
- **Controllers under `WIDGET/`** adjusted where it makes sense (TELEMETRY /
  TELEMETRY_INFO consume the tree-shaped summary; `buildCategorySummary` carries
  `label`/`icon` from the node so consumers stop redefining them — closes the
  duplication mapped in `CLIMATIZACAO-SUBCATEGORIES-DUPLICATION-MAP.md`).

### J. Migration (v1 → v2)

- `normalizeProfile` gains a **1→2 migration**: a v1 doc (`groups` + `categories`) is
  lifted into a v2 `tree` reproducing today's structure (Entrada/Lojas/Área Comum +
  Climatização/Elevadores/Esc.Rolantes/Outros, with Chillers/Fancoils/Bombas as
  Climatização `children`).
- The **DEFAULT seed** is re-expressed in v2 and must pass an **equivalence golden**
  (same device → same leaf as v1) so externalizing structure changes no classification.
- `schemaVersion: 1` attributes keep working (auto-migrated on load).

### K. Invariants checklist (v2)

- Every visible label/icon comes from a node (no literals in controllers/tooltips).
- `deviceProfile`/`identifier` are UPPERCASE in storage and matching.
- No `deviceProfile`/identifier rule is allocated to more than one node (validated).
- `deviceType` is **not** used by the classifier anywhere.
- Computed nodes reference only existing node keys; one fallback per sibling level.
- MENU never references the SERVER_SCOPE endpoint/key.

### L. Open questions (v2)

1. **Depth limit** for nesting (2 levels enough — group → subcategory → sub-sub? or unbounded)?
2. **"Total Consumidores"** composition — does it include the residual ("Área Comum"/Pontos Não-Mapeados) or only rule-matched consumers? (The operator's note includes Área Comum.)
3. **Residual semantics** — is "Pontos Não-Mapeados" the *value* residual (`Entrada − Σ`) only, or also the device-level `fallback` bucket? (Design treats them as **two** distinct node roles: `fallback` = unmatched devices; `residual` = computed value.)
4. **Catalog source of truth** — carry `deviceProfileCatalog` on the profile (editable per customer) vs a shared code constant (lifted from upsell). 
5. **Identifier rule precedence** when a device matches an `identifierExact` in one node and an `identifierContains` in another — should validation forbid this overlap outright (R5 implies yes)?

---

_This RFC replaces the hard-coded map documented in
`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/DEVICE-CLASSIFICATION-MAP.md`._
