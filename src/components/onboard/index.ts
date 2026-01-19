/**
 * MYIO Academy Onboard Modal Component
 *
 * Reusable modal component with premium "MYIO Academy" footer
 * for tutorials, documentation, and onboarding content.
 *
 * @module onboard
 */

// Types
export type {
  OnboardModalConfig,
  OnboardModalHandle,
  OnboardFooterLink,
} from './types';

// View class
export { OnboardModalView } from './OnboardModalView';

// Functions
export {
  openOnboardModal,
  openTutorialModal,
  openHelpModal,
} from './openOnboardModal';
