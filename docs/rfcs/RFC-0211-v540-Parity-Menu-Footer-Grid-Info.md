# RFC-0211 — v-5.4.0 parity: menu name/settings, footer ingestion token, grid card actions, info tooltips

- **RFC**: 0211
- **Title**: Restore four feature-parity gaps in the slim domain-agnostic v-5.4.0 controller (menu shopping name + settings modal, footer comparison ingestion token, grid card actions/selection/drag, info-card MyIO tooltips) **without** re-introducing domain hard-coding (RFC-0209)
- **Status**: Implemented (2026-06-24) — `22612fb4`
- **Author**: Rodrigo Lago
- **Implemented in**: salvaged from four `fix/rfc-0211-*` agent branches (which had forked from a stale base); the good parts were re-applied onto the current GCDR controller in a single consolidated commit.
- **Target**:
  - `src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js` (+223): `buildIngestionToken`, `resolveShoppingName`/`updateMenuShoppingName`, `openSettings`, `handleGridCardAction`/`gridCardWiring`, `MyIOUtils.getCredentials`
  - `src/components/menu-shopping/` — `MenuShoppingView.ts`, `createMenuShoppingComponent.ts`, `styles.ts`, `types.ts` (new `shoppingName` param + `setShoppingName` method + sub-label)
  - `src/components/telemetry-info-shopping/` — `TelemetryInfoShoppingView.ts`, `types.ts` (`tooltipSpan` helper, `TOTAL_CARD_TOOLTIP`, per-category tooltips, deferred-chart re-apply)
  - `showcase/main-view-shopping/index.html` — `currentUser.customerTitle` so the name path is exercised
- **Related**:
  - RFC-0209 — Slim controller / single-source classification (the agnostic mandate this RFC must honor).
  - RFC-0210 — Settings parity (the *settings* slice of the v-5.4.0←v-5.2.0 sync; this RFC is the *runtime wiring* slice).
  - RFC-0201 — MainDashboardShopping v-5.4.0 sync from v-5.2.0 (the umbrella sync; this RFC closes four of its line items).
  - RFC-0126 — `window.MyIOUtils` bridge (lib consumers read controller-published values, e.g. `getCredentials`).

---

## Summary

v-5.4.0 is the slim, domain-agnostic controller (RFC-0209) that deliberately dropped a large slice of
v-5.2.0 widget wiring. RFC-0201 tracks the broad sync and RFC-0210 covers the *settings schema*; this
RFC covers the **runtime parity** for four user-visible gaps that were missing from the new controller:

1. **Menu — shopping/customer name + settings modal.** The lib `menu-shopping` selector showed the
   static placeholder "Trocar Shopping" and the "Configurações" button was inert. Added a `shoppingName`
   param + `setShoppingName(name)` method to the component (sub-label that also reveals the selector row),
   and wired the controller to resolve the name **agnostically** (`resolveShoppingName`) from
   `ctx.dashboard.title` → datasource label → `currentUser.customerTitle`, plus `onSettingsClick`
   (`openMeasurementSetupModal`) and `onShoppingSelectorClick` (event). User/name refresh after auth.
2. **Footer — ingestion token for the comparison modal.** The footer comparison opens
   `openDashboardPopupEnergy({mode:'comparison'})` which needs a Data-Apps ingestion token. The slim
   controller never built one. Added `buildIngestionToken()` (via `MyIOLibrary.buildMyioIngestionAuth`
   from the customer credentials), cached it, exposed `MyIOUtils.getCredentials` (read by the lib
   `ComparisonHandler`), and passed `dataApiHost`/`chartsBaseUrl`/`getIngestionToken`/`onError` into the
   footer so failures surface as a `MyIOToast` instead of a silent console error.
3. **Grid — card actions + selection + drag-to-footer.** Each grid was created without action handlers.
   Added `gridCardWiring()` (`enableSelection`, `enableDragDrop`, `onCardAction`) spread onto every grid,
   and a generic `handleGridCardAction(action, device)` that opens dashboard/report/settings popups using
   **generic device fields only** (`entityId`/`tbId`/`id`/`ingestionId`, `labelOrName`, `deviceType`).
4. **Info — MyIO (i) tooltips on every metric card + chart-init race fix.** Ported the per-category info
   tooltips from v-5.2.0 TELEMETRY_INFO (was only on ~3 cards) via a single `tooltipSpan()` helper, added
   the aggregate `TOTAL_CARD_TOOLTIP`, and fixed the deferred chart-init race where the chart finished
   initializing **after** `setEnergyData/setWaterData` had run, leaving it stuck on the gray "Sem dados"
   placeholder.

