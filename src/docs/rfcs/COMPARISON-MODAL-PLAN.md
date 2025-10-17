# 🎯 Plano de Implementação - Modal de Comparação para Energy

## 📋 Resumo Executivo

**Objetivo**: Adaptar `EnergyModalView` para suportar modo de comparação usando `renderTelemetryStackedChart`

**Requisito Crítico**: ⚠️ **A lógica atual para gráfico de um device DEVE ser mantida como está em pleno funcionamento**

**Data**: 2025-10-16

---

## 🔍 Análise: Single vs Comparison Charts

### SDK Atual (Single Device)
```typescript
import { renderTelemetryChart } from '@myio/energy-chart-sdk';

renderTelemetryChart(container, {
  version: 'v2',
  clientId: string,
  clientSecret: string,
  deviceId: string,              // ← SINGLE DEVICE ID
  readingType: 'energy' | 'water' | 'gas',
  startDate: string,             // ISO format
  endDate: string,               // ISO format
  granularity?: string,          // ← OPCIONAL
  theme: 'light' | 'dark',
  timezone: string,
  iframeBaseUrl: string,
  apiBaseUrl: string
});
```

### SDK Necessário (Comparison)
```typescript
import { renderTelemetryStackedChart } from '@myio/energy-chart-sdk';

renderTelemetryStackedChart(container, {
  version: 'v2',
  clientId: string,
  clientSecret: string,
  dataSources: Array<{           // ← MÚLTIPLOS DEVICES
    type: 'device',
    id: string,
    label: string
  }>,
  readingType: 'energy' | 'water' | 'gas',
  startDate: string,             // Formato YYYY-MM-DD (sem hora)
  endDate: string,               // Formato YYYY-MM-DD (sem hora)
  granularity: string,           // ← OBRIGATÓRIO
  theme: 'light' | 'dark',
  timezone: string,
  iframeBaseUrl?: string,
  apiBaseUrl: string,
  deep: boolean                  // ← NOVO PARÂMETRO
});
```

### 🔑 Diferenças Críticas

| Aspecto | Single Device | Comparison |
|---------|--------------|------------|
| **Parâmetro de device(s)** | `deviceId: string` | `dataSources: Array<{...}>` |
| **Granularity** | Opcional | **OBRIGATÓRIO** |
| **Date Format** | ISO completo (com hora) | YYYY-MM-DD (sem hora) |
| **Deep parameter** | Não existe | `deep: boolean` |
| **SDK Function** | `renderTelemetryChart` | `renderTelemetryStackedChart` |

---

## 🏗️ Opções de Arquitetura

### Opção A: Estender EnergyModalView (RECOMENDADO ✅)

**Descrição**: Adicionar modo "comparison" ao EnergyModalView existente

**Estrutura**:
```typescript
interface EnergyModalConfig {
  mode?: 'single' | 'comparison';  // Default: 'single'

  // Single mode
  deviceId?: string;
  deviceName?: string;

  // Comparison mode
  dataSources?: Array<{
    type: 'device',
    id: string,
    label: string
  }>;

  // Shared
  readingType: string;
  startDate: Date;
  endDate: Date;
  granularity?: string;  // Obrigatório se mode=comparison
  // ...
}
```

**Pros**:
- ✅ Mantém código single-device intacto (não modifica lógica existente)
- ✅ Reutiliza toda infraestrutura (loading, error, date picker, etc)
- ✅ Modal única com comportamento adaptável
- ✅ Fácil manutenção (apenas um componente)
- ✅ Menos duplicação de código

**Cons**:
- ⚠️ Aumenta complexidade da classe (mais condicionais)
- ⚠️ Precisa validar configuração para cada modo

**Estimativa**: 3-4 horas

---

### Opção B: Criar ComparisonModalView Separado

**Descrição**: Nova classe `ComparisonModalView` copiando estrutura de `EnergyModalView`

**Estrutura**:
```
src/components/premium-modals/
  energy/
    EnergyModalView.ts          ← Mantém como está
    ComparisonModalView.ts      ← NOVO
    BaseModalView.ts            ← Base compartilhada (opcional)
```

