/**
 * RFC-0198: TicketsTab — FreshDesk ticket integration tab for SettingsModal.
 *
 * Section 1 — Open tickets for this device (reads from TicketServiceOrchestrator or
 *             falls back to FreshdeskClient.fetchTicketsForDevice).
 *             Each ticket card shows subject, status pill, priority, requester, date
 *             and an external link to FreshDesk.
 *
 * Section 2 — Collapsible "Novo Chamado" form (subject, ticket type, motivo,
 *             description, email, attachments).
 *             On submit calls FreshdeskClient.createTicket then reloads Section 1.
 */

import { fetchTicketsForDevice, createTicket } from './FreshdeskClient';
import type { TicketsTabConfig, FreshDeskTicket, TicketTypeId, TicketMotivo } from './types';

// ============================================================================
// Constants
// ============================================================================

const STATUS_LABELS: Record<number, string> = {
  2: 'Aberto',
  3: 'Pendente',
  4: 'Resolvido',
  5: 'Fechado',
  6: 'Aguardando',
};

const STATUS_COLORS: Record<number, string> = {
  2: '#16a34a',  // green — open
  3: '#f59e0b',  // amber — pending
  4: '#6b7280',  // gray — resolved
  5: '#9ca3af',  // light gray — closed
  6: '#3b82f6',  // blue — waiting
};

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Baixa',
  2: 'Média',
  3: 'Alta',
  4: 'Urgente',
};

const PRIORITY_COLORS: Record<number, string> = {
  1: '#6b7280',
  2: '#3b82f6',
  3: '#f59e0b',
  4: '#dc2626',
};

// ============================================================================
// TicketsTab class (internal — exported via createTicketsTab factory)
// ============================================================================

class TicketsTab {
  private config: TicketsTabConfig;
  private tickets: FreshDeskTicket[] = [];
  private ticketsUpdatedHandler: (() => void) | null = null;

  constructor(config: TicketsTabConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    const { container } = this.config;
    this.injectStyles();
    container.innerHTML = this.getLoadingHTML();

    if (!this.config.freshdeskApiKey) {
      container.innerHTML = this.getLockedHTML();
      return;
    }

    await this.loadTickets();
    container.innerHTML = this.renderTab();
    this.attachListeners();

    // Re-read from TSO when the global orchestrator refreshes
    this.ticketsUpdatedHandler = () => {
      this.readTicketsFromTSO();
      this.refreshTicketsSection();
    };
    window.addEventListener('myio:tickets-ready', this.ticketsUpdatedHandler);
  }

  destroy(): void {
    if (this.ticketsUpdatedHandler) {
      window.removeEventListener('myio:tickets-ready', this.ticketsUpdatedHandler);
      this.ticketsUpdatedHandler = null;
    }
  }

  // ==========================================================================
  // Data loading
  // ==========================================================================

  private async loadTickets(): Promise<void> {
    // 1. Try TicketServiceOrchestrator (pre-fetched by MAIN_VIEW)
    if (this.readTicketsFromTSO()) return;

    // 2. Try prefetchedTickets prop (offline/showcase mode)
    if (this.config.prefetchedTickets != null) {
      this.tickets = this.config.prefetchedTickets.filter(
        (t) => t.custom_fields?.cf_device_identifier === this.config.deviceIdentifier
      );
      return;
    }

    // 3. Fallback: per-device fetch
    try {
      this.tickets = await fetchTicketsForDevice(
        this.config.freshdeskDomain,
        this.config.freshdeskApiKey,
        this.config.deviceIdentifier
      );
    } catch (err) {
      console.warn('[TicketsTab] loadTickets error:', err);
      this.tickets = [];
    }
  }

