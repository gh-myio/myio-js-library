# RFC-0233 — User-Scoped Feature Visibility Map (`restrict_view`)

- **RFC number:** 0233
- **Feature name:** `restrict-view-feature-map`
- **Title:** Per-user, attribute-driven visibility map for macro dashboard features (menu / header / footer), phased and recursive
- **Status:** Draft (for validation)
- **Type:** ThingsBoard widget architecture (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET`) — MAIN_VIEW, MENU, HEADER, FOOTER
- **Author:** (proposed)
- **Created:** 2026-09-18
- **Depends on:** none (additive; degrades to current behavior when the attribute is absent)
- **Numbering note:** RFC-0232 was already spent informally (code comments + 2 commits this session: `3541cde8`, `657a7f05`) on the "Incidentes" tab / interpolation incident badge, before this document existed. No `docs/rfcs/RFC-0232-*.md` file exists, but to avoid a real collision this proposal takes the next free number instead of reusing 0232.

> **This is a design document only.** It fixes the attribute shape, the
> resolution algorithm, and the Phase 1 scope so an implementation PR can be
> reviewed against a stable contract. Phase 1 covers **macro groups only**
> (menu items, the 3 header icon buttons, the footer compare button). Nested,
> per-sub-feature gating (e.g. the 3 toggles inside the alarm notification
> panel) is sketched as a **future phase**, not implemented here.

---

## Summary

Add one optional USER-level `SERVER_SCOPE` attribute, `restrict_view`, holding
a JSON tree that says which macro features of the shopping dashboard a given
logged-in user is allowed to see. When the attribute is **absent** (the
overwhelming majority of users today), nothing changes — the dashboard behaves
exactly as it does now, driven entirely by the existing per-dashboard
(`widgetSettings`) configuration. When the attribute **is present**,
`MAIN_VIEW` — already the single orchestrator that fetches USER `SERVER_SCOPE`
attributes for `SuperAdmin`/`HoldingAdmin` detection — parses it once, holds
the resolved visibility map in shared state, and every other widget
(MENU/HEADER/FOOTER) consults that state to hide the features the JSON marks
as disabled. The shape is a **recursive** tree on purpose, so later phases can
nest arbitrarily deep (a macro group → its own sub-toggles → their own
sub-options) without changing the resolution algorithm or the attribute
format, only the data.

## Motivation

Today, feature visibility on this dashboard is a **dashboard-instance**
concern, not a **user** concern:

- `MAIN_VIEW`'s `domainsEnabled.{energy,water,temperature}` (widget setting,
  `settingsSchema.json`) hides whole content-state `<div>`s for every viewer
  of that dashboard alike (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`,
  the block that sets `div.style.display = 'none'` per domain).
- `enabledReportItems.*` (same file, RFC-0182) hides individual report-picker
  cards for every viewer alike.
- `enableReportButton`, `enableAnnotationsOnboarding`, Freshdesk config, etc. —
  all per-dashboard, not per-user.

The only **per-user** gates that exist today are hard-coded to one specific
role check: "is this email `@myio.com.br`" (`window.MyIOUtils.SuperAdmin`,
computed in `detectSuperAdmin()`), used e.g. to show the "Regras Internas
MyIO" toggle inside the alarm notification panel
(`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/controller.js`,
`isMyioUser`). There is no general mechanism to say "this particular customer
user (not MyIO staff, not the whole customer) should not see the Metas menu
item" or "this particular user's Header should not show the Chamados button"
without shipping a one-off code change per case.

`restrict_view` fills that gap with a single, generic, JSON-shaped switchboard
that operations/support can set per user via the existing ThingsBoard
attribute UI (or API) — no widget redeploy required to flip a feature for one
user.

## Guide-level explanation

### The attribute

- **Entity:** `USER` (the logged-in ThingsBoard user, not the customer).
- **Scope:** `SERVER_SCOPE`.
- **Key:** `restrict_view`.
- **Value:** a JSON object (stored as ThingsBoard normally stores JSON
  attributes — a JSON-encoded string value under that key).

If the attribute does not exist for a user (the default for every user
today), it is **completely ignored** — `MAIN_VIEW` does not even attempt to
apply any restriction, and every macro feature renders exactly as the
dashboard's own `widgetSettings` already say it should.

