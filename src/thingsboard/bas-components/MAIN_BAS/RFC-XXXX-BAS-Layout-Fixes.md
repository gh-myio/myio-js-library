# RFC-XXXX: BAS Dashboard Layout Fixes (EntityListPanel + CardGridPanel + Empty States + Chart Height)

- **Status:** Draft
- **Author:** Code Assist (implementation), reviewed by Rodrigo
- **Target Release:** Next patch release
- **Last Updated:** 2026-02-08

## Summary

This RFC proposes a set of UI/UX and component-level fixes for the BAS dashboard to eliminate unused vertical space, standardize panel sizing, improve list ordering and label display rules, and ensure all left-side panels render predictable empty states.

Key outcomes:

1. **Layout / sizing fixes**
   - Remove the “dead space” between the top panels (**Ambientes** and **Infraestrutura Hídrica**) and the chart section (**Energia / Água / Temperatura**).
   - Ensure `mountChartPanel` grows to occupy the available remaining height.
   - Ensure left-side panels (Ambientes + Bombas e Motores) render even when they have no data (show empty state instead of leaving a black area).

2. **EntityListPanel improvements**
   - Sort items **ascending** by “display label” (after applying an optional label-cleaning rule).
   - Add an optional regex-based label normalization rule (`excludePartOfLabel`) so items like `(001)-Deck` render as `Deck` while preserving the original label internally.

3. **CardGridPanel sizing and card styling**
   - Make panel/card grid sizing configurable via multipliers/offsets (height/width) to match screen layout constraints.
   - Confirm whether sizing is controlled by the component itself or by the BAS main wrapper (`MAIN_BAS` files), then implement accordingly.

## Motivation

Current issues observed in the dashboard layout:

- The **Ambientes** internal widget panel has an incorrect height, leaving a large unused area below it until the charts section begins.
- The same issue appears in **Infraestrutura Hídrica**, suggesting a shared container/layout constraint rather than isolated CSS.
- The right side shows a **black empty region** when one of the left-side panels does not render (e.g., no data), instead of a “no data” placeholder.
- Under the chart panel (`mountChartPanel`) there remains an unused black stripe; the chart panel should occupy that area.
- In **EntityListPanel**, the list is not sorted as desired and the label should optionally hide prefixes like `(001)-`.

User expectation for list ordering and label display:

- Sort should be ASC:
  - `(001)-Deck`
  - `(002)-Sala do Nobreak`
  - `(003)-Auditório`
  - `(004)-Staff Rio de Janeiro`
  - `(005)-Bombas`
  - `(006)-Água`
  - `(007)-Configuração`
  - `(008)-Integrações`
- Display should strip the prefix:
  - `Deck`
  - `Sala do Nobreak`
  - `Auditório`
  - `Staff Rio de Janeiro`
  - `Bombas`
  - `Água`
  - `Configuração`
  - `Integrações`

## Goals

- Eliminate unnecessary vertical whitespace between top panels and chart section.
- Make chart panel height responsive and fill remaining space.
- Ensure both side panels always mount and show content OR empty state.
- Provide consistent sorting and label trimming in `EntityListPanel` via optional config.
- Provide consistent sizing controls for `MyIOLibrary.CardGridPanel` (and internal card styles) via config and/or MAIN_BAS layout.

## Non-Goals

- Redesigning the visual theme (colors, typography) beyond what is required for spacing and empty states.
- Changing data contracts from backend APIs.
- Implementing new features unrelated to layout (e.g., new filters, search behaviors).

## Current Architecture (Relevant Pieces)

### Left-side panels
- `mountAmbientesPanel` uses: `MyIOLibrary.createDeviceGridV6`
- `mountMotorsPanel` uses: `MyIOLibrary.createDeviceGridV6`
- Both should be visible as columns/panels even without data.

### Top content panels
- **Ambientes** panel component:
  - `src\components\entity-list-panel\EntityListPanel.ts`
- **Infraestrutura Hídrica** panel:
  - uses `MyIOLibrary.CardGridPanel`

