# Fix Temp Registry — Execution Log
**Central:** Souza Aguiar — CO2
**Data:** 2026-05-15
**SSH:** `ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa`

---

## Batch 5 — Substituição Temp → Novo HW (2 ambientes)

**Mudança de estratégia**: ao invés de reaproveitar o slave GAS antigo (padrão batch1-3), este batch usou **sensores físicos novos** instalados em 2026-05-13. Os slaves GAS correspondentes (125, 148) viraram **órfãos** após a migração.

Migração em 2 passes para reduzir tamanho de transação (Pass 1: 30d, Pass 2: 30-90d).

### Pass 1 — `fix-temp-registry-batch5-2026-05-15.sql` (últimos 30 dias + renames)

Executado via `psql -U hubot -f /tmp/fix-batch5-pass1.sql`

| Row         | Ambiente        | slave antigo → novo | offset | Rows migrados (0-30d) | Status |
|-------------|-----------------|---------------------|--------|----------------------|--------|
| batch5_001  | CTI Pediátrico  | 126 → 162           | -6     | _<PREENCHER>_         | ⏳     |
| batch5_002  | CAF             | 149 → 164           | -7     | _<PREENCHER>_         | ⏳     |

**Renomeações (executadas no mesmo arquivo):**

| slave | Nome anterior                      | Nome novo                          |
|-------|------------------------------------|------------------------------------|
| 126   | Temp. Co2_CTI_Pediatrico -6        | OLD-T.e.m.p. Co2_CTI_Pediatrico -6 |
| 162   | CTI Pediátrico_ sétimo-andar       | Temp. Co2_CTI_Pediatrico           |
| 149   | Temp. Co2_CAF -7                   | OLD-T.e.m.p. Co2_CAF -7            |
| 164   | TEMP_FARMACIA-CAF                  | Temp. Co2_CAF                      |

**Rows totais (Pass 1):** _<PREENCHER>_
**Renames:** 4 × UPDATE 1 ✅
**Transações:** 2 × COMMIT ✅

---

### Pass 2 — `fix-temp-registry-batch5-pass2-2026-05-15.sql` (janela 30-90 dias)

Executado via `psql -U hubot -f /tmp/fix-batch5-pass2.sql`

| Row         | Ambiente        | slave antigo → novo | offset | Rows migrados (30-90d) | Status |
|-------------|-----------------|---------------------|--------|------------------------|--------|
| batch5_001  | CTI Pediátrico  | 126 → 162           | -6     | _<PREENCHER>_           | ⏳     |
| batch5_002  | CAF             | 149 → 164           | -7     | _<PREENCHER>_           | ⏳     |

**Rows totais (Pass 2):** _<PREENCHER>_
**Transação:** 1 × COMMIT ✅

---

## ⚠️ Observação — GAS órfãos pós-batch5

Diferente dos batches anteriores onde o slave GAS era reaproveitado como Temp limpo, neste batch o GAS ficou sem destino:

- **Slave 125** (`GAS Co2_CTI_Pediatrico 132 5000 x9.47`) — não migrado, sem novo papel
- **Slave 148** (`GAS Co2_CAF 132 5000 x9.47`) — não migrado, sem novo papel

Considerar:
- (a) Desativar (atualizar `slaves.active = false` ou similar)
- (b) Manter como backup/fallback
- (c) Renomear para `SPARE-` para sinalizar no UI

---

## Resumo geral — Batch 5

| Métrica                                          | Valor             |
|--------------------------------------------------|-------------------|
| Rows concluídas nesta sessão                     | 2                 |
| Total `temperature_history` migrado (Pass 1 + 2) | _<PREENCHER>_      |
| Slaves renomeados (OLD)                          | 2                 |
| Slaves renomeados (novos, ex-sensor novo HW)     | 2                 |
| GAS slaves órfãos pós-migração                   | 2 (125, 148)      |
| Janela coberta                                   | 90 dias           |

---

## Acumulado da central (todas as sessões)

| Sessão              | Rows do histórico migrados |
|---------------------|----------------------------|
| 2026-04-13 batch1   | 2.094.369                  |
| 2026-04-13 avulso   | 202.492                    |
| 2026-04-13 batch2   | 967.382                    |
| 2026-05-12 batch3   | 666.698                    |
| 2026-05-15 batch5   | _<PREENCHER>_               |
| **Total acumulado** | _<PREENCHER>_               |

---

## TODO ao preencher

1. Substituir os `_<PREENCHER>_` pelos row counts reais do output do psql (`UPDATE N`).
2. Marcar Status como ✅ (ou ⚠️ se algum slave tiver 0 rows ou comportamento estranho).
3. Atualizar **Acumulado** com `3.930.941 + batch5_total`.
4. Considerar decisão sobre GAS órfãos (125, 148) — documentar no slaves-map.md se desativados.
