import type { GatewayInfo, PresetupDevice } from '../types';
import { getEffectiveSlaveId, getEffectiveAddrLow, getEffectiveAddrHigh, mapProvisioningDeviceType } from '../utils/device';

const STEP_ICONS: Record<string, string> = {
  CREATION: '🔄',
  GETTING_IPV6: '🌐',
  CONNECTING_SSH: '🔐',
  CHECKING_DATABASE: '🗃️',
  UPDATING_ENVIRONMENT: '⚙️',
  ADDING_DEVICES: '📟',
  ADDING_AMBIENTS: '🏢',
  INSTALLING_PACKAGES: '📦',
  WRITING_NODE_RED: '🔗',
  RESTARTING_SERVICES: '🔄',
  COMPLETED: '✅',
};

/**
 * Provisioning API client — provisions the physical gateway hardware.
 * Ported faithfully from presetup-nextjs/src/services/sync/central-sync.ts.
 *
 * The Provisioning API does NOT require an Authorization header
 * (consistent with central-sync.ts:75 in presetup-nextjs).
 */
export class ProvisioningApiClient {
  constructor(private readonly baseUrl: string) {}

  /**
   * Check whether the gateway has all required fields for provisioning.
   * Returns null if OK, or a human-readable reason string if it cannot proceed.
   */
  canProvision(gateway: GatewayInfo): string | null {
    if (!gateway.ipv6) return 'ipv6 (Yggdrasil) ausente no gateway';
    if (!gateway.id) return 'uuid do gateway ausente';
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const cleanUuid = gateway.id.replace(/[\u2060-\u206F\u200B-\u200F\uFEFF]/g, '').trim();
    if (!uuidRe.test(cleanUuid)) return `UUID inválido: "${cleanUuid}"`;
    if (!gateway.credentials?.mqtt?.clientId) return 'MQTT clientId ausente';
    if (!gateway.credentials?.mqtt?.username) return 'MQTT username ausente';
    if (!gateway.credentials?.mqtt?.password) return 'MQTT password ausente';
    return null;
  }

  /**
   * Format a device for the provisioning payload.
   * Mirrors CentralSyncService.formatDeviceForProvisioning() exactly.
   */
  private formatDevice(device: PresetupDevice): Record<string, unknown> {
    const formatted: Record<string, unknown> = {
      name: device.name,
      originalName: device.name,
      type: mapProvisioningDeviceType(device.type),
      identifier: device.identifier ?? '',
      addr_low: Number(getEffectiveAddrLow(device)),
      addr_high: Number(getEffectiveAddrHigh(device)),
      slave_id: Number(getEffectiveSlaveId(device)),
      uuid: device.uuid,
      description: device.name,
    };

    if (device.multipliers) {
      formatted['multipliers'] = {
        amperage: device.multipliers.amperage,
        voltage: device.multipliers.voltage,
        power: device.multipliers.power,
        temperature: device.multipliers.temperature,
      };
    }

    // HIDROMETRO requires extra channels (pulse + flow sensors)
    if (device.type.toUpperCase() === 'HIDROMETRO') {
      formatted['channels'] = [
        { name: 'Energia', channel: 0, type: 'presence_sensor' },
        { name: device.name, channel: 1, type: 'flow_sensor' },
      ];
    }

    return formatted;
  }

  /**
   * Build a single ambient from the gateway containing all device slave_ids.
   * Simplified from CentralSyncService.buildAmbientsForGateway() — single ambient
   * is appropriate for the single-gateway scope.
   */
  private buildAmbients(
    gateway: GatewayInfo,
    devices: PresetupDevice[],
  ): Array<{ id: number; name: string; devices: number[] }> {
    const slaveIds = devices.map(d => Number(getEffectiveSlaveId(d))).filter(Boolean);
    if (slaveIds.length === 0) return [];
    return [{ id: 1, name: gateway.name, devices: slaveIds }];
  }

