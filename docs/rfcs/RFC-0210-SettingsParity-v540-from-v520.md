# RFC-0210 — Settings parity: port 10 v-5.2.0 widget settings into the slim agnostic v-5.4.0 controller

- **RFC**: 0210
- **Title**: Align `v-5.4.0/settingsSchema.json` and `v-5.4.0/controller.js` with the 10 feature settings that exist only in v-5.2.0, **without** breaking the domain-agnostic mandate (RFC-0209)
- **Status**: Proposed (2026-06-24)
- **Author**: Rodrigo Lago
- **Decided in**: 3-agent study workflow (`rfc-0210-settings-parity-study`) over the v-5.2.0 controllers + lib consumers
- **Target**:
  - `src/thingsboard/main-dashboard-shopping/v-5.4.0/settingsSchema.json` (extend)
  - `src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js` (read + bridge + wire)
  - lib seams: `createHeaderShoppingComponent`, `createFooterComponent`, `buildTicketServiceOrchestrator`, `MyIOSelectionStore`, `createLibraryVersionChecker`, `TelemetryGridShoppingView`, `openDashboardPopupAllReport`
- **Related**:
  - RFC-0209 — Slim controller / single-source classification (the agnostic mandate this RFC must honor).
  - RFC-0201 — MainDashboardShopping v-5.4.0 sync from v-5.2.0 (this RFC is the *settings slice* of that sync).
  - RFC-0182 — OrchestratorGroupClassification + AllReportModal (`enabledReportItems`).
  - RFC-0188 — Offline rescue by recent telemetry (`shortDelayMinsToBypassOfflineStatus`).
  - RFC-0189 — Per-device temperature Data Apps fetch (`enableTemperatureApiDataFetch`).
  - RFC-0198 — FreshdeskClient architecture (`freshdeskApiKey`, `freshdeskDomain`).
  - RFC-0152 — Device data export console dump (`enableDeviceDataExport`).
  - RFC-0126 — `window.MyIOUtils` bridge (children/lib read controller-published values).

---

## Summary

The v-5.4.0 `settingsSchema.json` is missing **10** settings that v-5.2.0 exposes:
`homologMode`, `chartsBaseUrl`, `freshdeskApiKey`, `freshdeskDomain`,
`shortDelayMinsToBypassOfflineStatus`, `maxSelection`, `enableTemperatureApiDataFetch`,
`enableDeviceDataExport`, `enableReportButton`, `enabledReportItems`.

This RFC maps **what each one does in v-5.2.0**, **what is missing/different in v-5.4.0**, and
**how to incorporate it** — split into four phases ordered by risk. The hard constraint is
RFC-0209: v-5.4.0 is **100% domain-agnostic** (zero `energy`/`water`/`temperature` literals;
every domain/column derives from the GCDR `/entities` tree). Two of the ten settings are
domain-coupled in v-5.2.0 and **must be redesigned**, not copied:

1. **`enabledReportItems`** — a flat map of 13 hard-coded `{domain}_{group}` booleans. Port as a
   **free-form, tree-keyed** map (`{ "<domainCode>_<columnKey>": bool }`) plus a single
   `reportItemsDefault` flag, since a TB widget schema cannot enumerate unknown domains.
2. **`enableTemperatureApiDataFetch`** — the name *and* the gated code path bake in the word
   `temperature`. Port as a domain-neutral **`enablePerDeviceTelemetryFetch`**, with the applicable
   domain(s) and the URL path segment derived from the tree's domain code.

The other eight are domain-agnostic infrastructure/UI gates and can be ported close to verbatim
(read in `onInit`, mirror onto `window.MyIOUtils`, forward into the relevant lib component).

> ✅ **Verified during the study:** v-5.4.0 `controller.js` has **zero** references to `temperature`
> or `telemetry/devices` (grep confirmed) — the slim controller is clean here, consistent with
> RFC-0209. So the per-device telemetry fetch (RFC-0189) is a **pure gap**, not a pre-existing bug:
> Phase C **adds** it agnostically (domain-neutral name + tree-derived URL path), introducing no
> domain literal. (An earlier study draft mis-cited a "bug at line 718"; line 718 is actually the
> `dataApiHost` misconfig toast — corrected here.)

