/**
 * RFC-0173: Sidebar Menu Controller
 * State management and high-level API for the sidebar menu
 */

import { SidebarMenuView } from './SidebarMenuView';
import type {
  SidebarMenuConfig,
  SidebarMenuSection,
  SidebarMenuInstance,
  SidebarState,
  SidebarThemeMode,
} from './types';

export class SidebarMenuController implements SidebarMenuInstance {
  private view: SidebarMenuView;
  private config: SidebarMenuConfig;

  constructor(container: HTMLElement, config: SidebarMenuConfig) {
    this.config = config;
    this.view = new SidebarMenuView(container, config);
  }

  getElement(): HTMLElement {
    return this.view.getElement();
  }

  expand(): void {
    this.view.expand();
  }

  collapse(): void {
    this.view.collapse();
  }

  toggle(): void {
    this.view.toggle();
  }

  getState(): SidebarState {
    return this.view.getState();
  }

  setThemeMode(mode: SidebarThemeMode): void {
    this.view.setThemeMode(mode);
  }

  updateSections(sections: SidebarMenuSection[]): void {
    this.config.sections = sections;
    this.view.updateSections(sections);
  }

  updateItemBadge(itemId: string, badge: number | string | null): void {
    this.view.updateItemBadge(itemId, badge);
  }

  setActiveItem(itemId: string | null): void {
    this.view.setActiveItem(itemId);
  }

  getActiveItem(): string | null {
    return this.view.getActiveItem();
  }

  destroy(): void {
    this.view.destroy();
  }
}

/**
 * Factory function to create a sidebar menu instance
 */
export function createSidebarMenu(
  container: HTMLElement | string,
  config: SidebarMenuConfig
): SidebarMenuInstance {
  let containerEl: HTMLElement;

  if (typeof container === 'string') {
    const el = document.querySelector(container);
    if (!el) {
      throw new Error(`[SidebarMenu] Container not found: ${container}`);
    }
    containerEl = el as HTMLElement;
  } else {
    containerEl = container;
  }

  return new SidebarMenuController(containerEl, config);
}
