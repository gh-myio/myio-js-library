/**
 * RFC-0176: GCDR Sync Modal — Entry point + 3-step DOM view
 *
 * Opens a full-screen overlay modal to sync ThingsBoard entities to GCDR.
 * Inline CSS-in-JS styles. Teal color scheme (#0a6d5e).
 *
 * Steps:
 *   1. Preview: entity counts (create / update / skip)
 *   2. Confirm: expandable list of actions per entity type
 *   3. Results: succeeded / failed / skipped counts + retry
 */

import type { GCDRSyncModalParams, GCDRSyncPlan, GCDRSyncResult, SyncAction } from './types';
import { GCDRSyncController } from './GCDRSyncController';
import type { TBDataBundle } from './diffEngine';

// ============================================================================
// Constants
// ============================================================================

const TEAL = '#0a6d5e';
const TEAL_DARK = '#084f44';
const TEAL_LIGHT = '#0d8570';
const MODAL_ID = 'myio-gcdr-sync-modal';

// ============================================================================
// Styles
// ============================================================================

const STYLES = `
  #${MODAL_ID} {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.60);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 99998;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Roboto', Inter, system-ui, -apple-system, sans-serif;
  }
  #${MODAL_ID} .gcdr-card {
    background: #fff;
    color: #1a1a1a;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.30);
    width: min(560px, 95vw);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  #${MODAL_ID} .gcdr-header {
    background: ${TEAL};
    color: #fff;
    padding: 20px 24px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  #${MODAL_ID} .gcdr-header-icon {
    font-size: 24px;
    flex-shrink: 0;
  }
  #${MODAL_ID} .gcdr-header-text {
    flex: 1;
  }
  #${MODAL_ID} .gcdr-header-title {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
    margin: 0;
  }
  #${MODAL_ID} .gcdr-header-sub {
    font-size: 13px;
    opacity: 0.80;
    margin: 4px 0 0;
  }
  #${MODAL_ID} .gcdr-close-btn {
    background: none;
    border: none;
    color: #fff;
    font-size: 22px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    line-height: 1;
    opacity: 0.80;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }
  #${MODAL_ID} .gcdr-close-btn:hover { opacity: 1; }
  #${MODAL_ID} .gcdr-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
  }
  #${MODAL_ID} .gcdr-footer {
    padding: 16px 24px;
    border-top: 1px solid #e8ecef;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    flex-shrink: 0;
  }
  #${MODAL_ID} .gcdr-btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background 0.15s, transform 0.10s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  #${MODAL_ID} .gcdr-btn:active { transform: scale(0.97); }
  #${MODAL_ID} .gcdr-btn-primary {
    background: ${TEAL};
    color: #fff;
  }
  #${MODAL_ID} .gcdr-btn-primary:hover { background: ${TEAL_LIGHT}; }
  #${MODAL_ID} .gcdr-btn-secondary {
    background: #f0f4f3;
    color: ${TEAL_DARK};
    border: 1px solid #d0dbd9;
  }
  #${MODAL_ID} .gcdr-btn-secondary:hover { background: #e0ecea; }
  #${MODAL_ID} .gcdr-btn-danger {
    background: #d32f2f;
    color: #fff;
  }
  #${MODAL_ID} .gcdr-btn-danger:hover { background: #b71c1c; }
  #${MODAL_ID} .gcdr-counts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }
  #${MODAL_ID} .gcdr-count-card {
    background: #f8faf9;
    border: 1px solid #e0eceb;
    border-radius: 10px;
    padding: 14px 12px;
    text-align: center;
  }
  #${MODAL_ID} .gcdr-count-num {
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 4px;
  }
  #${MODAL_ID} .gcdr-count-label {
    font-size: 12px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  #${MODAL_ID} .gcdr-count-create { color: ${TEAL}; }
  #${MODAL_ID} .gcdr-count-update { color: #e67e00; }
  #${MODAL_ID} .gcdr-count-skip { color: #888; }
  #${MODAL_ID} .gcdr-count-recreate { color: #9c27b0; }
  #${MODAL_ID} .gcdr-info-box {
    background: #f0f9f7;
    border: 1px solid #c3e6e2;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    color: #1a4a45;
    line-height: 1.5;
  }
  #${MODAL_ID} .gcdr-error-box {
    background: #fff0f0;
    border: 1px solid #ffb3b3;
    border-radius: 8px;
    padding: 14px 16px;
    font-size: 14px;
    color: #b71c1c;
    line-height: 1.5;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  #${MODAL_ID} .gcdr-section-title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
    margin: 16px 0 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  #${MODAL_ID} .gcdr-action-list {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid #e8ecef;
    border-radius: 8px;
  }
  #${MODAL_ID} .gcdr-action-item {
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    border-bottom: 1px solid #f0f4f3;
  }
  #${MODAL_ID} .gcdr-action-item:last-child { border-bottom: none; }
  #${MODAL_ID} .gcdr-badge {
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }
  #${MODAL_ID} .gcdr-badge-create { background: #e6f4f1; color: ${TEAL_DARK}; }
  #${MODAL_ID} .gcdr-badge-update { background: #fff3e0; color: #e67e00; }
  #${MODAL_ID} .gcdr-badge-recreate { background: #f3e5f5; color: #7b1fa2; }
  #${MODAL_ID} .gcdr-progress-overlay {
    position: absolute;
    inset: 0;
    background: rgba(255,255,255,0.92);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 32px;
    text-align: center;
    z-index: 10;
  }
  #${MODAL_ID} .gcdr-progress-title {
    font-size: 16px;
    font-weight: 600;
    color: ${TEAL_DARK};
  }
  #${MODAL_ID} .gcdr-progress-entity {
    font-size: 13px;
    color: #555;
    min-height: 20px;
  }
  #${MODAL_ID} .gcdr-progress-bar-wrap {
    width: 100%;
    max-width: 360px;
    background: #e0ece9;
    border-radius: 99px;
    height: 8px;
    overflow: hidden;
  }
  #${MODAL_ID} .gcdr-progress-bar {
    height: 100%;
    background: ${TEAL};
    border-radius: 99px;
    transition: width 0.3s ease;
    width: 0%;
  }
  #${MODAL_ID} .gcdr-progress-counter {
    font-size: 12px;
    color: #888;
  }
  #${MODAL_ID} .gcdr-result-counts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }
  #${MODAL_ID} .gcdr-result-card {
    background: #f8faf9;
    border: 1px solid #e0eceb;
    border-radius: 10px;
    padding: 14px 12px;
    text-align: center;
  }
  #${MODAL_ID} .gcdr-result-num {
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 4px;
  }
  #${MODAL_ID} .gcdr-result-label {
    font-size: 12px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  #${MODAL_ID} .gcdr-result-ok { color: ${TEAL}; }
  #${MODAL_ID} .gcdr-result-fail { color: #d32f2f; }
  #${MODAL_ID} .gcdr-result-skip { color: #888; }
  #${MODAL_ID} .gcdr-fail-list {
    background: #fff5f5;
    border: 1px solid #ffcdd2;
    border-radius: 8px;
    padding: 12px;
    max-height: 160px;
    overflow-y: auto;
  }
  #${MODAL_ID} .gcdr-fail-item {
    font-size: 12px;
    color: #b71c1c;
    padding: 4px 0;
    border-bottom: 1px solid #ffebee;
  }
  #${MODAL_ID} .gcdr-fail-item:last-child { border-bottom: none; }
`;

