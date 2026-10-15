/**
 * RFC-0239 — Reports Hub: the "Relatórios" picker as a library component.
 *
 * Reads no dashboard globals (G-3): palette, mode, customer name and the data context come from
 * the params; the footer shows a static build version (no version checker).
 */
// @ts-ignore - package.json import (same as src/index.ts)
import pkg from '../../../../package.json';
import { createPremiumModalChrome } from '../internal/PremiumModalChrome';
import type { PremiumModalChromeInstance } from '../internal/PremiumModalChrome';
import { MyIOToast } from '../../MyIOToast.js';
import {
  DEFAULT_REPORTS_CATALOG,
  itemKey,
  resolveInitialDomain,
  resolveReportItemStates,
  validateCatalog,
} from './catalog';
import { DEFAULT_HANDLERS, ReportsHubUserError } from './handlers';
import { buildCard, type CardRefs } from './ReportsHubView';
import { injectReportsHubStyles } from './styles';
import type {
  OpenReportsHubParams,
  ReportDomain,
  ReportItemKey,
  ReportItemState,
  ReportsCatalog,
  ReportsCatalogItem,
  ReportsHubHandle,
  ReportsHubHandlerDef,
  ReportsHubVisual,
} from './types';

const LIB_VERSION: string = (pkg as { version?: string }).version || '';
const MODAL_ID = 'myio-reports-hub';
const GENERIC_ERROR = 'Não foi possível abrir este relatório.';

type FinishReason = 'cancel' | 'success';

const registry = new WeakMap<Document, ReportsHub>();

function defaultDocument(): Document {
  try {
    const top = window.top;
    if (top && top.document) return top.document;
  } catch {
    // cross-origin top: fall back to this frame
  }
  return document;
}

function logWarn(...a: unknown[]): void {
  if (typeof console !== 'undefined') console.warn('[ReportsHub]', ...a);
}

class ReportsHub {
  readonly doc: Document;
  private readonly p: OpenReportsHubParams;
  private readonly visual: ReportsHubVisual;
  private readonly catalog: ReportsCatalog;
  private readonly handlers: Record<string, ReportsHubHandlerDef>;
  private readonly states: Map<ReportItemKey, ReportItemState>;
  private readonly opener: Element | null;
  private overlay!: HTMLElement;
  private modal!: HTMLElement;
  private chrome: PremiumModalChromeInstance | null = null;
  private tabs: HTMLButtonElement[] = [];
  private panels = new Map<ReportDomain, HTMLElement>();
  private cards: Array<CardRefs & { domain: ReportDomain; item: ReportsCatalogItem }> = [];
  private inflight: { id: number; controller: AbortController; card: CardRefs } | null = null;
  private seq = 0;
  private done = false;

  constructor(doc: Document, p: OpenReportsHubParams) {
    this.doc = doc;
    this.p = p;
    this.visual = {
      palette: p.theme,
      mode: p.themeMode ?? (p.theme?.mode === 'dark' ? 'dark' : 'light'),
      customerName: p.customerName ?? '',
    };
    this.catalog = validateCatalog(p.catalog ?? DEFAULT_REPORTS_CATALOG, (w) => logWarn('catalog:', w));
    this.handlers = { ...DEFAULT_HANDLERS };
    Object.entries(p.handlers || {}).forEach(([k, h]) => {
      if (h) this.handlers[k] = h;
    });
    this.states = resolveReportItemStates(this.catalog, p.enabledItems, (domain, item) =>
      this.isAvailable(domain, item),
    );
    this.opener = doc.activeElement;
  }

  get isOpen(): boolean {
    return !this.done;
  }

  private isAvailable(domain: ReportDomain, item: ReportsCatalogItem): boolean {
    const h = this.handlers[item.kind];
    if (!h || typeof h.prepare !== 'function') return false;
    if (h.domains && !h.domains.includes(domain)) return false;
    try {
      return h.isAvailable ? h.isAvailable(this.p.context, domain) !== false : true;
    } catch {
      return false;
    }
  }

