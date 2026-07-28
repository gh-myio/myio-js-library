// components/granularity-selector/styles.ts
// CSS extraído fielmente do EnergyModal (RFC-0097): pill container com fundo
// sutil + borda suave, botão ativo destacado na cor primária, hover states e
// variantes light/dark.
//
// Compatibilidade de theming: as cores leem primeiro as CSS vars do host
// (--myio-granularity-bg, --myio-energy-border, --myio-energy-text*,
// --myio-energy-btn-hover, --myio-energy-primary — as mesmas do EnergyModal —
// e --myio-brand-700 para a cor ativa), com fallback para os valores literais
// originais do modal em cada tema.

export const GRANULARITY_SELECTOR_CSS_PREFIX = 'myio-granularity-selector';

let stylesInjected = false;

/** Injeta os estilos base (idempotente). */
export function injectGranularitySelectorStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  if (document.getElementById('myio-granularity-selector-styles')) {
    stylesInjected = true;
    return;
  }
  const P = GRANULARITY_SELECTOR_CSS_PREFIX;
  const style = document.createElement('style');
  style.id = 'myio-granularity-selector-styles';
  style.textContent = `
.${P} {
  /* Light mode (defaults do EnergyModal); vars do host têm precedência */
  --myio-gs-bg: var(--myio-granularity-bg, #f9fafb);
  --myio-gs-border: var(--myio-energy-border, #e5e7eb);
  --myio-gs-text: var(--myio-energy-text, #1f2937);
  --myio-gs-text-secondary: var(--myio-energy-text-secondary, #6b7280);
  --myio-gs-btn-hover: var(--myio-energy-btn-hover, #e5e7eb);
  --myio-gs-active: var(--myio-energy-primary, var(--myio-brand-700, #4A148C));
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--myio-gs-bg);
  border: 1px solid var(--myio-gs-border);
  border-radius: 8px;
  font-family: inherit;
  box-sizing: border-box;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}
.${P}--dark {
  --myio-gs-bg: var(--myio-granularity-bg, #111827);
  --myio-gs-border: var(--myio-energy-border, #374151);
  --myio-gs-text: var(--myio-energy-text, #f3f4f6);
  --myio-gs-text-secondary: var(--myio-energy-text-secondary, #9ca3af);
  --myio-gs-btn-hover: var(--myio-energy-btn-hover, #4b5563);
}
.${P}--disabled {
  opacity: 0.6;
}
.${P}__label {
  font-size: 11px;
  font-weight: 500;
  margin-right: 4px;
  white-space: nowrap;
  color: var(--myio-gs-text-secondary);
}
.${P}__btn {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 36px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--myio-gs-text-secondary);
}
.${P}__btn:hover:not(.active):not(:disabled) {
  background: var(--myio-gs-btn-hover);
  color: var(--myio-gs-text);
}
.${P}__btn.active {
  background: var(--myio-gs-active);
  color: white;
  border-color: var(--myio-gs-active);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
.${P}__btn:disabled {
  cursor: not-allowed;
}
`;
  document.head.appendChild(style);
  stylesInjected = true;
}
