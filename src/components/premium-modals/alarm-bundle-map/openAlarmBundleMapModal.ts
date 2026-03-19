/**
 * RFC-0179: GCDR Alarm Bundle Map Modal
 *
 * Read-only modal showing which devices are registered in GCDR with alarm rules,
 * grouped by asset.
 *
 * Calls: GET /api/v1/customers/external/{customerTB_ID}
 *             ?deep=1&allRules=1&filterOnlyDevicesWithRules=1
 *
 * Auth: X-API-Key (integration key) + X-Tenant-ID
 */

import type { GCDRCustomerBundle, GCDRBundleDevice, GCDRBundleRule } from '../gcdr-sync/types';

// ============================================================================
// Constants
// ============================================================================

const MODAL_ID = 'myio-alarm-bundle-map-modal';
const GCDR_INTEGRATION_API_KEY = 'gcdr_cust_tb_integration_key_2026';
const GCDR_DEFAULT_BASE_URL = 'https://gcdr-api.a.myio-bas.com';

const TEAL = '#0a6d5e';
const TEAL_DARK = '#084f44';
const TEAL_LIGHT = '#0d8570';

// ============================================================================
// Public params
// ============================================================================

export interface AlarmBundleMapParams {
  /** ThingsBoard Customer UUID — used as externalId in GCDR reverse-lookup */
  customerTB_ID: string;
  /** GCDR Tenant ID for X-Tenant-ID header */
  gcdrTenantId: string;
  /** GCDR API base URL (default: https://gcdr-api.a.myio-bas.com) */
  gcdrApiBaseUrl?: string;
  /** Theme mode */
  themeMode?: 'dark' | 'light';
  /** Called when modal closes */
  onClose?: () => void;
  /**
   * RFC-0180: Pre-fetched GCDRCustomerBundle from MAIN_VIEW orchestrator.
   * If provided and forceRefetch is false, skips the API call.
   */
  prefetchedBundle?: GCDRCustomerBundle | null;
  /**
   * RFC-0180: If true, always fetches fresh data even when prefetchedBundle is provided.
   */
  forceRefetch?: boolean;
}

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
  #${MODAL_ID} .abm-card {
    background: #fff;
    color: #1a1a1a;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.30);
    width: min(775px, 96vw);
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  #${MODAL_ID} .abm-header {
    background: ${TEAL};
    color: #fff;
    padding: 18px 24px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  #${MODAL_ID} .abm-header-icon { font-size: 22px; flex-shrink: 0; }
  #${MODAL_ID} .abm-header-text { flex: 1; }
  #${MODAL_ID} .abm-header-title {
    font-size: 17px; font-weight: 700; line-height: 1.2; margin: 0;
  }
  #${MODAL_ID} .abm-header-sub {
    font-size: 12px; opacity: 0.80; margin: 3px 0 0;
  }
  #${MODAL_ID} .abm-close-btn {
    background: none; border: none; color: #fff;
    font-size: 20px; cursor: pointer; padding: 4px 8px;
    border-radius: 6px; line-height: 1; opacity: 0.80; transition: opacity 0.15s; flex-shrink: 0;
  }
  #${MODAL_ID} .abm-close-btn:hover { opacity: 1; }
  #${MODAL_ID} .abm-body {
    padding: 20px 24px; overflow-y: auto; flex: 1;
  }
  #${MODAL_ID} .abm-footer {
    padding: 14px 24px; border-top: 1px solid #e8ecef;
    display: flex; gap: 12px; justify-content: flex-end; flex-shrink: 0;
  }
  #${MODAL_ID} .abm-btn {
    padding: 9px 18px; border-radius: 8px; font-size: 14px;
    font-weight: 600; cursor: pointer; border: none;
    transition: background 0.15s;
    display: inline-flex; align-items: center; gap: 6px;
  }
  #${MODAL_ID} .abm-btn-secondary {
    background: #f0f4f3; color: ${TEAL_DARK}; border: 1px solid #d0dbd9;
  }
  #${MODAL_ID} .abm-btn-secondary:hover { background: #e0ecea; }
  #${MODAL_ID} .abm-error-box {
    background: #fff0f0; border: 1px solid #ffb3b3; border-radius: 8px;
    padding: 14px 16px; font-size: 14px; color: #b71c1c;
    line-height: 1.5; display: flex; gap: 10px; align-items: flex-start;
  }
  #${MODAL_ID} .abm-empty-box {
    background: #f0f9f7; border: 1px solid #c3e6e2; border-radius: 8px;
    padding: 16px; font-size: 14px; color: #1a4a45; line-height: 1.5;
    text-align: center;
  }
  #${MODAL_ID} .abm-loading {
    text-align: center; padding: 32px; color: #555; font-size: 14px;
  }
  #${MODAL_ID} .abm-summary-bar {
    display: flex; gap: 20px; margin-bottom: 18px;
    padding: 12px 16px; background: #f8faf9;
    border: 1px solid #e0eceb; border-radius: 10px;
  }
  #${MODAL_ID} .abm-summary-item { text-align: center; flex: 1; }
  #${MODAL_ID} .abm-summary-num {
    font-size: 22px; font-weight: 700; color: ${TEAL}; line-height: 1;
  }
  #${MODAL_ID} .abm-summary-label {
    font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.04em;
    margin-top: 2px;
  }
  #${MODAL_ID} .abm-asset-group { margin-bottom: 16px; }
  #${MODAL_ID} .abm-asset-label {
    font-size: 11px; font-weight: 700; color: #888;
    text-transform: uppercase; letter-spacing: 0.07em;
    margin-bottom: 6px; padding-left: 2px;
  }
  #${MODAL_ID} .abm-device-card {
    border: 1px solid #e0eceb; border-radius: 10px;
    margin-bottom: 8px; overflow: hidden;
  }
  #${MODAL_ID} .abm-device-header {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; background: #f8faf9;
    border-bottom: 1px solid #e0eceb;
  }
  #${MODAL_ID} .abm-device-name {
    flex: 1; font-size: 14px; font-weight: 600; color: #1a1a1a;
  }
  #${MODAL_ID} .abm-device-type {
    font-size: 11px; font-weight: 600; padding: 2px 8px;
    border-radius: 4px; background: #e6f4f1; color: ${TEAL_DARK};
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  #${MODAL_ID} .abm-rule-list { padding: 0; list-style: none; margin: 0; }
  #${MODAL_ID} .abm-rule-item {
    padding: 10px 14px; border-bottom: 1px solid #f0f4f3;
    font-size: 13px;
  }
  #${MODAL_ID} .abm-rule-item:last-child { border-bottom: none; }
  #${MODAL_ID} .abm-rule-name {
    font-weight: 600; color: #333; margin-bottom: 4px;
    display: flex; align-items: center; gap: 6px;
  }
  #${MODAL_ID} .abm-rule-detail {
    color: #555; line-height: 1.6;
    display: flex; flex-wrap: wrap; gap: 4px 12px;
  }
  #${MODAL_ID} .abm-rule-chip {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 12px; background: #f0f4f3; border-radius: 4px;
    padding: 1px 7px; color: #444;
  }
  #${MODAL_ID} .abm-day-chip {
    font-size: 10px; font-weight: 700; padding: 1px 5px;
    border-radius: 3px; background: ${TEAL}; color: #fff;
  }
  #${MODAL_ID} .abm-day-chip.off {
    background: #e8ecef; color: #aaa;
  }
