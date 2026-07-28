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
function makeBuilder(
  state: Record<string, unknown>,
  consoleObj: unknown = console,
): () => string {
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
  return factory(state, win, consoleObj);
}

/** Extrai os percentuais renderizados (spans `myio-info-tooltip__pct`) como números. */
function pcts(html: string): number[] {
  const re = /myio-info-tooltip__pct">\(([\d.,]+)%\)/g;
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(parseFloat(m[1].replace(',', '.')));
  return out;
}

/** Remove os spans de percentual e a linha "Pontos não mapeados" (fragmentos NOVOS). */
function strip(html: string): string {
  return html
    .replace(/ <span class="myio-info-tooltip__pct">\([^)]*\)<\/span>/g, '')
    .replace(
      /<div class="myio-info-tooltip__category myio-info-tooltip__category--climatizacao myio-info-tooltip__category--nao-mapeados">[\s\S]*?category-value">[\s\S]*?<\/span>\s*<\/div>/,
      '',
    );
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
    expect(htmlWithParent).toContain('Valor master — composição abaixo');
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
    expect(htmlNoParent).not.toContain('Valor master — composição abaixo');
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

/**
 * RFC-0207 saldo/percentual — additions on top of the existing parent mode.
 *
 * Aceitação Mestre Álvaro (números reportados pelo operador):
 *   pai (2 trafos de entrada da CAG) = 104.961
 *   filhos: Chillers 73.345 + Fancoils 16.878 + Bombas 9.603 = 99.826
 *   Pontos não mapeados (saldo) = 104.961 − 99.826 = 5.135
 *   percentuais do total do pai: 69,9% / 16,1% / 9,1% (≈9,2%) / 4,9% (≈100%)
 */
function acceptanceState() {
  return {
    consumidores: {
      climatizacao: {
        devices: new Array(30).fill(0).map((_, i) => ({ id: `d${i}`, label: `d${i}`, value: 1 })),
        // modo parent: total do card = total do pai
        total: 104961,
        perc: 30,
        parents: [{ id: 'cag', label: 'CAG-Entrada', total: 104961 }],
        subcategories: {
          chillers: subcat('Chillers', 2, 73345),
          fancoils: subcat('Fancoils', 25, 16878),
          bombasClimatizacao: subcat('Bombas', 3, 9603),
        },
      },
    },
    tooltipData: { excludedFromCAG: [] },
  };
}

describe('buildClimatizacaoContent — saldo "Pontos não mapeados"', () => {
  it('Aceitação Mestre Álvaro: renderiza saldo 5.135 com ~4,9% no fim da composição', () => {
    const html = makeBuilder(acceptanceState())();
    expect(html).toContain('Pontos não mapeados');
    expect(html).toContain('5,135 MWh'); // saldo = 104.961 − 99.826
    // o saldo aparece DENTRO do wrapper aninhado e DEPOIS dos filhos
    const posNested = html.indexOf('myio-info-tooltip__nested');
    const posBombas = html.indexOf('Bombas');
    const posSaldo = html.indexOf('Pontos não mapeados');
    expect(posSaldo).toBeGreaterThan(posNested);
    expect(posSaldo).toBeGreaterThan(posBombas);
    // percentual do saldo ≈ 4,9%
    expect(html).toMatch(/Pontos não mapeados[\s\S]*?myio-info-tooltip__pct">\(4,9%\)/);
  });

  it('Aceitação Mestre Álvaro: 4 percentuais (filhos + saldo) do total do pai somam ~100%', () => {
    const html = makeBuilder(acceptanceState())();
    const all = pcts(html);
    expect(all.length).toBe(4); // 3 filhos + saldo
    // ordem = ordem de renderização (chillers, fancoils, bombas, saldo)
    const [chi, fan, bom, sal] = all;
    expect(Math.abs(chi - 69.9)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(fan - 16.1)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(bom - 9.2)).toBeLessThanOrEqual(0.15); // valor exato 9,1% (9,15 arredonda p/ 9,1)
    expect(Math.abs(sal - 4.9)).toBeLessThanOrEqual(0.15);
    const sum = all.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.2);
  });

  it('total de Climatização NÃO muda com o saldo (header segue = total do pai)', () => {
    const html = makeBuilder(acceptanceState())();
    const header = html.slice(0, html.indexOf('Composição'));
    expect(header).toContain('104,961 MWh');
  });

  it('saldo SUPRIMIDO quando pai ≈ filhos (dentro da tolerância): sem linha', () => {
    const st = acceptanceState();
    // filhos somando exatamente o pai ⇒ saldo 0 ⇒ nenhuma linha
    (st.consumidores.climatizacao as any).parents = [{ id: 'cag', label: 'CAG', total: 99826 }];
    (st.consumidores.climatizacao as any).total = 99826;
    const html = makeBuilder(st)();
    expect(html).not.toContain('Pontos não mapeados');
    // ainda em modo parent (nesting presente)
    expect(html).toContain('myio-info-tooltip__nested');
  });

  it('filhos > pai ⇒ saldo negativo: SEM linha e warn-once', () => {
    const st = acceptanceState();
    (st.consumidores.climatizacao as any).parents = [{ id: 'cag', label: 'CAG', total: 90000 }];
    (st.consumidores.climatizacao as any).total = 90000; // filhos somam 99.826 > 90.000
    const warns: unknown[][] = [];
    const mockConsole = { log() {}, warn: (...a: unknown[]) => warns.push(a), error() {} };
    const build = makeBuilder(st, mockConsole);
    const html = build();
    const html2 = build(); // segunda renderização no MESMO window
    expect(html).not.toContain('Pontos não mapeados');
    expect(html2).not.toContain('Pontos não mapeados');
    // sem número negativo enganoso na composição
    expect(html).not.toMatch(/-[\d,]+ MWh/);
    // avisou UMA única vez apesar de renderizar duas
    expect(warns.length).toBe(1);
    expect(String(warns[0][0])).toContain('saldo negativo');
  });
});

