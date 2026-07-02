# RFC-0215 — Settings hub parity for v-5.4.0: consolidated "Configurações" menu (from v-5.2.0 MENU)

- **RFC**: 0215
- **Title**: Make the left-sidebar **⚙️ Configurações** entry in `main-dashboard-shopping` **v-5.4.0** open the **consolidated settings hub** (grid of options) faithful to v-5.2.0, instead of jumping straight into a single modal.
- **Status**: Proposed (2026-07-01) — design only, not implemented.
- **Author**: Rodrigo Lago
- **Created**: 2026-07-01
- **Target**:
  - `src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js` — replace `openSettings()` (which opens one modal) with a hub that mirrors v-5.2.0's `showSettingsModal`.
  - *(Alternative C only)* `src/components/settings-hub/` (new lib component) + `src/index.ts` export.
- **Untouched (source of truth being matched)**:
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js` — `showSettingsModal` (the hub) and its per-option handlers.
- **Related**:
  - RFC-0108 — Consolidated settings menu (the v-5.2.0 hub this RFC brings to v-5.4.0).
  - RFC-0201 — Sync v-5.4.0 ← v-5.2.0 (this RFC is the "settings menu" slice of that plan).
  - RFC-0210 — Settings parity v-5.4.0 (widget-settings schema parity; complementary — this RFC is the runtime *menu*, not the TB widget settings).
  - RFC-0211 — v-5.4.0 parity for menu/footer/grid/info (added `onSettingsClick`; this RFC fixes what that click opens).
  - RFC-0207 — Device Classification Profile (the "Gestão de Perfil de Dispositivos" option).

---

## Summary

In v-5.2.0 the MENU widget adds a **⚙️ Configurações** button to the menu footer
(`addSettingsMenuButton`) whose click opens **`showSettingsModal(user)`** — a modal **hub**: a grid
of option cards (`.myio-settings-option`) that route to the individual settings modals. Some options
are always visible; the rest are **SuperAdmin-only** (MyIO staff).

In v-5.4.0 the menu is the library component `createMenuShoppingComponent`, wired with
`onSettingsClick: openSettings` (RFC-0211). But `openSettings()` **skips the hub** and calls
`window.MyIOLibrary.openMeasurementSetupModal(...)` **directly** — so clicking "Configurações" opens
the single **Config. Medidas** modal rather than the menu of options. This is the reported bug:
*"em configurações deveria abrir um menu fiel à v-5.2.0; a v-5.4.0 abre um menu erradamente."*

This RFC specifies restoring the hub in v-5.4.0 with parity to v-5.2.0.

---

## Motivation

- **Functional regression.** v-5.4.0 users can only reach one of the settings modals (measurement);
  temperature limits, contracted devices, user management, device-profile rules, etc. are
  unreachable from the menu.
- **Faithful, not novel.** v-5.2.0 already ships the desired UX (RFC-0108). The goal is parity, not a
  redesign — reuse the same grid, labels, icons, ordering, and SuperAdmin gating.
- **Most backing modals already exist in the library** and are reachable from v-5.4.0 via
  `window.MyIOLibrary.*` (v-5.4.0 is allowed to reference `MyIOLibrary` directly).

---

## Current state

### v-5.2.0 (reference)
- `addSettingsMenuButton(user)` → footer button `#settings-menu-btn` ("⚙️ Configurações").
- Click → `showSettingsModal(user)`:
  - Injects `#myio-conf-picker` modal styles (`.myio-conf-picker*`, `.myio-settings-option*`), header
    `⚙️ Configurações — <customerName>`, 2-column grid body.
  - Option cards, each `data-action` routing (on click, close hub then open the target):

    | # | `data-action` | Card | Visible to | v-5.2.0 handler | Backing |
    |---|---|---|---|---|---|
    | 1 | `temperature` | 🌡️ Config. Temperatura | all | `openTemperatureSettings` | lib `openTemperatureSettingsModal` |
    | 2 | `contract` | 📋 Dispositivos Contratados | all | `openContractDevicesSettings` | lib `openContractDevicesModal` |
    | 3 | `measurement` | 📐 Config. Medidas | all | `openMeasurementSettings` | lib `openMeasurementSetupModal` |
    | 4 | `integration` | 🔗 Setup de Integração | SuperAdmin | `openIntegrationSetupModal` | **custom inline** (no lib symbol) |
    | 5 | `user-management` | 👥 Gestão de Usuários | SuperAdmin | `openUserManagementModal` | lib `openUserManagementModal` |
    | 6 | `default-dashboard` | 🏠 Dashboard Padrão | SuperAdmin | `openDefaultDashboardSettings` | **custom inline** (writes `customerDefaultDashboard` attr) |
    | 7 | `client-config` | 🏢 Configurações Cliente | SuperAdmin | `openClientConfig` | **custom inline** (features + master password) |
    | 8 | `device-profile` | 🧩 Gestão de Perfil de Dispositivos | SuperAdmin | `openDeviceProfileSettings` | lib `openDeviceProfileModal` (RFC-0207) |

  - Close on overlay click, ✕, and `Escape`.

### v-5.4.0 (the bug)
- `createMenuShoppingComponent({ … onSettingsClick: openSettings })`.
- `openSettings()` (`controller.js`) → guards jwt + `customerTB_ID`, then
  `window.MyIOLibrary.openMeasurementSetupModal({ token, customerId, existingSettings, onSave, onClose })`.
