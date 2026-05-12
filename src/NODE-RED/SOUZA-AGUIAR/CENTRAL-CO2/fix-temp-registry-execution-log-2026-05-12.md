# Fix Temp Registry — Execution Log
**Central:** Souza Aguiar — CO2
**Data:** 2026-05-12
**SSH:** `ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa`

---

## Batch 3 — Substituição GAS → Temp (3 ambientes)

Estratégia: slave da seção GAS assume o lugar do slave Temp com offset.
Migração em 2 passes para reduzir tamanho de transação (Pass 1: 30d, Pass 2: 30-90d).

### Pass 1 — `fix-temp-registry-batch3-2026-05-12.sql` (últimos 30 dias + renames)

Executado via `psql -U hubot -f /tmp/fix-batch3-pass1.sql`

| Row         | Ambiente   | slave antigo → novo | offset | Rows migrados (0-30d) | Status |
|-------------|------------|---------------------|--------|----------------------|--------|
| batch3_001  | CME SL01   | 121 → 122           | -6     | 151.695              | ✅     |
| batch3_002  | CME SL02   | 124 → 123           | -7     | 0                    | ⚠️     |
| batch3_003  | Queimados  | 150 → 151           | -4     | 47.786               | ✅     |

**Renomeações (executadas no mesmo arquivo):**

| slave | Nome anterior                          | Nome novo                       |
|-------|----------------------------------------|----------------------------------|
| 121   | Temp. Co2_CME_SL01 -6                  | OLD-T.e.m.p. Co2_CME_SL01 -6     |
| 122   | GAS Co2_CME_SL01 132 5000 x9.47        | Temp. Co2_CME_SL01               |
| 124   | Temp. Co2_CME_SL02 -7                  | OLD-T.e.m.p. Co2_CME_SL02 -7     |
| 123   | GAS Co2_CME_SL02 132 500 x9.47         | Temp. Co2_CME_SL02               |
| 150   | Temp. Co2_Queimados -4                 | OLD-T.e.m.p. Co2_Queimados -4    |
| 151   | GAS Co2_Queimados 132 5000 x9.47       | Temp. Co2_Queimados              |

**Rows totais (Pass 1):** 199.481
**Renames:** 6 × UPDATE 1 ✅
**Transações:** 2 × COMMIT ✅

---

### Pass 2 — `fix-temp-registry-batch3-pass2-2026-05-12.sql` (janela 30-90 dias)

Executado via `psql -U hubot -f /tmp/fix-souza-aguiar-co2-last-30-days.sql`
(nome do arquivo em /tmp diferente do arquivo no repo — conteúdo idêntico ao Pass 2)

| Row         | Ambiente   | slave antigo → novo | offset | Rows migrados (30-90d) | Status |
|-------------|------------|---------------------|--------|------------------------|--------|
| batch3_001  | CME SL01   | 121 → 122           | -6     | 322.004                | ✅     |
| batch3_002  | CME SL02   | 124 → 123           | -7     | 0                      | ⚠️     |
| batch3_003  | Queimados  | 150 → 151           | -4     | 145.213                | ✅     |

**Rows totais (Pass 2):** 467.217
**Transação:** 1 × COMMIT ✅

---

## ⚠️ Observação — CME SL02 (slave 124)

Slave **124** retornou **0 rows** em ambos os passes (cobertura total de 90 dias).

**Hipótese confirmada:** slave **123** (ex-`GAS Co2_CME_SL02 132 500 x9.47`, com `range=500` anômalo — diferente do padrão 5000 dos demais GAS) provavelmente **sempre operou como sensor de temperatura**. O slave 124 estava ocioso/duplicado.

**Verificação opcional para confirmar definitivamente:**

```sql
SELECT slave_id, MIN(timestamp) AS first, MAX(timestamp) AS last, COUNT(*) AS total
FROM temperature_history
WHERE slave_id IN (123, 124)
GROUP BY slave_id;
```

Resultado esperado: 123 com histórico longo + 124 com pouco/zero.

---

## Resumo geral — Batch 3

| Métrica                                          | Valor    |
|--------------------------------------------------|----------|
| Rows concluídas nesta sessão                     | 3        |
| Total `temperature_history` migrado (Pass 1 + 2) | 666.698  |
| Slaves renomeados (OLD)                          | 3        |
| Slaves renomeados (novo, ex-GAS)                 | 3        |
| Janela coberta                                   | 90 dias  |

---

## Acumulado da central (todas as sessões)

| Sessão              | Rows do histórico migrados |
|---------------------|----------------------------|
| 2026-04-13 batch1   | 2.094.369                  |
| 2026-04-13 avulso   | 202.492                    |
| 2026-04-13 batch2   | 967.382                    |
| 2026-05-12 batch3   | 666.698                    |
| **Total acumulado** | **3.930.941**              |
