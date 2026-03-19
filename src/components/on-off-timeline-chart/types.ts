/**
 * RFC-0167: On/Off Timeline Chart Types
 * Types for the on/off activation timeline chart component
 */

/**
 * Single data point representing an activation event
 */
export interface OnOffActivationPoint {
  /** Timestamp (ISO string or Date) */
  timestamp: string;
  /** State: 1 = ON, 0 = OFF */
  state: 0 | 1;
  /** Optional label for this point */
  label?: string;
  /** Optional trigger source (e.g., 'manual', 'schedule', 'automation') */
  source?: 'manual' | 'schedule' | 'automation' | 'unknown';
}

/**
 * Segment representing a continuous state period
 */
export interface OnOffTimelineSegment {
  /** Start timestamp (ISO string) */
  startTime: string;
  /** End timestamp (ISO string) */
  endTime: string;
  /** Duration in minutes */
  durationMinutes: number;
  /** State during this segment: 'on' or 'off' */
  state: 'on' | 'off';
  /** Source that triggered this segment */
  source?: 'manual' | 'schedule' | 'automation' | 'unknown';
}

/**
 * Timeline data for the chart
 */
export interface OnOffTimelineData {
  /** Device ID */
  deviceId: string;
  /** Device name */
  deviceName?: string;
  /** Period start date (ISO string) */
  periodStart: string;
  /** Period end date (ISO string) */
  periodEnd: string;
  /** Total hours in the timeline */
  totalHours: number;
  /** Timeline segments */
  segments: OnOffTimelineSegment[];
  /** Total time ON in minutes */
  totalOnMinutes: number;
  /** Total time OFF in minutes */
  totalOffMinutes: number;
  /** Number of activations (transitions to ON) */
  activationCount: number;
  /** Current state */
  currentState: 'on' | 'off';
}

/**
 * Chart configuration options
 */
export interface OnOffTimelineChartConfig {
  /** Chart width in pixels */
  width?: number;
  /** Chart height in pixels */
  height?: number;
  /** Color for ON state */
  onColor?: string;
  /** Color for OFF state */
  offColor?: string;
  /** Show activation markers */
  showMarkers?: boolean;
  /** Show duration labels */
  showDurationLabels?: boolean;
  /** Show legend */
  showLegend?: boolean;
  /** Theme mode */
  themeMode?: 'light' | 'dark';
  /** Device-specific labels */
  labels?: {
    on?: string;
    off?: string;
  };
}

/**
 * Chart instance returned by createOnOffTimelineChart
 */
export interface OnOffTimelineChartInstance {
  /** The chart container element */
  element: HTMLElement;
  /** Update chart with new data */
  update: (data: OnOffTimelineData) => void;
  /** Set theme mode */
  setTheme: (mode: 'light' | 'dark') => void;
  /** Destroy and cleanup */
  destroy: () => void;
}

/**
 * Parameters for creating the chart
 */
export interface OnOffTimelineChartParams {
  /** Container element or selector */
  container: HTMLElement | string;
  /** Initial data */
  data: OnOffTimelineData;
  /** Chart configuration */
  config?: OnOffTimelineChartConfig;
}
