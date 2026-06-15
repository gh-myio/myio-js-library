/**
 * RFC-0205: Premium Dialog — scoped styles.
 *
 * Every selector is prefixed with `myio-dialog` so nothing can leak into the
 * host page (no bare element or generic class selectors — see the
 * `.card-checkbox` global-leak lesson referenced in the RFC).
 */

const FONT_LINK_ID = 'myio-dialog-font-nunito';
const STYLE_ID = 'myio-dialog-styles';

export function injectDialogStyles(): void {
  if (!document.getElementById(FONT_LINK_ID)) {
    const link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap';
    document.head.appendChild(link);
  }
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.myio-dialog-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 24, 39, 0.55);
  font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.myio-dialog {
  background: #ffffff;
  color: #1f2937;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.myio-dialog__accent {
  height: 4px;
  background: #7C3AED;
}
.myio-dialog__header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px 20px 0 20px;
}
.myio-dialog__icon {
  font-size: 20px;
  line-height: 1.3;
}
.myio-dialog__title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
}
.myio-dialog__close {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 18px;
  line-height: 1;
  padding: 2px 6px;
  margin: -2px -8px 0 0;
  border-radius: 6px;
  cursor: pointer;
}
.myio-dialog__close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #4b5563;
}
.myio-dialog__message {
  margin: 0;
  padding: 10px 20px 4px 20px;
  font-size: 13.5px;
  line-height: 1.55;
  color: #4b5563;
  overflow-y: auto;
}
.myio-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
}
.myio-dialog__btn {
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: filter 0.15s ease, background 0.15s ease;
}
.myio-dialog__btn:hover {
  filter: brightness(0.94);
}
.myio-dialog__btn:focus-visible {
  outline: 2px solid #7C3AED;
  outline-offset: 2px;
}
.myio-dialog__btn--primary {
  background: #7C3AED;
  color: #ffffff;
}
.myio-dialog__btn--secondary {
  background: #ffffff;
  color: #374151;
  border-color: #d1d5db;
}
.myio-dialog__btn--danger {
  background: #dc2626;
  color: #ffffff;
}
.myio-dialog__btn--success {
  background: #16a34a;
  color: #ffffff;
}

/* Severity accents (message dialog) */
.myio-dialog--success .myio-dialog__accent { background: #16a34a; }
.myio-dialog--warning .myio-dialog__accent { background: #d97706; }
.myio-dialog--error   .myio-dialog__accent { background: #dc2626; }

/* ── Dark theme ── */
.myio-dialog-overlay--dark .myio-dialog {
  background: #1f2937;
  color: #f3f4f6;
}
.myio-dialog-overlay--dark .myio-dialog__message {
  color: #d1d5db;
}
.myio-dialog-overlay--dark .myio-dialog__close {
  color: #9ca3af;
}
.myio-dialog-overlay--dark .myio-dialog__close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e5e7eb;
}
.myio-dialog-overlay--dark .myio-dialog__btn--secondary {
  background: #1f2937;
  color: #e5e7eb;
  border-color: #4b5563;
}
`;
  document.head.appendChild(style);
}
