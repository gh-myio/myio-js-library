/* jshint esversion: 11 */

/**
 * Tabela_RPC_Gases_V1 Controller v2.0.0
 *
 * Baseado nos padrões do CO2-V3 / Temp V5:
 * - Modal de carregamento premium (overlay com spinner + timer + progresso)
 * - Visão em Cards (agrupado por dispositivo, expansível, recolhido por padrão)
 * - Visão em Lista (tabela pivô: linhas = datas, colunas = gases)
 * - Alternância Lista / Cards com badges de totais
 * - Cache 30 min + guard anti-concorrência
 * - Toast notifications para erros
 * - centralId via self.ctx.settings (configuração do widget no TB)
 */

/*
 GAMBIARRA!!!!!!!!!!!
 PRECISAMOS MUDAR NO DEVICE O CENTRAL ID, MAS ATÉ LÁ, ISSO AQUI
 É A CENTRAL SOUZA MATERNIDADE OF
*/
function normalizeCentralId(centralId) {
  if (centralId === '3fd3b316-e74c-4cc8-a9a0-22ea707fea3a') {
    return 'cea3473b-6e46-4a2f-85b8-f228d2a8347a';
  }
  return centralId;
}

// -------- Consts / Estado --------
const gasCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 min

const VIEW_MODES = { LIST: 'list', CARD: 'card' };
const LOADING_STATES = {
  AWAITING_DATA: 'Aguardando dados do Gateway...',
  CONSOLIDATING: 'Dados recebidos, consolidando...',
  READY: 'Relatório pronto!',
};

let currentViewMode = VIEW_MODES.CARD;
let startDate = null, endDate = null;
let deviceList = [];

// Timer do overlay
let _timerHandle = null, _loadingStart = null;

// Guard + debounce
let _inFlight = false;
let _dateChangeTimer = null;
const DATE_DEBOUNCE_MS = 200;

// -------- Premium Loading Overlay --------
function setPremiumLoading(on, status, progress) {
  const s = self.ctx.$scope;
  s.premiumLoading = !!on;
  if (on) {
    s.premiumLoadingStatus = status || LOADING_STATES.AWAITING_DATA;
    s.premiumLoadingProgress = progress ?? 15;
    if (!_loadingStart) _loadingStart = Date.now();
    if (!_timerHandle) {
      _timerHandle = setInterval(() => {
        const elapsed = Math.floor((Date.now() - _loadingStart) / 1000);
        const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const ss = String(elapsed % 60).padStart(2, '0');
        s.premiumLoadingTimer = `${mm}:${ss}`;
        self.ctx.detectChanges();
      }, 1000);
    }
  } else {
    if (_timerHandle) { clearInterval(_timerHandle); _timerHandle = null; }
    _loadingStart = null;
  }
  self.ctx.detectChanges();
}

// -------- Services --------
function getHttp() {
  return self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));
}

// -------- Cache --------
function cacheKey(centralId, s, e) {
  return `${centralId}|${s}|${e}`;
}
function getCache(centralId, s, e) {
  const k = cacheKey(centralId, s, e), c = gasCache.get(k);
  if (c && Date.now() - c.ts < CACHE_DURATION) return c.data;
  return null;
}
function setCache(centralId, s, e, data) {
  gasCache.set(cacheKey(centralId, s, e), { ts: Date.now(), data });
}

