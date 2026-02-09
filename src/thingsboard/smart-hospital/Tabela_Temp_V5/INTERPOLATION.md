# Interpolation Analysis - Tabela_Temp_V5

## Overview

This document describes the data interpolation system used in the `Tabela_Temp_V5` ThingsBoard widget for temperature report generation. The system fills gaps in telemetry data to provide continuous temperature readings.

## Architecture (UPDATED 2026-02-04)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      getData() - Main Pipeline                       │
├─────────────────────────────────────────────────────────────────────┤
│  1. Divide period into 30-day chunks                                │
│  2. For each chunk: RPC call → sendRPCTemp()                        │
│  3. Group readings by device                                         │
│  4. For each device: interpolateSeries() →                          │
│     a) Group data by day (YYYY-MM-DD)                               │
│     b) SKIP days with no real data                                  │
│     c) For each day WITH data: interpolateDay()                     │
│        - Fill gaps ≤ 4h (8 slots) with interpolated values          │
│        - OMIT gaps > 4h (no null values)                            │
│  5. Backfill: DISABLED (no 100% fake data)                          │
│  6. Clamp values to valid temperature range (17-25°C)               │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Functions

### 1. `interpolateSeries(sorted, deviceName, startISO, endISO)`

**Location:** `controller.js:122-181`

Main interpolation function that generates a continuous time series with 30-minute intervals.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sorted` | `Array<{time_interval: string, value: number}>` | Existing readings sorted by time ASC (can be empty) |
| `deviceName` | `string` | Device identifier (kept for signature compatibility) |
| `startISO` | `string` | Period start (normalized to 00:00 local time) |
| `endISO` | `string` | Period end (normalized to 23:30 local time) |

#### Returns

```typescript
Array<{
  time_interval: string;  // ISO 8601 timestamp
  value: number;          // Temperature value
  interpolated?: boolean; // true if value was generated
}>
```

#### Algorithm

```javascript
function interpolateSeries(sorted, deviceName, startISO, endISO) {
  // 1. Normalize period to local timezone (00:00 to 23:30)
  const start = new Date(startISO);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endISO);
  end.setHours(23, 30, 0, 0);

  // 2. "Snap" function - rounds timestamps to nearest 30-min slot
  function canonicalISO30(dt) {
    const ms = dt.getTime();
    const snapped = Math.round(ms / HALF_HOUR_MS) * HALF_HOUR_MS;
    return new Date(snapped).toISOString();
  }

  // 3. Map existing readings by canonical slot
  const existingBySlot = new Map();
  for (const item of sorted || []) {
    const key = canonicalISO30(new Date(item.time_interval));
    existingBySlot.set(key, { ...item, interpolated: false });
  }

  // 4. Generate ALL 30-min slots for the period
  const fullSlots = [];
  for (let t = new Date(start); t <= end; t = new Date(t.getTime() + HALF_HOUR_MS)) {
    fullSlots.push(t.toISOString());
  }

  // 5. Build final series: use real value OR interpolated
  const result = [];
  for (let i = 0; i < fullSlots.length; i++) {
    if (existingBySlot.has(slotISO)) {
      result.push(existingBySlot.get(slotISO));  // Real value
    } else {
      result.push({
        time_interval: slotISO,
        value: generateInterpolatedValue(...),   // Generated value
        interpolated: true,                       // Interpolation flag
      });
    }
  }
  return result;
}
```

---

### 2. `generateInterpolatedValue(timeSlot, existingData, timeSeries, currentIndex)`

**Location:** `controller.js:183-220`

Generates realistic temperature values for missing time slots.

#### Algorithm

```javascript
function generateInterpolatedValue(timeSlot, existingData, timeSeries, currentIndex) {
  const hour = new Date(timeSlot).getHours();

  // 1. Base temperature varies by time of day
  let baseTemp;
  if (hour >= 0 && hour < 9) {
    baseTemp = 17 + Math.random() * 2;      // 17-19°C (early morning)
  } else if (hour >= 9 && hour < 18) {
    baseTemp = 18 + Math.random() * 4;      // 18-22°C (daytime)
  } else {
    baseTemp = 17 + Math.random() * 3;      // 17-20°C (evening/night)
  }

  // 2. Add small random variation (±0.75°C)
  const variation = (Math.random() - 0.5) * 1.5;
  const finalTemp = baseTemp + variation;

  // 3. Look for nearby real values (±4 slots = ±2 hours)
  const nearbyValues = [];
  for (let j = currentIndex - 4; j < currentIndex + 4; j++) {
    if (existingData.has(timeSeries[j])) {
      nearbyValues.push(existingData.get(timeSeries[j]).value);
    }
  }

  // 4. If nearby values exist: blend 70% real + 30% base
  if (nearbyValues.length > 0) {
    const avgNearby = nearbyValues.reduce((sum, val) => sum + val, 0) / nearbyValues.length;
    return (avgNearby * 0.7 + finalTemp * 0.3).toFixed(2);
  }

  return finalTemp.toFixed(2);
}
```

#### Temperature Profiles by Time of Day

| Time Range | Base Temperature | Description |
|------------|------------------|-------------|
| 00:00 - 08:59 | 17-19°C | Early morning / night |
| 09:00 - 17:59 | 18-22°C | Daytime activity |
| 18:00 - 23:59 | 17-20°C | Evening / night |

---

### 3. `clampTemperature(val)`

**Location:** `controller.js:222-235`

Ensures temperature values stay within valid hospital range.

```javascript
function clampTemperature(val) {
  const num = Number(val);
  if (!isFinite(num)) return { value: null, clamped: false };

  let v = num, clamped = false;
  if (num < 17) {
    v = 17.0;
    clamped = true;
  } else if (num > 25) {
    v = 25.0;
    clamped = true;
  }
  return { value: Number(v.toFixed(2)), clamped };
}
```

| Condition | Result |
|-----------|--------|
| `value < 17` | Clamped to 17.0°C |
| `value > 25` | Clamped to 25.0°C |
| `17 <= value <= 25` | No change |

---

## Backfill Logic (DESABILITADO)

**Status:** ❌ **DESABILITADO** (não gera dados 100% fictícios)

~~When expected device labels have NO data in the entire period, the system generates 100% interpolated data.~~

**Comportamento atual:**
- Labels sem dados reais NÃO aparecem no relatório
- Apenas um log de aviso é gerado para labels esperados sem dados
- Isso evita gerar relatórios com dados 100% fictícios

```javascript
// Labels sem dados reais NÃO são incluídos no relatório
if (missingLabels.length > 0) {
  console.warn('[BACKFILL DISABLED] Labels sem dados reais:', missingLabels);
  // NÃO geramos dados fictícios
}
```

---

## Data Flow Diagram

```
User selects date range
         │
         ▼
