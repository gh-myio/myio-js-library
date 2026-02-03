# RFC-0159: Device Classification Functions Migration

## Status: DRAFT

## Summary

Migrar as funções de classificação de dispositivos de `MAIN/controller.js` para a biblioteca `myio-js-library`, eliminando redundâncias e criando uma API unificada.

## Background

Atualmente, existem **11 funções** de classificação em MAIN/controller.js que são expostas via `window.MyIOUtils`:

| Função | Linhas | Propósito |
|--------|--------|-----------|
| `isStoreDevice` | 1058-1076 | Verifica se é loja (3F_MEDIDOR) |
| `isEntradaDevice` | 1088-1110 | Verifica se é entrada (TRAFO/ENTRADA) |
| `isWaterStoreDevice` | 1122-1133 | Verifica se é hidrômetro de loja |
| `classifyWaterMeterDevice` | 1151-1173 | Classifica hidrômetro: loja/areacomum/entrada |
| `isWaterEntradaDevice` | 1182-1193 | Verifica se é hidrômetro de entrada |
| `classifyDeviceByDeviceType` | 1206-1257 | Classifica por deviceType/deviceProfile |
| `classifyDeviceByIdentifier` | 1265-1305 | Classifica por identifier |
| `classifyDevice` | 1312-1337 | Combina as duas acima |
| `categoryToLabelWidget` | 1344-1353 | Converte categoria para label |
| `inferLabelWidget` | 1372-1468 | Infere labelWidget do dispositivo |
| `DEVICE_CLASSIFICATION_CONFIG` | 976-1000 | Configuração de classificação |

## Analysis: Redundâncias Identificadas

### 1. Funções Water redundantes

```
isWaterStoreDevice(item)           → retorna boolean
classifyWaterMeterDevice(item)     → retorna 'loja'|'areacomum'|'entrada'
isWaterEntradaDevice(item)         → retorna boolean
```

**Redundância:** `isWaterStoreDevice` e `isWaterEntradaDevice` podem ser derivadas de `classifyWaterMeterDevice`:

```javascript
// ANTES (3 funções)
isWaterStoreDevice(item)    // lógica duplicada
isWaterEntradaDevice(item)  // lógica duplicada
classifyWaterMeterDevice(item)

// DEPOIS (1 função principal + 2 helpers)
classifyWaterDevice(item)  // retorna 'loja'|'areacomum'|'entrada'
isWaterStoreDevice = (item) => classifyWaterDevice(item) === 'loja'
isWaterEntradaDevice = (item) => classifyWaterDevice(item) === 'entrada'
```

### 2. Funções Energy redundantes

```
isStoreDevice(item)                → retorna boolean
isEntradaDevice(item)              → retorna boolean
classifyDeviceByDeviceType(item)   → retorna 'lojas'|'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'
classifyDeviceByIdentifier(id)     → retorna categoria ou null
classifyDevice(item)               → combina as duas acima
```

**Redundância:** `isStoreDevice` pode ser derivada de `classifyDeviceByDeviceType`:

```javascript
// DEPOIS
classifyEnergyDevice(item)  // retorna categoria
isStoreDevice = (item) => classifyEnergyDevice(item) === 'lojas'
isEntradaDevice(item)       // mantém (lógica diferente - usa patterns no nome)
```

### 3. Duplicação de patterns

```javascript
// Em inferLabelWidget():
const CLIMATIZACAO_PATTERNS = ['CHILLER', 'FANCOIL', 'HVAC', 'AR_CONDICIONADO', ...]
const ELEVADOR_PATTERNS = ['ELEVADOR', 'ELV']
const ESCADA_PATTERNS = ['ESCADA_ROLANTE', 'ESCADA']

// Em DEVICE_CLASSIFICATION_CONFIG:
climatizacao.deviceTypes: ['CHILLER', 'AR_CONDICIONADO', 'HVAC', 'FANCOIL']
elevadores.deviceTypes: ['ELEVADOR']
escadas_rolantes.deviceTypes: ['ESCADA_ROLANTE']
```

**Redundância:** Mesmos patterns definidos em dois lugares.

## Proposed Architecture

### Nova Estrutura na Biblioteca

```
src/utils/deviceClassification/
├── index.ts                    # Re-exports
├── types.ts                    # Types/interfaces
├── config.ts                   # DEVICE_CLASSIFICATION_CONFIG
├── energy.ts                   # Energy device classification
├── water.ts                    # Water device classification
└── helpers.ts                  # Shared helpers
```

### API Proposta

