# Red Flags e Pontos de Atenção — Letícia Santos Camargo

**Vaga:** Analista de QA — Nível Pleno
**Data da análise:** 2026-04-09
**Fonte:** CV + Parecer Mena

> Documento de apoio à tomada de decisão. Candidata com perfil forte — riscos são pontuais e investigáveis.

---

## 🔴 Red Flags — Riscos altos

> Nenhum red flag crítico identificado para esta vaga.

---

## 🟡 Pontos de Atenção — Riscos médios

### 1. Sem experiência com observabilidade / logs de backend

O CV não menciona Datadog, ELK Stack, Grafana, CloudWatch ou qualquer ferramenta de observabilidade. A análise de incidentes é feita via root cause analysis no código Java — não via monitoramento de logs de sistema.

Para uma vaga que envolve acompanhar ingestão de dados IoT e investigar alertas em produção, leitura de logs de backend é relevante.

**Investigar:** se já acessou logs de aplicação (mesmo via terminal, grep, tail); como investigaria um problema em produção na Myio.

---

### 2. Zero exposição a IoT

Nenhuma experiência com IoT, plataformas de telemetria, ThingsBoard ou monitoramento de dispositivos físicos. Todo o histórico é em sistemas enterprise (judicial, agro) e web apps.

**Risco:** curva de aprendizado no domínio específico.
**Isso não é eliminatório** — domínio é aprendível, base técnica é sólida.
**Investigar:** interesse genuíno e como abordaria a estratégia de testes de telemetria.

---

### 3. Contexto TJGO: governo/judicial → startup IoT

O emprego atual é no Tribunal de Justiça de Goiás — contexto altamente formal, burocrático e com ciclos longos. A Myio é uma startup enxuta, ritmo acelerado, ambiguidade frequente.

A candidata declara buscar "maior desafio técnico e menos liderança" — alinhado com a vaga — mas a transição cultural pode ser mais difícil do que parece.

**Investigar:** o que especificamente a incomoda no TJGO; qual experiência anterior ao TJGO foi mais próxima do ritmo de startup (Aliare era empresa privada de produto — bom sinal).

---

### 4. Tendência a centralizar (em evolução)

O parecer do headhunter aponta tendência a centralizar responsabilidades, já em evolução. Em um time enxuto onde a colaboração é crítica, centralização pode virar gargalo.

**Investigar:** como ela percebe isso hoje; exemplos concretos de quando delegou ou distribuiu trabalho ao invés de resolver sozinha.

---

### 5. Localização em "mobilidade"

O CV indica "São Paulo, SP" mas o telefone tem DDD 62 (Goiás). O parecer menciona "em mobilidade (Goiás)". A situação concreta de localização não está clara.

**Investigar:** onde ela está hoje, planos de retorno a SP e impacto na disponibilidade para o trabalho remoto.

---

### 6. Postman não explícito

A vaga menciona APIs REST / Postman como desejável. Letícia testa APIs com Cypress (REST via código), mas Postman especificamente não aparece.

**Não é red flag** — quem usa Cypress para API testing entende o conceito. Mas vale confirmar.

---

## 🟢 O que não é red flag (mas pode parecer)

| Item | Por quê não é problema |
|---|---|
| Sem experiência em mobile (Appium) | A vaga não cita mobile como requisito; foco é web + IoT |
| Aliare é empresa de agro (domínio diferente) | Construiu framework e CI/CD do zero — skills são transferíveis |
| 4 anos de experiência (não sênior) | Profundidade técnica e resultados mensuráveis superam o tempo |
| Especialização em andamento (UFG, 2027) | Candidata em evolução — não é conflito de interesse |
| Objetivo de menos liderança | Alinhado com o que a vaga exige no momento atual |

---

## Resumo de riscos

| Risco | Nível | Investigável na entrevista? |
|---|---|---|
| Sem observabilidade / logs de backend | 🟡 Médio | Sim |
| Zero exposição a IoT | 🟡 Médio | Sim — avaliar interesse |
| Transição governo → startup | 🟡 Médio | Sim — avaliar motivação e experiência Aliare |
| Tendência a centralizar | 🟡 Médio | Sim |
| Localização em mobilidade | 🟡 Baixo-Médio | Sim — confirmar |
| Postman não explícito | 🟢 Baixo | Sim — resposta rápida |
