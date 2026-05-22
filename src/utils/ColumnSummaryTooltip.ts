/**
 * ColumnSummaryTooltip - Premium summary tooltip for a device column.
 *
 * Inspired by EnergySummaryTooltip. Renders inside the library InfoTooltip
 * panel and injects its own content CSS (fully self-contained).
 *
 * Compact view: search period, device count, average/total consumption and
 * the top 3 / bottom 3 / 3-closest-to-average devices.
 *
 * Maximized view (InfoTooltip maximize button): the extra space is used for a
 * pie chart of ALL devices with a scrollable legend, plus the three lists laid
 * out side by side. The maximized layout is driven purely by CSS reacting to
 * the `.myio-info-tooltip.maximized` class — no InfoTooltip API change needed.
 *
 * @example
 * const cleanup = ColumnSummaryTooltip.attach(iconEl, () => ({
 *   title: 'Lojas',
 *   periodLabel: '01/05/2026 — 21/05/2026',
 *   unit: 'kWh',
 *   devices: items.map((i) => ({ name: i.label, value: i.value })),
 *   formatValue: (v) => MyIO.formatEnergy(v),
 * }));
 * // later: cleanup();
 */

import { InfoTooltip } from './InfoTooltip';

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
  max-width: 300px;
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
.myio-col-summary__kpi-value--accent {
  font-size: 14px; color: #3e1a7d;
}
.myio-col-summary__body { display: block; }
.myio-col-summary__lists { display: flex; flex-direction: column; }
.myio-col-summary__group {
  display: flex; flex-direction: column; gap: 1px; margin-top: 8px;
}
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
.myio-col-summary__val {
  flex: 0 0 auto; font-weight: 700; color: #16a34a; text-align: right;
}
.myio-col-summary__pct {
  flex: 0 0 auto; min-width: 44px; text-align: right;
  font-size: 10px; font-weight: 600; color: #64748b;
}
.myio-col-summary__empty {
  padding: 14px 0; text-align: center; font-style: italic;
  font-size: 11px; color: #94a3b8;
}

