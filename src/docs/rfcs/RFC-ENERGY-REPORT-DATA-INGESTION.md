# RFC: Energy Report Data Ingestion API Integration

**Feature Name:** energy-report-data-ingestion-api-integration  
**Start Date:** 2025-09-26  
**Owners:** MyIO UI Platform  
**Status:** Draft  
**Target Function:** openDashboardPopupReport  

## Summary

Replace the mock data generation in the legacy ThingsBoard `openDashboardPopupReport` function with real Data/Ingestion API calls to fetch daily energy consumption telemetry. This refactor eliminates placeholder data and provides accurate operational reporting while maintaining the existing UI/UX behavior, date handling, sorting, totals calculation, CSV export, and error handling patterns.

## Motivation

### Current Problems

1. **Mock Data Generation**: The function currently generates fake consumption data instead of fetching real telemetry
2. **Operational Reporting Needs**: Users require accurate historical consumption data for business decisions
3. **Data Consistency**: Mock data doesn't reflect actual device behavior or consumption patterns
4. **Library Alignment**: The legacy controller should match the patterns used in `DeviceReportModal.ts` for consistency

### Business Impact

- **Accurate Reporting**: Real consumption data enables proper energy management decisions
- **Operational Visibility**: Historical trends help identify consumption anomalies and optimization opportunities
- **Compliance**: Accurate data supports regulatory reporting and energy audits
- **Cost Management**: Real consumption data enables accurate cost allocation and billing

## Guide-Level Explanation

### User Experience Flow

1. **Date Selection**: User selects start and end dates using the existing date inputs
2. **Load Action**: User clicks "Carregar" button to fetch data
3. **Loading State**: Spinner overlay appears while fetching data from Data/Ingestion API
4. **Data Display**: Table shows daily consumption rows with proper formatting
5. **Totals**: Total consumption is calculated and displayed in the header row
6. **Sorting**: User can sort by date or consumption (ascending/descending)
7. **CSV Export**: User can export the data with proper Brazilian formatting and timestamps

### API Integration

The function will call the Data/Ingestion API endpoint:
```
GET ${DATA_API_HOST}/api/v1/telemetry/devices/{entityIngestionId}/energy
  ?startTime={ISO-8601 with timezone offset}
  &endTime={ISO-8601 with timezone offset}
  &granularity=1d
  &page=1
  &pageSize=1000
  &deep=0
```

## Reference-Level Explanation

### HTTP Request Specification

#### URL Template
```
${DATA_API_HOST}/api/v1/telemetry/devices/{entityIngestionId}/energy
```

#### Query Parameters
- `startTime`: ISO-8601 timestamp with timezone offset (e.g., "2025-09-01T00:00:00-03:00")
- `endTime`: ISO-8601 timestamp with timezone offset (e.g., "2025-09-25T23:59:59-03:00")
- `granularity`: Fixed value "1d" for daily aggregation
- `page`: Fixed value "1" for first page
- `pageSize`: Fixed value "1000" (sufficient for 31 days @ 1d granularity)
- `deep`: Fixed value "0" (device-level data only)

#### Example Request
```
GET https://api.data.apps.myio-bas.com/api/v1/telemetry/devices/a1b2c3d4-5678-90ab-cdef-123456789012/energy?startTime=2025-09-01T00%3A00%3A00-03%3A00&endTime=2025-09-25T23%3A59%3A59-03%3A00&granularity=1d&page=1&pageSize=1000&deep=0
```

### Authentication Strategy

Uses existing `fetchWithAuth(url)` helper that:
1. Calls `MyIOAuth.getToken()` to get cached or fresh bearer token
2. Includes `Authorization: Bearer ${token}` header
3. Handles 401 responses with automatic token refresh and retry
4. Throws meaningful errors for non-OK responses

### Response Data Structure

