// energy/utils.ts - Utility functions for energy modal

import { EnergyModalError, OpenDashboardPopupEnergyOptions } from './types';

/**
 * Validates the required parameters for openDashboardPopupEnergy
 */
export function validateOptions(options: OpenDashboardPopupEnergyOptions): void {
  const mode = options.mode || 'single';

  // MODE-SPECIFIC VALIDATION
  if (mode === 'single') {
    // Single mode requires deviceId and tbJwtToken
    if (!options.tbJwtToken) {
      throw new Error('tbJwtToken is required for ThingsBoard API access in single mode');
    }

    if (!options.deviceId) {
      throw new Error('deviceId is required for single mode');
    }
  } else if (mode === 'comparison') {
    // Comparison mode requires dataSources and granularity
    if (!options.dataSources || options.dataSources.length === 0) {
      throw new Error('dataSources is required for comparison mode');
    }

    if (!options.granularity) {
      throw new Error('granularity is required for comparison mode');
    }
  }

  // COMMON VALIDATIONS
  if (!options.startDate || !options.endDate) {
    throw new Error('startDate and endDate are required');
  }

  // Validate authentication strategy (only for single mode or when needed)
  if (mode === 'single') {
    const hasIngestionToken = !!options.ingestionToken;
    const hasClientCredentials = !!(options.clientId && options.clientSecret);

    if (!hasIngestionToken && !hasClientCredentials) {
      throw new Error('Either ingestionToken or clientId/clientSecret must be provided');
    }
  } else if (mode === 'comparison') {
    // Comparison mode needs clientId/clientSecret for SDK
    if (!options.clientId || !options.clientSecret) {
      throw new Error('clientId and clientSecret are required for comparison mode');
    }
  }
}

/**
 * Normalizes date to São Paulo timezone ISO string.
 *
 * Constructs the ISO string directly from the YYYY-MM-DD portion without
 * Date object manipulation — avoids double timezone adjustment bugs that
 * arise when the input already carries an offset (e.g. '2025-05-07T00:00:00-03:00').
 *
 * For Date objects, UTC-3 is applied arithmetically (Brazil abolished DST in 2019
 * so the offset is always fixed).
 */
export function normalizeToSaoPauloISO(dateLike: string | Date, endOfDay: boolean = false): string {
  let ymd: string;

  if (typeof dateLike === 'string') {
    // Extract only the YYYY-MM-DD part — strip any time or offset already present
    ymd = dateLike.split('T')[0];
  } else {
    // Convert the Date to São Paulo local date via fixed UTC-3 arithmetic
    const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
    const d = new Date(dateLike.getTime() - SP_OFFSET_MS);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    ymd = `${y}-${mo}-${da}`;
  }

  const time = endOfDay ? 'T23:59:59.000' : 'T00:00:00.000';
  return `${ymd}${time}-03:00`;
}

/**
 * Resolves device attributes from ThingsBoard response
 */
export function resolveDeviceAttributes(attributes: Record<string, any>): {
  ingestionId?: string;
  centralId?: string;
  slaveId?: number | string;
  customerId?: string;
  floor?: string;
  storeNumber?: string;
} {
  return {
    ingestionId: attributes.ingestionId || attributes.INGESTION_ID,
    centralId: attributes.centralId || attributes.CENTRAL_ID,
    slaveId: attributes.slaveId || attributes.SLAVE_ID,
    customerId: attributes.customerId || attributes.CUSTOMER_ID,
    floor: attributes.floor || attributes.FLOOR,
    storeNumber: attributes.NumLoja || attributes.storeNumber
  };
}

/**
 * Maps HTTP errors to EnergyModalError with user actions
 */
export function mapHttpError(status: number, body: string = ''): EnergyModalError {
  switch (status) {
    case 400:
      return {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        userAction: 'FIX_INPUT'
      };
    case 401:
      return {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
        userAction: 'RE_AUTH'
      };
    case 403:
      return {
        code: 'AUTH_ERROR',
        message: 'Insufficient permissions',
        userAction: 'RE_AUTH'
      };
    case 404:
      return {
        code: 'NETWORK_ERROR',
        message: 'Device not found',
        userAction: 'CONTACT_ADMIN'
      };
    case 409:
      return {
        code: 'VALIDATION_ERROR',
        message: 'Concurrent modification detected',
        userAction: 'RETRY'
      };
    case 422:
      return {
        code: 'VALIDATION_ERROR',
        message: 'Server-side validation failed',
        userAction: 'FIX_INPUT'
      };
    default:
      if (status >= 500) {
        return {
          code: 'NETWORK_ERROR',
          message: 'Server error occurred',
          userAction: 'RETRY'
        };
      }
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error occurred',
        userAction: 'RETRY'
      };
  }
}

/**
 * Generates date range array based on granularity
 */
export function generateDateRange(startISO: string, endISO: string, granularity: string): string[] {
  const dates: string[] = [];
  const start = new Date(startISO);
  const end = new Date(endISO);
  
  while (start <= end) {
    dates.push(start.toISOString());
    
    switch (granularity) {
      case '15m':
        start.setMinutes(start.getMinutes() + 15);
        break;
      case '1h':
        start.setHours(start.getHours() + 1);
        break;
      case '1d':
      default:
        start.setDate(start.getDate() + 1);
        break;
    }
  }
  
  return dates;
}

/**
 * Formats number for display with Portuguese locale
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Formats date for display with Portuguese locale
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
}

/**
 * Classifies device based on attributes for icon selection
 */
export function classifyDevice(attributes: Record<string, any>): string {
  // Simple classification logic - can be enhanced
  const deviceType = attributes.deviceType || attributes.type || '';
  const name = attributes.name || '';
  
  if (deviceType.toLowerCase().includes('energy') || name.toLowerCase().includes('energy')) {
    return 'energy';
  }
  if (deviceType.toLowerCase().includes('water') || name.toLowerCase().includes('water')) {
    return 'water';
  }
  if (deviceType.toLowerCase().includes('gas') || name.toLowerCase().includes('gas')) {
    return 'gas';
  }
  
  return 'generic';
}

/**
 * Gets device icon based on classification
 */
export function getDeviceIcon(classification: string): string {
  const icons = {
    energy: '⚡',
    water: '💧',
    gas: '🔥',
    generic: '📊'
  };
  
  return icons[classification as keyof typeof icons] || icons.generic;
}

/**
 * Sanitizes and validates JWT token
 */
export function validateJwtToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Basic JWT format validation (3 parts separated by dots)
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  
  // Check if parts are base64-like
  const base64Regex = /^[A-Za-z0-9_-]+$/;
  return parts.every(part => base64Regex.test(part));
}

/**
 * Creates a safe error message without exposing sensitive information
 */
export function createSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Remove any potential sensitive information
    return error.message.replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]');
  }
  
  return 'An unknown error occurred';
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait) as any;
  };
}

/**
 * Creates a unique ID for modal instances
 */
export function createModalId(): string {
  return `myio-energy-modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
