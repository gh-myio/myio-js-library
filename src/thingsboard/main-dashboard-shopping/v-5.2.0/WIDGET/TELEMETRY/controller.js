/* global self, window, document */

/* =========================================================================
 * ThingsBoard Widget: Device Cards with Totals & Percentages (MyIO)
 * - Datas obrigatórias: startDateISO / endDateISO
 * - Se ausentes no onInit: usa "current month so far" (1º dia 00:00 → hoje 23:59)
 * - Modal premium (busy) no widget durante carregamentos
 * - Modal premium global (fora do widget) para sucesso, com contador e reload
 * - onDataUpdated: no-op
 * - Evento (myio:update-date): mostra modal + atualiza
 * =========================================================================*/

/* eslint-disable no-undef, no-unused-vars */

// RFC-0091: Use LogHelper from MAIN via MyIOUtils (centralized logging)
if (!window.MyIOUtils?.LogHelper) {
  console.error('[TELEMETRY] window.MyIOUtils.LogHelper not found - MAIN_VIEW must load first');
}
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: () => {},
  warn: () => {},
  error: (...args) => console.error('[TELEMETRY]', ...args),
};

LogHelper.log('🚀 [TELEMETRY] Controller loaded - VERSION WITH ORCHESTRATOR SUPPORT');

/**
 * RFC-0097: Configuração centralizada de classificação de dispositivos
 * Todas as regras de mapeamento deviceType → categoria estão aqui
 */
const DEVICE_CLASSIFICATION_CONFIG = {
  // DeviceTypes que pertencem à categoria Climatização
  // Baseado em src/MYIO-SIM/v5.2.0/mapPower.json
  climatizacao: {
    // DeviceTypes que são SEMPRE climatização (independente do identifier)
    deviceTypes: ['CHILLER', 'AR_CONDICIONADO', 'HVAC', 'FANCOIL'],
    // DeviceTypes genéricos que só são climatização SE tiverem identifier de climatização
    conditionalDeviceTypes: ['BOMBA', 'MOTOR'],
    // Identifiers que indicam climatização (usado para deviceTypes condicionais)
    identifiers: ['CAG', 'FANCOIL'],
    identifierPrefixes: ['CAG-', 'FANCOIL-'],
  },
  // DeviceTypes que pertencem à categoria Elevadores
  elevadores: {
    deviceTypes: ['ELEVADOR'],
    identifiers: ['ELV', 'ELEVADOR', 'ELEVADORES'],
    identifierPrefixes: ['ELV-', 'ELEVADOR-'],
  },
  // DeviceTypes que pertencem à categoria Escadas Rolantes
  escadas_rolantes: {
    deviceTypes: ['ESCADA_ROLANTE'],
    identifiers: ['ESC', 'ESCADA', 'ESCADASROLANTES'],
    identifierPrefixes: ['ESC-', 'ESCADA-', 'ESCADA_'],
  },
};

// Inject styles for type badges
function injectBadgeStyles() {
  if (document.getElementById('annotation-type-badges-styles')) return;

  const style = document.createElement('style');
  style.id = 'annotation-type-badges-styles';
  style.textContent = `
          .annotation-type-badges {
              position: absolute;
              top: 50%;
              right: 6px;
              transform: translateY(-50%);
              display: flex;
              flex-direction: column;
              gap: 4px;
              z-index: 10;
          }

          .annotation-type-badge {
              position: relative;
              width: 22px;
              height: 22px;
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              cursor: pointer;
              transition: all 0.2s ease;
              box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          }

          .annotation-type-badge:hover {
              transform: scale(1.15);
              box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          }

          .annotation-type-badge__count {
              position: absolute;
              top: -4px;
              right: -4px;
              min-width: 14px;
              height: 14px;
              padding: 0 3px;
              background: #1a1a2e;
              color: white;
              border-radius: 7px;
              font-size: 9px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              line-height: 1;
          }

          /* Summary tooltip - positioned via JS to avoid card overflow */
          .annotation-summary-tooltip {
              position: fixed;
              min-width: 240px;
              max-width: 300px;
              background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
              border: 1px solid rgba(0, 0, 0, 0.1);
              border-radius: 10px;
              padding: 0;
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
              font-family: 'Inter', system-ui, sans-serif;
              font-size: 12px;
              color: #1a1a2e;
              opacity: 0;
              visibility: hidden;
              transition: opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease;
              pointer-events: none;
              z-index: 9999;
          }

          .annotation-summary-tooltip.visible {
              opacity: 1;
              visibility: visible;
              pointer-events: auto;
          }

          .annotation-summary-tooltip.closing {
              opacity: 0;
              transform: scale(0.95);
          }

          .annotation-summary-tooltip.pinned {
              box-shadow: 0 0 0 2px #6366f1, 0 8px 24px rgba(0, 0, 0, 0.2);
          }

          .annotation-summary-tooltip.maximized {
              min-width: 400px;
              max-width: 600px;
              max-height: 80vh;
              overflow-y: auto;
              position: fixed;
              left: 50% !important;
              top: 50% !important;
              transform: translate(-50%, -50%) !important;
          }

          .annotation-summary-tooltip.maximized .annotation-summary-tooltip__content {
              max-height: calc(80vh - 50px);
              overflow-y: auto;
          }

          .annotation-summary-tooltip.dragging {
              cursor: move;
              user-select: none;
          }

          .annotation-summary-tooltip__header {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 10px 12px;
              background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 100%);
              border-radius: 10px 10px 0 0;
              border-bottom: 1px solid rgba(0, 0, 0, 0.1);
              cursor: move;
              user-select: none;
          }

          .annotation-summary-tooltip__header-title {
              font-weight: 600;
              font-size: 13px;
              flex: 1;
              display: flex;
              align-items: center;
              gap: 6px;
              color: #1a1a2e;
          }

          .annotation-summary-tooltip__header-actions {
              display: flex;
              align-items: center;
              gap: 4px;
          }

          .annotation-summary-tooltip__header-btn {
              width: 22px;
              height: 22px;
              border: none;
              background: rgba(255, 255, 255, 0.6);
              border-radius: 4px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.15s ease;
              color: #64748b;
          }

          .annotation-summary-tooltip__header-btn:hover {
              background: rgba(255, 255, 255, 0.9);
              color: #1e293b;
          }

          .annotation-summary-tooltip__header-btn.pinned {
              background: #6366f1;
              color: white;
          }

          .annotation-summary-tooltip__header-btn.pinned:hover {
              background: #4f46e5;
              color: white;
          }

          .annotation-summary-tooltip__header-btn svg {
              width: 12px;
              height: 12px;
          }

          .annotation-summary-tooltip__content {
              padding: 12px 14px;
          }

          .annotation-summary-tooltip::after {
              content: '';
              position: absolute;
              top: 50%;
              transform: translateY(-50%);
              border: 8px solid transparent;
          }

          /* Arrow pointing left (tooltip on right side) */
          .annotation-summary-tooltip.arrow-left::after {
              left: -8px;
              border-right-color: #ffffff;
              border-left-color: transparent;
          }

          /* Arrow pointing right (tooltip on left side) */
          .annotation-summary-tooltip.arrow-right::after {
              right: -8px;
              border-left-color: #ffffff;
              border-right-color: transparent;
          }

          .annotation-summary-tooltip__title {
              font-weight: 600;
              font-size: 13px;
              margin-bottom: 10px;
              padding-bottom: 8px;
              border-bottom: 1px solid rgba(0, 0, 0, 0.1);
              display: flex;
              align-items: center;
              gap: 6px;
              color: #1a1a2e;
          }

          .annotation-summary-tooltip__row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 4px 0;
          }

          .annotation-summary-tooltip__label {
              display: flex;
              align-items: center;
              gap: 6px;
              color: #495057;
          }

          .annotation-summary-tooltip__dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
          }

          .annotation-summary-tooltip__value {
              font-weight: 600;
              color: #1a1a2e;
          }

          .annotation-summary-tooltip__latest {
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid rgba(0, 0, 0, 0.1);
              font-size: 11px;
          }

          .annotation-summary-tooltip__latest-label {
              color: #6c757d;
              margin-bottom: 4px;
          }

          .annotation-summary-tooltip__latest-text {
              color: #343a40;
              line-height: 1.4;
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
          }

          .annotation-summary-tooltip__latest-meta {
              color: #868e96;
              font-size: 10px;
              margin-top: 4px;
          }

          .annotation-summary-tooltip__overdue {
              color: #d63031;
              margin-top: 8px;
              font-size: 11px;
              font-weight: 500;
          }
      `;
  document.head.appendChild(style);
}

// Function to add annotation type badges to a card
function addAnnotationIndicator(cardElement, entityObject) {
  console.log(`[TELEMETRY] Adding annotation indicators for ${entityObject.labelOrName}`, entityObject);

  const annotations = entityObject.log_annotations.annotations;

  if (entityObject.labelOrName === 'Chiller 1') {
    console.log(`[TELEMETRY] Adding annotation indicators for ${entityObject.labelOrName}`, annotations);
  }

  // Ensure styles are injected
  injectBadgeStyles();

  // Create wrapper for positioning
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

  const now = new Date();

  activeAnnotations.forEach((a) => {
    if (annotationsByType[a.type] !== undefined) {
      annotationsByType[a.type].push(a);
    }
  });

  // Create badges container
  const container = document.createElement('div');
  container.className = 'annotation-type-badges';

  // Priority order: pending, maintenance, activity, observation
  const typeOrder = ['pending', 'maintenance', 'activity', 'observation'];

  const TYPE_CONFIG = {
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

  // Helper function to setup pinned clone listeners
  function setupPinnedCloneListeners(cloneEl) {
    let isMaximized = false;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let savedPosition = null;

    const closeBtn = cloneEl.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cloneEl.classList.add('closing');
        setTimeout(() => cloneEl.remove(), 200);
      });
    }

    const maxBtn = cloneEl.querySelector('[data-action="maximize"]');
    if (maxBtn) {
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isMaximized = !isMaximized;
        if (isMaximized) {
          savedPosition = {
            left: cloneEl.style.left,
            top: cloneEl.style.top,
            transform: cloneEl.style.transform,
          };
          cloneEl.classList.add('maximized');
          cloneEl.style.left = '50%';
          cloneEl.style.top = '50%';
          cloneEl.style.transform = 'translate(-50%, -50%)';
        } else {
          cloneEl.classList.remove('maximized');
          if (savedPosition) {
            cloneEl.style.left = savedPosition.left;
            cloneEl.style.top = savedPosition.top;
            cloneEl.style.transform = savedPosition.transform;
          }
        }
      });
    }

    const pinBtn = cloneEl.querySelector('[data-action="pin"]');
    if (pinBtn) {
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cloneEl.classList.add('closing');
        setTimeout(() => cloneEl.remove(), 200);
      });
    }

    const dragHandle = cloneEl.querySelector('[data-drag-handle]');
    if (dragHandle) {
      dragHandle.style.cursor = 'move';
      dragHandle.addEventListener('mousedown', (e) => {
        if (e.target.closest('[data-action]')) return;
        isDragging = true;
        cloneEl.classList.add('dragging');
        const rect = cloneEl.getBoundingClientRect();
        dragOffset = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        e.preventDefault();
      });
    }

    const onMouseMove = (e) => {
      if (!isDragging) return;
      cloneEl.style.left = `${e.clientX - dragOffset.x}px`;
      cloneEl.style.top = `${e.clientY - dragOffset.y}px`;
      cloneEl.style.transform = 'none';
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        cloneEl.classList.remove('dragging');
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // Create a tooltip for each badge type
  typeOrder.forEach((type) => {
    const typeAnnotations = annotationsByType[type];
    if (typeAnnotations.length === 0) return;

    const config = TYPE_CONFIG[type];
    const badge = document.createElement('div');
    badge.className = 'annotation-type-badge';
    badge.style.background = config.color;
    badge.innerHTML = `
      <span>${config.icon}</span>
      <span class="annotation-type-badge__count">${typeAnnotations.length}</span>
    `;

    // Count overdue for this type
    const typeOverdueCount = typeAnnotations.filter(
      (a) => a.dueDate && new Date(a.dueDate) < now
    ).length;

    // Create tooltip specific to this type
    const latestAnnotation = typeAnnotations[0];
    const tooltipId = `annotation-tooltip-${entityObject.entityId || Date.now()}-${type}`;

    const overdueWarning =
      typeOverdueCount > 0
        ? `<div class="annotation-summary-tooltip__overdue">⚠️ ${typeOverdueCount} anotação(ões) vencida(s)</div>`
        : '';

    // Build annotations list
    const annotationsList = typeAnnotations
      .slice(0, 5)
      .map(
        (a) => `
        <div class="annotation-summary-tooltip__row" style="flex-direction: column; align-items: flex-start; gap: 2px;">
          <div style="font-weight: 500; color: #1a1a2e;">"${a.text}"</div>
          <div style="font-size: 10px; color: #868e96;">
            ${a.createdBy?.name || 'N/A'} • ${new Date(a.createdAt).toLocaleDateString('pt-BR')}
            ${a.dueDate ? ` • Vence: ${new Date(a.dueDate).toLocaleDateString('pt-BR')}` : ''}
          </div>
        </div>
      `
      )
      .join('');

    const moreCount = typeAnnotations.length > 5 ? typeAnnotations.length - 5 : 0;
    const moreSection =
      moreCount > 0 ? `<div style="font-size: 11px; color: #6c757d; margin-top: 8px;">+ ${moreCount} mais...</div>` : '';

    const tooltip = document.createElement('div');
    tooltip.className = 'annotation-summary-tooltip';
    tooltip.id = tooltipId;
    tooltip.innerHTML = `
      <div class="annotation-summary-tooltip__header" data-drag-handle>
        <span class="annotation-summary-tooltip__header-title">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${config.color};"></span>
          ${config.icon} ${config.label} (${typeAnnotations.length})
        </span>
        <div class="annotation-summary-tooltip__header-actions">
          <button class="annotation-summary-tooltip__header-btn" data-action="pin" title="Fixar na tela">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
              <line x1="12" y1="16" x2="12" y2="21"/>
              <line x1="8" y1="4" x2="16" y2="4"/>
            </svg>
          </button>
          <button class="annotation-summary-tooltip__header-btn" data-action="maximize" title="Maximizar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          </button>
          <button class="annotation-summary-tooltip__header-btn" data-action="close" title="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="annotation-summary-tooltip__content">
        ${overdueWarning}
        ${annotationsList}
        ${moreSection}
      </div>
    `;

    document.body.appendChild(tooltip);

    // Tooltip state management
    let hideTimer = null;
    let isMouseOverTooltip = false;
    let pinnedCounter = 0;

    function positionTooltip(targetRect) {
      const tooltipWidth = 260;
      const spacing = 12;
      const viewportWidth = window.innerWidth;
      const rightPosition = targetRect.right + spacing;
      const canFitRight = rightPosition + tooltipWidth < viewportWidth;

      tooltip.classList.remove('arrow-left', 'arrow-right');
      if (canFitRight) {
        tooltip.style.left = `${rightPosition}px`;
        tooltip.classList.add('arrow-left');
      } else {
        tooltip.style.left = `${targetRect.left - tooltipWidth - spacing}px`;
        tooltip.classList.add('arrow-right');
      }
      tooltip.style.top = `${targetRect.top + targetRect.height / 2}px`;
      tooltip.style.transform = 'translateY(-50%)';
    }

    function showTooltip() {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      tooltip.classList.remove('closing');
      tooltip.classList.add('visible');
    }

    function hideTooltipWithDelay() {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!isMouseOverTooltip) {
          tooltip.classList.add('closing');
          setTimeout(() => {
            tooltip.classList.remove('visible', 'closing');
          }, 200);
        }
      }, 1500);
    }

    function createPinnedClone() {
      pinnedCounter++;
      const pinnedId = `${tooltipId}-pinned-${pinnedCounter}`;
      const clone = tooltip.cloneNode(true);
      clone.id = pinnedId;
      clone.classList.add('pinned');
      clone.classList.remove('arrow-left', 'arrow-right');

      const pinBtn = clone.querySelector('[data-action="pin"]');
      if (pinBtn) {
        pinBtn.classList.add('pinned');
        pinBtn.title = 'Fixado';
      }

      document.body.appendChild(clone);
      setupPinnedCloneListeners(clone);
      tooltip.classList.remove('visible');
    }

    // Badge hover events
    badge.addEventListener('mouseenter', () => {
      const rect = badge.getBoundingClientRect();
      positionTooltip(rect);
      showTooltip();
    });

    badge.addEventListener('mouseleave', () => {
      hideTooltipWithDelay();
    });

    // Tooltip hover detection
    tooltip.addEventListener('mouseenter', () => {
      isMouseOverTooltip = true;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    });

    tooltip.addEventListener('mouseleave', () => {
      isMouseOverTooltip = false;
      hideTooltipWithDelay();
    });

    // Tooltip button handlers
    const pinBtn = tooltip.querySelector('[data-action="pin"]');
    const maxBtn = tooltip.querySelector('[data-action="maximize"]');
    const closeBtn = tooltip.querySelector('[data-action="close"]');

    if (pinBtn) {
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        createPinnedClone();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tooltip.classList.add('closing');
        setTimeout(() => {
          tooltip.classList.remove('visible', 'closing');
        }, 200);
      });
    }

    if (maxBtn) {
      let isMaximized = false;
      let savedPosition = null;
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isMaximized = !isMaximized;
        if (isMaximized) {
          savedPosition = {
            left: tooltip.style.left,
            top: tooltip.style.top,
            transform: tooltip.style.transform,
          };
          tooltip.classList.add('maximized');
          tooltip.style.left = '50%';
          tooltip.style.top = '50%';
          tooltip.style.transform = 'translate(-50%, -50%)';
        } else {
          tooltip.classList.remove('maximized');
          if (savedPosition) {
            tooltip.style.left = savedPosition.left;
            tooltip.style.top = savedPosition.top;
            tooltip.style.transform = savedPosition.transform;
          }
        }
      });
    }

    container.appendChild(badge);
  });

  // Append badges to card
  cardElement.appendChild(container);

  return container;
}

// Sets pré-computados para lookup rápido
const CLIMATIZACAO_DEVICE_TYPES_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceTypes);
const CLIMATIZACAO_CONDITIONAL_TYPES_SET = new Set(
  DEVICE_CLASSIFICATION_CONFIG.climatizacao.conditionalDeviceTypes || []
);
const ELEVADORES_DEVICE_TYPES_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.elevadores.deviceTypes);
const ESCADAS_DEVICE_TYPES_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.deviceTypes);

const CLIMATIZACAO_IDENTIFIERS_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.climatizacao.identifiers);
const ELEVADORES_IDENTIFIERS_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.elevadores.identifiers);
const ESCADAS_IDENTIFIERS_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.identifiers);

