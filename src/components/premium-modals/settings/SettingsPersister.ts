import { SettingsError, SettingsPersister } from './types';

// RFC-0078: JSON Schema Types
interface InstantaneousPowerLimits {
  version: string;
  limitsByInstantaneoustPowerType: TelemetryTypeLimits[];
}

interface TelemetryTypeLimits {
  telemetryType: string;
  itemsByDeviceType: DeviceTypeLimits[];
}

interface DeviceTypeLimits {
  deviceType: string;
  name: string;
  description: string;
  limitsByDeviceStatus: StatusLimits[];
}

interface StatusLimits {
  deviceStatusName: string;
  limitsValues: {
    baseValue: number;
    topValue: number;
  };
}

export class DefaultSettingsPersister implements SettingsPersister {
  private jwtToken: string;
  private tbBaseUrl: string;
  private deviceType: string;
  private deviceProfile: string | null;
  private existingMapInstantaneousPower: InstantaneousPowerLimits | null;

  constructor(jwtToken: string, apiConfig?: any) {
    this.jwtToken = jwtToken;
    this.tbBaseUrl = apiConfig?.tbBaseUrl || window.location.origin;
    this.deviceType = apiConfig?.deviceType || 'ELEVADOR';
    this.deviceProfile = apiConfig?.deviceProfile || null;
    this.existingMapInstantaneousPower = apiConfig?.mapInstantaneousPower || null;
  }

  /**
   * RFC-0086: Resolve effective device type
   * When deviceType is 3F_MEDIDOR, use deviceProfile as the actual type
   */
  private getEffectiveDeviceType(): string {
    const normalizedType = (this.deviceType || '').toUpperCase();

    if (normalizedType === '3F_MEDIDOR') {
      const profile = (this.deviceProfile || '').toUpperCase();
      if (profile && profile !== 'N/D' && profile.trim() !== '') {
        console.log(`[SettingsPersister] RFC-0086: Resolved 3F_MEDIDOR → ${profile}`);
        return profile;
      }
    }

    return normalizedType || 'ELEVADOR';
  }

