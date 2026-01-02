// ===================================================================
// RFC-0111: MAIN_UNIQUE_DATASOURCE Controller
// Single Datasource Architecture - Head Office Dashboard
// ===================================================================

/* eslint-disable no-undef */
/* global self, window, document */

self.onInit = async function () {
  'use strict';

  // === 1. CONFIGURATION ===
  const settings = self.ctx.settings || {};
  let currentThemeMode = settings.defaultThemeMode || 'dark';

  // === 2. LIBRARY REFERENCE ===
  const MyIOLibrary = window.MyIOLibrary;
  if (!MyIOLibrary) {
    console.error('[MAIN_UNIQUE] MyIOLibrary not found');
    return;
  }

  // === 3. EXTRACT WELCOME CONFIG FROM SETTINGS ===
  const welcomeConfig = {
    enableDebugMode: settings.enableDebugMode,
    defaultHeroTitle: settings.defaultHeroTitle,
    defaultHeroDescription: settings.defaultHeroDescription,
    defaultPrimaryLabel: settings.defaultPrimaryLabel,
    darkMode: settings.darkMode || {},
    lightMode: settings.lightMode || {},
  };

  // === 4. RFC-0112: OPEN WELCOME MODAL (LOADING STATE) ===
  const welcomeModal = MyIOLibrary.openWelcomeModal({
    ctx: self.ctx,
    themeMode: currentThemeMode,
    showThemeToggle: true,
    configTemplate: welcomeConfig,
    shoppingCards: [], // Empty initially - loading state
    ctaLabel: 'Aguarde...',
    ctaDisabled: true,
    closeOnCtaClick: true,
    closeOnCardClick: true,
    onThemeChange: (newTheme) => {
      currentThemeMode = newTheme;
      applyGlobalTheme(newTheme);
      // Update all components with new theme
      if (headerInstance) headerInstance.setThemeMode?.(newTheme);
      if (menuInstance) menuInstance.setThemeMode?.(newTheme);
      if (footerInstance) footerInstance.setThemeMode?.(newTheme);
    },
    onClose: () => {
      console.log('[MAIN_UNIQUE] Welcome modal closed');
    },
    onCardClick: (card) => {
      console.log('[MAIN_UNIQUE] Shopping card clicked:', card.title);
      // Handle shopping selection if needed
    },
  });

  // === 5. RFC-0113: RENDER HEADER COMPONENT ===
  const headerContainer = document.getElementById('headerContainer');
  let headerInstance = null;

  if (headerContainer && MyIOLibrary.createHeaderComponent) {
    headerInstance = MyIOLibrary.createHeaderComponent({
      container: headerContainer,
      ctx: self.ctx,
      themeMode: currentThemeMode,
      logoUrl: settings.darkMode?.logoUrl || settings.lightMode?.logoUrl,
      cardColors: {
        equipment: {
          background: settings.cardEquipamentosBackgroundColor,
          font: settings.cardEquipamentosFontColor,
        },
        energy: {
          background: settings.cardEnergiaBackgroundColor,
          font: settings.cardEnergiaFontColor,
        },
        temperature: {
          background: settings.cardTemperaturaBackgroundColor,
          font: settings.cardTemperaturaFontColor,
        },
        water: {
          background: settings.cardAguaBackgroundColor,
          font: settings.cardAguaFontColor,
        },
      },
      enableTooltips: true,
      onFilterApply: (selection) => {
        window.dispatchEvent(
          new CustomEvent('myio:filter-applied', {
            detail: { selection, ts: Date.now() },
          })
        );
      },
      onBackClick: () => {
        // Re-open welcome modal
        if (welcomeModal) {
          welcomeModal.open?.();
        }
      },
    });
  }

  // === 6. RFC-0114: RENDER MENU COMPONENT ===
  const menuContainer = document.getElementById('menuContainer');
  let menuInstance = null;

  if (menuContainer && MyIOLibrary.createMenuComponent) {
    menuInstance = MyIOLibrary.createMenuComponent({
      container: menuContainer,
      ctx: self.ctx,
      themeMode: currentThemeMode,
      configTemplate: {
        tabSelecionadoBackgroundColor: settings.tabSelecionadoBackgroundColor || '#2F5848',
        tabSelecionadoFontColor: settings.tabSelecionadoFontColor || '#F2F2F2',
        tabNaoSelecionadoBackgroundColor: settings.tabNaoSelecionadoBackgroundColor || '#FFFFFF',
        tabNaoSelecionadoFontColor: settings.tabNaoSelecionadoFontColor || '#1C2743',
        enableDebugMode: settings.enableDebugMode,
      },
      initialTab: 'energy',
      initialDateRange: {
        start: getFirstDayOfMonth(),
        end: new Date(),
      },
      onTabChange: (tabId, contextId, target) => {
        console.log('[MAIN_UNIQUE] Tab changed:', tabId, contextId, target);
      },
      onContextChange: (tabId, contextId, target) => {
        console.log('[MAIN_UNIQUE] Context changed:', tabId, contextId, target);
        handleContextChange(tabId, contextId, target);
      },
      onDateRangeChange: (start, end) => {
        self.ctx.$scope.startDateISO = start.toISOString();
        self.ctx.$scope.endDateISO = end.toISOString();
        window.dispatchEvent(
          new CustomEvent('myio:update-date', {
            detail: { startISO: start.toISOString(), endISO: end.toISOString() },
          })
        );
      },
      onFilterApply: (selection) => {
        window.dispatchEvent(
          new CustomEvent('myio:filter-applied', {
            detail: { selection, ts: Date.now() },
          })
        );
      },
      onLoad: () => {
        window.dispatchEvent(new CustomEvent('myio:request-reload'));
      },
      onClear: () => {
        window.dispatchEvent(new CustomEvent('myio:force-refresh'));
      },
      onGoals: () => {
        window.dispatchEvent(new CustomEvent('myio:open-goals-panel'));
      },
    });
  }

  // === 7. RFC-0115: RENDER FOOTER COMPONENT ===
  const footerContainer = document.getElementById('footerContainer');
  let footerInstance = null;

  if (footerContainer && MyIOLibrary.createFooterComponent) {
    footerInstance = MyIOLibrary.createFooterComponent({
      container: footerContainer,
      ctx: self.ctx,
      themeMode: currentThemeMode,
      maxSelections: 6,
      getDateRange: () => ({
        start: self.ctx.$scope.startDateISO,
        end: self.ctx.$scope.endDateISO,
      }),
      onCompareClick: (entities, unitType) => {
        console.log('[MAIN_UNIQUE] Compare clicked:', entities.length, unitType);
      },
      onSelectionChange: (entities) => {
        console.log('[MAIN_UNIQUE] Selection changed:', entities.length);
      },
    });
  }

  // === 8. INITIALIZE ORCHESTRATOR ===
  await initializeOrchestrator();

  // === 9. LISTEN FOR DATA READY EVENT ===
  window.addEventListener('myio:data-ready', (e) => {
    const { shoppingCards, deviceCounts } = e.detail;

    // Update welcome modal with shopping cards
    if (welcomeModal && shoppingCards) {
      welcomeModal.updateShoppingCards?.(shoppingCards);
      welcomeModal.setCtaLabel?.('ACESSAR PAINEL');
      welcomeModal.setCtaDisabled?.(false);
    }

    // Update header KPIs
    if (headerInstance && deviceCounts) {
      headerInstance.updateKPIs?.({
        equip: { totalStr: `${deviceCounts.total}`, percent: 100 },
        energy: { kpi: formatEnergy(deviceCounts.energyTotal), trendDir: 'up', trendText: '' },
        temp: { kpi: formatTemperature(deviceCounts.tempAvg), rangeText: '18-26°C' },
        water: { kpi: formatWater(deviceCounts.waterTotal), percent: 100 },
      });
    }

    // Update menu shoppings
    if (menuInstance && e.detail.shoppings) {
      menuInstance.updateShoppings?.(e.detail.shoppings);
    }
  });

  // === 10. LISTEN FOR PANEL MODAL REQUESTS ===
  window.addEventListener('myio:panel-modal-request', (e) => {
    const { domain, panelType } = e.detail;
    handlePanelModalRequest(domain, panelType);
  });

  // === HELPER FUNCTIONS ===

  function applyGlobalTheme(themeMode) {
    const wrap = document.getElementById('mainUniqueWrap');
    if (wrap) {
      wrap.setAttribute('data-theme', themeMode);
    }
    window.dispatchEvent(
      new CustomEvent('myio:theme-change', {
        detail: { themeMode },
      })
    );
  }

  function handleContextChange(tabId, contextId, target) {
    // Check if this is a panel modal request (Geral, Resumo, Resumo Geral)
    const panelContexts = ['energy_general', 'water_summary', 'temperature_summary'];

    if (panelContexts.includes(contextId)) {
      // Open panel modal instead of switching TELEMETRY
      handlePanelModalRequest(tabId, 'summary');
    } else {
      // Dispatch config change to TELEMETRY
      window.dispatchEvent(
        new CustomEvent('myio:telemetry-config-change', {
          detail: {
            domain: tabId,
            context: contextId,
            timestamp: Date.now(),
          },
        })
      );

      // Also dispatch dashboard state for FOOTER
      window.dispatchEvent(
        new CustomEvent('myio:dashboard-state', {
          detail: { domain: tabId, stateId: target },
        })
      );
    }
  }

  function handlePanelModalRequest(domain, panelType) {
    const container = document.getElementById('panelModalContainer');
    if (!container) return;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'myio-panel-modal-overlay';
    overlay.innerHTML = `
      <div class="myio-panel-modal">
        <button class="myio-panel-modal-close" aria-label="Fechar">×</button>
        <div class="myio-panel-modal-content"></div>
      </div>
    `;

    container.appendChild(overlay);

    const panelContent = overlay.querySelector('.myio-panel-modal-content');
    let panelInstance = null;

    // Create appropriate panel based on domain
    if (domain === 'energy' && MyIOLibrary.createEnergyPanel) {
      panelInstance = MyIOLibrary.createEnergyPanel({
        container: panelContent,
        ctx: self.ctx,
        themeMode: currentThemeMode,
        configTemplate: { title: 'Gestao de Energia', defaultPeriod: 7 },
        fetchConsumptionData: async (period) => {
          // Fetch from orchestrator
          return window.MyIOOrchestrator?.fetchEnergyConsumption?.(period);
        },
        onError: (err) => console.error('[EnergyPanel]', err),
      });
    } else if (domain === 'water' && MyIOLibrary.createWaterPanel) {
      panelInstance = MyIOLibrary.createWaterPanel({
        container: panelContent,
        ctx: self.ctx,
        themeMode: currentThemeMode,
        configTemplate: { title: 'Gestao de Agua', defaultPeriod: 7 },
        fetchConsumptionData: async (period) => {
          return window.MyIOOrchestrator?.fetchWaterConsumption?.(period);
        },
        onError: (err) => console.error('[WaterPanel]', err),
      });
    } else if (domain === 'temperature' && MyIOLibrary.createTemperaturePanel) {
      panelInstance = MyIOLibrary.createTemperaturePanel({
        container: panelContent,
        ctx: self.ctx,
        themeMode: currentThemeMode,
        configTemplate: { targetTemp: 23, targetTolerance: 2, defaultPeriod: 7 },
        onError: (err) => console.error('[TemperaturePanel]', err),
      });
    }

    // Close handler
    const closeBtn = overlay.querySelector('.myio-panel-modal-close');
    closeBtn.addEventListener('click', () => {
      panelInstance?.destroy?.();
      overlay.remove();
    });

    // ESC key handler
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        panelInstance?.destroy?.();
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        panelInstance?.destroy?.();
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }

  async function initializeOrchestrator() {
    // Initialize MyIOOrchestrator with AllDevices datasource
    if (!window.MyIOOrchestrator) {
      window.MyIOOrchestrator = {};
    }

    // Classify devices when data arrives
    // This will be called from onDataUpdated
  }

  function getFirstDayOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  function formatEnergy(value) {
    if (!value || isNaN(value)) return '- kWh';
    if (value >= 1000) return (value / 1000).toFixed(1) + ' MWh';
    return value.toFixed(0) + ' kWh';
  }

  function formatTemperature(value) {
    if (!value || isNaN(value)) return '- °C';
    return value.toFixed(1) + ' °C';
  }

  function formatWater(value) {
    if (!value || isNaN(value)) return '- m³';
    return value.toFixed(1) + ' m³';
  }
};

