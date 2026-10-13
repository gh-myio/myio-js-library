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
  type TbSaveConfig,
} from './AlarmAnnotations';
import { createPremiumModalChrome } from '../premium-modals/internal/PremiumModalChrome';
import { AlarmService } from '../../services/alarm/AlarmService';
import type { AlarmHistoryEventApi } from '../../services/alarm/types';

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
  if (!isFinite(ms) || ms < 0) return '-';
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
// Chart helpers
// =====================================================================

interface Bucket {
  label: string;
  total: number;
  byDevice: Record<string, number>; // device → count
}

// ─────────────────────────────────────────────────────────────────────────────
// Eventos reais do alarme: abertura (raisedAt) + GET /alarms/:id/history.
// Nada é estimado/interpolado — a API não manda contador de ocorrências, então
// ocorrência = abertura + cada reabertura (CLOSED → OPEN).
// ─────────────────────────────────────────────────────────────────────────────

type AlarmEventKind = 'raised' | 'reopened' | 'closed' | 'acknowledged' | 'silenced' | 'escalated' | 'other';

interface AlarmEvent {
  ts: number;
  kind: AlarmEventKind;
  alarmId: string;
  device: string;
  title: string;
  actor?: string;
  /** abertura ou reabertura */
  occurrence: boolean;
}

const EVENT_LABEL: Record<AlarmEventKind, string> = {
  raised: 'Abertura',
  reopened: 'Reabertura',
  closed: 'Fechamento',
  acknowledged: 'Reconhecido',
  silenced: 'Adiado',
  escalated: 'Escalado',
  other: 'Atualização',
};

function classifyHistoryEvent(ev: AlarmHistoryEventApi): AlarmEventKind {
  const action = String(ev.action || '').toUpperCase();
  const next = String(ev.newState || '').toUpperCase();
  const prev = String(ev.previousState || '').toUpperCase();
  if (next === 'OPEN') return prev && prev !== 'OPEN' ? (prev === 'CLOSED' ? 'reopened' : 'other') : 'raised';
  if (next === 'CLOSED' || /CLOSE/.test(action)) return 'closed';
  if (next === 'ACK' || next === 'ACKNOWLEDGED' || /ACK/.test(action)) return 'acknowledged';
  if (next === 'SNOOZED' || next === 'SILENCED' || /SILENC|SNOOZ/.test(action)) return 'silenced';
  if (next === 'ESCALATED' || /ESCALAT/.test(action)) return 'escalated';
  if (/CREAT|RAISE/.test(action)) return 'raised';
  return 'other';
}

async function loadAlarmEvents(alarm: Alarm): Promise<AlarmEvent[]> {
  const ids = alarm._groupAlarmIds?.length ? alarm._groupAlarmIds : [alarm.id];
  const aso: any[] = (window as any).AlarmServiceOrchestrator?.alarms || [];
  const byId = new Map<string, any>(aso.map((a) => [a?.id, a]));
  const single = ids.length === 1;
  const events: AlarmEvent[] = [];

  await Promise.all(
    ids.slice(0, 50).map(async (id) => {
      const raw = byId.get(id);
      const device = raw?.deviceName || alarm.source || '';
      const title = raw?.title || alarm.title;
      const raisedMs = new Date(raw?.raisedAt || (single ? alarm.firstOccurrence : '') || '').getTime();
      const hasRaise = Number.isFinite(raisedMs) && raisedMs > 0;
      if (hasRaise) events.push({ ts: raisedMs, kind: 'raised', alarmId: id, device, title, occurrence: true });

      const hist = await AlarmService.getAlarmHistory(id);
      for (const ev of hist) {
        const ts = new Date(ev.timestamp).getTime();
        if (!Number.isFinite(ts)) continue;
        const kind = classifyHistoryEvent(ev);
        // criação registrada no history = a própria abertura
        if (kind === 'raised' && hasRaise && Math.abs(ts - raisedMs) < 60_000) continue;
        events.push({
          ts,
          kind,
          alarmId: id,
          device,
          title,
          actor: ev.actor,
          occurrence: kind === 'raised' || kind === 'reopened',
        });
      }
    })
  );

  // Sem raisedAt resolvível (grupo fora do orquestrador): usa a primeira ocorrência do agregado
  if (!events.some((e) => e.occurrence)) {
    const ms = new Date(alarm.firstOccurrence).getTime();
    if (Number.isFinite(ms) && ms > 0) {
      events.push({ ts: ms, kind: 'raised', alarmId: alarm.id, device: alarm.source, title: alarm.title, occurrence: true });
    }
  }
  return events.sort((a, b) => a.ts - b.ts);
}

