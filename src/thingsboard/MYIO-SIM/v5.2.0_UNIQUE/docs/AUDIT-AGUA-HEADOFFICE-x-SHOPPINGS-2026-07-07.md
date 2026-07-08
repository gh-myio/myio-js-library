# Auditoria de Água — Head Office (MYIO SIM UNIQUE) × Dashboards dos Shoppings

**Data do estudo:** 2026-07-07 (mesma metodologia da auditoria de Energia — ver `AUDIT-ENERGIA-HEADOFFICE-x-SHOPPINGS-2026-07-07.md`)
**Período comparado:** 01/07/2026 00:00 → 07/07/2026 (mês corrente até o momento; default dos dois lados)
**Método:** leitura ao vivo dos badges das colunas (menu Água de cada dashboard v-5.2.0) e das abas Água do head office. Drift de ~0,1–1% entre leituras é crescimento do consumo em tempo real.

## Mapeamento de colunas (Água)

| Coluna no shopping | Aba no Head Office (menu Água) | Contexto RFC-0111 |
|---|---|---|
| Entrada | — (sem aba própria; não entra no Resumo) | `water.hidrometro_entrada` |
| Área Comum | Água > Area Comum | `water.hidrometro_area_comum` (+ banheiros) |
| Lojas | Água > Lojas | `water.hidrometro` |

## 1. Mapa por coluna — dashboards dos shoppings

Formato: `hidrômetros · consumo no período (m³)`.

| Shopping | Entrada | Área Comum | Lojas |
|---|---|---|---|
| Metrópole Pará | 2 · 1.487,650 | 10 · 296,945 | 88 · 400,586 |
| Rio Poty | 2 · 541,470 | 9 · 545,110 | 80 · 548,458 |
| Moxuara | 1 · 781,160 | 5 · 173,310 | 74 · 401,976 |
| Shopping da Ilha | 5 · 119,500 ⚠️ | 4 · 308,630 | 89 · 976,333 |
| Mont Serrat | 1 · 363,650 | 5 · 232,730 | 51 · 161,662 |
| Mestre Álvaro | 2 · 1.051,150 | 11 · 323,016 | 67 · 465,161 |
| **Σ (6 shoppings)** | **13 · 4.344,58 m³** | **44 · 1.879,74 m³** | **449 · 2.954,18 m³** |

⚠️ **Shopping da Ilha**: Entrada (119,5 m³) muito MENOR que os consumidores (AC+Lojas ≈ 1.285 m³) — 5 hidrômetros de entrada aparentemente sem medição plena no período (verificar em campo/ingestão).

## 2. Leituras do Head Office

**Card do header:** Água `9.164,96 M³` (no momento da leitura)

| Aba (menu Água) | Conectividade | Hidrômetros | Consumo total | Sem consumo |
|---|---|---|---|---|
| Area Comum | 8/43 (18,6%) ⚠️ | **43** | **1.878,84 m³** | 12 |
| Lojas | 123/444 (27,7%) ⚠️ | **444** | **2.945,22 m³** | 55 |

**Água > Resumo** (cards): Consumo Lojas `2,95 k m³ (61,1%)` · Consumo Área Comum `1,88 k m³ (38,9%)` · Consumo Total `4,82 k m³` (487 dispositivos).

## 3. Resultados do batimento

### 3.1 Consumo — ✅ BATE nos dois grupos

| Grupo | Σ shoppings | Head Office | Δ |
|---|---|---|---|
| Área Comum | 1.879,74 m³ | 1.878,84 m³ | **0,05%** ✅ |
| Lojas | 2.954,18 m³ | 2.945,22 m³ | **0,3%** ✅ (drift) |

- O **Resumo** fecha com as abas (2,95k + 1,88k = 4,82k m³) ✅.
- O **card do header** (9.164,96 M³) ≈ Lojas + Área Comum + Entradas (2.945 + 1.879 + 4.345 = 9.169 m³) ✅ — o header soma TODOS os hidrômetros, incluindo entradas.

### 3.2 Contagem de hidrômetros — pequenos gaps

| Grupo | Σ shoppings | HO | Δ |
|---|---|---|---|
| Área Comum | 44 | 43 | −1 |
| Lojas | 449 | 444 | −5 |

Ao contrário de Energia (HO tinha devices a MAIS, incluindo customers-lixo), em Água o HO tem **6 hidrômetros a menos** que a soma das colunas — devices presentes nos datasources dos shoppings mas fora do datasource do HO (diff nominal pendente).

### 3.3 Conectividade baixa nas abas de água ⚠️

`8/43 (18,6%)` em Área Comum e `123/444 (27,7%)` em Lojas — a maioria dos hidrômetros aparece sem conectividade recente no HO (nos dashboards dos shoppings o número não foi capturado neste estudo). Ponto de investigação separado (pode ser janela de telemetria/config de status, não necessariamente hardware).

### 3.4 Gráfico "Consumo de Água" do Resumo — ❌ MOCK

O gráfico diário do Água > Resumo mostra ~60–105 m³/dia, incompatível com o total do período (4,82 k m³ ⇒ ~690 m³/dia). Causa: `WaterPanelView.ts` tem o mesmo padrão do painel de energia — `fetchData: this.params.fetchConsumptionData || createMockFetchData()` (mock "Shopping Aricanduva/Interlagos…", `WaterPanelView.ts:192,292,318`). O controller UNIQUE não injeta `fetchConsumptionData` no `createWaterPanelComponent` → dados de demonstração.

**Fix recomendado (mesma receita da Energia):** injetar `fetchConsumptionData(periodDays)` real. Fontes possíveis por shopping: hidrômetros de ENTRADA de água (13 devices, série por device — rápida, mas Ilha subconta) ou série agregada `/customers/{ing}/water/` (fiel às colunas, porém lenta ~2min/shopping). Dado o problema de entrada da Ilha, a agregada por shopping (lojas+AC) é a mais fiel.

## 4. Ações recomendadas

1. **Investigar entradas de água do Shopping da Ilha** (5 hidrômetros somando só 119,5 m³ vs 1.285 m³ consumidos).
2. **Diff nominal dos 6 hidrômetros ausentes no HO** (−1 AC, −5 Lojas).
3. **Injetar fetcher real no gráfico do Água > Resumo** (eliminar mock, como feito na Energia).
4. **Investigar conectividade baixa** dos hidrômetros nas abas do HO.