### Main BAS wrapper (potential layout owner)
- `src\thingsboard\bas-components\MAIN_BAS\controller.js`
- `src\thingsboard\bas-components\MAIN_BAS\template.html`
- `src\thingsboard\bas-components\MAIN_BAS\styles.css`

### Internal card renderer
- `renderCardComponentV6` receives styling configuration for the inner cards.

## Proposed Design

### 1) Layout: remove dead space and make chart panel fill remaining height

#### Problem
Top panels (Ambientes / Infraestrutura Hídrica) appear to have fixed or incorrectly computed heights, leaving a large gap before the chart tabs. There is also a leftover black stripe below `mountChartPanel`.

#### Proposal
Adopt a single, predictable layout model using **flex** (or CSS grid) where:

- The full screen container is `height: 100%` (or `100vh` depending on embedding constraints).
- The main vertical stack is:
  1. Header/top region (title + top cards/panels)
  2. Chart panel region (fills remaining height)

Concretely:
- Set the root container to `display: flex; flex-direction: column; height: 100%; min-height: 0;`
- Set the chart region wrapper to `flex: 1 1 auto; min-height: 0;`
- Set the top region wrapper to `flex: 0 0 auto;` (no forced extra height)
- Ensure any scrollable areas use `overflow: auto` and also `min-height: 0` to allow flex children to shrink.

**Where to implement**
- First, inspect `MAIN_BAS/template.html` for the outer structure and wrapper classes.
- Implement the flex rules in `MAIN_BAS/styles.css` on the correct container elements.
- If the top panels are inside another flex container, ensure they do not have fixed heights unless explicitly intended.

#### Acceptance Criteria
- No visible large empty gap between the top panels and the chart tabs.
- `mountChartPanel` visually expands to occupy all available remaining vertical space.
- No black stripe is visible beneath the chart panel when screen height increases.

### 2) Left column: always render Ambientes and Bombas e Motores panels with empty state

#### Problem
When there is no data (or the mounting logic returns early), the panel region stays blank/black, making it appear broken.

#### Proposal
Ensure both mount functions always render a container with:
- a title (e.g., **Ambientes**, **Bombas e Motores**)
- a consistent empty-state UI when there are no items:
  - “Sem dados” / “No data” label
  - Optional small helper text: “Verifique filtros / permissões / conexão”

Implementation rules:
- `mountAmbientesPanel`: do not return without rendering; instead call `createDeviceGridV6` with an empty list or mount a fallback DOM template.
- `mountMotorsPanel`: same behavior.
- The empty state should be styled to match the panel and avoid black gaps.

#### Acceptance Criteria
- Both panels are always visible as two columns (or two blocks) in the left area.
- When there is no data, a “Sem dados” message is shown instead of a blank region.
- Layout remains stable (no big black void) regardless of data availability.

### 3) EntityListPanel: ASC ordering + optional regex label normalization

#### Problem
Entity labels currently display with technical prefixes and ordering doesn’t match the desired numeric-then-name scheme.

#### Proposal
Add configuration to `EntityListPanel` to support:
- `sortOrder: "asc" | "desc"` (default `"asc"`)
- `excludePartOfLabel?: string` (regex string)
- `excludePartOfLabelFlags?: string` (optional, default `"g"` or empty)
- `displayNameTransform?: "regex-remove" | "none"` (optional future-proofing; for now just implement regex-remove)

**How it works**
1. Compute `rawLabel` (existing name).
2. Compute `displayLabel`:
   - If `excludePartOfLabel` is provided, run `rawLabel.replace(new RegExp(excludePartOfLabel, flags), "")`
   - Then `.trim()`
3. Use `displayLabel` for:
   - sorting
   - rendering
4. Preserve `rawLabel` for internal entity IDs, selection, and search keys (do not break references).

**Example**
- raw: `(001)-Deck`
- regex: `^\(\d{3}\)-\s*`
- display: `Deck`

#### Sorting definition
- Primary sort key: `displayLabel` (string compare, locale-aware: `pt-BR` recommended)
- Secondary sort key: `rawLabel` (to stabilize ordering if display labels collide)

#### File
- `src\components\entity-list-panel\EntityListPanel.ts`

