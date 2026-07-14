/**
 * RFC-0111 (endurecido 2026-07-14): deviceProfile é a ÚNICA autoridade de
 * classificação — deviceType só quando não há profile; name/label nunca.
 * Casos de regressão vindos da auditoria HO Soul Malls × dashboards próprios
 * (Praia da Costa, West Plaza, Ilha Plaza, Plaza Macaé) de 2026-07-14.
 */
import { describe, it, expect } from 'vitest';
import { detectContext, detectDomainAndContext } from '../../../src/utils/devices/deviceInfo.js';

describe('detectContext / detectDomainAndContext — deviceProfile é a autoridade', () => {
  it('Subestação com profile=MOTOR NÃO é entrada (deviceType/name ignorados)', () => {
    // "3F SUBESTACAO Condominio" (Praia da Costa): deviceType sugeria SUBESTACAO,
    // mas o profile é MOTOR — jamais entrada.
    const d = { deviceType: 'SUBESTACAO', deviceProfile: 'MOTOR' };
    expect(detectDomainAndContext(d)).toEqual({ domain: 'energy', context: 'motor' });
  });

  it('profile SUBESTACAO (de verdade) continua entrada', () => {
    const d = { deviceType: '3F_MEDIDOR', deviceProfile: 'SUBESTACAO' };
    expect(detectContext(d, 'energy')).toBe('entrada');
  });

  it('BOMBA_CAG é Climatização → equipments, não grupo bomba (CAG BLOCO A/B/C West Plaza)', () => {
    const d = { deviceType: 'BOMBA_CAG', deviceProfile: 'BOMBA_CAG' };
    expect(detectDomainAndContext(d)).toEqual({ domain: 'energy', context: 'equipments' });
  });

  it('BOMBA (BAS, não-CAG) continua no grupo bomba; MOTOR no grupo motor', () => {
    expect(detectContext({ deviceProfile: 'BOMBA_HIDRAULICA' }, 'energy')).toBe('bomba');
    expect(detectContext({ deviceProfile: 'MOTOR' }, 'energy')).toBe('motor');
  });

  it('hidrômetro com deviceType=MOTOR errado é ÁGUA (HIDR. RECALQUE_TORRE, Ilha Plaza)', () => {
    const d = { deviceType: 'MOTOR', deviceProfile: 'HIDROMETRO' };
    expect(detectDomainAndContext(d)).toEqual({ domain: 'water', context: 'hidrometro' });
  });

  it('loja 3F com deviceType=ELEVADOR errado é STORE (3F SPMPTELEV1 / FUN PHOTO, Macaé)', () => {
    const d = { deviceType: 'ELEVADOR', deviceProfile: '3F_MEDIDOR' };
    expect(detectDomainAndContext(d)).toEqual({ domain: 'energy', context: 'stores' });
  });

  it('perfis 3F_MEDIDOR variantes (arquivado) continuam stores', () => {
    const d = { deviceType: 'QUALQUER', deviceProfile: '3F_MEDIDOR_ARQUIVADO_INSTALADO_SEM_DADOS' };
    expect(detectContext(d, 'energy')).toBe('stores');
  });

  it('água: HIDROMETRO_AREA_COMUM + identifier BANHEIROS → banheiros; sem identifier → área comum', () => {
    expect(
      detectContext({ deviceProfile: 'HIDROMETRO_AREA_COMUM', identifier: 'BANHEIROS' }, 'water')
    ).toBe('banheiros');
    expect(detectContext({ deviceProfile: 'HIDROMETRO_AREA_COMUM' }, 'water')).toBe(
      'hidrometro_area_comum'
    );
  });

  it('água: HIDROMETRO_SHOPPING → hidrometro_entrada, mesmo com deviceType errado', () => {
    const d = { deviceType: 'MOTOR', deviceProfile: 'HIDROMETRO_SHOPPING' };
    expect(detectDomainAndContext(d)).toEqual({ domain: 'water', context: 'hidrometro_entrada' });
  });

  it('temperatura: TERMOSTATO_EXTERNAL como PROFILE resolve domínio e contexto', () => {
    const d = { deviceType: '', deviceProfile: 'TERMOSTATO_EXTERNAL' };
    expect(detectDomainAndContext(d)).toEqual({
      domain: 'temperature',
      context: 'termostato_external',
    });
  });

  it('fallback: sem deviceProfile, deviceType ainda classifica (último recurso)', () => {
    expect(detectDomainAndContext({ deviceType: 'HIDROMETRO', deviceProfile: '' })).toEqual({
      domain: 'water',
      context: 'hidrometro',
    });
    expect(detectDomainAndContext({ deviceType: '3F_MEDIDOR' })).toEqual({
      domain: 'energy',
      context: 'stores',
    });
  });
});
