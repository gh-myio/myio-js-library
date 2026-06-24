# RFC-0093: Equipments Grid Real-Time Telemetry Mode - Full Implementation

- **Status**: Implemented (Ready for Rollback)
- **Created**: 2025-12-03
- **Author**: MyIO Team
- **Related RFCs**: RFC-0082, RFC-0084

---

## Summary

This RFC implements a real-time telemetry mode for the EQUIPMENTS grid widget. When activated, it continuously polls instantaneous power readings for all visible devices and updates the cards with live data.

### Key Features

1. **Toggle Button** - Activates/deactivates real-time mode
2. **Progress Bar** - Visual countdown timer showing time until next refresh
3. **Settings Modal** - Configurable refresh interval (10s, 15s, 30s, 45s, 60s, 90s, 120s)
4. **Batch Updates** - Collects ALL data first, then updates ALL cards at once
5. **Auto-disable** - Automatically stops after 30 minutes

---

## File Changes Overview

| File | Changes |
|------|---------|
| `template.html` | +18 lines (toggle button, settings button, progress bar) |
| `style.css` | +230 lines (progress bar, settings modal, card styles) |
| `controller.js` | +500 lines (RealTimeService, settings modal logic) |

---

## 1. Template Changes (`template.html`)

### Location: Lines 6-23

### Code to ADD:

```html
    <!-- RFC-0093: Real-Time Mode Toggle -->
    <div class="realtime-controls" id="realtimeControls">
      <button id="realtimeToggleBtn" class="realtime-toggle" title="Ativar modo tempo real">
        <span class="toggle-icon">⚡</span>
        <span class="toggle-label">Tempo Real</span>
        <span class="toggle-status">OFF</span>
      </button>
      <button id="realtimeSettingsBtn" class="realtime-settings-btn" title="Configurações" style="display: none;">
        <span>⚙️</span>
      </button>
      <!-- Progress bar container -->
      <div id="realtimeProgressContainer" class="realtime-progress-container" style="display: none;">
        <div class="realtime-progress-bar">
          <div id="realtimeProgressFill" class="realtime-progress-fill"></div>
        </div>
        <span id="realtimeProgressText" class="realtime-progress-text">30s</span>
      </div>
    </div>
```

### Full Modified Section:

```html
  <div class="toolbar-zoom">
    <div class="shopping-filter-chips" id="shoppingFilterChips"></div>
    <!-- RFC-0093: Real-Time Mode Toggle -->
    <div class="realtime-controls" id="realtimeControls">
      <button id="realtimeToggleBtn" class="realtime-toggle" title="Ativar modo tempo real">
        <span class="toggle-icon">⚡</span>
        <span class="toggle-label">Tempo Real</span>
        <span class="toggle-status">OFF</span>
      </button>
      <button id="realtimeSettingsBtn" class="realtime-settings-btn" title="Configurações" style="display: none;">
        <span>⚙️</span>
      </button>
      <!-- Progress bar container -->
      <div id="realtimeProgressContainer" class="realtime-progress-container" style="display: none;">
        <div class="realtime-progress-bar">
          <div id="realtimeProgressFill" class="realtime-progress-fill"></div>
        </div>
        <span id="realtimeProgressText" class="realtime-progress-text">30s</span>
      </div>
    </div>
  </div>
```

### To REMOVE (revert to original):

```html
  <div class="toolbar-zoom">
    <div class="shopping-filter-chips" id="shoppingFilterChips"></div>
  </div>
```

---

## 2. Style Changes (`style.css`)

### Location: After line 598 (after existing styles, before EOF)

### Code to ADD:

```css
/* ====== RFC-0093: REAL-TIME MODE STYLES ====== */
.realtime-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}

.realtime-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid #DDE7F1;
    border-radius: 8px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    color: var(--ink-1);
    font-size: var(--fs-xs);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.realtime-toggle:hover {
    border-color: #f59e0b;
    background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
}

.realtime-toggle.active {
    border-color: #f59e0b;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35);
    animation: realtimePulse 2s ease-in-out infinite;
}

.realtime-toggle .toggle-icon {
    font-size: 14px;
}

.realtime-toggle .toggle-status {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    background: rgba(0, 0, 0, 0.08);
}

.realtime-toggle.active .toggle-status {
    background: rgba(255, 255, 255, 0.25);
}

/* Settings button */
.realtime-settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid #DDE7F1;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
}

.realtime-settings-btn:hover {
    background: #f1f5f9;
    border-color: #f59e0b;
}

/* Progress bar container */
.realtime-progress-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
    border: 1px solid #fbbf24;
    border-radius: 8px;
    min-width: 120px;
}

.realtime-progress-bar {
    flex: 1;
    height: 6px;
    background: rgba(251, 191, 36, 0.3);
    border-radius: 3px;
    overflow: hidden;
    min-width: 60px;
}

.realtime-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
    border-radius: 3px;
    width: 100%;
    transition: width 0.1s linear;
}

.realtime-progress-fill.fetching {
    background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%);
    animation: progressPulse 0.5s ease-in-out infinite;
}

.realtime-progress-text {
    font-size: 11px;
    font-weight: 700;
    color: #92400e;
    min-width: 28px;
    text-align: right;
}

.realtime-progress-text.fetching {
    color: #1d4ed8;
}

@keyframes progressPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

/* Settings Modal */
.realtime-settings-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease;
}

.realtime-settings-modal.hidden {
    display: none;
}

.realtime-settings-card {
    background: #fff;
    border-radius: 16px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
}

.realtime-settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: #fff;
}

.realtime-settings-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
}

.realtime-settings-close {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: #fff;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}

.realtime-settings-close:hover {
    background: rgba(255, 255, 255, 0.3);
}

.realtime-settings-body {
    padding: 20px;
}

.realtime-settings-group {
    margin-bottom: 20px;
}

.realtime-settings-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-1);
    margin-bottom: 8px;
}

.realtime-settings-sublabel {
    font-size: 11px;
    color: var(--ink-2);
    font-weight: 400;
    display: block;
    margin-top: 2px;
}

.realtime-interval-selector {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.realtime-interval-btn {
    padding: 8px 16px;
    border: 2px solid #DDE7F1;
    border-radius: 8px;
    background: #fff;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-1);
    cursor: pointer;
    transition: all 0.2s;
}

.realtime-interval-btn:hover {
    border-color: #f59e0b;
    background: #fffbeb;
}

.realtime-interval-btn.active {
    border-color: #f59e0b;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: #fff;
}

.realtime-settings-footer {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    padding: 16px 20px;
    border-top: 1px solid #DDE7F1;
}

.realtime-settings-btn-cancel,
.realtime-settings-btn-save {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.realtime-settings-btn-cancel {
    background: #f1f5f9;
    border: 1px solid #DDE7F1;
    color: var(--ink-1);
}

.realtime-settings-btn-cancel:hover {
    background: #e2e8f0;
}

.realtime-settings-btn-save {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    border: none;
    color: #fff;
}

.realtime-settings-btn-save:hover {
    filter: brightness(1.1);
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes realtimePulse {
    0%, 100% { box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35); }
    50% { box-shadow: 0 2px 16px rgba(245, 158, 11, 0.55); }
}

@keyframes countdownPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

/* Real-Time Card Styles */
.equip-card.realtime-mode {
    border-color: #fbbf24;
    box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.2), var(--shadow);
}

.equip-card.realtime-mode .realtime-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: #ffffff;
    font-size: 9px;
    font-weight: 700;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);
}

.equip-card.realtime-mode .realtime-badge .live-dot {
    width: 6px;
    height: 6px;
    background: #ffffff;
    border-radius: 50%;
    animation: liveDotBlink 1s ease-in-out infinite;
}

@keyframes liveDotBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

/* Real-Time Power Display */
.equip-card.realtime-mode .power-realtime {
    font-size: var(--fs-xxl);
    font-weight: 700;
    color: #d97706;
    letter-spacing: 0.2px;
}

.equip-card.realtime-mode .last-update {
    font-size: var(--fs-2xs);
    color: var(--ink-2);
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
}

.equip-card.realtime-mode .last-update .update-icon {
    font-size: 10px;
}

/* Status indicator enhancements in real-time mode */
.equip-card.realtime-mode .chip.online {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: #ffffff;
}

.equip-card.realtime-mode .chip.offline {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: #ffffff;
}
```

---

## 3. Controller Changes (`controller.js`)

### 3.1 STATE Object Extension

#### Location: After existing STATE properties (around line 1155)

