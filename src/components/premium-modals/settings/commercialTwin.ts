/**
 * Dados de cadastro comerciais (ABL / Contrato / Segmento / Atividade) — só fazem
 * sentido para LOJAS: medidor de energia (deviceProfile 3F_MEDIDOR) e hidrômetro
 * (deviceProfile HIDROMETRO). Os dois devices de uma mesma loja compartilham o
 * mesmo `identifier` (SERVER_SCOPE) e devem ter os MESMOS dados comerciais:
 *  - ao abrir, o hidrômetro herda os valores do medidor de energia "gêmeo"
 *    (mesmo identifier, mesmo customer); o medidor de energia só completa o que
 *    lhe falta com os valores do hidrômetro;
 *  - ao salvar (em qualquer um dos dois), os 4 campos são gravados em ambos.
 * Outros deviceProfiles não exibem a seção.
 */

export const COMMERCIAL_KEYS = ['abl', 'contract', 'segment', 'activity'] as const;
export type CommercialKey = (typeof COMMERCIAL_KEYS)[number];

const ENERGY_STORE_PROFILE = '3F_MEDIDOR';
const WATER_STORE_PROFILE = 'HIDROMETRO';

export function normalizeProfile(profile?: string | null): string {
  return String(profile || '').trim().toUpperCase();
}

/** A seção de dados de cadastro só existe para 3F_MEDIDOR e HIDROMETRO. */
export function isCommercialProfile(profile?: string | null): boolean {
  const p = normalizeProfile(profile);
  return p === ENERGY_STORE_PROFILE || p === WATER_STORE_PROFILE;
}

/** Profile do device "gêmeo" da mesma loja (energia ↔ água), ou null. */
export function twinProfileOf(profile?: string | null): string | null {
  const p = normalizeProfile(profile);
  if (p === ENERGY_STORE_PROFILE) return WATER_STORE_PROFILE;
  if (p === WATER_STORE_PROFILE) return ENERGY_STORE_PROFILE;
  return null;
}

export interface CommercialTwin {
  id: string;
  name: string;
  label: string;
  attrs: Partial<Record<CommercialKey, string>>;
}

const isFilled = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== '';

/**
 * Mescla os dados comerciais do gêmeo nos dados do device aberto.
 *  - HIDROMETRO: herda do medidor de energia (valor preenchido do gêmeo prevalece).
 *  - 3F_MEDIDOR: mantém os próprios; só completa campos vazios com os do hidrômetro.
 */
export function mergeTwinCommercial(
  own: Record<string, any>,
  twinAttrs: Partial<Record<CommercialKey, string>> | undefined,
  ownProfile?: string | null
): Record<string, any> {
  if (!twinAttrs) return own;
  const merged = { ...own };
  const inheritsFromTwin = normalizeProfile(ownProfile) === WATER_STORE_PROFILE;
  for (const key of COMMERCIAL_KEYS) {
    const twinValue = twinAttrs[key];
    if (!isFilled(twinValue)) continue;
    if (inheritsFromTwin || !isFilled(merged[key])) merged[key] = String(twinValue).trim();
  }
  return merged;
}

/** Só os campos comerciais preenchidos do formulário (mesma regra do save: vazio não é gravado). */
export function pickCommercial(formData: Record<string, any>): Partial<Record<CommercialKey, string>> {
  const out: Partial<Record<CommercialKey, string>> = {};
  for (const key of COMMERCIAL_KEYS) {
    if (isFilled(formData[key])) out[key] = String(formData[key]).trim();
  }
  return out;
}

export interface FindCommercialTwinsParams {
  tbBaseUrl: string;
  jwtToken: string;
  customerId?: string | null;
  deviceId: string;
  deviceProfile?: string | null;
  identifier?: string | null;
  fetchImpl?: typeof fetch;
}

/**
 * Busca no ThingsBoard os devices gêmeos: profile oposto (3F_MEDIDOR ↔ HIDROMETRO),
 * mesmo `identifier` (SERVER_SCOPE) e MESMO customer. Sem customerId não busca
 * (um tenant admin enxergaria lojas de outros shoppings com o mesmo identifier).
 */
export async function findCommercialTwins(params: FindCommercialTwinsParams): Promise<CommercialTwin[]> {
  const { tbBaseUrl, jwtToken, customerId, deviceId } = params;
  const doFetch = params.fetchImpl || fetch;
  const twinProfile = twinProfileOf(params.deviceProfile);
  const identifier = String(params.identifier || '').trim();
  if (!twinProfile || !identifier || !customerId || !jwtToken) return [];

  const headers = { 'X-Authorization': `Bearer ${jwtToken}`, 'Content-Type': 'application/json' };
  const body = {
    entityFilter: { type: 'deviceType', deviceType: twinProfile, deviceTypes: [twinProfile], deviceNameFilter: '' },
    keyFilters: [
      {
        key: { type: 'SERVER_ATTRIBUTE', key: 'identifier' },
        valueType: 'STRING',
        predicate: { type: 'STRING', operation: 'EQUAL', value: { defaultValue: identifier }, ignoreCase: true },
      },
    ],
    entityFields: [
      { type: 'ENTITY_FIELD', key: 'name' },
      { type: 'ENTITY_FIELD', key: 'label' },
    ],
    latestValues: [
      { type: 'SERVER_ATTRIBUTE', key: 'identifier' },
      ...COMMERCIAL_KEYS.map((key) => ({ type: 'SERVER_ATTRIBUTE', key })),
    ],
    pageLink: { page: 0, pageSize: 20 },
  };

  const res = await doFetch(`${tbBaseUrl}/api/entitiesQuery/find`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`entitiesQuery HTTP ${res.status}`);
  const json = await res.json();

  const candidates: CommercialTwin[] = [];
  for (const row of json?.data || []) {
    const id = row?.entityId?.id;
    if (!id || id === deviceId) continue;
    const attrValue = (k: string) => row?.latest?.SERVER_ATTRIBUTE?.[k]?.value;
    // keyFilter já filtra; confere de novo (trim) para não casar por acidente
    if (String(attrValue('identifier') || '').trim().toUpperCase() !== identifier.toUpperCase()) continue;
    const attrs: Partial<Record<CommercialKey, string>> = {};
    for (const key of COMMERCIAL_KEYS) {
      const v = attrValue(key);
      if (isFilled(v)) attrs[key] = String(v).trim();
    }
    candidates.push({
      id,
      name: String(row?.latest?.ENTITY_FIELD?.name?.value || ''),
      label: String(row?.latest?.ENTITY_FIELD?.label?.value || ''),
      attrs,
    });
  }

  // Mesmo customer: confirma device a device (poucos candidatos)
  const twins: CommercialTwin[] = [];
  for (const c of candidates) {
    try {
      const r = await doFetch(`${tbBaseUrl}/api/device/${c.id}`, { headers });
      if (!r.ok) continue;
      const device = await r.json();
      if (device?.customerId?.id === customerId) twins.push(c);
    } catch {
      // device inacessível: não é tratado como gêmeo
    }
  }
  return twins;
}