  /**
   * Reads device tickets from window.TicketServiceOrchestrator.
   * Returns true if TSO was available (even if no tickets for this device).
   */
  private readTicketsFromTSO(): boolean {
    const tso = (
      window as unknown as {
        TicketServiceOrchestrator?: {
          getTicketsForDevice: (id: string) => FreshDeskTicket[];
        };
      }
    ).TicketServiceOrchestrator;

    if (tso && this.config.deviceIdentifier) {
      this.tickets = tso.getTicketsForDevice(this.config.deviceIdentifier);
      return true;
    }
    return false;
  }

  // ==========================================================================
  // Rendering
  // ==========================================================================

  private renderTab(): string {
    return `
      <div class="ct-tab">
        ${this.renderSection1()}
        ${this.renderSection2()}
      </div>
    `;
  }

  private renderSection1(): string {
    const count = this.tickets.length;
    return `
      <div class="ct-section">
        <div class="ct-section-header">
          <span class="ct-section-icon">🎫</span>
          <div>
            <div class="ct-section-title">Chamados Abertos</div>
            <div class="ct-section-sub" id="ct-tickets-sub">${this.buildSubtitle()}</div>
          </div>
          <span class="ct-count-badge" id="ct-tickets-count"
                style="${count === 0 ? 'display:none;' : ''}">${count}</span>
        </div>
        <div id="ct-tickets-list" class="ct-tickets-list">
          ${count === 0
            ? `<div class="ct-empty" id="ct-tickets-empty">Nenhum chamado aberto para este dispositivo.</div>`
            : this.tickets.map((t) => this.renderTicketCard(t)).join('')
          }
        </div>
      </div>
    `;
  }

