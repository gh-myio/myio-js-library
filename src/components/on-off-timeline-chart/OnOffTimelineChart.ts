/**
 * RFC-0167: On/Off Timeline Chart Component
 * SVG-based timeline chart showing on/off activations
 */

import { ONOFF_TIMELINE_CSS_PREFIX, injectOnOffTimelineStyles } from './styles';
import type {
  OnOffTimelineData,
  OnOffTimelineChartConfig,
  OnOffTimelineChartInstance,
  OnOffTimelineChartParams,
  OnOffTimelineSegment,
} from './types';

const DEFAULT_CONFIG: Required<OnOffTimelineChartConfig> = {
  width: 500,
  height: 180,
  onColor: '#22c55e',
  offColor: '#94a3b8',
  showMarkers: true,
  showDurationLabels: true,
  showLegend: true,
  themeMode: 'light',
  labels: {
    on: 'Ligado',
    off: 'Desligado',
  },
};

/**
 * Format duration for display
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h${String(mins).padStart(2, '0')}`;
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
 * Render the SVG timeline chart
 */
function renderTimelineSVG(
  data: OnOffTimelineData,
  config: Required<OnOffTimelineChartConfig>
): string {
  const { width, height, onColor, offColor, showMarkers, showDurationLabels, labels } = config;
  const padding = { top: 10, right: 20, bottom: 45, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const onY = padding.top + 10;
  const offY = padding.top + chartHeight - 20;
  const barHeight = offY - onY - 10;

  // Calculate time range
  const startDate = new Date(data.periodStart).getTime();
  const endDate = new Date(data.periodEnd).getTime();
  const totalMs = endDate - startDate;

  const timeToX = (dateStr: string) => {
    const ms = new Date(dateStr).getTime() - startDate;
    return padding.left + (ms / totalMs) * chartWidth;
  };

  let segmentPaths = '';
  let durationLabels = '';
  let markers = '';
  let tooltipAreas = '';

  data.segments.forEach((seg, index) => {
    const x1 = timeToX(seg.startTime);
    const x2 = timeToX(seg.endTime);
    const segWidth = Math.max(x2 - x1, 4); // Min width for visibility
    const isOn = seg.state === 'on';
    const y = isOn ? onY : offY - 15;
    const h = isOn ? barHeight : 15;
    const color = isOn ? onColor : offColor;
    const stateClass = isOn ? 'on' : 'off';

    // Segment bar
    segmentPaths += `
      <rect
        x="${x1}" y="${y}" width="${segWidth}" height="${h}"
        fill="${color}" rx="3"
        class="${ONOFF_TIMELINE_CSS_PREFIX}__segment ${ONOFF_TIMELINE_CSS_PREFIX}__segment--${stateClass}"
        data-index="${index}"
      />
    `;

    // Duration label inside bar (only for larger segments)
    if (showDurationLabels && segWidth > 45) {
      const centerX = x1 + segWidth / 2;
      const centerY = y + h / 2 + 3;
      durationLabels += `
        <text
          x="${centerX}" y="${centerY}"
          text-anchor="middle"
          class="${ONOFF_TIMELINE_CSS_PREFIX}__duration-label"
        >
          ${formatDuration(seg.durationMinutes)}
        </text>
      `;
    }

    // Activation marker (when transitioning to ON)
    if (showMarkers && isOn && index > 0) {
      const markerX = x1;
      markers += `
        <g class="${ONOFF_TIMELINE_CSS_PREFIX}__marker" transform="translate(${markerX}, ${onY - 12})">
          <text x="0" y="0" text-anchor="middle" class="${ONOFF_TIMELINE_CSS_PREFIX}__marker-icon">
            ▼
          </text>
        </g>
        <line
          x1="${markerX}" y1="${onY - 2}" x2="${markerX}" y2="${offY - 15}"
          class="${ONOFF_TIMELINE_CSS_PREFIX}__marker-line"
        />
      `;
    }

    // Tooltip trigger area
    tooltipAreas += `
      <rect
        x="${x1}" y="${y}" width="${segWidth}" height="${h}"
        fill="transparent"
        class="tooltip-trigger"
        data-state="${stateClass}"
        data-start="${formatDateTime(seg.startTime)}"
        data-end="${formatDateTime(seg.endTime)}"
        data-duration="${formatDuration(seg.durationMinutes)}"
        data-source="${seg.source || 'unknown'}"
      />
    `;
  });

  // Y-axis labels
  const yAxisLabels = `
    <text
      x="${padding.left - 8}" y="${onY + barHeight / 2}"
      text-anchor="end" dominant-baseline="middle"
      class="${ONOFF_TIMELINE_CSS_PREFIX}__axis-label"
    >
      ${labels.on}
    </text>
    <text
      x="${padding.left - 8}" y="${offY - 8}"
      text-anchor="end" dominant-baseline="middle"
      class="${ONOFF_TIMELINE_CSS_PREFIX}__axis-label"
    >
      ${labels.off}
    </text>
  `;

  // X-axis with dates
  const xAxisY = height - 15;
  const dateLabels = generateXAxisLabels(data, padding, chartWidth, xAxisY);

  const xAxis = `
    <line
      x1="${padding.left}" y1="${xAxisY - 5}"
      x2="${width - padding.right}" y2="${xAxisY - 5}"
      stroke="var(--onoff-timeline-border, #e5e7eb)" stroke-width="1"
    />
    ${dateLabels}
  `;

  return `
    <svg
      class="${ONOFF_TIMELINE_CSS_PREFIX}__svg"
      viewBox="0 0 ${width} ${height}"
      preserveAspectRatio="xMidYMid meet"
    >
      ${yAxisLabels}
      ${segmentPaths}
      ${durationLabels}
      ${markers}
      ${xAxis}
      ${tooltipAreas}
    </svg>
  `;
}

/**
 * Generate X-axis date labels
 */
function generateXAxisLabels(
  data: OnOffTimelineData,
  padding: { left: number; right: number },
  chartWidth: number,
  y: number
): string {
  const startDate = new Date(data.periodStart);
  const endDate = new Date(data.periodEnd);
  const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  let labels = '';
  let numLabels = 5;

  if (totalDays <= 1) {
    numLabels = 4;
  } else if (totalDays <= 7) {
    numLabels = Math.min(7, Math.ceil(totalDays));
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
      labelText = formatDateShort(labelDate.toISOString());
    }

    labels += `
      <text
        x="${x}" y="${y}"
        text-anchor="middle"
        class="${ONOFF_TIMELINE_CSS_PREFIX}__date-label"
      >
        ${labelText}
      </text>
      <line
        x1="${x}" y1="${y - 15}" x2="${x}" y2="${y - 11}"
        stroke="var(--onoff-timeline-border, #e5e7eb)" stroke-width="1"
      />
    `;
  }

  return labels;
}

