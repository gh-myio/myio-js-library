/**
 * RFC-0140: MenuShopping Component Styles
 * CSS styles matching the original MENU widget design (shops-menu-root)
 */

import { MENU_SHOPPING_CSS_PREFIX } from './types';

const PREFIX = MENU_SHOPPING_CSS_PREFIX;

/**
 * CSS styles for the MenuShopping component
 * Based on the original ThingsBoard MENU widget (shops-menu-root)
 */
export const MENU_SHOPPING_STYLES = `
/* ============================================
   RFC-0140: MenuShopping Component Styles
   Based on original MENU widget (shops-menu-root)
   ============================================ */

/* Light mode (default) */
.${PREFIX}-container {
  --brand: #5B2EBC;
  --brand-hover: #4a2599;
  --accent: #00C896;
  --ghost: ghostwhite;
  --hover-bg: #efe7ff;
  --text: #111827;
  --text-secondary: #6b7280;
  --user-color: #2d1458;
  --divider: #e5e7eb;
  --bg: #ffffff;
  --bg-secondary: #f9fafb;
  --radius: 10px;

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 16px 0;
  box-sizing: border-box;
  font-family: "Inter", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  position: relative;
  background: var(--bg);
  color: var(--text);
}

/* Light mode explicit */
.${PREFIX}-container[data-theme="light"] {
  --brand: #5B2EBC;
  --brand-hover: #4a2599;
  --accent: #00C896;
  --ghost: ghostwhite;
  --hover-bg: #efe7ff;
  --text: #111827;
  --text-secondary: #6b7280;
  --user-color: #2d1458;
  --divider: #e5e7eb;
  --bg: #ffffff;
  --bg-secondary: #f9fafb;
}

/* Dark mode */
.${PREFIX}-container[data-theme="dark"] {
  --brand: #a78bfa;
  --brand-hover: #8b5cf6;
  --accent: #34d399;
  --ghost: #1e293b;
  --hover-bg: rgba(167, 139, 250, 0.15);
  --text: #f1f5f9;
  --text-secondary: #94a3b8;
  --user-color: #e2e8f0;
  --divider: #334155;
  --bg: #1e293b;
  --bg-secondary: #0f172a;
}

/* ===== Header Section ===== */
.${PREFIX}-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px 10px;
  border-bottom: 1px solid var(--divider);
}

.${PREFIX}-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.${PREFIX}-logo-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--brand);
  letter-spacing: -0.5px;
}

.${PREFIX}-hamburger {
  background: none;
  border: 0;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.3s ease;
  padding: 8px;
  border-radius: 6px;
  margin-left: auto;
}

.${PREFIX}-hamburger:hover {
  transform: scale(1.1);
  background: var(--hover-bg);
}

.${PREFIX}-hamburger-icon {
  font-size: 20px;
}

/* ===== User Info Section ===== */
.${PREFIX}-user {
  position: relative;
  padding: 12px 16px 16px;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 8px;
}

.${PREFIX}-avatar {
  display: none;
}

.${PREFIX}-user-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.${PREFIX}-user-name {
  color: var(--user-color);
  font-size: 15px;
  font-weight: 600;
  word-wrap: break-word;
}

.${PREFIX}-user-email {
  color: var(--user-color);
  font-size: 12px;
  font-weight: 400;
  opacity: 0.7;
  word-wrap: break-word;
}

/* ===== Theme Toggle ===== */
.${PREFIX}-theme-icon {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.85;
  transition: opacity 0.2s ease, transform 0.3s ease;
  z-index: 1;
}

.${PREFIX}-theme-icon:hover {
  opacity: 1;
  transform: scale(1.1);
}

/* ===== Navigation Tabs ===== */
.${PREFIX}-nav {
  display: flex;
  flex-direction: column;
  padding-top: 12px;
  gap: 0;
  flex: 1;
  overflow-y: auto;
}

.${PREFIX}-tab {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  color: var(--text);
  text-decoration: none;
  border: none;
  border-bottom: 1px solid var(--divider);
  border-radius: 0;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  font-family: inherit;
  text-align: left;
  transition: background 0.2s ease, color 0.2s ease;
}

.${PREFIX}-tab:hover {
  background: var(--hover-bg);
}

.${PREFIX}-tab.active {
  background: var(--brand);
  color: var(--ghost);
  border-bottom-color: transparent;
  box-shadow: 0 1px 0 rgba(62, 26, 125, 0.2) inset;
}

.${PREFIX}-tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.${PREFIX}-tab-icon {
  font-size: 20px;
  display: inline-block;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.${PREFIX}-tab-label {
  display: inline-block;
  font-weight: 500;
}

/* ===== Footer Section ===== */
.${PREFIX}-footer {
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid var(--divider);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.${PREFIX}-footer-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.06s ease, box-shadow 0.15s ease;
}

/* Settings button */
.${PREFIX}-footer-btn.settings {
  color: var(--brand);
  border: 1px solid var(--divider);
  background: var(--bg);
  box-shadow: 0 2px 10px rgba(31, 28, 53, 0.06);
  border-radius: 14px;
}

.${PREFIX}-footer-btn.settings:hover {
  background: var(--hover-bg);
  border-color: var(--brand);
  box-shadow: 0 4px 18px rgba(123, 31, 162, 0.12);
}

/* Shopping selector button */
.${PREFIX}-footer-btn.shopping-selector {
  color: var(--text);
  border: 1px solid var(--divider);
  background: var(--bg);
  box-shadow: 0 2px 10px rgba(31, 28, 53, 0.06);
  border-radius: 14px;
}

.${PREFIX}-footer-btn.shopping-selector:hover {
  background: var(--hover-bg);
  border-color: var(--brand);
  box-shadow: 0 4px 18px rgba(91, 60, 196, 0.12);
}

/* Logout button */
.${PREFIX}-footer-btn.logout {
  color: #dc2626;
}

.${PREFIX}-footer-btn.logout:hover {
  background: rgba(220, 38, 38, 0.1);
  color: #991b1b;
}

.${PREFIX}-footer-btn.logout:active {
  background: rgba(220, 38, 38, 0.15);
}

.${PREFIX}-footer-btn-icon {
  font-size: 20px;
  display: inline-block;
}

.${PREFIX}-footer-btn-label {
  font-weight: 500;
}

/* ===== Version Display ===== */
.${PREFIX}-version {
  padding: 8px 16px;
  font-size: 10px;
  color: var(--text-secondary);
  text-align: center;
}

/* ============================================
   COLLAPSED STATE
   ============================================ */

.${PREFIX}-container.collapsed {
  width: 70px;
}

.${PREFIX}-container.collapsed .${PREFIX}-user-name,
.${PREFIX}-container.collapsed .${PREFIX}-user-email,
.${PREFIX}-container.collapsed .${PREFIX}-user-info,
.${PREFIX}-container.collapsed .${PREFIX}-tab-label,
.${PREFIX}-container.collapsed .${PREFIX}-footer-btn-label,
.${PREFIX}-container.collapsed .${PREFIX}-logo-text {
  display: none;
}

.${PREFIX}-container.collapsed .${PREFIX}-user {
  padding: 12px 8px;
  text-align: center;
}

.${PREFIX}-container.collapsed .${PREFIX}-header {
  justify-content: center;
  padding: 0 8px 10px;
}

.${PREFIX}-container.collapsed .${PREFIX}-tab {
  padding: 12px 8px;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
}

.${PREFIX}-container.collapsed .${PREFIX}-footer {
  padding: 16px 8px;
}

.${PREFIX}-container.collapsed .${PREFIX}-footer-btn {
  padding: 12px 8px;
  justify-content: center;
}

.${PREFIX}-container.collapsed .${PREFIX}-logo {
  justify-content: center;
}

/* ============================================
   TOOLTIP (for collapsed mode)
   ============================================ */

.${PREFIX}-tooltip {
  position: fixed;
  z-index: 10001;
  background: #1e293b;
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.${PREFIX}-tooltip.show {
  opacity: 1;
}

/* ============================================
   MATERIAL ICONS SUPPORT
   ============================================ */

.${PREFIX}-container .material-icons,
.${PREFIX}-container .material-symbols-outlined {
  font-family: 'Material Icons', 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
}
`;

let stylesInjected = false;

/**
 * Inject the MenuShopping styles into the document
 */
export function injectMenuShoppingStyles(): void {
  if (stylesInjected) return;

  const styleId = `${PREFIX}-styles`;
  if (document.getElementById(styleId)) {
    stylesInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = MENU_SHOPPING_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}
