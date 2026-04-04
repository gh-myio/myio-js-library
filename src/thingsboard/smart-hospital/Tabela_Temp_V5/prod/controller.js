/* jshint esversion: 11 */
/* global self, _, document, window, requestAnimationFrame, alert, FileReader */

/**
 * Tabela_Temp_V5 Controller v3.1.1 - HYBRID
 *
 * Supports both legacy and new backends:
 * - Legacy backends (CENTRALS_WITH_OLD_BACKEND): Apply -3h correction
 *   (backend uses AT TIME ZONE which adds +3h to true UTC)
 * - New v3.1 backends: No correction needed (returns true UTC)
 *
 * brDatetime() converts UTC -> Brazil time (America/Sao_Paulo)
 */

// Admin mode state
let adminMode = false;
let adminVerified = false;
let showSettings = false;
let adminPasswordInput = '';

// Interpolation flag — disabled by default; admin can enable via settings modal
let interpolationEnabled = false;

// Clamp limits for real sensor readings (admin-configurable)
// Defaults / fallback — overridden by SERVER_SCOPE attributes tempClampMin / tempClampMax
const CLAMP_DEFAULT_MIN = 17;
const CLAMP_DEFAULT_MAX = 25;
let clampMin = CLAMP_DEFAULT_MIN;
let clampMax = CLAMP_DEFAULT_MAX;
let _clampFromCustomer = false; // true = loaded from SERVER_SCOPE; false = using defaults
let _customerSlug = 'hospital'; // slug do nome do cliente, preenchido no _loadClampAttributes

// Customer entity ID — Complexo Hospitalar Municipal Souza Aguiar (HMSA)
const THINGSBOARD_CUSTOMER_ID = '492387b0-a1e6-11ef-9e25-b7f6e6d4253b';

// Central ID → friendly name map (for error banner display)
const CENTRAL_NAMES = {
  'cea3473b-6e46-4a2f-85b8-f228d2a8347a': 'Central Maternidade',
  'df3f846e-b69c-45ce-9475-bd90570b24d0': 'Central T&D',
  'b93e4ee6-e002-43ce-83c6-58928d1fd319': 'Central Ar Comprimido',
  '295628b1-75c6-4854-8031-107cd9a2ab91': 'Central CO2',
};

// -------- Consts / Estado --------
const telemetryCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 min

// -------- TEMPORARY FIX: CentralId Normalization --------
// Maps old centralId to new centralId (provisório)
function normalizeCentralId(centralId) {
  if (centralId === '3fd3b316-e74c-4cc8-a9a0-22ea707fea3a') {
    return 'cea3473b-6e46-4a2f-85b8-f228d2a8347a';
  }
  return centralId;
}
const LOADING_STATES = {
  AWAITING_DATA: 'Aguardando dados do Gateway...',
  CONSOLIDATING: 'Dados recebidos, consolidando...',
  INTERPOLATING: 'Preenchendo lacunas de telemetria...',
  READY: 'Relatório pronto!',
};

let startDate = null,
  endDate = null;
let deviceList = [],
  deviceNameLabelMap = {};

// v2: Mapa device -> centralId para filtrar devices por central no RPC
let deviceToCentralMap = {};

// Mapa centralId -> nome amigável (construído em onInit/onDataUpdated)
let centralIdToLabelMap = {};

// Device filter state
let showDeviceFilter = false;
let deviceFilterText = '';
let devicesSelectionList = []; // [{ name, label, selected }]

// timers overlay
let _timerHandle = null,
  _loadingStart = null;

// -------- Configurações Globais --------
const ENABLE_SERVER_SCOPE_SAVE = false; // mude para false para não salvar no SERVER_SCOPE

// ---- Guards de chamada ----
let _inFlight = false;
let _lastQueryKey = null;

// ── Manual Temperature Override ─────────────────────────────────────────────
let _isMyIOAdmin = false; // true for @myio.com.br users (except alarme/alarmes)
let _manualOverrides = null; // cached value of manualTempOverrides SERVER_SCOPE attribute

// exposure Angular scope helpers
function setPremiumLoading(on, status, progress) {
  const s = self.ctx.$scope;
  s.premiumLoading = !!on;
  if (on) {
    s.premiumLoadingStatus = status || LOADING_STATES.AWAITING_DATA;
    s.premiumLoadingProgress = progress ?? 15;
    if (!_loadingStart) {
      _loadingStart = Date.now();
    }
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

// -------- Serviços ThingsBoard --------

/**
 * Retorna o entityId do cliente atual.
 * - Customer user: vem direto de currentUser.customerId
 * - Tenant admin abrindo dashboard de cliente: customerId vem na URL (?customerId=...)
 *   ou nos stateParams do dashboard
 */
function _getCustomerEntityId() {
  // 1. Constante hardcoded — HMSA (fonte mais confiável)
  if (THINGSBOARD_CUSTOMER_ID) {
    return { id: THINGSBOARD_CUSTOMER_ID, entityType: 'CUSTOMER' };
  }
  // 2. Customer user normal
  var fromUser = self.ctx && self.ctx.currentUser && self.ctx.currentUser.customerId;
  if (fromUser && fromUser.id) {
    console.log('[CUSTOMER_ID] via currentUser.customerId:', fromUser.id);
    return fromUser;
  }
  // 3. Tenant admin: tenta URL query string (?customerId=uuid)
  try {
    var urlParams = new URLSearchParams(window.location.search);
    var idFromUrl = urlParams.get('customerId');
    if (idFromUrl) {
      console.log('[CUSTOMER_ID] via URL ?customerId:', idFromUrl);
      return { id: idFromUrl, entityType: 'CUSTOMER' };
    }
  } catch { /* ignorado */ }
  // 4. Tenta stateController (dashboard state params)
  try {
    var stateParams = self.ctx.stateController && self.ctx.stateController.getStateParams
      ? self.ctx.stateController.getStateParams()
      : null;
    if (stateParams && stateParams.customerId && stateParams.customerId.id) {
      console.log('[CUSTOMER_ID] via stateParams.customerId:', stateParams.customerId.id);
      return stateParams.customerId;
    }
  } catch { /* ignorado */ }
  console.warn('[CUSTOMER_ID] não encontrado em nenhuma fonte');
  return null;
}

/**
 * Versão async de _getCustomerEntityId.
 * Tenta os mesmos 3 métodos síncronos; se falharem, consulta GET /api/device/{centralId}
 * para extrair o customerId da central — disponível mesmo para TENANT_ADMIN.
 */
async function _getCustomerEntityIdAsync() {
  var sync = _getCustomerEntityId();
  if (sync && sync.id) return sync;

  // 4. Busca via API: GET /api/device/{centralId} → customerId
  // Usa CENTRAL_NAMES que já tem todos os IDs das centrais do hospital
  try {
    var knownCentralIds = Object.keys(CENTRAL_NAMES);
    for (var i = 0; i < knownCentralIds.length; i++) {
      var resp = await getHttp().get('/api/device/' + knownCentralIds[i]).toPromise();
      var device = (resp && resp.data) ? resp.data : resp;
      if (device && device.customerId && device.customerId.id) {
        console.log('[CUSTOMER_ID] via /api/device/' + knownCentralIds[i] + ' (' + CENTRAL_NAMES[knownCentralIds[i]] + ') → customerId:', device.customerId.id);
        return device.customerId;
      }
    }
  } catch { /* ignorado */ }

  console.warn('[CUSTOMER_ID] async: não encontrado em nenhuma fonte');
  return null;
}

function getHttp() {
  return self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));
}

function getAttributeService() {
  return self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('attributeService'));
}

function getTypes() {
  return self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('types'));
}

// Salva atributo em SERVER_SCOPE para um device específico
async function saveServerAttributeForDevice(entityId, key, value) {
  try {
    const attributeService = getAttributeService();
    const types = getTypes();
    const payload = [{ key, value }];
    await attributeService.saveEntityAttributes(entityId, types.attributesScope.server.value, payload);
    console.log('[ATTR] SERVER_SCOPE salvo:', entityId, key);
  } catch (err) {
    console.error('[ATTR] Falha ao salvar SERVER_SCOPE:', err);
  }
}

// Carrega tempClampMin / tempClampMax do SERVER_SCOPE do cliente
async function _loadClampAttributes() {
  try {
    const entityId = await _getCustomerEntityIdAsync();
    if (!entityId || !entityId.id) {
      _clampFromCustomer = false;
      return;
    }
    // Busca nome do cliente para slug dos arquivos exportados
    try {
      const customer = await getHttp()
        .get('/api/customer/' + entityId.id)
        .toPromise();
      if (customer?.title) {
        _customerSlug =
          customer.title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '') || 'hospital';
      }
    } catch {
      /* mantém fallback 'hospital' */
    }
    const resp = await getHttp()
      .get('/api/plugins/telemetry/CUSTOMER/' + entityId.id + '/values/attributes/SERVER_SCOPE?keys=tempClampMin,tempClampMax')
      .toPromise();
    const data = (resp && resp.data) ? resp.data : resp;
    const attrs = Array.isArray(data) ? data : [];
    const minAttr = attrs.find(function (a) { return a.key === 'tempClampMin'; });
    const maxAttr = attrs.find(function (a) { return a.key === 'tempClampMax'; });
    const hasMin = minAttr != null && minAttr.value != null;
    const hasMax = maxAttr != null && maxAttr.value != null;
    if (hasMin || hasMax) {
      if (hasMin) clampMin = parseFloat(minAttr.value);
      if (hasMax) clampMax = parseFloat(maxAttr.value);
      _clampFromCustomer = true;
      console.log('[CLAMP] Carregado de SERVER_SCOPE:', clampMin, clampMax);
    } else {
      clampMin = CLAMP_DEFAULT_MIN;
      clampMax = CLAMP_DEFAULT_MAX;
      _clampFromCustomer = false;
      console.log('[CLAMP] Sem atributos no SERVER_SCOPE, usando defaults:', clampMin, clampMax);
    }
    self.ctx.$scope.clampMin = clampMin;
    self.ctx.$scope.clampMax = clampMax;
    self.ctx.$scope.clampFromCustomer = _clampFromCustomer;
    self.ctx.detectChanges();
  } catch (e) {
    console.warn('[CLAMP] Falha ao carregar, usando defaults:', e);
    _clampFromCustomer = false;
    self.ctx.$scope.clampFromCustomer = false;
    self.ctx.detectChanges();
  }
}

// Salva tempClampMin / tempClampMax no SERVER_SCOPE do cliente
async function _saveClampAttributes() {
  try {
    const entityId = await _getCustomerEntityIdAsync();
    if (!entityId || !entityId.id) {
      console.warn('[CLAMP] Sem entidade de cliente para salvar');
      throw new Error('Customer entity não encontrado. Verifique se o dashboard está aberto no contexto de um cliente.');
    }
    await getHttp()
      .post('/api/plugins/telemetry/CUSTOMER/' + entityId.id + '/SERVER_SCOPE', {
        tempClampMin: clampMin,
        tempClampMax: clampMax,
      })
      .toPromise();
    _clampFromCustomer = true;
    self.ctx.$scope.clampFromCustomer = true;
    self.ctx.detectChanges();
    console.log('[CLAMP] Salvo em SERVER_SCOPE:', clampMin, clampMax);
  } catch (e) {
    console.error('[CLAMP] Falha ao salvar SERVER_SCOPE:', e);
    throw e; // propaga para saveClampSettings mostrar erro na UI
  }
}

// ── Manual Override helpers ──────────────────────────────────────────────────
function buildOverrideMap(attr) {
  var map = new Map();
  if (!attr || !Array.isArray(attr.device_list_interval_values)) {
    console.warn('[OVERRIDE] buildOverrideMap: attr inválido ou null', attr);
    return map;
  }
  for (var i = 0; i < attr.device_list_interval_values.length; i++) {
    var device = attr.device_list_interval_values[i];
    var devMap = new Map();
    var vl = device.values_list || [];
    for (var j = 0; j < vl.length; j++) {
      devMap.set(vl[j].timeUTC, vl[j].value);
    }
    map.set(device.deviceCentralName, devMap);
    console.log('[OVERRIDE] buildOverrideMap: device=' + device.deviceCentralName + ' slots=' + devMap.size);
  }
  console.log('[OVERRIDE] buildOverrideMap: total devices=' + map.size);
  return map;
}

async function _loadManualOverrides() {
  try {
    var entityId = await _getCustomerEntityIdAsync();
    if (!entityId || !entityId.id) {
      console.warn('[MANUAL OVERRIDE] Customer entity não encontrado, overrides não carregados');
      return;
    }
    var resp = await getHttp()
      .get('/api/plugins/telemetry/CUSTOMER/' + entityId.id + '/values/attributes/SERVER_SCOPE?keys=manualTempOverrides')
      .toPromise();
    var data = (resp && resp.data) ? resp.data : resp;
    var attr = (Array.isArray(data) ? data : []).find(function (a) { return a.key === 'manualTempOverrides'; });
    _manualOverrides = attr ? attr.value : null;
    console.log('[MANUAL OVERRIDE] Carregado:', _manualOverrides
      ? (_manualOverrides.device_list_interval_values || []).length + ' devices'
      : 'nenhum');
  } catch (e) {
    console.warn('[MANUAL OVERRIDE] Falha ao carregar:', e);
    _manualOverrides = null;
  }
}

async function _saveManualOverrides(data) {
  var entityId = _getCustomerEntityId();
  if (!entityId || !entityId.id) throw new Error('Customer entity não encontrado');
  await getHttp()
    .post('/api/plugins/telemetry/CUSTOMER/' + entityId.id + '/SERVER_SCOPE', { manualTempOverrides: data })
    .toPromise();
  _manualOverrides = data;
  console.log('[MANUAL OVERRIDE] Salvo em SERVER_SCOPE, versão', data.version);
}

// -------- Cache --------
function cacheKey(centrals, s, e) {
  return `${centrals.sort().join(',')}|${s}|${e}`;
}

function getCache(centrals, s, e) {
  const k = cacheKey(centrals, s, e),
    c = telemetryCache.get(k);
  if (c && Date.now() - c.ts < CACHE_DURATION) return c.data;
  return null;
}

function setCache(centrals, s, e, data) {
  telemetryCache.set(cacheKey(centrals, s, e), { ts: Date.now(), data });
}

/**
 * Configurações de interpolação limitada
 */
const INTERPOLATION_CONFIG = {
  maxGapSlots: 8, // 8 slots × 30min = 4 horas máximo (per user request)
  allowCrossMidnight: false, // Não interpolar gaps que cruzam meia-noite
  includeMissingInOutput: true, // Inclui slots sem dados no output (missing: true) para contagem de perda
};

/**
 * Identifica gaps consecutivos na série de slots
 * @param {string[]} fullSlots - Array de slots ISO
 * @param {Map} existingBySlot - Map de slots com dados reais
 * @returns {Array<{startIndex, endIndex, startSlot, endSlot, size}>}
 */
function identifyGaps(fullSlots, existingBySlot) {
  const gaps = [];
  let currentGap = null;

  for (let i = 0; i < fullSlots.length; i++) {
    const hasData = existingBySlot.has(fullSlots[i]);

    if (!hasData) {
      if (!currentGap) {
        currentGap = { startIndex: i, startSlot: fullSlots[i], size: 0 };
      }
      currentGap.size++;
      currentGap.endIndex = i;
      currentGap.endSlot = fullSlots[i];
    } else {
      if (currentGap) {
        gaps.push(currentGap);
        currentGap = null;
      }
    }
  }

  // Gap final (se terminar sem dados)
  if (currentGap) {
    gaps.push(currentGap);
  }

  return gaps;
}

/**
 * Encontra o gap que contém um determinado índice
 * @param {Array} gaps - Lista de gaps identificados
 * @param {number} slotIndex - Índice do slot atual
 * @returns {Object|null} - Gap info ou null se não encontrado
 */
function findGapForSlot(gaps, slotIndex) {
  return gaps.find((gap) => slotIndex >= gap.startIndex && slotIndex <= gap.endIndex) || null;
}

/**
 * Verifica se um gap pode ser interpolado
 * @param {Object} gapInfo - Informações do gap
 * @param {number} maxGapSlots - Máximo de slots permitidos
 * @param {boolean} allowCrossMidnight - Permitir cruzar meia-noite
 * @returns {boolean}
 */
function canInterpolate(gapInfo, maxGapSlots, allowCrossMidnight) {
  // Regra 1: Gap não pode exceder maxGapSlots
  if (gapInfo.size > maxGapSlots) {
    return false;
  }

  // Regra 2: Não cruzar meia-noite (se não permitido)
  if (!allowCrossMidnight) {
    const startDate = new Date(gapInfo.startSlot);
    const endDate = new Date(gapInfo.endSlot);

    // Verificar se estão no mesmo dia (comparar data local)
    const startDay = startDate.toLocaleDateString();
    const endDay = endDate.toLocaleDateString();

    if (startDay !== endDay) {
      return false;
    }
  }

  return true;
}

/**
 * Retorna o motivo pelo qual o slot não foi interpolado
 * @param {Object} gapInfo - Informações do gap
 * @param {number} maxGapSlots - Máximo de slots permitidos
 * @param {boolean} allowCrossMidnight - Permitir cruzar meia-noite
 * @returns {string}
 */
function getSkipReason(gapInfo, maxGapSlots, allowCrossMidnight) {
  if (gapInfo.size > maxGapSlots) {
    return `gap_too_large_${gapInfo.size}_slots_max_${maxGapSlots}`;
  }

  if (!allowCrossMidnight) {
    const startDate = new Date(gapInfo.startSlot);
    const endDate = new Date(gapInfo.endSlot);
    const startDay = startDate.toLocaleDateString();
    const endDay = endDate.toLocaleDateString();

    if (startDay !== endDay) {
      return 'crosses_midnight';
    }
  }

  return 'unknown';
}

/**
 * Gera série contínua em passos de 30 min entre startISO e endISO (ambos inclusivos),
 * cobrindo de 00:00 até 23:30 de cada dia no **fuso local**.
 *
 * INTERPOLAÇÃO LIMITADA:
 * - Máximo de 3 horas (6 slots) de gap
 * - Não interpola gaps que cruzam meia-noite
 * - Gaps inválidos são marcados como missing: true
 *
 * @param {Array<{time_interval: string, value: number}>} sorted  Leituras ordenadas por tempo ASC (pode estar vazia)
 * @param {string} deviceName  (não usado, mantido por compatibilidade de assinatura)
 * @param {string} startISO    Início do intervalo (qualquer horário; será normalizado para 00:00 local)
 * @param {string} endISO      Fim do intervalo (qualquer horário; será normalizado para 23:30 local)
 * @returns {Array<{time_interval: string, value: number, interpolated?: boolean, missing?: boolean, reason?: string}>}
 */
function interpolateSeries(sorted, deviceName, startISO, endISO) {
  const { maxGapSlots, allowCrossMidnight, includeMissingInOutput } = INTERPOLATION_CONFIG;

  // IMPORTANTE: Se não há dados reais, retorna array vazio (não gera dados fictícios)
  if (!sorted || sorted.length === 0) {
    console.log(`[Interpolation] Device: ${deviceName} - NO REAL DATA, skipping entirely`);
    return [];
  }

  const HALF_HOUR_MS = 30 * 60 * 1000;

  // Agrupar dados reais por dia LOCAL (Brasil, não UTC)
  // Usando getFullYear/getMonth/getDate que retornam valores no timezone local
  const dataByDay = new Map();
  for (const item of sorted) {
    const dt = new Date(item.time_interval);
    // Usa métodos locais para extrair o dia no timezone do Brasil
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const dayKey = `${year}-${month}-${day}`; // dia LOCAL, não UTC
    if (!dataByDay.has(dayKey)) {
      dataByDay.set(dayKey, []);
    }
    dataByDay.get(dayKey).push(item);
  }

  const daysWithData = Array.from(dataByDay.keys()).sort();
  console.log(
    `[Interpolation] Device: ${deviceName} - Days with real data: ${daysWithData.length} (${daysWithData[0]} to ${daysWithData[daysWithData.length - 1]})`
  );

  // Processar APENAS os dias que têm dados reais
  const allResults = [];

  for (const dayKey of daysWithData) {
    const dayData = dataByDay.get(dayKey);

    // Normaliza para slots de 30 min no horário Brasil (UTC-3)
    // Dia local começa às 03:00 UTC e termina às 02:30 UTC do dia seguinte
    // Mas para simplificar, vamos criar slots de 00:00 local até 23:30 local
    // usando Date que já trabalha no timezone local
    const [year, month, day] = dayKey.split('-').map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0); // 00:00 local
    let end = new Date(year, month - 1, day, 23, 30, 0, 0); // 23:30 local
    // Não gerar slots além do endISO (evita dados futuros interpolados)
    const endCap = new Date(endISO);
    if (end > endCap) {
      const snapped = Math.floor(endCap.getTime() / HALF_HOUR_MS) * HALF_HOUR_MS;
      end = new Date(snapped);
    }

    const dayResult = interpolateDay(
      dayData,
      deviceName,
      start,
      end,
      HALF_HOUR_MS,
      maxGapSlots,
      allowCrossMidnight,
      includeMissingInOutput
    );
    allResults.push(...dayResult);
  }

  return allResults;
}

