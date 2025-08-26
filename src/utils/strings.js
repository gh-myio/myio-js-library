/**
 * Normalize list-like inputs into a comma-separated string.
 * Accepts array, JSON-stringified array, or delimited strings (; , space).
 * @param {unknown} val
 * @returns {string}
 */
export function normalizeRecipients(val) {
  if (val === null || val === undefined || val === '') return '';
  if (Object.prototype.toString.call(val) === '[object Array]') {
    return /** @type {unknown[]} */(val).filter(Boolean).join(',');
  }
  let s = String(val).trim();
  if (/^\s*\[/.test(s)) {
    try {
      const arr = JSON.parse(s);
      if (Object.prototype.toString.call(arr) === '[object Array]') {
        return arr.filter(Boolean).join(',');
      }
    } catch { /* fall through */ }
  }
  s = s.replace(/[;\s]+/g, ',');
  s = s.replace(/,+/g, ',').replace(/^,|,$/g, '');
  return s;
}