/**
 * Render summary section
 */
function renderSummary(data: OnOffTimelineData, labels: { on?: string; off?: string }): string {
  const onPercent = data.totalHours > 0
    ? ((data.totalOnMinutes / 60 / data.totalHours) * 100).toFixed(1)
    : '0';

  return `
    <div class="${ONOFF_TIMELINE_CSS_PREFIX}__summary">
      <div class="${ONOFF_TIMELINE_CSS_PREFIX}__summary-item">
        <span class="${ONOFF_TIMELINE_CSS_PREFIX}__summary-value ${ONOFF_TIMELINE_CSS_PREFIX}__summary-value--on">
          ${data.activationCount}
        </span>
        <span class="${ONOFF_TIMELINE_CSS_PREFIX}__summary-label">Acionamentos</span>
      </div>
      <div class="${ONOFF_TIMELINE_CSS_PREFIX}__summary-item">
        <span class="${ONOFF_TIMELINE_CSS_PREFIX}__summary-value">
          ${formatDuration(data.totalOnMinutes)}
        </span>
        <span class="${ONOFF_TIMELINE_CSS_PREFIX}__summary-label">Tempo ${labels.on || 'ON'}</span>
      </div>
      <div class="${ONOFF_TIMELINE_CSS_PREFIX}__summary-item">
        <span class="${ONOFF_TIMELINE_CSS_PREFIX}__summary-value">
          ${onPercent}%
        </span>
        <span class="${ONOFF_TIMELINE_CSS_PREFIX}__summary-label">Utilização</span>
      </div>
    </div>
  `;
}

/**
 * Render legend
 */