// ============================================================================
// Helper: inject styles once
// ============================================================================

function injectStyles(): void {
  if (document.getElementById(`${MODAL_ID}-styles`)) return;
  const style = document.createElement('style');
  style.id = `${MODAL_ID}-styles`;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// ============================================================================
// Helper: remove existing modal
// ============================================================================

function removeExistingModal(): void {
  const existing = document.getElementById(MODAL_ID);
  existing?.remove();
}

// ============================================================================
// Action type badge HTML
// ============================================================================

function badgeHtml(type: SyncAction['type']): string {
  const cls = type === 'CREATE' ? 'create' : type === 'UPDATE' ? 'update' : 'recreate';
  const label = type === 'RECREATE' ? 'RECRIAR' : type === 'CREATE' ? 'CRIAR' : 'ATUALIZAR';
  return `<span class="gcdr-badge gcdr-badge-${cls}">${label}</span>`;
}

// ============================================================================
// Step 1 — Preview
// ============================================================================

function renderStep1(plan: GCDRSyncPlan): string {
  const { toCreate, toUpdate, toSkip, toRecreate } = plan;
  const total = toCreate + toUpdate + toRecreate;

  return `
    <div class="gcdr-counts">
      <div class="gcdr-count-card">
        <div class="gcdr-count-num gcdr-count-create">${toCreate}</div>
        <div class="gcdr-count-label">Criar</div>
      </div>
      <div class="gcdr-count-card">
        <div class="gcdr-count-num gcdr-count-update">${toUpdate}</div>
        <div class="gcdr-count-label">Atualizar</div>
      </div>
      <div class="gcdr-count-card">
        <div class="gcdr-count-num gcdr-count-skip">${toSkip}</div>
        <div class="gcdr-count-label">Sem alteração</div>
      </div>
      ${toRecreate > 0 ? `
      <div class="gcdr-count-card" style="grid-column: 1 / -1;">
        <div class="gcdr-count-num gcdr-count-recreate">${toRecreate}</div>
        <div class="gcdr-count-label">Recriar (não encontrado no GCDR)</div>
      </div>` : ''}
    </div>
    <div class="gcdr-info-box">
      ${total === 0
        ? '✅ Tudo sincronizado! Não há alterações pendentes.'
        : `Serão realizadas <strong>${total} operações</strong> no GCDR. Revise as mudanças antes de executar.`}
    </div>
  `;
}

// ============================================================================
// Step 2 — Confirm (expandable lists)
// ============================================================================

function renderStep2(plan: GCDRSyncPlan): string {
  const nonSkip = plan.actions.filter((a) => a.type !== 'SKIP');

  const customers = nonSkip.filter((a) => a.entityKind === 'customer');
  const assets = nonSkip.filter((a) => a.entityKind === 'asset');
  const devices = nonSkip.filter((a) => a.entityKind === 'device');

  function sectionHtml(icon: string, title: string, actions: SyncAction[]): string {
    if (actions.length === 0) return '';
    return `
      <div class="gcdr-section-title">${icon} ${title} (${actions.length})</div>
      <ul class="gcdr-action-list">
        ${actions.map((a) => `
          <li class="gcdr-action-item">
            ${badgeHtml(a.type)}
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(a.tbName)}</span>
          </li>
        `).join('')}
      </ul>
    `;
  }

  if (nonSkip.length === 0) {
    return `<div class="gcdr-info-box">✅ Não há alterações para executar.</div>`;
  }

  return `
    ${sectionHtml('🏢', 'Clientes', customers)}
    ${sectionHtml('🏗️', 'Assets', assets)}
    ${sectionHtml('📡', 'Dispositivos', devices)}
  `;
}

