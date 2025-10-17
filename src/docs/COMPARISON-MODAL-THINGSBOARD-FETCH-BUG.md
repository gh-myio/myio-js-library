# Bug: Comparison Modal Trying to Fetch ThingsBoard Data

## 🐛 Problema Identificado

**Data**: 2025-10-17
**Severity**: 🔴 **CRÍTICO** - Bloqueia funcionalidade de comparação

### Descrição

Quando o usuário seleciona 2+ dispositivos no FOOTER e clica em "Comparar", o modal **falha com erro 400** porque tenta fazer fetch de `deviceId: undefined` no ThingsBoard.

### Log de Erro

```javascript
[openDashboardPopupEnergy] Opening energy modal with options: {deviceId: undefined, ...}
[EnergyModal] Fetching device context for: undefined
GET https://dashboard.myio-bas.com/api/device/undefined 400 (Bad Request)
Error: Failed to fetch device information: Failed to fetch device entity: Invalid request parameters
```

---

## 🔍 Análise Técnica

### Fluxo Atual (QUEBRADO ❌)

```
User clicks "Comparar" (2 devices selected)
         ↓
FOOTER calls openDashboardPopupEnergy({
  mode: 'comparison',
  dataSources: [...],
  deviceId: undefined,    ← ⚠️ NOT PROVIDED (correct)
  ...
})
         ↓
EnergyModal.show() ← ⚠️ ALWAYS calls fetchDeviceContext()
         ↓
fetchDeviceContext() tries to fetch:
  - /api/device/undefined         ← 💥 400 ERROR
  - /api/plugins/telemetry/DEVICE/undefined/...  ← 💥 400 ERROR
         ↓
Modal crashes with error ❌
```

### Código Problemático

#### 1. `EnergyModal.ts` - linha 63-64

```typescript
async show(): Promise<{ close: () => void }> {
  try {
    console.log('[EnergyModal] Starting modal show process');

    // ⚠️ PROBLEM: ALWAYS fetches device context, even in comparison mode
    this.context = await this.fetchDeviceContext();

    // ... rest of code
```

**Problema**: `fetchDeviceContext()` é **SEMPRE** chamado, independente do modo.

---

#### 2. `fetchDeviceContext()` - linhas 143-151

```typescript
private async fetchDeviceContext(): Promise<EnergyModalContext> {
  console.log('[EnergyModal] Fetching device context for:', this.params.deviceId);

  try {
    // ⚠️ PROBLEM: Tries to fetch with undefined deviceId in comparison mode
    const [entityInfo, attributes] = await Promise.all([
      this.fetchEntityInfo(),      // ← Calls /api/device/undefined
      this.fetchEntityAttributes()  // ← Calls /api/plugins/telemetry/DEVICE/undefined/...
    ]);

    // ...
```

**Problema**: Tenta fazer fetch no ThingsBoard usando `this.params.deviceId` que é `undefined` no modo comparison.

---

#### 3. `fetchEntityInfo()` - linha 128

```typescript
private async fetchEntityInfo(): Promise<any> {
  const url = `/api/device/${this.params.deviceId}`;  // ← undefined!

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Authorization': `Bearer ${this.params.tbJwtToken}`,
      'Content-Type': 'application/json'
    }
  });
  // ...
```

**Problema**: URL fica `/api/device/undefined` → 400 Bad Request

---

## ✅ Solução

### Approach: **Skip ThingsBoard Fetch in Comparison Mode**

No modo `comparison`:
- **NÃO** precisamos buscar informações do ThingsBoard
- **NÃO** precisamos `deviceId`, `label`, `attributes`
- O SDK (`renderTelemetryStackedChart`) recebe `dataSources` diretamente
- Todas as informações necessárias já estão em `params.dataSources`

### Mudanças Necessárias

#### 1. `EnergyModal.ts` - Método `show()`

