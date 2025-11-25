# RFC-0086: DateTime Picker for Temperature Domain

**Status**: 📋 Proposed
**Created**: 2025-01-25
**Author**: Claude Code
**Priority**: High

## Summary

Adicionar suporte a **DateTime Picker** (data + hora) em 3 locais críticos para o domain `temperature`, onde precisão de hora/minuto é essencial para análise de dados de termostato.

## Problem

### Situação Atual (Limitada):

#### **1. HEADER Widget** ✅
- Usa `MyIOLibrary.createDateRangePicker`
- **Formato**: Date only (YYYY-MM-DD)
- **Adequado para**: Energy, Water
- **Problema**: Temperature precisa de hora/minuto

#### **2. FOOTER Widget** ❌
- Não tem datepicker
- **Problema**: Comparação de cards em temperature domain requer seleção de período com hora

#### **3. DemandModal** ❌
- Usa inputs `datetime-local` nativos
- **Formato**: YYYY-MM-DDTHH:mm
- **Problema**: UX ruim, sem presets, sem máscara

#### **4. Temperature Modal (TELEMETRY)** ❌
- Usa inputs `datetime-local` nativos inline
- **Problema**: Mesmos issues do DemandModal

### O Que Precisa Ser:

```
┌─────────────────────────────────────────────────────────┐
│  📅 DateTime Picker Component                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [📅 01/01/2025 00:00] até [📅 25/01/2025 23:59]      │
│                                                         │
│  Presets:                                               │
│  • Hoje                                                 │
│  • Última hora                                          │
│  • Últimas 6 horas                                      │
│  • Últimas 24 horas                                     │
│  • Esta semana                                          │
│  • Este mês                                             │
│                                                         │
│  [❌ Cancelar]  [✅ Aplicar]                            │
└─────────────────────────────────────────────────────────┘
```

## Design

### Abordagem: Estender `createDateRangePicker`

Ao invés de criar um componente novo, vamos **estender o existente** com opção `includeTime`.

#### Nova API

```typescript
interface CreateDateRangePickerOptions {
  presetStart?: string;           // ISO date or datetime
  presetEnd?: string;             // ISO date or datetime
  maxRangeDays?: number;          // Max range (default: 31)
  parentEl?: HTMLElement;         // Parent for z-index (default: body)
  onApply?: (result: DateRangeResult) => void;
  locale?: 'pt-BR' | 'en-US';     // Locale (default: 'pt-BR')

  // RFC-0086: New option
  includeTime?: boolean;          // Enable time selection (default: false)
  timePrecision?: 'minute' | 'hour'; // Time precision (default: 'minute')
}

interface DateRangeResult {
  startISO: string;     // ISO-8601 datetime "YYYY-MM-DDTHH:mm:ss±HH:mm"
  endISO: string;       // ISO-8601 datetime "YYYY-MM-DDTHH:mm:ss±HH:mm"
  startDate: Date;      // JavaScript Date object
  endDate: Date;        // JavaScript Date object
}
```

#### Time Presets (quando `includeTime: true`)

```typescript
const TIME_PRESETS = {
  'Última hora': { hours: 1 },
  'Últimas 6 horas': { hours: 6 },
  'Últimas 12 horas': { hours: 12 },
  'Últimas 24 horas': { hours: 24 },
  'Hoje': { today: true },
  'Ontem': { yesterday: true },
  'Últimos 7 dias': { days: 7 },
  'Últimos 30 dias': { days: 30 },
  'Este mês': { currentMonth: true }
};
```

### Implementation Locations

#### **1. FOOTER Widget** (NOVO)

**File**: `src/thingsboard/.../WIDGET/FOOTER/controller.js`

```javascript
// Add datetime picker when domain = temperature
if (WIDGET_DOMAIN === 'temperature') {
  const $dateInput = $('#footer-date-range');

  MyIOLibrary.createDateRangePicker($dateInput[0], {
    presetStart: startISO,
    presetEnd: endISO,
    includeTime: true,        // RFC-0086: Enable time selection
    timePrecision: 'minute',
    onApply: function(result) {
      console.log('[FOOTER] DateTime range applied:', result);
      // Update comparison with new datetime range
      updateComparison(result.startISO, result.endISO);
    }
  });
}
```

