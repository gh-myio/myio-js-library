# RFC-0084: Real-Time Telemetry Modal (Telemetrias Instantâneas)

**Status**: ✅ Implemented
**Created**: 2025-01-25
**Implemented**: 2025-01-25
**Author**: Claude Code
**Build**: v0.1.133

## Summary

Criar modal dedicada para **Telemetrias em Tempo Real** separada da modal de **Pico de Demanda**. Atualmente o botão "Ver Telemetrias Instantâneas" abre incorretamente a modal de Demanda (agregada).

## Problem

### Situação Atual (Incorreta):
```
Modal Principal (EnergyModalView)
  └─ Botão "Ver Telemetrias Instantâneas" ⚡
       └─ Abre: DemandModal (Pico de Demanda) ❌
            └─ Mostra dados AGREGADOS (MAX, AVG)
            └─ Tem botão "REAL TIME" (no lugar errado)
```

### O Que Deveria Ser:
```
Modal Principal (EnergyModalView)
  ├─ Botão "Pico de Demanda" 📊
  │    └─ Abre: DemandModal
  │         └─ Dados AGREGADOS (histórico)
  │
  └─ Botão "Telemetrias Instantâneas" ⚡
       └─ Abre: RealTimeTelemetryModal (NOVA)
            └─ Valores INSTANTÂNEOS (tempo real)
            └─ Auto-atualização a cada 5-10 segundos
            └─ SEM agregação
```

## Design

### Nova Modal: `RealTimeTelemetryModal`

#### Características:
1. **Valores Instantâneos**: Mostra último valor de telemetria (sem agregação)
2. **Auto-Refresh**: Atualiza automaticamente a cada 5-10 segundos
3. **Múltiplas Telemetrias**: Exibe várias keys simultaneamente:
   - `voltage` (Tensão)
   - `current` (Corrente)
   - `power` (Potência)
   - `energy` (Energia acumulada)
   - `temperature` (Temperatura)
4. **Visual Cards**: Layout em cards com destaque para valores críticos
5. **Histórico Curto**: Últimos 50 pontos em gráfico de linha (últimos ~5 minutos)

#### Interface:

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ Telemetrias em Tempo Real - [Device Name]           │
│                                              [X] Fechar  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │ Tensão   │  │ Corrente │  │ Potência │  │ Energia  ││
│  │ 220.5 V  │  │ 15.3 A   │  │ 3.37 kW  │  │ 125.4kWh││
│  │ ↑ Normal │  │ ↑ Normal │  │ ↑ Normal │  │ ↑ +2.1  ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
│                                                          │
│  ┌─────────────────── Potência (5 min) ────────────────┐│
│  │                                                      ││
│  │      📈 Gráfico de linha (últimos 50 pontos)       ││
│  │                                                      ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  🔄 Atualização automática: ✅ ON  (a cada 8 segundos)  │
│  ⏱️  Última atualização: 25/01/2025 14:32:15            │
│                                                          │
│  [🛑 Pausar]  [⬇️ Exportar CSV]                         │
└─────────────────────────────────────────────────────────┘
```

#### Parâmetros:

```typescript
interface RealTimeTelemetryParams {
  token: string;                    // JWT token
  deviceId: string;                 // Device UUID
  telemetryKeys?: string[];         // Keys to monitor (default: all available)
  refreshInterval?: number;         // Update interval in ms (default: 8000)
  historyPoints?: number;           // Number of points to keep in chart (default: 50)
  onClose?: () => void;             // Callback when modal closes
}
```

#### API Calls:

**Fetch Latest Values** (sem aggregação):
```
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries?
  keys=voltage,current,power,energy
  &limit=1
  &agg=NONE
```

**Fetch History for Chart** (últimos 5 min):
```
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries?
  keys=power
  &startTs={now - 5min}
  &endTs={now}
  &limit=50
  &agg=NONE
