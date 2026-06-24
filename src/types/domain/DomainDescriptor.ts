/**
 * Base domain descriptor — the shared contract for every core MYIO domain.
 *
 * Presentation/metadata ONLY. Widget data-binding (valueField, timestampField,
 * eventReady, cacheKey, format functions, …) deliberately lives in the consuming
 * component's own config, NOT here — keeps this descriptor lean and reusable.
 *
 * Each domain (energy/water/temperature) provides a narrowed type + a value
 * (with its defaults) by extending this — see ./energy, ./water, ./temperature.
 */

/** Stable domain codes (the "enum" values). */
export const DOMAIN_CODES = ['energy', 'water', 'temperature'] as const;

/** A core domain code. */
export type DomainCode = (typeof DOMAIN_CODES)[number];

export interface DomainDescriptor {
  /** Stable key — the enum value (e.g. 'energy'). */
  code: DomainCode;
  /** Display name, PT-BR (e.g. 'Energia'). */
  name: string;
  /** Display name, EN (e.g. 'Energy'). */
  nameEn?: string;
  /** Short uppercase abbreviation (e.g. 'EN' | 'AG' | 'TMP'). */
  sigla: string;
  /** Display emoji icon (e.g. '⚡'). */
  icon: string;
  /** Token for the deviceIcons / SVG icon system (e.g. 'energy'). */
  iconToken?: string;
  /** Measurement unit symbol (e.g. 'kWh' | 'm³' | '°C'). */
  unit: string;
  /** Instantaneous unit symbol (e.g. 'kW' | 'L'). */
  unitInstant?: string;
  /** Large-scale unit symbol (e.g. 'MWh' | 'dam³'). */
  unitLarge?: string;
  /** Value at/above which `unitLarge` should be used. */
  largeUnitThreshold?: number;
  /** Default decimal places for display. */
  decimalPlaces?: number;
  /** Default chart type for the domain. */
  chartType?: 'bar' | 'line';
  /** Theme accent color (CSS color), optional. */
  color?: string;
  /** Display order (energy < water < temperature). */
  order?: number;

  // --- Engine binding (lets a generic controller stay domain-agnostic) ---
  /** Raw telemetry data-key holding this domain's primary value (e.g. 'consumption'). */
  valueField?: string;
  /** CustomEvent name carrying this domain's summary (e.g. 'myio:energy-summary-ready'). */
  summaryEvent?: string;
}

/** Map of every core domain to its descriptor. */
export type DomainMap = Record<DomainCode, DomainDescriptor>;
