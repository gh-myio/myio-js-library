# Fix Temp Registry — Execution Log
**Central:** Souza Aguiar — T&D
**Data:** 2026-05-19
**SSH:** `ssh -i id_rsa root@202:1d97:2112:f9b9:cfcb:e237:5dc:a3f7`

---

## Batch 1 — Lactário (one-shot 90 dias)

**Primeira migração fix-temp-registry da central T&D.** Padrão batch3 (GAS antigo substitui Temp com offset). Executado em **one-shot 90 dias** (single transação cobrindo histórico + renames).

### Execução

Comando: `psql -U hubot -f /tmp/fix-souza-aguiar-last-90-days.sql`

```
BEGIN
UPDATE 439911
UPDATE 1
UPDATE 1
COMMIT
```

### Migração de histórico

| Row         | Ambiente | slave antigo → novo | offset | Rows migrados (90d) | Status |
|-------------|----------|---------------------|--------|---------------------|--------|
| batch1_001  | Lactário | 64 → 63             | -6     | 439.911             | ✅     |

### Renomeações

| slave | Nome anterior                       | Nome novo                       |
|-------|-------------------------------------|---------------------------------|
| 64    | Temp. Co2_Lactareo -6               | OLD-T.e.m.p. Co2_Lactareo -6    |
| 63    | GAS Co2_Lactareo 132 5000 x9.47     | Temp. Co2_Lactareo              |

### Totais

| Métrica                                          | Valor       |
|--------------------------------------------------|-------------|
| Ambientes migrados nesta sessão                  | 1           |
| Total `temperature_history` migrado              | **439.911** |
| Slaves renomeados (OLD)                          | 1           |
| Slaves renomeados (limpos)                       | 1           |
| Janela coberta                                   | 90 dias     |
| Transações                                       | 1 (one-shot)|

---

## ⚠️ Observações

### GAS reaproveitado (não houve órfãos)

Diferente do CO2 batch5/6 onde alguns slaves GAS viraram órfãos por uso de novo HW, aqui o GAS 63 foi **reaproveitado** como Temp limpa — padrão clássico batch3. Zero GAS órfãos pós-migração.

### Channels do slave 63 (destino)

O slave 63 já tinha 2 channels configurados (`channel0` e `channel1` com `channel_type=NORMAL`) e `config_temperature` no `slaves.config`. **Não precisa ajuste de channels via UI** — basta validar se os nomes seguem o padrão `Check` / `Check 2` (caso contrário, ajustar).

### Verificar amostra de valores

Recomendado validar uma amostra dos valores migrados para confirmar que o offset -6°C foi aplicado corretamente (esperado: leituras realistas de temperatura, não valor bruto + 6):

```sql
SELECT timestamp, value FROM temperature_history
WHERE slave_id = 63 AND timestamp >= NOW() - INTERVAL '1 day'
ORDER BY timestamp DESC LIMIT 10;
```

### Ambiguidade Lactário CO2 vs T&D

A CENTRAL-CO2 ainda tem os slaves 156 (outlet) e 157 (infrared) nomeados "Lactário", sem prefixo padrão `GAS Co2_*` / `Temp. Co2_*`. **Investigar se são o mesmo ambiente físico** monitorado por 2 centrais (T&D + CO2) ou ambientes distintos. Se for o mesmo, considerar desativar uma das duas leituras para evitar contagem dupla nos dashboards.

---

## Acumulado da central (todas as sessões)

| Sessão              | Rows do histórico migrados |
|---------------------|----------------------------|
| 2026-05-19 batch1   | 439.911                    |
| **Total acumulado** | **439.911**                |

---

## Estado pós-batch1 da CENTRAL-T&D

| Categoria                          | Qtd antes  | Qtd depois |
|------------------------------------|------------|------------|
| Temp CO2 — com offset (pendentes)  | 1 (64)     | 0          |
| Temp CO2 — ativos sem offset       | 0          | 1 (63)     |
| Temp CO2 — legados OLD-            | 0          | 1 (64)     |
| GAS bruto remanescente             | 1 (63)     | 0          |

**Todas as migrações fix-temp-registry da T&D estão concluídas.** Pendências residuais da central são metadados / housekeeping:
- Slave 58 (`Repetido 03`, type `three_phase_sensor`) — investigar
- Slave 54 (version 244.100.0 anômala) — validar firmware
- Slave 65 (Vigarista, abandonado) — desativar ou renomear SPARE
