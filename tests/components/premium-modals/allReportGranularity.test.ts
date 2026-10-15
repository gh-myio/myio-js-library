// AllReportModal — granularidade inicial: temperatura abre em 1h (todos / climatizável /
// não climatizável); energia e água seguem em 1d; param explícito sempre vence.
import { describe, it, expect } from 'vitest';
import { AllReportModal } from '../../../src/components/premium-modals/report-all/AllReportModal';

const api = { clientId: 'c', clientSecret: 's', dataApiBaseUrl: 'https://api.example.com' };
const initialGranularity = (params: Record<string, unknown>) =>
  (new AllReportModal({ customerId: 'cust-1', api, ...params } as any) as any).granularity;

describe('AllReportModal — granularidade inicial', () => {
  it('temperatura abre em 1h', () => {
    expect(initialGranularity({ domain: 'temperature', group: 'todos' })).toBe('1h');
    expect(initialGranularity({ domain: 'temperature', group: 'climatizavel' })).toBe('1h');
    expect(initialGranularity({ domain: 'temperature', group: 'nao_climatizavel' })).toBe('1h');
  });

  it('energia, água e domínio omitido abrem em 1d', () => {
    expect(initialGranularity({ domain: 'energy' })).toBe('1d');
    expect(initialGranularity({ domain: 'water' })).toBe('1d');
    expect(initialGranularity({})).toBe('1d');
  });

  it('param granularity explícito vence o default do domínio', () => {
    expect(initialGranularity({ domain: 'temperature', granularity: '1d' })).toBe('1d');
    expect(initialGranularity({ domain: 'energy', granularity: '1h' })).toBe('1h');
  });
});
