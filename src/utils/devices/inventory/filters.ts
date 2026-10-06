/**
 * RFC-0237 §4 — rows, filters, facet counts and the visible-rows order shared by
 * the list and the exports.
 */

import { getDeviceCategory } from '../deviceTypeConfig';
import { buildRuleContext, evaluateDevice, isRecognizedProfile } from './rules';
import type { BuildRuleContextOptions, RuleContext } from './rules';
import type { AtividadeLevel, CadastroLevel, InventoryDevice, InventoryRow, LifecycleStatus } from './types';
import { DOMAIN_LABELS } from './labels';

export const NO_CUSTOMER_KEY = '__no_customer__';
export const UNCLASSIFIED_PROFILE_LABEL = 'Não classificado';

/** Builds the list rows (evaluation + domain + labels) for a loaded device set. */
export function buildInventoryRows(
  devices: readonly InventoryDevice[],
  options: BuildRuleContextOptions | { context: RuleContext }
): InventoryRow[] {
  const ctx = 'context' in options ? options.context : buildRuleContext(devices, options);
  return devices.map((device) => {
    const recognized = isRecognizedProfile(device.deviceProfile);
    return {
      device,
      evaluation: evaluateDevice(device, ctx),
      domain: recognized ? getDeviceCategory(device.deviceProfile) : 'unclassified',
      profileLabel: recognized ? (device.deviceProfile as string).toUpperCase() : UNCLASSIFIED_PROFILE_LABEL,
      customerKey: device.ownerType === 'TENANT' || !device.ownerName ? NO_CUSTOMER_KEY : device.ownerName,
    };
  });
}

export type CadastroFilterValue = Exclude<CadastroLevel, 'excluded'>;
export type AtividadeFilterValue = Exclude<AtividadeLevel, 'excluded'>;

export interface InventoryFilters {
  customers: Set<string>;
  domains: Set<string>;
  profiles: Set<string>;
  cadastro: Set<CadastroFilterValue>;
  atividade: Set<AtividadeFilterValue>;
  /** A row matches when it FAILS any of the selected rules. */
  rules: Set<string>;
  lifecycle: Set<LifecycleStatus>;
  text: string;
}

export type FilterDimension = Exclude<keyof InventoryFilters, 'text'>;

export const FILTER_DIMENSIONS: readonly FilterDimension[] = [
  'customers',
  'domains',
  'profiles',
  'cadastro',
  'atividade',
  'rules',
  'lifecycle',
];

/** Empty filters: no constraint, except lifecycle which defaults to `active`. */
export function createEmptyFilters(): InventoryFilters {
  return {
    customers: new Set(),
    domains: new Set(),
    profiles: new Set(),
    cadastro: new Set(),
    atividade: new Set(),
    rules: new Set(),
    lifecycle: new Set<LifecycleStatus>(['active']),
    text: '',
  };
}

/** Accent- and case-insensitive form used by the search. */
export function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** The values a row has for a dimension (several for `rules`). */
export function dimensionValues(row: InventoryRow, dimension: FilterDimension): string[] {
  switch (dimension) {
    case 'customers':
      return [row.customerKey];
    case 'domains':
      return [row.domain];
    case 'profiles':
      return [row.profileLabel];
    case 'cadastro':
      return row.evaluation.cadastro.level === 'excluded' ? [] : [row.evaluation.cadastro.level];
    case 'atividade':
      return row.evaluation.atividade.level === 'excluded' ? [] : [row.evaluation.atividade.level];
    case 'rules':
      return row.evaluation.failed;
    case 'lifecycle':
      return [row.evaluation.lifecycle.status];
  }
}

function matchesText(row: InventoryRow, needle: string): boolean {
  if (!needle) return true;
  const d = row.device;
  return [d.label, d.name, d.identifier, row.profileLabel, d.deviceProfile, d.ownerName, d.ingestionId].some((v) =>
    normalizeText(v).includes(needle)
  );
}

/** AND across dimensions, OR within one; `except` skips one dimension (facet counts). */
export function matchesFilters(row: InventoryRow, filters: InventoryFilters, except?: FilterDimension): boolean {
  for (const dimension of FILTER_DIMENSIONS) {
    if (dimension === except) continue;
    const selected = filters[dimension] as Set<string>;
    if (selected.size === 0) continue;
    if (!dimensionValues(row, dimension).some((v) => selected.has(v))) return false;
  }
  return matchesText(row, normalizeText(filters.text));
}

