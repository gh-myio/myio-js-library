# Validation Fix - Comparison Mode Support

## 🐛 Problem

**Error**: `"Erro: deviceId is required"` when clicking "Comparar" button in FOOTER widget

**Root Cause**: The `validateOptions` function in `src/components/premium-modals/energy/utils.ts` was validating `deviceId` and `tbJwtToken` without checking the `mode` parameter. This caused validation errors for comparison mode, which doesn't need `deviceId` (it uses `dataSources` instead).

**Location**: `src/components/premium-modals/energy/utils.ts:8-28`

---

## ✅ Solution

Updated `validateOptions` to be **mode-aware**, applying different validation rules for `'single'` vs `'comparison'` modes.

### Before (Broken)

```typescript
export function validateOptions(options: OpenDashboardPopupEnergyOptions): void {
  if (!options.tbJwtToken) {
    throw new Error('tbJwtToken is required for ThingsBoard API access');
  }

  if (!options.deviceId) {
    throw new Error('deviceId is required');  // ❌ Always required
  }

  if (!options.startDate || !options.endDate) {
    throw new Error('startDate and endDate are required');
  }

  // Validate authentication strategy
  const hasIngestionToken = !!options.ingestionToken;
  const hasClientCredentials = !!(options.clientId && options.clientSecret);

  if (!hasIngestionToken && !hasClientCredentials) {
    throw new Error('Either ingestionToken or clientId/clientSecret must be provided');
  }
}
```

### After (Fixed)

```typescript
export function validateOptions(options: OpenDashboardPopupEnergyOptions): void {
  const mode = options.mode || 'single';

  // MODE-SPECIFIC VALIDATION
  if (mode === 'single') {
    // Single mode requires deviceId and tbJwtToken
    if (!options.tbJwtToken) {
      throw new Error('tbJwtToken is required for ThingsBoard API access in single mode');
    }

    if (!options.deviceId) {
      throw new Error('deviceId is required for single mode');
    }
  } else if (mode === 'comparison') {
    // Comparison mode requires dataSources and granularity
    if (!options.dataSources || options.dataSources.length === 0) {
      throw new Error('dataSources is required for comparison mode');
    }

    if (!options.granularity) {
      throw new Error('granularity is required for comparison mode');
    }
  }

  // COMMON VALIDATIONS
  if (!options.startDate || !options.endDate) {
    throw new Error('startDate and endDate are required');
  }

  // Validate authentication strategy (only for single mode or when needed)
  if (mode === 'single') {
    const hasIngestionToken = !!options.ingestionToken;
    const hasClientCredentials = !!(options.clientId && options.clientSecret);

    if (!hasIngestionToken && !hasClientCredentials) {
      throw new Error('Either ingestionToken or clientId/clientSecret must be provided');
    }
  } else if (mode === 'comparison') {
    // Comparison mode needs clientId/clientSecret for SDK
    if (!options.clientId || !options.clientSecret) {
      throw new Error('clientId and clientSecret are required for comparison mode');
    }
  }
}
```

---

## 📋 Validation Rules by Mode

### Single Mode
**Required**:
- ✅ `deviceId` - ThingsBoard device UUID
- ✅ `tbJwtToken` - ThingsBoard authentication token
- ✅ `startDate` and `endDate`
- ✅ Either `ingestionToken` OR (`clientId` + `clientSecret`)

**Optional**:
- `granularity` (auto-calculated)
- `readingType` (defaults to 'energy')

### Comparison Mode
**Required**:
- ✅ `dataSources` - Array with at least 1 device (2+ recommended)
- ✅ `granularity` - Must be explicitly provided ('15m', '1h', or '1d')
- ✅ `clientId` and `clientSecret` - For SDK authentication
- ✅ `startDate` and `endDate`

**Not Required**:
- ❌ `deviceId` (uses `dataSources` instead)
- ❌ `tbJwtToken` (uses `clientId`/`clientSecret` instead)

---

## 🧪 Testing

### Test Single Mode (Regression)
```javascript
// Should work exactly as before
const modal = MyIOLibrary.openDashboardPopupEnergy({
  deviceId: 'device-uuid-123',
  tbJwtToken: 'token',
  startDate: '2025-08-01',
  endDate: '2025-08-31',
  clientId: 'client-id',
  clientSecret: 'secret'
});

// ✅ Passes validation
```

