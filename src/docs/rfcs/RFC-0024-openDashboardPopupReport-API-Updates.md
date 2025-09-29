# RFC-0024: openDashboardPopupReport API Updates

**Feature Name:** openDashboardPopupReport-api-updates  
**Start Date:** 2025-09-26  
**Owners:** MyIO UI Platform  
**Status:** Draft  
**Target Library Namespace:** MyIOLibrary.openDashboardPopupReport  

## Summary

Update the `openDashboardPopupReport` component API to improve usability and consistency by:
1. **Removing date parameter requirement** - Component will use built-in date range picker
2. **Renaming parameters** for clarity:
   - `deviceLabel` → `identifier` 
   - `storeLabel` → `label`
   - `tbJwtToken` → `ingestionToken`
3. **Updating all references** in demos, documentation, and usage examples

## Motivation

### Current API Issues

1. **Redundant Date Parameter**: The component has a built-in date range picker, making the `date` parameter unnecessary and confusing
2. **Unclear Parameter Names**: 
   - `deviceLabel` vs `storeLabel` creates confusion about which is the device name vs store name
   - `tbJwtToken` is ThingsBoard-specific terminology that doesn't reflect the actual usage
3. **Inconsistent Usage**: Different parts of the codebase use different parameter patterns

### Current Implementation Problems

**Current API:**
```typescript
MyIOLibrary.openDashboardPopupReport({
  ingestionId: 'demo-ingestion-123',
  deviceId: 'demo-device-123',
  deviceLabel: 'Entrada Subestação',    // Confusing name
  storeLabel: 'Outback',                // Confusing name
  date: { start: '2025-09-01', end: '2025-09-25' }, // Redundant
  api: { 
    clientId: 'demo-client',
    clientSecret: 'demo-secret',
    dataApiBaseUrl: 'https://api.data.apps.myio-bas.com',
    tbJwtToken: 'jwt-token'             // ThingsBoard-specific name
  }
});
```

## Detailed Design

### New API Specification

```typescript
export interface OpenDeviceReportParams {
  /** Data ingestion identifier (required) */
  ingestionId: string;
  
  /** Optional device ID for additional metadata */
  deviceId?: string;
  
  /** Device identifier/code (e.g., "ENTRADA-001", "CHILLER-A") */
  identifier?: string;
  
  /** Human-readable label/name (e.g., "Outback", "Shopping Center Norte") */
  label?: string;
  
  /** UI configuration */
  ui?: BaseUiCfg;
  
  /** API configuration */
  api: {
    clientId?: string;
    clientSecret?: string;
    dataApiBaseUrl?: string;
    /** Token for data ingestion access */
    ingestionToken?: string;
  };
}
```

### Updated API Usage

**New Simplified API:**
```typescript
MyIOLibrary.openDashboardPopupReport({
  ingestionId: 'demo-ingestion-123',
  deviceId: 'demo-device-123',
  identifier: 'ENTRADA-001',           // Clear: device identifier/code
  label: 'Outback',                    // Clear: human-readable name
  api: { 
    clientId: 'demo-client',
    clientSecret: 'demo-secret',
    dataApiBaseUrl: 'https://api.data.apps.myio-bas.com',
    ingestionToken: 'ingestion-token'  // Clear: token for data access
  }
});
```

## Implementation Plan

### Phase 1: Update Type Definitions (Week 1)

#### 1.1 Update `src/components/premium-modals/types.ts`
```typescript
// BEFORE
export interface OpenDeviceReportParams {
  ingestionId: string;
  deviceId?: string;
  deviceLabel?: string;    // ❌ Remove
  storeLabel?: string;     // ❌ Remove
  date?: Partial<DateRange>; // ❌ Remove
  ui?: BaseUiCfg;
  api: BaseApiCfg;
}

export interface BaseApiCfg {
  clientId?: string;
  clientSecret?: string;
  dataApiBaseUrl?: string;
  graphsBaseUrl?: string;
  timezone?: string;
  tbJwtToken?: string;     // ❌ Remove
}

// AFTER
export interface OpenDeviceReportParams {
  ingestionId: string;
  deviceId?: string;
  identifier?: string;    // ✅ Add: device identifier/code
  label?: string;         // ✅ Add: human-readable name
  ui?: BaseUiCfg;
  api: BaseApiCfg;
}

export interface BaseApiCfg {
  clientId?: string;
  clientSecret?: string;
  dataApiBaseUrl?: string;
  graphsBaseUrl?: string;
  timezone?: string;
  ingestionToken?: string; // ✅ Add: token for data access
}
```