┌─────────────────────┐
│  createDateChunks() │  Split into 30-day chunks
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│   sendRPCTemp()     │  Fetch data from gateway
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Group by device    │  _.groupBy(readings, 'device_label')
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ interpolateSeries() │  Fill 30-min gaps
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ clampTemperature()  │  Ensure 17-25°C range
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Backfill missing   │  Generate data for absent devices
│      labels         │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│   renderData()      │  Display in UI
└─────────────────────┘
```

---

## Configuration Summary

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Granularity** | 30 minutes | Time slot interval |
| **Snap Tolerance** | ±15 minutes | Rounds to nearest slot |
| **Temperature Range** | 17°C - 25°C | Valid range (clamped) |
| **Day Temp Range** | 18-22°C | 09:00 - 17:59 |
| **Night Temp Range** | 17-19°C | 00:00 - 08:59 |
| **Evening Temp Range** | 17-20°C | 18:00 - 23:59 |
| **Random Variation** | ±0.75°C | Added noise |
| **Neighbor Blend** | 70% real + 30% base | When neighbors exist |
| **Neighbor Window** | ±4 slots (±2 hours) | Search range |
| **Chunk Size** | 30 days | RPC request batching |
| **Cache Duration** | 30 minutes | telemetryCache TTL |
| **Max Gap Slots** | **8 slots (4 hours)** | Maximum gap size for interpolation |
| **Allow Cross Midnight** | **false** | Block interpolation across midnight |
| **Include Missing** | **false** | Omit missing slots from output |
| **Day-by-Day Processing** | **true** | Only process days with real data |

---

## Output Flags

Each processed record includes metadata flags:

| Flag | Type | Description |
|------|------|-------------|
| `interpolated` | `boolean` | `true` if value was generated (not from real reading) |
| `backfilled` | `boolean` | `true` if entire device data was generated (no real readings) |
| `correctedBelowThreshold` | `boolean` | `true` if value was clamped to valid range |

---

## Visual Example

```
Period: 01/01 00:00 → 01/01 23:30 (48 slots of 30 min)

Real data:      [--] [--] [19.5] [--] [--] [20.1] [--] ...
                 ↓    ↓           ↓    ↓           ↓
Interpolated:  [18.2][18.5][19.5][19.8][19.9][20.1][19.7] ...
                 ↑         real   ↑ blend with neighbors
              base + variation
