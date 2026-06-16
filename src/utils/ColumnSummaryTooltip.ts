/**
 * ColumnSummaryTooltip - Premium summary tooltip for a device column.
 *
 * Inspired by EnergySummaryTooltip. Renders inside the library InfoTooltip
 * panel and injects its own content CSS (fully self-contained).
 *
 * Compact view: search period, device count, average/total consumption and
 * the top 3 / bottom 3 / 3-closest-to-average devices.
 *
 * Maximized view (InfoTooltip maximize button): an interactive SVG pie of all
 * devices with a legend. Hovering a slice highlights its legend row (and vice
 * versa); clicking a legend row toggles that device out of the pie/totals
 * (local to the tooltip — does NOT propagate to the dashboard).
 */

import { InfoTooltip } from './InfoTooltip';
import { resolvePercentDecimals } from './percentDecimals';

// ============================================
// Types
// ============================================

export interface ColumnSummaryDevice {
  name: string;
  value: number;
}

export interface ColumnSummaryData {
  /** Column label shown in the tooltip header (e.g. "Lojas"). */
  title?: string;
  /** Human-readable search period (e.g. "01/05/2026 — 21/05/2026"). */
  periodLabel?: string;
  /** Unit suffix used by the default formatter (e.g. "kWh", "m³"). */
  unit?: string;
  /** Devices that make up the column. */
  devices: ColumnSummaryDevice[];
  /** Optional value formatter — overrides the default pt-BR + unit formatting. */
  formatValue?: (value: number) => string;
  /** Decimal places for percentages — overrides window.MyIOUtils.percentDecimals (default 2). */
  percentDecimals?: number;
}

// Slice palette for the pie chart — 14 distinct hues, cycled.
const PIE_COLORS = [
  '#3e1a7d', '#9333ea', '#0891b2', '#16a34a', '#f59e0b', '#db2777', '#0284c7',
  '#b45309', '#15803d', '#7c3aed', '#dc2626', '#0d9488', '#ca8a04', '#be185d',
];

// ============================================
// CSS (self-injected)
// ============================================

