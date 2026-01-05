/**
 * Device Info Utilities
 * Functions for detecting device domain and context based on device properties
 *
 * @module deviceInfo
 * @version 1.0.0
 */

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

  // Water contexts
  HIDROMETRO: 'hidrometro', // Lojas (stores)
  HIDROMETRO_AREA_COMUM: 'hidrometro_area_comum', // Área comum (exceto banheiros)
  BANHEIROS: 'banheiros', // Banheiros (identifier = 'BANHEIROS')
  HIDROMETRO_ENTRADA: 'hidrometro_entrada', // Entrada do shopping

  // Temperature contexts
  TERMOSTATO: 'termostato',
  TERMOSTATO_EXTERNAL: 'termostato_external',
};

/**
 * Detect the domain of a device based on its deviceType.
 *
 * @param {Object} device - Device object with deviceType property
 * @param {string} [device.deviceType] - The device type string
 * @returns {'energy' | 'water' | 'temperature'} The detected domain
 *
 * @example
 * detectDomain({ deviceType: 'HIDROMETRO' }); // 'water'
 * detectDomain({ deviceType: 'TERMOSTATO' }); // 'temperature'
 * detectDomain({ deviceType: '3F_MEDIDOR' }); // 'energy'
 */
export function detectDomain(device) {
  const deviceType = String(device?.deviceType || '').toUpperCase();

  // Water detection: HIDROMETRO or HIDROMETRO_AREA_COMUM
  if (deviceType.includes('HIDROMETRO') || deviceType.includes('HIDRO')) {
    return DomainType.WATER;
  }

  // Temperature detection: TERMOSTATO or TERMOSTATO_EXTERNAL
  if (deviceType.includes('TERMOSTATO')) {
    return DomainType.TEMPERATURE;
  }

  // Default: Energy (3F_MEDIDOR, ENTRADA, RELOGIO, TRAFO, SUBESTACAO, etc.)
  return DomainType.ENERGY;
}

/**
 * RFC-0111: Detect device context based on deviceType, deviceProfile, and identifier.
 *
 * WATER Rules (priority order):
 * 1. deviceType = HIDROMETRO_SHOPPING OR deviceProfile = HIDROMETRO_SHOPPING → ENTRADA (main water meter)
 * 2. deviceProfile = HIDROMETRO_AREA_COMUM AND identifier = 'BANHEIROS' → BANHEIROS
 * 3. deviceProfile = HIDROMETRO_AREA_COMUM → AREA_COMUM (common area without bathrooms)
 * 4. deviceType = deviceProfile = HIDROMETRO → LOJAS (store water meters)
 *
 * ENERGY Rules:
 * - deviceType = deviceProfile = 3F_MEDIDOR → STORE (stores)
 * - deviceType = 3F_MEDIDOR AND deviceProfile != 3F_MEDIDOR → equipments
 * - deviceType != 3F_MEDIDOR AND NOT (ENTRADA/RELOGIO/TRAFO/SUBESTACAO) → equipments
 * - deviceType = ENTRADA/RELOGIO/TRAFO/SUBESTACAO → ENTRADA ENERGY
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
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase();
  const identifier = String(device?.identifier || '').toUpperCase();
  const entradaTypes = ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'];
  const isEntrada = entradaTypes.some((t) => deviceType.includes(t) || deviceProfile.includes(t));

  if (domain === DomainType.WATER) {
    // Priority 1: HIDROMETRO_SHOPPING → ENTRADA (main water meter for shopping)
    if (deviceType.includes('HIDROMETRO_SHOPPING') || deviceProfile.includes('HIDROMETRO_SHOPPING')) {
      return ContextType.HIDROMETRO_ENTRADA;
    }

    // Priority 2: BANHEIROS (identifier = 'BANHEIROS' with HIDROMETRO_AREA_COMUM profile)
    if (deviceProfile.includes('HIDROMETRO_AREA_COMUM') && identifier === 'BANHEIROS') {
      return ContextType.BANHEIROS;
    }

    // Priority 3: HIDROMETRO_AREA_COMUM (common area without bathroom identifier)
    if (deviceProfile.includes('HIDROMETRO_AREA_COMUM') || deviceType.includes('HIDROMETRO_AREA_COMUM')) {
      return ContextType.HIDROMETRO_AREA_COMUM;
    }

    // Priority 4: deviceType = HIDROMETRO and deviceProfile = HIDROMETRO → store (lojas)
    if (deviceType.includes('HIDROMETRO') && deviceProfile.includes('HIDROMETRO')) {
      return ContextType.HIDROMETRO;
    }

    // Default for water: hidrometro (store)
    return ContextType.HIDROMETRO;
  }

  if (domain === DomainType.ENERGY) {
    // RFC-0111: ENTRADA/RELOGIO/TRAFO/SUBESTACAO → ENTRADA ENERGY (main meters)
    if (isEntrada) {
      return ContextType.ENTRADA;
    }
    // RFC-0111: deviceType = deviceProfile = 3F_MEDIDOR → STORE (stores)
    if (deviceType === '3F_MEDIDOR' && deviceProfile === '3F_MEDIDOR') {
      return ContextType.STORES;
    }
    // RFC-0111: deviceType = 3F_MEDIDOR AND deviceProfile != 3F_MEDIDOR → equipments
    if (deviceType === '3F_MEDIDOR' && deviceProfile !== '3F_MEDIDOR') {
      return ContextType.EQUIPMENTS;
    }
    // RFC-0111: deviceType != 3F_MEDIDOR → equipments
    return ContextType.EQUIPMENTS;
  }

  if (domain === DomainType.TEMPERATURE) {
    // TERMOSTATO_EXTERNAL in deviceType → external (non-climatized)
    if (deviceType.includes('TERMOSTATO_EXTERNAL')) {
      return ContextType.TERMOSTATO_EXTERNAL;
    }

    // deviceType = TERMOSTATO AND deviceProfile = TERMOSTATO_EXTERNAL → external
    if (deviceType.includes('TERMOSTATO') && deviceProfile.includes('EXTERNAL')) {
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
  const domain = detectDomain(device);
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
