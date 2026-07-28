import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createExportButton,
  createPdfButton,
  createCsvButton,
  createXlsButton,
  EXPORT_BUTTON_CSS_PREFIX,
} from '../../../src/components/buttons';

describe('export buttons factory', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders a pill button with kind label and MAN4 colors', () => {
    const btn = createPdfButton(container);
    expect(btn.kind).toBe('pdf');
    expect(btn.element.textContent).toContain('PDF');
    expect(btn.element.className).toContain(EXPORT_BUTTON_CSS_PREFIX);
    expect(btn.element.style.color).toBe('rgb(220, 38, 38)');
    expect(btn.element.style.borderColor).toBe('#fca5a5');
  });

  it('csv/xls kinds get their own default labels/colors', () => {
    const csv = createCsvButton(container);
    const xls = createXlsButton(container);
    expect(csv.element.textContent).toContain('CSV');
    expect(csv.element.style.color).toBe('rgb(29, 78, 216)');
    expect(xls.element.textContent).toContain('XLSX');
    expect(xls.element.style.color).toBe('rgb(22, 163, 74)');
  });

  it('fires onClick when enabled and never when disabled/locked', () => {
    const onClick = vi.fn();
    const btn = createExportButton('csv', container, { onClick });
    btn.element.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    btn.setDisabled(true);
    btn.element.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    btn.setDisabled(false);
    btn.setLocked(true);
    btn.element.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('locked state disables the button and shows the padlock', () => {
    const btn = createExportButton('xls', container, { settings: { locked: true } });
    expect(btn.element.disabled).toBe(true);
    expect(btn.element.innerHTML).toContain('🔒');
    expect(btn.element.className).toContain('--locked');
  });

  it('theme override merges over kind defaults per mode', () => {
    const btn = createExportButton('pdf', container, {
      settings: { colors: { light: { text: '#000000' } } },
    });
    expect(btn.element.style.color).toBe('rgb(0, 0, 0)');
    expect(btn.element.style.borderColor).toBe('#fca5a5'); // default preservado
  });

  it('setThemeMode switches to dark palette', () => {
    const btn = createExportButton('pdf', container, {});
    btn.setThemeMode('dark');
    expect(btn.element.style.color).toBe('rgb(252, 165, 165)');
  });

  it('destroy removes the element', () => {
    const btn = createExportButton('csv', container, {});
    btn.destroy();
    expect(container.querySelector('button')).toBeNull();
  });
});
