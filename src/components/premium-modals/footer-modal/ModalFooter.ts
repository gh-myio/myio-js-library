// premium-modals/footer-modal/ModalFooter.ts
// Footer padrão premium para modais MYIO — uma linha:
//   [Customer Name · 🕐 relógio · vX.Y.Z]   Powered by MYIO Platform   [PDF] [CSV] [XLSX]
// Botões via components/buttons (padrão MAN4); relógio via components/clock;
// versão da lib via createLibraryVersionChecker (mesma do MENU) com fallback estático.

import { createRealTimeClock, RealTimeClockInstance } from '../../clock';
import { createExportButton } from '../../buttons/createExportButton';
import {
  ExportButtonInstance,
  ExportButtonSettings,
  ExportButtonThemeMode,
} from '../../buttons/types';
import { createLibraryVersionChecker } from '../../library-version-checker';

export interface ModalFooterExportConfig {
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  locked?: boolean;
  /** Tooltip premium (InfoTooltip) — texto exibido no hover. */
  tooltipText?: string;
  /** Overrides adicionais do botão (cores, label...). */
  settings?: Partial<ExportButtonSettings>;
}

export interface ModalFooterParams {
  customerName?: string;
  /** Exibe o relógio em tempo real (default true). */
  showClock?: boolean;
  /** Config do relógio (repassada ao createRealTimeClock). */
  clock?: { showSeconds?: boolean; showDate?: boolean; timezone?: string };
  /**
   * Versão da lib: { current } liga o createLibraryVersionChecker (como o MENU);
   * false oculta o bloco.
   */
  libVersion?: { current?: string; preferHomolog?: boolean } | false;
  /** Texto central (default 'Powered by MYIO Platform'). */
  poweredByText?: string;
  themeMode?: ExportButtonThemeMode;
  /** Botões de export exibidos à direita — só os informados são renderizados. */
  exports?: {
    pdf?: ModalFooterExportConfig;
    csv?: ModalFooterExportConfig;
    xls?: ModalFooterExportConfig;
  };
}

export interface ModalFooterInstance {
  element: HTMLElement;
  setThemeMode(mode: ExportButtonThemeMode): void;
  setCustomerName(name: string): void;
  /** Habilita/desabilita um botão de export (ex.: após Carregar). */
  setExportDisabled(kind: 'pdf' | 'csv' | 'xls', disabled: boolean): void;
  buttons: Partial<Record<'pdf' | 'csv' | 'xls', ExportButtonInstance>>;
  destroy(): void;
}

// Cores derivam da paleta do tema via CSS vars (--myio-brand-700 é setada no
// root da modal pelo applyTheme/createMyIOTheme); fallbacks = visual neutro.
const THEME = {
  light: {
    text: '#6b7280',
    name: 'var(--myio-brand-700, #374151)',
    border: 'color-mix(in srgb, var(--myio-brand-700, #5b2c9d) 22%, #e5e7eb)',
    bg: 'color-mix(in srgb, var(--myio-brand-700, #5b2c9d) 5%, #fbfbfc)',
  },
  dark: {
    text: '#94a3b8',
    name: 'color-mix(in srgb, var(--myio-brand-700, #a78bfa) 60%, #fff)',
    border: 'color-mix(in srgb, var(--myio-brand-700, #5b2c9d) 40%, #334155)',
    bg: 'color-mix(in srgb, var(--myio-brand-700, #5b2c9d) 14%, #0f172a)',
  },
} as const;

export function createModalFooter(params: ModalFooterParams = {}): ModalFooterInstance {
  let themeMode: ExportButtonThemeMode = params.themeMode || 'light';

  const el = document.createElement('div');
  el.className = 'myio-modal-footer-premium';

  // ── coluna esquerda: customer · relógio · versão ─────────────────────────
  const left = document.createElement('div');
  left.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0;';

  const nameEl = document.createElement('span');
  nameEl.style.cssText =
    'font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;';
  nameEl.textContent = params.customerName || '';
  if (params.customerName) left.appendChild(nameEl);

  let clock: RealTimeClockInstance | null = null;
  if (params.showClock !== false) {
    clock = createRealTimeClock(left, { themeMode, ...(params.clock || {}) });
  }

  let versionChecker: { destroy?: () => void; setTheme?: (t: string) => void } | null = null;
  const versionHost = document.createElement('span');
  if (params.libVersion !== false) {
    left.appendChild(versionHost);
    const current = params.libVersion?.current;
    try {
      versionChecker = createLibraryVersionChecker(versionHost, {
        packageName: 'myio-js-library',
        currentVersion: current || 'unknown',
        preferHomolog: params.libVersion?.preferHomolog === true,
        theme: themeMode,
      });
    } catch {
      versionHost.textContent = current ? `v${current}` : '';
      versionHost.style.cssText = 'font-size:11px;opacity:.7;';
    }
  }

  // ── coluna central: powered by ───────────────────────────────────────────
  const center = document.createElement('div');
  center.style.cssText =
    'flex:1;text-align:center;font-size:11px;letter-spacing:.04em;white-space:nowrap;';
  center.textContent = params.poweredByText ?? 'Powered by MYIO Platform';

  // ── coluna direita: botões de export ─────────────────────────────────────
  const right = document.createElement('div');
  right.style.cssText = 'display:flex;align-items:center;gap:8px;';

  const buttons: ModalFooterInstance['buttons'] = {};
  (['pdf', 'csv', 'xls'] as const).forEach((kind) => {
    const cfg = params.exports?.[kind];
    if (!cfg) return;
    buttons[kind] = createExportButton(kind, right, {
      onClick: cfg.onClick,
      settings: {
        themeMode,
        disabled: cfg.disabled,
        locked: cfg.locked,
        ...(cfg.tooltipText ? { tooltip: { enabled: true, text: cfg.tooltipText } } : {}),
        ...(cfg.settings || {}),
      },
    });
  });

  el.appendChild(left);
  el.appendChild(center);
  el.appendChild(right);

  const applyTheme = (): void => {
    const t = THEME[themeMode];
    el.style.cssText =
      `display:flex;align-items:center;gap:16px;padding:8px 14px;border-top:1px solid ${t.border};` +
      `background:${t.bg};font-family:inherit;`;
    nameEl.style.color = t.name;
    center.style.color = t.text;
    versionHost.style.color = t.text;
    clock?.setThemeMode(themeMode);
    versionChecker?.setTheme?.(themeMode);
    Object.values(buttons).forEach((b) => b?.setThemeMode(themeMode));
  };
  applyTheme();

  return {
    element: el,
    buttons,
    setThemeMode(mode) {
      themeMode = mode;
      applyTheme();
    },
    setCustomerName(name) {
      nameEl.textContent = name;
      if (name && !nameEl.parentElement) left.prepend(nameEl);
    },
    setExportDisabled(kind, disabled) {
      buttons[kind]?.setDisabled(disabled);
    },
    destroy() {
      clock?.destroy();
      versionChecker?.destroy?.();
      Object.values(buttons).forEach((b) => b?.destroy());
      el.remove();
    },
  };
}
