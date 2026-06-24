// ============================================================================
// OPERATIONAL INDICATORS PANEL - ThingsBoard Widget Controller
// Version: 1.0.0
// Description: Real-time monitoring of escalators and elevators with KPI metrics
// ============================================================================

// ============================================================================
// MOCK DATA - Remove in production and use real telemetry
// ============================================================================

const MOCK_EQUIPMENT = [
    {
        id: 'esc-001',
        name: 'Escada Rolante 01',
        type: 'escalator',
        location: 'Bloco A - Térreo',
        status: true,
        operationTime: 43200,    // 30 days in minutes
        maintenanceTime: 180,    // 3 hours total
        stopCount: 2,
        phaseReversal: false,
        gridFrequency: 60.1,
        powerDemand: 15.5,
        currentR: 22.3,
        currentS: 21.8,
        currentT: 22.1,
        voltageRS: 380,
        voltageST: 379,
        voltageTR: 381,
        energyConsumption: 1250.5,
        lastUpdate: Date.now() - 60000
    },
    {
        id: 'esc-002',
        name: 'Escada Rolante 02',
        type: 'escalator',
        location: 'Bloco A - 1º Andar',
        status: true,
        operationTime: 43200,
        maintenanceTime: 240,
        stopCount: 3,
        phaseReversal: false,
        gridFrequency: 59.9,
        powerDemand: 14.8,
        currentR: 21.5,
        currentS: 21.2,
        currentT: 21.7,
        voltageRS: 378,
        voltageST: 380,
        voltageTR: 379,
        energyConsumption: 1180.2,
        lastUpdate: Date.now() - 30000
    },
    {
        id: 'esc-003',
        name: 'Escada Rolante 03',
        type: 'escalator',
        location: 'Bloco B - Térreo',
        status: false,
        operationTime: 40000,
        maintenanceTime: 3200,
        stopCount: 8,
        phaseReversal: true,
        gridFrequency: 58.5,
        powerDemand: 0,
        currentR: 0,
        currentS: 0,
        currentT: 0,
        voltageRS: 375,
        voltageST: 374,
        voltageTR: 376,
        energyConsumption: 980.8,
        lastUpdate: Date.now() - 120000
    },
    {
        id: 'elev-001',
        name: 'Elevador 01',
        type: 'elevator',
        location: 'Bloco A - Central',
        status: true,
        operationTime: 43200,
        maintenanceTime: 120,
        stopCount: 1,
        phaseReversal: false,
        gridFrequency: 60.0,
        powerDemand: 25.2,
        currentR: 35.1,
        currentS: 34.8,
        currentT: 35.0,
        voltageRS: 380,
        voltageST: 381,
        voltageTR: 380,
        energyConsumption: 2100.5,
        lastUpdate: Date.now() - 45000
    },
    {
        id: 'elev-002',
        name: 'Elevador 02',
        type: 'elevator',
        location: 'Bloco A - Central',
        status: true,
        operationTime: 43200,
        maintenanceTime: 90,
        stopCount: 1,
        phaseReversal: false,
        gridFrequency: 60.2,
        powerDemand: 24.8,
        currentR: 34.5,
        currentS: 34.2,
        currentT: 34.8,
        voltageRS: 381,
        voltageST: 380,
        voltageTR: 382,
        energyConsumption: 2050.3,
        lastUpdate: Date.now() - 50000
    },
    {
        id: 'elev-003',
        name: 'Elevador 03',
        type: 'elevator',
        location: 'Bloco B - Norte',
        status: true,
        operationTime: 43200,
        maintenanceTime: 300,
        stopCount: 4,
        phaseReversal: false,
        gridFrequency: 59.8,
        powerDemand: 26.1,
        currentR: 36.2,
        currentS: 35.9,
        currentT: 36.0,
        voltageRS: 379,
        voltageST: 378,
        voltageTR: 380,
        energyConsumption: 2200.1,
        lastUpdate: Date.now() - 35000
    },
    {
        id: 'elev-004',
        name: 'Elevador 04',
        type: 'elevator',
        location: 'Bloco B - Sul',
        status: false,
        operationTime: 38000,
        maintenanceTime: 5200,
        stopCount: 12,
        phaseReversal: false,
        gridFrequency: 59.5,
        powerDemand: 0,
        currentR: 0,
        currentS: 0,
        currentT: 0,
        voltageRS: 377,
        voltageST: 376,
        voltageTR: 378,
        energyConsumption: 1850.7,
        lastUpdate: Date.now() - 180000
    },
    {
        id: 'esc-004',
        name: 'Escada Rolante 04',
        type: 'escalator',
        location: 'Bloco C - Térreo',
        status: true,
        operationTime: 43200,
        maintenanceTime: 60,
        stopCount: 1,
        phaseReversal: false,
        gridFrequency: 60.0,
        powerDemand: 15.0,
        currentR: 21.8,
        currentS: 21.5,
        currentT: 21.9,
        voltageRS: 380,
        voltageST: 380,
        voltageTR: 381,
        energyConsumption: 1320.4,
        lastUpdate: Date.now() - 25000
    }
];

