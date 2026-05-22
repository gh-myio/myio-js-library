# Raio-X — Main View Shopping v5.2.0 · Campinas Shopping

> Data da análise: **2026-05-21** · Visão: **Energia (default)**
> Widgets: `main-dashboard-shopping/v-5.2.0/WIDGET`
> Período dos dados: **01/05/2026 → 21/05/2026**
> Fonte: `campinas-dashboard.log` + 3 CSVs `campinas-shopping-{entrada,area-comum,lojas}-20260521-2256.csv`

---

## 1. Contexto

Dashboard em modo **Energia** para o cliente **Campinas Shopping**
(`customerId 73d4c75d-c311-4e98-a852-10a2231007c4`). A tela carrega:

- **3 widgets `TELEMETRY`** (domain energy): **Entrada**, **Área Comum**, **Lojas**
- **1 widget `TELEMETRY_INFO`** — cards de KPI + Distribuição de Consumo

Origem dos dados: API de ingestão
`GET /telemetry/customers/{cid}/energy/devices/totals?startTime=…&endTime=…&deep=1`

---

## 2. Inventário da API (`deep=1`)

| Métrica | Valor |
|---------|-------|
| Devices retornados | **202** |
| `deviceType = energy` | **112** |
| `deviceType = water` | **90** |
| Soma `total_value` energy | **363.680 kWh** |
| Soma `total_value` water | 0 (esperado — endpoint é `/energy/`) |

> A resposta vem do endpoint **energy**; devices `water` aparecem (por `deep=1`)
> mas com `total_value = 0` — o consumo de água sai do endpoint `/water/`.

### Gateways (5)

| gatewayId | energy | water |
|-----------|:------:|:-----:|
| `72620ea0-…-30c564ee7442` | 59 | 0 |
| `1b5d79c4-…-89e8b1499920` | 44 | 9 |
| `c248c77f-…-cf371a82f4d9` | 8 | 0 |
| `b126ce91-…-b157b47e2600` | 1 | 61 |
| `aab91440-…-6533c93afb57` | 0 | 20 |

Energia distribuída em 3 gateways (59 + 44 + 8 + 1 = 112).

---

## 3. Os 3 widgets `TELEMETRY` (energy)

| Widget | Devices | Soma | Observação |
|--------|:-------:|-----:|------------|
| **Entrada** | 6 | 56.042 kWh | medição de entrada (subestações + relógios) |
| **Área Comum** | 5 | 170.702 kWh | Chiller + Administração + Bombas + Trafo |
| **Lojas** | 89 | 136.935 kWh | **0 lojas zeradas** ✅ |
| **Total (AC+Lojas)** | 94 | **307.638 kWh** | = "Total Consumidores" do card |

- **112 energy na API − 12 zerados = 100** devices ativos → batem com os 3 widgets
  (6 + 5 + 89 = 100). Os 12 zerados (ver §5) não entram em widget nenhum.
- **Lojas: 0 zeradas.** O fix de `ingestionId` aplicado em 2026-05-21 surtiu efeito —
  inclusive Havaianas 1 (11,6 kWh) e Havaianas 2 (3,7 kWh) já aparecem.
- 14 das 89 lojas têm `Identificador = N/A` (ou "Sem Identificador").

---

## 4. Widget `TELEMETRY_INFO` — cards e distribuição

| Card | Valor | % |
|------|------:|--:|
| Entrada | 54.077 kWh | — |
| Lojas | 136.935 kWh | 44,5% |
| Climatização | 102.346 kWh | 33,3% |
| Elevadores | 0 | 0,0% |
| Esc. Rolantes | 0 | 0,0% |
| Outros Equipamentos | 68.356 kWh | 22,2% |
| Pontos Não Mapeados | 0 | 0,0% |
| **Total Consumidores** | **307.638 kWh** | 100% |

### Conferência cruzada (tudo fecha) ✅

