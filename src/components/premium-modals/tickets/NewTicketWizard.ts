/**
 * NewTicketWizard — RFC-0198 Phase 7
 *
 * Multi-step floating modal for opening FreshDesk tickets from the HEADER widget.
 * Supports single-device and multi-device modes. Multi-device creates one parent
 * ticket (first device) + child tickets for remaining devices using parent_id.
 *
 * Steps:
 *   scope → pick-single | pick-multi → form → summary → submitting → done
 *
 * Integration: instantiated via createNewTicketWizard() and exposed on
 * window.MyIOLibrary so the HEADER controller.js can access it without imports.
 */

import { createTicket } from '../../../services/freshdesk/FreshdeskClient';
import type { FreshDeskTicket, TicketTypeId, TicketMotivo } from '../../../services/freshdesk/types';

// ============================================================================
// Types
// ============================================================================

export interface WizardDevice {
  identifier: string;
  label: string;
  /** 'energy' | 'water' | 'temperature' | any string */
  domain: string;
  deviceProfile: string;
}

interface SelectedDevice extends WizardDevice {
  attachments: File[];
}

export interface NewTicketWizardConfig {
  freshdeskDomain: string;
  freshdeskApiKey: string;
  /** Pre-filled read-only email shown in the form */
  requesterEmail: string;
  /** Called at open() time to get a fresh device list */
  getDevices: () => WizardDevice[];
}

type WizardStep =
  | 'scope'
  | 'pick-single'
  | 'pick-multi'
  | 'form'
  | 'summary'
  | 'submitting'
  | 'done';

interface WizardFormData {
  subject: string;
  ticketType: string;     // '1' | '2' | 'outros' | ''
  ticketTypeText: string;
  motivo: string;         // 'Corretivo' | 'Evolutivo' | 'Instalação' | 'Outros' | ''
  motivoText: string;
  description: string;
  email: string;
}

// ============================================================================
// Domain config
// ============================================================================

interface DomainCfg { icon: string; color: string; bg: string; label: string }

const DOMAIN_CFG: Record<string, DomainCfg> = {
  energy:      { icon: '⚡', color: '#d97706', bg: '#fef3c7', label: 'Energia' },
  water:       { icon: '💧', color: '#2563eb', bg: '#dbeafe', label: 'Água' },
  temperature: { icon: '🌡️', color: '#0891b2', bg: '#cffafe', label: 'Temperatura' },
};

function _dc(domain: string): DomainCfg {
  return DOMAIN_CFG[domain] ?? { icon: '📟', color: '#6b7280', bg: '#f3f4f6', label: domain || 'Dispositivo' };
}

function _profileBadge(profile: string): string {
  if (!profile) return '??';
  return profile.replace(/_/g, '').slice(0, 4).toUpperCase();
}

function _esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================================
// Styles
// ============================================================================

const STYLE_ID = 'ntw-styles';

function _injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = NTW_CSS;
  document.head.appendChild(s);
}