/* Pie chart — hidden in the compact view, revealed when maximized. */
.myio-col-summary__chart { display: none; }
.myio-col-summary__chart-title {
  font-size: 11px; font-weight: 800; letter-spacing: 0.3px;
  text-transform: uppercase; color: #3e1a7d; margin-bottom: 8px;
}
.myio-col-summary__chart-body {
  display: flex; gap: 16px; align-items: flex-start;
}
.myio-col-summary__pie {
  width: 190px; height: 190px; border-radius: 50%; flex-shrink: 0;
  box-shadow: 0 2px 12px rgba(0,0,0,0.18);
}
.myio-col-summary__legend {
  flex: 1 1 auto; min-width: 0; max-height: 300px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 1px;
}
.myio-col-summary__legend-row {
  display: flex; align-items: center; gap: 6px; padding: 2px 0; font-size: 11px;
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

/* Maximized — use the extra space: widen, show the pie chart, lists side-by-side. */
.myio-info-tooltip.maximized .myio-col-summary { max-width: none; }
.myio-info-tooltip.maximized .myio-col-summary__chart {
  display: block; margin-bottom: 16px;
  padding-bottom: 14px; border-bottom: 1px solid #e3d9f3;
}
.myio-info-tooltip.maximized .myio-col-summary__lists {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;
}
.myio-info-tooltip.maximized .myio-col-summary__group { margin-top: 0; }
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

function fmtPct(value: number, total: number): string {
  const p = total > 0 ? ((Number(value) || 0) / total) * 100 : 0;
  return p.toFixed(1).replace('.', ',') + '%';
}

// Builds the pie chart (conic-gradient) + scrollable legend for ALL devices.
function buildPieChart(
  devices: ColumnSummaryDevice[],
  total: number,
  fmt: (v: number) => string
): string {
  const sorted = devices
    .slice()
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

  if (total <= 0 || !sorted.length) {
    return `<div class="myio-col-summary__chart">
      <div class="myio-col-summary__empty">Sem dados para o gráfico.</div>
    </div>`;
  }

  let acc = 0;
  const stops: string[] = [];
  const legend: string[] = [];
  sorted.forEach((d, i) => {
    const v = Number(d.value) || 0;
    const color = PIE_COLORS[i % PIE_COLORS.length];
    const start = (acc / total) * 360;
    acc += v;
    const end = (acc / total) * 360;
    stops.push(`${color} ${start.toFixed(3)}deg ${end.toFixed(3)}deg`);
    legend.push(`<div class="myio-col-summary__legend-row">
      <span class="myio-col-summary__legend-dot" style="background:${color};"></span>
      <span class="myio-col-summary__legend-name" title="${esc(d.name)}">${esc(d.name)}</span>
      <span class="myio-col-summary__legend-val">${esc(fmt(v))}</span>
      <span class="myio-col-summary__legend-pct">${fmtPct(v, total)}</span>
    </div>`);
  });

  return `<div class="myio-col-summary__chart">
    <div class="myio-col-summary__chart-title">Distribuição — ${sorted.length} dispositivos</div>
    <div class="myio-col-summary__chart-body">
      <div class="myio-col-summary__pie" style="background: conic-gradient(${stops.join(', ')});"></div>
      <div class="myio-col-summary__legend">${legend.join('')}</div>
    </div>
  </div>`;
}

function buildContent(data: ColumnSummaryData): string {
  const devices = Array.isArray(data.devices) ? data.devices.slice() : [];
  const fmt = data.formatValue || defaultFormatter(data.unit || '');
  const count = devices.length;
  const total = devices.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const avg = count ? total / count : 0;

  const periodRow = data.periodLabel
    ? `<div class="myio-col-summary__kpi">
         <span class="myio-col-summary__kpi-label">Período</span>
         <span class="myio-col-summary__kpi-value">${esc(data.periodLabel)}</span>
       </div>`
    : '';

  if (!count) {
    return `<div class="myio-col-summary">
      <div class="myio-col-summary__kpis">
        ${periodRow}
        <div class="myio-col-summary__kpi">
          <span class="myio-col-summary__kpi-label">Dispositivos</span>
          <span class="myio-col-summary__kpi-value">0</span>
        </div>
      </div>
      <div class="myio-col-summary__empty">Nenhum dispositivo.</div>
    </div>`;
  }

  const desc = devices
    .slice()
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  const top3 = desc.slice(0, 3);
  const bottom3 = desc.slice(-3).reverse();
  const near3 = devices
    .slice()
    .sort(
      (a, b) =>
        Math.abs((Number(a.value) || 0) - avg) - Math.abs((Number(b.value) || 0) - avg)
    )
    .slice(0, 3);

  const row = (d: ColumnSummaryDevice) => `
    <div class="myio-col-summary__row">
      <span class="myio-col-summary__name" title="${esc(d.name)}">${esc(d.name)}</span>
      <span class="myio-col-summary__val">${esc(fmt(Number(d.value) || 0))}</span>
      <span class="myio-col-summary__pct">${fmtPct(Number(d.value) || 0, total)}</span>
    </div>`;

  const group = (label: string, list: ColumnSummaryDevice[]) =>
    list.length
      ? `<div class="myio-col-summary__group">
           <span class="myio-col-summary__group-label">${label}</span>
           ${list.map(row).join('')}
         </div>`
      : '';

  return `<div class="myio-col-summary">
    <div class="myio-col-summary__kpis">
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
    </div>
    <div class="myio-col-summary__body">
      ${buildPieChart(devices, total, fmt)}
      <div class="myio-col-summary__lists">
        ${group('▲ 3 maiores', top3)}
        ${group('▼ 3 menores', bottom3)}
        ${group('● 3 na média', near3)}
      </div>
    </div>
  </div>`;
}

// ============================================
// Public API
// ============================================

export const ColumnSummaryTooltip = {
  /** Shows the column summary tooltip anchored to the trigger element. */
  show(triggerElement: HTMLElement, data: ColumnSummaryData): void {
    injectCSS();
    InfoTooltip.show(triggerElement, {
      icon: '📊',
      title: data.title ? `Resumo — ${data.title}` : 'Resumo da Coluna',
      content: buildContent(data),
    });
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
