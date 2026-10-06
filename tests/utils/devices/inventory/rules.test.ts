import { describe, it, expect } from 'vitest';
import { buildRuleContext, evaluateDevice, INVENTORY_RULES } from '../../../../src/utils/devices/inventory/rules';
import { resolveLifecycle } from '../../../../src/utils/devices/inventory/lifecycle';
import type { InventoryDevice } from '../../../../src/utils/devices/inventory/types';
import { HOUR, NOW, makeDevice } from './fixtures';

function evaluate(device: InventoryDevice, others: InventoryDevice[] = [], opts = {}) {
  const ctx = buildRuleContext([device, ...others], { now: NOW, ...opts });
  return evaluateDevice(device, ctx);
}
const outcome = (ev: ReturnType<typeof evaluate>, id: string) => ev.results.find((r) => r.id === id)?.outcome;

describe('RFC-0237 rules — healthy device', () => {
  it('passes every applicable rule and is Íntegro / Reportando', () => {
    const ev = evaluate(makeDevice());
    expect(ev.failed).toEqual([]);
    expect(ev.cadastro).toEqual({ level: 'ok', partial: false });
    expect(ev.atividade).toEqual({ level: 'ok', partial: false });
    expect(outcome(ev, 'C6')).toBe('notApplicable'); // disabled by default
  });

  it('every rule has a pt-BR label and a unique id', () => {
    const ids = INVENTORY_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(INVENTORY_RULES.every((r) => r.label && r.description)).toBe(true);
  });
});

describe('RFC-0237 rules — Cadastro', () => {
  it('C1 fails for tenant-owned devices (pending) and is unknown without owner type', () => {
    const ev = evaluate(makeDevice({ ownerType: 'TENANT', ownerName: 'MYIO' }));
    expect(outcome(ev, 'C1')).toBe('fail');
    expect(ev.cadastro.level).toBe('pending');
    expect(outcome(evaluate(makeDevice({ ownerType: null })), 'C1')).toBe('unknown');
  });

  it('C2/C3/C4 only apply to integrated customers', () => {
    const notIntegrated = makeDevice({ ownerName: 'Obramax Mesquita', ingestionId: null, gcdrDeviceId: null, deviceProfile: null });
    const ev = evaluate(notIntegrated);
    expect(['C2', 'C3', 'C4', 'C5', 'C7', 'C8'].map((id) => outcome(ev, id))).toEqual([
      'notApplicable', 'notApplicable', 'notApplicable', 'notApplicable', 'notApplicable', 'notApplicable',
    ]);
    expect(ev.cadastro.level).toBe('ok');
  });

  it('C3 missing ingestionId on an integrated customer is critical', () => {
    const sibling = makeDevice({ id: 'dev-2', ingestionId: 'ing-2', gcdrDeviceId: 'gcdr-2' });
    const ev = evaluate(makeDevice({ ingestionId: null }), [sibling]);
    expect(outcome(ev, 'C3')).toBe('fail');
    expect(ev.cadastro.level).toBe('critical');
  });

  it('C4 missing gcdrDeviceId alone is pending', () => {
    const ev = evaluate(makeDevice({ gcdrDeviceId: null }));
    expect(ev.failed).toEqual(['C4']);
    expect(ev.cadastro.level).toBe('pending');
  });

  it('integration overrides switch the gate on and off', () => {
    const d = makeDevice({ ownerName: 'Novo Cliente', ingestionId: null, gcdrDeviceId: null });
    expect(outcome(evaluate(d, [], { integrationOverrides: { 'Novo Cliente': true } }), 'C3')).toBe('fail');
    expect(outcome(evaluate(makeDevice({ gcdrDeviceId: null }), [], { integrationOverrides: { 'Shopping da Ilha': false } }), 'C4')).toBe('notApplicable');
  });

  it('C5 fails for unrecognized profiles and does not apply when the profile is blank', () => {
    expect(outcome(evaluate(makeDevice({ deviceProfile: 'Park Lagos CAG' })), 'C5')).toBe('fail');
    expect(outcome(evaluate(makeDevice({ deviceProfile: 'chiller' })), 'C5')).toBe('pass');
    expect(outcome(evaluate(makeDevice({ deviceProfile: null })), 'C5')).toBe('notApplicable');
  });

  it('C6 is info: when enabled it fails without changing the Cadastro badge', () => {
    const ev = evaluate(makeDevice({ type: 'default' }), [], { disabledRules: [] });
    expect(outcome(ev, 'C6')).toBe('fail');
    expect(ev.failed).toEqual(['C6']);
    expect(ev.cadastro.level).toBe('ok');
  });

  it('C7 applies to central-attached domains only', () => {
    expect(outcome(evaluate(makeDevice({ centralId: null })), 'C7')).toBe('fail'); // CHILLER → energy
    expect(outcome(evaluate(makeDevice({ deviceProfile: 'TERMOSTATO', type: 'TERMOSTATO', centralId: null })), 'C7')).toBe('notApplicable');
    expect(outcome(evaluate(makeDevice({ deviceProfile: 'TERMOSTATO', centralId: null }), [], { centralDomains: ['temperature'] }), 'C7')).toBe('fail');
  });

  it('C8 flags duplicate ingestionId / gcdrDeviceId, ignoring archived devices', () => {
    const dup = makeDevice({ id: 'dev-2', gcdrDeviceId: 'gcdr-2' }); // same ingestionId 'ing-1'
    expect(outcome(evaluate(makeDevice(), [dup]), 'C8')).toBe('fail');
    const archivedDup = makeDevice({ id: 'dev-3', gcdrDeviceId: 'gcdr-3', lifecycleStatus: 'archived' });
    expect(outcome(evaluate(makeDevice(), [archivedDup]), 'C8')).toBe('pass');
  });

  it('a failed attribute page makes the attribute rules unknown → Parcial', () => {
    const ev = evaluate(makeDevice({ attributesLoaded: false }));
    expect(['C2', 'C3', 'C4', 'C5', 'C7', 'C8'].every((id) => outcome(ev, id) === 'unknown')).toBe(true);
    expect(ev.cadastro).toEqual({ level: 'partial', partial: false });
  });

  it('a known failure plus an unknown keeps the failure level with partial = true', () => {
    const ev = evaluate(makeDevice({ ownerType: 'TENANT', attributesLoaded: false }));
    expect(ev.cadastro).toEqual({ level: 'pending', partial: true });
  });
});

