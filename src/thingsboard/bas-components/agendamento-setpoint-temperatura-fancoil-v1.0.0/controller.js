// Controller for agendamento-setpoint-temperatura-fancoil-v1.0.0
/* eslint-disable */
'esversion: 8';

function addSchedule() {
    self.ctx.$scope.schedules.push({
        startTime: '00:00',
        endTime: '00:00',
        setpoint: 23,
        daysWeek: {
            mon: false,
            tue: false,
            wed: false,
            thu: false,
            fri: false,
            sat: false,
            sun: false,
        },
        holiday: false,
        errors: {}
    });
}

// Helper function to convert HH:MM time to minutes since midnight
function timeToMinutes(time) {
    if (!/^[0-2][0-9]:[0-5][0-9]$/.test(time)) {
        return NaN; // Invalid format
    }
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

// Validation function for a single schedule entry
function validateScheduleEntry(schedule) {
    schedule.errors = {}; // Reset errors

    const startMinutes = timeToMinutes(schedule.startTime);
    const endMinutes = timeToMinutes(schedule.endTime);

    if (isNaN(startMinutes)) {
        schedule.errors.startTime = 'Formato inválido (HH:MM).';
    }
    if (isNaN(endMinutes)) {
        schedule.errors.endTime = 'Formato inválido (HH:MM).';
    }

    if (!isNaN(startMinutes) && !isNaN(endMinutes) && startMinutes >= endMinutes) {
        schedule.errors.endTime = 'Hora final deve ser após a hora inicial.';
    }

    const daysSelected = Object.values(schedule.daysWeek).some(day => day === true);
    if (!daysSelected && !schedule.holiday) {
        schedule.errors.daysWeek = 'Selecione pelo menos um dia ou feriado.';
    }

    const setpoint = schedule.setpoint;
    if (setpoint === null || setpoint === undefined || setpoint === '') {
        schedule.errors.setpoint = 'Setpoint é obrigatório.';
    } else {
        const setpointNum = Number(setpoint);
        if (!Number.isInteger(setpointNum)) {
            schedule.errors.setpoint = 'Deve ser um número inteiro.';
        } else if (setpointNum < 16 || setpointNum > 26) {
            schedule.errors.setpoint = 'Deve estar entre 16 e 26.';
        }
    }

    return Object.keys(schedule.errors).length === 0;
}

// Validation function for overlaps
function validateOverlaps(schedules) {
    let hasOverlapError = false;
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    for (let i = 0; i < schedules.length; i++) {
        const scheduleA = schedules[i];
        // Clear previous overlap errors for schedule A if not already set by other validation
        if (scheduleA.errors && !scheduleA.errors.overlap) {
             delete scheduleA.errors.overlap;
        }

        const startA = timeToMinutes(scheduleA.startTime);
        const endA = timeToMinutes(scheduleA.endTime);

        if (isNaN(startA) || isNaN(endA)) continue; // Skip if times are invalid

        for (let j = i + 1; j < schedules.length; j++) {
            const scheduleB = schedules[j];
            // Clear previous overlap errors for schedule B if not already set by other validation
            if (scheduleB.errors && !scheduleB.errors.overlap) {
                 delete scheduleB.errors.overlap;
            }

            const startB = timeToMinutes(scheduleB.startTime);
            const endB = timeToMinutes(scheduleB.endTime);

            if (isNaN(startB) || isNaN(endB)) continue; // Skip if times are invalid

            // Check for overlap on common active days
            const commonDays = days.some(day => scheduleA.daysWeek[day] && scheduleB.daysWeek[day]);
            const holidayOverlap = scheduleA.holiday && scheduleB.holiday;

            if (commonDays || holidayOverlap) {
                // Check for time interval overlap
                if (startA < endB && endA > startB) {
                    scheduleA.errors.overlap = 'Conflito com outro horário.';
                    scheduleB.errors.overlap = 'Conflito com outro horário.';
                    hasOverlapError = true;
                }
            }
        }
    }
    return !hasOverlapError;
}

// Main validation function
function validateSchedules(schedules) {
    let allEntriesValid = true;
    schedules.forEach(schedule => {
        if (!validateScheduleEntry(schedule)) {
            allEntriesValid = false;
        }
    });

    // Only check overlaps if individual entries are potentially valid regarding time
    let overlapsValid = true;
    if (allEntriesValid) { // Optimization: Can skip overlap check if basic format/logic is wrong
       overlapsValid = validateOverlaps(schedules);
    } else {
        // If entry validation failed, ensure any previous overlap errors are cleared
        // unless the overlap check actually ran and set them.
        validateOverlaps(schedules); // Run to clear/set overlap flags appropriately even if entries fail
    }


    return allEntriesValid && overlapsValid;
}

async function sendRPC(centralId, payload) {
    const $http = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));

    // Use the pre-constructed payload directly
    const response = await $http.post(`https://${centralId}.y.myio.com.br/api/setpoint_schedules`, payload).toPromise();

    console.log('Resposta RPC:', response);
    return response;
}

