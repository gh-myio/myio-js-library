/**
 * Mock Telemetry Data Generator for Demand Modal Demos
 * Generates realistic consumption data that simulates ThingsBoard telemetry format
 */

export interface MockTelemetryOptions {
  startDate: string;           // ISO date string "YYYY-MM-DD"
  endDate: string;             // ISO date string "YYYY-MM-DD"
  baseConsumption?: number;    // Base daily consumption in Wh (default: 50000)
  peakMultiplier?: number;     // Peak hour multiplier (default: 2.5)
  pattern?: 'normal' | 'high' | 'low' | 'variable'; // Consumption pattern
  dataGaps?: boolean;          // Include some data gaps (default: false)
  noiseLevel?: number;         // Random noise level 0-1 (default: 0.1)
}

export interface TelemetryDataPoint {
  ts: number;                  // Timestamp in milliseconds
  value: string;               // Cumulative consumption value as string
}

/**
 * Generates realistic mock telemetry data for demand modal demos
 */
export function generateMockTelemetryData(options: MockTelemetryOptions): TelemetryDataPoint[] {
  const {
    startDate,
    endDate,
    baseConsumption = 50000,     // 50 kWh per day base
    peakMultiplier = 2.5,
    pattern = 'normal',
    dataGaps = false,
    noiseLevel = 0.1
  } = options;

  const startTs = new Date(startDate + 'T00:00:00').getTime();
  const endTs = new Date(endDate + 'T23:59:59').getTime();
  const intervalMs = 15 * 60 * 1000; // 15-minute intervals
  
  const data: TelemetryDataPoint[] = [];
  let cumulativeConsumption = 0;

  // Pattern multipliers
  const patternMultipliers = {
    normal: 1.0,
    high: 1.8,
    low: 0.6,
    variable: 1.0 // Will vary throughout the day
  };

  const baseMultiplier = patternMultipliers[pattern];

  for (let ts = startTs; ts <= endTs; ts += intervalMs) {
    const date = new Date(ts);
    const hour = date.getHours();
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Skip some data points to simulate gaps
    if (dataGaps && Math.random() < 0.05) {
      continue;
    }

    // Calculate hourly consumption based on realistic patterns
    let hourlyConsumption = baseConsumption / 24 / 4; // Base 15-min consumption
    
    // Business hours pattern (higher consumption 8 AM - 10 PM)
    if (hour >= 8 && hour <= 22) {
      hourlyConsumption *= peakMultiplier;
    } else if (hour >= 6 && hour <= 7) {
      // Morning ramp-up
      hourlyConsumption *= 1.5;
    } else if (hour >= 23 || hour <= 5) {
      // Night time (lower consumption)
      hourlyConsumption *= 0.3;
    }

    // Weekend pattern (slightly lower consumption)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      hourlyConsumption *= 0.8;
    }

    // Variable pattern - changes throughout the period
    if (pattern === 'variable') {
      const daysSinceStart = (ts - startTs) / (1000 * 60 * 60 * 24);
      const variableMultiplier = 0.7 + 0.6 * Math.sin(daysSinceStart * 0.5) + 0.3 * Math.cos(daysSinceStart * 0.3);
      hourlyConsumption *= variableMultiplier;
    }

    // Apply base pattern multiplier
    hourlyConsumption *= baseMultiplier;

    // Add random noise
    const noise = 1 + (Math.random() - 0.5) * 2 * noiseLevel;
    hourlyConsumption *= noise;

    // Ensure minimum consumption
    hourlyConsumption = Math.max(hourlyConsumption, 100); // Minimum 100 Wh per 15 min

    // Add to cumulative consumption
    cumulativeConsumption += hourlyConsumption;

    data.push({
      ts,
      value: cumulativeConsumption.toFixed(2)
    });
  }

  return data;
}

/**
 * Creates a mock fetcher function for use with openDemandModal
 */
export function createMockTelemetryFetcher(options?: Partial<MockTelemetryOptions>) {
  return async (params: { token: string; deviceId: string; startDate: string; endDate: string }) => {
    console.log('[MOCK] Generating telemetry data for:', params);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
    
    const mockOptions: MockTelemetryOptions = {
      startDate: params.startDate,
      endDate: params.endDate,
      ...options
    };

    const data = generateMockTelemetryData(mockOptions);
    
    console.log(`[MOCK] Generated ${data.length} data points`);
    console.log('[MOCK] Sample data:', data.slice(0, 3));
    
    return data;
  };
}

/**
 * Predefined mock scenarios for demos
 */
export const MOCK_SCENARIOS = {
  normal: {
    pattern: 'normal' as const,
    baseConsumption: 45000,
    peakMultiplier: 2.2,
    noiseLevel: 0.08,
    description: 'Normal business consumption pattern'
  },
  
  highDemand: {
    pattern: 'high' as const,
    baseConsumption: 75000,
    peakMultiplier: 3.0,
    noiseLevel: 0.12,
    description: 'High demand scenario (busy shopping center)'
  },
  
  lowDemand: {
    pattern: 'low' as const,
    baseConsumption: 25000,
    peakMultiplier: 1.8,
    noiseLevel: 0.06,
    description: 'Low demand scenario (small store)'
  },
  
  variable: {
    pattern: 'variable' as const,
    baseConsumption: 55000,
    peakMultiplier: 2.5,
    noiseLevel: 0.15,
    description: 'Variable consumption with seasonal patterns'
  },
  
  withGaps: {
    pattern: 'normal' as const,
    baseConsumption: 50000,
    peakMultiplier: 2.3,
    dataGaps: true,
    noiseLevel: 0.1,
    description: 'Normal pattern with some data gaps'
  }
};

/**
 * Creates a mock fetcher for a specific scenario
 */
export function createScenarioFetcher(scenarioKey: keyof typeof MOCK_SCENARIOS) {
  const scenario = MOCK_SCENARIOS[scenarioKey];
  return createMockTelemetryFetcher(scenario);
}
