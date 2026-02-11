/**
 * RFC-0170: Ambiente Group Modal Types
 * TypeScript types for the ambiente group modal component
 */

import type { AmbienteData, AmbienteHierarchyNode } from '../ambiente-detail-modal/types';

/**
 * Sub-ambiente item within a group
 */
export interface SubAmbienteItem {
  id: string;
  label: string;
  name: string;
  ambienteData: AmbienteData;
  source: AmbienteHierarchyNode | null;
}

/**
 * Aggregated metrics for the group
 */
export interface AggregatedGroupMetrics {
  /** Total temperature average across sub-ambientes */
  temperatureAvg: number | null;
  /** Min temperature */
  temperatureMin: number | null;
  /** Max temperature */
  temperatureMax: number | null;
  /** Total humidity average */
  humidityAvg: number | null;
  /** Total consumption sum */
  consumptionTotal: number | null;
  /** Total device count */
  deviceCount: number;
  /** Count of online devices */
  onlineCount: number;
  /** Count of offline devices */
  offlineCount: number;
  /** Total sub-ambientes */
  subAmbienteCount: number;
}

/**
 * Group data passed to the modal
 */
export interface AmbienteGroupData {
  /** Group identifier (parent ambiente id) */
  id: string;
  /** Group display label (e.g., "Deck") */
  label: string;
  /** Group name/identifier */
  name: string;
  /** Aggregated metrics */
  metrics: AggregatedGroupMetrics;
  /** Sub-ambientes in this group */
  subAmbientes: SubAmbienteItem[];
  /** Overall group status */
  status: 'online' | 'offline' | 'partial' | 'warning';
}

/**
 * Modal configuration options
 */
export interface AmbienteGroupModalConfig {
  /** Theme mode for the modal */
  themeMode?: 'light' | 'dark';
  /** Callback when a sub-ambiente is clicked */
  onSubAmbienteClick?: (subAmbiente: SubAmbienteItem) => void;
  /** Callback when remote toggle is clicked */
  onRemoteToggle?: (isOn: boolean, subAmbiente: SubAmbienteItem, remoteId: string) => void;
  /** Callback when modal is closed */
  onClose?: () => void;
}

/**
 * Modal instance returned by createAmbienteGroupModal
 */
export interface AmbienteGroupModalInstance {
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
  /** Update the group data */
  update: (data: AmbienteGroupData) => void;
  /** Destroy the modal and cleanup */
  destroy: () => void;
}
