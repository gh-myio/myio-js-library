# RFC-0152 Phase 1: User Access Toggle & Gating

## Status: ✅ IMPLEMENTED

## Summary

Gate the Operational Indicators feature by a customer attribute (`show-indicators-operational-panels`) stored in ThingsBoard's `SERVER_SCOPE`. Only authorized customers see the new functionality.

---

## Implementation

### File Modified

| File | Location |
|------|----------|
| `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js` | Lines ~300-350, ~2305, ~2438 |

---

## Code Changes

### 1. Function Added: `fetchOperationalIndicatorsAccess()`

**Location**: After `fetchCustomerServerScopeAttrs` function (~line 310)

```javascript
// RFC-0152: Fetch Operational Indicators access from customer attributes
const fetchOperationalIndicatorsAccess = async () => {
  const customerTB_ID = getCustomerTB_ID();
  const jwt = getJwtToken();

  LogHelper.log('RFC-0152: Checking operational indicators access for customer:', customerTB_ID);

  if (!customerTB_ID || !jwt) {
    LogHelper.warn('RFC-0152: Missing customerTB_ID or JWT token');
    return { showOperationalPanels: false };
  }

  try {
    if (MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage) {
      const attrs = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
      const showOperationalPanels = attrs?.['show-indicators-operational-panels'] === true;

      LogHelper.log('RFC-0152: Operational indicators access:', showOperationalPanels);

      // Update MyIOUtils with operational indicators state
      if (window.MyIOUtils) {
        window.MyIOUtils.operationalIndicators = {
          enabled: showOperationalPanels,
        };
      }

      // Dispatch event for Menu component to react
      window.dispatchEvent(
        new CustomEvent('myio:operational-indicators-access', {
          detail: { enabled: showOperationalPanels },
        })
      );

      return { showOperationalPanels };
    }
  } catch (error) {
    LogHelper.error('RFC-0152: Failed to fetch operational indicators access:', error);
  }

  return { showOperationalPanels: false };
};
```

---

### 2. Global State on `window.MyIOUtils`

**Location**: Inside `window.MyIOUtils` object definition (~line 2305)

```javascript
window.MyIOUtils = {
  // ... existing properties ...

  // RFC-0152: Operational Indicators feature gating
  operationalIndicators: {
    enabled: false, // Will be set after attribute check
  },
};
```

---

### 3. Function Call in `onInit`

**Location**: After `fetchCredentialsFromThingsBoard()` call (~line 2438)

```javascript
// Fetch credentials from ThingsBoard
await fetchCredentialsFromThingsBoard();

// RFC-0152: Fetch Operational Indicators access
await fetchOperationalIndicatorsAccess();
```

---

## Event Dispatched

| Event Name | Detail | Consumed By |
|------------|--------|-------------|
| `myio:operational-indicators-access` | `{ enabled: boolean }` | `MenuView.ts` |

---

## ThingsBoard Attribute Configuration

### Attribute Details

| Property | Value |
|----------|-------|
| **Name** | `show-indicators-operational-panels` |
| **Scope** | `SERVER_SCOPE` |
| **Type** | `boolean` |
| **Default** | `false` (feature hidden) |

### How to Enable for a Customer

1. Open ThingsBoard Admin UI
2. Navigate to **Customers** → Select customer
3. Go to **Attributes** tab
4. Select scope: **Server attributes**
5. Add attribute:
   - Key: `show-indicators-operational-panels`
   - Value: `true`
6. Save

---

## Testing Checklist

- [ ] Create customer with `show-indicators-operational-panels = true`
  - [ ] Verify `window.MyIOUtils.operationalIndicators.enabled === true`
  - [ ] Verify event `myio:operational-indicators-access` dispatched with `{ enabled: true }`

- [ ] Create customer WITHOUT the attribute
  - [ ] Verify `window.MyIOUtils.operationalIndicators.enabled === false`
  - [ ] Verify event dispatched with `{ enabled: false }`

- [ ] Create customer with `show-indicators-operational-panels = false`
  - [ ] Verify same behavior as missing attribute

- [ ] Test with invalid JWT token
  - [ ] Verify graceful fallback to `{ enabled: false }`
  - [ ] Verify no console errors (only warnings)

---

## Rollback

To rollback this phase, remove:

1. The `fetchOperationalIndicatorsAccess` function
2. The `operationalIndicators` property from `window.MyIOUtils`
3. The function call in `onInit`

No database changes required.
