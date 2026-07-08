# Questionário de Entrevista — Letícia Santos Camargo

**Vaga:** Analista de QA — Nível Pleno
**Data da entrevista:** —
**Entrevistador(a):** —

> **Objetivo:** Confirmar profundidade em observabilidade/logs, avaliar fit com domínio IoT e cultura startup, e entender motivação para transição do setor público para empresa privada. Candidata forte — foco em gaps pontuais. Priorizar perguntas marcadas com 🔴 (críticas).

---

## Bloco 1 — Frameworks e automação (ponto forte)

1. No TJGO você construiu um framework Playwright + TypeScript do zero. Quais foram as primeiras decisões de arquitetura — como estruturou os Page Objects, a camada de fixtures, os reporters?
2. Na Aliare você reduziu 65% do esforço de regressão manual. Qual foi a estratégia de priorização — por onde começou a automatizar?
3. Você trabalha com TypeScript Expert. Como você usa tipagem para tornar o framework mais robusto e reduzir erros em tempo de execução?
4. Cypress e Playwright têm diferenças importantes em arquitetura. Em qual contexto você escolheria cada um hoje?
5. Você já trabalhou com **Robot Framework**? Tem interesse ou experiência com ele?

---

## Bloco 2 — CI/CD e qualidade contínua 🔴

6. 🔴 Na Aliare você configurou **quality gates no Jenkins** que bloqueavam integração para código com bugs críticos. Como eram esses critérios? Quem definia o threshold?
7. Como você estrutura um pipeline de testes para rodar em paralelo sem conflitos de dados entre testes?
8. Você usa **Docker** nas suas pipelines — em que contexto? Para ambiente de teste, banco de dados efêmero, ou outro?
9. Você já integrou resultados de automação com Azure DevOps para rastreabilidade de test cases? Como era o fluxo com Testmo?

---

## Bloco 3 — Logs, backend e observabilidade 🔴

10. 🔴 Quando você precisa investigar um bug em produção, qual é o seu processo? Você tem acesso a logs de backend? Quais ferramentas usa (Datadog, ELK, CloudWatch, outro)?
11. 🔴 Você já validou dados em uma **série temporal** ou em tabelas de telemetria — dados de sensores, eventos contínuos com timestamp? Como abordou a validação de consistência?
12. Como você diferencia um bug de aplicação de um problema de dados corrompidos na ingestão?
13. Você já testou **webhooks** ou integrações assíncronas onde o resultado não é imediato? Como garantiu a validação?

---

## Bloco 4 — SQL e banco de dados

14. Na Aliare você usou Oracle SQL para validação de integridade. Qual o tipo de query mais complexo que você escreveu — joins entre múltiplas tabelas, subqueries, comparação entre estado esperado e real no banco?
15. Como você usaria SQL para investigar uma discrepância entre o que aparece em um dashboard (ex: consumo de energia de um sensor) e o que está no banco de dados?
16. Você tem experiência com bancos de dados diferentes do relacional — como séries temporais (TimescaleDB, InfluxDB)?

---

## Bloco 5 — Produto e domínio IoT

17. 🔴 A Myio monitora energia, água e temperatura em shoppings. Os dados vêm de gateways IoT em tempo real. Sem ter experiência prévia com IoT, como você abordaria a estratégia de testes desse produto?
18. Como você testaria um **alerta que dispara quando um sensor ultrapassa um threshold** — por exemplo, temperatura acima de 28°C? Sem hardware físico disponível.
19. O dashboard da Myio mostra dados de 500+ dispositivos simultaneamente. Que riscos de qualidade você mapearia imediatamente?
20. Você já usou ThingsBoard, AWS IoT Hub ou plataforma similar?

---

## Bloco 6 — Fit cultural e carreira

21. 🔴 Você está no TJGO — setor público, sistemas críticos e formais. A Myio é uma startup privada com ritmo diferente. O que te atrai nessa mudança? O que você espera que seja diferente?
22. O parecer menciona tendência a centralizar responsabilidades — como você percebe isso hoje? Como tem trabalhado essa tendência?
23. Você mencionou querer menos foco em liderança e mais em execução técnica nesse momento. O que mudou na sua percepção sobre isso?
24. Você está em "mobilidade" em Goiás, com base em SP. Qual é a sua situação concreta de localização e disponibilidade para fuso -3 GMT?
25. Qual é sua expectativa de regime (PJ ou CLT) e pretensão salarial?

---

## Espaço para anotações do entrevistador

| Pergunta | Resposta resumida | Avaliação |
|---|---|---|
| | | |
| | | |
| | | |

---

## Impressão geral pós-entrevista

**Observabilidade / logs:**
_—_

**Fit com domínio IoT:**
_—_

**Adaptação startup vs. governo:**
_—_

**Comunicação em inglês (ao vivo se relevante):**
_—_

**Recomendação pós-entrevista:**
- [ ] Avançar para próxima etapa
- [ ] Avançar com ressalvas
- [ ] Não avançar
- [ ] Candidata principal — priorizar

**Comentário final:**
_—_