const MOCK_ALERTS = [
    {
        id: 'alert-001',
        type: 'offline',
        equipmentId: 'esc-003',
        equipmentName: 'Escada Rolante 03',
        message: 'Equipamento offline - falha detectada',
        severity: 'critical',
        timestamp: Date.now() - 7200000,
        acknowledged: false
    },
    {
        id: 'alert-002',
        type: 'phase_reversal',
        equipmentId: 'esc-003',
        equipmentName: 'Escada Rolante 03',
        message: 'Inversão de fase detectada',
        severity: 'critical',
        timestamp: Date.now() - 7100000,
        acknowledged: false
    },
    {
        id: 'alert-003',
        type: 'offline',
        equipmentId: 'elev-004',
        equipmentName: 'Elevador 04',
        message: 'Equipamento offline - manutenção',
        severity: 'critical',
        timestamp: Date.now() - 3600000,
        acknowledged: true
    },
    {
        id: 'alert-004',
        type: 'frequency_anomaly',
        equipmentId: 'esc-003',
        equipmentName: 'Escada Rolante 03',
        message: 'Frequência da rede anormal: 58.5 Hz',
        severity: 'warning',
        timestamp: Date.now() - 7000000,
        acknowledged: false
    },
    {
        id: 'alert-005',
        type: 'frequency_anomaly',
        equipmentId: 'elev-004',
        equipmentName: 'Elevador 04',
        message: 'Frequência da rede anormal: 59.5 Hz',
        severity: 'warning',
        timestamp: Date.now() - 3500000,
        acknowledged: true
    }
];

// ============================================================================
// CALCULATION SERVICE
// ============================================================================

class CalculationService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 60000;
    }

    calculateMTBF(operationTime, maintenanceTime, stopCount) {
        if (stopCount === 0) {
            return (operationTime - maintenanceTime) / 60;
        }
        const uptimeMinutes = operationTime - maintenanceTime;
        const mtbfMinutes = uptimeMinutes / stopCount;
        const mtbfHours = mtbfMinutes / 60;
        return Math.max(0, mtbfHours);
    }

    calculateMTTR(maintenanceTime, stopCount) {
        if (stopCount === 0) {
            return 0;
        }
        const mttrMinutes = maintenanceTime / stopCount;
        const mttrHours = mttrMinutes / 60;
        return Math.max(0, mttrHours);
    }

    calculateAvailability(mtbf, mttr) {
        if (mtbf === 0 && mttr === 0) {
            return 100;
        }
        if (mtbf === 0) {
            return 0;
        }
        const availability = (mtbf / (mtbf + mttr)) * 100;
        return Math.min(100, Math.max(0, availability));
    }

    calculateEquipmentKPIs(equipment) {
        const { operationTime = 0, maintenanceTime = 0, stopCount = 0 } = equipment;
        const mtbf = this.calculateMTBF(operationTime, maintenanceTime, stopCount);
        const mttr = this.calculateMTTR(maintenanceTime, stopCount);
        const availability = this.calculateAvailability(mtbf, mttr);

        return {
            mtbf: Math.round(mtbf * 10) / 10,
            mttr: Math.round(mttr * 10) / 10,
            availability: Math.round(availability * 10) / 10
        };
    }

    calculateConsolidatedKPIs(equipmentList) {
        if (!equipmentList || equipmentList.length === 0) {
            return {
                totalEquipment: 0,
                avgAvailability: 0,
                avgMtbf: 0,
                avgMttr: 0,
                onlineCount: 0,
                offlineCount: 0
            };
        }

        const totals = equipmentList.reduce((acc, eq) => {
            acc.availability += eq.availability || 0;
            acc.mtbf += eq.mtbf || 0;
            acc.mttr += eq.mttr || 0;
            acc.online += eq.status ? 1 : 0;
            return acc;
        }, { availability: 0, mtbf: 0, mttr: 0, online: 0 });

        const count = equipmentList.length;

        return {
            totalEquipment: count,
            avgAvailability: Math.round((totals.availability / count) * 10) / 10,
            avgMtbf: Math.round((totals.mtbf / count) * 10) / 10,
            avgMttr: Math.round((totals.mttr / count) * 10) / 10,
            onlineCount: totals.online,
            offlineCount: count - totals.online
        };
    }

    checkGridFrequency(frequency, threshold = 5) {
        const nominal = 60;
        const deviation = Math.abs((frequency - nominal) / nominal) * 100;
        return {
            frequency,
            nominal,
            deviation: Math.round(deviation * 100) / 100,
            isNormal: deviation <= threshold,
            status: deviation <= threshold ? 'normal' : 'abnormal'
        };
    }
}

