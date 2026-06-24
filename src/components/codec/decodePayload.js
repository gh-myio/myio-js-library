// XOR sobre bytes decodificados de base64.
// - key string: repete a chave sobre os bytes
// - key number: aplica 1 byte (0..255) em todos os bytes
// - key vazia/undefined: sem XOR
export function decodePayload(encoded, key) {
  const bytes = base64ToBytesStrict(encoded);
  if (bytes.length === 0) return '';

  if (key === '' || key === undefined || key === null) {
    return new TextDecoder().decode(bytes);
  }

  if (typeof key === 'number' && Number.isFinite(key)) {
    const k = key & 0xff;
    for (let i = 0; i < bytes.length; i++) bytes[i] ^= k;
    return new TextDecoder().decode(bytes);
  }

  const keyStr = String(key);
  const keyBytes = new TextEncoder().encode(keyStr);
  if (keyBytes.length === 0) {
    return new TextDecoder().decode(bytes);
  }
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] ^= keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(bytes);
}

// Compat já existente (1 byte XOR)
export function decodePayloadBase64Xor(encoded, xorKey = 73) {
  const bytes = base64ToBytesStrict(encoded);
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= (xorKey & 0xff);
  return new TextDecoder().decode(bytes);
}

function base64ToBytesStrict(b64) {
  if (b64 === '' || b64 === undefined || b64 === null) return new Uint8Array();
  const s = String(b64).replace(/\s+/g, '');
  // valida base64 (com padding)
  const re = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!re.test(s)) throw new Error('Invalid base64');

  if (typeof Buffer !== 'undefined' && Buffer.from) {
    return Uint8Array.from(Buffer.from(s, 'base64'));
  }
  const bin = atob(s); // lança se inválido
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
