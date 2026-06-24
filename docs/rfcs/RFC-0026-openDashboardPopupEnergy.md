# RFC-0026: openDashboardPopupEnergy (Energy Detail Modal)

- **RFC**: 0026
- **Title**: openDashboardPopupEnergy (Energy Detail Modal)
- **Authors**: MyIO Frontend Guild
- **Status**: Draft
- **Created**: 2025-09-30
- **Target Version**: next minor of the library

## Related Components

- `src/components/premium-modals/report-all/AllReportModal.ts`
- `src/components/premium-modals/report-device/DeviceReportModal.ts`
- `src/components/premium-modals/energy/openDashboardPopupEnergy.ts` (current stub)

## Summary

We are introducing a reusable, library-level modal `openDashboardPopupEnergy` that:

- Shows energy detail (chart + KPIs) for a single device/identifier
- Reuses look & feel and behaviors from `AllReportModal` and `DeviceReportModal`
- Must not read ThingsBoard JWT from localStorage at any time
- Receives ThingsBoard JWT (TB token) and Data API auth only via parameters
- Externalizes CLIENT_ID and CLIENT_SECRET (no hard-coded fallbacks inside the component)
- Centralizes entity lookup (`getEntityInfoAndAttributes`) + telemetry/chart embedding

## Motivation

### Current State Problems

1. **Duplicated Modal Logic**: Energy drilldown/report functionality is scattered across different widgets, leading to inconsistent implementations and maintenance overhead.

2. **Security & Portability Issues**: Current implementations often rely on `localStorage.getItem('jwt_token')` which creates security vulnerabilities and makes components non-portable.

3. **Hard-coded Credentials**: CLIENT_ID and CLIENT_SECRET are often embedded directly in component code, making them difficult to manage and rotate.

4. **Inconsistent Entity Discovery**: Each implementation has its own way of discovering `customerId`, `ingestionId`, `centralId/slaveId`, `label`, and server attributes.

5. **Limited Testability**: Tight coupling to localStorage and hard-coded values makes it difficult to test token flow and error states.

### Goals

- **Single Entry Point**: Provide a documented, consistent API: `openDashboardPopupEnergy(options)`
- **Parameterized Security**: All tokens and credentials passed via parameters, never read from storage
- **Centralized Entity Logic**: Standardized entity/attributes fetch utility consuming `tbJwtToken`
- **Reusable Visuals**: Derive chart behaviors, table, and CSV export from existing modal patterns
- **Full TypeScript Support**: Complete typings, JSDoc, and usage examples

### Non-Goals

- No direct localStorage access in component
- No implicit global CSS; scope styles to modal shadow or BEM blocks
- No ThingsBoard widget-specific logic in the library (keep generic)

## Guide-Level Explanation

### Problem Solved

The `openDashboardPopupEnergy` API solves the problem of displaying detailed energy consumption data for individual devices across different dashboard contexts. It provides a unified interface for:

- Fetching device entity information from ThingsBoard
- Displaying energy consumption charts and KPIs
- Exporting data to CSV format
- Handling authentication and error states consistently

### Developer Usage

```typescript
// Basic usage with required parameters
MyIOLibrary.openDashboardPopupEnergy({
  deviceId: 'DEVICE_UUID',
  startDate: '2025-09-01',
  endDate: '2025-09-30',
  tbJwtToken: myTbToken,
});

// Full configuration with Data API token
MyIOLibrary.openDashboardPopupEnergy({
  deviceId: 'DEVICE_UUID',
  startDate: new Date('2025-09-01T00:00:00-03:00'),
  endDate: new Date('2025-09-30T23:59:59-03:00'),
  tbJwtToken: myTbToken,
  ingestionToken: myDataApiToken,
  dataApiHost: 'https://api.data.apps.myio-bas.com',
  chartsBaseUrl: 'https://graphs.apps.myio-bas.com',
  timezone: 'America/Sao_Paulo',
  onOpen: (ctx) => console.log('Modal opened', ctx),
  onClose: () => console.log('Modal closed')
});

// Using SDK client credentials
MyIOLibrary.openDashboardPopupEnergy({
  deviceId: 'DEVICE_UUID',
  startDate: '2025-09-01',
  endDate: '2025-09-30',
  tbJwtToken: myTbToken,
  clientId: MY_CLIENT_ID,
  clientSecret: MY_CLIENT_SECRET,
  theme: 'dark'
});
```

### Modal Lifecycle

1. **Parameter Validation**: Validates required parameters and throws friendly errors
2. **Entity Fetch**: Retrieves device information and attributes from ThingsBoard
3. **Credential Resolution**: Determines authentication strategy for charts and Data API
4. **UI Rendering**: Displays modal with device summary and chart container
5. **Data Loading**: Fetches energy data and renders charts/tables
6. **User Interaction**: Handles zoom, export, and navigation events
7. **Cleanup**: Properly disposes of resources and event listeners

## Reference-Level Explanation

### Public API