#### Acceptance Criteria
- The list is sorted ascending after applying label normalization.
- Displayed names no longer show the `(001)-` prefix when configured.
- Without config, behavior remains unchanged (backward compatible).

### 4) CardGridPanel: configurable width/height multipliers and internal card style config

#### Problem
`MyIOLibrary.CardGridPanel` appears to be constrained by external container sizes or fixed CSS. Additionally, inner card styles are controlled via `renderCardComponentV6` config and should remain consistent when sizing changes.

#### Proposal
Introduce sizing controls via configuration (wherever CardGridPanel is initialized), supporting both:
- `heightMultiplier` and/or `heightOffsetPx`
- `widthMultiplier` and/or `widthOffsetPx`

**Decision point**
We must determine where sizing is currently applied:
- If `MAIN_BAS` sets fixed heights on the grid container, modify there.
- If `CardGridPanel` itself uses hardcoded sizing, add optional props/config there.

Suggested config shape:
```ts
type PanelSizingConfig = {
  heightMultiplier?: number;   // default 1.0
  heightOffsetPx?: number;     // default 0
  widthMultiplier?: number;    // default 1.0
  widthOffsetPx?: number;      // default 0
};
```
Then compute:
- `targetHeight = baseHeight * heightMultiplier + heightOffsetPx`
- `targetWidth  = baseWidth  * widthMultiplier  + widthOffsetPx`

**Where to pass config**
- Prefer passing via the panel mount/config object (same style used in other MyIOLibrary components).
- If config is injected from MAIN_BAS, add/extend the config there.

#### Keep card styling stable
Ensure `renderCardComponentV6` still receives its style config (padding, border radius, font sizes) unchanged unless explicitly overwritten by sizing changes.

#### Acceptance Criteria
- Card grids in Infraestrutura Hídrica fit the available region without leaving excess blank space.
- Sizing can be tuned without touching CSS every time (via config multipliers/offsets).
- No regression in card visuals produced by `renderCardComponentV6`.

## Implementation Plan (Plan Mode Checklist)

Code Assist must enter **Plan Mode** and execute the following in order:

1. **Baseline inspection**
   - Open and inspect:
     - `src\thingsboard\bas-components\MAIN_BAS\template.html`
     - `src\thingsboard\bas-components\MAIN_BAS\styles.css`
     - `src\thingsboard\bas-components\MAIN_BAS\controller.js`
   - Identify:
     - the root container that defines total height
     - the wrappers around (a) top panels and (b) chart panel
     - any `height: ...px` or `calc(...)` rules causing dead space
     - any missing `min-height: 0` inside flex containers

2. **Fix the vertical layout**
   - Apply flex-based layout rules in `MAIN_BAS/styles.css`.
   - Ensure `mountChartPanel` container has `flex: 1` and no leftover black stripe remains.

3. **Empty states for left panels**
   - Update `mountAmbientesPanel` and `mountMotorsPanel` so they always render.
   - Add a shared empty-state DOM template (or component option) with a consistent “Sem dados” message.

4. **EntityListPanel changes**
   - Implement:
     - ASC sorting based on `displayLabel`
     - `excludePartOfLabel` optional regex removal
   - Ensure backward compatibility: no config => current behavior.

5. **CardGridPanel sizing controls**
   - Determine if sizing is component-level or MAIN_BAS wrapper-level.
   - Implement sizing config where appropriate.
   - Validate that `renderCardComponentV6` style config is still applied consistently.

6. **Visual regression checks**
   - Validate on multiple screen heights:
     - no dead space below top panels
     - chart fills remaining space
     - left panels render empty state instead of black void

## File-Level Patch Guidance

### A) EntityListPanel.ts

Path:
- `src\components\entity-list-panel\EntityListPanel.ts`

Add (or extend) config:
- `sortOrder?: "asc" | "desc"` default `"asc"`
- `excludePartOfLabel?: string`
- `excludePartOfLabelFlags?: string` default `""` (or `"g"` if preferred)

