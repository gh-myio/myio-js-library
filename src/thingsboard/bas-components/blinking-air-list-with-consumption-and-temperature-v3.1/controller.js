// Controller for blinking-air-list-with-consumption-and-temperature-v3.1
/* eslint-disable */
/*
function extractOrderKey(label) {
  const andarMatch = label.match(/(\d+)[°ª]? Andar/i);
  if (andarMatch) return parseInt(andarMatch[1]);
  if (/ag[eê]ncia/i.test(label)) return -1;
  return 999;
}
*/

/*
function extractOrderKey(label) {
  const andarMatch = label.match(/(\d+)[°ª]? Andar/i);
  const arMatch = label.match(/Ar (\d+)/i);

  const andar = andarMatch ? parseInt(andarMatch[1]) : 999;
  const ar = arMatch ? parseInt(arMatch[1]) : (
    /ag[eê]ncia/i.test(label) ? -1 : 999
  );

  return [andar, ar];
}
*/

function getAssetIdByName(deviceTypeWanted, dataKeyWanted) {
    if (showDebug) 
        console.log("getDataByDeviceTypeAndKey >>> ", {deviceTypeWanted, dataKeyWanted});
    
    for (const item of self.ctx.data) {
        const deviceTypeEntry = self.ctx.data.find(d =>
            d.datasource.entityId === item.datasource.entityId &&
            d.dataKey.name === 'deviceType'
        );

        const deviceType = deviceTypeEntry?.data?.[0]?.[1];

        if (deviceType === deviceTypeWanted && item.dataKey.name === dataKeyWanted) {
            if (showDebug) {
                console.log("getDataByDeviceTypeAndKey | deviceTypeEntry >>> ", {deviceTypeWanted, dataKeyWanted});
                console.log("getDataByDeviceTypeAndKey | deviceType >>> ", deviceType);
            }
            
            const valueToReturn = item.data?.[0]?.[1] ?? null;
            
            if (showDebug)
                console.log("getDataByDeviceTypeAndKey | valueToReturn >>> ", valueToReturn);
            
            return valueToReturn;
        }
    }

    return null;
}

function getDataByDeviceTypeAndKey(deviceTypeWanted, dataKeyWanted) {
    if (showDebug) 
        console.log("getDataByDeviceTypeAndKey >>> ", {deviceTypeWanted, dataKeyWanted});
    
    for (const item of self.ctx.data) {
        const deviceTypeEntry = self.ctx.data.find(d =>
            d.datasource.entityId === item.datasource.entityId &&
            d.dataKey.name === 'deviceType'
        );

        const deviceType = deviceTypeEntry?.data?.[0]?.[1];

        if (deviceType === deviceTypeWanted && item.dataKey.name === dataKeyWanted) {
            if (showDebug) {
                console.log("getDataByDeviceTypeAndKey | deviceTypeEntry >>> ", {deviceTypeWanted, dataKeyWanted});
                console.log("getDataByDeviceTypeAndKey | deviceType >>> ", deviceType);
            }
            
            const valueToReturn = item.data?.[0]?.[1] ?? null;
            
            if (showDebug)
                console.log("getDataByDeviceTypeAndKey | valueToReturn >>> ", valueToReturn);
            
            return valueToReturn;
        }
    }

    return null;
}

function extractOrderKey(label) {
  const andarMatch = label.match(/(\d+)[°ª]?/i);
  const arMatch = label.match(/Ar (\d+)/i);
  const salaOnlineMatch = /Sala Online/i.test(label);

  const andar = andarMatch ? parseInt(andarMatch[1]) : 999;

  // Prioridade:
  // Ar 01 → ar = 1
  // Ar 02 → ar = 2
  // Sala Online → ar = 99 (entre 2 e 999)
  // Outros → ar = 999

  let ar;
  if (arMatch) {
    ar = parseInt(arMatch[1]);
  } else if (salaOnlineMatch) {
    ar = 99;
  } else {
    ar = 999;
  }

  return [andar, ar];
}

const DEBUG = false;
const MinConsumption = 5;

function log(...args) {
  if (DEBUG) console.log('[DEBUG]', ...args);
}

