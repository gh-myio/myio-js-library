faça nesse trecho\
  \
  @/src\MYIO-SIM\V1.0.0\EQUIPEMTNS\controller.js
  ```
        // ✅ LÓGICA DO MAPA: Se o dado for o ingestionId, guardamos a relação
        if (data.dataKey.name === "ingestionId" && data.data[0][1]) {
          const ingestionId = data.data[0][1];
          ingestionIdToEntityIdMap.set(ingestionId, entityId);
        }
  ```
  1 - primeiro buscar antes do loop self.ctx.data.forEach a lista de deviceProfile pelo endpoint /api/deviceProfile/names?activeOnly e vamos ter uma lista assim como exemplo\
  salvar essa lista num mapa com id e name
  \
  [
      {
          "id": {
              "entityType": "DEVICE_PROFILE",
              "id": "6c488690-fdbe-11ee-8b82-b386dea39cb5"
          },
          "name": "3F"
      },
      {
          "id": {
              "entityType": "DEVICE_PROFILE",
              "id": "6b31e2a0-8c02-11f0-a06d-e9509531b1d5"
          },
          "name": "3F_MEDIDOR"
      }
  ]\
  
  /api/deviceProfile/names{?activeOnly}
  
2 - 

dentro do loop, self.ctx.data.forEach, 
buscar /api/device/<entityId> 
entityId declarado no trecho
      const entityId = data.datasource.entity.id.id;

com isso teremos




https://dashboard.myio-bas.com/api/device/b8dc56e0-b667-11f0-be7f-e760d1498268

{
    "id": {
        "entityType": "DEVICE",
        "id": "b8dc56e0-b667-11f0-be7f-e760d1498268"
    },
    "createdTime": 1761921704782,
    "tenantId": {
        "entityType": "TENANT",
        "id": "e784aa80-e7cc-11ee-a1c3-ef5befd2d893"
    },
    "customerId": {
        "entityType": "CUSTOMER",
        "id": "209424d0-b04f-11f0-9722-210aa9448abc"
    },
    "name": "3F SCSDIACCCasaAr17",
    "type": "MOTOR",
    "label": "Casa de Máquina AR 17",
    "deviceProfileId": {
        "entityType": "DEVICE_PROFILE",
        "id": "36aad760-9181-11f0-a06d-e9509531b1d5"
    },
    "firmwareId": null,
    "softwareId": null,
    "externalId": null,
    "version": 3,
    "ownerId": {
        "entityType": "CUSTOMER",
        "id": "209424d0-b04f-11f0-9722-210aa9448abc"
    },
    "additionalInfo": {
        "gateway": false,
        "overwriteActivityTime": false,
        "description": "",
        "lastConnectedGateway": "c455ac60-b685-11f0-9898-a53e89467408"
    },
    "deviceData": {
        "configuration": {
            "type": "DEFAULT"
        },
        "transportConfiguration": {
            "type": "DEFAULT"
        }
    }
}

e com o deviceProfileId salvamos no attributes server_scope um atributo
deviceProfile com o name, seguindo o exemplo: MOTOR

pois na lista teremos isso já pre mapeado do endpoint /api/deviceProfile/names?activeOnly

para salvar o attributo CRIE Uma função assim

    async function addDeviceProfileAttribute(deviceId, deviceProfile) {
      const t = nowMs();
      try {
        if (!deviceId) throw new Error("deviceId é obrigatório");
        if (deviceProfile == null || deviceProfile === "")
          throw new Error("deviceProfile é obrigatório");

        const token = localStorage.getItem("jwt_token");
        if (!token) throw new Error("jwt_token ausente no localStorage");

        const url = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
        const headers = {
          "Content-Type": "application/json",
          "X-Authorization": "Bearer " + token,
        };

        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ deviceProfile }),
        });

        const bodyText = await res.text().catch(() => "");
        if (!res.ok) {
          throw new Error(
            `[adddeviceProfileAttribute] HTTP ${res.status} ${res.statusText} - ${bodyText}`
          );
        }

        let data = null;
        try {
          data = bodyText ? JSON.parse(bodyText) : null;
        } catch {
          /* pode não ser JSON */
        }
        const dt = nowMs() - t;
        console.log(
          `${TAG} ✅ POST deviceProfile ok | dev=${deviceId} | "${deviceProfile}" | ${fmtMs(
            dt
          )}`
        );
        return { ok: true, status: res.status, data };
      } catch (err) {
        const dt = nowMs() - t;
        console.error(
          `${TAG} ❌ POST deviceProfile falhou | dev=${deviceId} | "${deviceProfile}" | ${fmtMs(
            dt
          )} | erro: ${err?.message || err}`
        );
        throw err;
      }
    }