Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
Plano: Corrigir Issues do task.md - Header Tooltips, Menu Filter, Buttons

Data: 2026-01-04
Status: Pronto para Implementar

---

Resumo dos Problemas

Baseado no arquivo src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/task.md:

| #   | Problema                                                       | Status                   |
| --- | -------------------------------------------------------------- | ------------------------ |
| 1   | Tooltips no Header (Equipamentos, Energia, Temperatura, Agua)  | Nao funcionam ou zerados |
| 2   | Menu nao carrega shoppings do datasource aliasName='customers' | Nao carrega              |
| 3   | Botoes do filter modal do menu (fechar, maximizar, theme)      | Nao funcionam            |

---

Issue 1: Header Tooltips Nao Funcionam

Causa Raiz

- Legacy: Envia dados simples (consumo agregado)
- Novo: Tooltips esperam estrutura complexa com byStatus e byCategory
- Normalizacao: Preenche com zeros quando dados reais nao sao fornecidos
- Equipamentos: Tooltip nao implementado

Estrutura Esperada pelos Tooltips

// EnergySummaryTooltip espera:
{
totalDevices: number,
totalConsumption: number,
byCategory: CategorySummary[], // Hierarquia de categorias
byStatus: {
waiting: number, waitingDevices: Device[],
weakConnection: number, weakConnectionDevices: Device[],
offline: number, offlineDevices: Device[],
normal: number, normalDevices: Device[],
alert: number, alertDevices: Device[],
failure: number, failureDevices: Device[],
standby: number, standbyDevices: Device[],
noConsumption: number, noConsumptionDevices: Device[],
},
lastUpdated: string
}

Solucao

Arquivo: src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js

1.  Agregar status dos dispositivos ANTES de disparar eventos:

- Iterar sobre classified[domain] (energy, water, temperature)
- Contar dispositivos por status (online, offline, alert, etc.)
- Coletar lista de devices para cada status
- Construir objeto byStatus completo

2.  Criar funcao buildTooltipData(domain, devices):
    function buildTooltipData(domain, devices) {
    const byStatus = {
    waiting: 0, waitingDevices: [],
    weakConnection: 0, weakConnectionDevices: [],
    offline: 0, offlineDevices: [],
    normal: 0, normalDevices: [],
    alert: 0, alertDevices: [],
    failure: 0, failureDevices: [],
    standby: 0, standbyDevices: [],
    noConsumption: 0, noConsumptionDevices: [],
    };

devices.forEach(d => {
const status = mapDeviceStatus(d.deviceStatus || d.status);
byStatus[status]++;
byStatus[`${status}Devices`].push({
id: d.id, name: d.labelOrName, value: d.val
});
});

return { byStatus, totalDevices: devices.length };
} 3. Atualizar dispatch de eventos:
// myio:energy-summary-ready
window.dispatchEvent(new CustomEvent('myio:energy-summary-ready', {
detail: {
...existingData,
byStatus: buildTooltipData('energy', energyDevices).byStatus,
byCategory: buildCategoryData(energyDevices),
lastUpdated: new Date().toISOString()
}
}));

Arquivos a Modificar:

- src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js - Agregar dados de status

---

Issue 2: Menu Nao Carrega Shoppings

Causa Raiz

- Funcao buildShoppingsListFromAlias() existe e funciona
- Tipo Shopping em types.ts NAO inclui minTemperature e maxTemperature
- Dados vem do datasource com aliasName='customers'

Estrutura do Datasource 'customers'

// Row do ThingsBoard:
{
datasource: {
aliasName: 'customers', // ou 'Shopping'
entityId: 'uuid-123',
entityLabel: 'Shopping Center Alpha'
},
dataKey: { name: 'ingestionId' | 'minTemperature' | 'maxTemperature' },
data: [['timestamp', value]]
}

Solucao

Arquivo: src/components/menu/types.ts

export interface Shopping {
name: string;
value: string;
customerId: string;
ingestionId?: string;
minTemperature?: number | null; // ADICIONAR
maxTemperature?: number | null; // ADICIONAR
}

Arquivo: src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js

Verificar que buildShoppingsListFromAlias() esta sendo chamada corretamente e que os dados estao chegando no myio:data-ready:

// Em dispatchDataReady():
window.dispatchEvent(new CustomEvent('myio:data-ready', {
detail: {
classified,
shoppingCards,
deviceCounts,
shoppings: buildShoppingsList(data), // Deve retornar lista com minTemp/maxTemp
timestamp: Date.now()
}
}));

Arquivos a Modificar:

