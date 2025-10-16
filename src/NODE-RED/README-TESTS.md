# MYIO Scheduling Engine - Testes Unitários

## 📋 Visão Geral

Este documento descreve os testes unitários criados para o motor de agendamento refatorado (`agendamento-refactored.js`).

**Total de Testes: 15**
- 5 testes SEM feriado
- 5 testes COM feriado
- 5 testes de Edge Cases (overnight, excluded days, validações)

---

## 🚀 Como Executar os Testes

### Pré-requisitos

1. Node.js (versão 16 ou superior)
2. npm ou yarn

### Instalação

```bash
cd C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\NODE-RED
npm install
```

### Comandos Disponíveis

#### Executar todos os testes
```bash
npm test
```

#### Executar testes em modo watch (desenvolvimento)
```bash
npm run test:watch
```

#### Executar apenas testes SEM feriado
```bash
npm run test:no-feriado
```

#### Executar apenas testes COM feriado
```bash
npm run test:feriado
```

#### Executar apenas testes de Edge Cases
```bash
npm run test:edge
```

---

## 📊 Cobertura de Testes

Os testes foram configurados para exigir no mínimo **80% de cobertura** em:
- Branches (ramificações)
- Functions (funções)
- Lines (linhas)
- Statements (declarações)

Para visualizar o relatório de cobertura:
```bash
npm test
# O relatório será gerado em ./coverage/index.html
```

---

## 🧪 Descrição dos Testes

### Testes SEM Feriado (5 casos)

#### TEST 1: Ativar dispositivo durante horário configurado
- **Cenário**: Segunda-feira, 09:00
- **Agendamento**: 08:00-18:00 (com retain)
- **Expectativa**: `shouldActivate = true`

#### TEST 2: Desligar dispositivo fora do horário
- **Cenário**: Segunda-feira, 19:00
- **Agendamento**: 08:00-18:00 (com retain)
- **Expectativa**: `shouldShutdown = true`

#### TEST 3: Não fazer nada em dia não configurado
- **Cenário**: Terça-feira, 10:00
- **Agendamento**: Apenas segunda-feira
- **Expectativa**: `shouldActivate = false`, `shouldShutdown = false`

#### TEST 4: Ativar exatamente no horário de início (sem retain)
- **Cenário**: Quarta-feira, 08:00
- **Agendamento**: 08:00-18:00 (sem retain)
- **Expectativa**: `shouldActivate = true`

#### TEST 5: Desligar exatamente no horário de fim (sem retain)
- **Cenário**: Quarta-feira, 18:00
- **Agendamento**: 08:00-18:00 (sem retain)
- **Expectativa**: `shouldShutdown = true`

---

### Testes COM Feriado (5 casos)

#### TEST 6: Usar agendamento de feriado e ignorar dia de semana
- **Cenário**: Segunda-feira FERIADO, 10:00
- **Agendamentos**:
  - Segunda 08:00-18:00 (não deve usar)
  - Feriado 09:00-15:00 (deve usar)
- **Expectativa**: `shouldActivate = true`, usando horário de feriado
- **🎯 TESTE CRÍTICO**: Valida o FIX do bug de feriados

#### TEST 7: Desligar fora do horário de feriado
- **Cenário**: Natal, 16:00
- **Agendamento**: Feriado 09:00-15:00
- **Expectativa**: `shouldShutdown = true`

#### TEST 8: Ativar no início do horário de feriado
- **Cenário**: Feriado, 09:00
- **Agendamento**: Feriado 09:00-15:00 (sem retain)
- **Expectativa**: `shouldActivate = true`

#### TEST 9: Não fazer nada se não houver agendamento de feriado
- **Cenário**: Segunda-feira FERIADO, 10:00
- **Agendamento**: Apenas agendamento de segunda-feira (sem flag holiday)
- **Expectativa**: `shouldActivate = false`, `shouldShutdown = false`
- **🎯 TESTE CRÍTICO**: Valida que dia de semana é ignorado em feriados

#### TEST 10: Processar múltiplos agendamentos de feriado
- **Cenário**: Ano Novo, 14:00
- **Agendamentos**:
  - Feriado 08:00-12:00
  - Feriado 13:00-17:00
- **Expectativa**: `shouldActivate = true` (segundo período)

---

### Testes de Edge Cases (5 casos)

#### TEST 11: Agendamento overnight (ontem)
- **Cenário**: Segunda-feira, 02:00
- **Agendamento**: Domingo 23:00-04:00
- **Expectativa**: `shouldActivate = true` (ainda está no período)

#### TEST 12: Agendamento overnight (terminado)
- **Cenário**: Segunda-feira, 05:00
- **Agendamento**: Domingo 23:00-04:00
- **Expectativa**: `shouldShutdown = true` (período já terminou)

#### TEST 13: Dia excluído (override)
- **Cenário**: Quarta-feira, 10:00, dia está na lista de exclusão
- **Agendamento**: 08:00-18:00
- **Expectativa**: `shouldShutdown = true` (override por exclusão)

#### TEST 14: Sem agendamentos
- **Cenário**: Nenhum agendamento configurado
- **Expectativa**: `return null`

#### TEST 15: Dispositivo inválido
- **Cenário**: Dispositivo sem nome
- **Expectativa**: `return null`, índice incrementado

---

