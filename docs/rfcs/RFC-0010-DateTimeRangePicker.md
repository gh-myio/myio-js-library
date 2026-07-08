# RFC-0010: DateTimeRangePicker — MYIO JS Library Component

**Status**: Proposed

**Author**: MYIO Front-End Guild

**Stakeholders**: SIM Widgets team, Head Office dashboards, Library maintainers

**Created**: 2025-09-23

**Tracking**: myio-js-library issue #xxx

## Summary

Introduce a reusable Date Range Picker with Times component to the MYIO JS Library that wraps the widely used Date Range Picker (with time selection). The component will provide a thin, opinionated adapter for ThingsBoard widgets and MYIO apps, exposing a unified API, consistent styles, timezone safety, i18n, and event semantics.

This component replaces the current pair of native `<input type="date">` fields and ad-hoc wiring across widgets (e.g., the Energy main board widget’s header), offering a single control for start and end with times.

## Motivation

Today, our widgets render two separate date inputs, fetch buttons and custom wiring:

*   HTML template uses two `<input type="date">` fields and “Carregar” action in the header toolbar.
*   JS controller manages DatesStore, normalizes values, and wires `#startDate`, `#endDate`, and `#btn-load` handlers for refresh.
*   CSS contains bespoke styles for the date inputs and the “Carregar” button.

Pain points:

*   Inconsistent behavior/timezone alignment between date fields and backend expectations (start/end at 00:00/23:59 with offset).
*   Repeated glue code to synchronize inputs, emit “dates changed”, and trigger reloads.
*   No time selection; users cannot do quick “Last 6h / last 12h” analysis without custom dialogs.
*   Styling duplication and accessibility gaps.

## Guide-level Explanation

### What you’ll build

A new library export:

```typescript
// ESM / TypeScript
import { DateTimeRangePicker } from '@myio/js-library';

const picker = DateTimeRangePicker.attach('#myio-date-range', {
  // required
  onApply: ({ start, end, startIso, endIso, tz }) => { /* load data */ },

  // optional
  start: new Date(),         // initial start (Date | number | ISO string)
  end: new Date(),           // initial end
  withPresets: true,         // show MYIO quick presets
  timePicker: true,          // force time UI (defaults true)
  timePickerIncrement: 15,   // minutes step
  locale: 'pt-BR',           // i18n locale
  timezone: 'America/Sao_Paulo', // tz for ISO rendering (+ offset)
  format: 'DD/MM/YYYY HH:mm',    // visible format
  minDate, maxDate,           // constraints (optional)
  autofocus: false,
});
```

`attach(containerOrInput, options)` mounts the control onto an existing `<input>` or an empty container (it will create an input for you).

Fires `onApply` with normalized values:

*   `start`/`end`: native `Date`
*   `startIso`/`endIso`: ISO strings with tz offset (safe for our APIs)
*   `tz`: resolved IANA timezone

### Example: migrate a ThingsBoard widget header

**Before** (template + controller glue): two date inputs + “Carregar” button (see current widget structure).

**After** (one control + single event):

```html
<!-- template.html -->
<div class="date-range">
  <input id="myio-date-range" type="text" />
  <button class="load-button" id="btn-load"><i class="material-icons">refresh</i> Carregar</button>
</div>
```

```javascript
// controller.js
const picker = MyIOLibrary.DateTimeRangePicker.attach('#myio-date-range', {
  start: moment().startOf('hour').subtract(32, 'hour').toDate(),
  end: moment().startOf('hour').toDate(),
  withPresets: true,
  timezone: self.ctx.timeWindow?.timezone || self.ctx.settings?.timezone || 'America/Sao_Paulo',
  locale: 'pt-BR',
  onApply: ({ startIso, endIso }) => {
    // existing pipeline:
    DatesStore.set({ start: startIso.slice(0,10), end: endIso.slice(0,10) }); // if you still log dates-only
    loadMainBoardData(startIso, endIso); // adapt: now accepts ISO with time
  }
});
$('#btn-load').on('click', () => picker.apply()); // optional, triggers onApply
```