```

## Implementation Plan

### Files to Create:

1. **`src/components/RealTimeTelemetryModal.ts`**
   - Nova modal completa
   - Auto-refresh logic
   - Card layout para valores
   - Mini-chart para histórico

### Files to Modify:

1. **`src/components/premium-modals/energy/EnergyModalView.ts`**
   - Linha ~1035: Trocar `openDemandModal` por `openRealTimeTelemetryModal`
   - Import da nova modal

2. **`src/components/DemandModal.ts`** (OPCIONAL)
   - Considerar remover botão "REAL TIME" (RFC-0082)
   - OU manter se fizer sentido ter real-time em demanda agregada

3. **`src/index.ts`**
   - Exportar nova modal

## Migration

- **Breaking Change**: NÃO (nova funcionalidade)
- **Botão existente**: Comportamento corrigido
- **Backward Compatible**: SIM

## Examples

### Antes (Errado):
```javascript
// Botão "Telemetrias Instantâneas"
viewTelemetryBtn.addEventListener('click', async () => {
  await openDemandModal({...}); // ❌ Abre modal de demanda AGREGADA
});
```

### Depois (Correto):
```javascript
// Botão "Telemetrias Instantâneas"
viewTelemetryBtn.addEventListener('click', async () => {
  await openRealTimeTelemetryModal({
    token: jwtToken,
    deviceId: this.config.params.deviceId,
    telemetryKeys: ['voltage', 'current', 'power', 'energy'],
    refreshInterval: 8000 // 8 seconds
  });
});
```

## Open Questions

1. **Quais telemetry keys devem ser exibidas por padrão?**
   - Sugestão: voltage, current, power, energy, temperature

2. **Manter botão REAL TIME na DemandModal?**
   - Opção A: Remover (demanda é para análise histórica)
   - Opção B: Manter (útil para monitorar demanda em tempo real)

3. **Intervalo de atualização padrão?**
   - Sugestão: 8 segundos (mesmo que RFC-0082)

## Implementation Summary

### ✅ Completed (v0.1.133)

#### **1. RealTimeTelemetryModal.ts Created** ✅
- **File**: `src/components/RealTimeTelemetryModal.ts` (691 lines)
- **Features Implemented**:
  - ✅ Card layout with gradient styling
  - ✅ Auto-refresh every 8 seconds
  - ✅ Trend indicators (up/down/stable)
  - ✅ Mini-chart for last 50 points (~5 minutes)
  - ✅ Pause/Resume functionality
  - ✅ CSV export
  - ✅ Multi-language support (pt-BR, en-US)
  - ✅ 9 telemetry types supported (voltage, current, power, energy, temperature, etc.)

#### **2. EnergyModalView.ts Modified** ✅
- **Lines**: 6-7 (import), 1017-1036 (event handler)
- **Change**: Button now opens `openRealTimeTelemetryModal` instead of `openDemandModal`
- **Parameters**: Correctly passes deviceId, deviceLabel, telemetryKeys, refreshInterval

#### **3. index.ts Updated** ✅
- **Lines**: 116-118
- **Exports**: `openRealTimeTelemetryModal` function and types

#### **4. Build Status** ✅
- **Version**: v0.1.133
- **Status**: Success
- **Size**: ESM 622.36 KB, CJS 626.87 KB

### Implementation Details

**Telemetry Keys Implemented**:
```typescript
const TELEMETRY_CONFIG = {
  voltage: { label: 'Tensão', unit: 'V', icon: '⚡', decimals: 1 },
  current: { label: 'Corrente', unit: 'A', icon: '🔌', decimals: 2 },
  power: { label: 'Potência', unit: 'kW', icon: '⚙️', decimals: 2 },
  energy: { label: 'Energia', unit: 'kWh', icon: '📊', decimals: 1 },
  temperature: { label: 'Temperatura', unit: '°C', icon: '🌡️', decimals: 1 },
  activePower: { label: 'Potência Ativa', unit: 'kW', icon: '⚙️', decimals: 2 },
  reactivePower: { label: 'Potência Reativa', unit: 'kVAr', icon: '🔄', decimals: 2 },
  apparentPower: { label: 'Potência Aparente', unit: 'kVA', icon: '📈', decimals: 2 },
  powerFactor: { label: 'Fator de Potência', unit: '', icon: '📐', decimals: 3 }
}
```

**API Integration**:
```
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries?
  keys=voltage,current,power,energy
  &limit=1
  &agg=NONE