const noDevice = '/api/images/public/g7phsMSdCo51gWcoJgi3QrKUSwj9njtC';
const offlineImg = '/api/images/public/XVSlrbdXz5jAFfYNo4ymvu3jh76Iw6Ag';
const offImg = '/api/images/public/V3nAuG6sBlMJAAOeiXWhctFKZzBuo6IL';
const fanImg = '/api/images/public/nAqgFLTCDHSyrCaboKq6R31Q45xI4NNT';
const onImg = '/api/images/public/6ziChYbLxcZuCismHWEBvCWNj6LLUet0';

const arSelfContainedOfflineImg = '/api/images/public/j8gvUT86qM2e3k32WlzXyhA88Fnctloy';
const arSelfContainedOffImg = '/api/images/public/G5ldxE6QEljmGxLyUGkjHQt3ddUtbPax';
const arSelfContainedFanImg = '/api/images/public/4A8Sk4WP8QuPqyxwZXCF9I08HxQsbKBy';
const arSelfContainedOnImg = '/api/images/public/Huwu3DqdnwB1N9mqlcSRsWzKUD3dPwtJ';

function extractContextKey(label) {
  const andar = label.toLowerCase().match(/\d{1,2}[°ª]/)?.[0];
  
  if (!andar) return null;
  if (/sala online/i.test(label)) return `sala_online_${andar}`;
  if (/área comum/i.test(label)) return `area_comum_${andar}`;
  
  return `generico_${andar}`;
}

function extractAndar(label) {
  return label.match(/\d{1,2}[°ª]/i)?.[0]?.toLowerCase();
}

function getImageByState(isSalaOnline, isOn, isFan) {
  if (isSalaOnline) return isOn ? (isFan ? fanImg : onImg) : offImg;
  return isOn ? (isFan ? arSelfContainedFanImg : arSelfContainedOnImg) : arSelfContainedOffImg;
}

function createCard(label, deviceId, deviceType, offlineImgToShow, assetInfo) {
  const safeId = `card-${label.replace(/\s+/g, '_')}`;
  const targetId = assetInfo?.id?.id || deviceId;
  const targetType = assetInfo?.id?.entityType || deviceType;

  return $(`
    <div class="device-card-centered clickable"
         id="${safeId}"
         data-entity-id="${targetId}"
         data-entity-type="${targetType}">
      <div class="device-title">📍 ${label}</div>
      <div class="device-direction">
        <img class="device-image" src="${offlineImgToShow}" />
        <div class="device-data-row">
          <div class="temperature">🌡️ <span>--°C</span></div>
          <div class="consumption">⚡ <span>-- kW</span></div>
        </div>
      </div>
    </div>
  `);
}

function getParentAssetViaHttp(deviceEntityId) {
  return new Promise((resolve, reject) => {
    if (!deviceEntityId?.id || !deviceEntityId?.entityType) {
      return reject('entityId inválido!');
    }

    const url = `/api/relations?toId=${deviceEntityId.id}&toType=${deviceEntityId.entityType}`;

    self.ctx.http.get(url).subscribe({
      next: (relations) => {
        const assetRel = relations.find(r =>
          r.from?.entityType === 'ASSET' && r.type === 'Contains'
        );

        if (!assetRel) {
          return reject('Nenhum asset pai encontrado.');
        }

        resolve(assetRel.from); // só o ID e tipo do asset pai
      },
      error: (err) => {
        reject(`Erro na chamada HTTP: ${JSON.stringify(err)}`);
      }
    });
  });
}

