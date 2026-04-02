/* jshint esversion: 11 */
/* global self, _, document, window, requestAnimationFrame */

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
let _dateRangePicker = null;
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
    const entityId = self.ctx?.currentUser?.customerId;
    if (!entityId?.id) {
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
    } catch (_) {
      /* mantém fallback 'hospital' */
    }
    const attrSvc = getAttributeService();
    const types = getTypes();
    const attrs = await attrSvc
      .getEntityAttributes(entityId, types.attributesScope.server.value, ['tempClampMin', 'tempClampMax'])
      .toPromise();
    const minAttr = (attrs || []).find(function (a) {
      return a.key === 'tempClampMin';
    });
    const maxAttr = (attrs || []).find(function (a) {
      return a.key === 'tempClampMax';
    });
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
    const entityId = self.ctx?.currentUser?.customerId;
    if (!entityId?.id) {
      console.warn('[CLAMP] Sem entidade de cliente para salvar');
      return;
    }
    const attrSvc = getAttributeService();
    const types = getTypes();
    await attrSvc
      .saveEntityAttributes(entityId, types.attributesScope.server.value, [
        { key: 'tempClampMin', value: clampMin },
        { key: 'tempClampMax', value: clampMax },
      ])
      .toPromise();
    _clampFromCustomer = true;
    self.ctx.$scope.clampFromCustomer = true;
    self.ctx.detectChanges();
    console.log('[CLAMP] Salvo em SERVER_SCOPE:', clampMin, clampMax);
  } catch (e) {
    console.error('[CLAMP] Falha ao salvar SERVER_SCOPE:', e);
  }
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

