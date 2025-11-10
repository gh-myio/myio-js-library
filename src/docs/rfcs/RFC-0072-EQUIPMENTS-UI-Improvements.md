# RFC-0072: EQUIPMENTS Widget – UI/UX Harmonization and Modal Stabilization

- **Feature Name**: `equipments-ui-improvements`
- **Start Date**: 2025-01-10
- **RFC PR**: #0072
- **Status**: Proposed
- **Component**: `MYIO-SIM/V1.0.0/EQUIPMENTS`

## Summary

This RFC introduces targeted UI/UX improvements for the EQUIPMENTS widget to align it with the MENU and TELEMETRY widgets, ensuring consistent modal behavior, cleaner menus, and stable dashboard popups.

## Motivation

The EQUIPMENTS widget currently has several usability issues that impact user experience:

1. **Zoom Controls**: The +/- zoom buttons are not functioning properly, creating confusion for users trying to adjust content size
2. **Modal Constraints**: Filter and sorting modals are constrained within the widget boundaries, limiting their usability compared to the MENU widget's full-screen approach
3. **Settings Action Handler**: Equipment card settings don't display central name and other metadata consistently with the v-5.2.0 TELEMETRY widget
4. **Menu Item Clutter**: The "more information" (i) menu item in cards is unnecessary and should be removed
5. **Dashboard Modal Corruption**: The `handleActionDashboard` function intermittently opens modals with broken styles or missing backgrounds when calling `openDashboardPopupEnergy`

These findings originated from user testing on MYIO-SIM/V1.0.0/EQUIPMENTS, specifically compared to the stable behavior of MENU and TELEMETRY widgets in version v-5.2.0.

These issues reduce productivity and create a fragmented user experience across the MYIO-SIM platform.

## Guide-level Explanation

### Problem 1: Zoom Controls Not Functioning

**Current Behavior:**
The +/- zoom buttons in the toolbar are present but do not reliably adjust the content scale, or may cause layout issues.

**Proposed Solution:**
Review and either fix or remove the zoom controls. If keeping them:
- Ensure they properly adjust font sizes and card dimensions
- Maintain layout integrity at all zoom levels
- Persist zoom preference per user session

**Alternative:**
Remove zoom controls and rely on browser's native zoom functionality.

### Problem 2: Constrained Filter/Sort Modals

**Current Behavior:**
```
┌─────────────────────────────────┐
│ EQUIPMENTS Widget               │
│ ┌─────────────┐                 │
│ │ Filter Modal│ ← Constrained   │
│ │             │    within       │
│ │             │    widget       │
│ └─────────────┘                 │
└─────────────────────────────────┘
```

**Proposed Behavior:**
```
┌─────────────────────────────────┐
│ Filter Modal - Full Screen      │
│                                  │
│  [Filters...]                    │
│                                  │
│  [Apply] [Cancel]                │
└─────────────────────────────────┘
```

Adopt the same approach as MENU widget's advanced filter modal.

### Problem 3: Settings Action Handler Enhancement

**Current Implementation:**
`handleActionSettings` in EQUIPMENTS/controller.js doesn't show all metadata.

**Reference Implementation:**
`v-5.2.0/WIDGET/TELEMETRY/controller.js` properly displays:
- `centralName` (shopping center name)
- Equipment location details
- Device metadata

**Goal:**
Standardize the `openDashboardPopupSettings` component call to include all relevant parameters.

### Problem 4: Remove "More Information" Menu Item

The (i) icon menu item should be removed from equipment cards as it's redundant with the main card click action.

### Problem 5: Dashboard Modal Style Corruption

**Issue:**
`handleActionDashboard` has race conditions or state issues causing:
- Modal opens without background overlay
- Broken CSS styling
- Component initialization failures

**Root Cause:**
Inconsistent state management when calling `openDashboardPopupEnergy`.

## Reference-level Explanation

### Implementation Details

All changes will be implemented under:
`C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\EQUIPMENTS`

#### 1. Zoom Control Fix/Removal

**Location:** `src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js`

