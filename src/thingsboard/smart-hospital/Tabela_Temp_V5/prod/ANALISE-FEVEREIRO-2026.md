# Análise de Cobertura de Dados — Fevereiro 2026
**Sistema:** Registro de Aferição de Temperaturas — Complexo Hospitalar Municipal Souza Aguiar
**Período:** 01/02/2026 00:00 → 28/02/2026 23:30 (Horário de Brasília)
**Elaborado em:** 03/03/2026

---

## 1. Base de Cálculo

| | |
|---|---|
| Total de devices monitorados | **28** |
| Slots de 30 min por device (48 slots/dia × 28 dias) | **1.344** |
| **Total teórico de leituras** | **37.632** |

---

## 2. Perdas de Dados — Eventos Identificados

```
 37.632   Base teórica

   -576   Central Travada (17/02 → 20/02)
   -175   Cirurgia 08 — pré-instalação
   -175   Cirurgia 07 — pré-instalação
   -176   CTI_03 — pré-instalação
    -71   CTI_03 — desconexão noturna recorrente
    -46   Queimados — instabilidade de conectividade
   -556   Centro Obstétrico 03 — sensor danificado
   -369   Central Maternidade queimada
─────────
  35.488   Total de leituras válidas no banco

  35.488   Real (JSON exportado)
─────────
       0   A investigar
```

---

## 3. Detalhamento dos Eventos

---

### 3.1 Central Maternidade queimada — `-369 slots`

**Devices afetados:** Co2_Centro_Obstetrico_01, Co2_Centro_Obstetrico_02, Co2_UTI_Neonatal
*(o Co2_Centro_Obstetrico_03 é contabilizado separadamente no item 3.5)*

| Campo | Valor |
|-------|-------|
| Causa | Central da Maternidade queimou |
| Início | 01/02/2026 00:00 BRT |
| Retorno | 03/02/2026 13:30 BRT (central nova instalada) |
| Slots sem dado por device | **123** |
| Devices | 3 |
| **Total** | **369 slots** |

**Cálculo:**
```
01/02: 48 slots
02/02: 48 slots
03/02: 00:00 → 13:00 = 27 slots  (13:30 = primeiro slot com leitura)
                        ─────────
                         123 slots × 3 devices = 369
```

---

### 3.2 Central Travada (Maternidade) — `-576 slots`

**Devices afetados:** Co2_Centro_Obstetrico_01, Co2_Centro_Obstetrico_02, Co2_Centro_Obstetrico_03, Co2_UTI_Neonatal

| Campo | Valor |
|-------|-------|
| Causa | Central da Maternidade travada |
| Início | 17/02/2026 07:30 BRT |
| Retorno | 20/02/2026 12:00 BRT |
| Janela total (4 devices × 154 slots) | 616 slots |
| Leituras reais capturadas nas bordas | **-40** (conectividade parcial) |
| **Total efetivo de SEM DADOS** | **576 slots** |

**Cálculo da janela:**
```
17/02: 07:30 → 23:30 = 33 slots
18/02: 48 slots
19/02: 48 slots
20/02: 00:00 → 12:00 = 25 slots
                        ─────────
                         154 slots × 4 devices = 616

Leituras reais nas bordas da janela: -40
                        ─────────
                         576 slots efetivos
```

> **Nota:** As 40 leituras reais são leituras capturadas momentaneamente durante
> a janela de outage (conectividade parcial antes e após o corte total).
> Devices 01, 02, UTI_Neonatal: ~10 leituras reais cada.
> Device 03: ~10 leituras reais nas bordas da janela.

---

### 3.3 Sensor Co2_Cirurgia_07 — pré-instalação — `-175 slots`

| Campo | Valor |
|-------|-------|
| Causa | Sensor instalado em 04/02/2026 |
| Primeiro slot com leitura | 04/02/2026 15:30 BRT (`2026-02-04T21:30:00Z` UTC raw) |
| **Total pré-instalação** | **175 slots** |

**Cálculo:**
```
01/02: 48 slots
02/02: 48 slots
03/02: 48 slots
04/02: 00:00 → 15:00 = 31 slots  (15:30 = primeiro slot com leitura)
                        ─────────
                         175 slots
```

---

### 3.4 Sensor Co2_Cirurgia_08 — pré-instalação — `-175 slots`

| Campo | Valor |
|-------|-------|
| Causa | Sensor instalado no mesmo lote do Cirurgia 07 |
| Primeiro slot com leitura | 04/02/2026 15:30 BRT (`2026-02-04T21:30:00Z` UTC raw) |
| **Total pré-instalação** | **175 slots** |

> Mesmo dia, mesmo horário, mesma contagem que Cirurgia 07.

---

### 3.5 Sensor Co2_Centro_Obstetrico_03 — danificado — `-556 slots`

| Campo | Valor |
|-------|-------|
| Causa | Sensor danificado. Inclui o período da central queimada (item 3.1) + período exclusivo do sensor |
| Início (sem dado) | 01/02/2026 00:00 BRT |
| Retorno | 12/02/2026 14:00 BRT (sensor trocado) |
| **Total** | **556 slots** |

**Composição dos 556 slots:**
```
Central queimada (mesmo período do item 3.1):
  01/02 00:00 → 03/02 13:00 = 123 slots

Sensor danificado (exclusivo device 03, após central voltar):
  03/02 13:30 → 12/02 13:30 = 433 slots
                               ─────────
                                556 slots
```

