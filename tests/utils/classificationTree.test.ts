import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseClassificationEntities } from '../../src/utils/devices/classificationTree';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(
  __dirname,
  '../../src/thingsboard/main-dashboard-shopping/v-5.4.0/responseEntity.json'
);
const response = JSON.parse(readFileSync(FIXTURE, 'utf8'));

describe('parseClassificationEntities (GCDR RFC-0047 tree adapter)', () => {
  const tree = parseClassificationEntities(response);

  it('derives domains from the data (agnostic — no hard-coded list)', () => {
    expect(tree.domains.map((d) => d.code)).toEqual(['energy', 'water', 'temperature']);
    expect(tree.domains.map((d) => d.label)).toEqual(['Energia', 'Água', 'Temperatura']);
  });

  it('derives columns (level-1 groups) per domain, in sort order', () => {
    const energy = tree.domains.find((d) => d.code === 'energy')!;
    expect(energy.columns.map((c) => c.key)).toEqual([
      'energy-entry',
      'energy-commonarea',
      'energy-stores',
    ]);
    expect(energy.columns.map((c) => c.label)).toEqual([
      'Entrada de Energia',
      'Área Comum',
      'Lojas',
    ]);
  });

  it('collects deviceProfiles deep (incl. sub-groups like Climatização)', () => {
    const energy = tree.domains.find((d) => d.code === 'energy')!;
    const commonArea = energy.columns.find((c) => c.key === 'energy-commonarea')!;
    // CHILLER/FANCOIL/BOMBA (climatizacao) + ELEVADOR + ESCADA_ROLANTE + MOTOR/BOMBA_HIDRAULICA/BOMBA_INCENDIO
    expect(commonArea.profiles).toEqual(
      expect.arrayContaining(['CHILLER', 'FANCOIL', 'BOMBA', 'ELEVADOR', 'ESCADA_ROLANTE', 'MOTOR'])
    );
  });

  it('builds a deviceProfile → {domain, column} index for O(1) routing', () => {
    expect(tree.profileIndex['CHILLER']).toEqual({ domain: 'energy', column: 'energy-commonarea' });
    expect(tree.profileIndex['3F_MEDIDOR']).toEqual({ domain: 'energy', column: 'energy-stores' });
    expect(tree.profileIndex['HIDROMETRO']).toEqual({ domain: 'water', column: 'water-stores' });
    expect(tree.profileIndex['HIDROMETRO_ENTRADA']).toEqual({
      domain: 'water',
      column: 'water-entry',
    });
  });

  it('accepts the items array directly too', () => {
    const fromItems = parseClassificationEntities(response.data.items);
    expect(fromItems.domains.map((d) => d.code)).toEqual(['energy', 'water', 'temperature']);
  });

  it('is agnostic: works for arbitrary domains (gas/oxygen) it has never seen', () => {
    const custom = parseClassificationEntities([
      {
        entityType: 'GROUP',
        entityKey: 'gas',
        entityValue: 'Gás',
        sortOrder: 10,
        children: [
          {
            entityType: 'GROUP',
            entityKey: 'gas-main',
            entityValue: 'Entrada de Gás',
            sortOrder: 10,
            children: [{ entityType: 'PROFILE', entityKey: 'MEDIDOR_GAS', entityValue: 'Medidor', sortOrder: 10 }],
          },
        ],
      },
    ]);
    expect(custom.domains.map((d) => d.code)).toEqual(['gas']);
    expect(custom.profileIndex['MEDIDOR_GAS']).toEqual({ domain: 'gas', column: 'gas-main' });
  });
});
