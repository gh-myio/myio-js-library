# RFC: Customer Totals All Report API Integration

**Feature Name:** customer-totals-all-report-api-integration  
**Start Date:** 2025-09-26  
**Owners:** MyIO UI Platform  
**Status:** Draft  
**Target Function:** openDashboardPopupAllReport  

## Summary

Implement `openDashboardPopupAllReport` using the customer totals endpoint to replace any mock/placeholder "All Report" logic with real Data API calls. This function will render a premium table UI for all devices under a customer within a selected date range, maintaining visual parity with `openDashboardPopupReport` while supporting dependency injection for local testing without network calls.

## Motivation

### Current Problems

1. **Mock Data Dependencies**: Current "All Report" logic may contain placeholder or mock data generation
2. **Customer-Level Reporting Gap**: Need operational visibility across all devices for a customer
3. **Inconsistent API Patterns**: Should align with the real API integration patterns established in `openDashboardPopupReport`
4. **Testing Limitations**: Need local testing capability without real API dependencies

### Business Impact

- **Customer-Level Insights**: Comprehensive view of energy consumption across all customer devices
- **Operational Efficiency**: Single report for all stores/devices under a customer
- **Data Accuracy**: Real telemetry data enables accurate business decisions
- **Cost Management**: Customer-wide consumption analysis for billing and optimization
- **Compliance**: Accurate customer-level reporting for regulatory requirements

## Guide-Level Explanation

### User Experience Flow

1. **Modal Launch**: User clicks "All Report" button to open customer-wide report modal
2. **Date Selection**: User selects start and end dates using existing date inputs
3. **Load Action**: User clicks "Carregar" button to fetch customer totals data
4. **Loading State**: Spinner overlay appears while fetching from Data/Ingestion API
5. **Data Display**: Table shows all customer devices with identifier, name, and consumption
6. **Sorting**: User can sort by Identificador, Nome, or Consumo (ascending/descending)
7. **Totals**: Grand total consumption displayed in sticky header row or summary box
8. **CSV Export**: User can export complete customer report with proper formatting

### API Integration

The function will call the Data/Ingestion API customer totals endpoint:
```
GET ${DATA_API_HOST}/api/v1/telemetry/customers/{customerId}/energy/devices/totals
  ?startTime={ISO-8601 with timezone offset}
  &endTime={ISO-8601 with timezone offset}
```

## Reference-Level Explanation

### HTTP Request Specification

#### URL Template
```
${DATA_API_HOST}/api/v1/telemetry/customers/{customerId}/energy/devices/totals
```

#### Query Parameters
- `startTime`: ISO-8601 timestamp with timezone offset (e.g., "2025-09-01T00:00:00-03:00")
- `endTime`: ISO-8601 timestamp with timezone offset (e.g., "2025-09-25T23:59:59-03:00")

#### Example Request
```
GET https://api.data.apps.myio-bas.com/api/v1/telemetry/customers/73d4c75d-c311-4e98-a852-10a2231007c4/energy/devices/totals?startTime=2025-09-01T00%3A00%3A00-03%3A00&endTime=2025-09-25T23%3A59%3A59-03%3A00
```

### Response Data Structure

#### Expected Response Format
```typescript
type DeviceTotal = {
  id: string;                  // Device ingestion ID
  deviceId?: string;           // Alternative device identifier
  deviceLabel?: string;        // Human-readable device label
  identifier?: string;         // Custom identifier (e.g., SCMAL1230B)
  label?: string;              // Store/device name (e.g., McDonalds)
  name?: string;               // Alternative name field
  total_value: number;         // Total consumption in kWh for the period
  totalKwh?: number;           // Alternative total field name
};

// Expected response (array or wrapped in data property)
type CustomerTotalsResponse = DeviceTotal[] | { data: DeviceTotal[] };
```

#### Example Response
```json
[
  {
    "id": "a1b2c3d4-5678-90ab-cdef-123456789012",
    "deviceLabel": "McDonalds Centro",
    "identifier": "SCMAL1230B",
    "total_value": 1250.45
  },
  {
    "id": "b2c3d4e5-6789-01bc-def0-234567890123",
    "deviceLabel": "Outback Shopping",
    "identifier": "SCOUT4567C",
    "total_value": 890.67
  }
]
```

### Data Normalization Pipeline

#### 1. Response Processing
```javascript
// Handle response format variations
const dataArray = Array.isArray(response) ? response : (response.data || []);

if (!Array.isArray(dataArray) || dataArray.length === 0) {
  console.warn("[ALL_REPORT] Customer totals API returned empty response");
  // Show empty state
  return [];
}
```

