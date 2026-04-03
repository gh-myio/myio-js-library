/**
 * RFC-0198: TicketDetailModal — full ticket view with conversation history + actions.
 *
 * Opens when the user clicks a ticket row in the TicketNotificationTooltip (HEADER).
 * Features:
 *   - Ticket metadata: subject, status, priority, requester, dates, description
 *   - Conversation thread: list of existing notes/replies
 *   - Add comment: textarea → POST /tickets/{id}/notes
 *   - Cancel ticket: PUT /tickets/{id} with status=5 (closed) after inline confirmation
 */

import { fetchTicketDetail, addTicketNote, updateTicket } from '../../../services/freshdesk/FreshdeskClient';
import type { FreshDeskTicket, FreshDeskConversation } from '../../../services/freshdesk/types';

// ============================================================================
// Configuration
// ============================================================================

export interface TicketDetailModalConfig {
  freshdeskDomain: string;
  freshdeskApiKey: string;
  /** Initial ticket data (from TSO — already fetched). Full detail loaded async. */
  ticket: FreshDeskTicket;
  /** Called after a successful cancel so the caller can refresh its UI */
  onTicketCancelled?: (ticketId: number) => void;
  /** Called after a note is successfully added */
  onNoteAdded?: (ticketId: number) => void;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_LABELS: Record<number, string> = { 2: 'Aberto', 3: 'Pendente', 4: 'Resolvido', 5: 'Fechado', 6: 'Aguardando' };
const STATUS_COLORS: Record<number, string> = { 2: '#16a34a', 3: '#f59e0b', 4: '#6b7280', 5: '#9ca3af', 6: '#3b82f6' };
const PRIORITY_LABELS: Record<number, string> = { 1: 'Baixa', 2: 'Média', 3: 'Alta', 4: 'Urgente' };
const PRIORITY_COLORS: Record<number, string> = { 1: '#6b7280', 2: '#3b82f6', 3: '#f59e0b', 4: '#dc2626' };

// ============================================================================
// TicketDetailModal class
// ============================================================================

class TicketDetailModal {
  private config: TicketDetailModalConfig;
  private container: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private ticket: FreshDeskTicket;
  private conversations: FreshDeskConversation[] = [];
  private _escHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(config: TicketDetailModalConfig) {
    this.config = config;
    this.ticket = config.ticket;
  }

  open(): void {
    if (this.container) return; // already open

    this.injectStyles();

    // Build overlay + card
    this.container = document.createElement('div');
    this.container.className = 'tdm-overlay';

    this.modal = document.createElement('div');
    this.modal.className = 'tdm-card';
    this.modal.innerHTML = this._renderInitial();
    this.container.appendChild(this.modal);
    document.body.appendChild(this.container);

    this._bindStaticEvents();

    // Esc to close
    this._escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);

    // Async: fetch full detail (conversations + description)
    this._loadDetail();
  }

