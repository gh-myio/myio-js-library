# RFC-0153: Draggable and Selectable Device Operational Cards

## Summary
Make `src/components/device-operational-card` draggable and selectable, aligned with the
interaction model used in
`src/thingsboard/main-dashboard-shopping/v-5.2.0/card/template-card-v5.js`.
Extend `src/components/footer` to support `device-operational-card` selections and add a
new premium comparison modal for alarm activity within a date range, inspired by
`src/components/temperature/TemperatureComparisonModal.ts`.

## Motivation
Operational Indicators panels require a consistent card interaction model with the
existing ThingsBoard cards. Drag/selection enables fast multi-select actions and allows
the footer to offer meaningful comparisons for alarms and notifications, similar to the
temperature comparison workflow.

## Guide-level explanation
- Users can click to select a device-operational-card.
- Users can drag to multi-select ranges of cards (same behavior as template-card-v5).
- The footer shows selections from operational cards.
- A new premium comparison modal lets users compare alarm activity over a chosen period.

## Reference-level explanation
### A. Card behavior
- Implement draggable + selectable behaviors in
  `src/components/device-operational-card`.
- Interaction model must mirror `template-card-v5.js` (selection, multi-select,
  selection clearing, and UI feedback).

### B. Footer integration
- Update `src/components/footer` to:
  - Recognize selections originating from device-operational-cards.
  - Expose relevant context in the footer (count, actions, compare entry point).

### C. Alarm comparison modal (premium)
- Create a new modal for alarm comparisons, similar to
  `src/components/temperature/TemperatureComparisonModal.ts`.
- The modal compares alarm activity over a selected time window:
  - Total alarms
  - Open by severity (Critical/High/Medium/Low)
  - Alarm trend
  - Alarms by state
  - Alarms by severity
- Design and behavior should match premium modal patterns used in temperature.

## Rationale and alternatives
- Using the template-card-v5 interaction model avoids a new selection system.
- Alternative: build a dedicated selection model for operational cards, but this
  duplicates existing patterns and risks inconsistent UX.

## Prior art
- `src/thingsboard/main-dashboard-shopping/v-5.2.0/card/template-card-v5.js`
- `src/components/temperature/TemperatureComparisonModal.ts`
- `src/components/footer`

## Drawbacks
- Increased complexity in the card component (drag/selection logic).
- Footer integration must handle multiple card sources cleanly.

## Unresolved questions
- Should selection state be shared across card types or scoped per panel?
- Which alarm data source will drive the comparison modal once API integration is ready?
- Confirm the final list of comparison metrics and their data definitions.

## Out of scope
- Implementing the actual alarm API.
- Styling changes unrelated to selection or modal behaviors.
