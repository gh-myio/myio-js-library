# RFC-0107: Welcome and Loading Modal for Shopping Dashboard

- **Feature Name:** welcome_loading_modal_shopping
- **Start Date:** 2025-12-22
- **RFC PR:** (leave this empty until a PR is opened)
- **Tracking Issue:** (leave this empty until an issue is created)

## Summary

Implement a welcome/loading modal for the Shopping Dashboard that displays contract loading progress, showing device totalization by domain (energy, water, temperature) and validates data consistency with the `window.STATE` structure.

## Motivation

Currently, when the Shopping Dashboard loads, users have no visual feedback about the contract loading progress. This RFC proposes a premium modal that:

1. Provides visual feedback during contract data loading
2. Displays device counts by domain and category
3. Validates that loaded totals match the expected card counts
4. Improves user experience with a professional loading state

The modal will cover 70% of the screen with transparency, blocking user interaction until loading completes.

## Guide-level explanation

### Device Attributes Structure

The system reads device counts from `server_scope` attributes:

**Energy Domain:**
| Attribute | Description |
|-----------|-------------|
| `qtDevices3f` | Total energy devices |
| `qtDevices3f-Entries` | Energy entry devices |
| `qtDevices3f-CommonArea` | Common area energy devices |
| `qtDevices3f-Stores` | Store energy devices |

**Water Domain:**
| Attribute | Description |
|-----------|-------------|
| `qtDevicesHidr` | Total water devices |
| `qtDevicesHidr-Entries` | Water entry devices |
| `qtDevicesHidr-CommonArea` | Common area water devices |
| `qtDevicesHidr-Stores` | Store water devices |

**Temperature Domain:**
| Attribute | Description |
|-----------|-------------|
| `qtDevicesTemp` | Total temperature devices |
| `qtDevicesTemp-Internal` | Climate-controlled environment devices |
| `qtDevicesTemp-Stores` | Non-climate-controlled environment devices |

### User Experience Flow

1. User opens the Shopping Dashboard
2. Loading modal appears covering 70% of the screen
3. Modal displays progressive loading of device counts by domain
4. System validates totals against `window.STATE` structure
5. Upon completion, a checkmark icon appears in the header
6. Modal dismisses and dashboard becomes interactive

## Reference-level explanation

### Implementation Location

The modal will be implemented in:
```
src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js
```

### State Validation

The modal must validate loaded data against the exposed `window.STATE` structure:

```javascript
window.STATE = {
    energy: {
        lojas: { items: [], total: 0, count: 0 },
        entrada: { items: [], total: 0, count: 0 },
        areacomum: { items: [], total: 0, count: 0 },
        summary: { total: 0, byGroup: {...}, percentages: {...}, periodKey: '' }
    },
    water: { /* same structure */ },
    temperature: { /* same structure */ }
};
```

### Contract Status Icon

After loading completes, a checkmark icon will be added to:
```
src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER
```

### ContractSummaryTooltip Component

A new tooltip component `ContractSummaryTooltip` will be created following the pattern established in:
```
src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/controller.js
```

This follows the existing pattern:
```javascript
const SummaryTooltip = isWater
    ? window.MyIOLibrary?.WaterSummaryTooltip
    : window.MyIOLibrary?.EnergySummaryTooltip;
```

The new component will be accessible as:
```javascript
window.MyIOLibrary?.ContractSummaryTooltip
```

## Drawbacks

1. **Initial Load Time:** Adding a modal may slightly increase perceived load time, though actual load time remains unchanged.
2. **Maintenance Overhead:** New component requires maintenance alongside existing tooltip components.
3. **State Coupling:** Direct dependency on `window.STATE` structure creates tight coupling.

## Rationale and alternatives

### Why this design?

- **Consistency:** Follows existing premium modal patterns in the codebase
- **User Feedback:** Provides clear progress indication during loading
- **Data Validation:** Built-in validation ensures data integrity before user interaction

### Alternatives Considered

1. **Skeleton Loading:** Use skeleton screens instead of modal
   - Rejected: Less informative than showing actual counts

2. **Progress Bar Only:** Simple progress bar in header
   - Rejected: Doesn't provide detailed domain breakdown

3. **No Loading State:** Let dashboard load progressively
   - Rejected: Poor UX when data is incomplete

## Prior art

- `setupSummaryTooltip()` function in TELEMETRY_INFO widget
- `EnergySummaryTooltip` component
- `WaterSummaryTooltip` component
- Existing premium modal implementations in the library

## Unresolved questions

1. Should the modal be dismissible before loading completes?
2. What happens if validation fails (mismatched totals)?
3. Should we cache the contract status to avoid re-validation on page refresh?
4. Timeout behavior for slow connections?

## Future possibilities

1. **Offline Support:** Cache contract data for offline dashboard viewing
2. **Real-time Updates:** Update contract status when devices are added/removed
3. **Detailed Breakdown:** Expandable sections showing individual device status
4. **Error Recovery:** Automatic retry mechanism for failed device queries
5. **Analytics Integration:** Track loading times and validation failures
