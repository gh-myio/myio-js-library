/**
 * Equipment Category Utilities
 * Centralized equipment subcategorization for MYIO components
 *
 * @module equipmentCategory
 * @version 1.0.0
 * @see RFC-0128
 */

/**
 * Equipment category types
 * @enum {string}
 */
export const EquipmentCategory = {
  ENTRADA: 'entrada',
  LOJAS: 'lojas',
  CLIMATIZACAO: 'climatizacao',
  ELEVADORES: 'elevadores',
  ESCADAS_ROLANTES: 'escadas_rolantes',
  OUTROS: 'outros',
  AREA_COMUM: 'area_comum', // Calculated (residual)
};

/**
 * Equipment classification configuration
 * Ported from MAIN_VIEW/controller.js DEVICE_CLASSIFICATION_CONFIG
 *
 * 2026-07-14: deviceType está EM DESUSO — classificação usa APENAS
 * deviceProfile + identifier (attr curado). As chaves deviceTypes/
 * conditionalDeviceTypes foram removidas.
 */
export const EQUIPMENT_CLASSIFICATION_CONFIG = {
  climatizacao: {
    deviceProfiles: ['CHILLER', 'FANCOIL', 'HVAC', 'AR_CONDICIONADO', 'BOMBA_CAG'],
    conditionalDeviceProfiles: ['BOMBA', 'MOTOR'], // + identifier CAG/FANCOIL
    identifiers: ['CAG', 'FANCOIL', 'HVAC'],
    identifierPrefixes: ['CAG-', 'FANCOIL-'],
  },
  elevadores: {
    deviceProfiles: ['ELEVADOR'],
    identifiers: ['ELV', 'ELEVADOR', 'ELEVADORES'],
    identifierPrefixes: ['ELV-', 'ELEVADOR-'],
  },
  escadas_rolantes: {
    deviceProfiles: ['ESCADA_ROLANTE'],
    identifiers: ['ESC', 'ESCADA', 'ESCADASROLANTES'],
    identifierPrefixes: ['ESC-', 'ESCADA-', 'ESCADA_'],
  },
  entrada: {
    deviceProfiles: ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'],
  },
};

/**
 * Display metadata for each category
 */
const CATEGORY_DISPLAY_MAP = {
  [EquipmentCategory.ENTRADA]: { name: 'Entrada', icon: '📥' },
  [EquipmentCategory.LOJAS]: { name: 'Lojas', icon: '🏬' },
  [EquipmentCategory.CLIMATIZACAO]: { name: 'Climatização', icon: '❄️' },
  [EquipmentCategory.ELEVADORES]: { name: 'Elevadores', icon: '🛗' },
  [EquipmentCategory.ESCADAS_ROLANTES]: { name: 'Esc. Rolantes', icon: '🎢' },
  [EquipmentCategory.OUTROS]: { name: 'Outros', icon: '⚙️' },
  [EquipmentCategory.AREA_COMUM]: { name: 'Área Comum', icon: '🏢' },
};

/**
 * Classify an energy device into its equipment category.
 *
 * ⚠️ AUTORIDADE: deviceProfile decide (deviceType está EM DESUSO e não é lido);
 * identifier (attr SERVER_SCOPE curado) complementa; name/label nunca entram.
 *
 * Priority order (sobre o deviceProfile):
 * 1. ENTRADA (main meters): profile contém ENTRADA, RELOGIO, TRAFO, SUBESTACAO
 * 2. LOJAS (stores): profile começa com '3F_MEDIDOR'
 * 3. CLIMATIZACAO: profile CHILLER/FANCOIL/HVAC/AR_CONDICIONADO/BOMBA_CAG, ou identifier CAG
 * 4. ELEVADORES: profile ELEVADOR or ELV- identifier prefix
 * 5. ESCADAS_ROLANTES: profile ESCADA_ROLANTE or ESC- identifier prefix
 * 6. OUTROS: remaining equipment
 *
 * @param {Object} device - Device object
 * @param {string} [device.deviceProfile] - Device profile (única autoridade)
 * @param {string} [device.identifier] - Device identifier (server_scope attribute)
 * @returns {string} Equipment category from EquipmentCategory enum
 *
 * @example
 * classifyEquipment({ deviceProfile: 'CHILLER' }); // 'climatizacao'
 * classifyEquipment({ deviceProfile: '3F_MEDIDOR' }); // 'lojas'
 * classifyEquipment({ deviceProfile: 'ENTRADA' }); // 'entrada'
 */