function exportToPDF(data) {
  const doc = new window.jspdf.jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const purple = [92, 48, 125];
  if (!data?.length) {
    openErrorModal('Sem dados', 'Não há dados para exportar.');
    return;
  }

  doc.setFillColor(...purple);
  doc.rect(0, 0, pageWidth, 50, 'F');
  const logoH = 25,
    logoW = Math.round(logoH * (512 / 194)),
    logoX = 15,
    logoY = 12;
  doc.addImage(
    'https://dashboard.myio-bas.com/api/images/public/TAfpmF6jEKPDi6hXHbnMUT8MWOHv5lKD',
    'PNG',
    logoX,
    logoY,
    logoW,
    logoH
  );

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  const textX = logoX + logoW + 20;
  const avail = pageWidth - textX - 15;
  const cx = textX + avail / 2;
  doc.text('Sistema Myio | Registro de aferição de Temperaturas', cx, 15, { align: 'center' });
  doc.text('Complexo Hospitalar Municipal Souza Aguiar', cx, 25, { align: 'center' });
  doc.text(`Data de Expedição: ${new Date().toLocaleDateString('pt-BR')}`, cx, 35, { align: 'center' });

  if (startDate && endDate) {
    const f = new Date(startDate).toLocaleDateString('pt-BR');
    const t = new Date(endDate).toLocaleDateString('pt-BR');
    doc.text(`Período de ${f} até ${t}`, cx, 45, { align: 'center' });
  }

  let y = 60,
    h = 10,
    m = 10,
    col = (pageWidth - 2 * m) / 3;
  doc.setFillColor(...purple);
  doc.rect(m, y, pageWidth - 2 * m, h, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  ['Dispositivo', 'Temperatura (ºC)', 'Data'].forEach((txt, i) =>
    doc.text(txt, m + i * col + col / 2, y + 7, { align: 'center' })
  );
  y += h;
  doc.setTextColor(0, 0, 0);

  data.forEach((r, i) => {
    if (y > doc.internal.pageSize.height - 20) {
      doc.addPage();
      y = 20;
    }
    if (i % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(m, y, pageWidth - 2 * m, h, 'F');
    }
    [r.deviceName, r.temperature, r.reading_date].forEach((txt, ci) =>
      doc.text(String(txt), m + ci * col + col / 2, y + 7, { align: 'center' })
    );
    y += h;
  });

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
            allProcessed.push({
              centralId,
              deviceName: deviceLabel,
              reading_date: brDatetime(r.time_interval),
              sort_ts: new Date(r.time_interval).getTime(),
              temperature: r.equalSign ? '=' : value == null ? '-' : value.toFixed(2),
              interpolated: !!r.interpolated,
              equalSign: !!r.equalSign,
              correctedBelowThreshold: !!clamped,
              // Novos campos para interpolação limitada
              missing: !!r.missing,
              missingReason: r.reason || null,
              gapSize: r.gapSize || null,
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
      .then(function (picker) {
        _dateRangePicker = picker;
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
    await _saveClampAttributes();
    self.ctx.$scope.clampSaveStatus = 'saved';
    self.ctx.detectChanges();
    setTimeout(function () {
      self.ctx.$scope.clampSaveStatus = '';
      self.ctx.detectChanges();
    }, 2500);
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

  self.ctx.detectChanges();

  // Carrega limites de clamp do SERVER_SCOPE do cliente (fire-and-forget)
  _loadClampAttributes();
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

function _smBuildClampBadge(report) {
  var custom = !!report.clampFromCustomer;
  var cls = custom ? 'sm-clamp-custom' : 'sm-clamp-fallback';
  var dot = custom ? '🟢' : '🟡';
  var source = custom ? 'do cliente (SERVER_SCOPE)' : 'padrão — fallback';
  return (
    '<div class="sm-clamp-badge ' +
    cls +
    '">' +
    '<span class="sm-clamp-dot">' +
    dot +
    '</span>' +
    '<span class="sm-clamp-label">' +
    'Limites de temperatura (clamp): <strong>' +
    report.clampMin +
    '°C – ' +
    report.clampMax +
    '°C</strong>' +
    '<span class="sm-clamp-source">• ' +
    source +
    '</span>' +
    '</span>' +
    '</div>'
  );
}

function _smBuildFilterBar(report) {
  var total = report.devices.length;
  var sel = _smState.filterSel;
  var count = sel === null ? total : sel.size;
  var msItems = report.devices
    .map(function (dev, i) {
      var checked = sel === null || sel.has(i);
      return (
        '<label class="sm-ms-item"><input type="checkbox" id="tbtv5-ms-cb-' +
        i +
        '" ' +
        (checked ? 'checked' : '') +
        ' onchange="window.tbtv5_toggleMsItem(' +
        i +
        ')"><span>' +
        _smEsc(dev.label) +
        '</span></label>'
      );
    })
    .join('');
  var ab = _smState.activeFilterBtn;
  return (
    '<div class="sm-filter-bar">' +
    '<input class="sm-filter-search" id="tbtv5-fsearch" type="text" placeholder="🔍 Buscar dispositivo..." value="' +
    _smEsc(_smState.filterText) +
    '" oninput="window.tbtv5_filterInput(this.value)">' +
    '<div class="sm-ms-wrap" id="tbtv5-ms-wrap">' +
    '<button class="sm-ms-btn" id="tbtv5-ms-btn" onclick="window.tbtv5_toggleMsDropdown(event)"><span id="tbtv5-ms-label">Dispositivos (' +
    count +
    '/' +
    total +
    ')</span> ▾</button>' +
    '<div class="sm-ms-dropdown" id="tbtv5-ms-dd" style="display:none">' +
    msItems +
    '</div>' +
    '</div>' +
    '<button id="tbtv5-fbtn-all"  class="sm-filter-btn' +
    (ab === 'all' ? ' smfb-active' : '') +
    '" onclick="window.tbtv5_filterAll()">Todos</button>' +
    '<button id="tbtv5-fbtn-clr"  class="sm-filter-btn' +
    (ab === 'clr' ? ' smfb-active' : '') +
    '" onclick="window.tbtv5_filterClear()">Limpar</button>' +
    '<button id="tbtv5-fbtn-loss" class="sm-filter-btn' +
    (ab === 'loss' ? ' smfb-active' : '') +
    '" onclick="window.tbtv5_filterOnlyLoss()">Só perdas</button>' +
    '<button id="tbtv5-fbtn-ok"   class="sm-filter-btn' +
    (ab === 'ok' ? ' smfb-active' : '') +
    '" onclick="window.tbtv5_filterNoLoss()">Sem perdas</button>' +
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
  var dd = document.getElementById('tbtv5-ms-dd');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
};

window.tbtv5_closeMsDropdown = function (e) {
  if (e && e.target && e.target.closest && e.target.closest('#tbtv5-ms-wrap')) return;
  var dd = document.getElementById('tbtv5-ms-dd');
  if (dd) dd.style.display = 'none';
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

self.onDataUpdated = function () {
  // após datasources carregarem, manter comportamento atual (espera click nas datas)
  self.ctx.detectChanges();
};

// opcional: expor função para uso externo (ex.: botão “Sincronizar”)
// self.ctx.$scope.syncSomething = async () => { openBlockModal('Sincronizando', 'Por favor, aguarde...'); /* ... */ closeBlockModal(); };
