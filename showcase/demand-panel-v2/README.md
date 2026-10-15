# Demand Panel v2 — mocked prototype (RFC-0238)

Prototype of the multi-device telemetry report wizard described in
[`docs/rfcs/RFC-0238-Demand-Panel-v2-Report-Jobs.md`](../../docs/rfcs/RFC-0238-Demand-Panel-v2-Report-Jobs.md) (rev. 2).
Everything is mocked: no ThingsBoard, no GCDR, no library build needed.

**Split of responsibilities (rev. 2):** ThingsBoard keeps only the **audit envelope** of the request
(who, when, what + append-only `audit` of user actions) in the customer SERVER_SCOPE attribute
`demandReportJob_<jobId>`. GCDR owns the job: status, result and download. No telemetry, result, file URL
or status is written to ThingsBoard.

## Run

```bash
showcase/demand-panel-v2/start-server.bat   # Windows (or start-server.sh)
# open http://localhost:3348/showcase/demand-panel-v2/
showcase/demand-panel-v2/stop-server.bat    # stop
```

## What it shows

| Step | What to try |
|---|---|
| 1 Dispositivos | search (accent/case-insensitive, highlights the match), group chips, **+ Adicionar**, Enter adds the first result, "Adicionar todos os resultados", **✕ Remover**, "Limpar lista", 50-device limit; devices without `ingestionId` show ⚠ |
| 2 Período | presets, custom start/end, per-resolution period limit (1 min ≤ 1 day … 1 h ≤ 92 days) |
| 3 Telemetrias | same catalogue as "Telemetrias Instantâneas e Pico de Demanda" (Potência, Tensão, Corrente, Fator de potência), select-all per group |
| 4 Resumo | every choice, point estimate vs. the 2,000,000 limit, preview of the audit envelope; **Confirmar e enviar** |
| Relatórios | envelopes read from `demandReportJob_*` ⨝ status from mock GCDR (queued → running → succeeded/failed/cancelled); **Cancelar**, **Reenviar** (not sent), **Baixar** (stub — delivery to be defined, Q8), "Ver envelope (auditoria)" |

Toggles in the top bar:

- **GCDR POST falha (503)** — the envelope is saved in TB but GCDR never receives the job → "Não enviado ao GCDR" +
  **Reenviar** (same `jobId`, idempotent; appends `resent` to the audit).
- **jobs falham (~30%)** — GCDR finishes some jobs as `failed` → "Novo com os mesmos parâmetros".
- **tema escuro**, **Limpar jobs mock**.

Cancel asks for confirmation, calls GCDR and, only if GCDR accepts it, appends `cancelled` (who/when) to the
envelope's audit.

Mock state lives in `localStorage` (`dp2.mock.tb.attributes`, `dp2.mock.gcdr.jobs`), so jobs survive a reload and
polling resumes. The log at the bottom lists every mocked TB/GCDR call.

Polling is accelerated in the prototype (2 s → 10 s); the RFC specifies 5 s → 30 s.
