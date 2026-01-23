/* global document, window, localStorage */

/**
 * RFC-0137: LibraryVersionChecker Component
 *
 * A reusable component that displays the current library version and checks
 * npm registry for updates. Shows visual indicators and provides helpful
 * instructions when updates are available.
 *
 * @example
 * import { createLibraryVersionChecker } from 'myio-js-library';
 *
 * const container = document.getElementById('version-display');
 * createLibraryVersionChecker(container, {
 *   packageName: 'myio-js-library',
 *   currentVersion: '0.1.327',
 *   onStatusChange: (status, current, latest) => console.log(status)
 * });
 */

// Constants
const NPM_REGISTRY_BASE = 'https://registry.npmjs.org';
const CACHE_KEY_PREFIX = 'myio:npm-version-cache:';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_TOAST_INTERVAL_MS = 60 * 1000; // 60 seconds
const STYLE_ID = 'myio-lib-version-checker-styles';
const TOOLTIP_STYLE_ID = 'myio-lib-version-tooltip-styles';

/**
 * @typedef {'checking' | 'up-to-date' | 'outdated' | 'error'} VersionStatus
 */

/**
 * @typedef {'dark' | 'light'} Theme
 */

/**
 * @typedef {Object} LibraryVersionCheckerOptions
 * @property {string} packageName - npm package name to check
 * @property {string} currentVersion - Currently installed version
 * @property {number} [cacheTtlMs] - Cache TTL in milliseconds (default: 5 minutes)
 * @property {number} [toastIntervalMs] - Toast warning interval in milliseconds (default: 60 seconds)
 * @property {Theme} [theme] - Color theme: 'dark' (default) or 'light'
 * @property {(status: VersionStatus, currentVersion: string, latestVersion: string | null) => void} [onStatusChange] - Callback when status changes
 */

/**
 * Injects component styles into the document
 * @param {Document} doc - Document to inject styles into
 */
function injectStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .myio-lib-version {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }

    /* Dark theme (default) */
    .myio-lib-version--dark .myio-lib-version__text {
      font-size: 12px;
      color: #9CA3AF;
      opacity: 0.8;
      letter-spacing: 0.3px;
    }

    .myio-lib-version--dark .myio-lib-version__refresh {
      color: #9CA3AF;
    }

    /* Light theme */
    .myio-lib-version--light .myio-lib-version__text {
      font-size: 12px;
      color: #4B5563;
      opacity: 0.9;
      letter-spacing: 0.3px;
    }

    .myio-lib-version--light .myio-lib-version__refresh {
      color: #6B7280;
    }

    .myio-lib-version__status {
      font-size: 14px;
      cursor: pointer;
      transition: transform 0.2s ease;
      line-height: 1;
    }

    .myio-lib-version__status:hover {
      transform: scale(1.2);
    }

    .myio-lib-version__status--checking {
      color: #6B7280;
      animation: myio-spin 1s linear infinite;
    }

    .myio-lib-version__status--up-to-date {
      color: #10B981;
    }

    .myio-lib-version__status--outdated {
      color: #F59E0B;
      animation: myio-pulse-warning 2s infinite;
    }

    .myio-lib-version__status--error {
      color: #6B7280;
    }

    .myio-lib-version__refresh {
      font-size: 12px;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s ease, transform 0.2s ease;
      line-height: 1;
      padding: 2px;
      border-radius: 4px;
    }

    .myio-lib-version__refresh:hover {
      opacity: 1;
      transform: scale(1.1);
    }

    .myio-lib-version__refresh--spinning {
      animation: myio-spin 0.8s linear infinite;
      opacity: 1;
      color: #3B82F6;
    }

    @keyframes myio-pulse-warning {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @keyframes myio-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  doc.head.appendChild(style);
}

/**
 * Injects tooltip styles into the document
 * @param {Document} doc - Document to inject styles into
 */