// ============================================================================
// ALERT SERVICE
// ============================================================================

class AlertService {
    constructor() {
        this.alertQueue = [];
        this.alertHistory = [...MOCK_ALERTS];
        this.maxHistory = 100;
        this.alertTypes = {
            OFFLINE: 'offline',
            PHASE_REVERSAL: 'phase_reversal',
            FREQUENCY_ANOMALY: 'frequency_anomaly',
            INACTIVITY_VIOLATION: 'inactivity_violation'
        };
    }

    checkAlertConditions(equipment, settings) {
        const alerts = [];

        if (!equipment.status) {
            alerts.push(this.createAlert(
                this.alertTypes.OFFLINE,
                equipment,
                `Equipamento ${equipment.name} está offline`,
                'critical'
            ));
        }

        if (equipment.phaseReversal) {
            alerts.push(this.createAlert(
                this.alertTypes.PHASE_REVERSAL,
                equipment,
                `Inversão de fase detectada em ${equipment.name}`,
                'critical'
            ));
        }

        if (settings.alerts && settings.alerts.enabled) {
            const freqCheck = this.checkFrequencyAnomaly(
                equipment.gridFrequency,
                settings.alerts.frequencyThreshold || 5
            );
            if (!freqCheck.isNormal) {
                alerts.push(this.createAlert(
                    this.alertTypes.FREQUENCY_ANOMALY,
                    equipment,
                    `Frequência anormal (${freqCheck.frequency} Hz) em ${equipment.name}`,
                    'warning'
                ));
            }
        }

        return alerts;
    }

    createAlert(type, equipment, message, severity) {
        return {
            id: this.generateAlertId(),
            type,
            equipmentId: equipment.id,
            equipmentName: equipment.name,
            message,
            severity,
            timestamp: Date.now(),
            acknowledged: false
        };
    }

    checkFrequencyAnomaly(frequency, threshold) {
        const nominal = 60;
        const deviation = Math.abs((frequency - nominal) / nominal) * 100;
        return {
            frequency,
            deviation,
            isNormal: deviation <= threshold
        };
    }

    isInInactivityWindow(currentHour, startHour, endHour) {
        if (startHour > endHour) {
            return currentHour >= startHour || currentHour < endHour;
        }
        return currentHour >= startHour && currentHour < endHour;
    }

    getAlertHistory(limit = 10) {
        return this.alertHistory.slice(0, limit);
    }

    acknowledgeAlert(alertId) {
        const alert = this.alertHistory.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedAt = Date.now();
        }
    }

    getActiveAlertsCount() {
        return this.alertHistory.filter(a => !a.acknowledged).length;
    }

    getAlertsByEquipment(equipmentId) {
        return this.alertHistory.filter(a => a.equipmentId === equipmentId);
    }

    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ============================================================================
// REPORT SERVICE
// ============================================================================

class ReportService {
    generateDailyReportData(equipment) {
        const reportDate = new Date();
        reportDate.setDate(reportDate.getDate() - 1);

        return {
            reportType: 'daily',
            reportDate: reportDate.toISOString().split('T')[0],
            generatedAt: new Date().toISOString(),
            summary: this.calculateSummary(equipment),
            equipment: equipment.map(eq => ({
                name: eq.name,
                type: eq.type,
                location: eq.location,
                status: eq.status ? 'Online' : 'Offline',
                availability: eq.availability,
                mtbf: eq.mtbf,
                mttr: eq.mttr,
                alertCount: eq.alertCount || 0
            })),
            ranking: this.generateRanking(equipment)
        };
    }

    generateMonthlyReportData(equipment, month, year) {
        return {
            reportType: 'monthly',
            month,
            year,
            generatedAt: new Date().toISOString(),
            summary: this.calculateSummary(equipment),
            equipment: equipment.map(eq => ({
                name: eq.name,
                type: eq.type,
                location: eq.location,
                avgAvailability: eq.availability,
                avgMtbf: eq.mtbf,
                avgMttr: eq.mttr,
                totalAlerts: eq.alertCount || 0,
                downtime: this.calculateDowntime(eq)
            })),
            ranking: this.generateRanking(equipment)
        };
    }

    calculateSummary(equipment) {
        const total = equipment.length;
        if (total === 0) return { totalEquipment: 0, onlineCount: 0, offlineCount: 0, avgAvailability: 0, avgMtbf: 0, avgMttr: 0 };

        const online = equipment.filter(eq => eq.status).length;
        const avgAvailability = equipment.reduce((sum, eq) => sum + (eq.availability || 0), 0) / total;
        const avgMtbf = equipment.reduce((sum, eq) => sum + (eq.mtbf || 0), 0) / total;
        const avgMttr = equipment.reduce((sum, eq) => sum + (eq.mttr || 0), 0) / total;

        return {
            totalEquipment: total,
            onlineCount: online,
            offlineCount: total - online,
            avgAvailability: Math.round(avgAvailability * 10) / 10,
            avgMtbf: Math.round(avgMtbf * 10) / 10,
            avgMttr: Math.round(avgMttr * 10) / 10
        };
    }