#### Expected Response Format
```typescript
interface EnergyTelemetryResponse {
  data: Array<{
    id: string;           // Device ingestion ID
    label?: string;       // Device label
    consumption: Array<{
      timestamp: string;  // ISO-8601 timestamp
      value: number;      // Consumption value in kWh
    }>;
  }>;
  pagination?: {
    page: number;
    pages: number;
    total: number;
  };
}
```

#### Example Response
```json
{
  "data": [
    {
      "id": "a1b2c3d4-5678-90ab-cdef-123456789012",
      "label": "Entrada Subestação",
      "consumption": [
        { "timestamp": "2025-09-01T00:00:00-03:00", "value": 125.45 },
        { "timestamp": "2025-09-02T00:00:00-03:00", "value": 134.67 },
        { "timestamp": "2025-09-03T00:00:00-03:00", "value": 118.23 }
      ]
    }
  ]
}
```

### Data Normalization Pipeline

#### 1. Timezone Rules and ISO Formatting
```javascript
// Start boundary: beginning of day in São Paulo timezone
const startTime = toISOWithOffset(new Date(start + "T00:00:00-03:00"));
// "2025-09-01T00:00:00-03:00"

// End boundary: end of day in São Paulo timezone  
const endTime = toISOWithOffset(new Date(end + "T23:59:59-03:00"), true);
// "2025-09-25T23:59:59-03:00"
```

#### 2. Daily Map Construction
```javascript
// Build map of daily consumption values
const dailyMap = {};
let totalConsumption = 0;

consumption.forEach((item) => {
  if (item.timestamp && item.value != null) {
    const date = item.timestamp.slice(0, 10); // Extract YYYY-MM-DD
    const value = Number(item.value);
    if (!dailyMap[date]) dailyMap[date] = 0;
    dailyMap[date] += value;
    totalConsumption += value;
  }
});
```

#### 3. Complete Date Range Generation
```javascript
// Generate complete date range (inclusive)
const dateRange = getDateRangeArray(start, end);

// Zero-fill missing dates
const reportData = dateRange.map((dateStr) => {
  const [ano, mes, dia] = dateStr.split("-");
  return {
    date: `${dia}/${mes}/${ano}`,           // Brazilian format for display
    consumptionKwh: dailyMap[dateStr] || 0  // Zero-fill missing dates
  };
});
```

#### 4. UI State Updates
```javascript
// Update global scope for compatibility
self.ctx.$scope.reportData = reportData;
self.ctx.$scope.totalConsumption = totalConsumption;
self.ctx.$scope.insueDate = insueDate;

// Update UI elements
document.getElementById("total-consumo").textContent = MyIOLibrary.formatEnergy(totalConsumption);
document.getElementById("inssueDate").textContent = insueDate;

// Enable CSV export button
habilitarBotaoExport();
```

### Error Handling

#### 1. Input Validation
```javascript
// Validate ingestion ID before API call
if (!entityIngestionId || !isValidUUID(entityIngestionId)) {
  alert("Dispositivo não possui ingestionId válido para consulta na Data API.");
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
  console.error("[REPORT] Error fetching from Data API:", error);
  alert("Erro ao buscar dados da API. Veja console para detalhes.");
  
  // Clear data on error
  self.ctx.$scope.reportData = [];
  self.ctx.$scope.totalConsumption = 0;
  updateTable();
} finally {
  // Always restore UI state
  $("#loading-overlay").hide();
  $("#btn-load").prop("disabled", false);
}
```

#### 3. Empty Data Handling
```javascript
// Handle empty or malformed response
if (!Array.isArray(data) || data.length === 0) {
  console.warn("[REPORT] Data API returned empty or invalid response");
  self.ctx.$scope.reportData = [];
  self.ctx.$scope.totalConsumption = 0;
  updateTable();
  return;
}

const deviceData = data[0]; // First device
const consumption = deviceData.consumption || [];

// Zero-fill if no consumption data
if (consumption.length === 0) {
  console.warn("[REPORT] No consumption data in response, zero-filling date range");
}
```

