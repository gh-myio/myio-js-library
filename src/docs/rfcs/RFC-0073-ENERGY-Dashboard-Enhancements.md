# RFC-0073: ENERGY Widget – Dashboard Functionality and UX Enhancements

- **Feature Name**: `energy-dashboard-enhancements`
- **Start Date**: 2025-01-10
- **RFC PR**: #0073
- **Status**: Proposed
- **Component**: `MYIO-SIM/V1.0.0/ENERGY`

## Summary

This RFC enhances the ENERGY widget by enabling accurate 7-day consumption visualization, introducing a configuration modal, refining percentage insights, improving layout stability, fixing classification logic, and ensuring shopping filter consistency across all energy metrics.

## Motivation

The ENERGY widget is a critical component for energy monitoring and analysis, but currently has several functional and UX limitations:

1. **Broken 7-Day Chart**: The consumption chart for the last 7 days doesn't fetch data from the `/totals` API endpoint correctly
2. **Limited Chart Configuration**: Users cannot customize the chart period, equipment type filter, or view multiple series
3. **Missing Context on Cards**: The "Consumo Total Lojas" card doesn't show percentage breakdown (Lojas vs. Equipamentos)
4. **Layout Issues at 100% Zoom**: Distribution chart gets cut off and 7-day chart takes more than 50% of available space
5. **Incorrect Device Classification**: Equipment distribution doesn't properly handle 3F_MEDIDOR devices with deviceProfile metadata
6. **Peak Demand Not Filtered**: Peak demand card ignores shopping filters and always shows data for all shoppings

These issues were observed during QA of MYIO-SIM/V1.0.0/ENERGY, where discrepancies were found between UI behavior and API data retrieved from the `/totals` endpoint of the ThingsBoard integration.

These issues limit the widget's usefulness for energy analysis and decision-making.

## Guide-level Explanation

### Problem 1: 7-Day Consumption Chart Not Working

**Current Behavior:**
The chart displays mock data or fails to load, not reflecting actual consumption from the API.

**Expected Behavior:**
```
Consumo dos últimos 7 dias
┌─────────────────────────────────────────┐
│  4000 kWh ┤                      ●      │
│           │                   ●  │      │
│  3000 kWh ┤              ●    │  │      │
│           │         ●    │    │  │      │
│  2000 kWh ┤    ●    │    │    │  │      │
│           │  ● │    │    │    │  │      │
│  1000 kWh ┤  │ │    │    │    │  │      │
│           └──┴─┴────┴────┴────┴──┴──────│
│            D1 D2  D3  D4  D5  D6  D7     │
└─────────────────────────────────────────┘
Shoppings: Mestre Álvaro, Vila Velha [⚙️]
```

The chart should:
- Fetch `/totals` API for each of the last 7 days
- Respect active shopping filters (default: all shoppings)
- Show which shoppings are included in the data
- Provide a settings button (⚙️) to open advanced configuration

### Problem 2: Advanced Chart Configuration Modal

Users need a "premium" modal to customize the chart, similar to the distribution selector but more comprehensive.

**Proposed Modal:**
```
┌─────────────────────────────────────────┐
│  Configurações do Gráfico              ×│
├─────────────────────────────────────────┤
│  Período:                                │
│  ● Últimos 7 dias                        │
│  ○ Últimos 14 dias                       │
│  ○ Último mês                            │
│  ○ Personalizado: [__/__/__] a [__/__/__│
│                                          │
│  Tipo de Equipamento:                    │
│  ☐ Todos (Total)                         │
│  ☐ Elevadores                            │
│  ☐ Escadas Rolantes                      │
│  ☐ Climatização                          │
│  ☐ Outros Equipamentos                   │
│  ☐ Lojas                                 │
│                                          │
│  Visualização:                           │
│  ● Série única (total)                   │
│  ○ Múltiplas séries (comparar tipos)     │
│                                          │
│         [Cancelar]  [Aplicar]            │
└─────────────────────────────────────────┘
```

### Problem 3: Percentage Labels on "Consumo Total Lojas"

**Current Display:**
```
┌─────────────────────────┐
│ Consumo Total Lojas     │
│ 2,345 kWh              │
│ ↑ 12.5% vs período ant.│
└─────────────────────────┘
```

**Proposed Display:**
```
┌─────────────────────────┐
│ Consumo Total Lojas     │
│ 2,345 kWh (41.9%)      │
│ Equipamentos: 58.1%     │
│ ↑ 12.5% vs período ant.│
└─────────────────────────┘
```

### Problem 4: Layout Issues at 100% Zoom

**Current Problem:**
At 100% zoom, the two-column layout breaks with the 7-day chart taking >50% width and distribution chart being cut off.