```

---

## Usage in ThingsBoard

### Datasource Configuration

The widget expects datasources with:
- `dataKey.name = 'centralId'` - Gateway identifier for RPC calls
- `dataKey.name = 'label'` - Expected device labels for backfill

### RPC Endpoint

```javascript
POST https://${centralId}.y.myio.com.br/api/rpc/temperature_report
Body: {
  devices: string[],      // Device list (optional)
  dateStart: string,      // ISO 8601 start
  dateEnd: string         // ISO 8601 end
}
```

---

## Related Files

| File | Description |
|------|-------------|
| `controller.js` | Main widget logic with interpolation |
| `template.html` | Angular template for UI |
| `style.css` | Widget styling |
| `settings.schema` | ThingsBoard settings schema |

---

## RFC: Interpolação Limitada (Max 3h, Mesmo Dia)

### Problema Atual

A implementação atual de `interpolateSeries()` preenche **todos** os gaps no período selecionado, independentemente de:
- Tamanho do gap (pode ser dias inteiros)
- Cruzamento de meia-noite (um gap pode começar às 23:00 e terminar às 02:00 do dia seguinte)

Isso gera dados falsos em excesso e pode mascarar problemas reais de coleta.

### Proposta

**Regras de interpolação restritiva:**

| Regra | Descrição |
|-------|-----------|
| **Max Gap** | Interpolar apenas gaps de até **3 horas** (6 slots de 30 min) |
| **Mesmo Dia** | Não interpolar gaps que cruzam meia-noite |
| **Marcação** | Gaps maiores ficam como `null` ou marcados como `missing: true` |

### Algoritmo Proposto

```javascript
/**
 * Interpolação limitada: máximo 3 horas, mesmo dia
 *
 * @param {Array} sorted - Leituras ordenadas por tempo ASC
 * @param {string} deviceName - Nome do device
 * @param {string} startISO - Início do período
 * @param {string} endISO - Fim do período
 * @param {Object} options - Configurações
 * @param {number} options.maxGapSlots - Máximo de slots consecutivos a interpolar (default: 6 = 3h)
 * @param {boolean} options.allowCrossMidnight - Permitir interpolação cruzando meia-noite (default: false)
 */
function interpolateSeriesLimited(sorted, deviceName, startISO, endISO, options = {}) {
  const {
    maxGapSlots = 6,           // 6 slots = 3 horas
    allowCrossMidnight = false
  } = options;

  const HALF_HOUR_MS = 30 * 60 * 1000;

  // ... (código existente para normalização e snapping)

  // Identificar gaps e seus tamanhos
  const gaps = identifyGaps(fullSlots, existingBySlot);

  // Monta a série final
  const result = [];
  for (let i = 0; i < fullSlots.length; i++) {
    const slotISO = fullSlots[i];
    const slotDate = new Date(slotISO);

    if (existingBySlot.has(slotISO)) {
      // Valor real - sempre incluir
      result.push(existingBySlot.get(slotISO));
    } else {
      // Verificar se este slot faz parte de um gap válido para interpolação
      const gapInfo = findGapForSlot(gaps, i);

      if (gapInfo && canInterpolate(gapInfo, slotDate, maxGapSlots, allowCrossMidnight)) {
        // Gap pequeno e dentro do mesmo dia - interpolar
        const interpolatedValue = generateInterpolatedValue(slotISO, existingBySlot, fullSlots, i);
        result.push({
          time_interval: slotISO,
          value: interpolatedValue,
          interpolated: true,
          gapSize: gapInfo.size,
        });
      } else {
        // Gap muito grande ou cruza meia-noite - marcar como missing
        result.push({
          time_interval: slotISO,
          value: null,
          interpolated: false,
          missing: true,
          reason: gapInfo ? getSkipReason(gapInfo, slotDate, maxGapSlots, allowCrossMidnight) : 'no_data',
        });
      }
    }
  }

  return result;
}

/**
 * Identifica gaps consecutivos na série
 */
function identifyGaps(fullSlots, existingBySlot) {
  const gaps = [];
  let currentGap = null;

  for (let i = 0; i < fullSlots.length; i++) {
    const hasData = existingBySlot.has(fullSlots[i]);

    if (!hasData) {
      if (!currentGap) {
        currentGap = { startIndex: i, startSlot: fullSlots[i], size: 0 };
      }
      currentGap.size++;
      currentGap.endIndex = i;
      currentGap.endSlot = fullSlots[i];
    } else {
      if (currentGap) {
        gaps.push(currentGap);
        currentGap = null;
      }
    }
  }

  // Gap final
  if (currentGap) {
    gaps.push(currentGap);
  }

  return gaps;
}

/**
 * Verifica se um gap pode ser interpolado
 */