describe('RFC-0237 rules — Atividade', () => {
  it('A1 parses the TB active flag; missing is unknown', () => {
    expect(evaluate(makeDevice({ active: false })).atividade.level).toBe('inactive');
    expect(evaluate(makeDevice({ active: null })).atividade.level).toBe('nodata');
  });

  it('A2 uses the injected now and staleHours', () => {
    const d = makeDevice({ lastActivityTime: NOW - 25 * HOUR });
    expect(evaluate(d).atividade.level).toBe('inactive');
    expect(evaluate(d, [], { staleHours: 48 }).atividade.level).toBe('ok');
  });

  it('missing lastActivityTime is unknown ("Sem dado"), not "never reported"', () => {
    const ev = evaluate(makeDevice({ lastActivityTime: null }));
    expect(ev.results.find((r) => r.id === 'A2')?.outcome).toBe('unknown');
    expect(ev.atividade.level).toBe('nodata');
  });

  it('A1 and A2 can fail together (overlapping counts)', () => {
    const ev = evaluate(makeDevice({ active: false, lastActivityTime: NOW - 72 * HOUR }));
    expect(ev.failed).toEqual(['A1', 'A2']);
  });
});

describe('RFC-0237 lifecycle', () => {
  it('stock / archived devices are excluded from both axes', () => {
    for (const status of ['stock', 'archived']) {
      const ev = evaluate(makeDevice({ lifecycleStatus: status, ingestionId: null, active: false }));
      expect(ev.cadastro.level).toBe('excluded');
      expect(ev.atividade.level).toBe('excluded');
      expect(ev.failed).toEqual([]);
      expect(ev.results.every((r) => r.outcome === 'notApplicable')).toBe(true);
    }
  });

  it('legacy encodings are hints only', () => {
    expect(resolveLifecycle(makeDevice({ deviceProfile: '3F_MEDIDOR_ARQUIVADO_OFFLINE' }))).toEqual({
      status: 'active',
      source: 'default',
      legacyHint: 'deviceProfile',
    });
    expect(resolveLifecycle(makeDevice({ ownerName: 'Campinas DESATIVAR' })).legacyHint).toBe('customerName');
    expect(resolveLifecycle(makeDevice({ lifecycleStatus: 'Archived' }))).toEqual({
      status: 'archived',
      source: 'attribute',
      legacyHint: null,
    });
    expect(resolveLifecycle(makeDevice({ lifecycleStatus: 'whatever' })).source).toBe('default');
  });
});
