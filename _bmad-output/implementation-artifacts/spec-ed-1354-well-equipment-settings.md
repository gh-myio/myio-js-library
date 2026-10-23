---
title: 'ED-1354: Configure well equipment bindings'
type: 'feature'
created: '2026-10-23'
status: 'done'
context: []
baseline_commit: 'd10701a9e2a93fe96de5e1513fb601c2cfd3c351'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Well cards can display equipment only after `pumpBindings` is manually provisioned on the well device. The settings modal has no workflow for choosing the pumps and solenoid associated with a well, so dashboard users cannot configure the automation from the card.

**Approach:** Add a SuperAdmin-only well-automation tab to the settings modal for `CISTERNA` and `CISTERNA_ENTRADA` devices. Let an administrator optionally assign one pump to B1, one different pump to B2, and one solenoid, then persist the canonical `pumpBindings` JSON to that well device's `SERVER_SCOPE`.

## Boundaries & Constraints

**Always:** Each well can have zero, one, or two distinct `BOMBA_POCO` devices and zero or one `SOLENOIDE`. The same equipment may be selected on multiple wells. Save ThingsBoard device IDs and the B1/B2/S codes expected by the existing dashboard reader. Retain optional GCDR IDs and user-editable labels when available. Do not change equipment telemetry or dashboard polling behavior.

**Ask First:** Changes to the agreed SuperAdmin-only permission, binding schema, or equipment profile rules.

**Never:** Create or provision devices, modify live dashboards, assign equipment automatically based on names, or save bindings on the pump/solenoid instead of the well.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Configure equipment | Well device and selectable equipment exist | Load existing bindings; allow optional B1/B2/S selection; save JSON in that well's `SERVER_SCOPE` | Show an explicit success or failure result |
| Shared equipment | Equipment is already selected on another well | Keep it available for selection on this well | Do not enforce global uniqueness |
| Invalid selection | Same pump selected for B1 and B2, or wrong device profile | Prevent save and identify the invalid field | Do not persist partial bindings |
| No equipment selected | All selectors are empty | Save an empty binding configuration or clear the existing binding consistently with the dashboard reader | Report API failures; never show a false success |
| Unsupported device or user | Non-well profile or non-SuperAdmin opens settings | Do not expose the configuration tab | Keep existing settings behavior unchanged |

</frozen-after-approval>

## Code Map

- `src/components/premium-modals/settings/SettingsModalView.ts` — tab navigation, profile-aware visibility, and lifecycle for settings sub-tabs.
- `src/components/premium-modals/settings/SettingsController.ts` and `types.ts` — pass well/device context to the tab without changing generic settings persistence.
- `src/components/premium-modals/settings/device-profile/DeviceProfileTab.ts` — prior art for authenticated ThingsBoard reads/writes; do not overload this tab with well bindings.
- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js` — settings entry point already provides the ThingsBoard device ID, profile, token, and customer context.
- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` — consumer and parser for the canonical `pumpBindings` attribute.
- `tests/components/premium-modals/settings/` — add focused tests for selection, serialization, permission/profile visibility, and save failures.

## Tasks & Acceptance

**Execution:**
- [x] Add a focused well-equipment settings tab and authenticated equipment catalog lookup filtered to the current customer and supported profiles; allow optional B1/B2/S selection while permitting reuse across wells.
- [x] Wire the tab into the settings modal only for well profiles and SuperAdmins; load the well's existing `pumpBindings` and save the complete JSON to its `SERVER_SCOPE`, with clear pending/success/error states.
- [x] Add tests for empty/partial/full bindings, shared equipment, duplicate pump selection, unsupported profiles, unauthorized users, and ThingsBoard save failure; run targeted tests and library build.

**Acceptance Criteria:**
- Given a SuperAdmin opens settings on a cisterna, when the automation tab loads, then current B1/B2/S bindings appear and selectable same-customer pumps and solenoids use their supported profiles.
- Given the administrator selects zero, one, or two distinct pumps and optionally a solenoid, when saving succeeds, then the well device's `SERVER_SCOPE` `pumpBindings` reflects exactly those selections using `tbId`, stable slot `code`, label, and available GCDR ID.
- Given an equipment device is bound to another well, when the administrator opens a different well, then that device remains selectable and each well can persist its own binding.
- Given a non-well device or non-SuperAdmin opens settings, when tabs are rendered, then the well-automation tab is absent and existing settings tabs continue to work.
- Given a ThingsBoard read or write fails, when the tab loads or saves, then an actionable error is shown and the UI does not report an unsaved configuration as successful.

## Design Notes

The dashboard reader currently accepts `{ pumps: [{ tbId, gcdrId?, code, label, thresholdW? }], valves: [{ tbId, gcdrId?, code, label }] }`. Keep that shape compatible. The selectors should offer stable B1/B2/S slots while allowing absent equipment; do not store empty selector values as fake devices. Saving the no-equipment state must be implemented consistently with the reader's existing behavior (clear/delete the attribute or preserve an empty canonical JSON only if the reader recognizes it).

## Verification

**Commands:**
- `npm test -- --run tests/components/premium-modals/wellEquipmentSettings.test.ts` — passed (9 tests).
- `npm run build` — passed (bundles and declarations verified).
- `npx eslint src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js` — passed.
- `node --check src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js` and `git diff --check` — passed.

**Manual checks:**
- Open settings from a `CISTERNA` and `CISTERNA_ENTRADA` card as SuperAdmin; verify optional selectors and saved bindings render correctly on reopen.
- Verify non-well cards and non-SuperAdmin sessions do not show the new tab.

## Suggested Review Order

**Entry point and access**

- Settings from the water card carries the current well and customer identity into the modal.
  [`controller.js:3656`](../../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js#L3656)

- Well profile detection and SuperAdmin visibility gate the new configuration surface.
  [`SettingsModalView.ts:96`](../../src/components/premium-modals/settings/SettingsModalView.ts#L96)

- Settings configuration passes the customer scope needed for equipment discovery.
  [`SettingsController.ts:40`](../../src/components/premium-modals/settings/SettingsController.ts#L40)

**Equipment binding and persistence**

- Catalog pagination and profile lookup discover eligible same-customer equipment while bounding failures.
  [`WellEquipmentTab.ts:125`](../../src/components/premium-modals/settings/well-equipment/WellEquipmentTab.ts#L125)

- Slot validation builds stable B1/B2/S bindings and saves the canonical JSON to the well.
  [`WellEquipmentTab.ts:229`](../../src/components/premium-modals/settings/well-equipment/WellEquipmentTab.ts#L229)

- Modal wiring mounts the tab for cisterns and keeps other settings flows unchanged.
  [`SettingsModalView.ts:482`](../../src/components/premium-modals/settings/SettingsModalView.ts#L482)

**Regression coverage**

- Tests cover binding shapes, equipment reuse, stale links, pagination, API failures, and visibility.
  [`wellEquipmentSettings.test.ts:128`](../../tests/components/premium-modals/wellEquipmentSettings.test.ts#L128)