async function submit() {
    // --- Pre-checks ---
    if (self.ctx.$scope.loadError) {
        alert('Erro de configuração: ' + self.ctx.$scope.loadError);
        return;
    }
    const { fancoil, temperatureDevice, valveDevice } = self.ctx.$scope.deviceInfo;
    if (!fancoil || !temperatureDevice || !valveDevice) {
         alert('Erro interno: Informações do dispositivo ausentes. Verifique os aliases.');
         console.error('Submit failed: Missing device info in scope', self.ctx.$scope.deviceInfo);
         return;
    }

    // --- Validate Schedules ---
    if (!validateSchedules(self.ctx.$scope.schedules)) {
        console.log('Validation failed:', self.ctx.$scope.schedules);
        alert('Existem erros nos agendamentos. Por favor, corrija-os.');
        self.ctx.detectChanges();
        return;
    }
    self.ctx.$scope.schedules.forEach(schedule => schedule.errors = {}); // Clear errors on success

    // --- Prepare Data ---    
    const { centralId } = self.ctx.settings;
    const attributeService = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('attributeService'));
    const schedulesPayload = self.ctx.$scope.schedules.map(s => {
        const { errors, ...rest } = s;
        return rest; // Payload without errors
    });

    self.ctx.$scope.loading = true;
    self.ctx.detectChanges();

    try {
        // --- Save Attributes to all 3 devices ---
        const devicesToUpdate = [fancoil, temperatureDevice, valveDevice];
        const attributesToSave = [{ key: 'schedules', value: schedulesPayload }];

        for (const device of devicesToUpdate) {
            const deviceEntityId = { id: device.id, entityType: device.entityType };
            console.log(`Saving attributes to ${device.name} (${device.id})`);
            await attributeService
                .saveEntityAttributes(deviceEntityId, 'SERVER_SCOPE', attributesToSave)
                .toPromise();
        }

        // --- Prepare and Send Consolidated RPC ---      
        const rpcPayload = {
            method: 'set_setpoints',
            // 'device' field might not be needed by the API anymore if all info is in params,
            // but keeping it as temperatureDevice for potential compatibility.
            // Adjust or remove if the API doesn't expect it.
            device: temperatureDevice.name, 
            params: {
                schedules: schedulesPayload,
                fancoilDevice: { name: fancoil.name, id: fancoil.id },
                temperatureDevice: { name: temperatureDevice.name, id: temperatureDevice.id },
                valveDevice: { name: valveDevice.name, id: valveDevice.id }
            }
        };

        console.log('Enviando RPC consolidado com payload:', rpcPayload);
        await sendRPC(centralId, rpcPayload);

        alert('Agendamentos salvos com sucesso para os dispositivos configurados.');

    } catch (e) {
        console.error('Erro ao salvar agendamentos ou enviar RPC:', e);
        alert('Erro ao salvar agendamentos. Por favor, tente novamente.');
        console.error('Erro ao salvar agendamentos ou enviar RPC:', e);
        self.ctx.$scope.footerError = "Erro ao salvar agendamentos. Verifique a conexão ou os dispositivos.";
        self.ctx.detectChanges();        
    } finally {
        self.ctx.$scope.loading = false;
        self.ctx.detectChanges();
    }
}

