/* global self, localStorage, document, window */

/**
 * Dispatch-ReleaseNotes Widget — v.1.0.0
 *
 * Lists all users from a selected customer and all its child customers.
 * Intended to be used as a recipients directory for dispatching release notes.
 *
 * Layout:
 *   Left panel  — searchable customer selector (fetched from ThingsBoard)
 *   Right panel — user table (customer + descendants, with selection)
 *
 * Dependencies:
 *   - ThingsBoard JWT token (localStorage.jwt_token)
 */

// ============================================================
// ThingsBoard API helpers
// ============================================================

function drAuthHeaders() {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('Token JWT não disponível');
  return {
    'Content-Type': 'application/json',
    'X-Authorization': `Bearer ${token}`,
  };
}

/** Fetch all customers (paginated). Returns array of TB customer objects. */
async function drFetchAllCustomers() {
  const headers = drAuthHeaders();
  let customers = [];
  let page = 0;
  while (true) {
    const res = await fetch(`/api/customers?pageSize=100&page=${page}`, { headers });
    if (!res.ok) throw new Error(`Erro ao buscar customers: HTTP ${res.status}`);
    const data = await res.json();
    customers = customers.concat(data.data || []);
    if (!data.hasNext) break;
    page++;
  }
  return customers;
}

/** Fetch all users for a given customerId (paginated). */
async function drFetchCustomerUsers(customerId) {
  const headers = drAuthHeaders();
  let users = [];
  let page = 0;
  while (true) {
    const res = await fetch(
      `/api/customer/${customerId}/users?pageSize=100&page=${page}`,
      { headers },
    );
    if (!res.ok) {
      console.warn(`[DR] users HTTP ${res.status} for customer ${customerId}`);
      break;
    }
    const data = await res.json();
    users = users.concat(data.data || []);
    if (!data.hasNext) break;
    page++;
  }
  return users;
}

/** Build map: customerId → [childCustomerId, ...] */
function drBuildChildrenMap(customers) {
  const map = {};
  customers.forEach((c) => {
    const pid = c.parentCustomerId?.id;
    if (pid) {
      if (!map[pid]) map[pid] = [];
      map[pid].push(c.id.id);
    }
  });
  return map;
}

/** Return all descendant IDs (including self) for a given customerId. */
function drGetDescendantIds(customerId, childrenMap) {
  const result = [customerId];
  const queue = [customerId];
  while (queue.length) {
    const cur = queue.shift();
    (childrenMap[cur] || []).forEach((child) => {
      result.push(child);
      queue.push(child);
    });
  }
  return result;
}

// ============================================================
// Widget state
// ============================================================
let _allCustomers = [];       // raw TB customer objects
let _childrenMap  = {};       // customerId -> [childId, ...]
let _customerMap  = {};       // customerId -> customer object
let _selectedId   = null;     // currently selected customer ID
let _users        = [];       // flat user rows currently displayed
let _selected     = new Set();// selected user IDs
let _loadingUsers = false;

// ============================================================
// Render helpers
// ============================================================

function drEsc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function drInitials(email) {
  const parts = (email || '').split('@')[0].replace(/[._-]/g, ' ').split(' ');
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
}

function drAvatarColor(email) {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  const colors = ['#6932A8', '#0a6d5e', '#3e1a7d', '#065f46', '#1e40af', '#831843', '#7c2d12'];
  return colors[h % colors.length];
}

function drRoleLabel(authority) {
  const map = { TENANT_ADMIN: 'Admin Tenant', CUSTOMER_USER: 'Usuário', SYS_ADMIN: 'Admin Sistema' };
  return map[authority] || authority || '—';
}

// ============================================================
// Widget
// ============================================================