// ===================================================================
// onDataUpdated - Called when ThingsBoard datasource updates
// ===================================================================
self.onDataUpdated = function () {
  const data = self.ctx.data || [];

  if (data.length === 0) return;

  // Classify all devices from single datasource
  const classified = classifyAllDevices(data);

  // Build shopping cards for welcome modal
  const shoppingCards = buildShoppingCards(classified);

  // Calculate device counts
  const deviceCounts = calculateDeviceCounts(classified);

  // Dispatch data ready event
  window.dispatchEvent(
    new CustomEvent('myio:data-ready', {
      detail: {
        classified,
        shoppingCards,
        deviceCounts,
        shoppings: buildShoppingsList(data),
        timestamp: Date.now(),
      },
    })
  );
};

// ===================================================================
// Device Classification Logic
// ===================================================================
function classifyAllDevices(data) {
  const classified = {
    energy: { equipments: [], stores: [] },
    water: { hidrometro_area_comum: [], hidrometro: [] },
    temperature: { termostato: [], termostato_external: [] },
  };

  data.forEach((row) => {
    const device = extractDeviceMetadata(row);
    const domain = detectDomain(device);
    const context = detectContext(device, domain);

    if (classified[domain]?.[context]) {
      classified[domain][context].push(device);
    }
  });

  // Cache for getDevices
  window.MyIOOrchestratorData = { classified, timestamp: Date.now() };

  return classified;
}

