/**
 * Device Info Utilities
 * Functions for detecting device domain and context based on device properties
 *
 * @module deviceInfo
 * @version 1.0.0
 */

import { getDomainFromDeviceType, DomainType as DeviceItemDomainType } from './deviceItem.js';

/**
 * Domain types for device classification
 * @enum {string}
 */
export const DomainType = {
  ENERGY: 'energy',
  WATER: 'water',
  TEMPERATURE: 'temperature',
};

/**
 * Context types for device classification
 * @enum {string}
 */
export const ContextType = {
  // Energy contexts
  EQUIPMENTS: 'equipments',
  STORES: 'stores',
  ENTRADA: 'entrada',
  BOMBA: 'bomba', // Pumps (BAS)
  MOTOR: 'motor', // Motors (BAS)

  // Water contexts
  HIDROMETRO: 'hidrometro', // Lojas (stores)
  HIDROMETRO_AREA_COMUM: 'hidrometro_area_comum', // Área comum (exceto banheiros)
  BANHEIROS: 'banheiros', // Banheiros (identifier = 'BANHEIROS')
  HIDROMETRO_ENTRADA: 'hidrometro_entrada', // Entrada do shopping
  CAIXA_DAGUA: 'caixadagua', // Water tank (BAS)
  SOLENOIDE: 'solenoide', // Solenoid valve (BAS)

  // Temperature contexts
  TERMOSTATO: 'termostato',
  TERMOSTATO_EXTERNAL: 'termostato_external',
};

/**
 * RFC-0111: Detect device context based on deviceProfile (+identifier).
 *
 * ⚠️ AUTORIDADE: deviceProfile decide TUDO. deviceType só é consultado quando o
 * device não tem deviceProfile (último recurso); name/label nunca entram.
 *
 * WATER Rules (priority order, sobre o deviceProfile):
 * 1. profile contém HIDROMETRO_SHOPPING → ENTRADA (main water meter)
 * 2. profile = HIDROMETRO_AREA_COMUM AND identifier = 'BANHEIROS' → BANHEIROS
 * 3. profile = HIDROMETRO_AREA_COMUM → AREA_COMUM (common area without bathrooms)
 * 4. default → LOJAS/hidrometro (inclui profile HIDROMETRO exato)
 *
 * ENERGY Rules (sobre o deviceProfile):
 * - profile contém ENTRADA/RELOGIO/TRAFO/SUBESTACAO → ENTRADA (main meters)
 * - profile contém BOMBA_CAG → EQUIPMENTS (é Climatização/RFC-0128, não bomba BAS)
 * - profile contém BOMBA → BOMBA (BAS) · contém MOTOR → MOTOR (BAS)
 * - profile começa com 3F_MEDIDOR → STORES (mesmo com deviceType errado)
 * - default → EQUIPMENTS
 *
 * TEMPERATURE Rules:
 * - deviceType = deviceProfile = TERMOSTATO → termostato (climatized)
 * - deviceType = TERMOSTATO AND deviceProfile = TERMOSTATO_EXTERNAL → termostato_external
 * - deviceType = TERMOSTATO_EXTERNAL → termostato_external
 *
 * @param {Object} device - Device object with deviceType, deviceProfile, and identifier properties
 * @param {string} [device.deviceType] - The device type string
 * @param {string} [device.deviceProfile] - The device profile string
 * @param {string} [device.identifier] - The device identifier (server_scope attribute)
 * @param {'energy' | 'water' | 'temperature'} domain - The device domain
 * @returns {string} The detected context
 *
 * @example
 * detectContext({ deviceType: 'HIDROMETRO', deviceProfile: 'HIDROMETRO' }, 'water');
 * // Returns 'hidrometro'
 *
 * @example
 * detectContext({ deviceType: 'HIDROMETRO', deviceProfile: 'HIDROMETRO_AREA_COMUM', identifier: 'BANHEIROS' }, 'water');
 * // Returns 'banheiros'
 *
 * @example
 * detectContext({ deviceType: '3F_MEDIDOR', deviceProfile: '3F_MEDIDOR' }, 'energy');
 * // Returns 'stores'
 */
