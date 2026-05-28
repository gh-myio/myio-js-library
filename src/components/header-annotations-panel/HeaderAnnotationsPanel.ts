/**
 * RFC-0203 M4 — HeaderAnnotationsPanel.
 *
 * Static panel (no virtualization, no search/sort/filter yet — those land in
 * M5/M6). Renders 3 tabs (Por Identificador / Por Device / Por Domínio),
 * shows groups + items, dispatches `myio:annotation-clicked` on item click.
 *
 * Lifecycle:
 *   - new HeaderAnnotationsPanel()         — creates instance; lazy DOM.
 *   - panel.show(buttonEl)                 — renders + positions + binds.
 *   - panel.hide()                         — hides + unbinds.
 *   - panel.destroy()                      — removes DOM + listeners.
 *
 * Pin/Maximize/Drag come in M6 (AC-32..AC-35). For now, close on:
 *   - click outside the panel
 *   - Esc keypress
 *   - X (close) button in the header
 *
 * The panel queries `window.AnnotationServiceOrchestrator` at show() time;
 * it does NOT cache. Re-rendering on demand is cheap relative to the orch
 * itself which holds the indexed data.
 */

import {
  HEADER_ANNOTATIONS_STYLES_ID,
  injectStylesOnce,
} from './styles';
import { renderAnnotationItemCard, escapeHtml } from './AnnotationItemCard';
import type {
  AnnotatedDevice,
  AnnotationGroup,
  AnnotationGroupBy,
  AnnotationServiceOrchestratorShape,
} from '../../services/annotations/types';

// ─── Tab metadata ──────────────────────────────────────────────────────────

const TABS: { id: AnnotationGroupBy; label: string }[] = [
  { id: 'identifier', label: 'Por Identificador' },
  { id: 'device', label: 'Por Device' },
  { id: 'domain', label: 'Por Domínio' },
];

const TAB_STORAGE_KEY = 'myio.annotations.activeTab';
const PANEL_DOM_ID = 'myio-annotations-panel';

// ─── Public surface ────────────────────────────────────────────────────────

export interface HeaderAnnotationsPanelOptions {
  /**
   * Accessor for the orchestrator. Defaults to reading
   * `window.AnnotationServiceOrchestrator`. Override for tests.
   */
  getOrchestrator?: () => AnnotationServiceOrchestratorShape | null;
  /**
   * Optional logger; defaults to console.
   */
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}

export class HeaderAnnotationsPanel {
  private root: HTMLDivElement | null = null;
  private anchorButton: HTMLElement | null = null;
  private activeTab: AnnotationGroupBy = 'identifier';
  private isOpen = false;
  private readonly opts: Required<HeaderAnnotationsPanelOptions>;

  // Bound listeners stored for removal
  private readonly _onEscKey: (e: KeyboardEvent) => void;
  private readonly _onClickOutside: (e: MouseEvent) => void;
  private readonly _onAnnotationsRefreshed: () => void;

  constructor(options: HeaderAnnotationsPanelOptions = {}) {
    this.opts = {
      getOrchestrator:
        options.getOrchestrator ??
        (() =>
          ((typeof window !== 'undefined'
            ? (window as unknown as {
                AnnotationServiceOrchestrator?: AnnotationServiceOrchestratorShape;
              }).AnnotationServiceOrchestrator
            : null) ?? null)),
      logger: options.logger ?? console,
    };

    this.activeTab = this._loadActiveTab();
    this._onEscKey = (e) => {
      if (e.key === 'Escape' && this.isOpen) this.hide();
    };
    this._onClickOutside = (e) => {
      if (!this.isOpen || !this.root) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (this.root.contains(target)) return;
      if (this.anchorButton && this.anchorButton.contains(target)) return;
      this.hide();
    };
    this._onAnnotationsRefreshed = () => {
      if (this.isOpen) this._render();
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /** Render + position + show. Idempotent. */
  show(anchorButton: HTMLElement): void {
    injectStylesOnce();
    this.anchorButton = anchorButton;
    if (!this.root) this.root = this._createRoot();
    this._render();
    this._position();
    this.root.style.display = '';
    this.root.setAttribute('aria-hidden', 'false');
    this.isOpen = true;
    this._bindWindowListeners();

    // Move focus to first tab for keyboard users
    const firstTab = this.root.querySelector<HTMLButtonElement>('.myio-annotations-tab[aria-selected="true"]');
    if (firstTab) firstTab.focus();
  }

  /** Hide the panel without destroying it. */
  hide(): void {
    if (!this.root) return;
    this.root.style.display = 'none';
    this.root.setAttribute('aria-hidden', 'true');
    this.isOpen = false;
    this._unbindWindowListeners();
    if (this.anchorButton) {
      // AC-47: return focus to the button
      try {
        this.anchorButton.focus();
      } catch {
        /* ignore */
      }
    }
  }

  /** Toggle convenience. */
  toggle(anchorButton: HTMLElement): void {
    if (this.isOpen) this.hide();
    else this.show(anchorButton);
  }

  /** Remove the panel DOM + listeners. After this, `show()` recreates. */
  destroy(): void {
    this._unbindWindowListeners();
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
    this.anchorButton = null;
    this.isOpen = false;
  }

  /** Test/inspection helper. */
  getActiveTab(): AnnotationGroupBy {
    return this.activeTab;
  }

  /** Test helper — programmatic tab switch (also persists to sessionStorage). */
  setActiveTab(tab: AnnotationGroupBy): void {
    if (!TABS.some((t) => t.id === tab)) return;
    this.activeTab = tab;
    this._saveActiveTab(tab);
    if (this.isOpen) this._render();
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private _loadActiveTab(): AnnotationGroupBy {
    try {
      if (typeof sessionStorage === 'undefined') return 'identifier';
      const stored = sessionStorage.getItem(TAB_STORAGE_KEY) as AnnotationGroupBy | null;
      if (stored && TABS.some((t) => t.id === stored)) return stored;
    } catch {
      /* ignore */
    }
    return 'identifier';
  }

  private _saveActiveTab(tab: AnnotationGroupBy): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(TAB_STORAGE_KEY, tab);
      }
    } catch {
      /* ignore */
    }
  }