function extractDeviceMetadata(row) {
  // Extract device info from ThingsBoard data row
  const datasource = row.datasource || {};
  return {
    id: datasource.entityId || row.entityId,
    name: datasource.entityName || datasource.name || 'Unknown',
    aliasName: datasource.aliasName || '',
    deviceType: findDataValue(row, 'deviceType') || datasource.entityType,
    deviceProfile: findDataValue(row, 'deviceProfile') || '',
    ingestionId: findDataValue(row, 'ingestionId') || '',
    customerId: findDataValue(row, 'customerId') || '',
    customerName: findDataValue(row, 'customerName') || findDataValue(row, 'ownerName') || '',
    lastActivityTime: findDataValue(row, 'lastActivityTime'),
    lastConnectTime: findDataValue(row, 'lastConnectTime'),
    lastDisconnectTime: findDataValue(row, 'lastDisconnectTime'),
    // Domain-specific values
    consumption: findDataValue(row, 'consumption'),
    pulses: findDataValue(row, 'pulses'),
    temperature: findDataValue(row, 'temperature'),
    water_level: findDataValue(row, 'water_level'),
  };
}

function findDataValue(row, key) {
  if (!row.data) return null;
  for (const d of row.data) {
    if (d.dataKey?.name === key || d.dataKey?.label === key) {
      return d.data?.[0]?.[1];
    }
  }
  return null;
}

