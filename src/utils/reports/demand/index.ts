/**
 * RFC-0238 — Demand Panel v2: pure logic (no DOM), consumed by `openDemandPanelV2`.
 * Contract: GCDR RFC-0075 "Report Jobs".
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
  BUCKET_STATS_LABEL,
  DEFAULT_DEMAND_LABEL,
  telemetriesInCatalogOrder,
} from './catalog';
export type { TelemetryGroup, ResolutionDef } from './catalog';
export {
  MIN_PERIOD_START,
  MIN_PERIOD_START_MS,
  END_TOLERANCE_MS,
  spParts,
  spEpoch,
  parseLocalDateTime,
  toLocalDateTimeInput,
  formatLocalDateTime,
  presetRange,
  isLocalMidnight,
  localMidnightOf,
  bucketCount,
  finestFittingResolution,
  maxPeriodDays,
  periodErrors,
} from './period';
export type { LocalParts, Range } from './period';
export {
  HASH_ALGORITHM,
  canonicalJson,
  canonicalizeRequest,
  canonicalRequestJson,
  compareCodeUnits,
  requestHash,
  webCryptoSha256,
} from './hash';
export type { Sha256 } from './hash';
export {
  JOB_KEY_PREFIX,
  SUBMIT_SCHEMA_VERSION,
  envelopeKey,
  uuidv7,
  buildRequest,
  buildEnvelope,
  toSubmitCommand,
  toValidateCommand,
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
  failureText,
} from './jobs';
export type { JobKnowledge, JobViewState, JobViewInput, JobView } from './jobs';
export { buildTaxonomyChips, humanizeKey } from './taxonomy';
export type { TaxonomyClassifier, TaxonomyChip, TaxonomyNodeInfo } from './taxonomy';
