/**
 * RFC-0238 — telemetry catalogue: the same 14 keys/labels/units that EnergyModalView passes
 * to RealTimeTelemetryModal (ED-1251). Bump CATALOG_VERSION when keys or units change.
 */
import type { DemandAggregation, DemandResolution, EnvelopeTelemetry } from './types';

export const CATALOG_VERSION = 1;

export interface TelemetryGroup {
  id: 'power' | 'voltage' | 'current' | 'pf';
  label: string;
  icon: string;
  items: EnvelopeTelemetry[];
}

export const TELEMETRY_GROUPS: readonly TelemetryGroup[] = [
  {
    id: 'power',
    label: 'Potência',
    icon: '⚙️',
    items: [
      { key: 'consumption', label: 'Potência Total', unit: 'W' },
      { key: 'a', label: 'Potência Fase A', unit: 'W' },
      { key: 'b', label: 'Potência Fase B', unit: 'W' },
      { key: 'c', label: 'Potência Fase C', unit: 'W' },
    ],
  },
  {
    id: 'voltage',
    label: 'Tensão',
    icon: '⚡',
    items: [
      { key: 'voltage_a', label: 'Tensão Fase A', unit: 'V' },
      { key: 'voltage_b', label: 'Tensão Fase B', unit: 'V' },
      { key: 'voltage_c', label: 'Tensão Fase C', unit: 'V' },
    ],
  },
  {
    id: 'current',
    label: 'Corrente',
    icon: '🔌',
    items: [
      { key: 'current_a', label: 'Corrente Fase A', unit: 'A' },
      { key: 'current_b', label: 'Corrente Fase B', unit: 'A' },
      { key: 'current_c', label: 'Corrente Fase C', unit: 'A' },
      { key: 'total_current', label: 'Corrente Total', unit: 'A' },
    ],
  },
  {
    id: 'pf',
    label: 'Fator de potência',
    icon: '📐',
    items: [
      { key: 'fp_a', label: 'Fator de Potência A', unit: 'fp' },
      { key: 'fp_b', label: 'Fator de Potência B', unit: 'fp' },
      { key: 'fp_c', label: 'Fator de Potência C', unit: 'fp' },
    ],
  },
];

/** Flat catalogue in display order (the order telemetries are listed in every request). */
export const TELEMETRY_CATALOG: readonly EnvelopeTelemetry[] = TELEMETRY_GROUPS.flatMap((g) => g.items);

export interface ResolutionDef {
  id: DemandResolution;
  label: string;
  ms: number;
  /** Max period length (days) for this resolution — RFC-0238 §7. */
  maxDays: number;
}

/** Grouping intervals — same options as RealTimeTelemetryModal "Por período" (default 1 dia). */
export const RESOLUTIONS: readonly ResolutionDef[] = [
  { id: '15m', label: '15 min', ms: 900_000, maxDays: 31 },
  { id: '30m', label: '30 min', ms: 1_800_000, maxDays: 62 },
  { id: '1h', label: '1 hora', ms: 3_600_000, maxDays: 92 },
  { id: '2h', label: '2 horas', ms: 7_200_000, maxDays: 92 },
  { id: '4h', label: '4 horas', ms: 14_400_000, maxDays: 92 },
  { id: '12h', label: '12 horas', ms: 43_200_000, maxDays: 92 },
  { id: '1d', label: '1 dia (24 horas)', ms: 86_400_000, maxDays: 92 },
];
export const DEFAULT_RESOLUTION: DemandResolution = '1d';

/** Aggregations — same options and default (Máximo) as RealTimeTelemetryModal "Por período". */
export const AGGREGATIONS: ReadonlyArray<{ id: DemandAggregation; label: string }> = [
  { id: 'NONE', label: 'Bruto' },
  { id: 'AVG', label: 'Média' },
  { id: 'MAX', label: 'Máximo' },
  { id: 'MIN', label: 'Mínimo' },
  { id: 'SUM', label: 'Soma' },
];
export const DEFAULT_AGGREGATION: DemandAggregation = 'MAX';

/**
 * Bruto: max period length (days). There is NO raw point limit in this panel (owner's decision,
 * 2026-10-08) — Bruto returns every sample of the period; only the period is bounded.
 */
export const RAW_MAX_DAYS = 31;

export const RESOLUTION_BY_ID: Readonly<Record<DemandResolution, ResolutionDef>> = Object.fromEntries(
  RESOLUTIONS.map((r) => [r.id, r])
) as Record<DemandResolution, ResolutionDef>;

/** RFC-0238 §7 limits (validated in the UI; GCDR validates again). */
export const DEMAND_LIMITS = { devices: 50, points: 2_000_000, activeJobs: 3 } as const;

/** Picks catalogue entries in catalogue order. */
export function telemetriesInCatalogOrder(keys: Iterable<string>): EnvelopeTelemetry[] {
  const wanted = new Set(keys);
  return TELEMETRY_CATALOG.filter((t) => wanted.has(t.key)).map((t) => ({ ...t }));
}
