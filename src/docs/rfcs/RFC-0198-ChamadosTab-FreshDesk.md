# RFC-0198 — TicketsTab + TicketServiceOrchestrator (FreshDesk)

- **Feature Name**: `tickets_tab_freshdesk`
- **Status**: Implemented
- **Date**: 2026-04-02
- **Branch**: `desenv`
- **Mirrors**: RFC-0183 (AlarmServiceOrchestrator + AlarmBadge)

---

## Summary

Introduce a **Chamados** (support tickets) integration with
[FreshDesk](https://freshdesk.com) into the MyIO dashboard ecosystem.
The integration has three surfaces:

1. **`TicketServiceOrchestrator`** — a new `window.*` global (parallel to
   `AlarmServiceOrchestrator`) that pre-fetches and indexes open FreshDesk tickets
   by device identifier at dashboard init time.
2. **Ticket Badge** on device cards — a bottom-left badge (🎫 + open count),
   positioned below the existing alarm badge (top-left, RFC-0183).
3. **`TicketsTab`** inside `SettingsModal` — a new tab (parallel to `AlarmsTab`,
   RFC-0180) that lists open tickets for the selected device and lets operators
   open a new ticket pre-filled with device context.

---

## Motivation

Support engineers and field technicians currently track device-related incidents in
FreshDesk, but the MyIO dashboard has no visibility into open tickets.  Operators
must switch between FreshDesk and the dashboard to check whether a device already
has a pending support case, leading to:

- Duplicate ticket creation for the same fault.
- Missed escalation of existing tickets when the operator sees a new alarm.
- No quick path from a device card to the relevant FreshDesk ticket.

Bringing ticket context directly into the dashboard closes this gap without
rebuilding a ticketing system.

---

## Guide-level explanation

### FreshDesk instance

| Field          | Value                                                      |
|----------------|------------------------------------------------------------|
| Domain         | `myiocom.freshdesk.com`                                    |
| API Base       | `https://myiocom.freshdesk.com/api/v2`                     |
| Auth scheme    | HTTP Basic — `apiKey:X` (base-64)                          |
| API key        | Stored in `window.MyIOUtils.freshdeskApiKey` (widget setting); current configured value: `dyMPszXMvRhsv4ratK4` — **do not hard-code** |

> ⚠️  The API key must be stored as a ThingsBoard widget server-side setting and
> exposed via `window.MyIOUtils.freshdeskApiKey`, never embedded in compiled JS.

### Device linking convention

Each FreshDesk ticket that refers to a MyIO device must carry a custom field:

| FreshDesk custom field | Value example  |
|------------------------|----------------|
| `cf_device_identifier` | `MED-LOJA-01`  |

The field is populated automatically when a ticket is created through the
TicketsTab quick-create form. For tickets created externally, agents must fill
the field manually; tickets without the field are ignored by
`TicketServiceOrchestrator`.

### Ticket types

| Type | Label                    |
|------|--------------------------|
| `1`  | Software / Dashboard     |
| `2`  | Instalação               |

Stored in FreshDesk custom field `cf_ticket_type`.

### Ticket motivo (reason)

| Value          | Description                           |
|----------------|---------------------------------------|
| `Corretivo`    | Fix for an existing fault or bug      |
| `Evolutivo`    | Enhancement / new feature request     |
| `Instalação`   | On-site installation support          |

Stored in FreshDesk custom field `cf_motivo`.

### Ticket button in HEADER widget

A button is added to the HEADER toolbar immediately to the right of the alarm bell
button (`tbx-btn-alarm-notif`). It follows the same visual pattern: ghost button with
domain color, counter badge in the corner.

```
[ ⟲ Carregar ] [ 🔄 Limpar ] [ 🔔 3 ] [ 🎫 2 ] [ 🧾 Relatório ]
                               ↑ alarm  ↑ tickets
```

- **Hidden by default** (`style="display:none"`). Shown automatically when
  `window.MyIOUtils.freshdeskApiKey` is set.
- **Badge counter**: total open/pending/waiting tickets across all devices,
  updated on `myio:tickets-ready` event.
- **On click**: opens `https://{freshdeskDomain}/helpdesk/tickets` in a new tab.
- **Color**: orange (`#f97316`) — same token as the device-card badge.

```html
<!-- template.html -->
<button class="tbx-btn tbx-btn-ticket-notif" id="tbx-btn-ticket-notif"
        title="Chamados (FreshDesk)" style="display:none">
  <span class="tbx-ico">🎫</span>
  <span id="tbx-ticket-notif-badge" class="tbx-ticket-badge" style="display:none"></span>
</button>
```

```css
/* styles.css */
.tbx-btn-ticket-notif {
  background: rgba(249,115,22,0.12);
  color: #f97316;
  border: 1px solid rgba(249,115,22,0.25);
  position: relative;
}
.tbx-ticket-badge {
  position: absolute; top:-5px; right:-5px;
  background: #f97316; color:#fff;
  /* same dimensions as .tbx-alarm-badge */
}
```

### Ticket badge on device cards

```
┌─────────────────────────┐
│ 🔔 3          [card top]│   ← alarm badge (RFC-0183) — top-left
│                         │
│   MED-LOJA-01           │
│   ✅ 220V  ⚡ 4.2 kWh  │
│                         │
│ 🎫 2      [card bottom] │   ← ticket badge (RFC-0198) — bottom-left
└─────────────────────────┘
```

- Visible only when the device has ≥ 1 open/pending/waiting ticket.
- Counter shows open + pending + waiting tickets (statuses `2`, `3`, `6`).
- Clicking the badge opens `SettingsModal` on the **Chamados** tab.
- Color: `#f97316` (orange-500) to distinguish from alarm red (`#dc2626`).

### TicketsTab — user flow

1. Operator opens the **Configurações** modal for a device.
2. Clicks the **Chamados** tab.
3. **Section 1 — Open tickets** loads (pre-fetched by `TicketServiceOrchestrator`
   or live-fetched on first open).
   - Each ticket card shows: subject, status pill, priority, requester name,
     creation date, and a **[→ FreshDesk]** external link.
4. **Section 2 — Novo Chamado** (collapsible, collapsed by default).
   - **Assunto** (Subject) — pre-filled with `[DEVICE_IDENTIFIER] DEVICE_LABEL`; required.
   - **Tipo** — select: `Software / Dashboard` (1) or `Instalação` (2); required.
   - **Motivo** — select: `Corretivo`, `Evolutivo`, `Instalação`; required.
   - **Descrição** — textarea; optional.
   - **Anexos** — file input (multiple); optional; accepts images, PDF, Word, Excel, text.
   - **E-mail do solicitante** — required.
   - `cf_device_identifier`, `cf_ticket_type`, `cf_motivo` are silently set from form values.
   - On submit: `POST /api/v2/tickets` (JSON if no attachments; multipart if attachments present).
   - On success: tab reloads Section 1 and shows ticket ID.

### TicketServiceOrchestrator

Created during `MAIN_VIEW/controller.js` `onInit`, after the device list is ready:

```javascript
window.TicketServiceOrchestrator = {
  tickets,           // FreshDeskTicket[] — all open tickets for the customer
  deviceTicketMap,   // Map<deviceIdentifier, FreshDeskTicket[]>

  getTicketCountForDevice(identifier) { … },  // → number (open + pending + waiting)
  getTicketsForDevice(identifier)     { … },  // → FreshDeskTicket[]
  async refresh()                     { … },  // re-fetch + rebuild maps
};
```

`deviceIdentifier` = `device.identifier` (e.g., `MED-LOJA-01`) — the same key
used as `cf_device_identifier` in FreshDesk.

---

## Reference-level explanation

### FreshDesk API endpoints used

| Method  | Path                                                             | Purpose                                       |
|---------|------------------------------------------------------------------|-----------------------------------------------|
| `GET`   | `/api/v2/tickets?cf_device_identifier={id}&status=2,3,6`        | Fetch open/pending/waiting tickets for one device |
| `GET`   | `/api/v2/tickets?status=2,3,6&per_page=100&page=N`              | Bulk-fetch all open tickets (customer-level prefetch) |
| `POST`  | `/api/v2/tickets`                                                | Create a new ticket (JSON or multipart)       |
| `PUT`   | `/api/v2/tickets/{id}`                                           | Reopen a ticket (status→2)                    |

FreshDesk ticket status codes:

| Code | Label     |
|------|-----------|
| 2    | Open      |
| 3    | Pending   |
| 4    | Resolved  |
| 5    | Closed    |
| 6    | Waiting   |

Statuses counted for the badge: **2 (Open) + 3 (Pending) + 6 (Waiting)**.

### Authentication

```typescript
// FreshDesk uses HTTP Basic: apiKey:X (password is the literal letter X)
'Basic ' + btoa(apiKey + ':X')
```

### Types

```typescript
export type TicketTypeId = 1 | 2;
// 1 = Software / Dashboard
// 2 = Instalação

export type TicketMotivo = 'Corretivo' | 'Evolutivo' | 'Instalação';

export interface FreshDeskTicket {
  id: number;
  subject: string;
  description_text?: string;
  status: 2 | 3 | 4 | 5 | 6;
  priority: 1 | 2 | 3 | 4;         // low | medium | high | urgent
  requester_id: number;
  requester?: { name: string; email: string };
  created_at: string;               // ISO-8601
  updated_at: string;
  custom_fields: {
    cf_device_identifier?: string;
    cf_ticket_type?: TicketTypeId;
    cf_motivo?: TicketMotivo;
    [key: string]: unknown;
  };
  tags: string[];
}

export interface TicketsTabConfig {
  container: HTMLElement;
  deviceIdentifier: string;         // e.g. "MED-LOJA-01"
  tbDeviceId: string;
  deviceLabel?: string;
  freshdeskApiKey: string;
  freshdeskDomain: string;          // e.g. "myiocom.freshdesk.com"
  prefetchedTickets?: FreshDeskTicket[] | null;
}

export interface TicketServiceOrchestratorShape {
  tickets: FreshDeskTicket[];
  deviceTicketMap: Map<string, FreshDeskTicket[]>;
  getTicketCountForDevice(identifier: string): number;
  getTicketsForDevice(identifier: string): FreshDeskTicket[];
  refresh(): Promise<void>;
}
```

### `createTicket` signature

```typescript
createTicket(
  domain: string,
  apiKey: string,
  subject: string,
  deviceIdentifier: string,
  email: string,
  options?: {
    description?: string;
    ticketType?: TicketTypeId;    // → cf_ticket_type
    motivo?: TicketMotivo;        // → cf_motivo
    attachments?: File[];         // → multipart/form-data when present
  }
): Promise<FreshDeskTicket | null>
```

When `attachments` is provided, the request uses `FormData` instead of
`JSON.stringify` and the `Content-Type` header is omitted (browser sets it with
boundary automatically).

### TicketServiceOrchestrator build algorithm

```
1. Fetch all open tickets (status 2,3,6) via paginated GET
   (page 100, up to 10 pages max — 1 000 tickets max).
2. Filter: keep only tickets where custom_fields.cf_device_identifier is set.
3. Build Map<identifier, FreshDeskTicket[]>.
4. Dispatch window event 'myio:tickets-ready' with { ticketMap }.
5. For each device card in the rendered TelemetryGrid:
     count = deviceTicketMap.get(device.identifier)?.length ?? 0
     if count > 0 → inject .myio-ticket-badge
```

### Ticket badge DOM

```
.card-wrapper (position: relative)
├── .myio-alarm-badge    top:6px;    left:6px   (RFC-0183)
│   ├── <svg> bell
│   └── <span> 3
└── .myio-ticket-badge   bottom:6px; left:6px   (RFC-0198)
    ├── 🎫
    └── <span> 2
```

```css
.myio-ticket-badge {
  position: absolute;
  bottom: 6px;
  left: 6px;
  background: #f97316;      /* orange-500 */
  color: #fff;
  border-radius: 12px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0,0,0,.35);
}
```

### `window.MyIOUtils` additions

| Key               | Type     | Example                   |
|-------------------|----------|---------------------------|
| `freshdeskApiKey` | `string` | `"dyMPszXMvRhsv4ratK4"`   |
| `freshdeskDomain` | `string` | `"myiocom.freshdesk.com"` |

Both read from widget settings in `MAIN_VIEW/controller.js` and exposed on
`window.MyIOUtils` at init time.

### New global event

```
myio:tickets-ready
  detail: { ticketMap: Map<identifier, FreshDeskTicket[]> }
```

Dispatched by `TicketServiceOrchestrator` when prefetch completes and after each
`refresh()`. TELEMETRY widget listens to this event to inject ticket badges
(same pattern as `myio:data-ready` for alarm badges).

### FreshDesk custom fields required

A FreshDesk admin must create these custom fields on the ticket form:

| API name               | Type    | Label (suggested)    |
|------------------------|---------|----------------------|
| `cf_device_identifier` | Text    | Identificador MyIO   |
| `cf_ticket_type`       | Dropdown| Tipo de Chamado      |
| `cf_motivo`            | Dropdown| Motivo               |

---

## Drawbacks

- **CORS**: FreshDesk API does not send CORS headers for browser requests.
  All FreshDesk calls must be proxied server-side (Node-RED or ThingsBoard proxy).
  This is the most significant deployment constraint — the implementation is
  complete but will not function in a production browser without Phase 6.
- **Rate limits**: FreshDesk Growth plan — 1 000 req/hour per agent. The
  prefetch must be cached and not repeated per device click.
- **Custom field setup**: Requires FreshDesk admin to create the three custom
  fields listed above before the integration works end-to-end.

---

## Alternatives considered

| Alternative                              | Reason not chosen                                             |
|------------------------------------------|---------------------------------------------------------------|
| Tag-based device linking                 | Tags are free-text; custom fields are filterable via API      |
| Embedding FreshDesk iframe               | No badge integration or pre-fetching                          |
| Separate Node-RED proxy (built-in now)   | CORS proxy deferred to Phase 6 to keep this RFC focused       |

---

## Unresolved questions

1. **CORS proxy**: Node-RED function node, dedicated microservice, or ThingsBoard
   rule-chain? Blocks browser-side direct calls.
2. **Custom field API names**: `cf_device_identifier`, `cf_ticket_type`,
   `cf_motivo` must be verified against the actual `myiocom` FreshDesk instance
   (names are auto-generated based on the label set during field creation).
3. **Ticket creation permissions**: All dashboard users, or ThingsBoard-role gated?
4. **Badge click behavior**: Open SettingsModal on Chamados tab, or open FreshDesk
   directly? Currently opens SettingsModal.

---

## Implementation Plan

### Phase 1 — Types + FreshDesk client ✅

- [x] `src/components/premium-modals/settings/tickets/types.ts`
      — `FreshDeskTicket`, `TicketsTabConfig`, `TicketServiceOrchestratorShape`,
        `TicketTypeId`, `TicketMotivo`
- [x] `src/components/premium-modals/settings/tickets/FreshdeskClient.ts`
      — `fetchOpenTickets`, `fetchTicketsForDevice`, `createTicket` (with
        `ticketType`, `motivo`, `attachments`), `reopenTicket`
- [ ] Unit tests: `tests/tickets/FreshdeskClient.test.ts`

### Phase 2 — TicketServiceOrchestrator ✅

- [x] `src/components/premium-modals/settings/tickets/TicketServiceOrchestrator.ts`
- [x] Dispatch `myio:tickets-ready` on build + refresh
- [x] Integrated into `MAIN_VIEW/controller.js`; exposes `freshdeskApiKey` +
      `freshdeskDomain` on `window.MyIOUtils`

### Phase 3 — Ticket badge on device cards + HEADER button ✅

- [x] `TelemetryGridShoppingView.ts` — `_createTicketBadge`, `_injectTicketBadgeStyles`,
      `myio:tickets-ready` listener
- [x] `TELEMETRY/controller.js` — `addTicketBadge`, `refreshTicketBadges`,
      `myio:tickets-ready` listener at module scope
- [x] `telemetry-grid-shopping/types.ts` — `ticketCount?: number`
- [x] `HEADER/template.html` — `tbx-btn-ticket-notif` button (orange, next to alarm bell)
- [x] `HEADER/styles.css` — `.tbx-btn-ticket-notif` + `.tbx-ticket-badge`
- [x] `HEADER/controller.js` — wiring, `_updateTicketNotifBadge()`, `myio:tickets-ready` listener, click → open FreshDesk

### Phase 4 — TicketsTab UI ✅

- [x] `src/components/premium-modals/settings/tickets/TicketsTab.ts`
      — Section 1: ticket list from TSO / prefetch / live fetch
      — Section 2: collapsible form with Subject, Tipo, Motivo, Descrição (optional),
        Anexos (optional), E-mail; multipart upload when attachments present
- [x] `SettingsModalView.ts` — Chamados tab added; tab order:
      `[General | Alarms | Chamados | Annotations]`

### Phase 5 — Showcase + validation

- [ ] `showcase/main-view-shopping/index.html`
      — Mock `window.TicketServiceOrchestrator` panel
      — Cards with matching identifiers show orange badge
- [ ] Manual validation checklist:
      - [ ] Badge appears/disappears on ticket count changes
      - [ ] Badge click opens SettingsModal on Chamados tab
      - [ ] Ticket list renders from prefetch (zero extra API calls)
      - [ ] New ticket form submits with and without attachments
      - [ ] `TicketServiceOrchestrator.refresh()` updates badges

### Phase 6 — CORS proxy (follow-up RFC)

- [ ] Node-RED function node `freshdesk-proxy` in `NODE-RED/` folder
      — Receives `{ path, method, body, files? }` from dashboard
      — Attaches Basic auth server-side and forwards to FreshDesk
      — Returns raw FreshDesk JSON response

---

## Files created / modified

| File                                                                          | Action   |
|-------------------------------------------------------------------------------|----------|
| `src/components/premium-modals/settings/tickets/types.ts`                     | Created  |
| `src/components/premium-modals/settings/tickets/FreshdeskClient.ts`           | Created  |
| `src/components/premium-modals/settings/tickets/TicketServiceOrchestrator.ts` | Created  |
| `src/components/premium-modals/settings/tickets/TicketsTab.ts`                | Created  |
| `src/components/premium-modals/settings/SettingsModalView.ts`                 | Modified |
| `src/components/telemetry-grid-shopping/TelemetryGridShoppingView.ts`         | Modified |
| `src/components/telemetry-grid-shopping/types.ts`                             | Modified |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` | Modified |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js` | Modified |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/template.html`    | Modified |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/styles.css`       | Modified |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/controller.js`    | Modified |
| `src/index.ts`                                                                | Modified |
