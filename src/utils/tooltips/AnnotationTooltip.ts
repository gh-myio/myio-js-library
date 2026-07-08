/**
 * AnnotationTooltip — Reusable annotation preview tooltip.
 *
 * Follows the same attach/cleanup pattern as EnergyRangeTooltip.
 * Shows active annotations for an alarm card on hover.
 *
 * @example
 * const cleanup = AnnotationTooltip.attach(triggerEl, () => getAlarmAnnotations(alarmId));
 * // Later: cleanup();
 */

// =====================================================================
// Types
// =====================================================================

export type AnnotationType = 'observation' | 'pending' | 'maintenance' | 'activity';
export type ImportanceLevel = 1 | 2 | 3 | 4 | 5;

export interface TooltipAnnotation {
  id: string;
  text: string;
  type: AnnotationType;
  importance: ImportanceLevel;
  createdAt: string;
  createdBy: string;
  dueDate?: string;
  archived: boolean;
}

// =====================================================================
// CSS
// =====================================================================

const CSS = `
.annot-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.25s ease, transform 0.25s ease;
  transform: translateY(6px);
}
.annot-tooltip.visible {
  opacity: 1;
  transform: translateY(0);
}
.annot-tooltip.closing {
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.annot-tooltip.pinned {
  box-shadow: 0 0 0 2px #7c3aed, 0 10px 40px rgba(0,0,0,0.2);
}
.annot-tooltip.maximized {
  top: 20px !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  width: auto !important;
  max-width: none !important;
}
.annot-tooltip.maximized .annot-tooltip__content {
  width: 100%; height: 100%; max-width: none; display: flex; flex-direction: column;
}
.annot-tooltip.maximized .annot-tooltip__body { flex: 1; overflow-y: auto; }
.annot-tooltip.dragging { transition: none !important; cursor: move; }

.annot-tooltip__content {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15), 0 2px 10px rgba(0,0,0,0.08);
  min-width: 280px;
  max-width: 340px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
}

.annot-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(90deg, #f5f3ff 0%, #ede9fe 100%);
  border-bottom: 1px solid #ddd6fe;
  cursor: move;
  user-select: none;
}
.annot-tooltip__header-icon { font-size: 16px; }
.annot-tooltip__header-title {
  font-weight: 700;
  font-size: 12px;
  color: #6d28d9;
  flex: 1;
}
.annot-tooltip__header-sub {
  font-size: 10px;
  color: #8b5cf6;
  font-weight: 500;
}
.annot-tooltip__header-actions {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
}
.annot-tooltip__hbtn {
  width: 20px; height: 20px;
  border: none;
  background: rgba(255,255,255,0.55);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  color: #7c3aed;
}
.annot-tooltip__hbtn:hover { background: rgba(255,255,255,0.9); color: #5b21b6; }
.annot-tooltip__hbtn.pinned { background: #7c3aed; color: #fff; }
.annot-tooltip__hbtn.pinned:hover { background: #5b21b6; }
.annot-tooltip__hbtn svg { width: 11px; height: 11px; }

.annot-tooltip__body {
  padding: 10px 12px;
  max-height: 320px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #ddd6fe transparent;
}
.annot-tooltip__body::-webkit-scrollbar { width: 4px; }
.annot-tooltip__body::-webkit-scrollbar-thumb { background: #ddd6fe; border-radius: 2px; }

.annot-tooltip__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 12px;
  text-align: center;
  color: #94a3b8;
  font-size: 11px;
}
.annot-tooltip__empty-icon { font-size: 24px; opacity: 0.5; }

.annot-tooltip__item {
  padding: 8px 10px;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  margin-bottom: 6px;
  background: #fafafa;
}
.annot-tooltip__item:last-child { margin-bottom: 0; }
.annot-tooltip__item-head {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
  flex-wrap: wrap;
}
.annot-tooltip__type-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 9px;
  font-size: 9px;
  font-weight: 700;
}
.annot-tooltip__stars {
  font-size: 9px;
  letter-spacing: 0.5px;
}
.annot-tooltip__text {
  font-size: 11px;
  color: #374151;
  line-height: 1.45;
  word-break: break-word;
  margin-bottom: 5px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.annot-tooltip__due {
  font-size: 9px;
  color: #d97706;
  font-weight: 600;
  margin-bottom: 4px;
}
.annot-tooltip__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9px;
  color: #94a3b8;
}
.annot-tooltip__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #ede9fe;
  color: #7c3aed;
  font-size: 7px;
  font-weight: 700;
  flex-shrink: 0;
}
.annot-tooltip__author { color: #4b5563; font-weight: 600; }
.annot-tooltip__date { margin-left: auto; }
`;

