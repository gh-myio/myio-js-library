/**
 * RFC-0239 — default catalog, legacy enablement defaults and item-state resolution.
 */
import type {
  ReportDomain,
  ReportItemKey,
  ReportItemState,
  ReportsCatalog,
  ReportsCatalogItem,
} from './types';

const REPORT_DOMAINS: readonly ReportDomain[] = ['energy', 'water', 'temperature', 'alarms'];

/** Same items, order, icons and colours as the v-5.2.0 MENU picker (RFC-0181/0182/0238). */
export const DEFAULT_REPORTS_CATALOG: ReportsCatalog = [
  {
    id: 'energy',
    label: '⚡ Energia',
    items: [
      { id: 'entrada', label: 'Entrada', icon: '📥', tint: { bg: '#fff8e1', fg: '#f57f17' }, description: 'Medidores de entrada', kind: 'group-report' },
      { id: 'area_comum', label: 'Área Comum', icon: '🏢', tint: { bg: '#f3e5f5', fg: '#6a1b9a' }, description: 'Consumo de áreas comuns', kind: 'group-report' },
      { id: 'lojas', label: 'Lojas', icon: '🏬', tint: { bg: '#e8f5e9', fg: '#2e7d32' }, description: 'Consumo por loja', kind: 'group-report' },
      { id: 'todos', label: 'Todos Dispositivos', icon: '📋', tint: { bg: '#e3f2fd', fg: '#1565c0' }, description: 'Todos os medidores', kind: 'group-report' },
      { id: 'demand_telemetry', label: 'Demandas e Telemetrias', icon: '⚡', tint: { bg: '#ede7f6', fg: '#3e1a7d' }, description: 'Vários medidores · período · telemetrias', kind: 'demand-panel' },
    ],
  },
  {
    id: 'water',
    label: '💧 Água',
    items: [
      { id: 'entrada', label: 'Entrada', icon: '📥', tint: { bg: '#fff8e1', fg: '#f57f17' }, description: 'Medidores de entrada', kind: 'group-report' },
      { id: 'area_comum', label: 'Área Comum', icon: '🏢', tint: { bg: '#f3e5f5', fg: '#6a1b9a' }, description: 'Consumo de áreas comuns', kind: 'group-report' },
      { id: 'lojas', label: 'Lojas', icon: '🏬', tint: { bg: '#e0f2f1', fg: '#00695c' }, description: 'Consumo por loja', kind: 'group-report' },
      { id: 'todos', label: 'Todos Dispositivos', icon: '📋', tint: { bg: '#e3f2fd', fg: '#1565c0' }, description: 'Todos os hidrômetros', kind: 'group-report' },
    ],
  },
  {
    id: 'temperature',
    label: '🌡️ Temperatura',
    items: [
      { id: 'climatizavel', label: 'Ambientes Climatizáveis', icon: '❄️', tint: { bg: '#e1f5fe', fg: '#0277bd' }, description: 'Ambientes com termostato', kind: 'group-report' },
      { id: 'nao_climatizavel', label: 'Ambientes Não Climatizáveis', icon: '🌤️', tint: { bg: '#fff3e0', fg: '#e65100' }, description: 'Ambientes sem climatização', kind: 'group-report' },
      { id: 'todos', label: 'Todos Ambientes', icon: '📋', tint: { bg: '#e3f2fd', fg: '#1565c0' }, description: 'Todos os termostatos', kind: 'group-report' },
    ],
  },
  {
    id: 'alarms',
    label: '🔔 Alarmes',
    items: [
      { id: 'por_dispositivo', label: 'Por Dispositivo', icon: '📟', tint: { bg: '#fce4ec', fg: '#880e4f' }, description: 'Alarmes por dispositivo', kind: 'alarm-report' },
      { id: 'dispositivo_x_alarme', label: 'Por Dispositivo × Tipo', icon: '🔀', tint: { bg: '#fff3e0', fg: '#bf360c' }, description: 'Cruzamento dispositivo × regra', kind: 'alarm-report' },
      { id: 'por_tipo', label: 'Por Tipo de Alarme', icon: '🏷️', tint: { bg: '#ede7f6', fg: '#4527a0' }, description: 'Alarmes agrupados por tipo', kind: 'alarm-report' },
    ],
  },
];

