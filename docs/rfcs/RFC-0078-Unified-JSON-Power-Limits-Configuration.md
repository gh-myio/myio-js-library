# RFC-0078: Unified JSON Power Limits Configuration

- **Feature Name**: `unified-json-power-limits-configuration`
- **Start Date**: 2025-01-17
- **RFC PR**: #0078
- **Status**: Draft
- **Component**: `MYIO-SIM/V1.0.0/EQUIPMENTS`, `src/components/premium-modals/settings/SettingsModalView.ts`
- **Dependencies**: RFC-0077 (Dynamic Consumption Limits from Customer Attributes)

## Summary

Replace the multiple individual ThingsBoard attributes introduced in RFC-0077 with a single unified JSON attribute called `mapInstantaneousPower`. This JSON structure provides a more scalable, maintainable, and flexible configuration system that supports:

1. **Multiple telemetry types** (consumption, voltage_a, voltage_b, voltage_c, current_a, current_b, current_c, fp_a, fp_b, fp_c, total_current)
2. **Versioned schema** for future evolution
3. **Hierarchical device type configuration** within a single attribute
4. **Device-level overrides** with the same JSON structure
5. **UI enhancements** with telemetry type selector

## Motivation

### Current Problem (RFC-0077 Limitations)

RFC-0077 introduced dynamic consumption limits using individual ThingsBoard attributes:

```
standbyLimitDownConsumptionElevator = 0
standbyLimitUpConsumptionElevator = 150
alertLimitDownConsumptionElevator = 800
alertLimitUpConsumptionElevator = 1200
normalLimitDownConsumptionElevator = 150
normalLimitUpConsumptionElevator = 800
failureLimitDownConsumptionElevator = 1200
failureLimitUpConsumptionElevator = 99999
// ... 8 more for Escalator
// ... 8 more for Motor
// ... 8 more for HVAC
// Total: 32+ attributes just for consumption telemetry!
```

**Issues:**
1. **Attribute Proliferation**: 32+ attributes for consumption alone; adding voltage/current monitoring exponentially increases this
2. **No Versioning**: No way to track schema changes or migrations
3. **Limited Telemetry Support**: Only consumption (Watts) is supported; no voltage, current, or power factor monitoring
4. **Maintenance Overhead**: Each new device type requires 8+ new attributes
5. **Query Complexity**: Fetching 32+ individual attributes vs 1 JSON attribute

### Proposed Solution

Replace multiple attributes with a single JSON attribute:

**RFC-0077 Approach (32+ attributes):**
```
standbyLimitDownConsumptionElevator = 0
standbyLimitUpConsumptionElevator = 150
standbyLimitDownConsumptionEscalator = 0
standbyLimitUpConsumptionEscalator = 200
... (30+ more attributes)
```

**RFC-0078 Approach (1 JSON attribute):**
```json
{
  "version": "1.0.0",
  "limitsByInstantaneoustPowerType": [...]
}
```

### Benefits

1. **Single Source of Truth**: One JSON attribute contains all configuration
2. **Versioned Schema**: `version` field enables schema evolution
3. **Multi-Telemetry Support**: Configure limits for consumption, voltage, current, power factor simultaneously
4. **Reduced API Calls**: Fetch one attribute instead of 32+
5. **Self-Documenting**: JSON structure is readable and contains metadata (name, description)
6. **Easier Validation**: JSON schema validation vs individual field validation
7. **Future-Proof**: Easy to add new telemetry types or device types

## Guide-level Explanation

### How It Works

#### 1. JSON Attribute Structure

The `mapInstantaneousPower` attribute is stored as SERVER_SCOPE on either:
- **CUSTOMER entity** (shopping center defaults)
- **DEVICE entity** (device-specific overrides, takes priority)

