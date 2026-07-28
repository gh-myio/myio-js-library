import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createGranularitySelector,
  GRANULARITY_SELECTOR_CSS_PREFIX,
} from '../../../src/components/granularity-selector';

const P = GRANULARITY_SELECTOR_CSS_PREFIX;

function getButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>(`.${P}__btn`));
}

describe('granularity selector factory', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders defaults: label + 1h/1d tabs (EnergyModal order) with 1d active', () => {
    const sel = createGranularitySelector(container, {});
    expect(sel.element.className).toContain(P);
    expect(sel.element.querySelector(`.${P}__label`)?.textContent).toBe('Granularidade:');

    const buttons = getButtons(sel.element);
    expect(buttons.map((b) => b.textContent)).toEqual(['1h', '1d']);
    expect(buttons.map((b) => b.title)).toEqual(['Hora', 'Dia']);
    expect(buttons.map((b) => b.dataset.granularity)).toEqual(['1h', '1d']);

    expect(sel.getValue()).toBe('1d');
    expect(buttons[1].classList.contains('active')).toBe(true);
    expect(buttons[0].classList.contains('active')).toBe(false);
  });

  it('honors initial value from settings', () => {
    const sel = createGranularitySelector(container, { settings: { value: '1h' } });
    expect(sel.getValue()).toBe('1h');
    const [h, d] = getButtons(sel.element);
    expect(h.classList.contains('active')).toBe(true);
    expect(d.classList.contains('active')).toBe(false);
  });

  it('click changes value, moves the active class and fires onChange exactly once', () => {
    const onChange = vi.fn();
    const sel = createGranularitySelector(container, { onChange });
    const [h, d] = getButtons(sel.element);

    h.click();
    expect(sel.getValue()).toBe('1h');
    expect(h.classList.contains('active')).toBe(true);
    expect(d.classList.contains('active')).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('1h');

    // Clicking the already-active tab is a no-op (onChange only on real change)
    h.click();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('setValue with silent updates UI without firing onChange; non-silent fires', () => {
    const onChange = vi.fn();
    const sel = createGranularitySelector(container, { onChange });

    sel.setValue('1h', { silent: true });
    expect(sel.getValue()).toBe('1h');
    expect(getButtons(sel.element)[0].classList.contains('active')).toBe(true);
    expect(onChange).not.toHaveBeenCalled();

    sel.setValue('1d');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('1d');

    // Same value again → no onChange
    sel.setValue('1d');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('disabled blocks clicks (initial setting and setDisabled toggle)', () => {
    const onChange = vi.fn();
    const sel = createGranularitySelector(container, {
      settings: { disabled: true },
      onChange,
    });
    const [h] = getButtons(sel.element);
    expect(sel.element.className).toContain(`${P}--disabled`);
    expect(h.disabled).toBe(true);

    h.click();
    expect(onChange).not.toHaveBeenCalled();
    expect(sel.getValue()).toBe('1d');

    sel.setDisabled(false);
    expect(sel.element.className).not.toContain(`${P}--disabled`);
    getButtons(sel.element)[0].click();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(sel.getValue()).toBe('1h');

    sel.setDisabled(true);
    getButtons(sel.element)[1].click();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(sel.getValue()).toBe('1h');
  });

  it('setThemeMode toggles the dark modifier class', () => {
    const sel = createGranularitySelector(container, {});
    expect(sel.element.classList.contains(`${P}--dark`)).toBe(false);

    sel.setThemeMode('dark');
    expect(sel.element.classList.contains(`${P}--dark`)).toBe(true);

    sel.setThemeMode('light');
    expect(sel.element.classList.contains(`${P}--dark`)).toBe(false);
  });

  it('supports themeMode dark at creation and custom options/labels', () => {
    const sel = createGranularitySelector(container, {
      settings: {
        themeMode: 'dark',
        label: 'Resolução:',
        options: [
          { value: '1d', label: 'Dia', title: 'Diário' },
          { value: '1h', label: 'Hora', title: 'Horário' },
        ],
      },
    });
    expect(sel.element.classList.contains(`${P}--dark`)).toBe(true);
    expect(sel.element.querySelector(`.${P}__label`)?.textContent).toBe('Resolução:');
    const buttons = getButtons(sel.element);
    expect(buttons.map((b) => b.textContent)).toEqual(['Dia', 'Hora']);
    expect(buttons.map((b) => b.title)).toEqual(['Diário', 'Horário']);
  });

  it('updateSettings re-renders (value, label, disabled) without firing onChange', () => {
    const onChange = vi.fn();
    const sel = createGranularitySelector(container, { onChange });

    sel.updateSettings({ value: '1h', label: '', disabled: true });
    expect(sel.getValue()).toBe('1h');
    expect(sel.element.querySelector(`.${P}__label`)).toBeNull();
    expect(getButtons(sel.element)[0].classList.contains('active')).toBe(true);
    expect(getButtons(sel.element)[0].disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('injects styles idempotently', () => {
    createGranularitySelector(container, {});
    createGranularitySelector(container, {});
    const tags = document.querySelectorAll('#myio-granularity-selector-styles');
    expect(tags.length).toBe(1);
  });

  it('destroy removes the element and neutralizes further API calls', () => {
    const onChange = vi.fn();
    const sel = createGranularitySelector(container, { onChange });
    const el = sel.element;
    expect(container.contains(el)).toBe(true);

    sel.destroy();
    expect(container.contains(el)).toBe(false);
    expect(container.querySelector(`.${P}`)).toBeNull();

    // Post-destroy calls are safe no-ops
    expect(() => {
      sel.setValue('1h');
      sel.destroy();
    }).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});