// RFC-0097: Regex para excluir equipamentos ao detectar widget "lojas"
// Construído dinamicamente a partir do config
const EQUIPMENT_EXCLUSION_PATTERN = new RegExp(
  [
    ...DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceTypes,
    ...DEVICE_CLASSIFICATION_CONFIG.elevadores.deviceTypes,
    ...DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.deviceTypes,
    'bomba',
    'subesta',
    'entrada', // Termos adicionais fixos
  ]
    .map((t) => t.toLowerCase())
    .join('|'),
  'i'
);

/**
 * RFC-0097: Infere um identifier para exibição baseado no deviceType ou label
 * Usado quando o atributo identifier está ausente
 * @param {Object} item - Item com deviceType e/ou label
 * @returns {string} Identifier inferido ou 'N/A'
 */
function inferDisplayIdentifier(item) {
  if (!item) return 'N/A';

  // Primeiro, tentar usar deviceType
  const deviceType = String(item.deviceType || '').toUpperCase();
  if (deviceType && deviceType !== 'N/D' && deviceType !== '3F_MEDIDOR') {
    // Se for um deviceType conhecido, retornar o próprio deviceType ou abreviação
    if (CLIMATIZACAO_DEVICE_TYPES_SET.has(deviceType)) {
      return deviceType;
    }
    if (ELEVADORES_DEVICE_TYPES_SET.has(deviceType)) {
      return 'ELV';
    }
    if (ESCADAS_DEVICE_TYPES_SET.has(deviceType)) {
      return 'ESC';
    }
  }

  // Fallback: inferir do label usando deviceTypes do config
  const label = String(item.label || '').toLowerCase();

  // Verificar cada deviceType de climatização no label
  for (const dt of DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceTypes) {
    if (label.includes(dt.toLowerCase())) {
      return dt;
    }
  }
  // Verificar identifiers de climatização
  for (const id of DEVICE_CLASSIFICATION_CONFIG.climatizacao.identifiers) {
    if (label.includes(id.toLowerCase())) {
      return id;
    }
  }

  // Elevadores
  if (label.includes('elevador') || label.includes('elv')) return 'ELV';

  // Escadas
  if (label.includes('escada')) return 'ESC';

  return 'N/A';
}

// RFC-0091: Use shared DATA_API_HOST from MAIN widget via window.MyIOUtils
const DATA_API_HOST = window.MyIOUtils?.DATA_API_HOST;
if (!DATA_API_HOST) {
  console.error(
    '[TELEMETRY] DATA_API_HOST not available from window.MyIOUtils - MAIN widget must load first'
  );
}
const MAX_FIRST_HYDRATES = 1;
let MAP_INSTANTANEOUS_POWER;

/**
 * RFC-0078: Extract consumption ranges from unified JSON structure
 * @param {Object} powerLimitsJSON - The mapInstantaneousPower JSON object
 * @param {string} deviceType - Device type (e.g., 'ELEVADOR')
 * @param {string} telemetryType - Telemetry type (default: 'consumption')
 * @returns {Object|null} Range configuration or null
 */
function extractLimitsFromJSON(powerLimitsJSON, deviceType, telemetryType = 'consumption') {
  if (!powerLimitsJSON || !powerLimitsJSON.limitsByInstantaneoustPowerType) {
    return null;
  }

  // Find telemetry type configuration
  const telemetryConfig = powerLimitsJSON.limitsByInstantaneoustPowerType.find(
    (config) => config.telemetryType === telemetryType
  );

  if (!telemetryConfig) {
    LogHelper.log(`[RFC-0078] Telemetry type ${telemetryType} not found in JSON`);
    return null;
  }

  // Find device type configuration
  const deviceConfig = telemetryConfig.itemsByDeviceType.find(
    (item) => item.deviceType === deviceType || item.deviceType === deviceType.toUpperCase()
  );

  if (!deviceConfig) {
    LogHelper.log(`[RFC-0078] Device type ${deviceType} not found for telemetry ${telemetryType}`);
    return null;
  }

  // Extract ranges by status
  const ranges = {
    standbyRange: { down: 0, up: 0 },
    normalRange: { down: 0, up: 0 },
    alertRange: { down: 0, up: 0 },
    failureRange: { down: 0, up: 0 },
  };

  deviceConfig.limitsByDeviceStatus.forEach((status) => {
    const baseValue = status.limitsValues?.baseValue ?? status.limitsVales?.baseValue ?? 0;
    const topValue = status.limitsValues?.topValue ?? status.limitsVales?.topValue ?? 99999;

    switch (status.deviceStatusName) {
      case 'standBy':
        ranges.standbyRange = { down: baseValue, up: topValue };
        break;
      case 'normal':
        ranges.normalRange = { down: baseValue, up: topValue };
        break;
      case 'alert':
        ranges.alertRange = { down: baseValue, up: topValue };
        break;
      case 'failure':
        ranges.failureRange = { down: baseValue, up: topValue };
        break;
    }
  });

  return {
    ...ranges,
    source: 'json',
    metadata: {
      name: deviceConfig.name,
      description: deviceConfig.description,
      version: powerLimitsJSON.version,
      telemetryType: telemetryType,
    },
  };
}

let __deviceProfileSyncComplete = false;