### Performance and Pagination Considerations

#### Why page=1&pageSize=1000 is Sufficient
- **Daily Granularity**: Maximum 31 days in a month = 31 data points
- **Single Device**: Only one device per report modal
- **Reasonable Buffer**: 1000 page size provides ample headroom
- **Network Efficiency**: Single request vs multiple paginated calls

#### Memory and Processing
- **Lightweight Data**: Daily aggregates are small (31 numbers max)
- **Client-Side Processing**: Date range generation and zero-filling are fast operations
- **Minimal DOM Updates**: Table rendering is efficient for small datasets

### Security Considerations

#### Token Handling
- **No Token Logging**: Tokens are never logged or exposed in console output
- **Memory-Only Storage**: Tokens stored in memory cache, cleared on modal close
- **Automatic Refresh**: 401 responses trigger automatic token refresh

#### Error Logging
- **Safe Error Messages**: User-facing errors don't expose sensitive information
- **Debug Information**: Console logs include request details but no authentication data
- **Graceful Degradation**: Errors result in empty tables, not application crashes

#### Input Validation
- **UUID Validation**: Ingestion IDs are validated before API calls
- **Date Validation**: Date inputs are validated before timestamp conversion
- **XSS Prevention**: All dynamic content is properly escaped

### Testing Strategy

#### Unit Tests
```javascript
describe('openDashboardPopupReport Data Integration', () => {
  test('builds correct API URL with timezone offsets', () => {
    const url = buildDataAPIUrl('test-id', '2025-09-01', '2025-09-25');
    expect(url).toContain('startTime=2025-09-01T00%3A00%3A00-03%3A00');
    expect(url).toContain('endTime=2025-09-25T23%3A59%3A59-03%3A00');
  });
  
  test('zero-fills missing dates in range', () => {
    const consumption = [
      { timestamp: '2025-09-01T00:00:00-03:00', value: 100 },
      { timestamp: '2025-09-03T00:00:00-03:00', value: 150 }
    ];
    
    const result = processConsumptionData(consumption, '2025-09-01', '2025-09-03');
    
    expect(result).toHaveLength(3);
    expect(result[1].consumptionKwh).toBe(0); // Missing 2025-09-02
  });
  
  test('handles invalid UUID gracefully', () => {
    const consoleSpy = jest.spyOn(window, 'alert');
    openDashboardPopupReport('invalid-id', 'DEVICE', 1, 'gw-1', 'invalid-uuid', 'Test', 0, {});
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ingestionId válido'));
  });
});
```

#### Integration Tests
```javascript
describe('Data API Integration', () => {
  test('handles successful API response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{
          id: 'test-id',
          consumption: [
            { timestamp: '2025-09-01T00:00:00-03:00', value: 100 }
          ]
        }]
      })
    });
    
    global.fetch = mockFetch;
    
    // Test API call
    const result = await fetchEnergyTelemetry('test-id', '2025-09-01', '2025-09-01');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].consumption).toHaveLength(1);
  });
  
  test('handles API errors gracefully', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });
    
    global.fetch = mockFetch;
    
    await expect(fetchEnergyTelemetry('test-id', '2025-09-01', '2025-09-01'))
      .rejects.toThrow('HTTP 500');
  });
});
```

#### Manual QA Checklist
- [ ] **Valid UUID**: Test with valid ingestion ID shows real data
- [ ] **Invalid UUID**: Test with invalid ID shows appropriate error message
- [ ] **Empty API Response**: Test with date range that has no data shows zero-filled table
- [ ] **Partial Days**: Test with date range that has some missing days
- [ ] **DST Boundaries**: Test across daylight saving time transitions
- [ ] **Large Ranges**: Test with maximum 31-day range
- [ ] **Network Errors**: Test with network disconnection
- [ ] **Authentication Errors**: Test with expired/invalid tokens
- [ ] **CSV Export**: Verify exported data matches displayed table
- [ ] **Sorting**: Verify both date and consumption sorting work correctly

