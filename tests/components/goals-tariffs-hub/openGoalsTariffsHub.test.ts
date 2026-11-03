/**
 * RFC-0241 — openGoalsTariffsHub unit tests.
 *
 * Covers: cards rendered only for provided handlers (ordering manage → compare →
 * tariffs), title/entity/description escaping, routing after close, async
 * handler rejection → onError, close on overlay/✕/Esc, onClose once, theme vars
 * applied, single instance.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openGoalsTariffsHub } from '../../../src/components/goals-tariffs-hub';

function getModal(): HTMLElement | null {
  return document.getElementById('myio-goals-tariffs-hub');
}
function cards(): HTMLButtonElement[] {
  return Array.from(getModal()?.querySelectorAll('.myio-gt-hub__card') ?? []);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
  getModal()?.remove();
  document.getElementById('myio-goals-tariffs-hub-styles')?.remove();
  delete (window as { MyIOUtils?: unknown }).MyIOUtils;
});

describe('openGoalsTariffsHub — rendering', () => {
  it('renders the three cards in order when all handlers are present', () => {
    openGoalsTariffsHub({ handlers: { tariffs: vi.fn(), manage: vi.fn(), compare: vi.fn() } });
    expect(cards().map((c) => c.dataset.area)).toEqual(['manage', 'compare', 'tariffs']);
    expect(getModal()!.querySelector('h3')!.textContent).toBe('🎯 Metas e Tarifas');
  });

  it('hides cards without a handler', () => {
    openGoalsTariffsHub({ handlers: { manage: vi.fn(), compare: vi.fn() } });
    expect(cards().map((c) => c.dataset.area)).toEqual(['manage', 'compare']);
  });

  it('uses entityLabel in the default manage description and escapes overrides/title', () => {
    openGoalsTariffsHub({
      title: '🎯 Metas <b>X</b>',
      entityLabel: 'loja',
      handlers: { manage: vi.fn(), compare: vi.fn() },
      descriptions: { compare: 'Comparar <i>tudo</i>' },
    });
    const [manage, compare] = cards();
    expect(manage.textContent).toContain('metas por loja');
    expect(compare.querySelector('i')).toBeNull();
    expect(compare.textContent).toContain('Comparar <i>tudo</i>');
    expect(getModal()!.querySelector('h3 b')).toBeNull();
  });

  it('applies theme CSS vars (explicit or MyIOUtils.theme fallback)', () => {
    openGoalsTariffsHub({ handlers: { manage: vi.fn() }, theme: { '--myio-brand-700': '#123456', color: 'red' } });
    expect(getModal()!.style.getPropertyValue('--myio-brand-700')).toBe('#123456');
    vi.runAllTimers();

    (window as { MyIOUtils?: unknown }).MyIOUtils = { theme: { cssVars: () => ({ '--myio-brand-700': '#abcdef' }) } };
    openGoalsTariffsHub({ handlers: { manage: vi.fn() } });
    expect(getModal()!.style.getPropertyValue('--myio-brand-700')).toBe('#abcdef');
  });

  it('replaces an existing picker instead of stacking', () => {
    openGoalsTariffsHub({ handlers: { manage: vi.fn() } });
    openGoalsTariffsHub({ handlers: { manage: vi.fn() } });
    expect(document.querySelectorAll('#myio-goals-tariffs-hub')).toHaveLength(1);
    expect(document.querySelectorAll('#myio-goals-tariffs-hub-styles')).toHaveLength(1);
  });
});

describe('openGoalsTariffsHub — routing & closing', () => {
  it('closes then calls only the clicked handler after the delay', () => {
    const handlers = { manage: vi.fn(), compare: vi.fn(), tariffs: vi.fn() };
    const onClose = vi.fn();
    openGoalsTariffsHub({ handlers, onClose });
    cards().find((c) => c.dataset.area === 'tariffs')!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(handlers.tariffs).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(handlers.tariffs).toHaveBeenCalledTimes(1);
    expect(handlers.manage).not.toHaveBeenCalled();
    expect(getModal()).toBeNull();
  });

  it('reports sync throws and async rejections through onError', async () => {
    const onError = vi.fn();
    const boom = new Error('boom');
    openGoalsTariffsHub({ handlers: { manage: () => { throw boom; } }, onError });
    cards()[0].click();
    vi.advanceTimersByTime(200);
    expect(onError).toHaveBeenCalledWith(boom, 'manage');

    const rej = new Error('rej');
    openGoalsTariffsHub({ handlers: { compare: () => Promise.reject(rej) }, onError });
    cards()[0].click();
    vi.advanceTimersByTime(200);
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(rej, 'compare');
  });

  it('closes on overlay, ✕ and Escape; onClose fires once; handle.close works', () => {
    const onClose = vi.fn();
    openGoalsTariffsHub({ handlers: { manage: vi.fn() }, onClose });
    (getModal()!.querySelector('.myio-gt-hub__overlay') as HTMLElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    vi.advanceTimersByTime(200);
    expect(getModal()).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);

    openGoalsTariffsHub({ handlers: { manage: vi.fn() } });
    (getModal()!.querySelector('.myio-gt-hub__close') as HTMLElement).click();
    vi.advanceTimersByTime(200);
    expect(getModal()).toBeNull();

    openGoalsTariffsHub({ handlers: { manage: vi.fn() } });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    vi.advanceTimersByTime(200);
    expect(getModal()).toBeNull();

    const h = openGoalsTariffsHub({ handlers: { manage: vi.fn() } });
    h.close();
    vi.advanceTimersByTime(200);
    expect(getModal()).toBeNull();
  });

  it('renders the premium footer when requested and destroys it on close', () => {
    const h = openGoalsTariffsHub({
      handlers: { manage: vi.fn() },
      footer: { customerName: 'Shopping A', libVersion: '0.1.575' },
    });
    const footer = getModal()!.querySelector('.myio-modal-footer-premium');
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toContain('Shopping A');
    // Fechar destrói o footer (relógio com setInterval) — senão runAllTimers nunca termina.
    h.close();
    vi.advanceTimersByTime(200);
    expect(getModal()).toBeNull();
  });
});