The hard constraint throughout is RFC-0209: **zero** `energy`/`water`/`temperature` literals in the
controller paths. `handleGridCardAction` and `resolveShoppingName` use only generic device/context fields.
(The info-card tooltips live in the lib component's existing `ENERGY_CATEGORY_CONFIG`/`WATER_CATEGORY_CONFIG`
maps, which are component-internal presentation data, not controller domain logic.)

---

## Motivation

After RFC-0209 the v-5.4.0 controller rendered the agnostic grid correctly but four features the operators
rely on in v-5.2.0 were dead: the menu showed no customer name and an inert settings gear, the footer's
"Comparar" failed silently (no ingestion token), the device cards had no actions (could not open
dashboard/report/settings or drag to the footer compare tray), and the info summary cards lost their
explanatory tooltips and intermittently rendered a gray empty chart. These are the last user-facing
regressions blocking v-5.4.0 from replacing v-5.2.0. RFC-0210 restored the *settings keys*; this RFC
restores the *behavior* — and must do so without re-coupling the controller to specific domains.

---

## Guide-level explanation

All four fixes follow the v-5.4.0 architecture: there are **no child widgets**, so "restoring a feature"
means (a) extend the relevant lib component's params/methods if needed, and (b) wire it from the single
controller using only generic, tree-derived, or context-derived values.

```
ctx (dashboard/datasource/currentUser)  ──resolveShoppingName()──►  menu.setShoppingName()
_credentials  ──buildMyioIngestionAuth──►  _ingestionToken  ──getIngestionToken──►  footer comparison modal
grid card click  ──onCardAction(action, device)──►  handleGridCardAction  ──►  openDashboardPopup*(generic fields)
category config.tooltip  ──tooltipSpan()──►  (i) on every info card
```

### Menu name & settings
- **Component (`menu-shopping`)**: new optional `shoppingName` param and `setShoppingName(name)` instance
  method. The selector button gains a `…-shopping-name` sub-label (`.…-footer-btn-text` column layout);
  `updateShoppingSelectorVisibility()` reveals the row when the user is admin **or** a name is present, so
  the customer name shows even before admin status resolves. The sub-label is hidden when collapsed.
- **Controller**: `resolveShoppingName()` (agnostic precedence: dashboard title → datasource
  `entityLabel`/`name` → `currentUser.customerTitle`/`customerName`); `updateMenuShoppingName()` pushes it
  into the menu and is re-called after both the context-based and API-based user resolves (so a
  late-arriving `customerTitle` updates the label). `openSettings()` opens
  `MyIOLibrary.openMeasurementSetupModal({ token, customerId, existingSettings, onSave, onClose })`,
  guarding for missing lib/JWT/`customerId` with toasts. `onShoppingSelectorClick` emits
  `myio:shopping-selector-click` for a future shopping picker.

### Footer ingestion token
- `buildIngestionToken()` (module-level, `_ingestionToken` cache) calls
  `MyIOLibrary.buildMyioIngestionAuth({ dataApiHost, clientId, clientSecret }).getToken()`, also stashing
  it in `MyIOOrchestrator.tokenManager` if present. Guards: missing lib or missing
  `clientId/clientSecret` → toast + `null`. Awaited once in `onInit` after `_credentials` is set.
- `window.MyIOUtils.getCredentials = () => ({ clientId, clientSecret, ingestionId })` so the lib
  `ComparisonHandler` can read credentials via the RFC-0126 bridge.
- The footer is created with `dataApiHost`, `chartsBaseUrl` (`CHARTS_BASE_URL` const), `getIngestionToken:
  () => _ingestionToken || undefined`, and `onError: (err) => toastError(...)`.

### Grid card actions
- `gridCardWiring()` returns `{ enableSelection: true, enableDragDrop: true, onCardAction:
  handleGridCardAction }`, spread onto **every** grid in `createDomainSectionsAndGrids`.
- `handleGridCardAction(action, device)`: resolves a device id generically
  (`_resolveCardDeviceId`: `entityId || tbId || id || ingestionId`), reads the JWT, builds a generic
  `apiConfig` (`tbBaseUrl`, `dataApiBaseUrl`, ingestion creds), and dispatches:
  - `settings` → `lib.openDashboardPopupSettings({ deviceId, jwtToken, api, seed, onSaved, onError })`
  - `report` → `lib.openDashboardPopupReport({ deviceId, ingestionId, label, deviceType, jwtToken, api, startDate, endDate })`
  - `dashboard` → `lib.openDashboardPopup({ … })`
  - Each guards for the lib symbol being absent (toast "indisponível nesta versão"); all wrapped in
    try/catch with a toast on failure. **No domain literal** — only generic device fields.