**Pros**:
- ✅ Zero risco de quebrar funcionalidade single-device
- ✅ Código mais simples em cada modal (sem condicionais de modo)
- ✅ Pode evoluir independentemente

**Cons**:
- ❌ Duplicação massiva de código (loading, error, date picker, etc)
- ❌ Manutenção duplicada (bug fix precisa ser feito 2x)
- ❌ Mais arquivos para gerenciar
- ❌ Inconsistência potencial entre modais

**Estimativa**: 5-6 horas

---

### Opção C: Herança com BaseModalView

**Descrição**: Criar `BaseModalView` com lógica comum, `EnergyModalView` e `ComparisonModalView` herdam

**Estrutura**:
```typescript
abstract class BaseModalView {
  // Loading, error, date picker, modal structure
  protected abstract renderChart(): void;
}

class EnergyModalView extends BaseModalView {
  protected renderChart() {
    // renderTelemetryChart
  }
}

class ComparisonModalView extends BaseModalView {
  protected renderChart() {
    // renderTelemetryStackedChart
  }
}
```

**Pros**:
- ✅ Elimina duplicação de código comum
- ✅ Separação clara de responsabilidades
- ✅ Fácil adicionar novos tipos de modal no futuro

**Cons**:
- ⚠️ Refatoração de código existente (risco)
- ⚠️ Complexidade de herança
- ⚠️ Mais arquivos

**Estimativa**: 6-8 horas

---

## 🎯 Recomendação: OPÇÃO A

**Escolha**: Estender `EnergyModalView` com suporte a modo "comparison"

**Motivos**:
1. ✅ **Menor risco**: Código single-device fica intacto
2. ✅ **Menor tempo**: 3-4 horas vs 5-8 horas
3. ✅ **Reutilização máxima**: Loading, error handling, date picker, etc
4. ✅ **Manutenção simples**: Um único arquivo para gerenciar
5. ✅ **Backward compatible**: Chamadas existentes continuam funcionando

---

## 📝 Implementação Detalhada - OPÇÃO A

### 1. Atualizar Interface de Configuração

**Arquivo**: `EnergyModalView.ts`
**Linha**: ~30-50 (interface EnergyModalConfig)

```typescript
export interface EnergyModalConfig {
  // ⭐ NOVO: Modo de operação
  mode?: 'single' | 'comparison';  // Default: 'single'

  // ========================================
  // SINGLE MODE PARAMETERS (modo atual)
  // ========================================
  deviceId?: string;
  deviceName?: string;

  // ========================================
  // COMPARISON MODE PARAMETERS (novo)
  // ========================================
  dataSources?: Array<{
    type: 'device';
    id: string;
    label: string;
  }>;

  // ========================================
  // SHARED PARAMETERS
  // ========================================
  readingType: string;
  startDate: Date;
  endDate: Date;
  granularity?: string;  // OBRIGATÓRIO para comparison

  params: {
    clientId?: string;
    clientSecret?: string;
    chartsBaseUrl?: string;
    dataApiHost?: string;
    // ... outros params existentes
  };
}
```

---

### 2. Validar Configuração no Construtor

**Arquivo**: `EnergyModalView.ts`
**Linha**: ~90-120 (constructor)

```typescript
constructor(config: EnergyModalConfig) {
  super();
  this.config = config;

  // ⭐ VALIDAÇÃO DO MODO
  const mode = this.config.mode || 'single';

  if (mode === 'single') {
    // Validar parâmetros de single device
    if (!this.config.deviceId) {
      console.error('[EnergyModalView] deviceId é obrigatório para modo single');
      throw new Error('deviceId é obrigatório para modo single');
    }
  } else if (mode === 'comparison') {
    // Validar parâmetros de comparison
    if (!this.config.dataSources || this.config.dataSources.length === 0) {
      console.error('[EnergyModalView] dataSources é obrigatório para modo comparison');
      throw new Error('dataSources é obrigatório para modo comparison');
    }

    if (this.config.dataSources.length < 2) {
      console.warn('[EnergyModalView] Comparação com menos de 2 devices');
    }

    // ⚠️ CRÍTICO: granularity é OBRIGATÓRIO para stacked chart
    if (!this.config.granularity) {
      console.error('[EnergyModalView] granularity é obrigatório para modo comparison');
      throw new Error('granularity é obrigatório para modo comparison');
    }
  }

  this.initializeModal();
}
```

