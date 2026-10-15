# RFC-0238 — Demand Panel v2: multi-device telemetry report wizard with GCDR jobs

- **Feature name:** `demand-panel-v2`
- **Start date:** 2026-10-08
- **Status:** **Final rev. 4 (2026-10-08)** — design closed for the frontend; the frontend component
  and its dashboard integration are implemented (see §11 *Implementation status*). Open decisions
  that block later milestones are listed, with owner and milestone, in §13 — they are **open**, not
  approved defaults.
- **Branch:** `demand-panel-v2` (from `desenv` `ca9d9e9c`)
- **Related:** RFC-0015 (DemandModal), RFC-0084 (RealTimeTelemetryModal), RFC-0181/0182 (Relatórios
  menu / enabled report items), RFC-0199 (MyIOAuthContext), RFC-0200 (device icons), RFC-0205
  (premium dialog), RFC-0207/0234 (device classification taxonomy from GCDR), ED-1251 (unified
  "Telemetrias Instantâneas e Pico de Demanda" button)
- **Companion:** GCDR **RFC-0075 "Report Jobs"** (`gcdr.git/docs/rfcs/RFC-0075-Report-Jobs.md`) —
  API, worker, storage, download and retention are **deployed** (`REPORT_JOBS_ENABLED`).

> **Rev. 5 (2026-10-11) — aligned with the deployed GCDR contract (RFC-0075 §5, L-1…L-19).** Where
> this document and RFC-0075 differ, **RFC-0075 wins**; the sections below keep the rev. 4 design
> rationale. What changed in the library:
>
> | Topic | Rev. 4 (this doc) | Rev. 5 (implemented) |
> |---|---|---|
> | Grouping | Bruto or AVG/MAX/MIN/SUM × 15 min…1 dia | **Resolution only**: `1m` (≤ 1 d) · `5m` (≤ 7 d) · `15m` (≤ 31 d) · `1h` · `1d` (≤ 92 d). Every row has **avg / max / min / samples**; no raw mode. `consumption` adds the 15-min demand series ("Potência média em 15 min (demanda estimada)", `demandLabel` from config) |
> | Buckets | clock grid from local midnight | anchored at the period `start`; `1d` = local calendar days and **`start` at local midnight** (L-9) |
> | Request | `aggregation`, `fillGaps`, `period.startUtc/endUtc` | strict GCDR shape: `{ devices[{gcdrDeviceId, …}], period{start,end,timezone,preset}, resolution, telemetries, estimate }` |
> | Hash | `rmc-json-sha256-v1` projection, `sha256:` prefix | **canonicalisation v2** of the request (strip device label/name + estimate), lowercase hex; shared fixture `tests/fixtures/reports/request-hash-v2.json` (L-8) |
> | Submit | `protocolVersion`, `declaredRequester` | `schemaVersion: 1`, `requestedBy: { userId }`, optional `force/visibility/notify` stored in the envelope and replayed on resend (L-3, L-19) |
> | Envelope | schemaVersion 1 | **schemaVersion 2** (schema-1 drafts read as illegible) |
> | Flow | submit → poll | step 4 calls **`validate`** before the envelope is written (errors, warnings, quotas, reusable result — L-10, X-L1, X-L2); resend re-validates (L-19) |
> | Status | 5 statuses | + `expired`; `resultAvailability` is the download rule (`purged` → "Conteúdo removido"); only `notFound`/`JOB_NOT_FOUND` means not received; query failures never resend (L-1, L-2, L-13, L-16) |
> | Result | delivery open (Q8) | presigned URLs for **XLSX / CSV / JSON**, 3 days; "Maior pico individual" from `totals.largestDevicePeak` (L-5, L-14, X-L4) |
> | Limits | 3 active jobs per customer | GCDR quotas: 10 per user · 30 per customer · 20 executions/day (from `config`/`validate`) |
>
> **Deployment blocker found (2026-10-11):** the dashboard's GCDR customer key reads the config
> (`reports:read`) but **lacks `reports:write`** → `validate`/`submit` answer 401. The panel shows it
> on step 4 and writes nothing; the key needs the scope before release.

## 1. Summary

The Shopping dashboard's "⚡ Telemetrias Instantâneas e Pico de Demanda" modal works on **one device
at a time** and computes everything **in the browser**. Demand Panel v2 is a **4-step wizard** that
only **describes** a multi-device report and **requests a job**:

1. **Dispositivos** — search, add to a list, remove from the list; chips from the dynamic taxonomy.
2. **Período e agrupamento** — period presets / custom range, and the grouping rules of the live
   modal (Bruto, or Média / Máximo / Mínimo / Soma per interval).
