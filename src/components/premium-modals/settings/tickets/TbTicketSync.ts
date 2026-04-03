/**
 * RFC-0198: TbTicketSync — write/read `tickets_items` and `lastFreshdeskSyncedAt`
 * SERVER_SCOPE attributes on TB devices.
 *
 * ThingsBoard does not accept a bare JSON array [] as an attribute value — it must be
 * wrapped in an object. Stored format:
 *   { "items": [ { "id": 47382, "status": 2, "status_label": "Aberto",
 *                  "created_at": "...", "updated_at": "...",
 *                  "created_by_email": "user@example.com" } ] }
 *
 * Only statuses 2 (open), 3 (pending), 6 (waiting) are kept — resolved/closed are pruned.
 *
 * `lastFreshdeskSyncedAt` is a separate attribute (ISO-8601 UTC string) written after each
 * full sync by TicketServiceOrchestrator.
 */
import type { FreshDeskTicket, FreshdeskTicketSummary } from './types';

const ATTR_KEY = 'tickets_items';
const ATTR_SYNCED_AT = 'lastFreshdeskSyncedAt';
const ACTIVE_STATUSES = new Set([2, 3, 6]);

const STATUS_LABELS: Record<number, string> = {
  2: 'Aberto',
  3: 'Pendente',
  4: 'Resolvido',
  5: 'Fechado',
  6: 'Aguardando',
};

/** Convert a full FreshDeskTicket to the compact summary stored in TB */
export function toSummary(ticket: FreshDeskTicket): FreshdeskTicketSummary {
  const summary: FreshdeskTicketSummary = {
    id: ticket.id,
    status: ticket.status,
    status_label: STATUS_LABELS[ticket.status] ?? String(ticket.status),
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  };
  // created_by_email — the requester who opened the ticket (requires include=requester on FreshDesk API)
  if (ticket.requester?.email) summary.created_by_email = ticket.requester.email;
  // updated_by_email — the last responder (agent); requires include=responder on FreshDesk API
  if (ticket.responder?.email) summary.updated_by_email = ticket.responder.email;
  return summary;
}

/**
 * Write the compact ticket summaries for one device to ThingsBoard SERVER_SCOPE.
 * Only active statuses (2,3,6) are persisted; resolved/closed are pruned automatically.
 * Silently ignores errors (badge resilience).
 */
export async function writeFreshdeskTicketsToTB(
  tbBaseUrl: string,
  tbDeviceId: string,
  jwtToken: string,
  tickets: FreshDeskTicket[]
): Promise<void> {
  try {
    const summaries = tickets
      .filter(t => ACTIVE_STATUSES.has(t.status))
      .map(toSummary);

    const url = `${tbBaseUrl}/api/plugins/telemetry/DEVICE/${tbDeviceId}/attributes/SERVER_SCOPE`;
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      // Wrap in { items } — TB rejects bare [] as attribute value
      body: JSON.stringify({ [ATTR_KEY]: { items: summaries } }),
    });
  } catch (err) {
    console.warn('[TbTicketSync] writeFreshdeskTicketsToTB error:', err);
  }
}

/**
 * Clear the tickets_items attribute for a device (write empty array).
 */
export async function clearFreshdeskTicketsOnTB(
  tbBaseUrl: string,
  tbDeviceId: string,
  jwtToken: string
): Promise<void> {
  await writeFreshdeskTicketsToTB(tbBaseUrl, tbDeviceId, jwtToken, []);
}

/**
 * Read the current tickets_items attribute from ThingsBoard SERVER_SCOPE.
 * Returns [] on error or missing attribute.
 */
export async function readFreshdeskTicketsFromTB(
  tbBaseUrl: string,
  tbDeviceId: string,
  jwtToken: string
): Promise<FreshdeskTicketSummary[]> {
  try {
    const url = `${tbBaseUrl}/api/plugins/telemetry/DEVICE/${tbDeviceId}/values/attributes/SERVER_SCOPE?keys=${ATTR_KEY}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
    if (!res.ok) return [];
    const data: { key: string; value: unknown }[] = await res.json();
    const entry = data.find(d => d.key === ATTR_KEY);
    if (!entry?.value) return [];
    // TB returns value as object; handle legacy string-encoded case too
    const val = typeof entry.value === 'string' ? JSON.parse(entry.value) : entry.value;
    return (Array.isArray(val) ? val : (val as { items?: FreshdeskTicketSummary[] })?.items ?? []) as FreshdeskTicketSummary[];
  } catch (err) {
    console.warn('[TbTicketSync] readFreshdeskTicketsFromTB error:', err);
    return [];
  }
}

/**
 * Append one new ticket to the existing tickets_items attribute.
 * Reads current value, appends, deduplicates by id, writes back.
 */
export async function appendFreshdeskTicketToTB(
  tbBaseUrl: string,
  tbDeviceId: string,
  jwtToken: string,
  newTicket: FreshDeskTicket
): Promise<void> {
  try {
    const existing = await readFreshdeskTicketsFromTB(tbBaseUrl, tbDeviceId, jwtToken);
    const newSummary = toSummary(newTicket);
    // deduplicate by id; replace if exists
    const merged = [...existing.filter(t => t.id !== newSummary.id), newSummary]
      .filter(t => ACTIVE_STATUSES.has(t.status));
    const url = `${tbBaseUrl}/api/plugins/telemetry/DEVICE/${tbDeviceId}/attributes/SERVER_SCOPE`;
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ [ATTR_KEY]: { items: merged } }),
    });
  } catch (err) {
    console.warn('[TbTicketSync] appendFreshdeskTicketToTB error:', err);
  }
}

/**
 * Write `lastFreshdeskSyncedAt` (ISO-8601 UTC) to ThingsBoard SERVER_SCOPE.
 * Call this once after a full TicketServiceOrchestrator build/refresh for each device.
 * Silently ignores errors.
 */
export async function writeFreshdeskSyncedAtToTB(
  tbBaseUrl: string,
  tbDeviceId: string,
  jwtToken: string,
  syncedAt: string = new Date().toISOString()
): Promise<void> {
  try {
    const url = `${tbBaseUrl}/api/plugins/telemetry/DEVICE/${tbDeviceId}/attributes/SERVER_SCOPE`;
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ [ATTR_SYNCED_AT]: syncedAt }),
    });
  } catch (err) {
    console.warn('[TbTicketSync] writeFreshdeskSyncedAtToTB error:', err);
  }
}