`;

// ============================================================================
// Helpers
// ============================================================================

function injectStyles(): void {
  if (document.getElementById(`${MODAL_ID}-styles`)) return;
  const style = document.createElement('style');
  style.id = `${MODAL_ID}-styles`;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function removeExistingModal(): void {
  document.getElementById(MODAL_ID)?.remove();
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const OPERATOR_LABELS: Record<string, string> = {
  LT: '<', GT: '>', LTE: '≤', GTE: '≥', EQ: '=',
};

const DAY_NAMES: Record<string, string> = {
  '0': 'Dom', '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sáb',
};

function formatDuration(ms?: number): string {
  if (!ms) return '';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function renderDaysOfWeek(daysOfWeek?: Record<string, boolean>): string {
  if (!daysOfWeek) return '';
  return Object.entries(DAY_NAMES).map(([key, label]) => {
    const active = daysOfWeek[key] === true;
    return `<span class="abm-day-chip ${active ? '' : 'off'}">${label}</span>`;
  }).join('');
}

function renderRule(rule: GCDRBundleRule): string {
  const op = OPERATOR_LABELS[rule.operator] ?? rule.operator;
  const dur = formatDuration(rule.duration);
  const time = rule.startAt && rule.endAt ? `${rule.startAt} – ${rule.endAt}` : '';
  const agg = rule.aggregation ?? '';

  const chips = [
    `<span class="abm-rule-chip">📊 ${escHtml(rule.metric)} ${escHtml(op)} ${rule.value}</span>`,
    agg && `<span class="abm-rule-chip">${escHtml(agg)}</span>`,
    dur && `<span class="abm-rule-chip">⏱ ${escHtml(dur)}</span>`,
    time && `<span class="abm-rule-chip">🕐 ${escHtml(time)}</span>`,
  ].filter(Boolean).join('');

  const days = rule.daysOfWeek ? renderDaysOfWeek(rule.daysOfWeek) : '';

  return `
    <li class="abm-rule-item">
      <div class="abm-rule-name">🔔 ${escHtml(rule.name)}</div>
      <div class="abm-rule-detail">
        ${chips}
        ${days}
      </div>
    </li>
  `;
}

function renderDevice(device: GCDRBundleDevice, rules: Record<string, GCDRBundleRule>): string {
  const deviceRules = (device.ruleIds ?? [])
    .map((rid) => rules[rid])
    .filter(Boolean) as GCDRBundleRule[];

  return `
    <div class="abm-device-card">
      <div class="abm-device-header">
        <span style="font-size:16px;">📡</span>
        <span class="abm-device-name">${escHtml(device.displayName || device.name)}</span>
        <span class="abm-device-type">${escHtml(device.type)}</span>
      </div>
      <ul class="abm-rule-list">
        ${deviceRules.length > 0
          ? deviceRules.map(renderRule).join('')
          : `<li class="abm-rule-item" style="color:#888;">Sem regras associadas</li>`
        }
      </ul>
    </div>
  `;
}

function renderBundle(bundle: GCDRCustomerBundle): string {
  const { customer, assets, devices, rules } = bundle;

  const deviceCount = devices.length;
  const ruleCount = Object.keys(rules).length;

  if (deviceCount === 0) {
    return `
      <div class="abm-summary-bar">
        <div class="abm-summary-item">
          <div class="abm-summary-num">0</div>
          <div class="abm-summary-label">Dispositivos</div>
        </div>
        <div class="abm-summary-item">
          <div class="abm-summary-num">0</div>
          <div class="abm-summary-label">Regras</div>
        </div>
      </div>
      <div class="abm-empty-box">
        Nenhum dispositivo com regras de alarme configuradas no GCDR para este cliente.
      </div>
    `;
  }

  // Build asset lookup map
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  // Group devices by assetId
  const byAsset = new Map<string, GCDRBundleDevice[]>();
  const noAsset: GCDRBundleDevice[] = [];
  for (const device of devices) {
    if (device.assetId) {
      if (!byAsset.has(device.assetId)) byAsset.set(device.assetId, []);
      byAsset.get(device.assetId)!.push(device);
    } else {
      noAsset.push(device);
    }
  }

  const customerName = (customer as { name?: string; displayName?: string }).displayName
    || (customer as { name?: string }).name
    || 'Cliente';

  let groups = '';
  for (const [assetId, devs] of byAsset) {
    const asset = assetMap.get(assetId);
    const assetLabel = asset?.displayName || asset?.name || assetId;
    groups += `
      <div class="abm-asset-group">
        <div class="abm-asset-label">🏗️ ${escHtml(assetLabel)}</div>
        ${devs.map((d) => renderDevice(d, rules)).join('')}
      </div>
    `;
  }
  if (noAsset.length > 0) {
    groups += `
      <div class="abm-asset-group">
        <div class="abm-asset-label">— Sem Asset</div>
        ${noAsset.map((d) => renderDevice(d, rules)).join('')}
      </div>
    `;
  }

  return `
    <div class="abm-summary-bar">
      <div class="abm-summary-item">
        <div class="abm-summary-num">${deviceCount}</div>
        <div class="abm-summary-label">Dispositivos</div>
      </div>
      <div class="abm-summary-item">
        <div class="abm-summary-num">${ruleCount}</div>
        <div class="abm-summary-label">Regras</div>
      </div>
      <div class="abm-summary-item">
        <div class="abm-summary-num">${assets.length}</div>
        <div class="abm-summary-label">Assets</div>
      </div>
    </div>
    ${groups}
  `;
}

// ============================================================================
// Fetch bundle
// ============================================================================

async function fetchBundle(
  customerTB_ID: string,
  gcdrTenantId: string,
  baseUrl: string,
): Promise<GCDRCustomerBundle> {
  const url = `${baseUrl}/api/v1/customers/external/${encodeURIComponent(customerTB_ID)}`
    + `?deep=1&allRules=1&filterOnlyDevicesWithRules=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': GCDR_INTEGRATION_API_KEY,
      'X-Tenant-ID': gcdrTenantId,
      'Accept': 'application/json',
    },
  });

  if (response.status === 404) {
    throw new Error('Cliente não encontrado no GCDR. Verifique se o sync GCDR foi executado.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`Erro de autenticação GCDR (${response.status}). Verifique a API Key.`);
  }

  if (!response.ok) {
    throw new Error(`Erro GCDR (${response.status}): ${response.statusText}`);
  }

  const json = await response.json() as { success?: boolean; data?: GCDRCustomerBundle };
  if (!json.data) {
    throw new Error('Resposta GCDR inválida: campo "data" ausente.');
  }

  return json.data;
}

