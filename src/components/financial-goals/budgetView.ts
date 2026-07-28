/**
 * RFC-0228 A3 — Native CURRENCY budget view (the R$ budget target + verdict).
 *
 * Given a normalized {@link MoneyOverlay} (F0, `moneyTypes.ts`) that carries a
 * native `budget` block (GCDR RFC-0054 `measure=CURRENCY`, API guide §4.2), this
 * renderer produces the **budget** face that sits **beside the A2a R$ row**:
 *
 *  - **Target** — the committed R$ budget (`budget.target.amount`,
 *    `source:NATIVE`) via {@link formatBRL}.
 *  - **Projected** — the R$ projection from the overlay (`budget.projected.amount`,
 *    `source:OVERLAY`) via {@link formatBRL}.
 *  - **Verdict** — the headline honesty invariant (GCDR RFC-0054 **DEC-6**):
 *      · `withinBudget === true`  → a green chip "Dentro do orçamento" + the R$/%
 *        variance.
 *      · `withinBudget === false` → a red chip "Acima do orçamento" + the R$/%
 *        variance.
 *      · `withinBudget === null`  → **explicitly withheld**: "Veredito indisponível
 *        — cobertura incompleta". The UI **never** declares in/over budget over a
 *        partial projection. When `coverageComplete:false`, it defers to **A4**
 *        ({@link renderCoverageView}) for the *why* (uncategorized devices / gaps).
 *  - **No native budget** (`budget` absent) → an empty state, never an error and
 *    never `R$ 0`.
 *  - **No overlay** (money off / not resolved) → returns `null`; the caller
 *    appends nothing and the card stays byte-identical to the kWh-only view.
 *
 * ── WORDING CONTRACT (RFC-0228 feedback §8) — DO NOT DRIFT ──────────────────────
 * This is coverage/estimation UX, not billing. ALLOWED: "Orçamento", "Projeção",
 * "Estimativa em R$". FORBIDDEN (never emit): "Fatura", "Faturamento",
 * "Valor final", "Total a pagar". The withheld state carries NO in/over-budget
 * word — declaring a verdict over a partial projection breaks DEC-6.
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * Design rules (mirroring F0/A4/A2a on this branch):
 *  - **Pure component.** DOM/HTML output + inputs/callbacks only. No `fetch`, no
 *    ThingsBoard, no API calls. It receives a `MoneyOverlay`; it never fetches one.
 *    The optional {@link BudgetViewOptions.onSaveBudget} callback is a **stub**
 *    affordance the host wires to `goalsMoneyClient.putBudget` — A3 does not build
 *    a full editor (deferred).
 *  - **Amounts are decimal STRINGS.** The only `Number()` is the derived variance
 *    percent ({@link computeDeltaPct}) — a display metric. The R$ figures are
 *    formatted string-in / string-out ({@link formatBRL}), never round-tripped
 *    through a float.
 *  - **Never `R$ 0`, never `NaN`.** A missing amount renders `—` (F0 `DASH`).
 */

import type { MoneyOverlay, BudgetOverlay, GoalTreeNode } from './moneyTypes';
import { renderCoverageView, type CoverageViewOptions } from './coverageView';
import {
  DASH,
  formatBRL,
  formatBRLDelta,
  formatDeltaPct,
  computeDeltaPct,
} from './moneyFormat';

/** Per-role value colours for the two R$ figures (label tint). */
export interface BudgetValueColors {
  /** Target (committed budget) label tint. Default: purple. */
  target?: string;
  /** Projected (overlay projection) label tint. Default: blue. */
  projected?: string;
}

/** Verdict chip palette (defaults mirror the Metas × Consumo `devChip`). */
export interface BudgetChipColors {
  /** Acima do orçamento (over): red by default. */
  overBg?: string;
  overText?: string;
  /** Dentro do orçamento (within): green by default. */
  withinBg?: string;
  withinText?: string;
  /** Withheld / no data: grey by default. */
  neutralBg?: string;
  neutralText?: string;
}

/** Options for {@link renderBudgetView}. */
export interface BudgetViewOptions {
  /**
   * The normalized money overlay for this shopping/portfolio (F0). Drives the gate:
   *  - `null`/`undefined` (no `state`) → renderer returns `null` (money off).
   *  - present but no `budget` block → empty state (no error, no R$ 0).
   *  - `budget` present → Target/Projected + the DEC-6 verdict.
   */
  overlay: MoneyOverlay | null | undefined;
  /**
   * **Stub** edit affordance. When given, a single "Editar orçamento" button is
   * rendered; clicking it fires this callback so the host can open its own editor
   * and call `goalsMoneyClient.putBudget`. A3 does NOT build a full editor — it
   * hands back a best-effort annual echo of the current target (or `{}` when the
   * target is absent). The real write path lives in F0's client (deferred).
   */
  onSaveBudget?: (tree: GoalTreeNode) => void;
  /** A5a per-device deep-link, passed through to A4 in the withheld/incomplete state. */
  onCategorizeDevice?: (deviceId: string) => void;
  /** A5a generic deep-link, passed through to A4 in the withheld/incomplete state. */
  onManageCategories?: () => void;
  /** Value-figure colour override. */
  valueColors?: BudgetValueColors;
  /** Verdict-chip palette override. */
  chipColors?: BudgetChipColors;
  /** Document to build in (defaults to the ambient `document`). */
  document?: Document;
}

