self.onInit = function () {};

self.onDataUpdated = function () {
  self.ctx.$scope.timeseriesTableWidget.onDataUpdated();
};

self.onLatestDataUpdated = function () {
  self.ctx.$scope.timeseriesTableWidget.onLatestDataUpdated();
};

self.onEditModeChanged = function () {
  self.ctx.$scope.timeseriesTableWidget.onEditModeChanged();
};

self.typeParameters = function () {
  return {
    ignoreDataUpdateOnIntervalTick: true,
    hasAdditionalLatestDataKeys: true,
    defaultDataKeysFunction: function () {
      return [{ name: 'temperature', label: 'Temperature', type: 'timeseries', units: '°C', decimals: 0 }];
    },
  };
};

self.actionSources = function () {
  return {
    actionCellButton: {
      name: 'widget-action.action-cell-button',
      multiple: true,
      hasShowCondition: true,
    },
    rowClick: {
      name: 'widget-action.row-click',
      multiple: false,
    },
  };
};

self.onDestroy = function () {};
