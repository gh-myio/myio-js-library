# RFC: Standardize Date Range Picker (jQuery daterangepicker)

**Feature Name**: daterangepicker-standardization

**Start Date**: 2025-09-25

**Owners**: MyIO UI Platform

**Status**: Draft

**Target Library Namespace**: MyIOLibrary.DateRangePickerJQ

## Summary

Replace native date inputs in all Premium Modals with a single, consistent date-time range picker using jQuery daterangepicker. Provide a reusable wrapper that can be used anywhere (ThingsBoard widgets or our LIB) with one line of code.

## Motivation

### Current Problems
- **Inconsistent UX**: Native date inputs vary across browsers and don't support time selection
- **Limited Functionality**: No preset ranges, no time picker, poor mobile experience
- **Duplication**: Each modal implements date handling differently
- **Poor Accessibility**: Native inputs have limited screen reader support

### Benefits
- **Consistent UX**: Same calendar UI across all modals and widgets
- **Rich Functionality**: Time selection, preset ranges, validation
- **Better Mobile**: Touch-friendly interface
- **Reusable**: One wrapper for all date range needs

## Detailed Design

### Dependencies (CDN-based)
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.css" />
<script src="https://cdn.jsdelivr.net/jquery/latest/jquery.min.js"></script>
<script src="https://cdn.jsdelivr.net/momentjs/latest/moment.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.min.js"></script>
```

### Core Wrapper API

**File**: `src/components/premium-modals/internal/DateRangePickerJQ.ts`

```typescript
interface AttachOptions {
  presetStart?: string;  // ISO "YYYY-MM-DDTHH:mm:ssZ" or "YYYY-MM-DD"
  presetEnd?: string;    // ISO "YYYY-MM-DDTHH:mm:ssZ" or "YYYY-MM-DD"
  maxRangeDays?: number; // default 31
  timezone?: string;     // default "America/Sao_Paulo"
  onApply?: (range: { startISO: string; endISO: string }) => void;
}

interface DateRangeControl {
  getDates(): { startISO: string; endISO: string };
  setDates(startISO: string, endISO: string): void;
  destroy(): void;
}

function attach(input: HTMLInputElement, opts?: AttachOptions): DateRangeControl;
```

### Behavior Specification

#### Core Features
- **Time Picker**: 24-hour format with 1-minute increment
- **Auto Apply**: Changes apply immediately without confirmation
- **Linked Calendars**: Both calendars show consecutive months
- **Max Date**: Today 23:59 (local timezone)
- **Range Validation**: Enforce maxRangeDays (default 31)

#### Localization (pt-BR)
- **Format**: `DD/MM/YY HH:mm`
- **Separator**: ` até `
- **Preset Ranges**:
  - Hoje (Today)
  - Últimos 7 dias (Last 7 days)
  - Últimos 30 dias (Last 30 days)
  - Mês Anterior (Previous month)
- **Days/Months**: Portuguese labels

#### Date Handling
- **Input Normalization**: Date-only strings become start 00:00 / end 23:59
- **Output Format**: Always timezone-aware ISO strings
- **Range Clamping**: If range exceeds max, clamp end date

### Integration Points

#### Modal Updates Required
1. **openDashboardPopupReport** (Device Report)
   - Replace two `<input type="date">` with single daterangepicker
   - Update load logic to use `picker.getDates()`

2. **openDashboardPopupAllReport** (All Stores Report)
   - Same replacement pattern
   - Maintain existing validation logic

3. **openDashboardPopupEnergy** (Energy Charts)
   - Replace date inputs for chart period selection
   - Integrate with chart refresh logic

4. **openDashboardPopup** (Settings)
   - Skip for now (no date ranges needed)

#### DateEngine Extensions
```typescript
// Add to src/components/premium-modals/internal/engines/DateEngine.ts
export const clampEndOfDay = (iso: string, tz = 'America/Sao_Paulo') => string;
export const clampStartOfDay = (iso: string, tz = 'America/Sao_Paulo') => string;
```

### Implementation Strategy

#### Phase 1: Core Wrapper (Week 1, Days 1-2)
1. **CDN Loader**: Dynamic script injection with idempotency
2. **Wrapper Implementation**: Complete DateRangePickerJQ namespace
3. **Unit Tests**: Date handling, range validation, cleanup
4. **Demo Page**: Standalone test page

#### Phase 2: Modal Integration (Week 1, Days 3-4)
1. **Device Report Modal**: Replace native inputs
2. **All Report Modal**: Same pattern
3. **Energy Modal**: Chart period integration
4. **Regression Testing**: Ensure existing functionality preserved

#### Phase 3: Styling & Polish (Week 1, Day 5)
1. **Brand Styling**: Apply MyIO tokens to picker popup
2. **Mobile Optimization**: Touch-friendly adjustments
3. **Accessibility**: ARIA labels, keyboard navigation
4. **Documentation**: Usage examples and API docs

### Technical Considerations

#### Bundle Impact
- **CDN Approach**: No bundle size impact (external dependencies)
- **Graceful Loading**: Progressive enhancement if CDNs fail
- **Caching**: Browser caches CDN resources across sessions

#### Browser Compatibility
- **Modern Browsers**: Full functionality
- **Legacy Fallback**: Native inputs if jQuery/moment unavailable
- **Mobile**: Touch-optimized interface

#### Performance
- **Lazy Loading**: Only load when first picker is attached
- **Memory Management**: Proper cleanup on destroy
- **Event Handling**: Efficient event delegation

### Example Usage

```typescript
// In modal implementation
const input = document.createElement('input');
input.className = 'myio-input';
container.appendChild(input);

