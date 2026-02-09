// Controller for solenoide-sem-on-off-v2.0.1
/* jshint esversion: 8 */
/* eslint-disable */

self.onInit = function() {
    updateValveVisual();
    self.ctx.detectChanges();
};

self.onDataUpdated = function() {
    updateValveVisual();
    self.ctx.detectChanges();
};

function updateValveVisual() {
    const valveImg = document.getElementById('valve-img');
    
    if (!valveImg) return;
    
    let src = "";

    const connectionStatus = self.ctx.data?.[0].data?.[0]?.[1] || 'offline';
    
    if (connectionStatus === 'offline') {
        src = "/api/images/public/gkSGqEFP4rgApNArjEoctM0BoLZMiKz6";
    } else {
        const dataValue = self.ctx.data?.[1]?.data?.[0]?.[1];
        
        src = dataValue === 'on' ? 
            "/api/images/public/Tnq47Vd1TxhhqhYoHvzS73WVh1X84fPa" : // ON
            "/api/images/public/dzVDTk3IxrOYkJ1sH92nXQFBaW53kVgs" ; // OFF
    }
    
    valveImg.src = src;
}
