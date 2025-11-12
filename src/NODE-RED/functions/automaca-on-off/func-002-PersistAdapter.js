/**
 * func-002-PersistAdapter.js
 *
 * Adapter para transformar o payload do func-001-FeriadoCheck
 * em formato compatível com persist-in node.
 *
 * Entrada: msg.payload do func-001 (com campo _observability)
 * Saída: 2 outputs para persist-in nodes
 *   - output[0]: Log detalhado
 *   - output[1]: Métricas agregadas
 *
 * @see PLANO-DE-ACAO.md
 * @see OBSERVABILIDADE.md
 */

// Pega o payload do func-001
const payload = msg.payload;

// Se não tem dados de observabilidade, ignora este fluxo
if (!payload._observability) {
  node.warn('No observability data found, skipping persistence');
  return null;
}

const obs = payload._observability;
const timestamp = Date.now();

// ========== OUTPUT 1: Log Detalhado ==========
const logOutput = {
  payload: {
    key: obs.logKey,
    value: obs.logData
  }
};

// ========== OUTPUT 2: Métricas Globais ==========
// Incrementa contador global
const currentTotal = flow.get('automation_metrics_total') || 0;

const metricsOutput = {
  payload: {
    key: 'automation_metrics_total',
    value: {
      total: currentTotal + 1,
      last_device: payload.deviceName,
      last_time: obs.logData.timestamp,
      last_action: obs.logData.action,
      last_reason: obs.logData.reason,
      updated_at: new Date().toISOString()
    }
  }
};

// Atualiza contador no flow para próxima execução
flow.set('automation_metrics_total', currentTotal + 1);

// Log de debug (opcional)
node.log({
  level: 'info',
  message: 'Persisting automation event',
  device: payload.deviceName,
  action: obs.logData.action,
  reason: obs.logData.reason,
  logKey: obs.logKey
});

// Retorna 2 outputs para persist-in nodes
return [logOutput, metricsOutput];
