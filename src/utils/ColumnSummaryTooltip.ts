/**
 * ColumnSummaryTooltip - Premium summary tooltip for a device column.
 *
 * Inspired by EnergySummaryTooltip. Renders inside the library InfoTooltip
 * panel and injects its own content CSS (fully self-contained). Shows:
 * - the column's search period
 * - total device count
 * - average and total consumption
 * - top 3 / bottom 3 / 3-closest-to-average devices, each with its % of the total
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
    ${group('▲ 3 maiores', top3)}
    ${group('▼ 3 menores', bottom3)}
    ${group('● 3 na média', near3)}
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
