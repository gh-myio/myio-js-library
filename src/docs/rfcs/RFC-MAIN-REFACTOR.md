# RFC: Refatoração do MAIN/controller.js

## Objetivo
Reduzir o tamanho do arquivo `src/MYIO-SIM/v5.2.0/MAIN/controller.js` (~5400 linhas) movendo funções genéricas e reutilizáveis para a biblioteca `myio-js-library`.

## Análise do Arquivo

### Estatísticas
- **Linhas:** ~5400
- **Tokens:** ~57000
- **Funções identificadas:** 80+

---

## PRIORIDADE 1: Funções Prontas para Migração (Alta Reutilização)

### 1.1 LogHelper (Linhas 11-26)
**Descrição:** Utilitário de logging com controle de debug.
```javascript
const LogHelper = {
  log: function (...args) { if (DEBUG_ACTIVE) console.log(...args); },
  warn: function (...args) { if (DEBUG_ACTIVE) console.warn(...args); },
  error: function (...args) { console.error(...args); },
};
```
**Por que mover:** Genérico, usado em todos os widgets.
**Destino sugerido:** `src/utils/LogHelper.js` ou integrar em `MyIOLibrary`

---

### 1.2 DEFAULT_CONSUMPTION_RANGES (Linhas 453-502)
**Descrição:** Ranges padrão de consumo por tipo de dispositivo (ELEVADOR, ESCADA_ROLANTE, CHILLER, etc.)
```javascript
const DEFAULT_CONSUMPTION_RANGES = {
  ELEVADOR: { standbyRange: {...}, normalRange: {...}, alertRange: {...}, failureRange: {...} },
  // ... outros tipos
};
```
**Por que mover:** Constantes de configuração, reutilizáveis.
**Destino sugerido:** `src/constants/consumptionRanges.js`

---

### 1.3 Funções de Formatação de Datas (Várias ocorrências)
**Descrição:** `formatDateISO(ts)` - Converte timestamp para ISO 8601.
```javascript
const formatDateISO = (ts) => {
  const d = new Date(ts);
  d.setMilliseconds(0);
  return d.toISOString();
};
```
**Por que mover:** Duplicado em múltiplas funções (fetchEnergyDayConsumption, fetchWaterDayConsumption).
**Destino sugerido:** `MyIOLibrary.formatDateISO()`

---

### 1.4 extractLimitsFromJSON (Linhas 583-655)
**Descrição:** Extrai ranges de consumo de estrutura JSON unificada (RFC-0078).
**Por que mover:** Lógica de parsing de configuração, genérica.
**Destino sugerido:** `src/utils/powerLimits.js`

---

### 1.5 getDefaultRanges (Linhas 662-665)
**Descrição:** Obtém ranges padrão para um tipo de dispositivo.
```javascript
function getDefaultRanges(deviceType) {
  const upperDeviceType = deviceType.toUpperCase();
  return DEFAULT_CONSUMPTION_RANGES[upperDeviceType] || DEFAULT_CONSUMPTION_RANGES['DEFAULT'];
}
```
**Por que mover:** Lookup simples, genérico.
**Destino sugerido:** `src/utils/powerLimits.js`

---

### 1.6 HEADER_AND_MODAL_CSS (Linhas 953-1364)
**Descrição:** ~400 linhas de CSS centralizado para headers e modais.
**Por que mover:** CSS pode ser separado em arquivo próprio.
**Destino sugerido:** `src/styles/header-modal.css` ou `MyIOLibrary.injectStyles()`

---

### 1.7 HEADER_DOMAIN_CONFIG (Linhas 1406-1431)
**Descrição:** Configuração de labels por domínio (energy, water, temperature, stores).
```javascript
const HEADER_DOMAIN_CONFIG = {
  energy: { totalLabel: 'Total de Equipamentos', consumptionLabel: 'Consumo Total', ... },
  water: { totalLabel: 'Total de Hidrômetros', ... },
  // ...
};
```
**Por que mover:** Configuração estática, reutilizável.
**Destino sugerido:** `src/constants/headerConfig.js`

---

### 1.8 buildHeaderDevicesGrid (Linhas 1450-1731)
**Descrição:** Factory para criar headers de grids de dispositivos com estatísticas.
**Por que mover:** Componente UI genérico (~280 linhas).
**Destino sugerido:** `src/components/HeaderDevicesGrid.js`

---

### 1.9 createFilterModal (Linhas 1792-2616)
**Descrição:** Factory para criar modais de filtro (~820 linhas, RFC-0090).
**Por que mover:** Componente UI genérico, altamente reutilizável.
**Destino sugerido:** `src/components/FilterModal.js`

---

