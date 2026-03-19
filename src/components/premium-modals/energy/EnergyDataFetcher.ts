// energy/EnergyDataFetcher.ts - Data API integration for energy telemetry

import { AuthClient } from '../internal/engines/AuthClient';
import { 
  DataFetcherConfig, 
  EnergyData, 
  EnergyDataParams, 
  EnergyModalError 
} from './types';
import { generateDateRange, mapHttpError, createSafeErrorMessage } from './utils';

export class EnergyDataFetcher {
  private config: DataFetcherConfig;
  private authClient: AuthClient | null = null;

  constructor(config: DataFetcherConfig) {
    this.config = {
      dataApiHost: config.dataApiHost || 'https://api.data.apps.myio-bas.com',
      ...config
    };

    // Create AuthClient when clientId/clientSecret are provided
    // SDK charts require client credentials for authentication
    if (config.clientId && config.clientSecret) {
      this.authClient = new AuthClient({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        base: this.config.dataApiHost
      });
    }
  }

  /**
   * Fetches energy data from the Data API
   */
  async fetchEnergyData(params: EnergyDataParams): Promise<EnergyData> {
    try {
      const token = await this.getAuthToken();
      
      const url = this.buildEnergyApiUrl(params);
      
      console.log('[EnergyDataFetcher] Fetching energy data:', { 
        url: url.replace(/Bearer\s+[^\s&]+/gi, 'Bearer [REDACTED]'),
        ingestionId: params.ingestionId,
        granularity: params.granularity
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const error = mapHttpError(response.status, errorText);
        console.error('[EnergyDataFetcher] API request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: error
        });
        throw new Error(`Energy data fetch failed: ${error.message}`);
      }

      const apiResponse = await response.json();
      console.log('[EnergyDataFetcher] API response received:', {
        hasData: !!apiResponse.data,
        dataLength: Array.isArray(apiResponse.data) ? apiResponse.data.length : 0
      });

      return this.processEnergyResponse(apiResponse, params);

    } catch (error) {
      console.error('[EnergyDataFetcher] Error fetching energy data:', error);
      
      // If it's already an EnergyModalError, re-throw it
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      
      // Otherwise, wrap it in a safe error
      throw new Error(createSafeErrorMessage(error));
    }
  }

  /**
   * Gets authentication token based on available strategy
   */
  private async getAuthToken(): Promise<string> {
    // Priority 1: Direct ingestion token
    if (this.config.ingestionToken) {
      return this.config.ingestionToken;
    }

    // Priority 2: Client credentials via AuthClient
    if (this.authClient) {
      try {
        return await this.authClient.getBearer();
      } catch (error) {
        console.error('[EnergyDataFetcher] AuthClient failed:', error);
        throw new Error('Failed to obtain authentication token via client credentials');
      }
    }

    throw new Error('No authentication method available. Provide either ingestionToken or clientId/clientSecret.');
  }

  /**
   * Builds the energy API URL with parameters
   */
  private buildEnergyApiUrl(params: EnergyDataParams): string {
    const baseUrl = this.config.dataApiHost;
    const endpoint = `/api/v1/telemetry/devices/${params.ingestionId}/energy`;
    
    const queryParams = new URLSearchParams({
      startTime: params.startISO,
      endTime: params.endISO,
      granularity: params.granularity,
      page: '1',
      pageSize: '1000',
      deep: '0'
    });

    return `${baseUrl}${endpoint}?${queryParams.toString()}`;
  }

  /**
   * Processes the API response into EnergyData format
   */
  private processEnergyResponse(apiResponse: any, params: EnergyDataParams): EnergyData {
    // Handle different response formats
    const dataArray = Array.isArray(apiResponse) 
      ? apiResponse 
      : (apiResponse.data || []);
    
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      console.warn('[EnergyDataFetcher] Empty or invalid API response, creating zero-filled data');
      return this.createEmptyEnergyData(params);
    }

    // Extract device data (first device in response)
    const deviceData = dataArray[0];
    const consumption = deviceData.consumption || [];

    console.log('[EnergyDataFetcher] Processing device data:', {
      deviceId: deviceData.deviceId || params.ingestionId,
      consumptionPoints: consumption.length
    });

    // Build consumption data points
    const consumptionPoints = consumption
      .map((item: any) => ({
        timestamp: item.timestamp,
        value: Number(item.value) || 0
      }))
      .filter((item: any) => item.timestamp) // Filter out invalid timestamps
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // If we have no valid consumption points, create zero-filled data
    if (consumptionPoints.length === 0) {
      console.warn('[EnergyDataFetcher] No valid consumption points found, creating zero-filled data');
      return this.createEmptyEnergyData(params);
    }

    return {
      deviceId: deviceData.deviceId || params.ingestionId,
      consumption: consumptionPoints,
      granularity: params.granularity,
      dateRange: {
        start: params.startISO,
        end: params.endISO
      }
    };
  }

  /**
   * Creates empty energy data with zero-filled date range
   */
  private createEmptyEnergyData(params: EnergyDataParams): EnergyData {
    const dateRange = generateDateRange(params.startISO, params.endISO, params.granularity);
    
    return {
      deviceId: params.ingestionId,
      consumption: dateRange.map(date => ({
        timestamp: date,
        value: 0
      })),
      granularity: params.granularity,
      dateRange: {
        start: params.startISO,
        end: params.endISO
      }
    };
  }

  /**
   * Clears any cached authentication tokens
   */
  clearCache(): void {
    if (this.authClient) {
      this.authClient.clearCache();
    }
  }

  /**
   * Gets configuration for debugging
   */
  getConfig(): Partial<DataFetcherConfig> {
    return {
      dataApiHost: this.config.dataApiHost,
      // Don't expose sensitive tokens/credentials
      ingestionToken: this.config.ingestionToken ? '[REDACTED]' : undefined,
      clientId: this.config.clientId || undefined,
      clientSecret: this.config.clientSecret ? '[REDACTED]' : undefined
    };
  }
}
