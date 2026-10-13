/**
 * RFC-0238 — telemetry catalogue: the same 14 keys/labels/units that EnergyModalView passes
 * to RealTimeTelemetryModal (ED-1251). Bump CATALOG_VERSION when keys or units change.
 */
import type { DemandResolution, EnvelopeTelemetry } from './types';

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
  /** Max period length (days) for this resolution — RFC-0075 §4.2.4 (GCDR enforces). */
  maxDays: number;
}

/**
 * Bucket sizes accepted by GCDR (RFC-0075 §4.5). Each row has avg / max / min / samples of every
 * key, so there is no aggregation choice. `1d` requires `start` at local midnight (L-9).
 */
export const RESOLUTIONS: readonly ResolutionDef[] = [
  { id: '1m', label: '1 min', ms: 60_000, maxDays: 1 },
  { id: '5m', label: '5 min', ms: 300_000, maxDays: 7 },
  { id: '15m', label: '15 min', ms: 900_000, maxDays: 31 },
  { id: '1h', label: '1 hora', ms: 3_600_000, maxDays: 92 },
  { id: '1d', label: '1 dia', ms: 86_400_000, maxDays: 92 },
];
export const DEFAULT_RESOLUTION: DemandResolution = '1h';

export const RESOLUTION_BY_ID: Readonly<Record<DemandResolution, ResolutionDef>> = Object.fromEntries(
  RESOLUTIONS.map((r) => [r.id, r])
) as Record<DemandResolution, ResolutionDef>;

/** Statistics present in every bucket of the files (RFC-0075 §3.3). */
export const BUCKET_STATS_LABEL = 'média, máximo, mínimo e nº de amostras';

/** Default label of the 15-min demand series (L-14) — `demandLabel` from config wins. */
export const DEFAULT_DEMAND_LABEL = 'Potência média em 15 min (demanda estimada)';

/**
 * UI anticipation only — GCDR enforces and `GET …/config` / `validate` give the real values
 * (L-13, never hard-coded as truth). Quotas are GCDR's defaults (user 10 · customer 30 · day 20).
 */
export const DEMAND_LIMITS = { devices: 50, telemetries: 15, points: 2_000_000, activeJobsPerUser: 10 } as const;

/** Picks catalogue entries in catalogue order. */
export function telemetriesInCatalogOrder(keys: Iterable<string>): EnvelopeTelemetry[] {
  const wanted = new Set(keys);
  return TELEMETRY_CATALOG.filter((t) => wanted.has(t.key)).map((t) => ({ ...t }));
}
