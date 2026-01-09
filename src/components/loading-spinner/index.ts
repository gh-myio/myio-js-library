/**
 * RFC-0131: Loading Spinner Public Exports
 */

// Export factory function for public API
export { createLoadingSpinner, LoadingSpinner } from './LoadingSpinner';

// Export types for configuration and instance control
export type { LoadingSpinnerConfig, LoadingSpinnerInstance, SpinnerType, LoadingTheme } from './types';

// Export default configuration for utility
export { DEFAULT_LOADING_CONFIG } from './types';
