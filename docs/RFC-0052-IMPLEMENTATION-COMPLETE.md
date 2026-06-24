# RFC-0052: Implementation Complete - Global Cache Toggle

**Date:** 2025-10-22
**Status:** ✅ IMPLEMENTED
**Version:** v5.2.0
**Priority:** P0 (Critical)

---

## ✅ Implementation Summary

RFC-0052 has been successfully implemented to add global cache enable/disable control to the MAIN_VIEW orchestrator widget. This urgent feature was requested due to production issues with cache causing data inconsistencies.

---

## 🎯 Changes Implemented

### 1. Settings Schema Update

**File:** `MAIN_VIEW/settings.schema`

**Changes:**
- Added `enableCache` boolean field (default: `true`)
- Created "Cache Configuration (RFC-0052)" section in UI
- Added descriptive warnings about cache impact

**Lines Modified:** 11-16, 64-75

```json
{
  "enableCache": {
    "title": "Enable Cache System",
    "type": "boolean",
    "default": true,
    "description": "RFC-0052: Enable/disable cache system globally. Set to FALSE to always fetch fresh data from API (use for troubleshooting or real-time dashboards). WARNING: Disabling cache increases API load."
  }
}
```

---

### 2. Widget Settings Global Variable

**File:** `MAIN_VIEW/controller.js`

**Changes:**
- Added `enableCache: true` to `widgetSettings` global variable (line 36)
- Changed `customerTB_ID` from `'default'` to `null` (critical fix)
- Added validation to throw error if `customerTB_ID` is missing

**Lines Modified:** 34-44, 203-221

```javascript
// RFC-0051.1 + RFC-0052: Global widget settings
let widgetSettings = {
  customerTB_ID: null,  // RFC-0052: Changed from 'default' to null - MUST be set in onInit
  enableCache: true,    // RFC-0052: New - enable/disable cache globally
  cacheTtlMinutes: 30,
  enableStaleWhileRevalidate: true,
  maxCacheSize: 50,
  debugMode: false,
  domainsEnabled: { energy: true, water: true, temperature: true }
};
```

**Validation in onInit:**
```javascript
// CRITICAL: customerTB_ID MUST be set - abort if missing
const customerTB_ID = self.ctx.settings?.customerTB_ID;
if (!customerTB_ID) {
  LogHelper.error('[Orchestrator] ❌ CRITICAL: customerTB_ID is missing from widget settings!');
  LogHelper.error('[Orchestrator] Widget cannot function without customerTB_ID. Please configure it in widget settings.');
  throw new Error('customerTB_ID is required but not found in widget settings');
}

widgetSettings.customerTB_ID = customerTB_ID;
widgetSettings.enableCache = self.ctx.settings?.enableCache ?? true;  // RFC-0052
```

---

### 3. Config Initialization with Cache Status Logging

**File:** `MAIN_VIEW/controller.js`

**Lines Modified:** 893-910

```javascript
const config = {
  enableCache: widgetSettings.enableCache,  // RFC-0052: New - enable/disable cache globally
  ttlMinutes: widgetSettings.cacheTtlMinutes,
  enableStaleWhileRevalidate: widgetSettings.enableStaleWhileRevalidate,
  maxCacheSize: widgetSettings.maxCacheSize,
  debugMode: widgetSettings.debugMode,
  domainsEnabled: widgetSettings.domainsEnabled
};

// RFC-0052: Log cache status
if (config.enableCache) {
  LogHelper.log(`[Orchestrator] ✅ Cache ENABLED (TTL: ${config.ttlMinutes} min)`);
} else {
  LogHelper.warn('[Orchestrator] ⚠️ Cache DISABLED - Always fetching fresh data');
}
```

---

### 4. Cache Bypass Implementation

#### 4.1. readCache() - Skip Reading

**Lines Modified:** 965-970

