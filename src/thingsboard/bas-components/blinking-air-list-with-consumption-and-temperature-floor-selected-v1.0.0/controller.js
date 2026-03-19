// Controller for blinking-air-list-with-consumption-and-temperature-floor-selected-v1.0.0
/* eslint-disable */
const DEBUG = false;
const MinConsumption = 100;

function log(...args) {
  if (DEBUG) console.log('[DEBUG]', ...args);
}

const SHOW_AREA_COMUM_CARD = false; // ✅ Controle global: true para exibir card da Área Comum isolado

const noDevice = '/api/images/public/g7phsMSdCo51gWcoJgi3QrKUSwj9njtC';
const offlineImg = '/api/images/public/XVSlrbdXz5jAFfYNo4ymvu3jh76Iw6Ag';
const offImg = '/api/images/public/V3nAuG6sBlMJAAOeiXWhctFKZzBuo6IL';
const fanImg = '/api/images/public/nAqgFLTCDHSyrCaboKq6R31Q45xI4NNT';
const onImg = '/api/images/public/6ziChYbLxcZuCismHWEBvCWNj6LLUet0';

const arSelfContainedOfflineImg = '/api/images/public/j8gvUT86qM2e3k32WlzXyhA88Fnctloy';
const arSelfContainedOffImg = '/api/images/public/G5ldxE6QEljmGxLyUGkjHQt3ddUtbPax';
const arSelfContainedFanImg = '/api/images/public/nAqgFLTCDHSyrCaboKq6R31Q45xI4NNT';
const arSelfContainedOnImg = '/api/images/public/Huwu3DqdnwB1N9mqlcSRsWzKUD3dPwtJ';

function isGrupoSalaOnline(grupo) {
  return grupo?.toLowerCase() === 'sala online';
}

function getGrupoFromLabel(label) {
  const lower = label?.toLowerCase() || '';
  
  if (lower.includes('sala online')) return 'Sala Online';
  
  const arMatch = lower.match(/ar\s*(\d{1,2})/);
  
  if (arMatch) {
    const num = arMatch[1].padStart(2, '0');
    return `Área Comum ${num}`;
  }
  
  const comumMatch = lower.match(/área comum\s*(\d{1,2})/);
  
  if (comumMatch) {
    const num = comumMatch[1].padStart(2, '0');
    return `Área Comum ${num}`;
  }

  return null;
}

function createCard(grupo, state) {
  const safeId = `card-${grupo.replace(/\s+/g, '_')}`;
  return $(`
    <div class="device-card-centered clickable" id="${safeId}" data-grupo="${grupo}" data-state="${state}">
      <div class="device-title">📍 ${grupo}</div>
      <div class="device-direction">
        <img class="device-image" src="${noDevice}" />
        <div class="device-data-row">
          <div class="temperature">🌡️ <span>--°C</span></div>
          <div class="consumption">⚡ <span>-- kW</span></div>
        </div>
      </div>
    </div>
  `);
}

function getImageFor(grupo, isOn, isFan) {
  const isSalaOnline = isGrupoSalaOnline(grupo);

  if (!isOn) return isSalaOnline ? offImg : arSelfContainedOffImg;
  if (isFan) return isSalaOnline ? fanImg : arSelfContainedFanImg;
  
  return isSalaOnline ? onImg : arSelfContainedOnImg;
}

function getImageOffline(grupo) {
  const isSalaOnline = isGrupoSalaOnline(grupo);
  return isSalaOnline ? offlineImg : arSelfContainedOfflineImg;
}

