/**
 * Tipos de Entrada (Input)
 */

// Formato de um item da lista de customers que você forneceu
export interface CustomerInput {
    name: string;
    value: string;       // Este é o INGESTION ID
    customerId: string;  // Este é o ID do ThingsBoard
}

// Formato simplificado do objeto de device vindo do self.ctx.data
export interface TbDeviceInput {
    id: {
        id: string;
        entityType: string;
    };
    customerId?: {
        id: string;
    };
    ownerId?: { // Fallback caso customerId não esteja populado
        id: string;
    };
    name?: string;
    label?: string;
    [key: string]: any; // Outras props
}

/**
 * Tipos de Saída (Output / Relatório)
 */
export interface DeviceTempData {
    name: string;
    id: string;      // ID do Device
    avgTemp: number | null;
}

export interface CustomerTempData {
    customerName: string;
    customerId: string;   // UUID do TB
    ingestionId: string;  // UUID customizado (value do input)
    avgTempCustomer: number;
    deviceList: DeviceTempData[];
    // Propriedades internas para cálculo (removidas no final se quiser, mas úteis na tipagem)
    _sum?: number;
    _count?: number;
}

export interface TemperatureReport {
    avgTotal: number;
    mapDeviceByCustomer: CustomerTempData[];
}

/**
 * Configuração da Requisição
 */
export interface AverageTempConfig {
    deviceList: Array<TbDeviceInput>;
    customerList: Array<CustomerInput>;
    startIso: string;
    endIso: string;
    baseUrl: string;
    token: string;
    timeoutMs?: number;
    cacheTtlMs?: number;
}

interface CacheEntry {
    data: TemperatureReport;
    timestamp: number;
}

/**
 * Service Principal
 */
export class DeviceTemperatureService {
    
    // Cache em memória
    private static cache = new Map<string, CacheEntry>();
    
    // Intervalo do TB (30 min) para garantir média global
    private static readonly TB_INTERVAL = "1800000"; 

    /**
     * Gera chave de cache única baseada nos devices, customers e datas
     */
    private static generateCacheKey(config: AverageTempConfig): string {
        const { deviceList, customerList, startIso, endIso, baseUrl } = config;
        
        // IDs dos devices ordenados
        const devIds = deviceList
            .map(d => d.id?.id)
            .sort()
            .join(',');
            
        // IDs dos customers ordenados (para invalidar cache se a seleção de shoppings mudar)
        const custIds = customerList
            .map(c => c.customerId)
            .sort()
            .join(',');
            
        return `${baseUrl}|${startIso}|${endIso}|${devIds}|${custIds}|v4-ts`;
    }

