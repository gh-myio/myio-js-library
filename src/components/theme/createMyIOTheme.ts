// components/theme/createMyIOTheme.ts
// Builds a MyIOThemePalette from widget settings (dark/light modes) so every
// consumer (widgets, premium modals, charts) derives its colors from the same
// dashboard-configured source instead of hardcoding brand colors.

import { MyIOThemeMode, MyIOThemePalette, MyIOThemeSettings } from './types';

const HEX_RE = /^#[0-9a-f]{6}$/i;

// Defaults espelham os CSS_TOKENS das premium modals (internal/styles/tokens.ts):
// sem configuração no dashboard, aplicar o tema é um no-op visual.
const MODE_DEFAULTS = {
  dark: {
    primaryColor: '#3e1a7d',
    secondaryColor: '#2d1458',
    textColor: '#ffffff',
    mutedTextColor: '#cccccc',
    backgroundColor: '#1a1a1a',
  },
  light: {
    primaryColor: '#3e1a7d',
    secondaryColor: '#2d1458',
    textColor: '#333333',
    mutedTextColor: '#666666',
    backgroundColor: '#f7f7f7',
  },
} as const;

/** Mistura linear de dois hex #rrggbb (pctB em 0..1). Solid hex — seguro p/ canvas. */
function mixHex(hexA: string, hexB: string, pctB: number): string {
  const n = (h: string) => parseInt(h.slice(1), 16);
  const a = n(hexA);
  const b = n(hexB);
  const ch = (sa: number, sb: number) => Math.round(sa + (sb - sa) * pctB);
  const r = ch((a >> 16) & 255, (b >> 16) & 255);
  const g = ch((a >> 8) & 255, (b >> 8) & 255);
  const bl = ch(a & 255, b & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

/**
 * Creates the theme palette for the given settings + mode.
 *
 * Accent resolution order (same chain as the UNIQUE goalsPalette):
 * 1. settings.tabSelecionadoBackgroundColor (identidade visual do dashboard)
 * 2. mode primaryColor (darkMode/lightMode)
 * 3. MyIO default (#7A2FF7)
 */
export function createMyIOTheme(
  settings?: MyIOThemeSettings | null,
  mode?: MyIOThemeMode
): MyIOThemePalette {
  const s = settings || {};
  const resolvedMode: MyIOThemeMode =
    mode || (s.defaultThemeMode === 'dark' ? 'dark' : 'light');
  const defaults = MODE_DEFAULTS[resolvedMode];
  const modeCfg = (resolvedMode === 'dark' ? s.darkMode : s.lightMode) || {};

  const accent = s.tabSelecionadoBackgroundColor || modeCfg.primaryColor || defaults.primaryColor;
  const accentDark =
    s.cardEnergiaBackgroundColor || modeCfg.secondaryColor || defaults.secondaryColor;
  const accentText = s.tabSelecionadoFontColor || '#ffffff';
  const text = modeCfg.textColor || defaults.textColor;
  const mutedText = modeCfg.mutedTextColor || defaults.mutedTextColor;

  const background =
    modeCfg.backgroundType === 'image' && modeCfg.backgroundUrl
      ? `url('${modeCfg.backgroundUrl}') center center / cover no-repeat fixed`
      : modeCfg.backgroundColor || defaults.backgroundColor;

  const tint = (pct: number) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`;
  const lighten = (pct: number) => `color-mix(in srgb, ${accent} ${100 - pct}%, #fff)`;

  const tones = (count: number): string[] | null => {
    if (!HEX_RE.test(accent)) return null; // accent fora do padrão hex → paleta default do caller
    return Array.from({ length: count }, (_, i) => {
      if (i === 0) return accent;
      const step = Math.ceil(i / 2);
      const pct = Math.min(0.72, 0.08 + 0.21 * step);
      return i % 2 === 1 ? mixHex(accent, '#ffffff', pct) : mixHex(accent, '#0f172a', pct);
    });
  };

  const cssVars = (): Record<string, string> => ({
    '--myio-brand-700': accent,
    '--myio-brand-600': accentDark,
    '--myio-primary': accent,
    '--myio-accent-text': accentText,
    '--myio-text': text,
    '--myio-text-muted': mutedText,
  });

  const applyTo = (el?: HTMLElement): void => {
    const target = el || (typeof document !== 'undefined' ? document.documentElement : null);
    if (!target) return;
    Object.entries(cssVars()).forEach(([k, v]) => target.style.setProperty(k, v));
  };

  return {
    mode: resolvedMode,
    accent,
    accentDark,
    accentText,
    text,
    mutedText,
    background,
    logoUrl: modeCfg.logoUrl || null,
    tint,
    lighten,
    tones,
    cssVars,
    applyTo,
  };
}
