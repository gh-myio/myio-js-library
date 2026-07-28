/**
 * RFC-0228 A2b — Broad-rollout gate for the R$ money overlay.
 *
 * A2a (`financialIndicators.ts` + the controller `_moneyGate`) answers **one**
 * question: *is the money feature available at all?* — i.e. the operator configured
 * `settings.goalsMoneyApi` AND the library exposes the money symbols
 * (`createGoalsMoneyClient` / `renderFinancialIndicators`). That gate is a single
 * global on/off axis for the whole dashboard.
 *
 * A2b adds the **second axis, per customer**: *is THIS customer eligible for the
 * broad overlay?* The two compose as an **AND**, never a replacement:
 *
 *     money renders  ⇔  (A2a feature available)          ← global, A2a owns it
 *                    ∧  (customer explicitly eligible)   ← A2b layer (b)
 *                    ∧  (coverage is sane, not broken)   ← A2b layer (c)
 *
 * This module owns only the 2nd/3rd axes. It **reuses** A2a's flag (layer (a)) and
 * never re-implements A2a's runtime symbol check — that half is enforced by the
 * caller's existing `_moneyGate` seam (the wiring only reaches A2b once `_moneyGate`
 * already passed). See `routeMoneyRender` / `renderGatedMoney` for the composition.
 *
 * ── WHY THE PRODUCTION BASE DEFAULTS OFF (the "sem B1" reality made safe) ─────────
 * RFC-0228 index §Track B: without GCDR **B1** (money for *customer-granular* goals),
 * `?withMoney=true` requires a **device-granular** goal, and the majority of the
 * production base is customer-granular → the overlay would resolve to
 * `MONEY_REQUIRES_DEVICE_GRANULARITY` / `coverageComplete:false` for most customers.
 * So enabling money **base-wide today would show "sem cobertura" to the majority.**
 *
 * A2b makes that safe by defaulting eligibility **OFF for everyone**: only customers
 * an operator has **explicitly** curated (device-granular, allowlisted) turn on. The
 * pilot (A2a) stays valid for those curated customers; the broad base stays dark and
 * honest until curated — never a broken overlay, never fabricated R$.
 *
 * ── B1 / B2 DEPENDENCY (backend, GCDR repo — NOT built here) ─────────────────────
 * Broad, base-wide enablement is blocked on the **GCDR B1 fork decision** (default a
 * per-customer `tariff_category` × curate goals to device-granular × hybrid), which
 * itself waits on **B2** (measuring how many production goals are device-granular).
 * Both are GCDR deliverables. Until B1 lands, eligibility here is **allowlist/curated
 * only**. When B1 ships, flipping to base-wide is a **one-line policy change**:
 * set `settings.goalsMoneyRolloutBaseWide = true` (or put `'*'` in the allowlist) —
 * see {@link isCustomerEligible}. Nothing else in this module changes.
 *
 * Design rules (mirroring F0/A2a/A4 on this branch):
 *  - **Pure / declarative.** No `fetch`, no ThingsBoard, no `window`, no DOM here
 *    (the element convenience `renderGatedMoney` only *invokes* injected renderers).
 *  - **Eligibility is injected, never inferred.** The allowlist/curated source comes
 *    from an explicit param or a settings attribute — never derived from the
 *    customer's name, domain, or size (RFC-0207 explicit-only discipline).
 *  - **Ineligible / coverage-gap ⇒ A4 honest coverage**, never money, never R$ 0.
 */

import type { MoneyOverlay } from './moneyTypes';
import { MONEY_REQUIRES_DEVICE_GRANULARITY } from './moneyTypes';

/**
 * Why the overlay is (not) enabled for a customer:
 *  - `disabled`     — layer (a): the money feature is off globally (A2a gate false).
 *  - `not-eligible` — layer (b): feature on, but the customer is NOT allowlisted /
 *                     curated. **This is the base-wide default** (no inference).
 *  - `coverage-gap` — layer (c): feature on + eligible, but the sampled overlay is
 *                     `unavailable` (no device-granular coverage — the no-B1 case).
 *  - `eligible`     — all three layers pass: render the R$ overlay.
 */
export type MoneyRolloutReason =
  | 'disabled'
  | 'not-eligible'
  | 'coverage-gap'
  | 'eligible';

/** The gate decision — `enabled` is `true` only when `reason === 'eligible'`. */
export interface MoneyRolloutDecision {
  enabled: boolean;
  reason: MoneyRolloutReason;
}

/**
 * Curated/allowlisted customer ids. Explicit ids only, never inferred. The sentinel
 * `'*'` (or {@link MoneyRolloutSettings.goalsMoneyRolloutBaseWide}) flips to base-wide
 * — reserved for **after** GCDR B1 lands.
 */
export type MoneyRolloutAllowlist = string[] | Set<string> | null | undefined;

/**
 * The (small) slice of dashboard `settings` A2b reads. A superset-safe subset of the
 * settings A2a already consumes — passing the whole settings object is fine.
 */