#### Code to ADD to STATE:

```javascript
  // RFC-0093: Real-Time Mode State
  realTimeActive: false,
  realTimePowerMap: new Map(), // deviceId -> { value: number, timestamp: number }
  realTimeIntervalId: null,
  realTimeCountdownId: null,
  realTimeStartedAt: null,
  realTimeNextRefresh: 0,
```

### 3.2 Configuration Constants

#### Location: After STATE object

#### Code to ADD:

```javascript
// RFC-0093: Real-Time Mode Constants
const REALTIME_CONFIG = {
  REFRESH_INTERVAL_MS: 30000, // 30 seconds (configurable via settings modal)
  MAX_RUNTIME_MS: 30 * 60 * 1000, // 30 minutes auto-disable
  BATCH_SIZE: 10, // Number of devices to query per batch
  BATCH_DELAY_MS: 50, // Delay between batches
  INTERVAL_OPTIONS: [10, 15, 30, 45, 60, 90, 120], // Available interval options in seconds
};
```

### 3.3 Real-Time Service Functions

#### Location: Before `bindFilterEvents()` function

#### Full Code Block to ADD:

```javascript
// ============================================
// RFC-0093: REAL-TIME TELEMETRY SERVICE
// ============================================

// Store settings modal reference
let realtimeSettingsModal = null;

/**
 * RFC-0093: Fetch instantaneous power for a single device
 * @param {string} deviceId - ThingsBoard device entity ID
 * @returns {Promise<{value: number, timestamp: number} | null>}
 */
async function fetchDevicePower(deviceId) {
  try {
    const token = myIOAuth?.getJwt?.() || localStorage.getItem('jwt_token');
    if (!token) {
      LogHelper.warn('[REALTIME] No JWT token available');
      return null;
    }

    const tbHost = window.MyIOUtils?.getTbHost?.() || '';
    const url = `${tbHost}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=power&limit=1&agg=NONE&useStrictDataTypes=true`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.power && data.power.length > 0) {
      const latest = data.power[0];
      return {
        value: Number(latest.value) || 0,
        timestamp: latest.ts || Date.now(),
      };
    }

    return { value: 0, timestamp: Date.now() };
  } catch (err) {
    LogHelper.error(`[REALTIME] Error fetching power for ${deviceId}:`, err);
    return null;
  }
}

/**
 * RFC-0093: Fetch power for ALL visible devices first, then update cards
 * This ensures all data is collected before any UI updates
 */
async function fetchAllDevicesPowerAndUpdate() {
  const filtered = applyFilters(STATE.allDevices, STATE.searchTerm, STATE.selectedIds, STATE.sortMode);

  if (filtered.length === 0) {
    LogHelper.log('[REALTIME] No devices to fetch');
    return;
  }

  // Show fetching state
  setProgressFetchingState(true);
  LogHelper.log(`[REALTIME] Fetching power for ${filtered.length} devices...`);

  // Split into batches
  const batches = [];
  for (let i = 0; i < filtered.length; i += REALTIME_CONFIG.BATCH_SIZE) {
    batches.push(filtered.slice(i, i + REALTIME_CONFIG.BATCH_SIZE));
  }

  // Buffer to store all results before updating UI
  const resultsBuffer = new Map();
  let fetchedCount = 0;

  // Fetch all devices in batches
  for (const batch of batches) {
    const promises = batch.map(async (device) => {
      const entityId = device.entityId;
      if (!entityId) return;

      const powerData = await fetchDevicePower(entityId);
      if (powerData) {
        resultsBuffer.set(entityId, powerData);
        fetchedCount++;
      }
    });

    await Promise.all(promises);

    // Small delay between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, REALTIME_CONFIG.BATCH_DELAY_MS));
    }
  }

  LogHelper.log(`[REALTIME] Fetched ${fetchedCount}/${filtered.length} devices`);

  // Now update all cards at once
  resultsBuffer.forEach((powerData, entityId) => {
    STATE.realTimePowerMap.set(entityId, powerData);
    updateCardPowerDisplay(entityId, powerData);
  });

  // Hide fetching state
  setProgressFetchingState(false);

  LogHelper.log(`[REALTIME] Updated ${fetchedCount} cards`);
}

/**
 * RFC-0093: Set progress bar fetching state
 */
function setProgressFetchingState(isFetching) {
  const progressFill = document.getElementById('realtimeProgressFill');
  const progressText = document.getElementById('realtimeProgressText');

  if (progressFill) {
    if (isFetching) {
      progressFill.classList.add('fetching');
      progressFill.style.width = '100%';
    } else {
      progressFill.classList.remove('fetching');
    }
  }

  if (progressText) {
    if (isFetching) {
      progressText.classList.add('fetching');
      progressText.textContent = '...';
    } else {
      progressText.classList.remove('fetching');
    }
  }
}

/**
 * RFC-0093: Update a single card's power display in the DOM
 */
function updateCardPowerDisplay(entityId, powerData) {
  const card = document.querySelector(`[data-entity-id="${entityId}"]`);
  if (!card) return;

  // Add realtime-mode class if not present
  if (!card.classList.contains('realtime-mode')) {
    card.classList.add('realtime-mode');
  }

  // Update power value
  const powerEl = card.querySelector('.power');
  if (powerEl) {
    const powerKw = (powerData.value / 1000).toFixed(2);
    powerEl.textContent = powerKw;
  }

  // Update or create last update timestamp
  let lastUpdateEl = card.querySelector('.last-update');
  if (!lastUpdateEl) {
    const subEl = card.querySelector('.sub');
    if (subEl) {
      subEl.innerHTML = `<span class="last-update"><span class="update-icon">🕐</span> ${formatTimeAgo(powerData.timestamp)}</span>`;
    }
  } else {
    lastUpdateEl.innerHTML = `<span class="update-icon">🕐</span> ${formatTimeAgo(powerData.timestamp)}`;
  }

  // Add badge if not present
  if (!card.querySelector('.realtime-badge')) {
    const badge = document.createElement('div');
    badge.className = 'realtime-badge';
    badge.innerHTML = '<span class="live-dot"></span> LIVE';
    card.appendChild(badge);
  }
}

/**
 * RFC-0093: Format timestamp as relative time
 */
function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);

  if (diff < 5) return 'agora';
  if (diff < 60) return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  return `há ${Math.floor(diff / 3600)}h`;
}

/**
 * RFC-0093: Update the progress bar display
 */
function updateProgressBar() {
  const progressContainer = document.getElementById('realtimeProgressContainer');
  const progressFill = document.getElementById('realtimeProgressFill');
  const progressText = document.getElementById('realtimeProgressText');

  if (!progressContainer || !progressFill || !progressText) return;

  if (!STATE.realTimeActive) {
    progressContainer.style.display = 'none';
    return;
  }

  progressContainer.style.display = 'flex';

  const now = Date.now();
  const totalDuration = REALTIME_CONFIG.REFRESH_INTERVAL_MS;
  const elapsed = now - STATE.realTimeStartedAt;
  const cycleElapsed = elapsed % totalDuration;
  const remaining = Math.max(0, Math.ceil((totalDuration - cycleElapsed) / 1000));

  // Calculate percentage (countdown - starts at 100% and goes to 0%)
  const percentage = ((totalDuration - cycleElapsed) / totalDuration) * 100;

  progressFill.style.width = `${Math.max(0, percentage)}%`;
  progressText.textContent = `${remaining}s`;
}

/**
 * RFC-0093: Run real-time cycle (fetch + update + restart timer)
 */
async function runRealtimeCycle() {
  if (!STATE.realTimeActive) return;

  // Check max runtime
  if (Date.now() - STATE.realTimeStartedAt > REALTIME_CONFIG.MAX_RUNTIME_MS) {
    LogHelper.log('[REALTIME] Max runtime reached, stopping...');
    stopRealTimeMode();
    return;
  }

  // Fetch all data and update cards
  await fetchAllDevicesPowerAndUpdate();

  // Schedule next cycle only after update is complete
  if (STATE.realTimeActive) {
    STATE.realTimeNextRefresh = Date.now() + REALTIME_CONFIG.REFRESH_INTERVAL_MS;
    STATE.realTimeIntervalId = setTimeout(runRealtimeCycle, REALTIME_CONFIG.REFRESH_INTERVAL_MS);
  }
}

/**
 * RFC-0093: Start real-time mode
 */
async function startRealTimeMode() {
  if (STATE.realTimeActive) return;

  LogHelper.log('[REALTIME] Starting real-time mode...');

  STATE.realTimeActive = true;
  STATE.realTimeStartedAt = Date.now();
  STATE.realTimePowerMap.clear();

  // Update toggle button UI
  const toggleBtn = document.getElementById('realtimeToggleBtn');
  if (toggleBtn) {
    toggleBtn.classList.add('active');
    toggleBtn.querySelector('.toggle-status').textContent = 'ON';
    toggleBtn.title = 'Desativar modo tempo real';
  }

  // Show settings button
  const settingsBtn = document.getElementById('realtimeSettingsBtn');
  if (settingsBtn) {
    settingsBtn.style.display = 'flex';
  }

  // Show progress bar
  const progressContainer = document.getElementById('realtimeProgressContainer');
  if (progressContainer) {
    progressContainer.style.display = 'flex';
  }

  // Initial fetch and update
  await fetchAllDevicesPowerAndUpdate();

  // Start progress bar update interval
  STATE.realTimeCountdownId = setInterval(updateProgressBar, 100);

  // Schedule next cycle
  STATE.realTimeNextRefresh = Date.now() + REALTIME_CONFIG.REFRESH_INTERVAL_MS;
  STATE.realTimeIntervalId = setTimeout(runRealtimeCycle, REALTIME_CONFIG.REFRESH_INTERVAL_MS);

  LogHelper.log(`[REALTIME] Real-time mode started (interval: ${REALTIME_CONFIG.REFRESH_INTERVAL_MS / 1000}s)`);
}

/**
 * RFC-0093: Stop real-time mode
 */
function stopRealTimeMode() {
  if (!STATE.realTimeActive) return;

  LogHelper.log('[REALTIME] Stopping real-time mode...');

  STATE.realTimeActive = false;

  // Clear intervals/timeouts
  if (STATE.realTimeIntervalId) {
    clearTimeout(STATE.realTimeIntervalId);
    STATE.realTimeIntervalId = null;
  }
  if (STATE.realTimeCountdownId) {
    clearInterval(STATE.realTimeCountdownId);
    STATE.realTimeCountdownId = null;
  }

  // Update toggle button UI
  const toggleBtn = document.getElementById('realtimeToggleBtn');
  if (toggleBtn) {
    toggleBtn.classList.remove('active');
    toggleBtn.querySelector('.toggle-status').textContent = 'OFF';
    toggleBtn.title = 'Ativar modo tempo real';
  }

  // Hide settings button
  const settingsBtn = document.getElementById('realtimeSettingsBtn');
  if (settingsBtn) {
    settingsBtn.style.display = 'none';
  }

  // Hide progress bar
  const progressContainer = document.getElementById('realtimeProgressContainer');
  if (progressContainer) {
    progressContainer.style.display = 'none';
  }

  // Remove realtime-mode class and badges from all cards
  document.querySelectorAll('.equip-card.realtime-mode').forEach((card) => {
    card.classList.remove('realtime-mode');
    const badge = card.querySelector('.realtime-badge');
    if (badge) badge.remove();
  });

  // Re-render cards with original consumption data
  reflowCards();

  STATE.realTimePowerMap.clear();
  STATE.realTimeStartedAt = null;

  LogHelper.log('[REALTIME] Real-time mode stopped');
}

/**
 * RFC-0093: Toggle real-time mode
 */
function toggleRealTimeMode() {
  if (STATE.realTimeActive) {
    stopRealTimeMode();
  } else {
    startRealTimeMode();
  }
}

/**
 * RFC-0093: Create and show settings modal
 */
function showRealtimeSettingsModal() {
  // Remove existing modal if any
  if (realtimeSettingsModal) {
    realtimeSettingsModal.remove();
  }

  const currentInterval = REALTIME_CONFIG.REFRESH_INTERVAL_MS / 1000;

  const modalHTML = `
    <div class="realtime-settings-modal" id="realtimeSettingsModal">
      <div class="realtime-settings-card">
        <div class="realtime-settings-header">
          <h3>⚡ Configurações Tempo Real</h3>
          <button class="realtime-settings-close" id="realtimeSettingsClose">×</button>
        </div>
        <div class="realtime-settings-body">
          <div class="realtime-settings-group">
            <label class="realtime-settings-label">
              Intervalo de Atualização
              <span class="realtime-settings-sublabel">Tempo entre cada ciclo de coleta de dados</span>
            </label>
            <div class="realtime-interval-selector" id="intervalSelector">
              ${REALTIME_CONFIG.INTERVAL_OPTIONS.map(
                (sec) =>
                  `<button class="realtime-interval-btn ${sec === currentInterval ? 'active' : ''}" data-interval="${sec}">${sec}s</button>`
              ).join('')}
            </div>
          </div>
          <div class="realtime-settings-group" style="margin-bottom: 0;">
            <label class="realtime-settings-label">
              Informações
            </label>
            <p style="font-size: 12px; color: var(--ink-2); margin: 0; line-height: 1.5;">
              • O modo tempo real busca a potência instantânea de cada equipamento<br>
              • As atualizações ocorrem após todas as requisições completarem<br>
              • O modo desliga automaticamente após 30 minutos
            </p>
          </div>
        </div>
        <div class="realtime-settings-footer">
          <button class="realtime-settings-btn-cancel" id="realtimeSettingsCancel">Cancelar</button>
          <button class="realtime-settings-btn-save" id="realtimeSettingsSave">Salvar</button>
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHTML;
  realtimeSettingsModal = container.firstElementChild;
  document.body.appendChild(realtimeSettingsModal);

  // Bind events
  let selectedInterval = currentInterval;

  // Interval button clicks
  realtimeSettingsModal.querySelectorAll('.realtime-interval-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      realtimeSettingsModal.querySelectorAll('.realtime-interval-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedInterval = parseInt(btn.dataset.interval, 10);
    });
  });

  // Close button
  realtimeSettingsModal.querySelector('#realtimeSettingsClose').addEventListener('click', hideRealtimeSettingsModal);

  // Cancel button
  realtimeSettingsModal.querySelector('#realtimeSettingsCancel').addEventListener('click', hideRealtimeSettingsModal);

  // Save button
  realtimeSettingsModal.querySelector('#realtimeSettingsSave').addEventListener('click', () => {
    REALTIME_CONFIG.REFRESH_INTERVAL_MS = selectedInterval * 1000;
    LogHelper.log(`[REALTIME] Interval changed to ${selectedInterval}s`);

    // If real-time is active, restart with new interval
    if (STATE.realTimeActive) {
      // Clear current timeout
      if (STATE.realTimeIntervalId) {
        clearTimeout(STATE.realTimeIntervalId);
      }
      // Reset timer with new interval
      STATE.realTimeStartedAt = Date.now();
      STATE.realTimeNextRefresh = Date.now() + REALTIME_CONFIG.REFRESH_INTERVAL_MS;
      STATE.realTimeIntervalId = setTimeout(runRealtimeCycle, REALTIME_CONFIG.REFRESH_INTERVAL_MS);
    }

    hideRealtimeSettingsModal();
  });

  // Click outside to close
  realtimeSettingsModal.addEventListener('click', (e) => {
    if (e.target === realtimeSettingsModal) {
      hideRealtimeSettingsModal();
    }
  });

  // ESC to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      hideRealtimeSettingsModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * RFC-0093: Hide settings modal
 */