export function detectContext(device, domain) {
  // 2026-07-14 (endurecimento do RFC-0111): deviceProfile é a ÚNICA autoridade
  // de classificação. deviceType chega errado do provisionamento com frequência
  // (hidrômetro com deviceType=MOTOR, loja 3F com deviceType=ELEVADOR, subestação
  // com deviceType=SUBESTACAO mas profile=MOTOR) e name/label NUNCA entram na
  // decisão. deviceType só é lido como último recurso quando o device NÃO tem
  // deviceProfile — sem isso ele ficaria inclassificável.
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase().trim();
  const basis = deviceProfile || String(device?.deviceType || '').toUpperCase().trim();
  const identifier = String(device?.identifier || '').toUpperCase();

  if (domain === DomainType.WATER) {
    // BAS: CAIXA_DAGUA (water tank)
    if (basis.includes('CAIXA_DAGUA')) {
      return ContextType.CAIXA_DAGUA;
    }

    // BAS: SOLENOIDE (solenoid valve)
    if (basis.includes('SOLENOIDE')) {
      return ContextType.SOLENOIDE;
    }

    // Priority 1: HIDROMETRO_SHOPPING → ENTRADA (main water meter for shopping)
    if (basis.includes('HIDROMETRO_SHOPPING')) {
      return ContextType.HIDROMETRO_ENTRADA;
    }

    // Priority 2: BANHEIROS (identifier = 'BANHEIROS' with HIDROMETRO_AREA_COMUM profile)
    if (basis === 'HIDROMETRO_AREA_COMUM' && identifier === 'BANHEIROS') {
      return ContextType.BANHEIROS;
    }

    // Priority 3: HIDROMETRO_AREA_COMUM (common area without bathroom identifier)
    if (basis === 'HIDROMETRO_AREA_COMUM') {
      return ContextType.HIDROMETRO_AREA_COMUM;
    }

    // Default for water: hidrometro (lojas) — inclui profile HIDROMETRO exato
    return ContextType.HIDROMETRO;
  }

  if (domain === DomainType.ENERGY) {
    // RFC-0111: profile ENTRADA/RELOGIO/TRAFO/SUBESTACAO → ENTRADA (main meters).
    // Por PROFILE apenas — "3F SUBESTACAO Condominio" com profile=MOTOR NÃO é entrada.
    const entradaProfiles = ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'];
    if (entradaProfiles.some((t) => basis.includes(t))) {
      return ContextType.ENTRADA;
    }

    // BOMBA_CAG é CLIMATIZAÇÃO (RFC-0128) — vai para equipments, NÃO para o
    // grupo bomba (BAS). Checado antes do check genérico de BOMBA.
    if (basis.includes('BOMBA_CAG')) {
      return ContextType.EQUIPMENTS;
    }

    // BAS: BOMBA (pumps) - check before generic motor
    if (basis.includes('BOMBA')) {
      return ContextType.BOMBA;
    }

    // BAS: MOTOR (motors)
    if (basis.includes('MOTOR')) {
      return ContextType.MOTOR;
    }

    // RFC-0111: profile começa com 3F_MEDIDOR → STORE (lojas), independente do
    // deviceType (ex.: loja com deviceType=ELEVADOR errado continua loja).
    // Includes archived/variant profiles like 3F_MEDIDOR_ARQUIVADO_INSTALADO_SEM_DADOS
    if (basis.startsWith('3F_MEDIDOR')) {
      return ContextType.STORES;
    }

    return ContextType.EQUIPMENTS;
  }

  if (domain === DomainType.TEMPERATURE) {
    // TERMOSTATO_EXTERNAL → external (non-climatized)
    if (basis.includes('EXTERNAL')) {
      return ContextType.TERMOSTATO_EXTERNAL;
    }

    // Default for temperature
    return ContextType.TERMOSTATO;
  }

  return ContextType.EQUIPMENTS; // Default
}

/**
 * Detect both domain and context for a device in a single call.
 *
 * @param {Object} device - Device object with deviceType and deviceProfile properties
 * @returns {{ domain: string, context: string }} Object with domain and context
 *
 * @example
 * detectDomainAndContext({ deviceType: 'HIDROMETRO', deviceProfile: 'HIDROMETRO_AREA_COMUM' });
 * // Returns { domain: 'water', context: 'hidrometro_area_comum' }
 */
export function detectDomainAndContext(device) {
  // Domínio também é decidido pelo deviceProfile (deviceType só quando não há
  // profile) — um hidrômetro com deviceType=MOTOR errado continua sendo água.
  const basis = String(device?.deviceProfile || '').trim() || String(device?.deviceType || '');
  const domain = getDomainFromDeviceType(basis);
  const context = detectContext(device, domain);

  return { domain, context };
}

/**
 * Map ThingsBoard connection status to standardized status values.
 *
 * @param {string} status - The raw connection status from ThingsBoard
 * @returns {'online' | 'offline' | 'no_info' | string} The mapped status
 *
 * @example
 * mapConnectionStatus('connected');    // 'online'
 * mapConnectionStatus('disconnected'); // 'offline'
 * mapConnectionStatus('unknown');      // 'no_info'
 * mapConnectionStatus('bad');          // 'bad' (passthrough)
 */
export function mapConnectionStatus(status) {
  const statusMap = {
    connected: 'online',
    disconnected: 'offline',
    unknown: 'no_info',
  };

  return statusMap[status?.toLowerCase()] || status || 'offline';
}

