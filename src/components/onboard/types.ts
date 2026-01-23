/**
 * MYIO Academy Onboard Modal Types
 * Reusable modal component with premium footer
 */

export interface OnboardModalConfig {
  /** Modal title */
  title: string;
  /** Modal width (default: 800px) */
  width?: number | string;
  /** Modal height (default: auto) */
  height?: number | string;
  /** Content to display in the modal body */
  content?: string | HTMLElement;
  /** URL to load in an iframe (optional) */
  iframeUrl?: string;
  /** Close on backdrop click (default: true) */
  closeOnBackdrop?: boolean;
  /** Show MYIO Academy footer (default: true) */
  showFooter?: boolean;
  /** Footer links configuration */
  footerLinks?: OnboardFooterLink[];
  /** Callback when modal closes */
  onClose?: () => void;
}

export interface OnboardFooterLink {
  label: string;
  url: string;
  icon?: string;
}

export interface OnboardModalHandle {
  /** Close the modal */
  close: () => void;
  /** Update modal content */
  setContent: (content: string | HTMLElement) => void;
  /** Get modal element */
  getElement: () => HTMLElement | null;
}