self.onInit = function () {
    const ctx = self.ctx;
    ctx.entityMap = {};
    ctx.contextIndexMap = {};
    ctx.$container.empty();

    const $main = $('<div class="status-container"></div>');
    ctx.$container.append($main);

    const grouped = {};
    
    const orderedData = ctx.data.slice().sort((a, b) => {
      const labelA = a?.datasource?.entityLabel || '';
      const labelB = b?.datasource?.entityLabel || '';
    
      const [andarA, arA] = extractOrderKey(labelA);
      const [andarB, arB] = extractOrderKey(labelB);
    
      if (andarA !== andarB) return andarA - andarB;
      
      return arA - arB;
    });  

    const salaOnlineTempPorAndar = {};
  
    orderedData.forEach(ds => {
        const label = ds?.datasource?.entityLabel;
    
        if (!label) return;
    
        const andarMatch = extractAndar(label)?.replace(/[°ª]/g, '');
        
        if (/temperatura.*sala online/i.test(label)) {
          const tempVal = ds.dataKey?.name === 'temperature' ? ds.data?.[0]?.[1] : null;
          
          if (andarMatch && typeof tempVal === 'number') {
            salaOnlineTempPorAndar[andarMatch] = tempVal;
          }
          
          return; // ainda não queremos criar card pra isso aqui
        }
        
        if (/temperatura.*área comum/i.test(label)) return;
    
        grouped[label] = grouped[label] || { dsList: [], connectionStatus: null };
        grouped[label].dsList.push(ds);
        
        if (ds.dataKey?.name === 'connectionStatus') {
          grouped[label].connectionStatus = ds.data?.[0]?.[1] === 'online';
        }
    });
    
    console.log("self.onInit | self.ctx >>> ", self.ctx);
  
    Object.entries(grouped).forEach(([label, group]) => {
      const lowerLabel = label.toLowerCase();
      
      console.log("self.onInit | Object.entries(grouped) >>> ", group);
    
      // Captura a temperatura de Sala Online, mas não cria card agora
      if (/temperatura.*sala online/.test(lowerLabel)) {
        const andar = extractAndar(label)?.replace(/[°ª]/g, '');
        const tempVal = group.dsList.find(ds => ds.dataKey?.name === 'temperature')?.data?.[0]?.[1];
        
        if (andar && typeof tempVal === 'number') {
          salaOnlineTempPorAndar[andar] = tempVal;
        }
        
        return; // não cria card
      }
    
      // Ignora temperatura de área comum (sem criar card nem capturar dado)
      if (/temperatura.*área comum/.test(lowerLabel)) return;
    
      // Aqui sim: criar os cards reais (Ar 01, Ar 02, Sala Online, etc.)
      const isOnline = group.connectionStatus;
      const ds = group.dsList[0];
      const entityId = ds.datasource?.entityId;
      const entityType = ds.datasource?.entityType;
      const isSalaOnline = /sala online/.test(lowerLabel);
      const offlineImgToShow = isSalaOnline
        ? (isOnline ? offImg : offlineImg)
        : (isOnline ? arSelfContainedOffImg : arSelfContainedOfflineImg);
        
      const assetInfo = ds.datasource?.entity; // asset pai (se vier via alias/relation)
    
      const $card = createCard(label, entityId, entityType, offlineImgToShow, assetInfo);
      
      ctx.entityMap[label] = { el: $card, label, temperature: null, consumption: null };
    
      const andar = extractAndar(label);
      
      if (andar) {
        const contextKey = extractContextKey(label);
        ctx.contextIndexMap[contextKey] = ctx.contextIndexMap[contextKey] || [];
        
        if (!ctx.contextIndexMap[contextKey].includes(label)) {
          ctx.contextIndexMap[contextKey].push(label);
        }
      }
    
      $main.append($card);
    });

    // Para cada temperatura sala online sem card de consumo, cria um card com noDevice
    Object.entries(salaOnlineTempPorAndar).forEach(([andar, temperatura]) => {
      // Verifica se já existe algum card com sala online para esse andar
      const salaOnlineJaExiste = Object.keys(ctx.entityMap).some(label => {
        const labelAndar = extractAndar(label)?.replace(/[°ª]/g, '');
        return labelAndar === andar && /sala online/i.test(label);
      });
    
      if (!salaOnlineJaExiste) {
        const salaLabel = `${andar}° Sala Online`;
        const $card = createCard(salaLabel, null, null, noDevice);
        
        $card.find('.temperature span').text(`${temperatura.toFixed(1)}°C`);
        $card.find('.consumption span').text('-- kW');
        
        ctx.entityMap[salaLabel] = { el: $card, label: salaLabel };
      }
    });
      
    // Reordenar os cards com base em andar e número do ar
    const orderedCards = Object.values(ctx.entityMap)
      .sort((a, b) => {
        const [andarA, arA] = extractOrderKey(a.label);
        const [andarB, arB] = extractOrderKey(b.label);
        if (andarA !== andarB) return andarA - andarB;
        return arA - arB;
    });
    
    $main.empty(); // remove todos os cards do DOM
    
    orderedCards.forEach(entry => {
      $main.append(entry.el); // adiciona de volta na ordem correta
    });

    ctx.$container.on('click', '.device-card-centered', function (e) {
      e.preventDefault();
    
      const $el = $(this);
      const entityId = $el.data('entity-id');
      const entityType = $el.data('entity-type');
      const label = $el.find('.device-title').text()?.replace('📍 ', '') || '';
    
      if (!entityId || !entityType) {
        if (DEBUG) console.warn('[WARN] Entidade inválida no clique:', entityId, entityType);
        return;
      }
    
      const isSalaOnline = /sala online/i.test(label);
      const dashboardId = isSalaOnline
        ? '6c804370-4889-11f0-9291-41f94c09a8a6' // Split
        : '8911c8e0-461f-11f0-9291-41f94c09a8a6'; // Self-Contained
    
      console.log("self.onInit >>> entityId: ", entityId);
      
      const entityPayload = {
        id: entityId,
        entityType: 'DEVICE'
      };

      getParentAssetViaHttp({ id: entityId, entityType: 'DEVICE' })
          .then(assetRef => {
            console.log("return to check >>>  ", assetRef);
            
            const state = [{
              id: 'default',
              params: {
                entityDashboard: {
                  entityId: {
                    id: assetRef.id,
                    entityType: 'ASSET'
                  },
                },
              }
            }];
        
            const stateBase64 = encodeURIComponent(btoa(JSON.stringify(state)));
            const url = `/dashboards/${dashboardId}?state=${stateBase64}`;
            
            self.ctx.router.navigateByUrl(url);
      }).catch(err => {
        console.error('❌ Erro ao obter asset pai via HTTP ou navegar:', err);
      });
  });
};

