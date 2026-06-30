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
  | 'areaComum';

export type WaterCategoryType =
  | 'entrada'
  | 'lojas'
  | 'banheiros'
  | 'areaComum'
  | 'pontosNaoMapeados';

export type CategoryType = EnergyCategoryType | WaterCategoryType;

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

// RFC-0211-info: Ported (i) tooltips from v-5.2.0 TELEMETRY_INFO (template.html + controller)
// so practically every metric carries the MyIO info tooltip (was only on a few cards).
export const ENERGY_CATEGORY_CONFIG: Record<EnergyCategoryType, CategoryConfig> = {
  entrada: {
    label: 'Entrada',
    icon: '📥',
    color: '#607D8B',
    tooltip: 'Medição na entrada (relógio / subestação / medidor principal). Referência de 100% do consumo.',
  },
  climatizacao: {
    label: 'Climatização',
    icon: '❄️',
    color: '#00C896',
    tooltip:
      'Climatização = CAG + Fancoils + Chillers + Bombas (Primárias + Secundárias + Condensadoras)',
  },
  elevadores: {
    label: 'Elevadores',
    icon: '🛗',
    color: '#5B2EBC',
    tooltip: 'Consumo agregado dos elevadores.',
  },
  escadasRolantes: {
    label: 'Esc. Rolantes',
    icon: '🎢',
    color: '#FF6B6B',
    tooltip: 'Consumo agregado das escadas rolantes.',
  },
  lojas: {
    label: 'Lojas',
    icon: '🏪',
    color: '#FFC107',
    tooltip: 'Consumo agregado das lojas (medidores 3F).',
  },
  outros: {
    label: 'Outros',
    icon: '⚙️',
    color: '#9C27B0',
    tooltip: 'Equipamentos não classificados nas categorias principais.',
  },
  areaComum: {
    label: 'Área Comum',
    icon: '🏢',
    color: '#4CAF50',
    tooltip: 'Entrada - (Lojas + Climatização + Elevadores + Esc. Rolantes + Outros)',
  },
};

export const WATER_CATEGORY_CONFIG: Record<WaterCategoryType, CategoryConfig> = {
  entrada: {
    label: 'Entrada',
    icon: '💧',
    color: '#607D8B',
    tooltip: 'Hidrômetro de entrada. Referência de 100% do consumo.',
  },
  lojas: {
    label: 'Lojas',
    icon: '🏪',
    color: '#FFC107',
    tooltip: 'Consumo de água agregado das lojas.',
  },
  banheiros: {
    label: 'Banheiros',
    icon: '🚿',
    color: '#2196F3',
    tooltip: 'Consumo de água em banheiros e áreas sanitárias.',
  },
  areaComum: {
    label: 'Área Comum',
    icon: '🏢',
    color: '#4CAF50',
    tooltip: 'Consumo de água das áreas comuns.',
  },
  pontosNaoMapeados: {
    label: 'Não Mapeados',
    icon: '❓',
    color: '#FF9800',
    tooltip: 'Diferença entre a entrada e os consumidores mapeados.',
  },
};

// RFC-0211-info: tooltip for the aggregate "Total" card (no category key in the config maps).
export const TOTAL_CARD_TOOLTIP =
  'Soma de todos os consumidores. Em condições normais é igual à Entrada (100%).';

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

  // RFC-0214/agnostic: when provided, the panel renders ONE card per column (driven by the GCDR
  // classification tree) instead of the fixed energy/water categories. Fed via setColumnsData().
  columns?: GenericColumn[];
  /** Measurement unit for the generic (columns) mode (e.g. 'kWh', 'm³', '°C'). */
  unit?: string;

  // Chart customization
  chartColors?: Partial<ChartColors>;

  // Callbacks
  onCategoryClick?: (category: CategoryType) => void;
  onExpandClick?: () => void;
}

// ============================================
// GENERIC (agnostic) columns — driven by the GCDR tree
// ============================================

export interface GenericColumn {
  key: string;
  label: string;
  icon?: string;
}

/** Per-column totals: { [columnKey]: { total } } — exactly what the controller's updateOneInfo builds. */
export type GenericColumnSummary = Record<string, { total: number }>;

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
  /** Agnostic mode: per-column totals keyed by the tree column key (see params.columns). */
  setColumnsData: (summary: GenericColumnSummary) => void;
  clearData: () => void;

  // State
  getState: () => EnergyState | WaterState;
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