async function loadSchedules() {
    self.ctx.$scope.loading = true; // Set loading true at the start
    try {
        const attributeService = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('attributeService'));
        //const tempDevice = self.ctx.$scope.deviceInfo.temperatureDevice;

        // Ensure temperatureDevice was found in onInit
        /*
        if (!tempDevice) {
            console.error('TemperatureDevice not identified. Cannot load schedules.');
            self.ctx.$scope.loadError = "Dispositivo de temperatura não encontrado (alias 'temperatureDevice').";
            self.ctx.$scope.schedules = []; // Ensure schedules is empty
            return; // Exit early
        }
        */

        //const deviceEntityId = { id: tempDevice.id, entityType: tempDevice.entityType };
        
        
        const fancoilDevice = self.ctx.$scope.deviceInfo.fancoil;
        
        if (!fancoilDevice) {
            console.error('FancoilDevice not identified. Cannot load schedules.');
            self.ctx.$scope.loadError = "Dispositivo Vent./Fancoil não encontrado (alias 'fancoil').";
            self.ctx.$scope.schedules = []; // Ensure schedules is empty
            return; // Exit early
        }        

        const deviceEntityId = { id: fancoilDevice.id, entityType: fancoilDevice.entityType };

        console.log('Loading schedules from:', fancoilDevice.name);
        const attributes = await attributeService.getEntityAttributes(deviceEntityId, 'SERVER_SCOPE', ['schedules']).toPromise();
        const schedulesAttr = attributes.find(attr => attr.key === 'schedules');

        if (schedulesAttr && schedulesAttr.value && Array.isArray(schedulesAttr.value)) {
            self.ctx.$scope.schedules = schedulesAttr.value.map(s => ({
                ...s,
                setpoint: s.setpoint !== undefined ? s.setpoint : 23,
                errors: s.errors || {}
            }));
            console.log('Agendamentos carregados:', self.ctx.$scope.schedules);
        } else {
            console.log('Nenhum agendamento salvo encontrado no dispositivo de temperatura.');
            self.ctx.$scope.schedules = []; // Initialize if none found
        }
    } catch (e) {
        console.error('Erro ao carregar agendamentos:', e);
        self.ctx.$scope.loadError = "Erro ao carregar agendamentos.";
        self.ctx.$scope.schedules = []; // Ensure schedules is empty on error
        console.error('Erro ao carregar agendamentos:', e);
        self.ctx.$scope.footerError = "Falha ao carregar agendamentos.";
        self.ctx.detectChanges();        
    } finally {
         self.ctx.$scope.loading = false; // Set loading false at the end
         self.ctx.detectChanges();
    }
}

function remove(schedule) {
    const index = self.ctx.$scope.schedules.indexOf(schedule);
    if (index > -1) { // Check if found
        self.ctx.$scope.schedules.splice(index, 1);
        // Re-validate after removing an item as overlaps might change
        validateSchedules(self.ctx.$scope.schedules);
        self.ctx.detectChanges();
    }
}

self.onInit = async function() {
    console.log("Aliases detectados:", self.ctx.data.map(d => d.dataKey?.label));
    self.ctx.$scope.footerError = null;
    self.ctx.$scope.loading = true;
    self.ctx.$scope.loadError = null; // Initialize load error message
    self.ctx.$scope.deviceInfo = { // Store device details here
        fancoil: null,
        temperatureDevice: null,
        valveDevice: null
    };

    // --- Identify Devices by Alias ---
    const requiredAliases = ['fancoil', 'temperatureDevice', 'valveDevice'];
    let foundAliases = new Set();

    if (self.ctx.data && self.ctx.data.length > 0) {
        self.ctx.data.forEach(datasource => {
            // console.log('datasource:', datasource); // Keep this log for debugging if needed
            // --- MODIFIED: Use dataKey.label instead of datasource.alias ---
            const alias = datasource.dataKey ? datasource.dataKey.label : null;
            // --------------------------------------------------------------
            if (alias && requiredAliases.includes(alias)) {
                 if (self.ctx.$scope.deviceInfo[alias]) {
                     console.warn(`Duplicate alias (dataKey label) found: ${alias}. Using the first one encountered.`);
                 } else {
                     self.ctx.$scope.deviceInfo[alias] = {
                         name: datasource.datasource.entityName,
                         id: datasource.datasource.entityId,
                         entityType: datasource.datasource.entityType
                     };
                     foundAliases.add(alias);
                     console.log(`Identified ${alias}:`, self.ctx.$scope.deviceInfo[alias].name);
                 }
            }
        });
    }

    // --- Check if all required devices were found ---
    if (foundAliases.size !== requiredAliases.length) {
         const missingAliases = requiredAliases.filter(a => !foundAliases.has(a));
         console.error('Missing required device aliases:', missingAliases);
         self.ctx.$scope.loadError = `Erro: Falta(m) alias(es) de dispositivo(s) obrigatório(s): ${missingAliases.join(', ')}.`;
         self.ctx.$scope.loading = false;
         self.ctx.detectChanges();
         return; // Stop initialization
    }

    // --- Setup Scope Functions ---
    self.ctx.$scope.addSchedule = addSchedule;
    self.ctx.$scope.submit = submit; // submit will be modified next
    self.ctx.$scope.remove = remove;

    self.ctx.$scope.schedules = [];

    // --- Load Schedules (now uses identified temperatureDevice) ---
    await loadSchedules(); // loadSchedules now sets loading to false and detects changes

    // self.ctx.$scope.loading = false; // Moved inside loadSchedules finally block
    // self.ctx.detectChanges(); // Moved inside loadSchedules finally block
}

self.onDataUpdated = function() {}

self.onDestroy = function() {}
