export function decodePayload(encoded: string, key: string | number): string;
export function decodePayloadBase64Xor(encoded: string, xorKey?: number): string;

export function fetchWithRetry(
  url: string | URL,
  options?: RequestInit & {
    retries?: number;
    retryDelay?: number;
    timeout?: number;
    retryCondition?: (error?: unknown, response?: Response) => boolean;
  }
): Promise<Response>;

export const http: typeof fetchWithRetry;

export namespace strings {
  function normalizeRecipients(val: unknown): string;
}
export namespace numbers {
  function fmtPerc(x: number, digits?: number): string;
  function toFixedSafe(x: number, digits?: number): string;
}

export function addNamespace(payload: object, namespace?: string): object;

export function detectDeviceType(name: string, context?: string): string;
export function getAvailableContexts(): string[];
export function addDetectionContext(contextName: string, detectFunction: (name: string) => string): void;
