/**
 * RFC-0139: HeaderShopping Component Styles
 * CSS styles for the Shopping Dashboard header toolbar
 */

export const HEADER_SHOPPING_STYLES = `
/* ===== CSS Variables ===== */
/* Light mode (default) */
.tbx-toolbar {
    --tbx-bg: #ffffff;
    --tbx-bg-secondary: #f9fafb;
    --tbx-text: #1f2937;
    --tbx-text-secondary: #6b7280;
    --tbx-border: #dbe2ea;
    --tbx-primary: #5B2EBC;
    --tbx-primary-hover: #4a2599;
    --tbx-accent: #00C896;
    --tbx-field-bg: #ffffff;
    --tbx-shadow: rgba(16, 24, 40, 0.06);
}

/* Light mode explicit */
.tbx-toolbar[data-theme="light"] {
    --tbx-bg: #ffffff;
    --tbx-bg-secondary: #f9fafb;
    --tbx-text: #1f2937;
    --tbx-text-secondary: #6b7280;
    --tbx-border: #dbe2ea;
    --tbx-primary: #5B2EBC;
    --tbx-primary-hover: #4a2599;
    --tbx-accent: #00C896;
    --tbx-field-bg: #ffffff;
    --tbx-shadow: rgba(16, 24, 40, 0.06);
}

/* Dark mode */
.tbx-toolbar[data-theme="dark"] {
    --tbx-bg: #1e293b;
    --tbx-bg-secondary: #334155;
    --tbx-text: #f1f5f9;
    --tbx-text-secondary: #94a3b8;
    --tbx-border: #475569;
    --tbx-primary: #a78bfa;
    --tbx-primary-hover: #8b5cf6;
    --tbx-accent: #34d399;
    --tbx-field-bg: #334155;
    --tbx-shadow: rgba(0, 0, 0, 0.2);
}

/* ===== Base ===== */
.tbx-toolbar {
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Helvetica Neue", Helvetica;
    color: var(--tbx-text);
    background: var(--tbx-bg);
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-around;
    box-sizing: border-box;
}

/* Linha com 2 colunas 50/50 */
.tbx-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: nowrap;
    min-width: 0;
}

.tbx-col {
    flex: 1 1 50%;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.tbx-col-right {
    justify-content: center;
}

/* Campos */
.tbx-field {
    flex-grow: 3;
    flex-shrink: 2;
    flex-basis: 0;
    min-width: 350px;
    padding: 6px 10px;
    font-size: 0.9rem;
    border: 1px solid var(--tbx-border);
    border-radius: 6px;
    background: var(--tbx-field-bg);
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    text-align: center;
    cursor: pointer;
    white-space: normal;
    overflow: auto;
}

/* Campos & Botoes */
.tbx-field,
.tbx-btn {
    display: inline-flex;
    height: 36px;
    box-shadow: 0 1px 2px var(--tbx-shadow);
}

.tbx-field {
    position: relative;
    align-items: center;
    background: var(--tbx-field-bg);
    border: 1px solid var(--tbx-border);
    border-radius: 6px;
    padding: 0 10px;
}

.tbx-field input[type="date"],
.tbx-field input[type="text"] {
    border: none;
    outline: 0;
    height: 100%;
    cursor: pointer;
    font-size: 14px;
    min-width: 300px;
    background: transparent;
    color: var(--tbx-text);
    text-align: center;
}

.tbx-field input::placeholder {
    color: var(--tbx-text-secondary);
}

/* Botoes */
.tbx-btn {
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: transform .02s, background-color .15s, box-shadow .15s;
    font-weight: 600;
    font-size: 14px;
}

.tbx-btn-primary {
    background: #1989ff;
    color: #fff;
}

.tbx-btn-primary:hover {
    background: #0f78e6;
}

.tbx-btn-primary:active {
    background: #0a67c7;
    transform: translateY(1px);
}

.tbx-btn-secondary {
    background: var(--tbx-primary);
    color: #fff;
}

.tbx-btn-secondary:hover {
    background: var(--tbx-primary-hover);
}

.tbx-btn-secondary:active {
    background: var(--tbx-primary-hover);
    transform: translateY(1px);
}

/* Botoes disabled */
.tbx-btn:disabled,
.tbx-btn[disabled] {
    background: #e5e7eb !important;
    color: #9ca3af !important;
    cursor: not-allowed !important;
    opacity: 0.6;
    box-shadow: none !important;
    transform: none !important;
}

.tbx-btn-primary:disabled,
.tbx-btn-primary[disabled] {
    background: #d1d5db !important;
    color: #6b7280 !important;
}

/* Icones */
.tbx-ico {
    display: inline-block;
    transform-origin: center;
}

.tbx-ico.rotate {
    transition: transform .3s;
}

.tbx-btn:active .tbx-ico.rotate {
    transform: rotate(-90deg);
}

/* Contract Status */
.tbx-contract-status {
    display: none;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(45, 20, 88, 0.9);
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid rgba(255,255,255,0.15);
    margin-right: 8px;
    transition: all 0.2s ease;
    font-size: 13px;
    color: #fff;
}

.tbx-contract-status:hover {
    background: rgba(45, 20, 88, 1);
    border-color: rgba(255,255,255,0.3);
}

.tbx-contract-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
}

.tbx-contract-icon--valid {
    background: rgba(76, 175, 80, 0.3);
    color: #81c784;
}

.tbx-contract-icon--invalid {
    background: rgba(244, 67, 54, 0.3);
    color: #ef5350;
}

/* Global Tooltip */
#tbx-global-tooltip {
    position: fixed;
    z-index: 99999;
    background: rgba(30,30,30,0.95);
    color: #fff;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    max-width: 280px;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

#tbx-global-tooltip.show {
    opacity: 1;
}

/* ===== Responsivo ===== */
@media (max-width: 980px) {
    .tbx-row {
        flex-wrap: wrap;
    }

    .tbx-col {
        flex: 1 1 100%;
    }

    .tbx-col-right {
        justify-content: flex-start;
    }
}
`;

let stylesInjected = false;

/**
 * Inject HeaderShopping styles into the document
 */
export function injectHeaderShoppingStyles(): void {
  if (stylesInjected) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'myio-header-shopping-styles';
  styleEl.textContent = HEADER_SHOPPING_STYLES;
  document.head.appendChild(styleEl);

  stylesInjected = true;
}
