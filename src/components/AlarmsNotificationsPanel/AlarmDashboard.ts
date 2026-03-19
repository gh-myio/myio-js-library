/**
 * RFC-0152 Phase 4: Alarm Dashboard Component
 * KPI cards and SVG charts for the dashboard view
 */

import type { AlarmStats, AlarmTrendDataPoint, AlarmSeverity, AlarmState } from '../../types/alarm';
import { SEVERITY_CONFIG, STATE_CONFIG } from '../../types/alarm';
import type { TrendChartOptions, DonutChartOptions, BarChartOptions } from './types';

// =====================================================================
// KPI Cards
// =====================================================================

/**
 * Render KPI cards row
 */
export function renderKPICards(stats: AlarmStats): string {
  return `
    <div class="alarms-kpi-row">
      <div class="alarms-kpi-card">
        <span class="alarms-kpi-label">Total de Alarmes</span>
        <span class="alarms-kpi-value" data-kpi="total">${stats.total}</span>
      </div>
      <div class="alarms-kpi-card critical">
        <span class="alarms-kpi-label">Criticos Abertos</span>
        <span class="alarms-kpi-value" data-kpi="openCritical">${stats.openCritical}</span>
      </div>
      <div class="alarms-kpi-card warning">
        <span class="alarms-kpi-label">Altos Abertos</span>
        <span class="alarms-kpi-value" data-kpi="openHigh">${stats.openHigh}</span>
      </div>
      <div class="alarms-kpi-card info">
        <span class="alarms-kpi-label">Ultimas 24h</span>
        <span class="alarms-kpi-value" data-kpi="last24Hours">${stats.last24Hours}</span>
      </div>
    </div>
  `;
}

/**
 * Update KPI values in the DOM
 */
export function updateKPIValues(container: HTMLElement, stats: AlarmStats): void {
  const kpiElements = {
    total: container.querySelector('[data-kpi="total"]'),
    openCritical: container.querySelector('[data-kpi="openCritical"]'),
    openHigh: container.querySelector('[data-kpi="openHigh"]'),
    last24Hours: container.querySelector('[data-kpi="last24Hours"]'),
  };

  if (kpiElements.total) kpiElements.total.textContent = String(stats.total);
  if (kpiElements.openCritical) kpiElements.openCritical.textContent = String(stats.openCritical);
  if (kpiElements.openHigh) kpiElements.openHigh.textContent = String(stats.openHigh);
  if (kpiElements.last24Hours) kpiElements.last24Hours.textContent = String(stats.last24Hours);
}

// =====================================================================
// Trend Line Chart
// =====================================================================

/**
 * Render trend area chart (SVG) — dual series: total alarms + critical.
 * Inspired by alarms-frontend AlarmTrendChart (Recharts AreaChart).
 */