```json
{
  "version": "1.0.0",
  "limitsByInstantaneoustPowerType": [
    {
      "telemetryType": "consumption",
      "itemsByDeviceType": [
        {
          "deviceType": "ELEVADOR",
          "name": "mapInstantaneousPowerElevator",
          "description": "Power limits for Elevator",
          "limitsByDeviceStatus": [
            {
              "deviceStatusName": "standBy",
              "limitsValues": {
                "baseValue": 0,
                "topValue": 150
              }
            },
            {
              "deviceStatusName": "normal",
              "limitsValues": {
                "baseValue": 151,
                "topValue": 800
              }
            },
            {
              "deviceStatusName": "alert",
              "limitsValues": {
                "baseValue": 801,
                "topValue": 1200
              }
            },
            {
              "deviceStatusName": "failure",
              "limitsValues": {
                "baseValue": 1201,
                "topValue": 99999
              }
            }
          ]
        },
        {
          "deviceType": "ESCADA_ROLANTE",
          "name": "mapInstantaneousPowerEscalator",
          "description": "Power limits for Escalator",
          "limitsByDeviceStatus": [...]
        }
      ]
    },
    {
      "telemetryType": "voltage_a",
      "itemsByDeviceType": [...]
    },
    {
      "telemetryType": "current_a",
      "itemsByDeviceType": [...]
    }
  ]
}
```

#### 2. Supported Telemetry Types

| Telemetry Type | Description | Unit |
|---------------|-------------|------|
| `consumption` | Total power consumption (a + b + c) | Watts |
| `a` | Phase A power | Watts |
| `b` | Phase B power | Watts |
| `c` | Phase C power | Watts |
| `total_current` | Total current (current_a + current_b + current_c) | Amperes |
| `current_a` | Phase A current | Amperes |
| `current_b` | Phase B current | Amperes |
| `current_c` | Phase C current | Amperes |
| `voltage_a` | Phase A voltage | Volts |
| `voltage_b` | Phase B voltage | Volts |
| `voltage_c` | Phase C voltage | Volts |
| `fp_a` | Phase A power factor | 0-1 |
| `fp_b` | Phase B power factor | 0-1 |
| `fp_c` | Phase C power factor | 0-1 |

#### 3. Device Type Support

Energy devices in ThingsBoard have names starting with `3F` prefix:
- `ELEVADOR` (Elevator)
- `ESCADA_ROLANTE` (Escalator)
- `MOTOR` (Motor/Pump)
- `BOMBA` (Pump)
- `3F_MEDIDOR` (Generic 3-phase meter)
- `CHILLER`
- `FANCOIL`
- `AR_CONDICIONADO` (Air Conditioner)
- `HVAC`
- `HIDROMETRO` (Water meter)
- `TERMOSTATO` (Thermostat)

#### 4. Priority Resolution

```
Device-Level mapInstantaneousPower (if exists)
    ↓
Customer-Level mapInstantaneousPower (fallback)
    ↓
Hardcoded defaults (last resort)
```

### User-Facing Changes

#### Settings Modal Enhancements

The "Configuração de Limites de Potência" section will include:

1. **Telemetry Type Selector**: Dropdown to select which telemetry type to configure
   - Default: `consumption` (Total Power)
   - Options: All 14 telemetry types

2. **Power Limits Table**: Same as RFC-0077 but updates based on selected telemetry type

3. **Validation on Save**: Ensures JSON schema compliance
   - `consumption` = a + b + c (automatically validated)
   - `total_current` = current_a + current_b + current_c (automatically validated)
   - All fields optional (graceful degradation)

4. **Import/Export JSON**: Button to view/edit raw JSON for advanced users

## Reference-level Explanation

### TypeScript Interfaces

```typescript
// RFC-0078: JSON Schema Types
interface InstantaneousPowerLimits {
  version: string; // Semantic versioning (e.g., "1.0.0")
  limitsByInstantaneoustPowerType: TelemetryTypeLimits[];
}

interface TelemetryTypeLimits {
  telemetryType: InstantaneoustPowerType;
  itemsByDeviceType: DeviceTypeLimits[];
}

type InstantaneoustPowerType =
  | 'consumption'
  | 'a' | 'b' | 'c'
  | 'total_current'
  | 'current_a' | 'current_b' | 'current_c'
  | 'voltage_a' | 'voltage_b' | 'voltage_c'
  | 'fp_a' | 'fp_b' | 'fp_c';

interface DeviceTypeLimits {
  deviceType: string; // e.g., "ELEVADOR", "ESCADA_ROLANTE"
  name: string; // Human-readable identifier
  description: string; // Description in Portuguese
  limitsByDeviceStatus: StatusLimits[];
}

interface StatusLimits {
  deviceStatusName: DeviceStatusName;
  limitsValues: {
    baseValue: number; // Minimum threshold
    topValue: number; // Maximum threshold
  };
}

type DeviceStatusName = 'standBy' | 'normal' | 'alert' | 'failure';
```

