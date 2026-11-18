/**
 * RFC-0222 — Customer Energy/Water Pricing Panel (prototype).
 *
 * `openPricingPanel(params)` opens a premium modal with three tabs:
 *   - "Definir preços" — add a price (R$/kWh or R$/m³) per customer × domain ×
 *     category × period (closed month or day-to-day range). Adds are idempotent
 *     (upsert) and overlapping periods within the same
 *     (customer, domain, category) scope are blocked client-side.
 *   - "Dashboard" — KPIs + a filterable report table over energy AND water.
 *   - "Histórico" — the audit trail (created / price-changed / deleted).
 *
 * Persistence is a PROTOTYPE: in-memory + localStorage + `onSave` callback. The
 * real persistence (GCDR `/customers/:id/pricing`) and the real audit sink are
 * documented in the RFC and intentionally not wired here.
 */

import type {
  OpenPricingPanelParams,
  PricingAuditRecord,
  PricingCategory,
  PricingCustomerRef,
  PricingDomain,
  PricingEntry,
  PricingPanelEvent,
  PricingPanelHandle,
  PricingPanelThemeSource,
  TariffCategory,
} from './types';
import {
  categoryLabel,
  DOMAIN_LABEL,
  computePricingKpis,
  entryBounds,
  formatBRL,
  formatPeriodLabel,
  isPricingAllowed,
  parseBRL,
  removeEntryByBounds,
  resolveCustomerId,
  unitLabel,
  upsertEntry,
} from './helpers';
import { injectPricingPanelStyles } from './styles';
import { TariffApiClient } from './tariffApiClient';
import { TariffApiAdapter } from './tariffApiAdapter';
import { mountCategoriesTab, type CategoriesTabHandle } from './categoriesTab';
import { openConfirmDialog } from '../premium-modals/dialog';

const MODAL_ID = 'myio-pricing-panel';

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveTopDocument(): Document {
  try {
    return ((window.top || window) as Window).document;
  } catch {
    return document;
  }
}

// Effective palette: explicit param OR the dashboard global (MyIOUtils.theme).
function resolveThemeVars(explicit?: PricingPanelThemeSource): Record<string, string> | null {
  const theme =
    explicit ||
    (typeof window !== 'undefined'
      ? (window as { MyIOUtils?: { theme?: PricingPanelThemeSource } }).MyIOUtils?.theme
      : undefined);
  if (!theme) return null;
  const vars =
    typeof (theme as { cssVars?: () => Record<string, string> }).cssVars === 'function'
      ? (theme as { cssVars(): Record<string, string> }).cssVars()
      : (theme as Record<string, string>);
  return vars && typeof vars === 'object' ? vars : null;
}

// ED-1386 — modo claro/escuro do diálogo de confirmação: mesma fonte da paleta do
// painel (`mode` do createMyIOTheme), senão o toggle do dashboard, senão claro.
function resolveDialogTheme(explicit?: PricingPanelThemeSource): 'light' | 'dark' {
  const utils =
    typeof window !== 'undefined'
      ? (window as { MyIOUtils?: { theme?: PricingPanelThemeSource; currentTheme?: string } }).MyIOUtils
      : undefined;
  const mode = ((explicit || utils?.theme) as { mode?: unknown } | undefined)?.mode;
  if (mode === 'dark' || mode === 'light') return mode;
  return utils?.currentTheme === 'dark' ? 'dark' : 'light';
}

function isoToBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function isSuperAdmin(): boolean {
  return Boolean((window as { MyIOUtils?: { SuperAdmin?: boolean } }).MyIOUtils?.SuperAdmin);
}

function entriesKey(prefix: string): string {
  return `${prefix}:pricing`;
}
function auditKey(prefix: string): string {
  return `${prefix}:pricing-audit`;
}

