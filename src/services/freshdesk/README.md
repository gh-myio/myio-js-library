# FreshDesk API v2 — Tickets Reference

> Source: FreshDesk official API documentation  
> Base URL: `https://{domain}.freshdesk.com/api/v2`  
> Auth: HTTP Basic — `apiKey:X` (base-64 encoded)

---

## Implementation Status

### `FreshdeskClient.ts` — HTTP client (`src/services/freshdesk/`)

**Tickets — Read**
- ✅ `fetchOpenTickets(domain, apiKey)` — `GET /api/v2/tickets?status=2,3,6` paginated (up to 1 000), includes `requester` + `responder` emails
- ✅ `fetchTicketsForDevice(domain, apiKey, identifier)` — `GET /api/v2/tickets?cf_device_identifier=…` for a single device
- ❌ NOT IMPLEMENTED — `getTicket(id)` — `GET /api/v2/tickets/{id}` (single ticket with optional embeds)
- ❌ NOT IMPLEMENTED — `searchTickets(query)` — `GET /api/v2/search/tickets?query=…` (custom field filter search)
- ❌ NOT IMPLEMENTED — `listConversations(ticketId)` — `GET /api/v2/tickets/{id}/conversations`

**Tickets — Write**
- ✅ `createTicket(domain, apiKey, subject, identifier, email, options?)` — `POST /api/v2/tickets`, JSON or multipart (when `options.attachments` present), sets `cf_device_identifier`, `cf_ticket_type`, `cf_motivo`
- ✅ `updateTicket(domain, apiKey, ticketId, fields)` — `PUT /api/v2/tickets/{id}` (generic field update)
- ✅ `reopenTicket(domain, apiKey, ticketId)` — `PUT /api/v2/tickets/{id}` with `{ status: 2 }` (delegates to `updateTicket`)
- ✅ `deleteTicket(domain, apiKey, ticketId)` — `DELETE /api/v2/tickets/{id}` (expects `204 No Content`)
- ❌ NOT IMPLEMENTED — `bulkUpdateTickets(ids, properties)` — `POST /api/v2/tickets/bulk_update` (async job)
- ❌ NOT IMPLEMENTED — `bulkDeleteTickets(ids)` — `POST /api/v2/tickets/bulk_delete` (async job)
- ❌ NOT IMPLEMENTED — `deleteAttachment(attachmentId)` — `DELETE /api/v2/attachments/{id}`

### `TbTicketSync.ts` — ThingsBoard SERVER_SCOPE write-back (`src/components/premium-modals/settings/tickets/`)

- ✅ `writeFreshdeskTicketsToTB(tbBaseUrl, tbDeviceId, jwtToken, tickets)` — overwrites `freshdesk_tickets` attribute; prunes resolved/closed; wraps in `{ items: [] }` (TB rejects bare arrays)
- ✅ `readFreshdeskTicketsFromTB(tbBaseUrl, tbDeviceId, jwtToken)` — reads `freshdesk_tickets`; handles legacy bare-array format
- ✅ `appendFreshdeskTicketToTB(tbBaseUrl, tbDeviceId, jwtToken, newTicket)` — read → deduplicate by `id` → write back
- ✅ `clearFreshdeskTicketsOnTB(tbBaseUrl, tbDeviceId, jwtToken)` — writes empty `{ items: [] }`
- ✅ `writeFreshdeskSyncedAtToTB(tbBaseUrl, tbDeviceId, jwtToken, syncedAt?)` — writes `lastFreshdeskSyncedAt` (ISO-8601 UTC) as a separate SERVER_SCOPE attribute
- ✅ `toSummary(ticket)` — converts `FreshDeskTicket` → `FreshdeskTicketSummary` (id, status, status_label, created_at, updated_at, created_by_email, updated_by_email)

### `TicketServiceOrchestrator.ts` — global orchestrator (`src/components/premium-modals/settings/tickets/`)

