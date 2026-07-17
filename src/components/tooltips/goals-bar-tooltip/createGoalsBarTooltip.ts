/**
 * createGoalsBarTooltip — Premium, generic (tree-driven) tooltip for the goals
 * ("Metas") bar charts.
 *
 * Inspired by the interaction pattern of `src/utils/tooltips/EnergySummaryTooltip.ts`
 * (position:fixed cursor-anchored tooltip, header pin toggle, expand/collapse
 * carets, indented child rows, per-row relative percentage, premium look with
 * once-injected CSS) — but simpler and fully generic: it renders a tree of
 * `TipRow`s and knows nothing about energy/water specifics.
 *
 * Usage:
 *   const tip = createGoalsBarTooltip({ accentColor: '#6c5ce7' });
 *   // On chart hover, build data and show at the cursor:
 *   tip.show({ title: '01/07/2026', rows: [...] }, evt);
 *   // On mouseout (unless pinned):
 *   tip.hide();
 *   // When the chart/modal is torn down:
 *   tip.destroy();
 */

// ============================================================================
// Types
// ============================================================================

export interface TipRow {
  /** Emoji or small glyph shown before the label. */
  icon?: string;
  label: string;
  /** Preformatted value string, e.g. "295,35 MWh" (caller formats — pt-BR). */
  valueText: string;
  /** Relative percentage (0–100) shown as e.g. "42,3%". null/undefined → hidden. */
  pct?: number | null;
  /** Small swatch (series/device color). */
  color?: string;
  /** Expandable children; carets appear when present. */
  children?: TipRow[];
  /** Pre-expand this row's children (useful since unpinned tooltip is non-interactive). */
  defaultExpanded?: boolean;
}

export interface GoalsBarTooltipData {
  /** e.g. "01/07/2026" (the hovered bar's period) or the shopping name. */
  title: string;
  subtitle?: string;
  /** Top-level rows: Realizado, A-1, Meta, Orçado (each may have device children). */
  rows: TipRow[];
  /** Theme accent; falls back to --myio-brand-700 then a default. */
  accentColor?: string;
}

export interface GoalsBarTooltipInstance {
  show(data: GoalsBarTooltipData, evt: { clientX: number; clientY: number } | MouseEvent): void;
  hide(): void;
  isPinned(): boolean;
  destroy(): void;
}

// ============================================================================
// Styles (injected once)
// ============================================================================

const STYLE_ID = 'myio-goals-bar-tooltip-styles';
const DEFAULT_ACCENT = '#6c5ce7';

