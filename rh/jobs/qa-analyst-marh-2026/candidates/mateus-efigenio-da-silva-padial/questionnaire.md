# Questionário de Entrevista — Mateus Efigênio da Silva Padial

**Vaga:** Analista de QA — Nível Pleno
**Data da entrevista:** —
**Entrevistador(a):** —

> **Objetivo:** Confirmar SQL (gap crítico), avaliar profundidade em observabilidade/logs, mapear capacidade de estruturar QA do zero e fit com produto IoT. Priorizar perguntas marcadas com 🔴 (críticas).

---

## Bloco 1 — Automação de testes (ponto forte)

1. No Banco Pan você automatizou web, mobile e API simultaneamente. Como você organizava a estratégia para cobrir três canais sem duplicar esforço?
2. Você trabalhou com **Cypress, Selenium e Appium**. Qual é a diferença prática no dia a dia entre eles? Em que projeto usou cada um?
3. Você tem experiência com **Cucumber** (BDD). Quem escrevia os cenários — QA, PO ou desenvolvedores? Como era o processo?
4. No Banco Pan você atuou como **Dev Backend** no time de Login/Onboarding. O que isso mudou na forma como você testa? Você consegue ler e entender o código que está testando?
5. Você já criou ou arquitetou um **framework de automação do zero**? Ou sempre atuou em frameworks já existentes?

---

## Bloco 2 — SQL e banco de dados 🔴

6. 🔴 SQL não aparece explicitamente no seu CV. Você tem experiência com consultas SQL para validação de dados? Consegue escrever queries com JOINs e GROUP BY para verificar dados de telemetria ou transações?
7. 🔴 Como você validaria que um dado que aparece em um dashboard está correto no banco de dados? Qual seria o processo passo a passo?
8. Você já usou banco de dados em algum dos seus projetos para investigar bugs — ex: comparar estado esperado vs. real diretamente no banco?

---

## Bloco 3 — Logs e observabilidade 🔴

9. 🔴 Quando você diz que "suportou análise de incidentes" na Capitani e no Banco Pan — qual era o processo? Você tinha acesso a logs de backend? Quais ferramentas usava?
10. 🔴 Você já usou Datadog, ELK, Grafana ou qualquer ferramenta de observabilidade para investigar problemas em produção?
11. Como você diferencia um bug de comportamento (aplicação errada) de um problema de dados (dado inconsistente ou ingestão incorreta)?

---

## Bloco 4 — CI/CD e pipelines

12. Você manteve pipelines Jenkins e Azure DevOps em Capitani, Banco Pan e Keeggo. Qual foi a pipeline mais complexa que você configurou? Quais stages ela tinha?
13. Como você garante que os testes automatizados não se tornam um gargalo no pipeline — especialmente se você tem 200+ casos de teste?
14. Você já configurou **quality gates** que bloqueiam o merge se algum teste critico falhar?

---

## Bloco 5 — API testing

15. Você tem uma stack de API bastante completa: Postman, RestAssured, Karate, SoapUI. Em qual contexto usou cada uma?
16. Como você testa um endpoint que retorna dados paginados com 10.000 registros? Quais casos você cobriria?
17. Você já testou APIs **assíncronas** (webhooks, eventos, filas)? Como garantiu a validação de uma mensagem que não tem resposta imediata?

---

## Bloco 6 — Produto e IoT

18. 🔴 A Myio monitora energia, água e temperatura via sensores IoT em shoppings. Sem experiência prévia com IoT, como você abordaria os primeiros testes desse produto?
19. Como você testaria um alerta que dispara quando um sensor de temperatura ultrapassa 28°C — sem ter o hardware físico disponível?
20. Você tem interesse genuíno no domínio de IoT e monitoramento de facilities?

---

## Bloco 7 — Estruturação de QA e fit cultural

21. 🔴 A empresa não tem área de QA estruturada. Você precisaria construir processos, definir frameworks e criar a cultura de qualidade. Você já fez isso? Como seria sua abordagem nos primeiros 90 dias?
22. O parecer menciona que você pode aprofundar mais a **documentação** e a **visão estratégica de QA**. Como você se avalia nisso hoje?
23. Você está em múltiplos projetos simultâneos na Capitani e quer foco em um produto. Por que a Myio seria esse produto para você?
24. Qual é a sua expectativa de regime (PJ ou CLT), modelo de trabalho e pretensão salarial?

---

## Espaço para anotações do entrevistador

| Pergunta | Resposta resumida | Avaliação |
|---|---|---|
| | | |
| | | |
| | | |

---

## Impressão geral pós-entrevista

**SQL — confirmado ou ausente:**
_—_

**Capacidade de estruturar QA do zero:**
_—_

**Observabilidade e logs:**
_—_

**Fit com produto IoT:**
_—_

**Recomendação pós-entrevista:**
- [ ] Avançar para próxima etapa
- [ ] Avançar com ressalvas
- [ ] Não avançar
- [ ] Considerar como backup

**Comentário final:**
_—_