const COLUMN_SUMMARY_CSS = `
.myio-col-summary {
  width: 100%;
  font-family: 'Nunito', 'Segoe UI', system-ui, sans-serif;
}
.myio-col-summary__kpis {
  display: flex; flex-direction: column; gap: 4px;
  padding: 8px 10px; margin-bottom: 10px;
  background: #faf8ff; border: 1px solid #e3d9f3; border-radius: 8px;
}
.myio-col-summary__kpi {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
}
.myio-col-summary__kpi-label {
  font-size: 10px; font-weight: 700; letter-spacing: 0.3px;
  text-transform: uppercase; color: #64748b;
}
.myio-col-summary__kpi-value {
  font-size: 12px; font-weight: 700; color: #1e293b; text-align: right;
}
.myio-col-summary__kpi-value--accent { font-size: 14px; color: #3e1a7d; }
.myio-col-summary__body { display: block; }
.myio-col-summary__lists { display: flex; flex-direction: column; }
.myio-col-summary__group { display: flex; flex-direction: column; gap: 1px; margin-top: 8px; }
.myio-col-summary__group-label {
  font-size: 10px; font-weight: 800; letter-spacing: 0.3px;
  text-transform: uppercase; color: #64748b; margin-bottom: 3px;
}
.myio-col-summary__row {
  display: flex; align-items: center; gap: 8px; padding: 2px 0;
  font-size: 11px; color: #1e293b;
}
.myio-col-summary__name {
  flex: 1 1 auto; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.myio-col-summary__val { flex: 0 0 auto; font-weight: 700; color: #16a34a; text-align: right; }
.myio-col-summary__pct {
  flex: 0 0 auto; min-width: 44px; text-align: right;
  font-size: 10px; font-weight: 600; color: #64748b;
}
.myio-col-summary__empty {
  padding: 14px 0; text-align: center; font-style: italic;
  font-size: 11px; color: #94a3b8;
}

/* Pie chart + legend — hidden in the compact view, revealed when maximized. */
.myio-col-summary__chart { display: none; }
.myio-col-summary__chart-title {
  font-size: 11px; font-weight: 800; letter-spacing: 0.3px;
  text-transform: uppercase; color: #3e1a7d; margin-bottom: 8px;
}
.myio-col-summary__chart-hint {
  font-size: 10px; font-weight: 500; color: #94a3b8; margin: 0 0 8px;
}
.myio-col-summary__pie {
  display: block; width: 100%; height: auto; aspect-ratio: 1 / 1;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.15));
}
/* Footer band — hidden in compact, shown when maximized (mirrors Energy/Water). */
.myio-col-summary__footer { display: none; }
.myio-col-summary__slice {
  stroke: #ffffff; stroke-width: 1.5;
  transition: opacity 0.12s ease;
  cursor: pointer;
}
.myio-col-summary__slice.is-hl {
  stroke: #1e293b; stroke-width: 3;
}
.myio-col-summary__slice:hover { opacity: 0.85; }
.myio-col-summary__legend {
  display: none;
  min-width: 0; overflow-y: auto;
  flex-direction: column; gap: 1px;
}
.myio-col-summary__legend-row {
  display: flex; align-items: center; gap: 6px; padding: 3px 5px; font-size: 11px;
  border-radius: 4px; cursor: pointer;
  transition: background 0.12s ease;
}
.myio-col-summary__legend-row:hover,
.myio-col-summary__legend-row.is-hl { background: #f1ecfa; }
.myio-col-summary__legend-row.is-excluded { opacity: 0.45; }
.myio-col-summary__legend-row.is-excluded .myio-col-summary__legend-name {
  text-decoration: line-through;
}
.myio-col-summary__legend-dot {
  width: 9px; height: 9px; border-radius: 2px; flex-shrink: 0;
}
.myio-col-summary__legend-name {
  flex: 1 1 auto; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1e293b;
}
.myio-col-summary__legend-val { flex: 0 0 auto; font-weight: 700; color: #16a34a; }
.myio-col-summary__legend-pct {
  flex: 0 0 auto; min-width: 42px; text-align: right; font-size: 10px; color: #64748b;
}

/* Maximized — fill the whole panel: KPIs on top, then a 2-column grid
   (pie + lists on the left, full-height legend on the right). No dead space. */
.myio-info-tooltip.maximized .myio-col-summary {
  max-width: none; height: 100%;
  display: flex; flex-direction: column;
}
.myio-info-tooltip.maximized .myio-col-summary__kpis { flex: 0 0 auto; }
.myio-info-tooltip.maximized .myio-col-summary__body {
  flex: 1 1 auto; min-height: 0;
  display: grid;
  grid-template-columns: minmax(520px, 620px) 1fr;
  grid-template-rows: auto 1fr;
  gap: 14px 22px;
}
.myio-info-tooltip.maximized .myio-col-summary__chart {
  display: block; grid-column: 1; grid-row: 1; min-width: 0;
}
.myio-info-tooltip.maximized .myio-col-summary__pie {
  width: 500px; height: 500px; aspect-ratio: auto; margin: 0 auto;
}
.myio-info-tooltip.maximized .myio-col-summary__lists {
  grid-column: 1; grid-row: 2; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 14px;
  padding-right: 4px;
}
.myio-info-tooltip.maximized .myio-col-summary__legend {
  display: flex; grid-column: 2; grid-row: 1 / 3;
  min-height: 0; max-height: none;
  border-left: 1px solid #e3d9f3; padding-left: 20px;
}
.myio-info-tooltip.maximized .myio-col-summary__group { margin-top: 0; }
/* Footer band — same visual language as Energy/Water tooltips. */
.myio-info-tooltip.maximized .myio-col-summary__footer {
  display: flex; justify-content: space-between; align-items: center;
  flex: 0 0 auto;
  margin: 14px -16px -16px -16px;  /* bleed to the panel edges (cancels __content padding) */
  padding: 12px 18px;
  background: linear-gradient(135deg, #3e1a7d 0%, #6d28d9 100%);
  color: #ffffff; border-radius: 0 0 11px 11px;
}
.myio-info-tooltip.maximized .myio-col-summary__footer-label {
  font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.92);
  letter-spacing: 0.3px;
}
.myio-info-tooltip.maximized .myio-col-summary__footer-value {
  font-size: 18px; font-weight: 700; color: #ffffff;
}
`;