**Solution:**
Adjust grid template to use `minmax()` and proper flex ratios.

### Problem 5: Device Classification in Distribution

Equipment type detection should follow this logic:

```
Is deviceType == "ELEVADOR"? → Elevadores
  NO ↓
Is deviceType == "3F_MEDIDOR"?
  YES → Check deviceProfile
    Is deviceProfile == "ELEVADOR"? → Elevadores
    Is deviceProfile == "ESCADA_ROLANTE"? → Escadas Rolantes
    Is deviceProfile in HVAC types? → Climatização
    Otherwise → In lojasIngestionIds? → Lojas : Outros Equipamentos
  NO ↓
Check deviceType directly for classification
```

### Problem 6: Peak Demand Filtering

Peak demand API call must respect shopping filters:

```javascript
// Current: ignores filter
const peakData = await fetchCustomerPeakDemand(customerId, startTs, endTs);

// Proposed: respects filter
const selectedShoppingIds = getSelectedShoppingIds();
const peakData = await fetchFilteredPeakDemand(
  selectedShoppingIds.length > 0 ? selectedShoppingIds : [customerId],
  startTs,
  endTs
);
```

## Reference-level Explanation

### Implementation Details

All changes are located under:
`C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\ENERGY`

#### 1. Fix 7-Day Consumption Chart with API Integration

**Location:** `src/MYIO-SIM/V1.0.0/ENERGY/controller.js`

**Current Implementation (Non-functional):**
```javascript
async function fetch7DaysConsumption(customerId) {
  // Returns mock data or fails
  return [
    { date: '01/01', consumption: 1200 },
    // ...
  ];
}
```

**Proposed Implementation:**

```javascript
/**
 * Fetches daily consumption for the last N days
 * Calls /totals API for each day individually
 * Respects active shopping filter
 *
 * @param {number} days - Number of days to fetch (default: 7)
 * @param {Array<string>} equipmentTypes - Filter by equipment types (optional)
 * @returns {Promise<Array>} Array of {date, consumption, details}
 */
async function fetchDailyConsumption(days = 7, equipmentTypes = []) {
  console.log(`[ENERGY] Fetching ${days} days of consumption data`);

  const token = localStorage.getItem('jwt_token');
  if (!token) {
    console.error("[ENERGY] JWT token not found");
    return [];
  }

  // Get selected shopping IDs from filter
  const selectedShoppingIds = getSelectedShoppingIds();
  const customerIds = selectedShoppingIds.length > 0
    ? selectedShoppingIds
    : [self.ctx.settings?.customerId]; // Fallback to all

  console.log(`[ENERGY] Fetching data for ${customerIds.length} shopping(s)`);

  const results = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const startTs = date.getTime();
    const endTs = date.getTime() + (24 * 60 * 60 * 1000) - 1; // End of day

    try {
      // Fetch consumption for this day
      const dayData = await fetchDayConsumptionForShoppings(
        customerIds,
        startTs,
        endTs,
        equipmentTypes
      );

      results.push({
        date: formatDate(date),
        fullDate: date.toISOString(),
        consumption: dayData.total,
        byType: dayData.byType,
        deviceCount: dayData.deviceCount
      });

      console.log(`[ENERGY] Day ${i + 1}/${days}: ${dayData.total.toFixed(2)} kWh`);

    } catch (error) {
      console.error(`[ENERGY] Error fetching day ${i}:`, error);
      results.push({
        date: formatDate(date),
        fullDate: date.toISOString(),
        consumption: 0,
        error: true
      });
    }

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[ENERGY] Fetched ${results.length} days successfully`);
  return results;
}

/**
 * Fetches consumption for multiple shoppings for a specific day
 *
 * @param {Array<string>} customerIds - Shopping IDs to fetch
 * @param {number} startTs - Start timestamp
 * @param {number} endTs - End timestamp
 * @param {Array<string>} equipmentTypes - Optional equipment type filter
 * @returns {Promise<Object>} {total, byType, deviceCount}
 */
