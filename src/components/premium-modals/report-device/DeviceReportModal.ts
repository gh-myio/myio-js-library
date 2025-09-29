// report-device/DeviceReportModal.ts
import { createModal } from '../internal/ModalPremiumShell';
import { toISOWithOffset, rangeDaysInclusive } from '../internal/engines/DateEngine';
import { toCsv } from '../internal/engines/CsvExporter';
import { fmtPt } from '../internal/engines/NumberFmt';
import { AuthClient } from '../internal/engines/AuthClient';
import { attach as attachDateRangePicker, DateRangeControl } from '../internal/DateRangePickerJQ';
import { OpenDeviceReportParams, ModalHandle, EnergyFetcher } from '../types';

interface DailyReading {
  date: string; // YYYY-MM-DD
  consumption: number;
}

// Default energy fetcher implementation
const createDefaultEnergyFetcher = (params: OpenDeviceReportParams): EnergyFetcher => {
  return async ({ baseUrl, ingestionId, startISO, endISO }) => {
    const url = `${baseUrl}/api/v1/telemetry/devices/${ingestionId}/energy?startTime=${encodeURIComponent(startISO)}&endTime=${encodeURIComponent(endISO)}&granularity=1d&page=1&pageSize=1000&deep=0`;
    
    // Use ingestionToken for Data API endpoints (data.apps.myio-bas.com)
    // This token provides access to telemetry data from the ingestion system
    const token = params.api.ingestionToken;
    if (!token) {
      throw new Error('ingestionToken is required for Data API calls to data.apps.myio-bas.com');
    }
    
    const response = await fetch(url, {
      headers: {
        // Using ingestionToken for Data API endpoints (data.apps.myio-bas.com)
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  };
};

export class DeviceReportModal {
  private modal: any;
  private authClient: AuthClient;
  private energyFetcher: EnergyFetcher;
  private data: DailyReading[] = [];
  private isLoading = false;
  private eventHandlers: { [key: string]: (() => void)[] } = {};
  private dateRangePicker: DateRangeControl | null = null;

  constructor(private params: OpenDeviceReportParams) {
    this.authClient = new AuthClient({
      clientId: params.api.clientId,
      clientSecret: params.api.clientSecret,
      base: params.api.dataApiBaseUrl
    });
    
    // Use injected fetcher or create default with params
    this.energyFetcher = params.fetcher || createDefaultEnergyFetcher(params);
  }

  public show(): ModalHandle {
    this.modal = createModal({
      title: `Relatório - ${this.params.identifier || 'SEM IDENTIFICADOR'} - ${this.params.label || 'SEM ETIQUETA'}`,
      width: '80vw',
      height: '90vh',
      theme: this.params.ui?.theme || 'light'
    });

    this.renderContent();
    this.modal.on('close', () => {
      // Cleanup DateRangePicker
      if (this.dateRangePicker) {
        this.dateRangePicker.destroy();
        this.dateRangePicker = null;
      }
      
      this.authClient.clearCache();
      this.emit('close');
    });

    return {
      close: () => this.modal.close(),
      on: (event, handler) => this.on(event, handler)
    };
  }

  private renderContent(): void {
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="myio-modal-scope">
        <div style="margin-bottom: 16px;">
          <div style="display: flex; gap: 16px; align-items: end; margin-bottom: 16px;">
            <div class="myio-form-group" style="margin-bottom: 0;">
              <label class="myio-label" for="date-range">Período</label>
              <input type="text" id="date-range" class="myio-input" readonly placeholder="Selecione o período" style="width: 300px;">
            </div>
            <button id="load-btn" class="myio-btn myio-btn-primary">
              <span class="myio-spinner" id="load-spinner" style="display: none;"></span>
              Carregar
            </button>
            <button id="export-btn" class="myio-btn myio-btn-secondary" disabled>
              Exportar CSV
            </button>
          </div>
        </div>
        
        <div id="error-container" style="display: none; background: #ffebee; color: #c62828; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
        </div>
        
        <div id="table-container">
          <div style="text-align: center; padding: 40px; color: var(--myio-text-muted);">
            Selecione um período e clique em "Carregar" para visualizar os dados.
          </div>
        </div>
      </div>
    `;

    this.modal.setContent(content);
    this.setupEventListeners();
  }

  private async setupEventListeners(): Promise<void> {
    const loadBtn = document.getElementById('load-btn') as HTMLButtonElement;
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    const dateRangeInput = document.getElementById('date-range') as HTMLInputElement;

    loadBtn?.addEventListener('click', () => this.loadData());
    exportBtn?.addEventListener('click', () => this.exportCSV());

    // Initialize DateRangePicker with default current month range
    try {
      this.dateRangePicker = await attachDateRangePicker(dateRangeInput, {
        presetStart: this.getDefaultStartDate(),
        presetEnd: this.getDefaultEndDate(),
        maxRangeDays: 31,
        parentEl: this.modal.element,
        onApply: ({ startISO, endISO }) => {
          // Optional: auto-load when date range changes
          this.hideError();
          console.log('Date range selected:', { startISO, endISO });
        }
      });
    } catch (error) {
      console.warn('DateRangePicker initialization failed, using fallback:', error);
      // DateRangePicker will automatically fallback to native inputs
    }
  }

  private async loadData(): Promise<void> {
    if (this.isLoading) return;

    const loadBtn = document.getElementById('load-btn') as HTMLButtonElement;
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    const spinner = document.getElementById('load-spinner');

    // Get date range from DateRangePicker
    if (!this.dateRangePicker) {
      this.showError('Seletor de data não inicializado');
      return;
    }

    this.isLoading = true;
    loadBtn.disabled = true;
    exportBtn.disabled = true;
    spinner!.style.display = 'inline-block';

    try {
      const { startISO, endISO } = this.dateRangePicker.getDates();
      
      if (!startISO || !endISO) {
        this.showError('Selecione um período válido');
        return;
      }

      // Extract date parts for range generation (YYYY-MM-DD format)
      const startDate = startISO.split('T')[0];
      const endDate = endISO.split('T')[0];
      
      // Generate complete date range for zero-filling
      const dateRange = rangeDaysInclusive(startDate, endDate);
      
      // Use injected fetcher (real API or mock for testing)
      const apiResponse = await this.energyFetcher({
        baseUrl: this.params.api.dataApiBaseUrl || 'https://api.data.apps.myio-bas.com',
        ingestionId: this.params.ingestionId,
        startISO,
        endISO
      });
      
      // Process API response
      this.data = this.processApiResponse(apiResponse, dateRange);
      this.renderTable();
      exportBtn.disabled = false;
      
      this.emit('loaded', { 
        date: { start: startDate, end: endDate },
        count: this.data.length,
        total: this.calculateTotal()
      });

    } catch (error) {
      this.showError('Erro ao carregar dados: ' + (error as Error).message);
      console.error('Error loading data:', error);
      this.emit('error', { message: (error as Error).message, context: 'loadData' });
    } finally {
      this.isLoading = false;
      loadBtn.disabled = false;
      spinner!.style.display = 'none';
    }
  }

  private processApiResponse(apiResponse: any, dateRange: string[]): DailyReading[] {
    // Handle response - expect array with data property
    const dataArray = Array.isArray(apiResponse) ? apiResponse : (apiResponse.data || []);
    
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      console.warn("[DeviceReportModal] API returned empty or invalid response, zero-filling date range");
      return dateRange.map(date => ({ date, consumption: 0 }));
    }

    const deviceData = dataArray[0]; // First (and likely only) device
    const consumption = deviceData.consumption || [];

    // Build daily consumption map
    const dailyMap: { [key: string]: number } = {};
    
    consumption.forEach((item: any) => {
      if (item.timestamp && item.value != null) {
        const date = item.timestamp.slice(0, 10); // Extract YYYY-MM-DD
        const value = Number(item.value);
        if (!dailyMap[date]) dailyMap[date] = 0;
        dailyMap[date] += value;
      }
    });

    // Generate complete date range with zero-fill for missing dates
    return dateRange.map(date => ({
      date,
      consumption: dailyMap[date] || 0
    }));
  }

  private generateMockData(dateRange: string[]): DailyReading[] {
    // Fallback mock data generator (kept for compatibility)
    return dateRange.map(date => ({
      date,
      consumption: Math.random() * 50 + 10 // 10-60 kWh
    }));
  }

  private renderTable(): void {
    const container = document.getElementById('table-container');
    if (!container) return;

    const total = this.calculateTotal();
    
    container.innerHTML = `
      <div style="margin-bottom: 16px; padding: 12px; background: var(--myio-bg); border-radius: 6px;">
        <strong>Total: ${fmtPt(total)} kWh</strong>
      </div>
      
      <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--myio-border); border-radius: 6px;">
        <table class="myio-table">
          <thead>
            <tr>
              <th style="cursor: pointer;" data-sort="date">
                Data
                <span style="margin-left: 4px; opacity: 0.5;">↕</span>
              </th>
              <th style="cursor: pointer; text-align: right;" data-sort="consumption">
                Consumo (kWh)
                <span style="margin-left: 4px; opacity: 0.5;">↕</span>
              </th>
            </tr>
          </thead>
          <tbody>
            ${this.data.map(row => `
              <tr>
                <td>${this.formatDate(row.date)}</td>
                <td style="text-align: right;">${fmtPt(row.consumption)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.setupTableSorting();
  }

  private setupTableSorting(): void {
    const headers = document.querySelectorAll('[data-sort]');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const sortKey = header.getAttribute('data-sort') as keyof DailyReading;
        this.sortData(sortKey);
        this.renderTable();
      });
    });
  }

  private sortData(key: keyof DailyReading): void {
    this.data.sort((a, b) => {
      if (key === 'date') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        return a.consumption - b.consumption;
      }
    });
  }

  private calculateTotal(): number {
    return this.data.reduce((sum, row) => sum + row.consumption, 0);
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  }

  private exportCSV(): void {
    const total = this.calculateTotal();
    const now = new Date();
    const timestamp = now.toLocaleDateString('pt-BR') + ' - ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    const csvData = [
      ['Dispositivo/Loja', this.params.identifier || 'N/A', this.params.label || ''],
      ['DATA EMISSÃO', timestamp, ''],
      ['Total', fmtPt(total), ''],
      ['Data', 'Consumo', ''],
      ...this.data.map(row => [this.formatDate(row.date), fmtPt(row.consumption)])
    ];

    const csvContent = toCsv(csvData);
    this.downloadCSV(csvContent, `relatorio-${this.params.identifier || 'dispositivo'}-${new Date().toISOString().split('T')[0]}.csv`);
  }

  private downloadCSV(content: string, filename: string): void {
    // Add UTF-8 BOM to ensure proper encoding of special characters
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + content;
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  }

  private getDefaultEndDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private showError(message: string): void {
    const container = document.getElementById('error-container');
    if (container) {
      container.textContent = message;
      container.style.display = 'block';
    }
  }

  private hideError(): void {
    const container = document.getElementById('error-container');
    if (container) {
      container.style.display = 'none';
    }
  }

  private on(event: string, handler: () => void): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  private emit(event: string, payload?: any): void {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler());
    }
  }
}