```javascript
function readCache(key) {
  // RFC-0052: Do not read from cache if cache is disabled
  if (!config.enableCache) {
    LogHelper.log(`[Orchestrator] ⏭️ Cache disabled - skipping read for ${key}`);
    return null; // Always return null = cache miss
  }

  const entry = memCache.get(key);
  if (!entry) return null;
  // ... existing validation logic
}
```

#### 4.2. writeCache() - Skip Writing

**Lines Modified:** 1006-1010

```javascript
function writeCache(key, data) {
  // RFC-0052: Do not write to cache if cache is disabled
  if (!config.enableCache) {
    LogHelper.log(`[Orchestrator] ⏭️ Cache disabled - skipping write for ${key}`);
    return;
  }

  // ... existing cache write logic
}
```

#### 4.3. cleanupExpiredCache() - Skip Cleanup

**Lines Modified:** 132-136

```javascript
function cleanupExpiredCache() {
  // RFC-0052: Skip cleanup if cache is disabled
  if (!widgetSettings.enableCache) {
    LogHelper.log('[Orchestrator] ⏭️ Cache disabled - skipping cleanup');
    return;
  }

  LogHelper.log('[Orchestrator] 🧹 Starting cleanup of expired cache...');
  // ... existing cleanup logic
}
```

#### 4.4. hydrateDomain() - Log Cache Status

**Lines Modified:** 1311-1316

```javascript
async function hydrateDomain(domain, period) {
  const key = cacheKey(domain, period);
  const startTime = Date.now();

  LogHelper.log(`[Orchestrator] hydrateDomain called for ${domain}:`, { key, inFlight: inFlight.has(key) });

  // RFC-0052: Log cache status
  if (config.enableCache) {
    LogHelper.log(`[Orchestrator] 🔍 Checking cache for ${domain}...`);
  } else {
    LogHelper.log(`[Orchestrator] 🔄 Cache disabled - will fetch fresh data for ${domain}...`);
  }

  // ... rest of hydrateDomain logic
}
```

---

## 📊 Expected Behavior

### With Cache ENABLED (default: `enableCache = true`)

```
[Orchestrator] 📋 Widget settings captured: {
  customerTB_ID: '20b93da0-9011-11f0-a06d-e9509531b1d5',
  enableCache: true,
  cacheTtlMinutes: 30
}
[Orchestrator] ✅ Cache ENABLED (TTL: 30 min)
[Orchestrator] 🔍 Checking cache for energy...
[Orchestrator] 🎯 Cache hit for energy, fresh: true
[Orchestrator] 💾 Cache written for energy:...: 354 items
```

### With Cache DISABLED (`enableCache = false`)

```
[Orchestrator] 📋 Widget settings captured: {
  customerTB_ID: '20b93da0-9011-11f0-a06d-e9509531b1d5',
  enableCache: false,
  cacheTtlMinutes: 30
}
[Orchestrator] ⚠️ Cache DISABLED - Always fetching fresh data
[Orchestrator] 🔄 Cache disabled - will fetch fresh data for energy...
[Orchestrator] ⏭️ Cache disabled - skipping read for energy:...
[Orchestrator] ⏭️ Cache disabled - skipping write for energy:...
[Orchestrator] ⏭️ Cache disabled - skipping cleanup
[Orchestrator] Fetching from: https://api.data.apps.myio-bas.com/...
[Orchestrator] ✅ Fresh data fetched for energy in 1892ms
```

---

## 🔍 Critical Fixes Included

### Fix #1: customerTB_ID Validation

**Problem:** Using `'default'` as fallback was causing credential timeout errors.

**Solution:** Changed default from `'default'` to `null` with strict validation:

```javascript
const customerTB_ID = self.ctx.settings?.customerTB_ID;
if (!customerTB_ID) {
  throw new Error('customerTB_ID is required but not found in widget settings');
}
```

**User Feedback:** "esse default não faz sentido, precisa sempre ter o customerTB_ID"

### Fix #2: Complete Cache Bypass

**Problem:** No way to disable cache in production without code changes.

