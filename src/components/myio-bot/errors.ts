/**
 * RFC-0242 — the one error class of the bot SDK. Every failure (HTTP envelope,
 * SSE `error` event, transport, timeout, widget loader) surfaces as a
 * `MyIOBotError` carrying the API code, so hosts branch on `code`, never on text.
 *
 * Codes produced by the client itself (the rest come from GCDR):
 * - `NETWORK_ERROR`      fetch rejected (offline, DNS, CORS / origin not in ALLOWED_ORIGINS)
 * - `TIMEOUT`            no answer within `timeoutMs`
 * - `ABORTED`            the caller's AbortSignal fired
 * - `HTTP_<status>`      non-2xx without a GCDR envelope (proxy page, gateway)
 * - `INVALID_RESPONSE`   2xx that is not an envelope
 * - `STREAM_UNAVAILABLE` SSE answered but the body cannot be read
 * - `STREAM_INCOMPLETE`  SSE ended without a `done` event
 * - `WIDGET_LOAD_FAILED` / `WIDGET_NOT_LOADED` (UMD loader)
 * - `CONFIG_ERROR`       invalid options (auth, base URL)
 */
export class MyIOBotError extends Error {
  readonly code: string;
  /** HTTP status (0 when there was no HTTP response). */
  readonly status: number;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 0, requestId?: string, details?: unknown) {
    super(message);
    this.name = 'MyIOBotError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}

/**
 * Error of a GCDR `{ success:false, error:{ code, message } }` envelope (or of a
 * non-envelope non-2xx body): keeps the API code, falls back to `HTTP_<status>`.
 */
export function botErrorFromEnvelope(status: number, json: unknown, statusText?: string, requestId?: string): MyIOBotError {
  const env = (json && typeof json === 'object' ? json : {}) as {
    error?: { code?: unknown; message?: unknown; details?: unknown };
    meta?: { requestId?: unknown };
  };
  const err = env.error && typeof env.error === 'object' ? env.error : {};
  const code = typeof err.code === 'string' && err.code ? err.code : `HTTP_${status}`;
  const message = typeof err.message === 'string' && err.message ? err.message : statusText || `HTTP ${status}`;
  const rid = typeof env.meta?.requestId === 'string' ? (env.meta.requestId as string) : requestId;
  return new MyIOBotError(code, message, status, rid, err.details);
}

export function isMyIOBotError(e: unknown): e is MyIOBotError {
  return e instanceof MyIOBotError || (!!e && typeof e === 'object' && (e as { name?: unknown }).name === 'MyIOBotError');
}
