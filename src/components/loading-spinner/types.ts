/**
 * RFC-0131: LoadingSpinner Component Types
 * TypeScript interfaces and configurations
 */

/**
 * Supported spinner animation types
 */
export type SpinnerType = 'single' | 'double' | 'dots';

/**
 * Color theme presets
 */
export type LoadingTheme = 'dark' | 'light';

/**
 * Loading Spinner Configuration
 * Controls behavior, appearance and timing
 */
export interface LoadingSpinnerConfig {
  // =====================
  // TIMING CONFIGURATION
  // =====================
  /**
   * Minimum display time in milliseconds
   * Prevents "flash" when loading finishes very quickly
   * Example: 800ms ensures spinner shows at least 800ms
   * @default 800
   */
  minDisplayTime?: number;

  /**
   * Maximum timeout in milliseconds
   * Forces hide after this time to prevent stuck states
   * Example: 10000ms = 10 seconds max
   * @default 10000
   */
  maxTimeout?: number;

  /**
   * Automatically hide when complete
   * Set to false for manual control over hiding
   * @default true
   */
  autoHide?: boolean;

  // =====================
  // CONTENT CONFIGURATION
  // =====================
  /**
   * Default message to display
   * Can be overridden when calling show()
   * @default "Carregando dados..."
   */
  message?: string;

  // =====================
  // APPEARANCE CONFIGURATION
  // =====================
  /**
   * Animation type for the spinner
   * - single: Simple circular spinner
   * - double: Two concentric circles spinning in different directions
   * - dots: Three pulsing dots
   * @default "double"
   */
  spinnerType?: SpinnerType;

  /**
   * Color theme (dark/light)
   * @default "dark"
   */
  theme?: LoadingTheme;

  // =====================
  // DEBUG CONFIGURATION
  // =====================
  /**
   * Show elapsed time counter in debug mode
   * Useful during development and testing
   * @default false
   */
  showTimer?: boolean;

  // =====================
  // CALLBACKS
  // =====================
  /**
   * Called when maxTimeout is reached
   * Useful for custom timeout handling
   */
  onTimeout?: () => void;

  /**
   * Called when spinner is hidden (manually or automatically)
   * Useful for cleanup or follow-up actions
   */
  onComplete?: () => void;
}

/**
 * Loading Spinner Instance API
 * Public interface for controlling the spinner
 */
export interface LoadingSpinnerInstance {
  /**
   * Shows the loading spinner with optional custom message
   * @param message - Optional message override
   */
  show: (message?: string) => void;

  /**
   * Hides the loading spinner (respects minDisplayTime)
   */
  hide: () => void;

  /**
   * Updates the displayed message
   * @param message - New message to display
   */
  updateMessage: (message: string) => void;

  /**
   * Checks if spinner is currently visible
   * @returns true if spinner is showing
   */
  isShowing: () => boolean;

  /**
   * Destroys the spinner instance and cleans up DOM
   */
  destroy: () => void;
}

/**
 * Default configuration values
 * Used as fallback for any undefined config properties
 */
export const DEFAULT_LOADING_CONFIG: LoadingSpinnerConfig = {
  minDisplayTime: 800,
  maxTimeout: 10000,
  autoHide: true,
  message: 'Carregando dados...',
  spinnerType: 'double',
  theme: 'dark',
  showTimer: false,
};

/**
 * Performance tracking metrics (used internally)
 */
export interface LoadingSpinnerMetrics {
  startTime: number;
  showCount: number;
  hideCount: number;
  timeoutCount: number;
  averageDisplayTime: number;
}
