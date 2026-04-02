# Análise Comparativa — Relatório de Temperatura | Março 2026

**Cliente:** Complexo Hospitalar Municipal Souza Aguiar (HMSA)
**Período:** 01/03/2026 a 31/03/2026
**Arquivos analisados:**
- `01-dispositivo_temperatura_horario-...-emitido-em-01-04-2026-14-42.csv` — v1, emitido em 01/04/2026
- `02-relatorio_hospital_temperatura_periodo-...-emitido-em-02-04-2026-11-33 v2.csv` — v2, emitido em 02/04/2026

---

## Resumo Executivo

Ambos os arquivos contêm **45.693 linhas de dados**, **31 dispositivos idênticos** e o mesmo período. A única diferença entre v1 e v2 são **754 slots** onde o valor `17,00` foi reclassificado para `-` (ausente) ou `=` (lacuna).

**Nenhuma leitura real de temperatura foi alterada.** A correção foi exclusivamente semântica: o sentinel de falha de hardware (`17,00°C` = piso do sensor durante desconexão) foi substituído pela marcação correta de ausência de dado.

| Métrica | v1 | v2 | Δ |
|---|---|---|---|
| Linhas de dados | 45.693 | 45.693 | 0 |
| Dispositivos | 31 | 31 | 0 |
| Leituras numéricas reais | 45.312 | 44.558 | −754 |
| `-` (sensor ausente) | 0 | 740 | +740 |
| `=` (lacuna) | 382 | 396 | +14 |
| Ocorrências de `17,00` | 1.435 | 681 | −754 |

---

## Evento Principal — Central Queimada (12/03/2026 12:00–20:00)

Queda sistêmica de **8,5 horas** afetando **25 dos 31 dispositivos** simultaneamente. Causa confirmada: central queimada.

- **557 slots** excluídos desta análise por ser evento de infraestrutura conhecido
- Em v1, todos os dispositivos afetados aparecem com `17,00°C` durante o período — leitura falsa do piso de hardware
- Em v2, corretamente marcados como `-`
- **6 dispositivos imunes** (sem nenhuma alteração em todo o mês): Centro Obstétrico 01, 02, 03 · Lactáreo · Medicação CER · UTI Neonatal

---

## Análise por Dispositivo (excluindo evento de 12/03)

Restam **329 diferenças** após desconsiderar o evento da central.

### CTI 03 — Desconexão noturna recorrente (90 slots → 8 datas)

Padrão altamente regular: desconexão sempre entre **03:00–09:00**, ocorrendo a cada 2–5 dias.

| Data | Janela | Slots |
|---|---|---|
| 02/03 | 04:30 – 09:00 | 10 |
| 04/03 | 03:30 – 09:00 | 12 |
| 07/03 | 04:30 – 09:00 | 10 |
| 14/03 | 03:30 – 09:00 | 12 |
| 16/03 | 03:00 – 09:00 | 13 |
| 17/03 | 03:30 – 08:30 | 11 |
| 19/03 | 04:00 – 09:00 | 11 |
| 23/03 | 03:30 – 08:30 | 11 |

> ⚠️ **Requer atenção:** padrão recorrente toda madrugada sugere problema estrutural de conectividade do dispositivo ou janela de manutenção não documentada.

---

### Cirurgia 09 — 2 grandes interrupções (83 slots)

| Data | Janela | Slots | Observação |
|---|---|---|---|
| 23/03 | 05:30 – 23:30 | 37 | Recuperou às 23:30 |
| 25/03 | 00:00 – 22:30 | 46 | Recuperou às 23:00 (`17,79` → `23,11`) |

> Praticamente **2 dias sem dados reais** em 23–25/03.

---

### Cirurgia 08 — 2 interrupções (59 slots)

| Data | Janela | Slots | Observação |
|---|---|---|---|
| 05/03 | 18:00 – 23:30 | 12 | — |
| 09/03 | 00:00 – 23:00 | 47 | Dia quase completo; recuperou às 23:30 (`17,79`) |

---

### Queimados — 2 interrupções (46 slots)

| Data | Janela | Slots | Observação |
|---|---|---|---|
| 06/03 | 00:00 – 16:30 | 34 | Recuperou às 17:00 (`24,00`) |
| 28/03 | 04:30 – 10:00 | 12 | — |

---

### Laboratório — 2 janelas em 31/03 (19 slots)

| Janela | Slots | Observação |
|---|---|---|
| 00:30 – 04:30 | 9 | Recuperou às 05:00 (`24,88`) |
| 12:00 – 16:30 | 10 | Recuperou às 17:00 (`22,19`) |

> Duas desconexões distintas no mesmo dia.

---

### CTI Pediátrico — 1 interrupção em 28/03 (18 slots)

| Data | Janela | Slots |
|---|---|---|
| 28/03 | 04:00 – 12:30 | 18 |

---

### Cirurgia 03 e Cirurgia 07 — Slots `17,00 → =` (14 slots, 01–02/03)

Não são falhas de sensor. São momentos em que a temperatura real estava próxima de 17°C e v1 confundiu com o sentinel de desconexão. V2 reconheceu a continuidade de dados e classificou corretamente como `=` (lacuna preenchível).

| Dispositivo | Timestamps |
|---|---|
| Cirurgia 03 | 01/03 09:00, 11:30, 16:00 · 02/03 01:00, 04:00 |
| Cirurgia 07 | 01/03 08:30, 09:30, 16:30, 21:30, 22:00 · 02/03 01:00, 06:30, 08:00, 13:30 |

---

## Dispositivos sem nenhuma alteração entre v1 e v2

| Dispositivo | Status |
|---|---|
| Centro Obstétrico 01 | ✅ Dados íntegros |
| Centro Obstétrico 02 | ✅ Dados íntegros |
| Centro Obstétrico 03 | ✅ Dados íntegros |
| Lactáreo | ✅ Dados íntegros |
| Medicação CER | ✅ Dados íntegros |
| UTI Neonatal | ✅ Dados íntegros |

---

## Conclusão

**V2 é o relatório correto.** As 754 correções refletem fielmente a realidade operacional de março de 2026 — cada `17,00` removido corresponde a um período confirmado de desconexão de sensor, não a uma medição real de temperatura.

Os eventos residuais (após desconsiderar a central de 12/03) indicam problemas individuais de dispositivo que devem ser investigados pela equipe de manutenção, com destaque para:

1. **CTI 03** — desconexão noturna recorrente em 8 datas → investigar infraestrutura de rede na madrugada
2. **Cirurgia 09** — 2 dias sem dados em 23–25/03 → verificar histórico de manutenção do sensor
3. **Cirurgia 08** — dia completo sem dados em 09/03 → verificar log do dispositivo

---

*Análise gerada em 02/04/2026 · MYIO Platform v5*
