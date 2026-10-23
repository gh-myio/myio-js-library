/**
 * ED-1354 — Automação dos poços (Taboão): poço/cisterna (deviceProfile CISTERNA) com N bombas
 * (BOMBA_POCO) e M solenoides (SOLENOIDE), exibidas no card do poço, na modal do
 * reservatório e na modal "Automação dos Poços".
 */

/** Intervalo em que o equipamento esteve ativo (bomba ligada / válvula aberta): [início, fim | null = ativo agora]. */
export type StateInterval = [number, number | null];

export type EquipmentKind = 'pump' | 'valve';

/** Indicador compacto (B1 / B2 / S) usado no card, na modal do reservatório e no atalho do header. */
export interface EquipmentIndicator {
  /** Código curto exibido (ex.: 'B1', 'B2', 'S') */
  code: string;
  /** Nome completo (tooltip) */
  label: string;
  kind: EquipmentKind;
  /** true = ligada/aberta · false = desligada/fechada · null = sem leitura */
  active: boolean | null;
  /** Desde quando está no estado atual (ms) */
  since?: number | null;
  /** deviceProfile para o tooltip (BOMBA_POCO, SOLENOIDE…) */
  deviceProfile?: string;
}

export interface WellPumpInfo {
  /** TB deviceId */
  id?: string;
  tbId?: string;
  gcdrId?: string;
  /** W acima do qual conta como ligada (só usado ao montar o history a partir de `consumption`) */
  thresholdW?: number;
  /** 'B1', 'B2'… */
  code: string;
  label: string;
  identifier?: string;
  /** default 'BOMBA_POCO' */
  deviceProfile?: string;
  /** Poço que a bomba atende (ex.: 'Poço 3') */
  wellLabel?: string;
  /** Id do poço — destaca o painel quando a modal é aberta a partir dele */
  wellId?: string;
  /** Potência atual (kW) quando ligada; null/undefined = sem medição */
  powerKw?: number | null;
  /** Intervalos ligada (ordem cronológica) */
  history: StateInterval[];
  /** Nível do poço (m.c.a) */
  wellLevelMca?: number | null;
  /** Nível do poço (0–1) */
  wellPercentage?: number | null;
}

export interface WellValveInfo {
  /** TB deviceId */
  id?: string;
  tbId?: string;
  gcdrId?: string;
  /** 'S', 'S1', 'S2'… */
  code: string;
  label: string;
  identifier?: string;
  /** default 'SOLENOIDE' */
  deviceProfile?: string;
  /** Linha de contexto (ex.: 'entrada Sabesp') */
  description?: string;
  /** Intervalos aberta (ordem cronológica) */
  history: StateInterval[];
}

export interface WellPumpsModalData {
  /** N bombas (0..N) */
  pumps: WellPumpInfo[];
  /** M solenoides (0..M) */
  valves?: WellValveInfo[];
}

export interface OpenWellPumpsModalParams {
  /** default 'Automação dos Poços' */
  title?: string;
  subtitle?: string;
  /** Dados prontos ou loader async (chamado na abertura e a cada refreshIntervalMs) */
  data: WellPumpsModalData | (() => Promise<WellPumpsModalData>);
  /** wellId do painel a destacar */
  focusWellId?: string;
  /** Selo "SIMULADO" no header (showcase / demo) */
  simulated?: boolean;
  /** Recarrega via loader a cada N ms (só quando `data` é função). 0/undefined = não recarrega */
  refreshIntervalMs?: number;
  /** Nota de rodapé (ex.: bombas podem operar simultaneamente) */
  footnote?: string;
  /** URLs das imagens (default: deviceIcons BOMBA_POCO / SOLENOIDE) */
  images?: { pump?: string; valve?: string };
  zIndex?: number;
  onClose?: () => void;
}

export interface WellPumpsModalHandle {
  update: (data: WellPumpsModalData) => void;
  close: () => void;
  readonly element: HTMLElement;
}
