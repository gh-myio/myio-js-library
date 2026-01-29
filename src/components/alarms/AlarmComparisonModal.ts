/**
 * Alarm Comparison Modal Component
 * RFC-0153: Premium comparison for alarm activity over a time period
 */

import type { Alarm, AlarmSeverity, AlarmState } from '../../types/alarm';

export interface AlarmComparisonModalParams {
  /** Alarms to compare */
  alarms: Alarm[];
  /** Start date in ISO format */
  startDate: string;
  /** End date in ISO format */
  endDate: string;
  /** Theme */
  theme?: 'dark' | 'light';
  /** Container element or selector */
  container?: HTMLElement | string;
  /** Locale */
  locale?: 'pt-BR' | 'en-US';
  /** Callback when modal closes */
  onClose?: () => void;
}

export interface AlarmComparisonModalInstance {
  destroy: () => void;
}

interface SummaryStats {
  total: number;
  openCritical: number;
  openHigh: number;
  last24h: number;
  byState: Record<string, number>;
  bySeverity: Record<string, number>;
  trend: number[];
  trendLabels: string[];
}

const SEVERITY_ORDER: AlarmSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const STATE_ORDER: AlarmState[] = ['OPEN', 'ACK', 'SNOOZED', 'ESCALATED', 'CLOSED'];

export function openAlarmComparisonModal(
  params: AlarmComparisonModalParams
): AlarmComparisonModalInstance {
  const modalId = `myio-alarm-comparison-${Date.now()}`;
  const theme = params.theme || 'dark';
  const locale = params.locale || 'pt-BR';

  const container =
    typeof params.container === 'string'
      ? (document.querySelector(params.container) as HTMLElement)
      : params.container || document.body;

  const wrapper = document.createElement('div');
  wrapper.id = modalId;
  container.appendChild(wrapper);

  const state = {
    theme,
    locale,
    isMaximized: false,
    startDate: params.startDate,
    endDate: params.endDate,
    alarms: params.alarms || [],
  };

  render(wrapper, modalId, state);
  bindEvents(wrapper, modalId, state, params.onClose);

  return {
    destroy: () => {
      wrapper.remove();
      params.onClose?.();
    },
  };
}

