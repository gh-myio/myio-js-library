/**
 * RFC-0152 Phase 5: Chart Components
 * SVG-based chart rendering utilities (no external dependencies)
 */

import type { TrendDataPoint, DowntimeEntry, DashboardKPIs } from './types';

// ============================================
// LINE CHART
// ============================================

interface LineChartConfig {
  width?: number;
  height?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  showDots?: boolean;
  showArea?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  lineColor?: string;
  areaColor?: string;
}

const DEFAULT_LINE_CONFIG: LineChartConfig = {
  width: 400,
  height: 200,
  padding: { top: 20, right: 20, bottom: 30, left: 40 },
  showDots: true,
  showArea: true,
  showGrid: true,
  showLabels: true,
  lineColor: '#8b5cf6',
  areaColor: '#8b5cf6',
};

/**
 * Render an SVG line chart for trend data
 */
export function renderLineChart(data: TrendDataPoint[], config: LineChartConfig = {}): string {
  const cfg = { ...DEFAULT_LINE_CONFIG, ...config };
  const { width, height, padding, showDots, showArea, showGrid, showLabels, lineColor, areaColor } =
    cfg as Required<LineChartConfig>;

  if (data.length === 0) {
    return `<div class="no-data">Sem dados disponiveis</div>`;
  }

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scale
  const values = data.map(d => d.value);
  const minValue = Math.min(...values) * 0.95;
  const maxValue = Math.max(...values) * 1.05;
  const valueRange = maxValue - minValue || 1;

  // Generate points
  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - minValue) / valueRange) * chartHeight,
    label: d.label,
    value: d.value,
  }));

  // Build path
  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

  // Build area path
  const areaPath = showArea
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`
    : '';

  // Grid lines
  const gridLines =
    showGrid
      ? [0, 0.25, 0.5, 0.75, 1]
          .map(pct => {
            const y = padding.top + chartHeight * (1 - pct);
            return `<line class="chart-grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />`;
          })
          .join('')
      : '';

  // Y-axis labels
  const yLabels =
    showLabels
      ? [0, 0.5, 1]
          .map(pct => {
            const y = padding.top + chartHeight * (1 - pct);
            const val = minValue + valueRange * pct;
            return `<text class="chart-label" x="${padding.left - 8}" y="${y}" text-anchor="end" dominant-baseline="middle">${val.toFixed(0)}</text>`;
          })
          .join('')
      : '';

  // X-axis labels
  const xLabels =
    showLabels
      ? points
          .filter((_, i) => i % Math.ceil(points.length / 6) === 0 || i === points.length - 1)
          .map(
            p =>
              `<text class="chart-label" x="${p.x}" y="${padding.top + chartHeight + 16}">${p.label}</text>`
          )
          .join('')
      : '';

  // Dots
  const dots = showDots
    ? points.map(p => `<circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="4" />`).join('')
    : '';

  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${areaColor}" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="${areaColor}" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      ${gridLines}
      ${yLabels}
      ${xLabels}
      ${showArea ? `<path class="chart-area-fill" d="${areaPath}" />` : ''}
      <path class="chart-line primary" d="${linePath}" style="stroke: ${lineColor}" />
      ${dots}
    </svg>
  `;
}

// ============================================
// AVAILABILITY CHART (RFC-0156 Enhanced)
// ============================================

interface AvailabilityChartConfig {
  /** SLA/target percentage (default: 95) */
  slaTarget?: number;
  /** Period label for subtitle */
  periodLabel?: string;
  /** Show SLA reference line */
  showSlaLine?: boolean;
  /** Show period average line */
  showAverageLine?: boolean;
  /** Show colored zones */
  showZones?: boolean;
  /** Show event markers */
  showEventMarkers?: boolean;
  /** RFC-0156 Feedback: Scale mode - 'full' (0-100%) or 'zoom' (adaptive) */
  scaleMode?: 'full' | 'zoom';
  /** RFC-0156 Feedback: Show 7-day trend line */
  showTrendLine?: boolean;
}

/**
 * Calculate simple linear regression for trend line
 */
function calculateTrendLine(data: TrendDataPoint[]): { slope: number; intercept: number; trend: 'improving' | 'worsening' | 'stable' } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0]?.value || 0, trend: 'stable' };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  data.forEach((d, i) => {
    sumX += i;
    sumY += d.value;
    sumXY += i * d.value;
    sumX2 += i * i;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Determine trend based on slope (threshold: 0.1% per day)
  const trend: 'improving' | 'worsening' | 'stable' =
    slope > 0.1 ? 'improving' : slope < -0.1 ? 'worsening' : 'stable';

  return { slope, intercept, trend };
}

/**
 * Render enhanced availability chart (RFC-0156 + Feedback)
 * Includes: SLA line, average line, colored zones, tooltips, event markers,
 * scale toggle (zoom/full), trend line, event hierarchy, CTA actions
 */
export function renderAvailabilityChart(
  data: TrendDataPoint[],
  config: AvailabilityChartConfig = {}
): string {
  const {
    slaTarget = 95,
    periodLabel = 'últimos 30 dias',
    showSlaLine = true,
    showAverageLine = true,
    showZones = true,
    showEventMarkers = true,
    scaleMode = 'full',
    showTrendLine = true,
  } = config;

  if (data.length === 0) {
    return `<div class="no-data">Sem dados disponiveis</div>`;
  }

  const width = 480;
  const height = 220;
  const padding = { top: 15, right: 20, bottom: 45, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // RFC-0156 Feedback: Scale mode - adaptive zoom or full (0-100%)
  const values = data.map(d => d.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);

  let minValue: number;
  let maxValue: number;

  if (scaleMode === 'zoom') {
    // Adaptive zoom: show range around data with some padding
    const range = dataMax - dataMin;
    const buffer = Math.max(range * 0.2, 5); // At least 5% buffer
    minValue = Math.max(0, Math.floor((dataMin - buffer) / 5) * 5); // Round down to 5
    maxValue = Math.min(100, Math.ceil((dataMax + buffer) / 5) * 5); // Round up to 5
    // Ensure at least 20% range for visibility
    if (maxValue - minValue < 20) {
      const center = (minValue + maxValue) / 2;
      minValue = Math.max(0, center - 10);
      maxValue = Math.min(100, center + 10);
    }
  } else {
    // Full scale: 0-100% (honest representation)
    minValue = 0;
    maxValue = 100;
  }

  const valueRange = maxValue - minValue;

  // Calculate average
  const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length;

  // Count points below SLA
  const belowSlaCount = data.filter(d => d.value < slaTarget).length;

  // RFC-0156 Feedback: Calculate trend
  const trendData = calculateTrendLine(data);

  // Generate points
  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - minValue) / valueRange) * chartHeight,
    ...d,
  }));

  // Helper to convert value to Y position
  const valueToY = (val: number) => {
    const clampedVal = Math.max(minValue, Math.min(maxValue, val));
    return padding.top + chartHeight - ((clampedVal - minValue) / valueRange) * chartHeight;
  };

  // Colored zones (green/yellow/red) - only show what's in range
  let zones = '';
  if (showZones) {
    // Critical zone (0-80%)
    if (minValue < 80) {
      const zoneTop = valueToY(Math.min(80, maxValue));
      const zoneBottom = valueToY(Math.max(0, minValue));
      zones += `<rect x="${padding.left}" y="${zoneTop}" width="${chartWidth}" height="${zoneBottom - zoneTop}"
        fill="rgba(239, 68, 68, 0.08)" class="zone-critical" />`;
    }
    // Warning zone (80-95%)
    if (minValue < 95 && maxValue > 80) {
      const zoneTop = valueToY(Math.min(95, maxValue));
      const zoneBottom = valueToY(Math.max(80, minValue));
      zones += `<rect x="${padding.left}" y="${zoneTop}" width="${chartWidth}" height="${zoneBottom - zoneTop}"
        fill="rgba(245, 158, 11, 0.08)" class="zone-warning" />`;
    }
    // Good zone (95-100%)
    if (maxValue > 95) {
      const zoneTop = valueToY(Math.min(100, maxValue));
      const zoneBottom = valueToY(Math.max(95, minValue));
      zones += `<rect x="${padding.left}" y="${zoneTop}" width="${chartWidth}" height="${zoneBottom - zoneTop}"
        fill="rgba(34, 197, 94, 0.08)" class="zone-good" />`;
    }
  }

  // SLA reference line (only if in range)
  let slaLine = '';
  if (showSlaLine && slaTarget >= minValue && slaTarget <= maxValue) {
    slaLine = `
      <line class="sla-line" x1="${padding.left}" y1="${valueToY(slaTarget)}"
        x2="${width - padding.right}" y2="${valueToY(slaTarget)}" />
      <text class="sla-label" x="${width - padding.right + 5}" y="${valueToY(slaTarget) + 4}">
        SLA ${slaTarget}%
      </text>
    `;
  }

  // Average reference line (only if in range)
  let avgLine = '';
  if (showAverageLine && avgValue >= minValue && avgValue <= maxValue) {
    avgLine = `
      <line class="avg-line" x1="${padding.left}" y1="${valueToY(avgValue)}"
        x2="${width - padding.right}" y2="${valueToY(avgValue)}" />
      <text class="avg-label" x="${padding.left - 5}" y="${valueToY(avgValue) + 4}" text-anchor="end">
        Média ${avgValue.toFixed(1)}%
      </text>
    `;
  }

  // RFC-0156 Feedback: Trend line
  let trendLine = '';
  if (showTrendLine && data.length >= 3) {
    const trendStartY = valueToY(trendData.intercept);
    const trendEndY = valueToY(trendData.intercept + trendData.slope * (data.length - 1));
    const trendColor = trendData.trend === 'improving' ? '#22c55e' : trendData.trend === 'worsening' ? '#ef4444' : '#94a3b8';
    trendLine = `
      <line class="trend-line" x1="${padding.left}" y1="${trendStartY}"
        x2="${width - padding.right}" y2="${trendEndY}"
        stroke="${trendColor}" stroke-width="2" stroke-dasharray="6,4" opacity="0.7" />
    `;
  }

  // Grid lines (adaptive to scale)
  const gridSteps = scaleMode === 'zoom' ? 4 : 5;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = minValue + (valueRange * i) / gridSteps;
    const y = valueToY(val);
    return `<line class="chart-grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />`;
  }).join('');

  // Y-axis labels (adaptive to scale)
  const yLabels = Array.from({ length: 3 }, (_, i) => {
    const val = minValue + (valueRange * i) / 2;
    const y = valueToY(val);
    return `<text class="chart-label" x="${padding.left - 8}" y="${y}" text-anchor="end" dominant-baseline="middle">${val.toFixed(0)}%</text>`;
  }).join('');

  // X-axis labels with better date format
  const xLabels = points
    .filter((_, i) => i % Math.ceil(points.length / 6) === 0 || i === points.length - 1)
    .map(p => `<text class="chart-label" x="${p.x}" y="${height - 8}">${p.label}</text>`)
    .join('');

  // Build line path
  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

  // Area fill
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  // Dots with color based on SLA
  const dots = points.map(p => {
    const color = p.value >= slaTarget ? '#22c55e' : p.value >= 80 ? '#f59e0b' : '#ef4444';
    return `
      <circle class="avail-dot" cx="${p.x}" cy="${p.y}" r="4" fill="${color}"
        data-value="${p.value.toFixed(1)}"
        data-label="${p.label}"
        data-failures="${p.failureCount || 0}"
        data-downtime="${p.downtimeHours || 0}"
        data-affected="${p.affectedEquipment || 0}"
        data-event="${p.hasEvent || false}"
        data-event-desc="${p.eventDescription || ''}" />
    `;
  }).join('');

  // RFC-0156 Feedback: Event markers with hierarchy (size/color by failure count)
  const eventMarkers = showEventMarkers ? points
    .filter(p => p.hasEvent || (p.failureCount && p.failureCount > 0))
    .map(p => {
      const failures = p.failureCount || 1;
      // Size proportional to failures (8-14 radius)
      const radius = Math.min(14, 8 + failures * 2);
      // Color intensity based on severity
      const baseColor = p.value < 80 ? '#ef4444' : p.value < slaTarget ? '#f59e0b' : '#eab308';
      // Add glow for multiple failures
      const glowEffect = failures >= 3 ? `<circle r="${radius + 3}" fill="${baseColor}" opacity="0.3" />` : '';

      return `
        <g class="event-marker" transform="translate(${p.x}, ${p.y - 18})">
          ${glowEffect}
          <circle r="${radius}" fill="${baseColor}" class="${failures >= 3 ? 'critical-event' : ''}" />
          <text y="4" text-anchor="middle" fill="white" font-size="${failures >= 3 ? '11' : '10'}" font-weight="bold">
            ${failures}
          </text>
        </g>
      `;
    }).join('') : '';

  // Determine line color based on average
  const lineColor = avgValue >= slaTarget ? '#22c55e' : avgValue >= 80 ? '#f59e0b' : '#ef4444';

  // RFC-0156 Feedback: Status badge with CTA
  const statusBadge = avgValue >= slaTarget
    ? '<span class="status-badge good">Dentro do SLA</span>'
    : `<span class="status-badge warning clickable" title="Clique para ver causas">
        Abaixo do SLA
        <span class="badge-cta">Ver causas →</span>
      </span>`;

  // RFC-0156 Feedback: Trend indicator
  const trendIndicator = showTrendLine ? `
    <span class="trend-indicator-badge ${trendData.trend}">
      ${trendData.trend === 'improving' ? '↗ Melhorando' : trendData.trend === 'worsening' ? '↘ Piorando' : '→ Estável'}
    </span>
  ` : '';

  // RFC-0156 Feedback: Scale mode toggle
  const scaleModeLabel = scaleMode === 'zoom' ? 'Zoom analítico' : 'Escala completa';
  const scaleToggle = `
    <button class="scale-toggle" data-mode="${scaleMode}" title="Alternar entre visão analítica e completa">
      📊 ${scaleModeLabel}
    </button>
  `;

  const svgChart = `
    <svg class="availability-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="availGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${lineColor}" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      ${zones}
      ${gridLines}
      ${slaLine}
      ${avgLine}
      ${trendLine}
      ${yLabels}
      ${xLabels}
      <path class="avail-area" d="${areaPath}" fill="url(#availGradient)" />
      <path class="avail-line" d="${linePath}" stroke="${lineColor}" />
      ${dots}
      ${eventMarkers}
    </svg>
  `;

  // Subtitle with formula explanation
  const subtitle = `Disponibilidade média diária (%) — ${periodLabel}`;
  const formula = `MTBF / (MTBF + MTTR) × 100`;

  return `
    <div class="availability-chart-container" data-has-tooltips="true" data-scale-mode="${scaleMode}">
      <div class="avail-chart-header">
        <div class="avail-subtitle">${subtitle}</div>
        <div class="avail-header-actions">
          ${scaleToggle}
          <div class="avail-formula" title="Fórmula: ${formula}">ℹ️ Como é calculado</div>
        </div>
      </div>
      ${svgChart}
      <div class="avail-chart-footer">
        <div class="avail-stats">
          <span class="stat">Média: <strong>${avgValue.toFixed(1)}%</strong></span>
          <span class="stat">SLA: <strong>${slaTarget}%</strong></span>
          <span class="stat ${belowSlaCount > 0 ? 'warning' : ''}">Dias abaixo: <strong>${belowSlaCount}</strong></span>
          ${trendIndicator}
        </div>
        ${statusBadge}
      </div>
      <div class="avail-tooltip" id="availTooltip"></div>
    </div>
  `;
}

