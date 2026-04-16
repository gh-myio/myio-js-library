/**
 * RFC-0084: Real-Time Telemetry Modal
 *
 * Displays live telemetry values with auto-refresh.
 * Shows instantaneous values (not aggregated) updating every 8 seconds.
 *
 * @module RealTimeTelemetryModal
 */

import {
  attach as attachDateRangePicker,
  type DateRangeControl,
} from './premium-modals/internal/DateRangePickerJQ';

export interface RealTimeTelemetryParams {
  token: string; // JWT token for ThingsBoard authentication
  deviceId: string; // ThingsBoard device UUID
  tbBaseUrl?: string; // ThingsBoard base URL (default: '' = relative to current origin)
  deviceLabel?: string; // Device name/label (default: "Dispositivo")
  deviceName?: string; // Device identifier for check_device endpoint (default: deviceLabel)
  customerName?: string; // Customer display name shown as badge in the modal header
  centralId?: string; // Gateway central ID for check_device polling
  customerId?: string; // TB customer UUID — used to read/save polling interval attribute
  userEmail?: string; // Logged-in user email — shows gear button if @myio.com.br
  telemetryKeys?: string[]; // Keys to monitor (default: ['voltage_a', 'voltage_b', 'voltage_c', 'total_current', 'consumption'])
  refreshInterval?: number; // Fallback refresh interval when centralId not provided (default: 30000)
  historyPoints?: number; // Max chart points kept in memory (default: 500)
  onClose?: () => void; // Callback when modal closes
  locale?: 'pt-BR' | 'en-US'; // Locale for formatting (default: 'pt-BR')
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

/** Per-key chart line color. */
const KEY_COLORS: Record<string, string> = {
  // Power (total + phases)
  consumption: '#667eea',
  power: '#667eea',
  a: '#5a6fcf',
  b: '#7b5ea7',
  c: '#4a8f6f',
  // Current (total + phases)
  total_current: '#f6921e',
  current: '#f6921e',
  current_a: '#e8531a',
  current_b: '#c0890e',
  current_c: '#d4691e',
  // Voltage phases
  voltage_a: '#e74c3c',
  voltage_b: '#27ae60',
  voltage_c: '#8e44ad',
  // Power factor (total + phases)
  powerFactor: '#16a085',
  fp_a: '#0e9e8a',
  fp_b: '#128070',
  fp_c: '#169e60',
  // Other
  temperature: '#9b59b6',
  energy: '#1abc9c',
  activePower: '#e67e22',
  reactivePower: '#8e44ad',
  apparentPower: '#2980b9',
};

const TELEMETRY_CONFIG: Record<string, { label: string; unit: string; icon: string; decimals: number }> = {
  // Voltage phases
  voltage_a: { label: 'Tensão Fase A', unit: 'V', icon: '⚡', decimals: 1 },
  voltage_b: { label: 'Tensão Fase B', unit: 'V', icon: '⚡', decimals: 1 },
  voltage_c: { label: 'Tensão Fase C', unit: 'V', icon: '⚡', decimals: 1 },

  // Current phases + totals
  current_a: { label: 'Corrente Fase A', unit: 'A', icon: '🔌', decimals: 2 },
  current_b: { label: 'Corrente Fase B', unit: 'A', icon: '🔌', decimals: 2 },
  current_c: { label: 'Corrente Fase C', unit: 'A', icon: '🔌', decimals: 2 },
  total_current: { label: 'Corrente Total', unit: 'A', icon: '🔌', decimals: 2 },
  current: { label: 'Corrente', unit: 'A', icon: '🔌', decimals: 2 },

  // Power phases (W per phase) + totals
  a: { label: 'Potência Fase A', unit: 'W', icon: '⚙️', decimals: 0 },
  b: { label: 'Potência Fase B', unit: 'W', icon: '⚙️', decimals: 0 },
  c: { label: 'Potência Fase C', unit: 'W', icon: '⚙️', decimals: 0 },
  consumption: { label: 'Potência Total', unit: 'W', icon: '⚙️', decimals: 0 },
  power: { label: 'Potência', unit: 'W', icon: '⚙️', decimals: 0 },
  energy: { label: 'Energia', unit: 'kWh', icon: '📊', decimals: 1 },
  activePower: { label: 'Potência Ativa', unit: 'kW', icon: '⚙️', decimals: 2 },
  reactivePower: { label: 'Potência Reativa', unit: 'kVAr', icon: '🔄', decimals: 2 },
  apparentPower: { label: 'Potência Aparente', unit: 'kVA', icon: '📈', decimals: 2 },

  // Power factor phases + total (dimensionless 0–1, pseudo-unit 'fp')
  fp_a: { label: 'Fat. Pot. A', unit: 'fp', icon: '📐', decimals: 3 },
  fp_b: { label: 'Fat. Pot. B', unit: 'fp', icon: '📐', decimals: 3 },
  fp_c: { label: 'Fat. Pot. C', unit: 'fp', icon: '📐', decimals: 3 },
  powerFactor: { label: 'Fator de Potência', unit: 'fp', icon: '📐', decimals: 3 },

  // Temperature
  temperature: { label: 'Temperatura', unit: '°C', icon: '🌡️', decimals: 1 },
};

/** Short label for each key when shown as a phase row inside a grouped card. */
const PHASE_SHORT_LABEL: Record<string, string> = {
  consumption: 'Total',
  power: 'Total',
  a: 'Fase A',
  b: 'Fase B',
  c: 'Fase C',
  total_current: 'Total',
  current: 'Total',
  current_a: 'Fase A',
  current_b: 'Fase B',
  current_c: 'Fase C',
  voltage_a: 'Fase A',
  voltage_b: 'Fase B',
  voltage_c: 'Fase C',
  fp_a: 'Fase A',
  fp_b: 'Fase B',
  fp_c: 'Fase C',
  powerFactor: 'Total',
  temperature: 'Temp',
  energy: 'Total',
  activePower: 'Total',
  reactivePower: 'Total',
  apparentPower: 'Total',
};

/** Group header meta by unit. */
const UNIT_GROUP_META: Record<string, { label: string; icon: string }> = {
  W: { label: 'Potência', icon: '⚙️' },
  A: { label: 'Corrente', icon: '🔌' },
  V: { label: 'Tensão', icon: '⚡' },
  fp: { label: 'Fator de Potência', icon: '📐' },
  '°C': { label: 'Temperatura', icon: '🌡️' },
  kWh: { label: 'Energia', icon: '📊' },
  kW: { label: 'Potência Ativa', icon: '⚙️' },
  kVAr: { label: 'Pot. Reativa', icon: '🔄' },
  kVA: { label: 'Pot. Aparente', icon: '📈' },
};

const STRINGS = {
  'pt-BR': {
    title: 'Telemetrias Instantâneas',
    close: 'Fechar',
    pause: 'Pausar',
    resume: 'Reiniciar',
    export: 'Exportar CSV',
    autoUpdate: 'Atualização automática',
    lastUpdate: 'Última atualização',
    noData: 'Sem dados',
    loading: 'Carregando...',
    error: 'Erro ao carregar telemetrias',
    trend_up: 'Aumentando',
    trend_down: 'Diminuindo',
    trend_stable: 'Estável',
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
    trend_stable: 'Stable',
  },
};

/**
 * Open Real-Time Telemetry Modal
 */
export async function openRealTimeTelemetryModal(
  params: RealTimeTelemetryParams
): Promise<RealTimeTelemetryInstance> {
  const {
    token,
    deviceId,
    tbBaseUrl = '',
    deviceLabel = 'Dispositivo',
    deviceName,
    customerName,
    centralId,
    customerId,
    userEmail,
    telemetryKeys = [
      'voltage_a',
      'voltage_b',
      'voltage_c',
      'current_a',
      'current_b',
      'current_c',
      'total_current',
      'a',
      'b',
      'c',
      'consumption',
      'fp_a',
      'fp_b',
      'fp_c',
    ],
    refreshInterval = 30_000,
    historyPoints = 500,
    onClose,
    locale = 'pt-BR',
  } = params;

  const strings = STRINGS[locale] || STRINGS['pt-BR'];
  const deviceCheckName = deviceName ?? ''; // identifier for check_device endpoint (must be set explicitly — do not fall back to label)
  const isMyioUser = !!userEmail?.toLowerCase().includes('@myio.com.br');
  let checkDeviceIntervalMs = 30_000; // default 30 s; overridden by customer attribute
  let checkDeviceWaitMs = 15_000; // default 15 s wait after check_device; overridden by customer attribute

  const SESSION_LIMIT_MS = 5 * 60 * 1000; // 5-minute auto-pause session

  let refreshIntervalId: number | null = null;
  let countdownTimerId: number | null = null; // 1-second interval for the footer countdown
  let nextTickAt = 0; // epoch ms when the next check_device tick fires
  let isFirstTick = true; // first tick uses 3 s countdown + 8 s wait instead of 30 s + 15 s
  let isPaused = false;
  let sessionCountdownTimerId: number | null = null;
  let sessionExpiresAt = 0;

  // Card detail tooltip state
  let cardTooltipEl: HTMLDivElement | null = null;
  let cardTooltipKey: string | null = null;
  let cardTooltipPinned = false;
  let cardTooltipExpanded = false;

  // Central / Device status derived from check_device + telemetry freshness
  let centralStatus: 'ok' | 'offline' | 'unknown' = 'unknown';
  let lastTelemetryUpdateMs = 0; // epoch ms of last successful telemetry update
  const DEVICE_OK_DELTA_MS = 60_000; // telemetry must be ≤60 s fresh for Device OK

  // check_device call history for the status tooltip
  interface CheckDeviceRecord {
    ts: number;
    status: 'ok' | 'offline';
  }
  const checkDeviceHistory: CheckDeviceRecord[] = [];
  const MAX_CHECK_DEVICE_HISTORY = 60;
  let statusTooltipEl: HTMLDivElement | null = null;
  let deviceTooltipEl: HTMLDivElement | null = null;
  let telemetryHistory: Map<string, Array<{ x: number; y: number }>> = new Map();
  let lastKnownValues: Map<string, number> = new Map(); // Store last known value for each key
  // Snapshot of realtime history preserved while in Period mode so we can resume on switch back
  let realtimeHistorySnapshot: Map<string, Array<{ x: number; y: number }>> | null = null;
  let realtimeLastKnownSnapshot: Map<string, number> | null = null;
  let chart: any = null;
  let selectedChartKeys: string[] = [
    telemetryKeys.includes('consumption') ? 'consumption' : (telemetryKeys[0] ?? 'consumption'),
  ];
  let selectedAgg: 'NONE' | 'MIN' | 'MAX' | 'AVG' | 'SUM' | 'COUNT' = 'NONE';
  let selectedLimit: number = 500;
  let selectedIntervalMs: number = 0; // 0 = Padrão (don't send interval param)
  let currentTheme: 'light' | 'dark' = 'light';
  let isExpanded = false;
  let currentMode: 'realtime' | 'period' = 'realtime';
  let periodDatePicker: DateRangeControl | null = null;
  let periodStartISO: string | null = null;
  let periodEndISO: string | null = null;

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
        max-width: 1380px;
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
        padding: 8px 12px;
        border-bottom: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #3e1a7d;
        color: white;
        border-radius: 12px 12px 0 0;
        min-height: 32px;
      }