## Notes

*   The component preserves the existing “Carregar” UX (button kept) to avoid breaking habits.
*   `loadMainBoardData` can now accept ISO with times; internally we already convert to offset ISO for chart SDKs and APIs.

## Reference-level Explanation

### Public API

```typescript
type DateLike = Date | number | string;

interface DateTimeRangePickerOptions {
  start?: DateLike;
  end?: DateLike;
  timePicker?: boolean;                // default: true
  timePickerIncrement?: number;        // default: 15
  withPresets?: boolean;               // default: true (MYIO presets)
  locale?: string;                     // default: 'pt-BR'
  format?: string;                     // default: 'DD/MM/YYYY HH:mm'
  timezone?: string;                   // default: 'America/Sao_Paulo'
  minDate?: DateLike;
  maxDate?: DateLike;
  autofocus?: boolean;                 // default: false
  onApply: (payload: {
    start: Date;
    end: Date;
    startIso: string;    // ISO with tz offset, e.g. 2025-09-23T15:00:00-03:00
    endIso: string;
    tz: string;
  }) => void;
}

interface DateTimeRangePicker {
  apply(): void;                   // manually invoke onApply with current selection
  get(): { start: Date; end: Date; startIso: string; endIso: string; tz: string };
  set(start: DateLike, end: DateLike): void;
  destroy(): void;                 // cleanup listeners + DOM artifacts
}

declare const DateTimeRangePicker: {
  attach(containerOrInput: string | HTMLElement, opts: DateTimeRangePickerOptions): DateTimeRangePicker;
};
export { DateTimeRangePicker };
```

### Implementation Notes

*   **Upstream lib**: `daterangepicker` (moment-based). We will:
    *   Include it as a peer dependency to avoid doubling `moment` in host apps.
    *   Provide a lightweight wrapper that:
        *   Normalizes inputs to `Date`.
        *   Renders using configured locale and format.
        *   Converts to ISO with explicit offset using library helper (mirror of `toISOWithOffset`).
        *   Emits consistent `onApply` payload.
*   **Styling**:
    *   Use upstream CSS with minimal MYIO overrides to match our toolbar look-and-feel (align heights with `.date-range` controls already styled).
    *   Namespaced class: `.myio-dtrp` to scope overrides.
*   **Timezone handling**:
    *   Default `America/Sao_Paulo`.
    *   Conversion respects IANA tz for visible formatting and produces offsetted ISO for data fetch (same approach used today by `toISOWithOffset`).
*   **Accessibility**:
    *   The input is focusable and labeled via `aria-label="Período"`; ensure contrast within MYIO theme.
    *   Keyboard navigation: arrow keys within calendar, `Tab` between start/end, and time spinners.
*   **i18n**:
    *   Locales `pt-BR` (default) and `en-US` out of the box; consumers may pass any supported `moment` locale.
*   **Presets** (optional):
    *   “Last 6h”, “Last 12h”, “Today”, “Yesterday”, “Last 7 days”, “Last 30 days”.
    *   Implemented via `daterangepicker` ranges option when `withPresets=true`.

### Packaging

*   ESM + CJS + UMD bundles (consistent with library build).
*   Export path:
    *   ESM: `import { DateTimeRangePicker } from '@myio/js-library'`
    *   UMD: `window.MyIOLibrary.DateTimeRangePicker`

### ThingsBoard integration

The component can be used inline in `widget.template.html` and initialized in `controller.js`’s `onInit` handler (where we already set dates and hook events). This aligns with the current pattern that wires inputs and load actions.

### Drawbacks

*   Adds a peer dependency on `daterangepicker` and `moment`.
*   `Moment` is heavy; however, the control is standards-compliant and widely adopted, with consistent UX. We can explore a `dayjs` adapter later.

### Rationale and Alternatives

