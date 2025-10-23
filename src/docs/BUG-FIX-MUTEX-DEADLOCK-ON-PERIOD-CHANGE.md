# BUG FIX: Mutex Deadlock ao Mudar Período

**Data:** 2025-10-23
**Severidade:** P0 - CRÍTICO
**Status:** ✅ RESOLVIDO

## Problema

Após implementar RFC-0054 Solução 2 (mutex condicional), descobrimos um deadlock crítico quando o usuário muda o período de datas e clica em "Carregar".

### Sequência do Problema

```
T+0s    Dashboard carrega com período: 2025-10-01 a 2025-10-23
T+2s    Dados carregados com sucesso ✅
T+2s    Mutex MANTIDO TRAVADO (Solução 2 - dados recentes disponíveis) 🔒
T+10s   Usuário muda período para: 2025-10-17 a 2025-10-23
T+10s   Clica em "Carregar"
T+10s   hydrateDomain detecta: "Different period" ✅
T+10s   ❌ DEADLOCK: Aguarda mutex que NUNCA será liberado!
```

### Log do Problema

```
252→ ⏭️ Keeping mutex locked - recent data available for energy
...
288→ hydrateDomain called for energy: {key: 'null:energy:2025-10-17...'}
289→ 🔄 Different period - proceeding: recent=...2025-10-01..., current=...2025-10-17...
291→ ⏸️ Waiting for mutex release...  ❌ BLOQUEADO PARA SEMPRE!
```

## Causa Raiz

A Solução 2 (mutex condicional) mantém o mutex travado quando:
- Há dados recentes (< 30s) ✅
- **E** o período é o mesmo ✅

O problema é que quando o período **muda**:
1. Early return detecta corretamente: "Different period"
2. Tenta continuar com a nova requisição
3. **MAS** o mutex está travado pela requisição anterior
4. O `finally` block da requisição anterior nunca executa (promise já resolvida)
5. **DEADLOCK**: Nova requisição espera mutex que nunca será liberado

## Solução Implementada

**FIX 3:** Liberar mutex IMEDIATAMENTE quando período muda

### Código Implementado

**Arquivo:** `MAIN_VIEW/controller.js` linha ~1411-1419

```javascript
// RFC-0054 FIX 2: Early return ANTES do mutex
const recent = OrchestratorState.cache[domain];
if (recent && (Date.now() - recent.timestamp) < 30000) {
  const recentPeriod = extractPeriod(recent.periodKey);
  const currentPeriod = extractPeriod(key);

  if (recentPeriod === currentPeriod) {
    // Mesmo período - retorna dados em cache
    LogHelper.log(`[Orchestrator] ⏭️ Early return in hydrateDomain - recent data available for ${domain}`);
    emitProvide(domain, recent.periodKey, recent.items);
    return recent.items;
  } else {
    // Período DIFERENTE - libera mutex!
    LogHelper.log(`[Orchestrator] 🔄 Different period - proceeding: recent=${recentPeriod}, current=${currentPeriod}`);

    // RFC-0054 FIX 3: Liberar mutex quando período muda para evitar deadlock
    if (sharedWidgetState.mutexMap.get(domain)) {
      LogHelper.log(`[Orchestrator] 🔓 Releasing mutex for ${domain} - period changed`);
      sharedWidgetState.mutexMap.set(domain, false);
    }
  }
}
```

## Resultado Esperado

### Antes do Fix (DEADLOCK)
```
User: Muda período 2025-10-01→2025-10-17, clica "Carregar"
System: ⏸️ Waiting for mutex release...
System: [BLOQUEADO PARA SEMPRE]
User: ❌ Interface travada, dados não carregam
```

### Depois do Fix (FUNCIONANDO)
```
User: Muda período 2025-10-01→2025-10-17, clica "Carregar"
System: 🔄 Different period detected
System: 🔓 Releasing mutex for energy - period changed
System: ✅ Fetching new data...
System: ✅ Dados carregados com sucesso!
User: ✅ Interface funcionando normalmente
```

## Teste de Verificação

1. Abrir dashboard
2. Aguardar dados carregarem (período padrão)
3. Mudar período de datas no HEADER
4. Clicar em "Carregar"
5. **Verificar:** Dados devem carregar normalmente (não travar)
6. **Log esperado:** "🔓 Releasing mutex for energy - period changed"

## Impacto

- **Severidade:** P0 (bloqueava completamente mudança de período)
- **Afeta:** Todos os domínios (energy, water, temperature)
- **Fix:** 6 linhas de código
- **Risco:** Baixo (apenas libera mutex quando necessário)

## Relacionado

- RFC-0054: Fix Busy Modal and Dual Cache Key
- RFC-0054 Solução 2: Mutex Condicional (causa do problema)
- RFC-0054 Solução 3: Early Return (detecta o problema)
- **FIX 3:** Resolução do deadlock (este documento)

## Checklist de Implementação

- [x] Código implementado
- [x] Documentação criada
- [ ] Testado em ambiente de produção
- [ ] Log de verificação confirmado
- [ ] RFC-0054 atualizado