**Option A - Fix:**
```javascript
// Ensure proper zoom implementation
function setupZoomControls() {
  const fontPlusBtn = document.getElementById("fontPlus");
  const fontMinusBtn = document.getElementById("fontMinus");

  let currentZoom = parseInt(localStorage.getItem('equipments-zoom') || '100');

  fontPlusBtn.addEventListener('click', () => {
    currentZoom = Math.min(currentZoom + 10, 150);
    applyZoom(currentZoom);
  });

  fontMinusBtn.addEventListener('click', () => {
    currentZoom = Math.max(currentZoom - 10, 70);
    applyZoom(currentZoom);
  });
}

function applyZoom(zoom) {
  const container = document.querySelector('.equipment-grid');
  container.style.fontSize = `${zoom}%`;
  localStorage.setItem('equipments-zoom', zoom.toString());
}
```

**Option B - Remove:**
```javascript
// Remove zoom buttons from template.html
// Remove all zoom-related event listeners
// Update CSS to remove .toolbar-zoom styling
```

**Recommendation:** Option B (Remove) - rely on browser zoom for simplicity.

#### 2. Full-Screen Modal Implementation

**Reference:** `src/MYIO-SIM/V1.0.0/MENU/controller.js`

**Current Modal Injection:**
```javascript
// EQUIPMENTS - constrained
function openFilterModal() {
  const modal = document.createElement('div');
  modal.className = 'filter-modal';
  widgetContainer.appendChild(modal); // ❌ Appended to widget
}
```

**Proposed Modal Injection:**
```javascript
// Adopt MENU approach - full screen
function openFilterModal() {
  const modal = document.createElement('div');
  modal.className = 'filter-modal-fullscreen';
  document.body.appendChild(modal); // ✅ Appended to body

  // Add backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  document.body.appendChild(backdrop);

  // Handle ESC key
  const handleEscape = (e) => {
    if (e.key === 'Escape') closeFilterModal();
  };
  document.addEventListener('keydown', handleEscape);

  // Store cleanup reference
  modal._cleanup = () => {
    document.removeEventListener('keydown', handleEscape);
    backdrop.remove();
  };
}

function closeFilterModal() {
  const modal = document.querySelector('.filter-modal-fullscreen');
  if (modal) {
    modal._cleanup?.();
    modal.remove();
  }
}
```

**CSS Changes:**
```css
.filter-modal-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: white;
  overflow-y: auto;
  padding: 24px;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9998;
}
```

#### 3. Standardize Settings Action Handler

**Current Implementation Analysis:**

**EQUIPMENTS/controller.js:**
```javascript
function handleActionSettings(device) {
  // Missing metadata extraction
  openDashboardPopupSettings({
    deviceId: device.id,
    // Missing: centralName, location, etc.
  });
}
```

**Reference - TELEMETRY/controller.js:**
```javascript
function handleActionSettings(device) {
  const centralName = extractCentralName(device);
  const location = extractLocation(device);

  openDashboardPopupSettings({
    deviceId: device.id,
    deviceName: device.name,
    centralName: centralName,
    location: location,
    customerId: device.customerId,
    metadata: {
      deviceType: device.deviceType,
      lastUpdate: device.lastUpdate,
      // ... all relevant fields
    }
  });
}
```

**Proposed Implementation:**
```javascript
// src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js

function handleActionSettings(device) {
  console.log("[EQUIPMENTS] Opening settings for device:", device.id);

  // Extract all metadata following TELEMETRY pattern
  const settingsData = {
    deviceId: device.id || device.ingestionId,
    deviceName: device.name || device.label,

    // Central/Shopping identification
    centralName: extractCentralName(device),
    customerId: device.customerId,
    customerName: device.customerName,

    // Location information
    location: extractLocation(device),
    floor: device.floor,
    zone: device.zone,

    // Technical metadata
    deviceType: device.deviceType,
    deviceProfile: device.deviceProfile,

    // Operational data
    connectionStatus: device.connectionStatus,
    lastUpdate: device.lastUpdate,
    consumption: device.consumption,

    // Context for the popup
    context: 'equipments',
    origin: 'MYIO-SIM-EQUIPMENTS'
  };

  // Call standardized component
  openDashboardPopupSettings(settingsData);
}

function extractCentralName(device) {
  // Try multiple sources for central name
  return device.centralName
    || device.customerName
    || device.shoppingName
    || getShoppingNameById(device.customerId)
    || 'N/A';
}

function extractLocation(device) {
  // Build location string from available data
  const parts = [];

  if (device.floor) parts.push(`Floor ${device.floor}`);
  if (device.zone) parts.push(device.zone);
  if (device.building) parts.push(device.building);

  return parts.length > 0 ? parts.join(' - ') : 'Location not specified';
}

function getShoppingNameById(customerId) {
  // Fallback to get shopping name from global state
  if (window.custumersSelected && Array.isArray(window.custumersSelected)) {
    const shopping = window.custumersSelected.find(c => c.value === customerId);
    return shopping?.name;
  }
  return null;
}
```

