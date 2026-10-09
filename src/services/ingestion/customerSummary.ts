/**
 * Ingestion — resumo de telemetria por cliente
 * `GET /telemetry/customers/{customerId}/summary` (release #106 do Ingestion, 2026-10-09).
 *
 * Uma chamada por tipo de leitura devolve todos os dispositivos do cliente com total do período,
 * última leitura medida, cobertura e (opcional) série por hora/dia. Substitui
 * `/{domain}/devices/totals` + as N chamadas por sensor da temperatura atual.
 *
 * Guia: GUIA-API-SUMMARY-BY-CUSTOMER.md (repo ingestion). Regras usadas aqui:
 * - paginação: página 1 com resumo; páginas 2…N com `includeSummary=0` e o MESMO período
 *   (`period.start`/`period.end` da página 1);
 * - `total: null` = sem dado no período (nunca 0 por falta de dado);
 * - `lastReadings[]` = última leitura MEDIDA (água: uma por canal);
 * - chamadas em sequência, não em rajada.
 */

export type SummaryReadingType = 'energy' | 'water' | 'temperature';

export interface SummaryLastReading {
  channel: number | null;
  ts: string;
  value: number;
  unit: string;
}

export interface SummarySeriesPoint {
  ts: string;
  value: number;
  min?: number;
  max?: number;
  partial?: boolean;
}

export interface SummaryDevice {
  id: string;
  name: string;
  slaveId?: number | null;
  gatewayId?: string | null;
  gatewayName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  assetId?: string | null;
  assetName?: string | null;
  profileId?: string | null;
  profileName?: string | null;
  total: number | null;
  lastReadings?: SummaryLastReading[];
  coverage?: { eligible: number; withData: number; pendingRefresh: number };
  series?: SummarySeriesPoint[];
}

export interface SummaryPeriod {
  start: string;
  end: string;
  asOf: string;
  timezone: string;
  granularity: '1h' | '1d';
  readingType: SummaryReadingType;
  unit: string;
  metric: 'sum' | 'average';
  lastReadingLookbackDays?: number;
}

export interface CustomerSummaryResult {
  customer: unknown;
  period: SummaryPeriod;
  summary: {
    devices: number;
    devicesWithoutData: number;
    total: number | null;
    byCustomer?: Array<{ customerId: string; customerName: string; devices: number; total: number | null }>;
  } | null;
  devices: SummaryDevice[];
}

export interface FetchCustomerSummaryOptions {
  /** Base da Data API, com `/api/v1` (mesmo valor de `getDataApiHost()` nos widgets). */
  dataApiHost: string;
  /** Token Bearer (API client com `telemetry.read`). */
  token: string;
  /** UUID do cliente no Ingestion (`CUSTOMER_ING_ID` / `ingestionCustomerId`). */
  customerId: string;
  readingType: SummaryReadingType;
  granularity?: '1h' | '1d';
  deep?: boolean;
  includeSeries?: boolean;
  /** ISO 8601 com fuso. As duas ou nenhuma (sem elas: mês atual até agora). */
  startTime?: string;
  endTime?: string;
  /** Dispositivos por página (1–200). */
  limit?: number;
  fetchImpl?: typeof fetch;
}

/** Erro HTTP da rota — `status` permite ao chamador tratar 401/403 (token) e cair no fallback. */
export class CustomerSummaryError extends Error {
  status: number;
  code: string | null;
  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = 'CustomerSummaryError';
    this.status = status;
    this.code = code;
  }
}

/** Percorre todas as páginas da rota `/summary` e devolve os dispositivos juntos. */
export async function fetchCustomerSummary(opts: FetchCustomerSummaryOptions): Promise<CustomerSummaryResult> {
  const doFetch = opts.fetchImpl || fetch;
  const base = String(opts.dataApiHost || '').replace(/\/+$/, '');
  const limit = Math.min(200, Math.max(1, Math.floor(opts.limit ?? 200)));

  const params: Record<string, string> = {
    readingType: opts.readingType,
    granularity: opts.granularity ?? '1d',
    deep: opts.deep === false ? '0' : '1',
    includeSeries: opts.includeSeries ? '1' : '0',
    limit: String(limit),
  };
  if (opts.startTime && opts.endTime) {
    params.startTime = opts.startTime;
    params.endTime = opts.endTime;
  }

  const get = async (extra: Record<string, string>) => {
    const url = `${base}/telemetry/customers/${encodeURIComponent(opts.customerId)}/summary?${new URLSearchParams({
      ...params,
      ...extra,
    }).toString()}`;
    const res = await doFetch(url, { headers: { Authorization: `Bearer ${opts.token}` } });
    if (!res.ok) {
      let code: string | null = null;
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        code = body?.code ?? null;
        if (body?.message) message = `HTTP ${res.status}: ${body.message}`;
      } catch {
        /* corpo não-JSON */
      }
      throw new CustomerSummaryError(res.status, message, code);
    }
    return res.json();
  };

  // Página 1 com o resumo; fixa o período efetivo para as demais.
  const first = await get({ page: '1' });
  const devices: SummaryDevice[] = Array.isArray(first?.devices) ? [...first.devices] : [];
  const total = Number(first?.pagination?.total ?? devices.length);
  const fixed = { startTime: first?.period?.start, endTime: first?.period?.end };

  for (let page = 2; devices.length < total; page++) {
    const next = await get({ ...fixed, includeSummary: '0', page: String(page) });
    const chunk: SummaryDevice[] = Array.isArray(next?.devices) ? next.devices : [];
    if (chunk.length === 0) break;
    devices.push(...chunk);
  }

  return {
    customer: first?.customer ?? null,
    period: first?.period,
    summary: first?.summary ?? null,
    devices,
  };
}

