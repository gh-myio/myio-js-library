/**
 * RFC-0228 A5a — device tariff-category **management UI**.
 *
 * A premium modal that lists a customer's devices and lets an operator view,
 * filter, and edit each device's explicit `tariffCategory`
 * (`COMMON_AREA` / `SPECIFIC` / — none —), individually or in bulk.
 *
 * ── THE UI DEPENDS ONLY ON A SEAM (RFC-0228 feedback §5) ──────────────────────
 * This component NEVER talks to a concrete device HTTP API. It depends solely on
 * an injected {@link DeviceCategoryPort}. The GCDR device-tariffCategory contract
 * is item **B6** (gcdr repo) and is not built yet; the port is exactly what B6
 * will implement later. Tests/demo inject `createFakeDeviceCategoryPort`, so the
 * whole UI runs with zero live host calls and can ship before B6.
 *
 * ── EXPLICIT CLASSIFICATION ONLY (RFC-0207 discipline) ────────────────────────
 * A device's category is read from and written to the **explicit** attribute and
 * nothing else. The UI NEVER infers a category from a device's name/label — a
 * device labeled "Loja 12" with `tariffCategory: null` stays uncategorized until a
 * human sets it. The label is display-only; it is never a classification input.
 *
 * ── CATEGORY TERM MAPPING REUSES A1 (no duplicate string-matching) ────────────
 * The value set is exactly `COMMON_AREA | SPECIFIC | null`. Its mapping to the
 * pricing panel's `area_comum`/`lojas` terms is A1's centralized map
 * (`tariffApiAdapter.ts`: `wireCategoryToPanel`/`panelCategoryToWire`). This file
 * imports that map and never re-matches these tokens itself.
 *
 * ── WORDING (RFC-0228 §8) ─────────────────────────────────────────────────────
 * Categorization/coverage UX, never billing. No "Fatura"/"Faturamento"/"Total a
 * pagar" strings here.
 */

import {
  wireCategoryToPanel,
  panelCategoryToWire,
} from '../pricing-panel/tariffApiAdapter';
import type { PricingCategory } from '../pricing-panel/types';
import type { DeviceCategory, DeviceCategoryPort, DeviceCategoryRow } from './deviceCategoryPort';
import { DeviceCategoryConflictError } from './deviceCategoryPort';
import { injectDeviceCategoryStyles } from './deviceCategoryStyles';

/** Category filter for the toolbar. `uncategorized` = the A4 deep-link entry. */
export type DeviceCategoryFilter = 'all' | 'uncategorized' | 'COMMON_AREA' | 'SPECIFIC';

/** pt-BR display labels, keyed by the A1 **panel** term (single source below). */
const PANEL_TERM_LABEL: Record<PricingCategory, string> = {
  lojas: 'Lojas',
  area_comum: 'Área Comum',
};

/** Label for the "no category" value — the honest uncategorized state. */
const NONE_LABEL = '— Sem categoria —';

/**
 * pt-BR label for a device category. Delegates the token→panel-term step to A1's
 * centralized `wireCategoryToPanel` map (RFC-0228 A1) — this function adds only the
 * final term→text lookup, never a second copy of the COMMON_AREA/SPECIFIC mapping.
 */
export function deviceCategoryLabel(cat: DeviceCategory): string {
  if (cat == null) return NONE_LABEL;
  return PANEL_TERM_LABEL[wireCategoryToPanel(cat)];
}

/** The A1 panel term for a device category (or `null` when uncategorized). */
export function deviceCategoryToPanelTerm(cat: DeviceCategory): PricingCategory | null {
  return cat == null ? null : wireCategoryToPanel(cat);
}

/** A device category from an A1 panel term (or `null`). Inverse of the above. */
export function panelTermToDeviceCategory(term: PricingCategory | null): DeviceCategory {
  return term == null ? null : panelCategoryToWire(term);
}

export interface OpenDeviceCategoryPanelParams {
  /** The injected SEAM. Tests/demo pass `createFakeDeviceCategoryPort(...)`. */
  port: DeviceCategoryPort;
  /** Customer whose devices to list/edit. */
  customerId: string;
  /** Optional money domain scope. */
  domain?: 'ENERGY' | 'WATER';
  /** Device to scroll to + highlight on open (from A4's `onCategorizeDevice`). */
  focusDeviceId?: string;
  /** Initial category filter (A4's uncategorized deep-link passes `uncategorized`). */
  initialFilter?: DeviceCategoryFilter;
  /** Theme CSS var overrides applied to the modal root (`--myio-*`). */
  theme?: Record<string, string>;
  /** Called after the panel closes. */
  onClose?: () => void;
  /** Document to build in (defaults to ambient `document`). */
  document?: Document;
}