### Migration Strategy

#### Phase 1: Remove Mock Data Generation
1. Identify and remove the mock data generation block
2. Replace with real API call using existing `fetchWithAuth` helper
3. Maintain exact same data structure for UI compatibility

#### Phase 2: Data Processing Pipeline
1. Parse API response and extract consumption array
2. Build daily consumption map from timestamp/value pairs
3. Generate complete date range with zero-filling for missing dates
4. Calculate total consumption for header display

#### Phase 3: Error Handling Enhancement
1. Add comprehensive error handling for API failures
2. Implement graceful degradation for empty responses
3. Maintain existing spinner and button state management

#### Rollback Plan
If issues arise, a feature flag can temporarily re-enable mock data:
```javascript
const USE_MOCK_DATA = false; // Emergency rollback flag

if (USE_MOCK_DATA) {
  // Original mock generation code
} else {
  // New API integration code
}
```

### Dependency Injection for Testing

To enable local testing without API calls, implement dependency injection in `DeviceReportModal`:

#### Enhanced Constructor
```typescript
type EnergyFetcher = (args: {
  baseUrl: string;
  ingestionId: string;
  startISO: string;
  endISO: string;
}) => Promise<any[]>;

export class DeviceReportModal {
  constructor(private params: OpenDeviceReportParams & { fetcher?: EnergyFetcher }) {
    // Use injected fetcher or default to real API
    this.energyFetcher = params.fetcher || defaultEnergyFetcher;
  }

  private async loadFromApi(startISO: string, endISO: string) {
    return this.energyFetcher({
      baseUrl: this.params.api.dataApiBaseUrl || DATA_API_HOST,
      ingestionId: this.params.ingestionId,
      startISO,
      endISO
    });
  }
}
```

#### Default Implementation
```typescript
const defaultEnergyFetcher: EnergyFetcher = async ({ baseUrl, ingestionId, startISO, endISO }) => {
  const url = `${baseUrl}/api/v1/telemetry/devices/${ingestionId}/energy?startTime=${encodeURIComponent(startISO)}&endTime=${encodeURIComponent(endISO)}&granularity=1d&page=1&pageSize=1000&deep=0`;
  
  const response = await fetchWithAuth(url);
  return response.json();
};
```

#### Mock Implementation for Testing
```typescript
const mockEnergyFetcher: EnergyFetcher = async () => {
  // Return static test data
  return {
    data: [{
      id: 'mock-device',
      consumption: [
        { timestamp: '2025-09-01T00:00:00-03:00', value: 125.45 },
        { timestamp: '2025-09-02T00:00:00-03:00', value: 134.67 },
        { timestamp: '2025-09-03T00:00:00-03:00', value: 118.23 }
      ]
    }]
  };
};
```

#### Demo Usage
```javascript
// In demos/energy.html
const modal = new DeviceReportModal({
  ingestionId: 'demo-ingestion-123',
  identifier: 'ENTRADA-001',
  label: 'Outback',
  api: { /* ... */ },
  fetcher: mockEnergyFetcher // Inject mock for local testing
});
```

### Implementation Details

#### Current Mock Generation (To Remove)
```javascript
// REMOVE: This entire block generates fake data
const reportData = dateRange.map((dateStr) => {
  const [ano, mes, dia] = dateStr.split("-");
  return {
    date: `${dia}/${mes}/${ano}`,
    consumptionKwh: Math.random() * 50 + 10 // FAKE DATA
  };
});
```

