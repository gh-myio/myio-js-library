/**
 * FreshdeskClient — reusable fetch-based wrapper for the FreshDesk v2 REST API.
 *
 * Exported from `src/index.ts` so any widget or component can import it without
 * depending on the premium-modals folder structure.
 *
 * ─── CORS NOTE ─────────────────────────────────────────────────────────────────
 * Direct browser-to-FreshDesk calls are blocked by CORS in production.
 * A server-side proxy (e.g. Node-RED function node) is required for real-world
 * use — see RFC-0198, Phase 6.
 * This client works as-is in:
 *   • Node.js / backend contexts
 *   • Browsers where CORS is relaxed (same-origin proxy)
 *   • ThingsBoard custom widgets served via a reverse proxy that adds CORS headers
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * All public functions never throw — they return empty arrays / null / false and
 * emit a console.warn so badge failures never crash the dashboard.
 */

import type { FreshDeskTicket, TicketTypeId, TicketMotivo } from './types';

// ============================================================================
// Internals
// ============================================================================

function _authHeader(apiKey: string): string {
  // FreshDesk HTTP Basic auth: apiKey + ':X' (password is the literal 'X')
  return 'Basic ' + btoa(apiKey + ':X');
}

function _baseUrl(domain: string): string {
  // domain example: "myiocom.freshdesk.com"
  return `https://${domain}/api/v2`;
}

// ============================================================================
// Read — list / search
// ============================================================================

/**
 * Fetch all open/pending/waiting tickets for a FreshDesk account (paginated).
 *
 * Status codes fetched: 2 (open), 3 (pending), 6 (waiting_on_customer).
 * Includes requester and responder objects so email addresses are available
 * for SERVER_SCOPE write-back (RFC-0198).
 *
 * Returns up to 10 pages × 100 tickets = 1 000 max.
 */
export async function fetchOpenTickets(
  domain: string,
  apiKey: string
): Promise<FreshDeskTicket[]> {
  // The FreshDesk list API (/tickets) does not support the `status` filter parameter
  // in all account configurations. Use the Search API instead, which supports
  // multi-status queries via query string.
  // Note: the Search API does not support `include=requester` — requester info
  // will be absent from results (ticket.requester will be undefined).
  const results: FreshDeskTicket[] = [];
  const base = _baseUrl(domain);
  const headers = { Authorization: _authHeader(apiKey) };
  const query = encodeURIComponent('(status:2 OR status:3 OR status:6)');

  try {
    for (let page = 1; page <= 34; page++) {
      // Search API returns max 30 results per page (up to 1000 total = 34 pages)
      const url = `${base}/search/tickets?query="${query}"&page=${page}`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        console.warn('[FreshdeskClient] fetchOpenTickets HTTP', res.status, 'page', page);
        break;
      }

      const data = await res.json() as { results: FreshDeskTicket[]; total: number };
      const batch = Array.isArray(data.results) ? data.results : [];
      results.push(...batch);

      // Stop when we've fetched all pages
      if (results.length >= data.total || batch.length === 0) break;
    }
  } catch (err) {
    console.warn('[FreshdeskClient] fetchOpenTickets error:', err);
  }

  return results;
}

/**
 * Fetch open/pending/waiting tickets for a specific device identifier using
 * the custom_field filter query parameter.
 *
 * Used by TicketsTab when prefetchedTickets are not available.
 */