- `Total = Lojas + Climatização + Outros` → 136.935 + 102.346 + 68.356 = **307.637** ✔
- `Widget Área Comum = Climatização + Outros` → 102.346 + 68.356 = **170.702** ✔
  (Climatização = o Chiller; Outros = Adm 1 + Adm 2 + Bombas + Trafo Outback)
- `API energy = Entrada + Consumidores` → 56.042 + 307.638 = **363.680** ✔

---

## 5. 🔴 Achado crítico — Entrada subdimensionada

**A entrada medida é ~6× menor que o consumo somado dos consumidores.**

| | kWh |
|--|----:|
| Entrada medida (card) | 54.077 |
| Total Consumidores | 307.638 |
| **Razão consumidores / entrada** | **5,69×** |

Fisicamente impossível: o consumo interno do shopping não pode exceder o que
entra pela subestação. As duas subestações somam só 48.085 kWh
(`Entrada Subestação 2` 41.531 + `Entrada Subestação` 6.554) para um shopping
que consome 307 MWh no período.

**Hipótese principal:** multiplicador / relação de TC errado nos medidores de
subestação. O nome do device traz pistas de configuração —
`Entrada_Sub2 x1600 x10A x160V` — vale auditar se o fator aplicado bate com a
relação de TC física instalada.

**Impacto:** o cálculo de **Área Comum** do RFC-0128
(`Área Comum = Entrada − Σ consumidores`) fica **negativo** — por isso o painel
hoje exibe Área Comum como soma direta dos equipamentos (170.702) em vez do
cálculo por diferença. A reconciliação entrada-vs-consumo está quebrada.

**Ação sugerida:** revisar a parametrização dos medidores
`Entrada Subestação` e `Entrada Subestação 2` (relação de TC / multiplicador).

---

## 6. ⚠️ Achados de atenção

### 6.1 — 12 devices energy zerados na API
Não entram nos widgets (corretamente). Dois grupos:

**A) Nunca transmitiram (`lastTelemetryTs = null`) — 6:**
`3F Relógio 302136207 (Entrada Detran)`, `Repetidor Rihappy`,
`3F SCP0Q039 Touti`, `Device 26`, `Device 21`, `3F SCP0QXXX Premier`.

**B) Telemetria parada desde ago/2025 (~9 meses) — 6:**
`3F SCP0L00303 KFC`, `3F SCP0QM006 NXT`, `3F SCP0Q023 Pandora`,
`3F SCP0QXXX Global 1`, `3F SCP0Q265 Game Simulador`, `3F SCP0Q113 Feira Arte Mix`.

→ Candidatos a limpeza/desativação no ThingsBoard (devices órfãos/duplicados).
`Device 26` / `Device 21` / `Repetidor Rihappy` têm nomes genéricos — provável
sucata de cadastro.

### 6.2 — Card "Entrada" (54.077) ≠ Relatório "Entrada" (56.042) — **RESOLVIDO**
Relatório/CSV Entrada soma **56.042 kWh** (6 devices); card "Entrada" do
TELEMETRY_INFO mostra **54.077 kWh**. Diferença exata = **1.965,645 kWh** =
`3F RELOGIO DETRAN Emplacamento` (slave 93).

**Causa: o device tem `exclude_groups_totals` ligado — exclusão intencional.**

Inspeção runtime de `window.STATE.energy.entrada.items` (slave 93) mostrou o
device **dentro** do grupo entrada, **com** `value: 1965.64` — e o atributo:

```json
"excludeGroupsTotals": "{\"enabled\":true,\"groups\":{\"entrada\":true,
  \"lojas\":true,\"climatizacao\":true,\"elevadores\":true,
  \"escadas_rolantes\":true,\"outros\":true,\"area_comum\":true},
  \"lastUpdatedTime\":1776285559652}"
```

`enabled:true` + **todos os 7 grupos `true`** → o device foi marcado para ser
**excluído de todo total de grupo**. `lastUpdatedTime` = **2026-04-15 20:39 UTC**
(ação deliberada de configuração).

