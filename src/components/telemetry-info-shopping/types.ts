/**
 * RFC-0148: TelemetryInfoShopping Component Types
 * Information panel with category breakdown and pie chart
 */

// ============================================
// DOMAIN TYPE
// ============================================

export type TelemetryDomain = 'energy' | 'water';

export type ThemeMode = 'dark' | 'light';

// ============================================
// CATEGORY TYPES
// ============================================

export type EnergyCategoryType =
  | 'entrada'
  | 'climatizacao'
  | 'elevadores'
  | 'escadasRolantes'
  | 'lojas'
  | 'outros'
  | 'areaComum'
  | 'erro';

export type WaterCategoryType =
  | 'entrada'
  | 'lojas'
  | 'banheiros'
  | 'areaComum'
  | 'pontosNaoMapeados';

export type CategoryType = EnergyCategoryType | WaterCategoryType;

/**
 * RFC-0196 — Group identifier dispatched on `myio:filter-applied`.
 *
 * Energy groups follow the canonical
 * `buildEquipmentCategorySummary` keys (with `escadas_rolantes` and
 * `area_comum` underscored) for cross-component compatibility. The
 * `erro` slice is a calculated residual; clicks on it dispatch the
 * filter event but the controller treats it as a no-op (no devices).
 *
 * Water groups mirror the existing component key set (camelCase).
 */
export type EnergyGroup =
  | 'entrada'
  | 'lojas'
  | 'climatizacao'
  | 'elevadores'
  | 'escadas_rolantes'
  | 'outros'
  | 'erro';

export type WaterGroup = 'entrada' | 'lojas' | 'banheiros' | 'areaComum';

export type FilterGroup = EnergyGroup | WaterGroup;

// ============================================
// CATEGORY DATA
// ============================================

export interface CategoryData {
  total: number;
  perc: number;
  deviceCount?: number;
}

export interface EnergyState {
  entrada: CategoryData;
  consumidores: {
    climatizacao: CategoryData;
    elevadores: CategoryData;
    escadasRolantes: CategoryData;
    lojas: CategoryData;
    outros: CategoryData;
    areaComum: CategoryData;
    totalGeral: number;
  };
  grandTotal: number;
  /**
   * RFC-0196 — calculated residual:
   * `Entrada − (Lojas + Climatização + Elevadores + Esc. Rolantes + Outros)`.
   *
   * When `value > 0` the chart includes a dedicated "Erro" slice. When
   * `value <= 0` the slice is omitted entirely (placeholder rendered in
   * card UI as `'—'`).
   */
  erro: CategoryData;
}

export interface WaterState {
  entrada: CategoryData;
  lojas: CategoryData;
  banheiros: CategoryData;
  areaComum: CategoryData;
  pontosNaoMapeados: CategoryData & {
    hasInconsistency: boolean;
  };
  grandTotal: number;
}

// ============================================
// CHART COLORS
// ============================================

export interface ChartColors {
  climatizacao: string;
  elevadores: string;
  escadasRolantes: string;
  lojas: string;
  outros: string;
  areaComum: string;
  // Water specific
  banheiros: string;
  pontosNaoMapeados: string;
}

export const DEFAULT_CHART_COLORS: ChartColors = {
  climatizacao: '#00C896',
  elevadores: '#5B2EBC',
  escadasRolantes: '#FF6B6B',
  lojas: '#FFC107',
  outros: '#9C27B0',
  areaComum: '#4CAF50',
  banheiros: '#2196F3',
  pontosNaoMapeados: '#FF9800',
};

// ============================================
// CATEGORY CONFIGURATION
// ============================================

export interface CategoryConfig {
  label: string;
  icon: string;
  color: string;
  tooltip?: string;
}

export const ENERGY_CATEGORY_CONFIG: Record<EnergyCategoryType, CategoryConfig> = {
  entrada: { label: 'Entrada', icon: '📥', color: '#607D8B' },
  climatizacao: {
    label: 'Climatização',
    icon: '❄️',
    color: '#00C896',
    tooltip: 'CAG + Fancoils + Chillers + Bombas',
  },
  elevadores: { label: 'Elevadores', icon: '🛗', color: '#5B2EBC' },
  escadasRolantes: { label: 'Esc. Rolantes', icon: '🎢', color: '#FF6B6B' },
  lojas: { label: 'Lojas', icon: '🏪', color: '#FFC107' },
  outros: {
    label: 'Outros',
    icon: '⚙️',
    color: '#9C27B0',
    tooltip: 'Equipamentos não classificados',
  },
  areaComum: {
    label: 'Área Comum',
    icon: '🏢',
    color: '#4CAF50',
    tooltip: 'Entrada - (Lojas + Climatização + Elevadores + Esc. Rolantes + Outros)',
  },
  // RFC-0196 — calculated residual when the sum of mapped consumers exceeds
  // the Entrada total (typically a measurement or classification error).
  erro: {
    label: 'Erro',
    icon: '⚠️',
    color: '#E53935',
    tooltip: 'Resíduo calculado: Entrada − (Lojas + Climatização + Elevadores + Esc. Rolantes + Outros)',
  },
};