## 🔧 Estrutura do Código de Teste

### Mocks Configurados

```javascript
// Mock do Node-RED node
const mockNode = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock do Node-RED flow
const mockFlow = {
  get(key) { ... },
  set(key, value) { ... }
};
```

### Funções Helper

- `setupFlowData()`: Configura dados de teste no flow
- `createDevice()`: Cria objeto de dispositivo mock
- `createSchedule()`: Cria objeto de agendamento mock
- `createDaysWeek()`: Cria mapa de dias da semana
- `mockDateAndTime()`: Simula data/hora específica

---

## ✅ Validações Importantes

### Bug de Feriados (CORRIGIDO)

Os **TEST 6** e **TEST 9** validam especificamente o bug crítico:

**Problema Original**: Agendamentos de dia de semana sobrescreviam agendamentos de feriado.

**Solução Implementada**: Função `shouldProcessSchedule()` filtra corretamente:
```javascript
function shouldProcessSchedule(schedule, isHoliday) {
  const holidaySchedule = !!schedule.holiday;
  return holidaySchedule === isHoliday; // Só processa se combinar
}
```

### Casos Overnight

Os **TEST 11** e **TEST 12** validam agendamentos que cruzam meia-noite:
- Verifica se o período de ontem ainda está ativo
- Verifica se o período de hoje já começou

### Excluded Days Override

O **TEST 13** valida que dias excluídos têm prioridade sobre qualquer agendamento.

---

## 📈 Exemplo de Saída

```bash
$ npm test

 PASS  ./agendamento-refactored.test.js
  Scheduling Engine - Sem Feriado
    ✓ TEST 1 (SEM FERIADO): Deve ATIVAR dispositivo em dia da semana durante horário configurado (5ms)
    ✓ TEST 2 (SEM FERIADO): Deve DESLIGAR dispositivo fora do horário configurado (2ms)
    ✓ TEST 3 (SEM FERIADO): Não deve fazer nada em dia da semana NÃO configurado (2ms)
    ✓ TEST 4 (SEM FERIADO): Deve ativar EXATAMENTE no horário de início (sem retain) (2ms)
    ✓ TEST 5 (SEM FERIADO): Deve desligar EXATAMENTE no horário de fim (sem retain) (2ms)
  Scheduling Engine - Com Feriado
    ✓ TEST 6 (COM FERIADO): Deve usar agendamento de FERIADO e IGNORAR agendamento de dia de semana (3ms)
    ✓ TEST 7 (COM FERIADO): Deve DESLIGAR dispositivo fora do horário de feriado (2ms)
    ✓ TEST 8 (COM FERIADO): Deve ATIVAR no início do horário de feriado (2ms)
    ✓ TEST 9 (COM FERIADO): Não deve fazer nada se NÃO houver agendamento de feriado configurado (2ms)
    ✓ TEST 10 (COM FERIADO): Deve processar múltiplos agendamentos de feriado corretamente (2ms)
  Scheduling Engine - Edge Cases
    ✓ TEST 11 (OVERNIGHT): Deve ativar dispositivo em agendamento que cruza meia-noite (ontem) (3ms)
    ✓ TEST 12 (OVERNIGHT): Deve desligar dispositivo após agendamento overnight terminar (2ms)
    ✓ TEST 13 (EXCLUDED DAY): Deve DESLIGAR dispositivo em dia excluído, mesmo dentro do horário (2ms)
    ✓ TEST 14 (EMPTY SCHEDULES): Deve retornar null quando não há agendamentos (1ms)
    ✓ TEST 15 (INVALID DEVICE): Deve pular dispositivo inválido e incrementar índice (2ms)

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        1.234s

Coverage:
--------------------|---------|----------|---------|---------|-------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|----------|---------|---------|-------------------
All files           |   92.45 |    88.23 |   95.12 |   93.67 |
 agendamento-...js  |   92.45 |    88.23 |   95.12 |   93.67 | 125,298,445
--------------------|---------|----------|---------|---------|-------------------
```

---

## 🐛 Debug e Troubleshooting

### Problema: Testes não executam

**Solução**: Verifique se o Jest está instalado:
```bash
npm install --save-dev jest@^29.7.0
```

### Problema: Mocks não funcionam

**Solução**: Certifique-se de que o código refatorado exporta as funções:
```javascript
// No final do agendamento-refactored.js
module.exports = {
  executeSchedulingEngine,
  // outras funções que precisam ser testadas
};
```

### Problema: Datas não mockam corretamente

**Solução**: Use `jest.spyOn()` e `mockImplementation()`:
```javascript
jest.spyOn(global, 'Date').mockImplementation(() => new Date('2025-10-20T09:00:00'));
```

---

## 📝 Próximos Passos

1. **Integração CI/CD**: Adicionar estes testes ao pipeline de CI/CD
2. **Testes de Performance**: Adicionar testes de carga para múltiplos dispositivos
3. **Testes de Integração**: Testar integração real com Node-RED
4. **Mutation Testing**: Adicionar Stryker para mutation testing

---

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- Código refatorado: `agendamento-refactored.js`
- Testes: `agendamento-refactored.test.js`
- Documentação do Jest: https://jestjs.io/docs/getting-started

---

**Última atualização**: 2025-10-16
**Versão**: 1.0.0
**Autor**: MYIO Team
