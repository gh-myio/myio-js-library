/**
 * ED-1412 (épico ED-1409 / GCDR G-1) — AnnotationsTab renders server-created
 * `system` annotations as read-only.
 *
 * Covers the acceptance criteria:
 *   - `system` card shows the "Sistema" badge, color and icon, plus importance
 *   - no write actions (edit / archive / approve / reject / comment) — only history
 *   - "de → para" read from meta.from / meta.to, HTML-escaped
 *   - "Sistema" is never offered in the new-annotation form
 *   - type filter works with "Sistema"
 *
 * Permissions use SuperAdmin MYIO on purpose: even an admin cannot modify
 * a `system` annotation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnotationsTab } from '../../../src/components/premium-modals/settings/annotations/AnnotationsTab';
import type { Annotation, UserInfo } from '../../../src/components/premium-modals/settings/annotations/types';

const ADMIN: UserInfo = { id: 'admin-1', email: 'admin@example.com', name: 'Admin User' };
const SYSTEM_USER: UserInfo = { id: 'system', email: '', name: 'Sistema' };
const SYSTEM_COLOR = '#607D8B';
const WRITE_ACTIONS = ['edit', 'archive', 'approve', 'reject', 'comment'];

function makeAnnotation(over: Partial<Annotation>): Annotation {
  return {
    id: 'ann-1',
    version: 1,
    text: 'sample text',
    type: 'observation',
    importance: 3,
    status: 'created',
    createdAt: '2026-05-01T10:00:00.000Z',
    createdBy: ADMIN,
    acknowledged: false,
    responses: [],
    history: [],
    ...over,
  };
}

const systemWithMeta = makeAnnotation({
  id: 'sys-1',
  type: 'system',
  importance: 2,
  text: 'Limite de consumo atualizado automaticamente.',
  createdBy: SYSTEM_USER,
  meta: { field: 'consumptionLimit', from: 1200, to: 1500 },
});

const systemNoMeta = makeAnnotation({
  id: 'sys-2',
  type: 'system',
  importance: 1,
  text: 'Dispositivo sincronizado automaticamente.',
  createdBy: { id: 'system', email: '', name: '' },
});

const pending = makeAnnotation({ id: 'pend-1', type: 'pending', importance: 4, text: 'Verificar medidor' });

function installFetch(annotations: Annotation[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(
        JSON.stringify([
          { key: 'log_annotations', value: { schemaVersion: '1.0.0', deviceId: 'dev-1', annotations } },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
  );
}

async function mountTab(annotations: Annotation[]) {
  installFetch(annotations);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const tab = new AnnotationsTab({
    container,
    deviceId: 'dev-1',
    jwtToken: 'jwt',
    tbBaseUrl: '',
    currentUser: ADMIN,
    permissions: { isSuperAdminMyio: true, isSuperAdminHolding: false, currentUser: ADMIN },
  });
  await tab.init();
  return { tab, container };
}

function card(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`.annotation-card[data-id="${id}"]`);
  if (!el) throw new Error(`card ${id} not rendered`);
  return el;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AnnotationsTab — system type card (ED-1412)', () => {
  it('renders the "Sistema" badge with its own color and icon, plus importance', async () => {
    const { container } = await mountTab([systemWithMeta, pending]);
    const el = card(container, 'sys-1');

    expect(el.classList.contains('annotation-card--system')).toBe(true);
    const badge = el.querySelector<HTMLElement>('.annotation-card__type')!;
    expect(badge.textContent).toContain('Sistema');
    expect(badge.textContent).toContain('⚙️');
    expect(badge.getAttribute('style')).toContain(SYSTEM_COLOR);
    expect(el.querySelector('.annotation-card__importance')?.textContent?.trim()).toBe('Baixa');
  });

  it('renders no write actions — only the history button and a read-only hint', async () => {
    const { container } = await mountTab([systemWithMeta]);
    const el = card(container, 'sys-1');

    for (const action of WRITE_ACTIONS) {
      expect(el.querySelector(`[data-action="${action}"]`), action).toBeNull();
    }
    expect(el.querySelector('[data-action="details"]')).not.toBeNull();
    expect(el.querySelector('.annotation-card__readonly')?.textContent).toContain('Somente leitura');
  });

  it('keeps every action on non-system cards (regression)', async () => {
    const { container } = await mountTab([systemWithMeta, pending]);
    const el = card(container, 'pend-1');

    expect(el.classList.contains('annotation-card--system')).toBe(false);
    for (const action of [...WRITE_ACTIONS, 'details']) {
      expect(el.querySelector(`[data-action="${action}"]`), action).not.toBeNull();
    }
    expect(el.querySelector('.annotation-card__readonly')).toBeNull();
  });

  it('highlights "de → para" from meta.from / meta.to', async () => {
    const { container } = await mountTab([systemWithMeta]);
    const change = card(container, 'sys-1').querySelector('.annotation-card__change')!;

    expect(change).not.toBeNull();
    expect(change.querySelector('.annotation-card__change-from')?.textContent).toBe('1200');
    expect(change.querySelector('.annotation-card__change-to')?.textContent).toBe('1500');
    expect(change.textContent).toContain('→');
  });

  it('omits the change block when there is no meta, and falls back to "Sistema" as author', async () => {
    const { container } = await mountTab([systemNoMeta]);
    const el = card(container, 'sys-2');

    expect(el.querySelector('.annotation-card__change')).toBeNull();
    expect(el.querySelector('.annotation-card__author')?.textContent).toContain('Sistema');
  });

  it('HTML-escapes meta values', async () => {
    const payload = '<img src=x onerror="alert(1)">';
    const { container } = await mountTab([
      makeAnnotation({ id: 'sys-x', type: 'system', createdBy: SYSTEM_USER, meta: { from: payload, to: { a: 1 } } }),
    ]);
    const change = card(container, 'sys-x').querySelector('.annotation-card__change')!;

    expect(change.querySelector('img')).toBeNull();
    expect(change.querySelector('.annotation-card__change-from')?.textContent).toBe(payload);
    expect(change.querySelector('.annotation-card__change-to')?.textContent).toBe('{"a":1}');
  });

  it('shows the change and no archive button in the detail modal', async () => {
    const { container } = await mountTab([systemWithMeta]);
    card(container, 'sys-1').querySelector<HTMLElement>('[data-action="details"]')!.click();

    const modal = document.querySelector<HTMLElement>('.annotation-detail-overlay')!;
    expect(modal).not.toBeNull();
    expect(modal.querySelector('[data-action="archive"]')).toBeNull();
    expect(modal.querySelector('.annotation-card__change-to')?.textContent).toBe('1500');
    expect(modal.textContent).toContain('Sistema');
  });

  it('ignores write entry points for system annotations (defense in depth)', async () => {
    const { tab } = await mountTab([systemWithMeta, pending]);
    const t = tab as unknown as {
      openResponseModal: (id: string, type: string) => void;
      showEditModal: (id: string) => Promise<void>;
    };

    for (const type of ['archived', 'approved', 'rejected', 'comment']) {
      t.openResponseModal('sys-1', type);
    }
    void t.showEditModal('sys-1');
    await flush();
    expect(document.querySelector('.response-modal-overlay')).toBeNull();
    expect(document.querySelector('.annotations-input-overlay')).toBeNull();

    // sanity: the same entry point does open for a regular annotation
    t.openResponseModal('pend-1', 'comment');
    expect(document.querySelector('.response-modal-overlay')).not.toBeNull();
  });
});

describe('AnnotationsTab — new annotation form (ED-1412)', () => {
  it('never offers "Sistema" as a type option', async () => {
    const { container } = await mountTab([systemWithMeta]);
    container.querySelector<HTMLElement>('#grid-create-btn')!.click();
    await flush();

    const selector = document.querySelector('#new-annotation-type-selector')!;
    expect(selector).not.toBeNull();
    expect(selector.querySelector('[data-type="system"]')).toBeNull();
    expect(
      Array.from(selector.querySelectorAll<HTMLElement>('.type-option')).map((o) => o.dataset.type)
    ).toEqual(['pending', 'maintenance', 'activity', 'observation']);
  });
});

describe('AnnotationsTab — type filter with "Sistema" (ED-1412)', () => {
  it('offers a "Sistema" chip with the count and filters the grid to system cards', async () => {
    const { container } = await mountTab([systemWithMeta, systemNoMeta, pending]);
    expect(container.querySelectorAll('.annotation-card')).toHaveLength(3);

    container.querySelector<HTMLElement>('#open-filter-modal')!.click();
    const chip = document.querySelector<HTMLElement>('.annotations-filter-modal-overlay [data-filter-type="system"]')!;
    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain('Sistema');
    expect(chip.querySelector('.annotations-premium-filter__stat-count')?.textContent).toBe('2');

    chip.click();

    const cards = Array.from(container.querySelectorAll<HTMLElement>('.annotation-card'));
    expect(cards.map((c) => c.dataset.id).sort()).toEqual(['sys-1', 'sys-2']);
    expect(cards.every((c) => c.classList.contains('annotation-card--system'))).toBe(true);
  });
});

describe('AnnotationsTab — anotações Sistema vindas do GCDR (ED-1413)', () => {
  const GCDR_SYSTEM = {
    id: 'g-sys-1',
    version: 1,
    customerId: 'cust-1',
    entityType: 'device',
    entityId: 'gcdr-dev-1',
    text: 'Etiqueta do dispositivo alterada.',
    type: 'system',
    importance: 4,
    finalized: false,
    createdAt: '2026-11-25T10:00:00.000Z',
    createdBy: { id: 'u-1', email: 'operador@example.com', name: 'Operador' },
    meta: { field: 'label', from: 'OUTBACK', to: 'NOVA LOJA' },
  };

  async function mountWithGcdr(tbAnnotations: Annotation[], gcdr: () => Promise<Response>) {
    installFetch(tbAnnotations);
    const gcdrFetch = vi.fn(async () => gcdr());
    const container = document.createElement('div');
    document.body.appendChild(container);
    const tab = new AnnotationsTab({
      container,
      deviceId: 'dev-1',
      jwtToken: 'jwt',
      tbBaseUrl: '',
      currentUser: ADMIN,
      permissions: { isSuperAdminMyio: true, isSuperAdminHolding: false, currentUser: ADMIN },
      gcdrSystem: {
        gcdrDeviceId: 'gcdr-dev-1',
        domainPath: 'https://gcdr.test/api/v1',
        apiKey: 'gcdr_cust_KEY',
        tenantId: 'tenant-1',
        fetchImpl: gcdrFetch as unknown as typeof fetch,
      },
    });
    await tab.init();
    return { tab, container, gcdrFetch };
  }

  const okList = (items: unknown[]) => async () =>
    new Response(JSON.stringify({ data: items, pagination: { page: 1, limit: 100, hasNext: false } }), { status: 200 });

  it('lista as Sistema do device no GCDR com X-API-Key/X-Tenant-ID e as exibe com de→para, data e autor', async () => {
    const { container, gcdrFetch, tab } = await mountWithGcdr([pending], okList([GCDR_SYSTEM]));

    const [url, init] = gcdrFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('https://gcdr.test/api/v1/annotations?');
    expect(url).toContain('entityType=device');
    expect(url).toContain('entityId=gcdr-dev-1');
    expect(url).toContain('type=system');
    const headers = init.headers as Headers;
    expect(headers.get('X-API-Key')).toBe('gcdr_cust_KEY');
    expect(headers.get('X-Tenant-ID')).toBe('tenant-1');

    const el = card(container, 'g-sys-1');
    expect(el.classList.contains('annotation-card--system')).toBe(true);
    expect(el.querySelector('.annotation-card__change-from')?.textContent).toBe('OUTBACK');
    expect(el.querySelector('.annotation-card__change-to')?.textContent).toBe('NOVA LOJA');
    expect(el.querySelector('.annotation-card__author')?.textContent).toContain('Operador');
    expect(el.querySelector('.annotation-card__date')?.textContent).not.toBe('-');
    for (const action of WRITE_ACTIONS) expect(el.querySelector(`[data-action="${action}"]`)).toBeNull();
    expect(tab.getActiveCount()).toBe(2);
  });

  it('as Sistema do GCDR nunca são gravadas no log_annotations do TB', async () => {
    const { tab } = await mountWithGcdr([pending], okList([GCDR_SYSTEM]));
    const tbFetch = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    tbFetch.mockClear();

    await (tab as unknown as { addAnnotation: (d: unknown) => Promise<void> }).addAnnotation({
      text: 'Nova pendência',
      type: 'pending',
      importance: 3,
    });

    const post = tbFetch.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
    expect(post).toBeDefined();
    const saved = JSON.parse((post![1] as RequestInit).body as string).log_annotations.annotations as Annotation[];
    expect(saved.map((a) => a.id)).toContain('pend-1');
    expect(saved.map((a) => a.id)).not.toContain('g-sys-1');
    expect(saved).toHaveLength(2);
  });

  it('falha no GCDR mantém as anotações do TB e só avisa no console', async () => {
    const { container } = await mountWithGcdr([pending], async () => new Response('{}', { status: 403 }));

    expect(container.querySelector('.annotation-card[data-id="pend-1"]')).not.toBeNull();
    expect(container.querySelectorAll('.annotation-card')).toHaveLength(1);
    expect((console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls.some((c) => String(c[0]).includes('ED-1413'))).toBe(true);
  });

  it('a lista do TB aparece antes de o GCDR responder (GCDR lento não atrasa a aba)', async () => {
    let release!: (r: Response) => void;
    const gcdrPending = new Promise<Response>((r) => (release = r));
    installFetch([pending]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const tab = new AnnotationsTab({
      container,
      deviceId: 'dev-1',
      jwtToken: 'jwt',
      currentUser: ADMIN,
      permissions: { isSuperAdminMyio: true, isSuperAdminHolding: false, currentUser: ADMIN },
      gcdrSystem: {
        gcdrDeviceId: 'gcdr-dev-1',
        domainPath: 'https://gcdr.test/api/v1',
        apiKey: 'gcdr_cust_KEY',
        fetchImpl: (() => gcdrPending) as unknown as typeof fetch,
      },
    });
    const initDone = tab.init();
    await vi.waitFor(() => expect(container.querySelector('.annotation-card[data-id="pend-1"]')).not.toBeNull());
    expect(container.querySelector('.annotation-card[data-id="g-sys-1"]')).toBeNull();

    release(new Response(JSON.stringify({ data: [GCDR_SYSTEM] }), { status: 200 }));
    await initDone;
    expect(container.querySelector('.annotation-card[data-id="g-sys-1"]')).not.toBeNull();
  });

  it('não duplica quando o mesmo id já veio do TB', async () => {
    const { container } = await mountWithGcdr([{ ...systemWithMeta, id: 'g-sys-1' }], okList([GCDR_SYSTEM]));
    expect(container.querySelectorAll('.annotation-card[data-id="g-sys-1"]')).toHaveLength(1);
  });
});
