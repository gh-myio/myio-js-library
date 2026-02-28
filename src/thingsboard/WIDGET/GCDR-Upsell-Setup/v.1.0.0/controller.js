/* global self, localStorage, document, window */

/**
 * GCDR-Upsell-Setup Widget — v.1.0.0
 * Premium standalone widget for GCDR Sync and Upsell Setup operations.
 *
 * Layout:
 *   Left panel  — searchable customer selector (fetched from ThingsBoard)
 *   Right panel — GCDR Sync card + Upsell Setup card
 *
 * Dependencies:
 *   - ThingsBoard JWT token (localStorage.jwt_token)
 *   - MyIO Ingestion API (via MyIOAuth for Upsell)
 *   - myio-js-library UMD (loaded from CDN on demand)
 */

// ============================================================
// MyIOAuth — Ingestion API token cache and renewal
// ============================================================
const MyIOAuth = (() => {
  const AUTH_URL = 'https://api.data.apps.myio-bas.com/api/v1/auth';
  const CLIENT_ID = 'myioadmi_mekj7xw7_sccibe';
  const CLIENT_SECRET = 'KmXhNZu0uydeWZ8scAi43h7P2pntGoWkdzNVMSjbVj3slEsZ5hGVXyayshgJAoqA';
  const RENEW_SKEW_S = 60;
  const RETRY_BASE_MS = 500;
  const RETRY_MAX_ATTEMPTS = 3;

  let _token = null;
  let _expiresAt = 0;
  let _inFlight = null;

  const _now = () => Date.now();
  const _aboutToExpire = () => !_token || _now() >= _expiresAt - RENEW_SKEW_S * 1000;
  const _sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  async function _requestNewToken() {
    let attempt = 0;
    while (true) {
      try {
        const resp = await fetch(AUTH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`Auth falhou: HTTP ${resp.status} ${text}`);
        }
        const json = await resp.json();
        if (!json || !json.access_token || !json.expires_in) {
          throw new Error('Resposta de auth inválida.');
        }
        _token = json.access_token;
        _expiresAt = _now() + Number(json.expires_in) * 1000;
        console.log('[MyIOAuth] Token obtido. Expira em ~', Math.round(Number(json.expires_in) / 60), 'min');
        return _token;
      } catch (err) {
        attempt++;
        console.warn(`[MyIOAuth] Erro (tentativa ${attempt}/${RETRY_MAX_ATTEMPTS}):`, err?.message || err);
        if (attempt >= RETRY_MAX_ATTEMPTS) throw err;
        await _sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
      }
    }
  }

  async function getToken() {
    if (_inFlight) return _inFlight;
    if (_aboutToExpire()) {
      _inFlight = _requestNewToken().finally(() => { _inFlight = null; });
      return _inFlight;
    }
    return _token;
  }

  return { getToken };
})();

// ============================================================
// ThingsBoard API helpers
// ============================================================

async function guFetchAllCustomers() {
  const token = localStorage['jwt_token'];
  if (!token) throw new Error('Token JWT não disponível');
  const headers = {
    'Content-Type': 'application/json',
    'X-Authorization': `Bearer ${token}`,
  };
  let customers = [];
  let page = 0;
  while (true) {
    const res = await fetch(`/api/customers?pageSize=100&page=${page}`, { method: 'GET', headers });
    if (!res.ok) throw new Error(`Erro ao buscar clientes: ${res.status} ${res.statusText}`);
    const data = await res.json();
    customers = customers.concat(data.data);
    if (!data.hasNext) break;
    page++;
  }
  const simplified = {};
  customers.forEach((c) => {
    simplified[c.title] = { id: c.id.id, name: c.title };
  });
  return simplified;
}

async function guFetchCustomerServerScopeAttrs(customerTbId) {
  if (!customerTbId) return {};
  const tbToken = localStorage.getItem('jwt_token');
  if (!tbToken) throw new Error('JWT do ThingsBoard não encontrado.');
  const url = `/api/plugins/telemetry/CUSTOMER/${customerTbId}/values/attributes/SERVER_SCOPE`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${tbToken}`,
    },
  });
  if (!res.ok) {
    console.warn(`[GU] Customer attrs HTTP ${res.status}`);
    return {};
  }
  const payload = await res.json();
  const map = {};
  if (Array.isArray(payload)) {
    for (const it of payload) map[it.key] = it.value;
  } else if (payload && typeof payload === 'object') {
    for (const k of Object.keys(payload)) {
      const v = payload[k];
      if (Array.isArray(v) && v.length) map[k] = v[0]?.value ?? v[0];
    }
  }
  return map;
}

// ============================================================
// Force Update helpers
// ============================================================

async function guFetchCustomerDevices(customerId) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('JWT não disponível');
  const headers = { 'X-Authorization': `Bearer ${token}` };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let devices = [];
  let page = 0;
  while (true) {
    if (page > 0) await sleep(1000); // 1s delay between pages
    const res = await fetch(`/api/customer/${customerId}/devices?pageSize=100&page=${page}`, { headers });
    if (!res.ok) throw new Error(`Erro ao buscar devices: HTTP ${res.status}`);
    const data = await res.json();
    devices = devices.concat(data.data || []);
    if (!data.hasNext) break;
    page++;
  }
  return devices;
}

async function guFetchDeviceServerScopeAttrs(deviceId) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('JWT não disponível');
  const res = await fetch(
    `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`,
    { headers: { 'X-Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) return {};
  const payload = await res.json();
  const map = {};
  if (Array.isArray(payload)) payload.forEach((a) => { map[a.key] = a.value; });
  return map;
}

async function guSaveDeviceServerScopeAttrs(deviceId, attrs) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('JWT não disponível');
  const res = await fetch(
    `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
      body: JSON.stringify(attrs),
    }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// Parse pipe-separated list:
