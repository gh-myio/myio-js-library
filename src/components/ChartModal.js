/**
 * MYIO ChartModal Component
 * Interactive chart modal for comparative visualization with Chart.js integration, export functionality, and full accessibility support
 * 
 * @version 1.0.0
 * @author MYIO Frontend Guild
 */

class MyIOChartModalClass {
  constructor() {
    this.isOpen = false;
    this.modalElement = null;
    this.chartInstance = null;
    this.currentData = null;
    this.chartConfig = {
      type: 'line',
      timeRange: 7,
      maxEntities: 20
    };
    
    this._init();
  }

  // Public Methods
  async open(data) {
    if (!data || !data.entities || data.entities.length === 0) {
      console.warn('ChartModal: No data provided for comparison');
      return;
    }

    if (data.count > this.chartConfig.maxEntities) {
      this._showTooManyEntitiesWarning(data);
      return;
    }

    this.currentData = data;
    this.isOpen = true;

    await this._createModal();
    await this._loadChartJS();
    await this._renderChart();
    
    this._trackEvent('chart_modal.open', { 
      entityCount: data.count,
      chartType: this.chartConfig.type,
      timeRange: this.chartConfig.timeRange
    });
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }

    // Restore focus to body
    if (typeof document !== 'undefined') {
      document.body.focus();
    }

