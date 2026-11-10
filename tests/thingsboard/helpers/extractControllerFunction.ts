/**
 * Os controllers v-5.2.0 são scripts de widget ThingsBoard (não importáveis): os testes extraem as
 * funções do código-fonte e as avaliam com `new Function`, exercitando o código real.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WIDGET_DIR = resolve(process.cwd(), 'src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET');

export function readControllerSource(widget: 'MAIN_VIEW' | 'HEADER'): string {
  return readFileSync(resolve(WIDGET_DIR, `${widget}/controller.js`), 'utf8');
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
