/**
 * RFC-0238 — filter chips from the dynamic device taxonomy (GCDR → active classification
 * profile, RFC-0207). Only the categories present in the device list become chips, with counts,
 * in the taxonomy order. The classifier is injected so this stays pure and testable.
 */
import type { DemandDevice } from './types';

export interface TaxonomyNodeInfo {
  label: string;
  icon?: string;
  order: number;
}

export interface TaxonomyClassifier {
  /** Category key of a device, or null to hide it (e.g. the `ocultos` group). */
  classify(device: Pick<DemandDevice, 'deviceProfile' | 'identifier'>): string | null;
  /** Display info of a key (label, icon, order); unknown keys are humanized. */
  describe(key: string): TaxonomyNodeInfo | undefined;
}

export interface TaxonomyChip {
  key: string;
  label: string;
  icon?: string;
  count: number;
}

export function humanizeKey(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : key;
}

/** Assigns each device its category key (null = hidden) and builds the chips in taxonomy order. */
export function buildTaxonomyChips(
  devices: DemandDevice[],
  classifier: TaxonomyClassifier
): { chips: TaxonomyChip[]; categoryOf: Map<string, string | null> } {
  const categoryOf = new Map<string, string | null>();
  const counts = new Map<string, number>();
  for (const d of devices) {
    const key = classifier.classify(d);
    categoryOf.set(d.tbDeviceId, key);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  const chips = [...counts.entries()]
    .map(([key, count]) => {
      const info = classifier.describe(key);
      return { key, count, label: info?.label || humanizeKey(key), icon: info?.icon, order: info?.order ?? 999 };
    })
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pt-BR'))
    .map(({ order: _order, ...chip }) => chip);
  return { chips, categoryOf };
}
