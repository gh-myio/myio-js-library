/**
 * RFC-0182 / RFC-0201 Phase-2 #17 — buildItemsList helper tests.
 *
 * Covers AC-RFC-0182-2: given a mixed `STATE.itemsBase` baseline,
 * `buildItemsList(domain, group, items)` returns only the devices that
 * belong to that (domain, group) pair, with `id === ingestionId`.
 */

import { describe, it, expect } from 'vitest';
import { buildItemsList } from '../../src/utils/buildItemsList';
import type { BaseItem } from '../../src/types/BaseItem';

/**
 * Mint a `BaseItem` for the test fixtures. Keeps the noise out of test bodies.
 */
function makeItem(partial: Partial<BaseItem> & { id: string; ingestionId: string }): BaseItem {
  return {
    id: partial.id,
    entityId: partial.entityId ?? partial.id,
    name: partial.name ?? partial.id,
    label: partial.label ?? partial.name ?? partial.id,
    labelOrName: partial.labelOrName ?? partial.label ?? partial.name ?? partial.id,
    deviceType: partial.deviceType ?? '',
    deviceProfile: partial.deviceProfile ?? partial.deviceType ?? '',
    identifier: partial.identifier ?? '',
    centralName: partial.centralName ?? '',
    slaveId: partial.slaveId ?? '',
    centralId: partial.centralId ?? '',
    customerId: partial.customerId ?? '',
    ownerName: partial.ownerName ?? '',
    ingestionId: partial.ingestionId,
    consumption: partial.consumption ?? null,
    val: partial.val ?? null,
    value: partial.value ?? null,
    pulses: partial.pulses,
    temperature: partial.temperature,
    connectionStatus: partial.connectionStatus ?? 'online',
    deviceStatus: partial.deviceStatus ?? 'normal',
    domain: partial.domain ?? 'energy',
    lastActivityTime: partial.lastActivityTime,
    lastConnectTime: partial.lastConnectTime,
    gcdrDeviceId: partial.gcdrDeviceId ?? null,
  };
}

/**
 * Mixed-domain fixture covering each of the recognised groups so a single
 * dataset can drive every assertion in this file.
 */
function buildMixedItemsBase(): BaseItem[] {
  return [
    // ENERGY — lojas (3F_MEDIDOR exact match)
    makeItem({
      id: 'e1',
      ingestionId: 'ing-e1',
      label: 'Loja A',
      identifier: 'SCMAL001',
      deviceType: '3F_MEDIDOR',
      deviceProfile: '3F_MEDIDOR',
      domain: 'energy',
    }),
    makeItem({
      id: 'e2',
      ingestionId: 'ing-e2',
      label: 'Loja B',
      identifier: 'SCMAL002',
      deviceType: '3F_MEDIDOR',
      deviceProfile: '3F_MEDIDOR',
      domain: 'energy',
    }),
    // ENERGY — entrada (TRAFO)
    makeItem({
      id: 'e3',
      ingestionId: 'ing-e3',
      label: 'Trafo Principal',
      deviceType: 'TRAFO',
      deviceProfile: 'TRAFO',
      domain: 'energy',
    }),
    // ENERGY — entrada (RELOGIO)
    makeItem({
      id: 'e4',
      ingestionId: 'ing-e4',
      label: 'Relógio',
      deviceType: 'RELOGIO',
      deviceProfile: 'RELOGIO',
      domain: 'energy',
    }),
    // ENERGY — area_comum (chiller, not 3F_MEDIDOR, not entrada)
    makeItem({
      id: 'e5',
      ingestionId: 'ing-e5',
      label: 'Chiller Climatização',
      deviceType: 'CHILLER',
      deviceProfile: 'CHILLER',
      domain: 'energy',
    }),
    // WATER — entrada (HIDROMETRO_SHOPPING)
    makeItem({
      id: 'w1',
      ingestionId: 'ing-w1',
      label: 'Hidrômetro Entrada',
      deviceType: 'HIDROMETRO',
      deviceProfile: 'HIDROMETRO_SHOPPING',
      domain: 'water',
    }),
    // WATER — lojas (HIDROMETRO)
    makeItem({
      id: 'w2',
      ingestionId: 'ing-w2',
      label: 'Hidrômetro Loja',
      deviceType: 'HIDROMETRO',
      deviceProfile: 'HIDROMETRO',
      domain: 'water',
    }),
    // WATER — banheiros (area_comum + identifier=BANHEIROS)
    makeItem({
      id: 'w3',
      ingestionId: 'ing-w3',
      label: 'Hidrômetro Banheiros',
      identifier: 'BANHEIROS',
      deviceType: 'HIDROMETRO',
      deviceProfile: 'HIDROMETRO_AREA_COMUM',
      domain: 'water',
    }),
    // WATER — area_comum (other than banheiros)
    makeItem({
      id: 'w4',
      ingestionId: 'ing-w4',
      label: 'Hidrômetro Área Comum',
      identifier: 'AC-001',
      deviceType: 'HIDROMETRO',
      deviceProfile: 'HIDROMETRO_AREA_COMUM',
      domain: 'water',
    }),
    // TEMPERATURE — climatizavel
    makeItem({
      id: 't1',
      ingestionId: 'ing-t1',
      label: 'Termostato Loja',
      deviceType: 'TERMOSTATO',
      deviceProfile: 'TERMOSTATO',
      domain: 'temperature',
    }),
    // TEMPERATURE — nao_climatizavel
    makeItem({
      id: 't2',
      ingestionId: 'ing-t2',
      label: 'Termostato Externo',
      deviceType: 'TERMOSTATO',
      deviceProfile: 'TERMOSTATO_EXTERNAL',
      domain: 'temperature',
    }),
  ];
}