---

### 3. Atualizar Título da Modal

**Arquivo**: `EnergyModalView.ts`
**Linha**: ~150-180 (initializeModal ou similar)

```typescript
private getModalTitle(): string {
  const mode = this.config.mode || 'single';

  if (mode === 'comparison') {
    const count = this.config.dataSources?.length || 0;
    return `Comparação de ${count} Dispositivos`;
  } else {
    const deviceName = this.config.deviceName || this.config.deviceId || 'Dispositivo';
    return `Consumo - ${deviceName}`;
  }
}
```

---

### 4. Adaptar tryRenderWithSDK (CRÍTICO)

**Arquivo**: `EnergyModalView.ts`
**Linha**: ~185-267 (método tryRenderWithSDK)

**ANTES**:
```typescript
private tryRenderWithSDK(energyData: EnergyData): boolean {
  // ... código atual ...

  const chartConfig = {
    version: 'v2',
    deviceId: ingestionId,
    // ...
  };

  (this as any).chartInstance = renderTelemetryChart(this.chartContainer, chartConfig);
  return true;
}
```

**DEPOIS**:
```typescript
private tryRenderWithSDK(energyData: EnergyData): boolean {
  const mode = this.config.mode || 'single';

  // ========================================
  // MODO SINGLE (código existente mantido)
  // ========================================
  if (mode === 'single') {
    return this.renderSingleDeviceChart(energyData);
  }

  // ========================================
  // MODO COMPARISON (novo)
  // ========================================
  else if (mode === 'comparison') {
    return this.renderComparisonChart();
  }

  return false;
}

// ⭐ NOVO MÉTODO: Extrai lógica atual para método separado
private renderSingleDeviceChart(energyData: EnergyData): boolean {
  // Todo o código atual de tryRenderWithSDK move para cá
  // NÃO MODIFICAR - mantém exatamente como está

  if (!(window as any).MyIOEnergyChartSDK?.renderTelemetryChart) {
    console.error('[EnergyModalView] SDK não carregado');
    return false;
  }

  const { renderTelemetryChart } = (window as any).MyIOEnergyChartSDK;

  const ingestionId = energyData.device?.ingestionId || this.config.deviceId;

  const startDate = new Date(this.config.startDate);
  const endDate = new Date(this.config.endDate);
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  let granularity = this.config.granularity;

  if (!granularity) {
    if (diffDays <= 2) granularity = '15m';
    else if (diffDays <= 7) granularity = '1h';
    else if (diffDays <= 31) granularity = '1d';
    else granularity = '1mo';
  }

  const theme = this.detectTheme();
  const tzIdentifier = this.getTimezoneIdentifier();

  const chartConfig = {
    version: 'v2',
    clientId: this.config.params.clientId || 'ADMIN_DASHBOARD_CLIENT',
    clientSecret: this.config.params.clientSecret || 'admin_dashboard_secret_2025',
    deviceId: ingestionId,
    readingType: this.config.params.readingType || 'energy',
    startDate: startISO,
    endDate: endISO,
    granularity: granularity,
    theme: theme,
    timezone: tzIdentifier,
    iframeBaseUrl: this.config.params.chartsBaseUrl || 'https://graphs.apps.myio-bas.com',
    apiBaseUrl: this.config.params.dataApiHost || 'https://api.data.apps.myio-bas.com'
  };

  console.log('[EnergyModalView] Renderizando chart com SDK:', chartConfig);

  try {
    (this as any).chartInstance = renderTelemetryChart(this.chartContainer, chartConfig);
    return true;
  } catch (error) {
    console.error('[EnergyModalView] Erro ao renderizar chart:', error);
    return false;
  }
}

// ⭐ NOVO MÉTODO: Renderiza comparison chart
private renderComparisonChart(): boolean {
  if (!(window as any).MyIOEnergyChartSDK?.renderTelemetryStackedChart) {
    console.error('[EnergyModalView] renderTelemetryStackedChart não disponível no SDK');
    return false;
  }

  const { renderTelemetryStackedChart } = (window as any).MyIOEnergyChartSDK;

  // ⚠️ IMPORTANTE: Datas devem ser YYYY-MM-DD (sem hora)
  const startDate = new Date(this.config.startDate);
  const endDate = new Date(this.config.endDate);
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const theme = this.detectTheme();
  const tzIdentifier = this.getTimezoneIdentifier();

  const chartConfig = {
    version: 'v2',
    clientId: this.config.params.clientId || 'ADMIN_DASHBOARD_CLIENT',
    clientSecret: this.config.params.clientSecret || 'admin_dashboard_secret_2025',
    dataSources: this.config.dataSources!,  // Já validado no constructor
    readingType: this.config.params.readingType || 'energy',
    startDate: startDateStr,  // ← SEM HORA
    endDate: endDateStr,      // ← SEM HORA
    granularity: this.config.granularity!,  // ← OBRIGATÓRIO
    theme: theme,
    timezone: tzIdentifier,
    apiBaseUrl: this.config.params.dataApiHost || 'https://api.data.apps.myio-bas.com',
    deep: false
  };

  console.log('[EnergyModalView] Renderizando comparison chart com SDK:', chartConfig);

  try {
    (this as any).chartInstance = renderTelemetryStackedChart(this.chartContainer, chartConfig);
    return true;
  } catch (error) {
    console.error('[EnergyModalView] Erro ao renderizar comparison chart:', error);
    return false;
  }
}
```