// =====================================================================
// CSS injection helper
// =====================================================================

let _cssInjected = false;

function injectCSS(): void {
  if (_cssInjected) return;
  if (typeof document === 'undefined') return;
  const id = 'myio-annotation-tooltip-styles';
  if (document.getElementById(id)) { _cssInjected = true; return; }
  const style = document.createElement('style');
  style.id = id;
  style.textContent = CSS;
  document.head.appendChild(style);
  _cssInjected = true;
}

// =====================================================================
// Constants
// =====================================================================

const TYPE_LABELS: Record<AnnotationType, string> = {
  observation: 'Observação',
  pending: 'Pendência',
  maintenance: 'Manutenção',
  activity: 'Atividade',
};

const TYPE_COLORS: Record<AnnotationType, string> = {
  observation: '#339af0',
  pending: '#ff6b6b',
  maintenance: '#ffa94d',
  activity: '#51cf66',
};

const IMPORTANCE_COLORS: Record<ImportanceLevel, string> = {
  1: '#74b9ff', 2: '#81ecec', 3: '#fdcb6e', 4: '#fab1a0', 5: '#ff7675',
};

function fmtDt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =====================================================================
// Tooltip HTML builder
// =====================================================================

function buildTooltipHtml(annotations: TooltipAnnotation[]): string {
  const active = annotations.filter(a => !a.archived);
  const total = annotations.length;
  const sub = active.length === 0
    ? 'sem anotações ativas'
    : `${active.length} ativa${active.length !== 1 ? 's' : ''}${total > active.length ? ` · ${total - active.length} arquivada${total - active.length !== 1 ? 's' : ''}` : ''}`;

  const bodyHtml = active.length === 0
    ? `<div class="annot-tooltip__empty">
         <div class="annot-tooltip__empty-icon">📋</div>
         <div>Nenhuma anotação ativa</div>
       </div>`
    : active.map(ann => {
        const tc = TYPE_COLORS[ann.type];
        const ic = IMPORTANCE_COLORS[ann.importance];
        const stars = '★'.repeat(ann.importance) + '☆'.repeat(5 - ann.importance);
        const ini = initials(ann.createdBy);
        return `
          <div class="annot-tooltip__item">
            <div class="annot-tooltip__item-head">
              <span class="annot-tooltip__type-badge" style="background:${tc}18;color:${tc};border:1px solid ${tc}40">${TYPE_LABELS[ann.type]}</span>
              <span class="annot-tooltip__stars" style="color:${ic}">${stars}</span>
            </div>
            <div class="annot-tooltip__text">${esc(ann.text)}</div>
            ${ann.dueDate ? `<div class="annot-tooltip__due">⏰ Prazo: ${new Date(ann.dueDate).toLocaleDateString('pt-BR')}</div>` : ''}
            <div class="annot-tooltip__meta">
              <span class="annot-tooltip__avatar">${ini}</span>
              <span class="annot-tooltip__author">${esc(ann.createdBy)}</span>
              <span class="annot-tooltip__date">${fmtDt(ann.createdAt)}</span>
            </div>
          </div>`;
      }).join('');

  return `
    <div class="annot-tooltip__content">
      <div class="annot-tooltip__header" data-drag-handle>
        <span class="annot-tooltip__header-icon">📋</span>
        <span class="annot-tooltip__header-title">Anotações</span>
        <span class="annot-tooltip__header-sub">${sub}</span>
        <div class="annot-tooltip__header-actions">
          <button class="annot-tooltip__hbtn" data-action="pin" title="Fixar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/><line x1="12" y1="16" x2="12" y2="21"/><line x1="8" y1="4" x2="16" y2="4"/></svg>
          </button>
          <button class="annot-tooltip__hbtn" data-action="close" title="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="annot-tooltip__body">${bodyHtml}</div>
    </div>`;
}

