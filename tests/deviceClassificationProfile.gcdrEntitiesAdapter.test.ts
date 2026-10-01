// tests/deviceClassificationProfile.gcdrEntitiesAdapter.test.ts
//
// RFC-0234 v2 — GCDR `GROUP`/`PROFILE` entities <-> `DeviceClassificationProfile`
// adapter. The fixture below is a trimmed, verbatim copy of the real
// `GET /entities/resolve?customerId=e04046d4-baa4-44e9-a378-4dfebe4140f1&deep=all`
// response captured live against https://gcdr-api.a.myio-bas.com on 2026-09-18
// (customer "Mestre Álvaro", energy root only — water/temperature roots
// dropped from the fixture since the adapter deliberately ignores them).

import { describe, it, expect } from 'vitest';
import {
  parseGcdrEntityForest,
  parseGcdrEnergyRoot,
  buildGcdrEnergyRoot,
  validateProfile,
  resolveGroup,
  resolveCategory,
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  type GcdrEntityNode,
  type DeviceClassificationProfile,
} from '../src/utils/devices/deviceClassificationProfile';

const LIVE_ENERGY_ROOT: GcdrEntityNode = {
  entityType: 'GROUP',
  entityKey: 'energy',
  entityValue: 'Energia',
  children: [
    {
      entityType: 'GROUP',
      entityKey: 'energy-transformers',
      entityValue: 'Transformadores',
      children: [
        { entityType: 'PROFILE', entityKey: 'TRANSFORMADOR', entityValue: 'TRANSFORMADOR', children: [] },
      ],
    },
    {
      entityType: 'GROUP',
      entityKey: 'energy-entry',
      entityValue: 'Entrada de Energia',
      children: [
        { entityType: 'PROFILE', entityKey: 'ENTRADA', entityValue: 'Entrada', children: [] },
        { entityType: 'PROFILE', entityKey: 'RELOGIO', entityValue: 'Relógio', children: [] },
        { entityType: 'PROFILE', entityKey: 'SUBESTACAO', entityValue: 'Subestação', children: [] },
        { entityType: 'PROFILE', entityKey: 'TRAFO_ENTRADA', entityValue: 'Trafo de Entrada', children: [] },
      ],
    },
    {
      entityType: 'GROUP',
      entityKey: 'energy-commonarea',
      entityValue: 'Área Comum',
      children: [
        {
          entityType: 'GROUP',
          entityKey: 'climatizacao',
          entityValue: 'Climatização',
          children: [
            { entityType: 'PROFILE', entityKey: 'CHILLER', entityValue: 'Chiller', children: [] },
            { entityType: 'PROFILE', entityKey: 'FANCOIL', entityValue: 'Fancoil', children: [] },
            { entityType: 'PROFILE', entityKey: 'BOMBA_CAG', entityValue: 'Bomba', children: [] },
          ],
        },
        {
          entityType: 'GROUP',
          entityKey: 'elevadores',
          entityValue: 'Elevadores',
          children: [{ entityType: 'PROFILE', entityKey: 'ELEVADOR', entityValue: 'Elevador', children: [] }],
        },
        {
          entityType: 'GROUP',
          entityKey: 'escada-rolante',
          entityValue: 'Escada Rolante',
          children: [
            { entityType: 'PROFILE', entityKey: 'ESCADA_ROLANTE', entityValue: 'Escada Rolante', children: [] },
          ],
        },
        {
          entityType: 'GROUP',
          entityKey: 'outros-equipamentos',
          entityValue: 'Outros Equipamentos',
          children: [
            { entityType: 'PROFILE', entityKey: 'MOTOR', entityValue: 'Motor', children: [] },
            { entityType: 'PROFILE', entityKey: 'BOMBA_HIDRAULICA', entityValue: 'Bomba Hidráulica', children: [] },
            { entityType: 'PROFILE', entityKey: 'BOMBA_INCENDIO', entityValue: 'Bomba de Incêndio', children: [] },
          ],
        },
      ],
    },
    {
      entityType: 'GROUP',
      entityKey: 'energy-stores',
      entityValue: 'Lojas',
      children: [{ entityType: 'PROFILE', entityKey: '3F_MEDIDOR', entityValue: 'Medidor 3F', children: [] }],
    },
  ],
};

