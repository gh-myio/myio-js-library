import { describe, it, expect, vi } from 'vitest';
import {
  generateCustomerCode,
  CUSTOMER_CODE_RE,
  isCustomerCode,
  CUSTOMER_NAME_STOPWORDS,
  slugifyCustomerName,
  checkCustomerCodeAvailable,
  pickUniqueCustomerCode,
  type CodeCheckConfig,
} from '../../src/utils/customer';

const PLATE = '[ABCDEFGHJKLMNPQRSTUVWXYZ]{3}[2-9][ABCDEFGHJKLMNPQRSTUVWXYZ][2-9]{2}';
const CODE_RE = new RegExp(`^C-${PLATE}-${PLATE}$`);

/** Build a fake fetch returning the given items array as the GCDR list payload. */
function fakeFetch(items: Array<{ code: string }>, envelope: 'items' | 'data.items' | 'data' = 'items') {
  let body: unknown;
  if (envelope === 'items') body = { items };
  else if (envelope === 'data.items') body = { data: { items } };
  else body = { data: items };
  return vi.fn(async () =>
    ({ ok: true, status: 200, json: async () => body } as unknown as Response)
  );
}

describe('generateCustomerCode', () => {
  it('always matches the C-<plate>-<plate> grammar', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateCustomerCode();
      expect(code).toMatch(CODE_RE);
      expect(code).toMatch(CUSTOMER_CODE_RE);
      expect(isCustomerCode(code)).toBe(true);
    }
  });

  it('never emits ambiguous glyphs (I, O, 0, 1) in the plates', () => {
    for (let i = 0; i < 1000; i++) {
      // strip the literal 'C-' prefix, then assert no ambiguous glyphs remain
      expect(generateCustomerCode().slice(2)).not.toMatch(/[IO01]/);
    }
  });

  it('produces varied output', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(generateCustomerCode());
    expect(seen.size).toBeGreaterThan(280);
  });
});

describe('isCustomerCode', () => {
  it('rejects malformed / non-string input', () => {
    expect(isCustomerCode('C-ABC1D23')).toBe(false); // single plate
    expect(isCustomerCode('A-XDN5R48-JQE6K43')).toBe(false); // wrong prefix
    expect(isCustomerCode('C-ABC1O23-JQE6K43')).toBe(false); // ambiguous O
    expect(isCustomerCode('')).toBe(false);
    expect(isCustomerCode(null)).toBe(false);
    expect(isCustomerCode(undefined)).toBe(false);
  });
});

describe('slugifyCustomerName', () => {
  it('strips diacritics, drops stopwords, upper-cases, 5-char tokens', () => {
    expect(slugifyCustomerName('Shopping Pátio Central')).toBe('SHOPP-PATIO-CENTR');
    expect(slugifyCustomerName('Central de Pré-Setup')).toBe('CENTR-PRESE');
  });

  it('drops registered stopwords (de/da/do/the/of/and/in...)', () => {
    expect(slugifyCustomerName('Banco do Brasil')).toBe('BANCO-BRASI');
    expect(slugifyCustomerName('Bank of America')).toBe('BANK-AMERI');
    expect(CUSTOMER_NAME_STOPWORDS.has('de')).toBe(true);
    expect(CUSTOMER_NAME_STOPWORDS.has('the')).toBe(true);
  });

  it('handles empty / whitespace input', () => {
    expect(slugifyCustomerName('')).toBe('');
    expect(slugifyCustomerName('   ')).toBe('');
  });

  it('accepts a custom stopword set', () => {
    const custom = new Set(['shopping']);
    expect(slugifyCustomerName('Shopping Center', custom)).toBe('CENTE');
  });
});

describe('checkCustomerCodeAvailable', () => {
  const cfg = (fetch: CodeCheckConfig['fetch']): CodeCheckConfig => ({
    baseUrl: 'https://gcdr.api.example/',
    token: 'tok',
    fetch,
  });

  it('returns true when no item carries the exact code', async () => {
    const fetch = fakeFetch([{ code: 'C-AAA2A22-BBB3B33' }]);
    expect(await checkCustomerCodeAvailable('C-XDN5R48-JQE6K43', cfg(fetch))).toBe(true);
  });

  it('returns false when an item carries the exact code', async () => {
    const fetch = fakeFetch([{ code: 'C-XDN5R48-JQE6K43' }]);
    expect(await checkCustomerCodeAvailable('C-XDN5R48-JQE6K43', cfg(fetch))).toBe(false);
  });

  it('tolerates all GCDR response envelopes', async () => {
    for (const env of ['items', 'data.items', 'data'] as const) {
      const taken = fakeFetch([{ code: 'C-XDN5R48-JQE6K43' }], env);
      expect(await checkCustomerCodeAvailable('C-XDN5R48-JQE6K43', cfg(taken))).toBe(false);
    }
  });

  it('builds the URL with a single slash and url-encodes the code', async () => {
    const fetch = fakeFetch([]);
    await checkCustomerCodeAvailable('C-XDN5R48-JQE6K43', cfg(fetch));
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://gcdr.api.example/customers?search=C-XDN5R48-JQE6K43');
  });

  it('sends the bearer token', async () => {
    const fetch = fakeFetch([]);
    await checkCustomerCodeAvailable('C-XDN5R48-JQE6K43', cfg(fetch));
    const opts = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('throws on non-2xx', async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 500 } as unknown as Response));
    await expect(checkCustomerCodeAvailable('C-XDN5R48-JQE6K43', cfg(fetch))).rejects.toThrow(/HTTP 500/);
  });
});

describe('pickUniqueCustomerCode', () => {
  it('returns the first code reported available', async () => {
    // first call: taken (echo same code), then available (empty)
    let call = 0;
    const fetch = vi.fn(async (url: string) => {
      call++;
      const code = decodeURIComponent(url.split('search=')[1]);
      const items = call === 1 ? [{ code }] : [];
      return { ok: true, status: 200, json: async () => ({ items }) } as unknown as Response;
    });
    const code = await pickUniqueCustomerCode({ baseUrl: 'https://x', fetch });
    expect(isCustomerCode(code)).toBe(true);
    expect(call).toBe(2);
  });

  it('throws after exhausting maxAttempts (all taken)', async () => {
    const fetch = vi.fn(async (url: string) => {
      const code = decodeURIComponent(url.split('search=')[1]);
      return { ok: true, status: 200, json: async () => ({ items: [{ code }] }) } as unknown as Response;
    });
    await expect(
      pickUniqueCustomerCode({ baseUrl: 'https://x', fetch, maxAttempts: 3 })
    ).rejects.toThrow(/no available code after 3 attempts/);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