---

### 5. Adaptar Loading de Dados (Comparison Pula Fetch)

**Arquivo**: `EnergyModalView.ts`
**Linha**: ~300-400 (loadData ou similar)

```typescript
private async loadData(): Promise<void> {
  const mode = this.config.mode || 'single';

  // ⭐ COMPARISON NÃO PRECISA FAZER FETCH
  // SDK faz fetch interno dos múltiplos devices
  if (mode === 'comparison') {
    this.showLoadingState();
    const success = this.tryRenderWithSDK(null as any);  // energyData não é usado

    if (success) {
      this.hideLoadingState();
    } else {
      this.showError('Erro ao carregar gráfico de comparação');
    }
    return;
  }

  // ⭐ SINGLE DEVICE: Lógica atual (mantém como está)
  this.showLoadingState();

  try {
    const energyData = await this.fetchEnergyData();
    const success = this.tryRenderWithSDK(energyData);

    if (!success) {
      this.renderFallbackChart(energyData);
    }

    this.hideLoadingState();
  } catch (error) {
    console.error('[EnergyModalView] Erro ao carregar dados:', error);
    this.showError('Erro ao carregar dados de energia');
  }
}
```

---

### 6. Adaptar Date Picker (Comparison Pode Ter Restrições)

**Arquivo**: `EnergyModalView.ts`
**Linha**: ~450-500 (date picker handlers)

```typescript
private onDateRangeChanged(startDate: Date, endDate: Date): void {
  const mode = this.config.mode || 'single';

  // ⚠️ COMPARISON: Granularity deve ser recalculada se não foi especificada
  if (mode === 'comparison' && !this.config.granularity) {
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) {
      this.config.granularity = '1h';
    } else if (diffDays <= 31) {
      this.config.granularity = '1d';
    } else {
      this.config.granularity = '1mo';
    }

    console.log('[EnergyModalView] Granularity recalculada:', this.config.granularity);
  }

  // Atualizar config
  this.config.startDate = startDate;
  this.config.endDate = endDate;

  // Recarregar dados
  this.loadData();
}
```

---

## 📊 Resumo de Mudanças por Arquivo

### EnergyModalView.ts

| Linha Aprox. | Tipo | Mudança |
|-------------|------|---------|
| 30-50 | MODIFY | Adicionar `mode`, `dataSources` ao `EnergyModalConfig` |
| 90-120 | ADD | Validação de modo no constructor |
| 150-180 | MODIFY | `getModalTitle()` adaptar para comparison |
| 185-267 | REFACTOR | Extrair `renderSingleDeviceChart()` + adicionar `renderComparisonChart()` |
| 300-400 | MODIFY | `loadData()` pular fetch para comparison |
| 450-500 | MODIFY | `onDateRangeChanged()` recalcular granularity |

