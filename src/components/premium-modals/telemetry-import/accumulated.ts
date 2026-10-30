/**
 * Modelo 2 da importação: "acumulado por período" (RFC-0240 §9). O cliente informa início, fim
 * e o total de cada device; aqui o total vira as mesmas linhas horárias do modelo hora a hora,
 * então a API (`/import/validate`) recebe um único formato.
 *
 * A soma das horas é EXATA: a conta é feita em milésimos inteiros e o resíduo do arredondamento
 * vai para as horas de maior resto. A curva por hora é ESTIMADA — só o total é real.
 *
 * Tudo aqui é puro (sem DOM/rede).
 */

import {
  daysBetween,
  normalizeDate,
  nowSaoPaulo,
  parseDecimal,
  VALUE_COLUMN,
  MAX_IMPORT_ROWS,
  isImportableKey,
  type ImportDevice,
  type ImportDomain,
  type ImportRow,
  type SheetIssue,
} from './sheet';

export type ImportModel = 'hourly' | 'accumulated';

export interface DistributionProfile {
  /** Primeira hora do funcionamento (inclusive), hora de São Paulo */
  openHour: number;
  /** Fim do funcionamento (exclusivo) */
  closeHour: number;
  /** Fração do total que cai no horário de funcionamento (0–1) */
  openShare: number;
}

/** Horário de shopping. Fixo por ora; parâmetro para virar configuração por customer depois. */
export const DEFAULT_DISTRIBUTION_PROFILE: DistributionProfile = { openHour: 10, closeHour: 22, openShare: 0.85 };

export const TOTAL_COLUMN: Record<ImportDomain, 'total_kwh' | 'total_m3'> = {
  energy: 'total_kwh',
  water: 'total_m3',
};

/** Prefixo do `sourceRef`: marca a importação como estimada. */
export const ACCUMULATED_SOURCE_PREFIX = 'acumulado';

const MAX_PERIOD_DAYS = 366;
const MILLI = 1000;
const pad2 = (n: number) => String(n).padStart(2, '0');

export interface AccumulatedEntry {
  /** Linha na planilha (ou posição no formulário) — usada nos erros */
  line: number;
  gateway_id: string;
  slave_id: number;
  device_name?: string;
  start: string;
  end: string;
  total: number;
}

export interface HourSlot {
  date: string;
  hour: number;
}

export interface EntriesFromTableResult {
  entries: AccumulatedEntry[];
  errors: SheetIssue[];
  /** Linhas com o total em branco — ignoradas */
  skippedEmpty: number;
}

export interface AccumulatedRowsResult {
  rows: ImportRow[];
  errors: SheetIssue[];
  devices: number;
  /** Soma exata dos totais gerados */
  total: number;
  zeroEntries: number;
}

/** Horas FECHADAS de start..end (inclusive), em hora de São Paulo. */
export function closedHoursInPeriod(start: string, end: string, now: number = Date.now()): HourSlot[] {
  const today = nowSaoPaulo(now);
  const out: HourSlot[] = [];
  for (const date of daysBetween(start, end)) {
    if (date > today.date) break;
    for (let hour = 0; hour < 24; hour++) {
      if (date === today.date && hour >= today.hour) break;
      out.push({ date, hour });
    }
  }
  return out;
}

const isOpen = (hour: number, p: DistributionProfile) => hour >= p.openHour && hour < p.closeHour;

/** Peso de cada hora: `openShare` no funcionamento, o resto fora; se só há um dos grupos, uniforme. */
function slotWeights(slots: HourSlot[], profile: DistributionProfile): number[] {
  const nOpen = slots.filter((s) => isOpen(s.hour, profile)).length;
  const nClosed = slots.length - nOpen;
  if (!nOpen || !nClosed) return slots.map(() => 1 / slots.length);
  return slots.map((s) => (isOpen(s.hour, profile) ? profile.openShare / nOpen : (1 - profile.openShare) / nClosed));
}

/**
 * Distribui `total` pelas horas. A soma do retorno é exatamente `total` (arredondado a 3 casas):
 * maior resto sobre milésimos inteiros.
 */
export function distributeTotal(
  total: number,
  slots: HourSlot[],
  profile: DistributionProfile = DEFAULT_DISTRIBUTION_PROFILE
): number[] {
  if (!slots.length) return [];
  const totalMilli = Math.round(total * MILLI);
  const exact = slotWeights(slots, profile).map((w) => w * totalMilli);
  const parts = exact.map((v) => Math.floor(v));
  const remainder = totalMilli - parts.reduce((a, b) => a + b, 0);
  exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
    .slice(0, remainder)
    .forEach(({ i }) => {
      parts[i] += 1;
    });
  return parts.map((p) => p / MILLI);
}

