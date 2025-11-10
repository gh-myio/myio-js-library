# RFC-0074: FOOTER Widget – Layout Harmonization and Equipment Integration

- **Feature Name**: `footer-layout-integration`
- **Start Date**: 2025-01-10
- **RFC PR**: #0074
- **Status**: Proposed
- **Component**: `MYIO-SIM/V1.0.0/FOOTER`

## Summary

This RFC enhances the FOOTER widget by restoring its purple visual theme, enforcing proper layout proportions, and establishing event-based integration with the MAIN and EQUIPMENTS widgets for synchronized equipment context display.

## Motivation

The FOOTER widget currently has several integration and presentation issues that impact the overall MYIO-SIM user experience:

1. **Missing Background Color**: The footer lacks the characteristic purple background present in the v-5.2.0 version, making it visually inconsistent
2. **Insufficient Height**: The footer is too small, making content hard to read and interact with
3. **MAIN Widget Control**: The MAIN widget should control footer visibility similar to v-5.2.0 MAIN_VIEW widget
4. **Disproportionate Layout**: The EQUIPMENTS grid takes too much vertical space, leaving insufficient room for the footer (should be ~85% equipments / ~15% footer)
5. **Missing Equipment Selection Sync**: When selecting an equipment card in EQUIPMENTS, the information doesn't propagate to the FOOTER widget

These issues were identified during integration tests of MYIO-SIM/V1.0.0/FOOTER compared to the stable behavior in v-5.2.0/WIDGET/FOOTER, where the purple theme, correct height, and equipment selection propagation were verified as baseline.

These issues reduce the cohesiveness of the MYIO-SIM interface and limit the footer's usefulness as an information display component.

## Guide-level Explanation

### Problem 1: Missing Purple Background and Small Height

**Current Appearance:**
```
┌─────────────────────────────────────────┐
│                                          │
│        EQUIPMENTS GRID (Very Tall)       │
│                                          │
│                                          │
│                                          │
│                                          │
└─────────────────────────────────────────┘
┌──────────────────────────────────────────┐ ← No purple background
│ Footer (Too Small)                       │ ← Hard to read
└──────────────────────────────────────────┘
```

**Expected Appearance:**
```
┌─────────────────────────────────────────┐
│                                          │
│        EQUIPMENTS GRID (~85% height)     │
│                                          │
│                                          │
└─────────────────────────────────────────┘
╔══════════════════════════════════════════╗ ← Purple background
║  Footer (~15% height)                    ║ ← Adequate size
║  [Equipment Details Here]                ║
╚══════════════════════════════════════════╝
```

### Problem 2: MAIN Widget Should Control Footer

**Reference Implementation:** `v-5.2.0/WIDGET/MAIN_VIEW/controller.js`

The MAIN widget should:
- Initialize the footer visibility state
- Show/hide footer based on user interaction or events
- Pass configuration to footer (theme, size, etc.)

**Proposed Event Flow:**
```
MAIN Widget onInit
    ↓
Set footer visibility (default: visible)
    ↓
Dispatch footer-config event
    ↓
FOOTER Widget listens and applies config
```

### Problem 3: Layout Proportion 85% / 15%

The vertical space should be distributed:
- **EQUIPMENTS Grid**: 85% of viewport height (after header)
- **FOOTER Widget**: 15% of viewport height

This ensures the footer is visible and functional without requiring scrolling, while still giving prominence to equipment cards.

### Problem 4: Equipment Selection Not Synced to Footer

**Current Behavior:**
```
User clicks Equipment Card in EQUIPMENTS
    ↓
Card highlights in EQUIPMENTS widget
    ↓
FOOTER shows nothing (no update)
```

**Expected Behavior:**
```
User clicks Equipment Card in EQUIPMENTS
    ↓
Card highlights in EQUIPMENTS widget
    ↓
Event dispatched: myio:equipment-selected
    ↓
FOOTER listens and displays equipment details
    ↓
FOOTER shows: Name, Type, Status, Consumption, Location, etc.
```