Alternatives evaluated:

*   Native `<input type="datetime-local">`: inconsistent browser support/UX; lacks range and presets.
*   Flatpickr / Litepick: good, but less common in our stack and requires additional integration work for ranges with times.

Choosing `daterangepicker` aligns exactly with the requested UI and feature parity.

### Prior Art

Existing date inputs + custom store/events (`DatesStore`, `initializeMainBoardController`, `loadMainBoardData`) establish the event model and ISO conversion we’ll keep.

### Unresolved Questions

*   Should we hide the separate Carregar button and auto-apply on selection? (Default: keep button, optional auto-apply via `autofocus` + `autoApply=true` in a future iteration.)

### Future Work

*   Optional relative quick ranges (“Últimas X horas”) tied to live mode auto-refresh.
*   Replace `Moment` with `dayjs` adapter under a compatibility layer.
*   Add ARIA live region announcing selected range.

## Test Plan

### Unit (Vitest)

*   Parsing & Normalization
    *   Given start/end strings, numbers, and Dates, `get()` returns Dates.
    *   `get().startIso`/`endIso` include explicit timezone offset and match `toISOWithOffset` semantics.
*   Event Emission
    *   `onApply` is called once per `apply()` with correct payload.
    *   Changing selection updates `get()`.
*   Options
    *   `timePickerIncrement`, `locale`, `format` applied to underlying plugin.
    *   `withPresets` renders preset ranges (verify configuration).

### Integration (JSDOM)

*   Attach to existing input
    *   Mount to `#myio-date-range`, simulate user selection, call `apply()`, assert handler calls `loadMainBoardData` with ISO.
*   Attach to container
    *   Mount to `<div id="container">` (no input), ensure input is created and functional.

### CSS Contract

*   Ensure height aligns with `.date-range .load-button` per current toolbar styling.

### Manual Demo

*   Add `/demo/datetime-range-picker.html`:
    *   Include UMD build, `moment`, `daterangepicker` assets.
    *   Show:
        *   Default picker
        *   Presets on/off
        *   Different locales
        *   “Apply” logging payload to console + preview.

### CI

*   Run unit + integration tests in node + jsdom.
*   Lint types.

## Reference Implementation Sketch

