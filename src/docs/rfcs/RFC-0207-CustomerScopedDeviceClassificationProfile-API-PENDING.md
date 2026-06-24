# RFC-0207 — Device Classification Profile · GCDR consumer contract & PENDING

- **Status:** **Consumer-side design DECIDED · backend + LIB work PENDING.** The classification
  tree (RFC-0207) is loaded/saved from the **GCDR generic registry (RFC-0047)** — **no bespoke
  API**. This doc is the **consumer contract** (what the lib/MAIN_VIEW need) plus the **open
  questions for the GCDR API backend**. It **absorbs and replaces** the two feedback docs
  (`…-API-PENDING-FEEDBACK-FROM-GCDR.md` + `…-V2.md`, removed).
- **Consumer:** `MAIN_VIEW` (the I/O owner) + a **pure adapter in `myio-js-library`**. The lib does
  **no `fetch`**; the MENU is endpoint-agnostic (delegates save via callback).
- **Author:** Rodrigo Lago · **Created:** 2026-06-23 · **Decided in:** BMAD roundtable (Winston/Amelia/John).
- **Parent:** [`RFC-0207-CustomerScopedDeviceClassificationProfile.md`](./RFC-0207-CustomerScopedDeviceClassificationProfile.md) (Addendum v3 FINAL).
- **Server side:** GCDR `RFC-0047-Generic-Entity-Registry` (+ `-Entity-API`, `-Entity-schema`).

---

## 1. Decision — reuse RFC-0047 (no dedicated API)

The classification tree is stored as **`entities`** in the GCDR registry. There is **no
`/classification-profile` endpoint**. The `ResolvedProfile` the lib consumes is a **pure adapter
projection** over `entities`, living next to the golden-locked engine.

| Operation | RFC-0047 endpoint | LIB use |
|---|---|---|
| **LOAD** | `GET /api/v1/entities/resolve?customerId=&type=CLASSIFICATION_<DOMAIN>` | `GcdrResolveProfileSource` — one domain; `source: customer\|system`, `X-Version-Id`/304. |
| **SAVE** | `PUT /api/v1/entities/bulk-replace?customerId=&type=CLASSIFICATION_<DOMAIN>` | `saveDomainClassification` — replace one domain's subtree in **one TX**; `If-Match: <domain version>` → **409**. |
| **REVERT** | `POST /api/v1/entities/revert` | "restaurar padrão" (back to system default). |

`entity_type` root per domain: `CLASSIFICATION_ENERGY | CLASSIFICATION_WATER | CLASSIFICATION_TEMPERATURE`;
descendants `CLASSIFICATION_NODE` (depth via `parent_entity_id`, role in `metadata.role`). **No
`GROUP/PROFILE/SUBCATEGORY` types** (would freeze the topology).

## 2. Adapter `entities ↔ ClassificationNode` (pure, in the LIB)

| `ClassificationNode` (LIB) | wire (RFC-0047) | mapper rule |
|---|---|---|
| `key` | `entity_key` | 1:1; the join with the golden `match()` (key-parity). |
| `label` | `metadata.label` | tolerate `string \| {locale}` (§7). |
| `order` | `sort_order` (column) | from the column only; a legacy `metadata.order` is discarded. |
| `icon` | `metadata.icon` | curated token → SVG (render in LIB; validated in GCDR on write). |
| `role` | `metadata.role` | enum. |
| `rules` | `metadata.rules` | `{deviceProfiles,identifierExact,identifierContains,identifierPrefixes}` — **read by the LIB, evaluated by the engine; NEVER a SQL filter predicate**. |
| `formula` | `metadata.formula` | computed nodes; **key-agnostic** (see §C-1). |
| `children[]` | rows via `parent_entity_id` | already ordered by `sort_order`. |

> **`match()` never travels on the wire** — only value lists. The engine is **generic over
> `node.rules`** (a new customer subcategory = data, **no code**). key-parity therefore covers
> **baked ↔ GCDR-`system`** only, never `customer` data.

## 3. LOAD — two contexts (the modal is lazy; the dashboard is not)

- **Dashboard boot (MAIN_VIEW):** classifies **all enabled domains** → loads them at onInit (**not**
  lazy). v1 keeps the current boot classification and adds GCDR boot-load only in a later phase (§D).
