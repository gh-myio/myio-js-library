/* global self, window, document */

/* =========================================================================
 * ThingsBoard Widget: Device Cards with Totals & Percentages (MyIO)
 *
 * RFC-0106: Data fetching migrated to MAIN_VIEW orchestrator.
 * This widget NO LONGER makes direct API calls to /api/v1/telemetry/customers.
 * All data is received via 'myio:telemetry:provide-data' events from orchestrator.
 *
 * Architecture:
 * - MAIN_VIEW (orchestrator): Makes single API call, distributes to all widgets
 * - TELEMETRY (this widget): Receives data via events, renders cards
 *
 * Features:
 * - Datas obrigatórias: startDateISO / endDateISO
 * - Modal premium (busy) no widget durante carregamentos
 * - Evento (myio:update-date): mostra modal + atualiza
 * - Temperature domain: uses ctx.data directly (no API)
 * =========================================================================*/

/* eslint-disable no-undef, no-unused-vars */

// RFC-0091: Use LogHelper from MAIN via MyIOUtils (centralized logging)
if (!window.MyIOUtils?.LogHelper) {
  console.error('[TELEMETRY] window.MyIOUtils.LogHelper not found - MAIN_VIEW must load first');
}
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: () => { },
  warn: () => { },
  error: (...args) => console.error('[TELEMETRY]', ...args),
};

// ===== INFOTOOLTIP FROM LIBRARY (RFC-0105) =====
/**
 * Get InfoTooltip from the library
 * @returns {object|null} InfoTooltip component or null if not available
 */
function getInfoTooltip() {
  return window.MyIOLibrary?.InfoTooltip || null;
}

LogHelper.log('🚀 [TELEMETRY] Controller loaded - VERSION WITH ORCHESTRATOR SUPPORT');

// ============================================================================
// RFC-0106: Device Classification - NOW USES MAIN_VIEW via window.MyIOUtils
// The classification config and functions have been moved to MAIN_VIEW orchestrator.
// TELEMETRY widgets should use window.MyIOUtils.classifyDevice() and related functions.
// ============================================================================

// RFC-0106: Get classification utilities from MAIN_VIEW (exposed via window.MyIOUtils)
const DEVICE_CLASSIFICATION_CONFIG = window.MyIOUtils?.DEVICE_CLASSIFICATION_CONFIG || {
  climatizacao: { deviceTypes: [], conditionalDeviceTypes: [], identifiers: [], identifierPrefixes: [] },
  elevadores: { deviceTypes: [], identifiers: [], identifierPrefixes: [] },
  escadas_rolantes: { deviceTypes: [], identifiers: [], identifierPrefixes: [] },
};

// Inject styles for type badges
function injectBadgeStyles() {
  if (document.getElementById('annotation-type-badges-styles')) return;

  const style = document.createElement('style');
  style.id = 'annotation-type-badges-styles';
  style.textContent = `
          .annotation-type-badges {
              position: absolute;
              top: 50%;
              right: 6px;
              transform: translateY(-50%);
              display: flex;
              flex-direction: column;
              gap: 4px;
              z-index: 10;
          }

          .annotation-type-badge {
              position: relative;
              width: 22px;
              height: 22px;
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              cursor: pointer;
              transition: all 0.2s ease;
              box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          }

          .annotation-type-badge:hover {
              transform: scale(1.15);
              box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          }

          .annotation-type-badge__count {
              position: absolute;
              top: -4px;
              right: -4px;
              min-width: 14px;
              height: 14px;
              padding: 0 3px;
              background: #1a1a2e;
              color: white;
              border-radius: 7px;
              font-size: 9px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              line-height: 1;
          }
      `;
  document.head.appendChild(style);
}

/**
 * RFC-0105: Build annotation type tooltip content using InfoTooltip classes
 * @param {string} type - Annotation type (pending, maintenance, activity, observation)
 * @param {Array} typeAnnotations - Annotations of this type
 * @param {Object} config - Type configuration (color, icon, label)
 * @returns {string} HTML content for the tooltip
 */
function buildAnnotationTypeTooltipContent(type, typeAnnotations, config) {
  const now = new Date();

  // Count overdue for this type
  const typeOverdueCount = typeAnnotations.filter(
    (a) => a.dueDate && new Date(a.dueDate) < now
  ).length;

  // Build overdue warning
  const overdueWarning = typeOverdueCount > 0
    ? `<div style="color:#d63031;padding:8px 12px;background:#fff5f5;border-radius:6px;margin-bottom:12px;font-size:11px;font-weight:500;">
         ⚠️ ${typeOverdueCount} anotação(ões) vencida(s)
       </div>`
    : '';

  // Build annotations list
  const annotationsList = typeAnnotations
    .slice(0, 5)
    .map((a) => `
      <div class="myio-info-tooltip__row" style="flex-direction:column;align-items:flex-start;gap:4px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <div style="font-weight:500;color:#1a1a2e;font-size:12px;line-height:1.4;">"${a.text}"</div>
        <div style="font-size:10px;color:#868e96;">
          ${a.createdBy?.name || 'N/A'} • ${new Date(a.createdAt).toLocaleDateString('pt-BR')}
          ${a.dueDate ? ` • Vence: ${new Date(a.dueDate).toLocaleDateString('pt-BR')}` : ''}
        </div>
      </div>
    `).join('');

  const moreCount = typeAnnotations.length > 5 ? typeAnnotations.length - 5 : 0;
  const moreSection = moreCount > 0
    ? `<div style="font-size:11px;color:#6c757d;margin-top:8px;text-align:center;">+ ${moreCount} mais...</div>`
    : '';

  return `
    <div class="myio-info-tooltip__section">
      <div class="myio-info-tooltip__section-title">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${config.color};"></span>
        ${config.label} (${typeAnnotations.length})
      </div>
      ${overdueWarning}
      ${annotationsList}
      ${moreSection}
    </div>
  `;
}

// Function to add annotation type badges to a card
function addAnnotationIndicator(cardElement, entityObject) {
  LogHelper.log(`[TELEMETRY] Adding annotation indicators for ${entityObject.labelOrName}`);

  const annotations = entityObject.log_annotations.annotations;

  // Ensure badge styles are injected
  injectBadgeStyles();

  // Create wrapper for positioning
  if (cardElement && cardElement.style) {
    cardElement.style.position = 'relative';
  }

  // Filter active annotations
  const activeAnnotations = annotations.filter((a) => a.status !== 'archived');
  if (activeAnnotations.length === 0) return null;

  // Group annotations by type
  const annotationsByType = {
    pending: [],
    maintenance: [],
    activity: [],
    observation: [],
  };

  activeAnnotations.forEach((a) => {
    if (annotationsByType[a.type] !== undefined) {
      annotationsByType[a.type].push(a);
    }
  });

  // Create badges container
  const container = document.createElement('div');
  container.className = 'annotation-type-badges';

  // Priority order: pending, maintenance, activity, observation
  const typeOrder = ['pending', 'maintenance', 'activity', 'observation'];

  const TYPE_CONFIG = {
    pending: {
      color: '#d63031',
      icon: '⚠️',
      label: 'Pendência',
    },
    maintenance: {
      color: '#e17055',
      icon: '🔧',
      label: 'Manutenção',
    },
    activity: {
      color: '#00b894',
      icon: '✓',
      label: 'Atividade',
    },
    observation: {
      color: '#0984e3',
      icon: '📝',
      label: 'Observação',
    },
  };

  // RFC-0105: Get InfoTooltip from library
  const InfoTooltip = getInfoTooltip();

  // Create a badge for each type with annotations
  typeOrder.forEach((type) => {
    const typeAnnotations = annotationsByType[type];
    if (typeAnnotations.length === 0) return;

    const config = TYPE_CONFIG[type];
    const badge = document.createElement('div');
    badge.className = 'annotation-type-badge';
    badge.style.background = config.color;
    badge.innerHTML = `
      <span>${config.icon}</span>
      <span class="annotation-type-badge__count">${typeAnnotations.length}</span>
    `;

    // RFC-0105: Use InfoTooltip from library
    if (InfoTooltip) {
      badge.addEventListener('mouseenter', () => {
        const content = buildAnnotationTypeTooltipContent(type, typeAnnotations, config);
        InfoTooltip.show(badge, {
          icon: config.icon,
          title: `${config.label} - ${entityObject.labelOrName}`,
          content: content
        });
      });

      badge.addEventListener('mouseleave', () => {
        InfoTooltip.startDelayedHide();
      });
    } else {
      console.error('[TELEMETRY] InfoTooltip not available - cannot show annotation tooltip');
    }

    container.appendChild(badge);
  });

  // Append badges to card
  cardElement.appendChild(container);

  return container;
}

// RFC-0106: Sets are now derived from DEVICE_CLASSIFICATION_CONFIG (from window.MyIOUtils)
// These are computed at load time based on the config
const CLIMATIZACAO_DEVICE_TYPES_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceTypes);
const CLIMATIZACAO_CONDITIONAL_TYPES_SET = new Set(
  DEVICE_CLASSIFICATION_CONFIG.climatizacao.conditionalDeviceTypes || []
);
const ELEVADORES_DEVICE_TYPES_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.elevadores.deviceTypes);
const ESCADAS_DEVICE_TYPES_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.deviceTypes);

const CLIMATIZACAO_IDENTIFIERS_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.climatizacao.identifiers);
const ELEVADORES_IDENTIFIERS_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.elevadores.identifiers);
const ESCADAS_IDENTIFIERS_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.identifiers);

// RFC-0106: Get EQUIPMENT_EXCLUSION_PATTERN from MAIN_VIEW if available
const EQUIPMENT_EXCLUSION_PATTERN = window.MyIOUtils?.EQUIPMENT_EXCLUSION_PATTERN || new RegExp(
  [
    ...DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceTypes,
    ...DEVICE_CLASSIFICATION_CONFIG.elevadores.deviceTypes,
    ...DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.deviceTypes,
    'bomba',
    'subesta',
    'entrada',
  ]
    .map((t) => t.toLowerCase())
    .join('|'),
  'i'
);

/**
 * RFC-0097: Infere um identifier para exibição baseado no deviceType ou label
 * Usado quando o atributo identifier está ausente
 * @param {Object} item - Item com deviceType e/ou label
 * @returns {string} Identifier inferido ou 'N/A'
 */
function inferDisplayIdentifier(item) {
  if (!item) return 'N/A';

  // Primeiro, tentar usar deviceType
  const deviceType = String(item.deviceType || '').toUpperCase();
  if (deviceType && deviceType !== 'N/D' && deviceType !== '3F_MEDIDOR') {
    // Se for um deviceType conhecido, retornar o próprio deviceType ou abreviação
    if (CLIMATIZACAO_DEVICE_TYPES_SET.has(deviceType)) {
      return deviceType;
    }
    if (ELEVADORES_DEVICE_TYPES_SET.has(deviceType)) {
      return 'ELV';
    }
    if (ESCADAS_DEVICE_TYPES_SET.has(deviceType)) {
      return 'ESC';
    }
  }

  // Fallback: inferir do label usando deviceTypes do config
  const label = String(item.label || '').toLowerCase();

  // Verificar cada deviceType de climatização no label
  for (const dt of DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceTypes) {
    if (label.includes(dt.toLowerCase())) {
      return dt;
    }
  }
  // Verificar identifiers de climatização
  for (const id of DEVICE_CLASSIFICATION_CONFIG.climatizacao.identifiers) {
    if (label.includes(id.toLowerCase())) {
      return id;
    }
  }

  // Elevadores
  if (label.includes('elevador') || label.includes('elv')) return 'ELV';

  // Escadas
  if (label.includes('escada')) return 'ESC';

  return 'N/A';
}

// RFC-0091: Use shared DATA_API_HOST from MAIN widget via window.MyIOUtils
const DATA_API_HOST = window.MyIOUtils?.DATA_API_HOST;
if (!DATA_API_HOST) {
  console.error(
    '[TELEMETRY] DATA_API_HOST not available from window.MyIOUtils - MAIN widget must load first'
  );
}
const MAX_FIRST_HYDRATES = 1;
let MAP_INSTANTANEOUS_POWER;

/**
 * RFC-0078: Extract consumption ranges from unified JSON structure
 * @param {Object} powerLimitsJSON - The mapInstantaneousPower JSON object
 * @param {string} deviceType - Device type (e.g., 'ELEVADOR')
 * @param {string} telemetryType - Telemetry type (default: 'consumption')
 * @returns {Object|null} Range configuration or null
 */
/**
 * RFC-0078: Busca limites no JSON com "Funil" de fallback inteligente
 * Resolve inconsistências entre nomes do TB e chaves do JSON (incluindo Overrides)
 */
function extractLimitsFromJSON(powerLimitsJSON, deviceType, telemetryType = 'consumption') {
  if (!powerLimitsJSON || !powerLimitsJSON.limitsByInstantaneoustPowerType) {
    return null;
  }

  const telemetryConfig = powerLimitsJSON.limitsByInstantaneoustPowerType.find(
    (config) => config.telemetryType === telemetryType
  );

  if (!telemetryConfig) return null;

  // Normaliza o tipo para evitar problemas de espaço ou minúsculas
  const typeUpper = String(deviceType || '').toUpperCase().trim();

  // 1. TENTATIVA EXATA (O ideal)
  let deviceConfig = telemetryConfig.itemsByDeviceType.find(
    (item) => String(item.deviceType).toUpperCase().trim() === typeUpper
  );

  // 2. SE NÃO ACHOU, TENTA IDENTIFICAR PELO NOME (Apelidos)
  if (!deviceConfig) {
      if (typeUpper.includes('ESCADA') || typeUpper === 'ESCADASROLANTES' || typeUpper.includes('ER ')) {
           deviceConfig = telemetryConfig.itemsByDeviceType.find(i => i.deviceType === 'ESCADA_ROLANTE');
      }
      else if (typeUpper.includes('ELEVADOR') || typeUpper.includes('ELV')) {
           deviceConfig = telemetryConfig.itemsByDeviceType.find(i => i.deviceType === 'ELEVADOR');
      }
      else if (typeUpper.includes('BOMBA')) {
           deviceConfig = telemetryConfig.itemsByDeviceType.find(i => i.deviceType === 'BOMBA');
      }
      // Chillers com override muitas vezes usam perfil de MOTOR
      else if (typeUpper.includes('CHILLER')) {
           deviceConfig = telemetryConfig.itemsByDeviceType.find(i => i.deviceType === 'CHILLER');
           if (!deviceConfig) deviceConfig = telemetryConfig.itemsByDeviceType.find(i => i.deviceType === 'MOTOR');
      }
      // Fancoil / HVAC
      else if (typeUpper.includes('FANCOIL')) deviceConfig = telemetryConfig.itemsByDeviceType.find(i => i.deviceType === 'FANCOIL');
      else if (typeUpper.includes('HVAC')) deviceConfig = telemetryConfig.itemsByDeviceType.find(i => i.deviceType === 'HVAC');
  }

  // 3. FALLBACK UNIVERSAL (CATCH-ALL)
  // Resolve Lojas ("102B", "L0L1"), Entradas ("TRAFO", "REDE") e qualquer outro desconhecido.
  if (!deviceConfig) {
       deviceConfig = telemetryConfig.itemsByDeviceType.find(i => i.deviceType === '3F_MEDIDOR');
       // Se não tiver 3F_MEDIDOR (raro), tenta MOTOR como último recurso
       if (!deviceConfig) deviceConfig = telemetryConfig.itemsByDeviceType.find(i => i.deviceType === 'MOTOR');
  }

  if (!deviceConfig) return null;

  // 4. Extrai os ranges
  const ranges = {
    standbyRange: { down: 0, up: 0 },
    normalRange: { down: 0, up: 0 },
    alertRange: { down: 0, up: 0 },
    failureRange: { down: 0, up: 0 },
  };

  if (deviceConfig.limitsByDeviceStatus) {
      deviceConfig.limitsByDeviceStatus.forEach((status) => {
        const vals = status.limitsValues || status.limitsVales || {};
        const baseValue = vals.baseValue ?? 0;
        const topValue = vals.topValue ?? 99999999; 

        switch (status.deviceStatusName) {
          case 'standBy': ranges.standbyRange = { down: baseValue, up: topValue }; break;
          case 'normal': ranges.normalRange = { down: baseValue, up: topValue }; break;
          case 'alert': ranges.alertRange = { down: baseValue, up: topValue }; break;
          case 'failure': ranges.failureRange = { down: baseValue, up: topValue }; break;
        }
      });
  }

  return {
    ...ranges,
    source: 'json',
    metadata: {
      name: deviceConfig.name,
      matchedType: deviceConfig.deviceType 
    },
  };
}

let __deviceProfileSyncComplete = false;

