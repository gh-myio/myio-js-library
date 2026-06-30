# RFC-0214 — Header parity for v-5.4.0: Alarm, Ticket (Chamados) and Annotation buttons

- **RFC**: 0214
- **Title**: Bring the **🔔 Alarmes**, **🎫 Chamados (FreshDesk)** and **✏️ Anotações** header buttons (and their orchestrators) to `main-dashboard-shopping` **v-5.4.0**, matching v-5.2.0
- **Status**: Proposed (2026-06-26) — design only, not implemented. For future implementation.
- **Author**: Rodrigo Lago
- **Created**: 2026-06-26
- **Target**:
  - `src/components/header-shopping/HeaderShoppingView.ts` (add the 3 buttons + badges to the template/bindings)
  - `src/components/header-shopping/types.ts` (config flags, callbacks, event names)
  - `src/components/header-shopping/createHeaderShoppingComponent.ts` (wiring, badge/loading state, public API)
  - `src/components/header-shopping/styles.ts` (button + badge + loading-spinner styles)
  - `src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js` (build the 3 orchestrators; pass flags/callbacks to the header)
- **Untouched**:
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/**` — the source of truth being matched.
- **Related**:
  - RFC-0201 — Sync v-5.4.0 ← v-5.2.0 (this RFC implements the header slice of that plan; RFC-0201 already lists `AlarmServiceOrchestrator`, `TicketServiceOrchestrator`, `AnnotationServiceOrchestrator` as missing in v-5.4.0).
  - RFC-0193 — Alarm notification bell in the header.
  - RFC-0183 — `AlarmServiceOrchestrator` + AlarmBadge (`deviceAlarmMap`, `getAlarmCountForDevice`, `refresh`).
  - RFC-0180 — Pre-fetch customer alarms (`MyIOOrchestrator.customerAlarms`) — already present in v-5.4.0.
  - RFC-0198 — Tickets / FreshDesk (`TicketServiceOrchestrator`, `createTicketDetailModal`).
  - RFC-0203 — Operational annotations (`AnnotationServiceOrchestrator`, annotations panel).
  - RFC-0146 — Header component (`createHeaderShoppingComponent`) replacing the v-5.2.0 HEADER widget.
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/{template.html,controller.js,styles.css}` — the v-5.2.0 reference implementation (button HTML + wiring).
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` — where the 3 orchestrators are built in v-5.2.0.

---

## Summary

In `main-dashboard-shopping` **v-5.2.0**, the header (a dedicated TB **HEADER widget**) carries three
operational buttons beyond load/refresh/report:

- **🔔 Alarmes** (RFC-0193/0183) — bell with badge, hover tooltip, click toggles an alarm filter on the grid.
- **🎫 Chamados** (RFC-0198) — FreshDesk tickets, badge, opens a ticket-detail modal.
- **✏️ Anotações** (RFC-0203) — operational annotations, badge, opens the annotations panel.

In **v-5.4.0**, the header is the library component **`createHeaderShoppingComponent`**
(`src/components/header-shopping/`), which today renders **only** the date range, **Carregar**,
**Limpar** (force refresh) and **Relatório** buttons. The three operational buttons — and the
three `window.*ServiceOrchestrator` globals that feed them — are **absent**.

This RFC specifies how to bring them to v-5.4.0 with parity, in **two layers**:

1. **Component layer** — extend `header-shopping` to render the three buttons (with loading state,
   badges, tooltips) gated by config flags, emitting callbacks/events.
2. **Controller layer** — in the v-5.4.0 controller (which plays the role of v-5.2.0's MAIN_VIEW),
   **build the three orchestrators** and pass the flags + callbacks to the header, reusing the
   assets v-5.4.0 already has.

It is **design only**; implementation is future work (a slice of RFC-0201).

---

## Motivation

- **Functional gap, not a cosmetic one.** v-5.4.0 users lose alarm triage (bell + grid filter),
  ticket access (chamados), and operational annotations — core day-to-day workflows present in
  v-5.2.0. The dashboard is otherwise the target replacement (RFC-0201).
- **Most of the plumbing already exists in v-5.4.0.** Alarm *data* is already pre-fetched
  (RFC-0180 → `MyIOOrchestrator.customerAlarms`), ticket customer attributes
  (`tickets_enabled`, `tickets_only_to_myio`) are present, and `enableAnnotationsOnboarding` is
  already read from settings. What's missing is the orchestrators + the buttons + the wiring.
- **The header is now a shared component.** Doing this in `header-shopping` (not in a bespoke
  widget controller) means any consumer of the component can opt into the buttons, and the
  v-5.4.0 controller only has to build orchestrators and pass callbacks — the v-5.2.0 split
  (HEADER widget renders buttons, MAIN_VIEW builds orchestrators) maps cleanly onto
  (component renders buttons, controller builds orchestrators).

---

## Guide-level explanation

### What the user sees (parity with v-5.2.0)

Three buttons appear in the header, left group, after **Limpar**:

- **🔔 Alarmes** — starts in a loading state until alarms are fetched; then shows a count badge.
  Hover shows the `AlarmNotificationTooltip`; click toggles the **alarm filter** (grid shows only
  devices with alarms; button gets the `alarm-filter-active` highlight). No-op (with a log) when
  alarms aren't configured or zero are visible (respecting `showOfflineAlarms`).
- **🎫 Chamados** — loading until FreshDesk config arrives; then a badge with open-ticket count.
  Opens the ticket-detail modal (`createTicketDetailModal`).
- **✏️ Anotações** — visible from start with a spinner; swaps to the icon once
  `AnnotationServiceOrchestrator` is built. Badge = total; opens the annotations panel; aria-label
  reflects pending/overdue counts.

Each button is **independently gated** — a deployment without tickets shows no chamados button.

### How the v-5.4.0 controller turns them on

```js
_headerInstance = lib.createHeaderShoppingComponent({
  container: headerContainer,
  themeMode: _currentThemeMode,
  credentials: _credentials,
  configTemplate: { timezone: 'America/Sao_Paulo' },
  onLoad: (period) => window.dispatchEvent(new CustomEvent('myio:update-date', { detail: { period } })),

  // NEW — gates (default false so existing callers are unaffected)
  showAlarmButton: alarmsConfigured,
  showTicketButton: ticketsEnabled,
  showAnnotationButton: true,

  // NEW — callbacks (delegate to orchestrators built by the controller)
  onAlarmClick: () => toggleAlarmFilter(),
  onTicketClick: () => window.TicketServiceOrchestrator?.openList?.(),
  onAnnotationClick: () => window.AnnotationServiceOrchestrator?.openPanel?.(),
});
```

Badges are pushed to the header instance as orchestrators update:

```js
_headerInstance.setAlarmBadge(count, { loading, configured });
_headerInstance.setTicketBadge(count, { loading });
_headerInstance.setAnnotationBadge(total, { pending, overdue, loading });
```

---

## Reference-level explanation

### Naming/structure map (v-5.2.0 → v-5.4.0)

| Concern | v-5.2.0 | v-5.4.0 (this RFC) |
|---|---|---|
| Button HTML | `HEADER/template.html` (`tbx-btn-alarm-notif`, `tbx-btn-ticket-notif`, `tbx-btn-annotation-notif`) | `HeaderShoppingView.ts` template (same ids/classes) |
| Button wiring | `HEADER/controller.js` (~2942 LOC) | `createHeaderShoppingComponent.ts` + controller callbacks |
| Orchestrators | `MAIN_VIEW/controller.js` builds the 3 `window.*` globals | v-5.4.0 `controller.js` builds them |
| Styles | `HEADER/styles.css` | `header-shopping/styles.ts` |

Keep the **same element ids/classes** (`tbx-btn-*-notif`, `tbx-*-badge`, `tbx-loading-spinner`,
`alarm-filter-active`) so the v-5.2.0 CSS and tooltip/panel code port with minimal change.

### 1. Component: `header-shopping` template (`HeaderShoppingView.ts`)

Render the three buttons (copy the markup from `v-5.2.0/.../HEADER/template.html:40-100`) gated by
config flags, after the force-refresh button. Add bound element handles
(`btnAlarm`, `btnTicket`, `btnAnnotation`, and their badge spans) alongside the existing
`btnReport`. Emit events on click: `alarm-click`, `ticket-click`, `annotation-click`.

Public view methods (mirroring `btnReport` patterns at `HeaderShoppingView.ts:382-417`):
`setAlarmBadge`, `setTicketBadge`, `setAnnotationBadge`, plus `setAlarmFilterActive(bool)` to
toggle the `alarm-filter-active` class.

### 2. Component: `types.ts`

```ts
export interface HeaderShoppingConfig {
  // ...existing...
  showAlarmButton?: boolean;       // default false
  showTicketButton?: boolean;      // default false
  showAnnotationButton?: boolean;  // default false
  onAlarmClick?: () => void;
  onTicketClick?: () => void;
  onAnnotationClick?: () => void;
}
// event union gains: 'alarm-click' | 'ticket-click' | 'annotation-click'
// DEFAULT_CONFIG gains the three show* flags = false
```

Defaults `false` keep every current caller byte-identical (only the v-5.4.0 controller opts in).

### 3. Component: `createHeaderShoppingComponent.ts`

- Wire `view.on('alarm-click' | 'ticket-click' | 'annotation-click', …)` → `params.on*Click?.()`
  and re-emit on the component bus.
- Expose `setAlarmBadge/setTicketBadge/setAnnotationBadge/setAlarmFilterActive` on the returned
  instance (so the controller can push counts as orchestrators update).
- Manage the per-button **loading** state (`is-loading` class + spinner) until the controller
  reports configured/ready.

### 4. Component: `styles.ts`

Port the button/badge/spinner/filter-active rules from `HEADER/styles.css` (classes
`tbx-btn-alarm-notif`, `tbx-btn-ticket-notif`, `tbx-btn-annotation-notif`, `tbx-*-badge`,
`tbx-loading-spinner`, `tbx-ticket-error-x`, `.alarm-filter-active`).

### 5. Controller: v-5.4.0 `controller.js`

Build the three orchestrators (port from `v-5.2.0/.../MAIN_VIEW/controller.js`), reusing what
v-5.4.0 already has, then pass flags/callbacks to the header.

**🔔 Alarm (`window.AlarmServiceOrchestrator`)** — RFC-0183.
- v-5.4.0 **already** pre-fetches alarms (`_prefetchCustomerAlarms` → `MyIOOrchestrator.customerAlarms`,
  RFC-0180) and has `alarmsApiBaseUrl/Key`. Build the orchestrator (`deviceAlarmMap`,
  `getAlarmCountForDevice`, `refresh`) over that data, set `MyIOOrchestrator.alarmsConfigured`.
- Implement `toggleAlarmFilter()` (grid filter to devices with alarms; respect `showOfflineAlarms`;
  `_countVisible`), and push `setAlarmBadge`. Wire `AlarmNotificationTooltip` on hover.

**🎫 Ticket (`window.TicketServiceOrchestrator`)** — RFC-0198.
- Read `tickets_enabled` / `tickets_only_to_myio` (already in `customerAttributes-server-scope/`).
  Build the orchestrator (prefetch, `tickets-ready` event, `refresh`, count). Open detail via
  `createTicketDetailModal` (through `MyIOUtils`). Push `setTicketBadge`.

**✏️ Annotation (`window.AnnotationServiceOrchestrator`)** — RFC-0203.
- Build the orchestrator (`getTotalCount/getPendingCount/getOverdueCount`, panel open/close).
  `enableAnnotationsOnboarding` is already read. Push `setAnnotationBadge`; open the annotations
  panel on click.

### Data/ownership flow

```
v-5.4.0 controller (≈ MAIN_VIEW)
  ├─ build AlarmServiceOrchestrator      (over MyIOOrchestrator.customerAlarms — already fetched)
  ├─ build TicketServiceOrchestrator     (tickets_enabled attr + FreshDesk)
  ├─ build AnnotationServiceOrchestrator (RFC-0203)
  └─ createHeaderShoppingComponent({ show*Button, on*Click })
         │ buttons emit *-click
         ▼
  controller callbacks → orchestrator.openPanel/openList/toggleFilter
         ▲ orchestrator updates
         └─ controller pushes setAlarmBadge / setTicketBadge / setAnnotationBadge
```

---

## Drawbacks

- **Porting ~2900 LOC of HEADER + MAIN_VIEW logic.** The v-5.2.0 button wiring and orchestrators are
  large; faithful porting is non-trivial and risks subtle behavioral drift (badge timing, filter
  edge cases, loading races).
- **Three more globals on v-5.4.0.** Re-introduces `window.*ServiceOrchestrator` coupling, against
  the agnostic direction of v-5.4.0 (RFC-0209). Mitigated by keeping orchestrator *construction* in
  the controller and the component dependent only on callbacks/badges, not on globals.
- **onInit races.** Orchestrators build after async fetches; buttons must show loading and tolerate
  badges arriving late (the v-5.2.0 "seed badge if orchestrator already built" pattern must port).
- **Feature-flag surface.** Three independent gates + customer attributes increase config paths to
  test.

## Rationale and alternatives

- **Buttons in the component vs. a bespoke v-5.4.0 header widget.** Putting them in `header-shopping`
  keeps a single header surface and lets the controller stay thin (build orchestrators, pass
  callbacks). A separate widget would re-fragment the header that RFC-0146 unified.
- **Reuse v-5.2.0 ids/classes vs. new ones.** Reusing them lets the existing CSS, tooltip and panel
  code port with minimal change and keeps visual parity exact.
- **Component depends on callbacks, not on `window.*Orchestrator`.** Keeps the component
  framework-agnostic and testable; the controller owns the globals (as v-5.2.0's MAIN_VIEW does).

## Prior art

- v-5.2.0 is the working reference: `HEADER/template.html` (button HTML), `HEADER/controller.js`
  (wiring: `tbx-btn-alarm-notif` filter toggle, `_openTicketDetail`, `_updateAnnotationBadge`),
  `MAIN_VIEW/controller.js` (orchestrator construction).
- RFC-0211 already ported other header/footer/grid parity items to v-5.4.0 — same fork-and-match
  pattern.

## Unresolved questions

1. **Alarm filter mechanics in v-5.4.0.** The grid is generated dynamically from the GCDR tree
   (RFC-0209), unlike v-5.2.0's fixed grids. How does `toggleAlarmFilter()` apply across the
   dynamic per-domain grids — a global predicate on every grid, or a controller-level filter state
   the grids subscribe to?
2. **Ticket modal availability.** Is `createTicketDetailModal` exposed to v-5.4.0 via the
   `MyIOUtils` bridge (the `LIB_SYMBOLS` list), or does it need adding?
3. **Annotations panel host.** Where does `myio-annotations-panel` mount in the v-5.4.0 layout
   (`panelModalContainer`?), and does the v-5.4.0 header have the customer/device context the
   orchestrator needs?
4. **Badge update channel.** Push via header-instance methods (this RFC) vs. the component listening
   to `myio:*-ready` events directly. Methods keep the component dumb; events reduce controller glue.
5. **Gating defaults.** Should `showAnnotationButton` default on (annotations are memory-only,
   LGPD-safe) while alarm/ticket gate on config/attributes? Proposed: yes.

## Future possibilities

- **Extract a small `HeaderOps` mixin** so other dashboards (e.g. unique/head-office) reuse the same
  three-button block.
- **Unify badge plumbing** with a single `myio:header-badges` event carrying all three counts.
- **Deprecate the v-5.2.0 HEADER widget** once v-5.4.0 reaches parity (RFC-0201 close-out).
