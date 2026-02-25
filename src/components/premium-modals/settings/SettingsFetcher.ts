import { SettingsFetcher, TbScope } from "./types";

export class DefaultSettingsFetcher implements SettingsFetcher {
  private jwtToken: string;
  private tbBaseUrl: string;
  private static readonly FETCH_TIMEOUT_MS = 8000; // 8 second timeout

  constructor(jwtToken: string, apiConfig?: any) {
    this.jwtToken = jwtToken;
    this.tbBaseUrl = apiConfig?.tbBaseUrl || window.location.origin;
  }

  /**
   * Fetch with timeout to prevent hanging requests from blocking modal render
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = DefaultSettingsFetcher.FETCH_TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async fetchCurrentSettings(
    deviceId: string,
    jwtToken: string,
    scope: TbScope = "SERVER_SCOPE"
  ): Promise<{
    entity?: { label?: string };
    attributes?: Record<string, unknown>;
  }> {
    try {
      const [entityResult, attributesResult] = await Promise.allSettled([
        this.fetchDeviceEntity(deviceId),
        this.fetchDeviceAttributes(deviceId, scope),
      ]);

      const result: {
        entity?: { label?: string };
        attributes?: Record<string, unknown>;
      } = {};

      // Handle entity result
      if (entityResult.status === "fulfilled") {
        result.entity = entityResult.value;
      } else {
        console.warn(
          "[SettingsFetcher] Failed to fetch device entity:",
          entityResult.reason
        );
      }

      // Handle attributes result
      if (attributesResult.status === "fulfilled") {
        result.attributes = attributesResult.value;
      } else {
        console.warn(
          "[SettingsFetcher] Failed to fetch device attributes:",
          attributesResult.reason
        );
      }

      return result;
    } catch (error) {
      console.error(
        "[SettingsFetcher] Failed to fetch current settings:",
        error
      );
      // Return empty object to allow form to render with defaults
      return {};
    }
  }

  private async fetchDeviceEntity(
    deviceId: string
  ): Promise<{ label?: string; createdTime?: number | null }> {
    const response = await this.fetchWithTimeout(
      `${this.tbBaseUrl}/api/device/${deviceId}`,
      {
        headers: { "X-Authorization": `Bearer ${this.jwtToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch device entity: ${response.status} ${response.statusText}`
      );
    }

    const device = await response.json();
    return {
      label: device.label || "",
      createdTime: device.createdTime ?? null,
    };
  }

  private async fetchDeviceAttributes(
    deviceId: string,
    scope: TbScope
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchWithTimeout(
      `${this.tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/${scope}`,
      {
        headers: { "X-Authorization": `Bearer ${this.jwtToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch device attributes: ${response.status} ${response.statusText}`
      );
    }

    const attributesArray = await response.json();

    // Convert array format to object and map API fields to form fields
    const attributes: Record<string, unknown> = {};

    for (const attr of attributesArray) {
      if (
        attr.key &&
        attr.value !== undefined &&
        attr.value !== null &&
        attr.value !== ""
      ) {
        if (attr.key === "floor") {
          attributes.floor = attr.value; // floor -> Andar
        } else if (attr.key === "identifier") {
          attributes.identifier = attr.value; // identifier -> Número da Loja (read-only)
        } else if (attr.key === "mapInstantaneousPower") {
          attributes.mapInstantaneousPower = attr.value;
        } else if (attr.key === "deviceMapInstaneousPower") {
          attributes.deviceMapInstaneousPower = attr.value;
        } else if (attr.key === "offSetTemperature") {
          // Temperature offset for TERMOSTATO devices (stored in SERVER_SCOPE)
          attributes.offSetTemperature = attr.value;
        } else if (attr.key === "minTemperature") {
          attributes.minTemperature = attr.value;
        } else if (attr.key === "maxTemperature") {
          attributes.maxTemperature = attr.value;
        } else if (attr.key === "lastUpdatedTime") {
          attributes.lastUpdatedTime = attr.value;
        } else if (attr.key === "gcdrDeviceId") {
          attributes.gcdrDeviceId = attr.value;
        }
      }
    }

    return attributes;
  }

  /**
   * Utility method to merge fetched settings with seed data
   */
  static mergeWithSeed(
    fetchedData: {
      entity?: { label?: string; createdTime?: number | null };
      attributes?: Record<string, unknown>;
    },
    seedData?: Record<string, any>
  ): Record<string, any> {
    const merged: Record<string, any> = {};

    // Start with seed data as base
    if (seedData) {
      Object.assign(merged, seedData);
    }

    // Override with fetched entity data
    if (fetchedData.entity?.label) {
      merged.label = fetchedData.entity.label;
    }
    if (fetchedData.entity?.createdTime != null) {
      merged.createdTime = fetchedData.entity.createdTime;
    }

    // Override with fetched attributes
    if (fetchedData.attributes) {
      Object.assign(merged, fetchedData.attributes);
    }

    return merged;
  }

static sanitizeFetchedData(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    // 1. Campos de Texto Simples
    const stringFields = [
      "label",
      "floor",
      "identifier"
    ];
    for (const field of stringFields) {
      if (data[field] && typeof data[field] === "string") {
        sanitized[field] = data[field].trim();
      }
    }

    // 2. Campos Numéricos (consumo - devem ser >= 0)
    const consumptionFields = ["maxDailyKwh", "maxNightKwh", "maxBusinessKwh"];
    for (const field of consumptionFields) {
      if (data[field] !== undefined && data[field] !== null) {
        const num = Number(data[field]);
        if (!isNaN(num) && num >= 0) {
          sanitized[field] = num;
        }
      }
    }

    // 2b. Campos Numéricos de Temperatura (podem ser negativos ou positivos)
    const temperatureFields = ["minTemperature", "maxTemperature", "offSetTemperature"];
    for (const field of temperatureFields) {
      if (data[field] !== undefined && data[field] !== null) {
        const num = Number(data[field]);
        if (!isNaN(num)) {
          // offSetTemperature: limitar entre -99.99 e +99.99
          if (field === "offSetTemperature") {
            if (num >= -99.99 && num <= 99.99) {
              sanitized[field] = num;
            }
          } else {
            sanitized[field] = num;
          }
        }
      }
    }

    // 2c. Timestamp fields (UTC long ms — stored as numbers)
    const tsFields = ["lastUpdatedTime", "createdTime"];
    for (const field of tsFields) {
      if (data[field] !== undefined && data[field] !== null) {
        const ts = Number(data[field]);
        if (!isNaN(ts) && ts > 0) {
          sanitized[field] = ts;
        }
      }
    }

    // 2d. gcdrDeviceId — string identifier for GCDR integration
    if (data["gcdrDeviceId"] && typeof data["gcdrDeviceId"] === "string") {
      sanitized["gcdrDeviceId"] = data["gcdrDeviceId"].trim();
    }

    // 3. Campos de Objeto / JSON (ESSENCIAL PARA SUA ESTRATÉGIA)
    // Sem isso, o Fetcher joga fora os seus mapas de potência
    const objectFields = ["mapInstantaneousPower", "deviceMapInstaneousPower"];
    for (const field of objectFields) {
      // Verifica se existe e se é um objeto (não string)
      if (data[field] && typeof data[field] === "object") {
        sanitized[field] = data[field];
      }
    }

    return sanitized;
  }
}
