/**
 * RFC-0152 Phase 4: Alarm Details Modal
 * Premium right-side drawer with occurrence timeline, device map, and full alarm info
 */

import type { Alarm } from '../../types/alarm';
import { SEVERITY_CONFIG, STATE_CONFIG } from '../../types/alarm';
import {
  buildAnnotationsPanelHtml,
  bindAnnotationsPanelEvents,
  getActiveAnnotationCount,
} from './AlarmAnnotations';

// =====================================================================
// Helpers
// =====================================================================

function fmt(isoString: string | number | null | undefined): string {
  if (!isoString) return '-';
  const d = new Date(isoString as string);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function fmtDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function durationLabel(ms: number): string {
  if (ms < 60_000) return '< 1 min';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function escHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =====================================================================
// Timeline builder
// =====================================================================

function buildTimeline(alarm: Alarm, groupMode?: string): string {
  const count = alarm.occurrenceCount || 1;
  const firstMs = new Date(alarm.firstOccurrence).getTime();
  const lastMs = new Date(alarm.lastOccurrence).getTime();
  const interval = count > 1 ? (lastMs - firstMs) / (count - 1) : 0;

  const deviceTokens = alarm.source
    ? alarm.source.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
    : [];

  // Value pill: only on the most recent occurrence (triggerValue is from the latest record)
  const valuePillHtml = alarm.triggerValue != null
    ? `<span class="adm-timeline-value-pill">${escHtml(String(alarm.triggerValue))}</span>`
    : '';

  // Device label function: depends on groupMode
  // separado: no device; consolidado/default: always show, rotate for multi-device
  const deviceSpanFn: (n: number) => string = groupMode === 'separado'
    ? (_n: number) => ''
    : (n: number) => {
        if (deviceTokens.length === 0) return '';
        const token = deviceTokens[(n - 1) % deviceTokens.length];
        return `<span class="adm-timeline-sep">|</span><span class="adm-timeline-device">${escHtml(token)}</span>`;
      };

  // porDispositivo: grouped sections per alarm type from _alarmTypeGroups
  function buildGroupedTimeline(): string {
    const groups = alarm._alarmTypeGroups;
    if (!groups?.length) return buildFlatTimeline();

    return groups.map((grp, gi) => {
      const gCount = grp.occurrenceCount || 1;
      const gFirstMs = new Date(grp.firstOccurrence).getTime();
      const gLastMs = new Date(grp.lastOccurrence).getTime();
      const gInterval = gCount > 1 ? (gLastMs - gFirstMs) / (gCount - 1) : 0;
      const gValuePill = grp.triggerValue != null
        ? `<span class="adm-timeline-value-pill">${escHtml(String(grp.triggerValue))}</span>`
        : '';

      const items: string[] = [];
      const MAX_PER_GROUP = 10;
      for (let i = gCount; i >= 1; i--) {
        const tsMs = gFirstMs + gInterval * (i - 1);
        const isSingle = gCount === 1;
        const isLatest = i === gCount && !isSingle;
        const isFirst = i === 1 && !isSingle;
        const isEstimated = !isSingle && !isLatest && !isFirst;
        const timeStr = (isEstimated ? '~' : '') + fmt(tsMs);
        const extraClass = isSingle ? 'is-single' : isLatest ? 'is-last' : isFirst ? 'is-first' : '';
        const showPill = isSingle || isLatest;
        items.push(`
          <div class="adm-timeline-item ${extraClass}">
            <div class="adm-timeline-dot"></div>
            <span class="adm-timeline-num">#${i}</span>
            <span class="adm-timeline-sep">|</span>
            <span class="adm-timeline-time">${timeStr}</span>
            ${showPill ? gValuePill : ''}
          </div>`);
        if (items.length >= MAX_PER_GROUP) break;
      }

      return `<div class="adm-timeline-group${gi > 0 ? ' adm-timeline-group--sep' : ''}">
        <div class="adm-timeline-group-header">${escHtml(grp.title)}<span class="adm-timeline-group-count">${gCount}</span></div>
        ${items.join('')}
      </div>`;
    }).join('');
  }

  function buildFlatTimeline(): string {
    function occItem(
      n: number,
      tsMs: number,
      meta: string,
      extraClass = ''
    ): string {
      // Pill only on most-recent; estimated occurrences show ~ before the date
      const isLatest = extraClass.includes('is-last') || extraClass.includes('is-single');
      const isEstimated = meta === 'Estimado';
      const timeStr = (isEstimated ? '~' : '') + fmt(tsMs);
      return `
        <div class="adm-timeline-item ${extraClass}">
          <div class="adm-timeline-dot"></div>
          <span class="adm-timeline-num">#${n}</span>
          <span class="adm-timeline-sep">|</span>
          <span class="adm-timeline-time">${timeStr}</span>
          ${deviceSpanFn(n)}
          ${isLatest ? valuePillHtml : ''}
        </div>`;
    }

    // Show all occurrences most-recent first, capped at 30 (scroll handles the rest)
    const MAX_SHOWN = 30;
    const items: string[] = [];

    for (let i = count; i >= 1; i--) {
      const tsMs = firstMs + interval * (i - 1);
      let meta: string;
      let extraClass: string;

      if (count === 1) {
        meta = 'Único registro detectado';
        extraClass = 'is-single';
      } else if (i === count) {
        meta = 'Mais recente';
        extraClass = 'is-last';
      } else if (i === 1) {
        meta = 'Primeiro registro';
        extraClass = 'is-first';
      } else {
        meta = 'Estimado';
        extraClass = '';
      }

      items.push(occItem(i, tsMs, meta, extraClass));
      if (items.length >= MAX_SHOWN) break;
    }

    return items.join('');
  }

  if (groupMode === 'porDispositivo') return buildGroupedTimeline();
  return buildFlatTimeline();
}

// =====================================================================
// Chart helpers
// =====================================================================

/** Deterministic pseudo-random seeded by a number */
function seededRand(seed: number): () => number {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = (s ^ (s >>> 16)) >>> 0;
    return s / 0xffffffff;
  };
}

/** Hash a string to a stable integer */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface Bucket {
  label: string;
  total: number;
  byDevice: Record<string, number>; // device → count
}

/**
 * Generate synthetic time-bucketed occurrence data.
 * Distributes occurrenceCount across buckets using seeded noise + bell curve.
 */
function generateBuckets(alarm: Alarm, devices: string[], period: Period = 'mes'): Bucket[] {
  const count = alarm.occurrenceCount || 1;
  let firstMs = new Date(alarm.firstOccurrence as string).getTime();
  let lastMs  = new Date(alarm.lastOccurrence  as string).getTime();
  // Guard against invalid / missing dates (e.g. grouped alarms with undefined fields)
  if (isNaN(firstMs) || isNaN(lastMs) || firstMs <= 0 || lastMs <= 0) {
    lastMs  = Date.now();
    firstMs = lastMs - 7 * 86_400_000;
  }
  const durMs = Math.max(lastMs - firstMs, 3_600_000); // at least 1h

  let numBuckets: number;
  let bucketMs: number;
  let labelFn: (ms: number) => string;

  const nowMs = Date.now();
  if (period === 'hora') {
    bucketMs = 3_600_000;
    numBuckets = Math.max(2, Math.min(24, Math.ceil(durMs / bucketMs)));
    labelFn = (ms) => `${String(new Date(ms).getHours()).padStart(2, '0')}h`;
  } else if (period === 'dia') {
    bucketMs = 86_400_000;
    numBuckets = Math.max(1, Math.min(31, Math.ceil(durMs / bucketMs)));
    labelFn = (ms) => {
      const d = new Date(ms);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
  } else if (period === 'semana') {
    bucketMs = 7 * 86_400_000;
    numBuckets = Math.max(1, Math.min(26, Math.ceil(durMs / bucketMs)));
    labelFn = (ms) => {
      const d = new Date(ms);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
  } else {
    // 'mes'
    bucketMs = 30 * 86_400_000;
    numBuckets = Math.max(1, Math.min(24, Math.ceil(durMs / bucketMs)));
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    labelFn = (ms) => months[new Date(ms).getMonth()];
  }
  // Cap buckets so last bucket doesn't exceed today
  while (numBuckets > 1 && firstMs + (numBuckets - 1) * bucketMs > nowMs) numBuckets--;

  const seed = hashStr(alarm.id + period);
  const rand = seededRand(seed);

  // Generate weight per bucket (bell-curve + noise)
  const weights = Array.from({ length: numBuckets }, (_, i) => {
    const center = (numBuckets - 1) / 2;
    const bell = 1 - 0.45 * Math.abs(i - center) / (center || 1);
    return Math.max(0.1, bell * (0.6 + rand() * 0.8));
  });
  const wSum = weights.reduce((a, b) => a + b, 0);

  // Distribute count across buckets
  const totals: number[] = new Array(numBuckets).fill(0);
  let remaining = count;
  for (let i = 0; i < numBuckets - 1; i++) {
    const v = Math.round((weights[i] / wSum) * count);
    totals[i] = Math.min(v, remaining);
    remaining -= totals[i];
  }
  totals[numBuckets - 1] = Math.max(0, remaining);

  // Distribute each bucket's total across devices
  return Array.from({ length: numBuckets }, (_, i) => {
    const ts = firstMs + i * bucketMs;
    const total = totals[i];
    const byDevice: Record<string, number> = {};
    if (devices.length === 1) {
      byDevice[devices[0]] = total;
    } else {
      let rem = total;
      for (let d = 0; d < devices.length - 1; d++) {
        const share = Math.round(rand() * rem * (1 / (devices.length - d)));
        byDevice[devices[d]] = share;
        rem -= share;
      }
      byDevice[devices[devices.length - 1]] = Math.max(0, rem);
    }
    return { label: labelFn(ts), total, byDevice };
  });
}

/** Generate day-of-week distribution (0=Sun…6=Sat) */
function generateDowDistribution(alarm: Alarm): number[] {
  const count = alarm.occurrenceCount || 1;
  const rand = seededRand(hashStr(alarm.id + 'dow'));
  const weights = [0.2, 1, 0.95, 0.9, 0.85, 0.8, 0.3]; // Sun–Sat bias
  const wSum = weights.reduce((a, b) => a + b, 0);
  const vals = weights.map((w) => Math.round((w / wSum) * count * (0.7 + rand() * 0.6)));
  return vals;
}

/** Generate hour-of-day distribution (0–23) */
function generateHodDistribution(alarm: Alarm): number[] {
  const count = alarm.occurrenceCount || 1;
  const rand = seededRand(hashStr(alarm.id + 'hod'));
  // Business-hours bias (peak 10-19)
  const weights = Array.from({ length: 24 }, (_, h) => {
    if (h < 6) return 0.05 + rand() * 0.05;
    if (h < 10) return 0.3 + rand() * 0.3;
    if (h <= 19) return 0.7 + rand() * 0.6;
    if (h <= 22) return 0.3 + rand() * 0.3;
    return 0.05 + rand() * 0.05;
  });
  const wSum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.max(0, Math.round((w / wSum) * count)));
}

// Device palette
const DEV_COLORS = [
  '#7c3aed', '#2563eb', '#16a34a', '#d97706',
  '#dc2626', '#0891b2', '#9333ea', '#65a30d',
];

type VizMode = 'total' | 'separate';
type Period = 'hora' | 'dia' | 'semana' | 'mes';

// ─────────────────────────────────────────────────────────────────────────────
// Chart.js helpers  (CDN: chart.js@4.4.x UMD → window.Chart)
// ─────────────────────────────────────────────────────────────────────────────

function getChartLib(): any {
  return (window as any).Chart ?? null;
}

function createMainChart(
  canvas: HTMLCanvasElement,
  buckets: Bucket[],
  devices: string[],
  chartType: 'bar' | 'line',
  vizMode: 'total' | 'separate',
  singleColor: string
): any {
  const Chart = getChartLib();
  if (!Chart) return null;

  const labels = buckets.map((b) => b.label);
  const isMulti = vizMode === 'separate' && devices.length > 1;

  const datasets: any[] = isMulti
    ? devices.map((dev, di) => {
        const color = DEV_COLORS[di % DEV_COLORS.length];
        return {
          label: dev,
          data: buckets.map((b) => b.byDevice[dev] ?? 0),
          backgroundColor: chartType === 'bar' ? color + 'bb' : color + '22',
          borderColor: color,
          borderWidth: chartType === 'line' ? 2 : 1,
          borderRadius: chartType === 'bar' ? 3 : 0,
          tension: chartType === 'line' ? 0.4 : 0,
          fill: chartType === 'line',
          pointRadius: chartType === 'line' ? 3 : 0,
          pointHoverRadius: 6,
        };
      })
    : [{
        label: 'Ocorrências',
        data: buckets.map((b) => b.total),
        backgroundColor: chartType === 'bar' ? singleColor + 'bb' : singleColor + '22',
        borderColor: singleColor,
        borderWidth: chartType === 'line' ? 2.5 : 1,
        borderRadius: chartType === 'bar' ? 3 : 0,
        tension: chartType === 'line' ? 0.4 : 0,
        fill: chartType === 'line',
        pointRadius: chartType === 'line' ? 3 : 0,
        pointHoverRadius: 6,
      }];

  return new Chart(canvas, {
    type: chartType,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: {
          display: isMulti,
          position: 'bottom',
          labels: { font: { size: 10 }, boxWidth: 10, padding: 10 },
        },
        tooltip: {
          callbacks: {
            title: (items: any[]) => `Período: ${items[0]?.label ?? ''}`,
            label: (item: any) => ` ${item.dataset.label}: ${item.parsed.y} ocorrências`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#f3f4f6' },
          ticks: { font: { size: 9 }, color: '#9ca3af', maxRotation: 45 },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f3f4f6' },
          ticks: { font: { size: 9 }, color: '#9ca3af', precision: 0 },
        },
      },
    },
  });
}

function createDowChart(canvas: HTMLCanvasElement, vals: number[]): any {
  const Chart = getChartLib();
  if (!Chart) return null;
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
      datasets: [{
        label: 'Ocorrências',
        data: vals,
        backgroundColor: '#8b5cf6bb',
        borderColor: '#7c3aed',
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item: any) => ` ${item.parsed.x} ocorrências`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#f3f4f6' },
          ticks: { font: { size: 9 }, color: '#9ca3af', precision: 0 },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: '#374151' },
        },
      },
    },
  });
}