function detectDomain(device) {
  const aliasName = (device.aliasName || '').toLowerCase();
  const deviceType = (device.deviceType || '').toLowerCase();
  const deviceProfile = (device.deviceProfile || '').toLowerCase();

  // Water detection
  if (
    aliasName.includes('hidro') ||
    aliasName.includes('water') ||
    deviceType.includes('hidro') ||
    deviceProfile.includes('hidro')
  ) {
    return 'water';
  }

  // Temperature detection
  if (
    aliasName.includes('temp') ||
    aliasName.includes('sensor') ||
    deviceType.includes('termo') ||
    deviceProfile.includes('termo') ||
    deviceType.includes('clima')
  ) {
    return 'temperature';
  }

  // Default: Energy
  return 'energy';
}

function detectContext(device, domain) {
  const aliasName = (device.aliasName || '').toLowerCase();
  const deviceType = (device.deviceType || '').toUpperCase();
  const deviceProfile = (device.deviceProfile || '').toUpperCase();

  if (domain === 'energy') {
    // Check if store device (3F_MEDIDOR)
    if (deviceProfile === '3F_MEDIDOR' || deviceType === '3F_MEDIDOR') {
      return 'stores';
    }
    return 'equipments';
  }

  if (domain === 'water') {
    // Check alias for common area vs stores
    if (aliasName.includes('comum') || aliasName.includes('common')) {
      return 'hidrometro_area_comum';
    }
    return 'hidrometro';
  }

  if (domain === 'temperature') {
    // Check if climatized environment
    if (deviceType.includes('CLIMA') || deviceProfile.includes('CLIMA')) {
      return 'termostato';
    }
    return 'termostato_external';
  }

  return 'equipments'; // Default
}

