/**
 * RFC-0218 — adapter tests (test case #8 in the RFC's §Tests list).
 *
 * Also locks in the correction over RFC-0218's "Unresolved Q1": the legacy
 * `AnnotationType` is identical to the GCDR enum (`observation | pending |
 * maintenance | activity`) — no `pending→issue` / `activity→alert` mapping
 * exists in the real `Annotation` type, so the adapter must NOT translate
 * type/status/response-type values, only reshape the object.
 */

import { describe, expect, it } from 'vitest';
import {
  adaptGcdrToLegacyAnnotation,
  adaptLegacyToGcdrInput,
} from '../../../src/components/gcdr-annotations/v1.0.0/adapters';
import type {
  GcdrAnnotation,
  GcdrAnnotationDetail,
} from '../../../src/components/gcdr-annotations/v1.0.0/types';

function makeGcdrAnnotation(over: Partial<GcdrAnnotation> = {}): GcdrAnnotation {
  return {
    id: 'ann-1',
    tenantId: 'tenant-1',
    customerId: 'cust-1',
    entityType: 'device',
    entityId: 'device-1',
    text: 'sample text',
    type: 'pending',
    importance: 4,
    status: 'modified',
    finalized: false,
    finalizedReason: null,
    dueDate: null,
    createdBy: { id: 'u1', email: 'a@b.com', name: 'A B' },
    updatedBy: null,
    version: 2,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z',
    ...over,
  };
}

describe('adaptGcdrToLegacyAnnotation', () => {
  it('passes type through unchanged (pending stays pending, NOT mapped to issue)', () => {
    const legacy = adaptGcdrToLegacyAnnotation(makeGcdrAnnotation({ type: 'pending' }));
    expect(legacy.type).toBe('pending');
  });

  it('passes type through unchanged (activity stays activity, NOT mapped to alert)', () => {
    const legacy = adaptGcdrToLegacyAnnotation(makeGcdrAnnotation({ type: 'activity' }));
    expect(legacy.type).toBe('activity');
  });

  it('passes status through unchanged (created/modified/archived match on both sides)', () => {
    for (const status of ['created', 'modified', 'archived'] as const) {
      const legacy = adaptGcdrToLegacyAnnotation(makeGcdrAnnotation({ status }));
      expect(legacy.status).toBe(status);
    }
  });

  it('maps direct fields (id, version, text, importance, createdAt)', () => {
    const legacy = adaptGcdrToLegacyAnnotation(makeGcdrAnnotation());
    expect(legacy).toMatchObject({
      id: 'ann-1',
      version: 2,
      text: 'sample text',
      importance: 4,
      createdAt: '2026-05-01T00:00:00.000Z',
    });
  });

  it('maps createdBy from the actor snapshot', () => {
    const legacy = adaptGcdrToLegacyAnnotation(makeGcdrAnnotation({ createdBy: { id: 'u9', email: 'x@y.com', name: 'X Y' } }));
    expect(legacy.createdBy).toEqual({ id: 'u9', email: 'x@y.com', name: 'X Y' });
  });

  it('defaults createdBy fields to empty strings when the actor snapshot is null', () => {
    const legacy = adaptGcdrToLegacyAnnotation(makeGcdrAnnotation({ createdBy: { id: null, email: null, name: null } }));
    expect(legacy.createdBy).toEqual({ id: '', email: '', name: '' });
  });

  it('always sets acknowledged=false (deprecated field, GCDR has no equivalent)', () => {
    const legacy = adaptGcdrToLegacyAnnotation(makeGcdrAnnotation());
    expect(legacy.acknowledged).toBe(false);
  });

  it('omits dueDate when GCDR dueDate is null', () => {
    const legacy = adaptGcdrToLegacyAnnotation(makeGcdrAnnotation({ dueDate: null }));
    expect(legacy.dueDate).toBeUndefined();
  });

  it('includes dueDate when present', () => {
    const legacy = adaptGcdrToLegacyAnnotation(makeGcdrAnnotation({ dueDate: '2026-06-01T00:00:00.000Z' }));
    expect(legacy.dueDate).toBe('2026-06-01T00:00:00.000Z');
  });

  it('list-shaped input (no responses/events) yields empty responses/history', () => {
    const legacy = adaptGcdrToLegacyAnnotation(makeGcdrAnnotation());
    expect(legacy.responses).toEqual([]);
    expect(legacy.history).toEqual([]);
  });

  it('detail-shaped input populates responses from GCDR responses[]', () => {
    const detail: GcdrAnnotationDetail = {
      ...makeGcdrAnnotation(),
      responses: [
        {
          id: 'resp-1',
          annotationId: 'ann-1',
          type: 'approved',
          text: null,
          createdBy: { id: 'u2', email: 'c@d.com', name: 'C D' },
          createdAt: '2026-05-03T00:00:00.000Z',
        },
      ],
      events: [],
      mentions: [],
      attachments: [],
    };
    const legacy = adaptGcdrToLegacyAnnotation(detail);
    expect(legacy.responses).toEqual([
      {
        id: 'resp-1',
        annotationId: 'ann-1',
        type: 'approved',
        text: '',
        createdAt: '2026-05-03T00:00:00.000Z',
        createdBy: { id: 'u2', email: 'c@d.com', name: 'C D' },
      },
    ]);
  });

  it('detail-shaped input populates history from GCDR events[] (action values match verbatim)', () => {
    const detail: GcdrAnnotationDetail = {
      ...makeGcdrAnnotation(),
      responses: [],
      events: [
        {
          id: 'ev-1',
          annotationId: 'ann-1',
          responseId: null,
          action: 'approved',
          previousVersion: 1,
          changes: { importance: { from: 3, to: 4 } },
          actor: { id: 'u3', email: 'e@f.com', name: 'E F' },
          createdAt: '2026-05-04T00:00:00.000Z',
        },
      ],
      mentions: [],
      attachments: [],
    };
    const legacy = adaptGcdrToLegacyAnnotation(detail);
    expect(legacy.history).toEqual([
      {
        timestamp: '2026-05-04T00:00:00.000Z',
        userId: 'u3',
        userName: 'E F',
        userEmail: 'e@f.com',
        action: 'approved',
        previousVersion: 1,
        changes: { importance: { from: 3, to: 4 } },
      },
    ]);
  });

  it('ignores unknown/extra fields on the GCDR object', () => {
    const withExtra = { ...makeGcdrAnnotation(), someFutureField: 'ignore-me' } as GcdrAnnotation & { someFutureField: string };
    const legacy = adaptGcdrToLegacyAnnotation(withExtra);
    expect((legacy as unknown as Record<string, unknown>).someFutureField).toBeUndefined();
  });
});

