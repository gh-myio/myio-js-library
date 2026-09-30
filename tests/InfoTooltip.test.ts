/**
 * InfoTooltip — hover = passive (never captures the pointer), click = interactive.
 *
 * Regression tests for the hover defect measured on the ingestion dashboard:
 * a visible (or closing) tooltip with `pointer-events: auto` sat over the
 * neighbouring triggers and swallowed their mouseenter.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InfoTooltip } from '../src/utils/InfoTooltip';

const HIDE_DELAY_MS = 2500;
const CLOSE_ANIMATION_MS = 400;

function makeTrigger(id: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
  return el;
}

function container(): HTMLElement | null {
  return document.getElementById(InfoTooltip.containerId);
}

const options = (title = 'T') => ({ icon: 'i', title, content: `<p>${title}</p>` });

/** Extract one CSS rule block from the injected stylesheet. */
function cssRule(selector: string): string {
  const style = document.getElementById('myio-info-tooltip-styles');
  expect(style).not.toBeNull();
  const css = style!.textContent || '';
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(match, `rule ${selector} not found`).not.toBeNull();
  return match![1];
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  InfoTooltip.destroy();
  vi.useRealTimers();
});

describe('InfoTooltip.attach', () => {
  it('mouseenter shows a passive tooltip (visible + passive)', () => {
    const trigger = makeTrigger('t1');
    const cleanup = InfoTooltip.attach(trigger, () => options('hover'));

    trigger.dispatchEvent(new MouseEvent('mouseenter'));

    const c = container()!;
    expect(c.classList.contains('visible')).toBe(true);
    expect(c.classList.contains('passive')).toBe(true);
    expect(c.textContent).toContain('hover');

    cleanup();
    expect(c.classList.contains('visible')).toBe(false);
  });

  it('click shows the interactive tooltip (no passive) and cancels a pending hide', () => {
    vi.useFakeTimers();
    const trigger = makeTrigger('t1');
    InfoTooltip.attach(trigger, () => options('click'));

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    trigger.dispatchEvent(new MouseEvent('mouseleave')); // schedules hide in HIDE_DELAY_MS
    vi.advanceTimersByTime(HIDE_DELAY_MS - 100);

    trigger.dispatchEvent(new MouseEvent('click'));
    const c = container()!;
    expect(c.classList.contains('visible')).toBe(true);
    expect(c.classList.contains('passive')).toBe(false);

    // The hide scheduled by mouseleave must have been cancelled by the click
    vi.advanceTimersByTime(HIDE_DELAY_MS + CLOSE_ANIMATION_MS);
    expect(c.classList.contains('visible')).toBe(true);
    expect(c.classList.contains('closing')).toBe(false);
  });

  it('hoverInteractive: true restores the legacy hover-interactive behaviour', () => {
    const trigger = makeTrigger('t1');
    InfoTooltip.attach(trigger, () => options('legacy'), { hoverInteractive: true });

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    const c = container()!;
    expect(c.classList.contains('visible')).toBe(true);
    expect(c.classList.contains('passive')).toBe(false);
  });

  it('cleanup removes the click listener too', () => {
    const trigger = makeTrigger('t1');
    const cleanup = InfoTooltip.attach(trigger, () => options('x'));
    cleanup();

    trigger.dispatchEvent(new MouseEvent('click'));
    const c = container();
    expect(c === null || !c.classList.contains('visible')).toBe(true);
  });
});

describe('InfoTooltip.show — passive class never leaks between tooltips', () => {
  it('show(el, { interactive: false }) adds passive; a following default show() removes it', () => {
    const a = makeTrigger('a');
    const b = makeTrigger('b');

    InfoTooltip.show(a, { ...options('A'), interactive: false });
    const c = container()!;
    expect(c.classList.contains('passive')).toBe(true);
    expect(c.classList.contains('visible')).toBe(true);

    InfoTooltip.show(b, options('B'));
    expect(c.classList.contains('passive')).toBe(false);
    expect(c.classList.contains('visible')).toBe(true);
    expect(c.textContent).toContain('B');
  });

  it('passive tooltip installs no container hover/drag handlers; interactive one does', () => {
    const a = makeTrigger('a');

    InfoTooltip.show(a, { ...options('A'), interactive: false });
    const c = container()!;
    expect(c.onmouseenter).toBeNull();
    expect(c.onmouseleave).toBeNull();
    expect((c.querySelector('[data-drag-handle]') as HTMLElement).onmousedown).toBeNull();

    InfoTooltip.show(a, options('A'));
    expect(typeof c.onmouseenter).toBe('function');
    expect(typeof c.onmouseleave).toBe('function');
    expect(typeof (c.querySelector('[data-drag-handle]') as HTMLElement).onmousedown).toBe('function');
  });

  it('a stale isMouseOverTooltip does not keep a passive tooltip alive', () => {
    vi.useFakeTimers();
    const a = makeTrigger('a');

    // Interactive tooltip, mouse enters it (sets isMouseOverTooltip = true)
    InfoTooltip.show(a, options('A'));
    const c = container()!;
    c.onmouseenter!(new MouseEvent('mouseenter'));

    // Now a passive tooltip is shown and asked to hide
    InfoTooltip.show(a, { ...options('A'), interactive: false });
    InfoTooltip.startDelayedHide();
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    expect(c.classList.contains('closing')).toBe(true);
  });
});

