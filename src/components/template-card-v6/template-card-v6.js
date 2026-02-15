/* eslint-disable */
/**
 * MYIO Enhanced Card Component - Version 6 (Standalone)
 * Independent version with customStyle support.
 *
 * @version 6.0.0
 * @author MYIO Frontend Guild
 *
 * Features:
 * - All v5 functionality (cloned, no dependency)
 * - Added `customStyle` parameter for per-card style overrides:
 *   fontSize, backgroundColor, fontColor, width, height
 * - Optimized for v5.2.0 with cleaner UI and improved spacing
 * - Removed info icon from lateral piano-key actions
 * - Reduced image gap from 10px to 4px
 * - Adjusted minimum card height from 126px to 114px
 */

// Import the MYIO components (same as v5)
import { MyIOSelectionStore } from '../SelectionStore.js';
import { MyIODraggableCard } from '../DraggableCard.js';
import { formatEnergy, formatPower } from '../../format/energy.ts';
import {
  DeviceStatusType,
  ConnectionStatusType,
  deviceStatusIcons,
  connectionStatusIcons,
  mapDeviceToConnectionStatus,
  mapDeviceStatusToCardStatus,
  shouldFlashIcon as shouldIconFlash,
  isDeviceOffline,
  getDeviceStatusIcon,
  getConnectionStatusIcon,
} from '../../utils/deviceStatus.js';
import { TempRangeTooltip } from '../../utils/TempRangeTooltip';
import { EnergyRangeTooltip } from '../../utils/EnergyRangeTooltip';
import { DeviceComparisonTooltip } from '../../utils/DeviceComparisonTooltip';
import { TempComparisonTooltip } from '../../utils/TempComparisonTooltip';
import { InfoTooltip } from '../../utils/InfoTooltip';

// ============================================
// CONSTANTS
// ============================================

/** Maximum characters for device label display before truncation */
const LABEL_CHAR_LIMIT = 18;

/**
 * Centralized device type configuration
 * category: 'energy' | 'water' | 'tank' | 'temperature'
 * image: URL or null (for dynamic images like TANK/TERMOSTATO)
 */
const DEVICE_TYPE_CONFIG = {
  // Energy devices
  COMPRESSOR: { category: 'energy', image: null },
  VENTILADOR: { category: 'energy', image: null },
  ESCADA_ROLANTE: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/EJ997iB2HD1AYYUHwIloyQOOszeqb2jp',
  },
  ELEVADOR: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/rAjOvdsYJLGah6w6BABPJSD9znIyrkJX',
  },
  MOTOR: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT',
  },
  BOMBA_HIDRAULICA: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/rbO2wQb6iKBtX0Ec04DFDcO3Qg04EOoD',
  },
  BOMBA_CAG: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/rbO2wQb6iKBtX0Ec04DFDcO3Qg04EOoD',
  },
  BOMBA_INCENDIO: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/YJkELCk9kluQSM6QXaFINX6byQWI7vbB',
  },
  BOMBA: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT',
  },
  '3F_MEDIDOR': {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k',
  },
  RELOGIO: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB',
  },
  ENTRADA: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU',
  },
  SUBESTACAO: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU',
  },
  FANCOIL: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/4BWMuVIFHnsfqatiV86DmTrOB7IF0X8Y',
  },
  CHILLER: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/27Rvy9HbNoPz8KKWPa0SBDwu4kQ827VU',
  },
  AR_CONDICIONADO: { category: 'energy', image: null },
  HVAC: { category: 'energy', image: null },

  // Water devices
  HIDROMETRO: {
    category: 'water',
    image: 'https://dashboard.myio-bas.com/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4',
  },
  HIDROMETRO_AREA_COMUM: {
    category: 'water',
    image: 'https://dashboard.myio-bas.com/api/images/public/IbEhjsvixAxwKg1ntGGZc5xZwwvGKv2t',
  },
  HIDROMETRO_SHOPPING: {
    category: 'water',
    image: 'https://dashboard.myio-bas.com/api/images/public/OIMmvN4ZTKYDvrpPGYY5agqMRoSaWNTI',
  },
  CAIXA_DAGUA: {
    category: 'water',
    image: 'https://dashboard.myio-bas.com/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq',
  },

  // Tank devices (dynamic images based on level)
  TANK: { category: 'tank', image: null },

  // Temperature devices (dynamic images based on status)
  TERMOSTATO: { category: 'temperature', image: null },

  // Solenoid devices (dynamic images based on on/off state)
  SOLENOIDE: { category: 'solenoid', image: null },
};

// Pre-computed sets for fast lookup
const ENERGY_DEVICE_TYPES = new Set(
  Object.entries(DEVICE_TYPE_CONFIG)
    .filter(([_, cfg]) => cfg.category === 'energy')
    .map(([type]) => type)
);

const WATER_DEVICE_TYPES = new Set(
  Object.entries(DEVICE_TYPE_CONFIG)
    .filter(([_, cfg]) => cfg.category === 'water')
    .map(([type]) => type)
);

const TEMPERATURE_DEVICE_TYPES = new Set(
  Object.entries(DEVICE_TYPE_CONFIG)
    .filter(([_, cfg]) => cfg.category === 'temperature')
    .map(([type]) => type)
);

const SOLENOID_DEVICE_TYPES = new Set(
  Object.entries(DEVICE_TYPE_CONFIG)
    .filter(([_, cfg]) => cfg.category === 'solenoid')
    .map(([type]) => type)
);

/** SOLENOIDE image URLs by status */
const SOLENOID_IMAGES = {
  on: 'https://dashboard.myio-bas.com/api/images/public/Tnq47Vd1TxhhqhYoHvzS73WVh1X84fPa',
  off: 'https://dashboard.myio-bas.com/api/images/public/dzVDTk3IxrOYkJ1sH92nXQFBaW53kVgs',
  offline: 'https://dashboard.myio-bas.com/api/images/public/gkSGqEFP4rgApNArjEoctM0BoLZMiKz6',
};

const DEFAULT_DEVICE_IMAGE = 'https://cdn-icons-png.flaticon.com/512/1178/1178428.png';

// ============================================
// ANNOTATION BADGES (RFC-0105)
// ============================================

const ANNOTATION_BADGE_STYLES_ID = 'myio-card-v6-annotation-badge-styles';

const ANNOTATION_TYPE_CONFIG = {
  pending: {
    color: '#d63031',
    icon: '⚠️',
    label: 'Pendência',
  },
  maintenance: {
    color: '#e17055',
    icon: '🔧',
    label: 'Manutenção',
  },
  activity: {
    color: '#00b894',
    icon: '✓',
    label: 'Atividade',
  },
  observation: {
    color: '#0984e3',
    icon: '📝',
    label: 'Observação',
  },
};

/**
 * Inject annotation badge styles
 */