export const WATER_CATEGORY_CONFIG: Record<WaterCategoryType, CategoryConfig> = {
  entrada: { label: 'Entrada', icon: '💧', color: '#607D8B' },
  lojas: { label: 'Lojas', icon: '🏪', color: '#FFC107' },
  banheiros: {
    label: 'Banheiros',
    icon: '🚿',
    color: '#2196F3',
    tooltip: 'Consumo de água em banheiros e áreas sanitárias',
  },
  areaComum: { label: 'Área Comum', icon: '🏢', color: '#4CAF50' },
  pontosNaoMapeados: {
    label: 'Não Mapeados',
    icon: '❓',
    color: '#FF9800',
    tooltip: 'Diferença entre entrada e consumidores mapeados',
  },
};

// ============================================
// COMPONENT PARAMS
// ============================================

export interface TelemetryInfoShoppingParams {
  container: HTMLElement;
  domain: TelemetryDomain;
  themeMode?: ThemeMode;
  debugActive?: boolean;

  // Display options
  labelWidget?: string;
  showChart?: boolean;
  showExpandButton?: boolean;

  // Chart customization
  chartColors?: Partial<ChartColors>;

  // Callbacks
  onCategoryClick?: (category: CategoryType) => void;
  onExpandClick?: () => void;
  /**
   * RFC-0196 — fires when the user clicks a pie-chart slice.
   *
   * `group` is the canonical group identifier (see `EnergyGroup` /
   * `WaterGroup`). The component also dispatches a global
   * `myio:filter-applied` CustomEvent on the `window` object so the
   * dashboard controller can narrow grids without a direct callback wire.
   *
   * Implementations should treat the same-slice-clicked-twice case as a
   * filter-clear (toggle behaviour) — the component fires the callback
   * with the same group on both clicks; the controller is responsible
   * for tracking activation.
   */
  onSliceClick?: (group: FilterGroup) => void;
}

// ============================================
// ENERGY SUMMARY (from orchestrator)
// ============================================

export interface EnergySummary {
  entrada?: { total: number };
  lojas?: { total: number; perc?: number };
  climatizacao?: { total: number; perc?: number };
  elevadores?: { total: number; perc?: number };
  escadasRolantes?: { total: number; perc?: number };
  outros?: { total: number; perc?: number };
  areaComum?: { total: number; perc?: number };
  /**
   * RFC-0196 — optional pre-calculated residual. When omitted the
   * component computes `erro = entrada − (lojas + climatizacao +
   * elevadores + escadasRolantes + outros)` itself.
   */
  erro?: { total: number; perc?: number };
}

export interface WaterSummary {
  entrada?: { total: number };
  lojas?: { total: number; perc?: number };
  banheiros?: { total: number; perc?: number };
  areaComum?: { total: number; perc?: number };
  pontosNaoMapeados?: { total: number; perc?: number; hasInconsistency?: boolean };
}

// ============================================
// COMPONENT INSTANCE
// ============================================

export interface TelemetryInfoShoppingInstance {
  element: HTMLElement;

  // Data methods
  setEnergyData: (summary: EnergySummary) => void;
  setWaterData: (summary: WaterSummary) => void;
  clearData: () => void;

  // State
  getState: () => EnergyState | WaterState | null;
  getDomain: () => TelemetryDomain;

  // Config
  setDomain: (domain: TelemetryDomain) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setLabel: (label: string) => void;

  // Modal
  openModal: () => void;
  closeModal: () => void;
  isModalOpen: () => boolean;

  // Chart
  refreshChart: () => void;

  // RFC-0196 — slice activation
  /**
   * Trigger a slice click programmatically. Same toggle semantics as a
   * user click on the pie: same group twice clears the filter.
   *
   * Fires `onSliceClick` and dispatches `myio:filter-applied`.
   */
  triggerSliceClick: (group: FilterGroup) => void;
  /** Returns the currently-active filter group, or `null` when none. */
  getActiveGroup: () => FilterGroup | null;

  // Lifecycle
  destroy: () => void;
}

// ============================================
// FORMATTERS
// ============================================

export function formatEnergy(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0,00 kWh';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' kWh';
}

export function formatWater(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0,000 m³';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }) + ' m³';
}

export function formatPercentage(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0,0%';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + '%';
}
