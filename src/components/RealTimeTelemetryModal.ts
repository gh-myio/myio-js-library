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
  telemetryKeys?: string[];         // Keys to monitor (default: ['voltage_a', 'voltage_b', 'voltage_c', 'total_current', 'consumption'])
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
  // Voltage phases
  voltage_a: { label: 'Tensão Fase A', unit: 'V', icon: '⚡', decimals: 1 },
  voltage_b: { label: 'Tensão Fase B', unit: 'V', icon: '⚡', decimals: 1 },
  voltage_c: { label: 'Tensão Fase C', unit: 'V', icon: '⚡', decimals: 1 },

  // Current
  total_current: { label: 'Corrente Total', unit: 'A', icon: '🔌', decimals: 2 },
  current: { label: 'Corrente', unit: 'A', icon: '🔌', decimals: 2 },

  // Power and Energy
  consumption: { label: 'Potência', unit: 'W', icon: '⚙️', decimals: 0 },
  power: { label: 'Potência', unit: 'W', icon: '⚙️', decimals: 0 },
  energy: { label: 'Energia', unit: 'kWh', icon: '📊', decimals: 1 },
  activePower: { label: 'Potência Ativa', unit: 'kW', icon: '⚙️', decimals: 2 },
  reactivePower: { label: 'Potência Reativa', unit: 'kVAr', icon: '🔄', decimals: 2 },
  apparentPower: { label: 'Potência Aparente', unit: 'kVA', icon: '📈', decimals: 2 },
  powerFactor: { label: 'Fator de Potência', unit: '', icon: '📐', decimals: 3 },

  // Temperature
  temperature: { label: 'Temperatura', unit: '°C', icon: '🌡️', decimals: 1 }
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
    telemetryKeys = ['voltage_a', 'voltage_b', 'voltage_c', 'total_current', 'consumption'],
    refreshInterval = 8000,
    historyPoints = 50,
    onClose,
    locale = 'pt-BR'
  } = params;

  const strings = STRINGS[locale] || STRINGS['pt-BR'];

  let refreshIntervalId: number | null = null;
  let isPaused = false;
  let telemetryHistory: Map<string, Array<{ x: number; y: number }>> = new Map();
  let lastKnownValues: Map<string, number> = new Map(); // Store last known value for each key
  let chart: any = null;
  let selectedChartKey: string = 'consumption'; // Default chart key
  let currentTheme: 'light' | 'dark' = 'light';
  let isExpanded = false;

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
        padding: 4px 12px;
        border-bottom: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #3e1a7d;
        color: white;
        border-radius: 12px 12px 0 0;
        min-height: 20px;
      }

      .myio-realtime-telemetry-title {
        font-size: 18px;
        font-weight: 600;
        margin: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: white;
        line-height: 2;
      }

      .myio-rtt-device-label {
        font-size: 13px;
        font-weight: 400;
        opacity: 0.75;
        background: rgba(255,255,255,0.15);
        border-radius: 4px;
        padding: 2px 8px;
        margin-left: 4px;
      }

      .myio-rtt-header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .myio-rtt-header-btn {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.8);
        font-size: 20px;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s ease, color 0.2s ease;
        position: relative;
        overflow: hidden;
        padding: 0;
      }

      .myio-rtt-header-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: white;
      }

      .myio-rtt-theme-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 18px;
        height: 18px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .myio-rtt-theme-icon-sun {
        transform: translate(-50%, -50%) rotate(-90deg) scale(0);
        opacity: 0;
      }

      .myio-rtt-theme-icon-moon {
        transform: translate(-50%, -50%) rotate(0deg) scale(1);
        opacity: 1;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-rtt-theme-icon-sun {
        transform: translate(-50%, -50%) rotate(0deg) scale(1);
        opacity: 1;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-rtt-theme-icon-moon {
        transform: translate(-50%, -50%) rotate(90deg) scale(0);
        opacity: 0;
      }

      /* Dark theme */
      .myio-realtime-telemetry-container[data-theme="dark"] {
        background: #1a1a2e;
        color: #e0e0e0;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-card {
        background: linear-gradient(135deg, #16213e 0%, #0f3460 100%);
        color: #e0e0e0;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-card-header {
        color: #aaa;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-card-value {
        color: #ffffff;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-chart-container {
        background: #16213e;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-chart-title {
        color: #e0e0e0;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-selector {
        background: #0f3460;
        border-color: rgba(255,255,255,0.2);
        color: #e0e0e0;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-realtime-telemetry-footer {
        background: #0f3460;
        border-top: 1px solid rgba(255,255,255,0.1);
        color: #e0e0e0;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-status {
        color: #aaa;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-btn-secondary {
        background: rgba(255,255,255,0.1);
        color: #e0e0e0;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-btn-secondary:hover {
        background: rgba(255,255,255,0.2);
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-realtime-telemetry-body {
        background: #1a1a2e;
      }

      /* Expanded state */
      .myio-realtime-telemetry-overlay.rtt-expanded {
        padding: 0;
      }

      .myio-realtime-telemetry-overlay.rtt-expanded .myio-realtime-telemetry-container {
        max-width: 100vw;
        max-height: 100vh;
        width: 100%;
        height: 100%;
        border-radius: 0;
      }

      .myio-realtime-telemetry-overlay.rtt-expanded .myio-realtime-telemetry-header {
        border-radius: 0;
      }

      .myio-realtime-telemetry-overlay.rtt-expanded .myio-telemetry-chart-container {
        max-height: none;
        flex: 1;
      }

      .myio-realtime-telemetry-overlay.rtt-expanded .myio-realtime-telemetry-body {
        display: flex;
        flex-direction: column;
      }

      .myio-realtime-telemetry-overlay.rtt-expanded .myio-telemetry-chart {
        height: 100%;
        max-height: none;
        flex: 1;
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
        max-height: 442px;
        overflow: hidden;
      }

      .myio-telemetry-chart-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 16px 0;
        color: #2c3e50;
      }

      .myio-telemetry-chart {
        height: 255px;
        max-height: 382px;
        width: 100%;
      }

      .myio-telemetry-selector {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        background: white;
        cursor: pointer;
        transition: border-color 0.2s;
      }

      .myio-telemetry-selector:hover {
        border-color: #667eea;
      }

      .myio-telemetry-selector:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
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
          ⚡ ${strings.title}${deviceLabel ? `<span class="myio-rtt-device-label">${deviceLabel}</span>` : ''}
        </h2>
        <div class="myio-rtt-header-actions">
          <button class="myio-rtt-header-btn" id="rtt-theme-btn" title="Alternar tema (claro/escuro)">
            <svg class="myio-rtt-theme-icon myio-rtt-theme-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg class="myio-rtt-theme-icon myio-rtt-theme-icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
          <button class="myio-rtt-header-btn" id="rtt-expand-btn" title="Expandir / Restaurar">
            <svg id="rtt-expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;">
              <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
          </button>
          <button class="myio-rtt-header-btn" id="close-btn" title="${strings.close}">×</button>
        </div>
      </div>

      <div class="myio-realtime-telemetry-body">
        <div class="myio-telemetry-loading" id="loading-state">
          ${strings.loading}
        </div>

        <div id="telemetry-content" style="display: none;">
          <div class="myio-telemetry-cards-grid" id="telemetry-cards"></div>

          <div class="myio-telemetry-chart-container" id="chart-container" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 class="myio-telemetry-chart-title" id="chart-title" style="margin: 0;">Histórico de Telemetria</h3>
              <select id="chart-key-selector" class="myio-telemetry-selector">
                <option value="consumption">Potência</option>
                <option value="total_current">Corrente Total</option>
                <option value="voltage_a">Tensão Fase A</option>
                <option value="voltage_b">Tensão Fase B</option>
                <option value="voltage_c">Tensão Fase C</option>
              </select>
            </div>
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

  // Get DOM elements (use querySelector within overlay to avoid conflicts)
  const closeBtn = overlay.querySelector('#close-btn') as HTMLButtonElement;
  const themeBtn = overlay.querySelector('#rtt-theme-btn') as HTMLButtonElement;
  const expandBtn = overlay.querySelector('#rtt-expand-btn') as HTMLButtonElement;
  const expandIcon = overlay.querySelector('#rtt-expand-icon') as unknown as SVGElement;
  const container = overlay.querySelector('.myio-realtime-telemetry-container') as HTMLDivElement;
  const pauseBtn = overlay.querySelector('#pause-btn') as HTMLButtonElement;
  const pauseBtnIcon = overlay.querySelector('#pause-btn-icon') as HTMLSpanElement;
  const pauseBtnText = overlay.querySelector('#pause-btn-text') as HTMLSpanElement;
  const exportBtn = overlay.querySelector('#export-btn') as HTMLButtonElement;
  const loadingState = overlay.querySelector('#loading-state') as HTMLDivElement;
  const telemetryContent = overlay.querySelector('#telemetry-content') as HTMLDivElement;
  const errorState = overlay.querySelector('#error-state') as HTMLDivElement;
  const telemetryCards = overlay.querySelector('#telemetry-cards') as HTMLDivElement;
  const chartContainer = overlay.querySelector('#chart-container') as HTMLDivElement;
  const chartCanvas = overlay.querySelector('#telemetry-chart') as HTMLCanvasElement;
  const chartKeySelector = overlay.querySelector('#chart-key-selector') as HTMLSelectElement;
  const statusIndicator = overlay.querySelector('#status-indicator') as HTMLSpanElement;
  const statusText = overlay.querySelector('#status-text') as HTMLSpanElement;
  const lastUpdateText = overlay.querySelector('#last-update-text') as HTMLSpanElement;

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

      let numValue = Number(latest.value) || 0;

      // RFC-0086: Convert mA to A for current values (API returns milliamps)
      if (key === 'total_current' || key === 'current') {
        numValue = numValue / 1000;
      }

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
   * If a telemetry value is missing, repeat the last known value
   */
  function updateHistory(values: TelemetryValue[]) {
    const now = Date.now();

    // Update values that we received
    for (const tel of values) {
      if (!telemetryHistory.has(tel.key)) {
        telemetryHistory.set(tel.key, []);
      }

      const history = telemetryHistory.get(tel.key)!;
      history.push({ x: now, y: tel.value });

      // Store last known value
      lastKnownValues.set(tel.key, tel.value);

      // Keep only last N points
      if (history.length > historyPoints) {
        history.shift();
      }
    }

    // For telemetries that didn't get updated, repeat last known value
    for (const key of telemetryKeys) {
      const receivedKeys = values.map(v => v.key);

      if (!receivedKeys.includes(key) && lastKnownValues.has(key)) {
        if (!telemetryHistory.has(key)) {
          telemetryHistory.set(key, []);
        }

        const history = telemetryHistory.get(key)!;
        const lastValue = lastKnownValues.get(key)!;

        history.push({ x: now, y: lastValue });

        // Keep only last N points
        if (history.length > historyPoints) {
          history.shift();
        }
      }
    }

    // Update chart for selected key if available
    if (telemetryHistory.has(selectedChartKey) && chart) {
      const selectedHistory = telemetryHistory.get(selectedChartKey)!;
      chart.data.datasets[0].data = selectedHistory;
      chart.update('none');
    }
  }

  /**
   * Get formatted value with appropriate unit
   */
  function getFormattedValue(key: string, value: number): string {
    const config = TELEMETRY_CONFIG[key];
    if (!config) return value.toFixed(2);

    // Special formatting for consumption/power (show in W, format to kW if > 1000)
    if (key === 'consumption' || key === 'power') {
      if (value >= 1000) {
        return `${(value / 1000).toFixed(2)} kW`;
      }
      return `${value.toFixed(0)} W`;
    }

    return `${value.toFixed(config.decimals)} ${config.unit}`;
  }

  /**
   * Initialize chart for selected telemetry key
   */
  function initializeChart() {
    const Chart = (window as any).Chart;
    if (!Chart) {
      console.warn('[RealTimeTelemetry] Chart.js not loaded');
      return;
    }

    chartContainer.style.display = 'block';

    const config = TELEMETRY_CONFIG[selectedChartKey] || { label: selectedChartKey, unit: '' };

    chart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        datasets: [{
          label: config.label,
          data: [],
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function(context: any) {
                const timestamp = context[0].parsed.x;
                const date = new Date(timestamp);
                return date.toLocaleString(locale, {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
              },
              label: function(context: any) {
                const value = context.parsed.y;
                return getFormattedValue(selectedChartKey, value);
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            ticks: {
              maxRotation: 45,
              minRotation: 0,
              callback: function(value: any) {
                const date = new Date(value);
                return date.toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
              }
            },
            title: {
              display: true,
              text: 'Hora'
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value: any) {
                // Format Y-axis based on selected key
                if (selectedChartKey === 'consumption' || selectedChartKey === 'power') {
                  if (value >= 1000) {
                    return `${(value / 1000).toFixed(1)} kW`;
                  }
                  return `${value} W`;
                }
                return `${value} ${config.unit}`;
              }
            },
            title: {
              display: true,
              text: selectedChartKey === 'consumption' || selectedChartKey === 'power' ? 'W' : config.unit
            }
          }
        }
      }
    });
  }

  /**
   * Update chart with new selected key
   */
  function updateChartKey(newKey: string) {
    selectedChartKey = newKey;

    if (chart) {
      chart.destroy();
      chart = null;
    }

    initializeChart();

    // Update chart data if history exists
    if (telemetryHistory.has(selectedChartKey)) {
      const selectedHistory = telemetryHistory.get(selectedChartKey)!;
      chart.data.datasets[0].data = selectedHistory;
      chart.update('none');
    }
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

        // Initialize chart after first successful fetch (always show chart)
        initializeChart();
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

  /**
   * Toggle light/dark theme
   */
  function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    if (currentTheme === 'dark') {
      container.setAttribute('data-theme', 'dark');
    } else {
      container.removeAttribute('data-theme');
    }
  }

  /**
   * Toggle expanded / normal state
   */
  function toggleExpand() {
    isExpanded = !isExpanded;
    overlay.classList.toggle('rtt-expanded', isExpanded);
    // Swap icon: expand ↔ compress
    if (expandIcon) {
      expandIcon.innerHTML = isExpanded
        ? '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="10" y1="14" x2="3" y2="21"></line><line x1="21" y1="3" x2="14" y2="10"></line>'
        : '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
    }
    // Resize chart after layout settles
    if (chart) {
      setTimeout(() => chart.resize(), 50);
    }
  }

  // Event listeners
  closeBtn.addEventListener('click', closeModal);
  themeBtn?.addEventListener('click', toggleTheme);
  expandBtn?.addEventListener('click', toggleExpand);
  pauseBtn.addEventListener('click', togglePause);
  exportBtn.addEventListener('click', exportToCSV);
  chartKeySelector.addEventListener('change', (e) => {
    const newKey = (e.target as HTMLSelectElement).value;
    updateChartKey(newKey);
  });

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