// -------- Toast Notification --------
function showToast(type, title, message, duration) {
  duration = duration || 6000;
  const icons = {
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    success: 'fa-circle-check',
  };
  const id = 'myio-toast-' + Date.now();
  const el = document.createElement('div');
  el.id = id;
  el.className = `myio-toast myio-toast-${type}`;
  el.innerHTML =
    `<div class="myio-toast-icon"><i class="fa-solid ${icons[type] || icons.error}"></i></div>` +
    `<div class="myio-toast-content">` +
    `<div class="myio-toast-title">${title}</div>` +
    `<div class="myio-toast-message">${message}</div>` +
    `</div>` +
    `<button class="myio-toast-close" onclick="document.getElementById('${id}').remove()">✕</button>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('myio-toast-show'), 10);
  setTimeout(() => {
    el.classList.remove('myio-toast-show');
    setTimeout(() => el.remove(), 350);
  }, duration);
}

// -------- Export CSV --------
function exportToCSV(reportData, devices) {
  if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
    alert('Erro: Nenhum dado disponível para exportar.');
    return;
  }
  const rows = [['Data', ...devices]];
  reportData.forEach((data) => {
    rows.push([data.date, ...devices.map((device) => data[device] ?? '-')]);
  });
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(csvContent));
  link.setAttribute('download', 'registro-afericao-de-gases.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// -------- Export PDF --------
function exportToPDF(reportData, devices) {
  if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
    alert('Erro: Nenhum dado disponível para exportar.');
    return;
  }
  const doc = new window.jspdf.jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const purple = [92, 48, 125];

  doc.setFillColor(purple[0], purple[1], purple[2]);
  doc.rect(0, 0, pageWidth, 50, 'F');

  const logoHeight = 25;
  const logoWidth = Math.round(logoHeight * (512 / 194));
  const logoX = 15, logoY = 12;
  doc.addImage(
    'https://dashboard.myio-bas.com/api/images/public/TAfpmF6jEKPDi6hXHbnMUT8MWOHv5lKD',
    'PNG', logoX, logoY, logoWidth, logoHeight
  );

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  const textStartX = logoX + logoWidth + 20;
  const availableWidth = pageWidth - textStartX - 15;
  const textCenterX = textStartX + availableWidth / 2;

  doc.text('Sistema Myio | Registro de aferição dos gases medicinais', textCenterX, 15, { align: 'center' });
  doc.text('Complexo Hospitalar Municipal Souza Aguiar', textCenterX, 25, { align: 'center' });
  doc.text(`Data de Expedição: ${new Date().toLocaleDateString('pt-BR')}`, textCenterX, 35, { align: 'center' });

  const fromDate = new Date(startDate).toLocaleDateString('pt-BR');
  const toDate = new Date(endDate).toLocaleDateString('pt-BR');
  doc.text(`Período de ${fromDate} até ${toDate}`, textCenterX, 45, { align: 'center' });

  let startY = 60;
  const lineHeight = 10, margin = 10;
  const colWidth = (pageWidth - 2 * margin) / (devices.length + 1);

  doc.setFillColor(purple[0], purple[1], purple[2]);
  doc.rect(margin, startY, pageWidth - 2 * margin, lineHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);

  ['Data', ...devices].forEach((header, i) => {
    doc.text(header, margin + i * colWidth + colWidth / 2, startY + 7, { align: 'center' });
  });

  startY += lineHeight;
  doc.setTextColor(0, 0, 0);

  reportData.forEach((data, index) => {
    if (startY > doc.internal.pageSize.height - 20) { doc.addPage(); startY = 20; }
    if (index % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, startY, pageWidth - 2 * margin, lineHeight, 'F');
    }
    [data.date, ...devices.map((d) => data[d] ?? '-')].forEach((text, i) => {
      doc.text(String(text), margin + i * colWidth + colWidth / 2, startY + 7, { align: 'center' });
    });
    startY += lineHeight;
  });

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Página 1 de 1', pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  doc.save('registro_gases_medicinais.pdf');
}

// -------- RPC --------
async function sendRPCGas(centralId, body) {
  const $http = getHttp();
  const normalized = normalizeCentralId(centralId);
  console.log('[GASES-V2] RPC →', normalized, '| devices:', body.devices.length);
  const response = await $http
    .post(`https://${normalized}.y.myio.com.br/api/rpc/gas_report`, body)
    .toPromise();
  // Normaliza: AngularJS $http retorna {data:[...]} enquanto HttpClient retorna [] diretamente
  return Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
}

// -------- Helpers --------
function toFixed(value) {
  if (value == null) return value;
  return Number(value).toFixed(2);
}

function insertCurrentDate() {
  const el = document.getElementById('issue-date');
  if (el) el.innerText = new Date().toLocaleDateString('pt-BR');
}

