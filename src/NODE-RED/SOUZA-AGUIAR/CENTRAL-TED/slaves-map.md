# Slaves Map — Central T&D (Souza Aguiar)

> Central: **Souza Aguiar — T&D** (`df3f846e-b69c-45ce-9475-bd90570b24d0`)
> IPv6: `202:1d97:2112:f9b9:cfcb:e237:5dc:a3f7`
> Total slaves: 27
> Snapshot DB: 2026-05-19 (pós-batch1)

---

## Convenções de Type / Code

| Type                 | Code              | Versão     | Significado                                      |
|----------------------|-------------------|------------|--------------------------------------------------|
| `outlet`             | `002-002-002-012` | 6.0.0      | Sensor outlet padrão — SCDs, hidrômetros, switches, GAS, Vigarista |
| `infrared`           | `002-002-002-014` | 7.0.0      | Sensor de temperatura (Temp Co2_Lactareo) ou repetidor passivo |
| `three_phase_sensor` | `002-002-002-015` | 6.0.0      | Sensor trifásico (slave 58 — possivelmente monitorando quadro elétrico) |
| `outlet` ⚠️           | `002-002-002-012` | **244.100.0** | Versão anômala — apenas slave 54 (`Sw Hidrômetro Regulação`) |

---

## 1. Sensores de Vazão — SCD (Sensor Contador D'água)

Todos `type=outlet`, `code=002-002-002-012`, `version=6.0.0`.
Formato do nome: `SCD <local> <addr_modbus> <range_max> <fator>`
Fator padrão: `×0.2705` (converte leitura bruta em m³/h ou similar).

| Slave ID | Addr (low, high) | Nome                                           | Local                        | Modbus addr | Range | Fator   |
|----------|------------------|------------------------------------------------|------------------------------|-------------|-------|---------|
| 35       | 40, 248          | SCD 8.1Caixad´agua 496 150 X0.2705             | Bloco 8 — Caixa d'água 1     | 496         | 150   | ×0.2705 |
| 48       | 102, 248         | SCD 8.2Caixad´agua 496 150 X0.2705             | Bloco 8 — Caixa d'água 2     | 496         | 150   | ×0.2705 |
| 37       | 35, 249          | SCD 5.1-SH 518 145 X0.2705                     | Bloco 5 — Piso 1 (SH)        | 518         | 145   | ×0.2705 |
| 61       | 140, 249         | SCD 5.2-SH 1730 133 X0.2705                    | Bloco 5 — Piso 2 (SH)        | 1730        | 133   | ×0.2705 |
| 41       | 236, 249         | SCD PrédioRegulador 1526 150 X0.275            | Prédio Regulador             | 1526        | 150   | ×0.275  |
| 53       | 198, 248         | SCD Regulação 1162 210 x0.2705                 | Regulação                    | 1162        | 210   | ×0.2705 |
| 42       | 38, 248          | SCD MaternidadeCisterna 915 244 X0.2705        | Maternidade — Cisterna       | 915         | 244   | ×0.2705 |
| 43       | 47, 249          | SCD MaternidadeCaixadagua 1264 210 X0.2705     | Maternidade — Caixa d'água   | 1264        | 210   | ×0.2705 |
| 57       | 81, 249          | SCD Cisterna2_Maternidade 785 150 x0.2705      | Maternidade — Cisterna 2     | 785         | 150   | ×0.2705 |
| 49       | 187, 248         | SCD Cisterna1_SouzaAguiar 1390 410 x0.2705     | Souza Aguiar — Cisterna 1    | 1390        | 410   | ×0.2705 |
| 47       | 9, 248           | SCD Cisterna2_SouzaAguiar 1872 410 x0.2705     | Souza Aguiar — Cisterna 2    | 1872        | 410   | ×0.2705 |
| 44       | 250, 248         | SCD CentrroMédico_Caixad´agua 1474 200 X0.2705 | Centro Médico — Caixa d'água | 1474        | 200   | ×0.2705 |

> ℹ️ Slave 41 usa fator `×0.275` (não `×0.2705`) — atenção ao processar.

---

## 2. Hidrômetros

Todos `type=outlet`, `code=002-002-002-012`, `version=6.0.0`.

| Slave ID | Addr (low, high) | Nome                       | Local           | updated_at  |
|----------|------------------|----------------------------|-----------------|-------------|
| 56       | 17, 248          | Hidrometro (Cisternas 1/2) | Cisternas 1 e 2 | 2024-09-12  |
| 60       | 15, 248          | Hidrometro Upa             | UPA             | 2024-09-30  |

---

## 3. Switches (Sw)

| Slave ID | Type   | Addr (low, high) | Code              | Version       | Nome                      | Função                           |
|----------|--------|------------------|-------------------|---------------|---------------------------|----------------------------------|
| 50       | outlet | 68, 249          | 002-002-002-012   | 6.0.0         | Sw Hidrômetro Cisterna 1  | Controle hidrômetro cisterna 1   |
| 51       | outlet | 94, 248          | 002-002-002-012   | 6.0.0         | Sw Hidrômetro Cisterna 2  | Controle hidrômetro cisterna 2   |
| 54 ⚠️    | outlet | 45, 248          | 002-002-002-012   | **244.100.0** | Sw Hidrômetro Regulação   | Controle hidrômetro regulação    |
| 62       | outlet | 208, 248         | 002-002-002-012   | 6.0.0         | SW Chiller                | Controle chiller                 |
| 52       | outlet | 26, 249          | 002-002-002-012   | 6.0.0         | Sw Repetidor Regulação    | Switch do repetidor de regulação |

> ⚠️ Slave 54 tem `version = 244.100.0` (anômalo — todos os outros switches são `6.0.0`). Pode ser firmware customizado ou rollover de versionamento. Validar comportamento.