## Reference-level Explanation

### Implementation Details

All changes are applied under:
`C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\FOOTER`
and coordinated with MAIN and EQUIPMENTS modules in the same version path.

#### 1. Add Purple Background and Increase Height

**Location:** `src/MYIO-SIM/V1.0.0/FOOTER/style.css`

**Reference:** `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/FOOTER/style.css`

**Proposed CSS:**

```css
/* src/MYIO-SIM/V1.0.0/FOOTER/style.css */

.footer-container {
  /* Layout */
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 15vh; /* 15% of viewport height */
  min-height: 120px; /* Minimum readable height */
  max-height: 200px; /* Don't grow too large on tall screens */

  /* Purple theme background */
  background: linear-gradient(135deg, #6c2fbf 0%, #8b5cf6 100%);

  /* Visual styling */
  box-shadow: 0 -4px 20px rgba(108, 47, 191, 0.2);
  border-top: 2px solid rgba(255, 255, 255, 0.1);

  /* Content layout */
  display: flex;
  align-items: center;
  padding: 16px 24px;
  gap: 24px;

  /* Ensure above other content */
  z-index: 100;

  /* Smooth transitions */
  transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
}

/* Hidden state (when MAIN decides to hide) */
.footer-container.hidden {
  transform: translateY(100%);
  opacity: 0;
  pointer-events: none;
}

/* Content styling */
.footer-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 32px;
  color: white;
  font-family: "Inter", sans-serif;
}

/* Equipment info section */
.footer-equipment-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.footer-equipment-name {
  font-size: 18px;
  font-weight: 600;
  color: white;
}

.footer-equipment-type {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

/* Status indicator */
.footer-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.footer-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981; /* Green for online */
}

.footer-status-dot.offline {
  background: #ef4444; /* Red for offline */
}

.footer-status-dot.waiting {
  background: #f59e0b; /* Orange for waiting */
}

/* Metrics section */
.footer-metrics {
  display: flex;
  gap: 24px;
}

.footer-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.footer-metric-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.footer-metric-value {
  font-size: 20px;
  font-weight: 600;
  color: white;
}

/* Actions section */
.footer-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.footer-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.footer-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
}

.footer-btn:active {
  transform: translateY(1px);
}

/* Empty state (no equipment selected) */
.footer-empty {
  flex: 1;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .footer-container {
    height: 18vh;
    min-height: 100px;
  }

  .footer-metrics {
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .footer-container {
    flex-direction: column;
    height: auto;
    min-height: 140px;
    padding: 12px 16px;
  }

  .footer-content {
    flex-direction: column;
    gap: 12px;
  }

  .footer-actions {
    margin-left: 0;
    width: 100%;
    justify-content: center;
  }
}
```

**Template Structure:**

```html
<!-- src/MYIO-SIM/V1.0.0/FOOTER/template.html -->

<div class="footer-container" id="myio-footer">
  <!-- Content shown when equipment is selected -->
  <div class="footer-content" id="footer-content" style="display: none;">
    <!-- Equipment Info -->
    <div class="footer-equipment-info">
      <div class="footer-equipment-name" id="footer-equipment-name">—</div>
      <div class="footer-equipment-type" id="footer-equipment-type">—</div>
    </div>

    <!-- Status Indicator -->
    <div class="footer-status">
      <span class="footer-status-dot" id="footer-status-dot"></span>
      <span id="footer-status-text">Online</span>
    </div>

    <!-- Metrics -->
    <div class="footer-metrics">
      <div class="footer-metric">
        <div class="footer-metric-label">Consumo</div>
        <div class="footer-metric-value" id="footer-consumption">— kWh</div>
      </div>
      <div class="footer-metric">
        <div class="footer-metric-label">Localização</div>
        <div class="footer-metric-value" id="footer-location">—</div>
      </div>
      <div class="footer-metric">
        <div class="footer-metric-label">Shopping</div>
        <div class="footer-metric-value" id="footer-shopping">—</div>
      </div>
    </div>

    <!-- Actions -->
    <div class="footer-actions">
      <button class="footer-btn" id="footer-details-btn">Ver Detalhes</button>
      <button class="footer-btn" id="footer-dashboard-btn">Dashboard</button>
    </div>
  </div>

  <!-- Empty state (no equipment selected) -->
  <div class="footer-empty" id="footer-empty">
    Selecione um equipamento para ver detalhes
  </div>
</div>
```

