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
  // FreshDesk list API does not accept comma-separated status values.
  // Fetch each active status separately and merge results.
  const ACTIVE_STATUSES = [2, 3, 6]; // open, pending, waiting
  const results: FreshDeskTicket[] = [];
  const seen = new Set<number>();
  const base = _baseUrl(domain);
  const headers = {
    Authorization: _authHeader(apiKey),
    'Content-Type': 'application/json',
  };

  try {
    for (const status of ACTIVE_STATUSES) {
      for (let page = 1; page <= 10; page++) {
        // include=requester populates ticket.requester.email
        // Note: 'responder' is not a valid include value in the FreshDesk list API
        const url = `${base}/tickets?status=${status}&per_page=100&page=${page}&include=requester`;
        const res = await fetch(url, { headers });

        if (!res.ok) {
          console.warn('[FreshdeskClient] fetchOpenTickets HTTP', res.status, 'status', status, 'page', page);
          break;
        }

        const data: FreshDeskTicket[] = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;

        for (const t of data) {
          if (!seen.has(t.id)) { seen.add(t.id); results.push(t); }
        }
        if (data.length < 100) break; // last page for this status
      }
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
  try {
    const base = _baseUrl(domain);
    const url = `${base}/tickets?cf_device_identifier=${encodeURIComponent(identifier)}&per_page=100&include=requester`;
    const res = await fetch(url, {
      headers: {
        Authorization: _authHeader(apiKey),
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn('[FreshdeskClient] fetchTicketsForDevice HTTP', res.status);
      return [];
    }

    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as FreshDeskTicket[]) : [];
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