let _cssInjected = false;

function injectCSS(): void {
  if (_cssInjected || typeof document === 'undefined') return;
  const STYLE_ID = 'myio-column-summary-tooltip-css';
  if (document.getElementById(STYLE_ID)) {
    _cssInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = COLUMN_SUMMARY_CSS;
  document.head.appendChild(style);
  _cssInjected = true;
}

// ============================================
// Helpers
// ============================================

function esc(value: unknown): string {
  return String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)
  );
}

function defaultFormatter(unit: string): (value: number) => string {
  const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  return (v) => nf.format(Number(v) || 0) + (unit ? ' ' + unit : '');
}

function fmtPct(value: number, total: number, decimals: number): string {
  const p = total > 0 ? ((Number(value) || 0) / total) * 100 : 0;
  return p.toFixed(decimals).replace('.', ',') + '%';
}

function sliceColor(originalIndex: number): string {
  return PIE_COLORS[originalIndex % PIE_COLORS.length];
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(
    2
  )},${y1.toFixed(2)} Z`;
}

// ============================================
// Render state (the currently-shown tooltip)
// ============================================

interface RenderState {
  data: ColumnSummaryData;
  excluded: Set<number>; // original indices toggled off
  fmt: (v: number) => string;
  pd: number;
}

let _state: RenderState | null = null;
let _rootEl: HTMLElement | null = null;

/** Devices kept in the pie/totals — original index preserved. */
function visibleDevices(): { d: ColumnSummaryDevice; idx: number }[] {
  if (!_state) return [];
  return _state.data.devices
    .map((d, idx) => ({ d, idx }))
    .filter((x) => !_state!.excluded.has(x.idx));
}

// ============================================
// HTML builders
// ============================================

function buildPieSvg(visible: { d: ColumnSummaryDevice; idx: number }[], total: number): string {
  if (!_state) return '';
  const positives = visible.filter((v) => (Number(v.d.value) || 0) > 0);

  if (!positives.length || total <= 0) {
    return `<svg class="myio-col-summary__pie" viewBox="0 0 220 220" role="img" aria-label="Sem dados">
      <circle cx="110" cy="110" r="100" fill="#f1f5f9"></circle>
      <text x="110" y="115" text-anchor="middle" font-size="12" fill="#94a3b8">sem dados</text>
    </svg>`;
  }

  const { fmt, pd } = _state;

  // Single slice covering the whole circle → draw a plain circle (an arc would degenerate).
  if (positives.length === 1) {
    const v = positives[0];
    const val = Number(v.d.value) || 0;
    return `<svg class="myio-col-summary__pie" viewBox="0 0 220 220">
      <circle class="myio-col-summary__slice" data-idx="${v.idx}" cx="110" cy="110" r="100"
        fill="${sliceColor(v.idx)}"><title>${esc(v.d.name)} — ${esc(fmt(val))} (${fmtPct(
      val,
      total,
      pd
    )})</title></circle>
    </svg>`;
  }

  let acc = 0;
  const paths = positives
    .map((v) => {
      const val = Number(v.d.value) || 0;
      const a0 = (acc / total) * 360;
      acc += val;
      const a1 = (acc / total) * 360;
      return `<path class="myio-col-summary__slice" data-idx="${v.idx}"
        d="${arcPath(110, 110, 100, a0, a1)}" fill="${sliceColor(v.idx)}"
        ><title>${esc(v.d.name)} — ${esc(fmt(val))} (${fmtPct(val, total, pd)})</title></path>`;
    })
    .join('');

  return `<svg class="myio-col-summary__pie" viewBox="0 0 220 220">${paths}</svg>`;
}

function buildLegend(total: number): string {
  if (!_state) return '';
  const { data, excluded, fmt, pd } = _state;
  // Sort by descending value (highest % at top). Original idx is preserved
  // so dot color (sliceColor(idx)) and the data-idx cross-highlight key still
  // match the pie slices.
  const rows = data.devices
    .map((d, idx) => ({ d, idx }))
    .sort((a, b) => (Number(b.d.value) || 0) - (Number(a.d.value) || 0))
    .map(({ d, idx }) => {
      const val = Number(d.value) || 0;
      const isExcl = excluded.has(idx);
      const pct = isExcl ? '—' : fmtPct(val, total, pd);
      return `<div class="myio-col-summary__legend-row${isExcl ? ' is-excluded' : ''}" data-idx="${idx}"
          title="Clique para ${isExcl ? 'incluir' : 'remover'} da pizza">
        <span class="myio-col-summary__legend-dot" style="background:${sliceColor(idx)};"></span>
        <span class="myio-col-summary__legend-name">${esc(d.name)}</span>
        <span class="myio-col-summary__legend-val">${esc(fmt(val))}</span>
        <span class="myio-col-summary__legend-pct">${pct}</span>
      </div>`;
    })
    .join('');
  return `<div class="myio-col-summary__legend">${rows}</div>`;
}

function buildInner(): string {
  if (!_state) return '';
  const { data, fmt, pd } = _state;
  const visible = visibleDevices();
  const count = visible.length;
  const total = visible.reduce((s, v) => s + (Number(v.d.value) || 0), 0);
  const avg = count ? total / count : 0;

  const periodRow = data.periodLabel
    ? `<div class="myio-col-summary__kpi">
         <span class="myio-col-summary__kpi-label">Período</span>
         <span class="myio-col-summary__kpi-value">${esc(data.periodLabel)}</span>
       </div>`
    : '';

  const kpis = `<div class="myio-col-summary__kpis">
      ${periodRow}
      <div class="myio-col-summary__kpi">
        <span class="myio-col-summary__kpi-label">Dispositivos</span>
        <span class="myio-col-summary__kpi-value">${count}</span>
      </div>
      <div class="myio-col-summary__kpi">
        <span class="myio-col-summary__kpi-label">Consumo médio</span>
        <span class="myio-col-summary__kpi-value myio-col-summary__kpi-value--accent">${esc(
          fmt(avg)
        )}</span>
      </div>
      <div class="myio-col-summary__kpi">
        <span class="myio-col-summary__kpi-label">Consumo total</span>
        <span class="myio-col-summary__kpi-value">${esc(fmt(total))}</span>
      </div>
    </div>`;

  if (!data.devices.length) {
    return `${kpis}<div class="myio-col-summary__empty">Nenhum dispositivo.</div>`;
  }

  // 3 lists — computed from the visible (non-excluded) devices.
  const desc = visible.slice().sort((a, b) => (Number(b.d.value) || 0) - (Number(a.d.value) || 0));
  const top3 = desc.slice(0, 3);
  const bottom3 = desc.slice(-3).reverse();
  const near3 = visible
    .slice()
    .sort(
      (a, b) =>
        Math.abs((Number(a.d.value) || 0) - avg) - Math.abs((Number(b.d.value) || 0) - avg)
    )
    .slice(0, 3);

  const row = (v: { d: ColumnSummaryDevice; idx: number }) => `
    <div class="myio-col-summary__row">
      <span class="myio-col-summary__name" title="${esc(v.d.name)}">${esc(v.d.name)}</span>
      <span class="myio-col-summary__val">${esc(fmt(Number(v.d.value) || 0))}</span>
      <span class="myio-col-summary__pct">${fmtPct(Number(v.d.value) || 0, total, pd)}</span>
    </div>`;

  const group = (label: string, list: { d: ColumnSummaryDevice; idx: number }[]) =>
    list.length
      ? `<div class="myio-col-summary__group">
           <span class="myio-col-summary__group-label">${label}</span>
           ${list.map(row).join('')}
         </div>`
      : '';

  return `${kpis}
    <div class="myio-col-summary__body">
      <div class="myio-col-summary__chart">
        <div class="myio-col-summary__chart-title">Distribuição — ${count} dispositivos</div>
        <p class="myio-col-summary__chart-hint">Passe o mouse para destacar · clique na lista para remover da pizza</p>
        ${buildPieSvg(visible, total)}
      </div>
      ${buildLegend(total)}
      <div class="myio-col-summary__lists">
        ${group('▲ 3 maiores', top3)}
        ${group('▼ 3 menores', bottom3)}
        ${group('● 3 na média', near3)}
      </div>
    </div>
    <div class="myio-col-summary__footer">
      <span class="myio-col-summary__footer-label">Consumo Total · ${count} dispositivos</span>
      <span class="myio-col-summary__footer-value">${esc(fmt(total))}</span>
    </div>`;
}

// ============================================
// Interactivity
// ============================================

function setHighlight(idx: string | null): void {
  if (!_rootEl) return;
  _rootEl.querySelectorAll('.is-hl').forEach((el) => el.classList.remove('is-hl'));
  if (idx == null) return;
  _rootEl
    .querySelectorAll(`[data-idx="${idx}"]`)
    .forEach((el) => el.classList.add('is-hl'));
}

function rerender(): void {
  if (!_rootEl) return;
  _rootEl.innerHTML = buildInner();
}

function wireRoot(root: HTMLElement): void {
  // Delegated listeners on the stable .myio-col-summary root — survive re-renders.
  root.addEventListener('mouseover', (e) => {
    const el = (e.target as HTMLElement)?.closest?.('[data-idx]') as HTMLElement | null;
    setHighlight(el ? el.getAttribute('data-idx') : null);
  });
  root.addEventListener('mouseout', (e) => {
    const el = (e.target as HTMLElement)?.closest?.('[data-idx]');
    if (el) setHighlight(null);
  });
  root.addEventListener('click', (e) => {
    const legendRow = (e.target as HTMLElement)?.closest?.(
      '.myio-col-summary__legend-row'
    ) as HTMLElement | null;
    if (!legendRow || !_state) return;
    const idx = Number(legendRow.getAttribute('data-idx'));
    if (!Number.isInteger(idx)) return;
    if (_state.excluded.has(idx)) _state.excluded.delete(idx);
    else _state.excluded.add(idx);
    rerender();
  });
}

// ============================================
// Public API
// ============================================

export const ColumnSummaryTooltip = {
  /** Shows the column summary tooltip anchored to the trigger element. */
  show(triggerElement: HTMLElement, data: ColumnSummaryData): void {
    injectCSS();
    _state = {
      data: data && Array.isArray(data.devices) ? data : { ...data, devices: [] },
      excluded: new Set<number>(),
      fmt: data.formatValue || defaultFormatter(data.unit || ''),
      pd: resolvePercentDecimals(data.percentDecimals),
    };
    InfoTooltip.show(triggerElement, {
      icon: '📊',
      title: data.title ? `Resumo — ${data.title}` : 'Resumo da Coluna',
      content: `<div class="myio-col-summary">${buildInner()}</div>`,
    });
    // Wire interactivity after InfoTooltip renders the content into the DOM.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        const roots = document.querySelectorAll<HTMLElement>(
          '.myio-info-tooltip .myio-col-summary'
        );
        _rootEl = roots.length ? roots[roots.length - 1] : null;
        if (_rootEl) wireRoot(_rootEl);
      });
    }
  },

  /** Hides the tooltip immediately. */
  hide(): void {
    InfoTooltip.hide();
  },

  /** Starts the delayed hide (use on mouseleave). */
  startDelayedHide(): void {
    InfoTooltip.startDelayedHide();
  },

  /**
   * Attaches hover behavior to a trigger element. `getData` is called on each
   * hover so the summary always reflects the latest data. Returns a cleanup fn.
   */
  attach(triggerElement: HTMLElement, getData: () => ColumnSummaryData): () => void {
    injectCSS();
    const handleEnter = () => {
      ColumnSummaryTooltip.show(triggerElement, getData());
    };
    const handleLeave = () => {
      InfoTooltip.startDelayedHide();
    };
    triggerElement.addEventListener('mouseenter', handleEnter);
    triggerElement.addEventListener('mouseleave', handleLeave);
    return () => {
      triggerElement.removeEventListener('mouseenter', handleEnter);
      triggerElement.removeEventListener('mouseleave', handleLeave);
    };
  },
};

export default ColumnSummaryTooltip;