async function fetchDeviceProfiles() {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('[RFC-0071] JWT token not found');

  const url = '/api/deviceProfile/names?activeOnly=true';

  console.log('[EQUIPMENTS] [RFC-0071] Fetching device profiles...');

  const response = await fetch(url, {
    headers: {
      'X-Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`[RFC-0071] Failed to fetch device profiles: ${response.status}`);
  }

  const profiles = await response.json();

  // Build Map: profileId -> profileName
  const profileMap = new Map();
  profiles.forEach((profile) => {
    const profileId = profile.id.id;
    const profileName = profile.name;
    profileMap.set(profileId, profileName);
  });

  console.log(
    `[EQUIPMENTS] [RFC-0071] Loaded ${profileMap.size} device profiles:`,
    Array.from(profileMap.entries())
      .map(([id, name]) => name)
      .join(', ')
  );

  return profileMap;
}

/**
 * Fetches device details including deviceProfileId
 * @param {string} deviceId - Device entity ID
 * @returns {Promise<Object>}
 */
async function fetchDeviceDetails(deviceId) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('[RFC-0071] JWT token not found');

  const url = `/api/device/${deviceId}`;

  const response = await fetch(url, {
    headers: {
      'X-Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`[RFC-0071] Failed to fetch device ${deviceId}: ${response.status}`);
  }

  return await response.json();
}

/**
 * Saves deviceProfile as a server-scope attribute on the device
 * @param {string} deviceId - Device entity ID
 * @param {string} deviceProfile - Profile name (e.g., "MOTOR", "3F_MEDIDOR")
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function addDeviceProfileAttribute(deviceId, deviceProfile) {
  const t = Date.now();

  try {
    if (!deviceId) throw new Error('deviceId is required');
    if (deviceProfile == null || deviceProfile === '') {
      throw new Error('deviceProfile is required');
    }

    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error('jwt_token not found in localStorage');

    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${token}`,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ deviceProfile }),
    });

    const bodyText = await res.text().catch(() => '');

    if (!res.ok) {
      throw new Error(`[RFC-0071] HTTP ${res.status} ${res.statusText} - ${bodyText}`);
    }

    let data = null;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      // Response may not be JSON
    }

    const dt = Date.now() - t;
    console.log(
      `[EQUIPMENTS] [RFC-0071] ✅ Saved deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms`
    );

    return { ok: true, status: res.status, data };
  } catch (err) {
    const dt = Date.now() - t;
    console.error(
      `[EQUIPMENTS] [RFC-0071] ❌ Failed to save deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms | error: ${err?.message || err
      }`
    );
    throw err;
  }
}

/**
 * Main synchronization function
 * Checks all devices and syncs missing deviceProfile attributes
 * @returns {Promise<{synced: number, skipped: number, errors: number}>}
 */
async function syncDeviceProfileAttributes() {
  console.log('[EQUIPMENTS] [RFC-0071] 🔄 Starting device profile synchronization...');

  try {
    // Step 1: Fetch all device profiles
    const profileMap = await fetchDeviceProfiles();

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Step 2: Build a map of devices that need sync
    const deviceMap = new Map();

    self.ctx.data.forEach((data) => {
      const entityId = data.datasource?.entity?.id?.id;
      const existingProfile = data.datasource?.deviceProfile;

      if (!entityId) return;

      // Skip if already has deviceProfile attribute
      if (existingProfile) {
        skipped++;
        return;
      }

      // Store for processing (deduplicate by entityId)
      if (!deviceMap.has(entityId)) {
        deviceMap.set(entityId, {
          entityLabel: data.datasource?.entityLabel,
          entityName: data.datasource?.entityName,
          name: data.datasource?.name,
        });
      }
    });

    console.log(`[EQUIPMENTS] [RFC-0071] Found ${deviceMap.size} devices without deviceProfile attribute`);
    console.log(`[EQUIPMENTS] [RFC-0071] Skipped ${skipped} devices that already have deviceProfile`);

    if (deviceMap.size === 0) {
      console.log('[EQUIPMENTS] [RFC-0071] ✅ All devices already synchronized!');
      return { synced: 0, skipped, errors: 0 };
    }

    // Step 3: Fetch device details and sync attributes
    let processed = 0;
    for (const [entityId, deviceInfo] of deviceMap) {
      processed++;
      const deviceLabel = deviceInfo.entityLabel || deviceInfo.entityName || deviceInfo.name || entityId;

      try {
        console.log(`[EQUIPMENTS] [RFC-0071] Processing ${processed}/${deviceMap.size}: ${deviceLabel}`);

        // Fetch device details to get deviceProfileId
        const deviceDetails = await fetchDeviceDetails(entityId);
        const deviceProfileId = deviceDetails.deviceProfileId?.id;

        if (!deviceProfileId) {
          console.warn(`[EQUIPMENTS] [RFC-0071] ⚠️ Device ${deviceLabel} has no deviceProfileId`);
          errors++;
          continue;
        }

        // Look up profile name from map
        const profileName = profileMap.get(deviceProfileId);

        if (!profileName) {
          console.warn(`[EQUIPMENTS] [RFC-0071] ⚠️ Profile ID ${deviceProfileId} not found in map`);
          errors++;
          continue;
        }

        // Save attribute
        await addDeviceProfileAttribute(entityId, profileName);
        synced++;

        console.log(`[EQUIPMENTS] [RFC-0071] ✅ Synced ${deviceLabel} -> ${profileName}`);

        // Small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[EQUIPMENTS] [RFC-0071] ❌ Failed to sync device ${deviceLabel}:`, error);
        errors++;
      }
    }

    console.log(
      `[EQUIPMENTS] [RFC-0071] 🎉 Sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`
    );

    return { synced, skipped, errors };
  } catch (error) {
    console.error('[EQUIPMENTS] [RFC-0071] ❌ Fatal error during sync:', error);
    throw error;
  }
}

/**
 * Get telemetry data by dataKey name from self.ctx.data
 * @param {string} dataKeyName - The dataKey name to search for
 * @returns {*} The value of the data point, or null if not found
 */
function getData(dataKeyName) {
  if (!self?.ctx?.data) {
    LogHelper.warn('[getData] No ctx.data available');
    return null;
  }

  for (const device of self.ctx.data) {
    if (device.dataKey && device.dataKey.name === dataKeyName) {
      // Return the most recent value (last item in data array)
      if (device.data && device.data.length > 0) {
        const lastDataPoint = device.data[device.data.length - 1];
        return lastDataPoint[1]; // [timestamp, value]
      }
    }
  }

  LogHelper.warn(`[getData] DataKey "${dataKeyName}" not found in ctx.data`);
  return null;
}

let dateUpdateHandler = null;
let dataProvideHandler = null; // RFC-0042: Orchestrator data listener
//let DEVICE_TYPE = "energy";
let MyIO = null;

// RFC-0106: Map labelWidget to window.STATE group
// lojas = 'Lojas'
// entrada = 'Entrada'
// areacomum = everything else (Climatização, Elevadores, Escadas Rolantes, Área Comum, etc.)
function mapLabelWidgetToStateGroup(labelWidget) {
  if (!labelWidget) return null;
  const lw = labelWidget.toLowerCase().trim();
  if (lw === 'lojas') return 'lojas';
  if (lw === 'entrada') return 'entrada';
  // Everything else maps to areacomum
  return 'areacomum';
}

// RFC-0106: Get items from window.STATE based on labelWidget
function getItemsFromState(domain, labelWidget) {
  // RFC-0106 FIX: Temperature domain ignores labelWidget filter - return all items directly
  // Temperature sensors don't use labelWidget categorization like energy does
  if (domain === 'temperature') {
    // First try window.STATE
    if (window.STATE?.isReady('temperature') && window.STATE.temperature?.items?.length > 0) {
      LogHelper.log(`[TELEMETRY] 🌡️ Temperature: returning ${window.STATE.temperature.items.length} items from window.STATE`);
      return window.STATE.temperature.items;
    }

    // Fallback to MyIOOrchestratorData
    const orchestratorData = window.MyIOOrchestratorData;
    if (orchestratorData?.temperature?.items?.length > 0) {
      LogHelper.log(`[TELEMETRY] 🌡️ Temperature: using MyIOOrchestratorData fallback (${orchestratorData.temperature.items.length} items)`);
      return orchestratorData.temperature.items;
    }

    LogHelper.warn(`[TELEMETRY] 🌡️ Temperature: no items found in STATE or OrchestratorData`);
    return null;
  }

  if (!window.STATE?.isReady(domain)) {
    LogHelper.warn(`[TELEMETRY] window.STATE not ready for domain ${domain}`);
    return null;
  }

  const stateGroup = mapLabelWidgetToStateGroup(labelWidget);

  if (!stateGroup) {
    // No labelWidget filter - return all items
    LogHelper.log(`[TELEMETRY] No labelWidget filter - returning all items from _raw`);
    return window.STATE[domain]?._raw || [];
  }

  // For lojas and entrada, return directly from STATE group
  if (stateGroup === 'lojas' || stateGroup === 'entrada') {
    const groupData = window.STATE.get(domain, stateGroup);
    LogHelper.log(`[TELEMETRY] Getting items from STATE.${domain}.${stateGroup}: ${groupData?.count || 0} items`);
    return groupData?.items || [];
  }

  // For areacomum, we might need to filter further by labelWidget
  // since areacomum contains Climatização, Elevadores, Escadas Rolantes, Área Comum
  const areacomumData = window.STATE.get(domain, 'areacomum');
  if (!areacomumData) return [];

  // If labelWidget is specifically 'Área Comum' or 'areacomum', return all areacomum items
  const lwLower = labelWidget.toLowerCase().trim();
  if (lwLower === 'área comum' || lwLower === 'areacomum' || lwLower === 'area comum') {
    LogHelper.log(`[TELEMETRY] Getting all areacomum items: ${areacomumData.count} items`);
    return areacomumData.items;
  }

  // Otherwise, filter areacomum by specific labelWidget (Climatização, Elevadores, etc.)
  const filtered = areacomumData.items.filter((item) => {
    const itemLabel = (item.labelWidget || '').toLowerCase().trim();
    return itemLabel === lwLower;
  });

  LogHelper.log(`[TELEMETRY] Filtered areacomum by labelWidget="${labelWidget}": ${filtered.length} items`);
  return filtered;
}
let hasRequestedInitialData = false; // Flag to prevent duplicate initial requests
let lastProcessedPeriodKey = null; // Track last processed periodKey to prevent duplicate processing
let busyTimeoutId = null; // Timeout ID for busy fallback

// RFC-0042: Widget configuration (from settings)
let WIDGET_DOMAIN = 'energy'; // Will be set in onInit

// RFC-0063: Classification mode configuration
let USE_IDENTIFIER_CLASSIFICATION = false; // Flag to enable identifier-based classification
let USE_HYBRID_CLASSIFICATION = false; // Flag to enable hybrid mode (identifier + labels)

/** ===================== STATE ===================== **/
let CLIENT_ID = '';
let CLIENT_SECRET = '';
let CUSTOMER_ING_ID = '';
let MyIOAuth = null;

const STATE = {
  itemsBase: [], // lista autoritativa (TB)
  itemsEnriched: [], // lista com totals + perc
  searchActive: false,
  searchTerm: '',
  selectedIds: /** @type {Set<string> | null} */ (null),
  sortMode: /** @type {'cons_desc'|'cons_asc'|'alpha_asc'|'alpha_desc'} */ ('cons_desc'),
  firstHydrates: 0,
};

let hydrating = false;

/** ===================== HELPERS (DOM) ===================== **/
const $root = () => $(self.ctx.$container[0]);
const $list = () => $root().find('#shopsList');
const $count = () => $root().find('#shopsCount');
const $total = () => $root().find('#shopsTotal');
const $modal = () => $root().find('#filterModal');

/** ===================== BUSY MODAL (no widget) ===================== **/
const BUSY_ID = 'myio-busy-modal';
function ensureBusyModalDOM() {
  let $m = $root().find(`#${BUSY_ID}`);
  if ($m.length) return $m;

  const html = `
  <div id="${BUSY_ID}" style="
      position:absolute; inset:0; display:none;
      background: rgba(150,132,181,0.45); /* #9684B5 com transparência */
      backdrop-filter: blur(5px);
      z-index:9999; align-items:center; justify-content:center;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;">
    <div style="
        background:#2d1458; color:#fff;
        border:1px solid rgba(255,255,255,0.10);
        box-shadow:0 12px 40px rgba(0,0,0,.35);
        border-radius:18px; padding:22px 26px; min-width:320px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="spinner" style="
            width:22px;height:22px;border-radius:50%;
            border:3px solid rgba(255,255,255,.25);
            border-top-color:#ffffff; animation:spin .9s linear infinite;"></div>
        <div id="${BUSY_ID}-msg" style="font-weight:600; font-size:14px; letter-spacing:.2px;">
          aguarde.. carregando os dados...
        </div>
      </div>
    </div>
  </div>
  <style>
    @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  </style>`;
  $root().css('position', 'relative'); // garante overlay correto
  $root().append(html);
  return $root().find(`#${BUSY_ID}`);
}
// RFC-0044: Use centralized busy management
function showBusy(message, timeoutMs = 35000) {
  LogHelper.log(`[TELEMETRY] 🔄 showBusy() called with message: "${message || 'default'}"`);

  // Prevent multiple simultaneous busy calls
  if (window.busyInProgress) {
    LogHelper.log(`[TELEMETRY] ⏭️ Skipping duplicate showBusy() call`);
    return;
  }

  window.busyInProgress = true;

  // Centralized busy with enhanced synchronization
  const safeShowBusy = () => {
    try {
      if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.showGlobalBusy === 'function') {
        const text = (message && String(message).trim()) || 'Carregando dados...';
        window.MyIOOrchestrator.showGlobalBusy(WIDGET_DOMAIN, text, timeoutMs);
        LogHelper.log(`[TELEMETRY] ✅ Using centralized busy for domain: ${WIDGET_DOMAIN}`);
      } else {
        LogHelper.warn(`[TELEMETRY] ⚠️ Orchestrator not available, using fallback busy`);
        const $m = ensureBusyModalDOM();
        const text = (message && String(message).trim()) || 'aguarde.. carregando os dados...';
        $m.find(`#${BUSY_ID}-msg`).text(text);
        $m.css('display', 'flex');
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY] ❌ Error in showBusy:`, err);
    } finally {
      // Always reset busy flag after a short delay
      setTimeout(() => {
        window.busyInProgress = false;
      }, 500);
    }
  };

  // RFC-0051.3: Check if orchestrator exists and is ready
  const checkOrchestratorReady = async () => {
    // First, check if orchestrator exists and is ready
    if (window.MyIOOrchestrator?.isReady) {
      safeShowBusy();
      return;
    }

    // Wait for orchestrator ready event (with timeout)
    const ready = await new Promise((resolve) => {
      let timeout;
      let interval;

      // Listen for ready event
      const handler = () => {
        clearTimeout(timeout);
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        resolve(true);
      };

      window.addEventListener('myio:orchestrator:ready', handler);

      // Timeout after 5 seconds
      timeout = setTimeout(() => {
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        LogHelper.warn('[TELEMETRY] ⚠️ Orchestrator ready timeout after 5s, using fallback');
        resolve(false);
      }, 5000);

      // Also poll isReady flag (fallback if event is missed)
      interval = setInterval(() => {
        if (window.MyIOOrchestrator?.isReady) {
          clearInterval(interval);
          clearTimeout(timeout);
          window.removeEventListener('myio:orchestrator:ready', handler);
          resolve(true);
        }
      }, 100);
    });

    safeShowBusy();
  };

  checkOrchestratorReady();
}

function hideBusy() {
  LogHelper.log(`[TELEMETRY] ⏸️ hideBusy() called`);

  const safeHideBusy = () => {
    try {
      if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.hideGlobalBusy === 'function') {
        window.MyIOOrchestrator.hideGlobalBusy();
        LogHelper.log(`[TELEMETRY] ✅ Using centralized hideBusy`);
      } else {
        LogHelper.warn(`[TELEMETRY] ⚠️ Orchestrator not available, using fallback hideBusy`);
        $root().find(`#${BUSY_ID}`).css('display', 'none');
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY] ❌ Error in hideBusy:`, err);
    } finally {
      window.busyInProgress = false;
    }
  };

  // RFC-0051.3: Check if orchestrator exists and is ready
  const checkOrchestratorReady = async () => {
    // First, check if orchestrator exists and is ready
    if (window.MyIOOrchestrator?.isReady) {
      safeHideBusy();
      return;
    }

    // Wait for orchestrator ready event (with timeout)
    const ready = await new Promise((resolve) => {
      let timeout;
      let interval;

      // Listen for ready event
      const handler = () => {
        clearTimeout(timeout);
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        resolve(true);
      };

      window.addEventListener('myio:orchestrator:ready', handler);

      // Timeout after 5 seconds
      timeout = setTimeout(() => {
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        LogHelper.warn('[TELEMETRY] ⚠️ Orchestrator ready timeout after 5s, using fallback');
        resolve(false);
      }, 5000);

      // Also poll isReady flag (fallback if event is missed)
      interval = setInterval(() => {
        if (window.MyIOOrchestrator?.isReady) {
          clearInterval(interval);
          clearTimeout(timeout);
          window.removeEventListener('myio:orchestrator:ready', handler);
          resolve(true);
        }
      }, 100);
    });

    safeHideBusy();
  };

  checkOrchestratorReady();
}

const findValue = (values, dataType, defaultValue = 'N/D') => {
  const item = values.find((v) => v.dataType === dataType);
  if (!item) return defaultValue;
  // Retorna a propriedade 'val' (da nossa API) ou 'value' (do ThingsBoard)
  return item.val !== undefined ? item.val : item.value;
};

/** ===================== GLOBAL SUCCESS MODAL (fora do widget) ===================== **/
const G_SUCCESS_ID = 'myio-global-success-modal';
let gSuccessTimer = null;

function ensureGlobalSuccessModalDOM() {
  let el = document.getElementById(G_SUCCESS_ID);
  if (el) return el;

  const wrapper = document.createElement('div');
  wrapper.id = G_SUCCESS_ID;
  wrapper.setAttribute(
    'style',
    `
    position: fixed; inset: 0; display: none;
    z-index: 999999; 
    background: rgba(150,132,181,0.45); /* #9684B5 com transparência */
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  `
  );

  // container central
  const center = document.createElement('div');
  center.setAttribute(
    'style',
    `
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: #2d1458; color: #fff;
    border-radius: 20px; padding: 26px 30px; min-width: 360px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 14px 44px rgba(0,0,0,.35);
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;
    text-align: center;
  `
  );

  const icon = document.createElement('div');
  icon.innerHTML = `
    <div style="
      width:56px;height:56px;margin:0 auto 10px auto;border-radius:50%;
      background: rgba(255,255,255,.12); display:flex;align-items:center;justify-content:center;
      ">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17L4 12" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;

  const title = document.createElement('div');
  title.id = `${G_SUCCESS_ID}-title`;
  title.textContent = 'os dados foram salvos com sucesso';
  title.setAttribute('style', `font-size:16px;font-weight:700;letter-spacing:.2px;margin-bottom:6px;`);

  const sub = document.createElement('div');
  sub.id = `${G_SUCCESS_ID}-sub`;
  sub.innerHTML = `recarregando em <b id="${G_SUCCESS_ID}-count">6</b>s...`;
  sub.setAttribute('style', `opacity:.9;font-size:13px;`);

  center.appendChild(icon);
  center.appendChild(title);
  center.appendChild(sub);
  wrapper.appendChild(center);
  document.body.appendChild(wrapper);
  return wrapper;
}

function showGlobalSuccessModal(seconds = 6) {
  const el = ensureGlobalSuccessModalDOM();
  // reset contador
  const countEl = el.querySelector(`#${G_SUCCESS_ID}-count`);
  if (countEl) countEl.textContent = String(seconds);

  el.style.display = 'block';

  if (gSuccessTimer) {
    clearInterval(gSuccessTimer);
    gSuccessTimer = null;
  }

  let left = seconds;
  gSuccessTimer = setInterval(() => {
    left -= 1;
    if (countEl) countEl.textContent = String(left);
    if (left <= 0) {
      clearInterval(gSuccessTimer);
      gSuccessTimer = null;
      try {
        window.location.reload();
      } catch {
        // Reload may fail in restricted contexts (iframe, etc.)
      }
    }
  }, 1000);
}

function hideGlobalSuccessModal() {
  const el = document.getElementById(G_SUCCESS_ID);
  if (el) el.style.display = 'none';
  if (gSuccessTimer) {
    clearInterval(gSuccessTimer);
    gSuccessTimer = null;
  }
}

/** ===================== UTILS ===================== **/
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isValidUUID(v) {
  if (!v || typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function toSpOffsetNoMs(dt, endOfDay = false) {
  const d = typeof dt === 'number' ? new Date(dt) : dt instanceof Date ? dt : new Date(String(dt));
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
    2,
    '0'
  )}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
    d.getSeconds()
  ).padStart(2, '0')}-03:00`;
}

// converts raw API value to the UI target unit
function toTargetUnit(raw) {
  /*
  const x = Number(raw || 0);

  if (DEVICE_TYPE === "energy") {
    return MyIO.formatEnergy(x);
  }

  if (DEVICE_TYPE === "water") {
    return MyIO.formatWaterVolumeM3(x);
  }

  if (DEVICE_TYPE === "tank") {
    return MyIO.formatTankHeadFromCm(x);
  }

  // Default fallback for temperature or unknown types
  return x;
  */
  // TODO Trecho comentado, pois já faz o tratamento no componente

  return Number(raw || 0);
}
function mustGetDateRange() {
  const s = self.ctx?.scope?.startDateISO;
  const e = self.ctx?.scope?.endDateISO;
  if (s && e) return { startISO: s, endISO: e };
  throw new Error('DATE_RANGE_REQUIRED');
}

const isAuthReady = () => !!(MyIOAuth && typeof MyIOAuth.getToken === 'function');
async function ensureAuthReady(maxMs = 6000, stepMs = 150) {
  const start = Date.now();
  while (!isAuthReady()) {
    if (Date.now() - start > maxMs) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return true;
}

/** ===================== TB INDEXES ===================== **/
function buildTbAttrIndex() {
  // RFC-0091: Added deviceMapInstaneousPower for TIER 0 hierarchical resolution
  const byTbId = new Map(); // tbId -> { slaveId, centralId, deviceType, centralName, lastConnectTime, lastDisconnectTime, lastActivityTime, connectionStatus, deviceMapInstaneousPower }
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
  for (const row of rows) {
    const key = String(row?.dataKey?.name || '').toLowerCase();
    const tbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val = row?.data?.[0]?.[1];

    if (!tbId || val == null) continue;
    if (!byTbId.has(tbId))
      byTbId.set(tbId, {
        slaveId: null,
        centralId: null,
        deviceType: null,
        deviceProfile: null,
        centralName: null,
        customerName: null,
        lastConnectTime: null,
        lastDisconnectTime: null,
        lastActivityTime: null,
        connectionStatus: null,
        consumption_power: null,
        deviceMapInstaneousPower: null, // RFC-0091: Device-specific power limits (TIER 0)
        log_annotations: null, // RFC-0096: Log annotations array
      });
    const slot = byTbId.get(tbId);
    if (key === 'slaveid') slot.slaveId = val;
    if (key === 'centralid') slot.centralId = val;
    if (key === 'devicetype') slot.deviceType = val;
    if (key === 'deviceprofile') slot.deviceProfile = val;
    if (key === 'centralname') slot.centralName = val;
    if (key === 'customername') slot.customerName = val;
    if (key === 'lastconnecttime') slot.lastConnectTime = val;
    if (key === 'lastdisconnecttime') slot.lastDisconnectTime = val;
    if (key === 'lastactivitytime') slot.lastActivityTime = val;
    if (key === 'connectionstatus') slot.connectionStatus = String(val).toLowerCase();
    // RFC-0091: Extract device-specific power limits JSON
    if (key === 'devicemapinstaneouspower') slot.deviceMapInstaneousPower = val;
    if (key === 'log_annotations') slot.log_annotations = val;
    if (key === 'consumption') slot.consumption_power = val;
  }
  return byTbId;
}
function buildTbIdIndexes() {
  const byIdentifier = new Map(); // identifier -> tbId
  const byIngestion = new Map(); // ingestionId -> tbId
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];

  for (const row of rows) {
    const key = String(row?.dataKey?.name || '').toLowerCase();
    const tbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val = row?.data?.[0]?.[1];

    if (!tbId || val == null) continue;

    if (key === 'identifier') byIdentifier.set(String(val), tbId);
    if (key === 'ingestionid') byIngestion.set(String(val), tbId);
  }
  return { byIdentifier, byIngestion };
}

/** ===================== CORE: DATA PIPELINE ===================== **/
/**
 * RFC-0106: DEPRECATED - buildAuthoritativeItems no longer used.
 * All data now comes from orchestrator via 'myio:telemetry:provide-data' event.
 * This function used ctx.datasources and ctx.data which are no longer available.
 * @deprecated Use dataProvideHandler for all data processing
 */
function buildAuthoritativeItems() {
  LogHelper.warn('[RFC-0106] buildAuthoritativeItems is DEPRECATED - use orchestrator data');
  // items da LIB: [{ id: ingestionId, identifier, label }, ...]
  const base = MyIO.buildListItemsThingsboardByUniqueDatasource(self.ctx.datasources, self.ctx.data) || [];

  //LogHelper.log('[TELEMETRY][buildAuthoritativeItems] base: ', base);

  const ok = Array.isArray(base) ? base.filter((x) => x && x.id) : [];

  const tbIdIdx = buildTbIdIndexes(); // { byIdentifier, byIngestion }
  const attrsByTb = buildTbAttrIndex(); // tbId -> { slaveId, centralId, deviceType }

  // Extract global minTemperature and maxTemperature from window.MyIOUtils
  // These values are exposed by MAIN_VIEW widget which has the datasource for temperature limits
  let globalTempMin = null;
  let globalTempMax = null;

  if (WIDGET_DOMAIN === 'temperature' && window.MyIOUtils?.temperatureLimits) {
    globalTempMin = window.MyIOUtils.temperatureLimits.minTemperature;
    globalTempMax = window.MyIOUtils.temperatureLimits.maxTemperature;
    /*
    LogHelper.log(
      `[DeviceCards] Reading temperature limits from MyIOUtils: min=${globalTempMin}, max=${globalTempMax}`
    );
    */
  }

  const mapped = ok.map((r) => {
    //LogHelper.log('[TELEMETRY][buildAuthoritativeItems] ok.map: ', r);

    // r.id from buildListItemsThingsboardByUniqueDatasource can be:
    // 1. ThingsBoard entityId (most common - comes directly from datasource.entity.id.id)
    // 2. ingestionId value (only if device has ingestionId attribute that overwrites it)
    const itemId = r.id;

    // Check 1: Is itemId directly a valid ThingsBoard entityId in our attrs map?
    const isDirectTbId = itemId && attrsByTb.has(itemId);

    // Check 2: Try to find tbId by looking up itemId as an ingestionId
    const tbFromIngestionLookup = itemId ? tbIdIdx.byIngestion.get(itemId) : null;

    // Check 3: Try to find tbId by identifier
    const tbFromIdentifier = r.identifier ? tbIdIdx.byIdentifier.get(r.identifier) : null;

    // Priority: direct tbId > ingestion lookup > identifier lookup
    // Direct tbId is highest priority because it's the actual entityId
    let tbId = isDirectTbId ? itemId : tbFromIngestionLookup || tbFromIdentifier || null;

    if (tbFromIngestionLookup && tbFromIdentifier && tbFromIngestionLookup !== tbFromIdentifier) {
      /*
      LogHelper.warn("[DeviceCards] TB id mismatch for item", {
        label: r.label, identifier: r.identifier, itemId, tbFromIngestionLookup, tbFromIdentifier
      });
      */
      tbId = isDirectTbId ? itemId : tbFromIngestionLookup;
    }

    const attrs = tbId ? attrsByTb.get(tbId) || {} : {};
    const deviceProfile = attrs.deviceProfile || 'N/D';
    let deviceTypeToDisplay = attrs.deviceType || '3F_MEDIDOR';

    if (deviceTypeToDisplay === '3F_MEDIDOR' && deviceProfile !== 'N/D') {
      deviceTypeToDisplay = deviceProfile;
    }

    // Extract telemetry data from ThingsBoard ctx.data
    // - TANK/CAIXA_DAGUA: water_level, water_percentage
    // - ENERGY devices: consumption (most recent value)
    // - TERMOSTATO: temperature (min/max come from global dataKeys)
    let waterLevel = null;
    let waterPercentage = null;
    let consumption = null;
    let instantaneousPower = null;
    let temperature = null;
    const isTankDevice = deviceTypeToDisplay === 'TANK' || deviceTypeToDisplay === 'CAIXA_DAGUA';
    const isTermostatoDevice = deviceTypeToDisplay === 'TERMOSTATO';

    // Debug log for device type detection
    //LogHelper.log(`[DeviceCards] Device ${r.label}: deviceType=${deviceTypeToDisplay}, isTermostato=${isTermostatoDevice}`);

    if (tbId) {
      // Search for telemetry in ctx.data for this specific device
      const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];

      // Debug: log all available telemetry keys for this device
      if (isTermostatoDevice) {
        const deviceKeys = rows
          .filter((row) => (row?.datasource?.entityId?.id || row?.datasource?.entityId) === tbId)
          .map((row) => row?.dataKey?.name);
        //LogHelper.log(`[DeviceCards] TERMOSTATO tbId=${tbId}, available telemetry keys:`, deviceKeys);
      }

      for (const row of rows) {
        const rowTbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
        if (rowTbId === tbId) {
          const key = String(row?.dataKey?.name || '').toLowerCase();
          const val = row?.data?.[0]?.[1]; // Most recent value

          // TANK specific telemetry
          if (key === 'water_level') waterLevel = Number(val) || 0;
          if (key === 'water_percentage') waterPercentage = Number(val) || 0;

          // ENERGY/WATER devices: consumption (most recent)
          if (key === 'consumption') consumption = Number(val) || 0;
          if (key === 'consumption_power') instantaneousPower = Number(val) || 0;

          // TERMOSTATO specific telemetry
          if (key === 'temperature') {
            temperature = Number(val) || 0;
            /*
            LogHelper.log(
              `[DeviceCards] Found temperature telemetry: key=${key}, val=${val}, parsed=${temperature}`
            );
            */
          }
        }
      }
    }

    // Calculate deviceStatus based on connectionStatus and current telemetry value
    // connectionStatus comes from TB attribute: "online" or "offline"
    const tbConnectionStatus = attrs.connectionStatus; // "online" or "offline" from TB
    let deviceStatus = 'no_info'; // default

    // RFC-0091: Parse deviceMapInstaneousPower from ctx.data (TIER 0 - highest priority)
    let deviceMapLimits = null;
    if (attrs.deviceMapInstaneousPower && typeof attrs.deviceMapInstaneousPower === 'string') {
      try {
        deviceMapLimits = JSON.parse(attrs.deviceMapInstaneousPower);
      } catch (e) {
        LogHelper.warn(`[RFC-0091] Failed to parse deviceMapInstaneousPower for ${tbId}:`, e.message);
      }
    }

    let log_annotations_Parsed = null;
    if (attrs.log_annotations && typeof attrs.log_annotations === 'string') {
      try {
        log_annotations_Parsed = JSON.parse(attrs.log_annotations);
        LogHelper.log(`[TELEMETRY] OK parse log_annotations for ${tbId}:`, log_annotations_Parsed);
      } catch (e) {
        LogHelper.warn(`[RFC-0091] Failed to parse log_annotations for ${tbId}:`, e.message);
      }
    }

    if (tbConnectionStatus === 'offline') {
      deviceStatus = 'no_info'; // offline = no_info
    } else if (tbConnectionStatus === 'online') {
      // RFC-0078: For energy devices, calculate status using ranges from mapInstantaneousPower
      const isEnergyDevice = !isTankDevice && !isTermostatoDevice;

      if (isEnergyDevice) {
        // RFC-0091: Use hierarchical resolution - TIER 0 (deviceMap) > TIER 2 (customer/MAP_INSTANTANEOUS_POWER)
        // First try device-specific limits, then fall back to customer-level
        const limitsToUse = deviceMapLimits || MAP_INSTANTANEOUS_POWER;
        const ranges = limitsToUse
          ? extractLimitsFromJSON(limitsToUse, deviceTypeToDisplay, 'consumption')
          : null;

        if (ranges && typeof MyIOLibrary?.calculateDeviceStatusWithRanges === 'function') {
          deviceStatus = MyIOLibrary.calculateDeviceStatusWithRanges({
            connectionStatus: tbConnectionStatus,
            lastConsumptionValue: instantaneousPower,
            ranges: ranges,
          });

          const source = deviceMapLimits
            ? 'deviceMapInstaneousPower (TIER 0)'
            : 'mapInstantaneousPower (TIER 2)';
        } else {
          // Fallback if no ranges found or MyIOLibrary not available
          deviceStatus = 'power_on';
        }
      } else {
        // TANK, TERMOSTATO - use simple power_on
        deviceStatus = 'power_on';
      }
    }

    // Determine value based on device type
    let deviceValue = 0;
    if (isTankDevice) {
      deviceValue = waterLevel || 0;
    } else if (isTermostatoDevice) {
      deviceValue = temperature || 0;
    }

    // Calculate temperatureStatus: 'ok', 'above', 'below', or null
    // Uses global min/max from dataKeys (not per-device)
    let temperatureStatus = null;
    if (isTermostatoDevice && temperature !== null) {
      if (globalTempMax !== null && temperature > globalTempMax) {
        temperatureStatus = 'above';
      } else if (globalTempMin !== null && temperature < globalTempMin) {
        temperatureStatus = 'below';
      } else {
        temperatureStatus = 'ok';
      }
      /*
      LogHelper.log(
        `[DeviceCards] TERMOSTATO status: temp=${temperature}, min=${globalTempMin}, max=${globalTempMax}, status=${temperatureStatus}`
      );
      */
    }    

    return {
      id: tbId || itemId, // para seleção/toggle
      tbId, // ThingsBoard deviceId (Settings)
      // ingestionId logic:
      // - Energy devices: itemId is the ingestionId (isDirectTbId=false), use it for API matching
      // - Termostatos: itemId is the tbId (isDirectTbId=true), use null to avoid Settings validation failing
      ingestionId: attrs.ingestionId || (isDirectTbId ? null : itemId),
      identifier: r.identifier,
      label: r.label,
      slaveId: attrs.slaveId ?? null,
      centralId: attrs.centralId ?? null,
      centralName: attrs.centralName ?? null,
      customerName: attrs.customerName ?? null,
      deviceType: deviceTypeToDisplay,
      updatedIdentifiers: {},
      connectionStatusTime: attrs.lastConnectTime ?? null,
      lastDisconnectTime: attrs.lastDisconnectTime ?? null,
      timeVal: attrs.lastActivityTime ?? null,
      deviceStatus: deviceStatus, // Calculated based on connectionStatus + value
      // TANK/CAIXA_DAGUA specific fields
      waterLevel: waterLevel,
      waterPercentage: waterPercentage,
      // TERMOSTATO specific fields (min/max are global from dataKeys)
      temperature: temperature,
      temperatureMin: globalTempMin,
      temperatureMax: globalTempMax,
      temperatureStatus: temperatureStatus,
      mapInstantaneousPower: MAP_INSTANTANEOUS_POWER,
      // RFC-0091: Include device-specific power limits for Settings modal
      deviceMapInstaneousPower: attrs.deviceMapInstaneousPower || null,
      log_annotations: log_annotations_Parsed || null,
      // Use appropriate value based on device type
      value: deviceValue,
      perc: isTankDevice ? waterPercentage || 0 : 0,
    };
  });

  // RFC-0097: Filter out 3F_MEDIDOR devices without proper deviceProfile for areacomum widget
  // These are generic meters that shouldn't be counted in area comum breakdown
  const widgetType = detectWidgetType();
  let filtered = mapped;

  if (widgetType === 'areacomum') {
    filtered = mapped.filter((item) => {
      // Keep item unless it's a 3F_MEDIDOR with 3F_MEDIDOR deviceProfile (no real type)
      const deviceType = String(item.deviceType || '').toUpperCase();
      const deviceProfile = String(item.deviceProfile || '').toUpperCase();

      // Discard if deviceType = 3F_MEDIDOR AND deviceProfile is also 3F_MEDIDOR or empty/N/D
      if (
        deviceType === '3F_MEDIDOR' &&
        (deviceProfile === '3F_MEDIDOR' || deviceProfile === 'N/D' || !deviceProfile)
      ) {
        LogHelper.log(
          `[RFC-0097] Filtering out 3F_MEDIDOR without proper deviceProfile: label="${item.label}", deviceProfile="${deviceProfile}"`
        );
        return false;
      }
      return true;
    });

    LogHelper.log(`[RFC-0097] Filtered areacomum items: ${mapped.length} → ${filtered.length}`);
  }

  //LogHelper.log(`[DeviceCards] TB items: ${filtered.length}`);
  return filtered;
}

/**
 * RFC-0106: DEPRECATED - fetchApiTotals removed.
 * All API calls now go through the orchestrator in MAIN_VIEW.
 * Data is received via 'myio:telemetry:provide-data' event from orchestrator.
 *
 * Previously this function called:
 * /api/v1/telemetry/customers/${CUSTOMER_ING_ID}/energy/devices/totals
 *
 * Now the orchestrator (MAIN_VIEW) makes this call once and distributes to all widgets.
 */
// function fetchApiTotals(startISO, endISO) { /* REMOVED BY RFC-0106 */ }

/**
 * RFC-0106: DEPRECATED - enrichItemsWithTotals no longer used.
 * Data enrichment is now handled by dataProvideHandler which receives
 * pre-enriched data from the orchestrator.
 *
 * @deprecated Use dataProvideHandler for data enrichment
 */
function enrichItemsWithTotals(items, apiMap) {
  LogHelper.warn('[RFC-0106] enrichItemsWithTotals is deprecated - data should come from orchestrator');
  return items.map((it) => {
    // For temperature domain, preserve the value from ctx.data (buildAuthoritativeItems)
    if (WIDGET_DOMAIN === 'temperature') {
      return { ...it, perc: 0 };
    }

    let raw = 0;

    if (it.ingestionId && isValidUUID(it.ingestionId)) {
      const row = apiMap.get(String(it.ingestionId));
      raw = Number(row?.total_value ?? 0);
    }

    const value = Number(raw || 0);

    return { ...it, value, perc: 0 };
  });
}

/** ===================== FILTERS / SORT / PERC ===================== **/
function applyFilters(enriched, searchTerm, selectedIds, sortMode) {
  let v = enriched.slice();

  if (selectedIds && selectedIds.size) {
    v = v.filter((x) => selectedIds.has(x.id));
  }

  const q = (searchTerm || '').trim().toLowerCase();
  if (q) {
    v = v.filter(
      (x) =>
        (x.label || '').toLowerCase().includes(q) ||
        String(x.identifier || '')
          .toLowerCase()
          .includes(q)
    );
  }

  v.sort((a, b) => {
    if (sortMode === 'cons_desc') {
      if (a.value !== b.value) return b.value - a.value;
      return (a.label || '').localeCompare(b.label || '', 'pt-BR', {
        sensitivity: 'base',
      });
    }
    if (sortMode === 'cons_asc') {
      if (a.value !== b.value) return a.value - b.value;
      return (a.label || '').localeCompare(b.label || '', 'pt-BR', {
        sensitivity: 'base',
      });
    }
    if (sortMode === 'alpha_desc') {
      return (
        (b.label || '').localeCompare(a.label || '', 'pt-BR', {
          sensitivity: 'base',
        }) || b.value - a.value
      );
    }
    return (
      (a.label || '').localeCompare(b.label || '', 'pt-BR', {
        sensitivity: 'base',
      }) || a.value - b.value
    );
  });

  return v;
}

function recomputePercentages(visible) {
  const groupSum = visible.reduce((acc, x) => acc + (x.value || 0), 0);
  const updated = visible.map((x) => ({
    ...x,
    perc: groupSum > 0 ? (x.value / groupSum) * 100 : 0,
  }));
  return { visible: updated, groupSum };
}

/** ===================== TEMPERATURE INFO TOOLTIP ===================== **/
// Now uses TempSensorSummaryTooltip from myio-js-library (premium tooltip with drag, pin, maximize, close)

/**
 * Build temperature sensor data for the TempSensorSummaryTooltip
 * @returns {Object} Data object for TempSensorSummaryTooltip.show()
 */
function buildTempSensorSummaryData() {
  const tempMin = window.MyIOUtils?.temperatureLimits?.minTemperature;
  const tempMax = window.MyIOUtils?.temperatureLimits?.maxTemperature;
  const hasLimits = tempMin != null && tempMax != null;

  const devices = [];

  if (window._telemetryAuthoritativeItems) {
    window._telemetryAuthoritativeItems.forEach((item) => {
      if (item.deviceType === 'TERMOSTATO') {
        const temp = Number(item.value) || 0;

        let status = 'unknown';
        if (hasLimits) {
          status = (temp >= tempMin && temp <= tempMax) ? 'ok' : 'warn';
        }

        devices.push({
          name: item.label || item.identifier || 'Sensor',
          temp: temp,
          status: status,
        });
      }
    });
  }

  return {
    devices,
    temperatureMin: tempMin,
    temperatureMax: tempMax,
    title: 'Detalhes de Temperatura'
  };
}

// Cleanup function for tooltip (stored globally for widget destroy)
let _tempTooltipCleanup = null;

// ============================================
// LEGACY CODE BELOW - DEPRECATED (kept for reference)
// Use MyIO.TempSensorSummaryTooltip instead
// ============================================

const TEMP_INFO_TOOLTIP_CSS_LEGACY = `
  .temp-info-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%);
    border: 1px solid #fdba74;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-right: 8px;
    flex-shrink: 0;
  }
  .temp-info-trigger:hover {
    background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(251, 146, 60, 0.3);
  }
  .temp-info-trigger svg {
    color: #c2410c;
  }
  .temp-info-tooltip-container {
    position: fixed;
    z-index: 99999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.25s ease, transform 0.25s ease;
    transform: translateY(5px);
  }
  .temp-info-tooltip-container.visible {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }
  .temp-info-tooltip {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.08);
    min-width: 320px;
    max-width: 400px;
    font-size: 12px;
    color: #1e293b;
    overflow: hidden;
    font-family: Inter, system-ui, -apple-system, sans-serif;
  }
  .temp-info-tooltip__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 18px;
    background: linear-gradient(90deg, #fff7ed 0%, #fef3c7 100%);
    border-bottom: 1px solid #fed7aa;
  }
  .temp-info-tooltip__icon { font-size: 18px; }
  .temp-info-tooltip__title {
    font-weight: 700;
    font-size: 14px;
    color: #c2410c;
    letter-spacing: 0.3px;
  }
  .temp-info-tooltip__content {
    padding: 16px 18px;
    max-height: 500px;
    overflow-y: auto;
  }
  .temp-info-tooltip__section {
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f1f5f9;
  }
  .temp-info-tooltip__section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
  .temp-info-tooltip__section-title {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .temp-info-tooltip__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    gap: 12px;
  }
  .temp-info-tooltip__label {
    color: #64748b;
    font-size: 12px;
    flex-shrink: 0;
  }
  .temp-info-tooltip__value {
    color: #1e293b;
    font-weight: 600;
    text-align: right;
  }
  .temp-info-tooltip__value--highlight {
    color: #ea580c;
    font-weight: 700;
    font-size: 14px;
  }
  .temp-info-tooltip__badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }
  .temp-info-tooltip__badge--ok {
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }
  .temp-info-tooltip__badge--warn {
    background: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
  }
  .temp-info-tooltip__badge--info {
    background: #e0e7ff;
    color: #4338ca;
    border: 1px solid #c7d2fe;
  }
  .temp-info-tooltip__list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }
  .temp-info-tooltip__list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #f8fafc;
    border-radius: 6px;
    font-size: 11px;
  }
  .temp-info-tooltip__list-item--ok { border-left: 3px solid #22c55e; background: #f0fdf4; }
  .temp-info-tooltip__list-item--warn { border-left: 3px solid #f59e0b; background: #fffbeb; }
  .temp-info-tooltip__list-item--unknown { border-left: 3px solid #6b7280; background: #f3f4f6; }
  .temp-info-tooltip__list-icon { font-size: 12px; flex-shrink: 0; }
  .temp-info-tooltip__list-name { flex: 1; color: #334155; font-weight: 500; }
  .temp-info-tooltip__list-value { color: #475569; font-size: 11px; font-weight: 500; }
  .temp-info-tooltip__list-range { color: #94a3b8; font-size: 10px; }
  .temp-info-tooltip__notice {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    margin-top: 12px;
  }
  .temp-info-tooltip__notice-icon { font-size: 14px; flex-shrink: 0; }
  .temp-info-tooltip__notice-text { font-size: 10px; color: #1e40af; line-height: 1.5; }
`;

function ensureTempInfoTooltipCSS() {
  if (document.getElementById('temp-info-tooltip-styles')) return;
  const style = document.createElement('style');
  style.id = 'temp-info-tooltip-styles';
  style.textContent = TEMP_INFO_TOOLTIP_CSS;
  document.head.appendChild(style);
}

function createTempInfoTooltipContainer() {
  const existing = document.getElementById('temp-info-tooltip');
  if (existing) return existing;

  ensureTempInfoTooltipCSS();

  const container = document.createElement('div');
  container.id = 'temp-info-tooltip';
  container.className = 'temp-info-tooltip-container';
  document.body.appendChild(container);
  return container;
}

function showTempInfoTooltip(triggerElement) {
  const container = createTempInfoTooltipContainer();

  // Get temperature data from current visible items
  const tempMin = window.MyIOUtils?.temperatureLimits?.minTemperature;
  const tempMax = window.MyIOUtils?.temperatureLimits?.maxTemperature;
  const hasLimits = tempMin != null && tempMax != null;

  // Collect data from authoritativeItems (already filtered for TERMOSTATO)
  const tempDevices = [];
  let totalTemp = 0;
  let devicesInRange = 0;
  let devicesOutOfRange = 0;
  let devicesUnknown = 0;

  if (window._telemetryAuthoritativeItems) {
    window._telemetryAuthoritativeItems.forEach((item) => {
      if (item.deviceType === 'TERMOSTATO') {
        const temp = Number(item.value) || 0;
        totalTemp += temp;

        let status = 'unknown';
        if (hasLimits) {
          if (temp >= tempMin && temp <= tempMax) {
            status = 'ok';
            devicesInRange++;
          } else {
            status = 'warn';
            devicesOutOfRange++;
          }
        } else {
          devicesUnknown++;
        }

        tempDevices.push({
          name: item.label || item.identifier || 'Sensor',
          temp: temp,
          status: status,
        });
      }
    });
  }

  const avgTemp = tempDevices.length > 0 ? totalTemp / tempDevices.length : 0;

  // Build status badge
  let statusBadge = '';
  if (tempDevices.length === 0) {
    statusBadge =
      '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--info">Aguardando dados</span>';
  } else if (!hasLimits) {
    statusBadge =
      '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--info">Faixa nao configurada</span>';
  } else if (devicesOutOfRange === 0) {
    statusBadge = '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--ok">Todos na faixa</span>';
  } else if (devicesInRange === 0) {
    statusBadge =
      '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--warn">Todos fora da faixa</span>';
  } else {
    statusBadge =
      '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--warn">' +
      devicesOutOfRange +
      ' fora da faixa</span>';
  }

  // Build device list HTML
  let deviceListHtml = '';
  if (tempDevices.length > 0 && 3 > 2) {
    const sortedDevices = [...tempDevices].sort((a, b) => b.temp - a.temp);
    const displayDevices = sortedDevices.slice(0, 5); // Show max 8
    const hasMore = sortedDevices.length > 5;

    deviceListHtml = `
      <div class="temp-info-tooltip__section">
        <div class="temp-info-tooltip__section-title">
          <span>🌡️</span> Sensores (${tempDevices.length})
        </div>
        <div class="temp-info-tooltip__list">
          ${displayDevices
        .map((d) => {
          const statusClass = d.status === 'ok' ? 'ok' : d.status === 'warn' ? 'warn' : 'unknown';
          const icon = d.status === 'ok' ? '✔' : d.status === 'warn' ? '⚠' : '?';
          return `
              <div class="temp-info-tooltip__list-item temp-info-tooltip__list-item--${statusClass}">
                <span class="temp-info-tooltip__list-icon">${icon}</span>
                <span class="temp-info-tooltip__list-name">${d.name}</span>
                <span class="temp-info-tooltip__list-value">${d.temp.toFixed(1)}°C</span>
              </div>
            `;
        })
        .join('')}
          ${hasMore
        ? `<div style="text-align: center; color: #94a3b8; font-size: 10px; padding: 4px;">... e mais ${sortedDevices.length - 5
        } sensores</div>`
        : ''
      }
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="temp-info-tooltip">
      <div class="temp-info-tooltip__header">
        <span class="temp-info-tooltip__icon">🌡️</span>
        <span class="temp-info-tooltip__title">Detalhes de Temperatura</span>
      </div>
      <div class="temp-info-tooltip__content">
        <div class="temp-info-tooltip__section">
          <div class="temp-info-tooltip__section-title">
            <span>📊</span> Resumo
          </div>
          <div class="temp-info-tooltip__row">
            <span class="temp-info-tooltip__label">Media Geral:</span>
            <span class="temp-info-tooltip__value temp-info-tooltip__value--highlight">${avgTemp.toFixed(
    1
  )}°C</span>
          </div>
          ${hasLimits
      ? `
          <div class="temp-info-tooltip__row">
            <span class="temp-info-tooltip__label">Faixa Ideal:</span>
            <span class="temp-info-tooltip__value">${tempMin}°C - ${tempMax}°C</span>
          </div>
          `
      : ''
    }
          <div class="temp-info-tooltip__row">
            <span class="temp-info-tooltip__label">Sensores Ativos:</span>
            <span class="temp-info-tooltip__value">${tempDevices.length}</span>
          </div>
          <div class="temp-info-tooltip__row">
            <span class="temp-info-tooltip__label">Status:</span>
            ${statusBadge}
          </div>
        </div>

        ${deviceListHtml}

        <div class="temp-info-tooltip__notice">
          <span class="temp-info-tooltip__notice-icon">ℹ️</span>
          <span class="temp-info-tooltip__notice-text">
            Considerados apenas sensores <strong>TERMOSTATO</strong> ativos.
          </span>
        </div>
      </div>
    </div>
  `;

  // Position tooltip
  const rect = triggerElement.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 8;

  // Adjust if goes off screen
  if (left + 340 > window.innerWidth - 10) left = window.innerWidth - 350;
  if (left < 10) left = 10;
  if (top + 400 > window.innerHeight) {
    top = rect.top - 8 - 400;
    if (top < 10) top = 10;
  }

  container.style.left = left + 'px';
  container.style.top = top + 'px';
  container.classList.add('visible');
}

function hideTempInfoTooltip() {
  const container = document.getElementById('temp-info-tooltip');
  if (container) {
    container.classList.remove('visible');
  }
}

/** ===================== RENDER ===================== **/
function renderHeader(count, groupSum) {
  $count().text(`(${count})`);

  // Format based on widget domain
  let formattedTotal = groupSum.toFixed(2);
  if (WIDGET_DOMAIN === 'energy') {
    formattedTotal = MyIO.formatEnergy(groupSum);
  } else if (WIDGET_DOMAIN === 'water') {
    formattedTotal = MyIO.formatWaterVolumeM3(groupSum);
  } else if (WIDGET_DOMAIN === 'tank') {
    formattedTotal = MyIO.formatTankHeadFromCm(groupSum);
  } else if (WIDGET_DOMAIN === 'temperature') {
    // For temperature, show count instead of sum (summing temperatures doesn't make sense)
    formattedTotal = `${count} sensor${count !== 1 ? 'es' : ''}`;
  }

  $total().text(formattedTotal);
}

function renderList(visible) {
  const $ul = $list().empty();

  // Calculate average temperature for TERMOSTATO devices (for TempComparisonTooltip)
  let avgTemperature = null;
  let tempDeviceCount = 0;
  if (WIDGET_DOMAIN === 'temperature') {
    let totalTemp = 0;
    visible.forEach((item) => {
      if (item.deviceType === 'TERMOSTATO') {
        totalTemp += Number(item.value || 0);
        tempDeviceCount++;
      }
    });
    if (tempDeviceCount > 0) {
      avgTemperature = totalTemp / tempDeviceCount;
    }
  }

  visible.forEach((it) => {
    // For temperature domain, only render TERMOSTATO devices
    if (WIDGET_DOMAIN === 'temperature' && it.deviceType !== 'TERMOSTATO') {
      return; // Skip non-TERMOSTATO devices in temperature domain
    }

    const valNum = Number(it.value || 0);

    // Note: deviceStatus comes from buildAuthoritativeItems (based on TB connectionStatus + telemetry)
    // Don't recalculate here - it would be incorrect for ENERGY devices

    // RFC-0097: Safe identifier handling with fallbacks using centralized function
    let deviceIdentifierToDisplay = 'N/A';
    if (it.identifier && !String(it.identifier).includes('Sem Identificador identificado')) {
      // Valid identifier attribute
      deviceIdentifierToDisplay = it.identifier;
    } else {
      // No valid identifier - infer from deviceType or label
      deviceIdentifierToDisplay = inferDisplayIdentifier(it);
    }


    // RFC-0106: Use effectiveDeviceType for card icon (deviceProfile > deviceType)
    // This ensures proper icon rendering based on actual device classification
    const cardDeviceType = it.effectiveDeviceType || it.deviceProfile || it.deviceType || 'N/A';

    const entityObject = {
      entityId: it.tbId || it.id, // preferir TB deviceId
      labelOrName: it.label.toUpperCase(),
      deviceType: cardDeviceType, // RFC-0106: Use effectiveDeviceType for proper icon
      val: valNum, // TODO verificar ESSE MULTIPLICADOR PQ PRECISA DELE ?
      perc: it.perc ?? 0,
      deviceStatus: it.deviceStatus || 'no_info', // Use from buildAuthoritativeItems (based on TB connectionStatus + telemetry)
      entityType: 'DEVICE',
      deviceIdentifier: deviceIdentifierToDisplay,
      slaveId: it.slaveId || 'N/A',
      ingestionId: it.ingestionId || 'N/A',
      centralId: it.centralId || 'N/A',
      centralName: it.centralName || '',
      customerName: it.customerName || null,
      updatedIdentifiers: it.updatedIdentifiers || {},
      connectionStatusTime: it.connectionStatusTime || Date.now(),
      timeVal: it.timeVal || Date.now(),
      powerRanges: it.powerRanges || null,
      instantaneousPower: it.instantaneousPower || 0,
      // TANK/CAIXA_DAGUA specific fields
      waterLevel: it.waterLevel || null,
      waterPercentage: it.waterPercentage || null,
      // TERMOSTATO specific fields
      temperature: it.temperature || null,
      temperatureMin: it.temperatureMin || null,
      temperatureMax: it.temperatureMax || null,
      temperatureStatus: it.temperatureStatus || null,
      // Average temperature across all TERMOSTATO devices (for TempComparisonTooltip)
      averageTemperature: avgTemperature,
      temperatureDeviceCount: tempDeviceCount,
      log_annotations: it.log_annotations || null,
    };

    if (it.label === 'Chiller 1') {
      LogHelper.log('RENDER CARD ALLEGRIA >>> OBJ: ', it);
    }

    const myTbToken = localStorage.getItem('jwt_token');
    let cachedIngestionToken = null;

    // RFC-0082 FIX: Check if MyIOAuth is initialized before calling getToken()
    if (MyIOAuth && typeof MyIOAuth.getToken === 'function') {
      MyIOAuth.getToken()
        .then((token) => {
          cachedIngestionToken = token;
        })
        .catch((err) => LogHelper.warn('Token cache failed:', err));
    } else {
      LogHelper.warn('[TELEMETRY] MyIOAuth not initialized yet, skipping token cache');
    }

    const $card = MyIO.renderCardComponentV5({
      entityObject,
      useNewComponents: true, // Habilitar novos componentes
      enableSelection: true, // Habilitar seleção
      enableDragDrop: true, // Habilitar drag and drop

      handleActionDashboard: async () => {
        const jwtToken = localStorage.getItem('jwt_token');
        const MyIOToast = MyIOLibrary?.MyIOToast || window.MyIOToast;

        if (!jwtToken) {
          if (MyIOToast) {
            MyIOToast.error('Authentication required. Please login again.');
          } else {
            alert('Authentication required. Please login again.');
          }
          return;
        }

        // Get dates from MENU (startDateISO/endDateISO) and convert to timestamps
        const startDateISO = self.ctx?.scope?.startDateISO;
        const endDateISO = self.ctx?.scope?.endDateISO;
        const startTs = startDateISO ? new Date(startDateISO).getTime() : Date.now() - 86400000;
        const endTs = endDateISO ? new Date(endDateISO).getTime() : Date.now();
        const deviceType = it.deviceType || entityObject.deviceType;
        const isWaterTank = deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA';
        const isTermostato = deviceType === 'TERMOSTATO';

        LogHelper.log(
          '[TELEMETRY v5] Opening dashboard for deviceType:',
          deviceType,
          'isWaterTank:',
          isWaterTank,
          'isTermostato:',
          isTermostato,
          'deviceId:',
          it.id,
          'tbId:',
          it.tbId,
          'startDateISO:',
          startDateISO,
          'endDateISO:',
          endDateISO,
          'startTs:',
          startTs,
          'endTs:',
          endTs
        );

        // Show loading toast
        let loadingToast = null;
        if (MyIOToast) {
          const loadingMsg = isTermostato
            ? 'Carregando dados de temperatura...'
            : isWaterTank
              ? 'Loading water tank data...'
              : 'Loading energy data...';
          loadingToast = MyIOToast.info(loadingMsg, 0);
        }

        try {
          if (isTermostato) {
            // Temperature/TERMOSTATO Modal Path - RFC-0085
            // Uses MyIOLibrary.openTemperatureModal instead of inline implementation
            LogHelper.log('[TELEMETRY v5] Entering TERMOSTATO device modal path (MyIOLibrary)...');

            const deviceId = it.tbId || it.id;

            // Get temperature-related properties from entity
            // Priority: device attributes > entity attributes > global customer limits (MyIOUtils)
            const currentTemp = it.temperature || entityObject.temperature;
            const tempMinRange =
              it.temperatureMin ??
              it.minTemperature ??
              entityObject.temperatureMin ??
              entityObject.minTemperature ??
              window.MyIOUtils?.temperatureLimits?.minTemperature ??
              null;
            const tempMaxRange =
              it.temperatureMax ??
              it.maxTemperature ??
              entityObject.temperatureMax ??
              entityObject.maxTemperature ??
              window.MyIOUtils?.temperatureLimits?.maxTemperature ??
              null;
            const tempStatus = it.temperatureStatus || entityObject.temperatureStatus;

            LogHelper.log('[TELEMETRY v5] Temperature range from entity/scope:', {
              tempMinRange,
              tempMaxRange,
            });

            // Check if MyIOLibrary.openTemperatureModal is available
            if (typeof MyIOLibrary?.openTemperatureModal !== 'function') {
              const errorMsg = 'Temperature modal not available. Please update MyIO library.';
              LogHelper.error('[TELEMETRY v5] ❌', errorMsg);
              throw new Error(errorMsg);
            }

            // Convert timestamps to ISO strings
            const startDateISO = new Date(startTs).toISOString();
            const endDateISO = new Date(endTs).toISOString();

            LogHelper.log('[TELEMETRY v5] Calling openTemperatureModal with params:', {
              deviceId: deviceId,
              startDate: startDateISO,
              endDate: endDateISO,
              label: it.label || it.name,
              currentTemperature: currentTemp,
              temperatureMin: tempMinRange,
              temperatureMax: tempMaxRange,
              temperatureStatus: tempStatus,
            });

            const modalHandle = MyIOLibrary.openTemperatureModal({
              token: jwtToken,
              deviceId: deviceId,
              startDate: startDateISO,
              endDate: endDateISO,
              label: it.label || it.name || 'Sensor de Temperatura',
              currentTemperature: currentTemp,
              temperatureMin: tempMinRange,
              temperatureMax: tempMaxRange,
              temperatureStatus: tempStatus,
              theme: 'dark',
              locale: 'pt-BR',
              granularity: 'hour',
              onClose: () => {
                LogHelper.log('[TELEMETRY v5] Temperature modal closed via MyIOLibrary');
              },
            });

            // Hide loading toast and busy indicator AFTER modal is opened
            // Use setTimeout to ensure toast 'show' class has been applied before hiding
            // (MyIOToast adds 'show' class after 10ms delay)
            setTimeout(() => {
              if (loadingToast) loadingToast.hide();
              if (MyIOToast) MyIOToast.hide(); // Also call global hide as fallback
            }, 50);
            hideBusy();

            LogHelper.log('[TELEMETRY v5] ✅ Temperature modal opened via MyIOLibrary:', modalHandle);
            return; // Exit early - modal is now handling everything
          } else if (isWaterTank) {
            // Water Tank Modal Path
            LogHelper.log('[TELEMETRY v5] Entering TANK device modal path...');

            LogHelper.log(
              '[TELEMETRY v5] MyIOLibrary available:',
              typeof MyIOLibrary !== 'undefined',
              'openDashboardPopupWaterTank exists:',
              typeof MyIOLibrary?.openDashboardPopupWaterTank
            );

            if (typeof MyIOLibrary?.openDashboardPopupWaterTank !== 'function') {
              const errorMsg = 'Water tank modal not available. Please update MyIO library.';
              LogHelper.error('[TELEMETRY v5] ❌', errorMsg);
              throw new Error(errorMsg);
            }

            // For TANK/CAIXA_DAGUA: get water level from telemetry
            const waterLevel = getData('water_level');
            const waterPercentage = getData('water_percentage');
            const currentLevel = waterPercentage || it.perc || it.val || 0;

            LogHelper.log('[TELEMETRY v5] Water tank telemetry data:', {
              water_level: waterLevel,
              water_percentage: waterPercentage,
              currentLevel: currentLevel,
              it_perc: it.perc,
              it_val: it.val,
            });

            LogHelper.log('[TELEMETRY v5] Calling openDashboardPopupWaterTank with params:', {
              deviceId: it.id,
              deviceType: deviceType,
              startTs: typeof startTs === 'number' ? startTs : new Date(startTs).getTime(),
              endTs: typeof endTs === 'number' ? endTs : new Date(endTs).getTime(),
              label: it.label || it.name || 'Water Tank',
              currentLevel: currentLevel,
            });

            LogHelper.log('[TELEMETRY v5] ⏳ About to call openDashboardPopupWaterTank...');

            const modalHandle = await MyIOLibrary.openDashboardPopupWaterTank({
              deviceId: it.id,
              deviceType: deviceType,
              tbJwtToken: jwtToken,
              startTs: typeof startTs === 'number' ? startTs : new Date(startTs).getTime(),
              endTs: typeof endTs === 'number' ? endTs : new Date(endTs).getTime(),
              label: it.label || it.name || 'Water Tank',
              currentLevel: currentLevel,
              slaveId: it.slaveId,
              centralId: it.centralId,
              timezone: self.ctx?.timeWindow?.timezone || 'America/Sao_Paulo',
              telemetryKeys: ['water_level', 'water_percentage', 'waterLevel', 'nivel', 'level'],
              onOpen: (context) => {
                LogHelper.log('[TELEMETRY v5] ✅ Water tank modal opened successfully!', context);
                if (loadingToast) loadingToast.hide();
                hideBusy();
              },
              onClose: () => {
                LogHelper.log('[TELEMETRY v5] 🚪 Water tank modal onClose callback triggered');
              },
              onError: (error) => {
                LogHelper.error('[TELEMETRY v5] ❌ Water tank modal error:', error);
                if (loadingToast) loadingToast.hide();
                hideBusy();
                if (MyIOToast) {
                  MyIOToast.error(`Error: ${error.message}`);
                } else {
                  alert(`Error: ${error.message}`);
                }
              },
            });

            LogHelper.log('[TELEMETRY v5] ✅ Water tank modal handle received:', modalHandle);
          } else {
            // Energy/Water/Temperature Modal Path (Ingestion API)
            LogHelper.log('[TELEMETRY v5] Opening energy modal...');
            const tokenIngestionDashBoard = await MyIOAuth.getToken();
            const modal = MyIO.openDashboardPopupEnergy({
              deviceId: it.id,
              readingType: WIDGET_DOMAIN, // 'energy', 'water', or 'tank'
              startDate: self.ctx.scope.startDateISO,
              endDate: self.ctx.scope.endDateISO,
              tbJwtToken: jwtToken,
              ingestionToken: tokenIngestionDashBoard,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              onOpen: (context) => {
                LogHelper.log('[TELEMETRY v5] Energy modal opened:', context);
                if (loadingToast) loadingToast.hide();
                hideBusy();
              },
              onError: (error) => {
                LogHelper.error('[TELEMETRY v5] Energy modal error:', error);
                if (loadingToast) loadingToast.hide();
                hideBusy();
                if (MyIOToast) {
                  MyIOToast.error(`Erro: ${error.message}`);
                } else {
                  alert(`Erro: ${error.message}`);
                }
              },
              onClose: () => {
                LogHelper.log('[TELEMETRY v5] Energy modal closed');
              },
            });
          }
        } catch (err) {
          LogHelper.error('[TELEMETRY v5] Dashboard action failed:', err?.message || err, err);

          if (loadingToast) loadingToast.hide();
          hideBusy();

          if (MyIOToast) {
            MyIOToast.error(err?.message || 'Failed to open dashboard');
          } else {
            alert(err?.message || 'Failed to open dashboard');
          }
        }
      },

      handleActionReport: async () => {
        try {
          showBusy(); // mensagem fixa

          const deviceType = it.deviceType || entityObject.deviceType;
          const isTermostatoDevice = deviceType === 'TERMOSTATO';

          // For TERMOSTATO devices, reports use ThingsBoard API (no ingestion)
          if (isTermostatoDevice || WIDGET_DOMAIN === 'temperature') {
            LogHelper.log('[TELEMETRY v5] Temperature report - using ThingsBoard API');

            const jwtToken = localStorage.getItem('jwt_token');
            if (!jwtToken) {
              throw new Error('No JWT token available');
            }

            // Get device TB ID
            let tbId = it.tbId;
            if (!tbId || !isValidUUID(tbId)) {
              const idx = buildTbIdIndexes();
              tbId =
                (it.ingestionId && idx.byIngestion.get(it.ingestionId)) ||
                (it.identifier && idx.byIdentifier.get(it.identifier)) ||
                null;
            }

            if (!tbId) {
              LogHelper.warn('[TELEMETRY v5] No TB device ID for temperature report');
              const MyIOToast = MyIOLibrary?.MyIOToast || window.MyIOToast;
              if (MyIOToast) {
                MyIOToast.error('Nao foi possivel identificar o dispositivo.');
              }
              return;
            }

            LogHelper.log('[TELEMETRY v5] Opening temperature report for device:', {
              tbId,
              label: it.label,
              identifier: it.identifier,
            });

            // Create custom fetcher for ThingsBoard temperature data
            const temperatureFetcher = async ({ startISO, endISO }) => {
              const startTs = new Date(startISO).getTime();
              const endTs = new Date(endISO).getTime();

              LogHelper.log('[TELEMETRY v5] Fetching temperature data for report:', {
                startISO,
                endISO,
                startTs,
                endTs,
                tbId,
              });

              // Fetch temperature data from ThingsBoard with daily aggregation
              const url =
                `/api/plugins/telemetry/DEVICE/${tbId}/values/timeseries` +
                `?keys=temperature` +
                `&startTs=${encodeURIComponent(startTs)}` +
                `&endTs=${encodeURIComponent(endTs)}` +
                `&limit=50000` +
                `&intervalType=MILLISECONDS` +
                `&interval=86400000` + // 24 hours in ms (daily aggregation)
                `&agg=AVG`;

              const response = await fetch(url, {
                headers: {
                  'X-Authorization': `Bearer ${jwtToken}`,
                  'Content-Type': 'application/json',
                },
              });

              if (!response.ok) {
                throw new Error(`ThingsBoard API error: ${response.status}`);
              }

              const data = await response.json();
              LogHelper.log('[TELEMETRY v5] ThingsBoard temperature response:', data);

              // Transform ThingsBoard response to match expected format for report modal
              const tempValues = data?.temperature || [];

              if (tempValues.length === 0) {
                LogHelper.warn('[TELEMETRY v5] No temperature data returned from ThingsBoard');
                return [];
              }

              // Helper function to clamp temperature values (avoid outliers)
              // Values below 15°C are clamped to 15, values above 40°C are clamped to 40
              const clampTemp = (v) => {
                const num = Number(v || 0);
                if (num < 15) return 15;
                if (num > 40) return 40;
                return num;
              };

              // Group by day and calculate average (ThingsBoard may return multiple points per day)
              const dailyMap = {};
              tempValues.forEach((item) => {
                const date = new Date(item.ts);
                const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
                if (!dailyMap[dateKey]) {
                  dailyMap[dateKey] = { sum: 0, count: 0 };
                }
                // Clamp each value before aggregating
                dailyMap[dateKey].sum += clampTemp(item.value);
                dailyMap[dateKey].count += 1;
              });

              // Convert to array format expected by DeviceReportModal
              const consumption = Object.entries(dailyMap).map(([date, stats]) => ({
                timestamp: date + 'T00:00:00.000Z',
                value: stats.sum / stats.count, // Average temperature for the day (already clamped)
              }));

              LogHelper.log('[TELEMETRY v5] Processed temperature data for report:', {
                daysCount: consumption.length,
                consumption,
              });

              // Return in the format expected by DeviceReportModal.processApiResponse
              return [
                {
                  deviceId: tbId,
                  consumption: consumption,
                },
              ];
            };

            // Open the report modal with custom temperature fetcher
            await MyIO.openDashboardPopupReport({
              ingestionId: it.ingestionId || tbId, // Use tbId as fallback
              deviceId: tbId,
              identifier: it.identifier,
              label: it.label,
              domain: 'temperature',
              fetcher: temperatureFetcher, // Custom fetcher for ThingsBoard data
              api: {
                // These are not used when custom fetcher is provided, but required by interface
                dataApiBaseUrl: '',
                clientId: '',
                clientSecret: '',
                ingestionToken: jwtToken,
              },
            });

            return;
          }

          if (!isAuthReady()) throw new Error('Auth not ready');

          const ingestionToken = await MyIOAuth.getToken();

          if (!ingestionToken) throw new Error('No ingestion token');

          await MyIO.openDashboardPopupReport({
            ingestionId: it.ingestionId, // sempre ingestionId
            identifier: it.identifier,
            label: it.label,
            domain: WIDGET_DOMAIN, // 'energy', 'water', or 'temperature'
            api: {
              dataApiBaseUrl: DATA_API_HOST,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              ingestionToken,
            },
          });
        } catch (err) {
          LogHelper.warn('[DeviceCards] Report open blocked:', err?.message || err);
          alert('Credenciais ainda carregando. Tente novamente em instantes.');
        } finally {
          hideBusy();
        }
      },

      handleActionSettings: async () => {
        showBusy(null, 3000); // mensagem fixa
        // resolve TB id “fresh”
        let tbId = it.tbId;

        if (!tbId || !isValidUUID(tbId)) {
          const idx = buildTbIdIndexes();
          tbId =
            (it.ingestionId && idx.byIngestion.get(it.ingestionId)) ||
            (it.identifier && idx.byIdentifier.get(it.identifier)) ||
            null;
        }

        if (!tbId || tbId === it.ingestionId) {
          LogHelper.warn('[DeviceCards] Missing/ambiguous TB id for Settings', {
            label: it.label,
            identifier: it.identifier,
            ingestionId: it.ingestionId,
            tbId,
          });
          hideBusy();
          const MyIOToast = window.MyIOLibrary?.MyIOToast;
          if (MyIOToast) {
            MyIOToast.error('Não foi possível identificar o deviceId do ThingsBoard para este card.', 5000);
          }
          return;
        }

        const jwt = localStorage.getItem('jwt_token');

        try {
          // RFC-0080 + RFC-0091: Get customerId from MAIN widget via window.MyIOUtils
          const customerTbId = window.MyIOUtils?.customerTB_ID || null;

          // RFC-XXXX: SuperAdmin flag from MAIN_VIEW
          const isSuperAdmin = window.MyIOUtils?.SuperAdmin || false;

          console.log(`[TELEMETRY] openDashboardPopupSettings > isSuperAdmin: `, isSuperAdmin);

          await MyIO.openDashboardPopupSettings({
            deviceId: tbId, // TB deviceId
            label: it.label,
            jwtToken: jwt,
            domain: WIDGET_DOMAIN,
            deviceType: it.deviceType,
            customerId: customerTbId, // RFC-0080: Pass customerId for GLOBAL fetch
            superadmin: isSuperAdmin, // RFC-XXXX: SuperAdmin mode
            connectionData: {
              centralName: it.centralName,
              connectionStatusTime: it.connectionStatusTime || null,
              lastDisconnectTime: it.lastDisconnectTime || null,
              timeVal: it.timeVal || null,
              deviceStatus: it.deviceStatus || 'no_info',
            },
            ui: { title: 'Configurações', width: 900 },
            mapInstantaneousPower: it.mapInstantaneousPower, // RFC-0078: Pass existing map if available
            // RFC-0091: Pass device-specific power limits (TIER 0 - highest priority)
            deviceMapInstaneousPower: it.deviceMapInstaneousPower || null,
            onSaved: (payload) => {
              LogHelper.log('[Settings Saved]', payload);
              //hideBusy();
              // Mostra modal global de sucesso com contador e reload
              // showGlobalSuccessModal(6);
            },
            onClose: () => {
              $('.myio-settings-modal-overlay').remove();
              hideBusy();
            },
          });
        } catch (e) {
          hideBusy();
        }
      },

      handleClickCard: () => {
        //LogHelper.log("Card clicado:", entityObject);
      },

      handleSelect: (entityObj) => {
        // NOTE: This callback is called during card rendering, NOT during user selection
        // Entity registration is handled by the 'myio:device-params' event listener instead
        // which is only triggered when the user actually clicks the checkbox
        LogHelper.log('[TELEMETRY] handleSelect called (no-op):', entityObj.labelOrName);
      },
    });

    // Append the returned element to wrapper
    if ($card && $card[0] && entityObject.log_annotations) {
      addAnnotationIndicator($card[0], entityObject);
    }

    $ul.append($card);
  });
}

/** ===================== UI BINDINGS ===================== **/
function bindHeader() {
  $root().on('click', '#btnSearch', () => {
    STATE.searchActive = !STATE.searchActive;
    $root().find('#searchWrap').toggleClass('active', STATE.searchActive);

    if (STATE.searchActive) setTimeout(() => $root().find('#shopsSearch').trigger('focus'), 30);
  });

  $root().on('input', '#shopsSearch', (ev) => {
    STATE.searchTerm = ev.target.value || '';
    reflowFromState();
  });

  $root().on('click', '#btnFilter', () => openFilterModal());
}

function openFilterModal() {
  const $m = $modal();
  const $cl = $m.find('#deviceChecklist').empty();

  const list = (STATE.itemsBase || []).slice().sort((a, b) =>
    (a.label || '').localeCompare(b.label || '', 'pt-BR', {
      sensitivity: 'base',
    })
  );

  if (!list.length) {
    $cl.html('<div class="muted">Nenhuma loja carregada.</div>');
    $m.removeClass('hidden');
    return;
  }

  const selected = STATE.selectedIds;
  const frag = document.createDocumentFragment();

  for (const it of list) {
    const safeId =
      String(it.id || '')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 60) || 'id' + Math.random().toString(36).slice(2);
    const checked = !selected || !selected.size || selected.has(it.id);

    const label = document.createElement('label');
    label.className = 'check-item';
    label.setAttribute('role', 'option');
    label.innerHTML = `
      <input type="checkbox" id="chk-${safeId}" data-entity="${escapeHtml(it.id)}" ${checked ? 'checked' : ''
      }>
      <span>${escapeHtml(it.label || it.identifier || it.id)}</span>
    `;
    frag.appendChild(label);
  }

  $cl[0].appendChild(frag);
  $m.find(`input[name="sortMode"][value="${STATE.sortMode}"]`).prop('checked', true);

  const $footer = $m.find('.shops-modal-footer');
  if ($footer.length) $footer.show().find('#applyFilters, #resetFilters').show();

  syncChecklistSelectionVisual();
  $m.removeClass('hidden');
}
function closeFilterModal() {
  $modal().addClass('hidden');
}

function bindModal() {
  $root().on('click', '#closeFilter', closeFilterModal);

  $root().on('click', '#selectAll', (ev) => {
    ev.preventDefault();
    $modal().find('.check-item input[type="checkbox"]').prop('checked', true);
    syncChecklistSelectionVisual();
  });

  $root().on('click', '#clearAll', (ev) => {
    ev.preventDefault();
    $modal().find('.check-item input[type="checkbox"]').prop('checked', false);
    syncChecklistSelectionVisual();
  });

  $root().on('click', '#resetFilters', (ev) => {
    ev.preventDefault();
    STATE.selectedIds = null;
    STATE.sortMode = 'cons_desc';
    $modal().find('.check-item input[type="checkbox"]').prop('checked', true);
    $modal().find('input[name="sortMode"][value="cons_desc"]').prop('checked', true);
    syncChecklistSelectionVisual();
    reflowFromState();
  });

  $root().on('click', '#applyFilters', (ev) => {
    ev.preventDefault();
    const set = new Set();
    $modal()
      .find('.check-item input[type="checkbox"]:checked')
      .each((_, el) => {
        const id = $(el).data('entity');
        if (id) set.add(id);
      });

    STATE.selectedIds = set.size === 0 || set.size === STATE.itemsBase.length ? null : set;
    STATE.sortMode = String($modal().find('input[name="sortMode"]:checked').val() || 'cons_desc');

    reflowFromState();
    closeFilterModal();
  });

  $root().on('input', '#filterDeviceSearch', (ev) => {
    const q = (ev.target.value || '').trim().toLowerCase();
    $modal()
      .find('.check-item')
      .each((_, node) => {
        const txt = $(node).text().trim().toLowerCase();
        $(node).toggle(txt.includes(q));
      });
  });

  $root().on('click', '#filterDeviceClear', (ev) => {
    ev.preventDefault();
    const $inp = $modal().find('#filterDeviceSearch');
    $inp.val('');
    $modal().find('.check-item').show();
    $inp.trigger('focus');
  });

  $root().on('click', '#deviceChecklist .check-item', function (ev) {
    if (ev.target && ev.target.tagName && ev.target.tagName.toLowerCase() === 'input') return;
    ev.preventDefault();
    ev.stopPropagation();
    const $chk = $(this).find('input[type="checkbox"]');
    $chk.prop('checked', !$chk.prop('checked')).trigger('change');
  });

  $root().on('change', '#deviceChecklist input[type="checkbox"]', function () {
    const $wrap = $(this).closest('.check-item');
    const on = this.checked;
    $wrap.toggleClass('selected', on).attr('data-checked', on ? 'true' : 'false');
    $wrap.css(
      on
        ? {
          background: 'rgba(62,26,125,.08)',
          borderColor: '#3E1A7D',
          boxShadow: '0 8px 18px rgba(62,26,125,.15)',
        }
        : {
          background: '#fff',
          borderColor: '#D6E1EC',
          boxShadow: '0 6px 14px rgba(0,0,0,.05)',
        }
    );
  });
}

function syncChecklistSelectionVisual() {
  $modal()
    .find('.check-item')
    .each(function () {
      const $el = $(this);
      const on = $el.find('input[type="checkbox"]').prop('checked');
      $el.toggleClass('selected', on).attr('data-checked', on ? 'true' : 'false');
      $el.css(
        on
          ? {
            background: 'rgba(62,26,125,.08)',
            borderColor: '#3E1A7D',
            boxShadow: '0 8px 18px rgba(62,26,125,.15)',
          }
          : {
            background: '#fff',
            borderColor: '#D6E1EC',
            boxShadow: '0 6px 14px rgba(0,0,0,.05)',
          }
      );
    });
}

/** ===================== RFC-0056 FIX v1.1: EMISSION ===================== **/

/**
 * Normaliza valor de kWh para MWh com 2 decimais
 * @param {number} kWhValue - valor em kWh
 * @returns {number} valor em MWh arredondado
 */
function normalizeToMWh(kWhValue) {
  if (typeof kWhValue !== 'number' || isNaN(kWhValue)) return 0;
  return Math.round((kWhValue / 1000) * 100) / 100;
}

/**
 * Normaliza label de dispositivo para classificação consistente
 * @param {string} str - label do dispositivo
 * @returns {string} label normalizado
 */
function normalizeLabel(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Dispatcher: determina tipo de widget e emite evento apropriado
 * RFC-0056 FIX v1.1: Consolidação em myio:telemetry:update
 */
function emitTelemetryUpdate() {
  try {
    // Determinar tipo de widget pelo datasource alias
    const widgetType = detectWidgetType();

    if (!widgetType) {
      LogHelper.log('[RFC-0056] Widget type not detected - skipping emission');
      return;
    }

    // Construir periodKey a partir do filtro atual
    const periodKey = buildPeriodKey();

    // RFC-0002: Domain-specific emission
    if (WIDGET_DOMAIN === 'water') {
      emitWaterTelemetry(widgetType, periodKey);
    } else {
      // Default: energy domain
      if (widgetType === 'lojas') {
        emitLojasTotal(periodKey);
      } else if (widgetType === 'areacomum') {
        emitAreaComumBreakdown(periodKey);
      } else if (widgetType === 'entrada') {
        // RFC-0098: Emit entrada total for energy domain
        emitEntradaTotal(periodKey);
      }
    }
  } catch (err) {
    LogHelper.error('[RFC-0056] Error in emitTelemetryUpdate:', err);
  }
}

/**
 * Detecta tipo de widget baseado no datasource alias
 * RFC-0002: Added 'entrada' detection for water domain
 * @returns {'lojas'|'areacomum'|'entrada'|null}
 */
function detectWidgetType() {
  try {
    LogHelper.log('🔍 [detectWidgetType] Iniciando detecção de tipo de widget...');

    const datasources = ctx.datasources || [];
    LogHelper.log(`[detectWidgetType] Total de datasources detectados: ${datasources.length}`);

    if (!datasources.length) {
      LogHelper.warn('[detectWidgetType] Nenhum datasource encontrado em ctx.datasources!');
      return null;
    }

    // Percorrer todos os datasources
    for (let i = 0; i < datasources.length; i++) {
      const ds = datasources[i];
      const alias = (ds.aliasName || '').toString().toLowerCase().trim();

      LogHelper.log(`🔸 [detectWidgetType] Verificando datasource[${i}]`);
      LogHelper.log(`    ↳ aliasName:     ${ds.aliasName || '(vazio)'}`);
      LogHelper.log(`    ↳ entityName:    ${ds.entityName || '(vazio)'}`);
      LogHelper.log(`    ↳ alias normalizado: "${alias}"`);

      if (!alias) {
        LogHelper.warn(`[detectWidgetType] ⚠️ Alias vazio ou indefinido no datasource[${i}].`);
        continue;
      }

      // RFC-0002: Check for entrada (water domain)
      // Use word boundary matching to avoid false positives like "bomba entrada"
      if (/\bentrada\b/.test(alias) || alias === 'entrada' || alias.includes('entrada')) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "entrada" (com base no alias "${alias}")`);
        return 'entrada';
      }

      // Match "lojas" as standalone word or at end of alias
      // AVOID false positives like "Bomba Lojas", "Subestação Lojas"
      // ACCEPT: "lojas", "widget-lojas", "telemetry-lojas", "consumidores lojas"
      // RFC-0097: Usa EQUIPMENT_EXCLUSION_PATTERN construído do config
      if (/\blojas\b/.test(alias) && !EQUIPMENT_EXCLUSION_PATTERN.test(alias)) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "lojas" (com base no alias "${alias}")`);
        return 'lojas';
      }

      // Match area comum with flexible separators
      if (/\barea\s*comum\b/.test(alias) || alias.includes('areacomum') || alias.includes('area_comum')) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "areacomum" (com base no alias "${alias}")`);
        return 'areacomum';
      }
    }

    LogHelper.warn('[detectWidgetType] ⚠️ Nenhum tipo de widget correspondente encontrado.');
    return null;
  } catch (err) {
    LogHelper.error('[detectWidgetType] ❌ Erro durante detecção de tipo de widget:', err);
    return null;
  }
}

