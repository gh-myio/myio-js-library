/**
 * RFC-0238 — presentation state of a job (client-only, never written to TB), resend rules and
 * audit reconciliation, following GCDR's adapter rules (RFC-0075 §5: L-1, L-2, L-12, L-13, L-16, L-19).
 */
import type { AuditEvent, BatchResult, DemandReportEnvelope, GcdrJobView } from './types';

/** What the panel knows about a job from GCDR. */
export type JobKnowledge = { found: true; job: GcdrJobView } | { found: false } | { queryError: string };

export type JobViewState =
  | 'loading'
  | 'sending'
  | 'send_uncertain'
  | 'not_received'
  | 'query_unavailable'
  | 'rejected'
  | 'old_request'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'result_expired'
  | 'purged'
  | 'failed'
  | 'cancelled';

export interface JobViewInput {
  envelope: DemandReportEnvelope;
  knowledge: JobKnowledge | undefined;
  now: number;
  inflight: boolean;
  /** Last send ended without a response (timeout / network / 5xx). */
  uncertain: boolean;
  /** Read-after-write grace before "not found" means "not received". */
  graceMs: number;
  /** Library resend window (O-17, default 7 days) — measured from the envelope (L-13). */
  idempotencyWindowMs: number;
}

export interface JobView {
  state: JobViewState;
  job?: GcdrJobView;
  /** For `rejected`: the code / reason of the last rejected submit/resend. */
  code?: string;
  reason?: string;
  message?: string;
  /** Resending the stored jobId/body is allowed (the UI re-validates first — L-19). */
  canResend: boolean;
}