function createHodChart(canvas: HTMLCanvasElement, vals: number[]): any {
  const Chart = getChartLib();
  if (!Chart) return null;
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 24 }, (_, h) => `${h}h`),
      datasets: [{
        label: 'Ocorrências',
        data: vals,
        backgroundColor: '#3b82f6bb',
        borderColor: '#2563eb',
        borderWidth: 1,
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items: any[]) => `${items[0]?.label}`,
            label: (item: any) => ` ${item.parsed.y} ocorrências`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 9 }, color: '#9ca3af' },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f3f4f6' },
          ticks: { font: { size: 9 }, color: '#9ca3af', precision: 0 },
        },
      },
    },
  });
}

// =====================================================================
// Device list parser — source may be "dev-01, dev-02; dev-03" or single
// =====================================================================

function parseDevices(source: string): string[] {
  return source
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// =====================================================================
// Main export
// =====================================================================

export function openAlarmDetailsModal(
  alarm: Alarm,
  themeMode: 'light' | 'dark' = 'light',
  groupMode?: 'consolidado' | 'separado' | 'porDispositivo'
): void {
  const sev = SEVERITY_CONFIG[alarm.severity];
  const st = STATE_CONFIG[alarm.state];

  const count = alarm.occurrenceCount || 1;
  const firstMs = new Date(alarm.firstOccurrence).getTime();
  const lastMs = new Date(alarm.lastOccurrence).getTime();
  const durMs = Math.max(0, lastMs - firstMs);
  const durLabel = durationLabel(durMs);
  const avgFreq =
    count > 1
      ? durationLabel(durMs / (count - 1)) + ' entre ocorrências'
      : 'Evento único';

  const devices = parseDevices(alarm.source);
  const deviceCount = devices.length;


  // Conditional rows helper
  const row = (label: string, value: string | undefined | null) =>
    value
      ? `<div class="adm-row"><span class="adm-row-label">${label}</span><span class="adm-row-value">${escHtml(value)}</span></div>`
      : '';

  // Device list HTML
  const devicesListHtml = devices
    .map(
      (dev, i) => `
      <div class="adm-device-row">
        <span class="adm-device-row-index">${i + 1}</span>
        <div class="adm-device-icon-sm">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#7c3aed" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        </div>
        <span class="adm-device-row-name">${escHtml(dev)}</span>
        <span class="adm-device-row-sub">${escHtml(alarm.customerName || '-')}</span>
      </div>`
    )
    .join('');

  // Pre-render chart data (deterministic, seeded by alarm.id)
  const initialPeriod: Period =
    durMs < 86_400_000 ? 'hora' :
    durMs < 7 * 86_400_000 ? 'dia' :
    durMs < 30 * 86_400_000 ? 'semana' : 'mes';
  const dowVals = generateDowDistribution(alarm);
  const hodVals = generateHodDistribution(alarm);
  const chartSingleColor = sev.text || '#7c3aed';

  // Annotation count (persisted across modal open/close in session)
  const annotCount = getActiveAnnotationCount(alarm.id);

  // Header source display
  const sourceDisplay =
    deviceCount > 1
      ? `${deviceCount} dispositivos`
      : escHtml(alarm.source);

  const overlay = document.createElement('div');
  overlay.className = 'adm-overlay';
  overlay.setAttribute('data-theme', themeMode);

  overlay.innerHTML = `
    <div class="adm-drawer" role="dialog" aria-modal="true" aria-label="Detalhes do alarme">

      <!-- ── Header ── -->
      <div class="adm-header">
        <div class="adm-header-top">
          <div class="adm-title" title="${escHtml(alarm.title)}">${escHtml(alarm.title)}</div>
          <div class="adm-header-actions">
            <button class="adm-header-btn" id="admMaximize" title="Maximizar">
              <svg class="adm-icon-expand" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
              <svg class="adm-icon-compress" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none">
                <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
              </svg>
            </button>
            <button class="adm-header-btn adm-close" id="admClose" title="Fechar (Esc)">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="adm-badges">
          <span class="adm-badge-severity" style="background:${sev.bg};color:${sev.text}">${sev.icon} ${sev.label}</span>
          <span class="adm-badge-state" style="color:${st.color}">${st.label}</span>
          <span class="adm-badge-source" title="${escHtml(alarm.source)}">${sourceDisplay}</span>
        </div>
      </div>

      <!-- ── Tabs ── -->
      <nav class="adm-tabs">
        <button class="adm-tab is-active" data-panel="resumo">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
          Resumo
        </button>
        <button class="adm-tab" data-panel="timeline">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
          Timeline <span class="adm-tab-badge">${count}</span>
        </button>
        <button class="adm-tab" data-panel="dispositivos">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M20 3H4a1 1 0 00-1 1v12a1 1 0 001 1h8v2H8v2h8v-2h-4v-2h8a1 1 0 001-1V4a1 1 0 00-1-1zm-1 12H5V5h14v10z"/></svg>
          Dispositivos <span class="adm-tab-badge">${deviceCount}</span>
        </button>
        <button class="adm-tab" data-panel="grafico">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 20 9 12 14 16 19 6"/><polyline points="19 6 19 10"/><polyline points="19 6 15 6"/></svg>
          Gráfico
        </button>
        <button class="adm-tab" data-panel="relatorio">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Relatório
        </button>
        <button class="adm-tab" data-panel="anotacoes">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 001 1h4"/><path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
          Anotações${annotCount > 0 ? ` <span class="adm-tab-badge">${annotCount}</span>` : ''}
        </button>
      </nav>

      <!-- ── Body ── -->
      <div class="adm-body">

        <!-- RESUMO -->
        <div class="adm-panel is-active" data-panel="resumo">
          <div class="adm-kpi-grid">
            <div class="adm-kpi">
              <div class="adm-kpi-value" style="color:${sev.text}">${count}</div>
              <div class="adm-kpi-label">Ocorrências</div>
            </div>
            <div class="adm-kpi">
              <div class="adm-kpi-value">${deviceCount}</div>
              <div class="adm-kpi-label">Dispositivos</div>
            </div>
            <div class="adm-kpi">
              <div class="adm-kpi-value">${durLabel}</div>
              <div class="adm-kpi-label">Duração</div>
            </div>
          </div>

          ${alarm.description ? `<div class="adm-description">${escHtml(alarm.description)}</div>` : ''}

          ${alarm._alarmTypes && alarm._alarmTypes.length > 0 ? `
          <div class="adm-section">
            <div class="adm-section-title">Tipos de Alarme (${alarm._alarmTypes.length})</div>
            <div class="adm-alarm-types-list">
              ${alarm._alarmTypes.map((t) => `<span class="adm-alarm-type-chip">${escHtml(t)}</span>`).join('')}
            </div>
          </div>` : ''}

          <div class="adm-section">
            <div class="adm-section-title">Identificação</div>
            ${row('Shopping', alarm.customerName)}
            ${row('Dispositivo(s)', alarm.source)}
            ${row('ID', alarm.id)}
          </div>

          <div class="adm-section">
            <div class="adm-section-title">Datas</div>
            ${row('Primeira ocorrência', fmt(alarm.firstOccurrence))}
            ${row('Última ocorrência', fmt(alarm.lastOccurrence))}
            ${alarm.acknowledgedAt ? row('Reconhecido em', fmt(alarm.acknowledgedAt)) : ''}
            ${alarm.acknowledgedBy ? row('Reconhecido por', alarm.acknowledgedBy) : ''}
            ${alarm.snoozedUntil ? row('Adiado até', fmt(alarm.snoozedUntil)) : ''}
            ${alarm.closedAt ? row('Fechado em', fmt(alarm.closedAt)) : ''}
            ${alarm.closedBy ? row('Fechado por', alarm.closedBy) : ''}
            ${alarm.closedReason ? row('Motivo', alarm.closedReason) : ''}
          </div>

        </div>

        <!-- TIMELINE -->
        <div class="adm-panel" data-panel="timeline">
          <div class="adm-section">
            <div class="adm-section-title">${
              groupMode === 'porDispositivo' && alarm._alarmTypeGroups?.length
                ? `${alarm._alarmTypeGroups.length} tipo${alarm._alarmTypeGroups.length !== 1 ? 's' : ''} · ${count} ocorrência${count !== 1 ? 's' : ''} · ${durLabel} de janela`
                : `${count} ocorrência${count !== 1 ? 's' : ''} · ${durLabel} de janela`
            }</div>
            <div class="adm-timeline">
              ${buildTimeline(alarm, groupMode)}
            </div>
          </div>

          ${
            count > 1
              ? `<div class="adm-section">
            <div class="adm-section-title">Estatísticas de recorrência</div>
            ${row('Frequência média', avgFreq)}
            ${row('Janela total', durLabel)}
            ${row('Primeira ocorrência', fmt(alarm.firstOccurrence))}
            ${row('Última ocorrência', fmt(alarm.lastOccurrence))}
          </div>`
              : ''
          }
        </div>

        <!-- DISPOSITIVOS -->
        <div class="adm-panel" data-panel="dispositivos">
          <div class="adm-section">
            <div class="adm-section-title">${deviceCount} dispositivo${deviceCount !== 1 ? 's' : ''} de origem</div>
            <div class="adm-devices-list">
              ${devicesListHtml}
            </div>
          </div>

          <!-- Occurrence × Device matrix — disabled -->
          <!-- <div class="adm-section" style="display:none">
            <div class="adm-section-title">Mapa ocorrências × dispositivos</div>
            <div class="adm-matrix">
              <div class="adm-matrix-header">
                <span>ID</span><span>Timestamp</span><span>Dispositivos</span><span>Trigger</span>
              </div>
              ${buildOccurrenceMatrix(alarm, devices)}
            </div>
          </div> -->

        </div>

        <!-- RELATÓRIO -->
        <div class="adm-panel" data-panel="relatorio">
          <div class="adm-report-toolbar">
            <div class="adm-report-date-row">
              <label class="adm-report-label">De</label>
              <input type="date" class="adm-report-date-input" id="admRptStart" value="${fmtDateInput(firstMs)}">
              <label class="adm-report-label">Até</label>
              <input type="date" class="adm-report-date-input" id="admRptEnd" value="${fmtDateInput(lastMs)}">
            </div>
            <button class="adm-report-emit-btn" id="admRptEmit">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              Emitir Relatório
            </button>
          </div>
          <div class="adm-report-grid" id="admRptGrid">
            <div class="adm-report-empty-hint">Configure o período e clique em <strong>Emitir Relatório</strong>.</div>
          </div>
        </div>

        <!-- GRÁFICO -->
        <div class="adm-panel" data-panel="grafico">
          <div class="adm-chart-controls">
            <div class="adm-chart-ctrl-group">
              <button class="adm-chart-btn is-active" data-chart-type="bar">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><rect x="2" y="10" width="4" height="12" rx="1"/><rect x="9" y="6" width="4" height="16" rx="1"/><rect x="16" y="2" width="4" height="20" rx="1"/></svg>
                Barras
              </button>
              <button class="adm-chart-btn" data-chart-type="line">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 20 9 12 14 16 19 6"/></svg>
                Linha
              </button>
            </div>
            ${devices.length > 1 ? `<div class="adm-chart-ctrl-group">
              <button class="adm-chart-btn is-active" data-viz-mode="total">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>
                Consolidado
              </button>
              <button class="adm-chart-btn" data-viz-mode="separate">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/></svg>
                Por dispositivo
              </button>
            </div>` : ''}
            <div class="adm-chart-ctrl-group">
              <button class="adm-chart-btn ${initialPeriod === 'hora' ? 'is-active' : ''}" data-period="hora">Hora</button>
              <button class="adm-chart-btn ${initialPeriod === 'dia' ? 'is-active' : ''}" data-period="dia">Dia</button>
              <button class="adm-chart-btn ${initialPeriod === 'semana' ? 'is-active' : ''}" data-period="semana">Semana</button>
              <button class="adm-chart-btn ${initialPeriod === 'mes' ? 'is-active' : ''}" data-period="mes">Mês</button>
            </div>
          </div>

          <div class="adm-section">
            <div class="adm-section-title">Tendência de ocorrências no período</div>
            <div class="adm-chart-wrapper">
              <canvas id="admMainChart" class="adm-chart-canvas"></canvas>
            </div>
          </div>

          <div class="adm-chart-secondary-grid">
            <div class="adm-section">
              <div class="adm-section-title">Por dia da semana</div>
              <div class="adm-chart-canvas-wrap adm-chart-canvas-wrap--dow"><canvas id="admDowChart"></canvas></div>
            </div>
            <div class="adm-section">
              <div class="adm-section-title">Por hora do dia</div>
              <div class="adm-chart-canvas-wrap adm-chart-canvas-wrap--hod"><canvas id="admHodChart"></canvas></div>
            </div>
          </div>
        </div>

        <!-- ANOTAÇÕES -->
        <div class="adm-panel" data-panel="anotacoes">
          ${buildAnnotationsPanelHtml(alarm.id)}
        </div>

      </div><!-- /adm-body -->
    </div><!-- /adm-drawer -->
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('adm-overlay--visible'));

  // Tab switching
  overlay.querySelectorAll<HTMLElement>('.adm-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.getAttribute('data-panel');
      overlay.querySelectorAll('.adm-tab').forEach((b) => b.classList.remove('is-active'));
      overlay.querySelectorAll('.adm-panel').forEach((p) => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      overlay.querySelector(`.adm-panel[data-panel="${panel}"]`)?.classList.add('is-active');
    });
  });

  // Chart.js handlers (scoped to grafico panel)
  const chartInstances: any[] = []; // [0]=main [1]=dow [2]=hod
  const graficoPanel = overlay.querySelector<HTMLElement>('.adm-panel[data-panel="grafico"]');
  if (graficoPanel) {
    let activeChartType: 'bar' | 'line' = 'bar';
    let activeVizMode: 'total' | 'separate' = 'total';
    let activePeriod: Period = initialPeriod;

    const buildMain = () => {
      const nb = generateBuckets(alarm, devices, activePeriod);
      const canvas = graficoPanel.querySelector<HTMLCanvasElement>('#admMainChart');
      if (!canvas) return;
      if (chartInstances[0]) { chartInstances[0].destroy(); chartInstances[0] = null; }
      chartInstances[0] = createMainChart(canvas, nb, devices, activeChartType, activeVizMode, chartSingleColor);
    };

    const initSecondary = () => {
      const dowCanvas = graficoPanel.querySelector<HTMLCanvasElement>('#admDowChart');
      if (dowCanvas && !chartInstances[1]) chartInstances[1] = createDowChart(dowCanvas, dowVals);
      const hodCanvas = graficoPanel.querySelector<HTMLCanvasElement>('#admHodChart');
      if (hodCanvas && !chartInstances[2]) chartInstances[2] = createHodChart(hodCanvas, hodVals);
    };

    graficoPanel.querySelectorAll<HTMLButtonElement>('button[data-chart-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeChartType = btn.dataset.chartType as 'bar' | 'line';
        graficoPanel.querySelectorAll('button[data-chart-type]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        buildMain();
      });
    });

    graficoPanel.querySelectorAll<HTMLButtonElement>('button[data-viz-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeVizMode = btn.dataset.vizMode as 'total' | 'separate';
        graficoPanel.querySelectorAll('button[data-viz-mode]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        buildMain();
      });
    });

    graficoPanel.querySelectorAll<HTMLButtonElement>('button[data-period]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activePeriod = btn.dataset.period as Period;
        graficoPanel.querySelectorAll('button[data-period]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        buildMain();
      });
    });

    // Init charts when the Gráfico tab is clicked (canvas must be visible for correct sizing)
    overlay.querySelectorAll<HTMLElement>('.adm-tab[data-panel="grafico"]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => setTimeout(() => { buildMain(); initSecondary(); }, 30));
    });
  }

  // Relatório tab handlers
  const rptPanel = overlay.querySelector<HTMLElement>('.adm-panel[data-panel="relatorio"]');
  if (rptPanel) {
    const emitBtn = rptPanel.querySelector<HTMLButtonElement>('#admRptEmit');
    const grid = rptPanel.querySelector<HTMLElement>('#admRptGrid');
    const isSeparado = groupMode === 'separado';

    const buildReportTable = () => {
      const startInput = rptPanel.querySelector<HTMLInputElement>('#admRptStart');
      const endInput   = rptPanel.querySelector<HTMLInputElement>('#admRptEnd');
      const startMs = startInput?.value ? new Date(startInput.value).getTime() : firstMs;
      const endMs   = endInput?.value   ? new Date(endInput.value).getTime() + 86_400_000 - 1 : lastMs;

      // Clamp occurrence window to the selected date range
      const occFirst = Math.max(firstMs, startMs);
      const occLast  = Math.min(lastMs,  endMs);
      const interval = count > 1 ? (occLast - occFirst) / (count - 1) : 0;
      const trigStr  = alarm.triggerValue != null ? String(alarm.triggerValue) : '—';

      // --- Occurrence rows (newest → oldest) ---
      const csvRows: string[][] = [['#', 'Data/Hora', 'Trigger']];
      const tableRows: string[] = [];
      for (let i = count; i >= 1; i--) {
        const tsMs = occFirst + interval * (i - 1);
        const isLatest = i === count;
        const showVal  = isLatest || count === 1;
        const cellVal  = showVal ? escHtml(trigStr) : '—';
        csvRows.push([`#${i}`, fmt(tsMs), showVal ? trigStr : '—']);
        tableRows.push(`<tr>
          <td class="adm-rpt-cell adm-rpt-cell--idx">#${i}</td>
          <td class="adm-rpt-cell">${fmt(tsMs)}</td>
          <td class="adm-rpt-cell adm-rpt-cell--num">${cellVal}</td>
        </tr>`);
      }

      // --- Summary per device (consolidado / porDispositivo only) ---
      let summaryHtml = '';
      if (!isSeparado && devices.length > 0) {
        const devRows = devices.map((dev) => `<tr>
          <td class="adm-rpt-cell">${escHtml(dev)}</td>
          <td class="adm-rpt-cell adm-rpt-cell--num">${count}</td>
          <td class="adm-rpt-cell">${fmt(occFirst)}</td>
          <td class="adm-rpt-cell">${fmt(occLast)}</td>
        </tr>`).join('');
        summaryHtml = `
          <div class="adm-rpt-section-title">Sumário por dispositivo</div>
          <div class="adm-rpt-table-wrap adm-rpt-table-wrap--summary">
            <table class="adm-rpt-table">
              <thead><tr>
                <th class="adm-rpt-th">Dispositivo</th>
                <th class="adm-rpt-th adm-rpt-th--num">Ocorrências</th>
                <th class="adm-rpt-th">Primeira</th>
                <th class="adm-rpt-th">Última</th>
              </tr></thead>
              <tbody>${devRows}</tbody>
            </table>
          </div>`;
      }

      // --- Separado: header block ---
      const headerHtml = isSeparado
        ? `<div class="adm-rpt-device-header">
            <span class="adm-rpt-device-name">${escHtml(alarm.source)}</span>
            <span class="adm-rpt-device-sep">·</span>
            <span class="adm-rpt-alarm-type">${escHtml(alarm.title)}</span>
          </div>`
        : '';

      if (!grid) return;
      grid.innerHTML = `
        ${headerHtml}
        <div class="adm-rpt-section-title">Ocorrências (${count})</div>
        <div class="adm-rpt-table-wrap" id="admRptTableWrap">
          <table class="adm-rpt-table">
            <thead><tr>
              <th class="adm-rpt-th adm-rpt-th--idx">#</th>
              <th class="adm-rpt-th">Data/Hora</th>
              <th class="adm-rpt-th adm-rpt-th--num">Trigger</th>
            </tr></thead>
            <tbody>${tableRows.join('')}</tbody>
            <tfoot><tr>
              <td class="adm-rpt-cell adm-rpt-cell--total" colspan="2">Total</td>
              <td class="adm-rpt-cell adm-rpt-cell--num adm-rpt-cell--total">${count} ocorrência${count !== 1 ? 's' : ''}</td>
            </tr></tfoot>
          </table>
        </div>
        ${summaryHtml}
        <div class="adm-report-export">
          <button class="adm-export-btn" id="admExportCsv">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
            CSV
          </button>
          <button class="adm-export-btn adm-export-btn--pdf" id="admExportPdf">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            PDF
          </button>
        </div>`;

      grid.querySelector<HTMLButtonElement>('#admExportCsv')?.addEventListener('click', () => {
        const csv = csvRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `relatorio-${alarm.id}.csv`; a.click();
        URL.revokeObjectURL(url);
      });

      grid.querySelector<HTMLButtonElement>('#admExportPdf')?.addEventListener('click', () => {
        const win = window.open('', '_blank', 'width=860,height=660');
        if (!win) return;
        const tbl = grid.querySelector('#admRptTableWrap')?.outerHTML ?? '';
        const sumTbl = grid.querySelector('.adm-rpt-table-wrap--summary')?.outerHTML ?? '';
        win.document.write(`<!DOCTYPE html><html><head><title>Relatório — ${escHtml(alarm.title)}</title>
          <style>
            body{font-family:Arial,sans-serif;padding:24px;font-size:12px;color:#111;}
            h2{font-size:15px;margin:0 0 4px;}p{color:#6b7280;font-size:11px;margin:0 0 16px;}
            h3{font-size:12px;font-weight:700;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.5px;color:#7c3aed;}
            table{border-collapse:collapse;width:100%;margin-bottom:16px;}
            th,td{border:1px solid #e5e7eb;padding:7px 10px;text-align:left;}
            th{background:#f9fafb;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.4px;}
            tr:nth-child(even) td{background:#fafafa;}
            tfoot td{font-weight:700;background:#ede9fe;}
          </style></head><body>
          <h2>${escHtml(alarm.title)}</h2>
          <p>${escHtml(alarm.id)} · ${escHtml(alarm.customerName || '')} · ${count} ocorrências · Emitido em ${new Date().toLocaleDateString('pt-BR')}</p>
          <h3>Ocorrências</h3>${tbl}
          ${sumTbl ? `<h3>Sumário por dispositivo</h3>${sumTbl}` : ''}
          <script>window.onload=function(){window.print();window.close();}<\/script>
          </body></html>`);
        win.document.close();
      });
    };

    emitBtn?.addEventListener('click', () => buildReportTable());
  }

  // Anotações tab — bind interactive events
  const annotPanelEl = overlay.querySelector<HTMLElement>('.adm-panel[data-panel="anotacoes"]');
  if (annotPanelEl) {
    const currentUser = (window as any).MyIOUtils?.currentUserEmail || alarm.acknowledgedBy || alarm.customerName || 'Usuário';
    bindAnnotationsPanelEvents(annotPanelEl, alarm.id, currentUser, (n) => {
      const tabBtn = overlay.querySelector<HTMLElement>('.adm-tab[data-panel="anotacoes"]');
      if (!tabBtn) return;
      let badge = tabBtn.querySelector<HTMLElement>('.adm-tab-badge');
      if (n > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'adm-tab-badge';
          tabBtn.appendChild(badge);
        }
        badge.textContent = String(n);
      } else if (badge) {
        badge.remove();
      }
    });
  }

  // Maximize / restore
  const drawer = overlay.querySelector('.adm-drawer') as HTMLElement | null;
  const maximizeBtn = overlay.querySelector('#admMaximize') as HTMLElement | null;
  const iconExpand   = maximizeBtn?.querySelector<HTMLElement>('.adm-icon-expand');
  const iconCompress = maximizeBtn?.querySelector<HTMLElement>('.adm-icon-compress');

  maximizeBtn?.addEventListener('click', () => {
    const isMax = drawer?.classList.toggle('adm-drawer--maximized');
    if (iconExpand)   iconExpand.style.display   = isMax ? 'none'  : '';
    if (iconCompress) iconCompress.style.display = isMax ? ''      : 'none';
    maximizeBtn.title = isMax ? 'Restaurar (Esc)' : 'Maximizar';
  });

  // Close
  const closeModal = () => {
    overlay.classList.remove('adm-overlay--visible');
    setTimeout(() => {
      overlay.remove();
      chartInstances.forEach((c) => { try { c?.destroy(); } catch (_) {} });
    }, 300);
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
  };

  document.addEventListener('keydown', onKey);
  overlay.querySelector('#admClose')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
}

