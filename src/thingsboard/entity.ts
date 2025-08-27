/**
 * ThingsBoard entity and attributes fetching utilities
 */

export interface TBFetchOptions {
  jwt: string;
  baseUrl?: string; // e.g., '', 'https://your-thingsboard', or '/api' prefix handling
  scope?: 'SERVER_SCOPE' | 'CLIENT_SCOPE' | 'SHARED_SCOPE';
  attributeKeys?: string[];
  fetcher?: typeof fetch;
}

export interface TBEntityInfo {
  label: string;
  andar: string;
  numeroLoja: string;
  identificadorMedidor: string;
  identificadorDispositivo: string;
  guid: string;
  consumoDiario: number;
  consumoMadrugada: number;
}

/**
 * Fetches ThingsBoard Device info + attributes (default: SERVER_SCOPE).
 * Safe defaults and robust coercion, suitable for direct UI use.
 * 
 * @param deviceId - The ThingsBoard device ID
 * @param opts - Configuration options including JWT token and API settings
 * @returns Promise resolving to device info and attributes
 * @throws Error if deviceId is missing, JWT is missing, or HTTP requests fail
 */
export async function getEntityInfoAndAttributesTB(
  deviceId: string,
  opts: TBFetchOptions
): Promise<TBEntityInfo> {
  if (!deviceId) throw new Error('getEntityInfoAndAttributesTB: deviceId is required');
  
  const {
    jwt,
    baseUrl = '',
    scope = 'SERVER_SCOPE',
    attributeKeys = [
      'floor',
      'NumLoja',
      'IDMedidor',
      'deviceId',
      'guid',
      'maxDailyConsumption',
      'maxNightConsumption'
    ],
    fetcher = globalThis.fetch?.bind(globalThis)
  } = opts || ({} as TBFetchOptions);

  if (!jwt) throw new Error('getEntityInfoAndAttributesTB: opts.jwt (Bearer token) is required');
  if (!fetcher) throw new Error('getEntityInfoAndAttributesTB: no fetch implementation available');

  const headers = {
    'Content-Type': 'application/json',
    'X-Authorization': `Bearer ${jwt}`,
  };

  // Normalize baseUrl (allow '', '/', or absolute host)
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  // 1) Fetch Device info
  const deviceRes = await fetcher(`${base}/api/device/${encodeURIComponent(deviceId)}`, { headers });
  if (!deviceRes.ok) {
    throw new Error(`Failed to fetch device: HTTP ${deviceRes.status} ${deviceRes.statusText}`);
  }
  const device = await deviceRes.json();
  const label: string = device?.label || device?.name || 'Sem etiqueta';

  // 2) Fetch Attributes
  const attrUrl = `${base}/api/plugins/telemetry/DEVICE/${encodeURIComponent(deviceId)}/values/attributes?scope=${encodeURIComponent(scope)}`;
  const attrRes = await fetcher(attrUrl, { headers });
  if (!attrRes.ok) {
    throw new Error(`Failed to fetch attributes: HTTP ${attrRes.status} ${attrRes.statusText}`);
  }
  const attributes = (await attrRes.json()) as Array<{ key: string; value: unknown }>;

  const map = new Map<string, unknown>();
  for (const a of attributes) map.set(a.key, a.value);

  // Helper getters with robust coercion
  const getStr = (k: string): string => {
    const v = map.get(k);
    if (v == null) return '';
    return typeof v === 'string' ? v : String(v);
  };
  
  const getNum = (k: string): number => {
    const v = map.get(k);
    if (v == null) return 0;
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Optionally only care about declared keys (no-op here, but kept for extensibility)
  void attributeKeys;

  return {
    label,
    andar: getStr('floor') || '',
    numeroLoja: getStr('NumLoja') || '',
    identificadorMedidor: getStr('IDMedidor') || '',
    identificadorDispositivo: getStr('deviceId') || '',
    guid: getStr('guid') || '',
    consumoDiario: getNum('maxDailyConsumption'),
    consumoMadrugada: getNum('maxNightConsumption'),
  };
}