/** Default value hues — Target purple, Projected blue. */
const DEFAULT_VALUE_COLORS: Required<BudgetValueColors> = {
  target: '#7c3aed',
  projected: '#2563eb',
};

/** Default verdict-chip palette — identical hues to the Metas × Consumo `devChip`. */
const DEFAULT_CHIP: Required<BudgetChipColors> = {
  overBg: '#fee2e2',
  overText: '#b91c1c',
  withinBg: '#dcfce7',
  withinText: '#15803d',
  neutralBg: '#f1f5f9',
  neutralText: '#64748b',
};

const CHIP_BASE =
  'border-radius:999px;padding:3px 12px;font:800 12px Nunito,sans-serif;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;';

/** A decimal string is "present" when it is a non-empty, non-null string. */
function hasAmount(s: string | null | undefined): s is string {
  return typeof s === 'string' && s.trim() !== '';
}

/**
 * Extract the {@link BudgetOverlay} from an overlay, or `undefined` when there is
 * no native budget (unavailable overlay, or available without a `budget` block).
 * Pure — amounts pass through verbatim, never `Number()`-ed.
 */
export function resolveBudget(
  overlay: MoneyOverlay | null | undefined
): BudgetOverlay | undefined {
  if (!overlay || typeof (overlay as { state?: unknown }).state !== 'string') {
    return undefined;
  }
  if (overlay.state !== 'available') return undefined;
  return overlay.budget;
}

/** One R$ figure cell: coloured label + formatted amount (or `—`). */
function figureHTML(label: string, amount: string | null | undefined, color: string): string {
  return (
    `<span style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">` +
    `<span style="color:${color};font-weight:700;">${label}</span>` +
    `<b style="color:var(--gc-text2, #334155);font-weight:800;">${formatBRL(amount ?? null)}</b>` +
    `</span>`
  );
}

/**
 * Build the verdict chip from the {@link BudgetOverlay} verdict. **DEC-6 invariant**:
 * a conclusion ("Dentro do orçamento" / "Acima do orçamento") is emitted **only**
 * when `withinBudget` is a strict boolean. When it is `null` (or anything else),
 * the withheld chip is returned instead — no in/over-budget word, ever.
 */
export function buildVerdictHTML(
  budget: BudgetOverlay,
  chipColors: Required<BudgetChipColors>
): string {
  const withinBudget = budget.verdict?.withinBudget;
  const varianceR$ = hasAmount(budget.verdict?.variance)
    ? formatBRLDelta(budget.verdict.variance)
    : DASH;
  const pct = computeDeltaPct(
    budget.projected?.amount ?? null,
    budget.target?.amount ?? null
  );
  const pctTxt = pct == null ? DASH : formatDeltaPct(pct);
  const varianceLabel =
    varianceR$ === DASH && pctTxt === DASH
      ? ''
      : `<span class="myio-budget__variance" style="font-weight:700;margin-left:8px;color:var(--gc-muted, #64748b);">${varianceR$} · ${pctTxt}</span>`;

  // ── DEC-6: only a strict boolean yields a conclusion. `null`/anything → withheld.
  if (withinBudget === true) {
    return (
      `<span data-budget-verdict="within" style="background:${chipColors.withinBg};color:${chipColors.withinText};${CHIP_BASE}">` +
      `<span aria-hidden="true">✓</span>Dentro do orçamento</span>${varianceLabel}`
    );
  }
  if (withinBudget === false) {
    return (
      `<span data-budget-verdict="over" style="background:${chipColors.overBg};color:${chipColors.overText};${CHIP_BASE}">` +
      `<span aria-hidden="true">▲</span>Acima do orçamento</span>${varianceLabel}`
    );
  }
  // Withheld — coverage incomplete. No in/over-budget word (DEC-6).
  return (
    `<span data-budget-verdict="withheld" style="background:${chipColors.neutralBg};color:${chipColors.neutralText};${CHIP_BASE}">` +
    `<span aria-hidden="true">⏳</span>Veredito indisponível — cobertura incompleta</span>`
  );
}

/**
 * Build the budget view body (Target/Projected figures + verdict) as an HTML
 * **string** (pure — no DOM, no callbacks, no A4 deferral). Directly testable for
 * the DEC-6 verdict-withholding invariant and the wording contract.
 */