// =====================================================================
// Occurrence × Device matrix
// =====================================================================

function buildOccurrenceMatrix(alarm: Alarm, devices: string[]): string {
  const count = alarm.occurrenceCount || 1;
  const firstMs = new Date(alarm.firstOccurrence).getTime();
  const lastMs = new Date(alarm.lastOccurrence).getTime();
  const interval = count > 1 ? (lastMs - firstMs) / (count - 1) : 0;

  // Show all occurrences most-recent first, capped at 30 (scroll handles the rest)
  const MAX_ROWS = 30;
  const show: Array<{ n: number; tsMs: number; estimated: boolean }> = [];

  for (let i = count; i >= 1; i--) {
    show.push({
      n: i,
      tsMs: firstMs + interval * (i - 1),
      estimated: i > 1 && i < count,
    });
    if (show.length >= MAX_ROWS) break;
  }

  // For each occurrence we rotate through devices (simulating which device fired)
  const deviceChip = (dev: string) =>
    `<span class="adm-device-chip">
       <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
       ${escHtml(dev)}
     </span>`;

  return show
    .map((item) => {
      const devIndex = (item.n - 1) % devices.length;
      const rowDevices =
        devices.length === 1
          ? [devices[0]]
          : [devices[devIndex]];
      const chipsHtml = rowDevices.map(deviceChip).join('');

      const trigVal = item.n === count && alarm.triggerValue != null
        ? escHtml(String(alarm.triggerValue))
        : '—';
      return `<div class="adm-matrix-row">
        <span class="adm-matrix-n">#${item.n}</span>
        <span class="adm-matrix-ts">${fmt(item.tsMs)}${item.estimated ? '<sup title="Estimado">~</sup>' : ''}</span>
        <span class="adm-matrix-devices">${chipsHtml}</span>
        <span class="adm-matrix-trigger">${trigVal}</span>
      </div>`;
    })
    .join('');
}
