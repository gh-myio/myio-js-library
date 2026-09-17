/**
 * CentralSettingsModal Utilities
 *
 * `SettingsModalView.ts` (the device settings modal this is adapted from) is
 * ~3400 lines and deeply device-shaped: energy/water/temperature threshold
 * tabs, a GCDR Alarms tab keyed by `gcdrDeviceId`, an Exclusion Groups tab,
 * a Tickets/FreshDesk tab, superadmin/holdingAdmin field-editing gates. Most
 * of that has no equivalent for a CENTRAL (a central isn't a
 * temperature/water/energy device, doesn't belong to an exclusion group,
 * and CentralStatusCard's own switches already own Monitoramento/Status).
 *
 * What *does* carry over conceptually: an identity section (name, read-only
 * UUID/hardware id — same fields as the card's own `titleTooltipHtml`), and
 * — genuinely new here, not in the original — the v2 connectivity tuning
 * knobs (`offlineGraceMs`/`blipToleranceMs`/`offlineHardMs`) that today are
 * only developer-set card props, never end-user-editable. Same
 * fetcher/persister-by-callback + PersistResult shape as the original,
 * scoped down.
 *
 * Also carries the read-only GCDR identity/telemetry fields (serialNumber,
 * firmwareVersion, stats, createdAt/updatedAt, etc. — see
 * `GET /api/v1/centrals/:id`), rendered in a dedicated native "Central" tab
 * added to `SettingsModalView.ts` itself, gated behind `ModalConfig.isGateway`
 * (never true for a real device) — see that file's `getGatewayInfoHTML()`.
 */

export interface CentralSettingsData {
  name: string;
  uuid?: string | null;
  hardwareId?: string | null;
  /** Minutes. Failure past this (but before offlineHardMs) reads WARNING. */
  offlineGraceMinutes: number;
  /** Minutes. A failure shorter than this is tolerated — stays ONLINE. 0 = no tolerance (v1 behavior). */
  blipToleranceMinutes: number;
  /** Minutes, or null for "no hard tier" (bare "OFFLINE" forever, v1 behavior). */
  offlineHardMinutes: number | null;

  // ── Read-only identity/telemetry — 1:1 with GCDR's GET /api/v1/centrals/:id,
  // rendered inline in the modal's Geral tab (SettingsModalView's
  // `isGateway`/`gatewayInfo`, see CentralSettingsModal.ts). Never sent back
  // by handleCentralSave — the host's onSaveSettings only ever receives
  // name/offlineGraceMinutes/blipToleranceMinutes/offlineHardMinutes. ──
  serialNumber?: string | null;
  type?: string | null; // NODEHUB | GATEWAY | EDGE_CONTROLLER | VIRTUAL
  status?: string | null; // ACTIVE | INACTIVE | DELETED
  connectionStatus?: string | null; // ONLINE | OFFLINE | DEGRADED | MAINTENANCE
  monitoringEnabled?: boolean | null;
  lastGatewayCheckAt?: string | null; // ISO
  lastGatewaySuccessCheckAt?: string | null; // ISO
  lastGatewayCheckLatencyMs?: number | null;
  probeResult?: string | null;
  firmwareVersion?: string | null;
  softwareVersion?: string | null;
  frequency?: number | null;
  stats?: {
    connectedDevices?: number | null;
    activeRules?: number | null;
    pendingSyncEvents?: number | null;
    uptimeSeconds?: number | null;
    lastHeartbeatAt?: string | null; // ISO
  } | null;
  createdAt?: string | null; // ISO
  updatedAt?: string | null; // ISO
  version?: number | null;
  /** Optional — set only when this central is (or is co-located with) a real
   *  measurement point. See `GatewayInfo.lastConsumptionTelemetry`. */
  lastConsumptionTelemetry?: { value: number; unit?: string; timestamp: string } | null;
}

export interface CentralSettingsValidationError {
  field: keyof CentralSettingsData;
  message: string;
}

/** Mirrors PersistResult from settings/types.ts, scoped to one flat attribute set (no entity/serverScope split — a central has no TB device label to patch separately). */
export interface CentralSettingsPersistResult {
  ok: boolean;
  error?: { code: string; message: string };
}

const MIN_TO_MS = 60_000;

export function minutesToMs(minutes: number | null | undefined): number | undefined {
  return minutes == null ? undefined : Math.round(minutes * MIN_TO_MS);
}

export function msToMinutes(ms: number | null | undefined): number | null {
  return ms == null ? null : Math.round((ms / MIN_TO_MS) * 100) / 100;
}

/** Same validation shape as `CreateCentralStatusCardTimelineConfig`'s implicit contract: grace/blip are always required non-negative numbers; hard (when set) must exceed grace, otherwise it can never fire (see deriveCentralConnectivity's own `pastHard` guard). */
export function validateCentralSettings(data: CentralSettingsData, language: 'pt' | 'en'): CentralSettingsValidationError[] {
  const errors: CentralSettingsValidationError[] = [];
  const req = (v: unknown) => v == null || (typeof v === 'number' && Number.isNaN(v));

  if (!data.name || !data.name.trim()) {
    errors.push({ field: 'name', message: language === 'en' ? 'Name is required.' : 'Nome é obrigatório.' });
  }
  if (req(data.offlineGraceMinutes) || data.offlineGraceMinutes < 0) {
    errors.push({
      field: 'offlineGraceMinutes',
      message: language === 'en' ? 'Must be 0 or greater.' : 'Deve ser 0 ou maior.',
    });
  }
  if (req(data.blipToleranceMinutes) || data.blipToleranceMinutes < 0) {
    errors.push({
      field: 'blipToleranceMinutes',
      message: language === 'en' ? 'Must be 0 or greater.' : 'Deve ser 0 ou maior.',
    });
  }
  if (
    data.offlineHardMinutes != null &&
    !req(data.offlineGraceMinutes) &&
    data.offlineHardMinutes <= data.offlineGraceMinutes
  ) {
    errors.push({
      field: 'offlineHardMinutes',
      message:
        language === 'en'
          ? 'Must be greater than the grace window, otherwise it can never trigger.'
          : 'Deve ser maior que a janela de graça, senão nunca dispara.',
    });
  }
  return errors;
}
