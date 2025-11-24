# Log Retention Strategy - Automation Logs

## 🎯 Objetivo

Implementar estratégia de retenção automática para logs de automação (`automation_logs`), reduzindo o consumo de espaço mantendo apenas os dados necessários para análise e troubleshooting.

---

## 📊 Problema Identificado

**Situação Atual:**
- Logs de automação são armazenados indefinidamente em `flow.get('automation_logs')`
- Consumo excessivo de memória/espaço
- Logs antigos têm pouca utilidade prática

**Impacto:**
- Crescimento ilimitado de dados
- Possível degradação de performance
- Dificuldade para análise (muito ruído)

---

## ✅ Solução Implementada

### Estratégia de Retenção: **D-3, D-2, D-1, D0**

**Mantém logs dos últimos 4 dias:**
- **D0**: Hoje (dia atual)
- **D-1**: Ontem
- **D-2**: Anteontem
- **D-3**: 3 dias atrás

**Remove automaticamente:**
- **D-4+**: Logs com 4 ou mais dias

### Justificativa

**Por que 4 dias?**
1. ✅ **Troubleshooting recente** - A maioria dos bugs é detectada em 24-72h
2. ✅ **Análise de padrões** - Permite ver comportamento ao longo da semana
3. ✅ **Weekend coverage** - Cobre fim de semana inteiro
4. ✅ **Balanço espaço/utilidade** - Reduz ~90% dos logs mantendo dados relevantes

---

## 🔧 Implementação

### Arquivo: `func-003-LogCleanup.js`

**Função Node-RED** que executa a limpeza automática de logs.

**Configuração:**
```javascript
const DAYS_TO_KEEP = 4; // D-3, D-2, D-1, D0
```

**Lógica:**
1. Calcula data de corte: `hoje - (DAYS_TO_KEEP - 1)` às 00:00:00
2. Itera sobre `flow.get('automation_logs')`
3. Extrai timestamp de cada log (do key ou do logData)
4. Remove logs com timestamp < data de corte
5. Atualiza `flow.set('automation_logs', filteredLogs)`
6. Retorna estatísticas da operação

**Saída:**
```javascript
{
  success: true,
  stats: {
    totalBefore: 1000,
    totalAfter: 150,
    deleted: 850,
    retained: 150,
    cutoffDate: "2025-11-20T00:00:00.000Z",
    daysKept: 4,
    executedAt: "2025-11-23T02:00:00.000Z"
  }
}
```

---

## 🚀 Como Usar no Node-RED

### Opção 1: Agendamento Diário (Recomendado)

**Fluxo:**
```
[Inject (cron)] → [func-003-LogCleanup] → [Debug (stats)]
```

**Configuração do Inject:**
- **Repeat**: at a specific time
- **Time**: 02:00 AM (horário de baixo uso)
- **On specific days**: Todos os dias

**Benefícios:**
- ✅ Execução automática diária
- ✅ Horário de baixo uso (minimiza impacto)
- ✅ Logs limpos toda manhã

### Opção 2: Manual (On-Demand)

**Fluxo:**
```
[Inject (manual)] → [func-003-LogCleanup] → [Debug (stats)]
```

**Uso:**
- Click no botão do inject node para executar manualmente
- Útil para limpezas pontuais ou testes

### Opção 3: Trigger por Evento

**Fluxo:**
```
[MQTT/HTTP] → [func-003-LogCleanup] → [Response]
```

**Uso:**
- Integrar com sistema externo
- Executar via API/webhook

---

## 📈 Estatísticas e Monitoramento

### Exemplo de Output

**Cenário 1: Primeira execução (muitos logs antigos)**
```json
{
  "success": true,
  "stats": {
    "totalBefore": 5000,
    "totalAfter": 450,
    "deleted": 4550,
    "retained": 450,
    "cutoffDate": "2025-11-20T00:00:00.000Z",
    "daysKept": 4,
    "executedAt": "2025-11-23T02:00:00.000Z"
  }
}
```
**Resultado:** Liberou ~90% do espaço! 🎉

**Cenário 2: Execução diária (manutenção)**
```json
{
  "success": true,
  "stats": {
    "totalBefore": 450,
    "totalAfter": 430,
    "deleted": 20,
    "retained": 430,
    "cutoffDate": "2025-11-20T00:00:00.000Z",
    "daysKept": 4,
    "executedAt": "2025-11-23T02:00:00.000Z"
  }
}
```
**Resultado:** Remove apenas logs do dia D-4 (manutenção incremental) ✅

---

## 🧪 Testes

### Arquivo: `tests/func-003-LogCleanup.test.js`

**Cobertura de testes:**
- ✅ Categoria 1: Retenção Básica (7 testes)
- ✅ Categoria 2: Múltiplos Logs (3 testes)
- ✅ Categoria 3: Edge Cases (4 testes)
- ✅ Categoria 4: Volume de Dados (2 testes)
- ✅ Categoria 5: Configuração Custom (2 testes)

**Total:** 18 testes, 100% passando ✅

