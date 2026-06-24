// self.ctx.defaultSubscription.data[0]
//  dataArray = self.ctx.data
// dataArray.forEach(function(data) {
//     console.log(data)
//     })
//     console.log(dataArray)
function fetchData() {
  const subscriptionData = self.ctx.data[0].data;
  const generatorStatus = !subscriptionData.length || !subscriptionData[0][1] ? null : subscriptionData[0][1];

  const subscriptionData2 = self.ctx.data[1].data;
  const eletricStatus =
    !subscriptionData2.length || !subscriptionData2[0][1] ? null : subscriptionData2[0][1];

  const entityName = self.ctx.defaultSubscription.data[0].datasource.entityLabel;

  self.ctx.$scope.generatorStatus = generatorStatus;
  self.ctx.$scope.eletricStatus = eletricStatus;
  self.ctx.$scope.entityName = entityName;
}

self.onInit = function () {
  self.ctx.detectChanges();
};

self.onDataUpdated = function () {
  fetchData();
  self.ctx.detectChanges();
};

self.onLatestDataUpdated = function () {
  fetchData();
  self.ctx.detectChanges();
};