```typescript
export function openDashboardPopupEnergy(
  options: OpenDashboardPopupEnergyOptions
): { close: () => void };

export interface OpenDashboardPopupEnergyOptions {
  // Identity / Context (REQUIRED)
  deviceId: string;                    // TB device UUID for entity fetch
  startDate: string | Date;            // ISO with TZ offset or 'YYYY-MM-DD'
  endDate: string | Date;              // ISO with TZ offset or 'YYYY-MM-DD'
  tbJwtToken: string;                  // REQUIRED for TB REST fetches

  // Optional Identity Resolution
  label?: string;                      // Display label (fallback to TB label/name)
  customerId?: string;                 // Optional; if absent, show device view
  ingestionId?: string;                // Optional; try resolving from TB attributes
  centralId?: string;                  // Optional; may come from attributes
  slaveId?: number | string;           // Optional; may come from attributes

  // Authentication Strategy (ONE REQUIRED)
  ingestionToken?: string;             // For direct Data API access
  clientId?: string;                   // For SDK auth flow
  clientSecret?: string;               // For SDK auth flow

  // Endpoints / Environment
  dataApiHost?: string;                // default: https://api.data.apps.myio-bas.com
  chartsBaseUrl?: string;              // default: https://graphs.apps.myio-bas.com
  timezone?: string;                   // default: "America/Sao_Paulo"
  theme?: 'light' | 'dark' | string;   // default: 'light'

  // Behavior Configuration
  granularity?: '1d' | '1h' | '15m';   // default: '1d'
  closeOnEsc?: boolean;                // default: true
  zIndex?: number;                     // default: 10000

  // Event Hooks
  onOpen?: (ctx: EnergyModalContext) => void;
  onClose?: () => void;
  onError?: (err: Error) => void;

  // Customization
  i18n?: Partial<EnergyModalI18n>;
  styles?: Partial<EnergyModalStyleOverrides>;
}

export interface EnergyModalContext {
  device: {
    id: string;
    label: string;
    attributes: Record<string, any>;
  };
  resolved: {
    ingestionId?: string;
    centralId?: string;
    slaveId?: number | string;
    customerId?: string;
  };
}

export interface EnergyModalI18n {
  title: string;
  loading: string;
  error: string;
  noData: string;
  exportCsv: string;
  close: string;
  totalConsumption: string;
  averageDaily: string;
  peakDay: string;
  dateRange: string;
}

export interface EnergyModalStyleOverrides {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderRadius: string;
  fontFamily: string;
}
```

### Internal Architecture

The component follows the established pattern from `AllReportModal` and `DeviceReportModal`:

#### EnergyModal (Main Component)
- Parameter validation and normalization
- ThingsBoard entity and attributes fetching
- Credential resolution and authentication
- Modal lifecycle management
- Event handling and cleanup

#### EnergyModalView (UI Rendering)
- Framework-agnostic DOM manipulation
- Chart container and KPI display
- Loading states and error handling
- Responsive design and accessibility

#### EnergyDataFetcher (Data Layer)
- Data API integration for energy telemetry
- Chart SDK integration for visualizations
- CSV export functionality
- Caching and performance optimization

### Data Flow

```
Parameters → Validation → Entity Fetch → Credential Resolution
     ↓              ↓            ↓              ↓
Modal Creation → UI Render → Data Fetch → Chart Render
     ↓              ↓            ↓              ↓
Event Binding → User Actions → Data Export → Modal Close
```

### ThingsBoard Integration

#### Entity and Attributes Fetch

```typescript
// Get device entity
GET /api/device/{deviceId}
Headers: X-Authorization: Bearer ${tbJwtToken}
Response: { id, name, label, ... }

// Get server scope attributes
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/attributes?scope=SERVER_SCOPE
Headers: X-Authorization: Bearer ${tbJwtToken}
Response: [
  { key: "ingestionId", value: "ing-123" },
  { key: "centralId", value: "central-456" },
  { key: "slaveId", value: "1" }
]
```

#### Attribute Resolution Strategy

```typescript
function resolveDeviceAttributes(attributes: any[]): ResolvedAttributes {
  const attrMap = attributes.reduce((acc, attr) => {
    acc[attr.key] = attr.value;
    return acc;
  }, {});

  return {
    ingestionId: attrMap.ingestionId || attrMap.INGESTION_ID,
    centralId: attrMap.centralId || attrMap.CENTRAL_ID,
    slaveId: attrMap.slaveId || attrMap.SLAVE_ID,
    customerId: attrMap.customerId || attrMap.CUSTOMER_ID,
    floor: attrMap.floor || attrMap.FLOOR,
    storeNumber: attrMap.NumLoja || attrMap.storeNumber
  };
}
```

### Data API Integration

#### Energy Telemetry Endpoint

```typescript
// Daily energy totals
GET ${dataApiHost}/api/v1/telemetry/devices/${ingestionId}/energy
  ?startTime=${encodeURIComponent(startISO)}
  &endTime=${encodeURIComponent(endISO)}
  &granularity=1d
  &page=1
  &pageSize=1000

Headers: Authorization: Bearer ${ingestionToken}
Response: {
  data: [{
    deviceId: "ing-123",
    consumption: [
      { timestamp: "2025-09-01T00:00:00-03:00", value: 45.2 },
      { timestamp: "2025-09-02T00:00:00-03:00", value: 52.1 }
    ]
  }]
}
```

### Chart Integration

#### EnergyChartSDK Integration

