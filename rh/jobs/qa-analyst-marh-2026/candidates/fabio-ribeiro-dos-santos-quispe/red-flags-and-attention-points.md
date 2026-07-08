# Red Flags e Pontos de Atenção — Fábio Ribeiro dos Santos Quispe

**Vaga:** Analista de QA — Nível Pleno
**Data da análise:** 2026-04-09
**Fonte:** CV + Parecer Mena

> Documento de apoio à tomada de decisão. Baseado na análise do CV e do parecer do headhunter.
> Este candidato apresenta o perfil mais aderente da seleção QA — os riscos abaixo são proporcionalmente baixos.

---

## 🔴 Red Flags — Riscos altos

> Nenhum red flag crítico identificado para esta vaga.

---

## 🟡 Pontos de Atenção — Riscos médios

### 1. Experiência única — 4+ anos somente na Ambev Tech

Toda a trajetória documentada está concentrada em uma única empresa grande (Ambev Tech). Isso traz profundidade no contexto, mas levanta questões sobre:
- Adaptabilidade a culturas e tecnologias diferentes
- Capacidade de trabalhar sem a infraestrutura e os processos maduros de uma big tech
- Velocidade de entrega em ambiente com menos recursos e mais ambiguidade

**Risco:** dificuldade de adaptação ao ritmo e à cultura de uma startup enxuta.
**Investigar:** motivação real para sair; o que ele busca que a Ambev não oferece; experiências anteriores à Ambev (não documentadas no CV).

---

### 2. SQL sem profundidade demonstrada

SQL aparece na lista de habilidades técnicas, mas não há contexto de uso no CV — sem menção a queries de validação de dados, joins, análise de séries temporais ou investigação de discrepâncias de telemetria.

Para uma vaga que envolve validar ingestão de dados de sensores IoT em banco, a profundidade em SQL é relevante.

**Investigar:** nível real de SQL — se consegue escrever queries de validação de dados de telemetria, joins e comparações entre dados da UI e do banco.

---

### 3. HTML não evidenciado

O CV não menciona HTML. A vaga envolve verificar alertas e dados em dashboards web (HTML/JS). Os testes UI com Cypress implicam familiaridade com DOM, mas o nível de leitura de HTML não é claro.

**Não é crítico** — quem trabalha com Cypress necessariamente interage com seletores DOM.
**Investigar:** se consegue inspecionar um dashboard, identificar elementos e escrever seletores sem suporte.

---

### 4. Inglês em desenvolvimento

O parecer aponta inglês como ponto de desenvolvimento. Dependendo do contexto da vaga (documentação técnica, comunicação com parceiros internacionais), pode ser uma limitação.

**Investigar:** nível real de leitura técnica e comunicação escrita em inglês.

---

### 5. Sem experiência documentada anterior à Ambev (2021)

O CV começa em agosto/2021. Fábio aparenta ter aproximadamente 44 anos (nascimento 1981 inferido pelo e-mail). O que fez antes de 2021 não está documentado — pode ser uma transição de carreira (a graduação em Ciências Contábeis sugere isso).

**Não é red flag** — a experiência atual é consistente e profunda. Mas entender a trajetória completa ajuda a avaliar resiliência e contexto.
**Investigar:** trajetória antes de 2021 e como chegou à área de QA.

---

## 🟢 O que não é red flag (mas pode parecer)

| Item | Por quê não é problema |
|---|---|
| Formação em Ciências Contábeis | Background analítico; transição de carreira bem-sucedida para tech |
| Pós em IA/ML além de QA | Demonstra visão de futuro da área; projeto RAG já aplicado |
| Graduação em Ciência de Dados em andamento | Candidato em evolução contínua — diferencial |
| Uma única empresa nos últimos 4 anos | Profundidade e consistência; não é sinal de acomodação dado o nível de iniciativas |
| Localização Salto de Pirapora (interior SP) | Remoto confirmado; sem impacto na operação |
| Sem experiência com ThingsBoard | Plataforma específica — aprendível rapidamente com o contexto do produto |

---

## Resumo de riscos

| Risco | Nível | Investigável na entrevista? |
|---|---|---|
| Adaptação: grande empresa → startup | 🟡 Médio | Sim — avaliar motivação e expectativas |
| SQL sem profundidade demonstrada | 🟡 Médio | Sim |
| HTML não evidenciado | 🟡 Baixo | Sim — resposta rápida |
| Inglês em desenvolvimento | 🟡 Baixo-Médio | Sim |
| Trajetória pré-2021 não documentada | 🟢 Baixo | Sim — contexto histórico |
