// Controller for ar-condicionado-ligar-desligar
/* eslint-disable */
'esversion: 8'

// Service functions
async function sendCommandRPC(centralId, body) {
    const $http = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('http'),
    );
    const response = await $http.post(`https://${centralId}.y.myio.com.br/api/rpc`, body).toPromise();
    return response;
}

// Command handling
async function sendCommand() {
    if (!self.ctx.$scope.selectedCommand) {
        alert('Por favor, selecione um comando antes de enviar.');
        return;
    }

    self.ctx.$scope.loading = true;
    self.ctx.detectChanges();
    
    const { centralId } = self.ctx.settings;
    const entityName = self.ctx.defaultSubscription.data[0].datasource.entityName;
    
    try {
        await sendCommandRPC(centralId, {
            device: entityName,
            method: "infraredActivate",
            params: {
                command_id: self.ctx.$scope.selectedCommand.commandId,
                slave_id: self.ctx.$scope.selectedCommand.slaveId
            }
        });
        
        // Show success animation
        self.ctx.$scope.loading = false;
        self.ctx.$scope.showSuccess = true;
        self.ctx.detectChanges();
        
        // Reset to normal state after 3 seconds
        setTimeout(() => {
            self.ctx.$scope.showSuccess = false;
            self.ctx.detectChanges();
        }, 3000);
    } catch (error) {
        console.error('Error sending command:', error);
        
        // Show error animation
        self.ctx.$scope.loading = false;
        self.ctx.$scope.showError = true;
        self.ctx.detectChanges();
        
        // Reset to normal state after 3 seconds
        setTimeout(() => {
            self.ctx.$scope.showError = false;
            self.ctx.detectChanges();
        }, 3000);
    }
}

// Fetch data - commands and entity information
async function fetchData() {
    const attributeService = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('attributeService')
    );

    // Get entity information
    const entityId = self.ctx.defaultSubscription.data[0].datasource.entityId;
    const entityName = self.ctx.defaultSubscription.data[0].datasource.entityName;
    const entityLabel = self.ctx.defaultSubscription.data[0].datasource.entityLabel;
    
    // Initialize scope
    self.ctx.$scope.entityName = entityLabel || entityName;
    self.ctx.$scope.loading = false;
    self.ctx.$scope.showSuccess = false;
    self.ctx.$scope.showError = false;
    self.ctx.$scope.commands = [];
    
    try {
        // Get device commands from server attributes - same as in agendamento_ir_individual
        const attributes = await attributeService.getEntityAttributes({
            id: entityId,
            entityType: 'DEVICE',
        }, 'SERVER_SCOPE').toPromise();
        
        const commandsAttribute = attributes.find(attr => attr.key === 'commands');
        if (commandsAttribute) {
            self.ctx.$scope.commands = commandsAttribute.value.map(cmd => ({
                name: cmd.name,
                commandId: cmd.commandId,
                slaveId: cmd.slaveId
            }));
        }
    } catch (error) {
        console.error('Error fetching commands:', error);
    }
}

// Widget lifecycle methods
self.onInit = async function() {
    self.ctx.$scope.sendCommand = sendCommand;
    self.ctx.$scope.selectedCommand = null;
    
    await fetchData();
    self.ctx.detectChanges();
}

self.onDataUpdated = async function() {
    await fetchData();
    self.ctx.detectChanges();
}

self.onDestroy = function() {
    // Clean up any resources if needed
}

