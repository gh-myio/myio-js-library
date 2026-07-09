- Feature Name: `extract_log_annotations_sql_thingsboard`
- Start Date: 2026-07-09
- RFC PR: (a preencher)
- Status: **PROPOSTO — aguardando aprovação**
- Tracking Issue: (a preencher)

# RFC-0216 — Extração SQL de `log_annotations` por customer (ThingsBoard / PostgreSQL)

## Summary
[summary]: #summary

Query SQL (read-only) no banco PostgreSQL do ThingsBoard para montar uma tabela consolidada de anotações de devices — `thingsboardDeviceId`, `tbName`, `tbLabel`, enriquecida com os atributos SERVER_SCOPE `gcdrDeviceId` e `log_annotations` — extraída **customer a customer**, começando pelo **Mestre Álvaro** (`tbCustomerId = '20b93da0-9011-11f0-a06d-e9509531b1d5'`). O resultado alimenta a migração/consolidação futura das anotações (ver [RFC-0208] AnnotationServiceOrchestrator seed + gap-fetch).

## Motivation
[motivation]: #motivation

As anotações de device (RFC-0203) vivem hoje como **JSON no atributo SERVER_SCOPE `log_annotations`** de cada device, no ThingsBoard. Não existe visão consolidada:

1. **Auditoria/migração** — para migrar as anotações para um backend próprio (GCDR) ou fazer seed do `AnnotationServiceOrchestrator` (RFC-0208), precisamos de um dump confiável por customer, com a chave de correlação TB↔GCDR (`gcdrDeviceId`).
2. **Custo do caminho REST** — coletar via API (`GET /api/plugins/telemetry/DEVICE/{id}/values/attributes/SERVER_SCOPE?keys=log_annotations`) exige 1 chamada por device (centenas por shopping; observado 11–28 s por customer no enrichment do welcome). Em SQL é **uma query por customer**.
3. **Rollout controlado** — a migração será por customer (piloto: Mestre Álvaro), permitindo validar volume, formato e integridade antes de expandir.

## Guide-level explanation
[guide-level-explanation]: #guide-level-explanation

O produto da query é uma tabela com uma linha por device do customer:

| Coluna | Origem | Descrição |
|---|---|---|
| `thingsboard_device_id` | `device.id` | UUID do device no TB |
| `tb_name` | `device.name` | Nome único do device |
| `tb_label` | `device.label` | Label exibido nos dashboards |
| `gcdr_device_id` | `attribute_kv` (key **1072**) | Chave de correlação TB↔GCDR |
| `log_annotations` | `attribute_kv` (key **812**) | JSON bruto das anotações |
| `log_annotations_updated_at` | `attribute_kv.last_update_ts` | Última escrita do atributo |

Execução: conectar no PostgreSQL do TB (réplica de leitura, se houver), rodar a query com o `customer_id` do rollout e exportar CSV/JSON. Nenhuma escrita é feita.

## Reference-level explanation
[reference-level-explanation]: #reference-level-explanation

### Premissas de schema (TB ≥ 3.6.x)

- `attribute_kv` usa **`attribute_type int4`** e **`attribute_key int4`** (dicionário em `key_dictionary`).
- `attribute_type`: `SERVER_SCOPE = 2` (enum `AttributeScope`: CLIENT=1, SERVER=2, SHARED=3). **Confirmar antes de rodar** (ver §Validações).
- IDs de chave já levantados neste ambiente: **`812 = log_annotations`**, **`1072 = gcdrDeviceId`**.
- O valor do atributo pode estar em `str_v` (gravado como string JSON) **ou** `json_v` (gravado como objeto) — usar `COALESCE`.

### Query principal — devices COM anotações (piloto Mestre Álvaro)

```sql
-- RFC-0216: log_annotations + gcdrDeviceId por device de um customer
-- READ-ONLY. Ajustar :customer_id por rodada do rollout.
SELECT
  d.id                                        AS thingsboard_device_id,
  d.name                                      AS tb_name,
  d.label                                     AS tb_label,
  gcdr.str_v                                  AS gcdr_device_id,
  COALESCE(la.json_v::text, la.str_v)         AS log_annotations,
  to_timestamp(la.last_update_ts / 1000.0)    AS log_annotations_updated_at
FROM public.device d
JOIN public.attribute_kv la
  ON  la.entity_id      = d.id
  AND la.attribute_type = 2            -- SERVER_SCOPE
  AND la.attribute_key  = 812          -- log_annotations
LEFT JOIN public.attribute_kv gcdr
  ON  gcdr.entity_id      = d.id
  AND gcdr.attribute_type = 2          -- SERVER_SCOPE
  AND gcdr.attribute_key  = 1072       -- gcdrDeviceId
WHERE d.customer_id = '20b93da0-9011-11f0-a06d-e9509531b1d5'  -- Mestre Álvaro
ORDER BY d.name;
```