3. **Telemetrias** — the live modal's catalogue (14 keys).
4. **Resumo** — everything chosen and **Confirmar e enviar**.

| ThingsBoard (customer SERVER_SCOPE attribute) | GCDR (API + worker) |
|---|---|
| **Audit envelope**: who, when, what (+ audit events of user actions) | Validates, runs the job, owns **status**, **result** and **download** |
| One key per job, written before the job is sent | Source of truth for everything after the request |

**No telemetry, result, file URL or execution status is stored in ThingsBoard.**

**Positioning:** live / one device → the current modal; history / several devices / auditable →
Demand Panel v2. They coexist.

## 2. Users and success metrics

| Persona | Job to be done | Needs |
|---|---|---|
| Shopping energy manager (customer) | Prove the demand peak / contest the bill | Billable demand (Q4), per meter, exportable |
| Operations / maintenance | Investigate phase imbalance or voltage issues | Phases side by side, fine interval or raw data |
| MYIO support | Reproduce what the customer saw; answer "who asked for what" | Audit envelope + same result |

Which persona is user #1 is decision **O-1** (§13). Success metrics (targets: O-4): % of succeeded
jobs downloaded; confirm→download time (p50/p95); fewer >7-day queries in the live modal; failed jobs
by `error.code`.

## 3. User flow (guide level)

Entry: **Menu › Relatórios › ⚡ Energia › "Demandas e Telemetrias"** (card shown when the MAIN_VIEW
setting `enabledReportItems.energy_demand_telemetry` is on — §10). If 3 jobs are already active, a
banner says so **on step 1** with who/when, not only at the end.

**Step 1 — Dispositivos.**
- Search (label, name, identifier, profile; accent/case-insensitive, match highlighted).
- **Chips from the dynamic taxonomy** (GCDR → active classification profile, RFC-0207/0234): only the
  categories present in the list, with counts (e.g. Entrada · Climatização · Elevadores · Escadas
  Rolantes · Lojas). Devices of the `ocultos` group are not offered.
- Each row: the **standard device icon** (`getDeviceIcon(deviceProfile)`, RFC-0200), label, category,
  name · identifier. Same-label devices show the identifier.
- "+ Adicionar", "✕ Remover", "Limpar lista", "Adicionar todos (n)" — asks before cutting at the 50
  limit. **Enter** adds only when exactly one result remains.