/**
 * Interpola um único dia
 */
function interpolateDay(
  sorted,
  deviceName,
  start,
  end,
  HALF_HOUR_MS,
  maxGapSlots,
  allowCrossMidnight,
  includeMissingInOutput
) {
  // "Snap" de qualquer timestamp para o slot de 30min **mais próximo** (tolerante a segundos/offsets).
  // Trabalha em tempo absoluto (epoch), então independe de UTC/local para arredondamento.
  function canonicalISO30(dt) {
    const ms = dt.getTime();
    const snapped = Math.round(ms / HALF_HOUR_MS) * HALF_HOUR_MS;
    return new Date(snapped).toISOString();
  }

  // Mapa de leituras existentes por slot canônico (ISO), preservando o último valor observado para o slot
  const existingBySlot = new Map();
  for (const item of sorted || []) {
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

  // Identificar todos os gaps na série
  const gaps = identifyGaps(fullSlots, existingBySlot);

  // Log para debug
  if (gaps.length > 0) {
    console.log(
      `[Interpolation] Device: ${deviceName}, Gaps found: ${gaps.length}, Config: max ${maxGapSlots} slots, crossMidnight: ${allowCrossMidnight}`
    );
    gaps.forEach((g, idx) => {
      const canInterp = canInterpolate(g, maxGapSlots, allowCrossMidnight);
      console.log(
        `  Gap ${idx + 1}: ${g.size} slots (${g.startSlot} → ${g.endSlot}) - ${canInterp ? 'WILL INTERPOLATE' : 'SKIP: ' + getSkipReason(g, maxGapSlots, allowCrossMidnight)}`
      );
    });
  }

  // Monta a série final usando leitura existente, valor interpolado, ou missing
  const result = [];
  let interpolatedCount = 0;
  let missingCount = 0;

  for (let i = 0; i < fullSlots.length; i++) {
    const slotISO = fullSlots[i];

    if (existingBySlot.has(slotISO)) {
      // Valor real - sempre incluir
      result.push(existingBySlot.get(slotISO));
    } else {
      // Verificar se este slot faz parte de um gap válido para interpolação
      const gapInfo = findGapForSlot(gaps, i);

      if (gapInfo && canInterpolate(gapInfo, maxGapSlots, allowCrossMidnight)) {
        if (interpolationEnabled) {
          // Interpolação habilitada: calcular valor estimado
          const interpolatedValue = generateInterpolatedValue(slotISO, existingBySlot, fullSlots, i);
          result.push({
            time_interval: slotISO,
            value: interpolatedValue,
            interpolated: true,
            gapSize: gapInfo.size,
          });
          interpolatedCount++;
        } else {
          // Interpolação desabilitada: marcar slot com "=" (gap preenchível mas não estimado)
          result.push({
            time_interval: slotISO,
            value: null,
            interpolated: false,
            equalSign: true,
            gapSize: gapInfo.size,
          });
        }
      } else {
        // Gap muito grande ou cruza meia-noite - marcar como missing
        // Se includeMissingInOutput = false, não adiciona ao resultado (simplesmente pula)
        if (includeMissingInOutput) {
          const reason = gapInfo ? getSkipReason(gapInfo, maxGapSlots, allowCrossMidnight) : 'no_gap_info';
          result.push({
            time_interval: slotISO,
            value: null,
            interpolated: false,
            missing: true,
            reason: reason,
          });
        }
        missingCount++;
      }
    }
  }

  // Log summary
  if (interpolatedCount > 0 || missingCount > 0) {
    const missingAction = includeMissingInOutput ? 'included' : 'skipped';
    console.log(
      `[Interpolation] Device: ${deviceName} - Interpolated: ${interpolatedCount}, Missing: ${missingCount} (${missingAction}), Real: ${existingBySlot.size}`
    );
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

function clampTemperature(val) {
  if (val == null) return { value: null, clamped: false };
  const num = Number(val);
  if (!isFinite(num)) return { value: null, clamped: false };
  let v = num,
    clamped = false;
  const frac = num - Math.trunc(num); // parte decimal original, ex: 12.633 → 0.633
  if (num < clampMin) {
    v = Math.trunc(clampMin) + frac; // ex: 14 + 0.633 = 14.633
    clamped = true;
  } else if (num > clampMax) {
    v = Math.trunc(clampMax) + frac; // ex: 30 + 0.25 = 30.25
    clamped = true;
  }
  return { value: Number(v.toFixed(2)), clamped };
}

// -------- Util --------
// Formata data/hora convertendo UTC para horário Brasil (UTC-3)
function brDatetime(iso) {
  const d = new Date(iso);
  // Usa toLocaleString com timezone America/Sao_Paulo para conversão correta
  // Isso lida automaticamente com horário de verão (quando aplicável)
  return d
    .toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(',', '');
}

// -------- Toast Notification --------
/**
 * _toast — wrapper unificado de toast.
 * Usa window.MyIOLibrary.MyIOToast quando disponível (lib carregada no dashboard),
 * cai em showToast() como fallback para contextos onde a lib não está presente.
 * @param {'success'|'error'|'warning'} type
 * @param {string} message
 * @param {number} [duration]
 */
function _toast(type, message, duration) {
  const T = window.MyIOLibrary?.MyIOToast;
  if (T && typeof T[type] === 'function') {
    T[type](message, duration);
  } else {
    showToast(message, type, duration);
  }
}

/** showToast — implementação local de fallback (usada quando MyIOLibrary não está disponível). */
function showToast(message, type = 'error', duration = 8000) {
  console.log('[TOAST] Mostrando toast:', type, message);

  // Remove toast existente se houver (em qualquer lugar do DOM)
  const existingToasts = document.querySelectorAll('.myio-toast');
  existingToasts.forEach((t) => t.remove());

  const toast = document.createElement('div');
  toast.className = `myio-toast myio-toast-${type}`;
  // Inline styles para garantir visibilidade em qualquer contexto
  toast.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: flex-start;
    gap: 12px;
    min-width: 640px;
    max-width: 960px;
    padding: 16px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1);
    transform: translateX(120%);
    opacity: 0;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const iconBg = type === 'error' ? '#fee2e2' : type === 'warning' ? '#fef3c7' : '#d1fae5';
  const iconColor = type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#059669';
  const iconClass =
    type === 'error'
      ? 'fa-circle-exclamation'
      : type === 'warning'
        ? 'fa-triangle-exclamation'
        : 'fa-circle-check';
  const title = type === 'error' ? 'Erro de Conexão' : type === 'warning' ? 'Aviso' : 'Sucesso';

  toast.innerHTML = `
    <div style="flex-shrink: 0; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: ${iconBg}; color: ${iconColor}; font-size: 18px;">
      <i class="fa-solid ${iconClass}"></i>
    </div>
    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 600; font-size: 14px; color: #111827; margin-bottom: 4px;">${title}</div>
      <div style="font-size: 13px; color: #6b7280; line-height: 1.4;">${message}</div>
    </div>
    <button style="flex-shrink: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: #9ca3af; cursor: pointer; border-radius: 6px;" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  // Tenta adicionar ao body principal da página (não do widget)
  const targetBody = window.top?.document?.body || document.body;
  targetBody.appendChild(toast);
  console.log('[TOAST] Toast adicionado ao DOM');

  // Trigger animation
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  // Auto remove after duration
  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// -------- RPC --------
const RPC_TIMEOUT_MS = 300000; // 300 segundos (5 minutos)

/**
 * sendRPCTemp v2
 * @param {Object} bodiesPerCentral - Mapa { centralId: { devices, dateStart, dateEnd } }
 */
async function sendRPCTemp(bodiesPerCentral) {
  const $http = getHttp();
  const results = {};
  const errors = []; // Track failed centrals

  // Helper: timeout promise
  function timeoutPromise(ms, centralId) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout: Central ${centralId} não respondeu em ${ms / 1000}s`));
      }, ms);
    });
  }

  // Helper: resolve tanto Observable (HttpClient) quanto $http Promise-like
  async function resolveRequest(req) {
    // AngularJS $http: já é thenable e retorna {data,...}
    if (req && typeof req.then === 'function' && typeof req.subscribe !== 'function') {
      return await req; // resp.data estará presente
    }
    // HttpClient (Observable): tem subscribe, não é thenable
    if (req && typeof req.subscribe === 'function') {
      return await new Promise((resolve, reject) => {
        const sub = req.subscribe({
          next: (val) => {
            resolve(val);
            if (sub && sub.unsubscribe) sub.unsubscribe();
          },
          error: (err) => {
            reject(err);
            if (sub && sub.unsubscribe) sub.unsubscribe();
          },
        });
      });
    }
    // fallback bruto
    return req;
  }

  for (const centralId of Object.keys(bodiesPerCentral)) {
    const body = bodiesPerCentral[centralId];

    // v2: Pula centrais sem devices
    if (!body.devices || body.devices.length === 0) {
      console.log('[RPC SKIP]', centralId, '- nenhum device para esta central');
      results[centralId] = [];
      continue;
    }

    try {
      console.log('[RPC]', centralId, 'enviando', body.devices.length, 'devices');
      const req = $http.post(`https://${centralId}.y.myio.com.br/api/rpc/temperature_report`, body);
      // Race entre a requisição e o timeout
      const resp = await Promise.race([resolveRequest(req), timeoutPromise(RPC_TIMEOUT_MS, centralId)]);

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
    } catch (err) {
      console.error('[RPC ERRO]', centralId, err);
      results[centralId] = [];

      // Captura detalhes do erro para o toast
      const isTimeout = err?.message?.includes('Timeout');
      const status = isTimeout ? 'timeout' : err?.status || err?.statusCode || 'unknown';
      const statusText = isTimeout
        ? `Timeout (${RPC_TIMEOUT_MS / 1000}s)`
        : err?.statusText || err?.message || 'Erro desconhecido';
      errors.push({
        centralId,
        status,
        statusText,
        url: `https://${centralId}.y.myio.com.br/api/rpc/temperature_report`,
      });
    }
  }
  return { results, errors };
}

// -------- Exportações (mantive seu PDF/CSV, só higienizei) --------
function _buildExportFilename(ext) {
  const _fd = (d) =>
    `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  const now = new Date();
  const periodo = startDate && endDate ? `${_fd(startDate)}-a-${_fd(endDate)}` : 'sem-periodo';
  const emitido = `${_fd(now)}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  return `relatorio_${_customerSlug}_temperatura_periodo-${periodo}-emitido-em-${emitido}.${ext}`;
}

function exportToCSV(rowsInput) {
  if (!rowsInput?.length) {
    openErrorModal('Sem dados', 'Não há dados para exportar.');
    return;
  }
  const rows = [['Nome do Dispositivo', 'Temperatura (°C)', 'Data']];
  rowsInput.forEach((r) => {
    // Garantir 2 casas decimais: valores numéricos com vírgula (Excel PT-BR); = e - inalterados
    let temp = r.temperature;
    if (temp !== '=' && temp !== '-' && temp != null) {
      const num = parseFloat(temp);
      if (!isNaN(num)) temp = num.toFixed(2).replace('.', ',');
    }
    rows.push([r.deviceName, temp, r.reading_date]);
  });
  const bom = '\uFEFF'; // UTF-8 BOM para Excel reconhecer acentuação
  const csv = bom + rows.map((e) => e.join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = _buildExportFilename('csv');
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 1000);
}

function exportToXLS(rowsInput) {
  if (!rowsInput?.length) {
    openErrorModal('Sem dados', 'Não há dados para exportar.');
    return;
  }
  const rows = [['Nome do Dispositivo', 'Temperatura (°C)', 'Data']];
  rowsInput.forEach((r) => {
    let temp = r.temperature;
    if (temp !== '=' && temp !== '-' && temp != null) {
      const num = parseFloat(temp);
      if (!isNaN(num)) temp = num.toFixed(2).replace('.', ',');
    }
    rows.push([r.deviceName, temp, r.reading_date]);
  });
  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const xmlRows = rows
    .map(
      (row) =>
        '<Row>' +
        row.map((c) => '<Cell><Data ss:Type="String">' + esc(c) + '</Data></Cell>').join('') +
        '</Row>'
    )
    .join('');
  const xml =
    '<?xml version="1.0"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Worksheet ss:Name="Temperaturas"><Table>' +
    xmlRows +
    '</Table></Worksheet></Workbook>';
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = _buildExportFilename('xls');
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 1000);
}

// ---- PDF helpers ----

function _pdfSummaryFromData(data) {
  var byDev = {};
  data.forEach(function (r) {
    if (!byDev[r.deviceName]) byDev[r.deviceName] = { real: 0, missing: 0 };
    if (r.temperature !== '-' && r.temperature !== '=') byDev[r.deviceName].real++;
    else byDev[r.deviceName].missing++;
  });
  var devices = Object.keys(byDev).map(function (name) {
    var v = byDev[name];
    var total = v.real + v.missing;
    var pct = total ? parseFloat(((v.missing / total) * 100).toFixed(1)) : 0;
    return { name: name, real: v.real, missing: v.missing, total: total, pct: pct };
  }).sort(function (a, b) { return b.pct - a.pct; });
  var totalReal = devices.reduce(function (s, d) { return s + d.real; }, 0);
  var totalMissing = devices.reduce(function (s, d) { return s + d.missing; }, 0);
  var totalSlots = devices.reduce(function (s, d) { return s + d.total; }, 0);
  var overallPct = totalSlots ? parseFloat(((totalMissing / totalSlots) * 100).toFixed(1)) : 0;
  return { devices: devices, totalReal: totalReal, totalMissing: totalMissing, totalSlots: totalSlots, overallPct: overallPct };
}

