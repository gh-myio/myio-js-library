// Controller for backbutton-last-prod-v2
/* eslint-disable */
self.onInit = function() {
    function backPage() {
        const expectedDomain = "dashboard.myio-bas.com";
        window.history.back();
    }

    self.ctx.$scope.backPage = backPage;
};
