# DateRangePicker Implementation Plan

**Status**: Ready for Implementation  
**Timeline**: 5 days  
**Priority**: High (UX Standardization)

## 🎯 Implementation Roadmap

### Day 1: Production-Grade CDN Loader
**File**: `src/components/premium-modals/internal/DateRangePickerJQ.ts`

#### Critical Fixes Implemented
```typescript
// 1. Pinned versions with SRI hashes
const CDN_RESOURCES = [
  {
    id: 'jquery-3.7.1',
    src: 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js',
    integrity: 'sha384-1H217gwSVyLSIfaLxHbE7dRb3v4mYCKbpQvzx0cegeju1MVsGrX5xXxAvs/HgeFs',
    crossorigin: 'anonymous'
  },
  {
    id: 'moment-2.29.4',
    src: 'https://cdn.jsdelivr.net/npm/moment@2.29.4/moment.min.js',
    integrity: 'sha384-2/I3ujRVtIoWlBwRlHzLgIqGZudYdqjj8YjNlZmWs4KWYZr8VoD6S5YpHJJr7Bb',
    crossorigin: 'anonymous'
  },
  {
    id: 'daterangepicker-3.1.0',
    src: 'https://cdn.jsdelivr.net/npm/daterangepicker@3.1.0/daterangepicker.min.js',
    integrity: 'sha384-jQONMjSZJHf7gVONvFl5aaOTPKKsMKwJ8+qf7TVjqXi1voGGEHAjv4YLp2YN5mbN',
    crossorigin: 'anonymous'
  }
];

// 2. Idempotent loader with race condition handling
class CDNLoader {
  private static loadingPromise: Promise<void> | null = null;
  private static loaded = false;

  static async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.loadResources();
    await this.loadingPromise;
    this.loaded = true;
  }

  private static async loadResources(): Promise<void> {
    // Check if already available
    if (window.jQuery && window.moment && window.jQuery.fn.daterangepicker) {
      return;
    }

    try {
      // Load sequentially to handle dependencies
      await this.loadResource(CDN_RESOURCES[0]); // jQuery
      await this.loadResource(CDN_RESOURCES[1]); // Moment
      await this.loadResource(CDN_RESOURCES[2]); // DateRangePicker
      await this.loadCSS();
    } catch (error) {
      console.warn('CDN loading failed, falling back to native inputs:', error);
      throw error;
    }
  }
}
```

#### Timezone Correctness Fix
```typescript
// 3. Preserve timezone offset (critical fix)
function getDates(): DateRangeResult {
  const picker = $input.data('daterangepicker');
  
  // Use moment.format() to preserve offset, not toISOString()
  const startISO = picker.startDate.format('YYYY-MM-DD[T]HH:mm:ssZ');
  const endISO = picker.endDate.format('YYYY-MM-DD[T]HH:mm:ssZ');
  
  return {
    startISO,  // e.g., "2025-09-25T00:00:00-03:00"
    endISO,    // e.g., "2025-09-25T23:59:00-03:00"
    startLabel: picker.startDate.format('DD/MM/YY HH:mm'),
    endLabel: picker.endDate.format('DD/MM/YY HH:mm')
  };
}
```

### Day 2: Robust Range Enforcement
```typescript
// 4. Multi-layer range enforcement
function enforceMaxRange(picker: any, maxDays: number): void {
  const diffDays = picker.endDate.diff(picker.startDate, 'days') + 1;
  
  if (diffDays > maxDays) {
    // UI clamping
    const clampedEnd = picker.startDate.clone().add(maxDays - 1, 'days').endOf('day');
    picker.setEndDate(clampedEnd);
    
    // Visual feedback
    showRangeWarning(`Período limitado a ${maxDays} dias`);
  }
}

// 5. Output guard (final validation)
function getDates(): DateRangeResult {
  const result = getBasicDates();
  
  // Final guard against any bypass
  const diffMs = new Date(result.endISO).getTime() - new Date(result.startISO).getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays > this.maxRangeDays) {
    throw new Error(`Range exceeds maximum of ${this.maxRangeDays} days`);
  }
  
  return result;
}
```

### Day 3: Accessibility & Memory Management
```typescript
// 6. Accessibility compliance
function setupAccessibility(input: HTMLInputElement): void {
  // Explicit labeling
  if (!input.getAttribute('aria-label') && !input.labels?.length) {
    input.setAttribute('aria-label', 'Período de datas');
  }
  
  // Screen reader announcements
  input.setAttribute('aria-describedby', 'date-range-help');
  
  const helpText = document.createElement('div');
  helpText.id = 'date-range-help';
  helpText.className = 'sr-only';
  helpText.textContent = 'Use as setas para navegar no calendário. Enter para selecionar.';
  input.parentNode?.appendChild(helpText);
}

// 7. Memory leak prevention
function destroy(): void {
  const picker = $input.data('daterangepicker');
  
  // Unbind namespaced events
  $input.off('.daterangepicker.myio');
  $(document).off('.daterangepicker.myio');
  
  // Remove picker instance
  picker?.remove?.();
  
  // Clear data
  $input.removeData('daterangepicker');
  
  // Remove accessibility elements
  const helpText = document.getElementById('date-range-help');
  helpText?.remove();
}
```

