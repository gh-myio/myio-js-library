/* jshint esversion: 11 */

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
const VIEW_MODES = { LIST: 'list', CARD: 'card' };
const LOADING_STATES = {
  AWAITING_DATA: 'Aguardando dados do Gateway...',
  CONSOLIDATING: 'Dados recebidos, consolidando...',
  INTERPOLATING: 'Preenchendo lacunas de telemetria...',
  READY: 'Relatório pronto!',
};

let currentViewMode = VIEW_MODES.CARD; // default premium
let startDate = null,
  endDate = null;
let deviceList = [],
  deviceNameLabelMap = {};

// v2: Mapa device -> centralId para filtrar devices por central no RPC
let deviceToCentralMap = {};

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
let _dateChangeTimer = null;
const DATE_DEBOUNCE_MS = 200;

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
  includeMissingInOutput: false, // Se false, não adiciona registros missing ao output
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
        // Gap pequeno e dentro do mesmo dia - interpolar
        const interpolatedValue = generateInterpolatedValue(slotISO, existingBySlot, fullSlots, i);
        result.push({
          time_interval: slotISO,
          value: interpolatedValue,
          interpolated: true,
          gapSize: gapInfo.size,
        });
        interpolatedCount++;
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
  const num = Number(val);
  if (!isFinite(num)) return { value: null, clamped: false };
  let v = num,
    clamped = false;
  if (num < 17) {
    v = 17.0;
    clamped = true;
  } else if (num > 25) {
    v = 25.0;
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
const RPC_TIMEOUT_MS = 120000; // 120 segundos

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
function exportToCSV(rowsInput) {
  if (!rowsInput?.length) {
    alert('Erro: Nenhum dado para exportar.');
    return;
  }
  const rows = [['Nome do Dispositivo', 'Temperatura', 'Data']];
  rowsInput.forEach((r) => rows.push([r.deviceName, r.temperature, r.reading_date]));
  const csv = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(';')).join('\n');
  const a = document.createElement('a');
  a.href = encodeURI(csv);
  a.download = 'dispositivo_temperatura_horario.csv';
  document.body.appendChild(a);
  a.click();
}

function exportToPDF(data) {
  const doc = new window.jspdf.jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const purple = [92, 48, 125];
  if (!data?.length) {
    alert('Erro: Nenhum dado para exportar.');
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

  doc.save('registro_temperatura.pdf');
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
    alert('Por favor, selecione datas de início e fim.');
    return;
  }

  const centrals = self.ctx.$scope.centralIdList || [];
  if (!Array.isArray(centrals) || centrals.length === 0) {
    console.warn('[getData] Nenhum centralId disponível em $scope.centralIdList.');
  }

  // Use selected devices from filter (or all if none selected)
  const selectedDevices = getSelectedDevices();
  if (selectedDevices.length === 0) {
    alert('Por favor, selecione ao menos um ambiente para gerar o relatório.');
    return;
  }
  console.log('[getData] Devices selecionados:', selectedDevices.length, '/', deviceList.length);

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

      // Acumular erros de conexão para mostrar toast depois
      if (rpcErrors && rpcErrors.length > 0) {
        allRpcErrors.push(...rpcErrors);
      }

      for (const [centralId, readings] of Object.entries(rpcResponses || {})) {
        const arrReadings = Array.isArray(readings) ? readings : [];
        console.log(`[CHUNK ${chunkNumber}/${totalChunks}]`, centralId, 'leituras:', arrReadings.length);

        // v2.1: Normalização condicional por central
        // Centrais com backend ORIGINAL precisam de -3h de correção
        // O backend original usa AT TIME ZONE que adiciona +3h ao UTC real
        // Centrais com backend v3.1 retornam UTC direto (sem correção)
        const CENTRALS_WITH_OLD_BACKEND = [
          '295628b1-75c6-4854-8031-107cd9a2ab91', // Souza Aguiar CO2 (original)
          'df3f846e-b69c-45ce-9475-bd90570b24d0', // Souza Aguiar T&D (original)
        ];

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
            .slice()
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
              temperature: value == null ? '-' : value.toFixed(2),
              interpolated: !!r.interpolated,
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

    // Mostrar toast se houve erros de conexão com centrais
    if (allRpcErrors.length > 0) {
      const uniqueErrors = [...new Map(allRpcErrors.map((e) => [e.centralId, e])).values()];
      const errorMessages = uniqueErrors.map((e) => {
        let statusInfo;
        if (e.status === 'timeout') statusInfo = `Timeout ${RPC_TIMEOUT_MS / 1000}s`;
        else if (e.status === 502) statusInfo = '502 Bad Gateway';
        else if (e.status === 0) statusInfo = 'CORS/Rede';
        else statusInfo = `Status ${e.status}`;
        return `<strong>${e.centralId.substring(0, 8)}...</strong> (${statusInfo})`;
      });
      const toastMessage =
        uniqueErrors.length === 1
          ? `Central inacessível:<br>${errorMessages[0]}`
          : `${uniqueErrors.length} centrais inacessíveis:<br>${errorMessages.join('<br>')}`;
      showToast(toastMessage, 'warning', 30000);
    }

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
function renderData(data) {
  const s = self.ctx.$scope;
  s.totalReadings = data.length;
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
  startDate = event?.value || null;
}

function handleEndDateChange(event) {
  endDate = event?.value || null;
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
    alert('Por favor, selecione ambas as datas (início e fim).');
    return;
  }
  const selectedDevices = getSelectedDevices();
  if (selectedDevices.length === 0) {
    alert('Por favor, selecione ao menos um ambiente para gerar o relatório.');
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
    self.ctx.$scope.dados?.length ? exportToPDF(self.ctx.$scope.dados) : alert('Sem dados para exportar.');
  self.ctx.$scope.downloadCSV = () =>
    self.ctx.$scope.dados?.length ? exportToCSV(self.ctx.$scope.dados) : alert('Sem dados para exportar.');

  // Date pickers
  self.ctx.$scope.handleStartDateChange = handleStartDateChange;
  self.ctx.$scope.handleEndDateChange = handleEndDateChange;
  self.ctx.$scope.applyDateRange = applyDateRange;

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
  self.ctx.$scope.getLatestTemperature = (arr) => (arr?.length ? arr[arr.length - 1].temperature : '-');
  self.ctx.$scope.getDeviceReadingCount = (arr) => arr?.length || 0;
  self.ctx.$scope.getInterpolatedCount = (arr) =>
    (arr || []).filter((r) => r.interpolated && !r.missing).length;
  self.ctx.$scope.getMissingCount = (arr) => (arr || []).filter((r) => r.missing).length;
  self.ctx.$scope.getRealCount = (arr) => (arr || []).filter((r) => !r.interpolated && !r.missing).length;

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

self.onDataUpdated = function () {
  // após datasources carregarem, manter comportamento atual (espera click nas datas)
  self.ctx.detectChanges();
};

// opcional: expor função para uso externo (ex.: botão “Sincronizar”)
// self.ctx.$scope.syncSomething = async () => { openBlockModal('Sincronizando', 'Por favor, aguarde...'); /* ... */ closeBlockModal(); };
