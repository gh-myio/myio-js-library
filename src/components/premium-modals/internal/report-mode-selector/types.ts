// premium-modals/internal/report-mode-selector/types.ts
// RFC-0223: Consolidado | Diário | Horário report-mode selector — a thin
// wrapper around the existing granularity-selector (1d/1h), adding a
// Consolidado segment + one bounding radiogroup region. Does NOT extend the
// shared granularity-selector primitive (kept untouched, single-consumer risk
// stays isolated to this modal).

export type ReportMode = 'consolidado' | '1d' | '1h';

export type ReportModeSelectorThemeMode = 'light' | 'dark';

export interface ReportModeSelectorSettings {
  /** Valor inicial (default: 'consolidado' — RFC-0223: zero regressão por padrão). */
  value?: ReportMode;
  themeMode?: ReportModeSelectorThemeMode;
  disabled?: boolean;
  /** Rótulo do grupo acima do track (default: "Modo do relatório"). */
  label?: string;
  /** Texto de ajuda abaixo do track (default: frase da RFC). String vazia oculta. */
  helperText?: string;
  /**
   * RFC-0223 delivery phases: `Horário` fica OCULTO até a P3 (drill-down
   * hora-a-hora) — "no dead control", nunca um botão clicável que não faz
   * nada. Default true (o componente é genericamente capaz das 3 opções);
   * a P1 do AllReportModal passa `false` explicitamente e a P3 remove o flag.
   */
  horarioEnabled?: boolean;
}

export interface ReportModeSelectorParams {
  settings?: ReportModeSelectorSettings;
  /** Disparado apenas em mudança real de modo (clique repetido no ativo não dispara). */
  onChange?: (value: ReportMode) => void | Promise<void>;
}

export interface ReportModeSelectorInstance {
  element: HTMLElement;
  getValue(): ReportMode;
  /** silent: true atualiza a UI sem disparar onChange. */
  setValue(value: ReportMode, opts?: { silent?: boolean }): void;
  setThemeMode(mode: ReportModeSelectorThemeMode): void;
  setDisabled(disabled: boolean): void;
  /** Remove listeners, o granularity-selector interno e o elemento do DOM. */
  destroy(): void;
}
