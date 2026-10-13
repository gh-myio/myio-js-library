// RFC-0239 characterization fixture — verbatim copy of the v-5.2.0 MENU picker logic as of
// desenv cd73015e (src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js,
// `_buildItemsList` / `toItem` / `GROUP_LABELS` and the `ei(key, def)` catalog defaults).
// Do not edit: it is the reference the extracted code is compared against.

export const LEGACY_GROUP_LABELS = {
  lojas: 'Lojas',
  entrada: 'Entrada',
  area_comum: 'Área Comum',
  banheiros: 'Banheiros',
  climatizavel: 'Climatizável',
  nao_climatizavel: 'Não Climatizável',
};

export function legacyBuildItemsList(groups, domain, group) {
  const toItem = (d, groupLabel) => ({
    id: d.ingestionId || d.id || '',
    identifier: d.identifier || d.label || d.name || '',
    label: d.label || d.name || d.identifier || '',
    ...(groupLabel ? { groupLabel } : {}),
    excludeGroupsTotals: d.excludeGroupsTotals || null,
    ...(domain === 'temperature' ? { temperatureOffset: Number(d.offSetTemperature) || 0 } : {}),
  });

  if (group === 'todos') {
    return Object.entries(groups)
      .filter(([key]) => key !== 'ocultos')
      .flatMap(([key, items]) => (items || []).map((d) => toItem(d, LEGACY_GROUP_LABELS[key] || key)));
  }
  const groupKey = group === 'area_comum' ? 'areacomum' : group;
  return (groups[groupKey] || []).map((d) => toItem(d, null));
}

/** `ei(key, def)` as used by the MENU catalog: enabledItems[key] ?? def. */
export function legacyEnabled(enabledItems, key) {
  const defaults = { energy_lojas: true };
  return enabledItems[key] ?? (defaults[key] ?? false);
}

export const LEGACY_KEYS = [
  'energy_entrada', 'energy_area_comum', 'energy_lojas', 'energy_todos', 'energy_demand_telemetry',
  'water_entrada', 'water_area_comum', 'water_lojas', 'water_todos',
  'temperature_climatizavel', 'temperature_nao_climatizavel', 'temperature_todos',
  'alarms_por_dispositivo', 'alarms_dispositivo_x_alarme', 'alarms_por_tipo',
];
