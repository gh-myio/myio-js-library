// Controller for svg-hidrometro
/* eslint-disable */
function getSum(data) {
    const totalSum = data.reduce((acc, reading) => {
        return acc + reading[1];
    }, 0);

    return (totalSum).toFixed(0);
}

self.onInit = function() {
    const data = self.ctx.data[0].data;
    console.log(self.ctx.data)

    self.ctx.$scope.sumData = getSum(data);

    self.ctx.detectChanges();
};

self.onDataUpdated = function() {
    const data = self.ctx.data[0].data;

    self.ctx.$scope.sumData = getSum(data);
    self.ctx.detectChanges();
}

self.onLatestDataUpdated = function() {
    const data = self.ctx.data[0].data;

    self.ctx.$scope.sumData = getSum(data);

    self.ctx.detectChanges();
}