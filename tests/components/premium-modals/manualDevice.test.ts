// tests/components/premium-modals/manualDevice.test.ts
// "+" da aba Disp. Manuais: cria device *_MANUAL no TB (asset *_DEVICES_MANUAIS, Contains,
// atributos deviceProfile/identifier) e o modal simples (etiqueta + identificador).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createManualDevice,
  manualDeviceName,
  siglaFromManualAsset,
  nextManualSeq,
  ManualDeviceError,
  openManualDeviceModal,
  resolveManualDeviceName,
} from '../../../src/components/premium-modals/manual-device';
import type { ManualProvisionPlan, ManualProvisionStep } from '../../../src/components/premium-modals/manual-device';

const CID = 'cust-1';
const ASSET = { id: { id: 'asset-1', entityType: 'ASSET' }, name: 'ASSET_STB_DEVICES_MANUAIS' };

type Call = { method: string; url: string; body: any };

function mockTb(
  opts: { assets?: any[]; existing?: any[]; failRelation?: boolean; ownerAssigned?: boolean; dupNames?: string[] } = {}
) {
  const calls: Call[] = [];
  const json = (status: number, data: unknown) =>
    new Response(data === undefined ? '' : JSON.stringify(data), { status });
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    if (method === 'GET' && url.includes(`/api/customer/${CID}/assets`)) return json(200, { data: opts.assets ?? [ASSET] });
    if (method === 'GET' && url.includes(`/api/customer/${CID}/devices`)) return json(200, { data: opts.existing ?? [] });
    if (method === 'GET' && url.includes('/api/deviceProfileInfos'))
      return json(200, {
        data: [
          { id: { id: 'prof-3f', entityType: 'DEVICE_PROFILE' }, name: '3F_MEDIDOR_MANUAL' },
          { id: { id: 'prof-hidr', entityType: 'DEVICE_PROFILE' }, name: 'HIDROMETRO_MANUAL' },
        ],
      });
    if (method === 'POST' && url.endsWith('/api/device') && (opts.dupNames || []).includes(body.name))
      return json(400, { message: 'Device with such name already exists!' });
    if (method === 'POST' && url.endsWith('/api/device'))
      return json(200, {
        id: { id: 'dev-new', entityType: 'DEVICE' },
        name: body.name,
        customerId: opts.ownerAssigned === false ? { id: 'tenant' } : { id: CID },
      });
    if (method === 'POST' && url.endsWith('/api/relation')) return opts.failRelation ? json(403, { message: 'denied' }) : json(200, undefined);
    if (method === 'POST' && url.includes('/attributes/SERVER_SCOPE')) return json(200, undefined);
    if (method === 'POST' && url.includes('/api/owner/')) return json(200, undefined);
    if (method === 'DELETE') return json(200, undefined);
    return json(404, { message: 'not mocked' });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

describe('createManualDevice', () => {
  it('energia: nome automático "3F STB_LOJA_001_MANUAL" (sigla do asset), profile 3F_MEDIDOR_MANUAL', async () => {
    const { calls, fetchImpl } = mockTb();
    const r = await createManualDevice({
      domain: 'energy',
      label: ' Burger King ',
      identifier: ' STB09999 ',
      customerId: CID,
      token: 'jwt',
      fetchImpl,
    });

    expect(r).toMatchObject({
      deviceId: 'dev-new',
      name: '3F STB_LOJA_001_MANUAL',
      label: 'Burger King',
      identifier: 'STB09999',
      deviceProfile: '3F_MEDIDOR_MANUAL',
      assetName: 'ASSET_STB_DEVICES_MANUAIS',
    });
    const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/api/device'))!;
    expect(create.body).toMatchObject({
      name: '3F STB_LOJA_001_MANUAL',
      label: 'Burger King',
      deviceProfileId: { id: 'prof-3f', entityType: 'DEVICE_PROFILE' },
      customerId: { id: CID, entityType: 'CUSTOMER' },
    });
    const rel = calls.find((c) => c.url.endsWith('/api/relation'))!;
    expect(rel.body).toMatchObject({
      from: { id: 'asset-1', entityType: 'ASSET' },
      to: { id: 'dev-new', entityType: 'DEVICE' },
      type: 'Contains',
    });
    const attrs = calls.find((c) => c.url.includes('/attributes/SERVER_SCOPE'))!;
    expect(attrs.body).toEqual({ deviceProfile: '3F_MEDIDOR_MANUAL', identifier: 'STB09999' });
    // dono já é o customer → não reatribui
    expect(calls.some((c) => c.url.includes('/api/owner/'))).toBe(false);
    // token enviado
    expect((fetchImpl as any).mock.calls[0][1].headers['X-Authorization']).toBe('Bearer jwt');
  });

  it('água: próximo número livre do tipo ("Hidr. STB_LOJA_004_MANUAL"); token pode ser função async', async () => {
    const { calls, fetchImpl } = mockTb({
      existing: [
        { name: 'Hidr. STB_LOJA_001_MANUAL' },
        { name: 'Hidr. STB_LOJA_003_MANUAL' },
        { name: '3F STB_LOJA_009_MANUAL' }, // outro tipo não conta
      ],
    });
    const r = await createManualDevice({
      domain: 'water',
      label: 'Lavoisier',
      identifier: 'STB01001',
      customerId: CID,
      token: async () => 'fresh',
      fetchImpl,
    });
    expect(r.name).toBe('Hidr. STB_LOJA_004_MANUAL');
    expect(r.deviceProfile).toBe('HIDROMETRO_MANUAL');
    expect(calls.find((c) => c.url.endsWith('/api/device'))!.body.deviceProfileId.id).toBe('prof-hidr');
  });

  it('reatribui o dono ao customer quando o POST não o fez', async () => {
    const { calls, fetchImpl } = mockTb({ ownerAssigned: false });
    await createManualDevice({ domain: 'energy', label: 'X', identifier: 'Y', customerId: CID, token: 't', fetchImpl });
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith(`/api/owner/CUSTOMER/${CID}/DEVICE/dev-new`))).toBe(true);
  });

  it('sem asset *_DEVICES_MANUAIS: erro amigável e nada é criado', async () => {
    const { calls, fetchImpl } = mockTb({ assets: [{ id: { id: 'a' }, name: 'OUTRO_ASSET_MANUAIS_X' }] });
    await expect(
      createManualDevice({ domain: 'energy', label: 'X', identifier: 'Y', customerId: CID, token: 't', fetchImpl })
    ).rejects.toThrow('Local de dispositivos manuais não configurado');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('nome já criado por outro usuário no meio tempo: tenta o próximo número', async () => {
    const { calls, fetchImpl } = mockTb({
      existing: [{ name: '3F STB_LOJA_001_MANUAL' }],
      dupNames: ['3F STB_LOJA_002_MANUAL'],
    });
    const r = await createManualDevice({ domain: 'energy', label: 'X', identifier: 'Y', customerId: CID, token: 't', fetchImpl });
    expect(r.name).toBe('3F STB_LOJA_003_MANUAL');
    expect(calls.filter((c) => c.method === 'POST' && c.url.endsWith('/api/device')).map((c) => c.body.name)).toEqual([
      '3F STB_LOJA_002_MANUAL',
      '3F STB_LOJA_003_MANUAL',
    ]);
  });

  it('falha depois de criar (relação): remove o device para não deixar órfão', async () => {
    const { calls, fetchImpl } = mockTb({ failRelation: true });
    await expect(
      createManualDevice({ domain: 'energy', label: 'X', identifier: 'Y', customerId: CID, token: 't', fetchImpl })
    ).rejects.toBeInstanceOf(ManualDeviceError);
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/api/device/dev-new'))).toBe(true);
  });

  it('valida etiqueta/identificador obrigatórios', async () => {
    const { fetchImpl } = mockTb();
    await expect(
      createManualDevice({ domain: 'energy', label: ' ', identifier: 'Y', customerId: CID, token: 't', fetchImpl })
    ).rejects.toThrow('Informe a etiqueta.');
    await expect(
      createManualDevice({ domain: 'energy', label: 'X', identifier: '', customerId: CID, token: 't', fetchImpl })
    ).rejects.toThrow('Informe o identificador.');
  });

  it('manualDeviceName / siglaFromManualAsset / nextManualSeq', () => {
    expect(manualDeviceName('energy', 'STB', 2)).toBe('3F STB_LOJA_002_MANUAL');
    expect(manualDeviceName('water', 'STB', 12)).toBe('Hidr. STB_LOJA_012_MANUAL');
    expect(siglaFromManualAsset('ASSET_STB_DEVICES_MANUAIS')).toBe('STB');
    expect(siglaFromManualAsset('asset_mxa_devices_manuais')).toBe('MXA');
    expect(siglaFromManualAsset('OUTRO')).toBeNull();
    expect(nextManualSeq('energy', 'STB', [])).toBe(1);
    expect(nextManualSeq('energy', 'STB', ['3F STB_LOJA_001_MANUAL', '3f stb_loja_010_manual', 'Hidr. STB_LOJA_050_MANUAL'])).toBe(11);
  });
});

describe('openManualDeviceModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const flush = () => new Promise((r) => setTimeout(r, 0));
  const btn = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('.myio-stdmodal__btn')).find((b) => b.textContent === label)!;
  const input = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;

  it('usuário final: só etiqueta + identificador; cria e conclui chamando onCreated', async () => {
    const { fetchImpl } = mockTb();
    const onCreated = vi.fn();
    openManualDeviceModal({ domain: 'energy', customerId: CID, token: 't', fetchImpl, onCreated });

    expect(document.querySelector('.myio-modal-header__title')!.textContent).toBe('Novo medidor de energia manual');
    expect(document.querySelectorAll('.myio-manualdev input').length).toBe(2);

    input('label').value = 'Burger King';
    input('identifier').value = 'STB09999';
    btn('Criar').click();
    await flush();
    await flush();

    const body = document.querySelector('.myio-stdmodal__body')!;
    expect(body.textContent).toContain('Medidor de energia criado');
    expect(body.textContent).toContain('Burger King');
    expect(body.querySelector('.myio-manualdev__tech')).toBeNull(); // sem detalhes técnicos
    btn('Concluir').click();
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ name: '3F STB_LOJA_001_MANUAL' }));
    expect(document.querySelector('.myio-stdmodal')).toBeNull();
  });

  it('campo vazio: mostra erro e não chama a API', async () => {
    const { fetchImpl } = mockTb();
    openManualDeviceModal({ domain: 'water', customerId: CID, token: 't', fetchImpl });
    input('identifier').value = 'X';
    btn('Criar').click();
    await flush();
    expect(document.querySelector('.myio-manualdev__error')!.textContent).toContain('Informe a etiqueta.');
    expect(input('identifier').value).toBe('X');
    expect((fetchImpl as any).mock.calls.length).toBe(0);
  });

  it('erro da API: mantém o formulário com a mensagem; MyIO vê o detalhe técnico', async () => {
    const { fetchImpl } = mockTb({ failRelation: true });
    openManualDeviceModal({ domain: 'water', customerId: CID, token: 't', fetchImpl, showTechnicalDetails: true });
    input('label').value = 'Lavoisier';
    input('identifier').value = 'STB01001';
    btn('Criar').click();
    await flush();
    await flush();
    const err = document.querySelector('.myio-manualdev__error')!;
    expect(err.textContent).toContain('Falha na API (403).');
    expect(err.querySelector('.myio-manualdev__detail')!.textContent).toContain('/api/relation');
    expect(btn('Criar').disabled).toBe(false);
  });
});

