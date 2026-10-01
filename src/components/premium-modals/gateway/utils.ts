/**
 * Gateway Modal Utilities
 * Shared functions for GatewayModal / GatewayComparisonModal — a near-1:1
 * structural mirror of `src/components/temperature/utils.ts`, per explicit
 * request to keep GatewayModal "bem bem parecido mesmo" with
 * `TemperatureModal.ts` (confirmed as the real production reference via
 * `handleActionDashboard` in TELEMETRY/controller.js). Scoped to a single
 * metric — probe latency (ms) — instead of temperature (°C).
 *
 * Deliberate deltas from the temperature original (latency has no analog):
 * - no `ClampRange`/offset concept — a probe latency reading is never an
 *   "outlier to clamp", it's either a real number or a gap (`null`).
 * - `DailyLatencyStats`/`aggregateByDay` and `interpolateLatency` drop the
 *   `clampRange`/`offset`/`timezone` parameters temperature's versions carry.
 */

// ============================================================================
// Types
// ============================================================================

export interface GatewayLatencyPoint {
  /** ISO timestamp. */
  ts: string;
  /** Null = the probe failed / no reading at this point (gap in the line). */
  latencyMs: number | null;
}

export interface GatewayLatencyStats {
  avg: number | null;
  min: number | null;
  max: number | null;
  /** Count of points with a real (non-null) reading. */
  count: number;
  /** Count of failed/missing readings in the window. */
  gaps: number;
}

export interface GatewayThemeColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  success: string;
  warning: string;
  danger: string;
  chartLine: string;
  chartGrid: string;
  /** @deprecated alias of chartLine, kept for the old call sites */
  line: string;
  /** Translucent fill under the line — no temperature equivalent (added here). */
  fill: string;
  /** @deprecated alias of chartGrid, kept for the old call sites */
  grid: string;
}

export type GatewayGranularity = 'hour' | 'day';

// Day period types for filtering — generic "hour of day" bucketing, copied
// verbatim from temperature/utils.ts (not temperature-specific at all).
export type DayPeriod = 'madrugada' | 'manha' | 'tarde' | 'noite';

export interface DayPeriodConfig {
  id: DayPeriod;
  label: string;
  startHour: number;
  endHour: number;
}

export const DAY_PERIODS: DayPeriodConfig[] = [
  { id: 'madrugada', label: 'Madrugada (00h-06h)', startHour: 0, endHour: 6 },
  { id: 'manha', label: 'Manhã (06h-12h)', startHour: 6, endHour: 12 },
  { id: 'tarde', label: 'Tarde (12h-18h)', startHour: 12, endHour: 18 },
  { id: 'noite', label: 'Noite (18h-24h)', startHour: 18, endHour: 24 },
];

export const CHART_COLORS = [
  '#1976d2', // Blue
  '#FF6B6B', // Red
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#00BCD4', // Cyan
  '#E91E63', // Pink
  '#795548', // Brown
];

// ============================================================================
// Stats
// ============================================================================

export function calculateLatencyStats(data: GatewayLatencyPoint[]): GatewayLatencyStats {
  const values = data.map((d) => d.latencyMs).filter((v): v is number => v != null);
  if (values.length === 0) {
    return { avg: null, min: null, max: null, count: 0, gaps: data.length };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round(sum / values.length),
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
    gaps: data.length - values.length,
  };
}

export interface GatewayUptimeStats {
  /** Total hours in the queried period (endTs - startTs). */
  totalHours: number;
  /** Estimated hours online. */
  onlineHours: number;
  /** Estimated hours offline. */
  offlineHours: number;
  /** 0-100. */
  onlinePercent: number;
  /** 0-100. */
  offlinePercent: number;
  /** False when there are no sampled points at all (count + gaps === 0) — percentages are meaningless, render 'N/A'. */
  hasData: boolean;
}

/**
 * Proportional estimate of connectivity uptime over [startTs, endTs].
 *
 * This is NOT a continuous-time integral — it has no knowledge of how long
 * any individual gap actually lasted, only how many sampled points failed vs
 * succeeded. It assumes the failure rate among sampled points is
 * representative of the whole period: `offlineFraction = gaps / (count +
 * gaps)`, then scales that fraction across the period's total wall-clock
 * hours. Good enough for a dashboard KPI; callers needing exact downtime
 * durations need a different (event-based) data source.
 */