const NTW_CSS = `
/* ── Overlay + Modal ───────────────────────────────────────────── */
.ntw-overlay {
  position: fixed; inset: 0; z-index: 99990;
  background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  opacity: 0; transition: opacity .2s;
  pointer-events: none;
}
.ntw-overlay.visible { opacity: 1; pointer-events: auto; }

.ntw-modal {
  background: #fff; border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,.25);
  width: 100%; max-width: 560px;
  max-height: 90vh; display: flex; flex-direction: column;
  transform: translateY(10px); transition: transform .2s;
  overflow: hidden;
}
.ntw-overlay.visible .ntw-modal { transform: translateY(0); }

/* ── Modal Header ──────────────────────────────────────────────── */
.ntw-hdr {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%);
  flex-shrink: 0;
}
.ntw-hdr-icon {
  width: 32px; height: 32px; border-radius: 8px;
  background: #0891b2; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ntw-hdr-icon svg { color: #fff; }
.ntw-hdr-title { font-size: 14px; font-weight: 700; color: #0e7490; flex: 1; }
.ntw-hdr-sub { font-size: 11px; color: #0891b2; }

.ntw-steps {
  display: flex; align-items: center; gap: 4px; margin-right: 8px;
}
.ntw-step-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #a5f3fc; transition: background .2s, transform .2s;
}
.ntw-step-dot.active { background: #0891b2; transform: scale(1.3); }
.ntw-step-dot.done   { background: #0891b2; opacity: .5; }

.ntw-close {
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent; cursor: pointer;
  color: #0e7490; font-size: 16px; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ntw-close:hover { background: rgba(8,145,178,.15); }

/* ── Body ──────────────────────────────────────────────────────── */
.ntw-body {
  flex: 1; overflow-y: auto; padding: 20px 16px 16px;
  min-height: 200px;
}

/* ── Nav bar (back / next / count) ────────────────────────────── */
.ntw-nav {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
}
.ntw-nav-spacer { flex: 1; }
.ntw-btn {
  padding: 7px 16px; border-radius: 7px; font-size: 13px; font-weight: 600;
  cursor: pointer; border: 1px solid transparent; transition: background .15s, opacity .15s;
}
.ntw-btn-back { background: #f3f4f6; color: #374151; border-color: #d1d5db; }
.ntw-btn-back:hover { background: #e5e7eb; }
.ntw-btn-next { background: #0891b2; color: #fff; }
.ntw-btn-next:hover:not(:disabled) { background: #0e7490; }
.ntw-btn-next:disabled { opacity: .45; cursor: not-allowed; }
.ntw-btn-confirm { background: #0891b2; color: #fff; }
.ntw-btn-confirm:hover { background: #0e7490; }
.ntw-btn-close-done { background: #f3f4f6; color: #374151; border-color: #d1d5db; }
.ntw-sel-count { font-size: 12px; color: #6b7280; white-space: nowrap; }

/* ── Step: Scope ────────────────────────────────────────────────── */
.ntw-scope-title {
  font-size: 14px; font-weight: 600; color: #111827;
  margin-bottom: 16px; text-align: center;
}
.ntw-scope-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ntw-scope-card {
  border: 2px solid #e5e7eb; border-radius: 10px; padding: 20px 16px;
  cursor: pointer; text-align: center; transition: border-color .15s, box-shadow .15s;
  user-select: none;
}
.ntw-scope-card:hover { border-color: #0891b2; box-shadow: 0 0 0 3px rgba(8,145,178,.1); }
.ntw-scope-card-icon { font-size: 32px; margin-bottom: 8px; }
.ntw-scope-card-title { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 4px; }
.ntw-scope-card-sub { font-size: 11px; color: #6b7280; }

/* ── Step: Pick Single ──────────────────────────────────────────── */
.ntw-search {
  width: 100%; box-sizing: border-box;
  padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 13px; outline: none; margin-bottom: 12px;
}
.ntw-search:focus { border-color: #0891b2; box-shadow: 0 0 0 3px rgba(8,145,178,.1); }
.ntw-device-list { display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow-y: auto; }

.ntw-device-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px;
  cursor: pointer; transition: border-color .15s, background .15s;
}
.ntw-device-row:hover { border-color: #0891b2; background: #f0f9ff; }

/* ── Step: Pick Multi ───────────────────────────────────────────── */
.ntw-filter-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.ntw-filter-bar .ntw-search { flex: 1; min-width: 160px; margin-bottom: 0; }
.ntw-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.ntw-chip {
  padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
  border: 1px solid #d1d5db; background: #f9fafb; color: #374151; cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
}
.ntw-chip:hover { border-color: #9ca3af; }
.ntw-chip.active { background: #0891b2; border-color: #0891b2; color: #fff; }

.ntw-device-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px; max-height: 320px; overflow-y: auto;
}
.ntw-device-card {
  border: 2px solid #e5e7eb; border-radius: 8px; padding: 10px;
  display: flex; align-items: flex-start; gap: 8px;
  cursor: pointer; transition: border-color .15s;
  position: relative;
}
.ntw-device-card:hover { border-color: #93c5fd; }
.ntw-device-card.selected { border-color: #0891b2; background: #f0f9ff; }
.ntw-device-card-main { flex: 1; min-width: 0; }

.ntw-cb { width: 16px; height: 16px; border-radius: 4px; cursor: pointer; flex-shrink: 0; margin-top: 2px; accent-color: #0891b2; }

.ntw-device-name {
  font-size: 12px; font-weight: 700; color: #111827;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ntw-device-label { font-size: 11px; color: #6b7280; margin-top: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.ntw-clip-btn {
  display: flex; align-items: center; gap: 3px;
  padding: 3px 6px; border-radius: 5px; border: 1px solid #d1d5db;
  background: #f9fafb; color: #6b7280; font-size: 10px; cursor: pointer;
  flex-shrink: 0; margin-top: auto; transition: border-color .15s, color .15s;
  white-space: nowrap;
}
.ntw-clip-btn:hover { border-color: #0891b2; color: #0891b2; }
.ntw-clip-btn.has-files { border-color: #0891b2; color: #0891b2; background: #ecfeff; }

/* ── Domain + Profile badges ─────────────────────────────────────── */
.ntw-domain-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
}
.ntw-profile-badge {
  font-size: 9px; font-weight: 800; padding: 1px 4px; border-radius: 4px;
  letter-spacing: .5px; flex-shrink: 0;
}

/* ── Step: Form ────────────────────────────────────────────────── */
.ntw-form-group { margin-bottom: 14px; }
.ntw-form-label { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 5px; }
.ntw-form-input, .ntw-form-select, .ntw-form-textarea {
  width: 100%; box-sizing: border-box;
  padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 7px;
  font-size: 13px; color: #111827; background: #fff; outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.ntw-form-input:focus, .ntw-form-select:focus, .ntw-form-textarea:focus {
  border-color: #0891b2; box-shadow: 0 0 0 3px rgba(8,145,178,.1);
}
.ntw-form-input--readonly { background: #f3f4f6; color: #6b7280; cursor: not-allowed; }
.ntw-form-textarea { resize: vertical; min-height: 80px; }
.ntw-form-error { border-color: #dc2626 !important; box-shadow: 0 0 0 3px rgba(220,38,38,.1) !important; }

.ntw-form-msg {
  font-size: 12px; color: #dc2626; padding: 8px 10px;
  background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px;
  margin-bottom: 10px; display: none;
}
.ntw-form-msg.visible { display: block; }

/* ── Attachments (single-device form) ──────────────────────────── */
.ntw-upload-zone { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ntw-upload-btn {
  padding: 6px 12px; border-radius: 7px; font-size: 12px;
  border: 1px solid #d1d5db; background: #f9fafb; color: #374151; cursor: pointer;
}
.ntw-upload-btn:hover { border-color: #9ca3af; }
.ntw-files-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.ntw-file-tag {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 20px; font-size: 11px;
  background: #f3f4f6; border: 1px solid #e5e7eb; color: #374151;
}
.ntw-file-remove {
  color: #6b7280; cursor: pointer; font-size: 13px; line-height: 1;
  background: none; border: none; padding: 0;
}
.ntw-file-remove:hover { color: #dc2626; }

/* ── Step: Summary ─────────────────────────────────────────────── */
.ntw-summary-section { margin-bottom: 16px; }
.ntw-summary-title { font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
.ntw-summary-card {
  border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px;
  font-size: 13px; color: #111827; background: #fafafa;
}
.ntw-summary-row { display: flex; gap: 8px; margin-bottom: 6px; }
.ntw-summary-row:last-child { margin-bottom: 0; }
.ntw-summary-key { color: #6b7280; min-width: 120px; flex-shrink: 0; font-size: 12px; }
.ntw-summary-val { font-weight: 600; word-break: break-word; font-size: 12px; }

.ntw-devices-list { display: flex; flex-direction: column; gap: 6px; }
.ntw-summary-device {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 7px;
  font-size: 12px; background: #fafafa;
}
.ntw-summary-device-main { flex: 1; min-width: 0; }
.ntw-summary-device-id { font-weight: 700; color: #111827; }
.ntw-summary-device-label { color: #6b7280; }
.ntw-parent-badge {
  font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px;
  background: #0891b2; color: #fff; flex-shrink: 0;
}
.ntw-child-badge {
  font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px;
  background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; flex-shrink: 0;
}
.ntw-att-count { font-size: 10px; color: #0891b2; flex-shrink: 0; }

.ntw-warning {
  margin-top: 12px; padding: 10px 12px; border-radius: 7px;
  background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 12px;
}

/* ── Step: Submitting ───────────────────────────────────────────── */
.ntw-progress-wrap {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 20px; gap: 16px;
}
.ntw-spinner {
  width: 36px; height: 36px; border: 3px solid #a5f3fc; border-top-color: #0891b2;
  border-radius: 50%; animation: ntw-spin .8s linear infinite;
}
@keyframes ntw-spin { to { transform: rotate(360deg); } }
.ntw-progress-text { font-size: 14px; color: #0e7490; font-weight: 600; }
.ntw-progress-sub { font-size: 12px; color: #6b7280; }

/* ── Step: Done ─────────────────────────────────────────────────── */
.ntw-done-wrap { padding: 8px 0; }
.ntw-done-title { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 14px; text-align: center; }
.ntw-done-results { display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow-y: auto; }
.ntw-done-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  border-radius: 7px; border: 1px solid #e5e7eb; font-size: 12px;
}
.ntw-done-row.ok  { border-color: #bbf7d0; background: #f0fdf4; }
.ntw-done-row.err { border-color: #fca5a5; background: #fef2f2; }
.ntw-done-icon { font-size: 14px; flex-shrink: 0; }
.ntw-done-device { flex: 1; min-width: 0; }
.ntw-done-device-id { font-weight: 700; color: #111827; }
.ntw-done-device-lbl { color: #6b7280; }
.ntw-done-ticket-id { font-size: 11px; color: #16a34a; }
.ntw-done-err-msg { font-size: 11px; color: #dc2626; }
.ntw-done-footer { margin-top: 14px; text-align: center; }

/* ── Empty state ────────────────────────────────────────────────── */
.ntw-empty { text-align: center; padding: 30px 20px; color: #9ca3af; font-size: 13px; }
`;