describe('buildItemsList — RFC-0182 (Phase-2 #17)', () => {
  describe('Energy domain', () => {
    it('returns only 3F_MEDIDOR-as-store devices for (energy, lojas)', () => {
      const items = buildItemsList('energy', 'lojas', buildMixedItemsBase());

      expect(items.map((i) => i.id).sort()).toEqual(['ing-e1', 'ing-e2']);
      expect(items[0].label).toBe('Loja A');
      expect(items[0].identifier).toBe('SCMAL001');
    });

    it('returns the same set when called with the RFC-0111 alias `stores`', () => {
      const a = buildItemsList('energy', 'lojas', buildMixedItemsBase()).map((i) => i.id);
      const b = buildItemsList('energy', 'stores', buildMixedItemsBase()).map((i) => i.id);
      expect(b.sort()).toEqual(a.sort());
    });

    it('returns TRAFO/RELOGIO devices for (energy, entrada)', () => {
      const items = buildItemsList('energy', 'entrada', buildMixedItemsBase());
      expect(items.map((i) => i.id).sort()).toEqual(['ing-e3', 'ing-e4']);
    });

    it('returns CHILLER (not 3F_MEDIDOR, not entrada) for (energy, area_comum)', () => {
      const items = buildItemsList('energy', 'area_comum', buildMixedItemsBase());
      expect(items.map((i) => i.id)).toEqual(['ing-e5']);
    });

    it('does NOT include water/temperature devices when domain=energy', () => {
      const items = buildItemsList('energy', 'todos', buildMixedItemsBase());
      const ids = items.map((i) => i.id);
      expect(ids.every((id) => id.startsWith('ing-e'))).toBe(true);
    });
  });

  describe('Water domain', () => {
    it('returns HIDROMETRO_SHOPPING devices for (water, entrada)', () => {
      const items = buildItemsList('water', 'entrada', buildMixedItemsBase());
      expect(items.map((i) => i.id)).toEqual(['ing-w1']);
    });

    it('returns HIDROMETRO devices for (water, lojas)', () => {
      const items = buildItemsList('water', 'lojas', buildMixedItemsBase());
      expect(items.map((i) => i.id)).toEqual(['ing-w2']);
    });

    it('returns AREA_COMUM + identifier BANHEIROS for (water, banheiros)', () => {
      const items = buildItemsList('water', 'banheiros', buildMixedItemsBase());
      expect(items.map((i) => i.id)).toEqual(['ing-w3']);
    });

    it('returns area-comum profile for (water, area_comum) — both banheiros and other', () => {
      const items = buildItemsList('water', 'area_comum', buildMixedItemsBase());
      // Both w3 (banheiros) and w4 share HIDROMETRO_AREA_COMUM profile.
      expect(items.map((i) => i.id).sort()).toEqual(['ing-w3', 'ing-w4']);
    });
  });

  describe('Temperature domain', () => {
    it('returns TERMOSTATO (non-external) for (temperature, climatizavel)', () => {
      const items = buildItemsList('temperature', 'climatizavel', buildMixedItemsBase());
      expect(items.map((i) => i.id)).toEqual(['ing-t1']);
    });

    it('returns TERMOSTATO_EXTERNAL for (temperature, nao_climatizavel)', () => {
      const items = buildItemsList('temperature', 'nao_climatizavel', buildMixedItemsBase());
      expect(items.map((i) => i.id)).toEqual(['ing-t2']);
    });
  });

  describe('AC-RFC-0182-2 — id === ingestionId', () => {
    it('every returned StoreItem.id matches the source device.ingestionId', () => {
      const base = buildMixedItemsBase();
      const items = buildItemsList('energy', 'todos', base);

      for (const out of items) {
        const source = base.find((b) => b.ingestionId === out.id);
        expect(source).toBeDefined();
        expect(out.id).toBe(source!.ingestionId);
      }
    });
  });

  describe('"todos" mode — section labels', () => {
    it('tags each energy item with the matching groupLabel', () => {
      const items = buildItemsList('energy', 'todos', buildMixedItemsBase());

      // ing-e1, ing-e2 → Lojas
      const lojas = items.find((i) => i.id === 'ing-e1') as { groupLabel?: string };
      expect(lojas?.groupLabel).toBe('Lojas');
      // ing-e3 → Entrada
      const entrada = items.find((i) => i.id === 'ing-e3') as { groupLabel?: string };
      expect(entrada?.groupLabel).toBe('Entrada');
      // ing-e5 → Área Comum
      const areaComum = items.find((i) => i.id === 'ing-e5') as { groupLabel?: string };
      expect(areaComum?.groupLabel).toBe('Área Comum');
    });
  });

  describe('Edge cases', () => {
    it('returns [] when itemsBase is empty', () => {
      expect(buildItemsList('energy', 'lojas', [])).toEqual([]);
    });

    it('returns [] when itemsBase is not an array', () => {
      expect(buildItemsList('energy', 'lojas', null as unknown as BaseItem[])).toEqual([]);
    });

    it('returns [] for an unknown group key', () => {
      expect(
        buildItemsList(
          'energy',
          'totally-unknown' as unknown as 'lojas',
          buildMixedItemsBase(),
        ),
      ).toEqual([]);
    });
  });
});
