# Fix Temp Registry — Execution Log
**Central:** Souza Aguiar — CO2
**Data:** 2026-05-18
**SSH:** `ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa`

---

## Batch 6 — Substituição mista (3 ambientes, one-shot 90 dias)

**Estratégia mista** decidida em 2026-05-18:
- Sala Vermelha Adulto usou **sensor novo físico** (165), padrão batch5.
- Sala Vermelha Infantil e Farmácia Satélite usaram **slave GAS antigo** (134, 141), padrão batch3.

Diferente dos batches anteriores (Pass 1 + Pass 2), este batch foi executado em **uma única passada de 90 dias** num arquivo SQL combinado: `/tmp/fix-souza-aguiar-co2-last-90-days.sql`.

### Execução

Comando: `psql -U hubot -f /tmp/fix-souza-aguiar-co2-last-90-days.sql`

```
BEGIN
UPDATE 165284
UPDATE 167778
UPDATE 177769
UPDATE 1
UPDATE 1
UPDATE 1
UPDATE 1
UPDATE 1
UPDATE 1
COMMIT
```

### Migrações de histórico

| Row         | Ambiente               | slave antigo → novo | offset | Rows migrados (90d) | Status |
|-------------|------------------------|---------------------|--------|---------------------|--------|
| batch6_001  | Sala Vermelha Adulto   | 74 → 165            | -8     | 165.284             | ✅     |
| batch6_002  | Sala Vermelha Infantil | 135 → 134           | -8     | 167.778             | ✅     |
| batch6_003  | Farmácia Satélite      | 140 → 141           | -7     | 177.769             | ✅     |

### Renomeações

| slave | Nome anterior                                | Nome novo                                  |
|-------|----------------------------------------------|--------------------------------------------|
| 74    | Temp. Co2_Sala_Vermelha_Adulto -8            | OLD-T.e.m.p. Co2_Sala_Vermelha_Adulto -8   |
| 165   | Temp Sala_Vermelha_Adulto                    | Temp. Co2_Sala_Vermelha_Adulto             |
| 135   | Temp. Co2_Sala_Vermelha_Infantil -8          | OLD-T.e.m.p. Co2_Sala_Vermelha_Infantil -8 |
| 134   | GAS Co2_Sala_Vermelha_Infantil 132 5000 x9.47| Temp. Co2_Sala_Vermelha_Infantil           |
| 140   | Temp. Co2_Farmácia_Satelite -7               | OLD-T.e.m.p. Co2_Farmácia_Satelite -7      |
| 141   | Gas Co2_Farmácia_Satelite 132 5000 x9.47     | Temp. Co2_Farmácia_Satelite                |

### Totais

| Métrica                                          | Valor       |
|--------------------------------------------------|-------------|
| Ambientes migrados nesta sessão                  | 3           |
| Total `temperature_history` migrado              | **510.831** |
| Slaves renomeados (OLD)                          | 3           |
| Slaves renomeados (limpos)                       | 3           |
| Janela coberta                                   | 90 dias     |
| Transações                                       | 1 (one-shot)|

---

## ⚠️ Observações

### GAS órfão pós-batch6

**Slave 145** (`GAS Co2_Sala_Vermelha_Adulto 132 5000 x9.47`, `code=003-003-003-012` anômalo) — foi preterido em favor do novo sensor físico 165. Vira **órfão** (sem destino).

Total de GAS órfãos pós-batch6: 3 slaves
- 145 (Sala V. Adulto)
- 125 (CTI Pediátrico, batch5)
- 148 (CAF, batch5)

### Slaves instalados não-usados

Os sensores novos 166, 167, 168 (instalados em 2026-05-15) **não foram usados** porque a equipe preferiu reaproveitar os slaves GAS antigos (134, 141). Ficam como spare/desativados.

### Channels pendentes de ajuste

Channels dos slaves novos Temp ainda com nomes provisórios — ajustar via UI:
- **165**: criar Check 2 (ch=1) + renomear Teste → Check
- **134**: renomear Teste → Check, c2 → Check 2
- **141**: renomear c1.0 → Check (+ mudar `plug` → `lamp`), c2.9 → Check 2

---

## Acumulado da central (todas as sessões)

| Sessão              | Rows do histórico migrados |
|---------------------|----------------------------|
| 2026-04-13 batch1   | 2.094.369                  |
| 2026-04-13 avulso   | 202.492                    |
| 2026-04-13 batch2   | 967.382                    |
| 2026-05-12 batch3   | 666.698                    |
| 2026-05-15 batch5   | _<PREENCHER>_              |
| 2026-05-18 batch6   | 510.831                    |
| **Total acumulado** | _<PREENCHER>_              |

> ℹ️ O total acumulado depende do preenchimento do batch5 — ver `fix-temp-registry-execution-log-2026-05-15.md`.
