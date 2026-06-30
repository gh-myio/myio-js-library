# GoalsModal — Showcase parity (RFC-0213)

Status: **implementado** em `GoalsModal.ts`. Este doc registra os itens da showcase
`showcase/consumption-trend-panel/` que foram aplicados ao componente e onde eles vivem.

O `GoalsModal` já trazia, de fábrica: tabs de domínio (energy/water/temperature),
granularidade **1M | 1d | 1h**, barra de consumo + **linha de meta** (de
`window.MyIOUtils.goalsData[domain].data.tree.{monthly,daily,hourly}`), footer de stats
(Total / Média / Pico / vs Meta) e o guard *latest-wins* (`_renderSeq`).

Abaixo, os itens da showcase que **foram adicionados**.

## 1) Comparação YoY (ano anterior)

| Item | Onde |
|------|------|
| Flag de estado (reseta ao abrir) | `let _compareYoY` ; `_compareYoY = false` em `GoalsModal.open()` |
| Botão **"↔ Ano ant."** no header (ao lado de 1M/1d/1h) | HTML em `_buildModalHTML()` (`id="gm-yoy-btn"`), estilo `.gm-yoy-btn` em `_injectStyles()` |
| Escondido em **Temperatura** (médias não fazem sentido) | `style="display:…temperature?'none'…"` no HTML + toggle no handler de aba em `_wireEvents()` |
| Wiring do toggle | `_wireEvents()` → `#gm-yoy-btn` click → alterna `_compareYoY` + `_loadAndRender` |
| Busca do mesmo período **−1 ano** | `_fetchPrevYearTotals(domain, gran, boundaries)` — shift por boundary via `setFullYear(-1)`, robusto a meses/dias; **reusa o callback `fetchConsumption`** (sem arquivos extras) |
| Boundaries centralizados | `_buildBoundaries(gran, dateISO)` |
| Disparo (energy/water; não temperatura) + guard | em `_loadAndRender`: `if (_compareYoY && domain !== 'temperature') { … if (seq !== _renderSeq) return; }` |
| **Barras cinza à esquerda** da barra atual | `_renderChart(...)` — dataset `'Ano anterior'` empurrado **primeiro** + mesmo `order` (agrupa à esquerda) |
| Entra no **Y-max** (não corta) | `allValues` inclui `prevTotals` em `_renderChart` |
| **Legenda** aparece com YoY | `legend.display = hasGoals || hasPrev` |
| Stat **"Consumo {ano} x {ano-1}"** (verde ↑ / vermelho ↓) | bloco de stats em `_loadAndRender`; ano por granularidade: 1M→`_selectedYear`, 1h→ano de `dateISO`, 1d→ano atual |

> Observação de UX (aberta): o stat YoY usa **verde para aumento / vermelho para queda**
> (igual à showcase). Para energia, "mais consumo" pode ser indesejável — inverter/neutralizar
> as cores é uma decisão de produto.

## 2) Fix do eixo unidade-única (Bug A da showcase)

Antes, o callback de ticks trocava de unidade **por valor** (misturava `kWh` e `MWh` no mesmo
eixo). Agora um **divisor/unidade único** é decidido uma vez a partir do `yMax`:

- `_renderChart`: `const useLarge = !!(cfg.unitLarge && cfg.threshold && yMax && yMax >= cfg.threshold)`,
  `axisDivisor`, `axisUnit`.
- `scales.y.title.text = axisUnit` e `ticks.callback = (val) => (val / axisDivisor).toFixed(useLarge ? 1 : 0)`.

## Itens da showcase NÃO portados (e por quê)

- **Tabs de granularidade** — já existiam (1M/1d/1h).
- **Linha/região de meta** — já existia (linha com `fill:'origin'` = área preenchida).
- **Banda ± % / legenda duplicada / dynamic legend** — N/A: o `GoalsModal` tem legenda única e a
  meta é linha preenchida, não banda com controle de `± %`.

## Como a showcase exercita o componente

`showcase/consumption-trend-panel/` carrega o UMD (`dist/myio-js-library.umd.min.js`) e chama
`MyIOLibrary.GoalsModal.open({ initialDomain:'energy', fetchConsumption, defaultPeriodDays })`,
populando `window.MyIOUtils.goalsData.energy` a partir de `./data/goals-2026-Hour-…json` e um
`fetchConsumption` mock que lê `./data/consumption-{2026,2025}-Hour-…json` (YoY usa o arquivo do
ano −1 pelo ano do timestamp).