#### 1.2 Update `src/components/premium-modals/report-device/DeviceReportModal.ts`
- Remove date parameter handling from constructor
- Update parameter references: `deviceLabel` → `identifier`, `storeLabel` → `label`
- Update API token reference: `tbJwtToken` → `ingestionToken`
- Remove default date logic (component will use built-in date picker)

### Phase 2: Update Implementation (Week 1)

#### 2.1 Modal Title Update
```typescript
// BEFORE
title: `Relatório - ${this.params.deviceLabel || 'SEM ID CADASTRADO'} - ${this.params.storeLabel || 'SEM ETIQUETA'}`

// AFTER  
title: `Relatório - ${this.params.identifier || 'SEM IDENTIFICADOR'} - ${this.params.label || 'SEM ETIQUETA'}`
```

#### 2.2 CSV Export Update
```typescript
// BEFORE
const csvData = [
  ['Dispositivo/Loja', this.params.deviceLabel || 'N/A', this.params.storeLabel || ''],
  // ...
];

// AFTER
const csvData = [
  ['Dispositivo/Loja', this.params.identifier || 'N/A', this.params.label || ''],
  // ...
];
```

#### 2.3 Remove Date Parameter Logic
- Remove `getDefaultStartDate()` and `getDefaultEndDate()` methods
- Remove date parameter initialization in `setupEventListeners()`
- Let the built-in date range picker handle all date logic

### Phase 3: Update Documentation & Examples (Week 1)

#### 3.1 Update `README.md`
- Update API documentation section
- Update usage examples
- Update parameter descriptions
- Add migration guide from old to new API

#### 3.2 Update `demos/energy.html`
- Update `openReportDemo()` function
- Update parameter names in demo call
- Remove date parameter from demo
- Update demo descriptions and comments

### Phase 4: Backward Compatibility (Week 2)

#### 4.1 Add Deprecation Warnings
```typescript
export interface OpenDeviceReportParamsLegacy {
  ingestionId: string;
  deviceId?: string;
  /** @deprecated Use 'identifier' instead */
  deviceLabel?: string;
  /** @deprecated Use 'label' instead */
  storeLabel?: string;
  /** @deprecated Date range is now handled by built-in picker */
  date?: Partial<DateRange>;
  ui?: BaseUiCfg;
  api: BaseApiCfgLegacy;
}

export interface BaseApiCfgLegacy extends BaseApiCfg {
  /** @deprecated Use 'ingestionToken' instead */
  tbJwtToken?: string;
}
```

#### 4.2 Add Parameter Migration Logic
```typescript
function migrateParams(params: OpenDeviceReportParams | OpenDeviceReportParamsLegacy): OpenDeviceReportParams {
  const migrated = { ...params };
  
  // Handle legacy parameter names
  if ('deviceLabel' in params && params.deviceLabel && !migrated.identifier) {
    migrated.identifier = params.deviceLabel;
    console.warn('[openDashboardPopupReport] Parameter "deviceLabel" is deprecated. Use "identifier" instead.');
  }
  
  if ('storeLabel' in params && params.storeLabel && !migrated.label) {
    migrated.label = params.storeLabel;
    console.warn('[openDashboardPopupReport] Parameter "storeLabel" is deprecated. Use "label" instead.');
  }
  
  if ('tbJwtToken' in params.api && params.api.tbJwtToken && !migrated.api.ingestionToken) {
    migrated.api.ingestionToken = params.api.tbJwtToken;
    console.warn('[openDashboardPopupReport] Parameter "api.tbJwtToken" is deprecated. Use "api.ingestionToken" instead.');
  }
  
  if ('date' in params && params.date) {
    console.warn('[openDashboardPopupReport] Parameter "date" is deprecated. The component now uses a built-in date range picker.');
  }
  
  return migrated;
}
```