export function calculateUptimeStats(stats: GatewayLatencyStats, startTs: number, endTs: number): GatewayUptimeStats {
  const totalHours = Math.max(0, (endTs - startTs) / 3600000);
  const totalPoints = stats.count + stats.gaps;

  if (totalPoints === 0) {
    return { totalHours, onlineHours: 0, offlineHours: 0, onlinePercent: 0, offlinePercent: 0, hasData: false };
  }

  const offlineFraction = stats.gaps / totalPoints;
  const offlineHours = totalHours * offlineFraction;
  const onlineHours = totalHours - offlineHours;
  const offlinePercent = Math.round(offlineFraction * 1000) / 10;
  const onlinePercent = Math.round((100 - offlinePercent) * 10) / 10;

  return { totalHours, onlineHours, offlineHours, onlinePercent, offlinePercent, hasData: true };
}

/** "45min" for < 1h, otherwise "3.2h". */
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  return `${hours.toFixed(1)}h`;
}

// ============================================================================
// Data Processing
// ============================================================================

/**
 * Fills a fixed-interval timeline between startTs/endTs, snapping each raw
 * point to its nearest bucket ("repeat-last" strategy, like
 * `interpolateTemperature`) — but a bucket with no real reading within 2x the
 * interval gets `latencyMs: null` (a gap), since "repeat the last known
 * latency forever" would misleadingly imply the probe kept succeeding.
 */
export function interpolateLatency(
  data: GatewayLatencyPoint[],
  options: { intervalMinutes: number; startTs: number; endTs: number }
): GatewayLatencyPoint[] {
  const { intervalMinutes, startTs } = options;
  const intervalMs = intervalMinutes * 60 * 1000;
  const now = Date.now();
  const endTs = Math.min(options.endTs, now);

  if (data.length === 0) return [];

  const sortedData = [...data]
    .map((d) => ({ ts: Date.parse(d.ts), latencyMs: d.latencyMs }))
    .filter((d) => !Number.isNaN(d.ts))
    .sort((a, b) => a.ts - b.ts);

  if (sortedData.length === 0) return [];

  const result: GatewayLatencyPoint[] = [];
  const gapThresholdMs = intervalMs * 2;
  let dataIndex = 0;

  for (let ts = startTs; ts <= endTs; ts += intervalMs) {
    while (dataIndex < sortedData.length - 1 && sortedData[dataIndex + 1].ts <= ts) {
      dataIndex++;
    }
    const current = sortedData[dataIndex];
    const dist = current ? Math.abs(current.ts - ts) : Infinity;
    result.push({
      ts: new Date(ts).toISOString(),
      latencyMs: dist <= gapThresholdMs ? current.latencyMs : null,
    });
  }

  return result;
}

