/**
 * "Temperatura Atual" da TemperatureModal — sempre a leitura MAIS RECENTE do sensor, independente do
 * período filtrado (o filtro pode ser de 60–90 dias atrás).
 *
 * Ordem:
 *  1. Última leitura do ThingsBoard, se tiver no máximo `maxAgeMinutes` (padrão 120).
 *  2. Senão, a última janela do histórico agregado do Ingestion (busca para trás: 1 dia em 15 min,
 *     depois 7 e 90 dias em 1 h).
 *  3. Senão, a última leitura do ThingsBoard mesmo que antiga.
 * Leituras fora da faixa válida (com offset) são ignoradas.
 */

import type { ClampRange, TemperatureTelemetry } from './utils';

export const DEFAULT_CURRENT_TEMPERATURE_MAX_AGE_MINUTES = 120;

export type CurrentTemperatureSource = 'thingsboard' | 'ingestion' | 'card';

export interface LatestTemperatureReading {
  /** Momento da leitura (Ingestion: fim da janela agregada, limitado a `now`) */
  ts: number;
  /** °C bruto (sem offset) */
  value: number;
}

export interface ResolvedCurrentTemperature extends LatestTemperatureReading {
  source: CurrentTemperatureSource;
  ageMinutes: number;
  /** true quando a leitura tem no máximo `maxAgeMinutes` */
  fresh: boolean;
}

/** Busca agregada (janelas de `intervalMinutes`): pontos { ts: início da janela, value: média } */
export type TemperatureAggregateFetcher = (
  startTs: number,
  endTs: number,
  intervalMinutes: number
) => Promise<TemperatureTelemetry[]>;

export interface ResolveCurrentTemperatureOptions {
  maxAgeMinutes?: number;
  now?: number;
  fetchThingsboardLatest?: () => Promise<LatestTemperatureReading | null>;
  fetchIngestionLatest?: () => Promise<LatestTemperatureReading | null>;
  /** Valida o valor bruto (ex.: faixa válida com offset). Inválido = ignorado. */
  isValid?: (value: number) => boolean;
}

async function safe(fn?: () => Promise<LatestTemperatureReading | null>): Promise<LatestTemperatureReading | null> {
  if (!fn) return null;
  try {
    const r = await fn();
    return r && Number.isFinite(r.ts) && Number.isFinite(r.value) ? r : null;
  } catch (err) {
    console.warn('[TemperatureModal] Falha ao buscar a última leitura:', (err as Error)?.message || err);
    return null;
  }
}

export async function resolveCurrentTemperature(
  opts: ResolveCurrentTemperatureOptions
): Promise<ResolvedCurrentTemperature | null> {
  const now = opts.now ?? Date.now();
  const maxAge = opts.maxAgeMinutes ?? DEFAULT_CURRENT_TEMPERATURE_MAX_AGE_MINUTES;
  const ok = (r: LatestTemperatureReading | null) => !!r && (!opts.isValid || opts.isValid(r.value));
  const wrap = (r: LatestTemperatureReading, source: CurrentTemperatureSource): ResolvedCurrentTemperature => {
    const ageMinutes = Math.max(0, (now - r.ts) / 60000);
    return { ...r, source, ageMinutes, fresh: ageMinutes <= maxAge };
  };

  const tb = await safe(opts.fetchThingsboardLatest);
  if (tb && ok(tb) && (now - tb.ts) / 60000 <= maxAge) return wrap(tb, 'thingsboard');

  const ing = await safe(opts.fetchIngestionLatest);
  if (ing && ok(ing)) return wrap(ing, 'ingestion');

  if (tb && ok(tb)) return wrap(tb, 'thingsboard');
  return null;
}