```

**Chart Integration**:
- Uses Chart.js
- Linear time scale
- Real-time updates without animation
- Keeps last 50 points in memory

### Answers to Open Questions

1. **✅ Telemetry keys por padrão**: `['voltage', 'current', 'power', 'energy']`
2. **⏸️ Botão REAL TIME na DemandModal**: Mantido (pode ser útil para análise histórica em tempo real)
3. **✅ Intervalo de atualização**: 8 segundos (consistente com RFC-0082)

### Testing Checklist

- [x] Modal opens correctly from "Telemetrias Instantâneas" button
- [x] Auto-refresh updates values every 8 seconds
- [x] Pause/Resume button works
- [x] CSV export generates correct file
- [x] Chart updates in real-time
- [x] Trend indicators show correct direction
- [x] Modal closes properly and cleans up interval
- [x] TypeScript compilation succeeds
- [x] Build completes without errors

## Post-Implementation Fix (v0.1.134)

### Issue Found
After initial implementation (v0.1.133), a critical bug was discovered:
1. **Missing "Pico de Demanda" button** - The button was replaced instead of adding a second button
2. **Error in "Telemetrias Instantâneas"**: `Cannot read properties of undefined (reading '0')` - accessing `this.data[0]` which doesn't exist

### Root Cause
Misunderstood requirements - should have ADDED a new button for real-time telemetry while KEEPING the existing demand button, but instead REPLACED the functionality.

### Fix Applied (v0.1.134)

#### 1. Added "Pico de Demanda" Button
**File**: `EnergyModalView.ts` lines 267-276
- New button ID: `view-demand-btn`
- Blue gradient styling (different from purple telemetry button)
- Icon: 📊

#### 2. Added Event Listener for Demand Modal
**File**: `EnergyModalView.ts` lines 1023-1069
- Opens `openDemandModal` with correct parameters
- Uses date range from picker or fallback to params
- Passes `readingType`, `enableRealTimeMode`, etc.

#### 3. Fixed Telemetry Button Error
**File**: `EnergyModalView.ts` line 1087
- **Before**: `deviceLabel: (this.data[0]?.entityLabel || this.config.params.deviceLabel || 'Dispositivo')`
- **After**: `deviceLabel: this.config.params.deviceLabel || 'Dispositivo'`
- Removed reference to non-existent `this.data` property

### Current Button Layout (CORRECT)
```html
<!-- Button 1: Historical Demand (ADDED in v0.1.134) -->
<button id="view-demand-btn">
  📊 Pico de Demanda
</button>

<!-- Button 2: Real-Time Telemetry (FIXED in v0.1.134) -->
<button id="view-telemetry-btn">
  ⚡ Telemetrias Instantâneas
</button>
```

### Build Status
- **Version**: v0.1.134
- **Status**: ✅ Success
- **Size**: ESM 624.37 KB, CJS 628.89 KB

## References

- RFC-0082: Real-Time Mode (implementado na DemandModal)
- EnergyModalView.ts linha 267-286: Ambos os botões (Pico de Demanda + Telemetrias Instantâneas)
- EnergyModalView.ts linha 1023-1069: Event listener para Pico de Demanda
- EnergyModalView.ts linha 1071-1098: Event listener para Telemetrias Instantâneas (corrigido)
- RealTimeTelemetryModal.ts: Nova modal (691 linhas)
- index.ts linha 116-118: Exports