```typescript
function renderEnergyChart(container: HTMLElement, options: ChartOptions): void {
  const chartConfig = {
    apiBaseUrl: options.dataApiHost,
    iframeBaseUrl: options.chartsBaseUrl,
    timezone: options.timezone,
    deviceId: options.ingestionId,
    startDate: options.startISO,
    endDate: options.endISO,
    granularity: options.granularity,
    theme: options.theme,
    
    // Authentication strategy
    ...(options.ingestionToken 
      ? { token: options.ingestionToken }
      : { clientId: options.clientId, clientSecret: options.clientSecret }
    )
  };

  // Use existing EnergyChartSDK
  window.EnergyChartSDK.renderTelemetryChart(container, chartConfig);
}
```

### Error Handling

#### Comprehensive Error Mapping

```typescript
interface EnergyModalError {
  code: 'VALIDATION_ERROR' | 'NETWORK_ERROR' | 'AUTH_ERROR' | 'TOKEN_EXPIRED' | 'UNKNOWN_ERROR';
  message: string;
  field?: string;
  userAction?: 'RETRY' | 'RE_AUTH' | 'CONTACT_ADMIN' | 'FIX_INPUT';
  cause?: unknown;
}

function mapHttpError(status: number, body: string): EnergyModalError {
  switch (status) {
    case 400:
      return {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        userAction: 'FIX_INPUT'
      };
    case 401:
      return {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
        userAction: 'RE_AUTH'
      };
    case 403:
      return {
        code: 'AUTH_ERROR',
        message: 'Insufficient permissions',
        userAction: 'RE_AUTH'
      };
    case 404:
      return {
        code: 'NETWORK_ERROR',
        message: 'Device not found',
        userAction: 'CONTACT_ADMIN'
      };
    default:
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error occurred',
        userAction: 'RETRY'
      };
  }
}
```

### Security Considerations

#### Token Handling
- JWT tokens are never logged or persisted by the component
- Tokens are passed securely in Authorization headers
- Component validates token presence before API calls
- No token caching - always use fresh token from caller

#### Input Validation
```typescript
function validateOptions(options: OpenDashboardPopupEnergyOptions): void {
  if (!options.tbJwtToken) {
    throw new Error('tbJwtToken is required for ThingsBoard API access');
  }
  
  if (!options.deviceId) {
    throw new Error('deviceId is required');
  }
  
  if (!options.startDate || !options.endDate) {
    throw new Error('startDate and endDate are required');
  }
  
  // Validate authentication strategy
  const hasIngestionToken = !!options.ingestionToken;
  const hasClientCredentials = !!(options.clientId && options.clientSecret);
  
  if (!hasIngestionToken && !hasClientCredentials) {
    throw new Error('Either ingestionToken or clientId/clientSecret must be provided');
  }
}
```

## Detailed Design

### File Structure

```
src/
  components/
    premium-modals/
      energy/
        EnergyModal.ts                 # Main component class
        EnergyModalView.ts             # UI rendering and DOM
        EnergyDataFetcher.ts           # Data API integration
        openDashboardPopupEnergy.ts    # Public API entry point
        types.ts                       # Component-specific types
        utils.ts                       # Helper functions
```

### Implementation Plan

#### Phase 1: Core Component (EnergyModal.ts)