- Eligibility (current flow needs the GCDR link): **without `gcdrDeviceId` → blocked** ("⛔ sem vínculo
  GCDR"); **without `ingestionId` → allowed with a warning** ("⚠ sem vínculo de dados", Q3).

**Step 2 — Período e agrupamento.**
- Presets (Hoje, Ontem, Últimos 7 dias, Este mês, Mês passado) or custom start/end (end exclusive).
- **Agrupamento** — the same model as the "Por período" tab of `RealTimeTelemetryModal`:

| Agregação | Shown | Rule |
|---|---|---|
| **Bruto** (`NONE`) | — | Every raw sample of the period, as recorded. **No grouping interval and NO point limit** (unlike the live modal, which caps raw points at 100…50 000 — owner's decision, 2026-10-08). Max period 31 days. No size estimate. |
| **Média / Máximo / Mínimo / Soma** (`AVG` / `MAX` / `MIN` / `SUM`) — default **Máximo** | **Intervalo de agrupamento**: 15 min · 30 min · 1 h · 2 h · 4 h · 12 h · 1 dia (default **1 dia**) | One point per interval. An interval without telemetry **repeats the previous value**, flagged as *carried* (the live modal paints it purple). Max period: 15 min ≤ 31 d · 30 min ≤ 62 d · 1 h…1 dia ≤ 92 d. |

- Changing the aggregation/interval **never changes the period by itself**; an invalid combination
  offers fixes: "Usar \<finest interval that fits\>" (or, from Bruto, "Agrupar por \<interval\>
  (Máximo)") and "Encurtar para os últimos N dias". Presets beyond the limit are disabled.
- Intervals sit on the local clock grid (00:00, 00:15…); partial intervals at the edges count.

**Step 3 — Telemetrias.** Cards per quantity with select-all (label + unit; technical keys only in
support mode):

| Group | Keys |
|---|---|
| Potência (W) | `consumption` Potência Total, `a`/`b`/`c` Potência Fase A/B/C |
| Tensão (V) | `voltage_a`/`voltage_b`/`voltage_c` |
| Corrente (A) | `current_a`/`current_b`/`current_c`, `total_current` Corrente Total |
| Fator de potência (fp) | `fp_a`/`fp_b`/`fp_c` |

These are the 14 keys `EnergyModalView` passes to `RealTimeTelemetryModal` (ED-1251).

**Step 4 — Resumo.** Requester, devices, period (with the instant presets were computed at), grouping
(e.g. "Máximo · 1 dia" or "Bruto · todos os pontos"), telemetries, and **size**: aggregated → small /
medium / large with "≈ N linhas de dados" (details collapsible); Bruto → "não estimado — todas as
amostras do período". Text: *"Seu pedido fica registrado (quem, quando, o quê) e é processado em
segundo plano. Você pode fechar este painel e acompanhar em Relatórios."*

**Relatórios tab.** Cards with a human title ("12 medidor(es) · 01/09–30/09 · Máximo · 1 dia"),
requester name and time, status chip (§6), progress bar; actions Cancelar, Reenviar, Baixar,
Duplicar e editar; "Detalhes / auditoria" only in support mode (O-11).

## 4. Architecture

```text
src/utils/reports/demand/              pure logic, no DOM (Vitest)
  types.ts      envelope, request, ports, job view
  catalog.ts    telemetry catalogue (CATALOG_VERSION), intervals, aggregations, limits
  period.ts     presets, clock-grid buckets, period validation
  hash.ts       request hash (shared contract with GCDR)
  envelope.ts   buildRequest / buildEnvelope / toSubmitCommand / parseEnvelope / uuidv7
  jobs.ts       presentation state, polling set, batch merge, audit reconciliation
  taxonomy.ts   filter chips from the dynamic taxonomy (injected classifier)
src/components/demand-panel-v2/        DOM component
  openDemandPanelV2.ts   premium modal (shell + standard header + premium footer)
  adapters.ts            ThingsBoard store, GCDR client, device adapter, user from JWT
  styles.ts              scoped CSS (theme via --myio-* tokens)
```

Building blocks reused (no new UI primitives): `createModal` premium shell with the **standard header
(close / maximize)**, `createModalFooter`, `MyIOToast`, `openConfirmDialog` (RFC-0205),
`getDeviceIcon` (RFC-0200), `resolveGroup` / `resolveCategory` / `liftProfileToTree` (RFC-0207).

**Ports** — the component never calls ThingsBoard or GCDR directly:

```ts
interface EnvelopeStore {           // customer SERVER_SCOPE attributes
  keys(o?: { signal?: AbortSignal }): Promise<string[]>;
  get(keys: string[], o?): Promise<Array<{ key: string; value: unknown; lastUpdateTs?: number }>>;
  put(key: string, envelope: DemandReportEnvelopeV1, o?): Promise<void>;
  appendAudit(key: string, event: AuditEvent, o?): Promise<DemandReportEnvelopeV1>;
}
interface ReportJobsApi {           // GCDR, §8
  submit(cmd: SubmitCommand, o?): Promise<GcdrJobView>;
  batchGet(jobIds: string[], o?): Promise<BatchResult[]>;   // one result per id: found | not found
  active(o?): Promise<GcdrJobView[]>;                       // authoritative active jobs of the customer
  cancel(jobId: string, declared?: { tbUserId: string }, o?): Promise<GcdrJobView>;
  download(jobId: string, o?): Promise<unknown>;            // delivery: Q8
}
openDemandPanelV2({ devices, customer, user, store, api, preselect?, theme?, themeMode?,
  supportMode?, includeDeclaredRequester?, classifier?, graceMs?, idempotencyWindowMs?,
  pageSize?, pollMinMs?, pollMaxMs?, now?, idGen?, sha256?, onClose? }): { close(); refresh() }
```

Every port call receives an `AbortSignal` scoped to the panel instance; `destroy` aborts them and
late responses never touch the DOM. **Aborting a request never cancels a job** in GCDR; on reopen the
envelope is reconciled.

## 5. The audit envelope (schemaVersion 1)

Attribute **`demandReportJob_<jobId>`** in the **customer's SERVER_SCOPE** — one key per job (no
lost updates between users; ThingsBoard attributes have no compare-and-set).

```ts
interface DemandReportEnvelopeV1 {
  schemaVersion: 1;
  type: 'demand-report';
  jobId: `drj_${string}`;              // drj_ + UUID v7 (client clock)
  catalogVersion: number;
  hashAlgorithm: 'rmc-json-sha256-v1';
  requestHash: string;                 // 'sha256:<hex>' — §7
  requestedAt: string;                 // DECLARED (browser clock) — informative
  requestedBy: { tbUserId: string; name: string; email?: string };   // fields subject to O-9 (LGPD)
  customer: { tbCustomerId: string; gcdrCustomerId: string; name: string };
  request: DemandRequest;
  audit: AuditEvent[];
}
interface DemandRequest {
  devices: Array<{ tbDeviceId: string; gcdrDeviceId: string | null; ingestionId: string | null;
    label: string; name: string; identifier: string | null; deviceProfile: string; group?: string | null }>;
  period: { startUtc: string; endUtc: string; timezone: 'America/Sao_Paulo'; preset: PeriodPreset };
  aggregation: 'NONE' | 'AVG' | 'MAX' | 'MIN' | 'SUM';
  resolution: '15m' | '30m' | '1h' | '2h' | '4h' | '12h' | '1d' | null;   // null for Bruto
  fillGaps: boolean;                                                         // true when aggregated
  telemetries: Array<{ key: string; label: string; unit: string }>;
  estimate: { buckets: number | null; points: number | null };              // null for Bruto
}
interface AuditEvent {
  op: 'submit' | 'resend' | 'cancel';
  outcome: 'requested' | 'accepted' | 'rejected';
  at: string; by: string;                       // by = ThingsBoard user id
  code?: string; httpStatus?: number; message?: string;   // rejected only
  source?: 'reconciled';
}
```

- `request` and `requestedAt/By` are **never rewritten**. A resend sends the **stored snapshot and
  hash** — presets are not recomputed and device metadata is not refreshed; "Duplicar e editar"
  creates a **new** request (new `jobId`).
- **Audit events** (not a copy of the execution status — `queued/running/succeeded` are never
  written):

| Event | Written when | Meaning |
|---|---|---|
| `submit.requested` | with the envelope, before calling GCDR | intent |
| `submit.accepted` / `resend.accepted` | GCDR answered 2xx | GCDR has the job |
| `submit.rejected` / `resend.rejected` | GCDR answered 4xx (`code`, `httpStatus`, `message`) | refused — e.g. `VALIDATION_FAILED`, `ACTIVE_JOBS_LIMIT`, `FORBIDDEN`, `JOB_ID_CONFLICT`, `HASH_MISMATCH`, `IDEMPOTENCY_WINDOW_EXPIRED` |
| `cancel.accepted` / `cancel.rejected` | GCDR answered the cancel | same |
| *(nothing)* | timeout / network error / 5xx | **not a rejection** — the outcome is uncertain |

- **Best effort.** Appending is a read-modify-write of one key; a concurrent action or a failed TB
  write can lose an event. **Reconstructible** from GCDR (appended with `source: "reconciled"`):
  `submit.accepted` (the job exists) and `cancel.accepted` (`cancelledBy/At`). **Not reconstructible:**
  rejections and resend attempts. Whether this is acceptable is **O-8**.
- **Time.** `requestedAt` is declared by the browser; the attribute's `lastUpdateTs` changes on every
  append (it is the last write, not the creation); GCDR's `createdAt` is the authoritative execution
  time. UUID v7 ordering and the grace/idempotency ages use the client clock — a wrong client clock
  can misplace a request in the list order; the active-jobs view (§6) does not depend on it.
- `parseEnvelope` validates what is read: unknown `schemaVersion` or invalid JSON is counted as
  "ilegível" and never breaks the list.

## 6. Sending, recovery and job states

**Sequence.** (1) write the envelope → (2) `POST` the command to GCDR → (3) poll.

- **(1) uncertain write** (timeout): read the key back; if it holds the same `requestHash`, reuse it
  **without rewriting** (appended audit is never overwritten by the initial copy); if absent, write
  again with the **same** `jobId`; anything else is an error and nothing is sent.
- **(2) uncertain send** (no response / 5xx): one automatic retry with the same `jobId`, payload and
  hash. Then the job stays **uncertain** and is polled.
- **Retry is safe only inside GCDR's idempotency window** (same customer, same `jobId`, same content,
  same hash rule, within the agreed retention — Q5/O-17). After it, the panel never treats a repeat
  as idempotent ("Prazo de reenvio expirado" → Duplicar e editar).
- GCDR looks up an existing `jobId` **before** applying the active-job limit, so a valid retry is
  never refused by a queue that already contains it.

**Presentation states** (client-only, never written to TB):

| State | When | Actions |
|---|---|---|
| Enviando… | request in flight, or `404` inside the grace period (read-after-write lag) | — |
| Confirmando envio… | last send had no response, inside the grace period | Reenviar (idempotent) |
| Não enviado | `404` confirmed after the grace period, inside the idempotency window | Reenviar |
| Status indisponível | the status query failed (network, 401/403, 5xx) — **not** "not found" | Reenviar (idempotent), Tentar de novo |
| Recusado | last submit/resend was rejected (`code`) | 422 → Duplicar e editar; 429 → Reenviar when a slot frees |
| Prazo de reenvio expirado | not found and outside the idempotency window | Duplicar e editar |
| Na fila / Processando n % | GCDR `queued` / `running` | Cancelar |
| Concluído | `succeeded`, result available | Baixar, Duplicar e editar |
| Arquivo expirado | `succeeded`, result no longer available (`result.available = false`) | Duplicar e editar |
| Falhou / Cancelado | `failed` (message first, code in support mode) / `cancelled` | Duplicar e editar |

- A `404` after GCDR already confirmed the job (read-after-write lag) **does not downgrade** the last
  confirmed state.
- Nothing stays "Enviando…" forever: the panel re-queries exactly when the grace period ends.
- **Polling**: one `batchGet` per tick with the active/uncertain ids + the active-jobs query; 5 s ×1.5
  up to 30 s; paused while the tab is hidden, immediate query on return; stopped on close.
- **Active jobs / limit**: the banner and the blocked "Confirmar" come from GCDR's active-jobs query
  (independent of the TB page, includes jobs without envelope). GCDR enforces the limit atomically;
  the UI only anticipates it.
- **Cancel**: `openConfirmDialog` (danger) → GCDR; the UI shows GCDR's answer **first**; then
  `cancel.accepted` is appended — if that append fails, the cancel is still reported as done and a
  warning says the audit will be reconciled.
- **Badge outside the panel** (O-13): v2.0 does not poll after the panel closes; the state refreshes
  on the next open.

## 7. Request hash (`rmc-json-sha256-v1`)

1. **Projection** — what defines the work: `{ type, catalogVersion, devices: sorted gcdrDeviceIds,
   period: { start, end, timezone }, aggregation, resolution (null for Bruto), fillGaps,
   telemetries: sorted keys }`. Labels, names, TB/ingestion ids, preset and estimate are excluded.
2. **Canonical JSON** — object keys sorted (UTF-16 code units) recursively, arrays in the order above,
   no whitespace, strings/numbers/null as `JSON.stringify`, instants as `toISOString()` UTC.
3. `"sha256:" + hex(SHA-256(UTF-8(canonical)))`.

GCDR **recomputes** the hash from the received request (`422 HASH_MISMATCH` on divergence). Test
vector (in `tests/utils/reports/demand/demand.test.ts`):

```json
{"aggregation":"MAX","catalogVersion":1,"devices":["gcdr-1","gcdr-2"],"fillGaps":true,"period":{"end":"2026-10-08T03:00:00.000Z","start":"2026-10-01T03:00:00.000Z","timezone":"America/Sao_Paulo"},"resolution":"15m","telemetries":["consumption","voltage_a"],"type":"demand-report"}
```

After Q4 is decided, a `processingVersion` (semantics of the job's statistics) joins the projection.

## 8. GCDR API (contract for the companion RFC)

Paths are scoped by customer so `403` (wrong credential/customer) is never confused with `404`.

| Capability | Method / path | Notes |
|---|---|---|
| Submit | `POST /api/v1/customers/{cid}/report-jobs` | body = `SubmitCommand` (below); `202` new · `200` same `jobId`+hash (idempotent) · `409 JOB_ID_CONFLICT` · `410 IDEMPOTENCY_WINDOW_EXPIRED` · `422 VALIDATION_FAILED / HASH_MISMATCH` · `429 ACTIVE_JOBS_LIMIT` (+`Retry-After`) |
| Batch query | `POST …/report-jobs:batchGet` `{ jobIds }` | `{ results: [{ jobId, found: true, job } \| { jobId, found: false }] }` |
| Active jobs | `GET …/report-jobs?type=demand-report&status=queued,running` | items with requester and summary (banner) |
| List | `GET …/report-jobs?type=demand-report&limit&cursor` | cursor pagination |
| Cancel | `POST …/report-jobs/{jobId}/cancel` | `200 cancelled` · `409 ALREADY_FINISHED`; stores `cancelledBy/At` |
| Download | `GET …/report-jobs/{jobId}/result` | delivery open (Q8); `410 RESULT_EXPIRED` |

```ts
interface SubmitCommand {
  protocolVersion: 1; jobId: string; type: 'demand-report';
  catalogVersion: number; hashAlgorithm: string; requestHash: string;
  requestedAt: string; request: DemandRequest;
  declaredRequester?: { tbUserId: string };   // ONLY if the O-7 model keeps declared identity
}
interface GcdrJobView {
  jobId: string; status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress: number | null; createdAt: string; finishedAt?: string | null;
  requestedBy?: { principal: string; declared?: { tbUserId: string } | null };
  summary?: { deviceCount; start; end; aggregation; resolution; telemetryCount };
  cancelledBy?: { principal: string; declared?: { tbUserId: string } | null } | null; cancelledAt?: string | null;
  error?: { code: string; message: string; retryable?: boolean } | null;
  result?: { available: boolean; expiresAt?: string } | null;   // "Concluído" ≠ downloadable forever
}
```

Error body: `{ "error": { "code", "message", "details", "retryable" } }`.

**Validation in GCDR** (it never reads the TB envelope): limits (§9), aggregation × interval × period,
telemetry keys against its catalogue version, and **that every `gcdrDeviceId` belongs to `{cid}`**,
resolving `ingestionId` and aliases of the same meter itself (a browser-sent TB/ingestion id is never
trusted).

**Result semantics** (decided with Q4, versioned): aggregation per quantity, bucket alignment
(local clock grid, edge buckets counted), timestamp of extremes (MAX/MIN), units in/out (the live
modal converts aggregated Wh → kWh), rounding, gap filling (`fillGaps`: carried value flagged), and
**partial results** — a device/telemetry without data is reported with coverage metadata, **never as
zero** (whether it fails the job or succeeds with warnings is O-19).

## 9. Limits (UI anticipates; GCDR enforces)

| Limit | Value |
|---|---|
| Devices per job | 50 |
| Telemetries per job | 14 (whole catalogue) |
| Period — aggregated | 15 min ≤ 31 d · 30 min ≤ 62 d · 1 h / 2 h / 4 h / 12 h / 1 dia ≤ 92 d |
| Period — Bruto | ≤ 31 d; **no point limit** |
| Estimated points (aggregated only) | ≤ 2 000 000 |
| Active jobs per customer | 3 |
| Periods before 2019-03-01 | rejected (São Paulo DST ended 2019-02-17; UTC-03:00 is exact after it) |

## 10. Dashboard integration (Shopping v-5.2.0)

- **MAIN_VIEW `settingsSchema.json`**: `enabledReportItems.energy_demand_telemetry` ("Energia —
  Demandas e Telemetrias (RFC-0238)", default **off**). MAIN_VIEW publishes it in
  `MyIOUtils.enabledReportItems` (RFC-0182 path) and adds `openDemandPanelV2`,
  `createTbEnvelopeStore`, `createGcdrReportJobsApi`, `demandDevicesFromItems`, `tbUserFromJwt` to the
  library bridge (`LIB_SYMBOLS`) — child widgets never read `window.MyIOLibrary` directly.
- **MENU**: card "⚡ Demandas e Telemetrias" in Relatórios › Energia (locked when the flag is off).
  It opens the panel with:
  - devices = orchestrator energy groups except `ocultos`, through `demandDevicesFromItems` (uses
    `tbId` only; never fills one id namespace with another);
  - `store` = `createTbEnvelopeStore({ tbBaseUrl, customerId: customerTB_ID })`;
  - `api` = `createGcdrReportJobsApi({ baseUrl: MyIOOrchestrator.gcdrApiBaseUrl, gcdrCustomerId,
    getHeaders: X-API-Key / X-Tenant-ID })`;
  - user = `tbUserFromJwt(jwt)`; theme = `MyIOUtils.theme`.
- The "Relatórios" menu link must exist in the MENU widget's `links` (content containing "Relat").
- **Authentication note**: `MyIOAuthContext` (RFC-0199) is a **presentation control** (it hides UI);
  it does not authenticate calls. Effective authorization (who may submit/list/cancel/download,
  "only the requester cancels", "raw audit only for support") must be enforced by GCDR or a proxy —
  O-7. Hiding the audit JSON in the UI does not restrict reading the TB attribute through the API.

## 11. Implementation status

Legend: **D** documented · **I** implemented · **V** verified (tests / showcase).

| Item | D | I | V | Where |
|---|---|---|---|---|
| Pure logic (catalogue, period/buckets, hash, envelope, job states, reconciliation, taxonomy chips) | ✓ | ✓ | ✓ 22 Vitest | `src/utils/reports/demand/`, `tests/utils/reports/demand/` |
| Component (wizard, jobs list, standard header/footer, toast, dialogs, icons, taxonomy chips, grouping) | ✓ | ✓ | ✓ 4 Vitest (jsdom) | `src/components/demand-panel-v2/`, `tests/components/demand-panel-v2.test.ts` |
| Real adapters (TB store, GCDR client, devices, user) | ✓ | ✓ | — | `adapters.ts` (GCDR API does not exist yet) |
| Library exports (`openDemandPanelV2`, adapters, `MyIOLibrary.demandReport`) | ✓ | ✓ | ✓ build | `src/index.ts` |
| v-5.2.0 integration (setting, bridge, MENU card) | ✓ | ✓ | partial (showcase run pending) | MAIN_VIEW, MENU |
| Showcase `showcase/main-view-shopping` running the real v-5.2.0 widgets | ✓ | ✓ | ✓ live data (14 widgets) | `index.html` + `v-5.2.0.layout.json` |
| Mocked showcase `showcase/demand-panel-v2` | — | prototype only | — | superseded by the component; to be rewired to it |
| GCDR report-jobs API, worker, storage, download, retention, auth | ✓ (§8) | ✗ | ✗ | companion RFC |
| CUSTOMER_USER read/write of SERVER_SCOPE in the deployed TB | — | — | ✗ **not verified** | M0 |

## 12. Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| AC-01 | Search by label/name/identifier/profile, accent-insensitive; taxonomy chips only for present categories, with counts | V |
| AC-02 | Add/remove; dedupe by `tbDeviceId`; same-label shows identifier; "Adicionar todos" asks before cutting at 50; Enter adds only a single remaining result | I |
| AC-03 | Presets as half-open ranges in America/Sao_Paulo; clock-grid buckets with partial edges (10:07→11:07 @15 min = 5; 23:00→01:00 @1 dia = 2); leap years / month edges | V |
| AC-04 | Grouping = live modal model: Bruto (no interval, **no point limit**, ≤ 31 d) or AVG/MAX/MIN/SUM × 15 min…1 dia; aggregated fills gaps (carried); defaults Máximo · 1 dia | V (lib) / I (UI) |
| AC-05 | Changing aggregation/interval never changes the period; fixes offered; presets beyond the limit disabled | I |
| AC-06 | Telemetry catalogue = 14 keys/labels/units of the live modal; ≥ 1 required | V |
| AC-07 | Summary shows every choice; size estimate for aggregated, "não estimado" for Bruto; blocks above 2 M points | I |
| AC-08 | Envelope written **before** GCDR; no status/result/URL in it; `parseEnvelope` tolerates unknown versions | V |
| AC-09 | Uncertain TB write → read back and reuse (no rewrite); uncertain send → one retry, same `jobId`; never "Enviando…" forever | V (send) / I (TB) |
| AC-10 | Retry only inside the idempotency window; outside → "Prazo de reenvio expirado" | V |
| AC-11 | 422 never offers resend; 429 offers it when a slot frees; timeouts never recorded as rejection | V |
| AC-12 | Status from GCDR batchGet (found / not found per id); transient 404 does not downgrade; query failure ≠ not found | V |
| AC-13 | Active-jobs banner/limit from GCDR active query, independent of the TB page | I |
| AC-14 | Cancel via `openConfirmDialog`; UI reflects GCDR first; failed audit append → warning + reconciliation | I |
| AC-15 | Reconciliation appends only `submit.accepted` / `cancel.accepted` with `source: reconciled` | V |
| AC-16 | Standard header (close + maximize), premium footer, `MyIOToast`, standard device icons | V |
| AC-17 | `destroy` aborts requests and clears timers/listeners; late responses ignored | I |
| AC-18 | MENU card behind `enabledReportItems.energy_demand_telemetry`; opens the panel with orchestrator devices and real adapters | I |
| AC-19 | GCDR contract (§8) implemented; first downloadable format with verifiable content (Q8) | — (GCDR) |

## 13. Open decisions (owner · milestone blocked)

Milestones: **M0** architecture validation (deployed TB permissions, auth model, ID provenance) ·
**M1** contract freeze with the GCDR companion RFC · **M2** internal α (real adapters + GCDR API) ·
**M3** customer release (download real).

| # | Question | Owner | Blocks |
|---|---|---|---|
| O-1 | User #1 on day 1: shopping energy manager or MYIO support? | Product (Rodrigo) | M3 |
| O-2 | Release gate: internal α first; customers only after Q8 delivers a real file? | Product | M3 |
| Q4 | Result semantics: billable demand (15-min average) vs instantaneous peak; statistics per aggregation; units/rounding — fixed as a versioned `processingVersion` | Product + GCDR | M1 |
| O-19 | Partial results: missing device/telemetry → job fails, or succeeds with coverage warnings? (never zero) | Product + GCDR | M1 |
| Q8 | Result storage and download delivery (format(s), signed URL / stream / e-mail, scope of access, expiry) | GCDR | M3 |
| O-7 | Authentication model: per-user GCDR token, proxy validating the TB JWT, or shared customer key + declared identity (then no per-user restrictions are enforceable) | Architecture | M0 |
| M0-1 | Verify in the deployed TB that CUSTOMER_USER can read and write the customer's SERVER_SCOPE (if not: proxy, which changes the adapters) | Engineering | M0 |
| Q5 / O-17 | Retention: envelopes in TB (cleanup owner, keep pending ones), job metadata + idempotency window in GCDR, result files; resend window must be ≤ idempotency retention | Product + GCDR | M1 |
| O-8 | Is best-effort audit acceptable (some events non-reconstructible), or one key per event? | Product | M1 |
| O-9 | LGPD: requester e-mail/name in the attribute, or `userId` only? | Product / DPO | M2 |
| Q3 | Devices without `ingestionId`: block, or GCDR resolves an authorized fallback? | Product + GCDR | M2 |
| O-18 | GCDR devices without a ThingsBoard id: excluded (current) or offered with another selection identity? | Product | M2 |
| Q6 / Q7 | Who may cancel; who may request (any customer user or a role)? — needs O-7 | Product | M2 |
| O-6 | Jobs created in GCDR without TB envelope: valid (support only) or anomaly? | Product | M2 |
| O-11 | Raw audit JSON: support/SuperAdmin only? (UI only — see §10 note) | Product | M3 |
| O-12 | "Duplicar e editar" from a relative preset: recompute up to now (current) or repeat the dates? | Product | M3 |
| O-13 | Notification when a job finishes with the panel closed (badge / bell / e-mail) | Product | M3 |
| O-16 | Partial "Hoje"/"Este mês" ending now (current) or closed days only? | Product | M2 |
| O-20 | Bruto period limit of 31 days — keep, change or remove (there is no point limit)? | Product | M1 |
| O-3, O-4, O-14, O-15 | Others' reports visibility; success targets; free-text report name; mobile priority | Product | M3 |

## 14. Delivery plan

1. ✅ Design + pure logic + component + adapters + v-5.2.0 integration (this branch).
2. **M0** — verify TB permissions and decide the auth model (O-7, M0-1); confirm the device adapter on
   the target dashboard version.
3. **M1** — GCDR companion RFC freezes §7/§8 (hash vectors shared), Q4 semantics, retention.
4. Rewire `showcase/demand-panel-v2` to the real component with mocked ports and deterministic failure
   scenarios (lost response on submit and on TB write, append refused, transient 404, active job
   outside the first page, expired result, conflicting payload) — each with expected UI state,
   persisted records and number of executions.
5. **M2** — internal α with the real GCDR API; **M3** — customer release after Q8.
6. Single final PR to `desenv`.

## 15. Drawbacks and alternatives

- Depends on a GCDR backend that does not exist yet.
- One attribute per job grows the customer's SERVER_SCOPE (retention needed); the TB audit is best effort.
- Rejected: one attribute holding an array (lost updates); mirroring status/result in TB (two sources of
  truth); jobs only in GCDR (audit must live in TB); GCDR reading the TB envelope (coupling); computing in
  the browser (TB limits, frozen tab, no audit); a raw point limit (owner: Bruto returns everything).

## Appendix A — Decision log

| Rev. | Decision | By |
|---|---|---|
| 1 | 4-step wizard; one SERVER_SCOPE key per job; client `jobId`; GCDR job with polling | design |
| 2 | TB keeps only the request envelope for audit; GCDR owns execution, status, result and download; storage/download to be evaluated | owner |
| 3 | BMAD round (users, metrics, ports, types, UUID v7, half-open period, error model, UX) | BMAD party mode |
| 4 | Feedback v1 + review applied: uncertain write/send handling, idempotent retry only inside the GCDR window, presentation states, full `SubmitCommand` + shared hash contract, authoritative active-jobs query, per-id `batchGet`, retention tied to idempotency, ID provenance in the adapter, events with op/outcome (timeouts not recorded), clock-grid buckets, `lastUpdateTs` not authoritative, `AbortSignal` per instance, open decisions kept open with owner/milestone. Component implemented with the lib's standard header/footer/toast/dialog/icons and dynamic taxonomy chips; integrated in v-5.2.0 (setting + bridge + MENU card). **Grouping = live modal model; Bruto has no point limit.** | owner + external review |
