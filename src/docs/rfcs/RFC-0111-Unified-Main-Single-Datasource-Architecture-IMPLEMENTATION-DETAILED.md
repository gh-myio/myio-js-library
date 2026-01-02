# RFC-0111: Implementation Detail Document

**Unified Main Single Datasource Architecture**

- Status: **Ready for Implementation**
- Date: 2026-01-02
- Related RFCs: 0112, 0113, 0114, 0115, 0117, 0118, 0119

---

## 1. Summary

This document provides the complete implementation specification for RFC-0111. The new architecture consolidates all dashboard functionality into **only 2 ThingsBoard widgets** (`MAIN_UNIQUE_DATASOURCE` and `TELEMETRY`), with all other components moved to the **MYIO library**.

---

## ⚠️ IMPORTANT: Do NOT Modify These Files

The following files are from the **old architecture** and must NOT be modified:

- `src/MYIO-SIM/v5.2.0/MAIN/` - Old MAIN widget (keep untouched)
- `src/MYIO-SIM/v5.2.0/MENU/` - Old MENU widget (keep untouched)
- Any reference to `MAIN/controller.js` or `MENU/controller.js`

**Reason**: These are legacy widgets. MENU is now a library component (`createMenuComponent`), and we create a new `MAIN_UNIQUE_DATASOURCE` widget instead of modifying MAIN.

---

## 2. Architecture Overview

### 2.1 Before (Current Architecture)

```
ThingsBoard Widgets:
├── MAIN/
├── WELCOME/
├── HEADER/
├── MENU/
├── FOOTER/
├── EQUIPMENTS/
├── STORES/
├── WATER_COMMON_AREA/
├── WATER_STORES/
├── TEMPERATURE_SENSORS/
├── TEMPERATURE_WITHOUT_CLIMATE_CONTROL/
├── ENERGY/
├── WATER/
└── TEMPERATURE/
```

### 2.2 After (New Architecture)

```
ThingsBoard Widgets (only 2):
├── MAIN_UNIQUE_DATASOURCE/     # Orchestrates everything
└── TELEMETRY/                  # Dynamic device cards view

Library Components (everything else):
├── openWelcomeModal()          # RFC-0112
├── createHeaderComponent()     # RFC-0113
├── createMenuComponent()       # RFC-0114
├── createFooterComponent()     # RFC-0115
├── createEnergyPanel()         # RFC-0117
├── createWaterPanel()          # RFC-0118
└── createTemperaturePanel()    # RFC-0119
```

---

## 3. Widget Files to Create

### 3.1 MAIN_UNIQUE_DATASOURCE

**Location**: `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/`

**Files**:
| File | Purpose |
|------|---------|
| `template.html` | Layout with div containers (NO tb-dashboard-state) |
| `controller.js` | Orchestrator + library component calls |
| `styles.css` | Layout styles |
| `settingsSchema.json` | Configuration (darkMode/lightMode, card colors) |

**NOT needed**: `dataKeySettings.json`, `base.json` (ThingsBoard auto-generates)

---

## 4. Template Structure

### 4.1 MAIN_UNIQUE_DATASOURCE/template.html

```html
<div class="main-unique-wrap" id="mainUniqueWrap" data-theme="dark">
  <!-- RFC-0113: Header (rendered via createHeaderComponent) -->
  <section id="headerContainer" class="myio-header-section"
           style="height: 145px; min-height: 145px; max-height: 145px;">
  </section>

  <!-- RFC-0114: Menu (rendered via createMenuComponent) -->
  <section id="menuContainer" class="myio-menu-section"
           style="height: 80px; min-height: 80px; max-height: 80px;">
  </section>

  <!-- Main Content: TELEMETRY widget via tb-dashboard-state -->
  <section id="mainViewContainer" class="myio-main-view-section"
           style="flex: 1; overflow: auto;">
    <tb-dashboard-state class="content" [ctx]="ctx" stateId="telemetry"></tb-dashboard-state>
  </section>

  <!-- RFC-0115: Footer (rendered via createFooterComponent) -->
  <section id="footerContainer" class="myio-footer-section"
           style="height: 46px; min-height: 46px; max-height: 46px;">
  </section>

  <!-- Modal containers for panel views (RFC-0117, 0118, 0119) -->
  <div id="panelModalContainer"></div>
</div>
```

**Note**: TELEMETRY is still a ThingsBoard widget accessed via `tb-dashboard-state stateId="telemetry"`.

---

## 5. Controller Implementation

### 5.1 MAIN_UNIQUE_DATASOURCE/controller.js

