/**
 * RFC-0158: Action Button Component Types
 * Migrated from action-button widget
 */

export type ActionButtonThemeMode = 'light' | 'dark';
export type ActionButtonVariant = 'filled' | 'outlined' | 'text';
export type ActionButtonSize = 'small' | 'medium' | 'large';

export interface ActionButtonSettings {
  /** Theme mode */
  themeMode?: ActionButtonThemeMode;
  /** Button label text */
  label?: string;
  /** Icon (emoji, unicode character, or short text shown before the label) */
  icon?: string;
  /** Button variant */
  variant?: ActionButtonVariant;
  /** Button size */
  size?: ActionButtonSize;
  /** Primary color for background (filled) or border/text (outlined/text) */
  color?: string;
  /** Text color override (default: white for filled, color for outlined/text) */
  textColor?: string;
  /** Border radius in px (default: 8) */
  borderRadius?: number;
  /** Whether the button fills the container width (default: false) */
  fullWidth?: boolean;
  /** Whether the button is disabled (default: false) */
  disabled?: boolean;
  /** Tooltip text on hover */
  tooltip?: string;
  /** Enable debug mode */
  enableDebugMode?: boolean;
}

export interface ActionButtonParams {
  /** Initial settings */
  settings?: ActionButtonSettings;
  /** Callback when button is clicked */
  onClick?: () => void | Promise<void>;
}

export interface ActionButtonInstance {
  /** Root element */
  element: HTMLElement;
  /** Update settings (label, icon, color, disabled, etc.) */
  updateSettings: (settings: Partial<ActionButtonSettings>) => void;
  /** Get current settings */
  getSettings: () => ActionButtonSettings;
  /** Set theme mode */
  setThemeMode: (mode: ActionButtonThemeMode) => void;
  /** Set disabled state */
  setDisabled: (disabled: boolean) => void;
  /** Destroy the component */
  destroy: () => void;
}

/** Default settings */
export const DEFAULT_ACTION_BUTTON_SETTINGS: Required<ActionButtonSettings> = {
  themeMode: 'light',
  label: 'Action',
  icon: '',
  variant: 'filled',
  size: 'medium',
  color: '#2F5848',
  textColor: '',
  borderRadius: 8,
  fullWidth: false,
  disabled: false,
  tooltip: '',
  enableDebugMode: false,
};