const picker = MyIOLibrary.DateRangePickerJQ.attach(input, {
  presetStart: params.date?.start,
  presetEnd: params.date?.end,
  maxRangeDays: 31,
  onApply: ({ startISO, endISO }) => {
    // Optional immediate action
    console.log('Date range changed:', startISO, endISO);
  }
});

// When loading data
loadButton.addEventListener('click', () => {
  const { startISO, endISO } = picker.getDates();
  loadData(startISO, endISO);
});

// Cleanup
modal.on('close', () => picker.destroy());
```

### Styling Integration

```css
/* Scoped to modal */
.myio-modal-scope .daterangepicker {
  --picker-primary: var(--myio-brand-700);
  --picker-border: var(--myio-border);
  --picker-bg: var(--myio-card);
}

.myio-modal-scope .daterangepicker .ranges li.active {
  background-color: var(--myio-brand-700);
  color: white;
}
```

## Critical Production Requirements (Must-Fix)

### 🔧 Timezone Correctness
- **Issue**: `toISOString()` returns UTC (Z), loses local offset
- **Fix**: Use `moment.format('YYYY-MM-DD[T]HH:mm:ssZ')` to preserve offset
- **Test**: Verify `-03:00` suffix in São Paulo timezone

### 🔒 CDN Security & Reliability
- **Pin Versions**: Lock exact versions (jQuery 3.7.1, moment 2.29.4)
- **SRI Hashes**: Add Subresource Integrity for security
- **CSP Compliance**: Support strict Content Security Policies
- **Offline Fallback**: Local bundle option for CDN-blocked environments

### ⚡ Loader Robustness
- **Idempotency**: Single loader, queue attach() calls until ready
- **Race Conditions**: Handle slow networks and parallel loads
- **Error Handling**: Graceful degradation to native inputs

### 📏 Range Enforcement
- **UI Clamping**: Prevent selection of >31 days in picker
- **Output Guard**: Final validation in `getDates()`
- **Preset Safety**: Ensure presets respect max range

### ♿ Accessibility
- **Labels**: Explicit `<label for>` or `aria-label="Período"`
- **Screen Reader**: Expose Apply/Cancel labels via locale
- **Keyboard**: Full keyboard navigation support

### 🧹 Memory Management
- **Event Cleanup**: Unbind namespaced events (`.off('.myio')`)
- **Picker Removal**: Call `picker.remove()` on destroy
- **Leak Testing**: Verify stable listeners after 20+ cycles

## Enhanced API Design

### Refined Interface
```typescript
interface AttachOptions {
  presetStart?: string;
  presetEnd?: string;
  maxRangeDays?: number;
  timezone?: string;
  mode?: 'datetime' | 'date';
  presets?: boolean | PresetConfig;
  onApply?: (result: DateRangeResult) => void;
}

