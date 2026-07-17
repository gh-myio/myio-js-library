/**
 * RFC-0176: On/Off Device Modal Utilities
 * Functions for fetching and processing on/off device telemetry data
 */

import type { OnOffTimelineData, OnOffTimelineSegment } from '../../on-off-timeline-chart';
import type { OnOffScheduleEntry } from './types';

// Verbose logs are OPT-IN: silent unless the host dashboard sets
// window.MyIOUtils.debugModals = true (MAIN_BAS wires it to enableDebugMode).
// Errors/warnings keep logging unconditionally via console.error/warn.
const dbg = (...args: unknown[]): void => {
  try {
    if ((globalThis as any)?.MyIOUtils?.debugModals) console.log(...args);
  } catch {
    /* noop */
  }
};


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
  /** TB base URL for the REST calls. Empty = same-origin (real TB runtime). */
  tbBaseUrl?: string;
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
  const { token, deviceId, startTs, endTs, telemetryKeys = DEFAULT_TELEMETRY_KEYS, tbBaseUrl = '' } = params;

  // Try each key until we find data
  for (const key of telemetryKeys) {
    const url = `${tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries` +
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
        dbg(`[fetchOnOffStatusData] Found ${telemetry.length} points for key "${key}"`);
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
  const { token, deviceId, startTs, endTs, deviceName, invertLogic = false, telemetryKeys, tbBaseUrl } = params;

  const periodStart = new Date(startTs).toISOString();
  const periodEnd = new Date(endTs).toISOString();

  try {
    const telemetry = await fetchOnOffStatusData({
      token,
      deviceId,
      startTs,
      endTs,
      telemetryKeys,
      tbBaseUrl,
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
  deviceId: string,
  tbBaseUrl: string = ''
): Promise<OnOffScheduleEntry[]> {
  try {
    const url = `${tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`;

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
 * Formats the emission timestamp shown in the report footer, e.g.
 * "09/06/2026 às 13:28:00".
 */
function formatIssuedAt(date: Date, locale: string = 'pt-BR'): string {
  const datePart = date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${datePart} às ${timePart}`;
}

/**
 * Sanitizes a string to be used as part of a filename: strips accents and
 * collapses any run of non-alphanumeric characters into a single underscore.
 */
function sanitizeFilenamePart(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-zA-Z0-9]+/g, '_')  // non-alphanumeric → underscore
    .replace(/^_+|_+$/g, '');         // trim leading/trailing underscores
}

/**
 * Builds the PDF document title (which browsers use as the suggested "Save as
 * PDF" filename). Format:
 *   Relatorio_de_Acionamentos_-_<customer>_<device>_emitido_em_YYYY_MM_DD_as_HH_MM_SS
 */
function buildActivationReportTitle(deviceName: string, customerName?: string): string {
  const now = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}_${p(now.getMonth() + 1)}_${p(now.getDate())}` +
    `_as_${p(now.getHours())}_${p(now.getMinutes())}_${p(now.getSeconds())}`;

  const subject = [sanitizeFilenamePart(customerName || ''), sanitizeFilenamePart(deviceName)]
    .filter(Boolean)
    .join('_');

  return `Relatorio_de_Acionamentos_-_${subject}_emitido_em_${stamp}`;
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
  locale: string = 'pt-BR',
  opts: { customerName?: string } = {}
): void {
  const labelOn = labels.on || 'Ligado';
  const labelOff = labels.off || 'Desligado';
  const deviceName = data.deviceName || data.deviceId;
  const customerName = (opts.customerName || '').trim();
  const periodStart = formatDateForExport(data.periodStart, locale);
  const periodEnd = formatDateForExport(data.periodEnd, locale);
  // Browsers use the document <title> as the suggested "Save as PDF" filename.
  const docTitle = buildActivationReportTitle(deviceName, opts.customerName);
  const issuedAt = formatIssuedAt(new Date(), locale);
  const utilization = data.totalHours > 0
    ? ((data.totalOnMinutes / (data.totalHours * 60)) * 100).toFixed(1)
    : '0.0';
  const esc = (s: string): string =>
    String(s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

  // Build HTML content for PDF — premium MyIO BAS layout (Nunito)
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${docTitle}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { font-family: 'Nunito', system-ui, sans-serif; margin: 0; padding: 32px 40px; color: #1f2937; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

        .report-header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #fff; border-radius: 14px; padding: 24px 28px; display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
        .report-header .brand { font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; opacity: .85; }
        .report-header h1 { font-size: 26px; font-weight: 800; margin: 6px 0 12px; }
        .report-header .meta { font-size: 13px; line-height: 1.6; opacity: .95; }
        .report-header .meta b { font-weight: 700; }
        .customer-badge { background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.28); border-radius: 10px; padding: 12px 16px; text-align: right; min-width: 160px; }
        .customer-badge .label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; opacity: .8; }
        .customer-badge .value { font-size: 16px; font-weight: 800; margin-top: 2px; }

        .summary { display: flex; gap: 16px; margin: 28px 0 8px; flex-wrap: wrap; }
        .summary-card { flex: 1; min-width: 130px; background: #fff; border: 1px solid #e5e7eb; border-top: 4px solid #2563eb; border-radius: 12px; padding: 18px 20px; text-align: center; box-shadow: 0 1px 3px rgba(16,24,40,.06); }
        .summary-card.accent-green { border-top-color: #16a34a; }
        .summary-card.accent-amber { border-top-color: #d97706; }
        .summary-card.accent-slate { border-top-color: #475569; }
        .summary-value { font-size: 26px; font-weight: 800; color: #111827; }
        .summary-label { font-size: 11px; font-weight: 600; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; }

        h2.section-title { font-size: 15px; font-weight: 700; color: #1f2937; margin: 28px 0 10px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
        table { width: 100%; border-collapse: collapse; }
        thead th { background: #f1f5f9; color: #334155; padding: 11px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px; border-bottom: 1px solid #eef2f6; font-size: 12px; color: #374151; }
        tbody tr:nth-child(even) { background: #fafbfc; }
        .pill { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .pill-on { background: #dcfce7; color: #15803d; }
        .pill-off { background: #f1f5f9; color: #64748b; }

        .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
        .footer .issued { font-weight: 700; color: #374151; }
        .footer .brand { color: #2563eb; font-weight: 800; }

        @page { margin: 16mm 12mm; }
        @media print { body { padding: 0; } .report-header { border-radius: 12px; } }
      </style>
    </head>
    <body>
      <div class="report-header">
        <div class="head-left">
          <div class="brand">MyIO BAS</div>
          <h1>Relatório de Acionamentos</h1>
          <div class="meta">
            <div><b>Dispositivo:</b> ${esc(deviceName)}</div>
            <div><b>Período:</b> ${periodStart} — ${periodEnd}</div>
          </div>
        </div>
        ${customerName ? `
        <div class="customer-badge">
          <div class="label">Cliente</div>
          <div class="value">${esc(customerName)}</div>
        </div>` : ''}
      </div>

      <div class="summary">
        <div class="summary-card">
          <div class="summary-value">${data.activationCount}</div>
          <div class="summary-label">Acionamentos</div>
        </div>
        <div class="summary-card accent-green">
          <div class="summary-value">${formatDurationMinutes(data.totalOnMinutes)}</div>
          <div class="summary-label">Tempo ${esc(labelOn)}</div>
        </div>
        <div class="summary-card accent-amber">
          <div class="summary-value">${utilization}%</div>
          <div class="summary-label">Utilização</div>
        </div>
        <div class="summary-card accent-slate">
          <div class="summary-value">${data.totalHours.toFixed(1)}h</div>
          <div class="summary-label">Período Total</div>
        </div>
      </div>

      <h2 class="section-title">Histórico de Acionamentos</h2>
      <table>
        <thead>
          <tr>
            <th>Início</th>
            <th>Fim</th>
            <th>Estado</th>
            <th>Duração</th>
            <th>Origem</th>
          </tr>
        </thead>
        <tbody>
          ${data.segments.map(seg => `
            <tr>
              <td>${formatDateForExport(seg.startTime, locale)}</td>
              <td>${formatDateForExport(seg.endTime, locale)}</td>
              <td><span class="pill ${seg.state === 'on' ? 'pill-on' : 'pill-off'}">${seg.state === 'on' ? esc(labelOn) : esc(labelOff)}</span></td>
              <td>${formatDurationMinutes(seg.durationMinutes)}</td>
              <td>${seg.source === 'manual' ? 'Manual' : seg.source === 'schedule' ? 'Agendamento' : seg.source === 'automation' ? 'Automação' : 'Desconhecido'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <span class="issued">Emitido em ${issuedAt}</span>${customerName ? ` &middot; ${esc(customerName)}` : ''} &middot; <span class="brand">MyIO BAS</span>
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
        body { font-family: 'Nunito', system-ui, sans-serif; margin: 40px; color: #1f2937; }
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
