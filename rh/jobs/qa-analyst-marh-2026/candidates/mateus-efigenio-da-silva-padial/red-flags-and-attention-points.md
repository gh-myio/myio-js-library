# Red Flags e Pontos de Atenção — Mateus Efigênio da Silva Padial

**Vaga:** Analista de QA — Nível Pleno
**Data da análise:** 2026-04-09
**Fonte:** CV + Parecer Mena

> Documento de apoio à tomada de decisão. Baseado na análise do CV e do parecer do headhunter.

---

## 🔴 Red Flags — Riscos altos

### 1. SQL completamente ausente

SQL não aparece em nenhuma parte do CV — nem nas habilidades, nem nas experiências. Para uma vaga que envolve validar ingestão de dados IoT, verificar consistência entre sensores e banco de dados, SQL é um requisito obrigatório.

**Risco:** gap direto em requisito obrigatório da vaga.
**Investigar:** se tem alguma familiaridade informal com SQL — queries básicas, SELECT com WHERE, validação de dados.

---

### 2. Sem framework construído do zero

O CV descreve atuação em frameworks existentes ou com estrutura já parcialmente definida. A empresa não tem área de QA estruturada e precisa de alguém capaz de criar processos, frameworks e cultura de qualidade com autonomia.

**Risco:** gap no requisito mais crítico do momento da empresa.
**Investigar:** se já liderou a criação de algum framework ou processo de QA — mesmo que parcialmente. Se nunca fez, o fit com a vaga é limitado.

---

## 🟡 Pontos de Atenção — Riscos médios

### 3. Observabilidade / logs sem ferramenta documentada

Análise de incidentes é mencionada em Capitani e Banco Pan, mas sem ferramenta específica (Datadog, ELK, Grafana). Não está claro como investiga problemas em produção além do relato do usuário.

**Investigar:** o processo real de análise de incidentes — se acessa logs de backend, quais ferramentas usa.

---

### 4. Documentação como ponto de desenvolvimento

O parecer aponta documentação como ponto de desenvolvimento. Para estruturar uma área de QA do zero, documentação de processos, test plans e runbooks é crítica.

**Investigar:** exemplos concretos de documentação que produziu; o que faria de diferente se tivesse que criar um test plan do zero hoje.

---

### 5. Visão estratégica limitada

O parecer cita que Mateus "pode aprofundar mais a visão estratégica de QA". Para um perfil que precisa ser referência técnica em uma empresa sem QA, visão além da execução é necessária.

**Investigar:** como ele enxerga o papel de QA em um produto IoT desde o início; quais métricas definiria para medir qualidade.

---

### 6. "E2E Treinamentos" como primeira experiência (2020-2021)

O início de carreira é em uma empresa chamada "E2E Treinamentos", cujas atividades listadas parecem ser treinamento/formação (fundamentos de Agile Testing, metodologias ágeis, tipos de teste). Pode ser um programa de formação, não uma experiência profissional real.

**Investigar:** se foi contratado como colaborador em projetos reais ou se era um programa de capacitação.

---

### 7. Múltiplos clientes simultâneos — adaptabilidade em dúvida

Na Capitani atua em múltiplos projetos ao mesmo tempo (Porto Seguro, Vivo, etc.) e quer sair exatamente por isso. Porém, a capacidade de manter qualidade e profundidade em produto único não está evidenciada — toda a carreira recente foi em contexto de consultoria multi-cliente.

**Investigar:** experiência mais longa em produto único; como seria diferente trabalhar num produto próprio vs. cliente/consultoria.

---

## 🟢 O que não é red flag (mas pode parecer)

| Item | Por quê não é problema |
|---|---|
| Java no CV (não é linguagem da vaga) | Java em automação (Selenium, RestAssured) é padrão — não é conflito |
| Múltiplos clientes (consultoria) | Demonstra versatilidade e adaptabilidade — positivo |
| Sem Playwright/TypeScript | Cypress é suficiente para a vaga; Playwright é aprendível |
| Busca estabilidade e foco | Alinhado com o que a Myio oferece — motivação genuína |
| Formação em ETEC + UNINOVE | Background técnico consistente para a área |

---

## Resumo de riscos

| Risco | Nível | Investigável na entrevista? |
|---|---|---|
| SQL completamente ausente | 🔴 Alto | Sim — resposta rápida e definitiva |
| Sem framework do zero | 🔴 Alto | Sim — avaliar com cuidado |
| Observabilidade sem ferramenta | 🟡 Médio | Sim |
| Documentação como ponto de desenvolvimento | 🟡 Médio | Sim |
| Visão estratégica limitada | 🟡 Médio | Sim |
| E2E Treinamentos — natureza da experiência | 🟡 Baixo-Médio | Sim — confirmar |
| Somente consultoria multi-cliente | 🟡 Baixo | Sim |
