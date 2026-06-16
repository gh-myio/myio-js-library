# Estratégia — Correção em massa do `ingestionId` (SQL direto no ThingsBoard)

> Data: 2026-05-21 · Cliente piloto: **Campinas Shopping**
> Origem: [`INVESTIGACAO-energy-mismatch.md`](./INVESTIGACAO-energy-mismatch.md)
> Abordagem escolhida: **SQL direto** no PostgreSQL do ThingsBoard.

## Objetivo

Corrigir o atributo `SERVER_SCOPE.ingestionId` dos devices cujo valor aponta
para um device de ingestão **stale/duplicado** (total_value 0, sem telemetria),
fazendo o relatório (AllReportModal) voltar a casar com o medidor ativo.

Chave de correção: `centralId + slaveId` (TB) ↔ `gatewayId + slaveId` (Ingestion).
Confirmado nos dados: os 202 devices de ingestão têm a chave `(gatewayId,slaveId)`
**única (1:1)** — match determinístico.

---

## Schema — onde mora o `ingestionId`

Atributo `SERVER_SCOPE` distribuído em 3 tabelas:

| Tabela | Papel |
|--------|-------|
| `key_dictionary` | `(key_id, key)` — 1 linha com `key = 'ingestionId'` |
| `attribute_kv` | valor: `entity_id`=device.id, `attribute_key`=key_id, escopo SERVER_SCOPE, valor em `str_v` |
| `device` | `(id, name, tenant_id, customer_id, …)` |

`centralId` e `slaveId` seguem o mesmo padrão (outras `key`s).
`device.centralId` (TB) **=** `gatewayId` (Ingestion).

---

## FASE 0 — Descoberta do schema (rodar primeiro)

A representação de escopo/tipos varia por versão do TB. Confirmar antes.
Queries client-agnósticas (funcionam em DBeaver, psql, etc.):

```sql
-- Estrutura das tabelas (substitui o \d do psql)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'attribute_kv'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'key_dictionary'
ORDER BY ordinal_position;

-- key_ids dos 3 atributos de interesse
SELECT key_id, key FROM key_dictionary
WHERE key IN ('ingestionId','centralId','slaveId');
```

Anotar:
- `KEY_INGESTION`, `KEY_CENTRAL`, `KEY_SLAVE` (os 3 `key_id`).
- Como o escopo SERVER_SCOPE é representado em `attribute_kv.attribute_type`
  (varchar `'SERVER_SCOPE'` ou inteiro). Os SQLs abaixo assumem varchar —
  **ajustar** se for inteiro.
- Em qual coluna o `slaveId` está: `str_v` ou `long_v`.

---

## FASE 1 — Extrair o lado ThingsBoard

> Valores confirmados na instância (FASE 0, 2026-05-21):
> `key_id`: ingestionId=**731**, centralId=**381**, slaveId=**222** ·
> SERVER_SCOPE = `attribute_type = 2`.

```sql
SELECT d.id AS device_id,
       d.name,
       MAX(a.str_v) FILTER (WHERE a.attribute_key = 731) AS ingestion_id,
       MAX(a.str_v) FILTER (WHERE a.attribute_key = 381) AS central_id,
       MAX(COALESCE(a.str_v, a.long_v::text))
           FILTER (WHERE a.attribute_key = 222)          AS slave_id
FROM device d
LEFT JOIN attribute_kv a
       ON a.entity_id      = d.id
      AND a.attribute_type = 2                     -- SERVER_SCOPE
      AND a.attribute_key IN (731, 381, 222)       -- ingestionId, centralId, slaveId
WHERE d.customer_id = (SELECT id FROM customer WHERE title ILIKE 'campinas shopping' LIMIT 1)
GROUP BY d.id, d.name
ORDER BY d.name;
```

`LEFT JOIN` proposital — devices sem a linha `ingestionId` aparecem com
`ingestion_id = NULL` (caso de `INSERT` na FASE 4).

Exportar o resultado (CSV ou colar o output) — é a entrada da FASE 2.

---

## FASE 2 — Gerar o MAP de correção

Entrada:
- Lado TB: output da FASE 1 (`device_id, name, central_id, slave_id, ingestion_id`).
- Lado Ingestion: `logs/responseAllReports-campinas.json` (já disponível) —
  `Map<central_id|slave_id → ingestion_device_id>`.

