/**
 * RFC-0237 §5 — export matrix shared by XLSX, CSV and PDF.
 *
 * The rows come from `getVisibleRows()` (every device matching filters + search,
 * in list order). CSV is tabular only: UTF-8 BOM, `;` separator, no metadata rows,
 * and cells that a spreadsheet would read as a formula are prefixed with `'`.
 */

import { getInventoryRule } from './rules';
import type { InventoryFilters } from './filters';
import { NO_CUSTOMER_KEY } from './filters';
import type { AtividadeLevel, CadastroLevel, InventoryRow, LifecycleStatus } from './types';
import type { InventoryDashboard } from './dashboard';
import { ATIVIDADE_LABELS, CADASTRO_LABELS, DOMAIN_LABELS, LIFECYCLE_LABELS } from './labels';

export { ATIVIDADE_LABELS, CADASTRO_LABELS, DOMAIN_LABELS, LIFECYCLE_LABELS };

/** Date as `dd/mm/aaaa hh:mm` in America/Sao_Paulo, or empty. */
export function formatDateTime(ms: number | null): string {
  if (ms === null) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function cadastroText(row: InventoryRow): string {
  const { level, partial } = row.evaluation.cadastro;
  return CADASTRO_LABELS[level] + (partial ? ' · avaliação parcial' : '');
}

/** pt-BR labels of the failed rules, `; `-separated. */
export function failedRulesText(row: InventoryRow): string {
  return row.evaluation.failed.map((id) => getInventoryRule(id)?.label || id).join('; ');
}

export interface ExportColumn {
  key: string;
  header: string;
  value(row: InventoryRow): string;
}

const col = (key: string, header: string, value: (row: InventoryRow) => string | number | null | undefined): ExportColumn => ({
  key,
  header,
  value: (row) => {
    const v = value(row);
    return v === null || v === undefined ? '' : String(v);
  },
});

/** XLSX / CSV columns. */
export const INVENTORY_EXPORT_COLUMNS: readonly ExportColumn[] = [
  col('cadastro', 'Cadastro', cadastroText),
  col('atividade', 'Atividade', (r) => ATIVIDADE_LABELS[r.evaluation.atividade.level]),
  col('reasons', 'Regras com falha', failedRulesText),
  col('label', 'Label', (r) => r.device.label),
  col('name', 'Name', (r) => r.device.name),
  col('deviceId', 'deviceId', (r) => r.device.id),
  col('identifier', 'Identificador', (r) => r.device.identifier),
  col('profile', 'Perfil', (r) => r.profileLabel),
  col('domain', 'Domínio', (r) => DOMAIN_LABELS[r.domain] || r.domain),
  col('customer', 'Cliente', (r) => (r.customerKey === NO_CUSTOMER_KEY ? '' : r.device.ownerName)),
  col('customerId', 'customerId', (r) => r.device.customerId),
  col('lifecycle', 'Ciclo de vida', (r) => LIFECYCLE_LABELS[r.evaluation.lifecycle.status]),
  col('active', 'Ativo (TB)', (r) => (r.device.active === null ? '' : r.device.active ? 'Sim' : 'Não')),
  col('lastActivity', 'Última atividade', (r) => formatDateTime(r.device.lastActivityTime)),
  col('ingestionId', 'ingestionId', (r) => r.device.ingestionId),
  col('gcdrDeviceId', 'gcdrDeviceId', (r) => r.device.gcdrDeviceId),
  col('centralId', 'centralId', (r) => r.device.centralId),
  col('slaveId', 'slaveId', (r) => r.device.slaveId),
  col('created', 'Criado em', (r) => formatDateTime(r.device.createdTime)),
];

/** PDF columns — same devices, fewer columns. */
export const INVENTORY_PDF_COLUMN_KEYS = [
  'cadastro',
  'atividade',
  'label',
  'name',
  'profile',
  'customer',
  'reasons',
  'lastActivity',
] as const;

export function pickColumns(keys: readonly string[]): ExportColumn[] {
  return keys.map((k) => {
    const c = INVENTORY_EXPORT_COLUMNS.find((x) => x.key === k);
    if (!c) throw new Error(`Unknown inventory export column: ${k}`);
    return c;
  });
}

export interface ExportMatrix {
  header: string[];
  rows: string[][];
}

export function toExportMatrix(
  rows: readonly InventoryRow[],
  columns: readonly ExportColumn[] = INVENTORY_EXPORT_COLUMNS
): ExportMatrix {
  return {
    header: columns.map((c) => c.header),
    rows: rows.map((row) => columns.map((c) => c.value(row))),
  };
}

/** Prefixes `'` to cells a spreadsheet would interpret as a formula. */
export function guardFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  const safe = guardFormula(value);
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV for Excel pt-BR: UTF-8 BOM, `;`, CRLF, header + rows only. */
export function toCSV(matrix: ExportMatrix): string {
  const lines = [matrix.header, ...matrix.rows].map((cells) => cells.map(csvCell).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/**
 * Human-readable filter summary (PDF header and the XLSX "Filtros" sheet):
 * one `[label, value]` pair per active dimension, plus the search text.
 */
export function summarizeFilters(filters: InventoryFilters): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const list = (set: Set<string>, map?: (v: string) => string) => [...set].map((v) => (map ? map(v) : v)).join(', ');

  if (filters.customers.size) {
    out.push(['Cliente', list(filters.customers, (v) => (v === NO_CUSTOMER_KEY ? 'Sem cliente' : v))]);
  }
  if (filters.domains.size) out.push(['Domínio', list(filters.domains, (v) => DOMAIN_LABELS[v] || v)]);
  if (filters.profiles.size) out.push(['Perfil', list(filters.profiles)]);
  if (filters.cadastro.size) out.push(['Cadastro', list(filters.cadastro, (v) => CADASTRO_LABELS[v as CadastroLevel])]);
  if (filters.atividade.size) {
    out.push(['Atividade', list(filters.atividade, (v) => ATIVIDADE_LABELS[v as AtividadeLevel])]);
  }
  if (filters.rules.size) out.push(['Regra', list(filters.rules, (v) => getInventoryRule(v)?.label || v)]);
  if (filters.lifecycle.size) {
    out.push(['Ciclo de vida', list(filters.lifecycle, (v) => LIFECYCLE_LABELS[v as LifecycleStatus])]);
  }
  if (filters.text.trim()) out.push(['Busca', filters.text.trim()]);
  return out;
}

export interface ExportSummaryMeta {
  generatedAt: number;
  /** E-mail / name of the user who exported (empty when unknown). */
  generatedBy?: string | null;
  /** Rows in the file (= getVisibleRows length). */
  exported: number;
}

/**
 * XLSX "Filtros" sheet and PDF header: generation info, active filters ("Todos" when
 * none) and the indicator counts of the exported rows (`dashboard` must be built
 * from the same rows).
 */
export function buildExportSummary(
  filters: InventoryFilters,
  dashboard: InventoryDashboard,
  meta: ExportSummaryMeta
): Array<[string, string]> {
  const n = (v: number) => v.toLocaleString('pt-BR');
  const active = summarizeFilters(filters);
  return [
    ['Gerado em', formatDateTime(meta.generatedAt)],
    ['Gerado por', meta.generatedBy || ''],
    ['Dispositivos exportados', n(meta.exported)],
    ...(active.length ? active : [['Filtros', 'Nenhum (todos os dispositivos)'] as [string, string]]),
    ['Nos indicadores', n(dashboard.inIndicators)],
    [`Cadastro · ${CADASTRO_LABELS.critical}`, n(dashboard.cadastro.critical)],
    [`Cadastro · ${CADASTRO_LABELS.pending}`, n(dashboard.cadastro.pending)],
    [`Cadastro · ${CADASTRO_LABELS.ok}`, n(dashboard.cadastro.ok)],
    [`Cadastro · ${CADASTRO_LABELS.partial}`, n(dashboard.cadastro.partial)],
    [`Atividade · ${ATIVIDADE_LABELS.ok}`, n(dashboard.atividade.ok)],
    [`Atividade · ${ATIVIDADE_LABELS.inactive}`, n(dashboard.atividade.inactive)],
    [`Atividade · ${ATIVIDADE_LABELS.nodata}`, n(dashboard.atividade.nodata)],
    ['Fora dos indicadores (estoque / arquivados)', `${n(dashboard.excluded.stock)} / ${n(dashboard.excluded.archived)}`],
  ];
}

/** `inventario_<cliente|todos>_<AAAA-MM-DD_HHmm>.<ext>` (customer only when exactly one is filtered). */
export function exportFileName(filters: InventoryFilters, ext: string, now: Date): string {
  const only = filters.customers.size === 1 ? [...filters.customers][0] : null;
  const scope = !only ? 'todos' : only === NO_CUSTOMER_KEY ? 'sem-cliente' : only;
  const slug = normalizeSlug(scope);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `inventario_${slug}_${stamp}.${ext}`;
}

function normalizeSlug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'todos'
  );
}
