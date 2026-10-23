import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSidebarMenu } from '../../src/components/sidebar-menu';

describe('Sidebar Reports Hub navigation', () => {
  let menu: ReturnType<typeof createSidebarMenu> | null = null;

  afterEach(() => {
    menu?.destroy();
    menu = null;
    document.body.innerHTML = '';
  });

  it('keeps the current page active when the modal-only Relatórios item is clicked', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onItemClick = vi.fn();
    menu = createSidebarMenu(host, {
      sections: [
        {
          id: 'navigation',
          items: [
            { id: 'dashboard', label: 'Dashboard', icon: 'home' },
            { id: 'reports', label: 'Relatórios', icon: 'chart' },
            { id: 'ambiente:floor-1', label: 'Pavimento 1', icon: 'building' },
          ],
        },
      ],
      onItemClick,
    });
    menu.setActiveItem('ambiente:floor-1');

    host.querySelector<HTMLElement>('[data-item-id="reports"]')!.click();

    expect(onItemClick).toHaveBeenCalledOnce();
    expect(menu.getActiveItem()).toBe('ambiente:floor-1');
    expect(host.querySelector('[data-item-id="reports"]')?.getAttribute('aria-current')).toBe('false');
  });
});