describe('buildClimatizacaoContent — percentual na composição plana (sem pai)', () => {
  it('cada subcategoria mostra % do total de Climatização (base = header)', () => {
    // baseState sem pai: total 326973; filhos 184661/96046/46266
    const html = makeBuilder(baseState([]))();
    const all = pcts(html);
    expect(all.length).toBe(3); // sem saldo em modo plano
    const base = 326973;
    const expected = [184661, 96046, 46266].map((v) => (v / base) * 100);
    all.forEach((p, i) => expect(Math.abs(p - expected[i])).toBeLessThanOrEqual(0.1));
    // total ainda exibido
    expect(html).toContain('326,973 MWh');
    // sem qualquer estrutura de pai
    expect(html).not.toContain('myio-info-tooltip__category--parent');
    expect(html).not.toContain('Pontos não mapeados');
  });

  it('modo plano: nada de NaN/Infinity mesmo com total do card = 0', () => {
    const st = baseState([]);
    (st.consumidores.climatizacao as any).total = 0; // base do percentual = 0
    const html = makeBuilder(st)();
    expect(html).not.toMatch(/NaN|Infinity/);
    // base 0 ⇒ percentuais suprimidos (nenhum span de pct), sem artefato
    expect(html).not.toContain('myio-info-tooltip__pct');
  });
});

describe('buildClimatizacaoContent — aditividade (estrutura/totais intactos)', () => {
  it('modo plano: remover os spans de % recupera HTML sem artefato de %', () => {
    const stripped = strip(htmlNoParent);
    expect(stripped).not.toContain('myio-info-tooltip__pct');
    // totais dos filhos preservados byte a byte
    expect(stripped).toContain('184,661 MWh');
    expect(stripped).toContain('96,046 MWh');
    expect(stripped).toContain('46,266 MWh');
    expect(stripped).not.toMatch(/NaN|Infinity/);
  });

  it('modo parent: removidos % e saldo, o esqueleto do nesting/totais fica intacto', () => {
    const html = makeBuilder(acceptanceState())();
    const stripped = strip(html);
    // fragmentos NOVOS removidos
    expect(stripped).not.toContain('myio-info-tooltip__pct');
    expect(stripped).not.toContain('Pontos não mapeados');
    expect(stripped).not.toContain('myio-info-tooltip__category--nao-mapeados');
    // esqueleto do modo parent + totais preservados
    expect(stripped).toContain('myio-info-tooltip__category--parent');
    expect(stripped).toContain('CAG-Entrada');
    expect(stripped).toContain('Valor master — composição abaixo');
    expect(stripped).toContain('myio-info-tooltip__nested');
    expect(stripped).toContain('104,961 MWh'); // pai + header
    expect(stripped).toContain('73,345 MWh');
    expect(stripped).toContain('16,878 MWh');
    expect(stripped).toContain('9,603 MWh');
    expect(stripped).not.toMatch(/NaN|Infinity/);
  });
});