```typescript
// src/components/date/DateTimeRangePicker.ts
import moment from 'moment';
import 'daterangepicker'; // peer
import type { DateTimeRangePickerOptions, DateTimeRangePicker } from './types';
import { toISOWithOffset } from '../utils/time'; // reuse our helper (or local copy)

export const DateTimeRangePicker = {
  attach(elOrSel: string | HTMLElement, opts: DateTimeRangePickerOptions): DateTimeRangePicker {
    const el = typeof elOrSel === 'string' ? document.querySelector<HTMLInputElement>(elOrSel)! : (elOrSel as HTMLElement);
    let input: HTMLInputElement;

    if (el instanceof HTMLInputElement) input = el;
    else {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'myio-dtrp';
      el.appendChild(input);
    }

    const tz = opts.timezone || 'America/Sao_Paulo';
    const start = moment(opts.start ?? new Date());
    const end = moment(opts.end ?? new Date());

    const ranges = opts.withPresets ? {
      'Últimas 6h': [moment().subtract(6, 'hour'), moment()],
      'Últimas 12h': [moment().subtract(12, 'hour'), moment()],
      'Hoje': [moment().startOf('day'), moment().endOf('day')],
      'Ontem': [moment().subtract(1,'day').startOf('day'), moment().subtract(1,'day').endOf('day')],
      'Últimos 7 dias': [moment().subtract(6,'day').startOf('day'), moment().endOf('day')],
      'Últimos 30 dias': [moment().subtract(29,'day').startOf('day'), moment().endOf('day')],
    } : undefined;

    // initialize
    // @ts-ignore type from plugin
    $(input).daterangepicker({
      timePicker: opts.timePicker ?? true,
      timePickerIncrement: opts.timePickerIncrement ?? 15,
      autoApply: false,
      startDate: start,
      endDate: end,
      locale: { format: opts.format || 'DD/MM/YYYY HH:mm', applyLabel: 'Aplicar', cancelLabel: 'Cancelar' },
      minDate: opts.minDate ? moment(opts.minDate) : undefined,
      maxDate: opts.maxDate ? moment(opts.maxDate) : undefined,
      ranges
    }, function(startSel: moment.Moment, endSel: moment.Moment) {
      if (!opts.onApply) return;
      const s = startSel.toDate();
      const e = endSel.toDate();
      const startIso = toISOWithOffset(s, false, tz);
      const endIso = toISOWithOffset(e, false, tz);
      opts.onApply({ start: s, end: e, startIso, endIso, tz });
    });

    const api: DateTimeRangePicker = {
      apply() {
        // trigger plugin's callback with current selection
        const drp = (input as any).daterangepicker;
        const s = drp.startDate.toDate();
        const e = drp.endDate.toDate();
        const startIso = toISOWithOffset(s, false, tz);
        const endIso = toISOWithOffset(e, false, tz);
        opts.onApply?.({ start: s, end: e, startIso, endIso, tz });
      },
      get() {
        const drp = (input as any).daterangepicker;
        const s = drp.startDate.toDate();
        const e = drp.endDate.toDate();
        return { start: s, end: e, startIso: toISOWithOffset(s, false, tz), endIso: toISOWithOffset(e, false, tz), tz };
      },
      set(startNew, endNew) {
        const drp = (input as any).daterangepicker;
        drp.setStartDate(moment(startNew));
        drp.setEndDate(moment(endNew));
      },
      destroy() {
        // @ts-ignore
        $(input).data('daterangepicker')?.remove();
      }
    };

    if (opts.autofocus) input.focus();
    return api;
  }
};
```

## Acceptance Criteria

*   **Library export**: `DateTimeRangePicker` is exported in ESM, CJS, and UMD builds.
*   **Functional parity**: Allows selection of range with time; default minute step 15. Emits `onApply` with `{start, end, startIso, endIso, tz}`.
*   **Timezone**: Uses IANA tz (default `America/Sao_Paulo`); ISO outputs include offset (e.g., `-03:00`) matching existing `toISOWithOffset` behavior.
*   **Styling**: Looks consistent beside the current toolbar buttons (`.date-range`, `.load-button`).
*   **Integration**: Works in the Energy main board widget replacing the two `<input type="date">` fields; no regressions in “Carregar” flow.
*   **Accessibility**: Keyboard navigation + ARIA label; no contrast violations with default theme.
*   **Tests**: Unit + jsdom integration tests pass in CI.
*   **Demo**: `/demo/datetime-range-picker.html` showcases presets and `onApply` payload.

## Migration Plan

1.  Add component to library, publish minor version.
2.  Update widgets:
    *   Replace two `<input type="date">` with a single input `#myio-date-range`.
    *   Initialize component in `onInit`, wire `onApply` to existing `loadMainBoardData()` (update function to accept ISO with times).
    *   Keep Carregar button invoking `picker.apply()` to preserve current UX.
    *   Remove redundant CSS for the old date inputs if no longer used (keep shared toolbar styles).

## Security & Performance

*   Component does not handle credentials; it only emits time ranges.
*   `Moment`/`daterangepicker` loaded as peer deps to avoid bundle duplication.
*   Debounce is unnecessary; `onApply` fires explicitly.

## Open Items for Review

*   Confirm whether to auto-apply on close (opt-in in a follow-up).
*   Confirm locale list to include by default (`pt-BR`, `en-US`).

## Appendix: Context Files

*   Current toolbar structure with two date inputs and load button (template).
*   Current dates controller, `DatesStore`, and ISO conversion helpers used across widgets.
*   Current CSS for date inputs and toolbar button to align the new component.