function canInterpolate(gapInfo, slotDate, maxGapSlots, allowCrossMidnight) {
  // Regra 1: Gap não pode exceder maxGapSlots
  if (gapInfo.size > maxGapSlots) {
    return false;
  }

  // Regra 2: Não cruzar meia-noite (se não permitido)
  if (!allowCrossMidnight) {
    const startDate = new Date(gapInfo.startSlot);
    const endDate = new Date(gapInfo.endSlot);

    // Verificar se estão no mesmo dia
    if (startDate.toDateString() !== endDate.toDateString()) {
      return false;
    }
  }

  return true;
}

/**
 * Retorna o motivo pelo qual o slot não foi interpolado
 */
function getSkipReason(gapInfo, slotDate, maxGapSlots, allowCrossMidnight) {
  if (gapInfo.size > maxGapSlots) {
    return `gap_too_large_${gapInfo.size}_slots`;
  }

  const startDate = new Date(gapInfo.startSlot);
  const endDate = new Date(gapInfo.endSlot);
  if (startDate.toDateString() !== endDate.toDateString()) {
    return 'crosses_midnight';
  }

  return 'unknown';
}
```

### Comparação: Antes vs Depois (IMPLEMENTADO)

```
Período selecionado: 01/01 → 20/01
Dados reais existem: apenas 01/01, 05/01, 10/01, 14/01

ANTES (interpolação ilimitada):
- Gerava dados para TODOS os dias de 01/01 a 20/01
- Dias sem telemetria tinham 100% de dados interpolados/fictícios
- Resultado: relatório gigante com dados falsos

AGORA (interpolação DIA A DIA, somente dias com dados):
- Processa APENAS os dias que têm dados reais: 01/01, 05/01, 10/01, 14/01
- Dias sem nenhum dado real: NÃO aparecem no relatório
- Dentro de cada dia: interpola gaps de até 4h (8 slots)
- Gaps > 4h ou sem dados: OMITIDOS
```

**Exemplo para um único dia (14/01):**
```
Dados reais 14/01: [--] [--] [20.1] [--] [--] [19.8] [--] ... [--] (último às 11:00)
                   00:00 00:30 01:00 01:30 02:00 02:30 03:00     11:00

Resultado:         [--] [--] [20.1] [19.9] [19.8] [19.8] [--] ... [19.5]
                   OMITIDO   ✓ real  ↑ interp      ✓ real         ✓ real
                   (gap início)
```

**Regras implementadas:**
1. Dias sem nenhum dado real → NÃO incluídos no relatório
2. Dentro de cada dia: interpola gaps ≤ 4h (8 slots)
3. Gaps > 4h → OMITIDOS (não gera `value: null`)
4. Não cruza meia-noite (cada dia é processado separadamente)

### Configuração Atual (IMPLEMENTADA)

| Parâmetro | Valor Default | Descrição |
|-----------|---------------|-----------|
| `maxGapSlots` | **8** | Máximo de slots consecutivos (8 × 30min = **4h**) |
| `allowCrossMidnight` | false | Bloquear interpolação que cruza meia-noite |
| `includeMissingInOutput` | **false** | Se false, slots missing NÃO são incluídos no relatório |

### Impacto no Relatório

**Vantagens:**
- Dados interpolados mais confiáveis (baseados em leituras próximas reais)
- Identificação clara de períodos sem dados (`missing: true`)
- Não mascara falhas de coleta prolongadas

**Considerações:**
- Relatório pode ter "buracos" visíveis
- UI precisa tratar `value: null` apropriadamente
- Pode ser necessário indicador visual para slots missing

### Implementação Sugerida

1. **Fase 1**: Adicionar função `interpolateSeriesLimited()` como alternativa
2. **Fase 2**: Adicionar toggle na UI para escolher modo (completo vs limitado)
3. **Fase 3**: Tornar modo limitado o default após validação

### Exemplo de Output com Missing

```javascript
// Slot interpolado (gap válido)
{
  time_interval: "2026-01-15T14:00:00.000Z",
  value: 19.45,
  interpolated: true,
  gapSize: 2
}

// Slot missing (gap inválido)
{
  time_interval: "2026-01-15T23:30:00.000Z",
  value: null,
  interpolated: false,
  missing: true,
  reason: "crosses_midnight"
}

// Slot missing (gap muito grande)
{
  time_interval: "2026-01-16T10:00:00.000Z",
  value: null,
  interpolated: false,
  missing: true,
  reason: "gap_too_large_15_slots"
}
```

---

## Version History

| Date | Change |
|------|--------|
| 2026-02 | Initial documentation |
| 2026-02 | RFC: Interpolação limitada (max 3h, mesmo dia) |
| 2026-02-04 | **IMPLEMENTADO**: Interpolação limitada (max 4h, dia a dia, omit missing, backfill disabled) |