// ============================================================================
// Step 3 — Results
// ============================================================================

function renderStep3(result: GCDRSyncResult): string {
  const { succeeded, failed, skipped } = result;

  const failList = failed.length > 0
    ? `<div style="margin-top:12px;">
        <div class="gcdr-section-title" style="color:#d32f2f;">❌ Erros (${failed.length})</div>
        <div class="gcdr-fail-list">
          ${failed.map((f) => `
            <div class="gcdr-fail-item">
              <strong>${escHtml(f.action.tbName)}</strong>: ${escHtml(f.error ?? 'Erro desconhecido')}
            </div>
          `).join('')}
        </div>
      </div>`
    : '';

  return `
    <div class="gcdr-result-counts">
      <div class="gcdr-result-card">
        <div class="gcdr-result-num gcdr-result-ok">${succeeded.length}</div>
        <div class="gcdr-result-label">Sincronizados</div>
      </div>
      <div class="gcdr-result-card">
        <div class="gcdr-result-num gcdr-result-fail">${failed.length}</div>
        <div class="gcdr-result-label">Com Erro</div>
      </div>
      <div class="gcdr-result-card">
        <div class="gcdr-result-num gcdr-result-skip">${skipped.length}</div>
        <div class="gcdr-result-label">Sem alteração</div>
      </div>
    </div>
    ${failed.length === 0
      ? `<div class="gcdr-info-box">✅ Sincronização concluída com sucesso!</div>`
      : `<div class="gcdr-info-box" style="background:#fff0f0;border-color:#ffb3b3;color:#b71c1c;">
          ⚠️ Sincronização concluída com ${failed.length} erro(s).
        </div>`}
    ${failList}
  `;
}

// ============================================================================
// XSS helper
// ============================================================================

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// Main entry point
// ============================================================================

