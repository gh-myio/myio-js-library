# RFC-0107: Implementation Guide

## Overview

This document provides step-by-step implementation details for the Welcome and Loading Modal feature in the Shopping Dashboard.

## Table of Contents

1. [Fetching Server Scope Attributes](#1-fetching-server-scope-attributes)
2. [Device Count Attributes](#2-device-count-attributes)
3. [Loading Modal Component](#3-loading-modal-component)
4. [State Validation](#4-state-validation)
5. [Header Status Icon](#5-header-status-icon)
6. [ContractSummaryTooltip Component](#6-contractsummarytooltip-component)

---

## 1. Fetching Server Scope Attributes

### API Endpoint

All device count attributes are stored in `SERVER_SCOPE` and must be fetched via the ThingsBoard API:

```
GET /api/plugins/telemetry/{entityType}/{entityId}/values/attributes/SERVER_SCOPE
```

### Implementation Pattern

Reference: `src/MYIO-SIM/v5.2.0/MAIN/controller.js` - `fetchInstantaneousPowerLimits()`

```javascript
/**
 * Fetches device count attributes from SERVER_SCOPE
 * @param {string} entityId - The customer entity ID
 * @param {string} entityType - Entity type (default: 'CUSTOMER')
 * @returns {Promise<Object|null>} Device counts object or null on error
 */
async function fetchDeviceCountAttributes(entityId, entityType = 'CUSTOMER') {
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    LogHelper.warn('[RFC-0107] JWT token not found');
    return null;
  }

  const url = `/api/plugins/telemetry/${entityType}/${entityId}/values/attributes/SERVER_SCOPE`;

  try {
    const response = await fetch(url, {
      headers: {
        'X-Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        LogHelper.log(`[RFC-0107] No attributes found for ${entityType} ${entityId}`);
        return null;
      }
      LogHelper.warn(`[RFC-0107] Failed to fetch ${entityType} attributes: ${response.status}`);
      return null;
    }

    const attributes = await response.json();
    LogHelper.log('[RFC-0107] SERVER_SCOPE attributes', attributes);

    return parseDeviceCountAttributes(attributes);
  } catch (error) {
    LogHelper.error('[RFC-0107] Error fetching device counts:', error);
    return null;
  }
}
```

---

## 2. Device Count Attributes

### Attribute Keys to Fetch

| Domain | Attribute Key | Description |
|--------|---------------|-------------|
| **Energy** | `qtDevices3f` | Total energy devices |
| | `qtDevices3f-Entries` | Energy entry devices |
| | `qtDevices3f-CommonArea` | Common area energy devices |
| | `qtDevices3f-Stores` | Store energy devices |
| **Water** | `qtDevicesHidr` | Total water devices |
| | `qtDevicesHidr-Entries` | Water entry devices |
| | `qtDevicesHidr-CommonArea` | Common area water devices |
| | `qtDevicesHidr-Stores` | Store water devices |
| **Temperature** | `qtDevicesTemp` | Total temperature devices |
| | `qtDevicesTemp-Internal` | Climate-controlled devices |
| | `qtDevicesTemp-Stores` | Non-climate-controlled devices |

### Attribute Parser Implementation

```javascript
const DEVICE_COUNT_KEYS = {
  energy: {
    total: 'qtDevices3f',
    entries: 'qtDevices3f-Entries',
    commonArea: 'qtDevices3f-CommonArea',
    stores: 'qtDevices3f-Stores',
  },
  water: {
    total: 'qtDevicesHidr',
    entries: 'qtDevicesHidr-Entries',
    commonArea: 'qtDevicesHidr-CommonArea',
    stores: 'qtDevicesHidr-Stores',
  },
  temperature: {
    total: 'qtDevicesTemp',
    internal: 'qtDevicesTemp-Internal',
    stores: 'qtDevicesTemp-Stores',
  },
};

/**
 * Parses SERVER_SCOPE attributes into device count structure
 * @param {Array} attributes - Raw attributes from API
 * @returns {Object} Parsed device counts
 */
function parseDeviceCountAttributes(attributes) {
  const getAttrValue = (key) => {
    const attr = attributes.find((a) => a.key === key);
    if (!attr) return 0;

    // Handle string or number values
    const value = typeof attr.value === 'string'
      ? parseInt(attr.value, 10)
      : attr.value;

    return isNaN(value) ? 0 : value;
  };

  return {
    energy: {
      total: getAttrValue(DEVICE_COUNT_KEYS.energy.total),
      entries: getAttrValue(DEVICE_COUNT_KEYS.energy.entries),
      commonArea: getAttrValue(DEVICE_COUNT_KEYS.energy.commonArea),
      stores: getAttrValue(DEVICE_COUNT_KEYS.energy.stores),
    },
    water: {
      total: getAttrValue(DEVICE_COUNT_KEYS.water.total),
      entries: getAttrValue(DEVICE_COUNT_KEYS.water.entries),
      commonArea: getAttrValue(DEVICE_COUNT_KEYS.water.commonArea),
      stores: getAttrValue(DEVICE_COUNT_KEYS.water.stores),
    },
    temperature: {
      total: getAttrValue(DEVICE_COUNT_KEYS.temperature.total),
      internal: getAttrValue(DEVICE_COUNT_KEYS.temperature.internal),
      stores: getAttrValue(DEVICE_COUNT_KEYS.temperature.stores),
    },
  };
}
```

---

## 3. Loading Modal Component

### File Location

```
src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js
```

### Reference Pattern

**IMPORTANT:** Reuse the existing modal pattern from `TELEMETRY/controller.js`:

```
src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js
```

### Existing Pattern - ensureBusyModalDOM()

```javascript
const BUSY_ID = 'myio-busy-modal';

function ensureBusyModalDOM() {
  let $m = $root().find(`#${BUSY_ID}`);
  if ($m.length) return $m;

  const html = `
  <div id="${BUSY_ID}" style="
      position:absolute; inset:0; display:none;
      background: rgba(150,132,181,0.45); /* #9684B5 with transparency */
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
  $root().css('position', 'relative'); // ensures correct overlay
  $root().append(html);
  return $root().find(`#${BUSY_ID}`);
}
```

### Existing Pattern - showBusy() with Orchestrator Integration

```javascript
function showBusy(message, timeoutMs = 35000) {
  LogHelper.log(`[RFC-0107] showBusy() called with message: "${message || 'default'}"`);

  // Prevent multiple simultaneous busy calls
  if (window.busyInProgress) {
    LogHelper.log(`[RFC-0107] Skipping duplicate showBusy() call`);
    return;
  }

  window.busyInProgress = true;

  const safeShowBusy = () => {
    try {
      // Prefer centralized orchestrator if available
      if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.showGlobalBusy === 'function') {
        const text = (message && String(message).trim()) || 'Carregando dados...';
        window.MyIOOrchestrator.showGlobalBusy(WIDGET_DOMAIN, text, timeoutMs);
        LogHelper.log(`[RFC-0107] Using centralized busy for domain: ${WIDGET_DOMAIN}`);
      } else {
        // Fallback to local modal
        LogHelper.warn(`[RFC-0107] Orchestrator not available, using fallback busy`);
        const $m = ensureBusyModalDOM();
        const text = (message && String(message).trim()) || 'aguarde.. carregando os dados...';
        $m.find(`#${BUSY_ID}-msg`).text(text);
        $m.css('display', 'flex');
      }
    } catch (err) {
      LogHelper.error(`[RFC-0107] Error in showBusy:`, err);
    } finally {
      setTimeout(() => {
        window.busyInProgress = false;
      }, 500);
    }
  };

  // Check if orchestrator exists and is ready
  const checkOrchestratorReady = async () => {
    if (window.MyIOOrchestrator?.isReady) {
      safeShowBusy();
      return;
    }

    // Wait for orchestrator ready event (with timeout)
    await new Promise((resolve) => {
      let timeout;
      let interval;

      const handler = () => {
        clearTimeout(timeout);
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        resolve(true);
      };

      window.addEventListener('myio:orchestrator:ready', handler);

      timeout = setTimeout(() => {
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        LogHelper.warn('[RFC-0107] Orchestrator ready timeout after 5s, using fallback');
        resolve(false);
      }, 5000);

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
```

### Existing Pattern - hideBusy()

```javascript
function hideBusy() {
  LogHelper.log(`[RFC-0107] hideBusy() called`);

  const safeHideBusy = () => {
    try {
      if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.hideGlobalBusy === 'function') {
        window.MyIOOrchestrator.hideGlobalBusy();
        LogHelper.log(`[RFC-0107] Using centralized hideBusy`);
      } else {
        LogHelper.warn(`[RFC-0107] Orchestrator not available, using fallback hideBusy`);
        $root().find(`#${BUSY_ID}`).css('display', 'none');
      }
    } catch (err) {
      LogHelper.error(`[RFC-0107] Error in hideBusy:`, err);
    } finally {
      window.busyInProgress = false;
    }
  };

  // Similar orchestrator check pattern...
  safeHideBusy();
}
```

---

### RFC-0107 Extended Modal with Contract Loading Details

Building on the existing pattern, extend the modal to show contract loading progress:

```javascript
const CONTRACT_MODAL_ID = 'myio-contract-loading-modal';

function ensureContractModalDOM() {
  let $m = $root().find(`#${CONTRACT_MODAL_ID}`);
  if ($m.length) return $m;

  const html = `
  <div id="${CONTRACT_MODAL_ID}" style="
      position:absolute; inset:0; display:none;
      background: rgba(150,132,181,0.45);
      backdrop-filter: blur(5px);
      z-index:9999; align-items:center; justify-content:center;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;">
    <div style="
        background:#2d1458; color:#fff;
        border:1px solid rgba(255,255,255,0.10);
        box-shadow:0 12px 40px rgba(0,0,0,.35);
        border-radius:18px; padding:28px 32px; min-width:400px; max-width:500px;">

      <!-- Header with spinner -->
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
        <div class="spinner" style="
            width:22px;height:22px;border-radius:50%;
            border:3px solid rgba(255,255,255,.25);
            border-top-color:#ffffff; animation:spin .9s linear infinite;"></div>
        <div id="${CONTRACT_MODAL_ID}-title" style="font-weight:600; font-size:16px; letter-spacing:.2px;">
          Loading Contract...
        </div>
      </div>

      <!-- Domain sections -->
      <div id="${CONTRACT_MODAL_ID}-domains" style="display:flex; flex-direction:column; gap:12px;">

        <!-- Energy -->
        <div class="domain-row" data-domain="energy" style="
            display:flex; align-items:center; justify-content:space-between;
            padding:10px 14px; background:rgba(255,255,255,0.08); border-radius:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">⚡</span>
            <span style="font-weight:500;">Energy</span>
          </div>
          <div class="domain-count" style="font-size:13px; opacity:0.7;">--</div>
        </div>

        <!-- Water -->
        <div class="domain-row" data-domain="water" style="
            display:flex; align-items:center; justify-content:space-between;
            padding:10px 14px; background:rgba(255,255,255,0.08); border-radius:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">💧</span>
            <span style="font-weight:500;">Water</span>
          </div>
          <div class="domain-count" style="font-size:13px; opacity:0.7;">--</div>
        </div>

        <!-- Temperature -->
        <div class="domain-row" data-domain="temperature" style="
            display:flex; align-items:center; justify-content:space-between;
            padding:10px 14px; background:rgba(255,255,255,0.08); border-radius:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">🌡️</span>
            <span style="font-weight:500;">Temperature</span>
          </div>
          <div class="domain-count" style="font-size:13px; opacity:0.7;">--</div>
        </div>
      </div>

      <!-- Validation status -->
      <div id="${CONTRACT_MODAL_ID}-status" style="
          margin-top:16px; padding:10px 14px; border-radius:10px;
          background:rgba(255,255,255,0.05); display:none;">
      </div>
    </div>
  </div>
  <style>
    @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
    #${CONTRACT_MODAL_ID} .domain-row.loaded { background:rgba(76,175,80,0.2); }
    #${CONTRACT_MODAL_ID} .domain-row.loaded .domain-count { opacity:1; color:#81c784; }
  </style>`;

  $root().css('position', 'relative');
  $root().append(html);
  return $root().find(`#${CONTRACT_MODAL_ID}`);
}
```

### Show/Hide Contract Modal

```javascript
function showContractLoadingModal() {
  LogHelper.log('[RFC-0107] showContractLoadingModal()');

  if (window.MyIOOrchestrator?.showGlobalBusy) {
    // Use orchestrator with custom content injection
    window.MyIOOrchestrator.showGlobalBusy('contract', 'Loading Contract...', 60000);
  }

  const $m = ensureContractModalDOM();
  $m.css('display', 'flex');
}

function hideContractLoadingModal() {
  LogHelper.log('[RFC-0107] hideContractLoadingModal()');

  if (window.MyIOOrchestrator?.hideGlobalBusy) {
    window.MyIOOrchestrator.hideGlobalBusy();
  }

  $root().find(`#${CONTRACT_MODAL_ID}`).css('display', 'none');
}

function updateContractModalDomain(domain, count, isLoaded = true) {
  const $row = $root().find(`#${CONTRACT_MODAL_ID} .domain-row[data-domain="${domain}"]`);
  if (!$row.length) return;

  $row.find('.domain-count').text(`${count} devices`);
  if (isLoaded) {
    $row.addClass('loaded');
  }
}

function updateContractModalStatus(isValid, message) {
  const $status = $root().find(`#${CONTRACT_MODAL_ID}-status`);
  $status.css('display', 'block');

  if (isValid) {
    $status.css('background', 'rgba(76,175,80,0.2)');
    $status.html(`<span style="color:#81c784;">✓ ${message || 'Contract validated successfully'}</span>`);
  } else {
    $status.css('background', 'rgba(244,67,54,0.2)');
    $status.html(`<span style="color:#ef5350;">⚠ ${message || 'Validation issues detected'}</span>`);
  }
}
```

### Visual Style Reference

| Property | Value |
|----------|-------|
| Background overlay | `rgba(150,132,181,0.45)` (#9684B5 with transparency) |
| Backdrop filter | `blur(5px)` |
| Modal background | `#2d1458` |
| Text color | `#fff` |
| Border radius | `18px` |
| Box shadow | `0 12px 40px rgba(0,0,0,.35)` |
| Font family | Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif |
| Spinner animation | `spin .9s linear infinite` |

---

## 4. State Validation

### window.STATE Structure Reference

```javascript
window.STATE = {
  energy: {
    lojas: { items: [], total: 0, count: 0 },
    entrada: { items: [], total: 0, count: 0 },
    areacomum: { items: [], total: 0, count: 0 },
    summary: { total: 0, byGroup: {}, percentages: {}, periodKey: '' }
  },
  water: {
    lojas: { items: [], total: 0, count: 0 },
    entrada: { items: [], total: 0, count: 0 },
    areacomum: { items: [], total: 0, count: 0 },
    summary: { total: 0, byGroup: {}, percentages: {}, periodKey: '' }
  },
  temperature: {
    lojas: { items: [], total: 0, count: 0 },
    entrada: { items: [], total: 0, count: 0 },
    areacomum: { items: [], total: 0, count: 0 },
    summary: { total: 0, byGroup: {}, percentages: {}, periodKey: '' }
  }
};
```

### Validation Implementation

```javascript
/**
 * Validates SERVER_SCOPE device counts against window.STATE
 * @param {Object} serverCounts - Counts from SERVER_SCOPE attributes
 * @returns {Object} Validation result with status and discrepancies
 */
function validateDeviceCounts(serverCounts) {
  const state = window.STATE;
  const discrepancies = [];

  // Validate Energy
  if (state?.energy) {
    const stateEnergyTotal =
      (state.energy.lojas?.count || 0) +
      (state.energy.entrada?.count || 0) +
      (state.energy.areacomum?.count || 0);

    if (stateEnergyTotal !== serverCounts.energy.total) {
      discrepancies.push({
        domain: 'energy',
        expected: serverCounts.energy.total,
        actual: stateEnergyTotal,
      });
    }
  }

  // Validate Water
  if (state?.water) {
    const stateWaterTotal =
      (state.water.lojas?.count || 0) +
      (state.water.entrada?.count || 0) +
      (state.water.areacomum?.count || 0);

    if (stateWaterTotal !== serverCounts.water.total) {
      discrepancies.push({
        domain: 'water',
        expected: serverCounts.water.total,
        actual: stateWaterTotal,
      });
    }
  }

  // Validate Temperature
  if (state?.temperature) {
    const stateTempTotal =
      (state.temperature.lojas?.count || 0) +
      (state.temperature.entrada?.count || 0) +
      (state.temperature.areacomum?.count || 0);

    if (stateTempTotal !== serverCounts.temperature.total) {
      discrepancies.push({
        domain: 'temperature',
        expected: serverCounts.temperature.total,
        actual: stateTempTotal,
      });
    }
  }

  return {
    isValid: discrepancies.length === 0,
    discrepancies,
  };
}
```

---

## 5. Header Status Icon & window.CONTRACT_STATE

### Global State Storage

The MAIN widget stores contract data in `window.CONTRACT_STATE` for access by the HEADER widget:

```javascript
/**
 * Global contract state - stored in MAIN, accessed by HEADER
 * @type {Object}
 */
window.CONTRACT_STATE = {
  isLoaded: false,
  isValid: false,
  timestamp: null,
  energy: {
    total: 0,
    entries: 0,      // qtDevices3f-Entries
    commonArea: 0,   // qtDevices3f-CommonArea
    stores: 0        // qtDevices3f-Stores
  },
  water: {
    total: 0,
    entries: 0,      // qtDevicesHidr-Entries
    commonArea: 0,   // qtDevicesHidr-CommonArea
    stores: 0        // qtDevicesHidr-Stores
  },
  temperature: {
    total: 0,
    internal: 0,     // qtDevicesTemp-Internal (climate-controlled)
    stores: 0        // qtDevicesTemp-Stores (non-climate-controlled)
  }
};
```

### MAIN Widget - Storing Contract State

```javascript
// In MAIN_VIEW/controller.js - after loading contract data
function storeContractState(deviceCounts, validationResult) {
  window.CONTRACT_STATE = {
    isLoaded: true,
    isValid: validationResult.isValid,
    timestamp: new Date().toISOString(),
    energy: {
      total: deviceCounts.energy.total,
      entries: deviceCounts.energy.entries,
      commonArea: deviceCounts.energy.commonArea,
      stores: deviceCounts.energy.stores
    },
    water: {
      total: deviceCounts.water.total,
      entries: deviceCounts.water.entries,
      commonArea: deviceCounts.water.commonArea,
      stores: deviceCounts.water.stores
    },
    temperature: {
      total: deviceCounts.temperature.total,
      internal: deviceCounts.temperature.internal,
      stores: deviceCounts.temperature.stores
    }
  };

  // Dispatch event for HEADER to listen
  window.dispatchEvent(new CustomEvent('myio:contract:loaded', {
    detail: window.CONTRACT_STATE
  }));

  LogHelper.log('[RFC-0107] CONTRACT_STATE stored:', window.CONTRACT_STATE);
}
```

### File Location

```
src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/controller.js
```

### HEADER Widget - Reading Contract State

```javascript
/**
 * Initialize contract status icon in HEADER
 * Reads from window.CONTRACT_STATE set by MAIN widget
 */
function initContractStatusIcon() {
  // Listen for contract loaded event from MAIN
  window.addEventListener('myio:contract:loaded', (event) => {
    const state = event.detail;
    renderContractStatusIcon(state);
  });

  // Check if already loaded (page refresh scenario)
  if (window.CONTRACT_STATE?.isLoaded) {
    renderContractStatusIcon(window.CONTRACT_STATE);
  }
}

/**
 * Renders the contract status icon in header
 * @param {Object} contractState - The CONTRACT_STATE object
 */
function renderContractStatusIcon(contractState) {
  const headerContainer = document.querySelector('.myio-header-actions');
  if (!headerContainer) {
    LogHelper.warn('[RFC-0107] Header actions container not found');
    return;
  }

  // Remove existing icon if present
  const existingIcon = document.getElementById('rfc0107-contract-status');
  if (existingIcon) {
    existingIcon.remove();
  }

  const totalDevices =
    contractState.energy.total +
    contractState.water.total +
    contractState.temperature.total;

  const statusIcon = document.createElement('div');
  statusIcon.id = 'rfc0107-contract-status';
  statusIcon.className = 'rfc0107-contract-icon';
  statusIcon.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(45, 20, 88, 0.95);
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid rgba(255,255,255,0.1);
  `;

  const iconClass = contractState.isValid ? 'success' : 'error';
  const iconSymbol = contractState.isValid ? '✓' : '!';
  const iconColor = contractState.isValid ? '#81c784' : '#ef5350';
  const statusText = contractState.isValid
    ? `${totalDevices} devices`
    : 'Validation Error';

  statusIcon.innerHTML = `
    <div style="
      width: 24px; height: 24px; border-radius: 50%;
      background: ${contractState.isValid ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'};
      display: flex; align-items: center; justify-content: center;
      color: ${iconColor}; font-size: 12px; font-weight: bold;">
      ${iconSymbol}
    </div>
    <div style="font-size: 12px; color: white;">
      ${statusText}
    </div>
  `;

  // Setup tooltip on click
  statusIcon.addEventListener('click', () => {
    showContractSummaryTooltip(statusIcon, contractState);
  });

  headerContainer.appendChild(statusIcon);
}
```

### ContractSummaryTooltip with Detailed Breakdown

```javascript
/**
 * Shows detailed contract summary tooltip
 * @param {HTMLElement} anchor - The anchor element
 * @param {Object} contractState - The CONTRACT_STATE object
 */
function showContractSummaryTooltip(anchor, contractState) {
  // Remove existing tooltip
  const existing = document.getElementById('rfc0107-contract-tooltip');
  if (existing) existing.remove();

  const tooltip = document.createElement('div');
  tooltip.id = 'rfc0107-contract-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    background: #2d1458;
    color: white;
    border-radius: 12px;
    padding: 16px;
    min-width: 280px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 10000;
    font-size: 13px;
  `;

  tooltip.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
      <span>${contractState.isValid ? '✓' : '⚠'}</span>
      Contract Summary
    </div>

    <!-- Energy Section -->
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span>⚡ Energy</span>
        <span style="color: #81c784;">${contractState.energy.total} devices</span>
      </div>
      <div style="padding-left: 20px; font-size: 12px; opacity: 0.8;">
        <div style="display: flex; justify-content: space-between;">
          <span>Entries</span><span>${contractState.energy.entries}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Common Area</span><span>${contractState.energy.commonArea}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Stores</span><span>${contractState.energy.stores}</span>
        </div>
      </div>
    </div>

    <!-- Water Section -->
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span>💧 Water</span>
        <span style="color: #81c784;">${contractState.water.total} devices</span>
      </div>
      <div style="padding-left: 20px; font-size: 12px; opacity: 0.8;">
        <div style="display: flex; justify-content: space-between;">
          <span>Entries</span><span>${contractState.water.entries}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Common Area</span><span>${contractState.water.commonArea}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Stores</span><span>${contractState.water.stores}</span>
        </div>
      </div>
    </div>

    <!-- Temperature Section -->
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span>🌡️ Temperature</span>
        <span style="color: #81c784;">${contractState.temperature.total} devices</span>
      </div>
      <div style="padding-left: 20px; font-size: 12px; opacity: 0.8;">
        <div style="display: flex; justify-content: space-between;">
          <span>Internal (Climate)</span><span>${contractState.temperature.internal}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Stores (Non-Climate)</span><span>${contractState.temperature.stores}</span>
        </div>
      </div>
    </div>

    <!-- Timestamp -->
    <div style="font-size: 11px; opacity: 0.6; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
      Loaded: ${new Date(contractState.timestamp).toLocaleString()}
    </div>
  `;

  // Position tooltip
  const rect = anchor.getBoundingClientRect();
  tooltip.style.top = `${rect.bottom + 8}px`;
  tooltip.style.right = `${window.innerWidth - rect.right}px`;

  document.body.appendChild(tooltip);

  // Close on click outside
  const closeHandler = (e) => {
    if (!tooltip.contains(e.target) && !anchor.contains(e.target)) {
      tooltip.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 100);
}
```

---

## 6. ContractSummaryTooltip Component

### Library Component Location

```
src/utils/ContractSummaryTooltip.ts
```

### Export in index.ts

```typescript
// RFC-0107: Contract Summary Tooltip (Shopping Dashboard contract status)
export { ContractSummaryTooltip } from './utils/ContractSummaryTooltip';
export type { ContractSummaryData, ContractDomainCounts, ContractTemperatureCounts } from './utils/ContractSummaryTooltip';
```

### Features

Following the pattern from `TempComparisonTooltip.ts`:

| Feature | Description |
|---------|-------------|
| Draggable Header | Move tooltip by dragging header |
| PIN Button | Creates independent clone fixed on screen |
| Maximize/Restore | Expand tooltip to full screen |
| Close Button | Close tooltip |
| Delayed Hide (1.5s) | Hover detection prevents premature hide |
| Dark Theme | Consistent with #2d1458 shopping dashboard theme |
| Domain Expansion | Click domain headers to expand/collapse details |

### Type Definitions

```typescript
export interface ContractDomainCounts {
  total: number;
  entries: number;      // qtDevices3f-Entries / qtDevicesHidr-Entries
  commonArea: number;   // qtDevices3f-CommonArea / qtDevicesHidr-CommonArea
  stores: number;       // qtDevices3f-Stores / qtDevicesHidr-Stores
}

export interface ContractTemperatureCounts {
  total: number;
  internal: number;     // qtDevicesTemp-Internal (climate-controlled)
  stores: number;       // qtDevicesTemp-Stores (non-climate-controlled)
}

export interface ContractSummaryData {
  isLoaded: boolean;
  isValid: boolean;
  timestamp: string | null;
  energy: ContractDomainCounts;
  water: ContractDomainCounts;
  temperature: ContractTemperatureCounts;
  discrepancies?: Array<{
    domain: string;
    expected: number;
    actual: number;
  }>;
}
```

### Usage in HEADER Widget

```javascript
// Access from MyIOLibrary
const ContractSummaryTooltip = window.MyIOLibrary?.ContractSummaryTooltip;

// Attach to header status icon (click to show)
const cleanup = ContractSummaryTooltip.attach(
  statusIconElement,
  () => ContractSummaryTooltip.buildFromGlobalState()
);

// Or attach with hover behavior
const cleanup = ContractSummaryTooltip.attachHover(
  statusIconElement,
  () => window.CONTRACT_STATE
);

// Manual show
ContractSummaryTooltip.show(anchorElement, {
  isLoaded: true,
  isValid: true,
  timestamp: new Date().toISOString(),
  energy: { total: 20, entries: 3, commonArea: 5, stores: 12 },
  water: { total: 13, entries: 2, commonArea: 3, stores: 8 },
  temperature: { total: 10, internal: 6, stores: 4 }
});

// Hide
ContractSummaryTooltip.hide();

// Close and reset all states
ContractSummaryTooltip.close();
```

### Helper Method - Build from Global State

```javascript
// Reads from window.CONTRACT_STATE automatically
const data = ContractSummaryTooltip.buildFromGlobalState();
if (data) {
  ContractSummaryTooltip.show(element, data);
}
```

---

## 7. Showcase - Contract Loading Modal

### File Location

```
showcase/contract-loading-modal.html
```

### Purpose

Interactive demonstration page to:
- Visualize the loading modal appearance
- Test different loading states (loading, loaded, error)
- Simulate device count updates per domain
- Validate the visual style consistency with existing modals

### Showcase Features

| Feature | Description |
|---------|-------------|
| Modal Preview | Interactive preview of the contract loading modal |
| State Simulation | Buttons to simulate loading, loaded, and error states |
| Domain Progress | Simulate individual domain loading progress |
| Validation Status | Test valid/invalid contract scenarios |
| Dark Theme | Preview in the actual dark theme (#2d1458) |

### Usage in Development

```javascript
// Simulate loading flow
function simulateContractLoading() {
  showContractLoadingModal();

  // Simulate energy loading after 1s
  setTimeout(() => {
    updateContractModalDomain('energy', 15, true);
  }, 1000);

  // Simulate water loading after 2s
  setTimeout(() => {
    updateContractModalDomain('water', 8, true);
  }, 2000);

  // Simulate temperature loading after 3s
  setTimeout(() => {
    updateContractModalDomain('temperature', 12, true);
  }, 3000);

  // Show validation status after 3.5s
  setTimeout(() => {
    updateContractModalStatus(true, 'All 35 devices loaded successfully');
  }, 3500);

  // Hide modal after 5s
  setTimeout(() => {
    hideContractLoadingModal();
  }, 5000);
}
```

### Showcase Interactive Features

The showcase page (`showcase/contract-loading-modal.html`) provides:

1. **Interactive Demo Area**
   - Show/Hide modal buttons
   - Simulate full load with progress animation
   - Simulate error scenarios

2. **Domain Controls**
   - Manual device count inputs per domain
   - Individual domain update buttons
   - Success/Error status toggles
   - Reset all button

3. **Event Log Panel**
   - Real-time logging of all modal events
   - Timestamped entries
   - Color-coded by event type (info, success, error)

4. **API Reference Table**
   - All available functions documented
   - Parameters and descriptions
   - Code examples

5. **Style Reference Table**
   - All visual tokens used
   - Color values with usage context

### Opening the Showcase

```bash
# From project root, open in browser:
start showcase/contract-loading-modal.html

# Or serve via local server:
npx serve showcase
```

---

## Implementation Checklist

- [ ] Create `fetchDeviceCountAttributes()` function in MAIN_VIEW controller
- [ ] Implement `parseDeviceCountAttributes()` helper
- [ ] Create loading modal HTML structure
- [ ] Add modal CSS styles
- [ ] Implement `validateDeviceCounts()` function
- [ ] Add contract status icon to HEADER widget
- [ ] Create `ContractSummaryTooltip` class
- [ ] Register tooltip in `window.MyIOLibrary`
- [ ] Add modal show/hide lifecycle management
- [ ] Test validation against `window.STATE`
- [ ] Handle edge cases (missing attributes, API errors)
- [ ] **Create showcase page** `showcase/contract-loading-modal.html`
- [ ] **Add showcase to index.html** portal

---

## File Changes Summary

| File | Changes |
|------|---------|
| `MAIN_VIEW/controller.js` | Add modal, fetch attributes, validation logic |
| `HEADER/controller.js` | Add contract status icon |
| `src/components/premium-tooltips/` | Add ContractSummaryTooltip component |
| `showcase/contract-loading-modal.html` | New showcase page |
| `showcase/index.html` | Add link to new showcase |
