/**
 * DeviceGridV6 Component Styles
 * Dark-theme-only panel for BAS dashboard
 */

const CSS_ID = 'myio-dgv6-styles';

const STYLES = `
/* ============ Root ============ */
.myio-dgv6 {
  --dgv6-ink-1: #f1f5f9;
  --dgv6-ink-2: #94a3b8;
  --dgv6-bd: #1e3a5f;
  --dgv6-card: #0f1d30;
  --dgv6-bg: rgba(11, 18, 32, 0.65);
  --dgv6-accent: #38bdf8;
  --dgv6-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;

  display: flex;
  flex-direction: column;
  border-radius: 10px;
  background: var(--dgv6-bg);
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  font-family: var(--dgv6-font);
  height: 100%;
  min-width: 0;
}

.myio-dgv6,
.myio-dgv6 * {
  box-sizing: border-box;
}

/* ============ Header ============ */
.myio-dgv6__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  gap: 6px;
}

.myio-dgv6__header-left {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.myio-dgv6__title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--dgv6-ink-1);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.myio-dgv6__count {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--dgv6-ink-2);
  white-space: nowrap;
}

.myio-dgv6__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* ============ Icon Buttons ============ */
.myio-dgv6__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  padding: 0;
}

.myio-dgv6__icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--dgv6-accent);
}

.myio-dgv6__icon-btn svg {
  fill: var(--dgv6-ink-2);
  width: 14px;
  height: 14px;
  display: block;
}

.myio-dgv6__icon-btn:hover svg {
  fill: var(--dgv6-ink-1);
}

/* ============ Search bar ============ */
.myio-dgv6__search-wrap {
  width: 0;
  overflow: hidden;
  transition: width 0.25s ease;
}

.myio-dgv6__search-wrap.active {
  width: 120px;
}

.myio-dgv6__search-input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 4px 8px;
  outline: 0;
  font-size: 0.7rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.05);
  color: var(--dgv6-ink-1);
}

.myio-dgv6__search-input::placeholder {
  color: var(--dgv6-ink-2);
}

.myio-dgv6__search-input:focus {
  border-color: var(--dgv6-accent);
}

/* ============ Sort dropdown ============ */
.myio-dgv6__sort-select {
  appearance: none;
  -webkit-appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 4px 20px 4px 6px;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--dgv6-ink-2);
  background: transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E") no-repeat right 6px center;
  background-size: 8px 5px;
  cursor: pointer;
  outline: none;
  max-width: 80px;
}

.myio-dgv6__sort-select:hover {
  border-color: var(--dgv6-accent);
}

.myio-dgv6__sort-select option {
  background: #1e293b;
  color: #e2e8f0;
}

/* ============ Grid ============ */
.myio-dgv6__grid {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden;
  padding: 10px;
  padding-bottom: 16px;
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(var(--dgv6-min-card-w, 140px), 1fr));
  grid-auto-rows: auto !important;
  gap: 16px !important;
  row-gap: 16px !important;
  column-gap: 16px !important;
  align-content: start !important;
}

/* Thin dark scrollbar */
.myio-dgv6__grid::-webkit-scrollbar { width: 4px; }
.myio-dgv6__grid::-webkit-scrollbar-track { background: transparent; }
.myio-dgv6__grid::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }

.myio-dgv6__card-wrapper {
  min-width: 0;
}

/* ============ Empty state ============ */
.myio-dgv6__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  gap: 8px;
  grid-column: 1 / -1;
}

.myio-dgv6__empty-icon {
  font-size: 28px;
  opacity: 0.4;
}

.myio-dgv6__empty-text {
  font-size: 0.75rem;
  color: var(--dgv6-ink-2);
}
`;

export function injectStyles(): void {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}