```typescript
export class EnergyModal {
  private modal: any;
  private view: EnergyModalView;
  private dataFetcher: EnergyDataFetcher;
  private params: OpenDashboardPopupEnergyOptions;
  private context: EnergyModalContext | null = null;

  constructor(params: OpenDashboardPopupEnergyOptions) {
    this.validateParams(params);
    this.params = this.normalizeParams(params);
    
    this.dataFetcher = new EnergyDataFetcher({
      dataApiHost: params.dataApiHost,
      ingestionToken: params.ingestionToken,
      clientId: params.clientId,
      clientSecret: params.clientSecret
    });
  }

  async show(): Promise<{ close: () => void }> {
    try {
      // 1. Fetch device entity and attributes
      this.context = await this.fetchDeviceContext();
      
      // 2. Create and render modal
      this.modal = createModal({
        title: this.buildModalTitle(),
        width: '90vw',
        height: '90vh',
        theme: this.params.theme || 'light'
      });

      this.view = new EnergyModalView(this.modal, {
        context: this.context,
        params: this.params,
        onExport: () => this.handleExport(),
        onError: (error) => this.handleError(error)
      });

      // 3. Load and render data
      await this.loadEnergyData();
      
      // 4. Setup event handlers
      this.setupEventHandlers();
      
      // 5. Trigger onOpen callback
      if (this.params.onOpen) {
        this.params.onOpen(this.context);
      }

      return {
        close: () => this.close()
      };
      
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  private async fetchDeviceContext(): Promise<EnergyModalContext> {
    const entityInfo = await this.fetchEntityInfo();
    const attributes = await this.fetchEntityAttributes();
    
    return {
      device: {
        id: this.params.deviceId,
        label: this.params.label || entityInfo.label || entityInfo.name || 'Unknown Device',
        attributes: attributes
      },
      resolved: this.resolveAttributes(attributes)
    };
  }

  private async fetchEntityInfo(): Promise<any> {
    const response = await fetch(
      `/api/device/${this.params.deviceId}`,
      {
        headers: {
          'X-Authorization': `Bearer ${this.params.tbJwtToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch device entity: ${response.status}`);
    }

    return response.json();
  }

  private async fetchEntityAttributes(): Promise<Record<string, any>> {
    const response = await fetch(
      `/api/plugins/telemetry/DEVICE/${this.params.deviceId}/values/attributes?scope=SERVER_SCOPE`,
      {
        headers: {
          'X-Authorization': `Bearer ${this.params.tbJwtToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch device attributes: ${response.status}`);
    }

    const attributes = await response.json();
    return attributes.reduce((acc: any, attr: any) => {
      acc[attr.key] = attr.value;
      return acc;
    }, {});
  }

  private resolveAttributes(attributes: Record<string, any>): any {
    return {
      ingestionId: this.params.ingestionId || attributes.ingestionId || attributes.INGESTION_ID,
      centralId: this.params.centralId || attributes.centralId || attributes.CENTRAL_ID,
      slaveId: this.params.slaveId || attributes.slaveId || attributes.SLAVE_ID,
      customerId: this.params.customerId || attributes.customerId || attributes.CUSTOMER_ID
    };
  }

  private async loadEnergyData(): Promise<void> {
    if (!this.context?.resolved.ingestionId) {
      throw new Error('ingestionId not found in device attributes');
    }

    const energyData = await this.dataFetcher.fetchEnergyData({
      ingestionId: this.context.resolved.ingestionId,
      startISO: this.normalizeDate(this.params.startDate, false),
      endISO: this.normalizeDate(this.params.endDate, true),
      granularity: this.params.granularity || '1d'
    });

    this.view.renderEnergyData(energyData);
  }

  private normalizeDate(date: string | Date, endOfDay: boolean): string {
    // Implementation similar to existing modals
    // Convert to São Paulo timezone ISO string
    // Handle both Date objects and YYYY-MM-DD strings
    // Add T00:00:00-03:00 or T23:59:59-03:00 as needed
  }

  private close(): void {
    if (this.modal) {
      this.modal.close();
    }
    if (this.params.onClose) {
      this.params.onClose();
    }
  }
}
```

#### Phase 2: UI View (EnergyModalView.ts)

```typescript
export class EnergyModalView {
  private modal: any;
  private container: HTMLElement;
  private chartContainer: HTMLElement;
  private config: EnergyViewConfig;

  constructor(modal: any, config: EnergyViewConfig) {
    this.modal = modal;
    this.config = config;
    this.render();
  }

  private render(): void {
    const content = this.createModalContent();
    this.modal.setContent(content);
    this.setupEventListeners();
  }

  private createModalContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'myio-energy-modal-scope';
    
    container.innerHTML = `
      <div class="myio-energy-modal-layout">
        <!-- Left Column: Device Summary -->
        <div class="myio-energy-device-summary">
          ${this.renderDeviceSummary()}
        </div>
        
        <!-- Right Column: Chart and Data -->
        <div class="myio-energy-chart-section">
          <div class="myio-energy-header">
            <h3>${this.config.context.device.label}</h3>
            <div class="myio-energy-actions">
              <button id="export-csv-btn" class="myio-btn myio-btn-secondary">
                ${this.getI18nText('exportCsv', 'Export CSV')}
              </button>
              <button id="close-btn" class="myio-btn myio-btn-outline">
                ${this.getI18nText('close', 'Close')}
              </button>
            </div>
          </div>
          
          <div id="energy-chart-container" class="myio-energy-chart-container">
            <div class="myio-loading-state">
              <div class="myio-spinner"></div>
              <p>${this.getI18nText('loading', 'Loading energy data...')}</p>
            </div>
          </div>
          
          <div id="energy-kpis" class="myio-energy-kpis" style="display: none;">
            <!-- KPIs will be populated by renderEnergyData -->
          </div>
          
          <div id="energy-table" class="myio-energy-table" style="display: none;">
            <!-- Table will be populated by renderEnergyData -->
          </div>
        </div>
      </div>
    `;

    this.container = container;
    this.chartContainer = container.querySelector('#energy-chart-container') as HTMLElement;
    
    return container;
  }

  private renderDeviceSummary(): string {
    const { device, resolved } = this.config.context;
    const classification = this.classifyDevice(device.attributes);
    
    return `
      <div class="myio-device-card">
        <div class="myio-device-icon">
          ${this.getDeviceIcon(classification)}
        </div>
        <div class="myio-device-info">
          <h4>${device.label}</h4>
          <p class="myio-device-id">${device.id}</p>
          ${resolved.ingestionId ? `<p class="myio-ingestion-id">ID: ${resolved.ingestionId}</p>` : ''}
          ${device.attributes.floor ? `<p class="myio-device-floor">Floor: ${device.attributes.floor}</p>` : ''}
          ${device.attributes.NumLoja ? `<p class="myio-store-number">Store: ${device.attributes.NumLoja}</p>` : ''}
        </div>
      </div>
    `;
  }

  renderEnergyData(energyData: EnergyData): void {
    // Hide loading state
    const loadingState = this.chartContainer.querySelector('.myio-loading-state');
    if (loadingState) {
      loadingState.remove();
    }

    // Render chart using EnergyChartSDK
    this.renderChart(energyData);
    
    // Render KPIs
    this.renderKPIs(energyData);
    
    // Render data table
    this.renderDataTable(energyData);
  }

  private renderChart(energyData: EnergyData): void {
    // Integration with existing EnergyChartSDK
    const chartConfig = {
      apiBaseUrl: this.config.params.dataApiHost,
      iframeBaseUrl: this.config.params.chartsBaseUrl,
      timezone: this.config.params.timezone || 'America/Sao_Paulo',
      deviceId: this.config.context.resolved.ingestionId,
      startDate: this.config.params.startDate,
      endDate: this.config.params.endDate,
      granularity: this.config.params.granularity || '1d',
      theme: this.config.params.theme || 'light',
      
      // Authentication
      ...(this.config.params.ingestionToken 
        ? { token: this.config.params.ingestionToken }
        : { 
            clientId: this.config.params.clientId, 
            clientSecret: this.config.params.clientSecret 
          }
      )
    };

    // Use existing chart SDK
    if (window.EnergyChartSDK) {
      window.EnergyChartSDK.renderTelemetryChart(this.chartContainer, chartConfig);
    } else {
      // Fallback to simple chart implementation
      this.renderFallbackChart(energyData);
    }
  }

  private renderKPIs(energyData: EnergyData): void {
    const kpisContainer = document.getElementById('energy-kpis');
    if (!kpisContainer) return;

    const totalConsumption = energyData.consumption.reduce((sum, item) => sum + item.value, 0);
    const averageDaily = totalConsumption / energyData.consumption.length;
    const peakDay = energyData.consumption.reduce((max, item) => 
      item.value > max.value ? item : max, energyData.consumption[0]);

    kpisContainer.innerHTML = `
      <div class="myio-kpi-grid">
        <div class="myio-kpi-card">
          <div class="myio-kpi-value">${this.formatNumber(totalConsumption)} kWh</div>
          <div class="myio-kpi-label">${this.getI18nText('totalConsumption', 'Total Consumption')}</div>
        </div>
        <div class="myio-kpi-card">
          <div class="myio-kpi-value">${this.formatNumber(averageDaily)} kWh</div>
          <div class="myio-kpi-label">${this.getI18nText('averageDaily', 'Average Daily')}</div>
        </div>
        <div class="myio-kpi-card">
          <div class="myio-kpi-value">${this.formatNumber(peakDay.value)} kWh</div>
          <div class="myio-kpi-label">${this.getI18nText('peakDay', 'Peak Day')}</div>
          <div class="myio-kpi-date">${this.formatDate(peakDay.timestamp)}</div>
        </div>
      </div>
    `;

    kpisContainer.style.display = 'block';
  }

  private renderDataTable(energyData: EnergyData): void {
    const tableContainer = document.getElementById('energy-table');
    if (!tableContainer) return;

    const tableHTML = `
      <div class="myio-table-container">
        <table class="myio-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Consumption (kWh)</th>
            </tr>
          </thead>
          <tbody>
            ${energyData.consumption.map(item => `
              <tr>
                <td>${this.formatDate(item.timestamp)}</td>
                <td>${this.formatNumber(item.value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    tableContainer.innerHTML = tableHTML;
    tableContainer.style.display = 'block';
  }
}
```

#### Phase 3: Data Fetcher (EnergyDataFetcher.ts)

```typescript
export class EnergyDataFetcher {
  private config: DataFetcherConfig;
  private authClient: AuthClient;

  constructor(config: DataFetcherConfig) {
    this.config = config;
    
    if (config.clientId && config.clientSecret) {
      this.authClient = new AuthClient({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        base: config.dataApiHost
      });
    }
  }

  async fetchEnergyData(params: EnergyDataParams): Promise<EnergyData> {
    const token = await this.getAuthToken();
    
    const url = `${this.config.dataApiHost}/api/v1/telemetry/devices/${params.ingestionId}/energy` +
      `?startTime=${encodeURIComponent(params.startISO)}` +
      `&endTime=${encodeURIComponent(params.endISO)}` +
      `&granularity=${params.granularity}` +
      `&page=1&pageSize=1000&deep=0`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Energy data fetch failed: ${response.status} ${response.statusText}`);
    }

    const apiResponse = await response.json();
    return this.processEnergyResponse(apiResponse, params);
  }

  private async getAuthToken(): Promise<string> {
    if (this.config.ingestionToken) {
      return this.config.ingestionToken;
    }
    
    if (this.authClient) {
      return await this.authClient.getBearer();
    }
    
    throw new Error('No authentication method available');
  }

  private processEnergyResponse(apiResponse: any, params: EnergyDataParams): EnergyData {
    // Process similar to DeviceReportModal
    const dataArray = Array.isArray(apiResponse) ? apiResponse : (apiResponse.data || []);
    
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return this.createEmptyEnergyData(params);
    }

    const deviceData = dataArray[0];
    const consumption = deviceData.consumption || [];

    return {
      deviceId: params.ingestionId,
      consumption: consumption.map((item: any) => ({
        timestamp: item.timestamp,
        value: Number(item.value) || 0
      })),
      granularity: params.granularity,
      dateRange: {
        start: params.startISO,
        end: params.endISO
      }
    };
  }

  private createEmptyEnergyData(params: EnergyDataParams): EnergyData {
    // Generate date range and zero-fill
    const dateRange = this.generateDateRange(params.startISO, params.endISO, params.granularity);
    
    return {
      deviceId: params.ingestionId,
      consumption: dateRange.map(date => ({
        timestamp: date,
        value: 0
      })),
      granularity: params.granularity,
      dateRange: {
        start: params.startISO,
        end: params.endISO
      }
    };
  }

  private generateDateRange(startISO: string, endISO: string, granularity: string): string[] {
    // Implementation similar to existing modals
    // Generate array of date strings based on granularity
    const dates: string[] = [];
    const start = new Date(startISO);
    const end = new Date(endISO);
    
    while (start <= end) {
      dates.push(start.toISOString());
      
      switch (granularity) {
        case '15m':
          start.setMinutes(start.getMinutes() + 15);
          break;
        case '1h':
          start.setHours(start.getHours() + 1);
          break;
        case '1d':
        default:
          start.setDate(start.getDate() + 1);
          break;
      }
    }
    
    return dates;
  }
}
```

#### Phase 4: Public API Entry Point (openDashboardPopupEnergy.ts)

```typescript
import { EnergyModal } from './EnergyModal';
import { OpenDashboardPopupEnergyOptions } from './types';

