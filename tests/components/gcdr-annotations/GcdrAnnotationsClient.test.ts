/**
 * RFC-0218 — GcdrAnnotationsClient unit tests (mocked `fetch`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GcdrAnnotationsClient,
  createGcdrAnnotationsClient,
} from '../../../src/components/gcdr-annotations/v1.0.0/GcdrAnnotationsClient';
import { GcdrAnnotationsConflictError, GcdrAnnotationsError } from '../../../src/components/gcdr-annotations/v1.0.0/types';
import {
  adaptGcdrToLegacyAnnotation,
  adaptGcdrListToLegacyAnnotations,
  adaptLegacyToGcdrInput,
  toGcdrDueDate,
} from '../../../src/components/gcdr-annotations/v1.0.0/adapters';
import { createAuthStrategy } from '../../../src/components/gcdr-annotations/v1.0.0/authStrategies';
import type { GcdrAnnotation, GcdrAnnotationDetail } from '../../../src/components/gcdr-annotations/v1.0.0/types';

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(body == null ? '' : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeClient(fetchImpl: typeof fetch, extra: Partial<Parameters<typeof createGcdrAnnotationsClient>[0]> = {}) {
  return createGcdrAnnotationsClient({
    domainPath: 'https://gcdr.example/api/v1',
    auth: { apiKey: 'gcdr_cust_ABC' },
    fetchImpl,
    ...extra,
  });
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.useRealTimers();
});

describe('authStrategies — createAuthStrategy', () => {
  it('applies X-API-Key when apiKey is given', async () => {
    const strategy = createAuthStrategy({ apiKey: 'key-1' });
    const headers: Record<string, string> = {};
    await strategy.apply(headers);
    expect(headers['X-API-Key']).toBe('key-1');
  });

  it('applies Authorization: Bearer for a string token', async () => {
    const strategy = createAuthStrategy({ bearerToken: 'jwt-1' });
    const headers: Record<string, string> = {};
    await strategy.apply(headers);
    expect(headers['Authorization']).toBe('Bearer jwt-1');
  });

  it('applies Authorization: Bearer for an async token provider', async () => {
    const strategy = createAuthStrategy({ bearerToken: async () => 'jwt-async' });
    const headers: Record<string, string> = {};
    await strategy.apply(headers);
    expect(headers['Authorization']).toBe('Bearer jwt-async');
  });

  it('throws when both apiKey and bearerToken are given', () => {
    expect(() => createAuthStrategy({ apiKey: 'a', bearerToken: 'b' })).toThrow(/exactly one/);
  });

  it('throws when neither apiKey nor bearerToken is given', () => {
    expect(() => createAuthStrategy({})).toThrow(/required/);
  });
});

describe('GcdrAnnotationsClient — request assembly', () => {
  it('normalizes a domainPath with a trailing slash without rewriting host/version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [], pagination: { page: 1, limit: 100 } }));
    const client = makeClient(fetchMock as unknown as typeof fetch, {
      domainPath: 'https://gcdr.example/api/v1/',
    } as any);
    await client.list({ customerId: 'c1' });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('https://gcdr.example/api/v1/annotations?');
    expect(url).not.toContain('api/v1/api/v1');
  });

  it('applies the configured auth strategy as request headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await client.list();
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('gcdr_cust_ABC');
  });
});

// Real GCDR contract (gcdr AnnotationRepository.list → PaginatedResult in the
// {success,data} envelope): data.items + data.pagination.{hasMore,nextCursor}.
function listPage(items: Array<{ id: string }>, nextCursor?: string) {
  return {
    success: true,
    data: { items, pagination: { total: 99, hasMore: !!nextCursor, ...(nextCursor ? { nextCursor } : {}) } },
  };
}

describe('GcdrAnnotationsClient — listByCustomer / listByEntity pagination', () => {
  it('follows nextCursor across pages and forwards filters (includeArchived)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(listPage([{ id: 'a1' }, { id: 'a2' }], '2')))
      .mockResolvedValueOnce(jsonResponse(listPage([{ id: 'a3' }])));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const all = await client.listByCustomer('cust-1', { includeArchived: true, limit: 2 });

    expect(all.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl] = fetchMock.mock.calls[0];
    expect(firstUrl).toContain('customerId=cust-1');
    expect(firstUrl).toContain('includeArchived=true');
    expect(firstUrl).not.toContain('page=');
    expect(firstUrl).not.toContain('cursor=');
    const [secondUrl] = fetchMock.mock.calls[1];
    expect(secondUrl).toContain('cursor=2');
  });

  it('never sends includeArchived=false (GCDR excludes archived by default)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(listPage([])));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await client.list({ customerId: 'c', includeArchived: false });
    expect(fetchMock.mock.calls[0][0]).not.toContain('includeArchived');
  });

  it('listByEntity scopes the query to entityType/entityId', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(listPage([{ id: 'a1' }])));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await client.listByEntity('device', 'device-uuid-1');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('entityType=device');
    expect(url).toContain('entityId=device-uuid-1');
  });

  it('stops at maxPages and logs a warning', async () => {
    // A fresh Response per call — a single Response's body can only be read once.
    let n = 0;
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(jsonResponse(listPage([{ id: `x${n}` }], String(++n)))));
    const client = makeClient(fetchMock as unknown as typeof fetch, { maxPages: 2 });
    const all = await client.listByCustomer('cust-cap');
    expect(all).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('GcdrAnnotationsClient — envelope handling', () => {
  it('unwraps the {success,data} envelope for getById', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { id: 'a1', version: 1, responses: [], events: [] } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const detail = await client.getById('a1');
    expect(detail.id).toBe('a1');
  });

  it('tolerates a raw (unwrapped) array body for list()', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: 'a1' }, { id: 'a2' }]));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const page = await client.list();
    expect(page.items.map((i) => i.id)).toEqual(['a1', 'a2']);
    expect(page.pagination.hasMore).toBe(false);
  });
});

describe('GcdrAnnotationsClient — retry policy', () => {
  it('retries on 503 up to the max, then succeeds', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'down' } }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'down' } }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }));
    const client = makeClient(fetchMock as unknown as typeof fetch);

    const promise = client.list();
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.items).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on 400', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'bad request' } }, { status: 400 }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.list()).rejects.toBeInstanceOf(GcdrAnnotationsError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'unauthorized' } }, { status: 401 }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.list()).rejects.toBeInstanceOf(GcdrAnnotationsError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 409 and surfaces GcdrAnnotationsConflictError with finalizedOrStale', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'stale version' } }, { status: 409 }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.patch('a1', { text: 'x' }, 3)).rejects.toBeInstanceOf(GcdrAnnotationsConflictError);
    await expect(client.patch('a1', { text: 'x' }, 3)).rejects.toMatchObject({
      status: 409,
      finalizedOrStale: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('GcdrAnnotationsClient — writes', () => {
  it('patch() sends If-Match with the given version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'a1', version: 4 } }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await client.patch('a1', { importance: 5 }, 3);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['If-Match']).toBe('"3"');
    expect(init.method).toBe('PATCH');
  });

  it('archive() sends If-Match with the given version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'a1', version: 2 } }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await client.archive('a1', 1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/annotations/a1/archive');
    expect((init.headers as Record<string, string>)['If-Match']).toBe('"1"');
  });

  it("respond({type:'rejected'}) without text throws a local validation error, no request made", async () => {
    const fetchMock = vi.fn();
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.respond('a1', { type: 'rejected' })).rejects.toBeInstanceOf(GcdrAnnotationsError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("respond({type:'approved'}) without text is allowed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'a1', version: 2 } }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.respond('a1', { type: 'approved' })).resolves.toMatchObject({ id: 'a1' });
  });

  it('create() invalidates the GET cache', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'a1' }], pagination: { page: 1, limit: 100, hasNext: false } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'a2', version: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'a1' }, { id: 'a2' }], pagination: { page: 1, limit: 100, hasNext: false } }));
    const client = makeClient(fetchMock as unknown as typeof fetch, { cacheTtlMs: 60_000 } as any);

    await client.list();
    await client.create({ entityType: 'central', entityId: 'c1', customerId: 'cust-1', text: 'x', type: 'observation', importance: 3 });
    const afterCreate = await client.list();

    expect(afterCreate.items.map((i) => i.id)).toEqual(['a1', 'a2']);
    expect(fetchMock).toHaveBeenCalledTimes(3); // list, create, list again (not served from cache)
  });
});

describe('GcdrAnnotationsClient — GET cache', () => {
  it('caches within the TTL window — a second list() does not refetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 'a1' }] }));
    const client = makeClient(fetchMock as unknown as typeof fetch, { cacheTtlMs: 60_000 } as any);
    await client.list({ customerId: 'c1' });
    await client.list({ customerId: 'c1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches after the TTL expires', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ data: [{ id: 'a1' }] })));
    const client = makeClient(fetchMock as unknown as typeof fetch, { cacheTtlMs: 1_000 } as any);
    await client.list({ customerId: 'c1' });
    vi.advanceTimersByTime(1_001);
    await client.list({ customerId: 'c1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('adapters — GCDR ⇄ legacy Annotation', () => {
  const base: GcdrAnnotationDetail = {
    id: 'a1',
    version: 2,
    customerId: 'cust-1',
    entityType: 'central',
    entityId: 'central-1',
    text: 'texto da anotação',
    type: 'pending',
    importance: 4,
    finalized: false,
    createdAt: '2026-09-01T00:00:00Z',
    createdBy: { id: 'u1', email: 'u1@myio.com.br', name: 'User One' },
    responses: [],
    events: [],
  };

  it('maps type both ways (pending↔issue proposal per RFC-0218 Q1... kept as pending↔pending here, see note)', () => {
    const legacy = adaptGcdrToLegacyAnnotation(base);
    expect(legacy.type).toBe('pending');

    const gcdrInput = adaptLegacyToGcdrInput(
      { text: legacy.text, type: legacy.type, importance: legacy.importance },
      { entityType: 'central', entityId: 'central-1', customerId: 'cust-1' }
    );
    expect(gcdrInput.type).toBe('pending');
  });

  it('derives status "created" for version 1, "modified" for version > 1', () => {
    const v1 = adaptGcdrToLegacyAnnotation({ ...base, version: 1 });
    const v2 = adaptGcdrToLegacyAnnotation({ ...base, version: 2 });
    expect(v1.status).toBe('created');
    expect(v2.status).toBe('modified');
  });

  it('derives status "archived" only when finalizedReason is archived', () => {
    const archived = adaptGcdrToLegacyAnnotation({ ...base, finalized: true, finalizedReason: 'archived' });
    const approved = adaptGcdrToLegacyAnnotation({ ...base, finalized: true, finalizedReason: 'approved' });
    expect(archived.status).toBe('archived');
    expect(approved.status).toBe('modified');
  });

  it('maps responses[] and events[] (detail shape) into legacy responses/history', () => {
    const withDetail: GcdrAnnotationDetail = {
      ...base,
      responses: [
        {
          id: 'r1',
          type: 'approved',
          createdAt: '2026-09-02T00:00:00Z',
          createdBy: { id: 'u2', email: 'u2@myio.com.br', name: 'User Two' },
        },
      ],
      events: [
        {
          id: 'e1',
          action: 'approved',
          previousVersion: 1,
          createdAt: '2026-09-02T00:00:00Z',
          actor: { id: 'u2', email: 'u2@myio.com.br', name: 'User Two' },
        },
      ],
    };
    const legacy = adaptGcdrToLegacyAnnotation(withDetail);
    expect(legacy.responses).toHaveLength(1);
    expect(legacy.responses[0].type).toBe('approved');
    expect(legacy.history).toEqual([
      {
        timestamp: '2026-09-02T00:00:00Z',
        userId: 'u2',
        userName: 'User Two',
        userEmail: 'u2@myio.com.br',
        action: 'approved',
        previousVersion: 1,
      },
    ]);
    expect(legacy.acknowledged).toBe(true);
  });

  it('ignores unknown/extra GCDR fields without throwing', () => {
    const withExtra = { ...base, someFutureField: { nested: true } } as GcdrAnnotation;
    expect(() => adaptGcdrToLegacyAnnotation(withExtra)).not.toThrow();
  });

  it('adaptGcdrListToLegacyAnnotations maps a whole array', () => {
    const list = adaptGcdrListToLegacyAnnotations([base, { ...base, id: 'a2' }]);
    expect(list.map((a) => a.id)).toEqual(['a1', 'a2']);
  });
});

describe('GcdrAnnotationsClient — toLegacyAnnotations bridge', () => {
  it('exposes the same adapter via the client instance', async () => {
    const fetchMock = vi.fn();
    const client = makeClient(fetchMock as unknown as typeof fetch) as GcdrAnnotationsClient;
    const legacy = client.toLegacyAnnotations([
      {
        id: 'a1',
        version: 1,
        customerId: 'c1',
        entityType: 'central',
        entityId: 'central-1',
        text: 'x',
        type: 'observation',
        importance: 3,
        finalized: false,
        createdAt: '2026-09-01T00:00:00Z',
        createdBy: { id: 'u1', email: 'u1@myio.com.br', name: 'U1' },
      },
    ]);
    expect(legacy[0].id).toBe('a1');
  });
});

describe('GcdrAnnotationsClient — constructor validation', () => {
  it('throws without a domainPath', () => {
    expect(() => new GcdrAnnotationsClient({ domainPath: '', auth: { apiKey: 'k' } } as any)).toThrow(/domainPath/);
  });
});

// ---------------------------------------------------------------------------
// RFC-0219 — real GCDR contract + the ThingsBoard dashboard path
// ---------------------------------------------------------------------------

describe('RFC-0219 — TB session auth and injected strategies', () => {
  it('tbSessionToken sends X-TB-Authorization, read fresh on every request', async () => {
    let token = 'tb-1';
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(listPage([]))));
    const client = createGcdrAnnotationsClient({
      domainPath: 'https://gcdr.example/api/v1',
      auth: { tbSessionToken: () => token },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.list();
    token = 'tb-2';
    await client.list();
    expect(fetchMock.mock.calls[0][1].headers['X-TB-Authorization']).toBe('Bearer tb-1');
    expect(fetchMock.mock.calls[1][1].headers['X-TB-Authorization']).toBe('Bearer tb-2');
    expect(fetchMock.mock.calls[0][1].headers['X-API-Key']).toBeUndefined();
  });

  it('accepts a ready AuthStrategy instead of credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(listPage([])));
    const client = createGcdrAnnotationsClient({
      domainPath: 'https://gcdr.example/api/v1',
      authStrategy: { apply: (h) => void (h['X-Custom'] = 'yes') },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.list();
    expect(fetchMock.mock.calls[0][1].headers['X-Custom']).toBe('yes');
  });

  it('rejects more than one credential', () => {
    expect(() => createAuthStrategy({ apiKey: 'k', tbSessionToken: 't' })).toThrow();
  });
});

describe('RFC-0219 — writes against the real contract', () => {
  it('create() is never retried (a retry after a server-side commit would duplicate it)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'boom' } }, { status: 503 }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(
      client.create({ entityType: 'device', entityId: 'd', customerId: 'c', text: 't', type: 'observation', importance: 3 })
    ).rejects.toBeInstanceOf(GcdrAnnotationsError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('respond() sends the version as If-Match (not in the body) and returns the response row', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, data: { id: 'r1', type: 'archived', text: 'ok' } }, { status: 201 }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const response = await client.respond('a1', { type: 'archived', text: 'ok', version: 3 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['If-Match']).toBe('"3"');
    expect(JSON.parse(init.body)).toEqual({ type: 'archived', text: 'ok' });
    expect(response.id).toBe('r1');
  });

  it('mention()/attach() send the bodies GCDR validates', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ success: true, data: {} })));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await client.mention('a1', { userId: 'u1' });
    await client.mention('a1', { deviceId: 'd1' });
    await client.attach('a1', { fileAssetId: 'f1' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ mentionType: 'user', mentionedUserId: 'u1' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ mentionType: 'device', mentionedDeviceId: 'd1' });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ fileAssetId: 'f1' });
  });
});

describe('RFC-0219 — adapters use GCDR native state', () => {
  const g = {
    id: 'a1',
    version: 3,
    customerId: 'c',
    entityType: 'device',
    entityId: 'd',
    text: 't',
    type: 'observation' as const,
    importance: 3 as const,
    createdAt: '2026-09-01T00:00:00Z',
    createdBy: { id: 'u1' },
  };

  it('prefers native status and finalized state', () => {
    const archivedAfterApproval = adaptGcdrToLegacyAnnotation({
      ...g,
      status: 'archived',
      finalized: true,
      finalizedReason: 'archived',
    });
    expect(archivedAfterApproval.status).toBe('archived');
    expect(archivedAfterApproval.finalized).toBe(true);

    const approved = adaptGcdrToLegacyAnnotation({ ...g, status: 'modified', finalized: true, finalizedReason: 'approved' });
    expect(approved.status).toBe('modified');
    expect(approved.finalizedReason).toBe('approved');
  });

  it('uses native acknowledge fields (migrated data) when present', () => {
    const legacy = adaptGcdrToLegacyAnnotation({
      ...g,
      finalized: false,
      acknowledged: true,
      acknowledgedBy: { id: 'u9', email: 'u9@x.com', name: 'Nove' },
      acknowledgedAt: '2026-09-03T00:00:00Z',
    });
    expect(legacy.acknowledged).toBe(true);
    expect(legacy.acknowledgedBy).toEqual({ id: 'u9', email: 'u9@x.com', name: 'Nove' });
    expect(legacy.acknowledgedAt).toBe('2026-09-03T00:00:00Z');
  });

  it('turns a date-input dueDate into an ISO datetime with offset for create()', () => {
    expect(toGcdrDueDate('2026-10-10')).toBe('2026-10-10T03:00:00.000Z');
    expect(toGcdrDueDate('2026-10-10T12:00:00Z')).toBe('2026-10-10T12:00:00.000Z');
    expect(toGcdrDueDate('nope')).toBeUndefined();
    expect(
      adaptLegacyToGcdrInput(
        { text: 't', type: 'observation', importance: 3, dueDate: '2026-10-10' },
        { entityType: 'device', entityId: 'd', customerId: 'c' }
      ).dueDate
    ).toBe('2026-10-10T03:00:00.000Z');
  });
});
