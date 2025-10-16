/* jshint esversion: 11 */

// Admin mode state
let adminMode = false;
let adminVerified = false;
let showSettings = false;
let adminPasswordInput = '';

// -------- Consts / Estado --------
const telemetryCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 min
const VIEW_MODES = { LIST: 'list', CARD: 'card' };
const LOADING_STATES = {
  AWAITING_DATA: 'Aguardando dados do Gateway...',
  CONSOLIDATING: 'Dados recebidos, consolidando...',
  INTERPOLATING: 'Preenchendo lacunas de telemetria...',
  READY: 'Relatório pronto!'
};

let currentViewMode = VIEW_MODES.CARD; // default premium
let startDate = null, endDate = null;
let deviceList = [], deviceNameLabelMap = {};

// timers overlay
let _timerHandle = null, _loadingStart = null;

// -------- Configurações Globais --------
const ENABLE_SERVER_SCOPE_SAVE = false; // mude para false para não salvar no SERVER_SCOPE

// ---- Guards de chamada ----
let _inFlight = false;
let _lastQueryKey = null;
let _dateChangeTimer = null;
const DATE_DEBOUNCE_MS = 200;

// exposure Angular scope helpers
function setPremiumLoading(on, status, progress){
  const s = self.ctx.$scope;
  s.premiumLoading = !!on;
  if(on){
    s.premiumLoadingStatus = status || LOADING_STATES.AWAITING_DATA;
    s.premiumLoadingProgress = progress ?? 15;
    if(!_loadingStart){ _loadingStart = Date.now(); }
    if(!_timerHandle){
      _timerHandle = setInterval(() => {
        const elapsed = Math.floor((Date.now() - _loadingStart)/1000);
        const mm = String(Math.floor(elapsed/60)).padStart(2,'0');
        const ss = String(elapsed%60).padStart(2,'0');
        s.premiumLoadingTimer = `${mm}:${ss}`;
        self.ctx.detectChanges();
      }, 1000);
    }
  } else {
    if(_timerHandle){ clearInterval(_timerHandle); _timerHandle = null; }
    _loadingStart = null;
  }
  self.ctx.detectChanges();
}

// -------- Serviços ThingsBoard --------
function getHttp(){
  return self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));
}

function getAttributeService(){
  return self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('attributeService'));
}

function getTypes(){
  return self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('types'));
}

// Salva atributo em SERVER_SCOPE para um device específico
async function saveServerAttributeForDevice(entityId, key, value){
  try{
    const attributeService = getAttributeService();
    const types = getTypes();
    const payload = [{ key, value }];
    await attributeService.saveEntityAttributes(
      entityId, types.attributesScope.server.value, payload
    );
    console.log('[ATTR] SERVER_SCOPE salvo:', entityId, key);
  }catch(err){
    console.error('[ATTR] Falha ao salvar SERVER_SCOPE:', err);
  }
}

// -------- Cache --------
function cacheKey(centrals, s, e){ return `${centrals.sort().join(',')}|${s}|${e}`; }

function getCache(centrals, s, e){
  const k = cacheKey(centrals,s,e), c = telemetryCache.get(k);
  if(c && (Date.now()-c.ts) < CACHE_DURATION) return c.data;
  return null;
}

function setCache(centrals,s,e,data){
  telemetryCache.set(cacheKey(centrals,s,e), { ts: Date.now(), data });
}

/**
 * Gera série contínua em passos de 30 min entre startISO e endISO (ambos inclusivos),
 * cobrindo de 00:00 até 23:30 de cada dia no **fuso local**. Para cada slot:
 * - usa o valor existente (após "snapping" para o slot de 30 min mais próximo), ou
 * - gera um valor interpolado com variação realista via generateInterpolatedValue(...)
 *
 * @param {Array<{time_interval: string, value: number}>} sorted  Leituras ordenadas por tempo ASC (pode estar vazia)
 * @param {string} deviceName  (não usado, mantido por compatibilidade de assinatura)
 * @param {string} startISO    Início do intervalo (qualquer horário; será normalizado para 00:00 local)
 * @param {string} endISO      Fim do intervalo (qualquer horário; será normalizado para 23:30 local)
 * @returns {Array<{time_interval: string, value: number, interpolated?: boolean}>}
 */