function hideRealtimeSettingsModal() {
  if (realtimeSettingsModal) {
    realtimeSettingsModal.remove();
    realtimeSettingsModal = null;
  }
}

/**
 * RFC-0093: Bind real-time toggle and settings events
 */
function bindRealTimeToggle() {
  const toggleBtn = document.getElementById('realtimeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleRealTimeMode);
    LogHelper.log('[REALTIME] Toggle button bound');
  }

  const settingsBtn = document.getElementById('realtimeSettingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', showRealtimeSettingsModal);
    LogHelper.log('[REALTIME] Settings button bound');
  }
}

// ============================================
// END RFC-0093: REAL-TIME TELEMETRY SERVICE
// ============================================
```

### 3.4 onInit Hook

#### Location: End of `self.onInit` function (before closing `};`)

#### Code to ADD:

```javascript
  // RFC-0093: Bind real-time toggle button
  bindRealTimeToggle();
```

### 3.5 onDestroy Hook

#### Location: Inside `self.onDestroy` function

#### Code to ADD:

```javascript
  // RFC-0093: Cleanup real-time mode
  if (STATE.realTimeActive) {
    stopRealTimeMode();
  }
  if (STATE.realTimeIntervalId) {
    clearTimeout(STATE.realTimeIntervalId);
    STATE.realTimeIntervalId = null;
  }
  if (STATE.realTimeCountdownId) {
    clearInterval(STATE.realTimeCountdownId);
    STATE.realTimeCountdownId = null;
  }
  LogHelper.log('[EQUIPMENTS] [RFC-0093] Real-time mode cleanup complete');
