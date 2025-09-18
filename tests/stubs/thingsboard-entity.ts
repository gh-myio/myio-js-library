// Stub for ./thingsboard/entity module
// This file provides test-only implementations to prevent Vitest from failing
// when importing src/index.ts which re-exports from this missing module

// Type definitions for ThingsBoard entities
export interface TBEntityInfo {
  id: string;
  type: string;
  name: string;
  label?: string;
  additionalInfo?: Record<string, any>;
}

export interface TBFetchOptions {
  entityId?: string;
  entityType?: string;
  keys?: string[];
  timeout?: number;
  [key: string]: any;
}

// Stub implementation of getEntityInfoAndAttributesTB
export function getEntityInfoAndAttributesTB(options: TBFetchOptions = {}): Promise<TBEntityInfo> {
  return Promise.resolve({
    id: options.entityId || 'stub-entity-id',
    type: options.entityType || 'ASSET',
    name: 'Stub Entity',
    label: 'Stub Entity Label',
    additionalInfo: {}
  });
}

// Default export for compatibility
const defaultExport = {
  getEntityInfoAndAttributesTB
};

export default defaultExport;