/** Linhas horárias de todas as entradas + erros (período, sobreposição, limite). */
export function accumulatedRows(
  domain: ImportDomain,
  entries: AccumulatedEntry[],
  profile: DistributionProfile = DEFAULT_DISTRIBUTION_PROFILE,
  now: number = Date.now()
): AccumulatedRowsResult {
  const valueCol = VALUE_COLUMN[domain];
  const today = nowSaoPaulo(now);
  const errors: SheetIssue[] = [];
  const rows: ImportRow[] = [];
  const accepted = new Map<string, AccumulatedEntry[]>();
  let totalMilli = 0;
  let zeroEntries = 0;

  for (const e of entries) {
    const who = e.device_name ? `${e.device_name}: ` : '';
    if (e.start > e.end) {
      errors.push({ line: e.line, reason: `${who}início depois do fim` });
      continue;
    }
    if (e.end > today.date) {
      errors.push({ line: e.line, reason: `${who}o período termina no futuro — o total precisa ser de um período já encerrado` });
      continue;
    }
    if (daysBetween(e.start, e.end).length > MAX_PERIOD_DAYS) {
      errors.push({ line: e.line, reason: `${who}período maior que ${MAX_PERIOD_DAYS} dias` });
      continue;
    }
    const key = `${e.gateway_id.toLowerCase()}|${e.slave_id}`;
    const clash = (accepted.get(key) || []).find((o) => e.start <= o.end && o.start <= e.end);
    if (clash) {
      errors.push({ line: e.line, reason: `${who}período sobreposto ao da linha ${clash.line}` });
      continue;
    }
    const slots = closedHoursInPeriod(e.start, e.end, now);
    if (!slots.length) {
      errors.push({ line: e.line, reason: `${who}período sem horas fechadas` });
      continue;
    }
    accepted.set(key, [...(accepted.get(key) || []), e]);
    if (e.total === 0) zeroEntries++;
    totalMilli += Math.round(e.total * MILLI);
    distributeTotal(e.total, slots, profile).forEach((value, i) => {
      rows.push({
        line: e.line,
        gateway_id: e.gateway_id,
        slave_id: e.slave_id,
        date: slots[i].date,
        hour: `${pad2(slots[i].hour)}:00`,
        [valueCol]: value,
      });
    });
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    errors.push({
      line: 1,
      reason: `Máximo de ${MAX_IMPORT_ROWS} horas por importação (${rows.length} geradas) — importe menos dispositivos ou um período menor`,
    });
  }
  return { rows, errors, devices: accepted.size, total: totalMilli / MILLI, zeroEntries };
}

/** Modelo CSV do acumulado: uma linha por device, com o período já preenchido. */
export function buildAccumulatedTemplateCsv(
  domain: ImportDomain,
  devices: ImportDevice[],
  start: string,
  end: string
): { csv: string; rows: number } {
  const lines = [['gateway_id', 'slave_id', 'device_name', 'start_date', 'end_date', TOTAL_COLUMN[domain]].join(';')];
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  for (const dev of devices || []) {
    if (!isImportableKey(dev)) continue;
    lines.push([String(dev.centralId), String(Number(dev.slaveId)), esc(dev.label || ''), start, end, ''].join(';'));
  }
  return { csv: '﻿' + lines.join('\r\n') + '\r\n', rows: lines.length - 1 };
}

/** Matriz da planilha do acumulado → entradas + erros por linha. */
export function entriesFromTable(domain: ImportDomain, table: unknown[][]): EntriesFromTableResult {
  const totalCol = TOTAL_COLUMN[domain];
  const header = (table[0] || []).map((h) => String(h ?? '').trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const required = ['gateway_id', 'slave_id', 'start_date', 'end_date', totalCol];
  const missing = required.filter((c) => col(c) < 0);
  if (missing.length) {
    return { entries: [], errors: [{ line: 1, reason: `Coluna obrigatória ausente: ${missing.join(', ')}` }], skippedEmpty: 0 };
  }
  const entries: AccumulatedEntry[] = [];
  const errors: SheetIssue[] = [];
  let skippedEmpty = 0;
  for (let i = 1; i < table.length; i++) {
    const r = table[i] || [];
    const line = i + 1;
    if (r.every((c) => String(c ?? '').trim() === '')) continue;
    const total = parseDecimal(r[col(totalCol)]);
    if (total === null) {
      skippedEmpty++;
      continue;
    }
    const gateway_id = String(r[col('gateway_id')] ?? '').trim();
    const slave_id = Number(String(r[col('slave_id')] ?? '').trim());
    const start = normalizeDate(r[col('start_date')]);
    const end = normalizeDate(r[col('end_date')]);
    const lineErrors: string[] = [];
    if (!isImportableKey({ label: '', centralId: gateway_id, slaveId: slave_id })) lineErrors.push('gateway_id ou slave_id inválido');
    if (!start) lineErrors.push('início inválido (use AAAA-MM-DD)');
    if (!end) lineErrors.push('fim inválido (use AAAA-MM-DD)');
    if (Number.isNaN(total) || total < 0) lineErrors.push('total deve ser número ≥ 0');
    if (lineErrors.length) {
      errors.push({ line, reason: lineErrors.join('; ') });
      continue;
    }
    const nameIdx = col('device_name');
    entries.push({
      line,
      gateway_id,
      slave_id,
      device_name: nameIdx >= 0 ? String(r[nameIdx] ?? '').trim() || undefined : undefined,
      start: start!,
      end: end!,
      total,
    });
  }
  return { entries, errors, skippedEmpty };
}

/** Fração do total por hora do dia (0–23) — curva da prévia. */
export function dayCurve(profile: DistributionProfile = DEFAULT_DISTRIBUTION_PROFILE): number[] {
  const slots = Array.from({ length: 24 }, (_, hour) => ({ date: '', hour }));
  return slotWeights(slots, profile);
}
