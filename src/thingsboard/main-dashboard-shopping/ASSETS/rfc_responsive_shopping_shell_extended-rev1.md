# RFC: Responsive Shell for Shopping Dashboard Widgets

- Feature Name: responsive-shopping-shell
- Start Date: 2025-10-01
- Authors: Codex
- Status: Draft

## Summary
This RFC proposes to refactor the `MAIN_VIEW` widget into a cohesive shell that hosts the menu, header, telemetry panels, and footer within a responsive layout. The existing widgets remain self-contained, and the shell coordinates their state, event, and layout concerns.

## Motivation
- Align the shopping dashboard with a consistent layout across menu, header, telemetry, and footer widgets rather than mixing iframe injection with dashboard states.
- Reuse the responsive sidebar and collapse affordances already hinted at in the CSS while wiring the hamburger button to actual state changes.
- Ensure that global events such as `myio:update-date` propagate reliably across multiple telemetry instances and drive footer selections in a predictable way.
- Provide a written contract for how multiple telemetry widgets (energy groups and water groups) co-exist and how the footer dock aggregates their selections.

## Guide-level Explanation
### Shell Composition
The new shell keeps `#myio-root` as the grid container but promotes a four-region layout: sidebar, header ribbon, scrollable main content, and a fixed footer dock. `MAIN_VIEW/template.html:3` and `MAIN_VIEW/template.html:7` already load ThingsBoard states for the menu and a single content state; the shell will extend this to load additional states for the header and footer while maintaining the responsive CSS defined in `MAIN_VIEW/style.css:1`.

### Sidebar Navigation
The sidebar continues to host the menu widget. The existing controller toggles ThingsBoard state IDs and injects an iframe into `<main>` (`MENU/controller.js:8`). In the refactored shell the sidebar will instead communicate with the host layout via `window.dispatchEvent('myio:menu-toggle')`, letting `MAIN_VIEW/controller.js:57` react through `setMenuCompact`. The hamburger markup exposed in `MENU/template.html:1` will dispatch that toggle instead of being purely decorative.

### Header Filters
The header widget handles date range selection by delegating to `MyIOLibrary.createDateRangePicker` (`HEADER/controller.js:87`) and emits `myio:update-date` (`HEADER/controller.js:202`). The shell will position the header directly above the telemetry stack so every telemetry instance receives the same temporal filters without duplicating pickers.

### Telemetry Panels
Telemetry widgets hydrate their cards with ingestion totals from the Data API, guarded by busy overlays (`TELEMETRY/controller.js:45`) and a global success modal (`TELEMETRY/controller.js:93`). They listen for `myio:update-date` (`TELEMETRY/controller.js:815`) and rebuild their state via `hydrateAndRender` (`TELEMETRY/controller.js:719`). The shell will mount one telemetry state for each device group; each instance subscribes to the same events but filters its datasource list using its ThingsBoard state definition. A tabbed or stacked presentation will be driven by the menu selection so only the active group stays visible.

### Footer Dock
The footer widget injects its markup and styles dynamically (`FOOTER/controller.js:17`) and depends on `MyIOSelectionStore` to stay in sync with drag-and-drop selections (`FOOTER/controller.js:301`). In the new layout the footer remains fixed at the bottom of the viewport, while the shell ensures the main content area avoids overlapping the dock by padding the scroll container.

## Reference-level Explanation
### Existing Widgets
- **Menu**: `scope.changeDashboardState` rewrites `<main>` with an embedded iframe keyed by Base64-encoded state IDs (`MENU/controller.js:8`). The hardcoded ThingsBoard dashboard fallback is declared at `MENU/controller.js:41`. Styling for active versus inactive entries keeps a brand palette (`MENU/style.css:67`).
- **Header**: Tooltip wiring lives in `setupTooltipPremium` (`HEADER/controller.js:12`), and credentials for the API client are resolved from ThingsBoard customer attributes before emitting events and launching reports (`HEADER/controller.js:215`). Template markup provides the date range trigger and action buttons (`HEADER/template.html:1`).
- **Telemetry**: `mustGetDateRange` enforces the presence of ISO dates (`TELEMETRY/controller.js:226`), `buildAuthoritativeItems` collects datasource metadata (`TELEMETRY/controller.js:276`), `fetchApiTotals` queries the ingestion API (`TELEMETRY/controller.js:320`), and `enrichItemsWithTotals` merges API totals into display data (`TELEMETRY/controller.js:344`). Filtering and sorting are handled via `applyFilters` (`TELEMETRY/controller.js:365`) and `renderList` (`TELEMETRY/controller.js:410`), with UI bindings established in `bindHeader` (`TELEMETRY/controller.js:566`) and `bindModal` (`TELEMETRY/controller.js:623`).
- **Footer**: The controller ensures the MyIO script is present (`FOOTER/controller.js:11`) before injecting styles and markup, then mirrors the selection store via `renderDock` (`FOOTER/controller.js:296`). Event listener lifecycle is handled in `bindEvents` and cleaned up during `destroy` (`FOOTER/controller.js:421`).
- **Shell**: `MAIN_VIEW/controller.js:21` normalizes grid sizing, while `setMenuCompact` and the global event registration (`MAIN_VIEW/controller.js:70`) maintain responsive behavior. CSS already defines widths for expanded and compact sidebar modes (`MAIN_VIEW/style.css:125`).

