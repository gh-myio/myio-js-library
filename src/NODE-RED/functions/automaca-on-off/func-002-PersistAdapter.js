/**
 * func-002-PersistAdapter.js
 *
 * Adapter para transformar o payload do func-001-FeriadoCheck
 * em formato compatível com persist-in node.
 *
 * Entrada: msg.payload do func-001 (com campo _observability)
 * Saída: msg com payload para persist-in node
 *
 * @see PLANO-DE-ACAO.md
 * @see OBSERVABILIDADE.md
 */

try {
    // Pega o payload do func-001
    const payload = msg.payload;

    // Se não tem dados de observabilidade, ignora este fluxo
    if (!payload || !payload._observability) {
        //node.warn('No observability data found, skipping persistence');
        return null;
    }

    const obs = payload._observability;

    // Armazena no flow para histórico
    let storedLogs = flow.get('automation_logs') || {};
    storedLogs[obs.logKey] = obs.logData;
    flow.set('automation_logs', storedLogs);

    // Atualiza métricas globais no flow
    const currentTotal = flow.get('automation_metrics_total') || 0;
    flow.set('automation_metrics_total', currentTotal + 1);

    // Log de debug
    node.log('Persisting automation event: ' + payload.deviceName + ' - ' + obs.logData.action);

    // Retorna no formato esperado pelo persist-in
    msg.payload = {
        key: obs.logKey,
        value: obs.logData
    };

    return msg;

} catch (e) {
    node.error('Error in PersistAdapter: ' + e.message);
    return null;
}