/** Live handle to an open panel (also the test/introspection surface). */
export interface DeviceCategoryPanelHandle {
  /** Resolves once the initial device list has loaded and rendered. */
  ready: Promise<void>;
  /** Close and remove the panel. */
  close(): void;
  /** The modal root element. */
  getRoot(): HTMLElement;
  /** Re-fetch the device list from the port and re-render. */
  refresh(): Promise<void>;
  /** Current in-memory device model (post-edits). */
  getRows(): DeviceCategoryRow[];
  /** Device ids currently passing search + category filter (render order). */
  getVisibleDeviceIds(): string[];
  /** Set the free-text search (label/code) and re-render. */
  setSearch(text: string): void;
  /** Set the category filter and re-render. */
  setCategoryFilter(filter: DeviceCategoryFilter): void;
}

/** Escape untrusted text for safe HTML interpolation. */
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Category `<option>`s: none + the two explicit tokens (labels via A1 map). */
function categoryOptionsHTML(selected: DeviceCategory): string {
  const opt = (value: string, label: string, isSel: boolean): string =>
    `<option value="${value}"${isSel ? ' selected' : ''}>${esc(label)}</option>`;
  return (
    opt('', NONE_LABEL, selected == null) +
    opt('COMMON_AREA', deviceCategoryLabel('COMMON_AREA'), selected === 'COMMON_AREA') +
    opt('SPECIFIC', deviceCategoryLabel('SPECIFIC'), selected === 'SPECIFIC')
  );
}

/**
 * Open the device tariff-category management panel. Returns a
 * {@link DeviceCategoryPanelHandle}. Explicit-only, seam-driven — see file header.
 */