#### 2. MAIN Widget Controls Footer Visibility

**Location:** `src/MYIO-SIM/V1.0.0/MAIN/controller.js`

**Reference:** `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`

**Implementation:**

```javascript
/* src/MYIO-SIM/V1.0.0/MAIN/controller.js */

/**
 * Footer visibility state and configuration
 */
const FooterController = {
  isVisible: true,
  config: {
    theme: 'purple',
    height: '15vh',
    minHeight: '120px',
    maxHeight: '200px'
  },

  /**
   * Initializes footer visibility and configuration
   */
  init() {
    console.log("[MAIN] Initializing footer controller");

    // Check if footer should be visible (could be from settings)
    const savedVisibility = localStorage.getItem('myio-footer-visible');
    if (savedVisibility !== null) {
      this.isVisible = savedVisibility === 'true';
    }

    // Dispatch initial configuration
    this.dispatchConfig();

    // Set initial visibility
    this.setVisibility(this.isVisible);
  },

  /**
   * Dispatches footer configuration to FOOTER widget
   */
  dispatchConfig() {
    const event = new CustomEvent('myio:footer-config', {
      detail: {
        ...this.config,
        visible: this.isVisible
      }
    });

    window.dispatchEvent(event);
    if (window.parent !== window) {
      window.parent.dispatchEvent(event);
    }

    console.log("[MAIN] Footer config dispatched:", this.config);
  },

  /**
   * Shows or hides the footer
   * @param {boolean} visible - Whether footer should be visible
   */
  setVisibility(visible) {
    this.isVisible = visible;

    const event = new CustomEvent('myio:footer-visibility', {
      detail: { visible }
    });

    window.dispatchEvent(event);
    if (window.parent !== window) {
      window.parent.dispatchEvent(event);
    }

    // Save preference
    localStorage.setItem('myio-footer-visible', visible.toString());

    console.log(`[MAIN] Footer visibility set to: ${visible}`);
  },

  /**
   * Toggles footer visibility
   */
  toggle() {
    this.setVisibility(!this.isVisible);
  }
};

// Initialize footer controller in onInit
self.onInit = async function() {
  // ... existing initialization code ...

  // Initialize footer control
  FooterController.init();

  // ... rest of initialization ...
};

// Expose toggle function for UI controls if needed
window.MyIOFooterController = FooterController;
```

**FOOTER Widget Listens to MAIN:**

```javascript
/* src/MYIO-SIM/V1.0.0/FOOTER/controller.js */

self.onInit = function() {
  console.log("[FOOTER] Initializing...");

  // Listen for configuration from MAIN
  window.addEventListener('myio:footer-config', (ev) => {
    console.log("[FOOTER] Received configuration:", ev.detail);
    applyFooterConfig(ev.detail);
  });

  // Listen for visibility changes
  window.addEventListener('myio:footer-visibility', (ev) => {
    console.log("[FOOTER] Visibility changed:", ev.detail.visible);
    setFooterVisibility(ev.detail.visible);
  });

  // Also listen on parent window (for iframe context)
  if (window.parent !== window) {
    window.parent.addEventListener('myio:footer-config', (ev) => {
      applyFooterConfig(ev.detail);
    });

    window.parent.addEventListener('myio:footer-visibility', (ev) => {
      setFooterVisibility(ev.detail.visible);
    });
  }

  // Initialize empty state
  showEmptyState();
};

/**
 * Applies configuration received from MAIN
 */
function applyFooterConfig(config) {
  const footer = document.getElementById('myio-footer');
  if (!footer) return;

  // Apply styling
  if (config.height) {
    footer.style.height = config.height;
  }
  if (config.minHeight) {
    footer.style.minHeight = config.minHeight;
  }
  if (config.maxHeight) {
    footer.style.maxHeight = config.maxHeight;
  }

  // Apply visibility
  if (typeof config.visible === 'boolean') {
    setFooterVisibility(config.visible);
  }

  console.log("[FOOTER] Configuration applied");
}

/**
 * Sets footer visibility
 */
function setFooterVisibility(visible) {
  const footer = document.getElementById('myio-footer');
  if (!footer) return;

  if (visible) {
    footer.classList.remove('hidden');
  } else {
    footer.classList.add('hidden');
  }
}
```

