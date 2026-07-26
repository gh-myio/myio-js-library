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
} from './types';
import {
  CATEGORY_LABEL,
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

  const allowed = isPricingAllowed(params.currentUserEmail, isSuperAdmin());
  const customers: PricingCustomerRef[] = params.customers || [];

  // RFC-0228 A1 — when a tariff API is configured, persistence goes through the
  // hourly-tariff adapter and localStorage is NOT the source of truth. When it is
  // absent, the localStorage prototype path below is byte-identical (the gate).
  const tariffApi = params.tariffApi;
  let adapter: TariffApiAdapter | null = null;
  if (allowed && tariffApi) {
    const client = new TariffApiClient({
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
  const initCategory: PricingCategory = params.category || 'lojas';

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
      </div>
      <div class="myio-pricing__body">
        <!-- TAB: Definir preços -->
        <div class="myio-pricing__panel" data-panel="define">
          <div class="myio-pricing__form">
            <div class="myio-pricing__field myio-pricing__field--full">
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
              <select class="myio-pricing__select" id="myio-pricing-category" data-testid="pricing-category">
                <option value="lojas">Lojas</option>
                <option value="area_comum">Área Comum</option>
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
  categorySel.value = initCategory;

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
  // RFC-0228 A1 — reload the newly selected customer's tariffs from the API.
  if (adapter) {
    customerSel.addEventListener('change', () => {
      void loadFromApi();
    });
  }
  syncPeriodFields();
  syncUnit();

  type PersistChange = { kind: 'upsert' | 'remove'; entry: PricingEntry };

  // Surface an adapter/API failure in the form error box. A version conflict
  // (RFC-0054 409 TARIFF_VERSION_CONFLICT) is shown, never swallowed.
  function surfaceApiError(err: unknown): void {
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
    showError(`Falha ao salvar a tarifa no servidor${code ? ` (${code})` : ''}.`);
  }

  // Reload the selected customer's tariffs from the API and merge into state.
  async function loadFromApi(): Promise<void> {
    if (!adapter) return;
    const customerId = customerSel.value;
    if (!customerId) return;
    try {
      const loaded = await adapter.loadEntriesForCustomer(customerId);
      entries = entries.filter((e) => e.customerId !== customerId).concat(loaded);
      renderList();
    } catch (err) {
      surfaceApiError(err);
    }
  }

  const persist = (changed?: PersistChange): void => {
    if (adapter) {
      // Tariff-API path: write through the adapter; never localStorage.
      if (changed?.kind === 'upsert') {
        adapter.saveEntry(changed.entry.customerId, changed.entry).catch(surfaceApiError);
      } else if (changed?.kind === 'remove') {
        adapter.deleteEntry(changed.entry.customerId, changed.entry).catch(surfaceApiError);
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

  const pushAudit = (rec?: PricingAuditRecord): void => {
    if (rec) auditLog = [rec, ...auditLog];
  };

  const badge = (domain: PricingDomain, category: PricingCategory): string =>
    `<span class="myio-pricing__badge${domain === 'water' ? ' myio-pricing__badge--water' : ''}">${escapeHtml(
      DOMAIN_LABEL[domain]
    )} · ${escapeHtml(CATEGORY_LABEL[category])}</span>`;

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
      btn.addEventListener('click', () => {
        const [domain, category, boundsKey] = String(btn.getAttribute('data-remove')).split('|');
        const removedEntry = entries.find((e) => {
          if (e.customerId !== customerId || e.domain !== domain || e.category !== category) return false;
          const b = entryBounds(e);
          return Boolean(b && `${b.start}__${b.end}` === boundsKey);
        });
        const result = removeEntryByBounds(
          entries,
          {
            customerId,
            domain: domain as PricingDomain,
            category: category as PricingCategory,
            boundsKey,
          },
          { by: author }
        );
        entries = result.entries;
        pushAudit(result.audit);
        persist(removedEntry ? { kind: 'remove', entry: removedEntry } : undefined);
        renderList();
        emit('remove', result.audit);
      });
    });
  };

  const buildCandidate = (): PricingEntry | { error: string } => {
    const customerId = customerSel.value;
    if (!customerId) return { error: 'Selecione um customer.' };
    const domain = domainSel.value as PricingDomain;
    const category = categorySel.value as PricingCategory;

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
    const kpis = computePricingKpis(entries, { customerCount: customers.length });
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
          <td>${escapeHtml(CATEGORY_LABEL[e.category])}</td>
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

  // RFC-0228 A1 — initial hydration from the tariff API (localStorage path skips this).
  if (adapter) void loadFromApi();

  return handle;
}
