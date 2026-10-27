/**
 * Planilha de importação de telemetria (energia / água) — contrato do runbook
 * data-ingestion `docs/runbooks/TELEMETRY-SHEET-IMPORT.md` §3:
 *   gateway_id, slave_id, device_name (opcional), date (YYYY-MM-DD), hour (HH:00),
 *   value_kwh | value_m3, value_reactive_kvarh (opcional, energia)
 *
 * Tudo aqui é puro (sem DOM/rede) exceto `parseSheetFile`, que lê o arquivo do usuário
 * (CSV nativo; xlsx via SheetJS carregado sob demanda).
 */

export type ImportDomain = 'energy' | 'water';

export interface ImportDevice {
  label: string;
  identifier?: string;
  centralId?: string | null;
  slaveId?: number | string | null;
}

export interface ImportRow {
  /** Linha na planilha (cabeçalho = 1) — usada para mapear erros do servidor */
  line: number;
  gateway_id: string;
  slave_id: number;
  date: string;
  hour: string;
  value_kwh?: number;
  value_m3?: number;
  value_reactive_kvarh?: number;
}

export interface SheetIssue {
  line: number;
  reason: string;
}

export interface RowsFromTableResult {
  rows: ImportRow[];
  errors: SheetIssue[];
  /** Linhas com o valor em branco — ignoradas (a hora não é alterada) */
  skippedEmpty: number;
}

export const VALUE_COLUMN: Record<ImportDomain, 'value_kwh' | 'value_m3'> = {
  energy: 'value_kwh',
  water: 'value_m3',
};

export const MAX_IMPORT_ROWS = 5000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Devices aptos (têm central + slave) e os que ficam de fora. */
export function splitImportableDevices(devices: ImportDevice[]): { ok: ImportDevice[]; missingKey: ImportDevice[] } {
  const ok: ImportDevice[] = [];
  const missingKey: ImportDevice[] = [];
  for (const d of devices || []) {
    const slave = Number(d?.slaveId);
    if (d?.centralId && UUID_RE.test(String(d.centralId)) && Number.isInteger(slave) && slave >= 1 && slave <= 247) ok.push(d);
    else missingKey.push(d);
  }
  return { ok, missingKey };
}

/** Datas YYYY-MM-DD de start..end (inclusive). */
function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  const cur = new Date(Date.UTC(y1, m1 - 1, d1));
  const last = Date.UTC(y2, m2 - 1, d2);
  while (cur.getTime() <= last && out.length < 400) {
    out.push(`${cur.getUTCFullYear()}-${pad2(cur.getUTCMonth() + 1)}-${pad2(cur.getUTCDate())}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** "Agora" em America/Sao_Paulo (UTC-03:00 fixo) como {date, hour}. */
function nowSaoPaulo(now: number): { date: string; hour: number } {
  const d = new Date(now - 3 * 3600 * 1000);
  return { date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`, hour: d.getUTCHours() };
}

/**
 * Modelo CSV (separador `;` + BOM — abre direto no Excel pt-BR): uma linha por
 * (device, dia, hora FECHADA) do período, valor em branco para o cliente preencher.
 */
export function buildTemplateCsv(
  domain: ImportDomain,
  devices: ImportDevice[],
  start: string,
  end: string,
  now: number = Date.now()
): { csv: string; rows: number } {
  const valueCol = VALUE_COLUMN[domain];
  const header = ['gateway_id', 'slave_id', 'device_name', 'date', 'hour', valueCol];
  if (domain === 'energy') header.push('value_reactive_kvarh');
  const today = nowSaoPaulo(now);
  const lines: string[] = [header.join(';')];
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const { ok } = splitImportableDevices(devices);
  for (const dev of ok) {
    for (const date of daysBetween(start, end)) {
      if (date > today.date) break;
      for (let h = 0; h < 24; h++) {
        if (date === today.date && h >= today.hour) break; // só horas fechadas
        const cols = [String(dev.centralId), String(Number(dev.slaveId)), esc(dev.label || ''), date, `${pad2(h)}:00`, ''];
        if (domain === 'energy') cols.push('');
        lines.push(cols.join(';'));
      }
    }
  }
  return { csv: '﻿' + lines.join('\r\n') + '\r\n', rows: lines.length - 1 };
}

