import { describe, expect, it, vi } from 'vitest';
import {
  findCommercialTwins,
  isCommercialProfile,
  mergeTwinCommercial,
  pickCommercial,
  twinProfileOf,
} from '../../../../src/components/premium-modals/settings/commercialTwin';

describe('commercialTwin — perfis de loja', () => {
  it('só 3F_MEDIDOR e HIDROMETRO têm dados de cadastro', () => {
    expect(isCommercialProfile('3F_MEDIDOR')).toBe(true);
    expect(isCommercialProfile(' hidrometro ')).toBe(true);
    for (const p of ['ELEVADOR', 'HIDROMETRO_AREA_COMUM', '3F_MEDIDOR_MANUAL', 'TERMOSTATO', '', null, undefined]) {
      expect(isCommercialProfile(p)).toBe(false);
    }
  });

  it('gêmeo: energia ↔ água', () => {
    expect(twinProfileOf('3F_MEDIDOR')).toBe('HIDROMETRO');
    expect(twinProfileOf('HIDROMETRO')).toBe('3F_MEDIDOR');
    expect(twinProfileOf('ELEVADOR')).toBeNull();
  });
});

describe('commercialTwin — herança ao abrir', () => {
  const energy = { abl: '120 m²', contract: 'C-1', segment: 'Lojas Satélites', activity: 'Moda' };

  it('hidrômetro herda os valores do medidor de energia (prevalecem sobre os próprios)', () => {
    const own = { identifier: 'L101', abl: 'antigo', contract: '' };
    expect(mergeTwinCommercial(own, energy, 'HIDROMETRO')).toEqual({ identifier: 'L101', ...energy });
  });

  it('medidor de energia mantém os próprios e só completa os vazios', () => {
    const own = { abl: '200 m²', contract: '' };
    const water = { abl: 'x', contract: 'C-9', segment: 'Megalojas' };
    expect(mergeTwinCommercial(own, water, '3F_MEDIDOR')).toEqual({ abl: '200 m²', contract: 'C-9', segment: 'Megalojas' });
  });

  it('gêmeo sem valores não apaga nada', () => {
    const own = { abl: '50' };
    expect(mergeTwinCommercial(own, {}, 'HIDROMETRO')).toEqual({ abl: '50' });
    expect(mergeTwinCommercial(own, undefined, 'HIDROMETRO')).toBe(own);
  });

  it('pickCommercial: só os 4 campos preenchidos', () => {
    expect(pickCommercial({ label: 'x', abl: ' 10 ', contract: '', segment: 'S', floor: '1' })).toEqual({ abl: '10', segment: 'S' });
  });
});

describe('commercialTwin — findCommercialTwins', () => {
  const row = (id: string, identifier: string, extra: Record<string, string> = {}) => ({
    entityId: { id },
    latest: {
      ENTITY_FIELD: { name: { value: `dev-${id}` }, label: { value: `Label ${id}` } },
      SERVER_ATTRIBUTE: Object.fromEntries(
        Object.entries({ identifier, ...extra }).map(([k, v]) => [k, { value: v }])
      ),
    },
  });

  function mockFetch(rows: any[], customers: Record<string, string>) {
    return vi.fn(async (url: string, init?: any) => {
      if (url.endsWith('/api/entitiesQuery/find')) {
        const body = JSON.parse(init.body);
        expect(body.entityFilter.deviceTypes).toEqual(['3F_MEDIDOR']);
        expect(body.keyFilters[0].predicate.value.defaultValue).toBe('L101');
        return { ok: true, json: async () => ({ data: rows }) } as any;
      }
      const id = url.split('/api/device/')[1];
      return { ok: true, json: async () => ({ customerId: { id: customers[id] } }) } as any;
    });
  }

  it('acha o medidor de energia do mesmo customer e descarta outro shopping e o próprio device', async () => {
    const fetchImpl = mockFetch(
      [row('e1', 'L101', { abl: '120', contract: 'C-1' }), row('e2', 'L101'), row('self', 'L101')],
      { e1: 'cust-A', e2: 'cust-B', self: 'cust-A' }
    );
    const twins = await findCommercialTwins({
      tbBaseUrl: 'https://tb',
      jwtToken: 'jwt',
      customerId: 'cust-A',
      deviceId: 'self',
      deviceProfile: 'HIDROMETRO',
      identifier: ' L101 ',
      fetchImpl: fetchImpl as any,
    });
    expect(twins).toEqual([{ id: 'e1', name: 'dev-e1', label: 'Label e1', attrs: { abl: '120', contract: 'C-1' } }]);
  });

  it('sem customerId, sem identifier ou profile fora de loja → não busca', async () => {
    const fetchImpl = vi.fn();
    const base = { tbBaseUrl: 'https://tb', jwtToken: 'jwt', deviceId: 'd', fetchImpl: fetchImpl as any };
    expect(await findCommercialTwins({ ...base, customerId: null, deviceProfile: 'HIDROMETRO', identifier: 'L1' })).toEqual([]);
    expect(await findCommercialTwins({ ...base, customerId: 'c', deviceProfile: 'HIDROMETRO', identifier: '' })).toEqual([]);
    expect(await findCommercialTwins({ ...base, customerId: 'c', deviceProfile: 'ELEVADOR', identifier: 'L1' })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