async function fetchDayConsumptionForShoppings(
  customerIds,
  startTs,
  endTs,
  equipmentTypes = []
) {
  const token = localStorage.getItem('jwt_token');

  // Fetch data for all customer IDs in parallel
  const promises = customerIds.map(async (customerId) => {
    const url = `/api/v1/telemetry/customers/${customerId}/energy/devices/totals?startTime=${startTs}&endTime=${endTs}`;

    const response = await fetch(url, {
      headers: {
        "X-Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[ENERGY] Failed to fetch for customer ${customerId}: ${response.status}`);
      return { devices: [], customerId };
    }

    const data = await response.json();
    return { devices: data || [], customerId };
  });

  const results = await Promise.all(promises);

  // Aggregate consumption across all shoppings
  let total = 0;
  let deviceCount = 0;
  const byType = {
    Elevadores: 0,
    "Escadas Rolantes": 0,
    Climatização: 0,
    "Outros Equipamentos": 0,
    Lojas: 0
  };

  // Get lojas IDs from orchestrator
  const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
  const lojasIngestionIds = orchestrator?.getLojasIngestionIds?.() || new Set();

  results.forEach(({ devices, customerId }) => {
    devices.forEach(device => {
      const consumption = Number(device.total_value) || 0;

      // Classify device
      let deviceType = (device.deviceType || "").toUpperCase();
      const deviceProfile = (device.deviceProfile || device.device_profile || "").toUpperCase();

      // Apply 3F_MEDIDOR + deviceProfile rule
      if (deviceType === "3F_MEDIDOR" && deviceProfile && deviceProfile !== "N/D") {
        deviceType = deviceProfile;
      }

      // Determine category
      let category;
      if (lojasIngestionIds.has(device.id)) {
        category = "Lojas";
      } else {
        category = classifyDeviceType(deviceType);
      }

      // Apply equipment type filter if specified
      if (equipmentTypes.length > 0 && !equipmentTypes.includes(category)) {
        return; // Skip this device
      }

      total += consumption;
      byType[category] = (byType[category] || 0) + consumption;
      deviceCount++;
    });
  });

  return { total, byType, deviceCount };
}

/**
 * Classifies device type into chart categories
 */
function classifyDeviceType(deviceType) {
  if (deviceType === "ELEVADOR" || deviceType === "ELEVATOR") {
    return "Elevadores";
  }
  if (deviceType === "ESCADA_ROLANTE" || deviceType === "ESCALATOR") {
    return "Escadas Rolantes";
  }
  const hvacTypes = ["CHILLER", "AR_CONDICIONADO", "AC", "HVAC", "FANCOIL", "CAG"];
  if (hvacTypes.includes(deviceType)) {
    return "Climatização";
  }
  return "Outros Equipamentos";
}

/**
 * Formats date for chart label (DD/MM format)
 */
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/**
 * Gets selected shopping IDs from filter state
 */
function getSelectedShoppingIds() {
  // Check global filter state
  if (window.custumersSelected && Array.isArray(window.custumersSelected)) {
    return window.custumersSelected.map(c => c.value).filter(Boolean);
  }
  return [];
}
```

**Update Chart Rendering:**

```javascript
async function updateLineChart(days = 7, equipmentTypes = []) {
  try {
    console.log("[ENERGY] Updating line chart...");

    // Fetch consumption data
    const consumptionData = await fetchDailyConsumption(days, equipmentTypes);

    if (!lineChartInstance) {
      console.error("[ENERGY] Line chart instance not found");
      return;
    }

    // Update chart data
    lineChartInstance.data.labels = consumptionData.map(d => d.date);
    lineChartInstance.data.datasets[0].data = consumptionData.map(d => d.consumption);

    // Update label to reflect filter
    let label = "Consumo Total";
    if (equipmentTypes.length > 0) {
      label = equipmentTypes.join(", ");
    }
    lineChartInstance.data.datasets[0].label = label;

    lineChartInstance.update();

    console.log("[ENERGY] Line chart updated successfully");

    // Update shopping filter label
    updateChartFilterLabel();

  } catch (error) {
    console.error("[ENERGY] Error updating line chart:", error);
  }
}

/**
 * Updates the label showing which shoppings are included in the chart
 */
function updateChartFilterLabel() {
  const labelEl = document.getElementById("chart-filter-label");
  if (!labelEl) return;

  const selectedShoppingIds = getSelectedShoppingIds();

  if (selectedShoppingIds.length === 0) {
    labelEl.textContent = "Shoppings: Todos";
  } else {
    const names = selectedShoppingIds.map(id => getShoppingName(id));
    labelEl.textContent = `Shoppings: ${names.join(", ")}`;
  }
}
```

**Template Update:**

Add label and settings button to chart:

```html
<!-- src/MYIO-SIM/V1.0.0/ENERGY/template.html -->

<div class="chart-box">
  <div class="chart-header">
    <h4>Consumo dos últimos 7 dias</h4>
    <div class="chart-controls">
      <span id="chart-filter-label" class="filter-label">Shoppings: Todos</span>
      <button id="chart-settings-btn" class="settings-btn" title="Configurações do gráfico">
        ⚙️
      </button>
    </div>
  </div>
  <canvas id="lineChart"></canvas>
</div>
```

#### 2. Advanced Chart Configuration Modal

**Modal Component:**

```javascript
/**
 * Opens advanced chart configuration modal
 */
function openChartConfigModal() {
  console.log("[ENERGY] Opening chart configuration modal");

  // Create modal backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 9998;
  `;

  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'chart-config-modal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  `;

  // Get current configuration
  const currentConfig = getChartConfiguration();

  // Build modal HTML
  modal.innerHTML = `
    <div class="modal-header">
      <h3 style="margin: 0;">Configurações do Gráfico</h3>
      <button class="close-btn" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
    </div>

    <div class="modal-body" style="margin-top: 20px;">
      <!-- Period Selection -->
      <div class="form-group">
        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Período:</label>
        <label style="display: block; margin-bottom: 8px;">
          <input type="radio" name="period" value="7" ${currentConfig.days === 7 ? 'checked' : ''}>
          Últimos 7 dias
        </label>
        <label style="display: block; margin-bottom: 8px;">
          <input type="radio" name="period" value="14" ${currentConfig.days === 14 ? 'checked' : ''}>
          Últimos 14 dias
        </label>
        <label style="display: block; margin-bottom: 8px;">
          <input type="radio" name="period" value="30" ${currentConfig.days === 30 ? 'checked' : ''}>
          Último mês (30 dias)
        </label>
        <label style="display: block; margin-bottom: 8px;">
          <input type="radio" name="period" value="custom" ${currentConfig.days === 'custom' ? 'checked' : ''}>
          Personalizado
        </label>
        <div id="custom-period" style="display: ${currentConfig.days === 'custom' ? 'block' : 'none'}; margin-left: 24px;">
          <input type="date" id="start-date" value="${currentConfig.startDate || ''}">
          a
          <input type="date" id="end-date" value="${currentConfig.endDate || ''}">
        </div>
      </div>

      <!-- Equipment Type Filter -->
      <div class="form-group" style="margin-top: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tipo de Equipamento:</label>
        <label style="display: block; margin-bottom: 8px;">
          <input type="checkbox" name="equipment-type" value="all" ${currentConfig.types.length === 0 ? 'checked' : ''}>
          Todos (Total)
        </label>
        <label style="display: block; margin-bottom: 8px;">
          <input type="checkbox" name="equipment-type" value="Elevadores" ${currentConfig.types.includes('Elevadores') ? 'checked' : ''}>
          Elevadores
        </label>
        <label style="display: block; margin-bottom: 8px;">
          <input type="checkbox" name="equipment-type" value="Escadas Rolantes" ${currentConfig.types.includes('Escadas Rolantes') ? 'checked' : ''}>
          Escadas Rolantes
        </label>
        <label style="display: block; margin-bottom: 8px;">
          <input type="checkbox" name="equipment-type" value="Climatização" ${currentConfig.types.includes('Climatização') ? 'checked' : ''}>
          Climatização
        </label>
        <label style="display: block; margin-bottom: 8px;">
          <input type="checkbox" name="equipment-type" value="Outros Equipamentos" ${currentConfig.types.includes('Outros Equipamentos') ? 'checked' : ''}>
          Outros Equipamentos
        </label>
        <label style="display: block; margin-bottom: 8px;">
          <input type="checkbox" name="equipment-type" value="Lojas" ${currentConfig.types.includes('Lojas') ? 'checked' : ''}>
          Lojas
        </label>
      </div>

      <!-- Visualization Mode -->
      <div class="form-group" style="margin-top: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Visualização:</label>
        <label style="display: block; margin-bottom: 8px;">
          <input type="radio" name="visualization" value="single" ${!currentConfig.multiSeries ? 'checked' : ''}>
          Série única (total somado)
        </label>
        <label style="display: block; margin-bottom: 8px;">
          <input type="radio" name="visualization" value="multiple" ${currentConfig.multiSeries ? 'checked' : ''}>
          Múltiplas séries (comparar tipos)
        </label>
      </div>
    </div>

    <div class="modal-footer" style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
      <button id="cancel-btn" style="padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 6px; cursor: pointer;">
        Cancelar
      </button>
      <button id="apply-btn" style="padding: 8px 16px; border: none; background: #2563eb; color: white; border-radius: 6px; cursor: pointer;">
        Aplicar
      </button>
    </div>
  `;

  // Append to body
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  // Event handlers
  modal.querySelector('.close-btn').addEventListener('click', closeModal);
  modal.querySelector('#cancel-btn').addEventListener('click', closeModal);

  // Show/hide custom period inputs
  modal.querySelectorAll('input[name="period"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const customPeriod = modal.querySelector('#custom-period');
      customPeriod.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
  });

  // Handle "All" checkbox
  const allCheckbox = modal.querySelector('input[value="all"]');
  const typeCheckboxes = modal.querySelectorAll('input[name="equipment-type"]:not([value="all"])');

  allCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      typeCheckboxes.forEach(cb => cb.checked = false);
    }
  });

  typeCheckboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked) {
        allCheckbox.checked = false;
      }
    });
  });

  // Apply button
  modal.querySelector('#apply-btn').addEventListener('click', () => {
    const config = extractConfiguration(modal);
    applyChartConfiguration(config);
    closeModal();
  });

  function closeModal() {
    backdrop.remove();
    modal.remove();
  }
}

