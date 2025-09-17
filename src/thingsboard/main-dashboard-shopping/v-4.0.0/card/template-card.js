export function renderCardComponent(entityId, labelOrName, entityType, slaveId, ingestionId, val, centralId, img, perc) {


  const card = `
  <div>
    <style>

     .device-card-centered,
 .clickable {
   width: 98%;
   border-radius: 10px;
   padding: 8px 12px;
   background: #fff;
   box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
   display: flex;
   align-items: center;
   justify-content: flex-start;
   cursor: pointer;
   transition: transform 0.2s;
   position: relative;
   min-height: 140px;
   /* altura consistente */
   box-sizing: border-box;
   gap: 25px;
   overflow: hidden;
   margin-bottom: 15px;
 } 

 .device-card-centered:hover,
 .clickable:hover,
 .info-card:hover {
   transform: scale(1.05);
 }

 .device-title-row {
   width: 100%;
   display: flex;
   justify-content: center;
   align-items: center;
   margin-bottom: 4px;
   padding: 0 4px;
   min-height: 22px;
 }

 .device-title {
   font-weight: 700;
   font-size: 0.85rem;
   text-align: center;
   white-space: nowrap;
   overflow: hidden;
   text-overflow: ellipsis;
   max-width: 90%;
   line-height: 1.1;
 }

 .device-image {
   max-height: 44px;
   width: auto;
   margin: 4px 0;
   display: block;
 }

 .device-data-row {
   display: flex;
   justify-content: center;
   align-items: center;
   margin-top: auto;
   /* empurra pra baixo */
   margin-bottom: 6px;
   gap: 6px;
   /* espaçamento horizontal entre itens */
   width: 100%;
 }

 .consumption-main {
   font-size: 0.9rem;
   font-weight: 700;
   color: #28a745;
   display: flex;
   align-items: center;
   gap: 6px;
   justify-content: center;
   white-space: nowrap;
 }

 .device-title-percent {
   font-size: 0.75rem;
   color: rgba(0, 0, 0, 0.45);
   font-weight: 500;
   margin-left: 0;
   /* removido para usar gap */
 }

 .flash {
   animation: flash 1s infinite;
   color: #ff9800;
 }

 @keyframes flash {
   0% {
     opacity: 1;
   }

   50% {
     opacity: 0.2;
   }

   100% {
     opacity: 1;
   }
 }

 @keyframes flashAnim {

   0%,
   100% {
     opacity: 1;
   }

   50% {
     opacity: 0.2;
   }
 }

 .card-actions {
   gap: 13px;
   width: 36px;
   padding: 5px;
   height: 100%;
   box-shadow: 1px 0 2px rgba(0, 0, 0, 0.1);
   display: flex;
   flex-direction: column;
   justify-content: center;
   align-items: center;
 }

 .card-action img {
   width: 24px;
   height: 24px;
   transition: transform 0.2s ease;
   cursor: pointer;
 }

 .card-action img:hover {
   transform: scale(1.15);
 }

    </style>

    <div class="device-card-centered clickable"
        data-entity-id="${entityId}"
        data-entity-label="${labelOrName}"
        data-entity-type="${entityType}"
        data-entity-slaveid="${slaveId}"
        data-entity-ingestionid="${ingestionId}"
        data-entity-consumption="${val}"
        data-entity-centralid="${centralId}"
    >
        
      <div class="card-actions">
        <div class="card-action" data-action="dashboard" title="Dashboard">
          <img src="https://dashboard.myio-bas.com/api/images/public/TAVXE0sTbCZylwGsMF9lIWdllBB3iFtS"/>
        </div>
        <div class="card-action" data-action="report" title="Relatório">
          <img src="https://dashboard.myio-bas.com/api/images/public/d9XuQwMYQCG2otvtNSlqUHGavGaSSpz4"/>
        </div>
        <div class="card-action" data-action="settings" title="Configurações">
          <img src="https://dashboard.myio-bas.com/api/images/public/5n9tze6vED2uwIs5VvJxGzNNZ9eV4yoz"/>
        </div>
        <input class="card-action" data-action="checker" title="Selecionar" type="checkbox"></input>
      </div>

      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;width:85%">
        <div class="device-title-row">
          <span class="device-title" title="${labelOrName}">
            ${labelOrName.length > 15 ? labelOrName.slice(0, 15) + "…" : labelOrName}
          </span>
        </div>
        <img class="device-image" src="${img}" />
        <div class="device-data-row">
          <div class="consumption-main">
            <span class="flash-icon">⚡</span>
            <span class="consumption-value" data-entity-consumption="${val}">${val}</span>
            <span class="device-title-percent">(${perc}%)</span>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

  return card;
}
