/**
 * Cria um device *_MANUAL no ThingsBoard (aba "Disp. Manuais" do Shopping v-5.2.0).
 *
 * - energia → deviceProfile/type `3F_MEDIDOR_MANUAL`, nome "3F <SIGLA>_LOJA_<NNN>_MANUAL"
 * - água    → deviceProfile/type `HIDROMETRO_MANUAL`, nome "Hidr. <SIGLA>_LOJA_<NNN>_MANUAL"
 *
 * O usuário informa só etiqueta (label) + identificador (atributo `identifier`). A SIGLA vem do
 * asset (ASSET_STB_DEVICES_MANUAIS → STB) e NNN é o próximo número livre do tipo no customer.
 *
 * Por baixo dos panos: dono = customer, relação `Contains` a partir do asset do customer
 * cujo nome termina em `_DEVICES_MANUAIS` (ex.: ASSET_STB_DEVICES_MANUAIS) e atributos
 * SERVER_SCOPE `deviceProfile` + `identifier`. Se uma etapa posterior à criação falhar, o
 * device criado é removido para não deixar órfão.
 */

export type ManualDeviceDomain = 'energy' | 'water';

export const MANUAL_DEVICE_PROFILES: Record<ManualDeviceDomain, string> = {
  energy: '3F_MEDIDOR_MANUAL',
  water: 'HIDROMETRO_MANUAL',
};

const NAME_PREFIX: Record<ManualDeviceDomain, string> = {
  energy: '3F ',
  water: 'Hidr. ',
};

export const MANUAL_ASSET_SUFFIX = '_DEVICES_MANUAIS';

export interface CreateManualDeviceParams {
  domain: ManualDeviceDomain;
  /** Etiqueta (label) exibida no card */
  label: string;
  /** Identificador (atributo `identifier`; também compõe o nome do device) */
  identifier: string;
  /** Customer TB dono do device (e do asset *_DEVICES_MANUAIS) */
  customerId: string;
  /** JWT do ThingsBoard (string ou função async — ex.: MyIOUtils.getFreshTbToken) */
  token: string | (() => string | Promise<string>);
  /** Base da API TB; default '' (mesma origem do dashboard) */
  baseUrl?: string;
  /** Injeção para testes; default window.fetch */
  fetchImpl?: typeof fetch;
}

export interface CreateManualDeviceResult {
  deviceId: string;
  name: string;
  label: string;
  identifier: string;
  deviceProfile: string;
  assetId: string;
  assetName: string;
}

/** Erro com mensagem amigável (exibida ao usuário) + detalhe técnico. */
export class ManualDeviceError extends Error {
  constructor(message: string, public readonly detail?: string) {
    super(message);
    this.name = 'ManualDeviceError';
  }
}

/**
 * Nome do device (o usuário não digita): "<prefixo> <SIGLA>_LOJA_<NNN>_MANUAL",
 * ex.: "3F STB_LOJA_002_MANUAL" / "Hidr. STB_LOJA_002_MANUAL".
 */
export function manualDeviceName(domain: ManualDeviceDomain, sigla: string, seq: number): string {
  return `${NAME_PREFIX[domain]}${sigla}_LOJA_${String(seq).padStart(3, '0')}_MANUAL`;
}

/** Sigla do shopping a partir do asset: "ASSET_STB_DEVICES_MANUAIS" → "STB". */
export function siglaFromManualAsset(assetName: string): string | null {
  const upper = String(assetName || '').trim().toUpperCase();
  if (!upper.endsWith(MANUAL_ASSET_SUFFIX)) return null;
  const sigla = upper.slice(0, -MANUAL_ASSET_SUFFIX.length).replace(/^ASSET_/, '');
  return /^[A-Z0-9_]+$/.test(sigla) ? sigla : null;
}