/**
 * Extracts configuration from modal form
 */
function extractConfiguration(modal) {
  const period = modal.querySelector('input[name="period"]:checked').value;

  let days;
  let startDate = null;
  let endDate = null;

  if (period === 'custom') {
    startDate = modal.querySelector('#start-date').value;
    endDate = modal.querySelector('#end-date').value;
    days = 'custom';
  } else {
    days = parseInt(period);
  }

  // Get selected equipment types
  const types = [];
  const typeCheckboxes = modal.querySelectorAll('input[name="equipment-type"]:checked:not([value="all"])');
  typeCheckboxes.forEach(cb => {
    types.push(cb.value);
  });

  const visualization = modal.querySelector('input[name="visualization"]:checked').value;

  return {
    days,
    startDate,
    endDate,
    types,
    multiSeries: visualization === 'multiple'
  };
}

/**
 * Applies configuration and updates chart
 */
async function applyChartConfiguration(config) {
  console.log("[ENERGY] Applying chart configuration:", config);

  // Save configuration
  saveChartConfiguration(config);

  // Update chart based on configuration
  if (config.multiSeries && config.types.length > 0) {
    await updateLineChartMultiSeries(config.days, config.types);
  } else {
    await updateLineChart(config.days, config.types);
  }
}

/**
 * Gets current chart configuration
 */