#### 2. Robust Mapping and Sorting (Fixed)
```typescript
type UiRow = { id: string; identifier: string; name: string; consumptionKwh: number };

export function mapCustomerTotalsResponse(raw: any): UiRow[] {
  const arr = Array.isArray(raw) ? raw : (raw?.data ?? []);
  if (!Array.isArray(arr)) {
    console.warn("[ALL_REPORT] Customer totals API returned invalid response format");
    return [];
  }

  return arr.map((d: any) => {
    const id = String(d.id ?? d.deviceId ?? '');
    const identifier = String(d.identifier ?? d.deviceId ?? (id ? id.slice(0, 8) : 'N/A')).toUpperCase();
    const name = String(d.deviceLabel ?? d.label ?? d.name ?? 'Dispositivo sem nome');
    const consumptionKwh = Number(d.total_value ?? d.totalKwh ?? 0);
    return { id, identifier, name, consumptionKwh };
  });
}

export function applySorting(data: UiRow[], column: keyof UiRow, reverse: boolean): UiRow[] {
  const norm = (s: string) => s?.toString().toLowerCase?.() ?? '';
  return [...data].sort((a, b) => {
    if (column === 'consumptionKwh') {
      return reverse ? b.consumptionKwh - a.consumptionKwh : a.consumptionKwh - b.consumptionKwh;
    }
    const A = column === 'identifier' ? norm(a.identifier) : norm(a.name);
    const B = column === 'identifier' ? norm(b.identifier) : norm(b.name);
    return reverse ? B.localeCompare(A, 'pt-BR') : A.localeCompare(B, 'pt-BR');
  });
}
```

### Table Structure and Sorting

#### Table Columns (Single Choice: Sticky Total Row)
```html
<table>
  <thead>
    <tr class="totals-row" style="background: #e0e0e0; font-weight: bold;">
      <td colspan="2">Total Geral:</td>
      <td style="text-align: right;">${MyIOLibrary.formatEnergy(grandTotal)}</td>
    </tr>
    <tr>
      <th class="sortable" data-sort-key="identifier">
        <span class="label">Identificador</span><span class="arrow"></span>
      </th>
      <th class="sortable" data-sort-key="name">
        <span class="label">Nome</span><span class="arrow"></span>
      </th>
      <th class="sortable" data-sort-key="consumptionKwh" style="text-align: right;">
        <span class="label">Consumo (kWh)</span><span class="arrow"></span>
      </th>
    </tr>
  </thead>
  <tbody>
    <!-- Device rows -->
  </tbody>
</table>
```

**Totals Display Decision**: A sticky "Total Geral" row immediately above the column headers, matching the device report's layout for visual parity.

#### Sorting Implementation (Consistent Type Handling)
```javascript
// Sorting state management
let sortColumn = 'name';        // Default sort by name
let sortReverse = false;        // Default ascending

// Ensure table header arrows reflect current sort on first render
function updateSortArrows() {
  document.querySelectorAll('[data-sort-key] .arrow').forEach(arrow => {
    const header = arrow.closest('[data-sort-key]');
    const key = header.getAttribute('data-sort-key');
    if (key === sortColumn) {
      arrow.textContent = sortReverse ? '↓' : '↑';
      arrow.style.opacity = '1';
    } else {
      arrow.textContent = '↕';
      arrow.style.opacity = '0.5';
    }
  });
}
```

### Dependency Injection Pattern

#### CustomerTotalsFetcher Type
```typescript
export type CustomerTotalsFetcher = (args: {
  baseUrl: string;
  customerId: string;
  startISO: string;
  endISO: string;
}) => Promise<unknown>; // raw response; mapper handles shape

export interface OpenAllReportParams {
  customerId: string;
  ui?: BaseUiCfg;
  api: BaseApiCfg;
  fetcher?: CustomerTotalsFetcher; // Optional dependency injection
}
```

#### Canonical URL Builder
```typescript
export const buildCustomerTotalsURL = (base: string, customerId: string, startISO: string, endISO: string) =>
  `${base}/api/v1/telemetry/customers/${encodeURIComponent(customerId)}/energy/devices/totals?startTime=${encodeURIComponent(startISO)}&endTime=${encodeURIComponent(endISO)}`;
```