Regra por device do TB:

| Situação | Ação |
|----------|------|
| `central_id` ou `slave_id` ausente | **PULAR** — não dá pra casar (corrigir a montante) |
| match encontrado e `ingestion_id` atual == correto | OK — nada a fazer |
| match encontrado e `ingestion_id` atual != correto | **UPDATE** |
| match encontrado e device **sem linha** `ingestionId` | **INSERT** |
| sem match na ingestão p/ `(central,slave)` | **PULAR** — investigar (slaveId errado?) |

Saída: lista de `UPDATE`/`INSERT` (gerada a partir do cruzamento — passar o
output da FASE 1 para gerar este batch).

---

## FASE 3 — Backup (obrigatório, antes de qualquer escrita)

```sql
CREATE TABLE attribute_kv_bkp_ingestionid_20260521 AS
SELECT * FROM attribute_kv
WHERE attribute_key = <KEY_INGESTION>;
```

Rollback (se necessário):

```sql
-- restaura apenas as linhas de ingestionId ao estado do backup
BEGIN;
DELETE FROM attribute_kv WHERE attribute_key = <KEY_INGESTION>;
INSERT INTO attribute_kv SELECT * FROM attribute_kv_bkp_ingestionid_20260521;
COMMIT;
```

---

## FASE 4 — Aplicar as correções

### Template UPDATE (device que já tem a linha `ingestionId`)

```sql
UPDATE attribute_kv
SET str_v          = '<INGESTION_ID_CORRETO>',
    last_update_ts = (extract(epoch from now()) * 1000)::bigint,
    version        = version + 1
WHERE entity_id      = '<DEVICE_UUID>'
  AND attribute_key  = <KEY_INGESTION>
  AND attribute_type = 'SERVER_SCOPE';   -- ajustar conforme FASE 0
```

### Template INSERT (device sem a linha `ingestionId`)

```sql
INSERT INTO attribute_kv
  (entity_id, attribute_type, attribute_key, str_v, last_update_ts, version)
VALUES
  ('<DEVICE_UUID>', 'SERVER_SCOPE', <KEY_INGESTION>, '<INGESTION_ID_CORRETO>',
   (extract(epoch from now()) * 1000)::bigint, 1);
```

> Rodar o batch dentro de uma transação (`BEGIN; … COMMIT;`) e conferir a
> contagem de linhas afetadas antes do `COMMIT`.

---

## FASE 5 — Invalidar o cache do ThingsBoard ⚠️

**Crítico**: o TB cacheia atributos em memória. As alterações no `attribute_kv`
**não aparecem** na API/dashboard até o cache ser invalidado.

Com SQL direto, a forma confiável é **reiniciar o ThingsBoard**:

```bash
systemctl restart thingsboard
```

(Programar para janela de baixo uso — o restart derruba o TB por ~1-2 min.)

---

## FASE 6 — Validação

1. Re-rodar a query da FASE 1 → conferir que os `ingestion_id` batem com o esperado.
2. Re-gerar o relatório (AllReportModal — grupo Lojas, energy, mesmo período)
   e confirmar que as 19 lojas-zero agora mostram consumo.
3. Conferir totais: o total do relatório deve subir ~24.000 kWh (vide investigação).

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Cache do TB mascarar a mudança | FASE 5 — restart obrigatório |
| `slaveId` do device no TB estar errado | match `(central,slave)` devolveria id errado — validar `slaveId` antes (CHECK & FIX) |
| Escrita em massa sem rollback | FASE 3 — backup da partição `ingestionId` |
| Versão do schema diferente do assumido | FASE 0 — confirmar `\d` antes |
| `version`/optimistic locking | UPDATE incrementa `version` e `last_update_ts` |
| Devices fora do grupo Lojas afetados | escopar por `customer_id` e revisar o MAP antes de aplicar |

---

## Próximo passo

Rodar **FASE 0** + **FASE 1** no psql do ThingsBoard e me passar:
1. O output de `\d attribute_kv` e dos `key_id` (FASE 0).
2. O resultado da query da FASE 1 (lista de devices).

Com isso eu gero o batch de `UPDATE`/`INSERT` da FASE 2 — só os devices que
realmente estão com `ingestionId` divergente.
