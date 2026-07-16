import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createReportModeSelector,
  REPORT_MODE_SELECTOR_CSS_PREFIX,
} from '../../../../src/components/premium-modals/internal/report-mode-selector';

const P = REPORT_MODE_SELECTOR_CSS_PREFIX;

function getConsolidadoBtn(root: HTMLElement): HTMLButtonElement {
  return root.querySelector<HTMLButtonElement>('[data-mode="consolidado"]')!;
}

function getGranBtns(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('[data-granularity]'));
}

function checkedValues(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[role="radio"][aria-checked="true"]')).map(
    (el) => el.getAttribute('data-mode') || el.getAttribute('data-granularity') || ''
  );
}

describe('report mode selector factory (RFC-0223)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders defaults: radiogroup with Consolidado | Diário | Horário, Consolidado active', () => {
    const sel = createReportModeSelector(container, {});
    expect(sel.element.className).toContain(P);
    expect(sel.element.getAttribute('role')).toBe('radiogroup');
    expect(sel.element.querySelector(`.${P}__label`)?.textContent).toBe('Modo do relatório');
    expect(sel.element.querySelector(`.${P}__hint`)?.textContent).toBe(
      'Como o consumo é detalhado no relatório.'
    );

    const gran = getGranBtns(sel.element);
    expect(gran.map((b) => b.textContent)).toEqual(['Diário', 'Horário']);

    expect(sel.getValue()).toBe('consolidado');
    expect(checkedValues(sel.element)).toEqual(['consolidado']);
  });

  it('honors initial value from settings (1d / 1h)', () => {
    const sel = createReportModeSelector(container, { settings: { value: '1h' } });
    expect(sel.getValue()).toBe('1h');
    expect(checkedValues(sel.element)).toEqual(['1h']);
  });

  it('exactly one segment is checked at all times across every transition', () => {
    const sel = createReportModeSelector(container, {});
    const consolidado = getConsolidadoBtn(sel.element);
    const [diario, horario] = getGranBtns(sel.element);

    diario.click();
    expect(checkedValues(sel.element)).toEqual(['1d']);
    horario.click();
    expect(checkedValues(sel.element)).toEqual(['1h']);
    consolidado.click();
    expect(checkedValues(sel.element)).toEqual(['consolidado']);
  });

  it('click changes mode and fires onChange exactly once; re-clicking the active one is a no-op', () => {
    const onChange = vi.fn();
    const sel = createReportModeSelector(container, { onChange });
    const [diario] = getGranBtns(sel.element);

    diario.click();
    expect(sel.getValue()).toBe('1d');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('1d');

    diario.click();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('detects Consolidado -> Diário even when the nested granularity-selector already privately holds value=1d', () => {
    // Mounted starting at '1d' means the nested selector's OWN internal value is
    // already '1d'. Switching to Consolidado only changes OUR wrapper's mode —
    // the nested selector's internal value is untouched. Clicking "Diário" again
    // must still fire a real mode change (consolidado -> 1d) even though the
    // nested library would consider this a no-op by its own internal value.
    const onChange = vi.fn();
    const sel = createReportModeSelector(container, { settings: { value: '1d' }, onChange });
    const consolidado = getConsolidadoBtn(sel.element);
    const [diario] = getGranBtns(sel.element);

    consolidado.click();
    expect(sel.getValue()).toBe('consolidado');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('consolidado');

    diario.click();
    expect(sel.getValue()).toBe('1d');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(2, '1d');
    expect(checkedValues(sel.element)).toEqual(['1d']);
  });

  it('setValue with silent updates UI without firing onChange; non-silent fires', () => {
    const onChange = vi.fn();
    const sel = createReportModeSelector(container, { onChange });

    sel.setValue('1h', { silent: true });
    expect(sel.getValue()).toBe('1h');
    expect(checkedValues(sel.element)).toEqual(['1h']);
    expect(onChange).not.toHaveBeenCalled();

    sel.setValue('consolidado');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('consolidado');

    sel.setValue('consolidado');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('disabled blocks clicks (initial setting and setDisabled toggle)', () => {
    const onChange = vi.fn();
    const sel = createReportModeSelector(container, { settings: { disabled: true }, onChange });
    const [diario] = getGranBtns(sel.element);
    expect(sel.element.className).toContain(`${P}--disabled`);
    expect(getConsolidadoBtn(sel.element).disabled).toBe(true);

    diario.click();
    expect(onChange).not.toHaveBeenCalled();
    expect(sel.getValue()).toBe('consolidado');

    sel.setDisabled(false);
    diario.click();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(sel.getValue()).toBe('1d');

    sel.setDisabled(true);
    getConsolidadoBtn(sel.element).click();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(sel.getValue()).toBe('1d');
  });

  it('setThemeMode toggles the dark modifier and propagates to the nested selector', () => {
    const sel = createReportModeSelector(container, {});
    expect(sel.element.classList.contains(`${P}--dark`)).toBe(false);

    sel.setThemeMode('dark');
    expect(sel.element.classList.contains(`${P}--dark`)).toBe(true);

    sel.setThemeMode('light');
    expect(sel.element.classList.contains(`${P}--dark`)).toBe(false);
  });

  it('injects styles idempotently', () => {
    createReportModeSelector(container, {});
    createReportModeSelector(container, {});
    const tags = document.querySelectorAll('#myio-report-mode-selector-styles');
    expect(tags.length).toBe(1);
  });

  it('destroy removes the element (and the nested granularity-selector) and neutralizes further API calls', () => {
    const onChange = vi.fn();
    const sel = createReportModeSelector(container, { onChange });
    const el = sel.element;
    expect(container.contains(el)).toBe(true);

    sel.destroy();
    expect(container.contains(el)).toBe(false);
    expect(container.querySelector(`.${P}`)).toBeNull();

    expect(() => {
      sel.setValue('1h');
      sel.destroy();
    }).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('report mode selector — RFC-0223 delivery phases (horarioEnabled)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('horarioEnabled: false (P1) renders only Consolidado + Diário — no dead Horário control', () => {
    const sel = createReportModeSelector(container, { settings: { horarioEnabled: false } });
    const gran = getGranBtns(sel.element);
    expect(gran.map((b) => b.textContent)).toEqual(['Diário']);
    expect(sel.element.querySelector('[data-granularity="1h"]')).toBeNull();
  });

  it('horarioEnabled: false ignores an initial value of 1h, falling back to Consolidado', () => {
    const sel = createReportModeSelector(container, {
      settings: { horarioEnabled: false, value: '1h' },
    });
    expect(sel.getValue()).toBe('consolidado');
  });

  it('horarioEnabled: false makes setValue("1h") a no-op (no back door once the control is hidden)', () => {
    const onChange = vi.fn();
    const sel = createReportModeSelector(container, { settings: { horarioEnabled: false }, onChange });
    sel.setValue('1h');
    expect(sel.getValue()).toBe('consolidado');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('defaults to horarioEnabled: true when the caller omits the flag (component stays generically 3-way capable)', () => {
    const sel = createReportModeSelector(container, {});
    const gran = getGranBtns(sel.element);
    expect(gran.map((b) => b.textContent)).toEqual(['Diário', 'Horário']);
  });
});