This RFC is **design only** — no code is written here.

---

## Motivation

v-5.4.0 is the new slim/agnostic controller (RFC-0209). It deliberately dropped a large slice of
v-5.2.0 feature wiring. RFC-0201 tracks the broad sync; this RFC is the **settings sub-project**:
the precise, per-key contract a developer needs to restore feature parity **without** re-introducing
domain hard-coding. Without this map, porting the settings ad-hoc would either (a) silently reuse
the v-5.2.0 domain-keyed shapes and break the agnostic property, or (b) miss the cross-widget
`MyIOUtils` bridge contract and leave consumers reading `undefined`.

---

## Guide-level explanation

Every v-5.2.0 setting follows the **same bridge pattern**:

```
self.ctx.settings.<key>  ──(onInit)──►  window.MyIOUtils.<key>  ──►  consumer (HEADER/MENU/FOOTER/TELEMETRY or lib component)
```

In v-5.4.0 there are **no separate child widgets** — HEADER/MENU/FOOTER/TELEMETRY are lib
components created by the single controller. So "porting a setting" means three steps:

1. **Schema** — add the property + a `form` entry to `v-5.4.0/settingsSchema.json`.
2. **Read + bridge** — in `onInit`, read `settings.<key>` (with the v-5.2.0 default) and publish it
   on `window.MyIOUtils.<key>` (preserve the contract any lib consumer already expects).
3. **Wire** — pass it into the relevant lib component params (footer/header/grid/store), or, for
   the tree-coupled settings, drive the behavior from `_classificationTree` domain codes.

The new `form` is organized into fieldsets so the cockpit/TB "Appearance" stays readable:

- **Integrations** — `freshdeskApiKey`, `freshdeskDomain`
- **Reports** — `enableReportButton`, `enabledReportItems`, `reportItemsDefault`
- **Device Status & Selection** — `shortDelayMinsToBypassOfflineStatus`, `maxSelection`,
  `enablePerDeviceTelemetryFetch`
- **Endpoints** — `chartsBaseUrl` (next to existing `dataApiHost`/`thingsboardUrl`)
- **Debug & Domains** (existing fieldset) — add `homologMode`, `enableDeviceDataExport`

---

## Reference-level explanation

Legend for the per-setting tables: **L** = read location (`file:line`), **→5.4.0** = what to do.

### Group 1 — Direct, agnostic ports (Phase A)

#### `chartsBaseUrl`
- **Purpose**: base URL for `EnergyChartSDK` iframes/UMD (FOOTER comparison modal). Prod
  `https://graphs.apps.myio-bas.com`, staging `https://graphs.staging.apps.myio-bas.com`.
- **v-5.2.0 behavior**: `MAIN_VIEW:1474-1475` reads `settings.chartsBaseUrl || <prod>` → publishes
  `MyIOUtils.chartsBaseUrl`. `FOOTER:1292` reads it with **no local fallback** → toast + return if
  unset; `FOOTER:1333` forwards it into `openDashboardPopupEnergy({mode:'comparison', chartsBaseUrl})`.
  Lib `ComparisonHandler.ts:46` `?? DEFAULT_CHARTS_BASE_URL`; `EnergyModalView.ts:901` `|| <prod>`.
- **v-5.4.0 gap**: 0 refs. `createFooterComponent` (controller.js:410) is called **without**
  `chartsBaseUrl`, so the lib silently falls back to prod → **staging breaks**, and the misconfig
  toast is lost.
- **→5.4.0**: read `chartsBaseUrl = settings.chartsBaseUrl || '<prod>'`; set
  `MyIOUtils.chartsBaseUrl`; **pass `chartsBaseUrl` into `createFooterComponent` params** and into any
  `openDashboardPopupEnergy` opened from v-5.4.0. (A safe lib default exists, so a warn — not a hard
  return — is sufficient on empty.)