self.onInit = function () {
  const ctx = self.ctx;
  ctx.cardsByGrupo = {};
  ctx.temps = {};
  ctx.consumos = {};
  ctx.assetByGrupo = {}
  ctx.$container.empty();

  const $main = $('<div class="status-container"></div>');
  ctx.$container.append($main);

  const dados = ctx.data || [];
  const threshold = ctx.settings?.threshold || 200;
  
  log("onInit > ctxc.data: ", dados);

  // Agrupar entidades por grupo
  const grupos = new Set();
  for (const ds of dados) {
    const label = ds.datasource?.entityLabel;
    const grupo = getGrupoFromLabel(label);
    
    if (grupo === 'Área Comum' && !SHOW_AREA_COMUM_CARD) continue;
    if (grupo) grupos.add(grupo);
    
    // salvar o asset principal do grupo
    const dsAsset = ds.datasource?.entity;
    
    if (!ctx.assetByGrupo[grupo]) {
      if (dsAsset?.id?.entityType === 'ASSET') {
        ctx.assetByGrupo[grupo] = {
          entityId: dsAsset.id.id,
          entityType: dsAsset.id.entityType,
          entityName: dsAsset.name || grupo
        };
        //log([DEBUG] Asset registrado para grupo "${grupo}": ${dsAsset.id.id});
      }
    }
  }

  const ordenados = Array.from(grupos).sort((a, b) => {
    if (a === 'Sala Online') return 1;
    if (b === 'Sala Online') return -1;

    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;

    return numA - numB;
  });

  for (const grupo of ordenados) {
    const isSalaOnline = isGrupoSalaOnline(grupo);
    const state = isSalaOnline ? ctx.settings?.split : ctx.settings?.self_contained;
    const $card = createCard(grupo, state);
    ctx.cardsByGrupo[grupo] = $card;
    
    $main.append($card);
  }

  ctx.settingsThreshold = threshold;

    ctx.$container.on('click', '.device-card-centered', function (e) {
      e.preventDefault();
    
      const grupo = $(this).data('grupo');
      const assetInfo = ctx.assetByGrupo[grupo]; // 👈 já capturado em onInit
    
      if (!assetInfo) {
        if (DEBUG) console.warn('[WARN] Asset não encontrado para o grupo:', grupo);
        return;
      }
    
      const { entityId, entityType, entityName } = assetInfo;
      const isSalaOnline = grupo.toLowerCase().includes('sala online');
      const dashboardId = isSalaOnline
        ? '6c804370-4889-11f0-9291-41f94c09a8a6'
        : '8911c8e0-461f-11f0-9291-41f94c09a8a6';
    
      // 👇 define state como no padrão necessário pelo ThingsBoard
      const state = [{
        id: 'default',
        params: {
          entityDashboard: {
            entityId: {
              entityType,
              id: entityId
            },
            entityName: entityName || grupo
          },
          entityName: entityName || grupo
        }
      }];
    
      const stateBase64 = encodeURIComponent(btoa(JSON.stringify(state)));
    
      const url = `/dashboards/${dashboardId}?state=${stateBase64}`;
      log('[DEBUG] Navegando para:', url);
    
      self.ctx.router.navigateByUrl(url); // ✅ forma recomendada
    });
};

self.onDataUpdated = function () {
  const ctx = self.ctx;
  const dados = ctx.data || [];
  const temps = {};
  const consumos = {};
  
  log("onDataUpdated > ctxc.data: ", dados);

  for (const ds of dados) {
    const label = ds.datasource?.entityLabel;
    const key = ds.dataKey?.name;
    const val = ds.data?.at(-1)?.[1];
    const grupo = getGrupoFromLabel(label);
        
    // Captura o asset pai uma única vez, mesmo que a medição seja válida ou não
    if (!ctx.assetByGrupo[grupo]) {
      const dsAsset = ds.datasource?.entity;
      
      if (dsAsset?.id?.entityType === 'ASSET') {
        ctx.assetByGrupo[grupo] = {
          entityId: dsAsset.id.id,
          entityType: dsAsset.id.entityType,
          entityName: dsAsset.name || grupo
        };
        
        log(`[DEBUG] Asset capturado para grupo "${grupo}": ${dsAsset.id.id}`);
      }
    } 
        
    if (!grupo || typeof val !== 'number') continue;

    if (key === 'temperature') {
      temps[grupo] = {
        valor: val.toFixed(2),
        entityId: ds.datasource.entityId,
        entityType: ds.datasource.entityType
      };
    } else if (key === 'consumption') {
      consumos[grupo] = {
        valor: val,
        entityId: ds.datasource.entityId,
        entityType: ds.datasource.entityType
      };
    }
  }

  ctx.temps = temps;
  ctx.consumos = consumos;

  for (const grupo in ctx.cardsByGrupo) {
    const $card = ctx.cardsByGrupo[grupo];
    const tempRaw = temps[grupo]?.valor ?? temps['Área Comum']?.valor;
    const tempText = tempRaw ? `${tempRaw}°C` : '--°C';

    const consumoObj = consumos[grupo];
    const val = consumoObj?.valor;
    const isValid = typeof val === 'number';

    let isOn = false;
    let isFan = false;
    let img = getImageOffline(grupo);
    let cor = '#ccc';
    let consumoText = '-- kW';

    if (isValid) {
      isOn = val > MinConsumption;
      isFan = isOn && val <= ctx.settingsThreshold;
      
      const { img: imgFinal, color } = {
        img: getImageFor(grupo, isOn, isFan),
        color: isFan ? '#b499eb' : isOn ? '#45b2cc' : '#ccc'
      };
      
      img = imgFinal;
      cor = color;
      consumoText = `${(val / 1000).toFixed(2)} kW`;
    }

    $card.find('.temperature span').text(tempText);
    $card.find('.consumption span').text(consumoText).css('color', cor);
    $card.find('.device-image').attr('src', img).toggleClass('blink', isOn);
  }
};