  mount(): void {
    const doc = this.doc;
    injectReportsHubStyles(doc);

    this.overlay = doc.createElement('div');
    this.overlay.className = 'rh-overlay';
    this.overlay.id = MODAL_ID;

    this.modal = doc.createElement('div');
    this.modal.className = 'rh-modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('aria-label', 'Relatórios');

    const headerSlot = doc.createElement('div');
    const tabsEl = doc.createElement('div');
    tabsEl.className = 'rh-tabs';
    tabsEl.setAttribute('role', 'tablist');
    tabsEl.setAttribute('aria-label', 'Domínios de relatório');
    const body = doc.createElement('div');
    body.className = 'rh-body';
    this.modal.append(headerSlot, tabsEl, body);
    this.overlay.appendChild(this.modal);

    const initial = resolveInitialDomain(this.catalog, this.states, this.p.initialDomain);
    const visibleDomains = this.catalog.filter((d) =>
      d.items.some((it) => this.states.get(itemKey(d.id, it.id)) !== 'hidden'),
    );

    if (!initial || !visibleDomains.length) {
      tabsEl.remove();
      const empty = doc.createElement('div');
      empty.className = 'rh-empty';
      empty.textContent = 'Nenhum relatório disponível';
      body.appendChild(empty);
    } else {
      visibleDomains.forEach((d) => {
        const tab = doc.createElement('button');
        tab.type = 'button';
        tab.className = 'rh-tab';
        tab.id = `${MODAL_ID}-tab-${d.id}`;
        tab.dataset.domain = d.id;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', `${MODAL_ID}-panel-${d.id}`);
        tab.textContent = d.label;
        tab.addEventListener('click', () => this.selectTab(d.id, false));
        tabsEl.appendChild(tab);
        this.tabs.push(tab);

        const panel = doc.createElement('div');
        panel.className = 'rh-panel';
        panel.id = `${MODAL_ID}-panel-${d.id}`;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        const grid = doc.createElement('div');
        grid.className = 'rh-cards';
        d.items.forEach((item) => {
          const state = this.states.get(itemKey(d.id, item.id));
          if (!state || state === 'hidden') return;
          const refs = buildCard(doc, d.id, item, state);
          refs.card.addEventListener('click', () => this.onCardClick(d.id, item, refs));
          grid.appendChild(refs.cell);
          this.cards.push({ ...refs, domain: d.id, item });
        });
        panel.appendChild(grid);
        body.appendChild(panel);
        this.panels.set(d.id, panel);
      });
      tabsEl.addEventListener('keydown', this.onTabsKeydown);
    }

    this.chrome = createPremiumModalChrome({
      modalId: MODAL_ID,
      icon: '📊',
      title: 'Relatórios',
      modalEl: this.modal,
      headerSlot,
      theme: this.visual.mode,
      showThemeToggle: false,
      showMaximize: true,
      useGlobals: false,
      palette: this.visual.palette ?? null,
      onClose: () => this.finish('cancel'),
      footer: {
        customerName: this.visual.customerName,
        libVersion: LIB_VERSION ? { current: LIB_VERSION } : false,
        libVersionMode: 'static',
      },
    });

    this.overlay.addEventListener('click', this.onOverlayClick);
    this.overlay.addEventListener('keydown', this.onKeydown);
    (doc.body || doc.documentElement).appendChild(this.overlay);

    if (initial) this.selectTab(initial, true);
    else this.modal.setAttribute('tabindex', '-1');
    if (!initial) this.modal.focus();
  }