#### **2. DemandModal** (MODIFICAR)

**File**: `src/components/DemandModal.ts`

**Before** (native datetime-local):
```html
<input type="datetime-local" class="myio-demand-modal-date-start" />
<input type="datetime-local" class="myio-demand-modal-date-end" />
```

**After** (MyIOLibrary DateRangePicker):
```typescript
// In DemandModal initialization
if (readingType === 'temperature') {
  // Use datetime picker for temperature
  const dateInput = overlay.querySelector('.myio-demand-modal-date-range') as HTMLInputElement;

  await MyIOLibrary.createDateRangePicker(dateInput, {
    presetStart: startDate,
    presetEnd: endDate,
    includeTime: true,
    timePrecision: 'minute',
    onApply: (result) => {
      currentStartDate = result.startISO;
      currentEndDate = result.endISO;
      fetchAndRenderChart();
    }
  });
}
```

#### **3. Temperature Modal (TELEMETRY)** (MODIFICAR)

**File**: `src/thingsboard/.../WIDGET/TELEMETRY/controller.js` (lines 1400-1450)

**Before** (native datetime-local):
```html
<input type="datetime-local" id="temp-start-date" />
<input type="datetime-local" id="temp-end-date" />
```

**After** (MyIOLibrary DateRangePicker):
```javascript
// Inside temperature modal creation
const dateRangeInput = document.getElementById('temp-date-range');

MyIOLibrary.createDateRangePicker(dateRangeInput, {
  presetStart: new Date(startTs).toISOString(),
  presetEnd: new Date(endTs).toISOString(),
  includeTime: true,
  timePrecision: 'minute',
  onApply: function(result) {
    // Fetch new temperature data
    fetchNewTemperatureData(result.startISO, result.endISO);
  }
});
```

## Implementation Plan

### Phase 1: Extend `createDateRangePicker` (v0.1.138)

#### 1. Modify `src/components/createDateRangePicker.ts`

**Add Time Selection UI**:
```typescript
// Add time inputs to calendar popup
const timeInputsHTML = options.includeTime ? `
  <div class="daterangepicker-time-section">
    <label>
      Hora início:
      <input type="time" class="daterangepicker-time-start" value="00:00" />
    </label>
    <label>
      Hora fim:
      <input type="time" class="daterangepicker-time-end" value="23:59" />
    </label>
  </div>
` : '';
```

**Update Presets for Time**:
```typescript
function getTimePresets() {
  const now = new Date();
  return {
    'Última hora': {
      start: new Date(now.getTime() - 60 * 60 * 1000),
      end: now
    },
    'Últimas 6 horas': {
      start: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      end: now
    },
    'Últimas 24 horas': {
      start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      end: now
    },
    'Hoje': {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
      end: now
    }
  };
}
```

**Format Output with Time**:
```typescript
function formatResult(startDate: Date, endDate: Date, includeTime: boolean): DateRangeResult {
  if (includeTime) {
    return {
      startISO: startDate.toISOString(),
      endISO: endDate.toISOString(),
      startDate,
      endDate
    };
  } else {
    // Date only (existing behavior)
    return {
      startISO: startDate.toISOString().split('T')[0] + 'T00:00:00-03:00',
      endISO: endDate.toISOString().split('T')[0] + 'T23:59:59-03:00',
      startDate,
      endDate
    };
  }
}
```

### Phase 2: Implement in FOOTER (v0.1.139)

#### Files to Modify:

**1. `FOOTER/template.html`** - Add date range input

```html
<div class="footer-datetime-picker" style="display: none;">
  <label>
    <span class="footer-ico">📅</span>
    <input type="text" id="footer-date-range" placeholder="Selecione o período" readonly />
  </label>
</div>
```

**2. `FOOTER/controller.js`** - Initialize picker