      .myio-realtime-telemetry-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        color: white;
        line-height: 1.4;
      }

      .myio-rtt-device-label {
        font-size: 13px;
        font-weight: 500;
        opacity: 0.9;
        background: rgba(255,255,255,0.15);
        border-radius: 4px;
        padding: 2px 8px;
        margin-left: 4px;
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
      }

      .myio-rtt-device-name {
        font-size: 10px;
        font-weight: 400;
        opacity: 0.6;
        font-family: monospace;
      }

      .myio-rtt-customer-badge {
        font-size: 11px;
        font-weight: 500;
        opacity: 0.65;
        background: rgba(255,255,255,0.12);
        border-radius: 4px;
        padding: 2px 7px;
        margin-left: 2px;
        white-space: nowrap;
      }

      .myio-rtt-version-badge {
        font-size: 10px;
        font-weight: 400;
        opacity: 0.5;
        background: rgba(255,255,255,0.08);
        border-radius: 4px;
        padding: 2px 6px;
        margin-left: 2px;
        font-family: monospace;
        white-space: nowrap;
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
        height: 100vh;
        border-radius: 0;
        display: flex;
        flex-direction: column;
      }

      .myio-realtime-telemetry-overlay.rtt-expanded .myio-realtime-telemetry-header {
        border-radius: 0;
        flex-shrink: 0;
      }

      .myio-realtime-telemetry-overlay.rtt-expanded .myio-realtime-telemetry-footer {
        flex-shrink: 0;
      }

      .myio-realtime-telemetry-overlay.rtt-expanded .myio-realtime-telemetry-body {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        padding: 8px 12px;
      }

      .myio-realtime-telemetry-overlay.rtt-expanded #telemetry-content {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .myio-realtime-telemetry-overlay.rtt-expanded .myio-telemetry-cards-grid {
        flex-shrink: 0;
      }

      .myio-realtime-telemetry-overlay.rtt-expanded .myio-telemetry-chart-container {
        flex: 1;
        min-height: 0;
        max-height: none;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        margin-bottom: 0;
        padding: 8px 12px 4px;
      }

      .myio-realtime-telemetry-overlay.rtt-expanded .myio-telemetry-chart {
        flex: 1;
        min-height: 0;
        max-height: none;
        /* Fixed pixel height prevents Chart.js infinite-growth loop */
        height: 1px;
        width: 100%;
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

      .myio-rtt-card-info-btn {
        margin-left: auto;
        background: none;
        border: none;
        cursor: pointer;
        color: #667eea;
        font-size: 15px;
        padding: 2px 4px;
        border-radius: 50%;
        opacity: 0.55;
        line-height: 1;
        transition: opacity 0.2s;
      }

      .myio-rtt-card-info-btn:hover {
        opacity: 1;
      }

      /* Header-level (i) — slightly larger and full opacity on hover */
      .myio-rtt-card-header-info {
        margin-left: 6px;
        font-size: 16px;
        opacity: 0.7;
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

      /* Grouped card rows (phases) */
      .myio-telemetry-card-rows {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .myio-telemetry-card-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
      }

      .myio-telemetry-card-row-label {
        color: #6b7280;
        font-weight: 500;
        min-width: 44px;
        flex-shrink: 0;
      }

      .myio-telemetry-card-row-value {
        font-weight: 700;
        color: #1f2937;
        flex: 1;
      }

      .myio-telemetry-card-row-trend {
        font-size: 11px;
        color: #64748b;
        flex-shrink: 0;
      }

      .myio-telemetry-card-row-trend.up   { color: #16a34a; }
      .myio-telemetry-card-row-trend.down { color: #dc2626; }

      /* Computed/derived row (e.g. Tensão Média, FP Médio) */
      .myio-telemetry-card-row--computed {
        border-top: 1px dashed #e5e7eb;
        margin-top: 4px;
        padding-top: 4px;
        opacity: 0.85;
      }
      .myio-telemetry-card-row--computed .myio-telemetry-card-row-label {
        font-style: italic;
      }

      .myio-rtt-card-row-info {
        margin-left: 0;
        font-size: 12px;
        opacity: 0.65;
        padding: 1px 3px;
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
        height: 210px;
        max-height: 340px;
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

      .myio-rtt-mode-tabs {
        display: flex;
        background: rgba(0,0,0,0.06);
        border-radius: 6px;
        padding: 2px;
        gap: 2px;
      }

      .myio-rtt-tab {
        padding: 5px 14px;
        border: none;
        border-radius: 5px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        background: transparent;
        color: #555;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .myio-rtt-tab.active {
        background: white;
        color: #3e1a7d;
        box-shadow: 0 1px 4px rgba(0,0,0,0.12);
      }

      .myio-rtt-tab:hover:not(.active) {
        background: rgba(255,255,255,0.5);
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-rtt-mode-tabs {
        background: rgba(255,255,255,0.08);
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-rtt-tab {
        color: #aaa;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-rtt-tab.active {
        background: #0f3460;
        color: #e0e0e0;
      }

      .myio-rtt-period-input {
        display: none;
      }

      .myio-rtt-period-input.visible {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
      }

      .myio-rtt-period-input.visible .myio-rtt-period-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      /* Custom multi-select dropdown */
      .myio-rtt-multiselect {
        position: relative;
        display: inline-block;
      }

      .myio-rtt-multiselect-trigger {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 500;
        border: 1.5px solid #dbe2ea;
        border-radius: 6px;
        background: #fff;
        color: #1f2937;
        cursor: pointer;
        min-width: 180px;
        max-width: 260px;
        box-shadow: 0 1px 2px rgba(16,24,40,0.06);
        transition: border-color 0.15s;
        text-align: left;
      }

      .myio-rtt-multiselect-trigger:hover {
        border-color: #667eea;
      }

      .myio-rtt-multiselect-trigger.open {
        border-color: #667eea;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
      }

      .myio-rtt-multiselect-summary {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .myio-rtt-multiselect-caret {
        font-size: 10px;
        color: #6b7280;
        transition: transform 0.15s;
        flex-shrink: 0;
      }

      .myio-rtt-multiselect-trigger.open .myio-rtt-multiselect-caret {
        transform: rotate(180deg);
      }

      .myio-rtt-multiselect-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        min-width: 100%;
        max-height: 200px;
        overflow-y: auto;
        background: #fff;
        border: 1.5px solid #667eea;
        border-top: none;
        border-radius: 0 0 6px 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        z-index: 10010;
        display: none;
      }

      .myio-rtt-multiselect-dropdown.open {
        display: block;
      }

      .myio-rtt-multiselect-option {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 5px 10px;
        font-size: 12px;
        cursor: pointer;
        color: #1f2937;
        user-select: none;
        transition: background 0.1s;
      }

      .myio-rtt-multiselect-option:hover {
        background: #f0f4ff;
      }

      .myio-rtt-multiselect-option input[type="checkbox"] {
        accent-color: #667eea;
        cursor: pointer;
        flex-shrink: 0;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-rtt-multiselect-trigger {
        background: #1e293b;
        border-color: #334155;
        color: #e0e0e0;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-rtt-multiselect-dropdown {
        background: #1e293b;
        border-color: #667eea;
        color: #e0e0e0;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-rtt-multiselect-option {
        color: #e0e0e0;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-rtt-multiselect-option:hover {
        background: #0f3460;
      }

      /* Dark mode — card row labels / values / trends / ⓘ */
      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-card-row-value {
        color: #e2e8f0;
      }
      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-card-row-label {
        color: #94a3b8;
      }
      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-card-row-trend {
        color: #64748b;
      }
      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-card-row-trend.up {
        color: #4ade80;
      }
      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-card-row-trend.down {
        color: #f87171;
      }
      .myio-realtime-telemetry-container[data-theme="dark"] .myio-rtt-card-row-info {
        color: #94a3b8;
        opacity: 0.8;
      }
      .myio-realtime-telemetry-container[data-theme="dark"] .myio-telemetry-card-row--computed {
        border-top-color: rgba(255,255,255,0.12);
      }

      .myio-rtt-key-select-label {
        font-size: 11px;
        color: #6b7280;
        white-space: nowrap;
      }

      .myio-realtime-telemetry-container[data-theme="dark"] .myio-rtt-key-select-label {
        color: #94a3b8;
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

      /* ===== RESPONSIVE — MOBILE ===== */
      @media (max-width: 640px) {
        .myio-realtime-telemetry-overlay {
          padding: 0;
          align-items: flex-end;
        }

        .myio-realtime-telemetry-container {
          border-radius: 12px 12px 0 0;
          max-height: 95svh;
          max-height: 95vh;
        }

        .myio-realtime-telemetry-title {
          font-size: 13px;
          gap: 4px;
          line-height: 1.4;
          flex-wrap: wrap;
        }

        .myio-rtt-device-label { font-size: 11px; padding: 1px 6px; }
        .myio-rtt-customer-badge { display: none; }
        .myio-rtt-version-badge { display: none; }

        .myio-rtt-header-actions { gap: 2px; }
        .myio-rtt-header-btn { width: 28px; height: 28px; font-size: 17px; }

        .myio-realtime-telemetry-body { padding: 12px; }

        .myio-telemetry-cards-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .myio-telemetry-card { padding: 10px 12px; }
        .myio-telemetry-card-header { font-size: 11px; gap: 4px; margin-bottom: 6px; }
        .myio-telemetry-card-icon { font-size: 16px; }
        .myio-telemetry-card-value { font-size: 20px; }
        .myio-telemetry-card-trend { font-size: 11px; }
        .myio-rtt-card-info-btn { font-size: 13px; }

        .myio-telemetry-chart-container { padding: 10px; }
        .myio-telemetry-chart-title { font-size: 13px; }
        .myio-telemetry-chart { height: 180px; }

        .myio-rtt-mode-tabs { gap: 2px; }
        .myio-rtt-tab { font-size: 11px; padding: 4px 8px; }

        .myio-rtt-period-controls { flex-direction: column; gap: 6px; }
        .myio-rtt-period-controls input { width: 100% !important; }

        .myio-rtt-multiselect-trigger { min-width: 140px; font-size: 11px; }

        .myio-realtime-telemetry-footer {
          flex-wrap: wrap;
          gap: 8px;
          padding: 8px 12px;
        }

        .myio-telemetry-status {
          gap: 6px;
          font-size: 11px;
          flex-wrap: wrap;
        }

        #rtt-countdown-text { font-size: 10px !important; }
        #rtt-central-badge,
        #rtt-device-badge { font-size: 9px !important; padding: 1px 5px !important; }

        .myio-telemetry-actions { gap: 6px; }
        .myio-telemetry-btn { padding: 6px 10px; font-size: 12px; }
      }

      @media (max-width: 400px) {
        .myio-telemetry-cards-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
        .myio-telemetry-card-value { font-size: 17px; }
        .myio-rtt-customer-badge,
        .myio-rtt-device-label { display: none; }
      }
    </style>

    <div class="myio-realtime-telemetry-container">
      <div class="myio-realtime-telemetry-header">
        <div class="myio-realtime-telemetry-title">
          ⚡ ${strings.title}${deviceLabel ? `<span class="myio-rtt-device-label">${deviceLabel}${deviceCheckName && deviceCheckName !== deviceLabel ? `<span class="myio-rtt-device-name">(${deviceCheckName})</span>` : ''}</span>` : ''}${customerName ? `<span class="myio-rtt-customer-badge">${customerName}</span>` : ''}${(() => {
            const v = (window as any).MyIOLibrary?.version;
            return v ? `<span class="myio-rtt-version-badge">v${v}</span>` : '';
          })()}
        </div>
        <div class="myio-rtt-header-actions">
          <button class="myio-rtt-header-btn" id="rtt-gear-btn" title="Configurações de polling" style="display:none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
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
            <!-- Linha 1: título (esquerda) + seletor de telemetrias (direita) — sempre na mesma linha -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <h3 class="myio-telemetry-chart-title" id="chart-title" style="margin:0;">Histórico de Telemetria</h3>
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="myio-rtt-key-select-label">Telemetrias:</span>
                <div class="myio-rtt-multiselect" id="chart-key-selector-multi">
                  <button type="button" class="myio-rtt-multiselect-trigger" id="rtt-multiselect-trigger"
                    title="Selecione as telemetrias para o gráfico (máx. 2 grandezas diferentes)">
                    <span class="myio-rtt-multiselect-summary" id="rtt-multiselect-summary">
                      ${selectedChartKeys.map((k) => (TELEMETRY_CONFIG[k] || { label: k }).label).join(', ')}
                    </span>
                    <span class="myio-rtt-multiselect-caret">▾</span>
                  </button>
                  <div class="myio-rtt-multiselect-dropdown" id="rtt-multiselect-dropdown">
                    ${telemetryKeys
                      .map((k) => {
                        const cfg = TELEMETRY_CONFIG[k] || { label: k, icon: '📊' };
                        const isSelected = selectedChartKeys.includes(k);
                        return `<label class="myio-rtt-multiselect-option"><input type="checkbox" value="${k}"${isSelected ? ' checked' : ''}>${cfg.icon ? cfg.icon + ' ' : ''}${cfg.label}</label>`;
                      })
                      .join('')}
                  </div>
                </div>
              </div>
            </div>
            <!-- Linha 2: tabs + controles de período -->
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
              <div class="myio-rtt-mode-tabs" id="rtt-mode-tabs">
                <button class="myio-rtt-tab active" data-mode="realtime">Realtime</button>
                <button class="myio-rtt-tab" data-mode="period">Pro Período</button>
              </div>
              <div class="myio-rtt-period-input" id="rtt-period-row">
                <div class="myio-rtt-period-controls">
                  <input type="text" id="rtt-date-range" class="myio-telemetry-selector" readonly placeholder="Selecione o período" style="width: 260px; cursor: pointer;">
                  <button id="rtt-period-load-btn" class="myio-telemetry-btn myio-telemetry-btn-primary" style="padding: 6px 14px; font-size: 13px;">Carregar</button>
                  <div id="rtt-api-params" style="display:flex;align-items:center;gap:6px;">
                    <select id="chart-agg-selector" class="myio-telemetry-selector" title="Agregação dos pontos"
                      style="font-size:12px;padding:5px 8px;">
                      <option value="NONE">Bruto</option>
                      <option value="AVG">Média</option>
                      <option value="MAX">Máximo</option>
                      <option value="MIN">Mínimo</option>
                      <option value="SUM">Soma</option>
                    </select>
                    <select id="chart-interval-select" class="myio-telemetry-selector" title="Intervalo de agrupamento (longValue)"
                      style="font-size:12px;padding:5px 8px;">
                      <option value="0">Padrão</option>
                      <option value="60000">1 min</option>
                      <option value="900000">15 min</option>
                      <option value="1800000">30 min</option>
                      <option value="3600000">1 hora</option>
                      <option value="86400000">24 horas</option>
                    </select>
                    <select id="chart-limit-input" class="myio-telemetry-selector" title="Limite de pontos retornados"
                      style="font-size:12px;padding:5px 8px;">
                      <option value="100">100</option>
                      <option value="200">200</option>
                      <option value="300">300</option>
                      <option value="400">400</option>
                      <option value="500" selected>500</option>
                      <option value="600">600</option>
                      <option value="700">700</option>
                      <option value="800">800</option>
                      <option value="900">900</option>
                      <option value="1000">1000</option>
                      <option value="1100">1100</option>
                      <option value="1200">1200</option>
                      <option value="1300">1300</option>
                      <option value="1400">1400</option>
                      <option value="1500">1500</option>
                    </select>
                  </div>
                </div>
              </div>
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
          <span id="rtt-countdown-text" style="font-size:12px;font-weight:600;color:#667eea;background:rgba(102,126,234,0.1);padding:2px 8px;border-radius:10px;"></span>
          ${centralId ? `<span id="rtt-central-badge" style="display:none;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.3px;cursor:pointer;" title="Clique para ver histórico de chamadas"></span><span id="rtt-device-badge" style="display:none;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.3px;cursor:pointer;" title="Clique para ver histórico de chamadas"></span>` : ''}
        </div>

        <div class="myio-telemetry-actions">
          <span id="rtt-session-countdown" style="display:none;align-items:center;font-size:12px;font-weight:600;color:#667eea;background:rgba(102,126,234,0.1);padding:0 10px;height:32px;line-height:32px;border-radius:10px;white-space:nowrap;"></span>
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
  const modeTabs = overlay.querySelectorAll<HTMLButtonElement>('.myio-rtt-tab');
  const periodRow = overlay.querySelector('#rtt-period-row') as HTMLDivElement;
  const dateRangeInput = overlay.querySelector('#rtt-date-range') as HTMLInputElement;
  const periodLoadBtn = overlay.querySelector('#rtt-period-load-btn') as HTMLButtonElement;
  const expandIcon = overlay.querySelector('#rtt-expand-icon') as unknown as SVGElement;
  const container = overlay.querySelector('.myio-realtime-telemetry-container') as HTMLDivElement;
  const pauseBtn = overlay.querySelector('#pause-btn') as HTMLButtonElement;
  const pauseBtnIcon = overlay.querySelector('#pause-btn-icon') as HTMLSpanElement;
  const pauseBtnText = overlay.querySelector('#pause-btn-text') as HTMLSpanElement;
  const sessionCountdownEl = overlay.querySelector('#rtt-session-countdown') as HTMLSpanElement | null;
  const exportBtn = overlay.querySelector('#export-btn') as HTMLButtonElement;
  const loadingState = overlay.querySelector('#loading-state') as HTMLDivElement;
  const telemetryContent = overlay.querySelector('#telemetry-content') as HTMLDivElement;
  const errorState = overlay.querySelector('#error-state') as HTMLDivElement;
  const telemetryCards = overlay.querySelector('#telemetry-cards') as HTMLDivElement;
  const chartContainer = overlay.querySelector('#chart-container') as HTMLDivElement;
  const chartCanvas = overlay.querySelector('#telemetry-chart') as HTMLCanvasElement;
  const chartKeyMultiDiv = overlay.querySelector('#chart-key-selector-multi') as HTMLElement;
  const multiselectTrigger = overlay.querySelector('#rtt-multiselect-trigger') as HTMLButtonElement;
  const multiselectDropdown = overlay.querySelector('#rtt-multiselect-dropdown') as HTMLElement;
  const multiselectSummary = overlay.querySelector('#rtt-multiselect-summary') as HTMLElement;
  const chartAggSelector = overlay.querySelector('#chart-agg-selector') as HTMLSelectElement;
  const chartIntervalSelect = overlay.querySelector('#chart-interval-select') as HTMLSelectElement;
  const chartLimitInput = overlay.querySelector('#chart-limit-input') as HTMLSelectElement;
  const apiParamsRow = overlay.querySelector('#rtt-api-params') as HTMLDivElement;
  const statusIndicator = overlay.querySelector('#status-indicator') as HTMLSpanElement;
  const statusText = overlay.querySelector('#status-text') as HTMLSpanElement;
  const lastUpdateText = overlay.querySelector('#last-update-text') as HTMLSpanElement;
  const countdownText = overlay.querySelector('#rtt-countdown-text') as HTMLSpanElement;
  const centralBadge = overlay.querySelector('#rtt-central-badge') as HTMLSpanElement | null;
  const deviceBadge = overlay.querySelector('#rtt-device-badge') as HTMLSpanElement | null;
  const chartTitleEl = overlay.querySelector('#chart-title') as HTMLElement | null;

  /** Update the chart title and status icon based on currentMode + device/central status. */
  function updateChartTitle(): void {
    if (!chartTitleEl) return;
    if (currentMode === 'period') {
      chartTitleEl.innerHTML = 'Histórico de Telemetria';
      return;
    }
    // Realtime mode: compute status icon
    const deviceOk = lastTelemetryUpdateMs > 0 && Date.now() - lastTelemetryUpdateMs <= DEVICE_OK_DELTA_MS;
    let iconHtml = '';
    if (centralStatus === 'unknown') {
      iconHtml = ''; // no icon while status is still loading
    } else if (centralStatus === 'ok' && deviceOk) {
      iconHtml = `<span title="Central online e dispositivo online" style="margin-left:8px;cursor:default;font-size:16px;vertical-align:middle;">✅</span>`;
    } else if (centralStatus === 'ok' && !deviceOk) {
      iconHtml = `<span title="Central online e dispositivo offline / conexão fraca" style="margin-left:8px;cursor:default;font-size:16px;vertical-align:middle;">⚠️</span>`;
    } else {
      // central offline
      iconHtml = `<span title="Central offline" style="margin-left:8px;cursor:default;font-size:16px;vertical-align:middle;">🔴</span>`;
    }
    chartTitleEl.innerHTML = `Telemetria em Tempo Real${iconHtml}`;
  }

  /** Update CENTRAL / Device status badges in the footer. */
  function updateStatusBadges(): void {
    if (!centralBadge || !deviceBadge) return;
    if (centralStatus === 'unknown') {
      centralBadge.style.display = 'none';
      deviceBadge.style.display = 'none';
      return;
    }
    if (centralStatus === 'ok') {
      centralBadge.textContent = 'CENTRAL OK';
      centralBadge.style.cssText =
        'display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.3px;color:#fff;background:#27ae60;';
      const deviceOk = lastTelemetryUpdateMs > 0 && Date.now() - lastTelemetryUpdateMs <= DEVICE_OK_DELTA_MS;
      if (deviceOk) {
        deviceBadge.textContent = 'Device OK';
        deviceBadge.style.cssText =
          'display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.3px;color:#fff;background:#27ae60;';
      } else {
        deviceBadge.textContent = 'Device OFFLINE';
        deviceBadge.style.cssText =
          'display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.3px;color:#fff;background:#e74c3c;';
      }
    } else {
      centralBadge.textContent = 'CENTRAL OFFLINE';
      centralBadge.style.cssText =
        'display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.3px;color:#fff;background:#e74c3c;';
      deviceBadge.textContent = 'Device OFFLINE';
      deviceBadge.style.cssText =
        'display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.3px;color:#fff;background:#e74c3c;';
    }
    updateChartTitle();
  }

  // Set initial chart title (realtime mode, status unknown → no icon yet)
  updateChartTitle();

  /** Start/reset the 1-second countdown ticker in the footer. */
  function startCountdown(targetMs: number, label = 'próxima em'): void {
    nextTickAt = Date.now() + targetMs;
    if (countdownTimerId !== null) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
    }
    countdownTimerId = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((nextTickAt - Date.now()) / 1000));
      if (countdownText) {
        countdownText.textContent = remaining > 0 ? `${label} ${remaining}s` : '';
      }
    }, 1000);
  }

  /** Stop the countdown ticker and clear the display. */
  function clearCountdown(): void {
    if (countdownTimerId !== null) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
    }
    if (countdownText) countdownText.textContent = '';
  }

  /** Start a new 5-minute session. Auto-pauses when time runs out. */
  function startSession(): void {
    stopSession();
    sessionExpiresAt = Date.now() + SESSION_LIMIT_MS;
    sessionCountdownTimerId = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((sessionExpiresAt - Date.now()) / 1000));
      if (sessionCountdownEl) {
        if (remaining > 0) {
          const mins = Math.floor(remaining / 60);
          const secs = remaining % 60;
          sessionCountdownEl.textContent = `⏱ ${mins}:${secs.toString().padStart(2, '0')}`;
          sessionCountdownEl.style.display = 'inline-flex';
        }
      }
      if (remaining <= 0) {
        stopSession();
        if (!isPaused) {
          togglePause();
          clearCountdown();
          showRTTToast('Sessão de 5 min encerrada. Clique em Reiniciar para um novo ciclo.', 'warn');
        }
      }
    }, 1000);
  }

  /** Stop the session countdown and hide the element. */
  function stopSession(): void {
    if (sessionCountdownTimerId !== null) {
      clearInterval(sessionCountdownTimerId);
      sessionCountdownTimerId = null;
    }
    if (sessionCountdownEl) sessionCountdownEl.style.display = 'none';
  }

  /**
   * Close modal
   */
  /** Show a brief floating toast inside the modal area. */
  function showRTTToast(message: string, type: 'warn' | 'error' | 'info' = 'info'): void {
    const bg = { warn: '#e67e22', error: '#e74c3c', info: '#3498db' }[type];
    overlay.querySelector('.myio-rtt-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'myio-rtt-toast';
    toast.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:${bg};color:#fff;padding:10px 20px;border-radius:8px;
      font-size:13px;font-weight:500;z-index:10002;
      box-shadow:0 4px 16px rgba(0,0,0,0.3);pointer-events:none;
      white-space:nowrap;max-width:90vw;text-align:center;
      animation:rttToastIn 0.2s ease;
    `;
    toast.textContent = message;
    if (!document.getElementById('rtt-toast-kf')) {
      const s = document.createElement('style');
      s.id = 'rtt-toast-kf';
      s.textContent = `@keyframes rttToastIn{from{opacity:0;transform:translateX(-50%) translateY(6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
      document.head.appendChild(s);
    }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // Keys considered "power" — dequeued first when a 3rd grandeza is added
  const POWER_KEYS = new Set(['consumption', 'power', 'a', 'b', 'c']);

  /** Returns distinct grandezas (units) for a set of keys. Voltage phases count as one. */
  function distinctGrandezas(keys: string[]): string[] {
    const units = new Set(keys.map((k) => (TELEMETRY_CONFIG[k] || { unit: '' }).unit));
    return [...units];
  }

  /** Sync the custom multiselect UI to reflect the current selectedChartKeys. */
  function syncSelectUI(): void {
    // Update checkboxes
    chartKeyMultiDiv?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
      cb.checked = selectedChartKeys.includes(cb.value);
    });
    // Update summary text
    if (multiselectSummary) {
      const labels = selectedChartKeys.map((k) => (TELEMETRY_CONFIG[k] || { label: k }).label);
      multiselectSummary.textContent = labels.length > 0 ? labels.join(', ') : 'Nenhuma';
    }
  }

  /**
   * Queue-aware toggle for selectedChartKeys.
   * Rules:
   *  - Max 2 distinct grandezas (W / A / V / fp) simultaneously.
   *  - Phase keys of the same grandeza (e.g. current_a + current_b) share one slot.
   *  - When a 3rd grandeza would be added → dequeue power first + Toast Warn.
   *  - If no power to dequeue → reject + Toast Warn.
   */
  function toggleChartKey(key: string): void {
    const idx = selectedChartKeys.indexOf(key);

    if (idx !== -1) {
      // Deselect: keep at least 1
      if (selectedChartKeys.length === 1) {
        syncSelectUI();
        return;
      }
      selectedChartKeys.splice(idx, 1);
      syncSelectUI();
      rebuildChart();
      return;
    }

    // Adding: check grandeza limit
    const tentativeGrandezas = distinctGrandezas([...selectedChartKeys, key]);
    if (tentativeGrandezas.length <= 2) {
      selectedChartKeys.push(key);
      syncSelectUI();
      rebuildChart();
      return;
    }

    // 3rd grandeza: try to dequeue power
    const powerIdx = selectedChartKeys.findIndex((k) => POWER_KEYS.has(k));
    if (powerIdx !== -1) {
      selectedChartKeys.splice(powerIdx, 1);
      selectedChartKeys.push(key);
      syncSelectUI();
      showRTTToast('Máximo 2 grandezas diferentes. Potência foi removida da seleção.', 'warn');
      rebuildChart();
      return;
    }

    // Cannot add — revert select to current state
    syncSelectUI();
    showRTTToast('Máximo 2 grandezas diferentes no gráfico simultâneo.', 'warn');
  }

  /** Inject card-tooltip global styles once. */
  function injectCardTooltipStyles(): void {
    if (document.getElementById('rtt-card-tooltip-styles')) return;
    const s = document.createElement('style');
    s.id = 'rtt-card-tooltip-styles';
    s.textContent = `
      #rtt-card-tooltip,#rtt-status-tooltip,#rtt-device-tooltip {
        position:fixed;z-index:99999;background:#fff;border-radius:12px;
        border:1px solid #e2e8f0;
        box-shadow:0 10px 40px rgba(0,0,0,0.15),0 2px 10px rgba(0,0,0,0.08);
        min-width:240px;max-width:320px;overflow:hidden;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        font-size:12px;color:#1e293b;
        user-select:none;
      }
      #rtt-card-tooltip[data-theme="dark"],#rtt-status-tooltip[data-theme="dark"],#rtt-device-tooltip[data-theme="dark"]{background:#1e2130;color:#e0e0e0;border-color:#2a2d3e;}
      #rtt-card-tooltip[data-theme="dark"] .rtt-tt-row{border-color:#2a2d3e;}
      #rtt-card-tooltip[data-theme="dark"] .rtt-tt-history{border-color:#2a2d3e;}
      #rtt-card-tooltip[data-theme="dark"] .rtt-tt-history-label{color:#aaa;}
      #rtt-card-tooltip[data-theme="dark"] .rtt-tt-ts{color:#aaa;}
      #rtt-card-tooltip[data-theme="dark"] .rtt-tt-row-ts{color:#666;}
      .rtt-tt-header{display:flex;align-items:center;gap:6px;padding:10px 14px;cursor:move;user-select:none;border-radius:12px 12px 0 0;}
      .rtt-tt-header-btn{background:rgba(255,255,255,0.22);border:none;color:white;width:24px;height:24px;
        border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;
        font-size:13px;font-weight:700;transition:background 0.15s;flex-shrink:0;}
      .rtt-tt-header-btn:hover{background:rgba(255,255,255,0.42);}
      .rtt-tt-header-btn.pinned{background:rgba(255,255,255,0.6);color:#333;}
      .rtt-tt-value-block{padding:12px 14px 8px;}
      .rtt-tt-value{font-size:24px;font-weight:700;line-height:1.2;}
      .rtt-tt-ts{font-size:11px;color:#888;margin-top:3px;}
      .rtt-tt-history{border-top:1px solid #f0f0f0;}
      .rtt-tt-history-label{font-size:10px;font-weight:700;color:#94a3b8;padding:6px 14px 2px;
        text-transform:uppercase;letter-spacing:0.7px;}
      .rtt-tt-history-list{max-height:190px;overflow-y:auto;}
      .rtt-tt-history-list.expanded{max-height:400px;}
      .rtt-tt-row{display:flex;justify-content:space-between;align-items:center;
        padding:4px 14px;font-size:12px;border-bottom:1px solid #f5f5f5;}
      .rtt-tt-history-row{display:flex;align-items:center;gap:6px;
        padding:5px 14px;font-size:12px;color:#374151;border-bottom:1px solid #f8fafc;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
      .rtt-tt-history-row:last-child{border-bottom:none;}
      .rtt-tt-row-ts{color:#bbb;}
      .rtt-tt-row-val{font-weight:600;}
      /* Maximized state (expand button) */
      #rtt-card-tooltip.maximized,#rtt-status-tooltip.maximized,#rtt-device-tooltip.maximized{
        top:20px !important;left:20px !important;right:20px !important;bottom:20px !important;
        width:auto !important;max-width:none !important;min-width:0 !important;
        display:flex;flex-direction:column;
        font-size:15px !important;
      }
      #rtt-card-tooltip.maximized .rtt-tt-header,
      #rtt-status-tooltip.maximized .rtt-tt-header,
      #rtt-device-tooltip.maximized .rtt-tt-header{padding:14px 18px;}
      #rtt-card-tooltip.maximized .rtt-tt-header > span:nth-child(1),
      #rtt-status-tooltip.maximized .rtt-tt-header > span:nth-child(1),
      #rtt-device-tooltip.maximized .rtt-tt-header > span:nth-child(1){font-size:22px !important;}
      #rtt-card-tooltip.maximized .rtt-tt-header > span:nth-child(2),
      #rtt-status-tooltip.maximized .rtt-tt-header > span:nth-child(2),
      #rtt-device-tooltip.maximized .rtt-tt-header > span:nth-child(2){font-size:16px !important;}
      #rtt-card-tooltip.maximized .rtt-tt-header-btn,
      #rtt-status-tooltip.maximized .rtt-tt-header-btn,
      #rtt-device-tooltip.maximized .rtt-tt-header-btn{width:28px;height:28px;font-size:16px !important;}
      #rtt-card-tooltip.maximized .rtt-tt-value-block,
      #rtt-status-tooltip.maximized .rtt-tt-value-block,
      #rtt-device-tooltip.maximized .rtt-tt-value-block{padding:16px 20px 10px;font-size:14px !important;}
      #rtt-card-tooltip.maximized .rtt-tt-value{font-size:32px !important;}
      #rtt-card-tooltip.maximized .rtt-tt-history-label,
      #rtt-status-tooltip.maximized .rtt-tt-history-label,
      #rtt-device-tooltip.maximized .rtt-tt-history-label{font-size:12px !important;padding:8px 20px 4px;}
      #rtt-card-tooltip.maximized .rtt-tt-row{font-size:14px !important;padding:6px 20px;}
      #rtt-card-tooltip.maximized .rtt-tt-history-row,
      #rtt-status-tooltip.maximized .rtt-tt-history-row,
      #rtt-device-tooltip.maximized .rtt-tt-history-row{font-size:14px !important;padding:7px 20px;}
      #rtt-card-tooltip.maximized .rtt-tt-history,
      #rtt-status-tooltip.maximized .rtt-tt-history,
      #rtt-device-tooltip.maximized .rtt-tt-history{flex:1;display:flex;flex-direction:column;}
      #rtt-card-tooltip.maximized .rtt-tt-history-list,
      #rtt-status-tooltip.maximized .rtt-tt-history-list,
      #rtt-device-tooltip.maximized .rtt-tt-history-list{flex:1;max-height:none;}
    `;
    document.head.appendChild(s);
  }

  /** Build history list rows HTML. */
  function buildTooltipHistoryRows(key: string, color: string): string {
    const history = telemetryHistory.get(key) || [];
    const recent = [...history].reverse().slice(0, 30);
    if (recent.length === 0)
      return '<div class="rtt-tt-row"><span class="rtt-tt-row-ts">Sem dados ainda</span></div>';
    return recent
      .map(
        (p) => `
      <div class="rtt-tt-row">
        <span class="rtt-tt-row-ts">${new Date(p.x).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        <span class="rtt-tt-row-val" style="color:${color};">${getFormattedValue(key, p.y)}</span>
      </div>`
      )
      .join('');
  }

  /** Open (or replace) card detail tooltip for a given key. */
  function openCardTooltip(key: string, anchorEl: HTMLElement): void {
    closeCardTooltip();
    injectCardTooltipStyles();

    const cfg = TELEMETRY_CONFIG[key] || { label: key, unit: '', icon: '📊', decimals: 2 };
    const color = KEY_COLORS[key] || '#667eea';
    const history = telemetryHistory.get(key) || [];
    const latestPoint = history[history.length - 1];
    const latestVal = latestPoint ? getFormattedValue(key, latestPoint.y) : '--';
    const latestTime = latestPoint
      ? new Date(latestPoint.x).toLocaleString(locale, {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : '--';

    const tooltip = document.createElement('div');
    tooltip.id = 'rtt-card-tooltip';
    if (currentTheme === 'dark') tooltip.dataset['theme'] = 'dark';

    tooltip.innerHTML = `
      <div class="rtt-tt-header" style="background:${color};">
        <span style="font-size:15px;">${cfg.icon}</span>
        <span style="font-size:13px;font-weight:600;color:white;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cfg.label}</span>
        <button class="rtt-tt-header-btn" id="rtt-tt-pin" title="Fixar na tela">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:11px;height:11px;"><path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/><line x1="12" y1="16" x2="12" y2="21"/><line x1="8" y1="4" x2="16" y2="4"/></svg>
        </button>
        <button class="rtt-tt-header-btn" id="rtt-tt-expand" title="Expandir histórico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:11px;height:11px;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        </button>
        <button class="rtt-tt-header-btn" id="rtt-tt-close" title="Fechar" style="font-size:15px;">×</button>
      </div>
      <div class="rtt-tt-value-block">
        <div class="rtt-tt-value" style="color:${color};" id="rtt-tt-val">${latestVal}</div>
        <div class="rtt-tt-ts" id="rtt-tt-ts">Recebido: ${latestTime}</div>
      </div>
      <div class="rtt-tt-history">
        <div class="rtt-tt-history-label">Histórico recente</div>
        <div class="rtt-tt-history-list" id="rtt-tt-list">${buildTooltipHistoryRows(key, color)}</div>
      </div>`;

    // Position near anchor
    const rect = anchorEl.getBoundingClientRect();
    const left = Math.min(rect.right + 8, window.innerWidth - 320);
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - 380));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    document.body.appendChild(tooltip);
    cardTooltipEl = tooltip;
    cardTooltipKey = key;

    // Drag support
    const header = tooltip.querySelector('.rtt-tt-header') as HTMLElement;
    makeDraggable(tooltip, header);

    // Pin button
    const pinBtn = tooltip.querySelector('#rtt-tt-pin') as HTMLButtonElement;
    pinBtn.addEventListener('click', () => {
      cardTooltipPinned = !cardTooltipPinned;
      pinBtn.classList.toggle('pinned', cardTooltipPinned);
      pinBtn.title = cardTooltipPinned ? 'Desafixar' : 'Fixar na tela';
    });

    // Expand button
    const expandBtn = tooltip.querySelector('#rtt-tt-expand') as HTMLButtonElement;
    expandBtn.addEventListener('click', () => {
      cardTooltipExpanded = !cardTooltipExpanded;
      tooltip.classList.toggle('maximized', cardTooltipExpanded);
      expandBtn.title = cardTooltipExpanded ? 'Restaurar' : 'Expandir histórico';
    });

    // Close button
    tooltip.querySelector('#rtt-tt-close')!.addEventListener('click', closeCardTooltip);
  }

  /** Refresh tooltip current value + history if open. */
  function refreshCardTooltip(): void {
    if (!cardTooltipEl || !cardTooltipKey) return;
    const key = cardTooltipKey;
    const color = KEY_COLORS[key] || '#667eea';
    const history = telemetryHistory.get(key) || [];
    const latest = history[history.length - 1];
    if (!latest) return;

    const valEl = cardTooltipEl.querySelector('#rtt-tt-val');
    const tsEl = cardTooltipEl.querySelector('#rtt-tt-ts');
    const listEl = cardTooltipEl.querySelector('#rtt-tt-list');
    if (valEl) valEl.textContent = getFormattedValue(key, latest.y);
    if (tsEl)
      tsEl.textContent = `Recebido: ${new Date(latest.x).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    if (listEl) listEl.innerHTML = buildTooltipHistoryRows(key, color);
  }

  /** Destroy card tooltip. */
  function closeCardTooltip(): void {
    cardTooltipEl?.remove();
    cardTooltipEl = null;
    cardTooltipKey = null;
    cardTooltipPinned = false;
    cardTooltipExpanded = false;
  }

  /** Open premium status tooltip for CENTRAL/Device badges. */
  function openStatusTooltip(anchorEl: HTMLElement): void {
    // Toggle: close if already open
    if (statusTooltipEl) {
      statusTooltipEl.remove();
      statusTooltipEl = null;
      return;
    }
    injectCardTooltipStyles();

    const ok = checkDeviceHistory.filter((r) => r.status === 'ok').length;
    const fail = checkDeviceHistory.filter((r) => r.status === 'offline').length;
    const total = checkDeviceHistory.length;

    const firstTs = checkDeviceHistory[0]?.ts;
    const uptimeLabel = firstTs
      ? (() => {
          const secs = Math.floor((Date.now() - firstTs) / 1000);
          if (secs < 60) return `${secs}s`;
          if (secs < 3600) return `${Math.floor(secs / 60)}min ${secs % 60}s`;
          return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}min`;
        })()
      : '--';

    const isOk = centralStatus === 'ok';
    const headerColor = isOk ? '#27ae60' : '#e74c3c';
    const headerLabel =
      centralStatus === 'unknown' ? 'Central — aguardando...' : isOk ? 'Central OK' : 'Central OFFLINE';

    const recentRows = [...checkDeviceHistory]
      .reverse()
      .slice(0, 10)
      .map((r) => {
        const dt = new Date(r.ts).toLocaleString(locale, {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const icon = r.status === 'ok' ? '✅' : '❌';
        return `<div class="rtt-tt-history-row">${icon} ${dt}</div>`;
      })
      .join('');

    const failBlock =
      fail > 0
        ? `<div style="margin-top:8px;padding:6px 8px;background:#fff5f5;border-radius:6px;font-size:11px;color:#e74c3c;">⚠️ ${fail} falha${fail > 1 ? 's' : ''} registrada${fail > 1 ? 's' : ''}</div>`
        : '';

    const tooltip = document.createElement('div');
    tooltip.id = 'rtt-status-tooltip';
    if (currentTheme === 'dark') tooltip.dataset['theme'] = 'dark';

    const PIN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/><line x1="12" y1="16" x2="12" y2="21"/><line x1="8" y1="4" x2="16" y2="4"/></svg>`;
    const EXP_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;

    const emptyMsg = `<div class="rtt-tt-history-row" style="color:#94a3b8;">Nenhuma chamada ainda</div>`;

    tooltip.innerHTML = `
      <div class="rtt-tt-header" style="background:${headerColor};">
        <span style="font-size:16px;">🖥️</span>
        <span style="font-size:13px;font-weight:700;color:white;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${headerLabel}</span>
        <button class="rtt-tt-header-btn" id="rtt-st-pin" title="Fixar">${PIN_SVG}</button>
        <button class="rtt-tt-header-btn" id="rtt-st-expand" title="Expandir histórico">${EXP_SVG}</button>
        <button class="rtt-tt-header-btn" id="rtt-st-close" title="Fechar" style="font-size:16px;line-height:1;">×</button>
      </div>
      <div class="rtt-tt-value-block">
        <div style="display:flex;flex-direction:column;gap:5px;color:#374151;">
          ${centralId ? `<div style="font-family:ui-monospace,monospace;background:#f1f5f9;border-radius:5px;padding:3px 8px;font-size:11px;color:#475569;">🔑 Central ID: <b>${centralId}</b></div>` : ''}
          <div style="font-size:12px;">📡 <b>${ok}</b> chamadas com sucesso${total > 0 ? ` de ${total}` : ''}</div>
          <div style="font-size:12px;">⏱️ Monitorando há: <b>${uptimeLabel}</b></div>
          ${fail > 0 ? `<div style="font-size:12px;color:#e74c3c;">❌ <b>${fail}</b> falha${fail > 1 ? 's' : ''}</div>` : ''}
        </div>
        ${failBlock}
      </div>
      <div class="rtt-tt-history">
        <div class="rtt-tt-history-label">Últimas chamadas</div>
        <div class="rtt-tt-history-list" id="rtt-st-list">${recentRows || emptyMsg}</div>
      </div>`;

    const rect = anchorEl.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 340))}px`;
    tooltip.style.top = `${Math.max(8, rect.top - 8 - 280)}px`;

    document.body.appendChild(tooltip);
    statusTooltipEl = tooltip;
    makeDraggable(tooltip, tooltip.querySelector('.rtt-tt-header') as HTMLElement);

    let stPinned = false;
    let stMaximized = false;
    const pinBtn = tooltip.querySelector('#rtt-st-pin') as HTMLButtonElement;
    const expandBtn = tooltip.querySelector('#rtt-st-expand') as HTMLButtonElement;

    pinBtn.addEventListener('click', () => {
      stPinned = !stPinned;
      pinBtn.classList.toggle('pinned', stPinned);
      pinBtn.title = stPinned ? 'Desafixar' : 'Fixar';
    });
    expandBtn.addEventListener('click', () => {
      stMaximized = !stMaximized;
      tooltip.classList.toggle('maximized', stMaximized);
      expandBtn.title = stMaximized ? 'Restaurar' : 'Expandir';
    });
    tooltip.querySelector('#rtt-st-close')!.addEventListener('click', () => {
      statusTooltipEl?.remove();
      statusTooltipEl = null;
    });
  }

  /** Open premium info tooltip for the Device badge (device label, name, slave ID, central ID). */
  function openDeviceInfoTooltip(anchorEl: HTMLElement): void {
    if (deviceTooltipEl) {
      deviceTooltipEl.remove();
      deviceTooltipEl = null;
      return;
    }
    injectCardTooltipStyles();

    const deviceOk = lastTelemetryUpdateMs > 0 && Date.now() - lastTelemetryUpdateMs <= DEVICE_OK_DELTA_MS;
    const headerColor = deviceOk ? '#27ae60' : '#e74c3c';
    const headerLabel = deviceOk ? 'Device OK' : 'Device OFFLINE';
    const lastUpdateStr =
      lastTelemetryUpdateMs > 0
        ? new Date(lastTelemetryUpdateMs).toLocaleString(locale, {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : '--';

    function row(icon: string, label: string, value: string): string {
      return `<div style="display:flex;flex-direction:column;gap:1px;padding:5px 0;border-bottom:1px solid #f3f4f6;">
        <span style="font-size:10px;color:#9ca3af;font-weight:500;">${icon} ${label}</span>
        <span style="font-family:monospace;font-size:12px;color:#1f2937;font-weight:600;word-break:break-all;">${value || '—'}</span>
      </div>`;
    }

    const tooltip = document.createElement('div');
    tooltip.id = 'rtt-device-tooltip';
    if (currentTheme === 'dark') tooltip.dataset['theme'] = 'dark';

    const PIN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/><line x1="12" y1="16" x2="12" y2="21"/><line x1="8" y1="4" x2="16" y2="4"/></svg>`;
    const EXP_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;

    tooltip.innerHTML = `
      <div class="rtt-tt-header" style="background:${headerColor};">
        <span style="font-size:16px;">📟</span>
        <span style="font-size:13px;font-weight:700;color:white;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${headerLabel}</span>
        <button class="rtt-tt-header-btn" id="rtt-dt-pin" title="Fixar">${PIN_SVG}</button>
        <button class="rtt-tt-header-btn" id="rtt-dt-expand" title="Expandir">${EXP_SVG}</button>
        <button class="rtt-tt-header-btn" id="rtt-dt-close" title="Fechar" style="font-size:16px;line-height:1;">×</button>
      </div>
      <div style="padding:10px 14px 14px;">
        ${row('🏷️', 'Device Label', deviceLabel)}
        ${row('🔧', 'Device Name / Slave ID', deviceCheckName || deviceLabel)}
        ${row('🔑', 'Central ID', centralId ?? '')}
        ${deviceId ? row('🆔', 'TB Device ID', deviceId) : ''}
        <div style="margin-top:10px;font-size:11px;color:#64748b;padding-top:8px;border-top:1px solid #f1f5f9;">
          🕐 Última telemetria: <b style="color:#1e293b;">${lastUpdateStr}</b>
        </div>
      </div>`;

    const rect = anchorEl.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 340))}px`;
    tooltip.style.top = `${Math.max(8, rect.top - 8 - 250)}px`;

    document.body.appendChild(tooltip);
    deviceTooltipEl = tooltip;
    makeDraggable(tooltip, tooltip.querySelector('.rtt-tt-header') as HTMLElement);

    let dtPinned = false;
    let dtMaximized = false;
    const pinBtn = tooltip.querySelector('#rtt-dt-pin') as HTMLButtonElement;
    const expandBtn = tooltip.querySelector('#rtt-dt-expand') as HTMLButtonElement;

    pinBtn.addEventListener('click', () => {
      dtPinned = !dtPinned;
      pinBtn.classList.toggle('pinned', dtPinned);
      pinBtn.title = dtPinned ? 'Desafixar' : 'Fixar';
    });
    expandBtn.addEventListener('click', () => {
      dtMaximized = !dtMaximized;
      tooltip.classList.toggle('maximized', dtMaximized);
      expandBtn.title = dtMaximized ? 'Restaurar' : 'Expandir';
    });
    tooltip.querySelector('#rtt-dt-close')!.addEventListener('click', () => {
      deviceTooltipEl?.remove();
      deviceTooltipEl = null;
    });
  }

  /** Make element draggable by a handle, ignoring button clicks. */
  function makeDraggable(el: HTMLElement, handle: HTMLElement): void {
    let startX = 0,
      startY = 0,
      startLeft = 0,
      startTop = 0;
    handle.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(el.style.left) || 0;
      startTop = parseFloat(el.style.top) || 0;
      const onMove = (ev: MouseEvent) => {
        el.style.left = `${startLeft + ev.clientX - startX}px`;
        el.style.top = `${startTop + ev.clientY - startY}px`;
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
  }

  function closeModal() {
    if (refreshIntervalId !== null) {
      clearTimeout(refreshIntervalId);
      refreshIntervalId = null;
    }
    clearCountdown();
    stopSession();

    if (chart) {
      chart.destroy();
      chart = null;
    }

    closeCardTooltip();
    statusTooltipEl?.remove();
    statusTooltipEl = null;
    deviceTooltipEl?.remove();
    deviceTooltipEl = null;
    overlay.remove();

    if (onClose) {
      onClose();
    }
  }

  /**
   * Fetch latest telemetry values
   */
  /**
   * Build a ThingsBoard timeseries URL with explicit, documented params.
   * useStrictDataTypes=true → values arrive as numbers, not strings.
   */
  function buildTsUrl(opts: {
    startTs?: number;
    endTs?: number;
    limit?: number;
    agg?: 'NONE' | 'MIN' | 'MAX' | 'AVG' | 'SUM' | 'COUNT';
    orderBy?: 'ASC' | 'DESC';
    intervalType?: 'MILLISECONDS' | 'WEEK' | 'WEEK_ISO' | 'MONTH' | 'QUARTER';
    interval?: number;
    timeZone?: string;
    keys?: string[];
  }): string {
    const base = `${tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
    const p = new URLSearchParams();
    p.set('keys', (opts.keys ?? telemetryKeys).join(','));
    p.set('agg', opts.agg ?? 'NONE');
    p.set('useStrictDataTypes', 'true');
    if (opts.limit !== undefined) p.set('limit', String(opts.limit));
    if (opts.startTs !== undefined) p.set('startTs', String(opts.startTs));
    if (opts.endTs !== undefined) p.set('endTs', String(opts.endTs));
    if (opts.orderBy) p.set('orderBy', opts.orderBy);
    if (opts.intervalType) p.set('intervalType', opts.intervalType);
    if (opts.interval !== undefined) p.set('interval', String(opts.interval));
    if (opts.timeZone) p.set('timeZone', opts.timeZone);
    return `${base}?${p.toString()}`;
  }

  async function fetchLatestTelemetry(): Promise<Record<string, any>> {
    const url = buildTsUrl({ limit: 1, agg: 'NONE' });
    const response = await fetch(url, { headers: { 'X-Authorization': `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Failed to fetch telemetry: ${response.statusText}`);
    return response.json();
  }

  /**
   * Fetch telemetry for a historical period (Período mode).
   * Returns data sorted ascending (oldest first) for chart rendering.
   */
  async function fetchPeriodTelemetry(startISO: string, endISO: string): Promise<Record<string, any>> {
    const startTs = new Date(startISO).getTime();
    const endTs = new Date(endISO).getTime(); // includeTime: true — user already specifies exact end time
    const url = buildTsUrl({
      keys: selectedChartKeys,
      startTs,
      endTs,
      limit: selectedLimit,
      agg: selectedAgg,
      orderBy: 'ASC',
      ...(selectedIntervalMs > 0 ? { intervalType: 'MILLISECONDS', interval: selectedIntervalMs } : {}),
    });
    const response = await fetch(url, { headers: { 'X-Authorization': `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Failed to fetch period telemetry: ${response.statusText}`);
    return response.json();
  }

  /**
   * Load polling intervals from customer attributes SERVER_SCOPE.
   */
  async function loadCheckDeviceInterval(): Promise<void> {
    if (!customerId) return;
    try {
      const keys = 'interval_time_real_time_telemetry_in_ms,wait_time_check_device_in_ms';
      const url = `${tbBaseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE?keys=${keys}`;
      const res = await fetch(url, { headers: { 'X-Authorization': `Bearer ${token}` } });
      if (!res.ok) return;
      const attrs: Array<{ key: string; value: any }> = await res.json();
      const rawInterval = attrs.find((a) => a.key === 'interval_time_real_time_telemetry_in_ms')?.value;
      const rawWait = attrs.find((a) => a.key === 'wait_time_check_device_in_ms')?.value;
      if (rawInterval && Number(rawInterval) >= 5000) checkDeviceIntervalMs = Number(rawInterval);
      if (rawWait && Number(rawWait) >= 0) checkDeviceWaitMs = Number(rawWait);
    } catch {}
  }

  /**
   * Save polling intervals to customer attributes SERVER_SCOPE.
   */
  async function saveCheckDeviceInterval(intervalMs: number, waitMs: number): Promise<boolean> {
    if (!customerId) return false;
    try {
      const url = `${tbBaseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/SERVER_SCOPE`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'X-Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interval_time_real_time_telemetry_in_ms: intervalMs,
          wait_time_check_device_in_ms: waitMs,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Recursive setTimeout tick with a single unified countdown.
   *
   * Normal tick  : countdown = pollMs + waitMs (e.g. 30 s + 15 s = 45 s total).
   *                check_device fires internally after pollMs (countdown shows waitMs remaining),
   *                then waits waitMs, then plots — user sees one smooth 45 → 0 counter.
   * First tick   : 3 s countdown → check_device → 8 s wait → plot (11 s total).
   * No centralId : plain pollMs countdown → refreshData (no check_device, no wait).
   */
  function scheduleCheckDeviceTick(): void {
    const quick = isFirstTick;
    isFirstTick = false;

    const useCheckDevice = !!centralId && !sessionStorage.getItem('rtt_check_device_disabled');
    const pollMs = quick ? 3_000 : centralId ? checkDeviceIntervalMs : refreshInterval;
    const waitMs = useCheckDevice ? (quick ? 8_000 : checkDeviceWaitMs) : 0;
    const totalMs = pollMs + waitMs;

    startCountdown(totalMs); // single countdown for the full cycle

    refreshIntervalId = window.setTimeout(async () => {
      if (!document.body.contains(overlay)) return;
      // countdown still ticking (shows waitMs remaining) — no clearCountdown here yet
      if (!isPaused && currentMode !== 'period') {
        if (useCheckDevice) {
          try {
            await fetch(`https://${centralId}.y.myio.com.br/api/check_device/${deviceCheckName}`, {
              signal: AbortSignal.timeout(10_000),
            });
            centralStatus = 'ok';
            checkDeviceHistory.push({ ts: Date.now(), status: 'ok' });
          } catch (e) {
            console.warn('[RTT] check_device error:', (e as Error)?.message ?? e);
            centralStatus = 'offline';
            checkDeviceHistory.push({ ts: Date.now(), status: 'offline' });
          }
          if (checkDeviceHistory.length > MAX_CHECK_DEVICE_HISTORY) checkDeviceHistory.shift();
          updateStatusBadges();
          await new Promise<void>((r) => setTimeout(r, waitMs)); // countdown reaches 0 during this wait
        }
        clearCountdown();
        await refreshData();
      }
      scheduleCheckDeviceTick(); // reschedule
    }, pollMs);
  }

  /**
   * Open polling interval config modal (visible only to @myio.com.br users).
   */
  function openIntervalConfigModal(): void {
    document.getElementById('rtt-poll-modal-backdrop')?.remove();
    const _SS_DISABLE_KEY = 'rtt_check_device_disabled';
    const isDisabled = () => sessionStorage.getItem(_SS_DISABLE_KEY) === '1';
    const setDisabled = (v: boolean) =>
      v ? sessionStorage.setItem(_SS_DISABLE_KEY, '1') : sessionStorage.removeItem(_SS_DISABLE_KEY);

    const backdrop = document.createElement('div');
    backdrop.id = 'rtt-poll-modal-backdrop';
    backdrop.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.35);
      backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
      display:flex;align-items:center;justify-content:center;z-index:10200;
    `;
    backdrop.innerHTML = `
      <div class="myio-realtime-telemetry-container" style="width:min(420px,94vw);max-height:90vh;overflow-y:auto;position:relative;">
        <div class="myio-realtime-telemetry-header" style="cursor:default;">
          <div class="myio-realtime-telemetry-title" style="font-size:15px;">
            ⚙️ Configurações de Polling
          </div>
          <div class="myio-rtt-header-actions">
            <button id="rtt-poll-close-x" class="myio-rtt-header-btn" title="Fechar" style="font-size:20px;line-height:1;">×</button>
          </div>
        </div>
        <div style="padding:20px 18px;display:flex;flex-direction:column;gap:16px;">

          <!-- Intervalo principal -->
          <div>
            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:var(--rtt-text,#1a1a2e);">
              Intervalo entre chamadas
            </label>
            <div style="display:flex;align-items:center;gap:10px;">
              <input id="rtt-poll-interval-input" type="number" min="5" max="3600" step="1"
                value="${Math.round(checkDeviceIntervalMs / 1000)}"
                style="width:90px;padding:8px 10px;border-radius:8px;
                       border:1px solid #d1d5db;background:#fff;
                       color:#111;font-size:16px;text-align:center;outline:none;">
              <span style="font-size:13px;color:#6b7280;">segundos</span>
            </div>
            <div style="font-size:11px;color:#9ca3af;margin-top:4px;">
              Atributo: <code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:10px;color:#374151;">interval_time_real_time_telemetry_in_ms</code>
            </div>
          </div>

          <!-- Aguardo após check_device -->
          <div>
            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:var(--rtt-text,#1a1a2e);">
              Aguardo após check_device
            </label>
            <div style="display:flex;align-items:center;gap:10px;">
              <input id="rtt-poll-wait-input" type="number" min="0" max="60" step="1"
                value="${Math.round(checkDeviceWaitMs / 1000)}"
                style="width:90px;padding:8px 10px;border-radius:8px;
                       border:1px solid #d1d5db;background:#fff;
                       color:#111;font-size:16px;text-align:center;outline:none;">
              <span style="font-size:13px;color:#6b7280;">segundos</span>
            </div>
            <div style="font-size:11px;color:#9ca3af;margin-top:4px;">
              Atributo: <code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:10px;color:#374151;">wait_time_check_device_in_ms</code>
            </div>
          </div>

          <!-- Disable check_device toggle -->
          <div style="display:flex;align-items:center;justify-content:space-between;
                      padding:12px 14px;background:#f9fafb;
                      border-radius:10px;border:1px solid #e5e7eb;">
            <div>
              <div style="font-size:13px;font-weight:600;color:#374151;">Desabilitar chamada</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">
                Bloqueia <code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;font-size:10px;">/api/check_device</code> nesta sessão
              </div>
            </div>
            <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer;">
              <input id="rtt-poll-disable-chk" type="checkbox" ${isDisabled() ? 'checked' : ''}
                style="opacity:0;width:0;height:0;position:absolute;">
              <span id="rtt-poll-disable-slider" style="
                position:absolute;inset:0;border-radius:24px;cursor:pointer;transition:background .2s;
                background:${isDisabled() ? '#3e1a7d' : '#d1d5db'};
              ">
                <span style="
                  position:absolute;left:${isDisabled() ? '22px' : '2px'};top:2px;
                  width:20px;height:20px;border-radius:50%;
                  background:#fff;transition:left .2s;display:block;
                  box-shadow:0 1px 3px rgba(0,0,0,0.2);
                "></span>
              </span>
            </label>
          </div>
        </div>
        <div class="myio-realtime-telemetry-footer" style="justify-content:flex-end;gap:10px;">
          <button id="rtt-poll-cancel" class="myio-telemetry-btn myio-telemetry-btn-secondary">Cancelar</button>
          <button id="rtt-poll-save" class="myio-telemetry-btn" style="background:#3e1a7d;color:#fff;font-weight:700;">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    backdrop.querySelector('#rtt-poll-close-x')?.addEventListener('click', close);
    backdrop.querySelector('#rtt-poll-cancel')?.addEventListener('click', close);
    backdrop.querySelector('#rtt-poll-disable-chk')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      setDisabled(checked);
      const slider = backdrop.querySelector('#rtt-poll-disable-slider') as HTMLElement;
      if (slider) {
        slider.style.background = checked ? '#3e1a7d' : '#d1d5db';
        const knob = slider.querySelector('span') as HTMLElement;
        if (knob) knob.style.left = checked ? '22px' : '2px';
      }
    });
    backdrop.querySelector('#rtt-poll-save')?.addEventListener('click', async () => {
      const intervalInput = backdrop.querySelector('#rtt-poll-interval-input') as HTMLInputElement;
      const waitInput = backdrop.querySelector('#rtt-poll-wait-input') as HTMLInputElement;
      const intervalSecs = Math.max(5, parseInt(intervalInput?.value || '30', 10));
      const waitSecs = Math.max(0, parseInt(waitInput?.value || '15', 10));
      checkDeviceIntervalMs = intervalSecs * 1000;
      checkDeviceWaitMs = waitSecs * 1000;
      const saved = await saveCheckDeviceInterval(checkDeviceIntervalMs, checkDeviceWaitMs);
      close();
      // restart tick with new intervals
      if (refreshIntervalId !== null) {
        clearTimeout(refreshIntervalId);
        refreshIntervalId = null;
      }
      isFirstTick = false; // don't do quick tick after manual config change
      scheduleCheckDeviceTick();
      console.log(`[RTT] Polling atualizado: ${intervalSecs}s + ${waitSecs}s wait — salvo: ${saved}`);
    });
  }

  /**
   * Seed realtime chart with today's history (from 00:00 to now).
   * Called on initial open and when switching back to Realtime mode.
   */
  async function seedRealtimeHistory(): Promise<void> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startTs = startOfDay.getTime();
    const endTs = now.getTime();
    const url = buildTsUrl({ startTs, endTs, limit: historyPoints, agg: 'NONE', orderBy: 'ASC' });

    try {
      const response = await fetch(url, { headers: { 'X-Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data: Record<string, Array<{ ts: number; value: number }>> = await response.json();
        telemetryHistory.clear();
        lastKnownValues.clear();
        for (const key of telemetryKeys) {
          const series = data[key];
          if (!series || series.length === 0) continue;
          const points = series.map((pt) => {
            let y = pt.value ?? 0;
            if (key === 'total_current' || key === 'current') y = y / 1000;
            if (key === 'fp_a' || key === 'fp_b' || key === 'fp_c' || key === 'powerFactor') y = y / 255;
            return { x: pt.ts, y };
          });
          telemetryHistory.set(key, points);
          lastKnownValues.set(key, points[points.length - 1].y);
        }
      }
    } catch (_e) {
      // seed failure is non-fatal — realtime append will still work
    }

    // Now fetch the very latest point and update cards + show content
    const data = await fetchLatestTelemetry();
    const values = processTelemetryData(data);
    updateHistory(values);
    updateTelemetryCards(values);

    const nowStr = new Date();
    lastUpdateText.textContent = `${strings.lastUpdate}: ${nowStr.toLocaleTimeString(locale)}`;

    loadingState.style.display = 'none';
    telemetryContent.style.display = 'block';

    if (!chart) {
      initializeChart();
    } else {
      rebuildChart();
    }
  }

  /**
   * Load and render period data into the chart (clears realtime history)
   */
  async function loadPeriodData(): Promise<void> {
    if (!periodStartISO || !periodEndISO) return;

    try {
      loadingState.style.display = 'block';
      telemetryContent.style.display = 'none';

      const data = await fetchPeriodTelemetry(periodStartISO, periodEndISO);

      // Rebuild history from period data
      telemetryHistory.clear();
      lastKnownValues.clear();

      for (const key of telemetryKeys) {
        const series = data[key];
        if (!series || series.length === 0) continue;

        const points = series.map((pt: { ts: number; value: number }) => {
          let y = pt.value ?? 0;
          if (key === 'total_current' || key === 'current') y = y / 1000;
          if (key === 'fp_a' || key === 'fp_b' || key === 'fp_c' || key === 'powerFactor') y = y / 255;
          return { x: pt.ts, y };
        });

        telemetryHistory.set(key, points);
        if (points.length > 0) lastKnownValues.set(key, points[points.length - 1].y);
      }

      // Build TelemetryValue array from last known values for the cards
      const values = telemetryKeys
        .filter((k) => lastKnownValues.has(k))
        .map((k) => {
          const numValue = lastKnownValues.get(k)!;
          const cfg = TELEMETRY_CONFIG[k] || { label: k, unit: '', icon: '📊', decimals: 2 };
          return {
            key: k,
            value: numValue,
            timestamp: Date.now(),
            formatted: `${numValue.toFixed(cfg.decimals)} ${cfg.unit}`,
            unit: cfg.unit,
            icon: cfg.icon,
            label: cfg.label,
            trend: 'stable' as const,
          };
        });

      loadingState.style.display = 'none';
      telemetryContent.style.display = 'block';

      updateTelemetryCards(values);

      const now = new Date();
      lastUpdateText.textContent = `${strings.lastUpdate}: ${now.toLocaleTimeString(locale)}`;

      if (!chart) {
        initializeChart();
      } else {
        rebuildChart();
      }
    } catch (error) {
      console.error('[RealTimeTelemetry] Error loading period data:', error);
      errorState.style.display = 'block';
      loadingState.style.display = 'none';
    }
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

      // RFC-0086: Convert mA to A for all current values (API returns milliamps)
      if (
        key === 'total_current' ||
        key === 'current' ||
        key === 'current_a' ||
        key === 'current_b' ||
        key === 'current_c'
      ) {
        numValue = numValue / 1000;
      }

      // FP values from firmware are 0–255; normalize to 0–1 for display
      if (key === 'fp_a' || key === 'fp_b' || key === 'fp_c' || key === 'powerFactor') {
        numValue = numValue / 255;
      }

      const formattedNum = numValue.toFixed(config.decimals);
      // 'fp' is an internal pseudo-unit for grouping — don't show it as a suffix
      const displayUnit = config.unit === 'fp' ? '' : config.unit;
      const formatted = displayUnit ? `${formattedNum} ${displayUnit}` : formattedNum;

      values.push({
        key,
        value: numValue,
        timestamp: latest.ts,
        formatted,
        unit: config.unit,
        icon: config.icon,
        label: config.label,
        trend: 'stable', // Will be calculated based on history
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
   * Update telemetry cards — grouped by grandeza (unit).
   * Each grandeza gets one card; phases are shown as compact rows inside.
   */
  /** Canonical key order within a grandeza group for stable phase ordering (Total → A → B → C). */
  const GROUP_KEY_ORDER: Record<string, string[]> = {
    W: ['consumption', 'power', 'activePower', 'a', 'b', 'c'],
    A: ['total_current', 'current', 'current_a', 'current_b', 'current_c'],
    V: ['voltage_a', 'voltage_b', 'voltage_c'],
    fp: ['powerFactor', 'fp_a', 'fp_b', 'fp_c'],
    kW: ['activePower'],
    kVAr: ['reactivePower'],
    kVA: ['apparentPower'],
    kWh: ['energy'],
    '°C': ['temperature'],
  };

  function updateTelemetryCards(values: TelemetryValue[]) {
    // Group by unit (grandeza)
    const groups = new Map<string, TelemetryValue[]>();
    for (const tel of values) {
      const unit = tel.unit || '_';
      if (!groups.has(unit)) groups.set(unit, []);
      groups.get(unit)!.push(tel);
    }

    // Sort each group by canonical key order
    for (const [unit, tels] of groups) {
      const order = GROUP_KEY_ORDER[unit] ?? [];
      tels.sort((a, b) => {
        const ia = order.indexOf(a.key);
        const ib = order.indexOf(b.key);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    }

    // 'fp' is internal — don't show as unit abbreviation in card header
    const headerUnitLabel = (unit: string) => (unit === '_' || unit === 'fp' ? '' : unit);

    telemetryCards.innerHTML = Array.from(groups.entries())
      .map(([unit, tels]) => {
        const meta = UNIT_GROUP_META[unit] || { label: unit || 'Outros', icon: '📊' };
        const firstKey = tels[0].key;
        const isMultiRow = tels.length > 1;

        if (isMultiRow) {
          const rows = tels
            .map((tel) => {
              const trend = calculateTrend(tel.key, tel.value);
              const trendIcon = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
              const shortLabel = PHASE_SHORT_LABEL[tel.key] ?? tel.label;
              return `
            <div class="myio-telemetry-card-row">
              <span class="myio-telemetry-card-row-label">${shortLabel}</span>
              <span class="myio-telemetry-card-row-value">${tel.formatted}</span>
              <span class="myio-telemetry-card-row-trend ${trend}">${trendIcon}</span>
              <button class="myio-rtt-card-info-btn myio-rtt-card-row-info" data-key="${tel.key}" title="Detalhes">ⓘ</button>
            </div>`;
            })
            .join('');

          // Computed average row for voltage phases
          let computedRow = '';
          if (unit === 'V') {
            const phaseKeys = ['voltage_a', 'voltage_b', 'voltage_c'];
            const vals = phaseKeys
              .map((k) => lastKnownValues.get(k))
              .filter((v): v is number => v !== undefined);
            if (vals.length === 3) {
              const avg = vals.reduce((s, v) => s + v, 0) / 3;
              const cfg = TELEMETRY_CONFIG['voltage_a'];
              computedRow = `
              <div class="myio-telemetry-card-row myio-telemetry-card-row--computed">
                <span class="myio-telemetry-card-row-label">Média</span>
                <span class="myio-telemetry-card-row-value">${avg.toFixed(cfg?.decimals ?? 1)} V</span>
                <span class="myio-telemetry-card-row-trend stable">→</span>
              </div>`;
            }
          } else if (unit === 'fp') {
            const fp_a = lastKnownValues.get('fp_a');
            const fp_b = lastKnownValues.get('fp_b');
            const fp_c = lastKnownValues.get('fp_c');
            // Use active power per phase (a/b/c) as weights if available
            // True system FP = (Pa+Pb+Pc) / (Pa/FPa + Pb/FPb + Pc/FPc)
            const pa = lastKnownValues.get('a');
            const pb = lastKnownValues.get('b');
            const pc = lastKnownValues.get('c');
            if (fp_a !== undefined && fp_b !== undefined && fp_c !== undefined) {
              let fpResult: number;
              let label: string;
              if (
                pa !== undefined &&
                pb !== undefined &&
                pc !== undefined &&
                fp_a > 0 &&
                fp_b > 0 &&
                fp_c > 0
              ) {
                // Weighted: FP_sistema = ΣP / Σ(P/FP) = ΣP / ΣS_aparente
                const totalP = pa + pb + pc;
                const totalS = pa / fp_a + pb / fp_b + pc / fp_c;
                fpResult = totalS > 0 ? totalP / totalS : (fp_a + fp_b + fp_c) / 3;
                label = 'Sistema';
              } else {
                // Fallback: simple average
                fpResult = (fp_a + fp_b + fp_c) / 3;
                label = 'Médio';
              }
              computedRow = `
              <div class="myio-telemetry-card-row myio-telemetry-card-row--computed">
                <span class="myio-telemetry-card-row-label">${label}</span>
                <span class="myio-telemetry-card-row-value">${fpResult.toFixed(3)}</span>
                <span class="myio-telemetry-card-row-trend stable">→</span>
              </div>`;
            }
          }

          return `
          <div class="myio-telemetry-card">
            <div class="myio-telemetry-card-header">
              <span class="myio-telemetry-card-icon">${meta.icon}</span>
              <span>${meta.label}</span>
              <span style="margin-left:auto;font-size:11px;color:#9ca3af;font-weight:400;">${headerUnitLabel(unit)}</span>
              <button class="myio-rtt-card-info-btn myio-rtt-card-header-info" data-key="${firstKey}" title="Histórico — ${meta.label}">ⓘ</button>
            </div>
            <div class="myio-telemetry-card-rows">${rows}${computedRow}</div>
          </div>`;
        }

        // Single-item group — use the classic big-value layout
        const tel = tels[0];
        const trend = calculateTrend(tel.key, tel.value);
        const trendIcon = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
        const trendLabel = strings[`trend_${trend}` as keyof typeof strings] || '';

        return `
        <div class="myio-telemetry-card">
          <div class="myio-telemetry-card-header">
            <span class="myio-telemetry-card-icon">${tel.icon}</span>
            <span>${tel.label}</span>
            <button class="myio-rtt-card-info-btn" data-key="${firstKey}" title="Detalhes">ⓘ</button>
          </div>
          <div class="myio-telemetry-card-value">${tel.formatted}</div>
          <div class="myio-telemetry-card-trend ${trend}">
            ${trendIcon} ${trendLabel}
          </div>
        </div>`;
      })
      .join('');
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
      const receivedKeys = values.map((v) => v.key);

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

    // Update all selected datasets in the chart
    if (chart) {
      selectedChartKeys.forEach((key, idx) => {
        const h = telemetryHistory.get(key);
        if (h && chart.data.datasets[idx]) {
          chart.data.datasets[idx].data = h;
        }
      });
      chart.update('none');
    }

    // Live-update card tooltip if open
    refreshCardTooltip();
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

  /** Convert hex color to rgba string. */
  function hexRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /**
   * Initialize chart with all currently selected keys as separate colored datasets.
   */
  function initializeChart() {
    const Chart = (window as any).Chart;
    if (!Chart) {
      console.warn('[RealTimeTelemetry] Chart.js not loaded');
      return;
    }

    chartContainer.style.display = 'block';

    const multi = selectedChartKeys.length > 1;
    const primaryKey = selectedChartKeys[0] || 'consumption';

    // Detect distinct units to decide if dual Y-axis is needed
    // Priority order for left axis: W > A > V > others
    const UNIT_PRIORITY: Record<string, number> = { W: 0, kW: 0, A: 1, V: 2 };
    const distinctUnits = [
      ...new Set(selectedChartKeys.map((k) => (TELEMETRY_CONFIG[k] || { unit: '' }).unit)),
    ].sort((a, b) => (UNIT_PRIORITY[a] ?? 99) - (UNIT_PRIORITY[b] ?? 99));
    const dualAxis = distinctUnits.length === 2;
    const leftUnit = distinctUnits[0] ?? '';
    const rightUnit = dualAxis ? distinctUnits[1] : '';

    // Derive axis colors from the first key in each unit group
    const leftAxisKey = selectedChartKeys.find((k) => (TELEMETRY_CONFIG[k]?.unit ?? '') === leftUnit);
    const rightAxisKey = dualAxis
      ? selectedChartKeys.find((k) => (TELEMETRY_CONFIG[k]?.unit ?? '') === rightUnit)
      : null;
    const leftAxisColor = leftAxisKey ? KEY_COLORS[leftAxisKey] || '#555' : '#555';
    const rightAxisColor = rightAxisKey ? KEY_COLORS[rightAxisKey] || '#555' : '#555';

    function makeTickCallback(unit: string) {
      return function (value: any) {
        if (unit === 'W') {
          if (value >= 1000) return `${(value / 1000).toFixed(1)} kW`;
          return `${value} W`;
        }
        return `${value}${unit ? ' ' + unit : ''}`;
      };
    }

    const datasets = selectedChartKeys.map((key) => {
      const color = KEY_COLORS[key] || '#667eea';
      const cfg = TELEMETRY_CONFIG[key] || { label: key, unit: '' };
      const yAxisID = dualAxis ? (cfg.unit === rightUnit ? 'y1' : 'y') : 'y';
      return {
        label: cfg.label,
        data: (telemetryHistory.get(key) || []) as Array<{ x: number; y: number }>,
        borderColor: color,
        backgroundColor: hexRgba(color, multi ? 0.05 : 0.1),
        borderWidth: 2,
        fill: !multi,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
        yAxisID,
      };
    });

    const isDark = currentTheme === 'dark';
    const xLabelColor = isDark ? '#94a3b8' : '#6b7280';
    const xGridColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.06)';

    const isDailyBucket = selectedIntervalMs === 86400000;
    const xTickCallback = isDailyBucket
      ? function (value: any) {
          return new Date(value).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
        }
      : function (value: any) {
          return new Date(value).toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        };

    const scales: Record<string, any> = {
      x: {
        type: 'linear',
        ticks: {
          maxRotation: isDailyBucket ? 0 : 45,
          minRotation: 0,
          color: xLabelColor,
          callback: xTickCallback,
        },
        title: { display: true, text: isDailyBucket ? 'Data' : 'Hora', color: xLabelColor },
        grid: { color: xGridColor },
        // For daily buckets: force ticks at exact data-point positions (TB anchors at bucket midpoint)
        ...(isDailyBucket
          ? {
              afterBuildTicks: (scale: any) => {
                const xVals = [
                  ...new Set(datasets.flatMap((d: any) => (d.data as Array<{ x: number }>).map((p) => p.x))),
                ].sort((a: number, b: number) => a - b);
                scale.ticks = xVals.map((v: number) => ({ value: v }));
              },
            }
          : {}),
      },
      y: {
        position: 'left',
        beginAtZero: true,
        ticks: { callback: makeTickCallback(leftUnit), color: leftAxisColor },
        title: { display: true, text: leftUnit, color: leftAxisColor, font: { weight: 'bold' as const } },
        grid: { color: hexRgba(leftAxisColor, 0.08) },
      },
    };

    if (dualAxis) {
      scales['y1'] = {
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        ticks: { callback: makeTickCallback(rightUnit), color: rightAxisColor },
        title: { display: true, text: rightUnit, color: rightAxisColor, font: { weight: 'bold' as const } },
      };
    }

    chart = new Chart(chartCanvas, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: multi },
          tooltip: {
            callbacks: {
              title: function (context: any) {
                const timestamp = context[0].parsed.x;
                if (isDailyBucket) {
                  return new Date(timestamp).toLocaleDateString(locale, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });
                }
                return new Date(timestamp).toLocaleString(locale, {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
              },
              label: function (context: any) {
                const key = selectedChartKeys[context.datasetIndex] ?? primaryKey;
                return `${context.dataset.label}: ${getFormattedValue(key, context.parsed.y)}`;
              },
            },
          },
        },
        scales,
      },
    });
  }

  /**
   * Rebuild chart after selectedChartKeys changes (destroy + reinit + repopulate).
   */
  function rebuildChart() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    initializeChart();
  }

  /**
   * Refresh telemetry data (only runs in realtime mode)
   */
  async function refreshData() {
    if (currentMode === 'period') return; // period mode does not auto-refresh

    try {
      const data = await fetchLatestTelemetry();
      const values = processTelemetryData(data);

      updateHistory(values);
      updateTelemetryCards(values);

      // Track last telemetry update for Device OK badge
      if (values.length > 0) {
        lastTelemetryUpdateMs = Date.now();
        updateStatusBadges();
      }

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
      if (refreshIntervalId !== null) {
        clearTimeout(refreshIntervalId);
        refreshIntervalId = null;
      }
      stopSession();
      clearCountdown();
      pauseBtnIcon.textContent = '▶️';
      pauseBtnText.textContent = strings.resume;
      pauseBtn.classList.remove('myio-telemetry-btn-secondary');
      pauseBtn.classList.add('myio-telemetry-btn-primary');
      statusIndicator.classList.add('paused');
      statusText.textContent = `${strings.autoUpdate}: OFF`;
    } else {
      scheduleCheckDeviceTick();
      startSession();
      pauseBtnIcon.textContent = '⏸️';
      pauseBtnText.textContent = strings.pause;
      pauseBtn.classList.remove('myio-telemetry-btn-primary');
      pauseBtn.classList.add('myio-telemetry-btn-secondary');
      statusIndicator.classList.remove('paused');
      statusText.textContent = `${strings.autoUpdate}: ON`;
    }
  }

  /**
   * Export telemetry history to CSV
   */
  function exportToCSV() {
    const rows: string[] = [];
    rows.push('Timestamp,' + telemetryKeys.map((k) => TELEMETRY_CONFIG[k]?.label || k).join(','));

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
    if (expandIcon) {
      expandIcon.innerHTML = isExpanded
        ? '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="10" y1="14" x2="3" y2="21"></line><line x1="21" y1="3" x2="14" y2="10"></line>'
        : '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
    }
    if (chart) {
      // Use two rAFs so CSS layout fully settles before reading dimensions
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (isExpanded) {
            // Disable Chart.js responsive mode and set explicit px to stop the resize loop
            chart.options.responsive = false;
            const w = chartContainer.clientWidth - 40; // 20px padding each side
            const h = chartContainer.clientHeight - 60; // title + padding
            chart.resize(Math.max(w, 200), Math.max(h, 120));
          } else {
            // Restore responsive mode for normal (windowed) view
            chart.options.responsive = true;
            chartCanvas.style.height = '';
            chart.resize();
          }
        })
      );
    }
  }

  /**
   * Switch between Realtime and Período modes
   */
  async function switchMode(mode: 'realtime' | 'period') {
    if (mode === currentMode) return;
    currentMode = mode;
    updateChartTitle();

    modeTabs.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset['mode'] === mode);
    });

    if (mode === 'period') {
      // Stop polling tick and countdown
      if (refreshIntervalId !== null) {
        clearTimeout(refreshIntervalId);
        refreshIntervalId = null;
      }
      clearCountdown();
      periodRow.classList.add('visible');

      // Save realtime history snapshot so we can resume on switch back
      realtimeHistorySnapshot = new Map(Array.from(telemetryHistory.entries()).map(([k, v]) => [k, [...v]]));
      realtimeLastKnownSnapshot = new Map(lastKnownValues);

      // Initialize date picker lazily
      if (!periodDatePicker) {
        try {
          periodDatePicker = await attachDateRangePicker(dateRangeInput, {
            maxRangeDays: 90,
            includeTime: true,
            timePrecision: 'minute',
            onApply: ({ startISO, endISO }) => {
              periodStartISO = startISO;
              periodEndISO = endISO;
            },
          });
        } catch (e) {
          console.warn('[RealTimeTelemetry] DateRangePicker init failed:', e);
        }
      }
    } else {
      // Realtime mode: restore snapshot if available, then continue appending
      periodRow.classList.remove('visible');

      if (realtimeHistorySnapshot) {
        telemetryHistory = new Map(
          Array.from(realtimeHistorySnapshot.entries()).map(([k, v]) => [k, [...v]])
        );
        lastKnownValues = realtimeLastKnownSnapshot ? new Map(realtimeLastKnownSnapshot) : new Map();
        realtimeHistorySnapshot = null;
        realtimeLastKnownSnapshot = null;
        // Update chart with restored data without clearing
        rebuildChart();
      }

      if (!isPaused) {
        isFirstTick = true; // reset quick-tick on mode switch back to realtime
        await refreshData();
        scheduleCheckDeviceTick();
        startSession();
      }
    }
  }

  // Mode tab clicks
  modeTabs.forEach((btn) => {
    btn.addEventListener('click', () => switchMode(btn.dataset['mode'] as 'realtime' | 'period'));
  });

  // Period load button
  periodLoadBtn?.addEventListener('click', () => {
    loadPeriodData();
  });

  // Event listeners
  closeBtn.addEventListener('click', closeModal);
  themeBtn?.addEventListener('click', toggleTheme);
  expandBtn?.addEventListener('click', toggleExpand);
  pauseBtn.addEventListener('click', togglePause);
  exportBtn.addEventListener('click', exportToCSV);

  // Status badges — each opens its own premium tooltip
  centralBadge?.addEventListener('click', () => {
    if (centralBadge) openStatusTooltip(centralBadge);
  });
  deviceBadge?.addEventListener('click', () => {
    if (deviceBadge) openDeviceInfoTooltip(deviceBadge);
  });

  // Card (i) button — open premium tooltip with telemetry history
  telemetryCards.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.myio-rtt-card-info-btn') as HTMLButtonElement | null;
    if (!btn) return;
    const key = btn.dataset['key'] ?? '';
    if (!key) return;
    // Toggle: close if already open for same key
    if (cardTooltipKey === key && cardTooltipEl) {
      closeCardTooltip();
      return;
    }
    openCardTooltip(key, btn);
  });

  // Custom multiselect — toggle trigger open/close
  multiselectTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = multiselectDropdown?.classList.toggle('open');
    multiselectTrigger.classList.toggle('open', !!open);
  });

  // Checkbox change — queue-aware, max 2 grandezas
  chartKeyMultiDiv?.addEventListener('change', (e) => {
    const cb = e.target as HTMLInputElement;
    if (cb.type !== 'checkbox') return;
    toggleChartKey(cb.value);
  });

  // Click outside closes the dropdown
  document.addEventListener('click', (e) => {
    if (chartKeyMultiDiv && !chartKeyMultiDiv.contains(e.target as Node)) {
      multiselectDropdown?.classList.remove('open');
      multiselectTrigger?.classList.remove('open');
    }
  });
  // Apply initial limit visibility: show only when agg is NONE
  if (chartLimitInput) {
    chartLimitInput.style.display = selectedAgg === 'NONE' ? '' : 'none';
  }

  chartAggSelector?.addEventListener('change', (e) => {
    selectedAgg = (e.target as HTMLSelectElement).value as typeof selectedAgg;
    if (chartLimitInput) {
      chartLimitInput.style.display = selectedAgg === 'NONE' ? '' : 'none';
    }
  });
  chartLimitInput?.addEventListener('change', (e) => {
    const v = parseInt((e.target as HTMLSelectElement).value, 10);
    if (v >= 10) selectedLimit = v;
  });

  chartIntervalSelect?.addEventListener('change', (e) => {
    selectedIntervalMs = parseInt((e.target as HTMLSelectElement).value, 10) || 0;
    // interval só funciona com agg ≠ NONE no ThingsBoard — força AVG quando intervalo > 0
    if (selectedIntervalMs > 0 && selectedAgg === 'NONE') {
      selectedAgg = 'AVG';
      if (chartAggSelector) chartAggSelector.value = 'AVG';
      if (chartLimitInput) chartLimitInput.style.display = 'none';
    } else if (selectedIntervalMs === 0 && selectedAgg === 'AVG') {
      // voltou para Padrão: restaura Bruto
      selectedAgg = 'NONE';
      if (chartAggSelector) chartAggSelector.value = 'NONE';
      if (chartLimitInput) chartLimitInput.style.display = '';
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  // Gear button: only for @myio.com.br users
  const gearBtn = overlay.querySelector('#rtt-gear-btn') as HTMLButtonElement | null;
  if (gearBtn) {
    if (isMyioUser) gearBtn.style.display = 'flex';
    gearBtn.addEventListener('click', openIntervalConfigModal);
  }

  // Load polling interval from customer attribute (if customerId provided)
  if (customerId) await loadCheckDeviceInterval();

  // Initial fetch: if centralId is provided, call check_device first, wait 8 s, then fetch telemetry.
  // This ensures the first telemetry read reflects the freshest data from the device.
  const useCheckDeviceOnOpen = !!centralId && !sessionStorage.getItem('rtt_check_device_disabled');
  if (useCheckDeviceOnOpen) {
    startCountdown(checkDeviceWaitMs);
    try {
      await fetch(`https://${centralId}.y.myio.com.br/api/check_device/${deviceCheckName}`, {
        signal: AbortSignal.timeout(10_000),
      });
      centralStatus = 'ok';
      checkDeviceHistory.push({ ts: Date.now(), status: 'ok' });
    } catch (e) {
      console.warn('[RTT] check_device (open) error:', (e as Error)?.message ?? e);
      centralStatus = 'offline';
      checkDeviceHistory.push({ ts: Date.now(), status: 'offline' });
    }
    if (checkDeviceHistory.length > MAX_CHECK_DEVICE_HISTORY) checkDeviceHistory.shift();
    updateStatusBadges();
    await new Promise<void>((r) => setTimeout(r, checkDeviceWaitMs));
    clearCountdown();
  }

  await refreshData();

  // Start regular polling tick (check_device → wait → refresh, repeating)
  isFirstTick = false; // opening already did the initial check_device + wait
  scheduleCheckDeviceTick();
  startSession();

  return {
    destroy: closeModal,
  };
}