- **Schema**: `{"chartsBaseUrl": {"title":"Charts SDK Base URL","type":"string","default":"https://graphs.apps.myio-bas.com","description":"Base URL do EnergyChartSDK (iframes/UMD). Staging: https://graphs.staging.apps.myio-bas.com"}}` → form: Endpoints.
- **Agnostic**: none (pure endpoint).

#### `maxSelection`
- **Purpose**: footer selection cap (1–100, default 20); at the cap the premium "Limite Atingido"
  alert fires.
- **v-5.2.0 behavior**: `MAIN_VIEW:1480` `settings.maxSelection ?? 20`; `MAIN_VIEW:1484`
  `selectionStore.setMaxSelection(...)` where `selectionStore = MyIOLibrary.MyIOSelectionStore || window.MyIOSelectionStore`.
  `SelectionStore.js:214` validates int ≥ 1 and truncates current selection. **Name mismatch:** TB key
  is singular `maxSelection`; footer prop is plural `maxSelections` — bridged via the store, not direct.
- **v-5.4.0 gap**: never calls `setMaxSelection` → stuck at store default 20.
- **→5.4.0**: `const maxSelection = settings.maxSelection ?? 20;` then
  `(MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore)?.setMaxSelection?.(maxSelection)` in
  try/catch. Keep the singular schema key (operator muscle memory); bridge to the plural prop via the store.
- **Schema**: `{"maxSelection":{"type":"number","default":20,"minimum":1,"maximum":100,"title":"Limite máximo de seleção (footer)"}}` → form: Device Status & Selection.
- **Agnostic**: none (single integer).

#### `shortDelayMinsToBypassOfflineStatus`
- **Purpose**: RFC-0188 offline-rescue threshold (min). If TB says offline but last telemetry is more
  recent than this, the device is rescued to online. **All domains.** Default 60.
- **v-5.2.0 behavior**: `MAIN_VIEW:4341` module var default 60; `MAIN_VIEW:1462` override from settings;
  `MAIN_VIEW:5313` forwarded as `shortDelayMins` into `MyIOLibrary.calculateDeviceStatus({...})`.
  `MAIN_VIEW:5506` is a **water-only debug log** — do **not** port.
- **v-5.4.0 gap**: not read; status calc is delegated to the lib grid, so the threshold is not configurable.
- **→5.4.0**: read `settings.shortDelayMinsToBypassOfflineStatus ?? 60`; publish
  `MyIOUtils.shortDelayMinsToBypassOfflineStatus`; ensure the lib status path
  (`TelemetryGridShoppingView` / item-build) forwards `shortDelayMins` from it (component option or bridge read).
- **Schema**: `{"shortDelayMinsToBypassOfflineStatus":{"type":"number","default":60,"title":"Short Delay (min) to Bypass Offline Status","description":"RFC-0188: rescue offline→online when last telemetry is newer than this. Applies to all domains."}}` → form: Device Status & Selection.
- **Agnostic**: keep as **one global number**; never key per domain; drop the water-only log.

#### `homologMode`
- **Purpose**: lib version-checker validates against the latest `-homolog` npm channel vs latest stable.
- **v-5.2.0 behavior**: `MAIN_VIEW:1400` `MyIOUtils.homologMode = settings.homologMode === true`;
  `MENU:3514` `preferHomolog = MyIOUtils.homologMode === true` → `createLibraryVersionChecker(container,{preferHomolog})`;
  `library-version-checker/index.js:843/879/913` channel-scoped cache key, `resolveLatestHomologVersion`,
  `compareVersionsChannelAware`.
- **v-5.4.0 gap**: not read; **no version-checker mounted** (no MENU widget) → consumer absent.
- **→5.4.0**: store now (`MyIOUtils.homologMode = settings.homologMode === true`, cheap/agnostic);
  **functional** parity needs the version-checker mounted (RFC-0201 MENU/footer port) — then pass
  `preferHomolog` into `createLibraryVersionChecker`.