#### 4. Remove "More Information" Menu Item

**Location:** `src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js`

**Current Menu Structure:**
```javascript
const menuItems = [
  { icon: 'settings', label: 'Configurações', action: 'settings' },
  { icon: 'info', label: 'Mais Informações', action: 'info' }, // ❌ Remove
  { icon: 'dashboard', label: 'Dashboard', action: 'dashboard' }
];
```

**Proposed Menu Structure:**
```javascript
const menuItems = [
  { icon: 'settings', label: 'Configurações', action: 'settings' },
  { icon: 'dashboard', label: 'Dashboard', action: 'dashboard' }
  // "Mais Informações" removed - main card click provides this
];
```

**Rationale:**
- Main card click already shows detailed information
- Reduces menu clutter
- Follows principle of eliminating redundant UI elements

#### 5. Fix Dashboard Modal Corruption

**Problem Analysis:**

The `handleActionDashboard` function has race conditions when invoking `openDashboardPopupEnergy`:

```javascript
// Current problematic implementation
function handleActionDashboard(device) {
  // Race condition: component may not be ready
  openDashboardPopupEnergy({
    deviceId: device.id
  });
  // Missing: backdrop injection
  // Missing: style initialization check
  // Missing: error handling
}
```

**Root Causes:**
1. Component not fully initialized before being invoked
2. Missing backdrop element injection
3. CSS not loaded or overridden
4. State from previous modal not properly cleaned up

**Proposed Fix:**

```javascript
/**
 * Handles opening energy dashboard for a device
 * Ensures proper component initialization and style loading
 *
 * @param {Object} device - Device object with all metadata
 */
async function handleActionDashboard(device) {
  console.log("[EQUIPMENTS] Opening energy dashboard for:", device.id);

  try {
    // 1. Ensure component is available
    if (typeof openDashboardPopupEnergy !== 'function') {
      console.error("[EQUIPMENTS] openDashboardPopupEnergy component not loaded");
      showError("Dashboard component não disponível");
      return;
    }

    // 2. Clean up any existing modal state
    closeExistingModals();

    // 3. Prepare device data
    const dashboardData = {
      deviceId: device.id || device.ingestionId,
      deviceName: device.name,
      deviceType: device.deviceType,
      customerId: device.customerId,
      customerName: device.customerName || extractCentralName(device),

      // Energy context
      consumption: device.consumption,
      period: 'last-7-days',

      // UI context
      origin: 'EQUIPMENTS',
      returnFocus: true
    };

    // 4. Inject backdrop first
    const backdrop = createModalBackdrop();
    document.body.appendChild(backdrop);

    // 5. Wait for next frame to ensure DOM is ready
    await new Promise(resolve => requestAnimationFrame(resolve));

    // 6. Open modal with proper error handling
    const modalResult = await openDashboardPopupEnergy(dashboardData);

    if (!modalResult || !modalResult.element) {
      console.error("[EQUIPMENTS] Modal failed to initialize");
      backdrop.remove();
      showError("Erro ao abrir dashboard");
      return;
    }

    // 7. Verify modal styles are applied
    verifyModalStyles(modalResult.element);

    // 8. Setup cleanup on close
    modalResult.onClose = () => {
      backdrop.remove();
      console.log("[EQUIPMENTS] Energy dashboard closed");
    };

    console.log("[EQUIPMENTS] Energy dashboard opened successfully");

  } catch (error) {
    console.error("[EQUIPMENTS] Error opening energy dashboard:", error);
    showError("Erro ao abrir dashboard de energia");
    closeExistingModals(); // Cleanup on error
  }
}

/**
 * Creates a proper modal backdrop
 */
function createModalBackdrop() {
  const backdrop = document.createElement('div');
  backdrop.className = 'dashboard-modal-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 9998;
    animation: fadeIn 0.2s ease-in;
  `;

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeExistingModals();
    }
  });

  return backdrop;
}