export interface MoneyRolloutSettings {
  /**
   * Layer (a): A2a's global money feature flag (`settings.goalsMoneyApi`). Truthy =
   * the money data source is configured. A2b **reuses** this; it never reinvents it.
   */
  goalsMoneyApi?: unknown;
  /**
   * Layer (b) source: curated/allowlisted customers eligible for the R$ overlay.
   * Explicit ids only. `'*'` = base-wide (post-B1). An explicit `params.allowlist`
   * overrides this.
   */
  goalsMoneyRolloutAllowlist?: MoneyRolloutAllowlist;
  /**
   * The **one-line base-wide flip**, blocked on GCDR **B1**. `true` = every customer
   * is eligible (subject to layers (a) and (c)). Defaults falsy → allowlist-only.
   * **Do not set `true` until B1 ships** or the majority will hit `coverage-gap`.
   */
  goalsMoneyRolloutBaseWide?: boolean;
  [k: string]: unknown;
}

/** Inputs to {@link resolveMoneyRollout} / {@link routeMoneyRender}. */
export interface MoneyRolloutParams {
  /** GCDR customer id under evaluation. Missing/empty → never eligible (unverifiable). */
  customerId?: string | number | null;
  /** Dashboard settings — A2a's `goalsMoneyApi` + A2b's allowlist / base-wide flags. */
  settings?: MoneyRolloutSettings | null;
  /**
   * The **composed A2a gate** result, when the caller already computed `_moneyGate`.
   * When a boolean is supplied it **is** layer (a) and takes precedence over
   * `settings.goalsMoneyApi` — this is how A2b composes with (never duplicates or
   * weakens) A2a's runtime gate. Omit to fall back to the settings flag.
   */
  featureAvailable?: boolean;
  /** Explicit allowlist override (wins over `settings`). Never inferred. */
  allowlist?: MoneyRolloutAllowlist;
  /**
   * A representative money overlay for this customer (F0 {@link MoneyOverlay}). When
   * it is `unavailable` (e.g. `MONEY_REQUIRES_DEVICE_GRANULARITY` — the no-B1
   * reality), layer (c) fails with `coverage-gap`: never surface a broken overlay.
   * Absent → coverage sanity is deferred to per-card A2a/A4 at render time.
   */
  overlaySample?: MoneyOverlay | null;
}

/** Normalize any allowlist shape into a `Set<string>` of trimmed, non-empty ids. */
function normalizeAllowlist(list: MoneyRolloutAllowlist): Set<string> {
  const out = new Set<string>();
  if (!list) return out;
  const iter: Iterable<unknown> = list instanceof Set ? list : Array.isArray(list) ? list : [];
  for (const raw of iter) {
    const id = String(raw ?? '').trim();
    if (id) out.add(id);
  }
  return out;
}

/** A customer id as a trimmed string, or `''` when absent/blank (→ unverifiable). */
function normalizeId(customerId: string | number | null | undefined): string {
  return customerId == null ? '' : String(customerId).trim();
}

/** An overlay is "broken" for rollout purposes when it is explicitly `unavailable`. */
function isBrokenOverlay(overlay: MoneyOverlay | null | undefined): boolean {
  return !!overlay && overlay.state === 'unavailable';
}

/**
 * Layer (b) — **explicit** customer eligibility, defaulting OFF for the whole base.
 *
 * A customer is eligible **only** when one of these explicit operator actions holds:
 *  1. `settings.goalsMoneyRolloutBaseWide === true` — the post-B1 base-wide flip.
 *  2. the allowlist contains the base-wide sentinel `'*'`.
 *  3. the allowlist (param override, else `settings.goalsMoneyRolloutAllowlist`)
 *     contains the customer's id.
 *
 * Everyone else is **not eligible** — including customers with no id (unverifiable →
 * OFF). No customer is ever eligible by inference (name/domain/size): RFC-0207
 * explicit-only discipline. This is the single line that keeps the production base
 * dark until curated, and the single place the base-wide flip lives once B1 lands.
 */
function isCustomerEligible(
  params: MoneyRolloutParams,
  settings: MoneyRolloutSettings | null
): boolean {
  // (1) The one-line base-wide flip (blocked on GCDR B1 today).
  if (settings && settings.goalsMoneyRolloutBaseWide === true) return true;

  const set = normalizeAllowlist(params.allowlist ?? settings?.goalsMoneyRolloutAllowlist);
  // (2) Base-wide sentinel in the allowlist.
  if (set.has('*')) return true;

  // (3) Explicit membership. No id → cannot verify → OFF (never inferred).
  const id = normalizeId(params.customerId);
  if (!id) return false;
  return set.has(id);
}

/**
 * A2b decision: is the R$ money overlay enabled for this customer?
 *
 * The three layers are AND-ed and short-circuit in order so the `reason` names the
 * **first** failing layer:
 *   (a) feature available (A2a) — else `disabled`;
 *   (b) customer eligible (explicit allowlist/curated, default OFF) — else `not-eligible`;
 *   (c) coverage sane (sampled overlay not `unavailable`) — else `coverage-gap`.
 * Only when all three pass: `{ enabled: true, reason: 'eligible' }`.
 */
