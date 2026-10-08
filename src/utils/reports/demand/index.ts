/**
 * RFC-0238 — Demand Panel v2: pure logic (no DOM), consumed by `openDemandPanelV2`.
 */
export * from './types';
export {
  CATALOG_VERSION,
  TELEMETRY_GROUPS,
  TELEMETRY_CATALOG,
  RESOLUTIONS,
  RESOLUTION_BY_ID,
  DEMAND_LIMITS,
  DEFAULT_RESOLUTION,
  AGGREGATIONS,
  DEFAULT_AGGREGATION,
  RAW_MAX_DAYS,
  telemetriesInCatalogOrder,
} from './catalog';
export type { TelemetryGroup, ResolutionDef } from './catalog';
export {
  MIN_PERIOD_START,
  MIN_PERIOD_START_MS,
  spParts,
  spEpoch,
  parseLocalDateTime,
  toLocalDateTimeInput,
  formatLocalDateTime,
  presetRange,
  bucketCount,
  finestFittingResolution,
  maxPeriodDays,
  periodErrors,
} from './period';
export type { LocalParts, Range } from './period';
export { HASH_ALGORITHM, hashProjection, canonicalJson, requestHash, webCryptoSha256 } from './hash';
export type { HashProjection, Sha256 } from './hash';
export {
  JOB_KEY_PREFIX,
  PROTOCOL_VERSION,
  envelopeKey,
  uuidv7,
  buildRequest,
  buildEnvelope,
  toSubmitCommand,
  parseEnvelope,
  auditEvent,
} from './envelope';
export type { BuildRequestInput, BuildEnvelopeInput, ParsedEnvelope } from './envelope';
export {
  JOB_STATE_LABEL,
  deriveJobView,
  needsPolling,
  mergeBatch,
  reconciliationEvents,
  isUncertainStatus,
  rejectionText,
} from './jobs';
export type { JobKnowledge, JobViewState, JobViewInput, JobView } from './jobs';
export { buildTaxonomyChips, humanizeKey } from './taxonomy';
export type { TaxonomyClassifier, TaxonomyChip, TaxonomyNodeInfo } from './taxonomy';
