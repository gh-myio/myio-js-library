/* jshint esversion: 11 */

/**
 * Tabela_CO2_V3 Controller v1.0.0
 *
 * Baseado em Tabela_Temp_V5 v3.1.1 - HYBRID
 * - Modal de carregamento premium (overlay com spinner + timer + progresso)
 * - Visão em Cards (agrupado por dispositivo, expansível)
 * - Alternância Lista / Cards
 * - Modo Admin com senha (device filter, contagens)
 * - Cache 30 min
 * - Toast notifications para erros de conexão
 *
 * INTERPOLAÇÃO: DESATIVADA nesta versão (v3 - dados brutos apenas)
 */

// -------- Admin --------
let adminMode = false;
let adminVerified = false;
let showSettings = false;
let adminPasswordInput = '';

// -------- Cache --------
const gasCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 min

// -------- TEMPORARY FIX: CentralId Normalization --------
function normalizeCentralId(centralId) {
  if (centralId === '3fd3b316-e74c-4cc8-a9a0-22ea707fea3a') {
    return 'cea3473b-6e46-4a2f-85b8-f228d2a8347a';
  }
  return centralId;
}

const VIEW_MODES = { LIST: 'list', CARD: 'card' };
const LOADING_STATES = {
  AWAITING_DATA: 'Aguardando dados do Gateway...',
  CONSOLIDATING: 'Dados recebidos, consolidando...',
  READY: 'Relatório pronto!',
};

let currentViewMode = VIEW_MODES.CARD;
let startDate = null,
  endDate = null;
let deviceList = [],
  deviceNameLabelMap = {};

// Device -> centralId (para filtrar por central no RPC)
let deviceToCentralMap = {};

// Device filter state (admin only)
let showDeviceFilter = false;
let deviceFilterText = '';
let devicesSelectionList = [];

// Timer do overlay
let _timerHandle = null,
  _loadingStart = null;

// Guard de chamada concorrente
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
    if (_timerHandle) {
      clearInterval(_timerHandle);
      _timerHandle = null;
    }
    _loadingStart = null;
  }
  self.ctx.detectChanges();
}

// -------- Services --------
function getHttp() {
  return self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));
}

// -------- Cache helpers --------
function cacheKey(centrals, s, e) {
  return `${[...centrals].sort().join(',')}|${s}|${e}`;
}
function getCache(centrals, s, e) {
  const k = cacheKey(centrals, s, e),
    c = gasCache.get(k);
  if (c && Date.now() - c.ts < CACHE_DURATION) return c.data;
  return null;
}
function setCache(centrals, s, e, data) {
  gasCache.set(cacheKey(centrals, s, e), { ts: Date.now(), data });
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

// -------- View helpers --------
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
  s.dados = flatData;
  s.groupedData = buildGroupedData(flatData);
  s.isCardView = currentViewMode === VIEW_MODES.CARD;
  // Recolhido por padrão — usuário expande manualmente
  const keys = Object.keys(s.groupedData);
  if (!s.expandedDevices) s.expandedDevices = {};
  keys.forEach((k) => {
    if (!(k in s.expandedDevices)) s.expandedDevices[k] = false;
  });
  self.ctx.detectChanges();
}

