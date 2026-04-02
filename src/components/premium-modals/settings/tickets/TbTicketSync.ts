/**
 * RFC-0198: TbTicketSync — write/read `freshdesk_tickets` SERVER_SCOPE attribute on TB devices.
 *
 * Attribute value is a JSON-stringified FreshdeskTicketSummary[].
 * Only statuses 2 (open), 3 (pending), 6 (waiting) are kept — resolved/closed are pruned.
 */
import type { FreshDeskTicket, FreshdeskTicketSummary } from './types';

const ATTR_KEY = 'freshdesk_tickets';
const ACTIVE_STATUSES = new Set([2, 3, 6]);

/** Convert a full FreshDeskTicket to the compact summary stored in TB */
export function toSummary(ticket: FreshDeskTicket): FreshdeskTicketSummary {
  return {
    id: ticket.id,
    status: ticket.status,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  };
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

    const url = `${tbBaseUrl}/api/plugins/telemetry/${tbDeviceId}/SERVER_SCOPE`;
    await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ [ATTR_KEY]: JSON.stringify(summaries) }),
    });
  } catch (err) {
    console.warn('[TbTicketSync] writeFreshdeskTicketsToTB error:', err);
  }
}

/**
 * Clear the freshdesk_tickets attribute for a device (write empty array).
 */
export async function clearFreshdeskTicketsOnTB(
  tbBaseUrl: string,
  tbDeviceId: string,
  jwtToken: string
): Promise<void> {
  await writeFreshdeskTicketsToTB(tbBaseUrl, tbDeviceId, jwtToken, []);
}

/**
 * Read the current freshdesk_tickets attribute from ThingsBoard SERVER_SCOPE.
 * Returns [] on error or missing attribute.
 */
export async function readFreshdeskTicketsFromTB(
  tbBaseUrl: string,
  tbDeviceId: string,
  jwtToken: string
): Promise<FreshdeskTicketSummary[]> {
  try {
    const url = `${tbBaseUrl}/api/plugins/telemetry/${tbDeviceId}/values/attributes/SERVER_SCOPE?keys=${ATTR_KEY}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
    if (!res.ok) return [];
    const data: { key: string; value: string }[] = await res.json();
    const entry = data.find(d => d.key === ATTR_KEY);
    if (!entry?.value) return [];
    return JSON.parse(entry.value) as FreshdeskTicketSummary[];
  } catch (err) {
    console.warn('[TbTicketSync] readFreshdeskTicketsFromTB error:', err);
    return [];
  }
}

/**
 * Append one new ticket to the existing freshdesk_tickets attribute.
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
    const url = `${tbBaseUrl}/api/plugins/telemetry/${tbDeviceId}/SERVER_SCOPE`;
    await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ [ATTR_KEY]: JSON.stringify(merged) }),
    });
  } catch (err) {
    console.warn('[TbTicketSync] appendFreshdeskTicketToTB error:', err);
  }
}
