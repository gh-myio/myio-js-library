/**
 * RFC-0198: TicketServiceOrchestrator
 *
 * Fetches all open FreshDesk tickets, builds a device-keyed map, and exposes
 * window.TicketServiceOrchestrator — mirroring the pattern of AlarmServiceOrchestrator.
 *
 * Usage (MAIN_VIEW controller):
 *   const tso = await buildTicketServiceOrchestrator(domain, apiKey, FreshdeskClient);
 *   window.TicketServiceOrchestrator = tso;
 */

import type { FreshDeskTicket, TicketServiceOrchestratorShape } from './types';
import type * as FreshdeskClientModule from './FreshdeskClient';

// ============================================================================
// Builder
// ============================================================================

/**
 * Fetches all open tickets, indexes them by cf_device_identifier, and returns
 * an object matching TicketServiceOrchestratorShape.
 *
 * @param domain       FreshDesk domain, e.g. "myiocom.freshdesk.com"
 * @param apiKey       FreshDesk API key
 * @param freshdeskClient  The FreshdeskClient module (passed to allow mocking in tests)
 */
export async function buildTicketServiceOrchestrator(
  domain: string,
  apiKey: string,
  freshdeskClient: Pick<typeof FreshdeskClientModule, 'fetchOpenTickets'>
): Promise<TicketServiceOrchestratorShape> {
  let tickets: FreshDeskTicket[] = [];

  try {
    tickets = await freshdeskClient.fetchOpenTickets(domain, apiKey);
  } catch (err) {
    console.warn('[TicketServiceOrchestrator] fetchOpenTickets failed:', err);
    tickets = [];
  }

  const deviceTicketMap = _buildMap(tickets);

  const orchestrator: TicketServiceOrchestratorShape = {
    tickets,

    deviceTicketMap,

    getTicketCountForDevice(identifier: string): number {
      return this.deviceTicketMap.get(identifier)?.length ?? 0;
    },

    getTicketsForDevice(identifier: string): FreshDeskTicket[] {
      return this.deviceTicketMap.get(identifier) ?? [];
    },

    async refresh(): Promise<void> {
      try {
        const fresh = await freshdeskClient.fetchOpenTickets(domain, apiKey);
        orchestrator.tickets = fresh;
        orchestrator.deviceTicketMap = _buildMap(fresh);

        window.dispatchEvent(
          new CustomEvent('myio:tickets-ready', {
            detail: { ticketMap: orchestrator.deviceTicketMap },
          })
        );

        console.log(
          '[TicketServiceOrchestrator] refreshed —',
          orchestrator.deviceTicketMap.size,
          'devices with tickets,',
          fresh.length,
          'total tickets'
        );
      } catch (err) {
        console.warn('[TicketServiceOrchestrator] refresh error:', err);
      }
    },
  };

  // Dispatch event so widgets can react immediately
  window.dispatchEvent(
    new CustomEvent('myio:tickets-ready', {
      detail: { ticketMap: deviceTicketMap },
    })
  );

  console.log(
    '[TicketServiceOrchestrator] Built —',
    deviceTicketMap.size,
    'devices with tickets,',
    tickets.length,
    'total tickets'
  );

  return orchestrator;
}

// ============================================================================
// Helpers
// ============================================================================

function _buildMap(tickets: FreshDeskTicket[]): Map<string, FreshDeskTicket[]> {
  const map = new Map<string, FreshDeskTicket[]>();

  for (const ticket of tickets) {
    const identifier = ticket.custom_fields?.cf_device_identifier;
    if (!identifier) continue;

    const existing = map.get(identifier);
    if (existing) {
      existing.push(ticket);
    } else {
      map.set(identifier, [ticket]);
    }
  }

  return map;
}
