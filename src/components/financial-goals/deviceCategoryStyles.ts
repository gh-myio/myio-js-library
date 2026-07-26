/**
 * RFC-0228 A5a — device tariff-category management panel styles.
 *
 * Idempotent, id-guarded injection (mirrors `injectCoverageStyles` and the
 * pricing-panel idiom). Premium modal shell: overlay + centered card, Nunito,
 * theme-aware via `--myio-*` custom properties with a `prefers-color-scheme: dark`
 * fallback and host `data-theme` overrides that win in both directions.
 */

export const DEVICE_CATEGORY_STYLE_ID = 'myio-fin-device-category-styles';

const DEVICE_CATEGORY_CSS = `
  .myio-devcat {
    --_dc-bg: var(--myio-bg, #ffffff);
    --_dc-card: var(--myio-card, #f8fafc);
    --_dc-text: var(--myio-text, #1f2937);
    --_dc-muted: var(--myio-text-muted, #6b7280);
    --_dc-border: var(--myio-border, #e5e7eb);
    --_dc-brand: var(--myio-brand-700, #5b2c9d);
    --_dc-brand-soft: var(--myio-brand-100, #efe7fb);
    --_dc-danger-bg: #fef2f2;
    --_dc-danger-border: #fecaca;
    --_dc-danger-text: #991b1b;
    --_dc-focus-bg: #fffbeb;
    --_dc-focus-border: #f59e0b;
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Nunito', system-ui, -apple-system, sans-serif;
    color: var(--_dc-text);
    opacity: 0;
    transition: opacity 0.18s ease;
  }
  .myio-devcat.show { opacity: 1; }

  .myio-devcat__overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(2px);
  }

  .myio-devcat__card {
    position: relative;
    width: min(760px, 94vw);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    background: var(--_dc-bg);
    border: 1px solid var(--_dc-border);
    border-radius: 16px;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
    overflow: hidden;
  }

  .myio-devcat__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--_dc-border);
    background: var(--_dc-card);
  }
  .myio-devcat__title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 800;
    font-size: 16px;
    margin: 0;
  }
  .myio-devcat__close {
    border: none;
    background: transparent;
    color: var(--_dc-muted);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
  }
  .myio-devcat__close:hover { background: var(--_dc-border); color: var(--_dc-text); }

  .myio-devcat__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    padding: 12px 20px;
    border-bottom: 1px solid var(--_dc-border);
  }
  .myio-devcat__search {
    flex: 1 1 200px;
    min-width: 140px;
    padding: 8px 12px;
    border: 1px solid var(--_dc-border);
    border-radius: 8px;
    background: var(--_dc-bg);
    color: var(--_dc-text);
    font-family: inherit;
    font-size: 13px;
  }
  .myio-devcat__filter {
    padding: 8px 12px;
    border: 1px solid var(--_dc-border);
    border-radius: 8px;
    background: var(--_dc-bg);
    color: var(--_dc-text);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .myio-devcat__bulkbar {
    display: none;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px 20px;
    background: var(--_dc-brand-soft);
    border-bottom: 1px solid var(--_dc-border);
    font-size: 13px;
    font-weight: 700;
  }
  .myio-devcat__bulkbar.show { display: flex; }
  .myio-devcat__bulkbar select {
    padding: 6px 10px;
    border: 1px solid var(--_dc-border);
    border-radius: 8px;
    background: var(--_dc-bg);
    color: var(--_dc-text);
    font-family: inherit;
    font-size: 13px;
  }
  .myio-devcat__bulk-apply {
    padding: 6px 14px;
    border: none;
    border-radius: 8px;
    background: var(--_dc-brand);
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 13px;
    cursor: pointer;
  }
  .myio-devcat__bulk-apply:disabled { opacity: 0.5; cursor: not-allowed; }

  .myio-devcat__body {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 6px 0;
  }
  .myio-devcat__empty {
    padding: 40px 20px;
    text-align: center;
    color: var(--_dc-muted);
    font-size: 14px;
  }

  .myio-devcat__row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--_dc-border);
  }
  .myio-devcat__row[data-focused="1"] {
    background: var(--_dc-focus-bg);
    box-shadow: inset 3px 0 0 var(--_dc-focus-border);
  }
  .myio-devcat__row-check { flex: 0 0 auto; width: 16px; height: 16px; cursor: pointer; }
  .myio-devcat__row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .myio-devcat__row-label {
    font-weight: 700;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .myio-devcat__row-code {
    font-size: 12px;
    color: var(--_dc-muted);
    font-variant-numeric: tabular-nums;
  }
  .myio-devcat__row-select {
    flex: 0 0 auto;
    padding: 7px 10px;
    border: 1px solid var(--_dc-border);
    border-radius: 8px;
    background: var(--_dc-bg);
    color: var(--_dc-text);
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .myio-devcat__row[data-cat="null"] .myio-devcat__row-select { color: var(--_dc-muted); }
  .myio-devcat__row-conflict {
    display: none;
    flex: 1 1 100%;
    margin-top: 6px;
    padding: 7px 12px;
    border-radius: 8px;
    background: var(--_dc-danger-bg);
    border: 1px solid var(--_dc-danger-border);
    color: var(--_dc-danger-text);
    font-size: 12px;
    font-weight: 700;
  }
  .myio-devcat__row[data-conflict="1"] { flex-wrap: wrap; }
  .myio-devcat__row[data-conflict="1"] .myio-devcat__row-conflict { display: block; }

  .myio-devcat__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 20px;
    border-top: 1px solid var(--_dc-border);
    background: var(--_dc-card);
    font-size: 12px;
    color: var(--_dc-muted);
  }

  @media (prefers-color-scheme: dark) {
    .myio-devcat {
      --_dc-bg: var(--myio-bg, #0f172a);
      --_dc-card: var(--myio-card, #1e293b);
      --_dc-text: var(--myio-text, #e2e8f0);
      --_dc-muted: var(--myio-text-muted, #94a3b8);
      --_dc-border: var(--myio-border, #334155);
      --_dc-brand: var(--myio-brand-700, #a78bfa);
      --_dc-brand-soft: var(--myio-brand-100, #2a2350);
      --_dc-danger-bg: #3a1414; --_dc-danger-border: #7f1d1d; --_dc-danger-text: #fca5a5;
      --_dc-focus-bg: #3a2e0a; --_dc-focus-border: #b45309;
    }
  }
  :root[data-theme="dark"] .myio-devcat {
    --_dc-bg: var(--myio-bg, #0f172a);
    --_dc-card: var(--myio-card, #1e293b);
    --_dc-text: var(--myio-text, #e2e8f0);
    --_dc-muted: var(--myio-text-muted, #94a3b8);
    --_dc-border: var(--myio-border, #334155);
    --_dc-brand: var(--myio-brand-700, #a78bfa);
    --_dc-brand-soft: var(--myio-brand-100, #2a2350);
    --_dc-danger-bg: #3a1414; --_dc-danger-border: #7f1d1d; --_dc-danger-text: #fca5a5;
    --_dc-focus-bg: #3a2e0a; --_dc-focus-border: #b45309;
  }
  :root[data-theme="light"] .myio-devcat {
    --_dc-bg: var(--myio-bg, #ffffff);
    --_dc-card: var(--myio-card, #f8fafc);
    --_dc-text: var(--myio-text, #1f2937);
    --_dc-muted: var(--myio-text-muted, #6b7280);
    --_dc-border: var(--myio-border, #e5e7eb);
    --_dc-brand: var(--myio-brand-700, #5b2c9d);
    --_dc-brand-soft: var(--myio-brand-100, #efe7fb);
    --_dc-danger-bg: #fef2f2; --_dc-danger-border: #fecaca; --_dc-danger-text: #991b1b;
    --_dc-focus-bg: #fffbeb; --_dc-focus-border: #f59e0b;
  }
`;

/** Inject the panel stylesheet once per document (id-guarded, idempotent). */
export function injectDeviceCategoryStyles(doc: Document): void {
  if (!doc || !doc.head) return;
  if (doc.getElementById(DEVICE_CATEGORY_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = DEVICE_CATEGORY_STYLE_ID;
  style.textContent = DEVICE_CATEGORY_CSS;
  doc.head.appendChild(style);
}