/** Última leitura de `temperature` no ThingsBoard (sem intervalo = valor mais recente) */
export async function fetchThingsboardLatestTemperature(
  token: string,
  deviceId: string
): Promise<LatestTemperatureReading | null> {
  const res = await fetch(`/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=temperature`, {
    headers: { 'X-Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`ThingsBoard ${res.status}`);
  const json = await res.json();
  const p = json?.temperature?.[0];
  if (!p) return null;
  const value = Number(p.value);
  const ts = Number(p.ts);
  return Number.isFinite(value) && Number.isFinite(ts) ? { ts, value } : null;
}

/** Janelas de busca para trás no agregado do Ingestion (curta e fina primeiro) */
export const INGESTION_LATEST_WINDOWS: { days: number; intervalMinutes: number }[] = [
  { days: 1, intervalMinutes: 15 },
  { days: 7, intervalMinutes: 60 },
  { days: 90, intervalMinutes: 60 },
];

/**
 * Última janela com leitura no agregado do Ingestion, independente do período da modal.
 * Para na primeira janela de busca que tiver dados.
 */
export async function fetchIngestionLatestTemperature(
  aggregateFetcher: TemperatureAggregateFetcher,
  now: number = Date.now(),
  windows = INGESTION_LATEST_WINDOWS,
  isValid?: (value: number) => boolean
): Promise<LatestTemperatureReading | null> {
  for (const w of windows) {
    const points = await aggregateFetcher(now - w.days * 24 * 60 * 60 * 1000, now, w.intervalMinutes);
    const valid = (points || [])
      .map((p) => ({ ts: Number(p.ts), value: Number(p.value) }))
      .filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.value) && (!isValid || isValid(p.value)));
    if (valid.length) {
      const last = valid.reduce((a, b) => (b.ts > a.ts ? b : a));
      return { ts: Math.min(now, last.ts + w.intervalMinutes * 60 * 1000), value: last.value };
    }
  }
  return null;
}

/** Valida valor bruto + offset contra a faixa (mesmo critério do discardInvalid da modal) */
export function makeTemperatureValidator(clampRange: ClampRange, offset: number): (value: number) => boolean {
  const off = Number(offset) || 0;
  return (value: number) => {
    const v = Number(value) + off;
    return Number.isFinite(v) && v >= clampRange.min && v <= clampRange.max;
  };
}

/**
 * Fetcher do agregado do Ingestion (GET /temperature-readings/aggregate — tabela
 * aggregated_temperature_15min; resolução mínima 15 min, últimos ~30 min ainda não agregados).
 * `apiHost` é o DATA_API_HOST com /api/v1. Janela sem leitura não vem no array.
 */
export function createIngestionTemperatureAggregateFetcher(cfg: {
  apiHost: string;
  gatewayId: string;
  slaveId: number | string;
  timezone?: string;
  getToken?: () => Promise<string | null | undefined>;
  fetchImpl?: typeof fetch;
}): TemperatureAggregateFetcher {
  const tz = cfg.timezone || 'America/Sao_Paulo';
  const doFetch = cfg.fetchImpl || ((...a: Parameters<typeof fetch>) => fetch(...a));
  const base = String(cfg.apiHost || '').replace(/\/+$/, '');
  return async (startTs, endTs, intervalMinutes) => {
    const interval = intervalMinutes >= 60 && intervalMinutes % 60 === 0
      ? `${intervalMinutes / 60} hour`
      : `${Math.max(15, Math.round(intervalMinutes))} minutes`;
    const url = new URL(`${base}/temperature-readings/aggregate`);
    url.searchParams.set('gatewayId', String(cfg.gatewayId));
    url.searchParams.set('slaveId', String(cfg.slaveId));
    url.searchParams.set('startTs', new Date(startTs).toISOString());
    url.searchParams.set('endTs', new Date(endTs).toISOString());
    url.searchParams.set('interval', interval);
    url.searchParams.set('timezone', tz);
    let token: string | null | undefined = null;
    try {
      token = cfg.getToken ? await cfg.getToken() : null;
    } catch {
      token = null; // rota ainda aceita sem token
    }
    const res = await doFetch(url.toString(), token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    if (!res.ok) throw new Error(`Ingestion aggregate ${res.status}`);
    const rows = await res.json();
    return (Array.isArray(rows) ? rows : [])
      .map((r: { bucket?: string; avg_temperature?: number | string }) => ({
        ts: new Date(String(r.bucket)).getTime(),
        value: Number(r.avg_temperature),
      }))
      .filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.value))
      .sort((a, b) => a.ts - b.ts);
  };
}
