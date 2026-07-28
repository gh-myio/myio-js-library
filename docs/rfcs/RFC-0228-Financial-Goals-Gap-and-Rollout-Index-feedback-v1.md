# RFC-0228 Feedback v1 - Financial Goals gap and rollout index

- **Reviewed RFC:** `docs/rfcs/RFC-0228-Financial-Goals-Gap-and-Rollout-Index.md`
- **Date:** 2026-07-25
- **Related GCDR docs reviewed:**
  - `gcdr.git/docs/api/API-Financial-Goals.md`
  - `gcdr.git/docs/rfcs/RFC-0054-Monetary-Goals-and-Customer-Tariffs.md`
- **Related local RFCs checked:** RFC-0075, RFC-0217, RFC-0222, RFC-0225, RFC-0227.

## Executive summary

RFC-0228 is directionally correct: it treats GCDR RFC-0054 as a backend/API contract and identifies the missing work needed to make "metas financeiras" visible in `myio-js-library`. The strongest parts are the three-track split, the warning that `openPricingPanel` is still a local prototype, and the explicit warning that money coverage will fail for customer-granular goals unless rollout is curated or the backend model evolves.

The document needs a few tightening passes before it becomes a reliable rollout index:

1. Qualify **GCDR RFC-0046/RFC-0052** everywhere, because local RFC-0046/RFC-0052 in this repo are unrelated.
2. Separate **tariffs**, **money overlay**, and **native financial goals** more aggressively in the frontend backlog; they are not the same feature and they have different gates.
3. Add a frontend naming contract for `budget`, because existing local components already use `budget` to mean the quantity goal/Meta line, while RFC-0054 uses `budget` for the native `CURRENCY` comparison block.
4. Reframe B1 as a **rollout fork**, not an unconditional prerequisite. Customer-granular money is critical for broad rollout, but A2 can still ship behind coverage/feature gates for curated device-granular customers.
5. Add a concrete adapter/test track for RFC-0222, because the current pricing panel uses `pricePerKwh`, local shape `month|range`, numeric prices, localStorage, and local tests.

## Findings

### 1. The RFC should explicitly namespace external GCDR RFCs

**Severity:** Medium

The user note is important: in this repository, RFC-0046 and RFC-0052 are not the Goals RFCs. RFC-0228 currently says:

> Builds on (GCDR, other repo): RFC-0054 ..., RFC-0046 (Consumption Goals), RFC-0052 (Goal Margin).

That is mostly clear, but it is easy to misread during future maintenance because this repo also has unrelated RFC numbers. The header should say `GCDR RFC-0046` and `GCDR RFC-0052` every time those are mentioned.

**Suggested edit:**

```md
Builds on (GCDR, other repo): GCDR RFC-0054, GCDR RFC-0046, GCDR RFC-0052.
Do not confuse these with local myio-js-library RFC-0046/RFC-0052, which cover unrelated topics.
```

Also add the local goals RFC map to the `Related (this repo)` line:

- RFC-0075: setup panel / historical TB SERVER_SCOPE goals model.
- RFC-0217: CustomerGoalsCard / small multiples.
- RFC-0225: period goal KPI and domain gating.
- RFC-0227: help/wizard for the Metas compare modal.
- RFC-0222: pricing panel prototype.

### 2. B1 is a rollout fork, not necessarily a hard dependency for every A2/A3 delivery

**Severity:** High

RFC-0228 says A2 depends on B1, and the thesis says to close the customer-granular money gap before wiring the frontend. The concern is valid for broad production rollout, especially because RFC-0225 states that today the common case can be `granularity: 'CUSTOMER'`.

But making B1 a hard prerequisite for all frontend work is too strong. RFC-0054 deliberately keeps v1 money overlay device-granular. The frontend can still ship an honest A2/A3 path for:

- customers with device-granular goals,
- pilots where tariff categories are curated,
- internal/MyIO-only rollout,
- or feature-flagged customers.

The right dependency is:

- **A2/A3 broad rollout** depends on B2 and the B1 decision.
- **A2/A3 technical integration / pilot** depends on RFC-0054 Phase 2/3 plus A4 coverage UX.

**Suggested change:** split A2 into two rows:

