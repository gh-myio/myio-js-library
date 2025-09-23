/**
 * Device detection contexts for different environments
 * Uses priority-based detection with accent-insensitive matching
 */

/**
 * Normalizes a string by uppercasing, removing diacritics, and collapsing spaces
 * @param {string} str - The string to normalize
 * @returns {string} - The normalized string
 */
function normalize(str) {
  if (typeof str !== 'string') return '';
  
  // Uppercase and trim
  let normalized = str.toUpperCase().trim();
  
  // Remove diacritics (accents)
  normalized = normalized
    .replace(/[ÀÁÂÃÄÅ]/g, 'A')
    .replace(/[ÈÉÊË]/g, 'E')
    .replace(/[ÌÍÎÏ]/g, 'I')
    .replace(/[ÒÓÔÕÖ]/g, 'O')
    .replace(/[ÙÚÛÜ]/g, 'U')
    .replace(/[Ç]/g, 'C')
    .replace(/[Ñ]/g, 'N');
  
  // Collapse multiple spaces to single space
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized;
}

/**
 * Checks if a normalized string matches CAIXA_D_AGUA variants
 * @param {string} normalizedStr - The normalized string to check
 * @returns {boolean} - True if it matches CAIXA_D_AGUA patterns
 */
function matchCaixaDAgua(normalizedStr) {
  // Check for SCD
  if (normalizedStr.includes('SCD')) return true;
  
  // Check for textual variants of "CAIXA D'ÁGUA"
  const caixaVariants = [
    'CAIXA D\'AGUA',
    'CAIXA D AGUA',
    'CAIXA_D_AGUA',
    'CAIXA DAGUA'
  ];
  
  return caixaVariants.some(variant => normalizedStr.includes(variant));
}

/**
 * Device detection contexts with priority-ordered rules
 */
const contexts = {
  building: (name) => {
    const normalized = normalize(name);
    
    // Priority-ordered detection rules (first match wins)
    const rules = [
      { test: (s) => s.includes('COMPRESSOR'), type: 'COMPRESSOR' },
      { test: (s) => s.includes('VENT'), type: 'VENTILADOR' },
      { test: (s) => s.includes('AUTOMATICO'), type: 'SELETOR_AUTO_MANUAL' },
      { test: (s) => s.includes('ESRL'), type: 'ESCADA_ROLANTE' },
      { test: (s) => s.includes('ESCADA'), type: 'ESCADA_ROLANTE' },
      { test: (s) => s.includes('ELEV'), type: 'ELEVADOR' },
      { test: (s) => s.includes('MOTR') || s.includes('RECALQUE'), type: 'MOTOR' },
      { test: (s) => s.includes('TERMOSTATO'), type: 'TERMOSTATO' },
      { test: (s) => s.includes('TERMO') || s.includes('TEMP'), type: 'TERMOSTATO' },
      { test: (s) => s.includes('3F'), type: '3F_MEDIDOR' },
      { test: (s) => s.includes('HIDR'), type: 'HIDROMETRO' },
      { test: (s) => s.includes('ABRE'), type: 'SOLENOIDE' },
      { test: (s) => matchCaixaDAgua(s), type: 'CAIXA_D_AGUA' },
      { test: (s) => s.includes('AUTOMACAO') || s.includes('GW_AUTO'), type: 'GLOBAL_AUTOMACAO' },
      { test: (s) => s.includes('AC'), type: 'CONTROLE REMOTO' }
    ];
    
    // Find first matching rule
    for (const rule of rules) {
      if (rule.test(normalized)) {
        return rule.type;
      }
    }
    
    return 'default';
  },

  mall: (name) => {
    const normalized = normalize(name);
    
    // Priority-ordered detection rules for mall context
    const rules = [
      { test: (s) => s.includes('CHILLER'), type: 'CHILLER' },
      { test: (s) => s.includes('ESCADA'), type: 'ESCADA_ROLANTE' },
      { test: (s) => s.includes('LOJA'), type: 'LOJA_SENSOR' },
      { test: (s) => s.includes('ILUMINACAO'), type: 'ILUMINACAO' }
    ];
    
    // Find first matching rule
    for (const rule of rules) {
      if (rule.test(normalized)) {
        return rule.type;
      }
    }
    
    return 'default';
  }
};

// Track if we've already warned about unknown contexts to avoid spam
const warnedContexts = new Set();

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
    // Only warn once per unknown context to avoid spam
    if (!warnedContexts.has(context)) {
      console.warn(`[myio-js-library] Context "${context}" not found. Using default fallback.`);
      warnedContexts.add(context);
    }
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