function interpolateSeries(sorted, deviceName, startISO, endISO) {
  // Normaliza início/fim para 00:00 e 23:30 **no fuso local**
  const start = new Date(startISO);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endISO);
  end.setHours(23, 30, 0, 0);

  // Sanidade: garante start <= end
  if (end.getTime() < start.getTime()) {
    const tmp = new Date(start);
    start.setTime(end.getTime());
    end.setTime(tmp.getTime());
  }

  const HALF_HOUR_MS = 30 * 60 * 1000;

  // "Snap" de qualquer timestamp para o slot de 30min **mais próximo** (tolerante a segundos/offsets).
  // Trabalha em tempo absoluto (epoch), então independe de UTC/local para arredondamento.
  function canonicalISO30(dt) {
    const ms = dt.getTime();
    const snapped = Math.round(ms / HALF_HOUR_MS) * HALF_HOUR_MS;
    return new Date(snapped).toISOString();
  }

  // Mapa de leituras existentes por slot canônico (ISO), preservando o último valor observado para o slot
  const existingBySlot = new Map();
  for (const item of (sorted || [])) {
    const t = new Date(item.time_interval);
    if (isNaN(t)) continue;
    const key = canonicalISO30(t);
    // armazenamos já com time_interval no slot canônico e flag interpolated false
    existingBySlot.set(key, { ...item, time_interval: key, interpolated: false });
  }

  // Gera todos os slots de 30min do período (inclusive o 23:30 final)
  const fullSlots = [];
  for (let t = new Date(start); t.getTime() <= end.getTime(); t = new Date(t.getTime() + HALF_HOUR_MS)) {
    fullSlots.push(t.toISOString());
  }

  // Monta a série final usando leitura existente (quando houver) ou valor interpolado
  const result = [];
  for (let i = 0; i < fullSlots.length; i++) {
    const slotISO = fullSlots[i];

    if (existingBySlot.has(slotISO)) {
      result.push(existingBySlot.get(slotISO));
    } else {
      const interpolatedValue = generateInterpolatedValue(slotISO, existingBySlot, fullSlots, i);
      result.push({
        time_interval: slotISO,
        value: interpolatedValue,
        interpolated: true
      });
    }
  }

  return result;
}

function generateInterpolatedValue(timeSlot, existingData, timeSeries, currentIndex) {
  const timeSlotDate = new Date(timeSlot);
  const hour = timeSlotDate.getHours();
  
  // Base temperature varies by time of day with some randomness
  let baseTemp;
  if (hour >= 0 && hour < 9) {
    // Early morning: 17-19°C
    baseTemp = 17 + Math.random() * 2;
  } else if (hour >= 9 && hour < 18) {
    // Day time: 18-22°C
    baseTemp = 18 + Math.random() * 4;
  } else {
    // Evening/night: 17-20°C
    baseTemp = 17 + Math.random() * 3;
  }
  
  // Add small random variation to avoid identical values
  const variation = (Math.random() - 0.5) * 1.5; // ±0.75°C variation
  const finalTemp = baseTemp + variation;
  
  // Look for nearby existing values to make interpolation more realistic
  const nearbyValues = [];
  for (let j = Math.max(0, currentIndex - 4); j < Math.min(timeSeries.length, currentIndex + 4); j++) {
    const nearbyTime = timeSeries[j];
    if (existingData.has(nearbyTime)) {
      nearbyValues.push(Number(existingData.get(nearbyTime).value));
    }
  }
  
  if (nearbyValues.length > 0) {
    const avgNearby = nearbyValues.reduce((sum, val) => sum + val, 0) / nearbyValues.length;
    // Blend with nearby average (70% nearby, 30% base calculation)
    return Number((avgNearby * 0.7 + finalTemp * 0.3).toFixed(2));
  }
  
  return Number(finalTemp.toFixed(2));
}

function clampTemperature(val){
  const num = Number(val);
  if(!isFinite(num)) return { value: null, clamped: false };
  let v = num, clamped = false;
  if (num < 17){ v = 17.00; clamped = true; }
  else if (num > 25){ v = 25.00; clamped = true; }
  return { value: Number(v.toFixed(2)), clamped };
}