#### 3. Adjust Layout Proportion (85% / 15%)

**Location:** `src/MYIO-SIM/V1.0.0/MAIN/style.css` or parent layout

**Current Problem:**
EQUIPMENTS widget takes all available space, pushing footer out of view.

**Solution:**
Adjust the grid template or flex layout to enforce the 85/15 ratio.

**Implementation:**

```css
/* Assuming MAIN or parent container controls layout */

.myio-sim-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.myio-sim-header {
  flex: none; /* Fixed header size */
  height: 60px; /* Or whatever header height is */
}

.myio-sim-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.equipments-container {
  flex: 0 0 85%; /* Take 85% of content area */
  overflow-y: auto;
  overflow-x: hidden;
}

.footer-container {
  flex: 0 0 15%; /* Take 15% of content area */
  min-height: 120px;
  max-height: 200px;
}

/* Alternative using CSS Grid */
.myio-sim-content-grid {
  display: grid;
  grid-template-rows: 85% 15%;
  height: calc(100vh - 60px); /* Subtract header height */
  overflow: hidden;
}

.equipments-container-grid {
  overflow-y: auto;
  overflow-x: hidden;
}

.footer-container-grid {
  min-height: 120px;
  max-height: 200px;
}
```

**Practical Implementation in MAIN:**

```javascript
/* src/MYIO-SIM/V1.0.0/MAIN/controller.js */

/**
 * Adjusts layout proportions for EQUIPMENTS and FOOTER
 */
function initializeLayoutProportions() {
  console.log("[MAIN] Initializing layout proportions (85% / 15%)");

  // This depends on how widgets are embedded in ThingsBoard
  // May need to adjust parent container styles

  // Option 1: Inject global styles
  const style = document.createElement('style');
  style.textContent = `
    /* Force equipment grid to respect footer space */
    .equipment-grid-container {
      max-height: 85vh !important;
      overflow-y: auto !important;
    }

    /* Ensure footer is visible */
    .footer-container {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      height: 15vh !important;
      min-height: 120px !important;
      z-index: 100 !important;
    }

    /* Add padding to body to account for fixed footer */
    body {
      padding-bottom: 15vh !important;
    }
  `;
  document.head.appendChild(style);

  console.log("[MAIN] Layout proportions applied");
}

// Call in onInit
self.onInit = async function() {
  // ... existing code ...

  initializeLayoutProportions();

  // ... rest of code ...
};
```

#### 4. Equipment Selection Sync to Footer

**Event Dispatched from EQUIPMENTS:**