/** Horário (ms) da última leitura medida do dispositivo — água: o canal mais recente. */
export function summaryLastReadingTs(device: SummaryDevice): number | null {
  let best: number | null = null;
  for (const r of device?.lastReadings || []) {
    const ts = Date.parse(r?.ts);
    if (Number.isFinite(ts) && (best === null || ts > best)) best = ts;
  }
  return best;
}

/**
 * Converte um dispositivo do `/summary` no formato de linha do antigo `/devices/totals`, para os
 * widgets continuarem consumindo os mesmos campos (`total_value`, `lastTelemetryTs`, …).
 *
 * `lastTelemetryTs`: última leitura medida. Sem leitura na janela de busca (`lookbackFromIso`,
 * ex.: asOf − 30 dias), usa o início dessa janela — "nenhuma leitura desde então" — para o
 * dispositivo continuar offline como no `/devices/totals`, em vez de cair no horário do ThingsBoard.
 */
export function summaryDeviceToTotalsRow(device: SummaryDevice, lookbackFromIso: string | null = null) {
  const lastTs = summaryLastReadingTs(device);
  return {
    id: device.id,
    name: device.name,
    slaveId: device.slaveId ?? null,
    gatewayId: device.gatewayId ?? null,
    customerId: device.customerId ?? null,
    customerName: device.customerName ?? null,
    assetId: device.assetId ?? null,
    assetName: device.assetName ?? null,
    profileId: device.profileId ?? null,
    profileName: device.profileName ?? null,
    total_value: device.total ?? 0,
    hasData: device.total !== null && device.total !== undefined,
    lastTelemetryTs: lastTs !== null ? new Date(lastTs).toISOString() : lookbackFromIso,
    coverage: device.coverage ?? null,
  };
}

/** Início da janela de "última leitura" do período (asOf − lastReadingLookbackDays), em ISO. */
export function summaryLookbackFromIso(period: SummaryPeriod | null | undefined): string | null {
  const asOf = Date.parse(period?.asOf ?? '');
  const days = Number(period?.lastReadingLookbackDays ?? 30);
  if (!Number.isFinite(asOf) || !Number.isFinite(days)) return null;
  return new Date(asOf - days * 24 * 60 * 60 * 1000).toISOString();
}

export interface LatestHourlyTemperature {
  /** Média da hora, °C bruto (sem offset). */
  value: number;
  /** Início da hora (ms). */
  hourTs: number;
  /** Última leitura válida conhecida (ms). */
  lastTs: number;
}

/**
 * Temperatura atual a partir da série horária do `/summary` (`granularity=1h`, `includeSeries=1`):
 * a hora mais recente cuja média, já com o offset, está dentro da faixa válida. Horas fora da faixa
 * são descartadas (como nos relatórios). `lastTs` = a última leitura medida, quando ela é válida e
 * cai nessa hora ou depois; senão, o último bloco de 15 min daquela hora.
 */
export function latestHourlyTemperature(
  device: SummaryDevice,
  opts: { offset?: number; validRange?: { min: number; max: number } } = {}
): LatestHourlyTemperature | null {
  const off = Number(opts.offset || 0);
  const range = opts.validRange ?? { min: 15, max: 40 };

  let hourTs: number | null = null;
  let value: number | null = null;
  for (const p of device?.series || []) {
    const ts = Date.parse(p?.ts);
    const v = Number(p?.value);
    if (!Number.isFinite(ts) || !Number.isFinite(v)) continue;
    if (v + off < range.min || v + off > range.max) continue; // hora inválida
    if (hourTs === null || ts > hourTs) {
      hourTs = ts;
      value = v;
    }
  }
  if (hourTs === null || value === null) return null;

  let lastTs = hourTs + 45 * 60 * 1000; // último bloco de 15 min da hora
  const last = (device.lastReadings || [])[0];
  const lastReadingTs = last ? Date.parse(last.ts) : NaN;
  const lastValue = last ? Number(last.value) : NaN;
  if (
    Number.isFinite(lastReadingTs) &&
    Number.isFinite(lastValue) &&
    lastReadingTs >= hourTs &&
    lastValue + off >= range.min &&
    lastValue + off <= range.max
  ) {
    lastTs = lastReadingTs;
  }
  return { value, hourTs, lastTs };
}
