export type ReportRow = {
  deviceName: string;
  temperature?: number;
  reading_date?: string;
  entityLabel?: string;
  deviceId?: string;
  consumptionKwh?: number;
  interpolated?: boolean;
  correctedBelowThreshold?: boolean;
};

export type DateRange = { start: Date; end: Date };

export type ReportOptions = {
  mount: HTMLElement;
  mode?: "temperature" | "energy";
  adminPassword?: string;
  defaultView?: "card" | "list";
  enableExports?: boolean;
  lazyExpand?: boolean;
  onFetchData: (range: DateRange) => Promise<ReportRow[]>;
  onExpandDevice?: (deviceKey: string) => Promise<ReportRow[]>;
  onExportCSV?: (rows: ReportRow[]) => void;
  onExportPDF?: (rows: ReportRow[]) => void;
};

export interface PremiumReportUI {
  setDateRange(start: Date, end: Date): void;
  render(rows: ReportRow[]): void;
  setLoading(status: string, progress: number): void;
  destroy(): void;
}