- ✅ `buildTicketServiceOrchestrator(domain, apiKey, freshdeskClient, tbSyncOptions?)` — fetches all open tickets, builds `Map<identifier, FreshDeskTicket[]>`, exposes as `window.TicketServiceOrchestrator`
- ✅ `orchestrator.getTicketCountForDevice(identifier)` — badge count lookup
- ✅ `orchestrator.getTicketsForDevice(identifier)` — full ticket list for a device
- ✅ `orchestrator.refresh()` — re-fetches, rebuilds map, dispatches `myio:tickets-ready`
- ✅ `orchestrator.tbDeviceIdMap` — `Map<deviceIdentifier, tbDeviceId>` for SERVER_SCOPE writes
- ✅ Write-back to TB SERVER_SCOPE on build + refresh (fire-and-forget per device)
- ✅ Dispatches `myio:tickets-ready` event with `{ ticketMap }`

### `TicketsTab.ts` — SettingsModal tab UI (`src/components/premium-modals/settings/tickets/`)

- ✅ Section 1 — open ticket list (reads from `TicketServiceOrchestrator`, falls back to `fetchTicketsForDevice`)
- ✅ Section 2 — "Novo Chamado" collapsible form: Subject, Tipo (1/2), Motivo, Descrição (optional), Anexos (optional), E-mail
- ✅ Calls `appendFreshdeskTicketToTB` after successful ticket creation (fire-and-forget)
- ❌ NOT IMPLEMENTED — reopen button on resolved/closed tickets listed in Section 1
- ❌ NOT IMPLEMENTED — delete ticket action

### HEADER widget (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/`)

- ✅ Ticket bell button (`tbx-btn-ticket-notif`) — hidden until `freshdeskApiKey` is set
- ✅ Badge counter (`tbx-ticket-badge`) — total open/pending/waiting across all devices
- ✅ Listens to `myio:tickets-ready` to update badge count
- ✅ On click — opens `https://{freshdeskDomain}/helpdesk/tickets` in new tab
- ❌ NOT IMPLEMENTED — CORS proxy (Phase 6) — direct browser calls are blocked by FreshDesk

### TELEMETRY widget (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/`)

- ✅ Ticket badge (🎫 + count) on device cards — bottom-left, orange
- ✅ Reads `freshdesk_tickets` from `ctx.data` (SERVER_SCOPE dataKey) as fallback when orchestrator not ready
- ✅ Listens to `myio:tickets-ready` to inject/update badges
- ✅ Badge click — opens SettingsModal on Chamados tab

### Types

- ✅ `FreshDeskTicket` — full FreshDesk v2 ticket object (with optional `requester`, `responder`, `stats`)
- ✅ `TicketTypeId` — `1 | 2` (Software/Dashboard | Instalação)
- ✅ `TicketMotivo` — `'Corretivo' | 'Evolutivo' | 'Instalação'`
- ✅ `FreshdeskTicketSummary` — compact TB-stored record (id, status, status_label, dates, emails)
- ✅ `TicketsTabConfig` — SettingsModal tab configuration
- ✅ `TicketServiceOrchestratorShape` — orchestrator contract

### Library public exports (`src/index.ts`)

- ✅ `FreshdeskClient` namespace — `import { FreshdeskClient } from '@myio/myio-js-library'`
- ✅ Named function exports — `fetchOpenTickets`, `createFreshdeskTicket`, `updateFreshdeskTicket`, `reopenFreshdeskTicket`, `deleteFreshdeskTicket`
- ✅ Types — `FreshDeskTicket`, `TicketTypeId`, `TicketMotivo`, `FreshdeskTicketSummary`, `TicketsTabConfig`, `TicketServiceOrchestratorShape`
- ✅ TB sync helpers — `writeFreshdeskTicketsToTB`, `readFreshdeskTicketsFromTB`, `appendFreshdeskTicketToTB`, `clearFreshdeskTicketsOnTB`, `writeFreshdeskSyncedAtToTB`, `toFreshdeskTicketSummary`
- ✅ `buildTicketServiceOrchestrator`, `createTicketsTab`

---

## Authentication

```bash
# All requests use HTTP Basic auth
# Username = API key, Password = literal "X"
curl -u yourapikey:X https://domain.freshdesk.com/api/v2/tickets
```

---

## Ticket Properties

### Status

| Value | Label    |
|-------|----------|
| `2`   | Open     |
| `3`   | Pending  |
| `4`   | Resolved |
| `5`   | Closed   |

### Priority

| Value | Label  |
|-------|--------|
| `1`   | Low    |
| `2`   | Medium |
| `3`   | High   |
| `4`   | Urgent |

### Source

