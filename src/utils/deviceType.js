/**
 * Device detection contexts for different environments
 */
const contexts = {
  building: (name) => {
    const upper = name.toUpperCase();

    if (upper.includes('COMPRESSOR')) return 'COMPRESSOR';
    if (upper.includes('VENT')) return 'VENTILADOR';
    if (upper.includes('AUTOMATICO') || upper.includes('AUTOMÁTICO')) return 'SELETOR_AUTO_MANUAL';
    if (upper.includes('TERMOSTATO')) return 'TERMOSTATO';
    if (upper.includes('3F')) return '3F_MEDIDOR';
    if (upper.includes('TERMO') || upper.includes('TEMP')) return 'TERMOSTATO';
    if (upper.includes('HIDR')) return 'HIDROMETRO';
    if (upper.includes('ABRE')) return 'SOLENOIDE';
    if (upper.includes('RECALQUE')) return 'MOTOR';
    if (upper.includes('AUTOMACAO') || upper.includes('AUTOMAÇÃO')) return 'GLOBAL_AUTOMACAO';
    if (upper.includes('AC')) return 'CONTROLE REMOTO';
    if (upper.includes('SCD')) return 'CAIXA_D_AGUA';

    return 'default';
  },

  mall: (name) => {
    const upper = name.toUpperCase();

    if (upper.includes('CHILLER')) return 'CHILLER';
    if (upper.includes('ESCADA')) return 'ESCADA_ROLANTE';
    if (upper.includes('LOJA')) return 'LOJA_SENSOR';
    if (upper.includes('ILUMINACAO') || upper.includes('ILUMINAÇÃO')) return 'ILUMINACAO';

    return 'default';
  }
};

/**
 * Detects the device type based on the given name and context.
 * Uses the specified detection context to identify device types.
 * If the specified context does not exist, falls back to 'building' context.
 * 
 * @param {string} name - The name of the device (e.g., "Compressor 7 Andar").
 * @param {string} [context='building'] - The detection context (e.g., "mall", "building").
 * @returns {string} - The detected device type (e.g., "COMPRESSOR", "VENTILADOR", or "default").
 */
export function detectDeviceType(name, context = 'building') {
  if (typeof name !== 'string') {
    throw new Error('Device name must be a string.');
  }

  const detectFunction = contexts[context];
  
  if (!detectFunction) {
    console.warn(`[myio-js-library] Context "${context}" not found. Using default fallback.`);
    return contexts.building(name);
  }

  return detectFunction(name);
}

/**
 * Get available detection contexts
 * @returns {string[]} Array of available context names
 */
export function getAvailableContexts() {
  return Object.keys(contexts);
}

/**
 * Add a custom detection context
 * @param {string} contextName - Name of the new context
 * @param {function} detectFunction - Function that takes a device name and returns a device type
 */
export function addDetectionContext(contextName, detectFunction) {
  if (typeof contextName !== 'string') {
    throw new Error('Context name must be a string.');
  }
  
  if (typeof detectFunction !== 'function') {
    throw new Error('Detection function must be a function.');
  }

  contexts[contextName] = detectFunction;
}