- **Modal editing:** **lazy per active tab** (loads the active domain first; others on tab switch).
- Each domain carries its own `X-Version-Id` = the `If-Match` for its save.
- **Cache key = `(customerId, domain, version)`** and is invalidated on save and on customer switch
  (head-office switches customers — keying by domain alone leaks one customer's tree into another).
- **Fallback:** `/resolve` failure → in-bundle **baked** default (`source:'baked'`, logged), **signalled
  as degraded** (never presented as truth — see §C-4). Never a blank dashboard.

## 4. SAVE — per `(customer, domain)`

The modal saves the **active tab's domain**, one `bulk-replace` at a time. **No cross-domain
atomicity** (energy/water/temperature are independent taxonomies). `If-Match` per domain → **409**.

UX: the button **names the domain** ("Salvar Água"); dirty-dot per tab; exit guard on dirty tab; a
**409 is a conversation** ("a classificação mudou há 3 min — recarregar e reaplicar?") with **no
force-overwrite**; "salvo e aplicado" only after it is applied.

## 5. LIB responsibilities (the lib does NO fetch)

Adapter (pure) · engine `match()` (golden, generic over rules, keyed by `entity_key`) · `validateProfile`
/`normalizeProfile` · **baked** versioned default (build-time, key-parity in CI by committed file) ·
icon **render token→SVG + curated picker** (never free emoji) · `ProfileSource` interface. **I/O lives in
MAIN_VIEW**; the **MENU** only opens the modal and delegates save via callback.

## 6. `metadata.label` (i18n tolerance)

Stored today as plain `string` (PT-BR; i18n is YAGNI for internal MYIO ops). The adapter normalizes
from day 1 so the GCDR can later store a locale object without a coordinated PR:
`label = typeof m.label==='string' ? m.label : (m.label['pt-BR'] ?? Object.values(m.label)[0] ?? entity_key)`.

## 7. Mandatory tests (before ship)

**Round-trip + atomicity (integration, real PG):** `resolve(domain) → adapt → reverse-map →
bulk-replace(domain, If-Match) → resolve(domain)` returns an **identical tree**
(key/label/icon/order/role/rules/formula + structure); a stale `If-Match` → **409, zero rows mutated**;
an invalid node → **422, zero writes**.

Plus the consumer checklist (§E).

---

## 8. Status of the original PENDING questions (all closed)

| Question | Resolution |
|---|---|
| Dedicated `/classification-profile` endpoints | ❌ dropped — reuse RFC-0047 `/entities/resolve` + `bulk-replace` + `revert`. |
| Resolve = merge or raw? | whole-config per domain, no per-node merge (no inheritance). |
| `source` per-document or per-node? | per-document (`customer`/`system`). |
| i18n (`label` vs `nameKey`) | `metadata.label`, adapter tolerant (§6). |
| Write scope | `entities:write`, MYIO-only; customer keys read/resolve-only. |
| Versioning header vs body | `X-Version-Id`/`If-None-Match`/304 (read) + `If-Match`/409 (write). |
| Icon-token catalog ownership | Design canonical; GCDR mirrors + validates (422); LIB renders. |

---

## 9. OPEN — consumer stress-test (2026-06-23 roundtable)

### 🚩 A. Questions for the GCDR API backend (block LIB implementation)
1. **Drift detection:** does `/resolve` return a `rules_version`/hash of the **`system`** subtree so the
   LIB can compare with the baked and **flag divergence**? (membership rules drift baked↔online =
   business error in energy; key-parity only covers keys.)
2. **Cross-tree validation:** does `bulk-replace` enforce, server-side, parentage integrity + depth +
   (ideally) unique-allocation / one-fallback-per-level / formula refs → **422 zero-write**, or **only
   Zod per-node**? (defines whether the LIB is the *only* barrier against an inconsistent persisted tree.)
3. **`metadata` jsonb:** the column type + the insert cast (`::jsonb` vs implicit `::text`→jsonb) —
   anti double-serialization (Moxuara precedent).
4. **`If-Match`/ETag:** scope = domain-root or per-node? Does the **409 carry the current `X-Version-Id`**
   (so the client can retry without a blind re-GET)?
5. **`revert`:** strictly intra-`(customer,domain)`; never overwrites `customer` with `system` cross-domain.
6. **Icon catalog:** a consumable endpoint or a versioned mirror — **is it the same source as `deviceIcons`
   (RFC-0200)?** (else the picker offers a token the write rejects.)
7. **Auth scope:** does the MYIO operator's dashboard JWT carry **`entities:write`**? (else `bulk-replace`
   → 403 and the whole edit loop is dead.)