// gcdrId | parentAssetGcdrId | central_id (UUID) | slave_id | name | display_name | tb_id
function guParseForceList(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const p = line.split('|');
      if (p.length < 7) return null;
      return {
        gcdrDeviceId:      p[0].trim(), // [0] GCDR device ID
        gcdrParentAssetId: p[1].trim(), // [1] parent asset GCDR ID
        centralId:         p[2].trim(), // [2] central_id UUID (gateway) — used for matching
        slaveId:           String(p[3].trim()), // [3] slave_id number — used for matching
        name:              p[4].trim(), // [4] device name
        displayName:       p[5].trim(), // [5] display_name / label (UI only)
        tbDeviceId:        p[6].trim(), // [6] TB device ID (reference)
      };
    })
    .filter(Boolean);
}

// ============================================================
// MyIO Library loader (CDN, on-demand)
// ============================================================
function guLoadMyIOLibrary() {
  return new Promise((resolve, reject) => {
    if (typeof window.MyIOLibrary !== 'undefined' && typeof window.MyIOLibrary.openUpsellModal === 'function') {
      resolve(window.MyIOLibrary);
      return;
    }
    console.log('[GU] Loading MyIOLibrary from CDN...');
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/myio-js-library@latest/dist/myio-js-library.umd.min.js';
    script.onload = () => {
      if (typeof window.MyIOLibrary !== 'undefined') {
        console.log('[GU] MyIOLibrary loaded');
        resolve(window.MyIOLibrary);
      } else {
        reject(new Error('MyIOLibrary não disponível após carregamento'));
      }
    };
    script.onerror = () => reject(new Error('Falha ao carregar MyIOLibrary do CDN'));
    document.head.appendChild(script);
  });
}

