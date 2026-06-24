# Feedback — Candidata × Vaga

**Candidata:** Letícia Santos Camargo
**Vaga:** Analista de QA — Nível Pleno
**Data:** 2026-04-09
**Fonte:** Parecer Mena + CV

---

## Visão geral

| Dimensão | Avaliação | Peso |
|---|---|---|
| Aderência técnica (automação QA) | Alta | Alta |
| CI/CD e pipelines de teste | Alta | Alta |
| SQL e validação de dados | Alta | Alta |
| Observabilidade / logs / backend | Média | Alta |
| Fit com domínio IoT / dashboards | Baixa | Média |
| Alinhamento de objetivo de carreira | Alto | Alta |
| Inglês | Alta (C1) | Bônus |

**Score estimado de aderência à vaga: 8,5 / 10**

---

## Análise critério a critério

### Responsabilidades da vaga

| Responsabilidade | Evidência no CV | Aderência |
|---|---|---|
| Participar de rituais ágeis (Scrum/Kanban) | Atuação Agile em Aliare e TJGO | ✅ Atende |
| Criar, executar e manter casos de teste | 250+ test cases (Aliare); framework completo com Testmo (TJGO) | ✅ Atende plenamente |
| Validar ingestões de dados em dashboards | Sem experiência com dashboards de telemetria IoT | ❌ Não atende (contexto diferente) |
| Automatizar fluxos de teste (Selenium / Robot Framework) | Playwright + Cypress + Selenium — arquitetou frameworks do zero em 2 empresas | ✅ Atende plenamente |
| Validar payloads JSON de APIs externas | REST APIs com Cypress + validação de dados Aliare | ✅ Atende |
| Acompanhar integrações via log | Root cause analysis em Java enterprise; sem ferramenta de log explícita | ⚠️ Atende parcialmente |
| Apoiar análise de incidentes em produção | Root cause analysis profundo + defect resolution time -20% | ✅ Atende |
| Consultas básicas em banco de dados | Oracle SQL em produção para validação de integridade de dados | ✅ Atende plenamente |
| Verificar alertas em dashboards (HTML/JS) | Técnico em Web Development; testes UI com Cypress | ✅ Atende |

---

### Requisitos obrigatórios

| Requisito | Evidência | Aderência |
|---|---|---|
| Automação de testes (Selenium / Robot Framework) | Playwright + Cypress + Selenium; criou frameworks do zero | ✅ Atende plenamente |
| Metodologias ágeis (Scrum / Kanban) | Agile em TJGO e Aliare | ✅ Atende plenamente |
| Leitura de logs de backend (Node.js / APIs REST) | REST API testing; root cause analysis Java; sem Datadog ou stack de observabilidade | ⚠️ Atende parcialmente |
| SQL básico para validação de dados | Oracle SQL + MySQL + SQL Server; usou para validação de dados em Aliare | ✅ Atende plenamente |
| Comunicação para relato de bugs | Documentação detalhada; logs de reprodução precisos; mentoria técnica de 15 | ✅ Atende plenamente |

**Obrigatórios atendidos: 4 de 5 (1 parcial)**

---

### Requisitos desejáveis

| Requisito | Evidência | Aderência |
|---|---|---|
| JavaScript básico | TypeScript Expert (superset JS); JavaScript como linguagem | ✅ Atende plenamente |
| Noções de HTML para dashboards | Técnico em Web Development (IF Goiano, 2019) | ✅ Atende |
| APIs REST / Postman / Swagger | REST APIs validadas com Cypress + Aliare; sem Postman explícito | ✅ Atende (inferido) |
| Git / CI/CD | Jenkins + quality gates + Docker + Azure DevOps | ✅ Atende plenamente |
| Interesse em IoT / ThingsBoard | Sem experiência ou menção a IoT | ❌ Não atende |

**Desejáveis atendidos: 4 de 5**

---

## Pontos fortes (o que ela traz de valor)

- **Inglês C1**: único na seleção — diferencial real para documentação técnica, leitura de stack traces internacionais e futura comunicação com parceiros.
- **Construtora de frameworks**: Playwright do zero no TJGO + Cypress do zero na Aliare — capacidade comprovada de estruturar QA sem infraestrutura prévia.
- **Métricas reais**: -65% regressão manual, -50% ciclo de release, -25% defeitos em produção, +40% cobertura — candidata orientada a resultado.
- **SQL em produção**: Oracle SQL para validação de integridade — diferencial sobre candidatos que listam SQL sem profundidade.
- **Docker explícito**: único nas habilidades de CI/CD — relevante para ambiente containerizado.
- **TypeScript Expert**: linguagem moderna, tipada, cada vez mais padrão em frameworks de automação.
- **Técnico em Web Development**: garante base real de HTML/CSS/JS — não apenas inferida.

---

## Lacunas

- **Observabilidade / logs de backend**: sem Datadog, ELK, Grafana ou ferramenta equivalente documentada — root cause analysis existe, mas via análise de código/stack, não de logs de sistema.
- **IoT / ThingsBoard**: zero exposição — contexto da Myio exigirá aprendizado do domínio.
- **Postman não explícito**: testa APIs com Cypress; Postman especificamente não mencionado.
- **Sem mobile testing**: foco em web e backend; sem menção a Appium ou testes mobile.
- **TJGO é governo/judicial**: cultura muito diferente de startup IoT — avaliar adaptação a ritmo, autonomia e ambiguidade.

---

## Comparativo com Fábio Ribeiro (candidato #1)

| Critério | Letícia | Fábio |
|---|---|---|
| Automação | ✅ Playwright + Cypress (frameworks do zero) | ✅ Cypress + Robot + Selenium + Appium |
| CI/CD | ✅ Jenkins + Docker | ✅ Azure Pipelines + Jenkins |
| Observabilidade / Logs | ⚠️ Parcial | ✅ Datadog em produção |
| SQL | ✅ Oracle em produção | ⚠️ Listado sem contexto |
| Mobile | ❌ Não evidenciado | ✅ Appium |
| IA aplicada a QA | ❌ | ✅ RAG + IA no planejamento |
| Inglês | ✅ C1 | ⚠️ Em desenvolvimento |
| Estruturação QA do zero | ✅ 2x (Aliare + TJGO) | ✅ 1x (Ambev Tech) |
| Score | **8,5/10** | **9/10** |

---

## Recomendação final

| Decisão | Justificativa |
|---|---|
| ✅ Avançar com prioridade | Perfil estruturador, métricas comprovadas, inglês C1 — segunda candidata mais forte da seleção |
| ⚠️ Investigar observabilidade | Confirmar profundidade em leitura de logs de backend e análise de incidentes |
| ⚠️ Avaliar fit startup vs. governo | TJGO é muito diferente culturalmente de uma startup IoT |
| ⚠️ Confirmar motivação pela área IoT | Sem histórico no domínio — verificar interesse genuíno |

---

## Notas do avaliador

_Adicionar aqui._
