/**
 * RFC-0168: Ambiente Detail Modal Component
 * Exports for the ambiente detail modal
 */

export { createAmbienteDetailModal, openAmbienteDetailModal } from './AmbienteDetailModal';
export { injectAmbienteModalStyles, AMBIENTE_MODAL_CSS_PREFIX } from './styles';
export type {
  AmbienteData,
  AmbienteDetailModalConfig,
  AmbienteDetailModalInstance,
  AmbienteEnergyDevice,
  AmbienteRemoteDevice,
  AmbienteHierarchyNode,
  AmbienteChildDevice,
} from './types';