async function fetchDeviceProfiles() {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('[RFC-0071] JWT token not found');

  const url = '/api/deviceProfile/names?activeOnly=true';

  console.log('[EQUIPMENTS] [RFC-0071] Fetching device profiles...');

  const response = await fetch(url, {
    headers: {
      'X-Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`[RFC-0071] Failed to fetch device profiles: ${response.status}`);
  }

  const profiles = await response.json();

  // Build Map: profileId -> profileName
  const profileMap = new Map();
  profiles.forEach((profile) => {
    const profileId = profile.id.id;
    const profileName = profile.name;
    profileMap.set(profileId, profileName);
  });

  console.log(
    `[EQUIPMENTS] [RFC-0071] Loaded ${profileMap.size} device profiles:`,
    Array.from(profileMap.entries())
      .map(([id, name]) => name)
      .join(', ')
  );

  return profileMap;
}

/**
 * Fetches device details including deviceProfileId
 * @param {string} deviceId - Device entity ID
 * @returns {Promise<Object>}
 */
async function fetchDeviceDetails(deviceId) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('[RFC-0071] JWT token not found');

  const url = `/api/device/${deviceId}`;

  const response = await fetch(url, {
    headers: {
      'X-Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`[RFC-0071] Failed to fetch device ${deviceId}: ${response.status}`);
  }

  return await response.json();
}

/**
 * Saves deviceProfile as a server-scope attribute on the device
 * @param {string} deviceId - Device entity ID
 * @param {string} deviceProfile - Profile name (e.g., "MOTOR", "3F_MEDIDOR")
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function addDeviceProfileAttribute(deviceId, deviceProfile) {
  const t = Date.now();

  try {
    if (!deviceId) throw new Error('deviceId is required');
    if (deviceProfile == null || deviceProfile === '') {
      throw new Error('deviceProfile is required');
    }

    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error('jwt_token not found in localStorage');

    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${token}`,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ deviceProfile }),
    });

    const bodyText = await res.text().catch(() => '');

    if (!res.ok) {
      throw new Error(`[RFC-0071] HTTP ${res.status} ${res.statusText} - ${bodyText}`);
    }

    let data = null;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      // Response may not be JSON
    }

    const dt = Date.now() - t;
    console.log(
      `[EQUIPMENTS] [RFC-0071] ✅ Saved deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms`
    );

    return { ok: true, status: res.status, data };
  } catch (err) {
    const dt = Date.now() - t;
    console.error(
      `[EQUIPMENTS] [RFC-0071] ❌ Failed to save deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms | error: ${
        err?.message || err
      }`
    );
    throw err;
  }
}

/**
 * Main synchronization function
 * Checks all devices and syncs missing deviceProfile attributes
 * @returns {Promise<{synced: number, skipped: number, errors: number}>}
 */
async function syncDeviceProfileAttributes() {
  console.log('[EQUIPMENTS] [RFC-0071] 🔄 Starting device profile synchronization...');

  try {
    // Step 1: Fetch all device profiles
    const profileMap = await fetchDeviceProfiles();

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Step 2: Build a map of devices that need sync
    const deviceMap = new Map();

    self.ctx.data.forEach((data) => {
      const entityId = data.datasource?.entity?.id?.id;
      const existingProfile = data.datasource?.deviceProfile;

      if (!entityId) return;

      // Skip if already has deviceProfile attribute
      if (existingProfile) {
        skipped++;
        return;
      }

      // Store for processing (deduplicate by entityId)
      if (!deviceMap.has(entityId)) {
        deviceMap.set(entityId, {
          entityLabel: data.datasource?.entityLabel,
          entityName: data.datasource?.entityName,
          name: data.datasource?.name,
        });
      }
    });

    console.log(`[EQUIPMENTS] [RFC-0071] Found ${deviceMap.size} devices without deviceProfile attribute`);
    console.log(`[EQUIPMENTS] [RFC-0071] Skipped ${skipped} devices that already have deviceProfile`);

    if (deviceMap.size === 0) {
      console.log('[EQUIPMENTS] [RFC-0071] ✅ All devices already synchronized!');
      return { synced: 0, skipped, errors: 0 };
    }

    // Step 3: Fetch device details and sync attributes
    let processed = 0;
    for (const [entityId, deviceInfo] of deviceMap) {
      processed++;
      const deviceLabel = deviceInfo.entityLabel || deviceInfo.entityName || deviceInfo.name || entityId;

      try {
        console.log(`[EQUIPMENTS] [RFC-0071] Processing ${processed}/${deviceMap.size}: ${deviceLabel}`);

        // Fetch device details to get deviceProfileId
        const deviceDetails = await fetchDeviceDetails(entityId);
        const deviceProfileId = deviceDetails.deviceProfileId?.id;

        if (!deviceProfileId) {
          console.warn(`[EQUIPMENTS] [RFC-0071] ⚠️ Device ${deviceLabel} has no deviceProfileId`);
          errors++;
          continue;
        }

        // Look up profile name from map
        const profileName = profileMap.get(deviceProfileId);

        if (!profileName) {
          console.warn(`[EQUIPMENTS] [RFC-0071] ⚠️ Profile ID ${deviceProfileId} not found in map`);
          errors++;
          continue;
        }

        // Save attribute
        await addDeviceProfileAttribute(entityId, profileName);
        synced++;

        console.log(`[EQUIPMENTS] [RFC-0071] ✅ Synced ${deviceLabel} -> ${profileName}`);

        // Small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[EQUIPMENTS] [RFC-0071] ❌ Failed to sync device ${deviceLabel}:`, error);
        errors++;
      }
    }

    console.log(
      `[EQUIPMENTS] [RFC-0071] 🎉 Sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`
    );

    return { synced, skipped, errors };
  } catch (error) {
    console.error('[EQUIPMENTS] [RFC-0071] ❌ Fatal error during sync:', error);
    throw error;
  }
}

/**
 * Get telemetry data by dataKey name from self.ctx.data
 * @param {string} dataKeyName - The dataKey name to search for
 * @returns {*} The value of the data point, or null if not found
 */
function getData(dataKeyName) {
  if (!self?.ctx?.data) {
    LogHelper.warn('[getData] No ctx.data available');
    return null;
  }

  for (const device of self.ctx.data) {
    if (device.dataKey && device.dataKey.name === dataKeyName) {
      // Return the most recent value (last item in data array)
      if (device.data && device.data.length > 0) {
        const lastDataPoint = device.data[device.data.length - 1];
        return lastDataPoint[1]; // [timestamp, value]
      }
    }
  }

  LogHelper.warn(`[getData] DataKey "${dataKeyName}" not found in ctx.data`);
  return null;
}

let dateUpdateHandler = null;
let dataProvideHandler = null; // RFC-0042: Orchestrator data listener
//let DEVICE_TYPE = "energy";
let MyIO = null;
let hasRequestedInitialData = false; // Flag to prevent duplicate initial requests
let lastProcessedPeriodKey = null; // Track last processed periodKey to prevent duplicate processing
let busyTimeoutId = null; // Timeout ID for busy fallback

// RFC-0042: Widget configuration (from settings)
let WIDGET_DOMAIN = 'energy'; // Will be set in onInit

// RFC-0063: Classification mode configuration
let USE_IDENTIFIER_CLASSIFICATION = false; // Flag to enable identifier-based classification
let USE_HYBRID_CLASSIFICATION = false; // Flag to enable hybrid mode (identifier + labels)

/** ===================== STATE ===================== **/
let CLIENT_ID = '';
let CLIENT_SECRET = '';
let CUSTOMER_ING_ID = '';
let MyIOAuth = null;

const STATE = {
  itemsBase: [], // lista autoritativa (TB)
  itemsEnriched: [], // lista com totals + perc
  searchActive: false,
  searchTerm: '',
  selectedIds: /** @type {Set<string> | null} */ (null),
  sortMode: /** @type {'cons_desc'|'cons_asc'|'alpha_asc'|'alpha_desc'} */ ('cons_desc'),
  firstHydrates: 0,
};

let hydrating = false;

/** ===================== HELPERS (DOM) ===================== **/
const $root = () => $(self.ctx.$container[0]);
const $list = () => $root().find('#shopsList');
const $count = () => $root().find('#shopsCount');
const $total = () => $root().find('#shopsTotal');
const $modal = () => $root().find('#filterModal');

/** ===================== BUSY MODAL (no widget) ===================== **/
const BUSY_ID = 'myio-busy-modal';
function ensureBusyModalDOM() {
  let $m = $root().find(`#${BUSY_ID}`);
  if ($m.length) return $m;

  const html = `
  <div id="${BUSY_ID}" style="
      position:absolute; inset:0; display:none;
      background: rgba(150,132,181,0.45); /* #9684B5 com transparência */
      backdrop-filter: blur(5px);
      z-index:9999; align-items:center; justify-content:center;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;">
    <div style="
        background:#2d1458; color:#fff;
        border:1px solid rgba(255,255,255,0.10);
        box-shadow:0 12px 40px rgba(0,0,0,.35);
        border-radius:18px; padding:22px 26px; min-width:320px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="spinner" style="
            width:22px;height:22px;border-radius:50%;
            border:3px solid rgba(255,255,255,.25);
            border-top-color:#ffffff; animation:spin .9s linear infinite;"></div>
        <div id="${BUSY_ID}-msg" style="font-weight:600; font-size:14px; letter-spacing:.2px;">
          aguarde.. carregando os dados...
        </div>
      </div>
    </div>
  </div>
  <style>
    @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  </style>`;
  $root().css('position', 'relative'); // garante overlay correto
  $root().append(html);
  return $root().find(`#${BUSY_ID}`);
}
// RFC-0044: Use centralized busy management
function showBusy(message, timeoutMs = 35000) {
  LogHelper.log(`[TELEMETRY] 🔄 showBusy() called with message: "${message || 'default'}"`);

  // Prevent multiple simultaneous busy calls
  if (window.busyInProgress) {
    LogHelper.log(`[TELEMETRY] ⏭️ Skipping duplicate showBusy() call`);
    return;
  }

  window.busyInProgress = true;

  // Centralized busy with enhanced synchronization
  const safeShowBusy = () => {
    try {
      if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.showGlobalBusy === 'function') {
        const text = (message && String(message).trim()) || 'Carregando dados...';
        window.MyIOOrchestrator.showGlobalBusy(WIDGET_DOMAIN, text, timeoutMs);
        LogHelper.log(`[TELEMETRY] ✅ Using centralized busy for domain: ${WIDGET_DOMAIN}`);
      } else {
        LogHelper.warn(`[TELEMETRY] ⚠️ Orchestrator not available, using fallback busy`);
        const $m = ensureBusyModalDOM();
        const text = (message && String(message).trim()) || 'aguarde.. carregando os dados...';
        $m.find(`#${BUSY_ID}-msg`).text(text);
        $m.css('display', 'flex');
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY] ❌ Error in showBusy:`, err);
    } finally {
      // Always reset busy flag after a short delay
      setTimeout(() => {
        window.busyInProgress = false;
      }, 500);
    }
  };

  // RFC-0051.3: Check if orchestrator exists and is ready
  const checkOrchestratorReady = async () => {
    // First, check if orchestrator exists and is ready
    if (window.MyIOOrchestrator?.isReady) {
      safeShowBusy();
      return;
    }

    // Wait for orchestrator ready event (with timeout)
    const ready = await new Promise((resolve) => {
      let timeout;
      let interval;

      // Listen for ready event
      const handler = () => {
        clearTimeout(timeout);
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        resolve(true);
      };

      window.addEventListener('myio:orchestrator:ready', handler);

      // Timeout after 5 seconds
      timeout = setTimeout(() => {
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        LogHelper.warn('[TELEMETRY] ⚠️ Orchestrator ready timeout after 5s, using fallback');
        resolve(false);
      }, 5000);

      // Also poll isReady flag (fallback if event is missed)
      interval = setInterval(() => {
        if (window.MyIOOrchestrator?.isReady) {
          clearInterval(interval);
          clearTimeout(timeout);
          window.removeEventListener('myio:orchestrator:ready', handler);
          resolve(true);
        }
      }, 100);
    });

    safeShowBusy();
  };

  checkOrchestratorReady();
}

function hideBusy() {
  LogHelper.log(`[TELEMETRY] ⏸️ hideBusy() called`);

  const safeHideBusy = () => {
    try {
      if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.hideGlobalBusy === 'function') {
        window.MyIOOrchestrator.hideGlobalBusy();
        LogHelper.log(`[TELEMETRY] ✅ Using centralized hideBusy`);
      } else {
        LogHelper.warn(`[TELEMETRY] ⚠️ Orchestrator not available, using fallback hideBusy`);
        $root().find(`#${BUSY_ID}`).css('display', 'none');
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY] ❌ Error in hideBusy:`, err);
    } finally {
      window.busyInProgress = false;
    }
  };

  // RFC-0051.3: Check if orchestrator exists and is ready
  const checkOrchestratorReady = async () => {
    // First, check if orchestrator exists and is ready
    if (window.MyIOOrchestrator?.isReady) {
      safeHideBusy();
      return;
    }

    // Wait for orchestrator ready event (with timeout)
    const ready = await new Promise((resolve) => {
      let timeout;
      let interval;

      // Listen for ready event
      const handler = () => {
        clearTimeout(timeout);
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        resolve(true);
      };

      window.addEventListener('myio:orchestrator:ready', handler);

      // Timeout after 5 seconds
      timeout = setTimeout(() => {
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        LogHelper.warn('[TELEMETRY] ⚠️ Orchestrator ready timeout after 5s, using fallback');
        resolve(false);
      }, 5000);

      // Also poll isReady flag (fallback if event is missed)
      interval = setInterval(() => {
        if (window.MyIOOrchestrator?.isReady) {
          clearInterval(interval);
          clearTimeout(timeout);
          window.removeEventListener('myio:orchestrator:ready', handler);
          resolve(true);
        }
      }, 100);
    });

    safeHideBusy();
  };

  checkOrchestratorReady();
}

const findValue = (values, dataType, defaultValue = 'N/D') => {
  const item = values.find((v) => v.dataType === dataType);
  if (!item) return defaultValue;
  // Retorna a propriedade 'val' (da nossa API) ou 'value' (do ThingsBoard)
  return item.val !== undefined ? item.val : item.value;
};

/** ===================== GLOBAL SUCCESS MODAL (fora do widget) ===================== **/
const G_SUCCESS_ID = 'myio-global-success-modal';
let gSuccessTimer = null;

function ensureGlobalSuccessModalDOM() {
  let el = document.getElementById(G_SUCCESS_ID);
  if (el) return el;

  const wrapper = document.createElement('div');
  wrapper.id = G_SUCCESS_ID;
  wrapper.setAttribute(
    'style',
    `
    position: fixed; inset: 0; display: none;
    z-index: 999999; 
    background: rgba(150,132,181,0.45); /* #9684B5 com transparência */
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  `
  );

  // container central
  const center = document.createElement('div');
  center.setAttribute(
    'style',
    `
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: #2d1458; color: #fff;
    border-radius: 20px; padding: 26px 30px; min-width: 360px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 14px 44px rgba(0,0,0,.35);
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;
    text-align: center;
  `
  );

  const icon = document.createElement('div');
  icon.innerHTML = `
    <div style="
      width:56px;height:56px;margin:0 auto 10px auto;border-radius:50%;
      background: rgba(255,255,255,.12); display:flex;align-items:center;justify-content:center;
      ">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17L4 12" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;

  const title = document.createElement('div');
  title.id = `${G_SUCCESS_ID}-title`;
  title.textContent = 'os dados foram salvos com sucesso';
  title.setAttribute('style', `font-size:16px;font-weight:700;letter-spacing:.2px;margin-bottom:6px;`);

  const sub = document.createElement('div');
  sub.id = `${G_SUCCESS_ID}-sub`;
  sub.innerHTML = `recarregando em <b id="${G_SUCCESS_ID}-count">6</b>s...`;
  sub.setAttribute('style', `opacity:.9;font-size:13px;`);

  center.appendChild(icon);
  center.appendChild(title);
  center.appendChild(sub);
  wrapper.appendChild(center);
  document.body.appendChild(wrapper);
  return wrapper;
}

function showGlobalSuccessModal(seconds = 6) {
  const el = ensureGlobalSuccessModalDOM();
  // reset contador
  const countEl = el.querySelector(`#${G_SUCCESS_ID}-count`);
  if (countEl) countEl.textContent = String(seconds);

  el.style.display = 'block';

  if (gSuccessTimer) {
    clearInterval(gSuccessTimer);
    gSuccessTimer = null;
  }

  let left = seconds;
  gSuccessTimer = setInterval(() => {
    left -= 1;
    if (countEl) countEl.textContent = String(left);
    if (left <= 0) {
      clearInterval(gSuccessTimer);
      gSuccessTimer = null;
      try {
        window.location.reload();
      } catch {
        // Reload may fail in restricted contexts (iframe, etc.)
      }
    }
  }, 1000);
}

function hideGlobalSuccessModal() {
  const el = document.getElementById(G_SUCCESS_ID);
  if (el) el.style.display = 'none';
  if (gSuccessTimer) {
    clearInterval(gSuccessTimer);
    gSuccessTimer = null;
  }
}

/** ===================== UTILS ===================== **/
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isValidUUID(v) {
  if (!v || typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function toSpOffsetNoMs(dt, endOfDay = false) {
  const d = typeof dt === 'number' ? new Date(dt) : dt instanceof Date ? dt : new Date(String(dt));
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
    2,
    '0'
  )}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
    d.getSeconds()
  ).padStart(2, '0')}-03:00`;
}

// converts raw API value to the UI target unit
function toTargetUnit(raw) {
  /*
  const x = Number(raw || 0);

  if (DEVICE_TYPE === "energy") {
    return MyIO.formatEnergy(x);
  }

  if (DEVICE_TYPE === "water") {
    return MyIO.formatWaterVolumeM3(x);
  }

  if (DEVICE_TYPE === "tank") {
    return MyIO.formatTankHeadFromCm(x);
  }

  // Default fallback for temperature or unknown types
  return x;
  */
  // TODO Trecho comentado, pois já faz o tratamento no componente

  return Number(raw || 0);
}
function mustGetDateRange() {
  const s = self.ctx?.scope?.startDateISO;
  const e = self.ctx?.scope?.endDateISO;
  if (s && e) return { startISO: s, endISO: e };
  throw new Error('DATE_RANGE_REQUIRED');
}

const isAuthReady = () => !!(MyIOAuth && typeof MyIOAuth.getToken === 'function');
async function ensureAuthReady(maxMs = 6000, stepMs = 150) {
  const start = Date.now();
  while (!isAuthReady()) {
    if (Date.now() - start > maxMs) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return true;
}

/** ===================== TB INDEXES ===================== **/
function buildTbAttrIndex() {
  // RFC-0091: Added deviceMapInstaneousPower for TIER 0 hierarchical resolution
  const byTbId = new Map(); // tbId -> { slaveId, centralId, deviceType, centralName, lastConnectTime, lastDisconnectTime, lastActivityTime, connectionStatus, deviceMapInstaneousPower }
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
  for (const row of rows) {
    const key = String(row?.dataKey?.name || '').toLowerCase();
    const tbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val = row?.data?.[0]?.[1];

    if (!tbId || val == null) continue;
    if (!byTbId.has(tbId))
      byTbId.set(tbId, {
        slaveId: null,
        centralId: null,
        deviceType: null,
        deviceProfile: null,
        centralName: null,
        customerName: null,
        lastConnectTime: null,
        lastDisconnectTime: null,
        lastActivityTime: null,
        connectionStatus: null,
        consumption_power: null,
        deviceMapInstaneousPower: null, // RFC-0091: Device-specific power limits (TIER 0)
        log_annotations: null, // RFC-0096: Log annotations array
      });
    const slot = byTbId.get(tbId);
    if (key === 'slaveid') slot.slaveId = val;
    if (key === 'centralid') slot.centralId = val;
    if (key === 'devicetype') slot.deviceType = val;
    if (key === 'deviceprofile') slot.deviceProfile = val;
    if (key === 'centralname') slot.centralName = val;
    if (key === 'customername') slot.customerName = val;
    if (key === 'lastconnecttime') slot.lastConnectTime = val;
    if (key === 'lastdisconnecttime') slot.lastDisconnectTime = val;
    if (key === 'lastactivitytime') slot.lastActivityTime = val;
    if (key === 'connectionstatus') slot.connectionStatus = String(val).toLowerCase();
    // RFC-0091: Extract device-specific power limits JSON
    if (key === 'devicemapinstaneouspower') slot.deviceMapInstaneousPower = val;
    if (key === 'log_annotations') slot.log_annotations = val;
    if (key === 'consumption') slot.consumption_power = val;
  }
  return byTbId;
}
function buildTbIdIndexes() {
  const byIdentifier = new Map(); // identifier -> tbId
  const byIngestion = new Map(); // ingestionId -> tbId
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];

  for (const row of rows) {
    const key = String(row?.dataKey?.name || '').toLowerCase();
    const tbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val = row?.data?.[0]?.[1];

    if (!tbId || val == null) continue;

    if (key === 'identifier') byIdentifier.set(String(val), tbId);
    if (key === 'ingestionid') byIngestion.set(String(val), tbId);
  }
  return { byIdentifier, byIngestion };
}

/** ===================== CORE: DATA PIPELINE ===================== **/
function buildAuthoritativeItems() {
  // items da LIB: [{ id: ingestionId, identifier, label }, ...]
  const base = MyIO.buildListItemsThingsboardByUniqueDatasource(self.ctx.datasources, self.ctx.data) || [];

  //LogHelper.log('[TELEMETRY][buildAuthoritativeItems] base: ', base);

  const ok = Array.isArray(base) ? base.filter((x) => x && x.id) : [];

  const tbIdIdx = buildTbIdIndexes(); // { byIdentifier, byIngestion }
  const attrsByTb = buildTbAttrIndex(); // tbId -> { slaveId, centralId, deviceType }

  // Extract global minTemperature and maxTemperature from window.MyIOUtils
  // These values are exposed by MAIN_VIEW widget which has the datasource for temperature limits
  let globalTempMin = null;
  let globalTempMax = null;

  if (WIDGET_DOMAIN === 'temperature' && window.MyIOUtils?.temperatureLimits) {
    globalTempMin = window.MyIOUtils.temperatureLimits.minTemperature;
    globalTempMax = window.MyIOUtils.temperatureLimits.maxTemperature;
    /*
    LogHelper.log(
      `[DeviceCards] Reading temperature limits from MyIOUtils: min=${globalTempMin}, max=${globalTempMax}`
    );
    */
  }

  const mapped = ok.map((r) => {
    //LogHelper.log('[TELEMETRY][buildAuthoritativeItems] ok.map: ', r);

    // r.id from buildListItemsThingsboardByUniqueDatasource can be:
    // 1. ThingsBoard entityId (most common - comes directly from datasource.entity.id.id)
    // 2. ingestionId value (only if device has ingestionId attribute that overwrites it)
    const itemId = r.id;

    // Check 1: Is itemId directly a valid ThingsBoard entityId in our attrs map?
    const isDirectTbId = itemId && attrsByTb.has(itemId);

    // Check 2: Try to find tbId by looking up itemId as an ingestionId
    const tbFromIngestionLookup = itemId ? tbIdIdx.byIngestion.get(itemId) : null;

    // Check 3: Try to find tbId by identifier
    const tbFromIdentifier = r.identifier ? tbIdIdx.byIdentifier.get(r.identifier) : null;

    // Priority: direct tbId > ingestion lookup > identifier lookup
    // Direct tbId is highest priority because it's the actual entityId
    let tbId = isDirectTbId ? itemId : tbFromIngestionLookup || tbFromIdentifier || null;

    if (tbFromIngestionLookup && tbFromIdentifier && tbFromIngestionLookup !== tbFromIdentifier) {
      /*
      LogHelper.warn("[DeviceCards] TB id mismatch for item", {
        label: r.label, identifier: r.identifier, itemId, tbFromIngestionLookup, tbFromIdentifier
      });
      */
      tbId = isDirectTbId ? itemId : tbFromIngestionLookup;
    }

    const attrs = tbId ? attrsByTb.get(tbId) || {} : {};
    const deviceProfile = attrs.deviceProfile || 'N/D';
    let deviceTypeToDisplay = attrs.deviceType || '3F_MEDIDOR';

    if (deviceTypeToDisplay === '3F_MEDIDOR' && deviceProfile !== 'N/D') {
      deviceTypeToDisplay = deviceProfile;
    }

    // Extract telemetry data from ThingsBoard ctx.data
    // - TANK/CAIXA_DAGUA: water_level, water_percentage
    // - ENERGY devices: consumption (most recent value)
    // - TERMOSTATO: temperature (min/max come from global dataKeys)
    let waterLevel = null;
    let waterPercentage = null;
    let consumption = null;
    let instantaneousPower = null;
    let temperature = null;
    const isTankDevice = deviceTypeToDisplay === 'TANK' || deviceTypeToDisplay === 'CAIXA_DAGUA';
    const isTermostatoDevice = deviceTypeToDisplay === 'TERMOSTATO';

    // Debug log for device type detection
    //LogHelper.log(`[DeviceCards] Device ${r.label}: deviceType=${deviceTypeToDisplay}, isTermostato=${isTermostatoDevice}`);

    if (tbId) {
      // Search for telemetry in ctx.data for this specific device
      const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];

      // Debug: log all available telemetry keys for this device
      if (isTermostatoDevice) {
        const deviceKeys = rows
          .filter((row) => (row?.datasource?.entityId?.id || row?.datasource?.entityId) === tbId)
          .map((row) => row?.dataKey?.name);
        //LogHelper.log(`[DeviceCards] TERMOSTATO tbId=${tbId}, available telemetry keys:`, deviceKeys);
      }

      for (const row of rows) {
        const rowTbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
        if (rowTbId === tbId) {
          const key = String(row?.dataKey?.name || '').toLowerCase();
          const val = row?.data?.[0]?.[1]; // Most recent value

          // TANK specific telemetry
          if (key === 'water_level') waterLevel = Number(val) || 0;
          if (key === 'water_percentage') waterPercentage = Number(val) || 0;

          // ENERGY/WATER devices: consumption (most recent)
          if (key === 'consumption') consumption = Number(val) || 0;
          if (key === 'consumption_power') instantaneousPower = Number(val) || 0;

          // TERMOSTATO specific telemetry
          if (key === 'temperature') {
            temperature = Number(val) || 0;
            /*
            LogHelper.log(
              `[DeviceCards] Found temperature telemetry: key=${key}, val=${val}, parsed=${temperature}`
            );
            */
          }
        }
      }
    }

    // Calculate deviceStatus based on connectionStatus and current telemetry value
    // connectionStatus comes from TB attribute: "online" or "offline"
    const tbConnectionStatus = attrs.connectionStatus; // "online" or "offline" from TB
    let deviceStatus = 'no_info'; // default

    // RFC-0091: Parse deviceMapInstaneousPower from ctx.data (TIER 0 - highest priority)
    let deviceMapLimits = null;
    if (attrs.deviceMapInstaneousPower && typeof attrs.deviceMapInstaneousPower === 'string') {
      try {
        deviceMapLimits = JSON.parse(attrs.deviceMapInstaneousPower);
      } catch (e) {
        LogHelper.warn(`[RFC-0091] Failed to parse deviceMapInstaneousPower for ${tbId}:`, e.message);
      }
    }

    let log_annotations_Parsed = null;
    if (attrs.log_annotations && typeof attrs.log_annotations === 'string') {
      try {
        log_annotations_Parsed = JSON.parse(attrs.log_annotations);
        LogHelper.log(`[TELEMETRY] OK parse log_annotations for ${tbId}:`, log_annotations_Parsed);
      } catch (e) {
        LogHelper.warn(`[RFC-0091] Failed to parse log_annotations for ${tbId}:`, e.message);
      }
    }

    if (tbConnectionStatus === 'offline') {
      deviceStatus = 'no_info'; // offline = no_info
    } else if (tbConnectionStatus === 'online') {
      // RFC-0078: For energy devices, calculate status using ranges from mapInstantaneousPower
      const isEnergyDevice = !isTankDevice && !isTermostatoDevice;

      if (isEnergyDevice) {
        // RFC-0091: Use hierarchical resolution - TIER 0 (deviceMap) > TIER 2 (customer/MAP_INSTANTANEOUS_POWER)
        // First try device-specific limits, then fall back to customer-level
        const limitsToUse = deviceMapLimits || MAP_INSTANTANEOUS_POWER;
        const ranges = limitsToUse
          ? extractLimitsFromJSON(limitsToUse, deviceTypeToDisplay, 'consumption')
          : null;

        if (ranges && typeof MyIOLibrary?.calculateDeviceStatusWithRanges === 'function') {
          deviceStatus = MyIOLibrary.calculateDeviceStatusWithRanges({
            connectionStatus: tbConnectionStatus,
            lastConsumptionValue: instantaneousPower,
            ranges: ranges,
          });

          const source = deviceMapLimits
            ? 'deviceMapInstaneousPower (TIER 0)'
            : 'mapInstantaneousPower (TIER 2)';
        } else {
          // Fallback if no ranges found or MyIOLibrary not available
          deviceStatus = 'power_on';
        }
      } else {
        // TANK, TERMOSTATO - use simple power_on
        deviceStatus = 'power_on';
      }
    }

    // Determine value based on device type
    let deviceValue = 0;
    if (isTankDevice) {
      deviceValue = waterLevel || 0;
    } else if (isTermostatoDevice) {
      deviceValue = temperature || 0;
    }

    // Calculate temperatureStatus: 'ok', 'above', 'below', or null
    // Uses global min/max from dataKeys (not per-device)
    let temperatureStatus = null;
    if (isTermostatoDevice && temperature !== null) {
      if (globalTempMax !== null && temperature > globalTempMax) {
        temperatureStatus = 'above';
      } else if (globalTempMin !== null && temperature < globalTempMin) {
        temperatureStatus = 'below';
      } else {
        temperatureStatus = 'ok';
      }
      /*
      LogHelper.log(
        `[DeviceCards] TERMOSTATO status: temp=${temperature}, min=${globalTempMin}, max=${globalTempMax}, status=${temperatureStatus}`
      );
      */
    }

    return {
      id: tbId || itemId, // para seleção/toggle
      tbId, // ThingsBoard deviceId (Settings)
      // ingestionId logic:
      // - Energy devices: itemId is the ingestionId (isDirectTbId=false), use it for API matching
      // - Termostatos: itemId is the tbId (isDirectTbId=true), use null to avoid Settings validation failing
      ingestionId: attrs.ingestionId || (isDirectTbId ? null : itemId),
      identifier: r.identifier,
      label: r.label,
      slaveId: attrs.slaveId ?? null,
      centralId: attrs.centralId ?? null,
      centralName: attrs.centralName ?? null,
      customerName: attrs.customerName ?? null,
      deviceType: deviceTypeToDisplay,
      updatedIdentifiers: {},
      connectionStatusTime: attrs.lastConnectTime ?? null,
      lastDisconnectTime: attrs.lastDisconnectTime ?? null,
      timeVal: attrs.lastActivityTime ?? null,
      deviceStatus: deviceStatus, // Calculated based on connectionStatus + value
      // TANK/CAIXA_DAGUA specific fields
      waterLevel: waterLevel,
      waterPercentage: waterPercentage,
      // TERMOSTATO specific fields (min/max are global from dataKeys)
      temperature: temperature,
      temperatureMin: globalTempMin,
      temperatureMax: globalTempMax,
      temperatureStatus: temperatureStatus,
      mapInstantaneousPower: MAP_INSTANTANEOUS_POWER,
      // RFC-0091: Include device-specific power limits for Settings modal
      deviceMapInstaneousPower: attrs.deviceMapInstaneousPower || null,
      log_annotations: log_annotations_Parsed || null,
      // Use appropriate value based on device type
      value: deviceValue,
      perc: isTankDevice ? waterPercentage || 0 : 0,
    };
  });

  // RFC-0097: Filter out 3F_MEDIDOR devices without proper deviceProfile for areacomum widget
  // These are generic meters that shouldn't be counted in area comum breakdown
  const widgetType = detectWidgetType();
  let filtered = mapped;

  if (widgetType === 'areacomum') {
    filtered = mapped.filter((item) => {
      // Keep item unless it's a 3F_MEDIDOR with 3F_MEDIDOR deviceProfile (no real type)
      const deviceType = String(item.deviceType || '').toUpperCase();
      const deviceProfile = String(item.deviceProfile || '').toUpperCase();

      // Discard if deviceType = 3F_MEDIDOR AND deviceProfile is also 3F_MEDIDOR or empty/N/D
      if (
        deviceType === '3F_MEDIDOR' &&
        (deviceProfile === '3F_MEDIDOR' || deviceProfile === 'N/D' || !deviceProfile)
      ) {
        LogHelper.log(
          `[RFC-0097] Filtering out 3F_MEDIDOR without proper deviceProfile: label="${item.label}", deviceProfile="${deviceProfile}"`
        );
        return false;
      }
      return true;
    });

    LogHelper.log(`[RFC-0097] Filtered areacomum items: ${mapped.length} → ${filtered.length}`);
  }

  //LogHelper.log(`[DeviceCards] TB items: ${filtered.length}`);
  return filtered;
}

async function fetchApiTotals(startISO, endISO) {
  if (!isAuthReady()) throw new Error('Auth not ready');
  const token = await MyIOAuth.getToken();
  if (!token) throw new Error('No ingestion token');

  const url = new URL(`${DATA_API_HOST}/api/v1/telemetry/customers/${CUSTOMER_ING_ID}/energy/devices/totals`);
  url.searchParams.set('startTime', toSpOffsetNoMs(startISO));
  url.searchParams.set('endTime', toSpOffsetNoMs(endISO, true));
  url.searchParams.set('deep', '1');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    LogHelper.warn('[DeviceCards] API fetch failed:', res.status);
    return new Map();
  }

  const json = await res.json();
  const rows = Array.isArray(json) ? json : json?.data ?? [];
  const map = new Map();
  for (const r of rows) if (r && r.id) map.set(String(r.id), r);
  //LogHelper.log(`[DeviceCards] API rows: ${rows.length}, map keys: ${map.size}`);
  return map;
}

function enrichItemsWithTotals(items, apiMap) {
  return items.map((it) => {
    // For temperature domain, preserve the value from ctx.data (buildAuthoritativeItems)
    if (WIDGET_DOMAIN === 'temperature') {
      return { ...it, perc: 0 };
    }

    let raw = 0;

    if (it.ingestionId && isValidUUID(it.ingestionId)) {
      const row = apiMap.get(String(it.ingestionId));
      raw = Number(row?.total_value ?? 0);
    }

    const value = Number(raw || 0); // toTargetUnit(raw); TODO verificar se ainda precisa dessa chamada

    return { ...it, value, perc: 0 };
  });
}

/** ===================== FILTERS / SORT / PERC ===================== **/
function applyFilters(enriched, searchTerm, selectedIds, sortMode) {
  let v = enriched.slice();

  if (selectedIds && selectedIds.size) {
    v = v.filter((x) => selectedIds.has(x.id));
  }

  const q = (searchTerm || '').trim().toLowerCase();
  if (q) {
    v = v.filter(
      (x) =>
        (x.label || '').toLowerCase().includes(q) ||
        String(x.identifier || '')
          .toLowerCase()
          .includes(q)
    );
  }

  v.sort((a, b) => {
    if (sortMode === 'cons_desc') {
      if (a.value !== b.value) return b.value - a.value;
      return (a.label || '').localeCompare(b.label || '', 'pt-BR', {
        sensitivity: 'base',
      });
    }
    if (sortMode === 'cons_asc') {
      if (a.value !== b.value) return a.value - b.value;
      return (a.label || '').localeCompare(b.label || '', 'pt-BR', {
        sensitivity: 'base',
      });
    }
    if (sortMode === 'alpha_desc') {
      return (
        (b.label || '').localeCompare(a.label || '', 'pt-BR', {
          sensitivity: 'base',
        }) || b.value - a.value
      );
    }
    return (
      (a.label || '').localeCompare(b.label || '', 'pt-BR', {
        sensitivity: 'base',
      }) || a.value - b.value
    );
  });

  return v;
}

function recomputePercentages(visible) {
  const groupSum = visible.reduce((acc, x) => acc + (x.value || 0), 0);
  const updated = visible.map((x) => ({
    ...x,
    perc: groupSum > 0 ? (x.value / groupSum) * 100 : 0,
  }));
  return { visible: updated, groupSum };
}

/** ===================== TEMPERATURE INFO TOOLTIP ===================== **/

// CSS for temperature info tooltip (injected once)
const TEMP_INFO_TOOLTIP_CSS = `
  .temp-info-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%);
    border: 1px solid #fdba74;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-right: 8px;
    flex-shrink: 0;
  }
  .temp-info-trigger:hover {
    background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(251, 146, 60, 0.3);
  }
  .temp-info-trigger svg {
    color: #c2410c;
  }
  .temp-info-tooltip-container {
    position: fixed;
    z-index: 99999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.25s ease, transform 0.25s ease;
    transform: translateY(5px);
  }
  .temp-info-tooltip-container.visible {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }
  .temp-info-tooltip {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.08);
    min-width: 320px;
    max-width: 400px;
    font-size: 12px;
    color: #1e293b;
    overflow: hidden;
    font-family: Inter, system-ui, -apple-system, sans-serif;
  }
  .temp-info-tooltip__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 18px;
    background: linear-gradient(90deg, #fff7ed 0%, #fef3c7 100%);
    border-bottom: 1px solid #fed7aa;
  }
  .temp-info-tooltip__icon { font-size: 18px; }
  .temp-info-tooltip__title {
    font-weight: 700;
    font-size: 14px;
    color: #c2410c;
    letter-spacing: 0.3px;
  }
  .temp-info-tooltip__content {
    padding: 16px 18px;
    max-height: 500px;
    overflow-y: auto;
  }
  .temp-info-tooltip__section {
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f1f5f9;
  }
  .temp-info-tooltip__section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
  .temp-info-tooltip__section-title {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .temp-info-tooltip__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    gap: 12px;
  }
  .temp-info-tooltip__label {
    color: #64748b;
    font-size: 12px;
    flex-shrink: 0;
  }
  .temp-info-tooltip__value {
    color: #1e293b;
    font-weight: 600;
    text-align: right;
  }
  .temp-info-tooltip__value--highlight {
    color: #ea580c;
    font-weight: 700;
    font-size: 14px;
  }
  .temp-info-tooltip__badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }
  .temp-info-tooltip__badge--ok {
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }
  .temp-info-tooltip__badge--warn {
    background: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
  }
  .temp-info-tooltip__badge--info {
    background: #e0e7ff;
    color: #4338ca;
    border: 1px solid #c7d2fe;
  }
  .temp-info-tooltip__list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }
  .temp-info-tooltip__list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #f8fafc;
    border-radius: 6px;
    font-size: 11px;
  }
  .temp-info-tooltip__list-item--ok { border-left: 3px solid #22c55e; background: #f0fdf4; }
  .temp-info-tooltip__list-item--warn { border-left: 3px solid #f59e0b; background: #fffbeb; }
  .temp-info-tooltip__list-item--unknown { border-left: 3px solid #6b7280; background: #f3f4f6; }
  .temp-info-tooltip__list-icon { font-size: 12px; flex-shrink: 0; }
  .temp-info-tooltip__list-name { flex: 1; color: #334155; font-weight: 500; }
  .temp-info-tooltip__list-value { color: #475569; font-size: 11px; font-weight: 500; }
  .temp-info-tooltip__list-range { color: #94a3b8; font-size: 10px; }
  .temp-info-tooltip__notice {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    margin-top: 12px;
  }
  .temp-info-tooltip__notice-icon { font-size: 14px; flex-shrink: 0; }
  .temp-info-tooltip__notice-text { font-size: 10px; color: #1e40af; line-height: 1.5; }
`;

function ensureTempInfoTooltipCSS() {
  if (document.getElementById('temp-info-tooltip-styles')) return;
  const style = document.createElement('style');
  style.id = 'temp-info-tooltip-styles';
  style.textContent = TEMP_INFO_TOOLTIP_CSS;
  document.head.appendChild(style);
}

function createTempInfoTooltipContainer() {
  const existing = document.getElementById('temp-info-tooltip');
  if (existing) return existing;

  ensureTempInfoTooltipCSS();

  const container = document.createElement('div');
  container.id = 'temp-info-tooltip';
  container.className = 'temp-info-tooltip-container';
  document.body.appendChild(container);
  return container;
}

function showTempInfoTooltip(triggerElement) {
  const container = createTempInfoTooltipContainer();

  // Get temperature data from current visible items
  const tempMin = window.MyIOUtils?.temperatureLimits?.min;
  const tempMax = window.MyIOUtils?.temperatureLimits?.max;
  const hasLimits = tempMin != null && tempMax != null;

  // Collect data from authoritativeItems (already filtered for TERMOSTATO)
  const tempDevices = [];
  let totalTemp = 0;
  let devicesInRange = 0;
  let devicesOutOfRange = 0;
  let devicesUnknown = 0;

  if (window._telemetryAuthoritativeItems) {
    window._telemetryAuthoritativeItems.forEach((item) => {
      if (item.deviceType === 'TERMOSTATO') {
        const temp = Number(item.value) || 0;
        totalTemp += temp;

        let status = 'unknown';
        if (hasLimits) {
          if (temp >= tempMin && temp <= tempMax) {
            status = 'ok';
            devicesInRange++;
          } else {
            status = 'warn';
            devicesOutOfRange++;
          }
        } else {
          devicesUnknown++;
        }

        tempDevices.push({
          name: item.label || item.identifier || 'Sensor',
          temp: temp,
          status: status,
        });
      }
    });
  }

  const avgTemp = tempDevices.length > 0 ? totalTemp / tempDevices.length : 0;

  // Build status badge
  let statusBadge = '';
  if (tempDevices.length === 0) {
    statusBadge =
      '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--info">Aguardando dados</span>';
  } else if (!hasLimits) {
    statusBadge =
      '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--info">Faixa nao configurada</span>';
  } else if (devicesOutOfRange === 0) {
    statusBadge = '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--ok">Todos na faixa</span>';
  } else if (devicesInRange === 0) {
    statusBadge =
      '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--warn">Todos fora da faixa</span>';
  } else {
    statusBadge =
      '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--warn">' +
      devicesOutOfRange +
      ' fora da faixa</span>';
  }

  // Build device list HTML
  let deviceListHtml = '';
  if (tempDevices.length > 0 && 3 > 2) {
    const sortedDevices = [...tempDevices].sort((a, b) => b.temp - a.temp);
    const displayDevices = sortedDevices.slice(0, 5); // Show max 8
    const hasMore = sortedDevices.length > 5;

    deviceListHtml = `
      <div class="temp-info-tooltip__section">
        <div class="temp-info-tooltip__section-title">
          <span>🌡️</span> Sensores (${tempDevices.length})
        </div>
        <div class="temp-info-tooltip__list">
          ${displayDevices
            .map((d) => {
              const statusClass = d.status === 'ok' ? 'ok' : d.status === 'warn' ? 'warn' : 'unknown';
              const icon = d.status === 'ok' ? '✔' : d.status === 'warn' ? '⚠' : '?';
              return `
              <div class="temp-info-tooltip__list-item temp-info-tooltip__list-item--${statusClass}">
                <span class="temp-info-tooltip__list-icon">${icon}</span>
                <span class="temp-info-tooltip__list-name">${d.name}</span>
                <span class="temp-info-tooltip__list-value">${d.temp.toFixed(1)}°C</span>
              </div>
            `;
            })
            .join('')}
          ${
            hasMore
              ? `<div style="text-align: center; color: #94a3b8; font-size: 10px; padding: 4px;">... e mais ${
                  sortedDevices.length - 5
                } sensores</div>`
              : ''
          }
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="temp-info-tooltip">
      <div class="temp-info-tooltip__header">
        <span class="temp-info-tooltip__icon">🌡️</span>
        <span class="temp-info-tooltip__title">Detalhes de Temperatura</span>
      </div>
      <div class="temp-info-tooltip__content">
        <div class="temp-info-tooltip__section">
          <div class="temp-info-tooltip__section-title">
            <span>📊</span> Resumo
          </div>
          <div class="temp-info-tooltip__row">
            <span class="temp-info-tooltip__label">Media Geral:</span>
            <span class="temp-info-tooltip__value temp-info-tooltip__value--highlight">${avgTemp.toFixed(
              1
            )}°C</span>
          </div>
          ${
            hasLimits
              ? `
          <div class="temp-info-tooltip__row">
            <span class="temp-info-tooltip__label">Faixa Ideal:</span>
            <span class="temp-info-tooltip__value">${tempMin}°C - ${tempMax}°C</span>
          </div>
          `
              : ''
          }
          <div class="temp-info-tooltip__row">
            <span class="temp-info-tooltip__label">Sensores Ativos:</span>
            <span class="temp-info-tooltip__value">${tempDevices.length}</span>
          </div>
          <div class="temp-info-tooltip__row">
            <span class="temp-info-tooltip__label">Status:</span>
            ${statusBadge}
          </div>
        </div>

        ${deviceListHtml}

        <div class="temp-info-tooltip__notice">
          <span class="temp-info-tooltip__notice-icon">ℹ️</span>
          <span class="temp-info-tooltip__notice-text">
            Considerados apenas sensores <strong>TERMOSTATO</strong> ativos.
          </span>
        </div>
      </div>
    </div>
  `;

  // Position tooltip
  const rect = triggerElement.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 8;

  // Adjust if goes off screen
  if (left + 340 > window.innerWidth - 10) left = window.innerWidth - 350;
  if (left < 10) left = 10;
  if (top + 400 > window.innerHeight) {
    top = rect.top - 8 - 400;
    if (top < 10) top = 10;
  }

  container.style.left = left + 'px';
  container.style.top = top + 'px';
  container.classList.add('visible');
}

function hideTempInfoTooltip() {
  const container = document.getElementById('temp-info-tooltip');
  if (container) {
    container.classList.remove('visible');
  }
}

/** ===================== RENDER ===================== **/
function renderHeader(count, groupSum) {
  $count().text(`(${count})`);

  // Format based on widget domain
  let formattedTotal = groupSum.toFixed(2);
  if (WIDGET_DOMAIN === 'energy') {
    formattedTotal = MyIO.formatEnergy(groupSum);
  } else if (WIDGET_DOMAIN === 'water') {
    formattedTotal = MyIO.formatWaterVolumeM3(groupSum);
  } else if (WIDGET_DOMAIN === 'tank') {
    formattedTotal = MyIO.formatTankHeadFromCm(groupSum);
  } else if (WIDGET_DOMAIN === 'temperature') {
    // For temperature, show count instead of sum (summing temperatures doesn't make sense)
    formattedTotal = `${count} sensor${count !== 1 ? 'es' : ''}`;
  }

  $total().text(formattedTotal);
}

function renderList(visible) {
  const $ul = $list().empty();

  visible.forEach((it) => {
    // For temperature domain, only render TERMOSTATO devices
    if (WIDGET_DOMAIN === 'temperature' && it.deviceType !== 'TERMOSTATO') {
      return; // Skip non-TERMOSTATO devices in temperature domain
    }

    const valNum = Number(it.value || 0);

    // Note: deviceStatus comes from buildAuthoritativeItems (based on TB connectionStatus + telemetry)
    // Don't recalculate here - it would be incorrect for ENERGY devices

    // RFC-0097: Safe identifier handling with fallbacks using centralized function
    let deviceIdentifierToDisplay = 'N/A';
    if (it.identifier && !String(it.identifier).includes('Sem Identificador identificado')) {
      // Valid identifier attribute
      deviceIdentifierToDisplay = it.identifier;
    } else {
      // No valid identifier - infer from deviceType or label
      deviceIdentifierToDisplay = inferDisplayIdentifier(it);
    }

    const entityObject = {
      entityId: it.tbId || it.id, // preferir TB deviceId
      labelOrName: it.label.toUpperCase(),
      deviceType: it.label.includes('dministra') ? '3F_MEDIDOR' : it.deviceType,
      val: valNum, // TODO verificar ESSE MULTIPLICADOR PQ PRECISA DELE ?
      perc: it.perc ?? 0,
      deviceStatus: it.deviceStatus || 'no_info', // Use from buildAuthoritativeItems (based on TB connectionStatus + telemetry)
      entityType: 'DEVICE',
      deviceIdentifier: deviceIdentifierToDisplay,
      slaveId: it.slaveId || 'N/A',
      ingestionId: it.ingestionId || 'N/A',
      centralId: it.centralId || 'N/A',
      centralName: it.centralName || '',
      customerName: it.customerName || null,
      updatedIdentifiers: it.updatedIdentifiers || {},
      connectionStatusTime: it.connectionStatusTime || Date.now(),
      timeVal: it.timeVal || Date.now(),
      // TANK/CAIXA_DAGUA specific fields
      waterLevel: it.waterLevel || null,
      waterPercentage: it.waterPercentage || null,
      // TERMOSTATO specific fields
      temperature: it.temperature || null,
      temperatureMin: it.temperatureMin || null,
      temperatureMax: it.temperatureMax || null,
      temperatureStatus: it.temperatureStatus || null,
      log_annotations: it.log_annotations || null,
    };

    if (it.label === 'Chiller 1') {
      LogHelper.log('RENDER CARD ALLEGRIA >>> OBJ: ', it);
    }

    const myTbToken = localStorage.getItem('jwt_token');
    let cachedIngestionToken = null;

    // RFC-0082 FIX: Check if MyIOAuth is initialized before calling getToken()
    if (MyIOAuth && typeof MyIOAuth.getToken === 'function') {
      MyIOAuth.getToken()
        .then((token) => {
          cachedIngestionToken = token;
        })
        .catch((err) => LogHelper.warn('Token cache failed:', err));
    } else {
      LogHelper.warn('[TELEMETRY] MyIOAuth not initialized yet, skipping token cache');
    }

    const $card = MyIO.renderCardComponentV5({
      entityObject,
      useNewComponents: true, // Habilitar novos componentes
      enableSelection: true, // Habilitar seleção
      enableDragDrop: true, // Habilitar drag and drop

      handleActionDashboard: async () => {
        const jwtToken = localStorage.getItem('jwt_token');
        const MyIOToast = MyIOLibrary?.MyIOToast || window.MyIOToast;

        if (!jwtToken) {
          if (MyIOToast) {
            MyIOToast.error('Authentication required. Please login again.');
          } else {
            alert('Authentication required. Please login again.');
          }
          return;
        }

        // Get dates from MENU (startDateISO/endDateISO) and convert to timestamps
        const startDateISO = self.ctx?.scope?.startDateISO;
        const endDateISO = self.ctx?.scope?.endDateISO;
        const startTs = startDateISO ? new Date(startDateISO).getTime() : Date.now() - 86400000;
        const endTs = endDateISO ? new Date(endDateISO).getTime() : Date.now();
        const deviceType = it.deviceType || entityObject.deviceType;
        const isWaterTank = deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA';
        const isTermostato = deviceType === 'TERMOSTATO';

        LogHelper.log(
          '[TELEMETRY v5] Opening dashboard for deviceType:',
          deviceType,
          'isWaterTank:',
          isWaterTank,
          'isTermostato:',
          isTermostato,
          'deviceId:',
          it.id,
          'tbId:',
          it.tbId,
          'startDateISO:',
          startDateISO,
          'endDateISO:',
          endDateISO,
          'startTs:',
          startTs,
          'endTs:',
          endTs
        );

        // Show loading toast
        let loadingToast = null;
        if (MyIOToast) {
          const loadingMsg = isTermostato
            ? 'Carregando dados de temperatura...'
            : isWaterTank
            ? 'Loading water tank data...'
            : 'Loading energy data...';
          loadingToast = MyIOToast.info(loadingMsg, 0);
        }

        try {
          if (isTermostato) {
            // Temperature/TERMOSTATO Modal Path - RFC-0085
            // Uses MyIOLibrary.openTemperatureModal instead of inline implementation
            LogHelper.log('[TELEMETRY v5] Entering TERMOSTATO device modal path (MyIOLibrary)...');

            const deviceId = it.tbId || it.id;

            // Get temperature-related properties from entity
            // Check for various attribute names: temperatureMin, minTemperature, tempMin (SERVER_SCOPE)
            const currentTemp = it.temperature || entityObject.temperature;
            const tempMinRange =
              it.temperatureMin ??
              it.minTemperature ??
              it.tempMin ??
              entityObject.temperatureMin ??
              entityObject.minTemperature ??
              entityObject.tempMin ??
              self.ctx?.scope?.minTemperature ??
              null;
            const tempMaxRange =
              it.temperatureMax ??
              it.maxTemperature ??
              it.tempMax ??
              entityObject.temperatureMax ??
              entityObject.maxTemperature ??
              entityObject.tempMax ??
              self.ctx?.scope?.maxTemperature ??
              null;
            const tempStatus = it.temperatureStatus || entityObject.temperatureStatus;

            LogHelper.log('[TELEMETRY v5] Temperature range from entity/scope:', {
              tempMinRange,
              tempMaxRange,
            });

            // Check if MyIOLibrary.openTemperatureModal is available
            if (typeof MyIOLibrary?.openTemperatureModal !== 'function') {
              const errorMsg = 'Temperature modal not available. Please update MyIO library.';
              LogHelper.error('[TELEMETRY v5] ❌', errorMsg);
              throw new Error(errorMsg);
            }

            // Convert timestamps to ISO strings
            const startDateISO = new Date(startTs).toISOString();
            const endDateISO = new Date(endTs).toISOString();

            LogHelper.log('[TELEMETRY v5] Calling openTemperatureModal with params:', {
              deviceId: deviceId,
              startDate: startDateISO,
              endDate: endDateISO,
              label: it.label || it.name,
              currentTemperature: currentTemp,
              temperatureMin: tempMinRange,
              temperatureMax: tempMaxRange,
              temperatureStatus: tempStatus,
            });

            const modalHandle = MyIOLibrary.openTemperatureModal({
              token: jwtToken,
              deviceId: deviceId,
              startDate: startDateISO,
              endDate: endDateISO,
              label: it.label || it.name || 'Sensor de Temperatura',
              currentTemperature: currentTemp,
              temperatureMin: tempMinRange,
              temperatureMax: tempMaxRange,
              temperatureStatus: tempStatus,
              theme: 'dark',
              locale: 'pt-BR',
              granularity: 'hour',
              onClose: () => {
                LogHelper.log('[TELEMETRY v5] Temperature modal closed via MyIOLibrary');
              },
            });

            // Hide loading toast and busy indicator AFTER modal is opened
            // Use setTimeout to ensure toast 'show' class has been applied before hiding
            // (MyIOToast adds 'show' class after 10ms delay)
            setTimeout(() => {
              if (loadingToast) loadingToast.hide();
              if (MyIOToast) MyIOToast.hide(); // Also call global hide as fallback
            }, 50);
            hideBusy();

            LogHelper.log('[TELEMETRY v5] ✅ Temperature modal opened via MyIOLibrary:', modalHandle);
            return; // Exit early - modal is now handling everything
          } else if (isWaterTank) {
            // Water Tank Modal Path
            LogHelper.log('[TELEMETRY v5] Entering TANK device modal path...');

            LogHelper.log(
              '[TELEMETRY v5] MyIOLibrary available:',
              typeof MyIOLibrary !== 'undefined',
              'openDashboardPopupWaterTank exists:',
              typeof MyIOLibrary?.openDashboardPopupWaterTank
            );

            if (typeof MyIOLibrary?.openDashboardPopupWaterTank !== 'function') {
              const errorMsg = 'Water tank modal not available. Please update MyIO library.';
              LogHelper.error('[TELEMETRY v5] ❌', errorMsg);
              throw new Error(errorMsg);
            }

            // For TANK/CAIXA_DAGUA: get water level from telemetry
            const waterLevel = getData('water_level');
            const waterPercentage = getData('water_percentage');
            const currentLevel = waterPercentage || it.perc || it.val || 0;

            LogHelper.log('[TELEMETRY v5] Water tank telemetry data:', {
              water_level: waterLevel,
              water_percentage: waterPercentage,
              currentLevel: currentLevel,
              it_perc: it.perc,
              it_val: it.val,
            });

            LogHelper.log('[TELEMETRY v5] Calling openDashboardPopupWaterTank with params:', {
              deviceId: it.id,
              deviceType: deviceType,
              startTs: typeof startTs === 'number' ? startTs : new Date(startTs).getTime(),
              endTs: typeof endTs === 'number' ? endTs : new Date(endTs).getTime(),
              label: it.label || it.name || 'Water Tank',
              currentLevel: currentLevel,
            });

            LogHelper.log('[TELEMETRY v5] ⏳ About to call openDashboardPopupWaterTank...');

            const modalHandle = await MyIOLibrary.openDashboardPopupWaterTank({
              deviceId: it.id,
              deviceType: deviceType,
              tbJwtToken: jwtToken,
              startTs: typeof startTs === 'number' ? startTs : new Date(startTs).getTime(),
              endTs: typeof endTs === 'number' ? endTs : new Date(endTs).getTime(),
              label: it.label || it.name || 'Water Tank',
              currentLevel: currentLevel,
              slaveId: it.slaveId,
              centralId: it.centralId,
              timezone: self.ctx?.timeWindow?.timezone || 'America/Sao_Paulo',
              telemetryKeys: ['water_level', 'water_percentage', 'waterLevel', 'nivel', 'level'],
              onOpen: (context) => {
                LogHelper.log('[TELEMETRY v5] ✅ Water tank modal opened successfully!', context);
                if (loadingToast) loadingToast.hide();
                hideBusy();
              },
              onClose: () => {
                LogHelper.log('[TELEMETRY v5] 🚪 Water tank modal onClose callback triggered');
              },
              onError: (error) => {
                LogHelper.error('[TELEMETRY v5] ❌ Water tank modal error:', error);
                if (loadingToast) loadingToast.hide();
                hideBusy();
                if (MyIOToast) {
                  MyIOToast.error(`Error: ${error.message}`);
                } else {
                  alert(`Error: ${error.message}`);
                }
              },
            });

            LogHelper.log('[TELEMETRY v5] ✅ Water tank modal handle received:', modalHandle);
          } else {
            // Energy/Water/Temperature Modal Path (Ingestion API)
            LogHelper.log('[TELEMETRY v5] Opening energy modal...');
            const tokenIngestionDashBoard = await MyIOAuth.getToken();
            const modal = MyIO.openDashboardPopupEnergy({
              deviceId: it.id,
              readingType: WIDGET_DOMAIN, // 'energy', 'water', or 'tank'
              startDate: self.ctx.scope.startDateISO,
              endDate: self.ctx.scope.endDateISO,
              tbJwtToken: jwtToken,
              ingestionToken: tokenIngestionDashBoard,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              onOpen: (context) => {
                LogHelper.log('[TELEMETRY v5] Energy modal opened:', context);
                if (loadingToast) loadingToast.hide();
                hideBusy();
              },
              onError: (error) => {
                LogHelper.error('[TELEMETRY v5] Energy modal error:', error);
                if (loadingToast) loadingToast.hide();
                hideBusy();
                if (MyIOToast) {
                  MyIOToast.error(`Erro: ${error.message}`);
                } else {
                  alert(`Erro: ${error.message}`);
                }
              },
              onClose: () => {
                LogHelper.log('[TELEMETRY v5] Energy modal closed');
              },
            });
          }
        } catch (err) {
          LogHelper.error('[TELEMETRY v5] Dashboard action failed:', err?.message || err, err);

          if (loadingToast) loadingToast.hide();
          hideBusy();

          if (MyIOToast) {
            MyIOToast.error(err?.message || 'Failed to open dashboard');
          } else {
            alert(err?.message || 'Failed to open dashboard');
          }
        }
      },

      handleActionReport: async () => {
        try {
          showBusy(); // mensagem fixa

          const deviceType = it.deviceType || entityObject.deviceType;
          const isTermostatoDevice = deviceType === 'TERMOSTATO';

          // For TERMOSTATO devices, reports use ThingsBoard API (no ingestion)
          if (isTermostatoDevice || WIDGET_DOMAIN === 'temperature') {
            LogHelper.log('[TELEMETRY v5] Temperature report - using ThingsBoard API');

            const jwtToken = localStorage.getItem('jwt_token');
            if (!jwtToken) {
              throw new Error('No JWT token available');
            }

            // Get device TB ID
            let tbId = it.tbId;
            if (!tbId || !isValidUUID(tbId)) {
              const idx = buildTbIdIndexes();
              tbId =
                (it.ingestionId && idx.byIngestion.get(it.ingestionId)) ||
                (it.identifier && idx.byIdentifier.get(it.identifier)) ||
                null;
            }

            if (!tbId) {
              LogHelper.warn('[TELEMETRY v5] No TB device ID for temperature report');
              const MyIOToast = MyIOLibrary?.MyIOToast || window.MyIOToast;
              if (MyIOToast) {
                MyIOToast.error('Nao foi possivel identificar o dispositivo.');
              }
              return;
            }

            LogHelper.log('[TELEMETRY v5] Opening temperature report for device:', {
              tbId,
              label: it.label,
              identifier: it.identifier,
            });

            // Create custom fetcher for ThingsBoard temperature data
            const temperatureFetcher = async ({ startISO, endISO }) => {
              const startTs = new Date(startISO).getTime();
              const endTs = new Date(endISO).getTime();

              LogHelper.log('[TELEMETRY v5] Fetching temperature data for report:', {
                startISO,
                endISO,
                startTs,
                endTs,
                tbId,
              });

              // Fetch temperature data from ThingsBoard with daily aggregation
              const url =
                `/api/plugins/telemetry/DEVICE/${tbId}/values/timeseries` +
                `?keys=temperature` +
                `&startTs=${encodeURIComponent(startTs)}` +
                `&endTs=${encodeURIComponent(endTs)}` +
                `&limit=50000` +
                `&intervalType=MILLISECONDS` +
                `&interval=86400000` + // 24 hours in ms (daily aggregation)
                `&agg=AVG`;

              const response = await fetch(url, {
                headers: {
                  'X-Authorization': `Bearer ${jwtToken}`,
                  'Content-Type': 'application/json',
                },
              });

              if (!response.ok) {
                throw new Error(`ThingsBoard API error: ${response.status}`);
              }

              const data = await response.json();
              LogHelper.log('[TELEMETRY v5] ThingsBoard temperature response:', data);

              // Transform ThingsBoard response to match expected format for report modal
              const tempValues = data?.temperature || [];

              if (tempValues.length === 0) {
                LogHelper.warn('[TELEMETRY v5] No temperature data returned from ThingsBoard');
                return [];
              }

              // Helper function to clamp temperature values (avoid outliers)
              // Values below 15°C are clamped to 15, values above 40°C are clamped to 40
              const clampTemp = (v) => {
                const num = Number(v || 0);
                if (num < 15) return 15;
                if (num > 40) return 40;
                return num;
              };

              // Group by day and calculate average (ThingsBoard may return multiple points per day)
              const dailyMap = {};
              tempValues.forEach((item) => {
                const date = new Date(item.ts);
                const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
                if (!dailyMap[dateKey]) {
                  dailyMap[dateKey] = { sum: 0, count: 0 };
                }
                // Clamp each value before aggregating
                dailyMap[dateKey].sum += clampTemp(item.value);
                dailyMap[dateKey].count += 1;
              });

              // Convert to array format expected by DeviceReportModal
              const consumption = Object.entries(dailyMap).map(([date, stats]) => ({
                timestamp: date + 'T00:00:00.000Z',
                value: stats.sum / stats.count, // Average temperature for the day (already clamped)
              }));

              LogHelper.log('[TELEMETRY v5] Processed temperature data for report:', {
                daysCount: consumption.length,
                consumption,
              });

              // Return in the format expected by DeviceReportModal.processApiResponse
              return [
                {
                  deviceId: tbId,
                  consumption: consumption,
                },
              ];
            };

            // Open the report modal with custom temperature fetcher
            await MyIO.openDashboardPopupReport({
              ingestionId: it.ingestionId || tbId, // Use tbId as fallback
              deviceId: tbId,
              identifier: it.identifier,
              label: it.label,
              domain: 'temperature',
              fetcher: temperatureFetcher, // Custom fetcher for ThingsBoard data
              api: {
                // These are not used when custom fetcher is provided, but required by interface
                dataApiBaseUrl: '',
                clientId: '',
                clientSecret: '',
                ingestionToken: jwtToken,
              },
            });

            return;
          }

          if (!isAuthReady()) throw new Error('Auth not ready');

          const ingestionToken = await MyIOAuth.getToken();

          if (!ingestionToken) throw new Error('No ingestion token');

          await MyIO.openDashboardPopupReport({
            ingestionId: it.ingestionId, // sempre ingestionId
            identifier: it.identifier,
            label: it.label,
            domain: WIDGET_DOMAIN, // 'energy', 'water', or 'temperature'
            api: {
              dataApiBaseUrl: DATA_API_HOST,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              ingestionToken,
            },
          });
        } catch (err) {
          LogHelper.warn('[DeviceCards] Report open blocked:', err?.message || err);
          alert('Credenciais ainda carregando. Tente novamente em instantes.');
        } finally {
          hideBusy();
        }
      },

      handleActionSettings: async () => {
        showBusy(null, 3000); // mensagem fixa
        // resolve TB id “fresh”
        let tbId = it.tbId;

        if (!tbId || !isValidUUID(tbId)) {
          const idx = buildTbIdIndexes();
          tbId =
            (it.ingestionId && idx.byIngestion.get(it.ingestionId)) ||
            (it.identifier && idx.byIdentifier.get(it.identifier)) ||
            null;
        }

        if (!tbId || tbId === it.ingestionId) {
          LogHelper.warn('[DeviceCards] Missing/ambiguous TB id for Settings', {
            label: it.label,
            identifier: it.identifier,
            ingestionId: it.ingestionId,
            tbId,
          });
          hideBusy();
          alert('Não foi possível identificar o deviceId do ThingsBoard para este card.');
          return;
        }

        const jwt = localStorage.getItem('jwt_token');

        try {
          // RFC-0080 + RFC-0091: Get customerId from MAIN widget via window.MyIOUtils
          const customerTbId = window.MyIOUtils?.customerTB_ID || null;

          // RFC-XXXX: SuperAdmin flag from MAIN_VIEW
          const isSuperAdmin = window.MyIOUtils?.SuperAdmin || false;

          console.log(`[TELEMETRY] openDashboardPopupSettings > isSuperAdmin: `, isSuperAdmin);

          await MyIO.openDashboardPopupSettings({
            deviceId: tbId, // TB deviceId
            label: it.label,
            jwtToken: jwt,
            domain: WIDGET_DOMAIN,
            deviceType: it.deviceType,
            customerId: customerTbId, // RFC-0080: Pass customerId for GLOBAL fetch
            superadmin: isSuperAdmin, // RFC-XXXX: SuperAdmin mode
            connectionData: {
              centralName: it.centralName,
              connectionStatusTime: it.connectionStatusTime || null,
              lastDisconnectTime: it.lastDisconnectTime || null,
              timeVal: it.timeVal || null,
              deviceStatus: it.deviceStatus || 'no_info',
            },
            ui: { title: 'Configurações', width: 900 },
            mapInstantaneousPower: it.mapInstantaneousPower, // RFC-0078: Pass existing map if available
            // RFC-0091: Pass device-specific power limits (TIER 0 - highest priority)
            deviceMapInstaneousPower: it.deviceMapInstaneousPower || null,
            onSaved: (payload) => {
              LogHelper.log('[Settings Saved]', payload);
              //hideBusy();
              // Mostra modal global de sucesso com contador e reload
              // showGlobalSuccessModal(6);
            },
            onClose: () => {
              $('.myio-settings-modal-overlay').remove();
              hideBusy();
            },
          });
        } catch (e) {
          hideBusy();
        }
      },

      handleClickCard: () => {
        //LogHelper.log("Card clicado:", entityObject);
      },

      handleSelect: (entityObj) => {
        // NOTE: This callback is called during card rendering, NOT during user selection
        // Entity registration is handled by the 'myio:device-params' event listener instead
        // which is only triggered when the user actually clicks the checkbox
        LogHelper.log('[TELEMETRY] handleSelect called (no-op):', entityObj.labelOrName);
      },
    });

    // Append the returned element to wrapper
    if ($card && $card[0] && entityObject.log_annotations) {
      addAnnotationIndicator($card[0], entityObject);
    }

    $ul.append($card);
  });
}

/** ===================== UI BINDINGS ===================== **/
function bindHeader() {
  $root().on('click', '#btnSearch', () => {
    STATE.searchActive = !STATE.searchActive;
    $root().find('#searchWrap').toggleClass('active', STATE.searchActive);

    if (STATE.searchActive) setTimeout(() => $root().find('#shopsSearch').trigger('focus'), 30);
  });

  $root().on('input', '#shopsSearch', (ev) => {
    STATE.searchTerm = ev.target.value || '';
    reflowFromState();
  });

  $root().on('click', '#btnFilter', () => openFilterModal());
}

function openFilterModal() {
  const $m = $modal();
  const $cl = $m.find('#deviceChecklist').empty();

  const list = (STATE.itemsBase || []).slice().sort((a, b) =>
    (a.label || '').localeCompare(b.label || '', 'pt-BR', {
      sensitivity: 'base',
    })
  );

  if (!list.length) {
    $cl.html('<div class="muted">Nenhuma loja carregada.</div>');
    $m.removeClass('hidden');
    return;
  }

  const selected = STATE.selectedIds;
  const frag = document.createDocumentFragment();

  for (const it of list) {
    const safeId =
      String(it.id || '')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 60) || 'id' + Math.random().toString(36).slice(2);
    const checked = !selected || !selected.size || selected.has(it.id);

    const label = document.createElement('label');
    label.className = 'check-item';
    label.setAttribute('role', 'option');
    label.innerHTML = `
      <input type="checkbox" id="chk-${safeId}" data-entity="${escapeHtml(it.id)}" ${
      checked ? 'checked' : ''
    }>
      <span>${escapeHtml(it.label || it.identifier || it.id)}</span>
    `;
    frag.appendChild(label);
  }

  $cl[0].appendChild(frag);
  $m.find(`input[name="sortMode"][value="${STATE.sortMode}"]`).prop('checked', true);

  const $footer = $m.find('.shops-modal-footer');
  if ($footer.length) $footer.show().find('#applyFilters, #resetFilters').show();

  syncChecklistSelectionVisual();
  $m.removeClass('hidden');
}
function closeFilterModal() {
  $modal().addClass('hidden');
}

function bindModal() {
  $root().on('click', '#closeFilter', closeFilterModal);

  $root().on('click', '#selectAll', (ev) => {
    ev.preventDefault();
    $modal().find('.check-item input[type="checkbox"]').prop('checked', true);
    syncChecklistSelectionVisual();
  });

  $root().on('click', '#clearAll', (ev) => {
    ev.preventDefault();
    $modal().find('.check-item input[type="checkbox"]').prop('checked', false);
    syncChecklistSelectionVisual();
  });

  $root().on('click', '#resetFilters', (ev) => {
    ev.preventDefault();
    STATE.selectedIds = null;
    STATE.sortMode = 'cons_desc';
    $modal().find('.check-item input[type="checkbox"]').prop('checked', true);
    $modal().find('input[name="sortMode"][value="cons_desc"]').prop('checked', true);
    syncChecklistSelectionVisual();
    reflowFromState();
  });

  $root().on('click', '#applyFilters', (ev) => {
    ev.preventDefault();
    const set = new Set();
    $modal()
      .find('.check-item input[type="checkbox"]:checked')
      .each((_, el) => {
        const id = $(el).data('entity');
        if (id) set.add(id);
      });

    STATE.selectedIds = set.size === 0 || set.size === STATE.itemsBase.length ? null : set;
    STATE.sortMode = String($modal().find('input[name="sortMode"]:checked').val() || 'cons_desc');

    reflowFromState();
    closeFilterModal();
  });

  $root().on('input', '#filterDeviceSearch', (ev) => {
    const q = (ev.target.value || '').trim().toLowerCase();
    $modal()
      .find('.check-item')
      .each((_, node) => {
        const txt = $(node).text().trim().toLowerCase();
        $(node).toggle(txt.includes(q));
      });
  });

  $root().on('click', '#filterDeviceClear', (ev) => {
    ev.preventDefault();
    const $inp = $modal().find('#filterDeviceSearch');
    $inp.val('');
    $modal().find('.check-item').show();
    $inp.trigger('focus');
  });

  $root().on('click', '#deviceChecklist .check-item', function (ev) {
    if (ev.target && ev.target.tagName && ev.target.tagName.toLowerCase() === 'input') return;
    ev.preventDefault();
    ev.stopPropagation();
    const $chk = $(this).find('input[type="checkbox"]');
    $chk.prop('checked', !$chk.prop('checked')).trigger('change');
  });

  $root().on('change', '#deviceChecklist input[type="checkbox"]', function () {
    const $wrap = $(this).closest('.check-item');
    const on = this.checked;
    $wrap.toggleClass('selected', on).attr('data-checked', on ? 'true' : 'false');
    $wrap.css(
      on
        ? {
            background: 'rgba(62,26,125,.08)',
            borderColor: '#3E1A7D',
            boxShadow: '0 8px 18px rgba(62,26,125,.15)',
          }
        : {
            background: '#fff',
            borderColor: '#D6E1EC',
            boxShadow: '0 6px 14px rgba(0,0,0,.05)',
          }
    );
  });
}

function syncChecklistSelectionVisual() {
  $modal()
    .find('.check-item')
    .each(function () {
      const $el = $(this);
      const on = $el.find('input[type="checkbox"]').prop('checked');
      $el.toggleClass('selected', on).attr('data-checked', on ? 'true' : 'false');
      $el.css(
        on
          ? {
              background: 'rgba(62,26,125,.08)',
              borderColor: '#3E1A7D',
              boxShadow: '0 8px 18px rgba(62,26,125,.15)',
            }
          : {
              background: '#fff',
              borderColor: '#D6E1EC',
              boxShadow: '0 6px 14px rgba(0,0,0,.05)',
            }
      );
    });
}

/** ===================== RFC-0056 FIX v1.1: EMISSION ===================== **/

/**
 * Normaliza valor de kWh para MWh com 2 decimais
 * @param {number} kWhValue - valor em kWh
 * @returns {number} valor em MWh arredondado
 */
function normalizeToMWh(kWhValue) {
  if (typeof kWhValue !== 'number' || isNaN(kWhValue)) return 0;
  return Math.round((kWhValue / 1000) * 100) / 100;
}

/**
 * Normaliza label de dispositivo para classificação consistente
 * @param {string} str - label do dispositivo
 * @returns {string} label normalizado
 */
function normalizeLabel(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Dispatcher: determina tipo de widget e emite evento apropriado
 * RFC-0056 FIX v1.1: Consolidação em myio:telemetry:update
 */
function emitTelemetryUpdate() {
  try {
    // Determinar tipo de widget pelo datasource alias
    const widgetType = detectWidgetType();

    if (!widgetType) {
      LogHelper.log('[RFC-0056] Widget type not detected - skipping emission');
      return;
    }

    // Construir periodKey a partir do filtro atual
    const periodKey = buildPeriodKey();

    // RFC-0002: Domain-specific emission
    if (WIDGET_DOMAIN === 'water') {
      emitWaterTelemetry(widgetType, periodKey);
    } else {
      // Default: energy domain
      if (widgetType === 'lojas') {
        emitLojasTotal(periodKey);
      } else if (widgetType === 'areacomum') {
        emitAreaComumBreakdown(periodKey);
      } else if (widgetType === 'entrada') {
        // RFC-0098: Emit entrada total for energy domain
        emitEntradaTotal(periodKey);
      }
    }
  } catch (err) {
    LogHelper.error('[RFC-0056] Error in emitTelemetryUpdate:', err);
  }
}

/**
 * Detecta tipo de widget baseado no datasource alias
 * RFC-0002: Added 'entrada' detection for water domain
 * @returns {'lojas'|'areacomum'|'entrada'|null}
 */
function detectWidgetType() {
  try {
    LogHelper.log('🔍 [detectWidgetType] Iniciando detecção de tipo de widget...');

    const datasources = ctx.datasources || [];
    LogHelper.log(`[detectWidgetType] Total de datasources detectados: ${datasources.length}`);

    if (!datasources.length) {
      LogHelper.warn('[detectWidgetType] Nenhum datasource encontrado em ctx.datasources!');
      return null;
    }

    // Percorrer todos os datasources
    for (let i = 0; i < datasources.length; i++) {
      const ds = datasources[i];
      const alias = (ds.aliasName || '').toString().toLowerCase().trim();

      LogHelper.log(`🔸 [detectWidgetType] Verificando datasource[${i}]`);
      LogHelper.log(`    ↳ aliasName:     ${ds.aliasName || '(vazio)'}`);
      LogHelper.log(`    ↳ entityName:    ${ds.entityName || '(vazio)'}`);
      LogHelper.log(`    ↳ alias normalizado: "${alias}"`);

      if (!alias) {
        LogHelper.warn(`[detectWidgetType] ⚠️ Alias vazio ou indefinido no datasource[${i}].`);
        continue;
      }

      // RFC-0002: Check for entrada (water domain)
      // Use word boundary matching to avoid false positives like "bomba entrada"
      if (/\bentrada\b/.test(alias) || alias === 'entrada' || alias.includes('entrada')) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "entrada" (com base no alias "${alias}")`);
        return 'entrada';
      }

      // Match "lojas" as standalone word or at end of alias
      // AVOID false positives like "Bomba Lojas", "Subestação Lojas"
      // ACCEPT: "lojas", "widget-lojas", "telemetry-lojas", "consumidores lojas"
      // RFC-0097: Usa EQUIPMENT_EXCLUSION_PATTERN construído do config
      if (/\blojas\b/.test(alias) && !EQUIPMENT_EXCLUSION_PATTERN.test(alias)) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "lojas" (com base no alias "${alias}")`);
        return 'lojas';
      }

      // Match area comum with flexible separators
      if (/\barea\s*comum\b/.test(alias) || alias.includes('areacomum') || alias.includes('area_comum')) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "areacomum" (com base no alias "${alias}")`);
        return 'areacomum';
      }
    }

    LogHelper.warn('[detectWidgetType] ⚠️ Nenhum tipo de widget correspondente encontrado.');
    return null;
  } catch (err) {
    LogHelper.error('[detectWidgetType] ❌ Erro durante detecção de tipo de widget:', err);
    return null;
  }
}

