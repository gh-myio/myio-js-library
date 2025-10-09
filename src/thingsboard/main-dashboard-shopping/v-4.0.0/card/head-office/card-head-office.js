// src/thingsboard/main-dashboard-shopping/v-4.0.0/card/head-office/card-head-office.js
// Core Head Office card component implementation

/* eslint-env browser */
/* eslint-disable */
import { CSS_STRING } from './card-head-office.css.js';
import { Icons, ICON_MAP } from '../../head-office/card-head-office.icons';
import { DEFAULT_I18N } from '../../head-office/card-head-office.types';

const CSS_TAG = 'head-office-card-v1';

/**
 * Ensure CSS is injected once per page
 */
function ensureCss() {
  if (!document.querySelector(`style[data-myio-css="${CSS_TAG}"]`)) {
    const style = document.createElement('style');
    style.setAttribute('data-myio-css', CSS_TAG);
    style.textContent = CSS_STRING;
    document.head.appendChild(style);
  }
}

const ModalIcons = {
  central: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9"/><path d="M12 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z"/></svg>`,
  connection: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>`,
  target: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  tolerance: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  excess: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
};

/**
 * Normalize and validate parameters
 */
function normalizeParams(params) {
  if (!params || !params.entityObject) {
    throw new Error('renderCardCompenteHeadOffice: entityObject is required');
  }

  const entityObject = params.entityObject;
  if (!entityObject.entityId) {
    console.warn('renderCardCompenteHeadOffice: entityId is missing, generating temporary ID');
    entityObject.entityId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  

  return {
    entityObject,
    i18n: { ...DEFAULT_I18N, ...(params.i18n || {}) },
    enableSelection: Boolean(params.enableSelection),
    enableDragDrop: Boolean(params.enableDragDrop),
    useNewComponents: Boolean(params.useNewComponents),
    callbacks: {
      handleActionDashboard: params.handleActionDashboard,
      handleActionReport: params.handleActionReport,
      handleActionSettings: params.handleActionSettings,
      handleSelect: params.handleSelect,
      handInfo: params.handInfo,
      handleClickCard: params.handleClickCard
    }
  };
}

/**
 * Get icon SVG for device type
 */
function getIconSvg(deviceType) {
  return ICON_MAP[deviceType] || ICON_MAP.DEFAULT;
}

/**
 * Format primary value based on type
 */
function formatPrimaryValue(val, valType) {
  if (val === null || val === undefined || isNaN(val)) {
    return { num: '—', unit: '', suffix: '' };
  }

  switch (valType) {
    case 'power_kw':
      return {
        num: val.toFixed(1),
        unit: 'kWh',
        suffix: ''
      };
    case 'flow_m3h':
      return {
        num: val.toFixed(1),
        unit: 'm³/h',
        suffix: ''
      };
    case 'temp_c':
      return {
        num: val.toFixed(1),
        unit: '°C',
        suffix: ''
      };
    default:
      return {
        num: val.toFixed(1),
        unit: '',
        suffix: ''
      };
  }
}

/**
 * Format temperature value
 */
function formatTemperature(temp) {
  if (temp === null || temp === undefined || isNaN(temp)) {
    return '—';
  }
  return `${temp.toFixed(0)}°C`;
}

/**
 * Format operation hours
 */
function formatOperationHours(hours) {
  if (hours === null || hours === undefined || isNaN(hours)) {
    return '—';
  }
  return `${hours.toFixed(3)}h`;
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return '—';
  
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return 'agora';
}

/**
 * Calcula a porcentagem do consumo em relação a uma meta.
 * @param {number} target - O valor da meta (deve ser maior que zero).
 * @param {number} consumption - O valor consumido.
 * @returns {number} A porcentagem do consumo em relação à meta. Retorna 0 se a meta for inválida.
 */
function calculateConsumptionPercentage(target, consumption) {
  // Garante que os valores sejam numéricos e a meta seja positiva para evitar erros.
  const numericTarget = Number(target);
  const numericConsumption = Number(consumption);

  if (isNaN(numericTarget) || isNaN(numericConsumption) || numericTarget <= 0) {
    return 0;
  }

  const percentage = (numericConsumption / numericTarget) * 100;
  return percentage;
}

/**
 * Get status chip class and label
 */
function getStatusInfo(connectionStatus, i18n) {
  switch (connectionStatus) {
    case 'RUNNING':
    case 'ONLINE':
      return { chipClass: 'chip--ok', label: i18n.in_operation };
    case 'ALERT':
      return { chipClass: 'chip--alert', label: i18n.alert };
    case 'FAILURE':
      return { chipClass: 'chip--failure', label: i18n.failure };
    case 'OFFLINE':
    case 'PAUSED':
    default:
      return { chipClass: 'chip--offline', label: i18n.offline };
  }
}

/**
 * Get card state class for alert/failure border
 */
function getCardStateClass(connectionStatus) {
  switch (connectionStatus) {
    case 'ALERT':
      return 'is-alert';
    case 'FAILURE':
      return 'is-failure';
    default:
      return '';
  }
}

/**
 * Build DOM structure
 */
function buildDOM(state) {
  const { entityObject, i18n, enableSelection, enableDragDrop } = state;
  
  // Root container
  const root = document.createElement('div');
  root.className = 'myio-ho-card';
  root.setAttribute('role', 'group');
  root.setAttribute('data-entity-id', entityObject.entityId);
  
  if (enableDragDrop) {
    root.setAttribute('draggable', 'true');
  }

  // Header
  const header = document.createElement('div');
  header.className = 'myio-ho-card__header';

  // Icon
  const iconContainer = document.createElement('div');
  iconContainer.className = 'myio-ho-card__icon';
  iconContainer.innerHTML = getIconSvg(entityObject.deviceType);
  header.appendChild(iconContainer);

  // Title section
  const titleSection = document.createElement('div');
  titleSection.className = 'myio-ho-card__title';

  const nameEl = document.createElement('div');
  nameEl.className = 'myio-ho-card__name';
  nameEl.textContent = entityObject.labelOrName || 'Unknown Device';
  titleSection.appendChild(nameEl);

  if (entityObject.deviceIdentifier) {
    const codeEl = document.createElement('div');
    codeEl.className = 'myio-ho-card__code';
    codeEl.textContent = entityObject.deviceIdentifier;
    titleSection.appendChild(codeEl);
  }

  header.appendChild(titleSection);

  // Actions section
  const actionsSection = document.createElement('div');
  actionsSection.className = 'myio-ho-card__actions';

  // Kebab menu
  const kebabBtn = document.createElement('button');
  kebabBtn.className = 'myio-ho-card__kebab';
  kebabBtn.setAttribute('aria-label', 'Open actions');
  kebabBtn.setAttribute('aria-haspopup', 'menu');
  kebabBtn.innerHTML = Icons.kebab;
  actionsSection.appendChild(kebabBtn);

  // Menu
  const menu = document.createElement('div');
  menu.className = 'myio-ho-card__menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('hidden', '');

  const dashboardBtn = document.createElement('button');
  dashboardBtn.setAttribute('role', 'menuitem');
  dashboardBtn.setAttribute('data-action', 'dashboard');
  dashboardBtn.textContent = "Dashboard";
  menu.appendChild(dashboardBtn);

  const reportBtn = document.createElement('button');
  reportBtn.setAttribute('role', 'menuitem');
  reportBtn.setAttribute('data-action', 'report');
  reportBtn.textContent = i18n.menu_report;
  menu.appendChild(reportBtn);

  const settingsBtn = document.createElement('button');
  settingsBtn.setAttribute('role', 'menuitem');
  settingsBtn.setAttribute('data-action', 'settings');
  settingsBtn.textContent = i18n.menu_settings;
  menu.appendChild(settingsBtn);

  const infoDataBtn = document.createElement('button');
  infoDataBtn.setAttribute('role', 'menuitem');
  infoDataBtn.setAttribute('data-action', 'info');
  infoDataBtn.textContent = "Mais informações";
  menu.appendChild(infoDataBtn);

  actionsSection.appendChild(menu);

  // Selection checkbox
  if (enableSelection) {
    const selectLabel = document.createElement('label');
    selectLabel.className = 'myio-ho-card__select';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    selectLabel.appendChild(checkbox);
    
    actionsSection.appendChild(selectLabel);
  }

  header.appendChild(actionsSection);
  root.appendChild(header);

  // Status chip
  const statusSection = document.createElement('div');
  statusSection.className = 'myio-ho-card__status';
  
  const chip = document.createElement('span');
  chip.className = 'chip';
  statusSection.appendChild(chip);
  
  root.appendChild(statusSection);

  // Primary metric
  const primarySection = document.createElement('div');
  primarySection.className = 'myio-ho-card__primary';
  primarySection.setAttribute('role', 'button');
  primarySection.setAttribute('tabindex', '0');

  const valueContainer = document.createElement('div');
  valueContainer.className = 'myio-ho-card__value';

  const numSpan = document.createElement('span');
  numSpan.className = 'num';
  valueContainer.appendChild(numSpan);

  const unitSpan = document.createElement('span');
  unitSpan.className = 'unit';
  valueContainer.appendChild(unitSpan);

  const suffixSpan = document.createElement('span');
  suffixSpan.className = 'suffix';
  suffixSpan.textContent = i18n.current_suffix;
  valueContainer.appendChild(suffixSpan);

  primarySection.appendChild(valueContainer);
  root.appendChild(primarySection);

  // Efficiency bar
  const effSection = document.createElement('div');
  effSection.className = 'myio-ho-card__eff';

  const effLabel = document.createElement('div');
  effLabel.className = 'label';
  effLabel.textContent = i18n.efficiency;
  effSection.appendChild(effLabel);

  const barContainer = document.createElement('div');
  barContainer.className = 'bar';
  barContainer.setAttribute('role', 'progressbar');
  barContainer.setAttribute('aria-valuemin', '0');
  barContainer.setAttribute('aria-valuemax', '100');

  const barFill = document.createElement('div');
  barFill.className = 'bar__fill';
  barContainer.appendChild(barFill);

  effSection.appendChild(barContainer);

  const percSpan = document.createElement('div');
  percSpan.className = 'perc';
  effSection.appendChild(percSpan);

  root.appendChild(effSection);

  // Footer metrics
  const footer = document.createElement('div');
  footer.className = 'myio-ho-card__footer';

  // Temperature metric
  const tempMetric = document.createElement('div');
  tempMetric.className = 'metric';

  const tempIcon = document.createElement('i');
  tempIcon.className = 'ico ico-temp';
  tempIcon.innerHTML = Icons.thermometer;
  tempMetric.appendChild(tempIcon);

  const tempLabel = document.createElement('div');
  tempLabel.className = 'label';
  tempLabel.textContent = i18n.temperature;
  tempMetric.appendChild(tempLabel);

  const tempVal = document.createElement('div');
  tempVal.className = 'val';
  tempMetric.appendChild(tempVal);

  footer.appendChild(tempMetric);

  // Operation time metric
  const opTimeMetric = document.createElement('div');
  opTimeMetric.className = 'metric';

  const opTimeIcon = document.createElement('i');
  opTimeIcon.className = 'ico ico-clock';
  opTimeIcon.innerHTML = Icons.dot; // Using dot as clock placeholder
  opTimeMetric.appendChild(opTimeIcon);

  const opTimeLabel = document.createElement('div');
  opTimeLabel.className = 'label';
  opTimeLabel.textContent = i18n.operation_time;
  opTimeMetric.appendChild(opTimeLabel);

  const opTimeVal = document.createElement('div');
  opTimeVal.className = 'val';
  opTimeMetric.appendChild(opTimeVal);

  footer.appendChild(opTimeMetric);

  // Updated metric
  const updatedMetric = document.createElement('div');
  updatedMetric.className = 'metric';

  const updatedIcon = document.createElement('i');
  updatedIcon.className = 'ico ico-sync';
  updatedIcon.innerHTML = Icons.dot; // Using dot as sync placeholder
  updatedMetric.appendChild(updatedIcon);

  const updatedLabel = document.createElement('div');
  updatedLabel.className = 'label';
  updatedLabel.textContent = i18n.updated;
  updatedMetric.appendChild(updatedLabel);

  const updatedVal = document.createElement('div');
  updatedVal.className = 'val';
  updatedMetric.appendChild(updatedVal);

  footer.appendChild(updatedMetric);

  root.appendChild(footer);

  return root;
}

/**
 * Paint/update DOM with current state
 */
function paint(root, state) {
  const { entityObject, i18n } = state;

  // Update card state class
  const stateClass = getCardStateClass(entityObject.connectionStatus);
  root.className = `myio-ho-card ${stateClass}`;

  // Update status chip
  const statusInfo = getStatusInfo(String(entityObject.connectionStatus).toUpperCase(), i18n);
  const chip = root.querySelector('.chip');
  chip.className = `chip ${statusInfo.chipClass}`;
  chip.textContent = statusInfo.label;

  // Update primary value
  const primaryValue = formatPrimaryValue(entityObject.val, entityObject.valType);
  const numSpan = root.querySelector('.myio-ho-card__value .num');
  const unitSpan = root.querySelector('.myio-ho-card__value .unit');
  
  numSpan.textContent = primaryValue.num;
  unitSpan.textContent = primaryValue.unit;

  // Seleciona o contêiner principal da barra ANTES de qualquer lógica
  const barContainer = root.querySelector('.bar');
  const effContainer = root.querySelector('.myio-ho-card__eff'); // Contêiner do texto "%"

  // 1. Verifica se o valor da meta é válido (não é nulo, indefinido ou zero)
  const targetValue = entityObject.consumptionTargetValue;

  if (targetValue) {
    // --- A META EXISTE: MOSTRA E ATUALIZA A BARRA ---

    // Garante que os elementos estejam visíveis
    barContainer.style.display = ''; // Reverte para o display padrão do CSS
    effContainer.style.display = '';

    // Pega os elementos internos da barra
    const barFill = root.querySelector('.bar__fill');
    const percSpan = root.querySelector('.myio-ho-card__eff .perc');
    
    // Calcula e atualiza a barra
    const perc = calculateConsumptionPercentage(targetValue, entityObject.val);
    
    barFill.style.width = `${Math.max(0, Math.min(100, perc))}%`;
    percSpan.textContent = `${Math.round(perc)}%`;
    barContainer.setAttribute('aria-valuenow', Math.round(perc).toString());
    barContainer.setAttribute('aria-label', `${i18n.efficiency} ${Math.round(perc)}%`);

  } else {
    barContainer.style.display = 'none';
    effContainer.style.display = 'none';
  }

  // Update footer metrics
  const tempVal = root.querySelector('.myio-ho-card__footer .metric:nth-child(1) .val');
  tempVal.textContent = formatTemperature(entityObject.temperatureC);

  const opTimeVal = root.querySelector('.myio-ho-card__footer .metric:nth-child(2) .val');
  opTimeVal.textContent = entityObject.operationHours;

  const updatedVal = root.querySelector('.myio-ho-card__footer .metric:nth-child(3) .val');
  updatedVal.textContent = formatRelativeTime(entityObject.timaVal);
}

/**
 * Bind event listeners
 */
function bindEvents(root, state, callbacks) {
  const { entityObject } = state;

  // Kebab menu toggle
  const kebabBtn = root.querySelector('.myio-ho-card__kebab');
  const menu = root.querySelector('.myio-ho-card__menu');

  function toggleMenu() {
    const isHidden = menu.hasAttribute('hidden');
    if (isHidden) {
      menu.removeAttribute('hidden');
      kebabBtn.setAttribute('aria-expanded', 'true');
    } else {
      menu.setAttribute('hidden', '');
      kebabBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function closeMenu() {
    menu.setAttribute('hidden', '');
    kebabBtn.setAttribute('aria-expanded', 'false');
  }

  kebabBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Close menu on outside click
  document.addEventListener('click', closeMenu);

  // Close menu on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
    }
  });

  // Menu actions
  const dashboardBtn = menu.querySelector('[data-action="dashboard"]');
  const reportBtn = menu.querySelector('[data-action="report"]');
  const settingsBtn = menu.querySelector('[data-action="settings"]');
  const infoBtn = menu.querySelector('[data-action="info"]');

  if (callbacks.handleActionDashboard) {
    dashboardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      callbacks.handleActionDashboard(e, entityObject);
    });
  }

  if (callbacks.handleActionReport) {
    reportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      callbacks.handleActionReport(e, entityObject);
    });
  }

  if (callbacks.handleActionSettings) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      callbacks.handleActionSettings(e, entityObject);
    });
  }
  
  infoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeMenu();

    const title = state.entityObject.labelOrName || 'Dispositivo sem nome';
    let modalBodyContent = '<div class="info-section">'; // Inicia a primeira seção

    // Informações básicas
    modalBodyContent += `
      <div class="info-row">
        <span class="info-icon">${ModalIcons.central}</span>
        <span class="info-label">Central:</span>
        <span class="info-value">${entityObject.deviceIdentifier || 'N/A'}</span>
      </div>
      <div class="info-row">
        <span class="info-icon">${ModalIcons.connection}</span>
        <span class="info-label">Última Conexão:</span>
        <span class="info-value">${entityObject.operationHours || 'N/A'}</span>
      </div>
    `;

    modalBodyContent += '</div>'; // Fecha a primeira seção

    // Tenta obter os dados de meta (que são opcionais)
    const consumptionTargetValue = state.entityObject.consumptionTargetValue ? formatPrimaryValue(state.entityObject.consumptionTargetValue, 'power_kw') : null;
    const consumptionToleranceValue = state.entityObject.consumptionToleranceValue ? formatPrimaryValue(state.entityObject.consumptionToleranceValue, 'power_kw') : null;
    const consumptionExcessValue = state.entityObject.consumptionExcessValue != null ? formatPrimaryValue(state.entityObject.consumptionExcessValue, 'power_kw') : null;

    // Se TODOS os dados de meta existirem, adiciona o bloco de HTML correspondente
    if (consumptionTargetValue && consumptionToleranceValue && consumptionExcessValue) {
        modalBodyContent += '<hr class="info-divider">';
        modalBodyContent += '<div class="info-section">'; // Inicia a segunda seção

        modalBodyContent += `
          <div class="info-row">
            <span class="info-icon">${ModalIcons.target}</span>
            <span class="info-label">Meta:</span>
            <span class="info-value">${consumptionTargetValue.num} ${consumptionTargetValue.unit}</span>
          </div>
          <div class="info-row">
            <span class="info-icon">${ModalIcons.tolerance}</span>
            <span class="info-label">Tolerância:</span>
            <span class="info-value">${consumptionToleranceValue.num} ${consumptionToleranceValue.unit}</span>
          </div>
          <div class="info-row">
            <span class="info-icon">${ModalIcons.excess}</span>
            <span class="info-label">Excedente PG/NPG:</span>
            <span class="info-value">${consumptionExcessValue.num} ${consumptionExcessValue.unit}</span>
          </div>
        `;

        modalBodyContent += '</div>'; // Fecha a segunda seção
    }

    // Chama a função para mostrar o modal
    showInfoModal(title, modalBodyContent);
  });
  // Selection checkbox
  const checkbox = root.querySelector('.myio-ho-card__select input[type="checkbox"]');
  if (checkbox && callbacks.handleSelect) {
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const isSelected = checkbox.checked;
      
      // Toggle selected visual state
      root.classList.toggle('is-selected', isSelected);
      
      callbacks.handleSelect(isSelected, entityObject);
    });
  }

  // Card click
  const primarySection = root.querySelector('.myio-ho-card__primary');
  if (callbacks.handleClickCard) {
    function handleCardClick(e) {
      // Don't trigger if clicking on actions or checkbox
      if (e.target.closest('.myio-ho-card__actions')) return;
      callbacks.handleClickCard(e, entityObject);
    }

    root.addEventListener('click', handleCardClick);
    
    // Keyboard support
    primarySection.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callbacks.handleClickCard(e, entityObject);
      }
    });
  }

  // Drag and drop
  if (state.enableDragDrop) {
    root.addEventListener('dragstart', (e) => {
      root.classList.add('is-dragging');
      e.dataTransfer.setData('text/plain', entityObject.entityId);
      
      // Custom event
      const customEvent = new CustomEvent('myio:dragstart', {
        detail: { entityObject },
        bubbles: true
      });
      root.dispatchEvent(customEvent);
    });

    root.addEventListener('dragend', () => {
      root.classList.remove('is-dragging');
    });

    root.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      
      // Custom event
      const customEvent = new CustomEvent('myio:drop', {
        detail: { draggedId, targetEntity: entityObject },
        bubbles: true
      });
      root.dispatchEvent(customEvent);
    });

    root.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
  }

  // Store cleanup functions
  root._cleanup = () => {
    document.removeEventListener('click', closeMenu);
    document.removeEventListener('keydown', closeMenu);
  };
}

/**
 * Unbind event listeners
 */
function unbindEvents(root) {
  if (root._cleanup) {
    root._cleanup();
    delete root._cleanup;
  }
}

/**
 * Cria a estrutura do modal e a anexa ao body (se ainda não existir).
 * Também configura os eventos para fechar o modal.
 */
function createInfoModal() {
  // Evita criar o modal múltiplas vezes
  if (document.getElementById('myio-info-modal')) {
    return;
  }

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'myio-modal-overlay';
  modalOverlay.id = 'myio-info-modal';

  const modalContent = document.createElement('div');
  modalContent.className = 'myio-modal-content';

  const closeButton = document.createElement('button');
  closeButton.className = 'myio-modal-close';
  closeButton.innerHTML = '&times;';
  closeButton.setAttribute('aria-label', 'Fechar modal');
  
  // +++ ADICIONADO O TÍTULO +++
  const modalTitle = document.createElement('h3');
  modalTitle.className = 'myio-modal-title';
  modalTitle.id = 'myio-info-modal-title';

  const modalBody = document.createElement('div');
  modalBody.id = 'myio-info-modal-body';

  modalContent.appendChild(closeButton);
  modalContent.appendChild(modalTitle); // +++ ADICIONADO
  modalContent.appendChild(modalBody);
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  // Função para fechar o modal
  const closeModal = () => {
    modalOverlay.classList.remove('visible');
  };

  // Eventos para fechar
  closeButton.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
}

/**
 * Exibe o modal com as informações fornecidas.
 * @param {object} data - Objeto com os dados a serem exibidos. Ex: { title: 'Nome do Device', meta: '120kWh', ... }
 */
function showInfoModal(title, bodyHtml) {
    createInfoModal();

    const modalOverlay = document.getElementById('myio-info-modal');
    const modalTitle = document.getElementById('myio-info-modal-title');
    const modalBody = document.getElementById('myio-info-modal-body');

    modalTitle.textContent = title || 'Informações';
    modalBody.innerHTML = bodyHtml; // Define o HTML diretamente

    modalOverlay.classList.add('visible');
}
/**
 * Main render function
 */
export function renderCardCompenteHeadOffice(containerEl, params) {
  if (!containerEl) {
    throw new Error('renderCardCompenteHeadOffice: containerEl is required');
  }

  ensureCss();
  const state = normalizeParams(params);
  const root = buildDOM(state);
  
  containerEl.appendChild(root);
  bindEvents(root, state, state.callbacks);
  paint(root, state);

  return {
    update(next) {
      if (next) {
        Object.assign(state.entityObject, next);
        paint(root, state);
      }
    },
    
    destroy() {
      unbindEvents(root);
      if (root.parentNode) {
        root.parentNode.removeChild(root);
      }
    },
    
    getRoot() {
      return root;
    }
  };
}