| Value | Label            |
|-------|------------------|
| `1`   | Email            |
| `2`   | Portal           |
| `3`   | Phone            |
| `7`   | Chat             |
| `9`   | Feedback Widget  |
| `10`  | Outbound Email   |

---

## POST /api/v2/tickets — Create a Ticket

### Parameters

| Attribute          | Type             | Required | Description |
|--------------------|------------------|----------|-------------|
| `name`             | string           | —        | Name of the requester |
| `requester_id`†    | number           | —        | User ID of an existing contact |
| `email`†           | string           | —        | Email of the requester. Creates contact if not found |
| `phone`†           | string           | —        | Phone number. `name` is mandatory if email is not set |
| `twitter_id`†      | string           | —        | Twitter handle |
| `facebook_id`†     | string           | —        | Facebook ID |
| `unique_external_id`† | string        | —        | External ID |
| `subject`          | string           | —        | Subject of the ticket (default: `null`) |
| `type`             | string           | —        | Ticket category type (default: `null`) |
| `status`           | number           | —        | See Status table (default: `2`) |
| `priority`         | number           | —        | See Priority table (default: `1`) |
| `description`      | string           | —        | HTML content of the ticket |
| `responder_id`     | number           | —        | Agent assigned to the ticket |
| `attachments`      | array of objects | —        | Max total size: 20 MB |
| `cc_emails`        | array of strings | —        | CC email addresses |
| `custom_fields`    | dictionary       | —        | Custom field key-value pairs |
| `due_by`           | datetime         | —        | Resolution due date |
| `fr_due_by`        | datetime         | —        | First response due date |
| `email_config_id`  | number           | —        | Support email config ID |
| `group_id`         | number           | —        | Group assigned to the ticket |
| `parent_id`        | number           | —        | Links ticket as child to a parent |
| `product_id`       | number           | —        | Associated product ID |
| `source`           | number           | —        | See Source table (default: `2`) |
| `tags`             | array of strings | —        | Tags |
| `company_id`       | number           | —        | Requester company ID (Estate plan+) |

† At least one of these requester identifiers is **mandatory**.

### Example — Basic ticket

```bash
curl -v -u yourapikey:X \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Details about the issue...",
    "subject": "Support Needed...",
    "email": "tom@outerspace.com",
    "priority": 1,
    "status": 2,
    "cc_emails": ["ram@freshdesk.com", "diana@freshdesk.com"]
  }' \
  -X POST 'https://domain.freshdesk.com/api/v2/tickets'
```

```json
{
  "id": 1,
  "subject": "Support needed..",
  "status": 2,
  "priority": 1,
  "source": 2,
  "requester_id": 129,
  "responder_id": null,
  "cc_emails": ["ram@freshdesk.com", "diana@freshdesk.com"],
  "created_at": "2015-07-09T13:08:06Z",
  "updated_at": "2015-07-23T04:41:12Z",
  "due_by": "2015-07-14T13:08:06Z",
  "description_text": "Some details on the issue ...",
  "tags": [],
  "attachments": []
}
```

### Example — With custom fields

```bash
curl -v -u yourapikey:X \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Support Needed...",
    "email": "tom@outerspace.com",
    "priority": 1,
    "status": 2,
    "custom_fields": { "category": "Primary" }
  }' \
  -X POST 'https://domain.freshdesk.com/api/v2/tickets'
```

### Example — With attachments (multipart)

> **Note**: Content-Type must be `multipart/form-data`. Do **not** set it manually — the HTTP client adds the correct boundary automatically.

```bash
curl -v -u yourapikey:X \
  -F "attachments[]=@/path/to/attachment1.ext" \
  -F "attachments[]=@/path/to/attachment2.ext" \
  -F "email=example@example.com" \
  -F "subject=Ticket Title" \
  -F "description=this is a sample ticket" \
  -X POST 'https://domain.freshdesk.com/api/v2/tickets'
```

Response includes `attachments[]` array with metadata for each uploaded file.

---

## GET /api/v2/tickets/{id} — View a Ticket

```bash
curl -v -u yourapikey:X \
  -H "Content-Type: application/json" \
  -X GET 'https://domain.freshdesk.com/api/v2/tickets/20'
```

### `include` embeds (each adds 1 API credit)

