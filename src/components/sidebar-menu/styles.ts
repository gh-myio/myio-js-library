/**
 * RFC-0173: Sidebar Menu Styles
 * CSS-in-JS for the premium retractable sidebar menu
 */

export const SIDEBAR_MENU_CSS_PREFIX = 'myio-sidebar';

let stylesInjected = false;

export function injectSidebarMenuStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = `${SIDEBAR_MENU_CSS_PREFIX}-styles`;
  style.textContent = `
    /* =====================================================
       RFC-0173: Premium Sidebar Menu
       ===================================================== */

    .${SIDEBAR_MENU_CSS_PREFIX} {
      --sidebar-expanded-width: 260px;
      --sidebar-collapsed-width: 64px;
      --sidebar-transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      --sidebar-primary: #2F5848;
      --sidebar-primary-light: #3d7a62;

      position: relative;
      display: flex;
      flex-direction: column;
      width: var(--sidebar-expanded-width);
      height: 100%;
      background: #ffffff;
      border-right: 1px solid #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: width var(--sidebar-transition);
      overflow: hidden;
      z-index: 100;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed {
      width: var(--sidebar-collapsed-width);
    }

    /* ===== Header ===== */
    .${SIDEBAR_MENU_CSS_PREFIX}__header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: linear-gradient(135deg, var(--sidebar-primary) 0%, var(--sidebar-primary-light) 100%);
      color: #ffffff;
      min-height: 64px;
      flex-shrink: 0;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__logo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      color: #ffffff;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__logo svg {
      width: 32px;
      height: 32px;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__header-text {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 1;
      transition: opacity 0.2s ease;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__header-text {
      opacity: 0;
      width: 0;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__title {
      font-size: 16px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__subtitle {
      font-size: 11px;
      opacity: 0.8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      margin-left: auto;
      background: rgba(255, 255, 255, 0.15);
      border: none;
      border-radius: 6px;
      color: #ffffff;
      cursor: pointer;
      transition: background 0.2s ease;
      flex-shrink: 0;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__toggle:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__toggle {
      margin-left: 0;
    }

    /* ===== Search ===== */
    .${SIDEBAR_MENU_CSS_PREFIX}__search {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__search-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px 12px;
      transition: all 0.2s ease;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__search-wrapper:focus-within {
      border-color: var(--sidebar-primary);
      box-shadow: 0 0 0 3px rgba(47, 88, 72, 0.1);
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__search-icon {
      display: flex;
      color: #9ca3af;
      flex-shrink: 0;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__search-input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 14px;
      color: #374151;
      outline: none;
      min-width: 0;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__search-input::placeholder {
      color: #9ca3af;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__search-wrapper {
      padding: 8px;
      justify-content: center;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__search-input {
      display: none;
    }

    /* ===== Content ===== */
    .${SIDEBAR_MENU_CSS_PREFIX}__content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px 0;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__content::-webkit-scrollbar {
      width: 4px;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__content::-webkit-scrollbar-track {
      background: transparent;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__content::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 2px;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__content::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }

    /* ===== Section ===== */
    .${SIDEBAR_MENU_CSS_PREFIX}__section {
      margin-bottom: 8px;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      font-size: 11px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: default;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__section-header {
      justify-content: center;
      padding: 8px;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__section-title {
      display: none;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__section-toggle {
      display: flex;
      color: #9ca3af;
      cursor: pointer;
      transition: transform 0.2s ease;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__section.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__section-toggle {
      transform: rotate(-90deg);
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__section-items {
      display: flex;
      flex-direction: column;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__section.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__section-items {
      display: none;
    }

    /* ===== Menu Item ===== */
    .${SIDEBAR_MENU_CSS_PREFIX}__item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      color: #374151;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
      border-left: 3px solid transparent;
      position: relative;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__item:hover {
      background: #f3f4f6;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__item.active {
      background: #e8f5e9;
      color: var(--sidebar-primary);
      border-left-color: var(--sidebar-primary);
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__item.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__item {
      justify-content: center;
      padding: 12px;
      border-left: none;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__item.active {
      background: #e8f5e9;
      border-radius: 8px;
      margin: 0 8px;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__item-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      font-size: 18px;
      transition: transform 0.2s ease;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__item:hover .${SIDEBAR_MENU_CSS_PREFIX}__item-icon {
      transform: scale(1.1);
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__item-icon svg {
      width: 20px;
      height: 20px;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__item-content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      opacity: 1;
      transition: opacity 0.2s ease;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__item-content {
      opacity: 0;
      width: 0;
      overflow: hidden;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__item-label {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__item-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      background: var(--sidebar-primary);
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      border-radius: 10px;
      flex-shrink: 0;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__item-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      min-width: 16px;
      height: 16px;
      font-size: 9px;
      padding: 0 4px;
    }

    /* ===== Tooltip (collapsed state) ===== */
    .${SIDEBAR_MENU_CSS_PREFIX}__tooltip {
      position: fixed;
      left: calc(var(--sidebar-collapsed-width) + 8px);
      padding: 8px 12px;
      background: #1f2937;
      color: #ffffff;
      font-size: 13px;
      font-weight: 500;
      border-radius: 6px;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, visibility 0.15s ease;
      z-index: 1000;
      pointer-events: none;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__tooltip::before {
      content: '';
      position: absolute;
      left: -6px;
      top: 50%;
      transform: translateY(-50%);
      border: 6px solid transparent;
      border-right-color: #1f2937;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__item:hover .${SIDEBAR_MENU_CSS_PREFIX}__tooltip {
      opacity: 1;
      visibility: visible;
    }

    /* ===== Footer ===== */
    .${SIDEBAR_MENU_CSS_PREFIX}__footer {
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__footer-items {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}__version {
      display: flex;
      align-items: center;
      justify-content: center;
      padding-top: 8px;
      font-size: 11px;
      color: #9ca3af;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__version {
      display: none;
    }

    /* ===== Dark Theme ===== */
    .${SIDEBAR_MENU_CSS_PREFIX}.dark {
      background: #1f2937;
      border-right-color: #374151;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__header {
      background: linear-gradient(135deg, #1a3a2e 0%, var(--sidebar-primary) 100%);
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__search {
      border-bottom-color: #374151;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__search-wrapper {
      background: #374151;
      border-color: #4b5563;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__search-wrapper:focus-within {
      border-color: #4caf50;
      box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.2);
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__search-input {
      color: #e5e7eb;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__search-input::placeholder {
      color: #6b7280;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__section-header {
      color: #6b7280;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__item {
      color: #e5e7eb;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__item:hover {
      background: #374151;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__item.active {
      background: rgba(47, 88, 72, 0.3);
      color: #4caf50;
      border-left-color: #4caf50;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark.collapsed .${SIDEBAR_MENU_CSS_PREFIX}__item.active {
      background: rgba(47, 88, 72, 0.3);
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__item-badge {
      background: #4caf50;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__footer {
      border-top-color: #374151;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__content::-webkit-scrollbar-thumb {
      background: #4b5563;
    }

    .${SIDEBAR_MENU_CSS_PREFIX}.dark .${SIDEBAR_MENU_CSS_PREFIX}__content::-webkit-scrollbar-thumb:hover {
      background: #6b7280;
    }

    /* ===== Responsive ===== */
    @media (max-width: 768px) {
      .${SIDEBAR_MENU_CSS_PREFIX} {
        position: fixed;
        left: 0;
        top: 0;
        height: 100vh;
        transform: translateX(-100%);
        box-shadow: none;
        z-index: 1000;
      }

      .${SIDEBAR_MENU_CSS_PREFIX}.mobile-open {
        transform: translateX(0);
        box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
      }

      .${SIDEBAR_MENU_CSS_PREFIX}__backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
        z-index: 999;
      }

      .${SIDEBAR_MENU_CSS_PREFIX}.mobile-open + .${SIDEBAR_MENU_CSS_PREFIX}__backdrop {
        opacity: 1;
        visibility: visible;
      }
    }
  `;

  document.head.appendChild(style);
}