Pseudo-implementation (illustrative):
```ts
const normalizeLabel = (raw: string) => {
  if (!excludePartOfLabel) return raw;
  const flags = excludePartOfLabelFlags ?? "";
  return raw.replace(new RegExp(excludePartOfLabel, flags), "").trim();
};

const items = entities
  .map(e => ({ ...e, rawLabel: e.label, displayLabel: normalizeLabel(e.label) }))
  .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel, "pt-BR"));
```

### B) MAIN_BAS layout

Paths:
- `src\thingsboard\bas-components\MAIN_BAS\template.html`
- `src\thingsboard\bas-components\MAIN_BAS\styles.css`
- `src\thingsboard\bas-components\MAIN_BAS\controller.js`

Implement flex column for the main area and set the chart panel region to fill remaining height.

Critical CSS reminders for flex layouts:
- Parent: `height: 100%` and `display: flex; flex-direction: column;`
- Children that must shrink: `min-height: 0`
- The “fill” area: `flex: 1 1 auto; min-height: 0`

### C) createDeviceGridV6 mounting logic

Ensure:
- `mountAmbientesPanel` and `mountMotorsPanel` always mount a container.
- When zero items:
  - mount the empty-state markup inside the container.

### D) CardGridPanel sizing + renderCardComponentV6 config

Paths (to confirm):
- Where `MyIOLibrary.CardGridPanel` is created/mounted (likely inside MAIN_BAS controller or a helper)
- If `renderCardComponentV6` is in a shared renderer file, keep it unchanged except where it needs to honor new sizing.

## UX Details: Empty State

Empty state content (suggested):
- Title: “Sem dados”
- Subtext: “Nenhum item disponível para os filtros atuais.”
- Optional: “Tente ajustar o período, ambiente ou permissões.”

Style:
- Centered or left-aligned consistent with existing panel style
- Use subtle opacity (do not look like an error)
- Avoid leaving pure black background gaps

## Backward Compatibility

- If `excludePartOfLabel` is not provided, EntityListPanel behavior remains unchanged.
- Sorting defaults to ASC but if current behavior differs, introduce `sortOrder` default that matches current production behavior **only if required** to avoid breaking existing screens. Prefer ASC if safe and consistent with UX expectations.

## Testing Plan

### Unit / Component tests (if available)
- EntityListPanel:
  - Normalization: `(001)-Deck` -> `Deck` with regex `^\(\d{3}\)-\s*`
  - Sorting: list order matches expected ASC
  - No regex: label unchanged

### Manual QA
- Screen heights: small, medium, large
- Confirm:
  - No large gap between top panels and charts
  - Chart panel fills remaining height (no black stripe)
  - Left panels show empty state when no data
  - Infraestrutura Hídrica card grid fits nicely (no dead space)

## Rollout

- Merge behind a feature flag only if risk is high; otherwise ship as a patch.
- Validate on at least one real dashboard instance with:
  - many Ambientes items
  - empty Ambientes
  - empty Motors
  - mixed data availability

## Alternatives Considered

1. **Hardcoding pixel heights**
   - Rejected: fragile across screen sizes and embeddings.

2. **Only adjusting chart height**
   - Rejected: dead space above charts remains if top panels are incorrectly constrained.

3. **Stripping label prefixes in backend**
   - Rejected: the prefix is still useful for sorting and identification; better as a view-level transform.

## Open Questions

- Where exactly is the height constraint coming from?
  - MAIN_BAS wrapper vs individual component styles
- Does `MyIOLibrary.CardGridPanel` already accept sizing props?
  - If yes, standardize usage from the mount points instead of creating new config.
- Should normalization apply to search/filter behavior in EntityListPanel?
  - Recommendation: search should match both raw and display labels.

---

## Appendix: Desired Example Ordering

Raw labels (stored):
- (001)-Deck
- (002)-Sala do Nobreak
- (003)-Auditório
- (004)-Staff Rio de Janeiro
- (005)-Bombas
- (006)-Água
- (007)-Configuração
- (008)-Integrações

Displayed labels (rendered):
- Deck
- Sala do Nobreak
- Auditório
- Staff Rio de Janeiro
- Bombas
- Água
- Configuração
- Integrações