export async function fetchTicketsForDevice(
  domain: string,
  apiKey: string,
  identifier: string
): Promise<FreshDeskTicket[]> {
  // Primary: filter by cf_device_identifier custom field (requires the field to be
  // configured in FreshDesk Admin → Ticket Fields → cf_device_identifier).
  // Fallback: fetch first page of open tickets and filter client-side.
  try {
    const base = _baseUrl(domain);
    const headers = { Authorization: _authHeader(apiKey) };

    // Try custom field filter first
    const urlCf = `${base}/tickets?cf_device_identifier=${encodeURIComponent(identifier)}&per_page=100&include=requester`;
    const resCf = await fetch(urlCf, { headers });
    if (resCf.ok) {
      const data: unknown = await resCf.json();
      return Array.isArray(data) ? (data as FreshDeskTicket[]) : [];
    }

    // Custom field not configured (400) — fall back to search API and filter client-side
    console.warn('[FreshdeskClient] fetchTicketsForDevice: cf_device_identifier not available, falling back to client-side filter');
    const query = encodeURIComponent('(status:2 OR status:3 OR status:6)');
    const urlSearch = `${base}/search/tickets?query="${query}"&page=1`;
    const resSearch = await fetch(urlSearch, { headers });
    if (!resSearch.ok) return [];
    const searchData = await resSearch.json() as { results: FreshDeskTicket[] };
    const all = Array.isArray(searchData.results) ? searchData.results : [];
    // Filter by cf_device_identifier or subject containing the identifier
    return all.filter(t =>
      t.custom_fields?.cf_device_identifier === identifier ||
      (t.subject ?? '').includes(identifier)
    );
  } catch (err) {
    console.warn('[FreshdeskClient] fetchTicketsForDevice error:', err);
    return [];
  }
}

// ============================================================================
// Write — create / update
// ============================================================================

/**
 * Create a new ticket in FreshDesk.
 *
 * Defaults: source=2 (portal), status=2 (open), priority=2 (medium).
 * Custom fields `cf_device_identifier`, `cf_ticket_type`, `cf_motivo` are
 * set from the `deviceIdentifier` parameter and `options`.
 *
 * When `options.attachments` contains files the request is sent as
 * `multipart/form-data` (browser sets the boundary automatically);
 * otherwise JSON is used.
 *
 * Returns the created FreshDeskTicket on HTTP 201, or null on error.
 */