function getChartConfiguration() {
  const stored = localStorage.getItem('energy-chart-config');
  if (stored) {
    return JSON.parse(stored);
  }

  // Default configuration
  return {
    days: 7,
    types: [],
    multiSeries: false
  };
}

/**
 * Saves chart configuration
 */
function saveChartConfiguration(config) {
  localStorage.setItem('energy-chart-config', JSON.stringify(config));
}
```

**Wire up settings button:**

```javascript
// In onInit function
const chartSettingsBtn = document.getElementById('chart-settings-btn');
if (chartSettingsBtn) {
  chartSettingsBtn.addEventListener('click', openChartConfigModal);
}
```

#### 3. Add Percentage Labels to "Consumo Total Lojas" Card

**Update Card Rendering:**

```javascript
/**
 * Updates the "Consumo Total Lojas" card with percentage breakdown
 */
function updateTotalConsumptionCard(summary) {
  console.log("[ENERGY] Updating consumption card with percentages:", summary);

  if (!summary) return;

  const valueEl = document.getElementById("total-consumption-value");
  const trendEl = document.getElementById("total-consumption-trend");
  const infoEl = document.getElementById("total-consumption-info");

  // Calculate percentages
  const totalConsumption = summary.customerTotal || 0;
  const lojasConsumption = summary.lojasTotal || 0;
  const equipmentsConsumption = summary.equipmentsTotal || 0;

  const lojasPercent = totalConsumption > 0
    ? ((lojasConsumption / totalConsumption) * 100).toFixed(1)
    : 0;

  const equipmentsPercent = totalConsumption > 0
    ? ((equipmentsConsumption / totalConsumption) * 100).toFixed(1)
    : 0;

  // Format values
  const lojasFormatted = MyIOLibrary.formatEnergy(lojasConsumption);
  const equipmentsFormatted = MyIOLibrary.formatEnergy(equipmentsConsumption);

  // Update card
  if (valueEl) {
    valueEl.innerHTML = `
      ${lojasFormatted}
      <span style="font-size: 0.8em; color: #6b7a90; margin-left: 8px;">(${lojasPercent}%)</span>
    `;
  }

  if (infoEl) {
    infoEl.innerHTML = `
      <div style="margin-top: 8px; font-size: 12px; color: #6b7a90;">
        <div>Lojas: ${lojasPercent}% do total</div>
        <div>Equipamentos: ${equipmentsPercent}% (${equipmentsFormatted})</div>
      </div>
    `;
  }

  // Update trend (if available)
  if (trendEl && summary.trend) {
    const trendValue = summary.trend.value || 0;
    const trendDirection = trendValue >= 0 ? 'up' : 'down';
    const trendClass = trendValue > 0 ? 'trend up' : 'trend down';

    trendEl.className = trendClass;
    trendEl.textContent = `${trendDirection === 'up' ? '↑' : '↓'} ${Math.abs(trendValue).toFixed(1)}% vs período anterior`;
  }
}
```

**Template Update:**

```html
<!-- src/MYIO-SIM/V1.0.0/ENERGY/template.html -->

