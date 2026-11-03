/**
 * Cliente da API de importação do Ingestion (`/api/v1/import`, runbook TELEMETRY-SHEET-IMPORT §4):
 * validate → jobs (start) → jobs/:id (poll) → jobs/:id/cancel | jobs/:id/revert. Autenticação
 * Bearer com o escopo `telemetry.import` (token do client_credentials — `buildMyioIngestionAuth`).
 *
 * Mensagens de erro seguem a resposta do Ingestion de 03/11/2026
 * (`RESPOSTA-IMPORTACAO-PLANILHA-TELEMETRIA-2026-11-03.md` §4).
 */

import type { ImportDomain, ImportRow } from './sheet';

export interface TelemetryImportApiConfig {
  /** Base da API do Ingestion, ex.: https://api.data.apps.myio-bas.com/api/v1 */
  baseUrl: string;
  /** Token reaproveitado (o /auth aceita só 5 pedidos a cada 15 min por client) */
  getToken: () => Promise<string>;
  /**
   * Token novo, ignorando o cache — usado UMA vez após 401, ou 403 de escopo (um token emitido
   * antes de o client ganhar `telemetry.import` não carrega o escopo). Sem ele, não há retry.
   */
  refreshToken?: () => Promise<string>;
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

/** `reverting` é transitório (durante o revert): não é terminal. */
export type ImportJobStatus =
  | 'queued'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'reverting'
  | 'reverted'
  | string;

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
  /** Desfaz uma importação `completed`/`failed`: remove as horas e devolve as leituras apagadas */
  revertJob(jobId: string): Promise<ImportJob | null>;
}

/** Códigos de 409 (`error`) → texto. Alguns vêm em inglês na `message`. */
const CONFLICT_TEXT: Record<string, string> = {
  VALIDATION_EXPIRED: 'A validação expirou (vale 30 minutos). Valide a planilha de novo.',
  REAL_READINGS_PRESENT: 'Há leituras reais nessas horas. Confirme a substituição para importar.',
  NOT_CANCELLABLE: 'A importação já terminou e não pode ser cancelada. Use "Desfazer importação".',
  NOT_REVERTABLE: 'Esta importação não pode ser desfeita.',
  GATEWAY_BUSY: 'A central está ocupada com outra importação. Tente em instantes.',
};

/**
 * Status HTTP + corpo `{ error, message }` → mensagem para o usuário. `path` distingue o 404 do
 * validate (rota ausente no ambiente) do 404 de job (id inexistente).
 */
export function importErrorMessage(status: number, path: string, body: { error?: string; message?: string } | null): string {
  const code = String(body?.error || '');
  const apiMsg = String(body?.message || '');
  switch (status) {
    case 400:
      return apiMsg ? `Pedido recusado pela API: ${apiMsg}` : 'Pedido recusado pela API (400).';
    case 401:
      return 'Sessão da importação expirada. Feche esta janela e abra a importação de novo.';
    case 403:
      return /customer/i.test(apiMsg)
        ? 'Esta credencial não pode importar dados deste cliente.'
        : 'Sem permissão para importar telemetria: a credencial não tem o escopo telemetry.import.';
    case 404:
      return path === '/validate' ? 'A importação ainda não está disponível neste ambiente.' : 'Importação não encontrada.';
    case 409:
      return CONFLICT_TEXT[code] || apiMsg || 'Operação não permitida no estado atual da importação.';
    case 413:
      return 'Planilha grande demais para uma importação. Divida em partes de até 5.000 linhas.';
    case 429:
      return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
    default:
      return `Falha na API de importação (${status}).`;
  }
}

export function createTelemetryImportApi(cfg: TelemetryImportApiConfig): TelemetryImportApi {
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '');
  const doFetch = cfg.fetchImpl ?? fetch.bind(window);

  const send = async (method: string, path: string, token: string, body?: unknown) => {
    try {
      return await doFetch(`${base}/import${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      // CORS ausente, rede fora, DNS: o navegador só diz "Failed to fetch"
      throw new ImportApiError(
        'Não foi possível falar com a API de importação. Verifique a conexão e tente de novo.',
        0,
        `${method} /import${path} → ${String((err as Error)?.message || err)}`
      );
    }
  };

  const readJson = async (res: Response) => {
    const text = await res.text().catch(() => '');
    try {
      return { text, data: text ? JSON.parse(text) : null };
    } catch {
      return { text, data: null };
    }
  };

  const call = async (method: string, path: string, body?: unknown, accept422 = false) => {
    let res = await send(method, path, await cfg.getToken(), body);
    let parsed = await readJson(res);
    // Token vencido, ou emitido antes de o client ganhar o escopo: um token novo, uma vez só
    const scopeMissing = res.status === 403 && /scope/i.test(String(parsed.data?.message || ''));
    if ((res.status === 401 || scopeMissing) && cfg.refreshToken) {
      res = await send(method, path, await cfg.refreshToken(), body);
      parsed = await readJson(res);
    }
    const data = parsed.data;
    if (res.ok || (accept422 && res.status === 422)) return { status: res.status, data: data?.data ?? data };
    const msg = importErrorMessage(res.status, path.startsWith('/jobs') ? '/jobs' : path, data);
    const apiMsg = data?.message || data?.error || '';
    throw new ImportApiError(msg, res.status, `${method} /import${path} → ${res.status} ${String(apiMsg || parsed.text).slice(0, 200)}`);
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
    async revertJob(jobId) {
      const { data } = await call('POST', `/jobs/${encodeURIComponent(jobId)}/revert`);
      return data ? ({ jobId, ...data } as ImportJob) : null;
    },
  };
}