export function openDeviceCategoryPanel(
  params: OpenDeviceCategoryPanelParams
): DeviceCategoryPanelHandle {
  const doc =
    params.document || (typeof document !== 'undefined' ? document : undefined);
  if (!doc) {
    throw new Error(
      'openDeviceCategoryPanel requires a document (pass params.document in non-DOM envs).'
    );
  }
  injectDeviceCategoryStyles(doc);

  const { port, customerId } = params;

  // --- model ---------------------------------------------------------------
  let rows: DeviceCategoryRow[] = [];
  let search = '';
  let filter: DeviceCategoryFilter = params.initialFilter || 'all';
  const selected = new Set<string>();

  // --- shell ---------------------------------------------------------------
  const root = doc.createElement('div');
  root.className = 'myio-devcat';
  root.setAttribute('data-devcat', '1');
  if (params.theme) {
    for (const [k, v] of Object.entries(params.theme)) {
      if (k.startsWith('--') && typeof v === 'string') root.style.setProperty(k, v);
    }
  }
  root.innerHTML = `
    <div class="myio-devcat__overlay" data-devcat-overlay="1"></div>
    <div class="myio-devcat__card" role="dialog" aria-modal="true" aria-label="Categorias de tarifa por dispositivo">
      <div class="myio-devcat__header">
        <h3 class="myio-devcat__title"><span aria-hidden="true">🏷️</span>Categorias de tarifa por dispositivo</h3>
        <button type="button" class="myio-devcat__close" data-devcat-close="1" aria-label="Fechar">&times;</button>
      </div>
      <div class="myio-devcat__toolbar">
        <input type="search" class="myio-devcat__search" data-devcat-search="1"
               placeholder="Buscar por nome ou código…" aria-label="Buscar dispositivo" />
        <select class="myio-devcat__filter" data-devcat-filter="1" aria-label="Filtrar por categoria">
          <option value="all">Todas as categorias</option>
          <option value="uncategorized">Sem categoria</option>
          <option value="COMMON_AREA">${esc(deviceCategoryLabel('COMMON_AREA'))}</option>
          <option value="SPECIFIC">${esc(deviceCategoryLabel('SPECIFIC'))}</option>
        </select>
        <label class="myio-devcat__filter" style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" data-devcat-selectall="1" /> Selecionar visíveis
        </label>
      </div>
      <div class="myio-devcat__bulkbar" data-devcat-bulkbar="1">
        <span data-devcat-bulkcount="1">0 selecionados</span>
        <select data-devcat-bulkcat="1" aria-label="Categoria para os selecionados">
          <option value="">${esc(NONE_LABEL)}</option>
          <option value="COMMON_AREA">${esc(deviceCategoryLabel('COMMON_AREA'))}</option>
          <option value="SPECIFIC">${esc(deviceCategoryLabel('SPECIFIC'))}</option>
        </select>
        <button type="button" class="myio-devcat__bulk-apply" data-devcat-bulkapply="1">Aplicar a selecionados</button>
      </div>
      <div class="myio-devcat__body" data-devcat-body="1"></div>
      <div class="myio-devcat__footer">
        <span data-devcat-count="1"></span>
        <span>Categoria explícita — nunca inferida do nome (RFC-0207).</span>
      </div>
    </div>
  `;

  const body = root.querySelector<HTMLElement>('[data-devcat-body]')!;
  const countEl = root.querySelector<HTMLElement>('[data-devcat-count]')!;
  const bulkbar = root.querySelector<HTMLElement>('[data-devcat-bulkbar]')!;
  const bulkCountEl = root.querySelector<HTMLElement>('[data-devcat-bulkcount]')!;
  const selectAll = root.querySelector<HTMLInputElement>('[data-devcat-selectall]')!;

  // --- filtering -----------------------------------------------------------
  function matchesFilter(r: DeviceCategoryRow): boolean {
    if (filter === 'all') return true;
    if (filter === 'uncategorized') return r.tariffCategory == null;
    return r.tariffCategory === filter;
  }
  function matchesSearch(r: DeviceCategoryRow): boolean {
    if (!search) return true;
    const hay = `${r.label || ''} ${r.code || ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  }
  function visibleRows(): DeviceCategoryRow[] {
    return rows.filter((r) => matchesFilter(r) && matchesSearch(r));
  }

  // --- rendering -----------------------------------------------------------
  function rowHTML(r: DeviceCategoryRow): string {
    const name = esc(r.label || r.code || r.deviceId);
    const code = r.code ? `<span class="myio-devcat__row-code">${esc(r.code)}</span>` : '';
    const checked = selected.has(r.deviceId) ? ' checked' : '';
    const focused = r.deviceId === params.focusDeviceId ? ' data-focused="1"' : '';
    const catAttr = r.tariffCategory == null ? 'null' : r.tariffCategory;
    return (
      `<div class="myio-devcat__row" data-devcat-row="${esc(r.deviceId)}" data-cat="${catAttr}"${focused}>` +
      `<input type="checkbox" class="myio-devcat__row-check" data-devcat-rowcheck="${esc(
        r.deviceId
      )}"${checked} aria-label="Selecionar ${name}" />` +
      `<div class="myio-devcat__row-main">` +
      `<span class="myio-devcat__row-label" title="${name}">${name}</span>` +
      code +
      `</div>` +
      `<select class="myio-devcat__row-select" data-devcat-rowselect="${esc(
        r.deviceId
      )}" aria-label="Categoria de ${name}">${categoryOptionsHTML(r.tariffCategory)}</select>` +
      `<div class="myio-devcat__row-conflict" data-devcat-conflict="${esc(r.deviceId)}"></div>` +
      `</div>`
    );
  }

  function render(): void {
    const vis = visibleRows();
    if (vis.length === 0) {
      body.innerHTML = `<div class="myio-devcat__empty">Nenhum dispositivo encontrado.</div>`;
    } else {
      body.innerHTML = vis.map(rowHTML).join('');
    }
    countEl.textContent = `${vis.length} de ${rows.length} dispositivo(s)`;
    wireRows();
    updateBulkBar();
    // Focus/scroll the deep-linked device (guard: jsdom lacks scrollIntoView).
    if (params.focusDeviceId) {
      const el = body.querySelector<HTMLElement>(
        `[data-devcat-row="${cssEscape(params.focusDeviceId)}"]`
      );
      if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center' });
      }
    }
  }

  function updateBulkBar(): void {
    const n = selected.size;
    bulkCountEl.textContent = `${n} selecionado(s)`;
    bulkbar.classList.toggle('show', n > 0);
  }

  // --- per-row wiring ------------------------------------------------------
  function wireRows(): void {
    body.querySelectorAll<HTMLSelectElement>('[data-devcat-rowselect]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const id = sel.getAttribute('data-devcat-rowselect')!;
        const value = sel.value; // '' | 'COMMON_AREA' | 'SPECIFIC'
        const category: DeviceCategory = value === '' ? null : (value as DeviceCategory);
        void applySingle(id, category);
      });
    });
    body.querySelectorAll<HTMLInputElement>('[data-devcat-rowcheck]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-devcat-rowcheck')!;
        if (cb.checked) selected.add(id);
        else selected.delete(id);
        updateBulkBar();
      });
    });
  }

  function showConflict(deviceId: string, message: string): void {
    const rowEl = body.querySelector<HTMLElement>(
      `[data-devcat-row="${cssEscape(deviceId)}"]`
    );
    const banner = body.querySelector<HTMLElement>(
      `[data-devcat-conflict="${cssEscape(deviceId)}"]`
    );
    if (rowEl) rowEl.setAttribute('data-conflict', '1');
    if (banner) banner.textContent = message;
  }
  function clearConflict(deviceId: string): void {
    const rowEl = body.querySelector<HTMLElement>(
      `[data-devcat-row="${cssEscape(deviceId)}"]`
    );
    const banner = body.querySelector<HTMLElement>(
      `[data-devcat-conflict="${cssEscape(deviceId)}"]`
    );
    if (rowEl) rowEl.removeAttribute('data-conflict');
    if (banner) banner.textContent = '';
  }

  /**
   * Write one device's category through the port with its `expectedVersion`. On
   * success the model row is updated in place. On a version conflict the row shows
   * a banner and keeps the user's chosen value — crucially, OTHER rows' pending or
   * committed edits are untouched (each row is independent).
   */
  async function applySingle(deviceId: string, category: DeviceCategory): Promise<void> {
    const row = rows.find((r) => r.deviceId === deviceId);
    if (!row) return;
    clearConflict(deviceId);
    try {
      const updated = await port.setCategory({
        deviceId,
        category,
        expectedVersion: row.version,
      });
      row.tariffCategory = updated.tariffCategory;
      row.version = updated.version;
      // Reflect the committed category on the row (attribute drives styling).
      const rowEl = body.querySelector<HTMLElement>(
        `[data-devcat-row="${cssEscape(deviceId)}"]`
      );
      if (rowEl) rowEl.setAttribute('data-cat', updated.tariffCategory == null ? 'null' : updated.tariffCategory);
    } catch (err) {
      const isConflict =
        err instanceof DeviceCategoryConflictError ||
        (err as { code?: string })?.code === 'DEVICE_CATEGORY_VERSION_CONFLICT';
      showConflict(
        deviceId,
        isConflict
          ? 'Este dispositivo foi alterado por outra pessoa. Recarregue para ver a versão atual e reaplique.'
          : `Não foi possível salvar: ${(err as Error)?.message || 'erro desconhecido'}`
      );
    }
  }

  /** Bulk-apply to the current selection: one `setCategoryBulk` if the port has it,
   *  else N `setCategory` calls. Selection is preserved on conflict/failure. */
  async function applyBulk(category: DeviceCategory): Promise<void> {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (typeof port.setCategoryBulk === 'function') {
      const res = await port.setCategoryBulk({ deviceIds: ids, category });
      const failedIds = new Set(res.failed.map((f) => f.deviceId));
      for (const id of ids) {
        const row = rows.find((r) => r.deviceId === id);
        if (row && !failedIds.has(id)) {
          row.tariffCategory = category;
          if (row.version != null) row.version = String((Number(row.version) || 0) + 1);
        }
      }
      for (const f of res.failed) showConflict(f.deviceId, `Falha: ${f.reason}`);
    } else {
      // Fallback: N independent single writes (each carries its own version).
      await Promise.all(ids.map((id) => applySingle(id, category)));
    }
    render();
  }

  // --- toolbar wiring ------------------------------------------------------
  const searchEl = root.querySelector<HTMLInputElement>('[data-devcat-search]')!;
  const filterEl = root.querySelector<HTMLSelectElement>('[data-devcat-filter]')!;
  filterEl.value = filter;
  searchEl.addEventListener('input', () => {
    search = searchEl.value;
    render();
  });
  filterEl.addEventListener('change', () => {
    filter = filterEl.value as DeviceCategoryFilter;
    render();
  });
  selectAll.addEventListener('change', () => {
    const vis = visibleRows();
    if (selectAll.checked) vis.forEach((r) => selected.add(r.deviceId));
    else vis.forEach((r) => selected.delete(r.deviceId));
    render();
  });
  root
    .querySelector<HTMLButtonElement>('[data-devcat-bulkapply]')!
    .addEventListener('click', () => {
      const bulkCat = root.querySelector<HTMLSelectElement>('[data-devcat-bulkcat]')!.value;
      const category: DeviceCategory = bulkCat === '' ? null : (bulkCat as DeviceCategory);
      void applyBulk(category);
    });

  // --- close ---------------------------------------------------------------
  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    root.classList.remove('show');
    doc.removeEventListener('keydown', escHandler);
    const remove = (): void => {
      if (root.parentNode) root.parentNode.removeChild(root);
    };
    if (typeof setTimeout === 'function') setTimeout(remove, 180);
    else remove();
    params.onClose?.();
  }
  function escHandler(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
  root.querySelector('[data-devcat-close]')?.addEventListener('click', close);
  root.querySelector('[data-devcat-overlay]')?.addEventListener('click', close);
  doc.addEventListener('keydown', escHandler);

  // --- mount + initial load ------------------------------------------------
  (doc.body || doc.documentElement).appendChild(root);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => root.classList.add('show'));
  } else {
    root.classList.add('show');
  }

  async function load(): Promise<void> {
    body.innerHTML = `<div class="myio-devcat__empty">Carregando dispositivos…</div>`;
    try {
      rows = await port.listDevices({ customerId, domain: params.domain });
    } catch (err) {
      rows = [];
      body.innerHTML = `<div class="myio-devcat__empty">Não foi possível carregar os dispositivos: ${esc(
        (err as Error)?.message || 'erro'
      )}</div>`;
      countEl.textContent = '';
      return;
    }
    render();
  }

  const ready = load();

  return {
    ready,
    close,
    getRoot: () => root,
    refresh: () => load(),
    getRows: () => rows.map((r) => ({ ...r })),
    getVisibleDeviceIds: () => visibleRows().map((r) => r.deviceId),
    setSearch: (text: string) => {
      search = text;
      searchEl.value = text;
      render();
    },
    setCategoryFilter: (f: DeviceCategoryFilter) => {
      filter = f;
      filterEl.value = f;
      render();
    },
  };
}

