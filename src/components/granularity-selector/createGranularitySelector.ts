// components/granularity-selector/createGranularitySelector.ts
// Factory do seletor de granularidade (tabs 1h / 1d) — extraído do EnergyModal
// (RFC-0097). Visual e comportamento fiéis ao original: pill container, botão
// ativo destacado, hover states, temas light/dark. Tooltip premium opcional
// via InfoTooltip anexado ao container.

import { InfoTooltip } from '../../utils/tooltips/InfoTooltip';
import {
  GRANULARITY_SELECTOR_CSS_PREFIX,
  injectGranularitySelectorStyles,
} from './styles';
import {
  DEFAULT_GRANULARITY_OPTIONS,
  Granularity,
  GranularitySelectorInstance,
  GranularitySelectorParams,
  GranularitySelectorSettings,
} from './types';

const P = GRANULARITY_SELECTOR_CSS_PREFIX;

const DEFAULT_TITLES: Record<Granularity, string> = { '1h': 'Hora', '1d': 'Dia' };

function isGranularity(v: unknown): v is Granularity {
  return v === '1h' || v === '1d';
}

export function createGranularitySelector(
  container: HTMLElement,
  params: GranularitySelectorParams = {}
): GranularitySelectorInstance {
  injectGranularitySelectorStyles();

  let settings: GranularitySelectorSettings = {
    value: '1d',
    themeMode: 'light',
    label: 'Granularidade:',
    ...(params.settings || {}),
  };
  let value: Granularity = isGranularity(settings.value) ? settings.value : '1d';
  let tooltipCleanup: (() => void) | null = null;
  let destroyed = false;

  const root = document.createElement('div');
  container.appendChild(root);

  const debug = (...args: unknown[]): void => {
    if (settings.enableDebugMode) console.log('[GranularitySelector]', ...args);
  };

  const syncActiveUI = (): void => {
    root.querySelectorAll<HTMLButtonElement>(`.${P}__btn`).forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.granularity === value);
    });
  };

  /** Aplica um novo valor. Retorna true se houve mudança real. */
  const applyValue = (next: Granularity, silent: boolean): boolean => {
    if (next === value) return false;
    value = next;
    syncActiveUI();
    debug('value ->', value);
    if (!silent && params.onChange) {
      // onChange pode ser async — falhas não podem quebrar a UI do seletor.
      Promise.resolve(params.onChange(value)).catch((err) => {
        console.warn('[GranularitySelector] onChange failed:', err);
      });
    }
    return true;
  };

  const handleClick = (e: Event): void => {
    const btn = e.currentTarget as HTMLButtonElement;
    if (destroyed || settings.disabled || btn.disabled) return;
    const next = btn.dataset.granularity;
    if (isGranularity(next)) applyValue(next, false);
  };

  const render = (): void => {
    tooltipCleanup?.();
    tooltipCleanup = null;

    const dark = settings.themeMode === 'dark';
    const disabled = !!settings.disabled;
    root.className = [
      P,
      dark ? `${P}--dark` : '',
      disabled ? `${P}--disabled` : '',
    ]
      .filter(Boolean)
      .join(' ');
    root.innerHTML = '';

    const labelText = settings.label ?? 'Granularidade:';
    if (labelText) {
      const label = document.createElement('span');
      label.className = `${P}__label`;
      label.textContent = labelText;
      root.appendChild(label);
    }

    const options =
      settings.options && settings.options.length > 0
        ? settings.options
        : DEFAULT_GRANULARITY_OPTIONS;

    for (const opt of options) {
      if (!isGranularity(opt.value)) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `${P}__btn${opt.value === value ? ' active' : ''}`;
      btn.dataset.granularity = opt.value;
      btn.title = opt.title || DEFAULT_TITLES[opt.value];
      btn.textContent = opt.label ?? opt.value;
      btn.disabled = disabled;
      btn.addEventListener('click', handleClick);
      root.appendChild(btn);
    }

    // Tooltip premium (InfoTooltip.attach) — recriado a cada render para
    // refletir settings. enabled=false (ou tooltip ausente) => sem tooltip.
    const tt = settings.tooltip;
    if (tt && tt.enabled !== false && tt.text) {
      tooltipCleanup = InfoTooltip.attach(root, () => ({
        icon: tt.icon || '🕒',
        title: tt.title || 'Granularidade',
        content: tt.text,
      }));
    }
  };

  render();

  return {
    element: root,
    getValue: () => value,
    setValue(next, opts) {
      if (destroyed || !isGranularity(next)) return;
      applyValue(next, opts?.silent === true);
    },
    setThemeMode(mode) {
      settings.themeMode = mode;
      root.classList.toggle(`${P}--dark`, mode === 'dark');
    },
    setDisabled(disabled) {
      settings.disabled = disabled;
      root.classList.toggle(`${P}--disabled`, disabled);
      root
        .querySelectorAll<HTMLButtonElement>(`.${P}__btn`)
        .forEach((btn) => (btn.disabled = disabled));
    },
    updateSettings(partial) {
      if (destroyed) return;
      settings = { ...settings, ...partial };
      if (isGranularity(partial.value)) value = partial.value;
      render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      tooltipCleanup?.();
      tooltipCleanup = null;
      // Listeners morrem com os botões ao remover o root.
      root.remove();
    },
  };
}