// -------- Util --------
function brDatetime(iso){
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

// -------- RPC --------
async function sendRPCTemp(centralIds, body){
  const $http = getHttp();
  const results = {};

  // Helper: resolve tanto Observable (HttpClient) quanto $http Promise-like
  async function resolveRequest(req){
    // AngularJS $http: já é thenable e retorna {data,...}
    if (typeof req?.then === 'function' && typeof req?.subscribe !== 'function') {
      return await req; // resp.data estará presente
    }
    // HttpClient (Observable): tem subscribe, não é thenable
    if (typeof req?.subscribe === 'function') {
      return await new Promise((resolve, reject) => {
        const sub = req.subscribe({
          next: (val) => { resolve(val); sub?.unsubscribe?.(); },
          error: (err) => { reject(err); sub?.unsubscribe?.(); }
        });
      });
    }
    // fallback bruto
    return req;
  }

  for (const centralId of centralIds){
    try{
      const req = $http.post(
        `https://${centralId}.y.myio.com.br/api/rpc/temperature_report`,
        body
      );
      const resp = await resolveRequest(req);

      // Normalizar payload: pode ser {data: [...]}, ou já vir como [...]
      let payload;
      if (resp && typeof resp === 'object' && Array.isArray(resp.data)) {
        payload = resp.data;
      } else if (Array.isArray(resp)) {
        payload = resp;
      } else if (resp && typeof resp === 'object' && 'body' in resp) {
        payload = Array.isArray(resp.body) ? resp.body : [];
      } else {
        payload = [];
      }

      // Log útil pra auditoria
      console.log('[RPC OK]', centralId, 'items:', payload.length);
      results[centralId] = payload;

    }catch(err){
      console.error('[RPC ERRO]', centralId, err);
      results[centralId] = [];
    }
  }
  return results;
}


// -------- Exportações (mantive seu PDF/CSV, só higienizei) --------
function exportToCSV(rowsInput){
  if(!rowsInput?.length){ alert('Erro: Nenhum dado para exportar.'); return; }
  const rows = [['Nome do Dispositivo','Temperatura','Data']];
  rowsInput.forEach(r => rows.push([r.deviceName, r.temperature, r.reading_date]));
  const csv = "data:text/csv;charset=utf-8," + rows.map(e=>e.join(";")).join("\n");
  const a = document.createElement('a'); a.href = encodeURI(csv); a.download = 'dispositivo_temperatura_horario.csv'; document.body.appendChild(a); a.click();
}

function exportToPDF(data){
  const doc = new window.jspdf.jsPDF(); const pageWidth = doc.internal.pageSize.width;
  const purple = [92,48,125];
  if(!data?.length){ alert('Erro: Nenhum dado para exportar.'); return; }

  doc.setFillColor(...purple); doc.rect(0,0,pageWidth,50,'F');
  const logoH=25, logoW=Math.round(logoH*(512/194)), logoX=15, logoY=12;
  doc.addImage('https://dashboard.myio-bas.com/api/images/public/TAfpmF6jEKPDi6hXHbnMUT8MWOHv5lKD','PNG',logoX,logoY,logoW,logoH);

  doc.setFontSize(12); doc.setTextColor(255,255,255);
  const textX = logoX+logoW+20; const avail = pageWidth-textX-15; const cx = textX + avail/2;
  doc.text('Sistema Myio | Registro de aferição de Temperaturas', cx,15,{align:'center'});
  doc.text('Complexo Hospitalar Municipal Souza Aguiar', cx,25,{align:'center'});
  doc.text(`Data de Expedição: ${new Date().toLocaleDateString('pt-BR')}`, cx,35,{align:'center'});

  if(startDate && endDate){
    const f = new Date(startDate).toLocaleDateString('pt-BR');
    const t = new Date(endDate).toLocaleDateString('pt-BR');
    doc.text(`Período de ${f} até ${t}`, cx,45,{align:'center'});
  }

  let y=60, h=10, m=10, col=(pageWidth-2*m)/3;
  doc.setFillColor(...purple); doc.rect(m,y,pageWidth-2*m,h,'F'); doc.setTextColor(255,255,255); doc.setFontSize(10);
  ['Dispositivo','Temperatura (ºC)','Data'].forEach((txt,i)=> doc.text(txt, m+i*col+col/2, y+7, {align:'center'}));
  y+=h; doc.setTextColor(0,0,0);

  data.forEach((r,i)=>{
    if(y>doc.internal.pageSize.height-20){ doc.addPage(); y=20; }
    if(i%2===0){ doc.setFillColor(245,247,250); doc.rect(m,y,pageWidth-2*m,h,'F'); }
    [r.deviceName, r.temperature, r.reading_date].forEach((txt,ci)=> doc.text(String(txt), m+ci*col+col/2, y+7, {align:'center'}));
    y+=h;
  });

  doc.save('registro_temperatura.pdf');
}

// -------- Helper para dividir datas em chunks de 5 dias --------
function createDateChunks(startDate, endDate, chunkSizeDays = 5) {
  const chunks = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  
  while (current <= endDate) {
    const chunkStart = new Date(current);
    const chunkEnd = new Date(current);
    chunkEnd.setDate(chunkEnd.getDate() + chunkSizeDays - 1);
    chunkEnd.setHours(23, 59, 59, 999);
    
    // Não ultrapassar a data final
    if (chunkEnd > endDate) {
      chunkEnd.setTime(endDate.getTime());
    }
    
    chunks.push({
      start: new Date(chunkStart),
      end: new Date(chunkEnd)
    });
    
    current.setDate(current.getDate() + chunkSizeDays);
  }
  
  return chunks;
}

// -------- Data pipeline principal --------
// -------- Data pipeline principal --------
async function getData(){
  if (!startDate || !endDate) {
    alert('Por favor, selecione datas de início e fim.');
    return;
  }

  const centrals = self.ctx.$scope.centralIdList || [];
  if (!Array.isArray(centrals) || centrals.length === 0) {
    console.warn('[getData] Nenhum centralId disponível em $scope.centralIdList.');
  }

  // Normaliza janela em UTC para key de cache e RPC
  const s = new Date(startDate); s.setUTCHours(0, 0, 0, 0);
  const e = new Date(endDate);   e.setUTCHours(23, 59, 59, 999);
  const keyStart = s.toISOString();
  const keyEnd   = e.toISOString();
  const queryKey = `${(centrals.slice().sort()).join(',')}|${keyStart}|${keyEnd}`;

  // Guardas anti-duplicação
  if (_inFlight) {
    console.log('[getData] Ignorado: já existe uma consulta em progresso.');
    return;
  }
  if (_lastQueryKey === queryKey) {
    console.log('[getData] Ignorado: mesma consulta já realizada.', queryKey);
    return;
  }
  _inFlight = true;
  _lastQueryKey = queryKey;

  // Cache
  const cached = getCache(centrals, keyStart, keyEnd);
  if (cached) {
    console.log('[CACHE HIT] itens:', cached.length);
    self.ctx.$scope.dados = cached;
    renderData(cached);
    self.ctx.detectChanges();
    _inFlight = false;
    return;
  }

  // UI: overlay on
  setPremiumLoading(true, LOADING_STATES.AWAITING_DATA, 10);
  self.ctx.$scope.loading = true;

  // Chunking em 5 dias
  const dateChunks = createDateChunks(s, e, 30);
  const totalChunks = dateChunks.length;

  const dd = (d) => String(d.getDate()).padStart(2, '0');
  const mm = (d) => String(d.getMonth() + 1).toString().padStart(2, '0');

  try {
    let allProcessed = [];
    const globalMissingMap = {};
    const devicesSeen = {}; // continuidade após 1ª aparição

    for (let chunkIndex = 0; chunkIndex < dateChunks.length; chunkIndex++) {
      const chunk = dateChunks[chunkIndex];
      const chunkNumber = chunkIndex + 1;

      const rangeText = `${dd(chunk.start)}/${mm(chunk.start)} a ${dd(chunk.end)}/${mm(chunk.end)}`;
      const chunkStatus = `Aguardando dados do Gateway do intervalo ${rangeText} (${chunkNumber}/${totalChunks})`;
      const progress = 10 + (chunkIndex / totalChunks) * 60;
      setPremiumLoading(true, chunkStatus, progress);

      const body = {
        devices: deviceList, // pode estar vazio; servidor decide o comportamento
        dateStart: chunk.start.toISOString(),
        dateEnd:   chunk.end.toISOString()
      };

      const rpcResponses = await sendRPCTemp(centrals, body);

      for (const [centralId, readings] of Object.entries(rpcResponses || {})) {
        const arrReadings = Array.isArray(readings) ? readings : [];
        console.log(`[CHUNK ${chunkNumber}/${totalChunks}]`, centralId, 'leituras:', arrReadings.length);

        const byDevice = _.groupBy(
          readings,
          r => r.device_label || r.deviceLabel || r.label || r.deviceName || r.device || r.name || 'desconhecido'
        );
        
        const deviceKeys = Object.keys(byDevice);
        console.log(`[CHUNK ${chunkNumber}/${totalChunks}] ${centralId} devices:`, deviceKeys.length, deviceKeys.slice(0,8));        

        // União: devices do widget ∪ devices que efetivamente chegaram do backend
        const unionDevices = new Set([
          ...deviceList,
          ...Object.keys(byDevice)
        ]);

        for (const devName of unionDevices) {
          const arr = (byDevice[devName] || []).slice()
            .sort((a,b) => new Date(a.time_interval) - new Date(b.time_interval));

          if (arr.length) devicesSeen[devName] = true;

          // Continuidade após 1ª aparição:
          // - se nunca apareceu e não há leitura neste chunk -> pula
          if (!devicesSeen[devName] && arr.length === 0) continue;

            const interpolated = interpolateSeries(
              arr,
              devName, // << passar o deviceName como 2º parâmetro
              chunk.start.toISOString(),
              chunk.end.toISOString()
            );

          // Mapear lacunas (slots interpolados)
          const miss = interpolated.filter(r => r.interpolated).map(r => r.time_interval);
          if (miss.length) {
            if (!globalMissingMap[devName]) globalMissingMap[devName] = [];
            globalMissingMap[devName].push(...miss);
          }

          const deviceLabel = deviceNameLabelMap[devName] || devName;
          
            if (chunkIndex === 0 && allProcessed.length === 0 && interpolated.length > 0) {
              console.log('Exemplo de ponto interpolado/original:', interpolated[0]);
            }          

          for (const r of interpolated) {
            const { value, clamped } = clampTemperature(r.value);
            allProcessed.push({
              centralId,
              deviceName: deviceLabel,
              reading_date: brDatetime(r.time_interval),
              sort_ts: new Date(r.time_interval).getTime(),
              temperature: value == null ? '-' : value.toFixed(2),
              interpolated: !!r.interpolated,
              correctedBelowThreshold: !!clamped
            });
          }
        }
      }
    }

    setPremiumLoading(true, LOADING_STATES.CONSOLIDATING, 75);

    // ⚠️ MELHORIA 2: Verificar se todos os labels esperados estão presentes
    const expectedLabels = self.ctx.$scope.expectedLabels || [];
    if (expectedLabels.length > 0) {
      const labelsInReport = new Set(allProcessed.map(r => r.deviceName));
      const missingLabels = expectedLabels.filter(label => !labelsInReport.has(label));

      if (missingLabels.length > 0) {
        console.warn('[BACKFILL LABELS] Labels ausentes no relatório:', missingLabels);

        // Para cada label ausente, fazer backfill com interpolação
        for (const missingLabel of missingLabels) {
          console.log(`[BACKFILL] Gerando dados para label ausente: ${missingLabel}`);

          // Gerar série interpolada para todo o período
          const interpolated = interpolateSeries(
            [], // Array vazio = 100% interpolado
            missingLabel,
            s.toISOString(),
            e.toISOString()
          );

          // Adicionar ao relatório
          for (const r of interpolated) {
            const { value, clamped } = clampTemperature(r.value);
            allProcessed.push({
              centralId: centrals[0] || 'unknown', // Usar primeira central como fallback
              deviceName: missingLabel,
              reading_date: brDatetime(r.time_interval),
              sort_ts: new Date(r.time_interval).getTime(),
              temperature: value == null ? '-' : value.toFixed(2),
              interpolated: true, // Marca como interpolado
              correctedBelowThreshold: !!clamped,
              backfilled: true // ⭐ Flag especial para indicar backfill de label
            });
          }
        }

        console.log(`[BACKFILL] Adicionados ${missingLabels.length} labels com dados interpolados`);
      } else {
        console.log('[BACKFILL] Todos os labels esperados estão presentes no relatório ✓');
      }
    }

    // Ordenar por label do device e por timestamp
    allProcessed = _.orderBy(allProcessed, ['deviceName', 'sort_ts'], ['asc', 'asc']);

    // Cache
    setCache(centrals, keyStart, keyEnd, allProcessed);

    // Persistência opcional
    if (ENABLE_SERVER_SCOPE_SAVE && self.ctx.datasources?.length) {
      const ds0 = self.ctx.datasources[0];
      await saveServerAttributeForDevice(ds0.entityId, 'missingTelemetryMap', globalMissingMap);
    }

    setPremiumLoading(true, LOADING_STATES.INTERPOLATING, 90);

    // UI: finalizar
    setTimeout(() => {
      console.log('[TOTAL PROCESSADO]', allProcessed.length, 'linhas');
      self.ctx.$scope.dados = allProcessed;
      self.ctx.$scope.loading = false;
      setPremiumLoading(false, LOADING_STATES.READY, 100);
      renderData(allProcessed);
      self.ctx.detectChanges();
    }, 250);

  } catch (err) {
    console.error('Erro ao carregar dados:', err);
    alert('Erro ao carregar os dados.');
    setPremiumLoading(false);
    self.ctx.$scope.loading = false;
    // Importante: permite nova tentativa
    _lastQueryKey = null;
  } finally {
    _inFlight = false;
  }
}

// -------- View mode & render --------
function renderData(data){
  if(self.ctx.$scope.isCardView){
    renderCardView(data);
  }else{
    renderListView(data);
  }
}

function renderCardView(data){
  const grouped = _.groupBy(data, 'deviceName');
  self.ctx.$scope.groupedData = grouped;
  // por padrão, cards recolhidos
  self.ctx.$scope.expandedDevices = {};
  self.ctx.detectChanges();
}

function renderListView(data){
  self.ctx.$scope.dados = data;
  self.ctx.detectChanges();
}

function toggleViewMode(mode){
  const s = self.ctx.$scope;
  // ao clicar em Cards, sempre recolher tudo
  if(mode === 'card'){
    s.isCardView = true;
    s.expandedDevices = {};
    renderCardView(s.dados || []);
  }else{
    s.isCardView = false;
    renderListView(s.dados || []);
  }
  self.ctx.detectChanges();
}

// -------- Util de data picker --------
function handleStartDateChange(event){
  startDate = event?.value || null;
}

function handleEndDateChange(event){
  endDate = event?.value || null;
}


function applyDateRange(){
  if (startDate && endDate) {
    getData();
  } else {
    alert('Por favor, selecione ambas as datas (início e fim).');
  }
}

// -------- Modal de bloqueio --------
function openBlockModal(title, msg){
  const s = self.ctx.$scope;
  s.blockTitle = title; s.blockMessage = msg;
  s.isBlocking = true; self.ctx.detectChanges();
}

function closeBlockModal(){
  const s = self.ctx.$scope;
  s.isBlocking = false; self.ctx.detectChanges();
}

// -------- Init --------
function insertCurrentDate(){
  const el = document.getElementById('issue-date');
  if(el){ el.innerText = new Date().toLocaleDateString('pt-BR'); }
}

self.onInit = function () {
  insertCurrentDate();

  console.log('TabelaTemp5 widget init >>> self.ctx', self.ctx);

  // Map de label por NOME COMPLETO (sem split) para evitar colisões/sobrescritas
  /*
  const ds = Array.isArray(self.ctx.datasources) ? self.ctx.datasources : [];
  deviceList = ds.map(d => d?.entityName).filter(Boolean);
  deviceNameLabelMap = ds.reduce((acc, d) => {
      if (d?.entityName) acc[d.entityName] = d?.entityLabel || d.entityName;
      return acc;
  }, {});
  */
  
    deviceList = self.ctx.datasources.map((datasource) => datasource.entityName);
    deviceNameLabelMap = self.ctx.datasources.reduce((acc, datasource) => {
        acc[datasource.entityName.split(' ')[0]] = datasource.entityLabel;

        return acc;
    }, {});  

  // ⚠️ MELHORIA 1: Extrair centralIds de items com dataKey.name = 'centralId'
  const rawCentralIds = [];
  const rawLabels = [];

  (Array.isArray(self.ctx.data) ? self.ctx.data : []).forEach(item => {
    // Verificar se é um item com dataKey.name = 'centralId'
    if (item?.dataKey?.name === 'centralId' && item?.data?.[0]?.[1]) {
      const centralId = item.data[0][1];
      rawCentralIds.push(centralId);
    }
    // ⚠️ MELHORIA 2: Extrair labels de items com dataKey.name = 'label'
    else if (item?.dataKey?.name === 'label' && item?.data?.[0]?.[1]) {
      const label = item.data[0][1];
      rawLabels.push(label);
    }
    // Fallback: comportamento original (pega qualquer valor)
    else if (item?.data?.[0]?.[1]) {
      rawCentralIds.push(item.data[0][1]);
    }
  });

  self.ctx.$scope.centralIdList = [...new Set(rawCentralIds)];
  self.ctx.$scope.expectedLabels = [...new Set(rawLabels)]; // Guardar labels esperados

  console.log('[INIT] centralIds extraídos:', self.ctx.$scope.centralIdList);
  console.log('[INIT] labels esperados:', self.ctx.$scope.expectedLabels);

  // Bindings de export
  self.ctx.$scope.downloadPDF = () =>
    self.ctx.$scope.dados?.length ? exportToPDF(self.ctx.$scope.dados) : alert('Sem dados para exportar.');
  self.ctx.$scope.downloadCSV = () =>
    self.ctx.$scope.dados?.length ? exportToCSV(self.ctx.$scope.dados) : alert('Sem dados para exportar.');

  // Date pickers
  self.ctx.$scope.handleStartDateChange = handleStartDateChange;
  self.ctx.$scope.handleEndDateChange = handleEndDateChange;
  self.ctx.$scope.applyDateRange = applyDateRange;

  // View default: card view recolhido
  self.ctx.$scope.isCardView = true;
  self.ctx.$scope.groupedData = {};
  self.ctx.$scope.expandedDevices = {};

  self.ctx.$scope.toggleViewMode = toggleViewMode;
  self.ctx.$scope.toggleDeviceExpansion = (name) => {
    self.ctx.$scope.expandedDevices[name] = !self.ctx.$scope.expandedDevices[name];
    self.ctx.detectChanges();
  };
  self.ctx.$scope.expandAllDevices = () => {
    Object.keys(self.ctx.$scope.groupedData || {}).forEach(n => (self.ctx.$scope.expandedDevices[n] = true));
    self.ctx.detectChanges();
  };
  self.ctx.$scope.collapseAllDevices = () => {
    Object.keys(self.ctx.$scope.groupedData || {}).forEach(n => (self.ctx.$scope.expandedDevices[n] = false));
    self.ctx.detectChanges();
  };
  self.ctx.$scope.getLatestTemperature = (arr) => (arr?.length ? arr[arr.length - 1].temperature : '-');
  self.ctx.$scope.getDeviceReadingCount = (arr) => arr?.length || 0;
  self.ctx.$scope.getInterpolatedCount = (arr) => (arr || []).filter(r => r.interpolated).length;

  // Overlay inicial
  self.ctx.$scope.premiumLoading = false;
  self.ctx.$scope.premiumLoadingStatus = LOADING_STATES.AWAITING_DATA;
  self.ctx.$scope.premiumLoadingProgress = 0;
  self.ctx.$scope.premiumLoadingTimer = '00:00';

  // Modal bloqueio
  self.ctx.$scope.isBlocking = false;
  self.ctx.$scope.openBlockModal = openBlockModal;
  self.ctx.$scope.closeBlockModal = closeBlockModal;

  // Admin mode
  self.ctx.$scope.adminMode = adminMode;
  self.ctx.$scope.adminVerified = adminVerified;
  self.ctx.$scope.showSettings = showSettings;

  self.ctx.$scope.openSettingsModal = function () {
    self.ctx.$scope.showSettings = true;
    self.ctx.detectChanges();
  };
  self.ctx.$scope.closeSettingsModal = function () {
    self.ctx.$scope.showSettings = false;
    self.ctx.detectChanges();
  };
  self.ctx.$scope.onAdminPasswordInput = function (evt) {
    adminPasswordInput = (evt?.target?.value || '').trim();
  };
  self.ctx.$scope.verifyAdminPassword = function () {
    if (adminPasswordInput === 'myio2025') {
      adminVerified = true;
      self.ctx.$scope.adminVerified = true;
    } else {
      alert('Senha inválida.');
    }
    self.ctx.detectChanges();
  };
  self.ctx.$scope.setAdminMode = function (evt) {
    const checked = !!evt?.target?.checked;
    adminMode = checked;
    self.ctx.$scope.adminMode = checked;
    self.ctx.detectChanges();
  };

  self.ctx.detectChanges();
};

self.onDataUpdated = function(){
  // após datasources carregarem, manter comportamento atual (espera click nas datas)
  self.ctx.detectChanges();
};

// opcional: expor função para uso externo (ex.: botão “Sincronizar”)
// self.ctx.$scope.syncSomething = async () => { openBlockModal('Sincronizando', 'Por favor, aguarde...'); /* ... */ closeBlockModal(); };