#### Default Implementation (Preferred: Reuse Existing Auth)
```typescript
// Preferred default: reuse existing authenticated fetch (AuthClient/fetchWithAuth)
export const createDefaultCustomerTotalsFetcher = (): CustomerTotalsFetcher => {
  return async ({ baseUrl, customerId, startISO, endISO }) => {
    const url = buildCustomerTotalsURL(baseUrl, customerId, startISO, endISO);
    const res = await fetchWithAuth(url); // same helper used in openDashboardPopupReport
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  };
};

// Optional alt path if a raw token is provided (secondary, not required):
export const createTokenCustomerTotalsFetcher = (token: string): CustomerTotalsFetcher => {
  return async ({ baseUrl, customerId, startISO, endISO }) => {
    const url = buildCustomerTotalsURL(baseUrl, customerId, startISO, endISO);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  };
};
```

#### Mock Implementation for Testing
```typescript
const mockCustomerTotalsFetcher: CustomerTotalsFetcher = async ({ customerId, startISO, endISO }) => {
  console.log('[MOCK] Customer totals fetcher called:', { customerId, startISO, endISO });
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Return realistic mock data
  return [
    {
      id: 'device-001',
      identifier: 'SCMAL1230B',
      deviceLabel: 'McDonalds Centro',
      total_value: 1250.45
    },
    {
      id: 'device-002', 
      identifier: 'SCOUT4567C',
      deviceLabel: 'Outback Shopping',
      total_value: 890.67
    },
    {
      id: 'device-003',
      identifier: 'SCSUB7890D',
      deviceLabel: 'Subway Norte',
      total_value: 567.23
    },
    {
      id: 'device-004',
      // Missing identifier to test fallback
      deviceLabel: 'Loja Sem Código',
      total_value: 234.56
    }
  ];
};
```

### Implementation Structure

#### Function Signature
```javascript
function openDashboardPopupAllReport(customerId, entityType) {
  // Remove existing popup
  $("#dashboard-popup").remove();
  
  // Get customerId from parameters or settings
  const resolvedCustomerId = customerId || 
                             (self.ctx.settings && self.ctx.settings.customerId) || 
                             DEFAULT_CUSTOMER_ID;
  
  if (!resolvedCustomerId) {
    alert("customerId ausente. Configure o widget ou forneça customerId válido.");
    return;
  }
  
  // Create modal with customer totals functionality
  // ... implementation
}
```

#### Core Load Function
```javascript
// Local load button handler for All Report
$popup.off('click.allReportLoad', '#btn-load')
  .on('click.allReportLoad', '#btn-load', async () => {
    const { start, end } = allReportState;
    if (!start || !end) return alert('Selecione as datas de início e fim.');
    
    try {
      // Show loading state
      $("#loading-overlay").show();
      $("#btn-load").prop("disabled", true);
      
      // Format timestamps with timezone offset
      const startTime = toISOWithOffset(new Date(start + "T00:00:00-03:00"));
      const endTime = toISOWithOffset(new Date(end + "T23:59:59-03:00"), true);
      
      // Build Customer Totals API URL
      const baseUrl = `${DATA_API_HOST}/api/v1/telemetry/customers/${resolvedCustomerId}/energy/devices/totals`;
      const url = `${baseUrl}?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;
      
      console.log(`[ALL_REPORT] Calling Customer Totals API: ${baseUrl} with customerId=${resolvedCustomerId}`);
      
      // Fetch data using existing auth helper
      const response = await fetchWithAuth(url);
      const data = await response.json();
      
      // Process and display data
      const processedData = processCustomerTotalsResponse(data);
      updateAllReportTable(processedData);
      renderAllReportStats(processedData);
      habilitarBotaoExportAll();
      
    } catch (error) {
      console.error("[ALL_REPORT] Error fetching from Customer Totals API:", error);
      alert("Erro ao buscar dados da API. Veja console para detalhes.");
      clearAllReportData();
    } finally {
      // Always restore UI state
      $("#loading-overlay").hide();
      $("#btn-load").prop("disabled", false);
    }
  });
