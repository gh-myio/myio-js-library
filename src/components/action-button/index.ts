/**
 * RFC-0158: Action Button Component
 * Migrated from action-button widget
 *
 * A self-contained action button component with:
 * - Filled, outlined, and text variants
 * - Small, medium, and large sizes
 * - Optional icon + label
 * - Light/Dark theme support
 * - Click callback
 *
 * @example
 * ```typescript
 * import { createActionButton } from 'myio-js-library';
 *
 * const button = createActionButton(container, {
 *   settings: {
 *     label: 'Abrir Relatorio',
 *     icon: '\uD83D\uDCC4',
 *     variant: 'filled',
 *     color: '#2F5848',
 *   },
 *   onClick: () => {
 *     window.open('/report', '_blank');
 *   },
 * });
 *
 * button.destroy();
 * ```
 */

export {
  ActionButtonController,
  createActionButton,
} from './ActionButtonController';

export { ActionButtonView } from './ActionButtonView';

export {
  ACTION_BUTTON_CSS_PREFIX,
  injectActionButtonStyles,
} from './styles';

export {
  // Types
  type ActionButtonThemeMode,
  type ActionButtonVariant,
  type ActionButtonSize,
  type ActionButtonSettings,
  type ActionButtonParams,
  type ActionButtonInstance,
  // Constants
  DEFAULT_ACTION_BUTTON_SETTINGS,
} from './types';