    generateRanking(equipment) {
        return [...equipment]
            .sort((a, b) => (b.availability || 0) - (a.availability || 0))
            .map((eq, index) => ({
                rank: index + 1,
                name: eq.name,
                availability: eq.availability || 0
            }));
    }

    calculateDowntime(equipment) {
        return Math.round((equipment.mttr || 0) * (equipment.stopCount || 0) * 10) / 10;
    }

    exportToCSV(reportData) {
        const headers = [
            'Equipamento',
            'Tipo',
            'Local',
            'Status',
            'Disponibilidade (%)',
            'MTBF (h)',
            'MTTR (h)',
            'Alertas'
        ];

        const rows = reportData.equipment.map(eq => [
            eq.name,
            eq.type === 'escalator' ? 'Escada' : 'Elevador',
            eq.location || '-',
            eq.status,
            eq.availability || eq.avgAvailability,
            eq.mtbf || eq.avgMtbf,
            eq.mttr || eq.avgMttr,
            eq.alertCount || eq.totalAlerts || 0
        ]);

        const csv = [
            `# Relatório ${reportData.reportType === 'daily' ? 'Diário' : 'Mensal'}`,
            `# Gerado em: ${new Date(reportData.generatedAt).toLocaleString('pt-BR')}`,
            `# Data: ${reportData.reportDate || `${reportData.month}/${reportData.year}`}`,
            '',
            headers.join(';'),
            ...rows.map(row => row.join(';'))
        ].join('\n');

        return csv;
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// ============================================================================
// GAUGE RENDERER
// ============================================================================

class GaugeRenderer {
    static draw(canvas, value, options = {}) {
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        const lineWidth = options.lineWidth || 12;
        const startAngle = 0.75 * Math.PI;
        const endAngle = 2.25 * Math.PI;
        const normalizedValue = Math.min(1, Math.max(0, value / 100));

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw value arc
        const valueEndAngle = startAngle + (1.5 * Math.PI * normalizedValue);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, valueEndAngle);
        ctx.strokeStyle = GaugeRenderer.getColor(value);
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw center text
        ctx.fillStyle = '#333';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${value.toFixed(1)}%`, centerX, centerY - 5);

        ctx.fillStyle = '#888';
        ctx.font = '11px Arial';
        ctx.fillText('Disponibilidade', centerX, centerY + 18);
    }

    static getColor(value) {
        if (value >= 90) return '#4caf50';
        if (value >= 70) return '#ff9800';
        return '#f44336';
    }
}

// ============================================================================
// EQUIPMENT CARD COMPONENT
// ============================================================================

class EquipmentCard {
    constructor(equipment, alertService) {
        this.equipment = equipment;
        this.alertService = alertService;
        this.element = null;
    }

    render() {
        const card = document.createElement('div');
        card.className = 'oip-card';
        card.dataset.equipmentId = this.equipment.id;
        card.dataset.equipmentType = this.equipment.type;

        const alerts = this.alertService.getAlertsByEquipment(this.equipment.id);
        const activeAlerts = alerts.filter(a => !a.acknowledged).length;

        card.innerHTML = `
            <div class="oip-card-header">
                <div class="oip-card-title">
                    <span class="oip-card-icon">${this.getIcon()}</span>
                    <div class="oip-card-info">
                        <span class="oip-card-name">${this.equipment.name}</span>
                        <span class="oip-card-location">${this.equipment.location || ''}</span>
                    </div>
                </div>
                <span class="oip-status-badge ${this.getStatusClass()}">
                    ${this.equipment.status ? 'Online' : 'Offline'}
                </span>
            </div>

            <div class="oip-card-body">
                <div class="oip-gauge-container">
                    <canvas class="oip-gauge-canvas" width="140" height="140"></canvas>
                </div>

                <div class="oip-metrics">
                    <div class="oip-metric">
                        <span class="oip-metric-value">${this.equipment.mtbf.toFixed(1)}h</span>
                        <span class="oip-metric-label">MTBF</span>
                    </div>
                    <div class="oip-metric">
                        <span class="oip-metric-value">${this.equipment.mttr.toFixed(1)}h</span>
                        <span class="oip-metric-label">MTTR</span>
                    </div>
                </div>

                ${this.equipment.phaseReversal ? `
                    <div class="oip-reversal-alert">
                        <span class="oip-reversal-icon">⚠️</span>
                        <span>Inversão de Fase Detectada</span>
                    </div>
                ` : ''}

                <div class="oip-electrical">
                    <div class="oip-electrical-row">
                        <div class="oip-electrical-item">
                            <span class="oip-electrical-value">${this.equipment.gridFrequency.toFixed(1)}</span>
                            <span class="oip-electrical-unit">Hz</span>
                            <span class="oip-electrical-label">Frequência</span>
                        </div>
                        <div class="oip-electrical-item">
                            <span class="oip-electrical-value">${this.equipment.powerDemand.toFixed(1)}</span>
                            <span class="oip-electrical-unit">kW</span>
                            <span class="oip-electrical-label">Potência</span>
                        </div>
                        <div class="oip-electrical-item">
                            <span class="oip-electrical-value">${this.equipment.voltageRS}</span>
                            <span class="oip-electrical-unit">V</span>
                            <span class="oip-electrical-label">Tensão</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="oip-card-footer">
                <div class="oip-alert-count ${activeAlerts > 0 ? 'has-alerts' : ''}">
                    <span class="oip-alert-icon">🔔</span>
                    <span>${activeAlerts} alerta${activeAlerts !== 1 ? 's' : ''}</span>
                </div>
                <span class="oip-last-update">
                    Atualizado: ${this.formatLastUpdate()}
                </span>
            </div>
        `;

        this.element = card;

        // Draw gauge after element is in DOM
        setTimeout(() => {
            const canvas = card.querySelector('.oip-gauge-canvas');
            if (canvas) {
                GaugeRenderer.draw(canvas, this.equipment.availability);
            }
        }, 0);

        return card;
    }

    getIcon() {
        return this.equipment.type === 'escalator' ? '🚶' : '🛗';
    }

    getStatusClass() {
        if (!this.equipment.status) return 'status-offline';
        if (this.equipment.phaseReversal) return 'status-warning';
        return 'status-online';
    }

    formatLastUpdate() {
        const diff = Date.now() - this.equipment.lastUpdate;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'agora';
        if (minutes < 60) return `${minutes}min atrás`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h atrás`;
    }

    update(equipment) {
        this.equipment = equipment;
        if (this.element) {
            const newElement = this.render();
            this.element.replaceWith(newElement);
            this.element = newElement;
        }
    }
}

// ============================================================================
// MAIN WIDGET CONTROLLER
// ============================================================================

class OperationalIndicatorsPanel {
    constructor(container, settings = {}) {
        this.container = container;
        this.settings = {
            general: {
                title: 'Painel de Indicadores Operacionais',
                refreshInterval: 60000,
                showConsolidatedView: true,
                ...settings.general
            },
            inactivityWindow: {
                enabled: true,
                startHour: 22,
                endHour: 5,
                ...settings.inactivityWindow
            },
            alerts: {
                enabled: true,
                emailRecipients: [],
                frequencyThreshold: 5,
                ...settings.alerts
            },
            display: {
                cardsPerRow: 4,
                showElectricalIndicators: true,
                ...settings.display
            }
        };

        // Services
        this.calculationService = new CalculationService();
        this.alertService = new AlertService();
        this.reportService = new ReportService();

        // State
        this.state = {
            equipment: [],
            filter: 'all',
            showConsolidated: this.settings.general.showConsolidatedView,
            isLoading: true
        };

        // Card instances
        this.cardInstances = new Map();

        // Initialize
        this.init();
    }