    /**
     * Método Principal
     */
    public static async getTemperatureReport(config: AverageTempConfig): Promise<TemperatureReport> {
        const { deviceList, customerList, cacheTtlMs = 60000 } = config;

        // Validação básica
        if (!deviceList || deviceList.length === 0) {
            return { avgTotal: 0, mapDeviceByCustomer: [] };
        }

        // 1. Verificar Cache
        const cacheKey = this.generateCacheKey(config);
        const cached = this.cache.get(cacheKey);

        if (cached) {
            const now = Date.now();
            if (now - cached.timestamp < cacheTtlMs) {
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }

        // 2. Buscar Temperaturas (Fetch)
        // Retorna array simples ligando o device ao seu valor encontrado
        const rawResults = await this.fetchAllTemperatures(config);

        // 3. Processar e Agrupar (Cruzar DeviceList x CustomerList)
        const report = this.processResultsIntoReport(rawResults, customerList);

        // 4. Salvar Cache
        this.cache.set(cacheKey, {
            data: report,
            timestamp: Date.now()
        });

        return report;
    }

    /**
     * Realiza as requisições HTTP em paralelo com Timeout
     */
    private static async fetchAllTemperatures(config: AverageTempConfig): Promise<Array<{ device: TbDeviceInput, temp: number | null }>> {
        const { deviceList, startIso, endIso, baseUrl, token, timeoutMs = 10000 } = config;
        
        const startTs = new Date(startIso).getTime();
        const endTs = new Date(endIso).getTime();

        const requests = deviceList.map(async (device) => {
            const entityId = device.id?.id;
            
            if (!entityId) return { device, temp: null };

            const url = `${baseUrl}/api/plugins/telemetry/DEVICE/${entityId}/values/timeseries` +
                        `?keys=temperature` +
                        `&startTs=${startTs}` +
                        `&endTs=${endTs}` +
                        `&intervalType=MILLISECONDS` +
                        `&interval=${this.TB_INTERVAL}` +
                        `&agg=AVG`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const resp = await fetch(url, {
                    method: "GET",
                    headers: { 
                        "Content-Type": "application/json",
                        "X-Authorization": `Bearer ${token}`
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!resp.ok) return { device, temp: null };

                const json = await resp.json();
                
                let val: number | null = null;
                if (json.temperature && json.temperature[0]) {
                    val = parseFloat(json.temperature[0].value);
                }

                return { device, temp: val };

            } catch (e) {
                return { device, temp: null };
            } finally {
                clearTimeout(timeoutId);
            }
        });

        return Promise.all(requests);
    }

    /**
     * Lógica de Agrupamento: Usa o CustomerList como base
     */
    private static processResultsIntoReport(
        results: Array<{ device: TbDeviceInput, temp: number | null }>, 
        customerList: Array<CustomerInput>
    ): TemperatureReport {
        
        // 1. Inicializa o Mapa de Grupos usando o Customer ID do TB como chave
        // Isso garante que mesmo customers sem devices apareçam na lista final (com média 0)
        const groupsMap = new Map<string, CustomerTempData>();

        customerList.forEach(c => {
            // A chave do Map é o ID do Thingsboard, pois é isso que o Device tem para vincular
            if (c.customerId) {
                groupsMap.set(c.customerId, {
                    customerName: c.name,
                    customerId: c.customerId, // ID real do TB
                    ingestionId: c.value,     // O Value informado vira o Ingestion ID
                    avgTempCustomer: 0,
                    deviceList: [],
                    _sum: 0,
                    _count: 0
                });
            }
        });

        // Grupo para dispositivos que não deram match com nenhum customer da lista
        const orphans: CustomerTempData = {
            customerName: "Outros / Não Identificado",
            customerId: "unknown",
            ingestionId: "",
            avgTempCustomer: 0,
            deviceList: [],
            _sum: 0, 
            _count: 0
        };

        // 2. Distribui os dispositivos nos grupos
        let globalSum = 0;
        let globalCount = 0;

        results.forEach(({ device, temp }) => {
            // Tenta pegar o ID do customer do dispositivo
            const devCustId = device.customerId?.id || device.ownerId?.id;

            let targetGroup: CustomerTempData | undefined;

            if (devCustId) {
                targetGroup = groupsMap.get(devCustId);
            }

            // Se não achou grupo (ou device não tem customerId), vai para órfãos
            if (!targetGroup) {
                targetGroup = orphans;
            }

            // Adiciona na lista do grupo
            targetGroup.deviceList.push({
                name: device.name || device.label || 'Unnamed Device',
                id: device.id?.id,
                avgTemp: temp
            });

            // Se tiver temperatura válida, soma
            if (temp !== null && !isNaN(temp)) {
                // @ts-ignore (Propriedades internas _sum e _count existem no runtime)
                targetGroup._sum += temp;
                // @ts-ignore
                targetGroup._count += 1;

                globalSum += temp;
                globalCount += 1;
            }
        });

        // 3. Finaliza os cálculos de média
        const mapDeviceByCustomer: CustomerTempData[] = [];

        groupsMap.forEach(group => {
            // Calcula média do cliente
            if (group._count && group._sum !== undefined && group._count > 0) {
                group.avgTempCustomer = parseFloat((group._sum / group._count).toFixed(2));
            } else {
                group.avgTempCustomer = 0;
            }

            // Limpeza de props internas (opcional, para limpar o JSON final)
            delete group._sum;
            delete group._count;

            mapDeviceByCustomer.push(group);
        });

        // Adiciona órfãos apenas se houver algum
        if (orphans.deviceList.length > 0) {
             if (orphans._count && orphans._sum !== undefined && orphans._count > 0) {
                orphans.avgTempCustomer = parseFloat((orphans._sum / orphans._count).toFixed(2));
            }
            delete orphans._sum;
            delete orphans._count;
            mapDeviceByCustomer.push(orphans);
        }

        const avgTotal = globalCount > 0 ? parseFloat((globalSum / globalCount).toFixed(2)) : 0;

        return {
            avgTotal,
            mapDeviceByCustomer
        };
    }
}

/**
 * Função Wrapper Exportada
 * Mantém a facilidade de uso mas agora exige a lista de customers
 */
export async function getTemperatureReportByCustomer(
    deviceList: Array<TbDeviceInput>, 
    customerList: Array<CustomerInput>,
    startIso: string, 
    endIso: string, 
    baseUrl: string, 
    token: string
): Promise<TemperatureReport> {
    return DeviceTemperatureService.getTemperatureReport({
        deviceList,
        customerList,
        startIso,
        endIso,
        baseUrl,
        token,
        timeoutMs: 15000,
        cacheTtlMs: 120000
    });
}