<div class="card" id="total-consumption-card">
  <p class="label">Consumo Total Lojas</p>
  <h3 class="value" id="total-consumption-value">
    <svg class="loading-spinner" style="width:24px; height:24px; animation: spin 1s linear infinite;" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#6c2fbf" stroke-width="5" stroke-linecap="round"
              stroke-dasharray="90,150" stroke-dashoffset="0">
      </circle>
    </svg>
  </h3>
  <span class="trend neutral" id="total-consumption-trend">Aguardando dados...</span>
  <div id="total-consumption-info" class="consumption-breakdown"></div>
</div>
```

#### 4. Fix Layout at 100% Zoom

**Current CSS Issue:**

```css
/* Current - causes layout break */
.charts {
  display: flex;
  gap: 16px;
}

.chart-box {
  flex: 1; /* Both take equal space, line chart too wide */
}
```

**Proposed CSS Fix:**

```css
/* src/MYIO-SIM/V1.0.0/ENERGY/style.css */

.charts {
  display: grid;
  grid-template-columns: minmax(400px, 1fr) minmax(350px, 1fr);
  gap: 16px;
}

/* Ensure charts don't overflow */
.chart-box {
  min-width: 0; /* Allow flex items to shrink below content size */
  overflow: hidden;
}

.chart-box canvas {
  max-width: 100%;
  height: auto;
}

/* Responsive layout for smaller screens */
@media (max-width: 1200px) {
  .charts {
    grid-template-columns: 1fr;
  }
}

/* At 100% zoom, maintain aspect ratio */
@media (min-width: 1201px) {
  .charts {
    grid-template-columns: 45% 55%; /* Line chart smaller, bar chart larger */
  }
}
```

#### 5. Device Classification Already Fixed (RFC Implementation)

The device classification was fixed in the current session following the rule:

```javascript
// Already implemented in calculateDistributionByMode
let deviceType = (deviceData.deviceType || "").toUpperCase();
const deviceProfile = (deviceData.deviceProfile || "").toUpperCase();

// RULE: If 3F_MEDIDOR with valid deviceProfile, use deviceProfile as deviceType
if (deviceType === "3F_MEDIDOR" && deviceProfile && deviceProfile !== "N/D") {
  deviceType = deviceProfile;
}

// Then classify based on deviceType
```

This is now correctly implemented and documented in the code.

#### 6. Peak Demand Filtering

**Current Implementation (Ignores Filter):**

```javascript
async function updatePeakDemandCard(startTs, endTs) {
  const customerId = self.ctx.settings?.customerId;

  // Always uses single customerId - ignores shopping filter
  const peakData = await fetchCustomerPeakDemand(customerId, startTs, endTs);
}
```

**Proposed Implementation:**

```javascript
/**
 * Fetches peak demand respecting shopping filters
 * If specific shoppings are selected, aggregates their peak demand
 * Otherwise, uses the main customer ID (all shoppings)
 *
 * @param {number} startTs - Start timestamp
 * @param {number} endTs - End timestamp
 * @returns {Promise<Object>} Peak demand data
 */
async function fetchFilteredPeakDemand(startTs, endTs) {
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    console.error("[ENERGY] JWT token not found");
    return null;
  }

  // Check if shopping filter is active
  const selectedShoppingIds = getSelectedShoppingIds();
  const mainCustomerId = self.ctx.settings?.customerId;

  // If no filter, use main customer ID
  if (selectedShoppingIds.length === 0) {
    console.log("[ENERGY] Fetching peak demand for all shoppings");
    return await fetchCustomerPeakDemand(mainCustomerId, startTs, endTs);
  }

  // If filter is active, fetch for each shopping and aggregate
  console.log(`[ENERGY] Fetching peak demand for ${selectedShoppingIds.length} filtered shopping(s)`);

  const promises = selectedShoppingIds.map(shoppingId =>
    fetchCustomerPeakDemand(shoppingId, startTs, endTs)
  );

  const results = await Promise.all(promises);

  // Find the overall peak across all selected shoppings
  let globalPeak = null;

  results.forEach(result => {
    if (!result) return;

    if (!globalPeak || result.peakValue > globalPeak.peakValue) {
      globalPeak = result;
    }
  });

  if (globalPeak) {
    console.log(`[ENERGY] Global peak across filtered shoppings: ${globalPeak.peakValue} kW`);
  }

  return globalPeak;
}

/**
 * Updates peak demand card with filtered data
 */