/**
 * Closes any existing modal instances to prevent conflicts
 */
function closeExistingModals() {
  // Close any existing energy dashboards
  const existingModals = document.querySelectorAll('.energy-dashboard-modal, .dashboard-popup');
  existingModals.forEach(modal => {
    modal.remove();
  });

  // Remove backdrops
  const backdrops = document.querySelectorAll('.dashboard-modal-backdrop, .modal-backdrop');
  backdrops.forEach(backdrop => {
    backdrop.remove();
  });

  console.log("[EQUIPMENTS] Cleaned up existing modals");
}

/**
 * Verifies that modal styles are properly applied
 * @param {HTMLElement} modalElement - The modal DOM element
 */
function verifyModalStyles(modalElement) {
  if (!modalElement) return;

  // Check if modal has proper z-index
  const computedStyle = window.getComputedStyle(modalElement);
  const zIndex = parseInt(computedStyle.zIndex);

  if (isNaN(zIndex) || zIndex < 9999) {
    console.warn("[EQUIPMENTS] Modal z-index too low, forcing correction");
    modalElement.style.zIndex = '9999';
  }

  // Check if modal has proper background
  if (!computedStyle.background || computedStyle.background === 'none') {
    console.warn("[EQUIPMENTS] Modal missing background, forcing correction");
    modalElement.style.background = '#ffffff';
  }

  // Ensure modal is visible
  if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
    console.warn("[EQUIPMENTS] Modal hidden, forcing visibility");
    modalElement.style.display = 'block';
    modalElement.style.visibility = 'visible';
  }
}

/**
 * Shows user-friendly error message
 */
function showError(message) {
  // Implementation depends on notification system
  console.error("[EQUIPMENTS]", message);
  // TODO: Integrate with global notification system
}
```

**Additional CSS to ensure proper styling:**

```css
/* src/MYIO-SIM/V1.0.0/EQUIPMENTS/style.css */

/* Ensure energy dashboard modal always renders correctly */
.energy-dashboard-modal,
.dashboard-popup {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  z-index: 9999 !important;
  background: #ffffff !important;
  border-radius: 12px !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
  max-width: 90vw !important;
  max-height: 90vh !important;
  overflow: hidden !important;
}