```

### CSV Export Format

#### CSV Structure
```
DATA EMISSÃO; DD/MM/YYYY - HH:mm
Cliente; {customerName or customerId}
Período; DD/MM/YYYY até DD/MM/YYYY
Total Geral; 1.234,56
Identificador; Nome; Consumo (kWh)
SCMAL1230B; McDonalds Centro; 1.250,45
SCOUT4567C; Outback Shopping; 890,67
SCSUB7890D; Subway Norte; 567,23
N/A; Loja Sem Código; 234,56
```

#### Export Implementation (CSV vs UI Number Formatting Consistency)
```javascript
function exportToCSVAllReport(tableData, customerId, startDate, endDate) {
  if (!tableData?.length) {
    alert("Erro: Nenhum dado disponível para exportar.");
    return;
  }
  
  const rows = [];
  const now = new Date();
  
  // Header information
  const timestamp = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()} - ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const periodStr = `${formatDateBR(startDate)} até ${formatDateBR(endDate)}`;
  const grandTotal = tableData.reduce((sum, device) => sum + device.consumptionKwh, 0);
  
  rows.push(["DATA EMISSÃO", timestamp]);
  rows.push(["Cliente", customerId]);
  rows.push(["Período", periodStr]);
  // ✅ CSV uses same formatting as UI (MyIOLibrary.formatEnergy)
  rows.push(["Total Geral", MyIOLibrary.formatEnergy(grandTotal)]);
  rows.push(["Identificador", "Nome", "Consumo (kWh)"]);
  
  // Device data rows - ensure CSV totals = on-screen totals
  tableData.forEach((device) => {
    rows.push([
      device.identifier || "N/A",
      device.name || "Dispositivo sem nome",
      MyIOLibrary.formatEnergy(device.consumptionKwh) // ✅ Same format as UI
    ]);
  });
  
  const csvContent = "data:text/csv;charset=utf-8," + rows.map(row => row.join(";")).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `all-report-${customerId}-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
```

**CSV vs UI Formatting**: Both UI and CSV use `MyIOLibrary.formatEnergy` for consistent pt-BR decimal comma formatting and semicolon delimiters.

### Error Handling Strategy

#### 1. Input Validation
```javascript
// Validate customer ID before API call
if (!customerId || typeof customerId !== 'string') {
  alert("customerId inválido ou ausente para consulta na Customer Totals API.");
  return;
}

// Validate date range
if (!start || !end) {
  alert("Selecione um período válido para o relatório.");
  return;
}
```

#### 2. HTTP Error Handling
```javascript
try {
  const response = await fetchWithAuth(url);
  const data = await response.json();
  // ... process data
} catch (error) {
  console.error("[ALL_REPORT] Error fetching from Customer Totals API:", error);
  alert("Erro ao buscar dados da API. Veja console para detalhes.");
  
  // Clear data and disable export
  clearAllReportData();
} finally {
  // Always restore UI state
  $("#loading-overlay").hide();
  $("#btn-load").prop("disabled", false);
}
```

#### 3. Empty Data Handling
```javascript
function processCustomerTotalsResponse(response) {
  const dataArray = Array.isArray(response) ? response : (response.data || []);
  
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    console.warn("[ALL_REPORT] Customer Totals API returned empty response");
    return [];
  }
  
  return dataArray.map(device => ({
    id: device.id,
    identifier: (device.identifier || device.deviceId || device.id?.slice(0, 8) || 'N/A').toUpperCase(),
    name: device.deviceLabel || device.label || device.name || 'Dispositivo sem nome',
    consumptionKwh: Number(device.total_value || device.totalKwh || 0)
  }));
}

function updateAllReportTable(data) {
  const tbody = document.getElementById("all-report-tbody");
  if (!tbody) return;
  
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="no-data">Nenhum dado disponível</td></tr>';
    return;
  }
  
  // Apply current sorting
  const sortedData = applySorting(data, sortColumn, sortReverse);
  
  tbody.innerHTML = sortedData.map((device, index) => {
    const isEven = index % 2 === 0;
    const bgColor = isEven ? '#f9f9f9' : 'white';
    
    return `
      <tr style="background-color: ${bgColor};">
        <td style="font-family: monospace; font-weight: 600;">${device.identifier}</td>
        <td>${device.name}</td>
        <td style="text-align: right;">${MyIOLibrary.formatEnergy(device.consumptionKwh)}</td>
      </tr>
    `;
  }).join('');
}
```

### Performance and Pagination Considerations

#### Single Request Strategy
- **Customer Totals Endpoint**: Returns aggregated totals per device (not raw telemetry)
- **Reasonable Scale**: Typical customer has 10-100 devices (manageable in single response)
- **Server-Side Aggregation**: API pre-aggregates daily consumption to totals
- **No Pagination Needed**: Customer device count is bounded and totals are lightweight

#### Memory and Processing
- **Lightweight Data**: Device totals are small objects (ID + label + number)
- **Client-Side Sorting**: Efficient for typical customer device counts (< 1000)
- **Minimal DOM Updates**: Table rendering is fast for reasonable device counts

### Security Considerations

#### Token Handling
- **ingestionToken Usage**: Uses `params.api.ingestionToken` for authentication
- **No Token Logging**: Tokens never logged or exposed in error messages
- **Memory-Only Storage**: Tokens handled by existing `fetchWithAuth` helper
- **Automatic Retry**: 401 responses trigger token refresh via existing auth flow