function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const s = doc.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
.myio-gbt {
  position: fixed;
  z-index: 100000;
  top: 0;
  left: 0;
  opacity: 0;
  pointer-events: none; /* unpinned: never blocks the chart hover */
  transition: opacity .15s ease;
  font-family: Nunito, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.myio-gbt.myio-gbt--visible { opacity: 1; }
/* Header stays clickable even while unpinned, so the 📌 pin is reachable as the
   cursor travels off the chart onto the tooltip (a short grace hide covers the gap). */
.myio-gbt .myio-gbt__header { pointer-events: auto; }
.myio-gbt.myio-gbt--pinned { pointer-events: auto; } /* fully interactive when pinned */

.myio-gbt__card {
  background: #ffffff;
  border: 1px solid #e6e8ef;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(2,6,23,.18), 0 2px 8px rgba(2,6,23,.08);
  min-width: 250px;
  max-width: 360px;
  overflow: hidden;
  color: #1e293b;
  font-size: 12px;
}

.myio-gbt__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--myio-gbt-accent) 14%, #fff) 0%,
    color-mix(in srgb, var(--myio-gbt-accent) 6%, #fff) 100%);
  border-bottom: 1px solid color-mix(in srgb, var(--myio-gbt-accent) 30%, #fff);
}
.myio-gbt__title-wrap { flex: 1; min-width: 0; }
.myio-gbt__title {
  font-weight: 800;
  font-size: 13px;
  color: var(--myio-gbt-accent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.myio-gbt__subtitle {
  font-size: 10.5px;
  color: #64748b;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.myio-gbt__btn {
  width: 22px;
  height: 22px;
  border: none;
  background: rgba(255,255,255,.55);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  line-height: 1;
  color: #64748b;
  transition: background .12s ease, color .12s ease, transform .12s ease;
  flex-shrink: 0;
}
.myio-gbt__btn:hover { background: rgba(255,255,255,.95); color: #1e293b; }
.myio-gbt__btn--pin.is-pinned {
  background: var(--myio-gbt-accent);
  color: #fff;
  transform: rotate(-8deg);
}
.myio-gbt__btn--close { display: none; }
.myio-gbt.myio-gbt--pinned .myio-gbt__btn--close { display: flex; }

.myio-gbt__body {
  padding: 6px 8px 8px;
  max-height: 60vh;
  overflow-y: auto;
}

.myio-gbt__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 7px;
}
.myio-gbt__row:hover { background: #f5f6fb; }
.myio-gbt__row--child { padding-top: 4px; padding-bottom: 4px; }
.myio-gbt__row--child .myio-gbt__label { font-weight: 500; color: #475569; }
.myio-gbt__row--child .myio-gbt__value { font-weight: 600; }

.myio-gbt__caret {
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: var(--myio-gbt-accent);
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: transform .12s ease;
  user-select: none;
}
.myio-gbt__caret.is-open { transform: rotate(90deg); }
.myio-gbt__caret-spacer { width: 16px; flex-shrink: 0; }

.myio-gbt__swatch {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  flex-shrink: 0;
}
.myio-gbt__icon { font-size: 12px; flex-shrink: 0; }
.myio-gbt__label {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.myio-gbt__value {
  font-weight: 800;
  color: #0f172a;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.myio-gbt__pct {
  min-width: 46px;
  text-align: right;
  font-size: 11px;
  font-weight: 700;
  color: var(--myio-gbt-accent);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.myio-gbt__children {
  display: none;
  margin-left: 10px;
  padding-left: 6px;
  border-left: 2px solid color-mix(in srgb, var(--myio-gbt-accent) 22%, #fff);
}
.myio-gbt__children.is-open { display: block; }

.myio-gbt__empty {
  padding: 10px;
  text-align: center;
  color: #94a3b8;
  font-style: italic;
}
`;
  (doc.head || doc.documentElement).appendChild(s);
}

// ============================================================================
// Helpers
// ============================================================================

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtPct(pct: number | null | undefined): string {
  if (pct == null || !isFinite(pct)) return '';
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Resolve accent: explicit → inherited --myio-brand-700 → default. */
function resolveAccent(explicit: string | undefined, doc: Document): string {
  if (explicit) return explicit;
  try {
    const v = getComputedStyle(doc.documentElement).getPropertyValue('--myio-brand-700').trim();
    if (v) return v;
  } catch { /* ignore */ }
  return DEFAULT_ACCENT;
}

// ============================================================================
// Row rendering (recursive tree)
// ============================================================================

let _rowSeq = 0;

function renderRow(row: TipRow, level: number): string {
  const hasChildren = Array.isArray(row.children) && row.children.length > 0;
  const open = !!row.defaultExpanded;
  const id = `gbtr-${++_rowSeq}`;

  // pct is caller-computed (relative to the parent row's value — see docs).
  const pct = row.pct;

  const caret = hasChildren
    ? `<button class="myio-gbt__caret${open ? ' is-open' : ''}" data-caret="${id}" title="Expandir/recolher">▸</button>`
    : `<span class="myio-gbt__caret-spacer"></span>`;

  const swatch = row.color
    ? `<span class="myio-gbt__swatch" style="background:${esc(row.color)}"></span>`
    : '';
  const icon = row.icon ? `<span class="myio-gbt__icon">${esc(row.icon)}</span>` : '';
  const pctHtml = pct != null && isFinite(pct)
    ? `<span class="myio-gbt__pct">${esc(fmtPct(pct))}</span>`
    : '';

  const rowClass = level > 0 ? 'myio-gbt__row myio-gbt__row--child' : 'myio-gbt__row';

  let html = `<div class="${rowClass}">`
    + caret
    + swatch
    + icon
    + `<span class="myio-gbt__label">${esc(row.label)}</span>`
    + `<span class="myio-gbt__value">${esc(row.valueText)}</span>`
    + pctHtml
    + `</div>`;

  if (hasChildren) {
    const childHtml = row.children!
      .map((c) => renderRow(c, level + 1))
      .join('');
    html += `<div class="myio-gbt__children${open ? ' is-open' : ''}" data-children="${id}">${childHtml}</div>`;
  }

  return html;
}

// ============================================================================
// Factory
// ============================================================================

export function createGoalsBarTooltip(
  opts?: { accentColor?: string }
): GoalsBarTooltipInstance {
  const doc: Document = (() => {
    try { return (window.top || window).document; } catch { return document; }
  })();

  injectStyles(doc);

  const el = doc.createElement('div');
  el.className = 'myio-gbt';
  el.style.setProperty('--myio-gbt-accent', resolveAccent(opts?.accentColor, doc));
  doc.body.appendChild(el);

  let pinned = false;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const clearHideTimer = () => {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  };

  // Moving the cursor onto the tooltip (header/body) cancels the pending grace
  // hide so the user can reach the pin / carets; leaving it re-arms the hide.
  el.addEventListener('mouseenter', clearHideTimer);
  el.addEventListener('mouseleave', () => { if (!pinned) hide(); });

  function positionAt(clientX: number, clientY: number): void {
    // Measure then flip to stay on-screen (like EnergySummaryTooltip).
    const rect = el.getBoundingClientRect();
    const w = rect.width || 280;
    const h = rect.height || 200;
    const pad = 12;
    const gap = 16;

    let left = clientX + gap;
    let top = clientY + gap;

    if (left + w > window.innerWidth - pad) left = clientX - w - gap;
    if (left < pad) left = Math.max(pad, (window.innerWidth - w) / 2);

    if (top + h > window.innerHeight - pad) top = clientY - h - gap;
    if (top < pad) top = pad;
    if (top + h > window.innerHeight - pad) top = Math.max(pad, window.innerHeight - h - pad);

    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  }

  function wireInteractions(): void {
    // Pin toggle
    const pinBtn = el.querySelector('[data-action="pin"]');
    pinBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      pinned = !pinned;
      el.classList.toggle('myio-gbt--pinned', pinned);
      (pinBtn as HTMLElement).classList.toggle('is-pinned', pinned);
      (pinBtn as HTMLElement).title = pinned ? 'Desafixar' : 'Fixar na tela';
    });

    // Close (only visible when pinned)
    const closeBtn = el.querySelector('[data-action="close"]');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      pinned = false;
      el.classList.remove('myio-gbt--pinned');
      hide(true);
    });

    // Expand/collapse carets
    el.querySelectorAll('[data-caret]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.caret;
        const kids = el.querySelector(`[data-children="${id}"]`);
        if (!kids) return;
        const isOpen = kids.classList.toggle('is-open');
        (btn as HTMLElement).classList.toggle('is-open', isOpen);
      });
    });
  }

  function render(data: GoalsBarTooltipData): void {
    const accent = resolveAccent(data.accentColor ?? opts?.accentColor, doc);
    el.style.setProperty('--myio-gbt-accent', accent);

    const rowsHtml = (data.rows && data.rows.length > 0)
      ? data.rows.map((r) => renderRow(r, 0)).join('')
      : `<div class="myio-gbt__empty">Sem dados para este período</div>`;

    el.innerHTML = `
      <div class="myio-gbt__card">
        <div class="myio-gbt__header">
          <div class="myio-gbt__title-wrap">
            <div class="myio-gbt__title">${esc(data.title)}</div>
            ${data.subtitle ? `<div class="myio-gbt__subtitle">${esc(data.subtitle)}</div>` : ''}
          </div>
          <button class="myio-gbt__btn myio-gbt__btn--pin${pinned ? ' is-pinned' : ''}" data-action="pin" title="${pinned ? 'Desafixar' : 'Fixar na tela'}">📌</button>
          <button class="myio-gbt__btn myio-gbt__btn--close" data-action="close" title="Fechar">✕</button>
        </div>
        <div class="myio-gbt__body">${rowsHtml}</div>
      </div>`;

    if (pinned) el.classList.add('myio-gbt--pinned');
    wireInteractions();
  }

  function show(
    data: GoalsBarTooltipData,
    evt: { clientX: number; clientY: number } | MouseEvent
  ): void {
    clearHideTimer();
    // While pinned we don't re-render on hover — the user is interacting with it.
    if (pinned) return;
    render(data);
    el.classList.add('myio-gbt--visible');
    const x = (evt && typeof (evt as any).clientX === 'number') ? (evt as any).clientX : window.innerWidth / 2;
    const y = (evt && typeof (evt as any).clientY === 'number') ? (evt as any).clientY : window.innerHeight / 2;
    // Position after layout so measured size is correct.
    positionAt(x, y);
    // A second pass next frame in case fonts/wrapping changed the box.
    requestAnimationFrame(() => { if (!pinned) positionAt(x, y); });
  }

  function hide(force?: boolean): void {
    if (pinned && !force) return;
    if (force) {
      clearHideTimer();
      el.classList.remove('myio-gbt--visible');
      return;
    }
    // Grace period: gives the cursor time to travel from the chart onto the
    // header to click the pin. Cancelled by mouseenter on the tooltip.
    clearHideTimer();
    hideTimer = setTimeout(() => {
      if (!pinned) el.classList.remove('myio-gbt--visible');
      hideTimer = null;
    }, 260);
  }

  function destroy(): void {
    clearHideTimer();
    try { el.remove(); } catch { /* ignore */ }
  }

  return {
    show,
    hide,
    isPinned: () => pinned,
    destroy,
  };
}