function render(container: HTMLElement, modalId: string, state: {
  theme: 'dark' | 'light';
  locale: string;
  isMaximized: boolean;
  startDate: string;
  endDate: string;
  alarms: Alarm[];
}): void {
  const colors = getThemeColors(state.theme);
  const stats = buildStats(state.alarms, state.startDate, state.endDate);

  const trendSvg = buildTrendSvg(stats.trend, colors.accent, colors.border);
  const byStateHtml = buildBars(stats.byState, STATE_ORDER, colors);
  const bySeverityHtml = buildBars(stats.bySeverity, SEVERITY_ORDER, colors);

  const isMax = state.isMaximized;
  const contentRadius = isMax ? '0' : '12px';

  container.innerHTML = `
    <div class="myio-alarm-compare-overlay">
      <div class="myio-alarm-compare-content" style="
        background: ${colors.surface};
        border-radius: ${contentRadius};
      ">
        <div class="myio-alarm-compare-header">
          <div class="title">
            🚨 Comparação de Alarmes (${state.alarms.length})
          </div>
          <div class="actions">
            <button id="${modalId}-theme" title="Alternar tema">${state.theme === 'dark' ? '☀️' : '🌙'}</button>
            <button id="${modalId}-max" title="${isMax ? 'Restaurar' : 'Maximizar'}">${isMax ? '🗗' : '🗖'}</button>
            <button id="${modalId}-close" title="Fechar">×</button>
          </div>
        </div>

        <div class="myio-alarm-compare-body">
          <div class="range-row">
            <div class="range-pill">Período: ${formatDate(state.startDate, state.locale)} → ${formatDate(state.endDate, state.locale)}</div>
            <div class="range-pill muted">Total: ${stats.total} alarmes</div>
          </div>

          <div class="summary-row">
            ${summaryCard('Total', stats.total, colors)}
            ${summaryCard('Open Critical', stats.openCritical, colors)}
            ${summaryCard('Open High', stats.openHigh, colors)}
            ${summaryCard('Last 24 Hours', stats.last24h, colors)}
          </div>

          <div class="grid-row">
            <div class="panel">
              <h4>Alarm Trend</h4>
              <div class="sparkline">
                ${trendSvg}
              </div>
              <div class="sparkline-labels">
                ${stats.trendLabels.map((l) => `<span>${l}</span>`).join('')}
              </div>
            </div>
            <div class="panel">
              <h4>Alarms by State</h4>
              ${byStateHtml}
            </div>
            <div class="panel">
              <h4>Alarms by Severity</h4>
              ${bySeverityHtml}
            </div>
          </div>

          <div class="panel">
            <h4>Selected Alarms</h4>
            <div class="alarm-list">
              ${state.alarms.map((a) => `
                <div class="alarm-row">
                  <div class="alarm-title">${escapeHtml(a.title || a.id)}</div>
                  <div class="alarm-meta">${escapeHtml(a.customerName || '')}</div>
                  <div class="alarm-meta">${escapeHtml(a.severity)}</div>
                  <div class="alarm-meta">${escapeHtml(a.state)}</div>
                  <div class="alarm-meta">${formatDate(a.lastOccurrence, state.locale, true)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
    <style>
      #${modalId} .myio-alarm-compare-overlay {
        position: fixed; inset: 0; z-index: 9998;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
      }
      #${modalId} .myio-alarm-compare-content {
        width: ${state.isMaximized ? '100%' : '92%'};
        max-width: ${state.isMaximized ? '100%' : '1200px'};
        height: ${state.isMaximized ? '100%' : 'auto'};
        max-height: ${state.isMaximized ? '100%' : '92vh'};
        display: flex; flex-direction: column; overflow: hidden;
        border: 1px solid ${colors.border};
        font-family: 'Roboto', Arial, sans-serif;
      }
      #${modalId} .myio-alarm-compare-header {
        background: #3e1a7d; color: white;
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 12px;
      }
      #${modalId} .myio-alarm-compare-header .title {
        font-size: 16px; font-weight: 600;
      }
      #${modalId} .myio-alarm-compare-header .actions button {
        background: transparent; border: none; color: rgba(255,255,255,0.9);
        padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 16px;
      }
      #${modalId} .myio-alarm-compare-header .actions button:hover {
        background: rgba(255,255,255,0.12);
      }
      #${modalId} .myio-alarm-compare-body {
        padding: 16px; overflow-y: auto; flex: 1; color: ${colors.text};
      }
      #${modalId} .range-row {
        display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;
      }
      #${modalId} .range-pill {
        padding: 6px 10px; border-radius: 999px; border: 1px solid ${colors.border};
        background: ${colors.surfaceElevated};
        font-size: 12px;
      }
      #${modalId} .range-pill.muted {
        color: ${colors.textMuted};
      }
      #${modalId} .summary-row {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 10px; margin-bottom: 16px;
      }
      #${modalId} .summary-card {
        padding: 12px; border-radius: 10px;
        background: ${colors.surfaceElevated};
        border: 1px solid ${colors.border};
      }
      #${modalId} .summary-card .label { font-size: 11px; color: ${colors.textMuted}; }
      #${modalId} .summary-card .value { font-size: 18px; font-weight: 700; }
      #${modalId} .grid-row {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 12px; margin-bottom: 16px;
      }
      #${modalId} .panel {
        padding: 12px; border-radius: 10px;
        background: ${colors.surfaceElevated};
        border: 1px solid ${colors.border};
      }
      #${modalId} .panel h4 {
        margin: 0 0 10px; font-size: 13px; color: ${colors.text};
      }
      #${modalId} .sparkline { height: 90px; display: flex; align-items: center; }
      #${modalId} .sparkline-labels {
        display: flex; justify-content: space-between; font-size: 10px; color: ${colors.textMuted};
      }
      #${modalId} .bar-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
      #${modalId} .bar-label { width: 90px; font-size: 11px; color: ${colors.textMuted}; }
      #${modalId} .bar-track {
        flex: 1; height: 8px; background: ${colors.border}; border-radius: 999px; overflow: hidden;
      }
      #${modalId} .bar-fill { height: 100%; background: ${colors.accent}; }
      #${modalId} .bar-value { width: 40px; text-align: right; font-size: 11px; color: ${colors.text}; }
      #${modalId} .alarm-list {
        display: grid; gap: 6px;
      }
      #${modalId} .alarm-row {
        display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
        gap: 8px; padding: 8px; border-radius: 8px;
        background: ${colors.surface}; border: 1px solid ${colors.border};
        font-size: 12px;
      }
      #${modalId} .alarm-title { font-weight: 600; color: ${colors.text}; }
      #${modalId} .alarm-meta { color: ${colors.textMuted}; }
    </style>
  `;
}

function buildStats(alarms: Alarm[], startDate: string, endDate: string): SummaryStats {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;

  const byState: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  const inRange = alarms.filter((a) => {
    const ts = toTime(a.lastOccurrence || a.firstOccurrence);
    return ts >= start && ts <= end;
  });

  let openCritical = 0;
  let openHigh = 0;
  let last24hCount = 0;

  inRange.forEach((a) => {
    byState[a.state] = (byState[a.state] || 0) + 1;
    bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;

    if (a.state === 'OPEN' && a.severity === 'CRITICAL') openCritical++;
    if (a.state === 'OPEN' && a.severity === 'HIGH') openHigh++;
    if (toTime(a.lastOccurrence) >= last24h) last24hCount++;
  });

  const { trend, labels } = buildTrend(inRange, start, end);

  return {
    total: inRange.length,
    openCritical,
    openHigh,
    last24h: last24hCount,
    byState,
    bySeverity,
    trend,
    trendLabels: labels,
  };
}

function buildTrend(alarms: Alarm[], start: number, end: number): { trend: number[]; labels: string[] } {
  const days: number[] = [];
  const labels: string[] = [];

  const oneDay = 24 * 60 * 60 * 1000;
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  for (let t = startDay.getTime(); t <= endDay.getTime(); t += oneDay) {
    days.push(t);
    const d = new Date(t);
    labels.push(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const buckets = days.map((d) => {
    const next = d + oneDay - 1;
    return alarms.filter((a) => {
      const ts = toTime(a.lastOccurrence || a.firstOccurrence);
      return ts >= d && ts <= next;
    }).length;
  });

  return { trend: buckets, labels };
}

function buildTrendSvg(values: number[], stroke: string, grid: string): string {
  if (!values.length) {
    return `<div style="color:#94a3b8;font-size:12px;">Sem dados</div>`;
  }

  const width = 320;
  const height = 80;
  const pad = 6;
  const maxVal = Math.max(...values, 1);
  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
    const y = height - pad - (v / maxVal) * (height - pad * 2);
    return `${x},${y}`;
  });

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <line x1="0" y1="${height - pad}" x2="${width}" y2="${height - pad}" stroke="${grid}" stroke-width="1"/>
      <polyline fill="none" stroke="${stroke}" stroke-width="2.5" points="${points.join(' ')}" />
      ${points.map((p) => {
        const [x, y] = p.split(',');
        return `<circle cx="${x}" cy="${y}" r="3" fill="${stroke}" />`;
      }).join('')}
    </svg>
  `;
}