### Info-card tooltips & chart race
- `tooltipSpan(tooltip?)` — single private helper that renders
  `<span class="tis-tooltip" title="…">ℹ️</span>` (HTML-escaping `"`), replacing the four inline ternaries
  and adding `(i)` to every metric card (energy + water) plus the aggregate Total card via the new
  exported `TOTAL_CARD_TOOLTIP`. Per-category `tooltip` strings were filled in across
  `ENERGY_CATEGORY_CONFIG`/`WATER_CATEGORY_CONFIG`.
- **Chart race fix**: chart init is deferred (~300ms + retries) and can finish **after**
  `setEnergyData/setWaterData` already ran — those earlier `refreshChart()` calls were no-ops because
  `mainChart` was still `null`. After the chart is created, if `energyState || waterState` is held, call
  `refreshChart()` to re-apply it (instead of leaving the gray "Sem dados" placeholder).

---

## Reference-level explanation

### Controller additions (`v-5.4.0/controller.js`)

| Symbol | Kind | Purpose / agnostic note |
|--------|------|-------------------------|
| `CHARTS_BASE_URL` | const | `https://graphs.staging.apps.myio-bas.com` (see Unresolved Q1 — staging vs prod). |
| `_ingestionToken` / `buildIngestionToken()` | module var + async fn | Build & cache the ingestion token from `_credentials`; fail-closed with toasts. |
| `resolveShoppingName()` | fn | Agnostic name precedence (dashboard title → datasource label → `customerTitle`/`customerName`). |
| `_shoppingName` / `updateMenuShoppingName()` | var + fn | Push resolved name into `_menuInstance.setShoppingName`. |
| `openSettings()` | fn | `openMeasurementSetupModal(...)`; guards lib/JWT/`customerId`. |
| `_resolveCardDeviceId(device)` | fn | `entityId || tbId || id || ingestionId` — generic id resolution. |
| `handleGridCardAction(action, device)` | fn | dashboard/report/settings popups, generic fields, toasts on every failure mode. |
| `gridCardWiring()` | fn | `{ enableSelection, enableDragDrop, onCardAction }` spread onto every grid. |
| `MyIOUtils.getCredentials` | bridge | `() => ({ clientId, clientSecret, ingestionId })` for the lib `ComparisonHandler`. |

Wiring points: `fetchAndUpdateUserInfo` calls `updateMenuShoppingName()` on both the context path and the
API path (and seeds `_shoppingName` from `user.customerTitle`); `createComponents` passes `shoppingName`,
`onSettingsClick`, `onShoppingSelectorClick` to the menu and the four footer params; `createDomainSectionsAndGrids`
spreads `...gridCardWiring()`; `onInit` exposes `getCredentials` and `await buildIngestionToken()` once
`_credentials` is available.

### `menu-shopping` component API additions

- `MenuShoppingParams.shoppingName?: string`
- `MenuShoppingInstance.setShoppingName(name: string): void`
- `MenuShoppingView`: `shoppingNameEl`, `isAdmin`, `shoppingName` fields; `setShoppingName()`,
  `updateShoppingSelectorVisibility()` (admin **OR** name → visible); template sub-label
  `.…-shopping-name`; styles `.…-footer-btn-text` (column) + `.…-shopping-name` (`var(--brand)`,
  hidden when collapsed).

### `telemetry-info-shopping` component changes

- `types.ts`: per-category `tooltip` strings filled in for energy & water; new exported
  `TOTAL_CARD_TOOLTIP`.
- `TelemetryInfoShoppingView.ts`: `tooltipSpan()` helper used on every card header; deferred-chart
  re-apply guard.

---

## Drawbacks

- **`openDashboardPopup*` param shapes are unverified.** `handleGridCardAction` was written against the
  expected lib signatures but not yet exercised in a real browser against the current lib build — the
  popup param shapes (`api`, `seed`, date keys) need browser verification before this is considered done.
- **Info card values are still `null`.** GCDR `/devices` carry `value=null`, so the info summary cards
  render structure + tooltips but no real numbers until per-device telemetry feeds them (depends on
  RFC-0210 Phase C `enablePerDeviceTelemetryFetch`).