export function renderTrendChart(
  data: AlarmTrendDataPoint[],
  options: TrendChartOptions = {}
): string {
  const {
    width = 600,
    height = 200,
    padding = 40,
    showGrid = true,
  } = options;

  // Fixed colors matching the React reference component
  const totalColor    = '#3b82f6'; // blue
  const criticalColor = '#ef4444'; // red

  if (!data || data.length === 0) {
    return renderEmptyChart(width, height, 'Sem dados de tendencia');
  }

  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const n = data.length;

  const maxValue = Math.max(...data.map((d) => d.total), 1);

  const xAt = (i: number) => padding + (i / (n - 1 || 1)) * chartW;
  const yAt = (v: number) => padding + chartH - (v / maxValue) * chartH;
  const yBase = yAt(0);

  // Smooth monotone bezier: horizontal control-point tangents between consecutive points
  function smoothLinePath(pts: [number, number][]): string {
    if (pts.length === 0) return '';
    let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cpx = ((x0 + x1) / 2).toFixed(1);
      d += ` C ${cpx},${y0.toFixed(1)} ${cpx},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    return d;
  }

  function areaPath(pts: [number, number][]): string {
    if (pts.length === 0) return '';
    const line = smoothLinePath(pts);
    return `${line} L ${pts[pts.length - 1][0].toFixed(1)},${yBase.toFixed(1)} L ${pts[0][0].toFixed(1)},${yBase.toFixed(1)} Z`;
  }

  const totalPts:    [number, number][] = data.map((d, i) => [xAt(i), yAt(d.total)]);
  const criticalPts: [number, number][] = data.map((d, i) => [xAt(i), yAt(d.bySeverity?.CRITICAL ?? 0)]);

  // Grid lines + Y labels
  const gridLines = showGrid
    ? Array.from({ length: 5 }, (_, i) => {
        const y     = padding + (i / 4) * chartH;
        const value = Math.round(maxValue - (i / 4) * maxValue);
        return `<line class="chart-grid" x1="${padding}" y1="${y.toFixed(1)}" x2="${width - padding}" y2="${y.toFixed(1)}" />
          <text class="chart-label" x="${padding - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${value}</text>`;
      }).join('')
    : '';

  // X-axis labels (up to 6, always include last)
  const step = Math.max(1, Math.ceil(n / 6));
  const xLabels = data
    .filter((_, i) => i % step === 0 || i === n - 1)
    .map((d) => {
      const i = data.indexOf(d);
      return `<text class="chart-label" x="${xAt(i).toFixed(1)}" y="${height - 8}" text-anchor="middle">${d.label}</text>`;
    })
    .join('');

  // Endpoint dots
  const lastTotal    = totalPts[totalPts.length - 1];
  const lastCritical = criticalPts[criticalPts.length - 1];

  // Legend
  const legend = `
    <div class="alarms-trend-legend">
      <span class="alarms-trend-legend-item">
        <svg width="16" height="4"><rect width="16" height="2" y="1" rx="1" fill="${totalColor}"/></svg>
        Total
      </span>
      <span class="alarms-trend-legend-item">
        <svg width="16" height="4"><rect width="16" height="2" y="1" rx="1" fill="${criticalColor}"/></svg>
        Críticos
      </span>
    </div>`;

  const svg = `
    <svg class="alarms-trend-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%"  stop-color="${totalColor}"    stop-opacity="0.25"/>
          <stop offset="95%" stop-color="${totalColor}"    stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="gradCritical" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%"  stop-color="${criticalColor}" stop-opacity="0.25"/>
          <stop offset="95%" stop-color="${criticalColor}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaPath(totalPts)}"    fill="url(#gradTotal)" />
      <path d="${areaPath(criticalPts)}" fill="url(#gradCritical)" />
      <path d="${smoothLinePath(totalPts)}"    fill="none" stroke="${totalColor}"    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${smoothLinePath(criticalPts)}" fill="none" stroke="${criticalColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lastTotal[0].toFixed(1)}"    cy="${lastTotal[1].toFixed(1)}"    r="4" fill="${totalColor}"    />
      <circle cx="${lastCritical[0].toFixed(1)}" cy="${lastCritical[1].toFixed(1)}" r="4" fill="${criticalColor}" />
      ${xLabels}
    </svg>`;

  return `<div class="alarms-trend-wrap">${svg}${legend}</div>`;
}

// =====================================================================
// State Donut Chart
// =====================================================================

/**
 * Render state distribution donut chart (SVG)
 */
export function renderStateDonutChart(
  byState: Record<AlarmState, number>,
  options: DonutChartOptions = {}
): string {
  const { size = 200, thickness = 24, showTotal = true } = options;

  const total = Object.values(byState).reduce((sum, val) => sum + val, 0);

  if (total === 0) {
    return renderEmptyChart(size, size, 'Sem alarmes');
  }

  const center = size / 2;
  const radius = (size - thickness) / 2 - 10;
  const circumference = 2 * Math.PI * radius;

  // Build segments
  let currentAngle = -90; // Start from top
  const segments: string[] = [];
  const legend: string[] = [];

  const states: AlarmState[] = ['OPEN', 'ACK', 'SNOOZED', 'ESCALATED', 'CLOSED'];

  states.forEach((state) => {
    const value = byState[state] || 0;
    if (value === 0) return;

    const percentage = value / total;
    const dashLength = circumference * percentage;
    const gapLength = circumference - dashLength;
    const color = STATE_CONFIG[state].color;
    const rotation = currentAngle;

    segments.push(`
      <circle
        class="donut-segment"
        cx="${center}"
        cy="${center}"
        r="${radius}"
        stroke="${color}"
        stroke-dasharray="${dashLength} ${gapLength}"
        transform="rotate(${rotation} ${center} ${center})"
      />
    `);

    legend.push(`
      <div class="alarms-legend-item">
        <span class="alarms-legend-dot" style="background: ${color}"></span>
        <span>${STATE_CONFIG[state].label}: ${value}</span>
      </div>
    `);

    currentAngle += percentage * 360;
  });

  const centerText = showTotal
    ? `
      <text class="donut-center-text" x="${center}" y="${center}">${total}</text>
      <text class="donut-center-label" x="${center}" y="${center + 20}">Total</text>
    `
    : '';

  return `
    <div>
      <svg class="alarms-donut-chart" viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet">
        <circle
          cx="${center}"
          cy="${center}"
          r="${radius}"
          fill="none"
          stroke="var(--alarms-border)"
          stroke-width="${thickness}"
        />
        ${segments.join('')}
        ${centerText}
      </svg>
      <div class="alarms-chart-legend">${legend.join('')}</div>
    </div>
  `;
}

