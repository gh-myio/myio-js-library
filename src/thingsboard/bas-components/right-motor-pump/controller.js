// Controller for right-motor-pump
/* eslint-disable */
self.onInit = function() {
    self.ctx.$scope.actionWidget.onInit();
}

self.typeParameters = function() {
    return {
        previewWidth: '400px',
        previewHeight: '320px',
        embedTitlePanel: true,
        targetDeviceOptional: true,
        displayRpcMessageToast: false
    };
};

self.onDestroy = function() {
}
