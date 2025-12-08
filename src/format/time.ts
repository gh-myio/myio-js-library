/**
 * Time and duration formatting utilities
 * Extracted from MAIN controller for reuse across widgets
 */

/**
 * Converts a timestamp to a relative time string (e.g., "há 5 minutos").
 * @param timestamp - The timestamp in milliseconds.
 * @returns The formatted relative time string.
 */
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp || timestamp <= 0) {
    return '—';
  }

  const now = Date.now();
  const diffSeconds = Math.round((now - timestamp) / 1000);

  if (diffSeconds < 10) {
    return 'agora';
  }
  if (diffSeconds < 60) {
    return `há ${diffSeconds}s`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes === 1) {
    return 'há 1 min';
  }
  if (diffMinutes < 60) {
    return `há ${diffMinutes} mins`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours === 1) {
    return 'há 1 hora';
  }
  if (diffHours < 24) {
    return `há ${diffHours} horas`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) {
    return 'ontem';
  }
  if (diffDays <= 30) {
    return `há ${diffDays} dias`;
  }

  return new Date(timestamp).toLocaleDateString('pt-BR');
}

/**
 * Formats duration in milliseconds to a readable string (e.g., "2d 5h", "3h 20m", "45s")
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatarDuracao(ms: number): string {
  if (typeof ms !== 'number' || ms < 0 || !isFinite(ms)) {
    return '0s';
  }
  if (ms === 0) {
    return '0s';
  }

  const segundos = Math.floor((ms / 1000) % 60);
  const minutos = Math.floor((ms / (1000 * 60)) % 60);
  const horas = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts: string[] = [];
  if (dias > 0) {
    parts.push(`${dias}d`);
    if (horas > 0) {
      parts.push(`${horas}h`);
    }
  } else if (horas > 0) {
    parts.push(`${horas}h`);
    if (minutos > 0) {
      parts.push(`${minutos}m`);
    }
  } else if (minutos > 0) {
    parts.push(`${minutos}m`);
    if (segundos > 0) {
      parts.push(`${segundos}s`);
    }
  } else {
    parts.push(`${segundos}s`);
  }

  return parts.length > 0 ? parts.join(' ') : '0s';
}

/**
 * Alias for formatarDuracao using English naming convention
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 */
export const formatDuration = formatarDuracao;
