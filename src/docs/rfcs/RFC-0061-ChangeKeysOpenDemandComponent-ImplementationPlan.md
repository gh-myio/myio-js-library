# RFC-0061 Implementation Plan: Telemetry Key Selection for Demand Modal

**RFC:** RFC-0061-ChangeKeysOpenDemandComponent
**Component:** `DemandModal.ts`
**Total Estimated Time:** 64 hours (≈ 2 sprints)
**Status:** Ready for Implementation
**Author:** Rodrigo Pimentel / MYIO Engineering
**Reviewer:** Tech Lead – MYIO Library
**Last Updated:** 2025-11-04
**Revision:** 001

---

## Overview

This document outlines the detailed implementation plan for adding dynamic telemetry type selection to the Demand Modal component. Users will be able to switch between Power A/B/C, Current A/B/C, Voltage A/B/C, and Total Power without closing the modal.

---

## Scope & Out-of-Scope

### In Scope
- Telemetry type selector UI in Demand Modal
- Multi-series chart rendering (3-phase data)
- Dynamic data fetching on type switch
- Caching and performance optimizations
- Accessibility enhancements
- Comprehensive testing and documentation

### Out of Scope
Affects only `DemandModal.ts` within the MyIO library. Does **not** modify:
- Shared chart utilities
- Global telemetry fetching logic
- Other modal components (Energy Modal, Settings Modal, etc.)
- ThingsBoard API endpoints

### Data Source Alignment Note
Keys such as `consumption` should be treated as aliases for the active energy telemetry (e.g., `Wh3` or `Wh4` in some MyIO dashboards). This prevents confusion during staging tests and ensures consistency across different device configurations.

---

## Phase 1: Type Definitions & Core Logic (Sprint 1 - Week 1)

### Task 1.1: Create Telemetry Type System ⏱️ 3h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Define type system for telemetry configurations
- Create constants for supported telemetry types

**Implementation Steps:**
1. Add `TelemetryType` interface after existing type definitions:
```typescript
interface TelemetryType {
  id: string;
  label: string;
  keys: string | string[];
  defaultAggregation: 'AVG' | 'MAX' | 'MIN' | 'SUM';
  unit: string;
  color: string | string[];
}
```

2. Create `TELEMETRY_TYPES` constant:
```typescript
const TELEMETRY_TYPES: Record<string, TelemetryType> = {
  total_power: {
    id: 'total_power',
    label: 'Potência Total',
    keys: 'consumption',
    defaultAggregation: 'MAX',
    unit: 'kW',
    color: '#4A148C'
  },
  power_phases: {
    id: 'power_phases',
    label: 'Potência A, B, C',
    keys: ['a', 'b', 'c'],
    defaultAggregation: 'MAX',
    unit: 'kW',
    color: ['#FF5722', '#4CAF50', '#2196F3']
  },
  current_phases: {
    id: 'current_phases',
    label: 'Corrente A, B, C',
    keys: ['current_a', 'current_b', 'current_c'],
    defaultAggregation: 'AVG',
    unit: 'A',
    color: ['#FF5722', '#4CAF50', '#2196F3']
  },
  voltage_phases: {
    id: 'voltage_phases',
    label: 'Tensão A, B, C',
    keys: ['voltage_a', 'voltage_b', 'voltage_c'],
    defaultAggregation: 'AVG',
    unit: 'V',
    color: ['#FF5722', '#4CAF50', '#2196F3']
  }
};
```

**Acceptance Criteria:**
- [ ] All 4 telemetry types defined with correct properties
- [ ] Types exported for use in tests
- [ ] Code compiles without errors

---

### Task 1.2: Update Type Definitions ⏱️ 2h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Extend `DemandModalParams` interface
- Maintain backward compatibility

**Implementation Steps:**
1. Add optional parameters to `DemandModalParams`:
```typescript
export interface DemandModalParams {
  // ... existing params

  // NEW: Telemetry selector configuration
  allowTelemetrySwitch?: boolean;        // default: true
  availableTelemetryTypes?: string[];    // default: all types
}
```

2. Update JSDoc comments to document new params

**Acceptance Criteria:**
- [ ] New params are optional (backward compatible)
- [ ] Default values documented in comments
- [ ] TypeScript compilation succeeds

---

### Task 1.3: Telemetry Type Detection Logic ⏱️ 3h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Detect initial telemetry type from params
- Support all key formats

**Implementation Steps:**
1. Add utility function before `openDemandModal`:
```typescript
function detectTelemetryType(keys?: string): TelemetryType {
  if (!keys) return TELEMETRY_TYPES.total_power;

  const keyStr = keys.toLowerCase().trim();

  // Check each telemetry type
  for (const type of Object.values(TELEMETRY_TYPES)) {
    const typeKeys = Array.isArray(type.keys)
      ? type.keys.join(',')
      : type.keys;

    if (typeKeys === keyStr) {
      return type;
    }
  }

  // Default fallback
  return TELEMETRY_TYPES.total_power;
}
```

2. Add state variable in modal closure:
```typescript
let currentTelemetryType: TelemetryType;
```

3. Initialize in `openDemandModal`:
```typescript
currentTelemetryType = detectTelemetryType(params.telemetryQuery?.keys);
```

**Acceptance Criteria:**
- [ ] Correctly detects all 4 telemetry types
- [ ] Handles undefined/null keys
- [ ] Falls back to total_power for unknown keys
- [ ] Case-insensitive matching

---