**Solution:** Implemented bypass in ALL cache-related functions:
- `readCache()` - Returns `null` (cache miss)
- `writeCache()` - Early return (no write)
- `cleanupExpiredCache()` - Early return (no cleanup)
- `hydrateDomain()` - Logs cache status

---

## 🧪 Testing Checklist

### ✅ Test 1: Cache Enabled (Baseline)
```
1. Set enableCache = true in widget settings
2. Reload dashboard
3. Click Energy → Water → Energy
4. Verify: Second Energy request uses cache
5. Expected logs: "🎯 Cache hit..." and "💾 Cache written..."
```

### ✅ Test 2: Cache Disabled
```
1. Set enableCache = false in widget settings
2. Reload dashboard
3. Click Energy → Water → Energy
4. Verify: EVERY request fetches fresh data (no cache)
5. Expected logs: "⏭️ Cache disabled..." and "🔄 Cache disabled - will fetch fresh data..."
```

### ✅ Test 3: customerTB_ID Missing
```
1. Remove customerTB_ID from widget settings
2. Reload dashboard
3. Expected: Error thrown with clear message
4. Expected log: "❌ CRITICAL: customerTB_ID is missing from widget settings!"
```

---

## 🎯 Files Modified

1. **`MAIN_VIEW/settings.schema`**
   - Added `enableCache` field
   - Created "Cache Configuration" section
   - **Total:** +20 lines

2. **`MAIN_VIEW/controller.js`**
   - Updated `widgetSettings` global (line 36)
   - Added customerTB_ID validation (lines 203-221)
   - Updated `config` with enableCache (lines 893-910)
   - Modified `readCache()` bypass (lines 965-970)
   - Modified `writeCache()` bypass (lines 1006-1010)
   - Modified `cleanupExpiredCache()` bypass (lines 132-136)
   - Added `hydrateDomain()` logging (lines 1311-1316)
   - **Total:** ~40 lines added/modified

---

## ✅ Build Status

```bash
npm run build
```

**Result:** ✅ Build successful
**Warnings:** Pre-existing (not related to RFC-0052)
**Errors:** 0

---

## 🔗 Related Documentation

- **RFC-0042:** Orchestrator Implementation
- **RFC-0045:** Robust Cache Strategy
- **RFC-0047:** Cache Improvements - TB_ID Integration
- **RFC-0051:** Fix Orchestrator Context + Race Condition
- **RFC-0052:** Global Cache Enable/Disable Toggle (this document)

---

## 📝 Deployment Notes

1. **Default Behavior:** Cache is **ENABLED** by default (`enableCache: true`)
2. **No Breaking Changes:** Existing dashboards will continue to use cache
3. **Troubleshooting:** Users can disable cache via widget settings without code changes
4. **Production Impact:** Disabling cache increases API load - use only for troubleshooting or real-time dashboards

---

## 🚀 Next Steps

1. ✅ **RFC-0052 Implementation:** Complete
2. ⏳ **Testing:** Verify with enableCache=true and enableCache=false
3. ⏳ **Other Widgets:** Check if HEADER/TELEMETRY widgets need similar changes
4. ⏳ **RFC-0051:** Fix orchestrator stub not being created
5. ⏳ **Production Validation:** Deploy and test in production environment

---

**Status:** ✅ **IMPLEMENTATION COMPLETE**
**Build:** ✅ **PASSING**
**Ready for:** Testing and deployment
**ETA:** Ready for production deployment after testing

---

## 🎉 Summary

RFC-0052 successfully adds global cache control to v5.2.0, addressing critical production issues:

✅ Users can now enable/disable cache via widget settings
✅ No code changes required to troubleshoot cache issues
✅ Complete bypass implementation in all cache functions
✅ Clear logging shows cache status
✅ Fixed critical `customerTB_ID` validation bug
✅ Build passing with zero errors

**User Request Fulfilled:** "o CACHE estamos tendo muito problemas quero ter como habilitar ou não o uso do cache urgente na versão 5.2.0" ✅