### Implementation Changes

#### 1. Fetch Function Update (EQUIPMENTS/controller.js)

```javascript
// RFC-0078: Fetch unified JSON configuration
async function fetchInstantaneousPowerLimits(entityId, entityType = 'CUSTOMER') {
  const url = `/api/plugins/telemetry/${entityType}/${entityId}/values/attributes/SERVER_SCOPE`;
  const tbToken = localStorage.getItem('jwt_token');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${tbToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${entityType} attributes: ${response.status}`);
    }

    const attributes = await response.json();

    // Find mapInstantaneousPower attribute
    const powerLimitsAttr = attributes.find(attr => attr.key === 'mapInstantaneousPower');

    if (!powerLimitsAttr) {
      console.log(`[RFC-0078] mapInstantaneousPower not found on ${entityType} ${entityId}`);
      return null;
    }

    // Parse JSON value
    const limits = typeof powerLimitsAttr.value === 'string'
      ? JSON.parse(powerLimitsAttr.value)
      : powerLimitsAttr.value;

    console.log(`[RFC-0078] Loaded mapInstantaneousPower from ${entityType}:`, limits);
    return limits;

  } catch (error) {
    console.error(`[RFC-0078] Error fetching ${entityType} power limits:`, error);
    return null;
  }
}
```

#### 2. Extract Limits for Specific Device and Telemetry Type

```javascript
// RFC-0078: Extract limits from unified JSON
function extractLimitsFromJSON(
  powerLimitsJSON,
  deviceType,
  telemetryType = 'consumption'
) {
  if (!powerLimitsJSON || !powerLimitsJSON.limitsByInstantaneoustPowerType) {
    return null;
  }

  // Find telemetry type configuration
  const telemetryConfig = powerLimitsJSON.limitsByInstantaneoustPowerType.find(
    config => config.telemetryType === telemetryType
  );

  if (!telemetryConfig) {
    console.log(`[RFC-0078] Telemetry type ${telemetryType} not found in JSON`);
    return null;
  }

  // Find device type configuration
  const deviceConfig = telemetryConfig.itemsByDeviceType.find(
    item => item.deviceType === deviceType
  );

  if (!deviceConfig) {
    console.log(`[RFC-0078] Device type ${deviceType} not found for telemetry ${telemetryType}`);
    return null;
  }

  // Extract ranges by status
  const ranges = {
    standbyRange: { down: 0, up: 0 },
    normalRange: { down: 0, up: 0 },
    alertRange: { down: 0, up: 0 },
    failureRange: { down: 0, up: 0 }
  };

  deviceConfig.limitsByDeviceStatus.forEach(status => {
    const baseValue = status.limitsValues.baseValue;
    const topValue = status.limitsValues.topValue;

    switch (status.deviceStatusName) {
      case 'standBy':
        ranges.standbyRange = { down: baseValue, up: topValue };
        break;
      case 'normal':
        ranges.normalRange = { down: baseValue, up: topValue };
        break;
      case 'alert':
        ranges.alertRange = { down: baseValue, up: topValue };
        break;
      case 'failure':
        ranges.failureRange = { down: baseValue, up: topValue };
        break;
    }
  });

  return {
    ...ranges,
    source: 'json',
    tier: 2, // Will be 1 if from device
    metadata: {
      name: deviceConfig.name,
      description: deviceConfig.description,
      version: powerLimitsJSON.version,
      telemetryType: telemetryType
    }
  };
}
```

#### 3. Hierarchical Resolution Update

```javascript
// RFC-0078: Updated hierarchical resolution
async function getConsumptionRangesHierarchicalV2(
  deviceId,
  deviceType,
  customerId,
  telemetryType = 'consumption'
) {
  console.log(`[RFC-0078] Resolving limits for device ${deviceId}, type ${deviceType}, telemetry ${telemetryType}`);

  // TIER 1: Try device-level JSON first
  const deviceLimitsJSON = await fetchInstantaneousPowerLimits(deviceId, 'DEVICE');
  if (deviceLimitsJSON) {
    const deviceRanges = extractLimitsFromJSON(deviceLimitsJSON, deviceType, telemetryType);
    if (deviceRanges) {
      console.log('[RFC-0078] Using TIER 1 (Device-level) limits');
      return { ...deviceRanges, source: 'device', tier: 1 };
    }
  }

  // TIER 2: Try customer-level JSON
  const customerLimitsJSON = await fetchInstantaneousPowerLimits(customerId, 'CUSTOMER');
  if (customerLimitsJSON) {
    const customerRanges = extractLimitsFromJSON(customerLimitsJSON, deviceType, telemetryType);
    if (customerRanges) {
      console.log('[RFC-0078] Using TIER 2 (Customer-level) limits');
      return { ...customerRanges, source: 'customer', tier: 2 };
    }
  }

  // TIER 3: Hardcoded defaults
  console.log('[RFC-0078] Using TIER 3 (Hardcoded) defaults');
  return getDefaultRanges(deviceType);
}
```

#### 4. Settings Modal UI Update

```typescript
// RFC-0078: Power Limits Card with Telemetry Type Selector
private getPowerLimitsHTML(): string {
  return `
    <div class="form-card power-limits-card">
      <div class="power-limits-header">
        <h4 class="section-title">Configuração de Limites de Potência</h4>
        <div class="power-limits-subtitle">
          Configure os limites por tipo de telemetria
        </div>
      </div>

      <div class="telemetry-selector">
        <label for="telemetryType">Tipo de Telemetria</label>
        <select id="telemetryType" name="telemetryType" class="form-select">
          <option value="consumption" selected>Consumo Total (W)</option>
          <option value="a">Fase A - Potência (W)</option>
          <option value="b">Fase B - Potência (W)</option>
          <option value="c">Fase C - Potência (W)</option>
          <option value="total_current">Corrente Total (A)</option>
          <option value="current_a">Fase A - Corrente (A)</option>
          <option value="current_b">Fase B - Corrente (A)</option>
          <option value="current_c">Fase C - Corrente (A)</option>
          <option value="voltage_a">Fase A - Tensão (V)</option>
          <option value="voltage_b">Fase B - Tensão (V)</option>
          <option value="voltage_c">Fase C - Tensão (V)</option>
          <option value="fp_a">Fase A - Fator de Potência</option>
          <option value="fp_b">Fase B - Fator de Potência</option>
          <option value="fp_c">Fase C - Fator de Potência</option>
        </select>
      </div>

      <div class="power-limits-table-wrapper">
        <table class="power-limits-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Mínimo</th>
              <th>Máximo</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody id="powerLimitsTableBody">
            <!-- Populated dynamically based on selected telemetry type -->
          </tbody>
        </table>
      </div>

      <div class="power-limits-actions">
        <button type="button" class="btn-copy-global" id="btnCopyFromGlobal">
          🌐 Copiar do Global
        </button>
        <button type="button" class="btn-clear-overrides" id="btnClearOverrides">
          🔵 Limpar Customizações
        </button>
        <button type="button" class="btn-view-json" id="btnViewJSON">
          📋 Ver JSON
        </button>
      </div>

      <div class="json-preview" id="jsonPreview" style="display: none;">
        <h5>Estrutura JSON</h5>
        <pre id="jsonContent"></pre>
      </div>
    </div>
  `;
}
```

#### 5. JSON Validation

```javascript
// RFC-0078: Validate JSON structure before saving
function validateInstantaneousPowerJSON(json) {
  const errors = [];

  // Check version
  if (!json.version || typeof json.version !== 'string') {
    errors.push('Missing or invalid version field');
  }

  // Check main array
  if (!Array.isArray(json.limitsByInstantaneoustPowerType)) {
    errors.push('Missing or invalid limitsByInstantaneoustPowerType array');
    return errors;
  }

  // Validate each telemetry type
  json.limitsByInstantaneoustPowerType.forEach((telemetryConfig, tIndex) => {
    if (!telemetryConfig.telemetryType) {
      errors.push(`Telemetry config at index ${tIndex} missing telemetryType`);
    }

    if (!Array.isArray(telemetryConfig.itemsByDeviceType)) {
      errors.push(`Telemetry ${telemetryConfig.telemetryType} missing itemsByDeviceType array`);
      return;
    }

    // Validate each device type
    telemetryConfig.itemsByDeviceType.forEach((deviceConfig, dIndex) => {
      if (!deviceConfig.deviceType) {
        errors.push(`Device config at ${tIndex}/${dIndex} missing deviceType`);
      }

      if (!Array.isArray(deviceConfig.limitsByDeviceStatus)) {
        errors.push(`Device ${deviceConfig.deviceType} missing limitsByDeviceStatus array`);
        return;
      }

      // Validate status limits
      const requiredStatuses = ['standBy', 'normal', 'alert', 'failure'];
      const foundStatuses = deviceConfig.limitsByDeviceStatus.map(s => s.deviceStatusName);

      requiredStatuses.forEach(status => {
        if (!foundStatuses.includes(status)) {
          errors.push(`Device ${deviceConfig.deviceType} missing ${status} configuration`);
        }
      });

      // Validate value ranges
      deviceConfig.limitsByDeviceStatus.forEach(status => {
        if (!status.limitsValues) {
          errors.push(`Status ${status.deviceStatusName} missing limitsValues`);
          return;
        }

        const base = status.limitsValues.baseValue;
        const top = status.limitsValues.topValue;

        if (typeof base !== 'number' || typeof top !== 'number') {
          errors.push(`Status ${status.deviceStatusName} has invalid numeric values`);
        }

        if (base > top) {
          errors.push(`Status ${status.deviceStatusName} has baseValue > topValue`);
        }
      });
    });
  });

  return errors;
}
```

### Migration Path from RFC-0077

For systems already using RFC-0077 individual attributes:

```javascript
// Migration helper: Convert RFC-0077 individual attributes to RFC-0078 JSON
function migrateRFC0077ToRFC0078(customerAttributes) {
  const json = {
    version: '1.0.0',
    limitsByInstantaneoustPowerType: [
      {
        telemetryType: 'consumption',
        itemsByDeviceType: []
      }
    ]
  };

  // Extract device types from attribute names
  const deviceTypes = ['Elevator', 'Escalator', 'Motor', 'Chiller', 'HVAC'];

  deviceTypes.forEach(deviceTypeSuffix => {
    const standbyDown = customerAttributes[`standbyLimitDownConsumption${deviceTypeSuffix}`];
    const standbyUp = customerAttributes[`standbyLimitUpConsumption${deviceTypeSuffix}`];

    if (standbyDown !== undefined && standbyUp !== undefined) {
      const deviceConfig = {
        deviceType: mapSuffixToDeviceType(deviceTypeSuffix),
        name: `mapInstantaneousPower${deviceTypeSuffix}`,
        description: `Migrated from RFC-0077 for ${deviceTypeSuffix}`,
        limitsByDeviceStatus: [
          {
            deviceStatusName: 'standBy',
            limitsValues: {
              baseValue: standbyDown,
              topValue: standbyUp
            }
          },
          {
            deviceStatusName: 'normal',
            limitsValues: {
              baseValue: customerAttributes[`normalLimitDownConsumption${deviceTypeSuffix}`] || standbyUp + 1,
              topValue: customerAttributes[`normalLimitUpConsumption${deviceTypeSuffix}`] || 1000
            }
          },
          {
            deviceStatusName: 'alert',
            limitsValues: {
              baseValue: customerAttributes[`alertLimitDownConsumption${deviceTypeSuffix}`] || 1001,
              topValue: customerAttributes[`alertLimitUpConsumption${deviceTypeSuffix}`] || 1500
            }
          },
          {
            deviceStatusName: 'failure',
            limitsValues: {
              baseValue: customerAttributes[`failureLimitDownConsumption${deviceTypeSuffix}`] || 1501,
              topValue: customerAttributes[`failureLimitUpConsumption${deviceTypeSuffix}`] || 99999
            }
          }
        ]
      };

      json.limitsByInstantaneoustPowerType[0].itemsByDeviceType.push(deviceConfig);
    }
  });

  return json;
}