    init() {
        this.render();
        this.loadData();
        this.bindEvents();
        this.startAutoRefresh();
    }

    render() {
        this.container.innerHTML = `
            <div class="oip-container">
                <div class="oip-header">
                    <h2 class="oip-title">${this.settings.general.title}</h2>
                    <div class="oip-controls">
                        <select id="oip-filter" class="oip-select">
                            <option value="all">Todos</option>
                            <option value="escalator">Escadas Rolantes</option>
                            <option value="elevator">Elevadores</option>
                            <option value="online">Online</option>
                            <option value="offline">Offline</option>
                        </select>
                        <label class="oip-toggle">
                            <input type="checkbox" id="oip-consolidated-toggle" ${this.state.showConsolidated ? 'checked' : ''}>
                            <span class="oip-toggle-slider"></span>
                            <span class="oip-toggle-label">Consolidado</span>
                        </label>
                        <div class="oip-export-dropdown">
                            <button id="oip-export-btn" class="oip-btn oip-btn-primary">
                                📥 Exportar
                            </button>
                            <div class="oip-export-menu" id="oip-export-menu">
                                <button class="oip-export-option" data-format="csv">📄 CSV</button>
                                <button class="oip-export-option" data-format="pdf">📑 PDF</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="oip-consolidated" class="oip-consolidated" style="display: ${this.state.showConsolidated ? 'block' : 'none'}">
                    <div class="oip-consolidated-grid">
                        <div class="oip-stat-card">
                            <span class="oip-stat-icon">📊</span>
                            <span id="oip-total" class="oip-stat-value">-</span>
                            <span class="oip-stat-label">Total</span>
                        </div>
                        <div class="oip-stat-card stat-online">
                            <span class="oip-stat-icon">✅</span>
                            <span id="oip-online" class="oip-stat-value">-</span>
                            <span class="oip-stat-label">Online</span>
                        </div>
                        <div class="oip-stat-card stat-offline">
                            <span class="oip-stat-icon">❌</span>
                            <span id="oip-offline" class="oip-stat-value">-</span>
                            <span class="oip-stat-label">Offline</span>
                        </div>
                        <div class="oip-stat-card">
                            <span class="oip-stat-icon">📈</span>
                            <span id="oip-availability" class="oip-stat-value">-</span>
                            <span class="oip-stat-label">Disp. Média</span>
                        </div>
                        <div class="oip-stat-card">
                            <span class="oip-stat-icon">⏱️</span>
                            <span id="oip-mtbf" class="oip-stat-value">-</span>
                            <span class="oip-stat-label">MTBF Médio</span>
                        </div>
                        <div class="oip-stat-card">
                            <span class="oip-stat-icon">🔧</span>
                            <span id="oip-mttr" class="oip-stat-value">-</span>
                            <span class="oip-stat-label">MTTR Médio</span>
                        </div>
                        <div class="oip-stat-card stat-alerts">
                            <span class="oip-stat-icon">🔔</span>
                            <span id="oip-alerts" class="oip-stat-value">-</span>
                            <span class="oip-stat-label">Alertas Ativos</span>
                        </div>
                    </div>
                </div>

                <div id="oip-cards-grid" class="oip-cards-grid">
                    <!-- Cards will be inserted here -->
                </div>

                <div id="oip-loading" class="oip-loading">
                    <div class="oip-spinner"></div>
                    <span>Carregando dados...</span>
                </div>

                <div id="oip-empty" class="oip-empty" style="display: none">
                    <span class="oip-empty-icon">📭</span>
                    <span>Nenhum equipamento encontrado</span>
                </div>

                <div class="oip-alerts-panel" id="oip-alerts-panel">
                    <div class="oip-alerts-header">
                        <h3>🔔 Alertas Recentes</h3>
                        <button id="oip-toggle-alerts" class="oip-btn-icon">▼</button>
                    </div>
                    <div class="oip-alerts-list" id="oip-alerts-list">
                        <!-- Alerts will be inserted here -->
                    </div>
                </div>
            </div>
        `;
    }