function renderLegend(labels: { on?: string; off?: string }): string {
  return `
    <div class="${ONOFF_TIMELINE_CSS_PREFIX}__legend">
      <div class="${ONOFF_TIMELINE_CSS_PREFIX}__legend-item">
        <span class="${ONOFF_TIMELINE_CSS_PREFIX}__legend-color ${ONOFF_TIMELINE_CSS_PREFIX}__legend-color--on"></span>
        <span>${labels.on || 'Ligado'}</span>
      </div>
      <div class="${ONOFF_TIMELINE_CSS_PREFIX}__legend-item">
        <span class="${ONOFF_TIMELINE_CSS_PREFIX}__legend-color ${ONOFF_TIMELINE_CSS_PREFIX}__legend-color--off"></span>
        <span>${labels.off || 'Desligado'}</span>
      </div>
    </div>
  `;
}

/**
 * Render empty state
 */
function renderEmptyState(): string {
  return `
    <div class="${ONOFF_TIMELINE_CSS_PREFIX}__empty">
      <div class="${ONOFF_TIMELINE_CSS_PREFIX}__empty-icon">📊</div>
      <p class="${ONOFF_TIMELINE_CSS_PREFIX}__empty-message">
        Sem dados de acionamentos para exibir
      </p>
    </div>
  `;
}

/**
 * Render the complete chart HTML
 */
function renderChart(data: OnOffTimelineData, config: Required<OnOffTimelineChartConfig>): string {
  const periodText = `${formatDateShort(data.periodStart)} → ${formatDateShort(data.periodEnd)}`;
  const themeClass = config.themeMode === 'dark' ? `${ONOFF_TIMELINE_CSS_PREFIX}--dark` : '';

  // Empty state
  if (!data.segments || data.segments.length === 0) {
    return `
      <div class="${ONOFF_TIMELINE_CSS_PREFIX} ${themeClass}">
        <div class="${ONOFF_TIMELINE_CSS_PREFIX}__container">
          ${renderEmptyState()}
        </div>
      </div>
    `;
  }

  return `
    <div class="${ONOFF_TIMELINE_CSS_PREFIX} ${themeClass}" data-has-tooltips="true">
      <div class="${ONOFF_TIMELINE_CSS_PREFIX}__container">
        <div class="${ONOFF_TIMELINE_CSS_PREFIX}__header">
          <span class="${ONOFF_TIMELINE_CSS_PREFIX}__header-period">Período: ${periodText}</span>
          <span class="${ONOFF_TIMELINE_CSS_PREFIX}__header-stats">
            ${data.activationCount} acionamento${data.activationCount !== 1 ? 's' : ''}
          </span>
        </div>
        ${renderTimelineSVG(data, config)}
        ${renderSummary(data, config.labels)}
        ${config.showLegend ? renderLegend(config.labels) : ''}
        <div class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip" id="onoff-timeline-tooltip"></div>
      </div>
    </div>
  `;
}

/**
 * Position tooltip near cursor
 */