```javascript
// Show datetime picker only for temperature domain
if (WIDGET_DOMAIN === 'temperature') {
  const pickerContainer = document.querySelector('.footer-datetime-picker');
  pickerContainer.style.display = 'block';

  const dateInput = document.getElementById('footer-date-range');

  MyIOLibrary.createDateRangePicker(dateInput, {
    presetStart: startISO,
    presetEnd: endISO,
    includeTime: true,
    timePrecision: 'minute',
    onApply: function(result) {
      console.log('[FOOTER] DateTime applied:', result);

      // Trigger comparison update with new datetime range
      window.dispatchEvent(new CustomEvent('myio:footer-datetime-change', {
        detail: {
          startISO: result.startISO,
          endISO: result.endISO
        }
      }));
    }
  });
}
```

### Phase 3: Integrate in DemandModal (v0.1.140)

#### Modify `src/components/DemandModal.ts`

**1. Replace native datetime inputs with single text input**:

```html
<!-- Before: Two separate datetime-local inputs -->
<input type="datetime-local" class="myio-demand-modal-date-start" />
<span>até</span>
<input type="datetime-local" class="myio-demand-modal-date-end" />

<!-- After: Single text input with DateRangePicker -->
<input type="text" class="myio-demand-modal-date-range" readonly placeholder="Selecione o período" />
```

**2. Initialize DateRangePicker based on readingType**:

```typescript
// Determine if we need time precision
const needsTime = readingType === 'temperature';

if (needsTime) {
  // Use datetime picker
  const dateRangeInput = overlay.querySelector('.myio-demand-modal-date-range') as HTMLInputElement;

  const picker = await createDateRangePicker(dateRangeInput, {
    presetStart: startDate,
    presetEnd: endDate,
    includeTime: true,
    timePrecision: 'minute',
    parentEl: overlay,
    onApply: (result) => {
      currentStartDate = result.startISO;
      currentEndDate = result.endISO;
      updatePeriod();
    }
  });
} else {
  // Use date-only picker (existing behavior)
  const dateRangeInput = overlay.querySelector('.myio-demand-modal-date-range') as HTMLInputElement;

  const picker = await createDateRangePicker(dateRangeInput, {
    presetStart: startDate,
    presetEnd: endDate,
    includeTime: false,
    parentEl: overlay,
    onApply: (result) => {
      currentStartDate = result.startISO;
      currentEndDate = result.endISO;
      updatePeriod();
    }
  });
}
```

### Phase 4: Integrate in Temperature Modal (v0.1.141)

#### Modify `TELEMETRY/controller.js` (lines ~1400-1450)

**Replace native inputs**:

```javascript
// Before
const startInput = document.getElementById('temp-start-date');
const endInput = document.getElementById('temp-end-date');

// After
const dateRangeInput = document.getElementById('temp-date-range');

MyIOLibrary.createDateRangePicker(dateRangeInput, {
  presetStart: new Date(startTs).toISOString(),
  presetEnd: new Date(endTs).toISOString(),
  includeTime: true,
  timePrecision: 'minute',
  onApply: function(result) {
    const newStartTs = new Date(result.startISO).getTime();
    const newEndTs = new Date(result.endISO).getTime();

    // Fetch new data
    fetchNewTemperatureData(newStartTs, newEndTs);
  }
});
```

## Visual Design

### DateTime Picker UI (includeTime: true)

```
┌─────────────────────────────────────────────────────────┐
│  📅 Selecionar Período                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐     │
│  │ Janeiro 2025        │  │ Janeiro 2025        │     │
│  │ DOM SEG TER QUA ... │  │ DOM SEG TER QUA ... │     │
│  │  1   2   3   4  ... │  │ 20  21  22  23  ... │     │
│  │  ...                │  │  ...                │     │
│  └─────────────────────┘  └─────────────────────┘     │
│                                                         │
│  ⏰ Hora início: [00:00]  ⏰ Hora fim: [23:59]         │
│                                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│  Presets rápidos:                                       │
│  ┌────────────────┐  ┌────────────────┐               │
│  │ Última hora    │  │ Últimas 6h     │               │
│  └────────────────┘  └────────────────┘               │
│  ┌────────────────┐  ┌────────────────┐               │
│  │ Últimas 24h    │  │ Hoje           │               │
│  └────────────────┘  └────────────────┘               │
│  ┌────────────────┐  ┌────────────────┐               │
│  │ Últimos 7 dias │  │ Este mês       │               │
│  └────────────────┘  └────────────────┘               │
│                                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│  Selecionado:                                           │
│  📅 01/01/2025 00:00 até 25/01/2025 23:59              │
│                                                         │
│  [❌ Cancelar]              [✅ Aplicar]               │
└─────────────────────────────────────────────────────────┘
```