    loadData() {
        // In production, this would fetch from ThingsBoard telemetry
        // For now, use mock data
        this.state.isLoading = true;
        this.updateLoadingState();

        setTimeout(() => {
            // Process mock data with KPI calculations
            this.state.equipment = MOCK_EQUIPMENT.map(eq => {
                const kpis = this.calculationService.calculateEquipmentKPIs(eq);
                return {
                    ...eq,
                    ...kpis,
                    alertCount: this.alertService.getAlertsByEquipment(eq.id).filter(a => !a.acknowledged).length
                };
            });

            this.state.isLoading = false;
            this.updateUI();
        }, 500);
    }

    updateUI() {
        this.updateLoadingState();
        this.updateConsolidatedView();
        this.updateCardsGrid();
        this.updateAlertsList();
    }

    updateLoadingState() {
        const loading = this.container.querySelector('#oip-loading');
        const empty = this.container.querySelector('#oip-empty');
        const grid = this.container.querySelector('#oip-cards-grid');

        if (this.state.isLoading) {
            loading.style.display = 'flex';
            empty.style.display = 'none';
            grid.style.display = 'none';
        } else {
            loading.style.display = 'none';
            const filteredEquipment = this.getFilteredEquipment();
            if (filteredEquipment.length === 0) {
                empty.style.display = 'flex';
                grid.style.display = 'none';
            } else {
                empty.style.display = 'none';
                grid.style.display = 'grid';
            }
        }
    }

    updateConsolidatedView() {
        const consolidated = this.calculationService.calculateConsolidatedKPIs(this.state.equipment);
        const activeAlerts = this.alertService.getActiveAlertsCount();

        this.container.querySelector('#oip-total').textContent = consolidated.totalEquipment;
        this.container.querySelector('#oip-online').textContent = consolidated.onlineCount;
        this.container.querySelector('#oip-offline').textContent = consolidated.offlineCount;
        this.container.querySelector('#oip-availability').textContent = `${consolidated.avgAvailability}%`;
        this.container.querySelector('#oip-mtbf').textContent = `${consolidated.avgMtbf}h`;
        this.container.querySelector('#oip-mttr').textContent = `${consolidated.avgMttr}h`;
        this.container.querySelector('#oip-alerts').textContent = activeAlerts;
    }

