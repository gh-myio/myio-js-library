/**
 * RFC-0238 — Head Office Portfolio Command Center: modelo normalizado do overview.
 *
 * Regras herdadas da RFC: `null` nunca é zero; cada métrica declara estado, escopo e
 * cobertura; ausência de dado/configuração é um estado próprio (nunca "verde").
 */

export type MetricState = 'available' | 'partial' | 'unavailable' | 'not-configured';

export interface MetricCoverage {
  /** Shoppings que entraram na conta */
  covered: number;
  /** Shoppings selecionados */
  total: number;
  /** Texto curto do que foi incluído/excluído */
  note?: string;
}

export interface PortfolioMetric {
  key: string;
  state: MetricState;
  /** Quantidade; `null` = sem valor (não é zero) */
  value: number | null;
  unit: 'kWh' | 'm3' | 'celsius' | 'count' | 'percent';
  /** Fronteira/escopo usado no cálculo (ex.: "Soma dos submedidores") */
  scopeLabel: string;
  coverage: MetricCoverage;
  /** Motivos para partial/unavailable/not-configured */
  reasons: string[];
}

/** Dispositivo como o controller do HO já entrega (classified.*.*) */
export interface PortfolioSourceDevice {
  id?: string;
  entityId?: string;
  label?: string;
  name?: string;
  ownerName?: string;
  customerName?: string;
  deviceProfile?: string;
  deviceStatus?: string;
  value?: number | null;
  val?: number | null;
  consumption?: number | null;
  pulses?: number | null;
  temperature?: number | string | null;
  lastTelemetryTs?: number | null;
}

export type ClassifiedDomain = Record<string, PortfolioSourceDevice[] | undefined>;

export interface PortfolioAlarmDetail {
  title?: string;
  deviceName?: string;
  severity?: string;
  state?: string;
}

export interface PortfolioShoppingInput {
  /** Nome exibido (igual ao ownerName dos devices) */
  name: string;
  id?: string;
  /** Alarmes abertos; `null` = carregando, `undefined` = não informado */
  alarms?: number | null;
  alarmDetails?: PortfolioAlarmDetail[];
}

export interface PortfolioSnapshotInput {
  classified: {
    energy?: ClassifiedDomain;
    water?: ClassifiedDomain;
    temperature?: ClassifiedDomain;
  };
  shoppings?: PortfolioShoppingInput[];
  temperatureRange?: { min: number; max: number } | null;
  period: { start: string; end: string; timezone?: string };
  /** Relógio fixo (testes/fixtures determinísticos) */
  now?: number;
}

export type HoldingCategoryId =
  | 'hvac'
  | 'vertical-transport'
  | 'pumping'
  | 'tenants'
  | 'supply'
  | 'other'
  | 'unmapped';

export interface CategoryContribution {
  id: HoldingCategoryId;
  label: string;
  value: number;
  devices: number;
  share: number; // 0..1 do total do escopo
}

export interface DomainConnectivity {
  online: number;
  total: number;
}

export interface ShoppingRow {
  name: string;
  id?: string;
  energy: { value: number | null; devices: number };
  water: {
    /** Fronteira de entrada (hidrômetros de entrada); null = shopping sem entrada medida */
    supply: number | null;
    downstream: number | null;
    /** entrada − consumos medidos, com sinal (negativo = problema de reconciliação) */
    residual: number | null;
    devices: number;
  };
  temperature: { avg: number | null; outOfRange: number; sensors: number };
  alarms: { open: number | null; critical: number | null };
  connectivity: { energy: DomainConnectivity; water: DomainConnectivity; temperature: DomainConnectivity };
  /** 0..1, sobre todos os domínios */
  offlineShare: number;
  /** Motivo principal de atenção (texto curto) ou null */
  attention: string | null;
}

export type PrioritySeverity = 'critical' | 'warning' | 'info';

export interface PriorityItem {
  id: string;
  shopping: string;
  severity: PrioritySeverity;
  title: string;
  /** Evidência objetiva (números) */
  evidence: string;
  /** "Por que aparece": regra determinística usada */
  rule: string;
  /** Destino sugerido (para navegação) */
  target: 'alarms' | 'energy' | 'water' | 'temperature' | 'connectivity';
}

export interface PortfolioSnapshot {
  computedAt: number;
  period: { start: string; end: string; timezone: string };
  kpis: {
    energy: PortfolioMetric;
    water: PortfolioMetric;
    demand: PortfolioMetric;
    cost: PortfolioMetric;
  };
  shoppings: ShoppingRow[];
  /** Regra de ordenação exibida ao usuário */
  sortRule: string;
  categories: CategoryContribution[];
  priorities: PriorityItem[];
  coverage: {
    connectivity: DomainConnectivity & { byDomain: Record<'energy' | 'water' | 'temperature', DomainConnectivity> };
    temperature: { sensors: number; outOfRange: number; range: { min: number; max: number } | null };
    waterSupplyShoppings: number;
    /** Devices de donos fora da lista de shoppings do escopo */
    excludedDevices: number;
  };
}