```javascript
/* src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js */

/**
 * Handles equipment card click
 * Dispatches event for FOOTER to display equipment details
 */
function handleEquipmentClick(equipment) {
  console.log("[EQUIPMENTS] Equipment selected:", equipment.id);

  // Highlight selected card (existing behavior)
  highlightSelectedCard(equipment.id);

  // Dispatch event with full equipment data
  const event = new CustomEvent('myio:equipment-selected', {
    detail: {
      id: equipment.id || equipment.ingestionId,
      name: equipment.name,
      type: equipment.deviceType,
      deviceProfile: equipment.deviceProfile,
      status: equipment.connectionStatus || 'unknown',
      consumption: equipment.consumption || equipment.lastValue || 0,
      unit: equipment.unit || 'kWh',

      // Location information
      location: equipment.location,
      floor: equipment.floor,
      zone: equipment.zone,

      // Shopping information
      customerId: equipment.customerId,
      customerName: equipment.customerName || equipment.shoppingName,

      // Timestamps
      lastUpdate: equipment.lastUpdate,
      timestamp: equipment.timestamp,

      // Full object for advanced use cases
      _fullData: equipment
    }
  });

  window.dispatchEvent(event);

  // Also dispatch to parent window (for iframe context)
  if (window.parent !== window) {
    window.parent.dispatchEvent(event);
  }

  console.log("[EQUIPMENTS] Equipment selection event dispatched");
}

// Wire up click handlers in card rendering
function renderEquipmentCard(equipment) {
  const card = document.createElement('div');
  card.className = 'equipment-card';

  // ... card rendering code ...

  // Add click handler
  card.addEventListener('click', () => {
    handleEquipmentClick(equipment);
  });

  return card;
}
```

**Event Received in FOOTER:**