> O `JOIN` (não `LEFT`) em `la` filtra apenas devices que **têm** o atributo. Para o censo completo (todos os devices do customer, com anotações nulas onde não houver), trocar por `LEFT JOIN` e mover os predicados do `WHERE` do atributo para o `ON` (como já está).

### Variante — censo completo do customer

```sql
SELECT
  d.id                                        AS thingsboard_device_id,
  d.name                                      AS tb_name,
  d.label                                     AS tb_label,
  gcdr.str_v                                  AS gcdr_device_id,
  COALESCE(la.json_v::text, la.str_v)         AS log_annotations,
  to_timestamp(la.last_update_ts / 1000.0)    AS log_annotations_updated_at
FROM public.device d
LEFT JOIN public.attribute_kv la
  ON la.entity_id = d.id AND la.attribute_type = 2 AND la.attribute_key = 812
LEFT JOIN public.attribute_kv gcdr
  ON gcdr.entity_id = d.id AND gcdr.attribute_type = 2 AND gcdr.attribute_key = 1072
WHERE d.customer_id = '20b93da0-9011-11f0-a06d-e9509531b1d5'
ORDER BY (la.entity_id IS NULL), d.name;   -- anotados primeiro
```

### Variante — 1 linha por ANOTAÇÃO (explode o array JSON)

Útil para carga em tabela relacional/GCDR. Assume `log_annotations` como array de objetos (schema RFC-0203: `id`, `version`, `text`, `type`, `importance`, `status`, `createdAt/By`, `responses[]`, `history[]`):

```sql
WITH base AS (
  SELECT
    d.id   AS thingsboard_device_id,
    d.name AS tb_name,
    d.label AS tb_label,
    gcdr.str_v AS gcdr_device_id,
    COALESCE(la.json_v::jsonb, la.str_v::jsonb) AS ann
  FROM public.device d
  JOIN public.attribute_kv la
    ON la.entity_id = d.id AND la.attribute_type = 2 AND la.attribute_key = 812
  LEFT JOIN public.attribute_kv gcdr
    ON gcdr.entity_id = d.id AND gcdr.attribute_type = 2 AND gcdr.attribute_key = 1072
  WHERE d.customer_id = '20b93da0-9011-11f0-a06d-e9509531b1d5'
)
SELECT
  b.thingsboard_device_id,
  b.tb_name,
  b.tb_label,
  b.gcdr_device_id,
  a.value ->> 'id'         AS annotation_id,
  a.value ->> 'type'       AS annotation_type,
  a.value ->> 'status'     AS annotation_status,
  (a.value ->> 'importance')::int AS importance,
  a.value ->> 'createdAt'  AS created_at,
  a.value ->> 'createdBy'  AS created_by,
  a.value ->> 'text'       AS text,
  a.value                  AS annotation_json
FROM base b
CROSS JOIN LATERAL jsonb_array_elements(
  CASE jsonb_typeof(b.ann)
    WHEN 'array' THEN b.ann
    ELSE COALESCE(b.ann -> 'annotations', '[]'::jsonb)  -- tolera wrapper {annotations:[...]}
  END
) a(value)
ORDER BY b.tb_name, created_at;
```

### Export CSV (psql)

```sql
\copy (<query principal>) TO 'rfc0216-mestre-alvaro-log-annotations.csv' WITH (FORMAT csv, HEADER true)
```

### Validações obrigatórias antes da 1ª execução

```sql
-- 1) Confirmar os ids do dicionário de chaves neste ambiente
SELECT key_id, key FROM public.key_dictionary
WHERE key IN ('log_annotations', 'gcdrDeviceId');
-- esperado: 812 e 1072

-- 2) Confirmar o valor de SERVER_SCOPE em attribute_type
SELECT DISTINCT attribute_type, count(*)
FROM public.attribute_kv
WHERE attribute_key = 812
GROUP BY attribute_type;
-- esperado: um único valor (2)

-- 3) Volumetria do piloto
SELECT count(*) FILTER (WHERE la.entity_id IS NOT NULL) AS devices_com_anotacao,
       count(*)                                          AS devices_total
FROM public.device d
LEFT JOIN public.attribute_kv la
  ON la.entity_id = d.id AND la.attribute_type = 2 AND la.attribute_key = 812
WHERE d.customer_id = '20b93da0-9011-11f0-a06d-e9509531b1d5';
```