- **Schema**: `{"homologMode":{"type":"boolean","default":false,"title":"Homolog Mode (validar contra canal homolog)"}}` → form: Debug & Domains.
- **Agnostic**: none (release-channel toggle). Storage is necessary-but-not-sufficient (consumer missing).

#### `enableDeviceDataExport`
- **Purpose**: RFC-0152 console dump after card render mapping TB↔GCDR fields (`tbId, deviceName,
  label, identifier, deviceType, deviceProfile, slaveId, centralId, gcdrCustomerId, gcdrAssetId,
  gcdrDeviceId, gcdrSyncAt`). Default false.
- **v-5.2.0 behavior**: `MAIN_VIEW:1505-1507` read + bridge; `TELEMETRY:3574` dumps from per-domain
  accumulator `window[_exportKey]` where `_exportKey = _deviceDataExport_${WIDGET_DOMAIN}_${_lwGroup}` (`TELEMETRY:5844`).
- **v-5.4.0 gap**: not read; no `_exportKey` accumulation (render delegated to the lib grid).
- **→5.4.0**: read + bridge `MyIOUtils.enableDeviceDataExport`; when on, after items are built, iterate
  the controller's items (they already carry the mapping fields) and `console.log` a generic pipe table.
  Prefer emitting the dataset from `TelemetryGridShoppingView` so the slim controller only toggles it.
- **Schema**: `{"enableDeviceDataExport":{"type":"boolean","default":false,"title":"Enable Device Data Export (console log)"}}` → form: Debug & Domains.
- **Agnostic**: low risk — field set is pure mapping. The only literal is the export-buffer key
  `…${WIDGET_DOMAIN}…`; derive that suffix from the tree's domain/column code.

#### `enableReportButton` (storage half — Phase A; consumer wiring — Phase D)
- **Purpose**: master on/off for the HEADER "Relatório Consumo Geral" button. Default false (opt-in).
- **v-5.2.0 behavior**: `MAIN_VIEW:1519-1520` read + bridge; `HEADER:587-601` toggles
  `btnGen.style.display`, sets label/title from a **hard-coded `{energy,water}` map**, and treats only
  energy/water as "supported".
- **v-5.4.0 gap**: not read; no HEADER report-button wiring (header is a lib component).
- **→5.4.0**: read + bridge `MyIOUtils.enableReportButton` now; when the report button moves into
  `createHeaderShoppingComponent`, pass `showReportButton: enableReportButton` (component-driven, not a
  DOM gate).
- **Schema**: `{"enableReportButton":{"type":"boolean","default":false,"title":"Enable Report Button"}}` → form: Reports.
- **Agnostic**: the key is agnostic; the **HEADER** label/“supported” logic is the offender — when
  porting, derive label/enabled-state from the tree `domain.label`, not the `{energy,water}` map.

### Group 2 — Integrations: Tickets (Phase B)

#### `freshdeskApiKey` + `freshdeskDomain`
- **Purpose**: RFC-0198 Freshdesk ticket integration (Chamados tab, card ticket badges, New-Ticket
  wizard, ticket-detail modal). Empty key disables all ticket UI.
- **v-5.2.0 behavior**: `MAIN_VIEW._buildTicketServiceOrchestrator` reads `settings.freshdeskApiKey`
  (`:3077`) + `settings.freshdeskDomain || 'myiocom.freshdesk.com'` (`:3078`), mirrors both onto
  `MyIOUtils.*` (`:3083-3084`). Skips if `!apiKey` (`:3088`) **and** is additionally gated on customer
  SERVER_SCOPE `MyIOUtils.ticketsEnabled === true`. When both pass:
  `MyIOLibrary.buildTicketServiceOrchestrator(domain, apiKey, FreshdeskClient, {tbBaseUrl, jwtToken, identifierToTbId})`
  → `window.TicketServiceOrchestrator` (`:3126`). `HEADER:2178-2237` reads the bridged values for the
  wizard/detail modal and bails if `!apiKey || ticketsEnabled !== true`.
