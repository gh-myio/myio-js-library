// report-device/openDashboardPopupReport.ts
import { OpenDeviceReportParams, ModalHandle } from '../types';
import { DeviceReportModal } from './DeviceReportModal';

export function openDashboardPopupReport(params: OpenDeviceReportParams): ModalHandle {
  const modal = new DeviceReportModal(params);
  return modal.show();
}