// RFC-0240: nome reservado pelo plano (mesmo nos 4 sistemas) + chaves dos outros sistemas no TB
describe('createManualDevice / resolveManualDeviceName (RFC-0240)', () => {
  it('resolveManualDeviceName: reserva o próximo nome sem criar nada', async () => {
    const { calls, fetchImpl } = mockTb({ existing: [{ name: '3F STB_LOJA_002_MANUAL' }] });
    const r = await resolveManualDeviceName({ domain: 'energy', customerId: CID, token: 't', fetchImpl });
    expect(r).toEqual({
      name: '3F STB_LOJA_003_MANUAL',
      sigla: 'STB',
      seq: 3,
      assetId: 'asset-1',
      assetName: 'ASSET_STB_DEVICES_MANUAIS',
      deviceProfile: '3F_MEDIDOR_MANUAL',
    });
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('nome fixo + extraAttributes: grava as chaves dos outros sistemas junto com profile/identifier', async () => {
    const { calls, fetchImpl } = mockTb();
    const r = await createManualDevice({
      domain: 'water',
      label: 'Quiosque',
      identifier: 'STBQ01',
      customerId: CID,
      token: 't',
      fetchImpl,
      name: 'Hidr. STB_LOJA_007_MANUAL',
      extraAttributes: { centralId: 'c-uuid', slaveId: 323, ingestionId: 'ing-1', gcdrDeviceId: 'g-1' },
    });
    expect(r.name).toBe('Hidr. STB_LOJA_007_MANUAL');
    expect(calls.some((c) => c.method === 'GET' && c.url.includes(`/api/customer/${CID}/devices`))).toBe(false);
    const attrs = calls.find((c) => c.url.includes('/attributes/SERVER_SCOPE'))!.body;
    expect(attrs).toEqual({
      centralId: 'c-uuid',
      slaveId: 323,
      ingestionId: 'ing-1',
      gcdrDeviceId: 'g-1',
      deviceProfile: 'HIDROMETRO_MANUAL',
      identifier: 'STBQ01',
    });
  });

  it('nome fixo já existente: erro claro, sem tentar outro número', async () => {
    const { calls, fetchImpl } = mockTb({ dupNames: ['3F STB_LOJA_001_MANUAL'] });
    await expect(
      createManualDevice({
        domain: 'energy',
        label: 'X',
        identifier: 'Y',
        customerId: CID,
        token: 't',
        fetchImpl,
        name: '3F STB_LOJA_001_MANUAL',
      })
    ).rejects.toThrow('Já existe um dispositivo chamado 3F STB_LOJA_001_MANUAL');
    expect(calls.filter((c) => c.method === 'POST' && c.url.endsWith('/api/device')).length).toBe(1);
  });
});

describe('openManualDeviceModal com provisioner (RFC-0240)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const flush = () => new Promise((r) => setTimeout(r, 0));
  const btn = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('.myio-stdmodal__btn')).find((b) => b.textContent === label)!;
  const input = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const body = () => document.querySelector('.myio-stdmodal__body')!;

  const PLAN: ManualProvisionPlan = {
    summary: [
      { label: 'Nome', value: '3F STB_LOJA_001_MANUAL' },
      { label: 'slaveId', value: '323' },
    ],
    steps: [
      { key: 'gcdr', system: 'GCDR', title: 'Criar device', status: 'pending' },
      { key: 'central', system: 'Central', title: 'Adicionar slave 323', status: 'pending' },
    ],
  };

  const RESULT = {
    deviceId: 'tb-1',
    name: '3F STB_LOJA_001_MANUAL',
    label: 'Burger King',
    identifier: 'STB09999',
    deviceProfile: '3F_MEDIDOR_MANUAL',
    assetId: '',
    assetName: 'ASSET_STB_DEVICES_MANUAIS',
  };

  const fill = () => {
    input('label').value = 'Burger King';
    input('identifier').value = 'STB09999';
  };

  it('Revisar mostra o plano sem gravar; Criar aplica, mostra o progresso e conclui', async () => {
    const plan = vi.fn(async () => PLAN);
    const apply = vi.fn(async (_p: ManualProvisionPlan, onStep: (s: ManualProvisionStep) => void) => {
      onStep({ key: 'gcdr', system: 'GCDR', title: 'Criar device', status: 'ok', message: 'g-1' });
      onStep({ key: 'central', system: 'Central', title: 'Adicionar slave 323', status: 'ok' });
      return { ok: true, steps: [], result: RESULT };
    });
    const onCreated = vi.fn();
    openManualDeviceModal({ domain: 'energy', customerId: CID, token: 't', provisioner: { plan, apply }, onCreated });

    fill();
    btn('Revisar').click();
    await flush();
    expect(plan).toHaveBeenCalledWith({ domain: 'energy', label: 'Burger King', identifier: 'STB09999' });
    expect(apply).not.toHaveBeenCalled();
    expect(body().textContent).toContain('Nada foi gravado ainda');
    expect(body().textContent).toContain('3F STB_LOJA_001_MANUAL');
    expect(body().textContent).toContain('Adicionar slave 323');

    btn('Criar').click();
    await flush();
    await flush();
    expect(apply).toHaveBeenCalledWith(PLAN, expect.any(Function));
    expect(body().textContent).toContain('Medidor de energia criado');
    btn('Concluir').click();
    expect(onCreated).toHaveBeenCalledWith(RESULT);
  });

  it('bloqueio no plano: Criar fica desabilitado; Voltar mantém o formulário', async () => {
    const plan = vi.fn(async () => ({ ...PLAN, blockers: ['Asset X não existe no GCDR.'] }));
    const apply = vi.fn();
    openManualDeviceModal({ domain: 'energy', customerId: CID, token: 't', provisioner: { plan, apply } });
    fill();
    btn('Revisar').click();
    await flush();
    expect(body().textContent).toContain('Asset X não existe no GCDR.');
    expect(btn('Criar').disabled).toBe(true);
    btn('Voltar').click();
    expect(input('label').value).toBe('Burger King');
  });

  it('central pendente: mostra a mensagem e os passos, com Concluir', async () => {
    const plan = vi.fn(async () => PLAN);
    const apply = vi.fn(async () => ({
      ok: true,
      message: 'Criado no GCDR, Ingestion e ThingsBoard. A central ficou pendente.',
      steps: [
        { key: 'gcdr', system: 'GCDR', title: 'Criar device', status: 'ok' as const },
        { key: 'central', system: 'Central', title: 'Adicionar slave 323', status: 'error' as const, message: 'timeout' },
      ],
      result: RESULT,
    }));
    openManualDeviceModal({ domain: 'energy', customerId: CID, token: 't', provisioner: { plan, apply } });
    fill();
    btn('Revisar').click();
    await flush();
    btn('Criar').click();
    await flush();
    await flush();
    expect(body().textContent).toContain('A central ficou pendente.');
    expect(body().textContent).toContain('timeout');
    expect(btn('Concluir')).toBeTruthy();
  });

  it('falha com rollback: mensagem de erro e botão Fechar', async () => {
    const plan = vi.fn(async () => PLAN);
    const apply = vi.fn(async () => ({
      ok: false,
      message: 'Nada foi criado: Ingestion HTTP 500',
      steps: [{ key: 'gcdr', system: 'GCDR', title: 'Criar device', status: 'rolledback' as const, message: 'desfeito' }],
    }));
    const onCreated = vi.fn();
    openManualDeviceModal({ domain: 'energy', customerId: CID, token: 't', provisioner: { plan, apply }, onCreated });
    fill();
    btn('Revisar').click();
    await flush();
    btn('Criar').click();
    await flush();
    await flush();
    expect(body().textContent).toContain('Nada foi criado: Ingestion HTTP 500');
    btn('Fechar').click();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