    this._trackEvent('chart_modal.close', {
      entityCount: this.currentData?.count || 0
    });
  }

  // Export Functions
  exportCsv() {
    if (!this.currentData) return;

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `comparativo_${timestamp}.csv`;
    
    const csvData = this._generateCsvData();
    this._downloadFile(csvData, filename, 'text/csv');
    
    this._trackEvent('chart_modal.export', { 
      format: 'csv',
      entityCount: this.currentData.count
    });
  }

  exportPng() {
    if (!this.chartInstance) return;

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `grafico_comparativo_${timestamp}.png`;
    
    const canvas = this.chartInstance.canvas;
    const url = canvas.toDataURL('image/png');
    
    this._downloadFile(url, filename, 'image/png', true);
    
    this._trackEvent('chart_modal.export', { 
      format: 'png',
      entityCount: this.currentData.count
    });
  }

  exportPdf() {
    // Placeholder implementation
    this._showNotImplementedNotice('PDF export');
    
    this._trackEvent('chart_modal.export', { 
      format: 'pdf',
      entityCount: this.currentData?.count || 0,
      status: 'not_implemented'
    });
  }

  // Private Methods
  _init() {
    // Auto-integrate with SelectionStore
    const store = this._getSelectionStore();
    if (store) {
      store.on('comparison:open', (data) => this.open(data));
      store.on('comparison:too_many', (data) => this._showTooManyEntitiesWarning(data));
    }
  }

  async _createModal() {
    if (typeof document === 'undefined') return;

    // Remove existing modal if any
    const existing = document.getElementById('myio-chart-modal');
    if (existing) {
      existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'myio-chart-modal';
    modal.className = 'chart-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'chart-modal-title');

    modal.innerHTML = this._generateModalHTML();
    
    document.body.appendChild(modal);
    this.modalElement = modal;

    // Attach event listeners
    this._attachModalEventListeners();
    
    // Focus management
    this._trapFocus();
    
    // Announce to screen readers
    this._announceToScreenReader('Chart comparison modal opened');
  }

  _generateModalHTML() {
    const { entities, totals, count } = this.currentData;
    
    return `
      <div class="chart-modal-container">
        <div class="chart-modal-header">
          <h2 id="chart-modal-title">Comparativo de Dispositivos (${count} selecionados)</h2>
          <button class="chart-modal-close" aria-label="Fechar modal">×</button>
        </div>
        
        <div class="chart-modal-controls">
          <div class="chart-type-controls">
            <label>Tipo de Gráfico:</label>
            <select class="chart-type-select" aria-label="Selecionar tipo de gráfico">
              <option value="line" ${this.chartConfig.type === 'line' ? 'selected' : ''}>Linha</option>
              <option value="bar" ${this.chartConfig.type === 'bar' ? 'selected' : ''}>Barras</option>
            </select>
          </div>
          
          <div class="chart-range-controls">
            <label>Período:</label>
            <select class="chart-range-select" aria-label="Selecionar período">
              <option value="7" ${this.chartConfig.timeRange === 7 ? 'selected' : ''}>7 dias</option>
              <option value="14" ${this.chartConfig.timeRange === 14 ? 'selected' : ''}>14 dias</option>
              <option value="30" ${this.chartConfig.timeRange === 30 ? 'selected' : ''}>30 dias</option>
            </select>
          </div>
          
          <div class="chart-export-controls">
            <button class="export-csv-btn">Exportar CSV</button>
            <button class="export-png-btn">Exportar PNG</button>
            <button class="export-pdf-btn">Exportar PDF</button>
          </div>
        </div>
        
        <div class="chart-modal-body">
          <div class="chart-container">
            <canvas id="comparison-chart" aria-label="Gráfico comparativo de dispositivos"></canvas>
          </div>
          
          <div class="chart-summary">
            <h3>Resumo da Seleção</h3>
            <div class="summary-grid">
              ${this._generateSummaryHTML(totals)}
            </div>
          </div>
        </div>
        
        <div class="chart-modal-footer">
          <button class="chart-modal-close-btn">Fechar</button>
        </div>
      </div>
    `;
  }

  _generateSummaryHTML(totals) {
    const items = [];
    
    if (totals.energyKwh > 0) {
      items.push(`<div class="summary-item">
        <span class="summary-label">Energia Total:</span>
        <span class="summary-value">${this._formatNumber(totals.energyKwh)} kWh</span>
      </div>`);
    }
    
    if (totals.waterM3 > 0) {
      items.push(`<div class="summary-item">
        <span class="summary-label">Água Total:</span>
        <span class="summary-value">${this._formatNumber(totals.waterM3)} m³</span>
      </div>`);
    }
    
    if (totals.tempC > 0) {
      items.push(`<div class="summary-item">
        <span class="summary-label">Temperatura Média:</span>
        <span class="summary-value">${this._formatNumber(totals.tempC / totals.count)} °C</span>
      </div>`);
    }
    
    items.push(`<div class="summary-item">
      <span class="summary-label">Dispositivos:</span>
      <span class="summary-value">${totals.count}</span>
    </div>`);
    
    return items.join('');
  }

  _attachModalEventListeners() {
    if (!this.modalElement) return;

    // Close buttons
    const closeButtons = this.modalElement.querySelectorAll('.chart-modal-close, .chart-modal-close-btn');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // Chart type change
    const typeSelect = this.modalElement.querySelector('.chart-type-select');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.chartConfig.type = e.target.value;
        this._renderChart();
        this._trackEvent('chart_modal.type_change', { 
          newType: e.target.value,
          entityCount: this.currentData.count
        });
      });
    }

    // Time range change
    const rangeSelect = this.modalElement.querySelector('.chart-range-select');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => {
        this.chartConfig.timeRange = parseInt(e.target.value);
        this._renderChart();
        this._trackEvent('chart_modal.range_change', { 
          newRange: e.target.value,
          entityCount: this.currentData.count
        });
      });
    }

    // Export buttons
    const csvBtn = this.modalElement.querySelector('.export-csv-btn');
    const pngBtn = this.modalElement.querySelector('.export-png-btn');
    const pdfBtn = this.modalElement.querySelector('.export-pdf-btn');
    
    if (csvBtn) csvBtn.addEventListener('click', () => this.exportCsv());
    if (pngBtn) pngBtn.addEventListener('click', () => this.exportPng());
    if (pdfBtn) pdfBtn.addEventListener('click', () => this.exportPdf());

    // Keyboard events
    this.modalElement.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });

    // Click outside to close
    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.close();
      }
    });
  }

  async _loadChartJS() {
    // Check if Chart.js is already loaded
    if (typeof globalThis !== 'undefined' && globalThis.Chart) {
      return;
    }

    // Load Chart.js from CDN
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async _renderChart() {
    if (typeof globalThis === 'undefined' || !globalThis.Chart) {
      console.error('Chart.js not loaded');
      return;
    }

    const canvas = this.modalElement?.querySelector('#comparison-chart');
    if (!canvas) return;

    // Destroy existing chart
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    // Get time series data
    const store = this._getSelectionStore();
    const entityIds = this.currentData.entities.map(e => e.id);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - this.chartConfig.timeRange);

    let timeSeriesData = {};
    if (store && store.getTimeSeriesData) {
      timeSeriesData = await store.getTimeSeriesData(entityIds, startDate, endDate);
    }

    // Prepare chart data
    const chartData = this._prepareChartData(timeSeriesData);
    
    // Create chart
    this.chartInstance = new globalThis.Chart(canvas, {
      type: this.chartConfig.type,
      data: chartData,
      options: this._getChartOptions()
    });
  }

  _prepareChartData(timeSeriesData) {
    const datasets = [];
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
    ];

    this.currentData.entities.forEach((entity, index) => {
      const data = timeSeriesData[entity.id] || [];
      const color = colors[index % colors.length];

      datasets.push({
        label: entity.name,
        data: data.map(point => ({
          x: point.timestamp,
          y: point.value
        })),
        borderColor: color,
        backgroundColor: color + '20',
        fill: this.chartConfig.type === 'line' ? false : true
      });
    });

    return {
      datasets
    };
  }

  _getChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day'
          },
          title: {
            display: true,
            text: 'Data'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Valor'
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: `Comparativo - ${this.chartConfig.timeRange} dias`
        },
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    };
  }

  _generateCsvData() {
    const headers = ['Data', 'Dispositivo', 'Valor', 'Unidade'];
    const rows = [headers];

    this.currentData.entities.forEach(entity => {
      // Add mock data for CSV export
      const today = new Date();
      for (let i = 0; i < this.chartConfig.timeRange; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const value = Math.random() * 100 + 50; // Mock value
        
        rows.push([
          date.toLocaleDateString('pt-BR'),
          entity.name,
          this._formatNumber(value),
          entity.unit || ''
        ]);
      }
    });

    return rows.map(row => row.join(';')).join('\n');
  }

  _downloadFile(data, filename, mimeType, isDataUrl = false) {
    if (typeof document === 'undefined') return;

    const link = document.createElement('a');
    
    if (isDataUrl) {
      link.href = data;
    } else {
      const blob = new Blob([data], { type: mimeType });
      link.href = URL.createObjectURL(blob);
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (!isDataUrl) {
      URL.revokeObjectURL(link.href);
    }
  }

  _showTooManyEntitiesWarning(data) {
    if (typeof document === 'undefined') return;

    const message = `Muitos dispositivos selecionados (${data.count}). Máximo permitido: ${this.chartConfig.maxEntities}.`;
    
    // Simple alert for now - could be enhanced with a custom modal
    if (typeof globalThis !== 'undefined' && globalThis.alert) {
      globalThis.alert(message);
    }
    
    this._announceToScreenReader(message);
  }

  _showNotImplementedNotice(feature) {
    const message = `${feature} será implementado em uma versão futura.`;
    if (typeof globalThis !== 'undefined' && globalThis.alert) {
      globalThis.alert(message);
    }
    this._announceToScreenReader(message);
  }

  _trapFocus() {
    if (!this.modalElement || typeof document === 'undefined') return;

    const focusableElements = this.modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    if (firstElement) {
      firstElement.focus();
    }

    // Trap focus within modal
    this.modalElement.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && typeof document !== 'undefined') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    });
  }

  _getSelectionStore() {
    // Try to get from global scope
    if (typeof globalThis !== 'undefined' && globalThis.window?.MyIOSelectionStore) {
      return globalThis.window.MyIOSelectionStore;
    }
    
    return null;
  }

  _trackEvent(eventName, payload = {}) {
    const store = this._getSelectionStore();
    if (store && store.trackEvent) {
      store.trackEvent(eventName, payload);
    }
  }

  _announceToScreenReader(message) {
    const store = this._getSelectionStore();
    if (store && store.announceToScreenReader) {
      store.announceToScreenReader(message);
    }
  }

  _formatNumber(value) {
    if (typeof value !== 'number' || isNaN(value)) return '0';
    
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }
}

// Create singleton instance
const MyIOChartModal = new MyIOChartModalClass();

// Export to global scope for browser usage
if (typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined') {
  globalThis.window.MyIOChartModal = MyIOChartModal;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MyIOChartModal };
}

// Export for ES modules
export { MyIOChartModal };