export async function openGCDRSyncModal(params: GCDRSyncModalParams): Promise<void> {
  injectStyles();
  removeExistingModal();

  // Validate required params
  if (!params.thingsboardToken) {
    alert('Token ThingsBoard não encontrado. Faça login novamente.');
    return;
  }

  if (!params.customerId) {
    alert('Customer ID não informado. Configure a estrutura antes de sincronizar.');
    return;
  }

  // ---- Build outer shell ----
  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;

  const card = document.createElement('div');
  card.className = 'gcdr-card';
  card.style.position = 'relative'; // for progress overlay

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // ---- Close handler ----
  const closeModal = () => {
    overlay.remove();
    params.onClose?.();
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // ---- State ----
  let currentPlan: GCDRSyncPlan | null = null;
  let currentBundle: TBDataBundle | null = null;
  let lastResult: GCDRSyncResult | null = null;

  const controller = new GCDRSyncController(params);

  // ---- Render header ----
  function renderHeader(subtitle: string): string {
    return `
      <div class="gcdr-header">
        <div class="gcdr-header-icon">🔗</div>
        <div class="gcdr-header-text">
          <p class="gcdr-header-title">GCDR Sync</p>
          <p class="gcdr-header-sub">${escHtml(subtitle)}</p>
        </div>
        <button class="gcdr-close-btn" id="gcdr-modal-close" title="Fechar">✕</button>
      </div>
    `;
  }

  // ---- Step 0: collect gcdrTenantId manually if missing ----
  if (!params.gcdrTenantId) {
    card.innerHTML = `
      ${renderHeader('Configuração GCDR')}
      <div class="gcdr-body">
        <div class="gcdr-error-box" style="margin-bottom:16px;">
          <span style="font-size:20px;flex-shrink:0;">⚠️</span>
          <div>
            <strong>GCDR Tenant ID não encontrado.</strong><br>
            O atributo <code>gcdrTenantId</code> não está no SERVER_SCOPE do customer raiz.
            Insira o valor manualmente para continuar ou configure-o no ThingsBoard.
          </div>
        </div>
        <label style="display:block;font-size:12px;font-weight:600;color:#555;margin-bottom:4px;">
          GCDR Tenant ID
        </label>
        <input
          id="gcdr-tenant-id-input"
          type="text"
          placeholder="ex: tenant_abc123"
          style="
            width:100%;box-sizing:border-box;padding:9px 12px;
            border:1px solid #ccc;border-radius:6px;font-size:13px;
            outline:none;transition:border-color .15s;
          "
          autocomplete="off"
        />
        <div id="gcdr-tenant-id-error" style="color:#c0392b;font-size:11px;margin-top:4px;display:none;">
          Campo obrigatório.
        </div>
      </div>
      <div class="gcdr-footer">
        <button class="gcdr-btn gcdr-btn-secondary" id="gcdr-modal-close">Fechar</button>
        <button class="gcdr-btn gcdr-btn-primary" id="gcdr-tenant-id-confirm">Continuar →</button>
      </div>
    `;

    const input = card.querySelector('#gcdr-tenant-id-input') as HTMLInputElement;
    const errorEl = card.querySelector('#gcdr-tenant-id-error') as HTMLElement;

    input.addEventListener('focus', () => { input.style.borderColor = '#0a6d5e'; });
    input.addEventListener('blur', () => { input.style.borderColor = '#ccc'; });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmTenantId(); });

    function confirmTenantId() {
      const val = input.value.trim();
      if (!val) {
        errorEl.style.display = 'block';
        input.focus();
        return;
      }
      errorEl.style.display = 'none';
      params.gcdrTenantId = val;
      gotoStep1();
    }

    card.querySelector('#gcdr-modal-close')?.addEventListener('click', closeModal);
    card.querySelector('#gcdr-tenant-id-confirm')?.addEventListener('click', confirmTenantId);
    input.focus();
    return;
  }

  // ---- Show progress overlay ----
  let progressOverlay: HTMLElement | null = null;

  function showProgress(message: string, current = 0, total = 0, entityName = ''): void {
    if (!progressOverlay) {
      progressOverlay = document.createElement('div');
      progressOverlay.className = 'gcdr-progress-overlay';
      card.appendChild(progressOverlay);
    }
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    progressOverlay.innerHTML = `
      <div style="font-size:32px;">🔄</div>
      <div class="gcdr-progress-title">${escHtml(message)}</div>
      <div class="gcdr-progress-entity">${entityName ? escHtml(entityName) : '&nbsp;'}</div>
      <div class="gcdr-progress-bar-wrap">
        <div class="gcdr-progress-bar" style="width:${pct}%"></div>
      </div>
      ${total > 0 ? `<div class="gcdr-progress-counter">${current} / ${total}</div>` : ''}
    `;
  }

  function hideProgress(): void {
    progressOverlay?.remove();
    progressOverlay = null;
  }

  // ---- Step 1: Preview ----
  async function gotoStep1(): Promise<void> {
    card.innerHTML = `
      ${renderHeader('Pré-visualização')}
      <div class="gcdr-body" id="gcdr-body">
        <div style="text-align:center;padding:24px;color:#555;">Carregando...</div>
      </div>
      <div class="gcdr-footer">
        <button class="gcdr-btn gcdr-btn-secondary" id="gcdr-modal-close">Cancelar</button>
        <button class="gcdr-btn gcdr-btn-primary" id="gcdr-next-btn" disabled>Revisar alterações →</button>
      </div>
    `;

    card.querySelector('#gcdr-modal-close')?.addEventListener('click', closeModal);

    showProgress('Carregando dados...');

    try {
      const { plan, bundle } = await controller.buildSyncPlan((msg) => {
        showProgress(msg);
      });

      currentPlan = plan;
      currentBundle = bundle;
      hideProgress();

      const body = card.querySelector('#gcdr-body') as HTMLElement;
      body.innerHTML = renderStep1(plan);

      const nextBtn = card.querySelector('#gcdr-next-btn') as HTMLButtonElement;
      nextBtn.disabled = false;
      nextBtn.addEventListener('click', gotoStep2);
    } catch (err) {
      hideProgress();
      const body = card.querySelector('#gcdr-body') as HTMLElement;
      body.innerHTML = `
        <div class="gcdr-error-box">
          <span style="font-size:20px;flex-shrink:0;">❌</span>
          <div>
            <strong>Erro ao carregar dados:</strong><br>
            ${escHtml(err instanceof Error ? err.message : String(err))}
          </div>
        </div>
      `;
    }
  }

  // ---- Step 2: Confirm ----
  function gotoStep2(): void {
    if (!currentPlan) return;

    card.innerHTML = `
      ${renderHeader('Confirmar alterações')}
      <div class="gcdr-body" id="gcdr-body">
        ${renderStep2(currentPlan)}
      </div>
      <div class="gcdr-footer">
        <button class="gcdr-btn gcdr-btn-secondary" id="gcdr-back-btn">← Voltar</button>
        <button class="gcdr-btn gcdr-btn-primary" id="gcdr-run-btn">
          Executar sync ▶
        </button>
      </div>
    `;

    card.querySelector('#gcdr-back-btn')?.addEventListener('click', gotoStep1);
    card.querySelector('#gcdr-run-btn')?.addEventListener('click', gotoStep3);
  }

  // ---- Step 3: Run + Results ----
  async function gotoStep3(): Promise<void> {
    if (!currentPlan || !currentBundle) return;

    card.innerHTML = `
      ${renderHeader('Sincronizando...')}
      <div class="gcdr-body" id="gcdr-body">
        <div style="text-align:center;padding:24px;color:#555;">Aguarde...</div>
      </div>
      <div class="gcdr-footer">
        <button class="gcdr-btn gcdr-btn-secondary" id="gcdr-modal-close" disabled>Fechar</button>
      </div>
    `;

    showProgress('Sincronizando entidades...', 0, 0, '');

    try {
      const result = await controller.runSync(
        currentBundle,
        currentPlan,
        (current, total, entityName) => {
          showProgress('Sincronizando...', current, total, entityName);
        },
      );

      lastResult = result;
      hideProgress();
      params.onSync?.(result);

      // Show results
      card.innerHTML = `
        ${renderHeader('Resultado da Sincronização')}
        <div class="gcdr-body" id="gcdr-body">
          ${renderStep3(result)}
        </div>
        <div class="gcdr-footer">
          <button class="gcdr-btn gcdr-btn-secondary" id="gcdr-modal-close">Fechar</button>
          ${result.failed.length > 0
            ? `<button class="gcdr-btn gcdr-btn-danger" id="gcdr-retry-btn">↩ Tentar novamente</button>`
            : ''}
        </div>
      `;

      card.querySelector('#gcdr-modal-close')?.addEventListener('click', closeModal);
      card.querySelector('#gcdr-retry-btn')?.addEventListener('click', gotoStep1);
    } catch (err) {
      hideProgress();
      card.innerHTML = `
        ${renderHeader('Erro na Sincronização')}
        <div class="gcdr-body">
          <div class="gcdr-error-box">
            <span style="font-size:20px;flex-shrink:0;">❌</span>
            <div>
              <strong>Erro durante a sincronização:</strong><br>
              ${escHtml(err instanceof Error ? err.message : String(err))}
            </div>
          </div>
        </div>
        <div class="gcdr-footer">
          <button class="gcdr-btn gcdr-btn-secondary" id="gcdr-modal-close">Fechar</button>
          <button class="gcdr-btn gcdr-btn-primary" id="gcdr-retry-btn">↩ Tentar novamente</button>
        </div>
      `;

      card.querySelector('#gcdr-modal-close')?.addEventListener('click', closeModal);
      card.querySelector('#gcdr-retry-btn')?.addEventListener('click', gotoStep1);
    }
  }

  // ---- Start at Step 1 ----
  await gotoStep1();
}
