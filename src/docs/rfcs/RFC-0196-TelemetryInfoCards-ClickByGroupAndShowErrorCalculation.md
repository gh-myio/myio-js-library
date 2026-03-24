# RFC-0196 — TELEMETRY_INFO: Clickable Category Cards, Expandable Device Lists, and Calculation Error Indicators

- **Feature Name:** `telemetry-info-cards-group-filter-and-error-calculation`
- **RFC Number:** 0196
- **Status:** Proposed
- **Date:** 2026-03-24
- **Branch:** `fix/rfc-0152-real-data`
- **Widgets in scope:** `TELEMETRY_INFO`, `MAIN_VIEW`, `TELEMETRY`
  (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/`)

---

## Summary

This RFC introduces three coordinated improvements to the `TELEMETRY_INFO` widget and its
relationship with `MAIN_VIEW` and `TELEMETRY`:

1. **Expandable device lists inside info-card tooltips** — every aggregated group row (Entrada,
   Lojas, sub-categories of Climatização, etc.) gains a `(+)` button that expands an inline list
   of the individual devices contributing to that group, mirroring the pattern already used in the
   "Status dos Dispositivos" panel.

2. **Clickable category cards as cross-widget group filters** — the category cards (Entrada, Lojas,
   Climatização, Elevadores, Esc. Rolantes, Outros Equipamentos) become toggleable selectors that
   broadcast a `myio:group-filter-changed` event. `MAIN_VIEW` and `TELEMETRY` listen and show only
   the devices belonging to active groups.

3. **Calculation error indicators** — when a residual value (Área Comum in energy; Pontos não
   mapeados in water) goes negative, or when Total Consumidores exceeds Entrada, the affected card
   pulses with a subtle red background and displays a premium warning-tooltip explaining the
   imbalance.

---

## Motivation

### Expandable device lists

Operators currently see aggregated consumption figures (e.g. _Chillers — 2 equipamento(s),
138,507 MWh_) but have no way to identify **which specific devices** compose that group without
leaving the dashboard. The "Status dos Dispositivos" panel already uses a `(+)` expand pattern
that users are familiar with. Bringing this pattern to the energy/water info-card tooltips removes
a common source of support requests.

### Clickable group filter

When a technician suspects anomalous readings from a specific category (e.g. Climatização), they
must visually scan the full device grid to locate relevant cards. A one-click group filter that
synchronises `MAIN_VIEW` totals and the `TELEMETRY` card grid would compress a multi-step
investigation into a single interaction, directly on the summary cards they are already viewing.

The filter should be **additive and multi-select by default** (all groups are active), and
toggling a group off should dim its card and hide the corresponding device cards across the grid.
This is intentionally non-destructive — clicking the card again restores the full view.

### Calculation error indicators

The current system silently accepts negative residuals or inverted totals (Entrada < Total
Consumidores) that indicate metering gaps, incorrect device classification, or data pipeline
issues. Without a visual signal these problems go unnoticed until a client report surfaces them.
An in-place animated warning on the affected card, backed by a tooltip explaining the formula,
gives operators an immediate prompt to investigate.

---

## Guide-level explanation

### Expandable device lists

Imagine you are looking at the Informatões de Energia tooltip and you see:

```
📥 Entrada  (+)  |  1  |  554,55 MWh
🏪 Lojas    (+)  |  23 |  228,12 MWh
```

Clicking `(+)` next to **Entrada** expands an inline collapsible list of the one device that
belongs to this group, showing its name and identifier. Clicking `(+)` again collapses the list.
This also applies to sub-category rows inside Climatização (Chillers, Fancoils, Bombas
Hidráulicas) and Outros Equipamentos (Bombas de Incêndio, etc.).

**Área Comum** has no `(+)` button because it is a computed residual — there are no "Área Comum
devices" to list.

### Clickable category cards as group filters

By default all category cards are **active** (full colour). Clicking an active card **deactivates**
it — the card becomes visually dimmed (greyed out) and the device cards belonging to that category
disappear from the `TELEMETRY` grid. The aggregated totals in `MAIN_VIEW` are recalculated to
reflect only the active groups.

Example — start state (all active):

```
📥 Entrada             554,549 MWh
🏪 Lojas               228,115 MWh  (23.5 %)
❄️ Climatização        153,247 MWh  (15.8 %)
🛗 Elevadores            6,309 MWh  ( 0.7 %)
🎢 Esc. Rolantes         9,941 MWh  ( 1.0 %)
⚙️ Outros Equipamentos  17,783 MWh  ( 1.8 %)
🏢 Área Comum          187,280 MWh  (19.3 %)
📊 Total Consumidores  415,395 MWh (100.0 %)
```

After deactivating everything except **Elevadores** and **Climatização**:

```
📥 Entrada             <dimmed — not contributing to current view>
🏪 Lojas               <dimmed>
❄️ Climatização        153,247 MWh  (96.0 %)
🛗 Elevadores            6,309 MWh  ( 4.0 %)
🎢 Esc. Rolantes        <dimmed>
⚙️ Outros Equipamentos  <dimmed>
🏢 Área Comum          <dimmed — tooltip explains residual is only valid when all groups are active>
📊 Total Consumidores  159,556 MWh (100.0 %)
```

The `%` column in `Total Consumidores` always sums to 100 % over the currently active groups.

**Special rules:**

- **Entrada** is not part of the consumer filter set. Its card is informational only and is never
  clickable.
- **Área Comum** is always a computed residual. It has no toggle; its card is shown at full colour
  only when all consumer groups are active. When any group is deactivated, the Área Comum card is
  dimmed and its tooltip displays: _"Área Comum is a residual value and is only valid when all
  groups are active."_
- **Total Consumidores** is never independently clickable. Its state reflects the sum of active
  consumer groups.

### Calculation error indicators

When the underlying data produces a logically impossible balance, the affected card pulses with a
subtle red background animation and displays a ⚠️ warning icon. Hovering (or tapping) the icon
opens a premium tooltip that explains the formula and the detected breach.

**Energy domain:**

| Condition | Affected card | Tooltip message |
|-----------|--------------|-----------------|
| Área Comum < 0 | Área Comum | "Área Comum is negative. Formula: Entrada − (Lojas + Climatização + Elevadores + Esc. Rolantes + Outros) = _\<value\>_. Check device classification or metering data." |
| Total Consumidores > Entrada | Entrada | "Entrada is less than Total Consumidores. Formula: Total Consumidores = Lojas + Climatização + Elevadores + Esc. Rolantes + Outros + Área Comum = _\<value\>_. Verify metering setup." |

**Water domain:**

| Condition | Affected card | Tooltip message |
|-----------|--------------|-----------------|
| Pontos não mapeados < 0 | Pontos não mapeados | "Pontos não mapeados is negative. Formula: Entrada − (Lojas + Banheiros + Área Comum) = _\<value\>_. Check device classification." |
| Total Consumidores > Entrada | Entrada | "Entrada is less than Total Consumidores. Verify metering setup." |

The negative value is **always displayed as-is** (not clamped to zero) so operators can see the
magnitude of the discrepancy.

---

## Reference-level explanation

### 1. Expandable device lists

#### Data source

Each category group in `TELEMETRY_INFO` is already computed from the `STATE` object populated by
`MAIN_VIEW`. The device array for each group is available at render time (e.g.
`STATE.energy.equipments` filtered by `subcategory`). No new data fetch is required.

#### UI contract

- Each group row in the tooltip gains a disclosure widget — a small `+` / `−` button rendered
  inline after the group label.
- Expanding the widget renders a sub-list of devices, each showing: `identifier`, `deviceName`,
  and current period value.
- The expand/collapse state is local to the tooltip instance and is not persisted.
- **Área Comum** does not receive a `+` button (no device list to display).

### 2. Clickable category card filter

#### State model

A new module-level object `window.STATE.groupFilter` is introduced:

```
{
  energy: {
    entrada:              true,   // informational only; ignored by filter dispatch
    lojas:                true,
    climatizacao:         true,
    elevadores:           true,
    escadasRolantes:      true,
    outrosEquipamentos:   true,
    // areaComum: computed — not a filter key
  },
  water: {
    entrada:              true,
    lojas:                true,
    banheiros:            true,
    areaComum:            true,
    // pontosNaoMapeados: computed — not a filter key
  }
}
```

#### Event

When the user toggles a card, `TELEMETRY_INFO` dispatches:

```
window.dispatchEvent(new CustomEvent('myio:group-filter-changed', {
  detail: {
    domain: 'energy' | 'water',
    groupFilter: { /* current full filter snapshot */ }
  }
}));
```

#### MAIN_VIEW listener

`MAIN_VIEW/controller.js` listens for `myio:group-filter-changed` and:
- Recomputes aggregated totals using only the active groups.
- Updates the header KPI cards for the affected domain.

#### TELEMETRY listener

`TELEMETRY/controller.js` listens for `myio:group-filter-changed` and:
- Hides device cards whose `subcategory` maps to an inactive group (CSS `display: none` or
  opacity + pointer-events).
- Active device cards remain fully visible.

#### Área Comum behaviour

Área Comum value is recomputed as:
```
areaComum = entrada − (lojas + climatizacao + elevadores + escadasRolantes + outrosEquipamentos)
```
regardless of which groups are active. If any group is deactivated, the card is **dimmed** and its
info tooltip carries the message described in the Guide-level section above. The numeric value is
**not** shown while any consumer group is inactive, to prevent confusion with a partial residual.

#### Total Consumidores behaviour

```
totalConsumidores = sum(active consumer groups) + (areaComum if all groups active else 0)
```

The percentage column is always relative to `totalConsumidores`, so it sums to 100 % over the
active set.

#### Water domain — new Total Consumidores card

The water domain currently has no "Total Consumidores" card. This RFC adds one:

```
Total Consumidores (m³ or L, matching the current unit setting)
  = Lojas + Banheiros + Área Comum + Pontos não mapeados
```

The same filter and error-indicator logic applies.

### 3. Calculation error indicators

#### Trigger conditions (evaluated after every data update)

| Domain | Residual card | Guard condition |
|--------|--------------|-----------------|
| energy | Área Comum | `areaComum < 0` |
| energy | Entrada | `totalConsumidores > entrada` |
| water  | Pontos não mapeados | `pontosNaoMapeados < 0` |
| water  | Entrada | `totalConsumidores > entrada` |

#### Visual treatment

- The affected card's background animates with a slow pulsing red tint
  (`rgba(220, 38, 38, 0.08)` → `rgba(220, 38, 38, 0.18)`, 2 s ease-in-out loop).
- A ⚠️ icon is appended to the card label area.
- Hovering the ⚠️ icon opens the existing premium tooltip mechanism (same as the ℹ️ tooltip) with
  the formula and the measured values.
- When the condition clears (data update brings the value back to ≥ 0), the animation and icon
  are removed.

#### No clamping

Negative residuals are displayed verbatim. The purpose of the indicator is to surface the
problem, not to hide it.

---

## Drawbacks

- **Cross-widget coupling.** The group-filter feature introduces a new runtime event
  (`myio:group-filter-changed`) that `MAIN_VIEW` and `TELEMETRY` must handle. This increases the
  number of inter-widget contracts to maintain.
- **Partial filter state persistence.** The filter state is in-memory only. A ThingsBoard page
  reload resets all cards to active. If persistence across sessions becomes desirable it would
  require a separate RFC.
- **Área Comum and Pontos não mapeados are not filterable.** This is intentional (they are
  residuals), but it may be non-obvious to users who expect every row to be interactive.

---

## Rationale and alternatives

### Why a window event instead of a shared service?

`MAIN_VIEW`, `TELEMETRY`, and `TELEMETRY_INFO` run as separate ThingsBoard widget iframes. The
existing communication pattern in this codebase is `window.dispatchEvent` with custom events (see
`myio:data-ready`, `myio:filter-applied`). Introducing a new event is consistent with this
pattern and requires no new infrastructure.

### Why not a URL-level filter?

A URL or ThingsBoard state-level filter would affect the data query layer and would require a full
widget reload. The group filter described here is a **presentation filter only** — data is already
loaded and we are controlling visibility. This makes it instantaneous and reversible.

### Alternative: filter in the MENU widget

The `MENU` widget already hosts a filter modal (`FilterModal`). A group filter could be placed
there. This was rejected because the TELEMETRY_INFO cards are the natural affordance — the user
is already looking at the group summaries and clicking there is the most direct path to drilling
down.

---

## Prior art

- **Status dos Dispositivos panel** — already uses the `(+)` expand pattern for device sub-lists.
  This RFC extends the same UX to energy/water info-card tooltips.
- **`myio:filter-applied` event** — the existing MENU filter already broadcasts a domain-filter
  event that `MAIN_VIEW` and `TELEMETRY` handle. The new `myio:group-filter-changed` event follows
  the same contract shape.
- **RFC-0128** — defined the energy equipment subcategorisation rules (Entrada, Lojas,
  Climatização, Elevadores, Esc. Rolantes, Outros, Área Comum) that this RFC relies on.
- **RFC-0002** — defined the water domain card structure (Entrada, Lojas, Banheiros, Área Comum,
  Pontos não mapeados) that this RFC extends.

---

## Unresolved questions

1. **Animation performance.** The pulsing red background uses a CSS keyframe animation. If many
   cards are simultaneously in error state on a lower-powered hardware, this may cause perceptible
   jank. The animation could be disabled by a user preference or reduced to a static indicator.
   To be decided during implementation.

2. **Water "Área Comum" vs energy "Área Comum".** In the energy domain, Área Comum is
   `Entrada − consumer groups`. In water, Área Comum is an explicitly metered category (devices
   classified as `area_comum`), and the residual is **Pontos não mapeados**. The filter and
   error-indicator logic must apply the correct formula per domain. The distinction should be
   encoded in a domain configuration object to avoid hard-coded branches.

3. **Tooltip accessibility.** The `(+)` expand button and the ⚠️ warning icon must be keyboard-
   accessible and announce their state to screen readers. Exact ARIA attributes are out of scope
   for this RFC but must be addressed before shipping.

4. **Water Total Consumidores card placement.** The new card would be the last row in the water
   info panel. The exact position relative to "Pontos não mapeados" needs visual design review.

5. **Behaviour when TELEMETRY widget is not present on the dashboard.** The group-filter event
   should be dispatched regardless; `TELEMETRY` registers its listener lazily and the absence of
   the listener is a no-op. Confirm this is the correct graceful-degradation behaviour.

---

## Future possibilities

- **Persist group filter in ThingsBoard customer attributes** — store the last active filter
  selection so that operators resuming a session see the dashboard in the state they left it.
- **Group filter presets** — allow saving named filter combinations (e.g. "HVAC only") accessible
  from the MENU widget.
- **Drill-down to device detail modal** — clicking an individual device in the expanded `(+)` list
  could open the existing device detail modal directly, reducing navigation steps further.
- **Temperature domain group filter** — the temperature domain has its own card grid; a similar
  group-by-type filter (termostatos por andar, por ala) could follow the same pattern once the
  energy/water implementation is proven.
