// premium-modals/internal/report-mode-selector/ReportModeSelector.ts
// RFC-0223: thin wrapper composing the existing createGranularitySelector
// (Diário/Horário) unchanged, adding a Consolidado segment + one bounding
// role="radiogroup" region so all three read as a single mutually-exclusive
// choice-set. The shared granularity-selector primitive is never modified —
// this keeps EnergyModal (its other consumer) insulated from this feature.

import { createGranularitySelector } from '../../../granularity-selector';
import { REPORT_MODE_SELECTOR_CSS_PREFIX, injectReportModeSelectorStyles } from './styles';
import {
  ReportMode,
  ReportModeSelectorInstance,
  ReportModeSelectorParams,
  ReportModeSelectorSettings,
} from './types';

const P = REPORT_MODE_SELECTOR_CSS_PREFIX;

function isReportMode(v: unknown): v is ReportMode {
  return v === 'consolidado' || v === '1d' || v === '1h';
}

export function createReportModeSelector(
  container: HTMLElement,
  params: ReportModeSelectorParams = {}
): ReportModeSelectorInstance {
  injectReportModeSelectorStyles();

  const settings: ReportModeSelectorSettings = {
    value: 'consolidado',
    themeMode: 'light',
    label: 'Modo do relatório',
    helperText: 'Como o consumo é detalhado no relatório.',
    horarioEnabled: true,
    ...(params.settings || {}),
  };
  let mode: ReportMode =
    isReportMode(settings.value) && (settings.value !== '1h' || settings.horarioEnabled)
      ? settings.value
      : 'consolidado';
  let destroyed = false;

  const root = document.createElement('div');
  container.appendChild(root);
  root.className = [
    P,
    settings.themeMode === 'dark' ? `${P}--dark` : '',
    settings.disabled ? `${P}--disabled` : '',
  ]
    .filter(Boolean)
    .join(' ');
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', settings.label || 'Modo do relatório');

  if (settings.label) {
    const labelEl = document.createElement('span');
    labelEl.className = `${P}__label`;
    labelEl.textContent = settings.label;
    root.appendChild(labelEl);
  }

  const track = document.createElement('div');
  track.className = `${P}__track`;
  root.appendChild(track);

  const consolidadoBtn = document.createElement('button');
  consolidadoBtn.type = 'button';
  consolidadoBtn.className = `${P}__btn`;
  consolidadoBtn.dataset.mode = 'consolidado';
  consolidadoBtn.setAttribute('role', 'radio');
  consolidadoBtn.title = 'Consolidado';
  consolidadoBtn.textContent = 'Consolidado';
  consolidadoBtn.disabled = !!settings.disabled;
  track.appendChild(consolidadoBtn);

  const granMount = document.createElement('div');
  track.appendChild(granMount);

  // Composed unchanged: only the option labels are customized (Diário/Horário
  // instead of the default 1h/1d titles). Its own onChange is a no-op safety
  // net — handleTrackClick below owns every Consolidado<->1d/1h transition,
  // since the library's onChange only fires on an internal-value change and
  // would silently miss "switch away from Consolidado back to the same
  // internal value" (e.g. Consolidado -> Diário when internal value was
  // already '1d' from a prior session).
  // RFC-0223 delivery phases: Horário is omitted from the options array
  // entirely (not merely disabled) until P3 — "no dead control" means the
  // operator never sees a clickable segment that does nothing.
  const granularitySelector = createGranularitySelector(granMount, {
    settings: {
      value: mode === '1h' ? '1h' : '1d',
      label: '',
      themeMode: settings.themeMode,
      disabled: settings.disabled,
      options: settings.horarioEnabled
        ? [
            { value: '1d', label: 'Diário', title: 'Diário' },
            { value: '1h', label: 'Horário', title: 'Horário' },
          ]
        : [{ value: '1d', label: 'Diário', title: 'Diário' }],
    },
    onChange: () => {
      /* handled by handleTrackClick */
    },
  });

  if (settings.helperText) {
    const hint = document.createElement('div');
    hint.className = `${P}__hint`;
    hint.textContent = settings.helperText;
    root.appendChild(hint);
  }

  // Single source of truth for which of the 3 segments LOOKS active: our own
  // [aria-checked] attribute, driven by `mode` — never the nested selector's
  // internal .active class (neutralized in styles.ts), so Consolidado can be
  // "the active one" even while the nested selector still privately holds
  // value='1d'/'1h' from a previous non-Consolidado selection.
  const syncActiveUI = (): void => {
    consolidadoBtn.setAttribute('aria-checked', String(mode === 'consolidado'));
    granMount.querySelectorAll<HTMLButtonElement>('[data-granularity]').forEach((btn) => {
      const active = mode !== 'consolidado' && btn.dataset.granularity === mode;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(active));
    });
    if (mode !== 'consolidado') granularitySelector.setValue(mode, { silent: true });
  };
  syncActiveUI();

  /** Aplica um novo modo. Retorna true se houve mudança real. */
  const applyMode = (next: ReportMode, silent: boolean): boolean => {
    if (next === mode) return false;
    mode = next;
    syncActiveUI();
    if (!silent && params.onChange) {
      // onChange pode ser async — falhas não podem quebrar a UI do seletor.
      Promise.resolve(params.onChange(mode)).catch((err) => {
        console.warn('[ReportModeSelector] onChange failed:', err);
      });
    }
    return true;
  };

  const handleTrackClick = (e: MouseEvent): void => {
    if (destroyed || settings.disabled) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-mode="consolidado"]')) {
      applyMode('consolidado', false);
      return;
    }
    const granHit = target.closest<HTMLElement>('[data-granularity]');
    const next = granHit?.getAttribute('data-granularity');
    if (next === '1d' || next === '1h') applyMode(next, false);
  };
  track.addEventListener('click', handleTrackClick);

  return {
    element: root,
    getValue: () => mode,
    setValue(next, opts) {
      if (destroyed || !isReportMode(next)) return;
      if (next === '1h' && !settings.horarioEnabled) return; // P1: no dead control, no back door either
      applyMode(next, opts?.silent === true);
    },
    setThemeMode(next) {
      settings.themeMode = next;
      root.classList.toggle(`${P}--dark`, next === 'dark');
      granularitySelector.setThemeMode(next);
    },
    setDisabled(disabled) {
      settings.disabled = disabled;
      root.classList.toggle(`${P}--disabled`, disabled);
      consolidadoBtn.disabled = disabled;
      granularitySelector.setDisabled(disabled);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      track.removeEventListener('click', handleTrackClick);
      granularitySelector.destroy();
      root.remove();
    },
  };
}