function buildShoppingCards(classified) {
  // Group by customer and build shopping cards
  const customerMap = new Map();

  Object.values(classified).forEach((domainDevices) => {
    Object.values(domainDevices).forEach((devices) => {
      devices.forEach((device) => {
        const customerId = device.customerId || 'unknown';
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            title: device.customerName || 'Unknown',
            customerId,
            deviceCounts: { energy: 0, water: 0, temperature: 0 },
          });
        }
      });
    });
  });

  // Count devices per domain per customer
  ['energy', 'water', 'temperature'].forEach((domain) => {
    const domainDevices = classified[domain] || {};
    Object.values(domainDevices).forEach((devices) => {
      devices.forEach((device) => {
        const customerId = device.customerId || 'unknown';
        const card = customerMap.get(customerId);
        if (card) {
          card.deviceCounts[domain]++;
        }
      });
    });
  });

  return Array.from(customerMap.values());
}

function buildShoppingsList(data) {
  const customerMap = new Map();

  data.forEach((row) => {
    const device = extractDeviceMetadata(row);
    const customerId = device.customerId;
    if (customerId && !customerMap.has(customerId)) {
      customerMap.set(customerId, {
        name: device.customerName || 'Unknown',
        value: device.ingestionId || customerId,
        customerId: customerId,
        ingestionId: device.ingestionId || '',
      });
    }
  });

  return Array.from(customerMap.values());
}

function calculateDeviceCounts(classified) {
  let total = 0;
  let energyTotal = 0;
  let waterTotal = 0;
  let tempTotal = 0;
  let tempSum = 0;
  let tempCount = 0;

  Object.entries(classified).forEach(([domain, contexts]) => {
    Object.values(contexts).forEach((devices) => {
      total += devices.length;
      devices.forEach((device) => {
        if (domain === 'energy') {
          energyTotal += device.consumption || 0;
        } else if (domain === 'water') {
          waterTotal += device.pulses || 0;
        } else if (domain === 'temperature') {
          if (device.temperature != null) {
            tempSum += device.temperature;
            tempCount++;
          }
        }
      });
    });
  });

  return {
    total,
    energyTotal,
    waterTotal,
    tempAvg: tempCount > 0 ? tempSum / tempCount : null,
  };
}

// ===================================================================
// MyIOOrchestrator.getDevices - For TELEMETRY to fetch devices
// ===================================================================
window.MyIOOrchestrator = window.MyIOOrchestrator || {};
window.MyIOOrchestrator.getDevices = function (domain, context) {
  const data = window.MyIOOrchestratorData?.classified;
  return data?.[domain]?.[context] || [];
};

self.onDestroy = function () {
  // Cleanup
};
