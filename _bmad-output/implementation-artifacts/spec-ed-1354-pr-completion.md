---
title: 'ED-1354: Complete remaining PR acceptance gaps'
type: 'feature'
created: '2026-10-27'
status: 'done'
context: []
baseline_commit: '77d6fd859527ddd984cd77cbd8fc19d489dadf83'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** ED-1354 PR #155 still has code-level acceptance gaps: the shared Sabesp solenoid state is not shown on the Sabesp water card, and automation devices can fall through normal datasource classification into visible groups.

**Approach:** Reuse the cisterns' `pumpBindings` and the existing equipment-history reader to display the deduplicated shared Sabesp solenoid indicator on the main water-entry card, and exclude `BOMBA_POCO`/`SOLENOIDE` from normal water and energy device groups. Keep the existing well-card and modal behavior unchanged.

## Boundaries & Constraints

**Always:** A missing or invalid telemetry sample remains “SEM LEITURA”; valid off/closed samples remain known inactive states. The Sabesp indicator must read the same bound solenoid state as the well cards and update from the existing event/polling path. The showcase and tests must cover the real widget flow without requiring live ThingsBoard changes.

**Ask First:** A schema or UX change to how the Sabesp card is associated with a solenoid, or changes to the agreed 60-second production polling behavior.

**Never:** Provision ThingsBoard devices, change live dashboards, infer equipment from labels, add pump/solenoid devices to datasource aliases, or alter unrelated classification behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shared Sabesp valve | Same solenoid ID is bound by one or more cisternas | One Sabesp-card indicator reflects that solenoid and follows the existing update event | No duplicate indicator for repeated bindings |
| No bound valve or unusable telemetry | No valve binding, missing series, or invalid samples | No false closed state; if a configured indicator is shown, it is unknown/dashed | Keep “SEM LEITURA” semantics |
| Automation device in datasource rows | `deviceProfile` is `BOMBA_POCO` or `SOLENOIDE` | Device is absent from water/energy groups, totals, card lists, and exports | Do not silently classify it as a normal water/energy device |

</frozen-after-approval>

## Code Map

- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` — owns datasource classification, water/energy group construction, bindings, and polling events.
- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js` — renders cards from grouped state and patches well equipment indicators.
- `src/components/cards/main-view/v5.2.0/template-card-v5.js` — renders the equipment indicator strip and routes its click action.
- `showcase/main-view-shopping/index.html` — injects simulated wells and telemetry into the real shopping widgets.
- `tests/components/well-pumps/wellPumpsIntegration.test.ts` and related classification tests — provide focused integration and regression coverage.

## Tasks & Acceptance

**Execution:**
- [x] `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js` — resolve the shared Sabesp solenoid from cisterna bindings, render its indicator on the Sabesp water-entry card, and patch it on existing equipment updates.
- [x] `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` — prevent `BOMBA_POCO` and `SOLENOIDE` rows from entering ordinary water/energy group data, totals, or downstream exports.
- [x] `showcase/main-view-shopping/index.html` and focused tests — exercise shared-solenoid state changes on well and Sabesp cards, unknown telemetry, deduplication, and datasource exclusion.

**Acceptance Criteria:**
- Given a Sabesp entry card and a solenoid bound by the cisterns, when its telemetry changes, then the Sabesp card shows the same open/closed/unknown state as the well cards without a page reload.
- Given repeated bindings to the same solenoid, when indicators are assembled, then the Sabesp card shows it once.
- Given a `BOMBA_POCO` or `SOLENOIDE` row in datasource data, when water or energy groups are built, then it is absent from visible cards, totals, and exports.
- Given no valid solenoid sample, when any associated card renders, then it never reports “closed” as a fabricated default.

## Spec Change Log

## Verification

**Commands:**
- `npm test -- --run tests/components/well-pumps/wellPumpsIntegration.test.ts tests/deviceClassificationProfile.water-temperature.test.ts` — expected: all focused tests pass.
- `npm run build` — expected: bundles and type declarations build successfully.
- `git diff --check` — expected: no whitespace errors.

**Manual checks:**
- In the `main-view-shopping` showcase, toggle simulated S and verify identical Sabesp/well indicator state; remove/disable telemetry and verify unknown styling.

## Suggested Review Order

**Datasource exclusion boundary**

- Automation profiles are filtered before state grouping and downstream card/report use.
  [`MAIN_VIEW:1300`](../../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js#L1300)

- State population applies the filter before summaries and group totals are created.
  [`MAIN_VIEW:5636`](../../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js#L5636)

- The emitted device list is filtered before downstream widgets and exports consume it.
  [`MAIN_VIEW:8916`](../../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js#L8916)

**Sabesp shared-valve resolution**

- The principal water card is resolved only when its profile identifies one unambiguous card.
  [`TELEMETRY:2392`](../../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js#L2392)

- Shared valve indicators come from cisterna bindings and deduplicate by ThingsBoard ID.
  [`TELEMETRY:2412`](../../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js#L2412)

- The Sabesp indicator strip updates on the existing well-equipment event.
  [`TELEMETRY:2489`](../../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js#L2489)

- Clicking the indicator opens the automation modal for a cisterna sharing that valve.
  [`TELEMETRY:3140`](../../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js#L3140)

**Validation and showcase**

- Shared valves require distinct cistern bindings; an unknown history remains unknown.
  [`equipmentState.ts:219`](../../src/components/well-pumps/equipmentState.ts#L219)

- The main-view showcase injects Sabesp, two wells, shared S, and missing-telemetry controls.
  [`index.html:244`](../../showcase/main-view-shopping/index.html#L244)

- Integration tests cover duplicate/local valves, unknown status, and displayed strip behavior.
  [`wellPumpsIntegration.test.ts:50`](../../tests/components/well-pumps/wellPumpsIntegration.test.ts#L50)

- Classification tests verify automation profiles are excluded without filtering adjacent profiles.
  [`water-temperature.test.ts:136`](../../tests/deviceClassificationProfile.water-temperature.test.ts#L136)