```typescript
// === TYPES ===
type EnergyCategory = 'lojas' | 'entrada' | 'climatizacao' | 'elevadores' | 'escadas_rolantes' | 'outros';
type WaterCategory = 'loja' | 'areacomum' | 'entrada';
type LabelWidget = 'Lojas' | 'Entrada' | 'Climatização' | 'Elevadores' | 'Escadas Rolantes' | 'Área Comum' | 'Temperatura' | '';

interface DeviceItem {
  deviceType?: string;
  deviceProfile?: string;
  identifier?: string;
  name?: string;
  label?: string;
}

// === ENERGY CLASSIFICATION ===
export function classifyEnergyDevice(item: DeviceItem): EnergyCategory;
export function isStoreDevice(item: DeviceItem | string): boolean;
export function isEntradaDevice(item: DeviceItem): boolean;
export function isEquipmentDevice(item: DeviceItem): boolean;

// === WATER CLASSIFICATION ===
export function classifyWaterDevice(item: DeviceItem): WaterCategory;
export function isWaterStoreDevice(item: DeviceItem): boolean;
export function isWaterEntradaDevice(item: DeviceItem): boolean;
export function isWaterAreaComumDevice(item: DeviceItem): boolean;

// === LABEL HELPERS ===
export function categoryToLabel(category: EnergyCategory): LabelWidget;
export function inferLabelWidget(item: DeviceItem): LabelWidget;

// === CONFIG ===
export const DEVICE_CLASSIFICATION_CONFIG: DeviceClassificationConfig;
```

## Migration Plan

### Phase 1: Create Library Functions

1. Create `src/utils/deviceClassification/` directory
2. Implement all functions in TypeScript with proper typing
3. Export from `src/index.ts`
4. Add unit tests

### Phase 2: Update MAIN/controller.js

Replace local functions with library imports:

```javascript
// RFC-0159: Use device classification from myio-js-library
const {
  classifyEnergyDevice,
  classifyWaterDevice,
  isStoreDevice,
  isEntradaDevice,
  isWaterStoreDevice,
  isWaterEntradaDevice,
  categoryToLabel,
  inferLabelWidget,
  DEVICE_CLASSIFICATION_CONFIG,
} = (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) || (() => {
  console.error('[MAIN] Device classification not available from MyIOLibrary');
  return {};
})();
```

### Phase 3: Update Child Widgets

- EQUIPMENTS, STORES, WATER_STORES, WATER_COMMON_AREA
- Remove `window.MyIOUtils.classifyDevice` calls, use library directly

## Breaking Changes

None expected - API remains compatible:

| Old Function | New Function | Notes |
|--------------|--------------|-------|
| `classifyDevice` | `classifyEnergyDevice` | Rename for clarity |
| `classifyDeviceByDeviceType` | `classifyEnergyDevice` | Merged |
| `classifyDeviceByIdentifier` | Internal use only | Not exported |
| `classifyWaterMeterDevice` | `classifyWaterDevice` | Rename for consistency |

## Impact Analysis by Controller

### MAIN/controller.js - FONTE DAS FUNÇÕES

**Funções definidas (linhas ~976-1482):**
- `DEVICE_CLASSIFICATION_CONFIG` (976-1000)
- `isStoreDevice` (1058-1076)
- `isEntradaDevice` (1088-1110)
- `isWaterStoreDevice` (1122-1133)
- `classifyWaterMeterDevice` (1151-1173)
- `isWaterEntradaDevice` (1182-1193)
- `classifyDeviceByDeviceType` (1206-1257)
- `classifyDeviceByIdentifier` (1265-1305)
- `classifyDevice` (1312-1337)
- `categoryToLabelWidget` (1344-1353)
- `inferLabelWidget` (1372-1468)

**Uso interno (linhas 4348-8690):**
- `isStoreDevice`: linhas 4370, 7043, 7045, 7075, 7973, 7975, 8003, 8610
- `isEntradaDevice`: linhas 7026, 7027, 7941, 8600
- `isWaterStoreDevice`: linhas 7665, 7667, 7696, 8073, 8074, 8101
- `isWaterEntradaDevice`: linhas 7658, 8047, 8690
- `inferLabelWidget`: linha 6717

**Exposição via window.MyIOUtils (linhas 1473-1482):**
```javascript
DEVICE_CLASSIFICATION_CONFIG,
classifyDevice,
classifyDeviceByDeviceType,
classifyDeviceByIdentifier,
categoryToLabelWidget,
inferLabelWidget,
isStoreDevice,
isWaterStoreDevice,
isWaterEntradaDevice,
classifyWaterMeterDevice,
```

**Impacto:** Migrar funções para biblioteca, manter exposição via `window.MyIOUtils` para compatibilidade.

