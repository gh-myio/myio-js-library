// report-device/openDashboardPopupReport.ts
import { ModalHandle } from '../types';
import { DeviceReportModal, DeviceReportModalParams } from './DeviceReportModal';

// DeviceReportModalParams = OpenDeviceReportParams + { customerName?, theme? }
// (campos opcionais estendidos localmente — ver DeviceReportModal.ts).
export function openDashboardPopupReport(params: DeviceReportModalParams): ModalHandle {
  const modal = new DeviceReportModal(params);
  return modal.show();
}