If the attribute **does** exist, `MAIN_VIEW` becomes the source of truth: it
parses the JSON once, merges it into shared state, and every other widget
that currently makes its own visibility decisions (MENU/HEADER/FOOTER) must
additionally consult that state before rendering.

### Shape (Phase 1)

```jsonc
// restrict_view — USER SERVER_SCOPE attribute value
{
  "menu": {
    "energy": true,
    "water": true,
    "temperature": false,
    "alarms": true,
    "reports": true,
    "goals": false,
    "settings": true
  },
  "header": {
    "alarms": true,
    "annotations": false,
    "tickets": true
  },
  "footer": {
    "compare": true
  }
}
```

A key that is **present and `false`** hides that macro feature for this user.
A key that is **absent** (or the whole `restrict_view` attribute is absent)
means "not restricted" — the feature falls back to whatever the dashboard's
own settings already decide. `restrict_view` can only ever **narrow**
visibility, never widen it: it is applied as an `AND NOT restricted`
intersection on top of the existing `domainsEnabled`/`enableReportButton`/etc.
gates, never a replacement for them. A user cannot use `restrict_view` to see
a domain the dashboard itself has fully disabled.

### Recursive shape (all phases)

Every node in the tree — a macro group, a feature inside it, a feature inside
that — has the same two possible shapes, so the same resolver works at any
depth:

```ts
type FeatureNode =
  | boolean // shorthand: this feature (and everything under it) is simply on/off
  | {
      enabled: boolean;
      // Sub-features, only meaningful when this node itself is a group
      // (e.g. the alarm bell button is a feature AND a group of 3 toggles).
      features?: Record<string, FeatureNode>;
    };

type RestrictView = {
  version?: number; // reserved, unused in Phase 1
  menu?: Record<string, FeatureNode>;
  header?: Record<string, FeatureNode>;
  footer?: Record<string, FeatureNode>;
};
```