### Task 1.4: Extract Reusable Utilities ⏱️ 2h
**New File:** `src/utils/telemetryUtils.ts`

**Objectives:**
- Extract telemetry helpers to prevent DemandModal.ts from exceeding 1,000 lines
- Create reusable utilities for caching and type detection

**Implementation Steps:**
1. Create new file `src/utils/telemetryUtils.ts`:
```typescript
/**
 * Telemetry utilities for DemandModal component
 * Extracted to keep modal file maintainable
 */

import { TelemetryType, TELEMETRY_TYPES } from '../components/DemandModal';

/**
 * Detect telemetry type from keys string
 */
export function detectTelemetryType(keys?: string): TelemetryType {
  if (!keys) return TELEMETRY_TYPES.total_power;

  const keyStr = keys.toLowerCase().trim();

  for (const type of Object.values(TELEMETRY_TYPES)) {
    const typeKeys = Array.isArray(type.keys)
      ? type.keys.join(',')
      : type.keys;

    if (typeKeys === keyStr) {
      return type;
    }
  }

  return TELEMETRY_TYPES.total_power;
}

/**
 * Generate cache key for telemetry data
 */
export function getCacheKey(
  type: TelemetryType,
  startDate: string,
  endDate: string
): string {
  const keys = Array.isArray(type.keys) ? type.keys.join(',') : type.keys;
  return `${keys}|${startDate}|${endDate}`;
}

/**
 * LRU cache for telemetry data
 */
const telemetryDataCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached telemetry data if valid
 */
export function getCachedData(cacheKey: string): any | null {
  const cached = telemetryDataCache.get(cacheKey);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    telemetryDataCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

/**
 * Set cached telemetry data with LRU eviction
 */
export function setCachedData(cacheKey: string, data: any): void {
  telemetryDataCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  // LRU: limit cache size to 10 entries
  if (telemetryDataCache.size > 10) {
    const firstKey = telemetryDataCache.keys().next().value;
    telemetryDataCache.delete(firstKey);
  }
}
```

2. Update `DemandModal.ts` to import from utils:
```typescript
import {
  detectTelemetryType,
  getCacheKey,
  getCachedData,
  setCachedData
} from '../utils/telemetryUtils';
```

3. Remove duplicated functions from `DemandModal.ts`

**Acceptance Criteria:**
- [ ] New file created with all utilities
- [ ] DemandModal.ts imports from utils
- [ ] No code duplication
- [ ] All tests still pass
- [ ] TypeScript compilation succeeds

---

## Phase 2: UI Implementation (Sprint 1)

### Task 2.1: Add Telemetry Selector HTML ⏱️ 2h
**File:** `src/components/DemandModal.ts` (in `createModalHTML` function)

**Objectives:**
- Add dropdown selector to modal header
- Position next to existing controls

**Implementation Steps:**
1. Locate the header controls section (around line 1100)
2. Add telemetry selector HTML after date range picker:
```typescript
${params.allowTelemetrySwitch !== false ? `
  <div class="myio-form-group">
    <label for="telemetry-type-select" class="myio-label">
      Tipo de Telemetria
    </label>
    <select
      id="telemetry-type-select"
      class="myio-select"
      aria-label="Selecionar tipo de telemetria">
      <option value="total_power">Potência Total</option>
      <option value="power_phases">Potência A, B, C</option>
      <option value="current_phases">Corrente A, B, C</option>
      <option value="voltage_phases">Tensão A, B, C</option>
    </select>
  </div>
` : ''}
```

3. Filter options based on `params.availableTelemetryTypes` if provided

**Acceptance Criteria:**
- [ ] Dropdown renders in correct position
- [ ] All 4 options visible
- [ ] Conditional rendering works
- [ ] Initial value set to detected type

---

### Task 2.2: Add CSS Styles ⏱️ 2h
**File:** `src/components/DemandModal.ts` (in `injectCSS` function)

**Objectives:**
- Style the select element to match design system
- Add hover/focus/disabled states

**Implementation Steps:**
1. Add select styles in CSS section:
```css
.myio-select {
  padding: 8px 32px 8px 12px;
  border: 1px solid #ddd;
  border-radius: ${styles.buttonRadius};
  font-size: ${styles.fontSizeSm};
  font-family: ${styles.fontFamily};
  background: white url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="%23666" d="M4 6l4 4 4-4z"/></svg>') no-repeat right 8px center;
  background-size: 16px;
  cursor: pointer;
  min-width: 180px;
  transition: all 0.2s ease;
}

.myio-select:hover {
  border-color: ${styles.primaryColor};
}

.myio-select:focus {
  outline: none;
  border-color: ${styles.primaryColor};
  box-shadow: 0 0 0 3px rgba(74, 20, 140, 0.1);
}

.myio-select:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.6;
}
```

**Acceptance Criteria:**
- [ ] Select matches existing design system
- [ ] Dropdown arrow visible and styled
- [ ] Focus state accessible
- [ ] Disabled state clear

---

## Phase 3: Event Handling & Data Switching (Sprint 1 - Week 2)

### Task 3.1: Setup Event Listeners ⏱️ 2h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Attach change event to selector
- Initialize selected value