function _pdfBuildCover(doc, cov, pw, ph, mg, purple, pdfDate, pdfTime, periodStr, logoSrc) {
  // ── Header bar ──────────────────────────────────────────────
  doc.setFillColor(purple[0], purple[1], purple[2]);
  doc.rect(0, 0, pw, 50, 'F');
  var logoH = 22, logoW = Math.round(logoH * (512 / 194));
  doc.addImage(logoSrc, 'PNG', mg, 18, logoW, logoH, 'myio-logo');
  var tx = mg + logoW + 12;
  // Bloco de texto deslocado ~4mm para baixo dentro da barra (50mm)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Relatório de Temperaturas', tx, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('MYIO Smart Hospital', tx, 25);
  doc.text('Complexo Hospitalar Municipal Souza Aguiar', tx, 33);
  doc.setFontSize(9);
  doc.text('Emitido em ' + pdfDate + ' às ' + pdfTime, tx, 42);

  // ── Info bar ────────────────────────────────────────────────
  doc.setFillColor(240, 232, 255);
  doc.rect(0, 50, pw, 12, 'F');
  doc.setTextColor(92, 48, 125);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  var infoTxt = periodStr
    ? ('Período consultado: ' + periodStr.replace(' \u2192 ', ' até '))
    : 'Período: não definido';
  doc.text(infoTxt, pw / 2, 58, { align: 'center' });

  // ── KPI cards ───────────────────────────────────────────────
  var kpis = [
    { label: 'Dispositivos',   value: String(cov.devices.length),  color: purple },
    { label: 'Leituras reais', value: String(cov.totalReal),        color: [22, 163, 74] },
    { label: 'Slots sem dados', value: String(cov.totalMissing),   color: cov.totalMissing > 0 ? [220, 38, 38] : [107, 114, 128] },
    { label: 'Perda geral',    value: cov.overallPct + '%',         color: cov.overallPct > 0 ? [220, 38, 38] : [22, 163, 74] },
  ];
  var cardGap = 4, cardW = (pw - 2 * mg - 3 * cardGap) / 4;
  var cardY = 67, cardH = 24;
  kpis.forEach(function (kpi, i) {
    var cx2 = mg + i * (cardW + cardGap);
    doc.setFillColor(249, 250, 251);
    doc.rect(cx2, cardY, cardW, cardH, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.rect(cx2, cardY, cardW, cardH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, cx2 + cardW / 2, cardY + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(kpi.label, cx2 + cardW / 2, cardY + 20, { align: 'center' });
  });

  // ── Device summary table — 2 colunas ───────────────────────
  var ty = cardY + cardH + 6;
  var tH = 6;
  var colGap = 5; // espaço entre os dois grupos
  var halfW = (pw - 2 * mg - colGap) / 2; // largura de cada grupo: ~92.5mm

  // Sub-colunas de cada grupo (dentro de halfW)
  var _cPct = 16, _cMiss = 18, _cReal = 18;
  var _cName = halfW - _cPct - _cMiss - _cReal; // ~40.5mm

  // Offsets X para grupo esquerdo e direito
  var _lx = mg;                       // início grupo esquerdo
  var _rx = mg + halfW + colGap;       // início grupo direito

  function _colXsFor(ox) {
    return [ox, ox + _cName, ox + _cName + _cReal, ox + _cName + _cReal + _cMiss];
  }
  var _colWs = [_cName, _cReal, _cMiss, _cPct];
  var _hdrs  = ['Dispositivo', 'Leituras', 'Sem dados', 'Perda'];

  function _drawHeader(ox) {
    var xs = _colXsFor(ox);
    doc.setFillColor(purple[0], purple[1], purple[2]);
    doc.rect(ox, ty, halfW, 6.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    _hdrs.forEach(function (lbl, i) {
      var ax = i === 0 ? xs[i] + 3 : xs[i] + _colWs[i] / 2;
      doc.text(lbl, ax, ty + 4.5, { align: i === 0 ? 'left' : 'center' });
    });
    doc.setFont('helvetica', 'normal');
  }
  _drawHeader(_lx);
  _drawHeader(_rx);
  ty += 6.5;

  doc.setDrawColor(243, 244, 246);

  var maxRows = Math.floor((ph - 14 - ty) / tH);
  var half    = Math.ceil(cov.devices.length / 2);
  var nRows   = Math.min(half, maxRows);
  var truncated = Math.max(0, cov.devices.length - nRows * 2);

  function _drawDevRow(dev, ox, rowY, shade) {
    if (!dev) return;
    var xs = _colXsFor(ox);
    if (shade) {
      doc.setFillColor(248, 250, 252);
      doc.rect(ox, rowY, halfW, tH, 'F');
    }
    var lc = dev.pct === 0 ? [22, 163, 74]
      : dev.pct <= 5  ? [202, 138, 4]
      : dev.pct <= 15 ? [234, 88, 12]
      :                 [220, 38, 38];
    doc.setFontSize(6.5);
    doc.setTextColor(17, 24, 39);
    doc.text(dev.name,           xs[0] + 3,              rowY + 4, { maxWidth: _cName - 6 });
    doc.text(String(dev.real),   xs[1] + _colWs[1] / 2,  rowY + 4, { align: 'center' });
    doc.text(String(dev.missing),xs[2] + _colWs[2] / 2,  rowY + 4, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(lc[0], lc[1], lc[2]);
    doc.text(dev.pct + '%',      xs[3] + _colWs[3] / 2,  rowY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.line(ox, rowY + tH, ox + halfW, rowY + tH);
  }

  for (var ri = 0; ri < nRows; ri++) {
    var shade = ri % 2 === 0;
    _drawDevRow(cov.devices[ri],        _lx, ty, shade);
    _drawDevRow(cov.devices[ri + nRows], _rx, ty, shade);
    ty += tH;
  }

  if (truncated > 0) {
    doc.setFontSize(6.5);
    doc.setTextColor(107, 114, 128);
    doc.text('... e mais ' + truncated + ' dispositivo(s) — veja o detalhamento nas páginas seguintes.', mg, ty + 4);
  }
}

async function exportToPDF(data) {
  if (!data?.length) {
    openErrorModal('Sem dados', 'Não há dados para exportar.');
    return;
  }

  // Pré-carrega logo UMA vez como base64 — evita centenas de requests no loop do rodapé
  const _LOGO_URL = 'https://dashboard.myio-bas.com/api/images/public/TAfpmF6jEKPDi6hXHbnMUT8MWOHv5lKD';
  let _logoSrc = _LOGO_URL;
  try {
    const _resp = await fetch(_LOGO_URL);
    const _blob = await _resp.blob();
    _logoSrc = await new Promise((res) => {
      const fr = new FileReader();
      fr.onloadend = () => res(fr.result);
      fr.readAsDataURL(_blob);
    });
  } catch { /* fallback para URL se fetch falhar */ }

  const doc = new window.jspdf.jsPDF();
  const pw = doc.internal.pageSize.width;
  const ph = doc.internal.pageSize.height;
  const purple = [92, 48, 125];
  const m = 10;

  const _pdfNow = new Date();
  const _pdfDate = _pdfNow.toLocaleDateString('pt-BR');
  const _pdfTime = _pdfNow.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const _pdfPeriodStr = (startDate && endDate)
    ? `${new Date(startDate).toLocaleDateString('pt-BR')} → ${new Date(endDate).toLocaleDateString('pt-BR')}`
    : '';

  // Summary: prefer _smState.report (grid-accurate), fallback to raw calc
  const _smRep = (_smState && _smState.report) ? _smState.report : null;
  const cov = _smRep ? {
    devices: _smRep.devices.map(function (d) {
      return { name: d.label, real: d.realSlots, missing: d.missingSlots, pct: d.lossPct };
    }),
    totalReal: _smRep.totalReal,
    totalMissing: _smRep.totalMissing,
    totalSlots: _smRep.totalSlots,
    overallPct: _smRep.overallLossPct,
  } : _pdfSummaryFromData(data);

  // === PÁGINA 1: CAPA ===
  _pdfBuildCover(doc, cov, pw, ph, m, purple, _pdfDate, _pdfTime, _pdfPeriodStr, _logoSrc);

  // === PÁGINAS DE DADOS (sem header repetido — direto à tabela) ===
  doc.addPage();

  const _rowH = 7;   // altura da linha de dados (mm)
  const _rowFS = 8;  // font size dos dados (pt)
  const col = (pw - 2 * m) / 3;

  // Cabeçalho da tabela
  let y = 12;
  doc.setFillColor(...purple);
  doc.rect(m, y, pw - 2 * m, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  ['Dispositivo', 'Temperatura (ºC)', 'Data/Hora'].forEach((txt, i) =>
    doc.text(txt, m + i * col + col / 2, y + 5.5, { align: 'center' })
  );
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(_rowFS);
  doc.setTextColor(0, 0, 0);

  // Linhas de dados
  const _pdfFooterH = 16;
  data.forEach((r, i) => {
    if (y > ph - _pdfFooterH - 8) {
      doc.addPage();
      y = 12;
    }
    if (i % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(m, y, pw - 2 * m, _rowH, 'F');
    }
    doc.setFontSize(_rowFS);
    doc.setTextColor(0, 0, 0);
    [r.deviceName, r.temperature, r.reading_date].forEach((txt, ci) =>
      doc.text(String(txt), m + ci * col + col / 2, y + 5, { align: 'center' })
    );
    y += _rowH;
  });

  // === RODAPÉ PREMIUM EM TODAS AS PÁGINAS ===
  const _totalPages = doc.internal.getNumberOfPages();
  const _fBarH = 14;
  const _fBarY = ph - _fBarH;
  const _fLogoH = 5.5;
  const _fLogoW = Math.round(_fLogoH * (512 / 194));
  const _fLogoX = m;
  const _fLogoY = _fBarY + (_fBarH - _fLogoH) / 2;
  const _fTextY = _fBarY + _fBarH / 2 + 1.5;
  const _pdfPeriodPart = _pdfPeriodStr
    ? ` • Período de ${_pdfPeriodStr.replace(' → ', ' até ')}`
    : '';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  for (let _p = 1; _p <= _totalPages; _p++) {
    doc.setPage(_p);
    doc.setFillColor(...purple);
    doc.rect(0, _fBarY, pw, _fBarH, 'F');
    doc.addImage(_logoSrc, 'PNG', _fLogoX, _fLogoY, _fLogoW, _fLogoH, 'myio-logo');
    doc.setTextColor(255, 255, 255);
    const _fCenter = `MYIO Smart Hospital  •  Resumo de Temperatura  •  Emitido em ${_pdfDate} às ${_pdfTime}${_pdfPeriodPart}`;
    doc.text(_fCenter, pw / 2, _fTextY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(`Pág ${_p} / ${_totalPages}`, pw - m, _fTextY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
  }
  doc.setPage(_totalPages);
  doc.save(_buildExportFilename('pdf'));
}

// -------- Helper para dividir datas em chunks de N dias (trabalha com timezone Brasil) --------
function createDateChunks(startDate, endDate, chunkSizeDays = 5) {
  const chunks = [];
  // Mantém o startDate como veio (já está em 03:00 UTC = 00:00 Brasil)
  const current = new Date(startDate);

  while (current <= endDate) {
    const chunkStart = new Date(current);

    // Chunk end: avança N dias e vai até 02:59:59 UTC do dia seguinte (23:59:59 Brasil)
    const chunkEnd = new Date(current);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkSizeDays);
    chunkEnd.setUTCHours(2, 59, 59, 999); // 02:59 UTC = 23:59 Brasil

    // Não ultrapassar a data final
    if (chunkEnd > endDate) {
      chunkEnd.setTime(endDate.getTime());
    }

    chunks.push({
      start: new Date(chunkStart),
      end: new Date(chunkEnd),
    });

    // Avança para o próximo chunk (próximo dia Brasil = +24h)
    current.setUTCDate(current.getUTCDate() + chunkSizeDays);
  }

  console.log('[UTC-FIX-V5] createDateChunks gerou', chunks.length, 'chunk(s)');
  if (chunks.length > 0) {
    console.log(
      '[UTC-FIX-V5] Primeiro chunk: start=',
      chunks[0].start.toISOString(),
      'end=',
      chunks[0].end.toISOString()
    );
  }

  return chunks;
}

// -------- Data pipeline principal --------
// -------- Data pipeline principal --------
async function getData() {
  if (!startDate || !endDate) {
    openErrorModal('Período não selecionado', 'Selecione as datas de início e fim para gerar o relatório.');
    return;
  }

  const centrals = self.ctx.$scope.centralIdList || [];
  if (!Array.isArray(centrals) || centrals.length === 0) {
    console.warn('[getData] Nenhum centralId disponível em $scope.centralIdList.');
  }

  // Use selected devices from filter (or all if none selected)
  const selectedDevices = getSelectedDevices();
  if (selectedDevices.length === 0) {
    openErrorModal('Nenhum ambiente', 'Selecione ao menos um ambiente para gerar o relatório.');
    return;
  }
  console.log('[getData] Devices selecionados:', selectedDevices.length, '/', deviceList.length);
  self.ctx.$scope.hasQueried = true;

  // =====================================================
  // NORMALIZAÇÃO UTC - v2 (2026-02-11)
  // O usuário seleciona uma DATA LOCAL no calendário (ex: 11/02/2026).
  // Queremos enviar essa mesma data como UTC meia-noite: 2026-02-11T00:00:00.000Z
  // NÃO queremos conversão de timezone (ex: 2026-02-10T03:00:00.000Z está ERRADO)
  // =====================================================

  // Debug: log valores originais do date picker
  console.log('[UTC-FIX-V5] startDate objeto:', startDate);
  console.log('[UTC-FIX-V5] startDate.toISOString():', startDate?.toISOString?.());
  console.log(
    '[UTC-FIX-V5] startDate.getDate():',
    startDate?.getDate?.(),
    'getMonth():',
    startDate?.getMonth?.(),
    'getFullYear():',
    startDate?.getFullYear?.()
  );
  console.log('[UTC-FIX-V5] endDate objeto:', endDate);
  console.log('[UTC-FIX-V5] endDate.toISOString():', endDate?.toISOString?.());
  console.log(
    '[UTC-FIX-V5] endDate.getDate():',
    endDate?.getDate?.(),
    'getMonth():',
    endDate?.getMonth?.(),
    'getFullYear():',
    endDate?.getFullYear?.()
  );

  // Extrai componentes LOCAL (ano/mês/dia) e converte para UTC real do Brasil
  // Brasil = UTC-3, então 00:00 local = 03:00 UTC
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const startDay = startDate.getDate();

  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth();
  const endDay = endDate.getDate();

  // Para pegar dados do "dia D" no Brasil:
  // - Início: 00:00 local do dia D = 03:00 UTC do dia D (adiciona 3h)
  // - Fim: 23:59:59 local do dia D = 02:59:59 UTC do dia D+1 (dia seguinte às 02:59 UTC)
  const s = new Date(Date.UTC(startYear, startMonth, startDay, 3, 0, 0, 0)); // 03:00 UTC = 00:00 Brasil
  let e = new Date(Date.UTC(endYear, endMonth, endDay + 1, 2, 59, 59, 999)); // 02:59 UTC dia seguinte = 23:59 Brasil

  console.log('[UTC-FIX-V5] Dia selecionado:', startDay, '/', startMonth + 1, '/', startYear);
  console.log('[UTC-FIX-V5] START (00:00 Brasil):', s.toISOString());
  console.log('[UTC-FIX-V5] END (23:59 Brasil):', e.toISOString());

  // Limita endDate ao horário atual em UTC real
  // Se são 14:12 local Brasil, em UTC são 17:12
  const now = new Date();
  const nowUTC = new Date(now.getTime()); // já está em UTC internamente
  console.log(
    '[UTC-FIX-V5] Horário local:',
    now.getHours() + ':' + now.getMinutes(),
    '-> UTC real:',
    nowUTC.toISOString()
  );

  if (e > nowUTC) {
    e = new Date(nowUTC);
    // Arredonda para o slot de 30min anterior mais próximo
    const mins = e.getUTCMinutes();
    e.setUTCMinutes(mins < 30 ? 0 : 30, 0, 0);
    console.log('[UTC-FIX-V5] END limitado ao horário atual UTC:', e.toISOString());
  }

  console.log('[UTC-FIX-V5] === PAYLOAD FINAL ===');
  console.log('[UTC-FIX-V5] dateStart:', s.toISOString());
  console.log('[UTC-FIX-V5] dateEnd:', e.toISOString());
  const keyStart = s.toISOString();
  const keyEnd = e.toISOString();
  const queryKey = `${centrals.slice().sort().join(',')}|${keyStart}|${keyEnd}`;

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

  // Limpa erros de conexão anteriores ao iniciar nova busca
  self.ctx.$scope.rpcConnectionErrors = [];
  self.ctx.detectChanges();

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

  // Chunking em 31 dias (cobre meses completos de até 31 dias em um único chunk)
  const dateChunks = createDateChunks(s, e, 31);
  const totalChunks = dateChunks.length;

  const dd = (d) => String(d.getDate()).padStart(2, '0');
  const mm = (d) =>
    String(d.getMonth() + 1)
      .toString()
      .padStart(2, '0');

  try {
    let allProcessed = [];
    console.log('[OVERRIDE] getData: _manualOverrides =', _manualOverrides
      ? (_manualOverrides.device_list_interval_values || []).length + ' devices'
      : 'null');
    const overrideMap = buildOverrideMap(_manualOverrides); // manual override lookup
    console.log('[OVERRIDE] getData: overrideMap.size =', overrideMap.size);
    const globalMissingMap = {};
    const devicesSeen = {}; // continuidade após 1ª aparição
    const allRpcErrors = []; // Acumula erros de conexão com centrais

    for (let chunkIndex = 0; chunkIndex < dateChunks.length; chunkIndex++) {
      const chunk = dateChunks[chunkIndex];
      const chunkNumber = chunkIndex + 1;

      const rangeText = `${dd(chunk.start)}/${mm(chunk.start)} a ${dd(chunk.end)}/${mm(chunk.end)}`;
      const chunkStatus = `Aguardando dados do Gateway do intervalo ${rangeText} (${chunkNumber}/${totalChunks})`;
      const progress = 10 + (chunkIndex / totalChunks) * 60;
      setPremiumLoading(true, chunkStatus, progress);

      // v2: Construir body por central - cada central só recebe seus próprios devices
      const bodiesPerCentral = {};
      for (const centralId of centrals) {
        const devicesForCentral = selectedDevices.filter((dev) => deviceToCentralMap[dev] === centralId);
        bodiesPerCentral[centralId] = {
          devices: devicesForCentral,
          dateStart: chunk.start.toISOString(),
          dateEnd: chunk.end.toISOString(),
        };
      }

      // Log claro do payload que será enviado
      console.log('[v2] === PAYLOAD POR CENTRAL ===');
      console.log('[v2] dateStart:', chunk.start.toISOString());
      console.log('[v2] dateEnd:', chunk.end.toISOString());
      for (const centralId of centrals) {
        console.log(`[v2] ${centralId}: ${bodiesPerCentral[centralId].devices.length} devices`);
      }

      const { results: rpcResponses, errors: rpcErrors } = await sendRPCTemp(bodiesPerCentral);

      // Se qualquer central falhou: abortar tudo, sem renderizar dados parciais
      if (rpcErrors && rpcErrors.length > 0) {
        allRpcErrors.push(...rpcErrors);
        console.warn(
          '[DR] Aborting report — central(s) failed:',
          rpcErrors.map((e) => e.centralId)
        );
        break; // interrompe loop de chunks
      }

      for (const [centralId, readings] of Object.entries(rpcResponses || {})) {
        const arrReadings = Array.isArray(readings) ? readings : [];
        console.log(`[CHUNK ${chunkNumber}/${totalChunks}]`, centralId, 'leituras:', arrReadings.length);

        // v2.1: Normalização condicional por central
        // Centrais com backend ORIGINAL precisam de -3h de correção
        // O backend original usa AT TIME ZONE que adiciona +3h ao UTC real
        // Centrais com backend v3.1 retornam UTC direto (sem correção)
        const CENTRALS_WITH_OLD_BACKEND = [];

        const needsLegacyNormalization = CENTRALS_WITH_OLD_BACKEND.includes(centralId);
        const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

        const normalizedReadings = (Array.isArray(readings) ? readings : []).map((r) => {
          if (needsLegacyNormalization && r.time_interval) {
            const originalTime = new Date(r.time_interval);
            const normalizedTime = new Date(originalTime.getTime() - THREE_HOURS_MS);
            return { ...r, time_interval: normalizedTime.toISOString() };
          }
          return r;
        });

        if (normalizedReadings.length > 0) {
          const normLabel = needsLegacyNormalization ? '[LEGACY -3h]' : '[UTC NATIVE]';
          console.log(
            `${normLabel} Primeiro registro:`,
            normalizedReadings[0].time_interval,
            needsLegacyNormalization ? `(original: ${readings[0].time_interval})` : ''
          );
          console.log(
            `${normLabel} Último registro:`,
            normalizedReadings[normalizedReadings.length - 1].time_interval
          );
        }

        const byDevice = _.groupBy(
          normalizedReadings,
          (r) =>
            r.device_label || r.deviceLabel || r.label || r.deviceName || r.device || r.name || 'desconhecido'
        );

        const deviceKeys = Object.keys(byDevice);
        console.log(
          `[CHUNK ${chunkNumber}/${totalChunks}] ${centralId} devices:`,
          deviceKeys.length,
          deviceKeys.slice(0, 8)
        );

        // União: devices do widget ∪ devices que efetivamente chegaram do backend
        const unionDevices = new Set([...deviceList, ...Object.keys(byDevice)]);

        for (const devName of unionDevices) {
          const arr = (byDevice[devName] || [])
            .filter(
              (r) => r.value !== 'SEM DADOS' && r.value != null && r.value !== '' && Number(r.value) !== 0
            )
            .sort((a, b) => new Date(a.time_interval) - new Date(b.time_interval));

          if (arr.length) devicesSeen[devName] = true;

          // Continuidade após 1ª aparição:
          // - se nunca apareceu e não há leitura neste chunk -> pula
          if (!devicesSeen[devName] && arr.length === 0) continue;

          // Limita a interpolação pelo último dado REAL do device (não pelo chunk.end)
          // Isso evita criar slots interpolados para horários sem dados reais
          const firstRealData = arr.length > 0 ? arr[0].time_interval : null;
          const lastRealData = arr.length > 0 ? arr[arr.length - 1].time_interval : null;

          // Se não há dados reais, pula a interpolação
          if (!firstRealData || !lastRealData) continue;

          const interpolated = interpolateSeries(
            arr,
            devName,
            firstRealData, // Começa do primeiro dado real
            lastRealData // Termina no último dado real
          );

          // Mapear lacunas (slots interpolados)
          const miss = interpolated.filter((r) => r.interpolated).map((r) => r.time_interval);
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
            // ── Manual Override check ────────────────────────────────────────
            let finalValue = value;
            let finalEqualSign = !!r.equalSign;
            let isManual = false;
            const isSentinel =
              finalValue == null ||
              finalEqualSign ||
              (finalValue != null && Math.abs(finalValue - 17.0) < 0.001);
            if (isSentinel && overrideMap.size > 0) {
              const overrideKey = devName.split(' ')[0]; // normalize to deviceCentralName
              const devMap = overrideMap.get(overrideKey);
              console.log('[OVERRIDE] sentinel slot: devName=' + devName +
                ' overrideKey=' + overrideKey +
                ' time_interval=' + r.time_interval +
                ' devMapFound=' + !!devMap +
                ' finalValue=' + finalValue);
              if (devMap) {
                const ov = devMap.get(r.time_interval);
                console.log('[OVERRIDE] devMap lookup: timeUTC=' + r.time_interval + ' ov=' + ov);
                if (ov !== undefined && ov !== null) {
                  const { value: ov2 } = clampTemperature(ov);
                  finalValue = ov2;
                  finalEqualSign = false;
                  isManual = true;
                  console.log('[OVERRIDE] ✓ aplicado: ' + overrideKey + ' @ ' + r.time_interval + ' = ' + ov2);
                }
              } else {
                console.warn('[OVERRIDE] ✗ device não encontrado no overrideMap: "' + overrideKey + '"',
                  'chaves disponíveis:', Array.from(overrideMap.keys()));
              }
            } else if (isSentinel) {
              console.log('[OVERRIDE] sentinel slot sem overrideMap (vazio): devName=' + devName + ' time=' + r.time_interval);
            }
            // ────────────────────────────────────────────────────────────────
            allProcessed.push({
              centralId,
              deviceName: deviceLabel,
              reading_date: brDatetime(r.time_interval),
              sort_ts: new Date(r.time_interval).getTime(),
              temperature: finalEqualSign ? '=' : finalValue == null ? '-' : finalValue.toFixed(2),
              interpolated: !!r.interpolated && !isManual,
              equalSign: finalEqualSign,
              correctedBelowThreshold: !!clamped && !isManual,
              missing: !!r.missing && !isManual,
              missingReason: !isManual ? (r.reason || null) : null,
              gapSize: !isManual ? (r.gapSize || null) : null,
              isManual,
            });
          }
        }
      }
    }

    setPremiumLoading(true, LOADING_STATES.CONSOLIDATING, 75);

    // ⚠️ NOTA: Backfill de labels DESABILITADO
    // Labels sem dados reais NÃO aparecem no relatório (não geramos dados 100% fictícios)
    const expectedLabels = self.ctx.$scope.expectedLabels || [];
    if (expectedLabels.length > 0) {
      const labelsInReport = new Set(allProcessed.map((r) => r.deviceName));
      const missingLabels = expectedLabels.filter((label) => !labelsInReport.has(label));

      if (missingLabels.length > 0) {
        // Apenas log - NÃO geramos dados fictícios para labels sem telemetria real
        console.warn(
          '[BACKFILL DISABLED] Labels sem dados reais (NÃO incluídos no relatório):',
          missingLabels
        );
      } else {
        console.log('[LABELS] Todos os labels esperados têm dados reais no relatório ✓');
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

    // Se houve erros: exibir banner, não renderizar nenhum dado
    if (allRpcErrors.length > 0) {
      const uniqueErrors = [...new Map(allRpcErrors.map((e) => [e.centralId, e])).values()];
      self.ctx.$scope.rpcConnectionErrors = uniqueErrors.map((e) => {
        let statusInfo;
        if (e.status === 'timeout') statusInfo = `Timeout após ${RPC_TIMEOUT_MS / 1000}s`;
        else if (e.status === 502) statusInfo = '502 Bad Gateway';
        else if (e.status === 503) statusInfo = '503 Serviço indisponível';
        else if (e.status === 0) statusInfo = 'Sem resposta (CORS/Rede)';
        else statusInfo = `Status ${e.status}`;
        return { centralId: e.centralId, centralName: CENTRAL_NAMES[e.centralId] || null, statusInfo };
      });
      self.ctx.$scope.dados = [];
      self.ctx.$scope.loading = false;
      setPremiumLoading(false);
      // Permite nova tentativa ao clicar em "Tentar novamente"
      _lastQueryKey = null;
      self.ctx.detectChanges();
      return;
    }

    // UI: finalizar (somente quando todas as centrais responderam com sucesso)
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
    openErrorModal('Erro ao carregar', 'Ocorreu um erro ao carregar os dados. Tente novamente.');
    setPremiumLoading(false);
    self.ctx.$scope.loading = false;
    // Importante: permite nova tentativa
    _lastQueryKey = null;
  } finally {
    _inFlight = false;
  }
}

// -------- View mode & render --------
function renderData(data) {
  const s = self.ctx.$scope;
  s.totalReadings = data.filter((r) => r.temperature !== '-').length;
  s.totalDevices = new Set(data.map((r) => r.deviceName)).size;
  if (s.isCardView) {
    renderCardView(data);
  } else {
    renderListView(data);
  }
}

function renderCardView(data) {
  const grouped = _.groupBy(data, 'deviceName');
  self.ctx.$scope.groupedData = grouped;
  // por padrão, cards recolhidos
  self.ctx.$scope.expandedDevices = {};
  self.ctx.detectChanges();
}

function renderListView(data) {
  self.ctx.$scope.dados = data;
  self.ctx.detectChanges();
}

function toggleViewMode(mode) {
  const s = self.ctx.$scope;
  // ao clicar em Cards, sempre recolher tudo
  if (mode === 'card') {
    s.isCardView = true;
    s.expandedDevices = {};
    renderCardView(s.dados || []);
  } else {
    s.isCardView = false;
    renderListView(s.dados || []);
  }
  self.ctx.detectChanges();
}

// -------- Util de data picker --------
function handleStartDateChange(event) {
  startDate = event?.value || null; // kept for backward-compat (no longer called from template)
}

function handleEndDateChange(event) {
  endDate = event?.value || null; // kept for backward-compat
}

function clearDateRange() {
  startDate = null;
  endDate = null;
  // Clear the picker input display directly (setDates rejects empty strings)
  var pickerInput = (
    self.ctx.$container && self.ctx.$container[0] ? self.ctx.$container[0] : document
  ).querySelector('input[name="startDatetimes"]');
  if (pickerInput) pickerInput.value = '';
  const s = self.ctx.$scope;
  s.dados = [];
  s.groupedData = {};
  s.totalReadings = 0;
  s.totalDevices = 0;
  s.hasQueried = false;
  self.ctx.detectChanges();
}

// -------- Device Filter Functions --------
function initDeviceSelectionList() {
  devicesSelectionList = deviceList.map((name) => ({
    name: name,
    label: deviceNameLabelMap[name.split(' ')[0]] || name,
    selected: true, // default: all selected
  }));
  updateDeviceFilterScope();
}

function updateDeviceFilterScope() {
  const s = self.ctx.$scope;
  s.devicesSelectionList = devicesSelectionList;
  s.filteredDevicesList = getFilteredDevicesList();
  s.selectedDevicesCount = devicesSelectionList.filter((d) => d.selected).length;
  s.allDevicesCount = devicesSelectionList.length;
  s.showDeviceFilter = showDeviceFilter;
  s.deviceFilterText = deviceFilterText;
}

function getFilteredDevicesList() {
  if (!deviceFilterText || deviceFilterText.trim() === '') {
    return devicesSelectionList;
  }
  const searchTerm = deviceFilterText.toLowerCase().trim();
  return devicesSelectionList.filter(
    (d) => d.name.toLowerCase().includes(searchTerm) || d.label.toLowerCase().includes(searchTerm)
  );
}

function toggleDeviceFilter() {
  showDeviceFilter = !showDeviceFilter;
  updateDeviceFilterScope();
  self.ctx.detectChanges();
}

function onDeviceFilterTextChange(value) {
  deviceFilterText = value || '';
  updateDeviceFilterScope();
  self.ctx.detectChanges();
}

function toggleDeviceSelection(device) {
  const found = devicesSelectionList.find((d) => d.name === device.name);
  if (found) {
    found.selected = !found.selected;
  }
  updateDeviceFilterScope();
  self.ctx.detectChanges();
}

function selectAllDevices() {
  const filtered = getFilteredDevicesList();
  filtered.forEach((d) => {
    const found = devicesSelectionList.find((x) => x.name === d.name);
    if (found) found.selected = true;
  });
  updateDeviceFilterScope();
  self.ctx.detectChanges();
}

function deselectAllDevices() {
  const filtered = getFilteredDevicesList();
  filtered.forEach((d) => {
    const found = devicesSelectionList.find((x) => x.name === d.name);
    if (found) found.selected = false;
  });
  updateDeviceFilterScope();
  self.ctx.detectChanges();
}

function applyDeviceFilter() {
  showDeviceFilter = false;
  updateDeviceFilterScope();
  self.ctx.detectChanges();
}

function getSelectedDevices() {
  return devicesSelectionList.filter((d) => d.selected).map((d) => d.name);
}

function applyDateRange() {
  if (!startDate || !endDate) {
    openErrorModal('Período não selecionado', 'Selecione as datas de início e fim para gerar o relatório.');
    return;
  }
  const selectedDevices = getSelectedDevices();
  if (selectedDevices.length === 0) {
    openErrorModal('Nenhum ambiente', 'Selecione ao menos um ambiente para gerar o relatório.');
    return;
  }
  getData();
}

// -------- Modal de bloqueio --------
function openBlockModal(title, msg) {
  const s = self.ctx.$scope;
  s.blockTitle = title;
  s.blockMessage = msg;
  s.isBlocking = true;
  self.ctx.detectChanges();
}

function closeBlockModal() {
  const s = self.ctx.$scope;
  s.isBlocking = false;
  self.ctx.detectChanges();
}

// -------- Modal de erro de validação --------
function openErrorModal(title, msg) {
  const s = self.ctx.$scope;
  s.errorTitle = title;
  s.errorMessage = msg;
  s.isErrorModal = true;
  self.ctx.detectChanges();
}

function closeErrorModal() {
  const s = self.ctx.$scope;
  s.isErrorModal = false;
  self.ctx.detectChanges();
}

// -------- Init --------
function insertCurrentDate() {
  const el = document.getElementById('issue-date');
  if (el) {
    el.innerText = new Date().toLocaleDateString('pt-BR');
  }
}

self.onInit = function () {
  insertCurrentDate();

  // ======= VERSÃO DO WIDGET - VERIFICAR NO CONSOLE =======
  console.log('=============================================');
  console.log('TabelaTemp5 v3.1.1 - HYBRID (2026-02-13)');
  console.log('Backend: Suporta v3.1 (UTC) e original (-3h)');
  console.log('Fix: Offset corrigido de -6h para -3h');
  console.log('Fix: brDatetime converte UTC->Brasil');
  console.log('=============================================');
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

  // ⚠️ MELHORIA 1: Extrair centralIds E mapear device -> centralId
  const rawCentralIds = [];
  const rawLabels = [];
  deviceToCentralMap = {}; // Reset do mapa

  (Array.isArray(self.ctx.data) ? self.ctx.data : []).forEach((item) => {
    // Verificar se é um item com dataKey.name = 'centralId'
    if (
      item &&
      item.dataKey &&
      item.dataKey.name === 'centralId' &&
      item.data &&
      item.data[0] &&
      item.data[0][1]
    ) {
      const centralId = normalizeCentralId(item.data[0][1]);
      rawCentralIds.push(centralId);

      // v2: Mapear device -> centralId usando o datasource do item
      const deviceName = item.datasource && item.datasource.entityName;
      if (deviceName) {
        deviceToCentralMap[deviceName] = centralId;
      }
    }
    // ⚠️ MELHORIA 2: Extrair labels de items com dataKey.name = 'label'
    else if (
      item &&
      item.dataKey &&
      item.dataKey.name === 'label' &&
      item.data &&
      item.data[0] &&
      item.data[0][1]
    ) {
      const label = item.data[0][1];
      rawLabels.push(label);
    }
    // Fallback: comportamento original (pega qualquer valor)
    else if (item && item.data && item.data[0] && item.data[0][1]) {
      rawCentralIds.push(item.data[0][1]);
    }
  });

  // Construir centralIdToLabelMap: centralId -> label amigável do dispositivo
  centralIdToLabelMap = {};
  Object.entries(deviceToCentralMap).forEach(([deviceName, cid]) => {
    if (!centralIdToLabelMap[cid]) {
      centralIdToLabelMap[cid] = deviceNameLabelMap[deviceName.split(' ')[0]] || deviceName || cid;
    }
  });

  // Apply normalization to centralIds (TEMPORARY FIX)
  const normalizedCentralIds = rawCentralIds.map(normalizeCentralId);
  self.ctx.$scope.centralIdList = [...new Set(normalizedCentralIds)];
  self.ctx.$scope.expectedLabels = [...new Set(rawLabels)]; // Guardar labels esperados

  console.log('[INIT] centralIds extraídos (raw):', rawCentralIds);
  console.log('[INIT] centralIds normalizados:', self.ctx.$scope.centralIdList);
  console.log('[INIT] labels esperados:', self.ctx.$scope.expectedLabels);
  console.log('[INIT] deviceToCentralMap:', deviceToCentralMap);

  // Bindings de export
  self.ctx.$scope.downloadPDF = () =>
    self.ctx.$scope.dados?.length
      ? exportToPDF(self.ctx.$scope.dados)
      : openErrorModal('Sem dados', 'Não há dados para exportar.');
  self.ctx.$scope.downloadCSV = () =>
    self.ctx.$scope.dados?.length
      ? exportToCSV(self.ctx.$scope.dados)
      : openErrorModal('Sem dados', 'Não há dados para exportar.');

  window.tbtv5_exportPDF = function () {
    const d = self.ctx.$scope.dados;
    d?.length ? exportToPDF(d) : openErrorModal('Sem dados', 'Não há dados para exportar.');
  };
  window.tbtv5_exportXLS = function () {
    const d = self.ctx.$scope.dados;
    d?.length ? exportToXLS(d) : openErrorModal('Sem dados', 'Não há dados para exportar.');
  };
  window.tbtv5_exportCSV = function () {
    const d = self.ctx.$scope.dados;
    d?.length ? exportToCSV(d) : openErrorModal('Sem dados', 'Não há dados para exportar.');
  };

  // RPC connection errors (exibidos no banner premium de indisponibilidade)
  self.ctx.$scope.rpcConnectionErrors = [];
  self.ctx.$scope.retryReport = function () {
    self.ctx.$scope.rpcConnectionErrors = [];
    self.ctx.detectChanges();
    applyDateRange();
  };

  // Date pickers
  self.ctx.$scope.handleStartDateChange = handleStartDateChange;
  self.ctx.$scope.handleEndDateChange = handleEndDateChange;
  self.ctx.$scope.applyDateRange = applyDateRange;
  self.ctx.$scope.clearDateRange = clearDateRange;

  // Inicializa MyIOLibrary.createDateRangePicker após DOM renderizar
  setTimeout(function () {
    var input = (
      self.ctx.$container && self.ctx.$container[0] ? self.ctx.$container[0] : document
    ).querySelector('input[name="startDatetimes"]');

    if (!input) {
      console.warn('[DatePicker] input[name="startDatetimes"] não encontrado');
      return;
    }
    if (!window.MyIOLibrary?.createDateRangePicker) {
      console.warn('[DatePicker] MyIOLibrary.createDateRangePicker não disponível');
      return;
    }

    // Default: primeiro dia do mês atual até hoje
    var _now = new Date();
    var _firstOfMonth = new Date(_now.getFullYear(), _now.getMonth(), 1);
    var _defaultStart = _firstOfMonth.toISOString().slice(0, 10);
    var _defaultEnd = _now.toISOString().slice(0, 10);
    startDate = _firstOfMonth;
    endDate = _now;

    window.MyIOLibrary.createDateRangePicker(input, {
      maxRangeDays: 92,
      includeTime: false,
      presetStart: _defaultStart,
      presetEnd: _defaultEnd,
      onApply: function (result) {
        startDate = result.startISO ? new Date(result.startISO) : null;
        endDate = result.endISO ? new Date(result.endISO) : null;
        self.ctx.detectChanges();
      },
    })
      .then(function () {
        console.log('[DatePicker] Inicializado com sucesso');
      })
      .catch(function (err) {
        console.error('[DatePicker] Falha ao inicializar:', err);
      });
  }, 200);

  // Device filter bindings
  self.ctx.$scope.toggleDeviceFilter = toggleDeviceFilter;
  self.ctx.$scope.onDeviceFilterTextChange = onDeviceFilterTextChange;
  self.ctx.$scope.toggleDeviceSelection = toggleDeviceSelection;
  self.ctx.$scope.selectAllDevices = selectAllDevices;
  self.ctx.$scope.deselectAllDevices = deselectAllDevices;
  self.ctx.$scope.applyDeviceFilter = applyDeviceFilter;

  // Initialize device selection list after deviceList is populated
  initDeviceSelectionList();

  // View default: card view recolhido
  self.ctx.$scope.hasQueried = false;
  self.ctx.$scope.isCardView = true;
  self.ctx.$scope.groupedData = {};
  self.ctx.$scope.expandedDevices = {};
  self.ctx.$scope.totalReadings = 0;
  self.ctx.$scope.totalDevices = 0;

  self.ctx.$scope.toggleViewMode = toggleViewMode;
  self.ctx.$scope.toggleDeviceExpansion = (name) => {
    self.ctx.$scope.expandedDevices[name] = !self.ctx.$scope.expandedDevices[name];
    self.ctx.detectChanges();
  };
  self.ctx.$scope.expandAllDevices = () => {
    Object.keys(self.ctx.$scope.groupedData || {}).forEach(
      (n) => (self.ctx.$scope.expandedDevices[n] = true)
    );
    self.ctx.detectChanges();
  };
  self.ctx.$scope.collapseAllDevices = () => {
    Object.keys(self.ctx.$scope.groupedData || {}).forEach(
      (n) => (self.ctx.$scope.expandedDevices[n] = false)
    );
    self.ctx.detectChanges();
  };
  // Returns last real temperature (skips equalSign/missing/null rows) with guaranteed 2 decimal places
  self.ctx.$scope.getLatestTemperature = (arr) => {
    if (!arr?.length) return '-';
    for (let i = arr.length - 1; i >= 0; i--) {
      const r = arr[i];
      if (!r.equalSign && !r.missing && r.temperature !== '-') {
        return Number(r.temperature).toFixed(2);
      }
    }
    return '-';
  };
  self.ctx.$scope.getDeviceReadingCount = (arr) => arr?.length || 0;
  self.ctx.$scope.getInterpolatedCount = (arr) =>
    (arr || []).filter((r) => r.interpolated && !r.missing).length;
  self.ctx.$scope.getMissingCount = (arr) => (arr || []).filter((r) => r.missing).length;
  self.ctx.$scope.getRealCount = (arr) =>
    (arr || []).filter((r) => !r.interpolated && !r.missing && !r.equalSign).length;
  self.ctx.$scope.getDeviceLossClass = (arr) => {
    const total = (arr || []).length;
    if (!total) return '';
    const missing = (arr || []).filter((r) => r.missing).length;
    const pct = missing / total;
    if (pct === 0) return '';
    if (pct <= 0.05) return 'loss-low';
    if (pct <= 0.15) return 'loss-moderate';
    if (pct <= 0.3) return 'loss-high';
    return 'loss-critical';
  };

  self.ctx.$scope.openSummaryModal = function () {
    const s = self.ctx.$scope;
    const allData = s.dados || [];
    if (!allData.length) return;

    const HALF_HOUR_MS = 30 * 60 * 1000;

    // Grid BRT correto — mesma lógica de getData():
    // startDate/endDate são datas locais do picker; converter para UTC-BRT (00:00 BRT = 03:00 UTC)
    const expectedSet = new Set();
    if (startDate && endDate) {
      const gridStartMs = Date.UTC(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        3,
        0,
        0,
        0
      );
      const gridEndRaw = Date.UTC(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate() + 1,
        2,
        59,
        59,
        999
      );
      const gridEndMs = Math.floor(gridEndRaw / HALF_HOUR_MS) * HALF_HOUR_MS;
      for (let t = gridStartMs; t <= gridEndMs; t += HALF_HOUR_MS) expectedSet.add(t);
    }
    const expectedCount = expectedSet.size || 0;

    // helpers BRT
    function msBRT(ms) {
      const d = new Date(ms - 3 * 60 * 60 * 1000);
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    }
    function dayBRT(ms) {
      const d = new Date(ms - 3 * 60 * 60 * 1000);
      return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    function lossClass(pct) {
      if (pct === 0) return '';
      if (pct <= 5) return 'loss-low';
      if (pct <= 15) return 'loss-moderate';
      if (pct <= 30) return 'loss-high';
      return 'loss-critical';
    }

    function fmtDate(d) {
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
    const period = startDate && endDate ? `${fmtDate(startDate)} → ${fmtDate(endDate)}` : '';

    // Agrupa allData por deviceName (label)
    const byDev = {};
    for (const r of allData) {
      if (!byDev[r.deviceName]) byDev[r.deviceName] = [];
      byDev[r.deviceName].push(r);
    }

    let totalReal = 0,
      totalMissing = 0;
    const devices = [];

    for (const [devLabel, arr] of Object.entries(byDev)) {
      // Leituras reais: excluí '-' (missing) e '=' (lacuna não preenchida)
      const realCount = arr.filter((r) => r.temperature !== '-' && r.temperature !== '=').length;
      const equalSignCount = arr.filter((r) => r.temperature === '=').length;

      // Slots presentes no output (por sort_ts)
      const presentTs = new Set(arr.map((r) => r.sort_ts).filter(Boolean));

      // Missing = slots do grid que não aparecem no output
      const missingTs = [];
      for (const ts of expectedSet) {
        if (!presentTs.has(ts)) missingTs.push(ts);
      }
      // + slots no output marcados como '-' ou '=' (ausência de dado real)
      for (const r of arr) {
        if ((r.temperature === '-' || r.temperature === '=') && r.sort_ts) missingTs.push(r.sort_ts);
      }
      missingTs.sort((a, b) => a - b);

      const missingCount = missingTs.length;
      const totalExpected = expectedCount || arr.length;
      const pct = totalExpected ? parseFloat(((missingCount / totalExpected) * 100).toFixed(1)) : 0;

      // Agrupa slots missing por dia BRT
      const byDay = {};
      for (const ts of missingTs) {
        const day = dayBRT(ts);
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(msBRT(ts));
      }
      const missingByDay = Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, slots]) => ({ day, slots }));

      totalReal += realCount;
      totalMissing += missingCount;

      devices.push({
        name: devLabel,
        label: devLabel,
        totalSlots: totalExpected,
        realSlots: realCount,
        equalSignSlots: equalSignCount,
        missingSlots: missingCount,
        lossPct: pct,
        lossClass: lossClass(pct),
        expanded: false,
        missingByDay,
        barRealPct: Math.max(0, parseFloat(((realCount / totalExpected) * 100).toFixed(2))),
        barEqualPct: Math.max(0, parseFloat(((equalSignCount / totalExpected) * 100).toFixed(2))),
        barMissingPct: Math.max(0, parseFloat(((missingCount / totalExpected) * 100).toFixed(2))),
      });
    }

    devices.sort((a, b) => b.lossPct - a.lossPct);

    const totalSlots = expectedCount * devices.length;
    const overallLossPct = totalSlots ? parseFloat(((totalMissing / totalSlots) * 100).toFixed(1)) : 0;

    const report = {
      totalDevices: devices.length,
      totalReal,
      totalMissing,
      totalSlots,
      overallLossPct,
      devices,
      period,
      expectedCount,
      clampMin,
      clampMax,
      clampFromCustomer: _clampFromCustomer,
    };
    _smState.expanded = false;
    _smState.chartShow = { real: true, equal: true, missing: true };
    _smState.devices = devices;
    _smOpenModal(report);
  };

  self.ctx.$scope.closeSummaryModal = function () {
    _smCloseModal();
  };

  // Overlay inicial
  self.ctx.$scope.premiumLoading = false;
  self.ctx.$scope.premiumLoadingStatus = LOADING_STATES.AWAITING_DATA;
  self.ctx.$scope.premiumLoadingProgress = 0;
  self.ctx.$scope.premiumLoadingTimer = '00:00';

  // Modal bloqueio
  self.ctx.$scope.isBlocking = false;
  self.ctx.$scope.openBlockModal = openBlockModal;
  self.ctx.$scope.closeBlockModal = closeBlockModal;

  // Modal de erro de validação
  self.ctx.$scope.isErrorModal = false;
  self.ctx.$scope.errorTitle = '';
  self.ctx.$scope.errorMessage = '';
  self.ctx.$scope.openErrorModal = openErrorModal;
  self.ctx.$scope.closeErrorModal = closeErrorModal;

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
      openErrorModal('Senha inválida', 'A senha informada está incorreta. Tente novamente.');
    }
    self.ctx.detectChanges();
  };
  self.ctx.$scope.setAdminMode = function (evt) {
    const checked = !!evt?.target?.checked;
    adminMode = checked;
    self.ctx.$scope.adminMode = checked;
    self.ctx.detectChanges();
  };

  self.ctx.$scope.interpolationEnabled = interpolationEnabled;
  self.ctx.$scope.setInterpolationEnabled = function (evt) {
    const checked = !!evt?.target?.checked;
    interpolationEnabled = checked;
    self.ctx.$scope.interpolationEnabled = checked;
    self.ctx.detectChanges();
  };

  self.ctx.$scope.clampMin = clampMin;
  self.ctx.$scope.clampMax = clampMax;
  self.ctx.$scope.clampFromCustomer = _clampFromCustomer;
  self.ctx.$scope.clampSaveStatus = ''; // '' | 'saving' | 'saved'
  self.ctx.$scope.saveClampSettings = async function () {
    self.ctx.$scope.clampSaveStatus = 'saving';
    self.ctx.detectChanges();
    try {
      await _saveClampAttributes();
      self.ctx.$scope.clampSaveStatus = 'saved';
    } catch (e) {
      self.ctx.$scope.clampSaveStatus = 'error';
      console.error('[CLAMP] Erro ao salvar:', e);
    }
    self.ctx.detectChanges();
    setTimeout(function () {
      self.ctx.$scope.clampSaveStatus = '';
      self.ctx.detectChanges();
    }, 3500);
  };
  self.ctx.$scope.setClampMin = function (evt) {
    const v = parseFloat(evt?.target?.value);
    if (!isNaN(v)) {
      clampMin = v;
      self.ctx.$scope.clampMin = v;
      self.ctx.detectChanges();
      _saveClampAttributes();
    }
  };
  self.ctx.$scope.setClampMax = function (evt) {
    const v = parseFloat(evt?.target?.value);
    if (!isNaN(v)) {
      clampMax = v;
      self.ctx.$scope.clampMax = v;
      self.ctx.detectChanges();
      _saveClampAttributes();
    }
  };

  // ── Manual Override — admin detection ───────────────────────────────────────
  // Tenta primeiro via self.ctx.currentUser.sub (JWT subject = email em TB)
  // e confirma/atualiza via /api/auth/user (mesmo padrão do MAIN_VIEW detectSuperAdmin)
  self.ctx.$scope.openManualOverrideModal = function () {
    if (window.tbtv5_mo_open) window.tbtv5_mo_open();
  };
  (function detectAdminAsync() {
    // Tenta síncrono via self.ctx.currentUser.sub (JWT subject = email em TB)
    var subEmail = (self.ctx && self.ctx.currentUser &&
      (self.ctx.currentUser.sub || self.ctx.currentUser.email)) || '';
    if (subEmail) {
      _isMyIOAdmin = subEmail.toLowerCase().endsWith('@myio.com.br')
        && !subEmail.toLowerCase().startsWith('alarme@')
        && !subEmail.toLowerCase().startsWith('alarmes@');
      self.ctx.$scope.isMyIOAdmin = _isMyIOAdmin;
    }
    // Confirmação via GET /api/auth/user (mesmo padrão do MAIN_VIEW detectSuperAdmin)
    // AngularJS $http retorna {data: userObj}, Angular HttpClient retorna userObj direto
    try {
      getHttp().get('/api/auth/user').then(function (resp) {
        var userData = (resp && resp.data) ? resp.data : resp;
        var email = ((userData && userData.email) || '').toLowerCase().trim();
        if (!email) return;
        _isMyIOAdmin = email.endsWith('@myio.com.br')
          && !email.startsWith('alarme@')
          && !email.startsWith('alarmes@');
        self.ctx.$scope.isMyIOAdmin = _isMyIOAdmin;
        self.ctx.detectChanges();
      }).catch(function () { /* mantém valor síncrono */ });
    } catch { /* mantém valor síncrono */ }
  })();

  self.ctx.detectChanges();

  // Carrega limites de clamp e overrides ANTES de qualquer getData().
  // Ambos precisam de await para garantir que os dados estejam disponíveis
  // quando onDataUpdated (que chama getData) disparar logo após onInit.
  _loadClampAttributes(); // fire-and-forget — só afeta display de limites, não os dados
  console.log('[OVERRIDE] Iniciando _loadManualOverrides() no onInit...');
  _loadManualOverrides().then(function () {
    console.log('[OVERRIDE] _loadManualOverrides() concluído. _manualOverrides =',
      _manualOverrides
        ? (_manualOverrides.device_list_interval_values || []).length + ' devices'
        : 'null');
  }).catch(function (e) {
    console.error('[OVERRIDE] Falha no _loadManualOverrides() do onInit:', e);
  });
};

// ── Summary Modal — pure JS, padrão TELEMETRY_INFO ──────────────────────────
var _smState = {
  expanded: false,
  chartShow: { real: true, equal: true, missing: true },
  devices: [],
  report: null,
  filterText: '',
  filterSel: null,
  activeFilterBtn: 'all',
  sortOrder: 'loss_desc',
};

function _smInjectCSS() {
  var existing = document.getElementById('tbtv5-sm-styles');
  if (existing) existing.remove(); // always refresh to pick up latest styles
  var s = document.createElement('style');
  s.id = 'tbtv5-sm-styles';
  s.textContent = [
    '#tbtv5-sm-bd{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:2147483646}',
    '#tbtv5-sm{position:fixed;z-index:2147483647;background:#fff;display:flex;flex-direction:column;overflow:hidden;font-family:inherit;font-size:14px;box-sizing:border-box}',
    '#tbtv5-sm *{box-sizing:border-box}',
    '.summary-modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#5c307d;color:#fff;font-weight:600;font-size:15px;gap:8px;flex-shrink:0}',
    '.summary-header-left{display:flex;align-items:center;gap:10px;flex:1;overflow:hidden}',
    '.summary-period{font-size:12px;font-weight:400;opacity:.85;white-space:nowrap;background:rgba(255,255,255,.15);border-radius:6px;padding:2px 8px}',
    '.summary-header-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}',
    '.summary-modal-expand{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;opacity:.75;line-height:1;padding:2px 6px}',
    '.summary-modal-expand:hover{opacity:1}',
    '.summary-modal-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;opacity:.8;line-height:1;padding:2px 6px}',
    '.summary-modal-close:hover{opacity:1}',
    '.summary-modal-body{flex:1;min-height:0;padding:16px 20px;overflow-y:auto;display:block}',
    '.summary-overall{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}',
    '.summary-kpi{display:flex;flex-direction:column;align-items:center;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:12px 8px}',
    '.summary-kpi.kpi-danger{background:#fff5f5;border-color:#fca5a5}',
    '.kpi-value{font-size:22px;font-weight:700;color:#111827;line-height:1.1}',
    '.kpi-label{font-size:11px;color:#6b7280;margin-top:4px;text-align:center}',
    '.summary-main-content{display:flex;flex-direction:column;gap:12px;padding-bottom:16px}',
    '.summary-device-list{display:flex;flex-direction:column;gap:4px}',
    '.summary-device-row{border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;flex-shrink:0}',
    '.summary-device-row.sdr-loss-low{border-color:#fde68a}',
    '.summary-device-row.sdr-loss-moderate{border-color:#fdba74}',
    '.summary-device-row.sdr-loss-high{border-color:#fca5a5}',
    '.summary-device-row.sdr-loss-critical{border-color:#f87171}',
    '.sdr-header{display:flex;align-items:center;gap:8px;padding:10px 14px;min-height:44px;cursor:pointer;background:#fafafa;user-select:none;font-size:13px}',
    '.sdr-header:hover{background:#f3f4f6}',
    '.sdr-toggle{font-weight:700;color:#5c307d;width:14px;flex-shrink:0;text-align:center}',
    '.sdr-label{flex:1;font-weight:500;color:#111827}',
    '.sdr-pct{font-size:11px;font-weight:600;color:#ef4444;white-space:nowrap;flex-shrink:0}',
    '.sdr-pct.sdr-ok{color:#16a34a}',
    '.sdr-counts{font-size:10px;color:#9ca3af;white-space:nowrap;flex-shrink:0}',
    '.sdr-detail{padding:8px 12px 10px 36px;background:#fff;border-top:1px solid #f3f4f6;font-size:12px}',
    '.sdr-day-row{display:flex;gap:10px;padding:3px 0;border-bottom:1px dashed #f3f4f6;align-items:baseline}',
    '.sdr-day-row:last-child{border-bottom:none}',
    '.sdr-day{font-weight:600;color:#374151;width:40px;flex-shrink:0}',
    '.sdr-slots{color:#6b7280;line-height:1.5}',
    '.sdr-no-loss{color:#16a34a;font-style:italic}',
    '.summary-chart-section{display:flex;flex-direction:column;gap:10px}',
    '.chart-legend{display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0;padding-bottom:4px}',
    '.chart-legend-item{display:flex;align-items:center;gap:5px;font-size:12px;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:500;transition:opacity .15s}',
    '.chart-legend-item:hover{border-color:#9ca3af}',
    '.chart-legend-item.legend-inactive{opacity:.4}',
    '.legend-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}',
    '.chart-area{display:flex;flex-direction:column}',
    '.chart-bars-scroll{overflow-y:auto;overflow-x:hidden}',
    '.chart-bars-inner{display:flex;flex-direction:column;gap:5px;padding:4px 0}',
    '.chart-bar-col{display:flex;align-items:center;gap:8px;min-height:22px}',
    '.bar-label{width:150px;flex-shrink:0;font-size:11px;color:#374151;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.bar-stack{flex:1;height:18px;display:flex;flex-direction:row;border-radius:3px;overflow:hidden;background:#f3f4f6}',
    '.bar-seg{height:100%;flex-shrink:0}',
    '.bar-real{background:#22c55e}',
    '.bar-equal{background:#f59e0b}',
    '.bar-missing{background:#ef4444}',
    '.bar-count{flex-shrink:0;font-size:10px;color:#9ca3af;white-space:nowrap;width:60px}',
    /* clamp status badge */
    '.sm-clamp-badge{display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:8px;font-size:12px;margin-bottom:10px;border:1px solid}',
    '.sm-clamp-custom{background:#f0fdf4;border-color:#86efac;color:#166534}',
    '.sm-clamp-fallback{background:#fefce8;border-color:#fde047;color:#854d0e}',
    '.sm-clamp-dot{font-size:13px;line-height:1;flex-shrink:0}',
    '.sm-clamp-label{flex:1}',
    '.sm-clamp-label strong{font-weight:600}',
    '.sm-clamp-source{font-size:11px;opacity:.8;margin-left:4px}',
    /* filter bar */
    '.sm-filter-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 0 10px}',
    /* footer */
    '.sm-modal-footer{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 20px;background:#5c307d;border-top:1px solid rgba(255,255,255,.12);flex-shrink:0}',
    '.sm-footer-brand{font-size:11px;color:rgba(255,255,255,.65);font-weight:500;letter-spacing:.02em;flex:1;text-align:center}',
    '.sm-footer-exports{display:flex;gap:5px;align-items:center;flex-shrink:0}',
    '.sm-export-btn{padding:4px 11px;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap}',
    '.sm-export-btn:hover{background:rgba(255,255,255,.22)}',
    '.sm-footer-close{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:8px;color:#fff;font-size:12px;font-weight:600;padding:5px 16px;cursor:pointer;flex-shrink:0}',
    '.sm-footer-close:hover{background:rgba(255,255,255,.25)}',
    '.sm-filter-search{flex:1;min-width:140px;padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;color:#111827}',
    '.sm-filter-search:focus{border-color:#5c307d;box-shadow:0 0 0 2px rgba(92,48,125,.15)}',
    '.sm-ms-wrap{position:relative}',
    '.sm-ms-btn{padding:5px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;cursor:pointer;background:#fff;white-space:nowrap;display:flex;align-items:center;gap:4px;color:#374151}',
    '.sm-ms-btn:hover{border-color:#9ca3af}',
    '.sm-ms-dropdown{position:absolute;top:calc(100% + 4px);left:0;min-width:220px;max-height:220px;overflow-y:auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:9999;padding:4px 0}',
    '.sm-ms-item{display:flex;align-items:center;gap:8px;padding:6px 12px;font-size:12px;cursor:pointer;user-select:none;color:#374151}',
    '.sm-ms-item:hover{background:#f9fafb}',
    '.sm-ms-item input[type=checkbox]{accent-color:#5c307d;width:14px;height:14px;flex-shrink:0;cursor:pointer;margin:0}',
    '.sm-filter-btn{padding:5px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;cursor:pointer;background:#f9fafb;white-space:nowrap;color:#374151}',
    '.sm-filter-btn:hover{background:#f3f4f6;border-color:#9ca3af}',
    '.sm-filter-btn.smfb-active{background:#5c307d;color:#fff;border-color:#5c307d}',
    '.sm-sort-wrap{position:relative;flex-shrink:0}',
    '.sm-sort-btn{padding:5px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;cursor:pointer;background:#f9fafb;color:#374151;line-height:1;display:flex;align-items:center;gap:4px;white-space:nowrap}',
    '.sm-sort-btn:hover{border-color:#9ca3af;background:#f3f4f6}',
    '.sm-sort-btn.sort-active{border-color:#5c307d;color:#5c307d;background:#f9f5ff}',
    '.sm-sort-dd{position:absolute;top:calc(100% + 4px);right:0;min-width:175px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.13);z-index:9999;padding:4px 0}',
    '.sm-sort-item{display:flex;align-items:center;gap:8px;width:100%;padding:8px 14px;font-size:12px;cursor:pointer;background:none;border:none;text-align:left;color:#374151;white-space:nowrap}',
    '.sm-sort-item:hover{background:#f9fafb}',
    '.sm-sort-item.sort-selected{color:#5c307d;font-weight:600;background:#f9f5ff}',
    /* expanded layout */
    '#tbtv5-sm.expanded .summary-modal-body{overflow:hidden;flex:1;min-height:0;display:flex;flex-direction:column;gap:0;padding-bottom:16px}',
    '#tbtv5-sm.expanded .summary-main-content{flex:1;min-height:0;flex-shrink:1;flex-direction:row;gap:16px;overflow:hidden}',
    '#tbtv5-sm.expanded .summary-device-list{flex:0 0 360px;align-self:stretch;overflow-y:auto;border-right:1px solid #e5e7eb;padding-right:8px}',
    '#tbtv5-sm.expanded .summary-chart-section{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}',
    '#tbtv5-sm.expanded .chart-area{flex:1;min-height:0;overflow:hidden}',
    '#tbtv5-sm.expanded .chart-bars-scroll{flex:1;overflow-y:auto;overflow-x:hidden}',
  ].join('\n');
  document.head.appendChild(s);
}

function _smEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _smBuildFilterBar(report) {
  var total = report.devices.length;
  var sel = _smState.filterSel;
  var count = sel === null ? total : sel.size;

  // Multiselect: itens em ordem alfabética (mantém índice original de report.devices)
  var msItems = report.devices
    .map(function (dev, i) { return { dev: dev, i: i }; })
    .sort(function (a, b) { return a.dev.label.localeCompare(b.dev.label, 'pt-BR'); })
    .map(function (entry) {
      var checked = sel === null || sel.has(entry.i);
      return (
        '<label class="sm-ms-item"><input type="checkbox" id="tbtv5-ms-cb-' +
        entry.i + '" ' + (checked ? 'checked' : '') +
        ' onchange="window.tbtv5_toggleMsItem(' + entry.i + ')"><span>' +
        _smEsc(entry.dev.label) + '</span></label>'
      );
    })
    .join('');

  var ab = _smState.activeFilterBtn;
  var so = _smState.sortOrder || 'loss_desc';
  var sortLabels = { loss_desc: '↓ Maior perda', loss_asc: '↑ Menor perda', az: 'A → Z', za: 'Z → A' };
  var isCustomSort = so !== 'loss_desc';
  var sortDdItems = ['loss_desc', 'loss_asc', 'az', 'za'].map(function (k) {
    return '<button class="sm-sort-item' + (so === k ? ' sort-selected' : '') + '" onclick="window.tbtv5_applySortOrder(\'' + k + '\')">' + sortLabels[k] + '</button>';
  }).join('');

  return (
    '<div class="sm-filter-bar">' +
    '<input class="sm-filter-search" id="tbtv5-fsearch" type="text" placeholder="🔍 Buscar dispositivo..." value="' +
    _smEsc(_smState.filterText) +
    '" oninput="window.tbtv5_filterInput(this.value)">' +
    '<div class="sm-ms-wrap" id="tbtv5-ms-wrap">' +
    '<button class="sm-ms-btn" id="tbtv5-ms-btn" onclick="window.tbtv5_toggleMsDropdown(event)"><span id="tbtv5-ms-label">Dispositivos (' +
    count + '/' + total + ')</span> ▾</button>' +
    '<div class="sm-ms-dropdown" id="tbtv5-ms-dd" style="display:none">' + msItems + '</div>' +
    '</div>' +
    '<button id="tbtv5-fbtn-all"  class="sm-filter-btn' + (ab === 'all'  ? ' smfb-active' : '') + '" onclick="window.tbtv5_filterAll()">Todos</button>' +
    '<button id="tbtv5-fbtn-clr"  class="sm-filter-btn' + (ab === 'clr'  ? ' smfb-active' : '') + '" onclick="window.tbtv5_filterClear()">Limpar</button>' +
    '<button id="tbtv5-fbtn-loss" class="sm-filter-btn' + (ab === 'loss' ? ' smfb-active' : '') + '" onclick="window.tbtv5_filterOnlyLoss()">Só perdas</button>' +
    '<button id="tbtv5-fbtn-ok"   class="sm-filter-btn' + (ab === 'ok'   ? ' smfb-active' : '') + '" onclick="window.tbtv5_filterNoLoss()">Sem perdas</button>' +
    '<div class="sm-sort-wrap" id="tbtv5-sort-wrap">' +
    '<button class="sm-sort-btn' + (isCustomSort ? ' sort-active' : '') + '" id="tbtv5-sort-btn" onclick="window.tbtv5_toggleSortDropdown(event)" title="Ordenação">⇅ ' + (isCustomSort ? sortLabels[so] : 'Ordenar') + '</button>' +
    '<div class="sm-sort-dd" id="tbtv5-sort-dd" style="display:none">' + sortDdItems + '</div>' +
    '</div>' +
    '</div>'
  );
}

function _smBuildHTML(report) {
  var cs = _smState.chartShow;
  var devRows = report.devices
    .map(function (dev, i) {
      var detailHTML =
        dev.missingByDay.length === 0
          ? '<div class="sdr-no-loss">Nenhuma perda neste período.</div>'
          : dev.missingByDay
              .map(function (d) {
                return (
                  '<div class="sdr-day-row"><span class="sdr-day">' +
                  _smEsc(d.day) +
                  '</span><span class="sdr-slots">' +
                  _smEsc(d.slots.join(', ')) +
                  '</span></div>'
                );
              })
              .join('');
      return (
        '<div class="summary-device-row' +
        (dev.lossClass ? ' sdr-' + dev.lossClass : '') +
        '" id="tbtv5-dr-' +
        i +
        '">' +
        '<div class="sdr-header" onclick="window.tbtv5_toggleDevice(' +
        i +
        ')">' +
        '<span class="sdr-toggle" id="tbtv5-dt-' +
        i +
        '">+</span>' +
        '<span class="sdr-label">' +
        _smEsc(dev.label) +
        '</span>' +
        '<span class="sdr-pct' +
        (dev.lossPct === 0 ? ' sdr-ok' : '') +
        '">' +
        (dev.lossPct === 0 ? 'OK' : dev.lossPct + '% perda') +
        '</span>' +
        '<span class="sdr-counts">' +
        dev.missingSlots +
        '/' +
        dev.totalSlots +
        ' slots</span>' +
        '</div>' +
        '<div class="sdr-detail" id="tbtv5-dd-' +
        i +
        '" style="display:none">' +
        detailHTML +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  var barRows = report.devices
    .map(function (dev) {
      var segs = '';
      if (cs.real && dev.barRealPct > 0)
        segs +=
          '<div class="bar-seg bar-real"    style="width:' +
          dev.barRealPct +
          '%" title="' +
          dev.realSlots +
          ' leituras reais"></div>';
      if (cs.equal && dev.barEqualPct > 0)
        segs +=
          '<div class="bar-seg bar-equal"   style="width:' +
          dev.barEqualPct +
          '%" title="' +
          dev.equalSignSlots +
          ' lacunas (=)"></div>';
      if (cs.missing && dev.barMissingPct > 0)
        segs +=
          '<div class="bar-seg bar-missing" style="width:' +
          dev.barMissingPct +
          '%" title="' +
          dev.missingSlots +
          ' slots sem dados"></div>';
      return (
        '<div class="chart-bar-col">' +
        '<div class="bar-label" title="' +
        _smEsc(dev.label) +
        '">' +
        _smEsc(dev.label) +
        '</div>' +
        '<div class="bar-stack">' +
        segs +
        '</div>' +
        '<div class="bar-count">' +
        dev.realSlots +
        '/' +
        dev.totalSlots +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  var kpiDanger = function (v) {
    return v > 0 ? ' kpi-danger' : '';
  };
  return (
    '<div class="summary-modal-header">' +
    '<div class="summary-header-left">' +
    '<span>Resumo da Consulta</span>' +
    (report.period ? '<span class="summary-period">' + _smEsc(report.period) + '</span>' : '') +
    '</div>' +
    '<div class="summary-header-actions">' +
    '<button class="summary-modal-expand" id="tbtv5-sm-expbtn" onclick="window.tbtv5_toggleExpand()" title="Expandir">⤢</button>' +
    '<button class="summary-modal-close" onclick="window.tbtv5_closeSummaryModal()">✕</button>' +
    '</div></div>' +
    '<div class="summary-modal-body" onclick="window.tbtv5_closeMsDropdown(event)">' +
    '<div class="summary-overall">' +
    '<div class="summary-kpi"><span class="kpi-value" id="tbtv5-kpi-devs">' +
    report.totalDevices +
    '</span><span class="kpi-label">dispositivos</span></div>' +
    '<div class="summary-kpi"><span class="kpi-value" id="tbtv5-kpi-real">' +
    report.totalReal +
    '</span><span class="kpi-label">leituras reais</span></div>' +
    '<div class="summary-kpi' +
    kpiDanger(report.totalMissing) +
    '" id="tbtv5-kpi-miss-card"><span class="kpi-value" id="tbtv5-kpi-miss">' +
    report.totalMissing +
    '</span><span class="kpi-label">slots sem dados</span></div>' +
    '<div class="summary-kpi' +
    kpiDanger(report.overallLossPct) +
    '" id="tbtv5-kpi-pct-card"><span class="kpi-value" id="tbtv5-kpi-pct">' +
    report.overallLossPct +
    '%</span><span class="kpi-label">perda geral</span></div>' +
    '</div>' +
    _smBuildFilterBar(report) +
    '<div class="summary-main-content">' +
    '<div class="summary-device-list">' +
    devRows +
    '</div>' +
    '<div class="summary-chart-section">' +
    '<div class="chart-legend">' +
    '<button class="chart-legend-item" id="tbtv5-lg-real"    onclick="window.tbtv5_toggleSeries(\'real\')"   ><span class="legend-dot" style="background:#22c55e"></span>Leituras reais</button>' +
    '<button class="chart-legend-item" id="tbtv5-lg-equal"   onclick="window.tbtv5_toggleSeries(\'equal\')"  ><span class="legend-dot" style="background:#f59e0b"></span>Lacunas (=)</button>' +
    '<button class="chart-legend-item" id="tbtv5-lg-missing" onclick="window.tbtv5_toggleSeries(\'missing\')"><span class="legend-dot" style="background:#ef4444"></span>Sem dados</button>' +
    '</div>' +
    '<div class="chart-area"><div class="chart-bars-scroll"><div class="chart-bars-inner">' +
    barRows +
    '</div></div></div>' +
    '</div></div></div>' +
    '<footer class="sm-modal-footer">' +
    '<div class="sm-footer-exports">' +
    '<button class="sm-export-btn" onclick="window.tbtv5_exportPDF()">📄 PDF</button>' +
    '<button class="sm-export-btn" onclick="window.tbtv5_exportXLS()">📊 XLS</button>' +
    '<button class="sm-export-btn" onclick="window.tbtv5_exportCSV()">📋 CSV</button>' +
    '</div>' +
    '<span class="sm-footer-brand">MYIO Smart Hospital • Resumo de Temperatura</span>' +
    '<button class="sm-footer-close" onclick="window.tbtv5_closeSummaryModal()">Fechar</button>' +
    '</footer>'
  );
}

function _smShowModal(modal, bd) {
  var Z = '2147483647';
  var exp = _smState.expanded;
  if (bd) {
    bd.style.setProperty('display', 'block', 'important');
    bd.style.setProperty('position', 'fixed', 'important');
    bd.style.setProperty('inset', '0', 'important');
    bd.style.setProperty('z-index', String(Z - 1), 'important');
    bd.style.setProperty('background', 'rgba(0,0,0,0.45)', 'important');
  }
  modal.style.setProperty('display', 'flex', 'important');
  modal.style.setProperty('position', 'fixed', 'important');
  modal.style.setProperty('z-index', Z, 'important');
  modal.style.setProperty('background', '#fff', 'important');
  modal.style.setProperty('flex-direction', 'column', 'important');
  modal.style.setProperty('overflow', 'hidden', 'important');
  modal.style.setProperty('box-shadow', '0 24px 60px rgba(0,0,0,0.22)', 'important');
  if (exp) {
    modal.style.setProperty('top', '0', 'important');
    modal.style.setProperty('left', '0', 'important');
    modal.style.setProperty('right', '0', 'important');
    modal.style.setProperty('bottom', '0', 'important');
    modal.style.setProperty('width', '100%', 'important');
    modal.style.setProperty('height', '100vh', 'important');
    modal.style.setProperty('transform', 'none', 'important');
    modal.style.setProperty('border-radius', '0', 'important');
    modal.classList.add('expanded');
  } else {
    modal.style.setProperty('top', '50%', 'important');
    modal.style.setProperty('left', '50%', 'important');
    modal.style.removeProperty('right');
    modal.style.removeProperty('bottom');
    modal.style.setProperty('width', 'min(1280px, 98vw)', 'important');
    modal.style.setProperty('height', '80vh', 'important');
    modal.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
    modal.style.setProperty('border-radius', '16px', 'important');
    modal.classList.remove('expanded');
  }
}

function _smOpenModal(report) {
  _smInjectCSS();
  _smState.report = report;
  _smState.filterText = '';
  _smState.filterSel = null;
  _smState.activeFilterBtn = 'all';
  _smState.sortOrder = 'loss_desc';
  var modal = document.getElementById('tbtv5-sm');
  var bd = document.getElementById('tbtv5-sm-bd');
  if (!modal) return;
  modal.innerHTML = _smBuildHTML(report); // direct children of #tbtv5-sm → flex layout works
  // Move to body every time (same as TELEMETRY_INFO line 999)
  document.body.appendChild(bd);
  document.body.appendChild(modal);
  _smShowModal(modal, bd);
}

function _smCloseModal() {
  var modal = document.getElementById('tbtv5-sm');
  var bd = document.getElementById('tbtv5-sm-bd');
  if (modal) modal.style.setProperty('display', 'none', 'important');
  if (bd) bd.style.setProperty('display', 'none', 'important');
  _smState.expanded = false;
}

window.tbtv5_closeSummaryModal = _smCloseModal;

/* ---- filter helpers ---- */
function _smGetFilteredIndices() {
  var report = _smState.report;
  if (!report) return [];
  var text = _smState.filterText;
  var sel = _smState.filterSel;
  return report.devices
    .map(function (_, i) {
      return i;
    })
    .filter(function (i) {
      var d = report.devices[i];
      if (text && d.label.toLowerCase().indexOf(text) === -1) return false;
      if (sel !== null && !sel.has(i)) return false;
      return true;
    });
}

function _smUpdateMsLabel() {
  var report = _smState.report;
  var lbl = document.getElementById('tbtv5-ms-label');
  if (!lbl || !report) return;
  var total = report.devices.length;
  var count = _smState.filterSel === null ? total : _smState.filterSel.size;
  lbl.textContent = 'Dispositivos (' + count + '/' + total + ')';
}

function _smUpdateMsCheckboxes(mode) {
  /* mode: true=check all, false=uncheck all, null=sync from filterSel */
  var report = _smState.report;
  if (!report) return;
  report.devices.forEach(function (_, i) {
    var cb = document.getElementById('tbtv5-ms-cb-' + i);
    if (!cb) return;
    if (mode === true) cb.checked = true;
    else if (mode === false) cb.checked = false;
    else cb.checked = _smState.filterSel !== null && _smState.filterSel.has(i);
  });
}

function _smUpdateFiltered() {
  var report = _smState.report;
  if (!report) return;
  var filtered = _smGetFilteredIndices();
  var filtSet = new Set(filtered);

  /* device rows */
  report.devices.forEach(function (_, i) {
    var row = document.getElementById('tbtv5-dr-' + i);
    if (row) row.style.display = filtSet.has(i) ? '' : 'none';
  });

  /* chart bar rows — same order as report.devices */
  var barCols = document.querySelectorAll('#tbtv5-sm .chart-bar-col');
  barCols.forEach(function (el, i) {
    el.style.display = filtSet.has(i) ? '' : 'none';
  });

  /* KPI recalculation */
  var totalReal = 0,
    totalMissing = 0,
    totalEqual = 0;
  filtered.forEach(function (i) {
    var d = report.devices[i];
    totalReal += d.realSlots || 0;
    totalMissing += d.missingSlots || 0;
    totalEqual += d.equalSignSlots || 0;
  });
  var n = filtered.length;
  var tot = totalReal + totalMissing + totalEqual;
  var pct = tot > 0 ? Math.round((totalMissing / tot) * 100) : 0;

  var eDevs = document.getElementById('tbtv5-kpi-devs');
  var eReal = document.getElementById('tbtv5-kpi-real');
  var eMiss = document.getElementById('tbtv5-kpi-miss');
  var eMissCard = document.getElementById('tbtv5-kpi-miss-card');
  var ePct = document.getElementById('tbtv5-kpi-pct');
  var ePctCard = document.getElementById('tbtv5-kpi-pct-card');
  if (eDevs) eDevs.textContent = n;
  if (eReal) eReal.textContent = totalReal;
  if (eMiss) eMiss.textContent = totalMissing;
  if (eMissCard) eMissCard.className = 'summary-kpi' + (totalMissing > 0 ? ' kpi-danger' : '');
  if (ePct) ePct.textContent = pct + '%';
  if (ePctCard) ePctCard.className = 'summary-kpi' + (pct > 0 ? ' kpi-danger' : '');
}

function _smSetActiveFilterBtn(key) {
  _smState.activeFilterBtn = key;
  ['all', 'clr', 'loss', 'ok'].forEach(function (k) {
    var btn = document.getElementById('tbtv5-fbtn-' + k);
    if (btn) btn.classList.toggle('smfb-active', k === key);
  });
}

/* ---- filter globals ---- */
window.tbtv5_filterInput = function (val) {
  _smState.filterText = val.toLowerCase();
  _smSetActiveFilterBtn('');
  _smUpdateFiltered();
};

window.tbtv5_toggleMsDropdown = function (e) {
  e.stopPropagation();
  var sortDd = document.getElementById('tbtv5-sort-dd');
  if (sortDd) sortDd.style.display = 'none';
  var dd = document.getElementById('tbtv5-ms-dd');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
};

window.tbtv5_toggleSortDropdown = function (e) {
  e.stopPropagation();
  var msDd = document.getElementById('tbtv5-ms-dd');
  if (msDd) msDd.style.display = 'none';
  var dd = document.getElementById('tbtv5-sort-dd');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
};

window.tbtv5_applySortOrder = function (order) {
  var report = _smState.report;
  if (!report) return;
  _smState.sortOrder = order;

  // Salva labels selecionados antes do re-sort (filterSel usa índices posicionais)
  var selLabels = null;
  if (_smState.filterSel !== null) {
    selLabels = new Set();
    _smState.filterSel.forEach(function (i) {
      if (report.devices[i]) selLabels.add(report.devices[i].label);
    });
  }

  report.devices.sort(function (a, b) {
    if (order === 'loss_desc') return b.lossPct - a.lossPct;
    if (order === 'loss_asc')  return a.lossPct - b.lossPct;
    if (order === 'az')  return a.label.localeCompare(b.label, 'pt-BR');
    if (order === 'za')  return b.label.localeCompare(a.label, 'pt-BR');
    return 0;
  });

  // Remapeia filterSel para os novos índices
  if (selLabels !== null) {
    _smState.filterSel = new Set();
    report.devices.forEach(function (d, i) {
      if (selLabels.has(d.label)) _smState.filterSel.add(i);
    });
  }

  var modal = document.getElementById('tbtv5-sm');
  if (modal) modal.innerHTML = _smBuildHTML(report);
};

window.tbtv5_closeMsDropdown = function (e) {
  if (e && e.target && e.target.closest) {
    if (e.target.closest('#tbtv5-ms-wrap')) {
      // só fecha sort se aberto
    } else {
      var dd = document.getElementById('tbtv5-ms-dd');
      if (dd) dd.style.display = 'none';
    }
    if (!e.target.closest('#tbtv5-sort-wrap')) {
      var sortDd = document.getElementById('tbtv5-sort-dd');
      if (sortDd) sortDd.style.display = 'none';
    }
  } else {
    var dd2 = document.getElementById('tbtv5-ms-dd');
    if (dd2) dd2.style.display = 'none';
    var sortDd2 = document.getElementById('tbtv5-sort-dd');
    if (sortDd2) sortDd2.style.display = 'none';
  }
};

window.tbtv5_toggleMsItem = function (i) {
  var report = _smState.report;
  if (!report) return;
  if (_smState.filterSel === null) {
    _smState.filterSel = new Set(
      report.devices.map(function (_, idx) {
        return idx;
      })
    );
  }
  if (_smState.filterSel.has(i)) _smState.filterSel.delete(i);
  else _smState.filterSel.add(i);
  _smUpdateMsLabel();
  _smUpdateFiltered();
};

window.tbtv5_filterAll = function () {
  _smState.filterSel = null;
  _smState.filterText = '';
  var inp = document.getElementById('tbtv5-fsearch');
  if (inp) inp.value = '';
  _smUpdateMsCheckboxes(true);
  _smUpdateMsLabel();
  _smSetActiveFilterBtn('all');
  _smUpdateFiltered();
};

window.tbtv5_filterClear = function () {
  _smState.filterSel = new Set();
  _smUpdateMsCheckboxes(false);
  _smUpdateMsLabel();
  _smSetActiveFilterBtn('clr');
  _smUpdateFiltered();
};

window.tbtv5_filterOnlyLoss = function () {
  var report = _smState.report;
  if (!report) return;
  _smState.filterSel = new Set();
  report.devices.forEach(function (d, i) {
    if (d.lossPct > 0) _smState.filterSel.add(i);
  });
  _smUpdateMsCheckboxes(null);
  _smUpdateMsLabel();
  _smSetActiveFilterBtn('loss');
  _smUpdateFiltered();
};

window.tbtv5_filterNoLoss = function () {
  var report = _smState.report;
  if (!report) return;
  _smState.filterSel = new Set();
  report.devices.forEach(function (d, i) {
    if (d.lossPct === 0) _smState.filterSel.add(i);
  });
  _smUpdateMsCheckboxes(null);
  _smUpdateMsLabel();
  _smSetActiveFilterBtn('ok');
  _smUpdateFiltered();
};

window.tbtv5_toggleExpand = function () {
  _smState.expanded = !_smState.expanded;
  var modal = document.getElementById('tbtv5-sm');
  var bd = document.getElementById('tbtv5-sm-bd');
  if (modal) _smShowModal(modal, bd);
  var btn = document.getElementById('tbtv5-sm-expbtn');
  if (btn) btn.title = _smState.expanded ? 'Recolher' : 'Expandir';
};

window.tbtv5_toggleDevice = function (i) {
  var det = document.getElementById('tbtv5-dd-' + i);
  var tog = document.getElementById('tbtv5-dt-' + i);
  if (!det) return;
  var open = det.style.display === 'none';
  det.style.display = open ? 'block' : 'none';
  if (tog) tog.textContent = open ? '−' : '+';
};

window.tbtv5_toggleSeries = function (key) {
  _smState.chartShow[key] = !_smState.chartShow[key];
  var modal = document.getElementById('tbtv5-sm');
  if (!modal) return;
  var cls = key === 'real' ? 'bar-real' : key === 'equal' ? 'bar-equal' : 'bar-missing';
  modal.querySelectorAll('.' + cls).forEach(function (el) {
    el.style.display = _smState.chartShow[key] ? '' : 'none';
  });
  var btn = document.getElementById('tbtv5-lg-' + key);
  if (btn) btn.classList.toggle('legend-inactive', !_smState.chartShow[key]);
};

// ── Manual Override Modal (_mo) ──────────────────────────────────────────────
// Pure-JS modal following the _sm* pattern. Access: @myio.com.br only.
// Attribute key: manualTempOverrides (SERVER_SCOPE, customer entity)

var _moState = {
  step: null,
  prevStep: null,
  selectedDevice: null,
  co2Devices: [],
  slots: [],
};

function _moInjectCSS() {
  var existing = document.getElementById('tbtv5-mo-styles');
  if (existing) existing.remove();
  var s = document.createElement('style');
  s.id = 'tbtv5-mo-styles';
  s.textContent = [
    '#tbtv5-mo-bd{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483646}',
    '#tbtv5-mo{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;background:#fff;border-radius:10px;display:flex;flex-direction:column;overflow:hidden;font-family:inherit;font-size:14px;box-sizing:border-box;width:1740px;max-width:96vw;max-height:92vh}',
    '#tbtv5-mo *{box-sizing:border-box}',
    '.mo-header{display:flex;align-items:flex-start;justify-content:space-between;padding:14px 20px;background:#5c307d;color:#fff;font-weight:600;font-size:15px;flex-shrink:0}',
    '.mo-header-sub{font-size:12px;font-weight:400;opacity:.8;margin-top:2px}',
    '.mo-close{background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:0 4px;line-height:1;opacity:.8;flex-shrink:0}',
    '.mo-close:hover{opacity:1}',
    '.mo-body{flex:1;min-height:0;overflow-y:auto;padding:20px;display:block}',
    '.mo-footer{flex:0 0 auto;display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid #eee;background:#fafafa;flex-shrink:0}',
    '.mo-btn{padding:8px 18px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:500;line-height:1.4}',
    '.mo-btn-primary{background:#5c307d;color:#fff}',
    '.mo-btn-primary:hover:not(:disabled){background:#7b42a8}',
    '.mo-btn-primary:disabled{background:#bbb;cursor:default}',
    '.mo-btn-secondary{background:#f0f0f0;color:#333}',
    '.mo-btn-secondary:hover{background:#e0e0e0}',
    '.mo-btn-danger{background:#e53935;color:#fff}',
    '.mo-btn-danger:hover{background:#c62828}',
    '.mo-step-label{font-size:12px;color:#888;margin:0 0 14px}',
    '.mo-device-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}',
    '.mo-device-item{padding:10px 14px;border:2px solid #e0e0e0;border-radius:8px;cursor:pointer;transition:border-color .15s,background .15s}',
    '.mo-device-item:hover{border-color:#5c307d;background:#f9f5ff}',
    '.mo-device-item.selected{border-color:#5c307d;background:#f3eaff}',
    '.mo-device-label{font-weight:600;font-size:14px}',
    '.mo-device-name{font-size:11px;color:#888;margin-top:2px}',
    '.mo-dt-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}',
    '.mo-dt-label{font-size:13px;font-weight:500;min-width:80px;color:#555}',
    '.mo-dt-input{padding:6px 10px;border:1px solid #ccc;border-radius:6px;font-size:13px}',
    '.mo-dt-select{padding:6px 8px;border:1px solid #ccc;border-radius:6px;font-size:13px;background:#fff}',
    '.mo-slots-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}',
    '.mo-slots-table th{background:#5c307d;color:#fff;padding:7px 10px;text-align:left;font-weight:500}',
    '.mo-slots-table td{padding:6px 10px;border-bottom:1px solid #f0f0f0;vertical-align:middle}',
    '.mo-slots-table tr:nth-child(even) td{background:#fafafa}',
    '.mo-slot-input{width:90px;padding:5px 8px;border:1px solid #ccc;border-radius:5px;font-size:13px;text-align:right}',
    '.mo-slot-input.conflict{border-color:#f57c00;background:#fff8f0}',
    '.mo-conflict-badge{display:inline-block;background:#fff3e0;color:#e65100;border:1px solid #ffe082;border-radius:4px;padding:1px 5px;font-size:11px;margin-left:6px;white-space:nowrap}',
    '.mo-fill-bar{display:flex;align-items:center;gap:8px;margin-top:12px;padding:10px 12px;background:#f5f0ff;border-radius:8px;flex-wrap:wrap}',
    '.mo-fill-bar span{font-size:13px;font-weight:500;flex:1;min-width:80px}',
    '.mo-fill-input{width:90px;padding:6px 8px;border:1px solid #ccc;border-radius:5px;font-size:13px;text-align:right}',
    '.mo-empty{text-align:center;padding:30px;color:#aaa;font-size:13px}',
    '.mo-list-device{border:1px solid #e0e0e0;border-radius:8px;margin-bottom:10px;overflow:hidden}',
    '.mo-list-device-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f9f5ff;cursor:pointer;font-weight:600;font-size:13px;user-select:none}',
    '.mo-list-device-header:hover{background:#f0e8ff}',
    '.mo-list-slots-table{width:100%;border-collapse:collapse;font-size:13px}',
    '.mo-list-slots-table th{background:#ede0ff;color:#5c307d;padding:6px 10px;text-align:left;font-weight:500}',
    '.mo-list-slots-table td{padding:6px 10px;border-bottom:1px solid #f5f0ff}',
    '.mo-list-slots-table tr:last-child td{border-bottom:none}',
    '.mo-action-btn{background:none;border:none;cursor:pointer;padding:3px 7px;border-radius:4px;font-size:15px;line-height:1}',
    '.mo-action-btn:hover{background:#eee}',
    '.mo-delete-confirm{background:#fff5f5;border:1px solid #ffcdd2;border-radius:6px;padding:10px 12px;font-size:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.mo-success-icon{font-size:44px;text-align:center;display:block;margin:6px auto 10px}',
    '.mo-success-msg{text-align:center;font-size:15px;font-weight:600;color:#388e3c;margin-bottom:6px}',
    '.mo-success-sub{text-align:center;color:#666;font-size:13px;margin-bottom:20px}',
    '.mo-info-row{display:flex;gap:8px;margin-bottom:6px;font-size:13px}',
    '.mo-info-key{font-weight:500;color:#555;min-width:110px}',
    '.mo-alert{background:#fff3e0;border:1px solid #ffe082;border-radius:6px;padding:10px 14px;font-size:13px;color:#e65100;margin-bottom:14px}',
    '.mo-section-title{font-size:14px;font-weight:600;color:#333;margin:0 0 10px}',
    '.mo-override-badge{display:inline-block;background:#f0e8ff;color:#5c307d;border:1px solid #c4a3e8;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:500;margin-left:8px;white-space:nowrap;vertical-align:middle}',
    '.mo-edit-confirm{background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:10px 12px;font-size:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.mo-edit-input{width:90px;padding:5px 8px;border:1px solid #93c5fd;border-radius:5px;font-size:13px;text-align:right}',
    '.mo-dt-inline{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}',
    '.mo-dt-sep{font-size:15px;color:#bbb;font-weight:600;padding:0 2px;flex-shrink:0}',
    '.mo-chip-bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center}',
    '.mo-chip{padding:5px 12px;border:1px solid #c4a3e8;border-radius:20px;background:#f9f5ff;color:#5c307d;font-size:12px;font-weight:500;cursor:pointer;transition:background .15s,border-color .15s;white-space:nowrap}',
    '.mo-chip:hover{background:#ede0ff;border-color:#9a6bbf}',
    '.mo-slot-row-saved td{background:#fff7ed !important}',
    '.mo-warn-wrap{position:relative;display:inline-block;cursor:default;margin-left:5px;vertical-align:middle}',
    '.mo-warn-tip{display:none;position:absolute;bottom:calc(100% + 7px);left:50%;transform:translateX(-50%);background:#2d1f42;color:#fff;font-size:12px;padding:8px 11px;border-radius:7px;white-space:nowrap;z-index:9999;line-height:1.5;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.3);min-width:220px;text-align:left}',
    '.mo-warn-tip::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:#2d1f42}',
    '.mo-warn-wrap:hover .mo-warn-tip{display:block}',
  ].join('\n');
  document.head.appendChild(s);
}

function _moGetCo2Devices() {
  var ds = Array.isArray(self.ctx.datasources) ? self.ctx.datasources : [];
  var filtered = ds.filter(function (d) { return d.aliasName === 'CO2 Devices'; });
  if (filtered.length === 0) filtered = ds;
  return filtered.map(function (d) {
    return {
      tbName: d.entityName || '',
      tbLabel: d.entityLabel || d.entityName || '',
      deviceCentralName: (d.entityName || '').split(' ')[0],
    };
  }).sort(function (a, b) { return a.tbLabel.localeCompare(b.tbLabel); });
}

function _moUTCToBRT(utcISO) {
  var brtMs = new Date(utcISO).getTime() - 3 * 60 * 60 * 1000;
  var d = new Date(brtMs);
  return (
    String(d.getUTCDate()).padStart(2, '0') + '/' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '/' +
    d.getUTCFullYear() + ' ' +
    String(d.getUTCHours()).padStart(2, '0') + ':' +
    String(d.getUTCMinutes()).padStart(2, '0')
  );
}

function _moBRTNow() {
  var brtMs = Date.now() - 3 * 60 * 60 * 1000;
  var d = new Date(brtMs);
  return (
    d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0') + ' ' +
    String(d.getUTCHours()).padStart(2, '0') + ':' +
    String(d.getUTCMinutes()).padStart(2, '0') + ':' +
    String(d.getUTCSeconds()).padStart(2, '0')
  );
}

function _moGenerateSlots(startDate, startH, startMin, endDate, endH, endMin) {
  var parts = startDate.split('-').map(Number);
  var startUTC = Date.UTC(parts[0], parts[1] - 1, parts[2], startH + 3, startMin, 0, 0);
  var eParts = endDate.split('-').map(Number);
  var endUTC = Date.UTC(eParts[0], eParts[1] - 1, eParts[2], endH + 3, endMin, 0, 0);
  var HALF = 30 * 60 * 1000;
  var slots = [];
  for (var t = startUTC; t <= endUTC; t += HALF) {
    var timeUTC = new Date(t).toISOString();
    slots.push({ timeUTC: timeUTC, timeBRT: _moUTCToBRT(timeUTC), value: null, conflict: null });
  }
  return slots;
}

function _moCheckConflicts(slots, deviceCentralName) {
  if (!_manualOverrides || !Array.isArray(_manualOverrides.device_list_interval_values)) return slots;
  var deviceEntry = _manualOverrides.device_list_interval_values.find(function (d) {
    return d.deviceCentralName === deviceCentralName;
  });
  if (!deviceEntry) return slots;
  var existingMap = {};
  (deviceEntry.values_list || []).forEach(function (s) { existingMap[s.timeUTC] = s.value; });
  return slots.map(function (s) {
    var existing = existingMap[s.timeUTC];
    return existing !== undefined ? Object.assign({}, s, { conflict: { existingValue: existing } }) : s;
  });
}

function _moChipGenerate(startDate, startH, startM, dayOffsets, hourOffsets) {
  var parts = startDate.split('-').map(Number);
  var slots = [];
  dayOffsets.forEach(function (dayOff) {
    hourOffsets.forEach(function (hOff) {
      var t = Date.UTC(parts[0], parts[1] - 1, parts[2] + dayOff, startH + 3 + hOff, startM, 0, 0);
      var timeUTC = new Date(t).toISOString();
      slots.push({ timeUTC: timeUTC, timeBRT: _moUTCToBRT(timeUTC), value: null, conflict: null });
    });
  });
  return slots;
}

function _moMergeSlots(newSlots) {
  var checked = _moCheckConflicts(newSlots, _moState.selectedDevice.deviceCentralName);
  checked = checked.map(function (s) {
    if (s.conflict && s.value == null) return Object.assign({}, s, { value: s.conflict.existingValue });
    return s;
  });
  var existingKeys = {};
  _moState.slots.forEach(function (s) { existingKeys[s.timeUTC] = true; });
  var toAdd = checked.filter(function (s) { return !existingKeys[s.timeUTC]; });
  _moState.slots = _moState.slots.concat(toAdd);
}

function _moOpenModal() {
  _moInjectCSS();
  var bd = document.getElementById('tbtv5-mo-bd');
  if (!bd) {
    bd = document.createElement('div');
    bd.id = 'tbtv5-mo-bd';
    bd.onclick = function () { window.tbtv5_mo_close(); };
    document.body.appendChild(bd);
  }
  var modal = document.getElementById('tbtv5-mo');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tbtv5-mo';
    document.body.appendChild(modal);
  }
  bd.style.display = 'block';
  modal.style.display = 'flex';
}

function _moCloseModal() {
  var bd = document.getElementById('tbtv5-mo-bd');
  var modal = document.getElementById('tbtv5-mo');
  if (bd) bd.style.display = 'none';
  if (modal) modal.style.display = 'none';
}

function _moRender(html) {
  var modal = document.getElementById('tbtv5-mo');
  if (modal) modal.innerHTML = html;
}

function _moHeader(title, sub) {
  return (
    '<div class="mo-header">' +
    '<div><div>' + title + '</div>' +
    (sub ? '<div class="mo-header-sub">' + sub + '</div>' : '') +
    '</div>' +
    '<button class="mo-close" onclick="window.tbtv5_mo_close()">×</button>' +
    '</div>'
  );
}

function _moFooter(btns) {
  return '<div class="mo-footer">' + btns + '</div>';
}

function _moTimeSelects(prefixH, prefixM, selectedH, selectedMin) {
  var hOpts = '';
  for (var h = 0; h < 24; h++) {
    hOpts += '<option value="' + h + '"' + (h === selectedH ? ' selected' : '') + '>' + String(h).padStart(2, '0') + '</option>';
  }
  var mOpts =
    '<option value="0"' + (selectedMin === 0 ? ' selected' : '') + '>00</option>' +
    '<option value="30"' + (selectedMin === 30 ? ' selected' : '') + '>30</option>';
  return (
    '<select id="' + prefixH + '" class="mo-dt-select">' + hOpts + '</select>' +
    '<span style="font-weight:600;font-size:16px;line-height:1;padding:0 1px">:</span>' +
    '<select id="' + prefixM + '" class="mo-dt-select">' + mOpts + '</select>'
  );
}

// ── Step builders ────────────────────────────────────────────────────────────

function _moBuildStepDevice() {
  var devices = _moState.co2Devices;
  var rows = '';
  var overrideDevices = (_manualOverrides && Array.isArray(_manualOverrides.device_list_interval_values))
    ? _manualOverrides.device_list_interval_values : [];
  var moMonthNames = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  if (devices.length === 0) {
    rows = '<div class="mo-empty">Nenhum dispositivo CO₂ encontrado nas fontes de dados.</div>';
  } else {
    rows = devices.map(function (d, i) {
      var sel = _moState.selectedDevice && _moState.selectedDevice.deviceCentralName === d.deviceCentralName;
      var overrideEntry = overrideDevices.find(function (od) { return od.deviceCentralName === d.deviceCentralName; });
      var badge = '';
      if (overrideEntry && overrideEntry.values_list && overrideEntry.values_list.length > 0) {
        var slotCount = overrideEntry.values_list.length;
        var sortedForBadge = overrideEntry.values_list.slice().sort(function (a, b) { return b.timeUTC.localeCompare(a.timeUTC); });
        var latestDate = new Date(sortedForBadge[0].timeUTC);
        var period = latestDate.getUTCFullYear() + '/' + moMonthNames[latestDate.getUTCMonth()];
        badge = '<span class="mo-override-badge">' + period + ' · ' + slotCount + ' slots</span>';
      }
      return (
        '<li class="mo-device-item' + (sel ? ' selected' : '') + '" onclick="window.tbtv5_mo_selectDevice(' + i + ')">' +
        '<div class="mo-device-label">' + d.tbLabel + badge + '</div>' +
        '<div class="mo-device-name">' + d.deviceCentralName + '</div>' +
        '</li>'
      );
    }).join('');
    rows = '<ul class="mo-device-list">' + rows + '</ul>';
  }

  _moRender(
    _moHeader('Ajuste Manual de Temperatura', 'Passo 1 de 4 · Selecionar Dispositivo') +
    '<div class="mo-body">' +
    '<p class="mo-step-label">Selecione o dispositivo CO₂ para inserir valores manuais:</p>' +
    rows +
    '</div>' +
    _moFooter(
      '<button class="mo-btn mo-btn-secondary" onclick="window.tbtv5_mo_openList()">Ver ajustes existentes</button>' +
      '<button class="mo-btn mo-btn-secondary" onclick="window.tbtv5_mo_close()">Cancelar</button>' +
      '<button class="mo-btn mo-btn-primary" onclick="window.tbtv5_mo_next()"' + (_moState.selectedDevice ? '' : ' disabled') + '>Próximo →</button>'
    )
  );
}

function _moBuildStepDateTime() {
  var dev = _moState.selectedDevice;
  var slotsSection = '';

  if (_moState.slots.length > 0) {
    var savedCount = _moState.slots.filter(function (s) { return s.conflict; }).length;
    var rows = _moState.slots.map(function (s, i) {
      var val = s.value != null ? String(s.value) : '';
      var isSaved = s.conflict != null;
      var rowOpen = isSaved ? '<tr class="mo-slot-row-saved">' : '<tr>';
      var warnIcon = isSaved
        ? ('<span class="mo-warn-wrap">⚠️' +
           '<span class="mo-warn-tip">Slot já possui valor salvo: <strong>' + s.conflict.existingValue + '°C</strong>.<br>O novo valor irá sobrescrevê-lo ao salvar.</span>' +
           '</span>')
        : '';
      return (
        rowOpen +
        '<td>' + s.timeBRT + warnIcon + '</td>' +
        '<td><input type="number" step="0.01" id="mo-slot-' + i + '" class="mo-slot-input' + (isSaved ? ' conflict' : '') + '" ' +
        'value="' + val + '" placeholder="0.00" ' +
        'onchange="window.tbtv5_mo_slotValueChange(' + i + ',this.value)" ' +
        'oninput="window.tbtv5_mo_slotValueChange(' + i + ',this.value)" /></td>' +
        '<td><button class="mo-action-btn" title="Remover" onclick="window.tbtv5_mo_removeSlot(' + i + ')" style="font-size:16px;color:#aaa">×</button></td>' +
        '</tr>'
      );
    }).join('');

    slotsSection = (
      '<div class="mo-fill-bar">' +
      '<span>' + _moState.slots.length + ' slot(s) adicionado(s)' + (savedCount > 0 ? ' · <span style="color:#e65100">' + savedCount + ' com valor salvo</span>' : '') + '</span>' +
      '<input type="number" step="0.01" id="mo-fill-val" class="mo-fill-input" placeholder="Valor único" />' +
      '<button class="mo-btn mo-btn-secondary" onclick="window.tbtv5_mo_applyFillAll()" style="padding:6px 12px;font-size:12px">Preencher todos</button>' +
      '</div>' +
      '<div style="max-height:340px;overflow-y:auto;margin-top:4px">' +
      '<table class="mo-slots-table">' +
      '<thead><tr><th>Slot (BRT)</th><th>Valor (°C)</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table></div>'
    );
  }

  _moRender(
    _moHeader('Ajuste Manual · ' + dev.tbLabel, 'Passo 2 de 4 · Adicionar Slots (BRT)') +
    '<div class="mo-body">' +
    '<div class="mo-dt-inline">' +
    '<span class="mo-dt-label" style="min-width:auto;flex-shrink:0">Início</span>' +
    '<input type="date" id="mo-start-date" class="mo-dt-input" />' +
    _moTimeSelects('mo-start-h', 'mo-start-m', 0, 0) +
    '<span class="mo-dt-sep">→</span>' +
    '<span class="mo-dt-label" style="min-width:auto;flex-shrink:0;color:#aaa">Fim <small style="font-weight:400">(opcional)</small></span>' +
    '<input type="date" id="mo-end-date" class="mo-dt-input" />' +
    _moTimeSelects('mo-end-h', 'mo-end-m', 0, 0) +
    '<button class="mo-btn mo-btn-primary" style="padding:8px 16px;white-space:nowrap;flex-shrink:0" onclick="window.tbtv5_mo_addSlots()">+ Adicionar slots</button>' +
    '</div>' +
    '<div class="mo-chip-bar">' +
    '<span style="font-size:11px;color:#aaa;flex-shrink:0">Atalhos:</span>' +
    '<button class="mo-chip" onclick="window.tbtv5_mo_addChipSlots(\'2h\')">7 slots × 2h</button>' +
    '<button class="mo-chip" onclick="window.tbtv5_mo_addChipSlots(\'2h7d_fwd\')">7 slots × 2h · 7d →</button>' +
    '<button class="mo-chip" onclick="window.tbtv5_mo_addChipSlots(\'2h7d_bwd\')">7 slots × 2h · 7d ←</button>' +
    '</div>' +
    slotsSection +
    '</div>' +
    _moFooter(
      '<button class="mo-btn mo-btn-secondary" onclick="window.tbtv5_mo_back()">← Voltar</button>' +
      '<button class="mo-btn mo-btn-primary" onclick="window.tbtv5_mo_next()">Próximo →</button>'
    )
  );
}

function _moBuildStepConflict() {
  var dev = _moState.selectedDevice;
  var conflicts = _moState.slots.filter(function (s) { return s.conflict; });
  var rows = conflicts.map(function (s) {
    return (
      '<tr>' +
      '<td>' + s.timeBRT + '</td>' +
      '<td style="color:#e65100">' + s.conflict.existingValue + '°C</td>' +
      '<td style="color:#388e3c;font-weight:600">→ ' + (s.value != null ? s.value + '°C' : '<em>sem valor</em>') + '</td>' +
      '</tr>'
    );
  }).join('');

  _moRender(
    _moHeader('Conflitos Detectados', dev.tbLabel + ' · ' + conflicts.length + ' slot(s) já existem') +
    '<div class="mo-body">' +
    '<div class="mo-alert">⚠️ Os slots abaixo já possuem valores manuais e serão substituídos ao confirmar.</div>' +
    '<table class="mo-slots-table">' +
    '<thead><tr><th>Slot (BRT)</th><th>Valor atual</th><th>Novo valor</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '</div>' +
    _moFooter(
      '<button class="mo-btn mo-btn-secondary" onclick="window.tbtv5_mo_back()">← Voltar</button>' +
      '<button class="mo-btn mo-btn-primary" onclick="window.tbtv5_mo_goSummary()">Continuar →</button>'
    )
  );
}

function _moBuildStepSummary() {
  var dev = _moState.selectedDevice;
  var slots = _moState.slots;
  var rows = slots.map(function (s) {
    return '<tr><td>' + s.timeBRT + '</td><td style="font-weight:600">' + (s.value != null ? s.value + '°C' : '-') + '</td></tr>';
  }).join('');

  _moRender(
    _moHeader('Confirmar Ajuste', 'Passo 4 de 4 · Revisar antes de salvar') +
    '<div class="mo-body">' +
    '<div class="mo-info-row"><span class="mo-info-key">Dispositivo:</span><span>' + dev.tbLabel + ' (' + dev.deviceCentralName + ')</span></div>' +
    '<div class="mo-info-row"><span class="mo-info-key">Total de slots:</span><span>' + slots.length + '</span></div>' +
    '<div style="max-height:320px;overflow-y:auto;margin-top:10px">' +
    '<table class="mo-slots-table"><thead><tr><th>Slot (BRT)</th><th>Valor</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>' +
    '</div>' +
    _moFooter(
      '<button class="mo-btn mo-btn-secondary" onclick="window.tbtv5_mo_back()">← Voltar</button>' +
      '<button class="mo-btn mo-btn-primary" id="mo-btn-save" onclick="window.tbtv5_mo_confirmSave()">✓ Salvar</button>'
    )
  );
}

function _moBuildStepDone(savedCount) {
  var dev = _moState.selectedDevice;
  _moRender(
    _moHeader('Ajuste Salvo com Sucesso', '') +
    '<div class="mo-body" style="text-align:center;padding:24px 20px">' +
    '<span class="mo-success-icon">✅</span>' +
    '<div class="mo-success-msg">' + savedCount + ' slot(s) salvos para ' + dev.tbLabel + '</div>' +
    '<div class="mo-success-sub">Os valores serão aplicados no próximo relatório carregado.</div>' +
    '</div>' +
    _moFooter(
      '<button class="mo-btn mo-btn-secondary" onclick="window.tbtv5_mo_openList()">Ver lista</button>' +
      '<button class="mo-btn mo-btn-secondary" onclick="window.tbtv5_mo_addAnother()">Adicionar mais</button>' +
      '<button class="mo-btn mo-btn-primary" onclick="window.tbtv5_mo_close()">Fechar</button>'
    )
  );
}

function _moBuildListView() {
  var devices = (_manualOverrides && Array.isArray(_manualOverrides.device_list_interval_values))
    ? _manualOverrides.device_list_interval_values : [];
  var meta = _manualOverrides
    ? 'v' + (_manualOverrides.version != null ? _manualOverrides.version : '?') + ' · ' + (_manualOverrides.updatedBy || _manualOverrides.createdBy || '—')
    : 'Sem ajustes cadastrados';

  var content;
  if (devices.length === 0) {
    content = '<div class="mo-empty">Nenhum ajuste manual cadastrado.</div>';
  } else {
    content = devices.map(function (d, di) {
      var slotRows = (d.values_list || [])
        .slice().sort(function (a, b) { return a.timeUTC.localeCompare(b.timeUTC); })
        .map(function (s) {
          var brt = _moUTCToBRT(s.timeUTC);
          var safeTimeUTC = s.timeUTC.replace(/[:.]/g, '_');
          return (
            '<tr id="mo-slot-row-' + safeTimeUTC + '">' +
            '<td>' + brt + '</td>' +
            '<td style="font-weight:600">' + s.value + '°C</td>' +
            '<td style="white-space:nowrap">' +
            '<button class="mo-action-btn" title="Editar slot" ' +
            'onclick="window.tbtv5_mo_editSlot(\'' + d.deviceCentralName + '\',\'' + s.timeUTC + '\',' + s.value + ')">✏️</button>' +
            '<button class="mo-action-btn" title="Excluir slot" ' +
            'onclick="window.tbtv5_mo_deleteSlot(\'' + d.deviceCentralName + '\',\'' + s.timeUTC + '\')">🗑</button>' +
            '</td>' +
            '</tr>'
          );
        }).join('');

      return (
        '<div class="mo-list-device">' +
        '<div class="mo-list-device-header" onclick="window.tbtv5_mo_listToggle(' + di + ')">' +
        '<span>' + (d.tbLabel || d.deviceCentralName) + '</span>' +
        '<span style="color:#888;font-size:12px">' + (d.values_list || []).length + ' slots ▾</span>' +
        '</div>' +
        '<div id="mo-list-dev-' + di + '" style="display:none">' +
        '<table class="mo-list-slots-table">' +
        '<thead><tr><th>Slot (BRT)</th><th>Valor</th><th></th></tr></thead>' +
        '<tbody>' + slotRows + '</tbody>' +
        '</table></div></div>'
      );
    }).join('');
  }

  _moRender(
    _moHeader('Ajustes Manuais Existentes', meta) +
    '<div class="mo-body">' + content + '</div>' +
    _moFooter(
      '<button class="mo-btn mo-btn-secondary" onclick="window.tbtv5_mo_backFromList()">← Voltar</button>' +
      '<button class="mo-btn mo-btn-secondary" onclick="window.tbtv5_mo_open()">+ Novo ajuste</button>' +
      '<button class="mo-btn mo-btn-primary" onclick="window.tbtv5_mo_close()">Fechar</button>'
    )
  );
}

function _moBuildStepPassword(nextStep) {
  _moState.pendingStep = nextStep || 'STEP_DEVICE';
  _moRender(
    _moHeader('Ajuste Manual de Temperatura', 'Autenticação necessária') +
    '<div class="mo-body" style="padding:28px 24px">' +
    '<p style="margin:0 0 14px;font-size:13px;color:#555">Digite a senha de administrador para continuar:</p>' +
    '<div style="display:flex;gap:8px;align-items:center">' +
    '<input type="password" id="mo-pwd-input" class="mo-dt-input" placeholder="Senha" style="flex:1" ' +
    'onkeydown="if(event.key===\'Enter\')window.tbtv5_mo_verifyPassword()" />' +
    '<button class="mo-btn mo-btn-primary" onclick="window.tbtv5_mo_verifyPassword()">Validar</button>' +
    '</div>' +
    '<div id="mo-pwd-error" style="color:#e53935;font-size:12px;margin-top:8px;display:none">Senha incorreta.</div>' +
    '</div>' +
    _moFooter('<button class="mo-btn mo-btn-secondary" onclick="window.tbtv5_mo_close()">Cancelar</button>')
  );
  setTimeout(function () {
    var inp = document.getElementById('mo-pwd-input');
    if (inp) inp.focus();
  }, 50);
}

// ── Window globals ────────────────────────────────────────────────────────────

window.tbtv5_mo_open = function () {
  _moOpenModal();
  if (!adminVerified) {
    _moBuildStepPassword('STEP_DEVICE');
    return;
  }
  _moState.step = 'STEP_DEVICE';
  _moState.selectedDevice = null;
  _moState.slots = [];
  _moState.co2Devices = _moGetCo2Devices();
  _moBuildStepDevice();
};

window.tbtv5_mo_openList = function () {
  _moOpenModal();
  if (!adminVerified) {
    _moBuildStepPassword('LIST_VIEW');
    return;
  }
  _moState.prevStep = _moState.step;
  _moState.step = 'LIST_VIEW';
  _moBuildListView();
};

window.tbtv5_mo_close = function () {
  _moCloseModal();
};

window.tbtv5_mo_verifyPassword = function () {
  var inp = document.getElementById('mo-pwd-input');
  var err = document.getElementById('mo-pwd-error');
  if (!inp) return;
  if (inp.value === 'myio2026@') {
    adminVerified = true;
    self.ctx.$scope.adminVerified = true;
    self.ctx.detectChanges();
    var next = _moState.pendingStep || 'STEP_DEVICE';
    if (next === 'LIST_VIEW') {
      _moState.step = 'LIST_VIEW';
      _moBuildListView();
    } else {
      _moState.step = 'STEP_DEVICE';
      _moState.selectedDevice = null;
      _moState.slots = [];
      _moState.co2Devices = _moGetCo2Devices();
      _moBuildStepDevice();
    }
  } else {
    if (err) { err.style.display = 'block'; }
    inp.value = '';
    inp.focus();
  }
};

window.tbtv5_mo_selectDevice = function (idx) {
  _moState.selectedDevice = _moState.co2Devices[idx] || null;
  _moBuildStepDevice();
};

window.tbtv5_mo_generateSlots = function () { window.tbtv5_mo_addSlots(); };

window.tbtv5_mo_addSlots = function () {
  var sd = document.getElementById('mo-start-date');
  var sh = document.getElementById('mo-start-h');
  var sm2 = document.getElementById('mo-start-m');
  var ed = document.getElementById('mo-end-date');
  var eh = document.getElementById('mo-end-h');
  var em2 = document.getElementById('mo-end-m');
  if (!sd || !sd.value) { alert('Preencha a data de Início.'); return; }
  // Fim é opcional — se vazio, usa o próprio início
  var hasEnd = ed && ed.value;
  var endDate = hasEnd ? ed.value : sd.value;
  var endH   = hasEnd ? parseInt(eh.value)  : parseInt(sh.value);
  var endM   = hasEnd ? parseInt(em2.value) : parseInt(sm2.value);
  var newSlots = _moGenerateSlots(
    sd.value, parseInt(sh.value), parseInt(sm2.value),
    endDate, endH, endM
  );
  if (newSlots.length === 0) {
    alert('Nenhum slot gerado. Verifique se o Fim é igual ou posterior ao Início.');
    return;
  }
  if (newSlots.length > 200) {
    alert('Intervalo muito grande (' + newSlots.length + ' slots). Selecione um intervalo menor.');
    return;
  }
  _moMergeSlots(newSlots);
  _moBuildStepDateTime();
};

window.tbtv5_mo_addChipSlots = function (type) {
  var sd = document.getElementById('mo-start-date');
  var sh = document.getElementById('mo-start-h');
  var sm2 = document.getElementById('mo-start-m');
  if (!sd || !sd.value) { alert('Preencha a data de Início primeiro.'); return; }
  var startDate = sd.value;
  var startH = parseInt(sh ? sh.value : '0');
  var startM = parseInt(sm2 ? sm2.value : '0');
  var hourOffsets = [0, 2, 4, 6, 8, 10, 12];
  var dayOffsets;
  if (type === '2h') {
    dayOffsets = [0];
  } else if (type === '2h7d_fwd') {
    dayOffsets = [0, 1, 2, 3, 4, 5, 6];
  } else if (type === '2h7d_bwd') {
    dayOffsets = [0, -1, -2, -3, -4, -5, -6];
  } else { return; }
  var newSlots = _moChipGenerate(startDate, startH, startM, dayOffsets, hourOffsets);
  _moMergeSlots(newSlots);
  _moBuildStepDateTime();
};

window.tbtv5_mo_removeSlot = function (idx) {
  _moState.slots.splice(idx, 1);
  _moBuildStepDateTime();
};

window.tbtv5_mo_slotValueChange = function (idx, val) {
  if (_moState.slots[idx] !== undefined) {
    var n = parseFloat(val);
    _moState.slots[idx].value = isNaN(n) ? null : Math.round(n * 100) / 100;
  }
};

window.tbtv5_mo_applyFillAll = function () {
  var inp = document.getElementById('mo-fill-val');
  if (!inp || inp.value === '') { alert('Digite um valor numérico.'); return; }
  var n = parseFloat(inp.value);
  if (isNaN(n)) { alert('Digite um valor numérico válido.'); return; }
  var v = Math.round(n * 100) / 100;
  _moState.slots.forEach(function (s, i) {
    s.value = v;
    var el = document.getElementById('mo-slot-' + i);
    if (el) el.value = String(v);
  });
};

window.tbtv5_mo_next = function () {
  if (_moState.step === 'STEP_DEVICE') {
    if (!_moState.selectedDevice) return;
    _moState.step = 'STEP_DATETIME';
    _moState.slots = [];
    _moBuildStepDateTime();
  } else if (_moState.step === 'STEP_DATETIME') {
    if (_moState.slots.length === 0) { alert('Adicione pelo menos um slot antes de continuar.'); return; }
    var empty = _moState.slots.filter(function (s) { return s.value == null; });
    if (empty.length > 0) { alert(empty.length + ' slot(s) sem valor. Preencha todos os valores.'); return; }
    var hasConflicts = _moState.slots.some(function (s) { return s.conflict; });
    if (hasConflicts) {
      _moState.step = 'STEP_CONFLICT';
      _moBuildStepConflict();
    } else {
      _moState.step = 'STEP_SUMMARY';
      _moBuildStepSummary();
    }
  }
};

window.tbtv5_mo_goSummary = function () {
  _moState.step = 'STEP_SUMMARY';
  _moBuildStepSummary();
};

window.tbtv5_mo_back = function () {
  if (_moState.step === 'STEP_DATETIME') {
    _moState.step = 'STEP_DEVICE';
    _moBuildStepDevice();
  } else if (_moState.step === 'STEP_CONFLICT') {
    _moState.step = 'STEP_DATETIME';
    _moBuildStepDateTime();
  } else if (_moState.step === 'STEP_SUMMARY') {
    var hasConflicts = _moState.slots.some(function (s) { return s.conflict; });
    _moState.step = hasConflicts ? 'STEP_CONFLICT' : 'STEP_DATETIME';
    if (hasConflicts) _moBuildStepConflict(); else _moBuildStepDateTime();
  }
};

window.tbtv5_mo_confirmSave = async function () {
  var dev = _moState.selectedDevice;
  var slots = _moState.slots;
  if (!dev || slots.length === 0) return;
  var btn = document.getElementById('mo-btn-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
  try {
    await _loadManualOverrides(); // refresh to avoid race
    var userEmail = (self.ctx && self.ctx.currentUser && self.ctx.currentUser.email) || 'unknown';
    var brtNow = _moBRTNow();
    var existing = _manualOverrides || { device_list_interval_values: [], version: 0 };
    var deviceList2 = (existing.device_list_interval_values || []).map(function (d) { return Object.assign({}, d, { values_list: (d.values_list || []).slice() }); });
    var deviceIdx = deviceList2.findIndex(function (d) { return d.deviceCentralName === dev.deviceCentralName; });
    var deviceEntry;
    if (deviceIdx === -1) {
      deviceEntry = { tbName: dev.tbName, tbLabel: dev.tbLabel, deviceCentralName: dev.deviceCentralName, values_list: [] };
      deviceList2.push(deviceEntry);
    } else {
      deviceEntry = deviceList2[deviceIdx];
    }
    slots.forEach(function (s) {
      var idx2 = deviceEntry.values_list.findIndex(function (v) { return v.timeUTC === s.timeUTC; });
      if (idx2 !== -1) deviceEntry.values_list[idx2] = { timeUTC: s.timeUTC, value: s.value };
      else deviceEntry.values_list.push({ timeUTC: s.timeUTC, value: s.value });
    });
    deviceEntry.values_list.sort(function (a, b) { return a.timeUTC.localeCompare(b.timeUTC); });
    var isNew = !_manualOverrides;
    var newData = {
      device_list_interval_values: deviceList2,
      version: (existing.version || 0) + 1,
      createdBy: isNew ? userEmail : (existing.createdBy || userEmail),
      createdDateTime: isNew ? brtNow : (existing.createdDateTime || brtNow),
      updatedBy: userEmail,
      updatedDateTime: brtNow,
    };
    await _saveManualOverrides(newData);
    _moState.step = 'STEP_DONE';
    _moBuildStepDone(slots.length);
  } catch (e) {
    console.error('[MANUAL OVERRIDE] Falha ao salvar:', e);
    if (btn) { btn.disabled = false; btn.textContent = '✓ Salvar'; }
    alert('Erro ao salvar: ' + (e && e.message ? e.message : 'Tente novamente.'));
  }
};

window.tbtv5_mo_addAnother = function () {
  window.tbtv5_mo_open();
};

window.tbtv5_mo_backFromList = function () {
  _moState.step = 'STEP_DEVICE';
  _moState.co2Devices = _moGetCo2Devices();
  _moBuildStepDevice();
};

window.tbtv5_mo_editSlot = function (deviceCentralName, timeUTC, currentValue) {
  var brt = _moUTCToBRT(timeUTC);
  var safeId = 'mo-ec-' + timeUTC.replace(/[:.]/g, '_');
  var existing2 = document.getElementById(safeId);
  if (existing2) { existing2.remove(); return; }
  // remove delete confirm row if open
  var dcId = 'mo-dc-' + timeUTC.replace(/[:.]/g, '_');
  var existingDc = document.getElementById(dcId);
  if (existingDc) existingDc.remove();
  var rowId = 'mo-slot-row-' + timeUTC.replace(/[:.]/g, '_');
  var slotRow = document.getElementById(rowId);
  if (!slotRow) return;
  var editRow = document.createElement('tr');
  editRow.id = safeId;
  editRow.innerHTML =
    '<td colspan="3"><div class="mo-edit-confirm">Editar <strong>' + brt + '</strong>: ' +
    '<input type="number" step="0.01" id="mo-edit-val-' + safeId + '" class="mo-edit-input" value="' + currentValue + '" /> °C ' +
    '<button class="mo-btn mo-btn-primary" style="padding:4px 10px;font-size:12px" ' +
    'onclick="window.tbtv5_mo_confirmEdit(\'' + deviceCentralName + '\',\'' + timeUTC + '\',\'' + safeId + '\')">Salvar</button> ' +
    '<button class="mo-btn mo-btn-secondary" style="padding:4px 10px;font-size:12px" ' +
    'onclick="document.getElementById(\'' + safeId + '\').remove()">Cancelar</button>' +
    '</div></td>';
  slotRow.parentNode.insertBefore(editRow, slotRow.nextSibling);
};

window.tbtv5_mo_confirmEdit = async function (deviceCentralName, timeUTC, safeId) {
  var inp = document.getElementById('mo-edit-val-' + safeId);
  if (!inp) return;
  var n = parseFloat(inp.value);
  if (isNaN(n)) { alert('Digite um valor numérico válido.'); return; }
  var newValue = Math.round(n * 100) / 100;
  try {
    await _loadManualOverrides();
    if (!_manualOverrides) return;
    var deviceList4 = (_manualOverrides.device_list_interval_values || []).map(function (d) {
      if (d.deviceCentralName !== deviceCentralName) return d;
      return Object.assign({}, d, {
        values_list: (d.values_list || []).map(function (s) {
          return s.timeUTC === timeUTC ? { timeUTC: s.timeUTC, value: newValue } : s;
        }),
      });
    });
    var userEmail = (self.ctx && self.ctx.currentUser && self.ctx.currentUser.email) || 'unknown';
    var newData = Object.assign({}, _manualOverrides, {
      device_list_interval_values: deviceList4,
      version: (_manualOverrides.version || 0) + 1,
      updatedBy: userEmail,
      updatedDateTime: _moBRTNow(),
    });
    await _saveManualOverrides(newData);
    _toast('success', 'Slot editado com sucesso.');
    _moBuildListView();
  } catch (e) {
    console.error('[MANUAL OVERRIDE] Falha ao editar slot:', e);
    _toast('error', 'Erro ao editar: ' + (e && e.message ? e.message : 'Tente novamente.'));
  }
};

window.tbtv5_mo_listToggle = function (di) {
  var el = document.getElementById('mo-list-dev-' + di);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.tbtv5_mo_deleteSlot = function (deviceCentralName, timeUTC) {
  var brt = _moUTCToBRT(timeUTC);
  var safeId = 'mo-dc-' + timeUTC.replace(/[:.]/g, '_');
  // Toggle: if confirm row already showing, remove it
  var existing2 = document.getElementById(safeId);
  if (existing2) { existing2.remove(); return; }
  // Find the slot row
  var rowId = 'mo-slot-row-' + timeUTC.replace(/[:.]/g, '_');
  var slotRow = document.getElementById(rowId);
  if (!slotRow) return;
  var confirmRow = document.createElement('tr');
  confirmRow.id = safeId;
  confirmRow.innerHTML =
    '<td colspan="3"><div class="mo-delete-confirm">Excluir <strong>' + brt + '</strong>? ' +
    '<button class="mo-btn mo-btn-danger" style="padding:4px 10px;font-size:12px" ' +
    'onclick="window.tbtv5_mo_confirmDelete(\'' + deviceCentralName + '\',\'' + timeUTC + '\')">Excluir</button> ' +
    '<button class="mo-btn mo-btn-secondary" style="padding:4px 10px;font-size:12px" ' +
    'onclick="document.getElementById(\'' + safeId + '\').remove()">Cancelar</button>' +
    '</div></td>';
  slotRow.parentNode.insertBefore(confirmRow, slotRow.nextSibling);
};

window.tbtv5_mo_confirmDelete = async function (deviceCentralName, timeUTC) {
  try {
    await _loadManualOverrides();
    if (!_manualOverrides) return;
    var deviceList3 = (_manualOverrides.device_list_interval_values || []).map(function (d) {
      if (d.deviceCentralName !== deviceCentralName) return d;
      return Object.assign({}, d, {
        values_list: (d.values_list || []).filter(function (s) { return s.timeUTC !== timeUTC; }),
      });
    }).filter(function (d) { return (d.values_list || []).length > 0; });
    var userEmail = (self.ctx && self.ctx.currentUser && self.ctx.currentUser.email) || 'unknown';
    var newData = Object.assign({}, _manualOverrides, {
      device_list_interval_values: deviceList3,
      version: (_manualOverrides.version || 0) + 1,
      updatedBy: userEmail,
      updatedDateTime: _moBRTNow(),
    });
    await _saveManualOverrides(newData);
    _toast('success', 'Slot excluído com sucesso.');
    _moBuildListView();
  } catch (e) {
    console.error('[MANUAL OVERRIDE] Falha ao excluir:', e);
    _toast('error', 'Erro ao excluir: ' + (e && e.message ? e.message : 'Tente novamente.'));
  }
};

self.onDataUpdated = function () {
  // após datasources carregarem, manter comportamento atual (espera click nas datas)
  self.ctx.detectChanges();
};

// opcional: expor função para uso externo (ex.: botão “Sincronizar”)
// self.ctx.$scope.syncSomething = async () => { openBlockModal('Sincronizando', 'Por favor, aguarde...'); /* ... */ closeBlockModal(); };
