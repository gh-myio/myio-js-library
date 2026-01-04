# RFC 0126: Menu Component Shopping Filter Synchronization

- Feature Name: `menu_shopping_filter_sync`
- Start Date: 2026-01-04
- RFC PR: (to be assigned)
- Status: **Implemented**
- Authors: MYIO Engineering
- Target Version: v0.2.x
- Related Components: RFC-0114 (MenuComponent), RFC-0121 (TelemetryGrid), RFC-0113 (HeaderComponent), RFC-0112 (WelcomeModal)

---

## Summary

This RFC defines the event-driven synchronization pattern for shopping (customer) filter changes originating from the **Menu Component** and propagating to **MAIN orchestrator**, **TelemetryGrid**, **Header**, and **Welcome** components.

When a user selects/deselects shoppings in the Menu's filter modal, all components must update their displayed data to reflect only the selected shoppings.

---

## Motivation

The legacy widget system (v5.2.0) uses `window.custumersSelected` global variable and `myio:filter-applied` CustomEvent to synchronize shopping filters across widgets. The new library component architecture needs to:

1. **Maintain backward compatibility** with existing event patterns
2. **Decouple components** - Menu shouldn't directly call TelemetryGrid methods
3. **Centralize orchestration** - MAIN handles data filtering and redistribution
4. **Update totals** - Header shows filtered vs total counts
5. **Update Welcome modal** - Shopping cards reflect filtered device counts

---

## Current Event Flow (Legacy Widgets)

### Global State
```javascript
window.custumersSelected = [
  { name: "Shopping ABC", value: "uuid-1", customerId: "cust-1", ingestionId: "uuid-1" },
  { name: "Shopping XYZ", value: "uuid-2", customerId: "cust-2", ingestionId: "uuid-2" },
  // ... selected shoppings
];
```

### Event Sequence
```
MENU (user applies filter)
  |
  +---> dispatch myio:filter-applied { selection: [...], ts: timestamp }
           |
           +---> MAIN Orchestrator receives
           |        |
           |        +---> Filters MyIOOrchestratorData by selectedIds
           |        +---> dispatch myio:energy-summary-ready
           |        +---> dispatch myio:water-summary-ready
           |        +---> dispatch myio:orchestrator-filter-updated
           |
           +---> EQUIPMENTS/TELEMETRY receive
           |        |
           |        +---> Update STATE.selectedShoppingIds
           |        +---> Render filter chips
           |        +---> reflowCards() with filter
           |
           +---> HEADER receives
                    |
                    +---> Update selectedShoppingIds
                    +---> Wait for summary events to update cards
```

---

## Proposed Architecture (Library Components)

### 1. Menu Component Events

**File:** `src/components/menu/MenuView.ts`

The Menu component should dispatch:

| Event | Payload | Trigger |
|-------|---------|---------|
| `myio:filter-applied` | `{ selection: Customer[], ts: number }` | Apply button clicked |
| `myio:customers-ready` | `{ count: number, customers: Customer[] }` | Shoppings loaded |

**Customer Interface:**
```typescript
interface ShoppingCustomer {
  name: string;        // Display name
  value: string;       // UUID/ingestionId (primary key)
  customerId: string;  // ThingsBoard customer ID
  ingestionId: string; // Same as value
}
```

### 2. MAIN Orchestrator Responsibilities

**File:** `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`

MAIN should:

1. **Listen** for `myio:filter-applied`
2. **Store** selected IDs in global state
3. **Filter** cached data (MyIOOrchestratorData)
4. **Dispatch** domain-specific summary events
5. **Update** child components via direct method calls or events

```javascript
// Proposed handler in MAIN
window.addEventListener('myio:filter-applied', (ev) => {
  const selection = ev.detail?.selection || [];
  const selectedIds = selection.map((s) => s.value).filter(Boolean);

  // 1. Store in global state
  window.custumersSelected = selection;
  window.STATE = window.STATE || {};
  window.STATE.selectedShoppingIds = selectedIds;

  // 2. Filter orchestrator data
  filterOrchestratorData(selectedIds);

  // 3. Update components
  if (telemetryGridInstance) {
    telemetryGridInstance.applyFilter(selectedIds);
  }
  if (headerInstance) {
    headerInstance.updateFilteredCounts(selectedIds);
  }
  if (welcomeModal) {
    updateWelcomeModalWithFilter(selectedIds);
  }

  // 4. Dispatch summary events for backward compatibility
  dispatchSummaryEvents();
});
```

