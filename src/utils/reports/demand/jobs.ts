/**
 * RFC-0238 §4–§5 — presentation state of a job (client-only, never written to TB),
 * idempotent-retry rules and audit reconciliation.
 */
import type { AuditEvent, BatchResult, DemandReportEnvelopeV1, GcdrJobView } from './types';

/** What the panel knows about a job from GCDR. */
export type JobKnowledge = { found: true; job: GcdrJobView } | { found: false } | { queryError: string };

export type JobViewState =
  | 'loading'
  | 'sending'
  | 'send_uncertain'
  | 'not_received'
  | 'query_unavailable'
  | 'rejected'
  | 'expired'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'result_expired'
  | 'failed'
  | 'cancelled';

export interface JobViewInput {
  envelope: DemandReportEnvelopeV1;
  knowledge: JobKnowledge | undefined;
  now: number;
  inflight: boolean;
  /** Last send ended without a response (timeout / network / 5xx). */
  uncertain: boolean;
  /** Read-after-write grace before "not found" means "not received" (RFC: 2 min). */
  graceMs: number;
  /** Window in which GCDR guarantees idempotency for this jobId (Q5/O-17 — open). */
  idempotencyWindowMs: number;
}

export interface JobView {
  state: JobViewState;
  job?: GcdrJobView;
  /** For `rejected`: the code of the last rejected submit/resend. */
  code?: string;
  message?: string;
  /** Resending the same jobId/payload/hash is safe (inside the idempotency window). */
  canResend: boolean;
}

export const JOB_STATE_LABEL: Readonly<Record<JobViewState, string>> = {
  loading: 'Consultando…',
  sending: 'Enviando…',
  send_uncertain: 'Confirmando envio…',
  not_received: 'Não enviado',
  query_unavailable: 'Status indisponível',
  rejected: 'Recusado',
  expired: 'Prazo de reenvio expirado',
  queued: 'Na fila',
  running: 'Processando',
  succeeded: 'Concluído',
  result_expired: 'Arquivo expirado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

function lastSendEvent(e: DemandReportEnvelopeV1): AuditEvent | undefined {
  for (let i = e.audit.length - 1; i >= 0; i--) {
    const a = e.audit[i];
    if ((a.op === 'submit' || a.op === 'resend') && a.outcome !== 'requested') return a;
  }
  return undefined;
}

/**
 * Derives the presentation state. Rules:
 * - GCDR's answer wins (found → its status);
 * - a received rejection is shown as such (422 never offers resend; 429 may, once a slot frees);
 * - "not found" inside the grace period is still "sending"; after it, "not received";
 * - outside the idempotency window nothing is resent ("expired" → duplicate instead);
 * - a query failure never means "not found" — resending stays possible because it is idempotent.
 */
export function deriveJobView(i: JobViewInput): JobView {
  const age = i.now - Date.parse(i.envelope.requestedAt);
  const inWindow = age < i.idempotencyWindowMs;
  if (i.inflight) return { state: 'sending', canResend: false };
  const k = i.knowledge;
  if (k && 'found' in k && k.found) {
    const job = k.job;
    if (job.status === 'succeeded' && job.result && !job.result.available) return { state: 'result_expired', job, canResend: false };
    return { state: job.status, job, canResend: false };
  }
  const last = lastSendEvent(i.envelope);
  if (last && last.outcome === 'rejected') {
    return { state: 'rejected', code: last.code, message: last.message, canResend: last.code === 'ACTIVE_JOBS_LIMIT' && inWindow };
  }
  if (k && 'queryError' in k) return { state: 'query_unavailable', canResend: inWindow };
  if (!k) return { state: 'loading', canResend: false };
  if (!inWindow) return { state: 'expired', canResend: false };
  if (age < i.graceMs) return { state: i.uncertain ? 'send_uncertain' : 'sending', canResend: i.uncertain };
  return { state: 'not_received', canResend: true };
}

/** States that keep the job in the polling set. */
export function needsPolling(state: JobViewState): boolean {
  return state === 'queued' || state === 'running' || state === 'sending' || state === 'send_uncertain' || state === 'query_unavailable' || state === 'loading';
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
 * an accepted submit (the job exists) and an accepted cancel (`cancelledBy/At`).
 * Rejections and resend attempts cannot be rebuilt.
 */
export function reconciliationEvents(e: DemandReportEnvelopeV1, job: GcdrJobView): AuditEvent[] {
  const out: AuditEvent[] = [];
  if (!e.audit.some((a) => (a.op === 'submit' || a.op === 'resend') && a.outcome === 'accepted')) {
    out.push({ op: 'submit', outcome: 'accepted', at: job.createdAt, by: e.requestedBy.tbUserId, source: 'reconciled' });
  }
  if (job.status === 'cancelled' && job.cancelledAt && !e.audit.some((a) => a.op === 'cancel' && a.outcome === 'accepted')) {
    const cb = job.cancelledBy;
    out.push({ op: 'cancel', outcome: 'accepted', at: job.cancelledAt, by: cb?.declared?.tbUserId || cb?.principal || 'unknown', source: 'reconciled' });
  }
  return out;
}

/** Response classification for a send: 0 / 5xx = uncertain (retry with the same jobId), others = rejected. */
export function isUncertainStatus(status: number): boolean {
  return status === 0 || status >= 500;
}

/** Plain-language message for a rejection code (pt-BR). */
export function rejectionText(code: string | undefined, message?: string, activeLimit = 3): string {
  switch (code) {
    case 'VALIDATION_FAILED':
      return message || 'O pedido não passou na validação.';
    case 'HASH_MISMATCH':
      return 'O conteúdo do pedido não confere — contate o suporte.';
    case 'ACTIVE_JOBS_LIMIT':
      return `Limite de ${activeLimit} relatórios em andamento.`;
    case 'FORBIDDEN':
      return 'Sem permissão para pedir relatórios.';
    case 'JOB_ID_CONFLICT':
      return 'Conflito de identificador — contate o suporte.';
    case 'IDEMPOTENCY_WINDOW_EXPIRED':
      return 'O prazo para reenviar este pedido expirou.';
    default:
      return message || code || 'Pedido recusado.';
  }
}