**Implementation Steps:**
1. Create setup function with debounce to prevent excessive API calls:
```typescript
let switchDebounceTimer: NodeJS.Timeout | null = null;

function setupTelemetryTypeSelector() {
  const selector = overlay.querySelector('#telemetry-type-select') as HTMLSelectElement;

  if (!selector) return;

  // Set initial value
  selector.value = currentTelemetryType.id;

  // Attach change handler with 300ms debounce
  selector.addEventListener('change', async (e) => {
    const newTypeId = (e.target as HTMLSelectElement).value;
    const newType = TELEMETRY_TYPES[newTypeId];

    if (!newType) return;

    // Clear existing timer
    if (switchDebounceTimer) {
      clearTimeout(switchDebounceTimer);
    }

    // Debounce the switch (300ms)
    switchDebounceTimer = setTimeout(async () => {
      console.time('switchTelemetryType'); // Performance logging
      await switchTelemetryType(newType);
      console.timeEnd('switchTelemetryType');
    }, 300);
  });
}
```

2. Call in initialization sequence after modal is added to DOM

**Acceptance Criteria:**
- [ ] Event listener attached successfully
- [ ] Initial value set correctly
- [ ] Change event triggers handler
- [ ] Debounce prevents rapid API calls (300ms)
- [ ] Performance logging enabled for QA profiling

---

### Task 3.2: Implement Type Switching Logic ⏱️ 4h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Handle telemetry type changes
- Fetch new data and re-render chart

**Implementation Steps:**
1. Create `switchTelemetryType` async function:
```typescript
async function switchTelemetryType(newType: TelemetryType): Promise<void> {
  try {
    // Show loading
    showLoading();

    // Disable selector
    const selector = overlay.querySelector('#telemetry-type-select') as HTMLSelectElement;
    if (selector) selector.disabled = true;

    // Update current type
    currentTelemetryType = newType;

    // Build new query
    const newKeys = Array.isArray(newType.keys)
      ? newType.keys.join(',')
      : newType.keys;

    const newQuery: TelemetryQueryParams = {
      ...params.telemetryQuery,
      keys: newKeys,
      agg: newType.defaultAggregation
    };

    // Fetch new data
    const data = await fetchTelemetryData({
      token: params.token,
      deviceId: params.deviceId,
      startDate: params.startDate,
      endDate: params.endDate,
      telemetryQuery: newQuery
    });

    // Re-render chart
    renderDemandChart(data);

    // Hide loading
    hideLoading();

    // Re-enable selector
    if (selector) selector.disabled = false;

  } catch (error) {
    console.error('[DemandModal] Error switching telemetry type:', error);
    showError('Erro ao carregar telemetria: ' + (error as Error).message);
    hideLoading();

    // Re-enable selector
    const selector = overlay.querySelector('#telemetry-type-select') as HTMLSelectElement;
    if (selector) selector.disabled = false;
  }
}
```

2. Add `showLoading()` and `hideLoading()` helper functions:
```typescript
function showLoading() {
  const chartContainer = overlay.querySelector('#demand-chart-container');
  if (chartContainer) {
    chartContainer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 400px; flex-direction: column; gap: 16px;">
        <div class="myio-spinner"></div>
        <p style="color: #666; font-size: 14px;">Carregando ${currentTelemetryType.label}...</p>
      </div>
    `;
  }
}

