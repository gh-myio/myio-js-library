/**
 * RFC-0222 — Customer Energy Pricing Panel styles.
 *
 * Idempotent injection: `injectPricingPanelStyles(doc)` appends the stylesheet
 * once per document (guarded by the style element id). Colors read `--myio-*`
 * custom properties so the panel follows the host dashboard palette.
 */

export const PRICING_PANEL_STYLE_ID = 'myio-pricing-panel-styles';

const PRICING_PANEL_CSS = `
  .myio-pricing {
    position: fixed;
    inset: 0;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    font-family: 'Nunito', system-ui, sans-serif;
  }
  .myio-pricing.show {
    opacity: 1;
    pointer-events: auto;
  }
  .myio-pricing__overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
  .myio-pricing__content {
    position: relative;
    z-index: 2;
    background: var(--myio-card, #ffffff);
    color: var(--myio-text, #1f2937);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    width: min(680px, 94vw);
    max-height: 92vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transform: translateY(10px) scale(0.98);
    transition: transform 0.2s ease;
  }
  .myio-pricing.show .myio-pricing__content {
    transform: translateY(0) scale(1);
  }
  .myio-pricing__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--myio-brand-700, #3e1a7d);
    color: #fff;
    min-height: 36px;
  }
  .myio-pricing__header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .myio-pricing__close {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.15s ease;
  }
  .myio-pricing__close:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .myio-pricing__tabs {
    display: flex;
    gap: 4px;
    padding: 8px 12px 0;
    background: var(--myio-brand-700, #3e1a7d);
  }
  .myio-pricing__tab {
    border: none;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    padding: 8px 14px;
    border-radius: 8px 8px 0 0;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .myio-pricing__tab.active {
    background: var(--myio-card, #fff);
    color: var(--myio-brand-700, #3e1a7d);
  }
  .myio-pricing__body {
    padding: 16px;
    overflow-y: auto;
  }
  .myio-pricing__panel[hidden] {
    display: none;
  }
  .myio-pricing__form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    align-items: end;
  }
  .myio-pricing__field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .myio-pricing__field--full {
    grid-column: 1 / -1;
  }
  .myio-pricing__label {
    font-size: 12px;
    font-weight: 600;
    color: var(--myio-text-muted, #6b7280);
  }
  .myio-pricing__input,
  .myio-pricing__select {
    padding: 9px 10px;
    border: 1px solid var(--myio-border, #e5e7eb);
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    background: var(--myio-bg, #fff);
    color: var(--myio-text, #1f2937);
    width: 100%;
    box-sizing: border-box;
  }
  .myio-pricing__input:focus,
  .myio-pricing__select:focus {
    outline: none;
    border-color: var(--myio-brand-700, #5b2c9d);
    box-shadow: 0 0 0 3px rgba(91, 44, 157, 0.15);
  }
  .myio-pricing__range {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .myio-pricing__add {
    grid-column: 1 / -1;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: var(--myio-brand-700, #5b2c9d);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.15s ease;
  }
  .myio-pricing__add:hover {
    filter: brightness(1.08);
  }
  .myio-pricing__error {
    grid-column: 1 / -1;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    display: none;
  }
  .myio-pricing__error.show {
    display: block;
  }
  .myio-pricing__list {
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .myio-pricing__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--myio-border, #e5e7eb);
    border-radius: 10px;
    background: var(--myio-bg, #fafafa);
  }
  .myio-pricing__item-period {
    font-size: 13px;
    font-weight: 600;
    color: var(--myio-text, #1f2937);
  }
  .myio-pricing__item-price {
    font-size: 13px;
    color: var(--myio-brand-700, #5b2c9d);
    font-weight: 700;
  }
  .myio-pricing__remove {
    background: transparent;
    border: none;
    color: #b91c1c;
    cursor: pointer;
    font-size: 16px;
    padding: 2px 6px;
    border-radius: 6px;
  }
  .myio-pricing__remove:hover {
    background: #fef2f2;
  }
  .myio-pricing__empty {
    margin-top: 16px;
    padding: 24px;
    text-align: center;
    border: 1px dashed var(--myio-border, #e5e7eb);
    border-radius: 10px;
    color: var(--myio-text-muted, #6b7280);
    font-size: 13px;
  }
  .myio-pricing__locked {
    padding: 48px 24px;
    text-align: center;
    color: var(--myio-text, #1f2937);
  }
  .myio-pricing__locked-emoji {
    font-size: 40px;
    display: block;
    margin-bottom: 12px;
  }
  .myio-pricing__badge {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.6;
    background: var(--myio-brand-100, #ede9f6);
    color: var(--myio-brand-700, #5b2c9d);
    white-space: nowrap;
  }
  .myio-pricing__badge--water {
    background: #e0f2fe;
    color: #0369a1;
  }
  .myio-pricing__kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .myio-pricing__kpi {
    padding: 14px;
    border: 1px solid var(--myio-border, #e5e7eb);
    border-radius: 12px;
    background: var(--myio-bg, #fafafa);
  }
  .myio-pricing__kpi-value {
    font-size: 20px;
    font-weight: 800;
    color: var(--myio-brand-700, #5b2c9d);
  }
  .myio-pricing__kpi-label {
    font-size: 12px;
    color: var(--myio-text-muted, #6b7280);
    margin-top: 2px;
  }
  .myio-pricing__toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 16px 0 8px;
  }
  .myio-pricing__toolbar label {
    font-size: 12px;
    font-weight: 600;
    color: var(--myio-text-muted, #6b7280);
  }
  .myio-pricing__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .myio-pricing__table th,
  .myio-pricing__table td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--myio-border, #e5e7eb);
  }
  .myio-pricing__table th {
    color: var(--myio-text-muted, #6b7280);
    font-weight: 700;
    background: var(--myio-bg, #f3f4f6);
    position: sticky;
    top: 0;
  }
  .myio-pricing__table-wrap {
    max-height: 340px;
    overflow: auto;
    border: 1px solid var(--myio-border, #e5e7eb);
    border-radius: 10px;
  }
  .myio-pricing__history {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .myio-pricing__history-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border: 1px solid var(--myio-border, #e5e7eb);
    border-left: 3px solid var(--myio-brand-700, #5b2c9d);
    border-radius: 8px;
    background: var(--myio-bg, #fafafa);
  }
  .myio-pricing__history-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: var(--myio-text, #1f2937);
  }
  .myio-pricing__history-meta {
    font-size: 11px;
    color: var(--myio-text-muted, #6b7280);
  }
  .myio-pricing__action {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .myio-pricing__action--created { color: #15803d; }
  .myio-pricing__action--price-changed { color: #b45309; }
  .myio-pricing__action--edited { color: #b45309; }
  .myio-pricing__action--deleted { color: #b91c1c; }
  @media (max-width: 560px) {
    .myio-pricing__form { grid-template-columns: 1fr; }
  }
`;

export function injectPricingPanelStyles(doc: Document): void {
  if (doc.getElementById(PRICING_PANEL_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = PRICING_PANEL_STYLE_ID;
  style.textContent = PRICING_PANEL_CSS;
  doc.head.appendChild(style);
}