  private renderSection2(): string {
    const subjectDefault = this.esc(
      `[${this.config.deviceIdentifier || this.config.tbDeviceId}] ${this.config.deviceLabel ?? ''}`
    );
    return `
      <div class="ct-section">
        <div class="ct-section-header ct-section-header--collapsible" id="ct-new-ticket-toggle">
          <span class="ct-section-icon">✏️</span>
          <div>
            <div class="ct-section-title">Novo Chamado</div>
            <div class="ct-section-sub">Abrir um novo chamado no FreshDesk para este dispositivo</div>
          </div>
          <span class="ct-collapse-icon" id="ct-collapse-icon">▼</span>
        </div>
        <div id="ct-new-ticket-body" style="display:none;">
          <form class="ct-form" id="ct-new-ticket-form" novalidate>
            <div class="ct-form-group">
              <label class="ct-form-label" for="ct-subject">Assunto</label>
              <input
                type="text"
                id="ct-subject"
                name="subject"
                class="ct-form-input"
                value="${subjectDefault}"
                maxlength="255"
                required
              >
            </div>
            <div class="ct-form-group">
              <label class="ct-form-label" for="ct-ticket-type">Tipo de chamado</label>
              <select id="ct-ticket-type" name="ticketType" class="ct-form-select" required>
                <option value="">Selecione…</option>
                <option value="1">Software / Dashboard</option>
                <option value="2">Instalação</option>
              </select>
            </div>
            <div class="ct-form-group">
              <label class="ct-form-label" for="ct-motivo">Motivo</label>
              <select id="ct-motivo" name="motivo" class="ct-form-select" required>
                <option value="">Selecione…</option>
                <option value="Corretivo">Corretivo</option>
                <option value="Evolutivo">Evolutivo</option>
                <option value="Instalação">Instalação</option>
              </select>
            </div>
            <div class="ct-form-group">
              <label class="ct-form-label" for="ct-description">Descrição</label>
              <textarea
                id="ct-description"
                name="description"
                class="ct-form-textarea"
                rows="4"
                placeholder="Descreva o problema ou solicitação..."
              ></textarea>
            </div>
            <div class="ct-form-group">
              <label class="ct-form-label" for="ct-email">E-mail do solicitante</label>
              <input
                type="email"
                id="ct-email"
                name="email"
                class="ct-form-input"
                placeholder="usuario@empresa.com"
                required
              >
            </div>
            <div class="ct-form-group">
              <label class="ct-form-label" for="ct-attachments">Anexos</label>
              <input type="file" id="ct-attachments" name="attachments" class="ct-form-file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt">
              <div class="ct-form-hint">Opcional. Formatos: imagens, PDF, Word, Excel, texto.</div>
            </div>
            <div class="ct-form-footer">
              <span class="ct-form-msg" id="ct-form-msg" style="display:none;"></span>
              <button type="submit" class="ct-btn-submit" id="ct-btn-submit">Abrir Chamado</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private renderTicketCard(ticket: FreshDeskTicket): string {
    const statusLabel = STATUS_LABELS[ticket.status] ?? String(ticket.status);
    const statusColor = STATUS_COLORS[ticket.status] ?? '#6b7280';
    const priorityLabel = PRIORITY_LABELS[ticket.priority] ?? String(ticket.priority);
    const priorityColor = PRIORITY_COLORS[ticket.priority] ?? '#6b7280';
    const createdDate = this.formatDate(ticket.created_at);
    const requesterName = ticket.requester?.name ?? `#${ticket.requester_id}`;
    const fdUrl = `https://${this.config.freshdeskDomain}/helpdesk/tickets/${ticket.id}`;

    return `
      <div class="ct-ticket-card">
        <div class="ct-ticket-header">
          <div class="ct-ticket-subject">${this.esc(ticket.subject)}</div>
          <a href="${this.esc(fdUrl)}" target="_blank" rel="noopener noreferrer"
             class="ct-ticket-link" title="Abrir no FreshDesk">
            → FreshDesk
          </a>
        </div>
        <div class="ct-ticket-meta">
          <span class="ct-status-pill" style="background:${statusColor}20;color:${statusColor};">
            ${this.esc(statusLabel)}
          </span>
          <span class="ct-priority-pill" style="background:${priorityColor}20;color:${priorityColor};">
            ${this.esc(priorityLabel)}
          </span>
          <span class="ct-ticket-requester">👤 ${this.esc(requesterName)}</span>
          <span class="ct-ticket-date">📅 ${this.esc(createdDate)}</span>
          <span class="ct-ticket-id">#${ticket.id}</span>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // Live refresh
  // ==========================================================================

  private refreshTicketsSection(): void {
    const list = this.config.container.querySelector<HTMLElement>('#ct-tickets-list');
    const countBadge = this.config.container.querySelector<HTMLElement>('#ct-tickets-count');
    const sub = this.config.container.querySelector<HTMLElement>('#ct-tickets-sub');

    const count = this.tickets.length;

    if (sub) sub.textContent = this.buildSubtitle();
    if (countBadge) {
      countBadge.textContent = String(count);
      countBadge.style.display = count > 0 ? '' : 'none';
    }

    if (list) {
      if (count === 0) {
        list.innerHTML = `<div class="ct-empty">Nenhum chamado aberto para este dispositivo.</div>`;
      } else {
        list.innerHTML = this.tickets.map((t) => this.renderTicketCard(t)).join('');
      }
    }
  }

  // ==========================================================================
  // Event handling
  // ==========================================================================

  private attachListeners(): void {
    const container = this.config.container;

    // Toggle new-ticket form
    const toggle = container.querySelector('#ct-new-ticket-toggle');
    const body = container.querySelector<HTMLElement>('#ct-new-ticket-body');
    const icon = container.querySelector<HTMLElement>('#ct-collapse-icon');

    if (toggle && body) {
      toggle.addEventListener('click', () => {
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        if (icon) icon.textContent = isOpen ? '▼' : '▲';
      });
    }

    // Submit new ticket
    const form = container.querySelector<HTMLFormElement>('#ct-new-ticket-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSubmit(form).catch(() => {
          /* non-blocking */
        });
      });
    }
  }

  private async handleSubmit(form: HTMLFormElement): Promise<void> {
    const container = this.config.container;
    const btn = container.querySelector<HTMLButtonElement>('#ct-btn-submit');
    const msgEl = container.querySelector<HTMLElement>('#ct-form-msg');

    const subject = (form.querySelector<HTMLInputElement>('#ct-subject')?.value ?? '').trim();
    const ticketTypeRaw = (form.querySelector<HTMLSelectElement>('#ct-ticket-type')?.value ?? '').trim();
    const motivoRaw = (form.querySelector<HTMLSelectElement>('#ct-motivo')?.value ?? '').trim();
    const description = (form.querySelector<HTMLTextAreaElement>('#ct-description')?.value ?? '').trim();
    const email = (form.querySelector<HTMLInputElement>('#ct-email')?.value ?? '').trim();
    const attachmentInput = form.querySelector<HTMLInputElement>('#ct-attachments');
    const attachments: File[] = attachmentInput?.files ? Array.from(attachmentInput.files) : [];

    if (!subject || !ticketTypeRaw || !motivoRaw || !email) {
      this.showFormMsg(msgEl, 'Preencha todos os campos obrigatórios.', '#dc2626');
      return;
    }

    const ticketType = Number(ticketTypeRaw) as TicketTypeId;
    const motivo = motivoRaw as TicketMotivo;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Enviando…';
    }
    this.showFormMsg(msgEl, '', '');

    const result = await createTicket(
      this.config.freshdeskDomain,
      this.config.freshdeskApiKey,
      subject,
      this.config.deviceIdentifier,
      email,
      { description, ticketType, motivo, attachments: attachments.length > 0 ? attachments : undefined }
    );

    if (result) {
      this.showFormMsg(msgEl, `Chamado #${result.id} criado com sucesso.`, '#16a34a');
      form.reset();

      // Restore default subject
      const subjectInput = form.querySelector<HTMLInputElement>('#ct-subject');
      if (subjectInput) {
        subjectInput.value = `[${this.config.deviceIdentifier || this.config.tbDeviceId}] ${this.config.deviceLabel ?? ''}`;
      }

      // Reload tickets
      await this.loadTickets();
      this.refreshTicketsSection();
    } else {
      this.showFormMsg(msgEl, 'Erro ao criar chamado. Verifique a conexão.', '#dc2626');
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Abrir Chamado';
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private buildSubtitle(): string {
    const total = this.tickets.length;
    if (total === 0) return 'Nenhum chamado aberto para este dispositivo';
    return `${total} chamado${total !== 1 ? 's' : ''} aberto${total !== 1 ? 's' : ''} para este dispositivo`;
  }

  private formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  private esc(str: string): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private showFormMsg(el: HTMLElement | null, text: string, color: string): void {
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
    el.style.display = text ? 'inline' : 'none';
  }

  private getLoadingHTML(): string {
    return `
      <div style="padding:32px;text-align:center;color:#6c757d;">
        <div class="at-spinner"></div>
        <p>Carregando chamados…</p>
      </div>
    `;
  }

  private getLockedHTML(): string {
    return `
      <div style="
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        min-height:320px; padding:40px 24px; text-align:center;
      ">
        <div style="
          width:72px; height:72px; border-radius:50%;
          background:#f3f4f6; border:1.5px solid #e5e7eb;
          display:flex; align-items:center; justify-content:center;
          font-size:32px; margin-bottom:20px; opacity:0.7;
        ">🔒</div>
        <div style="font-size:15px; font-weight:600; color:#374151; margin-bottom:8px;">
          Chamados não disponíveis
        </div>
        <div style="font-size:13px; color:#9ca3af; max-width:320px; line-height:1.6;">
          A chave de API do FreshDesk não foi configurada.<br>
          Configure <code style="font-size:11px;background:#f3f4f6;padding:1px 5px;border-radius:3px;">freshdeskApiKey</code>
          nas configurações do widget.
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // Styles
  // ==========================================================================

  private injectStyles(): void {
    const STYLE_ID = 'myio-tickets-tab-styles';
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ===== TicketsTab layout ===== */
      .ct-tab {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 4px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .ct-section {
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        overflow: hidden;
      }
      .ct-section-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 20px;
        background: #f8f9fa;
        border-bottom: 1px solid #e9ecef;
      }
      .ct-section-header--collapsible {
        cursor: pointer;
        user-select: none;
      }
      .ct-section-header--collapsible:hover { background: #f1f3f5; }
      .ct-section-icon { font-size: 18px; }
      .ct-section-title {
        font-size: 14px;
        font-weight: 600;
        color: #d97706;
        margin: 0;
      }
      .ct-section-sub {
        font-size: 12px;
        color: #6c757d;
        margin-top: 2px;
      }
      .ct-count-badge {
        margin-left: auto;
        background: #f59e0b;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 20px;
        flex-shrink: 0;
      }
      .ct-collapse-icon {
        margin-left: auto;
        font-size: 12px;
        color: #9ca3af;
      }

      /* ===== Ticket list ===== */
      .ct-tickets-list {
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 360px;
        overflow-y: auto;
      }
      .ct-empty {
        padding: 20px;
        text-align: center;
        color: #6c757d;
        font-size: 14px;
        font-style: italic;
      }

      /* ===== Ticket card ===== */
      .ct-ticket-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px 14px;
        background: #fafafa;
        transition: box-shadow 0.15s;
      }
      .ct-ticket-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
      .ct-ticket-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }
      .ct-ticket-subject {
        font-size: 13px;
        font-weight: 600;
        color: #1a1a1a;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ct-ticket-link {
        font-size: 12px;
        font-weight: 600;
        color: #f59e0b;
        text-decoration: none;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .ct-ticket-link:hover { text-decoration: underline; color: #d97706; }
      .ct-ticket-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }
      .ct-status-pill,
      .ct-priority-pill {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 12px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }
      .ct-ticket-requester,
      .ct-ticket-date,
      .ct-ticket-id {
        font-size: 11px;
        color: #6b7280;
        white-space: nowrap;
      }

      /* ===== New ticket form ===== */
      .ct-form {
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .ct-form-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .ct-form-label {
        font-size: 12px;
        font-weight: 600;
        color: #374151;
      }
      .ct-form-input,
      .ct-form-textarea {
        border: 1.5px solid #d1d5db;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 13px;
        font-family: inherit;
        color: #1a1a1a;
        outline: none;
        transition: border-color 0.15s;
        background: #fff;
        resize: vertical;
      }
      .ct-form-input:focus,
      .ct-form-textarea:focus {
        border-color: #f59e0b;
        box-shadow: 0 0 0 2px rgba(245,158,11,0.12);
      }
      .ct-form-select {
        border: 1.5px solid #d1d5db;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 13px;
        font-family: inherit;
        color: #1a1a1a;
        outline: none;
        background: #fff;
        transition: border-color 0.15s;
      }
      .ct-form-select:focus {
        border-color: #f59e0b;
        box-shadow: 0 0 0 2px rgba(245,158,11,0.12);
      }
      .ct-form-file {
        font-size: 13px;
        font-family: inherit;
      }
      .ct-form-hint {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 2px;
      }
      .ct-form-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        padding-top: 4px;
      }
      .ct-form-msg { font-size: 13px; }
      .ct-btn-submit {
        background: #f59e0b;
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 8px 18px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
      }
      .ct-btn-submit:hover:not(:disabled) { background: #d97706; }
      .ct-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    `;
    document.head.appendChild(style);
  }
}

// ============================================================================
// Public factory
// ============================================================================

/**
 * Creates and initialises a TicketsTab.
 * Returns a handle with a `destroy()` method for cleanup.
 */
export function createTicketsTab(config: TicketsTabConfig): { destroy(): void } {
  const tab = new TicketsTab(config);
  tab.init().catch((err) => {
    console.error('[TicketsTab] init error:', err);
    config.container.innerHTML = `
      <p style="color:#dc3545;padding:20px;text-align:center;">
        Erro ao carregar chamados. Verifique a conexão.
      </p>
    `;
  });
  return { destroy: () => tab.destroy() };
}
