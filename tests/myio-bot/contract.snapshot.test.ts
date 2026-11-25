// RFC-0242 — drift detection: contract.ts field lists vs the checked-in snapshot of gcdr's OpenAPI.
// Refresh the snapshot with `node scripts/snapshot-gcdr-bot-openapi.mjs` when GCDR changes /bot/*.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  MYIO_BOT_CONTRACT_FIELDS,
  MYIO_BOT_PROPOSED_EXTENSIONS,
  MYIO_BOT_ENDPOINTS,
  MYIO_BOT_REQUEST_FIELDS,
  MYIO_BOT_PROTOCOL_VERSION,
} from '../../src/components/myio-bot/contract';

const raw = fs.readFileSync(path.resolve(__dirname, 'gcdr-bot-openapi.snapshot.json'), 'utf8').replace(/\r\n/g, '\n');
const snap = JSON.parse(raw) as {
  components: Record<string, { properties?: string[]; required?: string[] }>;
  inline: Record<string, string[]>;
  paths: Record<string, string[]>;
  requestBodies: Record<string, string[]>;
};

const openapiFields = (name: string): string[] => snap.components[name]?.properties ?? snap.inline[name] ?? [];

describe('contract.ts vs gcdr OpenAPI snapshot', () => {
  it('protocol version is 1', () => {
    expect(MYIO_BOT_PROTOCOL_VERSION).toBe(1);
  });

  for (const [name, fields] of Object.entries(MYIO_BOT_CONTRACT_FIELDS)) {
    it(`${name}: same field list (modulo declared RFC-0242 extensions)`, () => {
      const api = openapiFields(name);
      expect(api.length, `${name} missing from the snapshot`).toBeGreaterThan(0);
      const ext = MYIO_BOT_PROPOSED_EXTENSIONS[name] ?? [];
      const ours = fields.filter((f) => !ext.includes(f)).slice().sort();
      expect(ours).toEqual(api.slice().sort());
    });
  }

  it('declared extensions are really absent from GCDR (remove them here once GCDR ships them)', () => {
    for (const [name, ext] of Object.entries(MYIO_BOT_PROPOSED_EXTENSIONS)) {
      const api = openapiFields(name);
      for (const f of ext) expect(api, `${name}.${f} now exists in GCDR`).not.toContain(f);
    }
  });

  it('every endpoint the client calls exists in GCDR, except the declared phase-2 ones', () => {
    for (const ep of MYIO_BOT_ENDPOINTS) {
      const methods = snap.paths[ep.path];
      if (ep.proposed) expect(methods, `${ep.path} now exists — drop "proposed"`).toBeUndefined();
      else expect(methods, `${ep.method.toUpperCase()} ${ep.path}`).toContain(ep.method);
    }
  });

  it('request bodies only use fields GCDR accepts (its Zod schemas are strict)', () => {
    for (const [key, fields] of Object.entries(MYIO_BOT_REQUEST_FIELDS)) {
      const accepted = snap.requestBodies[key];
      expect(accepted, key).toBeDefined();
      for (const f of fields) expect(accepted, `${key}.${f}`).toContain(f);
    }
  });

  it('GCDR still does not accept `context` on messages (prefix fallback stays the default)', () => {
    expect(snap.requestBodies['POST /bot/conversations/{id}/messages']).not.toContain('context');
  });

  it('GCDR still does not filter conversations by clientThreadKey (client-side match stays)', () => {
    expect(snap.requestBodies['GET /bot/conversations ?query']).not.toContain('clientThreadKey');
  });
});
