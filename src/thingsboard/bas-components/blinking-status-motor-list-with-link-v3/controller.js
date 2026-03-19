// Controller for blinking-status-motor-list-with-link-v3
/* eslint-disable */
const motorOffline = '/api/images/public/XutAQB6zI47vEoy7RWO2nk0o4pGmx7Cd';
const motorOn      = '/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT';
const motorOff     = '/api/images/public/8Ezn8qVBJ3jXD0iDfnEAZ0MZhAP1b5Ts';
const bombOffline  = '/api/images/public/mcTJdRywgt8pS6mKfSPnQflYsOOL2Gsd'
const bombOn       = '/api/images/public/a9nNrekeCqKT4yQ4SXaJBKs6oYtzDr7L'
const bombOff      = '/api/images/public/iOtl2pjoX2G4sJMPBeDsXLoUBdFO123V'

const style = document.createElement('style');
style.innerHTML = `/* CSS acima aqui */`;
document.head.appendChild(style);

function extractAndar(label) {
  return label.match(/\d{1,2}[°ª]/i)?.[0]?.toLowerCase();
}

self.onInit = function () {
    //console.log(self.ctx)
    const ctx = self.ctx;
    ctx.entityMap = {};
    ctx.$container.empty();
    self.ctx.$scope.state = ctx.settings.self_contained
    const $main = $('<div class="status-container"></div>');
    ctx.$container.append($main);

    const cards = ctx.data.filter(ds => ds.dataKey?.name === 'consumption')
      .sort((a, b) => (a.datasource?.entityLabel || '').localeCompare(b.datasource?.entityLabel || '', 'pt-BR'));

    cards.forEach((ds, index) => {
        const deviceID = ds.datasource?.entity?.id?.id;
        const name = ds.datasource?.entityname
        const label = ds.datasource?.entityLabel;
        const entityId = ds.datasource?.entityId;
        const entityType = ds.datasource?.entityType;
        const safeId = `card-${label.replace(/\s+/g, '_')}`;
        const $card = $(`
          <div class="device-card-centered clickable"
               id="${safeId}"
               data-state="default"
               data-entity-id="${entityId}"
               data-entity-type="${entityType}">
            <div class="device-title">⚡ ${label}</div>
            <div class = "device-datas">
                <img class="device-image" src="${motorOffline}" />
                <div class="device-data-row">
                  <div class="consumption">⚡ <span>-- kW</span></div>
                </div>
            </div>
          </div>
        `);

        const backColor = ds.dataKey?.settings?.backGroundColor;
        if (backColor) $card.css('background-color', backColor);
    
        ctx.entityMap[label] = {
          el: $card,
          label,
          consumption: null
        };

        $card.one('click', function () {
            //console.log('[DEBUG] Entity ID:', deviceID);
        
            const state = [{
                id: 'default',
                params: {
                    entityId: {
                        id: deviceID,
                        entityType: "DEVICE"
                    }
                }
            }];
        
            const dashboardId = '15c352d0-47cf-11f0-9291-41f94c09a8a6';
            const stateBase64 = encodeURIComponent(btoa(JSON.stringify(state)));
            const url = `/dashboards/${dashboardId}?state=${stateBase64}`;
        
            //console.log('[DEBUG] State object:', JSON.stringify(state, null, 2));
            //console.log('[DEBUG] Navegando para:', url);
        
            self.ctx.router.navigateByUrl(url);
        });

        $main.append($card);
    });

    ctx.$container.on('click', '.device-card-centered', function (e) {
        e.preventDefault();
        const entityId = $(this).data('entity-id');
        const entityType = $(this).data('entity-type');
        
        ctx.stateController.openState(self.ctx.$scope.state, {
          entityId: { id: entityId, entityType }
        }, false);
    });
};


self.onDataUpdated = function () {
  const ctx = self.ctx;
  //console.log("ctx",ctx)
  
  ctx.data.forEach((ds,index) => {
    //console.log("LOG Widget MOTOR >>> " , ds);
    
    const label = ds.datasource?.entityLabel;
    const key = ds.dataKey?.name;
    const val = ds.data?.[ds.data.length - 1]?.[1];
    const isValid = typeof val === 'number' && !isNaN(val);
    
    if (key === 'consumption' && ctx.entityMap[label]) {
      const entry = ctx.entityMap[label];
      const consumoStr = isValid ? `${(val / 1000).toFixed(2)} kW` : '-- kW';
      const consumoWatts = isValid ? Math.round((val / 1000) * 100) : 0;
      
      let active = null;
      
      if (ctx.data[index + 1] && ctx.data[index + 1].data && ctx.data[index + 1].data.length > 0) {
            active = ctx.data[index + 1].data[0][1];
      }
      
      let isActive = active =="online";
      entry.consumption = consumoStr;
      entry.consumptionWatts = consumoWatts; // armazenar já convertido
      
      let img;
      let isOn;
      
      if (label.includes("BAG")){
        isOn = consumoWatts > 0;
        img = !isActive ? bombOffline : (isOn ? bombOn : bombOff);
   
      } else {
        isOn = consumoWatts > 0;
        img = !isActive ? motorOffline : (isOn ? motorOn : motorOff);
      }
      
      const color = isOn ? '#28a745' : '#777';
    
      entry.el.find('.device-image').attr('src', img).toggleClass('blink', isOn);
      entry.el.find('.consumption span').text(consumoStr).css('color', color);
    }
  });
};