// ============================================================
// Widget
// ============================================================
self.onInit = function () {
  const container = self.ctx.$container[0];
  container.innerHTML = '';

  // --- Inject styles ---
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --gu-bg: #F6F7FB;
      --gu-card: #FFFFFF;
      --gu-text: #1F2937;
      --gu-muted: #6B7280;
      --gu-border: #E5E7EB;
      --gu-primary: #6932A8;
      --gu-primary-dark: #5a2890;
      --gu-gcdr: #0a6d5e;
      --gu-gcdr-dark: #085749;
      --gu-upsell: #3e1a7d;
      --gu-upsell-dark: #321565;
      --gu-success: #10b981;
      --gu-warn: #f59e0b;
      --gu-error: #ef4444;
    }

    .gu-root {
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background: var(--gu-bg);
      color: var(--gu-text);
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Header */
    .gu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px 14px;
      background: var(--gu-card);
      border-bottom: 1px solid var(--gu-border);
      flex-shrink: 0;
    }
    .gu-header-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--gu-text);
      letter-spacing: -0.2px;
    }
    .gu-header-title span {
      color: var(--gu-primary);
    }
    .gu-header-badge {
      font-size: 11px;
      background: var(--gu-primary);
      color: #fff;
      border-radius: 999px;
      padding: 2px 8px;
      font-weight: 600;
    }

    /* Layout */
    .gu-layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 0;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* Left panel — customer selector */
    .gu-left {
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--gu-border);
      background: var(--gu-card);
      min-height: 0;
      overflow: hidden;
    }
    .gu-left-header {
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--gu-border);
      flex-shrink: 0;
    }
    .gu-left-header h3 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--gu-muted);
      margin: 0 0 8px;
    }
    .gu-search {
      width: 100%;
      box-sizing: border-box;
      padding: 7px 10px;
      border: 1px solid var(--gu-border);
      border-radius: 8px;
      font-size: 13px;
      color: var(--gu-text);
      background: var(--gu-bg);
      outline: none;
      transition: border-color 0.15s;
    }
    .gu-search:focus {
      border-color: var(--gu-primary);
    }
    .gu-customer-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }
    .gu-customer-item {
      padding: 9px 16px;
      font-size: 13px;
      color: var(--gu-text);
      cursor: pointer;
      user-select: none;
      transition: background 0.1s;
      border-left: 3px solid transparent;
    }
    .gu-customer-item:hover {
      background: #F3F0FA;
    }
    .gu-customer-item.selected {
      background: #EDE7F6;
      border-left-color: var(--gu-primary);
      font-weight: 600;
      color: var(--gu-primary-dark);
    }
    .gu-no-results, .gu-list-error, .gu-list-loading {
      padding: 20px 16px;
      font-size: 13px;
      color: var(--gu-muted);
      text-align: center;
    }
    .gu-list-error { color: var(--gu-error); }

    /* Right panel — action cards */
    .gu-right {
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Selected customer info bar */
    .gu-selection-bar {
      background: var(--gu-card);
      border: 1px solid var(--gu-border);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .gu-selection-bar.empty {
      border-style: dashed;
      justify-content: center;
    }
    .gu-selection-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #EDE7F6, #D1C4E9);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    .gu-selection-info {
      flex: 1;
      min-width: 0;
    }
    .gu-selection-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--gu-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gu-selection-id {
      font-size: 11px;
      color: var(--gu-muted);
      font-family: ui-monospace, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gu-selection-placeholder {
      font-size: 13px;
      color: var(--gu-muted);
    }

    /* Action cards */
    .gu-card {
      background: var(--gu-card);
      border: 1px solid var(--gu-border);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .gu-card-header {
      padding: 14px 16px 12px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      border-bottom: 1px solid var(--gu-border);
    }
    .gu-card-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    .gu-card-icon.gcdr {
      background: linear-gradient(135deg, #0a9e8a, var(--gu-gcdr));
    }
    .gu-card-icon.upsell {
      background: linear-gradient(135deg, #6b3bba, var(--gu-upsell));
    }
    .gu-card-meta {
      flex: 1;
    }
    .gu-card-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--gu-text);
      margin: 0 0 3px;
    }
    .gu-card-desc {
      font-size: 12px;
      color: var(--gu-muted);
      line-height: 1.4;
    }
    .gu-card-body {
      padding: 12px 16px;
    }
    .gu-attr-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .gu-attr-label {
      font-size: 11px;
      color: var(--gu-muted);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      flex-shrink: 0;
      min-width: 100px;
    }
    .gu-attr-value {
      font-size: 12px;
      font-family: ui-monospace, monospace;
      color: var(--gu-text);
      background: var(--gu-bg);
      border: 1px solid var(--gu-border);
      border-radius: 6px;
      padding: 3px 8px;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .gu-attr-value.success { color: var(--gu-success); border-color: #A7F3D0; background: #ECFDF5; }
    .gu-attr-value.warn    { color: var(--gu-warn);    border-color: #FDE68A; background: #FFFBEB; }
    .gu-attr-value.error   { color: var(--gu-error);   border-color: #FECACA; background: #FEF2F2; }
    .gu-attr-value.muted   { color: var(--gu-muted); }

    .gu-card-footer {
      padding: 10px 16px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .gu-status-msg {
      font-size: 12px;
      color: var(--gu-muted);
      flex: 1;
      min-width: 0;
    }
    .gu-status-msg.loading { color: var(--gu-primary); }
    .gu-status-msg.success { color: var(--gu-success); }
    .gu-status-msg.error   { color: var(--gu-error); }

    /* Buttons */
    .gu-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 16px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 999px;
      border: none;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .gu-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none !important;
    }
    .gu-btn:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.05); }
    .gu-btn:not(:disabled):active { transform: translateY(0); }

    .gu-btn-gcdr {
      background: linear-gradient(180deg, #0db89e, var(--gu-gcdr));
      color: #fff;
      box-shadow: 0 2px 8px rgba(10,109,94,0.3);
    }
    .gu-btn-upsell {
      background: linear-gradient(180deg, #7b47c4, var(--gu-upsell));
      color: #fff;
      box-shadow: 0 2px 8px rgba(62,26,125,0.3);
    }

    /* Spinner */
    @keyframes gu-spin { to { transform: rotate(360deg); } }
    .gu-spinner {
      display: inline-block;
      width: 13px;
      height: 13px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: gu-spin 0.7s linear infinite;
    }

    /* Scrollbar */
    .gu-customer-list::-webkit-scrollbar,
    .gu-right::-webkit-scrollbar { width: 4px; }
    .gu-customer-list::-webkit-scrollbar-thumb,
    .gu-right::-webkit-scrollbar-thumb { background: var(--gu-border); border-radius: 4px; }

    /* Button group */
    .gu-btn-group { display: flex; gap: 8px; flex-wrap: wrap; }

    /* Force Update button */
    .gu-btn-force {
      background: #b45309;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 9px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .gu-btn-force:hover:not(:disabled) { background: #92400e; }
    .gu-btn-force:disabled { opacity: 0.45; cursor: not-allowed; }

    /* Force Update Modal overlay */
    .gu-fu-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .gu-fu-modal {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 1440px;
      max-width: 96vw;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .gu-fu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--gu-border);
      background: #fafafa;
      flex-shrink: 0;
    }
    .gu-fu-title { font-size: 15px; font-weight: 700; color: var(--gu-text); }
    .gu-fu-subtitle { font-size: 12px; color: var(--gu-muted); margin-top: 2px; }
    .gu-fu-close {
      background: none; border: none; font-size: 18px;
      cursor: pointer; color: var(--gu-muted); padding: 4px 8px;
      border-radius: 6px; line-height: 1;
    }
    .gu-fu-close:hover { background: var(--gu-border); }
    .gu-fu-steps {
      display: flex;
      gap: 0;
      padding: 12px 20px;
      border-bottom: 1px solid var(--gu-border);
      background: #fafafa;
      flex-shrink: 0;
    }
    .gu-fu-step {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--gu-muted);
    }
    .gu-fu-step.active { color: #b45309; font-weight: 600; }
    .gu-fu-step.done { color: var(--gu-success); }
    .gu-fu-step-num {
      width: 20px; height: 20px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700;
      background: var(--gu-border); color: var(--gu-muted);
    }
    .gu-fu-step.active .gu-fu-step-num { background: #b45309; color: #fff; }
    .gu-fu-step.done .gu-fu-step-num { background: var(--gu-success); color: #fff; }
    .gu-fu-step-sep { margin: 0 10px; color: var(--gu-border); font-size: 16px; }
    .gu-fu-body { flex: 1; overflow-y: auto; padding: 20px; }
    .gu-fu-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 14px 20px; border-top: 1px solid var(--gu-border);
      background: #fafafa; flex-shrink: 0;
    }
    .gu-fu-btn {
      padding: 9px 20px; border-radius: 8px; font-size: 13px;
      font-weight: 600; cursor: pointer; border: none; transition: 0.15s;
    }
    .gu-fu-btn-secondary {
      background: var(--gu-border); color: var(--gu-text);
    }
    .gu-fu-btn-secondary:hover { background: #d1d5db; }
    .gu-fu-btn-primary {
      background: #b45309; color: #fff;
    }
    .gu-fu-btn-primary:hover:not(:disabled) { background: #92400e; }
    .gu-fu-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .gu-fu-btn-success { background: var(--gu-success); color: #fff; }
    /* Step 1 - textarea */
    .gu-fu-label { font-size: 13px; font-weight: 600; color: var(--gu-text); margin-bottom: 6px; }
    .gu-fu-hint { font-size: 11px; color: var(--gu-muted); margin-bottom: 10px; line-height: 1.5; }
    .gu-fu-textarea {
      width: 100%; box-sizing: border-box;
      height: 200px; padding: 10px 12px;
      border: 1px solid var(--gu-border); border-radius: 8px;
      font-family: 'Courier New', monospace; font-size: 11px;
      resize: vertical; outline: none; color: var(--gu-text);
      background: #f9fafb;
    }
    .gu-fu-textarea:focus { border-color: #b45309; background: #fff; }
    .gu-fu-parse-error { color: var(--gu-error); font-size: 12px; margin-top: 8px; }
    /* Step 2 - grid */
    .gu-fu-summary {
      display: flex; gap: 16px; margin-bottom: 14px; flex-wrap: wrap;
    }
    .gu-fu-badge {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
    }
    .gu-fu-badge.match { background: #d1fae5; color: #065f46; }
    .gu-fu-badge.fail  { background: #fee2e2; color: #991b1b; }
    .gu-fu-badge.warn  { background: #fef3c7; color: #92400e; }
    .gu-fu-badge.total { background: #ede9fe; color: #4c1d95; }
    .gu-fu-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .gu-fu-table th {
      text-align: left; padding: 8px 10px;
      background: #f3f4f6; font-size: 11px; font-weight: 700;
      color: var(--gu-muted); border-bottom: 2px solid var(--gu-border);
    }
    .gu-fu-table td { padding: 8px 10px; border-bottom: 1px solid var(--gu-border); vertical-align: middle; }
    .gu-fu-table tr:last-child td { border-bottom: none; }
    .gu-fu-table tr:hover td { background: #f9fafb; }
    .gu-fu-status {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700;
    }
    .gu-fu-status.MATCH   { background: #d1fae5; color: #065f46; }
    .gu-fu-status.FAIL    { background: #fee2e2; color: #991b1b; }
    .gu-fu-status.WARNING { background: #fef3c7; color: #92400e; }
    .gu-fu-uuid { font-family: monospace; font-size: 10px; color: var(--gu-muted); }
    /* Step 3 - progress */
    .gu-fu-progress-wrap { margin-bottom: 16px; }
    .gu-fu-progress-bar-bg {
      height: 6px; background: var(--gu-border); border-radius: 3px; overflow: hidden;
    }
    .gu-fu-progress-bar { height: 100%; background: #b45309; transition: width 0.3s; border-radius: 3px; }
    .gu-fu-progress-label { font-size: 12px; color: var(--gu-muted); margin-top: 6px; }
    .gu-fu-result-list { list-style: none; margin: 0; padding: 0; }
    .gu-fu-result-item {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 8px 0; border-bottom: 1px solid var(--gu-border); font-size: 12px;
    }
    .gu-fu-result-item:last-child { border-bottom: none; }
    .gu-fu-result-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
    .gu-fu-result-name { font-weight: 600; color: var(--gu-text); }
    .gu-fu-result-msg { color: var(--gu-muted); font-size: 11px; margin-top: 2px; }
    .gu-fu-result-err { color: var(--gu-error); font-size: 11px; margin-top: 2px; }
  `;
  document.head.appendChild(style);

  // --- Render HTML ---
  container.insertAdjacentHTML(
    'beforeend',
    `<div class="gu-root">
      <div class="gu-header">
        <div class="gu-header-title">GCDR &amp; <span>Upsell</span> Setup</div>
        <div class="gu-header-badge">v1.0.0</div>
      </div>
      <div class="gu-layout">
        <!-- Left: customer selector -->
        <div class="gu-left">
          <div class="gu-left-header">
            <h3>Cliente</h3>
            <input id="gu-search" class="gu-search" type="text" placeholder="🔍 Buscar cliente..." autocomplete="off" />
          </div>
          <div id="gu-customer-list" class="gu-customer-list">
            <div class="gu-list-loading">Carregando clientes...</div>
          </div>
        </div>
        <!-- Right: action cards -->
        <div class="gu-right">
          <!-- Selected customer bar -->
          <div id="gu-selection-bar" class="gu-selection-bar empty">
            <div class="gu-selection-placeholder">← Selecione um cliente para continuar</div>
          </div>

          <!-- GCDR Sync card -->
          <div class="gu-card">
            <div class="gu-card-header">
              <div class="gu-card-icon gcdr">🔗</div>
              <div class="gu-card-meta">
                <div class="gu-card-title">GCDR Sync</div>
                <div class="gu-card-desc">Sincronize a estrutura de dispositivos do cliente com o tenant GCDR correspondente.</div>
              </div>
            </div>
            <div class="gu-card-body">
              <div class="gu-attr-row">
                <div class="gu-attr-label">GCDR Tenant ID</div>
                <div id="gu-gcdr-tenant-id" class="gu-attr-value muted">—</div>
              </div>
              <div class="gu-attr-row">
                <div class="gu-attr-label">Customer ID</div>
                <div id="gu-gcdr-customer-id" class="gu-attr-value muted">—</div>
              </div>
            </div>
            <div class="gu-card-footer">
              <div id="gu-gcdr-status" class="gu-status-msg"></div>
              <div class="gu-btn-group">
                <button id="gu-btn-gcdr" class="gu-btn gu-btn-gcdr" disabled>
                  <span>🔗</span><span>Sincronizar GCDR</span>
                </button>
                <button id="gu-btn-force-update" class="gu-btn gu-btn-force" disabled>
                  <span>⚡</span><span>Force Update IDs</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Upsell Setup card -->
          <div class="gu-card">
            <div class="gu-card-header">
              <div class="gu-card-icon upsell">⚡</div>
              <div class="gu-card-meta">
                <div class="gu-card-title">Upsell Setup</div>
                <div class="gu-card-desc">Configure features premium e planos de upsell para os dispositivos do cliente.</div>
              </div>
            </div>
            <div class="gu-card-body">
              <div class="gu-attr-row">
                <div class="gu-attr-label">Ingestion Token</div>
                <div id="gu-upsell-token-status" class="gu-attr-value muted">Obtido ao abrir</div>
              </div>
              <div class="gu-attr-row">
                <div class="gu-attr-label">TB Token</div>
                <div id="gu-upsell-tb-status" class="gu-attr-value muted">jwt_token local</div>
              </div>
            </div>
            <div class="gu-card-footer">
              <div id="gu-upsell-status" class="gu-status-msg"></div>
              <button id="gu-btn-upsell" class="gu-btn gu-btn-upsell" disabled>
                <span>⚡</span><span>Abrir Upsell</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`
  );

  // --- References ---
  const root          = container.querySelector('.gu-root');
  const searchEl      = root.querySelector('#gu-search');
  const listEl        = root.querySelector('#gu-customer-list');
  const selectionBar  = root.querySelector('#gu-selection-bar');
  const gcdrTenantEl  = root.querySelector('#gu-gcdr-tenant-id');
  const gcdrCustEl    = root.querySelector('#gu-gcdr-customer-id');
  const gcdrStatusEl  = root.querySelector('#gu-gcdr-status');
  const upsellStatusEl = root.querySelector('#gu-upsell-status');
  const btnGCDR        = root.querySelector('#gu-btn-gcdr');
  const btnUpsell      = root.querySelector('#gu-btn-upsell');
  const btnForceUpdate = root.querySelector('#gu-btn-force-update');

  // --- State ---
  let selectedCustomer = null; // { id, name }
  let gcdrTenantId = null;
  let allCustomersSorted = []; // [[key, {id,name}], ...]

  // --- Helpers ---
  function setAttr(el, value, colorClass) {
    el.textContent = value || '—';
    el.className = 'gu-attr-value' + (colorClass ? ' ' + colorClass : '');
  }

  function setStatus(el, state, msg) {
    el.textContent = msg || '';
    el.className = 'gu-status-msg' + (state ? ' ' + state : '');
  }

  function setBtnLoading(btn, loading) {
    if (loading) {
      btn.disabled = true;
      const spinner = document.createElement('span');
      spinner.className = 'gu-spinner';
      spinner.dataset.spinner = '1';
      btn.insertBefore(spinner, btn.firstChild);
    } else {
      btn.disabled = !selectedCustomer;
      const s = btn.querySelector('[data-spinner]');
      if (s) s.remove();
      // Sync force-update btn state
      if (btnForceUpdate) btnForceUpdate.disabled = !selectedCustomer;
    }
  }

  function renderSelectionBar(customer) {
    if (!customer) {
      selectionBar.className = 'gu-selection-bar empty';
      selectionBar.innerHTML = '<div class="gu-selection-placeholder">← Selecione um cliente para continuar</div>';
      return;
    }
    selectionBar.className = 'gu-selection-bar';
    selectionBar.innerHTML = `
      <div class="gu-selection-icon">🏢</div>
      <div class="gu-selection-info">
        <div class="gu-selection-name">${customer.name}</div>
        <div class="gu-selection-id">${customer.id}</div>
      </div>
    `;
  }

  // --- Customer list ---
  function renderList(filter) {
    const query = (filter || '').toLowerCase();
    listEl.innerHTML = '';
    const filtered = allCustomersSorted.filter(([, c]) => (c.name || '').toLowerCase().includes(query));

    if (!filtered.length) {
      listEl.innerHTML = '<div class="gu-no-results">Nenhum cliente encontrado</div>';
      return;
    }

    filtered.forEach(([, c]) => {
      const item = document.createElement('div');
      item.className = 'gu-customer-item' + (selectedCustomer?.id === c.id ? ' selected' : '');
      item.textContent = c.name;
      item.addEventListener('click', () => selectCustomer(c));
      listEl.appendChild(item);
    });
  }

  // Load customers
  guFetchAllCustomers()
    .then((customers) => {
      allCustomersSorted = Object.entries(customers).sort(([, a], [, b]) =>
        (a.name || '').localeCompare(b.name || '', 'pt-BR')
      );
      renderList('');
      searchEl.addEventListener('input', (e) => renderList(e.target.value));
    })
    .catch((err) => {
      listEl.innerHTML = `<div class="gu-list-error">Erro ao carregar:<br>${err.message}</div>`;
    });

  // --- Select customer ---
  async function selectCustomer(c) {
    selectedCustomer = c;
    gcdrTenantId = null;

    // Update list highlight
    renderList(searchEl.value);

    // Update selection bar
    renderSelectionBar(c);

    // Enable buttons
    btnGCDR.disabled = false;
    btnUpsell.disabled = false;
    btnForceUpdate.disabled = false;

    // Reset card attrs
    setAttr(gcdrTenantEl, 'Carregando...', '');
    setAttr(gcdrCustEl, c.id, '');
    setStatus(gcdrStatusEl, '', '');
    setStatus(upsellStatusEl, '', '');

    // Fetch gcdrTenantId from SERVER_SCOPE
    try {
      const attrs = await guFetchCustomerServerScopeAttrs(c.id);
      gcdrTenantId = attrs.gcdrTenantId ?? null;
      if (gcdrTenantId) {
        setAttr(gcdrTenantEl, gcdrTenantId, 'success');
      } else {
        setAttr(gcdrTenantEl, 'Não configurado', 'warn');
      }
    } catch (err) {
      setAttr(gcdrTenantEl, 'Erro ao buscar attrs', 'error');
      console.warn('[GU] fetchCustomerServerScopeAttrs failed:', err.message);
    }
  }

  // --- GCDR Sync ---
  btnGCDR.addEventListener('click', async () => {
    if (!selectedCustomer) return;
    try {
      setStatus(gcdrStatusEl, 'loading', 'Carregando biblioteca...');
      setBtnLoading(btnGCDR, true);

      const lib = await guLoadMyIOLibrary();

      const tbToken = localStorage.getItem('jwt_token');
      if (!tbToken) throw new Error('Token ThingsBoard não encontrado. Faça login novamente.');

      setStatus(gcdrStatusEl, 'loading', 'Abrindo modal...');

      lib.openGCDRSyncModal({
        thingsboardToken: tbToken,
        gcdrTenantId: gcdrTenantId,
        customerId: selectedCustomer.id,
        onSync: (result) => {
          console.log('[GU] GCDR sync result:', result);
          setStatus(gcdrStatusEl, 'success', 'Sincronização concluída com sucesso');
        },
        onClose: () => {
          setStatus(gcdrStatusEl, '', '');
        },
      });

      setStatus(gcdrStatusEl, 'success', 'Modal aberto');
    } catch (err) {
      console.error('[GU] GCDR sync error:', err);
      setStatus(gcdrStatusEl, 'error', err.message);
    } finally {
      setBtnLoading(btnGCDR, false);
    }
  });

  // ================================================================
  // Force Update GCDR Sync IDs — Modal
  // ================================================================

  function openForceUpdateModal() {
    if (!selectedCustomer) return;

    // State
    let step = 1; // 1=input, 2=match, 3=execute
    let parsedRows = [];
    let matchResults = [];
    let overlay;

    function closeModal() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function renderSteps() {
      const labels = ['Lista', 'Revisar', 'Executar'];
      return labels.map((label, i) => {
        const n = i + 1;
        const cls = n < step ? 'done' : n === step ? 'active' : '';
        const icon = n < step ? '✓' : n;
        return `
          ${i > 0 ? '<span class="gu-fu-step-sep">›</span>' : ''}
          <div class="gu-fu-step ${cls}">
            <div class="gu-fu-step-num">${icon}</div>
            <span>${label}</span>
          </div>`;
      }).join('');
    }

    function renderStep1() {
      return `
        <div class="gu-fu-label">Cole a lista de devices no formato pipe-separated:</div>
        <div class="gu-fu-hint">
          Formato: <code>gcdrId | parentAssetGcdrId | central_id | slave_id | name | display_name | tb_id</code><br>
          Match por <strong>slave_id</strong> + <strong>central_id</strong> (UUID do gateway) nos atributos SERVER_SCOPE do ThingsBoard.
        </div>
        <textarea class="gu-fu-textarea" id="gu-fu-textarea" placeholder="b7e919bb-...|122bccd5-...|d3202744-...|92|3F ESRL. PF-Escada 03|ER 3|24b58550-...
1a725d2a-...|..."></textarea>
        <div id="gu-fu-parse-error" class="gu-fu-parse-error"></div>`;
    }

    function renderStep2() {
      const total = matchResults.length;
      const nMatch = matchResults.filter((r) => r.status === 'MATCH').length;
      const nFail  = matchResults.filter((r) => r.status === 'FAIL').length;
      const nWarn  = matchResults.filter((r) => r.status === 'WARNING').length;

      const rows = matchResults.map((r) => {
        const statusLabel = r.status === 'WARNING' ? '⚠ WARN' : r.status === 'MATCH' ? '✓ MATCH' : '✗ FAIL';
        const tbInfo = r.tbMatches.length > 0
          ? r.tbMatches.map((m) => `<div>${m.name}</div><div class="gu-fu-uuid">${m.tbId}</div>`).join('')
          : '<span style="color:#9ca3af">—</span>';
        const centralShort = r.centralId.length > 8 ? r.centralId.substring(0, 8) + '…' : r.centralId;
        return `
          <tr>
            <td><span class="gu-fu-status ${r.status}">${statusLabel}</span></td>
            <td><strong>${r.slaveId}</strong></td>
            <td><span class="gu-fu-uuid" title="${r.centralId}">${centralShort}</span></td>
            <td>${r.name}<br><span style="color:#9ca3af;font-size:10px">${r.displayName}</span></td>
            <td>${tbInfo}</td>
            <td class="gu-fu-uuid">${r.gcdrDeviceId.substring(0, 8)}…</td>
          </tr>`;
      }).join('');

      return `
        <div class="gu-fu-summary">
          <span class="gu-fu-badge total">📋 ${total} linhas</span>
          <span class="gu-fu-badge match">✓ ${nMatch} match</span>
          ${nWarn ? `<span class="gu-fu-badge warn">⚠ ${nWarn} warning</span>` : ''}
          <span class="gu-fu-badge fail">✗ ${nFail} fail</span>
        </div>
        ${nWarn ? `<div class="gu-fu-parse-error" style="margin-bottom:12px">⚠ Devices com warning têm múltiplos matches no ThingsBoard — ambos serão atualizados se confirmar.</div>` : ''}
        <table class="gu-fu-table">
          <thead><tr>
            <th>Status</th><th>slaveId</th><th>centralId</th>
            <th>Nome / Label</th><th>Device TB (match)</th><th>GCDR ID</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    function renderStep3Body(results) {
      const ok  = results.filter((r) => r.ok);
      const err = results.filter((r) => !r.ok);
      const items = results.map((r) => `
        <li class="gu-fu-result-item">
          <span class="gu-fu-result-icon">${r.ok ? '✅' : '❌'}</span>
          <div>
            <div class="gu-fu-result-name">${r.name} <span style="font-weight:400;color:#9ca3af">(slave ${r.slaveId} / ${r.centralId})</span></div>
            ${r.ok
              ? `<div class="gu-fu-result-msg">gcdrDeviceId gravado no ThingsBoard</div>`
              : `<div class="gu-fu-result-err">${r.error}</div>`}
          </div>
        </li>`).join('');
      return `
        <div class="gu-fu-summary" style="margin-bottom:16px">
          <span class="gu-fu-badge match">✓ ${ok.length} atualizados</span>
          ${err.length ? `<span class="gu-fu-badge fail">✗ ${err.length} erros</span>` : ''}
        </div>
        <ul class="gu-fu-result-list">${items}</ul>`;
    }

    function renderModal() {
      const footerStep1 = `
        <button class="gu-fu-btn gu-fu-btn-secondary" id="gu-fu-cancel">Cancelar</button>
        <button class="gu-fu-btn gu-fu-btn-primary" id="gu-fu-next1">Avançar →</button>`;
      const footerStep2 = `
        <button class="gu-fu-btn gu-fu-btn-secondary" id="gu-fu-back2">← Voltar</button>
        <button class="gu-fu-btn gu-fu-btn-primary" id="gu-fu-exec"
          ${matchResults.every((r) => r.status === 'FAIL') ? 'disabled' : ''}>
          ⚡ Executar Force Update
        </button>`;
      const footerStep3Done = `
        <button class="gu-fu-btn gu-fu-btn-success" id="gu-fu-done">Fechar</button>`;

      overlay.innerHTML = `
        <div class="gu-fu-modal">
          <div class="gu-fu-header">
            <div>
              <div class="gu-fu-title">⚡ Force Update GCDR Sync IDs</div>
              <div class="gu-fu-subtitle">Customer: ${selectedCustomer.name}</div>
            </div>
            <button class="gu-fu-close" id="gu-fu-x">✕</button>
          </div>
          <div class="gu-fu-steps">${renderSteps()}</div>
          <div class="gu-fu-body" id="gu-fu-body">
            ${step === 1 ? renderStep1() : step === 2 ? renderStep2() : '<div style="color:#6b7280;font-size:13px">Processando...</div>'}
          </div>
          <div class="gu-fu-footer">
            ${step === 1 ? footerStep1 : step === 2 ? footerStep2 : ''}
          </div>
        </div>`;

      // Bind close
      overlay.querySelector('#gu-fu-x')?.addEventListener('click', closeModal);
      overlay.querySelector('#gu-fu-cancel')?.addEventListener('click', closeModal);
      overlay.querySelector('#gu-fu-done')?.addEventListener('click', closeModal);

      // Step 1 → 2
      overlay.querySelector('#gu-fu-next1')?.addEventListener('click', () => {
        const text = overlay.querySelector('#gu-fu-textarea').value.trim();
        const errEl = overlay.querySelector('#gu-fu-parse-error');
        parsedRows = guParseForceList(text);
        if (!parsedRows.length) {
          errEl.textContent = 'Nenhuma linha válida encontrada. Verifique o formato (7 campos separados por |).';
          return;
        }
        errEl.textContent = '';
        // Show rich loading panel
        overlay.querySelector('#gu-fu-body').innerHTML = `
          <div style="padding:4px 0">
            <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:14px">
              ⏳ Buscando devices e atributos do ThingsBoard…
            </div>

            <div class="gu-fu-progress-bar-bg" style="margin-bottom:6px">
              <div class="gu-fu-progress-bar" id="gu-fu-match-prog" style="width:0%"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:18px">
              <div class="gu-fu-progress-label" id="gu-fu-match-phase">Iniciando…</div>
              <div style="font-size:13px;font-weight:700;color:#b45309" id="gu-fu-match-pct">0%</div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div style="background:#f3f4f6;border-radius:8px;padding:12px">
                <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Filtro da lista</div>
                <div style="font-size:20px;font-weight:700;color:#1f2937" id="gu-fu-stat-filter">—</div>
                <div style="font-size:10px;color:#9ca3af">devices na lista de entrada</div>
              </div>
              <div style="background:#f3f4f6;border-radius:8px;padding:12px">
                <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Total no customer</div>
                <div style="font-size:20px;font-weight:700;color:#1f2937" id="gu-fu-stat-total">—</div>
                <div style="font-size:10px;color:#9ca3af">devices encontrados no TB</div>
              </div>
              <div style="background:#d1fae5;border-radius:8px;padding:12px">
                <div style="font-size:11px;color:#065f46;margin-bottom:4px">Enriquecidos</div>
                <div style="font-size:20px;font-weight:700;color:#065f46" id="gu-fu-stat-enriched">0</div>
                <div style="font-size:10px;color:#6ee7b7">attrs SERVER_SCOPE carregados</div>
              </div>
              <div style="background:#fee2e2;border-radius:8px;padding:12px">
                <div style="font-size:11px;color:#991b1b;margin-bottom:4px">Descartados</div>
                <div style="font-size:20px;font-weight:700;color:#991b1b" id="gu-fu-stat-discard">0</div>
                <div style="font-size:10px;color:#fca5a5">sem slaveId ou centralId</div>
              </div>
            </div>
          </div>`;
        overlay.querySelector('.gu-fu-footer').innerHTML = '';

        const onMatchProgress = (stats) => {
          const pct = stats.total > 0 ? Math.round((stats.enriched / stats.total) * 100) : 0;
          const q = (id) => overlay.querySelector(id);
          const set = (id, v) => { const el = q(id); if (el) el.textContent = v; };
          set('#gu-fu-match-pct',    pct + '%');
          set('#gu-fu-match-phase',  stats.phase || '');
          set('#gu-fu-stat-filter',  stats.filterCount ?? '—');
          set('#gu-fu-stat-total',   stats.total    > 0 ? stats.total    : '—');
          set('#gu-fu-stat-enriched', stats.enriched);
          set('#gu-fu-stat-discard',  stats.discarded);
          const progEl = q('#gu-fu-match-prog');
          if (progEl) progEl.style.width = pct + '%';
        };

        guRunMatch(parsedRows, onMatchProgress)
          .then((results) => {
            matchResults = results;
            step = 2;
            renderModal();
          })
          .catch((err) => {
            overlay.querySelector('#gu-fu-body').innerHTML =
              `<div style="color:#ef4444;font-size:13px">Erro: ${err.message}</div>`;
          });
      });

      // Step 2 → back
      overlay.querySelector('#gu-fu-back2')?.addEventListener('click', () => {
        step = 1;
        renderModal();
      });

      // Step 2 → execute
      overlay.querySelector('#gu-fu-exec')?.addEventListener('click', () => {
        step = 3;
        overlay.querySelector('.gu-fu-footer').innerHTML = '';
        overlay.querySelector('#gu-fu-body').innerHTML =
          `<div class="gu-fu-progress-wrap">
            <div class="gu-fu-progress-bar-bg"><div class="gu-fu-progress-bar" id="gu-fu-prog" style="width:0%"></div></div>
            <div class="gu-fu-progress-label" id="gu-fu-prog-label">Iniciando...</div>
          </div>`;

        guRunExec(matchResults, (current, total, name) => {
          const pct = total ? Math.round((current / total) * 100) : 0;
          const progEl = overlay.querySelector('#gu-fu-prog');
          const lblEl = overlay.querySelector('#gu-fu-prog-label');
          if (progEl) progEl.style.width = pct + '%';
          if (lblEl) lblEl.textContent = `${current}/${total} — ${name}`;
        }).then((execResults) => {
          const body = overlay.querySelector('#gu-fu-body');
          body.innerHTML = renderStep3Body(execResults);
          overlay.querySelector('.gu-fu-footer').innerHTML =
            `<button class="gu-fu-btn gu-fu-btn-success" id="gu-fu-done">Fechar</button>`;
          overlay.querySelector('#gu-fu-done')?.addEventListener('click', closeModal);
        });
      });
    }

    // Create overlay
    overlay = document.createElement('div');
    overlay.className = 'gu-fu-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
    renderModal();
  }

  const guSleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Match: fetch all TB devices + attrs, then match by slaveId + centralId
  async function guRunMatch(rows, onProgress) {
    const filterCount = rows.length;
    onProgress?.({ phase: 'Buscando lista de devices no customer…', filterCount, total: 0, enriched: 0, discarded: 0 });

    const devices = await guFetchCustomerDevices(selectedCustomer.id);
    const total = devices.length;
    onProgress?.({ phase: `${total} devices encontrados — carregando atributos…`, filterCount, total, enriched: 0, discarded: 0 });

    // Batch fetch attrs: 10 concurrent, 1s delay between batches
    const deviceAttrsMap = new Map();
    const chunks = [];
    for (let i = 0; i < total; i += 10) chunks.push(devices.slice(i, i + 10));

    let enriched = 0;
    let discarded = 0;

    for (let ci = 0; ci < chunks.length; ci++) {
      if (ci > 0) await guSleep(1000);
      await Promise.all(chunks[ci].map(async (dev) => {
        const tbId = dev.id?.id || dev.id;
        const attrs = await guFetchDeviceServerScopeAttrs(tbId);
        const hasKey = !!(attrs.slaveId != null && attrs.centralId != null &&
                          String(attrs.slaveId).trim() && String(attrs.centralId).trim());
        if (hasKey) {
          deviceAttrsMap.set(tbId, { name: dev.name, tbId, attrs });
          enriched++;
        } else {
          discarded++;
        }
        onProgress?.({
          phase: `Lote ${ci + 1}/${chunks.length} — ${enriched + discarded}/${total} processados`,
          filterCount,
          total,
          enriched,
          discarded,
        });
      }));
    }

    // Match each row
    return rows.map((row) => {
      const rowSlave   = String(row.slaveId).trim();
      const rowCentral = String(row.centralId).trim();

      const matches = [];
      for (const [, info] of deviceAttrsMap) {
        const tbSlave   = String(info.attrs.slaveId   ?? '').trim();
        const tbCentral = String(info.attrs.centralId ?? '').trim();
        if (tbSlave === rowSlave && tbCentral === rowCentral) {
          matches.push(info);
        }
      }

      return {
        ...row,
        status:    matches.length === 0 ? 'FAIL' : matches.length === 1 ? 'MATCH' : 'WARNING',
        tbMatches: matches,
      };
    });
  }

  // Execute: write gcdrDeviceId + gcdrAssetId + gcdrSyncedAt to TB
  // Batched: 10 saves per batch, 1s delay between batches
  async function guRunExec(matchResults, onProgress) {
    const syncedAt = new Date().toISOString();

    // Flatten: one entry per (row × tbMatch) pair
    const tasks = [];
    for (const row of matchResults.filter((r) => r.status !== 'FAIL')) {
      for (const match of row.tbMatches) {
        tasks.push({ row, match });
      }
    }
    const total = tasks.length;
    const results = [];
    let current = 0;

    // Process in batches of 10 with 1s delay between batches
    const chunks = [];
    for (let i = 0; i < tasks.length; i += 10) chunks.push(tasks.slice(i, i + 10));

    for (let ci = 0; ci < chunks.length; ci++) {
      if (ci > 0) await guSleep(1000);
      await Promise.all(chunks[ci].map(async ({ row, match }) => {
        current++;
        onProgress(current, total, row.name);
        try {
          await guSaveDeviceServerScopeAttrs(match.tbId, {
            gcdrDeviceId: row.gcdrDeviceId,
            gcdrAssetId:  row.gcdrParentAssetId,
            gcdrSyncedAt: syncedAt,
          });
          results.push({ ...row, tbId: match.tbId, tbName: match.name, ok: true });
        } catch (err) {
          results.push({ ...row, tbId: match.tbId, tbName: match.name, ok: false, error: err.message });
        }
      }));
    }
    return results;
  }

  // --- Force Update button ---
  btnForceUpdate.addEventListener('click', () => {
    if (!selectedCustomer) return;
    openForceUpdateModal();
  });

  // --- Upsell Setup ---
  btnUpsell.addEventListener('click', async () => {
    if (!selectedCustomer) return;
    try {
      setStatus(upsellStatusEl, 'loading', 'Carregando biblioteca...');
      setBtnLoading(btnUpsell, true);

      const lib = await guLoadMyIOLibrary();

      const tbToken = localStorage.getItem('jwt_token');
      if (!tbToken) throw new Error('Token ThingsBoard não encontrado. Faça login novamente.');

      setStatus(upsellStatusEl, 'loading', 'Obtendo token de ingestion...');
      const ingestionToken = await MyIOAuth.getToken();

      setAttr(root.querySelector('#gu-upsell-token-status'), '✓ Obtido', 'success');
      setAttr(root.querySelector('#gu-upsell-tb-status'), '✓ Disponível', 'success');
      setStatus(upsellStatusEl, 'loading', 'Abrindo modal...');

      lib.openUpsellModal({
        thingsboardToken: tbToken,
        ingestionToken: ingestionToken,
        lang: 'pt',
        preselectedCustomer: { id: selectedCustomer.id, name: selectedCustomer.name },
        onSave: (deviceId, attributes) => {
          console.log('[GU] Upsell saved device:', deviceId, attributes);
          setStatus(upsellStatusEl, 'success', `Salvo: ${deviceId}`);
        },
        onClose: () => {
          setStatus(upsellStatusEl, '', '');
        },
      });

      setStatus(upsellStatusEl, 'success', 'Modal aberto');
    } catch (err) {
      console.error('[GU] Upsell error:', err);
      setStatus(upsellStatusEl, 'error', err.message);
    } finally {
      setBtnLoading(btnUpsell, false);
    }
  });
};
