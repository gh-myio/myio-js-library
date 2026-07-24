/**
 * RFC-0207 "parent" — renderização do tooltip de Climatização no TELEMETRY_INFO.
 *
 * Extrai a FUNÇÃO REAL `buildClimatizacaoContent` (e suas dependências) do
 * controller do widget e a executa num sandbox com STATE/window injetados. Assim
 * o teste trava o HTML de fato produzido em produção — sem espelhar/copiar a
 * lógica.
 *
 * Contrato coberto:
 *   - COM pai em STATE.consumidores.climatizacao.parents: linha do pai no TOPO da
 *     Composição, subcategorias ANINHADAS abaixo, header mostra o total do pai.
 *   - SEM pai (campo vazio OU ausente): saída idêntica à de antes (composição
 *     plana; nada de linha de pai nem wrapper aninhado).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTROLLER = resolve(
  __dirname,
  '../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/controller.js',
);

/** Extrai o texto de uma função top-level `function NAME(...) { ... }`. */
function extractFn(src: string, name: string): string {
  const lines = src.replace(/\r/g, '').split('\n');
  const start = lines.findIndex((l) => l.startsWith(`function ${name}(`));
  if (start < 0) throw new Error(`função não encontrada: ${name}`);
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === '}') {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error(`fim da função não encontrado: ${name}`);
  return lines.slice(start, end + 1).join('\n');
}

/**
 * Monta um `buildClimatizacaoContent` executável a partir do source real,
 * com STATE/window injetados. formatEnergy é resolvido via window.MyIOUtils.
 */
function makeBuilder(state: Record<string, unknown>): () => string {
  const src = readFileSync(CONTROLLER, 'utf8');
  const body =
    extractFn(src, 'formatEnergy') +
    '\n' +
    extractFn(src, 'buildDeviceExpandList') +
    '\n' +
    extractFn(src, 'buildExcludedFromCAGNotice') +
    '\n' +
    extractFn(src, 'buildClimatizacaoContent') +
    '\nreturn buildClimatizacaoContent;';
  const win = {
    MyIOUtils: {
      // total previsível: "<n> MWh" com separador de milhar por ponto
      formatEnergy: (v: number) =>
        `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })} MWh`,
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function('STATE', 'window', 'console', body) as (
    s: unknown,
    w: unknown,
    c: unknown,
  ) => () => string;
  return factory(state, win, console);
}

function subcat(name: string, count: number, total: number) {
  return { summary: { count, total }, details: { name, devices: [] } };
}

function baseState(parents: Array<{ id: string; label: string; total: number }> | undefined) {
  const climatizacao: Record<string, unknown> = {
    devices: new Array(30).fill(0).map((_, i) => ({ id: `d${i}`, label: `d${i}`, value: 1 })),
    total: parents && parents.length ? 336600 : 326973,
    perc: 30,
    subcategories: {
      chillers: subcat('Chillers', 3, 184661),
      fancoils: subcat('Fancoils', 14, 96046),
      bombasClimatizacao: subcat('Bombas', 13, 46266),
    },
  };
  if (parents !== undefined) climatizacao.parents = parents;
  return {
    consumidores: { climatizacao },
    tooltipData: { excludedFromCAG: [] },
  };
}

let htmlWithParent: string;
let htmlNoParent: string;
let htmlFieldAbsent: string;

beforeEach(() => {
  htmlWithParent = makeBuilder(
    baseState([{ id: '82f0', label: 'CAG-Entrada', total: 336600 }]),
  )();
  htmlNoParent = makeBuilder(baseState([]))();
  htmlFieldAbsent = makeBuilder(baseState(undefined))();
});

describe('buildClimatizacaoContent — modo parent', () => {
  it('COM pai: renderiza a linha do pai com label e valor', () => {
    expect(htmlWithParent).toContain('CAG-Entrada');
    expect(htmlWithParent).toContain('Medidor pai da composição');
    expect(htmlWithParent).toContain('336,600 MWh');
    expect(htmlWithParent).toContain('myio-info-tooltip__category--parent');
  });

  it('COM pai: a composição fica ANINHADA (wrapper indentado) abaixo do pai', () => {
    expect(htmlWithParent).toContain('myio-info-tooltip__nested');
    const posPai = htmlWithParent.indexOf('CAG-Entrada');
    const posNested = htmlWithParent.indexOf('myio-info-tooltip__nested');
    const posChiller = htmlWithParent.indexOf('Chillers');
    // pai ANTES do wrapper aninhado, e o wrapper ANTES das subcategorias
    expect(posPai).toBeGreaterThan(-1);
    expect(posNested).toBeGreaterThan(posPai);
    expect(posChiller).toBeGreaterThan(posNested);
  });

  it('COM pai: as subcategorias continuam presentes (breakdown enumerado)', () => {
    expect(htmlWithParent).toContain('Chillers');
    expect(htmlWithParent).toContain('Fancoils');
    expect(htmlWithParent).toContain('Bombas');
    expect(htmlWithParent).toContain('184,661 MWh');
    expect(htmlWithParent).toContain('96,046 MWh');
    expect(htmlWithParent).toContain('46,266 MWh');
  });

  it('COM pai: o header "Consumo Total" mostra o total do pai (336.600)', () => {
    const header = htmlWithParent.slice(0, htmlWithParent.indexOf('Composição'));
    expect(header).toContain('336,600 MWh');
  });

  it('SEM pai (lista vazia): composição PLANA, sem linha de pai nem wrapper', () => {
    expect(htmlNoParent).not.toContain('myio-info-tooltip__nested');
    expect(htmlNoParent).not.toContain('Medidor pai da composição');
    expect(htmlNoParent).not.toContain('myio-info-tooltip__category--parent');
    expect(htmlNoParent).toContain('Chillers');
  });

  it('campo `parents` AUSENTE ⇒ byte-idêntico à lista vazia (retrocompat)', () => {
    expect(htmlFieldAbsent).toBe(htmlNoParent);
  });

  it('a nota explicativa muda conforme haja pai ou não', () => {
    expect(htmlWithParent).toContain('medidor pai');
    expect(htmlNoParent).toContain('soma do consumo de todos os equipamentos');
  });
});