**Total**: ~150 linhas adicionadas/modificadas

---

## ✅ Checklist de Implementação

### Fase 1: Preparação (30 min)
- [ ] Criar branch `feature/energy-comparison-modal`
- [ ] Fazer backup do `EnergyModalView.ts` atual
- [ ] Ler código do FOOTER comparison modal para referência

### Fase 2: Modificar Interface (1 hora)
- [ ] Adicionar `mode`, `dataSources` ao `EnergyModalConfig`
- [ ] Adicionar validação no constructor
- [ ] Adicionar método `getModalTitle()`
- [ ] Testar que single mode ainda funciona

### Fase 3: Refatorar Rendering (1.5 horas)
- [ ] Extrair código atual para `renderSingleDeviceChart()`
- [ ] Criar método `renderComparisonChart()`
- [ ] Modificar `tryRenderWithSDK()` para branch por modo
- [ ] Testar single mode não quebrou
- [ ] Testar comparison mode com dataSources mockados

### Fase 4: Adaptar Loading (30 min)
- [ ] Modificar `loadData()` para pular fetch em comparison
- [ ] Testar que loading state aparece corretamente

### Fase 5: Adaptar Date Picker (30 min)
- [ ] Modificar `onDateRangeChanged()` para recalcular granularity
- [ ] Testar mudança de datas em ambos os modos

### Fase 6: Testes (1 hora)
- [ ] Testar single mode com 5 dispositivos diferentes
- [ ] Testar comparison mode com 2 dispositivos
- [ ] Testar comparison mode com 5 dispositivos
- [ ] Testar mudança de período em ambos os modos
- [ ] Testar erro handling (SDK não carregado, etc)

### Fase 7: Documentação (30 min)
- [ ] Atualizar comentários no código
- [ ] Criar exemplo de uso para comparison
- [ ] Documentar diferenças entre modos

---

## 🧪 Exemplos de Uso

### Uso Atual (Single Device) - DEVE CONTINUAR FUNCIONANDO

```typescript
const modal = new EnergyModalView({
  deviceId: 'device-123',
  deviceName: 'Sensor A',
  readingType: 'energy',
  startDate: new Date('2025-08-01'),
  endDate: new Date('2025-08-31'),
  params: {
    clientId: 'test_client',
    clientSecret: 'test_secret'
  }
});

modal.show();
```

### Novo Uso (Comparison)

```typescript
const modal = new EnergyModalView({
  mode: 'comparison',  // ← ESPECIFICAR MODO
  dataSources: [
    { type: 'device', id: 'device-1', label: 'Sensor A' },
    { type: 'device', id: 'device-2', label: 'Sensor B' },
    { type: 'device', id: 'device-3', label: 'Sensor C' }
  ],
  readingType: 'water',
  startDate: new Date('2025-08-01'),
  endDate: new Date('2025-09-30'),
  granularity: '1d',  // ← OBRIGATÓRIO
  params: {
    clientId: 'test_client',
    clientSecret: 'test_secret'
  }
});

modal.show();
```

---

## 🔍 Integração com FOOTER Widget

### Como FOOTER Vai Chamar a Modal

**Arquivo**: `FOOTER/controller.js`
**Método**: `openComparisonModal()`

**ANTES** (código atual do FOOTER):
```javascript
// FOOTER cria modal customizada inline
this._createComparisonModalOverlay({
  dataSources,
  readingType,
  startDate,
  endDate,
  // ...
});
```

**DEPOIS** (usando EnergyModalView):
```javascript
async openComparisonModal() {
  const selected = MyIOSelectionStore.getSelectedEntities();

  if (selected.length < 2) {
    alert("Selecione pelo menos 2 dispositivos para comparar.");
    return;
  }

  const unitType = this.currentUnitType || this._detectUnitType(selected);
  const readingType = this._mapUnitTypeToReadingType(unitType);

  // Converter entidades selecionadas para dataSources
  const dataSources = selected.map(entity => ({
    type: 'device',
    id: entity.id,
    label: entity.name || entity.id
  }));

  // Calcular granularity baseado no período
  const granularity = this._calculateGranularity(
    this._getStartDate(),
    this._getEndDate()
  );

  // ⭐ USAR EnergyModalView em modo comparison
  const modal = new EnergyModalView({
    mode: 'comparison',
    dataSources: dataSources,
    readingType: readingType,
    startDate: this._getStartDate(),
    endDate: this._getEndDate(),
    granularity: granularity,
    params: {
      clientId: window.__MYIO_CLIENT_ID__ || '',
      clientSecret: window.__MYIO_CLIENT_SECRET__ || '',
      chartsBaseUrl: 'https://graphs.apps.myio-bas.com',
      dataApiHost: 'https://api.data.apps.myio-bas.com'
    }
  });

  modal.show();
}
```