/**
 * Constrói periodKey do filtro atual
 * Formato: "YYYY-MM-DD_YYYY-MM-DD" ou "realtime"
 */
function buildPeriodKey() {
  const timewindow = ctx.defaultSubscription?.subscriptionTimewindow;

  if (!timewindow || timewindow.realtimeWindowMs) {
    return 'realtime';
  }

  const startMs = timewindow.fixedWindow?.startTimeMs || Date.now() - 86400000;
  const endMs = timewindow.fixedWindow?.endTimeMs || Date.now();

  const startDate = new Date(startMs).toISOString().split('T')[0];
  const endDate = new Date(endMs).toISOString().split('T')[0];

  return `${startDate}_${endDate}`;
}

/**
 * RFC-0098: Emite evento entrada_total
 * TELEMETRY (Entrada) → TELEMETRY_INFO
 */
function emitEntradaTotal(periodKey) {
  try {
    // Calcular total de Entrada a partir dos itens enriquecidos
    const entradaTotal = STATE.itemsEnriched.reduce((sum, item) => {
      return sum + (item.value || 0);
    }, 0);

    const totalMWh = normalizeToMWh(entradaTotal);

    const payload = {
      type: 'entrada_total',
      domain: 'energy',
      periodKey: periodKey,
      timestamp: Date.now(),
      source: 'TELEMETRY_Entrada',
      data: {
        total_kWh: entradaTotal,
        total_MWh: totalMWh,
        device_count: STATE.itemsEnriched.length,
      },
    };

    // Cache em sessionStorage
    const cacheKey = `myio:telemetry:entrada_${periodKey}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (e) {
      LogHelper.warn('[RFC-0098] sessionStorage write failed:', e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent('myio:telemetry:update', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);
    LogHelper.log(
      `[RFC-0098] ✅ Emitted entrada_total: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices)`
    );
  } catch (err) {
    LogHelper.error('[RFC-0098] Error in emitEntradaTotal:', err);
  }
}

/**
 * Emite evento lojas_total
 * RFC-0056 FIX v1.1: TELEMETRY (Lojas) → TELEMETRY_INFO
 */
function emitLojasTotal(periodKey) {
  try {
    // Calcular total de Lojas a partir dos itens enriquecidos
    const lojasTotal = STATE.itemsEnriched.reduce((sum, item) => {
      return sum + (item.value || 0);
    }, 0);

    const totalMWh = normalizeToMWh(lojasTotal);

    const payload = {
      type: 'lojas_total',
      domain: 'energy',
      periodKey: periodKey,
      timestamp: Date.now(),
      source: 'TELEMETRY_Lojas',
      data: {
        total_kWh: lojasTotal,
        total_MWh: totalMWh,
        device_count: STATE.itemsEnriched.length,
      },
    };

    // Cache em sessionStorage
    const cacheKey = `myio:telemetry:lojas_${periodKey}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (e) {
      LogHelper.warn('[RFC-0056] sessionStorage write failed:', e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent('myio:telemetry:update', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);
    LogHelper.log(
      `[RFC-0056] ✅ Emitted lojas_total: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices)`
    );
  } catch (err) {
    LogHelper.error('[RFC-0056] Error in emitLojasTotal:', err);
  }
}

/**
 * RFC-0097: Classify device by deviceType attribute
 * Primary classification method - uses deviceType (or deviceProfile when deviceType = 3F_MEDIDOR)
 * Uses centralized DEVICE_CLASSIFICATION_CONFIG
 *
 * Para deviceTypes condicionais (BOMBA, MOTOR), só classifica como climatização
 * se o identifier for de climatização (ex: CAG)
 *
 * @param {Object} item - Device item with deviceType and identifier properties
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'}
 */
function classifyDeviceByDeviceType(item) {
  if (!item) return 'outros';

  // Get effective device type: use deviceType, or deviceProfile if deviceType is 3F_MEDIDOR
  let effectiveType = String(item.deviceType || '').toUpperCase();

  if (effectiveType === '3F_MEDIDOR' && item.deviceProfile) {
    effectiveType = String(item.deviceProfile).toUpperCase();
  }

  if (!effectiveType || effectiveType === 'N/D') {
    return 'outros';
  }

  // DeviceTypes que são SEMPRE climatização (CHILLER, FANCOIL, etc.)
  if (CLIMATIZACAO_DEVICE_TYPES_SET.has(effectiveType)) {
    return 'climatizacao';
  }

  // DeviceTypes condicionais (BOMBA, MOTOR) - só climatização se identifier for CAG, etc.
  if (CLIMATIZACAO_CONDITIONAL_TYPES_SET.has(effectiveType)) {
    const identifier = String(item.identifier || '')
      .toUpperCase()
      .trim();

    // Verificar se o identifier indica climatização
    if (CLIMATIZACAO_IDENTIFIERS_SET.has(identifier)) {
      return 'climatizacao';
    }
    // Verificar prefixos (CAG-, FANCOIL-, etc.)
    for (const prefix of DEVICE_CLASSIFICATION_CONFIG.climatizacao.identifierPrefixes) {
      if (identifier.startsWith(prefix.toUpperCase())) {
        return 'climatizacao';
      }
    }
    // BOMBA/MOTOR sem identifier de climatização → outros
    return 'outros';
  }

  if (ELEVADORES_DEVICE_TYPES_SET.has(effectiveType)) {
    return 'elevadores';
  }

  if (ESCADAS_DEVICE_TYPES_SET.has(effectiveType)) {
    return 'escadas_rolantes';
  }

  // Default: outros
  return 'outros';
}

/**
 * RFC-0097: Classify device by identifier attribute
 * Uses centralized DEVICE_CLASSIFICATION_CONFIG
 * @param {string} identifier - Device identifier (e.g., "CAG", "Fancoil", "ELV", etc.)
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'|null}
 */
function classifyDeviceByIdentifier(identifier = '') {
  // Safe guard against null/undefined/empty
  if (!identifier || identifier === 'N/A' || identifier === 'null' || identifier === 'undefined') {
    return null;
  }

  const id = String(identifier).trim().toUpperCase();

  // Ignore "Sem Identificador identificado" marker
  if (id.includes('SEM IDENTIFICADOR')) {
    return null;
  }

  // Check each category using centralized config
  // Climatização
  if (CLIMATIZACAO_IDENTIFIERS_SET.has(id)) {
    return 'climatizacao';
  }
  for (const prefix of DEVICE_CLASSIFICATION_CONFIG.climatizacao.identifierPrefixes) {
    if (id.startsWith(prefix.toUpperCase())) return 'climatizacao';
  }

  // Elevadores
  if (ELEVADORES_IDENTIFIERS_SET.has(id)) {
    return 'elevadores';
  }
  for (const prefix of DEVICE_CLASSIFICATION_CONFIG.elevadores.identifierPrefixes) {
    if (id.startsWith(prefix.toUpperCase())) return 'elevadores';
  }

  // Escadas Rolantes
  if (ESCADAS_IDENTIFIERS_SET.has(id)) {
    return 'escadas_rolantes';
  }
  for (const prefix of DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.identifierPrefixes) {
    if (id.startsWith(prefix.toUpperCase())) return 'escadas_rolantes';
  }

  // Outros: qualquer outro identifier não reconhecido
  return 'outros';
}

// RFC-0097: classifyDeviceByLabel foi removida - classificação agora é por deviceType

/**
 * RFC-0097: Classify device using deviceType as primary method
 * @param {Object} item - Device item with deviceType, deviceProfile, identifier, and label
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'}
 */
function classifyDevice(item) {
  // Safe guard - ensure item exists
  if (!item) {
    LogHelper.warn('[RFC-0097] classifyDevice called with null/undefined item');
    return 'outros';
  }

  // RFC-0097: Primary classification by deviceType (or deviceProfile when deviceType = 3F_MEDIDOR)
  const category = classifyDeviceByDeviceType(item);

  // Return if we got a specific category (not 'outros')
  if (category !== 'outros') {
    return category;
  }

  // Fallback: try identifier-based classification for special cases (e.g., ESCADASROLANTES)
  if (item.identifier) {
    const categoryByIdentifier = classifyDeviceByIdentifier(item.identifier);
    if (categoryByIdentifier && categoryByIdentifier !== 'outros') {
      return categoryByIdentifier;
    }
  }

  // Default: outros
  return 'outros';
}

/**
 * Emite evento areacomum_breakdown
 * RFC-0056 FIX v1.1: TELEMETRY (AreaComum) → TELEMETRY_INFO
 * RFC-0097: Classification by deviceType, subcategories by identifier
 */
function emitAreaComumBreakdown(periodKey) {
  try {
    LogHelper.log(`[RFC-0097] emitAreaComumBreakdown: classification by deviceType`);

    // Classificar dispositivos por categoria (consumo e contagem)
    const breakdown = {
      climatizacao: { total: 0, count: 0 },
      elevadores: { total: 0, count: 0 },
      escadas_rolantes: { total: 0, count: 0 },
      outros: { total: 0, count: 0 },
    };

    // RFC-0097: Subcategorias de climatização agrupadas por identifier (ou deviceType se identifier vazio)
    // Mapa dinâmico: key = identifier ou deviceType, value = { total, count, label }
    const climatizacaoSubcategories = new Map();

    // RFC-0097: Subcategorias de "outros" agrupadas por deviceType
    const outrosSubcategories = new Map();

    STATE.itemsEnriched.forEach((item) => {
      const energia = item.value || 0;
      const category = classifyDevice(item);

      breakdown[category].total += energia;
      breakdown[category].count += 1;

      // RFC-0097: Agrupar subcategorias de climatização por identifier (ou deviceType)
      if (category === 'climatizacao') {
        const identifier = String(item.identifier || '')
          .toUpperCase()
          .trim();
        const deviceType = String(item.deviceType || '').toUpperCase();

        // Usar identifier como chave de agrupamento, ou deviceType se identifier estiver vazio
        let groupKey = identifier;
        let groupLabel = identifier;

        if (!identifier || identifier === 'N/A' || identifier === 'NULL' || identifier === 'UNDEFINED') {
          groupKey = deviceType || 'OUTROS';
          groupLabel = deviceType || 'Outros';
        }

        // Inicializar grupo se não existir
        if (!climatizacaoSubcategories.has(groupKey)) {
          climatizacaoSubcategories.set(groupKey, {
            total: 0,
            count: 0,
            label: groupLabel,
          });
        }

        // Acumular valores
        const group = climatizacaoSubcategories.get(groupKey);
        group.total += energia;
        group.count += 1;

        // Debug: Log climatização devices
        /*
        LogHelper.log(
          `[RFC-0097] Climatização: deviceType="${deviceType}", identifier="${identifier}", group="${groupKey}", value=${energia.toFixed(
            2
          )} kWh`
        );
        */
      }

      // RFC-0097: Agrupar subcategorias de "outros" por deviceType (ou deviceProfile se 3F_MEDIDOR)
      if (category === 'outros') {
        let deviceType = String(item.deviceType || 'DESCONHECIDO')
          .toUpperCase()
          .trim();

        // Se deviceType é 3F_MEDIDOR, usar deviceProfile como tipo real
        if (deviceType === '3F_MEDIDOR' && item.deviceProfile) {
          deviceType = String(item.deviceProfile).toUpperCase().trim();
        }

        // Usar deviceType como chave de agrupamento
        const groupKey = deviceType || 'DESCONHECIDO';
        const groupLabel = deviceType || 'Desconhecido';

        // Inicializar grupo se não existir
        if (!outrosSubcategories.has(groupKey)) {
          outrosSubcategories.set(groupKey, {
            total: 0,
            count: 0,
            label: groupLabel,
          });
        }

        // Acumular valores
        const group = outrosSubcategories.get(groupKey);
        group.total += energia;
        group.count += 1;
      }

      // Debug log for first 5 items
      if (STATE.itemsEnriched.indexOf(item) < 5) {
        LogHelper.log(
          `[RFC-0097] Item: deviceType="${item.deviceType}", identifier="${item.identifier}", label="${
            item.label
          }" → ${category} (${energia.toFixed(2)} kWh)`
        );
      }
    });

    // Converter Map para objeto para serialização
    const climatizacaoSubcategoriesObj = {};
    climatizacaoSubcategories.forEach((value, key) => {
      climatizacaoSubcategoriesObj[key.toLowerCase()] = value;
    });

    // RFC-0097: Converter outros subcategories Map para objeto
    const outrosSubcategoriesObj = {};
    outrosSubcategories.forEach((value, key) => {
      outrosSubcategoriesObj[key.toLowerCase()] = value;
    });

    // RFC-0097: Log subcategory totals for debugging
    const subcatSummary = {};
    climatizacaoSubcategories.forEach((value, key) => {
      subcatSummary[key] = `${value.count} devices, ${normalizeToMWh(value.total)} MWh`;
    });
    LogHelper.log(`[RFC-0097] Climatização subcategories breakdown:`, subcatSummary);

    // RFC-0097: Log outros subcategory totals
    const outrosSubcatSummary = {};
    outrosSubcategories.forEach((value, key) => {
      outrosSubcatSummary[key] = `${value.count} devices, ${normalizeToMWh(value.total)} MWh`;
    });
    LogHelper.log(`[RFC-0097] Outros subcategories breakdown:`, outrosSubcatSummary);

    const payload = {
      type: 'areacomum_breakdown',
      domain: 'energy',
      periodKey: periodKey,
      timestamp: Date.now(),
      source: 'TELEMETRY_AreaComum',
      data: {
        climatizacao_kWh: breakdown.climatizacao.total,
        climatizacao_MWh: normalizeToMWh(breakdown.climatizacao.total),
        climatizacao_count: breakdown.climatizacao.count,
        elevadores_kWh: breakdown.elevadores.total,
        elevadores_MWh: normalizeToMWh(breakdown.elevadores.total),
        elevadores_count: breakdown.elevadores.count,
        escadas_rolantes_kWh: breakdown.escadas_rolantes.total,
        escadas_rolantes_MWh: normalizeToMWh(breakdown.escadas_rolantes.total),
        escadas_rolantes_count: breakdown.escadas_rolantes.count,
        outros_kWh: breakdown.outros.total,
        outros_MWh: normalizeToMWh(breakdown.outros.total),
        outros_count: breakdown.outros.count,
        device_count: STATE.itemsEnriched.length,
        // RFC-0097: Subcategorias de climatização (objeto para serialização)
        climatizacao_subcategories: climatizacaoSubcategoriesObj,
        // RFC-0097: Subcategorias de "outros" agrupadas por deviceType
        outros_subcategories: outrosSubcategoriesObj,
      },
    };

    // Cache em sessionStorage
    const cacheKey = `myio:telemetry:areacomum_${periodKey}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (e) {
      LogHelper.warn('[RFC-0056] sessionStorage write failed:', e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent('myio:telemetry:update', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);

    const totalMWh = normalizeToMWh(
      breakdown.climatizacao.total +
        breakdown.elevadores.total +
        breakdown.escadas_rolantes.total +
        breakdown.outros.total
    );
    LogHelper.log(
      `[RFC-0056] ✅ Emitted areacomum_breakdown: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices, climatizacao: ${breakdown.climatizacao.count})`
    );
  } catch (err) {
    LogHelper.error('[RFC-0056] Error in emitAreaComumBreakdown:', err);
  }
}

/**
 * RFC-0002: Emit water telemetry data
 * Emits myio:telemetry:provide-water for TELEMETRY_INFO to consume
 * @param {string} widgetType - 'entrada', 'lojas', or 'areacomum' (detected from alias)
 * @param {string} periodKey - Period identifier
 */
function emitWaterTelemetry(widgetType, periodKey) {
  try {
    // Check for waterContext override in settings
    const waterContextOverride = self.ctx.settings?.waterContext;
    let context = null;

    // Use override if set and not 'auto'
    if (waterContextOverride && waterContextOverride !== 'auto') {
      context = waterContextOverride;
      LogHelper.log(`[RFC-0002 Water] Using waterContext override: ${context}`);
    } else {
      // Map widgetType to water context (auto-detection from alias)
      if (widgetType === 'entrada') {
        context = 'entrada';
      } else if (widgetType === 'lojas') {
        context = 'lojas';
      } else if (widgetType === 'areacomum') {
        context = 'areaComum';
      }
    }

    if (!context) {
      LogHelper.warn(`[RFC-0002 Water] Unknown widget type: ${widgetType}`);
      return;
    }

    // Calculate total in m³
    const totalM3 = STATE.itemsEnriched.reduce((sum, item) => sum + (item.value || 0), 0);

    // Build device list
    const devices = STATE.itemsEnriched.map((item) => ({
      id: item.id || item.entityId || '',
      label: item.label || item.name || '',
      value: item.value || 0,
      deviceType: item.deviceType || 'HIDROMETRO',
    }));

    // RFC-0002: For areaComum context, classify devices into banheiros vs outros
    // Banheiros are identified by "banheiro" in label or identifier (case-insensitive)
    let banheirosBreakdown = null;
    if (context === 'areaComum') {
      const banheirosDevices = [];
      const outrosDevices = [];

      devices.forEach((device) => {
        const labelLower = (device.label || '').toLowerCase();
        const idLower = (device.id || '').toLowerCase();
        const isBanheiro = labelLower.includes('banheiro') || idLower.includes('banheiro');

        if (isBanheiro) {
          banheirosDevices.push(device);
        } else {
          outrosDevices.push(device);
        }
      });

      const banheirosTotal = banheirosDevices.reduce((sum, d) => sum + (d.value || 0), 0);
      const outrosTotal = outrosDevices.reduce((sum, d) => sum + (d.value || 0), 0);

      banheirosBreakdown = {
        banheiros: {
          total: banheirosTotal,
          devices: banheirosDevices,
          count: banheirosDevices.length,
        },
        outros: {
          total: outrosTotal,
          devices: outrosDevices,
          count: outrosDevices.length,
        },
      };

      LogHelper.log(
        `[RFC-0002 Water] areaComum breakdown: banheiros=${banheirosTotal.toFixed(2)} m³ (${
          banheirosDevices.length
        } devices), outros=${outrosTotal.toFixed(2)} m³ (${outrosDevices.length} devices)`
      );
    }

    const payload = {
      context: context,
      domain: 'water',
      total: totalM3,
      devices: devices,
      periodKey: periodKey,
      timestamp: new Date().toISOString(),
      // RFC-0002: Include banheiros breakdown for areaComum context
      banheirosBreakdown: banheirosBreakdown,
    };

    // Dispatch water event
    const event = new CustomEvent('myio:telemetry:provide-water', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);

    LogHelper.log(
      `[RFC-0002 Water] ✅ Emitted water telemetry: context=${context}, total=${totalM3.toFixed(
        2
      )} m³, devices=${devices.length}`
    );
  } catch (err) {
    LogHelper.error('[RFC-0002 Water] Error in emitWaterTelemetry:', err);
  }
}

/** ===================== RECOMPUTE (local only) ===================== **/
function reflowFromState() {
  const visible = applyFilters(STATE.itemsEnriched, STATE.searchTerm, STATE.selectedIds, STATE.sortMode);
  const { visible: withPerc, groupSum } = recomputePercentages(visible);
  renderHeader(withPerc.length, groupSum);
  renderList(withPerc);
}

/** ===================== HYDRATE (end-to-end) ===================== **/
async function hydrateAndRender() {
  if (hydrating) return;
  hydrating = true;

  // Mostra modal durante todo o processo (mensagem fixa)
  showBusy();

  try {
    // 0) Datas: verificar se existem (não obrigatórias para energy/water - só para API call)
    let range = null;
    let hasDateRange = false;
    try {
      range = mustGetDateRange();
      hasDateRange = true;
    } catch (_e) {
      // For energy/water domains, continue rendering UI even without dates
      // Just skip the API call for totals
      if (WIDGET_DOMAIN === 'energy' || WIDGET_DOMAIN === 'water') {
        LogHelper.warn(
          '[DeviceCards] No date range set, but continuing for energy/water domain - buttons will be enabled'
        );
      } else {
        LogHelper.warn('[DeviceCards] Aguardando intervalo de datas (startDateISO/endDateISO).');
        return;
      }
    }

    // 1) Auth (skip for temperature domain - no API calls needed)
    // Also skip if no date range (no API call will be made anyway)
    if (WIDGET_DOMAIN !== 'temperature' && hasDateRange) {
      const okAuth = await ensureAuthReady(6000, 150);
      if (!okAuth) {
        LogHelper.warn('[DeviceCards] Auth not ready; adiando hidratação.');
        return;
      }
    } else {
      LogHelper.log('[DeviceCards] Skipping auth check - temperature domain or no date range');
    }

    // 2) Lista autoritativa
    STATE.itemsBase = buildAuthoritativeItems();
    // Expose for temperature tooltip
    window._telemetryAuthoritativeItems = STATE.itemsBase;

    // 3) Totais na API (skip for temperature domain - uses only ctx.data telemetry)
    // Also skip if no date range
    let apiMap = new Map();
    if (WIDGET_DOMAIN !== 'temperature' && hasDateRange && range) {
      try {
        apiMap = await fetchApiTotals(range.startISO, range.endISO);
      } catch (err) {
        LogHelper.error('[DeviceCards] API error:', err);
        apiMap = new Map();
      }
    } else {
      LogHelper.log(
        '[DeviceCards] Skipping API fetch - temperature domain or no date range - using ctx.data only'
      );
    }

    // 4) Enrich + render
    STATE.itemsEnriched = enrichItemsWithTotals(STATE.itemsBase, apiMap);

    // 5) Sanitiza seleção
    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map((x) => x.id));
      const next = new Set([...STATE.selectedIds].filter((id) => valid.has(id)));
      STATE.selectedIds = next.size ? next : null;
    }

    reflowFromState();
  } finally {
    hydrating = false;
    hideBusy();
  }
}

/** ===================== TB LIFE CYCLE ===================== **/
self.onInit = async function () {
  $(self.ctx.$container).css({
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  });

  MyIO = (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) ||
    (typeof window !== 'undefined' && window.MyIOLibrary) || {
      showAlert: function () {
        alert('A Bliblioteca Myio não foi carregada corretamente!');
      },
    };

  $root().find('#labelWidgetId').text(self.ctx.settings?.labelWidget);

  // RFC-0042: Set widget configuration from settings FIRST
  WIDGET_DOMAIN = self.ctx.settings?.DOMAIN || 'energy';
  LogHelper.log(`[TELEMETRY] Configured EARLY: domain=${WIDGET_DOMAIN}`);

  // Show temperature info icon for temperature domain
  if (WIDGET_DOMAIN === 'temperature') {
    const tempInfoTrigger = $root().find('#tempInfoTrigger');
    if (tempInfoTrigger.length) {
      tempInfoTrigger.css('display', 'inline-flex');

      // Add event listeners for tooltip
      tempInfoTrigger.on('mouseenter', function (e) {
        showTempInfoTooltip(this);
      });
      tempInfoTrigger.on('mouseleave', function () {
        hideTempInfoTooltip();
      });

      LogHelper.log('[TELEMETRY] Temperature info icon initialized');
    }
  }

  // RFC-0063: Load classification mode configuration
  USE_IDENTIFIER_CLASSIFICATION = self.ctx.settings?.USE_IDENTIFIER_CLASSIFICATION || false;
  USE_HYBRID_CLASSIFICATION = self.ctx.settings?.USE_HYBRID_CLASSIFICATION || false;
  LogHelper.log(
    `[RFC-0063] Classification mode: ${
      USE_IDENTIFIER_CLASSIFICATION
        ? USE_HYBRID_CLASSIFICATION
          ? 'HYBRID (identifier + label fallback)'
          : 'IDENTIFIER ONLY'
        : 'LEGACY (label only)'
    }`
  );

  // RFC-0042: Request data from orchestrator (defined early for use in handlers)
  function requestDataFromOrchestrator() {
    const hasDateRange = self.ctx.scope?.startDateISO && self.ctx.scope?.endDateISO;

    if (!hasDateRange) {
      LogHelper.warn('[TELEMETRY] No date range set');

      // For energy/water domains, still render UI to enable buttons (skip API call)
      if (WIDGET_DOMAIN === 'energy' || WIDGET_DOMAIN === 'water') {
        LogHelper.log('[TELEMETRY] Energy/Water domain - rendering UI without data fetch');
        if (typeof hydrateAndRender === 'function') {
          hydrateAndRender();
        }
      }
      return;
    }

    const period = {
      startISO: self.ctx.scope.startDateISO,
      endISO: self.ctx.scope.endDateISO,
      granularity: window.calcGranularity
        ? window.calcGranularity(self.ctx.scope.startDateISO, self.ctx.scope.endDateISO)
        : 'day',
      tz: 'America/Sao_Paulo',
    };

    LogHelper.log(`[TELEMETRY] Requesting data for domain=${WIDGET_DOMAIN}, period:`, period);

    // RFC-0053: Single window context - emit to current window only
    window.dispatchEvent(
      new CustomEvent('myio:telemetry:request-data', {
        detail: { domain: WIDGET_DOMAIN, period },
      })
    );
  }

  // Listener com modal: evento externo de mudança de data
  dateUpdateHandler = function (ev) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ DATE UPDATE EVENT RECEIVED!`, ev.detail);

    try {
      // RFC-0042: Handle both old and new format
      let startISO, endISO;

      if (ev.detail?.period) {
        // New format from HEADER
        startISO = ev.detail.period.startISO;
        endISO = ev.detail.period.endISO;
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Using NEW format (period object)`);
      } else {
        // Old format (backward compatibility)
        const { startDate, endDate } = ev.detail || {};
        startISO = new Date(startDate).toISOString();
        endISO = new Date(endDate).toISOString();
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Using OLD format (startDate/endDate)`);
      }

      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Date range updated:`, startISO, endISO);

      // Datas mandatórias salvas no scope
      self.ctx.scope = self.ctx.scope || {};
      self.ctx.scope.startDateISO = startISO;
      self.ctx.scope.endDateISO = endISO;

      // IMPORTANT: Reset lastProcessedPeriodKey when new date range is selected
      // This allows processing fresh data for the new period
      lastProcessedPeriodKey = null;
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔄 Reset lastProcessedPeriodKey for new date range`);

      // Exibe modal
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔄 Calling showBusy()...`);
      showBusy();
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ showBusy() called`);

      // RFC-0045 FIX: Check if there's a pending provide-data event waiting for this period
      if (pendingProvideData) {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ Found pending provide-data event, processing now...`);
        const pending = pendingProvideData;
        pendingProvideData = null; // Clear pending event

        // Process the pending event immediately
        dataProvideHandler({ detail: pending });
        return; // Don't request data again, we already have it
      }

      // For temperature domain, use hydrateAndRender directly (no API needed, uses ctx.data only)
      if (WIDGET_DOMAIN === 'temperature') {
        LogHelper.log(
          `[TELEMETRY ${WIDGET_DOMAIN}] ✅ Temperature domain - using hydrateAndRender directly (no orchestrator)`
        );
        hasRequestedInitialData = true;

        if (typeof hydrateAndRender === 'function') {
          hydrateAndRender();
        } else {
          LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] hydrateAndRender não encontrada.`);
        }
      } else {
        // RFC-0053: Direct access to orchestrator (single window context)
        const orchestrator = window.MyIOOrchestrator;

        if (orchestrator) {
          LogHelper.log(
            `[TELEMETRY ${WIDGET_DOMAIN}] ✅ RFC-0053: Requesting data from orchestrator (single window)`
          );

          // IMPORTANT: Mark as requested BEFORE calling requestDataFromOrchestrator
          // This prevents the setTimeout(500ms) from making a duplicate request
          hasRequestedInitialData = true;

          requestDataFromOrchestrator();
        } else {
          // Fallback to old behavior
          LogHelper.warn(`[TELEMETRY ${WIDGET_DOMAIN}] ⚠️ Orchestrator not available, using legacy fetch`);

          if (typeof hydrateAndRender === 'function') {
            hydrateAndRender();
          } else {
            LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] hydrateAndRender não encontrada.`);
          }
        }
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] dateUpdateHandler error:`, err);
      hideBusy();
    }
  };

  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📡 Registering myio:update-date listener...`);
  window.addEventListener('myio:update-date', dateUpdateHandler);
  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ myio:update-date listener registered!`);

  // RFC-0042: Listen for clear event from HEADER (when user clicks "Limpar" button)
  window.addEventListener('myio:telemetry:clear', (ev) => {
    const { domain } = ev.detail;

    // Only clear if it's for my domain
    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Ignoring clear event for domain: ${domain}`);
      return;
    }

    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧹 Received clear event - clearing visual content`);

    try {
      // Clear the items list
      STATE.itemsBase = [];
      STATE.itemsEnriched = [];
      STATE.selectedIds = null;

      // IMPORTANT: Use $root() to get elements within THIS widget's scope
      const $widget = $root();

      // Clear the visual list
      const $shopsList = $widget.find('#shopsList');
      if ($shopsList.length > 0) {
        $shopsList.empty();
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsList cleared`);
      }

      // Reset counts to 0
      const $shopsCount = $widget.find('#shopsCount');
      const $shopsTotal = $widget.find('#shopsTotal');

      if ($shopsCount.length > 0) {
        $shopsCount.text('(0)');
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsCount reset to 0`);
      }

      if ($shopsTotal.length > 0) {
        $shopsTotal.text('0,00');
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsTotal reset to 0,00`);
      }

      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧹 Clear completed successfully`);
    } catch (err) {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] ❌ Error during clear:`, err);
    }
  });

  // Test if listener is working
  setTimeout(() => {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧪 Testing listener registration...`);
    const testEvent = new CustomEvent('myio:update-date', {
      detail: {
        period: {
          startISO: '2025-09-26T00:00:00-03:00',
          endISO: '2025-10-02T23:59:59-03:00',
          granularity: 'day',
          tz: 'America/Sao_Paulo',
        },
      },
    });
    // Don't dispatch, just check if handler exists
    if (typeof dateUpdateHandler === 'function') {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ dateUpdateHandler is defined and ready`);
    } else {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] ❌ dateUpdateHandler is NOT defined!`);
    }
  }, 100);

  // RFC-0045 FIX: Store pending provide-data events that arrive before update-date
  let pendingProvideData = null;

  // RFC-0042: Listen for data provision from orchestrator
  dataProvideHandler = function (ev) {
    LogHelper.log(
      `[TELEMETRY ${WIDGET_DOMAIN}] 📦 Received provide-data event for domain ${
        ev.detail.domain
      }, periodKey: ${ev.detail.periodKey}, items: ${ev.detail.items?.length || 0}`
    );
    const { domain, periodKey, items } = ev.detail;

    // Only process if it's for my domain
    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] ⏭️ Ignoring event for domain ${domain}, my domain is ${WIDGET_DOMAIN}`
      );
      return;
    }

    // IMPORTANT: Prevent duplicate processing of the same periodKey
    // The Orchestrator retries emission after 1s, so we need to deduplicate
    if (lastProcessedPeriodKey === periodKey) {
      LogHelper.log(`[TELEMETRY] ⏭️ Skipping duplicate provide-data for periodKey: ${periodKey}`);
      return;
    }

    // Validate current period matches
    const myPeriod = {
      startISO: self.ctx.scope?.startDateISO,
      endISO: self.ctx.scope?.endDateISO,
    };

    // RFC-0045 FIX: If period not set yet, STORE the event and wait for myio:update-date
    if (!myPeriod.startISO || !myPeriod.endISO) {
      LogHelper.warn(`[TELEMETRY] ⏸️ Period not set yet, storing provide-data event for later processing`);
      pendingProvideData = { domain, periodKey, items };
      // DON'T call hideBusy() here - wait for update-date to process the data
      return;
    }

    // Mark this periodKey as processed ONLY when actually processing
    lastProcessedPeriodKey = periodKey;

    // IMPORTANT: Do NOT call showBusy() here - it was already called in dateUpdateHandler
    // Calling it again creates a NEW timeout that won't be properly cancelled
    LogHelper.log(`[TELEMETRY] 🔄 Processing data from orchestrator...`);
    LogHelper.log(`[TELEMETRY] Received ${items.length} items from orchestrator for domain ${domain}`);

    // Extract my datasource IDs
    const myDatasourceIds = extractDatasourceIds(self.ctx.datasources);
    //LogHelper.log(`[TELEMETRY] My datasource IDs:`, myDatasourceIds);
    //LogHelper.log(`[TELEMETRY] Sample orchestrator items:`, items.slice(0, 3));

    // RFC-0042: Debug datasources structure to understand the mapping
    /*
    if (self.ctx.datasources && self.ctx.datasources.length > 0) {
      LogHelper.log(`[TELEMETRY] Datasource[0] keys:`, Object.keys(self.ctx.datasources[0]));
      LogHelper.log(`[TELEMETRY] Datasource[0] entityId:`, self.ctx.datasources[0].entityId);
      LogHelper.log(`[TELEMETRY] Datasource[0] entityName:`, self.ctx.datasources[0].entityName);
      LogHelper.log(`[TELEMETRY] Datasource[0] full:`, JSON.stringify(self.ctx.datasources[0], null, 2));
    }
    if (self.ctx.data && self.ctx.data.length > 0) {
      LogHelper.log(`[TELEMETRY] Data[0] keys:`, Object.keys(self.ctx.data[0]));
      LogHelper.log(`[TELEMETRY] Data[0] full:`, JSON.stringify(self.ctx.data[0], null, 2));
    }
      */

    // Data filtering is done by datasource IDs (ThingsBoard handles grouping)

    // RFC-0042: Filter items by datasource IDs
    // ThingsBoard datasource entityId should match API item id (ingestionId)
    const datasourceIdSet = new Set(myDatasourceIds);
    let filtered = items.filter((item) => {
      // Check if item.id (from API) matches any datasource entityId
      return datasourceIdSet.has(item.id) || datasourceIdSet.has(item.tbId);
    });

    LogHelper.log(
      `[TELEMETRY] Filtered ${items.length} items down to ${filtered.length} items matching datasources`
    );

    // If no matches, log warning and use all items (temporary fallback)
    if (filtered.length === 0) {
      LogHelper.warn(`[TELEMETRY] No items match datasource IDs! Using all items as fallback.`);
      LogHelper.warn(`[TELEMETRY] Sample datasource ID:`, myDatasourceIds[0]);
      LogHelper.warn(`[TELEMETRY] Sample API item ID:`, items[0]?.id);
      filtered = items;
    }

    // Convert orchestrator items to TELEMETRY widget format
    filtered = filtered.map((item) => ({
      id: item.tbId || item.id,
      tbId: item.tbId || item.id,
      ingestionId: item.ingestionId || item.id,
      identifier: item.identifier || item.id,
      label: item.label || item.identifier || item.id,
      value: Number(item.value || 0),
      perc: 0,
      deviceType: item.deviceType || 'energy',
      slaveId: item.slaveId || null,
      centralId: item.centralId || null,
      updatedIdentifiers: {},
    }));

    // DEBUG: Log sample item with value
    if (filtered.length > 0 && filtered[0].value > 0) {
      LogHelper.log(`[TELEMETRY] 🔍 Sample orchestrator item after mapping:`, {
        ingestionId: filtered[0].ingestionId,
        label: filtered[0].label,
        value: filtered[0].value,
      });
    }

    LogHelper.log(`[TELEMETRY] Using ${filtered.length} items after processing`);

    // IMPORTANT: Merge orchestrator data with existing TB data
    // Keep original labels/identifiers from TB, only update values from orchestrator
    if (!STATE.itemsBase || STATE.itemsBase.length === 0) {
      // First load: build from TB data
      LogHelper.log(`[TELEMETRY] Building itemsBase from TB data...`);
      STATE.itemsBase = buildAuthoritativeItems();
      window._telemetryAuthoritativeItems = STATE.itemsBase; // Expose for temperature tooltip
      LogHelper.log(`[TELEMETRY] Built ${STATE.itemsBase.length} items from TB`);
    }

    // Create map of orchestrator values by ingestionId
    const orchestratorValues = new Map();
    filtered.forEach((item) => {
      if (item.ingestionId) {
        const value = Number(item.value || 0);
        orchestratorValues.set(item.ingestionId, value);

        // Debug: log non-zero values from API
        if (value > 0) {
          //LogHelper.log(`[TELEMETRY] ✅ Orchestrator has data: ${item.label} (${item.ingestionId}) = ${value}`);
        }
      }
    });
    LogHelper.log(`[TELEMETRY] Orchestrator values map size: ${orchestratorValues.size}`);

    // Update values in existing items
    STATE.itemsEnriched = STATE.itemsBase.map((tbItem) => {
      const orchestratorValue = orchestratorValues.get(tbItem.ingestionId);

      // TANK/CAIXA_DAGUA devices: use telemetry data from TB, NOT from orchestrator API
      const isTankDevice = tbItem.deviceType === 'TANK' || tbItem.deviceType === 'CAIXA_DAGUA';

      // DEBUG: Log matching process for all items
      if (orchestratorValue !== undefined && orchestratorValue > 0) {
        //LogHelper.log(`[TELEMETRY] ✅ MATCH FOUND: ${tbItem.label} (ingestionId: ${tbItem.ingestionId}) = ${orchestratorValue}`);
      } else {
        //LogHelper.warn(`[TELEMETRY] ❌ NO MATCH: ${tbItem.label} (ingestionId: ${tbItem.ingestionId}), orchestrator=${orchestratorValue}, TB=${tbItem.value}`);
      }

      // For TANK devices, preserve the telemetry values (don't overwrite with API)
      if (isTankDevice) {
        return {
          ...tbItem,
          // Keep ALL values from buildAuthoritativeItems (waterLevel, waterPercentage, value, perc)
          value: tbItem.value || 0,
          perc: tbItem.perc || 0,
          waterLevel: tbItem.waterLevel || 0,
          waterPercentage: tbItem.waterPercentage || 0,
        };
      }

      // For other devices, use orchestrator API values
      return {
        ...tbItem,
        value: orchestratorValue !== undefined ? orchestratorValue : tbItem.value || 0,
        perc: 0,
      };
    });

    LogHelper.log(`[TELEMETRY] Enriched ${STATE.itemsEnriched.length} items with orchestrator values`);

    // RFC-0056 FIX v1.1: Emit telemetry update after enrichment
    emitTelemetryUpdate();

    // Sanitize selection
    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map((x) => x.id));
      const next = new Set([...STATE.selectedIds].filter((id) => valid.has(id)));
      STATE.selectedIds = next.size ? next : null;
    }

    reflowFromState();

    // RFC-0044: ALWAYS hide busy when data is provided, regardless of source
    LogHelper.log(`[TELEMETRY] 🏁 Data processed successfully - ensuring busy is hidden`);

    // Force hide busy with minimal delay to ensure UI update
    setTimeout(() => {
      hideBusy();
      // Double-check: if orchestrator busy is still showing, force hide it
      if (window.MyIOOrchestrator && window.MyIOOrchestrator.getBusyState) {
        const busyState = window.MyIOOrchestrator.getBusyState();
        if (busyState.isVisible) {
          LogHelper.warn(
            `[TELEMETRY] ⚠️ Orchestrator busy still visible after data processing - force hiding`
          );
          window.MyIOOrchestrator.hideGlobalBusy();
        }
      }
    }, 100); // Reduced to 100ms for faster response
  };

  /**
   * Extracts ingestionIds from ThingsBoard ctx.data (not datasource entityIds).
   * Each device has 6 keys (slaveId, centralId, ingestionId, connectionStatus, deviceType, identifier).
   * We need to extract the ingestionId values to match with API data.
   */
  function extractDatasourceIds(datasources) {
    // Build index from ctx.data to get ingestionId for each device
    const ingestionIds = new Set();
    const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];

    for (const row of rows) {
      const key = String(row?.dataKey?.name || '').toLowerCase();
      const val = row?.data?.[0]?.[1];

      if (key === 'ingestionid' && val && isValidUUID(String(val))) {
        ingestionIds.add(String(val));
      }
    }

    return Array.from(ingestionIds);
  }

  window.addEventListener('myio:telemetry:provide-data', dataProvideHandler);

  // RFC-0056 FIX v1.1: Listen for request_refresh from TELEMETRY_INFO
  let requestRefreshHandler = function (ev) {
    const { type, domain, periodKey } = ev.detail || {};

    if (type !== 'request_refresh') return;
    if (domain !== WIDGET_DOMAIN) return;

    LogHelper.log(`[RFC-0056] Received request_refresh for domain ${domain}, periodKey ${periodKey}`);

    // Re-emit telemetry data
    const currentPeriodKey = buildPeriodKey();
    if (currentPeriodKey === periodKey) {
      LogHelper.log(`[RFC-0056] Re-emitting data for current period`);
      emitTelemetryUpdate();
    } else {
      LogHelper.warn(`[RFC-0056] Period mismatch: requested ${periodKey}, current ${currentPeriodKey}`);
    }
  };

  window.addEventListener('myio:telemetry:update', requestRefreshHandler);

  // Check for stored data from orchestrator (in case we missed the event)
  setTimeout(() => {
    // RFC-0053: Direct access to orchestrator data (single window context)
    const orchestratorData = window.MyIOOrchestratorData;

    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔍 Checking for stored orchestrator data...`);

    // First, try stored data
    if (orchestratorData && orchestratorData[WIDGET_DOMAIN]) {
      const storedData = orchestratorData[WIDGET_DOMAIN];
      const age = Date.now() - storedData.timestamp;

      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] Found stored data: ${
          storedData.items?.length || 0
        } items, age: ${age}ms`
      );

      // Use stored data if it's less than 30 seconds old AND has items
      if (age < 30000 && storedData.items && storedData.items.length > 0) {
        LogHelper.log(
          `[TELEMETRY ${WIDGET_DOMAIN}] ✅ RFC-0053: Using stored orchestrator data (single window)`
        );
        dataProvideHandler({
          detail: {
            domain: WIDGET_DOMAIN,
            periodKey: storedData.periodKey,
            items: storedData.items,
          },
        });
        return;
      } else {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ⚠️ Stored data is too old or empty, ignoring`);
      }
    } else {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ℹ️ No stored data found for domain ${WIDGET_DOMAIN}`);
    }

    // If no stored data AND we haven't requested yet, request fresh data
    if (!hasRequestedInitialData) {
      // For temperature domain, use hydrateAndRender directly (no orchestrator needed)
      if (WIDGET_DOMAIN === 'temperature') {
        LogHelper.log(
          `[TELEMETRY ${WIDGET_DOMAIN}] 📡 Temperature domain - calling hydrateAndRender directly...`
        );
        hasRequestedInitialData = true;
        hydrateAndRender();
      } else {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📡 Requesting fresh data from orchestrator...`);
        requestDataFromOrchestrator();
      }
    } else {
      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] ⏭️ Skipping duplicate request (already requested via event)`
      );
    }
  }, 500); // Wait 500ms for widget to fully initialize

  // Auth do cliente/ingestion
  // RFC-0091: Use shared customerTB_ID from MAIN widget via window.MyIOUtils
  const customerTB_ID = window.MyIOUtils?.customerTB_ID;
  if (!customerTB_ID) {
    console.error(
      '[TELEMETRY] customerTB_ID not available from window.MyIOUtils - MAIN widget must load first'
    );
  }
  //DEVICE_TYPE = self.ctx.settings?.DEVICE_TYPE || "energy";
  const jwt = localStorage.getItem('jwt_token');

  const boolExecSync = new URLSearchParams(window.location.search).get('boolExecSync') === 'true';

  // RFC-0071: Trigger device profile synchronization (runs once)
  if (!__deviceProfileSyncComplete && boolExecSync) {
    try {
      console.log('[EQUIPMENTS] [RFC-0071] Triggering device profile sync...');
      const syncResult = await syncDeviceProfileAttributes();
      __deviceProfileSyncComplete = true;

      if (syncResult.synced > 0) {
        console.log(
          '[EQUIPMENTS] [RFC-0071] ⚠️ Widget reload recommended to load new deviceProfile attributes'
        );
        console.log(
          '[EQUIPMENTS] [RFC-0071] You may need to refresh the dashboard to see deviceProfile in ctx.data'
        );
      }
    } catch (error) {
      console.error('[EQUIPMENTS] [RFC-0071] Sync failed, continuing without it:', error);
      // Don't block widget initialization if sync fails
    }
  }

  try {
    const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
    CLIENT_ID = attrs?.client_id || '';
    CLIENT_SECRET = attrs?.client_secret || '';
    CUSTOMER_ING_ID = attrs?.ingestionId || '';
    MAP_INSTANTANEOUS_POWER = attrs?.mapInstantaneousPower ? JSON.parse(attrs?.mapInstantaneousPower) : null;

    // Expõe credenciais globalmente para uso no FOOTER (modal de comparação)
    window.__MYIO_CLIENT_ID__ = CLIENT_ID;
    window.__MYIO_CLIENT_SECRET__ = CLIENT_SECRET;
    window.__MYIO_CUSTOMER_ING_ID__ = CUSTOMER_ING_ID;

    MyIOAuth = MyIO.buildMyioIngestionAuth({
      dataApiHost: DATA_API_HOST,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });

    LogHelper.log('[DeviceCards] Auth init OK');
    try {
      await MyIOAuth.getToken();
    } catch {
      // Pre-warming token fetch, failure is non-critical
    }
  } catch (err) {
    LogHelper.error('[DeviceCards] Auth init FAIL', err);
  }

  // Bind UI
  bindHeader();
  bindModal();

  // ---------- Datas iniciais: "Current Month So Far" ----------
  if (!self.ctx?.scope?.startDateISO || !self.ctx?.scope?.endDateISO) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0); // 1º dia 00:00
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 0); // hoje 23:59:59
    self.ctx.scope = self.ctx.scope || {};
    self.ctx.scope.startDateISO = start.toISOString();
    self.ctx.scope.endDateISO = end.toISOString();
  }
  // ------------------------------------------------------------

  const hasData = Array.isArray(self.ctx.data) && self.ctx.data.length > 0;
  // RFC-0042: Removed direct API fetch - now using orchestrator
  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] onInit - Waiting for orchestrator data...`);

  // Build initial itemsBase from ThingsBoard data
  if (hasData && (!STATE.itemsBase || STATE.itemsBase.length === 0)) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Building itemsBase from TB data in onInit...`);
    STATE.itemsBase = buildAuthoritativeItems();
    window._telemetryAuthoritativeItems = STATE.itemsBase; // Expose for temperature tooltip
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Built ${STATE.itemsBase.length} items from TB`);

    // Initial render with zero values (will be updated by orchestrator)
    STATE.itemsEnriched = STATE.itemsBase.map((item) => ({
      ...item,
      value: 0,
      perc: 0,
    }));

    reflowFromState();
  }

  // Only show busy if we have a date range defined
  if (self.ctx?.scope?.startDateISO && self.ctx?.scope?.endDateISO) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Initial period defined, showing busy...`);
    showBusy();
  } else {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] No initial period, waiting for myio:update-date event...`);
  }
};

// onDataUpdated removido (no-op por ora)
self.onDataUpdated = function () {
  /* no-op */
};

self.onResize = function () {};
self.onDestroy = function () {
  if (dateUpdateHandler) {
    window.removeEventListener('myio:update-date', dateUpdateHandler);
    LogHelper.log("[DeviceCards] Event listener 'myio:update-date' removido.");
  }
  if (dataProvideHandler) {
    window.removeEventListener('myio:telemetry:provide-data', dataProvideHandler);
    LogHelper.log("[DeviceCards] Event listener 'myio:telemetry:provide-data' removido.");
  }
  // RFC-0056 FIX v1.1: Remove request_refresh listener
  if (requestRefreshHandler) {
    window.removeEventListener('myio:telemetry:update', requestRefreshHandler);
    LogHelper.log("[RFC-0056] Event listener 'myio:telemetry:update' removido.");
  }
  try {
    $root().off();
  } catch {
    // jQuery cleanup may fail if element no longer exists
  }

  hideBusy();
  hideGlobalSuccessModal();
};