**Cálculo dos 556:**
```
01/02 → 11/02: 11 dias × 48 = 528 slots
12/02: 00:00 → 13:30 = 28 slots  (14:00 = primeiro slot com leitura)
                        ─────────
                         556 slots
```

**Validação:** O banco contém exatamente **700 SEM DADOS** para este device:
```
556 (sensor danificado + central queimada)
+144 (central travada, janela específica do device 03: 17/02 11:30 → 20/02 11:00)
─────────────────────────────────────────
 700 SEM DADOS ✓
```

---

### 3.6 Co2_CTI_03 — pré-instalação — `-176 slots`

| Campo | Valor |
|-------|-------|
| Causa | Sensor instalado no mesmo lote de Cirurgia 07 e Cirurgia 08 |
| Primeiro slot com leitura | 04/02/2026 16:00 BRT (`2026-02-04T22:00:00Z` UTC raw) |
| **Total pré-instalação** | **176 slots** |

> Iniciou 30 minutos após Cirurgia 07 e Cirurgia 08, daí 176 slots (vs 175).

---

### 3.7 Co2_CTI_03 — desconexão noturna recorrente — `-71 slots`

| Campo | Valor |
|-------|-------|
| Causa | Desconexão noturna recorrente (padrão 00:00–06:00 BRT) |
| Período | Ao longo de todo fevereiro |
| **Total** | **71 slots** |

**Ocorrências identificadas:**

| Data | Horário BRT | Slots |
|------|-------------|-------|
| 06/02 | 01:30 → 05:30 | 9 |
| 09/02 | 01:00 → 06:00 | 11 |
| 11/02 | 00:30 → 04:00 | 8 |
| 13/02 | 02:00 → 04:00 | 5 |
| 17/02 | 02:30 → 03:00 | 2 |
| 22/02 | 01:00 → 04:30 | 8 |
| 23/02 | 00:00 → 05:30 | 12 |
| 25/02 | 00:00 → 04:30 | 10 |
| 27/02 | 01:30 → 04:00 | 6 |
| **Total** | | **71** |

> **Ação recomendada:** Verificar estabilidade de alimentação/rede do sensor CTI_03 no período noturno.

---

### 3.8 Co2_Queimados — instabilidade de conectividade — `-46 slots`

| Campo | Valor |
|-------|-------|
| Causa | Instabilidade de conectividade nos primeiros dias de operação |
| Período | 04/02 → 12/02/2026 |
| Padrão | Sem horário fixo — slots isolados e pequenas sequências |
| **Total** | **46 slots** |

---

## 4. Resumo de Cobertura por Grupo

| Grupo | Devices | Slots esperados | Perdas | Válidos |
|-------|---------|----------------|--------|---------|
| Maternidade — Central queimada | 01, 02, UTI | 3 × 1.344 = 4.032 | 369 | 3.663 |
| Maternidade — Central travada | 01, 02, 03, UTI | 4 × 154 ≈ 576 ef. | 576 | — |
| Centro Obstétrico 03 | 03 | 1.344 | 700 (SEM DADOS) | 644 |
| Cirurgia 07 | 1 | 1.344 | 175 | 1.169 |
| Cirurgia 08 | 1 | 1.344 | 175 | 1.169 |
| CTI_03 | 1 | 1.344 | 176 + 71 = 247 | 1.097 |
| Queimados | 1 | 1.344 | 46 | 1.298 |
| Demais (20 devices) | 20 | 20 × 1.344 = 26.880 | 0 | 26.880 |

---

## 5. Fechamento — Conta Auditada

```
 37.632   Leituras teóricas (28 devices × 1.344 slots)

   -576   Central Maternidade travada (17/02 → 20/02)
   -175   Co2_Cirurgia_08 pré-instalação
   -175   Co2_Cirurgia_07 pré-instalação
   -176   Co2_CTI_03 pré-instalação
    -71   Co2_CTI_03 desconexão noturna
    -46   Co2_Queimados instabilidade
   -556   Co2_Centro_Obstetrico_03 sensor danificado
   -369   Central Maternidade queimada (01, 02, UTI_Neonatal)
─────────
  35.488   Leituras válidas esperadas

  35.488   Leituras válidas no banco (JSON)
─────────
       0   Pendências a investigar ✓
```

**Cobertura real do período:** 35.488 / 37.632 = **94,3%**
**Perdas justificadas:** 2.144 slots (5,7%) — todos com causa identificada.

---

## 6. Observações Técnicas

### Backend legacy (Central 1)
A Central 1 utiliza backend legado que armazena timestamps com offset de +3h em relação ao UTC real. O controller (`Tabela_Temp_V5 v3.1.1`) aplica correção de -3h antes de exibir os dados. A conversão correta para BRT é: `timestamp_raw − 6h`.

### Slots "SEM DADOS" vs registros ausentes
| Tipo | Descrição |
|------|-----------|
| `SEM DADOS` | Linha existe no banco, porém sem valor numérico (sensor offline durante a leitura) |
| Registro ausente | Nenhuma linha no banco para aquele slot (ex.: device não instalado, falha de ingestão) |

Os 700 SEM DADOS do Centro Obstétrico 03 e os 1.501 SEM DADOS totais da Central 3 são do primeiro tipo. Os devices da Central 1 (Cirurgia 07, Cirurgia 08, CTI_03, Queimados) têm registros completamente ausentes para os slots identificados.

### Interpolação
O widget suporta interpolação limitada (máximo 4 horas / 8 slots consecutivos, sem cruzar meia-noite). Nenhuma das perdas identificadas neste relatório é elegível para interpolação automática — todas excedem o limite ou estão em períodos sem dados reais adjacentes.