export function classifyEquipment(device) {
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase().trim();
  const identifier = String(device?.identifier || '').toUpperCase();

  // Priority 1: ENTRADA (main meters) — pelo PROFILE apenas
  const entradaProfiles = ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'];
  if (entradaProfiles.some((t) => deviceProfile.includes(t))) {
    return EquipmentCategory.ENTRADA;
  }

  // Priority 2: LOJAS (stores) — inclui variantes (3F_MEDIDOR_ARQUIVADO_...)
  if (deviceProfile.startsWith('3F_MEDIDOR')) {
    return EquipmentCategory.LOJAS;
  }

  // Priority 3: CLIMATIZACAO (BOMBA_CAG incluso — é climatização, não bomba BAS)
  const hvacProfiles = ['CHILLER', 'FANCOIL', 'HVAC', 'AR_CONDICIONADO', 'BOMBA_CAG'];
  const hvacIdentifiers = ['CAG', 'HVAC', 'AR_CONDICIONADO'];
  if (
    hvacProfiles.some((t) => deviceProfile.includes(t)) ||
    hvacIdentifiers.some((id) => identifier.includes(id))
  ) {
    return EquipmentCategory.CLIMATIZACAO;
  }

  // Conditional: profile BOMBA/MOTOR com identifier CAG/FANCOIL → climatizacao
  if (
    ['BOMBA', 'MOTOR'].some((t) => deviceProfile.includes(t)) &&
    ['CAG', 'FANCOIL'].some((id) => identifier.includes(id))
  ) {
    return EquipmentCategory.CLIMATIZACAO;
  }

  // Priority 4: ELEVADORES
  if (
    deviceProfile.includes('ELEVADOR') ||
    identifier.startsWith('ELV-') ||
    identifier.startsWith('ELEVADOR-')
  ) {
    return EquipmentCategory.ELEVADORES;
  }

  // Priority 5: ESCADAS ROLANTES
  if (
    deviceProfile.includes('ESCADA') ||
    identifier.startsWith('ESC-') ||
    identifier.startsWith('ESCADA')
  ) {
    return EquipmentCategory.ESCADAS_ROLANTES;
  }

  // Default: OUTROS
  return EquipmentCategory.OUTROS;
}

/**
 * Classify an equipment device into a subcategory (for detailed breakdown).
 *
 * @param {Object} device - Device object
 * @param {string} category - Parent category from classifyEquipment()
 * @returns {string|null} Subcategory name or null if no subcategory applies
 *
 * @example
 * classifyEquipmentSubcategory({ deviceProfile: 'CHILLER' }, 'climatizacao'); // 'Chillers'
 * classifyEquipmentSubcategory({ deviceProfile: 'BOMBA_INCENDIO' }, 'outros'); // 'Bombas de Incêndio'
 */
export function classifyEquipmentSubcategory(device, category) {
  // deviceProfile + identifier apenas (deviceType em desuso)
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase().trim();
  const identifier = String(device?.identifier || '').toUpperCase();

  if (category === EquipmentCategory.CLIMATIZACAO) {
    if (deviceProfile.includes('CHILLER')) return 'Chillers';
    if (deviceProfile.includes('FANCOIL')) return 'Fancoils';
    if (identifier.includes('CAG') || deviceProfile.includes('CENTRAL')) return 'CAG';
    if (deviceProfile.includes('BOMBA') && !deviceProfile.includes('INCENDIO')) return 'Bombas Hidráulicas';
    return 'Outros HVAC';
  }

  if (category === EquipmentCategory.OUTROS) {
    if (/ILUMINA|LUZ|LAMPADA|LED/.test(deviceProfile) || /ILUMINA|LUZ/.test(identifier)) return 'Iluminação';
    if (/INCENDIO|INCÊNDIO/.test(deviceProfile) || /INCENDIO/.test(identifier)) return 'Bombas de Incêndio';
    if (/GERADOR|NOBREAK|UPS/.test(deviceProfile)) return 'Geradores/Nobreaks';
    return 'Geral';
  }

  return null; // No subcategory for other categories
}

/**
 * Get display metadata for a category.
 *
 * @param {string} category - Category from EquipmentCategory enum
 * @returns {{ name: string, icon: string }}
 *
 * @example
 * getCategoryDisplayInfo('climatizacao'); // { name: 'Climatização', icon: '❄️' }
 */
export function getCategoryDisplayInfo(category) {
  return CATEGORY_DISPLAY_MAP[category] || { name: 'Desconhecido', icon: '❓' };
}

/**
 * Build category summary from classified devices.
 * Calculates device counts, consumption totals, percentages, and subcategories.
 * Área Comum is calculated as residual: Entrada - (Lojas + Climatização + Elevadores + Esc. Rolantes + Outros)
 *
 * @param {Object[]} devices - Array of device objects with value/consumption
 * @returns {Object} Category summary with counts, consumption, and percentages
 *
 * @example
 * const summary = buildEquipmentCategorySummary(devices);
 * // {
 * //   entrada: { count: 5, consumption: 1000, percentage: 100, devices: [...], subcategories: {} },
 * //   lojas: { count: 50, consumption: 500, percentage: 50, devices: [...], subcategories: {} },
 * //   climatizacao: { count: 20, consumption: 300, percentage: 30, devices: [...], subcategories: { Chillers: {...} } },
 * //   ...
 * // }
 */