function injectTooltipStyles(doc) {
  if (doc.getElementById(TOOLTIP_STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = TOOLTIP_STYLE_ID;
  style.textContent = `
    .myio-ver-tooltip-container {
      position: fixed;
      z-index: 999999;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }

    /* Light theme tooltip (default) */
    .myio-ver-tooltip-container--light .myio-ver-tooltip {
      background: #fff;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }

    .myio-ver-tooltip-container--light .myio-ver-tooltip__row {
      border-bottom: 1px solid #f3f4f6;
    }

    .myio-ver-tooltip-container--light .myio-ver-tooltip__label {
      color: #6B7280;
    }

    .myio-ver-tooltip-container--light .myio-ver-tooltip__value {
      color: #1F2937;
    }

    .myio-ver-tooltip-container--light .myio-ver-tooltip__help {
      border-top: 1px solid #E5E7EB;
    }

    .myio-ver-tooltip-container--light .myio-ver-tooltip__help-title {
      color: #374151;
    }

    .myio-ver-tooltip-container--light .myio-ver-tooltip__os-section {
      background: #F9FAFB;
    }

    .myio-ver-tooltip-container--light .myio-ver-tooltip__os-label {
      color: #374151;
    }

    .myio-ver-tooltip-container--light .myio-ver-tooltip__help-item {
      color: #4B5563;
    }

    .myio-ver-tooltip-container--light .myio-ver-tooltip__kbd {
      background: #fff;
      border: 1px solid #D1D5DB;
      color: #374151;
    }

    .myio-ver-tooltip-container--light .myio-ver-tooltip__help-note {
      background: #F0F9FF;
      color: #0369A1;
    }

    /* Dark theme tooltip */
    .myio-ver-tooltip-container--dark .myio-ver-tooltip {
      background: #1E293B;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }

    .myio-ver-tooltip-container--dark .myio-ver-tooltip__row {
      border-bottom: 1px solid #334155;
    }

    .myio-ver-tooltip-container--dark .myio-ver-tooltip__label {
      color: #94A3B8;
    }

    .myio-ver-tooltip-container--dark .myio-ver-tooltip__value {
      color: #F1F5F9;
    }

    .myio-ver-tooltip-container--dark .myio-ver-tooltip__help {
      border-top: 1px solid #334155;
    }

    .myio-ver-tooltip-container--dark .myio-ver-tooltip__help-title {
      color: #E2E8F0;
    }

    .myio-ver-tooltip-container--dark .myio-ver-tooltip__os-section {
      background: #0F172A;
    }

    .myio-ver-tooltip-container--dark .myio-ver-tooltip__os-label {
      color: #E2E8F0;
    }

    .myio-ver-tooltip-container--dark .myio-ver-tooltip__help-item {
      color: #CBD5E1;
    }

    .myio-ver-tooltip-container--dark .myio-ver-tooltip__kbd {
      background: #334155;
      border: 1px solid #475569;
      color: #E2E8F0;
    }

    .myio-ver-tooltip-container--dark .myio-ver-tooltip__help-note {
      background: #0C4A6E;
      color: #7DD3FC;
    }

    .myio-ver-tooltip {
      border-radius: 12px;
      overflow: hidden;
      min-width: 320px;
      max-width: 400px;
    }

    .myio-ver-tooltip__header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 16px;
      font-weight: 600;
      font-size: 14px;
    }

    .myio-ver-tooltip__header--success {
      background: linear-gradient(135deg, #10B981, #059669);
      color: #fff;
    }

    .myio-ver-tooltip__header--warning {
      background: linear-gradient(135deg, #F59E0B, #D97706);
      color: #fff;
    }

    .myio-ver-tooltip__icon {
      font-size: 18px;
    }

    .myio-ver-tooltip__body {
      padding: 16px;
    }

    .myio-ver-tooltip__row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
    }

    .myio-ver-tooltip__row:last-of-type {
      border-bottom: none;
    }

    .myio-ver-tooltip__label {
      font-size: 13px;
    }

    .myio-ver-tooltip__value {
      font-weight: 600;
      font-size: 13px;
    }

    .myio-ver-tooltip__value--outdated {
      color: #DC2626 !important;
    }

    .myio-ver-tooltip__value--new {
      color: #059669 !important;
    }

    .myio-ver-tooltip__status {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 12px;
      text-align: center;
    }

    .myio-ver-tooltip__status--success {
      background: #D1FAE5;
      color: #065F46;
    }

    .myio-ver-tooltip__status--warning {
      background: #FEF3C7;
      color: #92400E;
    }

    .myio-ver-tooltip__help {
      margin-top: 16px;
      padding-top: 16px;
    }

    .myio-ver-tooltip__help-title {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 10px;
    }

    .myio-ver-tooltip__os-section {
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 8px;
    }

    .myio-ver-tooltip__os-label {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 6px;
    }

    .myio-ver-tooltip__help-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }

    .myio-ver-tooltip__kbd {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 11px;
      font-weight: 500;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .myio-ver-tooltip__help-note {
      margin-top: 12px;
      padding: 10px;
      border-radius: 8px;
      font-size: 11px;
      line-height: 1.4;
    }
  `;
  doc.head.appendChild(style);
}

/**
 * Compare semantic versions
 * @param {string} a - First version
 * @param {string} b - Second version
 * @returns {number} 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

/**
 * Get keyboard shortcuts for all OS
 * @returns {{ windows: { primary: string, alt: string }, mac: { primary: string, alt: string } }}
 */
function getRefreshShortcuts() {
  return {
    windows: {
      primary: 'Ctrl + Shift + R',
      alt: 'Ctrl + F5',
    },
    mac: {
      primary: '⌘ + Shift + R',
      alt: '⌘ + Option + R',
    },
  };
}

/**
 * Show premium tooltip with version status details
 * @param {HTMLElement} anchor - Element to anchor tooltip to
 * @param {string} currentVer - Current version
 * @param {string} latestVer - Latest version from npm
 * @param {boolean} isUpToDate - Whether version is up to date
 * @param {Theme} theme - Color theme
 */
function showVersionTooltip(anchor, currentVer, latestVer, isUpToDate, theme = 'dark') {
  // Use top-level document for modal
  const topWin = window.top || window;
  let topDoc;
  try {
    topDoc = topWin.document;
  } catch {
    topDoc = document;
  }

  // Inject tooltip styles
  injectTooltipStyles(topDoc);

  // Remove existing tooltip
  const existingTooltip = topDoc.getElementById('myio-version-tooltip');
  if (existingTooltip) existingTooltip.remove();

  const shortcuts = getRefreshShortcuts();
  const tooltipTheme = theme === 'light' ? 'light' : 'dark';

  // Build tooltip content
  const tooltipHTML = isUpToDate
    ? `
      <div class="myio-ver-tooltip">
        <div class="myio-ver-tooltip__header myio-ver-tooltip__header--success">
          <span class="myio-ver-tooltip__icon">✓</span>
          <span>Biblioteca Atualizada</span>
        </div>
        <div class="myio-ver-tooltip__body">
          <div class="myio-ver-tooltip__row">
            <span class="myio-ver-tooltip__label">Versão instalada na sua máquina:</span>
            <span class="myio-ver-tooltip__value">v${currentVer}</span>
          </div>
          <div class="myio-ver-tooltip__row">
            <span class="myio-ver-tooltip__label">Última versão disponível:</span>
            <span class="myio-ver-tooltip__value">v${latestVer}</span>
          </div>
          <div class="myio-ver-tooltip__status myio-ver-tooltip__status--success">
            Voce esta usando a versao mais recente da biblioteca MyIO!
          </div>
        </div>
      </div>
    `
    : `
      <div class="myio-ver-tooltip">
        <div class="myio-ver-tooltip__header myio-ver-tooltip__header--warning">
          <span class="myio-ver-tooltip__icon">⚠️</span>
          <span>Atualizacao Disponivel</span>
        </div>
        <div class="myio-ver-tooltip__body">
          <div class="myio-ver-tooltip__row">
            <span class="myio-ver-tooltip__label">Versão instalada na sua máquina:</span>
            <span class="myio-ver-tooltip__value myio-ver-tooltip__value--outdated">v${currentVer}</span>
          </div>
          <div class="myio-ver-tooltip__row">
            <span class="myio-ver-tooltip__label">Última versão disponível:</span>
            <span class="myio-ver-tooltip__value myio-ver-tooltip__value--new">v${latestVer}</span>
          </div>
          <div class="myio-ver-tooltip__status myio-ver-tooltip__status--warning">
            ⚠️ Uma nova versão da biblioteca está disponível!
          </div>
          <div class="myio-ver-tooltip__help">
            <div class="myio-ver-tooltip__help-title">Como atualizar:</div>

            <div class="myio-ver-tooltip__os-section">
              <div class="myio-ver-tooltip__os-label">🪟 Windows:</div>
              <div class="myio-ver-tooltip__help-item">
                <span class="myio-ver-tooltip__kbd">${shortcuts.windows.primary}</span>
                <span>ou</span>
                <span class="myio-ver-tooltip__kbd">${shortcuts.windows.alt}</span>
              </div>
            </div>

            <div class="myio-ver-tooltip__os-section">
              <div class="myio-ver-tooltip__os-label">🍎 Mac:</div>
              <div class="myio-ver-tooltip__help-item">
                <span class="myio-ver-tooltip__kbd">${shortcuts.mac.primary}</span>
                <span>ou</span>
                <span class="myio-ver-tooltip__kbd">${shortcuts.mac.alt}</span>
              </div>
            </div>

            <div class="myio-ver-tooltip__help-note">
              💡 Se o problema persistir, limpe o cache do navegador ou aguarde alguns minutos para a CDN atualizar.
            </div>
          </div>
        </div>
      </div>
    `;

  // Create tooltip container
  const container = topDoc.createElement('div');
  container.id = 'myio-version-tooltip';
  container.className = `myio-ver-tooltip-container myio-ver-tooltip-container--${tooltipTheme}`;
  container.innerHTML = tooltipHTML;

  // Position near anchor
  topDoc.body.appendChild(container);

  const anchorRect = anchor.getBoundingClientRect();
  const tooltipRect = container.getBoundingClientRect();

  // Position above the anchor, centered
  let left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
  let top = anchorRect.top - tooltipRect.height - 10;

  // Ensure tooltip stays within viewport
  if (left < 10) left = 10;
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  if (top < 10) {
    // Show below instead
    top = anchorRect.bottom + 10;
  }

  container.style.left = `${left}px`;
  container.style.top = `${top}px`;

  // Close on click outside
  const closeHandler = (e) => {
    if (!container.contains(e.target) && e.target !== anchor) {
      container.remove();
      topDoc.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => topDoc.addEventListener('click', closeHandler), 100);

  // Close on Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      container.remove();
      topDoc.removeEventListener('keydown', escHandler);
    }
  };
  topDoc.addEventListener('keydown', escHandler);
}

/**
 * Creates a LibraryVersionChecker component and appends it to the container
 *
 * @param {HTMLElement} container - Container element to append the component to
 * @param {LibraryVersionCheckerOptions} options - Configuration options
 * @returns {{ destroy: () => void, refresh: () => Promise<void>, getStatus: () => { status: VersionStatus, currentVersion: string, latestVersion: string | null }, setTheme: (theme: Theme) => void, getTheme: () => Theme }} Component instance
 */
export function createLibraryVersionChecker(container, options) {
  const {
    packageName,
    currentVersion,
    cacheTtlMs = CACHE_TTL_MS,
    toastIntervalMs = DEFAULT_TOAST_INTERVAL_MS,
    theme = 'dark',
    onStatusChange,
  } = options;

  // Inject styles
  injectStyles(document);

  // Mutable theme state for dynamic updates
  let currentTheme = theme;

  // Create DOM structure
  const wrapper = document.createElement('div');
  wrapper.className = `myio-lib-version myio-lib-version--${currentTheme}`;

  const versionText = document.createElement('span');
  versionText.className = 'myio-lib-version__text';
  versionText.textContent = `v${currentVersion}`;

  const statusIcon = document.createElement('span');
  statusIcon.className = 'myio-lib-version__status myio-lib-version__status--checking';
  statusIcon.textContent = '⟳';
  statusIcon.title = 'Verificando versão...';

  const refreshBtn = document.createElement('span');
  refreshBtn.className = 'myio-lib-version__refresh';
  refreshBtn.textContent = '↻';
  refreshBtn.title = 'Verificar atualizações';

  wrapper.appendChild(versionText);
  wrapper.appendChild(statusIcon);
  wrapper.appendChild(refreshBtn);
  container.appendChild(wrapper);

  // State
  let latestVersion = null;
  let status = 'checking';
  let clickHandler = null;
  let toastIntervalId = null;
  let isRefreshing = false;

  /**
   * Show toast warning about outdated library
   * @param {string} latest - Latest version available
   */
  function showOutdatedToast(latest) {
    // Try to get MyIOToast from global MyIOLibrary or window
    const MyIOToast = window.MyIOLibrary?.MyIOToast || window.MyIOToast;

    if (MyIOToast && typeof MyIOToast.warning === 'function') {
      MyIOToast.warning(
        `Biblioteca MyIO desatualizada! Versão atual: v${currentVersion} → Disponível: v${latest}. Clique no ícone ⚠ no MENU para instruções.`,
        8000
      );
      console.log(
        `[LibraryVersionChecker] Toast warning shown (current: ${currentVersion}, latest: ${latest})`
      );
    } else {
      console.warn('[LibraryVersionChecker] MyIOToast not available for warning notification');
    }
  }

  /**
   * Start toast warning interval
   * @param {string} latest - Latest version available
   */
  function startToastWarningInterval(latest) {
    // Clear any existing interval
    stopToastWarningInterval();

    // Show toast immediately
    showOutdatedToast(latest);

    // Set interval to show toast
    toastIntervalId = setInterval(() => {
      showOutdatedToast(latest);
    }, toastIntervalMs);

    console.log(`[LibraryVersionChecker] Toast warning interval started (every ${toastIntervalMs / 1000}s)`);
  }

  /**
   * Stop toast warning interval
   */
  function stopToastWarningInterval() {
    if (toastIntervalId) {
      clearInterval(toastIntervalId);
      toastIntervalId = null;
      console.log('[LibraryVersionChecker] Toast warning interval stopped');
    }
  }

  /**
   * Update status UI
   * @param {VersionStatus} newStatus
   * @param {string | null} latest
   */
  function updateStatus(newStatus, latest) {
    status = newStatus;
    latestVersion = latest;

    // Remove previous click handler
    if (clickHandler) {
      statusIcon.removeEventListener('click', clickHandler);
      clickHandler = null;
    }

    // Stop toast interval if status changes from outdated
    if (newStatus !== 'outdated') {
      stopToastWarningInterval();
    }

    switch (newStatus) {
      case 'checking':
        statusIcon.textContent = '⟳';
        statusIcon.className = 'myio-lib-version__status myio-lib-version__status--checking';
        statusIcon.title = 'Verificando versão...';
        break;

      case 'up-to-date':
        statusIcon.textContent = '✓';
        statusIcon.className = 'myio-lib-version__status myio-lib-version__status--up-to-date';
        statusIcon.title = 'Biblioteca atualizada!';
        clickHandler = (e) => {
          e.stopPropagation();
          showVersionTooltip(statusIcon, currentVersion, latestVersion, true, currentTheme);
        };
        statusIcon.addEventListener('click', clickHandler);
        break;

      case 'outdated':
        statusIcon.textContent = '⚠';
        statusIcon.className = 'myio-lib-version__status myio-lib-version__status--outdated';
        statusIcon.title = `Atualização disponível: v${latest}`;
        clickHandler = (e) => {
          e.stopPropagation();
          showVersionTooltip(statusIcon, currentVersion, latestVersion, false, currentTheme);
        };
        statusIcon.addEventListener('click', clickHandler);

        // Start toast warning interval for outdated status
        startToastWarningInterval(latest);
        break;

      case 'error':
        statusIcon.textContent = '?';
        statusIcon.className = 'myio-lib-version__status myio-lib-version__status--error';
        statusIcon.title = 'Não foi possível verificar atualizações';
        break;
    }

    // Callback
    if (onStatusChange) {
      onStatusChange(newStatus, currentVersion, latest);
    }
  }

  /**
   * Check npm registry for latest version
   */
  async function checkNpmVersion() {
    const cacheKey = `${CACHE_KEY_PREFIX}${packageName}`;
    const npmUrl = `${NPM_REGISTRY_BASE}/${packageName}/latest`;

    updateStatus('checking', null);

    try {
      // Check cache first
      let latest = null;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { version, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTtlMs) {
            latest = version;
            console.log(`[LibraryVersionChecker] Using cached npm version: ${latest}`);
          }
        }
      } catch {
        // Ignore cache errors
      }

      // Fetch from npm if not cached
      if (!latest) {
        const response = await fetch(npmUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`npm registry returned ${response.status}`);
        }

        const data = await response.json();
        latest = data.version;

        // Cache the result
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              version: latest,
              timestamp: Date.now(),
            })
          );
        } catch {
          // Ignore cache write errors
        }

        console.log(`[LibraryVersionChecker] Latest npm version: ${latest}`);
      }

      // Compare versions
      const isUpToDate = compareVersions(currentVersion, latest) >= 0;

      if (isUpToDate) {
        updateStatus('up-to-date', latest);
        console.log(`[LibraryVersionChecker] Library is up to date (${currentVersion} >= ${latest})`);
      } else {
        updateStatus('outdated', latest);
        console.warn(
          `[LibraryVersionChecker] Library outdated! Current: ${currentVersion}, Latest: ${latest}`
        );
      }
    } catch (err) {
      console.warn(`[LibraryVersionChecker] Failed to check npm version:`, err.message);
      updateStatus('error', null);
    }
  }

  /**
   * Get MyIOToast instance
   */
  function getToast() {
    return window.MyIOLibrary?.MyIOToast || window.MyIOToast;
  }

  /**
   * Force refresh - clear cache and check npm
   */
  async function forceRefresh() {
    if (isRefreshing) return;
    isRefreshing = true;

    const MyIOToast = getToast();

    // Toast info - starting check (longer duration so user can read it)
    if (MyIOToast?.info) {
      MyIOToast.info('Verificando última versão da biblioteca no npm...', 5000);
    }

    // Visual feedback - spinning button
    refreshBtn.classList.add('myio-lib-version__refresh--spinning');
    refreshBtn.title = 'Verificando...';

    // Clear cache
    const cacheKey = `${CACHE_KEY_PREFIX}${packageName}`;
    try {
      localStorage.removeItem(cacheKey);
      console.log('[LibraryVersionChecker] Cache cleared for forced refresh');
    } catch {
      // Ignore
    }

    // Small delay so user sees the "checking" state
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await checkNpmVersion();

    // Reset button state
    refreshBtn.classList.remove('myio-lib-version__refresh--spinning');
    refreshBtn.title = 'Verificar atualizações';
    isRefreshing = false;

    // Small delay before showing result toast
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Toast success/warning based on result
    if (MyIOToast) {
      if (status === 'up-to-date') {
        MyIOToast.success(
          `Biblioteca atualizada! Você está usando a versão mais recente (v${currentVersion}).`,
          5000
        );
      } else if (status === 'outdated') {
        MyIOToast.warning(`Atualização disponível! v${currentVersion} → v${latestVersion}`, 6000);
      } else if (status === 'error') {
        MyIOToast.error('Não foi possível verificar atualizações. Tente novamente.', 5000);
      }
    }
  }

  // Bind refresh button click
  refreshBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    forceRefresh();
  });

  // Start checking immediately
  checkNpmVersion();

  // Return instance with methods
  return {
    /**
     * Destroy the component and clean up
     */
    destroy() {
      stopToastWarningInterval();
      if (clickHandler) {
        statusIcon.removeEventListener('click', clickHandler);
      }
      wrapper.remove();
    },

    /**
     * Manually refresh version check (clears cache)
     */
    async refresh() {
      await forceRefresh();
    },

    /**
     * Get current status
     * @returns {{ status: VersionStatus, currentVersion: string, latestVersion: string | null }}
     */
    getStatus() {
      return { status, currentVersion, latestVersion };
    },

    /**
     * Update the theme dynamically
     * @param {Theme} newTheme - The new theme ('dark' or 'light')
     */
    setTheme(newTheme) {
      if (newTheme !== 'dark' && newTheme !== 'light') {
        console.warn(`[LibraryVersionChecker] Invalid theme: ${newTheme}. Using 'dark'.`);
        newTheme = 'dark';
      }

      if (newTheme === currentTheme) return;

      currentTheme = newTheme;
      wrapper.className = `myio-lib-version myio-lib-version--${currentTheme}`;

      // Update existing tooltip if visible
      const topWin = window.top || window;
      let topDoc;
      try {
        topDoc = topWin.document;
      } catch {
        topDoc = document;
      }

      const existingTooltip = topDoc.getElementById('myio-version-tooltip');
      if (existingTooltip) {
        existingTooltip.className = `myio-ver-tooltip-container myio-ver-tooltip-container--${currentTheme}`;
      }

      console.log(`[LibraryVersionChecker] Theme updated to: ${currentTheme}`);
    },

    /**
     * Get current theme
     * @returns {Theme}
     */
    getTheme() {
      return currentTheme;
    },
  };
}

export default createLibraryVersionChecker;