#### Input Validation
- **Customer ID Validation**: Validate customerId format before API calls
- **Date Validation**: Validate date inputs before timestamp conversion
- **XSS Prevention**: All dynamic content properly escaped in table rendering

### Testing Strategy

#### Unit Tests
```javascript
describe('openDashboardPopupAllReport Customer Totals Integration', () => {
  test('builds correct Customer Totals API URL', () => {
    const url = buildCustomerTotalsURL('customer-123', '2025-09-01', '2025-09-25');
    expect(url).toContain('/api/v1/telemetry/customers/customer-123/energy/devices/totals');
    expect(url).toContain('startTime=2025-09-01T00%3A00%3A00-03%3A00');
    expect(url).toContain('endTime=2025-09-25T23%3A59%3A59-03%3A00');
  });
  
  test('processes customer totals response correctly', () => {
    const mockResponse = [
      { id: 'dev-1', identifier: 'SCMAL123', deviceLabel: 'McDonalds', total_value: 100.5 },
      { id: 'dev-2', deviceLabel: 'Outback', total_value: 200.75 } // Missing identifier
    ];
    
    const result = processCustomerTotalsResponse(mockResponse);
    
    expect(result).toHaveLength(2);
    expect(result[0].identifier).toBe('SCMAL123');
    expect(result[1].identifier).toBe('DEV-2'); // Fallback from ID
    expect(result[0].consumptionKwh).toBe(100.5);
  });
  
  test('handles empty customer response gracefully', () => {
    const result = processCustomerTotalsResponse([]);
    expect(result).toEqual([]);
  });
  
  test('sorts by name ascending by default', () => {
    const data = [
      { name: 'Zebra Store', consumptionKwh: 100 },
      { name: 'Alpha Store', consumptionKwh: 200 }
    ];
    
    const sorted = applySorting(data, 'name', false);
    expect(sorted[0].name).toBe('Alpha Store');
    expect(sorted[1].name).toBe('Zebra Store');
  });
});
```

#### Integration Tests
```javascript
describe('Customer Totals API Integration', () => {
  test('handles successful API response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'test-device', identifier: 'TEST001', deviceLabel: 'Test Store', total_value: 150.25 }
      ])
    });
    
    global.fetch = mockFetch;
    
    const result = await fetchCustomerTotals('customer-123', '2025-09-01', '2025-09-25');
    expect(result).toHaveLength(1);
    expect(result[0].total_value).toBe(150.25);
  });
  
  test('handles API errors gracefully', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Customer Not Found'
    });
    
    global.fetch = mockFetch;
    
    await expect(fetchCustomerTotals('invalid-customer', '2025-09-01', '2025-09-25'))
      .rejects.toThrow('HTTP 404');
  });
});
```

#### Manual QA Checklist
- [ ] **Valid Customer ID**: Test with valid customerId shows real device totals
- [ ] **Invalid Customer ID**: Test with invalid ID shows appropriate error message
- [ ] **Empty Customer**: Test with customerId that has no devices shows empty state
- [ ] **Large Customer**: Test with customer having many devices (performance check)
- [ ] **Network Errors**: Test with network disconnection
- [ ] **Authentication Errors**: Test with expired/invalid ingestionToken
- [ ] **Sorting**: Verify all three columns sort correctly (asc/desc)
- [ ] **CSV Export**: Verify exported data matches displayed table with totals
- [ ] **Date Range**: Test various date ranges including edge cases
- [ ] **Mock Mode**: Verify local demo works with injected mock fetcher

### Demo Integration

#### HTML Demo Usage
```javascript
// In demos/energy.html or demos/all-report.html
function openAllReportDemo() {
  if (typeof MyIOLibrary === 'undefined') {
    alert('Library not loaded. Build the project first.');
    return;
  }
  
  // Check for mock mode via query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const useMock = urlParams.get('mock') === '1';
  
  const params = {
    customerId: 'demo-customer-123',
    api: {
      ingestionToken: 'demo-ingestion-token',
      dataApiBaseUrl: 'https://api.data.apps.myio-bas.com'
    },
    filters: {
      excludeLabels: [
        /bomba.*secund[aá]ria/i,
        /^administra[cç][aã]o\s*[12]$/i,
        /chiller/i,
        /^entrada\b/i
      ]
    }
  };
  
  // Inject mock fetcher if in mock mode
  if (useMock) {
    params.fetcher = mockCustomerTotalsFetcher;
  }
  
  MyIOLibrary.openDashboardPopupAllReport(params);
}

// Enable mock mode: demos/energy.html?mock=1
```