function mapSuffixToDeviceType(suffix) {
  const map = {
    'Elevator': 'ELEVADOR',
    'Escalator': 'ESCADA_ROLANTE',
    'Motor': 'MOTOR',
    'Chiller': 'CHILLER',
    'HVAC': 'HVAC'
  };
  return map[suffix] || suffix.toUpperCase();
}
```

## Drawbacks

1. **JSON Complexity**: More complex than individual key-value pairs
2. **Learning Curve**: Administrators need to understand JSON structure
3. **Partial Updates**: Cannot update single values without fetching entire JSON
4. **Size Limits**: ThingsBoard may have attribute size limits (typically 1MB)
5. **Parsing Overhead**: JSON parsing for each query vs direct attribute access

## Rationale and Alternatives

### Why This Approach?

1. **Scalability**: Adding new telemetry types requires no schema changes
2. **Consistency**: All configuration in one place
3. **Versioning**: Can evolve schema without breaking changes
4. **Self-Documenting**: JSON includes metadata (name, description)

### Alternatives Considered

#### Alternative A: Keep RFC-0077 Individual Attributes
- **Pros**: Simple, direct key-value access
- **Cons**: 100+ attributes for full telemetry support, maintenance nightmare

#### Alternative B: Multiple JSON Attributes (one per device type)
- **Pros**: Smaller JSONs, easier partial updates
- **Cons**: Still requires multiple API calls, less unified

#### Alternative C: Database-backed configuration service
- **Pros**: Full CRUD support, query capabilities
- **Cons**: Additional infrastructure, more complex deployment

### Chosen: Single Unified JSON (RFC-0078)

Best balance of simplicity, flexibility, and maintainability.

## Prior Art

- **Grafana Dashboards**: JSON-based configuration with versioning
- **Kubernetes ConfigMaps**: Structured YAML/JSON for configuration
- **ThingsBoard Rule Chains**: JSON-based flow configuration
- **AWS CloudFormation**: Template-based infrastructure as JSON/YAML

## Unresolved Questions

1. **Maximum JSON Size**: What's the practical limit for ThingsBoard attribute values?
2. **UI Complexity**: Should we provide a visual JSON editor or just form-based editing?
3. **Backward Compatibility**: How long to support RFC-0077 individual attributes?
4. **Validation Depth**: Should we validate value ranges overlap (e.g., standBy.top < normal.base)?
5. **Default Template**: Should we provide a template JSON for new customers?

## Future Possibilities

1. **Schema Registry**: Version-controlled JSON schemas
2. **Visual Flow Editor**: Drag-and-drop configuration builder
3. **Inheritance**: Device-type inheritance (e.g., BOMBA inherits from MOTOR)
4. **Conditional Limits**: Time-based or load-based dynamic limits
5. **API Versioning**: Support multiple JSON versions simultaneously
6. **Audit Trail**: Track who changed what and when in the JSON

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Define TypeScript interfaces for JSON schema
- [ ] Implement `fetchInstantaneousPowerLimits()` function
- [ ] Implement `extractLimitsFromJSON()` function
- [ ] Implement `validateInstantaneousPowerJSON()` function
- [ ] Update `getConsumptionRangesHierarchicalV2()` to use JSON
- [ ] Add migration helper for RFC-0077 to RFC-0078

### Phase 2: UI Enhancements
- [ ] Add telemetry type selector to Settings Modal
- [ ] Implement dynamic table update based on selected telemetry
- [ ] Add JSON preview/edit capability
- [ ] Update source badges to show metadata (version, name)
- [ ] Add validation feedback on save

### Phase 3: Testing
- [ ] Unit tests for JSON parsing functions
- [ ] Unit tests for validation logic
- [ ] Integration tests for hierarchical resolution
- [ ] UI tests for telemetry selector
- [ ] Migration tests from RFC-0077

### Phase 4: Documentation
- [ ] Update ThingsBoard admin guide
- [ ] Create JSON schema documentation
- [ ] Add example configurations
- [ ] Document migration process
- [ ] Update API documentation

### Phase 5: Deployment
- [ ] Deploy to staging environment
- [ ] Test with real customer data
- [ ] Migrate existing RFC-0077 configurations
- [ ] Monitor for errors/issues
- [ ] Roll out to production

## Appendix A: Complete JSON Example

```json
{
  "version": "1.0.0",
  "limitsByInstantaneoustPowerType": [
    {
      "telemetryType": "consumption",
      "itemsByDeviceType": [
        {
          "deviceType": "ELEVADOR",
          "name": "mapInstantaneousPowerElevator",
          "description": "Setup de Limites de Potência instantânea para Elevador",
          "limitsByDeviceStatus": [
            {
              "deviceStatusName": "standBy",
              "limitsValues": {
                "baseValue": 0,
                "topValue": 150
              }
            },
            {
              "deviceStatusName": "normal",
              "limitsValues": {
                "baseValue": 151,
                "topValue": 800
              }
            },
            {
              "deviceStatusName": "alert",
              "limitsValues": {
                "baseValue": 801,
                "topValue": 1200
              }
            },
            {
              "deviceStatusName": "failure",
              "limitsValues": {
                "baseValue": 1201,
                "topValue": 99999
              }
            }
          ]
        },
        {
          "deviceType": "ESCADA_ROLANTE",
          "name": "mapInstantaneousPowerEscalator",
          "description": "Setup de Limites de Potência instantânea para Escada Rolante",
          "limitsByDeviceStatus": [
            {
              "deviceStatusName": "standBy",
              "limitsValues": {
                "baseValue": 0,
                "topValue": 200
              }
            },
            {
              "deviceStatusName": "normal",
              "limitsValues": {
                "baseValue": 201,
                "topValue": 1000
              }
            },
            {
              "deviceStatusName": "alert",
              "limitsValues": {
                "baseValue": 1001,
                "topValue": 1500
              }
            },
            {
              "deviceStatusName": "failure",
              "limitsValues": {
                "baseValue": 1501,
                "topValue": 99999
              }
            }
          ]
        },
        {
          "deviceType": "MOTOR",
          "name": "mapInstantaneousPowerMotor",
          "description": "Setup de Limites de Potência instantânea para Motor/Bomba",
          "limitsByDeviceStatus": [
            {
              "deviceStatusName": "standBy",
              "limitsValues": {
                "baseValue": 0,
                "topValue": 100
              }
            },
            {
              "deviceStatusName": "normal",
              "limitsValues": {
                "baseValue": 101,
                "topValue": 500
              }
            },
            {
              "deviceStatusName": "alert",
              "limitsValues": {
                "baseValue": 501,
                "topValue": 1000
              }
            },
            {
              "deviceStatusName": "failure",
              "limitsValues": {
                "baseValue": 1001,
                "topValue": 99999
              }
            }
          ]
        }
      ]
    },
    {
      "telemetryType": "voltage_a",
      "itemsByDeviceType": [
        {
          "deviceType": "ELEVADOR",
          "name": "mapInstantaneousPowerElevatorVoltageA",
          "description": "Limites de Tensão Fase A para Elevador",
          "limitsByDeviceStatus": [
            {
              "deviceStatusName": "standBy",
              "limitsValues": {
                "baseValue": 0,
                "topValue": 0
              }
            },
            {
              "deviceStatusName": "normal",
              "limitsValues": {
                "baseValue": 200,
                "topValue": 240
              }
            },
            {
              "deviceStatusName": "alert",
              "limitsValues": {
                "baseValue": 180,
                "topValue": 199
              }
            },
            {
              "deviceStatusName": "failure",
              "limitsValues": {
                "baseValue": 0,
                "topValue": 179
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## Appendix B: ThingsBoard API Reference

### Save JSON Attribute

```bash
POST /api/plugins/telemetry/CUSTOMER/{customerId}/attributes/SERVER_SCOPE
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "mapInstantaneousPower": {
    "version": "1.0.0",
    "limitsByInstantaneoustPowerType": [...]
  }
}
```

### Fetch JSON Attribute

```bash
GET /api/plugins/telemetry/CUSTOMER/{customerId}/values/attributes/SERVER_SCOPE?keys=mapInstantaneousPower
Authorization: Bearer {jwt_token}
```

Response:
```json
[
  {
    "key": "mapInstantaneousPower",
    "value": "{\"version\":\"1.0.0\",...}",
    "lastUpdateTs": 1705500000000
  }
]
```
