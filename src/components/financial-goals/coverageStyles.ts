/**
 * RFC-0228 A4 — Honest coverage UI styles.
 *
 * Idempotent injection: {@link injectCoverageStyles} appends the stylesheet once
 * per document (guarded by the style element id), mirroring the pricing-panel
 * idiom (`injectPricingPanelStyles`). Colors read `--myio-*` custom properties so
 * the panel follows the host dashboard palette; a `prefers-color-scheme: dark`
 * block re-points those vars for standalone/dark rendering so the component is
 * theme-aware even without a host theme. Font is Nunito, matching the house style.
 */

export const COVERAGE_STYLE_ID = 'myio-fin-coverage-styles';

const COVERAGE_CSS = `
  .myio-cov {
    --_cov-bg: var(--myio-bg, #ffffff);
    --_cov-card: var(--myio-card, #f8fafc);
    --_cov-text: var(--myio-text, #1f2937);
    --_cov-muted: var(--myio-text-muted, #6b7280);
    --_cov-border: var(--myio-border, #e5e7eb);
    --_cov-brand: var(--myio-brand-700, #5b2c9d);
    --_cov-warn-bg: #fffbeb;
    --_cov-warn-border: #fde68a;
    --_cov-warn-text: #92400e;
    --_cov-ok-bg: #ecfdf5;
    --_cov-ok-border: #a7f3d0;
    --_cov-ok-text: #065f46;
    --_cov-info-bg: #eff6ff;
    --_cov-info-border: #bfdbfe;
    --_cov-info-text: #1e40af;
    font-family: 'Nunito', system-ui, -apple-system, sans-serif;
    color: var(--_cov-text);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
    line-height: 1.45;
  }

  /* ---- Unavailable panel (money view withheld — not an error, not R$ 0) ---- */
  .myio-cov__panel {
    border: 1px solid var(--_cov-border);
    border-left: 3px solid var(--_cov-brand);
    border-radius: 10px;
    background: var(--_cov-card);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .myio-cov__panel-title {
    font-weight: 800;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .myio-cov__panel-msg {
    color: var(--_cov-muted);
    margin: 0;
  }

  /* ---- Complete: quiet, non-intrusive affordance ---- */
  .myio-cov__complete {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    background: var(--_cov-ok-bg);
    color: var(--_cov-ok-text);
    border: 1px solid var(--_cov-ok-border);
  }

  /* ---- Incomplete badge + covered fraction ---- */
  .myio-cov__badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 800;
    background: var(--_cov-warn-bg);
    color: var(--_cov-warn-text);
    border: 1px solid var(--_cov-warn-border);
  }
  .myio-cov__badge-pct {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
  }
  .myio-cov__hours {
    color: var(--_cov-muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .myio-cov__note {
    margin: 0;
    color: var(--_cov-muted);
    font-size: 12px;
    font-style: italic;
  }

  /* ---- Uncategorized devices: each a deep-link click affordance to A5a ---- */
  .myio-cov__section-title {
    font-weight: 700;
    font-size: 12px;
    color: var(--_cov-text);
    margin: 4px 0 0;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .myio-cov__devices {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .myio-cov__device {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    text-align: left;
    padding: 9px 12px;
    border: 1px solid var(--_cov-border);
    border-radius: 8px;
    background: var(--_cov-bg);
    color: var(--_cov-text);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .myio-cov__device:hover,
  .myio-cov__device:focus-visible {
    border-color: var(--_cov-brand);
    background: var(--_cov-card);
    outline: none;
  }
  .myio-cov__device-label {
    font-weight: 700;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .myio-cov__device-code {
    color: var(--_cov-muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .myio-cov__device-cta {
    color: var(--_cov-brand);
    font-weight: 800;
    font-size: 12px;
    white-space: nowrap;
  }

  /* ---- Tariff coverage gaps summary ---- */
  .myio-cov__gaps {
    border: 1px solid var(--_cov-info-border);
    background: var(--_cov-info-bg);
    color: var(--_cov-info-text);
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .myio-cov__gaps-truncated {
    opacity: 0.85;
    font-style: italic;
  }

  /* ---- Deep-link (unavailable state, generic manage-categories) ---- */
  .myio-cov__deeplink {
    align-self: flex-start;
    margin-top: 4px;
    padding: 7px 14px;
    border: 1px solid var(--_cov-brand);
    border-radius: 8px;
    background: transparent;
    color: var(--_cov-brand);
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .myio-cov__deeplink:hover,
  .myio-cov__deeplink:focus-visible {
    background: var(--_cov-card);
    outline: none;
  }

  @media (prefers-color-scheme: dark) {
    .myio-cov {
      --_cov-bg: var(--myio-bg, #0f172a);
      --_cov-card: var(--myio-card, #1e293b);
      --_cov-text: var(--myio-text, #e2e8f0);
      --_cov-muted: var(--myio-text-muted, #94a3b8);
      --_cov-border: var(--myio-border, #334155);
      --_cov-brand: var(--myio-brand-700, #a78bfa);
      --_cov-warn-bg: #3a2e0a;
      --_cov-warn-border: #7c5e12;
      --_cov-warn-text: #fcd34d;
      --_cov-ok-bg: #08312a;
      --_cov-ok-border: #14654f;
      --_cov-ok-text: #6ee7b7;
      --_cov-info-bg: #0e2748;
      --_cov-info-border: #1e4a86;
      --_cov-info-text: #93c5fd;
    }
  }
  /* Host theme toggle wins in both directions. */
  :root[data-theme="dark"] .myio-cov {
    --_cov-bg: var(--myio-bg, #0f172a);
    --_cov-card: var(--myio-card, #1e293b);
    --_cov-text: var(--myio-text, #e2e8f0);
    --_cov-muted: var(--myio-text-muted, #94a3b8);
    --_cov-border: var(--myio-border, #334155);
    --_cov-brand: var(--myio-brand-700, #a78bfa);
    --_cov-warn-bg: #3a2e0a; --_cov-warn-border: #7c5e12; --_cov-warn-text: #fcd34d;
    --_cov-ok-bg: #08312a; --_cov-ok-border: #14654f; --_cov-ok-text: #6ee7b7;
    --_cov-info-bg: #0e2748; --_cov-info-border: #1e4a86; --_cov-info-text: #93c5fd;
  }
  :root[data-theme="light"] .myio-cov {
    --_cov-bg: var(--myio-bg, #ffffff);
    --_cov-card: var(--myio-card, #f8fafc);
    --_cov-text: var(--myio-text, #1f2937);
    --_cov-muted: var(--myio-text-muted, #6b7280);
    --_cov-border: var(--myio-border, #e5e7eb);
    --_cov-brand: var(--myio-brand-700, #5b2c9d);
    --_cov-warn-bg: #fffbeb; --_cov-warn-border: #fde68a; --_cov-warn-text: #92400e;
    --_cov-ok-bg: #ecfdf5; --_cov-ok-border: #a7f3d0; --_cov-ok-text: #065f46;
    --_cov-info-bg: #eff6ff; --_cov-info-border: #bfdbfe; --_cov-info-text: #1e40af;
  }
`;

/** Inject the coverage stylesheet once per document (id-guarded, idempotent). */
export function injectCoverageStyles(doc: Document): void {
  if (!doc || !doc.head) return;
  if (doc.getElementById(COVERAGE_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = COVERAGE_STYLE_ID;
  style.textContent = COVERAGE_CSS;
  doc.head.appendChild(style);
}