export function openDashboardPopupEnergy(
  options: OpenDashboardPopupEnergyOptions
): { close: () => void } {
  // Validate required parameters
  if (!options.tbJwtToken) {
    throw new Error('tbJwtToken is required for ThingsBoard API access');
  }
  
  if (!options.deviceId) {
    throw new Error('deviceId is required');
  }
  
  if (!options.startDate || !options.endDate) {
    throw new Error('startDate and endDate are required');
  }
  
  // Validate authentication strategy
  const hasIngestionToken = !!options.ingestionToken;
  const hasClientCredentials = !!(options.clientId && options.clientSecret);
  
  if (!hasIngestionToken && !hasClientCredentials) {
    throw new Error('Either ingestionToken or clientId/clientSecret must be provided');
  }
  
  // Create and show modal
  const modal = new EnergyModal(options);
  return modal.show();
}
```

## Terminology & Data Sources

- **TB REST**: ThingsBoard REST API used to fetch device entity and SERVER_SCOPE attributes; requires `tbJwtToken`
- **Data API**: `${DATA_API_HOST}` (configurable) for energy totals and time-series; requires `ingestionToken` or client credentials
- **EnergyChartSDK**: Rendered with explicit `apiBaseUrl`, `iframeBaseUrl`, `timezone`, and credential strategy passed via options

## Integration Examples

### A) Minimal Usage

```typescript
openDashboardPopupEnergy({
  deviceId: 'DEVICE_UUID',
  startDate: '2025-09-01',
  endDate: '2025-09-30',
  tbJwtToken: myTbToken,
  ingestionToken: myIngestionToken
});
```

### B) With Data API Token (No Client Credentials)

```typescript
openDashboardPopupEnergy({
  deviceId: 'DEVICE_UUID',
  startDate: new Date('2025-09-01T00:00:00-03:00'),
  endDate: new Date('2025-09-30T23:59:59-03:00'),
  tbJwtToken: myTbToken,
  ingestionToken: myDataApiToken,
  dataApiHost: 'https://api.data.apps.myio-bas.com',
  chartsBaseUrl: 'https://graphs.apps.myio-bas.com',
  timezone: 'America/Sao_Paulo',
  onOpen: (ctx) => {
    console.log('Energy modal opened for device:', ctx.device.label);
    console.log('Resolved ingestionId:', ctx.resolved.ingestionId);
  },
  onClose: () => {
    console.log('Energy modal closed');
  },
  onError: (error) => {
    console.error('Energy modal error:', error);
  }
});
```

### C) With SDK Client Credentials (No ingestionToken)

```typescript
openDashboardPopupEnergy({
  deviceId: 'DEVICE_UUID',
  startDate: '2025-09-01',
  endDate: '2025-09-30',
  tbJwtToken: myTbToken,
  clientId: MY_CLIENT_ID,
  clientSecret: MY_CLIENT_SECRET,
  theme: 'dark',
  granularity: '1h',
  i18n: {
    title: 'Detalhes de Energia',
    loading: 'Carregando dados...',
    totalConsumption: 'Consumo Total',
    averageDaily: 'Média Diária',
    peakDay: 'Pico do Dia'
  }
});
```

### D) ThingsBoard Widget Integration

```typescript
// In ThingsBoard widget controller
function openEnergyDetails() {
  const jwtToken = localStorage.getItem('jwt_token');
  const deviceId = self.ctx.datasources[0]?.entityId;
  
  if (!jwtToken) {
    alert('Please log in to view energy details');
    return;
  }
  
  MyIOLibrary.openDashboardPopupEnergy({
    deviceId: deviceId,
    startDate: self.ctx.timeWindow.startTimeMs,
    endDate: self.ctx.timeWindow.endTimeMs,
    tbJwtToken: jwtToken,
    clientId: self.ctx.settings.clientId,
    clientSecret: self.ctx.settings.clientSecret,
    onOpen: (ctx) => {
      console.log('Energy modal opened for:', ctx.device.label);
    },
    onError: (error) => {
      if (error.userAction === 'RE_AUTH') {
        // Redirect to login or show auth modal
        window.location.href = '/login';
      } else {
        alert('Error loading energy data: ' + error.message);
      }
    }
  });
}
```

## Styling & UX

### Visual Design
- Use the premium modal visual language established by `AllReportModal`/`DeviceReportModal`
- Rounded corners, MYIO brand colors, consistent spacing
- Full-viewport overlay with blur background
- Responsive design for mobile and desktop

### Accessibility
- `role="dialog"`, `aria-modal="true"`, labeled header
- Keyboard navigation (Tab, Shift+Tab, Escape)
- Focus trap within modal
- Screen reader compatible
- High contrast support

### CSS Architecture

```css
.myio-energy-modal-scope {
  /* Scoped styles to avoid conflicts */
  --myio-energy-primary: var(--myio-brand-600, #6366f1);
  --myio-energy-bg: var(--myio-bg, #ffffff);
  --myio-energy-text: var(--myio-text, #1f2937);
  --myio-energy-border: var(--myio-border, #e5e7eb);
}

.myio-energy-modal-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
  height: 100%;
}

.myio-energy-device-summary {
  background: var(--myio-energy-bg);
  border-radius: 8px;
  padding: 20px;
  border: 1px solid var(--myio-energy-border);
}

.myio-energy-chart-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.myio-energy-chart-container {
  flex: 1;
  min-height: 400px;
  background: var(--myio-energy-bg);
  border-radius: 8px;
  border: 1px solid var(--myio-energy-border);
}

@media (max-width: 768px) {
  .myio-energy-modal-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}
```

## Drawbacks

### Additional Complexity
- Introduces another abstraction layer in the modal system
- Requires understanding of multiple authentication strategies
- May introduce bugs in the abstraction layer

### Bundle Size Impact
- Additional JavaScript code increases bundle size
- Chart SDK integration may require additional dependencies
- Need to consider code splitting strategies

### Maintenance Overhead
- Breaking changes in component API affect all consumers
- Need careful versioning strategy for ThingsBoard compatibility
- Migration path required for existing implementations

## Rationale and Alternatives

### Alternative 1: Keep Logic Inside ThingsBoard Widgets
**Pros**: No additional abstraction, direct widget control
**Cons**: Code duplication, inconsistent UX, maintenance burden
**Decision**: Rejected - doesn't solve core problems

### Alternative 2: Extend Existing DeviceReportModal
**Pros**: Reuses existing code, smaller API surface
**Cons**: Conflates different use cases, harder to customize
**Decision**: Rejected - energy modal has different requirements

### Alternative 3: Generic Modal with Plugins
**Pros**: Maximum flexibility, extensible architecture
**Cons**: Over-engineering, complex API, harder to use
**Decision**: Rejected - YAGNI principle, specific solution is better

### Chosen Approach: Dedicated Energy Modal
**Pros**: 
- Clear separation of concerns
- Optimized for energy use case
- Consistent with existing modal patterns
- Easy to test and maintain

**Cons**:
- Additional code to maintain
- Potential for feature overlap with other modals

## Prior Art

### Existing MyIO Library Patterns
- `openDashboardPopupReport` - Single device reporting
- `openDashboardPopupAllReport` - Multi-device reporting  
- `openDashboardPopupSettings` - Device configuration

### Industry Standards
- **Material Design**: Modal dialog patterns and accessibility
- **ARIA**: Dialog role and keyboard navigation standards
- **ThingsBoard**: Widget and dashboard integration patterns

## Unresolved Questions

### Chart SDK Integration
- **Question**: Should we bundle EnergyChartSDK or load it dynamically?
- **Impact**: Affects bundle size and loading performance
- **Resolution**: Start with dynamic loading, consider bundling based on usage

### Multi-Device Support
- **Question**: Should the modal support multiple devices in a single view?
- **Impact**: Would require significant API and UI changes
- **Resolution**: Out of scope for v1, consider for future enhancement

### Caching Strategy
- **Question**: Should we cache ThingsBoard attributes for the modal lifetime?
- **Impact**: Affects performance and data freshness
- **Resolution**: Cache in-memory only, never in storage

## Future Possibilities

### Enhanced Visualizations
- **Demand Curves**: Peak demand analysis and visualization
- **Cost Analysis**: Energy cost calculations and projections
- **Comparison Views**: Side-by-side device comparisons

### Advanced Features
- **Real-time Updates**: WebSocket integration for live data
- **Alerts Integration**: Show energy alerts and thresholds
- **Export Options**: PDF reports, scheduled exports

### Cross-Domain Integration
- **Water Modal**: Similar modal for water consumption data
- **Temperature Modal**: HVAC and temperature monitoring
- **Unified Dashboard**: Multi-utility overview modal

## Security & Compliance

### Token Security
- **No Logging**: JWT tokens are never logged or stored in browser console
- **Secure Headers**: Tokens transmitted only in secure Authorization headers
- **No Persistence**: Component never stores tokens in localStorage or sessionStorage
- **Scope Validation**: Tokens validated for required permissions before use

### Input Validation
- **Client-Side**: Immediate feedback for user experience
- **Server-Side**: ThingsBoard validates all incoming requests
- **Sanitization**: All user inputs sanitized before transmission
- **Type Safety**: TypeScript ensures type correctness at compile time

### CORS and Network Security
- **Same-Origin**: Respects browser same-origin policy
- **HTTPS Only**: Enforces secure connections for production
- **Request Validation**: Validates API endpoints to prevent injection

## Testing Strategy

### Unit Tests
```typescript
describe('EnergyModal', () => {
  it('should validate required parameters', () => {
    expect(() => new EnergyModal({})).toThrow('tbJwtToken is required');
  });
  
  it('should resolve device attributes correctly', () => {
    const attributes = [
      { key: 'ingestionId', value: 'ing-123' },
      { key: 'centralId', value: 'central-456' }
    ];
    const resolved = resolveDeviceAttributes(attributes);
    expect(resolved.ingestionId).toBe('ing-123');
    expect(resolved.centralId).toBe('central-456');
  });
});
```

### Integration Tests
```typescript
describe('Energy Modal Integration', () => {
  it('should complete full energy data workflow', async () => {
    const mockServer = setupMockThingsBoardServer();
    const mockDataApi = setupMockDataApi();
    
    const modal = await openDashboardPopupEnergy({
      deviceId: 'test-device',
      tbJwtToken: 'valid-token',
      ingestionToken: 'valid-ingestion-token',
      startDate: '2025-09-01',
      endDate: '2025-09-30'
    });
    
    expect(mockServer.requests).toHaveLength(2); // Entity + attributes
    expect(mockDataApi.requests).toHaveLength(1); // Energy data
    expect(document.querySelector('.myio-energy-modal-scope')).toBeInTheDocument();
  });
});
```

### Visual Tests
- **Accessibility**: Screen reader compatibility, keyboard navigation
- **Responsive Design**: Mobile and desktop layouts
- **Theme Support**: Light and dark mode rendering
- **Error States**: Proper error message display

## Migration Plan

### Phase 1: Component Development (Week 1-2)
1. Implement core `EnergyModal` class with ThingsBoard integration
2. Create `EnergyModalView` with responsive UI
3. Build `EnergyDataFetcher` with Data API integration
4. Add comprehensive unit tests

### Phase 2: Integration & Testing (Week 3)
1. Integrate with existing chart SDK
2. Add CSV export functionality
3. Create integration tests with mock servers
4. Implement accessibility features

### Phase 3: Documentation & Examples (Week 4)
1. Complete API documentation with JSDoc
2. Create runnable examples and demos
3. Write migration guide for existing implementations
4. Update library index exports

### Phase 4: Gradual Rollout (Week 5-6)
1. Deploy to development environment
2. Enable for select customers with feature flag
3. Collect feedback and iterate
4. Full production deployment

## Acceptance Criteria

### Functional Requirements
- [ ] Modal opens with device energy data and charts
- [ ] ThingsBoard entity and attributes fetched correctly
- [ ] Data API integration works with both token strategies
- [ ] CSV export generates correct format
- [ ] Error states display user-friendly messages
- [ ] Modal closes and cleans up resources properly

### Non-Functional Requirements
- [ ] Component loads in <200ms
- [ ] Energy data fetches in <2s
- [ ] Error messages are actionable
- [ ] Accessibility score >95 (WAVE/axe)
- [ ] Mobile responsive design
- [ ] TypeScript types are complete

### Security Requirements
- [ ] No localStorage access in component code
- [ ] JWT tokens never logged or persisted
- [ ] Input validation prevents injection attacks
- [ ] CORS policies respected
- [ ] Authentication errors handled gracefully

### Developer Experience
- [ ] API follows established MyIO patterns
- [ ] Documentation is complete and accurate
- [ ] Examples work out-of-the-box
- [ ] Error messages help debug issues
- [ ] TypeScript IntelliSense works correctly

## Implementation Checklist

### Core Implementation
- [ ] Create `EnergyModal.ts` with parameter validation
- [ ] Implement ThingsBoard entity/attributes fetching
- [ ] Build `EnergyModalView.ts` with responsive UI
- [ ] Create `EnergyDataFetcher.ts` with Data API integration
- [ ] Add chart SDK integration with fallback

### Public API
- [ ] Export `openDashboardPopupEnergy` from library index
- [ ] Complete TypeScript interface definitions
- [ ] Add JSDoc documentation with examples
- [ ] Implement parameter validation with helpful errors

### Testing & Quality
- [ ] Unit tests for all major components
- [ ] Integration tests with mock APIs
- [ ] Accessibility testing with screen readers
- [ ] Visual regression tests for UI components
- [ ] Performance testing for large datasets

### Documentation & Examples
- [ ] Update README with new API
- [ ] Create demo page with working examples
- [ ] Write ThingsBoard widget integration guide
- [ ] Document migration path from existing implementations

This RFC provides a comprehensive specification for implementing the `openDashboardPopupEnergy` component that addresses all security, functionality, and developer experience requirements while maintaining consistency with existing MyIO library patterns.