function hideLoading() {
  // Chart render will replace loading content
}
```

**Acceptance Criteria:**
- [ ] Loading state shows during switch
- [ ] Selector disabled during loading
- [ ] New data fetched correctly
- [ ] Chart re-renders with new data
- [ ] Error handling works
- [ ] Selector re-enabled after completion

---

### Task 3.3: Preserve Modal Context ⏱️ 2h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Ensure settings are preserved during switch
- Maintain consistency

**Implementation Steps:**
1. Verify date range is preserved (already done via `params.startDate/endDate`)
2. Verify correction factor is preserved (check in data processing)
3. Verify timezone offset is preserved (check in data processing)
4. Add unit tests to verify context preservation

**Acceptance Criteria:**
- [ ] Date range unchanged after switch
- [ ] Correction factor still applied
- [ ] Timezone offset maintained
- [ ] All original params preserved

---

## Phase 4: Chart Rendering Updates (Sprint 1 - Week 2)

### Task 4.1: Detect Chart Mode ⏱️ 1h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Determine if single or multi-series chart needed

**Implementation Steps:**
1. Add detection logic in `renderDemandChart`:
```typescript
function renderDemandChart(telemetryData: any) {
  const isMultiSeries = Array.isArray(currentTelemetryType.keys);

  if (isMultiSeries) {
    renderMultiSeriesChart(telemetryData);
  } else {
    renderSingleSeriesChart(telemetryData);
  }
}
```

**Acceptance Criteria:**
- [ ] Correctly identifies multi-series types
- [ ] Routes to appropriate render function

---

### Task 4.2: Update Single-Series Chart ⏱️ 3h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Update existing chart to use telemetry type config
- Apply dynamic labels and colors

**Implementation Steps:**
1. Refactor existing `renderDemandChart` to `renderSingleSeriesChart`
2. Update chart options to use `currentTelemetryType`:
```typescript
function renderSingleSeriesChart(telemetryData: any) {
  // Existing data processing...

  const options = {
    chart: { type: 'line', height: 400 },
    series: [{
      name: currentTelemetryType.label,
      data: seriesData,
      color: currentTelemetryType.color as string
    }],
    yaxis: {
      title: { text: currentTelemetryType.unit },
      labels: { formatter: (val) => fmtPt(val, 2) }
    },
    // ... rest of options
  };

  // ... render chart
}
```

**Acceptance Criteria:**
- [ ] Y-axis label shows correct unit
- [ ] Series color from telemetry type
- [ ] Chart title updated
- [ ] Data displays correctly

---

### Task 4.3: Implement Multi-Series Chart ⏱️ 6h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Create new rendering function for 3-phase data
- Handle multiple series properly

**Implementation Steps:**
1. Create `renderMultiSeriesChart` function:
```typescript
function renderMultiSeriesChart(telemetryData: any) {
  const chartContainer = overlay.querySelector('#demand-chart-container');
  if (!chartContainer) return;

  // Clear existing chart
  chartContainer.innerHTML = '<div id="demand-apexchart"></div>';

  // Process data for each key
  const keys = currentTelemetryType.keys as string[];
  const colors = currentTelemetryType.color as string[];

  const series = keys.map((key, index) => {
    const keyData = telemetryData[key] || [];

    const seriesData = keyData.map((point: any) => ({
      x: new Date(point.ts).getTime(),
      y: (point.value || 0) * (params.correctionFactor || 1.0)
    }));

    return {
      name: `Fase ${key.toUpperCase().replace(/[^ABC]/g, '')}`,
      data: seriesData,
      color: colors[index]
    };
  });

  const options = {
    chart: {
      type: 'line',
      height: 400,
      toolbar: { show: true }
    },
    series: series,
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        format: 'dd/MM HH:mm'
      }
    },
    yaxis: {
      title: { text: currentTelemetryType.unit },
      labels: {
        formatter: (val: number) => fmtPt(val, 2)
      }
    },
    title: {
      text: currentTelemetryType.label,
      align: 'left'
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right'
    },
    tooltip: {
      shared: true,
      intersect: false
    },
    stroke: {
      width: 2,
      curve: 'smooth'
    }
  };

  const chart = new ApexCharts(
    chartContainer.querySelector('#demand-apexchart'),
    options
  );

  chart.render();
}
```

**Acceptance Criteria:**
- [ ] 3 series rendered (A, B, C)
- [ ] Each phase has correct color
- [ ] Legend shows phase names
- [ ] Tooltip shows all phases
- [ ] Data displays correctly

---

## Phase 5: Loading States & Error Handling (Sprint 2 - Week 3)

### Task 5.1: Enhanced Loading UI ⏱️ 2h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Improve loading experience
- Show progress indicators

**Implementation Steps:**
1. Update `showLoading()` function (done in Task 3.2)
2. Add loading state to summary section:
```typescript
const summaryContainer = overlay.querySelector('.myio-demand-summary');
if (summaryContainer) {
  summaryContainer.style.opacity = '0.5';
  summaryContainer.style.pointerEvents = 'none';
}
```

3. Restore on `hideLoading()`

**Acceptance Criteria:**
- [ ] Loading spinner visible
- [ ] Loading message shows current type
- [ ] Summary section dims during load
- [ ] Smooth transitions

---

### Task 5.2: Comprehensive Error Handling ⏱️ 2h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Handle all error scenarios gracefully
- Provide helpful error messages

**Implementation Steps:**
1. Add specific error messages:
```typescript
function showError(message: string) {
  const chartContainer = overlay.querySelector('#demand-chart-container');
  if (chartContainer) {
    chartContainer.innerHTML = `
      <div class="myio-error-state">
        <svg>...</svg>
        <h3>Erro ao Carregar Dados</h3>
        <p>${message}</p>
        <button onclick="location.reload()" class="myio-btn myio-btn-secondary">
          Tentar Novamente
        </button>
      </div>
    `;
  }
}
```

2. Handle specific error types:
   - Network errors
   - API errors (404, 500)
   - Invalid data format
   - Timeout errors

**Acceptance Criteria:**
- [ ] All error types handled
- [ ] User-friendly messages
- [ ] Recovery options provided
- [ ] Errors logged to console

---

### Task 5.3: Empty Data Handling ⏱️ 2h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Detect empty data responses
- Provide helpful guidance

**Implementation Steps:**
1. Add empty state check in `switchTelemetryType`:
```typescript
if (!data || Object.keys(data).length === 0) {
  showEmptyState();
  return;
}
```

2. Create `showEmptyState` function:
```typescript
function showEmptyState() {
  const chartContainer = overlay.querySelector('#demand-chart-container');
  if (chartContainer) {
    chartContainer.innerHTML = `
      <div class="myio-empty-state">
        <svg>...</svg>
        <h3>Nenhum Dado Disponível</h3>
        <p>Não há dados de ${currentTelemetryType.label} para o período selecionado.</p>
        <p class="hint">Tente selecionar um período diferente ou outro tipo de telemetria.</p>
      </div>
    `;
  }
}
```

**Acceptance Criteria:**
- [ ] Empty state detected correctly
- [ ] Helpful message shown
- [ ] Suggestions provided
- [ ] Selector remains enabled

---

## Phase 6: Testing (Sprint 2 - Week 3)

### Task 6.1: Unit Tests ⏱️ 6h
**File:** `src/components/__tests__/DemandModal.test.ts`

**Objectives:**
- Test core logic in isolation
- Achieve >80% coverage

**Test Cases:**
```typescript
describe('DemandModal - Telemetry Type Selection', () => {
  describe('detectTelemetryType', () => {
    test('detects total_power from "consumption"', () => {
      const type = detectTelemetryType('consumption');
      expect(type.id).toBe('total_power');
    });

    test('detects power_phases from "a,b,c"', () => {
      const type = detectTelemetryType('a,b,c');
      expect(type.id).toBe('power_phases');
    });

    test('detects current_phases from "current_a,current_b,current_c"', () => {
      const type = detectTelemetryType('current_a,current_b,current_c');
      expect(type.id).toBe('current_phases');
    });

    test('detects voltage_phases from "voltage_a,voltage_b,voltage_c"', () => {
      const type = detectTelemetryType('voltage_a,voltage_b,voltage_c');
      expect(type.id).toBe('voltage_phases');
    });

    test('defaults to total_power for unknown keys', () => {
      const type = detectTelemetryType('unknown_key');
      expect(type.id).toBe('total_power');
    });

    test('handles undefined keys', () => {
      const type = detectTelemetryType(undefined);
      expect(type.id).toBe('total_power');
    });
  });

  describe('TELEMETRY_TYPES', () => {
    test('all types have required properties', () => {
      Object.values(TELEMETRY_TYPES).forEach(type => {
        expect(type).toHaveProperty('id');
        expect(type).toHaveProperty('label');
        expect(type).toHaveProperty('keys');
        expect(type).toHaveProperty('defaultAggregation');
        expect(type).toHaveProperty('unit');
        expect(type).toHaveProperty('color');
      });
    });
  });
});
```

**Acceptance Criteria:**
- [ ] All test cases pass
- [ ] Coverage > 80%
- [ ] Edge cases covered
- [ ] No regressions

---

### Task 6.2: Integration Tests ⏱️ 4h
**File:** `src/components/__tests__/DemandModal.integration.test.ts`

**Objectives:**
- Test full workflow
- Verify API interactions

**Test Cases:**
```typescript
describe('DemandModal - Integration Tests', () => {
  test('opens modal with default telemetry type', async () => {
    const modal = await openDemandModal({
      token: 'test-token',
      deviceId: 'test-device',
      startDate: '2025-01-01',
      endDate: '2025-01-31'
    });

    const selector = document.querySelector('#telemetry-type-select');
    expect(selector.value).toBe('total_power');
  });

  test('switches telemetry type and refetches data', async () => {
    const fetchSpy = jest.fn();

    const modal = await openDemandModal({
      token: 'test-token',
      deviceId: 'test-device',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      fetcher: fetchSpy
    });

    const selector = document.querySelector('#telemetry-type-select');
    selector.value = 'current_phases';
    selector.dispatchEvent(new Event('change'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          telemetryQuery: expect.objectContaining({
            keys: 'current_a,current_b,current_c'
          })
        })
      );
    });
  });

  test('preserves date range when switching', async () => {
    // ... test implementation
  });

  test('respects allowTelemetrySwitch: false', async () => {
    const modal = await openDemandModal({
      token: 'test-token',
      deviceId: 'test-device',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      allowTelemetrySwitch: false
    });

    const selector = document.querySelector('#telemetry-type-select');
    expect(selector).toBeNull();
  });
});
```

**Acceptance Criteria:**
- [ ] Full workflows tested
- [ ] API calls verified
- [ ] UI interactions work
- [ ] All tests pass

---

### Task 6.3: Manual Testing ⏱️ 2h

**Test Scenarios:**

1. **Basic Functionality**
   - [ ] Open modal with each telemetry type
   - [ ] Switch between all type combinations
   - [ ] Verify chart renders correctly for each

2. **Edge Cases**
   - [ ] Empty data response
   - [ ] API error response
   - [ ] Network timeout
   - [ ] Invalid date range

3. **UI/UX**
   - [ ] Dropdown styling correct
   - [ ] Loading states smooth
   - [ ] Error messages clear
   - [ ] Mobile responsive

4. **Performance**
   - [ ] Switch time < 500ms
   - [ ] No memory leaks
   - [ ] Chart animations smooth

5. **Accessibility**
   - [ ] Keyboard navigation works
   - [ ] Screen reader announces changes
   - [ ] Focus management correct

**Browser & Device Testing Matrix:**

| Platform | Browser | Resolution | Status |
|----------|---------|------------|--------|
| Windows 11 | Chrome 120+ | 1920x1080 | ☐ |
| Windows 11 | Edge 120+ | 1920x1080 | ☐ |
| Windows 11 | Firefox 121+ | 1920x1080 | ☐ |
| macOS Sonoma | Safari 17+ | 1440x900 | ☐ |
| macOS Sonoma | Chrome 120+ | 1440x900 | ☐ |
| Android 13 | Chrome Mobile | 412x915 | ☐ |
| Android 13 | Samsung Internet | 412x915 | ☐ |
| iOS 17 | Safari Mobile | 390x844 | ☐ |
| iOS 17 | Chrome Mobile | 390x844 | ☐ |

**Acceptance Criteria:**
- [ ] All scenarios tested
- [ ] Browser matrix completed (minimum 80% pass rate)
- [ ] Issues documented in GitHub
- [ ] Critical bugs fixed before release
- [ ] Non-critical bugs added to backlog

---

## Phase 7: Documentation (Sprint 2 - Week 4)

### Task 7.1: Code Documentation ⏱️ 2h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Add comprehensive JSDoc comments
- Document all new functions

**Implementation Steps:**
1. Add JSDoc for `TelemetryType`:
```typescript
/**
 * Configuration for a telemetry type
 * @interface TelemetryType
 * @property {string} id - Unique identifier
 * @property {string} label - Display name (localized)
 * @property {string | string[]} keys - ThingsBoard telemetry keys
 * @property {'AVG' | 'MAX' | 'MIN' | 'SUM'} defaultAggregation - Default aggregation function
 * @property {string} unit - Measurement unit (kW, A, V)
 * @property {string | string[]} color - Chart color(s)
 */