function buildBars(
  data: Record<string, number>,
  order: Array<AlarmSeverity | AlarmState>,
  colors: ReturnType<typeof getThemeColors>
): string {
  const maxVal = Math.max(1, ...Object.values(data));
  return order
    .filter((key) => data[key] !== undefined)
    .map((key) => {
      const value = data[key] || 0;
      const pct = Math.round((value / maxVal) * 100);
      return `
        <div class="bar-row">
          <span class="bar-label">${escapeHtml(String(key))}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <span class="bar-value">${value}</span>
        </div>
      `;
    })
    .join('');
}

function summaryCard(label: string, value: number, colors: ReturnType<typeof getThemeColors>): string {
  return `
    <div class="summary-card">
      <div class="label">${label}</div>
      <div class="value" style="color:${colors.text}">${value}</div>
    </div>
  `;
}

function formatDate(value: string | number | undefined, locale: string, withTime = false): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  if (withTime) {
    return d.toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toTime(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function getThemeColors(theme: 'dark' | 'light') {
  if (theme === 'dark') {
    return {
      surface: '#1e293b',
      surfaceElevated: '#0f172a',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      border: '#334155',
      accent: '#8b5cf6',
    };
  }

  return {
    surface: '#ffffff',
    surfaceElevated: '#f8fafc',
    text: '#1e293b',
    textMuted: '#64748b',
    border: '#e2e8f0',
    accent: '#7c3aed',
  };
}

function bindEvents(
  container: HTMLElement,
  modalId: string,
  state: { theme: 'dark' | 'light'; isMaximized: boolean },
  onClose?: () => void
): void {
  const closeBtn = container.querySelector(`#${modalId}-close`) as HTMLButtonElement | null;
  const closeBtn2 = container.querySelector(`#${modalId}-close-btn`) as HTMLButtonElement | null;
  const themeBtn = container.querySelector(`#${modalId}-theme`) as HTMLButtonElement | null;
  const maxBtn = container.querySelector(`#${modalId}-max`) as HTMLButtonElement | null;
  const overlay = container.querySelector('.myio-alarm-compare-overlay') as HTMLElement | null;

  const close = () => {
    container.remove();
    onClose?.();
  };

  closeBtn?.addEventListener('click', close);
  closeBtn2?.addEventListener('click', close);

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  themeBtn?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    render(container, modalId, state as any);
    bindEvents(container, modalId, state, onClose);
  });

  maxBtn?.addEventListener('click', () => {
    state.isMaximized = !state.isMaximized;
    render(container, modalId, state as any);
    bindEvents(container, modalId, state, onClose);
  });
}
