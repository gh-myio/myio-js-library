export function decodePayloadBase64Xor(encoded: string, xorKey?: number): string;

export function http(
  url: string | URL,
  opts?: RequestInit & { timeoutMs?: number; maxRetries?: number; baseDelayMs?: number }
): Promise<Response>;

export namespace strings {
  function normalizeRecipients(val: unknown): string;
}

export namespace numbers {
  function fmtPerc(x: number, digits?: number): string;
  function toFixedSafe(x: number, digits?: number): string;
}