## Drawbacks

### Network Dependency
- **API Availability**: Function depends on Customer Totals API availability
- **Network Latency**: Real API calls introduce loading time vs instant mock data
- **Rate Limiting**: Potential for API rate limiting with frequent customer-wide requests

### Scale Considerations
- **Large Customers**: Customers with hundreds of devices may impact performance
- **Memory Usage**: Large device lists consume more client-side memory
- **Rendering Performance**: Table rendering may be slower for very large datasets

### Error States
- **Authentication Failures**: ingestionToken expiration or invalid credentials
- **Customer Not Found**: Invalid customerId or access permissions
- **Network Failures**: Connection timeouts or API unavailability

## Rationale and Alternatives

### Why Customer Totals Endpoint?
1. **Aggregated Data**: Server-side aggregation is more efficient than client-side rollup
2. **Single Request**: One API call vs multiple device-specific calls
3. **Consistent Totals**: Server ensures consistent aggregation logic
4. **Performance**: Pre-calculated totals are faster than raw telemetry aggregation

### Alternative Approaches Considered

#### 1. Multiple Device Report Calls
```javascript
// Alternative: Call device report for each device
const devicePromises = devices.map(device => 
  fetchDeviceReport(device.ingestionId, startTime, endTime)
);
const allReports = await Promise.all(devicePromises);
const customerTotal = aggregateDeviceReports(allReports);
```
**Rejected because:**
- Inefficient: N API calls vs 1 customer totals call
- Rate limiting risk with many concurrent requests
- Complex error handling for partial failures
- Inconsistent aggregation logic

#### 2. ThingsBoard Customer Aggregation
```javascript
// Alternative: Use ThingsBoard's customer-level telemetry
const url = `/api/plugins/telemetry/CUSTOMER/${customerId}/values/timeseries?keys=totalConsumption&startTs=${startTs}&endTs=${endTs}`;
```
**Rejected because:**
- Requires ThingsBoard-specific aggregation setup
- Less flexible than Data API approach
- Inconsistent with library patterns
- May not have device-level breakdown

#### 3. Client-Side Aggregation
```javascript
// Alternative: Fetch all devices, aggregate client-side
const allDevices = await fetchAllCustomerDevices(customerId);
const deviceTotals = await Promise.all(
  allDevices.map(device => fetchDeviceTotals(device.id, startTime, endTime))
);
const aggregated = aggregateClientSide(deviceTotals);
```
**Rejected because:**
- Inefficient network usage (many requests)
- Complex client-side aggregation logic
- Potential for inconsistent results
- Higher memory usage

## Prior Art

### DeviceReportModal Reference
The modern library implementation in `src/components/premium-modals/report-device/DeviceReportModal.ts` provides the dependency injection pattern:

```typescript
// Pattern to follow for All Report Modal
export class AllReportModal {
  private customerTotalsFetcher: CustomerTotalsFetcher;

  constructor(private params: OpenAllReportParams) {
    this.customerTotalsFetcher = params.fetcher || createDefaultCustomerTotalsFetcher(params);
  }

  private async loadData(): Promise<void> {
    const apiResponse = await this.customerTotalsFetcher({
      baseUrl: this.params.api.dataApiBaseUrl || 'https://api.data.apps.myio-bas.com',
      customerId: this.params.customerId,
      startISO,
      endISO
    });
    
    this.data = this.processApiResponse(apiResponse);
    this.renderTable();
  }
}
```

### Legacy Controller Pattern
The `openDashboardPopupReport` implementation provides the UI/UX pattern to follow:

```javascript
// Existing pattern in controller.js
function openDashboardPopupReport(entityId, entityType, ...) {
  // Local state management
  const reportState = { start: '', end: '' };
  
  // Local load button handler
  $popup.off('click.reportLoad', '#btn-load')
    .on('click.reportLoad', '#btn-load', async () => {
      // API call with error handling
      // Data processing with zero-filling
      // UI updates with loading states
    });
}
```

## Unresolved Questions

### API Response Format
1. **Response Wrapper**: Does the API return `DeviceTotal[]` directly or wrapped in `{ data: DeviceTotal[] }`?
   - **Impact**: Affects response processing logic
   - **Recommendation**: Support both formats for robustness

2. **Field Names**: Are totals in `total_value`, `totalKwh`, or other field names?
   - **Impact**: Affects data extraction logic
   - **Recommendation**: Implement fallback chain for common field names

3. **Pagination**: Does the customer totals endpoint paginate large customer device lists?
   - **Impact**: May need pagination handling for large customers
   - **Recommendation**: Start without pagination, add if needed