## Files to Update

### Core Implementation Files
1. **`src/components/premium-modals/types.ts`**
   - Update `OpenDeviceReportParams` interface
   - Update `BaseApiCfg` interface
   - Add legacy interfaces for backward compatibility

2. **`src/components/premium-modals/report-device/DeviceReportModal.ts`**
   - Update parameter references throughout the class
   - Remove date parameter handling logic
   - Update modal title generation
   - Update CSV export parameter references

3. **`src/components/premium-modals/report-device/openDashboardPopupReport.ts`**
   - Add parameter migration logic
   - Add deprecation warnings for legacy parameters

### Documentation Files
4. **`README.md`**
   - Update API documentation section
   - Update usage examples
   - Add migration guide

5. **`demos/energy.html`**
   - Update `openReportDemo()` function
   - Remove date parameter from demo call
   - Update parameter names in demo

### Testing Files
6. **`tests/premium-modals.test.js`** (if exists)
   - Update test cases for new API
   - Add tests for parameter migration
   - Add tests for deprecation warnings

## Migration Strategy

### Phase 1: Backward Compatible Update
1. Deploy new API alongside legacy support
2. Add deprecation warnings for old parameters
3. Update documentation with new examples

### Phase 2: Gradual Migration
1. Update high-traffic implementations to use new API
2. Monitor usage of legacy parameters
3. Provide migration assistance to teams

### Phase 3: Legacy Removal (Future)
1. Remove legacy parameter support after 6 months
2. Clean up migration code
3. Update TypeScript interfaces to remove deprecated types

## Detailed Changes Required

### 1. Type Definitions Update

**File**: `src/components/premium-modals/types.ts`

```typescript
// Remove date parameter and rename fields
export interface OpenDeviceReportParams {
  ingestionId: string;
  deviceId?: string;
  identifier?: string;    // NEW: replaces deviceLabel
  label?: string;         // NEW: replaces storeLabel
  // date?: Partial<DateRange>; // REMOVED: handled by built-in picker
  ui?: BaseUiCfg;
  api: BaseApiCfg;
}

export interface BaseApiCfg {
  clientId?: string;
  clientSecret?: string;
  dataApiBaseUrl?: string;
  graphsBaseUrl?: string;
  timezone?: string;
  ingestionToken?: string; // NEW: replaces tbJwtToken
}
```

### 2. Implementation Updates

**File**: `src/components/premium-modals/report-device/DeviceReportModal.ts`

```typescript
// Update modal title
title: `Relatório - ${this.params.identifier || 'SEM IDENTIFICADOR'} - ${this.params.label || 'SEM ETIQUETA'}`

// Update CSV export
const csvData = [
  ['Dispositivo/Loja', this.params.identifier || 'N/A', this.params.label || ''],
  // ...
];

// Remove date parameter initialization
// OLD: Remove getDefaultStartDate() and getDefaultEndDate() methods
// NEW: Let DateRangePicker handle default dates
```

### 3. Demo Updates

**File**: `demos/energy.html`

```javascript
// BEFORE
MyIOLibrary.openDashboardPopupReport({
  ingestionId: 'demo-ingestion-123',
  deviceId: 'demo-device-123',
  deviceLabel: 'Entrada Subestação',
  storeLabel: 'Outback',
  date: { start: '2025-09-01', end: '2025-09-25' },
  api: { 
    clientId: 'demo-client',
    clientSecret: 'demo-secret',
    dataApiBaseUrl: 'https://api.data.apps.myio-bas.com'
  }
});

// AFTER
MyIOLibrary.openDashboardPopupReport({
  ingestionId: 'demo-ingestion-123',
  deviceId: 'demo-device-123',
  identifier: 'ENTRADA-001',
  label: 'Outback',
  api: { 
    clientId: 'demo-client',
    clientSecret: 'demo-secret',
    dataApiBaseUrl: 'https://api.data.apps.myio-bas.com',
    ingestionToken: 'demo-ingestion-token'
  }
});
```