---

## ⚠️ Riscos e Mitigações

### Risco 1: Quebrar Single Mode
**Probabilidade**: Média
**Impacto**: CRÍTICO
**Mitigação**:
- Testar single mode em CADA commit
- Extrair código para método separado (não modificar inline)
- Validação de modo no constructor

### Risco 2: Granularity Não Configurado
**Probabilidade**: Alta
**Impacto**: Alto (chart não renderiza)
**Mitigação**:
- Validação obrigatória no constructor para comparison
- Auto-cálculo se não fornecido
- Error message claro

### Risco 3: Formato de Data Incorreto
**Probabilidade**: Média
**Impacto**: Médio (chart vazio)
**Mitigação**:
- Converter sempre para YYYY-MM-DD em comparison
- Comentários claros no código
- Testes com datas diferentes

### Risco 4: SDK Não Carregado
**Probabilidade**: Baixa
**Impacto**: Alto
**Mitigação**:
- Verificar `window.MyIOEnergyChartSDK.renderTelemetryStackedChart` antes de usar
- Fallback error message
- Loading indicator enquanto SDK carrega

---

## 📈 Métricas de Sucesso

### Funcionalidade
- [ ] Single mode funciona 100% como antes
- [ ] Comparison mode renderiza chart com 2+ devices
- [ ] Date picker funciona em ambos os modos
- [ ] Loading states aparecem corretamente
- [ ] Error handling funciona

### Qualidade de Código
- [ ] Zero duplicação de código
- [ ] Comentários explicando diferenças de modo
- [ ] Validação de parâmetros no constructor
- [ ] Testes passando para ambos os modos

### Performance
- [ ] Comparison mode carrega em < 3 segundos
- [ ] Single mode não ficou mais lento
- [ ] Sem memory leaks ao trocar de modo

---

## 🚀 Próximos Passos (Após Implementação)

### Curto Prazo
1. Integrar com FOOTER widget
2. Testar com usuários beta
3. Adicionar testes unitários

### Médio Prazo
1. Adicionar export CSV para comparison
2. Adicionar toggle para mostrar/esconder devices
3. Adicionar cores customizáveis

### Longo Prazo
1. Suportar comparison de diferentes readingTypes
2. Suportar comparison cross-site
3. Adicionar machine learning para anomaly detection

---

## 📝 Estimativa Final

| Fase | Tempo Estimado |
|------|----------------|
| Preparação | 30 min |
| Interface | 1h |
| Rendering | 1.5h |
| Loading | 30 min |
| Date Picker | 30 min |
| Testes | 1h |
| Documentação | 30 min |
| **TOTAL** | **~5 horas** |

**Buffer**: +1 hora para imprevistos

**Total Realista**: **6 horas**

---

## ✅ Conclusão

### Recomendação Final

**Implementar OPÇÃO A**: Estender `EnergyModalView` com modo "comparison"

### Benefícios
1. ✅ Mantém single mode 100% intacto
2. ✅ Reutiliza toda infraestrutura existente
3. ✅ Tempo de implementação otimizado (6h)
4. ✅ Fácil manutenção futura
5. ✅ Backward compatible

### Garantias
- ⚠️ **Lógica atual para gráfico de um device será mantida EXATAMENTE como está**
- ⚠️ **Código será extraído para método separado antes de adicionar novo modo**
- ⚠️ **Testes de regressão em CADA etapa**

---

**Pronto para implementação**: ✅
**Aprovação necessária**: ⏳ (aguardando feedback do usuário)

---

**Gerado por**: Claude Code
**Data**: 2025-10-16
**Versão**: 1.0.0