export interface DailyLatencyStats {
  date: string; // "2026-01-25"
  dateTs: number; // start of day timestamp
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

export function aggregateByDay(data: GatewayLatencyPoint[]): DailyLatencyStats[] {
  if (data.length === 0) return [];

  const dayMap = new Map<string, GatewayLatencyPoint[]>();
  data.forEach((item) => {
    const dateKey = new Date(item.ts).toISOString().split('T')[0];
    if (!dayMap.has(dateKey)) dayMap.set(dateKey, []);
    dayMap.get(dateKey)!.push(item);
  });

  const result: DailyLatencyStats[] = [];
  dayMap.forEach((dayData, dateKey) => {
    const values = dayData.map((d) => d.latencyMs).filter((v): v is number => v != null);
    result.push({
      date: dateKey,
      dateTs: new Date(dateKey).getTime(),
      avg: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      count: values.length,
    });
  });

  return result.sort((a, b) => a.dateTs - b.dateTs);
}

// ============================================================================
// Period Filtering
// ============================================================================

/** Filters latency data by selected day periods — all-selected or
 *  none-selected both mean "no filter", mirroring `filterByDayPeriods`. */
export function filterByDayPeriods(data: GatewayLatencyPoint[], selectedPeriods: DayPeriod[]): GatewayLatencyPoint[] {
  if (selectedPeriods.length === 0 || selectedPeriods.length === DAY_PERIODS.length) {
    return data;
  }
  return data.filter((item) => {
    const hour = new Date(item.ts).getHours();
    return selectedPeriods.some((periodId) => {
      const period = DAY_PERIODS.find((p) => p.id === periodId);
      if (!period) return false;
      return hour >= period.startHour && hour < period.endHour;
    });
  });
}

export function getSelectedPeriodsLabel(selectedPeriods: DayPeriod[]): string {
  if (selectedPeriods.length === 0 || selectedPeriods.length === DAY_PERIODS.length) {
    return 'Todos os períodos';
  }
  if (selectedPeriods.length === 1) {
    const period = DAY_PERIODS.find((p) => p.id === selectedPeriods[0]);
    return period?.label || '';
  }
  return `${selectedPeriods.length} períodos selecionados`;
}

// ============================================================================
// Formatting
// ============================================================================

export function formatLatency(ms: number | null): string {
  return ms == null ? '—' : `${Math.round(ms)}ms`;
}

export function formatGatewayDateLabel(iso: string, language: 'pt' | 'en', withTime = true): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const locale = language === 'en' ? 'en-US' : 'pt-BR';
  return new Date(t).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** X-axis tick label: time HH:mm for 'hour' granularity, DD/MM for 'day'. */
export function formatGatewayAxisLabel(ts: number, granularity: GatewayGranularity, locale: string): string {
  const date = new Date(ts);
  if (granularity === 'hour') {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
}

// ============================================================================
// CSV Export
// ============================================================================

export function exportLatencyCSV(
  data: GatewayLatencyPoint[],
  label: string,
  stats: GatewayLatencyStats,
  startDateStr: string,
  endDateStr: string
): void {
  if (data.length === 0) {
    console.warn('[GatewayModal] No data to export');
    return;
  }

  const BOM = '﻿';
  let csvContent = BOM;

  csvContent += `Relatório de Latência - ${label}\n`;
  csvContent += `Período: ${startDateStr} até ${endDateStr}\n`;
  csvContent += `Média: ${formatLatency(stats.avg)}\n`;
  csvContent += `Mínima: ${formatLatency(stats.min)}\n`;
  csvContent += `Máxima: ${formatLatency(stats.max)}\n`;
  csvContent += `Total de leituras: ${stats.count}\n`;
  if (stats.gaps > 0) csvContent += `Falhas de probe: ${stats.gaps}\n`;
  csvContent += '\n';

  csvContent += 'Data/Hora,Latência (ms)\n';
  data.forEach((item) => {
    const date = new Date(item.ts).toLocaleString('pt-BR');
    csvContent += `"${date}",${item.latencyMs ?? ''}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `historico_latencia_${label.replace(/\s+/g, '_')}_${startDateStr}_${endDateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Theme
// ============================================================================

export const GATEWAY_DARK_THEME: GatewayThemeColors = {
  background: 'rgba(0, 0, 0, 0.85)',
  surface: '#1a1f28',
  text: '#e5e7eb',
  textMuted: '#9ca3af',
  border: 'rgba(255,255,255,0.1)',
  primary: '#3b82f6',
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#f87171',
  chartLine: '#3b82f6',
  chartGrid: 'rgba(255,255,255,0.08)',
  line: '#3b82f6',
  fill: 'rgba(59,130,246,0.15)',
  grid: 'rgba(255,255,255,0.08)',
};

export const GATEWAY_LIGHT_THEME: GatewayThemeColors = {
  background: 'rgba(0, 0, 0, 0.6)',
  surface: '#ffffff',
  text: '#1f2937',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  primary: '#2563eb',
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#dc2626',
  chartLine: '#2563eb',
  chartGrid: '#eef0f3',
  line: '#2563eb',
  fill: 'rgba(37,99,235,0.10)',
  grid: '#eef0f3',
};

export function getGatewayThemeColors(theme: 'dark' | 'light'): GatewayThemeColors {
  return theme === 'dark' ? GATEWAY_DARK_THEME : GATEWAY_LIGHT_THEME;
}