// ============================================================================
// NewTicketWizard class
// ============================================================================

export class NewTicketWizard {
  private _cfg: NewTicketWizardConfig;
  private _overlay: HTMLElement | null = null;

  // Wizard state (reset on open)
  private _step: WizardStep = 'scope';
  private _scope: 'single' | 'multi' | null = null;
  private _allDevices: WizardDevice[] = [];
  private _filterDomain = 'all';
  private _searchQuery = '';
  private _selectedIds = new Set<string>();
  private _singleDevice: WizardDevice | null = null;
  private _deviceFiles = new Map<string, File[]>();
  private _singleFiles: File[] = [];
  private _form: WizardFormData | null = null;

  constructor(cfg: NewTicketWizardConfig) {
    this._cfg = cfg;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  open(): void {
    _injectStyles();
    this._reset();
    this._allDevices = this._cfg.getDevices();
    this._buildDOM();
    this._goTo('scope');
    requestAnimationFrame(() => this._overlay?.classList.add('visible'));
  }

  close(): void {
    if (!this._overlay) return;
    this._overlay.classList.remove('visible');
    setTimeout(() => {
      this._overlay?.remove();
      this._overlay = null;
    }, 220);
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private _reset(): void {
    this._step = 'scope';
    this._scope = null;
    this._filterDomain = 'all';
    this._searchQuery = '';
    this._selectedIds.clear();
    this._singleDevice = null;
    this._deviceFiles.clear();
    this._singleFiles = [];
    this._form = null;
  }

  private _buildDOM(): void {
    this._overlay?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'ntw-overlay';
    overlay.id = 'ntw-overlay';
    overlay.innerHTML = `
      <div class="ntw-modal" id="ntw-modal">
        <div class="ntw-hdr">
          <div class="ntw-hdr-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
            </svg>
          </div>
          <div style="flex:1;">
            <div class="ntw-hdr-title">Novo Chamado</div>
            <div class="ntw-hdr-sub" id="ntw-hdr-sub">Escolha o escopo</div>
          </div>
          <div class="ntw-steps" id="ntw-steps">
            <div class="ntw-step-dot active" data-idx="0"></div>
            <div class="ntw-step-dot" data-idx="1"></div>
            <div class="ntw-step-dot" data-idx="2"></div>
            <div class="ntw-step-dot" data-idx="3"></div>
          </div>
          <button class="ntw-close" id="ntw-close" title="Fechar">✕</button>
        </div>
        <div id="ntw-content"></div>
      </div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
    overlay.querySelector('#ntw-close')!.addEventListener('click', () => this.close());
    document.body.appendChild(overlay);
    this._overlay = overlay;
  }

  private _content(): HTMLElement {
    return this._overlay!.querySelector('#ntw-content')!;
  }

  private _goTo(step: WizardStep): void {
    this._step = step;
    this._updateStepIndicator();
    const c = this._content();
    c.innerHTML = '';

    switch (step) {
      case 'scope':       this._renderScope(c);       break;
      case 'pick-single': this._renderPickSingle(c);  break;
      case 'pick-multi':  this._renderPickMulti(c);   break;
      case 'form':        this._renderForm(c);        break;
      case 'summary':     this._renderSummary(c);     break;
      case 'submitting':  this._renderSubmitting(c);  break;
      case 'done':        break; // rendered separately
    }
  }

  private _updateStepIndicator(): void {
    const idx = { scope: 0, 'pick-single': 1, 'pick-multi': 1, form: 2, summary: 3, submitting: 3, done: 3 }[this._step] ?? 0;
    const subs = { scope: 'Escolha o escopo', 'pick-single': 'Selecione o dispositivo', 'pick-multi': 'Selecione os dispositivos', form: 'Preencha o formulário', summary: 'Revise e confirme', submitting: 'Criando chamados…', done: 'Concluído' }[this._step] ?? '';
    this._overlay?.querySelector('#ntw-hdr-sub')?.setAttribute('data-text', subs);
    (this._overlay?.querySelector('#ntw-hdr-sub') as HTMLElement | null)!.textContent = subs;
    this._overlay?.querySelectorAll('.ntw-step-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === idx);
      dot.classList.toggle('done', i < idx);
    });
  }

  // --------------------------------------------------------------------------
  // Step: Scope
  // --------------------------------------------------------------------------

  private _renderScope(c: HTMLElement): void {
    c.innerHTML = `
      <div class="ntw-body">
        <div class="ntw-scope-title">Para qual dispositivo você quer abrir o chamado?</div>
        <div class="ntw-scope-cards">
          <div class="ntw-scope-card" data-scope="single">
            <div class="ntw-scope-card-icon">🎯</div>
            <div class="ntw-scope-card-title">Um dispositivo</div>
            <div class="ntw-scope-card-sub">Selecione um device específico da lista</div>
          </div>
          <div class="ntw-scope-card" data-scope="multi">
            <div class="ntw-scope-card-icon">📋</div>
            <div class="ntw-scope-card-title">Múltiplos dispositivos</div>
            <div class="ntw-scope-card-sub">Cria chamado pai + filhos para cada device</div>
          </div>
        </div>
      </div>`;
    c.querySelectorAll('.ntw-scope-card').forEach((card) => {
      card.addEventListener('click', () => {
        this._scope = (card as HTMLElement).dataset.scope as 'single' | 'multi';
        this._goTo(this._scope === 'single' ? 'pick-single' : 'pick-multi');
      });
    });
  }

  // --------------------------------------------------------------------------
  // Step: Pick Single
  // --------------------------------------------------------------------------

  private _renderPickSingle(c: HTMLElement): void {
    c.innerHTML = `
      <div class="ntw-body">
        <input class="ntw-search" id="ntw-search-s" placeholder="🔍 Buscar dispositivo…" autocomplete="off">
        <div class="ntw-device-list" id="ntw-list-s"></div>
      </div>
      <div class="ntw-nav">
        <button class="ntw-btn ntw-btn-back" id="ntw-back-s">← Voltar</button>
      </div>`;

    c.querySelector('#ntw-back-s')!.addEventListener('click', () => this._goTo('scope'));

    const list = c.querySelector('#ntw-list-s') as HTMLElement;
    const renderList = (q: string) => {
      const devs = this._filteredDevices(q, 'all');
      if (!devs.length) { list.innerHTML = `<div class="ntw-empty">Nenhum dispositivo encontrado.</div>`; return; }
      list.innerHTML = devs.map(d => this._deviceRowHTML(d)).join('');
      list.querySelectorAll('.ntw-device-row').forEach((row) => {
        row.addEventListener('click', () => {
          this._singleDevice = this._allDevices.find(d => d.identifier === (row as HTMLElement).dataset.id)!;
          this._goTo('form');
        });
      });
    };
    renderList('');
    (c.querySelector('#ntw-search-s') as HTMLInputElement).addEventListener('input', (e) => {
      renderList((e.target as HTMLInputElement).value);
    });
  }

  private _deviceRowHTML(d: WizardDevice): string {
    const dc = _dc(d.domain);
    return `
      <div class="ntw-device-row" data-id="${_esc(d.identifier)}">
        <div class="ntw-domain-dot" style="background:${dc.color};"></div>
        <span class="ntw-profile-badge" style="background:${dc.bg};color:${dc.color};">${_esc(_profileBadge(d.deviceProfile))}</span>
        <div style="flex:1;min-width:0;">
          <div class="ntw-device-name">${_esc(d.identifier)}</div>
          <div class="ntw-device-label">${_esc(d.label)}</div>
        </div>
        <span style="font-size:11px;color:#9ca3af;">${dc.icon} ${_esc(dc.label)}</span>
      </div>`;
  }

  // --------------------------------------------------------------------------
  // Step: Pick Multi
  // --------------------------------------------------------------------------

  private _renderPickMulti(c: HTMLElement): void {
    c.innerHTML = `
      <div class="ntw-body">
        <div class="ntw-filter-bar">
          <input class="ntw-search" id="ntw-search-m" placeholder="🔍 Buscar…" autocomplete="off">
          <div class="ntw-chips" id="ntw-chips">
            <button class="ntw-chip active" data-domain="all">Todos</button>
            <button class="ntw-chip" data-domain="energy">⚡ Energia</button>
            <button class="ntw-chip" data-domain="water">💧 Água</button>
            <button class="ntw-chip" data-domain="temperature">🌡️ Temp.</button>
          </div>
        </div>
        <div class="ntw-device-grid" id="ntw-grid-m"></div>
      </div>
      <div class="ntw-nav">
        <button class="ntw-btn ntw-btn-back" id="ntw-back-m">← Voltar</button>
        <span class="ntw-sel-count" id="ntw-sel-count">0 selecionados</span>
        <div class="ntw-nav-spacer"></div>
        <button class="ntw-btn ntw-btn-next" id="ntw-next-m" disabled>Próximo →</button>
      </div>`;

    c.querySelector('#ntw-back-m')!.addEventListener('click', () => this._goTo('scope'));
    c.querySelector('#ntw-next-m')!.addEventListener('click', () => this._goTo('form'));

    // Domain chips
    c.querySelectorAll('.ntw-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        c.querySelectorAll('.ntw-chip').forEach(ch => ch.classList.remove('active'));
        chip.classList.add('active');
        this._filterDomain = (chip as HTMLElement).dataset.domain ?? 'all';
        this._renderGrid(c);
      });
    });

    // Search
    (c.querySelector('#ntw-search-m') as HTMLInputElement).addEventListener('input', (e) => {
      this._searchQuery = (e.target as HTMLInputElement).value;
      this._renderGrid(c);
    });

    this._renderGrid(c);
  }

  private _renderGrid(c: HTMLElement): void {
    const grid = c.querySelector('#ntw-grid-m') as HTMLElement;
    const devs = this._filteredDevices(this._searchQuery, this._filterDomain);

    if (!devs.length) { grid.innerHTML = `<div class="ntw-empty" style="grid-column:1/-1">Nenhum dispositivo encontrado.</div>`; return; }

    grid.innerHTML = devs.map(d => this._deviceCardHTML(d)).join('');

    // Bind checkboxes + card clicks
    grid.querySelectorAll('.ntw-device-card').forEach((card) => {
      const id = (card as HTMLElement).dataset.id!;
      const cb = card.querySelector('.ntw-cb') as HTMLInputElement;
      cb.checked = this._selectedIds.has(id);

      const toggle = () => {
        if (this._selectedIds.has(id)) this._selectedIds.delete(id);
        else this._selectedIds.add(id);
        cb.checked = this._selectedIds.has(id);
        card.classList.toggle('selected', this._selectedIds.has(id));
        this._updateMultiNav(c);
      };
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.ntw-clip-btn')) return;
        toggle();
      });
    });

    // Bind clip buttons
    grid.querySelectorAll('.ntw-clip-btn').forEach((btn) => {
      const id = (btn as HTMLElement).dataset.id!;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._openFilePicker(id, btn as HTMLElement);
      });
    });

    this._updateMultiNav(c);
  }

  private _deviceCardHTML(d: WizardDevice): string {
    const dc = _dc(d.domain);
    const sel = this._selectedIds.has(d.identifier);
    const files = this._deviceFiles.get(d.identifier) ?? [];
    const hasFiles = files.length > 0;
    return `
      <div class="ntw-device-card${sel ? ' selected' : ''}" data-id="${_esc(d.identifier)}">
        <input type="checkbox" class="ntw-cb" ${sel ? 'checked' : ''} onclick="event.stopPropagation()">
        <div class="ntw-device-card-main">
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;">
            <div class="ntw-domain-dot" style="background:${dc.color};"></div>
            <span class="ntw-profile-badge" style="background:${dc.bg};color:${dc.color};">${_esc(_profileBadge(d.deviceProfile))}</span>
            <span style="font-size:10px;color:#9ca3af;">${dc.icon}</span>
          </div>
          <div class="ntw-device-name" title="${_esc(d.identifier)}">${_esc(d.identifier)}</div>
          <div class="ntw-device-label" title="${_esc(d.label)}">${_esc(d.label)}</div>
          <button type="button" class="ntw-clip-btn${hasFiles ? ' has-files' : ''}" data-id="${_esc(d.identifier)}" title="Anexar arquivos a este dispositivo">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            ${hasFiles ? `${files.length}` : ''}
          </button>
        </div>
      </div>`;
  }

  private _openFilePicker(deviceId: string, btn: HTMLElement): void {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt';
    inp.onchange = () => {
      const existing = this._deviceFiles.get(deviceId) ?? [];
      const newFiles = Array.from(inp.files ?? []);
      this._deviceFiles.set(deviceId, [...existing, ...newFiles]);
      // Update the clip button in-place
      const grid = this._overlay?.querySelector('#ntw-grid-m');
      if (grid) this._renderGrid(this._overlay!.querySelector('#ntw-content') as HTMLElement);
    };
    inp.click();
  }

  private _updateMultiNav(c: HTMLElement): void {
    const count = this._selectedIds.size;
    (c.querySelector('#ntw-sel-count') as HTMLElement).textContent = `${count} selecionado${count !== 1 ? 's' : ''}`;
    (c.querySelector('#ntw-next-m') as HTMLButtonElement).disabled = count === 0;
  }

  // --------------------------------------------------------------------------
  // Step: Form
  // --------------------------------------------------------------------------

  private _renderForm(c: HTMLElement): void {
    const isMulti = this._scope === 'multi';
    const defaultSubject = isMulti
      ? ''
      : this._singleDevice
        ? `[${this._singleDevice.identifier}] ${this._singleDevice.label}`.trim()
        : '';
    const email = _esc(this._cfg.requesterEmail);

    c.innerHTML = `
      <div class="ntw-body">
        <div class="ntw-form-msg" id="ntw-form-msg"></div>
        <div class="ntw-form-group">
          <label class="ntw-form-label" for="ntw-subject">Assunto <span style="color:#dc2626">*</span></label>
          <input type="text" id="ntw-subject" class="ntw-form-input" value="${_esc(defaultSubject)}" maxlength="255" placeholder="Descreva o problema…">
        </div>
        <div class="ntw-form-group">
          <label class="ntw-form-label" for="ntw-ticket-type">Tipo de chamado <span style="color:#dc2626">*</span></label>
          <select id="ntw-ticket-type" class="ntw-form-select">
            <option value="">Selecione…</option>
            <option value="1">Software / Dashboard</option>
            <option value="2">Instalação</option>
            <option value="outros">Outros</option>
          </select>
          <input type="text" id="ntw-ticket-type-outros" class="ntw-form-input"
                 placeholder="Descreva o tipo de chamado…" style="display:none;margin-top:6px;" maxlength="100">
        </div>
        <div class="ntw-form-group">
          <label class="ntw-form-label" for="ntw-motivo">Motivo <span style="color:#dc2626">*</span></label>
          <select id="ntw-motivo" class="ntw-form-select">
            <option value="">Selecione…</option>
            <option value="Corretivo">Corretivo</option>
            <option value="Evolutivo">Evolutivo</option>
            <option value="Instalação">Instalação</option>
            <option value="Outros">Outros</option>
          </select>
          <input type="text" id="ntw-motivo-outros" class="ntw-form-input"
                 placeholder="Descreva o motivo…" style="display:none;margin-top:6px;" maxlength="100">
        </div>
        <div class="ntw-form-group">
          <label class="ntw-form-label" for="ntw-description">Descrição</label>
          <textarea id="ntw-description" class="ntw-form-textarea" rows="3"
                    placeholder="Detalhes adicionais sobre o problema ou solicitação…"></textarea>
        </div>
        <div class="ntw-form-group">
          <label class="ntw-form-label" for="ntw-email">E-mail do solicitante <span style="color:#dc2626">*</span></label>
          <input type="email" id="ntw-email" class="ntw-form-input ntw-form-input--readonly"
                 value="${email}" readonly placeholder="usuario@empresa.com">
        </div>
        ${!isMulti ? this._attachmentHTML() : ''}
      </div>
      <div class="ntw-nav">
        <button class="ntw-btn ntw-btn-back" id="ntw-back-f">← Voltar</button>
        <div class="ntw-nav-spacer"></div>
        <button class="ntw-btn ntw-btn-next" id="ntw-next-f">Próximo →</button>
      </div>`;

    c.querySelector('#ntw-back-f')!.addEventListener('click', () =>
      this._goTo(this._scope === 'single' ? 'pick-single' : 'pick-multi'));
    c.querySelector('#ntw-next-f')!.addEventListener('click', () => this._validateAndAdvance(c));

    // Outros toggles
    (c.querySelector('#ntw-ticket-type') as HTMLSelectElement).addEventListener('change', (e) => {
      const inp = c.querySelector('#ntw-ticket-type-outros') as HTMLElement;
      inp.style.display = (e.target as HTMLSelectElement).value === 'outros' ? '' : 'none';
    });
    (c.querySelector('#ntw-motivo') as HTMLSelectElement).addEventListener('change', (e) => {
      const inp = c.querySelector('#ntw-motivo-outros') as HTMLElement;
      inp.style.display = (e.target as HTMLSelectElement).value === 'Outros' ? '' : 'none';
    });

    // Attachments (single mode)
    if (!isMulti) this._bindAttachments(c);
  }

  private _attachmentHTML(): string {
    const files = this._singleFiles;
    const tags = files.map((f, i) =>
      `<span class="ntw-file-tag">${_esc(f.name)}<button type="button" class="ntw-file-remove" data-idx="${i}">×</button></span>`
    ).join('');
    return `
      <div class="ntw-form-group">
        <label class="ntw-form-label">Anexos</label>
        <input type="file" id="ntw-file-inp" hidden multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt">
        <div class="ntw-upload-zone">
          <button type="button" class="ntw-upload-btn" id="ntw-upload-btn">📎 Escolher arquivos</button>
          <span style="font-size:11px;color:#9ca3af;">Opcional</span>
        </div>
        <div class="ntw-files-preview" id="ntw-files-preview">${tags}</div>
      </div>`;
  }

  private _bindAttachments(c: HTMLElement): void {
    const inp = c.querySelector('#ntw-file-inp') as HTMLInputElement;
    c.querySelector('#ntw-upload-btn')?.addEventListener('click', () => inp?.click());
    inp?.addEventListener('change', () => {
      this._singleFiles = [...this._singleFiles, ...Array.from(inp.files ?? [])];
      inp.value = '';
      const prev = c.querySelector('#ntw-files-preview') as HTMLElement;
      if (!prev) return;
      prev.innerHTML = this._singleFiles.map((f, i) =>
        `<span class="ntw-file-tag">${_esc(f.name)}<button type="button" class="ntw-file-remove" data-idx="${i}">×</button></span>`
      ).join('');
      prev.querySelectorAll('.ntw-file-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt((btn as HTMLElement).dataset.idx ?? '0', 10);
          this._singleFiles.splice(idx, 1);
          this._bindAttachments(c); // re-render file list
          // re-bind remove buttons
          (c.querySelector('#ntw-files-preview') as HTMLElement).innerHTML = this._singleFiles.map((f, i) =>
            `<span class="ntw-file-tag">${_esc(f.name)}<button type="button" class="ntw-file-remove" data-idx="${i}">×</button></span>`
          ).join('');
        });
      });
    });
  }

  private _validateAndAdvance(c: HTMLElement): void {
    const get = (id: string) => (c.querySelector(id) as HTMLInputElement | null)?.value?.trim() ?? '';
    const subject = get('#ntw-subject');
    const ticketType = get('#ntw-ticket-type');
    const ticketTypeText = get('#ntw-ticket-type-outros');
    const motivo = get('#ntw-motivo');
    const motivoText = get('#ntw-motivo-outros');
    const description = get('#ntw-description');
    const email = get('#ntw-email');

    const missing: string[] = [];
    if (!subject)     missing.push('Assunto');
    if (!ticketType)  missing.push('Tipo de chamado');
    if (ticketType === 'outros' && !ticketTypeText) missing.push('Tipo (descrição)');
    if (!motivo)      missing.push('Motivo');
    if (motivo === 'Outros' && !motivoText) missing.push('Motivo (descrição)');
    if (!email)       missing.push('E-mail do solicitante');

    const msgEl = c.querySelector('#ntw-form-msg') as HTMLElement;
    if (missing.length) {
      msgEl.textContent = `Obrigatório: ${missing.join(', ')}`;
      msgEl.classList.add('visible');
      // mark error fields
      [
        [!subject, '#ntw-subject'],
        [!ticketType, '#ntw-ticket-type'],
        [ticketType === 'outros' && !ticketTypeText, '#ntw-ticket-type-outros'],
        [!motivo, '#ntw-motivo'],
        [motivo === 'Outros' && !motivoText, '#ntw-motivo-outros'],
        [!email, '#ntw-email'],
      ].forEach(([cond, sel]) => {
        const el = c.querySelector(sel as string);
        if (cond) el?.classList.add('ntw-form-error');
        else el?.classList.remove('ntw-form-error');
      });
      return;
    }
    msgEl.classList.remove('visible');

    this._form = { subject, ticketType, ticketTypeText, motivo, motivoText, description, email };
    this._goTo('summary');
  }

  // --------------------------------------------------------------------------
  // Step: Summary
  // --------------------------------------------------------------------------

  private _renderSummary(c: HTMLElement): void {
    const f = this._form!;
    const devices = this._buildSelectedDevices();
    const n = devices.length;

    const ticketTypeLabel = f.ticketType === '1' ? 'Software / Dashboard'
                          : f.ticketType === '2' ? 'Instalação'
                          : f.ticketType === 'outros' ? f.ticketTypeText
                          : '—';
    const motivoLabel = f.motivo === 'Outros' ? f.motivoText : (f.motivo || '—');

    const deviceRows = devices.map((d, i) => {
      const dc = _dc(d.domain);
      const files = d.attachments;
      return `
        <div class="ntw-summary-device">
          <div class="ntw-domain-dot" style="background:${dc.color};"></div>
          <span class="ntw-profile-badge" style="background:${dc.bg};color:${dc.color};">${_esc(_profileBadge(d.deviceProfile))}</span>
          <div class="ntw-summary-device-main">
            <div class="ntw-summary-device-id">${_esc(d.identifier)}</div>
            <div class="ntw-summary-device-label">${_esc(d.label)}</div>
          </div>
          ${i === 0 ? `<span class="ntw-parent-badge">PAI</span>` : `<span class="ntw-child-badge">FILHO</span>`}
          ${files.length > 0 ? `<span class="ntw-att-count">📎 ${files.length}</span>` : ''}
        </div>`;
    }).join('');

    c.innerHTML = `
      <div class="ntw-body">
        <div class="ntw-summary-section">
          <div class="ntw-summary-title">Formulário</div>
          <div class="ntw-summary-card">
            <div class="ntw-summary-row"><span class="ntw-summary-key">Assunto</span><span class="ntw-summary-val">${_esc(f.subject)}</span></div>
            <div class="ntw-summary-row"><span class="ntw-summary-key">Tipo de chamado</span><span class="ntw-summary-val">${_esc(ticketTypeLabel)}</span></div>
            <div class="ntw-summary-row"><span class="ntw-summary-key">Motivo</span><span class="ntw-summary-val">${_esc(motivoLabel)}</span></div>
            ${f.description ? `<div class="ntw-summary-row"><span class="ntw-summary-key">Descrição</span><span class="ntw-summary-val">${_esc(f.description)}</span></div>` : ''}
            <div class="ntw-summary-row"><span class="ntw-summary-key">E-mail</span><span class="ntw-summary-val">${_esc(f.email)}</span></div>
          </div>
        </div>
        <div class="ntw-summary-section">
          <div class="ntw-summary-title">Dispositivos (${n})</div>
          <div class="ntw-devices-list">${deviceRows}</div>
        </div>
        ${n > 1 ? `<div class="ntw-warning">⚠️ Serão criados <strong>${n} chamados</strong>. O primeiro será o chamado pai e os demais serão filhos vinculados a ele.</div>` : ''}
      </div>
      <div class="ntw-nav">
        <button class="ntw-btn ntw-btn-back" id="ntw-back-sum">← Voltar</button>
        <div class="ntw-nav-spacer"></div>
        <button class="ntw-btn ntw-btn-confirm" id="ntw-confirm">
          Criar ${n} chamado${n !== 1 ? 's' : ''}
        </button>
      </div>`;

    c.querySelector('#ntw-back-sum')!.addEventListener('click', () => this._goTo('form'));
    c.querySelector('#ntw-confirm')!.addEventListener('click', () => this._submit());
  }

  // --------------------------------------------------------------------------
  // Step: Submitting
  // --------------------------------------------------------------------------

  private _renderSubmitting(c: HTMLElement): void {
    c.innerHTML = `
      <div class="ntw-body">
        <div class="ntw-progress-wrap">
          <div class="ntw-spinner"></div>
          <div class="ntw-progress-text" id="ntw-prog-text">Preparando…</div>
          <div class="ntw-progress-sub" id="ntw-prog-sub"></div>
        </div>
      </div>`;
  }

  private _updateProgress(current: number, total: number, deviceId: string): void {
    const txt = this._overlay?.querySelector('#ntw-prog-text') as HTMLElement | null;
    const sub = this._overlay?.querySelector('#ntw-prog-sub') as HTMLElement | null;
    if (txt) txt.textContent = `Criando chamado ${current}/${total}…`;
    if (sub) sub.textContent = deviceId;
  }

  // --------------------------------------------------------------------------
  // Submit
  // --------------------------------------------------------------------------

  private async _submit(): Promise<void> {
    this._goTo('submitting');
    const { freshdeskDomain, freshdeskApiKey } = this._cfg;
    const f = this._form!;
    const devices = this._buildSelectedDevices();

    // Resolve ticket type / motivo
    const ticketType: TicketTypeId | undefined =
      f.ticketType === '1' ? 1 : f.ticketType === '2' ? 2 : undefined;
    const motivo: TicketMotivo | undefined =
      f.motivo === 'Corretivo' ? 'Corretivo' :
      f.motivo === 'Evolutivo' ? 'Evolutivo' :
      f.motivo === 'Instalação' ? 'Instalação' : undefined;

    // Build full description
    const descParts: string[] = [];
    if (f.description) descParts.push(f.description);
    if (f.ticketType === 'outros' && f.ticketTypeText) descParts.push(`[Tipo: ${f.ticketTypeText}]`);
    if (f.motivo === 'Outros' && f.motivoText) descParts.push(`[Motivo: ${f.motivoText}]`);
    const description = descParts.join('\n\n');

    interface TicketResult { device: SelectedDevice; ticket: FreshDeskTicket | null }
    const results: TicketResult[] = [];
    let parentId: number | undefined;

    for (let i = 0; i < devices.length; i++) {
      const dev = devices[i];
      this._updateProgress(i + 1, devices.length, dev.identifier);

      const ticket = await createTicket(
        freshdeskDomain, freshdeskApiKey,
        f.subject, dev.identifier, f.email,
        {
          description,
          ticketType,
          motivo,
          attachments: dev.attachments.length > 0 ? dev.attachments : undefined,
          parent_id: i > 0 && parentId !== undefined ? parentId : undefined,
        }
      );

      if (i === 0 && ticket) parentId = ticket.id;
      results.push({ device: dev, ticket });
    }

    // Trigger orchestrator refresh so badge updates
    try {
      (window as unknown as { TicketServiceOrchestrator?: { refresh?: () => void } })
        .TicketServiceOrchestrator?.refresh?.();
    } catch { /* ignore */ }

    this._renderDone(results);
  }

  // --------------------------------------------------------------------------
  // Step: Done
  // --------------------------------------------------------------------------

  private _renderDone(results: { device: SelectedDevice; ticket: FreshDeskTicket | null }[]): void {
    const c = this._content();
    const allOk = results.every(r => r.ticket !== null);
    const anyOk = results.some(r => r.ticket !== null);

    const rows = results.map((r, i) => {
      const dc = _dc(r.device.domain);
      const ok = r.ticket !== null;
      return `
        <div class="ntw-done-row ${ok ? 'ok' : 'err'}">
          <span class="ntw-done-icon">${ok ? '✅' : '❌'}</span>
          <div class="ntw-domain-dot" style="background:${dc.color};"></div>
          <span class="ntw-profile-badge" style="background:${dc.bg};color:${dc.color};">${_esc(_profileBadge(r.device.deviceProfile))}</span>
          <div class="ntw-done-device">
            <div class="ntw-done-device-id">${_esc(r.device.identifier)}</div>
            <div class="ntw-done-device-lbl">${_esc(r.device.label)}</div>
            ${ok ? `<div class="ntw-done-ticket-id">Chamado #${r.ticket!.id}${i === 0 && results.length > 1 ? ' (pai)' : i > 0 ? ' (filho)' : ''}</div>` : ''}
            ${!ok ? `<div class="ntw-done-err-msg">Falha ao criar chamado — verifique a configuração da API</div>` : ''}
          </div>
        </div>`;
    }).join('');

    const title = allOk
      ? `✅ ${results.length} chamado${results.length !== 1 ? 's' : ''} criado${results.length !== 1 ? 's' : ''} com sucesso!`
      : anyOk
      ? `⚠️ Criação parcial — alguns chamados falharam`
      : `❌ Falha ao criar chamados`;

    c.innerHTML = `
      <div class="ntw-body">
        <div class="ntw-done-wrap">
          <div class="ntw-done-title">${title}</div>
          <div class="ntw-done-results">${rows}</div>
          <div class="ntw-done-footer">
            <button class="ntw-btn ntw-btn-close-done" id="ntw-close-done">Fechar</button>
          </div>
        </div>
      </div>`;

    c.querySelector('#ntw-close-done')!.addEventListener('click', () => this.close());
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private _buildSelectedDevices(): SelectedDevice[] {
    if (this._scope === 'single' && this._singleDevice) {
      return [{ ...this._singleDevice, attachments: this._singleFiles }];
    }
    // Multi: preserve insertion order via _selectedIds iteration
    return Array.from(this._selectedIds)
      .map(id => this._allDevices.find(d => d.identifier === id))
      .filter((d): d is WizardDevice => d !== undefined)
      .map(d => ({ ...d, attachments: this._deviceFiles.get(d.identifier) ?? [] }));
  }

  private _filteredDevices(query: string, domain: string): WizardDevice[] {
    const q = query.toLowerCase();
    return this._allDevices.filter(d => {
      if (domain !== 'all' && d.domain !== domain) return false;
      if (!q) return true;
      return d.identifier.toLowerCase().includes(q) || d.label.toLowerCase().includes(q);
    });
  }
}

// ============================================================================
// Factory (used from window.MyIOLibrary in plain-JS widgets)
// ============================================================================

export function createNewTicketWizard(config: NewTicketWizardConfig): NewTicketWizard {
  return new NewTicketWizard(config);
}
