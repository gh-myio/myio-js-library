/**
 * Participation Chart Component — Styles
 * Idempotent style injection, prefix `myio-participation-chart`.
 *
 * Theme: `.--dark` modifier switches the built-in defaults; explicit overrides
 * arrive as inline CSS vars (--mpc-bg / --mpc-text / --mpc-border) set by the
 * factory. Where natural we fall back to the host's --myio-* vars.
 */

export const PARTICIPATION_CHART_CSS_PREFIX = 'myio-participation-chart';

let stylesInjected = false;

export function injectParticipationChartStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const P = PARTICIPATION_CHART_CSS_PREFIX;
  const style = document.createElement('style');
  style.id = `${P}-styles`;
  style.textContent = `
    /* =====================================================
       MYIO Participation Chart (SVG pie/bars, no chart libs)
       ===================================================== */

    .${P} {
      --mpc-bg-default: #ffffff;
      --mpc-text-default: var(--myio-text, #1e293b);
      --mpc-muted-default: var(--myio-text-muted, #6b7280);
      --mpc-border-default: var(--myio-border, #e5e7eb);
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-sizing: border-box;
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      background: var(--mpc-bg, var(--mpc-bg-default));
      color: var(--mpc-text, var(--mpc-text-default));
      font-family: 'Nunito', system-ui, sans-serif;
      font-size: 13px;
    }
    .${P} * { box-sizing: border-box; }

    .${P}--dark {
      --mpc-bg-default: #1f2333;
      --mpc-text-default: #e5e7eb;
      --mpc-muted-default: #9ca3af;
      --mpc-border-default: #374151;
    }

    .${P}--bordered {
      border: 1px solid var(--mpc-border, var(--mpc-border-default));
    }

    /* ── Header ─────────────────────────────────────────── */
    .${P}__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      min-height: 20px;
    }
    .${P}__titles { min-width: 0; }
    .${P}__title {
      font-size: 14px;
      font-weight: 700;
      line-height: 1.3;
      color: var(--mpc-text, var(--mpc-text-default));
    }
    .${P}__subtitle {
      font-size: 11.5px;
      color: var(--mpc-muted-default);
      margin-top: 2px;
    }
    .${P}__actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    /* Type selector pill (Pizza | Barras) */
    .${P}__type-toggle {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px;
      border-radius: 8px;
      background: rgba(127, 127, 127, 0.12);
    }
    .${P}__type-btn {
      border: none;
      border-radius: 6px;
      padding: 3px 10px;
      font-size: 11.5px;
      font-family: inherit;
      cursor: pointer;
      background: transparent;
      color: var(--mpc-muted-default);
      transition: background 0.15s ease, color 0.15s ease;
    }
    .${P}__type-btn.is-active {
      background: var(--myio-brand-700, #5b2c9d);
      color: #fff;
    }

    /* Subtle icon buttons (export / expand) — low opacity, full on hover */
    .${P}__icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 6px;
      padding: 0;
      font-size: 13px;
      cursor: pointer;
      background: transparent;
      color: var(--mpc-text, var(--mpc-text-default));
      opacity: 0.35;
      transition: opacity 0.15s ease, background 0.15s ease;
    }
    .${P}__icon-btn:hover {
      opacity: 1;
      background: rgba(127, 127, 127, 0.15);
    }

    /* ── Body (canvas + legend) ─────────────────────────── */
    .${P}__body {
      display: flex;
      gap: 12px;
      min-height: 0;
      flex: 1 1 auto;
    }
    .${P}--legend-bottom .${P}__body { flex-direction: column; }
    .${P}--legend-top    .${P}__body { flex-direction: column-reverse; }
    .${P}--legend-right  .${P}__body { flex-direction: row; }
    .${P}--legend-left   .${P}__body { flex-direction: row-reverse; }

    .${P}__canvas {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .${P}__canvas svg {
      width: 100%;
      height: auto;
      max-height: 420px;
      display: block;
    }
    .${P}__empty {
      padding: 24px 8px;
      text-align: center;
      font-size: 12px;
      color: var(--mpc-muted-default);
    }

    /* Slices / bars */
    .${P}__slice {
      transition: transform 0.15s ease, filter 0.15s ease;
      transform-origin: center;
      transform-box: fill-box;
      cursor: default;
    }
    .${P}__slice:hover { filter: brightness(1.12); }
    .${P}__bar-rect {
      transition: filter 0.15s ease;
    }
    .${P}__bar-rect:hover { filter: brightness(1.12); }

    /* ── Legend ─────────────────────────────────────────── */
    .${P}__legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-content: flex-start;
      max-height: 132px;
      overflow-y: auto;
      flex-shrink: 0;
    }
    .${P}--legend-left .${P}__legend,
    .${P}--legend-right .${P}__legend {
      flex-direction: column;
      flex-wrap: nowrap;
      max-height: none;
      max-width: 40%;
      overflow-y: auto;
    }
    .${P}__legend-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      border: none;
      background: transparent;
      padding: 2px 4px;
      border-radius: 6px;
      font-family: inherit;
      font-size: 11.5px;
      color: var(--mpc-text, var(--mpc-text-default));
      text-align: left;
    }
    .${P}__legend-chip.is-selectable { cursor: pointer; }
    .${P}__legend-chip.is-selectable:hover { background: rgba(127, 127, 127, 0.12); }
    .${P}__legend-swatch {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .${P}__legend-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 160px;
    }
    .${P}__legend-pct {
      color: var(--mpc-muted-default);
      flex-shrink: 0;
    }
    .${P}__legend-chip.is-off {
      opacity: 0.45;
    }
    .${P}__legend-chip.is-off .${P}__legend-label {
      text-decoration: line-through;
    }

    /* ── Fullscreen overlay (expand) ────────────────────── */
    .${P}-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000000;
      display: flex;
      padding: 24px;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(2px);
    }
    .${P}--expanded {
      width: 100%;
      height: 100%;
      overflow: auto;
    }
    .${P}--expanded .${P}__canvas svg { max-height: calc(100vh - 220px); }
    .${P}--expanded .${P}__legend { max-height: 160px; }
  `;
  document.head.appendChild(style);
}
