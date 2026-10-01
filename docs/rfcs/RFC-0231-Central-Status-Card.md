# RFC-0231 — Central Status Card (shared vanilla-JS component)

- **RFC number:** 0231
- **Feature name:** `central-status-card`
- **Title:** Standard, reusable "Central Status card" component for `myio-js-library`
- **Status:** Draft (for approval)
- **Type:** Library component (vanilla JS/DOM, UMD `window.MyIOLibrary`)
- **Author:** (proposed)
- **Created:** 2026-09-02
- **Relates to:** GCDR **RFC-0062** (orchestrator-devices worker + admin cockpit: `monitoring_enabled`, probe evidence, `effStatus`, `centralVerdict`, shadow→cutover).
- **Note on RFC-0063:** an earlier GCDR-side draft, *RFC-0063 "Central Connectivity & Monitoring Controls"*, has been **deleted** — that number collided with the existing **RFC-0063 "Central Backup & Restore"** (PR #53), and its column-based fix for the customer centrals list is subsumed by this component. This RFC does **not** supersede any live RFC-0063. The GCDR-side adoption of this card (cockpit + customer list) will be its own **separately, correctly-numbered integration RFC** in the GCDR repo, later.

> **This is a design document only. It does NOT implement the component.** It
> specifies the public API, the file layout, the `src/index.ts` export, the
> showcase, the test plan, and the two GCDR integration points, so that a
> follow-up implementation PR can be reviewed against a fixed contract.

---

## Summary

Introduce a single, framework-agnostic **Central Status card** factory —
`createCentralStatusCard` — to `myio-js-library`, shipped in the UMD bundle as
`window.MyIOLibrary.createCentralStatusCard`, following the exact vanilla-DOM
idiom of the existing `createDivCard`
(`src/components/div-card/DivCard.ts`): a factory that injects its own CSS once
and returns a DOM handle (`{ element, update(), destroy(), … }`).

It is named **Central *Status* card** deliberately — it is not a generic central
card; it is specifically the connectivity/monitoring/status surface for one
central. It renders that central's operational state grouped into two visually
distinct blocks:

- an **Operação** block — derived **connectivity** badge
  (`ONLINE / OFFLINE / WARNING / UNKNOWN`), a **Monitoramento on/off slider**, an
  optional force-sync button, última tentativa / último sucesso timestamps, a
  plain-language probe verdict, a device roll-up (total · online · offline ·
  unknown), and an optional divergência row; and
- a **Cadastro** block — a **Status on/off slider** (`ACTIVE / INACTIVE`,
  **new** — the cockpit card does not have this today).

The card is designed to **unify two GCDR surfaces that render the same
information today with two different code paths**:

1. the **orchestrator-devices admin cockpit** — server-rendered HTML in
   `gcdr.git/src/controllers/admin/orchestrator-devices-admin.controller.ts`,
   which today builds each central card by hand (`centralBodyHtml`) inside a
   `createDivCard` shell; and
2. the **customer-facing centrals list** —
   `gcdr-frontend.git/src/components/customers/CustomerCentralsTab.tsx`, a React
   table this card is meant to replace.

At its core is a small **pure, DOM-independent** helper —
`deriveCentralConnectivity` — that both surfaces (and the card) share so the
grace-window rule is defined once. Auth and audit are **not** baked into the
card: it takes async callbacks; the host wires the real endpoint, permissions,
and audit.

## Motivation

- **Two surfaces, one concept, drifting implementations.** The cockpit and the
  customer tab both answer "is this gateway reachable, is it monitored, is it
  active, what did the last probe say, how many devices are up?" — but the
  cockpit computes a *derived* connectivity from probe evidence (`effStatus`),
  while the customer tab renders the **canonical** `central.connectionStatus`.
  A shared card ends that divergence.

- **The customer tab is actively misleading.** In RFC-0062 **shadow mode** the
  worker does not write canonical `connection_status`, so
  `CustomerCentralsTab.tsx`'s *Conexão* column (which reads
  `central.connectionStatus`, line ~210) is stale — every gateway reads
  *Offline* even when its probe is responding (observed live: *Central Campinas
  Hidrômetros G0* shows Offline while its probe responds). The fix is a card
  that shows **derived** connectivity from probe evidence, computed by the
  **same shared rule** as the cockpit.

- **The derivation must live in one place, and it is the real risk.** Today the
  grace-window rule exists twice: the worker's `centralVerdict`
  (`gcdr.git/src/workers/orchestrator-devices/verdict.ts`) and the cockpit's
  `effStatus`. Adding a third copy in React would guarantee drift. Extracting
  it as a pure helper is the highest-value, lowest-risk deliverable and can land
  **before** the card.

- **Status and Monitoramento are different concepts and must not look
  equivalent.** *Monitoramento* is an operational probe gate; *Status*
  (ACTIVE/INACTIVE) is a registry/lifecycle attribute. Presenting them as two
  identical sliders in one undifferentiated list invites mistakes. They belong
  in separate, labelled blocks (**Operação** vs **Cadastro**).

- **Consistency of the control UX.** The premium confirm-on-destructive-direction
  slider behaviour, optimistic UI, and revert-on-reject are worth writing once.

## Guide-level explanation

### What the card looks like — two blocks

The card groups its content into two visually separated blocks so the operator
never confuses the operational probe gate with the registry lifecycle flag.

```
┌───────────────────────────────────────────────┐
│ ●  Central Campinas Hidrômetros G0             │  ← name + health accent
├───────────────────────────────────────────────┤
│  OPERAÇÃO                                       │  ← block header
│  📡 conectividade                    [ ONLINE ] │  ← derived connectivity badge
│  👁 Monitoramento         🔄        ( ●===) on  │  ← Monitoramento slider (+ optional force-sync)
│  🕒 última tentativa   2026-09-02 14:03 (12s)   │
│  ✅ último sucesso     2026-09-02 14:03 (12s)   │
│  📶 teste de conexão   Respondendo   45ms       │  ← probe verdict in plain language
│  📟 dispositivos       128 · 120 · 3 · 5        │  ← total · online · offline · unknown
│  ⚠️ divergência        ONLINE → OFFLINE         │  ← optional; cockpit only by default
├───────────────────────────────────────────────┤
│  CADASTRO                                       │  ← block header (separated)
│  ⚡ Status                       (===● ) INACT.  │  ← ACTIVE/INACTIVE slider — NEW
└───────────────────────────────────────────────┘
```

> The emojis above are **illustrative placeholders only** — icons are decorative,
> not semantic (see "Icons are decorative, not semantic"). Every state is carried
> by the text/badge labels; the glyphs can be re-themed or removed entirely.

- **Operação** = everything about *how the gateway is behaving right now*:
  connectivity, the Monitoramento probe gate, force-sync, evidence timestamps,
  probe verdict, device roll-up, divergence.
- **Cadastro** = the *registry lifecycle* of the record: the Status
  (ACTIVE/INACTIVE) slider.