---

## 4. Temperatura CO2

### 4.1 Ativos (sem offset, pós-migração)

| Slave ID | Type   | Addr (low, high) | Nome                | Code              | Version | Ambiente | fix-temp row | Migrado de |
|----------|--------|------------------|---------------------|-------------------|---------|----------|--------------|------------|
| 63       | outlet | 122, 249         | Temp. Co2_Lactareo  | 002-002-002-012   | 6.0.0   | Lactário | batch1_001   | id=64      |

### 4.2 Legados (OLD-)

| Slave ID | Type     | Addr (low, high) | Nome                          | Offset | Migrado para | fix-temp row |
|----------|----------|------------------|-------------------------------|--------|--------------|--------------|
| 64       | infrared | 82, 249          | OLD-T.e.m.p. Co2_Lactareo -6  | -6°C   | id=63        | batch1_001   |

> ✅ **batch1 (2026-05-19)** — Lactário (64 → 63, -6°C, padrão batch3 GAS→Temp). Total: **439.911 rows** migrados em one-shot 90 dias. SQL: `fix-temp-registry-batch1-2026-05-19.sql`. Log: `fix-temp-registry-execution-log-2026-05-19.md`.

> 🔗 **Possível ambiguidade com CENTRAL-CO2**: a CENTRAL-CO2 tem os slaves 156/157 (também nomeados "Lactário", ainda pendentes de classificação). Validar se são o mesmo ambiente físico monitorado por 2 centrais ou ambientes distintos.

---

## 5. Repetidores (passivos `infrared`)

Todos `type=infrared`, `code=002-002-002-014`, `version=7.0.0`.

| Slave ID | Addr (low, high) | Nome                                | Local                       |
|----------|------------------|-------------------------------------|-----------------------------|
| 38       | 96, 249          | Repetidor Terraço(8°)               | Terraço do 8° andar         |
| 39       | 67, 249          | Repetidor Maternidade(Terraço)      | Maternidade — Terraço       |
| 40       | 1, 249           | Repetidor Predio Regulador(Terraço) | Prédio Regulador — Terraço  |
| 45       | 4, 248           | Repetidor Maternidade(Térreo)       | Maternidade — Térreo        |

---

## 6. ⚠️ Sensor especial (originalmente classificado como repetidor)

| Slave ID | Type                 | Addr (low, high) | Code              | Version | Nome        | Suspeita                                        |
|----------|----------------------|------------------|-------------------|---------|-------------|-------------------------------------------------|
| 58       | `three_phase_sensor` | 61, 248          | 002-002-002-015   | 6.0.0   | Repetido 03 | Sensor trifásico — provavelmente quadro elétrico, NÃO é repetidor passivo |

> ⚠️ **Investigar antes de qualquer mexida**: slave 58 está nomeado como `Repetido 03` mas o `type` (`three_phase_sensor`) e o `code` (`002-002-002-015` — único na T&D) revelam que é um sensor de medição trifásica, não um repetidor passivo. Tem `channels = 3` (vs 1 dos repetidores normais).
>
> Possíveis queries para confirmar:
> ```sql
> SELECT * FROM channels WHERE slave_id = 58;
> SELECT COUNT(*) FROM temperature_history WHERE slave_id = 58 AND timestamp >= NOW() - INTERVAL '30 days';
> -- Se houver outras tabelas de leitura elétrica (kw_history, voltage_history, etc.), checar lá.
> ```

---

## 7. Outros / A identificar

| Slave ID | Type   | Addr (low, high) | Nome      | Created    | updated_at  | Status                                                      |
|----------|--------|------------------|-----------|------------|-------------|-------------------------------------------------------------|
| 65       | outlet | 101, 248         | Vigarista | 2024-12-30 | 2024-12-30  | **Abandonado** — sem updates desde a criação (>4 meses) ⚠️ |

> Slave 65 sem atualização há ~5 meses. Provavelmente teste/diagnóstico abandonado. Candidato a desativação ou renomeação para `SPARE-Vigarista` para sinalizar no UI.

---

## Resumo por categoria

| Categoria                                    | Qtd     |
|----------------------------------------------|---------|
| SCD (vazão, todos outlet)                    | 12      |
| Hidrômetros (outlet)                         | 2       |
| Switches (outlet, sendo 1 com version anômala) | 5     |
| Temperatura CO2 — ativos sem offset          | 1 (63)  |
| Temperatura CO2 — legados OLD-               | 1 (64)  |
| Repetidores infrared                         | 4       |
| Sensor trifásico mascarado como repetidor    | 1 (58) ⚠️ |
| Abandonado / a identificar                   | 1 (65) ⚠️ |
| **Total slaves**                             | **27**  |

---

## Pontos de atenção (resumo)

1. ✅ **Migração Lactário concluída** (batch1, 2026-05-19) — 64 → 63, -6°C, 439.911 rows.
2. **Slave 58 não é repetidor**: é `three_phase_sensor` (`002-002-002-015`). Investigar o que está sendo monitorado.
3. **Slave 54 com version anômala** (`244.100.0` ao invés de `6.0.0`). Validar firmware/comportamento.
4. **Slave 65 (Vigarista) abandonado**: sem updates desde 2024-12-30. Decidir desativação ou marcação como SPARE.
5. **Ambiguidade Lactário**: cruzar 63 da T&D (Lactareo) com 156/157 da CENTRAL-CO2 (Lactário) para descartar dupla contagem.

---

## Acumulado da central (todas as sessões)

| Sessão              | Rows do histórico migrados |
|---------------------|----------------------------|
| 2026-05-19 batch1   | 439.911                    |
| **Total acumulado** | **439.911**                |