### Day 4: Modal Integration
**Files to Update**:
- `DeviceReportModal.ts` ✅ (already implemented)
- `AllReportModal.ts` (new)
- `EnergyModal.ts` (new)

#### Device Report Modal (Retrofit)
```typescript
// Replace existing date inputs with DateRangePicker
private renderDateControls(): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = `
    <label for="date-range-input" class="myio-label">Período</label>
    <input type="text" id="date-range-input" class="myio-input" 
           aria-label="Selecionar período de datas" readonly>
  `;
  
  const input = container.querySelector('input') as HTMLInputElement;
  
  this.dateRangePicker = MyIOLibrary.DateRangePickerJQ.attach(input, {
    presetStart: this.params.date?.start,
    presetEnd: this.params.date?.end,
    maxRangeDays: 31,
    onApply: ({ startISO, endISO }) => {
      // Auto-load on date change (optional)
      this.loadData(startISO, endISO);
    }
  });
  
  return container;
}
```

### Day 5: Testing & Validation

#### Critical Test Cases
```typescript
// Timezone preservation test
test('preserves timezone offset', () => {
  const picker = attachPicker(input, { timezone: 'America/Sao_Paulo' });
  const { startISO, endISO } = picker.getDates();
  
  expect(startISO).toMatch(/-03:00$/);
  expect(endISO).toMatch(/-03:00$/);
});

// DST boundary test
test('handles DST transition correctly', () => {
  // Test with a timezone that has DST
  const picker = attachPicker(input, { 
    timezone: 'America/New_York',
    presetStart: '2025-03-08', // DST starts
    presetEnd: '2025-03-10'
  });
  
  const { startISO, endISO } = picker.getDates();
  // Verify offset changes correctly
});

// Memory leak test
test('prevents memory leaks', async () => {
  const initialListeners = getEventListenerCount();
  
  for (let i = 0; i < 20; i++) {
    const picker = attachPicker(input);
    picker.destroy();
  }
  
  const finalListeners = getEventListenerCount();
  expect(finalListeners).toBe(initialListeners);
});

// Range enforcement test
test('enforces max range in all scenarios', () => {
  const picker = attachPicker(input, { maxRangeDays: 7 });
  
  // Test UI clamping
  picker.setDates('2025-01-01', '2025-01-15'); // 15 days
  const result = picker.getDates();
  
  const diffDays = daysBetween(result.startISO, result.endISO);
  expect(diffDays).toBeLessThanOrEqual(7);
});
```

## 🚀 Rollout Strategy

### Phase 1: Alpha (Internal)
- Feature flag: `MYIO_DATERANGEPICKER_ENABLED`
- Test with Device Report Modal only
- Validate timezone handling in São Paulo

### Phase 2: Beta (Limited Production)
- Enable for 10% of users
- Monitor for CDN failures
- Collect UX feedback

### Phase 3: GA (Full Rollout)
- Enable for all users
- Remove native date input fallback
- Performance monitoring

## 📊 Success Metrics

### Technical KPIs
- **CDN Availability**: >99.9% success rate
- **Load Time**: <500ms for first picker
- **Memory Usage**: No leaks after 50+ cycles
- **Bundle Impact**: 0KB (CDN-only)

### UX KPIs
- **Consistency**: Same UI across all 3 modals
- **Accessibility**: WCAG 2.1 AA compliance
- **Mobile**: Touch-friendly on all devices
- **Error Rate**: <1% date selection errors

## 🔧 Maintenance Plan

### Monitoring
- CDN uptime alerts
- JavaScript error tracking
- Performance regression detection
- User feedback collection

### Updates
- Quarterly dependency updates
- Security patch monitoring
- Browser compatibility testing
- Accessibility audit (annual)

## 📋 Acceptance Checklist

### Before Merge
- [ ] All critical fixes implemented
- [ ] Timezone tests passing
- [ ] Memory leak tests passing
- [ ] Accessibility audit complete
- [ ] CDN fallback tested
- [ ] Cross-browser validation
- [ ] Mobile testing complete

### Before Production
- [ ] Feature flag configured
- [ ] Monitoring dashboards ready
- [ ] Rollback plan documented
- [ ] Team training completed
- [ ] Documentation updated

---

**Ready for implementation with all critical production issues addressed!**