export function applyFilters(rows: readonly InventoryRow[], filters: InventoryFilters): InventoryRow[] {
  return rows.filter((row) => matchesFilters(row, filters));
}

/**
 * Facet count of each option of `dimension`: rows matching every OTHER dimension
 * (and the text) that carry that option. With selections already made in
 * `dimension`, a count is what the option contributes — not the total after the click.
 */
export function facetCounts(
  rows: readonly InventoryRow[],
  filters: InventoryFilters,
  dimension: FilterDimension
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!matchesFilters(row, filters, dimension)) continue;
    for (const value of dimensionValues(row, dimension)) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

export type InventorySort = 'gravity' | 'label' | 'customer' | 'lastActivity';
export type InventoryGroupBy = 'customer' | 'domain' | 'profile' | 'none';

const CADASTRO_ORDER: Record<CadastroLevel, number> = { critical: 0, pending: 1, partial: 2, ok: 3, excluded: 4 };
const ATIVIDADE_ORDER: Record<AtividadeLevel, number> = { inactive: 0, nodata: 1, ok: 2, excluded: 3 };

/** Text shown first in a row: the label, or the name when the label is blank. */
export function displayName(row: InventoryRow): string {
  return row.device.label || row.device.name;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true });
}

export function compareRows(a: InventoryRow, b: InventoryRow, sort: InventorySort): number {
  switch (sort) {
    case 'gravity': {
      const c = CADASTRO_ORDER[a.evaluation.cadastro.level] - CADASTRO_ORDER[b.evaluation.cadastro.level];
      if (c) return c;
      const t = ATIVIDADE_ORDER[a.evaluation.atividade.level] - ATIVIDADE_ORDER[b.evaluation.atividade.level];
      if (t) return t;
      break;
    }
    case 'customer': {
      const c = compareText(a.device.ownerName || '', b.device.ownerName || '');
      if (c) return c;
      break;
    }
    case 'lastActivity': {
      // Oldest activity first; missing activity before everything else.
      const ta = a.device.lastActivityTime ?? -Infinity;
      const tb = b.device.lastActivityTime ?? -Infinity;
      if (ta !== tb) return ta < tb ? -1 : 1;
      break;
    }
    case 'label':
      break;
  }
  return compareText(displayName(a), displayName(b)) || compareText(a.device.name, b.device.name);
}

export function groupKey(row: InventoryRow, groupBy: InventoryGroupBy): string {
  switch (groupBy) {
    case 'customer':
      return row.customerKey;
    case 'domain':
      return row.domain;
    case 'profile':
      return row.profileLabel;
    case 'none':
      return '';
  }
}

export interface InventoryGroup {
  key: string;
  rows: InventoryRow[];
}

/**
 * Filtered rows grouped and sorted — the single order used by the list AND the
 * exports. Groups are alphabetical, with "no customer" pinned first.
 */
export function getVisibleGroups(
  rows: readonly InventoryRow[],
  filters: InventoryFilters,
  sort: InventorySort,
  groupBy: InventoryGroupBy
): InventoryGroup[] {
  const groups = new Map<string, InventoryRow[]>();
  for (const row of applyFilters(rows, filters)) {
    const key = groupKey(row, groupBy);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  // Groups sorted by the text the user sees (domain keys by their pt-BR label),
  // with "no customer" pinned first.
  const title = (key: string) => (groupBy === 'domain' ? DOMAIN_LABELS[key] || key : key);
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === NO_CUSTOMER_KEY) return -1;
    if (b === NO_CUSTOMER_KEY) return 1;
    return compareText(title(a), title(b));
  });
  return keys.map((key) => ({ key, rows: groups.get(key)!.sort((x, y) => compareRows(x, y, sort)) }));
}

/** Flat list of `getVisibleGroups` — includes collapsed groups and rows not rendered yet. */
export function getVisibleRows(
  rows: readonly InventoryRow[],
  filters: InventoryFilters,
  sort: InventorySort,
  groupBy: InventoryGroupBy
): InventoryRow[] {
  return getVisibleGroups(rows, filters, sort, groupBy).flatMap((g) => g.rows);
}
