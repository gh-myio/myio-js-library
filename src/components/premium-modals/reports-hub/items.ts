/**
 * RFC-0239 — device → StoreItem mapping for openDashboardPopupAllReport (moved from the
 * v-5.2.0 MENU `_buildItemsList`; `||` fallbacks kept on purpose — P-7).
 */
import type { GroupReportDomain, ReportsHubDevice, StoreItem } from './types';

/** C-2: `areacomum` (the key the orchestrator really returns) is labelled too. */
export const GROUP_LABELS: Readonly<Record<string, string>> = {
  lojas: 'Lojas',
  entrada: 'Entrada',
  area_comum: 'Área Comum',
  areacomum: 'Área Comum',
  banheiros: 'Banheiros',
  setores: 'Setores',
  hidrometros: 'Hidrômetros',
  equipments: 'Equipamentos',
  motor: 'Motores',
  bomba: 'Bombas',
  caixadagua: 'Reservatórios',
  solenoide: 'Válvulas solenoides',
  climatizavel: 'Climatizável',
  nao_climatizavel: 'Não Climatizável',
};

function toItem(d: ReportsHubDevice, domain: GroupReportDomain, groupLabel: string | null): StoreItem {
  return {
    id: d.ingestionId || d.id || '',
    identifier: d.identifier || d.label || d.name || '',
    label: d.label || d.name || d.identifier || '',
    ...(groupLabel ? { groupLabel } : {}),
    // RFC-0128: the report drops devices the dashboard KPIs already exclude
    excludeGroupsTotals: d.excludeGroupsTotals || null,
    // Temperature: sensor offset added to every reading by the report
    ...(domain === 'temperature' ? { temperatureOffset: Number(d.offSetTemperature) || 0 } : {}),
  };
}

/**
 * Builds the `itemsList` of one group. `todos` merges every group except `ocultos`, each item
 * with its group label; `area_comum` reads the `areacomum` key. Always returns an array.
 */
export function buildReportItemsList(
  groups: Record<string, ReportsHubDevice[]> | null | undefined,
  domain: GroupReportDomain,
  group: string,
): StoreItem[] {
  const g = groups || {};
  if (group === 'todos') {
    return Object.entries(g)
      .filter(([key]) => key !== 'ocultos')
      .flatMap(([key, items]) => (items || []).map((d) => toItem(d, domain, GROUP_LABELS[key] || key)));
  }
  const groupKey = group === 'area_comum' ? 'areacomum' : group;
  return (g[groupKey] || []).map((d) => toItem(d, domain, null));
}