```javascript
// ===================================================================
// RFC-0111: MAIN_UNIQUE_DATASOURCE Controller
// Single Datasource Architecture - Head Office Dashboard
// ===================================================================

self.onInit = async function() {
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
        window.dispatchEvent(new CustomEvent('myio:filter-applied', {
          detail: { selection, ts: Date.now() }
        }));
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
        window.dispatchEvent(new CustomEvent('myio:update-date', {
          detail: { startISO: start.toISOString(), endISO: end.toISOString() }
        }));
      },
      onFilterApply: (selection) => {
        window.dispatchEvent(new CustomEvent('myio:filter-applied', {
          detail: { selection, ts: Date.now() }
        }));
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
    window.dispatchEvent(new CustomEvent('myio:theme-change', {
      detail: { themeMode }
    }));
  }

  function handleContextChange(tabId, contextId, target) {
    // Check if this is a panel modal request (Geral, Resumo, Resumo Geral)
    const panelContexts = ['energy_general', 'water_summary', 'temperature_summary'];

    if (panelContexts.includes(contextId)) {
      // Open panel modal instead of switching TELEMETRY
      handlePanelModalRequest(tabId, 'summary');
    } else {
      // Dispatch config change to TELEMETRY
      window.dispatchEvent(new CustomEvent('myio:telemetry-config-change', {
        detail: {
          domain: tabId,
          context: contextId,
          timestamp: Date.now()
        }
      }));

      // Also dispatch dashboard state for FOOTER
      window.dispatchEvent(new CustomEvent('myio:dashboard-state', {
        detail: { domain: tabId, stateId: target }
      }));
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
self.onDataUpdated = function() {
  const data = self.ctx.data || [];

  if (data.length === 0) return;

  // Classify all devices from single datasource
  const classified = classifyAllDevices(data);

  // Build shopping cards for welcome modal
  const shoppingCards = buildShoppingCards(classified);

  // Calculate device counts
  const deviceCounts = calculateDeviceCounts(classified);

  // Dispatch data ready event
  window.dispatchEvent(new CustomEvent('myio:data-ready', {
    detail: {
      classified,
      shoppingCards,
      deviceCounts,
      shoppings: buildShoppingsList(data),
      timestamp: Date.now()
    }
  }));
};

// ===================================================================
// Device Classification Logic
// ===================================================================
function classifyAllDevices(data) {
  const classified = {
    energy: { equipments: [], stores: [] },
    water: { hidrometro_area_comum: [], hidrometro: [] },
    temperature: { termostato: [], termostato_external: [] }
  };

  data.forEach(row => {
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
  if (aliasName.includes('hidro') || aliasName.includes('water') ||
      deviceType.includes('hidro') || deviceProfile.includes('hidro')) {
    return 'water';
  }

  // Temperature detection
  if (aliasName.includes('temp') || aliasName.includes('sensor') ||
      deviceType.includes('termo') || deviceProfile.includes('termo') ||
      deviceType.includes('clima')) {
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

  Object.values(classified).forEach(domainDevices => {
    Object.values(domainDevices).forEach(devices => {
      devices.forEach(device => {
        const customerId = device.customerId || 'unknown';
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            title: device.customerName || 'Unknown',
            customerId,
            deviceCounts: { energy: 0, water: 0, temperature: 0 }
          });
        }
      });
    });
  });

  // Count devices per domain per customer
  ['energy', 'water', 'temperature'].forEach(domain => {
    const domainDevices = classified[domain] || {};
    Object.values(domainDevices).forEach(devices => {
      devices.forEach(device => {
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

  data.forEach(row => {
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
    Object.values(contexts).forEach(devices => {
      total += devices.length;
      devices.forEach(device => {
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
window.MyIOOrchestrator.getDevices = function(domain, context) {
  const data = window.MyIOOrchestratorData?.classified;
  return data?.[domain]?.[context] || [];
};

self.onDestroy = function() {
  // Cleanup
};
```

---

## 6. Settings Schema

### 6.1 MAIN_UNIQUE_DATASOURCE/settingsSchema.json