describe('RFC-0234 v2 — GCDR entities adapter', () => {
  describe('parseGcdrEnergyRoot / parseGcdrEntityForest', () => {
    it('produces a groups.rules[] entry per leaf GROUP, with the residual group flagged as fallback', () => {
      const dom = parseGcdrEnergyRoot(LIVE_ENERGY_ROOT);
      const byName = Object.fromEntries(dom.groups.rules.map((r) => [r.name, r]));

      expect(byName.transformadores?.deviceProfiles).toEqual(['TRANSFORMADOR']);
      expect(byName.entrada?.deviceProfiles).toEqual([
        'ENTRADA',
        'RELOGIO',
        'SUBESTACAO',
        'TRAFO_ENTRADA',
      ]);
      expect(byName.lojas?.deviceProfiles).toEqual(['3F_MEDIDOR']);
      expect(byName.areacomum?.fallback).toBe(true);
      expect(byName.areacomum?.deviceProfiles).toEqual([]);

      const fallbacks = dom.groups.rules.filter((r) => r.fallback);
      expect(fallbacks).toHaveLength(1);
    });

    it('derives categories.rules[] from the residual group\'s nested GROUPs, skipping the implicit "outros" bucket', () => {
      const dom = parseGcdrEnergyRoot(LIVE_ENERGY_ROOT);
      const catNames = dom.categories?.rules.map((r) => r.name).sort();
      expect(catNames).toEqual(['climatizacao', 'elevadores', 'escadas_rolantes']);
      expect(dom.categories?.fallback).toEqual({ name: 'outros' });

      const climat = dom.categories?.rules.find((r) => r.name === 'climatizacao');
      expect(climat?.deviceProfiles).toEqual(['CHILLER', 'FANCOIL', 'BOMBA_CAG']);
    });

    it('derives storeDeviceProfile from the lojas group\'s single PROFILE child', () => {
      const dom = parseGcdrEnergyRoot(LIVE_ENERGY_ROOT);
      expect(dom.categories?.storeDeviceProfile).toBe('3F_MEDIDOR');
    });

    it('a GCDR group with no entry in the legacy name table still becomes a real, matchable rule', () => {
      const root: GcdrEntityNode = {
        entityType: 'GROUP',
        entityKey: 'energy',
        children: [
          {
            entityType: 'GROUP',
            entityKey: 'energy-elevadores-only',
            children: [{ entityType: 'PROFILE', entityKey: 'ELEVADOR_ISOLADO', children: [] }],
          },
          { entityType: 'GROUP', entityKey: 'energy-commonarea', children: [] },
        ],
      };
      const dom = parseGcdrEnergyRoot(root);
      const rule = dom.groups.rules.find((r) => r.name === 'elevadores-only');
      expect(rule?.deviceProfiles).toEqual(['ELEVADOR_ISOLADO']);
      expect(resolveGroup({ deviceProfile: 'ELEVADOR_ISOLADO' }, wrapEnergy(dom)).group).toBe(
        'elevadores-only',
      );
    });

    it('parseGcdrEntityForest only populates domains.energy (water/temperature intentionally out of scope)', () => {
      const domains = parseGcdrEntityForest([LIVE_ENERGY_ROOT]);
      expect(Object.keys(domains)).toEqual(['energy']);
    });

    it('returns {} when no energy GROUP root is present', () => {
      expect(parseGcdrEntityForest([])).toEqual({});
      expect(parseGcdrEntityForest(null)).toEqual({});
    });
  });

  describe('the parsed domain resolves devices exactly like the live tree implies', () => {
    const dom = parseGcdrEnergyRoot(LIVE_ENERGY_ROOT);
    const profile = wrapEnergy(dom);

    it('a TRANSFORMADOR device resolves to the transformadores group, never entrada/areacomum', () => {
      expect(resolveGroup({ deviceProfile: 'TRANSFORMADOR' }, profile).group).toBe('transformadores');
    });

    it('an ENTRADA device stays in entrada; grandTotal-affecting groups stay disjoint', () => {
      expect(resolveGroup({ deviceProfile: 'ENTRADA' }, profile).group).toBe('entrada');
      expect(resolveGroup({ deviceProfile: '3F_MEDIDOR' }, profile).group).toBe('lojas');
    });

    it('a CHILLER resolves to areacomum (group) + climatizacao (category)', () => {
      expect(resolveGroup({ deviceProfile: 'CHILLER' }, profile).group).toBe('areacomum');
      expect(resolveCategory({ deviceProfile: 'CHILLER' }, profile).category).toBe('climatizacao');
    });

    it('an unmatched profile falls into areacomum / outros', () => {
      expect(resolveGroup({ deviceProfile: 'WHATEVER' }, profile).group).toBe('areacomum');
      expect(resolveCategory({ deviceProfile: 'WHATEVER' }, profile).category).toBe('outros');
    });

    it('validateProfile accepts the GCDR-derived domain merged into a full profile', () => {
      expect(validateProfile(profile)).toEqual([]);
    });
  });

  describe('buildGcdrEnergyRoot — reverse direction (save path)', () => {
    it('round-trips the live fixture: parse -> build -> parse again yields the same DomainProfile', () => {
      const parsed = parseGcdrEnergyRoot(LIVE_ENERGY_ROOT);
      const rebuiltRoot = buildGcdrEnergyRoot(parsed, LIVE_ENERGY_ROOT);
      const reparsed = parseGcdrEnergyRoot(rebuiltRoot);
      expect(reparsed).toEqual(parsed);
    });

    it('preserves original entityKey/entityValue for unchanged known groups (no cosmetic churn on save)', () => {
      const parsed = parseGcdrEnergyRoot(LIVE_ENERGY_ROOT);
      const rebuiltRoot = buildGcdrEnergyRoot(parsed, LIVE_ENERGY_ROOT);
      const transformadores = rebuiltRoot.children.find((c) => c.entityKey === 'energy-transformers');
      expect(transformadores?.entityValue).toBe('Transformadores');
    });

    it('an edited chip list (added deviceProfile) reflects in the rebuilt tree under the same entityKey', () => {
      const parsed = parseGcdrEnergyRoot(LIVE_ENERGY_ROOT);
      const edited = {
        ...parsed,
        groups: {
          ...parsed.groups,
          rules: parsed.groups.rules.map((r) =>
            r.name === 'transformadores' ? { ...r, deviceProfiles: [...r.deviceProfiles, 'TRANSFORMADOR_NOVO'] } : r,
          ),
        },
      };
      const rebuiltRoot = buildGcdrEnergyRoot(edited, LIVE_ENERGY_ROOT);
      const transformadores = rebuiltRoot.children.find((c) => c.entityKey === 'energy-transformers');
      expect(transformadores?.children.map((c) => c.entityKey)).toEqual([
        'TRANSFORMADOR',
        'TRANSFORMADOR_NOVO',
      ]);
    });

    it('a brand-new group (no previousRoot match) gets a derived entityKey that round-trips', () => {
      const parsed = parseGcdrEnergyRoot(LIVE_ENERGY_ROOT);
      const withNewGroup = {
        ...parsed,
        groups: {
          ...parsed.groups,
          rules: [
            ...parsed.groups.rules.filter((r) => !r.fallback),
            { name: 'geradores', deviceProfiles: ['GERADOR'] },
            ...parsed.groups.rules.filter((r) => r.fallback),
          ],
        },
      };
      const rebuiltRoot = buildGcdrEnergyRoot(withNewGroup, LIVE_ENERGY_ROOT);
      const geradores = rebuiltRoot.children.find((c) => c.entityValue === 'Geradores' || c.entityKey === 'energy-geradores');
      expect(geradores?.entityKey).toBe('energy-geradores');
      const reparsed = parseGcdrEnergyRoot(rebuiltRoot);
      expect(reparsed.groups.rules.find((r) => r.name === 'geradores')?.deviceProfiles).toEqual(['GERADOR']);
    });

    it('works with no previousRoot at all (first-ever save for a customer with an empty clone)', () => {
      const parsed = parseGcdrEnergyRoot(LIVE_ENERGY_ROOT);
      const rebuiltRoot = buildGcdrEnergyRoot(parsed);
      expect(rebuiltRoot.entityKey).toBe('energy');
      const reparsed = parseGcdrEnergyRoot(rebuiltRoot);
      expect(reparsed).toEqual(parsed);
    });
  });
});

function wrapEnergy(energy: ReturnType<typeof parseGcdrEnergyRoot>): DeviceClassificationProfile {
  return {
    schemaVersion: 1,
    domains: {
      energy,
      water: DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.water,
      temperature: DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.temperature,
    },
  };
}