    updateCardsGrid() {
        const grid = this.container.querySelector('#oip-cards-grid');
        grid.innerHTML = '';
        this.cardInstances.clear();

        const filteredEquipment = this.getFilteredEquipment();

        filteredEquipment.forEach(eq => {
            const card = new EquipmentCard(eq, this.alertService);
            this.cardInstances.set(eq.id, card);
            grid.appendChild(card.render());
        });
    }

    updateAlertsList() {
        const list = this.container.querySelector('#oip-alerts-list');
        const alerts = this.alertService.getAlertHistory(10);

        if (alerts.length === 0) {
            list.innerHTML = '<div class="oip-no-alerts">Nenhum alerta recente</div>';
            return;
        }

        list.innerHTML = alerts.map(alert => `
            <div class="oip-alert-item ${alert.acknowledged ? 'acknowledged' : ''} severity-${alert.severity}">
                <div class="oip-alert-content">
                    <span class="oip-alert-badge ${alert.severity}">${this.getSeverityLabel(alert.severity)}</span>
                    <span class="oip-alert-message">${alert.message}</span>
                    <span class="oip-alert-time">${this.formatAlertTime(alert.timestamp)}</span>
                </div>
                ${!alert.acknowledged ? `
                    <button class="oip-btn-ack" data-alert-id="${alert.id}">✓</button>
                ` : ''}
            </div>
        `).join('');

        // Bind acknowledge buttons
        list.querySelectorAll('.oip-btn-ack').forEach(btn => {
            btn.addEventListener('click', () => {
                this.alertService.acknowledgeAlert(btn.dataset.alertId);
                this.updateAlertsList();
                this.updateConsolidatedView();
            });
        });
    }

    getSeverityLabel(severity) {
        const labels = {
            critical: 'CRÍTICO',
            warning: 'ALERTA',
            info: 'INFO'
        };
        return labels[severity] || severity;
    }

    formatAlertTime(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'agora';
        if (minutes < 60) return `${minutes}min`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        return `${days}d`;
    }

    getFilteredEquipment() {
        return this.state.equipment.filter(eq => {
            switch (this.state.filter) {
                case 'escalator':
                    return eq.type === 'escalator';
                case 'elevator':
                    return eq.type === 'elevator';
                case 'online':
                    return eq.status === true;
                case 'offline':
                    return eq.status === false;
                default:
                    return true;
            }
        });
    }

