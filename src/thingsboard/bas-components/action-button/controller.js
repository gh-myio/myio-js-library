// Controller for action-button
/* eslint-disable */
self.onInit = function() {
    self.ctx.$scope.actionWidget.onInit();
}

self.actionSources = function() {
    return {
        'click': {
            name: 'widget-action.click',
            multiple: false
        }
    };
}

self.typeParameters = function() {
    return {
        dataKeysOptional: true,
        datasourcesOptional: true,
        maxDatasources: 1,
        maxDataKeys: 0,
        singleEntity: true,
        previewWidth: '200px',
        previewHeight: '80px',
        embedTitlePanel: true,
        overflowVisible: true,
        hideDataSettings: true
    };
}

self.onDestroy = function() {
}

