# All Report Modal Specification

**Modal Function**: `openDashboardPopupAllReport`

**Captured**: 2025-09-25

## Parameters
- `entityId` (string): Default entity ID (usually "default-shopping-id")
- `entityType` (string): Entity type (usually "ASSET")

## Behavior Requirements

### Date Handling
- Local state isolated from main dashboard
- Date range inputs with "Load" button
- Converts to timezone-aware ISO strings
- Default range: current month start to today

### Layout
- Full modal width with header controls
- Date range picker + Load button
- Header stats: Store count + Total consumption
- Export CSV button (disabled until data loaded)
- Sortable table with pagination support

### Data API Integration
- Endpoint: `/api/v1/telemetry/customers/{customerId}/energy/devices/totals`
- Parameters: `startTime`, `endTime`, `deep=1`
- Pagination: `page`, `limit` (default 100)
- Authentication via Data API bearer token

### Filtering Logic
- Excludes devices matching regex patterns:
  - `/bomba.*secund[aá]ria/i`
  - `/^administra[cç][aã]o\s*1$/i`
  - `/^administra[cç][aã]o\s*2$/i`
  - `/^pist[aã]o\s*2$/i`
  - `/chiller/i`
  - `/ubesta/i`
  - `/^entrada\b/i`
  - `/^rel[oó]gio\b/i`

### Table Structure
- **Header Stats**: "🛍️ Lojas: X" | "⚡ Total consumo: Y kWh"
- **Columns**: Loja | Identificador | Consumo
- **Sorting**: All columns sortable (client-side)
- **Zebra striping**: Alternating row colors

### CSV Export Format
```
DATA EMISSÃO; DD/MM/YYYY - HH:mm
Total; {total formatted pt-BR}
Loja; Identificador; Consumo
Outback; SCP00480; 22,81
...
```

### Pagination Handling
- Fetches all pages automatically
- Uses `pagination.pages` when available
- Fallback: continues until `data.length < limit`
- Merges all results before filtering

## Deviation Log
- [ ] No deviations from legacy implementation yet

## Critical Math
- Total = sum of all device totals after filtering
- Store count = number of devices after filtering
- Sorting preserves original data integrity

## Error States
- "Nenhum dado disponível" for empty results
- Loading overlay during API calls
- Error handling for pagination failures

## Acceptance Criteria
- [ ] Fetches all pages of customer data
- [ ] Applies filtering regex correctly
- [ ] Header stats match filtered data
- [ ] Sorting works on all columns
- [ ] CSV export matches exact legacy format
- [ ] pt-BR number formatting throughout
- [ ] Local date state isolated from main dashboard
