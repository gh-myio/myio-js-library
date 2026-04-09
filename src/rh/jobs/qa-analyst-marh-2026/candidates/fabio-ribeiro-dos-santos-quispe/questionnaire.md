# Questionário de Entrevista — Fábio Ribeiro dos Santos Quispe

**Vaga:** Analista de QA — Nível Pleno
**Data da entrevista:** —
**Entrevistador(a):** —

> **Objetivo:** Confirmar profundidade técnica, avaliar adaptabilidade a contexto de startup IoT e mapear gaps pontuais (HTML, SQL, ThingsBoard). Candidato forte — foco em substância e fit cultural. Priorizar perguntas marcadas com 🔴 (críticas).

---

## Bloco 1 — Automação de testes (ponto forte confirmado)

1. Você criou uma biblioteca de autenticação Keycloak para Cypress e RobotFramework. O que motivou criar isso em vez de usar uma solução pronta? Quais foram os desafios técnicos?
2. 🔴 No projeto open-source de sincronização com Azure DevOps — como funciona a arquitetura? O que ele resolve que as ferramentas nativas não resolviam?
3. Quando você define a estratégia de automação para um novo produto, por onde começa? Como decide o que automatizar primeiro?
4. Cypress e RobotFramework têm filosofias bem diferentes. Em que contextos você escolheria um ou outro?
5. Você já trabalhou com testes de mutação (Stryker)? Como incorpora isso no pipeline?

---

## Bloco 2 — CI/CD e pipelines 🔴

6. 🔴 Você padronizou pipelines CI/CD na Ambev Tech. Como era a arquitetura antes e depois? Quais stages você definiu como padrão?
7. 🔴 Como você garante que um pipeline de testes automatizados não vire gargalo no deploy? Quais estratégias usa para paralelização ou seleção de testes por impacto?
8. Já integrou resultados de testes automatizados com ferramentas de rastreabilidade (Azure DevOps, Jira, Xray)? Como era o fluxo?
9. Você usa GitHub Actions além de Azure Pipelines e Jenkins? Qual é a sua preferência e por quê?

---

## Bloco 3 — Logs, backend e observabilidade 🔴

10. 🔴 Como você usa o Datadog no dia a dia de QA? Além de análise de logs, você configura alertas, dashboards ou monitores?
11. O projeto RAG para análise de alertas do Datadog é bastante inovador — como ele funciona na prática? Quais foram os resultados?
12. 🔴 Você já validou dados de **telemetria em tempo real** — séries temporais, payloads de sensores IoT, ingestão de dados em dashboards? Como foi o processo?
13. Como você distingue um bug de aplicação de um problema de infraestrutura ao analisar logs em produção?
14. Você já trabalhou com RabbitMQ para testar fluxos assíncronos? Como valida que uma mensagem foi processada corretamente?

---

## Bloco 4 — SQL e banco de dados

15. 🔴 Quando você menciona SQL nas habilidades, qual é o nível de uso? Você escreve queries com JOINs, subqueries e GROUP BY para validar dados de telemetria em banco? Já investigou discrepâncias entre dados na UI e no banco?
16. Já trabalhou com bancos de dados de séries temporais (TimescaleDB, InfluxDB)? O dado de IoT tem características diferentes do relacional — como você abordaria a validação?

---

## Bloco 5 — Mobile e cobertura ampla

17. Nas PoCs com Appium, Maestro e Flutter Test — qual delas você escolheria para automação mobile em produção hoje e por quê?
18. Como você estrutura testes de performance para APIs? Você define critérios de aceitação de latência e throughput? Usa JMeter ou outra ferramenta?
19. Você trabalha com testes de acessibilidade? É algo que você incluiria em um pipeline de QA?

---

## Bloco 6 — Produto e domínio IoT

20. 🔴 A Myio é uma plataforma de monitoramento de energia, água e temperatura em shoppings — os dados vêm de gateways IoT via ThingsBoard. Que tipo de estratégia de testes você montaria para validar a ingestão de dados desses sensores?
21. Como você testaria um dashboard que exibe dados em tempo real de 500 dispositivos? Quais seriam os principais riscos de qualidade?
22. Você já teve contato com o ThingsBoard ou plataformas similares (AWS IoT, Azure IoT Hub)? O que você sabe sobre como funcionam?
23. Como você testaria um **alerta** que dispara quando um sensor ultrapassa um threshold — sem ter o hardware físico disponível?

---

## Bloco 7 — Fit cultural e carreira

24. 🔴 Você está há 4+ anos na Ambev Tech — uma empresa grande com infraestrutura madura. O que te motiva a considerar uma startup de IoT como a Myio? O que você espera de diferente?
25. Você mencionou interesse em ambientes com maior desafio técnico e estruturação de qualidade. Qual seria o maior desafio que você esperaria encontrar aqui?
26. Como você se vê como referência técnica de QA em um time onde não existe área de QA estruturada ainda? O que você priorizaria nos primeiros 90 dias?
27. Você tem disponibilidade para fuso -3 GMT e modelo remoto? Salto de Pirapora não é obstáculo?
28. Qual é sua expectativa de regime (PJ ou CLT) e pretensão salarial?

---

## Espaço para anotações do entrevistador

| Pergunta | Resposta resumida | Avaliação |
|---|---|---|
| | | |
| | | |
| | | |

---

## Impressão geral pós-entrevista

**Profundidade técnica em automação:**
_—_

**Capacidade de estruturar QA do zero:**
_—_

**Fit com domínio IoT / telemetria:**
_—_

**Adaptabilidade startup vs. grande empresa:**
_—_

**Recomendação pós-entrevista:**
- [ ] Avançar para próxima etapa
- [ ] Avançar com ressalvas
- [ ] Não avançar
- [ ] Candidato principal — priorizar

**Comentário final:**
_—_
