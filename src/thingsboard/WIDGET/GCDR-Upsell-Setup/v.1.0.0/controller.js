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
              <button id="gu-btn-gcdr" class="gu-btn gu-btn-gcdr" disabled>
                <span>🔗</span><span>Sincronizar GCDR</span>
              </button>
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
  const btnGCDR       = root.querySelector('#gu-btn-gcdr');
  const btnUpsell     = root.querySelector('#gu-btn-upsell');

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
