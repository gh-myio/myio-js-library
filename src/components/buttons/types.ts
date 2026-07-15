// components/buttons/types.ts
// Export-button factory: pill buttons (PDF/CSV/XLS) no padrão visual do
// smart-hospital MAN4 ("Indicadores de Resultado de Conformidade") com temas
// light/dark, estado bloqueado (cadeado) e tooltip premium via InfoTooltip.

export type ExportButtonKind = 'pdf' | 'csv' | 'xls' | 'custom';

export type ExportButtonThemeMode = 'light' | 'dark';

/** Trio de cores de um botão em um tema. */
export interface ExportButtonColors {
  /** Cor da borda (identidade do formato: vermelho pdf, azul csv, verde xls). */
  border: string;
  /** Cor do texto/ícone. */
  text: string;
  /** Background no hover. */
  hoverBg: string;
  /** Background em repouso. */
  bg: string;
}

export interface ExportButtonTooltip {
  /** false desativa o tooltip mesmo com texto definido. */
  enabled?: boolean;
  /** Texto (HTML permitido) exibido no corpo do InfoTooltip. */
  text: string;
  /** Título do header do tooltip (default: label do botão). */
  title?: string;
  /** Ícone do header do tooltip (default: ícone do formato). */
  icon?: string;
}

export interface ExportButtonSettings {
  themeMode?: ExportButtonThemeMode;
  /** Texto do botão (default por kind: PDF | CSV | XLSX). */
  label?: string;
  /** Ícone (emoji/HTML). Default por kind (SVG inline). */
  icon?: string;
  /** Overrides de cores por tema — mesclados sobre os defaults do kind. */
  colors?: {
    light?: Partial<ExportButtonColors>;
    dark?: Partial<ExportButtonColors>;
  };
  /** Desabilitado (sem cadeado — ex.: aguardando dados). */
  disabled?: boolean;
  /** Bloqueado: desabilitado + cadeado 🔒 no lugar do ícone (feature não licenciada etc.). */
  locked?: boolean;
  /** Tooltip premium (InfoTooltip) exibido no hover quando enabled. */
  tooltip?: ExportButtonTooltip;
  enableDebugMode?: boolean;
}

export interface ExportButtonParams {
  settings?: ExportButtonSettings;
  onClick?: () => void | Promise<void>;
}

export interface ExportButtonInstance {
  element: HTMLButtonElement;
  kind: ExportButtonKind;
  updateSettings(settings: Partial<ExportButtonSettings>): void;
  getSettings(): ExportButtonSettings;
  setThemeMode(mode: ExportButtonThemeMode): void;
  setDisabled(disabled: boolean): void;
  setLocked(locked: boolean): void;
  destroy(): void;
}

/** Defaults visuais por kind e tema (light = paleta MAN4). */
export const EXPORT_BUTTON_KIND_DEFAULTS: Record<
  Exclude<ExportButtonKind, 'custom'>,
  { label: string; colors: Record<ExportButtonThemeMode, ExportButtonColors> }
> = {
  pdf: {
    label: 'PDF',
    colors: {
      light: { border: '#fca5a5', text: '#dc2626', hoverBg: '#fff5f5', bg: '#ffffff' },
      dark: { border: '#7f1d1d', text: '#fca5a5', hoverBg: 'rgba(220,38,38,0.15)', bg: 'transparent' },
    },
  },
  csv: {
    label: 'CSV',
    colors: {
      light: { border: '#93c5fd', text: '#1d4ed8', hoverBg: '#eff6ff', bg: '#ffffff' },
      dark: { border: '#1e3a8a', text: '#93c5fd', hoverBg: 'rgba(29,78,216,0.15)', bg: 'transparent' },
    },
  },
  xls: {
    label: 'XLSX',
    colors: {
      light: { border: '#86efac', text: '#16a34a', hoverBg: '#f0fdf4', bg: '#ffffff' },
      dark: { border: '#14532d', text: '#86efac', hoverBg: 'rgba(22,163,74,0.15)', bg: 'transparent' },
    },
  },
};

/** Defaults do kind custom (neutro MAN4). */
export const EXPORT_BUTTON_CUSTOM_COLORS: Record<ExportButtonThemeMode, ExportButtonColors> = {
  light: { border: '#d1d5db', text: '#374151', hoverBg: '#f3f4f6', bg: '#ffffff' },
  dark: { border: '#4b5563', text: '#d1d5db', hoverBg: 'rgba(255,255,255,0.08)', bg: 'transparent' },
};