describe('InfoTooltip CSS — closing/passive never capture the pointer', () => {
  it('injects .closing and .passive with pointer-events: none', () => {
    InfoTooltip.getContainer();

    expect(cssRule('.myio-info-tooltip.closing')).toMatch(/pointer-events:\s*none/);
    expect(cssRule('.myio-info-tooltip.passive')).toMatch(/pointer-events:\s*none/);
  });

  it('declares .passive after .visible so it wins at equal specificity', () => {
    InfoTooltip.getContainer();
    const css = document.getElementById('myio-info-tooltip-styles')!.textContent || '';
    expect(css.indexOf('.myio-info-tooltip.passive')).toBeGreaterThan(
      css.indexOf('.myio-info-tooltip.visible')
    );
  });
});

describe('InfoTooltip hide timers', () => {
  it('startDelayedHide → closing after HIDE_DELAY_MS; a show() during the fade-out is NOT wiped', () => {
    vi.useFakeTimers();
    const a = makeTrigger('a');
    const b = makeTrigger('b');

    InfoTooltip.show(a, options('A'));
    InfoTooltip.startDelayedHide();

    vi.advanceTimersByTime(HIDE_DELAY_MS);
    const c = container()!;
    expect(c.classList.contains('closing')).toBe(true);

    // 100 ms into the 400 ms fade-out, a new tooltip is shown
    vi.advanceTimersByTime(100);
    InfoTooltip.show(b, options('B'));
    expect(c.classList.contains('visible')).toBe(true);
    expect(c.classList.contains('closing')).toBe(false);

    // The old (untracked before) timeout would fire here and wipe the content
    vi.advanceTimersByTime(CLOSE_ANIMATION_MS);
    expect(c.classList.contains('visible')).toBe(true);
    expect(c.innerHTML).not.toBe('');
    expect(c.textContent).toContain('B');
  });

  it('the fade-out completes normally when nothing interrupts it', () => {
    vi.useFakeTimers();
    const a = makeTrigger('a');

    InfoTooltip.show(a, options('A'));
    InfoTooltip.startDelayedHide();
    vi.advanceTimersByTime(HIDE_DELAY_MS + CLOSE_ANIMATION_MS);

    const c = container()!;
    expect(c.classList.contains('visible')).toBe(false);
    expect(c.classList.contains('closing')).toBe(false);
    expect(c.innerHTML).toBe('');
  });
});

describe('InfoTooltip scroll', () => {
  it('a passive tooltip hides on window scroll', () => {
    const a = makeTrigger('a');
    InfoTooltip.show(a, { ...options('A'), interactive: false });
    const c = container()!;
    expect(c.classList.contains('visible')).toBe(true);

    window.dispatchEvent(new Event('scroll'));
    expect(c.classList.contains('visible')).toBe(false);
    expect(c.classList.contains('passive')).toBe(false);
  });

  it('an interactive tooltip stays on window scroll', () => {
    const a = makeTrigger('a');
    InfoTooltip.show(a, options('A'));
    const c = container()!;

    window.dispatchEvent(new Event('scroll'));
    expect(c.classList.contains('visible')).toBe(true);
  });

  it('the scroll listener is removed once the passive tooltip is gone', () => {
    const a = makeTrigger('a');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    InfoTooltip.show(a, { ...options('A'), interactive: false });
    InfoTooltip.hide();

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    removeSpy.mockRestore();

    // Re-showing interactive after a passive one: scroll must not hide it
    InfoTooltip.show(a, options('A'));
    window.dispatchEvent(new Event('scroll'));
    expect(container()!.classList.contains('visible')).toBe(true);
  });
});