// =====================================================================
// AnnotationTooltip singleton
// =====================================================================

export const AnnotationTooltip = {
  containerId: 'myio-annotation-tooltip',

  _hideTimer: null as ReturnType<typeof setTimeout> | null,
  _isMouseOverTooltip: false,
  _isDragging: false,
  _dragOffset: { x: 0, y: 0 },
  _savedPosition: null as { left: string; top: string } | null,
  _isMaximized: false,
  _pinnedCounter: 0,

  getContainer(): HTMLElement {
    injectCSS();
    let el = document.getElementById(this.containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = this.containerId;
      el.className = 'annot-tooltip';
      document.body.appendChild(el);
    }
    return el;
  },

  show(triggerElement: HTMLElement, annotations: TooltipAnnotation[]): void {
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }

    const container = this.getContainer();
    container.classList.remove('closing');
    container.innerHTML = buildTooltipHtml(annotations);

    // Position near trigger
    const rect = triggerElement.getBoundingClientRect();
    const tooltipW = 320;
    const tooltipH = Math.min(400, 60 + annotations.filter(a => !a.archived).length * 110);
    let left = rect.right + 10;
    let top = rect.top;

    if (left + tooltipW > window.innerWidth - 10) left = rect.left - tooltipW - 10;
    if (left < 10) left = 10;
    if (top + tooltipH > window.innerHeight - 10) top = window.innerHeight - tooltipH - 10;
    if (top < 10) top = 10;

    container.style.left = left + 'px';
    container.style.top = top + 'px';
    container.classList.add('visible');

    this._setupTooltipHoverListeners(container);
    this._setupButtonListeners(container);
    this._setupDragListeners(container);
  },

  hide(): void {
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    this._isMouseOverTooltip = false;
    this._isMaximized = false;
    this._isDragging = false;
    this._savedPosition = null;
    const container = document.getElementById(this.containerId);
    if (container) container.classList.remove('visible', 'closing', 'pinned', 'maximized', 'dragging');
  },

  close(): void {
    this._isMaximized = false;
    this._isDragging = false;
    this._savedPosition = null;
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    const container = document.getElementById(this.containerId);
    if (container) container.classList.remove('visible', 'pinned', 'maximized', 'dragging', 'closing');
  },

  hideWithAnimation(): void {
    const container = document.getElementById(this.containerId);
    if (container && container.classList.contains('visible')) {
      container.classList.add('closing');
      setTimeout(() => {
        this._isMouseOverTooltip = false;
        this._isMaximized = false;
        this._isDragging = false;
        this._savedPosition = null;
        container.classList.remove('visible', 'closing', 'pinned', 'maximized', 'dragging');
        container.innerHTML = '';
      }, 350);
    }
  },

  _startDelayedHide(): void {
    if (this._isMouseOverTooltip) return;
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => this.hideWithAnimation(), 1200);
  },

  _setupTooltipHoverListeners(container: HTMLElement): void {
    container.onmouseenter = () => {
      this._isMouseOverTooltip = true;
      if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    };
    container.onmouseleave = () => {
      this._isMouseOverTooltip = false;
      this._startDelayedHide();
    };
  },

  _setupButtonListeners(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const a = btn.dataset.action;
        if (a === 'pin') this.togglePin();
        else if (a === 'close') this.close();
      });
    });
  },

  _setupDragListeners(container: HTMLElement): void {
    const header = container.querySelector<HTMLElement>('[data-drag-handle]');
    if (!header) return;
    const self = this;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-action]')) return;
      if (self._isMaximized) return;
      self._isDragging = true;
      container.classList.add('dragging');
      const rect = container.getBoundingClientRect();
      self._dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!self._isDragging) return;
      const mxL = window.innerWidth - container.offsetWidth;
      const mxT = window.innerHeight - container.offsetHeight;
      container.style.left = Math.max(0, Math.min(e.clientX - self._dragOffset.x, mxL)) + 'px';
      container.style.top  = Math.max(0, Math.min(e.clientY - self._dragOffset.y, mxT)) + 'px';
    };
    const onMouseUp = () => {
      self._isDragging = false;
      container.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    header.addEventListener('mousedown', onMouseDown);
  },

  togglePin(): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    this._pinnedCounter++;
    const pinnedId = `${this.containerId}-pinned-${this._pinnedCounter}`;
    const clone = container.cloneNode(true) as HTMLElement;
    clone.id = pinnedId;
    clone.classList.add('pinned');
    clone.classList.remove('closing');
    const pinBtn = clone.querySelector<HTMLElement>('[data-action="pin"]');
    if (pinBtn) {
      pinBtn.classList.add('pinned');
      pinBtn.title = 'Desafixar';
      pinBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/><line x1="12" y1="16" x2="12" y2="21"/><line x1="8" y1="4" x2="16" y2="4"/></svg>`;
    }
    document.body.appendChild(clone);
    this._setupPinnedCloneListeners(clone, pinnedId);
    this.hide();
  },

  _setupPinnedCloneListeners(clone: HTMLElement, cloneId: string): void {
    clone.querySelector('[data-action="pin"]')?.addEventListener('click', e => {
      e.stopPropagation();
      this._closePinnedClone(cloneId);
    });
    clone.querySelector('[data-action="close"]')?.addEventListener('click', e => {
      e.stopPropagation();
      this._closePinnedClone(cloneId);
    });
    // Drag for clone
    const header = clone.querySelector<HTMLElement>('[data-drag-handle]');
    if (header) {
      let isDragging = false;
      let dragOffset = { x: 0, y: 0 };
      const onMouseDown = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('[data-action]')) return;
        isDragging = true;
        clone.classList.add('dragging');
        const rect = clone.getBoundingClientRect();
        dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };
      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const mxL = window.innerWidth - clone.offsetWidth;
        const mxT = window.innerHeight - clone.offsetHeight;
        clone.style.left = Math.max(0, Math.min(e.clientX - dragOffset.x, mxL)) + 'px';
        clone.style.top  = Math.max(0, Math.min(e.clientY - dragOffset.y, mxT)) + 'px';
      };
      const onMouseUp = () => {
        isDragging = false;
        clone.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      header.addEventListener('mousedown', onMouseDown);
    }
  },

  _closePinnedClone(cloneId: string): void {
    const clone = document.getElementById(cloneId);
    if (clone) { clone.classList.add('closing'); setTimeout(() => clone.remove(), 350); }
  },

  /**
   * Attach tooltip to element. Returns cleanup function.
   * @param element  - The trigger element (hover target)
   * @param getAnnotations - Function that returns current annotations (called on each hover)
   */
  attach(element: HTMLElement, getAnnotations: () => TooltipAnnotation[]): () => void {
    const self = this;
    const onEnter = () => {
      if (self._hideTimer) { clearTimeout(self._hideTimer); self._hideTimer = null; }
      self.show(element, getAnnotations());
    };
    const onLeave = () => self._startDelayedHide();
    element.addEventListener('mouseenter', onEnter);
    element.addEventListener('mouseleave', onLeave);
    return () => {
      element.removeEventListener('mouseenter', onEnter);
      element.removeEventListener('mouseleave', onLeave);
      self.hide();
    };
  },
};