async function updatePeakDemandCard(startTs, endTs) {
  const valueEl = document.getElementById("peak-demand-value");
  const trendEl = document.getElementById("peak-demand-trend");
  const deviceEl = document.getElementById("peak-demand-device");

  try {
    console.log("[ENERGY] Fetching peak demand data...", { startTs, endTs });

    // Show loading state
    if (valueEl) {
      valueEl.innerHTML = `
        <svg class="loading-spinner" style="width:24px; height:24px; animation: spin 1s linear infinite;" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="20" fill="none" stroke="#6c2fbf" stroke-width="5" stroke-linecap="round"
                  stroke-dasharray="90,150" stroke-dashoffset="0">
          </circle>
        </svg>
      `;
    }

    // Fetch filtered peak demand
    const peakData = await fetchFilteredPeakDemand(startTs, endTs);

    console.log("[ENERGY] Peak demand data received:", peakData);

    // Handle no data case
    if (!peakData || peakData.peakValue === 0) {
      if (valueEl) {
        valueEl.textContent = "— kW";
      }
      if (trendEl) {
        trendEl.textContent = "Sem dados disponíveis";
        trendEl.className = "trend neutral";
      }
      if (deviceEl) {
        deviceEl.textContent = "";
      }
      return;
    }

    // Update card with peak data
    if (valueEl) {
      valueEl.textContent = `${peakData.peakValue.toFixed(2)} kW`;
    }

    if (trendEl) {
      const trend = peakData.trend || 0;
      const trendClass = trend > 0 ? 'trend up' : trend < 0 ? 'trend down' : 'trend neutral';
      trendEl.className = trendClass;
      trendEl.textContent = trend !== 0
        ? `${trend > 0 ? '↑' : '↓'} ${Math.abs(trend).toFixed(1)}% vs período anterior`
        : 'Sem variação';
    }

    if (deviceEl) {
      const deviceInfo = peakData.deviceName || peakData.deviceId || 'Dispositivo não identificado';
      const timestamp = peakData.timestamp ? new Date(peakData.timestamp).toLocaleString('pt-BR') : '';
      deviceEl.innerHTML = `
        <div style="font-size: 11px; margin-top: 4px;">
          ${deviceInfo}
          ${timestamp ? `<br>em ${timestamp}` : ''}
        </div>
      `;
    }

    console.log("[ENERGY] Peak demand card updated successfully");

  } catch (error) {
    console.error("[ENERGY] Error updating peak demand card:", error);

    if (valueEl) {
      valueEl.textContent = "Erro";
    }
    if (trendEl) {
      trendEl.textContent = "Erro ao carregar dados";
      trendEl.className = "trend neutral";
    }
  }
}

/**
 * Listen to filter changes and update peak demand
 */
window.addEventListener('myio:filter-applied', async (ev) => {
  console.log("[ENERGY] Filter changed, updating peak demand...");

  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

  await updatePeakDemandCard(sevenDaysAgo, now);
});
```

## Drawbacks

1. **API Load**: Fetching daily data for 7+ days means 7+ API calls which may impact server load
2. **Complexity**: Multi-series chart adds significant complexity to rendering logic
3. **Performance**: Large period selections (30+ days) with multiple equipment types may cause slow rendering
4. **Backward Compatibility**: Changes to card layout may surprise existing users
5. **Caching Trade-off**: Client-side caching of daily calls may desync with real-time readings if not refreshed properly

## Rationale and Alternatives

### Why Daily API Calls Instead of Single Call?

**Alternative 1:** Single API call with aggregation parameter
- ⚠️ Requires backend changes
- ⚠️ May not be available in current ThingsBoard API

**Alternative 2:** Client-side date range aggregation
- ❌ Would require fetching all telemetry points (too much data)
- ❌ Complex aggregation logic

**Chosen Approach:** Multiple daily calls
- ✅ Works with existing API
- ✅ Can be throttled/cached
- ✅ Allows per-day error handling

### Why Modal for Chart Config Instead of Inline Controls?

**Alternative 1:** Inline dropdowns and checkboxes
- ❌ Clutters the UI
- ❌ Hard to fit all options

**Alternative 2:** Collapsible panel
- ⚠️ Takes vertical space
- ⚠️ May push content down

**Chosen Approach:** Modal
- ✅ Clean UI when not configuring
- ✅ Focused experience
- ✅ All options visible at once

## Prior Art

- **Google Analytics**: Uses modal for date range and metric configuration
- **Grafana**: Panel configuration in modal sidebar
- **Kibana**: Full-screen visualization editor

## Unresolved Questions

1. Should we implement client-side caching for daily consumption data?
2. What's the maximum reasonable period for chart display? (30 days? 90 days?)
3. Should multi-series chart support more than 5 series, or limit it?
4. Should we add export functionality (CSV, PNG) for chart data?

## Future Possibilities

1. **Comparative Analysis**: Compare current period vs. previous period in same chart
2. **Anomaly Detection**: Highlight days with unusual consumption patterns
3. **Forecasting**: Show predicted consumption based on historical trends
4. **Drill-Down**: Click a day to see hourly breakdown
5. **Benchmarking**: Compare shopping consumption against portfolio average
6. **Real-Time Updates**: WebSocket integration for live consumption updates
7. **Unified Energy Engine**: Share consumption logic with EQUIPMENTS and WATER widgets for cross-utility comparisons

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)
- [ ] Fix 7-day chart API integration
- [ ] Add shopping filter label to chart
- [ ] Fix peak demand filtering
- [ ] Add percentage labels to consumption card

### Phase 2: Advanced Features (Week 2)
- [ ] Implement chart configuration modal
- [ ] Add period selection (7/14/30 days)
- [ ] Add equipment type filter
- [ ] Test multi-series rendering

### Phase 3: Layout & Polish (Week 3)
- [ ] Fix grid layout at 100% zoom
- [ ] Optimize chart responsiveness
- [ ] Add loading states and error handling
- [ ] Improve accessibility (ARIA labels, keyboard nav)

### Phase 4: Testing & Documentation (Week 4)
- [ ] End-to-end testing of all features
- [ ] Performance testing with large datasets
- [ ] Update user documentation
- [ ] Add inline help tooltips

## Testing Strategy

### Unit Tests
```javascript
describe('fetchDailyConsumption', () => {
  it('should fetch data for 7 days by default', async () => {
    const data = await fetchDailyConsumption();
    expect(data).toHaveLength(7);
  });

  it('should respect equipment type filter', async () => {
    const data = await fetchDailyConsumption(7, ['Elevadores']);
    // Verify only elevator consumption is included
  });

  it('should handle API errors gracefully', async () => {
    mockAPIFailure();
    const data = await fetchDailyConsumption();
    expect(data.some(d => d.error)).toBe(true);
  });
});