.dashboard-modal-backdrop {
  pointer-events: all !important;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Prevent body scroll when modal is open */
body.modal-open {
  overflow: hidden !important;
}
```

## Drawbacks

1. **Breaking Changes**: Full-screen modals may surprise users familiar with the current constrained behavior
2. **Development Time**: Implementing proper async modal handling requires careful testing
3. **Backwards Compatibility**: Changes to `handleActionSettings` signature may affect other components if they depend on old behavior
4. **Visual Differences**: Modal animations may require minor CSS re-tuning in other widgets for consistency

## Rationale and Alternatives

### Why Full-Screen Modals?

**Alternative 1:** Keep constrained modals but make them larger
- ❌ Still limited by widget size
- ❌ Doesn't solve usability issues on small screens

**Alternative 2:** Use browser's native dialog element
- ✅ Native focus management
- ❌ Limited styling options
- ❌ Browser compatibility concerns

**Chosen Approach:** Body-level modal injection (like MENU)
- ✅ Consistent with existing MENU widget
- ✅ Full control over styling
- ✅ Works across all browsers

### Why Remove Zoom Controls?

**Alternative 1:** Fix zoom implementation
- ⚠️ Adds complexity
- ⚠️ Browser native zoom already available
- ⚠️ Must maintain zoom state

**Alternative 2:** Keep but hide in settings
- ⚠️ Users won't discover feature
- ⚠️ Still adds code complexity

**Chosen Approach:** Remove entirely
- ✅ Reduces code complexity
- ✅ Browser zoom is more reliable
- ✅ One less thing to maintain

## Prior Art

- **MENU Widget**: Successfully uses full-screen modals for advanced filtering
- **v-5.2.0 TELEMETRY Widget**: Proper metadata display in settings action
- **Material Design**: Recommends full-screen dialogs on mobile devices
- **ThingsBoard Platform**: Uses body-level modals for critical actions

## Unresolved Questions

1. Should zoom controls be removed completely or hidden behind a settings toggle?
2. Should modal animations be configurable (fade vs. slide)?
3. What should happen if `openDashboardPopupEnergy` is not available? Graceful degradation or hard error?

## Future Possibilities

1. **Unified Modal System**: Create a shared modal service used by all MYIO-SIM widgets
2. **Keyboard Navigation**: Add full keyboard support for modal interactions (Tab, Shift+Tab, Escape, Enter)
3. **Modal State Persistence**: Remember user's last filter/sort selections across sessions
4. **A11y Improvements**: Add proper ARIA labels and focus management for screen readers
5. **Mobile Optimization**: Specific modal layouts for mobile breakpoints
6. **Shared UI Hooks**: Consolidate modal, settings, and dashboard handlers into myio-js-library core utilities for all widgets

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)
- [ ] Fix dashboard modal corruption (`handleActionDashboard`)
- [ ] Remove "More Information" menu item
- [ ] Add proper error handling to all modal invocations

### Phase 2: Modal Improvements (Week 2)
- [ ] Implement full-screen filter modal
- [ ] Implement full-screen sort modal
- [ ] Add backdrop and ESC key handling

### Phase 3: Settings Enhancement (Week 3)
- [ ] Standardize `handleActionSettings` implementation
- [ ] Extract central name and location metadata
- [ ] Test with all device types

### Phase 4: Cleanup (Week 4)
- [ ] Remove or fix zoom controls
- [ ] Update documentation
- [ ] Add unit tests for modal functions

## Testing Strategy

### Unit Tests
```javascript
describe('handleActionDashboard', () => {
  it('should close existing modals before opening new one', async () => {
    // Create existing modal
    const existingModal = document.createElement('div');
    existingModal.className = 'energy-dashboard-modal';
    document.body.appendChild(existingModal);

    // Open new modal
    await handleActionDashboard(mockDevice);

    // Verify old modal was removed
    expect(document.querySelector('.energy-dashboard-modal')).toBeTruthy();
    expect(document.querySelectorAll('.energy-dashboard-modal')).toHaveLength(1);
  });

  it('should create backdrop when opening modal', async () => {
    await handleActionDashboard(mockDevice);

    const backdrop = document.querySelector('.dashboard-modal-backdrop');
    expect(backdrop).toBeTruthy();
    expect(backdrop.style.zIndex).toBe('9998');
  });

  it('should handle component not available gracefully', async () => {
    // Mock missing component
    window.openDashboardPopupEnergy = undefined;

    const consoleSpy = jest.spyOn(console, 'error');
    await handleActionDashboard(mockDevice);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('component not loaded')
    );
  });
});
```

### Integration Tests
- Open equipment card settings and verify all metadata is displayed
- Open filter modal and verify it covers full screen
- Open dashboard modal multiple times and verify no style corruption
- Test modal cleanup on navigation away from widget

### Manual Test Cases
1. **Zoom Controls Test**
   - [ ] Click + button 5 times
   - [ ] Verify content scales properly
   - [ ] Click - button 5 times
   - [ ] Verify content scales properly
   - [ ] Refresh page and verify zoom persists

2. **Full-Screen Modal Test**
   - [ ] Open filter modal
   - [ ] Verify modal covers entire screen
   - [ ] Press ESC key
   - [ ] Verify modal closes
   - [ ] Click backdrop
   - [ ] Verify modal closes

3. **Settings Action Test**
   - [ ] Open settings for elevator device
   - [ ] Verify central name is displayed
   - [ ] Verify location is displayed
   - [ ] Verify all metadata fields are populated

4. **Dashboard Modal Test**
   - [ ] Open dashboard for 5 different devices rapidly
   - [ ] Verify no style corruption
   - [ ] Verify backdrop is always present
   - [ ] Verify modal is always centered
   - [ ] Close modal and verify cleanup

## Success Metrics

- Zero reports of modal style corruption after deployment
- 100% of equipment settings show central name
- Filter modal usage increases by 30% (due to better UX)
- Zero user complaints about constrained modals
- Code complexity reduced by removing zoom functionality
- handleActionSettings metadata parity ≥ 95% compared to TELEMETRY widget output

## References

- MENU Widget Implementation: `src/MYIO-SIM/V1.0.0/MENU/controller.js`
- TELEMETRY Reference: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`
- Material Design Modal Guidelines: https://material.io/components/dialogs
- WCAG 2.1 Modal Accessibility: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
