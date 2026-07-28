import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createModalFooter } from '../../../src/components/premium-modals/footer-modal';
import { createRealTimeClock } from '../../../src/components/clock';

describe('createRealTimeClock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders time and updates every second', () => {
    const host = document.createElement('div');
    const clock = createRealTimeClock(host, { icon: '' });
    const first = clock.element.textContent;
    expect(first).toMatch(/\d{2}:\d{2}:\d{2}/);
    vi.setSystemTime(Date.now() + 61_000);
    vi.advanceTimersByTime(1000);
    expect(clock.element.textContent).not.toBe(first);
    clock.destroy();
    expect(host.querySelector('.myio-realtime-clock')).toBeNull();
  });
});

describe('createModalFooter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders customer name, powered-by text and requested export buttons', () => {
    const onPdf = vi.fn();
    const footer = createModalFooter({
      customerName: 'Shopping Moxuara',
      libVersion: false,
      exports: {
        pdf: { onClick: onPdf },
        csv: { onClick: vi.fn() },
      },
    });
    document.body.appendChild(footer.element);

    expect(footer.element.textContent).toContain('Shopping Moxuara');
    expect(footer.element.textContent).toContain('Powered by MYIO Platform');
    expect(footer.buttons.pdf).toBeDefined();
    expect(footer.buttons.csv).toBeDefined();
    expect(footer.buttons.xls).toBeUndefined();

    footer.buttons.pdf!.element.click();
    expect(onPdf).toHaveBeenCalledTimes(1);
    footer.destroy();
  });

  it('setExportDisabled toggles the button', () => {
    const footer = createModalFooter({
      libVersion: false,
      exports: { csv: { onClick: vi.fn(), disabled: true } },
    });
    expect(footer.buttons.csv!.element.disabled).toBe(true);
    footer.setExportDisabled('csv', false);
    expect(footer.buttons.csv!.element.disabled).toBe(false);
    footer.destroy();
  });

  it('locked export renders padlock and never fires', () => {
    const onXls = vi.fn();
    const footer = createModalFooter({
      libVersion: false,
      exports: { xls: { onClick: onXls, locked: true, tooltipText: 'Recurso bloqueado' } },
    });
    const btn = footer.buttons.xls!.element;
    expect(btn.disabled).toBe(true);
    expect(btn.innerHTML).toContain('🔒');
    btn.click();
    expect(onXls).not.toHaveBeenCalled();
    footer.destroy();
  });

  it('setThemeMode propagates to buttons', () => {
    const footer = createModalFooter({
      libVersion: false,
      exports: { pdf: { onClick: vi.fn() } },
    });
    footer.setThemeMode('dark');
    expect(footer.buttons.pdf!.getSettings().themeMode).toBe('dark');
    footer.destroy();
  });
});