## Migration Strategy

### Backward Compatibility

**Existing code** using `createDateRangePicker` without `includeTime` option **continues to work** unchanged:

```typescript
// Existing usage (date only) - NO CHANGE REQUIRED
createDateRangePicker(input, {
  presetStart: '2025-01-01',
  presetEnd: '2025-01-25',
  onApply: (result) => { ... }
});
// Returns: startISO = "2025-01-01T00:00:00-03:00"
```

**New usage** with time:

```typescript
// New usage (date + time)
createDateRangePicker(input, {
  presetStart: '2025-01-01T00:00:00-03:00',
  presetEnd: '2025-01-25T23:59:59-03:00',
  includeTime: true,  // NEW OPTION
  onApply: (result) => { ... }
});
// Returns: startISO = "2025-01-01T00:00:00-03:00" (with actual selected time)
```

## Benefits

### Before RFC-0086:
- ❌ FOOTER: No datepicker for temperature comparison
- ❌ DemandModal: Native datetime-local (poor UX)
- ❌ Temperature Modal: Native inputs inline (no presets)
- ❌ Inconsistent UX across widgets/modals

### After RFC-0086:
- ✅ FOOTER: Datetime picker for temperature comparison
- ✅ DemandModal: Rich datetime picker with presets
- ✅ Temperature Modal: Consistent picker UI
- ✅ Unified UX with time presets (última hora, últimas 6h, etc.)
- ✅ Backward compatible (date-only mode preserved)

## Open Questions

1. **Should we support seconds precision?**
   - Current proposal: Minutes only
   - **Decision**: Minutes sufficient for temperature domain

2. **Should we add "Custom" time preset?**
   - Allow user to type exact time
   - **Decision**: Yes, keep time inputs editable

3. **Should we auto-update on preset click?**
   - Or require "Aplicar" button click?
   - **Decision**: Require "Aplicar" for confirmation (avoid accidental changes)

## Testing Checklist

- [ ] DateTime picker opens with time inputs visible
- [ ] Time presets work correctly (última hora, últimas 6h, etc.)
- [ ] Time inputs accept manual entry
- [ ] Selected datetime range displays correctly
- [ ] onApply callback receives correct ISO datetime strings
- [ ] Backward compatibility: date-only mode still works
- [ ] FOOTER widget shows picker for temperature domain
- [ ] DemandModal uses picker for temperature readingType
- [ ] Temperature modal integration works
- [ ] Timezone handling correct (São Paulo -03:00)

## References

- Existing component: `src/components/createDateRangePicker.ts`
- HEADER usage: `HEADER/controller.js` line 136
- DemandModal: `src/components/DemandModal.ts`
- Temperature modal: `TELEMETRY/controller.js` lines 1276-1792
- RFC-0083: Temperature Time Format & Interpolation
- RFC-0085: Temperature Modal Component

## Success Criteria

- [ ] `createDateRangePicker` supports `includeTime` option
- [ ] Time presets implemented and working
- [ ] FOOTER shows datetime picker for temperature domain
- [ ] DemandModal uses datetime picker for temperature
- [ ] Temperature modal uses datetime picker
- [ ] No regression in date-only mode
- [ ] Build succeeds without errors
- [ ] Documentation updated

## Timeline

- **Week 1**: Extend createDateRangePicker with time support
- **Week 2**: Implement in FOOTER widget
- **Week 3**: Integrate in DemandModal + Temperature Modal
- **Week 4**: Testing + refinement
