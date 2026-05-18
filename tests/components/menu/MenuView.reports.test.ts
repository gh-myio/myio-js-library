/**
 * RFC-0181 / RFC-0201 Phase-2 #19 — Reports submenu tests for MenuView.
 *
 * Covers AC-RFC-0181-1: clicking a Reports → "Lojas" item fires the
 * `onReportsClick` callback with `'lojas'`.
 *
 * The MenuView is rendered into the JSDOM document (via the global setup)
 * and clicked programmatically — no actual ThingsBoard widget context is
 * required.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MenuView } from '../../../src/components/menu/MenuView';

describe('MenuView — Reports submenu (RFC-0181 / RFC-0201 Phase-2 #19)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders the Reports button by default', () => {
    const view = new MenuView({ container });
    container.appendChild(view.render());

    const reportsBtn = container.querySelector('#menuReportsBtn');
    expect(reportsBtn).not.toBeNull();
  });

  it('does not render the Reports button when showReportsButton=false', () => {
    const view = new MenuView({ container, showReportsButton: false });
    container.appendChild(view.render());

    expect(container.querySelector('#menuReportsBtn')).toBeNull();
  });

  it('opens and closes the Reports submenu on button click', () => {
    const view = new MenuView({ container });
    container.appendChild(view.render());

    const reportsBtn = container.querySelector('#menuReportsBtn') as HTMLButtonElement;
    const reportsMenu = container.querySelector('#menuReportsMenu') as HTMLElement;

    expect(reportsMenu.classList.contains('is-open')).toBe(false);

    reportsBtn.click();
    expect(reportsMenu.classList.contains('is-open')).toBe(true);
    expect(reportsBtn.getAttribute('aria-expanded')).toBe('true');

    reportsBtn.click();
    expect(reportsMenu.classList.contains('is-open')).toBe(false);
    expect(reportsBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('AC-RFC-0181-1: emits reports-click with `lojas` when "Lojas" is clicked', () => {
    const view = new MenuView({ container });
    container.appendChild(view.render());

    const captured: { group: string; domain?: string }[] = [];
    view.on('reports-click', (data: unknown) => {
      captured.push(data as { group: string; domain?: string });
    });

    // Open the submenu (some browsers may not require this — JSDOM renders display:none
    // until the class is added; click handler doesn't gate emission on `.is-open`).
    const reportsBtn = container.querySelector('#menuReportsBtn') as HTMLButtonElement;
    reportsBtn.click();

    // Click the Energy → Lojas item
    const lojasItem = container.querySelector(
      '[data-reports-item="true"][data-domain="energy"][data-group="lojas"]',
    ) as HTMLButtonElement;

    expect(lojasItem).not.toBeNull();

    lojasItem.click();

    expect(captured.length).toBe(1);
    expect(captured[0].group).toBe('lojas');
    expect(captured[0].domain).toBe('energy');
  });

  it('emits reports-click with the correct group for water/banheiros', () => {
    const view = new MenuView({ container });
    container.appendChild(view.render());

    const spy = vi.fn();
    view.on('reports-click', spy);

    const banheirosItem = container.querySelector(
      '[data-reports-item="true"][data-domain="water"][data-group="banheiros"]',
    ) as HTMLButtonElement;

    expect(banheirosItem).not.toBeNull();
    banheirosItem.click();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ group: 'banheiros', domain: 'water' });
  });

  it('emits reports-click with `climatizavel` for temperature → Climatizáveis', () => {
    const view = new MenuView({ container });
    container.appendChild(view.render());

    const spy = vi.fn();
    view.on('reports-click', spy);

    const item = container.querySelector(
      '[data-reports-item="true"][data-domain="temperature"][data-group="climatizavel"]',
    ) as HTMLButtonElement;

    item.click();

    expect(spy).toHaveBeenCalledWith({ group: 'climatizavel', domain: 'temperature' });
  });

  it('closes the submenu after item selection', () => {
    const view = new MenuView({ container });
    container.appendChild(view.render());

    const reportsBtn = container.querySelector('#menuReportsBtn') as HTMLButtonElement;
    const reportsMenu = container.querySelector('#menuReportsMenu') as HTMLElement;

    reportsBtn.click();
    expect(reportsMenu.classList.contains('is-open')).toBe(true);

    const lojasItem = container.querySelector(
      '[data-reports-item="true"][data-domain="energy"][data-group="lojas"]',
    ) as HTMLButtonElement;
    lojasItem.click();

    expect(reportsMenu.classList.contains('is-open')).toBe(false);
  });
});