  /**
   * Poll job status and log output, streaming each new log line to onLog.
   * Ported from CentralSyncService.pollJobLogs() — max 600 iterations (10 min).
   */
  private async pollJobLogs(
    jobId: string,
    onLog: (line: string) => void,
  ): Promise<void> {
    const base = this.baseUrl.replace(/\/$/, '');
    const statusUrl = `${base}/jobs/${jobId}`;
    const logUrl = `${base}/jobs/${jobId}/logs`;

    let lastLogId = 0;
    let jobStatus = 'RUNNING';
    let polls = 0;
    const MAX_POLLS = 600;

    onLog(`📋 Acompanhando job ${jobId}...`);

    while (jobStatus === 'RUNNING' && polls < MAX_POLLS) {
      await new Promise(r => setTimeout(r, 1000));
      polls++;

      try {
        const statusRes = await fetch(statusUrl, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });

        if (statusRes.ok) {
          const s = await statusRes.json();
          jobStatus = s.status ?? jobStatus;

          if (jobStatus === 'COMPLETED') {
            onLog('✅ Job concluído com sucesso!');
            break;
          }
          if (jobStatus === 'FAILED') {
            onLog(`❌ Job falhou: ${s.progress ?? ''}`);
            break;
          }
          if (polls % 10 === 0) {
            onLog(`🔄 Status: ${jobStatus} — Progresso: ${s.progress ?? ''}`);
          }
        }
      } catch {
        // ignore polling errors — keep trying
      }

      try {
        const logRes = await fetch(logUrl, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });

        if (logRes.ok) {
          const logData = await logRes.json();
          const logs: Array<{ id: number; level: string; step: string; message: string; timestamp: string }> =
            logData.logs ?? [];

          const newLogs = logs.filter(l => l.id > lastLogId);

          for (const entry of newLogs) {
            const time = (entry.timestamp ?? '').split(' ')[1] ?? '';
            const icon = STEP_ICONS[entry.step] ?? '📋';
            if (entry.level === 'INFO' && !entry.message.includes('Progress updated to')) {
              onLog(`${icon} [${time}] ${entry.message}`);
            }
          }

          if (newLogs.length > 0) {
            lastLogId = Math.max(...newLogs.map(l => l.id));
          }
        }
      } catch {
        // ignore log fetch errors
      }
    }

    if (polls >= MAX_POLLS) {
      onLog(`⏰ Timeout após 10 minutos. Verifique manualmente: ${statusUrl}`);
    }
  }

  /**
   * Provision the physical central hardware.
   * POST /centrals/:uuid/provision — then poll /jobs/:jobId for live progress.
   */
  async provision(
    gateway: GatewayInfo,
    devices: PresetupDevice[],
    onLog: (line: string) => void,
  ): Promise<{ success: boolean; jobId?: string }> {
    const cleanUuid = gateway.id.replace(/[\u2060-\u206F\u200B-\u200F\uFEFF]/g, '').trim();
    const endpoint = `${this.baseUrl.replace(/\/$/, '')}/centrals/${cleanUuid}/provision`;

    const payload = {
      central_id: gateway.centralId ?? [],
      frequency: gateway.frequency,
      name: gateway.name,
      ipv6: gateway.ipv6,
      credentials: {
        mqtt: {
          server: gateway.credentials?.mqtt?.server ?? 'mqtt://mqtt.myio-bas.com',
          clientId: gateway.credentials?.mqtt?.clientId,
          username: gateway.credentials?.mqtt?.username,
          password: gateway.credentials?.mqtt?.password,
        },
      },
      devices: devices.map(d => this.formatDevice(d)),
      ambients: this.buildAmbients(gateway, devices),
    };

    onLog(`🚀 Enviando payload para ${endpoint}...`);
    onLog(`   ${devices.length} device(s) | ${payload.ambients.length} ambient(s)`);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Provisioning failed: HTTP ${res.status} ${text}`);
    }

    const result = await res.json();
    const jobId: string = result.jobId ?? `job-${Date.now()}`;

    if (result.jobId) {
      await this.pollJobLogs(jobId, onLog);
    }

    return { success: true, jobId };
  }
}