```

2. Document `TELEMETRY_TYPES` constant
3. Add JSDoc for `detectTelemetryType`
4. Add JSDoc for `switchTelemetryType`
5. Add usage examples in comments

**Acceptance Criteria:**
- [ ] All new code documented
- [ ] Examples provided
- [ ] JSDoc compiles without warnings

---

### Task 7.2: API Documentation ⏱️ 2h
**File:** `src/docs/components/DemandModal.md`

**Objectives:**
- Document new parameters
- Provide usage examples

**Sections to Add:**

1. **Telemetry Type Selection**
```markdown
### Telemetry Type Selection

The Demand Modal supports dynamic telemetry type switching, allowing users to view different electrical measurements without closing the modal.

#### Available Telemetry Types

| Type | Keys | Unit | Description |
|------|------|------|-------------|
| Total Power | `consumption` | kW | Aggregate power consumption |
| Power A, B, C | `a`, `b`, `c` | kW | Three-phase power |
| Current A, B, C | `current_a`, `current_b`, `current_c` | A | Three-phase current |
| Voltage A, B, C | `voltage_a`, `voltage_b`, `voltage_c` | V | Three-phase voltage |

#### Usage

```typescript
// Default: Total Power
MyIOLibrary.openDemandModal({
  token: jwtToken,
  deviceId: 'device-uuid',
  startDate: '2025-01-01',
  endDate: '2025-01-31'
});

// Pre-select Current A,B,C
MyIOLibrary.openDemandModal({
  token: jwtToken,
  deviceId: 'device-uuid',
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  telemetryQuery: {
    keys: 'current_a,current_b,current_c',
    agg: 'AVG'
  }
});

// Disable type switching
MyIOLibrary.openDemandModal({
  token: jwtToken,
  deviceId: 'device-uuid',
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  allowTelemetrySwitch: false
});
```
```

**Acceptance Criteria:**
- [ ] All features documented
- [ ] Examples tested and working
- [ ] Screenshots included

---

### Task 7.3: Update Project Documentation ⏱️ 2h
**Files:** `README.md`, `CHANGELOG.md`

**Objectives:**
- Announce new feature
- Document breaking changes (if any)

**README Updates:**
```markdown
### Demand Modal with Telemetry Type Selection

