// components/buttons/createExportButton.ts
// Factory de botões de export (PDF/CSV/XLS/custom) — visual MAN4, temas
// light/dark com override, estado locked (cadeado) e tooltip via InfoTooltip.

import { InfoTooltip } from '../../utils/tooltips/InfoTooltip';
import { EXPORT_BUTTON_CSS_PREFIX, injectExportButtonStyles } from './styles';
import {
  EXPORT_BUTTON_CUSTOM_COLORS,
  EXPORT_BUTTON_KIND_DEFAULTS,
  ExportButtonColors,
  ExportButtonInstance,
  ExportButtonKind,
  ExportButtonParams,
  ExportButtonSettings,
  ExportButtonThemeMode,
} from './types';

// SVGs inline (fill: currentColor) — mesmos glifos usados nas premium modals.
const KIND_ICONS: Record<Exclude<ExportButtonKind, 'custom'>, string> = {
  pdf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>',
  csv: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2v-3h2v3zm0-5h-2v-2h2v2zm4 5h-2V8h2v9z"/></svg>',
  xls: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 10.02h5V21h-5zM17 21h3c1.1 0 2-.9 2-2v-9h-5v11zm3-18H5c-1.1 0-2 .9-2 2v3h19V5c0-1.1-.9-2-2-2zM3 19c0 1.1.9 2 2 2h3V10H3v9z"/></svg>',
};

const LOCK_ICON = '🔒';

function resolveColors(
  kind: ExportButtonKind,
  settings: ExportButtonSettings
): ExportButtonColors {
  const mode: ExportButtonThemeMode = settings.themeMode || 'light';
  const base =
    kind === 'custom'
      ? EXPORT_BUTTON_CUSTOM_COLORS[mode]
      : EXPORT_BUTTON_KIND_DEFAULTS[kind].colors[mode];
  return { ...base, ...(settings.colors?.[mode] || {}) };
}

export function createExportButton(
  kind: ExportButtonKind,
  container: HTMLElement,
  params: ExportButtonParams = {}
): ExportButtonInstance {
  injectExportButtonStyles();

  let settings: ExportButtonSettings = { themeMode: 'light', ...(params.settings || {}) };
  let tooltipCleanup: (() => void) | null = null;

  const btn = document.createElement('button');
  btn.type = 'button';
  container.appendChild(btn);

  const debug = (...args: unknown[]) => {
    if (settings.enableDebugMode) console.log(`[ExportButton:${kind}]`, ...args);
  };

  const defaultLabel = kind === 'custom' ? 'Exportar' : EXPORT_BUTTON_KIND_DEFAULTS[kind].label;
  const defaultIcon = kind === 'custom' ? '' : KIND_ICONS[kind];

  const render = (): void => {
    const colors = resolveColors(kind, settings);
    const label = settings.label ?? defaultLabel;
    const locked = !!settings.locked;
    const disabled = locked || !!settings.disabled;
    const icon = locked ? LOCK_ICON : (settings.icon ?? defaultIcon);

    btn.className = `${EXPORT_BUTTON_CSS_PREFIX}${locked ? ` ${EXPORT_BUTTON_CSS_PREFIX}--locked` : ''}`;
    btn.disabled = disabled;
    btn.style.borderColor = colors.border;
    btn.style.color = colors.text;
    btn.style.background = colors.bg;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = `${icon ? `<span class="${EXPORT_BUTTON_CSS_PREFIX}__icon">${icon}</span>` : ''}${label}`;

    // Tooltip premium (InfoTooltip.attach) — recriado a cada render para refletir settings.
    tooltipCleanup?.();
    tooltipCleanup = null;
    const tt = settings.tooltip;
    if (tt && tt.enabled !== false && tt.text) {
      tooltipCleanup = InfoTooltip.attach(btn, () => ({
        icon: tt.icon || (locked ? LOCK_ICON : '📄'),
        title: tt.title || (settings.label ?? defaultLabel),
        content: tt.text,
      }));
    }
  };

  const onEnter = (): void => {
    if (btn.disabled) return;
    btn.style.background = resolveColors(kind, settings).hoverBg;
  };
  const onLeave = (): void => {
    btn.style.background = resolveColors(kind, settings).bg;
  };
  const onClick = (e: MouseEvent): void => {
    if (btn.disabled || settings.locked) return;
    e.stopPropagation();
    debug('click');
    void params.onClick?.();
  };

  btn.addEventListener('mouseenter', onEnter);
  btn.addEventListener('mouseleave', onLeave);
  btn.addEventListener('click', onClick);

  render();

  return {
    element: btn,
    kind,
    updateSettings(next) {
      settings = {
        ...settings,
        ...next,
        colors: next.colors ? { ...settings.colors, ...next.colors } : settings.colors,
      };
      render();
    },
    getSettings: () => ({ ...settings }),
    setThemeMode(mode) {
      settings.themeMode = mode;
      render();
    },
    setDisabled(disabled) {
      settings.disabled = disabled;
      render();
    },
    setLocked(locked) {
      settings.locked = locked;
      render();
    },
    destroy() {
      tooltipCleanup?.();
      btn.removeEventListener('mouseenter', onEnter);
      btn.removeEventListener('mouseleave', onLeave);
      btn.removeEventListener('click', onClick);
      btn.remove();
    },
  };
}
