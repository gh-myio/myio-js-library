/**
 * @fileoverview Service para calcular o tempo de funcionamento (uptime) de um dispositivo ThingsBoard.
 * Este serviço busca a primeira telemetria de um dispositivo e calcula o tempo decorrido em horas.
 */

// --- Configuração ---
// Em um aplicativo real, a URL base viria de um arquivo de configuração ou variáveis de ambiente.
const THINGSBOARD_URL = 'https://dashboard.myio-bas.com';

/**
 * Função auxiliar para calcular o tempo de funcionamento em horas desde um timestamp.
 * @private // Indica que é para uso interno do serviço.
 * @param {number} startTimestampMs - O timestamp inicial em milissegundos.
 * @returns {number} O total de horas de funcionamento.
 */
function calculateUptimeInHours(startTimestampMs) {
  if (!startTimestampMs || typeof startTimestampMs !== 'number' || startTimestampMs <= 0) {
    return 0;
  }
  const nowMs = new Date().getTime();
  const durationMs = nowMs - startTimestampMs;

  if (durationMs < 0) {
    return 0;
  }
  // Conversão: ms -> segundos (/1000) -> minutos (/60) -> horas (/60)
  return durationMs / (1000 * 60 * 60);
}

/**
 * Busca a primeira telemetria de um dispositivo e retorna seu tempo de funcionamento em horas.
 * Esta é a função principal que você deve exportar e usar em outras partes do seu código.
 *
 * @export
 * @async
 * @param {string} deviceId - O ID do dispositivo no ThingsBoard.
 * @param {string} jwtToken - O token de autenticação JWT para a API.
 * @param {string} [telemetryKey='status'] - A chave de telemetria a ser usada para encontrar o primeiro registro.
 * @returns {Promise<number>} Uma Promise que resolve com o número total de horas de funcionamento.
 * @throws {Error} Lança um erro se a chamada à API falhar ou se o dispositivo não tiver telemetria.
 */
export async function getDeviceUptimeInHours(deviceId, token, telemetryKey = 'status') {
  if (!deviceId) {
    throw new Error('O ID do dispositivo é obrigatório.');
  }

  // Monta a URL da API com os parâmetros de busca
  const params = new URLSearchParams({
    keys: telemetryKey,
    startTs: 0,
    limit: 1,
    sortOrder: 'ASC'
  });
  const apiUrl = `${THINGSBOARD_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?${params}`;

  console.log(`Buscando telemetria em: ${apiUrl}`);

  try {
    // Realiza a chamada à API usando fetch
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${token}`
      }
    });

    // Verifica se a resposta da API foi bem-sucedida (status 2xx)
    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
    }

    // Converte a resposta para JSON
    const data = await response.json();

    // Extrai o primeiro registro de telemetria
    const firstTelemetryRecord = data[telemetryKey];
    if (!firstTelemetryRecord || firstTelemetryRecord.length === 0) {
      // Se não houver registros, significa que o dispositivo nunca enviou dados.
      console.warn(`Nenhuma telemetria encontrada para a chave '${telemetryKey}' no dispositivo ${deviceId}.`);
      return 0;
    }

    const firstTimestamp = firstTelemetryRecord[0].ts;

    // Calcula e retorna o uptime usando a função auxiliar
    return calculateUptimeInHours(firstTimestamp);

  } catch (error) {
    console.error('Falha ao obter o tempo de funcionamento:', error);
    // Re-lança o erro para que o código que chamou a função possa tratá-lo
    throw error;
  }
}

// --- Exemplo de Como Usar este Serviço em outro arquivo ---
/*
import { getDeviceUptimeInHours } from './uptimeService.js';

const myDeviceId = '2201ea40-9011-11f0-a06d-e9509531b1d5'; // ID do seu dispositivo
const myJwtToken = 'SEU_TOKEN_JWT_VALIDO_AQUI';

// Como a função é async, precisamos usar .then() ou estar dentro de outra função async com await
(async () => {
  try {
    const uptime = await getDeviceUptimeInHours(myDeviceId, myJwtToken, 'status');
    console.log(`Sucesso! O dispositivo está funcionando há aproximadamente ${uptime.toFixed(2)} horas.`);
  } catch (error) {
    console.error(`Não foi possível calcular o uptime: ${error.message}`);
  }
})();
*/