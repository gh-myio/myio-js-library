/**
 * RFC-0198: FreshdeskClient — fetch-based wrapper for the FreshDesk v2 API.
 *
 * CORS NOTE: Direct browser calls to FreshDesk will be blocked by CORS in production.
 * A server-side proxy (Phase 6) is required for real-world deployment.
 * In the meantime this client is fully functional in Node / backend contexts
 * and in browsers where CORS is relaxed (e.g. ThingsBoard widgets with a same-origin proxy).
 *
 * All public functions catch errors gracefully and return empty arrays / false
 * rather than throwing, so badge failures never crash the dashboard.
 */

import type { FreshDeskTicket, TicketTypeId, TicketMotivo } from './types';

// ============================================================================
// Internals
// ============================================================================

function _authHeader(apiKey: string): string {
  // FreshDesk uses HTTP Basic: apiKey:X (password is the literal letter X)
  return 'Basic ' + btoa(apiKey + ':X');
}

function _baseUrl(domain: string): string {
  return `https://${domain}/api/v2`;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch all open/pending/waiting tickets for a FreshDesk account (paginated).
 * Status codes: 2=open, 3=pending, 6=waiting_on_customer
 * Returns up to 10 pages (1 000 tickets max).
 */
export async function fetchOpenTickets(domain: string, apiKey: string): Promise<FreshDeskTicket[]> {
  const results: FreshDeskTicket[] = [];
  const base = _baseUrl(domain);
  const headers = {
    Authorization: _authHeader(apiKey),
    'Content-Type': 'application/json',
  };

  try {
    for (let page = 1; page <= 10; page++) {
      const url = `${base}/tickets?status=2,3,6&per_page=100&page=${page}`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        console.warn('[FreshdeskClient] fetchOpenTickets HTTP', res.status, 'on page', page);
        break;
      }

      const data: FreshDeskTicket[] = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;

      results.push(...data);
      if (data.length < 100) break; // last page
    }
  } catch (err) {
    console.warn('[FreshdeskClient] fetchOpenTickets error:', err);
  }

  return results;
}

/**
 * Fetch open tickets for a specific device identifier using custom_field filter.
 */
export async function fetchTicketsForDevice(
  domain: string,
  apiKey: string,
  identifier: string
): Promise<FreshDeskTicket[]> {
  try {
    const base = _baseUrl(domain);
    const url =
      `${base}/tickets?cf_device_identifier=${encodeURIComponent(identifier)}&status=2,3,6`;
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

/**
 * Create a new ticket in FreshDesk.
 * Sets cf_device_identifier, source=2 (portal), status=2 (open), priority=2 (medium).
 * If options.attachments has files, uses multipart FormData instead of JSON.
 */
export async function createTicket(
  domain: string,
  apiKey: string,
  subject: string,
  deviceIdentifier: string,
  email: string,
  options?: {
    description?: string;
    ticketType?: TicketTypeId;   // 1=Software/Dashboard, 2=Instalação
    motivo?: TicketMotivo;       // Corretivo | Evolutivo | Instalação
    attachments?: File[];
  }
): Promise<FreshDeskTicket | null> {
  try {
    const base = _baseUrl(domain);
    const description = options?.description ?? '';
    const hasAttachments = options?.attachments && options.attachments.length > 0;

    const customFields: Record<string, unknown> = {
      cf_device_identifier: deviceIdentifier,
    };
    if (options?.ticketType !== undefined) {
      customFields['cf_ticket_type'] = options.ticketType;
    }
    if (options?.motivo !== undefined) {
      customFields['cf_motivo'] = options.motivo;
    }

    let body: BodyInit;
    const headers: Record<string, string> = {
      Authorization: _authHeader(apiKey),
    };

    if (hasAttachments) {
      // Use multipart FormData when attachments are present
      const fd = new FormData();
      fd.append('subject', subject);
      fd.append('description', description);
      fd.append('email', email);
      fd.append('source', '2');
      fd.append('status', '2');
      fd.append('priority', '2');
      fd.append('custom_fields[cf_device_identifier]', deviceIdentifier);
      if (options?.ticketType !== undefined) {
        fd.append('custom_fields[cf_ticket_type]', String(options.ticketType));
      }
      if (options?.motivo !== undefined) {
        fd.append('custom_fields[cf_motivo]', options.motivo);
      }
      for (const file of options!.attachments!) {
        fd.append('attachments[]', file, file.name);
      }
      body = fd;
      // Do NOT set Content-Type — browser sets it with multipart boundary
    } else {
      body = JSON.stringify({
        subject,
        description,
        email,
        source: 2,   // portal
        status: 2,   // open
        priority: 2, // medium
        custom_fields: customFields,
      });
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${base}/tickets`, {
      method: 'POST',
      headers,
      body,
    });

    if (!res.ok) {
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
 * Reopen a resolved/closed ticket by setting its status back to 2 (open).
 */
export async function reopenTicket(
  domain: string,
  apiKey: string,
  ticketId: number
): Promise<boolean> {
  try {
    const base = _baseUrl(domain);
    const res = await fetch(`${base}/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        Authorization: _authHeader(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 2 }),
    });

    if (!res.ok) {
      console.warn('[FreshdeskClient] reopenTicket HTTP', res.status);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[FreshdeskClient] reopenTicket error:', err);
    return false;
  }
}
