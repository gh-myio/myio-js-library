function classifyAllDevices(data) {
const classified = {
energy: { equipments: [], stores: [], entrada: [] },
water: { hidrometro_area_comum: [], hidrometro: [], entrada: [] },
temperature: { termostato: [], termostato_external: [] },
};

// RFC-0111: Group all rows by entityId - ThingsBoard sends 1 row per (device, dataKey)
// We need to collect ALL dataKeys for each device to get deviceType AND deviceProfile
const deviceRowsMap = new Map();

for (let i = 0; i < data.length; i++) {
const row = data[i];
const entityId = row.datasource?.entityId || row.datasource?.entity?.id?.id;

    if (!entityId) continue;

    if (!deviceRowsMap.has(entityId)) {
      deviceRowsMap.set(entityId, []);
    }
    deviceRowsMap.get(entityId).push(row);

}

LogHelper.log(`Grouping: ${data.length} rows → ${deviceRowsMap.size} unique devices`);

// Debug: log first device's rows structure
if (deviceRowsMap.size > 0) {
const firstDeviceRows = deviceRowsMap.values().next().value;
const dataKeysFound = firstDeviceRows.map((r) => r.dataKey?.name).filter(Boolean);
LogHelper.log('First device dataKeys:', dataKeysFound);
}

// Process each device with all its rows
let deviceIndex = 0;
for (const rows of deviceRowsMap.values()) {
const device = extractDeviceMetadataFromRows(rows);

    // Debug: log first 3 devices
    if (deviceIndex < 3) {
      LogHelper.log(`Device ${deviceIndex}:`, {
        id: device.id,
        name: device.name,
        deviceType: device.deviceType,
        deviceProfile: device.deviceProfile,
      });
    }

    const domain = window.MyIOLibrary.detectDomain(device);
    const context = window.MyIOLibrary.detectContext(device, domain);

    if (classified[domain]?.[context]) {
      classified[domain][context].push(device);
    }

    deviceIndex++;

}

// Log classification summary - always log this for debugging
const summary = {
energy: {
equipments: classified.energy.equipments.length,
stores: classified.energy.stores.length,
entrada: classified.energy.entrada.length,
},
water: {
area_comum: classified.water.hidrometro_area_comum.length,
lojas: classified.water.hidrometro.length,
entrada: classified.water.entrada.length,
},
temperature: {
climatizado: classified.temperature.termostato.length,
externo: classified.temperature.termostato_external.length,
},
};
LogHelper.log('[MAIN_UNIQUE] Classification summary:', JSON.stringify(summary));

// Debug: Log sample of energy/equipments devices to understand why there are so many
if (classified.energy.equipments.length > 0) {
// Count by deviceType
const typeCounts = {};
classified.energy.equipments.forEach((d) => {
const t = d.deviceType || '(empty)';
typeCounts[t] = (typeCounts[t] || 0) + 1;
});
LogHelper.log('Energy/equipments by deviceType:', typeCounts);

    const sampleSize = Math.min(10, classified.energy.equipments.length);
    const samples = classified.energy.equipments.slice(0, sampleSize).map((d) => ({
      name: d.name,
      deviceType: d.deviceType || '(empty)',
      deviceProfile: d.deviceProfile || '(empty)',
    }));
    LogHelper.log('Sample energy/equipments devices (first ' + sampleSize + '):', samples);

}

// RFC-0111: Build flat items arrays for each domain (for tooltip compatibility)
// Tooltip expects MyIOOrchestratorData[domain].items format
const energyItems = [
...classified.energy.equipments,
...classified.energy.stores,
...classified.energy.entrada,
];
const waterItems = [
...classified.water.hidrometro_area_comum,
...classified.water.hidrometro,
...classified.water.entrada,
];
const temperatureItems = [
...classified.temperature.termostato,
...classified.temperature.termostato_external,
];

// RFC-0113: Debug logging for tooltip - verify labels and status
LogHelper.log(
`Energy items total: ${energyItems.length} (equip: ${classified.energy.equipments.length}, stores: ${classified.energy.stores.length}, entrada: ${classified.energy.entrada.length})`
);
LogHelper.log(`Water items total: ${waterItems.length}`);
LogHelper.log(`Temperature items total: ${temperatureItems.length}`);

// Sample 3 energy devices to verify label, deviceStatus, connectionStatus
const samples = energyItems.slice(0, 3).map((d, i) => ({
idx: i,
id: d.id,
name: d.name,
label: d.label,
entityLabel: d.entityLabel,
deviceStatus: d.deviceStatus,
connectionStatus: d.connectionStatus,
value: d.value,
}));
LogHelper.log('Sample energy items (first 3):', samples);

// Cache for getDevices and tooltip
window.MyIOOrchestratorData = {
classified,
timestamp: Date.now(),
// RFC-0111 FIX: Add domain-specific items arrays for tooltip compatibility
energy: {
items: energyItems,
timestamp: Date.now(),
},
water: {
items: waterItems,
timestamp: Date.now(),
},
temperature: {
items: temperatureItems,
timestamp: Date.now(),
},
};

return classified;
}