```json
{
  "schema": {
    "type": "object",
    "title": "MAIN_UNIQUE_DATASOURCE Settings",
    "description": "RFC-0111: Unified Main Single Datasource Architecture",
    "properties": {
      "enableDebugMode": {
        "title": "Enable Debug Mode",
        "type": "boolean",
        "default": false
      },
      "defaultThemeMode": {
        "title": "Default Theme Mode",
        "type": "string",
        "enum": ["dark", "light"],
        "default": "dark"
      },

      "darkMode": {
        "type": "object",
        "title": "Dark Mode Settings",
        "properties": {
          "backgroundUrl": {
            "title": "Background URL",
            "type": "string",
            "default": "https://dashboard.myio-bas.com/api/images/public/wntqPf1KcpLX2l182DY86Y4p8pa3bj6F"
          },
          "logoUrl": {
            "title": "Logo URL",
            "type": "string",
            "default": "https://dashboard.myio-bas.com/api/images/public/1Tl6OQO9NWvexQw18Kkb2VBkN04b8tYG"
          },
          "primaryColor": { "title": "Primary Color", "type": "string", "default": "#7A2FF7" },
          "secondaryColor": { "title": "Secondary Color", "type": "string", "default": "#5A1FD1" },
          "textColor": { "title": "Text Color", "type": "string", "default": "#F5F7FA" },
          "mutedTextColor": { "title": "Muted Text Color", "type": "string", "default": "#B8C2D8" }
        }
      },

      "lightMode": {
        "type": "object",
        "title": "Light Mode Settings",
        "properties": {
          "backgroundUrl": { "title": "Background URL", "type": "string" },
          "logoUrl": { "title": "Logo URL", "type": "string" },
          "primaryColor": { "title": "Primary Color", "type": "string", "default": "#7A2FF7" },
          "secondaryColor": { "title": "Secondary Color", "type": "string", "default": "#5A1FD1" },
          "textColor": { "title": "Text Color", "type": "string", "default": "#1a1a2e" },
          "mutedTextColor": { "title": "Muted Text Color", "type": "string", "default": "#64748b" }
        }
      },

      "defaultHeroTitle": {
        "title": "Hero Title",
        "type": "string",
        "default": "Bem-vindo ao MYIO Platform"
      },
      "defaultHeroDescription": {
        "title": "Hero Description",
        "type": "string",
        "default": "Gestão inteligente de energia, água e recursos para shoppings centers"
      },
      "defaultPrimaryLabel": {
        "title": "CTA Button Label",
        "type": "string",
        "default": "ACESSAR PAINEL"
      },

      "cardEquipamentosBackgroundColor": { "title": "Card Equipamentos - Background", "type": "string", "default": "#1F3A35" },
      "cardEquipamentosFontColor": { "title": "Card Equipamentos - Font", "type": "string", "default": "#F2F2F2" },
      "cardEnergiaBackgroundColor": { "title": "Card Energia - Background", "type": "string", "default": "#1F3A35" },
      "cardEnergiaFontColor": { "title": "Card Energia - Font", "type": "string", "default": "#F2F2F2" },
      "cardTemperaturaBackgroundColor": { "title": "Card Temperatura - Background", "type": "string", "default": "#1F3A35" },
      "cardTemperaturaFontColor": { "title": "Card Temperatura - Font", "type": "string", "default": "#F2F2F2" },
      "cardAguaBackgroundColor": { "title": "Card Agua - Background", "type": "string", "default": "#1F3A35" },
      "cardAguaFontColor": { "title": "Card Agua - Font", "type": "string", "default": "#F2F2F2" },

      "tabSelecionadoBackgroundColor": { "title": "Tab Selecionado - Background", "type": "string", "default": "#2F5848" },
      "tabSelecionadoFontColor": { "title": "Tab Selecionado - Font", "type": "string", "default": "#F2F2F2" },
      "tabNaoSelecionadoBackgroundColor": { "title": "Tab Não Selecionado - Background", "type": "string", "default": "#FFFFFF" },
      "tabNaoSelecionadoFontColor": { "title": "Tab Não Selecionado - Font", "type": "string", "default": "#1C2743" }
    }
  },
  "form": [
    { "key": "enableDebugMode", "type": "checkbox" },
    { "key": "defaultThemeMode", "type": "select" },
    {
      "type": "fieldset",
      "title": "Dark Mode",
      "items": ["darkMode.backgroundUrl", "darkMode.logoUrl", "darkMode.primaryColor", "darkMode.textColor"]
    },
    {
      "type": "fieldset",
      "title": "Light Mode",
      "items": ["lightMode.backgroundUrl", "lightMode.logoUrl", "lightMode.primaryColor", "lightMode.textColor"]
    },
    {
      "type": "fieldset",
      "title": "Welcome Modal Content",
      "items": ["defaultHeroTitle", "defaultHeroDescription", "defaultPrimaryLabel"]
    },
    {
      "type": "fieldset",
      "title": "Header Card Colors",
      "items": [
        { "key": "cardEquipamentosBackgroundColor", "type": "color" },
        { "key": "cardEquipamentosFontColor", "type": "color" },
        { "key": "cardEnergiaBackgroundColor", "type": "color" },
        { "key": "cardEnergiaFontColor", "type": "color" },
        { "key": "cardTemperaturaBackgroundColor", "type": "color" },
        { "key": "cardTemperaturaFontColor", "type": "color" },
        { "key": "cardAguaBackgroundColor", "type": "color" },
        { "key": "cardAguaFontColor", "type": "color" }
      ]
    },
    {
      "type": "fieldset",
      "title": "Menu Tab Colors",
      "items": [
        { "key": "tabSelecionadoBackgroundColor", "type": "color" },
        { "key": "tabSelecionadoFontColor", "type": "color" },
        { "key": "tabNaoSelecionadoBackgroundColor", "type": "color" },
        { "key": "tabNaoSelecionadoFontColor", "type": "color" }
      ]
    }
  ]
}
```