### 1.10 Funções de Temperature (Linhas 2977-3631)
**Descrição:** Conjunto de funções para gerenciamento de temperatura (~650 linhas).
- `extractTemperatureDevices()`
- `extractTemperatureRanges()`
- `calcularMediaTemperatura()`
- `fetchTemperatureAverages()`
- `fetchTemperatureDayAverages()`
- `fetchTemperatureData()`
- `recalculateTemperatureFiltered()`

**Por que mover:** Domínio específico, pode ser módulo separado.
**Destino sugerido:** `src/services/TemperatureService.js`

---

## PRIORIDADE 2: Funções do Orchestrator (Médio Esforço)

### 2.1 Busy Overlay Management (Linhas 2727-2863)
**Descrição:** Gerenciamento de overlay de loading global.
- `ensureOrchestratorBusyDOM()`
- `showGlobalBusy()`
- `hideGlobalBusy()`

**Por que mover:** Componente UI genérico (~140 linhas).
**Destino sugerido:** `src/components/BusyOverlay.js`

---

### 2.2 Cache Management (Linhas 2866-2976)
**Descrição:** Gerenciamento de cache para water devices.
- `waterValidIds` (Sets para commonArea e stores)
- `waterTotals`
- `registerWaterDeviceIds()`
- `recalculateWaterTotals()`
- `getWaterTotals()`
- `getWaterValidIds()`

**Por que mover:** Lógica de cache reutilizável.
**Destino sugerido:** `src/services/CacheService.js` ou `MyIOOrchestrator` como módulo separado

---

### 2.3 Shopping Filter Logic (Linhas 3693-3733)
**Descrição:** Lógica de filtro por shopping.
- `selectedShoppingIds`
- `totalShoppings`
- `shouldIncludeDevice()`
- `isFilterActive()`

**Por que mover:** Lógica de filtro genérica.
**Destino sugerido:** `src/utils/filterUtils.js`

---

### 2.4 Energy/Water Aggregation (Linhas 4094-4479)
**Descrição:** Funções de agregação de dados.
- `getTotalEquipmentsConsumption()`
- `getTotalLojasConsumption()`
- `getEnergyByShoppings()`
- `getTotalConsumption()`
- `getUnfilteredTotalConsumption()`
- `getTotalWaterConsumption()`
- `getUnfilteredTotalWaterConsumption()`
- `getFilteredTotalWaterConsumption()`
- `getWaterByShoppings()`
- `getWaterWidgetData()`
- `getEnergyWidgetData()`

**Por que mover:** Lógica de negócio pura, testável.
**Destino sugerido:** `src/services/AggregationService.js`

---

## PRIORIDADE 3: Funções de API (Baixo Esforço)

### 3.1 fetchEnergyDayConsumption (Linhas 47-109)
**Descrição:** Busca consumo de energia por período.
**Por que mover:** Chamada de API genérica.
**Destino sugerido:** `src/api/energyApi.js`

---

### 3.2 fetchWaterDayConsumption (Linhas 125-208)
**Descrição:** Busca consumo de água por período.
**Por que mover:** Chamada de API genérica.
**Destino sugerido:** `src/api/waterApi.js`

---

### 3.3 fetchDeviceProfiles (Linhas 229-265)
**Descrição:** Busca perfis de dispositivos do ThingsBoard.
**Por que mover:** Chamada de API genérica.
**Destino sugerido:** `src/api/thingsboardApi.js`

---

### 3.4 fetchDeviceDetails (Linhas 272-290)
**Descrição:** Busca detalhes de um dispositivo.
**Por que mover:** Chamada de API genérica.
**Destino sugerido:** `src/api/thingsboardApi.js`

---

### 3.5 addDeviceProfileAttribute (Linhas 298-350)
**Descrição:** Salva atributo deviceProfile no ThingsBoard.
**Por que mover:** Chamada de API genérica.
**Destino sugerido:** `src/api/thingsboardApi.js`

---

### 3.6 syncDeviceProfileAttributes (Linhas 358-444)
**Descrição:** Sincronização em lote de perfis de dispositivos.
**Por que mover:** Lógica de negócio + API.
**Destino sugerido:** `src/services/DeviceProfileSync.js`

---

### 3.7 fetchInstantaneousPowerLimits (Linhas 514-574)
**Descrição:** Busca limites de potência de entidade.
**Por que mover:** Chamada de API genérica.
**Destino sugerido:** `src/api/thingsboardApi.js`

---

### 3.8 getCachedPowerLimitsJSON (Linhas 674-730)
**Descrição:** Obtém limites de potência com cache.
**Por que mover:** Lógica de cache + API.
**Destino sugerido:** `src/services/PowerLimitsService.js`

