/**
 * RFC-0205: Premium Dialog — public types.
 */

export type DialogButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';

export interface DialogButton {
  /** Visible label. Rendered as text (HTML-escaped). */
  label: string;
  /** Visual style. Default: 'secondary'. */
  variant?: DialogButtonVariant;
  /** Value the promise resolves with when this button is clicked. */
  value: string;
  /** Receives initial keyboard focus and responds to Enter. At most one. */
  autoFocus?: boolean;
}

export interface ConfirmDialogParams {
  title: string;
  /** Plain text; rendered HTML-escaped (newlines become line breaks). */
  message: string;
  buttons: DialogButton[];
  /** Default: 'light'. */
  theme?: 'light' | 'dark';
  /**
   * Dismissal policy. When true (default), Esc/backdrop/× resolve with null.
   * When false, the user must pick a button (no ×, Esc/backdrop ignored).
   */
  dismissible?: boolean;
  /** Width override, e.g. 420 or '32rem'. Default: 420px, max 90vw. */
  width?: number | string;
  /** Mount target. Default: document.body. Required for shadow-DOM hosts. */
  container?: HTMLElement;
}

export type MessageDialogSeverity = 'info' | 'success' | 'warning' | 'error';

export interface MessageDialogParams {
  /** Default derived from severity ('Informação', 'Sucesso', 'Atenção', 'Erro'). */
  title?: string;
  /** Plain text; rendered HTML-escaped (newlines become line breaks). */
  message: string;
  /** Default: 'info'. */
  severity?: MessageDialogSeverity;
  /** Default: 'OK'. */
  buttonLabel?: string;
  /** Default: 'light'. */
  theme?: 'light' | 'dark';
  /** Auto-close after N ms. 0/undefined = no auto-close. */
  autoCloseMs?: number;
  /** Mount target. Default: document.body. */
  container?: HTMLElement;
}