  private _createRoot(): HTMLDivElement {
    const el = document.createElement('div');
    el.id = PANEL_DOM_ID;
    el.className = 'myio-annotations-panel';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-labelledby', PANEL_DOM_ID + '-title');
    el.setAttribute('aria-hidden', 'true');
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }

  private _position(): void {
    if (!this.root || !this.anchorButton) return;
    const rect = this.anchorButton.getBoundingClientRect();
    const panelWidth = Math.min(720, window.innerWidth * 0.9);

    let left = rect.left;
    if (left + panelWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - panelWidth - 8);
    }
    const top = rect.bottom + 8;

    this.root.style.left = `${left}px`;
    this.root.style.top = `${top}px`;
    this.root.style.width = `${panelWidth}px`;
  }

  private _bindWindowListeners(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this._onEscKey);
    // Defer click-outside binding so the originating click doesn't immediately close us
    setTimeout(() => {
      window.addEventListener('mousedown', this._onClickOutside, true);
    }, 0);
    window.addEventListener('myio:annotations-refreshed', this._onAnnotationsRefreshed);
  }

  private _unbindWindowListeners(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this._onEscKey);
    window.removeEventListener('mousedown', this._onClickOutside, true);
    window.removeEventListener('myio:annotations-refreshed', this._onAnnotationsRefreshed);
  }

  private _render(): void {
    if (!this.root) return;
    const orch = this.opts.getOrchestrator();
    this.root.innerHTML = this._renderHTML(orch);
    this._bindInteractiveElements();
  }

  private _renderHTML(orch: AnnotationServiceOrchestratorShape | null): string {
    const totalAll = orch?.getTotalCount?.() ?? 0;
    const pending = orch?.getPendingCount?.() ?? 0;
    const overdue = orch?.getOverdueCount?.() ?? 0;

    const tabsHtml = TABS.map(
      (t) =>
        `<button
          class="myio-annotations-tab"
          type="button"
          role="tab"
          id="myio-anno-tab-${t.id}"
          data-tab="${t.id}"
          aria-selected="${t.id === this.activeTab}"
          aria-controls="myio-anno-body"
          tabindex="${t.id === this.activeTab ? 0 : -1}"
        >${t.label}</button>`
    ).join('');

    const groups = orch ? orch.getGroups(this.activeTab) : [];
    const bodyHtml = this._renderBody(groups);

    return `
<div class="myio-annotations-panel-header" data-region="header">
  <h2 class="myio-annotations-panel-title" id="${PANEL_DOM_ID}-title">
    <span class="myio-annotations-icon" aria-hidden="true">📋</span>Anotações
  </h2>
  <span class="myio-annotations-panel-meta">${totalAll} ativas · ${pending} pendentes · ${overdue} vencidas</span>
  <div class="myio-annotations-panel-actions">
    <button class="myio-annotations-panel-action" type="button" data-action="close" title="Fechar" aria-label="Fechar painel">✕</button>
  </div>
</div>
<div class="myio-annotations-tabs" role="tablist" aria-label="Modo de agrupamento">${tabsHtml}</div>
<div class="myio-annotations-body" id="myio-anno-body" role="tabpanel" aria-labelledby="myio-anno-tab-${this.activeTab}">${bodyHtml}</div>
<div class="myio-annotations-panel-footer">
  <span>RFC-0203 · M4 (painel base)</span>
  <button class="myio-annotations-panel-footer-action" type="button" data-action="refresh">Atualizar</button>
</div>
`;
  }

  private _renderBody(groups: AnnotationGroup[]): string {
    if (!groups || groups.length === 0) {
      return `
<div class="myio-annotations-empty">
  <div class="myio-annotations-empty-icon" aria-hidden="true">📋</div>
  <div>Nenhuma anotação ativa.</div>
</div>`;
    }

    return groups
      .map((g) => this._renderGroup(g))
      .join('\n');
  }

  private _renderGroup(group: AnnotationGroup): string {
    const isNoIdentifier = this.activeTab === 'identifier' && group.key === 'Sem Identificador';
    const items = group.devices.flatMap((d) =>
      d.annotations.map((a) => renderAnnotationItemCard(d as AnnotatedDevice, a))
    );

    const groupClass = isNoIdentifier
      ? 'myio-annotations-group myio-annotations-group--no-id'
      : 'myio-annotations-group';

    return `
<section class="${groupClass}">
  <header class="myio-annotations-group-header">
    ${group.icon ? `<span class="myio-annotations-group-icon" aria-hidden="true">${escapeHtml(group.icon)}</span>` : ''}
    <span class="myio-annotations-group-label">${escapeHtml(group.label)}</span>
    <span class="myio-annotations-group-count">${group.totalAnnotations}</span>
  </header>
  ${items.join('\n')}
</section>`;
  }

  private _bindInteractiveElements(): void {
    if (!this.root) return;

    // Tab buttons
    const tabBtns = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.myio-annotations-tab'));
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as AnnotationGroupBy | null;
        if (tab) this.setActiveTab(tab);
      });
    });

    // AC-44: Tab keyboard navigation (←/→/Home/End)
    const tablist = this.root.querySelector<HTMLDivElement>('.myio-annotations-tabs');
    if (tablist) {
      tablist.addEventListener('keydown', (e) => this._onTabKeydown(e as KeyboardEvent, tabBtns));
    }

    // Item clicks → dispatch event
    const items = this.root.querySelectorAll<HTMLButtonElement>('.myio-annotations-item');
    items.forEach((it) => {
      it.addEventListener('click', () => this._handleItemClick(it));
    });

    // Header actions
    const closeBtn = this.root.querySelector<HTMLButtonElement>('[data-action="close"]');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());

    const refreshBtn = this.root.querySelector<HTMLButtonElement>('[data-action="refresh"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const orch = this.opts.getOrchestrator();
        if (orch && typeof orch.refresh === 'function') {
          orch.refresh().catch((err) => this.opts.logger.warn('[HeaderAnnotationsPanel] refresh failed:', err));
        }
      });
    }
  }

  private _onTabKeydown(e: KeyboardEvent, tabBtns: HTMLButtonElement[]): void {
    const currentIdx = tabBtns.findIndex(
      (b) => b.getAttribute('aria-selected') === 'true'
    );
    if (currentIdx < 0) return;
    let nextIdx = currentIdx;

    switch (e.key) {
      case 'ArrowRight':
        nextIdx = (currentIdx + 1) % tabBtns.length;
        break;
      case 'ArrowLeft':
        nextIdx = (currentIdx - 1 + tabBtns.length) % tabBtns.length;
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = tabBtns.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const tabId = tabBtns[nextIdx].getAttribute('data-tab') as AnnotationGroupBy | null;
    if (tabId) {
      this.setActiveTab(tabId);
      // Re-query the new selected tab to refocus
      requestAnimationFrame(() => {
        const sel = this.root?.querySelector<HTMLButtonElement>(
          '.myio-annotations-tab[aria-selected="true"]'
        );
        sel?.focus();
      });
    }
  }

  private _handleItemClick(itemEl: HTMLButtonElement): void {
    const deviceId = itemEl.getAttribute('data-device-id') || '';
    const annotationId = itemEl.getAttribute('data-annotation-id') || '';

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('myio:annotation-clicked', {
          detail: { deviceId, annotationId, returnTo: 'header-panel' },
        })
      );
    }
    // The downstream handler decides whether to open SettingsModal etc.
    // M4 scope: dispatch only. M7 will wire the actual SettingsModal handler.
  }
}

// ─── Convenience singleton accessor for the widget (HEADER controller) ─────

let _singleton: HeaderAnnotationsPanel | null = null;

/**
 * Returns the lazy singleton instance for use inside the HEADER widget.
 * Tests should `new HeaderAnnotationsPanel()` directly to avoid global state.
 */
export function getHeaderAnnotationsPanel(): HeaderAnnotationsPanel {
  if (!_singleton) _singleton = new HeaderAnnotationsPanel();
  return _singleton;
}

// Re-export styles helper for direct callers
export { injectStylesOnce, HEADER_ANNOTATIONS_STYLES_ID };