describe('adaptLegacyToGcdrInput', () => {
  it('builds a CreateAnnotationRequest-shaped input from a draft + entity context', () => {
    const input = adaptLegacyToGcdrInput(
      { text: 'new note', type: 'observation', importance: 3 },
      { entityType: 'device', entityId: 'device-9', customerId: 'cust-9' }
    );
    expect(input).toEqual({
      entityType: 'device',
      entityId: 'device-9',
      customerId: 'cust-9',
      text: 'new note',
      type: 'observation',
      importance: 3,
    });
  });

  it('includes dueDate only when provided', () => {
    const input = adaptLegacyToGcdrInput(
      { text: 'note', type: 'pending', importance: 5, dueDate: '2026-07-01T00:00:00.000Z' },
      { entityType: 'device', entityId: 'device-1', customerId: 'cust-1' }
    );
    expect(input.dueDate).toBe('2026-07-01T00:00:00.000Z');
  });

  it('includes mentions only when a non-empty array is provided', () => {
    const withMentions = adaptLegacyToGcdrInput(
      { text: 'note', type: 'observation', importance: 3 },
      { entityType: 'device', entityId: 'device-1', customerId: 'cust-1' },
      [{ mentionType: 'user', mentionedUserId: 'u1' }]
    );
    expect(withMentions.mentions).toEqual([{ mentionType: 'user', mentionedUserId: 'u1' }]);

    const withoutMentions = adaptLegacyToGcdrInput(
      { text: 'note', type: 'observation', importance: 3 },
      { entityType: 'device', entityId: 'device-1', customerId: 'cust-1' },
      []
    );
    expect(withoutMentions.mentions).toBeUndefined();
  });
});