function positionTooltip(tooltip: HTMLElement, clientX: number, clientY: number): void {
  const offset = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  tooltip.style.left = '-9999px';
  tooltip.style.top = '-9999px';
  const tooltipRect = tooltip.getBoundingClientRect();

  let x = clientX + offset;
  let y = clientY + offset;

  if (x + tooltipRect.width > viewportWidth - 10) {
    x = clientX - tooltipRect.width - offset;
  }
  if (y + tooltipRect.height > viewportHeight - 10) {
    y = clientY - tooltipRect.height - offset;
  }

  x = Math.max(10, x);
  y = Math.max(10, y);

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

/**
 * Initialize tooltips for the chart
 */
function initTooltips(container: HTMLElement, labels: { on?: string; off?: string }): void {
  const tooltip = container.querySelector(`.${ONOFF_TIMELINE_CSS_PREFIX}__tooltip`) as HTMLElement;
  if (!tooltip) return;

  const triggers = container.querySelectorAll('.tooltip-trigger');

  triggers.forEach(trigger => {
    trigger.addEventListener('mouseenter', (e) => {
      const target = e.target as SVGElement;
      const state = target.getAttribute('data-state');
      const start = target.getAttribute('data-start') || '';
      const end = target.getAttribute('data-end') || '';
      const duration = target.getAttribute('data-duration') || '';
      const source = target.getAttribute('data-source') || 'unknown';

      const isOn = state === 'on';
      const stateLabel = isOn ? (labels.on || 'Ligado') : (labels.off || 'Desligado');
      const stateIcon = isOn ? '🟢' : '⚪';
      const titleClass = isOn ? 'on' : 'off';

      const sourceLabels: Record<string, string> = {
        manual: 'Manual',
        schedule: 'Agendamento',
        automation: 'Automacao',
        unknown: 'Desconhecido',
      };

      tooltip.innerHTML = `
        <div class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-title ${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-title--${titleClass}">
          ${stateIcon} ${stateLabel}
        </div>
        <div class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-row">
          <span class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-label">Inicio:</span>
          <span class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-value">${start}</span>
        </div>
        <div class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-row">
          <span class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-label">Fim:</span>
          <span class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-value">${end}</span>
        </div>
        <div class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-row">
          <span class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-label">Duracao:</span>
          <span class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-value">${duration}</span>
        </div>
        <div class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-row">
          <span class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-label">Origem:</span>
          <span class="${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-value">${sourceLabels[source] || source}</span>
        </div>
      `;
      tooltip.classList.add('visible');

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
 * Create On/Off Timeline Chart instance
 */
export function createOnOffTimelineChart(params: OnOffTimelineChartParams): OnOffTimelineChartInstance {
  injectOnOffTimelineStyles();

  const config: Required<OnOffTimelineChartConfig> = {
    ...DEFAULT_CONFIG,
    ...params.config,
    labels: {
      ...DEFAULT_CONFIG.labels,
      ...params.config?.labels,
    },
  };

  // Get container
  const container = typeof params.container === 'string'
    ? document.querySelector(params.container) as HTMLElement
    : params.container;

  if (!container) {
    throw new Error('[OnOffTimelineChart] Container not found');
  }

  // Render chart
  container.innerHTML = renderChart(params.data, config);
  initTooltips(container, config.labels);

  // Return instance
  return {
    element: container,
    update: (newData: OnOffTimelineData) => {
      container.innerHTML = renderChart(newData, config);
      initTooltips(container, config.labels);
    },
    setTheme: (mode: 'light' | 'dark') => {
      config.themeMode = mode;
      container.innerHTML = renderChart(params.data, config);
      initTooltips(container, config.labels);
    },
    destroy: () => {
      container.innerHTML = '';
    },
  };
}

/**
 * Render On/Off Timeline Chart HTML (static rendering)
 * Use this when you just need the HTML string
 */
export function renderOnOffTimelineChart(
  data: OnOffTimelineData,
  config?: OnOffTimelineChartConfig
): string {
  const fullConfig: Required<OnOffTimelineChartConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
    labels: {
      ...DEFAULT_CONFIG.labels,
      ...config?.labels,
    },
  };
  return renderChart(data, fullConfig);
}

/**
 * Initialize tooltips for a rendered On/Off Timeline Chart
 * Call this after inserting the HTML from renderOnOffTimelineChart into the DOM
 */
export function initOnOffTimelineTooltips(
  container: HTMLElement,
  labels?: { on?: string; off?: string }
): void {
  initTooltips(container, labels || DEFAULT_CONFIG.labels);
}

/**
 * Generate mock On/Off Timeline data
 */
export function generateMockOnOffTimelineData(): OnOffTimelineData {
  // Period: Last 7 days
  const now = new Date();
  const periodEnd = now.toISOString();
  const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Generate mock segments
  const segments: OnOffTimelineSegment[] = [];
  let currentTime = new Date(periodStart);
  let isOn = false;
  let totalOnMinutes = 0;
  let activationCount = 0;

  while (currentTime < now) {
    isOn = !isOn;
    const startTime = currentTime.toISOString();

    // Random duration: 30 min to 12 hours for ON, 1-6 hours for OFF
    const durationMinutes = isOn
      ? Math.floor(Math.random() * 660) + 30 // 30min to 12h
      : Math.floor(Math.random() * 300) + 60; // 1h to 6h

    currentTime = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);
    if (currentTime > now) {
      currentTime = now;
    }

    const endTime = currentTime.toISOString();
    const actualDuration = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000;

    segments.push({
      startTime,
      endTime,
      durationMinutes: actualDuration,
      state: isOn ? 'on' : 'off',
      source: ['manual', 'schedule', 'automation'][Math.floor(Math.random() * 3)] as 'manual' | 'schedule' | 'automation',
    });

    if (isOn) {
      totalOnMinutes += actualDuration;
      activationCount++;
    }
  }

  return {
    deviceId: 'mock-device-001',
    deviceName: 'Solenoide Jardim 1',
    periodStart,
    periodEnd,
    totalHours: 7 * 24,
    segments,
    totalOnMinutes,
    totalOffMinutes: 7 * 24 * 60 - totalOnMinutes,
    activationCount,
    currentState: isOn ? 'on' : 'off',
  };
}
