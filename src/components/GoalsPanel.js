/**
 * MYIO Goals Panel Component (RFC-0075)
 * Consumption Goals Setup Panel with annual and monthly goal management
 *
 * @version 1.0.0
 * @author MYIO Frontend Guild
 */

/* eslint-disable */

/**
 * Opens the Goals Setup Panel modal
 *
 * @param {Object} params - Configuration parameters
 * @param {string} params.customerId - ThingsBoard Customer ID (Holding)
 * @param {string} params.token - JWT token for ThingsBoard API
 * @param {Object} params.api - API configuration
 * @param {string} params.api.baseUrl - ThingsBoard API base URL
 * @param {Object} [params.data] - Initial goals data (for testing with mock data)
 * @param {Function} [params.onSave] - Callback when goals are saved
 * @param {Function} [params.onClose] - Callback when modal is closed
 * @param {Object} [params.styles] - Custom styling overrides
 * @param {string} [params.locale='pt-BR'] - Locale for i18n
 * @returns {Object} Modal instance with control methods
 */
export function openGoalsPanel(params) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('GoalsPanel requires browser environment');
  }

  const {
    customerId,
    token,
    api = {},
    data = null,
    shoppingList = [], // List of shopping centers
    onSave = null,
    onClose = null,
    styles = {},
    locale = 'pt-BR'
  } = params;

  if (!customerId) {
    throw new Error('customerId is required');
  }

  if (!token && !data) {
    throw new Error('token is required when not using mock data');
  }

  // Merge custom styles with defaults
  const theme = {
    primaryColor: styles.primaryColor || '#4A148C',
    accentColor: styles.accentColor || '#FFC107',
    successColor: styles.successColor || '#28a745',
    errorColor: styles.errorColor || '#dc3545',
    warningColor: styles.warningColor || '#fd7e14',
    borderRadius: styles.borderRadius || '8px',
    fontFamily: styles.fontFamily || "'Roboto', Arial, sans-serif",
    zIndex: styles.zIndex || 10000
  };

  // i18n strings
  const i18n = locale === 'en-US' ? getEnglishStrings() : getPortugueseStrings();

  // Modal state
  let modalState = {
    currentTab: 'shopping', // 'shopping' | 'assets'
    currentYear: new Date().getFullYear(),
    selectedShoppingId: shoppingList.length > 0 ? shoppingList[0].value : null,
    goalsData: data || null,
    isDirty: false,
    isSaving: false,
    validationErrors: []
  };

  // Create modal instance
  const instance = {
    close: () => closeModal(),
    getState: () => ({ ...modalState }),
    setYear: (year) => setCurrentYear(year),
    refresh: () => loadGoalsData()
  };

  // Initialize modal
  initializeModal();

  return instance;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function initializeModal() {
    // If mock data provided, use it directly
    if (data) {
      modalState.goalsData = data;
      renderModal();
    } else {
      // Load data from ThingsBoard
      renderModal();
      loadGoalsData();
    }
  }

  // ============================================================================
  // MODAL RENDERING
  // ============================================================================

  function renderModal() {
    // Remove existing modal if any
    const existing = document.getElementById('myio-goals-panel-modal');
    if (existing) {
      existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'myio-goals-panel-modal';
    modal.className = 'myio-goals-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'goals-modal-title');

    modal.innerHTML = generateModalHTML();

    document.body.appendChild(modal);
    injectStyles();
    attachEventListeners();
    trapFocus(modal);

    // Render current tab content
    renderTabContent();
  }

  function generateModalHTML() {
    return `
      <div class="myio-goals-modal-backdrop" aria-hidden="true"></div>
      <div class="myio-goals-modal-container">
        <div class="myio-goals-modal-card">
          <!-- Header -->
          <div class="myio-goals-modal-header">
            <div class="myio-goals-header-content">
              <div class="myio-goals-header-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                        fill="currentColor" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </div>
              <h2 id="goals-modal-title" class="myio-goals-modal-title">${i18n.modalTitle}</h2>
            </div>
            <button class="myio-goals-close-btn" aria-label="${i18n.close}" data-action="close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Year Selector -->
          <div class="myio-goals-year-selector">
            <button class="myio-goals-year-btn" data-action="prev-year" aria-label="${i18n.previousYear}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <div class="myio-goals-year-display">${modalState.currentYear}</div>
            <button class="myio-goals-year-btn" data-action="next-year" aria-label="${i18n.nextYear}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="myio-goals-tabs" role="tablist">
            <button class="myio-goals-tab ${modalState.currentTab === 'shopping' ? 'active' : ''}"
                    role="tab"
                    aria-selected="${modalState.currentTab === 'shopping'}"
                    aria-controls="shopping-panel"
                    data-tab="shopping">
              ${i18n.shoppingTab}
            </button>
            <button class="myio-goals-tab ${modalState.currentTab === 'assets' ? 'active' : ''}"
                    role="tab"
                    aria-selected="${modalState.currentTab === 'assets'}"
                    aria-controls="assets-panel"
                    data-tab="assets">
              ${i18n.assetsTab}
            </button>
          </div>

          <!-- Tab Content -->
          <div class="myio-goals-content">
            <div id="tab-content-area"></div>
          </div>

          <!-- Validation Errors -->
          <div id="validation-errors" class="myio-goals-errors" style="display: none;"></div>

          <!-- Footer -->
          <div class="myio-goals-modal-footer">
            <div class="myio-goals-meta-info">
              <small id="last-update-info"></small>
            </div>
            <div class="myio-goals-footer-actions">
              <button class="myio-goals-btn myio-goals-btn-secondary" data-action="cancel">
                ${i18n.cancel}
              </button>
              <button class="myio-goals-btn myio-goals-btn-primary" data-action="save" ${modalState.isSaving ? 'disabled' : ''}>
                ${modalState.isSaving ? i18n.saving : i18n.save}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderTabContent() {
    const container = document.getElementById('tab-content-area');
    if (!container) return;

    if (modalState.currentTab === 'shopping') {
      container.innerHTML = generateShoppingTabHTML();
      attachShoppingTabListeners();
    } else {
      container.innerHTML = generateAssetsTabHTML();
      attachAssetsTabListeners();
    }

    updateLastUpdateInfo();
  }

  function generateShoppingTabHTML() {
    const yearData = getYearData(modalState.currentYear);
    const annual = yearData?.annual || { total: 0, unit: 'kWh' };
    const monthly = yearData?.monthly || {};

    // Calculate monthly sum
    const monthlySum = Object.values(monthly).reduce((sum, val) => sum + parseFloat(val || 0), 0);
    const progress = annual.total > 0 ? (monthlySum / annual.total) * 100 : 0;

    return `
      <div class="myio-goals-shopping-panel" role="tabpanel" id="shopping-panel">
        <!-- Shopping Selector -->
        ${shoppingList.length > 0 ? `
        <div class="myio-goals-section">
          <div class="myio-goals-shopping-selector">
            <label for="shopping-select" class="myio-goals-shopping-label">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <path d="M9 22V12h6v10"/>
              </svg>
              ${i18n.selectShopping}
            </label>
            <select id="shopping-select" class="myio-goals-input myio-goals-shopping-select">
              ${shoppingList.map(shopping => `
                <option value="${shopping.value}" ${modalState.selectedShoppingId === shopping.value ? 'selected' : ''}>
                  ${shopping.name}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
        ` : ''}

        <!-- Annual Goal Section -->
        <div class="myio-goals-section">
          <h3 class="myio-goals-section-title">${i18n.annualGoal}</h3>
          <div class="myio-goals-form-row">
            <div class="myio-goals-form-group">
              <label for="unit-select">${i18n.unit}</label>
              <select id="unit-select" class="myio-goals-input">
                <option value="kWh" ${annual.unit === 'kWh' ? 'selected' : ''}>kWh</option>
                <option value="m3" ${annual.unit === 'm3' ? 'selected' : ''}>m³</option>
              </select>
            </div>
            <div class="myio-goals-form-group myio-goals-form-group-large">
              <label for="annual-total">${i18n.annualTotal}</label>
              <input type="number"
                     id="annual-total"
                     class="myio-goals-input"
                     value="${annual.total}"
                     min="0"
                     step="0.01"
                     placeholder="0.00">
            </div>
          </div>
        </div>

        <!-- Monthly Distribution Section -->
        <div class="myio-goals-section">
          <div class="myio-goals-section-header">
            <h3 class="myio-goals-section-title">${i18n.monthlyDistribution}</h3>
            <button class="myio-goals-btn-link" data-action="auto-fill">
              ${i18n.autoFill}
            </button>
          </div>

          <!-- Progress Bar -->
          <div class="myio-goals-progress-bar">
            <div class="myio-goals-progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
          </div>
          <div class="myio-goals-progress-text">
            <span>${formatNumber(monthlySum, locale)} ${annual.unit}</span>
            <span>${formatNumber(annual.total, locale)} ${annual.unit}</span>
          </div>

          <!-- Monthly Grid -->
          <div class="myio-goals-monthly-grid">
            ${generateMonthlyInputsHTML(monthly, annual.unit)}
          </div>
        </div>
      </div>
    `;
  }

  function generateMonthlyInputsHTML(monthly, unit) {
    const months = [
      { key: '01', label: i18n.jan },
      { key: '02', label: i18n.feb },
      { key: '03', label: i18n.mar },
      { key: '04', label: i18n.apr },
      { key: '05', label: i18n.may },
      { key: '06', label: i18n.jun },
      { key: '07', label: i18n.jul },
      { key: '08', label: i18n.aug },
      { key: '09', label: i18n.sep },
      { key: '10', label: i18n.oct },
      { key: '11', label: i18n.nov },
      { key: '12', label: i18n.dec }
    ];

    return months.map(month => `
      <div class="myio-goals-month-input">
        <label for="month-${month.key}">${month.label}</label>
        <input type="number"
               id="month-${month.key}"
               class="myio-goals-input myio-goals-input-small"
               data-month="${month.key}"
               value="${monthly[month.key] || ''}"
               min="0"
               step="0.01"
               placeholder="0">
        <span class="myio-goals-unit">${unit}</span>
      </div>
    `).join('');
  }

  function generateAssetsTabHTML() {
    const yearData = getYearData(modalState.currentYear);
    const assets = yearData?.assets || {};

    return `
      <div class="myio-goals-assets-panel" role="tabpanel" id="assets-panel">
        <div class="myio-goals-assets-header">
          <input type="text"
                 id="asset-search"
                 class="myio-goals-input"
                 placeholder="${i18n.searchAssets}"
                 aria-label="${i18n.searchAssets}">
          <button class="myio-goals-btn myio-goals-btn-primary" data-action="add-asset">
            + ${i18n.addAsset}
          </button>
        </div>

        <div class="myio-goals-assets-list">
          ${Object.keys(assets).length > 0
            ? generateAssetItemsHTML(assets)
            : `<div class="myio-goals-empty-state">${i18n.noAssets}</div>`
          }
        </div>
      </div>
    `;
  }

  function generateAssetItemsHTML(assets) {
    return Object.entries(assets).map(([assetId, assetData]) => `
      <div class="myio-goals-asset-item" data-asset-id="${assetId}">
        <div class="myio-goals-asset-header" data-action="toggle-asset">
          <div class="myio-goals-asset-title">
            <svg class="myio-goals-asset-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
            <span>${assetData.label || assetId}</span>
          </div>
          <div class="myio-goals-asset-total">
            ${formatNumber(assetData.annual?.total || 0, locale)} ${assetData.annual?.unit || 'kWh'}
          </div>
          <button class="myio-goals-btn-icon" data-action="delete-asset" data-asset-id="${assetId}" aria-label="${i18n.deleteAsset}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
        <div class="myio-goals-asset-content" style="display: none;">
          ${generateAssetDetailHTML(assetId, assetData)}
        </div>
      </div>
    `).join('');
  }

  function generateAssetDetailHTML(assetId, assetData) {
    const annual = assetData.annual || { total: 0, unit: 'kWh' };
    const monthly = assetData.monthly || {};

    return `
      <div class="myio-goals-asset-detail">
        <div class="myio-goals-form-row">
          <div class="myio-goals-form-group">
            <label for="asset-${assetId}-unit">${i18n.unit}</label>
            <select id="asset-${assetId}-unit" class="myio-goals-input" data-asset-id="${assetId}">
              <option value="kWh" ${annual.unit === 'kWh' ? 'selected' : ''}>kWh</option>
              <option value="m3" ${annual.unit === 'm3' ? 'selected' : ''}>m³</option>
            </select>
          </div>
          <div class="myio-goals-form-group myio-goals-form-group-large">
            <label for="asset-${assetId}-total">${i18n.annualTotal}</label>
            <input type="number"
                   id="asset-${assetId}-total"
                   class="myio-goals-input"
                   data-asset-id="${assetId}"
                   value="${annual.total}"
                   min="0"
                   step="0.01">
          </div>
        </div>

        <div class="myio-goals-monthly-grid">
          ${generateAssetMonthlyInputsHTML(assetId, monthly, annual.unit)}
        </div>
      </div>
    `;
  }

  function generateAssetMonthlyInputsHTML(assetId, monthly, unit) {
    const months = [
      { key: '01', label: i18n.jan },
      { key: '02', label: i18n.feb },
      { key: '03', label: i18n.mar },
      { key: '04', label: i18n.apr },
      { key: '05', label: i18n.may },
      { key: '06', label: i18n.jun },
      { key: '07', label: i18n.jul },
      { key: '08', label: i18n.aug },
      { key: '09', label: i18n.sep },
      { key: '10', label: i18n.oct },
      { key: '11', label: i18n.nov },
      { key: '12', label: i18n.dec }
    ];

    return months.map(month => `
      <div class="myio-goals-month-input">
        <label for="asset-${assetId}-month-${month.key}">${month.label}</label>
        <input type="number"
               id="asset-${assetId}-month-${month.key}"
               class="myio-goals-input myio-goals-input-small"
               data-asset-id="${assetId}"
               data-month="${month.key}"
               value="${monthly[month.key] || ''}"
               min="0"
               step="0.01"
               placeholder="0">
        <span class="myio-goals-unit">${unit}</span>
      </div>
    `).join('');
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  function attachEventListeners() {
    const modal = document.getElementById('myio-goals-panel-modal');
    if (!modal) return;

    // Close button
    modal.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;

      if (action === 'close' || action === 'cancel') {
        if (modalState.isDirty) {
          if (confirm(i18n.unsavedChanges)) {
            closeModal();
          }
        } else {
          closeModal();
        }
      } else if (action === 'save') {
        handleSave();
      } else if (action === 'prev-year') {
        setCurrentYear(modalState.currentYear - 1);
      } else if (action === 'next-year') {
        setCurrentYear(modalState.currentYear + 1);
      }
    });

    // Tab switching
    modal.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) {
        switchTab(tab.dataset.tab);
      }
    });

    // Close on backdrop click
    modal.querySelector('.myio-goals-modal-backdrop')?.addEventListener('click', () => {
      if (modalState.isDirty) {
        if (confirm(i18n.unsavedChanges)) {
          closeModal();
        }
      } else {
        closeModal();
      }
    });

    // ESC key to close
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (modalState.isDirty) {
          if (confirm(i18n.unsavedChanges)) {
            closeModal();
          }
        } else {
          closeModal();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    modal._escapeHandler = handleEscape;
  }

  function attachShoppingTabListeners() {
    const container = document.getElementById('tab-content-area');
    if (!container) return;

    // Shopping selector
    container.querySelector('#shopping-select')?.addEventListener('change', (e) => {
      modalState.selectedShoppingId = e.target.value;
      modalState.isDirty = true;

      // Reload goals data for selected shopping
      loadGoalsDataForShopping(e.target.value);
    });

    // Annual total input
    container.querySelector('#annual-total')?.addEventListener('input', (e) => {
      modalState.isDirty = true;
      updateProgressBar();
    });

    // Unit select
    container.querySelector('#unit-select')?.addEventListener('change', (e) => {
      modalState.isDirty = true;
      updateMonthlyUnits(e.target.value);
    });

    // Monthly inputs
    container.querySelectorAll('[data-month]').forEach(input => {
      input.addEventListener('input', () => {
        modalState.isDirty = true;
        updateProgressBar();
      });
    });

    // Auto-fill button
    container.querySelector('[data-action="auto-fill"]')?.addEventListener('click', () => {
      autoFillMonthly();
    });
  }

  function attachAssetsTabListeners() {
    const container = document.getElementById('tab-content-area');
    if (!container) return;

    // Toggle asset expansion
    container.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-action="toggle-asset"]');
      if (toggleBtn) {
        const assetItem = toggleBtn.closest('.myio-goals-asset-item');
        const content = assetItem?.querySelector('.myio-goals-asset-content');
        const icon = assetItem?.querySelector('.myio-goals-asset-icon');

        if (content) {
          const isHidden = content.style.display === 'none';
          content.style.display = isHidden ? 'block' : 'none';
          if (icon) {
            icon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
          }
        }
      }

      // Delete asset
      const deleteBtn = e.target.closest('[data-action="delete-asset"]');
      if (deleteBtn) {
        const assetId = deleteBtn.dataset.assetId;
        if (confirm(i18n.confirmDeleteAsset)) {
          deleteAsset(assetId);
        }
      }

      // Add asset
      const addBtn = e.target.closest('[data-action="add-asset"]');
      if (addBtn) {
        showAddAssetDialog();
      }
    });

    // Asset inputs
    container.addEventListener('input', (e) => {
      if (e.target.dataset.assetId) {
        modalState.isDirty = true;
      }
    });
  }

  // ============================================================================
  // DATA MANAGEMENT
  // ============================================================================

  function getYearData(year) {
    if (!modalState.goalsData?.years) return null;
    return modalState.goalsData.years[year.toString()];
  }

  function setYearData(year, data) {
    if (!modalState.goalsData) {
      modalState.goalsData = { version: 1, history: [], years: {} };
    }
    if (!modalState.goalsData.years) {
      modalState.goalsData.years = {};
    }
    modalState.goalsData.years[year.toString()] = data;
  }

  function loadGoalsData() {
    // In production, this would fetch from ThingsBoard API
    // For now, initialize empty structure if no data
    if (!modalState.goalsData) {
      modalState.goalsData = {
        version: 1,
        history: [],
        years: {}
      };

      // Initialize current year with empty data
      setYearData(modalState.currentYear, {
        annual: { total: 0, unit: 'kWh' },
        monthly: {},
        assets: {},
        metaTag: `${new Date().toISOString()}|user`
      });
    }

    renderTabContent();
  }

  function loadGoalsDataForShopping(shoppingId) {
    // In production, this would fetch goals for specific shopping from ThingsBoard
    console.log('[GoalsPanel] Loading goals for shopping:', shoppingId);

    // For now, just re-render with current data
    // In production, fetch data from API and update modalState.goalsData
    renderTabContent();
  }

  async function handleSave() {
    // Validate data
    const errors = validateGoalsData();
    if (errors.length > 0) {
      displayValidationErrors(errors);
      return;
    }

    modalState.isSaving = true;
    updateSaveButton();

    try {
      // Collect current data from inputs
      const goalsData = collectGoalsDataFromInputs();

      // Update version and history
      if (!modalState.goalsData.version) {
        modalState.goalsData.version = 1;
      } else {
        modalState.goalsData.version++;
      }

      // Add history entry
      if (!modalState.goalsData.history) {
        modalState.goalsData.history = [];
      }
      modalState.goalsData.history.unshift({
        tag: `${new Date().toISOString()}|user`,
        reason: 'Manual update from Goals Panel',
        diff: { year: modalState.currentYear, changed: ['manual_update'] }
      });

      // In production, save to ThingsBoard API
      // await saveToThingsBoard(customerId, modalState.goalsData);

      // For mock mode, just update local state
      setYearData(modalState.currentYear, goalsData);

      // Call onSave callback if provided
      if (onSave) {
        await onSave(modalState.goalsData);
      }

      modalState.isDirty = false;
      showSuccessMessage(i18n.saveSuccess);

      // Close modal after brief delay
      setTimeout(() => {
        closeModal();
      }, 1500);

    } catch (error) {
      console.error('Error saving goals:', error);
      displayValidationErrors([i18n.saveError + ': ' + error.message]);
    } finally {
      modalState.isSaving = false;
      updateSaveButton();
    }
  }

  function collectGoalsDataFromInputs() {
    if (modalState.currentTab === 'shopping') {
      return collectShoppingData();
    } else {
      return collectAssetsData();
    }
  }

  function collectShoppingData() {
    const unitSelect = document.getElementById('unit-select');
    const annualTotal = document.getElementById('annual-total');

    const unit = unitSelect?.value || 'kWh';
    const total = parseFloat(annualTotal?.value || 0);

    const monthly = {};
    for (let i = 1; i <= 12; i++) {
      const monthKey = i.toString().padStart(2, '0');
      const input = document.getElementById(`month-${monthKey}`);
      if (input && input.value) {
        monthly[monthKey] = parseFloat(input.value);
      }
    }

    const yearData = getYearData(modalState.currentYear) || { assets: {} };

    return {
      annual: { total, unit },
      monthly,
      assets: yearData.assets || {},
      metaTag: `${new Date().toISOString()}|user`
    };
  }

  function collectAssetsData() {
    const yearData = getYearData(modalState.currentYear);
    return yearData || {
      annual: { total: 0, unit: 'kWh' },
      monthly: {},
      assets: {},
      metaTag: `${new Date().toISOString()}|user`
    };
  }

  function validateGoalsData() {
    const errors = [];

    if (modalState.currentTab === 'shopping') {
      const annualTotal = parseFloat(document.getElementById('annual-total')?.value || 0);

      if (annualTotal < 0) {
        errors.push(i18n.errorNegativeAnnual);
      }

      // Check monthly sum
      let monthlySum = 0;
      for (let i = 1; i <= 12; i++) {
        const monthKey = i.toString().padStart(2, '0');
        const input = document.getElementById(`month-${monthKey}`);
        const value = parseFloat(input?.value || 0);

        if (value < 0) {
          errors.push(`${i18n.errorNegativeMonth} ${monthKey}`);
        }

        monthlySum += value;
      }

      if (monthlySum > annualTotal && annualTotal > 0) {
        errors.push(`${i18n.errorMonthlyExceedsAnnual} (${formatNumber(monthlySum, locale)} > ${formatNumber(annualTotal, locale)})`);
      }
    }

    return errors;
  }

  function displayValidationErrors(errors) {
    const container = document.getElementById('validation-errors');
    if (!container) return;

    if (errors.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.innerHTML = `
      <div class="myio-goals-error-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        ${i18n.validationErrors}
      </div>
      <ul class="myio-goals-error-list">
        ${errors.map(err => `<li>${err}</li>`).join('')}
      </ul>
    `;
    container.style.display = 'block';

    // Scroll to errors
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showSuccessMessage(message) {
    const container = document.getElementById('validation-errors');
    if (!container) return;

    container.innerHTML = `
      <div class="myio-goals-success-message">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        ${message}
      </div>
    `;
    container.style.display = 'block';
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  function switchTab(tab) {
    if (modalState.currentTab === tab) return;

    modalState.currentTab = tab;

    // Update tab buttons
    const modal = document.getElementById('myio-goals-panel-modal');
    modal.querySelectorAll('.myio-goals-tab').forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive.toString());
    });

    renderTabContent();
  }

  function setCurrentYear(year) {
    modalState.currentYear = year;

    // Update year display
    const yearDisplay = document.querySelector('.myio-goals-year-display');
    if (yearDisplay) {
      yearDisplay.textContent = year;
    }

    // Ensure year data exists
    if (!getYearData(year)) {
      setYearData(year, {
        annual: { total: 0, unit: 'kWh' },
        monthly: {},
        assets: {},
        metaTag: `${new Date().toISOString()}|user`
      });
    }

    renderTabContent();
  }

  function updateProgressBar() {
    const annualTotal = parseFloat(document.getElementById('annual-total')?.value || 0);
    let monthlySum = 0;

    for (let i = 1; i <= 12; i++) {
      const monthKey = i.toString().padStart(2, '0');
      const input = document.getElementById(`month-${monthKey}`);
      monthlySum += parseFloat(input?.value || 0);
    }

    const progress = annualTotal > 0 ? (monthlySum / annualTotal) * 100 : 0;
    const progressFill = document.querySelector('.myio-goals-progress-fill');
    const progressTexts = document.querySelectorAll('.myio-goals-progress-text span');

    if (progressFill) {
      progressFill.style.width = Math.min(progress, 100) + '%';

      // Color based on progress
      if (progress > 100) {
        progressFill.style.background = theme.errorColor;
      } else if (progress > 95) {
        progressFill.style.background = theme.warningColor;
      } else {
        progressFill.style.background = theme.successColor;
      }
    }

    if (progressTexts.length === 2) {
      const unit = document.getElementById('unit-select')?.value || 'kWh';
      progressTexts[0].textContent = `${formatNumber(monthlySum, locale)} ${unit}`;
      progressTexts[1].textContent = `${formatNumber(annualTotal, locale)} ${unit}`;
    }
  }

  function updateMonthlyUnits(unit) {
    document.querySelectorAll('.myio-goals-unit').forEach(span => {
      span.textContent = unit;
    });
  }

  function autoFillMonthly() {
    const annualTotal = parseFloat(document.getElementById('annual-total')?.value || 0);
    if (annualTotal <= 0) return;

    const monthlyValue = Math.round((annualTotal / 12) * 100) / 100;

    for (let i = 1; i <= 12; i++) {
      const monthKey = i.toString().padStart(2, '0');
      const input = document.getElementById(`month-${monthKey}`);
      if (input) {
        input.value = monthlyValue;
      }
    }

    modalState.isDirty = true;
    updateProgressBar();
  }

  function deleteAsset(assetId) {
    const yearData = getYearData(modalState.currentYear);
    if (yearData?.assets?.[assetId]) {
      delete yearData.assets[assetId];
      modalState.isDirty = true;
      renderTabContent();
    }
  }

  function showAddAssetDialog() {
    const assetLabel = prompt(i18n.enterAssetName);
    if (!assetLabel) return;

    const yearData = getYearData(modalState.currentYear);
    if (!yearData.assets) yearData.assets = {};

    const assetId = `asset-${Date.now()}`;
    yearData.assets[assetId] = {
      label: assetLabel,
      annual: { total: 0, unit: 'kWh' },
      monthly: {}
    };

    modalState.isDirty = true;
    renderTabContent();
  }

  function updateLastUpdateInfo() {
    const infoElement = document.getElementById('last-update-info');
    if (!infoElement) return;

    const yearData = getYearData(modalState.currentYear);
    if (yearData?.metaTag) {
      const [timestamp, author] = yearData.metaTag.split('|');
      const date = new Date(timestamp);
      infoElement.textContent = `${i18n.lastUpdate}: ${date.toLocaleString(locale)} - ${author}`;
    } else {
      infoElement.textContent = '';
    }
  }

  function updateSaveButton() {
    const saveBtn = document.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.disabled = modalState.isSaving;
      saveBtn.textContent = modalState.isSaving ? i18n.saving : i18n.save;
    }
  }

  function closeModal() {
    const modal = document.getElementById('myio-goals-panel-modal');
    if (!modal) return;

    // Remove escape handler
    if (modal._escapeHandler) {
      document.removeEventListener('keydown', modal._escapeHandler);
    }

    modal.remove();

    if (onClose) {
      onClose();
    }
  }

  function trapFocus(modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTab);
    firstElement.focus();
  }

  function formatNumber(value, locale) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  // ============================================================================
  // STYLES
  // ============================================================================

  function injectStyles() {
    const styleId = 'myio-goals-panel-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .myio-goals-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: ${theme.zIndex};
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: ${theme.fontFamily};
      }

      .myio-goals-modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }

      .myio-goals-modal-container {
        position: relative;
        width: 90%;
        max-width: 1000px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
      }

      .myio-goals-modal-card {
        background: white;
        border-radius: ${theme.borderRadius};
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        max-height: 90vh;
        overflow: hidden;
      }

      .myio-goals-modal-header {
        background: ${theme.primaryColor};
        color: white;
        padding: 20px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }

      .myio-goals-header-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .myio-goals-header-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .myio-goals-modal-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }

      .myio-goals-close-btn {
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .myio-goals-close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .myio-goals-year-selector {
        padding: 16px 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 24px;
        background: #f8f9fa;
        border-bottom: 1px solid #dee2e6;
      }

      .myio-goals-year-btn {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
      }

      .myio-goals-year-btn:hover {
        background: ${theme.primaryColor};
        color: white;
        border-color: ${theme.primaryColor};
      }

      .myio-goals-year-display {
        font-size: 24px;
        font-weight: 700;
        color: ${theme.primaryColor};
        min-width: 80px;
        text-align: center;
      }

      .myio-goals-tabs {
        display: flex;
        border-bottom: 1px solid #dee2e6;
        background: white;
        flex-shrink: 0;
      }

      .myio-goals-tab {
        flex: 1;
        padding: 16px 24px;
        background: transparent;
        border: none;
        border-bottom: 3px solid transparent;
        cursor: pointer;
        font-size: 15px;
        font-weight: 500;
        color: #6c757d;
        transition: all 0.2s;
      }

      .myio-goals-tab:hover {
        background: #f8f9fa;
        color: ${theme.primaryColor};
      }

      .myio-goals-tab.active {
        color: ${theme.primaryColor};
        border-bottom-color: ${theme.primaryColor};
      }

      .myio-goals-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }

      .myio-goals-section {
        margin-bottom: 32px;
      }

      .myio-goals-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      .myio-goals-section-title {
        font-size: 16px;
        font-weight: 600;
        color: #212529;
        margin: 0 0 16px 0;
      }

      .myio-goals-shopping-selector {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 20px;
        background: linear-gradient(135deg, ${theme.primaryColor}15 0%, ${theme.primaryColor}05 100%);
        border: 2px solid ${theme.primaryColor}30;
        border-radius: ${theme.borderRadius};
        margin-bottom: 24px;
      }

      .myio-goals-shopping-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 600;
        color: ${theme.primaryColor};
        margin: 0;
      }

      .myio-goals-shopping-label svg {
        flex-shrink: 0;
      }

      .myio-goals-shopping-select {
        font-size: 15px;
        font-weight: 500;
        padding: 12px 16px;
        border: 2px solid ${theme.primaryColor};
        background: white;
        color: ${theme.primaryColor};
        cursor: pointer;
      }

      .myio-goals-shopping-select:hover {
        background: ${theme.primaryColor}10;
      }

      .myio-goals-shopping-select:focus {
        border-color: ${theme.primaryColor};
        box-shadow: 0 0 0 4px ${theme.primaryColor}20;
      }

      .myio-goals-btn-link {
        background: transparent;
        border: none;
        color: ${theme.primaryColor};
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s;
      }

      .myio-goals-btn-link:hover {
        background: rgba(74, 20, 140, 0.1);
      }

      .myio-goals-form-row {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
      }

      .myio-goals-form-group {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .myio-goals-form-group-large {
        flex: 2;
      }

      .myio-goals-form-group label {
        font-size: 14px;
        font-weight: 500;
        color: #495057;
      }

      .myio-goals-input {
        padding: 10px 12px;
        border: 1px solid #ced4da;
        border-radius: 6px;
        font-size: 14px;
        transition: border-color 0.2s;
      }

      .myio-goals-input:focus {
        outline: none;
        border-color: ${theme.primaryColor};
        box-shadow: 0 0 0 3px rgba(74, 20, 140, 0.1);
      }

      .myio-goals-progress-bar {
        width: 100%;
        height: 8px;
        background: #e9ecef;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .myio-goals-progress-fill {
        height: 100%;
        background: ${theme.successColor};
        transition: width 0.3s, background 0.3s;
      }

      .myio-goals-progress-text {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        color: #6c757d;
        margin-bottom: 16px;
      }

      .myio-goals-monthly-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 16px;
      }

      .myio-goals-month-input {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .myio-goals-month-input label {
        font-size: 13px;
        font-weight: 500;
        color: #495057;
      }

      .myio-goals-input-small {
        padding: 8px 10px;
        font-size: 13px;
      }

      .myio-goals-unit {
        font-size: 12px;
        color: #6c757d;
        margin-top: -4px;
      }

      .myio-goals-assets-header {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
      }

      .myio-goals-assets-header .myio-goals-input {
        flex: 1;
      }

      .myio-goals-assets-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .myio-goals-asset-item {
        border: 1px solid #dee2e6;
        border-radius: ${theme.borderRadius};
        overflow: hidden;
      }

      .myio-goals-asset-header {
        padding: 16px;
        background: #f8f9fa;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        transition: background 0.2s;
      }

      .myio-goals-asset-header:hover {
        background: #e9ecef;
      }

      .myio-goals-asset-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        color: #212529;
      }

      .myio-goals-asset-icon {
        transition: transform 0.3s;
      }

      .myio-goals-asset-total {
        font-size: 14px;
        color: #6c757d;
      }

      .myio-goals-btn-icon {
        background: transparent;
        border: none;
        color: ${theme.errorColor};
        cursor: pointer;
        padding: 6px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .myio-goals-btn-icon:hover {
        background: rgba(220, 53, 69, 0.1);
      }

      .myio-goals-asset-content {
        padding: 16px;
        border-top: 1px solid #dee2e6;
      }

      .myio-goals-asset-detail {
        /* Inherits styles from shopping tab */
      }

      .myio-goals-empty-state {
        text-align: center;
        padding: 48px 24px;
        color: #6c757d;
        font-size: 15px;
      }

      .myio-goals-errors {
        margin: 0 24px;
        padding: 16px;
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: ${theme.borderRadius};
        margin-bottom: 16px;
      }

      .myio-goals-error-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: #856404;
        margin-bottom: 12px;
      }

      .myio-goals-error-list {
        margin: 0;
        padding-left: 24px;
        color: #856404;
      }

      .myio-goals-error-list li {
        margin-bottom: 4px;
      }

      .myio-goals-success-message {
        display: flex;
        align-items: center;
        gap: 8px;
        color: ${theme.successColor};
        font-weight: 500;
      }

      .myio-goals-modal-footer {
        padding: 16px 24px;
        background: #f8f9fa;
        border-top: 1px solid #dee2e6;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }

      .myio-goals-meta-info {
        font-size: 12px;
        color: #6c757d;
      }

      .myio-goals-footer-actions {
        display: flex;
        gap: 12px;
      }

      .myio-goals-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .myio-goals-btn-primary {
        background: ${theme.primaryColor};
        color: white;
      }

      .myio-goals-btn-primary:hover:not(:disabled) {
        background: #5c1ba1;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(74, 20, 140, 0.3);
      }

      .myio-goals-btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .myio-goals-btn-secondary {
        background: white;
        color: #495057;
        border: 1px solid #ced4da;
      }

      .myio-goals-btn-secondary:hover {
        background: #f8f9fa;
      }

      @media (max-width: 768px) {
        .myio-goals-modal-container {
          width: 95%;
          max-height: 95vh;
        }

        .myio-goals-monthly-grid {
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 12px;
        }

        .myio-goals-form-row {
          flex-direction: column;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================================================
  // i18n STRINGS
  // ============================================================================

  function getPortugueseStrings() {
    return {
      modalTitle: 'Setup de Metas de Consumo',
      close: 'Fechar',
      previousYear: 'Ano anterior',
      nextYear: 'Próximo ano',
      shoppingTab: 'Shopping (Anual/Mensal)',
      assetsTab: 'Por Asset',
      selectShopping: 'Selecione o Shopping',
      annualGoal: 'Meta Anual',
      unit: 'Unidade',
      annualTotal: 'Total Anual',
      monthlyDistribution: 'Distribuição Mensal',
      autoFill: 'Preencher Proporcionalmente',
      searchAssets: 'Buscar assets...',
      addAsset: 'Adicionar Asset',
      noAssets: 'Nenhum asset configurado. Clique em "Adicionar Asset" para começar.',
      deleteAsset: 'Remover asset',
      save: 'Salvar',
      saving: 'Salvando...',
      cancel: 'Cancelar',
      lastUpdate: 'Última atualização',
      jan: 'Jan',
      feb: 'Fev',
      mar: 'Mar',
      apr: 'Abr',
      may: 'Mai',
      jun: 'Jun',
      jul: 'Jul',
      aug: 'Ago',
      sep: 'Set',
      oct: 'Out',
      nov: 'Nov',
      dec: 'Dez',
      unsavedChanges: 'Você tem alterações não salvas. Deseja sair mesmo assim?',
      confirmDeleteAsset: 'Deseja realmente remover este asset?',
      enterAssetName: 'Digite o nome do asset:',
      validationErrors: 'Erros de validação',
      errorNegativeAnnual: 'A meta anual não pode ser negativa',
      errorNegativeMonth: 'O valor mensal não pode ser negativo para o mês',
      errorMonthlyExceedsAnnual: 'A soma das metas mensais excede a meta anual',
      saveSuccess: 'Metas salvas com sucesso!',
      saveError: 'Erro ao salvar metas'
    };
  }

  function getEnglishStrings() {
    return {
      modalTitle: 'Consumption Goals Setup',
      close: 'Close',
      previousYear: 'Previous year',
      nextYear: 'Next year',
      shoppingTab: 'Shopping (Annual/Monthly)',
      assetsTab: 'By Asset',
      selectShopping: 'Select Shopping Center',
      annualGoal: 'Annual Goal',
      unit: 'Unit',
      annualTotal: 'Annual Total',
      monthlyDistribution: 'Monthly Distribution',
      autoFill: 'Auto Fill Proportionally',
      searchAssets: 'Search assets...',
      addAsset: 'Add Asset',
      noAssets: 'No assets configured. Click "Add Asset" to get started.',
      deleteAsset: 'Remove asset',
      save: 'Save',
      saving: 'Saving...',
      cancel: 'Cancel',
      lastUpdate: 'Last update',
      jan: 'Jan',
      feb: 'Feb',
      mar: 'Mar',
      apr: 'Apr',
      may: 'May',
      jun: 'Jun',
      jul: 'Jul',
      aug: 'Aug',
      sep: 'Sep',
      oct: 'Oct',
      nov: 'Nov',
      dec: 'Dec',
      unsavedChanges: 'You have unsaved changes. Do you want to exit anyway?',
      confirmDeleteAsset: 'Do you really want to remove this asset?',
      enterAssetName: 'Enter asset name:',
      validationErrors: 'Validation errors',
      errorNegativeAnnual: 'Annual goal cannot be negative',
      errorNegativeMonth: 'Monthly value cannot be negative for month',
      errorMonthlyExceedsAnnual: 'Monthly sum exceeds annual goal',
      saveSuccess: 'Goals saved successfully!',
      saveError: 'Error saving goals'
    };
  }
}