| ID | Difference | Depends on |
|---|---|---|
| A2a | Wire `withMoney=true` and render money overlay for eligible device-granular goals behind a feature/coverage gate | RFC-0054 Phase 2, A4 |
| A2b | Broad HO rollout for the production base | B2 plus B1 decision/curation |

This keeps the UI work moving without pretending the production base is covered.

### 3. The frontend needs a naming contract for `budget`

**Severity:** High

Local goals components already use `budget` to mean the quantity goal / "Meta" / "Orcado" line. For example, `CustomerGoalsCard` uses `budget`, `budgetBreakdown`, and `budgetDetail` for the current consumption-goal series. GCDR RFC-0054 introduces a `budget` response block for native `CURRENCY` goals:

```jsonc
"budget": {
  "projected": { "amount": "...", "source": "OVERLAY" },
  "target": { "amount": "...", "source": "NATIVE" },
  "variance": null,
  "withinBudget": null
}
```

If RFC-0229 consumes RFC-0228 without a naming rule, the UI can easily mix:

- quantity target: kWh/m3 goal line (`Meta`, currently `budget` in component props),
- monetary projection: derived R$ from `withMoney=true`,
- native currency budget: committed R$ goal (`measure=CURRENCY`).

**Suggested RFC-0228 addition:** add a "Frontend naming bridge" section:

| Concept | GCDR wire | Existing UI term | Suggested frontend internal name |
|---|---|---|---|
| Quantity goal target | `tree.*.value/adjustedValue` on `measure=QUANTITY` | `Meta` / `Orcado`; often `budget` prop | `quantityGoal` or `goalSeries` |
| Money overlay | `monetaryValue`, `money` | new R$ projection | `monetaryProjection` |
| Native financial goal | `measure=CURRENCY`, `budget.target` | financial budget | `currencyBudget` |
| Budget verdict | `budget.variance`, `budget.withinBudget` | new status chip | `budgetVerdict` |

The child RFC should decide whether to rename component props or keep compatibility wrappers, but the distinction must be explicit.

### 4. RFC-0222 adapter work needs its own acceptance criteria

**Severity:** High

RFC-0228 correctly says RFC-0222 must become an adapter over the hourly tariff API. The current implementation evidence supports that:

- `openPricingPanel` is still exported as prototype persistence.
- tests clear and assert `localStorage`.
- `pricePerKwh` is still the local field.
- the panel shape is still month/range, while RFC-0054 says the server persists hourly buckets only.

The index should add acceptance criteria for the RFC-0222 revision, not just name it as A1.

**Suggested A1 acceptance criteria:**

- No tariff persistence path uses localStorage as source of truth.
- API reads/writes use `GET/PUT/PATCH/DELETE /customers/:id/tariffs`.
- UI `month|range|day/band` edits expand to hourly buckets before write.
- API hourly/day responses collapse into user-facing bands only in the client adapter.
- Prices are sent and received as decimal strings, not JS numbers.
- `pricePerKwh` is accepted only as a legacy input alias if the backend still supports it; UI state should normalize to canonical `price`.
- Optimistic concurrency uses `ETag`/`If-Match` or `expectedVersion`.
- Tests cover leap-year/hour bucket expansion, version conflict, decimal string preservation, and no localStorage persistence.

### 5. A5 needs an owner and API contract, not only a UI row

**Severity:** Medium

RFC-0228 lists A5 as "Gestao de `tariff_category` por device", which is necessary. But this is not only a frontend concern. The GCDR docs say `devices.tariffCategory` is explicit and required for a device to contribute to money sums. That means the rollout needs:

- where the device list comes from,
- which device API updates `tariffCategory`,
- auth/RBAC for writes,
- audit/history expectations,
- bulk edit support,
- and how uncategorized devices discovered by `withMoney=true` deep-link back into the categorization UI.

**Suggested change:** either split A5 into frontend/backend rows or make the child RFC explicitly cross-repo:

| ID | Difference |
|---|---|
| A5a | Frontend UI to view/filter/bulk-edit device tariff categories |
| B6 | GCDR device API/read/write/audit contract for `tariffCategory` |

This avoids building a UI against an assumed device API.

