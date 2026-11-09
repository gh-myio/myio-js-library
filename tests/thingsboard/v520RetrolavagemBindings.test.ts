/**
 * Shopping v-5.2.0 — retrolavagemBindings: o MAIN_VIEW (que soma) e a aba de configuração (que
 * edita) têm que ler a mesma quantidade de vínculos. Se divergirem, a aba apaga sem aviso, ao
 * salvar, hidrômetros que o painel ainda soma.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_RETROLAVAGEM_DEVICES_PER_SIDE,
  RETROLAVAGEM_LEGACY_MAX_PER_SIDE,
  normalizeRetrolavagemBindings,
} from '../../src/components/premium-modals/settings/retrolavagem/RetrolavagemTab';
import { extractFunction, readControllerSource } from './helpers/extractControllerFunction';

const MAIN_SRC = readControllerSource('MAIN_VIEW');
const controllerCap = Number(/const RETROLAVAGEM_LEGACY_MAX_PER_SIDE = (\d+)/.exec(MAIN_SRC)?.[1]);

// eslint-disable-next-line no-new-func
const parse: (raw: unknown) => { inputs: unknown[]; outputs: unknown[] } | null = new Function(
  'LogHelper',
  'RETROLAVAGEM_LEGACY_MAX_PER_SIDE',
  `${extractFunction(MAIN_SRC, '_parseRetrolavagemBindings')}\nreturn _parseRetrolavagemBindings;`
)({ warn: () => {} }, controllerCap);

const refs = (n: number) => Array.from({ length: n }, (_, i) => ({ tbId: `d${i}`, label: `D${i}` }));

describe('retrolavagemBindings — painel × aba', () => {
  it('o teto de leitura é o mesmo nos dois e o limite de edição é menor', () => {
    expect(controllerCap).toBe(RETROLAVAGEM_LEGACY_MAX_PER_SIDE);
    expect(MAX_RETROLAVAGEM_DEVICES_PER_SIDE).toBeLessThan(RETROLAVAGEM_LEGACY_MAX_PER_SIDE);
  });

  it('vínculo legado com 7 de um lado: painel e aba leem os 7', () => {
    const saved = { inputs: refs(7), outputs: [] };
    expect(parse(saved)!.inputs).toHaveLength(7);
    expect(normalizeRetrolavagemBindings(saved).inputs).toHaveLength(7);
  });

  it('acima do teto, painel e aba cortam no mesmo ponto', () => {
    const saved = { inputs: refs(12), outputs: [] };
    expect(parse(saved)!.inputs).toHaveLength(RETROLAVAGEM_LEGACY_MAX_PER_SIDE);
    expect(normalizeRetrolavagemBindings(saved).inputs).toHaveLength(RETROLAVAGEM_LEGACY_MAX_PER_SIDE);
  });

  it('sem vínculos válidos → null (conta automática)', () => {
    expect(parse(null)).toBeNull();
    expect(parse({ inputs: [], outputs: [{ label: 'sem id' }] })).toBeNull();
  });
});