// =====================================================================
// Severity Bar Chart
// =====================================================================

/**
 * Render severity distribution bar chart
 */
export function renderSeverityBarChart(
  bySeverity: Record<AlarmSeverity, number>,
  options: BarChartOptions = {}
): string {
  const { barHeight = 24, gap = 12, showValues = true } = options;

  const total = Object.values(bySeverity).reduce((sum, val) => sum + val, 0);
  const maxValue = Math.max(...Object.values(bySeverity), 1);

  if (total === 0) {
    return renderEmptyChart(300, 150, 'Sem alarmes');
  }

  const severities: AlarmSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

  const bars = severities
    .map((severity) => {
      const value = bySeverity[severity] || 0;
      const percentage = (value / maxValue) * 100;
      const config = SEVERITY_CONFIG[severity];

      return `
        <div class="bar-item">
          <span class="bar-label">${config.label}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              data-severity="${severity}"
              style="width: ${percentage}%"
            ></div>
          </div>
          ${showValues ? `<span class="bar-value">${value}</span>` : ''}
        </div>
      `;
    })
    .join('');

  return `<div class="alarms-bar-chart">${bars}</div>`;
}

// =====================================================================
// Helper Functions
// =====================================================================

/**
 * Render empty chart placeholder
 */
function renderEmptyChart(width: number, height: number, message: string): string {
  return `
    <div class="alarms-empty-state" style="min-height: ${height}px">
      <span class="alarms-empty-icon">📊</span>
      <p class="alarms-empty-text">${message}</p>
    </div>
  `;
}

/**
 * Render complete dashboard content
 */
export function renderDashboard(stats: AlarmStats, trendData?: AlarmTrendDataPoint[]): string {
  const kpiCards = renderKPICards(stats);
  const trendChart = renderTrendChart(trendData || []);
  const stateDonut = renderStateDonutChart(stats.byState);
  const severityBars = renderSeverityBarChart(stats.bySeverity);

  return `
    <div class="alarms-dashboard">
      ${kpiCards}

      <div class="alarms-charts-row">
        <div class="alarms-chart-card">
          <h4 class="alarms-chart-title">Tendencia de Alarmes</h4>
          <div class="alarms-chart-area">${trendChart}</div>
        </div>

        <div class="alarms-chart-card">
          <h4 class="alarms-chart-title">Por Estado</h4>
          <div class="alarms-chart-area">${stateDonut}</div>
        </div>

        <div class="alarms-chart-card">
          <h4 class="alarms-chart-title">Por Severidade</h4>
          <div class="alarms-chart-area">${severityBars}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Update dashboard with new stats
 */
export function updateDashboard(
  container: HTMLElement,
  stats: AlarmStats,
  trendData?: AlarmTrendDataPoint[]
): void {
  // Update KPI values
  updateKPIValues(container, stats);

  // Re-render charts (they are relatively lightweight)
  const trendArea = container.querySelector('.alarms-chart-card:nth-child(1) .alarms-chart-area');
  if (trendArea) {
    trendArea.innerHTML = renderTrendChart(trendData || []);
  }

  const stateArea = container.querySelector('.alarms-chart-card:nth-child(2) .alarms-chart-area');
  if (stateArea) {
    stateArea.innerHTML = renderStateDonutChart(stats.byState);
  }

  const severityArea = container.querySelector('.alarms-chart-card:nth-child(3) .alarms-chart-area');
  if (severityArea) {
    severityArea.innerHTML = renderSeverityBarChart(stats.bySeverity);
  }
}