View instantaneous telemetry with dynamic type switching:

- **Total Power:** Aggregate consumption
- **Power A, B, C:** Three-phase power analysis
- **Current A, B, C:** Three-phase current monitoring
- **Voltage A, B, C:** Three-phase voltage tracking

[View full documentation](./src/docs/components/DemandModal.md)
```

**CHANGELOG Entry:**
```markdown
## [0.2.0] - 2025-11-05

### Added
- ✨ Telemetry type selector in Demand Modal
- Support for multi-phase power, current, and voltage visualization
- Dynamic chart re-rendering on telemetry type switch
- New params: `allowTelemetrySwitch`, `availableTelemetryTypes`

### Changed
- Chart rendering now supports multi-series data
- Improved loading states during data fetch

### Fixed
- Memory leak when switching telemetry types
```

**Acceptance Criteria:**
- [ ] README updated
- [ ] CHANGELOG entry added
- [ ] Version bumped to 0.2.0

---

## Phase 8: Polish & Release (Sprint 2 - Week 4)

### Task 8.1: Performance Optimization ⏱️ 4h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Implement caching
- Optimize re-renders

**Implementation Steps:**
1. Add LRU cache:
```typescript
const telemetryDataCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(type: TelemetryType, startDate: string, endDate: string): string {
  const keys = Array.isArray(type.keys) ? type.keys.join(',') : type.keys;
  return `${keys}|${startDate}|${endDate}`;
}