```typescript
async show(): Promise<{ close: () => void }> {
  try {
    console.log('[EnergyModal] Starting modal show process');

    const mode = this.params.mode || 'single';

    // ⭐ NEW: Only fetch device context in SINGLE mode
    if (mode === 'single') {
      // 1. Fetch device context from ThingsBoard
      this.context = await this.fetchDeviceContext();

      // 2. Create and configure modal with device info
      const identifier = this.context.device.attributes.identifier || 'SEM IDENTIFICADOR';
      const label = this.context.device.label || 'SEM ETIQUETA';

      this.modal = createModal({
        title: `Energy Report - ${identifier} - ${label}`,
        width: '80vw',
        height: '90vh',
        theme: (this.params.theme === 'dark' ? 'dark' : 'light') as 'light' | 'dark'
      });
    }
    // ⭐ NEW: Comparison mode - skip ThingsBoard fetch
    else if (mode === 'comparison') {
      // Create minimal context (no device info needed)
      this.context = this.createComparisonContext();

      // Create modal with comparison title
      const deviceCount = this.params.dataSources?.length || 0;
      this.modal = createModal({
        title: `Comparação de ${deviceCount} Dispositivos`,
        width: '80vw',
        height: '90vh',
        theme: (this.params.theme === 'dark' ? 'dark' : 'light') as 'light' | 'dark'
      });
    }

    // 3. Create and render view
    this.view = new EnergyModalView(this.modal, {
      context: this.context!,
      params: this.params,
      onExport: () => this.handleExport(),
      onError: (error) => this.handleEnergyModalError(error),
      onDateRangeChange: (startISO, endISO) => this.handleDateRangeChange(startISO, endISO)
    });

    // 4. Setup modal event handlers
    this.setupModalEventHandlers();

    // ⭐ NEW: Only load energy data in SINGLE mode
    // In comparison mode, the SDK handles data fetching
    if (mode === 'single') {
      await this.loadEnergyData();
    }

    // 5. Trigger onOpen callback
    if (this.params.onOpen) {
      try {
        this.params.onOpen(this.context!);
      } catch (error) {
        console.warn('[EnergyModal] onOpen callback error:', error);
      }
    }

    console.log('[EnergyModal] Modal successfully opened');

    return {
      close: () => this.close()
    };

  } catch (error) {
    console.error('[EnergyModal] Error showing modal:', error);
    this.handleError(error as Error);
    throw error;
  }
}
```

---

#### 2. `EnergyModal.ts` - Novo Método `createComparisonContext()`

```typescript
/**
 * Creates a minimal context for comparison mode
 * No ThingsBoard data fetching required
 */
private createComparisonContext(): EnergyModalContext {
  const deviceCount = this.params.dataSources?.length || 0;

  return {
    device: {
      id: 'comparison',  // Dummy ID
      label: `Comparação (${deviceCount} dispositivos)`,
      attributes: {}  // Empty - not used in comparison mode
    },
    resolved: {
      ingestionId: null,  // Not used in comparison mode
      centralId: null,
      slaveId: null,
      customerId: null
    }
  };
}
```

---

#### 3. `EnergyModal.ts` - Atualizar `loadEnergyData()`

```typescript
private async loadEnergyData(): Promise<void> {
  const mode = this.params.mode || 'single';

  // ⭐ SAFETY: Only load data in single mode
  if (mode !== 'single') {
    console.log('[EnergyModal] Skipping loadEnergyData in comparison mode');
    return;
  }

  if (!this.context?.resolved.ingestionId) {
    const error = new Error('ingestionId not found in device attributes. Please configure the device properly.');
    this.handleError(error);
    return;
  }

  // ... resto do código original
}
```

---

#### 4. `EnergyModal.ts` - Atualizar `handleDateRangeChange()`

```typescript
private async handleDateRangeChange(startISO: string, endISO: string): Promise<void> {
  const mode = this.params.mode || 'single';

  if (!this.view) {
    return;
  }

  try {
    console.log('[EnergyModal] Date range changed:', { startISO, endISO, mode });

    // ⭐ COMPARISON MODE: Let SDK handle data fetch
    if (mode === 'comparison') {
      console.log('[EnergyModal] Comparison mode: re-rendering chart with new dates');

      // Update params with new dates
      this.params.startDate = startISO;
      this.params.endDate = endISO;

      // Show loading state
      this.view.showLoadingState();

      // Re-render chart (SDK will fetch new data)
      const success = this.view.tryRenderWithSDK(null as any);

      if (success) {
        this.view.hideLoadingState();
        this.view.hideError();
      } else {
        this.view.showError('Erro ao recarregar gráfico de comparação');
      }

      return;
    }

    // ⭐ SINGLE MODE: Original behavior
    if (!this.context?.resolved.ingestionId) {
      return;
    }

    // Show loading state
    this.view.showLoadingState();

    // Fetch energy data with new date range
    const energyData = await this.dataFetcher.fetchEnergyData({
      ingestionId: this.context.resolved.ingestionId,
      startISO,
      endISO,
      granularity: this.params.granularity || '1d'
    });

    console.log('[EnergyModal] Energy data reloaded:', {
      dataPoints: energyData.consumption.length,
      totalConsumption: energyData.consumption.reduce((sum, point) => sum + point.value, 0)
    });

    // Render updated energy data
    this.view.renderEnergyData(energyData);

  } catch (error) {
    console.error('[EnergyModal] Error reloading energy data:', error);
    this.handleError(error as Error);
  }
}
```

---

#### 5. `EnergyModal.ts` - Atualizar `handleExport()`

```typescript
private handleExport(): void {
  const mode = this.params.mode || 'single';

  if (!this.view) {
    console.warn('[EnergyModal] Cannot export: view not initialized');
    return;
  }

  try {
    // ⭐ NEW: Disable export in comparison mode (for now)
    if (mode === 'comparison') {
      alert('Export não disponível no modo de comparação');
      return;
    }

    this.view.exportToCsv();
    console.log('[EnergyModal] CSV export completed');
  } catch (error) {
    console.error('[EnergyModal] Export error:', error);
    this.handleError(new Error('Failed to export data to CSV'));
  }
}
```