**Mecanismo no código** — `buildSummary` → `getValorEfetivo(item, 'entrada')`
(`MAIN_VIEW/controller.js:3224`):
```js
if (parsed && parsed.enabled) {
  if (parsed.groups['entrada'] === true) return 0;  // ← DETRAN cai aqui
}
```
O `value` (1965.64) é zerado **só para o cálculo do total** — o card do device
continua visível, mas não soma. Por isso `entradaTotal = 56.042 − 1.966 = 54.077`.

**É intencional.** `DETRAN Emplacamento` é locatário do governo (cartório de
emplacamento) dentro do shopping — energia que não é consumo operacional do
mall. Alguém configurou o `exclude_groups_totals` para não poluir os totais.
**O card (54.077) está certo.**

**O bug é do outro lado — o relatório (56.042) ignora o `exclude_groups_totals`.**
O `AllReportModal` não honra esse atributo: soma os 1.966 kWh do DETRAN no total
de Entrada, divergindo do dashboard. Os dois deveriam concordar.

> Os 2 devices Detran de energia — não confundir:
> | Device | slave | telemetria |
> |--------|:-----:|-----------|
> | `3F Relógio 302136207 (Entrada Detran)` | 72 | morta — device antigo, ignorar (§6.1) |
> | `3F RELOGIO DETRAN Emplacamento` | 93 | ativa, mas `exclude_groups_totals` ligado |

**✅ Fix implementado (2026-05-22)** — o `AllReportModal` passa a honrar o
`exclude_groups_totals` (opção (a): a linha do device é removida do relatório do
grupo excluído). 3 arquivos:

- `types.ts` — `StoreItem.excludeGroupsTotals` (novo campo).
- `MENU/controller.js` — `_buildItemsList.toItem` propaga `d.excludeGroupsTotals`.
- `AllReportModal.ts` — `isExcludedFromTotals()` / `resolveExclusionGroupKey()`;
  `mapCustomerTotalsResponse` faz `continue` no device excluído.

Resultado esperado: relatório de Entrada passa de 56.042 → **54.077 kWh**,
batendo com o card. Suporta formato atual (`groups`) e legado (`excludedGroups`).

**FLAG na UI (2026-05-22)** — checkbox **"Considerar exclusão de totais"**
(default ligado) na barra de topo do `AllReportModal`, com ícone `(i)` e tooltip
premium (lib `InfoTooltip`). Desligar → re-mapeia a resposta cacheada e mostra o
consumo bruto (com os devices excluídos). Não refaz fetch.

### 6.3 — Identificadores ausentes
14 das 89 lojas com `Identificador = N/A`. Sem identificador, cruzamentos
loja↔device dependem só do nome — frágil. Candidatas a preenchimento via
Upsell / Pre-Setup.

### 6.4 — Elevadores e Esc. Rolantes em 0
Ambas as categorias zeradas. Ou não há medição dedicada para esses equipamentos,
ou os devices não estão classificados (RFC-0128: `ELEVADOR`/`ELV-`,
`ESCADA_ROLANTE`/`ESC-`). Confirmar se é ausência de hardware ou de classificação.

---

## 7. Resumo executivo

| Item | Status |
|------|:------:|
| Relatório de Lojas (89, 0 zeradas) | ✅ saudável |
| Conferências cruzadas dos cards | ✅ fecham |
| Reconciliação Entrada × Consumo | 🔴 quebrada (5,69×) |
| 12 devices energy órfãos/parados | ⚠️ limpar |
| Card Entrada exclui DETRAN (intencional) | ✅ correto — bug é o relatório ignorar `exclude_groups_totals` |
| 14 lojas sem Identificador | ⚠️ preencher |
| Elevadores / Esc. Rolantes em 0 | ⚠️ verificar |

**Prioridade #1:** auditar a relação de TC / multiplicador dos medidores de
subestação — sem isso, todo o cálculo de Área Comum por diferença permanece
inválido.
