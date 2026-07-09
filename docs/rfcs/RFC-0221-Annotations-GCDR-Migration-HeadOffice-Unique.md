- Feature Name: `annotations_gcdr_migration_head_office_unique`
- Start Date: 2026-07-09
- RFC PR: (to be filled)
- Status: **PROPOSED — awaiting approval**
- Depends on: RFC-0218 (`GcdrAnnotationsClient`), library changes from RFC-0219 §Library changes
- Companion RFCs: RFC-0219 (v-5.2.0), RFC-0220 (v-5.4.0)

# RFC-0221 — Migrate the head-office UNIQUE dashboard annotations to GCDR (welcome metaCounts + panel)

## Summary
[summary]: #summary

The head-office widget (`src/thingsboard/MYIO-SIM/v5.2.0_UNIQUE/controller.js`, deployed for Sá Cavalcante and Soul Malls) computes the welcome-card **annotation metaCounts by building one full `AnnotationServiceOrchestrator` per shopping**, which fans out one TB attribute read per device — the measured bottleneck of the welcome enrichment (**11–28 s per customer**). This RFC replaces that with **one `listByCustomer` GCDR call per shopping** (RFC-0218 client), and, where the head-office key allows subtree access, potentially **one call for the whole group**. Expected outcome: welcome badges resolve in ~1 s instead of ~1–3 min per group.

## Motivation
[motivation]: #motivation

Call-site inventory (2026-07-09) for `v5.2.0_UNIQUE/controller.js`:

| Call site | What it does | Cost today |
|---|---|---|
| `enrichCardsWithMetaCounts()` (`:1534`, called `:1508/:1718`) → `fetchAnnotationsMeta(customerTbId)` (`:1610`) | builds `MyIOLibrary.buildAnnotationServiceOrchestrator({customerId, tbHost, jwt})` **per shopping card** (`:1613`); iterates `orch.getAll()` for non-archived list (`:1620-1630`); returns `{count: orch.getTotalCount(), list}` (`:1632`); patched into cards via `applyMetaPatch` (`:1703`) | ~1 TB REST call × device × shopping — 11–28 s/customer, gates the welcome CTA |
| direct `log_annotations` | **comment only** (`:1526`) documenting the above | — |
| annotations panel (RFC-0203 header panel) & badges | via the same lib orchestrator | inherits the same cost |

The dashboard's own annotation surface is small (welcome badges + panel); the pain is purely the N-per-device fetch multiplied by 4–6 shoppings, serialized behind the welcome progress bar.

## Guide-level explanation
[guide-level-explanation]: #guide-level-explanation

`fetchAnnotationsMeta` becomes:

```javascript
const client = MyIOLibrary.createGcdrAnnotationsClient({
  domainPath: settings.gcdrAnnotationsBaseUrl || 'https://gcdr-api.a.myio-bas.com/api/v1',
  auth: { apiKey: shoppingAttrs.gcdrApiKey },      // per-shopping key (already cached by getShoppingAttrs)
});
const items = await client.listByCustomer(shoppingAttrs.gcdrCustomerId); // ONE paginated call
const active = items.filter((a) => !a.finalized || a.finalizedReason !== 'archived');
return { count: active.length, list: client.toLegacyAnnotations(active) };
```

- The welcome badge count, tooltip list (`metaDetails.annotations`) and progress task keep their exact contracts — only the fetch inside changes.
- The header annotations panel switches to the GCDR-backed orchestrator (`source: 'gcdr'`, RFC-0219 §Library changes) — one call per selected customer, indices by `gcdrDeviceId`.
- **Subtree optimization (pending RFC-0218 Unresolved Q2)**: both head-office `gcdrApiKey`s proved to be MASTER-scoped (alarms API returns the whole tenant). If `GET /annotations?customerId=<HO>` honors `hierarchyAccess: SUBTREE`, the welcome enrichment collapses to **one single call for all shoppings**, grouped client-side by `customerId`.

## Reference-level explanation
[reference-level-explanation]: #reference-level-explanation

### Widget changes (`v5.2.0_UNIQUE/controller.js`)

1. `fetchAnnotationsMeta(customerTbId)` (`:1610`) — rewritten as above; drop the per-card orchestrator construction entirely. `getShoppingAttrs(tbId)` (existing cache) supplies `gcdrCustomerId`/`gcdrApiKey`.
2. If subtree mode is confirmed: a single `fetchAllAnnotationsForGroup()` before the per-card loop, memoized in module scope; per-card meta = filter by that card's `gcdrCustomerId`.
3. Header annotations panel / `AnnotationServiceOrchestrator` global: built with `source: 'gcdr'` (same params pattern as RFC-0220).
4. `settingsSchema.json`: `gcdrAnnotationsBaseUrl` + `annotationsSource` (default `gcdr` — this widget's annotation surface is read-mostly and the fallback would keep the 28 s cost around).
5. Welcome progress: annotations stop being the bottleneck; the CTA gate logic is untouched (it just resolves faster).

### Prerequisites

Same as RFC-0219: `gcdrCustomerId`/`gcdrApiKey` on the shopping customers (both groups already provisioned), `gcdrDeviceId` on devices for panel drill-down (Soul Malls devices currently lack it — annotations panel lists will be device-anonymous there until GCDR Sync runs; welcome **counts** are unaffected since they don't need device matching), historical migration executed.

### Validation

- Welcome badge counts equal the pre-migration TB counts per shopping (RFC-0216 dump as oracle).
- Wall-clock of the welcome enrichment annotations task: target < 2 s per group (from 11–28 s × N).
- Panel list opens and matches SettingsModal per-device views in the shopping dashboards (cross-check with RFC-0219 pilot customer).

## Drawbacks
[drawbacks]: #drawbacks

- GCDR-first without TB fallback (deliberate): if the annotations endpoint is down, welcome badges show the error state (`—`) — acceptable for meta-information; the fallback would defeat the purpose here.

## Rationale and alternatives
[rationale-and-alternatives]: #rationale-and-alternatives

- **Per-shopping `listByCustomer` (baseline) vs one subtree call (optimization)** — implement the baseline first; flip to subtree when RFC-0218 Q2 is answered. Both are orders of magnitude cheaper than today.
- Keeping the orchestrator-per-card but pointing it at GCDR — rejected: still constructs N orchestrators and N device lists when only counts+list are needed.

## Prior art
[prior-art]: #prior-art

RFC-0219/0220 (shared lib changes), the welcome metaCounts work (rounds 1–3, `enrichCardsWithMetaCounts`/`applyMetaPatch`/progress gate), RFC-0203 header panel, RFC-0216 (counts oracle), master-key finding from the alarms migration (both HO keys tenant-scoped).

## Unresolved questions
[unresolved-questions]: #unresolved-questions

1. Subtree semantics of `GET /annotations?customerId` with a SUBTREE/TENANT key (RFC-0218 Q2) — decides 1 call vs N calls.
2. Should the welcome tooltip list cap at the 10 most recent (like the alarms tooltip) instead of shipping the full list into the card object? (Proposal: yes, cap at 10, count stays total.)

## Future possibilities
[future-possibilities]: #future-possibilities

- Group-level annotations KPI on the header (total per group, drill by shopping) once the subtree call exists.
- Welcome badge click → header annotations panel pre-filtered by that shopping.