This is what makes the design **recursive** per the request: Phase 1 only
ever emits/consumes boolean leaves for `menu.*`/`header.*`/`footer.*`, but a
future phase can turn any one of those leaves into a nested object without
touching the resolver, e.g. (illustrative, **not implemented in Phase 1** —
see [Future possibilities](#future-possibilities)):

```jsonc
{
  "header": {
    "alarms": {
      "enabled": true,
      "features": {
        "panelNotifications": true,
        "offlineAlarms": false,
        "internalRules": true
      }
    }
  }
}
```

### Phase 1 macro-feature inventory

| Group | Feature key | What it hides | Where it lives today |
|---|---|---|---|
| `menu` | `energy` | "⚡ Energia" nav item + its content state | MENU `links[]` entry whose `stateId` maps to `telemetry_content`; MAIN_VIEW's `telemetry_content` div |
| `menu` | `water` | "💧 Água" nav item + its content state | MENU `links[]` → `water_content`; MAIN_VIEW's `water_content` div |
| `menu` | `temperature` | "🌡️ Temperatura" nav item + its content state | MENU `links[]` → `temperature_content`; MAIN_VIEW's `temperature_content` div |
| `menu` | `alarms` | "🔔 Alarmes" nav item + its content state | MENU `links[]` → `alarm_content`; MAIN_VIEW's `alarm_content` div |
| `menu` | `reports` | "📊 Relatórios" nav item (opens the reports picker modal) | MENU `changeDashboardState()`, regex-intercepted on link label (RFC-0181) |
| `menu` | `goals` | "Metas" nav item (opens `GoalsModal`) | MENU `changeDashboardState()`, regex-intercepted on link label |
| `menu` | `settings` | "⚙️ Configurações" button | MENU `addSettingsMenuButton()` (RFC-0108), a DOM node injected into `.menu-footer`, independent of `links[]` |
| `header` | `alarms` | 🔔 alarm-notification bell | HEADER `#tbx-btn-alarm-notif` |
| `header` | `annotations` | ✏️ annotations button | HEADER `#tbx-btn-annotation-notif` |
| `header` | `tickets` | 🎧 Chamados (FreshDesk) button | HEADER `#tbx-btn-ticket-notif` |
| `footer` | `compare` | "Comparar" dock + button | FOOTER `#myioCompare` (and, transitively, the whole `.myio-right` compare dock UX) |

## Reference-level explanation

### Where the attribute is fetched

`MAIN_VIEW`'s `detectSuperAdmin()` already performs the exact HTTP call this
feature needs, for a different key:

```
GET {tbBaseUrl}/api/plugins/telemetry/USER/{userId}/values/attributes/SERVER_SCOPE
```

(`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`,
inside `detectSuperAdmin()`, used today to read `isHolding`/`isUserAdmin` for
`HoldingAdmin` detection.) Phase 1 extends that same already-in-flight fetch
— no new network round-trip — to also look for `restrict_view`:

```js
const truthy = (key) => { /* existing helper in detectSuperAdmin() */ };
const raw = Array.isArray(attrs) ? attrs.find((x) => x.key === 'restrict_view') : null;
let restrictView = null;
if (raw?.value != null) {
  try {
    restrictView = typeof raw.value === 'string' ? JSON.parse(raw.value) : raw.value;
  } catch (e) {
    LogHelper.warn('[MAIN_VIEW] restrict_view: malformed JSON, ignoring (fail-open)', e);
    restrictView = null; // malformed → treated exactly like "attribute absent"
  }
}
```

Malformed JSON **fails open** (treated as if the attribute were absent) —
consistent with the rule that `restrict_view`'s entire job is to narrow, never
to break the dashboard. A parsing failure must never leave a user unable to
use the dashboard at all.

### Resolved state & propagation

`window.MyIOUtils` is the existing global "flags" bag MAIN_VIEW already
populates early for other per-user gates (`SuperAdmin`, `HoldingAdmin`,
`currentUserEmail`, `ticketsEnabled`). Phase 1 adds one more field there:

```js
window.MyIOUtils.featureVisibility = restrictView; // raw parsed tree, or null
```

and a resolver function, exported the same way (`window.MyIOUtils.isFeatureVisible`):

```ts
function isFeatureVisible(path: string[]): boolean {
  const root = window.MyIOUtils?.featureVisibility;
  if (!root) return true; // attribute absent or malformed → never restricted
  let node: any = root;
  for (const segment of path) {
    if (node == null) return true; // path not covered by the tree → not restricted
    if (typeof node === 'boolean') return node; // an ancestor was a bare boolean → inherited
    node = node[segment];
  }
  if (node == null) return true;
  if (typeof node === 'boolean') return node;
  if (typeof node === 'object') return node.enabled !== false;
  return true;
}
```

Usage: `isFeatureVisible(['menu', 'goals'])`,
`isFeatureVisible(['header', 'tickets'])`,
`isFeatureVisible(['footer', 'compare'])` — and, once a future phase nests
deeper, `isFeatureVisible(['header', 'alarms', 'features', 'offlineAlarms'])`
with **no change to this function**.

Following the exact precedent already used for `myio:user-info-ready`
(dispatched at the end of `detectSuperAdmin()`) and for
`_applyPresetupVisibility` (HEADER-visibility gates in TELEMETRY that check
the flag immediately in case it is already known, *and* subscribe to the
event in case it resolves later): MAIN_VIEW dispatches a new
`myio:feature-visibility-ready` event once `featureVisibility` is set, and
every consumer widget does both:

```js
// 1. Check immediately (covers the case where MAIN_VIEW resolved this
//    before the consumer widget's own onInit ran).
applyFeatureVisibility();

// 2. Subscribe for the case where the consumer widget initialized first.
window.addEventListener('myio:feature-visibility-ready', applyFeatureVisibility);
```

This mirrors `_applyPresetupVisibility` in
`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`
verbatim (same two-path pattern, same reason: widget init order across
ThingsBoard's independently-loaded widgets is not guaranteed).

### Per-widget integration (Phase 1) — `controller.js` / `template.html` / `styles.css` / `settingsSchema.json`

| Widget path | `controller.js` | `template.html` | `styles.css` | `settingsSchema.json` |
|---|---|---|---|---|
| `WIDGET/MAIN_VIEW` | **Changed.** Extends the existing `detectSuperAdmin()` USER `SERVER_SCOPE` fetch to also read `restrict_view`; sets `window.MyIOUtils.featureVisibility`; dispatches `myio:feature-visibility-ready`. Also extends the existing `domainsEnabled` div-hiding block (the one already doing `div.style.display = 'none'` per domain) to additionally intersect with `isFeatureVisible(['menu', domainOfState])` for the three domain divs it already owns. | **Unchanged.** MAIN_VIEW's template is the static grid shell (`tb-dashboard-state` slots for menu/header/content/footer) — it owns no feature-specific markup to hide. | **Unchanged.** | **Unchanged.** No new admin-configurable setting — `restrict_view` is a runtime, per-user USER attribute, not a design-time widget setting. |
| `WIDGET/MENU` | **Changed.** Before rendering `links[]`, filter/hide entries whose `DOMAIN_BY_STATE[stateId]` (or, for Relatórios/Metas, the same regex already used in `changeDashboardState()`) maps to a `menu.*` key that `isFeatureVisible` reports as `false`. `addSettingsMenuButton()` gains an `isFeatureVisible(['menu','settings'])` guard before inserting the button into `.menu-footer`. | **Unchanged.** The `*ngFor="let link of links"` loop already only renders what `scope.links` contains — hiding is a controller-side list-filtering concern, not a template concern. | **Possibly changed**, only if hiding is done via a CSS class (`.menu-item--restricted { display: none; }`) instead of not pushing the entry into `scope.links` at all. Either implementation is valid; not filtering at the data level avoids ever having a stale, clickable-but-invisible link. | **Unchanged.** `links[]` stays exactly the admin-configured `content`/`stateId`/`enableLink` triple it is today — Phase 1 does not add a `featureKey` field (see [Unresolved questions](#unresolved-questions)). |
| `WIDGET/HEADER` | **Changed.** Each of the 3 button-visibility blocks (`#tbx-btn-alarm-notif`, `#tbx-btn-annotation-notif`, `#tbx-btn-ticket-notif`) gains an `isFeatureVisible(['header', <key>])` check, applied the same way the existing `ticketsEnabled`/`enableAnnotationsOnboarding` gates already hide/show these same buttons — `restrict_view` is one more `AND` condition alongside them, never a replacement. | **Unchanged.** All 3 buttons already exist in the markup unconditionally, exactly as today (loading-state buttons that controller.js shows/hides) — this is consistent with the existing show/hide-via-controller pattern already used for the Freshdesk/annotations gates. | **Unchanged.** Existing `.is-loading`/hidden-state classes are reused; no new class needed for a hard `display:none`. | **Unchanged.** |
| `WIDGET/FOOTER` | **Changed.** `#myioCompare` (and its parent `.myio-right` dock, since a lone disabled-forever Comparar button with no way to ever enable it is confusing UI) gains an `isFeatureVisible(['footer','compare'])` guard, checked once at init (footer has no other dynamic per-user gate today to mirror, so this is the first one). | **Unchanged.** | **Unchanged.** | **Unchanged.** FOOTER's `settingsSchema.json` is currently `{}` — Phase 1 keeps it that way; this is a per-user runtime concern, not a per-dashboard design-time one. |
| `WIDGET/TELEMETRY`, `WIDGET/TELEMETRY_INFO`, `WIDGET/ALARM` | **Unchanged in Phase 1.** These widgets render the *content* of a macro group (Energia/Água/Temperatura/Alarmes), not the navigation entry point to it. Phase 1 gates access at the two chokepoints that already exist for this purpose — MENU's nav link and MAIN_VIEW's content-state `<div>` — which is sufficient because both are already the dashboard's own mechanism for "domain not available on this dashboard" (`domainsEnabled`). | — | — | — |

### Explicit non-goal for Phase 1: this is UI-layer visibility, not authorization

`restrict_view` decides what a widget **renders**. It does not, by itself,
prevent a determined user from reaching a disabled domain's data by another
path (e.g. a customer with a valid ThingsBoard session could still see raw
telemetry via ThingsBoard's own generic UI, or a GCDR/ingestion API call
crafted by hand). Phase 1 explicitly does not attempt to close those paths —
it is scoped to "hide the button/menu item/state so a user without training
in that feature doesn't stumble into it or get confused it's missing," which
is the stated motivation. If a real access-control boundary is later needed,
it belongs at the API/data layer (GCDR, ingestion), not in this UI map — see
[Unresolved questions](#unresolved-questions).

## Drawbacks

- **Two overlapping gating mechanisms.** After this RFC, "is X visible" for
  the 4 domains has two independent inputs to reason about —
  `widgetSettings.domainsEnabled` (per-dashboard) and `restrict_view`
  (per-user) — instead of one. Every future reader of `MAIN_VIEW`'s
  div-hiding block has to know both exist.
- **Silent misconfiguration risk.** Because the attribute fails open on parse
  errors and ignores unknown keys (by design, for safety), a support agent
  who mistypes a key (e.g. `"golas"` instead of `"goals"`) gets no error
  anywhere — the intended restriction simply doesn't apply. This is the right
  tradeoff (never break the dashboard over a typo) but is worth stating
  plainly as a real, accepted cost.
- **Regex-based menu-item matching stays fragile.** Reusing
  `changeDashboardState()`'s existing `/relat/i`/`/metas/i` label-text
  matching for `menu.reports`/`menu.goals` (rather than introducing a stable
  key) means a dashboard whose admin renames the "Relatórios" link to
  something that doesn't match the regex silently breaks both the existing
  click-interception feature *and* this RFC's gating for that item. This is
  an existing fragility this RFC inherits rather than introduces, but Phase 1
  does not fix it (see [Unresolved questions](#unresolved-questions)).

## Rationale and alternatives

- **USER `SERVER_SCOPE`, not CUSTOMER `SERVER_SCOPE`.** The request is
  explicitly about a specific logged-in user ("o user logado"), not "every
  user of this customer." USER-level also matches the existing precedent
  (`isHolding`/`isUserAdmin` are already read from USER `SERVER_SCOPE` in
  `detectSuperAdmin()`) — no new attribute-storage pattern is introduced.
- **One JSON blob under one key, not one attribute per feature.** A single
  `restrict_view` JSON keeps the write side atomic (one PUT sets the whole
  map) and keeps the read side to the one HTTP call `detectSuperAdmin()`
  already makes, rather than N attribute keys the client would have to know
  to ask for up front. The obvious alternative — `restrict_view_menu_energy`,
  `restrict_view_header_alarms`, etc., as flat boolean attributes — was
  rejected because it cannot express the requested recursive nesting without
  an unbounded, ever-growing flat key namespace.
- **Recursive `boolean | {enabled, features}` node, not a flat dotted-key
  map** (e.g. `{"header.alarms.offlineAlarms": false}`). The recursive-object
  shape was chosen because the resolver is then the *same* function at every
  depth (see the reference-level `isFeatureVisible`), and because it mirrors
  how the features are actually nested in the UI (a button that is itself a
  group of togglable sub-features, per the alarm-bell example in the
  request) rather than requiring a synthetic flattened key scheme.
- **Restriction intersects with, never overrides, existing per-dashboard
  settings.** The alternative — `restrict_view` as an independent, absolute
  source of truth that could re-enable a domain the dashboard itself has
  turned off via `domainsEnabled: false` — was rejected as a privilege
  escalation footgun: a per-user attribute should never be able to grant more
  than the dashboard the user is looking at already allows for everyone.

## Prior art (in this codebase)

- **`domainsEnabled.{energy,water,temperature}`** (MAIN_VIEW `settingsSchema.json` +
  the `div.style.display = 'none'` block in `controller.js`) — the existing,
  direct precedent for "hide a macro domain's content div," at the
  per-dashboard level. Phase 1's div-hiding is a straightforward `AND` on top
  of this exact code path.
- **`enabledReportItems.*`** (RFC-0182, MENU's reports picker) — the existing
  precedent for a JSON-ish, per-item "enabled: boolean" map read from
  `window.MyIOUtils`, rendered as locked (🔒) cards for disabled items. Not
  reused directly (it's per-dashboard, not per-user), but the UX precedent —
  cards/buttons that visibly exist-but-locked vs. fully removed — is worth
  the implementer's attention when deciding, per feature, whether "hidden"
  should mean "gone" or "visible but disabled" (Phase 1 assumes "gone" for
  menu/header/footer per the request's own framing — "estar habilitado ou
  não").
- **`detectSuperAdmin()`'s USER `SERVER_SCOPE` fetch** (MAIN_VIEW) — the exact
  HTTP call and JSON-attribute-parsing pattern this RFC reuses for
  `restrict_view`, including its `truthy()` helper style.
- **`myio:user-info-ready` event + `_applyPresetupVisibility`'s "check
  immediately, also subscribe" pattern** (MAIN_VIEW/TELEMETRY) — the exact
  cross-widget propagation idiom this RFC reuses for
  `myio:feature-visibility-ready`, chosen specifically because ThingsBoard
  widget init order is not guaranteed.
- **`isMyioUser` gate on the "Regras Internas MyIO" toggle** (HEADER,
  alarm-notification panel) — the one existing per-user (well, per-email-
  domain) feature gate in the codebase today, and the closest existing
  analogue to the *future*, nested phase of this RFC (a macro feature — the
  alarm bell — that itself contains an internally-gated sub-feature).

## Unresolved questions

These are the specific points this draft is asking to be validated before
implementation:

1. **Missing-key default.** This draft assumes: an **absent** `restrict_view`
   attribute → nothing restricted; a **present** attribute with a **missing**
   key at some level → that specific feature is also not restricted (only an
   explicit `false` restricts). Confirm this is the intended semantics, as
   opposed to treating a present `restrict_view` as an allow-list where
   anything not explicitly listed is hidden.
2. **State ownership.** This draft proposes `window.MyIOUtils.featureVisibility`
   (mirroring `SuperAdmin`/`HoldingAdmin`, which already live there) rather
   than `window.MyIOOrchestrator` (the larger data/API object, assembled
   later in `onInit`, after credentials). Confirm `MyIOUtils` is the right
   home — it is populated earlier and by the same function this RFC extends.
3. **CUSTOMER-level default on top of USER-level override.** Out of scope for
   Phase 1 per the request ("a fase 1 é macro grupos"), but worth flagging
   now: should a future phase also allow a CUSTOMER `SERVER_SCOPE`
   `restrict_view` that applies to every user of that customer, with a
   USER-level `restrict_view` further narrowing it? This draft's resolver
   already composes cleanly with that (apply CUSTOMER's tree first, then
   intersect with USER's), but it is not built here.
4. **MENU's Relatórios/Metas label-regex matching.** Confirm Phase 1 should
   reuse the existing `/relat/i`/`/metas/i` heuristic (no schema change) for
   gating those two nav items, rather than introducing a stable `featureKey`
   field on `links[]` in `settingsSchema.json` now. This draft recommends
   reusing the heuristic in Phase 1 and revisiting in a later phase, to avoid
   a dashboard-config migration as part of this change.
5. **Naming.** The request's own wording was "retrisct_view" (typo). This
   draft corrects it to `restrict_view` throughout. Confirm the corrected
   spelling is what should actually be typed into ThingsBoard's attribute
   editor going forward.

## Future possibilities

- **Phase 2 — nested sub-features inside an already-gated macro feature.**
  The concrete example from the request: once `header.alarms` exists as a
  boolean leaf (Phase 1), turn it into `{ enabled, features: { panelNotifications,
  offlineAlarms, internalRules } }` and have the alarm-notification panel
  (HEADER `controller.js`, the `.ant-toggle-row` blocks) read those three
  sub-flags to hide individual toggle rows for a given user — no resolver
  change needed, per the recursive design.
- **Phase 2 — the "Regras de Alarmes" footer button inside the alarm panel**
  (`data-action="open-alarm-map"`, opens `openAlarmBundleMapModal`) as a
  fourth nested feature under `header.alarms.features`, demonstrating the
  recursion going one level deeper than the 3 toggles (a feature *inside* a
  feature *inside* a macro group).
- **Phase 3 — CUSTOMER-level `restrict_view` composed with USER-level**, per
  [Unresolved question 3](#unresolved-questions).
- **Phase 4 — fold `enabledReportItems.*` (RFC-0182) into the same tree**
  (e.g. `menu.reports.features.energy_lojas`), retiring the separate
  per-dashboard-setting mechanism in favor of one unified shape — only once
  the per-user vs. per-dashboard scope question in this RFC has settled in
  practice.
- **Phase 5 — a stable `featureKey` on MENU's `links[]` schema**, replacing
  the label-text regex matching this RFC's Phase 1 deliberately avoids
  touching, once there is appetite for the accompanying dashboard-config
  migration.