Conferência funcional: o total de anotações do piloto deve bater com o badge 📋 do painel de Anotações do dashboard do shopping (RFC-0203/`AnnotationServiceOrchestrator.getTotalCount()`).

### Plano de rollout (customer a customer)

| Ordem | Customer | `tbCustomerId` | Status |
|---|---|---|---|
| 1 | **Mestre Álvaro** (piloto) | `20b93da0-9011-11f0-a06d-e9509531b1d5` | pendente |
| 2 | Mont Serrat | `bef16b70-a93c-11f0-afe1-175479a33d89` | pendente |
| 3 | Metrópole Pará | `01369a40-d6ac-11f0-998e-25174baff087` | pendente |
| 4 | Rio Poty | `0c433230-cedd-11f0-998e-25174baff087` | pendente |
| 5 | Shopping da Ilha | `209424d0-b04f-11f0-9722-210aa9448abc` | pendente |
| 6 | Moxuara | `5085bf40-b4dd-11f0-be7f-e760d1498268` | pendente |
| 7+ | Grupo Soul Malls (Plaza Macaé `8eccc220-…`, Praia da Costa `f157a5a0-…`, West Plaza `c9d32590-…`, Ilha Plaza `156fadc0-…`) e demais | — | pendente |

Critério para avançar de fase: piloto validado (volumetria + amostragem manual de 5 devices + parse JSON sem erro em 100% das linhas).

## Drawbacks
[drawbacks]: #drawbacks

- **Acesso direto ao banco de produção** — exige credencial read-only e janela adequada; um erro de digitação com privilégio de escrita seria grave (mitigar com role somente-leitura).
- **Acoplamento ao schema interno do TB** — `attribute_kv`/`key_dictionary` são detalhes de implementação; upgrades do TB podem alterar ids/formatos (os ids 812/1072 são por ambiente, não portáveis).
- `str_v` pode conter JSON inválido/truncado (limite varchar 10 MB) — a variante explodida falha nessas linhas (tratar com `... ELSE NULL` ou filtrar antes).

## Rationale and alternatives
[rationale-and-alternatives]: #rationale-and-alternatives

- **SQL direto (escolhido)**: 1 query por customer, sem N+1 de REST, sem rate-limit, com export CSV nativo.
- **TB REST API**: portável e sem acesso ao banco, mas 1 chamada por device (lento, centenas de requests) e sujeita a expiração de JWT no meio da coleta.
- **Widget/browser (AnnotationServiceOrchestrator.getAll())**: já existe, mas roda no contexto de um usuário logado e não escala para dump em lote.

## Prior art
[prior-art]: #prior-art

- **RFC-0203** — Header Annotations (schema da anotação; painel + orquestrador; storage em `log_annotations`).
- **RFC-0208** — AnnotationServiceOrchestrator seed + gap-fetch (consumidor natural deste dump).
- **RFC-0183/0189** — uso de `gcdrDeviceId` (attr SERVER_SCOPE) como chave TB↔GCDR.

## Unresolved questions
[unresolved-questions]: #unresolved-questions

1. Confirmar `attribute_type = 2` para SERVER_SCOPE neste ambiente (validação §acima).
2. `log_annotations` está sempre em `str_v`, sempre em `json_v`, ou misto? (define se o `COALESCE` basta ou se há normalização a fazer).
3. O JSON raiz é array puro ou wrapper `{annotations:[...]}`? (a variante explodida tolera ambos, mas o destino da migração precisa fixar um formato).
4. Destino final da migração: tabela própria no GCDR? endpoint de import? (fora do escopo desta RFC — aqui é só extração).

## Future possibilities
[future-possibilities]: #future-possibilities

- Job de **migração para o GCDR** consumindo este dump (com `gcdr_device_id` como FK) e aposentando o attr `log_annotations` como fonte primária.
- **View materializada** ou job agendado para manter o dump atualizado durante a transição.
- Reuso do padrão (device + attrs por `key_dictionary`) para outros atributos a consolidar — ex.: `entradaIngestionIds`, `customerDefaultDashboard` (RFCs recentes).