---

## 7. Styles

### 7.1 MAIN_UNIQUE_DATASOURCE/styles.css

```css
/* RFC-0111: MAIN_UNIQUE_DATASOURCE Layout Styles */

.main-unique-wrap {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--tb-background, transparent);
}

.main-unique-wrap[data-theme="dark"] {
  --myio-bg: #0f172a;
  --myio-text: #f1f5f9;
}

.main-unique-wrap[data-theme="light"] {
  --myio-bg: #f8fafc;
  --myio-text: #1e293b;
}

/* Sections */
.myio-header-section {
  flex-shrink: 0;
  overflow: hidden;
}

.myio-menu-section {
  flex-shrink: 0;
  overflow: hidden;
}

.myio-main-view-section {
  flex: 1;
  overflow: auto;
}

.myio-footer-section {
  flex-shrink: 0;
  overflow: hidden;
}

/* Panel Modal Overlay */
.myio-panel-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.myio-panel-modal {
  width: 95vw;
  height: 95vh;
  background: var(--myio-bg, #1a1a2e);
  border-radius: 16px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.myio-panel-modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: var(--myio-text, #fff);
  font-size: 24px;
  border-radius: 8px;
  cursor: pointer;
  z-index: 10;
  transition: background 0.2s ease;
}

.myio-panel-modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.myio-panel-modal-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
}
```

---

## 8. TELEMETRY Widget Updates

### 8.1 TELEMETRY/controller.js Changes

Add config change listener in `onInit`:

```javascript
// Listen for config changes from MENU
window.addEventListener('myio:telemetry-config-change', (ev) => {
  const { domain, context } = ev.detail;

  console.log('[TELEMETRY] Config change:', domain, context);

  // Update widget configuration
  WIDGET_DOMAIN = domain;
  WIDGET_CONTEXT = context;

  // Apply visual theme
  applyDomainTheme(domain);
  applyContextAttribute(context);

  // Get devices from orchestrator
  const devices = window.MyIOOrchestrator?.getDevices?.(domain, context) || [];

  // Update state
  STATE.allDevices = devices;

  // Re-render cards
  initializeCards(devices);

  // Update header stats
  if (telemetryHeaderController) {
    telemetryHeaderController.updateFromDevices(devices, {});
  }
});
```

Update CONTEXT_CONFIG:

```javascript
const CONTEXT_CONFIG = {
  // Energy contexts
  equipments: {
    label: 'Equipamentos',
    aliasFilter: null,
    deviceFilter: (d) => !isStoreDevice(d),
  },
  stores: {
    label: 'Lojas',
    aliasFilter: '3F_MEDIDOR',
    deviceFilter: (d) => isStoreDevice(d),
  },

  // Water contexts
  hidrometro_area_comum: {
    label: 'Área Comum',
    aliasFilter: 'HidrometrosAreaComum',
    deviceFilter: null,
  },
  hidrometro: {
    label: 'Lojas',
    aliasFilter: 'Todos Hidrometros Lojas',
    deviceFilter: null,
  },

  // Temperature contexts
  termostato: {
    label: 'Ambientes Climatizáveis',
    aliasFilter: 'CLIMA',
    deviceFilter: (d) => isClimatizedDevice(d),
  },
  termostato_external: {
    label: 'Ambientes Não Climatizáveis',
    aliasFilter: null,
    deviceFilter: (d) => !isClimatizedDevice(d),
  },
};
```

---

## 9. Event Contracts

**Note**: "MENU" below refers to the library component (`createMenuComponent`), NOT the old MENU widget.