#### New API Integration (To Add)
```javascript
// ADD: Real API call and data processing
try {
  // Format timestamps with timezone offset
  const startTime = toISOWithOffset(new Date(start + "T00:00:00-03:00"));
  const endTime = toISOWithOffset(new Date(end + "T23:59:59-03:00"), true);

  // Build Data API URL
  const url = `${DATA_API_HOST}/api/v1/telemetry/devices/${entityIngestionId}/energy?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&granularity=1d&page=1&pageSize=1000&deep=0`;

  // Fetch data using existing auth helper
  const response = await fetchWithAuth(url);
  const data = await response.json();

  // Process response
  if (!Array.isArray(data) || data.length === 0) {
    console.warn("[REPORT] Data API returned empty response");
    // Zero-fill the date range
    const reportData = dateRange.map((dateStr) => {
      const [ano, mes, dia] = dateStr.split("-");
      return {
        date: `${dia}/${mes}/${ano}`,
        consumptionKwh: 0
      };
    });
    self.ctx.$scope.reportData = reportData;
    self.ctx.$scope.totalConsumption = 0;
    updateTable();
    return;
  }

  // Extract consumption data from first device
  const deviceData = data[0];
  const consumption = deviceData.consumption || [];

  // Build daily consumption map
  const dailyMap = {};
  let totalConsumption = 0;

  consumption.forEach((item) => {
    if (item.timestamp && item.value != null) {
      const date = item.timestamp.slice(0, 10); // Extract YYYY-MM-DD
      const value = Number(item.value);
      if (!dailyMap[date]) dailyMap[date] = 0;
      dailyMap[date] += value;
      totalConsumption += value;
    }
  });

  // Generate complete date range with zero-fill
  const dateRange = getDateRangeArray(start, end);
  const reportData = dateRange.map((dateStr) => {
    const [ano, mes, dia] = dateStr.split("-");
    return {
      date: `${dia}/${mes}/${ano}`,
      consumptionKwh: dailyMap[dateStr] || 0
    };
  });

  // Update UI state
  self.ctx.$scope.reportData = reportData;
  self.ctx.$scope.totalConsumption = totalConsumption;
  
  // Update DOM elements
  document.getElementById("total-consumo").textContent = MyIOLibrary.formatEnergy(totalConsumption);
  document.getElementById("inssueDate").textContent = insueDate;
  
  // Refresh table and enable export
  updateTable();
  habilitarBotaoExport();
  
} catch (error) {
  console.error("[REPORT] Error fetching from Data API:", error);
  alert("Erro ao buscar dados da API. Veja console para detalhes.");
  
  // Clear data on error
  self.ctx.$scope.reportData = [];
  self.ctx.$scope.totalConsumption = 0;
  updateTable();
} finally {
  // Always restore UI state
  $("#loading-overlay").hide();
  $("#btn-load").prop("disabled", false);
}
```

## Drawbacks

### Network Dependency
- **API Availability**: Function now depends on Data/Ingestion API availability
- **Network Latency**: Real API calls introduce loading time vs instant mock data
- **Rate Limiting**: Potential for API rate limiting with frequent requests

### Error States
- **Authentication Failures**: Token expiration or invalid credentials
- **Network Failures**: Connection timeouts or network unavailability
- **Data Inconsistencies**: Potential for missing or malformed telemetry data

### Operational Complexity
- **Monitoring**: Need to monitor API health and response times
- **Debugging**: Real data makes debugging more complex than predictable mock data
- **Dependencies**: Function now depends on external service availability

## Rationale and Alternatives

### Why Data/Ingestion API?
1. **Authoritative Source**: Single source of truth for telemetry data
2. **Consistent Aggregation**: Server-side daily aggregation ensures consistency
3. **Performance**: Pre-aggregated daily data is efficient for reporting
4. **Scalability**: API handles pagination and large datasets

### Alternative Approaches Considered

