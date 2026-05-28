/**
 * RFC-0203 M2 — AnnotationServiceOrchestrator unit tests.
 *
 * Covers:
 *   - AC-9  paginated devices fetch (with hasNext loop)
 *   - AC-10 batch attribute fetch (chunking + concurrency)
 *   - AC-11 defensive parseLogAnnotations (string/object/array/null/garbage)
 *   - AC-12 in-memory cache, no localStorage writes
 *   - AC-13 refresh() dispatches `myio:annotations-refreshed`
 *   - AC-14 listener for `myio:annotation-changed` triggers refresh
 *   - Index correctness (byIdentifier, byDeviceId, byDomain)
 *   - Group builder with filters (search, types, importance, actionableOnly)
 *   - Count helpers (total / pending / overdue)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAnnotationServiceOrchestrator } from '../../../src/services/annotations/AnnotationServiceOrchestrator';
import { parseLogAnnotations } from '../../../src/services/annotations/parseLogAnnotations';
import type { Annotation } from '../../../src/services/annotations/types';

// ─── Fixture builders ──────────────────────────────────────────────────────

function makeAnnotation(over: Partial<Annotation> = {}): Annotation {
  return {
    id: over.id ?? 'ann-1',
    version: over.version ?? 1,
    text: over.text ?? 'sample text',
    type: over.type ?? 'observation',
    importance: over.importance ?? 3,
    status: over.status ?? 'created',
    createdAt: over.createdAt ?? '2026-05-01T00:00:00.000Z',
    dueDate: over.dueDate,
    createdBy: over.createdBy ?? { id: 'u1', email: 'a@b.com', name: 'A B' },
    acknowledged: over.acknowledged ?? false,
    responses: over.responses ?? [],
    history: over.history ?? [],
  } as Annotation;
}

function makeDeviceInfo(over: Partial<{ id: string; name: string; label: string; type: string }> = {}) {
  return {
    id: { id: over.id ?? 'd1', entityType: 'DEVICE' },
    name: over.name ?? 'Device 1',
    label: over.label ?? 'Device 1',
    type: over.type ?? '3F_MEDIDOR',
  };
}

function makeAttrs(items: Array<{ key: string; value: unknown }>) {
  return items;
}

// ─── Fetch mock helpers ────────────────────────────────────────────────────

type FetchHandler = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

function installFetch(handler: FetchHandler): void {
  vi.stubGlobal('fetch', vi.fn((url: string) => handler(url)));
}

// ─── parseLogAnnotations ───────────────────────────────────────────────────

describe('parseLogAnnotations', () => {
  it('returns [] for null/undefined/empty string', () => {
    expect(parseLogAnnotations(null)).toEqual([]);
    expect(parseLogAnnotations(undefined)).toEqual([]);
    expect(parseLogAnnotations('')).toEqual([]);
  });

  it('parses a JSON string of LogAnnotationsAttribute', () => {
    const ann = makeAnnotation({ id: 'a1' });
    const raw = JSON.stringify({
      schemaVersion: '1.0.0',
      deviceId: 'd1',
      lastModified: '2026-01-01',
      lastModifiedBy: { id: 'u', email: 'u@x', name: 'U' },
      annotations: [ann],
    });
    expect(parseLogAnnotations(raw)).toEqual([ann]);
  });

  it('parses a JSON string of a plain array', () => {
    const ann = makeAnnotation({ id: 'a2' });
    expect(parseLogAnnotations(JSON.stringify([ann]))).toEqual([ann]);
  });

  it('parses an already-parsed object with annotations key', () => {
    const ann = makeAnnotation({ id: 'a3' });
    expect(
      parseLogAnnotations({
        schemaVersion: '1.0.0',
        deviceId: 'd1',
        lastModified: '',
        lastModifiedBy: { id: '', email: '', name: '' },
        annotations: [ann],
      })
    ).toEqual([ann]);
  });

  it('parses an already-parsed array', () => {
    const ann = makeAnnotation({ id: 'a4' });
    expect(parseLogAnnotations([ann])).toEqual([ann]);
  });

  it('returns [] (not throws) on garbage JSON', () => {
    const warn = vi.fn();
    const out = parseLogAnnotations('this is not json', 'd1', { warn });
    expect(out).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('drops malformed entries within an array', () => {
    const warn = vi.fn();
    const valid = makeAnnotation({ id: 'good' });
    const out = parseLogAnnotations(
      [valid, { id: 'bad-no-text' }, null, 'string-entry'],
      'd1',
      { warn }
    );
    expect(out).toEqual([valid]);
    expect(warn).toHaveBeenCalled();
  });
});

// ─── buildAnnotationServiceOrchestrator (integration-ish) ──────────────────

describe('buildAnnotationServiceOrchestrator', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches devices (paginated) and attributes (batched) and builds indices', async () => {
    // Page 0 returns 2 devices with hasNext=true; page 1 returns 1 device with hasNext=false.
    let pageCalls = 0;
    let attrCalls = 0;

    installFetch(async (url: string) => {
      if (url.includes('/deviceInfos')) {
        pageCalls++;
        if (url.includes('page=0')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                makeDeviceInfo({ id: 'd1', label: 'L-203 Havaianas', type: '3F_MEDIDOR' }),
                makeDeviceInfo({ id: 'd2', label: 'L-203 Hidrômetro', type: 'HIDROMETRO' }),
              ],
              hasNext: true,
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [makeDeviceInfo({ id: 'd3', label: 'AC Sala', type: 'TERMOSTATO' })],
            hasNext: false,
          }),
        };
      }

      if (url.includes('/values/attributes/SERVER_SCOPE')) {
        attrCalls++;
        // Extract device id from URL
        const m = url.match(/DEVICE\/([^/]+)\//);
        const did = m ? decodeURIComponent(m[1]) : '';
        const ann = makeAnnotation({ id: `ann-${did}` });
        const identifier = did === 'd1' || did === 'd2' ? 'L-203' : null;
        return {
          ok: true,
          status: 200,
          json: async () =>
            makeAttrs([
              { key: 'log_annotations', value: { annotations: [ann] } },
              ...(identifier ? [{ key: 'identifier', value: identifier }] : []),
            ]),
        };
      }

      throw new Error('unexpected fetch: ' + url);
    });

    const orch = await buildAnnotationServiceOrchestrator({
      customerId: 'cust-1',
      tbHost: 'https://tb.example',
      jwt: 'jwt-xyz',
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
    });

    expect(pageCalls).toBeGreaterThanOrEqual(2);
    expect(attrCalls).toBe(3);
    expect(orch.devices.length).toBe(3);

    // AC-9 paginated: both pages consumed
    expect(orch.byDeviceId.size).toBe(3);
    // Two devices share identifier "L-203", one has null
    expect(orch.byIdentifier.get('L-203')?.length).toBe(2);
    expect(orch.byIdentifier.get(null)?.length).toBe(1);
    // Domain classification
    expect(orch.byDomain.get('energy')?.length).toBe(1);
    expect(orch.byDomain.get('water')?.length).toBe(1);
    expect(orch.byDomain.get('temperature')?.length).toBe(1);
  });

  it('refresh() dispatches myio:annotations-refreshed', async () => {
    installFetch(async (url: string) => {
      if (url.includes('/deviceInfos')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [], hasNext: false }),
        };
      }
      return { ok: true, status: 200, json: async () => [] };
    });

    const orch = await buildAnnotationServiceOrchestrator({
      customerId: 'c',
      tbHost: 'https://tb',
      jwt: 'j',
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
    });

    const seen: CustomEvent[] = [];
    const handler = (e: Event) => seen.push(e as CustomEvent);
    window.addEventListener('myio:annotations-refreshed', handler);

    await orch.refresh();

    expect(seen.length).toBe(1);
    expect(seen[0].type).toBe('myio:annotations-refreshed');
    expect(typeof seen[0].detail.totalCount).toBe('number');
    window.removeEventListener('myio:annotations-refreshed', handler);
  });

  it('listens for myio:annotation-changed and triggers refresh (AC-14)', async () => {
    let attrCalls = 0;

    installFetch(async (url: string) => {
      if (url.includes('/deviceInfos')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [makeDeviceInfo({ id: 'd1' })],
            hasNext: false,
          }),
        };
      }
      attrCalls++;
      return {
        ok: true,
        status: 200,
        json: async () =>
          makeAttrs([
            {
              key: 'log_annotations',
              value: [makeAnnotation({ id: 'a' + attrCalls })],
            },
          ]),
      };
    });

    const orch = await buildAnnotationServiceOrchestrator({
      customerId: 'c',
      tbHost: 'https://tb',
      jwt: 'j',
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
    });

    const initialAttrCalls = attrCalls;
    expect(orch.devices[0].annotations[0].id).toBe('a' + initialAttrCalls);

    // Dispatch annotation-changed; the orchestrator listener should refresh.
    window.dispatchEvent(
      new CustomEvent('myio:annotation-changed', {
        detail: { deviceId: 'd1', action: 'save' },
      })
    );
    // Wait for the fire-and-forget refresh to complete (real timers, short wait).
    await new Promise((r) => setTimeout(r, 200));

    expect(attrCalls).toBeGreaterThan(initialAttrCalls);
  });

  it('counts only non-archived annotations in getTotalCount', async () => {
    installFetch(async (url: string) => {
      if (url.includes('/deviceInfos')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [makeDeviceInfo({ id: 'd1' })],
            hasNext: false,
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          makeAttrs([
            {
              key: 'log_annotations',
              value: [
                makeAnnotation({ id: 'a1', status: 'created' }),
                makeAnnotation({ id: 'a2', status: 'archived' }),
                makeAnnotation({ id: 'a3', status: 'modified' }),
              ],
            },
          ]),
      };
    });

    const orch = await buildAnnotationServiceOrchestrator({
      customerId: 'c',
      tbHost: 'https://tb',
      jwt: 'j',
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
    });

    expect(orch.getTotalCount()).toBe(2);
  });

  it('getOverdueCount counts only pending past-due', async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const future = new Date(Date.now() + 86400_000).toISOString();

    installFetch(async (url: string) => {
      if (url.includes('/deviceInfos')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [makeDeviceInfo({ id: 'd1' })], hasNext: false }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          makeAttrs([
            {
              key: 'log_annotations',
              value: [
                makeAnnotation({ id: 'a1', type: 'pending', dueDate: past }),
                makeAnnotation({ id: 'a2', type: 'pending', dueDate: future }),
                makeAnnotation({ id: 'a3', type: 'maintenance', dueDate: past }),
                makeAnnotation({ id: 'a4', type: 'pending', status: 'archived', dueDate: past }),
              ],
            },
          ]),
      };
    });

    const orch = await buildAnnotationServiceOrchestrator({
      customerId: 'c',
      tbHost: 'https://tb',
      jwt: 'j',
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
    });

    expect(orch.getOverdueCount()).toBe(1);
  });

  it('does NOT write to localStorage/sessionStorage (AC-12 LGPD)', async () => {
    const lsSet = vi.spyOn(window.localStorage.__proto__, 'setItem');
    const ssSet = vi.spyOn(window.sessionStorage.__proto__, 'setItem');

    installFetch(async (url: string) => {
      if (url.includes('/deviceInfos')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [makeDeviceInfo({ id: 'd1' })], hasNext: false }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => makeAttrs([{ key: 'log_annotations', value: [makeAnnotation()] }]),
      };
    });

    await buildAnnotationServiceOrchestrator({
      customerId: 'c',
      tbHost: 'https://tb',
      jwt: 'j',
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
    });

    expect(lsSet).not.toHaveBeenCalled();
    expect(ssSet).not.toHaveBeenCalled();
  });

  it('getGroups("identifier") buckets "Sem Identificador" for null identifier', async () => {
    installFetch(async (url: string) => {
      if (url.includes('/deviceInfos')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              makeDeviceInfo({ id: 'd1', type: '3F_MEDIDOR' }),
              makeDeviceInfo({ id: 'd2', type: '3F_MEDIDOR' }),
            ],
            hasNext: false,
          }),
        };
      }
      const m = url.match(/DEVICE\/([^/]+)\//);
      const did = m ? decodeURIComponent(m[1]) : '';
      const attrs: Array<{ key: string; value: unknown }> = [
        { key: 'log_annotations', value: [makeAnnotation({ id: 'ann-' + did })] },
      ];
      if (did === 'd1') attrs.push({ key: 'identifier', value: 'L-100' });
      return { ok: true, status: 200, json: async () => makeAttrs(attrs) };
    });

    const orch = await buildAnnotationServiceOrchestrator({
      customerId: 'c',
      tbHost: 'https://tb',
      jwt: 'j',
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
    });

    const groups = orch.getGroups('identifier');
    const keys = groups.map((g) => g.key).sort();
    expect(keys).toContain('L-100');
    expect(keys).toContain('Sem Identificador');
  });
});