/**
 * Initialize availability chart tooltips and interactions
 * RFC-0156 Feedback: Includes scale toggle, CTA click handling
 */
export function initAvailabilityChartTooltips(containerId: string, onScaleToggle?: (newMode: 'full' | 'zoom') => void): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const chartContainer = container.querySelector('.availability-chart-container');
  if (!chartContainer) return;

  const tooltip = chartContainer.querySelector('.avail-tooltip') as HTMLElement;
  if (!tooltip) return;

  // RFC-0156 Feedback: Scale toggle button
  const scaleToggle = chartContainer.querySelector('.scale-toggle') as HTMLButtonElement;
  if (scaleToggle && onScaleToggle) {
    scaleToggle.addEventListener('click', () => {
      const currentMode = scaleToggle.getAttribute('data-mode') as 'full' | 'zoom';
      const newMode = currentMode === 'full' ? 'zoom' : 'full';
      onScaleToggle(newMode);
    });
  }

  // RFC-0156 Feedback: CTA on "Below SLA" badge
  const ctaBadge = chartContainer.querySelector('.status-badge.clickable') as HTMLElement;
  if (ctaBadge) {
    ctaBadge.addEventListener('click', () => {
      // Dispatch event for parent to handle drill-down
      window.dispatchEvent(new CustomEvent('myio:availability-sla-drill-down', {
        detail: { containerId }
      }));
    });
  }

  const dots = chartContainer.querySelectorAll('.avail-dot');
  dots.forEach(dot => {
    dot.addEventListener('mouseenter', (e) => {
      const target = e.target as SVGElement;
      const value = target.getAttribute('data-value') || '0';
      const label = target.getAttribute('data-label') || '';
      const failures = target.getAttribute('data-failures') || '0';
      const downtime = target.getAttribute('data-downtime') || '0';
      const affected = target.getAttribute('data-affected') || '0';
      const hasEvent = target.getAttribute('data-event') === 'true';
      const eventDesc = target.getAttribute('data-event-desc') || '';

      const valueNum = parseFloat(value);
      const statusIcon = valueNum >= 95 ? '🟢' : valueNum >= 80 ? '🟡' : '🔴';

      tooltip.innerHTML = `
        <div class="tooltip-title">${statusIcon} ${label}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Disponibilidade:</span>
          <span class="tooltip-value">${value}%</span>
        </div>
        ${parseInt(failures) > 0 ? `
          <div class="tooltip-divider"></div>
          <div class="tooltip-row">
            <span class="tooltip-label">Falhas:</span>
            <span class="tooltip-value">${failures}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Tempo parado:</span>
            <span class="tooltip-value">${parseFloat(downtime).toFixed(1)}h</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Equipamentos afetados:</span>
            <span class="tooltip-value">${affected}</span>
          </div>
        ` : ''}
        ${hasEvent && eventDesc ? `
          <div class="tooltip-divider"></div>
          <div class="tooltip-event">⚠️ ${eventDesc}</div>
        ` : ''}
      `;
      tooltip.classList.add('visible');

      positionAvailTooltip(tooltip, e as MouseEvent);
    });

    dot.addEventListener('mousemove', (e) => {
      positionAvailTooltip(tooltip, e as MouseEvent);
    });

    dot.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  });
}

