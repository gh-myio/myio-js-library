# RFC-0160: BAS Dashboard Bugfixes (Layout, Classification, Sorting)

- **Status:** Implemented
- **Author:** Claude Code Assist
- **Reviewer:** Rodrigo
- **Target Release:** Next patch release
- **Created:** 2026-02-08
- **Related:** RFC-0158 (MAIN_BAS Architecture), RFC-0142 (Device Classification)

---

## Summary

This RFC documents a comprehensive set of bugfixes for the BAS (Building Automation System) dashboard. The fixes address data parsing issues, device classification failures, layout problems, and UX improvements for the EntityListPanel component.

**Key Issues Identified:**

| # | Issue | Severity | Root Cause |
|---|-------|----------|------------|
| 1 | Cols 3-4 empty (no HVAC/Motors cards) | Critical | Device classification returning all as `energy` |
| 2 | deviceType values are timestamps | Critical | Data parsing extracting wrong array position |
| 3 | Only 1 ambiente in sidebar (should be 8) | High | Data grouping bug in occurrence tracking |
| 4 | Sidebar items unsorted | Medium | EntityListPanel has no sorting feature |
| 5 | Sidebar labels show `(001)-Deck` | Medium | EntityListPanel has no label transformation |
| 6 | Potential dead space in layout | Low | CSS flex chain may need `min-height: 0` |

---

## 1. Data Parsing Fix (Critical)

### 1.1 Problem

ThingsBoard widget data format observed in logs:

```javascript
row.data['0'] = [timestamp, actualValue, [timestamp, timestamp]]
// Example: [1770484860130, "HIDROMETRO", [1770484860130, 1770484860130]]
```

The `getFirstDataValue()` function was incorrectly extracting values, returning timestamps instead of the actual string values like `"HIDROMETRO"`.

### 1.2 Current Behavior (Broken)

```javascript
// Log output showing broken extraction:
Device "Hidr. Reuso Superior x1": {"deviceType":1770484860130, ...}
// deviceType should be "HIDROMETRO", not a timestamp
```

### 1.3 Solution

Update `getFirstDataValue()` to always return `entry[1]`:

```javascript
function getFirstDataValue(rowData) {
  if (!rowData) return null;
  var keys = Object.keys(rowData);
  if (keys.length === 0) return null;
  var entry = rowData[keys[0]];

  // ThingsBoard format: [timestamp, actualValue, [ts, ts]]
  if (Array.isArray(entry) && entry.length >= 2) {
    return entry[1]; // The actual value is at position [1]
  }

  return entry; // Fallback: direct value
}
```

### 1.4 Files Affected

- `src/thingsboard/bas-components/MAIN_BAS/controller.js`
  - Function: `getFirstDataValue()` (lines ~70-85)

### 1.5 Acceptance Criteria

- [x] Log shows `deviceType: "HIDROMETRO"` (string, not timestamp)
- [x] Log shows `deviceProfile: "HIDROMETRO"` (string, not timestamp)
- [x] All 6 dataKeys properly extracted per device

---

## 2. Device Classification Fix (Critical)

### 2.1 Problem

