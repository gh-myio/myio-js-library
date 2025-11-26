/**
 * Calcula a média de temperatura de uma lista de DISPOSITIVOS.
 * * @param {Array<Object>} deviceList - Array de objetos. A função tentará ler .id.id, .id ou .value.
 * @param {string} startIso - Data Inicio (ISO String).
 * @param {string} endIso - Data Fim (ISO String).
 * @param {string} baseUrl - URL base da API (ex: https://api.data.apps.myio-bas.com).
 * @param {string} token - Token JWT (Bearer).
 * @returns {Promise<number>} Média simples das temperaturas retornadas.
 */
export async function getAverageTemperatureFromDevices(deviceList, startIso, endIso, baseUrl, token) {
    if (!deviceList || deviceList.length === 0) return 0;

    // Converte ISO para TimeStamp (ms)
    const startTs = new Date(startIso).getTime();
    const endTs = new Date(endIso).getTime();
    // O intervalo é o período todo, para garantir que o TB retorne apenas 1 ponto (a média global)
    const interval = endTs - startTs; 

    // Mapeia cada dispositivo para uma Promise de requisição
    const requests = deviceList.map(async (device) => {
        // Tenta resolver o ID do dispositivo de várias formas comuns no TB
        const entityId = device.id?.id || device.id || device.value;
        
        if (!entityId) return null;


        const url = `${baseUrl}/api/plugins/telemetry/DEVICE/${entityId}/values/timeseries` +
                    `?keys=temperature` +
                    `&startTs=${startTs}` +
                    `&endTs=${endTs}` +
                    `&interval=${interval}` +
                    `&limit=1` +
                    `&agg=AVG`; 

        try {
            const resp = await fetch(url, {
                method: "GET",
                headers: { 
                    "Content-Type": "application/json",
                    "X-Authorization": `Bearer ${token}`
                }
            });

            if (!resp.ok) return null;

            const json = await resp.json();
            
            // Verifica se existe o dado e retorna o valor float
            if (json.temperature && json.temperature[0]) {
                return parseFloat(json.temperature[0].value);
            }
            return null;
        } catch (e) {
            console.warn(`Erro ao buscar temp do device ${entityId}`, e);
            return null;
        }
    });

    // Aguarda todas as requisições terminarem
    const results = await Promise.all(requests);

    // Filtra nulos e não-números
    const validValues = results.filter(v => v !== null && !isNaN(v));

    if (validValues.length === 0) return 0;

    // Calcula média final
    const sum = validValues.reduce((acc, curr) => acc + curr, 0);
    return sum / validValues.length;
}