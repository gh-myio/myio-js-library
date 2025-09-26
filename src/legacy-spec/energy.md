# Energy Modal Specification

**Modal Function**: `openDashboardPopupEnergy`

**Captured**: 2025-09-25

## Parameters
- `entityId` (string): Device UUID
- `entityType` (string): Entity type
- `entitySlaveId` (number): Slave ID for device
- `entityCentralId` (string): Gateway/Central ID
- `entityIngestionId` (string): Ingestion UUID for Data API
- `entityLabel` (string): Device display label
- `entityComsuption` (number): Current consumption value

## Behavior Requirements

### Date Handling
- Uses shared date state from `DatesStore.get()`
- Converts to timezone-aware ISO strings with `-03:00` offset
- Default timezone: `America/Sao_Paulo`

### Layout
- **Left Panel (33%)**: Device info card with metadata
- **Right Panel (65%)**: EnergyChartSDK v2 chart
- Modal size: 80vw x 90vh

### Device Info Fields (Read-only)
- Etiqueta (Label)
- Andar (Floor)
- Número da Loja (Store Number)
- Identificador do Medidor (Meter ID)
- Identificador do Dispositivo (Device ID)
- GUID

### Chart Integration
- Uses EnergyChartSDK v2 with iframe
- Parameters: `readingType=energy`, `granularity=1d`
- Chart base URL: `https://graphs.apps.myio-bas.com`

### Comparison Data
- Fetches current vs previous period totals
- Uses `getEnergyComparisonSum` API
- Displays percentage change with color coding:
  - Green (decrease): `#388E3C`
  - Red (increase): `#d32f2f`
  - Neutral: `#000`

### Device Classification
- Uses `classifyDevice()` function for icon selection
- Icon mapping based on label keywords

## Deviation Log
- [ ] No deviations from legacy implementation yet

## Critical Math
- Percentage calculation: `(current - previous) / |previous| * 100`
- Handle division by zero: if previous = 0 and current > 0, show 100%
- Format numbers with pt-BR locale (comma decimal separator)

## Error States
- Chart loading errors show in chart container
- API errors logged to console
- Missing ingestionId shows warning

## Acceptance Criteria
- [ ] Modal renders with exact layout proportions
- [ ] Device info populated from ThingsBoard attributes
- [ ] Chart loads with correct parameters
- [ ] Comparison math matches legacy calculations
- [ ] ESC key closes modal
- [ ] Click outside closes modal