| Handle          | URL param                              | Returns |
|-----------------|----------------------------------------|---------|
| `conversations` | `?include=conversations`               | Up to 10 conversations (sorted by `created_at` asc). More than 10 → use List Conversations API. Costs 2 credits. |
| `requester`     | `?include=requester`                   | Requester's `email`, `id`, `mobile`, `name`, `phone` |
| `company`       | `?include=company`                     | Company's `id` and `name` |
| `stats`         | `?include=stats`                       | `closed_at`, `resolved_at`, `first_responded_at` |

**Examples:**

```bash
# Conversations
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/tickets/20?include=conversations'

# Company + requester
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/tickets/20?include=company,requester'

# Stats
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/tickets/20?include=stats'
```

---

## GET /api/v2/tickets — List All Tickets

> **Notes:**
> - Only tickets created within the **past 30 days** are returned by default. Use `updated_since` for older tickets.
> - Maximum 300 pages (30 000 tickets).
> - For accounts after 2018-11-30, use `include=description` to get description fields.

### Filter parameters

| Filter               | URL param |
|----------------------|-----------|
| Predefined filters   | `?filter=new_and_my_open` / `watching` / `spam` / `deleted` |
| By requester ID      | `?requester_id={id}` |
| By requester email   | `?email={email}` (URL encode special chars) |
| By company           | `?company_id={id}` |
| Updated since        | `?updated_since=2015-01-19T02:00:00Z` |

### Sort parameters

| Sort field                               | URL param |
|------------------------------------------|-----------|
| `created_at`, `due_by`, `updated_at`, `status` | `?order_by=created_at` (default: `created_at`) |
| Sort direction                           | `?order_type=asc` or `desc` (default: `desc`) |

### `include` embeds

| Handle        | Returns |
|---------------|---------|
| `stats`       | `closed_at`, `resolved_at`, `first_responded_at` |
| `requester`   | Requester email, id, mobile, name, phone |
| `description` | Ticket description and description_text |

### Examples

```bash
# All tickets (default)
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/tickets'

# With descriptions
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/tickets?include=description'

# Watched by current agent
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/tickets?filter=watching'

# By requester, sorted by priority descending
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/tickets?requester_id=1230&order_by=status&order_type=desc'

# Page 2 (tickets 11–20)
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/tickets?per_page=10&page=2'

# Activity since a date
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/tickets?updated_since=2015-08-17'

# With stats
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/tickets?include=stats'
```

---

## GET /api/v2/search/tickets — Filter Tickets

Custom ticket field search. Query format:

```
"(ticket_field:integer OR ticket_field:'string') AND ticket_field:boolean"
```

> **Notes:**
> - Query must be **URL encoded** and wrapped in double quotes.
> - Max query length: 512 characters.
> - Returns 30 results per page; max 10 pages.
> - Archived tickets excluded.
> - Index updates may take a few minutes.

### Supported fields

| Field        | Type     |
|--------------|----------|
| `agent_id`   | integer  |
| `group_id`   | integer  |
| `priority`   | integer  |
| `status`     | integer  |
| `tag`        | string   |
| `type`       | string   |
| `due_by`     | date (YYYY-MM-DD) |
| `fr_due_by`  | date     |
| `created_at` | date     |
| `updated_at` | date     |
| `closed_at`  | date     |
| Custom text  | `custom_string` |
| Custom number | integer |
| Custom checkbox | boolean |
| Custom dropdown | string |

### Examples

```bash
# High priority tickets
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/search/tickets?query="priority:3"'

# Urgent or high priority
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/search/tickets?query="priority:4%20OR%20priority:3"'

# Open + Pending, page 2
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/search/tickets?query="status:2%20OR%20status:3"&page=2'

# High priority in a specific group and open
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/search/tickets?query="priority:>3%20AND%20group_id:11%20AND%20status:2"'

# Custom dropdown fields (Finance or Marketing sector, locked)
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/search/tickets?query="(cf_sector:%27finance%27%20OR%20cf_sector:%27marketing%27)%20AND%20cf_locked:true"'

# Custom text field keyword
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/search/tickets?query="custom_string:theactualkeyword"'

# Tickets created on a specific day
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/search/tickets?query="priority:>3%20AND%20created_at:%272017-01-01%27"'

# All unresolved tickets
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/search/tickets?query="status:2%20OR%20status:3%20OR%20status:6%20OR%20status:7"'

# Unassigned tickets
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/search/tickets?query="agent_id:null"'

# Tickets without tags
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/search/tickets?query="tag:null"'
```

