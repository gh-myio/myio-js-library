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
 * Render trend line chart (SVG)
 */
export function renderTrendChart(
  data: AlarmTrendDataPoint[],
  options: TrendChartOptions = {}
): string {
  const {
    width = 600,
    height = 200,
    padding = 40,
    lineColor = '#8b5cf6',
    fillColor = 'rgba(139, 92, 246, 0.2)',
    showGrid = true,
  } = options;

  if (!data || data.length === 0) {
    return renderEmptyChart(width, height, 'Sem dados de tendencia');
  }

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Calculate scales
  const maxValue = Math.max(...data.map((d) => d.total), 1);
  const minValue = 0;
  const valueRange = maxValue - minValue || 1;

  const xScale = (index: number) => padding + (index / (data.length - 1 || 1)) * chartWidth;
  const yScale = (value: number) =>
    padding + chartHeight - ((value - minValue) / valueRange) * chartHeight;

  // Build path
  const points = data.map((d, i) => `${xScale(i)},${yScale(d.total)}`);
  const linePath = `M ${points.join(' L ')}`;

  // Area path (for fill)
  const areaPath = `M ${xScale(0)},${yScale(0)} L ${points.join(' L ')} L ${xScale(
    data.length - 1
  )},${yScale(0)} Z`;

  // Grid lines
  const gridLines = showGrid
    ? Array.from({ length: 5 }, (_, i) => {
        const y = padding + (i / 4) * chartHeight;
        const value = Math.round(maxValue - (i / 4) * valueRange);
        return `
          <line class="chart-grid" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />
          <text class="chart-label" x="${padding - 8}" y="${y + 4}" text-anchor="end">${value}</text>
        `;
      }).join('')
    : '';

  // X-axis labels
  const xLabels = data
    .filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1)
    .map((d, _, arr) => {
      const index = data.indexOf(d);
      return `
        <text class="chart-label" x="${xScale(index)}" y="${height - 8}" text-anchor="middle">
          ${d.label}
        </text>
      `;
    })
    .join('');

  // Data points
  const dataPoints = data
    .map(
      (d, i) => `
        <circle class="chart-point" cx="${xScale(i)}" cy="${yScale(d.total)}" r="4" />
      `
    )
    .join('');

  return `
    <svg class="alarms-trend-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${lineColor};stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:${lineColor};stop-opacity:0" />
        </linearGradient>
      </defs>
      ${gridLines}
      <path class="chart-area" d="${areaPath}" fill="${fillColor}" />
      <path class="chart-line" d="${linePath}" stroke="${lineColor}" />
      ${dataPoints}
      ${xLabels}
    </svg>
  `;
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
