# TS-001 — Execução 2026-10-05 — Shopping da Ilha

> Cenário: [TS-001](../TS-001-shopping-v520-dashboard-e-relatorios.md)
> Executado via Chrome DevTools (MCP, porta 9222) com medições por `performance.getEntriesByType('resource')`
> e captura de `console.error/warn`.

## Parâmetros

| Campo | Valor |
|---|---|
| Ambiente | `https://dashboard.myio-bas.com` (produção) |
| Dashboard | `Dashboard - Shopping da Ilha - v.5.2.0` (`d2754480-b668-11f0-be7f-e760d1498268`) |
| Cliente | Shopping da Ilha (TB `209424d0-b04f-11f0-9722-210aa9448abc`) |
| Lib carregada | `myio-js-library@latest` via unpkg → **0.1.547** |
| Período padrão | 01/10/2026 00:00 → 05/10/2026 23:59 |
| Executor / data | Claude Code (Rodrigo Lago), 05/10/2026 ~14:00 BRT |

---

## Carregamento do dashboard (domínio Energia)

| Métrica | Valor |
|---|---|
| Totais de energia disponíveis | **~26 s** após abrir (fim da última chamada `energy/devices/totals`) |
| Última requisição de API da carga | **49,5 s** |
| Requisições de API na carga | 516 (506 ThingsBoard, 3 data-ingestion, 4 GCDR, 2 alarms) |
| Requisições com falha (≥ 400) | **0** |
| Erros de console | **1**: `[MyIOUtils] Data load error for energy: ctx.data timeout - datasources not loaded` |
| Avisos relevantes | `ctx.data wait timeout after 20000ms`, `Stale hydration for energy … skipping emit` (2×), `[TELEMETRY energy] Timeout waiting for data, retrying` (5×), `[RFC-0107] Validation timeout after 15000ms`, `[HEADER] RFC-0152 FALLBACK: onInit not called` |

**Requisições mais pesadas da carga:**

| Requisição | Qtde | Tempo | Janela |
|---|---|---|---|
| TB `GET /api/plugins/telemetry/DEVICE/:id/values/attributes/SERVER_SCOPE` | **469** (1 por device) | soma 113 s | 12,5 s → 49,5 s |
| data-ingestion `GET …/energy/devices/totals` | **2** (mesma consulta duplicada) | 13,9 s + 13,2 s | 12,0 s → 26,0 s |
| alarms-api `GET /api/v1/alarms` | 2 | ~1,1 s cada | |
| GCDR `GET /customers/:id/goals` | 3 | 0,9 s maior | |

Água e Temperatura carregam sob demanda ao clicar no menu: **11,2 s** (Água) e **12,0 s** (Temperatura).

## Baseline do dashboard (período 01–05/10/2026)

| Domínio | Grupo | Dispositivos | Valor no dashboard |
|---|---|---|---|
| Energia | Entrada | 2 | 211.397,37 kWh |
| Energia | Área Comum | 67 | 57.912,04 kWh |
| Energia | Lojas | 231 | 100.204,94 kWh |
| Energia | Transformadores | 0 | 0 |
| Água | Entrada | 2 | 1.703,900 m³ |
| Água | Área Comum (Banheiros) | 4 | 214,670 m³ |
| Água | Lojas | 89 | 556,648 m³ |
| Temperatura | Climatizável | 16 | média 24,4 °C (cards entre 20,5 e 26,6 °C) |
| Temperatura | Não climatizável | 0 | — |

## Relatórios (MENU → 📊 Relatórios)

Alarmes: os 3 cards estão **desabilitados (🔒)** neste cliente — não testados.

| # | Domínio | Relatório | Tempo (s) | API principal | Dispositivos | Zerados | Total relatório | Total dashboard | Δ | Erros | Resultado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Energia | Entrada | 9,7 | `energy/devices/totals` 9,2 s · 200 | 2 | 0 | 211.397,38 kWh | 211.397,37 | 0,00% | 0 | ✅ |
| 2 | Energia | Área Comum | 10,1 | 9,5 s · 200 | **66** | 2 | 57.912,08 kWh | 57.912,04 (67 disp.) | 0,00% | 0 | ⚠️ contagem (F4) |
| 3 | Energia | Lojas | 11,2 | 9,5 s · 200 | 231 | 5 | 100.204,88 kWh | 100.204,94 | 0,00% | 0 | ✅ |
| 4 | Energia | Todos Dispositivos | 10,7 | 9,5 s · 200 | 299 | 7 | 369.514,34 kWh | soma 369.514,35 (300 disp.) | 0,00% | 0 | ⚠️ total soma Entrada + consumidores (F3) |
| 5 | Água | Entrada | 14,2 → **1,9** | `water/devices/totals` 13,8 s → 1,3 s | 0 → 2 | — | **"Nenhum dado encontrado"** → 1.703,90 m³ | 1.703,90 | 0,00% | 0 | ❌ antes de abrir a aba Água (F2) · ✅ depois |
| 6 | Água | Área Comum | 3,7 | 1,3 s · 200 | 4 | 2 | 214,67 m³ | 214,67 | 0,00% | 0 | ✅ |
| 7 | Água | Lojas | 2,5 | 1,2 s · 200 | 89 | 9 | 556,65 m³ | 556,648 | 0,00% | 0 | ✅ |
| 8 | Água | Todos Dispositivos | 2,2 | 1,3 s · 200 | 95 | 11 | 2.475,22 m³ | soma 2.475,22 | 0,00% | 0 | ⚠️ (F3) |
| 9 | Temperatura | Climatizáveis | 8,0 | `temperature/devices/totals` 6,9 s + 5× `devices/:id/temperature` | 16 | **16** | **0,00 °C** | 24,4 °C | 100% | 0 | ❌ **(F1)** |
| 10 | Temperatura | Não Climatizáveis | 4,8 | 3,6 s · 200 | 0 | — | "Nenhum dado encontrado" | 0 dispositivos | — | 0 | ✅ coerente |
| 11 | Temperatura | Todos Ambientes | 7,2 | 6,8 s · 200 | 16 | **16** | **0,00 °C** | 24,4 °C | 100% | 0 | ❌ **(F1)** |
| — | Alarmes | Por Dispositivo · Dispositivo × Tipo · Por Tipo | — | — | — | — | — | — | — | — | 🔒 desabilitados |