function injectAnnotationBadgeStyles() {
  if (document.getElementById(ANNOTATION_BADGE_STYLES_ID)) return;

  const style = document.createElement('style');
  style.id = ANNOTATION_BADGE_STYLES_ID;
  style.textContent = `
    .myio-card-v6-annotation-badges {
      position: absolute;
      top: 6px;
      right: 6px;
      display: flex;
      flex-direction: row;
      gap: 4px;
      z-index: 15;
    }

    .myio-card-v6-annotation-badge {
      position: relative;
      width: 20px;
      height: 20px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }

    .myio-card-v6-annotation-badge:hover {
      transform: scale(1.15);
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }

    .myio-card-v6-annotation-badge__count {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 12px;
      height: 12px;
      padding: 0 2px;
      background: #1a1a2e;
      color: white;
      border-radius: 6px;
      font-size: 8px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Build annotation type tooltip content
 * @param {string} type - Annotation type
 * @param {Array} typeAnnotations - Annotations of this type
 * @param {Object} config - Type configuration
 * @returns {string} HTML content
 */
function buildAnnotationTooltipContent(type, typeAnnotations, config) {
  const now = new Date();
  const typeOverdueCount = typeAnnotations.filter((a) => a.dueDate && new Date(a.dueDate) < now).length;

  const overdueWarning =
    typeOverdueCount > 0
      ? `<div style="color:#d63031;padding:6px 10px;background:#fff5f5;border-radius:4px;margin-bottom:8px;font-size:10px;font-weight:500;">
         ⚠️ ${typeOverdueCount} anotação(ões) vencida(s)
       </div>`
      : '';

  const annotationsList = typeAnnotations
    .slice(0, 5)
    .map(
      (a) => `
      <div style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
        <div style="font-weight:500;color:#1a1a2e;font-size:11px;line-height:1.3;">"${a.text}"</div>
        <div style="font-size:9px;color:#868e96;margin-top:2px;">
          ${a.createdBy?.name || 'N/A'} • ${new Date(a.createdAt).toLocaleDateString('pt-BR')}
          ${a.dueDate ? ` • Vence: ${new Date(a.dueDate).toLocaleDateString('pt-BR')}` : ''}
        </div>
      </div>
    `
    )
    .join('');

  const moreCount = typeAnnotations.length > 5 ? typeAnnotations.length - 5 : 0;
  const moreSection =
    moreCount > 0
      ? `<div style="font-size:10px;color:#6c757d;margin-top:6px;text-align:center;">+ ${moreCount} mais...</div>`
      : '';

  return `
    <div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${config.color};"></span>
        <span style="font-weight:600;font-size:12px;">${config.label} (${typeAnnotations.length})</span>
      </div>
      ${overdueWarning}
      ${annotationsList}
      ${moreSection}
    </div>
  `;
}

/**
 * Add annotation badges to a card element
 * @param {HTMLElement} cardElement - The card DOM element
 * @param {Object} entityObject - Entity data with log_annotations
 * @param {string} labelOrName - Device label for tooltip title
 * @returns {HTMLElement|null} The badges container or null
 */
function addAnnotationIndicatorToCard(cardElement, entityObject, labelOrName) {
  // Safely extract annotations array from log_annotations
  let annotations = null;
  try {
    let logAnnotations = entityObject.log_annotations;

    // If it's a string, try to parse it as JSON
    if (typeof logAnnotations === 'string') {
      logAnnotations = JSON.parse(logAnnotations);
    }

    // Extract annotations array from parsed object
    if (logAnnotations && Array.isArray(logAnnotations.annotations)) {
      annotations = logAnnotations.annotations;
    } else if (Array.isArray(logAnnotations)) {
      annotations = logAnnotations;
    }
  } catch (err) {
    console.warn(`[template-card-v6] Failed to parse log_annotations:`, err.message);
    return null;
  }

  // No valid annotations found
  if (!annotations || annotations.length === 0) {
    return null;
  }

  // Ensure styles are injected
  injectAnnotationBadgeStyles();

  // Ensure card has relative positioning
  if (cardElement && cardElement.style) {
    cardElement.style.position = 'relative';
  }

  // Filter active annotations
  const activeAnnotations = annotations.filter((a) => a.status !== 'archived');
  if (activeAnnotations.length === 0) return null;

  // Group annotations by type
  const annotationsByType = {
    pending: [],
    maintenance: [],
    activity: [],
    observation: [],
  };

  activeAnnotations.forEach((a) => {
    if (annotationsByType[a.type] !== undefined) {
      annotationsByType[a.type].push(a);
    }
  });

  // Create badges container
  const container = document.createElement('div');
  container.className = 'myio-card-v6-annotation-badges';

  // Priority order: pending, maintenance, activity, observation
  const typeOrder = ['pending', 'maintenance', 'activity', 'observation'];

  // Get InfoTooltip (from import or window)
  const tooltip = InfoTooltip || window.MyIOLibrary?.InfoTooltip;

  // Create a badge for each type with annotations
  typeOrder.forEach((type) => {
    const typeAnnotations = annotationsByType[type];
    if (typeAnnotations.length === 0) return;

    const config = ANNOTATION_TYPE_CONFIG[type];
    const badge = document.createElement('div');
    badge.className = 'myio-card-v6-annotation-badge';
    badge.style.background = config.color;
    badge.innerHTML = `
      <span>${config.icon}</span>
      <span class="myio-card-v6-annotation-badge__count">${typeAnnotations.length}</span>
    `;

    // Attach tooltip on hover
    if (tooltip) {
      badge.addEventListener('mouseenter', () => {
        const content = buildAnnotationTooltipContent(type, typeAnnotations, config);
        tooltip.show(badge, {
          icon: config.icon,
          title: `${config.label} - ${labelOrName || 'Dispositivo'}`,
          content: content,
        });
      });

      badge.addEventListener('mouseleave', () => {
        tooltip.startDelayedHide?.() || tooltip.hide?.();
      });
    }

    container.appendChild(badge);
  });

  // Append badges to card
  cardElement.appendChild(container);

  return container;
}

// Helper functions derived from config
const getDeviceCategory = (deviceType) => {
  const normalizedType = String(deviceType || '').toUpperCase();
  return DEVICE_TYPE_CONFIG[normalizedType]?.category || 'energy';
};

const isEnergyDeviceType = (deviceType) => {
  const normalizedType = String(deviceType || '').toUpperCase();
  return ENERGY_DEVICE_TYPES.has(normalizedType);
};

const isWaterDeviceType = (deviceType) => {
  const normalizedType = String(deviceType || '').toUpperCase();
  return WATER_DEVICE_TYPES.has(normalizedType);
};

const isTemperatureDeviceType = (deviceType) => {
  const normalizedType = String(deviceType || '').toUpperCase();
  return TEMPERATURE_DEVICE_TYPES.has(normalizedType);
};

const isSolenoidDeviceType = (deviceType) => {
  const normalizedType = String(deviceType || '').toUpperCase();
  return SOLENOID_DEVICE_TYPES.has(normalizedType) || normalizedType.includes('SOLENOIDE');
};

const getStaticDeviceImage = (deviceType) => {
  const normalizedType = String(deviceType || '').toUpperCase();
  return DEVICE_TYPE_CONFIG[normalizedType]?.image || DEFAULT_DEVICE_IMAGE;
};

/**
 * @typedef {Object} CustomStyle
 * @property {string} [fontSize]        - CSS font-size for the card (e.g. '14px', '0.9rem')
 * @property {string} [backgroundColor] - CSS background-color for the card (e.g. '#fff', 'rgba(0,0,0,0.1)')
 * @property {string} [fontColor]       - CSS color for all text elements (e.g. '#333', 'white')
 * @property {string} [width]           - CSS width for the card (e.g. '300px', '100%')
 * @property {string} [height]          - CSS height for the card (e.g. '180px', 'auto')
 * @property {string} [padding]         - CSS padding for the card (e.g. '12px', '8px 16px')
 * @property {string} [borderRadius]    - CSS border-radius for the card (e.g. '8px', '12px')
 * @property {string} [boxShadow]       - CSS box-shadow for the card (e.g. '0 4px 12px rgba(0,0,0,0.1)')
 * @property {string} [margin]          - CSS margin for the card (e.g. '8px', '0 auto')
 * @property {number} [zoomMultiplier]  - Scale multiplier for all sizes (default: 1.0, e.g. 0.9 = 90% scale)
 */

// Default card dimensions for zoom calculations
const CARD_V6_DEFAULTS = {
  padding: 18,
  borderRadius: 14,
  minHeight: 114,
  maxWidth: 280,
  imageMaxHeight: 44,
  titleFontSize: 0.75,      // rem
  subtitleFontSize: 0.55,   // rem
  valueFontSize: 0.75,      // rem
  flashIconSize: 0.85,      // rem
  actionButtonSize: 28,     // px
  actionIconSize: 16,       // px
  gap: 8,                   // px
};

/**
 * Applies customStyle overrides to the rendered card container.
 *
 * @param {HTMLElement} container - The card container element (result[0])
 * @param {CustomStyle} customStyle - Style overrides to apply
 */
function applyCustomStyle(container, customStyle) {
  const {
    fontSize,
    backgroundColor,
    fontColor,
    width,
    height,
    padding,
    borderRadius,
    boxShadow,
    margin,
    zoomMultiplier = 1.0,
  } = customStyle;

  // The actual card element is the first child (.device-card-centered)
  const cardEl = container.querySelector('.device-card-centered');
  if (!cardEl) return;

  const zoom = zoomMultiplier;

  // -- zoomMultiplier: Scale all dimensions proportionally --
  if (zoom !== 1.0) {
    // Padding
    const scaledPadding = (CARD_V6_DEFAULTS.padding * zoom).toFixed(1);
    cardEl.style.setProperty('padding', `${scaledPadding}px`, 'important');

    // Border radius
    const scaledRadius = (CARD_V6_DEFAULTS.borderRadius * zoom).toFixed(1);
    cardEl.style.setProperty('border-radius', `${scaledRadius}px`, 'important');

    // Min height
    const scaledMinHeight = (CARD_V6_DEFAULTS.minHeight * zoom).toFixed(1);
    cardEl.style.setProperty('min-height', `${scaledMinHeight}px`, 'important');

    // Max width
    const scaledMaxWidth = (CARD_V6_DEFAULTS.maxWidth * zoom).toFixed(1);
    cardEl.style.setProperty('max-width', `${scaledMaxWidth}px`, 'important');

    // Image max height
    const deviceImage = cardEl.querySelector('.device-image');
    if (deviceImage) {
      const scaledImageHeight = (CARD_V6_DEFAULTS.imageMaxHeight * zoom).toFixed(1);
      deviceImage.style.setProperty('max-height', `${scaledImageHeight}px`, 'important');
    }

    // Title font size
    const title = cardEl.querySelector('.device-title');
    if (title) {
      const scaledTitleSize = (CARD_V6_DEFAULTS.titleFontSize * zoom).toFixed(3);
      title.style.setProperty('font-size', `${scaledTitleSize}rem`, 'important');
    }

    // Subtitle font size
    const subtitle = cardEl.querySelector('.device-subtitle');
    if (subtitle) {
      const scaledSubtitleSize = (CARD_V6_DEFAULTS.subtitleFontSize * zoom).toFixed(3);
      subtitle.style.setProperty('font-size', `${scaledSubtitleSize}rem`, 'important');
    }

    // Consumption value font size
    const consumptionValue = cardEl.querySelector('.consumption-value');
    if (consumptionValue) {
      const scaledValueSize = (CARD_V6_DEFAULTS.valueFontSize * zoom).toFixed(3);
      consumptionValue.style.setProperty('font-size', `${scaledValueSize}rem`, 'important');
    }

    // Flash icon size
    const flashIcon = cardEl.querySelector('.flash-icon');
    if (flashIcon) {
      const scaledIconSize = (CARD_V6_DEFAULTS.flashIconSize * zoom).toFixed(3);
      flashIcon.style.setProperty('font-size', `${scaledIconSize}rem`, 'important');
    }

    // Action buttons
    const actionButtons = cardEl.querySelectorAll('.card-action');
    actionButtons.forEach((btn) => {
      const scaledBtnSize = (CARD_V6_DEFAULTS.actionButtonSize * zoom).toFixed(1);
      btn.style.setProperty('width', `${scaledBtnSize}px`, 'important');
      btn.style.setProperty('height', `${scaledBtnSize}px`, 'important');
      btn.style.setProperty('min-height', `${scaledBtnSize}px`, 'important');

      const img = btn.querySelector('img');
      if (img) {
        const scaledImgSize = (CARD_V6_DEFAULTS.actionIconSize * zoom).toFixed(1);
        img.style.setProperty('width', `${scaledImgSize}px`, 'important');
        img.style.setProperty('height', `${scaledImgSize}px`, 'important');
      }
    });

    // Actions container width
    const actionsContainer = cardEl.querySelector('.card-actions');
    if (actionsContainer) {
      const scaledActionsWidth = (34 * zoom).toFixed(1);
      actionsContainer.style.setProperty('width', `${scaledActionsWidth}px`, 'important');
    }

    // Consumption badge padding
    const consumptionMain = cardEl.querySelector('.consumption-main');
    if (consumptionMain) {
      const scaledPadV = (4 * zoom).toFixed(1);
      const scaledPadH = (8 * zoom).toFixed(1);
      consumptionMain.style.setProperty('padding', `${scaledPadV}px ${scaledPadH}px`, 'important');
      consumptionMain.style.setProperty('border-radius', `${(8 * zoom).toFixed(1)}px`, 'important');
    }

    // Shopping badge
    const shoppingBadge = cardEl.querySelector('.myio-v5-shopping-badge');
    if (shoppingBadge) {
      const scaledBadgeFontSize = (11 * zoom).toFixed(1);
      shoppingBadge.style.setProperty('font-size', `${scaledBadgeFontSize}px`, 'important');
      const scaledBadgePadV = (4 * zoom).toFixed(1);
      const scaledBadgePadH = (10 * zoom).toFixed(1);
      shoppingBadge.style.setProperty('padding', `${scaledBadgePadV}px ${scaledBadgePadH}px`, 'important');
    }
  }

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

  // -- Padding: override card padding --
  if (padding) {
    cardEl.style.setProperty('padding', padding, 'important');
  }

  // -- Border radius: override card border-radius --
  if (borderRadius) {
    cardEl.style.setProperty('border-radius', borderRadius, 'important');
  }

  // -- Box shadow: override card box-shadow --
  if (boxShadow) {
    cardEl.style.setProperty('box-shadow', boxShadow, 'important');
  }

  // -- Margin: applied on the card --
  if (margin) {
    cardEl.style.setProperty('margin', margin, 'important');
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
  // Note: If zoomMultiplier is set, it takes precedence for font scaling
  if (fontSize && zoom === 1.0) {
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

/**
 * Renders a card component (v6) with optional customStyle overrides.
 * This is a standalone version that does not depend on v5.
 *
 * @param {Object} options - All card options
 * @param {CustomStyle} [options.customStyle] - Per-card style overrides
 * @returns {Object} jQuery-like object
 */
export function renderCardComponentV6({
  entityObject,
  handleActionDashboard,
  handleActionReport,
  handleActionSettings,
  handleSelect,
  handInfo, // DEPRECATED: Info now handled in settings modal
  handleClickCard,
  useNewComponents = true,
  enableSelection = true,
  enableDragDrop = true,
  showEnergyRangeTooltip = false,
  showPercentageTooltip = false,
  showTempComparisonTooltip = false,
  showTempRangeTooltip = false,
  customStyle, // V6: Per-card style overrides
}) {
  const {
    entityId,
    labelOrName,
    deviceIdentifier,
    entityType,
    deviceType,
    deviceProfile,
    slaveId,
    ingestionId,
    val,
    centralId,
    updatedIdentifiers = {},
    perc = 0,
    deviceStatus,
    centralName,
    connectionStatusTime,
    timeVal,
    lastDisconnectTime,
    customerName,
    waterLevel,
    waterPercentage,
    temperature,
    temperatureMin,
    temperatureMax,
    temperatureStatus,
    // RFC-0175: Solenoid valve status (on=closed, off=open)
    solenoidStatus,
  } = entityObject;

  // RFC-0175: Use deviceProfile (preferred) or deviceType (fallback) for device classification
  // This fixes SOLENOIDE devices which have deviceType=3F_MEDIDOR but deviceProfile=SOLENOIDE
  const effectiveDeviceType = deviceProfile || deviceType;

  // MyIO Global Toast Manager
  const MyIOToast = (function () {
    let toastContainer = null;
    let toastTimeout = null;

    const TOAST_CSS = `
      #myio-global-toast-container {
        position: fixed;
        top: 25px;
        right: 25px;
        z-index: 99999;
        width: 320px;
        padding: 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 15px;
        color: #fff;
        transform: translateX(120%);
        transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        border-left: 5px solid transparent;
        display: flex;
        align-items: center;
      }
      #myio-global-toast-container.show {
        transform: translateX(0);
      }
      #myio-global-toast-container.warning {
        background-color: #ff9800;
        border-color: #f57c00;
      }
      #myio-global-toast-container.error {
        background-color: #d32f2f;
        border-color: #b71c1c;
      }
      #myio-global-toast-container::before {
        content: '⚠️';
        margin-right: 12px;
        font-size: 20px;
      }
      #myio-global-toast-container.error::before {
        content: '🚫';
      }
    `;

    function createToastElement() {
      if (document.getElementById('myio-global-toast-container')) {
        toastContainer = document.getElementById('myio-global-toast-container');
        return;
      }

      const style = document.createElement('style');
      style.id = 'myio-global-toast-styles';
      style.textContent = TOAST_CSS;
      document.head.appendChild(style);

      toastContainer = document.createElement('div');
      toastContainer.id = 'myio-global-toast-container';
      document.body.appendChild(toastContainer);
    }

    function show(message, type = 'warning', duration = 3500) {
      if (!toastContainer) {
        createToastElement();
      }

      clearTimeout(toastTimeout);

      toastContainer.textContent = message;
      toastContainer.className = '';
      toastContainer.classList.add(type);

      setTimeout(() => {
        toastContainer.classList.add('show');
      }, 10);

      toastTimeout = setTimeout(() => {
        toastContainer.classList.remove('show');
      }, duration);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createToastElement);
    } else {
      createToastElement();
    }

    return { show };
  })();

  // Deprecated warning for handInfo
  if (handInfo) {
    console.warn(
      '[template-card-v6] handInfo parameter is deprecated. Info functionality has been moved to settings modal.'
    );
  }

  // Status logic using centralized utility
  const connectionStatus = mapDeviceToConnectionStatus(deviceStatus);
  const isOffline = isDeviceOffline(deviceStatus);
  const shouldFlashIcon = shouldIconFlash(deviceStatus);
  // RFC-0175: Use effectiveDeviceType (deviceProfile preferred) for icon selection
  const icon = getDeviceStatusIcon(deviceStatus, effectiveDeviceType);
  const connectionIcon = getConnectionStatusIcon(connectionStatus);

  // Map device type to icon category
  const mapDeviceTypeToIcon = (deviceType) => {
    const category = getDeviceCategory(deviceType);
    if (category === 'water' || category === 'tank') return 'water';
    if (category === 'temperature') return 'temperature';
    if (category === 'energy') return 'energy';
    return 'generic';
  };

  // Get value type from device type
  const getValueTypeFromDeviceType = (deviceType) => {
    const category = getDeviceCategory(deviceType);
    if (category === 'tank') return 'TANK';
    return category.toUpperCase();
  };

  // Check if device is energy-related
  const isEnergyDevice = (deviceType) => isEnergyDeviceType(deviceType);

  // Check if device is temperature-related
  const isTemperatureDevice = (deviceType) => isTemperatureDeviceType(deviceType);

  // Smart formatting function
  // RFC-0175: Accept both deviceType and deviceProfile for proper device detection
  const formatCardValue = (value, deviceType, deviceProfile) => {
    const numValue = Number(value) || 0;
    const dt = String(deviceType || '').toUpperCase();
    const dp = String(deviceProfile || '').toUpperCase();

    // SOLENOIDE devices: show ABERTO/FECHADO based on solenoidStatus
    // RFC-0175: Check deviceProfile first (preferred), then deviceType as fallback
    // Logic: status='off' means valve is OPEN, status='on' means valve is CLOSED
    if (isSolenoidDeviceType(deviceProfile) || isSolenoidDeviceType(deviceType)) {
      const statusLower = String(solenoidStatus || '').toLowerCase();
      // off = ABERTO (open), on = FECHADO (closed)
      const isOpen = statusLower === 'off' || statusLower === '' || statusLower === 'null';
      return isOpen ? 'ABERTO' : 'FECHADO';
    }

    // TANK devices: show percentage instead of m.c.a
    if (dt === 'TANK' || dt === 'CAIXA_DAGUA') {
      const percValue = (waterPercentage || 0) * 100;
      const formattedPerc = percValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      return `${formattedPerc}%`;
    }

    if (isEnergyDevice(deviceType)) {
      // Use formatPower for instantaneous power readings (kW, not kWh)
      if (window.MyIOUtils?.formatPowerWithSettings) {
        return window.MyIOUtils.formatPowerWithSettings(numValue);
      }
      return formatPower(numValue);
    } else if (isTemperatureDevice(deviceType)) {
      if (window.MyIOUtils?.formatTemperatureWithSettings) {
        return window.MyIOUtils.formatTemperatureWithSettings(numValue);
      }
      const formattedTemp = numValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      return `${formattedTemp} °C`;
    } else if (isWaterDeviceType(deviceType)) {
      if (window.MyIOUtils?.formatWaterWithSettings) {
        return window.MyIOUtils.formatWaterWithSettings(numValue);
      }
      const formattedValue = numValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${formattedValue} m³`;
    } else {
      const unit = determineUnit(deviceType);
      const formattedValue = numValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
      return `${formattedValue} ${unit}`;
    }
  };

  // Determine unit based on device type
  const determineUnit = (deviceType) => {
    const valueType = getValueTypeFromDeviceType(deviceType);
    switch (valueType) {
      case 'ENERGY':
        return '';
      case 'WATER':
        return 'm³';
      case 'TANK':
        return 'm.c.a';
      case 'TEMPERATURE':
        return '°C';
      default:
        return '';
    }
  };

  // Create entity object for card
  const cardEntity = {
    id: entityId,
    name: labelOrName || 'Dispositivo',
    icon: mapDeviceTypeToIcon(deviceType),
    group: deviceIdentifier || entityType || 'Dispositivo',
    lastValue: Number(val) || 0,
    unit: determineUnit(deviceType),
    status: mapDeviceStatusToCardStatus(deviceStatus),
    ingestionId: ingestionId || entityId,
  };

  // Register entity with SelectionStore if selection is enabled
  if (enableSelection && MyIOSelectionStore) {
    MyIOSelectionStore.registerEntity(cardEntity);
  }

  // Create container for the card
  const container = document.createElement('div');
  container.className = 'myio-enhanced-card-container-v6';

  // Add enhanced styling (v6)
  if (!document.getElementById('myio-enhanced-card-styles-v6')) {
    const style = document.createElement('style');
    style.id = 'myio-enhanced-card-styles-v6';
    style.textContent = `
      .myio-enhanced-card-container-v6 {
        position: relative;
        width: 100%;
        height: auto;
      }

      .myio-enhanced-card-container-v6 .myio-draggable-card {
        width: 100%;
        border-radius: 10px;
        padding: 8px 12px;
        background: #fff;
        box-shadow: 0 4px 10px rgba(0, 0, 0, .05);
        cursor: pointer;
        transition: transform .2s;
        box-sizing: border-box;
        overflow: hidden;
        min-height: 140px;
        display: flex;
        flex-direction: row;
        align-items: stretch;
      }

      .myio-enhanced-card-container-v6 .myio-draggable-card:hover {
        transform: scale(1.05);
      }

      .myio-enhanced-card-container-v6 .myio-draggable-card.selected {
        border: 2px solid #00e09e;
        box-shadow: 0 4px 12px rgba(0,224,158,0.2);
        background: linear-gradient(135deg, #f0fdf9, #ecfdf5);
      }

      .myio-enhanced-card-container-v6 .myio-draggable-card.offline {
        border: 2px solid #ff4d4f;
        animation: border-blink-v6 1s infinite;
      }

      @keyframes border-blink-v6 {
        0%, 100% { box-shadow: 0 0 8px rgba(255, 77, 79, 0.9); }
        50% { box-shadow: 0 0 16px rgba(255, 0, 0, 0.6); }
      }

      .myio-enhanced-card-container-v6 .card-actions {
        flex-shrink: 0;
        height: 100%;
        box-shadow: 1px 0 2px rgba(0, 0, 0, .1);
        display: flex;
        flex-direction: column;
        padding: 4px;
        justify-content: center;
        align-items: center;
        gap: 2px;
      }

      .myio-enhanced-card-container-v6 .card-action {
        width: 28px;
        height: 26px;
        min-height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s ease;
        cursor: pointer;
        border: none;
        background: rgba(0, 0, 0, 0.03);
      }

      .myio-enhanced-card-container-v6 .card-action:hover {
        background: rgba(0, 224, 158, 0.1);
        transform: scale(1.1);
      }

      .myio-enhanced-card-container-v6 .card-action img {
        width: 20px;
        height: 20px;
      }

      .myio-enhanced-card-container-v6 .card-checkbox {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .myio-enhanced-card-container-v6 .card-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 0 12px;
        text-align: center;
      }

      .myio-enhanced-card-container-v6 .card-title {
        font-weight: 700;
        font-size: 0.85rem;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .myio-enhanced-card-container-v6 .card-group {
        font-size: 0.7rem;
        color: #888;
        margin-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .myio-enhanced-card-container-v6 .card-value {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.9rem;
        font-weight: 700;
        color: #28a745;
      }

      .myio-enhanced-card-container-v6 .card-unit {
        font-size: 0.75rem;
        color: rgba(0, 0, 0, 0.6);
      }

      .myio-enhanced-card-container-v6 .card-percentage {
        font-size: 0.75rem;
        color: rgba(0, 0, 0, 0.45);
        margin-left: 4px;
      }

      .myio-enhanced-card-container-v6 .card-icon {
        width: 24px;
        height: 24px;
        margin-bottom: 8px;
      }

      .myio-enhanced-card-container-v6 .card-icon svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }

      .myio-enhanced-card-container-v6 .card-status-indicator {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        z-index: 10;
      }

      .myio-enhanced-card-container-v6 .card-status-ok { background: #28a745; }
      .myio-enhanced-card-container-v6 .card-status-alert { background: #ffc107; }
      .myio-enhanced-card-container-v6 .card-status-fail,
      .myio-enhanced-card-container-v6 .card-status-offline { background: #dc3545; }
      .myio-enhanced-card-container-v6 .card-status-unknown { background: #6c757d; }
    `;
    document.head.appendChild(style);
  }

  // Get device image URL with dynamic level support
  // RFC-0175: Accept both deviceType and deviceProfile for proper device detection
  const getDeviceImageUrl = (deviceType, percentage = 0, options = {}) => {
    const { tempStatus, isOffline, deviceProfile: optDeviceProfile } = options;
    const nameType = String(deviceType || '').toUpperCase();
    const profileType = String(optDeviceProfile || '').toUpperCase();

    // TERMOSTATO devices: Dynamic icon based on temperature status
    if (nameType === 'TERMOSTATO' || profileType === 'TERMOSTATO') {
      if (isOffline) {
        return 'https://dashboard.myio-bas.com/api/images/public/Q4bE6zWz4pL3u5M3rjmMt2uSis6Xe52F';
      }
      if (tempStatus === 'above') {
        return 'https://dashboard.myio-bas.com/api/images/public/S3IvpZRJvskqFrhoypKBCKKsLaKiqzJI';
      } else if (tempStatus === 'below') {
        return 'https://dashboard.myio-bas.com/api/images/public/ctfORoxVGP2bB7VKeprJfIvNgmNjpaO4';
      } else {
        return 'https://dashboard.myio-bas.com/api/images/public/rtCcq6kZZVCD7wgJywxEurRZwR8LA7Q7';
      }
    }

    // TANK devices: Dynamic icon based on water level percentage
    if (nameType === 'TANK' || profileType === 'TANK') {
      if (percentage >= 70) {
        return 'https://dashboard.myio-bas.com/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq';
      } else if (percentage >= 40) {
        return 'https://dashboard.myio-bas.com/api/images/public/4UBbShfXCVWR9wcw6IzVMNran4x1EW5n';
      } else if (percentage >= 20) {
        return 'https://dashboard.myio-bas.com/api/images/public/aB9nX28F54fBBQs1Ht8jKUdYAMcq9QSm';
      } else {
        return 'https://dashboard.myio-bas.com/api/images/public/qLdwhV4qw295poSCa7HinpnmXoN7dAPO';
      }
    }

    // SOLENOIDE devices: Dynamic icon based on solenoidStatus
    // RFC-0175: Check deviceProfile first (preferred), then deviceType as fallback
    // Logic: status='off' means valve is OPEN, status='on' means valve is CLOSED
    if (profileType === 'SOLENOIDE' || profileType.includes('SOLENOIDE') ||
        nameType === 'SOLENOIDE' || nameType.includes('SOLENOIDE')) {
      if (isOffline) {
        return SOLENOID_IMAGES.offline;
      }
      // Use solenoidStatus from options
      const { solenoidStatus: solStatus } = options;
      const statusLower = String(solStatus || '').toLowerCase();
      // off = ABERTO (open valve) → show 'on' image, on = FECHADO (closed valve) → show 'off' image
      const isOpen = statusLower === 'off' || statusLower === '' || statusLower === 'null';
      return isOpen ? SOLENOID_IMAGES.on : SOLENOID_IMAGES.off;
    }

    return getStaticDeviceImage(nameType);
  };

  // Create card HTML
  // RFC-0175: Check deviceProfile first (preferred) for all device type flags
  const dtUpper = String(deviceType || '').toUpperCase();
  const dpUpper = String(deviceProfile || '').toUpperCase();
  const isTankDevice = dpUpper === 'TANK' || dpUpper === 'CAIXA_DAGUA' || dtUpper === 'TANK' || dtUpper === 'CAIXA_DAGUA';
  const isTermostatoDevice = dpUpper === 'TERMOSTATO' || dtUpper === 'TERMOSTATO';
  // RFC-0175: SOLENOIDE devices are NOT energy devices even if deviceType=3F_MEDIDOR
  const isSolenoidDevice = isSolenoidDeviceType(deviceProfile) || isSolenoidDeviceType(deviceType);
  const isEnergyDeviceFlag = !isSolenoidDevice && (isEnergyDevice(deviceProfile) || isEnergyDevice(deviceType));
  const percentageForDisplay = isTankDevice ? (waterPercentage || 0) * 100 : perc;

  // Calculate temperature status for TERMOSTATO devices
  const calculateTempStatus = () => {
    if (temperatureStatus) return temperatureStatus;
    const currentTemp = Number(val) || 0;
    if (temperatureMin !== undefined && temperatureMax !== undefined) {
      if (currentTemp > temperatureMax) return 'above';
      if (currentTemp < temperatureMin) return 'below';
      return 'ok';
    }
    return 'ok';
  };

  const tempStatus = isTermostatoDevice ? calculateTempStatus() : null;
  // RFC-0175: Pass deviceProfile and solenoidStatus to getDeviceImageUrl for SOLENOIDE detection
  const deviceImageUrl = getDeviceImageUrl(deviceType, percentageForDisplay, {
    tempStatus,
    isOffline,
    deviceProfile,
    solenoidStatus,
  });

  // Calculate temperature deviation percentage
  const calculateTempDeviationPercent = () => {
    const currentTemp = Number(val) || 0;
    if (temperatureMin !== undefined && temperatureMax !== undefined) {
      const avgTemp = (Number(temperatureMin) + Number(temperatureMax)) / 2;
      if (avgTemp === 0) return { value: 0, sign: '' };
      const deviation = ((currentTemp - avgTemp) / avgTemp) * 100;
      return {
        value: Math.abs(deviation),
        sign: deviation >= 0 ? '+' : '-',
        isAbove: deviation > 0,
        isBelow: deviation < 0,
      };
    }
    return null;
  };

  const tempDeviationPercent = isTermostatoDevice ? calculateTempDeviationPercent() : null;

  // Create card HTML
  const cardHTML = `
    <div class="device-card-centered clickable ${cardEntity.status === 'offline' ? 'offline' : ''}"
        data-entity-id="${entityId}"
        data-device-type="${String(deviceType || '').toUpperCase()}"
        draggable="${enableDragDrop}"
        tabindex="0"
        role="article"
        aria-label="${cardEntity.name}, ${cardEntity.group}">

      <div class="device-card-inner">
        <div class="device-card-front">
          ${
            enableSelection && typeof handleSelect === 'function'
              ? `<input type="checkbox" class="card-checkbox action-checker" aria-label="Select ${cardEntity.name}" style="position: absolute; top: 8px; right: 8px; z-index: 10;">`
              : ''
          }

          <div class="device-card-body" style="display:flex;flex-direction:column;justify-content:center;align-items:center; flex-grow: 1; min-width: 0; position: relative;">

            <div class="device-title-row">
              <span class="device-title" title="${cardEntity.name}">
                ${
                  cardEntity.name.length > LABEL_CHAR_LIMIT
                    ? cardEntity.name.slice(0, LABEL_CHAR_LIMIT) + '…'
                    : cardEntity.name
                }
              </span>
              ${
                deviceIdentifier
                  ? `<span class="device-subtitle" title="${deviceIdentifier}">${deviceIdentifier}</span>`
                  : ''
              }
            </div>

            <div class="device-image-wrapper">
              <img class="device-image ${isTermostatoDevice ? 'temp-tooltip-trigger' : ''}${
    isEnergyDeviceFlag ? ' energy-tooltip-trigger' : ''
  }" src="${deviceImageUrl}" alt="${deviceType}" style="${
    isTermostatoDevice || isEnergyDeviceFlag ? 'cursor: help;' : ''
  }" />
            </div>

            ${
              customerName && String(customerName).trim() !== ''
                ? `
              <div class="myio-v5-shopping-badge-row">
                <span class="myio-v5-shopping-badge" title="${customerName}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chip-icon"><path d="M4 22h16"/><path d="M7 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/></svg>
                  <span style="font-size: 0.65rem;">${customerName}</span>
                </span>
              </div>
            `
                : ''
            }

            <div class="device-data-row">
              <div class="consumption-main">
                <span class="flash-icon ${shouldFlashIcon ? 'flash' : ''}">
                  ${icon}
                </span>
                <span class="consumption-value">${formatCardValue(cardEntity.lastValue, deviceType, deviceProfile)}</span>
              </div>
            </div>
            ${
              !isTermostatoDevice
                ? `<span class="device-percentage-badge percentage-tooltip-trigger" style="position: absolute; bottom: 12px; right: 12px; z-index: 20; background: none !important; cursor: help;">${percentageForDisplay.toFixed(
                    1
                  )}%</span>`
                : tempDeviationPercent
                ? `<span class="device-percentage-badge temp-deviation-badge temp-comparison-tooltip-trigger" style="position: absolute; bottom: 12px; right: 12px; z-index: 20; background: none !important; color: ${
                    tempDeviationPercent.isAbove
                      ? '#ef4444'
                      : tempDeviationPercent.isBelow
                      ? '#3b82f6'
                      : '#6b7280'
                  }; font-weight: 600; cursor: help;">${
                    tempDeviationPercent.sign
                  }${tempDeviationPercent.value.toFixed(1)}%</span>`
                : ''
            }
          </div>
        </div>
      </div>

      <div style="display: none;" class="connection-status-icon" data-conn="${connectionStatus}" data-state="${deviceStatus}" aria-label="${connectionStatus}"></div>

    </div>
  `;

  container.innerHTML = cardHTML;
  const enhancedCardElement = container.querySelector('.device-card-centered');

  // Add premium layout styles - V6
  if (!document.getElementById('myio-enhanced-card-layout-styles-v6')) {
    const layoutStyle = document.createElement('style');
    layoutStyle.id = 'myio-enhanced-card-layout-styles-v6';
    layoutStyle.textContent = `
      /* ===== MYIO Card v6 — Standalone with CustomStyle Support ===== */

      .device-card-centered.clickable {
        width: 90% !important;
        max-width: 280px !important;
        border-radius: 14px !important;
        padding: 18px !important;
        background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%) !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04) !important;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        border: 1px solid rgba(226, 232, 240, 0.8) !important;
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(10px);
        min-height: var(--card-v6-min-height, 114px) !important;
        margin: 0 auto;
      }

      .device-card-centered.clickable::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #00e09e 0%, #00b4d8 50%, #7209b7 100%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .device-card-centered.clickable:hover {
        transform: translateY(-4px) scale(1.02) !important;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.08) !important;
        border-color: rgba(0, 224, 158, 0.3) !important;
      }

      .device-card-centered.clickable:hover::before {
        opacity: 1;
      }

      .device-card-centered.selected {
        border: 2px solid #00e09e !important;
        box-shadow: 0 12px 40px rgba(0, 224, 158, 0.25), 0 4px 12px rgba(0, 224, 158, 0.15) !important;
        background: linear-gradient(145deg, #f0fdf9 0%, #ecfdf5 50%, #f0fdf9 100%) !important;
        transform: translateY(-2px) !important;
      }

      .device-card-centered.offline {
        border: 2px solid #ef4444 !important;
        background: linear-gradient(145deg, #fef2f2 0%, #fee2e2 50%, #fef2f2 100%) !important;
        animation: premium-offline-pulse-v6 2s infinite !important;
      }

      @keyframes premium-offline-pulse-v6 {
        0%, 100% {
          box-shadow: 0 8px 32px rgba(239, 68, 68, 0.15), 0 2px 8px rgba(239, 68, 68, 0.1);
        }
        50% {
          box-shadow: 0 12px 40px rgba(239, 68, 68, 0.25), 0 4px 12px rgba(239, 68, 68, 0.2);
        }
      }

      .device-card-centered .device-data-row {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
      }

      .device-card-centered .device-card-body {
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;
        padding: 18px 6px 6px 6px !important;
        margin: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }

      .device-card-centered .device-image-wrapper {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
        margin-bottom: 4px !important;
      }

      .device-card-centered .device-image {
        max-height: 44px !important;
        width: auto;
        margin: 0 !important;
        display: block;
        filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.1));
        transition: all 0.3s ease;
        border-radius: 7px;
      }

      .device-card-centered:hover .device-image {
        filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.15));
        transform: scale(1.05);
      }

      .device-card-centered .device-data-row {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
      }

      .device-card-centered .device-percentage-badge {
        display: none !important;
      }

      .device-card-centered .device-title-row {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: flex-start !important;
        text-align: left !important;
        position: absolute !important;
        top: -2px !important;
        left: 0px !important;
        right: auto !important;
        width: auto !important;
        max-width: calc(100% - 8px) !important;
        min-height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        z-index: 5 !important;
      }

      .device-card-centered .device-title {
        font-weight: 600 !important;
        font-size: 0.75rem !important;
        color: #1e293b !important;
        margin: 0 0 1px 0 !important;
        display: block !important;
        text-align: left !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        line-height: 1.2 !important;
      }

      .device-card-centered .device-subtitle {
        font-size: 0.55rem !important;
        color: #94a3b8 !important;
        font-weight: 400 !important;
        letter-spacing: 0.02em;
        opacity: 0.9;
        display: block !important;
        text-align: left !important;
        margin: 0 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .device-card-centered .consumption-main {
        background: linear-gradient(135deg, rgba(0, 224, 158, 0.1) 0%, rgba(0, 180, 216, 0.1) 100%);
        border-radius: 8px;
        padding: 4px 8px;
        margin-top: 5px;
        border: 1px solid rgba(0, 224, 158, 0.2);
      }

      .device-card-centered .consumption-value {
        font-weight: 700 !important;
        font-size: 0.75rem !important;
        color: #059669 !important;
      }

      .device-card-centered .flash-icon {
        font-size: 0.85rem !important;
        margin-right: 5px;
        transition: all 0.3s ease;
      }

      .device-card-centered .flash-icon.flash {
        animation: premium-flash-v6 1.5s infinite;
      }

      @keyframes premium-flash-v6 {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.3; transform: scale(1.15); }
      }

      /* Piano-Key Actions */
      .device-card-centered .card-actions {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        padding: 6px 0;
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        gap: 0;
        border: 1px solid rgba(226, 232, 240, 0.9);
        border-radius: 8px;
        background: #fff;
        overflow: visible;
        z-index: 10;
        max-height: 72%;
        width: 34px;
      }

      .device-card-centered .card-action {
        width: 28px !important;
        height: 26px !important;
        min-height: 26px !important;
        border: 0;
        background: #fff !important;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        border-radius: 6px;
        transition: transform 0.18s ease;
      }

      .device-card-centered .card-action:hover {
        background: rgba(91, 46, 188, 0.1) !important;
        transform: translateY(-2px) scale(1.05);
      }

      .device-card-centered .card-action img {
        width: 16px !important;
        height: 16px !important;
        filter: grayscale(0.2) brightness(0.85);
        transition: transform 0.18s ease, filter 0.18s ease;
      }

      .device-card-centered .card-action:hover img {
        filter: grayscale(0) brightness(1);
        transform: scale(1.08);
      }

      /* Shopping badge */
      .myio-v5-shopping-badge-row {
        width: 100%;
        text-align: center;
        margin-bottom: 8px;
      }

      .myio-v5-shopping-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background-color: #EBF4FF;
        border: 1px solid #BEE3F8;
        color: #2C5282;
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 500;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        max-width: 90%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .device-card-centered.clickable {
          padding: 16px !important;
          border-radius: 12px !important;
          min-height: 110px !important;
        }

        .device-card-centered .device-image {
          max-height: 44px !important;
          margin: 3px 0 !important;
        }
      }

      /* Dark mode */
      @media (prefers-color-scheme: dark) {
        .device-card-centered.clickable {
          background: linear-gradient(145deg, #1e293b 0%, #334155 100%) !important;
          border-color: rgba(71, 85, 105, 0.8) !important;
          color: #f1f5f9 !important;
        }

        .myio-v5-shopping-badge {
          background-color: #334155;
          border-color: #475569;
          color: #cbd5e1;
        }

        .device-card-centered .device-title {
          color: #f1f5f9 !important;
        }

        .device-card-centered .device-subtitle {
          color: #94a3b8 !important;
        }

        .device-card-centered .card-actions {
          border-color: rgba(71, 85, 105, 0.8);
          background: #1e293b;
        }

        .device-card-centered .card-action {
          background: #1e293b !important;
        }
      }
    `;
    document.head.appendChild(layoutStyle);
  }

  // Create action buttons container
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'card-actions';

  // Add action buttons
  if (typeof handleActionDashboard === 'function') {
    const dashboardBtn = document.createElement('button');
    dashboardBtn.className = 'card-action action-dashboard';
    dashboardBtn.title = 'Dashboard';
    dashboardBtn.innerHTML =
      '<img src="https://dashboard.myio-bas.com/api/images/public/TAVXE0sTbCZylwGsMF9lIWdllBB3iFtS"/>';
    dashboardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleActionDashboard(entityObject);
    });
    actionsContainer.appendChild(dashboardBtn);
  }

  if (typeof handleActionReport === 'function') {
    const reportBtn = document.createElement('button');
    reportBtn.className = 'card-action action-report';
    reportBtn.title = 'Relatório';
    reportBtn.innerHTML =
      '<img src="https://dashboard.myio-bas.com/api/images/public/d9XuQwMYQCG2otvtNSlqUHGavGaSSpz4"/>';
    reportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleActionReport(entityObject);
    });
    actionsContainer.appendChild(reportBtn);
  }

  if (typeof handleActionSettings === 'function') {
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'card-action action-settings';
    settingsBtn.title = 'Configurações';
    settingsBtn.innerHTML =
      '<img src="https://dashboard.myio-bas.com/api/images/public/5n9tze6vED2uwIs5VvJxGzNNZ9eV4yoz"/>';
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleActionSettings(entityObject, {
        includeInfo: true,
        connectionData: {
          centralName,
          connectionStatusTime,
          timeVal,
          deviceStatus,
          lastDisconnectTime,
        },
      });
    });
    actionsContainer.appendChild(settingsBtn);
  }

  // Insert actions container into the card
  if (enhancedCardElement && actionsContainer.children.length > 0) {
    enhancedCardElement.insertBefore(actionsContainer, enhancedCardElement.firstChild);
  }

  // Handle selection events
  if (enableSelection && MyIOSelectionStore) {
    const checkbox = enhancedCardElement.querySelector('.card-checkbox');

    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();

        if (e.target.checked) {
          const currentCount = MyIOSelectionStore.getSelectedEntities().length;

          if (currentCount >= 6) {
            e.preventDefault();
            e.target.checked = false;
            MyIOToast.show('Não é possível selecionar mais de 6 itens.', 'warning');
            return;
          }

          MyIOSelectionStore.add(entityId);
        } else {
          MyIOSelectionStore.remove(entityId);
        }
      });
    }

    const handleSelectionChange = (data) => {
      const isSelected = data.selectedIds.includes(entityId);
      if (checkbox) {
        checkbox.checked = isSelected;
      }
      enhancedCardElement.classList.toggle('selected', isSelected);
    };

    MyIOSelectionStore.on('selection:change', handleSelectionChange);

    const isInitiallySelected = MyIOSelectionStore.isSelected(entityId);
    if (checkbox) {
      checkbox.checked = isInitiallySelected;
    }
    enhancedCardElement.classList.toggle('selected', isInitiallySelected);

    container._cleanup = () => {
      MyIOSelectionStore.off('selection:change', handleSelectionChange);
    };
  }

  // Handle drag and drop
  if (enableDragDrop) {
    enhancedCardElement.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/myio-id', entityId);
      e.dataTransfer.setData('application/json', JSON.stringify(entityObject));
      e.dataTransfer.setData('text/myio-name', entityObject.labelOrName);
      e.dataTransfer.effectAllowed = 'copy';

      if (MyIOSelectionStore) {
        MyIOSelectionStore.startDrag(entityId);
      }
    });
  }

  // Handle card clicks
  if (typeof handleClickCard === 'function') {
    enhancedCardElement.addEventListener('click', (e) => {
      if (!e.target.closest('.card-action') && !e.target.closest('.card-checkbox')) {
        handleClickCard(entityObject);
      }
    });
  }

  // Attach tooltips
  const tempTooltipTrigger = enhancedCardElement.querySelector('.temp-tooltip-trigger');
  let tempTooltipCleanup = null;
  if (showTempRangeTooltip && tempTooltipTrigger && isTermostatoDevice) {
    const tooltipEntityData = {
      val: val,
      temperatureMin: temperatureMin,
      temperatureMax: temperatureMax,
      labelOrName: cardEntity.name,
      name: cardEntity.name,
    };
    tempTooltipCleanup = TempRangeTooltip.attach(tempTooltipTrigger, tooltipEntityData);
  }

  const energyTooltipTrigger = enhancedCardElement.querySelector('.energy-tooltip-trigger');
  let energyTooltipCleanup = null;
  if (showEnergyRangeTooltip && energyTooltipTrigger && isEnergyDeviceFlag) {
    const energyTooltipData = {
      labelOrName: cardEntity.name,
      name: cardEntity.name,
      instantaneousPower: entityObject.instantaneousPower ?? entityObject.consumption_power ?? val,
      powerRanges: entityObject.powerRanges || entityObject.ranges,
    };
    energyTooltipCleanup = EnergyRangeTooltip.attach(energyTooltipTrigger, energyTooltipData);
  }

  const percentageTooltipTrigger = enhancedCardElement.querySelector('.percentage-tooltip-trigger');
  let percentageTooltipCleanup = null;
  if (showPercentageTooltip && percentageTooltipTrigger && !isTermostatoDevice) {
    const getComparisonData = () => {
      const categoryData = entityObject.categoryComparison || {
        name: `Todos ${deviceType || 'Dispositivos'}`,
        total: entityObject.categoryTotal || cardEntity.lastValue,
        deviceCount: entityObject.categoryDeviceCount || 1,
      };

      const widgetData = entityObject.widgetComparison || {
        name: entityObject.widgetScopeName || 'Area Comum',
        total: entityObject.widgetTotal || cardEntity.lastValue,
        deviceCount: entityObject.widgetDeviceCount || 1,
      };

      const grandTotalData = entityObject.grandTotalComparison || {
        name: 'Area Comum + Lojas',
        total: entityObject.grandTotal || cardEntity.lastValue,
        deviceCount: entityObject.grandTotalDeviceCount || 1,
      };

      return DeviceComparisonTooltip.buildComparisonData(
        {
          entityId: entityId,
          labelOrName: cardEntity.name,
          deviceType: deviceType,
          val: cardEntity.lastValue,
          perc: percentageForDisplay,
        },
        categoryData,
        widgetData,
        grandTotalData
      );
    };

    percentageTooltipCleanup = DeviceComparisonTooltip.attach(percentageTooltipTrigger, getComparisonData);
  }

  const tempComparisonTrigger = enhancedCardElement.querySelector('.temp-comparison-tooltip-trigger');
  let tempComparisonCleanup = null;
  if (showTempComparisonTooltip && tempComparisonTrigger && isTermostatoDevice && tempDeviationPercent) {
    const getTempComparisonData = () => {
      const avgTemp =
        entityObject.averageTemperature ??
        entityObject.avgTemp ??
        (Number(temperatureMin) + Number(temperatureMax)) / 2;
      const deviceCount = entityObject.temperatureDeviceCount ?? entityObject.tempDeviceCount ?? 1;

      return TempComparisonTooltip.buildComparisonData(
        {
          entityId: entityId,
          labelOrName: cardEntity.name,
          currentTemp: Number(val) || 0,
          minTemp: Number(temperatureMin) || 18,
          maxTemp: Number(temperatureMax) || 26,
        },
        {
          name: entityObject.averageName || 'Media Geral',
          value: Number(avgTemp) || 0,
          deviceCount: deviceCount,
        }
      );
    };

    tempComparisonCleanup = TempComparisonTooltip.attach(tempComparisonTrigger, getTempComparisonData);
  }

  // Store cleanup function for tooltips
  container._cleanup = () => {
    if (tempTooltipCleanup) tempTooltipCleanup();
    if (energyTooltipCleanup) energyTooltipCleanup();
    if (percentageTooltipCleanup) percentageTooltipCleanup();
    if (tempComparisonCleanup) tempComparisonCleanup();
  };

  // V6: Apply customStyle overrides if provided
  if (customStyle) {
    applyCustomStyle(container, customStyle);
  }

  // V6: Add annotation badges if log_annotations exists
  if (entityObject.log_annotations) {
    addAnnotationIndicatorToCard(enhancedCardElement, entityObject, cardEntity.name);
  }

  // Return jQuery-like object for compatibility
  const jQueryLikeObject = {
    get: (index) => (index === 0 ? container : undefined),
    0: container,
    length: 1,
    find: (selector) => {
      const found = container.querySelector(selector);
      return {
        get: (index) => (index === 0 ? found : undefined),
        0: found,
        length: found ? 1 : 0,
        on: (event, handler) => {
          if (found) found.addEventListener(event, handler);
          return this;
        },
      };
    },
    on: (event, handler) => {
      container.addEventListener(event, handler);
      return this;
    },
    addClass: (className) => {
      container.classList.add(className);
      return this;
    },
    removeClass: (className) => {
      container.classList.remove(className);
      return this;
    },
    destroy: () => {
      if (container._cleanup) {
        container._cleanup();
      }
    },
  };

  return jQueryLikeObject;
}

// Backward-compatible alias
export function renderCardComponent(options) {
  return renderCardComponentV6(options);
}