### 3. TelemetryGrid Filter Integration

**File:** `src/components/telemetry-grid/TelemetryGridController.ts`

Add shopping filter support:

```typescript
interface TelemetryGridInstance {
  // Existing methods...

  // New filter method
  applyShoppingFilter(shoppingIds: string[]): void;

  // Clear shopping filter (show all)
  clearShoppingFilter(): void;
}
```

**Implementation:**
```typescript
applyShoppingFilter(shoppingIds: string[]): void {
  this.state.filters.selectedShoppingIds = shoppingIds;
  this.applyFilters();
  this.notifyStateChange();
}

// In applyFilters():
if (this.state.filters.selectedShoppingIds.length > 0) {
  filtered = filtered.filter((d) =>
    this.state.filters.selectedShoppingIds.includes(d.customerId)
  );
}
```

### 4. Header Component Updates

**File:** `src/components/premium-modals/header/HeaderView.ts`

Header should display:
- **Filtered count** / **Total count** format (e.g., "45 / 120 Equipamentos")
- Visual indicator when filter is active

```typescript
interface HeaderUpdateParams {
  equipment: { filtered: number; total: number };
  energy: { filtered: number; total: number; consumption: number };
  water: { filtered: number; total: number; consumption: number };
  temperature: { filtered: number; total: number; avgTemp: number };
}

// Method to update with filter
updateFilteredStats(params: HeaderUpdateParams): void;
```

### 5. Welcome Modal Updates

**File:** `src/components/premium-modals/welcome/WelcomeModalView.ts`

When filter is applied:
1. Update shopping card device counts to show only filtered devices
2. Optionally highlight or disable cards not in selection

```typescript
// In MAIN, update welcome cards when filter changes
function updateWelcomeModalWithFilter(selectedIds: string[]) {
  const filteredCounts = calculateShoppingDeviceStats(DOMAIN_ALL_LIST, classified);

  // Filter counts to only selected shoppings
  const filteredCards = DEFAULT_SHOPPING_CARDS.map((card) => {
    const cardTitle = card.title.toLowerCase().trim();
    const cardSelected = selectedIds.length === 0 ||
      selectedIds.some((id) => /* match by customerId or name */);

    if (!cardSelected) {
      return { ...card, disabled: true, deviceCounts: { energy: 0, water: 0, temperature: 0 } };
    }

    return { ...card, deviceCounts: filteredCounts.get(cardTitle) };
  });

  welcomeModal.updateShoppingCards(filteredCards);
}
```

---

## Implementation Steps

### Step 1: Update Menu Component to Dispatch Events

**File:** `src/components/menu/MenuView.ts`

1. In the filter modal apply handler, dispatch `myio:filter-applied`:
```typescript
private handleFilterApply(selectedCustomers: ShoppingCustomer[]): void {
  // Update global state for backward compatibility
  (window as any).custumersSelected = selectedCustomers;

  // Dispatch event
  window.dispatchEvent(
    new CustomEvent('myio:filter-applied', {
      detail: {
        selection: selectedCustomers,
        ts: Date.now(),
      },
    })
  );

  // Call callback if provided
  this.params.onFilterApply?.(selectedCustomers);
}
```

2. On initialization, dispatch `myio:customers-ready`:
```typescript
private handleCustomersLoaded(customers: ShoppingCustomer[]): void {
  window.dispatchEvent(
    new CustomEvent('myio:customers-ready', {
      detail: {
        count: customers.length,
        customers: customers,
      },
    })
  );
}
```

### Step 2: Add Shopping Filter to TelemetryGridController

**File:** `src/components/telemetry-grid/TelemetryGridController.ts`

