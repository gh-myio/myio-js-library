# Override Slots — Março 2026

**Widget:** `Tabela_Temp_V5` — Smart Hospital Temperature Monitoring  
**Cliente:** Complexo Hospitalar Municipal Souza Aguiar (HMSA)  
**Período de referência:** 01/03/2026 a 31/03/2026  
**Baseado em:** checkTempv1 (ANALISE-RELATORIO-MARCO-2026.md)  
**Excluído:** 12/03/2026 inteiro (central queimada — evento de infraestrutura)

---

## Resumo

329 slots identificados como ausentes no relatório v2 (fora o evento de 12/03), todos confirmados como sentinel `17,00` no v1 — nenhuma leitura real foi perdida. Dois JSONs foram gerados para uso com a modal de Ajuste Manual de Temperatura:

| Arquivo | Descrição |
|---|---|
| `target-to-customer/override_v1_raw.json` | JSON A — 329 slots com `value: 17.00` (valor sentinel confirmado pelo v1) |
| `target-to-customer/override_v1_raw.min.json` | JSON A minificado — 17.5 KB |
| `target-to-customer/override_v2_smart.json` | JSON B — 329 slots com valores calculados por média inteligente |
| `target-to-customer/override_v2_smart.min.json` | JSON B minificado — 24.3 KB |

---

## Slots por dispositivo

| Dispositivo | `deviceCentralName` | Slots | Janelas (BRT) |
|---|---|---|---|
| CTI 03 | `Co2_CTI_03` | 90 | 8 datas — noturno 03:00–09:00 |
| Cirurgia 09 | `Co2_Cirurgia9` | 83 | 23/03 05:30–23:30 · 25/03 00:00–22:30 |
| Cirurgia 08 | `Co2_Cirurgia8` | 59 | 05/03 18:00–23:30 · 09/03 00:00–23:00 |
| Queimados | `Co2_Queimados` | 46 | 06/03 00:00–16:30 · 28/03 04:30–10:00 |
| Laboratório | `Co2_Laboratorio` | 19 | 31/03 00:30–04:30 · 31/03 12:00–16:30 |
| CTI Pediátrico | `Co2_CTI_Pediatrico` | 18 | 28/03 04:00–12:30 |
| Cirurgia 03 | `Co2_Cirurgia3` | 5 | 01–02/03 (temp. real ~17°C) |
| Cirurgia 07 | `Co2_Cirurgia7` | 9 | 01–02/03 (temp. real ~17°C) |
| **Total** | | **329** | |

---

## JSON A — `override_v1_raw.json`

Estrutura `manualTempOverrides` pronta para importação via modal.  
Todos os slots têm `value: null` — o hospital preenche com os registros físicos do livro de controle de temperatura.

**Uso:** abrir modal ✏️ → Ver ajustes existentes → importar ou preencher slot a slot.

---

## JSON B — `override_v2_smart.json`

Valores calculados automaticamente a partir dos dados reais de março 2026 (`2026-march/responseJsonCentral*.json`).

### Fonte de dados
- 4 arquivos JSON com 46.128 registros do mês de março
- Campos: `deviceName`, `time_interval` (UTC), `value` (numérico)
- Filtros aplicados: `value <= 0`, `value === "SEM DADOS"` e qualquer slot de 12/03 são excluídos como inválidos

### Algoritmo de média inteligente

Para cada slot faltante `(deviceCentralName, timeUTC)`:

```
weekday = dia da semana do slot (0=Dom ... 6=Sáb)
hora    = hora UTC do slot (ex: 06:30)

1. Mesmo weekday, semanas adjacentes (prioridade):
   a. semana -1 E semana +1 → média aritmética dos dois
   b. só um disponível     → usa esse valor diretamente
   c. nenhum               → tenta semana -2 / +2
   d. nenhum               → tenta semana -3 / +3

2. Se ainda sem resultado — vizinhos de dia (fallback):
   a. d-1 E d+1 na mesma hora UTC → média
   b. só um disponível             → usa esse
   c. d-2 E d+2, d-3 E d+3 ... até ±7 dias

3. Se nenhum encontrado: value = null (não forçar dado fictício)
```

Cada slot no JSON B carrega um campo extra `_source` para auditoria:

```json
{ "timeUTC": "2026-03-02T07:30:00.000Z", "value": 21.50, "_source": "week-1+week+1" }
{ "timeUTC": "2026-03-04T06:30:00.000Z", "value": 20.00, "_source": "week-1" }
{ "timeUTC": "2026-03-23T08:30:00.000Z", "value": null,  "_source": "not_found" }
```

> **Nota sobre Cirurgia 03 e Cirurgia 07:** os 14 slots desses dispositivos (01–02/03) tinham temperatura real próxima de 17°C (não eram falhas de sensor). Para esses slots, o algoritmo de média é especialmente importante para não introduzir distorção — o valor calculado pode confirmar ou refutar se a leitura era plausível.

---

## Resultados JSON B

| Fonte de referência | Slots |
|---|---|
| `week-1+week+1` (média ±1 semana) | 71 |
| `week-1` (semana anterior) | 106 |
| `week+1` (semana seguinte) | 123 |
| `week-2` | 8 |
| `week+2` | 16 |
| `not_found` (sem referência) | 5 |

Os 5 slots `not_found` pertencem ao dispositivo `Co2_Cirurgia3` (01/03 e 02/03) — dispositivo ausente em todos os 4 arquivos de origem. Esses slots permanecem `value: null` com `_source: "not_found"`.

Nenhum slot precisou recorrer ao fallback de dias adjacentes — todas as referências foram encontradas dentro da janela semanal (±1 ou ±2 semanas).

---

## Notas de implementação

- `timeUTC` de cada slot corresponde exatamente ao campo `time_interval` da API central — match é por string comparison após `.trim()`
- Horários nas tabelas acima estão em **BRT (UTC−3)**; os JSONs armazenam em **UTC**
- O campo `_source` do JSON B é apenas para auditoria e deve ser removido antes de importar via modal (a modal ignora campos extras, mas é boa prática)
- Após importação: recarregar o relatório do período 01–31/03/2026 para verificar aplicação dos overrides

---

*Gerado em 2026-04-02 · MYIO Platform*