describe('fetchFilteredPeakDemand', () => {
  it('should use main customer ID when no filter', async () => {
    window.custumersSelected = [];
    const peak = await fetchFilteredPeakDemand(startTs, endTs);
    // Verify correct API call
  });

  it('should aggregate peak across multiple shoppings', async () => {
    window.custumersSelected = [
      { value: 'shop1' },
      { value: 'shop2' }
    ];
    const peak = await fetchFilteredPeakDemand(startTs, endTs);
    expect(peak.peakValue).toBeGreaterThan(0);
  });
});
```

### Integration Tests
- Verify 7-day chart displays correct data after filter change
- Verify configuration modal persists settings
- Verify multi-series chart renders all selected types
- Verify percentage labels update when consumption changes

### Manual Test Cases
1. **7-Day Chart Test**
   - [ ] Load widget and verify chart shows last 7 days
   - [ ] Apply shopping filter and verify chart updates
   - [ ] Verify shopping label shows selected shoppings
   - [ ] Click settings button and modal opens

2. **Chart Configuration Test**
   - [ ] Open config modal
   - [ ] Change period to 14 days and apply
   - [ ] Verify chart updates with 14 data points
   - [ ] Select only "Elevadores" filter
   - [ ] Verify chart shows only elevator consumption
   - [ ] Enable multi-series mode with 3 types
   - [ ] Verify chart shows 3 separate lines

3. **Percentage Labels Test**
   - [ ] Load widget and wait for data
   - [ ] Verify "Consumo Total Lojas" shows percentage
   - [ ] Verify percentage matches (Lojas + Equipamentos = 100%)
   - [ ] Apply filter and verify percentages recalculate

4. **Layout Test**
   - [ ] Set browser zoom to 100%
   - [ ] Verify both charts are visible without scrolling
   - [ ] Verify distribution chart is not cut off
   - [ ] Resize window and verify responsive behavior

5. **Peak Demand Filter Test**
   - [ ] Note current peak demand value
   - [ ] Apply shopping filter (select 1 shopping)
   - [ ] Verify peak demand updates
   - [ ] Clear filter
   - [ ] Verify peak demand shows all shoppings again

## Success Metrics

- 7-day chart displays real data with <2s load time
- Chart configuration modal used by 40%+ of users
- Zero reports of cut-off distribution chart at 100% zoom
- Peak demand respects filters 100% of the time
- User satisfaction score increases by 20%
- 7-day chart numerical deviation ≤ 1% compared to direct ThingsBoard reports

## References

- ThingsBoard Telemetry API: `/api/v1/telemetry/customers/{customerId}/energy/devices/totals`
- Chart.js Documentation: https://www.chartjs.org/docs/
- Date Range Picker Best Practices: https://uxdesign.cc/date-range-picker-patterns-bb7c4f3ca8f2
- RFC-0065: Device Type Coverage Audit
- EQUIPMENTS Widget Implementation: `src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js`