- **No hub** — one option only; the other seven are unreachable.

---

## Proposed design

Replace v-5.4.0 `openSettings()` with a **hub** that reproduces v-5.2.0's `showSettingsModal`:

1. **Hub modal** — port the `#myio-conf-picker` markup + CSS + close handlers (overlay/✕/Esc)
   verbatim (same classes, icons, labels, ordering, `— <customerName>` in the title). `customerName`
   comes from `resolveShoppingName()` (already in v-5.4.0).
2. **SuperAdmin gating** — render options 4–8 only when the current user is SuperAdmin. v-5.4.0 must
   resolve `isSuperAdmin` (see *Open questions*): from `window.MyIOUtils.SuperAdmin`, the menu user
   info (`updateUserInfo({ isAdmin })`), or a `@myio.com.br` email heuristic — matching v-5.2.0.
3. **Per-option routing** — on click, close the hub, then (after the close animation) open the target:
   - **Lib-backed (1,2,3,5,8)** — call the corresponding `window.MyIOLibrary.*` modal with the same
     params v-5.4.0 already assembles in `openSettings` today (`token = jwt`, `customerId = customerTB_ID`,
     `existingSettings`, `onSave`/`onClose`). Each guarded by jwt + customerId + symbol availability,
     degrading via `toastError` (no `window.alert`).
   - **Custom (4,6,7)** — see *Phasing*.

### Phasing (maps to the three implementation options)

- **Phase 1 — hub + lib-backed options (recommended first).** Build the hub and wire options
  **1,2,3,5,8** (all backed by existing lib symbols). Options 4/6/7 are either hidden for now or shown
  disabled with an "em breve na v-5.4.0" affordance. Fixes the reported bug with low risk; no v-5.2.0
  changes.
- **Phase 2 — full parity.** Port the three custom SuperAdmin handlers
  (`openIntegrationSetupModal`, `openDefaultDashboardSettings`, `openClientConfig`) from v-5.2.0 MENU
  into v-5.4.0 (each is a self-contained inline modal of ~100–300 lines).
- **Phase 3 (optional cleanup) — extract to lib.** Refactor `showSettingsModal` into a reusable
  library component `openSettingsHubModal({ customerId, jwt, tbBaseUrl, isSuperAdmin, handlers })`
  and call it from **both** v-5.2.0 and v-5.4.0 (DRY). Touches v-5.2.0 (currently working) → do last,
  behind tests.

---

## Alternatives considered

- **A. Keep `openSettings` → measurement only.** Rejected — that *is* the bug.
- **B. Hardcode a v-5.4.0-specific subset of options.** Rejected — drifts from v-5.2.0; the ask is
  fidelity.
- **C. Extract to lib first (Phase 3 up front).** Cleanest long-term, but changes the working v-5.2.0
  hub before v-5.4.0 parity exists — higher regression risk. Deferred to Phase 3.

Chosen: **Phase 1 now**, Phases 2–3 as follow-ups.

---

## Implementation plan (Phase 1)

1. In `v-5.4.0/controller.js`, add `_settingsHubStyles()` (inject `#myio-conf-picker` CSS once) and
   `openSettingsHub(user)` (build `#myio-conf-picker`, grid, close handlers) — ported from v-5.2.0.
2. Add thin wrappers `openTemperatureSettings()`, `openContractDevicesSettings()`,
   `openMeasurementSettings()` (rename the current `openSettings` body), `openUserManagement()`,
   `openDeviceProfile()` — each: guard jwt + `customerTB_ID`, call the matching
   `window.MyIOLibrary.*`, `toastError` on failure.
3. Repoint the menu: `onSettingsClick: () => openSettingsHub(currentUser)`.
4. Gate options 4–8 behind `isSuperAdmin`; hide 4/6/7 in Phase 1 (or disabled affordance).
5. Keep the `measurement` `onSave` behavior (updates `MyIOOrchestrator.measurementDisplaySettings`,
   dispatches `myio:measurement-settings-updated`).

**Non-goals (Phase 1):** porting the three custom modals; touching v-5.2.0; changing the TB widget
settings schema (that is RFC-0210).

---

## Testing / acceptance

- Clicking **⚙️ Configurações** in v-5.4.0 opens the **grid hub** (not the measurement modal directly).
- Cards **Temperatura / Contratados / Medidas** open their modals; **Usuários / Perfil de Dispositivos**
  appear only for SuperAdmin and open their modals.
- Hub closes on overlay/✕/Esc; the target modal opens after the close animation.
- Missing jwt/customerId/symbol → `toastError` (never `window.alert`; per project rule).
- No regression in v-5.2.0 (untouched in Phases 1–2).

---

## Open questions

1. **`isSuperAdmin` source in v-5.4.0.** v-5.2.0 derives it from the user; v-5.4.0 must pick a single
   source (`window.MyIOUtils.SuperAdmin`, menu `updateUserInfo({ isAdmin })`, or `@myio.com.br` email).
   Decide before Phase 1.
2. **Phase-1 treatment of options 4/6/7.** Hide entirely vs. show disabled with a note. Default: hide
   (cleaner) until Phase 2 lands them.
3. **Eventual DRY (Phase 3).** Is extracting `openSettingsHubModal` into the lib worth the v-5.2.0
   change, or is per-version duplication acceptable given the two controllers already diverge?
