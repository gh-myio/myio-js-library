/**
 * RFC-0145: TelemetryGridShopping Component Styles
 * Migrated from TELEMETRY widget styles.css
 */

export const TELEMETRY_GRID_SHOPPING_STYLES = `
/* ============ Vars & base ============ */
/* Light mode (default) */
.shops-root {
  --ink-1: #1c2743;
  --ink-2: #6b7a90;
  --bd: #e8eef4;
  --bd-2: #d6e1ec;
  --card: #ffffff;
  --accent: #00C896;
  --shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  --brand: #5B2EBC;
  --brand-ghost: rgba(91, 46, 188, 0.08);
  --bg-soft: #f7fbff;
  --font-ui: Inter, 'Inter var', 'Plus Jakarta Sans', 'SF Pro Text', system-ui, -apple-system, Segoe UI,
    Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* Light mode explicit */
.shops-root[data-theme="light"] {
  --ink-1: #1c2743;
  --ink-2: #6b7a90;
  --bd: #e8eef4;
  --bd-2: #d6e1ec;
  --card: #ffffff;
  --accent: #00C896;
  --brand: #5B2EBC;
  --brand-ghost: rgba(91, 46, 188, 0.08);
  --bg-soft: #f7fbff;
}

/* Dark mode variables */
.shops-root[data-theme="dark"] {
  --ink-1: #f1f5f9;
  --ink-2: #94a3b8;
  --bd: #334155;
  --bd-2: #475569;
  --card: #1e293b;
  --bg-soft: #0f172a;
  --accent: #34d399;
  --brand: #a78bfa;
  --brand-ghost: rgba(167, 139, 250, 0.15);
}

.shops-root,
.shops-root * {
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  box-sizing: border-box;
}

/* ============ Widget layout ============ */
.shops-root {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-soft);
  position: relative;
}

.shops-root .shops-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(180deg, var(--card) 0, var(--bg-soft) 100%);
  border: 1px solid var(--bd);
  border-radius: 12px;
  padding: 8px 12px;
  margin: 8px 10px 10px;
  box-shadow: var(--shadow);
  position: sticky;
  top: 0;
  z-index: 10;
}

.shops-root .shops-header-left {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.shops-root .shops-title {
  margin: 0;
  font: 800 11px/1.2 var(--font-ui);
  color: var(--brand);
  text-shadow: 0 1px 2px rgba(62, 26, 125, 0.1);
  letter-spacing: 0.3px;
}

.shops-root .shops-count {
  font: 700 9px/1 var(--font-ui);
  color: var(--brand);
  padding: 3px 6px;
}

.shops-root .shops-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shops-root .icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--bd);
  background: var(--card);
  border-radius: 10px;
  padding: 6px;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.shops-root .icon-btn:hover {
  transform: translateY(-1px);
  border-color: var(--brand);
}

.shops-root .icon-btn svg {
  fill: var(--ink-2);
  display: block;
  width: 14px;
  height: 14px;
}

.shops-root .search-wrap {
  width: 0;
  overflow: hidden;
  transition: width 0.25s ease;
}

.shops-root .search-wrap.active {
  width: 180px;
}

.shops-root #shopsSearch {
  width: 100%;
  border: 1px solid var(--bd);
  border-radius: 8px;
  padding: 6px 8px;
  outline: 0;
  font: 500 10px/1.2 var(--font-ui);
  background: var(--card);
  color: var(--ink-1);
}

.shops-root #shopsSearch::placeholder {
  color: var(--ink-2);
}

.shops-root .shops-total {
  font: 800 11px/1 var(--font-ui);
  color: var(--brand);
  text-decoration: none;
  background: linear-gradient(135deg, rgba(62, 26, 125, 0.08) 0%, rgba(62, 26, 125, 0.12) 100%);
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(62, 26, 125, 0.2);
  box-shadow: 0 4px 12px rgba(62, 26, 125, 0.1);
  letter-spacing: 0.2px;
  transition: all 0.2s ease;
}

.shops-root[data-theme="dark"] .shops-total {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(167, 139, 250, 0.2) 100%);
  border-color: rgba(167, 139, 250, 0.3);
}

.shops-root .shops-total:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(62, 26, 125, 0.15);
}

/* ============ Cards List ============ */
.shops-root .shops-list {
  flex: 1 1 auto;
  min-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 12px 48px 12px;
  scroll-padding-bottom: 48px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 28px;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  align-content: start;
  justify-items: stretch;
}

.shops-root .maximize-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  background-color: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: opacity 0.3s;
  opacity: 0;
  z-index: 20;
}

.shops-root .maximize-btn:hover {
  background-color: rgba(0, 0, 0, 0.7);
}

.shops-root .maximize-btn svg {
  width: 16px;
  height: 16px;
  fill: #fff;
}

.shops-root.maximized {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  margin: 0 !important;
  z-index: 9998;
  backdrop-filter: blur(10px);
  background: rgba(15, 23, 42, 0.95) !important;
}

.shops-root.maximized::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  z-index: -1;
}

.shops-root .shops-list::-webkit-scrollbar {
  width: 8px;
}

.shops-root .shops-list::-webkit-scrollbar-thumb {
  background: var(--bd-2);
  border-radius: 6px;
}

.shops-root .card-wrapper {
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: 0;
  width: 100%;
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  overflow: visible;
}

/* ============ Loading Overlay ============ */
.shops-root .loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 16px;
  z-index: 100;
}

.shops-root .loading-overlay.hidden {
  display: none;
}

.shops-root .loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--bd);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.shops-root .loading-text {
  color: var(--ink-2);
  font: 500 12px var(--font-ui);
}

/* ============ Empty State ============ */
.shops-root .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  gap: 16px;
}

.shops-root .empty-state-icon {
  font-size: 48px;
  opacity: 0.5;
}

.shops-root .empty-state-title {
  font: 600 16px var(--font-ui);
  color: var(--ink-1);
}

.shops-root .empty-state-text {
  font: 400 14px var(--font-ui);
  color: var(--ink-2);
  max-width: 280px;
}

/* ============ Modal (appended to body, standalone styles) ============ */
.shops-modal.hidden {
  display: none !important;
}

.shops-modal {
  --ink-1: #1c2743;
  --ink-2: #6b7a90;
  --bd: #e8eef4;
  --bd-2: #d6e1ec;
  --card: #ffffff;
  --brand: #5B2EBC;
  --brand-ghost: rgba(91, 46, 188, 0.08);
  --bg-soft: #f7fbff;
  --font-ui: Inter, 'Inter var', 'Plus Jakarta Sans', 'SF Pro Text', system-ui, -apple-system, Segoe UI,
    Roboto, 'Helvetica Neue', Arial, sans-serif;

  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.5);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shops-modal-card {
  max-width: 774px;
  width: calc(100% - 32px);
  max-height: calc(100% - 48px);
  background: var(--card);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.shops-modal-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--bd);
  background: var(--card);
}

.shops-modal-header h3 {
  margin: 0;
  font: 900 14px/1 var(--font-ui);
  letter-spacing: 0.3px;
  color: var(--brand);
}

.shops-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 14px;
}

.shops-modal-footer {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 10px 12px;
  border-top: 1px solid var(--bd);
  background: var(--card);
}

/* Modal buttons (standalone) */
.shops-modal .icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--bd);
  background: var(--card);
  border-radius: 10px;
  padding: 6px;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.shops-modal .icon-btn:hover {
  transform: translateY(-1px);
  border-color: var(--brand);
}

.shops-modal .icon-btn svg {
  fill: var(--ink-2);
  display: block;
  width: 14px;
  height: 14px;
}

.shops-modal .btn,
.shops-modal .tiny-btn {
  border: 1px solid var(--bd);
  background: var(--card);
  cursor: pointer;
  border-radius: 10px;
  font: 700 10px var(--font-ui);
  color: var(--ink-1);
  transition: all 0.15s ease;
}

.shops-modal .btn {
  padding: 8px 12px;
}

.shops-modal .btn.primary {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand);
  box-shadow: 0 4px 12px rgba(62, 26, 125, 0.25);
}

.shops-modal .btn.primary:hover {
  background: #2f1460;
  border-color: #2f1460;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(62, 26, 125, 0.35);
}

.shops-modal .tiny-btn {
  padding: 8px 12px;
  letter-spacing: 0.3px;
  font: 700 11px var(--font-ui);
  background: var(--brand-ghost);
  border-color: rgba(62, 26, 125, 0.2);
  color: var(--brand);
}

.shops-modal .tiny-btn:hover {
  background: rgba(62, 26, 125, 0.12);
  border-color: rgba(62, 26, 125, 0.3);
  transform: translateY(-1px);
}

/* Modal filter blocks (standalone) */
.shops-modal .filter-block {
  margin-bottom: 20px;
}

.shops-modal .block-label {
  display: block;
  margin-bottom: 10px;
  font: 800 12px/1.2 var(--font-ui);
  letter-spacing: 0.3px;
  color: var(--brand);
}

.shops-modal .inline-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.shops-modal .filter-search {
  position: relative;
  margin: 8px 0 12px;
}

.shops-modal .filter-search input {
  width: 100%;
  border: 1px solid var(--bd-2);
  border-radius: 12px;
  padding: 10px 36px;
  outline: 0;
  font: 600 13px/1.2 var(--font-ui);
  letter-spacing: 0.2px;
  background: var(--card);
  color: var(--ink-1);
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
}

.shops-modal .filter-search input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(62, 26, 125, 0.15);
}

.shops-modal .filter-search svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  pointer-events: none;
  fill: var(--ink-2);
}

.shops-modal .filter-search .clear-x {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shops-modal .filter-search .clear-x:hover {
  background: rgba(0, 0, 0, 0.06);
}

.shops-modal .filter-search .clear-x svg {
  position: static;
  transform: none;
  width: 14px;
  height: 14px;
}

.shops-modal .radio-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.shops-modal .radio-grid label {
  font: 600 13px/1.2 var(--font-ui);
  color: var(--ink-1);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.shops-modal .muted {
  color: var(--ink-2);
  font: 500 12px/1.2 var(--font-ui);
  margin-top: 8px;
}

/* Modal checklist (standalone) */
.shops-modal .checklist {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.shops-modal .check-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 10px 44px;
  background: var(--card);
  border: 2px solid var(--bd-2);
  border-radius: 12px;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.15s ease;
}

.shops-modal .check-item:hover {
  border-color: var(--brand);
  background: var(--bg-soft);
}

.shops-modal .check-item input[type='checkbox'] {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.shops-modal .check-item::before {
  content: '';
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: 2px solid var(--bd-2);
  border-radius: 6px;
  background: var(--card);
  z-index: 1;
  box-sizing: border-box;
}

.shops-modal .check-item::after {
  content: '✓';
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 900;
  color: #fff;
  z-index: 2;
}

.shops-modal .check-item.selected {
  background: var(--brand-ghost);
  border-color: var(--brand);
  box-shadow: 0 8px 18px rgba(62, 26, 125, 0.15);
}

.shops-modal .check-item.selected::before {
  background: var(--brand);
  border-color: var(--brand);
}

.shops-modal .check-item.selected::after {
  opacity: 1;
}

.shops-modal .check-item span {
  font: 700 13.5px/1.25 var(--font-ui);
  letter-spacing: 0.15px;
  color: var(--ink-1);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Empty checklist message */
.shops-modal .empty-checklist {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  font: 500 14px/1.4 var(--font-ui);
  color: var(--ink-2);
  text-align: center;
}

/* Buttons */
.shops-root .btn,
.shops-root .tiny-btn {
  border: 1px solid var(--bd);
  background: var(--card);
  cursor: pointer;
  border-radius: 10px;
  font: 700 10px var(--font-ui);
  color: var(--ink-1);
  transition: all 0.15s ease;
}

.shops-root .btn {
  padding: 8px 12px;
}

.shops-root .btn.primary {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand);
  box-shadow: 0 4px 12px rgba(62, 26, 125, 0.25);
}

.shops-root .btn.primary:hover {
  background: #2f1460;
  border-color: #2f1460;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(62, 26, 125, 0.35);
}

.shops-root .tiny-btn {
  padding: 8px 12px;
  letter-spacing: 0.3px;
  font: 700 11px var(--font-ui);
  background: var(--brand-ghost);
  border-color: rgba(62, 26, 125, 0.2);
  color: var(--brand);
}

.shops-root .tiny-btn:hover {
  background: rgba(62, 26, 125, 0.12);
  border-color: rgba(62, 26, 125, 0.3);
  transform: translateY(-1px);
}

/* ============ Filter Blocks ============ */
.shops-root .filter-block {
  margin-bottom: 20px;
}

.shops-root .block-label {
  display: block;
  margin-bottom: 10px;
  font: 800 12px/1.2 var(--font-ui);
  letter-spacing: 0.3px;
  color: var(--brand);
}

.shops-root .inline-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.shops-root .filter-search {
  position: relative;
  margin: 8px 0 12px;
}

.shops-root .filter-search input {
  width: 100%;
  border: 1px solid var(--bd-2);
  border-radius: 12px;
  padding: 10px 36px;
  outline: 0;
  font: 600 13px/1.2 var(--font-ui);
  letter-spacing: 0.2px;
  background: var(--card);
  color: var(--ink-1);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.shops-root .filter-search input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(62, 26, 125, 0.15);
}

.shops-root .filter-search svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  pointer-events: none;
  fill: var(--ink-2);
}

.shops-root .filter-search .clear-x {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shops-root .filter-search .clear-x:hover {
  background: rgba(0, 0, 0, 0.06);
}

.shops-root .filter-search .clear-x svg {
  position: static;
  transform: none;
  width: 14px;
  height: 14px;
}

.shops-root .radio-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.shops-root .radio-grid label {
  font: 600 13px/1.2 var(--font-ui);
  color: var(--ink-1);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.shops-root .muted {
  color: var(--ink-2);
  font: 500 12px/1.2 var(--font-ui);
  margin-top: 8px;
}

/* ============ Checklist ============ */
.shops-root .checklist {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.shops-root .check-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 10px 44px;
  background: var(--card);
  border: 2px solid var(--bd-2);
  border-radius: 12px;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.15s ease;
}

.shops-root .check-item:hover {
  border-color: var(--brand);
  background: var(--bg-soft);
}

.shops-root .check-item input[type='checkbox'] {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.shops-root .check-item::before {
  content: '';
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: 2px solid var(--bd-2);
  border-radius: 6px;
  background: var(--card);
  z-index: 1;
}

.shops-root .check-item::after {
  content: '✓';
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 900;
  color: #fff;
  z-index: 2;
}

.shops-root .check-item.selected {
  background: var(--brand-ghost);
  border-color: var(--brand);
  box-shadow: 0 8px 18px rgba(62, 26, 125, 0.15);
}

.shops-root .check-item.selected::before {
  background: var(--brand);
  border-color: var(--brand);
}

.shops-root .check-item.selected::after {
  opacity: 1;
}

.shops-root .check-item span {
  font: 700 13.5px/1.25 var(--font-ui);
  letter-spacing: 0.15px;
  color: var(--ink-1);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
`;

export function injectStyles(_container?: HTMLElement): void {
  const styleId = 'telemetry-grid-shopping-styles';

  // Check if styles already exist in document head
  if (document.getElementById(styleId)) {
    return;
  }

  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = TELEMETRY_GRID_SHOPPING_STYLES;
  document.head.appendChild(styleEl);
}