function getCachedData(cacheKey: string): any | null {
  const cached = telemetryDataCache.get(cacheKey);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    telemetryDataCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

function setCachedData(cacheKey: string, data: any): void {
  telemetryDataCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  // LRU: limit cache size to 10 entries
  if (telemetryDataCache.size > 10) {
    const firstKey = telemetryDataCache.keys().next().value;
    telemetryDataCache.delete(firstKey);
  }
}
```

2. Update `switchTelemetryType` to use cache:
```typescript
const cacheKey = getCacheKey(newType, params.startDate, params.endDate);
let data = getCachedData(cacheKey);

if (!data) {
  data = await fetchTelemetryData(...);
  setCachedData(cacheKey, data);
}
```

3. Add debouncing for rapid switches

**Acceptance Criteria:**
- [ ] Cache working correctly
- [ ] LRU eviction works
- [ ] Performance improved
- [ ] No stale data issues

---

### Task 8.2: Accessibility Improvements ⏱️ 2h
**File:** `src/components/DemandModal.ts`

**Objectives:**
- Ensure WCAG 2.1 AA compliance
- Add screen reader support

**Implementation Steps:**
1. Add ARIA attributes:
```html
<select
  id="telemetry-type-select"
  class="myio-select"
  aria-label="Selecionar tipo de telemetria"
  aria-describedby="telemetry-type-help">
  ...
</select>
<span id="telemetry-type-help" class="sr-only">
  Escolha o tipo de telemetria para visualizar no gráfico
</span>
```

2. Add live region for announcements:
```typescript
const liveRegion = document.createElement('div');
liveRegion.setAttribute('role', 'status');
liveRegion.setAttribute('aria-live', 'polite');
liveRegion.className = 'sr-only';
overlay.appendChild(liveRegion);

function announceToScreenReader(message: string) {
  liveRegion.textContent = message;
  setTimeout(() => liveRegion.textContent = '', 1000);
}
```

3. Announce on type switch:
```typescript
announceToScreenReader(`Carregando ${newType.label}`);
// ... after load
announceToScreenReader(`${newType.label} carregado com sucesso`);
```

**Acceptance Criteria:**
- [ ] NVDA/JAWS tested
- [ ] Keyboard navigation works
- [ ] Announcements clear
- [ ] Focus management correct

---

### Task 8.3: Build & Release ⏱️ 2h

**Objectives:**
- Prepare for production release
- Publish new version

**Steps:**

1. **Pre-release Checks**
   - [ ] All tests pass
   - [ ] No TypeScript errors
   - [ ] No ESLint warnings
   - [ ] Bundle size < 5KB increase

2. **Build**
   ```bash
   npm run clean
   npm run build
   npm run test
   ```

3. **Version Bump**
   ```bash
   # Update package.json version: 0.1.110 → 0.2.0
   npm version minor -m "feat: Add telemetry type selector to Demand Modal (RFC-0061)"
   ```

4. **Git Tag**
   ```bash
   git tag -a v0.2.0 -m "Release v0.2.0: Telemetry Type Selection"
   git push origin main --tags
   ```

5. **NPM Publish** (if applicable)
   ```bash
   npm publish
   ```

6. **Create GitHub Release**
   - Title: v0.2.0 - Telemetry Type Selection
   - Description: From CHANGELOG
   - Attach build artifacts

**Acceptance Criteria:**
- [ ] Version bumped
- [ ] Git tagged
- [ ] Release notes created
- [ ] Published successfully

---

## Sprint 2 QA Checklist

**Final Quality Assurance before Release**

| Check | Responsible | Status | Notes |
|-------|-------------|--------|-------|
| **Functionality** |
| All 4 telemetry types work correctly | QA | ☐ | |
| Type switching preserves date range | QA | ☐ | |
| Multi-series charts render correctly | QA | ☐ | |
| Loading states display properly | QA | ☐ | |
| Error messages are clear | QA | ☐ | |
| **UI/UX** |
| Telemetry selector UX validated | QA | ☐ | |
| Multi-series phase colors correct (R,G,B) | QA | ☐ | |
| Dropdown styling matches design system | QA | ☐ | |
| Mobile responsive (< 768px) | QA | ☐ | |
| Chart legends readable | QA | ☐ | |
| **Performance** |
| Switch time < 500ms (avg 3 tests) | Dev | ☐ | |
| Cache TTL verified (5 min) | Dev | ☐ | |
| No memory leaks after 10 switches | Dev | ☐ | |
| Debounce working (300ms) | Dev | ☐ | |
| **Accessibility** |
| Keyboard navigation passes | QA | ☐ | |
| NVDA screen reader tested | QA | ☐ | |
| JAWS screen reader tested | QA | ☐ | |
| Focus management correct | QA | ☐ | |
| ARIA labels present | Dev | ☐ | |
| **Testing** |
| Unit test coverage > 80% | Dev | ☐ | |
| Integration tests pass | Dev | ☐ | |
| Browser matrix 80%+ pass | QA | ☐ | |
| **Documentation** |
| JSDoc comments complete | Dev | ☐ | |
| README updated | Dev | ☐ | |
| CHANGELOG entry added | Dev | ☐ | |
| API docs updated | Dev | ☐ | |
| **Release** |
| No TypeScript errors | Dev | ☐ | |
| No ESLint warnings | Dev | ☐ | |
| Bundle size impact < 5KB | Dev | ☐ | |
| Version bumped to 0.2.0 | Dev | ☐ | |
| Git tag created | Dev | ☐ | |

**QA Sign-off:**
- QA Engineer: ___________________ Date: ___________
- Tech Lead: _____________________ Date: ___________

---

## Rollback Plan

If regressions or critical issues occur after release to production:

### Immediate Actions (Within 1 hour)

1. **Revert to Previous Version**
   ```bash
   # Checkout previous stable tag
   git checkout v0.1.110

   # Rebuild
   npm run build

   # Republish (if npm package)
   npm publish --tag rollback
   ```

2. **Disable Feature via Config**
   - Deploy hotfix with `allowTelemetrySwitch: false` as default
   - This hides the selector while keeping other functionality intact

3. **Communicate to Stakeholders**
   - Notify team via Slack #engineering channel
   - Update status page if user-facing
   - Document issue in GitHub

### Monitoring Period (24 hours)

4. **Monitor Error Logs**
   - Check Sentry/error tracking for telemetry-related errors
   - Review console logs from production users
   - Monitor API error rates for telemetry endpoints

5. **Gather User Feedback**
   - Check support tickets for issues
   - Monitor user reports
   - Review analytics for usage patterns

### Recovery Actions (After 24h)

6. **Root Cause Analysis**
   - Identify what caused the regression
   - Document in post-mortem
   - Create bug fix branch

7. **Fix & Re-release**
   - Implement fix
   - Add regression tests
   - Release as patch version (v0.2.1)

### Rollback Triggers

Roll back immediately if:
- **Critical:** Modal fails to open
- **Critical:** Data loss or corruption
- **Critical:** Security vulnerability discovered
- **High:** > 5% of users experience errors
- **High:** Performance degradation > 2 seconds
- **Medium:** Accessibility regression (WCAG failure)

### Rollback Prevention

- Feature flag in code (`ENABLE_TELEMETRY_SELECTOR`)
- Gradual rollout (10% → 50% → 100%)
- Canary deployment to staging first
- Automated smoke tests post-deployment

---

## Summary

### Total Time Breakdown

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1: Type Definitions & Utilities | 4 | 10h |
| Phase 2: UI Implementation | 2 | 4h |
| Phase 3: Event Handling | 3 | 8h |
| Phase 4: Chart Rendering | 3 | 10h |
| Phase 5: Error Handling | 3 | 6h |
| Phase 6: Testing | 3 | 12h |
| Phase 7: Documentation | 3 | 6h |
| Phase 8: Polish & Release | 3 | 8h |
| **TOTAL** | **24 tasks** | **64h** |

### Sprint Allocation

**Sprint 1:** Phases 1-4 (32h)
- Type system and core logic
- Reusable utility extraction
- UI implementation
- Event handling with debounce
- Chart rendering (single & multi-series)

**Sprint 2:** Phases 5-8 (32h)
- Error handling and loading states
- Comprehensive testing (unit, integration, manual)
- Documentation (code, API, project)
- Polish (performance, accessibility) and release

### Dependencies

- ApexCharts library (already installed)
- ThingsBoard API access
- Test devices with multi-phase data
- Access to staging environment

### Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| API format changes | High | Test with all telemetry types early |
| Chart library limitations | Medium | Verify multi-series support upfront |
| Performance issues | Medium | Implement caching, monitor metrics |
| Browser compatibility | Low | Test on all major browsers |
| Breaking changes | High | Maintain backward compatibility |

### Success Metrics

- ✅ All 4 telemetry types selectable
- ✅ Switch time < 500ms
- ✅ No breaking changes
- ✅ Test coverage > 80%
- ✅ Documentation complete
- ✅ Zero critical bugs

---

## Optional Enhancements (Future Iterations)

These enhancements can be added in subsequent releases if needed:

### 1. Mock Data for Offline Testing
**File:** `src/mock/telemetryData.json`

Create mock JSON files for each telemetry type to enable offline testing and development:

```json
{
  "total_power": {
    "consumption": [
      { "ts": 1704067200000, "value": 12.5 },
      { "ts": 1704153600000, "value": 14.2 }
    ]
  },
  "power_phases": {
    "a": [{ "ts": 1704067200000, "value": 4.2 }],
    "b": [{ "ts": 1704067200000, "value": 4.1 }],
    "c": [{ "ts": 1704067200000, "value": 4.2 }]
  },
  "current_phases": {
    "current_a": [{ "ts": 1704067200000, "value": 18.5 }],
    "current_b": [{ "ts": 1704067200000, "value": 17.8 }],
    "current_c": [{ "ts": 1704067200000, "value": 18.2 }]
  },
  "voltage_phases": {
    "voltage_a": [{ "ts": 1704067200000, "value": 220.5 }],
    "voltage_b": [{ "ts": 1704067200000, "value": 219.8 }],
    "voltage_c": [{ "ts": 1704067200000, "value": 221.2 }]
  }
}
```

**Benefits:**
- Faster development (no API dependency)
- Consistent test data
- Demo mode for presentations
- Offline development support

### 2. Telemetry Type Comparison Mode
**RFC:** RFC-0062 (Future)

Allow users to select multiple telemetry types and view them in split view:

- Side-by-side chart comparison
- Synchronized time axis
- Toggle between overlay and split view

### 3. Custom Telemetry Formulas
**RFC:** RFC-0063 (Future)

Enable users to create calculated telemetry types:

- `Total Phase Power = a + b + c`
- `Phase Imbalance = max(a,b,c) - min(a,b,c)`
- `Power Factor = (a + b + c) / sqrt(current_a² + current_b² + current_c²)`

### 4. Export with Multiple Telemetry Types
Extend CSV export to include all telemetry types in separate columns:

| Timestamp | Total Power | Phase A | Phase B | Phase C | Current A | ... |
|-----------|-------------|---------|---------|---------|-----------|-----|
| 2025-01-01 00:00 | 12.5 | 4.2 | 4.1 | 4.2 | 18.5 | ... |

### 5. Telemetry Type Presets
Allow saving user preferences for telemetry type selection:

```typescript
// User preference stored in localStorage
const userPreferences = {
  defaultTelemetryType: 'power_phases',
  favoriteTypes: ['total_power', 'power_phases']
};
```

---

**Status:** Ready for Implementation
**Next Step:** Begin Phase 1, Task 1.1
**Owner:** Development Team
**Reviewer:** Tech Lead

---

## Revision History

| Revision | Date | Author | Changes |
|----------|------|--------|---------|
| 001 | 2025-11-04 | Rodrigo Pimentel | Incorporated review feedback from rev001:<br>- Added Scope & Out-of-Scope section<br>- Added data source alignment note<br>- Created Task 1.4: Extract telemetryUtils.ts<br>- Added debounce to Task 3.1<br>- Expanded testing matrix in Task 6.3<br>- Added Sprint 2 QA Checklist<br>- Added Rollback Plan<br>- Added Optional Enhancements section<br>- Updated time estimates (62h → 64h) |
| 000 | 2025-11-04 | Claude Code | Initial draft |