Nenhuma requisição falhou e nenhum erro de console novo apareceu durante os relatórios.

---

## Achados

| # | Severidade | Descrição | Evidência | Sugestão / ticket |
|---|---|---|---|---|
| F1 | **Alta** | Relatórios de **temperatura mostram 0,00 °C** para os 16 sensores, enquanto o dashboard mostra 20,5–26,6 °C. | `temperature/devices/totals` devolve 117 devices: **95 `water`, 17 `energy`, 5 `temperature`**, com `summary.totalValue` = 2.471,96 (valor de água). Os 16 sensores do dashboard estão cadastrados na ingestão como **`deviceType: "energy"`** (ex.: `TEMP. SCSDITEMST1_6`, `7fcf7f0b-…`) com `total_value: 0`. O relatório busca a série por device só dos 5 marcados como `temperature` (repetidores, fora da lista do dashboard). | Backend: corrigir o `deviceType` dos sensores `TEMP. SCSDI…` na data-ingestion e o endpoint de totais de temperatura (relacionado ao **ED-1118**, "endpoints de totais de temperatura liam a tabela de água"). Lib: o relatório de temperatura poderia buscar a série pelos `ingestionId` do `itemsList`, sem depender do `deviceType` da resposta de totais. |
| F2 | Média | Relatórios de **Água/Temperatura abertos pelo MENU sem ter visitado a aba do domínio** voltam "Nenhum dado encontrado", embora a API tenha dados. | Água Entrada: `water/devices/totals` 200 em 13,8 s, `itemsList` vazio (`getWaterGroups()` = 0 itens antes de clicar em Água). Depois de abrir a aba: 2 devices, 1.703,90 m³. | MENU `_buildItemsList`: quando os grupos do domínio ainda não foram carregados, disparar a carga (ou abrir o relatório sem filtro e avisar), em vez de filtrar por lista vazia. |
| F3 | Média | **"Todos Dispositivos" soma Entrada + consumidores**: energia 369.514 kWh (real 211.397 kWh), água 2.475 m³ (real 1.704 m³). Os percentuais da tabela são calculados sobre esse total inflado (Geral Entrada = 47,44%). | KPIs do relatório 4 e 8. Coerente com `STATE.energy.summary.total` (369.514), mas não com "Total Consumidores" do painel de informações (211.397). | Mostrar totais por grupo e um total sem a Entrada (ou deixar explícito "inclui medição de entrada"). |
| F4 | Baixa | Área Comum: **67 no dashboard × 66 no relatório**. Falta `CM AR 4`. | Device `b53602b2-…` (FANCOIL, offline, anotação "Informado como desativado") com `_hasApiData: false`: a API não o devolve, e o relatório só lista o que a API retorna. | Listar devices do `itemsList` sem dado da API como "sem dados", para a contagem bater com o card. |
| F5 | Média (desempenho) | Carga do dashboard faz **469 requisições individuais de atributos SERVER_SCOPE** (uma por device) e **duplica** a consulta de totais de energia (~13–14 s cada). | Tabela "Requisições mais pesadas". Erro de console `ctx.data timeout - datasources not loaded` e avisos `Stale hydration`. | Buscar atributos em lote (`entitiesQuery/find` com `latestValues`) e deduplicar a chamada de totais (mesmo `periodKey`). |
| F6 | Baixa | Texto do estado vazio do relatório de **Entrada** diz "visualizar os dados de **todas as lojas**". | Modal "Energia - Dispositivos de Entrada" antes de Carregar. | Texto genérico por grupo. |
| F7 | Baixa | Água: coluna **"Área Comum" (4)** lista os **Banheiros**; o painel "Informações de Água" mostra Banheiros 214,670 m³ e **Área Comum 0,000 m³**. | Screenshot da aba Água. | Alinhar o rótulo da coluna com a classificação (Banheiros) ou com o painel. |
| F8 | Observação | Os cards de temperatura usam janela **móvel de 72 h** (`02/10 17:09 → 05/10 17:09`, 1 h), não o período selecionado (01–05/10). | Requisições `devices/:id/temperature?startTime=2026-10-02T17:09…&granularity=1h`. | Confirmar se é intencional (temperatura "atual") e indicar na UI. |

## Conclusão

- **Energia:** os 4 relatórios batem com o dashboard (Δ ≤ 0,001%), em ~10 s cada (API de totais ~9,5 s).
- **Água:** os 4 relatórios batem, mas só depois de abrir a aba Água (F2).
- **Temperatura:** relatórios **inutilizáveis** neste cliente (F1), por cadastro de `deviceType` na ingestão e pelo endpoint de totais.
- **Alarmes:** desabilitados.
- **Carregamento:** sem falhas HTTP, mas lento (~26 s para os totais e ~50 s até a última requisição), com N+1 de atributos e consulta duplicada (F5).