// -------- Export CSV --------
function exportToCSV(reportData) {
  if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
    alert('Erro: Nenhum dado disponível para exportar.');
    return;
  }
  const rows = [['Nome do Dispositivo', 'CO2 (ppm)', 'Data']];
  reportData.forEach((data) => {
    rows.push([data.deviceName, data.co2, data.reading_date]);
  });
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(';')).join('\n');
  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(csvContent));
  link.setAttribute('download', 'dispositivo_co2_horario.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// -------- Export PDF --------
function exportToPDF(reportData) {
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
  const logoX = 15;
  const logoY = 12;
  doc.addImage(
    'https://dashboard.myio-bas.com/api/images/public/TAfpmF6jEKPDi6hXHbnMUT8MWOHv5lKD',
    'PNG',
    logoX,
    logoY,
    logoWidth,
    logoHeight
  );

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  const textStartX = logoX + logoWidth + 20;
  const availableWidth = pageWidth - textStartX - 15;
  const textCenterX = textStartX + availableWidth / 2;

  doc.text('Sistema Myio v.3 | Registro de Aferição de CO2', textCenterX, 15, { align: 'center' });
  doc.text('Complexo Hospitalar Municipal Souza Aguiar', textCenterX, 25, { align: 'center' });
  doc.text(`Data de Expedição: ${new Date().toLocaleDateString('pt-BR')} | UNIDADE HMSA`, textCenterX, 35, {
    align: 'center',
  });

  const fromDate = new Date(startDate).toLocaleDateString('pt-BR');
  const toDate = new Date(endDate).toLocaleDateString('pt-BR');
  doc.text(`Período de ${fromDate} até ${toDate}`, textCenterX, 45, { align: 'center' });

  let startY = 60;
  const lineHeight = 10;
  const margin = 10;
  const colWidth = (pageWidth - 2 * margin) / 3;

  doc.setFillColor(purple[0], purple[1], purple[2]);
  doc.rect(margin, startY, pageWidth - 2 * margin, lineHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);

  ['Dispositivo', 'CO2 (ppm)', 'Data'].forEach((header, i) => {
    doc.text(header, margin + i * colWidth + colWidth / 2, startY + 7, { align: 'center' });
  });

  startY += lineHeight;
  doc.setTextColor(0, 0, 0);

  reportData.forEach((data, index) => {
    if (startY > doc.internal.pageSize.height - 20) {
      doc.addPage();
      startY = 20;
    }
    if (index % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, startY, pageWidth - 2 * margin, lineHeight, 'F');
    }
    [data.deviceName, data.co2, data.reading_date].forEach((text, i) => {
      doc.text(String(text ?? ''), margin + i * colWidth + colWidth / 2, startY + 7, { align: 'center' });
    });
    startY += lineHeight;
  });

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Página 1 de 1`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  doc.save('registro_co2.pdf');
}

// -------- RPC --------
// body base sem devices — cada central recebe só seus próprios devices
async function sendRPCGas(centralIds, baseBody) {
  const $http = getHttp();
  const results = {};

  for (const centralId of centralIds) {
    const normalized = normalizeCentralId(centralId);

    // Filtra devices que pertencem a esta central
    const devicesForCentral = Object.entries(deviceToCentralMap)
      .filter(([, cId]) => normalizeCentralId(cId) === normalized)
      .map(([name]) => name);

    // Se não há devices mapeados para esta central, usa lista completa selecionada
    const devicesToSend = devicesForCentral.length > 0 ? devicesForCentral : baseBody.devices;

    const body = { ...baseBody, devices: devicesToSend };

    console.log('[CO2-V3] RPC →', normalized, '| devices:', devicesToSend.length);

    try {
      const response = await $http
        .post(`https://${normalized}.y.myio.com.br/api/rpc/gas_report`, body)
        .toPromise();
      // Normaliza: AngularJS $http retorna {data:[...]} enquanto HttpClient retorna [] diretamente
      const data = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
      results[centralId] = data;
    } catch (error) {
      console.error(`[CO2-V3] Erro RPC para ${normalized}:`, error);
      showToast('error', 'Erro de conexão', `Falha ao buscar dados da central <strong>${normalized}</strong>.`);
      results[centralId] = [];
    }
  }
  return results;
}

// -------- Date / Time helpers --------
function toFixed(value) {
  if (value == null) return value;
  return Number(value).toFixed(2);
}

