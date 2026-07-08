na chamada do endpoint /api/deviceProfile/

para informações de um deviceProfile específico recebemos um payload assim

{
"id": {
"entityType": "DEVICE_PROFILE",
"id": "51b478e0-eee8-11ef-a212-67802bff4221"
},
"createdTime": 1739986704238,
"tenantId": {
"entityType": "TENANT",
"id": "e784aa80-e7cc-11ee-a1c3-ef5befd2d893"
},
"name": "Obramax - Falha Bomba Diesel",
"description": "",
"image": null,
"type": "DEFAULT",
"transportType": "DEFAULT",
"provisionType": "DISABLED",
"defaultRuleChainId": {
"entityType": "RULE_CHAIN",
"id": "8b90e380-8fd1-11ef-88ea-9f32e7332750"
},
"defaultDashboardId": null,
"defaultQueueName": null,
"provisionDeviceKey": null,
"firmwareId": null,
"softwareId": null,
"defaultEdgeRuleChainId": null,
"externalId": null,
"version": 2,
"default": false,
"profileData": {
"configuration": {
"type": "DEFAULT"
},
"transportConfiguration": {
"type": "DEFAULT"
},
"provisionConfiguration": {
"type": "DISABLED",
"provisionDeviceSecret": null
},
"alarms": [
{
"id": "84900cbb-ecbe-89ca-85cb-d741cdb2b071",
"alarmType": "Bomba Ligada",
"createRules": {
"CRITICAL": {
"condition": {
"condition": [
{
"key": {
"type": "TIME_SERIES",
"key": "status"
},
"valueType": "STRING",
"value": null,
"predicate": {
"type": "STRING",
"operation": "EQUAL",
"value": {
"defaultValue": "detected",
"userValue": null,
"dynamicValue": null
},
"ignoreCase": false
}
}
],
"spec": {
"type": "SIMPLE"
}
},
"schedule": null,
"alarmDetails": null,
"dashboardId": null
}
},
"clearRule": {
"condition": {
"condition": [
{
"key": {
"type": "TIME_SERIES",
"key": "status"
},
"valueType": "STRING",
"value": null,
"predicate": {
"type": "STRING",
"operation": "EQUAL",
"value": {
"defaultValue": "not_detected",
"userValue": null,
"dynamicValue": null
},
"ignoreCase": false
}
}
],
"spec": {
"type": "SIMPLE"
}
},
"schedule": null,
"alarmDetails": null,
"dashboardId": null
},
"propagate": false,
"propagateToOwner": false,
"propagateToOwnerHierarchy": false,
"propagateToTenant": false,
"propagateRelationTypes": null
}
]
}
}

preciso que quando clicarmos em (i) para mais informações de um alarme que hoje abre mostrando

Obramax Benfica - Bomba Diesel 1
×
ID: 6b943010-c392-11ef-8d35-81408f250506
Devices: 2
Rule Chain: 8b90e380-8fd1-11ef-88ea-9f32e7332750
Alarm Rules: 1

preciso de um descritivo do Alarm Rules
nesse exemplo temos

[Bomba Ligada]

- Create > Quando a telemetria "status" for "detected"
- Clear > Quando a telemetria "status" for "not_detected"

veja outro exemplo