/** The 15 legacy settings keys and their defaults (MAIN_VIEW REPORT_ITEM_DEFAULTS / MENU ei()). */
export const DEFAULT_ENABLED_REPORT_ITEMS: Readonly<Record<ReportItemKey, boolean>> = Object.freeze({
  energy_lojas: true,
  energy_entrada: false,
  energy_area_comum: false,
  energy_todos: false,
  energy_demand_telemetry: false,
  water_lojas: false,
  water_entrada: false,
  water_area_comum: false,
  water_todos: false,
  temperature_climatizavel: false,
  temperature_nao_climatizavel: false,
  temperature_todos: false,
  alarms_por_dispositivo: false,
  alarms_dispositivo_x_alarme: false,
  alarms_por_tipo: false,
});

export const itemKey = (domain: ReportDomain, itemId: string): ReportItemKey => `${domain}_${itemId}`;

/**
 * Drops unknown domains, duplicate domains and duplicate item ids within a domain (first
 * occurrence kept). Order is preserved. `onDrop` receives a short description of each drop.
 */
export function validateCatalog(catalog: ReportsCatalog, onDrop?: (what: string) => void): ReportsCatalog {
  const seenDomains = new Set<string>();
  const out: ReportsCatalog = [];
  for (const d of catalog || []) {
    if (!d || !REPORT_DOMAINS.includes(d.id)) {
      onDrop?.(`unknown domain "${String(d?.id)}"`);
      continue;
    }
    if (seenDomains.has(d.id)) {
      onDrop?.(`duplicate domain "${d.id}"`);
      continue;
    }
    seenDomains.add(d.id);
    const seenItems = new Set<string>();
    const items: ReportsCatalogItem[] = [];
    for (const it of d.items || []) {
      if (!it || typeof it.id !== 'string' || !it.id) {
        onDrop?.(`item without id in "${d.id}"`);
        continue;
      }
      if (seenItems.has(it.id)) {
        onDrop?.(`duplicate item "${d.id}_${it.id}"`);
        continue;
      }
      seenItems.add(it.id);
      items.push(it);
    }
    out.push({ ...d, items });
  }
  return out;
}

/**
 * State of every catalog item: availability first (hidden), then enablement. Only boolean
 * flags count; anything else falls to the legacy default, else false (custom items locked).
 */
export function resolveReportItemStates(
  catalog: ReportsCatalog,
  raw: Record<string, unknown> | null | undefined,
  available: (domain: ReportDomain, item: ReportsCatalogItem) => boolean,
): Map<ReportItemKey, ReportItemState> {
  const flags = raw && typeof raw === 'object' ? raw : {};
  const out = new Map<ReportItemKey, ReportItemState>();
  for (const d of catalog) {
    for (const it of d.items) {
      const key = itemKey(d.id, it.id);
      if (!available(d.id, it)) {
        out.set(key, 'hidden');
        continue;
      }
      const v = (flags as Record<string, unknown>)[key];
      const enabled = typeof v === 'boolean' ? v : (DEFAULT_ENABLED_REPORT_ITEMS[key] ?? false);
      out.set(key, enabled ? 'enabled' : 'locked');
    }
  }
  return out;
}

/**
 * Initial tab: `initialDomain` when visible; else first domain (catalog order) with an enabled
 * item; else first visible domain; else null (empty state).
 */
export function resolveInitialDomain(
  catalog: ReportsCatalog,
  states: Map<ReportItemKey, ReportItemState>,
  initialDomain?: ReportDomain,
): ReportDomain | null {
  const has = (d: ReportDomain, want: (s: ReportItemState | undefined) => boolean) =>
    (catalog.find((c) => c.id === d)?.items || []).some((it) => want(states.get(itemKey(d, it.id))));
  const visible = (s?: ReportItemState) => s === 'enabled' || s === 'locked';
  if (initialDomain && has(initialDomain, visible)) return initialDomain;
  const enabled = catalog.find((d) => has(d.id, (s) => s === 'enabled'));
  if (enabled) return enabled.id;
  const firstVisible = catalog.find((d) => has(d.id, visible));
  return firstVisible ? firstVisible.id : null;
}