/**
 * Position availability tooltip
 */
function positionAvailTooltip(tooltip: HTMLElement, e: MouseEvent): void {
  const offset = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  tooltip.style.left = '-9999px';
  tooltip.style.top = '-9999px';
  const tooltipRect = tooltip.getBoundingClientRect();

  let x = e.clientX + offset;
  let y = e.clientY + offset;

  if (x + tooltipRect.width > viewportWidth - 10) {
    x = e.clientX - tooltipRect.width - offset;
  }
  if (y + tooltipRect.height > viewportHeight - 10) {
    y = e.clientY - tooltipRect.height - offset;
  }

  x = Math.max(10, x);
  y = Math.max(10, y);

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

// ============================================
// DUAL LINE CHART (MTBF/MTTR)
// ============================================

/**
 * Render dual line chart for MTBF and MTTR trends
 */
export function renderDualLineChart(data: TrendDataPoint[]): string {
  if (data.length === 0) {
    return `<div class="no-data">Sem dados disponiveis</div>`;
  }

  const width = 400;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Primary values (MTBF - value)
  const primaryValues = data.map(d => d.value);
  const primaryMin = Math.min(...primaryValues) * 0.9;
  const primaryMax = Math.max(...primaryValues) * 1.1;
  const primaryRange = primaryMax - primaryMin || 1;

  // Secondary values (MTTR - secondaryValue)
  const secondaryValues = data.map(d => d.secondaryValue || 0);
  const secondaryMin = Math.min(...secondaryValues) * 0.9;
  const secondaryMax = Math.max(...secondaryValues) * 1.1;
  const secondaryRange = secondaryMax - secondaryMin || 1;

  // Generate primary points
  const primaryPoints = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - primaryMin) / primaryRange) * chartHeight,
  }));

  // Generate secondary points
  const secondaryPoints = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth,
    y:
      padding.top +
      chartHeight -
      (((d.secondaryValue || 0) - secondaryMin) / secondaryRange) * chartHeight,
  }));

  const primaryPath = primaryPoints
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');
  const secondaryPath = secondaryPoints
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  // X-axis labels
  const xLabels = data
    .filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1)
    .map((d, i, arr) => {
      const x =
        padding.left +
        ((data.indexOf(d) / Math.max(data.length - 1, 1)) * chartWidth);
      return `<text class="chart-label" x="${x}" y="${padding.top + chartHeight + 16}">${d.label}</text>`;
    })
    .join('');

  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${xLabels}
      <path class="chart-line primary" d="${primaryPath}" />
      <path class="chart-line secondary" d="${secondaryPath}" />
      <g class="chart-legend" transform="translate(${width - 100}, 10)">
        <line x1="0" y1="5" x2="20" y2="5" stroke="#8b5cf6" stroke-width="2" />
        <text x="25" y="8" font-size="10" fill="#94a3b8">MTBF</text>
        <line x1="0" y1="20" x2="20" y2="20" stroke="#f59e0b" stroke-width="2" />
        <text x="25" y="23" font-size="10" fill="#94a3b8">MTTR</text>
      </g>
    </svg>
  `;
}

// ============================================
// DONUT CHART (RFC-0155 Enhanced)
// ============================================

interface DonutSegment {
  value: number;
  color: string;
  label: string;
  labelPt: string;
  trend?: number;
  avgTime?: number;
  isCritical?: boolean;
}

/**
 * Format trend indicator
 */
function formatTrendIndicator(trend: number | undefined): string {
  if (trend === undefined || trend === 0) return '';
  const icon = trend > 0 ? '↑' : '↓';
  const cls = trend > 0 ? 'trend-up' : 'trend-down';
  return `<span class="trend-indicator ${cls}">${icon}${Math.abs(trend)}</span>`;
}

/**
 * Render donut chart for status distribution (RFC-0155 Enhanced + Feedback)
 * Includes: percentages, trends, tooltips, critical indicators, SLA reference,
 * temporal context, maintenance breakdown, offline hierarchy, interactivity hints
 */
export function renderStatusDonutChart(kpis: DashboardKPIs, period?: string): string {
  // Offline breakdown for hierarchy display
  const offlineCritical = kpis.offlineCriticalCount || 0;
  const offlineEssential = kpis.offlineEssentialCount || 0;

  // Maintenance breakdown
  const maintenanceBreakdown = kpis.maintenanceBreakdown || { scheduled: 0, corrective: 0, avgDuration: 0 };

  const segments: DonutSegment[] = [
    {
      value: kpis.onlineCount,
      color: '#22c55e',
      label: 'online',
      labelPt: 'Online',
      trend: kpis.onlineTrend,
      avgTime: kpis.avgTimeInStatus?.online,
    },
    {
      value: kpis.offlineCount,
      color: '#ef4444',
      label: 'offline',
      labelPt: 'Offline',
      trend: kpis.offlineTrend,
      avgTime: kpis.avgTimeInStatus?.offline,
      isCritical: offlineCritical > 0 || offlineEssential > 0,
    },
    {
      value: kpis.maintenanceCount,
      color: '#f59e0b',
      label: 'maintenance',
      labelPt: 'Manutencao',
      trend: kpis.maintenanceTrend,
      avgTime: kpis.avgTimeInStatus?.maintenance,
    },
  ];

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return `<div class="no-data">Sem equipamentos</div>`;
  }

  const size = 140;
  const center = size / 2;
  const radius = 50;
  const strokeWidth = 20;

  // Calculate circumference and segments
  const circumference = 2 * Math.PI * radius;
  let currentOffset = circumference * 0.25; // Start at top

  const segmentPaths = segments
    .filter(s => s.value > 0)
    .map(segment => {
      const percentage = segment.value / total;
      const dashLength = circumference * percentage;
      const dashArray = `${dashLength} ${circumference - dashLength}`;
      const path = `
        <circle
          class="donut-segment ${segment.isCritical ? 'critical' : ''}"
          cx="${center}"
          cy="${center}"
          r="${radius}"
          stroke="${segment.color}"
          stroke-dasharray="${dashArray}"
          stroke-dashoffset="${-currentOffset}"
          transform="rotate(-90 ${center} ${center})"
          data-status="${segment.label}"
          data-value="${segment.value}"
          data-percentage="${(percentage * 100).toFixed(1)}"
          data-avg-time="${segment.avgTime || 0}"
        />
      `;
      currentOffset -= dashLength;
      return path;
    })
    .join('');

  // Calculate availability percentage
  const availabilityPct = total > 0 ? (kpis.onlineCount / total) * 100 : 0;
  const availabilityPctStr = availabilityPct.toFixed(1);

  // SLA configuration (RFC-0155 Feedback)
  const slaTarget = kpis.availabilitySlaTarget || 95;
  const availTrend = kpis.availabilityTrendValue || 0;
  const isBelowSla = availabilityPct < slaTarget;

  // Enhanced legend with percentages, trends, and hierarchy
  const legend = segments
    .map(s => {
      const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : '0';
      const trendHtml = formatTrendIndicator(s.trend);
      const criticalBadge = s.isCritical ? '<span class="critical-badge">!</span>' : '';

      // Offline hierarchy detail
      let hierarchyDetail = '';
      if (s.label === 'offline' && s.value > 0) {
        const hierarchyParts: string[] = [];
        if (offlineEssential > 0) {
          hierarchyParts.push(`${offlineEssential} essenciais`);
        }
        if (offlineCritical > 0) {
          hierarchyParts.push(`${offlineCritical} >24h`);
        }
        if (hierarchyParts.length > 0) {
          hierarchyDetail = `<span class="legend-hierarchy">(${hierarchyParts.join(', ')})</span>`;
        }
      }

      // Maintenance breakdown detail
      let maintenanceDetail = '';
      if (s.label === 'maintenance' && s.value > 0) {
        const parts: string[] = [];
        if (maintenanceBreakdown.scheduled > 0) {
          parts.push(`${maintenanceBreakdown.scheduled} prog.`);
        }
        if (maintenanceBreakdown.corrective > 0) {
          parts.push(`${maintenanceBreakdown.corrective} corr.`);
        }
        if (parts.length > 0) {
          maintenanceDetail = `<span class="legend-hierarchy">(${parts.join(', ')})</span>`;
        }
      }

      return `
        <div class="legend-item ${s.isCritical ? 'critical' : ''} clickable" data-status="${s.label}" title="Clique para filtrar">
          <span class="legend-dot ${s.label}"></span>
          <div class="legend-info">
            <span class="legend-label">${s.labelPt} ${criticalBadge}</span>
            <span class="legend-metrics">
              <span class="legend-value">${s.value}</span>
              <span class="legend-pct">(${pct}%)</span>
              ${trendHtml}
            </span>
            ${hierarchyDetail}
            ${maintenanceDetail}
          </div>
        </div>
      `;
    })
    .join('');

  // Enhanced complementary indicators with SLA and interactivity (RFC-0155 Feedback)
  const recurrentFailures = kpis.recurrentFailuresCount || 0;
  const trendIcon = availTrend > 0 ? '↑' : availTrend < 0 ? '↓' : '';
  const trendClass = availTrend > 0 ? 'trend-positive' : availTrend < 0 ? 'trend-negative' : '';
  const trendText = availTrend !== 0 ? `${trendIcon}${Math.abs(availTrend).toFixed(1)}%` : '';

  const complementaryIndicators = `
    <div class="status-indicators">
      <div class="indicator ${offlineCritical > 0 ? 'warning' : 'ok'} clickable" title="Ver equipamentos offline >24h">
        <span class="indicator-value">${offlineCritical}</span>
        <span class="indicator-label">Offline &gt;24h</span>
      </div>
      <div class="indicator ${recurrentFailures > 0 ? 'warning' : 'ok'} clickable" title="Ver equipamentos com falhas recorrentes">
        <span class="indicator-value">${recurrentFailures}</span>
        <span class="indicator-label">Falhas recorrentes</span>
      </div>
      <div class="indicator availability ${isBelowSla ? 'below-sla' : 'above-sla'}">
        <div class="availability-main">
          <span class="indicator-value">${availabilityPctStr}%</span>
          ${trendText ? `<span class="availability-trend ${trendClass}">${trendText}</span>` : ''}
        </div>
        <span class="indicator-label">Disponibilidade</span>
        <span class="sla-reference ${isBelowSla ? 'warning' : 'ok'}">Meta: ≥${slaTarget}%</span>
      </div>
    </div>
  `;

  // Period subtitle with explicit temporal window (RFC-0155 Feedback)
  const periodLabels: Record<string, string> = {
    'today': 'atual — últimas 2 horas',
    'week': 'atual — esta semana',
    'month': 'atual — últimos 30 dias',
    'quarter': 'atual — este trimestre',
  };
  const periodLabel = periodLabels[period || ''] || 'atual — últimos 15 minutos';
  const periodSubtitle = `<div class="chart-period">Status ${periodLabel}</div>`;

  return `
    <div class="donut-container enhanced" data-has-tooltips="true">
      ${periodSubtitle}
      <div class="donut-main">
        <svg class="donut-svg" viewBox="0 0 ${size} ${size}">
          <!-- Background circle -->
          <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#334155" stroke-width="${strokeWidth}" />
          ${segmentPaths}
          <!-- Center text -->
          <text class="donut-center" x="${center}" y="${center - 5}">
            <tspan class="value" x="${center}">${total}</tspan>
          </text>
          <text class="donut-center" x="${center}" y="${center + 12}">
            <tspan class="label" x="${center}">Total</tspan>
          </text>
        </svg>
        <div class="donut-legend enhanced">
          ${legend}
        </div>
      </div>
      ${complementaryIndicators}
      <div class="status-tooltip" id="statusTooltip"></div>
    </div>
  `;
}

/**
 * Initialize status chart tooltips
 */
export function initStatusChartTooltips(containerId: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const donutContainer = container.querySelector('.donut-container.enhanced');
  if (!donutContainer) return;

  const tooltip = donutContainer.querySelector('.status-tooltip') as HTMLElement;
  if (!tooltip) return;

  // Tooltip for donut segments
  const segments = donutContainer.querySelectorAll('.donut-segment');
  segments.forEach(segment => {
    segment.addEventListener('mouseenter', (e) => {
      const target = e.target as SVGElement;
      const status = target.getAttribute('data-status') || '';
      const value = target.getAttribute('data-value') || '0';
      const pct = target.getAttribute('data-percentage') || '0';
      const avgTime = target.getAttribute('data-avg-time') || '0';

      const statusLabels: Record<string, string> = {
        online: '🟢 Online',
        offline: '🔴 Offline',
        maintenance: '🟠 Manutenção',
      };

      tooltip.innerHTML = `
        <div class="tooltip-title">${statusLabels[status] || status}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Quantidade:</span>
          <span class="tooltip-value">${value} equipamentos</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Percentual:</span>
          <span class="tooltip-value">${pct}%</span>
        </div>
        ${parseFloat(avgTime) > 0 ? `
          <div class="tooltip-row">
            <span class="tooltip-label">Tempo médio:</span>
            <span class="tooltip-value">${parseFloat(avgTime).toFixed(1)}h</span>
          </div>
        ` : ''}
      `;
      tooltip.classList.add('visible');

      positionStatusTooltip(tooltip, e as MouseEvent);
    });

    segment.addEventListener('mousemove', (e) => {
      positionStatusTooltip(tooltip, e as MouseEvent);
    });

    segment.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  });

  // Tooltip for legend items
  const legendItems = donutContainer.querySelectorAll('.legend-item');
  legendItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
      const status = item.getAttribute('data-status');
      const segment = donutContainer.querySelector(`.donut-segment[data-status="${status}"]`);
      if (segment) {
        segment.classList.add('highlighted');
      }
    });

    item.addEventListener('mouseleave', () => {
      const status = item.getAttribute('data-status');
      const segment = donutContainer.querySelector(`.donut-segment[data-status="${status}"]`);
      if (segment) {
        segment.classList.remove('highlighted');
      }
    });
  });
}

/**
 * Position status tooltip
 */
function positionStatusTooltip(tooltip: HTMLElement, e: MouseEvent): void {
  const offset = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  tooltip.style.left = '-9999px';
  tooltip.style.top = '-9999px';
  const tooltipRect = tooltip.getBoundingClientRect();

  let x = e.clientX + offset;
  let y = e.clientY + offset;

  if (x + tooltipRect.width > viewportWidth - 10) {
    x = e.clientX - tooltipRect.width - offset;
  }
  if (y + tooltipRect.height > viewportHeight - 10) {
    y = e.clientY - tooltipRect.height - offset;
  }

  x = Math.max(10, x);
  y = Math.max(10, y);

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

// ============================================
// DOWNTIME LIST
// ============================================

/**
 * Render downtime list
 */
export function renderDowntimeList(downtimeList: DowntimeEntry[]): string {
  if (downtimeList.length === 0) {
    return `<p class="no-data">Sem dados de downtime</p>`;
  }

  return downtimeList
    .slice(0, 5)
    .map(
      (item, index) => `
      <div class="downtime-item">
        <span class="rank">${index + 1}</span>
        <div class="item-info">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="item-location">${escapeHtml(item.location)}</span>
        </div>
        <div class="item-metrics">
          <span class="downtime-hours">${item.downtime}h</span>
          <div class="downtime-bar">
            <div class="bar-fill" style="width: ${Math.min(item.percentage, 100)}%"></div>
          </div>
          <span class="downtime-percentage">${item.percentage.toFixed(1)}%</span>
        </div>
      </div>
    `
    )
    .join('');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// MTBF TIMELINE CHART (RFC-0154)
// ============================================

export interface MTBFTimelineSegment {
  /** Start timestamp (ISO string or Date) */
  startTime: string;
  /** End timestamp (ISO string or Date) */
  endTime: string;
  /** Duration in hours */
  durationHours: number;
  /** State: 'operating', 'stopped', or 'maintenance' */
  state: 'operating' | 'stopped' | 'maintenance';
  /** Optional failure number (for stopped states) */
  failureNumber?: number;
  /** Number of affected equipments (for stopped states) */
  affectedEquipments?: number;
  /** Failure type (for stopped states) */
  failureType?: string;
  /** Number of active equipments (for operating states) */
  activeEquipments?: number;
}

export interface MTBFTimelineData {
  /** Period start date (ISO string) */
  periodStart: string;
  /** Period end date (ISO string) */
  periodEnd: string;
  /** Total equipment count */
  totalEquipment: number;
  /** Total hours in the timeline */
  totalHours: number;
  /** Segments of operation/downtime */
  segments: MTBFTimelineSegment[];
  /** Total operating hours */
  operatingHours: number;
  /** Number of failures (corrective maintenance stops) */
  failureCount: number;
  /** Calculated MTBF value */
  mtbfValue: number;
  /** Calculated MTTR value */
  mttrValue?: number;
}

/**
 * Format date for display (dd/mm)
 */
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/**
 * Format date with time (dd/mm HH:MM)
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hours}:${mins}`;
}