/**
 * Constrói periodKey do filtro atual
 * Formato: "YYYY-MM-DD_YYYY-MM-DD" ou "realtime"
 */
function buildPeriodKey() {
  const timewindow = ctx.defaultSubscription?.subscriptionTimewindow;

  if (!timewindow || timewindow.realtimeWindowMs) {
    return 'realtime';
  }

  const startMs = timewindow.fixedWindow?.startTimeMs || Date.now() - 86400000;
  const endMs = timewindow.fixedWindow?.endTimeMs || Date.now();

  const startDate = new Date(startMs).toISOString().split('T')[0];
  const endDate = new Date(endMs).toISOString().split('T')[0];

  return `${startDate}_${endDate}`;
}

/**
 * RFC-0098: Emite evento entrada_total
 * TELEMETRY (Entrada) → TELEMETRY_INFO
 */
function emitEntradaTotal(periodKey) {
  try {
    // Calcular total de Entrada a partir dos itens enriquecidos
    const entradaTotal = STATE.itemsEnriched.reduce((sum, item) => {
      return sum + (item.value || 0);
    }, 0);

    const totalMWh = normalizeToMWh(entradaTotal);

    const payload = {
      type: 'entrada_total',
      domain: 'energy',
      periodKey: periodKey,
      timestamp: Date.now(),
      source: 'TELEMETRY_Entrada',
      data: {
        total_kWh: entradaTotal,
        total_MWh: totalMWh,
        device_count: STATE.itemsEnriched.length,
      },
    };

    // Cache em sessionStorage
    const cacheKey = `myio:telemetry:entrada_${periodKey}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (e) {
      LogHelper.warn('[RFC-0098] sessionStorage write failed:', e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent('myio:telemetry:update', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);
    LogHelper.log(
      `[RFC-0098] ✅ Emitted entrada_total: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices)`
    );
  } catch (err) {
    LogHelper.error('[RFC-0098] Error in emitEntradaTotal:', err);
  }
}

/**
 * Emite evento lojas_total
 * RFC-0056 FIX v1.1: TELEMETRY (Lojas) → TELEMETRY_INFO
 */
function emitLojasTotal(periodKey) {
  try {
    // Calcular total de Lojas a partir dos itens enriquecidos
    const lojasTotal = STATE.itemsEnriched.reduce((sum, item) => {
      return sum + (item.value || 0);
    }, 0);

    const totalMWh = normalizeToMWh(lojasTotal);

    const payload = {
      type: 'lojas_total',
      domain: 'energy',
      periodKey: periodKey,
      timestamp: Date.now(),
      source: 'TELEMETRY_Lojas',
      data: {
        total_kWh: lojasTotal,
        total_MWh: totalMWh,
        device_count: STATE.itemsEnriched.length,
      },
    };

    // Cache em sessionStorage
    const cacheKey = `myio:telemetry:lojas_${periodKey}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (e) {
      LogHelper.warn('[RFC-0056] sessionStorage write failed:', e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent('myio:telemetry:update', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);
    LogHelper.log(
      `[RFC-0056] ✅ Emitted lojas_total: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices)`
    );
  } catch (err) {
    LogHelper.error('[RFC-0056] Error in emitLojasTotal:', err);
  }
}

// ============================================================================
// RFC-0106: Classification functions - NOW DELEGATES TO MAIN_VIEW
// These functions now use window.MyIOUtils which is populated by MAIN_VIEW
// ============================================================================

/**
 * RFC-0106: Classify device by deviceType attribute
 * DELEGATES TO window.MyIOUtils.classifyDeviceByDeviceType
 * @param {Object} item - Device item with deviceType and identifier properties
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'}
 */
function classifyDeviceByDeviceType(item) {
  // RFC-0106: Use MAIN_VIEW's classification function
  if (window.MyIOUtils?.classifyDeviceByDeviceType) {
    return window.MyIOUtils.classifyDeviceByDeviceType(item);
  }
  // Fallback if MAIN_VIEW not loaded yet
  LogHelper.warn('[RFC-0106] classifyDeviceByDeviceType: window.MyIOUtils not available, returning outros');
  return 'outros';
}

/**
 * RFC-0106: Classify device by identifier attribute
 * DELEGATES TO window.MyIOUtils.classifyDeviceByIdentifier
 * @param {string} identifier - Device identifier (e.g., "CAG", "Fancoil", "ELV", etc.)
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'|null}
 */
function classifyDeviceByIdentifier(identifier = '') {
  // RFC-0106: Use MAIN_VIEW's classification function
  if (window.MyIOUtils?.classifyDeviceByIdentifier) {
    return window.MyIOUtils.classifyDeviceByIdentifier(identifier);
  }
  // Fallback if MAIN_VIEW not loaded yet
  LogHelper.warn('[RFC-0106] classifyDeviceByIdentifier: window.MyIOUtils not available, returning null');
  return null;
}

// RFC-0097: classifyDeviceByLabel foi removida - classificação agora é por deviceType

/**
 * RFC-0106: Classify device using deviceType as primary method
 * DELEGATES TO window.MyIOUtils.classifyDevice
 * @param {Object} item - Device item with deviceType, deviceProfile, identifier, and label
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'}
 */
function classifyDevice(item) {
  // RFC-0106: Use MAIN_VIEW's classification function
  if (window.MyIOUtils?.classifyDevice) {
    return window.MyIOUtils.classifyDevice(item);
  }
  // Fallback if MAIN_VIEW not loaded yet
  LogHelper.warn('[RFC-0106] classifyDevice: window.MyIOUtils not available, returning outros');
  return 'outros';
}

/**
 * Emite evento areacomum_breakdown
 * RFC-0056 FIX v1.1: TELEMETRY (AreaComum) → TELEMETRY_INFO
 * RFC-0097: Classification by deviceType, subcategories by identifier
 */
function emitAreaComumBreakdown(periodKey) {
  try {
    LogHelper.log(`[RFC-0097] emitAreaComumBreakdown: classification by deviceType`);

    // Classificar dispositivos por categoria (consumo e contagem)
    const breakdown = {
      climatizacao: { total: 0, count: 0 },
      elevadores: { total: 0, count: 0 },
      escadas_rolantes: { total: 0, count: 0 },
      outros: { total: 0, count: 0 },
    };

    // RFC-0097: Subcategorias de climatização agrupadas por identifier (ou deviceType se identifier vazio)
    // Mapa dinâmico: key = identifier ou deviceType, value = { total, count, label }
    const climatizacaoSubcategories = new Map();

    // RFC-0097: Subcategorias de "outros" agrupadas por deviceType
    const outrosSubcategories = new Map();

    STATE.itemsEnriched.forEach((item) => {
      const energia = item.value || 0;
      const category = classifyDevice(item);

      breakdown[category].total += energia;
      breakdown[category].count += 1;

      // RFC-0097: Agrupar subcategorias de climatização por identifier (ou deviceType)
      if (category === 'climatizacao') {
        const identifier = String(item.identifier || '')
          .toUpperCase()
          .trim();
        const deviceType = String(item.deviceType || '').toUpperCase();

        // Usar identifier como chave de agrupamento, ou deviceType se identifier estiver vazio
        let groupKey = identifier;
        let groupLabel = identifier;

        if (!identifier || identifier === 'N/A' || identifier === 'NULL' || identifier === 'UNDEFINED') {
          groupKey = deviceType || 'OUTROS';
          groupLabel = deviceType || 'Outros';
        }

        // Inicializar grupo se não existir
        if (!climatizacaoSubcategories.has(groupKey)) {
          climatizacaoSubcategories.set(groupKey, {
            total: 0,
            count: 0,
            label: groupLabel,
          });
        }

        // Acumular valores
        const group = climatizacaoSubcategories.get(groupKey);
        group.total += energia;
        group.count += 1;

        // Debug: Log climatização devices
        /*
        LogHelper.log(
          `[RFC-0097] Climatização: deviceType="${deviceType}", identifier="${identifier}", group="${groupKey}", value=${energia.toFixed(
            2
          )} kWh`
        );
        */
      }

      // RFC-0097: Agrupar subcategorias de "outros" por deviceType (ou deviceProfile se 3F_MEDIDOR)
      if (category === 'outros') {
        let deviceType = String(item.deviceType || 'DESCONHECIDO')
          .toUpperCase()
          .trim();

        // Se deviceType é 3F_MEDIDOR, usar deviceProfile como tipo real
        if (deviceType === '3F_MEDIDOR' && item.deviceProfile) {
          deviceType = String(item.deviceProfile).toUpperCase().trim();
        }

        // Usar deviceType como chave de agrupamento
        const groupKey = deviceType || 'DESCONHECIDO';
        const groupLabel = deviceType || 'Desconhecido';

        // Inicializar grupo se não existir
        if (!outrosSubcategories.has(groupKey)) {
          outrosSubcategories.set(groupKey, {
            total: 0,
            count: 0,
            label: groupLabel,
          });
        }

        // Acumular valores
        const group = outrosSubcategories.get(groupKey);
        group.total += energia;
        group.count += 1;
      }

      // Debug log for first 5 items
      if (STATE.itemsEnriched.indexOf(item) < 5) {
        LogHelper.log(
          `[RFC-0097] Item: deviceType="${item.deviceType}", identifier="${item.identifier}", label="${item.label
          }" → ${category} (${energia.toFixed(2)} kWh)`
        );
      }
    });

    // Converter Map para objeto para serialização
    const climatizacaoSubcategoriesObj = {};
    climatizacaoSubcategories.forEach((value, key) => {
      climatizacaoSubcategoriesObj[key.toLowerCase()] = value;
    });

    // RFC-0097: Converter outros subcategories Map para objeto
    const outrosSubcategoriesObj = {};
    outrosSubcategories.forEach((value, key) => {
      outrosSubcategoriesObj[key.toLowerCase()] = value;
    });

    // RFC-0097: Log subcategory totals for debugging
    const subcatSummary = {};
    climatizacaoSubcategories.forEach((value, key) => {
      subcatSummary[key] = `${value.count} devices, ${normalizeToMWh(value.total)} MWh`;
    });
    LogHelper.log(`[RFC-0097] Climatização subcategories breakdown:`, subcatSummary);

    // RFC-0097: Log outros subcategory totals
    const outrosSubcatSummary = {};
    outrosSubcategories.forEach((value, key) => {
      outrosSubcatSummary[key] = `${value.count} devices, ${normalizeToMWh(value.total)} MWh`;
    });
    LogHelper.log(`[RFC-0097] Outros subcategories breakdown:`, outrosSubcatSummary);

    const payload = {
      type: 'areacomum_breakdown',
      domain: 'energy',
      periodKey: periodKey,
      timestamp: Date.now(),
      source: 'TELEMETRY_AreaComum',
      data: {
        climatizacao_kWh: breakdown.climatizacao.total,
        climatizacao_MWh: normalizeToMWh(breakdown.climatizacao.total),
        climatizacao_count: breakdown.climatizacao.count,
        elevadores_kWh: breakdown.elevadores.total,
        elevadores_MWh: normalizeToMWh(breakdown.elevadores.total),
        elevadores_count: breakdown.elevadores.count,
        escadas_rolantes_kWh: breakdown.escadas_rolantes.total,
        escadas_rolantes_MWh: normalizeToMWh(breakdown.escadas_rolantes.total),
        escadas_rolantes_count: breakdown.escadas_rolantes.count,
        outros_kWh: breakdown.outros.total,
        outros_MWh: normalizeToMWh(breakdown.outros.total),
        outros_count: breakdown.outros.count,
        device_count: STATE.itemsEnriched.length,
        // RFC-0097: Subcategorias de climatização (objeto para serialização)
        climatizacao_subcategories: climatizacaoSubcategoriesObj,
        // RFC-0097: Subcategorias de "outros" agrupadas por deviceType
        outros_subcategories: outrosSubcategoriesObj,
      },
    };

    // Cache em sessionStorage
    const cacheKey = `myio:telemetry:areacomum_${periodKey}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (e) {
      LogHelper.warn('[RFC-0056] sessionStorage write failed:', e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent('myio:telemetry:update', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);

    const totalMWh = normalizeToMWh(
      breakdown.climatizacao.total +
      breakdown.elevadores.total +
      breakdown.escadas_rolantes.total +
      breakdown.outros.total
    );
    LogHelper.log(
      `[RFC-0056] ✅ Emitted areacomum_breakdown: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices, climatizacao: ${breakdown.climatizacao.count})`
    );
  } catch (err) {
    LogHelper.error('[RFC-0056] Error in emitAreaComumBreakdown:', err);
  }
}

/**
 * RFC-0002: Emit water telemetry data
 * Emits myio:telemetry:provide-water for TELEMETRY_INFO to consume
 * @param {string} widgetType - 'entrada', 'lojas', or 'areacomum' (detected from alias)
 * @param {string} periodKey - Period identifier
 */
function emitWaterTelemetry(widgetType, periodKey) {
  try {
    // Check for waterContext override in settings
    const waterContextOverride = self.ctx.settings?.waterContext;
    let context = null;

    // Use override if set and not 'auto'
    if (waterContextOverride && waterContextOverride !== 'auto') {
      context = waterContextOverride;
      LogHelper.log(`[RFC-0002 Water] Using waterContext override: ${context}`);
    } else {
      // Map widgetType to water context (auto-detection from alias)
      if (widgetType === 'entrada') {
        context = 'entrada';
      } else if (widgetType === 'lojas') {
        context = 'lojas';
      } else if (widgetType === 'areacomum') {
        context = 'areaComum';
      }
    }

    if (!context) {
      LogHelper.warn(`[RFC-0002 Water] Unknown widget type: ${widgetType}`);
      return;
    }

    // Calculate total in m³
    const totalM3 = STATE.itemsEnriched.reduce((sum, item) => sum + (item.value || 0), 0);

    // Build device list
    const devices = STATE.itemsEnriched.map((item) => ({
      id: item.id || item.entityId || '',
      identifier: item.identifier || item.deviceIdentifier || '', // FIX: incluir identifier para classificação de banheiros
      label: item.label || item.name || '',
      value: item.value || 0,
      deviceType: item.deviceType || 'HIDROMETRO',
    }));

    // RFC-0002: For areaComum context, classify devices into banheiros vs outros
    // Banheiros are identified by bathroom patterns in label or identifier (case-insensitive)
    let banheirosBreakdown = null;
    if (context === 'areaComum') {
      const BANHEIRO_PATTERNS = ['banheiro', 'wc', 'sanitario', 'toalete', 'lavabo'];
      const banheirosDevices = [];
      const outrosDevices = [];

      devices.forEach((device) => {
        const labelLower = (device.label || '').toLowerCase();
        const identifierLower = (device.identifier || '').toLowerCase(); // FIX: usar identifier, não id
        const isBanheiro = BANHEIRO_PATTERNS.some(
          (p) => labelLower.includes(p) || identifierLower.includes(p)
        );

        if (isBanheiro) {
          banheirosDevices.push(device);
        } else {
          outrosDevices.push(device);
        }
      });

      const banheirosTotal = banheirosDevices.reduce((sum, d) => sum + (d.value || 0), 0);
      const outrosTotal = outrosDevices.reduce((sum, d) => sum + (d.value || 0), 0);

      banheirosBreakdown = {
        banheiros: {
          total: banheirosTotal,
          devices: banheirosDevices,
          count: banheirosDevices.length,
        },
        outros: {
          total: outrosTotal,
          devices: outrosDevices,
          count: outrosDevices.length,
        },
      };

      LogHelper.log(
        `[RFC-0002 Water] areaComum breakdown: banheiros=${banheirosTotal.toFixed(2)} m³ (${banheirosDevices.length
        } devices), outros=${outrosTotal.toFixed(2)} m³ (${outrosDevices.length} devices)`
      );
    }

    const payload = {
      context: context,
      domain: 'water',
      total: totalM3,
      devices: devices,
      periodKey: periodKey,
      timestamp: new Date().toISOString(),
      // RFC-0002: Include banheiros breakdown for areaComum context
      banheirosBreakdown: banheirosBreakdown,
    };

    // Dispatch water event
    const event = new CustomEvent('myio:telemetry:provide-water', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);

    LogHelper.log(
      `[RFC-0002 Water] ✅ Emitted water telemetry: context=${context}, total=${totalM3.toFixed(
        2
      )} m³, devices=${devices.length}`
    );
  } catch (err) {
    LogHelper.error('[RFC-0002 Water] Error in emitWaterTelemetry:', err);
  }
}

/** ===================== RECOMPUTE (local only) ===================== **/
function reflowFromState() {
  const visible = applyFilters(STATE.itemsEnriched, STATE.searchTerm, STATE.selectedIds, STATE.sortMode);
  const { visible: withPerc, groupSum } = recomputePercentages(visible);
  renderHeader(withPerc.length, groupSum);
  renderList(withPerc);
}

/** ===================== HYDRATE (end-to-end) ===================== **/
/**
 * RFC-0106: hydrateAndRender requests data from orchestrator (MAIN_VIEW).
 * No datasources, no ctx.data, no direct API calls.
 * All data comes from orchestrator via 'myio:telemetry:provide-data' event.
 */
async function hydrateAndRender() {
  if (hydrating) return;
  hydrating = true;

  showBusy();

  try {
    // Check for date range
    let hasDateRange = false;
    try {
      mustGetDateRange();
      hasDateRange = true;
    } catch (_e) {
      LogHelper.warn('[RFC-0106] No date range set, waiting for orchestrator...');
    }

    // RFC-0106: Request data from orchestrator for ALL domains
    // No local itemsBase building - orchestrator provides everything
    if (hasDateRange) {
      LogHelper.log(`[RFC-0106] Requesting ${WIDGET_DOMAIN} data from orchestrator`);

      const period = {
        startISO: self.ctx.scope?.startDateISO,
        endISO: self.ctx.scope?.endDateISO,
        granularity: window.calcGranularity
          ? window.calcGranularity(self.ctx.scope?.startDateISO, self.ctx.scope?.endDateISO)
          : 'day',
        tz: 'America/Sao_Paulo',
      };

      window.dispatchEvent(
        new CustomEvent('myio:telemetry:request-data', {
          detail: { domain: WIDGET_DOMAIN, period },
        })
      );

      // dataProvideHandler will handle the response and call hideBusy
      hydrating = false;
      return;
    }

    // No date range yet - just wait
    LogHelper.log('[RFC-0106] Waiting for date range and orchestrator data...');
  } finally {
    hydrating = false;
    // Don't hide busy here - dataProvideHandler will hide it
  }
}

/** ===================== TB LIFE CYCLE ===================== **/
self.onInit = async function () {
  $(self.ctx.$container).css({
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  });

  MyIO = (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) ||
    (typeof window !== 'undefined' && window.MyIOLibrary) || {
    showAlert: function () {
      alert('A Bliblioteca Myio não foi carregada corretamente!');
    },
  };

  $root().find('#labelWidgetId').text(self.ctx.settings?.labelWidget);

  // RFC-0042: Set widget configuration from settings FIRST
  WIDGET_DOMAIN = self.ctx.settings?.DOMAIN || 'energy';
  LogHelper.log(`[TELEMETRY] Configured EARLY: domain=${WIDGET_DOMAIN}`);

  // Show temperature info icon for temperature domain
  if (WIDGET_DOMAIN === 'temperature') {
    const tempInfoTrigger = $root().find('#tempInfoTrigger');
    if (tempInfoTrigger.length) {
      tempInfoTrigger.css('display', 'inline-flex');

      // Use TempSensorSummaryTooltip from myio-js-library (premium tooltip with drag, pin, maximize, close)
      if (MyIO?.TempSensorSummaryTooltip) {
        // Attach using the library component
        _tempTooltipCleanup = MyIO.TempSensorSummaryTooltip.attach(
          tempInfoTrigger[0],
          buildTempSensorSummaryData
        );
        LogHelper.log('[TELEMETRY] Temperature info icon initialized with TempSensorSummaryTooltip (library)');
      } else {
        // Fallback to legacy tooltip if library not available
        tempInfoTrigger.on('mouseenter', function (e) {
          showTempInfoTooltip(this);
        });
        tempInfoTrigger.on('mouseleave', function () {
          hideTempInfoTooltip();
        });
        LogHelper.warn('[TELEMETRY] TempSensorSummaryTooltip not found in library, using legacy tooltip');
      }
    }
  }

  // RFC-0063: Load classification mode configuration
  USE_IDENTIFIER_CLASSIFICATION = self.ctx.settings?.USE_IDENTIFIER_CLASSIFICATION || false;
  USE_HYBRID_CLASSIFICATION = self.ctx.settings?.USE_HYBRID_CLASSIFICATION || false;
  LogHelper.log(
    `[RFC-0063] Classification mode: ${USE_IDENTIFIER_CLASSIFICATION
      ? USE_HYBRID_CLASSIFICATION
        ? 'HYBRID (identifier + label fallback)'
        : 'IDENTIFIER ONLY'
      : 'LEGACY (label only)'
    }`
  );

  // RFC-0042: Request data from orchestrator (defined early for use in handlers)
  function requestDataFromOrchestrator() {
    const hasDateRange = self.ctx.scope?.startDateISO && self.ctx.scope?.endDateISO;

    if (!hasDateRange) {
      LogHelper.warn('[TELEMETRY] No date range set');

      // For energy/water domains, still render UI to enable buttons (skip API call)
      if (WIDGET_DOMAIN === 'energy' || WIDGET_DOMAIN === 'water') {
        LogHelper.log('[TELEMETRY] Energy/Water domain - rendering UI without data fetch');
        if (typeof hydrateAndRender === 'function') {
          hydrateAndRender();
        }
      }
      return;
    }

    const period = {
      startISO: self.ctx.scope.startDateISO,
      endISO: self.ctx.scope.endDateISO,
      granularity: window.calcGranularity
        ? window.calcGranularity(self.ctx.scope.startDateISO, self.ctx.scope.endDateISO)
        : 'day',
      tz: 'America/Sao_Paulo',
    };

    LogHelper.log(`[TELEMETRY] Requesting data for domain=${WIDGET_DOMAIN}, period:`, period);

    // RFC-0053: Single window context - emit to current window only
    window.dispatchEvent(
      new CustomEvent('myio:telemetry:request-data', {
        detail: { domain: WIDGET_DOMAIN, period },
      })
    );
  }

  // Listener com modal: evento externo de mudança de data
  dateUpdateHandler = function (ev) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ DATE UPDATE EVENT RECEIVED!`, ev.detail);

    try {
      // RFC-0042: Handle both old and new format
      let startISO, endISO;

      if (ev.detail?.period) {
        // New format from HEADER
        startISO = ev.detail.period.startISO;
        endISO = ev.detail.period.endISO;
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Using NEW format (period object)`);
      } else {
        // Old format (backward compatibility)
        const { startDate, endDate } = ev.detail || {};
        startISO = new Date(startDate).toISOString();
        endISO = new Date(endDate).toISOString();
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Using OLD format (startDate/endDate)`);
      }

      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Date range updated:`, startISO, endISO);

      // Datas mandatórias salvas no scope
      self.ctx.scope = self.ctx.scope || {};
      self.ctx.scope.startDateISO = startISO;
      self.ctx.scope.endDateISO = endISO;

      // IMPORTANT: Reset lastProcessedPeriodKey when new date range is selected
      // This allows processing fresh data for the new period
      lastProcessedPeriodKey = null;
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔄 Reset lastProcessedPeriodKey for new date range`);

      // Exibe modal
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔄 Calling showBusy()...`);
      showBusy();
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ showBusy() called`);

      // RFC-0045 FIX: Check if there's a pending provide-data event waiting for this period
      if (pendingProvideData) {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ Found pending provide-data event, processing now...`);
        const pending = pendingProvideData;
        pendingProvideData = null; // Clear pending event

        // Process the pending event immediately
        dataProvideHandler({ detail: pending });
        return; // Don't request data again, we already have it
      }

      // For temperature domain, use hydrateAndRender directly (no API needed, uses ctx.data only)
      if (WIDGET_DOMAIN === 'temperature') {
        LogHelper.log(
          `[TELEMETRY ${WIDGET_DOMAIN}] ✅ Temperature domain - using hydrateAndRender directly (no orchestrator)`
        );
        hasRequestedInitialData = true;

        if (typeof hydrateAndRender === 'function') {
          hydrateAndRender();
        } else {
          LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] hydrateAndRender não encontrada.`);
        }
      } else {
        // RFC-0053: Direct access to orchestrator (single window context)
        const orchestrator = window.MyIOOrchestrator;

        if (orchestrator) {
          LogHelper.log(
            `[TELEMETRY ${WIDGET_DOMAIN}] ✅ RFC-0053: Requesting data from orchestrator (single window)`
          );

          // IMPORTANT: Mark as requested BEFORE calling requestDataFromOrchestrator
          // This prevents the setTimeout(500ms) from making a duplicate request
          hasRequestedInitialData = true;

          requestDataFromOrchestrator();
        } else {
          // Fallback to old behavior
          LogHelper.warn(`[TELEMETRY ${WIDGET_DOMAIN}] ⚠️ Orchestrator not available, using legacy fetch`);

          if (typeof hydrateAndRender === 'function') {
            hydrateAndRender();
          } else {
            LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] hydrateAndRender não encontrada.`);
          }
        }
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] dateUpdateHandler error:`, err);
      hideBusy();
    }
  };

  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📡 Registering myio:update-date listener...`);
  window.addEventListener('myio:update-date', dateUpdateHandler);
  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ myio:update-date listener registered!`);

  // RFC-0042: Listen for clear event from HEADER (when user clicks "Limpar" button)
  window.addEventListener('myio:telemetry:clear', (ev) => {
    const { domain } = ev.detail;

    // Only clear if it's for my domain
    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Ignoring clear event for domain: ${domain}`);
      return;
    }

    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧹 Received clear event - clearing visual content`);

    try {
      // Clear the items list
      STATE.itemsBase = [];
      STATE.itemsEnriched = [];
      STATE.selectedIds = null;

      // IMPORTANT: Use $root() to get elements within THIS widget's scope
      const $widget = $root();

      // Clear the visual list
      const $shopsList = $widget.find('#shopsList');
      if ($shopsList.length > 0) {
        $shopsList.empty();
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsList cleared`);
      }

      // Reset counts to 0
      const $shopsCount = $widget.find('#shopsCount');
      const $shopsTotal = $widget.find('#shopsTotal');

      if ($shopsCount.length > 0) {
        $shopsCount.text('(0)');
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsCount reset to 0`);
      }

      if ($shopsTotal.length > 0) {
        $shopsTotal.text('0,00');
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsTotal reset to 0,00`);
      }

      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧹 Clear completed successfully`);
    } catch (err) {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] ❌ Error during clear:`, err);
    }
  });

  // Test if listener is working
  setTimeout(() => {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧪 Testing listener registration...`);
    const testEvent = new CustomEvent('myio:update-date', {
      detail: {
        period: {
          startISO: '2025-09-26T00:00:00-03:00',
          endISO: '2025-10-02T23:59:59-03:00',
          granularity: 'day',
          tz: 'America/Sao_Paulo',
        },
      },
    });
    // Don't dispatch, just check if handler exists
    if (typeof dateUpdateHandler === 'function') {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ dateUpdateHandler is defined and ready`);
    } else {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] ❌ dateUpdateHandler is NOT defined!`);
    }
  }, 100);

  // RFC-0045 FIX: Store pending provide-data events that arrive before update-date
  let pendingProvideData = null;

  /**
   * RFC-0106: Listen for data provision from orchestrator
   * Now reads directly from window.STATE instead of processing event items
   */
  dataProvideHandler = function (ev) {
    const { domain, periodKey } = ev.detail;

    LogHelper.log(
      `[TELEMETRY ${WIDGET_DOMAIN}] 📦 Received provide-data event for domain ${domain}, periodKey: ${periodKey}`
    );

    // Only process if it's for my domain
    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] ⏭️ Ignoring event for domain ${domain}, my domain is ${WIDGET_DOMAIN}`
      );
      return;
    }

    // Prevent duplicate processing of the same periodKey
    if (lastProcessedPeriodKey === periodKey) {
      LogHelper.log(`[TELEMETRY] ⏭️ Skipping duplicate provide-data for periodKey: ${periodKey}`);
      return;
    }

    // Validate current period matches
    const myPeriod = {
      startISO: self.ctx.scope?.startDateISO,
      endISO: self.ctx.scope?.endDateISO,
    };

    // If period not set yet, store event for later processing
    // RFC-0106 FIX: Skip period check for temperature domain (uses real-time readings, no period needed)
    if (domain !== 'temperature' && (!myPeriod.startISO || !myPeriod.endISO)) {
      LogHelper.warn(`[TELEMETRY] ⏸️ Period not set yet, storing provide-data event for later processing`);
      pendingProvideData = { domain, periodKey };
      return;
    }

    // Mark this periodKey as processed
    lastProcessedPeriodKey = periodKey;

    // RFC-0106: Get items directly from window.STATE
    const myLabelWidget = self.ctx.settings?.labelWidget || '';
    const stateItems = getItemsFromState(domain, myLabelWidget);

    if (!stateItems) {
      LogHelper.warn(`[TELEMETRY] ⚠️ No items found in window.STATE for domain ${domain}`);
      return;
    }

    LogHelper.log(`[RFC-0106] Got ${stateItems.length} items from window.STATE for labelWidget="${myLabelWidget}"`);

    // RFC-0106: Convert STATE items to widget format
    // FIX: Don't use item.id as fallback for ingestionId - temperature sensors don't have ingestionId
    // Using item.id would make tbId === ingestionId which fails the Settings validation

    // Get global temperature limits from MyIOUtils (set by MAIN_VIEW from customer attributes)
    const globalTempMin = window.MyIOUtils?.temperatureLimits?.minTemperature ?? null;
    const globalTempMax = window.MyIOUtils?.temperatureLimits?.maxTemperature ?? null;

    if (domain === 'temperature') {
      LogHelper.log(`[RFC-0106] Temperature limits from MyIOUtils: min=${globalTempMin}, max=${globalTempMax}`);
    }

    STATE.itemsBase = stateItems.map((item) => {
      // Calculate temperatureStatus for TERMOSTATO devices
      let temperatureStatus = null;
      const isTermostato = item.deviceType === 'TERMOSTATO';
      const temp = Number(item.value || 0);

      if (isTermostato && temp && globalTempMin !== null && globalTempMax !== null) {
        if (temp > globalTempMax) {
          temperatureStatus = 'above';
        } else if (temp < globalTempMin) {
          temperatureStatus = 'below';
        } else {
          temperatureStatus = 'ok';
        }
      }

      return {
        id: item.tbId || item.id,
        tbId: item.tbId || item.id,
        ingestionId: item.ingestionId || null, // Don't fallback to item.id
        identifier: item.identifier || item.id,
        label: item.label || item.name || item.identifier || item.id,
        entityLabel: item.entityLabel || item.label || item.name || '',
        value: temp,
        perc: 0,
        deviceType: item.deviceType || WIDGET_DOMAIN,
        slaveId: item.slaveId || null,
        centralId: item.centralId || null,
        deviceStatus: item.deviceStatus || 'no_info',
        labelWidget: item.labelWidget || myLabelWidget,
        updatedIdentifiers: {},
        // TERMOSTATO specific fields - use global limits from customer
        temperature: isTermostato ? temp : null,
        temperatureMin: isTermostato ? globalTempMin : null,
        temperatureMax: isTermostato ? globalTempMax : null,
        temperatureStatus: temperatureStatus,
      };
    });

    window._telemetryAuthoritativeItems = STATE.itemsBase;

    // Items come enriched from orchestrator
    STATE.itemsEnriched = STATE.itemsBase.map((item) => ({ ...item }));

    LogHelper.log(`[RFC-0106] Final items: ${STATE.itemsEnriched.length}`);

    // RFC-0056 FIX v1.1: Emit telemetry update after enrichment
    emitTelemetryUpdate();

    // Sanitize selection
    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map((x) => x.id));
      const next = new Set([...STATE.selectedIds].filter((id) => valid.has(id)));
      STATE.selectedIds = next.size ? next : null;
    }

    reflowFromState();

    // RFC-0044: ALWAYS hide busy when data is provided, regardless of source
    LogHelper.log(`[TELEMETRY] 🏁 Data processed successfully - ensuring busy is hidden`);

    // Force hide busy with minimal delay to ensure UI update
    setTimeout(() => {
      hideBusy();
      // Double-check: if orchestrator busy is still showing, force hide it
      if (window.MyIOOrchestrator && window.MyIOOrchestrator.getBusyState) {
        const busyState = window.MyIOOrchestrator.getBusyState();
        if (busyState.isVisible) {
          LogHelper.warn(
            `[TELEMETRY] ⚠️ Orchestrator busy still visible after data processing - force hiding`
          );
          window.MyIOOrchestrator.hideGlobalBusy();
        }
      }
    }, 100);
  };

  /**
   * RFC-0106: DEPRECATED - extractDatasourceIds no longer used.
   * All data comes from orchestrator - no ctx.data dependencies.
   * @deprecated Not needed with orchestrator architecture
   */
  function extractDatasourceIds(_datasources) {
    LogHelper.warn('[RFC-0106] extractDatasourceIds is DEPRECATED');
    return [];
  }

  window.addEventListener('myio:telemetry:provide-data', dataProvideHandler);

  // RFC-0056 FIX v1.1: Listen for request_refresh from TELEMETRY_INFO
  let requestRefreshHandler = function (ev) {
    const { type, domain, periodKey } = ev.detail || {};

    if (type !== 'request_refresh') return;
    if (domain !== WIDGET_DOMAIN) return;

    LogHelper.log(`[RFC-0056] Received request_refresh for domain ${domain}, periodKey ${periodKey}`);

    // Re-emit telemetry data
    const currentPeriodKey = buildPeriodKey();
    if (currentPeriodKey === periodKey) {
      LogHelper.log(`[RFC-0056] Re-emitting data for current period`);
      emitTelemetryUpdate();
    } else {
      LogHelper.warn(`[RFC-0056] Period mismatch: requested ${periodKey}, current ${currentPeriodKey}`);
    }
  };

  window.addEventListener('myio:telemetry:update', requestRefreshHandler);

  // Check for stored data from orchestrator (in case we missed the event)
  setTimeout(() => {
    // RFC-0053: Direct access to orchestrator data (single window context)
    const orchestratorData = window.MyIOOrchestratorData;

    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔍 Checking for stored orchestrator data...`);

    // First, try stored data
    if (orchestratorData && orchestratorData[WIDGET_DOMAIN]) {
      const storedData = orchestratorData[WIDGET_DOMAIN];
      const age = Date.now() - storedData.timestamp;

      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] Found stored data: ${storedData.items?.length || 0
        } items, age: ${age}ms`
      );

      // Use stored data if it's less than 30 seconds old AND has items
      if (age < 30000 && storedData.items && storedData.items.length > 0) {
        LogHelper.log(
          `[TELEMETRY ${WIDGET_DOMAIN}] ✅ RFC-0053: Using stored orchestrator data (single window)`
        );
        dataProvideHandler({
          detail: {
            domain: WIDGET_DOMAIN,
            periodKey: storedData.periodKey,
            items: storedData.items,
          },
        });
        return;
      } else {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ⚠️ Stored data is too old or empty, ignoring`);
      }
    } else {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ℹ️ No stored data found for domain ${WIDGET_DOMAIN}`);
    }

    // If no stored data AND we haven't requested yet, request fresh data
    if (!hasRequestedInitialData) {
      // For temperature domain, use hydrateAndRender directly (no orchestrator needed)
      if (WIDGET_DOMAIN === 'temperature') {
        LogHelper.log(
          `[TELEMETRY ${WIDGET_DOMAIN}] 📡 Temperature domain - calling hydrateAndRender directly...`
        );
        hasRequestedInitialData = true;
        hydrateAndRender();
      } else {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📡 Requesting fresh data from orchestrator...`);
        requestDataFromOrchestrator();
      }
    } else {
      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] ⏭️ Skipping duplicate request (already requested via event)`
      );
    }
  }, 500); // Wait 500ms for widget to fully initialize

  // Auth do cliente/ingestion
  // RFC-0091: Use shared customerTB_ID from MAIN widget via window.MyIOUtils
  const customerTB_ID = window.MyIOUtils?.customerTB_ID;
  if (!customerTB_ID) {
    console.error(
      '[TELEMETRY] customerTB_ID not available from window.MyIOUtils - MAIN widget must load first'
    );
  }
  //DEVICE_TYPE = self.ctx.settings?.DEVICE_TYPE || "energy";
  const jwt = localStorage.getItem('jwt_token');

  const boolExecSync = new URLSearchParams(window.location.search).get('boolExecSync') === 'true';

  // RFC-0071: Trigger device profile synchronization (runs once)
  if (!__deviceProfileSyncComplete && boolExecSync) {
    try {
      console.log('[EQUIPMENTS] [RFC-0071] Triggering device profile sync...');
      const syncResult = await syncDeviceProfileAttributes();
      __deviceProfileSyncComplete = true;

      if (syncResult.synced > 0) {
        console.log(
          '[EQUIPMENTS] [RFC-0071] ⚠️ Widget reload recommended to load new deviceProfile attributes'
        );
        console.log(
          '[EQUIPMENTS] [RFC-0071] You may need to refresh the dashboard to see deviceProfile in ctx.data'
        );
      }
    } catch (error) {
      console.error('[EQUIPMENTS] [RFC-0071] Sync failed, continuing without it:', error);
      // Don't block widget initialization if sync fails
    }
  }

  try {
    const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
    CLIENT_ID = attrs?.client_id || '';
    CLIENT_SECRET = attrs?.client_secret || '';
    CUSTOMER_ING_ID = attrs?.ingestionId || '';
// Carrega o mapa
    MAP_INSTANTANEOUS_POWER = attrs?.mapInstantaneousPower ? JSON.parse(attrs?.mapInstantaneousPower) : null;

    // [CORREÇÃO CRÍTICA]
    // Se o mapa chegou AGORA, precisamos re-executar a lógica de enriquecimento
    // RFC-0106: Power range updates now handled via orchestrator data
    // The orchestrator includes all device metadata including power ranges
    if (MAP_INSTANTANEOUS_POWER && STATE.itemsEnriched && STATE.itemsEnriched.length > 0) {
      LogHelper.log('[RFC-0106] Power map loaded - ranges will be applied from orchestrator data');
      reflowFromState();
    }

    // Expõe credenciais globalmente para uso no FOOTER (modal de comparação)
    window.__MYIO_CLIENT_ID__ = CLIENT_ID;
    window.__MYIO_CLIENT_SECRET__ = CLIENT_SECRET;
    window.__MYIO_CUSTOMER_ING_ID__ = CUSTOMER_ING_ID;

    MyIOAuth = MyIO.buildMyioIngestionAuth({
      dataApiHost: DATA_API_HOST,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });

    LogHelper.log('[DeviceCards] Auth init OK');
    try {
      await MyIOAuth.getToken();
    } catch {
      // Pre-warming token fetch, failure is non-critical
    }
  } catch (err) {
    LogHelper.error('[DeviceCards] Auth init FAIL', err);
  }

  // Bind UI
  bindHeader();
  bindModal();

  // ---------- Datas iniciais: "Current Month So Far" ----------
  if (!self.ctx?.scope?.startDateISO || !self.ctx?.scope?.endDateISO) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0); // 1º dia 00:00
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 0); // hoje 23:59:59
    self.ctx.scope = self.ctx.scope || {};
    self.ctx.scope.startDateISO = start.toISOString();
    self.ctx.scope.endDateISO = end.toISOString();
  }
  // ------------------------------------------------------------

  // RFC-0106: No ctx.data, no datasources - all data comes from orchestrator
  LogHelper.log(`[RFC-0106] ${WIDGET_DOMAIN} widget waiting for orchestrator data...`);

  // RFC-0106 FIX: Temperature domain doesn't need period - check for stored data immediately
  if (WIDGET_DOMAIN === 'temperature') {
    const orchestratorData = window.MyIOOrchestratorData;
    if (orchestratorData && orchestratorData.temperature) {
      const storedData = orchestratorData.temperature;
      const age = Date.now() - storedData.timestamp;

      LogHelper.log(
        `[TELEMETRY temperature] 🌡️ Found stored temperature data: ${storedData.items?.length || 0} items, age: ${age}ms`
      );

      // Use stored data if it's less than 60 seconds old AND has items
      if (age < 60000 && storedData.items && storedData.items.length > 0) {
        LogHelper.log(`[TELEMETRY temperature] ✅ Using stored temperature data directly (no period needed)`);
        dataProvideHandler({
          detail: {
            domain: 'temperature',
            periodKey: storedData.periodKey,
            items: storedData.items,
          },
        });
        return; // Don't proceed to showBusy
      }
    }
  }

  // Only show busy if we have a date range defined
  if (self.ctx?.scope?.startDateISO && self.ctx?.scope?.endDateISO) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Initial period defined, showing busy...`);
    showBusy();
  } else {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] No initial period, waiting for myio:update-date event...`);
  }
};

// onDataUpdated removido (no-op por ora)
self.onDataUpdated = function () {
  /* no-op */
};

self.onResize = function () { };
self.onDestroy = function () {
  if (dateUpdateHandler) {
    window.removeEventListener('myio:update-date', dateUpdateHandler);
    LogHelper.log("[DeviceCards] Event listener 'myio:update-date' removido.");
  }
  if (dataProvideHandler) {
    window.removeEventListener('myio:telemetry:provide-data', dataProvideHandler);
    LogHelper.log("[DeviceCards] Event listener 'myio:telemetry:provide-data' removido.");
  }
  // RFC-0056 FIX v1.1: Remove request_refresh listener
  if (requestRefreshHandler) {
    window.removeEventListener('myio:telemetry:update', requestRefreshHandler);
    LogHelper.log("[RFC-0056] Event listener 'myio:telemetry:update' removido.");
  }

  // Cleanup TempSensorSummaryTooltip if attached
  if (_tempTooltipCleanup) {
    _tempTooltipCleanup();
    _tempTooltipCleanup = null;
    LogHelper.log('[TELEMETRY] TempSensorSummaryTooltip cleanup executed.');
  }

  try {
    $root().off();
  } catch {
    // jQuery cleanup may fail if element no longer exists
  }

  hideBusy();
  hideGlobalSuccessModal();
};