### Proposed Implementation Sketch
1. Replace the iframe injection in the menu by emitting a custom event (for example `myio:dashboard-state`) with the requested state ID so the shell can swap ThingsBoard states without DOM rewrites.
2. Update `MAIN_VIEW/template.html` to host four `tb-dashboard-state` elements: sidebar, header, telemetry stack, and footer. The telemetry stack will wrap multiple states inside a container that listens for the selected menu item.
3. Extend `MAIN_VIEW/controller.js` with a small state machine that listens for menu events, toggles CSS classes for the active telemetry tab, and calls `tbComponent.ctx.setState(controllerState)` to drive ThingsBoard routing.
4. Add explicit padding or CSS grid row sizing so the footer dock does not overlap the telemetry scroll region, leveraging the existing `applySizing` helper (`MAIN_VIEW/controller.js:21`).
5. Attach the hamburger button in the menu to dispatch `myio:menu-toggle`, which already triggers `setMenuCompact` through the registered window listener (`MAIN_VIEW/controller.js:81`).

### Event Flow
- Header emits `myio:update-date` with ISO timestamps; every telemetry instance updates `self.ctx.scope` and hydrates (`HEADER/controller.js:202`, `TELEMETRY/controller.js:805`).
- Menu emits a new `myio:dashboard-state` event with the selected logical state; the shell consumes it, swaps states, and updates active styling instead of letting the menu mutate the DOM directly (`MENU/controller.js:8`).
- Telemetry cards communicate selections to `MyIOSelectionStore`; the footer listens to the store and re-renders chips and totals (`FOOTER/controller.js:301`).

## Drawbacks
- ThingsBoard state transitions triggered from the shell rely on consistent state IDs; any mismatch will surface as empty regions instead of iframe fallbacks.
- Multiple telemetry instances will increase the number of simultaneous API calls when the date range changes, which may require throttling or batching at `hydrateAndRender` (`TELEMETRY/controller.js:719`).
- The footer remains dependent on a global selection store and external script loading; errors during script injection still fall outside the shell's control.

## Rationale and Alternatives
- Reusing ThingsBoard states keeps widget boundaries intact, preventing the menu from maintaining raw iframe markup while still allowing encoded states (`MENU/controller.js:24`).
- Centralizing responsive concerns in the shell leverages the already present CSS tokens (`MAIN_VIEW/style.css:1`) and `ResizeObserver` logic (`MAIN_VIEW/controller.js:86`).
- Alternative approaches such as reimplementing telemetry filtering within a single mega-widget were rejected to preserve decoupled deployments and allow ThingsBoard to manage datasources per widget.

## Unresolved Questions
- Confirm the final set of state IDs for energy and water telemetry groups so the menu can emit semantic identifiers instead of Base64-encoded URLs.
- Decide whether the header should throttle `myio:update-date` emissions when users drag across the date picker.
- Define how alarm and temperature widgets integrate with the shell if they remain ThingsBoard-native rather than custom widgets.

## Future Work
- Introduce a shared utility module to de-duplicate MyIO authentication bootstrap between header and telemetry controllers.
- Add analytics instrumentation to measure menu usage and telemetry refresh times once the shell is in place.
- Document a fallback experience for when the footer script fails to load so selections are still visible in telemetry cards.

## Shopping-Specific Extensions
To align this RFC with the latest shopping dashboard widget practices, we propose the following enhancements:

1. **Integration with Group Totals and Info Cards**  
   Shopping dashboards use groupings (Substation/Entry, Administration & Pumps, Stores, Common Area) with consolidated totals and a fixed **ℹ️ Information card with pie chart**. The shell should provide slots for these blocks.

2. **Global Date Synchronization**  
   All charts and telemetry widgets must synchronize when the date is changed in any header. Updates should cascade to QR, Access, and Sales charts.

3. **Premium Fallbacks and Status Messages**  
   The shell should manage consistent overlays and modals for states like loading, success, error, and premium lock, using existing premium color schemes and countdown reloads.

4. **Selection Events and Drill-Down Navigation**  
   Clicking cards should trigger a global `myio:navigate-to-asset` event, enabling drill-down navigation with `assetId` passed via Base64 in the URL.

5. **Multi-Datasource Grouping**  
   Utilities for merging multiple datasources (e.g., energy + temperature, Wh3 vs Wh4, attributes like `slaveId` / `centralId`) should be provided centrally.

6. **Performance and Caching**  
   The shell must be prepared to consume APIs with transparent backend caching (7-day quasi-static data), reducing redundant API calls.

7. **Extensibility for Alarms and Temperature**  
   Alarms and temperature cards should be integrated into the shell layout, ideally through tabbed views.

8. **Responsive and Mobile Design**  
   - Sidebar becomes a drawer on mobile.
   - Header compresses into a single row.
   - Telemetry cards stack into a single column.
   - Footer expands full-width with horizontal chip scrolling.

9. **Premium Global Filters (Excel-like)**  
   A global filter bar should be available, with text search, include/exclude checkboxes, and sorting, applying consistently across all telemetry cards.

## Appendix A: Observed Behaviors
- The menu currently toggles visual state by mutating `link.enableLink` in-place (`MENU/controller.js:11`), so any shell-driven state swap must keep that property updated for Angular templates.
- Busy overlays set `position: absolute` on the telemetry root (`TELEMETRY/controller.js:45`), meaning the shell must ensure the container retains `position: relative` to avoid visual glitches.
- `MyIOSelectionStore` events are mirrored by the footer using delegated listeners (`FOOTER/controller.js:357`), which enables drag-and-drop from telemetry cards without additional glue code.

