Sim, todos estão no UpdateDeviceSchema. Lista completa do que você pode enviar no PUT /devices/:id:  
 { "name": "Energy Meter Lab 01",  
 "displayName": "Medidor Energia Laboratório", "code": "LAB01",  
 "label": "ENM-LAB-01",
"type": "METER",
"description": "Medidor de energia trifásico - Modbus RTU",
"externalId": "tb-device-uuid",
"status": "ACTIVE",

    "slaveId": 4,
    "centralId": "central-uuid",
    "identifier": "modbus://central-uuid/slave/4",
    "deviceProfile": "energy-meter-modbus",
    "deviceType": "ENERGY_METER",
    "ingestionId": "ingestion-uuid",
    "ingestionGatewayId": "gateway-uuid",

    "specs": {
      "manufacturer": "Schneider Electric",
      "model": "iEM3155",
      "firmwareVersion": "1.5.0",
      "protocol": "MODBUS",
      "addrLow": 100,
      "addrHigh": 200,
      "frequency": 60
    },
    "telemetryConfig": {
      "reportingInterval": 30,
      "telemetryKeys": ["energy_kwh", "power_kw", "voltage_v", "current_a"]
    },
    "tags": ["energia", "laboratorio", "modbus"],
    "metadata": {
      "tbId": "tb-device-uuid",
      "tbDeviceName": "Energy Meter Lab 01",
      "tbProfile": "energy-meter-modbus",
      "syncedAt": "2026-03-05T12:00:00.000Z"
    },
    "attributes": {
      "location": "Laboratório 1 - Bloco A"
    }

}

Tudo editável via PUT. Os únicos campos que não estão no UpdateDeviceSchema são assetId, customerId e serialNumber.
