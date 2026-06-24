# RFC-0198 — FreshDesk API Client Architecture

- **Derived from**: RFC-0198 (TicketsTab + TicketServiceOrchestrator)
- **Status**: Implemented
- **Date**: 2026-04-02
- **Module**: `src/services/freshdesk/`

---

## Overview

`FreshdeskClient` is a reusable, framework-agnostic HTTP client for the
[FreshDesk v2 REST API](https://developers.freshdesk.com/api/). It is exported
from the library public API (`src/index.ts`) and can be used independently of
the dashboard widgets.

```
src/
└── services/
    └── freshdesk/
        ├── FreshdeskClient.ts   ← HTTP client (fetch-based)
        └── types.ts             ← Generic FreshDesk API types
```

Dashboard-specific types and ThingsBoard write-back logic live in:
```
src/components/premium-modals/settings/tickets/
├── types.ts                     ← TicketsTabConfig, FreshdeskTicketSummary, etc.
├── TbTicketSync.ts              ← SERVER_SCOPE write-back helpers
├── TicketServiceOrchestrator.ts ← window.TicketServiceOrchestrator builder
└── TicketsTab.ts                ← SettingsModal tab UI
```

---

## Authentication

FreshDesk uses **HTTP Basic authentication** with the API key as the username
and the literal string `"X"` as the password.

```typescript
// Client implementation
'Basic ' + btoa(apiKey + ':X')
```

| Field       | Value                                  |
|-------------|----------------------------------------|
| Scheme      | HTTP Basic                             |
| Username    | Your FreshDesk API key                 |
| Password    | `X` (literal, not a real password)     |
| Header      | `Authorization: Basic <base64>`        |

The API key is **never hard-coded** — it is read from ThingsBoard widget
settings (`ctx.settings.freshdeskApiKey`) and exposed via
`window.MyIOUtils.freshdeskApiKey`.

---

## Base URL

```typescript
`https://${domain}/api/v2`
// e.g. https://myiocom.freshdesk.com/api/v2
```

The `domain` parameter (e.g. `"myiocom.freshdesk.com"`) is also stored in
widget settings (`ctx.settings.freshdeskDomain`).

---

## Ticket Status Codes

| Code | Label    | Counted in badge? |
|------|----------|-------------------|
| `2`  | Open     | ✅ yes             |
| `3`  | Pending  | ✅ yes             |
| `4`  | Resolved | ❌ no (pruned)    |
| `5`  | Closed   | ❌ no (pruned)    |
| `6`  | Waiting  | ✅ yes             |

---

## API Endpoints Used

### GET /api/v2/tickets — list all open tickets (bulk prefetch)

Used by `TicketServiceOrchestrator` at dashboard init to prefetch all open
tickets for the customer, indexed by device identifier.

```
GET /api/v2/tickets
  ?status=2,3,6
  &per_page=100
  &page=N
  &include=requester,responder
Authorization: Basic <base64>
```

- **Pagination**: loops pages 1–10 (max 1 000 tickets). Stops when the page
  returns fewer than 100 items.
- **`include=requester,responder`**: populates `ticket.requester.email` and
  `ticket.responder.email` — required for the `created_by_email` /
  `updated_by_email` fields stored in `freshdesk_tickets` SERVER_SCOPE.

```javascript
// Official sample pattern (NodeJs/view_all_tickets.js)
unirest.get(URL)
  .auth({ user: API_KEY, pass: 'X', sendImmediately: true })
  .end(callback)

// FreshdeskClient equivalent (browser fetch)
fetch(`${base}/tickets?status=2,3,6&per_page=100&page=1&include=requester,responder`, {
  headers: { Authorization: 'Basic ' + btoa(apiKey + ':X') }
})
```

### GET /api/v2/tickets — single device (on-demand)

Used by `TicketsTab` when `prefetchedTickets` is not available.

```
GET /api/v2/tickets
  ?cf_device_identifier=MED-LOJA-01
  &status=2,3,6
  &include=requester,responder
```

### POST /api/v2/tickets — create a ticket

Used by the TicketsTab "Novo Chamado" form.

```
POST /api/v2/tickets
Content-Type: application/json        (no attachments)
  OR multipart/form-data              (when attachments[] present)
Authorization: Basic <base64>

{
  "subject":     "...",
  "description": "...",
  "email":       "requester@example.com",
  "source":      2,          // portal
  "status":      2,          // open
  "priority":    2,          // medium
  "custom_fields": {
    "cf_device_identifier": "MED-LOJA-01",
    "cf_ticket_type":       1,             // 1=Software/Dashboard | 2=Instalação
    "cf_motivo":            "Corretivo"    // Corretivo | Evolutivo | Instalação
  }
}
```

Response: `201 Created` + ticket object.
`Location` response header contains the URL of the new ticket.

```javascript
// Official sample pattern (NodeJs/create_ticket.js)
unirest.post(URL)
  .auth({ user: API_KEY, pass: 'X', sendImmediately: true })
  .type('json')
  .send(fields)
  .end(callback)
```

#### Multipart upload (with attachments)

When files are attached, the request must use `multipart/form-data`.
The `Content-Type` header must **not** be set — the browser adds it with
the correct boundary automatically.

```javascript
// Official sample pattern (NodeJs/create_ticket_multiple_attachments.js)
unirest.post(URL)
  .headers({ Authorization: auth })   // no Content-Type here
  .field(fields)
  .attach('attachments[]', fs.createReadStream('/path/to/file.ext'))
  .end(callback)

// FreshdeskClient equivalent (browser fetch + FormData)
const fd = new FormData()
fd.append('subject', subject)
fd.append('attachments[]', file, file.name)
// Do NOT set Content-Type — browser sets it automatically
fetch(url, { method: 'POST', headers: { Authorization: ... }, body: fd })
```

### PUT /api/v2/tickets/{id} — update a ticket

Used by `reopenTicket` (sets `status: 2`) and `updateTicket` (generic fields).

```
PUT /api/v2/tickets/47382
Content-Type: application/json
Authorization: Basic <base64>

{ "status": 2 }
```

```javascript
// Official sample pattern (NodeJs/update_ticket.js)
unirest.put(URL + '/ticket_id')
  .auth({ user: API_KEY, pass: 'X', sendImmediately: true })
  .type('json')
  .send({ status: 2 })
  .end(callback)
```

### DELETE /api/v2/tickets/{id} — delete a ticket

```
DELETE /api/v2/tickets/47382
Authorization: Basic <base64>
```

Response: `204 No Content` on success.

```javascript
// Official sample pattern (NodeJs/delete_ticket.js)
unirest.delete(URL + '/ticket_id')
  .auth({ user: API_KEY, pass: 'X', sendImmediately: true })
  .end(callback)
```

---

## Public API Reference

### Types (`src/services/freshdesk/types.ts`)

```typescript
type TicketTypeId = 1 | 2;
// 1 = Software / Dashboard
// 2 = Instalação

type TicketMotivo = 'Corretivo' | 'Evolutivo' | 'Instalação';

interface FreshDeskTicket {
  id: number;
  subject: string;
  description_text?: string;
  status: 2 | 3 | 4 | 5 | 6;          // open | pending | resolved | closed | waiting
  priority: 1 | 2 | 3 | 4;            // low | medium | high | urgent
  requester_id: number;
  requester?: { name: string; email: string };    // with include=requester
  responder?: { id: number; name: string; email: string }; // with include=responder
  stats?: { agent_responded_at?: string; requester_responded_at?: string }; // with include=stats
  created_at: string;                  // ISO-8601 UTC
  updated_at: string;                  // ISO-8601 UTC
  custom_fields: {
    cf_device_identifier?: string;
    cf_ticket_type?: TicketTypeId;
    cf_motivo?: TicketMotivo;
    [key: string]: unknown;
  };
  tags: string[];
}
```

### Functions (`src/services/freshdesk/FreshdeskClient.ts`)

| Function | Signature | Returns |
|----------|-----------|---------|
| `fetchOpenTickets` | `(domain, apiKey)` | `Promise<FreshDeskTicket[]>` |
| `fetchTicketsForDevice` | `(domain, apiKey, identifier)` | `Promise<FreshDeskTicket[]>` |
| `createTicket` | `(domain, apiKey, subject, identifier, email, options?)` | `Promise<FreshDeskTicket \| null>` |
| `updateTicket` | `(domain, apiKey, ticketId, fields)` | `Promise<FreshDeskTicket \| null>` |
| `reopenTicket` | `(domain, apiKey, ticketId)` | `Promise<boolean>` |
| `deleteTicket` | `(domain, apiKey, ticketId)` | `Promise<boolean>` |

All functions are **non-throwing** — errors are caught and logged via
`console.warn('[FreshdeskClient] …')`, returning empty arrays / null / false.

---

## Library Export

```typescript
// Named function imports
import {
  fetchOpenTickets,
  fetchTicketsForDevice,
  createFreshdeskTicket,
  updateFreshdeskTicket,
  reopenFreshdeskTicket,
  deleteFreshdeskTicket,
} from '@myio/myio-js-library';

// Namespace import
import { FreshdeskClient } from '@myio/myio-js-library';
FreshdeskClient.createTicket(domain, apiKey, subject, identifier, email);

// Types
import type { FreshDeskTicket, TicketTypeId, TicketMotivo } from '@myio/myio-js-library';
```

---

## Custom Fields Required in FreshDesk

A FreshDesk admin must create these custom fields on the ticket form before
the integration works end-to-end:

| API name               | Type     | Label (suggested)    | Used for                           |
|------------------------|----------|----------------------|------------------------------------|
| `cf_device_identifier` | Text     | Identificador MyIO   | Links ticket to a TB device        |
| `cf_ticket_type`       | Dropdown | Tipo de Chamado      | 1=Software/Dashboard, 2=Instalação |
| `cf_motivo`            | Dropdown | Motivo               | Corretivo / Evolutivo / Instalação |

> **Important**: FreshDesk auto-generates API names from the label you set.
> The API names above (`cf_device_identifier`, etc.) must match exactly — verify
> them in the FreshDesk admin portal under *Admin → Ticket Fields*.

---

## CORS Constraint

FreshDesk does not send CORS headers for browser requests to
`*.freshdesk.com/api/v2`. All client calls from browser-based widgets
**must be proxied server-side**.

### Phase 6 (planned): Node-RED proxy

```
Browser widget
  → POST /freshdesk-proxy (same origin / TB backend)
    → Node-RED function node
      → FreshDesk API (server-side, no CORS restriction)
```

The `FreshdeskClient` itself is already written to work through a proxy —
just change the `domain` parameter to point to the proxy host instead of
`myiocom.freshdesk.com`.

---

## ThingsBoard Write-back (`TbTicketSync.ts`)

After each FreshDesk sync, a compact summary is written to each device's
`freshdesk_tickets` SERVER_SCOPE attribute. This allows the ticket badge to be
rendered from ThingsBoard `ctx.data` without any FreshDesk API call.

| Attribute            | Format                          | Written by                         |
|----------------------|---------------------------------|------------------------------------|
| `freshdesk_tickets`  | `{ "items": [FreshdeskTicketSummary, …] }` | `TicketServiceOrchestrator` (build + refresh), `TicketsTab` (after create) |
| `lastFreshdeskSyncedAt` | ISO-8601 UTC string         | `TicketServiceOrchestrator` (build + refresh) |

```json
// freshdesk_tickets value (FreshdeskTicketSummary[])
{
  "items": [
    {
      "id": 47382,
      "status": 2,
      "status_label": "Aberto",
      "created_at": "2026-04-02T17:45:00Z",
      "updated_at": "2026-04-02T18:10:00Z",
      "created_by_email": "operador@cliente.com.br",
      "updated_by_email": "suporte@myio.com.br"
    }
  ]
}
```

> **Why `{ items: [] }` and not a bare `[]`?**  
> ThingsBoard rejects a bare JSON array as a SERVER_SCOPE attribute value.
> The object wrapper is the standard workaround.
