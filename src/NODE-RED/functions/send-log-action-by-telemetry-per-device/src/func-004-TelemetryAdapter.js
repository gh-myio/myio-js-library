/**
 * func-004-TelemetryAdapter.js
 *
 * Transforms automation log events into ThingsBoard telemetry format.
 * Receives output from func-002-PersistAdapter and formats it for MQTT transmission.
 *
 * Input: { payload: { key: string, value: LogData } }
 * Output: { payload: { [deviceName]: [{ ts: number, values: { automation_log: object } }] } }
 *
 * @see RFC-0001-telemetry-automation-logs.md for detailed specification
 */

/**
 * Main telemetry adapter function
 * Transforms persisted automation logs into ThingsBoard telemetry format
 */
function telemetryAdapter(msg, node) {
    try {
        // Validate input
        if (!msg || !msg.payload) {
            node.warn('TelemetryAdapter: Missing message payload');
            return null;
        }

        const logData = msg.payload.value;

        // Validate log data
        if (!logData) {
            node.warn('TelemetryAdapter: Missing log data in payload.value');
            return null;
        }

        // Extract device name
        const deviceName = logData.device;
        if (!deviceName) {
            node.error('TelemetryAdapter: Missing device name in log data');
            return null;
        }

        // Extract timestamp (with fallback)
        const timestampMs = logData.timestampMs || Date.now();

        // Build automation_log object (excluding device name and timestamp)
        const automation_log = {
            action: logData.action,
            shouldActivate: logData.shouldActivate,
            shouldShutdown: logData.shouldShutdown,
            reason: logData.reason
        };

        // Include schedule if present
        if (logData.schedule) {
            automation_log.schedule = logData.schedule;
        }

        // Include context if present (optional - can be verbose)
        // Uncomment if context is needed in ThingsBoard
        // if (logData.context) {
        //     automation_log.context = logData.context;
        // }

        // Format as ThingsBoard telemetry
        const telemetryMap = {};
        telemetryMap[deviceName] = [{
            ts: timestampMs,
            values: {
                automation_log: automation_log
            }
        }];

        // Log successful transformation
        node.log(`TelemetryAdapter: Formatted telemetry for device "${deviceName}" - action: ${logData.action}`);

        // Return formatted message
        msg.payload = telemetryMap;
        return msg;

    } catch (error) {
        node.error(`TelemetryAdapter: Error transforming log - ${error.message}`);
        return null;
    }
}

// Node-RED function execution
const result = telemetryAdapter(msg, node);
return result;
