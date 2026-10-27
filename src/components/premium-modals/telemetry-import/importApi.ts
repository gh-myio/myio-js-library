/**
 * Cliente da API de importação do Ingestion (`/api/v1/import`, runbook TELEMETRY-SHEET-IMPORT §4):
 * validate → jobs (start) → jobs/:id (poll) → jobs/:id/cancel. Autenticação Bearer (token do
 * client_credentials do customer — `buildMyioIngestionAuth`).
 */

import type { ImportDomain, ImportRow } from './sheet';

export interface TelemetryImportApiConfig {
  /** Base da API do Ingestion, ex.: https://api.data.apps.myio-bas.com/api/v1 */
  baseUrl: string;
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export interface ImportPreview {
  targetSlots?: number;
  existingReadingsInTarget?: number;
  existingRealReadings?: number;
  totalValue?: number;
  period?: { start?: string; end?: string } | string;
  devices?: number | unknown[];
  sample?: unknown[];
}

export type ValidateResult =
  | { valid: true; validationId: string; expiresAt?: string; preview: ImportPreview }
  | { valid: false; invalidCount: number; errors: Array<{ line: number; reason: string }> };

export type ImportJobStatus = 'queued' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'reverted' | string;

export interface ImportJob {
  jobId?: string;
  status: ImportJobStatus;
  progress?: number;
  phase?: string;
  deleted?: number;
  inserted?: number;
  refreshStatus?: string;
  error?: string;
  errorCode?: string;
  startedAt?: string;
  completedAt?: string;
}

export const TERMINAL_JOB_STATUSES = ['completed', 'failed', 'cancelled', 'reverted'];

/** Erro HTTP com mensagem pronta para o usuário. */
export class ImportApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly detail?: string) {
    super(message);
    this.name = 'ImportApiError';
  }
}

export interface TelemetryImportApi {
  validate(body: { customerId: string; readingType: ImportDomain; rows: ImportRow[]; sourceRef?: string }): Promise<ValidateResult>;
  startJob(body: { validationId: string; confirmReplaceReal?: boolean }): Promise<{ jobId: string; status: ImportJobStatus }>;
  getJob(jobId: string): Promise<ImportJob>;
  cancelJob(jobId: string): Promise<ImportJob | null>;
}

export function createTelemetryImportApi(cfg: TelemetryImportApiConfig): TelemetryImportApi {
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '');
  const doFetch = cfg.fetchImpl ?? fetch.bind(window);

  const call = async (method: string, path: string, body?: unknown, accept422 = false) => {
    const token = await cfg.getToken();
    const res = await doFetch(`${base}/import${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (res.ok || (accept422 && res.status === 422)) return { status: res.status, data: data?.data ?? data };
    const apiMsg = data?.message || data?.error || '';
    const msg =
      res.status === 404
        ? 'A importação ainda não está disponível neste ambiente.'
        : res.status === 401 || res.status === 403
          ? 'Sem permissão para importar telemetria (credencial sem o escopo telemetry.import).'
          : res.status === 409
            ? apiMsg || 'Operação não permitida no estado atual da importação.'
            : `Falha na API de importação (${res.status}).`;
    throw new ImportApiError(msg, res.status, `${method} /import${path} → ${res.status} ${String(apiMsg || text).slice(0, 200)}`);
  };

  return {
    async validate(body) {
      const { status, data } = await call('POST', '/validate', body, true);
      if (status === 422 || data?.valid === false) {
        return { valid: false, invalidCount: Number(data?.invalidCount ?? data?.errors?.length ?? 0), errors: data?.errors || [] };
      }
      return { valid: true, validationId: data.validationId, expiresAt: data.expiresAt, preview: data.preview || {} };
    },
    async startJob(body) {
      const { data } = await call('POST', '/jobs', body);
      return { jobId: data.jobId, status: data.status || 'queued' };
    },
    async getJob(jobId) {
      const { data } = await call('GET', `/jobs/${encodeURIComponent(jobId)}`);
      return { jobId, ...(data || {}) } as ImportJob;
    },
    async cancelJob(jobId) {
      const { data } = await call('POST', `/jobs/${encodeURIComponent(jobId)}/cancel`);
      return data ? ({ jobId, ...data } as ImportJob) : null;
    },
  };
}