self.onDataUpdated = function () {
  const ctx = self.ctx;
  const temperatureMap = {}; // ex: { 'area_comum_9°': 25.4, 'sala_online_9°': 22.0 }

  // Primeiro: coletar temperaturas de referência
  ctx.data.forEach(ds => {
    const label = ds.datasource?.entityLabel;
    const key = ds.dataKey?.name;
    const val = ds.data?.[0]?.[1];

    if (!label || key !== 'temperature' || typeof val !== 'number') return;

    const andar = extractAndar(label);
    
    if (!andar) return;

    if (/sala online/i.test(label)) {
      temperatureMap[`sala_online_${andar}`] = val;
    } else {
      temperatureMap[`area_comum_${andar}`] = val;
    }
  });

  // Depois: aplicar dados + fallback de temperatura
  ctx.data.forEach(ds => {
    const label = ds.datasource?.entityLabel;
    const key = ds.dataKey?.name;
    const val = ds.data?.[0]?.[1];
    if (!label || !key) return;

    const entry = ctx.entityMap[label];
    if (!entry) return;

    const andar = extractAndar(label);
    const isSalaOnline = /sala online/i.test(label.toLowerCase());
    const contextKey = isSalaOnline ? `sala_online_${andar}` : `area_comum_${andar}`;

    if (key === 'temperature') {
      const tempText = typeof val === 'number' ? `${val.toFixed(1)}°C` : '--°C';
      entry.el.find('.temperature span').text(tempText);
    }

    if (key === 'consumption') {
      const isOn = val > MinConsumption;
      const threshold = ctx.settings?.threshold || 100;
      const isFan = val > MinConsumption && val <= threshold;
      const img = getImageByState(isSalaOnline, isOn, isFan);
      const color = isOn ? (isFan ? '#b499eb' : '#45b2cc') : '#d6dcdd';
      const consumoText = typeof val === 'number' ? `${(val / 1000).toFixed(3)} kW` : '-- kW';

      entry.el.find('.device-image').attr('src', img).toggleClass('blink', isOn);
      entry.el.find('.consumption span').text(consumoText).css('color', color);

      // Fallback de temperatura
      const tempField = entry.el.find('.temperature span');
      if (tempField.text() === '--°C' && temperatureMap[contextKey]) {
        tempField.text(`${temperatureMap[contextKey].toFixed(1)}°C`);
      }
    }
  });
      
    Object.entries(ctx.entityMap).forEach(([label, entry]) => {
      const tempField = entry.el.find('.temperature span');
      const tempText = tempField.text();
      
      if (tempText && tempText !== '--°C') return; // já tem valor válido
    
      const andar = extractAndar(label);
      const isSalaOnline = /sala online/i.test(label.toLowerCase());
      const contextKey = isSalaOnline ? `sala_online_${andar}` : `area_comum_${andar}`;
    
      const fallbackTemp = temperatureMap[contextKey];
      if (fallbackTemp != null) {
        tempField.text(`${fallbackTemp.toFixed(1)}°C`);
      }
    });  
};