```

---

## 4. Rollback Instructions

To remove RFC-0093 implementation:

### 4.1 template.html

Replace this:
```html
  <div class="toolbar-zoom">
    <div class="shopping-filter-chips" id="shoppingFilterChips"></div>
    <!-- RFC-0093: Real-Time Mode Toggle -->
    <div class="realtime-controls" id="realtimeControls">
      ...
    </div>
  </div>
```

With this:
```html
  <div class="toolbar-zoom">
    <div class="shopping-filter-chips" id="shoppingFilterChips"></div>
  </div>
```

### 4.2 style.css

Remove all CSS from `/* ====== RFC-0093: REAL-TIME MODE STYLES ====== */` to EOF.

### 4.3 controller.js

1. Remove from STATE:
   - `realTimeActive`
   - `realTimePowerMap`
   - `realTimeIntervalId`
   - `realTimeCountdownId`
   - `realTimeStartedAt`
   - `realTimeNextRefresh`

2. Remove `REALTIME_CONFIG` constant

3. Remove entire section from `// ============================================ // RFC-0093: REAL-TIME TELEMETRY SERVICE` to `// END RFC-0093: REAL-TIME TELEMETRY SERVICE`

4. Remove from onInit: `bindRealTimeToggle();`

5. Remove from onDestroy: RFC-0093 cleanup code

