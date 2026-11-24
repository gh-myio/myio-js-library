/**
 * Os controllers v-5.2.0 são scripts de widget ThingsBoard (não importáveis): os testes extraem as
 * funções do código-fonte e as avaliam com `new Function`, exercitando o código real.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WIDGET_DIR = resolve(process.cwd(), 'src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET');

export function readControllerSource(widget: 'MAIN_VIEW' | 'HEADER' | 'TELEMETRY_INFO'): string {
  return readFileSync(resolve(WIDGET_DIR, `${widget}/controller.js`), 'utf8');
}

/**
 * ED-1389 — bloco de apresentação do modo R$ do TELEMETRY_INFO (constantes + helpers
 * `_moneyMode`, `_displayGroup`, `_sliceDisplay`, `_applyMoneyToStats`, …). As funções de
 * render/tooltip chamam esses helpers, então todo sandbox que as extrai precisa do bloco.
 * Dependências resolvidas na chamada: `getWidgetDomain` (+ `self`), `formatEnergy`,
 * `formatValue`, `STATE`, `STATE_WATER`, `GROUP_FILTER`, `window.MyIOUtils`.
 */
export function extractTelemetryInfoMoneyBlock(source: string): string {
  source = source.replace(/\r\n/g, '\n'); // checkout com core.autocrlf (Windows) → CRLF
  const begin = source.indexOf('// ===================== RFC-0241 Part B + ED-1389');
  const end = source.indexOf('/**\n * RFC-0056: Render statistics for 6 categories');
  if (begin < 0 || end < 0 || end < begin) throw new Error('bloco do modo R$ do TELEMETRY_INFO não encontrado');
  return source.slice(begin, end);
}

/** Extrai `function name(...) { ... }` do fonte (chaves balanceadas). */
export function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function ${name} not found in controller source`);
  const open = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/** Extrai o bloco `{ ... }` que começa no primeiro `{` depois de `marker` (ex.: 'self.onDestroy = function'). */
export function extractBlockAfter(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`"${marker}" not found in controller source`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(open, i + 1);
  }
  throw new Error(`unbalanced braces after "${marker}"`);
}
