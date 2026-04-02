/**
 * RFC-0198: FreshDesk / Tickets — shared types
 */

export type TicketTypeId = 1 | 2;
export type TicketMotivo = 'Corretivo' | 'Evolutivo' | 'Instalação';

export interface FreshDeskTicket {
  id: number;
  subject: string;
  description_text?: string;
  /** 2=open | 3=pending | 4=resolved | 5=closed | 6=waiting */
  status: 2 | 3 | 4 | 5 | 6;
  /** 1=low | 2=medium | 3=high | 4=urgent */
  priority: 1 | 2 | 3 | 4;
  requester_id: number;
  requester?: { name: string; email: string };
  created_at: string;
  updated_at: string;
  custom_fields: {
    cf_device_identifier?: string;
    cf_ticket_type?: 1 | 2;   // 1=Software/Dashboard, 2=Instalação
    cf_motivo?: 'Corretivo' | 'Evolutivo' | 'Instalação';
    [key: string]: unknown;
  };
  tags: string[];
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
}

export interface TicketServiceOrchestratorShape {
  tickets: FreshDeskTicket[];
  deviceTicketMap: Map<string, FreshDeskTicket[]>;
  getTicketCountForDevice(identifier: string): number;
  getTicketsForDevice(identifier: string): FreshDeskTicket[];
  refresh(): Promise<void>;
}
