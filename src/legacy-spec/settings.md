# Settings Modal Specification

**Modal Function**: `openDashboardPopup`

**Captured**: 2025-09-25

## Parameters
- `entityId` (string): Device UUID
- `entityType` (string): Entity type
- `insueDate` (optional): Issue date

## Behavior Requirements

### Layout
- Two-column layout (50% each)
- **Left Card**: Device metadata fields
- **Right Card**: Alarm thresholds
- Modal size: 90vw x 90vh

### ThingsBoard Integration
- Reads device info via `/api/device/{deviceId}`
- Reads SERVER_SCOPE attributes via `/api/plugins/telemetry/DEVICE/{deviceId}/values/attributes`
- Updates device label via POST `/api/device`
- Updates attributes via POST `/api/plugins/telemetry/DEVICE/{deviceId}/SERVER_SCOPE`

### Left Card Fields (Device Metadata)
- **Etiqueta** (editable): Device label
- **Andar** (editable): Floor (`floor` attribute)
- **Número da Loja** (editable): Store number (`NumLoja` attribute)
- **Identificador do Medidor** (editable): Meter ID (`IDMedidor` attribute)
- **Identificador do Dispositivo** (editable): Device ID (`deviceId` attribute)
- **GUID** (editable): GUID (`guid` attribute)

### Right Card Fields (Alarm Thresholds)
- **Consumo Máximo Diário (kWh)**: `maxDailyConsumption` attribute
- **Consumo Máximo na Madrugada (0h - 06h) (kWh)**: `maxNightConsumption` attribute
- **Consumo Máximo Horário Comercial (09h - 22h) (kWh)**: `maxBusinessConsumption` attribute

### Form Validation
- Numeric fields (kWh values) must be valid numbers
- All fields are optional but should preserve existing values
- No client-side validation beyond basic number parsing

### Save Process
1. Update device label via device API
2. Update all attributes via telemetry API
3. Show success/error feedback
4. Close modal on success
5. Reload page on success

### Authentication
- Uses `tbJwtToken` from localStorage
- All API calls include `X-Authorization: Bearer {token}` header

## Deviation Log
- [ ] No deviations from legacy implementation yet

## Error Handling
- Network errors show alert with error message
- Invalid responses logged to console
- Form remains open on error for retry

## Styling
- Form inputs: 8px padding, 1px solid #ccc border, 6px border-radius
- Cards: white background, 8px border-radius, subtle shadow
- Buttons: Save (purple #4A148C) | Close (gray #ccc)

## Acceptance Criteria
- [ ] Loads current device label and attributes
- [ ] Form fields pre-populated with existing values
- [ ] Save updates both device and attributes
- [ ] Success shows confirmation and closes modal
- [ ] Error handling preserves form state
- [ ] Page reloads after successful save