/**
 * Format hours for display (e.g., "96h" or "2h15")
 */
function formatHoursDisplay(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}min`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Render MTBF Timeline Chart (RFC-0154)
 * Shows ON/OFF states with operating periods and failure markers
 * Includes: header with period info, real time scale, tooltips, legend
 */
export function renderMTBFTimelineChart(data: MTBFTimelineData): string {
  // Special state: no segments
  if (!data.segments || data.segments.length === 0) {
    return `
      <div class="mtbf-timeline-empty">
        <div class="empty-icon">⚠️</div>
        <p class="empty-message">Dados insuficientes para exibir timeline de MTBF neste periodo</p>
      </div>
    `;
  }

  // Special state: no failures
  const hasFailures = data.segments.some(s => s.state === 'stopped');
  if (!hasFailures && data.segments.length > 0) {
    const periodText = `${formatDateShort(data.periodStart)} → ${formatDateShort(data.periodEnd)}`;
    return `
      <div class="mtbf-timeline-container">
        <div class="mtbf-timeline-header">
          <span class="header-period">Periodo: ${periodText}</span>
          <span class="header-stats">Equipamentos: ${data.totalEquipment} | Falhas: 0</span>
        </div>
        <div class="mtbf-timeline-no-failures">
          <div class="success-icon">✅</div>
          <p class="success-message">Nenhuma falha registrada neste periodo</p>
          <p class="success-detail">MTBF tende ao infinito</p>
        </div>
        ${renderMTBFLegend()}
      </div>
    `;
  }

  const width = 520;
  const height = 200;
  const padding = { top: 10, right: 20, bottom: 50, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const onY = padding.top + 15;
  const offY = padding.top + chartHeight - 25;
  const barHeight = offY - onY - 10;

  // Calculate segment positions based on time
  const startDate = new Date(data.periodStart).getTime();
  const endDate = new Date(data.periodEnd).getTime();
  const totalMs = endDate - startDate;

  const timeToX = (dateStr: string) => {
    const ms = new Date(dateStr).getTime() - startDate;
    return padding.left + (ms / totalMs) * chartWidth;
  };

  let segmentPaths = '';
  let tooltipAreas = '';
  let durationLabels = '';
  let failureMarkers = '';
  let operatingPeriodNum = 0;

  data.segments.forEach((seg, index) => {
    const x1 = timeToX(seg.startTime);
    const x2 = timeToX(seg.endTime);
    const segWidth = Math.max(x2 - x1, 4); // Min width for visibility

    if (seg.state === 'operating') {
      operatingPeriodNum++;

      // Operating bar (green)
      segmentPaths += `
        <rect x="${x1}" y="${onY}" width="${segWidth}" height="${barHeight}"
          fill="#22c55e" rx="3" class="mtbf-segment operating"
          data-tooltip="Operacao|Inicio: ${formatDateTime(seg.startTime)}|Fim: ${formatDateTime(seg.endTime)}|Duracao: ${formatHoursDisplay(seg.durationHours)}${seg.activeEquipments ? `|Equipamentos ativos: ${seg.activeEquipments}/${data.totalEquipment}` : ''}" />
      `;

      // Duration label inside or below
      const centerX = x1 + segWidth / 2;
      if (segWidth > 50) {
        durationLabels += `
          <text x="${centerX}" y="${onY + barHeight / 2 + 4}" text-anchor="middle"
            font-size="10" font-weight="600" fill="white" class="duration-label">
            ${formatHoursDisplay(seg.durationHours)}
          </text>
        `;
      }

      // Tooltip hover area
      tooltipAreas += `
        <rect x="${x1}" y="${onY}" width="${segWidth}" height="${barHeight}"
          fill="transparent" class="tooltip-trigger"
          data-type="operating"
          data-start="${formatDateTime(seg.startTime)}"
          data-end="${formatDateTime(seg.endTime)}"
          data-duration="${formatHoursDisplay(seg.durationHours)}"
          data-active="${seg.activeEquipments || data.totalEquipment}" />
      `;
    } else if (seg.state === 'stopped') {
      // Failure marker - vertical red line with icon
      const markerX = x1 + segWidth / 2;

      // Red stop bar (small)
      segmentPaths += `
        <rect x="${x1}" y="${offY - 15}" width="${segWidth}" height="20"
          fill="#ef4444" rx="2" class="mtbf-segment stopped"
          data-tooltip="⚠️ Falha detectada|Data: ${formatDateTime(seg.startTime)}|Tempo parado: ${formatHoursDisplay(seg.durationHours)}${seg.affectedEquipments ? `|Equipamentos afetados: ${seg.affectedEquipments}` : ''}${seg.failureType ? `|Tipo: ${seg.failureType}` : ''}" />
      `;

      // Failure icon and label
      failureMarkers += `
        <g class="failure-marker" transform="translate(${markerX}, ${offY + 10})">
          <text x="0" y="0" text-anchor="middle" font-size="14">⚠️</text>
          <text x="0" y="14" text-anchor="middle" font-size="8" fill="var(--ink-2, #94a3b8)">
            ${formatHoursDisplay(seg.durationHours)}
          </text>
        </g>
      `;

      // Vertical dashed line connecting ON to OFF
      segmentPaths += `
        <line x1="${markerX}" y1="${onY + barHeight}" x2="${markerX}" y2="${offY - 15}"
          stroke="#ef4444" stroke-width="2" stroke-dasharray="4,2" />
      `;

      // Tooltip hover area
      tooltipAreas += `
        <rect x="${x1 - 10}" y="${offY - 20}" width="${segWidth + 20}" height="45"
          fill="transparent" class="tooltip-trigger"
          data-type="stopped"
          data-date="${formatDateTime(seg.startTime)}"
          data-duration="${formatHoursDisplay(seg.durationHours)}"
          data-affected="${seg.affectedEquipments || '?'}"
          data-failure-type="${seg.failureType || 'Nao especificado'}" />
      `;
    } else if (seg.state === 'maintenance') {
      // Maintenance bar (orange)
      segmentPaths += `
        <rect x="${x1}" y="${offY - 15}" width="${segWidth}" height="20"
          fill="#f59e0b" rx="2" class="mtbf-segment maintenance" />
      `;

      // Maintenance icon
      const centerX = x1 + segWidth / 2;
      failureMarkers += `
        <g transform="translate(${centerX}, ${offY + 10})">
          <text x="0" y="0" text-anchor="middle" font-size="12">🔧</text>
          <text x="0" y="12" text-anchor="middle" font-size="8" fill="var(--ink-2, #94a3b8)">
            ${formatHoursDisplay(seg.durationHours)}
          </text>
        </g>
      `;

      // Tooltip hover area for maintenance
      tooltipAreas += `
        <rect x="${x1 - 5}" y="${offY - 20}" width="${segWidth + 10}" height="45"
          fill="transparent" class="tooltip-trigger"
          data-type="maintenance"
          data-start="${formatDateTime(seg.startTime)}"
          data-duration="${formatHoursDisplay(seg.durationHours)}" />
      `;
    }
  });

  // Y-axis labels
  const yAxisLabels = `
    <text x="${padding.left - 8}" y="${onY + barHeight / 2}" text-anchor="end" dominant-baseline="middle"
      font-size="10" font-weight="600" fill="var(--ink-1, #f1f5f9)">ON</text>
    <text x="${padding.left - 8}" y="${offY - 5}" text-anchor="end" dominant-baseline="middle"
      font-size="10" font-weight="600" fill="var(--ink-1, #f1f5f9)">OFF</text>
  `;

  // X-axis with dates
  const xAxisY = height - 20;
  const dateLabels = generateXAxisDateLabels(data, padding, chartWidth, xAxisY);

  const xAxis = `
    <line x1="${padding.left}" y1="${xAxisY}" x2="${width - padding.right}" y2="${xAxisY}"
      stroke="var(--border-color, #334155)" stroke-width="1" />
    ${dateLabels}
  `;

  // Period header info
  const periodText = `${formatDateShort(data.periodStart)} → ${formatDateShort(data.periodEnd)}`;

  // SVG chart
  const svgChart = `
    <svg class="mtbf-timeline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${yAxisLabels}
      ${segmentPaths}
      ${durationLabels}
      ${failureMarkers}
      ${xAxis}
      ${tooltipAreas}
    </svg>
  `;

  return `
    <div class="mtbf-timeline-container" data-has-tooltips="true">
      <div class="mtbf-timeline-header">
        <span class="header-period">Periodo: ${periodText}</span>
        <span class="header-stats">Equipamentos: ${data.totalEquipment} | Falhas: ${data.failureCount}</span>
      </div>
      ${svgChart}
      <div class="mtbf-tooltip" id="mtbfTooltip"></div>
      <div class="mtbf-calculation">
        <div class="calc-formula">
          <span class="calc-label">MTBF =</span>
          <span class="calc-values">${formatHoursDisplay(data.operatingHours)} operando / ${data.failureCount} ${data.failureCount === 1 ? 'falha' : 'falhas'}</span>
        </div>
        <div class="calc-result">
          <span class="result-badge">${data.mtbfValue.toFixed(0)}h</span>
          <span class="result-label">MTBF do periodo</span>
        </div>
      </div>
      ${renderMTBFLegend()}
    </div>
  `;
}

/**
 * Generate X-axis date labels based on period
 */
function generateXAxisDateLabels(
  data: MTBFTimelineData,
  padding: { left: number; right: number },
  chartWidth: number,
  y: number
): string {
  const startDate = new Date(data.periodStart);
  const endDate = new Date(data.periodEnd);
  const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  let labels = '';
  let numLabels = 5;

  // Adaptive granularity
  if (totalDays <= 1) {
    numLabels = 4; // Every 6 hours
  } else if (totalDays <= 7) {
    numLabels = Math.min(7, Math.ceil(totalDays)); // Daily
  } else if (totalDays <= 30) {
    numLabels = 5; // Weekly-ish
  } else {
    numLabels = 4; // Monthly
  }

  for (let i = 0; i <= numLabels; i++) {
    const pct = i / numLabels;
    const x = padding.left + pct * chartWidth;
    const labelDate = new Date(startDate.getTime() + pct * (endDate.getTime() - startDate.getTime()));

    let labelText: string;
    if (totalDays <= 1) {
      const hours = String(labelDate.getHours()).padStart(2, '0');
      const mins = String(labelDate.getMinutes()).padStart(2, '0');
      labelText = `${hours}:${mins}`;
    } else {
      const day = String(labelDate.getDate()).padStart(2, '0');
      const month = String(labelDate.getMonth() + 1).padStart(2, '0');
      labelText = `${day}/${month}`;
    }

    labels += `
      <text x="${x}" y="${y + 12}" text-anchor="middle" font-size="9" fill="var(--ink-2, #94a3b8)">
        ${labelText}
      </text>
      <line x1="${x}" y1="${y}" x2="${x}" y2="${y - 4}" stroke="var(--border-color, #334155)" stroke-width="1" />
    `;
  }

  return labels;
}

/**
 * Render legend for MTBF Timeline
 */
function renderMTBFLegend(): string {
  return `
    <div class="mtbf-legend">
      <div class="legend-item">
        <span class="legend-color operating"></span>
        <span class="legend-text">Operacao</span>
      </div>
      <div class="legend-item">
        <span class="legend-color stopped"></span>
        <span class="legend-text">Falha / Parada</span>
      </div>
      <div class="legend-item">
        <span class="legend-color maintenance"></span>
        <span class="legend-text">Manutencao</span>
      </div>
    </div>
  `;
}

/**
 * Position tooltip near cursor, keeping it within viewport
 */
function positionTooltip(tooltip: HTMLElement, clientX: number, clientY: number): void {
  const offset = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Get tooltip dimensions (need to make it visible first to measure)
  tooltip.style.left = '-9999px';
  tooltip.style.top = '-9999px';
  const tooltipRect = tooltip.getBoundingClientRect();

  // Calculate position
  let x = clientX + offset;
  let y = clientY + offset;

  // Keep within viewport horizontally
  if (x + tooltipRect.width > viewportWidth - 10) {
    x = clientX - tooltipRect.width - offset;
  }

  // Keep within viewport vertically
  if (y + tooltipRect.height > viewportHeight - 10) {
    y = clientY - tooltipRect.height - offset;
  }

  // Ensure not negative
  x = Math.max(10, x);
  y = Math.max(10, y);

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

/**
 * Initialize MTBF Timeline tooltips
 * Call this after the chart is rendered in the DOM
 */
export function initMTBFTimelineTooltips(containerId: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const timelineContainer = container.querySelector('.mtbf-timeline-container');
  if (!timelineContainer) return;

  const tooltip = timelineContainer.querySelector('.mtbf-tooltip') as HTMLElement;
  if (!tooltip) return;

  // Find all tooltip triggers
  const triggers = timelineContainer.querySelectorAll('.tooltip-trigger');

  triggers.forEach(trigger => {
    trigger.addEventListener('mouseenter', (e) => {
      const target = e.target as SVGElement;
      const type = target.getAttribute('data-type');

      let tooltipHTML = '';

      if (type === 'operating') {
        const start = target.getAttribute('data-start') || '';
        const end = target.getAttribute('data-end') || '';
        const duration = target.getAttribute('data-duration') || '';
        const active = target.getAttribute('data-active') || '';

        tooltipHTML = `
          <div class="tooltip-title operating">🟢 Operacao</div>
          <div class="tooltip-row">
            <span class="tooltip-label">Inicio:</span>
            <span class="tooltip-value">${start}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Fim:</span>
            <span class="tooltip-value">${end}</span>
          </div>
          <div class="tooltip-divider"></div>
          <div class="tooltip-row">
            <span class="tooltip-label">Duracao:</span>
            <span class="tooltip-value">${duration}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Equipamentos ativos:</span>
            <span class="tooltip-value">${active}</span>
          </div>
        `;
      } else if (type === 'stopped') {
        const date = target.getAttribute('data-date') || '';
        const duration = target.getAttribute('data-duration') || '';
        const affected = target.getAttribute('data-affected') || '';
        const failureType = target.getAttribute('data-failure-type') || '';

        tooltipHTML = `
          <div class="tooltip-title stopped">⚠️ Falha detectada</div>
          <div class="tooltip-row">
            <span class="tooltip-label">Data:</span>
            <span class="tooltip-value">${date}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Tempo parado:</span>
            <span class="tooltip-value">${duration}</span>
          </div>
          <div class="tooltip-divider"></div>
          <div class="tooltip-row">
            <span class="tooltip-label">Equipamentos afetados:</span>
            <span class="tooltip-value">${affected}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Tipo:</span>
            <span class="tooltip-value">${failureType}</span>
          </div>
        `;
      } else if (type === 'maintenance') {
        const start = target.getAttribute('data-start') || '';
        const duration = target.getAttribute('data-duration') || '';

        tooltipHTML = `
          <div class="tooltip-title maintenance">🔧 Manutencao preventiva</div>
          <div class="tooltip-row">
            <span class="tooltip-label">Data:</span>
            <span class="tooltip-value">${start}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Duracao:</span>
            <span class="tooltip-value">${duration}</span>
          </div>
        `;
      }

      tooltip.innerHTML = tooltipHTML;
      tooltip.classList.add('visible');

      // Position tooltip near the cursor (using fixed positioning)
      const mouseEvent = e as MouseEvent;
      positionTooltip(tooltip, mouseEvent.clientX, mouseEvent.clientY);
    });

    trigger.addEventListener('mousemove', (e) => {
      const mouseEvent = e as MouseEvent;
      positionTooltip(tooltip, mouseEvent.clientX, mouseEvent.clientY);
    });

    trigger.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  });
}

/**
 * Generate mock MTBF timeline data
 */
export function generateMockMTBFTimelineData(): MTBFTimelineData {
  // Period: January 2026
  const periodStart = '2026-01-01T00:00:00';
  const periodEnd = '2026-01-31T23:59:59';

  const segments: MTBFTimelineSegment[] = [
    {
      startTime: '2026-01-01T00:00:00',
      endTime: '2026-01-08T14:30:00',
      durationHours: 182.5,
      state: 'operating',
      activeEquipments: 48,
    },
    {
      startTime: '2026-01-08T14:30:00',
      endTime: '2026-01-08T16:45:00',
      durationHours: 2.25,
      state: 'stopped',
      failureNumber: 1,
      affectedEquipments: 3,
      failureType: 'Eletrica',
    },
    {
      startTime: '2026-01-08T16:45:00',
      endTime: '2026-01-18T22:00:00',
      durationHours: 245.25,
      state: 'operating',
      activeEquipments: 47,
    },
    {
      startTime: '2026-01-18T22:00:00',
      endTime: '2026-01-18T23:05:00',
      durationHours: 1.08,
      state: 'stopped',
      failureNumber: 2,
      affectedEquipments: 2,
      failureType: 'Mecanica',
    },
    {
      startTime: '2026-01-18T23:05:00',
      endTime: '2026-01-25T08:00:00',
      durationHours: 152.92,
      state: 'operating',
      activeEquipments: 48,
    },
    {
      startTime: '2026-01-25T08:00:00',
      endTime: '2026-01-25T12:30:00',
      durationHours: 4.5,
      state: 'maintenance',
    },
    {
      startTime: '2026-01-25T12:30:00',
      endTime: '2026-01-31T23:59:59',
      durationHours: 155.5,
      state: 'operating',
      activeEquipments: 48,
    },
  ];

  const operatingHours = segments
    .filter(s => s.state === 'operating')
    .reduce((sum, s) => sum + s.durationHours, 0);

  const failureCount = segments.filter(s => s.state === 'stopped').length;
  const totalHours = (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (1000 * 60 * 60);

  return {
    periodStart,
    periodEnd,
    totalEquipment: 48,
    totalHours,
    segments,
    operatingHours,
    failureCount,
    mtbfValue: failureCount > 0 ? operatingHours / failureCount : operatingHours,
  };
}

/**
 * Update MTBF timeline chart in the DOM
 */
export function updateMTBFTimelineChart(containerId: string, data: MTBFTimelineData): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = renderMTBFTimelineChart(data);
}

// ============================================
// CHART UPDATE FUNCTIONS
// ============================================

/**
 * Update availability chart in the DOM (RFC-0156 Enhanced + Feedback)
 */
export function updateAvailabilityChart(
  containerId: string,
  data: TrendDataPoint[],
  config?: {
    periodLabel?: string;
    scaleMode?: 'full' | 'zoom';
    slaTarget?: number;
    showTrendLine?: boolean;
  }
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentScaleMode = config?.scaleMode || 'full';

  container.innerHTML = renderAvailabilityChart(data, {
    periodLabel: config?.periodLabel,
    scaleMode: currentScaleMode,
    slaTarget: config?.slaTarget,
    showTrendLine: config?.showTrendLine ?? true,
  });

  // Re-initialize tooltips with scale toggle callback
  initAvailabilityChartTooltips(containerId, (newMode) => {
    // Re-render with new scale mode
    updateAvailabilityChart(containerId, data, {
      ...config,
      scaleMode: newMode,
    });
  });
}

/**
 * Update MTBF/MTTR chart in the DOM
 */
export function updateMtbfMttrChart(containerId: string, data: TrendDataPoint[]): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = renderDualLineChart(data);
}

/**
 * Update status donut chart in the DOM
 */
export function updateStatusChart(containerId: string, kpis: DashboardKPIs): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = renderStatusDonutChart(kpis);
}

/**
 * Update downtime list in the DOM
 */
export function updateDowntimeListDOM(containerId: string, downtimeList: DowntimeEntry[]): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = renderDowntimeList(downtimeList);
}
