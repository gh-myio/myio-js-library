---
title: 'RFC-0239 Reports Hub in MAIN_BAS'
type: 'feature'
created: '2026-10-16'
status: 'done'
baseline_commit: '6466def6156db59611436881545739d2e9f0446b'
context:
  - '{project-root}/docs/rfcs/RFC-0239-Reports-Hub-Library-Component.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** MAIN_BAS has a per-device report action but no way to open the reusable Reports Hub delivered by RFC-0239.

**Approach:** Keep the existing per-device report flow unchanged and add an independent “Relatórios” entry to the MAIN_BAS sidebar. Open the library Hub with a context adapted from MAIN_BAS classified devices and its customer/API credentials.

## Boundaries & Constraints

**Always:** Preserve the existing card-level report action; use the public RFC-0239 library API; map only real ingestion identifiers to report items; close the Hub handle on widget teardown; report missing Hub capability without breaking other menu actions.

**Ask First:** Any change to the existing per-device report behavior or to the library Hub’s public contract.

**Never:** Replace the individual report action; change shared Hub behavior, MAIN_VIEW, report settings schema, or implement alarm-report handlers as part of this integration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open Hub | Sidebar “Relatórios” clicked; library API available | Hub opens with current BAS report groups and theme/customer context | — |
| Library not upgraded | Hub entry clicked; `openReportsHub` unavailable | No crash; existing sidebar and device actions continue working | Log and show a controlled unavailable message |
| Widget teardown | Hub open when `onDestroy` runs | Hub closes and its handle is cleared | Cleanup remains idempotent |

</frozen-after-approval>

## Code Map

- `src/thingsboard/bas-components/MAIN_BAS/controller.js` — mounts sidebar navigation, owns classified BAS device data and customer ingestion credentials, and currently wires the per-device report action.
- `src/components/premium-modals/reports-hub/index.ts` — public exports for `openReportsHub` and the dashboard context adapter.
- `src/components/premium-modals/reports-hub/items.ts` — expected report item identifiers and mapping semantics.
- `src/thingsboard/bas-components/MAIN_BAS/docs/MAIN_BAS_ARCHITECTURE.md` — documents the existing report action and menu wiring.
- `tests/components/reports-hub.test.ts` — existing Hub lifecycle, selection, adapter and rendering coverage.

## Tasks & Acceptance

**Execution:**
- [x] `src/thingsboard/bas-components/MAIN_BAS/controller.js` — add a sidebar Hub entry and route it through RFC-0239 using a MAIN_BAS-backed report context; keep `basOpenDeviceReport` wired to card actions and close the Hub at teardown.
- [x] `src/thingsboard/bas-components/MAIN_BAS/docs/MAIN_BAS_ARCHITECTURE.md` — document the new independent menu entry and retained per-device report action.
- [x] `tests/components/reports-hub.test.ts` — run the existing Hub regression suite; add focused coverage only if the controller integration can be exercised without a ThingsBoard runtime.

**Acceptance Criteria:**
- Given MAIN_BAS is initialized and the Hub API exists, when the user chooses “Relatórios” from the sidebar, then the library Reports Hub opens using MAIN_BAS data and display context.
- Given a device card offers “Relatório”, when the user selects it, then the existing per-device report modal and authentication path remain unchanged.
- Given the library bundle lacks the Hub API, when the sidebar entry is selected, then the user receives a controlled unavailable message and the widget remains usable.
- Given the widget is destroyed while the Hub is open, when teardown completes, then the Hub is closed and no stale handle remains.

## Spec Change Log

## Design Notes

MAIN_BAS stores domain groups under BAS-specific keys (for example, `energy.stores`, `water.hidrometro_entrada` and `temperature.termostato`), while RFC-0239’s default catalog expects report keys such as `lojas`, `entrada`, `area_comum`, `climatizavel` and `nao_climatizavel`. The integration must adapt these names without mutating the classified source objects and must preserve ingestion IDs nested in `rawData`. MAIN_BAS obtains ingestion tokens asynchronously via `buildMyioIngestionAuth`; the Hub’s default adapter reads a synchronous token manager, so integration must honor the Hub’s prepare/open contract rather than pass the ThingsBoard JWT as an ingestion token.

## Verification

**Commands:**
- `npx vitest run tests/components/reports-hub.test.ts tests/utils/reports-hub-items.test.ts` — 56 tests pass locally under Node 20; one additional sidebar-selection test also passes.
- `npm run build:tsup && npm run build:umd && npm run minify:umd` — passes.
- `node --check src/thingsboard/bas-components/MAIN_BAS/controller.js` and `git diff --check` — pass.
- ESLint on the controller reports no errors and retains two pre-existing warnings; TypeScript test files are ignored by the current ESLint configuration.

