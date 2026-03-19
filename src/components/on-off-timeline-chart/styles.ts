/**
 * RFC-0167: On/Off Timeline Chart Styles
 * CSS-in-JS styles for the on/off activation timeline chart
 */

export const ONOFF_TIMELINE_CSS_PREFIX = 'myio-onoff-timeline';

let stylesInjected = false;

export function injectOnOffTimelineStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = `${ONOFF_TIMELINE_CSS_PREFIX}-styles`;
  style.textContent = `
    /* =====================================================
       RFC-0167: On/Off Timeline Chart Styles
       ===================================================== */

    .${ONOFF_TIMELINE_CSS_PREFIX} {
      width: 100%;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      box-sizing: border-box;
    }

    /* ===== Container ===== */
    .${ONOFF_TIMELINE_CSS_PREFIX}__container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: var(--onoff-timeline-bg, #ffffff);
      border: 1px solid var(--onoff-timeline-border, #e5e7eb);
      border-radius: 8px;
    }

    /* ===== Header ===== */
    .${ONOFF_TIMELINE_CSS_PREFIX}__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--onoff-timeline-border, #e5e7eb);
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__header-period {
      font-size: 13px;
      color: var(--onoff-timeline-text-muted, #6b7280);
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__header-stats {
      font-size: 12px;
      color: var(--onoff-timeline-text-muted, #6b7280);
    }

    /* ===== Chart SVG ===== */
    .${ONOFF_TIMELINE_CSS_PREFIX}__svg {
      width: 100%;
      height: auto;
    }

    /* ===== Segments ===== */
    .${ONOFF_TIMELINE_CSS_PREFIX}__segment {
      transition: opacity 0.2s ease;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__segment:hover {
      opacity: 0.85;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__segment--on {
      fill: var(--onoff-timeline-on-color, #22c55e);
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__segment--off {
      fill: var(--onoff-timeline-off-color, #94a3b8);
    }

    /* ===== Duration Labels ===== */
    .${ONOFF_TIMELINE_CSS_PREFIX}__duration-label {
      font-size: 10px;
      font-weight: 600;
      fill: white;
      pointer-events: none;
    }

    /* ===== Activation Markers ===== */
    .${ONOFF_TIMELINE_CSS_PREFIX}__marker {
      cursor: pointer;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__marker-icon {
      font-size: 12px;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__marker-line {
      stroke: var(--onoff-timeline-on-color, #22c55e);
      stroke-width: 2;
      stroke-dasharray: 4,2;
    }

    /* ===== Axis Labels ===== */
    .${ONOFF_TIMELINE_CSS_PREFIX}__axis-label {
      font-size: 10px;
      font-weight: 600;
      fill: var(--onoff-timeline-text, #374151);
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__date-label {
      font-size: 9px;
      fill: var(--onoff-timeline-text-muted, #6b7280);
    }

    /* ===== Summary ===== */
    .${ONOFF_TIMELINE_CSS_PREFIX}__summary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 12px 16px;
      background: var(--onoff-timeline-summary-bg, #f9fafb);
      border-radius: 6px;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__summary-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__summary-value {
      font-size: 20px;
      font-weight: 700;
      color: var(--onoff-timeline-text, #1f2937);
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__summary-value--on {
      color: var(--onoff-timeline-on-color, #22c55e);
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__summary-label {
      font-size: 11px;
      color: var(--onoff-timeline-text-muted, #6b7280);
    }

    /* ===== Legend ===== */
    .${ONOFF_TIMELINE_CSS_PREFIX}__legend {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding-top: 8px;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--onoff-timeline-text, #374151);
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__legend-color {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__legend-color--on {
      background: var(--onoff-timeline-on-color, #22c55e);
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__legend-color--off {
      background: var(--onoff-timeline-off-color, #94a3b8);
    }

    /* ===== Tooltip ===== */
    .${ONOFF_TIMELINE_CSS_PREFIX}__tooltip {
      position: fixed;
      z-index: 10000;
      padding: 10px 14px;
      background: var(--onoff-timeline-tooltip-bg, #1f2937);
      color: var(--onoff-timeline-tooltip-text, #f9fafb);
      border-radius: 6px;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.15s ease, transform 0.15s ease;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__tooltip.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-title {
      font-weight: 600;
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-title--on {
      color: #4ade80;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-title--off {
      color: #94a3b8;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 4px;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-label {
      color: #9ca3af;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__tooltip-value {
      font-weight: 500;
    }

    /* ===== Empty State ===== */
    .${ONOFF_TIMELINE_CSS_PREFIX}__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      color: var(--onoff-timeline-text-muted, #6b7280);
      text-align: center;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__empty-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    .${ONOFF_TIMELINE_CSS_PREFIX}__empty-message {
      font-size: 14px;
      margin: 0;
    }

    /* ===== Dark Theme ===== */
    .${ONOFF_TIMELINE_CSS_PREFIX}--dark {
      --onoff-timeline-bg: #1f2937;
      --onoff-timeline-border: #374151;
      --onoff-timeline-text: #f3f4f6;
      --onoff-timeline-text-muted: #9ca3af;
      --onoff-timeline-summary-bg: #374151;
      --onoff-timeline-on-color: #4ade80;
      --onoff-timeline-off-color: #6b7280;
      --onoff-timeline-tooltip-bg: #111827;
      --onoff-timeline-tooltip-text: #f9fafb;
    }

    /* ===== Responsive ===== */
    @media (max-width: 600px) {
      .${ONOFF_TIMELINE_CSS_PREFIX}__summary {
        flex-wrap: wrap;
        gap: 16px;
      }

      .${ONOFF_TIMELINE_CSS_PREFIX}__legend {
        flex-wrap: wrap;
        gap: 12px;
      }
    }
  `;

  document.head.appendChild(style);
}