8. **Transactional 422** confirmed even when the failure is cross-tree (not only per-node Zod).

### 🟠 B. Questions for the PO
1. If the save requires an **`X-API-Key` (master)** in the dashboard context → a **security** decision: accept it?
2. Real job frequency (~2.6/month) — confirm cutting boot-non-lazy (lazy + 1-domain is enough)?

### 🔵 C. LIB internal decisions (not for the backend)
1. **Key-agnostic formula** ("sum siblings that are not `role:derived`") instead of a key list → a new
   subcategory enters the roll-up without editing the parent's formula.
2. **Validate cross-tree invariants on READ too** (defense against third-party writes), not only on write.
3. **Cache key `(customerId, domain, version)`** + invalidate on save and on customer switch (cross-customer
   leak = a security incident, not a cache bug).
4. **Offline (baked) is always signalled as degraded**, never presented as truth.
5. **Unknown `rules.op` → throw** (not a silent `match=false`) — stops a silent rules-drift misclassification.
6. **Formula references keys of its own domain only** (no cross-domain refs).
7. Adapter: never `JSON.stringify(metadata)` on save; reject string-in-jsonb on read; `order` from
   `sort_order` only; `label` locale fallback; `null`/missing → documented error/default; stable tie-break
   for null `sort_order` (by `entity_key`).

### 🟢 D. v1 scope (cuts)
- ❌ revert · ❌ icon picker (default icon per subcategory; change via JSON) · ❌ boot-non-lazy via GCDR
  (Phase 2 — v1 keeps the current boot + the modal only).
- ⚠️ 409 = detect + reload (no smart merge). · ✅ subcategory-without-code (non-negotiable).
- **Smallest valuable v1 consumer:** modal with **lazy load of 1 domain + `bulk-replace` of 1 domain + 409
  detection**.

### ✅ E. Test checklist (consumer, beyond §7)
```
[ ] adapter: reject metadata string-in-jsonb (anti-Moxuara)        ← + backend Q (cast)
[ ] adapter: save never JSON.stringify(metadata)
[ ] adapter: order from sort_order only; legacy metadata.order discarded
[ ] adapter: label {locale} fallback + {} + missing locale
[ ] adapter: null/missing (metadata/entity_key/sort_order) → error or documented default
[ ] sort: null sort_order tie-break stable (by entity_key)
[ ] validateProfile: orphan formula ref → error (not NaN)
[ ] validateProfile: parent_entity_id cycle → error before recursion
[ ] validateProfile: parent cross-domain/cross-customer → error
[ ] validateProfile: >1 fallback per level → error
[ ] validateProfile: device in 2 subtrees (unique allocation) → error
[ ] validateProfile: depth > max → error
[ ] engine: unknown rules.op → throw (not silent match=false)
[ ] cache: key (customerId,domain,version); A→B no leak; save invalidates
[ ] boot: N parallel domain loads resolve distinct trees; 304 isolated per domain
```

---

## 10. Remaining work (implementation, not open design)

- **GCDR (RFC-0047):** `entity_types` `CLASSIFICATION_*`; Zod-per-type metadata validation;
  `PUT /entities/bulk-replace` (If-Match per subtree); icon validation against the synced Design set;
  answers to §9.A.
- **LIB:** the pure adapter + `validateProfile` cross-tree (read+write) + baked + key-parity file + icon render/picker.
- **MAIN_VIEW:** `GcdrResolveProfileSource` (lazy + 304 + baked fallback) + `saveDomainClassification`
  (If-Match per domain + 409) + cache `(customerId,domain,version)`.
- **Test:** the round-trip/atomicity integration test (§7) + the §E checklist.

---

_Consolidated consumer contract + pendings for RFC-0207's GCDR integration. When the backend answers
§9.A and ships the RFC-0047 additions, the LIB wires the adapter + MAIN_VIEW sources._