  private selectTab(domain: ReportDomain, focus: boolean): void {
    this.tabs.forEach((t) => {
      const on = t.dataset.domain === domain;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    this.panels.forEach((panel, d) => {
      panel.hidden = d !== domain;
    });
  }

  private onTabsKeydown = (e: KeyboardEvent): void => {
    const i = this.tabs.findIndex((t) => t === e.target);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % this.tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + this.tabs.length) % this.tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = this.tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    this.selectTab(this.tabs[next].dataset.domain as ReportDomain, true);
  };

  private onOverlayClick = (e: MouseEvent): void => {
    if (e.target === this.overlay) this.finish('cancel');
  };

  private onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.finish('cancel');
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = Array.from(
      this.modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]'),
    ).filter((el) => !(el as HTMLButtonElement).disabled && el.tabIndex >= 0 && !el.closest('[hidden]'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = this.doc.activeElement;
    if (e.shiftKey && (active === first || !this.modal.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !this.modal.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  private setBusy(chosen: CardRefs | null): void {
    this.cards.forEach((c) => {
      const busy = !!chosen;
      if (c.card === chosen?.card) {
        c.card.setAttribute('aria-busy', 'true');
      } else {
        c.card.disabled = busy;
        c.card.removeAttribute('aria-busy');
      }
    });
    if (!chosen) this.cards.forEach((c) => c.card.removeAttribute('aria-busy'));
  }

  private onCardClick(domain: ReportDomain, item: ReportsCatalogItem, refs: CardRefs): void {
    if (this.done || this.inflight) return;
    if (refs.card.dataset.state !== 'enabled') return;
    void this.select(domain, item, refs);
  }

  private async select(domain: ReportDomain, item: ReportsCatalogItem, refs: CardRefs): Promise<void> {
    const handler = this.handlers[item.kind];
    if (!handler) return;
    const id = ++this.seq;
    const controller = new AbortController();
    this.inflight = { id, controller, card: refs };
    refs.err.textContent = '';
    const spin = this.doc.createElement('span');
    spin.className = 'rh-spin';
    spin.setAttribute('aria-hidden', 'true');
    refs.card.appendChild(spin);
    this.setBusy(refs);

    let open: (() => void) | undefined;
    try {
      open = await handler.prepare({
        domain,
        item,
        context: this.p.context,
        visual: this.visual,
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted || this.done || this.inflight?.id !== id) return;
      spin.remove();
      this.inflight = null;
      this.setBusy(null);
      const message = err instanceof ReportsHubUserError ? err.message : GENERIC_ERROR;
      logWarn(`prepare failed (${domain}/${item.id}):`, (err as Error)?.message || err);
      this.showError(domain, item, refs, message);
      this.p.onError?.({ domain, item: item.id, phase: 'prepare', message });
      return;
    }
    if (controller.signal.aborted || this.done || this.inflight?.id !== id) return;
    this.inflight = null;
    this.finish('success');
    try {
      this.p.onOpenReport?.({ domain, item: item.id });
    } catch {
      // logging hook must not block the report
    }
    try {
      if (typeof open !== 'function') throw new Error('handler returned no opener');
      open();
    } catch (err) {
      logWarn(`open failed (${domain}/${item.id}):`, (err as Error)?.message || err);
      this.p.onError?.({ domain, item: item.id, phase: 'open', message: GENERIC_ERROR });
      try {
        MyIOToast.error(GENERIC_ERROR);
      } catch {
        // toast unavailable (e.g. no DOM)
      }
    }
  }

  private showError(domain: ReportDomain, item: ReportsCatalogItem, refs: CardRefs, message: string): void {
    refs.err.textContent = '';
    const msg = this.doc.createElement('span');
    msg.textContent = message;
    const retry = this.doc.createElement('button');
    retry.type = 'button';
    retry.className = 'rh-retry';
    retry.textContent = 'Tentar de novo';
    retry.addEventListener('click', () => {
      if (this.done || this.inflight) return;
      void this.select(domain, item, refs);
    });
    refs.err.append(msg, retry);
  }

  /** Single, idempotent cleanup. 'cancel' aborts the in-flight selection; 'success' does not. */
  finish(reason: FinishReason): void {
    if (this.done) return;
    this.done = true;
    if (reason === 'cancel') this.inflight?.controller.abort();
    this.inflight = null;
    this.overlay.removeEventListener('click', this.onOverlayClick);
    this.overlay.removeEventListener('keydown', this.onKeydown);
    this.chrome?.destroy();
    this.chrome = null;
    this.overlay.remove();
    if (registry.get(this.doc) === this) registry.delete(this.doc);
    if (reason === 'cancel' && this.opener instanceof HTMLElement && this.opener.isConnected) {
      try {
        this.opener.focus();
      } catch {
        // opener no longer focusable
      }
    }
  }

  handle(): ReportsHubHandle {
    const hub = this;
    return {
      close: () => hub.finish('cancel'),
      get isOpen() {
        return hub.isOpen;
      },
    };
  }
}

/** Opens the Reports Hub (or closes it on a second call with `toggle`, the default). */
export function openReportsHub(params: OpenReportsHubParams): ReportsHubHandle {
  if (!params || !params.context) throw new Error('openReportsHub: `context` is required');
  const doc = params.document ?? defaultDocument();
  const existing = registry.get(doc);
  if (existing && existing.isOpen) {
    if (params.toggle !== false) existing.finish('cancel');
    return existing.handle();
  }
  const hub = new ReportsHub(doc, params);
  registry.set(doc, hub);
  try {
    hub.mount();
  } catch (err) {
    registry.delete(doc);
    throw err;
  }
  return hub.handle();
}