function convertToBrazilTime(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:00`;
}

// -------- Pivot (visão lista) --------
function transformData(processedData) {
  const grouped = {};
  processedData.forEach(({ reading_date, deviceName, gas }) => {
    if (!grouped[reading_date]) grouped[reading_date] = {};
    grouped[reading_date][deviceName] = gas;
  });
  const devices = [...new Set(processedData.map((d) => d.deviceName))];
  const transformedData = Object.keys(grouped).map((date) => {
    const row = { date };
    devices.forEach((dev) => { row[dev] = grouped[date][dev] ?? '-'; });
    return row;
  });
  return { transformedData, devices };
}

// -------- Card view --------
function buildGroupedData(flatData) {
  const grouped = {};
  for (const row of flatData) {
    if (!grouped[row.deviceName]) grouped[row.deviceName] = [];
    grouped[row.deviceName].push(row);
  }
  return grouped;
}

function rebuildView(flatData) {
  const s = self.ctx.$scope;

  // Totais para os badges
  s.totalReadings = flatData.length;
  s.totalDevices = new Set(flatData.map((r) => r.deviceName)).size;

  if (currentViewMode === VIEW_MODES.CARD) {
    s.groupedData = buildGroupedData(flatData);
    s.isCardView = true;
    // Recolhido por padrão
    const keys = Object.keys(s.groupedData);
    if (!s.expandedDevices) s.expandedDevices = {};
    keys.forEach((k) => { if (!(k in s.expandedDevices)) s.expandedDevices[k] = false; });
  } else {
    const { transformedData, devices } = transformData(flatData);
    s.transformedData = transformedData;
    s.devices = devices;
    s.displayedColumns = ['date', ...devices];
    s.isCardView = false;
  }

  self.ctx.detectChanges();
}

// -------- Card helpers --------
function getLatestGas(readings) {
  if (!readings || readings.length === 0) return '—';
  const last = readings[readings.length - 1];
  return last.gas != null ? `${last.gas}` : '—';
}

function getDeviceReadingCount(readings) {
  return readings ? readings.length : 0;
}

function toggleDeviceExpansion(deviceName) {
  self.ctx.$scope.expandedDevices[deviceName] = !self.ctx.$scope.expandedDevices[deviceName];
  self.ctx.detectChanges();
}

function expandAllDevices() {
  Object.keys(self.ctx.$scope.groupedData || {}).forEach((k) => (self.ctx.$scope.expandedDevices[k] = true));
  self.ctx.detectChanges();
}

function collapseAllDevices() {
  Object.keys(self.ctx.$scope.groupedData || {}).forEach((k) => (self.ctx.$scope.expandedDevices[k] = false));
  self.ctx.detectChanges();
}

function toggleViewMode(mode) {
  currentViewMode = mode === 'card' ? VIEW_MODES.CARD : VIEW_MODES.LIST;
  const s = self.ctx.$scope;
  // Rebuilda a visão com os dados já carregados (sem nova request)
  if (s._flatData && s._flatData.length > 0) {
    // Reseta expandedDevices ao trocar para cards
    if (currentViewMode === VIEW_MODES.CARD) s.expandedDevices = {};
    rebuildView(s._flatData);
  }
  s.isCardView = currentViewMode === VIEW_MODES.CARD;
  self.ctx.detectChanges();
}

// -------- getData --------
async function getData() {
  if (_inFlight) {
    console.log('[GASES-V2] getData já em execução, ignorando chamada simultânea.');
    return;
  }
  if (!startDate || !endDate) {
    alert('Por favor, selecione datas de início e fim.');
    return;
  }

  const { centralId } = self.ctx.settings;
  if (!centralId) {
    showToast('error', 'Configuração ausente', 'Central ID não configurado no widget.');
    return;
  }

  // Cache check
  const cached = getCache(centralId, startDate.toISOString(), endDate.toISOString());
  if (cached) {
    console.log('[GASES-V2] Cache hit.');
    self.ctx.$scope._flatData = cached;
    rebuildView(cached);
    return;
  }

  _inFlight = true;
  setPremiumLoading(true, LOADING_STATES.AWAITING_DATA, 10);

  const newEndDate = new Date(endDate.getTime());
  newEndDate.setHours(23, 59, 59, 999);

  const body = {
    devices: deviceList,
    dateStart: startDate.toISOString(),
    dateEnd: newEndDate.toISOString(),
  };

  try {
    setPremiumLoading(true, LOADING_STATES.AWAITING_DATA, 25);
    const gasData = await sendRPCGas(centralId, body);

    setPremiumLoading(true, LOADING_STATES.CONSOLIDATING, 70);

    const processedData = gasData.map((data) => ({
      reading_date: convertToBrazilTime(data.timestamp),
      gas: toFixed(data?.value / 100),
      deviceName: data.deviceName,
    }));

    // Sort: hora → device
    processedData.sort((a, b) => {
      if (a.reading_date !== b.reading_date) return a.reading_date < b.reading_date ? -1 : 1;
      return a.deviceName < b.deviceName ? -1 : 1;
    });

    console.log('[GASES-V2] Dados processados:', processedData.length, 'leituras');

    setCache(centralId, startDate.toISOString(), endDate.toISOString(), processedData);
    self.ctx.$scope._flatData = processedData;

    setPremiumLoading(true, LOADING_STATES.READY, 100);
    setTimeout(() => {
      try {
        setPremiumLoading(false);
        rebuildView(processedData);
      } catch (err) {
        console.error('[GASES-V2] Erro em rebuildView:', err);
        self.ctx.detectChanges();
      }
    }, 300);

  } catch (error) {
    console.error('[GASES-V2] Erro ao carregar dados:', error);
    showToast('error', 'Erro ao carregar dados', 'Verifique a conexão com o gateway e tente novamente.');
    setPremiumLoading(false);
    self.ctx.detectChanges();
  } finally {
    _inFlight = false;
  }
}

// -------- Date pickers --------
function handleStartDateChange(event) {
  startDate = event.value;
}

function handleEndDateChange(event) {
  endDate = event.value;
}

function applyDateRange() {
  if (_dateChangeTimer) clearTimeout(_dateChangeTimer);
  _dateChangeTimer = setTimeout(() => {
    if (startDate && endDate) getData();
  }, DATE_DEBOUNCE_MS);
}

// -------- onInit --------
self.onInit = function () {
  deviceList = self.ctx.datasources.map((ds) => ds.entityName);
  insertCurrentDate();

  const s = self.ctx.$scope;
  s._flatData = [];
  s.transformedData = [];
  s.devices = [];
  s.displayedColumns = ['date'];
  s.groupedData = {};
  s.expandedDevices = {};
  s.isCardView = currentViewMode === VIEW_MODES.CARD;
  s.premiumLoading = false;
  s.premiumLoadingStatus = '';
  s.premiumLoadingTimer = '00:00';
  s.premiumLoadingProgress = 0;
  s.totalReadings = 0;
  s.totalDevices = 0;

  s.handleStartDateChange = handleStartDateChange;
  s.handleEndDateChange = handleEndDateChange;
  s.applyDateRange = applyDateRange;
  s.downloadPDF = () => {
    if (s.transformedData && s.transformedData.length > 0) {
      exportToPDF(s.transformedData, s.devices);
    } else {
      alert('Sem dados disponíveis para exportar.');
    }
  };
  s.downloadCSV = () => {
    if (s.transformedData && s.transformedData.length > 0) {
      exportToCSV(s.transformedData, s.devices);
    } else {
      alert('Sem dados disponíveis para exportar.');
    }
  };
  s.toggleViewMode = toggleViewMode;
  s.toggleDeviceExpansion = toggleDeviceExpansion;
  s.expandAllDevices = expandAllDevices;
  s.collapseAllDevices = collapseAllDevices;
  s.getLatestGas = getLatestGas;
  s.getDeviceReadingCount = getDeviceReadingCount;

  self.ctx.detectChanges();
};

self.onDataUpdated = function () {
  self.ctx.detectChanges();
};

self.onDestroy = function () {
  if (_timerHandle) { clearInterval(_timerHandle); _timerHandle = null; }
  if (_dateChangeTimer) { clearTimeout(_dateChangeTimer); _dateChangeTimer = null; }
};
