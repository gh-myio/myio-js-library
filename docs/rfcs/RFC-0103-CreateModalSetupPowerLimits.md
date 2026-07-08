# RFC 0103: Modal Setup Power Limits Component

- **Feature Name:** `modal-setup-power-limits`
- **Start Date:** 2025-12-09
- **RFC PR:** [myio-js-library#0103](https://github.com/gh-myio/myio-js-library/pull/0103)
- **MYIO Issue:** [myio-js-library#0103](https://github.com/gh-myio/myio-js-library/issues/0103)

## Summary

This RFC proposes a new `openPowerLimitsSetupModal` component for the MYIO JS Library that displays a fully-styled modal for configuring instantaneous power limits per device type and status. The modal manipulates JSON data stored in the customer entity's `server_scope` attributes on ThingsBoard. The component follows the existing premium modal design patterns established by `EnergyModalView` and provides flexible handling of both complete and partial JSON configurations.

## Motivation

Currently, power limit configurations are managed through direct ThingsBoard attribute manipulation or scattered implementations. This RFC standardizes the power limits setup modal as a reusable component that addresses several key needs:

1. **Centralized Configuration**: Single UI for managing power limits across all device types
2. **User-Friendly Interface**: Non-technical users can configure thresholds without JSON knowledge
3. **Data Integrity**: Validation ensures only valid configurations are persisted
4. **Flexibility**: Support for partial JSON updates without overwriting entire configurations
5. **Consistency**: Follows existing modal patterns (`EnergyModalView`, `SettingsModal`)
6. **Reusability**: Can be integrated into MYIO-SIM, head office dashboards, and admin panels

The component will provide a production-ready solution for administrators to configure device status thresholds (standBy, normal, alert, failure) for various telemetry types (consumption, voltage, current, etc.).

## Guide-level explanation

### Product/UX Requirements

The Power Limits Setup Modal presents configuration data in a professional, form-based interface:

#### Visual Design

**Header Bar (Purple Theme)**
- Title format: "Power Limits Setup" or "Setup - {Device Type}"
- Settings/gear icon on the left
- Action buttons on the right:
  - "Save" button (primary action)
  - "Reset" button (secondary action)
  - Close (x) button

**Device Type Selector**
- Dropdown or tab selector for device types:
  - ELEVADOR (Elevator)
  - ESCADA_ROLANTE (Escalator)
  - MOTOR (Motor)
  - BOMBA (Pump)
  - CHILLER
  - AR_CONDICIONADO (Air Conditioner)
  - HVAC
  - FANCOIL
  - 3F_MEDIDOR (Three-phase Meter)

**Telemetry Type Selector**
- Dropdown for telemetry types:
  - consumption (default)
  - voltage_a, voltage_b, voltage_c
  - current_a, current_b, current_c, total_current
  - fp_a, fp_b, fp_c (power factor)
  - a, b, c (phase power)

**Status Limit Configuration Cards**
- Four cards for each device status:
  - **StandBy**: Green indicator
  - **Normal**: Blue indicator
  - **Alert**: Yellow/Orange indicator
  - **Failure**: Red indicator

- Each card contains:
  - Status name and color indicator
  - Base Value input (minimum threshold)
  - Top Value input (maximum threshold)
  - Unit label (kW, V, A, etc.)

**Form Layout**
```
+--------------------------------------------------+
|  Power Limits Setup                    [Save] [X] |
+--------------------------------------------------+
|  Device Type: [ELEVADOR v]                        |
|  Telemetry:   [consumption v]                     |
+--------------------------------------------------+
|  +-------------+  +-------------+                 |
|  | StandBy     |  | Normal      |                 |
|  | Base: [0  ] |  | Base: [1  ] |                 |
|  | Top:  [0  ] |  | Top:  [MAX] |                 |
|  +-------------+  +-------------+                 |
|  +-------------+  +-------------+                 |
|  | Alert       |  | Failure     |                 |
|  | Base: [...] |  | Base: [...] |                 |
|  | Top:  [...] |  | Top:  [...] |                 |
|  +-------------+  +-------------+                 |
+--------------------------------------------------+
```

#### Modal Behavior

**Overlay and Focus Management**
- Semi-transparent dark overlay blocks page interaction
- Modal card centered in viewport
- Focus trapped within modal (tab cycling)
- ESC key closes modal
- Clicking backdrop (outside card) closes modal

**Data Loading**
- On open: Fetch existing `mapInstantaneousPower` from customer attributes
- Parse JSON and populate form fields for selected device type
- Handle missing/partial data gracefully (show empty fields)

**Data Saving**
- Validate all input values (numeric, non-negative)
- Build JSON structure per RFC-0078 schema
- Save to customer `server_scope` attributes via ThingsBoard API
- Show success/error feedback

**Loading and Error States**
- Loading: Spinner with "Loading configuration..."
- Error: Red warning with descriptive error message
- Success: Green confirmation toast

### Usage Example

```javascript
import { openPowerLimitsSetupModal } from '@myio/js-library';

// Basic usage - opens modal for customer configuration
const modal = await openPowerLimitsSetupModal({
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  customerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  tbBaseUrl: 'https://tb.myio-bas.com'
});

// Advanced usage with pre-selected device type
const modal = await openPowerLimitsSetupModal({
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  customerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  tbBaseUrl: 'https://tb.myio-bas.com',
  deviceType: 'ELEVADOR',
  telemetryType: 'consumption',
  existingMapPower: existingJsonFromAttribute,
  onSave: (updatedJson) => console.log('Saved:', updatedJson),
  onClose: () => console.log('Modal closed'),
  styles: {
    primaryColor: '#4A148C',
    borderRadius: '8px'
  }
});

// Clean up when needed
modal.destroy();
```

## Reference-level explanation

### API Design

#### Core Function Signature

```typescript
export function openPowerLimitsSetupModal(params: PowerLimitsModalParams): Promise<PowerLimitsModalInstance>;
```

#### Type Definitions

```typescript
interface PowerLimitsModalParams {
  // Required parameters
  token: string;                       // JWT token for ThingsBoard authentication
  customerId: string;                  // ThingsBoard customer UUID
  tbBaseUrl: string;                   // ThingsBoard API base URL

  // Optional parameters
  deviceType?: string;                 // Pre-selected device type (default: 'ELEVADOR')
  telemetryType?: string;              // Pre-selected telemetry type (default: 'consumption')
  existingMapPower?: InstantaneousPowerLimits | null;  // Existing configuration JSON
  container?: HTMLElement | string;    // Mount container (default: document.body)
  onSave?: (json: InstantaneousPowerLimits) => void;   // Callback after successful save
  onClose?: () => void;                // Callback when modal closes
  locale?: 'pt-BR' | 'en-US' | string; // Locale for formatting (default: 'pt-BR')
  styles?: Partial<PowerLimitsModalStyles>;  // Style customization tokens
}

interface PowerLimitsModalStyles {
  // Color tokens
  primaryColor: string;                // Main purple color (#4A148C)
  successColor: string;                // Success indicator color (#4CAF50)
  warningColor: string;                // Warning indicator color (#FFC107)
  dangerColor: string;                 // Error/failure color (#f44336)
  infoColor: string;                   // Info/normal color (#2196F3)
  textPrimary: string;                 // Primary text color
  textSecondary: string;               // Secondary text color
  backgroundColor: string;             // Modal background
  overlayColor: string;                // Backdrop overlay color

  // Layout tokens
  borderRadius: string;                // Card border radius (8px)
  buttonRadius: string;                // Button border radius (6px)
  zIndex: number;                      // Modal z-index (10000)

  // Spacing tokens
  spacingXs: string;                   // 4px
  spacingSm: string;                   // 8px
  spacingMd: string;                   // 16px
  spacingLg: string;                   // 24px

  // Typography tokens
  fontFamily: string;                  // Font family
  fontSizeSm: string;                  // 14px
  fontSizeMd: string;                  // 16px
  fontWeightBold: string;              // Bold weight
}

interface PowerLimitsModalInstance {
  destroy(): void;                     // Clean up modal and resources
  getFormData(): PowerLimitsFormData;  // Get current form state
  setFormData(data: PowerLimitsFormData): void;  // Set form values
}
```

#### JSON Schema Types (RFC-0078)

```typescript
interface InstantaneousPowerLimits {
  version: string;                                    // e.g., "1.0.0"
  limitsByInstantaneoustPowerType: TelemetryTypeLimits[];
}

interface TelemetryTypeLimits {
  telemetryType: string;                              // e.g., "consumption", "voltage_a"
  itemsByDeviceType: DeviceTypeLimits[];
}

interface DeviceTypeLimits {
  deviceType: string;                                 // e.g., "ELEVADOR", "MOTOR"
  name: string;                                       // e.g., "mapInstantaneousPowerElevator"
  description: string;                                // Human-readable description
  limitsByDeviceStatus: StatusLimits[];
}

interface StatusLimits {
  deviceStatusName: string;                           // "standBy" | "normal" | "alert" | "failure"
  limitsValues: {
    baseValue: number;                                // Minimum threshold
    topValue: number;                                 // Maximum threshold
  };
}
```

#### Form Data Structure

```typescript
interface PowerLimitsFormData {
  deviceType: string;
  telemetryType: string;
  standby: { baseValue: number | null; topValue: number | null };
  normal: { baseValue: number | null; topValue: number | null };
  alert: { baseValue: number | null; topValue: number | null };
  failure: { baseValue: number | null; topValue: number | null };
}
```

### Data & Persistence Integration

#### ThingsBoard Customer Attributes

**Read Configuration**
```
GET /api/plugins/telemetry/CUSTOMER/{customerId}/values/attributes/SERVER_SCOPE
Query: ?keys=mapInstantaneousPower
```

**Save Configuration**
```
POST /api/plugins/telemetry/CUSTOMER/{customerId}/attributes/SERVER_SCOPE
Body: { "mapInstantaneousPower": <InstantaneousPowerLimits JSON> }
```

**Authentication Header**
```typescript
const headers = {
  'X-Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

#### Data Processing Pipeline

**Loading Flow**
1. Fetch `mapInstantaneousPower` attribute from customer server_scope
2. Parse JSON string to `InstantaneousPowerLimits` object
3. Find entry matching selected `telemetryType`
4. Find entry matching selected `deviceType`
5. Extract `limitsByDeviceStatus` and populate form fields
6. Handle missing entries by showing empty/null values

**Saving Flow**
1. Collect form data from all input fields
2. Validate numeric values (non-negative, baseValue <= topValue)
3. Build `StatusLimits[]` array from form data
4. Merge into existing JSON or create new structure
5. POST to ThingsBoard customer attributes
6. Handle success/error responses

**Partial JSON Handling**
The modal must handle scenarios where:
- The entire `mapInstantaneousPower` attribute is missing
- A specific `telemetryType` entry doesn't exist
- A specific `deviceType` entry doesn't exist
- Some status entries are missing within a device type

In all cases, the modal should:
- Display empty fields for missing data
- Create new entries when saving
- Preserve existing entries for other device/telemetry types

### Implementation Architecture

#### File Structure

```
src/components/premium-modals/power-limits/
  index.ts                    # Public exports
  PowerLimitsModal.ts         # Main modal orchestrator
  PowerLimitsModalView.ts     # UI rendering and DOM manipulation
  PowerLimitsFormBuilder.ts   # Form generation and validation
  PowerLimitsPersister.ts     # ThingsBoard API integration
  types.ts                    # TypeScript interfaces
  styles.ts                   # CSS-in-JS styles
```

#### Key Classes

**PowerLimitsModal (Orchestrator)**
```typescript
class PowerLimitsModal {
  private view: PowerLimitsModalView;
  private persister: PowerLimitsPersister;
  private config: PowerLimitsModalParams;

  constructor(config: PowerLimitsModalParams);
  async open(): Promise<void>;
  async save(): Promise<void>;
  destroy(): void;
}
```

**PowerLimitsModalView (UI Layer)**
```typescript
class PowerLimitsModalView {
  private modal: any;
  private container: HTMLElement | null;
  private formBuilder: PowerLimitsFormBuilder;

  constructor(modal: any, config: PowerLimitsViewConfig);
  render(): void;
  getFormData(): PowerLimitsFormData;
  setFormData(data: PowerLimitsFormData): void;
  showLoading(): void;
  showError(message: string): void;
  showSuccess(message: string): void;
}
```

**PowerLimitsPersister (Data Layer)**
Reference implementation: `SettingsPersister.ts`
```typescript
class PowerLimitsPersister {
  private jwtToken: string;
  private tbBaseUrl: string;

  constructor(jwtToken: string, tbBaseUrl: string);

  async loadCustomerPowerLimits(customerId: string): Promise<InstantaneousPowerLimits | null>;

  async saveCustomerPowerLimits(
    customerId: string,
    limits: InstantaneousPowerLimits
  ): Promise<{ ok: boolean; error?: Error }>;
}
```

### DOM Structure

```html
<div class="myio-power-limits-modal-overlay" role="dialog" aria-modal="true">
  <div class="myio-power-limits-modal-card">
    <!-- Header -->
    <div class="myio-power-limits-modal-header">
      <div class="myio-power-limits-modal-title-section">
        <span class="myio-power-limits-modal-icon">&#x2699;</span>
        <h2 class="myio-power-limits-modal-title">Power Limits Setup</h2>
      </div>
      <div class="myio-power-limits-modal-actions">
        <button class="myio-btn myio-btn-primary" id="save-btn">Save</button>
        <button class="myio-btn myio-btn-secondary" id="reset-btn">Reset</button>
        <button class="myio-btn myio-btn-close" aria-label="Close">&times;</button>
      </div>
    </div>

    <!-- Selectors -->
    <div class="myio-power-limits-selectors">
      <div class="myio-form-group">
        <label>Device Type</label>
        <select id="device-type-select">
          <option value="ELEVADOR">Elevator</option>
          <option value="ESCADA_ROLANTE">Escalator</option>
          <option value="MOTOR">Motor</option>
          <!-- ... other options -->
        </select>
      </div>
      <div class="myio-form-group">
        <label>Telemetry Type</label>
        <select id="telemetry-type-select">
          <option value="consumption">Consumption (kW)</option>
          <option value="voltage_a">Voltage A (V)</option>
          <!-- ... other options -->
        </select>
      </div>
    </div>

    <!-- Status Cards Grid -->
    <div class="myio-power-limits-grid">
      <!-- StandBy Card -->
      <div class="myio-power-limits-card myio-status-standby">
        <div class="myio-card-header">
          <span class="myio-status-indicator"></span>
          <span class="myio-status-label">StandBy</span>
        </div>
        <div class="myio-card-inputs">
          <div class="myio-input-group">
            <label>Base Value</label>
            <input type="number" id="standby-base" min="0" step="0.01">
          </div>
          <div class="myio-input-group">
            <label>Top Value</label>
            <input type="number" id="standby-top" min="0" step="0.01">
          </div>
        </div>
      </div>

      <!-- Normal Card -->
      <div class="myio-power-limits-card myio-status-normal">
        <!-- Similar structure -->
      </div>

      <!-- Alert Card -->
      <div class="myio-power-limits-card myio-status-alert">
        <!-- Similar structure -->
      </div>

      <!-- Failure Card -->
      <div class="myio-power-limits-card myio-status-failure">
        <!-- Similar structure -->
      </div>
    </div>

    <!-- Loading State -->
    <div class="myio-power-limits-loading" style="display: none;">
      <div class="myio-spinner"></div>
      <span>Loading configuration...</span>
    </div>

    <!-- Error State -->
    <div class="myio-power-limits-error" style="display: none;">
      <span class="myio-error-icon">&#x26A0;</span>
      <span class="myio-error-message"></span>
    </div>
  </div>
</div>
```

### Accessibility Implementation

#### Keyboard Navigation
- Tab order: Device select -> Telemetry select -> Input fields -> Save -> Reset -> Close
- ESC key closes modal
- Enter key in inputs does not submit (only explicit Save click)
- Focus trap within modal

#### Screen Reader Support
- `role="dialog"` and `aria-modal="true"` on overlay
- `aria-labelledby` pointing to modal title
- `aria-label` on icon buttons
- `aria-invalid` on fields with validation errors
- Live region announcements for loading/success/error states

### Error Handling Strategy

#### Validation Errors
- Empty required fields: Highlight with red border
- Negative values: Show inline error message
- Base > Top: Show warning "Base value should not exceed top value"
- Non-numeric input: Prevent input or show error

#### Network Errors
- Connection timeout: "Unable to connect. Please check your network."
- 401 Unauthorized: "Session expired. Please log in again."
- 403 Forbidden: "Insufficient permissions to modify settings."
- 404 Not Found: "Customer not found."
- 500 Server Error: "Server error. Please try again later."

#### Recovery Mechanisms
- Retry button on network errors
- Form data preserved on error (user doesn't lose input)
- Auto-dismiss success messages after 3 seconds

## Drawbacks

### Implementation Complexity
- Requires understanding of RFC-0078 JSON schema
- Complex merge logic for partial updates
- Multiple API calls for load and save operations

### User Experience Challenges
- Many input fields may overwhelm users
- Device type and telemetry type combinations create large matrix
- Non-technical users may not understand threshold semantics

### Maintenance Overhead
- JSON schema changes require modal updates
- New device types or telemetry types need UI additions
- Localization for all labels and messages

## Rationale and alternatives

### Design Decisions

#### Customer-Level Storage
**Chosen Approach**: Store in customer `server_scope` attributes
**Alternative**: Store in device-level attributes
**Rationale**: Customer-level allows centralized management; device-level allows per-device overrides (supported via `SettingsPersister`)

#### Form-Based UI
**Chosen Approach**: Input fields with validation
**Alternative**: JSON editor with syntax highlighting
**Rationale**: Form-based UI is more accessible to non-technical users

#### Partial Update Support
**Chosen Approach**: Merge new data with existing JSON
**Alternative**: Replace entire JSON on save
**Rationale**: Partial updates prevent accidental data loss for other device types

### Alternative Approaches Considered

1. **Inline Table Editor**: Grid-style editor for all device types at once
   - Rejected: Too complex, overwhelming UI

2. **Wizard-Based Flow**: Step-by-step configuration
   - Rejected: Too many clicks for simple changes

3. **Import/Export JSON**: File-based configuration
   - Rejected: Not user-friendly, error-prone

## Prior art

### Existing Implementations

**SettingsPersister.ts**
- Current implementation for device-level attribute persistence
- Provides `saveServerScopeAttributes` method
- Handles RFC-0078 JSON schema building

**EnergyModalView.ts**
- Established modal pattern with overlay, focus trap, theme support
- Reference for UI components and styling

**mapPower.json**
- Complete example of `InstantaneousPowerLimits` structure
- Reference for all device types and telemetry types

### Industry Standards

**Material Design Form Patterns**
- Card-based grouping for related inputs
- Clear visual hierarchy with labels
- Inline validation feedback

**ThingsBoard Attribute Management**
- Server scope for system configuration
- JSON storage for complex structures
- REST API for attribute operations

## Unresolved questions

### Technical Decisions
- Should we implement optimistic UI updates before API confirmation?
- How should concurrent edits from multiple users be handled?
- Should we add undo/redo functionality for form changes?

### UX Decisions
- Should all device types be visible simultaneously or one at a time?
- How should we handle the transition when switching device/telemetry type?
- Should we show a comparison view (before/after) on save?

### Integration Questions
- How will this integrate with device-level overrides in `SettingsPersister`?
- Should there be a "copy from customer" feature for device-level setup?
- How will real-time validation against actual telemetry values work?

## Future possibilities

### Enhanced Features
- **Bulk Edit Mode**: Edit multiple device types simultaneously
- **Import/Export**: JSON file import/export for backup/restore
- **Audit Log**: Track who changed what and when
- **Templates**: Pre-defined configurations for common scenarios

### Integration Enhancements
- **Device Override Modal**: Similar UI for device-level overrides
- **Live Preview**: Show how current telemetry values would be classified
- **Recommendations**: AI-based suggestions for threshold values

### Advanced Validation
- **Historical Analysis**: Suggest limits based on historical telemetry data
- **Anomaly Detection**: Warn if proposed limits seem unreasonable
- **Cross-Validation**: Ensure limits don't overlap unexpectedly

---

## Implementation Checklist

### Core Functionality
- [ ] Calling `openPowerLimitsSetupModal({ token, customerId, tbBaseUrl })` opens modal
- [ ] Device type selector shows all supported device types
- [ ] Telemetry type selector shows all supported telemetry types
- [ ] Changing device/telemetry type loads corresponding configuration
- [ ] Four status cards (standBy, normal, alert, failure) display correctly
- [ ] Input fields accept numeric values with validation
- [ ] Save button persists data to customer server_scope attributes
- [ ] Reset button clears form to loaded values
- [ ] Close button and ESC key close modal
- [ ] Overlay blocks page interaction
- [ ] `destroy()` method removes DOM, listeners, and cleans up resources

### Data Handling
- [ ] Load existing `mapInstantaneousPower` from customer attributes
- [ ] Handle missing attribute (show empty form)
- [ ] Handle partial JSON (missing device types, telemetry types)
- [ ] Merge updates with existing JSON without data loss
- [ ] Build valid RFC-0078 JSON structure on save

### Validation
- [ ] Reject negative values
- [ ] Warn if baseValue > topValue
- [ ] Show inline validation errors
- [ ] Disable save button when form is invalid

### Error Handling
- [ ] Show loading state during API calls
- [ ] Show error messages for network failures
- [ ] Show success confirmation on save
- [ ] Preserve form data on error

### Quality Assurance
- [ ] TypeScript type definitions for all public APIs
- [ ] Unit tests for JSON merge logic
- [ ] Integration tests for ThingsBoard API
- [ ] Accessibility testing (keyboard navigation, screen reader)
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)

### Non-goals (Out of Scope)
- Device-level override UI (use existing SettingsPersister)
- Real-time telemetry preview
- Historical threshold analysis
- Multi-user concurrent edit handling

---

*This RFC provides a complete specification for implementing the Power Limits Setup Modal Component, ensuring consistency with existing MYIO design patterns while providing a robust, accessible, and maintainable solution for power threshold configuration.*