### UI/UX Decisions
1. **Totals Display**: Should grand total be in sticky header row or summary box above table?
   - **Recommendation**: Sticky header row for consistency with device report

2. **Default Sorting**: Sort by name, identifier, or consumption by default?
   - **Recommendation**: Sort by name ascending for alphabetical browsing

3. **Device Filtering**: Should we apply the same label filters as the main dashboard?
   - **Recommendation**: Yes, exclude administrative devices by default

### Performance Optimization
1. **Large Customers**: How to handle customers with 500+ devices?
   - **Options**: Virtual scrolling, pagination, or server-side filtering
   - **Recommendation**: Monitor usage and implement if needed

2. **Caching**: Should we cache customer totals responses?
   - **Pro**: Faster subsequent loads
   - **Con**: Stale data concerns
   - **Recommendation**: No caching initially, add if performance issues arise

## Future Possibilities

### Enhanced Filtering and Grouping
- **Device Type Filters**: Filter by device categories (stores, infrastructure, etc.)
- **Geographic Grouping**: Group devices by region, city, or store cluster
- **Consumption Thresholds**: Filter devices above/below consumption thresholds
- **Time-based Comparisons**: Show period-over-period changes

### Advanced Analytics
- **Trend Analysis**: Identify consumption patterns and anomalies across customer devices
- **Benchmarking**: Compare device performance against customer averages
- **Forecasting**: Predict future consumption based on historical customer data
- **Cost Analysis**: Calculate costs and savings opportunities

### Export Enhancements
- **Excel Export**: Rich formatting with charts, pivot tables, and customer metadata
- **PDF Reports**: Formatted customer reports with executive summaries
- **Scheduled Reports**: Automated periodic customer reports via email
- **API Integration**: Export data to external business intelligence tools

### Multi-Metric Support
- **Water Consumption**: Extend to water telemetry for comprehensive utility reporting
- **Temperature Monitoring**: Include HVAC and temperature sensor data
- **Demand Profiles**: Show peak demand patterns across customer devices
- **Multi-Utility Dashboard**: Combined energy, water, and gas reporting

### Performance Optimizations
- **Virtual Scrolling**: Handle customers with thousands of devices
- **Server-Side Filtering**: Push filtering logic to API for better performance
- **Real-Time Updates**: Live consumption updates for operational monitoring
- **Caching Strategies**: Smart caching with invalidation for frequently accessed data

## Security Considerations

### Authentication and Authorization
- **Token Security**: Uses `ingestionToken` from API parameters, never hardcoded
- **Customer Access Control**: Validate user permissions for customer data access
- **Rate Limiting**: Respect API rate limits to prevent abuse
- **Audit Logging**: Log customer report access for compliance

### Data Protection
- **No Token Logging**: Authentication tokens never logged or exposed
- **Error Sanitization**: Error messages don't expose sensitive customer information
- **XSS Prevention**: All dynamic content properly escaped in table rendering
- **Memory Management**: Clear sensitive data when modal closes

### Input Validation
- **Customer ID Validation**: Validate customerId format and permissions
- **Date Range Validation**: Ensure reasonable date ranges to prevent abuse
- **SQL Injection Prevention**: All parameters properly encoded for API calls

## Migration Strategy

### Phase 1: Remove Mock Data
1. **Identify Mock Logic**: Locate any existing mock/placeholder data in All Report flow
2. **Replace with API Calls**: Implement real Customer Totals API integration
3. **Maintain UI Compatibility**: Keep existing modal structure and styling

### Phase 2: Add Dependency Injection
1. **Implement Fetcher Pattern**: Add CustomerTotalsFetcher type and default implementation
2. **Enable Local Testing**: Support mock fetcher injection for demos
3. **Backward Compatibility**: Ensure existing calls work without fetcher parameter

### Phase 3: Enhanced Features
1. **Improve Error Handling**: Add comprehensive error states and recovery
2. **Performance Optimization**: Optimize for large customer device lists
3. **Enhanced Filtering**: Add device filtering and exclusion logic

### Rollback Plan
If issues arise during migration, implement feature flag for emergency rollback:

```javascript
const USE_CUSTOMER_TOTALS_API = true; // Emergency rollback flag

if (USE_CUSTOMER_TOTALS_API) {
  // New Customer Totals API integration
  await fetchCustomerTotalsFromAPI(customerId, startTime, endTime);
} else {
  // Fallback to previous implementation
  await fetchLegacyAllReportData(customerId, startTime, endTime);
}
```

## Acceptance Criteria

