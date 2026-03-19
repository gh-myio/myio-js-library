/**
 * RFC-0170: Ambiente Group Modal Component
 * Exports for the ambiente group modal
 */

export {
  createAmbienteGroupModal,
  openAmbienteGroupModal,
  buildAmbienteGroupData,
  calculateGroupMetrics,
} from './AmbienteGroupModal';

export { injectAmbienteGroupModalStyles, AMBIENTE_GROUP_CSS_PREFIX } from './styles';

export type {
  AmbienteGroupData,
  AmbienteGroupModalConfig,
  AmbienteGroupModalInstance,
  SubAmbienteItem,
  AggregatedGroupMetrics,
} from './types';