// ============================================================================
// Main entry point
// ============================================================================

export async function openAlarmBundleMapModal(params: AlarmBundleMapParams): Promise<void> {
  injectStyles();
  removeExistingModal();

  if (!params.customerTB_ID) {
    alert('Customer TB ID não informado. Não é possível carregar o mapa de alarmes.');
    return;
  }

  if (!params.gcdrTenantId) {
    alert('GCDR Tenant ID não encontrado. Configure o atributo gcdrTenantId no cliente ThingsBoard.');
    return;
  }

  const baseUrl = params.gcdrApiBaseUrl || GCDR_DEFAULT_BASE_URL;

  // ---- Build overlay ----
  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;

  const card = document.createElement('div');
  card.className = 'abm-card';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const closeModal = () => {
    overlay.remove();
    params.onClose?.();
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // ---- Render skeleton ----
  function render(bodyHtml: string, subtitle = ''): void {
    card.innerHTML = `
      <div class="abm-header">
        <div class="abm-header-icon">🔗</div>
        <div class="abm-header-text">
          <p class="abm-header-title">Mapa de Alarmes GCDR</p>
          ${subtitle ? `<p class="abm-header-sub">${escHtml(subtitle)}</p>` : ''}
        </div>
        <button class="abm-close-btn" id="abm-close-btn" title="Fechar">✕</button>
      </div>
      <div class="abm-body">${bodyHtml}</div>
      <div class="abm-footer">
        <button class="abm-btn abm-btn-secondary" id="abm-close-btn-footer">Fechar</button>
      </div>
    `;
    card.querySelector('#abm-close-btn')?.addEventListener('click', closeModal);
    card.querySelector('#abm-close-btn-footer')?.addEventListener('click', closeModal);
  }

  // ---- Loading state ----
  render(`<div class="abm-loading">⏳ Carregando mapa de alarmes...</div>`);

  try {
    // RFC-0180: Reuse pre-fetched bundle if available and forceRefetch is not set
    const bundle =
      params.prefetchedBundle && !params.forceRefetch
        ? params.prefetchedBundle
        : await fetchBundle(params.customerTB_ID, params.gcdrTenantId, baseUrl);
    const customerName = (bundle.customer as { displayName?: string; name?: string }).displayName
      || (bundle.customer as { name?: string }).name
      || '';

    render(renderBundle(bundle), customerName);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    render(`
      <div class="abm-error-box">
        <span style="font-size:20px;flex-shrink:0;">❌</span>
        <div>
          <strong>Erro ao carregar o mapa de alarmes:</strong><br>
          ${escHtml(message)}
        </div>
      </div>
    `);
  }
}

// RFC-0180: Export fetchBundle so MAIN_VIEW and AlarmsTab can reuse it
export { fetchBundle as fetchGCDRBundle };