/** Próximo NNN livre entre os nomes já existentes do mesmo prefixo/sigla. */
export function nextManualSeq(domain: ManualDeviceDomain, sigla: string, existingNames: string[]): number {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${esc(NAME_PREFIX[domain])}${esc(sigla)}_LOJA_(\\d+)_MANUAL$`, 'i');
  const max = existingNames.reduce((acc, n) => {
    const m = re.exec(String(n || '').trim());
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return max + 1;
}

export async function createManualDevice(params: CreateManualDeviceParams): Promise<CreateManualDeviceResult> {
  const domain = params.domain;
  const profile = MANUAL_DEVICE_PROFILES[domain];
  if (!profile) throw new ManualDeviceError(`Domínio inválido: ${domain}`);
  const label = String(params.label || '').trim();
  const identifier = String(params.identifier || '').trim();
  if (!label) throw new ManualDeviceError('Informe a etiqueta.');
  if (!identifier) throw new ManualDeviceError('Informe o identificador.');
  if (!params.customerId) throw new ManualDeviceError('Cliente não identificado.');

  const base = params.baseUrl ?? '';
  const doFetch = params.fetchImpl ?? fetch.bind(window);
  const tokenValue = typeof params.token === 'function' ? await params.token() : params.token;
  const headers = { 'X-Authorization': `Bearer ${tokenValue}`, 'Content-Type': 'application/json' };

  const api = async (method: string, path: string, body?: unknown, okStatuses: number[] = []) => {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok && !okStatuses.includes(res.status)) {
      const text = await res.text().catch(() => '');
      throw new ManualDeviceError(`Falha na API (${res.status}).`, `${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
    }
    const text = await res.text().catch(() => '');
    return text ? JSON.parse(text) : null;
  };
  const cid = encodeURIComponent(params.customerId);

  // 1. asset *_DEVICES_MANUAIS do customer
  const assets = await api('GET', `/api/customer/${cid}/assets?pageSize=100&page=0&textSearch=MANUAIS`);
  const asset = (assets?.data || []).find((a: any) =>
    String(a?.name || '')
      .toUpperCase()
      .endsWith(MANUAL_ASSET_SUFFIX)
  );
  if (!asset) {
    throw new ManualDeviceError(
      'Local de dispositivos manuais não configurado para este shopping.',
      `nenhum asset do customer termina em ${MANUAL_ASSET_SUFFIX}`
    );
  }

  // 2. nome automático: sigla do asset + próximo sequencial livre do tipo
  const sigla = siglaFromManualAsset(asset.name);
  if (!sigla) {
    throw new ManualDeviceError(
      'Local de dispositivos manuais não configurado para este shopping.',
      `não foi possível extrair a sigla de "${asset.name}"`
    );
  }
  const existing = await api(
    'GET',
    `/api/customer/${cid}/devices?pageSize=1000&page=0&textSearch=${encodeURIComponent(`${sigla}_LOJA_`)}`
  );
  const existingNames: string[] = (existing?.data || []).map((d: any) => String(d?.name || ''));
  let seq = nextManualSeq(domain, sigla, existingNames);

  // 3. device profile (id); sem acesso à lista → TB resolve pelo `type`
  let deviceProfileId: { id: string; entityType: 'DEVICE_PROFILE' } | undefined;
  try {
    const profiles = await api('GET', `/api/deviceProfileInfos?pageSize=50&page=0&textSearch=${encodeURIComponent(profile)}`);
    const p = (profiles?.data || []).find((x: any) => x?.name === profile);
    if (p?.id?.id) deviceProfileId = { id: p.id.id, entityType: 'DEVICE_PROFILE' };
  } catch {
    /* fallback: type */
  }

  // 4. device — nome duplicado (outro usuário criou no meio tempo) → tenta o próximo número
  let name = manualDeviceName(domain, sigla, seq);
  let created: any = null;
  for (let attempt = 0; ; attempt++) {
    try {
      created = await api('POST', '/api/device', {
        name,
        label,
        ...(deviceProfileId ? { deviceProfileId } : { type: profile }),
        customerId: { id: params.customerId, entityType: 'CUSTOMER' },
      });
      break;
    } catch (err) {
      const dup = /already exists|já existe/i.test((err as ManualDeviceError)?.detail || '');
      if (!dup || attempt >= 4) throw err;
      seq += 1;
      name = manualDeviceName(domain, sigla, seq);
    }
  }
  const deviceId: string | undefined = created?.id?.id;
  if (!deviceId) throw new ManualDeviceError('O dispositivo não foi criado.', 'POST /api/device sem id na resposta');

  try {
    // 5. dono = customer (quando o POST não atribuiu)
    if (created?.customerId?.id !== params.customerId) {
      try {
        await api('POST', `/api/owner/CUSTOMER/${cid}/DEVICE/${deviceId}`);
      } catch {
        await api('POST', `/api/customer/${cid}/device/${deviceId}`);
      }
    }
    // 6. relação asset → device
    await api('POST', '/api/relation', {
      from: { id: asset.id.id, entityType: 'ASSET' },
      to: { id: deviceId, entityType: 'DEVICE' },
      type: 'Contains',
      typeGroup: 'COMMON',
    });
    // 7. atributos lidos pelo dashboard (deviceProfile é a autoridade de classificação)
    await api('POST', `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`, {
      deviceProfile: profile,
      identifier,
    });
  } catch (err) {
    // não deixa device órfão (sem asset/atributos)
    await api('DELETE', `/api/device/${deviceId}`).catch(() => undefined);
    throw err;
  }

  return { deviceId, name, label, identifier, deviceProfile: profile, assetId: asset.id.id, assetName: asset.name };
}