  close(): void {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.modal = null;
    }
  }

  // ==========================================================================
  // Data
  // ==========================================================================

  private async _loadDetail(): Promise<void> {
    const full = await fetchTicketDetail(
      this.config.freshdeskDomain,
      this.config.freshdeskApiKey,
      this.ticket.id
    );

    if (!full) {
      // Show error in conversations section
      const convEl = this.modal?.querySelector<HTMLElement>('#tdm-convs');
      if (convEl) convEl.innerHTML = '<p class="tdm-empty">Não foi possível carregar as conversas.</p>';
      return;
    }

    this.ticket = full;
    this.conversations = full.conversations ?? [];

    // Patch description
    const descEl = this.modal?.querySelector<HTMLElement>('#tdm-description');
    if (descEl) {
      const html = full.description || full.description_text || '';
      descEl.innerHTML = html ? `<div class="tdm-desc-html">${html}</div>` : '<span class="tdm-empty">Sem descrição.</span>';
    }

    // Patch conversations
    const convEl = this.modal?.querySelector<HTMLElement>('#tdm-convs');
    if (convEl) convEl.innerHTML = this._renderConversations();

    // Patch requester/due if not in initial ticket
    if (full.requester) {
      const reqEl = this.modal?.querySelector<HTMLElement>('#tdm-requester');
      if (reqEl) reqEl.textContent = `${full.requester.name} <${full.requester.email}>`;
    }
  }

  // ==========================================================================
  // Rendering
  // ==========================================================================

  private _renderInitial(): string {
    const t = this.ticket;
    const statusLabel = STATUS_LABELS[t.status] ?? String(t.status);
    const statusColor = STATUS_COLORS[t.status] ?? '#6b7280';
    const priorityLabel = PRIORITY_LABELS[t.priority] ?? String(t.priority);
    const priorityColor = PRIORITY_COLORS[t.priority] ?? '#6b7280';
    const requester = t.requester ? `${t.requester.name} <${t.requester.email}>` : `#${t.requester_id}`;
    const isClosed = t.status === 4 || t.status === 5;

    return `
      <!-- Header -->
      <div class="tdm-header">
        <div class="tdm-header-left">
          <span class="tdm-ticket-id">#${t.id}</span>
          <span class="tdm-status-pill" style="background:${statusColor}22;color:${statusColor};">
            ${this._esc(statusLabel)}
          </span>
          <span class="tdm-priority-pill" style="background:${priorityColor}22;color:${priorityColor};">
            ${this._esc(priorityLabel)}
          </span>
        </div>
        <button type="button" class="tdm-close-btn" id="tdm-close" title="Fechar">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Title -->
      <div class="tdm-subject">${this._esc(t.subject)}</div>

      <!-- Body -->
      <div class="tdm-body">

        <!-- Metadata grid -->
        <div class="tdm-meta-grid">
          <div class="tdm-meta-item">
            <span class="tdm-meta-label">Solicitante</span>
            <span class="tdm-meta-value" id="tdm-requester">${this._esc(requester)}</span>
          </div>
          <div class="tdm-meta-item">
            <span class="tdm-meta-label">Criado em</span>
            <span class="tdm-meta-value">${this._fmt(t.created_at)}</span>
          </div>
          <div class="tdm-meta-item">
            <span class="tdm-meta-label">Atualizado</span>
            <span class="tdm-meta-value">${this._fmt(t.updated_at)}</span>
          </div>
          ${t.due_by ? `
          <div class="tdm-meta-item">
            <span class="tdm-meta-label">Prazo</span>
            <span class="tdm-meta-value">${this._fmt(t.due_by)}</span>
          </div>` : ''}
          ${(t.cc_emails?.length || t.ticket_cc_emails?.length) ? `
          <div class="tdm-meta-item tdm-meta-item--wide">
            <span class="tdm-meta-label">CC</span>
            <span class="tdm-meta-value">${this._esc((t.cc_emails ?? t.ticket_cc_emails ?? []).join(', '))}</span>
          </div>` : ''}
          ${t.custom_fields?.cf_empresa ? `
          <div class="tdm-meta-item">
            <span class="tdm-meta-label">Empresa</span>
            <span class="tdm-meta-value">${this._esc(String(t.custom_fields.cf_empresa))}</span>
          </div>` : ''}
        </div>

        <!-- Description -->
        <div class="tdm-section">
          <div class="tdm-section-title">Descrição</div>
          <div id="tdm-description" class="tdm-desc-loading">
            <span class="tdm-spinner"></span> Carregando…
          </div>
        </div>

        <!-- Comentários -->
        <div class="tdm-section">
          <div class="tdm-section-title">Comentários</div>
          <div id="tdm-convs" class="tdm-convs">
            <span class="tdm-spinner"></span> Carregando…
          </div>
        </div>

        <!-- Adicionar comentário -->
        <div class="tdm-section" id="tdm-comment-section"${isClosed ? ' style="display:none;"' : ''}>
          <div class="tdm-section-title">Adicionar Comentário</div>
          <textarea id="tdm-comment-body" class="tdm-comment-textarea"
                    placeholder="Escreva um comentário ou atualização…" rows="4"></textarea>
          <div class="tdm-comment-footer">
            <span class="tdm-msg" id="tdm-comment-msg" style="display:none;"></span>
            <button type="button" class="tdm-btn tdm-btn--primary" id="tdm-comment-submit">
              Enviar Comentário
            </button>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="tdm-footer">
        ${!isClosed ? `
        <div id="tdm-cancel-area">
          <button type="button" class="tdm-btn tdm-btn--danger" id="tdm-cancel-btn">
            Cancelar Chamado
          </button>
          <div class="tdm-cancel-confirm" id="tdm-cancel-confirm" style="display:none;">
            <span class="tdm-cancel-confirm-text">Tem certeza? O chamado será fechado.</span>
            <button type="button" class="tdm-btn tdm-btn--danger tdm-btn--sm" id="tdm-cancel-yes">Confirmar</button>
            <button type="button" class="tdm-btn tdm-btn--ghost tdm-btn--sm" id="tdm-cancel-no">Cancelar</button>
          </div>
          <span class="tdm-msg" id="tdm-cancel-msg" style="display:none;"></span>
        </div>` : `<div class="tdm-closed-notice">Este chamado está ${this._esc(statusLabel.toLowerCase())}.</div>`}
        <button type="button" class="tdm-btn tdm-btn--ghost" id="tdm-footer-close">Fechar</button>
      </div>
    `;
  }

  private _renderConversations(): string {
    if (this.conversations.length === 0) {
      return '<p class="tdm-empty">Nenhuma conversa ainda.</p>';
    }

    return this.conversations.map((c) => {
      const isIncoming = c.incoming;
      const isPrivate  = c.private;
      const from       = c.from_email ?? (isIncoming ? 'Solicitante' : 'Suporte');
      const text       = c.body_text || (c.body ? c.body.replace(/<[^>]*>/g, ' ').trim() : '');
      const truncated  = text.length > 240 ? text.slice(0, 238) + '…' : text;
      const badge      = isPrivate ? '<span class="tdm-conv-badge private">Interno</span>'
                       : isIncoming ? '<span class="tdm-conv-badge incoming">Entrada</span>'
                       : '<span class="tdm-conv-badge reply">Resposta</span>';

      return `
        <div class="tdm-conv-item${isPrivate ? ' private' : ''}">
          <div class="tdm-conv-header">
            <span class="tdm-conv-from">${this._esc(from)}</span>
            ${badge}
            <span class="tdm-conv-date">${this._fmt(c.created_at)}</span>
          </div>
          <div class="tdm-conv-body">${this._esc(truncated)}</div>
        </div>`;
    }).join('');
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  private _bindStaticEvents(): void {
    if (!this.modal) return;

    // Close
    this.modal.querySelector('#tdm-close')?.addEventListener('click', () => this.close());
    this.modal.querySelector('#tdm-footer-close')?.addEventListener('click', () => this.close());

    // Overlay click to close (only on overlay, not card)
    this.container?.addEventListener('click', (e) => {
      if (e.target === this.container) this.close();
    });

    // Comment submit
    this.modal.querySelector('#tdm-comment-submit')?.addEventListener('click', () => this._submitComment());

    // Cancel ticket
    this.modal.querySelector('#tdm-cancel-btn')?.addEventListener('click', () => {
      const confirm = this.modal?.querySelector<HTMLElement>('#tdm-cancel-confirm');
      if (confirm) confirm.style.display = 'flex';
    });
    this.modal.querySelector('#tdm-cancel-no')?.addEventListener('click', () => {
      const confirm = this.modal?.querySelector<HTMLElement>('#tdm-cancel-confirm');
      if (confirm) confirm.style.display = 'none';
    });
    this.modal.querySelector('#tdm-cancel-yes')?.addEventListener('click', () => this._cancelTicket());
  }

  private async _submitComment(): Promise<void> {
    const textarea = this.modal?.querySelector<HTMLTextAreaElement>('#tdm-comment-body');
    const msgEl    = this.modal?.querySelector<HTMLElement>('#tdm-comment-msg');
    const btn      = this.modal?.querySelector<HTMLButtonElement>('#tdm-comment-submit');
    const body     = textarea?.value.trim() ?? '';

    if (!body) {
      this._showMsg(msgEl, 'Escreva um comentário antes de enviar.', 'error');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }

    const result = await addTicketNote(
      this.config.freshdeskDomain,
      this.config.freshdeskApiKey,
      this.ticket.id,
      body,
      false // public
    );

    if (btn) { btn.disabled = false; btn.textContent = 'Enviar Comentário'; }

    if (!result) {
      this._showMsg(msgEl, 'Erro ao enviar comentário. Tente novamente.', 'error');
      return;
    }

    // Success: append to conversations
    this.conversations.push(result);
    const convEl = this.modal?.querySelector<HTMLElement>('#tdm-convs');
    if (convEl) convEl.innerHTML = this._renderConversations();
    if (textarea) textarea.value = '';
    this._showMsg(msgEl, 'Comentário enviado com sucesso!', 'success');

    this.config.onNoteAdded?.(this.ticket.id);
  }

  private async _cancelTicket(): Promise<void> {
    const msgEl  = this.modal?.querySelector<HTMLElement>('#tdm-cancel-msg');
    const yesBtn = this.modal?.querySelector<HTMLButtonElement>('#tdm-cancel-yes');

    if (yesBtn) { yesBtn.disabled = true; yesBtn.textContent = 'Fechando…'; }

    const result = await updateTicket(
      this.config.freshdeskDomain,
      this.config.freshdeskApiKey,
      this.ticket.id,
      { status: 5 } // 5 = closed
    );

    if (!result) {
      if (yesBtn) { yesBtn.disabled = false; yesBtn.textContent = 'Confirmar'; }
      this._showMsg(msgEl, 'Erro ao cancelar. Tente novamente.', 'error');
      return;
    }

    // Update local ticket status
    this.ticket.status = 5;

    // Hide cancel area and comment section, show closed notice
    const cancelArea = this.modal?.querySelector<HTMLElement>('#tdm-cancel-area');
    if (cancelArea) {
      cancelArea.innerHTML = '<div class="tdm-closed-notice">Chamado fechado com sucesso.</div>';
    }
    const commentSection = this.modal?.querySelector<HTMLElement>('#tdm-comment-section');
    if (commentSection) commentSection.style.display = 'none';

    // Update status pill in header
    const pill = this.modal?.querySelector<HTMLElement>('.tdm-status-pill');
    if (pill) {
      pill.textContent = 'Fechado';
      pill.style.background = '#9ca3af22';
      pill.style.color = '#9ca3af';
    }

    this.config.onTicketCancelled?.(this.ticket.id);
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private _esc(s: unknown): string {
    const str = String(s ?? '');
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private _fmt(iso: string | undefined): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch { return iso; }
  }

  private _showMsg(el: HTMLElement | null, text: string, type: 'success' | 'error'): void {
    if (!el) return;
    el.textContent = text;
    el.style.display = '';
    el.style.color = type === 'success' ? '#16a34a' : '#dc2626';
    setTimeout(() => { if (el) el.style.display = 'none'; }, 5000);
  }

  // ==========================================================================
  // Styles
  // ==========================================================================

  private injectStyles(): void {
    const id = 'myio-tdm-styles';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      .tdm-overlay {
        position: fixed; inset: 0; z-index: 10100;
        background: rgba(0,0,0,0.52);
        display: flex; align-items: center; justify-content: center;
        padding: 16px;
        animation: tdm-fade-in 0.18s ease;
      }
      @keyframes tdm-fade-in { from { opacity:0; } to { opacity:1; } }

      .tdm-card {
        background: #fff; border-radius: 12px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.22);
        width: 100%; max-width: 580px;
        max-height: 86vh; min-height: 0;
        display: flex; flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px; color: #1a1a2e;
        animation: tdm-slide-up 0.2s ease;
      }
      @keyframes tdm-slide-up { from { transform: translateY(14px); opacity:0; } to { transform: translateY(0); opacity:1; } }

      /* Header */
      .tdm-header {
        display: flex; align-items: center; gap: 8px;
        padding: 14px 16px 0;
        flex-shrink: 0;
      }
      .tdm-header-left { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
      .tdm-ticket-id { font-size: 12px; color: #6b7280; font-weight: 600; }
      .tdm-status-pill, .tdm-priority-pill {
        font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; white-space: nowrap;
      }
      .tdm-close-btn {
        background: none; border: none; cursor: pointer; padding: 4px;
        color: #9ca3af; border-radius: 6px; display: flex; align-items: center;
        transition: background 0.15s, color 0.15s; flex-shrink: 0;
      }
      .tdm-close-btn:hover { background: #f3f4f6; color: #374151; }

      /* Subject */
      .tdm-subject {
        font-size: 15px; font-weight: 700; color: #111827;
        padding: 8px 16px 10px;
        border-bottom: 1px solid #f0f0f0;
        flex-shrink: 0;
        line-height: 1.3;
      }

      /* Body */
      .tdm-body {
        flex: 1; min-height: 0; overflow-y: auto; padding: 12px 16px;
        display: flex; flex-direction: column; gap: 14px;
      }

      /* Meta grid */
      .tdm-meta-grid {
        display: grid; grid-template-columns: 1fr 1fr;
        gap: 6px 16px;
        background: #f9fafb; border-radius: 8px; padding: 10px 12px;
      }
      .tdm-meta-item { display: flex; flex-direction: column; gap: 1px; }
      .tdm-meta-item--wide { grid-column: 1/-1; }
      .tdm-meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #9ca3af; font-weight: 600; }
      .tdm-meta-value { font-size: 12px; color: #374151; word-break: break-word; }

      /* Sections */
      .tdm-section { display: flex; flex-direction: column; gap: 6px; }
      .tdm-section-title {
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
        color: #9ca3af; font-weight: 700;
      }

      /* Description */
      .tdm-desc-loading { color: #9ca3af; display: flex; align-items: center; gap: 6px; }
      .tdm-desc-html {
        font-size: 13px; color: #374151; line-height: 1.55;
        background: #f9fafb; border-radius: 8px; padding: 10px 12px;
        max-height: 180px; overflow-y: auto;
      }
      .tdm-desc-html img { max-width: 100%; height: auto; }

      /* Conversations */
      .tdm-convs { display: flex; flex-direction: column; gap: 8px; }
      .tdm-conv-item {
        background: #f9fafb; border-radius: 8px; padding: 9px 12px;
        border-left: 3px solid #e5e7eb;
      }
      .tdm-conv-item.private { border-left-color: #a78bfa; background: #f5f3ff; }
      .tdm-conv-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; }
      .tdm-conv-from { font-weight: 600; font-size: 12px; color: #374151; }
      .tdm-conv-date { font-size: 11px; color: #9ca3af; margin-left: auto; }
      .tdm-conv-badge {
        font-size: 10px; padding: 1px 6px; border-radius: 10px; font-weight: 600;
      }
      .tdm-conv-badge.incoming  { background: #dbeafe; color: #1d4ed8; }
      .tdm-conv-badge.reply     { background: #dcfce7; color: #15803d; }
      .tdm-conv-badge.private   { background: #ede9fe; color: #7c3aed; }
      .tdm-conv-body { font-size: 12px; color: #4b5563; line-height: 1.45; white-space: pre-wrap; }

      /* Comment */
      .tdm-comment-textarea {
        width: 100%; box-sizing: border-box;
        border: 1.5px solid #e5e7eb; border-radius: 8px;
        padding: 8px 10px; font-size: 13px; font-family: inherit;
        resize: vertical; min-height: 72px;
        transition: border-color 0.15s;
        color: #1a1a2e;
      }
      .tdm-comment-textarea:focus { outline: none; border-color: #6366f1; }
      .tdm-comment-footer { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

      /* Footer */
      .tdm-footer {
        padding: 10px 16px 14px;
        border-top: 1px solid #f0f0f0;
        display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        flex-shrink: 0;
      }
      #tdm-cancel-area { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .tdm-cancel-confirm {
        display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      }
      .tdm-cancel-confirm-text { font-size: 12px; color: #dc2626; }
      .tdm-closed-notice {
        font-size: 12px; color: #6b7280; font-style: italic;
      }

      /* Buttons */
      .tdm-btn {
        padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
        cursor: pointer; border: none; transition: background 0.15s, opacity 0.15s;
        display: inline-flex; align-items: center; gap: 4px;
      }
      .tdm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .tdm-btn--primary { background: #6366f1; color: #fff; }
      .tdm-btn--primary:hover:not(:disabled) { background: #4f46e5; }
      .tdm-btn--danger  { background: #dc2626; color: #fff; }
      .tdm-btn--danger:hover:not(:disabled)  { background: #b91c1c; }
      .tdm-btn--ghost   { background: #f3f4f6; color: #374151; }
      .tdm-btn--ghost:hover:not(:disabled)   { background: #e5e7eb; }
      .tdm-btn--sm { padding: 4px 10px; font-size: 12px; }

      /* Misc */
      .tdm-empty { color: #9ca3af; font-style: italic; font-size: 12px; }
      .tdm-msg   { font-size: 12px; }
      @keyframes tdm-spin { to { transform: rotate(360deg); } }
      .tdm-spinner {
        display: inline-block; width: 14px; height: 14px;
        border: 2px solid #e5e7eb; border-top-color: #6366f1;
        border-radius: 50%; animation: tdm-spin 0.7s linear infinite;
        vertical-align: middle;
      }
    `;
    document.head.appendChild(s);
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface TicketDetailModalHandle {
  open(): void;
  close(): void;
}

export function createTicketDetailModal(config: TicketDetailModalConfig): TicketDetailModalHandle {
  return new TicketDetailModal(config);
}
