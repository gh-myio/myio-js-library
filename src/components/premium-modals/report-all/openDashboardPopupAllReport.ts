// report-all/openDashboardPopupAllReport.ts
import { OpenAllReportParams, ModalHandle } from '../types';

export function openDashboardPopupAllReport(params: OpenAllReportParams): ModalHandle {
  // TODO: Implement all report modal
  console.log('Opening all report modal with params:', params);
  
  return {
    close: () => {
      console.log('Closing all report modal');
    },
    on: (event, handler) => {
      console.log(`Registering ${event} handler for all report modal`);
    }
  };
}
