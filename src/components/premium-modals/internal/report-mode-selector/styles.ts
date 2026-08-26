// premium-modals/internal/report-mode-selector/styles.ts
// Theming: --myio-brand-700 for the active fill (solid, matching the existing
// #filter-btn / exclusion-info-dot convention for "on" state) and color-mix()
// for the bounding-region border + hover tint (matching FilterOrderingModal's
// `.chip`/`.chip.selected` pattern) — no hard-coded colors, both themes covered.

export const REPORT_MODE_SELECTOR_CSS_PREFIX = 'myio-report-mode-selector';

let stylesInjected = false;

/** Injeta os estilos base (idempotente). */
export function injectReportModeSelectorStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  if (document.getElementById('myio-report-mode-selector-styles')) {
    stylesInjected = true;
    return;
  }
  const P = REPORT_MODE_SELECTOR_CSS_PREFIX;
  const style = document.createElement('style');
  style.id = 'myio-report-mode-selector-styles';
  style.textContent = `
.${P} {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
}
.${P}__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--myio-text-muted, #6b7280);
}
.${P}__track {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: var(--myio-bg, #f9fafb);
  border: 1px solid color-mix(in srgb, var(--myio-brand-700, #4A148C) 35%, #e5e7eb);
  border-radius: 8px;
  box-sizing: border-box;
}
.${P}--dark .${P}__track {
  background: #111827;
  border-color: color-mix(in srgb, var(--myio-brand-700, #4A148C) 45%, #374151);
}
.${P}--disabled {
  opacity: 0.6;
}
.${P}__btn {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  border: 1px solid transparent;
  color: var(--myio-text-muted, #6b7280);
  white-space: nowrap;
}
.${P}__btn:hover:not([aria-checked="true"]):not(:disabled) {
  background: color-mix(in srgb, var(--myio-brand-700, #4A148C) 10%, #fff);
  color: var(--myio-text, #1f2937);
}
.${P}--dark .${P}__btn:hover:not([aria-checked="true"]):not(:disabled) {
  background: color-mix(in srgb, var(--myio-brand-700, #4A148C) 22%, #374151);
  color: #f3f4f6;
}
.${P}__btn:disabled {
  cursor: not-allowed;
}
.${P}__btn[aria-checked="true"] {
  background: var(--myio-brand-700, #4A148C);
  color: #fff;
  border-color: var(--myio-brand-700, #4A148C);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
/* The nested granularity-selector must blend into the same track — its own
   pill chrome (border/background/padding) is neutralized; visual "active"
   state for its two buttons is driven entirely by our own [aria-checked]
   attribute (set by ReportModeSelector), not its internal .active class,
   so Consolidado <-> Diário/Horário is always a clean single-active state. */
.${P}__track .myio-granularity-selector {
  background: transparent;
  border: none;
  padding: 0;
  gap: 2px;
}
.${P}__track .myio-granularity-selector__btn {
  border-radius: 6px;
}
.${P}__track .myio-granularity-selector__btn.active {
  background: transparent;
  color: var(--myio-text-muted, #6b7280);
  border-color: transparent;
  box-shadow: none;
}
.${P}__track .myio-granularity-selector__btn[aria-checked="true"] {
  background: var(--myio-brand-700, #4A148C);
  color: #fff;
  border-color: var(--myio-brand-700, #4A148C);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
.${P}__hint {
  font-size: 10px;
  color: var(--myio-text-muted, #6b7280);
}
`;
  document.head.appendChild(style);
  stylesInjected = true;
}