export function buildBudgetHTML(
  budget: BudgetOverlay,
  chipColors: Required<BudgetChipColors> = DEFAULT_CHIP,
  valueColors: Required<BudgetValueColors> = DEFAULT_VALUE_COLORS
): string {
  const figures =
    `<div style="font:600 12px Nunito,sans-serif;color:var(--gc-muted, #64748b);display:flex;align-items:center;gap:14px;flex-wrap:wrap;min-width:0;">` +
    `<span aria-hidden="true">🎯</span>` +
    figureHTML('Meta (orçamento)', budget.target?.amount, valueColors.target) +
    figureHTML('Projeção', budget.projected?.amount, valueColors.projected) +
    `</div>`;
  return (
    `<div class="myio-budget__row" data-budget-row="1" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">` +
    figures +
    `<span class="myio-budget__verdict-wrap" style="display:inline-flex;align-items:center;">` +
    buildVerdictHTML(budget, chipColors) +
    `</span>` +
    `</div>` +
    `<div class="myio-budget__note" style="font:600 10px Nunito,sans-serif;color:var(--gc-muted, #94a3b8);margin-top:4px;">Orçamento nativo em R$ · Projeção estimada</div>`
  );
}

/** The empty-state HTML when no native budget exists (no error, no R$ 0). */
function emptyStateHTML(): string {
  return (
    `<div class="myio-budget__empty" role="status" style="font:600 12px Nunito,sans-serif;color:var(--gc-muted, #94a3b8);display:flex;align-items:center;gap:6px;">` +
    `<span aria-hidden="true">💸</span>Nenhum orçamento em R$ definido.` +
    `</div>`
  );
}

/**
 * Render the native CURRENCY budget view for a shopping/portfolio as a live DOM
 * element — or `null` when there is no overlay (money off).
 *
 * - No overlay → `null` (caller appends nothing).
 * - No `budget` block → empty state (`data-budget-state="empty"`).
 * - `budget` present → Target/Projected + verdict (`data-budget-state="budget"`).
 *   When the verdict is withheld AND `coverageComplete:false`, the A4
 *   {@link renderCoverageView} element is appended for the *why*.
 */
export function renderBudgetView(options: BudgetViewOptions): HTMLElement | null {
  const overlay = options?.overlay;
  // Gate: no overlay (money source not configured / not resolved) → no budget view.
  if (!overlay || typeof (overlay as { state?: unknown }).state !== 'string') {
    return null;
  }

  const doc =
    options.document || (typeof document !== 'undefined' ? document : undefined);
  if (!doc) {
    throw new Error(
      'renderBudgetView requires a document (pass options.document in non-DOM envs).'
    );
  }

  const budget = resolveBudget(overlay);
  const root = doc.createElement('div');
  root.className = 'myio-budget';

  // No native budget → honest empty state (never an error, never R$ 0).
  if (!budget) {
    root.setAttribute('data-budget-state', 'empty');
    root.innerHTML = emptyStateHTML();
    return root;
  }

  const chipColors: Required<BudgetChipColors> = { ...DEFAULT_CHIP, ...options.chipColors };
  const valueColors: Required<BudgetValueColors> = {
    ...DEFAULT_VALUE_COLORS,
    ...options.valueColors,
  };

  root.setAttribute('data-budget-state', 'budget');
  root.innerHTML = buildBudgetHTML(budget, chipColors, valueColors);

  // DEC-6: when the verdict is withheld because coverage is incomplete, defer to A4
  // for the *why* (uncategorized devices / tariff gaps). We never fabricate a verdict.
  const withheld = budget.verdict?.withinBudget !== true && budget.verdict?.withinBudget !== false;
  if (
    withheld &&
    overlay.state === 'available' &&
    overlay.coverageComplete !== true
  ) {
    const coverageOpts: CoverageViewOptions = {
      onCategorizeDevice: options.onCategorizeDevice,
      onManageCategories: options.onManageCategories,
      document: doc,
    };
    const why = renderCoverageView(overlay, coverageOpts);
    why.setAttribute('data-budget-why', '1');
    root.appendChild(why);
  }

  // Optional stub edit affordance — the host wires it to `putBudget` (F0). A3 does
  // NOT build a full editor; it fires a best-effort annual echo of the current target.
  if (typeof options.onSaveBudget === 'function') {
    const cb = options.onSaveBudget;
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'myio-budget__edit';
    btn.setAttribute('data-budget-edit', '1');
    btn.textContent = 'Editar orçamento';
    btn.setAttribute(
      'style',
      'align-self:flex-start;margin-top:8px;padding:6px 12px;border:1px solid #7c3aed;border-radius:8px;background:transparent;color:#7c3aed;font:800 12px Nunito,sans-serif;cursor:pointer;'
    );
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      // Best-effort echo: hand back the current annual target as a write tree. The
      // amount is a decimal string; the wire (§5.4) carries a number, so the host's
      // real editor owns any re-shaping. This is a stub, not the editor.
      const tree: GoalTreeNode = hasAmount(budget.target?.amount)
        ? { annual: { value: Number(budget.target.amount) } }
        : {};
      cb(tree);
    });
    root.appendChild(btn);
  }

  return root;
}