> **Implementation note (post-RFC, kept here so this doc doesn't silently go
> stale):** the shipped color model is richer than the single-accent sketch
> above — the card border now follows `entityStatus` (registry axis: ACTIVE =
> green/3D, INACTIVE/DELETED = gray) **independently** from the header+badge,
> which follow `connectivity` (health axis: ONLINE = blue, WARNING/OFFLINE/
> UNKNOWN = subtle amber/rose/slate). Divergência also shipped as a ⚠️
> icon+tooltip next to the connectivity badge instead of a full row, and
> `CentralEntityStatus` gained `DELETED` (behavior undesigned — see
> `types.ts`). `deriveCentralConnectivity` also grew v2 options
> (`blipToleranceMs`, `offlineHardMs`) not in this RFC's original §0 spec. The
> current, living reference for all of this is
> `showcase/central-status-card/README.md` §6 ("Guia visual") and its live
> legend section — treat this RFC as background on the design space explored,
> not the final word on colors or layout (see the next note).
>
> Also shipped post-RFC: the 📈 timeline modal the old `createDivCard`-based
> central card had (period selector over `orchestrator_devices_status_history`,
> stacked bar + transitions list) — it had gone orphaned on this new card (no
> actions slot to hang it from). It's implemented in `TimelineModal.ts` /
> `openCentralTimelineModal`, wired via an optional `timeline` param on
> `createCentralStatusCard`, and documented in
> `showcase/central-status-card/README.md` §7. Its state vocabulary
> (`CentralTimelineStatus`: ONLINE/DEGRADED/OFFLINE/UNKNOWN) is deliberately a
> separate, non-convertible type from `CentralConnectivity` — see that
> section for why.
>
> **The Operação/Cadastro two-block split this RFC spends §"What the card
> looks like" arguing for was later removed** (explicit user feedback: "não
> vejo motivo de separação... remova isso para deixar mais limpo"). The card
> now renders a single flat `.myio-cscard__block` — same rows, same order
> (connectivity → Monitoramento → evidence → dispositivos → Status), just no
> section header text ("OPERAÇÃO"/"CADASTRO") or divider between them.
> `CentralStatusCardLabels.operationBlock`/`.registryBlock` were removed from
> the type (nothing rendered them any more). The (i) title tooltip, which had
> briefly moved to sit beside the "CADASTRO" label, moved back to the
> titlebar since that label no longer exists. Also inspired by
> `cards/main-view/v6.0.0` in this same pass: a left action column
> (📊/📄/⚙️, `.myio-cscard__actioncol`), a selection checkbox row
> (`.myio-cscard__selectrow`, not an absolute overlay), `enableDragDrop`, and
> a latency trend arrow (↑ green faster / ▬ flat within 100ms / ↘ red
> slower) next to "teste de conexão" — none of this is in the RFC body below,
> see `showcase/central-status-card/README.md` §8 instead.
>
> Three more post-RFC additions, none in the body below:
>
> 1. **`openGatewayModal`** (`src/components/premium-modals/gateway/`) — a
>    latency-history chart modal opened from the 📊 action button, originally a
>    small `openGenericModal`-based version inspired by (but far smaller than)
>    `src/components/temperature/index.ts`. **Rewritten in full** (see item 6
>    below) to instead mirror `TemperatureModal.ts` closely; see
>    `showcase/central-status-card/README.md` §9 for the current shape.
> 2. **`openCentralSettingsModal`** (`src/components/premium-modals/central-settings/`)
>    — started as an independent adaptation of the device `SettingsModalView.ts`
>    built on `openGenericModal`, then rebuilt to **literally `extends
>    SettingsModalView`** per explicit direction ("CentralSettingsModal deve
>    estender SettingsModalView e vou pensando em customizações depois").
>    `CentralSettingsModal` overrides the base's public `render()` to mount
>    the real device-modal shell via `super.render()` then inject a
>    "Conectividade (Central)" fieldset (the v2 `deriveCentralConnectivity`
>    tuning knobs — `offlineGraceMinutes`/`blipToleranceMinutes`/
>    `offlineHardMinutes`, validated with the same "hard > grace" invariant —
>    with no equivalent in the base) directly into the DOM, since the base's
>    other fields (`container`/`modal`/`form`/`config`) are all `private` and
>    unreachable from a subclass; `onSave`/`onClose` are rebound by mutating
>    the shared config-object reference passed to `super()`. Opened from the
>    ⚙️ action button. Ships with the base's device-shaped chrome as-is for
>    the Geral tab (Andar/Identificador field labels, a generic device-type
>    icon, Anotações/Alarmes tabs showing "not available" placeholders, no
>    `domain`/`jwtToken`/`gcdrDeviceId` wired) — customization deferred per
>    the same instruction.
>
>    A follow-up request ("precisamos de ver tudo que a central teria de
>    informações... tudo que está no card... e mais a data da criação, data
>    da alteração, modelo, firmware version, uuid, hardware id", against
>    GCDR's `GET /api/v1/centrals/:id` payload as reference) needed a real
>    6th tab — `switchTab()` hard-codes exactly 5 tab names, so a DOM-injected
>    tab can't participate in it without reimplementing that logic. This is
>    `SettingsModalView.ts`'s **first actual edit** (everything else is pure
>    subclass injection): a `ModalConfig.isGateway` flag (default falsy, a
>    real device never sets it) gates a native "Central" tab —
>    `getGatewayInfoHTML()` renders 4 read-only cards (Identificação,
>    Conectividade/telemetria, Estatísticas, Metadados) from a new
>    `GatewayInfo` config field, 1:1 with the GCDR payload. Since that HTML is
>    generated once at construction time, `CentralSettingsModal` patches the
>    `#gwinfo-*` elements' `.textContent` after an async `onFetchSettings`
>    resolves — the same idiom the base itself already uses for
>    `#identity-created-time-value`. See §10.
> 3. **`scale?: number`** on `createCentralStatusCardParams` — a whole-card
>    zoom multiplier applied via CSS `zoom` (simpler than
>    `v6.0.0`'s per-element `zoomMultiplier` override pattern, since this card
>    has no chart canvas that needs pixel-exact re-measurement on zoom).
> 4. **Notification badges** (alarm 🔔 / ticket 🎧 / annotation ⚠️🔧✓📝) — a
>    faithful port of the exact badge families in
>    `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`
>    (same colors, icons, "99+" cap, hide-at-zero behavior), added via
>    `alarmCount`/`ticketCount`/`annotationCounts` + their `on*BadgeClick`
>    callbacks. Positioning went through several revisions after the initial
>    port: first anchored inside `.myio-cscard__content`'s corners (like the
>    original device tile), which collided with real title/row text this card
>    has in those corners (the device tile doesn't); then moved to hang OUTSIDE
>    the card, straddling its own outer border, by making the badges root-level
>    children while introducing an inner `.myio-cscard__surface` wrapper that
>    holds the actual `overflow:hidden`/rounded-corner clipping (previously on
>    the root itself) — root-level placement is also what keeps them clear of
>    the left action column from note 3, since that column only spans the
>    content row's own height. Alarm sits 18% down from the top edge and ticket
>    18% up from the bottom edge, both hugging the left border (an intermediate
>    "grouped into one column" layout was tried and reverted, and the top/bottom
>    split itself was tuned once from 10%→18% — see §11's revision history);
>    the annotation column stays on the right, unchanged. Hover on any of the 3
>    families now opens the same premium `InfoTooltip` used by the (i)/
>    divergência triggers (native `title=` attrs were dropped in favor of
>    `aria-label`, to avoid a double tooltip). See §11.
> 5. **Status switch-text visually hidden** — the RFC's own DOM skeleton below
>    (`<span class="myio-cscard__switch-text">INACTIVE</span>`) still shows it
>    as visible text; shipped behavior keeps that span in the DOM (screen
>    readers, existing text-content tests) but visually hides it for the
>    Status row specifically — the slider position alone reads clearly enough
>    there. Monitoramento's ON/OFF text stays visible (unaffected).
> 6. **`GatewayModal` rewritten + new `GatewayComparisonModal`** — explicit
>    follow-up direction ("queria a ui de dashboard de gráficos o mais
>    parecido com [...] quando digo parecido digo parecido bem bem parecido
>    mesmo") to make the 📊 chart modal closely mirror the actual production
>    reference. The user's first pointer (`TemperatureSettingsModal.ts`) was a
>    form with no charts, not the right target; the real one was confirmed by
>    tracing `handleActionDashboard` in
>    `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`,
>    which opens `openTemperatureModal` from `TemperatureModal.ts`. Both
>    `GatewayModal.ts` and a new `GatewayComparisonModal.ts` (multi-central
>    connectivity comparison) are near-1:1 structural ports of
>    `TemperatureModal.ts`/`TemperatureComparisonModal.ts` respectively —
>    same `ModalState`/`renderModal()`/hand-drawn `<canvas>`
>    `drawChart`+tooltip/`createDateRangePicker`/Day-Period multiselect/
>    Granularity select/localStorage-persisted theme/CSV export shape, with
>    latency (ms) + an SLA dashed-line/"at risk" band standing in for
>    temperature's value + ideal-range band. This **replaced**
>    `GatewayModal`'s prior `openGenericModal`-based implementation outright
>    (breaking change: `source.onFetchLatencyHistory` now takes
>    `{id, startTs, endTs}`, not `{id, days}`, matching
>    `TemperatureModal.ts`'s own `dataFetcher(startTs, endTs)`). See
>    `showcase/central-status-card/README.md` §9–10 for the current contracts
>    and the showcase's "Comparar centrais" wiring.
> 7. **Per-central eye toggle + consolidated KPI + connectivity uptime KPI +
>    PDF export**, on both gateway modals from item 6 — explicit follow-up
>    request ("um icon de eye para show / hide de cada gateway central... falta
>    um KPI consolidado da média geral, tempo estimado total de centrais
>    offline... falta um KPI para uma central sem ser comparação focando em
>    conectividade... um button para exportar premium pdf"). `GatewayComparisonModal`'s
>    per-central stats cards gained a 👁️/🙈 toggle (`state.hiddenCentrals: Set<central.id>`,
>    all visible by default) that dims the card, drops its line/SLA-band from
>    the chart, and excludes it from a new "Consolidado" KPI card (overall
>    average latency + total estimated offline hours across visible centrals
>    only, recomputed on every toggle). `GatewayModal` gained a 5th
>    "Disponibilidade" stats card via a new `calculateUptimeStats(stats,
>    startTs, endTs)` (`gateway/utils.ts`) — a proportional estimate
>    (`offlineFraction = gaps / (count + gaps)`, scaled across the period's
>    wall-clock hours), explicitly documented as *not* a continuous-time
>    integral. Both modals gained an "Exportar PDF" button next to the
>    existing CSV one, via new `exportGatewayPdf`/`exportGatewayComparisonPdf`
>    modules sharing layout helpers (`gateway/pdfLayout.ts`) modeled on
>    `header-annotations-panel/ExportPDF.ts`'s jsPDF pattern (portrait A4,
>    manual cursor, cover/section headers/footer with page numbers) — using
>    RFC-0231's own `#3e1a7d` purple instead of that reference's `#4c3aac`,
>    plus the rendered chart `<canvas>` embedded as an image via
>    `canvas.toDataURL('image/png')`/`doc.addImage(...)`. See
>    `showcase/central-status-card/README.md` §9–10 for the exact card/button
>    shapes.
>
>    **Immediate follow-up refinement** ("falta mostrar o tempo online
>    estimado e um percentual ao lado de cada tempo... os KPIs poderiam estar
>    numa espécie de menu retrátil side right bar"): the consolidated KPI card
>    now shows **both** estimated online and offline time, each with its own
>    percentage (e.g. "661.0h (98.4% online)" / "11.0h (1.6% offline)") — the
>    percentage is the sum of each visible central's online/offline hours
>    divided by their combined total, which works out to an equally-weighted
>    average since every central's online+offline always sums to the same
>    period length. And the whole KPI panel (consolidated + per-central cards,
>    previously a horizontal strip below the chart) moved into a **retractable
>    right sidebar** (`state.kpiSidebarOpen`, default open, persisted to
>    `localStorage`) with two equivalent toggles — a 📊 header icon and a
>    "Ocultar/Mostrar KPIs" footer button — collapsing to `width: 0` and
>    handing that space back to the chart column (`drawComparisonChart` is
>    re-run on toggle since it measures `chartContainer.clientWidth` fresh
>    each draw). The color-swatch legend row above the chart stays visible
>    regardless of sidebar state, as the one place line colors stay
>    identifiable when the panel is collapsed.
>
>    **Second follow-up refinement**: each per-central card in the sidebar
>    replaced its 3 separate Média/Min/Max rows with a single "Mín. / Méd. /
>    Máx" line, and gained its own "Conectividade" line — a blue dot + online
>    hours/% next to a red dot + offline hours/%, the same `calculateUptimeStats`
>    used by the consolidated card and `GatewayModal`'s own Disponibilidade
>    card, just per-central instead of aggregated.
>
>    **Third follow-up — PDF export redesign + a real bug fix**: the PDF
>    export's cover previously drew each info line with a single
>    `doc.text()` call — jsPDF never wraps text on its own, so a long
>    "Centrais: A, B, C, D..." line ran straight off the page edge instead of
>    wrapping, cutting names off. Fixed by routing every card/list body line
>    through `doc.splitTextToSize()` before drawing it (`pdfLayout.ts`'s new
>    `pdfCard`/`pdfListCard` helpers). While fixing that, the whole PDF
>    layout was redesigned around `docs/shared/myio_release_notes_alarmes_v0.1.446.html`
>    (MYIO's actual release-notes document, offered as the explicit visual
>    reference) — a purple hero band (MYIO wordmark, decorative accent
>    circle, a rounded "pill" badge, `#4d2a91`/`#663ab5`/`#04c081`/`#e03131`
>    lifted straight from that file's `:root` palette), bordered
>    left-accented "cards" for text blocks, bordered KPI "stat rows" (big
>    bold value + small muted uppercase label) replacing bare text lines for
>    every latency/uptime number, and a solid purple footer band with page
>    numbers on every page — applied identically to both `exportGatewayPdf`
>    and `exportGatewayComparisonPdf` via the shared `pdfLayout.ts` helpers.
>
>    **Fourth follow-up — Conectividade fieldset moved from Geral to
>    Central**: once the native "Central" tab existed (item 6's addendum
>    above), having the *editable* connectivity calibration knobs
>    (grace/blip/hard-offline) still injected into the *Geral* tab, separate
>    from the *read-only* GCDR telemetry in the *Central* tab, split
>    everything central-specific across two tabs for no reason — explicit
>    follow-up: *"tem uma aba nova Central, esses dados não deveriam estar
>    todos na aba central?"*. `CentralSettingsModal.injectConnectivitySection()`
>    now targets `#gateway-tab-content .gateway-info-grid` instead of
>    `#general-tab-content form`, inserting right after the read-only
>    "Conectividade (telemetria)" card (found by heading text, not a fixed
>    position). Since the Central tab isn't `<form>`-wrapped (only Geral is),
>    `getFormData()` is now also overridden — merges the base's
>    `new FormData(this.form)` with a manual read of the connectivity inputs,
>    resolved via ordinary prototype dispatch when the base's own save/submit
>    handlers call `this.getFormData()` internally, no base-file edit needed.
>    The redundant read-only `UUID` input inside the old fieldset was dropped
>    too — the Central tab's own "Identificação" card already shows it.

The two blocks are rendered as distinct sections (own header, own border/spacing)
so they never read as two equivalent switches.

### Variants: `card` and `compact`

The card ships in two densities via `variant?: 'card' | 'compact'`:

- **`'card'`** (default) — the full grid card above; used by the **cockpit**.
- **`'compact'`** — a row-dense layout for the **customer table** so that
  replacing `CustomerCentralsTab`'s `<Table>` does not lose density. Compact
  **still exposes the connectivity badge and both sliders inline** — it does not
  hide controls; it collapses the evidence rows (timestamps / probe verdict /
  device breakdown) into a tooltip or a single condensed line, and lays the two
  blocks out horizontally rather than stacked. Both variants share the same
  factory, params, callbacks, and confirmation behaviour.

### The two sliders and the confirmation matrix

Both sliders are **optimistic with revert-on-reject** and use a **premium
confirm on the destructive direction only** (`MyIOLibrary.openConfirmDialog`):

| Action | Direction | Confirm? |
|---|---|---|
| **Monitoramento → OFF** | destructive (stop probing) | **Yes** (confirm) |
| **Monitoramento → ON** | non-destructive | No |
| **Status → INACTIVE** (deactivate) | destructive | **Yes** (confirm) |
| **Status → ACTIVE** (activate) | non-destructive | **No by default** — host may require one via policy/prop |

Flow for a toggle:

1. User flips the slider; the card immediately shows the new position
   (optimistic).
2. If the direction is destructive (or the host forces a confirm), the card
   opens `openConfirmDialog`. On cancel/dismiss, the slider snaps back and no
   callback fires.
3. The card calls the host callback (a `Promise`); the slider is disabled while
   in flight.
4. On resolve, the card keeps the new position. On reject, it reverts and
   surfaces the error (the host may also show a toast).

The card never talks to an endpoint, never checks a permission, never writes an
audit row. It only manages **UI state + confirmation**. Everything real is the
host's callback.

### How both GCDR surfaces consume it

- **Cockpit** (Express-served HTML) already loads the UMD and calls
  `MyIOLibrary.createDivCard`. It swaps the hand-rolled `centralBodyHtml` for
  `MyIOLibrary.createCentralStatusCard({ variant: 'card', showDivergence: true,
  showForceSync: true, … , onMonitoringToggle, onStatusToggle, onForceSync })`,
  wiring the callbacks to its existing `PATCH …/monitoring`, `PATCH …/status`,
  and `POST …/recheck` calls.
- **Customer React page** renders the card through a thin wrapper component that,
  on mount, calls `createCentralStatusCard({ variant: 'compact', showDivergence:
  false, … })` into a `ref`'d `<div>` and, on prop change, calls
  `handle.update(...)`, on unmount `handle.destroy()`. The callbacks call the
  customer API under **JWT/RBAC**, and audit server-side.

Because the card is framework-agnostic vanilla DOM (like `createDivCard`), the
**identical** component runs in both places; only the variant, the
divergence flag, and the callbacks differ.

## Reference-level explanation

### 0. The core, DOM-independent contract: `deriveCentralConnectivity` (build this FIRST)

The single most important — and most-tested — piece of this RFC is a **pure,
DOM-independent function**. It is recommended to implement it **first, as a
standalone helper with its own test suite**, independent of the card, so that:

- the current cockpit `effStatus` can **adopt it immediately** (drop-in), and
  the worker's read-side can align on it, retiring the duplicated rule; and
- the card is a thin consumer of an already-proven function.

```ts
// src/utils/central/deriveConnectivity.ts   (no DOM, no side effects)

export type CentralConnectivity = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'UNKNOWN';

export interface CentralConnectivityEvidence {
  monitoringEnabled: boolean;
  lastCheckAt?: string | null;     // last_gateway_check_at (ISO) — last ATTEMPT
  lastSuccessAt?: string | null;   // last_gateway_success_check_at (ISO) — last SUCCESS (the baseline)
  probeResult?: string | null;     // OK|TIMEOUT|CONN_REFUSED|HTTP_5XX|PARSE_FAIL|AUTH_ERROR|CONFIG_ERROR|null
  canonicalStatus?: string | null; // connection_status — display hint only; NEVER used to assert OFFLINE
}

export interface DeriveConnectivityOptions {
  offlineGraceMs: number;          // input threshold — never hard-coded in the helper
  nowMs?: number;                  // injectable clock; used ONLY for staleness + "since last sync" display
}

export interface CentralConnectivityResult {
  connectivity: CentralConnectivity;
  stale: boolean;                  // derived while monitoring is OFF (data no longer refreshed) → show a "stale" badge
  pastGrace: boolean;              // genuine down AND no success within grace (measured relative to lastCheckAt)
  sinceSuccessMs: number | null;   // for the "último sync há X" line; null when never synced
  reason:
    | 'NEVER_SYNCED'               // no success baseline → UNKNOWN (conservative)
    | 'OK'                         // last attempt succeeded → ONLINE
    | 'WITHIN_GRACE'              // failing but < grace since last success → WARNING
    | 'PAST_GRACE'                // no success ≥ grace → OFFLINE
    | 'MONITORING_OFF_STALE';     // monitoring OFF → last-known connectivity, frozen + stale
}

export function deriveCentralConnectivity(
  ev: CentralConnectivityEvidence,
  opts: DeriveConnectivityOptions,
): CentralConnectivityResult;
```

Rule (read-side; aligns with the cockpit `effStatus` and **reproduces the
worker's `centralVerdict` from stored timestamps**, with one deliberate
divergence — see the first bullet):

- **No success baseline** (`lastSuccessAt` null/absent) → **`UNKNOWN`**
  (`NEVER_SYNCED`), *regardless of `monitoringEnabled`, `probeResult`, or a
  persisted `canonicalStatus === 'OFFLINE'`*. A central that has never once been
  reached is **"not yet known", not "confirmed down"**. This is deliberately more
  conservative than the worker's write-side `centralVerdict` (which may persist
  `OFFLINE` after a failed probe), and it is what stops cold-start /
  freshly-imported centrals (e.g. the RFC-0062 inbox gateways) from a
  **false-OFFLINE storm**.
- **Has a success baseline** (`lastSuccessAt` present) — compute the verdict
  **relative to `lastCheckAt`** (the last observation), NOT the live clock, so it
  reproduces exactly what the worker stored at check time and does not drift as
  wall-clock passes:
  - last attempt was the success (`probeResult === 'OK'`, or `lastCheckAt` ≤
    `lastSuccessAt`) → **`ONLINE`** (`OK`);
  - last attempt failed (`lastCheckAt` > `lastSuccessAt`):
    - `lastCheckAt − lastSuccessAt ≥ offlineGraceMs` → **`OFFLINE`**
      (`PAST_GRACE`, `pastGrace: true`);
    - else → **`WARNING`** (`WITHIN_GRACE`).
- **Monitoring OFF with a success baseline** → keep the **last-known**
  connectivity from the rule above but set **`stale: true`**
  (`MONITORING_OFF_STALE`). Because the verdict is anchored to `lastCheckAt`
  (frozen once checks stop), it does **not** drift to `OFFLINE` merely because
  time passed — the card renders the last known state with a
  "stale / desatualizado" badge and the Monitoramento slider OFF.
- `sinceSuccessMs` = `nowMs − lastSuccessAt` (for the "último sync há X" line);
  `null` when never synced. The live clock (`nowMs`) is used **only** for this
  display value and the `stale` badge — **never** for the
  ONLINE/WARNING/OFFLINE verdict.
- `canonicalStatus` is a **display hint only** (e.g. seeding a badge before
  evidence loads); it must **never** promote a central to `OFFLINE` in the
  absence of a success baseline.

`accentFor` mapping (matching the cockpit): `ONLINE→emerald`, `OFFLINE→rose`,
`WARNING→amber`, `UNKNOWN→slate`. The `stale` flag is orthogonal to the accent —
it renders as a separate badge, so a stale `ONLINE` still reads emerald + "stale".

It is **pure**: input = raw evidence + grace threshold (+ optional injected
clock), output = a small `CentralConnectivityResult` object, no DOM, no I/O. This
is what makes it trivially and exhaustively testable, and safe for the
cockpit/worker to adopt before the card exists. The card consumes
`result.connectivity` for the accent and `result.stale` for the badge.

### Component name & location

**Chosen name:** `createCentralStatusCard` (factory, mirroring `createDivCard` /
`createCustomerGoalsCard`).

Proposed source layout (mirrors the versioned card convention already used by
`customer-goals/v1.0.0`):

```
src/components/cards/central-status/v1.0.0/
  CentralStatusCard.ts   // the factory + DOM handle
  types.ts               // CreateCentralStatusCardParams, CentralStatusCardHandle, enums
  styles.ts              // injected CSS (single <style id="myio-central-status-card-styles">)
  index.ts               // re-exports createCentralStatusCard + types

src/utils/central/deriveConnectivity.ts   // the pure helper (built FIRST, §0)
```

### `src/index.ts` export line (to add)

Add, next to the existing `createDivCard` block (around line 303-304 of
`src/index.ts`):

```ts
// RFC-0231: Central Status Card — shared vanilla card for the orchestrator-devices
// cockpit and the customer centrals list (derived connectivity + Monitoramento/Status
// sliders, grouped into Operação/Cadastro blocks). Auth/audit are host-provided callbacks.
export { createCentralStatusCard } from './components/cards/central-status/v1.0.0';
export type {
  CreateCentralStatusCardParams,
  CentralStatusCardHandle,
  CentralStatusCardVariant,
  CentralConnectivity,
  CentralEntityStatus,
  CentralProbeVerdict,
  CentralDeviceCounts,
  CentralDivergence,
  CentralStatusCardLabels,
} from './components/cards/central-status/v1.0.0';

// RFC-0231: pure, DOM-independent grace-window derivation so cockpit/worker/frontend/card
// all agree. Recommended to ship FIRST and let the cockpit effStatus adopt it.
export { deriveCentralConnectivity } from './utils/central/deriveConnectivity';
export type {
  CentralConnectivityEvidence,
  DeriveConnectivityOptions,
} from './utils/central/deriveConnectivity';
```

### Factory API

```ts
export type CentralConnectivity = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'UNKNOWN';
export type CentralEntityStatus = 'ACTIVE' | 'INACTIVE';
export type CentralStatusCardVariant = 'card' | 'compact';
export type DivCardAccent =            // reuse the createDivCard accent vocabulary
  | 'rose' | 'amber' | 'blue' | 'sky' | 'emerald' | 'violet' | 'slate' | 'none';

export interface CentralProbeVerdict {
  /** Plain-language label, e.g. "Respondendo", "Sem resposta", "Erro de configuração". */
  label: string;
  /** Chip severity for styling. */
  tone: 'ok' | 'warn' | 'bad' | 'muted';
  /** Optional latency in ms (shown as a muted suffix). */
  latencyMs?: number | null;
}

export interface CentralDeviceCounts {
  total: number;
  online: number;
  offline: number;
  unknown: number;   // remainder (mostly CENTRAL_UNREACHABLE cascade), NOT offline
}

export interface CentralDivergence {
  current: string;    // canonical status
  proposed: string;   // worker-proposed status
}

/** i18n overrides — every human string the card renders. All optional. */
export interface CentralStatusCardLabels {
  operationBlock?: string;    // "Operação"
  registryBlock?: string;     // "Cadastro"
  connectivity?: string;      // "conectividade"
  monitoring?: string;        // "Monitoramento"
  status?: string;            // "Status"
  forceSync?: string;         // "Atualizar evidência"
  lastAttempt?: string;       // "última tentativa"
  lastSuccess?: string;       // "último sucesso"
  connectionTest?: string;    // "teste de conexão"
  devices?: string;           // "dispositivos"
  divergence?: string;        // "divergência"
  connectivityValue?: Partial<Record<CentralConnectivity, string>>;
  confirmMonitoringOff?: { title: string; message: string; confirm: string; cancel: string };
  confirmDeactivate?: { title: string; message: string; confirm: string; cancel: string };
  confirmActivate?: { title: string; message: string; confirm: string; cancel: string };
  // {name} is interpolated in confirm messages.
}

export interface CreateCentralStatusCardParams {
  /** Mount target — the card appends itself here (like CustomerGoalsCard's `container`). */
  container?: HTMLElement;

  // ── identity & presentation ──────────────────────────────────────────────
  id: string;
  name: string;
  /** Density. 'card' (default) = full grid card; 'compact' = row-dense for tables. */
  variant?: CentralStatusCardVariant;
  /** Accent override; when omitted it is derived from connectivity (health). */
  accent?: DivCardAccent;

  // ── connectivity: pass EITHER the derived value OR the raw evidence ───────
  /** Pre-derived connectivity (host called deriveCentralConnectivity itself and
   *  passes result.connectivity). */
  derivedConnectivity?: CentralConnectivity;
  /** Pre-derived stale flag (result.stale) — renders the "stale/desatualizado"
   *  badge. Only meaningful alongside `derivedConnectivity`. */
  derivedStale?: boolean;
  /** If `derivedConnectivity` is absent, the card calls deriveCentralConnectivity
   *  on this and uses BOTH result.connectivity and result.stale. */
  connectivityEvidence?: CentralConnectivityEvidence;
  /** Grace threshold (ms) for the derivation path. */
  offlineGraceMs?: number;

  // ── OPERAÇÃO block state ─────────────────────────────────────────────────
  monitoringEnabled: boolean;
  lastAttemptAt?: string | null;   // ISO
  lastSuccessAt?: string | null;   // ISO
  probeVerdict?: CentralProbeVerdict | null;
  deviceCounts?: CentralDeviceCounts | null;
  divergence?: CentralDivergence | null;
  /** Show the divergência row. Default: false (cockpit passes true; customer keeps it hidden). */
  showDivergence?: boolean;
  /** Show the 🔄 force-sync button (default: false; cockpit passes true). */
  showForceSync?: boolean;

  // ── CADASTRO block state ─────────────────────────────────────────────────
  entityStatus: CentralEntityStatus;

  // ── behaviour toggles ────────────────────────────────────────────────────
  /** Disable the Monitoramento slider (e.g. no permission). Default: false. */
  monitoringReadonly?: boolean;
  /** Disable the Status slider (e.g. no permission). Default: false. */
  statusReadonly?: boolean;
  /** Require a confirm on the non-destructive Status→ACTIVE direction too. Default: false. */
  confirmStatusActivate?: boolean;
  theme?: 'light' | 'dark';
  labels?: CentralStatusCardLabels;
  /**
   * Decorative icon overrides per row (string glyph or HTMLElement slot). Icons
   * are NEVER the sole semantic signal (see Accessibility / "icons are
   * decorative"). Omit to use the theme defaults; pass `false`/'' to render none.
   */
  icons?: Partial<Record<
    'connectivity' | 'monitoring' | 'status' | 'forceSync' | 'lastAttempt'
      | 'lastSuccess' | 'probe' | 'devices' | 'divergence',
    string | HTMLElement | false
  >>;

  // ── host callbacks (auth/audit live HERE, not in the card) ───────────────
  // All callbacks receive a typed EVENT OBJECT (never positional args), so hosts
  // can audit/log uniformly. Resolve = keep the optimistic state; reject = revert.
  /** Persist the Monitoramento flag (boolean: next = true means monitoring ON). */
  onMonitoringToggle?: (e: CentralMonitoringToggleEvent) => Promise<void>;
  /** Persist the Status flag ('ACTIVE' | 'INACTIVE' string union — never a boolean). */
  onStatusToggle?: (e: CentralStatusToggleEvent) => Promise<void>;
  /** Optional force re-probe. On resolve the host calls handle.update(...) with fresh evidence. */
  onForceSync?: (e: CentralStatusCardForceSyncEvent) => Promise<void>;
}

/**
 * Event passed to onMonitoringToggle. `next` is the requested state, `previous`
 * the state before the flip (so the host can log the transition).
 */
export interface CentralMonitoringToggleEvent {
  id: string;
  next: boolean;          // true = monitoring ON
  previous: boolean;
  source: 'central-status-card';
}

/**
 * Event passed to onStatusToggle. The registry lifecycle uses an explicit string
 * union — never a boolean — so there is no ambiguity about what the flag means.
 */
export interface CentralStatusToggleEvent {
  id: string;
  next: 'ACTIVE' | 'INACTIVE';
  previous: 'ACTIVE' | 'INACTIVE';
  source: 'central-status-card';
}

export interface CentralStatusCardForceSyncEvent {
  id: string;
  source: 'central-status-card';
}
```

### DOM handle & structure

Handle mirrors `CustomerGoalsCard` (`el`/`update`/`setThemeMode`/`destroy`)
because a central status card is poll-driven data, re-rendered on each refresh:

```ts
export interface CentralStatusCardHandle {
  el: HTMLElement;
  update(patch: Partial<CreateCentralStatusCardParams>): void;
  setThemeMode(mode: 'light' | 'dark'): void;
  setMonitoring(next: boolean): void;             // programmatic (tests / external sync)
  setStatus(next: CentralEntityStatus): void;
  destroy(): void;
}
```

DOM skeleton (the two blocks are the load-bearing structure — separate
`<section>`s, each with its own header, so Operação and Cadastro never read as
equivalent). **Every interactive control is a real focusable element** (a real
`<input type="checkbox" role="switch">` or a `<button>`, never a clickable
`<div>`) with an `aria-label` and, for the sliders, `aria-checked` reflecting
state — see Accessibility. **Icons shown below are decorative placeholders only**
(see "Icons are decorative, not semantic"):

```html
<article class="myio-cscard myio-cscard--card">        <!-- or --compact -->
  <header class="myio-cscard__title">…name…</header>

  <section class="myio-cscard__block myio-cscard__block--operation"
           aria-label="Operação">
    <div class="myio-cscard__block-head">Operação</div>

    <div class="myio-cscard__row myio-cscard__connectivity">
      <span class="myio-cscard__ico" aria-hidden="true"><!-- decorative --></span>
      <span class="myio-cscard__label">conectividade</span>
      <span class="myio-cscard__badge" role="status">ONLINE</span>   <!-- text is the signal -->
    </div>

    <div class="myio-cscard__row myio-cscard__monitoring">
      <span class="myio-cscard__label" id="mon-lbl-{id}">Monitoramento</span>
      <button type="button" class="myio-cscard__force" aria-label="Atualizar evidência">
        <span aria-hidden="true"><!-- decorative --></span></button>
      <input type="checkbox" role="switch" class="myio-cscard__switch"
             aria-labelledby="mon-lbl-{id}" aria-checked="true">
      <span class="myio-cscard__switch-text">on</span>              <!-- text state, not just the knob -->
      <span class="myio-cscard__err" role="alert" aria-live="assertive" hidden></span>
    </div>

    <div class="myio-cscard__row myio-cscard__last-attempt">…</div>
    <div class="myio-cscard__row myio-cscard__last-success">…</div>
    <div class="myio-cscard__row myio-cscard__probe">…verdict (text)…</div>
    <div class="myio-cscard__row myio-cscard__devices">…total·on·off·unk…</div>
    <div class="myio-cscard__row myio-cscard__divergence">…</div> <!-- only if showDivergence -->
  </section>

  <section class="myio-cscard__block myio-cscard__block--registry"
           aria-label="Cadastro">
    <div class="myio-cscard__block-head">Cadastro</div>
    <div class="myio-cscard__row myio-cscard__status">
      <span class="myio-cscard__label" id="st-lbl-{id}">Status</span>
      <input type="checkbox" role="switch" class="myio-cscard__switch"
             aria-labelledby="st-lbl-{id}" aria-checked="false">
      <span class="myio-cscard__switch-text">INACTIVE</span>
      <span class="myio-cscard__err" role="alert" aria-live="assertive" hidden></span>
    </div>
  </section>
</article>
```

In `variant: 'compact'`, the two `__block`s lay out horizontally and the
evidence rows (last-attempt/last-success/probe/devices) collapse into a single
condensed line or a tooltip — but `__connectivity`, `__monitoring`, and
`__status` **remain inline, focusable, and interactive** (no control is hidden by
density).

### The callback split (auth/audit are NOT in the card)

The card owns **only** presentation and interaction:

- optimistic slider move;
- premium confirm (`openConfirmDialog`) per the confirmation matrix above —
  dismiss/cancel snaps the slider back;
- disable-during-flight;
- **revert-on-reject** and error surfacing.

The **host** owns everything trust-related — it supplies
`onMonitoringToggle` / `onStatusToggle` / `onForceSync`, each of which receives a
**typed event object** rather than positional args: `onMonitoringToggle` gets
`{ id, next: boolean, previous: boolean, source }`, `onStatusToggle` gets
`{ id, next: 'ACTIVE'|'INACTIVE', previous: 'ACTIVE'|'INACTIVE', source }` (a
string union, never a boolean), and `onForceSync` gets `{ id, source }` — so the
host can audit/log the transition uniformly. Inside those callbacks the host
does:

- the real endpoint (`PATCH …/monitoring`, `PATCH …/status`, `POST …/recheck`);
- the auth model (cockpit: admin-password gate for now; customer page: JWT/RBAC
  scoped to the central's customer);
- the audit write (using `e.previous → e.next` from the event).

A rejected promise is the contract for "the write failed / was forbidden" — the
card reverts the slider to `e.previous`, sets `aria-busy="false"`, re-enables the
control, and renders a local, announced error next to it (see Accessibility); it
never assumes success. On `onForceSync` resolve, the host re-renders fresh
evidence via `handle.update(...)` (the callback returns `void`, not a patch).

### Accessibility (hard requirement)

Both sliders and every button are **real, focusable controls** — never a
clickable `<div>`. The contract:

- **Real elements.** Each slider is a real `<input type="checkbox" role="switch">`
  (or a `<button role="switch">`); force-sync and any action is a `<button>`.
- **`aria-label` / labelling.** Every control has an accessible name
  (`aria-label` or `aria-labelledby` pointing at its visible label).
- **`aria-checked` reflects state.** The sliders expose `aria-checked="true|false"`
  kept in sync with the model on every change/optimistic move/revert.
- **Keyboard.** Fully operable by keyboard: the control is in the tab order, and
  **Space and Enter toggle** it. The premium confirm (`openConfirmDialog`)
  already traps focus and supports Esc/Tab.
- **Visible focus ring.** A clear, non-color-only focus indicator on every
  control (never `outline: none` without a replacement).
- **In-flight state.** While a write is pending the control is `disabled` and
  `aria-busy="true"`; both clear on resolve/reject.
- **Local, announced errors.** On callback rejection, a per-control error message
  renders next to that control in a live region (`role="alert"` /
  `aria-live="assertive"`), so the failure is announced — not just a global
  toast, and not silent.
- **Not color-only.** Connectivity and slider state are conveyed as **text**
  (e.g. `ONLINE`, `on`/`off`, `ACTIVE`/`INACTIVE`) in addition to any color or
  icon, so color-blind and screen-reader users get the state.

These requirements apply to **both** `variant: 'card'` and `variant: 'compact'`
(density must not drop focusability, labels, or the error region).

### Icons are decorative, not semantic

**Icons (including the emojis used throughout this document's diagrams) are
decorative, not semantic.** The component contract must not depend on any
specific glyph:

- Every state is conveyed by **text and `aria`** on its own; an icon is at most a
  redundant visual aid. Removing all icons must leave the card fully usable and
  understandable.
- Decorative icons are marked `aria-hidden="true"` and are **never** the sole
  signal for connectivity, monitoring, status, or probe verdict.
- Icons are **configurable by the host/theme** — either a string prop or a slot
  per icon-bearing row (e.g. `labels`/`icons` overrides) — with sensible,
  overridable defaults; the library ships no hard dependency on a particular
  emoji or icon font.
- The emojis in the ASCII diagrams and code comments above are **illustrative
  placeholders**, not part of the spec. The showcase MAY use emojis for flavor;
  the component's tests assert on text/`aria`, never on emoji presence.

### Consumption & CDN safety (MANDATORY for a card with write callbacks)

This card carries **write callbacks** (monitoring/status/force-sync). A page that
can be tricked into loading a malicious build of the card can be tricked into
issuing writes. **No surface that mounts this card may load it from a floating
`@latest`.** (Lesson from GCDR PR #55, where an `@latest` include on a page with
write callbacks was an SSRF/supply-chain hazard.)

- **Cockpit (script-tag / UMD).** Load a **pinned exact version with SRI**
  (`<script src=".../myio-js-library@X.Y.Z/dist/myio-js-library.umd.min.js"
  integrity="sha384-…" crossorigin="anonymous">`), **or** vendor a local/pinned
  bundle served from the app's own origin. Never `@latest`, never an unpinned
  tag, on any page wired with `onMonitoringToggle`/`onStatusToggle`.
- **Frontend (React / bundler).** Consume it as a **normal pinned npm
  dependency** (exact or lockfile-pinned version), bundled at build time — no
  runtime CDN fetch.

State explicitly in both integration PRs: the version is pinned, and there is no
floating `@latest` anywhere the card's write callbacks are wired.

### Showcase

Following the **exact** `showcase/main-view-shopping/` convention — a
per-component folder with a `.bat`/`.sh` launcher pair that `npx serve`s the
**repo root** and opens the folder's `index.html`, which loads the compiled UMD
via a `../../dist/...` relative path:

```
showcase/central-status-card/
  index.html          // loads ../../dist/myio-js-library.umd.min.js, builds sample cards + controls
  start-server.bat    // set PORT=3343; kill port; cd /d "%~dp0..\.."; npx serve . -p 3343; open /showcase/central-status-card/
  start-server.sh
  stop-server.bat     // kill whatever listens on 3343 (Get-NetTCPConnection + netstat/taskkill)
  stop-server.sh
  README.md           // reconstruction spec (same style as main-view-shopping/README.md)
```

`index.html` must:

- load `../../dist/myio-js-library.umd.min.js` (paths are `../../`-relative
  because the server roots at the repo, exactly like `loading-spinner/index.html`
  and `main-view-shopping/index.html`);
- guard for `typeof MyIOLibrary !== 'undefined' &&
  MyIOLibrary.createCentralStatusCard` and log a "did you run `npm run build`?"
  error otherwise (loading-spinner pattern);
- render **both variants** (`'card'` grid + a `'compact'` row list) covering
  every state (ONLINE / WARNING / OFFLINE / UNKNOWN, monitored/unmonitored,
  ACTIVE/INACTIVE, with/without divergence, never-probed);
- provide mock `onMonitoringToggle` / `onStatusToggle` / `onForceSync` callbacks
  (resolve after a delay; a "force reject" checkbox to demo revert-on-reject and
  the premium confirm), plus toggles for `showDivergence`, `confirmStatusActivate`,
  a light/dark switch, and an event log.

**`.bat` launcher name:** `start-server.bat` (+ `stop-server.bat`) in
`showcase/central-status-card/`, **port `3343`** (loading-spinner uses 3333,
main-view-shopping 3339 — 3343 is free).

`start-server.bat` (following the two real examples verbatim in shape):

```bat
@echo off
set PORT=3343
echo Stopping any existing server on port %PORT%...
powershell -Command "Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% "') do ( taskkill /PID %%a /F 2>nul )
echo Starting HTTP server on port %PORT%...
cd /d "%~dp0..\.."
start "" npx serve . -p %PORT%
timeout /t 2 /nobreak >nul
echo Open showcase at: http://localhost:%PORT%/showcase/central-status-card/
start "" "http://localhost:%PORT%/showcase/central-status-card/"
```

### Tests plan

The **pure helper is the most-tested piece** and is tested independently of the
card. Following `tests/components/cards/` + `tests/utils/` layout and the
`customer-goals` conventions (vitest, jsdom for the card; no DOM for the helper):

```
tests/utils/central/deriveConnectivity.test.ts        // PURE — exhaustive, DOM-free (build FIRST)
tests/components/cards/central-status/centralStatusCard.test.ts
```

`deriveConnectivity.test.ts` (the priority suite) — a pure-function table
covering **every** combination, with an injected `nowMs`:

- never monitored + never probed → `UNKNOWN`;
- monitored, no `probeResult` → falls back to `canonicalStatus` (and to
  `UNKNOWN` when that too is absent);
- `probeResult === 'OK'` → `ONLINE`;
- each failing `probeResult` (`TIMEOUT`, `CONN_REFUSED`, `HTTP_5XX`,
  `PARSE_FAIL`, `AUTH_ERROR`, `CONFIG_ERROR`) with `lastSuccessAt` **within**
  grace → `WARNING`; **at/after** grace → `OFFLINE`; and `lastSuccessAt` null →
  `OFFLINE`;
- exact grace-boundary equality (`sinceSuccess === offlineGraceMs`) is `OFFLINE`;
- parity assertion: same inputs produce the same output the cockpit `effStatus`
  would (guards adoption).

`centralStatusCard.test.ts` cases:

- **renders** the two blocks (Operação / Cadastro) as separate sections with
  their headers; connectivity badge + Monitoramento slider + force-sync live in
  Operação, Status slider lives in Cadastro;
- **variant**: `'card'` renders full evidence rows; `'compact'` still renders the
  connectivity badge and **both** sliders inline (controls not hidden) while
  collapsing evidence rows;
- **derives** connectivity from `connectivityEvidence` + `offlineGraceMs` when
  `derivedConnectivity` is omitted (delegates to `deriveCentralConnectivity`);
- **event-object callbacks**: each callback is invoked with a single typed
  object — `onMonitoringToggle` receives
  `{ id, next: boolean, previous: boolean, source: 'central-status-card' }`
  (`next: true` = monitoring ON), `onStatusToggle` receives
  `{ id, next: 'ACTIVE'|'INACTIVE', previous: 'ACTIVE'|'INACTIVE', source }`
  (string union, **never a boolean**), and `onForceSync` receives
  `{ id, source: 'central-status-card' }`; assert `previous` is the pre-flip
  state and `next` the requested one; **no positional args** are passed;
- **confirmation matrix**: monitoring OFF → confirm; monitoring ON → no confirm;
  status INACTIVE → confirm; status ACTIVE → no confirm by default;
  `confirmStatusActivate: true` → confirm on activate too;
- **cancel** on a confirm reverts the slider (and `aria-checked`) and does **not**
  call the callback; **confirm** calls the right callback with the right event;
- **revert-on-reject**: a rejecting callback leaves the slider (and `aria-checked`)
  in its original position, clears `aria-busy`, re-enables the control, and
  renders the local `role="alert"` error next to it;
- **accessibility**: sliders are real `role="switch"` inputs with an accessible
  name and `aria-checked` tracking state; Space/Enter toggle via keyboard;
  controls are `disabled` + `aria-busy="true"` while a write is in flight and
  cleared afterward; state is present as **text** (`on`/`off`,
  `ACTIVE`/`INACTIVE`, connectivity value), and assertions target text/`aria` —
  **never** emoji/icon presence; both variants meet these;
- **icons decorative**: rendering with icons removed/overridden leaves every
  state readable via text/`aria` (no assertion depends on a glyph);
- **slider disabled during flight** (no double-submit);
- `monitoringReadonly` / `statusReadonly` disable the respective sliders;
- `showForceSync` renders 🔄 and calls `onForceSync(id)`; a returned evidence
  patch re-renders the card;
- `showDivergence` gates the divergência row (present in cockpit config, absent
  in customer config);
- optional rows (`probeVerdict`, `deviceCounts`) omitted when absent;
- `update(patch)` re-renders keeping the same root element;
- `setThemeMode('dark')` flips the theme attribute;
- `destroy()` removes the element and listeners;
- degrades gracefully when `MyIOLibrary.openConfirmDialog` is unavailable
  (native `confirm()` fallback, mirroring the cockpit's `confirmAction`).

### GCDR integration point #1 — cockpit (real paths)

`gcdr.git/src/controllers/admin/orchestrator-devices-admin.controller.ts`

- **First**, have `effStatus` (lines ~693-701) adopt the shared
  `deriveCentralConnectivity` helper (§0), decoupled from the card — a small,
  independently-shippable change.
- **Then replace** the hand-rolled body (`centralBodyHtml`, lines ~770-786) and
  the `createDivCard` shell in `renderCentralsGrid` (lines ~791-807) with
  `MyIOLibrary.createCentralStatusCard({ variant: 'card', showDivergence: true,
  showForceSync: true, … })`.
- Map existing fields → params: `effStatus(c)` → `derivedConnectivity` (or pass
  `connectivityEvidence` + `OFFLINE_GRACE_MS`), `c.monitoring_enabled` →
  `monitoringEnabled`, the central's `status` → `entityStatus`,
  `c.last_gateway_check_at` / `c.last_gateway_success_check_at` →
  `lastAttemptAt`/`lastSuccessAt`, `probeVerdict(c)` → `probeVerdict`,
  `devStat(c)` counts → `deviceCounts`, `cDivMap[c.id]` → `divergence`.
- Wire callbacks (each now receives an **event object**) to the existing
  handlers: `toggleMonitoring` (lines ~726-738) → `onMonitoringToggle(e)` using
  `e.id`/`e.next`; `forceSync` (lines ~739-752, `POST …/recheck`) →
  `onForceSync(e)` using `e.id`, then `handle.update(...)` with the fresh
  evidence (instead of the callback returning a patch); and a **new**
  `onStatusToggle(e)` calling the central status endpoint with the
  `e.next` string (`'ACTIVE'`/`'INACTIVE'`). Audit uses `e.previous → e.next`.
  The existing
  `confirmAction`/`msgDialog` (which already call `MyIOLibrary.openConfirmDialog`)
  move *into* the card; the controller just provides the promises.
- Keep the existing `centralCard` string fallback for when the UMD global is
  absent (the controller already degrades — lines ~787-789, ~1076-1079).
- Load the UMD **pinned + SRI** (or vendored local) — see Consumption safety.

### GCDR integration point #2 — customer centrals list (real paths)

`gcdr-frontend.git/src/components/customers/CustomerCentralsTab.tsx` (and the
`useAllCentrals` hook it uses).

- **Replace** the table rows (or the whole `<Table>`) with a grid/list of
  `variant: 'compact'` cards via a thin React wrapper: `useRef` a `<div>`,
  `createCentralStatusCard(...)` on mount, `handle.update(...)` on prop change,
  `handle.destroy()` on unmount.
- **Fixes the misleading Conexão column** (today
  `ConnectionStatusBadge status={central.connectionStatus}`, line ~210) by
  showing **derived** connectivity from probe evidence instead of the stale
  canonical `connection_status`.
- **Adds** the Monitoramento slider and **converts** the Status column into a
  slider — but as one shared card with two clearly-separated blocks, not three
  separate column patches.
- Pass `showDivergence: false` — divergência is cockpit-only by default.
- `onMonitoringToggle`/`onStatusToggle` (event-object callbacks) call the
  customer API under **JWT/RBAC** scoped to the central's customer, and audit
  server-side using `e.previous → e.next`. Consume the library as
  a **pinned npm dependency** (no `@latest`) — see Consumption safety.
- The precise GCDR-side endpoints/permissions/serializer changes are **out of
  scope for this library RFC** and will be specified in a separate, correctly-
  numbered GCDR integration RFC.

## Drawbacks

- **A control component in a shared UI library.** The card is the trust boundary
  for two write actions. The split (card = UI/confirm, host = endpoint/auth/audit)
  must stay disciplined; the callback-only contract is deliberately the *only*
  way to perform a write. Combined with the CDN-pinning requirement, hosts carry
  real responsibility.
- **Two variants + two blocks to keep consistent.** More layout surface to build
  and test than a single flat card.
- **Two data shapes to map.** The card's params must map cleanly to both the
  cockpit's snake_case central row and the frontend's `Central` type.
- **Vocabulary.** `WARNING` as a *connectivity* value is new to customer users
  (canonical enum is `ONLINE|OFFLINE|DEGRADED|MAINTENANCE`) — needs a clear
  label + tooltip.
- Another versioned component to maintain, build, and document.

## Rationale and alternatives

- **Shared vanilla card vs. per-surface patches.** Patching the customer tab in
  place (three column edits) leaves the cockpit's parallel implementation
  untouched → the two surfaces keep drifting. A shared card fixes the tab **and**
  de-duplicates the cockpit. Cost: a slightly larger up-front component + a React
  wrapper.
- **Pure helper first.** Landing `deriveCentralConnectivity` as a standalone,
  exhaustively-tested function lets the cockpit/worker adopt it *before* the card
  exists, immediately removing the duplicated grace rule and de-risking the card
  (it just consumes a proven function).
- **Two blocks (Operação/Cadastro) vs. one flat list.** Monitoramento (probe
  gate) and Status (registry lifecycle) are different concepts; equal-looking
  adjacent sliders invite mistakes. Separate labelled blocks encode the
  distinction in the layout.
- **`compact` variant vs. keeping the React table.** A compact card preserves
  table density while still unifying the implementation and exposing all
  controls inline.
- **Callback-based auth vs. baking RBAC into the card.** A UI library must not
  own auth. Callbacks returning promises keep the card framework- and
  auth-agnostic and let the cockpit (admin-password, for now) and the customer
  page (JWT/RBAC) reuse the *same* pixels with different trust.
- **Derived value vs. raw evidence prop.** Supporting both lets server-side
  derivation and client-side derivation coexist; the shared helper guarantees
  they compute the same thing.
- **Do nothing.** Leaves a knowingly-wrong Conexão column shipping to customers
  and two diverging code paths. Rejected.

## Prior art

- **`createDivCard`** (`src/components/div-card/DivCard.ts`) — the vanilla
  factory idiom this card follows: injected CSS (`STYLE_ID`), a returned DOM
  handle, accent vocabulary, `escAttr`, framework-agnostic.
  `createCentralStatusCard` is a sibling in the same family.
- **`createCustomerGoalsCard`** (`src/components/cards/customer-goals/v1.0.0`) —
  the versioned card layout, `{ el, update, setThemeMode, destroy }` handle, and
  the vitest test conventions this RFC's test plan mirrors.
- **`openConfirmDialog` / `openMessageDialog`**
  (`src/components/premium-modals/dialog/openDialog.ts`) — the premium confirm
  the destructive-direction sliders reuse; promise resolves with the button
  `value` or `null` on dismiss.
- **`InfoTooltip`** — used by `createDivCard` for the (i) tooltip and by the
  cockpit for the devices roll-up; available for the compact variant's collapsed
  evidence tooltip.
- **RFC-0062 cockpit card** — the current hand-rolled central card
  (`centralBodyHtml`, `effStatus`, `accentFor`, `probeVerdict`, `devStat`,
  `.switch` monitoring toggle, `forceSync`) that this component generalizes.
- **RFC-0062 worker** — `centralVerdict`
  (`gcdr.git/src/workers/orchestrator-devices/verdict.ts`), the write-side grace
  rule whose read-side twin becomes `deriveCentralConnectivity`.
- Showcase prior art: `showcase/main-view-shopping/` (the `.bat`/root-serve
  convention + reconstruction-spec README) and `showcase/loading-spinner/` (the
  simple single-component UMD showcase).

## Unresolved questions

**Resolved (2026-09-02, GCDR review) — encode these in the helper:**

- **Never-synced central → `UNKNOWN`, not `OFFLINE`.** When there is no success
  baseline (`lastSuccessAt` absent), the read-side helper returns `UNKNOWN` even
  if monitoring is ON and even if a persisted `canonicalStatus` says `OFFLINE`.
  This deliberately diverges from the worker's write-side and fixes the observed
  false-OFFLINE on freshly-imported gateways. (See §0, first rule bullet.)
- **Monitoring OFF with a past sync → last-known connectivity + `stale`.** The
  card shows the frozen last-known verdict (anchored to `lastCheckAt`, so it does
  not drift to `OFFLINE`) plus a `stale` badge, not `UNKNOWN`. (See §0.)

Still open:

- **Auth model for the toggles.** RFC-0062 gates cockpit controls behind
  `DB_ADMIN_PASSWORD` as a *temporary* internal measure (RFC-0062 §7) and defers
  the real RBAC model. The card is neutral (host callbacks), but the **hosts**
  must settle it: does the customer wrapper require a distinct permission (e.g.
  `centrals.monitoring.manage`) from the cockpit's gate? Resolved in the GCDR
  integration RFC, not here.
- **Where derivation lives.** Compute `derivedConnectivity` server-side (one
  source of truth for all consumers incl. mobile) vs. client-side in the card via
  `deriveCentralConnectivity`. The card supports both; which does GCDR ship first?
- **Status↔Monitoramento coupling.** Should deactivating a monitored central
  auto-disable monitoring (and should the card express that, or is it host
  policy)?
- **Compact evidence disclosure.** Tooltip vs. expandable row for the collapsed
  evidence in `compact` — needs a UX pass.
- **Versioning/placement.** `cards/central-status/v1.0.0` (this proposal) vs. a
  top-level `components/central-status-card/` like `div-card/`.

## Future possibilities

- A **connectivity history / last-seen** sparkline or tooltip per central.
- Guarded **bulk** Monitoramento/Status controls at the customer level, once the
  RFC-0062 fleet-storm lessons (scope to ACTIVE, strong confirm) are encoded.
- Reusing `deriveCentralConnectivity` in non-web consumers (mobile,
  integrations) so every surface agrees on connectivity.
- Retiring the cockpit's hand-rolled `centralBodyHtml`/`centralCard` fallback
  entirely once the shared card is the single implementation.