- **v-5.4.0 gap**: 0 refs; `window.TicketServiceOrchestrator` never built (matches RFC-0201 "globals
  missing in v-5.4.0").
- **→5.4.0**: add both keys; read + bridge in `onInit` (next to `alarmsApiKey`); port a
  `_buildTicketServiceOrchestrator()` that skips on `!apiKey` / `ticketsEnabled !== true`, then calls the
  lib. **AGNOSTIC FIX:** the v-5.2.0 `identifierToTbId` builder loops a hard-coded
  `['energy','water','temperature']`; in v-5.4.0 iterate the **domain codes from the tree**
  (`listDomains()` / `window.STATE[code].allItems` for each tree code).
- **Schema**: `{"freshdeskApiKey":{"type":"string","default":"","title":"FreshDesk API Key"}}`,
  `{"freshdeskDomain":{"type":"string","default":"myiocom.freshdesk.com","title":"FreshDesk Domain"}}` →
  form: new Integrations fieldset.
- **Agnostic**: values are opaque credentials (fine). The only risk is the ported identifier→tbId loop —
  it must be tree-driven.

### Group 3 — Agnostic redesign required

#### `enableTemperatureApiDataFetch` → rename to `enablePerDeviceTelemetryFetch` (Phase C)
- **Purpose**: RFC-0189 gate. When on, a per-device Data Apps call over a fixed 72h window derives
  `lastTelemetryTs` (feeds RFC-0188 rescue) and powers the modal data source. One HTTP call per device
  per load. Default false.
- **v-5.2.0 behavior**: `MAIN_VIEW:1500-1502` read + bridge; `MAIN_VIEW:6078` `const useApi = …` **inside
  `if (domain === 'temperature')`**; `TELEMETRY:2947` builds an `ingestionDataFetcher` hitting
  `${dataApiHost}/telemetry/devices/${ingestionId}/temperature?granularity=1h`.
- **v-5.4.0 gap**: not read, **and the per-device fetch capability does not exist at all** — the
  controller has zero `temperature`/`telemetry/devices` references (verified). So nothing derives
  `lastTelemetryTs` per device today; the lib grid uses its own data path. This is a clean slate to
  add the feature agnostically (no existing literal to fix).
- **→5.4.0 (agnostic)**:
  1. Do **not** port a `temperature`-named boolean. Introduce **`enablePerDeviceTelemetryFetch`**.
  2. Resolve **which** domain(s) it applies to from the **tree** (a domain/column metadata flag, e.g.
     "aggregation endpoint lacks `lastTelemetryTs`"), not a literal.
  3. Template the URL path segment from the **domain code**:
     `${host}/api/v1/telemetry/devices/${ingestionId}/${domainCode}` — never the word `temperature`.
  4. Implement the per-device fetch gated behind this flag; fail-closed (default off).
  5. Bridge via `MyIOUtils` for the grid/modal fetcher.
- **Schema**: `{"enablePerDeviceTelemetryFetch":{"type":"boolean","default":false,"title":"Enable Per-Device Telemetry Fetch (offline detection)","description":"RFC-0189 (agnostic): per-device Data Apps fetch (72h) to derive lastTelemetryTs. Applies to domains the classification tree flags. One HTTP call per device per load."}}` → form: Device Status & Selection.
- **Agnostic**: **highest-risk** of the ten — in v-5.2.0 the name, the gate (`domain==='temperature'`)
  and the URL path are all domain-coupled. v-5.4.0 has none of that code yet, so the port starts clean;
  it must be implemented fully tree-driven from the start.

#### `enabledReportItems` (+ new `reportItemsDefault`) (Phase D)
- **Purpose**: RFC-0182 per-card visibility for the MENU "Relatórios" modal; disabled cards render with
  a 🔒 badge and are not clickable.
- **v-5.2.0 behavior**: `MAIN_VIEW:1524-1541` reads `settings.enabledReportItems || {}`, merges against a
  **hard-coded `REPORT_ITEM_DEFAULTS`** (`energy_lojas:true`, rest false), publishes the normalized map.
  `MENU:2617-2620` builds a **hard-coded `DOMAINS` array** (`energy/water/temperature/alarms`) with
  `enabled = ei('<domain>_<group>')`; `MENU:2831` binds clicks only on `.rp-card[data-enabled="true"]` →
  `_openGroupReport(domain, group)` (`:2890`) → `_buildItemsList(domain, group)` →
  `MyIOLibrary.openDashboardPopupAllReport({...,domain,group,itemsList})`. `_buildItemsList` switches on
  `getEnergyGroups/getWaterGroups/getTemperatureGroups` (domain-hard-coded accessors v-5.4.0 dropped).
- **v-5.4.0 gap**: 0 refs; no Relatórios modal, no `_openGroupReport`/`_buildItemsList`, no `getXGroups`.
  The 13 keys are domain-hard-coded — **incompatible** with the agnostic mandate.
- **→5.4.0 (agnostic redesign)**:
  - **A. Catalog from the tree.** For each `_classificationTree.domains[d]`: emit a card per column
    (`id = \`${d.code}_${col.key}\``, labels from `col.label`/`d.label`) plus a synthetic
    `\`${d.code}_todos\`` card.
  - **B. Alarms** is the only non-tree concept: keep an **optional** block gated on
    `window.AlarmServiceOrchestrator` availability (a small config array), **not** a domain literal in the
    classification path.
  - **C. Storage** as a **free-form map** `{ "<domainCode>_<columnKey>": bool, "<domainCode>_todos": bool }`
    plus a single companion `reportItemsDefault` (recommend default **false**, admin opt-in). Missing keys
    fall back to `reportItemsDefault`.
  - **D. Rebuild `_buildItemsList` agnostically:** replace the `getXGroups` switch with
    `window.STATE[domainCode][columnKey].items`; `group === 'todos'` = concat all columns of that domain.
  - **E. Publish** the merged map on `MyIOUtils.enabledReportItems`; the agnostic report modal reads
    `ei(\`${domainCode}_${columnKey}\`)`.
- **Schema** (TB schema can’t enumerate unknown domains → free-form):
  `{"enabledReportItems":{"type":"object","additionalProperties":{"type":"boolean"},"default":{},"title":"Itens de Relatório Habilitados","description":"RFC-0182 (agnóstico): mapa { '<domainCode>_<columnKey>': bool, '<domainCode>_todos': bool }. Chaves derivam da árvore GCDR /entities; ausentes usam reportItemsDefault."}}`,
  `{"reportItemsDefault":{"type":"boolean","default":false,"title":"Report Items Default (when key absent)"}}` →
  form: Reports, render `enabledReportItems` as a `textarea` (JSON) + `reportItemsDefault`. The dashboard
  should `console.log` the discovered `${domainCode}_${columnKey}` keys to ease configuration.
- **Agnostic**: **HIGH.** Key namespace, labels, the `getXGroups` switch, and `GROUP_LABELS` are all
  domain-keyed today. `todos` is an acceptable reserved aggregation suffix.

---

## Phased rollout

Ordered by risk; each phase is independently shippable and testable.

| Phase | Scope | Settings | Agnostic work | Depends on |
|-------|-------|----------|---------------|------------|
| **A** | Read + bridge + simple wiring | `chartsBaseUrl`, `maxSelection`, `shortDelayMinsToBypassOfflineStatus`, `homologMode`, `enableDeviceDataExport`, `enableReportButton` (storage) | minimal (export-buffer key from tree code) | — |
| **B** | Tickets integration | `freshdeskApiKey`, `freshdeskDomain` | tree-driven `identifierToTbId` loop | STATE per tree code; `buildTicketServiceOrchestrator` |
| **C** | Add per-device telemetry fetch (new capability) | `enablePerDeviceTelemetryFetch` (was `enableTemperatureApiDataFetch`) | URL path + applicable domain from tree; fail-closed gate | tree domain metadata; RFC-0189 |
| **D** | Reports | `enabledReportItems` (free-form), `reportItemsDefault`, `enableReportButton` (consumer) | full tree-driven report catalog + agnostic `_buildItemsList` | agnostic report modal/MENU port (RFC-0201) |

**Consolidated `settingsSchema.json` additions** (Phase A–D): `homologMode`, `chartsBaseUrl`,
`freshdeskApiKey`, `freshdeskDomain`, `shortDelayMinsToBypassOfflineStatus`, `maxSelection`,
`enablePerDeviceTelemetryFetch`, `enableDeviceDataExport`, `enableReportButton`, `enabledReportItems`,
`reportItemsDefault`. New fieldsets: **Integrations**, **Reports**, **Device Status & Selection**;
extend existing **Debug & Domains** and **Endpoints**.

> Note: v-5.4.0 keeps the **renamed** `enablePerDeviceTelemetryFetch` (not `enableTemperatureApiDataFetch`)
> and **does not** copy `enabledReportItems`' 13 fixed keys — those are intentional divergences from
> v-5.2.0, required by RFC-0209.

---

## Drawbacks

- Phases C and D require lib changes (grid fetcher path, report modal/`_buildItemsList`) beyond the
  controller — they are not pure settings ports.
- The free-form `enabledReportItems` map is less discoverable than 13 named checkboxes (mitigated by the
  console key dump + `reportItemsDefault`).
- `homologMode` is stored but inert until the version-checker is mounted in v-5.4.0 (RFC-0201).
- Two intentional key divergences (`enablePerDeviceTelemetryFetch`, free-form `enabledReportItems`) mean
  v-5.2.0 customer settings do **not** copy 1:1 to v-5.4.0; a small migration note is needed per customer.

## Rationale and alternatives

- **Why rename `enableTemperatureApiDataFetch`?** Keeping the name would re-introduce a domain literal in
  the schema and force a `domain === 'temperature'` branch — a direct RFC-0209 violation. A neutral gate +
  tree-derived domain is the only agnostic option.
- **Why free-form `enabledReportItems` instead of generated checkboxes?** TB widget JSON schema is static;
  it cannot enumerate domains discovered at runtime from `/entities`. A free-form map + default flag is the
  minimal schema that stays correct for *any* customer tree (gas/pulse/tank/…).
- **Alternative (rejected):** store report visibility in GCDR tree metadata instead of widget settings —
  cleaner long-term but couples report config to the registry; out of scope here, noted in Future possibilities.

## Prior art

- v-5.2.0 `MAIN_VIEW/settingsSchema.json` (the source of all 10 keys).
- RFC-0209 agnostic engine (`parseClassificationEntities`, `classifyAllDevices`, tree-keyed `STATE`).
- RFC-0182 (`openDashboardPopupAllReport`), RFC-0198 (`buildTicketServiceOrchestrator`), RFC-0188/0189.

## Unresolved questions

1. Should `enablePerDeviceTelemetryFetch`'s applicable-domain set come from a **tree node flag**
   (registry change) or a **controller-side heuristic** (domain whose aggregation lacks `lastTelemetryTs`)?
2. Should `reportItemsDefault` default to `true` (parity-ish: most items visible) or `false`
   (safer opt-in, matches v-5.2.0 where only `energy_lojas` was on)? Recommendation: **false**.
3. Does `TelemetryGridShoppingView` already accept a `shortDelayMins` option, or must the lib seam be
   extended (Phase A vs a lib RFC)?
4. Where does the report button ultimately render in v-5.4.0 — `createHeaderShoppingComponent` param vs a
   standalone control? (affects Phase D `enableReportButton` consumer.)

## Future possibilities

- Move report visibility + per-device-fetch flags into the GCDR tree metadata so **zero** domain-shaped
  settings live in the widget at all.
- A generic schema-introspection cockpit (already prototyped in `showcase/main-view-shopping`) that lists
  discovered `${domainCode}_${columnKey}` keys to author `enabledReportItems` visually.
- Fold this settings contract into the RFC-0201 sync checklist as the "settings" acceptance gate.
