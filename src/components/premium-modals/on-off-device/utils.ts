/**
 * RFC-0176: On/Off Device Modal Utilities
 * Functions for fetching and processing on/off device telemetry data
 */

import type { OnOffTimelineData, OnOffTimelineSegment } from '../../on-off-timeline-chart';
import type { OnOffScheduleEntry } from './types';

// ============================================================================
// Types
// ============================================================================

export interface OnOffTelemetryPoint {
  ts: number;
  value: string | number | boolean;
}

export interface FetchOnOffDataParams {
  token: string;
  deviceId: string;
  startTs: number;
  endTs: number;
  /** Telemetry keys to check (in order of priority) */
  telemetryKeys?: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Default telemetry keys to check for on/off status */
const DEFAULT_TELEMETRY_KEYS = ['state', 'status', 'acionamento'];

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Fetches on/off status telemetry data from ThingsBoard API
 */
export async function fetchOnOffStatusData(
  params: FetchOnOffDataParams
): Promise<OnOffTelemetryPoint[]> {
  const { token, deviceId, startTs, endTs, telemetryKeys = DEFAULT_TELEMETRY_KEYS } = params;

  // Try each key until we find data
  for (const key of telemetryKeys) {
    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries` +
      `?keys=${key}` +
      `&startTs=${encodeURIComponent(startTs)}` +
      `&endTs=${encodeURIComponent(endTs)}` +
      `&limit=50000` +
      `&agg=NONE`;

    try {
      const response = await fetch(url, {
        headers: {
          'X-Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`[fetchOnOffStatusData] Failed to fetch key "${key}": ${response.status}`);
        continue;
      }

      const data = await response.json();
      const telemetry = data?.[key] || [];

      if (telemetry.length > 0) {
        console.log(`[fetchOnOffStatusData] Found ${telemetry.length} points for key "${key}"`);
        return telemetry;
      }
    } catch (error) {
      console.warn(`[fetchOnOffStatusData] Error fetching key "${key}":`, error);
    }
  }

  console.warn('[fetchOnOffStatusData] No telemetry data found for any key');
  return [];
}

// ============================================================================
// Data Processing
// ============================================================================

/**
 * Determines if a telemetry value represents "ON" state
 * Handles solenoid inversion if specified
 */
function isOnState(value: string | number | boolean, invertLogic: boolean = false): boolean {
  const normalizedValue = normalizeStateValue(value);
  const isOn = normalizedValue === true;
  return invertLogic ? !isOn : isOn;
}

/**
 * Normalizes various state value formats to boolean
 */
function normalizeStateValue(value: string | number | boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'on' || lower === 'true' || lower === '1' ||
      lower === 'aberta' || lower === 'ligado' || lower === 'open';
  }
  return false;
}

/**
 * Converts raw telemetry data to OnOffTimelineData format
 * Creates segments from state transitions
 */
export function convertTelemetryToTimelineData(
  telemetry: OnOffTelemetryPoint[],
  options: {
    deviceId: string;
    deviceName?: string;
    periodStart: string;
    periodEnd: string;
    invertLogic?: boolean;
  }
): OnOffTimelineData {
  const { deviceId, deviceName, periodStart, periodEnd, invertLogic = false } = options;

  const startTs = new Date(periodStart).getTime();
  const endTs = new Date(periodEnd).getTime();
  const totalHours = (endTs - startTs) / (1000 * 60 * 60);

  // Empty state
  if (telemetry.length === 0) {
    return {
      deviceId,
      deviceName,
      periodStart,
      periodEnd,
      totalHours,
      segments: [],
      totalOnMinutes: 0,
      totalOffMinutes: Math.round((endTs - startTs) / 60000),
      activationCount: 0,
      currentState: 'off',
    };
  }

  // Sort telemetry by timestamp (ascending)
  const sorted = [...telemetry].sort((a, b) => a.ts - b.ts);

  // Build segments from state transitions
  const segments: OnOffTimelineSegment[] = [];
  let totalOnMinutes = 0;
  let activationCount = 0;
  let previousState: 'on' | 'off' | null = null;
  let segmentStart: number | null = null;

  // If first telemetry point is after periodStart, create initial segment
  if (sorted[0].ts > startTs) {
    // Assume opposite of first known state for the gap before
    const firstKnownState = isOnState(sorted[0].value, invertLogic) ? 'on' : 'off';
    const initialState = firstKnownState === 'on' ? 'off' : 'on';

    segments.push({
      startTime: periodStart,
      endTime: new Date(sorted[0].ts).toISOString(),
      durationMinutes: (sorted[0].ts - startTs) / 60000,
      state: initialState,
      source: 'unknown',
    });

    if (initialState === 'on') {
      totalOnMinutes += (sorted[0].ts - startTs) / 60000;
    }

    previousState = initialState;
    segmentStart = sorted[0].ts;
  } else {
    segmentStart = startTs;
    previousState = isOnState(sorted[0].value, invertLogic) ? 'on' : 'off';
  }

  // Process each telemetry point
  for (let i = 0; i < sorted.length; i++) {
    const point = sorted[i];
    const currentState = isOnState(point.value, invertLogic) ? 'on' : 'off';

    // Check for state transition
    if (previousState !== null && currentState !== previousState) {
      // Close previous segment
      const duration = (point.ts - segmentStart!) / 60000;
      segments.push({
        startTime: new Date(segmentStart!).toISOString(),
        endTime: new Date(point.ts).toISOString(),
        durationMinutes: duration,
        state: previousState,
        source: 'unknown',
      });

      if (previousState === 'on') {
        totalOnMinutes += duration;
      }

      // Count activation (transition to ON)
      if (currentState === 'on') {
        activationCount++;
      }

      // Start new segment
      segmentStart = point.ts;
      previousState = currentState;
    } else if (previousState === null) {
      previousState = currentState;
      segmentStart = point.ts;

      // First point being ON counts as activation
      if (currentState === 'on') {
        activationCount++;
      }
    }
  }

  // Close final segment to periodEnd
  if (segmentStart !== null && previousState !== null) {
    const duration = (endTs - segmentStart) / 60000;
    segments.push({
      startTime: new Date(segmentStart).toISOString(),
      endTime: periodEnd,
      durationMinutes: duration,
      state: previousState,
      source: 'unknown',
    });

    if (previousState === 'on') {
      totalOnMinutes += duration;
    }
  }

  // Calculate totals
  const totalOffMinutes = Math.round((endTs - startTs) / 60000) - Math.round(totalOnMinutes);
  const lastState = segments.length > 0 ? segments[segments.length - 1].state : 'off';

  return {
    deviceId,
    deviceName,
    periodStart,
    periodEnd,
    totalHours: Math.round(totalHours * 100) / 100,
    segments,
    totalOnMinutes: Math.round(totalOnMinutes),
    totalOffMinutes: Math.max(0, totalOffMinutes),
    activationCount,
    currentState: lastState,
  };
}

/**
 * Fetches and converts on/off telemetry data to timeline format
 * This is the main entry point for the modal
 */
export async function fetchOnOffTimelineData(
  params: FetchOnOffDataParams & {
    deviceName?: string;
    invertLogic?: boolean;
  }
): Promise<OnOffTimelineData> {
  const { token, deviceId, startTs, endTs, deviceName, invertLogic = false, telemetryKeys } = params;

  const periodStart = new Date(startTs).toISOString();
  const periodEnd = new Date(endTs).toISOString();

  try {
    const telemetry = await fetchOnOffStatusData({
      token,
      deviceId,
      startTs,
      endTs,
      telemetryKeys,
    });

    return convertTelemetryToTimelineData(telemetry, {
      deviceId,
      deviceName,
      periodStart,
      periodEnd,
      invertLogic,
    });
  } catch (error) {
    console.error('[fetchOnOffTimelineData] Error:', error);

    // Return empty data on error
    return {
      deviceId,
      deviceName,
      periodStart,
      periodEnd,
      totalHours: (endTs - startTs) / (1000 * 60 * 60),
      segments: [],
      totalOnMinutes: 0,
      totalOffMinutes: Math.round((endTs - startTs) / 60000),
      activationCount: 0,
      currentState: 'off',
    };
  }
}

// ============================================================================
// Schedule Fetching
// ============================================================================

/**
 * Fetches device schedules from ThingsBoard attributes
 */
export async function fetchDeviceSchedules(
  token: string,
  deviceId: string
): Promise<OnOffScheduleEntry[]> {
  try {
    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`;

    const response = await fetch(url, {
      headers: {
        'X-Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[fetchDeviceSchedules] Failed to fetch: ${response.status}`);
      return [];
    }

    const attrs = await response.json();
    const schedulesAttr = attrs.find((a: any) => a.key === 'schedules');

    if (schedulesAttr?.value) {
      const schedules = typeof schedulesAttr.value === 'string'
        ? JSON.parse(schedulesAttr.value)
        : schedulesAttr.value;
      return Array.isArray(schedules) ? schedules : [];
    }

    return [];
  } catch (error) {
    console.error('[fetchDeviceSchedules] Error:', error);
    return [];
  }
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Format duration in minutes to readable string
 */
function formatDurationMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

/**
 * Format date for display in exports
 */
function formatDateForExport(isoString: string, locale: string = 'pt-BR'): string {
  const date = new Date(isoString);
  return date.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Export timeline data to CSV format
 */
export function exportTimelineToCSV(
  data: OnOffTimelineData,
  labels: { on?: string; off?: string } = {},
  locale: string = 'pt-BR'
): void {
  const labelOn = labels.on || 'Ligado';
  const labelOff = labels.off || 'Desligado';

  // Build CSV content
  const headers = ['Inicio', 'Fim', 'Estado', 'Duracao (min)', 'Duracao', 'Origem'];
  const rows = data.segments.map(seg => [
    formatDateForExport(seg.startTime, locale),
    formatDateForExport(seg.endTime, locale),
    seg.state === 'on' ? labelOn : labelOff,
    Math.round(seg.durationMinutes).toString(),
    formatDurationMinutes(seg.durationMinutes),
    seg.source || 'Desconhecido',
  ]);

  // Add summary row
  rows.push([]);
  rows.push(['RESUMO', '', '', '', '', '']);
  rows.push(['Total Acionamentos', data.activationCount.toString(), '', '', '', '']);
  rows.push([`Tempo ${labelOn}`, formatDurationMinutes(data.totalOnMinutes), '', '', '', '']);
  rows.push([`Tempo ${labelOff}`, formatDurationMinutes(data.totalOffMinutes), '', '', '', '']);
  rows.push(['Periodo Total', `${data.totalHours.toFixed(1)}h`, '', '', '', '']);

  // Create CSV string
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n');

  // Download file
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `acionamentos_${data.deviceName || data.deviceId}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export timeline data to PDF format
 */
export function exportTimelineToPDF(
  data: OnOffTimelineData,
  labels: { on?: string; off?: string } = {},
  locale: string = 'pt-BR'
): void {
  const labelOn = labels.on || 'Ligado';
  const labelOff = labels.off || 'Desligado';
  const deviceName = data.deviceName || data.deviceId;
  const periodStart = formatDateForExport(data.periodStart, locale);
  const periodEnd = formatDateForExport(data.periodEnd, locale);

  // Build HTML content for PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatorio de Acionamentos - ${deviceName}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1f2937; }
        h1 { color: #3b82f6; font-size: 24px; margin-bottom: 8px; }
        .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
        .summary { display: flex; gap: 24px; margin-bottom: 32px; flex-wrap: wrap; }
        .summary-card { background: #f3f4f6; padding: 16px 24px; border-radius: 8px; text-align: center; min-width: 120px; }
        .summary-value { font-size: 28px; font-weight: 700; color: #3b82f6; }
        .summary-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #3b82f6; color: white; padding: 12px 8px; text-align: left; font-size: 12px; }
        td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
        tr:nth-child(even) { background: #f9fafb; }
        .state-on { color: #16a34a; font-weight: 600; }
        .state-off { color: #6b7280; }
        .footer { margin-top: 32px; text-align: center; color: #9ca3af; font-size: 11px; }
        @media print { body { margin: 20px; } }
      </style>
    </head>
    <body>
      <h1>Relatorio de Acionamentos</h1>
      <div class="subtitle">${deviceName} | ${periodStart} - ${periodEnd}</div>

      <div class="summary">
        <div class="summary-card">
          <div class="summary-value">${data.activationCount}</div>
          <div class="summary-label">Acionamentos</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${formatDurationMinutes(data.totalOnMinutes)}</div>
          <div class="summary-label">Tempo ${labelOn}</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${((data.totalOnMinutes / (data.totalHours * 60)) * 100).toFixed(1)}%</div>
          <div class="summary-label">Utilizacao</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${data.totalHours.toFixed(1)}h</div>
          <div class="summary-label">Periodo Total</div>
        </div>
      </div>

      <h2 style="font-size: 16px; color: #374151; margin-bottom: 8px;">Historico de Acionamentos</h2>
      <table>
        <thead>
          <tr>
            <th>Inicio</th>
            <th>Fim</th>
            <th>Estado</th>
            <th>Duracao</th>
            <th>Origem</th>
          </tr>
        </thead>
        <tbody>
          ${data.segments.map(seg => `
            <tr>
              <td>${formatDateForExport(seg.startTime, locale)}</td>
              <td>${formatDateForExport(seg.endTime, locale)}</td>
              <td class="${seg.state === 'on' ? 'state-on' : 'state-off'}">${seg.state === 'on' ? labelOn : labelOff}</td>
              <td>${formatDurationMinutes(seg.durationMinutes)}</td>
              <td>${seg.source === 'manual' ? 'Manual' : seg.source === 'schedule' ? 'Agendamento' : seg.source === 'automation' ? 'Automacao' : 'Desconhecido'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        Gerado em ${new Date().toLocaleString(locale)} | MyIO BAS
      </div>
    </body>
    </html>
  `;

  // Open print dialog
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

/**
 * Export schedules to PDF format
 */
export function exportSchedulesToPDF(
  schedules: OnOffScheduleEntry[],
  deviceName: string,
  locale: string = 'pt-BR'
): void {
  const daysMap: Record<string, string> = {
    mon: 'Seg',
    tue: 'Ter',
    wed: 'Qua',
    thu: 'Qui',
    fri: 'Sex',
    sat: 'Sab',
    sun: 'Dom',
  };

  const formatDays = (days: OnOffScheduleEntry['daysWeek']): string => {
    const activeDays = Object.entries(days)
      .filter(([_, active]) => active)
      .map(([day]) => daysMap[day] || day);
    return activeDays.length === 7 ? 'Todos os dias' : activeDays.join(', ');
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Agendamentos - ${deviceName}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1f2937; }
        h1 { color: #3b82f6; font-size: 24px; margin-bottom: 8px; }
        .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
        .schedule-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
        .schedule-time { font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 8px; }
        .schedule-days { color: #6b7280; font-size: 14px; }
        .schedule-flags { display: flex; gap: 16px; margin-top: 8px; }
        .schedule-flag { font-size: 12px; padding: 4px 8px; border-radius: 4px; background: #e5e7eb; color: #374151; }
        .schedule-flag.active { background: #dcfce7; color: #16a34a; }
        .empty-state { text-align: center; padding: 48px; color: #9ca3af; }
        .footer { margin-top: 32px; text-align: center; color: #9ca3af; font-size: 11px; }
        @media print { body { margin: 20px; } }
      </style>
    </head>
    <body>
      <h1>Agendamentos</h1>
      <div class="subtitle">${deviceName}</div>

      ${schedules.length === 0 ? `
        <div class="empty-state">
          <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
          <p>Nenhum agendamento configurado</p>
        </div>
      ` : schedules.map((schedule, index) => `
        <div class="schedule-card">
          <div class="schedule-time">${schedule.startHour} - ${schedule.endHour}</div>
          <div class="schedule-days">${formatDays(schedule.daysWeek)}</div>
          <div class="schedule-flags">
            <span class="schedule-flag ${schedule.holiday ? 'active' : ''}">
              ${schedule.holiday ? '✓' : '✗'} Feriados
            </span>
            <span class="schedule-flag ${schedule.retain ? 'active' : ''}">
              ${schedule.retain ? '✓' : '✗'} Manter estado
            </span>
          </div>
        </div>
      `).join('')}

      <div class="footer">
        Gerado em ${new Date().toLocaleString(locale)} | MyIO BAS
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}
