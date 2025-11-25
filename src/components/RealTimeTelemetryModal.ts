/**
 * RFC-0084: Real-Time Telemetry Modal
 *
 * Displays live telemetry values with auto-refresh.
 * Shows instantaneous values (not aggregated) updating every 8 seconds.
 *
 * @module RealTimeTelemetryModal
 */

export interface RealTimeTelemetryParams {
  token: string;                    // JWT token for ThingsBoard authentication
  deviceId: string;                 // ThingsBoard device UUID
  deviceLabel?: string;             // Device name/label (default: "Dispositivo")
  telemetryKeys?: string[];         // Keys to monitor (default: ['voltage', 'current', 'power', 'energy'])
  refreshInterval?: number;         // Update interval in ms (default: 8000)
  historyPoints?: number;           // Number of points in mini-chart (default: 50)
  onClose?: () => void;             // Callback when modal closes
  locale?: 'pt-BR' | 'en-US';       // Locale for formatting (default: 'pt-BR')
}

interface TelemetryValue {
  key: string;
  value: number;
  timestamp: number;
  formatted: string;
  unit: string;
  icon: string;
  label: string;
  trend?: 'up' | 'down' | 'stable';
}

export interface RealTimeTelemetryInstance {
  destroy: () => void;
}

const TELEMETRY_CONFIG: Record<string, { label: string; unit: string; icon: string; decimals: number }> = {
  voltage: { label: 'Tensão', unit: 'V', icon: '⚡', decimals: 1 },
  current: { label: 'Corrente', unit: 'A', icon: '🔌', decimals: 2 },
  power: { label: 'Potência', unit: 'kW', icon: '⚙️', decimals: 2 },
  energy: { label: 'Energia', unit: 'kWh', icon: '📊', decimals: 1 },
  temperature: { label: 'Temperatura', unit: '°C', icon: '🌡️', decimals: 1 },
  activePower: { label: 'Potência Ativa', unit: 'kW', icon: '⚙️', decimals: 2 },
  reactivePower: { label: 'Potência Reativa', unit: 'kVAr', icon: '🔄', decimals: 2 },
  apparentPower: { label: 'Potência Aparente', unit: 'kVA', icon: '📈', decimals: 2 },
  powerFactor: { label: 'Fator de Potência', unit: '', icon: '📐', decimals: 3 }
};

const STRINGS = {
  'pt-BR': {
    title: 'Telemetrias em Tempo Real',
    close: 'Fechar',
    pause: 'Pausar',
    resume: 'Retomar',
    export: 'Exportar CSV',
    autoUpdate: 'Atualização automática',
    lastUpdate: 'Última atualização',
    noData: 'Sem dados',
    loading: 'Carregando...',
    error: 'Erro ao carregar telemetrias',
    trend_up: 'Aumentando',
    trend_down: 'Diminuindo',
    trend_stable: 'Estável'
  },
  'en-US': {
    title: 'Real-Time Telemetry',
    close: 'Close',
    pause: 'Pause',
    resume: 'Resume',
    export: 'Export CSV',
    autoUpdate: 'Auto-update',
    lastUpdate: 'Last update',
    noData: 'No data',
    loading: 'Loading...',
    error: 'Error loading telemetry',
    trend_up: 'Increasing',
    trend_down: 'Decreasing',
    trend_stable: 'Stable'
  }
};

/**
 * Open Real-Time Telemetry Modal
 */
