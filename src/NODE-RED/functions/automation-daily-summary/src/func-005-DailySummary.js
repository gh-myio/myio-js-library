/**
 * func-005-DailySummary.js
 *
 * Generates intelligent daily summaries of automation events by analyzing D-1 (yesterday's) logs.
 * Detects state changes, calculates metrics, identifies anomalies, and sends to ThingsBoard.
 *
 * Execution: Daily at 03:00 AM
 * Input: flow.get('automation_logs')
 * Output:
 *   1. flow.set('daily_summaries') - Detailed per-device summaries
 *   2. msg.payload - ThingsBoard telemetry for virtual device "automation-log"
 *
 * @see RFC-0002-automation-daily-summary.md for detailed specification
 */

/**
 * Get yesterday's date (D-1) in YYYY-MM-DD format
 */
function getYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Extract date from log key (automation_log_DeviceName_timestamp)
 */
function extractDateFromLog(logKey, timestampMs) {
  if (timestampMs) {
    const date = new Date(timestampMs);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Filter logs for D-1 (yesterday) and group by device
 */
function filterAndGroupLogs(allLogs, targetDate) {
  const groupedByDevice = {};

  for (const [logKey, logData] of Object.entries(allLogs)) {
    if (!logData || !logData.device) continue;

    const logDate = extractDateFromLog(logKey, logData.timestampMs);

    if (logDate === targetDate) {
      const deviceName = logData.device;

      if (!groupedByDevice[deviceName]) {
        groupedByDevice[deviceName] = [];
      }

      groupedByDevice[deviceName].push({
        key: logKey,
        data: logData
      });
    }
  }

  return groupedByDevice;
}

/**
 * Detect state changes in sorted logs
 */
function detectStateChanges(logs) {
  const changes = [];
  let previousState = null;
  let stateStartTime = null;

  for (const log of logs) {
    const currentState = {
      shouldActivate: log.data.shouldActivate,
      shouldShutdown: log.data.shouldShutdown,
      reason: log.data.reason
    };

    // First log or state changed
    if (!previousState ||
        previousState.shouldActivate !== currentState.shouldActivate) {

      const durationInPreviousState = stateStartTime
        ? (log.data.timestampMs - stateStartTime) / (1000 * 60 * 60) // hours
        : 0;

      changes.push({
        timestamp: log.data.timestamp,
        timestampMs: log.data.timestampMs,
        from: previousState,
        to: currentState,
        durationInPreviousState: previousState ? durationInPreviousState : 0
      });

      stateStartTime = log.data.timestampMs;
    }

    previousState = currentState;
  }

  return changes;
}

/**
 * Calculate time-based metrics
 */
function calculateMetrics(stateChanges, dayStart, dayEnd, logs) {
  let timeActive = 0;
  let timeInactive = 0;
  let activationCount = 0;
  let deactivationCount = 0;

  if (stateChanges.length === 0) {
    // No state changes - check first log to determine static state
    if (logs.length > 0 && logs[0].data.shouldActivate) {
      timeActive = 24;
    } else {
      timeInactive = 24;
    }

    return {
      totalStateChanges: 0,
      timeActive: timeActive,
      timeInactive: timeInactive,
      activationCount: 0,
      deactivationCount: 0,
      averageActiveSessionDuration: 0,
      averageInactiveSessionDuration: 0
    };
  }

  let currentState = stateChanges[0].to.shouldActivate;
  let stateStartTime = dayStart;

  for (const change of stateChanges) {
    const duration = (change.timestampMs - stateStartTime) / (1000 * 60 * 60); // hours

    if (currentState) {
      timeActive += duration;
    } else {
      timeInactive += duration;
    }

    // Count activations/deactivations
    if (change.to.shouldActivate && !change.from?.shouldActivate) {
      activationCount++;
    } else if (!change.to.shouldActivate && change.from?.shouldActivate) {
      deactivationCount++;
    }

    currentState = change.to.shouldActivate;
    stateStartTime = change.timestampMs;
  }

  // Add remaining time until end of day
  const remainingDuration = (dayEnd - stateStartTime) / (1000 * 60 * 60);
  if (currentState) {
    timeActive += remainingDuration;
  } else {
    timeInactive += remainingDuration;
  }

  return {
    totalStateChanges: stateChanges.length,
    timeActive: Math.round(timeActive * 100) / 100,
    timeInactive: Math.round(timeInactive * 100) / 100,
    activationCount: activationCount,
    deactivationCount: deactivationCount,
    averageActiveSessionDuration: activationCount > 0
      ? Math.round((timeActive / activationCount) * 100) / 100
      : 0,
    averageInactiveSessionDuration: deactivationCount > 0
      ? Math.round((timeInactive / deactivationCount) * 100) / 100
      : 0
  };
}

/**
 * Detect anomalies in device behavior
 */
function detectAnomalies(metrics, totalLogs, stateChanges) {
  const anomalies = [];

  // No logs for device
  if (totalLogs === 0) {
    anomalies.push({
      type: 'no_logs',
      severity: 'error',
      description: 'No logs found for this device on D-1'
    });
    return anomalies;
  }

  // Never activated
  if (metrics.activationCount === 0) {
    anomalies.push({
      type: 'never_activated',
      severity: 'warning',
      description: 'Device never activated during D-1'
    });
  }

  // Excessive state changes (more than 10 per day)
  if (metrics.totalStateChanges > 10) {
    anomalies.push({
      type: 'excessive_changes',
      severity: 'warning',
      count: metrics.totalStateChanges,
      description: `Device had ${metrics.totalStateChanges} state changes (expected < 10)`
    });
  }

  // Always active (less than 6 minutes inactive)
  if (metrics.timeInactive < 0.1 && totalLogs > 0) {
    anomalies.push({
      type: 'always_active',
      severity: 'info',
      description: 'Device was active for almost entire day'
    });
  }

  return anomalies;
}

/**
 * Generate summary for a single device
 */
function generateDeviceSummary(deviceName, logs, targetDate) {
  // Sort logs by timestamp
  logs.sort((a, b) => a.data.timestampMs - b.data.timestampMs);

  // Day boundaries
  const dayStart = new Date(targetDate + 'T00:00:00.000Z').getTime();
  const dayEnd = new Date(targetDate + 'T23:59:59.999Z').getTime();

  // Detect state changes
  const stateChanges = detectStateChanges(logs);

  // Calculate metrics
  const metrics = calculateMetrics(stateChanges, dayStart, dayEnd, logs);

  // Detect anomalies
  const anomalies = detectAnomalies(metrics, logs.length, stateChanges);

  // Extract schedule info from first log
  const schedule = logs[0]?.data.schedule || null;

  // Get global AutoON state from logs
  const globalAutoOn = logs[0]?.data.context?.globalAutoOn || 'undefined';

  return {
    device: deviceName,
    deviceId: logs[0]?.data.deviceId || 'unknown',
    date: targetDate,
    totalLogs: logs.length,
    stateChanges: stateChanges,
    metrics: metrics,
    schedule: schedule,
    firstLog: logs[0]?.data.timestamp,
    lastLog: logs[logs.length - 1]?.data.timestamp,
    anomalies: anomalies,
    globalAutoOn: globalAutoOn,
    generatedAt: new Date().toISOString(),
    generatedBy: 'func-005-DailySummary',
    version: '1.0.0'
  };
}

/**
 * Format summaries for ThingsBoard telemetry
 */
function formatThingsBoardTelemetry(allSummaries, generatedAt, targetDate) {
  const devices = {};
  let totalDevices = 0;

  for (const [key, summary] of Object.entries(allSummaries)) {
    devices[summary.device] = {
      totalLogs: summary.totalLogs,
      stateChanges: summary.metrics.totalStateChanges,
      timeActive: summary.metrics.timeActive,
      timeInactive: summary.metrics.timeInactive,
      activationCount: summary.metrics.activationCount,
      deactivationCount: summary.metrics.deactivationCount,
      anomalies: summary.anomalies.length > 0
        ? summary.anomalies.map(a => a.type)
        : []
    };
    totalDevices++;
  }

  // Format as ThingsBoard telemetry (following func-004 pattern)
  const telemetryMap = {};
  telemetryMap["automation-log"] = [{
    ts: generatedAt,
    values: {
      daily_summary: {
        date: targetDate,
        totalDevices: totalDevices,
        devices: devices
      }
    }
  }];

  return telemetryMap;
}

/**
 * Main daily summary function
 */
function dailySummary(msg, node, flow) {
  try {
    const generatedAt = Date.now();
    const targetDate = getYesterdayDate();

    node.log(`DailySummary: Starting analysis for ${targetDate}`);

    // Load all automation logs
    const allLogs = flow.get('automation_logs') || {};

    if (Object.keys(allLogs).length === 0) {
      node.warn(`DailySummary: No automation logs found`);
      return null;
    }

    // Filter and group logs by device
    const groupedLogs = filterAndGroupLogs(allLogs, targetDate);

    if (Object.keys(groupedLogs).length === 0) {
      node.warn(`DailySummary: No logs found for ${targetDate}`);
      return null;
    }

    // Generate summary for each device
    const dailySummaries = {};
    let deviceCount = 0;

    for (const [deviceName, logs] of Object.entries(groupedLogs)) {
      const summaryKey = `daily_summary_${deviceName.replace(/\s+/g, '')}_${targetDate}`;
      dailySummaries[summaryKey] = generateDeviceSummary(deviceName, logs, targetDate);
      deviceCount++;
    }

    // Store summaries in flow context
    flow.set('daily_summaries', dailySummaries);

    node.log(`DailySummary: Generated summaries for ${deviceCount} devices on ${targetDate}`);

    // Format for ThingsBoard
    const telemetryPayload = formatThingsBoardTelemetry(dailySummaries, generatedAt, targetDate);

    // Return message with ThingsBoard telemetry
    msg.payload = telemetryPayload;

    node.log(`DailySummary: Formatted telemetry for virtual device "automation-log"`);

    return msg;

  } catch (error) {
    node.error(`DailySummary: Error generating summary - ${error.message}`);
    return null;
  }
}

// Node-RED function execution
const result = dailySummary(msg, node, flow);
return result;
