/**
 * RFC-0176: GCDR Sync Modal — ThingsBoard Data Fetcher
 * Fetches customer, assets, devices and server-scope attributes from TB REST API.
 */

import type { TBCustomer, TBAsset, TBDevice, TBServerScopeAttrs } from './types';

const TB_API_BASE = '';

// ============================================================================
// Individual fetch helpers
// ============================================================================

async function tbFetch<T>(path: string, jwt: string): Promise<T> {
  const response = await fetch(`${TB_API_BASE}${path}`, {
    headers: {
      'X-Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`TB API error (${response.status}) at ${path}: ${text}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetches a single TB customer by ID.
 */
export async function fetchCustomer(tbId: string, jwt: string): Promise<TBCustomer> {
  return tbFetch<TBCustomer>(`/api/customer/${tbId}`, jwt);
}

/**
 * Fetches all assets belonging to a customer.
 */
export async function fetchAssets(customerId: string, jwt: string): Promise<TBAsset[]> {
  interface PageData {
    data: TBAsset[];
    totalElements: number;
    hasNext: boolean;
  }

  const page = await tbFetch<PageData>(
    `/api/customer/${customerId}/assets?pageSize=1000&page=0`,
    jwt,
  );
  return page.data ?? [];
}

/**
 * Fetches all devices belonging to a customer.
 */
export async function fetchDevices(customerId: string, jwt: string): Promise<TBDevice[]> {
  interface PageData {
    data: TBDevice[];
    totalElements: number;
    hasNext: boolean;
  }

  const page = await tbFetch<PageData>(
    `/api/customer/${customerId}/devices?pageSize=1000&page=0`,
    jwt,
  );
  return page.data ?? [];
}

/**
 * Fetches SERVER_SCOPE attributes for a single entity.
 * Returns a flat key→value map.
 */
export async function fetchServerScopeAttrs(
  entityType: 'CUSTOMER' | 'ASSET' | 'DEVICE',
  entityId: string,
  jwt: string,
): Promise<TBServerScopeAttrs> {
  interface RawAttr {
    key: string;
    value: unknown;
    lastUpdateTs?: number;
  }

  let attrs: RawAttr[] = [];
  try {
    attrs = await tbFetch<RawAttr[]>(
      `/api/plugins/telemetry/${entityType}/${entityId}/values/attributes/SERVER_SCOPE`,
      jwt,
    );
  } catch {
    // Entity may have no attributes — return empty map
    return {};
  }

  const map: TBServerScopeAttrs = {};
  for (const attr of attrs) {
    map[attr.key] = attr.value;
  }
  return map;
}

// ============================================================================
// Batched parallel fetch
// ============================================================================

/**
 * Fetches SERVER_SCOPE attributes for multiple entities in parallel,
 * with a concurrency limit.
 */
export async function fetchServerScopeAttrsBatch(
  items: Array<{ entityType: 'CUSTOMER' | 'ASSET' | 'DEVICE'; entityId: string }>,
  jwt: string,
  concurrency = 5,
): Promise<Map<string, TBServerScopeAttrs>> {
  const result = new Map<string, TBServerScopeAttrs>();
  const queue = [...items];

  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const attrs = await fetchServerScopeAttrs(item.entityType, item.entityId, jwt);
      result.set(item.entityId, attrs);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return result;
}
