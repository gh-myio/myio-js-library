quero criar uma tela de loading do crontato do customer

em attibutes server_scope temos

qtDevices3f (total de devices de energy domain)
e desse temos 3 grupos
qtDevices3f-Entries (devices energy de entrada de energia)
qtDevices3f-CommonArea (devices energy de entrada de energia)
qtDevices3f-Stores (devices energy de entrada de lojas)

analogamenteo para domain water
qtDevicesHidr (total devices water)
qtDevicesHidr-Entries (devices water de entrada de energia)
qtDevicesHidr-CommonArea (devices water de entrada de energia)
qtDevicesHidr-Stores (devices water de entrada de lojas)

para domain temperature temos
qtDevicesTemp (total devices temperature)
qtDevicesTemp-Internal (devices temperature em ambiente climatizável)
qtDevicesHidr-Stores (devices temperature em ambienten não climatizável)

temos que fazer uma modal premium que fique na main
src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MAIN_VIEW\controller.js

cobrendo a tela 70% e com transparência nas outras área bloqueando o acesso
dizendo que estamos carregando o contrato e ir mostrando esse totalizadores

além disso, é importante que a MAIN com esses dados, confirma se os totals de cards está batendo

uma vez que ela expõem

- window.STATE structure:
- {
- energy: {
-     lojas: { items: [], total: 0, count: 0 },
-     entrada: { items: [], total: 0, count: 0 },
-     areacomum: { items: [], total: 0, count: 0 },
-     summary: { total: 0, byGroup: {...}, percentages: {...}, periodKey: '' }
- },
- water: { ... },
- temperature: { ... }
- }

e adicionar um ícone de check do contrato ao terminar de carregar tudo, e deixar esse ícone em
src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\HEADER

e criar uma tooltip premium baseada em

@/src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY_INFO\controller.js

```
function setupSummaryTooltip() {

```

aqui chamada

const SummaryTooltip = isWater
? window.MyIOLibrary?.WaterSummaryTooltip
: window.MyIOLibrary?.EnergySummaryTooltip;

devemos construir um novo ContractSummaryTooltip