self.onInit = function () {
  const container = self.ctx.$container[0];
  container.innerHTML = '';

  // ── Inject styles ────────────────────────────────────────────────────────────
  const STYLE_ID = 'dr-widget-styles';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dr-root {
        font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        background: #F6F7FB;
        color: #1F2937;
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* Header */
      .dr-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 20px 12px;
        background: #fff;
        border-bottom: 1px solid #E5E7EB;
        flex-shrink: 0;
      }
      .dr-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .dr-header-icon {
        width: 34px;
        height: 34px;
        background: linear-gradient(135deg, #6932A8, #3e1a7d);
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        flex-shrink: 0;
      }
      .dr-header-title {
        font-size: 14px;
        font-weight: 700;
        color: #1F2937;
      }
      .dr-header-title span { color: #6932A8; }
      .dr-header-sub {
        font-size: 11px;
        color: #6B7280;
        margin-top: 1px;
      }
      .dr-badge {
        font-size: 11px;
        background: #6932A8;
        color: #fff;
        border-radius: 999px;
        padding: 2px 9px;
        font-weight: 600;
      }

      /* Layout */
      .dr-layout {
        display: grid;
        grid-template-columns: 260px 1fr;
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }

      /* Left panel */
      .dr-left {
        display: flex;
        flex-direction: column;
        border-right: 1px solid #E5E7EB;
        background: #fff;
        min-height: 0;
        overflow: hidden;
      }
      .dr-left-header {
        padding: 12px 14px 10px;
        border-bottom: 1px solid #E5E7EB;
        flex-shrink: 0;
      }
      .dr-left-header h3 {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #9CA3AF;
        margin: 0 0 8px;
      }
      .dr-search {
        width: 100%;
        box-sizing: border-box;
        padding: 7px 10px;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        font-size: 13px;
        background: #F6F7FB;
        color: #1F2937;
        outline: none;
        transition: border-color .15s;
      }
      .dr-search:focus { border-color: #6932A8; }
      .dr-customer-list {
        flex: 1;
        overflow-y: auto;
        padding: 6px 0;
      }
      .dr-customer-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        font-size: 13px;
        cursor: pointer;
        user-select: none;
        border-left: 3px solid transparent;
        transition: background .1s;
      }
      .dr-customer-item:hover { background: #F3F0FA; }
      .dr-customer-item.selected {
        background: #EDE7F6;
        border-left-color: #6932A8;
        font-weight: 600;
        color: #5a2890;
      }
      .dr-customer-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #D1C4E9;
        flex-shrink: 0;
      }
      .dr-customer-item.selected .dr-customer-dot { background: #6932A8; }
      .dr-customer-name {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dr-children-badge {
        font-size: 10px;
        background: #EDE7F6;
        color: #6932A8;
        border-radius: 999px;
        padding: 1px 6px;
        font-weight: 600;
        flex-shrink: 0;
      }
      .dr-customer-item.selected .dr-children-badge {
        background: #6932A8;
        color: #fff;
      }
      .dr-no-results {
        padding: 24px 14px;
        font-size: 12.5px;
        color: #9CA3AF;
        text-align: center;
      }
      .dr-list-loading {
        padding: 20px 14px;
        font-size: 12.5px;
        color: #9CA3AF;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }

      /* Right panel */
      .dr-right {
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
        background: #F6F7FB;
      }
      .dr-right-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 18px;
        background: #fff;
        border-bottom: 1px solid #E5E7EB;
        flex-shrink: 0;
      }
      .dr-toolbar-info {
        flex: 1;
        min-width: 0;
      }
      .dr-toolbar-title {
        font-size: 14px;
        font-weight: 700;
        color: #1F2937;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dr-toolbar-sub {
        font-size: 11px;
        color: #6B7280;
        margin-top: 1px;
      }
      .dr-toolbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .dr-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        background: #fff;
        color: #374151;
        font-size: 12.5px;
        font-weight: 500;
        cursor: pointer;
        transition: background .12s, border-color .12s;
        white-space: nowrap;
      }
      .dr-btn:hover { background: #F3F4F6; border-color: #D1D5DB; }
      .dr-btn.primary {
        background: #6932A8;
        color: #fff;
        border-color: #6932A8;
      }
      .dr-btn.primary:hover { background: #5a2890; border-color: #5a2890; }
      .dr-btn:disabled {
        opacity: .45;
        cursor: not-allowed;
        pointer-events: none;
      }
      .dr-selected-count {
        font-size: 12px;
        color: #6B7280;
        white-space: nowrap;
      }
      .dr-selected-count strong { color: #6932A8; }

      /* Empty / loading states */
      .dr-empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: #9CA3AF;
        padding: 40px 20px;
      }
      .dr-empty svg { opacity: .35; }
      .dr-empty-title {
        font-size: 14px;
        font-weight: 600;
        color: #6B7280;
      }
      .dr-empty-sub {
        font-size: 12.5px;
        color: #9CA3AF;
        text-align: center;
      }

      /* Spinner */
      .dr-spinner {
        width: 22px;
        height: 22px;
        border: 2.5px solid #E5E7EB;
        border-top-color: #6932A8;
        border-radius: 50%;
        animation: dr-spin .7s linear infinite;
      }
      @keyframes dr-spin { to { transform: rotate(360deg); } }

      /* Users table */
      .dr-users-wrap {
        flex: 1;
        overflow-y: auto;
        padding: 14px 18px;
      }
      .dr-users-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        background: #fff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,.06);
      }
      .dr-users-table thead tr {
        background: #F9FAFB;
        border-bottom: 1px solid #E5E7EB;
      }
      .dr-users-table thead th {
        padding: 10px 14px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .4px;
        color: #6B7280;
        text-align: left;
        white-space: nowrap;
      }
      .dr-users-table thead th.th-check {
        width: 36px;
        padding-left: 14px;
        padding-right: 4px;
      }
      .dr-users-table tbody tr {
        border-bottom: 1px solid #F3F4F6;
        transition: background .08s;
      }
      .dr-users-table tbody tr:last-child { border-bottom: none; }
      .dr-users-table tbody tr:hover { background: #FAFAFA; }
      .dr-users-table tbody tr.row-selected { background: #F5F0FD; }
      .dr-users-table td {
        padding: 10px 14px;
        vertical-align: middle;
      }
      .dr-users-table td.td-check {
        padding-left: 14px;
        padding-right: 4px;
        width: 36px;
      }
      .dr-user-cell {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .dr-avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        color: #fff;
        flex-shrink: 0;
        letter-spacing: .3px;
      }
      .dr-user-name {
        font-weight: 600;
        color: #1F2937;
        white-space: nowrap;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dr-user-email {
        font-size: 11.5px;
        color: #6B7280;
        white-space: nowrap;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dr-customer-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        background: #F3F0FA;
        color: #5a2890;
        border-radius: 6px;
        font-size: 11.5px;
        font-weight: 500;
        max-width: 160px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .dr-customer-tag.is-child {
        background: #EDE7F6;
      }
      .dr-role-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
      }
      .dr-role-badge.admin { background: #FEF3C7; color: #92400E; }
      .dr-role-badge.user  { background: #D1FAE5; color: #065F46; }
      .dr-role-badge.sys   { background: #FEE2E2; color: #991B1B; }

      /* Section divider inside table (child customers) */
      .dr-section-row td {
        padding: 6px 14px;
        background: #F6F7FB;
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .5px;
        color: #9CA3AF;
        border-top: 1px solid #E5E7EB;
        border-bottom: 1px solid #E5E7EB;
      }

      /* Checkbox */
      .dr-check {
        width: 15px;
        height: 15px;
        cursor: pointer;
        accent-color: #6932A8;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="dr-root">

      <header class="dr-header">
        <div class="dr-header-left">
          <div class="dr-header-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <div>
            <div class="dr-header-title">Dispatch <span>Release Notes</span></div>
            <div class="dr-header-sub">Selecione um customer para ver usuários</div>
          </div>
        </div>
        <span class="dr-badge" id="dr-total-badge">0 usuários</span>
      </header>

      <div class="dr-layout">

        <!-- Left: customer selector -->
        <div class="dr-left">
          <div class="dr-left-header">
            <h3>Customers</h3>
            <input class="dr-search" id="dr-customer-search" type="text" placeholder="Buscar customer..." autocomplete="off" />
          </div>
          <div class="dr-customer-list" id="dr-customer-list">
            <div class="dr-list-loading"><div class="dr-spinner"></div><span>Carregando...</span></div>
          </div>
        </div>

        <!-- Right: users panel -->
        <div class="dr-right">

          <div class="dr-right-toolbar" id="dr-right-toolbar">
            <div class="dr-toolbar-info">
              <div class="dr-toolbar-title" id="dr-toolbar-title">Nenhum customer selecionado</div>
              <div class="dr-toolbar-sub" id="dr-toolbar-sub">Escolha um customer na lista à esquerda</div>
            </div>
            <div class="dr-toolbar-actions">
              <span class="dr-selected-count" id="dr-sel-count" style="display:none">
                <strong id="dr-sel-num">0</strong> selecionado(s)
              </span>
              <button class="dr-btn" id="dr-btn-select-all" disabled>Selecionar todos</button>
              <button class="dr-btn primary" id="dr-btn-dispatch" disabled>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Disparar
              </button>
            </div>
          </div>

          <div id="dr-users-area" class="dr-empty">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#9CA3AF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <div class="dr-empty-title">Sem dados</div>
            <div class="dr-empty-sub">Selecione um customer para carregar os usuários</div>
          </div>

        </div>
      </div>
    </div>
  `;

  // ── Load customers ────────────────────────────────────────────────────────────
  drFetchAllCustomers()
    .then((customers) => {
      _allCustomers = customers;
      _childrenMap  = drBuildChildrenMap(customers);
      _customerMap  = {};
      customers.forEach((c) => { _customerMap[c.id.id] = c; });
      drRenderCustomerList(customers, '');
    })
    .catch((err) => {
      document.getElementById('dr-customer-list').innerHTML =
        `<div class="dr-no-results" style="color:#ef4444">Erro ao carregar customers:<br>${drEsc(err.message)}</div>`;
    });

  // ── Customer search ───────────────────────────────────────────────────────────
  document.getElementById('dr-customer-search').addEventListener('input', (e) => {
    drRenderCustomerList(_allCustomers, e.target.value.trim());
  });

  // ── Select all / Dispatch ─────────────────────────────────────────────────────
  document.getElementById('dr-btn-select-all').addEventListener('click', () => {
    const allChecked = _selected.size === _users.length;
    if (allChecked) {
      _selected.clear();
    } else {
      _users.forEach((u) => _selected.add(u.id.id));
    }
    drSyncCheckboxes();
    drUpdateSelectionUI();
  });

  document.getElementById('dr-btn-dispatch').addEventListener('click', () => {
    if (_selected.size === 0) return;
    const emails = _users.filter((u) => _selected.has(u.id.id)).map((u) => u.email);
    alert(`Dispatch para ${emails.length} usuário(s):\n\n${emails.join('\n')}`);
  });
};

// ============================================================
// Customer list renderer
// ============================================================
function drRenderCustomerList(customers, filter) {
  const list = document.getElementById('dr-customer-list');
  if (!list) return;

  const q = filter.toLowerCase();
  const filtered = q
    ? customers.filter((c) => c.title.toLowerCase().includes(q))
    : customers;

  filtered.sort((a, b) => a.title.localeCompare(b.title));

  if (!filtered.length) {
    list.innerHTML = `<div class="dr-no-results">Nenhum customer encontrado</div>`;
    return;
  }

  list.innerHTML = filtered.map((c) => {
    const childCount = (_childrenMap[c.id.id] || []).length;
    const selected   = c.id.id === _selectedId ? 'selected' : '';
    const childBadge = childCount > 0
      ? `<span class="dr-children-badge" title="${childCount} sub-customer(s)">${childCount}</span>`
      : '';
    return `
      <div class="dr-customer-item ${selected}" data-id="${drEsc(c.id.id)}" data-title="${drEsc(c.title)}">
        <div class="dr-customer-dot"></div>
        <span class="dr-customer-name">${drEsc(c.title)}</span>
        ${childBadge}
      </div>`;
  }).join('');

  list.querySelectorAll('.dr-customer-item').forEach((el) => {
    el.addEventListener('click', () => {
      _selectedId = el.dataset.id;
      list.querySelectorAll('.dr-customer-item').forEach((x) => x.classList.remove('selected'));
      el.classList.add('selected');
      drLoadUsersForCustomer(_selectedId, el.dataset.title);
    });
  });
}

// ============================================================
// User loading
// ============================================================
async function drLoadUsersForCustomer(customerId, customerTitle) {
  if (_loadingUsers) return;
  _loadingUsers = true;
  _users = [];
  _selected.clear();

  const area = document.getElementById('dr-users-area');
  const toolbarTitle = document.getElementById('dr-toolbar-title');
  const toolbarSub   = document.getElementById('dr-toolbar-sub');

  toolbarTitle.textContent = customerTitle;
  toolbarSub.textContent   = 'Carregando usuários...';
  document.getElementById('dr-btn-select-all').disabled = true;
  document.getElementById('dr-btn-dispatch').disabled   = true;
  document.getElementById('dr-sel-count').style.display = 'none';
  document.getElementById('dr-total-badge').textContent = '…';

  area.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:40px 20px;color:#9CA3AF;">
    <div class="dr-spinner"></div><span style="font-size:13px">Buscando usuários...</span>
  </div>`;

  try {
    const ids = drGetDescendantIds(customerId, _childrenMap);

    // Fetch all in parallel (one request per customer)
    const results = await Promise.allSettled(
      ids.map((id) => drFetchCustomerUsers(id).then((users) => ({ id, users }))),
    );

    // Group by customerId for section headers
    const sections = [];
    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value.users.length > 0) {
        sections.push({ customerId: r.value.id, users: r.value.users });
      }
    });

    // Sort: root customer first, then children alphabetically
    sections.sort((a, b) => {
      if (a.customerId === customerId) return -1;
      if (b.customerId === customerId) return 1;
      const na = _customerMap[a.customerId]?.title || '';
      const nb = _customerMap[b.customerId]?.title || '';
      return na.localeCompare(nb);
    });

    // Flatten for selection
    sections.forEach((s) => _users.push(...s.users));

    if (_users.length === 0) {
      area.innerHTML = `
        <div class="dr-empty">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#9CA3AF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          <div class="dr-empty-title">Nenhum usuário encontrado</div>
          <div class="dr-empty-sub">Este customer e seus filhos não possuem usuários cadastrados.</div>
        </div>`;
      toolbarSub.textContent = 'Sem usuários';
      document.getElementById('dr-total-badge').textContent = '0 usuários';
      _loadingUsers = false;
      return;
    }

    // Render table
    const totalDescendants = ids.length - 1;
    toolbarSub.textContent = `${_users.length} usuário(s) · ${ids.length} customer(s)${totalDescendants > 0 ? ` (${totalDescendants} sub-customer${totalDescendants > 1 ? 's' : ''})` : ''}`;
    document.getElementById('dr-total-badge').textContent = `${_users.length} usuários`;
    document.getElementById('dr-btn-select-all').disabled = false;
    document.getElementById('dr-btn-dispatch').disabled   = false;
    drUpdateSelectionUI();

    area.innerHTML = `<div class="dr-users-wrap" id="dr-users-wrap">${drBuildTable(sections, customerId)}</div>`;

    // Bind row checkboxes
    area.querySelectorAll('.dr-row-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        const uid = cb.dataset.uid;
        if (cb.checked) _selected.add(uid);
        else _selected.delete(uid);
        const row = cb.closest('tr');
        row.classList.toggle('row-selected', cb.checked);
        drUpdateSelectionUI();
      });
    });

    // Bind header checkbox
    const allCheck = area.querySelector('#dr-all-check');
    if (allCheck) {
      allCheck.addEventListener('change', () => {
        if (allCheck.checked) _users.forEach((u) => _selected.add(u.id.id));
        else _selected.clear();
        drSyncCheckboxes();
        drUpdateSelectionUI();
      });
    }

  } catch (err) {
    area.innerHTML = `<div class="dr-empty" style="color:#ef4444">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"/>
      </svg>
      <div class="dr-empty-title">Erro ao carregar usuários</div>
      <div class="dr-empty-sub">${drEsc(err.message)}</div>
    </div>`;
    toolbarSub.textContent = 'Erro ao carregar';
  } finally {
    _loadingUsers = false;
  }
}

// ============================================================
// Table builder
// ============================================================
function drBuildTable(sections, rootCustomerId) {
  const rows = sections.map((section) => {
    const cust = _customerMap[section.customerId];
    const custTitle = cust?.title || section.customerId;
    const isChild   = section.customerId !== rootCustomerId;

    const sectionRow = `
      <tr class="dr-section-row">
        <td colspan="5">
          ${isChild ? '↳ ' : ''}${drEsc(custTitle)}
          ${isChild ? `<span style="color:#C4B5FD;font-weight:400;text-transform:none;letter-spacing:0"> — sub-customer</span>` : ''}
        </td>
      </tr>`;

    const userRows = section.users.map((u) => {
      const name     = [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
      const email    = u.email || '—';
      const initials = drInitials(email);
      const avatarBg = drAvatarColor(email);
      const roleLabel = drRoleLabel(u.authority);
      const roleCls   = u.authority === 'TENANT_ADMIN' ? 'admin'
                      : u.authority === 'SYS_ADMIN'    ? 'sys'
                      : 'user';
      return `
        <tr data-uid="${drEsc(u.id.id)}">
          <td class="td-check">
            <input type="checkbox" class="dr-check dr-row-check" data-uid="${drEsc(u.id.id)}" />
          </td>
          <td>
            <div class="dr-user-cell">
              <div class="dr-avatar" style="background:${avatarBg}">${drEsc(initials)}</div>
              <div>
                <div class="dr-user-name" title="${drEsc(name)}">${drEsc(name)}</div>
                <div class="dr-user-email" title="${drEsc(email)}">${drEsc(email)}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="dr-customer-tag ${isChild ? 'is-child' : ''}" title="${drEsc(custTitle)}">${drEsc(custTitle)}</span>
          </td>
          <td><span class="dr-role-badge ${roleCls}">${drEsc(roleLabel)}</span></td>
          <td style="font-size:11.5px;color:#9CA3AF;font-family:ui-monospace,monospace">${drEsc(u.id.id.substring(0,8))}…</td>
        </tr>`;
    }).join('');

    return sectionRow + userRows;
  }).join('');

  return `
    <table class="dr-users-table">
      <thead>
        <tr>
          <th class="th-check"><input type="checkbox" id="dr-all-check" class="dr-check" /></th>
          <th>Usuário</th>
          <th>Customer</th>
          <th>Perfil</th>
          <th>ID</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ============================================================
// Selection UI sync
// ============================================================
function drSyncCheckboxes() {
  const area = document.getElementById('dr-users-area');
  if (!area) return;
  area.querySelectorAll('.dr-row-check').forEach((cb) => {
    cb.checked = _selected.has(cb.dataset.uid);
    cb.closest('tr')?.classList.toggle('row-selected', cb.checked);
  });
  const allCheck = area.querySelector('#dr-all-check');
  if (allCheck) allCheck.checked = _users.length > 0 && _selected.size === _users.length;
}

function drUpdateSelectionUI() {
  const selCount = document.getElementById('dr-sel-count');
  const selNum   = document.getElementById('dr-sel-num');
  const dispatch = document.getElementById('dr-btn-dispatch');
  const selAll   = document.getElementById('dr-btn-select-all');
  if (!selCount) return;

  const n = _selected.size;
  if (n > 0) {
    selCount.style.display = '';
    selNum.textContent     = String(n);
  } else {
    selCount.style.display = 'none';
  }

  if (dispatch) dispatch.disabled = n === 0;
  if (selAll)   selAll.textContent = _users.length > 0 && n === _users.length ? 'Desmarcar todos' : 'Selecionar todos';

  // sync header checkbox
  const allCheck = document.getElementById('dr-all-check');
  if (allCheck) allCheck.checked = _users.length > 0 && n === _users.length;
}

self.onDestroy = function () {};