```javascript
/* src/MYIO-SIM/V1.0.0/FOOTER/controller.js */

self.onInit = function() {
  // ... existing initialization ...

  // Listen for equipment selection
  window.addEventListener('myio:equipment-selected', (ev) => {
    console.log("[FOOTER] Equipment selected:", ev.detail);
    displayEquipmentDetails(ev.detail);
  });

  // Also listen on parent window
  if (window.parent !== window) {
    window.parent.addEventListener('myio:equipment-selected', (ev) => {
      displayEquipmentDetails(ev.detail);
    });
  }
};

/**
 * Displays equipment details in footer
 */
function displayEquipmentDetails(equipment) {
  console.log("[FOOTER] Displaying equipment details:", equipment);

  // Hide empty state
  hideEmptyState();

  // Show content section
  const content = document.getElementById('footer-content');
  if (content) {
    content.style.display = 'flex';
  }

  // Update equipment name
  const nameEl = document.getElementById('footer-equipment-name');
  if (nameEl) {
    nameEl.textContent = equipment.name || 'Equipamento sem nome';
  }

  // Update equipment type
  const typeEl = document.getElementById('footer-equipment-type');
  if (typeEl) {
    let typeLabel = equipment.type || 'Tipo desconhecido';

    // Enhance with device profile if available
    if (equipment.deviceProfile && equipment.deviceProfile !== 'N/D') {
      typeLabel += ` (${equipment.deviceProfile})`;
    }

    typeEl.textContent = typeLabel;
  }

  // Update status indicator
  updateStatusIndicator(equipment.status);

  // Update consumption
  const consumptionEl = document.getElementById('footer-consumption');
  if (consumptionEl) {
    const formattedConsumption = MyIOLibrary.formatEnergy(equipment.consumption);
    consumptionEl.textContent = formattedConsumption;
  }

  // Update location
  const locationEl = document.getElementById('footer-location');
  if (locationEl) {
    const location = buildLocationString(equipment);
    locationEl.textContent = location;
  }

  // Update shopping name
  const shoppingEl = document.getElementById('footer-shopping');
  if (shoppingEl) {
    shoppingEl.textContent = equipment.customerName || 'N/A';
  }

  // Wire up action buttons
  wireUpActionButtons(equipment);

  console.log("[FOOTER] Equipment details displayed");
}

/**
 * Updates status indicator dot and text
 */
function updateStatusIndicator(status) {
  const dotEl = document.getElementById('footer-status-dot');
  const textEl = document.getElementById('footer-status-text');

  if (!dotEl || !textEl) return;

  const statusLower = String(status || '').toLowerCase();

  // Remove all status classes
  dotEl.classList.remove('offline', 'waiting');

  // Map status to display
  let displayText = 'Desconhecido';
  let dotClass = '';

  if (statusLower === 'online' || statusLower === 'ok' || statusLower === 'running') {
    displayText = 'Online';
    dotClass = ''; // Default green
  } else if (statusLower === 'offline' || statusLower === 'disconnected') {
    displayText = 'Offline';
    dotClass = 'offline';
  } else if (statusLower === 'waiting' || statusLower === 'standby') {
    displayText = 'Aguardando';
    dotClass = 'waiting';
  }

  dotEl.className = `footer-status-dot ${dotClass}`;
  textEl.textContent = displayText;
}

/**
 * Builds location string from equipment data
 */
function buildLocationString(equipment) {
  const parts = [];

  if (equipment.floor) {
    parts.push(`Andar ${equipment.floor}`);
  }
  if (equipment.zone) {
    parts.push(equipment.zone);
  }
  if (equipment.location) {
    parts.push(equipment.location);
  }

  return parts.length > 0 ? parts.join(' - ') : 'Localização não especificada';
}

/**
 * Wires up action buttons with equipment context
 */
function wireUpActionButtons(equipment) {
  // Details button
  const detailsBtn = document.getElementById('footer-details-btn');
  if (detailsBtn) {
    // Remove old listeners
    const newDetailsBtn = detailsBtn.cloneNode(true);
    detailsBtn.parentNode.replaceChild(newDetailsBtn, detailsBtn);

    // Add new listener
    newDetailsBtn.addEventListener('click', () => {
      console.log("[FOOTER] Details button clicked for:", equipment.id);
      openEquipmentDetails(equipment);
    });
  }

  // Dashboard button
  const dashboardBtn = document.getElementById('footer-dashboard-btn');
  if (dashboardBtn) {
    // Remove old listeners
    const newDashboardBtn = dashboardBtn.cloneNode(true);
    dashboardBtn.parentNode.replaceChild(newDashboardBtn, dashboardBtn);

    // Add new listener
    newDashboardBtn.addEventListener('click', () => {
      console.log("[FOOTER] Dashboard button clicked for:", equipment.id);
      openEquipmentDashboard(equipment);
    });
  }
}

/**
 * Opens detailed view for equipment
 */
function openEquipmentDetails(equipment) {
  // Call settings action (same as in EQUIPMENTS)
  if (typeof openDashboardPopupSettings === 'function') {
    openDashboardPopupSettings({
      deviceId: equipment.id,
      deviceName: equipment.name,
      centralName: equipment.customerName,
      // ... other metadata
    });
  } else {
    console.warn("[FOOTER] Settings component not available");
  }
}

/**
 * Opens energy dashboard for equipment
 */
function openEquipmentDashboard(equipment) {
  // Call dashboard action (same as in EQUIPMENTS)
  if (typeof openDashboardPopupEnergy === 'function') {
    openDashboardPopupEnergy({
      deviceId: equipment.id,
      deviceName: equipment.name,
      deviceType: equipment.type,
      customerId: equipment.customerId,
      customerName: equipment.customerName,
      consumption: equipment.consumption,
      origin: 'FOOTER'
    });
  } else {
    console.warn("[FOOTER] Dashboard component not available");
  }
}

/**
 * Shows empty state (no equipment selected)
 */
function showEmptyState() {
  const content = document.getElementById('footer-content');
  const empty = document.getElementById('footer-empty');

  if (content) content.style.display = 'none';
  if (empty) empty.style.display = 'block';
}

/**
 * Hides empty state
 */
function hideEmptyState() {
  const empty = document.getElementById('footer-empty');
  if (empty) empty.style.display = 'none';
}
```

## Drawbacks

1. **Fixed Footer**: A fixed-position footer may overlap content on small screens
2. **Layout Complexity**: Adding 85/15 ratio constraint may complicate responsive design
3. **Event Coupling**: EQUIPMENTS and FOOTER become tightly coupled through events
4. **Performance**: Dispatching events on every card click may have minor performance impact with many rapid clicks
5. **Iframe Context Variability**: Event propagation across iframe boundaries may require postMessage fallback in certain dashboards

