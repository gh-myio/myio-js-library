# Gap Analysis — MYIO-SIM v5.2.0 → v5.2.0_UNIQUE

## Contexto

Este relatório consolida a auditoria da refatoração que unifica **15 widgets legados** do MYIO-SIM v5.2.0 (cada um com seu `controller.js` próprio) em **um único controller `v5.2.0_UNIQUE`** (`controller.js`, ~6281 LOC). O objetivo é mapear, widget a widget, o que foi totalmente portado, o que está parcial, o que ainda usa dados mockados e o que está faltando — citando referências de linha do controller UNIQUE — para guiar o fechamento da consolidação com dados reais. As constatações vêm de 4 auditorias paralelas agrupadas por domínio (Energia & Equipamentos, Água, Temperatura & Telemetria, Chrome & Orquestração).

## Resumo Executivo

| Widget | Status | Confiança | Localização no UNIQUE | Principal lacuna |
|--------|--------|-----------|------------------------|------------------|
| ENERGY | ✅ fully-ported | Alta | RFC-0132, linhas 2980-3013 | — |
| STORES | ✅ fully-ported | Alta | linha 1799 (`createTelemetryGridComponent`), `getDevices('energy','stores')` 1754 | — |
| EQUIPMENTS | ✅ fully-ported | Alta | linha 1799, `getDevices('energy','equipments')` 1754 | — |
| WATER | 🟠 mocked | Alta | RFC-0133, linhas 2912-2980 (`createWaterPanelComponent`) | `getWaterSummary()` inexistente; evento sem `storesTotal`/`commonAreaTotal` |
| WATER_COMMON_AREA | ✅ fully-ported | Alta | linhas 2781-2790, `getDevices('water','hidrometro_area_comum')` 5294-5305 | — |
| WATER_STORES | ✅ fully-ported | Alta | linhas 2781-2790, `getDevices('water','hidrometro')` 5294-5305 | — |
| TEMPERATURE | 🟡 partial | Alta | RFC-0117, linhas 3957-3964 (`createTemperaturePanel`) | Sem `fetchTemperatureData`; KPIs, chart e lista por shopping ausentes |
| TEMPERATURE_SENSORS | 🟡 partial | Alta | RFC-0121, linhas 1743-1841 (`domain=temperature`, `context=termostato`) | Filter chips, header de stats e busca não confirmados |
| TEMPERATURE_WITHOUT_CLIMATE_CONTROL | 🟡 partial | Alta | RFC-0121, linhas 1743-1841 (`context=termostato_external`) | Classificação não distingue `termostato` vs `termostato_external` (linha 5100) |
| TELEMETRY | ✅ fully-ported | Alta | RFC-0121, linhas 1743-1841 | — |
| WELCOME | ✅ fully-ported | Alta | RFC-0112, linhas 1302-1441 | — |
| HEADER | 🟡 partial | Alta | RFC-0113, linhas 1443-1649 | Timing dos botões do filter modal (plan.md Issue #3) |
| MENU | 🟡 partial | Alta | RFC-0114, linhas 1652-1741 | Botões do filter modal não funcionais (Issue #3); shoppings só via cache |
| FOOTER | ✅ fully-ported | Alta | RFC-0115, linhas 2091-2135 | — |
| MAIN | ✅ fully-ported | Alta | RFC-0111 + RFC-0127, linhas ~800-3400 | Operacional mockado (RFC-0152) e panels modais TODO (não bloqueia core) |

**Contagem:** ✅ 8 fully-ported · 🟡 5 partial · 🟠 1 mocked · 🔴 0 missing.

## Cobertura por Domínio

### Energy & Equipments — 🟢 Saudável
ENERGY, STORES e EQUIPMENTS estão totalmente portados com dados reais via orchestrator (`createEnergyPanelComponent`, `createTelemetryGridComponent`, `getDevices('energy', …)`). Classificação de status (RFC-0110), limites de potência e enriquecimento via `energyCacheFromMain` (linha 2242) confirmados. Nenhuma ação necessária. Atenção apenas para não confundir `generateMockOperationalEquipment()` (linha 3243) — pertence ao recurso separado RFC-0152, não ao widget principal.

### Water — 🟡 Atenção
Os dois grids de dispositivos (WATER_COMMON_AREA e WATER_STORES) estão totalmente portados via mapeamento de contexto (`water_common_area → hidrometro_area_comum`, `water_stores → hidrometro`, linhas 2781-2790) e `getDevices('water', …)`. O **painel consolidado WATER está mockado/quebrado**: depende de `getWaterSummary()` que não existe no orchestrator e de campos de evento ausentes — é o ponto mais crítico do domínio.

### Temperature & Telemetry — 🟡 Atenção
TELEMETRY (componente base de grid) está totalmente consolidado. Os três widgets de temperatura estão **parciais**: o painel TEMPERATURE não tem pipeline de dados (sem `fetchTemperatureData`), e os dois grids de sensores dependem de confirmação de filter chips/header de stats e, criticamente, da distinção de contexto `termostato` vs `termostato_external` que hoje não é feita na classificação (linha 5100).

### Chrome & Orchestration — 🟢 Saudável com ressalvas
WELCOME, FOOTER e MAIN totalmente portados; orquestração de classificação, eventos e ciclo de vida sólida. HEADER e MENU estão parciais por um único problema transversal: o **timing de inicialização dos botões do filter modal** (plan.md Issue #3). MAIN tem pendências não-bloqueantes (operacional mockado RFC-0152 e panels modais ainda TODO).

## Lacunas Detalhadas

### WATER (mocked)
**O que o legado faz:** Renderiza dashboard consolidado de água com 3 cards (lojas / área comum / total), gráfico de consumo de 7 dias com seleção de período, e gráfico de distribuição com 3 modos de visualização (grupos / lojas / comum). Dados reais via `fetchWaterPeriodConsumptionByDay` (legacy linhas 418-514).

**Onde está no UNIQUE:** RFC-0133, `createWaterPanelComponent` nas linhas 2912-2980; `WaterPanelView.ts` linhas 63-102 renderiza os 3 cards esperando `summary.storesTotal` e `summary.commonAreaTotal`.

**O que falta / está mockado:**
- `getWaterSummary()` **não existe** em `window.MyIOOrchestrator` — os cards recebem `initialSummary` null e exibem zero/vazio.
- O evento `myio:water-summary-ready` (linhas 1566-1580) inclui `totalConsumption` mas **não** `storesTotal` nem `commonAreaTotal`, que o widget legado espera (legacy linhas 1047-1057).
- O modo `groups` do gráfico de distribuição espera split lojas × área comum, mas nenhum cálculo é passado a `createDistributionChartWidget` — callback `fetchDistributionData` não está conectado.
- Sem distinção lojas/área-comum no nível do painel — usuário não consegue alternar visões como no legado (tabs).

**Recomendação:** Implementar `getWaterSummary()` no orchestrator retornando `{ storesTotal, commonAreaTotal, total }`; incluir esses campos no payload de `myio:water-summary-ready` (linhas 1566-1580); conectar o callback `fetchDistributionData` com cálculo lojas × área comum a partir das classificações `hidrometro` e `hidrometro_area_comum`.

### TEMPERATURE (partial)
**O que o legado faz:** Dashboard de agregação de temperatura em nível de shopping com KPI cards (temp média, sensores, shoppings online, alertas), gráfico comparativo bar/line e lista de temperatura por shopping com min/max.

**Onde está no UNIQUE:** RFC-0117, `createTemperaturePanel()` nas linhas 3957-3964 — porém só recebe `{ container, ctx, themeMode, configTemplate: { targetTemp: 23, targetTolerance: 2, defaultPeriod: 7 }, onError }`.

**O que falta / está mockado:**
- Sem callback `fetchConsumptionData`/`fetchTemperatureData` — painel não tem como buscar dados reais (energy/water têm isso nas linhas 3940-3942 e 3952-3953).
- KPIs ausentes (temp média, contagem de sensores, shoppings online, alertas).
- Gráfico comparativo (toggle bar/line) ausente.
- Lista de temperatura por shopping com agregação min/max ausente.
- Histórico de 7 dias (`fetch7DaysTemperature`, RFC-0098) não portado.
- Sem pipeline de `orchestrator.getTemperatureCache()` para o painel.
- Sem fallback de dados demo.

**Recomendação:** Adicionar callback `fetchTemperatureData` à chamada de `createTemperaturePanel` (espelhando energy/water), implementar agregação por shopping, conectar API de histórico se disponível, e garantir que o painel receba estrutura com agregados por shopping e detalhe por sensor.

### TEMPERATURE_SENSORS (partial)
**O que o legado faz:** Grid de cards de sensores individuais com chips de filtro por shopping, header de estatísticas (total, média, online, alertas), toolbar de busca/filtro e render via `renderCardComponentHeadOffice`.

**Onde está no UNIQUE:** RFC-0121, `createTelemetryGridComponent` linhas 1743-1841 com `domain=temperature`, `context=termostato`; devices via `getDevices()` linha 1749.

**O que falta / está mockado:**
- Sincronização dos chips de filtro por shopping (legacy `tempShoppingFilterChips`) não evidenciada.
- Header de estatísticas (Total Sensores, Temp Média, Online, Alertas) não confirmado no grid.
- Integração da busca não evidenciada.
- Filter modal não mencionado explicitamente no setup do grid.
- Opções de render (`useNewComponents`, `enableSelection`, `ENABLE_DRAG_DROP`, `HIDE_INFO_MENU_ITEM`) hardcoded — pode divergir do legado.
- Cálculo de status pode diferir do RFC-0110 MASTER RULES.

**Recomendação:** Verificar se `createTelemetryGridComponent` suporta filter chips, agregação de stats e busca quando `domain=temperature`; adicionar render explícito do header de stats se não incluído; testar sincronização de filtro por shopping e cálculo de status online contra o legado.

### TEMPERATURE_WITHOUT_CLIMATE_CONTROL (partial)
**O que o legado faz:** Idêntico ao TEMPERATURE_SENSORS, mas filtrado para mostrar apenas sensores não-climatizados (contexto `termostato_external`).

**Onde está no UNIQUE:** RFC-0121, `createTelemetryGridComponent` linhas 1743-1841 com `context=termostato_external` (parâmetro de contexto na linha 1802).

**O que falta / está mockado:**
- Mesmas lacunas do TEMPERATURE_SENSORS (filter chips, header de stats, busca).
- **Crítico:** Indefinido se a filtragem de contexto (`termostato` vs `termostato_external`) está implementada — a classificação na linha 5100 só checa `deviceType.includes('TERMOSTATO')`, sem distinção entre os dois tipos (linhas 5100-5101 tratam todos os TERMOSTATO igualmente).

**Recomendação:** Garantir que a classificação distinga sensores climatizados (`termostato`) de não-climatizados (`termostato_external`) via `deviceProfile` ou `customAttributes`; assegurar que o grid filtre por contexto; testar isolamento correto dos sensores não-climatizados.

### HEADER (partial)
**O que o legado faz:** KPI cards de resumo (equipamento, energia, temperatura, água) com tooltips byStatus/byCategory e filter modal.

**Onde está no UNIQUE:** RFC-0113, linhas 1443-1649. `createHeaderComponent()` com `cardColors` (linhas 1456-1472); tooltips via `buildTooltipStatusData()` (linhas 4246-4345, implementação completa); eventos de resumo energy/water/temperature/equipment com payloads byStatus/byCategory (linhas 1548-1643); callback de filtro (linha 1475).

**O que falta / está mockado:**
- Render do tooltip delegado ao componente da MyIOLibrary — funções legadas `showTemperatureTooltip`/`showEnergyTooltip`/`showWaterTooltip`/`showEquipmentTooltip` ausentes (não necessárias, a lib lida com display).
- Handlers dos botões do filter modal (fechar, maximizar, toggle de tema) com problemas de timing (plan.md Issue #3): guard clause impede re-init e queries de DOM falham antes do modal renderizar.

**Recomendação:** Corrigir o timing de inicialização do header do filter modal (ver Issue #3 abaixo) — remover/ajustar a guard clause de `ensureFilterModalHeaderController()` e atrasar as queries de DOM até o modal renderizar.

### MENU (partial)
**O que o legado faz:** Navegação por abas (Energia/Água/Temperatura), date range picker, filter modal de shopping com save/load de presets.

**Onde está no UNIQUE:** RFC-0114, linhas 1652-1741. `createMenuComponent()` com `configTemplate` (linhas 1671-1678), callbacks de tab/context change (linhas 1684-1691), date range picker (linhas 1680-1683), estrutura do filter modal com árvore de shoppings; dados de shopping em cache e atualizados (linhas 1734-1740).

**O que falta / está mockado:**
- Botões do filter modal (fechar, maximizar, toggle de tema) não funcionais (plan.md Issue #3) — guard clause de `ensureFilterModalHeaderController()` na linha 2527 impede re-inicialização; queries ocorrem antes do DOM renderizar.
- Menu não carrega shoppings diretamente do datasource `aliasName='customers'` — depende de cache (linha 1734); interface Shopping sem campos `minTemperature`/`maxTemperature` (plan.md Issue #2).

**Recomendação:** Resolver Issue #3 (compartilhado com HEADER); adicionar carga direta de shoppings do datasource `customers` como fallback ao cache; estender a interface Shopping com `minTemperature`/`maxTemperature` (Issue #2).

### MAIN (fully-ported, com pendências não-bloqueantes)
Embora classificado como fully-ported (orquestração, classificação, eventos e ciclo de vida completos), restam 3 pendências que **não bloqueam o core**:
- Gerador mock `generateMockOperationalEquipment` (linha 3243) usado no RFC-0152 Fase 3 — dado real deveria vir de `AlarmService.getAvailability()`.
- Gate de API de temperatura (RFC-0189) requer flag `enableTemperatureApiDataFetch`; fallback para popup legado quando flag off ou API falha (linhas 2343-2349).
- Componentes de panel modal (RFC-0117/0118/0119: painéis Energy/Water/Temperature) ainda TODO conforme README.md linha 257.

## Plano de Ação Priorizado

Ordem por impacto (mock/quebrado primeiro, depois partial, depois polish):

1. **[WATER — desbloquear painel consolidado]** Implementar `getWaterSummary()` no `window.MyIOOrchestrator` retornando `{ storesTotal, commonAreaTotal, total }` e incluir esses campos no payload de `myio:water-summary-ready` (linhas 1566-1580). Sem isso os 3 cards de água exibem zero.
2. **[WATER — gráfico de distribuição]** Conectar o callback `fetchDistributionData` em `createWaterPanelComponent` (linhas 2912-2980) com cálculo lojas × área comum a partir de `hidrometro` e `hidrometro_area_comum`.
3. **[TEMPERATURE — pipeline de dados]** Adicionar callback `fetchTemperatureData` à chamada `createTemperaturePanel` (linhas 3957-3964), espelhando energy/water (linhas 3940-3942, 3952-3953); ligar `orchestrator.getTemperatureCache()`, KPIs, gráfico comparativo e lista por shopping; portar `fetch7DaysTemperature` (RFC-0098).
4. **[TEMPERATURE_WITHOUT_CLIMATE_CONTROL — classificação de contexto]** Corrigir a classificação na linha 5100 para distinguir `termostato` vs `termostato_external` via `deviceProfile`/`customAttributes`, garantindo isolamento correto no grid.
5. **[HEADER + MENU — Issue #3 filter modal]** Corrigir o timing de inicialização dos botões do filter modal: ajustar a guard clause de `ensureFilterModalHeaderController()` (linha 2527) e atrasar as queries de DOM até o modal renderizar. Resolve simultaneamente HEADER e MENU.
6. **[TEMPERATURE_SENSORS / TELEMETRY temperatura — paridade de grid]** Verificar e habilitar filter chips por shopping, header de estatísticas (total/média/online/alertas) e busca para `domain=temperature`; validar status RFC-0110 contra o legado.
7. **[MENU — Issue #2]** Carregar shoppings diretamente do datasource `aliasName='customers'` (fallback ao cache) e estender a interface Shopping com `minTemperature`/`maxTemperature`.
8. **[MAIN — desmockar operacional]** Substituir `generateMockOperationalEquipment` (linha 3243) por `AlarmService.getAvailability()` (RFC-0152 Fase 3).
9. **[MAIN — panels modais]** Concluir os panels modais RFC-0117/0118/0119 ainda TODO (README.md linha 257).

## Itens Já Completos

Widgets totalmente portados com dados reais — **não retocar**:

- **ENERGY** (RFC-0132, linhas 2980-3013) — 2 cards de resumo + 2 charts, classificação por tipo de equipamento.
- **STORES** (linha 1799, `getDevices('energy','stores')`) — grid de cards de loja com filtro de shopping e stats centralizadas (RFC-0093).
- **EQUIPMENTS** (linha 1799, `getDevices('energy','equipments')`) — grid de equipamentos com status (RFC-0110) e limites de potência.
- **WATER_COMMON_AREA** (linhas 2781-2790 + 5294-5305) — grid de hidrômetros de área comum.
- **WATER_STORES** (linhas 2781-2790 + 5294-5305) — grid de hidrômetros de lojas.
- **TELEMETRY** (RFC-0121, linhas 1743-1841) — componente base de grid multi-domínio consolidado.
- **WELCOME** (RFC-0112, linhas 1302-1441) — modal de entrada com shopping cards do datasource.
- **FOOTER** (RFC-0115, linhas 2091-2135) — dock de seleção (máx 6), granularidade RFC-0097 e modal de comparação.
- **MAIN** (RFC-0111 + RFC-0127, linhas ~800-3400) — orquestrador: classificação, eventos, ciclo de vida e roteamento (pendências não-bloqueantes listadas acima).
