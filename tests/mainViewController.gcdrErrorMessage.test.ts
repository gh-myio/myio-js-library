/**
 * ED-983 — friendlier error surfaced by the MAIN_VIEW's GCDR device
 * classification profile persistence (RFC-0234 v2) when the write is
 * rejected with 403 FORBIDDEN.
 *
 * Context (see the big comment above `rfc0207SaveActiveProfile` in the real
 * controller): a Customer API Key (`gcdr_cust_*`) never receives the
 * `entities:write` scope by GCDR design, so every `POST /entities/clone` /
 * `PUT /entities/bulk-replace` / `POST /entities/revert` call fails with 403
 * until GCDR issues a credential with write access. Before this fix, that
 * bubbled up to the operator as a bare "HTTP 403" string, which reads like a
 * UI bug rather than a backend permission gap — this is exactly what QA
 * reported on 2026-09-24 as "não está sendo possível salvar as alterações".
 *
 * This test extracts the REAL `_rfc0234GcdrErrorMessage` helper from the
 * controller source and locks in that a 403 gets a clear, actionable message
 * while every other status keeps the original raw HTTP format.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTROLLER = resolve(
  __dirname,
  '../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js',
);

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

function makeGcdrErrorMessage(): (action: string, status: number, text?: string) => string {
  const src = readFileSync(CONTROLLER, 'utf8');
  const body = extractFn(src, '_rfc0234GcdrErrorMessage') + '\nreturn _rfc0234GcdrErrorMessage;';
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(body) as () => (action: string, status: number, text?: string) => string;
  return factory();
}

describe('MAIN_VIEW controller — _rfc0234GcdrErrorMessage (ED-983)', () => {
  const gcdrErrorMessage = makeGcdrErrorMessage();

  it('translates a 403 into an actionable, non-technical message that names the missing scope', () => {
    const msg = gcdrErrorMessage('salvar o perfil', 403, 'Forbidden');
    expect(msg).toMatch(/403/);
    expect(msg).toMatch(/entities:write/);
    expect(msg).not.toBe('GCDR salvar o perfil HTTP 403: Forbidden');
  });

  it('keeps the raw HTTP format for any other status', () => {
    const msg = gcdrErrorMessage('salvar o perfil', 500, 'Internal Server Error');
    expect(msg).toBe('GCDR salvar o perfil HTTP 500: Internal Server Error');
  });

  it('omits the trailing colon when no response text is available', () => {
    const msg = gcdrErrorMessage('reverter o perfil', 409);
    expect(msg).toBe('GCDR reverter o perfil HTTP 409');
  });
});
