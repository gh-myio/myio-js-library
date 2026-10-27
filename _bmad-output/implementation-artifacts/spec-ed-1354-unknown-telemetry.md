---
title: 'ED-1354: Preserve unknown well-equipment telemetry'
type: 'bugfix'
created: '2026-10-23'
status: 'in-progress'
context: []
baseline_commit: '61e2e1a044f9b3eb8fb3ee4dd9c2117f5ae2ced3'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The well-equipment refresh converts an empty ThingsBoard telemetry response into an empty interval history. The card, tank modal, and automation modal interpret that history as a known inactive state, so equipment with no readings is shown as off/closed instead of “SEM LEITURA”.

**Approach:** Preserve the distinction between a valid series that indicates inactive state and a missing or unusable series. Keep the latter unknown through the well-equipment data model so every indicator surface renders its existing unknown/dashed state without fabricating state duration or activations.

## Boundaries & Constraints

**Always:** A real numeric zero for pump consumption and a valid `off`/`closed` valve sample remain known inactive states. Missing, empty, or wholly unusable telemetry is unknown. Preserve current behavior for valid active histories, polling, and read-only controls.

**Ask First:** Any change to the stale-reading policy, telemetry keys, sampling window, polling interval, or ThingsBoard/dashboard setup.

**Never:** Provision ThingsBoard devices, modify live dashboards, infer state from equipment labels, or treat missing data as off/closed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No pump samples | Empty/missing `consumption` series | Null history; B indicator and modal show “SEM LEITURA” | No fabricated off state |
| Pump measured at zero | Valid `consumption` sample with value `0` | Known inactive state | No error |
| No valve samples | Empty/missing `state` and `status` series | Null history; S indicator and modal show “SEM LEITURA” | No fabricated closed state |
| Valve reports off | Valid `off`/`closed` sample | Known closed state | No error |
| Malformed-only series | Samples with invalid timestamps/values | Null history | No error-shaped inactive fallback |

</frozen-after-approval>

## Code Map

- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` — fetches equipment series and converts them to histories.
- `src/components/well-pumps/types.ts` — defines pump and valve history nullabilit
- `src/components/well-py.umps/equipmentState.ts` — derives indicator states and modal statistics.
- `src/components/well-pumps/WellPumpsModal.ts` — renders unknown versus known inactive states.
- `tests/components/well-pumps/wellPumps.test.ts` — pure state and modal regression coverage.
- `tests/components/well-pumps/wellPumpsIntegration.test.ts` — indicator integration coverage.

## Tasks & Acceptance

**Execution:**
- [ ] `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` — distinguish unusable/empty series from valid inactive readings before creating equipment histories — preserve unknown state end to end.
- [ ] `src/components/well-pumps/types.ts` and `src/components/well-pumps/equipmentState.ts` — type nullable histories and safely derive indicators/statistics — remove unsound unknown-state assumptions.
- [ ] `tests/components/well-pumps/wellPumps.test.ts` and `tests/components/well-pumps/wellPumpsIntegration.test.ts` — cover empty, malformed, valid-zero, and valid-off telemetry — prevent regressions across modal and indicator surfaces.

**Acceptance Criteria:**
- Given a bound pump or valve with no usable samples, when the equipment data is refreshed, then the card and tank-modal indicators are unknown and the automation modal displays “SEM LEITURA” with dashed styling.
- Given a valid zero-consumption pump sample or an explicit off/closed valve sample, when equipment state is rendered, then it remains known inactive/closed.
- Given active telemetry, when refreshed, then existing state, duration, activation-count, power, and timeline behavior is preserved.

## Design Notes

An empty interval list is still a meaningful known state when valid samples exist and all indicate inactive. The telemetry adapter must therefore produce `null` only when there are no usable samples; the interval conversion must continue to return `[]` for a valid all-inactive history.

## Verification

**Commands:**
- `npm test -- --run tests/components/well-pumps/wellPumps.test.ts tests/components/well-pumps/wellPumpsIntegration.test.ts tests/utils/deviceIcons.test.ts` — expected: all selected tests pass.
- `npm run build` — expected: TypeScript declarations and library bundles build successfully.
