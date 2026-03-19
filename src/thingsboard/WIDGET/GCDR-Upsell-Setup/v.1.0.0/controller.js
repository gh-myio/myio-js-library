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
      _inFlight = _requestNewToken().finally(() => {
        _inFlight = null;
      });
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

async function guFetchCustomerTBAssets(customerId) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('JWT não disponível');
  const headers = { 'X-Authorization': `Bearer ${token}` };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let assets = [];
  let page = 0;
  while (true) {
    if (page > 0) await sleep(500);
    const res = await fetch(`/api/customer/${customerId}/assets?pageSize=1000&page=${page}`, { headers });
    if (!res.ok) throw new Error(`Erro ao buscar assets TB: HTTP ${res.status}`);
    const data = await res.json();
    assets = assets.concat(data.data || []);
    if (!data.hasNext) break;
    page++;
  }
  return assets;
}

async function guFetchDeviceParentAssetId(deviceTbId) {
  const token = localStorage.getItem('jwt_token');
  if (!token) return null;
  try {
    const res = await fetch(`/api/relations?entityId=${deviceTbId}&entityType=DEVICE&direction=TO`, {
      headers: { 'X-Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const relations = await res.json();
    const assetRel = (relations || []).find((r) => r.from?.entityType === 'ASSET');
    return assetRel?.from?.id ?? null;
  } catch {
    return null;
  }
}

async function guFetchDeviceServerScopeAttrs(deviceId) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('JWT não disponível');
  const res = await fetch(`/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`, {
    headers: { 'X-Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return {};
  const payload = await res.json();
  const map = {};
  if (Array.isArray(payload))
    payload.forEach((a) => {
      map[a.key] = a.value;
    });
  return map;
}

async function guSaveDeviceServerScopeAttrs(deviceId, attrs) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('JWT não disponível');
  const res = await fetch(`/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
    body: JSON.stringify(attrs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function guSaveAssetServerScopeAttrs(assetId, attrs) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('JWT não disponível');
  const res = await fetch(`/api/plugins/telemetry/ASSET/${assetId}/attributes/SERVER_SCOPE`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
    body: JSON.stringify(attrs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/**
 * Delete specific SERVER_SCOPE attributes from a TB device.
 * DELETE /api/plugins/telemetry/DEVICE/{id}/attributes/SERVER_SCOPE?keys=a,b,c
 */
/**
 * Delete specific SERVER_SCOPE attributes from a TB device.
 * TB DELETE endpoint uses /{entityType}/{entityId}/{scope} (no "attributes/" prefix).
 * DELETE /api/plugins/telemetry/DEVICE/{id}/SERVER_SCOPE?keys=a,b,c
 */
async function guDeleteDeviceServerScopeAttrs(deviceId, keys) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('JWT não disponível');
  const qs = keys.join(',');
  const res = await fetch(`/api/plugins/telemetry/DEVICE/${deviceId}/SERVER_SCOPE?keys=${qs}`, {
    method: 'DELETE',
    headers: { 'X-Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function guFetchAssetServerScopeAttrs(assetId) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('JWT não disponível');
  const res = await fetch(`/api/plugins/telemetry/ASSET/${assetId}/values/attributes/SERVER_SCOPE`, {
    headers: { 'X-Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return {};
  const payload = await res.json();
  const map = {};
  if (Array.isArray(payload)) payload.forEach((a) => { map[a.key] = a.value; });
  return map;
}

async function guDeleteAssetServerScopeAttrs(assetId, keys) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('JWT não disponível');
  const qs = keys.join(',');
  const res = await fetch(`/api/plugins/telemetry/ASSET/${assetId}/SERVER_SCOPE?keys=${qs}`, {
    method: 'DELETE',
    headers: { 'X-Authorization': `Bearer ${token}` },
  });
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
        gcdrDeviceId: p[0].trim(), // [0] GCDR device ID
        gcdrParentAssetId: p[1].trim(), // [1] parent asset GCDR ID
        centralId: p[2].trim(), // [2] central_id UUID (gateway) — used for matching
        slaveId: String(p[3].trim()), // [3] slave_id number — used for matching
        name: p[4].trim(), // [4] device name
        displayName: p[5].trim(), // [5] display_name / label (UI only)
        tbDeviceId: p[6].trim(), // [6] TB device ID (reference)
      };
    })
    .filter(Boolean);
}

// ============================================================
// MyIO Library loader (CDN, on-demand)
// ============================================================
function guLoadMyIOLibrary() {
  return new Promise((resolve, reject) => {
    if (
      typeof window.MyIOLibrary !== 'undefined' &&
      typeof window.MyIOLibrary.openUpsellModal === 'function'
    ) {
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

    .gu-btn-sync-id {
      background: #1d4ed8;
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
    .gu-btn-sync-id:hover:not(:disabled) { background: #1e40af; }
    .gu-btn-sync-id:disabled { opacity: 0.45; cursor: not-allowed; }

    /* Force Clear button */
    .gu-btn-force-clear {
      background: #dc2626;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 14px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .gu-btn-force-clear:hover:not(:disabled) { background: #b91c1c; }
    .gu-btn-force-clear:disabled { opacity: 0.45; cursor: not-allowed; }

    /* Raio X button */
    .gu-btn-raiox {
      background: linear-gradient(180deg, #7c3aed, #5b21b6);
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
      box-shadow: 0 2px 8px rgba(91,33,182,0.3);
    }
    .gu-btn-raiox:hover:not(:disabled) { background: linear-gradient(180deg, #6d28d9, #4c1d95); }
    .gu-btn-raiox:disabled { opacity: 0.45; cursor: not-allowed; }

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
              <div class="gu-attr-row">
                <div class="gu-attr-label">API Key</div>
                <div id="gu-gcdr-api-key" class="gu-attr-value muted">—</div>
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
                <button id="gu-btn-sync-force-id" class="gu-btn gu-btn-sync-id" disabled>
                  <span>🔄</span><span>GCDR Sync Force ID</span>
                </button>
                <button id="gu-btn-force-clear" class="gu-btn gu-btn-force-clear" disabled>
                  <span>🧹</span><span>Force Clear GCDR IDs</span>
                </button>
                <button id="gu-btn-raiox" class="gu-btn gu-btn-raiox" disabled>
                  <span>⚡</span><span>Raio X</span>
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
  const root = container.querySelector('.gu-root');
  const searchEl = root.querySelector('#gu-search');
  const listEl = root.querySelector('#gu-customer-list');
  const selectionBar = root.querySelector('#gu-selection-bar');
  const gcdrTenantEl = root.querySelector('#gu-gcdr-tenant-id');
  const gcdrCustEl = root.querySelector('#gu-gcdr-customer-id');
  const gcdrApiKeyEl = root.querySelector('#gu-gcdr-api-key');
  const gcdrStatusEl = root.querySelector('#gu-gcdr-status');
  const upsellStatusEl = root.querySelector('#gu-upsell-status');
  const btnGCDR = root.querySelector('#gu-btn-gcdr');
  const btnUpsell = root.querySelector('#gu-btn-upsell');
  const btnForceUpdate = root.querySelector('#gu-btn-force-update');
  const btnSyncForceId = root.querySelector('#gu-btn-sync-force-id');
  const btnForceClear = root.querySelector('#gu-btn-force-clear');
  const btnRaioX = root.querySelector('#gu-btn-raiox');

  // --- State ---
  let selectedCustomer = null; // { id, name }
  let gcdrTenantId = null;
  let gcdrCustomerId = null; // GCDR customer UUID (SERVER_SCOPE attr gcdrCustomerId / gcdrId)
  let gcdrApiKey = null; // customer-specific GCDR API key (gcdrApiKey SERVER_SCOPE attr)
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
      // Sync secondary button states
      if (btnForceUpdate) btnForceUpdate.disabled = !selectedCustomer;
      if (btnSyncForceId) btnSyncForceId.disabled = !selectedCustomer;
      if (btnForceClear) btnForceClear.disabled = !selectedCustomer;
      if (btnRaioX) btnRaioX.disabled = !selectedCustomer;
    }
  }

  function renderSelectionBar(customer) {
    if (!customer) {
      selectionBar.className = 'gu-selection-bar empty';
      selectionBar.innerHTML =
        '<div class="gu-selection-placeholder">← Selecione um cliente para continuar</div>';
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
    if (btnSyncForceId) btnSyncForceId.disabled = false;
    if (btnForceClear) btnForceClear.disabled = false;
    if (btnRaioX) btnRaioX.disabled = false;

    // Reset card attrs
    setAttr(gcdrTenantEl, 'Carregando...', '');
    setAttr(gcdrCustEl, 'Carregando...', '');
    setAttr(gcdrApiKeyEl, 'Carregando...', '');
    setStatus(gcdrStatusEl, '', '');
    setStatus(upsellStatusEl, '', '');
    gcdrCustomerId = null;

    // Fetch gcdrTenantId + gcdrCustomerId + gcdrApiKey from SERVER_SCOPE.
    // Priority: integration_setup.gcdr (JSON attr) → individual attrs (gcdrTenantId / gcdrCustomerId / gcdrApiKey)
    try {
      const attrs = await guFetchCustomerServerScopeAttrs(c.id);

      // 1) Try integration_setup.gcdr first
      let gcdrCfg = null;
      const rawIntegration = attrs.integration_setup;
      if (rawIntegration) {
        try {
          const parsed = typeof rawIntegration === 'string' ? JSON.parse(rawIntegration) : rawIntegration;
          gcdrCfg = parsed?.gcdr ?? null;
          if (gcdrCfg) console.log('[GU] GCDR config from integration_setup.gcdr:', gcdrCfg);
        } catch (e) {
          console.warn('[GU] Failed to parse integration_setup:', e);
        }
      }

      // 2) Resolve values — integration_setup.gcdr wins; individual attrs as fallback
      gcdrTenantId  = gcdrCfg?.gcdrTenantId  ?? attrs.gcdrTenantId  ?? null;
      gcdrApiKey    = gcdrCfg?.gcdrApiKey     ?? attrs.gcdrApiKey    ?? null;
      gcdrCustomerId = gcdrCfg?.gcdrCustomerId ?? attrs.gcdrCustomerId ?? attrs.gcdrId ?? null;

      if (!gcdrCfg) {
        console.log('[GU] integration_setup.gcdr not found — using individual SERVER_SCOPE attrs');
      }

      if (gcdrTenantId) {
        setAttr(gcdrTenantEl, gcdrTenantId, 'success');
      } else {
        setAttr(gcdrTenantEl, 'Não configurado', 'warn');
      }
      if (gcdrCustomerId) {
        setAttr(gcdrCustEl, gcdrCustomerId, 'success');
      } else {
        setAttr(gcdrCustEl, 'Não configurado — defina gcdrCustomerId em SERVER_SCOPE', 'warn');
      }
      if (gcdrApiKey) {
        setAttr(gcdrApiKeyEl, gcdrApiKey, 'success');
      } else {
        setAttr(gcdrApiKeyEl, 'Não configurado — defina gcdrApiKey em SERVER_SCOPE', 'warn');
      }
    } catch (err) {
      setAttr(gcdrTenantEl, 'Erro ao buscar attrs', 'error');
      setAttr(gcdrCustEl, 'Erro ao buscar attrs', 'error');
      setAttr(gcdrApiKeyEl, 'Erro ao buscar attrs', 'error');
      console.warn('[GU] fetchCustomerServerScopeAttrs failed:', err.message);
    }
  }

  // --- GCDR Sync (inline upsert: UPDATE existing + CREATE missing) ---
  btnGCDR.addEventListener('click', () => {
    if (!selectedCustomer) return;
    openGCDRSyncInlineModal();
  });

  // ================================================================
  // GCDR Sync Force ID — fetch ALL GCDR customer devices (paginated),
  // match by centralId+slaveId (primary) or externalId (fallback),
  // write gcdrDeviceId back to TB SERVER_SCOPE.
  // API key: gcdrApiKey from customer SERVER_SCOPE attr.
  // ================================================================

  // Fetch ALL devices for a GCDR customer (paginated, limit=100).
  // Endpoint: GET /api/v1/customers/{gcdrCustomerId}/devices
  async function guFetchGCDRCustomerDevices(gcdrCustomerId, tenantId, apiKey) {
    const GCDR_BASE = 'https://gcdr-api.a.myio-bas.com';
    const resolvedKey = apiKey || 'gcdr_cust_tb_master_key_2026';
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const headers = {
      'X-API-Key': resolvedKey,
      'x-tenant-id': tenantId || '',
      Accept: 'application/json',
    };

    console.group('[GCDR Sync] guFetchGCDRCustomerDevices — config');
    console.log('gcdrCustomerId :', gcdrCustomerId);
    console.log('tenantId       :', tenantId);
    console.log('apiKey (raw)   :', apiKey);
    console.log('apiKey (used)  :', resolvedKey);
    console.log('headers        :', headers);
    console.groupEnd();

    const devices = [];
    let page = 1;
    while (true) {
      if (page > 1) await sleep(500);
      const url =
        `${GCDR_BASE}/api/v1/customers/${encodeURIComponent(gcdrCustomerId)}/devices` +
        `?limit=100&page=${page}`;

      console.log(`[GCDR Sync] GET ${url} (page ${page})`);
      const res = await fetch(url, { headers });
      console.log(`[GCDR Sync] response status: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        let body = '';
        try {
          body = await res.text();
        } catch {
          /* ignore */
        }
        console.error('[GCDR Sync] error body:', body);
        throw new Error(`GCDR devices HTTP ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      console.log(`[GCDR Sync] page ${page} response:`, json);

      const data = Array.isArray(json.data) ? json.data : (json.items ?? []);
      devices.push(...data);

      const hasMore = json.pagination?.hasMore ?? json.hasMore ?? false;
      console.log(
        `[GCDR Sync] page ${page}: ${data.length} devices, hasMore=${hasMore}, total so far=${devices.length}`
      );

      if (!hasMore || data.length === 0) break;
      page++;
    }

    console.log(`[GCDR Sync] guFetchGCDRCustomerDevices done — ${devices.length} devices total`);
    return devices;
  }

  /**
   * Low-level GCDR API fetch helper.
   * Uses the customer-specific gcdrApiKey (from SERVER_SCOPE) with gcdrTenantId.
   */
  async function guGCDRFetch(method, path, body) {
    const GCDR_BASE = 'https://gcdr-api.a.myio-bas.com';
    const resolvedKey = gcdrApiKey || 'gcdr_cust_tb_master_key_2026';
    const headers = {
      'X-API-Key': resolvedKey,
      'x-tenant-id': gcdrTenantId || '',
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    };
    console.group(`[GCDR Sync] ${method} ${path}`);
    console.log('apiKey (used):', resolvedKey);
    console.log('tenantId     :', gcdrTenantId);
    if (body) console.log('body         :', body);
    console.groupEnd();
    const res = await fetch(`${GCDR_BASE}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    console.log(`[GCDR Sync] ${method} ${path} → ${res.status} ${res.statusText}`);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GCDR ${method} ${path} HTTP ${res.status}: ${text}`);
    }
    const json = await res.json().catch(() => null);
    return json?.data ?? json;
  }

  async function guFetchGCDRCustomerBundle(tbCustomerId, tenantId) {
    const GCDR_BASE = 'https://gcdr-api.a.myio-bas.com';
    const resolvedKey = gcdrApiKey || 'gcdr_cust_tb_master_key_2026';
    const url = `${GCDR_BASE}/api/v1/customers/external/${encodeURIComponent(tbCustomerId)}?deep=1`;
    console.group('[GCDR Sync] guFetchGCDRCustomerBundle');
    console.log('url          :', url);
    console.log('apiKey (used):', resolvedKey);
    console.log('tenantId     :', tenantId);
    console.groupEnd();
    const res = await fetch(url, {
      headers: {
        'X-API-Key': resolvedKey,
        'x-tenant-id': tenantId || '',
        Accept: 'application/json',
      },
    });
    console.log(`[GCDR Sync] guFetchGCDRCustomerBundle response: ${res.status} ${res.statusText}`);
    if (res.status === 404) return null; // customer not synced in GCDR yet
    if (!res.ok) throw new Error(`GCDR bundle HTTP ${res.status} ${res.statusText}`);
    const json = await res.json();
    return json.data ?? json; // { customer, assets, devices, rules }
  }

  // ================================================================
  // Sincronizar GCDR — RFC-0186
  // TB é a fonte da verdade.
  // Fase 0: Monta árvore TB (customer→assets→devices) via relations/info recursivo
  // Fase 1: Carrega bundle GCDR ?deep=1 e indexa em memória
  // Fase 2: Sincroniza assets (ordem topológica, um a um)
  // Fase 3: Sincroniza devices por asset (um a um, match por slaveId+centralId primeiro)
  // Devices sem slaveId E sem centralId são ignorados (log final).
  // ================================================================

  // ── TB tree helpers ──────────────────────────────────────────────

  async function guTbFetchRelations(id, type) {
    const token = localStorage.getItem('jwt_token');
    const res = await fetch(`/api/relations/info?fromId=${id}&fromType=${type}`, {
      headers: { 'X-Authorization': `Bearer ${token}` },
    });
    return res.ok ? await res.json() : [];
  }

  async function guTbFetchEntity(id, type) {
    const token = localStorage.getItem('jwt_token');
    const res = await fetch(`/api/${type.toLowerCase()}/${id}`, {
      headers: { 'X-Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return { name: `${type} ${id}`, label: '', type: '' };
    return await res.json();
  }

  async function guTbFetchEntityServerScope(id, type) {
    const token = localStorage.getItem('jwt_token');
    const res = await fetch(
      `/api/plugins/telemetry/${type.toUpperCase()}/${id}/values/attributes/SERVER_SCOPE`,
      { headers: { 'X-Authorization': `Bearer ${token}` } }
    );
    if (!res.ok) return {};
    const arr = await res.json();
    const map = {};
    if (Array.isArray(arr))
      arr.forEach((a) => {
        map[a.key] = a.value;
      });
    return map;
  }

  async function guTbCreateAsset(customerId, name) {
    const token = localStorage.getItem('jwt_token');
    const res = await fetch('/api/asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, type: 'default', label: name }),
    });
    if (!res.ok) throw new Error(`Criar asset TB HTTP ${res.status}`);
    return await res.json();
  }

  async function guTbCreateRelation(fromId, fromType, toId, toType) {
    const token = localStorage.getItem('jwt_token');
    const res = await fetch('/api/relation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        from: { id: fromId, entityType: fromType },
        to: { id: toId, entityType: toType },
        type: 'Contains',
      }),
    });
    if (!res.ok) throw new Error(`Criar relação TB HTTP ${res.status}`);
  }

  // Visita recursiva: CUSTOMER → ASSET → DEVICE
  // Retorna { id, name, label, type, scope, children:[], devices:[] }
  async function guTbBuildAssetNode(assetId, visited) {
    const key = `ASSET:${assetId}`;
    if (visited.has(key)) return null;
    visited.add(key);

    const [entity, scope, rels] = await Promise.all([
      guTbFetchEntity(assetId, 'ASSET'),
      guTbFetchEntityServerScope(assetId, 'ASSET'),
      guTbFetchRelations(assetId, 'ASSET'),
    ]);

    const node = {
      id: assetId,
      name: entity.name || '',
      label: entity.label || '',
      type: entity.type || '',
      scope,
      children: [],
      devices: [],
    };

    for (const rel of rels) {
      const child = rel.to;
      if (!child) continue;
      if (child.entityType === 'ASSET') {
        const sub = await guTbBuildAssetNode(child.id, visited);
        if (sub) node.children.push(sub);
      } else if (child.entityType === 'DEVICE') {
        const devKey = `DEVICE:${child.id}`;
        if (visited.has(devKey)) continue;
        visited.add(devKey);
        const [dev, devScope] = await Promise.all([
          guTbFetchEntity(child.id, 'DEVICE'),
          guTbFetchEntityServerScope(child.id, 'DEVICE'),
        ]);
        node.devices.push({
          id: child.id,
          name: dev.name || '',
          label: dev.label || '',
          type: dev.type || '',
          scope: devScope,
        });
      }
    }
    return node;
  }

  async function guTbBuildTree(customerId, customerName) {
    const visited = new Set([`CUSTOMER:${customerId}`]);
    const rels = await guTbFetchRelations(customerId, 'CUSTOMER');

    const assets = [];
    const orphanDevices = [];

    for (const rel of rels) {
      const child = rel.to;
      if (!child) continue;
      if (child.entityType === 'ASSET') {
        const node = await guTbBuildAssetNode(child.id, visited);
        if (node) assets.push(node);
      } else if (child.entityType === 'DEVICE') {
        const devKey = `DEVICE:${child.id}`;
        if (visited.has(devKey)) continue;
        visited.add(devKey);
        const [dev, devScope] = await Promise.all([
          guTbFetchEntity(child.id, 'DEVICE'),
          guTbFetchEntityServerScope(child.id, 'DEVICE'),
        ]);
        orphanDevices.push({
          id: child.id,
          name: dev.name || '',
          label: dev.label || '',
          type: dev.type || '',
          scope: devScope,
        });
      }
    }

    // Helper: encontra ou cria o asset fallback DevicesSemAsset
    async function ensureFallbackAsset() {
      const fallbackName = `DevicesSemAsset${customerName}`;
      let fallbackAsset = assets.find((a) => a.name === fallbackName);
      if (!fallbackAsset) {
        console.log(`[GCDR Sync] Criando asset fallback TB: "${fallbackName}"`);
        const created = await guTbCreateAsset(customerId, fallbackName);
        await guTbCreateRelation(customerId, 'CUSTOMER', created.id.id, 'ASSET');
        const scope = await guTbFetchEntityServerScope(created.id.id, 'ASSET');
        fallbackAsset = {
          id: created.id.id,
          name: fallbackName,
          label: fallbackName,
          type: 'default',
          scope,
          children: [],
          devices: [],
        };
        assets.push(fallbackAsset);
      }
      return fallbackAsset;
    }

    // Fase A: devices diretamente ligados ao customer via Contains (orphans conhecidos)
    if (orphanDevices.length > 0) {
      const fallbackAsset = await ensureFallbackAsset();
      for (const d of orphanDevices) {
        await guTbCreateRelation(fallbackAsset.id, 'ASSET', d.id, 'DEVICE');
        fallbackAsset.devices.push(d);
      }
    }

    // Fase B: reconciliação — devices do customer não encontrados via relações Contains
    // Usa guFetchCustomerDevices (flat list) como source of truth do TB
    const allTreeDevIds = new Set();
    function _collectIds(node) {
      for (const d of node.devices || []) allTreeDevIds.add(d.id);
      for (const c of node.children || []) _collectIds(c);
    }
    for (const a of assets) _collectIds(a);

    const flatDevices = await guFetchCustomerDevices(customerId);
    const disconnected = flatDevices.filter((d) => {
      const id = d.id?.id || d.id;
      return !allTreeDevIds.has(id);
    });

    if (disconnected.length > 0) {
      console.warn(`[GCDR Sync] ${disconnected.length} devices não encontrados via relações — reconciliando`);
      const fallbackAsset = await ensureFallbackAsset();
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const chunks = [];
      for (let i = 0; i < disconnected.length; i += 10) chunks.push(disconnected.slice(i, i + 10));
      for (let ci = 0; ci < chunks.length; ci++) {
        if (ci > 0) await sleep(500);
        await Promise.all(
          chunks[ci].map(async (dev) => {
            const devId = dev.id?.id || dev.id;
            try {
              const scope = await guTbFetchEntityServerScope(devId, 'DEVICE');
              fallbackAsset.devices.push({
                id: devId,
                name: dev.name || '',
                label: dev.label || '',
                type: dev.type || '',
                scope,
              });
              allTreeDevIds.add(devId);
            } catch { /* non-fatal */ }
          })
        );
      }
    }

    return assets; // array de asset raiz com children e devices
  }

  // Flatten assets em ordem topológica (pais antes de filhos)
  function guTopoFlatten(assets) {
    const result = [];
    function visit(node, parentId) {
      result.push({ ...node, _parentId: parentId });
      for (const child of node.children || []) visit(child, node.id);
    }
    for (const a of assets) visit(a, null);
    return result;
  }

  // ── GCDR tree helpers ────────────────────────────────────────────

  // Normaliza string para comparação
  function guNorm(s) {
    return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // Match de asset TB → GCDR: todas as combinações name/label × name/displayName/code
  function guMatchAsset(tbAsset, gcdrAssets) {
    const tbNames = [guNorm(tbAsset.name), guNorm(tbAsset.label)].filter(Boolean);
    for (const ga of gcdrAssets) {
      const gcdrNames = [guNorm(ga.name), guNorm(ga.displayName), guNorm(ga.code)].filter(Boolean);
      for (const tn of tbNames) {
        if (tn && gcdrNames.includes(tn)) return ga;
      }
    }
    return null;
  }

  // Match de device TB → GCDR devices do mesmo asset
  // Prioridade: slaveId+centralId > name>name > name>displayName > label>name > label>displayName
  function guMatchDevice(tbDev, tbScope, gcdrDevices) {
    const slaveId = tbScope.slaveId != null ? String(tbScope.slaveId) : null;
    const centralId = tbScope.centralId ?? null;

    if (slaveId && centralId) {
      const hit = gcdrDevices.find((d) => String(d.slaveId) === slaveId && d.centralId === centralId);
      if (hit) return { device: hit, by: `slaveId:${slaveId}+centralId` };
    }

    const tbNorm = guNorm(tbDev.name);
    const lbNorm = guNorm(tbDev.label);

    for (const d of gcdrDevices) {
      const gName = guNorm(d.name);
      const gDisp = guNorm(d.displayName);
      if (tbNorm && tbNorm === gName) return { device: d, by: 'name:name' };
      if (tbNorm && tbNorm === gDisp) return { device: d, by: 'name:displayName' };
      if (lbNorm && lbNorm === gName) return { device: d, by: 'label:name' };
      if (lbNorm && lbNorm === gDisp) return { device: d, by: 'label:displayName' };
    }
    return null;
  }

  // GCDR type mapping (reutiliza lógica existente)
  function guMapToGCDRType(deviceType) {
    const GCDR_TYPES = new Set([
      'SENSOR',
      'ACTUATOR',
      'GATEWAY',
      'CONTROLLER',
      'METER',
      'CAMERA',
      'OUTLET',
      'INFRARED',
      'OTHER',
    ]);
    if (!deviceType) return 'OTHER';
    const u = deviceType.toUpperCase();
    if (GCDR_TYPES.has(u)) return u;
    if (u.includes('HIDROMETRO') || u.includes('HYDROMETER')) return 'METER';
    if (u.includes('MEDIDOR') || u.includes('RELOGIO') || u.includes('METER')) return 'METER';
    if (u.includes('ENTRADA') || u.includes('TRAFO') || u.includes('SUBESTACAO')) return 'METER';
    if (u.includes('TERMOSTATO') || u.includes('SENSOR') || u.includes('TEMP')) return 'SENSOR';
    if (
      u.includes('CHILLER') ||
      u.includes('FANCOIL') ||
      u.includes('HVAC') ||
      u.includes('AR_CONDICIONADO') ||
      u.includes('BOMBA')
    )
      return 'ACTUATOR';
    if (u.includes('ELEVADOR') || u.includes('ESCADA') || u.includes('CONTROLLER')) return 'CONTROLLER';
    if (u.includes('GATEWAY') || u.includes('CENTRAL')) return 'GATEWAY';
    return 'OTHER';
  }

  // ── Main modal ───────────────────────────────────────────────────

  function openGCDRSyncInlineModal() {
    if (!selectedCustomer) return;

    // Pre-condition: gcdrTenantId + gcdrCustomerId + gcdrApiKey must all be set
    if (!gcdrTenantId || !gcdrCustomerId || !gcdrApiKey) {
      const missing = [
        !gcdrTenantId && 'gcdrTenantId',
        !gcdrCustomerId && 'gcdrCustomerId',
        !gcdrApiKey && 'gcdrApiKey',
      ]
        .filter(Boolean)
        .join(', ');
      window.alert(
        `Sincronização GCDR bloqueada.\nAtributos SERVER_SCOPE ausentes no customer: ${missing}\n\nConfigure esses atributos antes de sincronizar.`
      );
      return;
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let overlay;

    function closeModal() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function renderShell(bodyHtml, footerHtml) {
      overlay.innerHTML = `
        <div class="gu-fu-modal" style="max-width:980px">
          <div class="gu-fu-header">
            <div>
              <div class="gu-fu-title">🔗 Sincronizar GCDR</div>
              <div class="gu-fu-subtitle">Customer: ${selectedCustomer.name}</div>
            </div>
            <button class="gu-fu-close" id="gcs-x">✕</button>
          </div>
          <div class="gu-fu-body" id="gcs-body">${bodyHtml}</div>
          <div class="gu-fu-footer" id="gcs-footer">${footerHtml}</div>
        </div>`;
      overlay.querySelector('#gcs-x').addEventListener('click', closeModal);
    }

    function setBody(html) {
      const el = overlay.querySelector('#gcs-body');
      if (el) el.innerHTML = html;
    }

    function downloadLog(log) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const filename = `gcdr-sync_${(selectedCustomer.name || 'customer').replace(/[^a-zA-Z0-9_-]/g, '_')}_${ts}.txt`;

      const assetCreate  = log.assets.filter((r) => r.ok && r.action === 'CREATE');
      const assetUpdate  = log.assets.filter((r) => r.ok && r.action === 'UPDATE');
      const assetErr     = log.assets.filter((r) => !r.ok);
      const devCreate    = log.devices.filter((r) => r.ok && r.action === 'CREATE');
      const devUpdate    = log.devices.filter((r) => r.ok && r.action === 'UPDATE');
      const devErr       = log.devices.filter((r) => !r.ok);

      const lines = [];
      lines.push('='.repeat(72));
      lines.push('  GCDR SYNC LOG — RFC-0186 (TB como Fonte da Verdade)');
      lines.push(`  Customer : ${selectedCustomer.name}  (${selectedCustomer.id})`);
      lines.push(`  Data     : ${now.toISOString()}`);
      lines.push('='.repeat(72));
      lines.push('');
      lines.push('RESUMO');
      lines.push('-'.repeat(40));
      lines.push(`  Assets no TB          : ${log.tbAssetTotal}`);
      lines.push(`  Assets criados        : ${assetCreate.length}`);
      lines.push(`  Assets atualizados    : ${assetUpdate.length}`);
      lines.push(`  Assets com erro       : ${assetErr.length}`);
      lines.push(`  Devices no TB         : ${log.tbDeviceTotal}`);
      lines.push(`  Devices criados       : ${devCreate.length}`);
      lines.push(`  Devices atualizados   : ${devUpdate.length}`);
      lines.push(`  Devices ignorados     : ${log.skipped.length}`);
      lines.push(`  Devices com erro      : ${devErr.length}`);
      lines.push('');

      if (log.assets.length > 0) {
        lines.push('ASSETS');
        lines.push('-'.repeat(72));
        for (const r of log.assets) {
          const status = r.ok ? (r.action === 'CREATE' ? '✨ CRIADO    ' : '🔄 ATUALIZADO') : '❌ ERRO      ';
          lines.push(`  ${status}  ${r.name}`);
          lines.push(`             tbId        : ${r.tbId || '—'}`);
          lines.push(`             gcdrAssetId : ${r.gcdrAssetId || '—'}`);
          if (r.gcdrParentAssetId) lines.push(`             gcdrParent  : ${r.gcdrParentAssetId}`);
          if (r.matchBy)  lines.push(`             match       : ${r.matchBy}`);
          if (r.moved)    lines.push(`             movido      : sim`);
          if (r.error)    lines.push(`             erro        : ${r.error}`);
        }
        lines.push('');
      }

      if (log.devices.length > 0 || log.skipped.length > 0) {
        lines.push('DEVICES');
        lines.push('-'.repeat(72));
        for (const r of log.devices) {
          const status = r.ok ? (r.action === 'CREATE' ? '✨ CRIADO    ' : '🔄 ATUALIZADO') : '❌ ERRO      ';
          lines.push(`  ${status}  ${r.name}`);
          lines.push(`             tbId         : ${r.tbId || '—'}`);
          lines.push(`             gcdrDeviceId : ${r.gcdrDeviceId || '—'}`);
          if (r.slaveId != null) lines.push(`             slaveId      : ${r.slaveId}`);
          if (r.centralId)       lines.push(`             centralId    : ${r.centralId}`);
          if (r.by)       lines.push(`             match        : ${r.by}`);
          if (r.moved)    lines.push(`             movido       : sim`);
          if (r.prevTbId) lines.push(`             ⚠️ prev tbId  : ${r.prevTbId}  ← GCDR device estava vinculado a outro TB device`);
          if (r.error)    lines.push(`             erro         : ${r.error}`);
        }
        for (const r of log.skipped) {
          lines.push(`  ⚠️  IGNORADO     ${r.name}`);
          lines.push(`             tbId  : ${r.tbId || '—'}`);
          lines.push(`             motivo: Sem slaveId e centralId`);
        }
        lines.push('');
      }

      lines.push('='.repeat(72));

      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    function renderProgress(phase, done, total, color) {
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const c = color || '#0db89e';
      return `
        <div style="padding:4px 0">
          <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:14px">⏳ ${phase}</div>
          <div class="gu-fu-progress-bar-bg" style="margin-bottom:6px">
            <div class="gu-fu-progress-bar" style="width:${pct}%;background:${c}"></div>
          </div>
          <div style="display:flex;justify-content:space-between">
            <div class="gu-fu-progress-label">${done > 0 ? `${done} / ${total}` : '…'}</div>
            <div style="font-size:13px;font-weight:700;color:${c}">${pct > 0 ? pct + '%' : ''}</div>
          </div>
        </div>`;
    }

    // ── Render final log ──────────────────────────────────────────
    function renderFinalLog(log) {
      const assetCreate = log.assets.filter((r) => r.ok && r.action === 'CREATE');
      const assetUpdate = log.assets.filter((r) => r.ok && r.action === 'UPDATE');
      const assetErr = log.assets.filter((r) => !r.ok);
      const devCreate = log.devices.filter((r) => r.ok && r.action === 'CREATE');
      const devUpdate = log.devices.filter((r) => r.ok && r.action === 'UPDATE');
      const devErr = log.devices.filter((r) => !r.ok);
      const skipped = log.skipped;

      function uuid(id) {
        return id
          ? `<code style="font-size:10px;background:#f3f4f6;padding:1px 4px;border-radius:3px;color:#374151">${id}</code>`
          : '<span style="color:#9ca3af">—</span>';
      }
      function chip(text, bg, color) {
        return `<span style="font-size:10px;background:${bg};color:${color};padding:1px 6px;border-radius:3px;font-weight:600;white-space:nowrap">${text}</span>`;
      }
      function actionChip(action) {
        if (action === 'CREATE') return chip('✨ CRIADO', '#ede9ff', '#4c1d95');
        if (action === 'UPDATE') return chip('🔄 ATUALIZADO', '#dbeafe', '#1e40af');
        return chip(action, '#f3f4f6', '#374151');
      }

      const assetRows = log.assets
        .map(
          (r) => `
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:7px 8px;white-space:nowrap">${r.ok ? '✅' : '❌'} ${actionChip(r.action)}</td>
          <td style="padding:7px 8px">
            <div style="font-weight:600;font-size:12px">${r.name}</div>
            ${r.label && r.label !== r.name ? `<div style="font-size:10px;color:#9ca3af">${r.label}</div>` : ''}
            <div style="font-size:10px;color:#9ca3af;font-family:monospace">${r.tbId || '—'}</div>
          </td>
          <td style="padding:7px 8px">${uuid(r.gcdrAssetId)}</td>
          <td style="padding:7px 8px">${r.gcdrParentAssetId ? uuid(r.gcdrParentAssetId) : '<span style="color:#9ca3af">raiz</span>'}</td>
          <td style="padding:7px 8px">
            ${r.matchBy ? chip(r.matchBy, '#f0fdf4', '#166534') : '<span style="color:#9ca3af">—</span>'}
            ${r.moved ? chip('↪ movido', '#fef9c3', '#854d0e') : ''}
          </td>
          <td style="padding:7px 8px;color:#ef4444;font-size:11px">${r.error || ''}</td>
        </tr>`
        )
        .join('');

      const devRows = log.devices
        .map(
          (r) => `
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:7px 8px;white-space:nowrap">${r.ok ? '✅' : '❌'} ${actionChip(r.action)}</td>
          <td style="padding:7px 8px">
            <div style="font-weight:600;font-size:12px">${r.name}</div>
            ${r.label && r.label !== r.name ? `<div style="font-size:10px;color:#9ca3af">${r.label}</div>` : ''}
            <div style="font-size:10px;color:#9ca3af;font-family:monospace">${r.tbId || '—'}</div>
          </td>
          <td style="padding:7px 8px">${uuid(r.gcdrDeviceId)}</td>
          <td style="padding:7px 8px">
            ${r.slaveId != null ? chip(`slave:${r.slaveId}`, '#f0f9ff', '#0369a1') : ''}
            ${r.centralId ? chip(`central:${r.centralId.substring(0, 8)}…`, '#f0f9ff', '#0369a1') : ''}
          </td>
          <td style="padding:7px 8px">
            ${r.by ? chip(r.by, '#f0fdf4', '#166534') : '<span style="color:#9ca3af">—</span>'}
            ${r.moved ? chip('↪ movido', '#fef9c3', '#854d0e') : ''}
            ${r.prevTbId ? `<div style="font-size:10px;color:#b45309;margin-top:3px" title="GCDR device estava vinculado a outro TB device antes do sync">⚠️ prev: <code style="font-size:9px">${r.prevTbId.substring(0,8)}…</code></div>` : ''}
          </td>
          <td style="padding:7px 8px;color:#ef4444;font-size:11px">${r.error || ''}</td>
        </tr>`
        )
        .join('');

      const skippedRows = skipped
        .map(
          (r) => `
        <tr style="border-bottom:1px solid #f3f4f6;opacity:.7">
          <td style="padding:7px 8px">${chip('⚠️ IGNORADO', '#fef3c7', '#92400e')}</td>
          <td style="padding:7px 8px">
            <div style="font-weight:600;font-size:12px">${r.name}</div>
            ${r.label && r.label !== r.name ? `<div style="font-size:10px;color:#9ca3af">${r.label}</div>` : ''}
            <div style="font-size:10px;color:#9ca3af;font-family:monospace">${r.tbId || '—'}</div>
          </td>
          <td colspan="4" style="padding:7px 8px;font-size:11px;color:#9ca3af">Sem slaveId e centralId — não sincronizado</td>
        </tr>`
        )
        .join('');

      const tableStyle = 'width:100%;border-collapse:collapse;font-size:12px';
      const thStyle =
        'padding:6px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;background:#f9fafb;border-bottom:2px solid #e5e7eb';

      return `
        <!-- Resumo -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:18px">
          ${[
            { label: 'Assets no TB', val: log.tbAssetTotal, color: '#374151', bg: '#f3f4f6' },
            { label: 'Assets criados', val: assetCreate.length, color: '#4c1d95', bg: '#ede9ff' },
            { label: 'Assets atualizados', val: assetUpdate.length, color: '#1e40af', bg: '#dbeafe' },
            { label: 'Devices no TB', val: log.tbDeviceTotal, color: '#374151', bg: '#f3f4f6' },
            { label: 'Devices criados', val: devCreate.length, color: '#065f46', bg: '#d1fae5' },
            { label: 'Devices atualizados', val: devUpdate.length, color: '#1e40af', bg: '#dbeafe' },
            { label: 'Devices ignorados', val: skipped.length, color: '#92400e', bg: '#fef3c7' },
            { label: 'Erros', val: assetErr.length + devErr.length, color: '#991b1b', bg: '#fee2e2' },
          ]
            .map(
              ({ label, val, color, bg }) => `
            <div style="background:${bg};border-radius:8px;padding:10px 12px;text-align:center">
              <div style="font-size:22px;font-weight:800;color:${color}">${val}</div>
              <div style="font-size:10px;color:${color};font-weight:600;margin-top:2px">${label}</div>
            </div>`
            )
            .join('')}
        </div>

        <!-- Assets -->
        ${
          log.assets.length > 0
            ? `
        <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">
          📁 Assets (${log.assets.length})
        </div>
        <div style="overflow-x:auto;margin-bottom:16px">
          <table style="${tableStyle}">
            <thead><tr>
              <th style="${thStyle}">Ação</th>
              <th style="${thStyle}">Nome TB</th>
              <th style="${thStyle}">gcdrAssetId</th>
              <th style="${thStyle}">gcdrParentAssetId</th>
              <th style="${thStyle}">Match / Info</th>
              <th style="${thStyle}">Erro</th>
            </tr></thead>
            <tbody>${assetRows}</tbody>
          </table>
        </div>`
            : ''
        }

        <!-- Devices -->
        ${
          log.devices.length + skipped.length > 0
            ? `
        <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">
          📟 Devices (${log.devices.length + skipped.length})
        </div>
        <div style="overflow-x:auto">
          <table style="${tableStyle}">
            <thead><tr>
              <th style="${thStyle}">Ação</th>
              <th style="${thStyle}">Nome TB</th>
              <th style="${thStyle}">gcdrDeviceId</th>
              <th style="${thStyle}">slaveId / centralId</th>
              <th style="${thStyle}">Match / Info</th>
              <th style="${thStyle}">Erro</th>
            </tr></thead>
            <tbody>${devRows}${skippedRows}</tbody>
          </table>
        </div>`
            : ''
        }`;
    }

    // ── Open modal ────────────────────────────────────────────────
    overlay = document.createElement('div');
    overlay.className = 'gu-fu-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
    renderShell(renderProgress('Iniciando sincronização…', 0, 0), '');

    (async () => {
      const nowSynced = new Date().toISOString();
      const log = { assets: [], devices: [], skipped: [], tbAssetTotal: 0, tbDeviceTotal: 0 };

      try {
        // ── FASE 0: Monta árvore TB ────────────────────────────────
        setBody(renderProgress('Fase 0/3 — Mapeando árvore ThingsBoard…', 0, 0));
        console.log('[GCDR Sync RFC-0186] Fase 0: buildTree TB');
        const tbAssets = await guTbBuildTree(selectedCustomer.id, selectedCustomer.name);
        const topoAssets = guTopoFlatten(tbAssets);
        log.tbAssetTotal = topoAssets.length;
        console.log(`[GCDR Sync] TB tree: ${topoAssets.length} assets`);

        // ── FASE 1: Carrega bundle GCDR ────────────────────────────
        setBody(renderProgress('Fase 1/3 — Carregando bundle GCDR…', 0, 0));
        console.log('[GCDR Sync RFC-0186] Fase 1: GCDR bundle');
        const bundle = await guFetchGCDRCustomerBundle(selectedCustomer.id, gcdrTenantId);
        if (!bundle)
          throw new Error(
            'Customer não encontrado no GCDR. Configure gcdrCustomerId em SERVER_SCOPE e verifique o tenant.'
          );

        // Filtrar estritamente por gcdrCustomerId — o bundle ?deep=1 pode conter
        // assets/devices de outros customers no mesmo tenant GCDR, causando match cruzado
        const bundleAssets  = Array.isArray(bundle.assets)  ? bundle.assets  : [];
        const bundleDevices = Array.isArray(bundle.devices) ? bundle.devices : [];
        const gcdrAssetList  = bundleAssets.filter( (a) => !a.customerId || a.customerId === gcdrCustomerId);
        const gcdrDeviceList = bundleDevices.filter((d) => !d.customerId || d.customerId === gcdrCustomerId);

        const filteredAssets  = bundleAssets.length  - gcdrAssetList.length;
        const filteredDevices = bundleDevices.length - gcdrDeviceList.length;
        if (filteredAssets  > 0) console.warn(`[GCDR Sync] ⚠️ ${filteredAssets} assets de outros customers ignorados (bundle contaminado)`);
        if (filteredDevices > 0) console.warn(`[GCDR Sync] ⚠️ ${filteredDevices} devices de outros customers ignorados (bundle contaminado)`);

        // Indexar em memória apenas do customer correto
        const gcdrAssetMap = new Map(gcdrAssetList.map((a) => [a.id, { ...a, devices: [] }]));
        for (const d of gcdrDeviceList) {
          gcdrAssetMap.get(d.assetId)?.devices.push(d);
        }
        console.log(
          `[GCDR Sync] bundle filtrado: ${gcdrAssetList.length} assets, ${gcdrDeviceList.length} devices → customer ${gcdrCustomerId}`
        );

        // ── FASE 2: Sincronizar Assets (topológico, um a um) ───────
        const totalAssets = topoAssets.length;
        let doneAssets = 0;

        // Mapa: tbAssetId → gcdrAssetId (preenchido conforme sync)
        const gcdrAssetIdByTbId = new Map();
        // Pré-popular do SERVER_SCOPE já gravado
        for (const a of topoAssets) {
          if (a.scope?.gcdrAssetId) gcdrAssetIdByTbId.set(a.id, a.scope.gcdrAssetId);
        }

        for (const tbAsset of topoAssets) {
          doneAssets++;
          setBody(
            renderProgress(
              `Fase 2/3 — Sincronizando assets… (${doneAssets}/${totalAssets})`,
              doneAssets,
              totalAssets,
              '#7c3aed'
            )
          );

          const matchedGcdr = guMatchAsset(tbAsset, gcdrAssetList);

          // Resolver gcdrParentAssetId: buscar no mapa pelo pai TB
          const gcdrParentAssetId = tbAsset._parentId
            ? (gcdrAssetIdByTbId.get(tbAsset._parentId) ?? null)
            : null;

          if (matchedGcdr) {
            // UPDATE
            try {
              const updatePayload = {
                name: tbAsset.name,
                displayName: tbAsset.label || tbAsset.name,
                code: tbAsset.name,
                type: tbAsset.type || 'OTHER',
                status: 'ACTIVE',
                metadata: {
                  tbId: tbAsset.id,
                  tbAssetName: tbAsset.name,
                  tbAssetType: tbAsset.type || 'default',
                  syncedAt: nowSynced,
                },
              };
              await guGCDRFetch('PUT', `/api/v1/assets/${matchedGcdr.id}`, updatePayload);

              // Move se parent diferir
              if (gcdrParentAssetId && matchedGcdr.parentAssetId !== gcdrParentAssetId) {
                await guGCDRFetch('POST', `/api/v1/assets/${matchedGcdr.id}/move`, {
                  newParentAssetId: gcdrParentAssetId,
                });
              }

              // Salvar no TB SERVER_SCOPE do asset
              const tbAttrs = {
                gcdrAssetId: matchedGcdr.id,
                gcdrSyncAt: nowSynced,
                gcdrCustomerId: gcdrCustomerId,
              };
              if (gcdrParentAssetId) tbAttrs.gcdrParentAssetId = gcdrParentAssetId;
              await guSaveAssetServerScopeAttrs(tbAsset.id, tbAttrs);

              gcdrAssetIdByTbId.set(tbAsset.id, matchedGcdr.id);
              log.assets.push({
                name: tbAsset.name,
                tbId: tbAsset.id,
                label: tbAsset.label,
                action: 'UPDATE',
                gcdrAssetId: matchedGcdr.id,
                gcdrParentAssetId: gcdrParentAssetId || null,
                matchBy: [guNorm(tbAsset.name), guNorm(tbAsset.label)].filter(Boolean).join(' / '),
                moved: !!(gcdrParentAssetId && matchedGcdr.parentAssetId !== gcdrParentAssetId),
                ok: true,
              });
              console.log(`[GCDR Sync] Asset UPDATED: "${tbAsset.name}" → ${matchedGcdr.id}`);
            } catch (err) {
              log.assets.push({
                name: tbAsset.name,
                tbId: tbAsset.id,
                action: 'UPDATE',
                ok: false,
                error: err.message,
              });
              console.error(`[GCDR Sync] Asset UPDATE failed "${tbAsset.name}":`, err);
            }
          } else {
            // CREATE
            try {
              const createPayload = {
                customerId: gcdrCustomerId,
                parentAssetId: gcdrParentAssetId,
                name: tbAsset.name,
                displayName: tbAsset.label || tbAsset.name,
                code: tbAsset.name,
                type: 'OTHER',
                metadata: {
                  tbId: tbAsset.id,
                  tbAssetName: tbAsset.name,
                  tbAssetType: tbAsset.type || 'default',
                  syncedAt: nowSynced,
                },
              };
              const created = await guGCDRFetch('POST', '/api/v1/assets', createPayload);
              const newGcdrAssetId = created?.id ?? null;

              const tbAttrs = {
                gcdrAssetId: newGcdrAssetId,
                gcdrSyncAt: nowSynced,
                gcdrCustomerId: gcdrCustomerId,
              };
              if (gcdrParentAssetId) tbAttrs.gcdrParentAssetId = gcdrParentAssetId;
              await guSaveAssetServerScopeAttrs(tbAsset.id, tbAttrs);

              if (newGcdrAssetId) {
                gcdrAssetIdByTbId.set(tbAsset.id, newGcdrAssetId);
                // Add to local index so device phase can find it
                gcdrAssetMap.set(newGcdrAssetId, { ...created, devices: [] });
                gcdrAssetList.push({ ...created });
              }

              log.assets.push({
                name: tbAsset.name,
                tbId: tbAsset.id,
                label: tbAsset.label,
                action: 'CREATE',
                gcdrAssetId: newGcdrAssetId,
                gcdrParentAssetId: gcdrParentAssetId || null,
                matchBy: null,
                moved: false,
                ok: true,
              });
              console.log(`[GCDR Sync] Asset CREATED: "${tbAsset.name}" → ${newGcdrAssetId}`);
            } catch (err) {
              log.assets.push({
                name: tbAsset.name,
                tbId: tbAsset.id,
                action: 'CREATE',
                ok: false,
                error: err.message,
              });
              console.error(`[GCDR Sync] Asset CREATE failed "${tbAsset.name}":`, err);
            }
          }

          await sleep(300); // rate-limit gentil
        }

        // ── FASE 3: Sincronizar Devices (por asset, um a um) ───────
        // Flatten todos os devices de todos os TB assets
        const allTbDevices = [];
        for (const tbAsset of topoAssets) {
          const gcdrAssetId = gcdrAssetIdByTbId.get(tbAsset.id) ?? null;
          for (const dev of tbAsset.devices || []) {
            allTbDevices.push({ ...dev, _tbAssetId: tbAsset.id, _gcdrAssetId: gcdrAssetId });
          }
        }

        const totalDevices = allTbDevices.length;
        log.tbDeviceTotal = totalDevices;
        let doneDevices = 0;

        // Garante que cada GCDR device é consumido por no máximo 1 TB device
        const consumedGcdrDeviceIds = new Set();

        // Rastreia identifiers globalmente — GCDR tem constraint única de identifier
        // por tenant/customer (NÃO por asset), então o Set deve ser global ao sync.
        // Pré-popular com identifiers já existentes no GCDR para evitar HTTP 500
        // em runs subsequentes (identifiers de runs anteriores já estão no DB).
        const identifiersSeen = new Set();
        for (const d of gcdrDeviceList) {
          if (d.identifier) identifiersSeen.add(d.identifier);
        }

        // Mapa global externalId (= tbId) → gcdrDevice para match cross-asset.
        // Devices criados em runs anteriores ficam num asset diferente (novo gcdrAssetId),
        // por isso guMatchDevice (per-asset) não os encontra → 409 CONFLICT no CREATE.
        const gcdrDeviceByExternalId = new Map();
        for (const d of gcdrDeviceList) {
          if (d.externalId) gcdrDeviceByExternalId.set(d.externalId, d);
        }

        for (const tbDev of allTbDevices) {
          doneDevices++;
          setBody(
            renderProgress(
              `Fase 3/3 — Sincronizando devices… (${doneDevices}/${totalDevices})`,
              doneDevices,
              totalDevices,
              '#0db89e'
            )
          );

          const scope = tbDev.scope || {};
          const slaveId = scope.slaveId != null ? scope.slaveId : null;
          const centralId = scope.centralId ?? null;

          // Ignorar devices sem slaveId E sem centralId
          if (slaveId == null && !centralId) {
            log.skipped.push({ name: tbDev.name, tbId: tbDev.id, label: tbDev.label });
            console.log(`[GCDR Sync] Device ignorado (sem slaveId+centralId): "${tbDev.name}"`);
            continue;
          }

          const gcdrAssetId = tbDev._gcdrAssetId;
          if (!gcdrAssetId) {
            log.devices.push({
              name: tbDev.name,
              action: 'SKIP',
              ok: false,
              error: 'Asset TB não foi sincronizado ao GCDR',
            });
            continue;
          }

          // GCDR devices do asset correspondente — excluindo os já consumidos por outro TB device
          const gcdrDevicesForAsset = (gcdrAssetMap.get(gcdrAssetId)?.devices ?? [])
            .filter((d) => !consumedGcdrDeviceIds.has(d.id));

          // Match: primeiro por asset (slaveId/nome), depois global por externalId
          // (device pode estar num asset diferente de um run anterior — evita 409 CONFLICT)
          let matchResult = guMatchDevice(tbDev, scope, gcdrDevicesForAsset);
          if (!matchResult) {
            const byExtId = gcdrDeviceByExternalId.get(tbDev.id);
            if (byExtId && !consumedGcdrDeviceIds.has(byExtId.id)) {
              matchResult = { device: byExtId, by: 'externalId' };
            }
          }

          // Marcar o GCDR device como consumido imediatamente após o match
          if (matchResult) consumedGcdrDeviceIds.add(matchResult.device.id);

          // --- Resolver identifier globalmente único ---
          // GCDR tem constraint única de identifier por tenant/customer (global, não por asset).
          // Normalizar sempre: remove espaços, chars inválidos, lowercase.
          // Fallback para nome normalizado quando scope.identifier é nulo (evita HTTP 500 NOT NULL).
          // Colisão → sufixo com 8 chars do tbId (UUID garante unicidade global).
          const rawIdentifier = scope.identifier || null;
          let resolvedIdentifier;
          {
            const normalize = (s) =>
              s.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || null;
            const base =
              (rawIdentifier ? normalize(rawIdentifier) : null) ||
              normalize(tbDev.label || tbDev.name) ||
              `dev_${tbDev.id.substring(0, 8)}`;
            // identifiersSeen é global a todos os assets do sync
            const candidate = identifiersSeen.has(base)
              ? `${base}_${tbDev.id.substring(0, 8)}`
              : base;
            resolvedIdentifier = candidate;
            identifiersSeen.add(resolvedIdentifier);
          }

          const deviceType = scope.deviceType || scope.deviceProfile || tbDev.type || '';
          const updatePayload = {
            name: tbDev.name,
            displayName: tbDev.label || tbDev.name,
            label: tbDev.label || '',
            type: guMapToGCDRType(deviceType),
            externalId: tbDev.id,
            status: 'ACTIVE',
            ...(slaveId != null ? { slaveId: Number(slaveId) } : {}),
            ...(centralId ? { centralId } : {}),
            identifier: resolvedIdentifier,
            ...(scope.deviceProfile ? { deviceProfile: scope.deviceProfile } : {}),
            ...(scope.deviceType ? { deviceType: scope.deviceType } : {}),
            ...(scope.ingestionId ? { ingestionId: scope.ingestionId } : {}),
            ...(scope.ingestionGatewayId ? { ingestionGatewayId: scope.ingestionGatewayId } : {}),
            metadata: {
              tbId: tbDev.id,
              tbDeviceName: tbDev.name,
              tbProfile: scope.deviceProfile || '',
              syncedAt: nowSynced,
            },
          };

          try {
            let gcdrDeviceId;

            if (matchResult) {
              const gcdrDev = matchResult.device;
              gcdrDeviceId = gcdrDev.id;

              // PUT — atualiza tudo
              await guGCDRFetch('PUT', `/api/v1/devices/${gcdrDeviceId}`, updatePayload);

              // Move se assetId diferir
              if (gcdrDev.assetId !== gcdrAssetId) {
                await sleep(400); // pausa entre chamadas GCDR consecutivas
                await guGCDRFetch('POST', `/api/v1/devices/${gcdrDeviceId}/move`, {
                  newAssetId: gcdrAssetId,
                });
              }

              // Salvar no TB SERVER_SCOPE do device
              await guSaveDeviceServerScopeAttrs(tbDev.id, {
                gcdrDeviceId,
                gcdrAssetId,
                gcdrSyncAt: nowSynced,
                gcdrCustomerId: gcdrCustomerId,
              });

              const prevTbId = gcdrDev.externalId || gcdrDev.metadata?.tbId || null;
              log.devices.push({
                name: tbDev.name,
                tbId: tbDev.id,
                label: tbDev.label,
                action: 'UPDATE',
                gcdrDeviceId,
                gcdrAssetId,
                by: matchResult.by,
                slaveId: slaveId != null ? slaveId : null,
                centralId: centralId || null,
                moved: matchResult.device.assetId !== gcdrAssetId,
                // prevTbId: tbId que o GCDR device tinha ANTES do update (null = era novo/limpo)
                prevTbId: prevTbId !== tbDev.id ? prevTbId : null,
                ok: true,
              });
              console.log(
                `[GCDR Sync] Device UPDATED: "${tbDev.name}" → ${gcdrDeviceId} (via ${matchResult.by})`
              );
            } else {
              // CREATE
              const createPayload = { ...updatePayload, assetId: gcdrAssetId, customerId: gcdrCustomerId };
              const created = await guGCDRFetch('POST', '/api/v1/devices', createPayload);
              gcdrDeviceId = created?.id ?? null;

              // Detectar upsert silencioso: GCDR constraint (assetId, identifier) pode retornar
              // o ID de um device já existente em vez de criar um novo.
              if (gcdrDeviceId && consumedGcdrDeviceIds.has(gcdrDeviceId)) {
                throw new Error(
                  `GCDR upsert silencioso: gcdrDeviceId=${gcdrDeviceId} já foi consumido por outro TB device — colisão de identifier "${resolvedIdentifier}" no asset ${gcdrAssetId}`
                );
              }

              await guSaveDeviceServerScopeAttrs(tbDev.id, {
                gcdrDeviceId,
                gcdrAssetId,
                gcdrSyncAt: nowSynced,
                gcdrCustomerId: gcdrCustomerId,
              });

              // Adicionar ao índice local e marcar como consumido para evitar re-match
              if (gcdrDeviceId) {
                gcdrAssetMap.get(gcdrAssetId)?.devices.push({ ...created, assetId: gcdrAssetId });
                consumedGcdrDeviceIds.add(gcdrDeviceId);
              }

              log.devices.push({
                name: tbDev.name,
                tbId: tbDev.id,
                label: tbDev.label,
                action: 'CREATE',
                gcdrDeviceId,
                gcdrAssetId,
                by: null,
                slaveId: slaveId != null ? slaveId : null,
                centralId: centralId || null,
                moved: false,
                ok: true,
              });
              console.log(`[GCDR Sync] Device CREATED: "${tbDev.name}" → ${gcdrDeviceId}`);
            }
          } catch (err) {
            log.devices.push({
              name: tbDev.name,
              tbId: tbDev.id,
              label: tbDev.label,
              action: matchResult ? 'UPDATE' : 'CREATE',
              gcdrDeviceId: null,
              gcdrAssetId,
              by: matchResult?.by || null,
              slaveId: slaveId != null ? slaveId : null,
              centralId: centralId || null,
              ok: false,
              error: err.message,
            });
            console.error(`[GCDR Sync] Device failed "${tbDev.name}":`, err);
          }

          // Rate-limit GCDR: CREATE precisa de mais folga para o servidor processar
          await sleep(matchResult ? 500 : 800);
        }

        // ── Resultado final ────────────────────────────────────────
        setBody(renderFinalLog(log));
        overlay.querySelector('#gcs-footer').innerHTML = `
          <button class="gu-fu-btn gu-fu-btn-secondary" id="gcs-download-log">⬇ Baixar Log</button>
          <button class="gu-fu-btn gu-fu-btn-secondary" id="gcs-done">Fechar</button>`;
        overlay.querySelector('#gcs-download-log').addEventListener('click', () => downloadLog(log));
        overlay.querySelector('#gcs-done').addEventListener('click', closeModal);
      } catch (err) {
        console.error('[GCDR Sync RFC-0186] Erro fatal:', err);
        setBody(`<div style="color:#ef4444;font-size:13px;padding:8px 0">❌ ${err.message}</div>`);
        overlay.querySelector('#gcs-footer').innerHTML =
          `<button class="gu-fu-btn gu-fu-btn-secondary" id="gcs-close">Fechar</button>`;
        overlay.querySelector('#gcs-close').addEventListener('click', closeModal);
      }
    })();
  }

  function openSyncForceIdModal() {
    if (!selectedCustomer) return;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let overlay;

    function closeModal() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    // ── Modal shell ──
    overlay = document.createElement('div');
    overlay.className = 'gu-fu-overlay'; // reuse same overlay/modal CSS
    document.body.appendChild(overlay);

    function showError(msg) {
      overlay.querySelector('#gsfi-body').innerHTML =
        `<div style="color:#ef4444;font-size:13px;padding:8px 0">❌ ${msg}</div>`;
      overlay.querySelector('#gsfi-footer').innerHTML =
        `<button class="gu-fu-btn gu-fu-btn-secondary" id="gsfi-close">Fechar</button>`;
      overlay.querySelector('#gsfi-close').addEventListener('click', closeModal);
    }

    function renderShell(bodyHtml, footerHtml) {
      overlay.innerHTML = `
        <div class="gu-fu-modal" style="max-width:920px">
          <div class="gu-fu-header">
            <div>
              <div class="gu-fu-title">🔄 GCDR Sync Force ID</div>
              <div class="gu-fu-subtitle">Customer: ${selectedCustomer.name}</div>
            </div>
            <button class="gu-fu-close" id="gsfi-x">✕</button>
          </div>
          <div class="gu-fu-body" id="gsfi-body">${bodyHtml}</div>
          <div class="gu-fu-footer" id="gsfi-footer">${footerHtml}</div>
        </div>`;
      overlay.querySelector('#gsfi-x').addEventListener('click', closeModal);
    }

    // ── Phase 1: Loading ──
    function renderLoadingBody(stats) {
      const pct =
        stats.total > 0 ? Math.round(((stats.foundInGcdr + stats.notFound) / stats.total) * 100) : 0;
      return `
        <div style="padding:4px 0">
          <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:14px">
            ⏳ Buscando devices do TB e bundle do GCDR…
          </div>
          <div class="gu-fu-progress-bar-bg" style="margin-bottom:6px">
            <div class="gu-fu-progress-bar" id="gsfi-prog" style="width:${pct}%;background:#1d4ed8"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:18px">
            <div class="gu-fu-progress-label" id="gsfi-phase">${stats.phase || 'Iniciando…'}</div>
            <div style="font-size:13px;font-weight:700;color:#1d4ed8">${pct}%</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">
            <div style="background:#f3f4f6;border-radius:8px;padding:12px">
              <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Devices no GCDR</div>
              <div style="font-size:20px;font-weight:700;color:#1f2937">${stats.gcdrTotal ?? '—'}</div>
              <div style="font-size:10px;color:#9ca3af">match por centralId+slaveId</div>
            </div>
            <div style="background:#f3f4f6;border-radius:8px;padding:12px">
              <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Total no TB</div>
              <div style="font-size:20px;font-weight:700;color:#1f2937">${stats.total > 0 ? stats.total : '—'}</div>
              <div style="font-size:10px;color:#9ca3af">devices do customer</div>
            </div>
            <div style="background:#d1fae5;border-radius:8px;padding:12px">
              <div style="font-size:11px;color:#065f46;margin-bottom:4px">Encontrados no GCDR</div>
              <div style="font-size:20px;font-weight:700;color:#065f46">${stats.foundInGcdr}</div>
              <div style="font-size:10px;color:#6ee7b7">match por externalId</div>
            </div>
            <div style="background:#fee2e2;border-radius:8px;padding:12px">
              <div style="font-size:11px;color:#991b1b;margin-bottom:4px">Não encontrados</div>
              <div style="font-size:20px;font-weight:700;color:#991b1b">${stats.notFound}</div>
              <div style="font-size:10px;color:#fca5a5">sem externalId no GCDR</div>
            </div>
          </div>
        </div>`;
    }

    // ── Phase 2: Results table ──
    function renderResultsBody(rows) {
      const nMatch = rows.filter((r) => r.status === 'MATCH').length;
      const nSynced = rows.filter((r) => r.status === 'SYNCED').length;
      const nNoMatch = rows.filter((r) => r.status === 'NOMATCH').length;

      const tableRows = rows
        .map((r) => {
          const statusCell =
            r.status === 'MATCH'
              ? '<span class="gu-fu-status MATCH">✓ MATCH</span>'
              : r.status === 'SYNCED'
                ? '<span class="gu-fu-status MATCH" style="background:#d1fae5;color:#065f46">✓ SYNCED</span>'
                : '<span class="gu-fu-status FAIL">✗ NO MATCH</span>';
          const gcdrCell = r.gcdrDeviceId
            ? `<span class="gu-fu-uuid" title="${r.gcdrDeviceId}">${r.gcdrDeviceId.substring(0, 8)}…</span>`
            : '<span style="color:#9ca3af">—</span>';
          const assetCell = r.gcdrAssetId
            ? `<span class="gu-fu-uuid" title="${r.gcdrAssetId}">${r.gcdrAssetId.substring(0, 8)}…</span>`
            : '<span style="color:#9ca3af">—</span>';
          const viaCell = r.matchedBy
            ? `<span style="font-size:10px;background:#ede9ff;color:#4c1d95;padding:1px 5px;border-radius:3px;font-family:monospace">${r.matchedBy}</span>`
            : '<span style="color:#9ca3af">—</span>';
          return `<tr>
          <td>${statusCell}</td>
          <td title="${r.tbId}">${r.name}<br><span style="color:#9ca3af;font-size:10px;font-family:monospace">${r.tbId.substring(0, 8)}…</span></td>
          <td>${gcdrCell}</td>
          <td>${assetCell}</td>
          <td>${viaCell}</td>
        </tr>`;
        })
        .join('');

      return `
        <div class="gu-fu-summary">
          <span class="gu-fu-badge match">✓ ${nMatch} para atualizar</span>
          ${nSynced ? `<span class="gu-fu-badge" style="background:#d1fae5;color:#065f46">✓ ${nSynced} já sincronizados</span>` : ''}
          <span class="gu-fu-badge fail">✗ ${nNoMatch} não encontrados no GCDR</span>
        </div>
        <div style="overflow-x:auto;margin-top:12px">
          <table class="gu-fu-table">
            <thead><tr>
              <th>Status</th><th>Device TB</th><th>GCDR ID</th>
              <th>Asset GCDR</th><th>Via (match)</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>`;
    }

    // ── Phase 3: Execute results ──
    function renderExecBody(results) {
      const ok = results.filter((r) => r.ok);
      const err = results.filter((r) => !r.ok);
      const items = results
        .map(
          (r) => `
        <li class="gu-fu-result-item">
          <span class="gu-fu-result-icon">${r.ok ? '✅' : '❌'}</span>
          <div>
            <div class="gu-fu-result-name">${r.name}</div>
            ${
              r.ok
                ? `<div class="gu-fu-result-msg">gcdrDeviceId → <code>${r.gcdrDeviceId}</code></div>`
                : `<div class="gu-fu-result-err">${r.error}</div>`
            }
          </div>
        </li>`
        )
        .join('');
      return `
        <div class="gu-fu-summary" style="margin-bottom:16px">
          <span class="gu-fu-badge match">✓ ${ok.length} atualizados</span>
          ${err.length ? `<span class="gu-fu-badge fail">✗ ${err.length} erros</span>` : ''}
        </div>
        <ul class="gu-fu-result-list">${items}</ul>`;
    }

    // ── Start: open modal immediately with loading state ──
    const initStats = {
      phase: 'Buscando bundle do GCDR e devices do TB…',
      gcdrTotal: null,
      total: 0,
      foundInGcdr: 0,
      notFound: 0,
    };
    renderShell(renderLoadingBody(initStats), '');

    // ── Fetch GCDR bundle + TB devices in parallel ──
    Promise.all([
      guFetchGCDRCustomerBundle(selectedCustomer.id, gcdrTenantId),
      guFetchCustomerDevices(selectedCustomer.id),
    ])
      .then(async ([bundle, tbDevices]) => {
        // GCDR devices come from the bundle (?deep=1) — this is the authoritative source and
        // includes metadata.tbId (the TB device UUID), slaveId, centralId, name, displayName.
        const gcdrDevices = Array.isArray(bundle?.devices) ? bundle.devices : [];
        console.log(`[GCDR Sync] bundle.devices: ${gcdrDevices.length} devices`);

        // ── Build multi-strategy lookup maps (priority: first map checked = most reliable) ──
        // norm: normalize strings for case/space-insensitive name matching
        const norm = (s) => (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');

        const byTbId = new Map(); // metadata.tbId (= TB UUID) → gd  ← MOST RELIABLE
        const byExtId = new Map(); // externalId (= TB UUID) → gd
        const bySlaveKey = new Map(); // `${centralId}:${slaveId}` → gd
        const byName = new Map(); // norm(gd.name) → gd
        const byTbName = new Map(); // norm(gd.metadata.tbName) → gd
        const byDisplay = new Map(); // norm(gd.displayName) → gd

        for (const gd of gcdrDevices) {
          if (gd.metadata?.tbId) byTbId.set(gd.metadata.tbId, gd);
          if (gd.externalId) byExtId.set(gd.externalId, gd);
          const c = gd.centralId ?? '',
            s = String(gd.slaveId ?? '');
          if (c && s) bySlaveKey.set(`${c}:${s}`, gd);
          const n = norm(gd.name);
          if (n && !byName.has(n)) byName.set(n, gd);
          const tn = norm(gd.metadata?.tbName);
          if (tn && !byTbName.has(tn)) byTbName.set(tn, gd);
          const dn = norm(gd.displayName);
          if (dn && !byDisplay.has(dn)) byDisplay.set(dn, gd);
        }

        function findGCDRDevice(tbId, attrs, tbDeviceName) {
          const c = attrs.centralId ?? '',
            s = String(attrs.slaveId ?? '');
          const sk = c && s ? `${c}:${s}` : null;
          const nn = norm(tbDeviceName);
          if (byTbId.has(tbId)) return { dev: byTbId.get(tbId), by: 'metadata.tbId' };
          if (byExtId.has(tbId)) return { dev: byExtId.get(tbId), by: 'externalId' };
          if (sk && bySlaveKey.has(sk)) return { dev: bySlaveKey.get(sk), by: `slave:${s}` };
          if (nn && byName.has(nn)) return { dev: byName.get(nn), by: 'name' };
          if (nn && byTbName.has(nn)) return { dev: byTbName.get(nn), by: 'metadata.tbName' };
          if (nn && byDisplay.has(nn)) return { dev: byDisplay.get(nn), by: 'displayName' };
          return null;
        }

        const stats = {
          phase: `Buscando atributos SERVER_SCOPE (0/${tbDevices.length})…`,
          gcdrTotal: gcdrDevices.length,
          total: tbDevices.length,
          foundInGcdr: 0,
          notFound: 0,
        };

        function updateLoadingUI() {
          const body = overlay.querySelector('#gsfi-body');
          if (body) body.innerHTML = renderLoadingBody(stats);
        }
        updateLoadingUI();

        // Fetch SERVER_SCOPE attrs for all TB devices (batched: 10 at a time, 1s delay)
        const deviceAttrsMap = new Map(); // tbDeviceId → attrs
        const chunks = [];
        for (let i = 0; i < tbDevices.length; i += 10) chunks.push(tbDevices.slice(i, i + 10));

        for (let ci = 0; ci < chunks.length; ci++) {
          if (ci > 0) await sleep(1000);
          stats.phase = `Atributos: lote ${ci + 1}/${chunks.length}…`;
          updateLoadingUI();
          await Promise.all(
            chunks[ci].map(async (dev) => {
              const tbId = dev.id.id;
              try {
                const attrs = await guFetchDeviceServerScopeAttrs(tbId);
                deviceAttrsMap.set(tbId, attrs);
              } catch {
                /* non-fatal */
              }
            })
          );
        }

        // Build match results
        const rows = tbDevices.map((dev) => {
          const tbId = dev.id.id;
          const name = dev.name || dev.label || tbId;
          const attrs = deviceAttrsMap.get(tbId) || {};

          const match = findGCDRDevice(tbId, attrs, name);
          if (!match) {
            stats.notFound++;
            return { status: 'NOMATCH', tbId, name, gcdrDeviceId: null, gcdrAssetId: null, matchedBy: null };
          }

          const { dev: gcdrDev, by: matchedBy } = match;
          stats.foundInGcdr++;
          const alreadySynced = attrs.gcdrDeviceId === gcdrDev.id;
          return {
            status: alreadySynced ? 'SYNCED' : 'MATCH',
            tbId,
            name,
            gcdrDeviceId: gcdrDev.id,
            gcdrAssetId: gcdrDev.assetId ?? null,
            matchedBy,
          };
        });

        // Show results
        const nToWrite = rows.filter((r) => r.status === 'MATCH').length;
        const nSynced = rows.filter((r) => r.status === 'SYNCED').length;
        overlay.querySelector('#gsfi-body').innerHTML = renderResultsBody(rows);
        overlay.querySelector('#gsfi-footer').innerHTML = `
          <button class="gu-fu-btn gu-fu-btn-secondary" id="gsfi-cancel">Cancelar</button>
          <button class="gu-fu-btn gu-fu-btn-primary" id="gsfi-apply"
            ${nToWrite === 0 ? 'disabled' : ''}>
            🔄 Aplicar (${nToWrite + nSynced} devices)
          </button>`;

        overlay.querySelector('#gsfi-cancel').addEventListener('click', closeModal);
        overlay.querySelector('#gsfi-apply')?.addEventListener('click', async () => {
          // ── Execute: write gcdrDeviceId to TB ──
          overlay.querySelector('#gsfi-footer').innerHTML = '';
          overlay.querySelector('#gsfi-body').innerHTML = `
            <div class="gu-fu-progress-wrap">
              <div class="gu-fu-progress-bar-bg">
                <div class="gu-fu-progress-bar" id="gsfi-exec-prog" style="width:0%;background:#1d4ed8"></div>
              </div>
              <div class="gu-fu-progress-label" id="gsfi-exec-label">Aplicando…</div>
            </div>`;

          const toWrite = rows.filter((r) => r.status === 'MATCH' || r.status === 'SYNCED');
          const total = toWrite.length;
          const results = [];
          const syncedAt = new Date().toISOString();

          const writeChunks = [];
          for (let i = 0; i < toWrite.length; i += 10) writeChunks.push(toWrite.slice(i, i + 10));

          let done = 0;
          for (let ci = 0; ci < writeChunks.length; ci++) {
            if (ci > 0) await sleep(1000);
            await Promise.all(
              writeChunks[ci].map(async (row) => {
                done++;
                const pct = Math.round((done / total) * 100);
                const progEl = overlay.querySelector('#gsfi-exec-prog');
                const lblEl = overlay.querySelector('#gsfi-exec-label');
                if (progEl) progEl.style.width = pct + '%';
                if (lblEl) lblEl.textContent = `${done}/${total} — ${row.name}`;
                try {
                  await guSaveDeviceServerScopeAttrs(row.tbId, {
                    gcdrDeviceId: row.gcdrDeviceId,
                    ...(row.gcdrAssetId ? { gcdrAssetId: row.gcdrAssetId } : {}),
                    gcdrSyncedAt: syncedAt,
                  });
                  results.push({ ...row, ok: true });
                } catch (err) {
                  results.push({ ...row, ok: false, error: err.message });
                }
              })
            );
          }

          overlay.querySelector('#gsfi-body').innerHTML = renderExecBody(results);
          overlay.querySelector('#gsfi-footer').innerHTML =
            `<button class="gu-fu-btn gu-fu-btn-success" id="gsfi-done">Fechar</button>`;
          overlay.querySelector('#gsfi-done').addEventListener('click', closeModal);
        });
      })
      .catch((err) => showError(err.message));
  }

  // ================================================================
  // Raio X — Dry Run GCDR Sync Diagnostics
  // Reads TB tree + GCDR bundle, compares side-by-side, NO writes.
  // Status per entity:
  //   SYNCED   — found in GCDR and TB already has the correct gcdrId
  //   MATCH    — found in GCDR but TB attr missing/different (would update)
  //   NEW      — not found in GCDR (would be created)
  //   SKIPPED  — device has no slaveId+centralId (always ignored by sync)
  //   NO_ASSET — parent asset wasn't mapped to GCDR
  // ================================================================

  function openGCDRRaioXModal() {
    if (!selectedCustomer) return;

    if (!gcdrTenantId || !gcdrCustomerId || !gcdrApiKey) {
      const missing = [
        !gcdrTenantId && 'gcdrTenantId',
        !gcdrCustomerId && 'gcdrCustomerId',
        !gcdrApiKey && 'gcdrApiKey',
      ].filter(Boolean).join(', ');
      window.alert(`Raio X bloqueado.\nAtributos SERVER_SCOPE ausentes no customer: ${missing}`);
      return;
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let overlay;

    function closeModal() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function renderShell(bodyHtml, footerHtml) {
      overlay.innerHTML = `
        <div class="gu-fu-modal" style="max-width:1200px">
          <div class="gu-fu-header">
            <div>
              <div class="gu-fu-title">⚡ Raio X — Diagnóstico GCDR Sync</div>
              <div class="gu-fu-subtitle">
                Customer: ${selectedCustomer.name}
                <span style="margin-left:10px;background:#ede9ff;color:#4c1d95;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px">DRY RUN — somente leitura, nenhuma alteração será feita</span>
              </div>
            </div>
            <button class="gu-fu-close" id="grx-x">✕</button>
          </div>
          <div class="gu-fu-body" id="grx-body">${bodyHtml}</div>
          <div class="gu-fu-footer" id="grx-footer">${footerHtml}</div>
        </div>`;
      overlay.querySelector('#grx-x').addEventListener('click', closeModal);
    }

    function setBody(html) {
      const el = overlay.querySelector('#grx-body');
      if (el) el.innerHTML = html;
    }

    function renderProgress(phase, done, total, color) {
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const c = color || '#7c3aed';
      return `
        <div style="padding:4px 0">
          <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:14px">⏳ ${phase}</div>
          <div class="gu-fu-progress-bar-bg" style="margin-bottom:6px">
            <div class="gu-fu-progress-bar" style="width:${pct}%;background:${c}"></div>
          </div>
          <div style="display:flex;justify-content:space-between">
            <div class="gu-fu-progress-label">${done > 0 ? `${done} / ${total}` : '…'}</div>
            <div style="font-size:13px;font-weight:700;color:${c}">${pct > 0 ? pct + '%' : ''}</div>
          </div>
        </div>`;
    }

    function renderReport(assetReport, deviceReport) {
      const aSynced  = assetReport.filter((r) => r.status === 'SYNCED').length;
      const aMatch   = assetReport.filter((r) => r.status === 'MATCH').length;
      const aNew     = assetReport.filter((r) => r.status === 'NEW').length;
      const aErr     = assetReport.filter((r) => r.status === 'ERROR').length;
      const dSynced  = deviceReport.filter((r) => r.status === 'SYNCED').length;
      const dMatch   = deviceReport.filter((r) => r.status === 'MATCH').length;
      const dNew     = deviceReport.filter((r) => r.status === 'NEW').length;
      const dSkipped = deviceReport.filter((r) => r.status === 'SKIPPED').length;
      const dNoAsset = deviceReport.filter((r) => r.status === 'NO_ASSET').length;
      const dErr     = deviceReport.filter((r) => r.status === 'ERROR').length;

      function statusChip(status) {
        const map = {
          SYNCED:   ['✅ SYNCED',    '#d1fae5', '#065f46'],
          MATCH:    ['🔄 MATCH',     '#dbeafe', '#1e40af'],
          NEW:      ['✨ NOVO',      '#ede9ff', '#4c1d95'],
          SKIPPED:  ['⚠️ IGNORADO',  '#fef3c7', '#92400e'],
          NO_ASSET: ['❌ SEM ASSET', '#fee2e2', '#991b1b'],
          ERROR:    ['❌ ERRO',      '#fee2e2', '#991b1b'],
        };
        const [label, bg, color] = map[status] || [status, '#f3f4f6', '#374151'];
        return `<span style="font-size:10px;background:${bg};color:${color};padding:2px 7px;border-radius:4px;font-weight:700;white-space:nowrap">${label}</span>`;
      }

      function uuid(id, full) {
        if (!id) return '<span style="color:#9ca3af">—</span>';
        const display = full ? id : id.substring(0, 8) + '…';
        return `<code style="font-size:10px;background:#f3f4f6;padding:1px 4px;border-radius:3px;color:#374151" title="${id}">${display}</code>`;
      }

      // Shows the GCDR-side value vs what's currently stored in TB SERVER_SCOPE.
      // Green tick = in sync. Orange = present but diverges. Red = missing in TB.
      function diffCell(gcdrVal, tbVal) {
        if (!gcdrVal) return '<span style="color:#9ca3af">—</span>';
        if (gcdrVal === tbVal) {
          return `${uuid(gcdrVal)} <span style="font-size:10px;color:#10b981;font-weight:600">✓ TB ok</span>`;
        }
        const tbPart = tbVal
          ? `${uuid(tbVal)} <span style="font-size:10px;color:#92400e;font-weight:600">⚠ diverge</span>`
          : '<span style="font-size:10px;color:#ef4444;font-weight:600">✗ ausente no TB</span>';
        return `${uuid(gcdrVal)}<div style="margin-top:3px">${tbPart}</div>`;
      }

      const thStyle = 'padding:6px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;background:#f9fafb;border-bottom:2px solid #e5e7eb';
      const tableStyle = 'width:100%;border-collapse:collapse;font-size:12px';

      const assetRows = assetReport.map((r) => `
        <tr data-status="${r.status}" style="border-bottom:1px solid #f3f4f6">
          <td style="padding:7px 8px">${statusChip(r.status)}</td>
          <td style="padding:7px 8px">
            <div style="font-weight:600">${r.name}</div>
            ${r.label && r.label !== r.name ? `<div style="font-size:10px;color:#9ca3af">${r.label}</div>` : ''}
            <div style="font-size:10px;color:#d1d5db;font-family:monospace">${r.tbId}</div>
          </td>
          <td style="padding:7px 8px">${diffCell(r.gcdrAssetId, r.gcdrAssetIdInTB)}</td>
          <td style="padding:7px 8px">${r.parentGcdrId ? uuid(r.parentGcdrId) : '<span style="color:#9ca3af">raiz</span>'}</td>
          <td style="padding:7px 8px">
            ${r.matchBy ? `<span style="font-size:10px;background:#f0fdf4;color:#166534;padding:1px 5px;border-radius:3px">${r.matchBy}</span>` : '<span style="color:#9ca3af">—</span>'}
            ${r.wouldMove ? `<span style="font-size:10px;background:#fef9c3;color:#854d0e;padding:1px 5px;border-radius:3px;margin-left:4px">↪ mover</span>` : ''}
          </td>
          <td style="padding:7px 8px;color:#ef4444;font-size:11px">${r.error || ''}</td>
        </tr>`).join('');

      const deviceRows = deviceReport.map((r) => `
        <tr data-status="${r.status}" style="border-bottom:1px solid #f3f4f6">
          <td style="padding:7px 8px">${statusChip(r.status)}</td>
          <td style="padding:7px 8px">
            <div style="font-weight:600">${r.name}</div>
            ${r.label && r.label !== r.name ? `<div style="font-size:10px;color:#9ca3af">${r.label}</div>` : ''}
            <div style="font-size:10px;color:#d1d5db;font-family:monospace">${r.tbId}</div>
          </td>
          <td style="padding:7px 8px">
            ${r.slaveId != null ? `<span style="font-size:10px;background:#f0f9ff;color:#0369a1;padding:1px 5px;border-radius:3px">slave:${r.slaveId}</span>` : ''}
            ${r.centralId ? `<div style="font-size:10px;color:#9ca3af;font-family:monospace;margin-top:2px" title="${r.centralId}">${r.centralId.substring(0, 8)}…</div>` : ''}
          </td>
          <td style="padding:7px 8px">${diffCell(r.gcdrDeviceId, r.gcdrDeviceIdInTB)}</td>
          <td style="padding:7px 8px">
            ${r.matchBy ? `<span style="font-size:10px;background:#f0fdf4;color:#166534;padding:1px 5px;border-radius:3px">${r.matchBy}</span>` : '<span style="color:#9ca3af">—</span>'}
            ${r.wouldMove ? `<span style="font-size:10px;background:#fef9c3;color:#854d0e;padding:1px 5px;border-radius:3px;margin-left:4px">↪ mover</span>` : ''}
          </td>
          <td style="padding:7px 8px;color:#6b7280;font-size:11px">${r.note || r.error || ''}</td>
        </tr>`).join('');

      return `
        <!-- Summary cards (clicáveis para filtrar) -->
        <div id="grx-filter-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:6px">
          ${[
            { label: 'Assets TB',       val: assetReport.length,       color: '#374151', bg: '#f3f4f6', scope: 'assets',  fstatus: 'ALL'     },
            { label: 'Assets OK',       val: aSynced,                  color: '#065f46', bg: '#d1fae5', scope: 'assets',  fstatus: 'SYNCED'  },
            { label: 'Assets match',    val: aMatch,                   color: '#1e40af', bg: '#dbeafe', scope: 'assets',  fstatus: 'MATCH'   },
            { label: 'Assets novos',    val: aNew,                     color: '#4c1d95', bg: '#ede9ff', scope: 'assets',  fstatus: 'NEW'     },
            { label: 'Devices TB',      val: deviceReport.length,      color: '#374151', bg: '#f3f4f6', scope: 'devices', fstatus: 'ALL'     },
            { label: 'Devices OK',      val: dSynced,                  color: '#065f46', bg: '#d1fae5', scope: 'devices', fstatus: 'SYNCED'  },
            { label: 'Devices match',   val: dMatch,                   color: '#1e40af', bg: '#dbeafe', scope: 'devices', fstatus: 'MATCH'   },
            { label: 'Devices novos',   val: dNew,                     color: '#4c1d95', bg: '#ede9ff', scope: 'devices', fstatus: 'NEW'     },
            { label: 'Ignorados',       val: dSkipped,                 color: '#92400e', bg: '#fef3c7', scope: 'devices', fstatus: 'SKIPPED' },
            { label: 'Erros/Sem asset', val: aErr + dNoAsset + dErr,   color: '#991b1b', bg: '#fee2e2', scope: 'both',   fstatus: 'ERRORS'  },
          ].map(({ label, val, color, bg, scope, fstatus }) => `
            <div data-grx-scope="${scope}" data-grx-fstatus="${fstatus}"
                 style="background:${bg};border-radius:8px;padding:8px 10px;text-align:center;cursor:pointer;transition:box-shadow .15s,outline .15s"
                 title="Clique para filtrar">
              <div style="font-size:20px;font-weight:800;color:${color}">${val}</div>
              <div style="font-size:10px;color:${color};font-weight:600;margin-top:1px">${label}</div>
            </div>`).join('')}
        </div>
        <div id="grx-filter-badge" style="display:none;margin-bottom:10px;font-size:11px;color:#6b7280;padding:4px 0">
          Filtro ativo: <span id="grx-filter-label" style="font-weight:700;color:#374151"></span>
          <span id="grx-filter-clear" style="margin-left:8px;cursor:pointer;color:#3b82f6;text-decoration:underline">Limpar</span>
        </div>

        <!-- Legend -->
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;padding:8px 12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
          ${[
            ['✅ SYNCED',    '#d1fae5', '#065f46', 'gcdrId em TB correto'],
            ['🔄 MATCH',    '#dbeafe', '#1e40af', 'encontrado no GCDR, TB desatualizado'],
            ['✨ NOVO',     '#ede9ff', '#4c1d95', 'não existe no GCDR ainda'],
            ['⚠️ IGNORADO', '#fef3c7', '#92400e', 'sem slaveId+centralId'],
            ['❌ SEM ASSET','#fee2e2', '#991b1b', 'asset pai não mapeado'],
          ].map(([label, bg, c, desc]) =>
            `<span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#374151">
              <span style="background:${bg};color:${c};padding:1px 6px;border-radius:4px;font-weight:700;font-size:10px;white-space:nowrap">${label}</span>
              <span style="color:#6b7280">${desc}</span>
            </span>`).join('')}
        </div>

        <!-- Assets table -->
        <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">
          📁 Assets (${assetReport.length})
        </div>
        <div style="overflow-x:auto;margin-bottom:18px">
          <table style="${tableStyle}">
            <thead><tr>
              <th style="${thStyle}">Status</th>
              <th style="${thStyle}">Nome TB</th>
              <th style="${thStyle}">gcdrAssetId (GCDR → TB atual)</th>
              <th style="${thStyle}">Pai GCDR</th>
              <th style="${thStyle}">Match / Ação</th>
              <th style="${thStyle}">Obs</th>
            </tr></thead>
            <tbody id="grx-asset-tbody">${assetRows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#9ca3af">Nenhum asset</td></tr>'}</tbody>
          </table>
        </div>

        <!-- Devices table -->
        <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">
          📟 Devices (${deviceReport.length})
        </div>
        <div style="overflow-x:auto">
          <table style="${tableStyle}">
            <thead><tr>
              <th style="${thStyle}">Status</th>
              <th style="${thStyle}">Nome TB</th>
              <th style="${thStyle}">slaveId / centralId</th>
              <th style="${thStyle}">gcdrDeviceId (GCDR → TB atual)</th>
              <th style="${thStyle}">Match / Ação</th>
              <th style="${thStyle}">Obs</th>
            </tr></thead>
            <tbody id="grx-device-tbody">${deviceRows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#9ca3af">Nenhum device</td></tr>'}</tbody>
          </table>
        </div>`;
    }

    function buildRaioXLog(aReport, dReport) {
      const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n);
      const hr = (n) => '─'.repeat(n);
      const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
      const lines = [
        '╔══════════════════════════════════════════════════════════════════════════════╗',
        '║  RAIO X — Diagnóstico GCDR Sync                                            ║',
        '╚══════════════════════════════════════════════════════════════════════════════╝',
        `Customer : ${selectedCustomer.name}`,
        `Gerado em: ${ts}`,
        `Tipo     : DRY RUN — somente leitura, nenhuma alteração foi feita`,
        '',
        hr(80),
        'RESUMO',
        hr(80),
        `Assets  : ${aReport.length} total | SYNCED:${aReport.filter((r) => r.status === 'SYNCED').length} | MATCH:${aReport.filter((r) => r.status === 'MATCH').length} | NEW:${aReport.filter((r) => r.status === 'NEW').length} | ERROR:${aReport.filter((r) => r.status === 'ERROR').length}`,
        `Devices : ${dReport.length} total | SYNCED:${dReport.filter((r) => r.status === 'SYNCED').length} | MATCH:${dReport.filter((r) => r.status === 'MATCH').length} | NEW:${dReport.filter((r) => r.status === 'NEW').length} | SKIPPED:${dReport.filter((r) => r.status === 'SKIPPED').length} | NO_ASSET:${dReport.filter((r) => r.status === 'NO_ASSET').length} | ERROR:${dReport.filter((r) => r.status === 'ERROR').length}`,
        '',
        hr(80),
        `ASSETS (${aReport.length})`,
        hr(80),
        `${pad('STATUS', 10)} ${pad('NOME TB', 40)} ${pad('gcdrAssetId', 38)} ${pad('MatchBy', 20)} Obs`,
        hr(120),
        ...aReport.map((r) => {
          const obs = [
            r.gcdrAssetIdInTB && r.gcdrAssetIdInTB !== r.gcdrAssetId ? `TB atual: ${r.gcdrAssetIdInTB}` : (r.gcdrAssetId && !r.gcdrAssetIdInTB ? 'ausente no TB' : ''),
            r.wouldMove ? '[MOVE]' : '',
            r.error || '',
          ].filter(Boolean).join(' ');
          return `${pad(r.status, 10)} ${pad(r.name, 40)} ${pad(r.gcdrAssetId || '—', 38)} ${pad(r.matchBy || '—', 20)} ${obs}`;
        }),
        '',
        hr(80),
        `DEVICES (${dReport.length})`,
        hr(80),
        `${pad('STATUS', 10)} ${pad('NOME TB', 40)} ${pad('slave', 8)} ${pad('gcdrDeviceId', 38)} ${pad('MatchBy', 20)} Obs`,
        hr(130),
        ...dReport.map((r) => {
          const obs = [r.note || '', r.error || '', r.wouldMove ? '[MOVE]' : ''].filter(Boolean).join(' ');
          return `${pad(r.status, 10)} ${pad(r.name, 40)} ${pad(r.slaveId ?? '—', 8)} ${pad(r.gcdrDeviceId || '—', 38)} ${pad(r.matchBy || '—', 20)} ${obs}`;
        }),
      ];
      return lines.join('\n');
    }

    function bindRaioXInteractivity(aReport, dReport) {
      let activeScope = null;
      let activeFStatus = null;

      function applyFilter(scope, fstatus) {
        const assetTbody = overlay.querySelector('#grx-asset-tbody');
        const deviceTbody = overlay.querySelector('#grx-device-tbody');
        if (assetTbody) {
          assetTbody.querySelectorAll('tr[data-status]').forEach((tr) => {
            const s = tr.dataset.status;
            let show;
            if (scope === 'devices') show = false;
            else if (fstatus === 'ALL') show = true;
            else if (fstatus === 'ERRORS') show = s === 'ERROR';
            else show = s === fstatus;
            tr.style.display = show ? '' : 'none';
          });
        }
        if (deviceTbody) {
          deviceTbody.querySelectorAll('tr[data-status]').forEach((tr) => {
            const s = tr.dataset.status;
            let show;
            if (scope === 'assets') show = false;
            else if (fstatus === 'ALL') show = true;
            else if (fstatus === 'ERRORS') show = s === 'NO_ASSET' || s === 'ERROR';
            else show = s === fstatus;
            tr.style.display = show ? '' : 'none';
          });
        }
        overlay.querySelectorAll('[data-grx-scope]').forEach((card) => {
          const isActive = card.dataset.grxScope === scope && card.dataset.grxFstatus === fstatus;
          card.style.outline = isActive ? '2px solid #7c3aed' : '';
          card.style.boxShadow = isActive ? '0 0 0 4px rgba(124,58,237,.2)' : '';
        });
        const badge = overlay.querySelector('#grx-filter-badge');
        const labelEl = overlay.querySelector('#grx-filter-label');
        if (badge && labelEl) {
          const scopeLabel = { assets: 'Assets', devices: 'Devices', both: 'Assets + Devices' }[scope] || scope;
          labelEl.textContent = `${scopeLabel} — ${fstatus === 'ALL' ? 'todos' : fstatus}`;
          badge.style.display = 'block';
        }
      }

      function resetFilter() {
        activeScope = null;
        activeFStatus = null;
        overlay.querySelectorAll('#grx-asset-tbody tr[data-status], #grx-device-tbody tr[data-status]').forEach((tr) => {
          tr.style.display = '';
        });
        overlay.querySelectorAll('[data-grx-scope]').forEach((card) => {
          card.style.outline = '';
          card.style.boxShadow = '';
        });
        const badge = overlay.querySelector('#grx-filter-badge');
        if (badge) badge.style.display = 'none';
      }

      overlay.querySelectorAll('[data-grx-scope]').forEach((card) => {
        card.addEventListener('click', () => {
          const scope = card.dataset.grxScope;
          const fstatus = card.dataset.grxFstatus;
          if (activeScope === scope && activeFStatus === fstatus) {
            resetFilter();
          } else {
            activeScope = scope;
            activeFStatus = fstatus;
            applyFilter(scope, fstatus);
          }
        });
      });

      const clearBtn = overlay.querySelector('#grx-filter-clear');
      if (clearBtn) clearBtn.addEventListener('click', resetFilter);

      const dlBtn = overlay.querySelector('#grx-download-log');
      if (dlBtn) {
        dlBtn.addEventListener('click', () => {
          const txt = buildRaioXLog(aReport, dReport);
          const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const safeName = selectedCustomer.name.replace(/[^a-zA-Z0-9_-]/g, '_');
          a.href = url;
          a.download = `raiox-${safeName}-${new Date().toISOString().slice(0, 10)}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      }
    }

    // ── Open modal ────────────────────────────────────────────────
    overlay = document.createElement('div');
    overlay.className = 'gu-fu-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
    renderShell(renderProgress('Iniciando análise…', 0, 0), '');

    (async () => {
      try {
        // ── FASE 0: Build TB tree ──────────────────────────────────
        setBody(renderProgress('Fase 0/2 — Mapeando árvore ThingsBoard…', 0, 0));
        console.log('[Raio X] Fase 0: guTbBuildTree');
        const tbAssets = await guTbBuildTree(selectedCustomer.id, selectedCustomer.name);
        const topoAssets = guTopoFlatten(tbAssets);
        console.log(`[Raio X] TB tree: ${topoAssets.length} assets`);

        // ── FASE 1: Fetch GCDR bundle ──────────────────────────────
        setBody(renderProgress('Fase 1/2 — Carregando bundle GCDR…', 0, 0));
        console.log('[Raio X] Fase 1: guFetchGCDRCustomerBundle');
        const bundle = await guFetchGCDRCustomerBundle(selectedCustomer.id, gcdrTenantId);
        if (!bundle) throw new Error('Customer não encontrado no GCDR. Verifique gcdrCustomerId e tenant.');

        const bundleAssets  = Array.isArray(bundle.assets)  ? bundle.assets  : [];
        const bundleDevices = Array.isArray(bundle.devices) ? bundle.devices : [];
        const gcdrAssetList  = bundleAssets.filter( (a) => !a.customerId || a.customerId === gcdrCustomerId);
        const gcdrDeviceList = bundleDevices.filter((d) => !d.customerId || d.customerId === gcdrCustomerId);

        const gcdrAssetMap = new Map(gcdrAssetList.map((a) => [a.id, { ...a, devices: [] }]));
        for (const d of gcdrDeviceList) {
          gcdrAssetMap.get(d.assetId)?.devices.push(d);
        }
        console.log(`[Raio X] bundle: ${gcdrAssetList.length} assets, ${gcdrDeviceList.length} devices`);

        // ── FASE 2: Analyze assets (read-only) ────────────────────
        const assetReport = [];
        const gcdrAssetIdByTbId = new Map();
        // Pre-populate from SERVER_SCOPE attrs already in the TB tree nodes
        for (const a of topoAssets) {
          if (a.scope?.gcdrAssetId) gcdrAssetIdByTbId.set(a.id, a.scope.gcdrAssetId);
        }

        const totalAssets = topoAssets.length;
        let doneAssets = 0;

        for (const tbAsset of topoAssets) {
          doneAssets++;
          setBody(renderProgress(
            `Fase 2/2 — Analisando assets… (${doneAssets}/${totalAssets})`,
            doneAssets, totalAssets, '#7c3aed'
          ));

          const matchedGcdr = guMatchAsset(tbAsset, gcdrAssetList);
          const parentGcdrId = tbAsset._parentId
            ? (gcdrAssetIdByTbId.get(tbAsset._parentId) ?? null)
            : null;
          const gcdrAssetIdInTB = tbAsset.scope?.gcdrAssetId ?? null;

          if (matchedGcdr) {
            gcdrAssetIdByTbId.set(tbAsset.id, matchedGcdr.id);
            const synced = gcdrAssetIdInTB === matchedGcdr.id;
            const wouldMove = !!(parentGcdrId && matchedGcdr.parentAssetId !== parentGcdrId);
            assetReport.push({
              name: tbAsset.name, tbId: tbAsset.id, label: tbAsset.label || '',
              status: synced && !wouldMove ? 'SYNCED' : 'MATCH',
              gcdrAssetId: matchedGcdr.id,
              gcdrAssetIdInTB,
              matchBy: [guNorm(tbAsset.name), guNorm(tbAsset.label)].filter(Boolean).join(' / '),
              parentGcdrId: parentGcdrId || null,
              wouldMove,
            });
          } else {
            assetReport.push({
              name: tbAsset.name, tbId: tbAsset.id, label: tbAsset.label || '',
              status: 'NEW',
              gcdrAssetId: null,
              gcdrAssetIdInTB,
              matchBy: null,
              parentGcdrId: parentGcdrId || null,
              wouldMove: false,
            });
          }
          await sleep(30); // micro-delay so progress bar renders
        }

        // ── FASE 3: Analyze devices (read-only) ───────────────────
        const allTbDevices = [];
        for (const tbAsset of topoAssets) {
          const gcdrAssetId = gcdrAssetIdByTbId.get(tbAsset.id) ?? null;
          for (const dev of tbAsset.devices || []) {
            allTbDevices.push({ ...dev, _tbAssetId: tbAsset.id, _gcdrAssetId: gcdrAssetId });
          }
        }

        const deviceReport = [];
        const consumedGcdrDeviceIds = new Set();
        const gcdrDeviceByExternalId = new Map();
        for (const d of gcdrDeviceList) {
          if (d.externalId) gcdrDeviceByExternalId.set(d.externalId, d);
        }

        for (const tbDev of allTbDevices) {
          const scope = tbDev.scope || {};
          const slaveId = scope.slaveId != null ? scope.slaveId : null;
          const centralId = scope.centralId ?? null;
          const gcdrDeviceIdInTB = scope.gcdrDeviceId ?? null;

          if (slaveId == null && !centralId) {
            deviceReport.push({
              name: tbDev.name, tbId: tbDev.id, label: tbDev.label || '',
              status: 'SKIPPED',
              gcdrDeviceId: null, gcdrDeviceIdInTB,
              slaveId: null, centralId: null,
              matchBy: null, wouldMove: false,
              note: 'Sem slaveId e centralId',
            });
            continue;
          }

          const gcdrAssetId = tbDev._gcdrAssetId;
          if (!gcdrAssetId) {
            deviceReport.push({
              name: tbDev.name, tbId: tbDev.id, label: tbDev.label || '',
              status: 'NO_ASSET',
              gcdrDeviceId: null, gcdrDeviceIdInTB,
              slaveId, centralId,
              matchBy: null, wouldMove: false,
              note: 'Asset TB não foi mapeado ao GCDR',
            });
            continue;
          }

          const gcdrDevicesForAsset = (gcdrAssetMap.get(gcdrAssetId)?.devices ?? [])
            .filter((d) => !consumedGcdrDeviceIds.has(d.id));

          let matchResult = guMatchDevice(tbDev, scope, gcdrDevicesForAsset);
          if (!matchResult) {
            const byExtId = gcdrDeviceByExternalId.get(tbDev.id);
            if (byExtId && !consumedGcdrDeviceIds.has(byExtId.id)) {
              matchResult = { device: byExtId, by: 'externalId' };
            }
          }

          if (matchResult) {
            consumedGcdrDeviceIds.add(matchResult.device.id);
            const gcdrDeviceId = matchResult.device.id;
            const synced = gcdrDeviceIdInTB === gcdrDeviceId;
            const wouldMove = matchResult.device.assetId !== gcdrAssetId;
            deviceReport.push({
              name: tbDev.name, tbId: tbDev.id, label: tbDev.label || '',
              status: synced && !wouldMove ? 'SYNCED' : 'MATCH',
              gcdrDeviceId,
              gcdrDeviceIdInTB,
              slaveId, centralId,
              matchBy: matchResult.by,
              wouldMove,
              note: null,
            });
          } else {
            deviceReport.push({
              name: tbDev.name, tbId: tbDev.id, label: tbDev.label || '',
              status: 'NEW',
              gcdrDeviceId: null,
              gcdrDeviceIdInTB,
              slaveId, centralId,
              matchBy: null,
              wouldMove: false,
              note: null,
            });
          }
        }

        // ── Render report ─────────────────────────────────────────
        setBody(renderReport(assetReport, deviceReport));
        overlay.querySelector('#grx-footer').innerHTML =
          `<button class="gu-fu-btn" id="grx-download-log" style="background:linear-gradient(180deg,#7c3aed,#5b21b6);color:#fff">⬇ Baixar Log (.txt)</button>
           <button class="gu-fu-btn gu-fu-btn-secondary" id="grx-done">Fechar</button>`;
        bindRaioXInteractivity(assetReport, deviceReport);
        overlay.querySelector('#grx-done').addEventListener('click', closeModal);
      } catch (err) {
        console.error('[Raio X] Erro:', err);
        setBody(`<div style="color:#ef4444;font-size:13px;padding:8px 0">❌ ${err.message}</div>`);
        overlay.querySelector('#grx-footer').innerHTML =
          `<button class="gu-fu-btn gu-fu-btn-secondary" id="grx-close">Fechar</button>`;
        overlay.querySelector('#grx-close').addEventListener('click', closeModal);
      }
    })();
  }

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
      return labels
        .map((label, i) => {
          const n = i + 1;
          const cls = n < step ? 'done' : n === step ? 'active' : '';
          const icon = n < step ? '✓' : n;
          return `
          ${i > 0 ? '<span class="gu-fu-step-sep">›</span>' : ''}
          <div class="gu-fu-step ${cls}">
            <div class="gu-fu-step-num">${icon}</div>
            <span>${label}</span>
          </div>`;
        })
        .join('');
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
      const nFail = matchResults.filter((r) => r.status === 'FAIL').length;
      const nWarn = matchResults.filter((r) => r.status === 'WARNING').length;

      const rows = matchResults
        .map((r) => {
          const statusLabel = r.status === 'WARNING' ? '⚠ WARN' : r.status === 'MATCH' ? '✓ MATCH' : '✗ FAIL';
          const tbInfo =
            r.tbMatches.length > 0
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
        })
        .join('');

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
      const ok = results.filter((r) => r.ok);
      const err = results.filter((r) => !r.ok);
      const items = results
        .map(
          (r) => `
        <li class="gu-fu-result-item">
          <span class="gu-fu-result-icon">${r.ok ? '✅' : '❌'}</span>
          <div>
            <div class="gu-fu-result-name">${r.name} <span style="font-weight:400;color:#9ca3af">(slave ${r.slaveId} / ${r.centralId})</span></div>
            ${
              r.ok
                ? `<div class="gu-fu-result-msg">gcdrDeviceId gravado no ThingsBoard</div>`
                : `<div class="gu-fu-result-err">${r.error}</div>`
            }
          </div>
        </li>`
        )
        .join('');
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
          errEl.textContent =
            'Nenhuma linha válida encontrada. Verifique o formato (7 campos separados por |).';
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
          const set = (id, v) => {
            const el = q(id);
            if (el) el.textContent = v;
          };
          set('#gu-fu-match-pct', pct + '%');
          set('#gu-fu-match-phase', stats.phase || '');
          set('#gu-fu-stat-filter', stats.filterCount ?? '—');
          set('#gu-fu-stat-total', stats.total > 0 ? stats.total : '—');
          set('#gu-fu-stat-enriched', stats.enriched);
          set('#gu-fu-stat-discard', stats.discarded);
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
        overlay.querySelector('#gu-fu-body').innerHTML = `<div class="gu-fu-progress-wrap">
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
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
    renderModal();
  }

  const guSleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Match: fetch all TB devices + attrs, then match by slaveId + centralId
  async function guRunMatch(rows, onProgress) {
    const filterCount = rows.length;
    onProgress?.({
      phase: 'Buscando lista de devices no customer…',
      filterCount,
      total: 0,
      enriched: 0,
      discarded: 0,
    });

    const devices = await guFetchCustomerDevices(selectedCustomer.id);
    const total = devices.length;
    onProgress?.({
      phase: `${total} devices encontrados — carregando atributos…`,
      filterCount,
      total,
      enriched: 0,
      discarded: 0,
    });

    // Batch fetch attrs: 10 concurrent, 1s delay between batches
    const deviceAttrsMap = new Map();
    const chunks = [];
    for (let i = 0; i < total; i += 10) chunks.push(devices.slice(i, i + 10));

    let enriched = 0;
    let discarded = 0;

    for (let ci = 0; ci < chunks.length; ci++) {
      if (ci > 0) await guSleep(1000);
      await Promise.all(
        chunks[ci].map(async (dev) => {
          const tbId = dev.id?.id || dev.id;
          const attrs = await guFetchDeviceServerScopeAttrs(tbId);
          const hasKey = !!(
            attrs.slaveId != null &&
            attrs.centralId != null &&
            String(attrs.slaveId).trim() &&
            String(attrs.centralId).trim()
          );
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
        })
      );
    }

    // Match each row
    return rows.map((row) => {
      const rowSlave = String(row.slaveId).trim();
      const rowCentral = String(row.centralId).trim();

      const matches = [];
      for (const [, info] of deviceAttrsMap) {
        const tbSlave = String(info.attrs.slaveId ?? '').trim();
        const tbCentral = String(info.attrs.centralId ?? '').trim();
        if (tbSlave === rowSlave && tbCentral === rowCentral) {
          matches.push(info);
        }
      }

      return {
        ...row,
        status: matches.length === 0 ? 'FAIL' : matches.length === 1 ? 'MATCH' : 'WARNING',
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
      await Promise.all(
        chunks[ci].map(async ({ row, match }) => {
          current++;
          onProgress(current, total, row.name);
          try {
            await guSaveDeviceServerScopeAttrs(match.tbId, {
              gcdrDeviceId: row.gcdrDeviceId,
              gcdrAssetId: row.gcdrParentAssetId,
              gcdrSyncedAt: syncedAt,
            });
            results.push({ ...row, tbId: match.tbId, tbName: match.name, ok: true });
          } catch (err) {
            results.push({ ...row, tbId: match.tbId, tbName: match.name, ok: false, error: err.message });
          }
        })
      );
    }
    return results;
  }

  // ================================================================
  // Force Clear GCDR IDs
  // Clears GCDR-sync keys from TB SERVER_SCOPE of both devices and assets.
  //   Devices: gcdrDeviceId, gcdrId, gcdrSyncedAt, gcdrAssetId, gcdrCustomerId
  //   Assets:  gcdrAssetId,  gcdrId, gcdrSyncedAt, gcdrParentAssetId, gcdrCustomerId
  // ================================================================

  const GCDR_CLEAR_DEVICE_KEYS = ['gcdrDeviceId', 'gcdrId', 'gcdrSyncedAt', 'gcdrAssetId', 'gcdrCustomerId'];
  const GCDR_CLEAR_ASSET_KEYS  = ['gcdrAssetId', 'gcdrId', 'gcdrSyncedAt', 'gcdrParentAssetId', 'gcdrCustomerId'];

  function openForceClearModal() {
    if (!selectedCustomer) return;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let overlay;

    function closeModal() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function renderShell(bodyHtml, footerHtml) {
      overlay.innerHTML = `
        <div class="gu-fu-modal" style="max-width:820px">
          <div class="gu-fu-header">
            <div>
              <div class="gu-fu-title">🧹 Force Clear GCDR IDs</div>
              <div class="gu-fu-subtitle">Customer: ${selectedCustomer.name}</div>
            </div>
            <button class="gu-fu-close" id="gfc-x">✕</button>
          </div>
          <div class="gu-fu-body" id="gfc-body">${bodyHtml}</div>
          <div class="gu-fu-footer" id="gfc-footer">${footerHtml}</div>
        </div>`;
      overlay.querySelector('#gfc-x').addEventListener('click', closeModal);
    }

    function renderLoading(phase, done, total) {
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return `
        <div style="padding:4px 0">
          <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:14px">
            ⏳ ${phase}
          </div>
          <div class="gu-fu-progress-bar-bg" style="margin-bottom:6px">
            <div class="gu-fu-progress-bar" style="width:${pct}%;background:#dc2626"></div>
          </div>
          <div style="display:flex;justify-content:space-between">
            <div class="gu-fu-progress-label">${done} / ${total} entidades</div>
            <div style="font-size:13px;font-weight:700;color:#dc2626">${pct}%</div>
          </div>
        </div>`;
    }

    function renderPreview(deviceRows, assetRows) {
      const devToClear  = deviceRows.filter((r) => r.hasAny);
      const devClean    = deviceRows.filter((r) => !r.hasAny);
      const assetToClear = assetRows.filter((r) => r.hasAny);
      const assetClean  = assetRows.filter((r) => !r.hasAny);
      const totalToClear = devToClear.length + assetToClear.length;

      function keyBadges(present, keys) {
        return keys
          .filter((k) => present[k])
          .map((k) => `<span style="font-size:10px;background:#fee2e2;color:#991b1b;padding:1px 5px;border-radius:3px;margin:1px;display:inline-block">${k}</span>`)
          .join('');
      }

      function buildTable(rows, keys) {
        if (rows.length === 0) return '<div style="font-size:12px;color:#6b7280;padding:8px 0">Nenhum item a limpar.</div>';
        return `<div style="overflow-x:auto">
          <table class="gu-fu-table">
            <thead><tr><th>Nome TB</th><th>Chaves presentes</th></tr></thead>
            <tbody>${rows.map((r) => `<tr>
              <td title="${r.tbId}">${r.name}<br>
                <span style="color:#9ca3af;font-size:10px;font-family:monospace">${r.tbId.substring(0, 8)}…</span>
              </td>
              <td>${keyBadges(r.present, keys)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>`;
      }

      return `
        <!-- Summary badges -->
        <div class="gu-fu-summary" style="margin-bottom:16px">
          <span class="gu-fu-badge fail">🧹 ${devToClear.length} devices a limpar</span>
          <span class="gu-fu-badge" style="background:#f3f4f6;color:#374151">✓ ${devClean.length} devices já limpos</span>
          <span class="gu-fu-badge fail" style="background:#fef3c7;color:#92400e">🧹 ${assetToClear.length} assets a limpar</span>
          <span class="gu-fu-badge" style="background:#f3f4f6;color:#374151">✓ ${assetClean.length} assets já limpos</span>
        </div>

        <!-- Devices section -->
        <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">
          📟 Devices (${deviceRows.length})
          <span style="font-size:10px;font-weight:400;color:#6b7280;text-transform:none;margin-left:6px">
            chaves: <code>${GCDR_CLEAR_DEVICE_KEYS.join(', ')}</code>
          </span>
        </div>
        ${buildTable(devToClear, GCDR_CLEAR_DEVICE_KEYS)}

        <!-- Assets section -->
        <div style="font-size:11px;font-weight:700;color:#374151;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.5px">
          📁 Assets (${assetRows.length})
          <span style="font-size:10px;font-weight:400;color:#6b7280;text-transform:none;margin-left:6px">
            chaves: <code>${GCDR_CLEAR_ASSET_KEYS.join(', ')}</code>
          </span>
        </div>
        ${buildTable(assetToClear, GCDR_CLEAR_ASSET_KEYS)}

        ${totalToClear === 0 ? '<div class="at-empty" style="padding:12px 0;text-align:center;color:#6b7280">Nenhum device ou asset possui essas chaves. Nada a limpar.</div>' : ''}`;
    }

    function renderExecResult(devResults, assetResults) {
      const allResults = [...devResults, ...assetResults];
      const ok  = allResults.filter((r) => r.ok);
      const err = allResults.filter((r) => !r.ok);

      function section(title, results) {
        if (results.length === 0) return '';
        return `
          <div style="font-size:11px;font-weight:700;color:#374151;margin:12px 0 6px;text-transform:uppercase;letter-spacing:.5px">${title}</div>
          <ul class="gu-fu-result-list">
            ${results.map((r) => `
              <li class="gu-fu-result-item">
                <span class="gu-fu-result-icon">${r.ok ? '✅' : '❌'}</span>
                <div>
                  <div class="gu-fu-result-name">${r.name}</div>
                  ${r.ok
                    ? `<div class="gu-fu-result-msg">Chaves removidas: ${r.cleared.join(', ')}</div>`
                    : `<div class="gu-fu-result-err">${r.error}</div>`}
                </div>
              </li>`).join('')}
          </ul>`;
      }

      return `
        <div class="gu-fu-summary" style="margin-bottom:16px">
          <span class="gu-fu-badge match">✓ ${ok.length} limpos</span>
          ${err.length ? `<span class="gu-fu-badge fail">✗ ${err.length} erros</span>` : ''}
        </div>
        ${section('📟 Devices', devResults)}
        ${section('📁 Assets', assetResults)}`;
    }

    // ── Open modal ──
    overlay = document.createElement('div');
    overlay.className = 'gu-fu-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
    renderShell(renderLoading('Buscando devices e assets do customer…', 0, 0), '');

    // ── Phase 1: fetch all entities + read SERVER_SCOPE attrs ──
    (async () => {
      try {
        const [tbDevices, tbAssets] = await Promise.all([
          guFetchCustomerDevices(selectedCustomer.id),
          guFetchCustomerTBAssets(selectedCustomer.id),
        ]);
        const total = tbDevices.length + tbAssets.length;

        const deviceRows = [];
        const assetRows  = [];

        // Batch helper: process array in chunks of 10 with 1s delay between chunks
        async function processBatch(items, fetchFn, keys, targetRows, entityType) {
          const chunks = [];
          for (let i = 0; i < items.length; i += 10) chunks.push(items.slice(i, i + 10));
          let done = 0;
          for (let ci = 0; ci < chunks.length; ci++) {
            if (ci > 0) await sleep(1000);
            await Promise.all(
              chunks[ci].map(async (entity) => {
                const tbId = entity.id?.id || entity.id;
                const name = entity.name || entity.label || tbId;
                let present = {};
                try {
                  const attrs = await fetchFn(tbId);
                  for (const k of keys) present[k] = attrs[k] != null && attrs[k] !== '';
                } catch { /* non-fatal */ }
                targetRows.push({ tbId, name, entityType, present, hasAny: keys.some((k) => present[k]) });
                done++;
              })
            );
            const totalDone = deviceRows.length + assetRows.length;
            const body = overlay.querySelector('#gfc-body');
            if (body) body.innerHTML = renderLoading(`Buscando atributos SERVER_SCOPE (${entityType})…`, totalDone, total);
          }
        }

        await processBatch(tbDevices, guFetchDeviceServerScopeAttrs, GCDR_CLEAR_DEVICE_KEYS, deviceRows, 'DEVICE');
        await processBatch(tbAssets,  guFetchAssetServerScopeAttrs,  GCDR_CLEAR_ASSET_KEYS,  assetRows,  'ASSET');

        // ── Phase 2: show preview ──
        overlay.querySelector('#gfc-body').innerHTML = renderPreview(deviceRows, assetRows);
        const devToClear   = deviceRows.filter((r) => r.hasAny);
        const assetToClear = assetRows.filter((r) => r.hasAny);
        const totalToClear = devToClear.length + assetToClear.length;

        overlay.querySelector('#gfc-footer').innerHTML = `
          <button class="gu-fu-btn gu-fu-btn-secondary" id="gfc-cancel">Cancelar</button>
          <button class="gu-fu-btn gu-fu-btn-primary" id="gfc-apply"
            style="background:#dc2626;${totalToClear === 0 ? 'opacity:.5;cursor:not-allowed' : ''}"
            ${totalToClear === 0 ? 'disabled' : ''}>
            🧹 Limpar ${totalToClear} ${totalToClear === 1 ? 'entidade' : 'entidades'}
          </button>`;

        overlay.querySelector('#gfc-cancel').addEventListener('click', closeModal);

        overlay.querySelector('#gfc-apply')?.addEventListener('click', async () => {
          // ── Phase 3: execute delete ──
          const total3 = totalToClear;
          let done3 = 0;

          overlay.querySelector('#gfc-footer').innerHTML = '';
          overlay.querySelector('#gfc-body').innerHTML = `
            <div class="gu-fu-progress-wrap">
              <div class="gu-fu-progress-bar-bg">
                <div class="gu-fu-progress-bar" id="gfc-exec-prog" style="width:0%;background:#dc2626"></div>
              </div>
              <div class="gu-fu-progress-label" id="gfc-exec-label">Limpando…</div>
            </div>`;

          async function execClear(rows, deleteFn, keys) {
            const results = [];
            const chunks = [];
            for (let i = 0; i < rows.length; i += 10) chunks.push(rows.slice(i, i + 10));
            for (let ci = 0; ci < chunks.length; ci++) {
              if (ci > 0) await sleep(1000);
              await Promise.all(
                chunks[ci].map(async (row) => {
                  done3++;
                  const pct = Math.round((done3 / total3) * 100);
                  const progEl = overlay.querySelector('#gfc-exec-prog');
                  const lblEl  = overlay.querySelector('#gfc-exec-label');
                  if (progEl) progEl.style.width = pct + '%';
                  if (lblEl)  lblEl.textContent = `${done3}/${total3} — ${row.name}`;
                  const keysToDelete = keys.filter((k) => row.present[k]);
                  try {
                    await deleteFn(row.tbId, keysToDelete);
                    results.push({ ...row, ok: true, cleared: keysToDelete });
                  } catch (err) {
                    results.push({ ...row, ok: false, error: err.message, cleared: [] });
                  }
                })
              );
            }
            return results;
          }

          const devResults   = await execClear(devToClear,   guDeleteDeviceServerScopeAttrs, GCDR_CLEAR_DEVICE_KEYS);
          const assetResults = await execClear(assetToClear, guDeleteAssetServerScopeAttrs,  GCDR_CLEAR_ASSET_KEYS);

          overlay.querySelector('#gfc-body').innerHTML = renderExecResult(devResults, assetResults);
          overlay.querySelector('#gfc-footer').innerHTML =
            `<button class="gu-fu-btn gu-fu-btn-secondary" id="gfc-done">Fechar</button>`;
          overlay.querySelector('#gfc-done').addEventListener('click', closeModal);
        });
      } catch (err) {
        overlay.querySelector('#gfc-body').innerHTML =
          `<div style="color:#ef4444;font-size:13px;padding:8px 0">❌ ${err.message}</div>`;
        overlay.querySelector('#gfc-footer').innerHTML =
          `<button class="gu-fu-btn gu-fu-btn-secondary" id="gfc-close">Fechar</button>`;
        overlay.querySelector('#gfc-close').addEventListener('click', closeModal);
      }
    })();
  }

  // --- GCDR Sync Force ID button ---
  btnSyncForceId.addEventListener('click', () => {
    if (!selectedCustomer) return;
    openSyncForceIdModal();
  });

  // --- Raio X button ---
  if (btnRaioX) {
    btnRaioX.addEventListener('click', () => {
      if (!selectedCustomer) return;
      openGCDRRaioXModal();
    });
  }

  // --- Force Clear GCDR IDs button ---
  if (btnForceClear) {
    btnForceClear.addEventListener('click', () => {
      if (!selectedCustomer) return;
      openForceClearModal();
    });
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