- **Grid column chrome not ported.** The grid column `(i)`-icon / `headerActions` / device-map / sync
  features were left out — the component drifted too far from v-5.2.0 to auto-merge; tracked as a
  follow-up.
- `CHARTS_BASE_URL` is a hard-coded **staging** constant (should come from `settings.chartsBaseUrl` per
  RFC-0210, but the footer accepts it as a param so it can be switched to the setting in one line).

> **Follow-up (post-`22612fb4`): ingestion token build made lazy.** The original commit built the
> ingestion token **eagerly** in `onInit` and toasted on absent `clientId`/`clientSecret`. In mock/showcase
> runs the SERVER_SCOPE attrs aren't seeded, so `fetchCredentials` returns an object with empty creds →
> a spurious "Credenciais de ingestão ausentes" error toast at startup (which then got overwritten by the
> later "deviceProfile não mapeado" toast — `MyIOToast` is a single-slot singleton). Fix: `buildIngestionToken`
> now takes `{ silent }`; `onInit` warms it up **silently** (logs only, no toast), and the footer's
> `getIngestionToken` triggers a real, toast-on-failure, de-duplicated (`_ingestionTokenInFlight`) build on
> first use. The token is only needed when the comparison modal opens, so this is both correct and removes
> the false startup error. (`MyIOToast` overlap left as-is by decision — singleton is acceptable once the
> spurious init toast is gone.)

> **Follow-up: ingestion `clientId`/`clientSecret` moved to GCDR customer metadata.** They no longer live
> in TB SERVER_SCOPE. New `fetchGcdrCustomerCredentials(gcdrApiBaseUrl, gcdrCustomerId)` does
> `GET ${gcdrApiBaseUrl}/customers/:id` (X-API-Key from `gcdrApiKey`/`customerAttrs.gcdrapikey`) and reads
> `metadata.client_id`/`metadata.client_secret` (snake & camel accepted; envelopes `{...}`/`{data}`/`{items[0]}`).
> In `onInit` it runs once `gcdrCustomerId` is resolved and **merges into `_credentials` with GCDR winning**
> over any legacy SERVER_SCOPE value (so it works during migration and in mock/showcase runs that have no TB
> JWT — `_credentials` is then created purely from the GCDR fetch). `fetchCredentials` (SERVER_SCOPE) is
> kept only for the `gcdrCustomerId`/`gcdrTenantId` fallback + ingestion `customerId`. The showcase needs no
> change: it already fetches GCDR `/entities` and `/devices` live, so `/customers/:id` resolves live too.

## Rationale and alternatives

- **Why resolve the name in the controller, not the component?** The name source is TB-context-specific
  (dashboard title / datasource / currentUser). The component stays presentation-only (`setShoppingName`),
  preserving its reusability; the controller owns the agnostic resolution.
- **Why a `getIngestionToken` callback instead of passing the token value?** The token is built async and
  may refresh; a getter lets the footer read the latest cached value without a re-render contract.
- **Why generic-field-only in `handleGridCardAction`?** RFC-0209 forbids domain branches in the controller.
  Resolving id/label/type from a fixed set of generic device fields keeps the handler valid for any domain
  the tree produces.

## Prior art

- v-5.2.0 `MENU`, `FOOTER`, `TELEMETRY`, `TELEMETRY_INFO` controllers (the behavior source).
- RFC-0209 agnostic engine; RFC-0210 settings parity; RFC-0201 sync umbrella.
- RFC-0126 `window.MyIOUtils` bridge (the `getCredentials` publish/consume contract).

## Unresolved questions

1. Should `CHARTS_BASE_URL` be replaced by `settings.chartsBaseUrl` (RFC-0210 `chartsBaseUrl`) so prod vs
   staging is operator-configurable rather than a hard-coded staging const?
2. Exact param shapes of `openDashboardPopup` / `openDashboardPopupReport` / `openDashboardPopupSettings`
   in the current lib build — needs browser verification.
3. Where should the per-device telemetry that populates the info-card values come from (RFC-0210 Phase C
   `enablePerDeviceTelemetryFetch`) and does it feed `setEnergyData/setWaterData` directly?

## Future possibilities

- Port the remaining grid column chrome (`(i)`-icon / `headerActions` / device-map / sync) once the
  component is re-aligned with v-5.2.0.
- Implement an actual shopping picker reacting to `myio:shopping-selector-click`.
- Drive `chartsBaseUrl` and the per-device telemetry gate from settings to finish RFC-0210 parity.
