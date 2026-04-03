/**
 * FreshDesk API — generic types.
 *
 * These types model the FreshDesk v2 REST API response/request objects and are
 * independent of any dashboard-specific context. Import them from here (or via
 * the library public export in `src/index.ts`) rather than from a specific widget
 * or modal folder.
 *
 * Dashboard-specific types (TicketsTabConfig, FreshdeskTicketSummary, etc.) live in
 * src/components/premium-modals/settings/tickets/types.ts.
 */

/** FreshDesk conversation / note on a ticket (returned by include=conversations) */
export interface FreshDeskConversation {
  id: number;
  /** HTML body */
  body?: string;
  body_text?: string;
  from_email?: string;
  to_emails?: string[];
  cc_emails?: string[];
  /** true = internal note; false = public reply */
  private?: boolean;
  /** true = message came from the requester or customer */
  incoming?: boolean;
  created_at: string;
  updated_at?: string;
  user_id?: number;
  support_email?: string;
}

/** Ticket type — what kind of support case this is */
export type TicketTypeId = 1 | 2;
// 1 = Software / Dashboard
// 2 = Instalação

/** Ticket reason / motivo */
export type TicketMotivo = 'Corretivo' | 'Evolutivo' | 'Instalação';

/**
 * FreshDesk ticket object as returned by GET /api/v2/tickets.
 *
 * Field availability varies by query parameters:
 *   - `requester` object only when `include=requester` is used
 *   - `responder` object only when `include=responder` is used
 *   - `stats`     object only when `include=stats`     is used
 */
export interface FreshDeskTicket {
  id: number;
  subject: string;
  /** HTML description (available when fetching single ticket) */
  description?: string;
  description_text?: string;
  /** 2=open | 3=pending | 4=resolved | 5=closed | 6=waiting */
  status: 2 | 3 | 4 | 5 | 6;
  /** 1=low | 2=medium | 3=high | 4=urgent */
  priority: 1 | 2 | 3 | 4;
  requester_id: number;
  /** Populated when ?include=requester is used */
  requester?: { name: string; email: string };
  /** Last agent who responded/updated — populated when ?include=responder is used */
  responder?: { id: number; name: string; email: string };
  /** Ticket lifecycle timestamps — populated when ?include=stats is used */
  stats?: {
    agent_responded_at?: string;
    requester_responded_at?: string;
  };
  created_at: string;  // ISO-8601 UTC
  updated_at: string;  // ISO-8601 UTC
  due_by?: string;
  cc_emails?: string[];
  ticket_cc_emails?: string[];
  associated_tickets_count?: number | null;
  /** Populated when ?include=conversations is used */
  conversations?: FreshDeskConversation[];
  custom_fields: {
    /** MyIO device identifier, e.g. "MED-LOJA-01" — links ticket to a TB device */
    cf_device_identifier?: string;
    /** 1=Software/Dashboard | 2=Instalação */
    cf_ticket_type?: TicketTypeId;
    /** Corretivo | Evolutivo | Instalação */
    cf_motivo?: TicketMotivo;
    cf_empresa?: string | null;
    cf_cnpj?: string | number | null;
    cf_reference_number?: string | null;
    [key: string]: unknown;
  };
  tags: string[];
}
