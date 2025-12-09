/**
 * Temperature Modal Utilities
 * Shared functions for temperature modal components
 * RFC-0085: Temperature Modal Component
 */

// ============================================================================
// Types
// ============================================================================

export interface TemperatureTelemetry {
  ts: number;
  value: number | string;
}

export interface TemperatureStats {
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface DailyTemperatureStats {
  date: string;      // "2025-01-25"
  dateTs: number;    // Start of day timestamp
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface ClampRange {
  min: number;
  max: number;
}

export type TemperatureGranularity = 'hour' | 'day';

// Day period types for filtering
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
  { id: 'noite', label: 'Noite (18h-24h)', startHour: 18, endHour: 24 }
];

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_CLAMP_RANGE: ClampRange = { min: 15, max: 40 };

// ============================================================================
// Date Helpers
// ============================================================================

/**
 * Returns "Today So Far" date range: midnight today until now
 */
export function getTodaySoFar(): { startTs: number; endTs: number } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return {
    startTs: startOfDay.getTime(),
    endTs: now.getTime()
  };
}

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
// Data Fetching
// ============================================================================

/**
 * Fetches temperature telemetry data from ThingsBoard API
 */
export async function fetchTemperatureData(
  token: string,
  deviceId: string,
  startTs: number,
  endTs: number
): Promise<TemperatureTelemetry[]> {
  const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries` +
    `?keys=temperature` +
    `&startTs=${encodeURIComponent(startTs)}` +
    `&endTs=${encodeURIComponent(endTs)}` +
    `&limit=50000` +
    `&agg=NONE`;

  const response = await fetch(url, {
    headers: {
      'X-Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch temperature data: ${response.status}`);
  }

  const data = await response.json();
  return data?.temperature || [];
}

// ============================================================================
// Data Processing
// ============================================================================

/**
 * Clamps temperature value to avoid outliers
 * Values below min are clamped to min, values above max are clamped to max
 */
export function clampTemperature(
  value: number | string,
  range: ClampRange = DEFAULT_CLAMP_RANGE
): number {
  const num = Number(value || 0);
  if (num < range.min) return range.min;
  if (num > range.max) return range.max;
  return num;
}

/**
 * Calculates statistics from temperature data
 */
export function calculateStats(
  data: TemperatureTelemetry[],
  clampRange: ClampRange = DEFAULT_CLAMP_RANGE
): TemperatureStats {
  if (data.length === 0) {
    return { avg: 0, min: 0, max: 0, count: 0 };
  }

  const values = data.map(item => clampTemperature(item.value, clampRange));
  const sum = values.reduce((acc, v) => acc + v, 0);

  return {
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length
  };
}

/**
 * Interpolates temperature data to fill gaps with 30-minute intervals
 * Uses 'repeat-last' strategy: if no reading in interval, repeats last known temperature
 */
export function interpolateTemperature(
  data: TemperatureTelemetry[],
  options: {
    intervalMinutes: number;
    startTs: number;
    endTs: number;
    clampRange?: ClampRange;
  }
): TemperatureTelemetry[] {
  const { intervalMinutes, startTs, endTs, clampRange = DEFAULT_CLAMP_RANGE } = options;
  const intervalMs = intervalMinutes * 60 * 1000;

  if (data.length === 0) {
    return [];
  }

  // Sort data by timestamp
  const sortedData = [...data].sort((a, b) => a.ts - b.ts);

  // Generate all expected timestamps
  const result: TemperatureTelemetry[] = [];
  let lastKnownValue = clampTemperature(sortedData[0].value, clampRange);
  let dataIndex = 0;

  for (let ts = startTs; ts <= endTs; ts += intervalMs) {
    // Find the closest data point at or before this timestamp
    while (dataIndex < sortedData.length - 1 && sortedData[dataIndex + 1].ts <= ts) {
      dataIndex++;
    }

    // Check if we have an exact or close match (within interval)
    const currentData = sortedData[dataIndex];
    if (currentData && Math.abs(currentData.ts - ts) < intervalMs) {
      lastKnownValue = clampTemperature(currentData.value, clampRange);
    }

    result.push({
      ts,
      value: lastKnownValue
    });
  }

  return result;
}

/**
 * Aggregates temperature data by day, calculating daily statistics
 */
export function aggregateByDay(
  data: TemperatureTelemetry[],
  clampRange: ClampRange = DEFAULT_CLAMP_RANGE
): DailyTemperatureStats[] {
  if (data.length === 0) {
    return [];
  }

  // Group by day
  const dayMap = new Map<string, TemperatureTelemetry[]>();

  data.forEach(item => {
    const date = new Date(item.ts);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, []);
    }
    dayMap.get(dateKey)!.push(item);
  });

  // Calculate stats for each day
  const result: DailyTemperatureStats[] = [];

  dayMap.forEach((dayData, dateKey) => {
    const values = dayData.map(item => clampTemperature(item.value, clampRange));
    const sum = values.reduce((acc, v) => acc + v, 0);

    result.push({
      date: dateKey,
      dateTs: new Date(dateKey).getTime(),
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    });
  });

  // Sort by date
  return result.sort((a, b) => a.dateTs - b.dateTs);
}

// ============================================================================
// Period Filtering
// ============================================================================