### 4. Documentation Updates

**File**: `README.md`

```markdown
## Device Report Modal

### `openDashboardPopupReport(params: OpenDeviceReportParams): ModalHandle`

Opens a device-specific daily consumption report modal with built-in date range picker, sortable table, and CSV export functionality.

**Parameters:**
- `ingestionId: string` - Data ingestion identifier (required)
- `deviceId?: string` - Optional device ID for additional metadata
- `identifier?: string` - Device identifier/code (e.g., "ENTRADA-001", "CHILLER-A")
- `label?: string` - Human-readable label/name (e.g., "Outback", "Shopping Center Norte")
- `ui?: object` - UI configuration (theme, width)
- `api: object` - API configuration:
  - `clientId?: string` - Client ID for data API
  - `clientSecret?: string` - Client secret for data API
  - `dataApiBaseUrl?: string` - Data API base URL
  - `ingestionToken?: string` - Token for data ingestion access

**Usage Example:**
```javascript
const modal = MyIOLibrary.openDashboardPopupReport({
  ingestionId: 'abc123-ingestion-id',
  deviceId: 'device-uuid',
  identifier: 'ENTRADA-001',
  label: 'Outback Shopping',
  api: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    dataApiBaseUrl: 'https://api.data.apps.myio-bas.com',
    ingestionToken: 'your-ingestion-token'
  }
});

modal.on('loaded', (data) => {
  console.log('Report loaded:', data.count, 'days');
});

modal.on('close', () => {
  console.log('Modal closed');
});
```

**Key Features:**
- **Built-in Date Range Picker**: No need to specify dates in parameters
- **Automatic Data Loading**: Fetches daily consumption data for selected period
- **Sortable Table**: Click column headers to sort by date or consumption
- **CSV Export**: Download report data with proper Brazilian formatting
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Graceful error display and recovery
```

## Benefits

### 1. **Simplified API**
- ✅ **Fewer Parameters**: Removes redundant date parameter
- ✅ **Clearer Names**: `identifier` and `label` are self-explanatory
- ✅ **Consistent Terminology**: `ingestionToken` matches actual usage

### 2. **Better User Experience**
- ✅ **Built-in Date Picker**: Users can change dates without reopening modal
- ✅ **Intuitive Parameters**: Clear distinction between identifier and label
- ✅ **Flexible Usage**: Works with or without optional parameters

### 3. **Improved Maintainability**
- ✅ **Single Source of Truth**: Date logic centralized in component
- ✅ **Consistent Naming**: Aligns with other MyIO components
- ✅ **Backward Compatibility**: Migration path for existing code

## Implementation Checklist

### Core Changes
- [ ] Update `OpenDeviceReportParams` interface in `types.ts`
- [ ] Update `BaseApiCfg` interface in `types.ts`
- [ ] Add legacy interfaces for backward compatibility
- [ ] Update `DeviceReportModal.ts` parameter references
- [ ] Remove date parameter handling logic
- [ ] Add parameter migration function
- [ ] Add deprecation warnings

### Documentation Updates
- [ ] Update README.md API documentation
- [ ] Update usage examples in README.md
- [ ] Add migration guide to README.md
- [ ] Update JSDoc comments in implementation files

### Demo Updates
- [ ] Update `demos/energy.html` demo function
- [ ] Remove date parameter from demo call
- [ ] Update parameter names in demo
- [ ] Update demo descriptions and comments

### Testing
- [ ] Create unit tests for new API
- [ ] Test parameter migration logic
- [ ] Test deprecation warnings
- [ ] Validate backward compatibility
- [ ] Test CSV export with new parameter names

## Risk Assessment

### Low Risk Changes
- ✅ **Parameter Renaming**: Simple string replacements
- ✅ **Documentation Updates**: No functional impact
- ✅ **Demo Updates**: Isolated to demo files