export function resolveMoneyRollout(params: MoneyRolloutParams): MoneyRolloutDecision {
  const p = params || ({} as MoneyRolloutParams);
  const settings = p.settings ?? null;

  // Layer (a) — global feature flag. The composed A2a gate wins when provided;
  // otherwise the settings half (`goalsMoneyApi`). We deliberately do NOT re-check
  // the MyIOLibrary symbols here — that runtime half is A2a's, enforced by the
  // caller's `_moneyGate` seam. Composition, not duplication.
  const featureAvailable =
    typeof p.featureAvailable === 'boolean'
      ? p.featureAvailable
      : !!(settings && settings.goalsMoneyApi);
  if (!featureAvailable) return { enabled: false, reason: 'disabled' };

  // Layer (b) — explicit customer eligibility. Default OFF for the whole base.
  if (!isCustomerEligible(p, settings)) {
    return { enabled: false, reason: 'not-eligible' };
  }

  // Layer (c) — coverage sanity. A sampled `unavailable` overlay (the no-B1 case)
  // must never surface a broken R$ overlay; route it to the honest A4 path.
  if (isBrokenOverlay(p.overlaySample)) {
    return { enabled: false, reason: 'coverage-gap' };
  }

  return { enabled: true, reason: 'eligible' };
}

/** What a gated money surface should render, from the A2b decision. */
export type MoneyRenderAction = 'render-money' | 'render-coverage' | 'render-nothing';

/** The routing produced by {@link routeMoneyRender}: decision + what to render. */
export interface MoneyRenderRouting {
  decision: MoneyRolloutDecision;
  action: MoneyRenderAction;
  /**
   * The overlay A4 should render when `action === 'render-coverage'`. Always an
   * `unavailable` overlay — the honest coverage state, never a fabricated/partial R$.
   */
  coverageOverlay?: MoneyOverlay;
}

/**
 * The **wiring helper**: turn an A2b decision into a render action for any money
 * surface (indicators / report column / variance / budget view). Pure — no DOM.
 *
 *  - `disabled`     → `render-nothing`. **Byte-identical to pre-A2b**: when the
 *                     feature is off there was no money and no coverage panel, so A2b
 *                     adds nothing either.
 *  - `eligible`     → `render-money` (call the A2a/A3/A6/A7 renderer).
 *  - `not-eligible` /
 *    `coverage-gap` → `render-coverage` with an `unavailable` overlay — route to A4's
 *                     honest coverage state. The sampled overlay is reused when it is
 *                     already `unavailable`; otherwise a canonical
 *                     `MONEY_REQUIRES_DEVICE_GRANULARITY` overlay is synthesized.
 */
export function routeMoneyRender(params: MoneyRolloutParams): MoneyRenderRouting {
  const decision = resolveMoneyRollout(params);

  // Feature off → render nothing at all (byte-identical to the pre-A2b surface).
  if (decision.reason === 'disabled') {
    return { decision, action: 'render-nothing' };
  }

  if (decision.enabled) {
    return { decision, action: 'render-money' };
  }

  // not-eligible | coverage-gap → honest A4 coverage. Never a fabricated overlay.
  const sample = params?.overlaySample;
  const coverageOverlay: MoneyOverlay =
    sample && sample.state === 'unavailable'
      ? sample
      : { state: 'unavailable', reason: MONEY_REQUIRES_DEVICE_GRANULARITY };
  return { decision, action: 'render-coverage', coverageOverlay };
}

/** Injected renderers for {@link renderGatedMoney} — A2a money + A4 coverage. */
export interface GatedMoneyRenderers {
  /**
   * The money renderer (A2a `renderFinancialIndicators`, or A3/A6/A7 equivalents).
   * Called **only** when the decision is `eligible`. Receives the real overlay sample.
   */
  renderMoney: (overlay: MoneyOverlay | null | undefined) => HTMLElement | null;
  /**
   * The A4 honest-coverage renderer (`renderCoverageView`). Called for `not-eligible`
   * and `coverage-gap` with an `unavailable` overlay — never money, never R$ 0.
   */
  renderCoverage: (overlay: MoneyOverlay) => HTMLElement | null;
}

/**
 * Element-level composition helper: resolve the A2b gate and dispatch to the right
 * renderer. This is the seam money-consuming surfaces call **instead of** rendering
 * money directly — it composes A2a and A4 without rewriting either.
 *
 *  - `render-nothing` → returns `null` (feature off; byte-identical to pre-A2b).
 *  - `render-money`   → `renderers.renderMoney(overlaySample)` (A2a et al.).
 *  - `render-coverage`→ `renderers.renderCoverage(unavailableOverlay)` (A4).
 */
export function renderGatedMoney(
  params: MoneyRolloutParams,
  renderers: GatedMoneyRenderers
): HTMLElement | null {
  const routing = routeMoneyRender(params);
  if (routing.action === 'render-nothing') return null;
  if (routing.action === 'render-money') {
    return renderers.renderMoney(params?.overlaySample);
  }
  return renderers.renderCoverage(routing.coverageOverlay as MoneyOverlay);
}
