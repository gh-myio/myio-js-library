/**
 * Adds a namespace (e.g., building name or location) to the keys of a payload object.
 * 
 * @param {object} payload - Original object with simple keys (e.g., { temperature: 22 }).
 * @param {string} namespace - Text to be appended as a suffix to the keys (e.g., "BB Campos dos Goytacazes").
 * @returns {object} - New object with renamed keys.
 * @throws {Error} - If payload is not an object.
 */
export function addNamespace(payload, namespace = '') {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Payload must be an object.');
  }

  const keys = Object.keys(payload);
  const suffix = namespace.trim() ? ` (${namespace.trim()})` : '';

  return keys.reduce((acc, key) => {
    acc[`${key}${suffix}`] = payload[key];
    return acc;
  }, {});
}
