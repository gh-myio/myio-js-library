/**
 * Decodes a base64 string then XORs each byte with xorKey (default 73).
 * Works in Node (>=18) and modern browsers.
 * @param {string} encoded
 * @param {number} [xorKey=73]
 * @returns {string}
 */
export function decodePayloadBase64Xor(encoded, xorKey = 73) {
  const bytes = base64ToBytes(encoded);
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= xorKey;
  return new TextDecoder().decode(bytes);
}

function base64ToBytes(b64) {
  if (typeof Buffer !== 'undefined' && Buffer.from) {
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