### 6. API-Financial-Goals has a small response-shape ambiguity that RFC-0228 should not inherit

**Severity:** Medium

The API guide says a customer-granular goal returns:

```jsonc
money: { "reason": "MONEY_REQUIRES_DEVICE_GRANULARITY" }
```

RFC-0054's contract text later says `money` is `null` with `reason:"MONEY_REQUIRES_DEVICE_GRANULARITY"`, which is structurally ambiguous because `null` cannot carry a field. RFC-0228 currently references `money: MONEY_REQUIRES_DEVICE_GRANULARITY` informally.

The child frontend RFC needs one exact normalized shape before implementation:

```ts
type MoneyOverlay =
  | { state: 'available'; coverageComplete: boolean; ... }
  | { state: 'unavailable'; reason: 'MONEY_REQUIRES_DEVICE_GRANULARITY' };
```

This can be a frontend adapter if the backend response is already frozen, but the RFC should flag the ambiguity so UI code does not branch on three variants.

### 7. The API documentation change list is correct, but one item should be immediate

**Severity:** Low

RFC-0228 wisely says not to update `API-Financial-Goals.md` until the corresponding tracks are approved. That avoids the RFC-0207 problem of documentation promising future behavior as if it shipped.

One exception is worth adding now: clarify the response shape for `MONEY_REQUIRES_DEVICE_GRANULARITY` in the GCDR API guide/RFC-0054 pair. That is not new scope; it is a contract consistency fix.

Everything else in the RFC-0228 API-doc checklist should remain gated:

- customer-granular money only after B1,
- `withMoney` default only after B4,
- tariff CSV only after B3,
- new `tariff_model` values only after C1/C2/C3,
- pricing-panel adapter note only after A1.

### 8. Track C is correctly deferred, but "financial goals" should not imply billing-grade cost

**Severity:** Low

RFC-0054 v1 uses `FLAT` tariffs and explicitly defers TE/TUSD/taxes/bandeiras, progressive water, sewage, and multi-currency. RFC-0228 already says Track C should not block the first R$ view.

The child frontend RFC should also require wording in the UI that avoids billing-grade claims. The first shipped experience is a management projection/budget view, not a substitute for utility invoicing.

Suggested wording principle:

- Good: "Projected cost", "Estimated R$", "Coverage incomplete".
- Avoid: "Invoice", "Billing total", "Final payable amount".

## Recommended edits to RFC-0228

1. Add a short "Numbering warning" note: local RFC-0046/RFC-0052 are unrelated; Goals RFCs 0046/0052 are in GCDR.
2. Add RFC-0075 to the local related list as the legacy setup/persistence precedent.
3. Split A2 into pilot integration vs broad rollout, or mark B1 as a broad-rollout gate rather than an implementation prerequisite.
4. Add a frontend naming bridge for `budget` vs `currencyBudget` vs quantity `Meta`.
5. Expand A1 with concrete adapter acceptance criteria.
6. Split A5 into frontend UI plus GCDR device API/write/audit ownership.
7. Add a contract-consistency TODO for the `MONEY_REQUIRES_DEVICE_GRANULARITY` response shape.
8. State that no `API-Financial-Goals.md` behavior should be changed before its owning child RFC closes, except contract clarifications.

## Suggested revised critical path

```text
B2 measure production granularity
  -> decide rollout policy:
       a) curated device-granular pilot
       b) customer-granular backend extension
       c) hybrid

In parallel:
  A1 pricing-panel adapter over GCDR tariffs
  A5/B6 tariffCategory management path

Then:
  A2a money overlay UI for eligible/curated customers
  A4 honest coverage UX
  A3 native CURRENCY budget UI

After coverage evidence:
  A2b broad Head Office rollout
  A6/A7 report/card expansion

Deferred:
  B3/B5 operational enhancements
  C1/C2/C3 tariff model evolution
```

## Conclusion

RFC-0228 is a useful index and should be kept as an index, not expanded into the implementation RFC for financial goals. The main changes needed are precision: namespace the GCDR RFCs, avoid a `budget` naming collision, make customer-granular money a measured rollout fork, and give the RFC-0222 adapter concrete acceptance criteria. With those changes, the next child RFCs can be opened without re-litigating the full money model.
