# RFC-0207 — Customer-Scoped Device Classification Profile

- **RFC**: 0207
- **Title**: Customer-Scoped Device Classification Profile (SERVER_SCOPE JSON + MENU management modal)
- **Status**: Implemented (v1) — A0/A1/A1b (single-source resolver + bug #1/#2 fixes, golden-tested) + Phase B (customer SERVER_SCOPE attribute load in MAIN_VIEW.onInit + premium MENU management modal `openDeviceProfileModal`). Branch `feat/rfc-0207-b-attribute-and-menu` → PR to `desenv`.
  **+ v2 redesign — PROPOSED (2026-06-23)**: fully configurable group/subcategory **tree** (create groups at will, nest subcategories, config-driven labels, unique allocation, UPPERCASE, predefined deviceProfile catalog, computed residual/total nodes). See **§ Addendum — RFC-0207 v2**.
  **+ v3 FINAL — COMPILED (2026-06-23)**: the **engine/tree seam** + **swappable `ProfileSource`** + **locked responsibility split** (lib × MAIN_VIEW × GCDR). Consolidates the full feedback series (GCDR v1→v5 + MyIO-Lib v4) and **absorbs the standalone `RFC-0207-v3` file and the feedback/reconciliation docs (now removed)**. See **§ Addendum — RFC-0207 v3 (FINAL, compiled)** at the end — this is the canonical design to implement. The v1 sections describe what shipped; v2 gives the tree schema; v3 is the final contract.
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
| Holding / customer inheritance | **Decided (v2, 2026-06-23): no inheritance.** Per-customer self-contained profile; each entity (head office / holding / shopping) carries its own full document; dashboard uses the active/selected customer's profile (see Addendum v2 § I). |
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

- **Storage scope — per-customer, self-contained, NO inheritance (decided 2026-06-23).**
  The profile lives as a `deviceClassificationProfile` SERVER_SCOPE attribute on the
  **customer the dashboard is bound to** (`window.MyIOUtils.customerTB_ID`) — exactly
  as v1 already does. **Every entity carries its own full document**: the Head Office
  has its own, each Holding has its own, each Shopping (child customer) has its own.
  There is **no merge and no template-copy** between parent and child (options "merge
  deltas" and "template copy" were considered and **rejected** for simplicity — N
  configs is accepted). When a customer has no attribute yet, the **DEFAULT seed** is
  used (fail-open to default behavior). *(This supersedes the original addendum's
  "Holding / customer inheritance — Out of MVP" line: inheritance is not deferred, it
  is **deliberately not done**.)*
  - **Active-customer rule (head-office / UNIQUE dashboards):** when the view is the
    **aggregate** (the head office itself), classify with the **head-office customer's**
    profile; when a **specific shopping is selected/filtered**, classify with **that
    shopping's** profile. The resolver always uses the profile of the **active/selected
    customer**, never a blend of several.
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

## Addendum — RFC-0207 v3 (FINAL, compiled 2026-06-23)

> **Status:** FINAL — the canonical design to implement. Compiles the whole feedback
> series (GCDR v1→v5 + MyIO-Lib v4) and the reconciliation. **Absorbs and replaces**
> the standalone `RFC-0207-v3-ClassificationEngineSeam-and-GCDRReadiness.md` and the
> `CLIMATIZACAO-…-FEEDBACK-BY-GCDR-V1/V3`, `…-FEEDBACK-BY-MYIO-LIB-V4`, and
> `…-FEEDBACK-BY-GCDR-V5`, and `…-RECONCILIATION-…` docs (the entire feedback series,
> all removed). The only surviving companion is the problem map
> (`CLIMATIZACAO-SUBCATEGORIES-DUPLICATION-MAP.md`). v3 **keeps** v2's tree, modal,
> per-customer scope and no-inheritance; it adds the engine/store seam and locks ownership.

### A. The two-tier model + the central thesis

- **Tier-1** (already RFC-0207 v1/v2, golden, **code**): `device → grupo` (energy / água / climatização / …).
- **Tier-2** (new, golden, **code**, group-generic): inside a group with children → subcategoria (chiller / fancoil / bomba / cag / outros-HVAC; and analogously *Outros* → iluminação / incêndio / geradores). Tier-2 is what was hard-coded/duplicated; it now has a canonical home.
- **Central thesis — separate the *engine* from the *tree*:** the **engine** (how rules evaluate — `exact`/`contains`/`prefix`, UPPERCASE, deepest-match-wins, fallback-per-level, unique allocation, computed nodes) is **golden-locked code**, keyed by the stable node **`key`**. The **tree** (which nodes exist, labels, icons, nesting, `order`, and membership lists) is **operator-authored data** behind a **swappable store**. The operator authors **membership data**; never the **evaluator**. `node.key` *is* the GCDR `entity_key` — the seam.
- **`match()` is NEVER data/metadata.** Predicate-as-data = a DSL + golden-at-runtime + an execution door. The bounded rule kinds (R3: `deviceProfiles`/`identifierExact|Contains|Prefixes`) are **value lists**, not expressions — that is data; arbitrary predicates remain forbidden.

### B. `ProfileSource` — swappable store (pure × I/O boundary)

```ts
interface ResolvedProfile {
  version: string;                 // etag of the resolved tree for this customer
  source: 'customer' | 'system' | 'baked';
  domains: Record<string, { tree: ClassificationNode[] }>; // v2 node shape, each node carrying `order`
}
interface ProfileSource { resolve(customerId: string): Promise<ResolvedProfile>; }
```

- **Lib (pure, zero-dep, golden):** the generic walker (`resolveClassification`/`resolveSubcategory`), `validateProfile`, `normalizeProfile`, the `ProfileSource` **interface**, and the `BakedProfileSource` (in-bundle versioned default, generated from the in-code seed). **The lib never does `fetch`.**
- **MAIN_VIEW (I/O owner):** `TbAttributeProfileSource` (SERVER_SCOPE GET/POST, today) and, conditionally, `GcdrResolveProfileSource` (`GET /api/v1/entities/resolve?customerId=`, `X-Version-Id`/304). The consumer/walker is identical regardless of source — moving TB→GCDR is a one-line swap behind a flag.
- **SIM and WIDGET share one `ProfileSource`** (the duplication's root cause is SIM being a copy): both use the **same** source, with `BakedProfileSource` as the common offline floor. No private "test JSON" in SIM.

### B.1 Consumption contract — HARD requirements (not prose)

Four guarantees that protect against bugs that **fail silently**. Each is a build/test gate, not a recommendation:

1. **Deterministic order.** Every node carries an **explicit integer `order`**; siblings are evaluated by `order` ascending. A `ProfileSource` returns nodes **already ordered** and carries the number (never relies on array/row/JSON-key order — Postgres rows/serializers are not stable). **Build assertion:** the `role:'fallback'` node is the highest `order` at its level (else `()=>true` shadows real rules). **Golden:** an order-sensitivity case (a device that matches the fallback *and* would match an earlier sibling if order inverted).
2. **Versioning / caching.** `/resolve` returns **`X-Version-Id`**; the consumer sends `If-None-Match` → **`304`** with no body when unchanged. Reuses the alarm-bundle pattern (no new mechanism). The baked carries the `version` it was generated at (detects "stale baked").
3. **Baked default versioned.** Generated in **build-time** from the in-code seed (derived artifact, never hand-edited → never a 5th copy); carries its `version`. **Key-parity test (CI, hermetic/by file):** `keys(engine) === keys(baked)` (== GCDR `is_system` keys in v3.2). Divergence fails the build.
4. **Degradation — specified AND tested.** Chain: valid cache (304) → `resolve()` 200 → on `resolve()` throw (timeout/5xx/CORS/invalid JSON/validation) **fall back to `BakedProfileSource`**; never throw to render, never blank the dashboard. Logs structured (`source:'baked', reason, customerId, bakedVersion`) + mirrored to telemetry. **Mandatory tests = fault injection** (mock `resolve()` → timeout/500/corrupt JSON ⇒ assert baked used + dashboard renders + log emitted) and stale-baked.

### C. The 6 library constraints (accepted, MyIO-Lib v4 / GCDR v5)

1. **Bundle budget** — UMD-min ≤25 KB (gzip ≤26). The baked default always ships in the UMD (no tree-shaking for widgets). **Measure it; gate it; move to a subpath if over budget.**
2. **`MyIOUtils` bridge** — every new symbol must be registered in `LIB_SYMBOLS` on MAIN_VIEW (children read via the getter bridge, RFC-0126).
3. **Pure × I/O** — see §B (lib pure; I/O in MAIN_VIEW).
4. **Tier-2 group-generic** — `resolveSubcategory(device, groupKey, tree)`; climatização **and** "Outros" are just two groups with children, no special-casing.
5. **Release-gating** — A / v3.1 / v3.2 are publish events (build passing size-gates → `dist` published → widget reloads UMD via homolog channel/version-checker), not just commits.
6. **Don't break v1** — `resolveGroup`/`resolveCategory` stay as thin aliases over the generic walker through v3.x; the v1 export surface is preserved.

### D. Responsibility split — LOCKED (the deliverable, from GCDR v5 §7)

| Responsibility | 📦 Lib | 🖥️ MAIN_VIEW | 🗄️ GCDR (RFC-0047) |
|---|---|---|---|
| walker `resolveClassification`/`resolveSubcategory` | **owner** (pure, golden) | calls | — |
| `validateProfile` / `normalizeProfile` | **owner** (pure) | calls | — |
| `ProfileSource` interface + types | **owner** | implements concretes | — |
| `BakedProfileSource` (offline default) | **owner** (from in-code seed) | uses as floor | keeps default tree bounded |
| `match()` / engine semantics | **owner** (golden) | — | **never** |
| `TbAttributeProfileSource` (TB I/O) | — | **owner** | — |
| `GcdrResolveProfileSource` (HTTP+304) | — | **owner** | serves `/resolve` |
| `name`/`icon`/`set` (declarative tree) — **authored by MYIO operator only; NO customer-facing edit, NO "request reclassification" flow** | baked default only | hosts the editor (modal) + persists | **store owner** (v3.2): TB attr → GCDR; the per-customer tree is **MYIO-authored**, not client-authored |
| canonical `key` list (parity source) | consumes (committed fixture) | — | **publishes** (versioned artifact) |
| versioning `X-Version-Id`/304 | — | client | server |
| i18n `metadata.nameKey` + override | translates default via `nameKey` | passes node | stores `nameKey` + override |
| bundle budget / size-gate | **owner** | — | keeps default small |
| `MyIOUtils` / `LIB_SYMBOLS` | exports | **registers** | — |

### E. Phasing (Porta 0 = product gate)

| Phase | What | Store | GCDR? | Gate |
|---|---|---|---|---|
| **A** — display | TELEMETRY_INFO reads `details.name` **and** `details.icon`; `buildCategorySummary` carries `icon` | — | no | none — do now |
| **v3.1** — engine seam | walker (group-generic) + `ProfileSource` + `BakedProfileSource` + explicit `order` + degradation + golden (key-parity, order-sensitivity, bomba-not-incêndio); I/O sources in MAIN_VIEW | TB attr + baked | no | none — hardens v2 in place |
| **v3.2** — GCDR | `GcdrResolveProfileSource` behind a flag; declarative tree authored in GCDR/RFC-0047; key-parity becomes a live cross-store contract; SIM+widget same source | GCDR `/resolve` + baked | **yes** | **Porta 0** |

### F. Golden (engine-level, independent of customer data)

Equivalence (v1) · migration snapshot (A1) · **order-sensitivity** (fallback never shadows a real sibling) · **key-parity** (engine keys == baked keys == GCDR `is_system` keys, reconciled **by committed file, not network**) · **bomba-not-incêndio**. **MYIO-operator** edits change **data** (the tree), not the engine — so the engine is golden once, forever. **A golden-on-save** (snapshot → reclassify → diff → warn/block regression) guards the operator's edits at write time. *(There is no customer-facing edit — see §I.3.)*

### G. Closed questions (resolved across the series)

- I/O of `/resolve` → **MAIN_VIEW**; lib never fetches.
- Baked from build-time GCDR fetch? → **No** — in-code seed; GCDR reconciled by committed key-list (hermetic CI).
- i18n → **`metadata.nameKey` (translatable default) + display override**.
- Tier-2 group-generic → **yes** (GCDR model is generic by construction).
- Versioning → **`X-Version-Id`/304** (alarm-bundle pattern).
- Dual-run cache → keyed by **`(customerId, source, version)`**.
- **Porta 0 ("does a real, named customer diverge?") → ANSWERED YES by the PO** (every customer has 1–3 different categories; the fixed set doesn't fit all). So v3.2/GCDR is *justified* — still sequenced after v3.1.

### H. Open points the PO did NOT answer — **decided by the maintainer** (good-sense defaults, to revisit)

> These were left open by the PO; documented here and **decided** so implementation is not blocked. Each is reversible and flagged for PO review.

1. **"Total Consumidores" / residual formula.** **Decided:** the residual node **"Pontos Não-Mapeados" (Área Comum)** = `Entrada − Σ(grupos consumidores diretos)`; **"Total Consumidores"** = `Σ(grupos consumidores diretos) + residual` — which **reconciles to Entrada** by construction (a sanity invariant). Entrada is the **base**, never a consumer addend. Both are `derived` (computed) nodes, op `subtract`/`sum`. *(Matches the PO's original card structure.)*
2. **Baked size — core vs subpath.** **Decided:** ship in **core** initially with a dedicated classification size-gate; if it pushes UMD-min over the 25 KB budget, **move to the subpath `myio-js-library/classification-default`** (tooltips precedent). Measure-then-gate.
3. **`LIB_SYMBOLS` (bridge).** **Decided initial set:** `resolveClassification`, `resolveSubcategory`, `resolveGroup`, `resolveCategory`, `validateProfile`, `normalizeProfile`, `BAKED_DEFAULT_PROFILE`.
4. **Release plan.** **Decided:** 3 releases (A, v3.1, v3.2), each validated on the **homolog** channel before prod; A and v3.1 carry no GCDR dependency.
5. **Deprecation of `resolveGroup`/`resolveCategory`.** **Decided:** keep as aliases through all v3.x; remove only in a future **major** with a deprecation note.
6. **`ProfileSource` selection.** **Decided:** **global flag** during v3.2 rollout; per-customer only if mixed stores are ever needed.
7. **`deviceProfileCatalog` ownership.** **Decided:** in-code/baked in v3.1; **GCDR data in v3.2**, with the engine validating against it.
8. **Baked regeneration.** **Decided:** the **in-code DEFAULT seed remains the build seed**; GCDR `is_system` is reconciled to it by the key-parity test (committed file), never by build-time fetch (hermetic build).
9. **Icon format.** **Decided:** **token + curated SVG picker** (never free emoji) — fixes the emoji used in the showcase.

### I. Final roundtable (2026-06-23) — decisões do mantenedor + pontos para o PO

> Última rodada party-mode sobre este RFC compilado (Winston/Amelia/John/Sally/Paige).
> Consenso: **sem bloqueador de engenharia para a v3.1**; os bloqueios remanescentes são
> de **produto** e giram em torno de *"diff intencional × regressão"* e da *visibilidade do residual*.

#### I.1 Decisões do mantenedor (bom senso, adotadas da rodada — reversíveis, p/ revisão do PO)

- **D-a — `ProfileSource` em falha → baked (revisa §H-6).** `GcdrResolveProfileSource` (e qualquer source) **sempre** cai no `BakedProfileSource` em falha de `resolve()`; a flag só escolhe a *fonte primária*, nunca remove o piso (evita deny-all). *(Winston)*
- **D-b — Rollup hierárquico.** Cada device conta **uma vez**, na sua folha mais profunda; pai = `Σ(filhos) + matches diretos do pai`; o pai **não** re-soma os devices dos filhos. *(confirma a checagem do John)*
- **D-c — Teste da invariante (§H-1) = não-negatividade com tolerância relativa.** Asserir `residual >= -max(1e-6, |Entrada|*1e-9)`, **nunca** a identidade `Total === Σ + residual` (é tautologia). Somar em precisão plena; arredondar só na renderização. *(Amelia)*
- **D-d — Escopo do golden-on-save = fixture congelada in-code** (`GOLDEN_DEVICE_FIXTURE`, a mesma do golden de equivalência), síncrono (<2ms), **não** a base real do customer. *(Amelia)*
- **D-e — Entrega do golden-on-save = warning não-bloqueante** até o PO definir o gesto de "aceitar diff intencional" (loga regressão, não trava o save). *(Amelia)*
- **D-f — Fallback de ícone.** Token ausente/órfão → ícone **genérico do nó-pai (tier-2)**, nunca quadrado vazio, + badge staff "⚠ ícone órfão". *(Sally/Amelia)*
- **D-g — Residual é cidadão de 1ª classe.** "Pontos Não-Mapeados" é exibido como **linha de 1ª classe com % sobre a Entrada**; residual negativo → **alerta visível** (staff). *(os rótulos em si são PO-A.)* *(John/Sally)*
- **D-h — Preview de cobertura por regra = requisito v1.** Cada regra mostra "captura N devices" (clicável) — estende o preview/(i) que o modal já tem; é o antídoto da armadilha "começa com FC- esquece FANCOIL-03". *(Sally)*
- **D-i — "Pontos Não-Mapeados" clicável = requisito** (drill na lista de quem caiu lá). *(Sally)*
- **D-j — Reordenar listas/`order`** é edição de membership normal → passa pelo caminho de warning do golden-on-save, **não** é travado. *(Amelia)*
- **D-k — Regra de bifurcação documental (default).** O RFC fica **compilado enquanto o v3 for proposta**; **no 1º commit de implementação do v3, congela-se o RFC-0207 (Superseded/Implemented-v1) e abre-se o RFC-0208** (tempo verbal único, imperativo) referenciando o 0207 como origem. *(Paige — confirmação em PO-I.)*

#### I.2 Pontos para o PO (produto/processo — **não** decididos; aguardam você)

| # | Ponto | Origem |
|---|---|---|
| PO-A | **Rótulos do fechamento** — usar "Entrada (base)", "Consumidores Mapeados", "Não-Mapeados (X%)" em vez de "Total Consumidores"? Residual negativo = alerta visível ou silencioso? | John |
| PO-B | **Gesto de "aceitar diff intencional"** — quando o golden-on-save virar bloqueante, qual a UX de confirmar um diff que o operador *queria*? (até lá = warning, D-e) | Amelia |
| ~~PO-C~~ ✅ | **RESOLVIDO (§I.3):** edição é **sempre MYIO**, sem superfície de cliente. O golden-on-save guarda o **operador MYIO**. | Winston/Sally |
| PO-D | **Dia 1 da v3.1** — entra com **default tree gerado pelo engine** (override opcional) ou exige **árvore curada por customer** antes do deploy? (custo de migração escondido) | John |
| PO-E | **Janela de divergência no rollout v3.2** — customer sem árvore reconciliada vê **baked silencioso**, **baked + banner**, ou **tela bloqueada**? | Winston |
| PO-F | **SLA/cadência da reconciliação por arquivo** — quem commita o `entity_key` por customer e quando (onboarding × batch)? | Winston |
| PO-G | **Dono/SLA do icon set curado** — quem cura o conjunto de ícones e qual o SLA p/ adicionar token? | Sally |
| ~~PO-H~~ ✅ | **RESOLVIDO (§I.3):** **não existe** fluxo de "solicitar reclassificação" — não há superfície de cliente. Removido do escopo. | Sally |
| PO-I | **Critério de bifurcação documental** — confirmar a regra D-k (congelar 0207 + abrir 0208 no 1º commit do v3)? | Paige |
| PO-J | **Device-testemunha do exemplo** — usar **CAG/Climatização** (expõe o bug histórico) ou um device neutro? | Paige |

> **Nota:** PO-B/PO-C/PO-D tinham a **mesma raiz** ("quem edita membership em produção?"). **PO-C foi respondido (§I.3) → PO-B e PO-D ficam mais simples** (não há gesto de cliente; o "diff intencional" e o "dia 1" são fluxos só-MYIO).

#### I.3 Decisões do PO confirmadas (2026-06-23, ao aprovar a poda)

Travadas pelo PO neste fechamento — **substituem** qualquer texto anterior que sugerisse superfície de cliente:

- **Edição é SEMPRE MYIO.** Não há superfície de cliente para editar `name`/`icon`/membership/estrutura, e **não existe** o fluxo "solicitar reclassificação" (removido do escopo). Resolve **PO-C** e **PO-H**. O `openDeviceProfileModal` é ferramenta interna MYIO (gate `@myio.com.br` ∨ holding admin); o cliente apenas **consome** a classificação.
- **Membership viaja como DADO, avaliado por um motor genérico.** Criar uma subcategoria nova (Estacionamento, Iluminação…) = **inserir um nó na árvore (dado)**, **sem código novo** — confirma a tese motor×árvore (§A) e o group-generic (§C-4).
- **Alinhamento com RFC-0047 (GCDR):** a árvore declarativa per-customer, quando migrar para o GCDR (v3.2), é **autorada pela MYIO**, não clonada/sobrescrita pelo cliente. O override per-customer do RFC-0047 é usado como *store* da árvore MYIO-autorada, não como editor do cliente. O `match()`/motor permanece em código (nunca no RFC-0047), e a costura é o `key`=`entity_key`.
- **Store = endpoint JSON do GCDR (não TB SERVER_SCOPE).** O PO decidiu que o atributo de classificação passa a ser **servido e persistido pelo GCDR**; o **TB SERVER_SCOPE deixa de ser o store** (cai o "store interino no atributo TB" que a §B/§E descreviam para a v3.1). A **lib e o MENU não tocam o ThingsBoard**; o I/O (load + save) é do **MAIN_VIEW como cliente do GCDR** (`GcdrResolveProfileSource` + um `saveDeviceClassificationProfile`). O **baked default** permanece como piso offline. **Reuso do RFC-0047 (sem API dedicada):** load = `GET /entities/resolve?type=CLASSIFICATION_<DOMAIN>` (304); save = `PUT /entities/bulk-replace` **por `(customer, domain)`** (`If-Match` por domínio → 409); revert = `POST /entities/revert`. O `ResolvedProfile` é um **adaptador puro na lib** sobre `entities`. *(Impacto no código já aplicado: o `openDeviceProfileModal` removeu o `fetch`/POST ao SERVER_SCOPE e persiste via callback `onSave`; o MENU delega ao `window.MyIOOrchestrator.saveDeviceClassificationProfile`. Pendente: MAIN_VIEW implementar load (lazy por aba no modal; todos os domínios no boot do dashboard) + save por domínio contra o RFC-0047.)* **O contrato consumidor completo + as perguntas em aberto para o backend do GCDR estão consolidados em [`…-API-PENDING.md`](./RFC-0207-CustomerScopedDeviceClassificationProfile-API-PENDING.md)** (que absorveu e removeu a cadeia de feedback `…-FEEDBACK-FROM-GCDR` v1/v2).

> Efeito nas decisões anteriores: a linha §D de `name/icon/set` passa a "**MYIO-authored only**"; o "membership read-only + request reclassification" da rodada da Sally **deixa de existir** (não há cliente editando, logo não há o que pedir).

### J. Glossário, diagrama, device-testemunha e diff v1→v3 (Paige)

**Glossário (termos colidentes):**
- **deviceProfile** = atributo autoritativo de classificação. **deviceType** = legado, sendo **eliminado** (R3). **identifier** = texto livre, comparado em UPPERCASE.
- **grupo (tier-1)** = coluna (energy/água/climatização…). **subcategoria (tier-2)** = filho de um grupo (chiller/bomba…). **nó (`ClassificationNode`)** = item da árvore. **`key`** = id estável do nó = **`entity_key`** (a costura com o GCDR).
- **membership** = as listas de match (dado, autorável). **motor/engine** = a semântica de avaliação (código, golden-locked).
- **`ProfileSource`** = store trocável (TB attr → GCDR `/resolve` → baked). **baked default** = árvore default embutida no bundle (piso offline). **golden** = teste de classificação; **golden-on-save** = golden disparado na edição do operador.
- **residual / "Pontos Não-Mapeados" / Área Comum** = `Entrada − Σ(consumidores)` (nó computado). **catch-all "Outros"** = folha `role:fallback` que recolhe quem não casou. **customer ativo** = o customer cujo profile o dashboard usa (head office × shopping selecionado).

**Diagrama da árvore (energy):**
```
energy
├─ Entrada               role: entrada  (base; nunca addend)
├─ Lojas                 consumer
├─ Climatização          consumer
│  ├─ Chillers           deviceProfile CHILLER | id prefix "CHILLER-"
│  ├─ Fancoils           deviceProfile FANCOIL | id prefix "FANCOIL-"
│  ├─ Bombas Hidráulicas deviceProfile BOMBA_HIDRAULICA | id contains "CAG"
│  └─ Outros HVAC        role: fallback (maior `order` no nível)
├─ Elevadores            consumer        [opcional: Social / Carga]
├─ Esc. Rolantes         consumer
├─ Outros Equipamentos   consumer/fallback
├─ Pontos Não-Mapeados   role: residual  (derived: Entrada − Σ consumidores)
├─ Total Consumidores    role: total     (derived: Σ consumidores + residual ≡ Entrada)
└─ Ocultos               role: ocultos   (short-circuit)
```

**Device-testemunha (CAG) — caminho fim-a-fim:**
`device = { deviceProfile: 'BOMBA_HIDRAULICA', identifier: 'CAG 01' }`
1. **tier-1:** casa o grupo **Climatização**.
2. **tier-2** (filhos de Climatização, por `order`): Chillers ✗ · Fancoils ✗ · **Bombas Hidráulicas** ✓ (`identifierContains 'CAG'`, UPPERCASE) → `key = bombas_hidraulicas`.
3. Conta **uma vez** nessa folha; rola para Climatização → Total. Label/ícone vêm do nó (`name`/`nameKey` + token), nunca hard-coded.

**Diff v1 → v3 (o device-testemunha):**
| | v1 (hoje) | v3 |
|---|---|---|
| Coluna (tier-1) | Área Comum (caía no fallback) | Climatização ✓ |
| Breakdown (tier-2) | **Outros** — `Set.has` exato em "CAG" falhava (**bug #1**) | **Bombas Hidráulicas** ✓ (`contains`) |
| Label/ícone | hard-coded em 3 lugares (MAIN_VIEW/SIM/TELEMETRY_INFO) | do nó (dado), via `details.name`/`details.icon` |
| Regra | `if` inline duplicado | `match` em código golden, key-parity, group-generic |

---

_This RFC replaces the hard-coded map documented in
`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/DEVICE-CLASSIFICATION-MAP.md`._