/** Agrupa as ocorrências reais em buckets de calendário entre fromMs e toMs. */
function bucketEvents(occ: AlarmEvent[], devices: string[], period: Period, fromMs: number, toMs: number): Bucket[] {
  const start = new Date(fromMs);
  if (period === 'hora') start.setMinutes(0, 0, 0);
  else start.setHours(0, 0, 0, 0);
  if (period === 'semana') start.setDate(start.getDate() - start.getDay());
  if (period === 'mes') start.setDate(1);

  const keys: number[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= toMs && keys.length < 5000) {
    keys.push(cursor.getTime());
    if (period === 'hora') cursor.setHours(cursor.getHours() + 1);
    else if (period === 'dia') cursor.setDate(cursor.getDate() + 1);
    else if (period === 'semana') cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  const maxBuckets = period === 'hora' ? 72 : period === 'dia' ? 92 : period === 'semana' ? 104 : 36;
  const ks = keys.slice(-maxBuckets);

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = (ms: number) => {
    const d = new Date(ms);
    if (period === 'hora') return `${dm(d)} ${String(d.getHours()).padStart(2, '0')}h`;
    if (period === 'mes') return `${months[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
    return dm(d);
  };

  const buckets: Bucket[] = ks.map((k) => ({ label: label(k), total: 0, byDevice: {} }));
  for (const e of occ) {
    let idx = -1;
    for (let i = ks.length - 1; i >= 0; i--) {
      if (ks[i] <= e.ts) {
        idx = i;
        break;
      }
    }
    if (idx < 0) continue;
    buckets[idx].total++;
    const dev = devices.includes(e.device) ? e.device : devices[0] ?? e.device;
    buckets[idx].byDevice[dev] = (buckets[idx].byDevice[dev] || 0) + 1;
  }
  return buckets;
}

function dowFromEvents(occ: AlarmEvent[]): number[] {
  const v = new Array(7).fill(0);
  occ.forEach((e) => v[new Date(e.ts).getDay()]++);
  return v;
}

function hodFromEvents(occ: AlarmEvent[]): number[] {
  const v = new Array(24).fill(0);
  occ.forEach((e) => v[new Date(e.ts).getHours()]++);
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// Device label (TB) + cor do tema do dashboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identidade do device no TB: label (entityLabel, o que o usuário reconhece) e name (entityName,
 * identificador técnico). O `source` do alarme é o deviceName do GCDR — em geral já o label do TB,
 * às vezes o name ou um nome divergente — então resolve nos dois sentidos, priorizando o deviceId.
 */
function resolveDeviceIdentity(alarm: Alarm, src: string): { label: string; name: string | null } {
  const orch = (window as any).MyIOOrchestrator;
  const nameToLabel: Map<string, string> | undefined = orch?.entityNameToLabelMap;
  const gcdrToLabel: Map<string, string> | undefined = orch?.gcdrDeviceNameMap;

  let label: string | null = null;
  // 1) deviceId do GCDR → label do TB (só quando o alarme é de um único device)
  if (alarm.deviceId && parseDevices(alarm.source).length <= 1) label = gcdrToLabel?.get?.(alarm.deviceId) || null;
  // 2) src é o name do TB
  if (!label && nameToLabel?.has?.(src)) label = nameToLabel.get(src) || null;
  if (!label) label = src;

  // name do TB: src já é name, ou busca reversa pelo label
  let name: string | null = nameToLabel?.has?.(src) ? src : null;
  if (!name && nameToLabel) {
    for (const [n, l] of nameToLabel) {
      if (l === label) {
        name = n;
        break;
      }
    }
  }
  return { label, name: name && name !== label ? name : null };
}

function resolveDeviceLabel(alarm: Alarm, src: string): string {
  return resolveDeviceIdentity(alarm, src).label;
}

/** Cor primária do tema do dashboard (MyIOUtils.theme) — para o que não aceita CSS var (Chart.js). */
function brandColor(fallback = '#7c3aed'): string {
  const theme = (window as any).MyIOUtils?.theme;
  const vars = typeof theme?.cssVars === 'function' ? theme.cssVars() : theme;
  const c = vars?.['--myio-brand-700'];
  return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim() : fallback;
}

const COPY_SVG =
  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';

/** Label em destaque + name discreto com botão de copiar (o name é o identificador técnico). */
function deviceIdentityHtml(alarm: Alarm, src: string): string {
  const { label, name } = resolveDeviceIdentity(alarm, src);
  const copyValue = name || src;
  return `<span class="adm-dev-id">
      <span class="adm-dev-label">${escHtml(label)}</span>
      ${name ? `<span class="adm-dev-name">${escHtml(name)}</span>` : ''}
      <button type="button" class="adm-copy-btn" data-copy="${escHtml(copyValue)}" title="Copiar nome do dispositivo">${COPY_SVG}</button>
    </span>`;
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
        backgroundColor: brandColor('#8b5cf6') + 'bb',
        borderColor: brandColor(),
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
        backgroundColor: brandColor('#3b82f6') + 'bb',
        borderColor: brandColor('#2563eb'),
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
// TB persistence helpers
// =====================================================================

/** Convert an alarm title to UPPER_SNAKE_CASE for use as alarmGroups key */
function normalizeAlarmType(title: string): string {
  return title
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

type RawItem = {
  centralId?: string;
  gcdrDeviceId?: string;
  id?: string;
  tbId?: string;
  identifier?: string;
  label?: string;
  name?: string;
  entityName?: string;
};

/**
 * Resolve the ThingsBoard device UUID from alarm data
 * by looking up window.STATE[domain]._raw items.
 *
 * Match order (first hit wins, across all domains):
 *   1. alarm.centralId === item.centralId
 *   2. alarm.source tokens vs item.identifier / label / name / entityName
 */
function resolveDeviceTbId(alarm: Alarm): string | null {
  const state = (window as unknown as Record<string, unknown>).STATE as
    | Record<string, { _raw?: RawItem[] }>
    | undefined;
  if (!state) return null;

  // Parse source into individual device tokens (e.g. "MED-001, MED-002")
  const sources = alarm.source
    ? alarm.source.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
    : [];

  for (const domain of ['energy', 'water', 'temperature']) {
    const raw = state[domain]?._raw ?? [];

    // 1. centralId exact match
    if (alarm.centralId) {
      const found = raw.find((item) => item.centralId && item.centralId === alarm.centralId);
      if (found?.id || found?.tbId) return (found.id || found.tbId)!;
    }

    // 2. Source identifier / label match
    for (const src of sources) {
      const found = raw.find(
        (item) =>
          (item.identifier && item.identifier === src) ||
          (item.label && item.label === src) ||
          (item.name && item.name === src) ||
          (item.entityName && item.entityName === src)
      );
      if (found?.id || found?.tbId) return (found.id || found.tbId)!;
    }
  }
  return null;
}

// =====================================================================
// Main export
// =====================================================================

// Feature flag — Anotações tab temporarily hidden.
// Flip to false to restore. The tab button, panel body and event wiring
// are all gated on this flag so removing it is one edit.
const HIDE_ANNOTATIONS_TAB = true;

export function openAlarmDetailsModal(
  alarm: Alarm,
  themeMode: 'light' | 'dark' = 'light',
  groupMode?: 'consolidado' | 'separado' | 'porDispositivo',
  onAction?: (action: 'acknowledge' | 'snooze' | 'escalate', alarmId: string) => void
): void {
  const sev = SEVERITY_CONFIG[alarm.severity];
  const st = STATE_CONFIG[alarm.state];

  const firstMs = new Date(alarm.firstOccurrence).getTime();
  const lastMs  = new Date(alarm.lastOccurrence).getTime();
  // "Aberto há" (agora − abertura) para alarme ativo; "Duração" (fechamento − abertura) quando fechado.
  // lastOccurrence é o lastUpdatedAt do GCDR — não é ocorrência, por isso não entra na conta.
  const isClosedState = alarm.state === 'CLOSED';
  const closedMs = alarm.closedAt ? new Date(alarm.closedAt).getTime() : NaN;
  const ageMs = isNaN(firstMs)
    ? NaN
    : isClosedState
      ? (Number.isFinite(closedMs) ? closedMs : lastMs) - firstMs
      : Date.now() - firstMs;
  const ageKpiLabel = isClosedState ? 'Duração' : 'Aberto há';

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
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        </div>
        <span class="adm-device-row-name">${deviceIdentityHtml(alarm, dev)}</span>
        <span class="adm-device-row-sub">${escHtml(alarm.customerName || '-')}</span>
      </div>`
    )
    .join('');

  // Período inicial do gráfico pela idade do alarme
  const spanMs = Number.isFinite(ageMs) ? ageMs : 0;
  const initialPeriod: Period =
    spanMs < 3 * 86_400_000 ? 'hora' :
    spanMs < 45 * 86_400_000 ? 'dia' :
    spanMs < 180 * 86_400_000 ? 'semana' : 'mes';
  const chartSingleColor = sev.text || '#7c3aed';

  // Eventos reais (carregados após abrir a modal)
  let events: AlarmEvent[] | null = null;
  const occEvents = (): AlarmEvent[] => (events || []).filter((e) => e.occurrence);
  const onEventsReady: Array<() => void> = [];

  // Annotation count (persisted across modal open/close in session)
  const annotCount = getActiveAnnotationCount(alarm.id);

  // Header source display
  const sourceDisplay =
    deviceCount > 1
      ? `${deviceCount} dispositivos`
      : escHtml(resolveDeviceLabel(alarm, alarm.source) || alarm.source);

  const overlay = document.createElement('div');
  overlay.className = 'adm-overlay';
  overlay.setAttribute('data-theme', themeMode);

  overlay.innerHTML = `
    <div class="adm-drawer" role="dialog" aria-modal="true" aria-label="Detalhes do alarme">

      <!-- ── Header (título/maximizar/fechar vêm da moldura padrão; aqui só os badges) ── -->
      <div class="adm-header">
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
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="7.05" y2="7.05"/><line x1="16.95" y1="16.95" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="7.05" y2="16.95"/><line x1="16.95" y1="7.05" x2="19.78" y2="4.22"/></svg>
          Timeline <span class="adm-tab-badge" id="admTlTabBadge">…</span>
        </button>
        <button class="adm-tab" data-panel="dispositivos">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M20 3H4a1 1 0 00-1 1v12a1 1 0 001 1h8v2H8v2h8v-2h-4v-2h8a1 1 0 001-1V4a1 1 0 00-1-1zm-1 12H5V5h14v10z"/></svg>
          Dispositivos <span class="adm-tab-badge">${deviceCount}</span>
        </button>
        <button class="adm-tab" data-panel="grafico">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 20 9 12 14 16 19 6"/><polyline points="19 6 19 10"/><polyline points="19 6 15 6"/></svg>
          Gráfico
        </button>
        ${HIDE_ANNOTATIONS_TAB ? '' : `<button class="adm-tab" data-panel="anotacoes">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 001 1h4"/><path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
          Anotações${annotCount > 0 ? ` <span class="adm-tab-badge">${annotCount}</span>` : ''}
        </button>`}
      </nav>

      <!-- ── Body ── -->
      <div class="adm-body">

        <!-- RESUMO -->
        <div class="adm-panel is-active" data-panel="resumo">
          ${groupMode !== 'separado' ? `<div class="adm-kpi-grid">
            <div class="adm-kpi" title="Abertura + reaberturas registradas no histórico do alarme">
              <div class="adm-kpi-value" id="admKpiOcc" style="color:${sev.text}">…</div>
              <div class="adm-kpi-label">Ocorrências</div>
            </div>
            <div class="adm-kpi">
              <div class="adm-kpi-value">${deviceCount}</div>
              <div class="adm-kpi-label">Dispositivos</div>
            </div>
            <div class="adm-kpi" title="${isClosedState ? 'Da abertura ao fechamento' : 'Desde a abertura do alarme até agora'}">
              <div class="adm-kpi-value">${Number.isFinite(ageMs) ? durationLabel(ageMs) : '-'}</div>
              <div class="adm-kpi-label">${ageKpiLabel}</div>
            </div>
          </div>` : ''}

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
            ${devices.length
              ? `<div class="adm-row"><span class="adm-row-label">Dispositivo(s)</span><span class="adm-row-value adm-row-value--devices">${devices.map((d) => deviceIdentityHtml(alarm, d)).join('')}</span></div>`
              : ''}
            ${alarm.triggerValue != null ? row('Valor do disparo', String(alarm.triggerValue)) : ''}
            ${groupMode === 'separado' ? row('ID', alarm.id) : ''}
          </div>

          <div class="adm-section">
            <div class="adm-section-title">Datas</div>
            ${row('Aberto em', fmt(alarm.firstOccurrence))}
            <div id="admReopenRows"></div>
            ${row('Última atualização', fmt(alarm.lastOccurrence))}
            ${alarm.acknowledgedAt ? row('Reconhecido em', fmt(alarm.acknowledgedAt)) : ''}
            ${alarm.acknowledgedBy ? row('Reconhecido por', alarm.acknowledgedBy) : ''}
            ${alarm.snoozedUntil ? row('Adiado até', fmt(alarm.snoozedUntil)) : ''}
            ${alarm.closedAt ? row('Fechado em', fmt(alarm.closedAt)) : ''}
            ${alarm.closedBy ? row('Fechado por', alarm.closedBy) : ''}
            ${alarm.closedReason ? row('Motivo', alarm.closedReason) : ''}
          </div>

        </div>

        <!-- DISPOSITIVOS -->
        <div class="adm-panel" data-panel="dispositivos">
          <div class="adm-section">
            <div class="adm-section-title">${deviceCount} dispositivo${deviceCount !== 1 ? 's' : ''} de origem</div>
            <div class="adm-devices-list">
              ${devicesListHtml}
            </div>
          </div>

          ${
            groupMode !== 'separado' && alarm._groupAlarmIds && alarm._groupAlarmIds.length > 0
              ? `
          <div class="adm-section">
            <div class="adm-section-title">IDs de Alarme (${alarm._groupAlarmIds.length})</div>
            <div class="adm-alarm-ids-list" style="display:flex;flex-wrap:wrap;gap:6px;">
              ${alarm._groupAlarmIds
                .map(
                  (rawId) =>
                    `<span class="adm-alarm-id-chip" title="Clique para copiar" data-copy-id="${escHtml(rawId)}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid color-mix(in srgb, var(--myio-brand-700, #7c3aed) 25%, transparent);background:color-mix(in srgb, var(--myio-brand-700, #7c3aed) 8%, transparent);border-radius:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--myio-brand-700, #4c1d95);cursor:pointer;user-select:all;">${escHtml(rawId)}</span>`
                )
                .join('')}
            </div>
          </div>`
              : ''
          }

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

        <!-- TIMELINE (ocorrências + ações individuais e em lote) -->
        <div class="adm-panel" data-panel="timeline">
          <div class="adm-tl-header" id="admTlHeader">
            <div class="adm-tl-toolbar">
              <span class="adm-tl-summary" id="admTlSummary">Carregando histórico…</span>
              <button class="adm-tl-batch-toggle" id="admTlBatchToggle" title="Ações em lote">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="4" height="4" rx="1"/><path d="M10 7h11"/><rect x="3" y="12" width="4" height="4" rx="1"/><path d="M10 14h11"/><rect x="3" y="19" width="4" height="4" rx="1"/><path d="M10 21h11"/></svg>
                Ação em lote
              </button>
            </div>
            <div class="adm-tl-batch-bar" id="admTlBatchBar">
              <label class="adm-tl-sel-all-label">
                <input type="checkbox" id="admTlSelAll" class="adm-tl-sel-all-cb">
                <span>Todos</span>
              </label>
              <span class="adm-tl-sel-count" id="admTlSelCount">0 selecionados</span>
              <select class="adm-tl-action-sel" id="admTlActionSel">
                <option value="">Selecione ação…</option>
                <option value="acknowledge">Reconhecer</option>
                <option value="snooze">Adiar</option>
                <option value="escalate">Escalar</option>
              </select>
              <button class="adm-tl-exec-btn" id="admTlExecBtn" disabled>Executar</button>
              <button class="adm-tl-cancel-btn" id="admTlCancelBtn">Cancelar</button>
            </div>
          </div>
          <div class="adm-report-toolbar">
            <label class="adm-report-label">De</label>
            <input type="date" class="adm-report-date-input" id="admRptStart" value="${fmtDateInput(firstMs)}">
            <label class="adm-report-label">Até</label>
            <input type="date" class="adm-report-date-input" id="admRptEnd" value="${fmtDateInput(Date.now())}">
            <button class="adm-report-emit-btn" id="admRptEmit">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              Carregar
            </button>
            <button class="adm-export-btn" id="admExportCsv" disabled>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
              CSV
            </button>
            <button class="adm-export-btn adm-export-btn--pdf" id="admExportPdf" disabled>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              PDF
            </button>
          </div>
          <div class="adm-report-grid" id="admRptGrid">
            <div class="adm-report-empty-hint">Configure o período e clique em <strong>Carregar</strong>.</div>
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
            <div class="adm-section-title">Ocorrências no período</div>
            <div class="adm-chart-note" id="admChartNote">Carregando histórico…</div>
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
        ${HIDE_ANNOTATIONS_TAB ? '' : `<div class="adm-panel" data-panel="anotacoes">
          ${buildAnnotationsPanelHtml(alarm.id)}
        </div>`}

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

  // Click-to-copy for IDs de Alarme chips (visible only for consolidado / porDispositivo)
  overlay.querySelectorAll<HTMLElement>('.adm-alarm-id-chip[data-copy-id]').forEach((chip) => {
    chip.addEventListener('click', async () => {
      const id = chip.getAttribute('data-copy-id') || '';
      if (!id) return;
      try {
        await navigator.clipboard?.writeText(id);
        const prev = chip.textContent;
        chip.textContent = '✓ copiado';
        setTimeout(() => { chip.textContent = prev; }, 900);
      } catch { /* clipboard blocked — ignore */ }
    });
  });

  // Chart.js handlers (scoped to grafico panel) — só ocorrências reais
  const chartInstances: any[] = []; // [0]=main [1]=dow [2]=hod
  const graficoPanel = overlay.querySelector<HTMLElement>('.adm-panel[data-panel="grafico"]');
  if (graficoPanel) {
    let activeChartType: 'bar' | 'line' = 'bar';
    let activeVizMode: 'total' | 'separate' = 'total';
    let activePeriod: Period = initialPeriod;
    const noteEl = graficoPanel.querySelector<HTMLElement>('#admChartNote');

    const updateNote = () => {
      if (!noteEl) return;
      if (!events) {
        noteEl.textContent = 'Carregando histórico…';
        return;
      }
      const n = occEvents().length;
      noteEl.textContent =
        `${n} ocorrência${n !== 1 ? 's' : ''} registrada${n !== 1 ? 's' : ''} (abertura + reaberturas do histórico do alarme).` +
        (n < 3 ? ' Poucos eventos para indicar tendência.' : '');
    };

    const buildMain = () => {
      updateNote();
      if (!events) return;
      const canvas = graficoPanel.querySelector<HTMLCanvasElement>('#admMainChart');
      if (!canvas) return;
      const occ = occEvents();
      const fromMs = occ.length ? occ[0].ts : Number.isFinite(firstMs) ? firstMs : Date.now();
      const nb = bucketEvents(occ, devices, activePeriod, fromMs, Date.now());
      if (chartInstances[0]) { chartInstances[0].destroy(); chartInstances[0] = null; }
      chartInstances[0] = createMainChart(canvas, nb, devices, activeChartType, activeVizMode, chartSingleColor);
    };

    const buildSecondary = () => {
      if (!events) return;
      const occ = occEvents();
      const dowCanvas = graficoPanel.querySelector<HTMLCanvasElement>('#admDowChart');
      if (chartInstances[1]) { chartInstances[1].destroy(); chartInstances[1] = null; }
      if (dowCanvas) chartInstances[1] = createDowChart(dowCanvas, dowFromEvents(occ));
      const hodCanvas = graficoPanel.querySelector<HTMLCanvasElement>('#admHodChart');
      if (chartInstances[2]) { chartInstances[2].destroy(); chartInstances[2] = null; }
      if (hodCanvas) chartInstances[2] = createHodChart(hodCanvas, hodFromEvents(occ));
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

    const renderCharts = () => {
      buildMain();
      buildSecondary();
    };

    // Canvas precisa estar visível para dimensionar: desenha ao abrir a aba e quando o histórico chega
    overlay.querySelectorAll<HTMLElement>('.adm-tab[data-panel="grafico"]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => setTimeout(renderCharts, 30));
    });
    onEventsReady.push(() => {
      if (graficoPanel.classList.contains('is-active')) renderCharts();
      else updateNote();
    });
  }

  // Timeline tab handlers
  const rptPanel = overlay.querySelector<HTMLElement>('.adm-panel[data-panel="timeline"]');
  if (rptPanel) {
    const emitBtn = rptPanel.querySelector<HTMLButtonElement>('#admRptEmit');
    const csvBtn  = rptPanel.querySelector<HTMLButtonElement>('#admExportCsv');
    const pdfBtn  = rptPanel.querySelector<HTMLButtonElement>('#admExportPdf');
    const grid    = rptPanel.querySelector<HTMLElement>('#admRptGrid');
    const isSeparado = groupMode === 'separado';

    // Holds latest CSV data for the static export buttons
    let lastCsvRows: string[][] = [];

    // ── Batch state ──
    let batchActive = false;
    const batchSelectedIds = new Set<string>();

    // ── Shared SVG icons for row action buttons ──
    const _svgAck      = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
    const _svgSnooze   = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>`;
    const _svgEscalate = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg>`;

    // ── Tabela de eventos reais (respeita o filtro de datas) ──
    const buildOccurrenceSection = (startMs: number, endMs: number): { html: string; csvRows: string[][] } => {
      if (!events) {
        return { html: '<div class="adm-report-empty-hint">Carregando histórico do alarme…</div>', csvRows: [] };
      }
      const showDevice = !isSeparado && devices.length > 0;
      const showAlarm  = groupMode === 'porDispositivo' && (alarm._groupAlarmIds?.length || 0) > 1;
      const isActive   = alarm.state === 'OPEN' || alarm.state === 'ESCALATED';
      const isClosed   = alarm.state === 'CLOSED';

      // numeração global das ocorrências (abertura = #1)
      const occIndex = new Map<AlarmEvent, number>();
      occEvents().forEach((e, i) => occIndex.set(e, i + 1));

      const inRange = events
        .filter((e) => e.ts >= startMs && e.ts <= endMs)
        .sort((a, b) => b.ts - a.ts || (occIndex.get(b) || 0) - (occIndex.get(a) || 0));

      const csvHeader = ['#', 'Data/Hora', 'Evento'];
      if (showAlarm) csvHeader.push('Alarme');
      if (showDevice) csvHeader.push('Dispositivo', 'Name (TB)');
      csvHeader.push('Por');
      const rows: string[][] = [csvHeader];

      const kindStyle: Record<AlarmEventKind, string> = {
        raised: 'color:#ef4444;font-weight:700',
        reopened: 'color:#d97706;font-weight:700',
        closed: 'color:#16a34a;font-weight:700',
        acknowledged: 'color:var(--myio-brand-700, #7c3aed);font-weight:600',
        silenced: 'color:#6b7280;font-weight:600',
        escalated: 'color:#dc2626;font-weight:600',
        other: 'color:#6b7280',
      };

      const thead = `<thead><tr>
        <th class="adm-rpt-th adm-rpt-th--idx">#</th>
        <th class="adm-rpt-th">Data/Hora</th>
        <th class="adm-rpt-th">Evento</th>
        ${showAlarm ? `<th class="adm-rpt-th">Alarme</th>` : ''}
        ${showDevice ? `<th class="adm-rpt-th">Dispositivo</th>` : ''}
        <th class="adm-rpt-th">Por</th>
        <th class="adm-rpt-th adm-tl-actions-th">Ações</th>
      </tr></thead>`;

      const MAX_SHOWN = 200;
      const tableRows = inRange.slice(0, MAX_SHOWN).map((e, ri) => {
        const n = occIndex.get(e);
        const ident = showDevice ? resolveDeviceIdentity(alarm, e.device) : null;
        const actor = e.kind === 'raised' ? 'regra' : e.actor === 'system' ? 'sistema' : e.actor || '-';
        const csvRow = [n ? `#${n}` : '', fmt(e.ts), EVENT_LABEL[e.kind]];
        if (showAlarm) csvRow.push(e.title);
        if (showDevice) csvRow.push(ident!.label, ident!.name || e.device);
        csvRow.push(actor);
        rows.push(csvRow);
        const itemId = `${e.alarmId}__ev${ri}`;
        return `<tr>
          <td class="adm-rpt-cell adm-rpt-cell--idx">${n ? `#${n}` : ''}</td>
          <td class="adm-rpt-cell">${fmt(e.ts)}</td>
          <td class="adm-rpt-cell" style="${kindStyle[e.kind]}">${EVENT_LABEL[e.kind]}</td>
          ${showAlarm ? `<td class="adm-rpt-cell">${escHtml(e.title)}</td>` : ''}
          ${showDevice ? `<td class="adm-rpt-cell adm-rpt-cell--dev" title="${escHtml(ident!.name || e.device)}">${escHtml(ident!.label)}</td>` : ''}
          <td class="adm-rpt-cell">${escHtml(actor)}</td>
          <td class="adm-rpt-cell adm-tl-action-cell">
            ${e.occurrence ? `<label class="adm-tl-cb-wrap" data-cb-wrap><input type="checkbox" class="adm-tl-row-cb" data-item-id="${escHtml(itemId)}"></label>
            <div class="adm-tl-row-btns" data-row-btns>
              ${isActive ? `<button class="adm-tl-row-btn adm-tl-row-btn--ack" data-action="acknowledge" data-item-id="${escHtml(itemId)}" title="Reconhecer">${_svgAck}</button>` : ''}
              ${!isClosed ? `<button class="adm-tl-row-btn adm-tl-row-btn--snooze" data-action="snooze" data-item-id="${escHtml(itemId)}" title="Adiar">${_svgSnooze}</button>` : ''}
              ${!isClosed ? `<button class="adm-tl-row-btn adm-tl-row-btn--escalate" data-action="escalate" data-item-id="${escHtml(itemId)}" title="Escalar">${_svgEscalate}</button>` : ''}
            </div>` : ''}
          </td>
        </tr>`;
      });

      const occInRange = inRange.filter((e) => e.occurrence).length;
      const colspan = 4 + (showAlarm ? 1 : 0) + (showDevice ? 1 : 0);
      const html = inRange.length
        ? `<div class="adm-rpt-table-wrap" id="admRptTableWrap" style="max-height:340px;overflow-y:auto">
        <table class="adm-rpt-table">
          ${thead}
          <tbody>${tableRows.join('')}</tbody>
          <tfoot><tr>
            <td class="adm-rpt-cell adm-rpt-cell--total" colspan="${colspan}">Total: ${occInRange} ocorrência${occInRange !== 1 ? 's' : ''} · ${inRange.length} evento${inRange.length !== 1 ? 's' : ''}</td>
            <td class="adm-rpt-cell adm-rpt-cell--total"></td>
          </tr></tfoot>
        </table>
      </div>`
        : '<div class="adm-report-empty-hint">Nenhum evento no período selecionado.</div>';

      return { html, csvRows: rows };
    };

    const buildReportTable = () => {
      const startInput = rptPanel.querySelector<HTMLInputElement>('#admRptStart');
      const endInput   = rptPanel.querySelector<HTMLInputElement>('#admRptEnd');
      // input date = meia-noite UTC; ajusta para o dia local inteiro
      const toLocalDay = (v: string) => {
        const [y, m, d] = v.split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1).getTime();
      };
      const startMs = startInput?.value ? toLocalDay(startInput.value) : 0;
      const endMs   = endInput?.value ? toLocalDay(endInput.value) + 86_400_000 - 1 : Date.now();

      // ── Header (separado only) ──
      const headerHtml = isSeparado
        ? `<div class="adm-rpt-device-header">
            <span class="adm-rpt-device-name" title="${escHtml(alarm.source)}">${escHtml(resolveDeviceLabel(alarm, alarm.source) || alarm.source)}</span>
            <span class="adm-rpt-device-sep">·</span>
            <span class="adm-rpt-alarm-type">${escHtml(alarm.title)}</span>
          </div>`
        : '';

      const { html: occHtml, csvRows } = buildOccurrenceSection(startMs, endMs);
      lastCsvRows = csvRows;

      const occ = occEvents();
      const occN = occ.length;
      const sectionTitle = events
        ? `${occN} ocorrência${occN !== 1 ? 's' : ''} · ${events.length} evento${events.length !== 1 ? 's' : ''} no histórico`
        : 'Histórico do alarme';

      // ── Estatísticas (só com dados reais) ──
      const reopenN = occ.filter((e) => e.kind === 'reopened').length;
      const statsHtml = events && (occN > 1 || alarm.triggerValue != null)
        ? `<div class="adm-section">
            <div class="adm-section-title">Estatísticas de recorrência</div>
            ${alarm.triggerValue != null ? row('Valor do último disparo', String(alarm.triggerValue)) : ''}
            ${occN > 1 ? row('Reaberturas', String(reopenN)) : ''}
            ${occN > 1 ? row('Intervalo médio entre ocorrências', durationLabel((occ[occN - 1].ts - occ[0].ts) / (occN - 1))) : ''}
            ${occN > 1 ? row('Primeira ocorrência', fmt(occ[0].ts)) : ''}
            ${occN > 1 ? row('Última ocorrência', fmt(occ[occN - 1].ts)) : ''}
          </div>`
        : '';

      // ── Sumário por dispositivo (consolidado / porDispositivo) ──
      let summaryHtml = '';
      if (events && !isSeparado && devices.length > 0) {
        const byDev = new Map<string, AlarmEvent[]>();
        occ.forEach((e) => {
          const k = devices.includes(e.device) ? e.device : devices[0];
          byDev.set(k, [...(byDev.get(k) || []), e]);
        });
        const devRows = devices.map((dev) => {
          const list = byDev.get(dev) || [];
          return `<tr>
          <td class="adm-rpt-cell" title="${escHtml(dev)}">${escHtml(resolveDeviceLabel(alarm, dev) || dev)}</td>
          <td class="adm-rpt-cell adm-rpt-cell--num">${list.length}</td>
          <td class="adm-rpt-cell">${list.length ? fmt(list[0].ts) : '-'}</td>
          <td class="adm-rpt-cell">${list.length ? fmt(list[list.length - 1].ts) : '-'}</td>
        </tr>`;
        }).join('');
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

      if (!grid) return;
      grid.innerHTML = `
        ${headerHtml}
        <div class="adm-section">
          <div class="adm-section-title">${sectionTitle}</div>
          ${occHtml}
        </div>
        ${statsHtml}
        ${summaryHtml}`;

      if (events) {
        csvBtn?.removeAttribute('disabled');
        pdfBtn?.removeAttribute('disabled');
      }
    };

    // ── Static export handlers (bound once, use latest lastCsvRows) ──
    csvBtn?.addEventListener('click', () => {
      if (!lastCsvRows.length) return;
      const csv = lastCsvRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `relatorio-${alarm.id}.csv`; a.click();
      URL.revokeObjectURL(url);
    });

    pdfBtn?.addEventListener('click', () => {
      if (!grid || !lastCsvRows.length) return;
      const win = window.open('', '_blank', 'width=860,height=660');
      if (!win) return;
      const tbl    = grid.querySelector('#admRptTableWrap')?.outerHTML ?? '';
      const sumTbl = grid.querySelector('.adm-rpt-table-wrap--summary')?.outerHTML ?? '';
      win.document.write(`<!DOCTYPE html><html><head><title>Relatório — ${escHtml(alarm.title)}</title>
        <style>
          body{font-family:Nunito, system-ui, sans-serif;padding:24px;font-size:12px;color:#111;}
          h2{font-size:15px;margin:0 0 4px;}p{color:#6b7280;font-size:11px;margin:0 0 16px;}
          h3{font-size:12px;font-weight:700;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.5px;color:#7c3aed;}
          table{border-collapse:collapse;width:100%;margin-bottom:16px;}
          th,td{border:1px solid #e5e7eb;padding:7px 10px;text-align:left;}
          th{background:#f9fafb;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.4px;}
          tr:nth-child(even) td{background:#fafafa;}
          tfoot td{font-weight:700;background:#ede9fe;}
        </style></head><body>
        <h2>${escHtml(alarm.title)}</h2>
        <p>${escHtml(alarm.id)} · ${escHtml(alarm.customerName || '')} · ${occEvents().length} ocorrência${occEvents().length !== 1 ? 's' : ''} · Emitido em ${new Date().toLocaleDateString('pt-BR')}</p>
        <h3>Histórico</h3>${tbl}
        ${sumTbl ? `<h3>Sumário por dispositivo</h3>${sumTbl}` : ''}
        <script>window.onload=function(){window.print();window.close();}<\/script>
        </body></html>`);
      win.document.close();
    });

    const refreshReport = () => {
      buildReportTable();
      // Re-apply batch visuals to newly rendered rows if batch mode is still active
      if (batchActive && grid) {
        grid.querySelectorAll<HTMLElement>('[data-cb-wrap]').forEach((el) => { el.style.display = 'inline-flex'; });
        grid.querySelectorAll<HTMLElement>('[data-row-btns]').forEach((el) => { el.style.display = 'none'; });
      }
    };
    emitBtn?.addEventListener('click', refreshReport);

    // Auto-load com a data padrão ao abrir o modal (e de novo quando o histórico chegar)
    buildReportTable();
    onEventsReady.push(refreshReport);

    // ── Batch mode logic ──
    const batchToggleBtn = rptPanel.querySelector<HTMLButtonElement>('#admTlBatchToggle');
    const batchBar       = rptPanel.querySelector<HTMLElement>('#admTlBatchBar');
    const selAllCb       = rptPanel.querySelector<HTMLInputElement>('#admTlSelAll');
    const selCountEl     = rptPanel.querySelector<HTMLElement>('#admTlSelCount');
    const actionSel      = rptPanel.querySelector<HTMLSelectElement>('#admTlActionSel');
    const execBtn        = rptPanel.querySelector<HTMLButtonElement>('#admTlExecBtn');
    const cancelBatchBtn = rptPanel.querySelector<HTMLButtonElement>('#admTlCancelBtn');

    const getAllRowCbs = () =>
      Array.from((grid ?? rptPanel).querySelectorAll<HTMLInputElement>('.adm-tl-row-cb'));

    const updateBatchSelCount = () => {
      if (selCountEl) selCountEl.textContent = `${batchSelectedIds.size} selecionado${batchSelectedIds.size !== 1 ? 's' : ''}`;
      if (execBtn) execBtn.disabled = batchSelectedIds.size === 0 || !actionSel?.value;
    };

    const applyBatchVisuals = (active: boolean) => {
      (grid ?? rptPanel).querySelectorAll<HTMLElement>('[data-cb-wrap]').forEach((el) => {
        el.style.display = active ? 'inline-flex' : 'none';
      });
      (grid ?? rptPanel).querySelectorAll<HTMLElement>('[data-row-btns]').forEach((el) => {
        el.style.display = active ? 'none' : 'inline-flex';
      });
    };

    const setBatchMode = (active: boolean) => {
      batchActive = active;
      batchToggleBtn?.classList.toggle('is-active', active);
      if (batchBar) batchBar.style.display = active ? 'flex' : 'none';
      applyBatchVisuals(active);
      if (!active) {
        batchSelectedIds.clear();
        if (selAllCb) selAllCb.checked = false;
        if (actionSel) actionSel.value = '';
        updateBatchSelCount();
      }
    };

    batchToggleBtn?.addEventListener('click', () => setBatchMode(!batchActive));
    cancelBatchBtn?.addEventListener('click', () => setBatchMode(false));

    selAllCb?.addEventListener('change', () => {
      const checked = selAllCb.checked;
      getAllRowCbs().forEach((cb) => {
        cb.checked = checked;
        if (checked && cb.dataset.itemId) batchSelectedIds.add(cb.dataset.itemId);
      });
      if (!checked) batchSelectedIds.clear();
      updateBatchSelCount();
    });

    actionSel?.addEventListener('change', () => updateBatchSelCount());

    // Delegation: row checkbox changes (rows rebuilt on date filter)
    grid?.addEventListener('change', (e) => {
      const cb = (e.target as HTMLElement).closest<HTMLInputElement>('.adm-tl-row-cb');
      if (!cb) return;
      const id = cb.dataset.itemId;
      if (!id) return;
      if (cb.checked) batchSelectedIds.add(id);
      else {
        batchSelectedIds.delete(id);
        if (selAllCb) selAllCb.checked = false;
      }
      updateBatchSelCount();
    });

    // Delegation: per-row quick action button clicks
    grid?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action][data-item-id]');
      if (!btn || !onAction) return;
      const action = btn.dataset.action as 'acknowledge' | 'snooze' | 'escalate';
      const itemId = btn.dataset.itemId!;
      const baseId = itemId.split('__')[0];
      if (action && baseId) onAction(action, baseId);
    });

    // Batch execute
    execBtn?.addEventListener('click', () => {
      const action = actionSel?.value as 'acknowledge' | 'snooze' | 'escalate' | '';
      if (!action || batchSelectedIds.size === 0 || !onAction) return;
      const uniqueBaseIds = [...new Set([...batchSelectedIds].map((id) => id.split('__')[0]))];
      uniqueBaseIds.forEach((id) => onAction(action, id));
      setBatchMode(false);
    });
  }

  // Anotações tab — bind interactive events
  const annotPanelEl = overlay.querySelector<HTMLElement>('.adm-panel[data-panel="anotacoes"]');
  if (annotPanelEl) {
    const currentUser = (window as any).MyIOUtils?.currentUserEmail || alarm.acknowledgedBy || alarm.customerName || 'Usuário';

    // Build TB persistence config if credentials are available
    let tbCfg: TbSaveConfig | undefined;
    const tbBaseUrl: string =
      (window as any).__myioTbBaseUrl ||
      (window as any).MyIOOrchestrator?.tbBaseUrl ||
      '';
    const jwtToken: string = localStorage.getItem('jwt_token') || '';
    const tbDeviceId = resolveDeviceTbId(alarm);
    if (tbBaseUrl && jwtToken && tbDeviceId) {
      tbCfg = {
        deviceId: tbDeviceId,
        tbBaseUrl,
        jwtToken,
        alarmType: normalizeAlarmType(alarm.title),
        alarmTitle: alarm.title,
      };
    }

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
    }, tbCfg);
  }

  // Histórico real → KPIs, datas de reabertura, Timeline e Gráfico
  const applyEvents = () => {
    const occ = occEvents();
    const occText = events ? String(occ.length || '-') : '…';
    const kpi = overlay.querySelector<HTMLElement>('#admKpiOcc');
    if (kpi) kpi.textContent = occText;
    const badge = overlay.querySelector<HTMLElement>('#admTlTabBadge');
    if (badge) badge.textContent = occText;
    const summary = overlay.querySelector<HTMLElement>('#admTlSummary');
    if (summary && events) summary.textContent = `${occ.length} ocorrência${occ.length !== 1 ? 's' : ''}`;

    const reopenEl = overlay.querySelector<HTMLElement>('#admReopenRows');
    const reopens = occ.filter((e) => e.kind === 'reopened');
    if (reopenEl) {
      reopenEl.innerHTML = reopens.length
        ? row('Última reabertura', fmt(reopens[reopens.length - 1].ts)) +
          (reopens.length > 1 ? row('Reaberturas', String(reopens.length)) : '')
        : '';
    }
    onEventsReady.forEach((fn) => { try { fn(); } catch (_) { /* noop */ } });
  };

  loadAlarmEvents(alarm)
    .then((ev) => { events = ev; })
    .catch(() => { events = []; })
    .then(() => { if (overlay.isConnected) applyEvents(); });

  // Moldura padrão: header no acento do tema (maximizar/fechar) + footer premium
  const drawer = overlay.querySelector('.adm-drawer') as HTMLElement;
  const chrome = createPremiumModalChrome({
    modalId: 'adm-modal',
    icon: '🔔',
    title: escHtml(alarm.title),
    modalEl: drawer,
    theme: themeMode,
    maximizedClass: 'adm-drawer--maximized',
    headerRadius: '18px 18px 0 0',
    onClose: () => closeModal(),
    footer: alarm.customerName ? { customerName: alarm.customerName } : {},
  });

  // Close
  const closeModal = () => {
    chrome.destroy();
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

  // Copiar o name técnico do device
  overlay.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.adm-copy-btn');
    if (!btn) return;
    e.stopPropagation();
    const text = btn.getAttribute('data-copy') || '';
    const done = () => {
      btn.classList.add('is-copied');
      btn.title = 'Copiado!';
      setTimeout(() => {
        btn.classList.remove('is-copied');
        btn.title = 'Copiar nome do dispositivo';
      }, 1200);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => {});
    else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (_) { /* noop */ }
      ta.remove();
    }
  });
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
       ${escHtml(resolveDeviceLabel(alarm, dev) || dev)}
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