    bindEvents() {
        // Filter change
        const filter = this.container.querySelector('#oip-filter');
        filter.addEventListener('change', (e) => {
            this.state.filter = e.target.value;
            this.updateLoadingState();
            this.updateCardsGrid();
        });

        // Consolidated toggle
        const toggle = this.container.querySelector('#oip-consolidated-toggle');
        toggle.addEventListener('change', (e) => {
            this.state.showConsolidated = e.target.checked;
            const consolidated = this.container.querySelector('#oip-consolidated');
            consolidated.style.display = this.state.showConsolidated ? 'block' : 'none';
        });

        // Export dropdown
        const exportBtn = this.container.querySelector('#oip-export-btn');
        const exportMenu = this.container.querySelector('#oip-export-menu');

        exportBtn.addEventListener('click', () => {
            exportMenu.classList.toggle('show');
        });

        // Export options
        this.container.querySelectorAll('.oip-export-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.dataset.format;
                this.exportReport(format);
                exportMenu.classList.remove('show');
            });
        });

        // Close export menu on outside click
        document.addEventListener('click', (e) => {
            if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target)) {
                exportMenu.classList.remove('show');
            }
        });

        // Alerts panel toggle
        const toggleAlerts = this.container.querySelector('#oip-toggle-alerts');
        const alertsList = this.container.querySelector('#oip-alerts-list');

        toggleAlerts.addEventListener('click', () => {
            alertsList.classList.toggle('collapsed');
            toggleAlerts.textContent = alertsList.classList.contains('collapsed') ? '▶' : '▼';
        });
    }

    exportReport(format) {
        const reportData = this.reportService.generateDailyReportData(this.state.equipment);
        const date = new Date().toISOString().split('T')[0];

        if (format === 'csv') {
            const csv = this.reportService.exportToCSV(reportData);
            this.reportService.downloadFile(csv, `relatorio-indicadores-${date}.csv`, 'text/csv;charset=utf-8;');
        } else if (format === 'pdf') {
            this.exportToPDF(reportData);
        }
    }

    exportToPDF(reportData) {
        const html = this.generatePDFHTML(reportData);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
    }

    generatePDFHTML(reportData) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório de Indicadores Operacionais</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                    h1 { color: #1976d2; border-bottom: 3px solid #1976d2; padding-bottom: 10px; }
                    h2 { color: #555; margin-top: 30px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    th { background: #1976d2; color: white; }
                    tr:nth-child(even) { background: #f9f9f9; }
                    .summary-grid { display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0; }
                    .summary-card { flex: 1; min-width: 120px; padding: 15px; background: #f5f5f5; border-radius: 8px; text-align: center; }
                    .summary-value { font-size: 28px; font-weight: bold; color: #1976d2; }
                    .summary-label { color: #666; margin-top: 5px; font-size: 12px; }
                    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; border-top: 1px solid #ddd; padding-top: 20px; }
                    .status-online { color: #4caf50; font-weight: bold; }
                    .status-offline { color: #f44336; font-weight: bold; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <h1>📊 Relatório de Indicadores Operacionais</h1>
                <p><strong>Tipo:</strong> ${reportData.reportType === 'daily' ? 'Diário (D-1)' : 'Mensal'}</p>
                <p><strong>Data:</strong> ${reportData.reportDate || `${reportData.month}/${reportData.year}`}</p>
                <p><strong>Gerado em:</strong> ${new Date(reportData.generatedAt).toLocaleString('pt-BR')}</p>

                <h2>📈 Resumo Consolidado</h2>
                <div class="summary-grid">
                    <div class="summary-card">
                        <div class="summary-value">${reportData.summary.totalEquipment}</div>
                        <div class="summary-label">Total de Equipamentos</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value" style="color: #4caf50">${reportData.summary.onlineCount}</div>
                        <div class="summary-label">Online</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value" style="color: #f44336">${reportData.summary.offlineCount}</div>
                        <div class="summary-label">Offline</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">${reportData.summary.avgAvailability}%</div>
                        <div class="summary-label">Disponibilidade Média</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">${reportData.summary.avgMtbf}h</div>
                        <div class="summary-label">MTBF Médio</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">${reportData.summary.avgMttr}h</div>
                        <div class="summary-label">MTTR Médio</div>
                    </div>
                </div>

                <h2>📋 Detalhes por Equipamento</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Equipamento</th>
                            <th>Tipo</th>
                            <th>Local</th>
                            <th>Status</th>
                            <th>Disponibilidade</th>
                            <th>MTBF</th>
                            <th>MTTR</th>
                            <th>Alertas</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.equipment.map(eq => `
                            <tr>
                                <td>${eq.name}</td>
                                <td>${eq.type === 'escalator' ? 'Escada' : 'Elevador'}</td>
                                <td>${eq.location || '-'}</td>
                                <td class="${eq.status === 'Online' ? 'status-online' : 'status-offline'}">${eq.status}</td>
                                <td>${eq.availability}%</td>
                                <td>${eq.mtbf}h</td>
                                <td>${eq.mttr}h</td>
                                <td>${eq.alertCount || 0}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <h2>🏆 Ranking por Disponibilidade</h2>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Equipamento</th>
                            <th>Disponibilidade</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.ranking.map(r => `
                            <tr>
                                <td><strong>${r.rank}</strong></td>
                                <td>${r.name}</td>
                                <td>${r.availability}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    <p>Gerado pelo Myio - Painel de Indicadores Operacionais</p>
                    <p>${new Date().toLocaleString('pt-BR')}</p>
                </div>
            </body>
            </html>
        `;
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.refreshData();
        }, this.settings.general.refreshInterval);
    }

    refreshData() {
        // Simulate data refresh with small random variations
        this.state.equipment = this.state.equipment.map(eq => {
            const variation = (Math.random() - 0.5) * 2;
            return {
                ...eq,
                gridFrequency: Math.max(58, Math.min(62, eq.gridFrequency + variation * 0.1)),
                powerDemand: eq.status ? Math.max(0, eq.powerDemand + variation) : 0,
                lastUpdate: Date.now()
            };
        });

        this.updateConsolidatedView();

        // Update individual cards
        this.state.equipment.forEach(eq => {
            const card = this.cardInstances.get(eq.id);
            if (card) {
                card.update(eq);
            }
        });
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.cardInstances.clear();
    }
}

// ============================================================================
// THINGSBOARD WIDGET INTEGRATION
// ============================================================================

// For ThingsBoard widget context
var self = self || {};

self.onInit = function() {
    const container = self.ctx.$container[0];
    const settings = self.ctx.settings || {};

    self.panel = new OperationalIndicatorsPanel(container, settings);
};

self.onDataUpdated = function() {
    // In production, update data from ThingsBoard telemetry
    if (self.panel) {
        self.panel.refreshData();
    }
};

self.onResize = function() {
    // Handle resize if needed
};

self.onDestroy = function() {
    if (self.panel) {
        self.panel.destroy();
    }
};

// ============================================================================
// STANDALONE INITIALIZATION (for testing outside ThingsBoard)
// ============================================================================

if (typeof window !== 'undefined' && !self.ctx) {
    document.addEventListener('DOMContentLoaded', function() {
        const container = document.getElementById('widget-container');
        if (container) {
            new OperationalIndicatorsPanel(container, {
                general: {
                    title: 'Painel de Indicadores Operacionais',
                    refreshInterval: 30000
                }
            });
        }
    });
}