  async saveEntityLabel(deviceId: string, label: string): Promise<{ ok: boolean; error?: SettingsError }> {
    try {
      // 1. Get current device entity
      const getRes = await fetch(`${this.tbBaseUrl}/api/device/${deviceId}`, {
        headers: { 'X-Authorization': `Bearer ${this.jwtToken}` }
      });

      if (!getRes.ok) {
        throw this.createHttpError(getRes.status, await getRes.text().catch(() => ''));
      }

      const device = await getRes.json();

      // 2. Update device with new label using POST (ThingsBoard only accepts POST)
      const postRes = await fetch(`${this.tbBaseUrl}/api/device`, {
        method: 'POST',
        headers: {
          'X-Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...device, label: this.sanitizeLabel(label) })
      });

      if (!postRes.ok) {
        throw this.createHttpError(postRes.status, await postRes.text().catch(() => ''));
      }

      return { ok: true };

    } catch (error) {
      console.error('[SettingsPersister] Entity label save failed:', error);
      return { ok: false, error: this.mapError(error) };
    }
  }

  async saveServerScopeAttributes(
    deviceId: string,
    attributes: Record<string, unknown>
  ): Promise<{ ok: boolean; updatedKeys?: string[]; error?: SettingsError }> {
    try {
      // 1. Cria uma cópia dos atributos para manipular o payload sem alterar o original
      const payload: Record<string, any> = { ...attributes };

      // 2. Resolve o tipo de dispositivo efetivo (ex: trata o caso 3F_MEDIDOR -> ELEVADOR)
      const effectiveDeviceType = this.getEffectiveDeviceType();

      // 3. Constrói o JSON de Override específico para este dispositivo
      // Usa os dados "planos" do formulário para montar a estrutura RFC-0086
      const deviceJson = this.buildDevicePowerJson(payload, effectiveDeviceType);

      // 4. Se houver JSON gerado (algum valor foi editado), adiciona ao payload na chave correta
      if (deviceJson) {
        payload.deviceMapInstaneousPower = deviceJson;
      }

      // 5. LIMPEZA CRÍTICA: Remove os campos "planos" do formulário do payload.
      // Se não removermos, o ThingsBoard salvará atributos soltos como "standbyLimitDownConsumption",
      // sujando o banco de dados e confundindo a leitura futura.
      const flatKeysToRemove = [
        'telemetryType',
        'standbyLimitDownConsumption', 'standbyLimitUpConsumption',
        'normalLimitDownConsumption', 'normalLimitUpConsumption',
        'alertLimitDownConsumption', 'alertLimitUpConsumption',
        'failureLimitDownConsumption', 'failureLimitUpConsumption'
      ];

      flatKeysToRemove.forEach(key => delete payload[key]);

      console.log('[SettingsPersister] Saving Server Scope Attributes:', payload);

      const res = await fetch(
        `${this.tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`,
        {
          method: 'POST',
          headers: {
            'X-Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        throw this.createHttpError(res.status, await res.text().catch(() => ''));
      }

      return {
        ok: true,
        updatedKeys: Object.keys(payload)
      };

    } catch (error) {
      console.error('[SettingsPersister] Attributes save failed:', error);
      return { ok: false, error: this.mapError(error) };
    }
  }

  /**
   * Constrói o JSON Reduzido (apenas o deviceType atual) para salvar no Device.
   * Retorna null se nenhum campo de potência estiver presente.
   */
  private buildDevicePowerJson(formData: Record<string, any>, deviceType: string): object | null {
    const statuses = ['standby', 'normal', 'alert', 'failure'];

    // Verifica se existe algum dado de limite no formulário
    const hasPowerData = statuses.some(status =>
      (formData[`${status}LimitDownConsumption`] !== undefined && formData[`${status}LimitDownConsumption`] !== "") ||
      (formData[`${status}LimitUpConsumption`] !== undefined && formData[`${status}LimitUpConsumption`] !== "")
    );

    // Se não houver dados de potência, não gera o JSON (mantém o anterior ou não salva nada)
    if (!hasPowerData) return null;

    const statusMap: Record<string, string> = {
      'standby': 'standBy',
      'normal': 'normal',
      'alert': 'alert',
      'failure': 'failure'
    };

    const limitsList: any[] = [];

    statuses.forEach(statusKey => {
      const down = formData[`${statusKey}LimitDownConsumption`];
      const up = formData[`${statusKey}LimitUpConsumption`];

      // Só adiciona o bloco do status se houver pelo menos um valor válido
      if ((down !== undefined && down !== "") || (up !== undefined && up !== "")) {
        limitsList.push({
          deviceStatusName: statusMap[statusKey],
          limitsValues: {
            // Converte para Number ou null
            baseValue: (down !== "" && down !== undefined) ? Number(down) : null,
            topValue: (up !== "" && up !== undefined) ? Number(up) : null
          }
        });
      }
    });

    if (limitsList.length === 0) return null;

    // Estrutura RFC-0086
    return {
      version: "1.0.0",
      limitsByInstantaneoustPowerType: [
        {
          telemetryType: "consumption",
          itemsByDeviceType: [
            {
              deviceType: deviceType,
              // Gera um nome descritivo interno
              name: `deviceMapInstaneousPower${this.formatDeviceTypeName(deviceType)}`,
              description: "Override manual configurado via Dashboard",
              limitsByDeviceStatus: limitsList
            }
          ]
        }
      ]
    };
  }

  /**
   * Helper para formatar o nome do tipo (PascalCase) para uso no campo "name" do JSON
   */
  private formatDeviceTypeName(deviceType: string): string {
    if (!deviceType) return '';
    // Ex: ELEVADOR -> Elevador (Simples Capitalização)
    return deviceType.charAt(0).toUpperCase() + deviceType.slice(1).toLowerCase();
  }

  /**
   * RFC-0086: Build mapInstantaneousPower JSON structure from form data
   * IMPORTANT: When saving to a DEVICE, only include entries for the specific deviceType
   * Uses getEffectiveDeviceType() to resolve 3F_MEDIDOR → deviceProfile
   */
  private buildMapInstantaneousPower(formData: Record<string, unknown>): InstantaneousPowerLimits {
    // RFC-0086: Get effective device type (resolves 3F_MEDIDOR → deviceProfile)
    const effectiveDeviceType = this.getEffectiveDeviceType();

    // Find or create telemetry type entry
    const telemetryType = String(formData.telemetryType || 'consumption');

    // RFC-0086: Build a NEW filtered structure containing ONLY the current device type
    // This ensures we don't save entries for other device types (ELEVADOR, MOTOR, etc.)
    // when saving to a specific DEVICE
    const result: InstantaneousPowerLimits = {
      version: '1.0.0',
      limitsByInstantaneoustPowerType: [
        {
          telemetryType,
          itemsByDeviceType: [
            {
              deviceType: effectiveDeviceType,
              name: `mapInstantaneousPower${this.formatDeviceTypeName(effectiveDeviceType)}`,
              description: formData.identifier
                ? `Limites customizados para ${formData.identifier}`
                : `Limites de potência customizados para ${effectiveDeviceType}`,
              limitsByDeviceStatus: [
                {
                  deviceStatusName: 'standBy',
                  limitsValues: {
                    baseValue: Number(formData.standbyLimitDownConsumption) || 0,
                    topValue: Number(formData.standbyLimitUpConsumption) || 0
                  }
                },
                {
                  deviceStatusName: 'normal',
                  limitsValues: {
                    baseValue: Number(formData.normalLimitDownConsumption) || 0,
                    topValue: Number(formData.normalLimitUpConsumption) || 0
                  }
                },
                {
                  deviceStatusName: 'alert',
                  limitsValues: {
                    baseValue: Number(formData.alertLimitDownConsumption) || 0,
                    topValue: Number(formData.alertLimitUpConsumption) || 0
                  }
                },
                {
                  deviceStatusName: 'failure',
                  limitsValues: {
                    baseValue: Number(formData.failureLimitDownConsumption) || 0,
                    topValue: Number(formData.failureLimitUpConsumption) || 0
                  }
                }
              ]
            }
          ]
        }
      ]
    };

    console.log(`[SettingsPersister] RFC-0086: Built mapInstantaneousPower for deviceType=${effectiveDeviceType}:`, result);
    return result;
  }

  private sanitizeLabel(label: string): string {
    return label
      .trim()
      .slice(0, 255) // Max length
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
  }

  private createHttpError(status: number, body: string): Error {
    const error = new Error(`HTTP ${status}: ${body}`);
    (error as any).status = status;
    (error as any).body = body;
    return error;
  }

  private mapError(error: any): SettingsError {
    const status = error.status;

    if (status === 400) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        userAction: 'FIX_INPUT',
        cause: error
      };
    }

    if (status === 401) {
      return {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
        userAction: 'RE_AUTH',
        cause: error
      };
    }

    if (status === 403) {
      return {
        code: 'AUTH_ERROR',
        message: 'Insufficient permissions',
        userAction: 'RE_AUTH',
        cause: error
      };
    }

    if (status === 404) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Device not found',
        userAction: 'CONTACT_ADMIN',
        cause: error
      };
    }

    if (status === 409) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Concurrent modification detected',
        userAction: 'RETRY',
        cause: error
      };
    }

    if (status >= 500) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Server error occurred',
        userAction: 'RETRY',
        cause: error
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      userAction: 'CONTACT_ADMIN',
      cause: error
    };
  }
}