- src/components/menu/types.ts - Adicionar minTemperature/maxTemperature ao Shopping interface

---

Issue 3: Botoes do Filter Modal Nao Funcionam

Causa Raiz

1.  Timing: ensureFilterModalHeaderController() chamado em bindEvents() antes do modal existir no DOM
2.  Guard Clause: Impede re-inicializacao apos primeira chamada
3.  DOM Query Falha: Botoes nao encontrados se modal ainda nao renderizado

Codigo Problematico

// MenuView.ts line 2527
private ensureFilterModalHeaderController(): void {
if (this.filterModalHeaderController) return; // << Guard impede re-init

// ... queries DOM por botoes que podem nao existir ainda
}

Solucao

Arquivo: src/components/menu/MenuView.ts

1.  Remover guard ou permitir re-inicializacao:

private ensureFilterModalHeaderController(): void {
// Remover: if (this.filterModalHeaderController) return;

const modalCard = this.root.querySelector('#menuFilterModal .myio-menu-filter-modal-card');
if (!modalCard) return;

// Destruir controller anterior se existir
if (this.filterModalHeaderController) {
this.filterModalHeaderController.destroy?.();
}

// Criar novo controller
this.filterModalHeaderController = ModalHeader.createController({
modalId: 'menuFilter',
modalCard: modalCard as HTMLElement,
themeTarget: this.root.querySelector('#menuFilter-header') as HTMLElement,
onClose: () => this.closeFilterModal(),
onThemeChange: (theme) => { /_ update theme _/ },
onMaximize: (isMax) => { /_ update maximize _/ }
});
}

2.  Chamar APOS modal ser aberto:

public openFilterModal(): void {
const modal = this.root.querySelector('#menuFilterModal');
if (!modal) return;

modal.classList.remove('hidden');
document.body.classList.add('filter-modal-open');

// Inicializar controller DEPOIS do modal estar visivel
requestAnimationFrame(() => {
this.ensureFilterModalHeaderController();
});
}

3.  Bind direto dos botoes como fallback:

private bindFilterModalButtons(): void {
const closeBtn = this.root.querySelector('#menuFilter-close');
const maxBtn = this.root.querySelector('#menuFilter-maximize');
const themeBtn = this.root.querySelector('#menuFilter-theme-toggle');

closeBtn?.addEventListener('click', () => this.closeFilterModal());
maxBtn?.addEventListener('click', () => this.toggleFilterModalMaximize());
themeBtn?.addEventListener('click', () => this.toggleFilterModalTheme());
}

Arquivos a Modificar:

- src/components/menu/MenuView.ts - Corrigir timing de inicializacao do controller

---

Ordem de Implementacao

Step 1: Corrigir tipos do Shopping (5 min)

- Editar src/components/menu/types.ts
- Adicionar minTemperature?: number | null
- Adicionar maxTemperature?: number | null

Step 2: Corrigir botoes do filter modal (15 min)

- Editar src/components/menu/MenuView.ts
- Remover guard clause em ensureFilterModalHeaderController()
- Mover inicializacao para depois do modal abrir
- Adicionar fallback de bind direto

Step 3: Agregar dados de status para tooltips (30 min)

- Editar src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js
- Criar funcao buildTooltipStatusData(devices)
- Atualizar myio:energy-summary-ready com byStatus
- Atualizar myio:water-summary-ready com byStatus
- Atualizar myio:temperature-summary-ready com dados corretos

Step 4: Build e Teste (5 min)

- Rodar npm run build
- Verificar tooltips funcionando
- Verificar shoppings carregando
- Verificar botoes do modal funcionando

---

Arquivos a Modificar

| Arquivo                                                  | Mudancas                                   |
| -------------------------------------------------------- | ------------------------------------------ |
| src/components/menu/types.ts                             | Adicionar minTemperature/maxTemperature    |
| src/components/menu/MenuView.ts                          | Corrigir timing do controller, bind botoes |
| src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js | Agregar byStatus nos eventos               |

---

Criterios de Sucesso

- Tooltip de Equipamentos abre e mostra dados
- Tooltip de Energia abre com status breakdown (nao zerado)
- Tooltip de Agua abre com status breakdown (nao zerado)
- Tooltip de Temperatura abre com dados
- Menu carrega lista de shoppings do datasource
- Botao Fechar do filter modal funciona
- Botao Maximizar do filter modal funciona
- Botao Theme do filter modal funciona
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌

Would you like to proceed?

❯ 1. Yes, and auto-accept edits 2. Yes, and manually approve edits 3. Type here to tell Claude what to change

ctrl-g to edit in Notepad
