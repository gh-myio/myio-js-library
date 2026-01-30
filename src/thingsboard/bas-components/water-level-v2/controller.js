// Controller for water-level-v2
/* eslint-disable */
function fetchData(){
     const subscriptionData = self.ctx.data[1].data;
     var data = !subscriptionData.length || !subscriptionData[0][1]  ? null : subscriptionData[0][1] 
    //console.log(subscriptionData)
    
    self.ctx.$scope.waterLevel = data
}

self.onInit = function() {
    
    if (self.ctx.data[2]){
        console.log("dados: ", self.ctx.data[2].data[0][1])
    }
    
    self.ctx.$scope.liquidLevelWidget.onInit();
    const cardTitle = self.ctx.settings.cardTitle;
    self.ctx.$scope.cardTitle = cardTitle;

    fetchData()
}

self.onDataUpdated = function() {
    self.ctx.$scope.liquidLevelWidget.update();
    const cardTitle = self.ctx.settings.cardTitle;
    fetchData()
    self.ctx.$scope.cardTitle = cardTitle;
}

self.typeParameters = function() {
    return {
        maxDatasources: 1,
        maxDataKeys: 5,
        singleEntity: true,
        previewWidth: '250px',
        previewHeight: '250px',
        embedTitlePanel: true
    };
};

self.onDestroy = function() {
}

self.actionSources = function() {    
    return {        
        'cardClick': {
            name: 'widget-action.card-click',
            multiple: false        
        }    
    };
}