/** CSV → matriz (detecta `;` ou `,`; respeita aspas). */
export function parseCsv(text: string): string[][] {
  const src = String(text || '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

/** Data → YYYY-MM-DD (aceita YYYY-MM-DD, DD/MM/YYYY e serial do Excel). */
export function normalizeDate(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${pad2(+m[2])}-${pad2(+m[1])}`;
  return null;
}

/** Hora → "HH:00" (aceita "7", "07", "07:00", "07:00:00" e fração de dia do Excel). Minutos ≠ 0 = inválida. */
export function normalizeHour(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1) {
    const mins = Math.round(v * 24 * 60);
    return mins % 60 === 0 ? `${pad2(mins / 60)}:00` : null;
  }
  const s = String(v ?? '').trim();
  const m = /^(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23 || Number(m[2] || 0) !== 0 || Number(m[3] || 0) !== 0) return null;
  return `${pad2(h)}:00`;
}

/** Número com `,` ou `.` decimal; `null` = vazio; `NaN` = inválido. */
export function parseDecimal(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const s = String(v ?? '').trim();
  if (!s) return null;
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  return /^-?\d+(\.\d+)?$/.test(norm) ? Number(norm) : NaN;
}

/** Matriz (com cabeçalho) → linhas da API + erros locais (tudo-ou-nada é do servidor). */
export function rowsFromTable(domain: ImportDomain, table: unknown[][]): RowsFromTableResult {
  const errors: SheetIssue[] = [];
  const rows: ImportRow[] = [];
  let skippedEmpty = 0;
  const valueCol = VALUE_COLUMN[domain];
  const header = (table[0] || []).map((h) => String(h ?? '').trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = { gw: col('gateway_id'), slave: col('slave_id'), date: col('date'), hour: col('hour'), value: col(valueCol), reactive: col('value_reactive_kvarh') };
  const missing = (['gateway_id', 'slave_id', 'date', 'hour', valueCol] as const).filter((c) => col(c) < 0);
  if (missing.length) {
    return { rows, errors: [{ line: 1, reason: `Coluna obrigatória ausente: ${missing.join(', ')}` }], skippedEmpty };
  }
  const seen = new Map<string, number>();
  for (let i = 1; i < table.length; i++) {
    const r = table[i] || [];
    const line = i + 1;
    if (r.every((c) => String(c ?? '').trim() === '')) continue; // linha vazia
    const gw = String(r[idx.gw] ?? '').trim();
    const slave = Number(String(r[idx.slave] ?? '').trim());
    const date = normalizeDate(r[idx.date]);
    const hour = normalizeHour(r[idx.hour]);
    const value = parseDecimal(r[idx.value]);
    if (value === null) {
      skippedEmpty++;
      continue;
    }
    const lineErrors: string[] = [];
    if (!UUID_RE.test(gw)) lineErrors.push('gateway_id inválido');
    if (!Number.isInteger(slave) || slave < 1 || slave > 247) lineErrors.push('slave_id deve ser inteiro de 1 a 247');
    if (!date) lineErrors.push('data inválida (use AAAA-MM-DD)');
    if (!hour) lineErrors.push('hora inválida (use HH:00)');
    if (Number.isNaN(value) || (value as number) < 0) lineErrors.push('valor deve ser número ≥ 0');
    let reactive: number | undefined;
    if (domain === 'energy' && idx.reactive >= 0) {
      const rv = parseDecimal(r[idx.reactive]);
      if (Number.isNaN(rv)) lineErrors.push('reativo inválido');
      else if (rv !== null) reactive = rv;
    }
    if (lineErrors.length) {
      errors.push({ line, reason: lineErrors.join('; ') });
      continue;
    }
    const key = `${gw.toLowerCase()}|${slave}|${date}|${hour}`;
    if (seen.has(key)) {
      errors.push({ line, reason: `linha duplicada (mesmo device/data/hora da linha ${seen.get(key)})` });
      continue;
    }
    seen.set(key, line);
    const row: ImportRow = { line, gateway_id: gw, slave_id: slave, date: date!, hour: hour!, [valueCol]: value as number };
    if (reactive !== undefined) row.value_reactive_kvarh = reactive;
    rows.push(row);
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    errors.push({ line: 1, reason: `Máximo de ${MAX_IMPORT_ROWS} linhas por importação (${rows.length} enviadas)` });
  }
  return { rows, errors, skippedEmpty };
}

const SHEETJS_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

async function loadSheetJs(): Promise<any> {
  const w = window as any;
  if (w.XLSX) return w.XLSX;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SHEETJS_URL;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Não foi possível carregar o leitor de Excel'));
    document.head.appendChild(s);
  });
  return w.XLSX;
}

/** FileReader (Blob.text/arrayBuffer não existem em todo ambiente, ex.: jsdom). */
function readFile(file: File, as: 'text' | 'buffer'): Promise<any> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('Não foi possível ler o arquivo'));
    if (as === 'text') fr.readAsText(file, 'utf-8');
    else fr.readAsArrayBuffer(file);
  });
}

/** Arquivo do usuário → matriz. CSV nativo; .xlsx/.xls via SheetJS (carregado sob demanda). */
export async function parseSheetFile(file: File): Promise<unknown[][]> {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) return parseCsv(await readFile(file, 'text'));
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await loadSheetJs();
    const wb = XLSX.read(await readFile(file, 'buffer'), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  }
  throw new Error('Formato não suportado — envie .xlsx ou .csv');
}
