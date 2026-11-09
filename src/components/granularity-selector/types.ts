// components/granularity-selector/types.ts
// Seletor de granularidade (tabs 1h / 1d) extraído do EnergyModal (RFC-0097):
// pill container com fundo sutil, botão ativo destacado, temas light/dark e
// tooltip premium opcional via InfoTooltip.

/** 15m/30m: só onde houver opções explícitas (ex.: relatórios de temperatura) — default segue 1h|1d */
export type Granularity = '15m' | '30m' | '1h' | '1d';

export type GranularitySelectorThemeMode = 'light' | 'dark';

export interface GranularitySelectorOption {
  value: Granularity;
  /** Texto do botão (default: o próprio value, ex.: "1h"). */
  label?: string;
  /** Atributo title do botão (default: "Hora" para 1h, "Dia" para 1d). */
  title?: string;
}

export interface GranularitySelectorTooltip {
  /** false desativa o tooltip mesmo com texto definido. */
  enabled?: boolean;
  /** Texto (HTML permitido) exibido no corpo do InfoTooltip. */
  text: string;
  /** Título do header do tooltip (default: "Granularidade"). */
  title?: string;
  /** Ícone do header do tooltip (default: 🕒). */
  icon?: string;
}

export interface GranularitySelectorSettings {
  /** Valor inicial (default: '1d' — RFC-0097: modal sempre abre em 1d). */
  value?: Granularity;
  /** Opções exibidas, na ordem (default: 1h, 1d — mesma ordem do EnergyModal). */
  options?: GranularitySelectorOption[];
  /** Rótulo do grupo (default: "Granularidade:"). String vazia oculta o rótulo. */
  label?: string;
  /** Tema visual (default: 'light'). Visual idêntico ao EnergyModal nos 2 modos. */
  themeMode?: GranularitySelectorThemeMode;
  disabled?: boolean;
  /** Tooltip premium (InfoTooltip) no hover do container quando enabled. */
  tooltip?: GranularitySelectorTooltip;
  enableDebugMode?: boolean;
}

export interface GranularitySelectorParams {
  settings?: GranularitySelectorSettings;
  /** Disparado apenas em mudança real de valor (cliques repetidos no ativo não disparam). */
  onChange?: (value: Granularity) => void | Promise<void>;
}

export interface GranularitySelectorInstance {
  element: HTMLElement;
  getValue(): Granularity;
  /** silent: true atualiza a UI sem disparar onChange. */
  setValue(value: Granularity, opts?: { silent?: boolean }): void;
  setThemeMode(mode: GranularitySelectorThemeMode): void;
  setDisabled(disabled: boolean): void;
  updateSettings(partial: Partial<GranularitySelectorSettings>): void;
  /** Remove listeners, tooltip e o elemento do DOM. */
  destroy(): void;
}

/** Opções default — mesma ordem em que o EnergyModal exibe (1h, depois 1d). */
export const DEFAULT_GRANULARITY_OPTIONS: GranularitySelectorOption[] = [
  { value: '1h', title: 'Hora' },
  { value: '1d', title: 'Dia' },
];

/** Opções dos relatórios de temperatura: 15 min, 30 min, hora e dia. */
export const TEMPERATURE_GRANULARITY_OPTIONS: GranularitySelectorOption[] = [
  { value: '15m', title: '15 minutos' },
  { value: '30m', title: '30 minutos' },
  { value: '1h', title: 'Hora' },
  { value: '1d', title: 'Dia' },
];

/** Tamanho da janela em minutos (1d → 1440). */
export function granularityMinutes(g: Granularity): number {
  return g === '15m' ? 15 : g === '30m' ? 30 : g === '1h' ? 60 : 1440;
}
