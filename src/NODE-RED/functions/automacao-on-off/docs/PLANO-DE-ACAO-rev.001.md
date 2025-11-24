Segue um review enxuto e pragmático do seu PLANO-DE-ACAO.md com ajustes sugeridos.

O que está redondo

Diagnóstico do bug e correção “feriado exclusivo” bem estruturados, com snippet e critérios de teste claros.

Comparação por ms locais e abandono de parse por string: excelente direção.

Estrutura de testes, casos críticos (feriado, meia-noite, atravessar dia, retain, dias excluídos) e metas de coverage estão completos.

Entregáveis por fase e recomendação do Jest bem objetivas.

Pontos a fortalecer (minhas sugestões)

Matriz de precedência explícita
Defina a ordem oficial quando houver conflito: excludedDays > feriado > diasSemana. Hoje isso aparece de forma implícita nos testes, mas vale constar como regra de negócio no plano (e nos testes “de conflito”). Ex.: “se a data estiver em excludedDays, sempre desliga, mesmo com agenda de feriado”. (Relaciona com os cenários de dias excluídos.)

Política configurável de feriado
Ao invés de “feriado sempre exclusivo”, documente uma flag de política (p.ex. holidayPolicy: 'exclusive' | 'inclusive' | 'override') e acrescente testes para cada modo. Isso evita reescrita se amanhã pedirem “feriado + agenda normal, prevalecendo a mais restritiva”. (Pode complementar a seção 1.1.)

Overlaps e janelas múltiplas
Adicione um caso de teste para duas janelas no mesmo dia que se sobrepõem (ex.: 08:00–12:00 e 11:00–14:00) definindo comportamento: ligar no início da primeira e só desligar no fim da última? Sugiro consolidar janelas antes de decidir. (Acrescentar em “Casos Críticos”.)

Tolerância ao “tic” (modo retain:false)
Comparar “hora exata” pode perder o segundo/minuto por latência do Node-RED. Documente e teste uma tolerância mínima (p.ex. ±30s) para os disparos pontuais. (Complementa a seção de comparação de horário.)

Timezone & deploy
O plano já elimina offset hardcoded; inclua um check de ambiente no deploy: servidor deve estar em America/Sao_Paulo ou usar Intl fixando timezone. Acrescente um teste de fumaça que valida o timezone ativo no runtime antes de iniciar os agendamentos.

Formato canônico das datas
Padronize storedHolidaysDays e excludedDays para YYYY-MM-DD e documente isso no plano (evita parse ambiguidades). Valide formato em runtime com fallback/log de erro. (Relaciona com a parte de parsing e testes multi-locale.)

Observabilidade
Inclua nos entregáveis de Fase 1:

logs de decisão por device/janela (ON/OFF, motivo, política aplicada),

métricas simples (contagem de ativações por política),

alerta quando um device alternar ON/OFF mais de N vezes na mesma hora (sinal de configuração ruim). (Adicionar ao checklist de Fase 1.)

Testes de propriedade (“fuzz”)
Além dos casos fixos, gere aleatoriamente janelas (incluindo atravessar meia-noite) e verifique invariantes (ex.: retain:true fora da janela ⇒ sempre shouldShutdown). Pode ficar em um *.property.test.js separado sob a mesma estrutura.

Rollback & feature flag
Adicione aos entregáveis uma feature flag (ex.: useHolidayExclusivePolicy) e um plano de rollback simples (variável de ambiente) caso surja regressão em produção. (Acrescente ao bloco de Entregáveis.)

Cobertura por branches “edge”
As metas de coverage estão boas; inclua como critério que os ramos “meia-noite” e “domingo→segunda” sejam explicitamente cobertos (há testes disso; só marque como requisito formal).

Ajustes rápidos no documento

Em “Plano de Correção” 1.1, acrescente a matriz de precedência e a flag holidayPolicy.

Em “Casos de Teste Críticos”, inclua overlap de janelas e tolerância de tic.

Em “Entregáveis”, adicione logs/métricas/alertas e feature flag/rollback.

No geral, o plano está maduro e implementável. Com esses incrementos, você reduz risco operacional e deixa a política de feriado “à prova de mudanças” futuras.