### Test Comparison Mode (Fixed)
```javascript
// Should now work without deviceId
const modal = MyIOLibrary.openDashboardPopupEnergy({
  mode: 'comparison',
  dataSources: [
    { type: 'device', id: 'ing-id-1', label: 'Device A' },
    { type: 'device', id: 'ing-id-2', label: 'Device B' }
  ],
  startDate: '2025-08-01',
  endDate: '2025-08-31',
  granularity: '1d',
  clientId: 'client-id',
  clientSecret: 'secret'
});

// ✅ Passes validation (no deviceId error)
```

### Test Validation Errors

#### Missing dataSources in comparison mode
```javascript
try {
  MyIOLibrary.openDashboardPopupEnergy({
    mode: 'comparison',
    // Missing dataSources
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    granularity: '1d',
    clientId: 'id',
    clientSecret: 'secret'
  });
} catch (error) {
  console.log(error.message);
  // "dataSources is required for comparison mode"
}
```

#### Missing granularity in comparison mode
```javascript
try {
  MyIOLibrary.openDashboardPopupEnergy({
    mode: 'comparison',
    dataSources: [{ type: 'device', id: 'id1', label: 'Dev1' }],
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    // Missing granularity
    clientId: 'id',
    clientSecret: 'secret'
  });
} catch (error) {
  console.log(error.message);
  // "granularity is required for comparison mode"
}
```

#### Missing deviceId in single mode
```javascript
try {
  MyIOLibrary.openDashboardPopupEnergy({
    mode: 'single',
    // Missing deviceId
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    tbJwtToken: 'token',
    clientId: 'id',
    clientSecret: 'secret'
  });
} catch (error) {
  console.log(error.message);
  // "deviceId is required for single mode"
}
```

---

## 📁 Files Modified

### 1. `src/components/premium-modals/energy/utils.ts`
**Lines**: 8-51 (completely rewritten)

**Changes**:
- Added `mode` parameter detection
- Split validation into mode-specific and common sections
- Single mode validates `deviceId` and `tbJwtToken`
- Comparison mode validates `dataSources` and `granularity`
- Comparison mode requires `clientId` and `clientSecret`

---

## 🔄 Build & Deploy

### Build Command
```bash
npm run build
```

### Build Output
- ✅ ESM bundle: `dist/index.js` (410.13 KB)
- ✅ CJS bundle: `dist/index.cjs` (414.27 KB)
- ✅ UMD bundle: `dist/myio-js-library.umd.js`
- ✅ Minified UMD: `dist/myio-js-library.umd.min.js`
- ✅ Type definitions: `dist/index.d.ts` (51.69 KB)

### Status
- [x] TypeScript compilation successful
- [x] No breaking changes to existing code
- [x] Backward compatible (single mode unchanged)
- [x] Comparison mode now validates correctly

---

## 🚀 Impact

### FOOTER Widget (v5.2.0)
The FOOTER widget can now successfully open comparison modals:

```javascript
// In FOOTER/controller.js
async function openComparisonModal() {
  const selected = MyIOSelectionStore.getSelectedEntities();

  if (selected.length < 2) {
    alert("Selecione pelo menos 2 dispositivos para comparar.");
    return;
  }

  const dataSources = selected.map(entity => ({
    type: 'device',
    id: entity.ingestionId,
    label: entity.name || entity.id
  }));

  const granularity = this._calculateGranularity(
    this._getStartDate(),
    this._getEndDate()
  );

  // ✅ Now works without deviceId error
  MyIOLibrary.openDashboardPopupEnergy({
    mode: 'comparison',
    dataSources: dataSources,
    readingType: readingType,
    startDate: this._getStartDate(),
    endDate: this._getEndDate(),
    granularity: granularity,
    clientId: clientId,
    clientSecret: clientSecret
  });
}
```

### Other Widgets
- All existing single-device modals work exactly as before
- No changes needed in other widgets
- Backward compatible

---

## 📚 Related Documentation

- `COMPARISON-MODAL-PLAN.md` - Original RFC plan
- `IMPLEMENTATION-SUMMARY-COMPARISON-MODAL.md` - Implementation summary
- `ENERGY-MODAL-COMPARISON-MODE-USAGE.md` - Usage guide

---

## ✅ Checklist

- [x] Fixed `validateOptions` to be mode-aware
- [x] Single mode validation preserved (deviceId + tbJwtToken)
- [x] Comparison mode validation added (dataSources + granularity)
- [x] Built library successfully
- [x] No breaking changes
- [x] Documentation updated

---

**Fixed by**: Claude Code
**Date**: 2025-10-17
**Version**: myio-js-library@0.1.100
**Build**: Successful ✅