**Execução:**
```bash
npx jest src/NODE-RED/functions/automaca-on-off/tests/func-003-LogCleanup.test.js
```

**Resultado:**
```
Test Suites: 1 passed, 1 total
Tests:       18 passed, 18 total
Time:        6.69 s
```

---

## 🔍 Edge Cases Tratados

### 1. Logs sem Timestamp no Key
```javascript
// Key malformado: automation_log_Device1_noTimestamp
// Fallback: usa timestampMs ou timestamp do logData
```

### 2. Logs sem Timestamp Algum
```javascript
// Comportamento: MANTÉM por segurança (não remove dados sem certeza)
```

### 3. Logs Vazios
```javascript
// Lida graciosamente: retorna 0 deleted, 0 retained
```

### 4. Performance com Alto Volume
```javascript
// Testado com 1000 logs: < 1 segundo ✅
```

---

## ⚙️ Configuração Customizada

### Alterar Período de Retenção

**Para manter 7 dias (semana inteira):**
```javascript
const DAYS_TO_KEEP = 7; // D-6, D-5, D-4, D-3, D-2, D-1, D0
```

**Para manter apenas 2 dias (mínimo):**
```javascript
const DAYS_TO_KEEP = 2; // D-1, D0
```

**Para manter 14 dias (troubleshooting estendido):**
```javascript
const DAYS_TO_KEEP = 14;
```

---

## 📊 Estimativa de Economia

### Cenário Típico

**Assumindo:**
- 100 dispositivos
- 1 log por dispositivo a cada 5 minutos
- 288 logs/dia por dispositivo (24h × 12)
- 28.800 logs/dia total

**Antes (sem limpeza, 30 dias):**
- **Total logs:** 864.000 logs
- **Tamanho estimado:** ~500 MB (assumindo ~600 bytes/log)

**Depois (com limpeza, 4 dias):**
- **Total logs:** 115.200 logs
- **Tamanho estimado:** ~67 MB
- **Economia:** ~87% de espaço! 🎉

---

## 🚨 Troubleshooting

### Problema: Limpeza não está executando

**Checklist:**
1. ✅ Inject node está configurado com cron correto?
2. ✅ Node-RED foi reiniciado após adicionar a função?
3. ✅ Verifique logs do Node-RED para erros
4. ✅ Teste execução manual (inject button)

### Problema: Logs sendo removidos incorretamente

**Verificar:**
1. ✅ Timezone do servidor está correto?
2. ✅ `DAYS_TO_KEEP` está configurado corretamente?
3. ✅ Timestamps nos logs estão no formato correto?

**Debug:**
```javascript
// Adicione no início do func-003-LogCleanup.js:
node.log(`Cutoff date: ${cutoffDate.toISOString()}`);
node.log(`Cutoff timestamp: ${cutoffTimestamp}`);
```

### Problema: Performance lenta

**Se processa > 10.000 logs:**
1. ✅ Considere executar em horários de menor carga
2. ✅ Aumente intervalo entre execuções (ex: semanal)
3. ✅ Reduza `DAYS_TO_KEEP` para menos dias

---

## 📚 Referências

- `func-003-LogCleanup.js` - Implementação principal
- `func-002-PersistAdapter.js` - Onde logs são criados
- `tests/func-003-LogCleanup.test.js` - Suite de testes
- `OBSERVABILIDADE.md` - Documentação do sistema de logs

---

## 🎯 Checklist de Deploy

**Antes de implementar em produção:**

- [ ] Testar em ambiente de desenvolvimento
- [ ] Fazer backup de `automation_logs` atuais
- [ ] Configurar inject node com cron diário
- [ ] Executar limpeza inicial manual
- [ ] Monitorar estatísticas após primeira execução
- [ ] Validar que logs recentes estão sendo mantidos
- [ ] Configurar alertas caso limpeza falhe

**Após deploy:**

- [ ] Monitorar consumo de espaço/memória
- [ ] Verificar logs diariamente por 1 semana
- [ ] Ajustar `DAYS_TO_KEEP` se necessário
- [ ] Documentar para equipe de operações

---

## 🏆 Conclusão

### ✅ Benefícios Implementados

1. **Economia de Espaço:** ~87-90% de redução
2. **Performance:** Menos dados = queries mais rápidas
3. **Manutenibilidade:** Limpeza automática, zero intervenção manual
4. **Flexibilidade:** Configuração ajustável via `DAYS_TO_KEEP`
5. **Confiabilidade:** 18 testes garantem funcionamento correto
6. **Observabilidade:** Estatísticas detalhadas de cada execução

### 📈 Próximos Passos (Opcional)

1. **Arquivamento:** Exportar logs D-4+ para cold storage antes de remover
2. **Métricas:** Dashboard Grafana com estatísticas de limpeza
3. **Alertas:** Notificar se limpeza falhar ou encontrar anomalias
4. **Compressão:** Comprimir logs D-2 e D-3 para economizar mais espaço

**Status: PRONTO PARA PRODUÇÃO** 🚀