export async function openRealTimeTelemetryModal(params: RealTimeTelemetryParams): Promise<RealTimeTelemetryInstance> {
  const {
    token,
    deviceId,
    deviceLabel = 'Dispositivo',
    telemetryKeys = ['voltage', 'current', 'power', 'energy'],
    refreshInterval = 8000,
    historyPoints = 50,
    onClose,
    locale = 'pt-BR'
  } = params;

  const strings = STRINGS[locale] || STRINGS['pt-BR'];

  let refreshIntervalId: number | null = null;
  let isPaused = false;
  let telemetryHistory: Map<string, Array<{ x: number; y: number }>> = new Map();
  let chart: any = null;

  // Create modal container
  const overlay = document.createElement('div');
  overlay.className = 'myio-realtime-telemetry-overlay';
  overlay.innerHTML = `
    <style>
      .myio-realtime-telemetry-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
        animation: fadeIn 0.2s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .myio-realtime-telemetry-container {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        max-width: 1200px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .myio-realtime-telemetry-header {
        padding: 20px 24px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .myio-realtime-telemetry-title {
        font-size: 20px;
        font-weight: 600;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .myio-realtime-telemetry-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 24px;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .myio-realtime-telemetry-close:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
      }

      .myio-realtime-telemetry-body {
        padding: 24px;
        overflow-y: auto;
        flex: 1;
      }

      .myio-telemetry-cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .myio-telemetry-card {
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
      }

      .myio-telemetry-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      }

      .myio-telemetry-card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        font-size: 14px;
        color: #555;
        font-weight: 500;
      }

      .myio-telemetry-card-icon {
        font-size: 20px;
      }

      .myio-telemetry-card-value {
        font-size: 28px;
        font-weight: 700;
        color: #2c3e50;
        margin-bottom: 4px;
      }

      .myio-telemetry-card-trend {
        font-size: 12px;
        color: #777;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .myio-telemetry-card-trend.up {
        color: #27ae60;
      }

      .myio-telemetry-card-trend.down {
        color: #e74c3c;
      }

      .myio-telemetry-chart-container {
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
      }

      .myio-telemetry-chart-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 16px 0;
        color: #2c3e50;
      }

      .myio-telemetry-chart {
        height: 200px;
      }

      .myio-realtime-telemetry-footer {
        padding: 16px 24px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8f9fa;
      }

      .myio-telemetry-status {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        color: #555;
      }

      .myio-telemetry-status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #27ae60;
        animation: pulse 2s infinite;
      }

      .myio-telemetry-status-indicator.paused {
        background: #e74c3c;
        animation: none;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .myio-telemetry-actions {
        display: flex;
        gap: 12px;
      }

      .myio-telemetry-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .myio-telemetry-btn-primary {
        background: #667eea;
        color: white;
      }

      .myio-telemetry-btn-primary:hover {
        background: #5568d3;
        transform: translateY(-1px);
      }

      .myio-telemetry-btn-secondary {
        background: #e0e0e0;
        color: #333;
      }

      .myio-telemetry-btn-secondary:hover {
        background: #d0d0d0;
        transform: translateY(-1px);
      }

      .myio-telemetry-loading {
        text-align: center;
        padding: 40px;
        color: #999;
        font-size: 16px;
      }

      .myio-telemetry-error {
        text-align: center;
        padding: 40px;
        color: #e74c3c;
        font-size: 16px;
      }
    </style>

    <div class="myio-realtime-telemetry-container">
      <div class="myio-realtime-telemetry-header">
        <h2 class="myio-realtime-telemetry-title">
          ⚡ ${strings.title} - ${deviceLabel}
        </h2>
        <button class="myio-realtime-telemetry-close" id="close-btn" title="${strings.close}">
          ×
        </button>
      </div>

      <div class="myio-realtime-telemetry-body">
        <div class="myio-telemetry-loading" id="loading-state">
          ${strings.loading}
        </div>

        <div id="telemetry-content" style="display: none;">
          <div class="myio-telemetry-cards-grid" id="telemetry-cards"></div>

          <div class="myio-telemetry-chart-container" id="chart-container" style="display: none;">
            <h3 class="myio-telemetry-chart-title" id="chart-title">Potência (últimos 5 min)</h3>
            <canvas class="myio-telemetry-chart" id="telemetry-chart"></canvas>
          </div>
        </div>

        <div class="myio-telemetry-error" id="error-state" style="display: none;">
          ${strings.error}
        </div>
      </div>

      <div class="myio-realtime-telemetry-footer">
        <div class="myio-telemetry-status">
          <span class="myio-telemetry-status-indicator" id="status-indicator"></span>
          <span id="status-text">${strings.autoUpdate}: ON</span>
          <span>•</span>
          <span id="last-update-text">${strings.lastUpdate}: --:--:--</span>
        </div>

        <div class="myio-telemetry-actions">
          <button class="myio-telemetry-btn myio-telemetry-btn-secondary" id="pause-btn">
            <span id="pause-btn-icon">⏸️</span>
            <span id="pause-btn-text">${strings.pause}</span>
          </button>
          <button class="myio-telemetry-btn myio-telemetry-btn-primary" id="export-btn">
            ⬇️ ${strings.export}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Get DOM elements
  const closeBtn = document.getElementById('close-btn') as HTMLButtonElement;
  const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
  const pauseBtnIcon = document.getElementById('pause-btn-icon') as HTMLSpanElement;
  const pauseBtnText = document.getElementById('pause-btn-text') as HTMLSpanElement;
  const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
  const loadingState = document.getElementById('loading-state') as HTMLDivElement;
  const telemetryContent = document.getElementById('telemetry-content') as HTMLDivElement;
  const errorState = document.getElementById('error-state') as HTMLDivElement;
  const telemetryCards = document.getElementById('telemetry-cards') as HTMLDivElement;
  const chartContainer = document.getElementById('chart-container') as HTMLDivElement;
  const chartCanvas = document.getElementById('telemetry-chart') as HTMLCanvasElement;
  const statusIndicator = document.getElementById('status-indicator') as HTMLSpanElement;
  const statusText = document.getElementById('status-text') as HTMLSpanElement;
  const lastUpdateText = document.getElementById('last-update-text') as HTMLSpanElement;

  /**
   * Close modal
   */
  function closeModal() {
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }

    if (chart) {
      chart.destroy();
      chart = null;
    }

    overlay.remove();

    if (onClose) {
      onClose();
    }
  }

  /**
   * Fetch latest telemetry values
   */
  async function fetchLatestTelemetry(): Promise<Record<string, any>> {
    const keys = telemetryKeys.join(',');
    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${keys}&limit=1&agg=NONE`;

    const response = await fetch(url, {
      headers: {
        'X-Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch telemetry: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Process telemetry response into TelemetryValue array
   */
  function processTelemetryData(data: Record<string, any>): TelemetryValue[] {
    const values: TelemetryValue[] = [];

    for (const key of telemetryKeys) {
      const telemetryData = data[key];
      if (!telemetryData || telemetryData.length === 0) continue;

      const latest = telemetryData[0];
      const config = TELEMETRY_CONFIG[key] || { label: key, unit: '', icon: '📊', decimals: 2 };

      const numValue = Number(latest.value) || 0;
      const formatted = numValue.toFixed(config.decimals);

      values.push({
        key,
        value: numValue,
        timestamp: latest.ts,
        formatted: `${formatted} ${config.unit}`,
        unit: config.unit,
        icon: config.icon,
        label: config.label,
        trend: 'stable' // Will be calculated based on history
      });
    }

    return values;
  }

  /**
   * Calculate trend based on history
   */
  function calculateTrend(key: string, currentValue: number): 'up' | 'down' | 'stable' {
    const history = telemetryHistory.get(key);
    if (!history || history.length < 2) return 'stable';

    const previousValue = history[history.length - 2].y;
    const diff = currentValue - previousValue;
    const threshold = previousValue * 0.02; // 2% threshold

    if (diff > threshold) return 'up';
    if (diff < -threshold) return 'down';
    return 'stable';
  }

  /**
   * Update telemetry cards
   */
  function updateTelemetryCards(values: TelemetryValue[]) {
    telemetryCards.innerHTML = values.map(tel => {
      const trend = calculateTrend(tel.key, tel.value);
      const trendIcon = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
      const trendClass = trend;
      const trendLabel = strings[`trend_${trend}` as keyof typeof strings] || '';

      return `
        <div class="myio-telemetry-card">
          <div class="myio-telemetry-card-header">
            <span class="myio-telemetry-card-icon">${tel.icon}</span>
            <span>${tel.label}</span>
          </div>
          <div class="myio-telemetry-card-value">${tel.formatted}</div>
          <div class="myio-telemetry-card-trend ${trendClass}">
            ${trendIcon} ${trendLabel}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Update history and chart
   */
  function updateHistory(values: TelemetryValue[]) {
    const now = Date.now();

    for (const tel of values) {
      if (!telemetryHistory.has(tel.key)) {
        telemetryHistory.set(tel.key, []);
      }

      const history = telemetryHistory.get(tel.key)!;
      history.push({ x: now, y: tel.value });

      // Keep only last N points
      if (history.length > historyPoints) {
        history.shift();
      }
    }

    // Update chart for 'power' key if available
    if (telemetryHistory.has('power') && chart) {
      const powerHistory = telemetryHistory.get('power')!;
      chart.data.datasets[0].data = powerHistory;
      chart.update('none');
    }
  }

  /**
   * Initialize mini-chart for power
   */
  function initializeChart() {
    const Chart = (window as any).Chart;
    if (!Chart) {
      console.warn('[RealTimeTelemetry] Chart.js not loaded');
      return;
    }

    chartContainer.style.display = 'block';

    chart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Potência',
          data: [],
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function(context: any) {
                const timestamp = context[0].parsed.x;
                const date = new Date(timestamp);
                return date.toLocaleTimeString(locale);
              },
              label: function(context: any) {
                return `${context.parsed.y.toFixed(2)} kW`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            ticks: {
              callback: function(value: any) {
                const date = new Date(value);
                return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
              }
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'kW'
            }
          }
        }
      }
    });
  }

  /**
   * Refresh telemetry data
   */
  async function refreshData() {
    try {
      const data = await fetchLatestTelemetry();
      const values = processTelemetryData(data);

      updateHistory(values);
      updateTelemetryCards(values);

      // Update last update time
      const now = new Date();
      lastUpdateText.textContent = `${strings.lastUpdate}: ${now.toLocaleTimeString(locale)}`;

      // Show content if hidden
      if (loadingState.style.display !== 'none') {
        loadingState.style.display = 'none';
        telemetryContent.style.display = 'block';

        // Initialize chart after first successful fetch
        if (telemetryKeys.includes('power')) {
          initializeChart();
        }
      }

    } catch (error) {
      console.error('[RealTimeTelemetry] Error fetching data:', error);
      errorState.style.display = 'block';
      loadingState.style.display = 'none';
      telemetryContent.style.display = 'none';
    }
  }

  /**
   * Toggle pause/resume
   */
  function togglePause() {
    isPaused = !isPaused;

    if (isPaused) {
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
      }
      pauseBtnIcon.textContent = '▶️';
      pauseBtnText.textContent = strings.resume;
      statusIndicator.classList.add('paused');
      statusText.textContent = `${strings.autoUpdate}: OFF`;
    } else {
      refreshIntervalId = window.setInterval(refreshData, refreshInterval);
      pauseBtnIcon.textContent = '⏸️';
      pauseBtnText.textContent = strings.pause;
      statusIndicator.classList.remove('paused');
      statusText.textContent = `${strings.autoUpdate}: ON`;
    }
  }

  /**
   * Export telemetry history to CSV
   */
  function exportToCSV() {
    const rows: string[] = [];
    rows.push('Timestamp,' + telemetryKeys.map(k => TELEMETRY_CONFIG[k]?.label || k).join(','));

    // Find max history length
    let maxLength = 0;
    for (const key of telemetryKeys) {
      const history = telemetryHistory.get(key);
      if (history && history.length > maxLength) {
        maxLength = history.length;
      }
    }

    // Build CSV rows
    for (let i = 0; i < maxLength; i++) {
      const row: string[] = [];
      let timestamp = '';

      for (const key of telemetryKeys) {
        const history = telemetryHistory.get(key);
        if (history && history[i]) {
          if (!timestamp) {
            timestamp = new Date(history[i].x).toISOString();
          }
          row.push(history[i].y.toFixed(2));
        } else {
          row.push('');
        }
      }

      if (timestamp) {
        rows.push(timestamp + ',' + row.join(','));
      }
    }

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry_${deviceLabel}_${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Event listeners
  closeBtn.addEventListener('click', closeModal);
  pauseBtn.addEventListener('click', togglePause);
  exportBtn.addEventListener('click', exportToCSV);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  // Initial data fetch
  await refreshData();

  // Start auto-refresh
  refreshIntervalId = window.setInterval(refreshData, refreshInterval);

  return {
    destroy: closeModal
  };
}
