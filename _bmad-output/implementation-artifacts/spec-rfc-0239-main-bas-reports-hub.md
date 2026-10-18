---
title: 'RFC-0239 Reports Hub in MAIN_BAS'
type: 'feature'
created: '2026-10-16'
status: 'done'
baseline_commit: '5116fdb78041926c7558c28a45c44b7e0b07443f'
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
- `npx vitest run tests/components/reports-hub.test.ts` — expected: all existing Reports Hub tests pass.
- `npx eslint src/thingsboard/bas-components/MAIN_BAS/controller.js` — expected: no new lint errors.

**Manual checks:**
- Confirm MAIN_BAS sidebar includes the new Hub option and per-device “Relatório” remains available.

## Suggested Review Order

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
