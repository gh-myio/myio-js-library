# RFC-0103 Implementation Plan: Power Limits Setup Modal in EQUIPMENTS Widget

## Overview

This plan details the integration of `openPowerLimitsSetupModal` into the MYIO-SIM v5.2.0 EQUIPMENTS widget.

### UI Changes Required

**Current Layout:**
```
+--------------------------------------------------------------------+
| [shopping filter chips]     [Tempo Real OFF] [⚙️] [indicator] [bar] |
+--------------------------------------------------------------------+
```

**New Layout:**
```
+--------------------------------------------------------------------+
| [shopping filter chips]     [⚙️ Power Limits] [⚡ Tempo Real OFF]   |
+--------------------------------------------------------------------+
```

- Move realtime controls to same row as shoppingFilterChips
- Add new "Power Limits" button (engine/gear icon) to the LEFT of "Tempo Real" button
- All controls aligned to the RIGHT

---

## File Changes

### 1. template.html

**Location:** `src/MYIO-SIM/v5.2.0/EQUIPMENTS/template.html`

**Changes:**
- Add new `powerLimitsBtn` button before `realtimeToggleBtn`
- Keep structure within `.realtime-controls` container

```html
<!-- BEFORE (lines 7-12) -->
<div class="realtime-controls" id="realtimeControls">
  <button id="realtimeToggleBtn" class="realtime-toggle" title="Ativar modo tempo real">
    <span class="toggle-icon">⚡</span>
    <span class="toggle-label">Tempo Real</span>
    <span class="toggle-status">OFF</span>
  </button>
  ...

<!-- AFTER -->
<div class="realtime-controls" id="realtimeControls">
  <!-- RFC-0103: Power Limits Setup Button -->
  <button id="powerLimitsBtn" class="power-limits-btn" title="Configure Power Limits">
    <span class="btn-icon">⚙️</span>
    <span class="btn-label">Power Limits</span>
  </button>
  <button id="realtimeToggleBtn" class="realtime-toggle" title="Ativar modo tempo real">
    <span class="toggle-icon">⚡</span>
    <span class="toggle-label">Tempo Real</span>
    <span class="toggle-status">OFF</span>
  </button>
  ...
```

---

### 2. style.css

**Location:** `src/MYIO-SIM/v5.2.0/EQUIPMENTS/style.css`

**Add new styles after `.realtime-controls` section (around line 600):**

```css
/* ====== RFC-0103: POWER LIMITS BUTTON ====== */
.power-limits-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #dde7f1;
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  color: var(--ink-1);
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.power-limits-btn:hover {
  border-color: #4A148C;
  background: linear-gradient(180deg, #f3e8ff 0%, #ede9fe 100%);
  color: #4A148C;
}

.power-limits-btn:active {
  transform: scale(0.98);
}

.power-limits-btn .btn-icon {
  font-size: 14px;
}

.power-limits-btn .btn-label {
  font-size: var(--fs-xs);
}

/* Responsive: Hide label on smaller screens */
@media (max-width: 768px) {
  .power-limits-btn .btn-label {
    display: none;
  }

  .power-limits-btn {
    padding: 6px 10px;
  }
}
```

---

### 3. controller.js

**Location:** `src/MYIO-SIM/v5.2.0/EQUIPMENTS/controller.js`

#### 3.1 Add new binding function (after `bindRealTimeToggle` function, ~line 2490)

```javascript
/**
 * RFC-0103: Bind Power Limits Setup button
 */
function bindPowerLimitsButton() {
  const powerLimitsBtn = document.getElementById('powerLimitsBtn');
  if (powerLimitsBtn) {
    powerLimitsBtn.addEventListener('click', openPowerLimitsModal);
    LogHelper.log('[PowerLimits] Button bound');
  }
}

/**
 * RFC-0103: Open Power Limits Setup Modal
 */
async function openPowerLimitsModal() {
  LogHelper.log('[PowerLimits] Opening modal...');

  try {
    // Check if MyIOLibrary is available
    if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.openPowerLimitsSetupModal) {
      console.error('[PowerLimits] MyIOLibrary.openPowerLimitsSetupModal not available');
      alert('Power Limits Setup is not available. Please ensure the library is loaded.');
      return;
    }

    // Get JWT token from widgetContext
    const jwtToken = self.ctx?.http?.getJwtToken?.() || self.ctx?.dashboard?.getJwtToken?.();
    if (!jwtToken) {
      console.error('[PowerLimits] JWT token not available');
      alert('Authentication error. Please refresh the page.');
      return;
    }

    // Get ThingsBoard base URL
    const tbBaseUrl = window.location.origin;

    // Open the modal
    const modal = await MyIOLibrary.openPowerLimitsSetupModal({
      token: jwtToken,
      customerId: CUSTOMER_ID,
      tbBaseUrl: tbBaseUrl,
      existingMapPower: MAP_INSTANTANEOUS_POWER || null,
      onSave: (updatedJson) => {
        LogHelper.log('[PowerLimits] Configuration saved:', updatedJson);
        // Update local cache
        MAP_INSTANTANEOUS_POWER = updatedJson;
        // Show success notification
        showNotification('Power limits saved successfully!', 'success');
      },
      onClose: () => {
        LogHelper.log('[PowerLimits] Modal closed');
      }
    });

    LogHelper.log('[PowerLimits] Modal opened successfully');

  } catch (error) {
    console.error('[PowerLimits] Error opening modal:', error);
    alert('Error opening Power Limits Setup: ' + error.message);
  }
}

/**
 * RFC-0103: Show notification (optional helper)
 */
function showNotification(message, type = 'info') {
  // Use existing toast system if available, otherwise console
  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.MyIOToast) {
    MyIOLibrary.MyIOToast.show(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}
```

#### 3.2 Call binding in `self.onInit` (after `bindRealTimeToggle()`, ~line 1177)

```javascript
  // ====== FILTER & SEARCH LOGIC ======
  bindFilterEvents();

  // RFC-0093: Bind real-time toggle button
  bindRealTimeToggle();

  // RFC-0103: Bind Power Limits Setup button
  bindPowerLimitsButton();
};
```

---

## Required Variables (already available)

| Variable | Source | Description |
|----------|--------|-------------|
| `CUSTOMER_ID` | Widget context | ThingsBoard customer UUID |
| `MAP_INSTANTANEOUS_POWER` | `fetchCustomerServerScopeAttrs()` | Existing power limits JSON |
| JWT Token | `self.ctx.http.getJwtToken()` | Authentication token |

---

## Testing Checklist

- [ ] Button renders correctly in toolbar
- [ ] Button hover state shows purple theme
- [ ] Clicking button opens Power Limits Setup Modal
- [ ] Modal loads with correct customer ID
- [ ] Modal shows existing `mapInstantaneousPower` data if available
- [ ] Saving updates local `MAP_INSTANTANEOUS_POWER` cache
- [ ] Modal close callback fires correctly
- [ ] Responsive: label hides on mobile, icon only visible
- [ ] Error handling: graceful failure if library not loaded

---

## Implementation Order

1. **template.html** - Add new button element
2. **style.css** - Add button styling
3. **controller.js** - Add binding and modal logic
4. **Test** - Verify end-to-end flow

---

## Dependencies

- `MyIOLibrary.openPowerLimitsSetupModal` must be available in UMD bundle
- ThingsBoard JWT token access via widget context
- Customer ID available in widget context
- `mapInstantaneousPower` attribute fetching (already implemented)

---

## Rollback Plan

If issues arise:
1. Remove button from template.html
2. Remove styles from style.css
3. Remove binding function calls from controller.js

No database changes required - purely UI/frontend changes.