Response envelope:

```json
{
  "total": 49,
  "results": [ /* ticket objects */ ]
}
```

---

## PUT /api/v2/tickets/{id} — Update a Ticket

> **Note**: Subject and description of **outbound tickets** cannot be updated.

### Parameters

Same as Create, plus:

| Attribute            | Type    | Description |
|----------------------|---------|-------------|
| `status`             | number  | New status (default: `2`) |
| `priority`           | number  | New priority (default: `1`) |
| `responder_id`       | number  | Reassign to agent |
| `group_id`           | number  | Reassign to group |
| `custom_fields`      | dictionary | Update custom field values |
| `tags`               | array   | Replace tags |
| `due_by`             | datetime | Update resolution deadline |
| `fr_due_by`          | datetime | Update first response deadline |

### Example

```bash
curl -v -u yourapikey:X \
  -H "Content-Type: application/json" \
  -d '{ "priority": 2, "status": 3 }' \
  -X PUT 'https://domain.freshdesk.com/api/v2/tickets/1'
```

```json
{
  "id": 20,
  "status": 3,
  "priority": 2,
  "updated_at": "2015-08-24T11:59:05Z"
}
```

### Example — Reopen (set status back to Open)

```bash
curl -v -u yourapikey:X \
  -H "Content-Type: application/json" \
  -d '{ "status": 2 }' \
  -X PUT 'https://domain.freshdesk.com/api/v2/tickets/47382'
```

---

## POST /api/v2/tickets/bulk_update — Update Multiple Tickets

```bash
curl -v -u yourapikey:X \
  -H "Content-Type: application/json" \
  -d '{
    "bulk_action": {
      "ids": [20, 21, 22],
      "properties": {
        "from_email": "support@freshdesk.com",
        "status": 2,
        "group_id": 1234,
        "type": "Question",
        "priority": 4
      },
      "reply": { "body": "Please check this ticket" }
    }
  }' \
  -X POST 'https://domain.freshdesk.com/api/v2/tickets/bulk_update'
```

Response — async job:

```json
{
  "job_id": "e4d18654f60b5204513155b26c6cb",
  "href": "https://domain.freshdesk.com/api/v2/jobs/e4d18654f60b5204513155b26c6cb"
}
```

Check job status:

```json
{ "id": "e4d18654f60b5204513155b26c6cb", "status": "IN PROGRESS" }
```

---

## DELETE /api/v2/tickets/{id} — Delete a Ticket

```bash
curl -v -u yourapikey:X \
  -X DELETE 'https://domain.freshdesk.com/api/v2/tickets/20'
# Response: 204 No Content
```

## POST /api/v2/tickets/bulk_delete — Delete Multiple Tickets

```bash
curl -v -u yourapikey:X \
  -H "Content-Type: application/json" \
  -d '{ "bulk_action": { "ids": [20, 21, 22] } }' \
  -X POST 'https://domain.freshdesk.com/api/v2/tickets/bulk_delete'
```

Response — async job (same format as bulk_update).

---

## DELETE /api/v2/attachments/{id} — Delete an Attachment

```bash
curl -v -u yourapikey:X \
  -X DELETE 'https://domain.freshdesk.com/api/v2/attachments/1'
# Response: 204 No Content
```

---

## GET /api/v2/tickets/{id}/conversations — List Conversations

```bash
curl -v -u yourapikey:X \
  -H "Content-Type: application/json" \
  -X GET 'https://domain.freshdesk.com/api/v2/tickets/20/conversations'
```

```json
[
  {
    "id": 3,
    "ticket_id": 20,
    "body_text": "Please reply as soon as possible.",
    "incoming": false,
    "private": true,
    "user_id": 1,
    "source": 2,
    "from_email": "agent2@yourcompany.com",
    "to_emails": ["agent1@yourcompany.com"],
    "cc_emails": ["example@ccemail.com"],
    "attachments": [],
    "created_at": "2015-08-24T11:59:05Z",
    "updated_at": "2015-08-24T11:59:05Z",
    "last_edited_at": "2015-08-24T11:59:59Z",
    "last_edited_user_id": 2
  }
]
```

Paginated — default 30 per page:

```bash
# Page 2 of conversations (entries 31–60)
curl -u yourapikey:X 'https://domain.freshdesk.com/api/v2/tickets/1/conversations?page=2'
```
