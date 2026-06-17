# RFC-0206 — Library-side Response to GCDR Feedback

- **RFC**: 0206 (companion document)
- **Responds to**: `gcdr.git/docs/RFC-0206-FEEDBACK.md` (GCDR-side review)
- **Status**: Assessment / accepted with changes (design only — no implementation in this doc)
- **Author**: Rodrigo Lago
- **Created**: 2026-06-16

---

## Verdict

**Accept the feedback in full.** It is accurate, sourced to concrete schema/controller
lines, and it resolves RFC-0206's single biggest open question (Unresolved Q1 — "does a
dedicated code-availability endpoint exist?"). The answer is **yes**: GCDR already ships
`/customers/exists` and `/assets/exists`, so Phases 1 and 2 can target the authoritative
endpoint instead of the fuzzy `?search=` fallback the implementation currently uses.

The feedback also surfaces one real **blocker** (device code has no uniqueness in GCDR)
and one **API-shape mismatch** (the implemented `checkCustomerCodeAvailable` hits the wrong
endpoint). Both are addressed below, together with the optional-inline-verification design
change requested alongside this review.

---

## 1. Point-by-point assessment

### 1.1 Uniqueness model (feedback §1) — **accepted, no debate**

Only `customers.code`, `assets.code` and `devices.name` are DB-unique; customer/asset
**names are not** and `devices.code` has **no index today**. This confirms RFC-0206's stance
that `slugifyCustomerName` is display-only and that names are not a uniqueness surface. No
change to the RFC's philosophy; it just hardens it with the DB facts.

### 1.2 Existing endpoints (feedback §2) — **changes the implementation**

The implementation shipped in PR #95 calls `GET /customers?search=<code>` and filters
client-side (RFC "strategy A"). The feedback shows the **authoritative** endpoints already
exist (RFC "strategy B"):

| Helper | Endpoint | Envelope → mapping |
|--------|----------|--------------------|
| `checkCustomerCodeAvailable(code)` | `GET /api/v1/customers/exists?code=<C-…>` | `available = !data.exists` |
| `checkAssetCodeAvailable(code, customerId)` | `GET /api/v1/assets/exists?customerId=<uuid>&code=<A-…>` | `available = !data.exists` |

**Required library changes:**
1. Re-point `checkCustomerCodeAvailable` from `/customers?search=` to `/api/v1/customers/exists?code=`, mapping `available = !data.exists`. The defensive envelope-tolerance stays (read `data.exists`), but the URL and semantics change.
2. The `CodeCheckConfig.baseUrl` is expected to include the API root such that the path resolves to `/api/v1/customers/exists` (document this explicitly, e.g. `baseUrl: 'https://gcdr.api/api/v1'` or keep `/api/v1` inside the helper — **decision below**).

> **Decision — where does `/api/v1` live?** Recommend the helper owns the versioned path
> (`/customers/exists`, `/assets/exists`, `/devices/exists`) and `baseUrl` is just the host
> root (`https://gcdr.api`). This matches how the endpoints are versioned together and means
> a future `/api/v2` is a one-line change in the library, not in every caller's config.

### 1.3 Asset check is per-customer (feedback §2 note) — **changes the asset surface**

`assets.code` is unique within `(tenant, customer)`, and `/assets/exists` **requires
`customerId`**. The current `asset.ts` ships `generateAssetCode` **but no check/pick
helpers**. To honor the feedback, Phase 2 must add:

```ts
checkAssetCodeAvailable(code: string, customerId: string, cfg: CodeCheckConfig): Promise<boolean>
pickUniqueAssetCode(customerId: string, cfg: CodeCheckConfig): Promise<string>
```

`customerId` is **mandatory** — a positional arg (not part of `cfg`) so the type system
forces callers to supply it. This is the one place the customer/asset APIs legitimately
diverge.

### 1.4 Device code gap (feedback §3) — **Phase 3 check is BLOCKED**

GCDR has neither a unique index nor an endpoint for `devices.code`. Consequences for the
library:

- `generateDeviceCode()` / `deviceTypeToken()` ship now — they are pure, offline, format-only.
- `checkDeviceCodeAvailable` / `pickUniqueDeviceCode` **must not** be added to the public
  surface yet. Shipping them against a non-existent endpoint would give a false sense of
  uniqueness. They are deferred until GCDR lands:
  1. `CREATE UNIQUE INDEX devices_tenant_code_unique ON devices (tenant_id, code) WHERE code IS NOT NULL;` (partial — `code` is nullable), after a duplicate pre-flight;
  2. `GET /api/v1/devices/exists?code=<D-…>`.

This is the GCDR action item the feedback offers to open. **We should accept it** and track
it as a small GCDR PR; the library's Phase-3 verification work is gated on it.

### 1.5 Preferred response shape (feedback §4) — **adopt tolerantly**

The `centrals/serial/available` precedent returns `{ value, valid, available }` (format +
uniqueness in one call). Recommendation: when the device endpoint is built, use that shape.
The library's check helpers should be written to **tolerate both** envelopes —
`data.exists` (current customers/assets) and `{ valid, available }` (preferred new shape) —
so the same helper works before and after GCDR converges on one.

---

## 2. Design change: optional inline GCDR verification

Request: a generator should optionally take the check config; **with** it the library performs
the GCDR check inline; **without** it the library returns the code flagged as not verified
(e.g. *"GCDR not verified"*).

### 2.1 The footgun to avoid

Do **not** overload the existing pure generator's return type:

```ts
// ❌ anti-pattern: return type depends on args (string vs Promise<object>)
generateCustomerCode();        // string
generateCustomerCode(cfg);     // Promise<{...}>  ← callers must branch on the shape
```

Mixed sync/async or string/object returns are an error magnet (forgotten `await`, wrong
type guards). The pure `generateCustomerCode(): string` should stay exactly as-is.

### 2.2 Recommended shape — a structured `mint*` result

Add a sibling that always returns a structured result and is always async:

```ts
export interface CodeMintResult {
  code: string;
  /** true only when a GCDR availability check actually ran. */
  gcdrVerified: boolean;
  /** present only when gcdrVerified — true = code is free in GCDR. */
  available?: boolean;
  /** human-readable note, e.g. "GCDR not verified (no check config supplied)". */
  note?: string;
}

// cfg omitted → offline: { code, gcdrVerified: false, note: 'GCDR not verified' }
// cfg present → verify+retry until free: { code, gcdrVerified: true, available: true }
export function mintCustomerCode(cfg?: CodeCheckConfig): Promise<CodeMintResult>;
export function mintAssetCode(customerId: string, cfg?: CodeCheckConfig): Promise<CodeMintResult>;
export function mintDeviceCode(deviceType: string, cfg?: CodeCheckConfig): Promise<CodeMintResult>;
```

Behavior:
- **No `cfg`** → generate once, return `{ code, gcdrVerified: false, note: 'GCDR not verified' }`. Exactly the "returns the code with an observation" the request asked for.
- **With `cfg`** → behaves like `pickUnique*` (generate → check → retry) and returns `{ code, gcdrVerified: true, available: true }`.
- **Device, with `cfg`, before the GCDR endpoint exists** → `mintDeviceCode` returns `{ code, gcdrVerified: false, note: 'device code uniqueness not enforced by GCDR yet (RFC-0206 §3)' }` even when a config is passed, because there is nothing authoritative to verify against. This keeps the promise honest.

This gives the requested ergonomics (one call, optional verification, explicit "not verified"
flag) while keeping the pure generators pure and never overloading a return type. The existing
`generateCustomerCode` / `checkCustomerCodeAvailable` / `pickUniqueCustomerCode` remain as the
low-level primitives `mint*` is built on.

### 2.3 Why not just a boolean "verified" out-param?

A boolean can't carry *why* it wasn't verified (no config vs. endpoint-missing vs. network
error). The `note` field distinguishes these, which matters for the device case (§1.4) where
"not verified" is structural, not a caller omission.

---

## 3. Net impact on RFC-0206

| RFC-0206 area | Change |
|---------------|--------|
| Unresolved Q1 (customer endpoint) | **Resolved** — use `/api/v1/customers/exists?code=`, `available = !exists`. |
| Phase 1 `checkCustomerCodeAvailable` | Re-point endpoint; envelope `data.exists`. |
| Phase 1 API | **Add** `mintCustomerCode(cfg?)` returning `CodeMintResult`. |
| Phase 2 asset | **Add** `checkAssetCodeAvailable(code, customerId, cfg)` + `pickUniqueAssetCode(customerId, cfg)` + `mintAssetCode(customerId, cfg?)`; `customerId` mandatory. |
| Phase 3 device | `generateDeviceCode` ships; **`checkDeviceCodeAvailable`/`pickUniqueDeviceCode` deferred** until GCDR migration + endpoint. `mintDeviceCode` returns `gcdrVerified:false` until then. |
| `CodeCheckConfig` | Document that `baseUrl` is the host root; helpers own the `/api/v1/...` path. Tolerate both `{ exists }` and `{ valid, available }` envelopes. |
| Names | Unchanged — no `check*NameAvailable`; `slugifyCustomerName` stays display-only. |

---

## 4. Action items

**Library (`myio-js-library`, follow-up to PR #95):**
1. Re-point `checkCustomerCodeAvailable` to `/api/v1/customers/exists?code=` (`available = !data.exists`); tolerate the `{ valid, available }` shape too.
2. Add Phase-2 asset check/pick helpers with mandatory `customerId`.
3. Add `mintCustomerCode` / `mintAssetCode` / `mintDeviceCode` returning `CodeMintResult` (the optional-verification ergonomics).
4. Keep Phase-3 device **check** helpers out of the public surface; `mintDeviceCode` reports `gcdrVerified:false` with the structural note.
5. Update RFC-0206 §Reference + §Usage to reflect the real endpoints and the `mint*` API; close Unresolved Q1.

**GCDR (`gcdr.git`):**
6. Open the offered PR: partial unique index `devices_tenant_code_unique (tenant_id, code) WHERE code IS NOT NULL` (after duplicate pre-flight) + `GET /api/v1/devices/exists?code=`, ideally in the `{ value, valid, available }` shape.

**Sequencing:** items 1–3 and 5 unblock immediately (customer/asset can verify today). Item 4
is a stop-gap until item 6 lands; once item 6 ships, promote `mintDeviceCode` to real
verification and add the device check/pick helpers.

---

## 5. Open questions back to GCDR

1. **Base path** — confirm all three live under `/api/v1/...` so the library can own the
   versioned segment and keep `baseUrl` as the host root.
2. **Envelope convergence** — will customers/assets migrate to the `{ value, valid, available }`
   shape, or should the library treat `{ exists, count }` as the long-term contract for those
   two and `{ valid, available }` only for device/central? (Affects how defensively the helper
   parses.)
3. **Tenant scoping of `baseUrl`/token** — confirmed tenant is derived from the JWT (so the
   library never sends `tenant_id`); just re-confirming before we hard-code that assumption.
