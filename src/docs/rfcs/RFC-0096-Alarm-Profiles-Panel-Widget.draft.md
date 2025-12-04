temos que usar as APIs do Thingsboard

no Datasource só teremos a lista de Clientes e a partir dai temos que buscar as informações

em cada item de ctx.data[] teremos uma entity do tipo customer do thingsboard

buscar os devices todos para cada customer

EXEMPLO

/api/customer/20b93da0-9011-11f0-a06d-e9509531b1d5/devices?pageSize=300&page=0

{
"data": [
{
"id": {
"entityType": "DEVICE",
"id": "00871830-9012-11f0-a06d-e9509531b1d5"
},
"createdTime": 1757706744115,
"tenantId": {
"entityType": "TENANT",
"id": "e784aa80-e7cc-11ee-a1c3-ef5befd2d893"
},
"customerId": {
"entityType": "CUSTOMER",
"id": "20b93da0-9011-11f0-a06d-e9509531b1d5"
},
"name": "3F SCMAL3L4Q313",
"type": "3F_MEDIDOR",
"label": "Fini Balas",
"deviceProfileId": {
"entityType": "DEVICE_PROFILE",
"id": "6b31e2a0-8c02-11f0-a06d-e9509531b1d5"
},
"firmwareId": null,
"softwareId": null,
"externalId": null,
"version": 1,
"ownerId": {
"entityType": "CUSTOMER",
"id": "20b93da0-9011-11f0-a06d-e9509531b1d5"
},
"additionalInfo": null,
"deviceData": {
"configuration": {
"type": "DEFAULT"
},
"transportConfiguration": {
"type": "DEFAULT"
}
}
},
],
"totalPages": 2,
"totalElements": 422,
"hasNext": true
}

depois para cada device profile > buscar detalhes

/api/deviceProfile/6e6b4d60-da66-11ef-9eb2-6f10bea6c4a8?inlineImages=true

/api/deviceProfile/{deviceProfileId}{?inlineImages=true|false}

veja o resultado de um
deviceProfileId = 6e6b4d60-da66-11ef-9eb2-6f10bea6c4a8

{
"id": {
"entityType": "DEVICE_PROFILE",
"id": "6e6b4d60-da66-11ef-9eb2-6f10bea6c4a8"
},
"createdTime": 1737731894582,
"tenantId": {
"entityType": "TENANT",
"id": "e784aa80-e7cc-11ee-a1c3-ef5befd2d893"
},
"name": "Obramax - Geradores - Falta de Fase",
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
"version": 3,
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
"id": "fd19fc7a-2fa1-8c8f-8aaf-afc468f705c7",
"alarmType": "Falta de Fase no Gerador",
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

repare que quanto existe alarm rules, já traz junto a informação dos dados da regra de criar e clear

já o alarme em si gerado

/api/v2/alarms?pageSize=10&page=0&sortProperty=createdTime&sortOrder=DESC&statusList=ACTIVE

{
"data": [
{
"id": {
"entityType": "ALARM",
"id": "d34ef7f9-33fe-45ff-a6a9-cd97ec478832"
},
"createdTime": 1764875829567,
"tenantId": {
"entityType": "TENANT",
"id": "e784aa80-e7cc-11ee-a1c3-ef5befd2d893"
},
"customerId": {
"entityType": "CUSTOMER",
"id": "2aaecd90-8386-11ef-83cb-978940cc3df5"
},
"type": "Chave seletora em manual",
"originator": {
"entityType": "DEVICE",
"id": "f54a3db0-eace-11ee-8327-cfc6eea1d65a"
},
"severity": "MAJOR",
"acknowledged": false,
"cleared": false,
"assigneeId": null,
"startTs": 1764875829268,
"endTs": 1764878109595,
"ackTs": 0,
"clearTs": 0,
"assignTs": 0,
"propagate": false,
"propagateToOwner": false,
"propagateToOwnerHierarchy": false,
"propagateToTenant": false,
"propagateRelationTypes": [],
"originatorName": "Auto. Seletora Estacionamento 50% (H) (Mooca)",
"originatorLabel": "Auto. Seletora Estacionamento 50% (H)",
"assignee": null,
"name": "Chave seletora em manual",
"status": "ACTIVE_UNACK",
"details": {}
},
],
"totalPages": 40,
"totalElements": 395,
"hasNext": true
}
