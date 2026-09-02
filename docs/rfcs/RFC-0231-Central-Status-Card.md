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
  lastCheckAt?: string | null;     // last_gateway_check_at (ISO)
  lastSuccessAt?: string | null;   // last_gateway_success_check_at (ISO)
  probeResult?: string | null;     // OK|TIMEOUT|CONN_REFUSED|HTTP_5XX|PARSE_FAIL|AUTH_ERROR|CONFIG_ERROR|null
  canonicalStatus?: string | null; // connection_status (fallback when never probed)
}

export interface DeriveConnectivityOptions {
  offlineGraceMs: number;          // input threshold — never hard-coded in the helper
  nowMs?: number;                  // injectable clock for deterministic tests
}

export function deriveCentralConnectivity(
  ev: CentralConnectivityEvidence,
  opts: DeriveConnectivityOptions,
): CentralConnectivity;
```

Rule (identical to the cockpit `effStatus` and the read-side of the worker's
`centralVerdict`):

- not monitored **and** never probed → `UNKNOWN`;
- no `probeResult` → fall back to `canonicalStatus` (or `UNKNOWN`);
- `probeResult === 'OK'` → `ONLINE`;
- otherwise: no successful sync for `≥ offlineGraceMs` → `OFFLINE`, else
  `WARNING`.

`accentFor` mapping (matching the cockpit): `ONLINE→emerald`, `OFFLINE→rose`,
`WARNING→amber`, `UNKNOWN→slate`.

It is **pure**: input = raw evidence + grace threshold (+ optional injected
clock), output = one of four enum values, no DOM, no I/O. This is what makes it
trivially and exhaustively testable, and safe for the cockpit/worker to adopt
before the card exists.

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
  derivedConnectivity?: CentralConnectivity;
  /** If `derivedConnectivity` is absent, the card calls deriveCentralConnectivity on this. */
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