export async function createTicket(
  domain: string,
  apiKey: string,
  subject: string,
  deviceIdentifier: string,
  email: string,
  options?: {
    description?: string;
    ticketType?: TicketTypeId;   // → cf_ticket_type (1=Software/Dashboard, 2=Instalação)
    motivo?: TicketMotivo;       // → cf_motivo (Corretivo | Evolutivo | Instalação)
    attachments?: File[];
    parent_id?: number;          // Child ticket — links to parent ticket id
  }
): Promise<FreshDeskTicket | null> {
  try {
    const base = _baseUrl(domain);
    const description = options?.description ?? '';
    const hasAttachments = (options?.attachments?.length ?? 0) > 0;

    const customFields: Record<string, unknown> = { cf_device_identifier: deviceIdentifier };
    if (options?.ticketType !== undefined) customFields['cf_ticket_type'] = options.ticketType;
    if (options?.motivo !== undefined)     customFields['cf_motivo']      = options.motivo;

    let body: BodyInit;
    const headers: Record<string, string> = { Authorization: _authHeader(apiKey) };

    if (hasAttachments) {
      // multipart/form-data — do NOT set Content-Type, browser adds boundary
      const fd = new FormData();
      fd.append('subject', subject);
      fd.append('description', description);
      fd.append('email', email);
      fd.append('source', '2');
      fd.append('status', '2');
      fd.append('priority', '2');
      fd.append('custom_fields[cf_device_identifier]', deviceIdentifier);
      if (options?.ticketType !== undefined) fd.append('custom_fields[cf_ticket_type]', String(options.ticketType));
      if (options?.motivo !== undefined)     fd.append('custom_fields[cf_motivo]', options.motivo);
      if (options?.parent_id !== undefined)  fd.append('parent_id', String(options.parent_id));
      for (const file of options!.attachments!) {
        fd.append('attachments[]', file, file.name);
      }
      body = fd;
    } else {
      headers['Content-Type'] = 'application/json';
      const jsonPayload: Record<string, unknown> = {
        subject, description, email,
        source: 2, status: 2, priority: 2,
        custom_fields: customFields,
      };
      if (options?.parent_id !== undefined) jsonPayload['parent_id'] = options.parent_id;
      body = JSON.stringify(jsonPayload);
    }

    const res = await fetch(`${base}/tickets`, { method: 'POST', headers, body });

    if (!res.ok) {
      // FreshDesk returns 400 when custom fields don't exist in the account yet.
      // Detect this and retry without custom_fields so the ticket still gets created.
      if (res.status === 400) {
        try {
          const errBody = await res.json();
          const invalidFields: string[] = ((errBody.errors ?? []) as { code: string; field: string }[])
            .filter(e => e.code === 'invalid_field')
            .map(e => e.field);
          const ourCustomFields = ['cf_device_identifier', 'cf_ticket_type', 'cf_motivo'];
          if (invalidFields.some(f => ourCustomFields.includes(f))) {
            console.warn(
              '[FreshdeskClient] Custom fields not configured in FreshDesk — retrying without them:',
              invalidFields
            );
            const retryHeaders: Record<string, string> = { Authorization: _authHeader(apiKey) };
            let retryBody: BodyInit;
            if (hasAttachments) {
              const fd2 = new FormData();
              fd2.append('subject', subject); fd2.append('description', description);
              fd2.append('email', email);     fd2.append('source', '2');
              fd2.append('status', '2');      fd2.append('priority', '2');
              for (const file of options!.attachments!) fd2.append('attachments[]', file, file.name);
              retryBody = fd2;
            } else {
              retryHeaders['Content-Type'] = 'application/json';
              retryBody = JSON.stringify({ subject, description, email, source: 2, status: 2, priority: 2 });
            }
            const retryRes = await fetch(`${base}/tickets`, { method: 'POST', headers: retryHeaders, body: retryBody });
            if (!retryRes.ok) {
              console.warn('[FreshdeskClient] createTicket retry HTTP', retryRes.status);
              return null;
            }
            return (await retryRes.json()) as FreshDeskTicket;
          }
        } catch { /* ignore parse errors — fall through to generic warn */ }
      }
      console.warn('[FreshdeskClient] createTicket HTTP', res.status);
      return null;
    }

    return (await res.json()) as FreshDeskTicket;
  } catch (err) {
    console.warn('[FreshdeskClient] createTicket error:', err);
    return null;
  }
}

/**
 * Update arbitrary fields on an existing ticket.
 * Returns the updated ticket on success, or null on error.
 */
export async function updateTicket(
  domain: string,
  apiKey: string,
  ticketId: number,
  fields: Partial<Pick<FreshDeskTicket, 'subject' | 'status' | 'priority'>> & Record<string, unknown>
): Promise<FreshDeskTicket | null> {
  try {
    const res = await fetch(`${_baseUrl(domain)}/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        Authorization: _authHeader(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fields),
    });

    if (!res.ok) {
      console.warn('[FreshdeskClient] updateTicket HTTP', res.status);
      return null;
    }

    return (await res.json()) as FreshDeskTicket;
  } catch (err) {
    console.warn('[FreshdeskClient] updateTicket error:', err);
    return null;
  }
}

/**
 * Reopen a resolved/closed ticket by setting status back to 2 (open).
 * Returns true on HTTP 200, false otherwise.
 */
export async function reopenTicket(
  domain: string,
  apiKey: string,
  ticketId: number
): Promise<boolean> {
  const result = await updateTicket(domain, apiKey, ticketId, { status: 2 });
  return result !== null;
}

/**
 * Delete a ticket (HTTP 204 = success).
 * Returns true on success, false on error.
 */
export async function deleteTicket(
  domain: string,
  apiKey: string,
  ticketId: number
): Promise<boolean> {
  try {
    const res = await fetch(`${_baseUrl(domain)}/tickets/${ticketId}`, {
      method: 'DELETE',
      headers: { Authorization: _authHeader(apiKey) },
    });

    if (res.status !== 204) {
      console.warn('[FreshdeskClient] deleteTicket HTTP', res.status);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[FreshdeskClient] deleteTicket error:', err);
    return false;
  }
}
