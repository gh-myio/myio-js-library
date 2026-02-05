/* eslint-disable */
/**
 * MYIO Enhanced Card Component - Version 6
 * Derived from template-card-v5 with customStyle support.
 *
 * @version 6.0.0
 * @author MYIO Frontend Guild
 *
 * Changes from v5:
 * - Added `customStyle` parameter for per-card style overrides:
 *   fontSize, backgroundColor, fontColor, width, height
 * - All v5 functionality preserved via delegation
 */

import { renderCardComponentV5 } from '../../thingsboard/main-dashboard-shopping/v-5.2.0/card/template-card-v5.js';

/**
 * @typedef {Object} CustomStyle
 * @property {string} [fontSize]        - CSS font-size for the card (e.g. '14px', '0.9rem')
 * @property {string} [backgroundColor] - CSS background-color for the card (e.g. '#fff', 'rgba(0,0,0,0.1)')
 * @property {string} [fontColor]       - CSS color for all text elements (e.g. '#333', 'white')
 * @property {string} [width]           - CSS width for the card (e.g. '300px', '100%')
 * @property {string} [height]          - CSS height for the card (e.g. '180px', 'auto')
 */

/**
 * Renders a card component (v6) with optional customStyle overrides.
 *
 * Accepts all the same parameters as renderCardComponentV5 plus:
 * @param {Object} options - All renderCardComponentV5 options
 * @param {CustomStyle} [options.customStyle] - Per-card style overrides
 * @returns {Object} jQuery-like object (same as v5)
 */
export function renderCardComponentV6(options) {
  const { customStyle, ...v5Options } = options;

  // Delegate to v5 for all core rendering
  const result = renderCardComponentV5(v5Options);

  // Apply customStyle overrides if provided
  if (customStyle && result && result[0]) {
    applyCustomStyle(result[0], customStyle);
  }

  return result;
}

/**
 * Applies customStyle overrides to the rendered card container.
 *
 * @param {HTMLElement} container - The card container element (result[0])
 * @param {CustomStyle} customStyle - Style overrides to apply
 */
function applyCustomStyle(container, customStyle) {
  const { fontSize, backgroundColor, fontColor, width, height } = customStyle;

  // The actual card element is the first child (.device-card-centered)
  const cardEl = container.querySelector('.device-card-centered');
  if (!cardEl) return;

  // -- Width & Height: applied on the outer container AND the card --
  if (width) {
    container.style.width = width;
    cardEl.style.width = '100%';
    cardEl.style.maxWidth = 'none';
  }

  if (height) {
    container.style.height = height;
    cardEl.style.minHeight = height;
    cardEl.style.height = height;
  }

  // -- Background color: override the card gradient --
  if (backgroundColor) {
    cardEl.style.setProperty('background', backgroundColor, 'important');
  }

  // -- Font color: applied to the card and propagated to children --
  if (fontColor) {
    cardEl.style.setProperty('color', fontColor, 'important');

    const title = cardEl.querySelector('.device-title');
    if (title) title.style.setProperty('color', fontColor, 'important');

    const subtitle = cardEl.querySelector('.device-subtitle');
    if (subtitle) subtitle.style.setProperty('color', fontColor, 'important');

    const consumptionValue = cardEl.querySelector('.consumption-value');
    if (consumptionValue) consumptionValue.style.setProperty('color', fontColor, 'important');

    const percentBadge = cardEl.querySelector('.device-percentage-badge');
    if (percentBadge) percentBadge.style.setProperty('color', fontColor, 'important');
  }

  // -- Font size: scaled proportionally across card text elements --
  if (fontSize) {
    const baseSize = parseFloat(fontSize);
    const unit = fontSize.replace(/[\d.]/g, '') || 'px';

    // Title gets full size
    const title = cardEl.querySelector('.device-title');
    if (title) title.style.setProperty('font-size', fontSize, 'important');

    // Subtitle gets ~84% of base
    const subtitle = cardEl.querySelector('.device-subtitle');
    if (subtitle) {
      const subtitleSize = (baseSize * 0.84).toFixed(2) + unit;
      subtitle.style.setProperty('font-size', subtitleSize, 'important');
    }

    // Consumption value gets ~94% of base
    const consumptionValue = cardEl.querySelector('.consumption-value');
    if (consumptionValue) {
      const valueSize = (baseSize * 0.94).toFixed(2) + unit;
      consumptionValue.style.setProperty('font-size', valueSize, 'important');
    }

    // Percentage badge gets ~81% of base
    const percentBadge = cardEl.querySelector('.device-percentage-badge');
    if (percentBadge) {
      const badgeSize = (baseSize * 0.81).toFixed(2) + unit;
      percentBadge.style.setProperty('font-size', badgeSize, 'important');
    }
  }
}

// Backward-compatible alias
export function renderCardComponent(options) {
  return renderCardComponentV6(options);
}