export const JOB_STATE_LABEL: Readonly<Record<JobViewState, string>> = {
  loading: 'Consultando…',
  sending: 'Enviando…',
  send_uncertain: 'Confirmando envio…',
  not_received: 'Não enviado',
  query_unavailable: 'Status indisponível',
  rejected: 'Recusado',
  old_request: 'Pedido antigo',
  queued: 'Na fila',
  running: 'Processando',
  succeeded: 'Concluído',
  result_expired: 'Expirado',
  purged: 'Conteúdo removido',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

function lastSendEvent(e: DemandReportEnvelope): AuditEvent | undefined {
  for (let i = e.audit.length - 1; i >= 0; i--) {
    const a = e.audit[i];
    if ((a.op === 'submit' || a.op === 'resend') && a.outcome !== 'requested') return a;
  }
  return undefined;
}

/**
 * Derives the presentation state. Rules:
 * - a job that exists in GCDR always wins (any status), over any local `rejected` event (L-19);
 * - `resultAvailability` is the single download rule: expired → "Expirado", purged → "Conteúdo
 *   removido" (L-1);
 * - a received rejection is terminal: 422/409 never offer resend; 429 may, inside the window;
 * - only "not found" (JOB_NOT_FOUND / batch `notFound[]`) means not received (L-2) — inside the
 *   grace period it is still "sending", inside the resend window "Não enviado", after it "Pedido
 *   antigo" (L-13);
 * - a query failure is "Status indisponível" and never triggers a resend (L-16).
 */
export function deriveJobView(i: JobViewInput): JobView {
  const age = i.now - Date.parse(i.envelope.requestedAt);
  const inWindow = age < i.idempotencyWindowMs;
  if (i.inflight) return { state: 'sending', canResend: false };
  const k = i.knowledge;
  if (k && 'found' in k && k.found) {
    const job = k.job;
    if (job.resultAvailability === 'purged') return { state: 'purged', job, canResend: false };
    if (job.status === 'expired' || job.resultAvailability === 'expired') return { state: 'result_expired', job, canResend: false };
    return { state: job.status as JobViewState, job, canResend: false };
  }
  const last = lastSendEvent(i.envelope);
  if (last && last.outcome === 'rejected') {
    return {
      state: 'rejected',
      code: last.code,
      reason: last.reason,
      message: last.message,
      canResend: last.code === 'ACTIVE_JOBS_LIMIT' && inWindow,
    };
  }
  if (k && 'queryError' in k) return { state: 'query_unavailable', canResend: false };
  if (!k) return { state: 'loading', canResend: false };
  if (!inWindow) return { state: 'old_request', canResend: false };
  if (age < i.graceMs) return { state: i.uncertain ? 'send_uncertain' : 'sending', canResend: i.uncertain };
  return { state: 'not_received', canResend: true };
}

/** States that keep the job in the polling set. */
export function needsPolling(state: JobViewState): boolean {
  return state === 'queued' || state === 'running' || state === 'sending' || state === 'send_uncertain' || state === 'loading';
}

/**
 * Merges a batchGet into the known map. A "not found" after GCDR already confirmed the job is a
 * read-after-write lag and does not downgrade the last confirmed view.
 */
export function mergeBatch(known: Map<string, JobKnowledge>, results: BatchResult[]): void {
  for (const r of results) {
    const prev = known.get(r.jobId);
    if (!r.found && prev && 'found' in prev && prev.found) continue;
    known.set(r.jobId, r.found ? { found: true, job: r.job } : { found: false });
  }
}

/**
 * Audit events GCDR can prove and that may have been lost (best effort, no compare-and-set):
 * an accepted submit (the job exists) and an accepted cancel. The canceller is the DECLARED
 * identity only — never invented (L-12). Rejections and resend attempts cannot be rebuilt.
 */
export function reconciliationEvents(e: DemandReportEnvelope, job: GcdrJobView): AuditEvent[] {
  const out: AuditEvent[] = [];
  if (!e.audit.some((a) => (a.op === 'submit' || a.op === 'resend' || a.op === 'reused') && a.outcome === 'accepted')) {
    out.push({ op: 'submit', outcome: 'accepted', at: job.createdAt, by: e.requestedBy.tbUserId, source: 'reconciled' });
  }
  if (job.status === 'cancelled' && job.cancelledAt && !e.audit.some((a) => a.op === 'cancel' && a.outcome === 'accepted')) {
    out.push({ op: 'cancel', outcome: 'accepted', at: job.cancelledAt, by: job.cancelledBy?.declared?.userId || 'desconhecido', source: 'reconciled' });
  }
  return out;
}

/** Response classification for a send: 0 / 5xx = uncertain (retry with the same jobId), others = answered. */
export function isUncertainStatus(status: number): boolean {
  return status === 0 || status >= 500;
}

/** pt-BR text of a `VALIDATION_FAILED` reason (RFC-0075 §4.2.10). */
const REASON_TEXT: Readonly<Record<string, string>> = {
  SHAPE: 'O pedido tem um formato inválido.',
  REQUEST_HASH_MISMATCH: 'O conteúdo do pedido não confere — contate o suporte.',
  CATALOG_VERSION_UNSUPPORTED: 'A lista de telemetrias mudou — atualize o painel.',
  UNKNOWN_TELEMETRY: 'Há uma telemetria que o servidor não conhece.',
  TELEMETRY_DUPLICATE: 'Há telemetrias repetidas.',
  PERIOD_TOO_LONG: 'O período é longo demais para este intervalo.',
  PERIOD_NOT_ALIGNED: 'Com intervalos de 1 dia, o início precisa ser à meia-noite.',
  PERIOD_INVALID: 'O período é inválido.',
  DEVICE_NOT_IN_CUSTOMER: 'Um dos medidores não pertence a este cliente.',
  DEVICE_NOT_ENERGY: 'Um dos dispositivos não é um medidor de energia.',
  DEVICE_NO_SOURCE: 'Um dos medidores não tem fonte de dados para as telemetrias escolhidas.',
  POINTS_LIMIT: 'O relatório ficaria grande demais — reduza medidores, telemetrias ou período.',
  NO_DATA_IN_PERIOD: 'Não há dados no período escolhido.',
  VISIBILITY_REQUIRES_VERIFIED_IDENTITY: '“Somente eu” ainda não está disponível.',
};

/** Plain-language message for a rejection (pt-BR), from `code` + `details.reason`. */
export function rejectionText(code: string | undefined, reason?: string, message?: string, details?: unknown): string {
  switch (code) {
    case 'VALIDATION_FAILED':
      return (reason && REASON_TEXT[reason]) || message || 'O pedido não passou na validação.';
    case 'ACTIVE_JOBS_LIMIT': {
      const d = (details || {}) as { limit?: string; max?: number };
      const who: Record<string, string> = {
        user: 'seus relatórios em andamento',
        customer: 'relatórios em andamento do cliente',
        tenant: 'relatórios em andamento da plataforma',
        day: 'relatórios gerados hoje',
      };
      return d.limit ? `Limite atingido: ${who[d.limit] || d.limit}${d.max ? ` (máx. ${d.max})` : ''}.` : 'Limite de relatórios atingido.';
    }
    case 'FORBIDDEN':
      return 'Sem permissão para pedir relatórios.';
    case 'UNAUTHORIZED':
      return /reports:write/.test(message || '')
        ? 'A credencial do dashboard não tem permissão para pedir relatórios (escopo reports:write) — contate o suporte.'
        : 'Credencial do dashboard ausente ou inválida para relatórios — contate o suporte.';
    case 'JOB_ID_CONFLICT':
      return 'Este pedido já existe com outro conteúdo — use “Duplicar e editar”.';
    case 'RATE_LIMITED':
      return 'Muitas requisições — tente de novo em instantes.';
    default:
      return message || code || 'Pedido recusado.';
  }
}

/** pt-BR text of an execution failure (`error.code`, RFC-0075 §4.2.10). */
export function failureText(code: string | undefined): string {
  switch (code) {
    case 'SOURCE_UNAVAILABLE':
      return 'A fonte de dados ficou indisponível durante a geração.';
    case 'TIMEOUT':
      return 'A geração demorou além do limite.';
    case 'INTERRUPTED':
    case 'WORKER_LOST':
      return 'A geração foi interrompida.';
    case 'STALE':
      return 'O pedido ficou tempo demais na fila.';
    case 'DEVICE_GONE':
      return 'Um dos medidores não existe mais.';
    case 'RESULT_TOO_LARGE':
    case 'XLSX_ROW_LIMIT':
      return 'O resultado ficou grande demais — reduza o período ou os medidores.';
    case 'CONFIGURATION':
      return 'Falha de configuração no servidor — contate o suporte.';
    default:
      return 'Não foi possível gerar o relatório.';
  }
}