export function buildEquipmentCategorySummary(devices) {
  const summary = {};

  // Initialize all categories
  Object.values(EquipmentCategory).forEach((cat) => {
    summary[cat] = {
      devices: [],
      count: 0,
      consumption: 0,
      percentage: 0,
      subcategories: {},
    };
  });

  // Classify each device
  for (const device of devices) {
    const category = classifyEquipment(device);
    const value = Number(device.value || device.consumption || 0);

    summary[category].devices.push(device);
    summary[category].count++;
    summary[category].consumption += value;

    // Track subcategories
    const subcategory = classifyEquipmentSubcategory(device, category);
    if (subcategory) {
      if (!summary[category].subcategories[subcategory]) {
        summary[category].subcategories[subcategory] = { count: 0, consumption: 0, devices: [] };
      }
      summary[category].subcategories[subcategory].count++;
      summary[category].subcategories[subcategory].consumption += value;
      summary[category].subcategories[subcategory].devices.push(device);
    }
  }

  // Calculate Área Comum (residual)
  const entradaConsumption = summary[EquipmentCategory.ENTRADA].consumption;
  const mappedConsumption =
    summary[EquipmentCategory.LOJAS].consumption +
    summary[EquipmentCategory.CLIMATIZACAO].consumption +
    summary[EquipmentCategory.ELEVADORES].consumption +
    summary[EquipmentCategory.ESCADAS_ROLANTES].consumption +
    summary[EquipmentCategory.OUTROS].consumption;

  summary[EquipmentCategory.AREA_COMUM].consumption = Math.max(0, entradaConsumption - mappedConsumption);

  // Calculate percentages (based on Entrada total)
  const total = entradaConsumption || mappedConsumption;
  Object.values(EquipmentCategory).forEach((cat) => {
    summary[cat].percentage = total > 0 ? (summary[cat].consumption / total) * 100 : 0;
  });

  return summary;
}

/**
 * Build category data array for tooltip display.
 * Returns array format compatible with EnergySummaryTooltip component.
 *
 * @param {Object[]} devices - Array of device objects
 * @returns {Array<{id: string, name: string, icon: string, deviceCount: number, consumption: number, percentage: number, children?: Array}>}
 *
 * @example
 * const categories = buildEquipmentCategoryDataForTooltip(devices);
 * // [
 * //   { id: 'entrada', name: 'Entrada', icon: '📥', deviceCount: 5, consumption: 1000, percentage: 100 },
 * //   { id: 'lojas', name: 'Lojas', icon: '🏬', deviceCount: 50, consumption: 500, percentage: 50, children: [] },
 * //   ...
 * // ]
 */
export function buildEquipmentCategoryDataForTooltip(devices) {
  const summary = buildEquipmentCategorySummary(devices);
  const categories = [];

  // Order: Entrada, Lojas, Área Comum (with children: Climatização, Elevadores, Esc. Rolantes, Outros)
  const categoryOrder = [
    EquipmentCategory.ENTRADA,
    EquipmentCategory.LOJAS,
    EquipmentCategory.CLIMATIZACAO,
    EquipmentCategory.ELEVADORES,
    EquipmentCategory.ESCADAS_ROLANTES,
    EquipmentCategory.OUTROS,
    EquipmentCategory.AREA_COMUM,
  ];

  for (const cat of categoryOrder) {
    const data = summary[cat];
    const display = getCategoryDisplayInfo(cat);

    // Build children from subcategories
    const children = Object.entries(data.subcategories).map(([name, sub]) => ({
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      icon: '',
      deviceCount: sub.count,
      consumption: sub.consumption,
      percentage: data.consumption > 0 ? (sub.consumption / data.consumption) * 100 : 0,
    }));

    // Only include categories with devices or consumption (for Área Comum)
    if (data.count > 0 || data.consumption > 0) {
      categories.push({
        id: cat,
        name: display.name,
        icon: display.icon,
        deviceCount: data.count,
        consumption: data.consumption,
        percentage: data.percentage,
        children: children.length > 0 ? children : undefined,
      });
    }
  }

  return categories;
}

/**
 * Check if a device is a store (Loja) device.
 * Store devices have deviceProfile starting with '3F_MEDIDOR' (deviceType em desuso).
 *
 * @param {Object} device - Device object
 * @returns {boolean} True if device is a store device
 *
 * @example
 * isStoreDevice({ deviceProfile: '3F_MEDIDOR' }); // true
 * isStoreDevice({ deviceProfile: 'CHILLER' }); // false
 */
export function isStoreDevice(device) {
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase().trim();
  return deviceProfile.startsWith('3F_MEDIDOR');
}

/**
 * Check if a device is an equipment (Área Comum) device.
 * Equipment = energia que NÃO é loja nem entrada (pelo deviceProfile).
 *
 * @param {Object} device - Device object
 * @returns {boolean} True if device is an equipment device
 *
 * @example
 * isEquipmentDevice({ deviceProfile: 'CHILLER' }); // true
 * isEquipmentDevice({ deviceProfile: '3F_MEDIDOR' }); // false
 */
export function isEquipmentDevice(device) {
  const cat = classifyEquipment(device);
  return cat !== EquipmentCategory.LOJAS && cat !== EquipmentCategory.ENTRADA;
}

/**
 * Check if a device is an entrada (main meter) device.
 *
 * @param {Object} device - Device object
 * @returns {boolean} True if device is an entrada device
 */
export function isEntradaDevice(device) {
  return classifyEquipment(device) === EquipmentCategory.ENTRADA;
}
