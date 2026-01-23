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
