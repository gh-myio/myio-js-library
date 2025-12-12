# RFC-0001: Implementation Plan - Operational Indicators Panel Widget

- **RFC Reference:** RFC-0001-Operational-Indicators-Panel
- **Version:** 1.0.0
- **Last Updated:** 2025-12-12

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Project Structure](#3-project-structure)
4. [Phase 1: Foundation](#4-phase-1-foundation)
5. [Phase 2: Core Components](#5-phase-2-core-components)
6. [Phase 3: KPI Calculations](#6-phase-3-kpi-calculations)
7. [Phase 4: Alert System](#7-phase-4-alert-system)
8. [Phase 5: Reporting](#8-phase-5-reporting)
9. [Phase 6: Testing & QA](#9-phase-6-testing--qa)
10. [Phase 7: Deployment](#10-phase-7-deployment)
11. [Technical Specifications](#11-technical-specifications)
12. [Risk Assessment](#12-risk-assessment)

---

## 1. Overview

This document provides a detailed implementation plan for building the Operational Indicators Panel widget in ThingsBoard. The widget monitors escalators and elevators with real-time KPIs, automatic alerts, and consolidated reporting.

### Scope

| In Scope | Out of Scope |
|----------|--------------|
| Individual equipment cards | Mobile native app |
| KPI calculations (MTBF, MTTR, Availability) | Third-party integrations |
| Email alert system | AI prediction (Phase 2+) |
| PDF/CSV report generation | Multi-tenant support |
| Consolidated view | Historical data migration |

---

## 2. Prerequisites

### 2.1 ThingsBoard Requirements

- ThingsBoard CE/PE version 3.5+
- Admin access to create custom widgets
- SMTP configured for email alerts
- Rule Engine access for automation

### 2.2 Development Environment

```
Node.js >= 18.x
npm >= 9.x
TypeScript >= 5.x (optional)
Git
```

### 2.3 Required ThingsBoard Entities

| Entity Type | Purpose |
|-------------|---------|
| Device Profile | "Escalator" and "Elevator" profiles |
| Asset | Building/Zone grouping |
| Dashboard | Target dashboard for widget |
| Rule Chain | Alert processing |

### 2.4 Telemetry Keys (Pre-configured)

Ensure devices are sending these telemetry keys:

```javascript
// Required keys
const REQUIRED_KEYS = [
  'status',           // boolean: true=online, false=offline
  'operationTime',    // number: total operation time in minutes
  'maintenanceTime',  // number: total maintenance time in minutes
  'stopCount',        // number: total number of stops/failures
  'phaseReversal',    // boolean: phase inversion detected
  'gridFrequency',    // number: Hz
  'powerDemand',      // number: kW
  'currentR',         // number: Amperes
  'currentS',         // number: Amperes
  'currentT',         // number: Amperes
  'voltageRS',        // number: Volts
  'voltageST',        // number: Volts
  'voltageTR'         // number: Volts
];
```

---

## 3. Project Structure

```
operational-indicators-panel/
├── widget/
│   ├── action/
│   │   └── descriptor.json
│   ├── css/
│   │   ├── main.css
│   │   ├── cards.css
│   │   ├── gauges.css
│   │   └── responsive.css
│   ├── html/
│   │   └── template.html
│   ├── javascript/
│   │   ├── controller.js          # Main widget controller
│   │   ├── services/
│   │   │   ├── telemetry.service.js
│   │   │   ├── calculation.service.js
│   │   │   ├── alert.service.js
│   │   │   └── report.service.js
│   │   ├── components/
│   │   │   ├── equipment-card.js
│   │   │   ├── gauge-chart.js
│   │   │   ├── status-badge.js
│   │   │   ├── alert-counter.js
│   │   │   └── consolidated-view.js
│   │   └── utils/
│   │       ├── formatters.js
│   │       ├── validators.js
│   │       └── constants.js
│   └── settings/
│       └── schema.json
├── rule-chain/
│   ├── alert-processor.json
│   └── report-generator.json
├── tests/
│   ├── calculation.test.js
│   ├── alert.test.js
│   └── integration.test.js
├── docs/
│   └── user-guide.md
└── README.md
```

---

## 4. Phase 1: Foundation

### 4.1 Task List

| Task ID | Task | Priority | Dependencies |
|---------|------|----------|--------------|
| P1-01 | Create widget bundle in ThingsBoard | High | None |
| P1-02 | Define widget settings schema | High | P1-01 |
| P1-03 | Create base HTML template | High | P1-01 |
| P1-04 | Implement base CSS styles | Medium | P1-03 |
| P1-05 | Setup controller.js skeleton | High | P1-03 |
| P1-06 | Configure data sources | High | P1-05 |

### 4.2 Widget Settings Schema

```json
{
  "schema": {
    "type": "object",
    "title": "Operational Indicators Settings",
    "properties": {
      "general": {
        "type": "object",
        "title": "General Settings",
        "properties": {
          "title": {
            "type": "string",
            "title": "Widget Title",
            "default": "Operational Indicators"
          },
          "refreshInterval": {
            "type": "number",
            "title": "Refresh Interval (ms)",
            "default": 60000,
            "minimum": 10000
          },
          "showConsolidatedView": {
            "type": "boolean",
            "title": "Show Consolidated View",
            "default": true
          }
        }
      },
      "inactivityWindow": {
        "type": "object",
        "title": "Inactivity Window",
        "properties": {
          "enabled": {
            "type": "boolean",
            "title": "Enable Inactivity Detection",
            "default": true
          },
          "startHour": {
            "type": "number",
            "title": "Start Hour (24h)",
            "default": 22,
            "minimum": 0,
            "maximum": 23
          },
          "endHour": {
            "type": "number",
            "title": "End Hour (24h)",
            "default": 5,
            "minimum": 0,
            "maximum": 23
          }
        }
      },
      "alerts": {
        "type": "object",
        "title": "Alert Configuration",
        "properties": {
          "enabled": {
            "type": "boolean",
            "title": "Enable Alerts",
            "default": true
          },
          "emailRecipients": {
            "type": "array",
            "title": "Email Recipients",
            "items": { "type": "string" }
          },
          "frequencyThreshold": {
            "type": "number",
            "title": "Grid Frequency Threshold (%)",
            "default": 5
          }
        }
      },
      "display": {
        "type": "object",
        "title": "Display Options",
        "properties": {
          "cardsPerRow": {
            "type": "number",
            "title": "Cards Per Row",
            "default": 4,
            "minimum": 1,
            "maximum": 6
          },
          "showElectricalIndicators": {
            "type": "boolean",
            "title": "Show Electrical Indicators",
            "default": true
          },
          "gaugeColorScheme": {
            "type": "string",
            "title": "Gauge Color Scheme",
            "default": "default",
            "enum": ["default", "traffic-light", "blue-scale"]
          }
        }
      }
    }
  },
  "form": [
    "general",
    "inactivityWindow",
    "alerts",
    "display"
  ]
}
```

### 4.3 Base HTML Template

```html
<div class="oip-container">
  <!-- Header Section -->
  <div class="oip-header">
    <h2 class="oip-title">{{ settings.general.title }}</h2>
    <div class="oip-controls">
      <div class="oip-filter">
        <select id="equipmentFilter" class="oip-select">
          <option value="all">All Equipment</option>
          <option value="escalator">Escalators</option>
          <option value="elevator">Elevators</option>
        </select>
      </div>
      <div class="oip-toggle">
        <label class="oip-switch">
          <input type="checkbox" id="consolidatedToggle" />
          <span class="oip-slider"></span>
        </label>
        <span>Consolidated View</span>
      </div>
      <button id="exportBtn" class="oip-btn oip-btn-primary">
        <i class="material-icons">download</i>
        Export Report
      </button>
    </div>
  </div>

  <!-- Consolidated View Section -->
  <div id="consolidatedSection" class="oip-consolidated" style="display: none;">
    <div class="oip-consolidated-grid">
      <div class="oip-stat-card">
        <span class="oip-stat-label">Total Equipment</span>
        <span id="totalEquipment" class="oip-stat-value">0</span>
      </div>
      <div class="oip-stat-card">
        <span class="oip-stat-label">Avg. Availability</span>
        <span id="avgAvailability" class="oip-stat-value">0%</span>
      </div>
      <div class="oip-stat-card">
        <span class="oip-stat-label">Avg. MTBF</span>
        <span id="avgMtbf" class="oip-stat-value">0h</span>
      </div>
      <div class="oip-stat-card">
        <span class="oip-stat-label">Avg. MTTR</span>
        <span id="avgMttr" class="oip-stat-value">0h</span>
      </div>
      <div class="oip-stat-card oip-stat-alert">
        <span class="oip-stat-label">Active Alerts</span>
        <span id="activeAlerts" class="oip-stat-value">0</span>
      </div>
    </div>
  </div>

  <!-- Equipment Cards Grid -->
  <div id="cardsGrid" class="oip-cards-grid">
    <!-- Cards will be dynamically inserted here -->
  </div>

  <!-- Loading State -->
  <div id="loadingState" class="oip-loading">
    <div class="oip-spinner"></div>
    <span>Loading equipment data...</span>
  </div>

  <!-- Empty State -->
  <div id="emptyState" class="oip-empty" style="display: none;">
    <i class="material-icons">inbox</i>
    <span>No equipment found</span>
  </div>

  <!-- Alert Panel -->
  <div id="alertPanel" class="oip-alert-panel">
    <h3>Recent Alerts</h3>
    <div id="alertList" class="oip-alert-list">
      <!-- Alerts will be dynamically inserted here -->
    </div>
  </div>
</div>
```

### 4.4 Controller Skeleton

```javascript
self.onInit = function() {
  // Initialize services
  self.ctx.services = {
    telemetry: new TelemetryService(self.ctx),
    calculation: new CalculationService(),
    alert: new AlertService(self.ctx),
    report: new ReportService(self.ctx)
  };

  // Initialize state
  self.ctx.state = {
    equipment: [],
    alerts: [],
    consolidated: {
      totalEquipment: 0,
      avgAvailability: 0,
      avgMtbf: 0,
      avgMttr: 0,
      activeAlerts: 0
    },
    filter: 'all',
    showConsolidated: false,
    isLoading: true
  };

  // Bind event handlers
  bindEventHandlers();

  // Initial data load
  loadEquipmentData();
};

self.onDataUpdated = function() {
  updateEquipmentCards();
  updateConsolidatedView();
  checkAlertConditions();
};

self.onResize = function() {
  adjustGridLayout();
};

self.onDestroy = function() {
  // Cleanup subscriptions
  self.ctx.services.telemetry.unsubscribeAll();
};
```

---

## 5. Phase 2: Core Components

### 5.1 Task List

| Task ID | Task | Priority | Dependencies |
|---------|------|----------|--------------|
| P2-01 | Implement Equipment Card component | High | P1-05 |
| P2-02 | Implement Gauge Chart component | High | P2-01 |
| P2-03 | Implement Status Badge component | Medium | P2-01 |
| P2-04 | Implement Alert Counter component | Medium | P2-01 |
| P2-05 | Implement Consolidated View component | High | P2-01 |
| P2-06 | Implement responsive grid layout | Medium | P2-01 |

### 5.2 Equipment Card Component

```javascript
// components/equipment-card.js

class EquipmentCard {
  constructor(container, equipment, settings) {
    this.container = container;
    this.equipment = equipment;
    this.settings = settings;
    this.elements = {};
  }

  render() {
    const card = document.createElement('div');
    card.className = 'oip-card';
    card.dataset.equipmentId = this.equipment.id;
    card.dataset.equipmentType = this.equipment.type;

    card.innerHTML = `
      <div class="oip-card-header">
        <div class="oip-card-title">
          <i class="material-icons">${this.getIcon()}</i>
          <span class="oip-card-name">${this.equipment.name}</span>
        </div>
        <div class="oip-card-status">
          <span class="oip-status-badge ${this.getStatusClass()}">
            ${this.equipment.status ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div class="oip-card-body">
        <!-- Availability Gauge -->
        <div class="oip-gauge-container">
          <canvas id="gauge-${this.equipment.id}" width="120" height="120"></canvas>
          <div class="oip-gauge-label">
            <span class="oip-gauge-value">${this.equipment.availability.toFixed(1)}%</span>
            <span class="oip-gauge-text">Availability</span>
          </div>
        </div>

        <!-- KPI Metrics -->
        <div class="oip-metrics">
          <div class="oip-metric">
            <span class="oip-metric-label">MTBF</span>
            <span class="oip-metric-value">${this.equipment.mtbf.toFixed(1)}h</span>
          </div>
          <div class="oip-metric">
            <span class="oip-metric-label">MTTR</span>
            <span class="oip-metric-value">${this.equipment.mttr.toFixed(1)}h</span>
          </div>
        </div>

        <!-- Phase Reversal Alert -->
        ${this.equipment.phaseReversal ? `
          <div class="oip-reversal-alert">
            <i class="material-icons">warning</i>
            <span>Phase Reversal Detected</span>
          </div>
        ` : ''}

        <!-- Electrical Indicators (if enabled) -->
        ${this.settings.display.showElectricalIndicators ? `
          <div class="oip-electrical">
            <div class="oip-electrical-item">
              <span class="oip-electrical-label">Frequency</span>
              <span class="oip-electrical-value">${this.equipment.gridFrequency.toFixed(1)} Hz</span>
            </div>
            <div class="oip-electrical-item">
              <span class="oip-electrical-label">Power</span>
              <span class="oip-electrical-value">${this.equipment.powerDemand.toFixed(1)} kW</span>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="oip-card-footer">
        <div class="oip-alert-count ${this.equipment.alertCount > 0 ? 'has-alerts' : ''}">
          <i class="material-icons">notifications</i>
          <span>${this.equipment.alertCount} alerts</span>
        </div>
        <button class="oip-btn-icon" onclick="showEquipmentDetails('${this.equipment.id}')">
          <i class="material-icons">info</i>
        </button>
      </div>
    `;

    this.container.appendChild(card);
    this.elements.card = card;

    // Initialize gauge after DOM insertion
    this.initGauge();

    return this;
  }

  getIcon() {
    return this.equipment.type === 'escalator' ? 'escalator' : 'elevator';
  }

  getStatusClass() {
    if (!this.equipment.status) return 'status-offline';
    if (this.equipment.phaseReversal) return 'status-warning';
    return 'status-online';
  }

  initGauge() {
    const canvas = document.getElementById(`gauge-${this.equipment.id}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const value = this.equipment.availability / 100;

    // Draw gauge background
    ctx.beginPath();
    ctx.arc(60, 60, 50, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw gauge value
    ctx.beginPath();
    ctx.arc(60, 60, 50, 0.75 * Math.PI, (0.75 + 1.5 * value) * Math.PI);
    ctx.strokeStyle = this.getGaugeColor(value);
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  getGaugeColor(value) {
    if (value >= 0.9) return '#4caf50';  // Green
    if (value >= 0.7) return '#ff9800';  // Orange
    return '#f44336';  // Red
  }

  update(equipment) {
    this.equipment = equipment;
    // Update DOM elements
    this.updateStatus();
    this.updateMetrics();
    this.updateGauge();
    this.updateAlerts();
  }

  updateStatus() {
    const badge = this.elements.card.querySelector('.oip-status-badge');
    badge.className = `oip-status-badge ${this.getStatusClass()}`;
    badge.textContent = this.equipment.status ? 'Online' : 'Offline';
  }

  updateMetrics() {
    const gaugeValue = this.elements.card.querySelector('.oip-gauge-value');
    gaugeValue.textContent = `${this.equipment.availability.toFixed(1)}%`;

    const metrics = this.elements.card.querySelectorAll('.oip-metric-value');
    metrics[0].textContent = `${this.equipment.mtbf.toFixed(1)}h`;
    metrics[1].textContent = `${this.equipment.mttr.toFixed(1)}h`;
  }

  updateGauge() {
    this.initGauge(); // Re-render gauge
  }

  updateAlerts() {
    const alertCount = this.elements.card.querySelector('.oip-alert-count');
    alertCount.className = `oip-alert-count ${this.equipment.alertCount > 0 ? 'has-alerts' : ''}`;
    alertCount.querySelector('span').textContent = `${this.equipment.alertCount} alerts`;
  }

  destroy() {
    if (this.elements.card) {
      this.elements.card.remove();
    }
  }
}
```

### 5.3 CSS Styles

```css
/* css/cards.css */

.oip-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 16px;
}

.oip-card {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.oip-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.oip-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.oip-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.oip-card-title i {
  color: #666;
  font-size: 20px;
}

.oip-card-name {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.oip-status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-online {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-offline {
  background: #ffebee;
  color: #c62828;
}

.status-warning {
  background: #fff3e0;
  color: #e65100;
}

.oip-card-body {
  padding: 16px;
}

.oip-gauge-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}

.oip-gauge-label {
  text-align: center;
  margin-top: -40px;
}

.oip-gauge-value {
  font-size: 24px;
  font-weight: 700;
  color: #333;
}

.oip-gauge-text {
  display: block;
  font-size: 12px;
  color: #666;
}

.oip-metrics {
  display: flex;
  justify-content: space-around;
  margin-bottom: 16px;
}

.oip-metric {
  text-align: center;
}

.oip-metric-label {
  display: block;
  font-size: 11px;
  color: #999;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.oip-metric-value {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.oip-reversal-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff3e0;
  border-radius: 8px;
  color: #e65100;
  font-size: 12px;
  margin-bottom: 12px;
}

.oip-reversal-alert i {
  font-size: 16px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.oip-electrical {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
}

.oip-electrical-item {
  text-align: center;
}

.oip-electrical-label {
  display: block;
  font-size: 10px;
  color: #999;
}

.oip-electrical-value {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.oip-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fafafa;
  border-top: 1px solid #f0f0f0;
}

.oip-alert-count {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #999;
}

.oip-alert-count.has-alerts {
  color: #f44336;
}

.oip-alert-count i {
  font-size: 16px;
}

/* Responsive */
@media (max-width: 768px) {
  .oip-cards-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .oip-card-header {
    flex-direction: column;
    gap: 8px;
  }
}
```

---

## 6. Phase 3: KPI Calculations

### 6.1 Task List

| Task ID | Task | Priority | Dependencies |
|---------|------|----------|--------------|
| P3-01 | Implement MTBF calculation | High | P2-01 |
| P3-02 | Implement MTTR calculation | High | P2-01 |
| P3-03 | Implement Availability calculation | High | P3-01, P3-02 |
| P3-04 | Implement consolidated averages | High | P3-03 |
| P3-05 | Add calculation caching | Medium | P3-04 |
| P3-06 | Implement D-1 data fetch | High | P3-04 |

### 6.2 Calculation Service

```javascript
// services/calculation.service.js

class CalculationService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute
  }

  /**
   * Calculate Mean Time Between Failures (MTBF)
   * Formula: (Total Operation Time - Maintenance Time) / Number of Stops
   * @param {number} operationTime - Total operation time in minutes
   * @param {number} maintenanceTime - Total maintenance time in minutes
   * @param {number} stopCount - Number of stops/failures
   * @returns {number} MTBF in hours
   */
  calculateMTBF(operationTime, maintenanceTime, stopCount) {
    if (stopCount === 0) {
      // No failures - return total uptime as MTBF
      return (operationTime - maintenanceTime) / 60;
    }

    const uptimeMinutes = operationTime - maintenanceTime;
    const mtbfMinutes = uptimeMinutes / stopCount;
    const mtbfHours = mtbfMinutes / 60;

    return Math.max(0, mtbfHours);
  }

  /**
   * Calculate Mean Time To Repair (MTTR)
   * Formula: Total Maintenance Time / Number of Stops
   * @param {number} maintenanceTime - Total maintenance time in minutes
   * @param {number} stopCount - Number of stops/failures
   * @returns {number} MTTR in hours
   */
  calculateMTTR(maintenanceTime, stopCount) {
    if (stopCount === 0) {
      return 0; // No repairs needed
    }

    const mttrMinutes = maintenanceTime / stopCount;
    const mttrHours = mttrMinutes / 60;

    return Math.max(0, mttrHours);
  }

  /**
   * Calculate Availability
   * Formula: MTBF / (MTBF + MTTR) * 100
   * @param {number} mtbf - Mean Time Between Failures in hours
   * @param {number} mttr - Mean Time To Repair in hours
   * @returns {number} Availability percentage (0-100)
   */
  calculateAvailability(mtbf, mttr) {
    if (mtbf === 0 && mttr === 0) {
      return 100; // No data, assume 100%
    }

    if (mtbf === 0) {
      return 0; // Always failing
    }

    const availability = (mtbf / (mtbf + mttr)) * 100;
    return Math.min(100, Math.max(0, availability));
  }

  /**
   * Calculate all KPIs for an equipment
   * @param {Object} telemetry - Equipment telemetry data
   * @returns {Object} Calculated KPIs
   */
  calculateEquipmentKPIs(telemetry) {
    const {
      operationTime = 0,
      maintenanceTime = 0,
      stopCount = 0
    } = telemetry;

    const mtbf = this.calculateMTBF(operationTime, maintenanceTime, stopCount);
    const mttr = this.calculateMTTR(maintenanceTime, stopCount);
    const availability = this.calculateAvailability(mtbf, mttr);

    return {
      mtbf: Math.round(mtbf * 10) / 10,
      mttr: Math.round(mttr * 10) / 10,
      availability: Math.round(availability * 10) / 10
    };
  }

  /**
   * Calculate consolidated KPIs for all equipment
   * @param {Array} equipmentList - Array of equipment with KPIs
   * @returns {Object} Consolidated KPIs
   */
  calculateConsolidatedKPIs(equipmentList) {
    if (!equipmentList || equipmentList.length === 0) {
      return {
        totalEquipment: 0,
        avgAvailability: 0,
        avgMtbf: 0,
        avgMttr: 0,
        onlineCount: 0,
        offlineCount: 0
      };
    }

    const totals = equipmentList.reduce((acc, eq) => {
      acc.availability += eq.availability || 0;
      acc.mtbf += eq.mtbf || 0;
      acc.mttr += eq.mttr || 0;
      acc.online += eq.status ? 1 : 0;
      return acc;
    }, { availability: 0, mtbf: 0, mttr: 0, online: 0 });

    const count = equipmentList.length;

    return {
      totalEquipment: count,
      avgAvailability: Math.round((totals.availability / count) * 10) / 10,
      avgMtbf: Math.round((totals.mtbf / count) * 10) / 10,
      avgMttr: Math.round((totals.mttr / count) * 10) / 10,
      onlineCount: totals.online,
      offlineCount: count - totals.online
    };
  }

  /**
   * Check if grid frequency is within acceptable range
   * @param {number} frequency - Current frequency in Hz
   * @param {number} threshold - Threshold percentage
   * @returns {Object} Frequency status
   */
  checkGridFrequency(frequency, threshold = 5) {
    const nominal = 60; // Hz (Brazil standard)
    const deviation = Math.abs((frequency - nominal) / nominal) * 100;

    return {
      frequency,
      nominal,
      deviation: Math.round(deviation * 100) / 100,
      isNormal: deviation <= threshold,
      status: deviation <= threshold ? 'normal' : 'abnormal'
    };
  }

  /**
   * Get cached calculation or compute new
   * @param {string} key - Cache key
   * @param {Function} computeFn - Computation function
   * @returns {any} Cached or computed value
   */
  getCachedOrCompute(key, computeFn) {
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.value;
    }

    const value = computeFn();
    this.cache.set(key, { value, timestamp: Date.now() });

    return value;
  }

  clearCache() {
    this.cache.clear();
  }
}
```

### 6.3 Telemetry Service

```javascript
// services/telemetry.service.js

class TelemetryService {
  constructor(ctx) {
    this.ctx = ctx;
    this.subscriptions = [];
    this.dataCache = new Map();
  }

  /**
   * Subscribe to equipment telemetry
   * @param {Function} callback - Callback for data updates
   */
  subscribeToEquipment(callback) {
    const subscription = this.ctx.defaultSubscription;

    if (subscription) {
      subscription.subscribeForPaginatedData(
        0,
        100,
        (data) => {
          const processedData = this.processRawData(data);
          callback(processedData);
        }
      );

      this.subscriptions.push(subscription);
    }
  }

  /**
   * Process raw telemetry data
   * @param {Object} rawData - Raw data from subscription
   * @returns {Array} Processed equipment data
   */
  processRawData(rawData) {
    const equipment = [];

    if (rawData && rawData.data) {
      for (const [entityId, data] of Object.entries(rawData.data)) {
        const processed = {
          id: entityId,
          name: data.entityName || 'Unknown',
          type: this.determineEquipmentType(data),
          status: this.getLatestValue(data, 'status', false),
          operationTime: this.getLatestValue(data, 'operationTime', 0),
          maintenanceTime: this.getLatestValue(data, 'maintenanceTime', 0),
          stopCount: this.getLatestValue(data, 'stopCount', 0),
          phaseReversal: this.getLatestValue(data, 'phaseReversal', false),
          gridFrequency: this.getLatestValue(data, 'gridFrequency', 60),
          powerDemand: this.getLatestValue(data, 'powerDemand', 0),
          currentR: this.getLatestValue(data, 'currentR', 0),
          currentS: this.getLatestValue(data, 'currentS', 0),
          currentT: this.getLatestValue(data, 'currentT', 0),
          voltageRS: this.getLatestValue(data, 'voltageRS', 0),
          voltageST: this.getLatestValue(data, 'voltageST', 0),
          voltageTR: this.getLatestValue(data, 'voltageTR', 0),
          lastUpdate: this.getLatestTimestamp(data)
        };

        equipment.push(processed);
      }
    }

    return equipment;
  }

  /**
   * Get latest value from telemetry data
   */
  getLatestValue(data, key, defaultValue) {
    if (data[key] && data[key].length > 0) {
      return data[key][0].value;
    }
    return defaultValue;
  }

  /**
   * Get latest timestamp from telemetry
   */
  getLatestTimestamp(data) {
    let latest = 0;
    for (const values of Object.values(data)) {
      if (Array.isArray(values) && values.length > 0) {
        if (values[0].ts > latest) {
          latest = values[0].ts;
        }
      }
    }
    return latest;
  }

  /**
   * Determine equipment type from data
   */
  determineEquipmentType(data) {
    const name = (data.entityName || '').toLowerCase();
    if (name.includes('escada') || name.includes('escalator')) {
      return 'escalator';
    }
    if (name.includes('elevador') || name.includes('elevator')) {
      return 'elevator';
    }
    return 'unknown';
  }

  /**
   * Fetch D-1 historical data
   * @param {string} entityId - Entity ID
   * @param {Array} keys - Telemetry keys
   * @returns {Promise} Historical data
   */
  async fetchD1Data(entityId, keys) {
    const endTs = this.getStartOfToday();
    const startTs = endTs - 24 * 60 * 60 * 1000; // 24 hours before

    return this.ctx.http.get(
      `/api/plugins/telemetry/DEVICE/${entityId}/values/timeseries`,
      {
        params: {
          keys: keys.join(','),
          startTs,
          endTs,
          agg: 'NONE',
          limit: 1000
        }
      }
    );
  }

  /**
   * Get start of today timestamp
   */
  getStartOfToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }

  /**
   * Unsubscribe all
   */
  unsubscribeAll() {
    this.subscriptions.forEach(sub => {
      if (sub && sub.unsubscribe) {
        sub.unsubscribe();
      }
    });
    this.subscriptions = [];
  }
}
```

---

## 7. Phase 4: Alert System

### 7.1 Task List

| Task ID | Task | Priority | Dependencies |
|---------|------|----------|--------------|
| P4-01 | Implement alert detection logic | High | P3-03 |
| P4-02 | Create alert queue management | High | P4-01 |
| P4-03 | Implement inactivity window detection | High | P4-01 |
| P4-04 | Create email notification service | High | P4-02 |
| P4-05 | Implement alert history storage | Medium | P4-02 |
| P4-06 | Create Rule Chain for alerts | High | P4-04 |

### 7.2 Alert Service

```javascript
// services/alert.service.js

class AlertService {
  constructor(ctx) {
    this.ctx = ctx;
    this.alertQueue = [];
    this.alertHistory = [];
    this.maxHistory = 100;
    this.alertTypes = {
      OFFLINE: 'offline',
      PHASE_REVERSAL: 'phase_reversal',
      FREQUENCY_ANOMALY: 'frequency_anomaly',
      INACTIVITY_VIOLATION: 'inactivity_violation'
    };
  }

  /**
   * Check all alert conditions for equipment
   * @param {Object} equipment - Equipment data
   * @param {Object} settings - Alert settings
   * @returns {Array} Triggered alerts
   */
  checkAlertConditions(equipment, settings) {
    const alerts = [];

    // Check offline status
    if (!equipment.status) {
      alerts.push(this.createAlert(
        this.alertTypes.OFFLINE,
        equipment,
        `Equipment ${equipment.name} is offline`,
        'critical'
      ));
    }

    // Check phase reversal
    if (equipment.phaseReversal) {
      alerts.push(this.createAlert(
        this.alertTypes.PHASE_REVERSAL,
        equipment,
        `Phase reversal detected on ${equipment.name}`,
        'critical'
      ));
    }

    // Check grid frequency
    if (settings.alerts.enabled) {
      const freqCheck = this.checkFrequencyAnomaly(
        equipment.gridFrequency,
        settings.alerts.frequencyThreshold
      );
      if (!freqCheck.isNormal) {
        alerts.push(this.createAlert(
          this.alertTypes.FREQUENCY_ANOMALY,
          equipment,
          `Abnormal grid frequency (${freqCheck.frequency} Hz) on ${equipment.name}`,
          'warning'
        ));
      }
    }

    // Check inactivity window violation
    if (settings.inactivityWindow.enabled) {
      const violation = this.checkInactivityViolation(
        equipment,
        settings.inactivityWindow
      );
      if (violation) {
        alerts.push(this.createAlert(
          this.alertTypes.INACTIVITY_VIOLATION,
          equipment,
          `Equipment ${equipment.name} offline during inactivity window`,
          'info'
        ));
      }
    }

    return alerts;
  }

  /**
   * Create alert object
   */
  createAlert(type, equipment, message, severity) {
    return {
      id: this.generateAlertId(),
      type,
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      message,
      severity,
      timestamp: Date.now(),
      acknowledged: false
    };
  }

  /**
   * Check frequency anomaly
   */
  checkFrequencyAnomaly(frequency, threshold) {
    const nominal = 60; // Hz
    const deviation = Math.abs((frequency - nominal) / nominal) * 100;
    return {
      frequency,
      deviation,
      isNormal: deviation <= threshold
    };
  }

  /**
   * Check inactivity window violation
   */
  checkInactivityViolation(equipment, windowSettings) {
    const now = new Date();
    const currentHour = now.getHours();

    const isInWindow = this.isInInactivityWindow(
      currentHour,
      windowSettings.startHour,
      windowSettings.endHour
    );

    // Alert if equipment is offline during inactivity window
    // (unexpected - should be controlled OFF, not failed)
    return isInWindow && !equipment.status;
  }

  /**
   * Check if current hour is within inactivity window
   */
  isInInactivityWindow(currentHour, startHour, endHour) {
    if (startHour > endHour) {
      // Window crosses midnight (e.g., 22:00 - 05:00)
      return currentHour >= startHour || currentHour < endHour;
    }
    return currentHour >= startHour && currentHour < endHour;
  }

  /**
   * Process alert queue and send notifications
   */
  async processAlertQueue(settings) {
    if (this.alertQueue.length === 0) return;

    const alertsToSend = [...this.alertQueue];
    this.alertQueue = [];

    // Group alerts by severity
    const grouped = this.groupAlertsBySeverity(alertsToSend);

    // Send critical alerts immediately
    if (grouped.critical.length > 0) {
      await this.sendEmailNotification(
        settings.alerts.emailRecipients,
        'CRITICAL: Equipment Alerts',
        this.formatAlertEmail(grouped.critical)
      );
    }

    // Add to history
    this.addToHistory(alertsToSend);
  }

  /**
   * Group alerts by severity
   */
  groupAlertsBySeverity(alerts) {
    return {
      critical: alerts.filter(a => a.severity === 'critical'),
      warning: alerts.filter(a => a.severity === 'warning'),
      info: alerts.filter(a => a.severity === 'info')
    };
  }

  /**
   * Format alerts for email
   */
  formatAlertEmail(alerts) {
    let body = 'The following alerts have been triggered:\n\n';

    alerts.forEach(alert => {
      const time = new Date(alert.timestamp).toLocaleString();
      body += `[${alert.severity.toUpperCase()}] ${alert.message}\n`;
      body += `  Equipment: ${alert.equipmentName}\n`;
      body += `  Time: ${time}\n\n`;
    });

    return body;
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(recipients, subject, body) {
    if (!recipients || recipients.length === 0) return;

    try {
      await this.ctx.http.post('/api/plugins/telemetry/email', {
        to: recipients.join(','),
        subject: `[Myio] ${subject}`,
        body
      });
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  /**
   * Add alerts to history
   */
  addToHistory(alerts) {
    this.alertHistory = [
      ...alerts,
      ...this.alertHistory
    ].slice(0, this.maxHistory);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 10) {
    return this.alertHistory.slice(0, limit);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
    }
  }

  /**
   * Get active (unacknowledged) alerts count
   */
  getActiveAlertsCount() {
    return this.alertHistory.filter(a => !a.acknowledged).length;
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 7.3 Rule Chain Configuration

```json
{
  "ruleChain": {
    "name": "Operational Indicators Alert Processor",
    "type": "CORE",
    "firstRuleNodeId": "check-status-node"
  },
  "nodes": [
    {
      "id": "check-status-node",
      "type": "FILTER",
      "name": "Check Equipment Status",
      "configuration": {
        "jsScript": "return msg.status === false;"
      }
    },
    {
      "id": "check-phase-reversal-node",
      "type": "FILTER",
      "name": "Check Phase Reversal",
      "configuration": {
        "jsScript": "return msg.phaseReversal === true;"
      }
    },
    {
      "id": "check-frequency-node",
      "type": "FILTER",
      "name": "Check Grid Frequency",
      "configuration": {
        "jsScript": "var nominal = 60; var threshold = 5; var deviation = Math.abs((msg.gridFrequency - nominal) / nominal) * 100; return deviation > threshold;"
      }
    },
    {
      "id": "create-alarm-node",
      "type": "ACTION",
      "name": "Create Alarm",
      "configuration": {
        "alarmType": "Equipment Failure",
        "severity": "CRITICAL"
      }
    },
    {
      "id": "send-email-node",
      "type": "EXTERNAL",
      "name": "Send Email Alert",
      "configuration": {
        "mailTo": "${alertRecipients}",
        "subject": "[Myio] Equipment Alert - ${deviceName}",
        "body": "Alert: ${alertMessage}\nEquipment: ${deviceName}\nTime: ${timestamp}"
      }
    }
  ],
  "connections": [
    { "fromId": "check-status-node", "toId": "create-alarm-node", "type": "True" },
    { "fromId": "check-phase-reversal-node", "toId": "create-alarm-node", "type": "True" },
    { "fromId": "check-frequency-node", "toId": "create-alarm-node", "type": "True" },
    { "fromId": "create-alarm-node", "toId": "send-email-node", "type": "Success" }
  ]
}
```

---

## 8. Phase 5: Reporting

### 8.1 Task List

| Task ID | Task | Priority | Dependencies |
|---------|------|----------|--------------|
| P5-01 | Implement report data aggregation | High | P3-04 |
| P5-02 | Create PDF report template | High | P5-01 |
| P5-03 | Create CSV export function | Medium | P5-01 |
| P5-04 | Implement daily D-1 report | High | P5-02 |
| P5-05 | Implement monthly consolidated report | High | P5-02 |
| P5-06 | Add report scheduling automation | Medium | P5-04, P5-05 |

### 8.2 Report Service

```javascript
// services/report.service.js

class ReportService {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Generate daily D-1 report data
   * @param {Array} equipment - Equipment list with KPIs
   * @returns {Object} Report data
   */
  generateDailyReportData(equipment) {
    const reportDate = new Date();
    reportDate.setDate(reportDate.getDate() - 1); // D-1

    return {
      reportType: 'daily',
      reportDate: reportDate.toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      summary: this.calculateSummary(equipment),
      equipment: equipment.map(eq => ({
        name: eq.name,
        type: eq.type,
        status: eq.status ? 'Online' : 'Offline',
        availability: eq.availability,
        mtbf: eq.mtbf,
        mttr: eq.mttr,
        alertCount: eq.alertCount || 0
      })),
      ranking: this.generateRanking(equipment)
    };
  }

  /**
   * Generate monthly consolidated report data
   * @param {Array} equipment - Equipment list
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @returns {Object} Report data
   */
  generateMonthlyReportData(equipment, month, year) {
    return {
      reportType: 'monthly',
      month,
      year,
      generatedAt: new Date().toISOString(),
      summary: this.calculateSummary(equipment),
      equipment: equipment.map(eq => ({
        name: eq.name,
        type: eq.type,
        avgAvailability: eq.availability,
        avgMtbf: eq.mtbf,
        avgMttr: eq.mttr,
        totalAlerts: eq.alertCount || 0,
        downtime: this.calculateDowntime(eq)
      })),
      ranking: this.generateRanking(equipment),
      trends: this.calculateTrends(equipment),
      alerts: this.summarizeAlerts(equipment)
    };
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(equipment) {
    const total = equipment.length;
    const online = equipment.filter(eq => eq.status).length;
    const avgAvailability = equipment.reduce((sum, eq) => sum + eq.availability, 0) / total;
    const avgMtbf = equipment.reduce((sum, eq) => sum + eq.mtbf, 0) / total;
    const avgMttr = equipment.reduce((sum, eq) => sum + eq.mttr, 0) / total;

    return {
      totalEquipment: total,
      onlineCount: online,
      offlineCount: total - online,
      avgAvailability: Math.round(avgAvailability * 10) / 10,
      avgMtbf: Math.round(avgMtbf * 10) / 10,
      avgMttr: Math.round(avgMttr * 10) / 10
    };
  }

  /**
   * Generate equipment ranking by availability
   */
  generateRanking(equipment) {
    return [...equipment]
      .sort((a, b) => b.availability - a.availability)
      .map((eq, index) => ({
        rank: index + 1,
        name: eq.name,
        availability: eq.availability
      }));
  }

  /**
   * Calculate downtime hours
   */
  calculateDowntime(equipment) {
    // Estimate based on MTTR and stop count
    return Math.round(equipment.mttr * (equipment.stopCount || 0) * 10) / 10;
  }

  /**
   * Calculate trends (placeholder for historical analysis)
   */
  calculateTrends(equipment) {
    return {
      availabilityTrend: 'stable',
      mtbfTrend: 'improving',
      mttrTrend: 'stable'
    };
  }

  /**
   * Summarize alerts
   */
  summarizeAlerts(equipment) {
    const totalAlerts = equipment.reduce((sum, eq) => sum + (eq.alertCount || 0), 0);
    return {
      totalAlerts,
      byType: {
        offline: Math.floor(totalAlerts * 0.4),
        phaseReversal: Math.floor(totalAlerts * 0.2),
        frequencyAnomaly: Math.floor(totalAlerts * 0.3),
        other: Math.floor(totalAlerts * 0.1)
      }
    };
  }

  /**
   * Export to CSV
   * @param {Object} reportData - Report data
   * @returns {string} CSV content
   */
  exportToCSV(reportData) {
    const headers = [
      'Equipment Name',
      'Type',
      'Status',
      'Availability (%)',
      'MTBF (h)',
      'MTTR (h)',
      'Alerts'
    ];

    const rows = reportData.equipment.map(eq => [
      eq.name,
      eq.type,
      eq.status,
      eq.availability || eq.avgAvailability,
      eq.mtbf || eq.avgMtbf,
      eq.mttr || eq.avgMttr,
      eq.alertCount || eq.totalAlerts
    ]);

    const csv = [
      `# ${reportData.reportType.toUpperCase()} Report`,
      `# Generated: ${reportData.generatedAt}`,
      `# Date: ${reportData.reportDate || `${reportData.month}/${reportData.year}`}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csv;
  }

  /**
   * Export to PDF (using browser print or jsPDF)
   * @param {Object} reportData - Report data
   */
  exportToPDF(reportData) {
    // Generate HTML for PDF
    const html = this.generatePDFHTML(reportData);

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }

  /**
   * Generate HTML for PDF export
   */
  generatePDFHTML(reportData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Operational Indicators Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #4CAF50; }
          h2 { color: #666; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background: #4CAF50; color: white; }
          tr:nth-child(even) { background: #f9f9f9; }
          .summary-grid { display: flex; gap: 20px; margin: 20px 0; }
          .summary-card { flex: 1; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center; }
          .summary-value { font-size: 32px; font-weight: bold; color: #4CAF50; }
          .summary-label { color: #666; margin-top: 5px; }
          .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>Operational Indicators Report</h1>
        <p><strong>Report Type:</strong> ${reportData.reportType}</p>
        <p><strong>Date:</strong> ${reportData.reportDate || `${reportData.month}/${reportData.year}`}</p>
        <p><strong>Generated:</strong> ${new Date(reportData.generatedAt).toLocaleString()}</p>

        <h2>Summary</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-value">${reportData.summary.totalEquipment}</div>
            <div class="summary-label">Total Equipment</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${reportData.summary.avgAvailability}%</div>
            <div class="summary-label">Avg. Availability</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${reportData.summary.avgMtbf}h</div>
            <div class="summary-label">Avg. MTBF</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${reportData.summary.avgMttr}h</div>
            <div class="summary-label">Avg. MTTR</div>
          </div>
        </div>

        <h2>Equipment Details</h2>
        <table>
          <thead>
            <tr>
              <th>Equipment</th>
              <th>Type</th>
              <th>Status</th>
              <th>Availability</th>
              <th>MTBF</th>
              <th>MTTR</th>
              <th>Alerts</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.equipment.map(eq => `
              <tr>
                <td>${eq.name}</td>
                <td>${eq.type}</td>
                <td>${eq.status}</td>
                <td>${eq.availability || eq.avgAvailability}%</td>
                <td>${eq.mtbf || eq.avgMtbf}h</td>
                <td>${eq.mttr || eq.avgMttr}h</td>
                <td>${eq.alertCount || eq.totalAlerts}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>Ranking by Availability</h2>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Equipment</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.ranking.slice(0, 10).map(r => `
              <tr>
                <td>${r.rank}</td>
                <td>${r.name}</td>
                <td>${r.availability}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Generated by Myio Operational Indicators Panel</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Download file
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
```

---

## 9. Phase 6: Testing & QA

### 9.1 Task List

| Task ID | Task | Priority | Dependencies |
|---------|------|----------|--------------|
| P6-01 | Unit tests for calculation service | High | P3-04 |
| P6-02 | Unit tests for alert service | High | P4-05 |
| P6-03 | Integration tests for telemetry | High | P3-06 |
| P6-04 | E2E tests for widget | Medium | P5-06 |
| P6-05 | Performance testing | Medium | P6-04 |
| P6-06 | User acceptance testing | High | P6-05 |

### 9.2 Unit Tests

```javascript
// tests/calculation.test.js

describe('CalculationService', () => {
  let service;

  beforeEach(() => {
    service = new CalculationService();
  });

  describe('calculateMTBF', () => {
    it('should calculate MTBF correctly', () => {
      // 480 min operation, 60 min maintenance, 2 stops
      // MTBF = (480 - 60) / 2 = 210 min = 3.5 hours
      const result = service.calculateMTBF(480, 60, 2);
      expect(result).toBe(3.5);
    });

    it('should return total uptime when no stops', () => {
      // 480 min operation, 0 maintenance, 0 stops
      // MTBF = 480 / 60 = 8 hours
      const result = service.calculateMTBF(480, 0, 0);
      expect(result).toBe(8);
    });

    it('should handle zero values', () => {
      const result = service.calculateMTBF(0, 0, 0);
      expect(result).toBe(0);
    });
  });

  describe('calculateMTTR', () => {
    it('should calculate MTTR correctly', () => {
      // 120 min maintenance, 3 stops
      // MTTR = 120 / 3 = 40 min = 0.67 hours
      const result = service.calculateMTTR(120, 3);
      expect(result).toBeCloseTo(0.67, 1);
    });

    it('should return 0 when no stops', () => {
      const result = service.calculateMTTR(0, 0);
      expect(result).toBe(0);
    });
  });

  describe('calculateAvailability', () => {
    it('should calculate availability correctly', () => {
      // MTBF = 10h, MTTR = 2h
      // Availability = 10 / (10 + 2) * 100 = 83.33%
      const result = service.calculateAvailability(10, 2);
      expect(result).toBeCloseTo(83.33, 1);
    });

    it('should return 100% when both are zero', () => {
      const result = service.calculateAvailability(0, 0);
      expect(result).toBe(100);
    });

    it('should return 0% when MTBF is zero', () => {
      const result = service.calculateAvailability(0, 5);
      expect(result).toBe(0);
    });

    it('should cap at 100%', () => {
      const result = service.calculateAvailability(100, 0);
      expect(result).toBe(100);
    });
  });

  describe('calculateEquipmentKPIs', () => {
    it('should calculate all KPIs correctly', () => {
      const telemetry = {
        operationTime: 1440, // 24 hours in minutes
        maintenanceTime: 60,  // 1 hour
        stopCount: 2
      };

      const result = service.calculateEquipmentKPIs(telemetry);

      expect(result.mtbf).toBeCloseTo(11.5, 1);
      expect(result.mttr).toBeCloseTo(0.5, 1);
      expect(result.availability).toBeCloseTo(95.8, 1);
    });
  });

  describe('checkGridFrequency', () => {
    it('should detect normal frequency', () => {
      const result = service.checkGridFrequency(60, 5);
      expect(result.isNormal).toBe(true);
    });

    it('should detect abnormal frequency', () => {
      const result = service.checkGridFrequency(55, 5);
      expect(result.isNormal).toBe(false);
      expect(result.deviation).toBeGreaterThan(5);
    });
  });
});

// tests/alert.test.js

describe('AlertService', () => {
  let service;
  let mockCtx;

  beforeEach(() => {
    mockCtx = {
      http: {
        post: jest.fn().mockResolvedValue({})
      }
    };
    service = new AlertService(mockCtx);
  });

  describe('isInInactivityWindow', () => {
    it('should detect time in window (same day)', () => {
      // Window: 10:00 - 14:00
      expect(service.isInInactivityWindow(12, 10, 14)).toBe(true);
      expect(service.isInInactivityWindow(9, 10, 14)).toBe(false);
      expect(service.isInInactivityWindow(15, 10, 14)).toBe(false);
    });

    it('should detect time in window (crosses midnight)', () => {
      // Window: 22:00 - 05:00
      expect(service.isInInactivityWindow(23, 22, 5)).toBe(true);
      expect(service.isInInactivityWindow(3, 22, 5)).toBe(true);
      expect(service.isInInactivityWindow(12, 22, 5)).toBe(false);
    });
  });

  describe('checkAlertConditions', () => {
    const settings = {
      alerts: {
        enabled: true,
        frequencyThreshold: 5
      },
      inactivityWindow: {
        enabled: false
      }
    };

    it('should create offline alert', () => {
      const equipment = {
        id: '1',
        name: 'Escalator 01',
        status: false,
        phaseReversal: false,
        gridFrequency: 60
      };

      const alerts = service.checkAlertConditions(equipment, settings);

      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('offline');
      expect(alerts[0].severity).toBe('critical');
    });

    it('should create phase reversal alert', () => {
      const equipment = {
        id: '1',
        name: 'Escalator 01',
        status: true,
        phaseReversal: true,
        gridFrequency: 60
      };

      const alerts = service.checkAlertConditions(equipment, settings);

      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('phase_reversal');
    });

    it('should create frequency anomaly alert', () => {
      const equipment = {
        id: '1',
        name: 'Escalator 01',
        status: true,
        phaseReversal: false,
        gridFrequency: 55
      };

      const alerts = service.checkAlertConditions(equipment, settings);

      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('frequency_anomaly');
    });
  });
});
```

### 9.3 Test Scenarios Matrix

| Scenario | Input | Expected Output | Status |
|----------|-------|-----------------|--------|
| Normal operation | All values normal | Green status, no alerts | |
| Equipment offline | status=false | Red badge, offline alert | |
| Phase reversal | phaseReversal=true | Warning badge, alert | |
| Low frequency | frequency=55Hz | Frequency alert | |
| High frequency | frequency=65Hz | Frequency alert | |
| Inactivity window | 23:00, offline | Inactivity alert | |
| Zero stops | stopCount=0 | 100% availability | |
| Multiple failures | stopCount=10 | Calculated availability | |
| Report CSV export | Valid data | Valid CSV file | |
| Report PDF export | Valid data | Valid PDF | |

---

## 10. Phase 7: Deployment

### 10.1 Task List

| Task ID | Task | Priority | Dependencies |
|---------|------|----------|--------------|
| P7-01 | Create widget bundle package | High | P6-06 |
| P7-02 | Import widget to ThingsBoard | High | P7-01 |
| P7-03 | Configure device profiles | High | P7-02 |
| P7-04 | Setup rule chains | High | P7-02 |
| P7-05 | Create sample dashboard | High | P7-04 |
| P7-06 | Documentation and training | Medium | P7-05 |

### 10.2 Deployment Checklist

```markdown
## Pre-Deployment Checklist

### Environment
- [ ] ThingsBoard version verified (3.5+)
- [ ] Admin access confirmed
- [ ] SMTP configured for email alerts
- [ ] Backup of existing configuration

### Device Setup
- [ ] Device profiles created (Escalator, Elevator)
- [ ] Telemetry keys configured
- [ ] Test devices registered

### Widget
- [ ] Widget bundle created
- [ ] Settings schema validated
- [ ] Widget imported to ThingsBoard
- [ ] Widget tested in dev dashboard

### Rule Engine
- [ ] Alert rule chain imported
- [ ] Email templates configured
- [ ] Rule chain tested

### Dashboard
- [ ] Dashboard created
- [ ] Widget added and configured
- [ ] Filters tested
- [ ] Export functionality tested

### Documentation
- [ ] User guide completed
- [ ] Admin guide completed
- [ ] Training materials prepared

## Post-Deployment Verification

- [ ] Real-time data flowing
- [ ] KPI calculations accurate
- [ ] Alerts triggering correctly
- [ ] Email notifications received
- [ ] Reports generating correctly
- [ ] Mobile responsiveness verified
```

### 10.3 Widget Import Commands

```bash
# Export widget bundle
tb-widget-cli export \
  --widget-bundle "operational-indicators-panel" \
  --output "./dist/operational-indicators-panel.json"

# Import to ThingsBoard
tb-widget-cli import \
  --file "./dist/operational-indicators-panel.json" \
  --url "https://thingsboard.myio.com" \
  --token "${TB_ACCESS_TOKEN}"
```

---

## 11. Technical Specifications

### 11.1 Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

### 11.2 Performance Targets

| Metric | Target |
|--------|--------|
| Initial Load | < 2 seconds |
| Data Update | < 500ms |
| Memory Usage | < 50MB |
| CPU Usage (idle) | < 5% |
| Max Equipment Cards | 100 |

### 11.3 Data Retention

| Data Type | Retention Period |
|-----------|------------------|
| Real-time telemetry | 7 days |
| Hourly aggregations | 30 days |
| Daily aggregations | 1 year |
| Monthly aggregations | 5 years |
| Alert history | 90 days |

---

## 12. Risk Assessment

### 12.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ThingsBoard API changes | Low | High | Version lock, abstraction layer |
| High device count performance | Medium | Medium | Pagination, lazy loading |
| Email delivery failures | Medium | Medium | Retry mechanism, fallback channels |
| Data accuracy issues | Low | High | Validation, reconciliation |

### 12.2 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| User adoption resistance | Medium | Medium | Training, documentation |
| Alert fatigue | Medium | Low | Configurable thresholds |
| Report generation delays | Low | Low | Async processing, caching |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| MTBF | Mean Time Between Failures - average time between system failures |
| MTTR | Mean Time To Repair - average time to repair a failed system |
| Availability | Percentage of time equipment is operational |
| D-1 | Previous day (Day minus 1) |
| Phase Reversal | Reversal of motor rotation direction due to phase inversion |
| Inactivity Window | Scheduled period when equipment is expected to be offline |

---

## Appendix B: References

- [ThingsBoard Widget Development Guide](https://thingsboard.io/docs/user-guide/contribution/widgets-development/)
- [ISO 22400 KPI Standards](https://www.iso.org/standard/56847.html)
- [RFC-0001-Operational-Indicators-Panel](./RFC-0001-Operational-Indicators-Panel.md)