**Manual checks:**
- Live ThingsBoard QA was not run in this environment. The sidebar active-item behavior is covered by a component test; end-to-end report opening and data matching still require a BAS dashboard session.

## Original Integration Review Order

**Hub entry point**

- The sidebar entry exposes the Hub independently of device-level report actions.
  [`controller.js:4566`](../../src/thingsboard/bas-components/MAIN_BAS/controller.js#L4566)

- Menu routing dispatches the new entry without changing other navigation behavior.
  [`controller.js:4732`](../../src/thingsboard/bas-components/MAIN_BAS/controller.js#L4732)

**Context, preparation and lifecycle**

- BAS groups map to Hub categories without mutating classified source devices.
  [`controller.js:4828`](../../src/thingsboard/bas-components/MAIN_BAS/controller.js#L4828)

- Selection obtains an Ingestion token asynchronously and reuses the library item mapper.
  [`controller.js:4950`](../../src/thingsboard/bas-components/MAIN_BAS/controller.js#L4950)

- Teardown closes the Hub before clearing controller state.
  [`controller.js:6717`](../../src/thingsboard/bas-components/MAIN_BAS/controller.js#L6717)

- Architecture docs describe the separate Hub entry and preserved card action.
  [`MAIN_BAS_ARCHITECTURE.md:487`](../../src/thingsboard/bas-components/MAIN_BAS/docs/MAIN_BAS_ARCHITECTURE.md#L487)

- The existing card action remains routed to the individual report modal.
  [`controller.js:3220`](../../src/thingsboard/bas-components/MAIN_BAS/controller.js#L3220)

## ED-1347 Review Corrections

### Tasks

- [x] `src/thingsboard/bas-components/MAIN_BAS/controller.js` — exclude energy and water entry meters from the combined `todos` report while retaining their individual categories; remove the unreachable energy common-area category; pass validated customer temperature limits as the report valid range; remove duplicate Hub toggle handling and nonexistent visual fallbacks.
- [x] `tests/utils/reports-hub-items.test.ts`, `tests/components/reports-hub.test.ts`, and `tests/components/sidebar-menu-active-item.test.ts` — use domain-specific fixtures and cover the combined-report input, temperature valid-range handling, and sidebar selection behavior.
- [x] `src/thingsboard/bas-components/MAIN_BAS/docs/MAIN_BAS_ARCHITECTURE.md` — document BAS-specific group and temperature-range semantics.
- [x] Capture focused Vitest output and report the results of live BAS QA accurately; live ThingsBoard QA was not available in this environment.

### Acceptance Criteria

- Given energy or water has entry meters and subordinate devices, when the `todos` report is opened, then entry meters are omitted from its items and remain available through their own report category.
- Given MAIN_BAS does not classify energy common-area devices, when the Hub catalog is built, then no empty Energia common-area option is shown.
- Given customer `minTemperature` and `maxTemperature` values are finite and ordered, when a temperature report opens, then those values are sent as `temperatureValidRange`; missing or invalid values leave the library default in effect, and no ideal range is inferred.
- Given the Hub is open, when the user selects Relatórios again, then the Hub library's toggle closes it without a second close mechanism, and the current sidebar selection stays active.
- Given the focused regression tests run, when results are reported, then the exact test outcome and whether live BAS QA was run are stated.

## Suggested Review Order

**BAS report aggregation**

- Keep report groups aligned with actual BAS classification and hide unavailable categories.
  [`controller.js:4828`](../../src/thingsboard/bas-components/MAIN_BAS/controller.js#L4828)

- Exclude entry meters from combined reports while preserving individual entry reports.
  [`controller.js:5050`](../../src/thingsboard/bas-components/MAIN_BAS/controller.js#L5050)

**Temperature context and modal lifecycle**

- Validate customer temperature limits before supplying the report's valid range.
  [`controller.js:4929`](../../src/thingsboard/bas-components/MAIN_BAS/controller.js#L4929)

- Use the library toggle and pass only visual values actually provided by the Hub.
  [`controller.js:5010`](../../src/thingsboard/bas-components/MAIN_BAS/controller.js#L5010)

**Regression coverage and documentation**

- Exercise domain-scoped combined-report fixtures with entry-meter exclusion.
  [`reports-hub-items.test.ts:82`](../../tests/utils/reports-hub-items.test.ts#L82)

- Verify temperature range forwarding and no inferred ideal range.
  [`reports-hub.test.ts:188`](../../tests/components/reports-hub.test.ts#L188)

- Confirm modal navigation does not change the selected page.
  [`sidebar-menu-active-item.test.ts:13`](../../tests/components/sidebar-menu-active-item.test.ts#L13)

- Read the updated BAS category, aggregation, and range semantics.
  [`MAIN_BAS_ARCHITECTURE.md:487`](../../src/thingsboard/bas-components/MAIN_BAS/docs/MAIN_BAS_ARCHITECTURE.md#L487)
