// components/buttons/styles.ts
export const EXPORT_BUTTON_CSS_PREFIX = 'myio-export-btn';

let stylesInjected = false;

/** Injeta os estilos base (idempotente). Cores por kind/tema são inline (settings). */
export function injectExportButtonStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  if (document.getElementById('myio-export-btn-styles')) {
    stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'myio-export-btn-styles';
  style.textContent = `
.${EXPORT_BUTTON_CSS_PREFIX} {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 7px;
  border: 1px solid #d1d5db;
  background: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: #374151;
  transition: background .15s ease, border-color .15s ease, transform .15s ease;
}
.${EXPORT_BUTTON_CSS_PREFIX}:hover:not(:disabled) {
  transform: translateY(-1px);
}
.${EXPORT_BUTTON_CSS_PREFIX}:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.${EXPORT_BUTTON_CSS_PREFIX}--locked {
  opacity: 0.6;
  cursor: not-allowed;
}
.${EXPORT_BUTTON_CSS_PREFIX}__icon {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}
.${EXPORT_BUTTON_CSS_PREFIX}__icon svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}
.${EXPORT_BUTTON_CSS_PREFIX}:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
`;
  document.head.appendChild(style);
  stylesInjected = true;
}