| Event | Dispatcher | Listener | Payload |
|-------|------------|----------|---------|
| `myio:telemetry-config-change` | Menu Component (lib) | TELEMETRY widget | `{ domain, context, timestamp }` |
| `myio:panel-modal-request` | Menu Component (lib) | MAIN_UNIQUE_DATASOURCE | `{ domain, panelType, timestamp }` |
| `myio:data-ready` | MAIN_UNIQUE_DATASOURCE | Welcome Modal | `{ classified, shoppingCards, deviceCounts, shoppings }` |
| `myio:filter-applied` | Header/Menu Components | TELEMETRY widget | `{ selection, ts }` |
| `myio:update-date` | Menu Component (lib) | TELEMETRY widget | `{ startISO, endISO }` |
| `myio:dashboard-state` | Menu Component (lib) | Footer Component | `{ domain, stateId }` |
| `myio:theme-change` | Welcome Modal | MAIN_UNIQUE_DATASOURCE | `{ themeMode }` |

---

## 10. Navigation Matrix

| Menu Option | Domain | Context | Action |
|-------------|--------|---------|--------|
| Energia > Equipamentos | energy | equipments | TELEMETRY config change |
| Energia > Lojas | energy | stores | TELEMETRY config change |
| Energia > Geral | energy | - | Open EnergyPanel modal |
| Água > Área Comum | water | hidrometro_area_comum | TELEMETRY config change |
| Água > Lojas | water | hidrometro | TELEMETRY config change |
| Água > Resumo | water | - | Open WaterPanel modal |
| Temperatura > Climatizáveis | temperature | termostato | TELEMETRY config change |
| Temperatura > Não Climatizáveis | temperature | termostato_external | TELEMETRY config change |
| Temperatura > Resumo Geral | temperature | - | Open TemperaturePanel modal |

---

## 11. Library Dependencies

The following library components must exist:

| Component | RFC | File Path | Status |
|-----------|-----|-----------|--------|
| `openWelcomeModal()` | 0112 | `src/components/premium-modals/welcome/` | Existing |
| `createHeaderComponent()` | 0113 | `src/components/header/` | To verify |
| `createMenuComponent()` | 0114 | `src/components/menu/` | Existing |
| `createFooterComponent()` | 0115 | `src/components/footer/` | To verify |
| `createEnergyPanel()` | 0117 | `src/components/energy-panel/` | To verify |
| `createWaterPanel()` | 0118 | `src/components/water-panel/` | To verify |
| `createTemperaturePanel()` | 0119 | `src/components/temperature-panel/` | To verify |

---

## 12. Testing Checklist

### Welcome Modal
- [ ] Opens on MAIN init with "Aguarde..." button
- [ ] Shopping cards load after `myio:data-ready`
- [ ] Theme toggle (dark/light) works
- [ ] Close button works
- [ ] Card click works

### Navigation
- [ ] Energy > Equipamentos changes TELEMETRY
- [ ] Energy > Lojas changes TELEMETRY
- [ ] Energy > Geral opens 95% modal
- [ ] Water > Área Comum changes TELEMETRY
- [ ] Water > Lojas changes TELEMETRY
- [ ] Water > Resumo opens 95% modal
- [ ] Temperature > Climatizáveis changes TELEMETRY
- [ ] Temperature > Não Climatizáveis changes TELEMETRY
- [ ] Temperature > Resumo Geral opens 95% modal

### Data Flow
- [ ] AllDevices datasource loads
- [ ] Device classification works
- [ ] `myio:data-ready` fires
- [ ] TELEMETRY receives devices

---

## 13. Files Summary

### To Create (New Widget: MAIN_UNIQUE_DATASOURCE)

| File | Purpose |
|------|---------|
| `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/template.html` | Layout with library component containers |
| `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js` | Orchestrator + library calls |
| `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/styles.css` | Layout styles + panel modal |
| `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/settingsSchema.json` | darkMode/lightMode config |

### To Modify

| File | Change |
|------|--------|
| `src/MYIO-SIM/v5.2.0/TELEMETRY/controller.js` | Add `myio:telemetry-config-change` listener |

### ⛔ Do NOT Modify (Legacy - Old Architecture)

| File | Reason |
|------|--------|
| `src/MYIO-SIM/v5.2.0/MAIN/` | Old widget - create MAIN_UNIQUE_DATASOURCE instead |
| `src/MYIO-SIM/v5.2.0/MENU/` | Old widget - now a library component |

---

**Document Version**: 1.1
**Last Updated**: 2026-01-02
**Revision**: Updated per rev-003 feedback - clarified MAIN vs MAIN_UNIQUE_DATASOURCE, removed MENU/MAIN modification references