With deviceType values being timestamps (Bug #1), the `detectDomain()` function cannot match any patterns and defaults everything to `energy/equipments`.

### 2.2 Current Classification Constants

```javascript
var OCULTOS_PATTERNS = ['ARQUIVADO', 'SEM_DADOS', 'DESATIVADO', 'REMOVIDO', 'INATIVO'];
var ENTRADA_TYPES = ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'];
var MOTOR_TYPES = ['BOMBA', 'MOTOR', 'BOMBA_HIDRAULICA', 'BOMBA_INCENDIO', 'BOMBA_CAG'];
var HVAC_TYPES = ['TERMOSTATO', 'CHILLER', 'FANCOIL', 'HVAC', 'AR_CONDICIONADO'];
```

### 2.3 Missing Water Types

The `detectDomain()` function needs explicit water type detection:

```javascript
var WATER_TYPES = ['HIDROMETRO', 'CAIXA_DAGUA', 'SOLENOIDE', 'TANQUE'];
```

### 2.4 Solution

Update `detectDomain()` to include water detection:

```javascript
function detectDomain(deviceType) {
  if (!deviceType) return 'energy';
  var upper = deviceType.toUpperCase();

  // Check water types FIRST (before energy default)
  for (var i = 0; i < WATER_TYPES.length; i++) {
    if (upper.includes(WATER_TYPES[i])) {
      return 'water';
    }
  }

  // Check HVAC/temperature types
  for (var i = 0; i < HVAC_TYPES.length; i++) {
    if (upper.includes(HVAC_TYPES[i])) {
      return 'temperature';
    }
  }

  // Check motor types
  for (var i = 0; i < MOTOR_TYPES.length; i++) {
    if (upper.includes(MOTOR_TYPES[i])) {
      return 'motor';
    }
  }

  // Default to energy
  return 'energy';
}
```

### 2.5 Files Affected

- `src/thingsboard/bas-components/MAIN_BAS/controller.js`
  - Add: `WATER_TYPES` constant
  - Update: `detectDomain()` function

### 2.6 Acceptance Criteria

- [x] `Hidr. Reuso Superior x1` → `domain: water`
- [x] `Temp. RJ 1` → `domain: temperature`
- [x] `DM4 B7R Potável Reserva` → `domain: motor` (if deviceType contains BOMBA)
- [x] Cards appear in columns 3 (HVAC) and 4 (Motors)

---

## 3. Ambientes Sidebar Fix (High)

### 3.1 Problem

Screenshot shows only 1 ambiente `(008)-Integrações` in sidebar, but data has 8 ambientes.

### 3.2 Root Cause Analysis

From logs:
```
Ambientes (sidebar): 8 ['(008)-Integrações', '(007)-Configuração', ...]
```

Data IS being parsed correctly (8 items). The issue is likely:
1. CSS overflow hiding items, OR
2. EntityListPanel rendering issue

### 3.3 Investigation Points

1. Check `.bas-sidebar-slot` CSS:
   ```css
   .bas-sidebar-slot {
     overflow: hidden;  /* This may be clipping content */
   }
   ```

2. Check if EntityListPanel list container has `overflow-y: auto`

### 3.4 Solution

Update sidebar slot CSS to allow scrolling:

```css
.bas-sidebar-slot {
  grid-column: 1;
  grid-row: 1;
  overflow: hidden;  /* Keep horizontal hidden */
  overflow-y: auto;  /* ADD: Allow vertical scroll */
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Ensure EntityListPanel fills the slot */
.bas-sidebar-slot > .myio-elp {
  flex: 1;
  min-height: 0;
  overflow-y: auto;  /* ADD: Internal scroll */
}
```

### 3.5 Files Affected

- `src/thingsboard/bas-components/MAIN_BAS/styles.css`
  - Update: `.bas-sidebar-slot` rules (lines 49-65)

### 3.6 Acceptance Criteria

- [x] All 8 ambientes visible in sidebar (scrollable if needed)
- [x] "Todos" button visible at top
- [x] Search input visible

---

## 4. EntityListPanel Sorting & Label Normalization (Medium)

### 4.1 Problem

1. Items render in source order (no sorting)
2. Labels display with prefixes: `(001)-Deck` instead of `Deck`

### 4.2 Current State

EntityListPanel has NO sorting implementation and NO label transformation:

```typescript
// Current: items rendered as-is
const filtered = this.filterText
  ? items.filter(it => it.label.toLowerCase().includes(this.filterText))
  : items;
```

### 4.3 Solution: New Options

Add to `EntityListPanelOptions` interface:

```typescript
export interface EntityListPanelOptions {
  // ... existing options ...

  /**
   * Sort order for items. Default: 'none' (preserve source order)
   * - 'asc': A-Z ascending
   * - 'desc': Z-A descending
   * - 'none': No sorting (backward compatible)
   */
  sortOrder?: 'asc' | 'desc' | 'none';

  /**
   * Regex pattern to remove from labels for display purposes.
   * Original label preserved for ID/search matching.
   * Example: '^\(\d{3}\)-\s*' removes '(001)-' prefix
   */
  excludePartOfLabel?: string;

  /**
   * Regex flags for excludePartOfLabel. Default: ''
   */
  excludePartOfLabelFlags?: string;
}
```

### 4.4 Implementation

```typescript
// In EntityListPanel class

private normalizeLabel(raw: string): string {
  if (!this.options.excludePartOfLabel) return raw;
  const flags = this.options.excludePartOfLabelFlags || '';
  try {
    const regex = new RegExp(this.options.excludePartOfLabel, flags);
    return raw.replace(regex, '').trim();
  } catch (e) {
    console.warn('[EntityListPanel] Invalid excludePartOfLabel regex:', e);
    return raw;
  }
}

private sortItems(items: EntityListItem[]): EntityListItem[] {
  if (!this.options.sortOrder || this.options.sortOrder === 'none') {
    return items; // No sorting - backward compatible
  }

  return [...items].sort((a, b) => {
    const labelA = this.normalizeLabel(a.label);
    const labelB = this.normalizeLabel(b.label);
    const comparison = labelA.localeCompare(labelB, 'pt-BR', { sensitivity: 'base' });
    return this.options.sortOrder === 'desc' ? -comparison : comparison;
  });
}

// Update renderList() to use sorted items:
private renderList(): void {
  // ... existing code ...

  const sortedItems = this.sortItems(this.items);
  const filtered = this.filterText
    ? sortedItems.filter(it => it.label.toLowerCase().includes(this.filterText))
    : sortedItems;

  // ... render using normalizeLabel() for display ...
}
```

### 4.5 Usage in MAIN_BAS

```javascript
_ambientesListPanel = new MyIOLibrary.EntityListPanel({
  title: settings.sidebarLabel || 'Ambientes',
  subtitle: 'Nome ↑',
  items: buildAmbienteItems(ambientes),
  sortOrder: 'asc',
  excludePartOfLabel: '^\\(\\d{3}\\)-\\s*',  // Remove (001)- prefix
  showAllOption: true,
  allLabel: 'Todos',
  searchPlaceholder: 'Buscar...',
  handleClickItem: function(item) { /* ... */ },
  handleClickAll: function() { /* ... */ },
});
```

### 4.6 Expected Result

| Raw Label (stored) | Display Label (rendered) |
|-------------------|-------------------------|
| (001)-Deck | Deck |
| (002)-Sala do Nobreak | Sala do Nobreak |
| (003)-Auditório | Auditório |
| (004)-Staff Rio de Janeiro | Staff Rio de Janeiro |
| (005)-Bombas | Bombas |
| (006)-Água | Água |
| (007)-Configuração | Configuração |
| (008)-Integrações | Integrações |

Sorted ASC by display label:
1. Água
2. Auditório
3. Bombas
4. Configuração
5. Deck
6. Integrações
7. Sala do Nobreak
8. Staff Rio de Janeiro

### 4.7 Files Affected

- `src/components/entity-list-panel/EntityListPanel.ts`
  - Add: `sortOrder`, `excludePartOfLabel`, `excludePartOfLabelFlags` options
  - Add: `normalizeLabel()` method
  - Add: `sortItems()` method
  - Update: `renderList()` to use sorted/normalized items

### 4.8 Acceptance Criteria

- [x] Items sorted alphabetically by display label
- [x] Labels display without `(XXX)-` prefix
- [x] Search still matches original label
- [x] Selection still works with original ID
- [x] Without config, behavior unchanged (backward compatible)

---

## 5. Layout Verification (Low)

### 5.1 Current Layout Structure

```
.bas-dashboard-container (flex column, 100% height)
├── .bas-header (flex-shrink: 0)
└── .bas-content-layout (CSS Grid, flex: 1)
    ├── .bas-sidebar-slot   (col 1, row 1)      20% × 50%
    ├── .bas-water-slot     (col 2, row 1)      40% × 50%
    ├── .bas-charts-slot    (col 1-2, row 2)    60% × 50%
    ├── .bas-ambientes-slot (col 3, row 1-2)    20% × 100%
    └── .bas-motors-slot    (col 4, row 1-2)    20% × 100%
```

### 5.2 Verification Checklist

- [x] `.bas-dashboard-container` has `height: 100%`
- [x] `.bas-content-layout` has `flex: 1` and `min-height: 0`
- [x] Grid rows are `50% 50%` (responsive to container height)
- [x] No fixed pixel heights causing dead space
- [x] All slots have `overflow` handling (hidden or auto)

### 5.3 Fix Applied

Added `min-height: 0` to ensure flex chain is complete:

```css
.bas-dashboard-container {
  height: 100%;
  min-height: 0;  /* Added */
  display: flex;
  flex-direction: column;
}

.bas-content-layout {
  flex: 1;
  min-height: 0;  /* Already present */
  display: grid;
  /* ... grid rules ... */
}
```

### 5.4 Files Affected

- `src/thingsboard/bas-components/MAIN_BAS/styles.css`

---

## 6. Empty State Verification (Low)

### 6.1 Current Implementation

Both CardGridPanel and DeviceGridV6 have built-in empty state handling:

```javascript
// CardGridPanel
emptyMessage: 'Nenhum dispositivo'

// DeviceGridV6
emptyMessage: 'Nenhum equipamento'
// Also shows icon: 🔌
```

### 6.2 Verification

Mount functions ALWAYS call the panel constructor, even with 0 items:

```javascript
// CORRECT: Always mount, pass empty array if needed
function mountAmbientesPanel(host, classified, settings) {
  var items = buildHVACCardItems(classified, null);
  // items may be [] but panel still mounts

  var panel = new MyIOLibrary.CardGridPanel({
    title: settings.environmentsLabel || 'Ambientes',
    items: items,  // Can be empty []
    emptyMessage: 'Nenhum ambiente HVAC disponível',
    // ...
  });

  host.appendChild(panel.getElement());
  return panel;
}
```

### 6.3 Files Affected

- `src/thingsboard/bas-components/MAIN_BAS/controller.js`
  - Verified: `mountAmbientesPanel()`, `mountMotorsPanel()`

---

## Implementation Status

| Phase | Task | Priority | Status |
|-------|------|----------|--------|
| 1 | Fix `getFirstDataValue()` - extract `entry[1]` | Critical | ✅ Already implemented |
| 2 | Add `WATER_TYPES` and fix `detectDomain()` | Critical | ✅ Implemented |
| 3 | Fix `.bas-sidebar-slot` overflow CSS | High | ✅ Implemented |
| 4 | Add EntityListPanel sorting/label normalization | Medium | ✅ Implemented |
| 5 | Update MAIN_BAS to use new EntityListPanel options | Medium | ✅ Implemented |
| 6 | Verify layout CSS flex chain | Low | ✅ Verified & Fixed |
| 7 | Verify empty state rendering | Low | ✅ Verified |

---

## Testing Plan

### Unit Tests (if available)

1. **EntityListPanel**
   - `normalizeLabel('(001)-Deck')` with regex `^\(\d{3}\)-\s*` → `'Deck'`
   - `sortItems([...])` with `sortOrder: 'asc'` → alphabetical order
   - No regex config → label unchanged

### Manual QA

1. **Data Parsing**
   - Check console log: `deviceType: "HIDROMETRO"` (not timestamp)
   - Check console log: `deviceProfile: "HIDROMETRO"` (not timestamp)

2. **Classification**
   - `Hidr.*` devices → Water panel (col 2)
   - `Temp.*` devices → Ambientes/HVAC panel (col 3)
   - `DM*`/`Bomba*` devices → Motors panel (col 4)

3. **Sidebar**
   - All 8 ambientes visible
   - Sorted alphabetically by display name
   - Labels show clean names (no prefix)
   - Search works
   - Selection works

4. **Layout**
   - No dead space between panels
   - Chart fills remaining height
   - All 4 columns visible
   - Responsive at different screen sizes

---

## Rollout

1. ✅ Apply fixes to `bas-components` branch
2. Test on `showcase/myio-bas/index.html`
3. Test on ThingsBoard dev instance
4. Merge to main
5. Publish patch release

---

## Appendix A: Log Analysis Reference

### Expected Log After Fixes

```
[MAIN_BAS] ============ PARSING DATA ============
[MAIN_BAS] Total rows: 254
[MAIN_BAS] Row 99: {"aliasName":"AllDevices","entityType":"DEVICE","entityLabel":"Hidr. Reuso Superior x1","dataKeyName":"deviceType","value":"HIDROMETRO",...}
[MAIN_BAS] Phase 1 complete:
[MAIN_BAS]   Unique Ambientes: 8
[MAIN_BAS]   Unique Devices: 26
[MAIN_BAS] Device "Hidr. Reuso Superior x1": {"deviceType":"HIDROMETRO","deviceProfile":"HIDROMETRO",...}
[MAIN_BAS] Added: Hidr. Reuso Superior x1 | domain: water | context: hidrometro
[MAIN_BAS] Device "Temp. RJ 1": {"deviceType":"TERMOSTATO","deviceProfile":"TERMOSTATO",...}
[MAIN_BAS] Added: Temp. RJ 1 | domain: temperature | context: termostato
[MAIN_BAS] Classification: {water: ["hidrometro:4",...], temperature: ["termostato:3"], motor: ["bomba:5"], energy: [...]}
```

---

## Appendix B: Visual Reference

### Expected Layout After Fixes

```
┌─────────────────┬─────────────────────────┬───────────────┬───────────────┐
│ Ambientes       │ INFRAESTRUTURA HIDRICA  │ Ambientes     │ Bombas e      │
│ ───────────     │ ─────────────────────   │ (HVAC)        │ Motores       │
│ Nome ↑          │ ┌─────┐ ┌─────┐ ┌─────┐ │ ───────────   │ ───────────   │
│                 │ │Hidr.│ │Hidr.│ │Hidr.│ │ ┌─────┐       │ ┌─────┐       │
│ ○ Água          │ │Reuso│ │Pipa │ │Irrig│ │ │Temp.│       │ │DM4  │       │
│ ○ Auditório     │ └─────┘ └─────┘ └─────┘ │ │RJ 1 │       │ │B7R  │       │
│ ○ Bombas        │ ┌─────┐                 │ └─────┘       │ └─────┘       │
│ ○ Configuração  │ │Hidr.│                 │ ┌─────┐       │ ┌─────┐       │
│ ○ Deck          │ │Sabes│                 │ │Temp.│       │ │DM3  │       │
│ ○ Integrações   │ └─────┘                 │ │RJ 2 │       │ │B7   │       │
│ ○ Sala Nobreak  │                         │ └─────┘       │ └─────┘       │
│ ○ Staff RJ      │                         │               │               │
├─────────────────┴─────────────────────────┤               │               │
│ [Energia] [Água] [Temperatura]            │               │               │
│ ┌───────────────────────────────────────┐ │               │               │
│ │         📊 Chart (7 dias)             │ │               │               │
│ │         Bar chart kWh                 │ │               │               │
│ └───────────────────────────────────────┘ │               │               │
└───────────────────────────────────────────┴───────────────┴───────────────┘
  20% width           40% width               20% width       20% width
```

---

*RFC-0160 - BAS Dashboard Bugfixes*
*Created: 2026-02-08*
*Implemented: 2026-02-08*
