import { Energy } from '../types/domain/energy';
import { Water } from '../types/domain/water';
import { Temperature } from '../types/domain/temperature';
import type { DomainCode, DomainDescriptor, DomainMap } from '../types/domain';

/**
 * Canonical domain map — the single source for energy / water / temperature
 * presentation metadata, assembled from each domain's own descriptor + defaults
 * (see src/types/domain/). Consumers (ExportData, controllers, tooltips, …) should
 * derive labels/icons/units from here instead of redefining them.
 *
 * Loaded at runtime by standalone widgets via `window.MyIOLibrary.exportMapDomain()`.
 */
export const DOMAIN_MAP: DomainMap = {
  energy: Energy,
  water: Water,
  temperature: Temperature,
};

/** Returns the canonical domain map. */
export function exportMapDomain(): DomainMap {
  return DOMAIN_MAP;
}

/** Returns a single domain descriptor (or undefined for an unknown code). */
export function getDomainDescriptor(code: DomainCode): DomainDescriptor | undefined {
  return DOMAIN_MAP[code];
}

// Re-export the domain types + values as the public surface.
export { Energy, Water, Temperature, DOMAIN_CODES } from '../types/domain';
export type {
  DomainCode,
  DomainDescriptor,
  DomainMap,
  EnergyType,
  WaterType,
  TemperatureType,
} from '../types/domain';