## Rationale and Alternatives

### Why Fixed Position Footer?

**Alternative 1:** Relative position footer at bottom of scrollable content
- ❌ Footer not always visible
- ❌ User must scroll to see equipment details

**Alternative 2:** Floating/draggable footer panel
- ⚠️ Adds significant complexity
- ⚠️ May cover important content

**Chosen Approach:** Fixed position with proper z-index
- ✅ Always visible
- ✅ Doesn't interfere with scrolling
- ✅ Predictable behavior

### Why 85% / 15% Ratio?

**Alternative Ratios:**
- 90% / 10%: Footer too small, hard to read
- 80% / 20%: Footer too large, reduces equipment visibility
- 70% / 30%: Wastes vertical space

**Chosen Ratio (85% / 15%):**
- ✅ Balances equipment prominence with footer utility
- ✅ Footer is readable and functional
- ✅ Matches common dashboard patterns

### Why Event-Based Communication?

**Alternative 1:** Direct function calls between widgets
- ❌ Creates tight coupling
- ❌ Breaks if widget order changes

**Alternative 2:** Shared state object
- ⚠️ More complex state management
- ⚠️ Requires synchronization logic

**Chosen Approach:** Custom Events
- ✅ Loose coupling
- ✅ Easy to add more listeners
- ✅ Works across iframe boundaries

## Prior Art

- **v-5.2.0 MAIN_VIEW Widget**: Controls footer visibility
- **v-5.2.0 FOOTER Widget**: Purple background and proper sizing
- **Material Design Bottom Sheets**: Fixed bottom panels with shadows
- **macOS Dock**: Fixed bottom element with backdrop blur

## Unresolved Questions

1. Should footer be hideable with a collapse/expand button?
2. Should footer height be user-adjustable (draggable resize)?
3. Should footer show history of last N selected equipments (tabs)?
4. Should footer support keyboard navigation (arrow keys to cycle equipment)?

## Future Possibilities

1. **Footer Tabs**: Show multiple equipment details simultaneously in tabs
2. **Quick Actions**: Add quick action buttons (restart, configure, export data)
3. **Mini Charts**: Show sparkline consumption charts in footer
4. **Comparison Mode**: Select multiple equipments and compare side-by-side
5. **Notifications**: Show equipment alerts and warnings in footer
6. **Customization**: Allow users to choose which metrics to display
7. **Theme Customization**: Allow dynamic footer color schemes (per customer/holding theme) controlled by customer.themePrimary

## Implementation Plan

### Phase 1: Visual Improvements (Week 1)
- [ ] Add purple gradient background
- [ ] Increase footer height to 15vh
- [ ] Update CSS with shadows and styling
- [ ] Test on different screen sizes

### Phase 2: MAIN Control (Week 1)
- [ ] Implement FooterController in MAIN
- [ ] Add visibility toggle functionality
- [ ] Dispatch configuration events
- [ ] FOOTER listens and applies config

### Phase 3: Layout Adjustment (Week 2)
- [ ] Implement 85% / 15% ratio
- [ ] Fix any overflow or scrolling issues
- [ ] Ensure footer doesn't overlap critical content
- [ ] Test responsive behavior

### Phase 4: Equipment Selection Sync (Week 2)
- [ ] Dispatch myio:equipment-selected from EQUIPMENTS
- [ ] Listen and display details in FOOTER
- [ ] Wire up action buttons
- [ ] Test with different equipment types

### Phase 5: Polish & Testing (Week 3)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Improve accessibility (ARIA labels)
- [ ] Cross-browser testing
- [ ] Performance optimization

## Testing Strategy

