/**
 * RFC-0198: FreshDesk / Tickets — shared types (dashboard-specific layer)
 *
 * Generic FreshDesk API types (FreshDeskTicket, TicketTypeId, TicketMotivo) are
 * defined in src/services/freshdesk/types.ts and re-exported here so existing
 * imports within this folder continue to work unchanged.
 */

// Re-export generic FreshDesk types from the reusable service module
export type { FreshDeskTicket, TicketTypeId, TicketMotivo } from '../../../../services/freshdesk/types';
import type { FreshDeskTicket } from '../../../../services/freshdesk/types';

// ============================================================================
// Dashboard-specific types (ThingsBoard + SettingsModal context)
// ============================================================================

/** Compact ticket record stored as ThingsBoard SERVER_SCOPE attribute `freshdesk_tickets` */
export interface FreshdeskTicketSummary {
  id: number;
  /** 2=open | 3=pending | 4=resolved | 5=closed | 6=waiting */
  status: 2 | 3 | 4 | 5 | 6;
  /** Human-readable label: Aberto | Pendente | Resolvido | Fechado | Aguardando */
  status_label: string;
  created_at: string;   // ISO-8601 UTC
  updated_at: string;   // ISO-8601 UTC
  /** Email of the requester who opened the ticket (FreshDesk requester.email) */
  created_by_email?: string;
  /** Email of the last agent who updated the ticket (FreshDesk responder.email) */
  updated_by_email?: string;
}

export interface TicketsTabConfig {
  container: HTMLElement;
  /** Device identifier, e.g. "MED-LOJA-01" */
  deviceIdentifier: string;
  /** ThingsBoard device UUID */
  tbDeviceId: string;
  deviceLabel?: string;
  freshdeskApiKey: string;
  /** e.g. "myiocom.freshdesk.com" */
  freshdeskDomain: string;
  /** Pre-fetched tickets from TicketServiceOrchestrator (skips per-device fetch when provided) */
  prefetchedTickets?: FreshDeskTicket[] | null;
  /** ThingsBoard JWT token — for writing freshdesk_tickets SERVER_SCOPE attribute */
  jwtToken?: string;
  /** ThingsBoard base URL — defaults to window.location.origin */
  tbBaseUrl?: string;
  /** Email of the currently logged-in user — pre-fills the "E-mail do solicitante" field */
  requesterEmail?: string;
}

export interface TicketServiceOrchestratorShape {
  tickets: FreshDeskTicket[];
  deviceTicketMap: Map<string, FreshDeskTicket[]>;
  getTicketCountForDevice(identifier: string): number;
  getTicketsForDevice(identifier: string): FreshDeskTicket[];
  refresh(): Promise<void>;
  /** Map<deviceIdentifier, tbDeviceId> — needed to write SERVER_SCOPE per device */
  tbDeviceIdMap: Map<string, string>;
}