---

#### 6. `EnergyModalView.ts` - Expor `tryRenderWithSDK` como `public`

```typescript
// Mudar de private para public para permitir chamada em handleDateRangeChange
public tryRenderWithSDK(energyData: EnergyData): boolean {
  const mode = this.config.params.mode || 'single';

  if (mode === 'single') {
    return this.renderSingleDeviceChart(energyData);
  } else if (mode === 'comparison') {
    return this.renderComparisonChart();
  }

  return false;
}
```

---

## 📊 Fluxo Corrigido (FUNCIONAL ✅)

### Single Mode (Inalterado)

```
User clicks on device dashboard icon
         ↓
openDashboardPopupEnergy({
  mode: 'single',
  deviceId: 'xxx-xxx-xxx',
  ...
})
         ↓
EnergyModal.show()
  → fetchDeviceContext() ✅ Fetch ThingsBoard data
  → loadEnergyData() ✅ Fetch API data
         ↓
Modal opens with device data ✅
```

### Comparison Mode (CORRIGIDO ✅)

```
User selects 2+ devices and clicks "Comparar"
         ↓
FOOTER calls openDashboardPopupEnergy({
  mode: 'comparison',
  dataSources: [
    { type: 'device', id: 'chiller-1', label: 'Chiller1' },
    { type: 'device', id: 'chiller-2', label: 'Chiller 2' }
  ],
  deviceId: undefined,  ← Correct - not needed!
  ...
})
         ↓
EnergyModal.show()
  → ✅ SKIP fetchDeviceContext() (mode === 'comparison')
  → ✅ createComparisonContext() (minimal context)
  → ✅ Create modal with comparison title
  → ✅ SKIP loadEnergyData() (SDK handles it)
         ↓
EnergyModalView.tryRenderWithSDK()
  → ✅ renderComparisonChart()
  → ✅ SDK fetches data for all dataSources
         ↓
Modal opens with comparison chart ✅
```

---

## 🧪 Testing Checklist

Após implementar as mudanças:

### Test Case 1: Single Mode (Regression Test)
- [ ] Abrir modal de um único device via card
- [ ] Verificar que modal abre corretamente
- [ ] Verificar que gráfico renderiza
- [ ] Verificar que export CSV funciona
- [ ] Verificar que date range change funciona

### Test Case 2: Comparison Mode (Bug Fix)
- [ ] Selecionar 2 devices no TELEMETRY widget
- [ ] Clicar em "Comparar" no FOOTER
- [ ] **Verificar que modal abre SEM erro 400**
- [ ] Verificar que título mostra "Comparação de 2 Dispositivos"
- [ ] Verificar que gráfico stacked renderiza
- [ ] Verificar que date range change funciona

### Test Case 3: Comparison Mode (3+ devices)
- [ ] Selecionar 3+ devices
- [ ] Clicar em "Comparar"
- [ ] Verificar modal abre
- [ ] Verificar gráfico mostra todas as séries

---

## 📝 Arquivos a Modificar

```
src/components/premium-modals/energy/
├── EnergyModal.ts ← ⭐ PRINCIPAL (5 métodos modificados + 1 novo)
└── EnergyModalView.ts ← ⭐ MENOR (1 método: private → public)
```

---

## 🚀 Próximos Passos

1. **Implementar mudanças em `EnergyModal.ts`**:
   - [ ] Atualizar método `show()`
   - [ ] Criar método `createComparisonContext()`
   - [ ] Atualizar método `loadEnergyData()`
   - [ ] Atualizar método `handleDateRangeChange()`
   - [ ] Atualizar método `handleExport()`

2. **Implementar mudanças em `EnergyModalView.ts`**:
   - [ ] Tornar `tryRenderWithSDK()` público

3. **Build e Teste**:
   - [ ] `npm run build`
   - [ ] Testar single mode (não quebrar)
   - [ ] Testar comparison mode (funcionar)

4. **Publicar**:
   - [ ] `npm version patch` (0.1.100 → 0.1.101)
   - [ ] `npm publish --access public`
   - [ ] Atualizar ThingsBoard Resource URL

---

## 🎯 Impacto

### Before (Broken ❌)
- ❌ Comparison mode crashes with 400 error
- ❌ User cannot compare devices
- ❌ Footer "Comparar" button useless

### After (Fixed ✅)
- ✅ Comparison mode works correctly
- ✅ User can compare 2+ devices
- ✅ Footer "Comparar" button functional
- ✅ Single mode unchanged (no regression)

---

**Criado por**: Claude Code
**Data**: 2025-10-17
**Status**: 📋 **ANÁLISE COMPLETA - PRONTO PARA IMPLEMENTAÇÃO**
**Priority**: 🔴 **ALTA** - Bloqueia funcionalidade principal