function loadJson<T>(doc: Document, key: string, fallback: T): T {
  try {
    const raw = (doc.defaultView || window).localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(doc: Document, key: string, value: unknown): void {
  try {
    (doc.defaultView || window).localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage unavailable (private mode / quota) — prototype tolerates it */
  }
}

/** Merge seeds over stored entries, de-duplicated by scope × period identity. */
function mergeEntries(stored: PricingEntry[], seeds: PricingEntry[], by: string): PricingEntry[] {
  let acc = stored.slice();
  for (const seed of seeds) {
    acc = upsertEntry(acc, { ...seed, currency: 'BRL' }, { by }).entries;
  }
  return acc;
}

function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('pt-BR');
}

export function openPricingPanel(params: OpenPricingPanelParams): PricingPanelHandle {
  const doc = params.targetDocument || resolveTopDocument();
  const author = params.currentUserEmail || '';
  const storePrefix = params.storageKeyPrefix || 'myio';
  const keyEntries = entriesKey(storePrefix);
  const keyAudit = auditKey(storePrefix);

  const listeners: Record<PricingPanelEvent, Array<(payload?: unknown) => void>> = {
    save: [],
    close: [],
    add: [],
    remove: [],
  };
  const emit = (event: PricingPanelEvent, payload?: unknown): void => {
    for (const cb of listeners[event]) {
      try {
        cb(payload);
      } catch {
        /* listener errors are isolated */
      }
    }
  };

  injectPricingPanelStyles(doc);
  doc.getElementById(MODAL_ID)?.remove();

  // RFC-0241 — `allowed` explícito do caller (ex.: admin do usuário que não é
  // @myio.com.br) substitui o gate padrão. Gate de UX apenas: o backend deve
  // impor a autorização de escrita.
  const allowed =
    typeof params.allowed === 'boolean'
      ? params.allowed
      : isPricingAllowed(params.currentUserEmail, isSuperAdmin());
  const customers: PricingCustomerRef[] = params.customers || [];
  // RFC-0241 — dashboard de um único shopping: esconde o seletor de customer.
  const lockCustomer = params.lockCustomer === true && customers.length > 0;

  // RFC-0228 A1 — when a tariff API is configured, persistence goes through the
  // hourly-tariff adapter and localStorage is NOT the source of truth. When it is
  // absent, the localStorage prototype path below is byte-identical (the gate).
  const tariffApi = params.tariffApi;
  let adapter: TariffApiAdapter | null = null;
  let client: TariffApiClient | null = null;
  if (allowed && tariffApi) {
    client = new TariffApiClient({
      baseUrl: tariffApi.baseUrl,
      apiKey: tariffApi.apiKey,
      jwt: tariffApi.jwt,
      tenantId: tariffApi.tenantId,
      fetchImpl: tariffApi.fetchImpl,
    });
    adapter = new TariffApiAdapter(client, { year: tariffApi.year });
  }

  // Prototype state (in-memory). In the localStorage path it is hydrated from
  // localStorage + seeds; in the tariff-API path it starts from seeds only and is
  // (re)hydrated asynchronously from the API — localStorage is never read/written.
  let entries: PricingEntry[] = allowed
    ? adapter
      ? (params.initialEntries || []).map((e) => ({ ...e }))
      : mergeEntries(loadJson<PricingEntry[]>(doc, keyEntries, []), params.initialEntries || [], author)
    : [];
  let auditLog: PricingAuditRecord[] = allowed && !adapter ? loadJson<PricingAuditRecord[]>(doc, keyAudit, []) : [];

  const modal = doc.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'myio-pricing';

  // ---- Close/theme/handle wiring (shared; hoisted so the gated branch can use it) ----
  function applyTheme(): void {
    const themeVars = resolveThemeVars(params.theme);
    if (!themeVars) return;
    Object.entries(themeVars).forEach(([k, v]) => {
      if (k.startsWith('--') && typeof v === 'string') modal.style.setProperty(k, v);
    });
  }
  function wireClose(): void {
    modal.querySelector('.myio-pricing__overlay')?.addEventListener('click', close);
    modal.querySelector('.myio-pricing__close')?.addEventListener('click', close);
    doc.addEventListener('keydown', escHandler);
  }
  function escHandler(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    doc.removeEventListener('keydown', escHandler);
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
    emit('close');
  }
  const handle: PricingPanelHandle = {
    close,
    on(event, cb) {
      if (listeners[event]) listeners[event].push(cb);
    },
    getEntries() {
      return entries.map((e) => ({ ...e }));
    },
    getAuditLog() {
      return auditLog.map((r) => ({ ...r }));
    },
  };

  if (!allowed) {
    modal.innerHTML = `
      <div class="myio-pricing__overlay"></div>
      <div class="myio-pricing__content">
        <div class="myio-pricing__header">
          <h3>💲 Preços de Energia &amp; Água</h3>
          <button class="myio-pricing__close" aria-label="Fechar">&times;</button>
        </div>
        <div class="myio-pricing__body">
          <div class="myio-pricing__locked" data-testid="pricing-locked">
            <span class="myio-pricing__locked-emoji">🔒</span>
            Funcionalidade disponível apenas para usuários MyIO.
          </div>
        </div>
      </div>
    `;
    doc.body.appendChild(modal);
    applyTheme();
    requestAnimationFrame(() => modal.classList.add('show'));
    wireClose();
    return handle;
  }

  const initDomain: PricingDomain = params.domain || 'energy';
  // Categorias = GCDR GET /tariff-categories (com tariffApi) ou params.categories (protótipo).
  // Não existe lista embutida: sem fonte → erro e "Add período" bloqueado.
  let categories: TariffCategory[] | null = null; // null = carregando / falhou
  let categoriesError: string | null = null;

  const customerOptions = customers
    .map((c) => `<option value="${escapeHtml(resolveCustomerId(c))}">${escapeHtml(c.title)}</option>`)
    .join('');

  modal.innerHTML = `
    <div class="myio-pricing__overlay"></div>
    <div class="myio-pricing__content">
      <div class="myio-pricing__header">
        <h3>💲 Preços de Energia &amp; Água</h3>
        <button class="myio-pricing__close" aria-label="Fechar">&times;</button>
      </div>
      <div class="myio-pricing__tabs">
        <button class="myio-pricing__tab active" data-tab="define" data-testid="tab-define">Definir preços</button>
        <button class="myio-pricing__tab" data-tab="dashboard" data-testid="tab-dashboard">Dashboard</button>
        <button class="myio-pricing__tab" data-tab="history" data-testid="tab-history">Histórico</button>
        ${adapter ? '<button class="myio-pricing__tab" data-tab="categories" data-testid="tab-categories">Categorias</button>' : ''}
      </div>
      <div class="myio-pricing__body">
        <!-- TAB: Definir preços -->
        <div class="myio-pricing__panel" data-panel="define">
          <div class="myio-pricing__form">
            <div class="myio-pricing__field myio-pricing__field--full" data-testid="pricing-customer-field"${lockCustomer ? ' style="display:none;"' : ''}>
              <label class="myio-pricing__label" for="myio-pricing-customer">Customer (shopping)</label>
              <select class="myio-pricing__select" id="myio-pricing-customer" data-testid="pricing-customer">
                ${customerOptions}
              </select>
            </div>
            <div class="myio-pricing__field">
              <label class="myio-pricing__label" for="myio-pricing-domain">Domínio</label>
              <select class="myio-pricing__select" id="myio-pricing-domain" data-testid="pricing-domain">
                <option value="energy">Energia</option>
                <option value="water">Água</option>
              </select>
            </div>
            <div class="myio-pricing__field">
              <label class="myio-pricing__label" for="myio-pricing-category">Categoria</label>
              <select class="myio-pricing__select" id="myio-pricing-category" data-testid="pricing-category" disabled>
                <option value="">Carregando categorias…</option>
              </select>
            </div>
            <div class="myio-pricing__field">
              <label class="myio-pricing__label" for="myio-pricing-type">Tipo de período</label>
              <select class="myio-pricing__select" id="myio-pricing-type" data-testid="pricing-type">
                <option value="month">Mês fechado</option>
                <option value="range">Dia a dia</option>
              </select>
            </div>
            <div class="myio-pricing__field">
              <label class="myio-pricing__label" for="myio-pricing-price">Preço (<span data-testid="pricing-unit">R$/kWh</span>)</label>
              <input class="myio-pricing__input" id="myio-pricing-price" data-testid="pricing-price"
                     type="text" inputmode="decimal" placeholder="0,00" />
            </div>
            <div class="myio-pricing__field myio-pricing__field--full" data-period="month">
              <label class="myio-pricing__label" for="myio-pricing-month">Mês</label>
              <input class="myio-pricing__input" id="myio-pricing-month" data-testid="pricing-month" type="month" />
            </div>
            <div class="myio-pricing__field myio-pricing__field--full" data-period="range" style="display:none;">
              <label class="myio-pricing__label">Período (início / fim)</label>
              <div class="myio-pricing__range">
                <input class="myio-pricing__input" id="myio-pricing-start" data-testid="pricing-start" type="date" />
                <input class="myio-pricing__input" id="myio-pricing-end" data-testid="pricing-end" type="date" />
              </div>
            </div>
            <div class="myio-pricing__error" data-testid="pricing-error"></div>
            <button class="myio-pricing__add" data-testid="pricing-add" type="button">Add período</button>
          </div>
          <ul class="myio-pricing__list" data-testid="pricing-list"></ul>
          <div class="myio-pricing__empty" data-testid="pricing-empty">Nenhum período definido para este customer.</div>
        </div>

        <!-- TAB: Dashboard -->
        <div class="myio-pricing__panel" data-panel="dashboard" hidden>
          <div class="myio-pricing__kpis" data-testid="pricing-kpis"></div>
          <div class="myio-pricing__toolbar">
            <label for="myio-pricing-report-domain">Filtrar por domínio:</label>
            <select class="myio-pricing__select" id="myio-pricing-report-domain" data-testid="report-domain" style="width:auto;">
              <option value="all">Todos</option>
              <option value="energy">Energia</option>
              <option value="water">Água</option>
            </select>
          </div>
          <div class="myio-pricing__table-wrap">
            <table class="myio-pricing__table">
              <thead>
                <tr><th>Customer</th><th>Domínio</th><th>Categoria</th><th>Período</th><th>Preço</th></tr>
              </thead>
              <tbody data-testid="report-body"></tbody>
            </table>
          </div>
        </div>

        <!-- TAB: Categorias (só com a API de tarifas do GCDR) -->
        ${adapter ? '<div class="myio-pricing__panel" data-panel="categories" data-testid="categories-panel" hidden></div>' : ''}

        <!-- TAB: Histórico -->
        <div class="myio-pricing__panel" data-panel="history" hidden>
          <ul class="myio-pricing__history" data-testid="history-list"></ul>
          <div class="myio-pricing__empty" data-testid="history-empty">Nenhuma ação registrada ainda.</div>
        </div>
      </div>
    </div>
  `;

  doc.body.appendChild(modal);
  applyTheme();
  requestAnimationFrame(() => modal.classList.add('show'));
  wireClose();

  // Host dos diálogos de confirmação (exclusão de tarifa e de categoria): montado
  // dentro do painel para abrir POR CIMA dele (o painel tem z-index 999999).
  const dialogHost = doc.createElement('div');
  dialogHost.className = 'myio-pricing__dialog-host';
  modal.appendChild(dialogHost);

  // ---- Element refs ----
  const $ = <T extends HTMLElement>(sel: string): T => modal.querySelector(sel) as T;
  const customerSel = $<HTMLSelectElement>('#myio-pricing-customer');
  const domainSel = $<HTMLSelectElement>('#myio-pricing-domain');
  const categorySel = $<HTMLSelectElement>('#myio-pricing-category');
  const typeSel = $<HTMLSelectElement>('#myio-pricing-type');
  const priceInput = $<HTMLInputElement>('#myio-pricing-price');
  const unitSpan = $<HTMLElement>('[data-testid="pricing-unit"]');
  const monthInput = $<HTMLInputElement>('#myio-pricing-month');
  const startInput = $<HTMLInputElement>('#myio-pricing-start');
  const endInput = $<HTMLInputElement>('#myio-pricing-end');
  const monthField = modal.querySelector<HTMLElement>('[data-period="month"]');
  const rangeField = modal.querySelector<HTMLElement>('[data-period="range"]');
  const errorBox = $<HTMLElement>('[data-testid="pricing-error"]');
  const addBtn = $<HTMLButtonElement>('[data-testid="pricing-add"]');
  const listEl = $<HTMLUListElement>('[data-testid="pricing-list"]');
  const emptyEl = $<HTMLElement>('[data-testid="pricing-empty"]');
  const kpiEl = $<HTMLElement>('[data-testid="pricing-kpis"]');
  const reportDomainSel = $<HTMLSelectElement>('[data-testid="report-domain"]');
  const reportBody = $<HTMLElement>('[data-testid="report-body"]');
  const historyList = $<HTMLUListElement>('[data-testid="history-list"]');
  const historyEmpty = $<HTMLElement>('[data-testid="history-empty"]');

  domainSel.value = initDomain;

  // ---- Categorias (GCDR) ----
  const activeCategories = (): TariffCategory[] => (categories || []).filter((c) => c.isActive !== false);
  function renderCategoryOptions(): void {
    const previous = categorySel.value;
    if (categories === null) {
      categorySel.innerHTML = `<option value="">${escapeHtml(
        categoriesError ? 'Erro ao carregar categorias' : 'Carregando categorias…'
      )}</option>`;
      categorySel.disabled = true;
      addBtn.disabled = true;
      return;
    }
    const active = activeCategories();
    const inactive = categories.filter((c) => c.isActive === false);
    categorySel.innerHTML =
      active.map((c) => `<option value="${escapeHtml(c.key)}">${escapeHtml(c.label || c.key)}</option>`).join('') +
      inactive
        .map((c) => `<option value="${escapeHtml(c.key)}" disabled>${escapeHtml(`${c.label || c.key} (inativa)`)}</option>`)
        .join('');
    const keys = active.map((c) => c.key);
    const wanted = [previous, params.category || ''].find((k) => k && keys.includes(k));
    categorySel.value = wanted || keys[0] || '';
    categorySel.disabled = keys.length === 0;
    addBtn.disabled = keys.length === 0;
    if (keys.length === 0) showError('Nenhuma categoria de tarifa ativa no GCDR para este customer.');
  }
  function setCategories(list: TariffCategory[] | null, error: string | null = null): void {
    categories = list;
    categoriesError = error;
    renderCategoryOptions();
    if (error) showError(error);
  }

  // ---- Tabs ----
  modal.querySelectorAll<HTMLButtonElement>('.myio-pricing__tab').forEach((tab) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab as string));
  });
  function selectTab(name: string): void {
    modal.querySelectorAll<HTMLButtonElement>('.myio-pricing__tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    modal.querySelectorAll<HTMLElement>('.myio-pricing__panel').forEach((p) => {
      p.hidden = p.dataset.panel !== name;
    });
    if (name === 'dashboard') renderDashboard();
    if (name === 'history') renderHistory();
    if (name === 'categories') void categoriesTab?.refresh();
  }

  // ---- Aba Categorias (GCDR RFC-0081): gestão + devices de cada categoria ----
  let categoriesTab: CategoriesTabHandle | null = null;
  const categoriesPanel = modal.querySelector<HTMLElement>('[data-panel="categories"]');
  if (client && categoriesPanel) {
    categoriesTab = mountCategoriesTab({
      container: categoriesPanel,
      client,
      getCustomerId: () => customerSel.value,
      dialogContainer: dialogHost,
      // categoria criada/alterada/excluída → recarrega o select e as tarifas
      onChanged: () => void loadFromApi(),
    });
  }

  // ---- Add form behavior ----
  const showError = (msg: string): void => {
    errorBox.textContent = msg;
    errorBox.classList.add('show');
  };
  const clearError = (): void => {
    errorBox.textContent = '';
    errorBox.classList.remove('show');
  };
  const syncPeriodFields = (): void => {
    const isMonth = typeSel.value === 'month';
    if (monthField) monthField.style.display = isMonth ? '' : 'none';
    if (rangeField) rangeField.style.display = isMonth ? 'none' : '';
  };
  const syncUnit = (): void => {
    unitSpan.textContent = unitLabel(domainSel.value as PricingDomain);
  };
  typeSel.addEventListener('change', () => {
    clearError();
    syncPeriodFields();
  });
  domainSel.addEventListener('change', () => {
    clearError();
    syncUnit();
  });
  [customerSel, categorySel].forEach((sel) =>
    sel.addEventListener('change', () => {
      clearError();
      renderList();
    })
  );
  // RFC-0228 A1 — reload the newly selected customer's categories + tariffs from the API.
  if (adapter) {
    customerSel.addEventListener('change', () => {
      void loadFromApi();
      if (categoriesPanel && !categoriesPanel.hidden) void categoriesTab?.refresh();
    });
  }
  syncPeriodFields();
  syncUnit();

  type PersistChange = { kind: 'upsert'; entry: PricingEntry };

  // Surface an adapter/API failure in the form error box. A version conflict
  // (RFC-0054 409 TARIFF_VERSION_CONFLICT) is shown, never swallowed.
  function surfaceApiError(err: unknown, action: 'save' | 'delete' = 'save'): void {
    const code = (err as { code?: string })?.code;
    if (code === 'TARIFF_VERSION_CONFLICT') {
      const cv = (err as { currentVersion?: number }).currentVersion;
      showError(
        `Conflito de versão: a tarifa mudou no servidor${
          cv != null ? ` (versão atual ${cv})` : ''
        }. Reabra o painel e tente novamente.`
      );
      return;
    }
    if (action === 'delete') {
      showError(`Falha ao excluir a tarifa no servidor${code ? ` (${code})` : ''}. A lista foi recarregada.`);
      return;
    }
    showError(`Falha ao salvar a tarifa no servidor${code ? ` (${code})` : ''}.`);
  }

  // Reload the selected customer's categories (GCDR) and tariffs, and merge into state.
  async function loadFromApi(): Promise<void> {
    if (!adapter) return;
    const customerId = customerSel.value;
    if (!customerId) return;
    setCategories(null);
    try {
      setCategories(await adapter.listCategories(customerId, { includeInactive: true }));
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setCategories(
        null,
        `Não foi possível carregar as categorias de tarifa do GCDR${code ? ` (${code})` : ''}.`
      );
      return;
    }
    clearError();
    if (!categories || categories.length === 0) return;
    try {
      const loaded = await adapter.loadEntriesForCustomer(
        customerId,
        categories.map((c) => c.key)
      );
      entries = entries.filter((e) => e.customerId !== customerId).concat(loaded);
      renderList();
    } catch (err) {
      surfaceApiError(err);
    }
  }

  const persist = (changed?: PersistChange): void => {
    if (adapter) {
      // Tariff-API path: write through the adapter; never localStorage.
      // (Remoção não passa por aqui: confirmAndRemove aguarda o DELETE antes.)
      if (changed?.kind === 'upsert') {
        adapter.saveEntry(changed.entry.customerId, changed.entry).catch((err) => surfaceApiError(err));
      }
      if (typeof params.onSave === 'function') params.onSave(entries.map((e) => ({ ...e })));
      emit('save', entries.map((e) => ({ ...e })));
      return;
    }
    saveJson(doc, keyEntries, entries);
    saveJson(doc, keyAudit, auditLog);
    if (typeof params.onSave === 'function') params.onSave(entries.map((e) => ({ ...e })));
    emit('save', entries.map((e) => ({ ...e })));
  };

  // ED-1386 — exclusão em andamento (diálogo aberto ou DELETE pendente): ✕ desabilitados.
  let removing = false;

  const pushAudit = (rec?: PricingAuditRecord): void => {
    if (rec) auditLog = [rec, ...auditLog];
  };

  const badge = (domain: PricingDomain, category: PricingCategory): string =>
    `<span class="myio-pricing__badge${domain === 'water' ? ' myio-pricing__badge--water' : ''}">${escapeHtml(
      DOMAIN_LABEL[domain]
    )} · ${escapeHtml(categoryLabel(category, categories))}</span>`;

  const renderList = (): void => {
    const customerId = customerSel.value;
    const rows = entries
      .filter((e) => e.customerId === customerId)
      .sort((a, b) => {
        const sa = `${a.domain}|${a.category}|${entryBounds(a)?.start || ''}`;
        const sb = `${b.domain}|${b.category}|${entryBounds(b)?.start || ''}`;
        return sa.localeCompare(sb);
      });
    listEl.innerHTML = rows
      .map((e) => {
        const b = entryBounds(e);
        const boundsKey = b ? `${b.start}__${b.end}` : '';
        return `
        <li class="myio-pricing__item">
          <span class="myio-pricing__item-period">${badge(e.domain, e.category)} ${escapeHtml(
          formatPeriodLabel(e)
        )}</span>
          <span class="myio-pricing__item-price">${escapeHtml(formatBRL(e.pricePerKwh))} ${escapeHtml(
          unitLabel(e.domain)
        )}</span>
          <button class="myio-pricing__remove" data-remove="${escapeHtml(e.domain)}|${escapeHtml(
          e.category
        )}|${escapeHtml(boundsKey)}" aria-label="Remover" type="button">✕</button>
        </li>`;
      })
      .join('');
    emptyEl.style.display = rows.length ? 'none' : '';

    listEl.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.disabled = removing;
      btn.addEventListener('click', () => {
        const [domain, category, boundsKey] = String(btn.getAttribute('data-remove')).split('|');
        const target = entries.find((e) => {
          if (e.customerId !== customerId || e.domain !== domain || e.category !== category) return false;
          const b = entryBounds(e);
          return Boolean(b && `${b.start}__${b.end}` === boundsKey);
        });
        if (target) void confirmAndRemove(target, boundsKey);
      });
    });
  };

  // ---- ED-1386: exclusão com confirmação ----
  function removeConfirmMessage(e: PricingEntry): string {
    const b = entryBounds(e);
    const period = b ? `${isoToBR(b.start)} a ${isoToBR(b.end)}` : formatPeriodLabel(e);
    return [
      'Tem certeza que deseja excluir esta tarifa? Esta ação não pode ser desfeita.',
      '',
      `Domínio: ${DOMAIN_LABEL[e.domain]}`,
      `Categoria: ${categoryLabel(e.category, categories)}`,
      `Período: ${period}`,
      `Preço: ${formatBRL(e.pricePerKwh)} ${unitLabel(e.domain)}`,
    ].join('\n');
  }

  // Confirma no diálogo premium (RFC-0205) e só então exclui. Com a API de tarifas,
  // o DELETE é aguardado: a linha só sai da lista depois do sucesso; em erro a
  // lista é recarregada do GCDR (pode ter havido exclusão parcial, um DELETE por dia).
  async function confirmAndRemove(target: PricingEntry, boundsKey: string): Promise<void> {
    if (removing) return;
    removing = true;
    renderList();
    try {
      const choice = await openConfirmDialog({
        title: 'Excluir Tarifa',
        message: removeConfirmMessage(target),
        buttons: [
          { label: 'Cancelar', value: 'cancel', variant: 'secondary' },
          { label: 'Excluir', value: 'confirm', variant: 'danger', autoFocus: true },
        ],
        theme: resolveDialogTheme(params.theme),
        container: dialogHost,
      });
      if (choice !== 'confirm' || closed) return;
      clearError();
      if (adapter) {
        try {
          await adapter.deleteEntry(target.customerId, target);
        } catch (err) {
          await loadFromApi();
          surfaceApiError(err, 'delete');
          return;
        }
      }
      const result = removeEntryByBounds(
        entries,
        {
          customerId: target.customerId,
          domain: target.domain,
          category: target.category,
          boundsKey,
        },
        { by: author }
      );
      entries = result.entries;
      pushAudit(result.audit);
      persist();
      emit('remove', result.audit);
    } finally {
      removing = false;
      if (!closed) renderList();
    }
  }

  const buildCandidate = (): PricingEntry | { error: string } => {
    const customerId = customerSel.value;
    if (!customerId) return { error: 'Selecione um customer.' };
    const domain = domainSel.value as PricingDomain;
    const category = categorySel.value as PricingCategory;
    if (!category || !activeCategories().some((c) => c.key === category)) {
      return { error: 'Selecione uma categoria.' };
    }

    const price = parseBRL(priceInput.value);
    if (!Number.isFinite(price) || price <= 0) {
      return { error: 'Informe um preço válido maior que zero.' };
    }

    if (typeSel.value === 'month') {
      const periodKey = monthInput.value;
      if (!/^\d{4}-\d{2}$/.test(periodKey)) return { error: 'Selecione um mês.' };
      return { customerId, domain, category, periodType: 'month', periodKey, pricePerKwh: price, currency: 'BRL' };
    }
    const start = startInput.value;
    const end = endInput.value;
    if (!start || !end) return { error: 'Informe início e fim do período.' };
    if (start > end) return { error: 'A data inicial deve ser anterior à final.' };
    return { customerId, domain, category, periodType: 'range', start, end, pricePerKwh: price, currency: 'BRL' };
  };

  addBtn.addEventListener('click', () => {
    clearError();
    const candidate = buildCandidate();
    if ('error' in candidate) {
      showError(candidate.error);
      return;
    }
    const result = upsertEntry(entries, candidate, { by: author });
    if (result.status === 'overlap') {
      const label = result.conflict ? formatPeriodLabel(result.conflict) : '';
      showError(
        label
          ? `Período sobrepõe um já existente (${label}) nesta categoria. Ajuste as datas.`
          : 'Período inválido ou sobreposto.'
      );
      return;
    }
    entries = result.entries;
    pushAudit(result.audit);
    persist({ kind: 'upsert', entry: candidate });
    customerSel.value = candidate.customerId;
    domainSel.value = candidate.domain;
    categorySel.value = candidate.category;
    syncUnit();
    renderList();
    emit('add', { candidate, status: result.status });
  });

  // ---- Dashboard ----
  reportDomainSel.addEventListener('change', renderReport);

  function renderDashboard(): void {
    const kpis = computePricingKpis(entries, {
      customerCount: customers.length,
      categoryCount: activeCategories().length,
    });
    const cards: Array<{ value: string; label: string }> = [
      { value: String(kpis.totalPeriods), label: 'Períodos definidos' },
      { value: String(kpis.periodsByDomain.energy), label: 'Períodos · Energia' },
      { value: String(kpis.periodsByDomain.water), label: 'Períodos · Água' },
      {
        value: kpis.avgEnergyPrice != null ? `${formatBRL(kpis.avgEnergyPrice)}` : '—',
        label: 'Preço médio R$/kWh',
      },
      {
        value: kpis.avgWaterPrice != null ? `${formatBRL(kpis.avgWaterPrice)}` : '—',
        label: 'Preço médio R$/m³',
      },
      {
        value: `${kpis.coverage.covered}/${kpis.coverage.total} (${kpis.coverage.pct}%)`,
        label: 'Cobertura (cliente×domínio×categoria)',
      },
      { value: fmtTimestamp(kpis.lastUpdatedAt), label: 'Última atualização' },
    ];
    kpiEl.innerHTML = cards
      .map(
        (c) => `
        <div class="myio-pricing__kpi">
          <div class="myio-pricing__kpi-value">${escapeHtml(c.value)}</div>
          <div class="myio-pricing__kpi-label">${escapeHtml(c.label)}</div>
        </div>`
      )
      .join('');
    renderReport();
  }

  function customerTitle(id: string): string {
    const c = customers.find((x) => resolveCustomerId(x) === id);
    return c ? c.title : id;
  }

  function renderReport(): void {
    const filter = reportDomainSel.value; // 'all' | 'energy' | 'water'
    const rows = entries
      .filter((e) => filter === 'all' || e.domain === filter)
      .sort((a, b) => {
        const sa = `${customerTitle(a.customerId)}|${a.domain}|${a.category}|${entryBounds(a)?.start || ''}`;
        const sb = `${customerTitle(b.customerId)}|${b.domain}|${b.category}|${entryBounds(b)?.start || ''}`;
        return sa.localeCompare(sb);
      });
    reportBody.innerHTML = rows.length
      ? rows
          .map(
            (e) => `
        <tr>
          <td>${escapeHtml(customerTitle(e.customerId))}</td>
          <td>${escapeHtml(DOMAIN_LABEL[e.domain])}</td>
          <td>${escapeHtml(categoryLabel(e.category, categories))}</td>
          <td>${escapeHtml(formatPeriodLabel(e))}</td>
          <td>${escapeHtml(formatBRL(e.pricePerKwh))} ${escapeHtml(unitLabel(e.domain))}</td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="5" style="text-align:center;color:var(--myio-text-muted,#6b7280);padding:24px;">Nenhum preço para o filtro selecionado.</td></tr>`;
  }

  // ---- Histórico ----
  function renderHistory(): void {
    historyList.innerHTML = auditLog
      .map((rec) => {
        const priceInfo =
          rec.action === 'price-changed'
            ? ` — ${formatBRL(rec.before?.pricePerKwh ?? NaN)} → ${formatBRL(rec.after?.pricePerKwh ?? NaN)}`
            : rec.after?.pricePerKwh != null
              ? ` — ${formatBRL(rec.after.pricePerKwh)}`
              : rec.before?.pricePerKwh != null
                ? ` — ${formatBRL(rec.before.pricePerKwh)}`
                : '';
        return `
        <li class="myio-pricing__history-item">
          <div class="myio-pricing__history-head">
            <span class="myio-pricing__action myio-pricing__action--${escapeHtml(rec.action)}">${escapeHtml(
          rec.action
        )}</span>
            ${badge(rec.domain, rec.category)}
            <span>${escapeHtml(rec.periodLabel)}${escapeHtml(priceInfo)}</span>
          </div>
          <div class="myio-pricing__history-meta">${escapeHtml(customerTitle(rec.customerId))} · ${escapeHtml(
          rec.by || '—'
        )} · ${escapeHtml(fmtTimestamp(rec.at))}</div>
        </li>`;
      })
      .join('');
    historyEmpty.style.display = auditLog.length ? 'none' : '';
  }

  renderList();

  // RFC-0228 A1 — initial hydration (categories + tariffs) from the GCDR API.
  // Protótipo (sem tariffApi): categorias só via params.categories — sem fonte é erro.
  if (adapter) {
    void loadFromApi();
  } else if (params.categories && params.categories.length) {
    setCategories(params.categories.map((c) => ({ ...c })));
  } else {
    setCategories(null, 'Categorias de tarifa não informadas (configure a API de tarifas do GCDR).');
  }

  return handle;
}