function convertToBrazilTime(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function parseDate(dateString) {
  const [datePart, timePart] = dateString.split(' ');
  const [day, month, year] = datePart.split('/');
  const [hours, minutes] = timePart.split(':');
  return new Date(year, month - 1, day, hours, minutes);
}

function insertCurrentDate() {
  const el = document.getElementById('issue-date');
  if (el) el.innerText = new Date().toLocaleDateString('pt-BR');
}

// -------- getData (main pipeline) --------
async function getData() {
  if (_inFlight) {
    console.log('[CO2-V3] getData já em execução, ignorando chamada simultânea.');
    return;
  }
  if (!startDate || !endDate) {
    alert('Por favor, selecione datas de início e fim.');
    return;
  }

  const centralIds = self.ctx.$scope.centralIdList;

  // Cache check
  const cached = getCache(centralIds, startDate.toISOString(), endDate.toISOString());
  if (cached) {
    console.log('[CO2-V3] Cache hit.');
    rebuildView(cached);
    return;
  }

  _inFlight = true;
  setPremiumLoading(true, LOADING_STATES.AWAITING_DATA, 10);

  const newEndDate = new Date(endDate.getTime());
  newEndDate.setHours(23, 59, 59, 999);

  // Lista base de devices (filtrada se admin selecionou subset)
  const selectedDevices =
    devicesSelectionList.length > 0
      ? devicesSelectionList.filter((d) => d.selected).map((d) => d.name)
      : deviceList;

  // body base — devices será refinado por central dentro de sendRPCGas via deviceToCentralMap
  const body = {
    devices: selectedDevices,
    dateStart: startDate.toISOString(),
    dateEnd: newEndDate.toISOString(),
  };

  console.log('[CO2-V3] Buscando dados:', {
    dateStart: body.dateStart,
    dateEnd: body.dateEnd,
    devices: body.devices.length,
  });

  try {
    setPremiumLoading(true, LOADING_STATES.AWAITING_DATA, 25);
    const gasDataResponses = await sendRPCGas(centralIds, body);

    setPremiumLoading(true, LOADING_STATES.CONSOLIDATING, 70);

    let processedData = [];
    for (const [centralId, deviceReadings] of Object.entries(gasDataResponses)) {
      console.log('[CO2-V3] Central', centralId, '→', deviceReadings.length, 'leituras');
      for (const deviceReading of deviceReadings) {
        processedData.push({
          centralId,
          reading_date: convertToBrazilTime(deviceReading.timestamp),
          co2: toFixed(deviceReading?.value),
          deviceName: deviceNameLabelMap[deviceReading.deviceName] || deviceReading.deviceName,
        });
      }
    }

    // Sort: data → device → hora (sort nativo, lodash não disponível no contexto TB)
    processedData.sort((a, b) => {
      const da = parseDate(a.reading_date);
      const db = parseDate(b.reading_date);
      const dayA = da.toISOString().split('T')[0];
      const dayB = db.toISOString().split('T')[0];
      if (dayA !== dayB) return dayA < dayB ? -1 : 1;
      if (a.deviceName !== b.deviceName) return a.deviceName < b.deviceName ? -1 : 1;
      return da.getTime() - db.getTime();
    });

    console.log('[CO2-V3] Dados processados:', processedData.length, 'leituras');

    setCache(centralIds, startDate.toISOString(), endDate.toISOString(), processedData);

    setPremiumLoading(true, LOADING_STATES.READY, 100);
    setTimeout(() => {
      try {
        setPremiumLoading(false);
        rebuildView(processedData);
      } catch (rebuildErr) {
        console.error('[CO2-V3] Erro em rebuildView:', rebuildErr);
        self.ctx.detectChanges();
      }
    }, 300);
  } catch (error) {
    console.error('[CO2-V3] Erro ao carregar dados:', error);
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

// -------- Settings / Admin --------
function openSettingsModal() {
  showSettings = true;
  self.ctx.$scope.showSettings = true;
  self.ctx.detectChanges();
}

function closeSettingsModal() {
  showSettings = false;
  self.ctx.$scope.showSettings = false;
  self.ctx.detectChanges();
}

function onAdminPasswordInput(event) {
  adminPasswordInput = event.target.value;
}

function verifyAdminPassword() {
  if (adminPasswordInput === 'myio2025') {
    adminVerified = true;
    self.ctx.$scope.adminVerified = true;
    self.ctx.detectChanges();
  } else {
    showToast('error', 'Senha incorreta', 'A senha de administrador está incorreta.');
  }
}

function setAdminMode(event) {
  adminMode = event.target.checked;
  self.ctx.$scope.adminMode = adminMode;
  self.ctx.detectChanges();
}

// -------- Device filter (admin only) --------
function toggleDeviceFilter() {
  showDeviceFilter = !showDeviceFilter;
  self.ctx.$scope.showDeviceFilter = showDeviceFilter;
  self.ctx.detectChanges();
}

function onDeviceFilterTextChange(text) {
  deviceFilterText = text;
  self.ctx.$scope.deviceFilterText = text;
  self.ctx.$scope.filteredDevicesList = devicesSelectionList.filter((d) =>
    d.label.toLowerCase().includes(text.toLowerCase())
  );
  self.ctx.detectChanges();
}

function selectAllDevices() {
  devicesSelectionList.forEach((d) => (d.selected = true));
  self.ctx.$scope.filteredDevicesList = [...devicesSelectionList];
  updateDeviceCounts();
}

function deselectAllDevices() {
  devicesSelectionList.forEach((d) => (d.selected = false));
  self.ctx.$scope.filteredDevicesList = [...devicesSelectionList];
  updateDeviceCounts();
}

function toggleDeviceSelection(device) {
  device.selected = !device.selected;
  updateDeviceCounts();
}

function updateDeviceCounts() {
  self.ctx.$scope.selectedDevicesCount = devicesSelectionList.filter((d) => d.selected).length;
  self.ctx.$scope.allDevicesCount = devicesSelectionList.length;
  self.ctx.detectChanges();
}

function applyDeviceFilter() {
  showDeviceFilter = false;
  self.ctx.$scope.showDeviceFilter = false;
  self.ctx.detectChanges();
  if (startDate && endDate) getData();
}

// -------- Card view helpers --------
function getLatestCO2(readings) {
  if (!readings || readings.length === 0) return '—';
  const last = readings[readings.length - 1];
  return last.co2 != null ? `${last.co2}` : '—';
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
  self.ctx.$scope.isCardView = currentViewMode === VIEW_MODES.CARD;
  self.ctx.detectChanges();
}

// -------- Block modal --------
function closeBlockModal() {
  self.ctx.$scope.isBlocking = false;
  self.ctx.detectChanges();
}

// -------- onInit --------
self.onInit = function () {
  deviceList = self.ctx.datasources.map((ds) => ds.entityName);
  deviceNameLabelMap = self.ctx.datasources.reduce((acc, ds) => {
    acc[ds.entityName.split(' ')[0]] = ds.entityLabel;
    return acc;
  }, {});

  insertCurrentDate();

  // Constrói mapa device -> centralId (cada datasource tem seu próprio centralId)
  deviceToCentralMap = {};
  self.ctx.datasources.forEach((ds, i) => {
    const centralId = self.ctx.data[i]?.data?.[0]?.[1];
    if (centralId) deviceToCentralMap[ds.entityName] = centralId;
  });

  const allCentralIds = Object.values(deviceToCentralMap).filter((id) => id);
  const centralIdList = [...new Set(allCentralIds)];
  console.log('[CO2-V3] CentralIds:', centralIdList, '| deviceToCentralMap:', Object.keys(deviceToCentralMap).length, 'devices');

  devicesSelectionList = self.ctx.datasources.map((ds) => ({
    name: ds.entityName,
    label: ds.entityLabel || ds.entityName,
    selected: true,
  }));

  const s = self.ctx.$scope;
  s.centralIdList = centralIdList;
  s.dados = [];
  s.groupedData = {};
  s.expandedDevices = {};
  s.isCardView = currentViewMode === VIEW_MODES.CARD;
  s.premiumLoading = false;
  s.premiumLoadingStatus = '';
  s.premiumLoadingTimer = '00:00';
  s.premiumLoadingProgress = 0;
  s.isBlocking = false;
  s.adminMode = adminMode;
  s.adminVerified = adminVerified;
  s.showSettings = showSettings;
  s.showDeviceFilter = showDeviceFilter;
  s.deviceFilterText = deviceFilterText;
  s.devicesSelectionList = devicesSelectionList;
  s.filteredDevicesList = [...devicesSelectionList];
  s.selectedDevicesCount = devicesSelectionList.length;
  s.allDevicesCount = devicesSelectionList.length;

  // Funções expostas ao template Angular
  s.handleStartDateChange = handleStartDateChange;
  s.handleEndDateChange = handleEndDateChange;
  s.applyDateRange = applyDateRange;
  s.downloadPDF = () => exportToPDF(s.dados);
  s.downloadCSV = () => exportToCSV(s.dados);
  s.openSettingsModal = openSettingsModal;
  s.closeSettingsModal = closeSettingsModal;
  s.onAdminPasswordInput = onAdminPasswordInput;
  s.verifyAdminPassword = verifyAdminPassword;
  s.setAdminMode = setAdminMode;
  s.toggleDeviceFilter = toggleDeviceFilter;
  s.onDeviceFilterTextChange = onDeviceFilterTextChange;
  s.selectAllDevices = selectAllDevices;
  s.deselectAllDevices = deselectAllDevices;
  s.toggleDeviceSelection = toggleDeviceSelection;
  s.applyDeviceFilter = applyDeviceFilter;
  s.toggleViewMode = toggleViewMode;
  s.toggleDeviceExpansion = toggleDeviceExpansion;
  s.expandAllDevices = expandAllDevices;
  s.collapseAllDevices = collapseAllDevices;
  s.getLatestCO2 = getLatestCO2;
  s.getDeviceReadingCount = getDeviceReadingCount;
  s.closeBlockModal = closeBlockModal;

  self.ctx.detectChanges();
};

self.onDataUpdated = function () {
  self.ctx.detectChanges();
};

self.onDestroy = function () {
  if (_timerHandle) {
    clearInterval(_timerHandle);
    _timerHandle = null;
  }
  if (_dateChangeTimer) {
    clearTimeout(_dateChangeTimer);
    _dateChangeTimer = null;
  }
};