---

### STORES/controller.js - FUNÇÕES LOCAIS DIFERENTES

**Funções definidas LOCALMENTE (linhas 1426-1557):**
- `classifyDeviceByIdentifier` (1426-1456) - **DIFERENTE de MAIN** (usa patterns específicos para equipamentos)
- `classifyDeviceByLabel` (1463-1503) - **NÃO EXISTE em MAIN**
- `classifyDevice` (1510-1557) - **DIFERENTE de MAIN** (combina identifier + label para categorias de equipamentos)

**Propósito:** Classificar equipamentos em subcategorias (climatização, elevadores, escadas_rolantes, outros)

**Uso de funções do MAIN:**
- `window.MyIOUtils?.isStoreDevice` (linhas 1836, 2254) - usado como fallback

**Impacto:**
- As funções locais são ESPECÍFICAS para categorização de equipamentos (diferentes das de MAIN)
- **DECISÃO:** Manter funções locais OU migrar separadamente como `classifyEquipmentSubcategory`
- Continua usando `isStoreDevice` de `window.MyIOUtils` - sem impacto

---

### WATER_STORES/controller.js - DUPLICAÇÃO

**Funções definidas LOCALMENTE:**
- `isWaterStoreDevice` (linhas 27-38) - **DUPLICADA de MAIN**

```javascript
function isWaterStoreDevice(device) {
  const aliasName = device?.aliasName || device?.datasource?.aliasName || '';
  if (aliasName === 'Todos Hidrometros Lojas') return true;
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const deviceProfile = String(device?.deviceProfile || device?.deviceType || '').toUpperCase();
  return deviceType === 'HIDROMETRO' && deviceProfile === 'HIDROMETRO';
}
```

**Impacto:**
- **PODE REMOVER:** Usar `window.MyIOUtils.isWaterStoreDevice` ou `window.MyIOLibrary.isWaterStoreDevice`
- Alternativamente: manter para evitar dependência circular

---

### EQUIPMENTS/controller.js - SEM USO DIRETO

Não usa diretamente funções de classificação. Usa o factory.

**Impacto:** Nenhum ajuste necessário.

---

### WATER_COMMON_AREA/controller.js - SEM USO DIRETO

Não usa diretamente funções de classificação. Usa filtro por `deviceProfile === 'HIDROMETRO_AREA_COMUM'`.

**Impacto:** Nenhum ajuste necessário.

---

### Outros Controllers - SEM USO

Os seguintes controllers não usam funções de classificação:
- ENERGY/controller.js
- WATER/controller.js
- MENU/controller.js
- HEADER/controller.js
- FOOTER/controller.js
- WELCOME/controller.js
- TEMPERATURE/controller.js
- TEMPERATURE_SENSORS/controller.js
- TEMPERATURE_WITHOUT_CLIMATE_CONTROL/controller.js
- TELEMETRY/controller.js
- MAIN_UNIQUE_DATASOURCE/controller.js

## Files Affected

- `src/utils/deviceClassification/` (new)
- `src/index.ts` (exports)
- `src/MYIO-SIM/v5.2.0/MAIN/controller.js` (remove ~400 lines, manter exposição via MyIOUtils)
- `src/MYIO-SIM/v5.2.0/WATER_STORES/controller.js` (opcional: remover `isWaterStoreDevice` duplicada)
- `src/MYIO-SIM/v5.2.0/STORES/controller.js` (manter funções locais - são diferentes)

**Sem impacto:**
- `src/MYIO-SIM/v5.2.0/EQUIPMENTS/controller.js`
- `src/MYIO-SIM/v5.2.0/WATER_COMMON_AREA/controller.js`

## Estimated Reduction

- **Lines removed from MAIN:** ~400 lines
- **Lines in new library module:** ~250 lines (typed, tested, documented)
- **Net reduction:** ~150 lines + better type safety + unit tests

## Questions for Review

1. Should `classifyDeviceByIdentifier` be exported or kept internal?
2. Should we add a `classifyTemperatureDevice` function?
3. Should `inferLabelWidget` handle `groupType` from API or be pure classification?
4. **STORES:** Migrar `classifyDevice`/`classifyDeviceByIdentifier`/`classifyDeviceByLabel` para biblioteca como `classifyEquipmentSubcategory`?
5. **WATER_STORES:** Remover `isWaterStoreDevice` duplicada e usar de `window.MyIOUtils`?

## Related RFCs

- RFC-0097: Device Classification by Identifier
- RFC-0106: Device Classification by DeviceType
- RFC-0109: Water Meter Classification
- RFC-0140: DeviceProfile Fallback to DeviceType