1. Add `selectedShoppingIds` to FilterState
2. Implement `applyShoppingFilter()` method
3. Update `applyFilters()` to include shopping filter

### Step 3: Update MAIN to Handle Filter Events

**File:** `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`

1. Add event listener for `myio:filter-applied`
2. Update all child components when filter changes
3. Dispatch summary events for backward compatibility

### Step 4: Add Filtered Stats to Header

**File:** `src/components/premium-modals/header/HeaderView.ts`

1. Add `updateFilteredStats()` method
2. Update card rendering to show filtered/total format
3. Add visual indicator for active filter

### Step 5: Update Welcome Modal with Filter Support

**File:** `src/components/premium-modals/welcome/WelcomeModalView.ts`

1. Add `updateShoppingCards()` method (if not exists)
2. Support `disabled` state for cards not in selection

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/menu/MenuView.ts` | Dispatch events on filter apply |
| `src/components/menu/types.ts` | Add ShoppingCustomer interface |
| `src/components/telemetry-grid/types.ts` | Add selectedShoppingIds to FilterState |
| `src/components/telemetry-grid/TelemetryGridController.ts` | Add applyShoppingFilter method |
| `src/components/premium-modals/header/HeaderView.ts` | Add updateFilteredStats method |
| `src/components/premium-modals/header/types.ts` | Add HeaderUpdateParams interface |
| `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js` | Add filter event handler |

---

## Event Flow Diagram

```
+----------------+     myio:filter-applied      +------------------+
|  MENU          | ---------------------------> |  MAIN            |
|  Component     |    { selection, ts }         |  Orchestrator    |
+----------------+                              +------------------+
                                                        |
                    +-----------------------------------+-----------------------------------+
                    |                                   |                                   |
                    v                                   v                                   v
        +-------------------+               +-------------------+               +-------------------+
        |  TelemetryGrid    |               |  Header           |               |  Welcome Modal    |
        |  .applyFilter()   |               |  .updateFiltered()|               |  .updateCards()   |
        +-------------------+               +-------------------+               +-------------------+
                    |                                   |                                   |
                    v                                   v                                   v
        [Cards filtered by                  [Shows 45/120 format                [Shopping cards
         selectedShoppingIds]               for each domain]                    updated/disabled]
```

---

## Success Criteria

- [x] Menu dispatches `myio:filter-applied` when user applies filter
- [x] Menu dispatches `myio:customers-ready` on load
- [x] MAIN listens for filter events and updates all components
- [x] TelemetryGrid filters cards by selected shoppings
- [x] Header shows filtered/total counts
- [x] Welcome modal updates shopping card counts
- [x] Global `window.custumersSelected` maintained for backward compatibility
- [x] Existing widgets continue to work with new event system

---

## Backward Compatibility

The implementation maintains full backward compatibility:

1. **Global Variable**: `window.custumersSelected` is still set
2. **Event Names**: Same event names (`myio:filter-applied`, `myio:customers-ready`)
3. **Payload Format**: Same payload structure
4. **Legacy Listeners**: Old widgets continue to receive events

---

## Testing Plan

1. **Unit Tests**
   - Menu dispatches correct events
   - TelemetryGrid filters correctly by shopping IDs
   - Header displays filtered/total format

2. **Integration Tests**
   - Filter change propagates to all components
   - Clearing filter shows all data

3. **Manual Tests**
   - Select subset of shoppings in Menu
   - Verify TelemetryGrid shows only filtered devices
   - Verify Header shows correct counts
   - Verify Welcome modal cards update

---

## References

- [RFC-0114 Menu Component](./RFC-0114-MenuComponent.md)
- [RFC-0121 TelemetryGrid Component](./RFC-0121-TelemetryGridComponent.md)
- [RFC-0113 Header Component](./RFC-0113-HeaderComponent.md)
- [RFC-0112 Welcome Modal](./RFC-0112-WelcomeModalHeadOffice.md)
- Legacy: `src/MYIO-SIM/v5.2.0/MENU/controller.js` (lines 48-86, 440-467)
- Legacy: `src/MYIO-SIM/v5.2.0/MAIN/controller.js` (lines 6595-6664)