#### 1. ThingsBoard Telemetry API
```javascript
// Alternative: Direct ThingsBoard API
const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=consumption&startTs=${startTs}&endTs=${endTs}`;
```
**Rejected because:**
- Requires raw telemetry processing and aggregation
- Less efficient for daily reporting needs
- Inconsistent with library patterns

#### 2. Client-Side Aggregation
```javascript
// Alternative: Fetch raw data and aggregate client-side
const rawData = await fetchRawTelemetry(deviceId, startTs, endTs);
const dailyAggregates = aggregateByDay(rawData);
```
**Rejected because:**
- Inefficient for large datasets
- Duplicates server-side aggregation logic
- Increases client-side processing burden

#### 3. Hybrid Approach
```javascript
// Alternative: Cache + real-time updates
const cachedData = await getCachedDailyData(deviceId, start, end);
const realtimeData = await getRealtimeUpdates(deviceId);
const mergedData = mergeCacheWithRealtime(cachedData, realtimeData);
```
**Rejected because:**
- Adds unnecessary complexity for reporting use case
- Cache invalidation complexity
- Not required for daily reporting granularity

## Prior Art

### DeviceReportModal Reference
The modern library implementation in `src/components/premium-modals/report-device/DeviceReportModal.ts` provides the pattern to follow:

```typescript
// Modern approach with proper error handling
private async loadData(): Promise<void> {
  try {
    const { startISO, endISO } = this.dateRangePicker.getDates();
    
    // Real API call would go here
    const mockData = this.generateMockData(dateRange);
    
    this.data = mockData;
    this.renderTable();
    
  } catch (error) {
    this.showError('Erro ao carregar dados: ' + error.message);
  } finally {
    this.isLoading = false;
  }
}
```

### Existing Helper Functions
The controller already includes several helpers that should be reused:
- `fetchWithAuth(url)` - Authenticated API calls with retry logic
- `toISOWithOffset(date, endOfDay)` - Timezone-aware ISO formatting
- `isValidUUID(str)` - UUID validation
- `getDateRangeArray(start, end)` - Date range generation
- `MyIOAuth.getToken()` - Token management

## Unresolved Questions

### API Parameters
1. **Deep Parameter**: Should we use `deep=0` or `deep=1`? 
   - `deep=0`: Device-level aggregation only
   - `deep=1`: Include sub-device breakdowns
   - **Recommendation**: Start with `deep=0` for simplicity

2. **Granularity Options**: Should we support other granularities?
   - Current: Fixed `1d` for daily reports
   - Future: Could parameterize for hourly/weekly views
   - **Recommendation**: Keep `1d` for now, add parameterization later

3. **Multi-Device Support**: How to handle multiple devices in future?
   - Current: Single device per report modal
   - Future: Aggregate multiple devices
   - **Recommendation**: Single device for now, design for extensibility

### Performance Optimization
1. **Caching Strategy**: Should we cache API responses?
   - Pro: Faster subsequent loads
   - Con: Stale data concerns
   - **Recommendation**: No caching initially, add if needed

2. **Pagination**: When to implement pagination?
   - Current: 1000 page size sufficient for daily data
   - Future: May need pagination for hourly granularity
   - **Recommendation**: Monitor usage and implement if needed

## Future Possibilities

### Enhanced Granularity
- **Hourly Reports**: Support `granularity=1h` for detailed analysis
- **Weekly/Monthly**: Support `granularity=1w` and `granularity=1M` for trends
- **Custom Intervals**: Allow user-defined granularity selection

### Multi-Device Aggregation
- **Device Groups**: Aggregate consumption across device groups
- **Store-Level Totals**: Roll up all devices within a store
- **Comparative Analysis**: Side-by-side device comparisons

### Advanced Analytics
- **Trend Analysis**: Identify consumption patterns and anomalies
- **Forecasting**: Predict future consumption based on historical data
- **Benchmarking**: Compare against similar devices or time periods

### Export Enhancements
- **Excel Export**: Rich formatting with charts and metadata
- **PDF Reports**: Formatted reports with charts and analysis
- **Streaming Export**: Handle large datasets with streaming CSV

### Water/Temperature Parity
- **Water Consumption**: Extend pattern to water telemetry endpoints
- **Temperature Monitoring**: Support temperature sensor data
- **Multi-Metric Reports**: Combined energy, water, and temperature reports

## Acceptance Criteria

### Functional Requirements
- ✅ **Mock Removal**: All mock data generation is completely removed
- ✅ **API Integration**: Uses exact URL pattern with required parameters
- ✅ **Timezone Handling**: Start/End times use ISO-8601 with -03:00 offset
- ✅ **UUID Validation**: Validates entityIngestionId and shows user-friendly error for invalid IDs
- ✅ **Zero-Fill**: Empty/missing data results in zero-filled date range (no crashes)
- ✅ **Totals Accuracy**: Total calculation matches displayed table data
- ✅ **CSV Export**: Export functionality works with real data and proper formatting
- ✅ **Sorting**: Both date and consumption sorting continue to work correctly

### UI/UX Requirements
- ✅ **Loading States**: Spinner overlay and button disabled states work correctly
- ✅ **Error Handling**: User-friendly error messages for API failures
- ✅ **Visual Consistency**: No visual regressions to modal layout or styling
- ✅ **Date Handling**: Existing date input behavior is preserved
- ✅ **Responsive Design**: Modal continues to work on mobile and desktop

### Technical Requirements
- ✅ **Authentication**: Uses existing `fetchWithAuth` helper with token management
- ✅ **Error Recovery**: Graceful handling of network and API errors
- ✅ **Memory Management**: Proper cleanup of resources and event handlers
- ✅ **Performance**: Efficient data processing for typical 31-day ranges
- ✅ **Backward Compatibility**: Existing function signature and behavior preserved

### Security Requirements
- ✅ **Token Security**: No tokens logged or exposed in error messages
- ✅ **Input Validation**: All user inputs validated before API calls
- ✅ **Error Sanitization**: Error messages don't expose sensitive information
- ✅ **XSS Prevention**: All dynamic content properly escaped

## Implementation Plan

### Week 1: Core API Integration
- **Day 1**: Remove mock data generation and add API call
- **Day 2**: Implement data processing pipeline (dailyMap, zero-fill, totals)
- **Day 3**: Add comprehensive error handling and validation
- **Day 4**: Test with real API and various edge cases
- **Day 5**: Update DeviceReportModal with dependency injection

### Week 2: Testing and Validation
- **Day 1**: Create unit tests for data processing functions
- **Day 2**: Create integration tests for API calls
- **Day 3**: Manual QA testing with various scenarios
- **Day 4**: Performance testing and optimization
- **Day 5**: Documentation updates and demo validation

### Week 3: Deployment and Monitoring
- **Day 1**: Deploy to staging environment
- **Day 2**: Validate with real production data
- **Day 3**: Monitor API usage and performance
- **Day 4**: Address any issues or edge cases
- **Day 5**: Production deployment

## Conclusion

This refactor transforms the `openDashboardPopupReport` function from a mock data demonstration into a production-ready operational reporting tool. By integrating with the Data/Ingestion API, users will have access to accurate historical consumption data while maintaining the familiar UI/UX they expect.

The implementation follows established patterns from the modern library components, ensures robust error handling, and provides a clear path for future enhancements. The dependency injection pattern enables comprehensive testing while maintaining production reliability.

**Key Benefits:**
- ✅ **Accurate Data**: Real telemetry replaces mock data
- ✅ **Operational Value**: Enables actual business decision-making
- ✅ **Consistency**: Aligns with modern library patterns
- ✅ **Maintainability**: Clean, testable code with proper error handling
- ✅ **Extensibility**: Foundation for future reporting enhancements

**Expected Impact:**
- 📈 **100% data accuracy** vs 0% with mock data
- 📈 **Operational reporting capability** for energy management
- 📈 **Consistent user experience** across all modal components
- 📈 **Foundation for advanced analytics** and reporting features

This refactor represents a critical step in transforming the ThingsBoard energy widget from a demonstration tool into a production-ready operational dashboard component.
