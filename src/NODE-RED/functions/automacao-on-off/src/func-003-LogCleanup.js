/**
 * func-003-LogCleanup.js
 *
 * Automatic cleanup of old automation logs
 * Keeps only logs from the last 4 days (D-3, D-2, D-1, D0)
 *
 * Recommended execution: 1x per day (e.g., 02:00 AM)
 * Can be triggered by inject node with cron
 *
 * @see LOG-RETENTION-STRATEGY.md
 */

try {
    // Configuration: how many days to keep
    const DAYS_TO_KEEP = 4; // D-3, D-2, D-1, D0

    // Get current logs
    let storedLogs = flow.get('automation_logs') || {};
    const totalBefore = Object.keys(storedLogs).length;

    // Calculate cutoff date (D-3 = today - 3 days at 00:00:00)
    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - (DAYS_TO_KEEP - 1));
    cutoffDate.setHours(0, 0, 0, 0);
    const cutoffTimestamp = cutoffDate.getTime();

    node.log(`Starting log cleanup. Cutoff date: ${cutoffDate.toISOString()} (keeping logs >= this date)`);

    // Filter logs, keeping only recent ones
    const filteredLogs = {};
    let deletedCount = 0;

    for (const [key, logData] of Object.entries(storedLogs)) {
        // Extract timestamp from log
        // Key format: automation_log_DeviceName_timestamp
        const timestampMatch = key.match(/_(\d+)$/);

        if (!timestampMatch) {
            // If no timestamp in key, try to get from logData
            const logTimestamp = logData.timestampMs || logData.timestamp;

            if (!logTimestamp) {
                // No timestamp, keep for safety
                filteredLogs[key] = logData;
                continue;
            }

            const logDate = typeof logTimestamp === 'number'
                ? logTimestamp
                : new Date(logTimestamp).getTime();

            if (logDate >= cutoffTimestamp) {
                filteredLogs[key] = logData;
            } else {
                deletedCount++;
            }
        } else {
            const logTimestamp = parseInt(timestampMatch[1], 10);

            // Keep if >= cutoff date
            if (logTimestamp >= cutoffTimestamp) {
                filteredLogs[key] = logData;
            } else {
                deletedCount++;
            }
        }
    }

    // Update flow with filtered logs
    flow.set('automation_logs', filteredLogs);

    const totalAfter = Object.keys(filteredLogs).length;

    // Statistics
    const stats = {
        totalBefore,
        totalAfter,
        deleted: deletedCount,
        retained: totalAfter,
        cutoffDate: cutoffDate.toISOString(),
        daysKept: DAYS_TO_KEEP,
        executedAt: now.toISOString()
    };

    node.log(`Log cleanup completed: ${deletedCount} logs deleted, ${totalAfter} logs retained`);

    // Return statistics
    msg.payload = {
        success: true,
        stats
    };

    return msg;

} catch (e) {
    node.error('Error in LogCleanup: ' + e.message);
    msg.payload = {
        success: false,
        error: e.message
    };
    return msg;
}