---

## 5. Visual Reference

### Toggle Button States

```
OFF State:
┌─────────────────────────────────┐
│ ⚡ Tempo Real  [OFF]            │
└─────────────────────────────────┘

ON State (with progress bar):
┌─────────────────────────────────────────────────────────┐
│ ⚡ Tempo Real  [ON]  [⚙️]  [████████░░░░ 24s]          │
└─────────────────────────────────────────────────────────┘

Fetching State:
┌─────────────────────────────────────────────────────────┐
│ ⚡ Tempo Real  [ON]  [⚙️]  [████████████ ...]          │
└─────────────────────────────────────────────────────────┘
```

### Settings Modal

```
┌─────────────────────────────────────────┐
│ ⚡ Configurações Tempo Real         [×] │
├─────────────────────────────────────────┤
│                                         │
│ Intervalo de Atualização                │
│ Tempo entre cada ciclo de coleta        │
│                                         │
│ [10s] [15s] [30s*] [45s] [60s] [90s]   │
│                                         │
│ Informações                             │
│ • Busca potência instantânea            │
│ • Atualiza após todas requisições       │
│ • Desliga após 30 minutos               │
│                                         │
├─────────────────────────────────────────┤
│              [Cancelar] [Salvar]        │
└─────────────────────────────────────────┘
```