### Unit Tests
```javascript
describe('FooterController', () => {
  it('should initialize with default visibility', () => {
    FooterController.init();
    expect(FooterController.isVisible).toBe(true);
  });

  it('should toggle visibility', () => {
    FooterController.setVisibility(true);
    expect(FooterController.isVisible).toBe(true);

    FooterController.toggle();
    expect(FooterController.isVisible).toBe(false);
  });

  it('should persist visibility preference', () => {
    FooterController.setVisibility(false);
    expect(localStorage.getItem('myio-footer-visible')).toBe('false');
  });
});

describe('displayEquipmentDetails', () => {
  it('should hide empty state and show content', () => {
    const mockEquipment = {
      id: 'test-123',
      name: 'Elevador 1',
      type: 'ELEVADOR'
    };

    displayEquipmentDetails(mockEquipment);

    expect(document.getElementById('footer-empty').style.display).toBe('none');
    expect(document.getElementById('footer-content').style.display).toBe('flex');
  });

  it('should update all footer fields', () => {
    const mockEquipment = {
      name: 'Elevador 1',
      type: 'ELEVADOR',
      status: 'online',
      consumption: 1500,
      customerName: 'Shopping Mestre Álvaro'
    };

    displayEquipmentDetails(mockEquipment);

    expect(document.getElementById('footer-equipment-name').textContent).toBe('Elevador 1');
    expect(document.getElementById('footer-shopping').textContent).toBe('Shopping Mestre Álvaro');
  });
});
```

### Integration Tests
- Verify MAIN dispatches footer config on init
- Verify FOOTER receives and applies config
- Verify equipment selection event flows from EQUIPMENTS to FOOTER
- Verify footer visibility persists across page refreshes

### Manual Test Cases
1. **Visual Test**
   - [ ] Load dashboard
   - [ ] Verify footer has purple background
   - [ ] Verify footer height is ~15% of screen
   - [ ] Verify footer has shadow and border
   - [ ] Test on Chrome, Firefox, Safari

2. **Visibility Control Test**
   - [ ] Call FooterController.toggle() from console
   - [ ] Verify footer smoothly slides out
   - [ ] Call toggle() again
   - [ ] Verify footer slides back in
   - [ ] Refresh page
   - [ ] Verify visibility state persisted

3. **Equipment Selection Test**
   - [ ] Click first equipment card
   - [ ] Verify footer updates with equipment details
   - [ ] Verify name, type, status, consumption shown
   - [ ] Click different equipment
   - [ ] Verify footer updates with new details
   - [ ] Click same equipment again
   - [ ] Verify footer remains showing same details

4. **Action Buttons Test**
   - [ ] Select an equipment
   - [ ] Click "Ver Detalhes" button
   - [ ] Verify settings modal opens
   - [ ] Close modal
   - [ ] Click "Dashboard" button
   - [ ] Verify energy dashboard opens

5. **Layout Proportion Test**
   - [ ] Measure equipment grid height
   - [ ] Measure footer height
   - [ ] Verify ratio is approximately 85:15
   - [ ] Resize browser window
   - [ ] Verify ratio maintained

6. **Responsive Test**
   - [ ] Test at 1920x1080 (desktop)
   - [ ] Test at 1366x768 (laptop)
   - [ ] Test at 768x1024 (tablet)
   - [ ] Verify footer adapts appropriately

## Success Metrics

- Footer has purple background matching v-5.2.0 design
- Footer height is 15% of viewport (between 120px-200px)
- EQUIPMENTS grid takes 85% of viewport
- Equipment selection updates footer within 100ms
- Zero reports of footer covering critical content
- User satisfaction with footer visibility increases by 25%
- Footer visibility state persists 100% of the time across sessions (localStorage verified)

## References

- v-5.2.0 MAIN_VIEW Widget: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`
- v-5.2.0 FOOTER Widget: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/FOOTER/`
- Material Design Bottom Sheets: https://material.io/components/sheets-bottom
- CSS Fixed Positioning Best Practices: https://css-tricks.com/fixed-headers-on-page-links-and-overlapping-content-oh-my/
- Event-Driven Architecture Patterns: https://martinfowler.com/articles/201701-event-driven.html