/**
 * RFC-0111: Calculate device counts per shopping from classified data.
 * Uses ownerName (shopping name) as the key for matching with shopping cards.
 *
 * @param {string[]} domainList - Array of domain names (e.g., ['energy', 'water', 'temperature'])
 * @param {Object} classified - Classified device data from window.MyIOOrchestratorData
 * @returns {Map<string, {energy: number, water: number, temperature: number}>} Map of ownerName (normalized) -> counts per domain
 *
 * @example
 * const counts = calculateShoppingDeviceCounts(
 *   ['energy', 'water', 'temperature'],
 *   window.MyIOOrchestratorData.classified
 * );
 * counts.get('shopping abc'); // { energy: 5, water: 2, temperature: 3 }
 */
export function calculateShoppingDeviceCounts(domainList, classified) {
  const countsByOwnerName = new Map();

  domainList.forEach((domain) => {
    const domainDevices = classified[domain] || {};

    Object.values(domainDevices).forEach((devices) => {
      devices.forEach((device) => {
        const ownerName = (device.ownerName || device.customerName || '').toLowerCase().trim();
        if (!ownerName) return;

        if (!countsByOwnerName.has(ownerName)) {
          countsByOwnerName.set(ownerName, { energy: 0, water: 0, temperature: 0 });
        }

        countsByOwnerName.get(ownerName)[domain]++;
      });
    });
  });

  return countsByOwnerName;
}

/**
 * RFC-0112: Calculate device counts AND consumption values per shopping from classified data.
 * Extends calculateShoppingDeviceCounts to include energyConsumption, waterConsumption, and temperatureAvg.
 *
 * @param {string[]} domainList - Array of domain names (e.g., ['energy', 'water', 'temperature'])
 * @param {Object} classified - Classified device data from window.MyIOOrchestratorData
 * @returns {Map<string, ShoppingDeviceStats>} Map of ownerName (normalized) -> counts and consumption per domain
 *
 * @typedef {Object} ShoppingDeviceStats
 * @property {number} energy - Count of energy devices
 * @property {number} water - Count of water devices
 * @property {number} temperature - Count of temperature devices
 * @property {number|null} energyConsumption - Total kWh consumption (null if no devices)
 * @property {number|null} waterConsumption - Total m³ consumption (null if no devices)
 * @property {number|null} temperatureAvg - Average temperature in °C (null if no devices)
 *
 * @example
 * const stats = calculateShoppingDeviceStats(
 *   ['energy', 'water', 'temperature'],
 *   window.MyIOOrchestratorData.classified
 * );
 * stats.get('shopping abc');
 * // { energy: 5, water: 2, temperature: 3, energyConsumption: 1250.5, waterConsumption: 180, temperatureAvg: 23.5 }
 */
export function calculateShoppingDeviceStats(domainList, classified) {
  const statsByOwnerName = new Map();

  domainList.forEach((domain) => {
    const domainDevices = classified[domain] || {};

    Object.values(domainDevices).forEach((devices) => {
      devices.forEach((device) => {
        const ownerName = (device.ownerName || device.customerName || '').toLowerCase().trim();
        if (!ownerName) return;

        if (!statsByOwnerName.has(ownerName)) {
          statsByOwnerName.set(ownerName, {
            energy: 0,
            water: 0,
            temperature: 0,
            energyConsumption: null,
            waterConsumption: null,
            temperatureAvg: null,
            // Internal accumulators (not exposed in final result)
            _tempSum: 0,
            _tempCount: 0,
          });
        }

        const stats = statsByOwnerName.get(ownerName);
        stats[domain]++;

        // RFC-0112: Accumulate consumption values
        if (domain === 'energy') {
          const consumption = Number(device.consumption || device.val || device.value || 0);
          if (consumption > 0) {
            stats.energyConsumption = (stats.energyConsumption || 0) + consumption;
          }
        } else if (domain === 'water') {
          const consumption = Number(device.consumption || device.val || device.pulses || 0);
          if (consumption > 0) {
            stats.waterConsumption = (stats.waterConsumption || 0) + consumption;
          }
        } else if (domain === 'temperature') {
          const temp = Number(device.temperature || 0);
          if (temp > 0) {
            stats._tempSum += temp;
            stats._tempCount++;
          }
        }
      });
    });
  });

  // Calculate temperature averages and clean up internal accumulators
  statsByOwnerName.forEach((stats) => {
    if (stats._tempCount > 0) {
      stats.temperatureAvg = Math.round((stats._tempSum / stats._tempCount) * 10) / 10;
    }
    // Remove internal accumulators
    delete stats._tempSum;
    delete stats._tempCount;
  });

  return statsByOwnerName;
}

/**
 * Extract entity ID from various ThingsBoard entity ID formats.
 *
 * @param {string|Object|null} entityIdObj - Entity ID in string or object format
 * @returns {string|null} The extracted entity ID or null
 *
 * @example
 * extractEntityId('abc-123'); // 'abc-123'
 * extractEntityId({ id: 'abc-123', entityType: 'DEVICE' }); // 'abc-123'
 * extractEntityId(null); // null
 */
export function extractEntityId(entityIdObj) {
  if (!entityIdObj) return null;
  if (typeof entityIdObj === 'string') return entityIdObj;

  return entityIdObj.id || null;
}
