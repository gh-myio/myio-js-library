# RFC 0128: Centralized Energy Equipment Subcategorization

- **Feature Name:** `energy-equipment-subcategorization`
- **Start Date:** 2026-01-05
- **RFC PR:** [myio-js-library#0128](https://github.com/gh-myio/myio-js-library/pull/0128)
- **MYIO Issue:** [myio-js-library#0128](https://github.com/gh-myio/myio-js-library/issues/0128)

## Summary

This RFC proposes creating a centralized equipment subcategorization system in the myio-js-library that will:

1. **Create a new `equipmentCategory.js` utility** in `src/utils/` with classification functions
2. **Move the Header component** from `src/components/premium-modals/header/` to `src/components/header/` (it's not a modal)
3. **Update Header tooltips** to display detailed equipment categories (Entrada, Climatização, Elevadores, Esc. Rolantes, Outros, Área Comum, Lojas)
4. **Standardize classification logic** across Shopping Dashboard and MYIO-SIM contexts
5. **Update CLAUDE.md** with this critical classification knowledge

## Motivation

### Current Problem

The current `detectContext()` function in `src/utils/deviceInfo.js` classifies energy devices into only three basic categories:

```javascript
// Current (RFC-0111) - Too generic
if (deviceType === '3F_MEDIDOR' && deviceProfile !== '3F_MEDIDOR') {
  return ContextType.EQUIPMENTS;  // All equipment lumped together
}
```

However, the Shopping Dashboard (`WIDGET/MAIN_VIEW/controller.js`) has a sophisticated `DEVICE_CLASSIFICATION_CONFIG` that provides detailed subcategorization:

- **Climatização**: CHILLER, FANCOIL, HVAC, AR_CONDICIONADO, BOMBA_CAG
- **Elevadores**: ELEVADOR, ELV-*
- **Escadas Rolantes**: ESCADA_ROLANTE, ESC-*
- **Outros**: BOMBA_INCENDIO, GERADOR, ILUMINACAO, etc.
- **Área Comum**: Calculated as residual (Entrada - mapped devices)

### Problem Impact

1. **MYIO-SIM Header tooltips** show only "Equipamentos" and "Lojas" - no breakdown
2. **Duplicate classification logic** exists in multiple controllers
3. **Inconsistent categorization** between Shopping Dashboard and MYIO-SIM
4. **No reusable library function** for equipment subcategorization

### Goals

1. **Single source of truth** for equipment classification rules
2. **Consistent categorization** across all contexts
3. **Detailed tooltip displays** showing all 7 equipment categories
4. **Proper component organization** (Header is not a modal)

## Guide-level Explanation

### Equipment Categories (Priority Order)

| Category | Classification Rule | Icon |
|----------|---------------------|------|
| **Entrada** | deviceType/Profile contains ENTRADA, RELOGIO, TRAFO, SUBESTACAO | 📥 |
| **Lojas** | deviceType = deviceProfile = '3F_MEDIDOR' (exactly) | 🏬 |
| **Climatização** | deviceType/Profile in [CHILLER, FANCOIL, HVAC, AR_CONDICIONADO, BOMBA_CAG] OR identifier in [CAG, HVAC] | ❄️ |
| **Elevadores** | deviceType = ELEVADOR OR identifier starts with ELV- | 🛗 |
| **Escadas Rolantes** | deviceType = ESCADA_ROLANTE OR identifier starts with ESC- | 🎢 |
| **Outros** | deviceType = 3F_MEDIDOR AND deviceProfile not in above categories | ⚙️ |
| **Área Comum** | Calculated: Entrada - (Lojas + Climatização + Elevadores + Esc. Rolantes + Outros) | 🏢 |

### Climatização Subcategories

| Subcategory | Pattern |
|-------------|---------|
| Chillers | CHILLER |
| Fancoils | FANCOIL |
| Bombas Hidráulicas | BOMBA_HIDRAULICA, BOMBA (excluding fire pumps) |
| CAG | CAG, CENTRAL |
| Outros HVAC | HVAC, AR_CONDICIONADO, COMPRESSOR, VENTILADOR |

### Outros Subcategories

| Subcategory | Pattern |
|-------------|---------|
| Iluminação | ILUMINA, LUZ, LAMPADA, LED |
| Bombas de Incêndio | INCENDIO, BOMBA_INCENDIO |
| Geradores/Nobreaks | GERADOR, NOBREAK, UPS |
| Geral | Everything else |

### Tooltip Display (After Implementation)

```
+----------------------------------------------------------+
|  📊 Distribuição por Categoria                            |
+----------------------------------------------------------+
|  📥 Entrada:           1,250.00 kWh  (100%)   [15 devices] |
|  ├─ 🏬 Lojas:            650.00 kWh   (52%)  [874 devices] |
|  └─ 🏢 Área Comum:       600.00 kWh   (48%)  [278 devices] |
|      ├─ ❄️ Climatização:  320.00 kWh         [180 devices] |
|      │   ├─ Chillers:      80.00 kWh          [8 devices] |
|      │   ├─ Fancoils:     180.00 kWh        [156 devices] |
|      │   └─ Outros HVAC:   60.00 kWh         [16 devices] |
|      ├─ 🛗 Elevadores:    120.00 kWh          [45 devices] |
|      ├─ 🎢 Esc. Rolantes:  80.00 kWh          [32 devices] |
|      └─ ⚙️ Outros:         80.00 kWh          [21 devices] |
+----------------------------------------------------------+
```

## Reference-level Explanation

### File Structure Changes

```
src/
├── utils/
│   ├── deviceInfo.js          # Existing - domain/context detection
│   └── equipmentCategory.js   # NEW - equipment subcategorization
├── components/
│   ├── header/                # MOVED from premium-modals/header/
│   │   ├── index.ts
│   │   ├── createHeaderComponent.ts
│   │   ├── HeaderView.ts
│   │   ├── HeaderFilterModal.ts
│   │   └── types.ts
│   └── premium-modals/
│       └── (header folder REMOVED)
└── index.ts                   # Update exports
```

### New File: `src/utils/equipmentCategory.js`

```javascript
/**
 * Equipment Category Utilities
 * Centralized equipment subcategorization for MYIO components
 *
 * @module equipmentCategory
 * @version 1.0.0
 * @see RFC-0128
 */

/**
 * Equipment category types
 * @enum {string}
 */
export const EquipmentCategory = {
  ENTRADA: 'entrada',
  LOJAS: 'lojas',
  CLIMATIZACAO: 'climatizacao',
  ELEVADORES: 'elevadores',
  ESCADAS_ROLANTES: 'escadas_rolantes',
  OUTROS: 'outros',
  AREA_COMUM: 'area_comum',  // Calculated (residual)
};

/**
 * Equipment classification configuration
 * Ported from MAIN_VIEW/controller.js DEVICE_CLASSIFICATION_CONFIG
 */
export const EQUIPMENT_CLASSIFICATION_CONFIG = {
  climatizacao: {
    deviceTypes: ['CHILLER', 'AR_CONDICIONADO', 'HVAC', 'FANCOIL'],
    deviceProfiles: ['CHILLER', 'FANCOIL', 'HVAC', 'AR_CONDICIONADO', 'BOMBA_CAG'],
    conditionalDeviceTypes: ['BOMBA', 'MOTOR'],
    identifiers: ['CAG', 'FANCOIL', 'HVAC'],
    identifierPrefixes: ['CAG-', 'FANCOIL-'],
  },
  elevadores: {
    deviceTypes: ['ELEVADOR'],
    deviceProfiles: ['ELEVADOR'],
    identifiers: ['ELV', 'ELEVADOR', 'ELEVADORES'],
    identifierPrefixes: ['ELV-', 'ELEVADOR-'],
  },
  escadas_rolantes: {
    deviceTypes: ['ESCADA_ROLANTE'],
    deviceProfiles: ['ESCADA_ROLANTE'],
    identifiers: ['ESC', 'ESCADA', 'ESCADASROLANTES'],
    identifierPrefixes: ['ESC-', 'ESCADA-', 'ESCADA_'],
  },
  entrada: {
    deviceTypes: ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'],
    deviceProfiles: ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'],
  },
};

/**
 * Classify an energy device into its equipment category.
 *
 * @param {Object} device - Device object
 * @param {string} [device.deviceType] - Device type
 * @param {string} [device.deviceProfile] - Device profile
 * @param {string} [device.identifier] - Device identifier (server_scope attribute)
 * @returns {string} Equipment category from EquipmentCategory enum
 */
export function classifyEquipment(device) {
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase();
  const identifier = String(device?.identifier || '').toUpperCase();

  // Priority 1: ENTRADA (main meters)
  const entradaTypes = ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'];
  if (entradaTypes.some(t => deviceType.includes(t) || deviceProfile.includes(t))) {
    return EquipmentCategory.ENTRADA;
  }

  // Priority 2: LOJAS (stores) - exact match required
  if (deviceType === '3F_MEDIDOR' && deviceProfile === '3F_MEDIDOR') {
    return EquipmentCategory.LOJAS;
  }

  // Priority 3: CLIMATIZACAO
  const hvacTypes = ['CHILLER', 'FANCOIL', 'HVAC', 'AR_CONDICIONADO', 'BOMBA_CAG'];
  const hvacIdentifiers = ['CAG', 'HVAC', 'AR_CONDICIONADO'];
  if (hvacTypes.some(t => deviceType.includes(t) || deviceProfile.includes(t)) ||
      hvacIdentifiers.some(id => identifier.includes(id))) {
    return EquipmentCategory.CLIMATIZACAO;
  }

  // Conditional: BOMBA/MOTOR with CAG identifier → climatizacao
  if (['BOMBA', 'MOTOR'].some(t => deviceType.includes(t)) &&
      ['CAG', 'FANCOIL'].some(id => identifier.includes(id))) {
    return EquipmentCategory.CLIMATIZACAO;
  }

  // Priority 4: ELEVADORES
  if (deviceType.includes('ELEVADOR') || deviceProfile.includes('ELEVADOR') ||
      identifier.startsWith('ELV-') || identifier.startsWith('ELEVADOR-')) {
    return EquipmentCategory.ELEVADORES;
  }

  // Priority 5: ESCADAS ROLANTES
  if (deviceType.includes('ESCADA') || deviceProfile.includes('ESCADA') ||
      identifier.startsWith('ESC-') || identifier.startsWith('ESCADA')) {
    return EquipmentCategory.ESCADAS_ROLANTES;
  }

  // Priority 6: OUTROS (remaining 3F_MEDIDOR equipment)
  if (deviceType === '3F_MEDIDOR' || deviceType.includes('MEDIDOR')) {
    return EquipmentCategory.OUTROS;
  }

  // Default: OUTROS
  return EquipmentCategory.OUTROS;
}

/**
 * Classify an equipment device into a subcategory (for detailed breakdown).
 *
 * @param {Object} device - Device object
 * @param {string} category - Parent category from classifyEquipment()
 * @returns {string} Subcategory name
 */
export function classifyEquipmentSubcategory(device, category) {
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase();
  const identifier = String(device?.identifier || '').toUpperCase();

  if (category === EquipmentCategory.CLIMATIZACAO) {
    if (deviceType.includes('CHILLER') || deviceProfile.includes('CHILLER')) return 'Chillers';
    if (deviceType.includes('FANCOIL') || deviceProfile.includes('FANCOIL')) return 'Fancoils';
    if (identifier.includes('CAG') || deviceType.includes('CENTRAL')) return 'CAG';
    if (deviceType.includes('BOMBA') && !deviceType.includes('INCENDIO')) return 'Bombas Hidráulicas';
    return 'Outros HVAC';
  }

  if (category === EquipmentCategory.OUTROS) {
    if (/ILUMINA|LUZ|LAMPADA|LED/.test(deviceType) || /ILUMINA|LUZ/.test(identifier)) return 'Iluminação';
    if (/INCENDIO|INCÊNDIO/.test(deviceType) || /INCENDIO/.test(identifier)) return 'Bombas de Incêndio';
    if (/GERADOR|NOBREAK|UPS/.test(deviceType)) return 'Geradores/Nobreaks';
    return 'Geral';
  }

  return null;  // No subcategory for other categories
}

/**
 * Get display metadata for a category.
 *
 * @param {string} category - Category from EquipmentCategory enum
 * @returns {{ name: string, icon: string }}
 */
export function getCategoryDisplayInfo(category) {
  const displayMap = {
    [EquipmentCategory.ENTRADA]: { name: 'Entrada', icon: '📥' },
    [EquipmentCategory.LOJAS]: { name: 'Lojas', icon: '🏬' },
    [EquipmentCategory.CLIMATIZACAO]: { name: 'Climatização', icon: '❄️' },
    [EquipmentCategory.ELEVADORES]: { name: 'Elevadores', icon: '🛗' },
    [EquipmentCategory.ESCADAS_ROLANTES]: { name: 'Esc. Rolantes', icon: '🎢' },
    [EquipmentCategory.OUTROS]: { name: 'Outros', icon: '⚙️' },
    [EquipmentCategory.AREA_COMUM]: { name: 'Área Comum', icon: '🏢' },
  };
  return displayMap[category] || { name: 'Desconhecido', icon: '❓' };
}

/**
 * Build category summary from classified devices.
 *
 * @param {Object[]} devices - Array of device objects with value/consumption
 * @returns {Object} Category summary with counts, consumption, and percentages
 */
export function buildEquipmentCategorySummary(devices) {
  const summary = {};

  // Initialize all categories
  Object.values(EquipmentCategory).forEach(cat => {
    summary[cat] = {
      devices: [],
      count: 0,
      consumption: 0,
      percentage: 0,
      subcategories: {},
    };
  });

  // Classify each device
  for (const device of devices) {
    const category = classifyEquipment(device);
    const value = Number(device.value || device.consumption || 0);

    summary[category].devices.push(device);
    summary[category].count++;
    summary[category].consumption += value;

    // Track subcategories
    const subcategory = classifyEquipmentSubcategory(device, category);
    if (subcategory) {
      if (!summary[category].subcategories[subcategory]) {
        summary[category].subcategories[subcategory] = { count: 0, consumption: 0, devices: [] };
      }
      summary[category].subcategories[subcategory].count++;
      summary[category].subcategories[subcategory].consumption += value;
      summary[category].subcategories[subcategory].devices.push(device);
    }
  }

  // Calculate Área Comum (residual)
  const entradaConsumption = summary[EquipmentCategory.ENTRADA].consumption;
  const mappedConsumption =
    summary[EquipmentCategory.LOJAS].consumption +
    summary[EquipmentCategory.CLIMATIZACAO].consumption +
    summary[EquipmentCategory.ELEVADORES].consumption +
    summary[EquipmentCategory.ESCADAS_ROLANTES].consumption +
    summary[EquipmentCategory.OUTROS].consumption;

  summary[EquipmentCategory.AREA_COMUM].consumption = Math.max(0, entradaConsumption - mappedConsumption);

  // Calculate percentages (based on Entrada total)
  const total = entradaConsumption || mappedConsumption;
  Object.values(EquipmentCategory).forEach(cat => {
    summary[cat].percentage = total > 0 ? (summary[cat].consumption / total) * 100 : 0;
  });

  return summary;
}
```

## Implementation Plan

### Phase 1: Create Equipment Classification Utility

1. Create `src/utils/equipmentCategory.js` with functions above
2. Export from `src/index.ts`
3. Add unit tests in `tests/equipmentCategory.test.js`

### Phase 2: Move Header Component

1. Move `src/components/premium-modals/header/` to `src/components/header/`
2. Update import paths in:
   - `src/index.ts`
   - `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`
3. Remove empty `premium-modals/header/` directory

### Phase 3: Update Energy Category Data Builder

1. Modify `buildEnergyCategoryData()` in `controller.js` to use new `buildEquipmentCategorySummary()`
2. Return 7 categories instead of 2 (Equipamentos/Lojas)
3. Include subcategories for Climatização and Outros

### Phase 4: Update Shopping Dashboard

1. Replace local `DEVICE_CLASSIFICATION_CONFIG` with imported `EQUIPMENT_CLASSIFICATION_CONFIG`
2. Replace local classification functions with library imports
3. Ensure backward compatibility

### Phase 5: Update CLAUDE.md

Add documentation about equipment classification system.

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/utils/equipmentCategory.js` | CREATE | New equipment classification utility |
| `src/index.ts` | MODIFY | Add new exports |
| `src/components/header/*` | MOVE | From `premium-modals/header/` |
| `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js` | MODIFY | Use new classification functions |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` | MODIFY | Import from library |
| `.claude/CLAUDE.md` | MODIFY | Add classification documentation |
| `tests/equipmentCategory.test.js` | CREATE | Unit tests |

## Drawbacks

1. **Migration effort**: Existing Shopping Dashboard code needs updates
2. **Breaking change potential**: If category names change, tooltips may break
3. **Testing complexity**: Need to verify all classification edge cases

## Rationale and Alternatives

### Why centralize in library?

- **Single source of truth**: Avoid drift between implementations
- **Reusability**: Both MYIO-SIM and Shopping Dashboard use same logic
- **Maintainability**: Fix bugs in one place

### Alternative: Keep separate implementations

Rejected because:
- Already caused inconsistencies
- Duplicate maintenance burden
- Knowledge scattered across files

## Prior Art

- **RFC-0111**: Established domain/context classification (energy/water/temperature)
- **RFC-0105**: Energy Summary Info Tooltip structure
- **RFC-0063**: Identifier-based classification patterns
- **DEVICE_CLASSIFICATION_CONFIG**: Existing Shopping Dashboard implementation

## Unresolved Questions

1. Should `Área Comum` be a calculated residual or classified directly?
2. How to handle devices that match multiple categories?
3. Should subcategory classification be recursive?

## Future Possibilities

1. **API-driven classification**: Fetch category rules from ThingsBoard attributes
2. **Custom category mapping**: Per-customer category configurations
3. **Category analytics**: Track consumption patterns by category over time

---

## Testing Checklist

- [ ] Equipment classification returns correct categories
- [ ] Subcategory classification works for Climatização/Outros
- [ ] Área Comum calculated correctly as residual
- [ ] Header tooltips display all 7 categories
- [ ] Shopping Dashboard continues working after migration
- [ ] No "undefined" errors in tooltip displays
- [ ] Build succeeds without TypeScript errors
