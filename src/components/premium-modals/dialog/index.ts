/**
 * RFC-0205: Premium Dialog — exported confirm/message modal.
 */

export { openConfirmDialog, openMessageDialog } from './openDialog';
export { openGenericModal } from './openGenericModal';
export type {
  ConfirmDialogParams,
  MessageDialogParams,
  MessageDialogSeverity,
  DialogButton,
  DialogButtonVariant,
} from './types';
export type {
  GenericModalParams,
  GenericModalButton,
  GenericModalInstance,
} from './openGenericModal';
