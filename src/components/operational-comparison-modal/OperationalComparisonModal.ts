/**
 * Operational Comparison Modal Component
 * RFC-0157: Premium comparison for operational metrics (Availability, MTBF, MTTR)
 */

export interface OperationalDevice {
  id: string;
  name: string;
  customerName: string;
  status: 'online' | 'offline' | 'maintenance' | 'warning';
  equipmentType?: 'escada' | 'elevador' | 'other';
  availability: number;
  mtbf: number;
  mttr: number;
}

export interface OperationalComparisonModalParams {
  /** Devices to compare */
  devices: OperationalDevice[];
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

export interface OperationalComparisonModalInstance {
  destroy: () => void;
}

interface SummaryStats {
  totalDevices: number;
  avgAvailability: number;
  avgMtbf: number;
  avgMttr: number;
  minAvailability: { value: number; device: string };
  maxAvailability: { value: number; device: string };
  minMtbf: { value: number; device: string };
  maxMtbf: { value: number; device: string };
  byStatus: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  online: '#22c55e',
  offline: '#ef4444',
  maintenance: '#f59e0b',
  warning: '#eab308',
};

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  maintenance: 'Manutenção',
  warning: 'Alerta',
};

export function openOperationalComparisonModal(
  params: OperationalComparisonModalParams
): OperationalComparisonModalInstance {
  const modalId = `myio-operational-comparison-${Date.now()}`;
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
    devices: params.devices || [],
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

function render(
  container: HTMLElement,
  modalId: string,
  state: {
    theme: 'dark' | 'light';
    locale: string;
    isMaximized: boolean;
    startDate: string;
    endDate: string;
    devices: OperationalDevice[];
  }
): void {
  const colors = getThemeColors(state.theme);
  const stats = buildStats(state.devices);

  const isMax = state.isMaximized;
  const contentRadius = isMax ? '0' : '12px';

  // Sort devices by availability for comparison chart
  const sortedByAvailability = [...state.devices].sort((a, b) => b.availability - a.availability);
  const sortedByMtbf = [...state.devices].sort((a, b) => b.mtbf - a.mtbf);
  const sortedByMttr = [...state.devices].sort((a, b) => a.mttr - b.mttr); // Lower MTTR is better

  container.innerHTML = `
    <div class="myio-op-compare-overlay">
      <div class="myio-op-compare-content" style="
        background: ${colors.surface};
        border-radius: ${contentRadius};
      ">
        <div class="myio-op-compare-header">
          <div class="title">
            📊 Comparação Operacional (${state.devices.length} equipamentos)
          </div>
          <div class="actions">
            <button id="${modalId}-theme" title="Alternar tema">${state.theme === 'dark' ? '☀️' : '🌙'}</button>
            <button id="${modalId}-max" title="${isMax ? 'Restaurar' : 'Maximizar'}">${isMax ? '🗗' : '🗖'}</button>
            <button id="${modalId}-close" title="Fechar">×</button>
          </div>
        </div>

        <div class="myio-op-compare-body">
          <div class="range-row">
            <div class="range-pill">Período: ${formatDate(state.startDate, state.locale)} → ${formatDate(state.endDate, state.locale)}</div>
            <div class="range-pill muted">Total: ${stats.totalDevices} equipamentos</div>
          </div>

          <!-- Summary Cards -->
          <div class="summary-row">
            ${summaryCard('Disp. Média', `${stats.avgAvailability.toFixed(1)}%`, getAvailabilityColor(stats.avgAvailability), colors)}
            ${summaryCard('MTBF Médio', `${stats.avgMtbf.toFixed(0)}h`, '#3b82f6', colors)}
            ${summaryCard('MTTR Médio', `${stats.avgMttr.toFixed(1)}h`, '#f59e0b', colors)}
            ${summaryCard('Online', `${stats.byStatus['online'] || 0}`, '#22c55e', colors)}
          </div>

          <!-- Best/Worst Cards -->
          <div class="highlight-row">
            <div class="highlight-card best">
              <div class="highlight-icon">🏆</div>
              <div class="highlight-info">
                <div class="highlight-label">Melhor Disponibilidade</div>
                <div class="highlight-value">${stats.maxAvailability.device}</div>
                <div class="highlight-metric">${stats.maxAvailability.value.toFixed(1)}%</div>
              </div>
            </div>
            <div class="highlight-card worst">
              <div class="highlight-icon">⚠️</div>
              <div class="highlight-info">
                <div class="highlight-label">Menor Disponibilidade</div>
                <div class="highlight-value">${stats.minAvailability.device}</div>
                <div class="highlight-metric">${stats.minAvailability.value.toFixed(1)}%</div>
              </div>
            </div>
            <div class="highlight-card best">
              <div class="highlight-icon">⏱️</div>
              <div class="highlight-info">
                <div class="highlight-label">Maior MTBF</div>
                <div class="highlight-value">${stats.maxMtbf.device}</div>
                <div class="highlight-metric">${stats.maxMtbf.value.toFixed(0)}h</div>
              </div>
            </div>
          </div>

          <!-- Comparison Charts -->
          <div class="charts-row">
            <div class="chart-panel">
              <h4>Disponibilidade (%)</h4>
              ${buildHorizontalBarChart(sortedByAvailability, 'availability', '%', colors, getAvailabilityColor)}
            </div>
            <div class="chart-panel">
              <h4>MTBF (horas)</h4>
              ${buildHorizontalBarChart(sortedByMtbf, 'mtbf', 'h', colors, () => '#3b82f6')}
            </div>
            <div class="chart-panel">
              <h4>MTTR (horas)</h4>
              ${buildHorizontalBarChart(sortedByMttr, 'mttr', 'h', colors, () => '#f59e0b', true)}
            </div>
          </div>

          <!-- Device Table -->
          <div class="panel">
            <h4>Detalhes dos Equipamentos</h4>
            <div class="device-table">
              <div class="device-table-header">
                <div class="col-name">Equipamento</div>
                <div class="col-customer">Cliente</div>
                <div class="col-status">Status</div>
                <div class="col-metric">Disp.</div>
                <div class="col-metric">MTBF</div>
                <div class="col-metric">MTTR</div>
              </div>
              ${state.devices.map((d) => `
                <div class="device-table-row">
                  <div class="col-name">${escapeHtml(d.name)}</div>
                  <div class="col-customer">${escapeHtml(d.customerName)}</div>
                  <div class="col-status">
                    <span class="status-badge" style="background: ${STATUS_COLORS[d.status] || '#6b7280'}20; color: ${STATUS_COLORS[d.status] || '#6b7280'};">
                      ${STATUS_LABELS[d.status] || d.status}
                    </span>
                  </div>
                  <div class="col-metric" style="color: ${getAvailabilityColor(d.availability)};">${d.availability.toFixed(1)}%</div>
                  <div class="col-metric" style="color: #3b82f6;">${d.mtbf.toFixed(0)}h</div>
                  <div class="col-metric" style="color: #f59e0b;">${d.mttr.toFixed(1)}h</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
    <style>
      #${modalId} .myio-op-compare-overlay {
        position: fixed; inset: 0; z-index: 9998;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
      }
      #${modalId} .myio-op-compare-content {
        width: ${state.isMaximized ? '100%' : '94%'};
        max-width: ${state.isMaximized ? '100%' : '1400px'};
        height: ${state.isMaximized ? '100%' : 'auto'};
        max-height: ${state.isMaximized ? '100%' : '92vh'};
        display: flex; flex-direction: column; overflow: hidden;
        border: 1px solid ${colors.border};
        font-family: 'Roboto', Arial, sans-serif;
      }
      #${modalId} .myio-op-compare-header {
        background: linear-gradient(135deg, #3e1a7d, #5a2cb8);
        color: white;
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 16px;
      }
      #${modalId} .myio-op-compare-header .title {
        font-size: 16px; font-weight: 600;
      }
      #${modalId} .myio-op-compare-header .actions button {
        background: transparent; border: none; color: rgba(255,255,255,0.9);
        padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 16px;
      }
      #${modalId} .myio-op-compare-header .actions button:hover {
        background: rgba(255,255,255,0.12);
      }
      #${modalId} .myio-op-compare-body {
        padding: 16px; overflow-y: auto; flex: 1; color: ${colors.text};
      }
      #${modalId} .range-row {
        display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;
      }
      #${modalId} .range-pill {
        padding: 6px 12px; border-radius: 999px; border: 1px solid ${colors.border};
        background: ${colors.surfaceElevated};
        font-size: 12px;
      }
      #${modalId} .range-pill.muted { color: ${colors.textMuted}; }

      #${modalId} .summary-row {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px; margin-bottom: 16px;
      }
      #${modalId} .summary-card {
        padding: 14px; border-radius: 10px;
        background: ${colors.surfaceElevated};
        border: 1px solid ${colors.border};
        text-align: center;
      }
      #${modalId} .summary-card .label { font-size: 11px; color: ${colors.textMuted}; margin-bottom: 4px; }
      #${modalId} .summary-card .value { font-size: 22px; font-weight: 700; }

      #${modalId} .highlight-row {
        display: flex; flex-wrap: wrap;
        gap: 12px; margin-bottom: 16px;
      }
      #${modalId} .highlight-card {
        flex: 1 1 200px;
        display: flex; align-items: center; gap: 12px;
        padding: 12px 16px; border-radius: 10px;
        background: ${colors.surfaceElevated};
        border: 1px solid ${colors.border};
      }
      #${modalId} .highlight-card.best { border-left: 3px solid #22c55e; }
      #${modalId} .highlight-card.worst { border-left: 3px solid #ef4444; }
      #${modalId} .highlight-icon { font-size: 24px; }
      #${modalId} .highlight-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
      #${modalId} .highlight-label { font-size: 10px; color: ${colors.textMuted}; text-transform: uppercase; line-height: 1; }
      #${modalId} .highlight-value { font-size: 13px; font-weight: 600; color: ${colors.text}; line-height: 1; }
      #${modalId} .highlight-metric { font-size: 16px; font-weight: 700; color: ${colors.accent}; line-height: 1; }

      #${modalId} .charts-row {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 12px; margin-bottom: 16px;
      }
      #${modalId} .chart-panel {
        padding: 14px; border-radius: 10px;
        background: ${colors.surfaceElevated};
        border: 1px solid ${colors.border};
      }
      #${modalId} .chart-panel h4 {
        margin: 0 0 12px; font-size: 13px; color: ${colors.text}; font-weight: 600;
      }

      #${modalId} .bar-row { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
      #${modalId} .bar-label {
        width: 100px; font-size: 11px; color: ${colors.text};
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #${modalId} .bar-track {
        flex: 1; height: 16px; background: ${colors.border}; border-radius: 4px; overflow: hidden;
        position: relative;
      }
      #${modalId} .bar-fill {
        height: 100%; border-radius: 4px;
        transition: width 0.3s ease;
      }
      #${modalId} .bar-value {
        width: 50px; text-align: right; font-size: 12px; font-weight: 600; color: ${colors.text};
      }

      #${modalId} .panel {
        padding: 14px; border-radius: 10px;
        background: ${colors.surfaceElevated};
        border: 1px solid ${colors.border};
      }
      #${modalId} .panel h4 {
        margin: 0 0 12px; font-size: 13px; color: ${colors.text}; font-weight: 600;
      }

      #${modalId} .device-table { display: grid; gap: 4px; }
      #${modalId} .device-table-header {
        display: grid; grid-template-columns: 2fr 1.5fr 100px 70px 70px 70px;
        gap: 8px; padding: 8px 12px;
        background: ${colors.surface};
        border-radius: 6px;
        font-size: 11px; font-weight: 600; color: ${colors.textMuted};
        text-transform: uppercase;
      }
      #${modalId} .device-table-row {
        display: grid; grid-template-columns: 2fr 1.5fr 100px 70px 70px 70px;
        gap: 8px; padding: 10px 12px;
        background: ${colors.surface};
        border: 1px solid ${colors.border};
        border-radius: 6px;
        font-size: 12px;
      }
      #${modalId} .device-table-row:hover {
        background: ${colors.border};
      }
      #${modalId} .col-name { font-weight: 600; color: ${colors.text}; }
      #${modalId} .col-customer { color: ${colors.textMuted}; }
      #${modalId} .col-status { }
      #${modalId} .col-metric { text-align: right; font-weight: 600; }
      #${modalId} .status-badge {
        display: inline-block; padding: 2px 8px; border-radius: 999px;
        font-size: 10px; font-weight: 600;
      }
    </style>
  `;
}

function buildStats(devices: OperationalDevice[]): SummaryStats {
  if (!devices.length) {
    return {
      totalDevices: 0,
      avgAvailability: 0,
      avgMtbf: 0,
      avgMttr: 0,
      minAvailability: { value: 0, device: '-' },
      maxAvailability: { value: 0, device: '-' },
      minMtbf: { value: 0, device: '-' },
      maxMtbf: { value: 0, device: '-' },
      byStatus: {},
    };
  }

  const byStatus: Record<string, number> = {};
  let totalAvailability = 0;
  let totalMtbf = 0;
  let totalMttr = 0;

  let minAvail = { value: Infinity, device: '' };
  let maxAvail = { value: -Infinity, device: '' };
  let minMtbf = { value: Infinity, device: '' };
  let maxMtbf = { value: -Infinity, device: '' };

  devices.forEach((d) => {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    totalAvailability += d.availability;
    totalMtbf += d.mtbf;
    totalMttr += d.mttr;

    if (d.availability < minAvail.value) {
      minAvail = { value: d.availability, device: d.name };
    }
    if (d.availability > maxAvail.value) {
      maxAvail = { value: d.availability, device: d.name };
    }
    if (d.mtbf < minMtbf.value) {
      minMtbf = { value: d.mtbf, device: d.name };
    }
    if (d.mtbf > maxMtbf.value) {
      maxMtbf = { value: d.mtbf, device: d.name };
    }
  });

  return {
    totalDevices: devices.length,
    avgAvailability: totalAvailability / devices.length,
    avgMtbf: totalMtbf / devices.length,
    avgMttr: totalMttr / devices.length,
    minAvailability: minAvail.device ? minAvail : { value: 0, device: '-' },
    maxAvailability: maxAvail.device ? maxAvail : { value: 0, device: '-' },
    minMtbf: minMtbf.device ? minMtbf : { value: 0, device: '-' },
    maxMtbf: maxMtbf.device ? maxMtbf : { value: 0, device: '-' },
    byStatus,
  };
}

function buildHorizontalBarChart(
  devices: OperationalDevice[],
  metric: 'availability' | 'mtbf' | 'mttr',
  unit: string,
  colors: ReturnType<typeof getThemeColors>,
  getColor: (value: number) => string,
  invertScale = false
): string {
  if (!devices.length) {
    return `<div style="color:${colors.textMuted};font-size:12px;">Sem dados</div>`;
  }

  const values = devices.map((d) => d[metric]);
  const maxVal = Math.max(...values, 1);

  return devices
    .map((d) => {
      const value = d[metric];
      const pct = invertScale
        ? Math.max(5, 100 - (value / maxVal) * 100) // Invert for MTTR (lower is better)
        : Math.max(5, (value / maxVal) * 100);
      const color = getColor(value);
      const displayValue = metric === 'availability' ? value.toFixed(1) : value.toFixed(metric === 'mttr' ? 1 : 0);

      return `
        <div class="bar-row">
          <span class="bar-label" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%; background:${color};"></div>
          </div>
          <span class="bar-value" style="color:${color};">${displayValue}${unit}</span>
        </div>
      `;
    })
    .join('');
}

function summaryCard(
  label: string,
  value: string,
  valueColor: string,
  colors: ReturnType<typeof getThemeColors>
): string {
  return `
    <div class="summary-card">
      <div class="label">${label}</div>
      <div class="value" style="color:${valueColor}">${value}</div>
    </div>
  `;
}

function getAvailabilityColor(availability: number): string {
  if (availability >= 98) return '#15803d';
  if (availability >= 95) return '#22c55e';
  if (availability >= 90) return '#84cc16';
  if (availability >= 80) return '#eab308';
  if (availability >= 70) return '#f97316';
  return '#ef4444';
}

function formatDate(value: string | number | undefined, locale: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
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
  state: { theme: 'dark' | 'light'; isMaximized: boolean; locale: string; startDate: string; endDate: string; devices: OperationalDevice[] },
  onClose?: () => void
): void {
  const closeBtn = container.querySelector(`#${modalId}-close`) as HTMLButtonElement | null;
  const themeBtn = container.querySelector(`#${modalId}-theme`) as HTMLButtonElement | null;
  const maxBtn = container.querySelector(`#${modalId}-max`) as HTMLButtonElement | null;
  const overlay = container.querySelector('.myio-op-compare-overlay') as HTMLElement | null;

  const close = () => {
    container.remove();
    onClose?.();
  };

  closeBtn?.addEventListener('click', close);

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  themeBtn?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    render(container, modalId, state);
    bindEvents(container, modalId, state, onClose);
  });

  maxBtn?.addEventListener('click', () => {
    state.isMaximized = !state.isMaximized;
    render(container, modalId, state);
    bindEvents(container, modalId, state, onClose);
  });
}
