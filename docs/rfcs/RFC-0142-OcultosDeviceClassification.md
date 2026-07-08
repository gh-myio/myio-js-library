# RFC-0142: Ocultos Device Classification

## Status
Implemented

## Problem

Devices with `deviceProfile` containing patterns like `3F_MEDIDOR_ARQUIVADO_INSTALADO_SEM_DADOS` were falling through the classification logic and being incorrectly placed in the "Área Comum" (common area) group.

### Example Problem Device
```
deviceType: 3F_MEDIDOR
deviceProfile: 3F_MEDIDOR_ARQUIVADO_INSTALADO_SEM_DADOS
```

This device would:
1. NOT match `isStoreDevice()` because deviceProfile !== '3F_MEDIDOR'
2. NOT match ENTRADA because deviceProfile is not in ['TRAFO', 'ENTRADA', 'RELOGIO', 'SUBESTACAO']
3. Fall through to AREACOMUM (catch-all) ← Bug!

These archived/inactive devices should NOT appear in any display group.

## Solution

Instead of filtering out archived devices completely, classify them into a new "ocultos" (hidden) group. This approach:
- Keeps devices tracked (for auditing/debugging)
- Separates them into a group that can be ignored by displays
- Maintains consistent data flow (no filtering at multiple levels)

### New Classification Function

```javascript
const OCULTOS_PATTERNS = ['ARQUIVADO', 'SEM_DADOS', 'DESATIVADO', 'REMOVIDO', 'INATIVO'];

function isOcultosDevice(itemOrDeviceProfile) {
  const profile = String(deviceProfile || '').toUpperCase();

  for (const pattern of OCULTOS_PATTERNS) {
    if (profile.includes(pattern)) {
      return true;
    }
  }

  return false;
}
```

### Updated Classification Order

**Energy Domain (categorizeItemsByGroup)**:
1. **OCULTOS**: deviceProfile contains ARQUIVADO, SEM_DADOS, DESATIVADO, REMOVIDO, INATIVO
2. LOJAS: deviceProfile === '3F_MEDIDOR'
3. ENTRADA: deviceType = '3F_MEDIDOR' AND deviceProfile in [TRAFO, ENTRADA, RELOGIO, SUBESTACAO]
4. AREACOMUM: everything else

**Water Domain (categorizeItemsByGroupWater)**:
1. **OCULTOS**: deviceProfile contains ARQUIVADO, SEM_DADOS, DESATIVADO, REMOVIDO, INATIVO
2. ENTRADA: deviceType = HIDROMETRO_SHOPPING
3. AREACOMUM: deviceType = HIDROMETRO_AREA_COMUM
4. BANHEIROS: identifier contains bathroom patterns
5. LOJAS: deviceType = HIDROMETRO
6. CAIXADAGUA: tanks

### Updated Functions

#### inferLabelWidget
```javascript
function inferLabelWidget(row) {
  // RFC-0142: RULE 0 - Classify archived/inactive devices as "Ocultos"
  if (isOcultosDevice(row)) {
    return 'Ocultos';
  }
  // ... rest of classification
}
```

#### mapLabelWidgetToStateGroup (TELEMETRY)
```javascript
function mapLabelWidgetToStateGroup(labelWidget) {
  const lw = labelWidget.toLowerCase().trim();
  if (lw === 'lojas') return 'lojas';
  if (lw === 'entrada') return 'entrada';
  // RFC-0142: Ocultos group for archived/inactive devices
  if (lw === 'ocultos') return 'ocultos';
  if (lw === "caixa d'água") return 'caixadagua';
  return 'areacomum';
}
```

## Files Changed

- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`:
  - Added `OCULTOS_PATTERNS` constant
  - Added `isOcultosDevice()` function
  - Updated `categorizeItemsByGroup()` to return `ocultos` group
  - Updated `categorizeItemsByGroupWater()` to return `ocultos` group
  - Updated `inferLabelWidget()` to return 'Ocultos' for archived devices
  - Exposed `OCULTOS_PATTERNS` and `isOcultosDevice` via `window.MyIOUtils`

- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`:
  - Updated `mapLabelWidgetToStateGroup()` to handle 'ocultos' labelWidget

## Patterns Detected as "Ocultos"

| Pattern | Description |
|---------|-------------|
| `ARQUIVADO` | Archived devices |
| `SEM_DADOS` | Devices without data |
| `DESATIVADO` | Deactivated devices |
| `REMOVIDO` | Removed devices |
| `INATIVO` | Inactive devices |

## Usage

```javascript
// Check if device should be hidden
if (window.MyIOUtils.isOcultosDevice(device)) {
  // Device is archived/inactive, don't display
}

// In categorization results
const { lojas, entrada, areacomum, ocultos } = categorizeItemsByGroup(items);
console.log(`Hidden devices: ${ocultos.length}`);
```

## Logging

When devices are classified as "ocultos", a debug log is emitted:
```
[RFC-0142] Classified 3 devices as "ocultos" (hidden):
  Meter-001 (3F_MEDIDOR_ARQUIVADO_INSTALADO_SEM_DADOS),
  Meter-002 (3F_MEDIDOR_DESATIVADO),
  Meter-003 (HIDROMETRO_REMOVIDO)
```

## Related RFCs

- RFC-0106: Device classification by deviceProfile
- RFC-0107: Water domain categorization
- RFC-0108: HIDROMETRO classification fix
