// components/theme/types.ts
// Theme palette shared across MYIO dashboards (pattern extracted from
// MYIO-SIM/v5.2.0_UNIQUE settingsSchema darkMode/lightMode + goalsPalette).

export type MyIOThemeMode = 'dark' | 'light';

/** Per-mode settings block — mirrors the darkMode/lightMode settingsSchema objects. */
export interface MyIOThemeModeSettings {
  backgroundType?: 'image' | 'color';
  backgroundUrl?: string;
  backgroundColor?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  mutedTextColor?: string;
}

/**
 * Widget settings slice consumed by createMyIOTheme. Accepts the full
 * ctx.settings object — unknown keys are ignored.
 */
export interface MyIOThemeSettings {
  defaultThemeMode?: MyIOThemeMode | string;
  darkMode?: MyIOThemeModeSettings;
  lightMode?: MyIOThemeModeSettings;
  /** UNIQUE pattern: quando presentes, têm precedência sobre primaryColor (accent do dashboard). */
  tabSelecionadoBackgroundColor?: string;
  tabSelecionadoFontColor?: string;
  cardEnergiaBackgroundColor?: string;
}

export interface MyIOThemePalette {
  mode: MyIOThemeMode;
  /** Cor de destaque (headers de modal, botões primários, séries principais). */
  accent: string;
  /** Variante escura do accent (hover, estados ativos). */
  accentDark: string;
  /** Cor de texto sobre o accent. */
  accentText: string;
  text: string;
  mutedText: string;
  /** Valor CSS pronto p/ background (cor sólida ou url(...) cover). */
  background: string;
  logoUrl: string | null;
  /** Accent translúcido (color-mix) — bordas, hovers, chips. NÃO usar em canvas. */
  tint(pct: number): string;
  /** Accent clareado (color-mix) — fundos suaves. NÃO usar em canvas. */
  lighten(pct: number): string;
  /**
   * N tons HEX sólidos derivados do accent (clareia/escurece alternado) — para
   * séries de gráfico (canvas não aceita color-mix). Retorna null quando o
   * accent não é hex #rrggbb (caller usa a paleta default).
   */
  tones(count: number): string[] | null;
  /** Mapa de CSS custom properties (--myio-*) prontos para setProperty. */
  cssVars(): Record<string, string>;
  /** Aplica cssVars() no elemento (default: document.documentElement). */
  applyTo(el?: HTMLElement): void;
}
