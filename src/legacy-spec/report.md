# Device Report Modal Specification

**Modal Function**: `openDashboardPopupReport`

**Captured**: 2025-09-25

## Parameters
- `entityId` (string): Device UUID
- `entityType` (string): Entity type
- `entitySlaveId` (number): Slave ID for device
- `entityCentralId` (string): Gateway/Central ID
- `entityIngestionId` (string): Ingestion UUID for Data API
- `entityLabel` (string): Device display label
- `entityComsuption` (number): Current consumption value
- `entityUpdatedIdentifiers` (array): Store identifiers

## Behavior Requirements

### Date Handling
- Local state isolated from main dashboard
- Date range inputs with "Load" button
- Converts to timezone-aware ISO strings
- Fills gaps in date range with 0 values

### Layout
- Full modal width with header controls
- Date range picker + Load button
- Export CSV button (disabled until data loaded)
- Sticky header table with sorting

### Data API Integration
- Endpoint: `/api/v1/telemetry/devices/{ingestionId}/energy`
- Parameters: `startTime`, `endTime`, `granularity=1d`, `page=1`, `pageSize=1000`, `deep=0`
- Authentication via Data API bearer token

### Table Structure
- **Total Row** (top): Shows sum of all consumption
- **Data Rows**: Date (DD/MM/YYYY) | Consumo (kWh)
- **Sorting**: Client-side by date or consumption (asc/desc)
- **Zebra striping**: Alternating row colors

### CSV Export Format
```
Dispositivo/Loja; {entityLabel}; {storeLabel}
DATA EMISSÃO; DD/MM/YYYY - HH:mm
Total; {total formatted pt-BR}
Data; Consumo
01/09/2025; 7,86
...
```

### Number Formatting
- pt-BR locale with comma decimal separator
- 2 decimal places for all values
- Semicolon separator in CSV

## Deviation Log
- [ ] No deviations from legacy implementation yet

## Critical Math
- Total = sum of all daily consumption values
- Gap filling: missing dates show 0,00
- Date range is inclusive (start 00:00:00 to end 23:59:59)

## Error States
- "Nenhum dado disponível" for empty results
- Loading overlay during API calls
- CSV button disabled until data loaded

## Acceptance Criteria
- [ ] Table shows complete date range with gaps filled
- [ ] Total row matches sum of all rows
- [ ] CSV export matches exact legacy format
- [ ] Sorting works on both columns
- [ ] pt-BR number formatting throughout
- [ ] Local date state isolated from main dashboard