/**
 * Wire A4's coverage deep-links to this panel. A4 (`renderCoverageView`) fires
 * `onCategorizeDevice(deviceId)` per uncategorized device and `onManageCategories()`
 * for the generic case; this helper turns both into an open of the A5a panel with
 * the right `focusDeviceId`/filter, so the caller never re-implements the wiring.
 *
 * Documented usage (NOT a controller edit — just how a host composes A4 + A5a):
 * ```ts
 * import { renderCoverageView } from './coverageView';
 * import { createCoverageDeepLink } from './deviceCategoryPanel';
 * const links = createCoverageDeepLink({ port, customerId, domain: 'ENERGY' });
 * overlay.appendChild(renderCoverageView(moneyOverlay, links));
 * ```
 */
export function createCoverageDeepLink(config: {
  port: DeviceCategoryPort;
  customerId: string;
  domain?: 'ENERGY' | 'WATER';
  theme?: Record<string, string>;
  document?: Document;
}): {
  onCategorizeDevice: (deviceId: string) => DeviceCategoryPanelHandle;
  onManageCategories: () => DeviceCategoryPanelHandle;
} {
  const open = (
    focusDeviceId?: string,
    initialFilter?: DeviceCategoryFilter
  ): DeviceCategoryPanelHandle =>
    openDeviceCategoryPanel({
      port: config.port,
      customerId: config.customerId,
      domain: config.domain,
      focusDeviceId,
      initialFilter,
      theme: config.theme,
      document: config.document,
    });
  return {
    // Deep-link from one uncategorized device → open focused on it.
    onCategorizeDevice: (deviceId: string) => open(deviceId),
    // Generic "manage categories" → open pre-filtered to the uncategorized set.
    onManageCategories: () => open(undefined, 'uncategorized'),
  };
}

/** Minimal CSS.escape fallback for attribute selectors (device ids). */
function cssEscape(s: string): string {
  if (typeof (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS?.escape === 'function') {
    return (globalThis as { CSS: { escape: (v: string) => string } }).CSS.escape(s);
  }
  return String(s).replace(/["\\\]#.:>~+*^$|()[{}]/g, '\\$&');
}