interface DateRangeResult {
  startISO: string;      // YYYY-MM-DDTHH:mm:ss-03:00
  endISO: string;        // YYYY-MM-DDTHH:mm:ss-03:00
  startLabel: string;    // DD/MM/YY HH:mm
  endLabel: string;      // DD/MM/YY HH:mm
}
```

### Production CDN Configuration
```typescript
const CDN_RESOURCES = [
  {
    id: 'drp-css',
    href: 'https://cdn.jsdelivr.net/npm/daterangepicker@3.1.0/daterangepicker.css',
    integrity: 'sha384-...',
    css: true
  },
  {
    id: 'jquery',
    src: 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js',
    integrity: 'sha384-...'
  },
  {
    id: 'moment',
    src: 'https://cdn.jsdelivr.net/npm/moment@2.29.4/moment.min.js',
    integrity: 'sha384-...'
  },
  {
    id: 'daterangepicker',
    src: 'https://cdn.jsdelivr.net/npm/daterangepicker@3.1.0/daterangepicker.min.js',
    integrity: 'sha384-...'
  }
];
```

## Acceptance Criteria

### Functional Requirements
- [ ] Same calendar UI across all three modals
- [ ] Time selection with 24-hour format
- [ ] Preset ranges in Portuguese
- [ ] Max range enforcement (31 days default)
- [ ] **Timezone-aware ISO output with offset preservation**
- [ ] Memory leak prevention

### UX Requirements
- [ ] Input shows: `DD/MM/YY HH:mm até DD/MM/YY HH:mm`
- [ ] End date defaults to today 23:59
- [ ] Mobile-friendly touch interface
- [ ] **Keyboard accessible with proper ARIA labels**
- [ ] Screen reader compatible

### Technical Requirements
- [ ] **CDN loading with SRI and fallback**
- [ ] No bundle size impact
- [ ] Backward compatibility
- [ ] Proper TypeScript types
- [ ] **Unit test coverage >90% including timezone/DST tests**

### Security Requirements
- [ ] **Pinned CDN versions with integrity hashes**
- [ ] CSP compliance
- [ ] XSS prevention
- [ ] Offline fallback capability

### Performance Requirements
- [ ] **Idempotent loader with race condition handling**
- [ ] Memory leak prevention
- [ ] Efficient event delegation
- [ ] Lazy loading optimization

## Migration Strategy

### Backward Compatibility
- Existing modal APIs remain unchanged
- Date parameters accept both old and new formats
- Graceful degradation if CDNs unavailable

### Rollout Plan
1. **Alpha**: Internal testing with feature flag
2. **Beta**: Limited production deployment
3. **GA**: Full rollout with legacy removal

### Risk Mitigation
- **CDN Failure**: Fallback to native inputs
- **Performance**: Lazy loading and caching
- **Compatibility**: Progressive enhancement approach

## Future Enhancements

### Phase 2 Features
- **Custom Presets**: Configurable preset ranges
- **Timezone Selection**: User-selectable timezone
- **Recurring Ranges**: Weekly/monthly patterns
- **Comparison Mode**: Side-by-side date ranges

### Integration Opportunities
- **ThingsBoard Widgets**: Reuse in dashboard widgets
- **Admin Panels**: Consistent date selection
- **Report Generators**: Standardized period selection

## Appendix A: CDN Loading Strategy

```typescript
class CDNLoader {
  private static loaded = false;
  
  static async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    
    await Promise.all([
      this.loadScript('https://cdn.jsdelivr.net/jquery/latest/jquery.min.js'),
      this.loadScript('https://cdn.jsdelivr.net/momentjs/latest/moment.min.js')
    ]);
    
    await this.loadScript('https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.min.js');
    await this.loadCSS('https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.css');
    
    this.loaded = true;
  }
}
```

## Appendix B: Locale Configuration

```typescript
const PT_BR_LOCALE = {
  format: 'DD/MM/YY HH:mm',
  applyLabel: 'Aplicar',
  cancelLabel: 'Cancelar',
  fromLabel: 'De',
  toLabel: 'Até',
  customRangeLabel: 'Personalizado',
  daysOfWeek: ['Do','Se','Te','Qa','Qi','Se','Sa'],
  monthNames: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
  firstDay: 1,
  separator: ' até '
};