{
"id": {
"entityType": "DEVICE_PROFILE",
"id": "c79d4e50-9232-11ef-88ea-9f32e7332750"
},
"createdTime": 1729793226677,
"tenantId": {
"entityType": "TENANT",
"id": "e784aa80-e7cc-11ee-a1c3-ef5befd2d893"
},
"name": "Obramax - Hidrômetros",
"description": "",
"image": null,
"type": "DEFAULT",
"transportType": "DEFAULT",
"provisionType": "DISABLED",
"defaultRuleChainId": {
"entityType": "RULE_CHAIN",
"id": "8b90e380-8fd1-11ef-88ea-9f32e7332750"
},
"defaultDashboardId": null,
"defaultQueueName": null,
"provisionDeviceKey": null,
"firmwareId": null,
"softwareId": null,
"defaultEdgeRuleChainId": null,
"externalId": null,
"version": 11,
"default": false,
"profileData": {
"configuration": {
"type": "DEFAULT"
},
"transportConfiguration": {
"type": "DEFAULT"
},
"provisionConfiguration": {
"type": "DISABLED",
"provisionDeviceSecret": null
},
"alarms": [
{
"id": "fa576bdd-32bd-7d78-4f53-eaf0ca6196e9",
"alarmType": "Consumo máximo em 1h atingido",
"createRules": {
"CRITICAL": {
"condition": {
"condition": [
{
"key": {
"type": "TIME_SERIES",
"key": "hourlyConsumption"
},
"valueType": "NUMERIC",
"value": null,
"predicate": {
"type": "NUMERIC",
"operation": "GREATER_OR_EQUAL",
"value": {
"defaultValue": 0.0,
"userValue": null,
"dynamicValue": {
"sourceType": "CURRENT_DEVICE",
"sourceAttribute": "maxHourlyConsumption",
"inherit": false
}
}
}
}
],
"spec": {
"type": "SIMPLE"
}
},
"schedule": null,
"alarmDetails": null,
"dashboardId": null
}
},
"clearRule": null,
"propagate": false,
"propagateToOwner": false,
"propagateToOwnerHierarchy": false,
"propagateToTenant": false,
"propagateRelationTypes": null
},
{
"id": "1e854fb5-b6ea-a134-4732-992f749f2125",
"alarmType": "Consumo máximo da madrugada (23h as 05h)",
"createRules": {
"CRITICAL": {
"condition": {
"condition": [
{
"key": {
"type": "TIME_SERIES",
"key": "hourlyConsumption"
},
"valueType": "NUMERIC",
"value": null,
"predicate": {
"type": "NUMERIC",
"operation": "GREATER_OR_EQUAL",
"value": {
"defaultValue": 0.0,
"userValue": null,
"dynamicValue": {
"sourceType": "CURRENT_DEVICE",
"sourceAttribute": "maxOvernightConsumption",
"inherit": false
}
}
}
}
],
"spec": {
"type": "SIMPLE"
}
},
"schedule": {
"type": "CUSTOM",
"timezone": "America/Sao_Paulo",
"items": [
{
"enabled": true,
"dayOfWeek": 1,
"startsOn": 82800000,
"endsOn": 18000000
},
{
"enabled": true,
"dayOfWeek": 2,
"startsOn": 82800000,
"endsOn": 18000000
},
{
"enabled": true,
"dayOfWeek": 3,
"startsOn": 82800000,
"endsOn": 18000000
},
{
"enabled": true,
"dayOfWeek": 4,
"startsOn": 82800000,
"endsOn": 18000000
},
{
"enabled": true,
"dayOfWeek": 5,
"startsOn": 82800000,
"endsOn": 18000000
},
{
"enabled": true,
"dayOfWeek": 6,
"startsOn": 82800000,
"endsOn": 18000000
},
{
"enabled": true,
"dayOfWeek": 7,
"startsOn": 82800000,
"endsOn": 18000000
}
],
"dynamicValue": null,
"type": "CUSTOM"
},
"alarmDetails": null,
"dashboardId": null
}
},
"clearRule": null,
"propagate": false,
"propagateToOwner": false,
"propagateToOwnerHierarchy": false,
"propagateToTenant": false,
"propagateRelationTypes": null
},
{
"id": "c7b6164f-26a1-8146-cbb3-397d87c5a3f6",
"alarmType": "Consumo máximo diário",
"createRules": {
"CRITICAL": {
"condition": {
"condition": [
{
"key": {
"type": "TIME_SERIES",
"key": "dailyConsumption"
},
"valueType": "NUMERIC",
"value": null,
"predicate": {
"type": "NUMERIC",
"operation": "GREATER",
"value": {
"defaultValue": 0.0,
"userValue": null,
"dynamicValue": {
"sourceType": "CURRENT_DEVICE",
"sourceAttribute": "maxDailyConsumption",
"inherit": false
}
}
}
}
],
"spec": {
"type": "SIMPLE"
}
},
"schedule": null,
"alarmDetails": null,
"dashboardId": null
}
},
"clearRule": null,
"propagate": false,
"propagateToOwner": false,
"propagateToOwnerHierarchy": false,
"propagateToTenant": false,
"propagateRelationTypes": null
},
{
"id": "4fb022d7-d0c0-e125-902f-91cf9eb7e827",
"alarmType": "Consumo máximo em 15min atingido",
"createRules": {
"CRITICAL": {
"condition": {
"condition": [
{
"key": {
"type": "TIME_SERIES",
"key": "quarterHourlyConsumption"
},
"valueType": "NUMERIC",
"value": null,
"predicate": {
"type": "NUMERIC",
"operation": "GREATER_OR_EQUAL",
"value": {
"defaultValue": 0.0,
"userValue": null,
"dynamicValue": {
"sourceType": "CURRENT_DEVICE",
"sourceAttribute": "maxQuarterHourlyConsumption",
"inherit": false
}
}
}
}
],
"spec": {
"type": "SIMPLE"
}
},
"schedule": null,
"alarmDetails": null,
"dashboardId": null
}
},
"clearRule": null,
"propagate": false,
"propagateToOwner": false,
"propagateToOwnerHierarchy": false,
"propagateToTenant": false,
"propagateRelationTypes": null
},
{
"id": "e294f76d-c0a8-c32d-ea1e-a6cc681c9038",
"alarmType": "Consumo Zerado em 1h",
"createRules": {
"CRITICAL": {
"condition": {
"condition": [
{
"key": {
"type": "TIME_SERIES",
"key": "hourlyConsumption"
},
"valueType": "NUMERIC",
"value": null,
"predicate": {
"type": "NUMERIC",
"operation": "EQUAL",
"value": {
"defaultValue": 0.0,
"userValue": null,
"dynamicValue": null
}
}
}
],
"spec": {
"type": "SIMPLE"
}
},
"schedule": null,
"alarmDetails": null,
"dashboardId": null
}
},
"clearRule": null,
"propagate": false,
"propagateToOwner": false,
"propagateToOwnerHierarchy": false,
"propagateToTenant": false,
"propagateRelationTypes": null
},
{
"id": "cc174c0b-61af-715e-5bb8-4301b1ac5501",
"alarmType": "Consumo acima da média",
"createRules": {
"MAJOR": {
"condition": {
"condition": [
{
"key": {
"type": "TIME_SERIES",
"key": "hourlyConsumption"
},
"valueType": "NUMERIC",
"value": null,
"predicate": {
"type": "NUMERIC",
"operation": "GREATER",
"value": {
"defaultValue": 0.0,
"userValue": null,
"dynamicValue": {
"sourceType": "CURRENT_DEVICE",
"sourceAttribute": "pulsesHourlyAverage",
"inherit": false
}
}
}
}
],
"spec": {
"type": "SIMPLE"
}
},
"schedule": null,
"alarmDetails": null,
"dashboardId": null
}
},
"clearRule": {
"condition": {
"condition": [
{
"key": {
"type": "TIME_SERIES",
"key": "hourlyConsumption"
},
"valueType": "NUMERIC",
"value": null,
"predicate": {
"type": "NUMERIC",
"operation": "LESS_OR_EQUAL",
"value": {
"defaultValue": 0.0,
"userValue": null,
"dynamicValue": {
"sourceType": "CURRENT_DEVICE",
"sourceAttribute": "pulsesHourlyAverage",
"inherit": false
}
}
}
}
],
"spec": {
"type": "SIMPLE"
}
},
"schedule": null,
"alarmDetails": null,
"dashboardId": null
},
"propagate": false,
"propagateToOwner": false,
"propagateToOwnerHierarchy": false,
"propagateToTenant": false,
"propagateRelationTypes": null
}
]
}
}