/**
 * Filters temperature data by selected day periods
 * If all periods are selected or none are selected, returns all data
 */
export function filterByDayPeriods(
  data: TemperatureTelemetry[],
  selectedPeriods: DayPeriod[]
): TemperatureTelemetry[] {
  // If all periods selected or none selected, return all data
  if (selectedPeriods.length === 0 || selectedPeriods.length === DAY_PERIODS.length) {
    return data;
  }

  return data.filter(item => {
    const date = new Date(item.ts);
    const hour = date.getHours();

    return selectedPeriods.some(periodId => {
      const period = DAY_PERIODS.find(p => p.id === periodId);
      if (!period) return false;
      return hour >= period.startHour && hour < period.endHour;
    });
  });
}

/**
 * Gets the label for selected periods (for display)
 */
export function getSelectedPeriodsLabel(selectedPeriods: DayPeriod[]): string {
  if (selectedPeriods.length === 0 || selectedPeriods.length === DAY_PERIODS.length) {
    return 'Todos os períodos';
  }

  if (selectedPeriods.length === 1) {
    const period = DAY_PERIODS.find(p => p.id === selectedPeriods[0]);
    return period?.label || '';
  }

  return `${selectedPeriods.length} períodos selecionados`;
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Formats temperature value for display
 * @param value - Temperature value in Celsius
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted temperature string with °C unit, or '—' if value is invalid
 */
export function formatTemperature(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(decimals)}°C`;
}

/**
 * Formats date for display based on granularity
 */
export function formatDateLabel(
  ts: number,
  granularity: TemperatureGranularity,
  locale: string = 'pt-BR'
): string {
  const date = new Date(ts);

  if (granularity === 'hour') {
    // Show date and time: "25/01 14:30"
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }) +
      ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  } else {
    // Show date only: "25/01/2025"
    return date.toLocaleDateString(locale);
  }
}

/**
 * Formats tooltip content based on granularity
 */
export function formatTooltip(
  data: {
    ts: number;
    value: number;
    isInterpolated?: boolean;
    dailyMin?: number;
    dailyMax?: number;
  },
  granularity: TemperatureGranularity,
  locale: string = 'pt-BR'
): string {
  const date = new Date(data.ts);

  if (granularity === 'hour') {
    const dateStr = date.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit'
    });
    const interpolatedLabel = data.isInterpolated ? ' (interpolado)' : '';
    return `${dateStr} ${timeStr}\n${formatTemperature(data.value)}${interpolatedLabel}`;
  } else {
    const dateStr = date.toLocaleDateString(locale);
    let tooltip = `${dateStr}\nMédia: ${formatTemperature(data.value)}`;
    if (data.dailyMin !== undefined && data.dailyMax !== undefined) {
      tooltip += `\nMin: ${formatTemperature(data.dailyMin)} | Max: ${formatTemperature(data.dailyMax)}`;
    }
    return tooltip;
  }
}

// ============================================================================
// CSV Export
// ============================================================================

/**
 * Exports temperature data to CSV format
 */
export function exportTemperatureCSV(
  data: TemperatureTelemetry[],
  deviceLabel: string,
  stats: TemperatureStats,
  startDate: string,
  endDate: string
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Build CSV content with BOM for Excel compatibility
  const BOM = '\uFEFF';
  let csvContent = BOM;

  // Header with summary
  csvContent += `Relatório de Temperatura - ${deviceLabel}\n`;
  csvContent += `Período: ${startDate} até ${endDate}\n`;
  csvContent += `Média: ${formatTemperature(stats.avg)}\n`;
  csvContent += `Mínima: ${formatTemperature(stats.min)}\n`;
  csvContent += `Máxima: ${formatTemperature(stats.max)}\n`;
  csvContent += `Total de leituras: ${stats.count}\n`;
  csvContent += '\n';

  // Data header
  csvContent += 'Data/Hora,Temperatura (°C)\n';

  // Data rows
  data.forEach(item => {
    const date = new Date(item.ts).toLocaleString('pt-BR');
    const temp = Number(item.value).toFixed(2);
    csvContent += `"${date}",${temp}\n`;
  });

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `temperatura_${deviceLabel.replace(/\s+/g, '_')}_${startDate}_${endDate}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Theme
// ============================================================================

export interface ThemeColors {
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
}

export const DARK_THEME: ThemeColors = {
  background: 'rgba(0, 0, 0, 0.85)',
  surface: '#1a1f28',
  text: '#ffffff',
  textMuted: 'rgba(255, 255, 255, 0.7)',
  border: 'rgba(255, 255, 255, 0.1)',
  primary: '#1976d2',
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#f44336',
  chartLine: '#1976d2',
  chartGrid: 'rgba(255, 255, 255, 0.1)'
};

export const LIGHT_THEME: ThemeColors = {
  background: 'rgba(0, 0, 0, 0.6)',
  surface: '#ffffff',
  text: '#333333',
  textMuted: '#666666',
  border: '#e0e0e0',
  primary: '#1976d2',
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#f44336',
  chartLine: '#1976d2',
  chartGrid: '#e0e0e0'
};

export function getThemeColors(theme: 'dark' | 'light'): ThemeColors {
  return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
}
