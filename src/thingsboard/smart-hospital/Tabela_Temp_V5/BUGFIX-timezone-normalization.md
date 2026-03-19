# BUGFIX: Timezone Normalization - Tabela_Temp_V5

## Summary

The frontend controller has timezone handling issues that need to be addressed when integrating with the new backend v3.1 (which returns UTC timestamps).

---

## Issues Identified

### Issue #1: Hardcoded -6 Hours Hack (CRITICAL)

**Location:** `controller.js` lines 947-958

```javascript
// ===== NORMALIZAÇÃO DE TIMEZONE: -6h no time_interval =====
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const normalizedReadings = (Array.isArray(readings) ? readings : []).map((r) => {
  if (r.time_interval) {
    const originalTime = new Date(r.time_interval);
    const normalizedTime = new Date(originalTime.getTime() - SIX_HOURS_MS);
    return { ...r, time_interval: normalizedTime.toISOString() };
  }
  return r;
});
```

**Problem:**
- This was a workaround because the old backend returned times with an extra 6-hour offset
- With v3.1 backend returning UTC directly, this -6h will BREAK the data
- Result: Times will be displayed 6 hours earlier than they should

**Fix Required:**
- Remove this -6h normalization when using v3.1 backend
- Or make it conditional based on backend version

---

### Issue #2: Display Function Shows UTC Instead of Brazil Time

**Location:** `controller.js` lines 481-488

```javascript
function brDatetime(iso) {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}
```

**Problem:**
- Function name suggests Brazil datetime (`brDatetime`)
- But it displays UTC values directly (`getUTCDate`, `getUTCHours`, etc.)
- If backend returns `2026-02-10T03:00:00Z` (UTC), this displays `10/02/2026 03:00`
- User expects to see `10/02/2026 00:00` (Brazil time)

**Fix Required:**
```javascript
function brDatetime(iso) {
  const d = new Date(iso);
  // Use toLocaleString for Brazil timezone conversion
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(',', '');
}
```

Or manual calculation:
```javascript
function brDatetime(iso) {
  const d = new Date(iso);
  // Brazil is UTC-3
  const brasilOffset = -3 * 60 * 60 * 1000;
  const brasilTime = new Date(d.getTime() + brasilOffset);

  const dd = String(brasilTime.getUTCDate()).padStart(2, '0');
  const mm = String(brasilTime.getUTCMonth() + 1).padStart(2, '0');
  const yy = brasilTime.getUTCFullYear();
  const hh = String(brasilTime.getUTCHours()).padStart(2, '0');
  const mi = String(brasilTime.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}
```

---

### Issue #3: Date Payload Conversion (OK - No Change Needed)

**Location:** `controller.js` lines 839-844

```javascript
const s = new Date(Date.UTC(startYear, startMonth, startDay, 3, 0, 0, 0)); // 03:00 UTC = 00:00 Brasil
let e = new Date(Date.UTC(endYear, endMonth, endDay + 1, 2, 59, 59, 999)); // 02:59 UTC = 23:59 Brasil
```

**Status:** ✅ CORRECT

This correctly converts local Brazil dates to UTC for the API payload:
- User selects `10/02/2026` in Brazil
- Sends `2026-02-10T03:00:00.000Z` (start) and `2026-02-11T02:59:59.999Z` (end)

This matches what the v3.1 backend expects.

---

### Issue #4: Chunk Date Creation

**Location:** `controller.js` lines 736-774

```javascript
function createDateChunks(startDate, endDate, chunkSizeDays = 5) {
  // ...
  chunkEnd.setUTCHours(2, 59, 59, 999); // 02:59 UTC = 23:59 Brasil
  // ...
}
```

**Status:** ✅ CORRECT (assuming UTC input)

The chunking logic correctly uses UTC values to represent Brazil day boundaries.

---

## Migration Path

### Step 1: Remove -6h Hack

```diff
- // ===== NORMALIZAÇÃO DE TIMEZONE: -6h no time_interval =====
- const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
- const normalizedReadings = (Array.isArray(readings) ? readings : []).map((r) => {
-   if (r.time_interval) {
-     const originalTime = new Date(r.time_interval);
-     const normalizedTime = new Date(originalTime.getTime() - SIX_HOURS_MS);
-     return { ...r, time_interval: normalizedTime.toISOString() };
-   }
-   return r;
- });
+ // v3.1 backend returns UTC directly - no normalization needed
+ const normalizedReadings = Array.isArray(readings) ? readings : [];
```

### Step 2: Fix brDatetime Display

```diff
function brDatetime(iso) {
  const d = new Date(iso);
- const dd = String(d.getUTCDate()).padStart(2, '0');
- const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
- const yy = d.getUTCFullYear();
- const hh = String(d.getUTCHours()).padStart(2, '0');
- const mi = String(d.getUTCMinutes()).padStart(2, '0');
- return `${dd}/${mm}/${yy} ${hh}:${mi}`;
+ return d.toLocaleString('pt-BR', {
+   timeZone: 'America/Sao_Paulo',
+   day: '2-digit',
+   month: '2-digit',
+   year: 'numeric',
+   hour: '2-digit',
+   minute: '2-digit',
+ }).replace(',', '');
}
```

---

## Summary Table

| Issue | Location | Severity | Action |
|-------|----------|----------|--------|
| -6h hack | lines 947-958 | **CRITICAL** | Remove |
| brDatetime shows UTC | lines 481-488 | **HIGH** | Fix to show Brazil time |
| Date payload | lines 839-844 | OK | No change |
| Chunk creation | lines 736-774 | OK | No change |

---

## Testing Checklist

After applying fixes:

- [ ] Select date 10/02/2026 in Brazil
- [ ] Verify payload sends `dateStart: "2026-02-10T03:00:00.000Z"`
- [ ] Verify response `time_interval: "2026-02-10T03:00:00.000Z"` displays as `10/02/2026 00:00`
- [ ] Verify data at 14:30 Brazil (`17:30:00.000Z` UTC) displays as `14:30`, not `17:30`
- [ ] Verify "SEM DADOS" slots appear at correct local times
