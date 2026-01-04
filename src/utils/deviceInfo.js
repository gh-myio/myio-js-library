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
  HIDROMETRO: 'hidrometro',
  HIDROMETRO_AREA_COMUM: 'hidrometro_area_comum',

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
 * RFC-0111: Detect device context based on deviceType and deviceProfile.
 *
 * WATER Rules:
 * - deviceType = deviceProfile = HIDROMETRO → STORE (hidrometro)
 * - deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_AREA_COMUM → AREA_COMUM
 * - deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_SHOPPING → ENTRADA WATER
 * - deviceType = HIDROMETRO_AREA_COMUM → AREA_COMUM
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
 * @param {Object} device - Device object with deviceType and deviceProfile properties
 * @param {string} [device.deviceType] - The device type string
 * @param {string} [device.deviceProfile] - The device profile string
 * @param {'energy' | 'water' | 'temperature'} domain - The device domain
 * @returns {string} The detected context
 *
 * @example
 * detectContext({ deviceType: 'HIDROMETRO', deviceProfile: 'HIDROMETRO' }, 'water');
 * // Returns 'hidrometro'
 *
 * @example
 * detectContext({ deviceType: '3F_MEDIDOR', deviceProfile: '3F_MEDIDOR' }, 'energy');
 * // Returns 'stores'
 *
 * @example
 * detectContext({ deviceType: 'TERMOSTATO', deviceProfile: 'TERMOSTATO_EXTERNAL' }, 'temperature');
 * // Returns 'termostato_external'
 */
export function detectContext(device, domain) {
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase();
  const entradaTypes = ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'];
  const isEntrada = entradaTypes.some((t) => deviceType.includes(t) || deviceProfile.includes(t));

  if (domain === DomainType.WATER) {
    // RFC-0111: HIDROMETRO_SHOPPING → ENTRADA WATER (main water meter for shopping)
    if (deviceProfile.includes('HIDROMETRO_SHOPPING')) {
      return ContextType.ENTRADA;
    }

    // HIDROMETRO_AREA_COMUM in deviceType or deviceProfile → area comum
    if (deviceType.includes('HIDROMETRO_AREA_COMUM')) {
      return ContextType.HIDROMETRO_AREA_COMUM;
    }

    // deviceType = deviceProfile = HIDROMETRO → store (hidrometro)
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
