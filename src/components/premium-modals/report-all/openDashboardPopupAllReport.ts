// report-all/openDashboardPopupAllReport.ts
import { OpenAllReportParams, ModalHandle } from '../types';
import { AllReportModal } from './AllReportModal';

export function openDashboardPopupAllReport(params: OpenAllReportParams): ModalHandle {
  const modal = new AllReportModal(params);
  return modal.show();
}
