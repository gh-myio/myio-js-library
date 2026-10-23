/**
 * Lógica pura de estado das bombas / solenoide (ED-1354): converte telemetria
 * binária do ThingsBoard em intervalos ativos e deriva os números das modais.
 */
import type { EquipmentIndicator, StateInterval, WellPumpsModalData } from './types';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

const TRUE_WORDS = new Set(['1', 'true', 'on', 'ligada', 'ligado', 'open', 'opened', 'aberta', 'aberto', 'running', 'run']);
const FALSE_WORDS = new Set(['0', 'false', 'off', 'desligada', 'desligado', 'closed', 'close', 'fechada', 'fechado', 'stopped', 'stop']);

/** Interpreta o valor de uma telemetria binária; null = ilegível. */
export function parseBinaryState(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value !== 0 : null;
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (TRUE_WORDS.has(v)) return true;
  if (FALSE_WORDS.has(v)) return false;
  const n = Number(v);
  return v !== '' && Number.isFinite(n) ? n !== 0 : null;
}

export interface IntervalsOptions {
  /**
   * Limiar numérico: valor > threshold = ativo. Para bomba (convenção MAIN_BAS: ligada =
   * `consumption` > 0) use p.ex. o ruído do medidor em W. Sem threshold vale parseBinaryState.
   */
  threshold?: number;
}

/**
 * Pontos de telemetria (qualquer ordem, formato TB `{ ts, value }`) → intervalos ativos.
 * Pontos repetidos no mesmo estado não abrem/fecham intervalo; valores ilegíveis são ignorados.
 */
export function intervalsFromTelemetry(
  points: Array<{ ts: number; value: unknown }> | null | undefined,
  opts: IntervalsOptions = {}
): StateInterval[] {
  const toState = (v: unknown): boolean | null => {
    if (typeof opts.threshold !== 'number') return parseBinaryState(v);
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? n > opts.threshold : null;
  };
  const sorted = (points || [])
    .map((p) => ({ ts: Number(p?.ts), state: toState(p?.value) }))
    .filter((p) => Number.isFinite(p.ts) && p.state !== null)
    .sort((a, b) => a.ts - b.ts);

  const out: StateInterval[] = [];
  let open: number | null = null;
  for (const p of sorted) {
    if (p.state && open === null) open = p.ts;
    else if (!p.state && open !== null) {
      out.push([open, p.ts]);
      open = null;
    }
  }
  if (open !== null) out.push([open, null]);
  return out;
}

function hasUsableTelemetryPoint(
  points: Array<{ ts: number; value: unknown }> | null | undefined,
  parseValue: (value: unknown) => unknown | null
): boolean {
  return (points || []).some((point) => {
    const ts = Number(point?.ts);
    return point?.ts !== null && point?.ts !== undefined && Number.isFinite(ts) && parseValue(point?.value) !== null;
  });
}

function parseNumericTelemetry(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Telemetrias do ThingsBoard (convenção MAIN_BAS):
 *  - bomba (BOMBA_POCO / MOTOR): sem key de estado — ligada = `consumption` (potência instantânea, W) > limiar
 *  - solenoide (SOLENOIDE): `state` (fallback `status`) = 'on' (aberta) | 'off' (fechada)
 */
export const PUMP_POWER_KEY = 'consumption';
export const VALVE_STATE_KEYS = ['state', 'status'];

/** Histórico ligada/desligada da bomba; null indica ausência de amostras numéricas utilizáveis. */
export function pumpHistoryFromConsumption(
  points: Array<{ ts: number; value: unknown }> | null | undefined,
  thresholdW = 0
): StateInterval[] | null {
  if (!hasUsableTelemetryPoint(points, parseNumericTelemetry)) return null;
  return intervalsFromTelemetry(points, { threshold: thresholdW });
}

/** Histórico aberta/fechada da solenoide; null indica que não houve amostra binária utilizável. */
export function valveHistoryFromTelemetry(
  points: Array<{ ts: number; value: unknown }> | null | undefined
): StateInterval[] | null {
  if (!hasUsableTelemetryPoint(points, parseBinaryState)) return null;
  return intervalsFromTelemetry(points);
}

/** Potência atual em kW a partir do último ponto de `consumption` (W); null sem leitura. */
export function latestPowerKw(points: Array<{ ts: number; value: unknown }> | null | undefined): number | null {
  let best: { ts: number; v: number } | null = null;
  for (const p of points || []) {
    const ts = Number(p?.ts);
    const v = parseNumericTelemetry(p?.value);
    if (!Number.isFinite(ts) || v === null) continue;
    if (!best || ts > best.ts) best = { ts, v };
  }
  return best ? best.v / 1000 : null;
}

/** Ativo agora (último intervalo ainda aberto). */
export function isActive(history: StateInterval[] | null | undefined): boolean {
  const last = history?.[history.length - 1];
  return !!last && last[1] === null;
}

/** Desde quando está no estado atual; null sem histórico. */
export function stateSince(history: StateInterval[] | null | undefined): number | null {
  const last = history?.[history.length - 1];
  if (!last) return null;
  return last[1] === null ? last[0] : last[1];
}

/** Tempo ativo e nº de acionamentos desde a meia-noite local até `now`. */
export function dayStats(
  history: StateInterval[],
  now: number = Date.now()
): { activeMs: number; starts: number } {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const m = midnight.getTime();
  let activeMs = 0;
  let starts = 0;
  for (const [s, e] of history || []) {
    const end = Math.min(e ?? now, now);
    const a = Math.max(s, m);
    if (end > a) activeMs += end - a;
    if (s >= m && s <= now) starts++;
  }
  return { activeMs, starts };
}

export interface TimelineSegment {
  leftPct: number;
  widthPct: number;
  live: boolean;
  start: number;
  end: number | null;
}

/** Segmentos ativos na janela [now − windowMs, now] em % da largura (mín. 0,6% para continuar visível). */
export function timelineSegments(
  history: StateInterval[],
  now: number = Date.now(),
  windowMs: number = DAY_MS
): TimelineSegment[] {
  const from = now - windowMs;
  const out: TimelineSegment[] = [];
  for (const [s, e] of history || []) {
    const b = Math.min(e ?? now, now);
    if (b <= from || s >= now) continue;
    const a = Math.max(s, from);
    out.push({
      leftPct: ((a - from) / windowMs) * 100,
      widthPct: Math.max(((b - a) / windowMs) * 100, 0.6),
      live: e === null,
      start: s,
      end: e,
    });
  }
  return out;
}

export function formatClock(ts: number | null | undefined): string {
  if (ts === null || ts === undefined || !Number.isFinite(ts)) return '—';
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

/** Indicadores B1…Bn / S…Sm a partir dos dados da modal (mesma fonte para card, reservatório e atalho). */
export function indicatorsFromModalData(data: WellPumpsModalData | null | undefined): EquipmentIndicator[] {
  if (!data) return [];
  const list: EquipmentIndicator[] = (data.pumps || []).map((p) => ({
    code: p.code,
    label: p.label,
    kind: 'pump',
    active: Array.isArray(p.history) ? isActive(p.history) : null,
    since: stateSince(p.history),
    deviceProfile: p.deviceProfile || 'BOMBA_POCO',
  }));
  (data.valves || []).forEach((v) => {
    list.push({
      code: v.code,
      label: v.label,
      kind: 'valve',
      active: Array.isArray(v.history) ? isActive(v.history) : null,
      since: stateSince(v.history),
      deviceProfile: v.deviceProfile || 'SOLENOIDE',
    });
  });
  return list;
}