[Bomba Ligada]

- Create > Quando a telemetria "status" for "detected"
- Clear > Quando a telemetria "status" for "not_detected"

Perfil do Dispositivo: Obramax - Hidrômetros
Regras de Alarmes: 6

[1 - Consumo máximo em 1h atingido]
1.1 - Setup de Criação: CRITICAL
1.1.1 - REGRA: Quando a telemetria "hourlyConsumption" for maior ou igual ao atributo maxHourlyConsumption do DEVICE.
1.1.2 - Valor padrão 0.0.
1.1.3 - Sem agenda definida. (schedule = null)

- Clear (clearRule = null)> não configurado

[2 - Consumo máximo da madrugada (23h as 05h)]
2.1 - Setup de Criação
2.1.1 - REGRA: Quando a telemetria "hourlyConsumption" for maior ou igual ao atributo maxOvernightConsumption do DEVICE.
2.1.2 - Valor padrão 0.0.
2.1.3 - Agenda: Segunda de 11:00 PM – 12:00 PM e 12:00 AM – 05:00 AM de Terça (repara que aqui o startsOn é 11 da noite endsOn 5 da manhã e por isso passa do dia para o dia seguinte), e etc...

- Clear > não configurado

O "Consumo acima da média"

temos clearRule se hourlyConsumption for menor ou igual pulsesHourlyAverage do device e sem agendamento personalizado.

faça essa melhoria
