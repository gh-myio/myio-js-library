/**
 * GoalsPanel — write-side semantics (GCDR Goals 2026-07 release):
 *   - sparse PATCH with ONLY the dirty cells at the grid's level (no full-year PUT)
 *   - cleared cells → scoped bucket DELETEs
 *   - first write of a new year sends NO expectedVersion
 *   - 409 → refetch + reapply the operator's dirty cells (never discarded)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openGoalsPanel } from '../../src/components/GoalsPanel';

type Captured = { method: string; url: string; body?: any };

const YEAR = new Date().getFullYear();
const flush = async (n = 4) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

const mkRes = (payload: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

let requests: Captured[];
let getPayload: () => any;
let writeHandler: (req: Captured) => any;
let instance: { close: () => void } | null = null;

beforeEach(() => {
  requests = [];
  getPayload = () => ({
    success: true,
    data: {
      domain: 'ENERGY',
      year: YEAR,
      version: 3,
      tree: { monthly: { '01': { value: 100 }, '02': { value: 200 } } },
      history: [],
    },
  });
  writeHandler = (req) => {
    const expected = req.body?.expectedVersion;
    return mkRes({ success: true, data: { version: (expected || 3) + 1 } });
  };
  (globalThis as any).fetch = vi.fn(async (url: any, init: any) => {
    const method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(init.body) : undefined;
    const req: Captured = { method, url: String(url), body };
    requests.push(req);
    if (method === 'GET') return mkRes(getPayload());
    return writeHandler(req);
  });
});

afterEach(() => {
  instance?.close();
  instance = null;
  delete (globalThis as any).fetch;
  document.body.innerHTML = '';
});

async function openInEditMode() {
  instance = openGoalsPanel({
    customerId: 'cust-1',
    apiKey: 'gcdr_cust_test',
    baseUrl: 'https://gcdr.test',
  });
  await flush();
  const root = document.getElementById('myio-goals-gcdr-root')!;
  (root.querySelector('[data-action="enable-edit"]') as HTMLElement).click();
  await flush();
  return root;
}

function setCell(root: HTMLElement, key: string, value: string) {
  const input = root.querySelector(`input[data-cell="${key}"]`) as HTMLInputElement;
  expect(input).toBeTruthy();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function writes() {
  return requests.filter((r) => r.method !== 'GET');
}

describe('GoalsPanel write-side (sparse PATCH + scoped DELETE)', () => {
  it('saves ONLY the dirty cell as a PATCH bucket (no full-year PUT), with expectedVersion', async () => {
    const root = await openInEditMode();
    setCell(root, '01', '150'); // dirty
    // '02' untouched — must NOT be sent
    (root.querySelector('[data-action="save"]') as HTMLElement).click();
    await flush();

    const w = writes();
    expect(w).toHaveLength(1);
    expect(w[0].method).toBe('PATCH');
    expect(w[0].body).toEqual({
      buckets: [{ level: 'MONTH', ref: `${YEAR}-01`, value: 150 }],
      expectedVersion: 3,
    });
    expect(requests.some((r) => r.method === 'PUT')).toBe(false);
  });

  it('cleared cells become scoped bucket DELETEs chaining the fresh version', async () => {
    const root = await openInEditMode();
    setCell(root, '01', '150'); // changed
    setCell(root, '02', ''); // cleared (had 200 on the server)
    (root.querySelector('[data-action="save"]') as HTMLElement).click();
    await flush();

    const w = writes();
    expect(w.map((r) => r.method)).toEqual(['PATCH', 'DELETE']);
    expect(w[0].body.expectedVersion).toBe(3);
    expect(w[1].body).toEqual({
      bucket: { level: 'MONTH', ref: `${YEAR}-02` },
      expectedVersion: 4, // version returned by the PATCH
    });
  });

  it('clearing without other edits issues ONLY the DELETE (no empty PATCH)', async () => {
    const root = await openInEditMode();
    setCell(root, '02', '');
    (root.querySelector('[data-action="save"]') as HTMLElement).click();
    await flush();

    const w = writes();
    expect(w).toHaveLength(1);
    expect(w[0].method).toBe('DELETE');
    expect(w[0].body.bucket).toEqual({ level: 'MONTH', ref: `${YEAR}-02` });
  });

  it('nothing dirty → no write request at all', async () => {
    const root = await openInEditMode();
    // retype the same numeric value — not a change
    setCell(root, '01', '100.0');
    (root.querySelector('[data-action="save"]') as HTMLElement).click();
    await flush();
    expect(writes()).toHaveLength(0);
  });

  it('first write of a NEW year (version 0) sends NO expectedVersion', async () => {
    getPayload = () => ({
      success: true,
      data: { domain: 'ENERGY', year: YEAR, version: 0, tree: {}, history: [] },
    });
    const root = await openInEditMode();
    setCell(root, '03', '900');
    (root.querySelector('[data-action="save"]') as HTMLElement).click();
    await flush();

    const w = writes();
    expect(w).toHaveLength(1);
    expect(w[0].method).toBe('PATCH');
    expect(w[0].body.expectedVersion).toBeUndefined();
    expect(w[0].body.buckets).toEqual([{ level: 'MONTH', ref: `${YEAR}-03`, value: 900 }]);
  });

  it('409 → refetches the tree and REAPPLIES the dirty cells for review (conflict banner up)', async () => {
    const root = await openInEditMode();
    // conflict on the write; the follow-up GET returns the OTHER session's version
    writeHandler = () =>
      mkRes({ success: false, error: { code: 'VERSION_CONFLICT', currentVersion: 7 } }, 409);
    getPayload = () => ({
      success: true,
      data: {
        domain: 'ENERGY',
        year: YEAR,
        version: 7,
        tree: { monthly: { '01': { value: 999 }, '02': { value: 200 } } },
        history: [],
      },
    });
    setCell(root, '01', '150');
    (root.querySelector('[data-action="save"]') as HTMLElement).click();
    await flush(8);

    // dirty cell reapplied over the fresh baseline (NOT discarded to 999)
    const input = root.querySelector('input[data-cell="01"]') as HTMLInputElement;
    expect(input.value).toBe('150');
    // untouched cell shows the fresh server value
    const other = root.querySelector('input[data-cell="02"]') as HTMLInputElement;
    expect(other.value).toBe('200');
    // conflict banner survives the refetch
    expect(root.querySelector('.myio-goals-alert-amber')).toBeTruthy();
    // re-saving now sends the reapplied cell against the NEW version
    (root.querySelector('[data-action="save"]') as HTMLElement).click();
    await flush();
    const last = writes().at(-1)!;
    expect(last.method).toBe('PATCH');
    expect(last.body).toEqual({
      buckets: [{ level: 'MONTH', ref: `${YEAR}-01`, value: 150 }],
      expectedVersion: 7,
    });
  });

  it('DEVICE-granularity read renders the "Por medidor (N)" chip; coverageGaps renders the ⚠ chip', async () => {
    getPayload = () => ({
      success: true,
      data: {
        domain: 'ENERGY',
        year: YEAR,
        version: 5,
        granularity: 'DEVICE',
        devices: [
          { deviceId: 'd1', code: 'TRAFO_GERAL', label: 'Geral Entrada', allocation: 'EXPLICIT', annual: 13465346.813 },
          { deviceId: 'd2', code: 'TRAFO_CAG', label: 'Medição Geral CAG', allocation: 'RESIDUAL', annual: 3519194.31 },
        ],
        hoursCovered: 744,
        coverageGaps: { missing: [`${YEAR}-02`, `${YEAR}-03`], truncated: false, missingHours: 8016 },
        tree: { monthly: { '01': { value: 100 } } },
        history: [],
      },
    });
    instance = openGoalsPanel({
      customerId: 'cust-1',
      apiKey: 'gcdr_cust_test',
      baseUrl: 'https://gcdr.test',
    });
    await flush();
    const root = document.getElementById('myio-goals-gcdr-root')!;
    expect(root.textContent).toContain('Por medidor (2)');
    expect(root.querySelector('#myio-goals-coverage-warn')).toBeTruthy();
  });

  it('CUSTOMER year without the new fields renders no chip and no warning (compat)', async () => {
    const root = await openInEditMode();
    expect(root.textContent).not.toContain('Por medidor');
    expect(root.querySelector('#myio-goals-coverage-warn')).toBeNull();
  });
});