### Functional Requirements
- ✅ **Mock Removal**: All mock/placeholder data generation completely removed from All Report flow
- ✅ **API Integration**: Uses exact Customer Totals endpoint with required parameters
- ✅ **Authentication**: Uses `ingestionToken` from API parameters for Customer Totals API
- ✅ **Timezone Handling**: Start/End times use ISO-8601 with -03:00 offset
- ✅ **Customer Validation**: Validates customerId and shows user-friendly error for invalid IDs
- ✅ **Empty Data Handling**: Empty customer results in "Nenhum dado disponível" state
- ✅ **Table Structure**: Three columns (Identificador, Nome, Consumo) with proper formatting
- ✅ **Sorting**: All three columns sortable (asc/desc) with visual arrow indicators
- ✅ **Totals Display**: Grand total shown in sticky header row or summary box
- ✅ **CSV Export**: Export functionality works with real data and proper Brazilian formatting

### UI/UX Requirements
- ✅ **Loading States**: Spinner overlay and button disabled states work correctly
- ✅ **Error Handling**: User-friendly error messages for API failures
- ✅ **Visual Parity**: Matches legacy modal style and structure
- ✅ **Date Handling**: Existing date input behavior preserved
- ✅ **Responsive Design**: Modal works on mobile and desktop devices

### Technical Requirements
- ✅ **Dependency Injection**: Supports fetcher injection for local testing
- ✅ **Backward Compatibility**: Works without fetcher parameter (defaults to real API)
- ✅ **Error Recovery**: Graceful handling of network and API errors
- ✅ **Memory Management**: Proper cleanup of resources and event handlers
- ✅ **Performance**: Efficient data processing for typical customer device counts
- ✅ **Type Safety**: Full TypeScript support with proper interfaces (for library components)

### Security Requirements
- ✅ **Token Security**: Uses `ingestionToken` from parameters, not hardcoded
- ✅ **Input Validation**: All inputs validated before API calls
- ✅ **Error Sanitization**: Error messages don't expose sensitive information
- ✅ **XSS Prevention**: All dynamic content properly escaped

### Testing Requirements
- ✅ **Unit Tests**: Data processing, sorting, and CSV formatting functions tested
- ✅ **Integration Tests**: API integration with mock responses tested
- ✅ **Manual QA**: All scenarios in QA checklist validated
- ✅ **Demo Testing**: Local demo works with mock fetcher injection
- ✅ **Performance Testing**: Large customer device lists handled gracefully

## Implementation Timeline

### Week 1: Core API Integration
- **Day 1**: Remove existing mock data and implement Customer Totals API call
- **Day 2**: Add data processing pipeline (response parsing, fallbacks, sorting)
- **Day 3**: Implement table rendering with proper column structure
- **Day 4**: Add comprehensive error handling and validation
- **Day 5**: Test with real Customer Totals API and various edge cases

### Week 2: Dependency Injection and Testing
- **Day 1**: Implement CustomerTotalsFetcher type and dependency injection
- **Day 2**: Create mock fetcher for local testing and demos
- **Day 3**: Add unit tests for data processing and sorting functions
- **Day 4**: Create integration tests for API calls and error handling
- **Day 5**: Manual QA testing with various customer scenarios

### Week 3: Polish and Deployment
- **Day 1**: Implement CSV export with proper formatting
- **Day 2**: Add sorting functionality with visual indicators
- **Day 3**: Performance testing and optimization for large customers
- **Day 4**: Final testing and bug fixes
- **Day 5**: Production deployment and monitoring

## Conclusion

This RFC specifies the complete implementation of `openDashboardPopupAllReport` using the Customer Totals API endpoint. The implementation will provide accurate customer-level energy reporting while maintaining visual parity with existing modal components and supporting comprehensive testing through dependency injection.

**Key Benefits:**
- ✅ **Accurate Customer Data**: Real telemetry totals replace any mock data
- ✅ **Operational Value**: Enables customer-wide energy management decisions
- ✅ **Consistent Experience**: Aligns with `openDashboardPopupReport` patterns
- ✅ **Testable Architecture**: Mock injection enables comprehensive local testing
- ✅ **Production Ready**: Robust error handling and performance optimization

**Expected Impact:**
- 📈 **100% real customer data** vs any existing mock/placeholder data
- 📈 **Customer-level operational reporting** for energy management
- 📈 **Consistent user experience** across all report modal components
- 📈 **Foundation for advanced customer analytics** and reporting features

This implementation transforms the All Report functionality from any mock/placeholder state into a production-ready customer reporting tool that provides accurate, actionable insights for energy management across all customer devices.