---

### 3.9 getConsumptionRangesHierarchical (Linhas 745-787)
**Descrição:** Resolução hierárquica de ranges (Device > Customer > Default).
**Por que mover:** Lógica de negócio pura.
**Destino sugerido:** `src/services/PowerLimitsService.js`

---

### 3.10 fetchCustomerServerScopeAttrs (Linhas 1738-1766)
**Descrição:** Busca atributos SERVER_SCOPE de customer.
**Por que mover:** Chamada de API genérica.
**Destino sugerido:** `src/api/thingsboardApi.js`

---

## PRIORIDADE 4: Manter no MAIN (Específico do Widget)

Estas funções devem **permanecer** no MAIN/controller.js por serem específicas do contexto do widget:

1. **onInit** - Inicialização do widget ThingsBoard
2. **onDataUpdated** - Handler de dados do ThingsBoard
3. **onDestroy** - Cleanup do widget
4. **Event listeners específicos** (myio:filter-applied, myio:update-date, etc.)
5. **Funções que dependem de `self.ctx`**
6. **processWaterDatasourcesFromTB** - Específico de datasources TB
7. **waitForDateParams** - Sincronização com outros widgets

---

## Resumo de Impacto

| Categoria | Linhas Estimadas | % do Total |
|-----------|------------------|------------|
| Prioridade 1 (Alta) | ~2500 | 46% |
| Prioridade 2 (Média) | ~800 | 15% |
| Prioridade 3 (Baixa) | ~500 | 9% |
| Manter no MAIN | ~1600 | 30% |

**Redução potencial: ~70% (~3800 linhas)**

---

## Plano de Migração Sugerido

### Fase 1: Quick Wins (1-2 dias)
1. Criar `src/constants/consumptionRanges.js` com DEFAULT_CONSUMPTION_RANGES
2. Criar `src/constants/headerConfig.js` com HEADER_DOMAIN_CONFIG
3. Mover LogHelper para MyIOLibrary ou arquivo separado
4. Extrair CSS para arquivo separado

### Fase 2: Componentes UI (3-5 dias)
1. Criar `src/components/HeaderDevicesGrid.js`
2. Criar `src/components/FilterModal.js`
3. Criar `src/components/BusyOverlay.js`

### Fase 3: Services (5-7 dias)
1. Criar `src/services/TemperatureService.js`
2. Criar `src/services/PowerLimitsService.js`
3. Criar `src/services/AggregationService.js`
4. Criar `src/api/thingsboardApi.js`
5. Criar `src/api/energyApi.js`
6. Criar `src/api/waterApi.js`

### Fase 4: Refatoração do Orchestrator (3-5 dias)
1. Extrair MyIOOrchestrator para módulo separado
2. Manter apenas inicialização e event listeners no MAIN

---

## Estrutura de Diretórios Proposta

```
src/
├── api/
│   ├── thingsboardApi.js      # Chamadas TB (device, profile, attributes)
│   ├── energyApi.js           # Chamadas API energia
│   └── waterApi.js            # Chamadas API água
├── components/
│   ├── HeaderDevicesGrid.js   # Header com estatísticas
│   ├── FilterModal.js         # Modal de filtros
│   └── BusyOverlay.js         # Overlay de loading
├── constants/
│   ├── consumptionRanges.js   # Ranges padrão por device type
│   └── headerConfig.js        # Config labels por domínio
├── services/
│   ├── TemperatureService.js  # Lógica de temperatura
│   ├── PowerLimitsService.js  # Limites de potência
│   ├── AggregationService.js  # Agregação energy/water
│   └── CacheService.js        # Gerenciamento de cache
├── utils/
│   ├── LogHelper.js           # Utilitário de logging
│   ├── filterUtils.js         # Lógica de filtros
│   └── dateUtils.js           # Formatação de datas
└── styles/
    └── header-modal.css       # CSS centralizado
```

---

## Notas de Implementação

1. **Exports:** Usar ES modules (`export { ... }`) e agregar em `src/index.ts`
2. **Backward Compatibility:** Manter `window.MyIOUtils` e `window.MyIOOrchestrator` funcionando
3. **Testes:** Criar testes unitários para cada módulo migrado
4. **Documentação:** Atualizar JSDoc em cada função migrada

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Quebra de compatibilidade | Manter aliases em window.MyIOUtils |
| Dependências circulares | Usar injeção de dependência |
| Performance (bundle size) | Tree-shaking com ES modules |
| Contexto ThingsBoard (self.ctx) | Passar ctx como parâmetro |

---

*Documento criado em: 2025-12-10*
*Versão: 1.0*