### Medium Risk Changes
- ⚠️ **Type Interface Updates**: May affect TypeScript compilation
- ⚠️ **Parameter Migration**: Needs thorough testing

### Mitigation Strategies
1. **Backward Compatibility**: Keep legacy parameter support initially
2. **Deprecation Warnings**: Clear console warnings for migration
3. **Comprehensive Testing**: Unit tests for all parameter combinations
4. **Documentation**: Clear migration guide with examples

## Testing Strategy

### Unit Tests
```typescript
describe('openDashboardPopupReport API Updates', () => {
  test('accepts new parameter names', () => {
    const params = {
      ingestionId: 'test-123',
      identifier: 'DEVICE-001',
      label: 'Test Store',
      api: { ingestionToken: 'token-123' }
    };
    
    expect(() => openDashboardPopupReport(params)).not.toThrow();
  });
  
  test('migrates legacy parameters with warnings', () => {
    const consoleSpy = jest.spyOn(console, 'warn');
    
    const legacyParams = {
      ingestionId: 'test-123',
      deviceLabel: 'Old Device',
      storeLabel: 'Old Store',
      date: { start: '2025-01-01', end: '2025-01-31' },
      api: { tbJwtToken: 'old-token' }
    };
    
    openDashboardPopupReport(legacyParams);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('deviceLabel" is deprecated')
    );
  });
  
  test('removes date parameter requirement', () => {
    const params = {
      ingestionId: 'test-123',
      identifier: 'DEVICE-001',
      api: {}
    };
    
    // Should not require date parameter
    expect(() => openDashboardPopupReport(params)).not.toThrow();
  });
});
```

### Integration Tests
- ✅ Test modal opening with new parameters
- ✅ Test CSV export with new parameter names
- ✅ Test backward compatibility with legacy parameters
- ✅ Test deprecation warnings display correctly

## Timeline

### Week 1: Core Implementation
- **Day 1-2**: Update type definitions and interfaces
- **Day 3-4**: Update DeviceReportModal implementation
- **Day 5**: Add parameter migration and deprecation warnings

### Week 2: Documentation & Testing
- **Day 1-2**: Update README.md and demo files
- **Day 3-4**: Create comprehensive unit tests
- **Day 5**: Integration testing and validation

### Week 3: Deployment & Monitoring
- **Day 1**: Deploy with backward compatibility
- **Day 2-5**: Monitor usage and deprecation warnings
- **Ongoing**: Assist teams with migration

## Success Criteria

### Functional Requirements
- ✅ **API Simplification**: Date parameter removed, component uses built-in picker
- ✅ **Parameter Clarity**: `identifier` and `label` clearly distinguish device code vs name
- ✅ **Token Consistency**: `ingestionToken` aligns with actual usage
- ✅ **Backward Compatibility**: Legacy parameters work with deprecation warnings

### Quality Requirements
- ✅ **Zero Breaking Changes**: Existing code continues to work
- ✅ **Clear Migration Path**: Documentation and warnings guide users
- ✅ **Comprehensive Testing**: All scenarios covered by tests
- ✅ **Performance**: No performance degradation from changes

### Documentation Requirements
- ✅ **Updated Examples**: All examples use new API
- ✅ **Migration Guide**: Clear instructions for updating existing code
- ✅ **Deprecation Timeline**: Clear timeline for legacy parameter removal

## Conclusion

These API updates will significantly improve the usability and consistency of the `openDashboardPopupReport` component by:

1. **Simplifying the API** by removing redundant date parameters
2. **Clarifying parameter names** to eliminate confusion
3. **Aligning terminology** with actual usage patterns
4. **Maintaining backward compatibility** during the transition period

The changes are low-risk with comprehensive backward compatibility and clear migration paths for existing implementations.

**Expected Impact:**
- 📈 **50% reduction** in parameter complexity
- 📈 **100% clarity** on parameter meanings
- 📈 **Zero breaking changes** for existing implementations
- 📈 **Improved developer experience** with intuitive API

This update establishes a cleaner, more intuitive API that will be easier to use and maintain going forward.