### Card in Real-Time Mode

```
┌─────────────────────────────────┐
│ [Icon] Device Name    [LIVE ●] │
│ Identifier                      │
├─────────────────────────────────┤
│ Status: 🟢 Online               │
│                                 │
│              ⚡ 3.42 kW         │
│              🕐 há 5s           │
│                                 │
│ [==========] 85%                │
└─────────────────────────────────┘
```

---

## 6. API Reference

### Endpoint Used

```
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries
  ?keys=power
  &limit=1
  &agg=NONE
  &useStrictDataTypes=true
```

### Headers

```
Content-Type: application/json
X-Authorization: Bearer {jwt_token}
```

### Response Format

```json
{
  "power": [
    {
      "ts": 1701619200000,
      "value": 3420.5
    }
  ]
}
```

---

## 7. Configuration Reference

```javascript
const REALTIME_CONFIG = {
  REFRESH_INTERVAL_MS: 30000,     // Default: 30 seconds
  MAX_RUNTIME_MS: 1800000,        // 30 minutes
  BATCH_SIZE: 10,                 // Devices per batch
  BATCH_DELAY_MS: 50,             // Delay between batches
  INTERVAL_OPTIONS: [10, 15, 30, 45, 60, 90, 120]
};
```

---

*Document created: 2025-12-03*
*Last updated: 2025-12-03*
