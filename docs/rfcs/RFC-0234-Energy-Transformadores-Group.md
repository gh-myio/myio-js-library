# RFC-0234 — Showing Transformers Without Double-Counting (Revised: per-device exclusion, not a new group)

- **RFC number:** 0234
- **Feature name:** `energy-transformer-entrada-exclusion` (originally drafted as `energy-transformadores-group`)
- **Title:** Reuse the existing per-device `excludeGroupsTotals` mechanism so step-down transformers can be shown separately without double-counting into Entrada or Área Comum
- **Status:** Revised draft (post BMAD roundtable review) — for validation
- **Type:** ThingsBoard widget architecture (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET`) + `myio-js-library`'s summary/tooltip pipeline (RFC-0128)
- **Author:** (proposed)
- **Created:** 2026-09-18
- **Revised:** 2026-09-18 (same day — see [BMAD Party Table Discussion](#bmad-party-table-discussion-2026-09-18) for why)
- **Depends on:** RFC-0128 (Energy Equipment Subcategorization — `excludeGroupsTotals`, `ExclusionGroupsTab.ts`)
- **Related, no longer required:** RFC-0109 (Device Type Classification, Upsell Post-Setup Modal) — only relevant if the *optional* labeling profile in [Future possibilities](#future-possibilities) is picked up later.

> **This is a design document only.** It fixes the exact call sites that must
> change, so an implementation PR can be reviewed against a stable contract.

> **Revision note (2026-09-18).** The original draft of this RFC proposed a
> fourth top-level energy classification group (`transformadores`), fed by a
> brand-new `deviceProfile = 'TRANSFORMADOR'`, with its own `resolveGroup`
> rule and its own optional TELEMETRY widget instance. A BMAD roundtable
> review — four agents plus a round of cross-talk, summarized in full in
> [BMAD Party Table Discussion](#bmad-party-table-discussion-2026-09-18) —
> converged on a leaner design that reuses a mechanism that already ships in
> production today: RFC-0128's per-device `excludeGroupsTotals` attribute,
> already wired into the Entrada total, already exposed through an existing
> Settings-modal tab, already respected by the report export pipeline. This
> document has been rewritten around that design. The original "new group"
> design is preserved in full under
> [Rationale and alternatives](#rationale-and-alternatives), together with
> the reasoning for why it was downgraded — it is a legitimate, previously
> load-bearing part of this RFC's history, not deleted.

> **Second review pass (2026-09-18, later the same day) — scope correction.**
> An independent review of this revised draft, verified against the running
> code, found: (a) the Motivation section's stated criterion for "exclude vs.
> don't exclude" (downstream metering presence) was the wrong axis — fixed
> below; (b) the proposed `excludedFromEntrada` snippet had no error handling
> and silently dropped `getValorEfetivo`'s own legacy exclusion format — fixed
> below by extracting a single shared predicate both code paths call; (c) two
> claims in this document were either overstated (the original group design
> "could not" express per-device decisions — it could, via profile
> assignment, just at a higher blast-radius cost) or simply wrong (a claimed
> device-status-aggregation gap that does not actually exist in the code);
> and, most importantly, (d) **this revision does not deliver the dedicated
> "Transformadores" widget/column the original request explicitly asked
> for** — it delivers correct totals and tooltip transparency, which is a
> real subset of the original ask, not the whole of it. All four points are
> corrected in place below, and (d) is called out explicitly wherever it's
> relevant rather than left implicit in a "Future possibilities" bullet.

---

## Summary

A shopping can have step-down transformers (today profiled `TRAFO`,
classified `entrada` by `resolveGroup`) that feed equipment already metered
separately under `Área Comum` — a chiller plant, for instance. Counting that
transformer's own reading *and* the chillers it feeds is a double-count.

This RFC's recommendation is to **not** introduce a new top-level
classification group for this. Instead, reuse a mechanism that already
ships in production: `excludeGroupsTotals`, a per-device `SERVER_SCOPE`
attribute (RFC-0128) already read by `buildSummary`'s `entrada`/`lojas`/
`area_comum` totals, already exposed to operators through the Settings
modal's **"Exclusão de Grupos de Cálculo"** tab (`ExclusionGroupsTab.ts` —
whose own `Entrada` row is already labeled *"Subestações, Transformadores,
RELOGIO"*), and already respected by `AllReportModal`'s export pipeline
(RFC-0128's own comment: *"keeps report total == card total"*).

An operator checks **Entrada** for the specific transformer device whose
downstream load is already metered elsewhere. Its value stops contributing
to `entradaTotal`. Its own TELEMETRY card keeps rendering — with the
"excluded" visual marker `template-card-v5.js` already draws for this
attribute. The one genuinely new piece of work this RFC asks for is an
Entrada-tooltip notice listing which devices were excluded and their
consumption, mirroring a notice `TELEMETRY_INFO` already renders for a
*different* per-device exclusion (`buildExcludedFromCAGNotice`).

No new `deviceProfile`. No new classification group. No migration gap:
because this is a per-device attribute set through an existing UI (not a
profile-JSON rule needing to propagate through a DEFAULT-seed merge — see
[Rationale and alternatives](#rationale-and-alternatives) for why that gap
was real for the original design), it works for **every existing customer
today**, the moment an operator flips the checkbox for the right device.

**Scope boundary, stated plainly:** this design fixes the *math* (Entrada's
total is no longer double-counted) and the *transparency* (the tooltip
shows which devices were excluded and their reading). It does **not**
deliver the dedicated, standalone **"Transformadores" TELEMETRY widget**
the original request explicitly asked for — *"nesse widget vai renderizar
os devices nessa regra."* A transformer excluded from Entrada's total still
lives inside the Entrada card's own device list (visually marked, per
[Reference-level explanation](#reference-level-explanation)), not on its own
dedicated card. Whether that gap matters — whether the tooltip notice is a
sufficient substitute for a standalone widget, or whether the widget is
still a hard requirement layered on top of this exclusion mechanism — is an
open product decision, not a technical one; see
[Unresolved questions](#unresolved-questions) #1.

## Motivation

The concrete topology driving this request:

```
Subestação Principal (ENTRADA)
        │
        ├── Trafo A (steps down for a chiller plant)
        │       └── Chiller 1, Chiller 2, … (already metered under Área Comum → Climatização)
        └── Trafo B (steps down for another chiller plant)
                └── Chiller 3, Chiller 4, …
```

If a transformer like this is classified `entrada` (today's behavior — `TRAFO`
is one of the exact-match `deviceProfiles` in the `entrada` group rule), its
consumption lands in the Entrada total alongside the main substation meter's
own reading. If it were instead routed into `areacomum` (e.g. by
mislabeling it, or by a future rule change), its consumption would be
counted **twice** in the same dashboard: once directly (as the transformer's
own reading) and once again through the chillers it feeds, which are already
separately metered and already land in `Área Comum → Climatização`. The
request is explicit about avoiding exactly this: *"se eu colocar esses
trafos na área comum, duplicaria o consumo da própria coluna."*

**A caveat this RFC should not paper over:** classifying the transformer as
`entrada` is *compatible* with today's behavior, not a proof of *electrical
correctness*. If a customer's Entrada bucket contains both the main
substation meter (`ENTRADA`/`SUBESTACAO`) and its own downstream step-down
transformers as separate, simultaneously-reporting devices, summing all of
them into one `entradaTotal` already double-counts within Entrada itself —
the substation's own reading already includes the power later re-measured at
each transformer. This is exactly the scenario `excludeGroupsTotals` exists
to correct on a per-device basis: the operator excludes the specific
transformer(s) whose reading is redundant with a measurement already
captured upstream or downstream, leaving the substation's own meter (and any
transformer that is *not* redundant) contributing normally.

**Why this must be decided per device, not per group or per profile — and
the correct test for "exclude or not."** The right question is never *"does
this transformer's downstream have its own meter?"* — it is *"is this
device's reading already counted by another device inside the same total?"*
Two independent conditions can each, alone, make the answer yes:

1. **Upstream redundancy, inside Entrada itself.** If a customer's Entrada
   bucket contains both a substation-level meter and this transformer's own
   submeter, the substation reading *already includes* everything that
   passes through the transformer — summing both is a double-count within
   Entrada, regardless of what the transformer feeds downstream, metered or
   not. This is the scenario the caveat above describes.
2. **Cross-group redundancy.** If the transformer's downstream load is
   already separately metered under `Área Comum` (a chiller plant), its
   reading is redundant with those meters — this is the customer's original
   scenario.

A shopping can have more than one independent transformer cluster, and
these two conditions do not hold uniformly across all of them. One
transformer might feed an already-metered chiller plant *and* sit below a
substation meter that already counts it — exclude it, for either reason. A
*different* transformer, on the same customer, might be the customer's
*only* representation of Entrada for that branch — no separate
substation-level meter exists above it, and its own downstream (fire-pump
equipment, say) has no separate meter either. Excluding *that* transformer
would not just hide an informational line — it would remove real,
otherwise-uncounted consumption from Entrada's total entirely, with nothing
else in the dashboard ever accounting for it. (The earlier draft of this
section framed the decision as "exclude only when downstream is unmetered
— keep it when downstream is unmetered, to avoid consumption vanishing,"
which mixed up the two axes above; downstream metering status alone does
not determine whether *this specific device's* reading is redundant with
*another device already counted in the same total*.) A classification
mechanism that always excludes "anything profiled as a transformer" cannot
evaluate either condition per device — it can only apply a blanket rule to
every device sharing that profile. Only a per-device decision, made by
someone who actually knows this customer's metering topology, can. This is
the central reason this RFC's recommended design operates at the device
level (`excludeGroupsTotals` per device id), not at the group or profile
level.

## Guide-level explanation

### The mechanism: `excludeGroupsTotals` (already shipped, RFC-0128)

Every energy device already carries an optional `SERVER_SCOPE` attribute,
`exclude_groups_totals` (surfaced to the client as `item.excludeGroupsTotals`),
read by `getValorEfetivo()` inside `buildSummary`
(`WIDGET/MAIN_VIEW/controller.js`). Shape:

```json
{
  "enabled": true,
  "groups": { "entrada": true }
}
```

When `enabled` and `groups.entrada` are both `true` for a device, that
device's value contributes `0` to `entradaTotal` — but the device itself
stays in the `entrada` array: it still renders on its own TELEMETRY card,
still counts in device-status aggregation (`aggregateDeviceStatus` iterates
the same `entrada` array `getValorEfetivo` reads from, unfiltered by
exclusion — confirmed against the running code, no gap here), and is still
included in `AllReportModal`'s export, per RFC-0128's
own comment in `WIDGET/MENU/controller.js`: *"carry exclude_groups_totals so
the report can drop devices that the dashboard KPIs already exclude — keeps
report total == card total."* The device's own card already shows a
distinct beige "excluded" background and marker
(`src/components/cards/main-view/v5.2.0/template-card-v5.js`) — this visual
distinction ships today, with zero new code.

### The admin action

An operator opens the device's Settings modal → **Exclusão de Grupos de
Cálculo** tab (`src/components/premium-modals/settings/exclusion-groups/ExclusionGroupsTab.ts`)
— already listing **Entrada** (`GROUP_DEFINITIONS`, description: *"Subestações,
Transformadores, RELOGIO"* — the tab's own copy already anticipates this
exact scenario) as one of seven checkboxes — and checks it for the specific
transformer whose downstream load is already metered elsewhere. No code
deploy, no widget to add, no profile field to learn: this works **today**,
for **every existing customer**, the moment this RFC's one genuinely new
piece (the tooltip notice, below) ships.

### The one new piece: an Entrada tooltip notice

`TELEMETRY_INFO` already renders a notice for a *different* kind of
per-device exclusion — devices excluded from the CAG subtotal
(`buildExcludedFromCAGNotice()`, a small, self-contained styled list,
independent of the richer `EnergySummaryTooltip` `byCategory` tree). This
RFC asks for the same pattern, once more, for devices excluded from the
*Entrada* total: a list of `{label, value}` rows plus a running total,
surfaced on the Entrada card's own tooltip content
(`buildEntradaContent()`), so an operator can see *which* transformers exist
and *how much* they read, even though that reading is deliberately excluded
from Entrada's own number.

### What this design does *not* introduce

No new `deviceProfile`. No new classification group in `resolveGroup`. No
new TELEMETRY widget instance. Transformers keep whatever `deviceProfile`
they have today (typically `TRAFO`, classified `entrada` exactly as before).
A future phase could still, optionally and independently of the exclusion
mechanism above, introduce a distinct `TRANSFORMADOR` `deviceProfile` purely
as an identification label — see [Future possibilities](#future-possibilities).

## Reference-level explanation

Five concrete changes, all inside files this mechanism already touches —
no new widget instance, no new top-level module. (A previously-listed sixth
item — a supposed device-status-aggregation gap — was checked against the
running code and does not exist: `aggregateDeviceStatus` consumes the same
`entrada`/`lojas`/`areacomum` arrays `getValorEfetivo` reads from, which are
never filtered by exclusion — an excluded device's status was already
counted correctly before this RFC, with no code change needed.)

### 1. `WIDGET/MAIN_VIEW/controller.js` — extract a shared exclusion predicate

`getValorEfetivo(item, nomeDoGrupo)` (~line 4125-4181) currently interleaves
the exclusion *decision* with the value *normalization*. This RFC's new
notice-list code (#2 below) needs the exact same decision, on the same
input shape — including the legacy `excludedGroups: [...]` array format and
the `'all'` sentinel `getValorEfetivo` already honors — so it must **share**
the decision, not reimplement a second, divergent interpretation of the same
attribute. Extract the exclusion check into its own named predicate and
make `getValorEfetivo` a thin wrapper over it:

```js
function isExcludedFromGroup(item, nomeDoGrupo) {
  if (!item.excludeGroupsTotals) return false;
  try {
    const parsed =
      typeof item.excludeGroupsTotals === 'string'
        ? JSON.parse(item.excludeGroupsTotals)
        : item.excludeGroupsTotals;
    if (!parsed?.enabled) return false;

    const needsClassify = nomeDoGrupo === 'area_comum' || SUB_GROUPS.includes(nomeDoGrupo);
    const categoriaReal = needsClassify ? classifyDevice(item) : null;

    if (parsed.groups && typeof parsed.groups === 'object') {
      if (parsed.groups[nomeDoGrupo] === true) return true;
      if (nomeDoGrupo === 'area_comum' && parsed.groups[categoriaReal] === true) return true;
      if (parsed.groups['area_comum'] === true && SUB_GROUPS.includes(nomeDoGrupo)) return true;
    } else if (Array.isArray(parsed.excludedGroups)) {
      const gruposExcluidos = parsed.excludedGroups.map((g) => String(g).toLowerCase());
      if (gruposExcluidos.includes(nomeDoGrupo.toLowerCase()) || gruposExcluidos.includes('all')) {
        return true;
      }
      if (nomeDoGrupo === 'area_comum') {
        if (
          gruposExcluidos.includes(categoriaReal) ||
          (categoriaReal === 'escadas_rolantes' && gruposExcluidos.includes('esc_rolantes'))
        ) {
          return true;
        }
      }
    }
  } catch (e) {
    console.warn('Erro ao ler exclude_groups_totals do dispositivo', item.label, e);
  }
  return false;
}

const getValorEfetivo = (item, nomeDoGrupo) =>
  isExcludedFromGroup(item, nomeDoGrupo) ? 0 : (Number(item.value) || 0);
```

This is a pure refactor of existing logic — same inputs, same outputs, same
fail-open behavior on malformed JSON (caught, warned, treated as
not-excluded) — with zero behavior change for every group already using it
(`lojas`, `area_comum`, and its `SUB_GROUPS`). It exists so #2 below cannot
drift from this interpretation.

### 2. `WIDGET/MAIN_VIEW/controller.js` — the new notice data, mirroring `excludedFromCAG`

`buildSummary` already builds exactly this shape for a different exclusion
family. The existing code (~line 4346-4360):

```js
let excludedFromCAG = [];
if (excludeIdsSet.size > 0) {
  cagItemsFiltered = cagItems.filter((item) => {
    const isExcluded = excludeIdsSet.has(String(item.id || '').toLowerCase());
    if (isExcluded) excludedFromCAG.push(item);
    return !isExcluded;
  });
}
```

and its output shape, already threaded into the returned summary object
(~line 4657):

```js
excludedFromCAG: excludedFromCAG.map((item) => ({
  id: item.id,
  label: item.label || item.name || item.deviceIdentifier || item.id,
  value: item.value || 0,
})),
```

This RFC adds the direct analog for Entrada, filtering on
`isExcludedFromGroup` from #1 — never a second, hand-rolled `JSON.parse`
that could drift out of sync with what the total calculation actually
honors:

```js
const excludedFromEntrada = entrada
  .filter((item) => isExcludedFromGroup(item, 'entrada'))
  .map((item) => ({
    id: item.id,
    label: item.label || item.name || item.deviceIdentifier || item.id,
    value: Number(item.value) || 0,
  }));
```

added to the summary object alongside `excludedFromCAG`. This is
deliberately the **only** place besides `getValorEfetivo` itself that
interprets `excludeGroupsTotals` — by construction, a device can never be
"excluded from the total but absent from the notice" or vice versa, because
both read the same predicate. Two properties worth calling out explicitly,
since they follow directly from reusing `isExcludedFromGroup`'s existing
behavior rather than being new design decisions: a device with
`excludeGroupsTotals.enabled === false` (exclusion toggled off) is correctly
**not** in this list and **not** excluded from the sum — the master toggle
in `ExclusionGroupsTab` already governs both consistently; and a malformed
`excludeGroupsTotals` attribute fails open (caught by the shared predicate's
`try/catch`) — the device is treated as not-excluded everywhere,
consistent with today's behavior for every other group, never a thrown
error that would break `buildSummary` for the whole customer.
Note this list is built from `entrada` (the full array
`categorizeItemsByGroup` already produces) using the device's *real*
`value`, not `getValorEfetivo`'s zeroed contribution — the notice needs to
show what the excluded device actually reads, not the `0` it contributes to
the sum.

### 3. `WIDGET/TELEMETRY_INFO/controller.js` — thread it into `STATE.tooltipData`

`processStateFromSummaryEnergy` already does exactly this for the CAG
family (~line 1648: `excludedFromCAG: summary.excludedFromCAG || []`, inside
`STATE.tooltipData`). Add the mirror:

```js
excludedFromEntrada: summary.excludedFromEntrada || [],
```

### 4. `WIDGET/TELEMETRY_INFO/controller.js` — the notice renderer

`buildExcludedFromCAGNotice()` (~line 2987-3018) is a small, self-contained
function: reads `STATE.tooltipData?.excludedFromCAG`, returns `''` when
empty, otherwise renders a styled list (amber notice box, one row per
device with its label and formatted value, plus a summed total) — entirely
independent of `EnergySummaryTooltip`'s structured `byCategory`/
`CategorySummary` tree (which is *why* this design sidesteps that
component's `percentage: number`-required, `icon`/`note`-ignored contract
entirely — see the original design's [Drawbacks](#drawbacks-of-the-original-design)
for the type-safety problem this avoids). This RFC adds
`buildExcludedFromEntradaNotice()`, the same shape, reading
`STATE.tooltipData?.excludedFromEntrada` instead, and calls it from
`buildEntradaContent()` (~line 3612), appended after the existing
`noticeText` banner.

`buildEntradaContent()`'s current `noticeText` (*"Soma de todos os medidores
de Entrada do shopping (transformadores e relógios principais)"*) should
also be revisited once exclusions exist for a given customer — it currently
asserts unconditionally that transformers ARE summed into Entrada, which
becomes only conditionally true. The exact wording is an implementation
polish decision, not specified further here.

**Decided:** `STATE.entrada.devices` (the flat list `buildEntradaContent`
already renders via `buildDeviceExpandList`) keeps showing **every** entrada
device, excluded ones included — do not filter them out of the primary
list. The excluded ones get whatever per-device visual marker
`template-card-v5.js` already uses elsewhere for this attribute (adapted
here for the tooltip's device rows, not just the standalone card), and the
separate notice from #4 explains the subtotal that was pulled out of the
sum. This keeps the primary list answering "what devices report under
Entrada" (an inventory question) while the notice answers "how much of that
inventory's total was excluded, and why" (a totals question) — two
different questions, two different UI elements, rather than overloading one
list to answer both.

### 5. The admin UI (`ExclusionGroupsTab.ts`) — no code change required

`GROUP_DEFINITIONS` (line 36) already lists `entrada` with description
*"Subestações, Transformadores, RELOGIO"* and already renders a checkbox
per device (`renderGroupRow`) — **checked = excluded from that group's
total** (`input.egt-group-check`'s `checked` state mirrors
`s.groups[key]`, i.e. `excludeGroupsTotals.groups[key] === true`). Zero code
change needed for the mechanism itself to be usable the moment #2-#4 ship.
An optional, purely cosmetic improvement: sharpen that description once the
tooltip notice exists, e.g. *"Subestações, Transformadores, RELOGIO —
marque Entrada para excluir este dispositivo do total (ex.: um
transformador cujo consumo já é medido a jusante, como chillers)"* — not
required, left to implementation judgment. (An earlier draft of this
sentence suggested "desmarque" — unchecking — as the action that excludes;
that was backwards, per the checkbox semantics above: **checking** the box
is what excludes.)

### What is explicitly unaffected

`WIDGET/MENU`, `WIDGET/HEADER`, `WIDGET/FOOTER`, `WIDGET/ALARM` — no change.
`resolveGroup`/`GroupName`/`deviceClassificationProfile.ts` — no change (no
new group). `mapLabelWidgetToStateGroup`/`getItemsFromState`
(`WIDGET/TELEMETRY/controller.js`) — no change (no new `labelWidget` to
route). No new `template.html`/`styles.css`/`settingsSchema.json` in any
widget. No GCDR contract implication (nothing new enters the classification
profile JSON). RFC-0109's `deviceType.ts` — unaffected unless the optional
labeling profile from [Future possibilities](#future-possibilities) is
picked up separately.

## Drawbacks

- **Doesn't give transformers their own dedicated widget card.** An operator
  who wants a standalone "Transformadores" grid (matching the visual
  pattern of the Lojas/Entrada/Área Comum cards) doesn't get one from this
  design — transformers stay visually inside the Entrada card's device list
  (marked excluded), not broken out into their own card. If a dedicated
  card is genuinely wanted later, see
  [Future possibilities](#future-possibilities) — it composes with this
  design rather than conflicting with it.
- **Still requires a manual, per-device migration action for existing
  double-counted customers.** This RFC does not (and, per the per-device
  argument in Motivation, *should not*) auto-detect or auto-flag existing
  `TRAFO` devices that are secretly in this topology. An operator still has
  to identify the right devices and check the right box, one customer, one
  device at a time — this design does not make that identification step
  easier, only the mechanism to act on it cheaper and already-available.
- **The notice text in `_buildSimpleGroupContent`/`buildEntradaContent` is a
  single fixed banner string today** — good enough for a static
  description, not for a dynamic, per-customer "N devices excluded, here's
  the list," which is exactly why this RFC adds a second, separate notice
  block rather than trying to extend the existing one.

### Drawbacks of the original design

(Kept for context — these applied to the "new top-level group" design and
directly motivated the revision; see
[BMAD Party Table Discussion](#bmad-party-table-discussion-2026-09-18) for
the full reasoning.)

- **A fifth code path to keep in sync** — `GroupName`, `categorizeItemsByGroup`,
  `buildSummary`'s parameter list, `mapLabelWidgetToStateGroup`'s branch
  table, and `TELEMETRY_INFO`'s tooltip-tree builder would all need to agree
  on a new string, forever, for every customer, even the ones that never
  have a transformer tier.
- **A confirmed migration gap.** `openDeviceProfileModal.ts` only replaces a
  domain's rules wholesale when the domain is entirely *missing*
  (`if (!working.domains.energy) { … }`, line ~133) — never merges a new
  rule into an already-persisted, already-customized `energy.groups.rules[]`.
  Any customer who had ever saved a profile before this RFC shipped would
  **not** receive the new `transformadores` rule automatically, unlike a
  brand-new customer. This was a genuine, confirmed gap in the original
  design (not a hypothetical one), closed entirely by the revised design
  (a per-device attribute needs no profile-JSON propagation at all).
- **A real contract violation in the tooltip payload.** `EnergySummaryTooltip`'s
  `CategorySummary.percentage` is `number`, not nullable
  (`src/utils/tooltips/EnergySummaryTooltip.ts` line 54), and its renderer
  looks up each child's icon from an internal `CATEGORY_ICONS[child.id]` map
  (line 1052), ignoring any `icon` field passed in the data — and renders no
  `note` field anywhere. The original design's proposed
  `{ percentage: null, icon: '🔌', note: '…' }` child violated the type and
  would have silently dropped both the custom icon and the note text. The
  revised design sidesteps this entirely by using the same free-form,
  independent notice-box pattern `buildExcludedFromCAGNotice` already uses,
  which has no such contract.
- **A correction to an earlier claim in this document:** an earlier pass of
  this RFC argued the group/profile design "could not express" the
  fire-pump counter-example. That overstated the case — `deviceProfile` is
  already assigned per physical device in ThingsBoard, so an operator
  *could* leave the fire-pump-feeding transformer profiled `TRAFO`
  (classified `entrada`, counted normally) while reprofiling only the
  chiller-feeding one to `TRANSFORMADOR`, achieving the same per-device
  outcome. The real, defensible objection is **blast radius**: reassigning
  a device's `deviceProfile` in ThingsBoard is a heavier, more consequential
  action than toggling a checkbox in a settings tab — a `deviceProfile`
  change can interact with anything else keyed off that field elsewhere in
  the system (device-type icons, alarm rule bindings, provisioning
  templates), where a per-device `excludeGroupsTotals` toggle is scoped,
  reversible metadata with one, already-audited consumer. See
  [Rationale and alternatives](#rationale-and-alternatives) for the full,
  corrected list of reasons.

## Rationale and alternatives

### The originally-proposed design: a new top-level `transformadores` group

This was this RFC's first draft, in full, preserved here as the alternative
considered and downgraded (not deleted — the research behind it remains
accurate and some of it is directly useful background, e.g. the confirmed
GCDR contract shape).

**Design:** A new, distinct `deviceProfile = 'TRANSFORMADOR'` (never reusing
`TRAFO`, so no existing dashboard's Entrada total moves), a new top-level
group in `resolveGroup`'s `GroupName` union and `DEFAULT_DEVICE_CLASSIFICATION_PROFILE`,
and a new, optional TELEMETRY widget instance (`labelWidget` matching
`Transformador`/`Transformadores`, case-insensitive) rendering exclusively
these devices. `mapLabelWidgetToStateGroup`/`getItemsFromState`
(`WIDGET/TELEMETRY/controller.js`) would gain matching branches;
`categorizeItemsByGroup`/`buildSummary` (`WIDGET/MAIN_VIEW/controller.js`)
would gain a fifth bucket, with `grandTotal` deliberately never including
`transformadoresTotal`; the Entrada tooltip would gain a nested,
non-summed `children` entry. `openDeviceProfileModal.ts`'s already-generic
`groupRules.forEach(...)` rendering (MENU's "Gestão de Perfil de
Dispositivos") would pick up the new group with zero code change, since it
already iterates `groups.rules[]` generically.

**Why it was downgraded, not just "also possible":**

1. **Cost asymmetry, confirmed concretely.** The group design touches
   `resolveGroup`/`GroupName`, `categorizeItemsByGroup`, `buildSummary`'s
   parameter list and `allItems`, `mapLabelWidgetToStateGroup`,
   `getItemsFromState`, a new widget instance, `EnergySummaryTooltip`'s
   contract (and its violation, above), `equipmentCategory.js` (RFC-0128's
   separate MYIO-SIM classifier, never brought in sync), a possible
   hardcoded filter list in `MenuView.ts`, `AllReportModal`'s `orchIdSet`
   pipeline, and optionally RFC-0109's `deviceType.ts` — on the order of a
   dozen surfaces. The revised design touches two functions in one file
   (`buildSummary`) plus one new function in a second file
   (`TELEMETRY_INFO`), reusing an admin UI, a per-device attribute, and a
   report-export integration that already exist and are already correct.
2. **It does not deliver per-device nuance for free, the way the revised
   design does — but it is not incapable of it either.** A first pass of
   this document argued the group/profile design "could not express" the
   fire-pump counter-example (one transformer excluded, a different one on
   the same customer not excluded). That claim does not hold up:
   `deviceProfile` is already a per-physical-device assignment in
   ThingsBoard, so an operator could simply leave the fire-pump-feeding
   transformer profiled `TRAFO` (still `entrada`, still counted) while only
   reprofiling the chiller-feeding one to `TRANSFORMADOR`. The genuine
   reason to prefer the per-device attribute here is **cost and blast
   radius**, not expressive power: a `deviceProfile` reassignment is a
   heavier, more consequential action (it can interact with anything else
   in the system keyed off that field — icons, alarm bindings, provisioning
   templates) than toggling a scoped, reversible, single-purpose checkbox in
   a settings tab that already exists for exactly this kind of decision.
3. **It had a real, confirmed rollout gap** for every existing customer
   (the DEFAULT-seed merge only fires for an entirely-missing domain), which
   the per-device design does not have at all — `excludeGroupsTotals` is set
   directly on a device, through a UI, with no profile-JSON propagation
   step to get right.
4. **`resolveGroup`'s original two rationale points still stand and are not
   contradicted by the revision:** classification must key off
   `deviceProfile`, not `labelWidget` (unchanged — this design does not
   introduce any `labelWidget`-based classification either), and RFC-0207's
   "Dispositivos Específicos" `include`/`exclude`/`parent` overrides remain
   the right tool for a *different* problem (pulling a device into the
   `areacomum` **breakdown** display), not this one (excluding a device
   from the **Entrada** total while leaving its own card visible).

### Why `excludeGroupsTotals`, specifically, and not a new attribute

Once the per-device shape was agreed on, reusing `excludeGroupsTotals`
rather than inventing a new, better-named attribute
(e.g. an `informationalRole: { excludeFromTotal, reason, coveredByGroupId }`
richer structure proposed during the roundtable) was chosen because the
entire chain — the `SERVER_SCOPE` attribute itself, `getValorEfetivo`'s read
path, the `ExclusionGroupsTab.ts` UI, the "excluded" card marker in
`template-card-v5.js`, and `AllReportModal`'s export-consistency handling —
already exists, is already tested by virtue of being in production, and
already covers `entrada` as one of its seven groups. A richer, reason-coded
attribute is a legitimate future improvement (see
[Future possibilities](#future-possibilities)) but is not required to ship
the behavior this RFC asks for, and shipping it now would mean building a
second, parallel per-device exclusion mechanism alongside one that already
exists for the exact same purpose.

## Prior art (in this codebase)

- **`excludeGroupsTotals` / `getValorEfetivo`** (RFC-0128,
  `WIDGET/MAIN_VIEW/controller.js` `buildSummary`) — the mechanism this RFC
  builds on. Already zeroes a flagged device's contribution to a named
  group's total (`lojas`/`entrada`/`area_comum`) while leaving the device in
  the group's device list.
- **`ExclusionGroupsTab.ts`** (`src/components/premium-modals/settings/exclusion-groups/`)
  — the existing admin UI already exposing per-device, per-group exclusion
  checkboxes, `entrada` included, with a description that already names
  transformers.
- **`template-card-v5.js`'s "excluded" card marker** — the existing visual
  treatment for an `excludeGroupsTotals`-flagged device's own card.
- **`excludedFromCAG` / `buildExcludedFromCAGNotice`** — the direct,
  line-for-line template this RFC's one new piece of code copies: a
  self-contained, `byCategory`-independent notice listing devices excluded
  from a specific subtotal, already proven in production for the CAG case.
- **RFC-0128's own `orchIdSet`/`AllReportModal` comment**
  (`WIDGET/MENU/controller.js`, *"keeps report total == card total"*) —
  confirms the export pipeline already handles `excludeGroupsTotals`
  consistently; nothing new required there.
- **RFC-0207's "Dispositivos Específicos" (`DeviceOverride`, `include`/
  `exclude`/`parent`)** — a related but distinct mechanism (operates on the
  `areacomum` **breakdown** categories, not on group totals); the right tool
  for "device physically feeds a *category* but must display elsewhere,"
  not for "exclude this device's value from a *group* total." Not reused
  here because it solves an adjacent, not identical, problem.
- **`resolveGroup`/`listGroups`'s dynamic engine (RFC-0207)** — remains
  unaffected and unnecessary for this RFC, since no new group is introduced.

## BMAD Party Table Discussion (2026-09-18)

This RFC was reviewed at a BMAD party-mode roundtable before implementation,
per the project's standard practice for architecture-affecting changes. Four
agents reviewed the *original* draft (the new-group design) independently;
two of them then cross-talked directly on the design's central fork. The
roundtable's findings changed this document's recommendation — recorded
here in full, not summarized away, because the disagreement and its
resolution are the most valuable part of the review.

**Participants:** 🏗️ Winston (System Architect), 📋 John (Product Manager),
📊 Mary (Business Analyst), 💻 Amelia (Senior Software Engineer).

### Round 1 — independent review of the original ("new group") design

**🏗️ Winston** raised nine gaps: no migration plan for existing `TRAFO`
devices secretly in this topology; no consistency guard-rail against the
double-counting the RFC exists to prevent; a device could become classified
`transformadores` without the optional widget ever being published for that
customer, silently vanishing from the UI; missing call sites (MENU device
counts, `myio:equipment-count-updated`, `AllReportModal`/`orchIdSet`);
v-5.4.0 not addressed at all, despite its own known 3-column hardcoding
debt; no rollout gate/feature flag for a change that alters customer-visible
totals; the topology as described (flat count/consumption, no parent-child
relationship) doesn't actually support auditing transformer loss, only
visually parking the double-count; no validation against operator typos in
the free-text profile editor; and no explicit regression test guarding the
one load-bearing line (`grandTotal` excluding `transformadoresTotal`).

**📋 John** challenged the premise directly, before engaging with any
implementation detail: *is there a real customer behind this, or is it a
hypothetical scenario justifying a permanent new taxonomy entry for every
customer forever?* He proposed a per-device flag (`excludeFromTotal: true`)
on a device still classified `entrada`, arguing it solves the double-count
and the tooltip requirement without a new profile, a new `GroupName`, a new
widget, or an RFC-0109 change. He also produced the fire-pump
counter-example: a shopping with two independent transformers, one feeding
an already-metered chiller plant (should be excluded) and one feeding
unmetered fire-pump equipment (must **not** be excluded) — proving the
exclusion decision has to be per-device, not per-group, since a monolithic
"transformer" category cannot express both outcomes at once.

**📊 Mary** raised business/stakeholder impact the original design hadn't
named: tenant common-area cost apportionment would shift in value the month
a transformer is reclassified out of `areacomum` math, with no real
consumption change, needing pre-emptive explanation, not a reactive one;
historical trend charts and goal/margin features (RFC-0052/RFC-0228) that
consume group totals would show an artificial step on reclassification day,
with no backfill plan; there is no audit method to find which customers
actually have this topology, so the feature risks going unused or being
misapplied; the business case wasn't sized against a named customer or
count of affected sites; and no feature flag/rollback plan was proposed,
unlike every comparable recent change in this codebase.

**💻 Amelia** listed ten implementation-level gaps, most concretely: RFC-0128's
own *separate* classifier, `equipmentCategory.js` (used only by the
MYIO-SIM simulators, confirmed via `grep`), was not updated in the
original draft and would have silently misclassified `TRANSFORMADOR`
devices there; `mapLabelWidgetToStateGroup`'s string-matching semantics
were unspecified (a `labelWidget` typo would silently produce an empty
grid); `AllReportModal`'s `orchIdSet` pipeline wasn't listed as a call site;
there was no test proving `grandTotal` stays byte-identical for customers
with zero `TRANSFORMADOR` devices; and no operational migration runbook or
demo/QA fixture existed for the feature.

### Cross-talk — resolving the group-vs-flag fork

Given John's challenge, Winston and Amelia were asked to respond directly.

**🏗️ Winston** shifted his position substantially: *"John, você me convenceu
na estrutura, mas não na simplicidade."* He agreed a new group/profile/widget
is the wrong shape — the classic error of modeling an exception as a
permanent taxonomy category, paid by every customer forever. He pointed out
that his own gap about `allItems` (device-status aggregation needing a
second, separate touch point beyond `grandTotal`) was itself evidence that a
new group creates two places to get double-counting wrong instead of one —
"the bug this RFC exists to prevent, re-manifesting in different code." He
disagreed with a bare boolean flag, though: without a structured reason and
a reference to what already covers the excluded consumption, an
unexplained `excludeFromTotal: true` becomes unauditable six months later.
He proposed a structured per-device attribute
(`{ excludeFromTotal, reason: 'downstream-metered' | 'unmetered-load' | …,
coveredByGroupId? }`) instead of either a new group or a bare boolean.

**💻 Amelia** sided fully with the per-device approach, quantifying the
implementation-cost asymmetry directly: the group design touches roughly
thirteen surfaces (enumerated above, in
[Rationale and alternatives](#rationale-and-alternatives)); a per-device
flag touches three (the `grandTotal` summation point, the tooltip renderer,
and reading an existing-shaped `SERVER_SCOPE` attribute) with zero changes
to `resolveGroup`, `mapLabelWidgetToStateGroup`, `equipmentCategory.js`,
`MenuView.ts`, `orchIdSet`, or `deviceType.ts`. She proposed the decisive
test: two transformers on the same customer, one excluded (feeds a metered
chiller) and one included (feeds unmetered fire pumps) — a group/profile
design, being all-or-nothing per device *type*, cannot pass this test at
all; a per-device flag passes it by construction. Her conclusion: the flag
isn't merely cheaper, it's the only design that correctly models the actual
use case John surfaced.

### Resolution — and what this reviewer's follow-up research found

Winston's and Amelia's positions converged on "per-device, not per-group."
Separately, direct verification against the running code (not part of the
agent roundtable, done as a follow-up before finalizing this document)
found that the "structured per-device attribute" Winston asked for did not
need to be invented at all: `excludeGroupsTotals` (RFC-0128) is already
exactly that shape in production — a per-device `SERVER_SCOPE` attribute,
already wired into `entrada`'s own total via `getValorEfetivo`, already
exposed through an existing admin UI (`ExclusionGroupsTab.ts`) whose
`Entrada` row is already described as covering *"Subestações,
Transformadores, RELOGIO,"* already respected by the report-export
pipeline, and already paired with a visible "excluded" marker on the
device's own card. It does not yet carry Winston's richer
`reason`/`coveredByGroupId` fields — a legitimate future enhancement (see
[Future possibilities](#future-possibilities)) — but the core exclusion
mechanism he and Amelia converged on needing already exists, tested, in
this exact codebase, for this exact group.

Two further, independently-confirmed findings from that same follow-up
verification pass materially changed this document beyond the group-vs-flag
question, and are recorded in [Drawbacks of the original design](#drawbacks-of-the-original-design)
and [Reference-level explanation](#reference-level-explanation) rather than
repeated here: `openDeviceProfileModal.ts` only auto-seeds a domain's rules
from DEFAULT when that domain is *entirely missing* (never merges a new
rule into an already-customized one — a real migration gap the original
design had and the revised design does not), and `EnergySummaryTooltip`'s
`CategorySummary.percentage: number` contract is non-nullable and ignores a
passed-in `icon`/`note` — the original design's tooltip payload was a
genuine type violation, sidestepped entirely by reusing the independent
`buildExcludedFromCAGNotice` pattern instead.

**Mary's** business-impact findings (rateio timing, trend-chart
discontinuity, audit-method gap, rollout/flag absence) were not
re-litigated during cross-talk — they apply to *whichever* design ships,
since both involve the same underlying user-visible change (a transformer's
value moving out of a total it was previously part of). They remain open
items for whoever schedules implementation, not resolved by this revision.

### Third pass — two corrections to the roundtable's own reasoning

A later, independent re-review of this revised document (2026-09-18, same
day) found that two arguments used above to justify the revision do not
fully hold up, though the revision's conclusion survives on other grounds:

- **John's and Amelia's "cannot express both outcomes at once" claim about
  the group/profile design is overstated.** `deviceProfile` is already a
  per-physical-device assignment, so an operator could in fact leave one
  transformer `TRAFO` (counted) and reprofile only the other to
  `TRANSFORMADOR` (excluded) — the group design *can* express per-device
  decisions, just through profile reassignment rather than a checkbox. The
  actual, defensible reason to prefer the per-device attribute is cost and
  blast radius (Amelia's thirteen-surfaces-vs-three count, and a
  `deviceProfile` change's wider potential to interact with icons/alarms/
  provisioning versus a scoped settings-tab toggle), not an inability to
  model the scenario at all. [Rationale and alternatives](#rationale-and-alternatives)
  and [Drawbacks](#drawbacks) have been corrected to reflect this.
- **The fire-pump example's own stated criterion was wrong.** Round 1 and
  the cross-talk both framed the exclude/don't-exclude decision as turning
  on whether the transformer's *downstream* has a separate meter. That is
  not the right test: a transformer's reading can already be redundant with
  an *upstream* substation meter counted in the same Entrada total,
  regardless of what its downstream feeds or whether that downstream is
  metered at all. [Motivation](#motivation) has been rewritten to state the
  correct test (is this device's reading already counted by another device
  in the *same* total — upstream *or* cross-group) rather than the
  downstream-metering heuristic used throughout the roundtable discussion
  above. The conclusion the roundtable reached — decide per device, not per
  group — is unaffected; the *reasoning* for why is now accurate.

### What the roundtable did not resolve

- **Whether a dedicated "Transformadores" visual card is *still required*.**
  This is the single most important open item in this document. The
  original request explicitly asked for a widget that renders these
  devices on their own; this revision deliberately does not provide one
  (see [Drawbacks](#drawbacks) and the [Summary](#summary)'s scope-boundary
  note). No agent argued for reviving it as a hard requirement, but no one
  ruled it out either — it was simply not the roundtable's focus, which
  centered on the group-vs-flag question. **This needs an explicit answer
  from whoever owns the product decision before this RFC can be considered
  complete**, not just a "future possibility" — see
  [Unresolved questions](#unresolved-questions) #1.
- **Mary's rollout/flag and customer-communication concerns** are unresolved
  and apply regardless of design — see [Unresolved questions](#unresolved-questions).
- **The exact identification/audit process** for finding which existing
  customers have this topology today (Mary, Winston) remains unanswered —
  this revision makes the *fix* cheap and correct but does not make
  *finding where to apply it* any easier.

## Unresolved questions

1. **Is the dedicated "Transformadores" widget still a requirement?** This
   revision delivers correct totals and tooltip transparency; it does not
   deliver the standalone card/grid the original request asked for. Confirm
   whether the tooltip notice is an acceptable substitute for the
   originally-requested widget, or whether that widget is still needed as a
   follow-on layered on top of this exclusion mechanism (composable, per
   [Future possibilities](#future-possibilities) — not mutually exclusive
   with this RFC, but a separate scope decision).
2. **Rollout gate.** Should enabling the Entrada exclusion notice
   (`buildExcludedFromEntradaNotice`) be gated behind a feature flag on
   first release, consistent with how other customer-visible total/tooltip
   changes have shipped in this codebase (temperature, tickets,
   annotations), or is it safe to ship ungated since it is purely additive
   (an empty list renders nothing, identical to today) and only activates
   per-customer the moment an operator actually checks an exclusion box?
3. **Customer communication for rateio/apportionment shifts.** Mary's point
   stands unresolved: the month an operator excludes a transformer that was
   previously included, `areacomum`-derived apportionment figures (if any
   downstream billing/rateio process consumes them) will shift with no
   underlying consumption change. Who owns communicating this before an
   operator flips the checkbox for a live customer?
4. **Audit method for migration candidates.** No tooling exists (and none is
   proposed here) to identify which existing customers have a transformer
   feeding already-separately-metered equipment, or one whose reading is
   redundant with an upstream substation meter. Is a one-time audit pass
   worth building, or is this left to reactive, ticket-driven discovery?

## Acceptance criteria

Concrete, testable scenarios this feature must satisfy — proposed in
response to review feedback that the document listed call sites without a
matching test plan:

- **AC-1 (no regression).** For a customer with zero `excludeGroupsTotals`-flagged
  devices, `entradaTotal`, `STATE.tooltipData.excludedFromEntrada` (empty
  array), and the rendered Entrada tooltip are byte-identical to this
  feature's absence.
- **AC-2 (basic exclusion).** A device with `excludeGroupsTotals =
  {enabled: true, groups: {entrada: true}}` contributes `0` to
  `entradaTotal`, appears in `excludedFromEntrada` with its real (non-zero)
  `value`, still appears in `STATE.entrada.devices`, still renders on its
  own TELEMETRY card with the existing "excluded" marker, and still counts
  in `aggregateDeviceStatus`'s output.
- **AC-3 (exclusion disabled).** A device with `excludeGroupsTotals =
  {enabled: false, groups: {entrada: true}}` is **not** excluded from
  `entradaTotal` and does **not** appear in `excludedFromEntrada` — the
  master `enabled` flag, not the presence of `groups.entrada`, governs the
  outcome, matching `isExcludedFromGroup`'s existing precedence.
- **AC-4 (legacy attribute format).** A device with the legacy shape
  `excludeGroupsTotals = {enabled: true, excludedGroups: ['entrada']}` (or
  `excludedGroups: ['all']`) is excluded from `entradaTotal` and appears in
  `excludedFromEntrada`, identically to the current-format equivalent —
  `isExcludedFromGroup` must handle both without divergence.
- **AC-5 (malformed attribute fails open).** A device with an
  unparsable-as-JSON string in `excludeGroupsTotals` does not throw, does
  not crash `buildSummary` for the whole customer, is treated as
  not-excluded (counted normally in `entradaTotal`), and does not appear in
  `excludedFromEntrada` — matching `getValorEfetivo`'s existing
  try/catch-and-warn behavior today for every other group.
- **AC-6 (zero-reading excluded device).** A device with
  `excludeGroupsTotals.groups.entrada = true` and `value = 0` (or missing)
  still appears in `excludedFromEntrada` with `value: 0`, and does not
  break the notice's summed total.
- **AC-7 (updates after save, no reload).** Toggling the Entrada checkbox in
  `ExclusionGroupsTab` for a device and saving updates `entradaTotal` and
  the tooltip notice on the next regular data refresh, without requiring a
  full page reload — confirm this against however `ExclusionGroupsTab`'s
  save flow already triggers a re-fetch/re-render for the other six groups
  it supports today; this RFC does not introduce a new refresh mechanism,
  only a new consumer of an existing one.

## Future possibilities

- **A richer, reason-coded exclusion attribute.** Winston's proposed shape
  (`{ excludeFromTotal, reason: 'downstream-metered' | 'unmetered-load' | …,
  coveredByGroupId }`) would make an exclusion self-documenting —
  answering "why was this specific device excluded, and what already
  covers its consumption?" directly from the data, instead of requiring
  someone to remember or re-derive the topology later. This is additive to
  `excludeGroupsTotals`'s existing shape (an optional `reason` field) and
  does not require revisiting anything else in this RFC.
- **A dedicated "Transformadores" visual card**, composable with the
  exclusion mechanism rather than a replacement for it: a TELEMETRY widget
  instance that specifically lists devices with
  `excludeGroupsTotals.groups.entrada === true` (regardless of
  `deviceProfile`), giving them the standalone-card treatment the original
  design wanted, while the underlying total math stays exactly as this
  revision describes.
- **An optional `TRANSFORMADOR` labeling `deviceProfile`**, decoupled from
  classification entirely: purely so operators can visually distinguish "an
  Entrada-classified device that is specifically a transformer" from a
  plain main meter in device lists, the `ExclusionGroupsTab` editor, and
  reports. If picked up, this reintroduces (in a much smaller, purely
  cosmetic form) the RFC-0109 `deviceType.ts` touch point from the original
  design: a `TRANSFORMADOR` branch in `handleDeviceType()`'s name-inference
  logic, alongside (never replacing) the existing `TRAFO` → `ENTRADA`
  branch.
- **An audit tool** to scan existing customers for the topology this RFC
  addresses (a transformer, profiled `TRAFO`, whose consumption
  approximately equals the sum of an identifiable equipment cluster already
  metered under Área Comum) — turning Mary's and Winston's unresolved
  "how do we find the candidates" question into a one-time, semi-automated
  pass instead of purely reactive discovery.
- **MYIO-SIM parity** — `equipmentCategory.js`'s own, separate classifier
  (used only by the standalone simulators) has no equivalent to
  `excludeGroupsTotals` today; mirroring this feature there, if the
  simulators are ever expected to demo it, is a separate, follow-up piece
  of work.
