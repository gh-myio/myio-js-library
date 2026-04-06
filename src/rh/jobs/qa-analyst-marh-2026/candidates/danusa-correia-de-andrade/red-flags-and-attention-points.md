# Red Flags e Pontos de Atenção — Danusa Correia de Andrade

**Vaga:** Analista de QA — Nível Pleno
**Data da análise:** 2026-04-06

> Documento de apoio à tomada de decisão. Baseado exclusivamente na análise do CV.
> Nenhum item aqui é eliminatório por si só — devem ser investigados na entrevista.

---

## 🔴 Red Flags — Riscos altos

### 1. Objetivo de carreira declarado incompatível com a vaga

> _"Trabalhar com ágil, atuando como Product Owner, Analista de Negócio ou similar."_

O próprio CV declara explicitamente que ela não busca uma posição de QA. Isso levanta três hipóteses:
- A candidatura foi feita por engano ou por pressão financeira.
- Ela está em transição de carreira não documentada no CV.
- Ela não entendeu o escopo técnico da vaga.

**Risco:** contratação com expectativa desalinhada → frustração e saída rápida.
**Investigar:** motivação real pela candidatura e visão de curto/médio prazo.

---

### 2. Ausência total de ferramentas de automação de testes

Nenhuma menção a Selenium, Robot Framework, Cypress, Playwright, Appium, k6, JMeter ou qualquer ferramenta de automação — nem mesmo em nível iniciante ou curso.

**Risco:** requisito obrigatório da vaga não atendido. Ramp-up longo e incerto.
**Investigar:** se há interesse e base técnica para aprender automação.

---

### 3. Sem evidência de testes técnicos (API, backend, integração)

Toda a experiência de teste está concentrada em **homologação funcional** (aceite de negócio), não em testes técnicos de integração, APIs, payloads ou logs de sistema.

**Risco:** não conseguirá executar as atividades técnicas do cargo sem treinamento extensivo.
**Investigar:** se já validou JSON, usou Postman ou interagiu com APIs — mesmo informalmente.

---

### 4. Stack técnica ausente (JS, HTML, Git, REST)

Das tecnologias desejáveis da vaga, **nenhuma aparece no CV**: JavaScript, HTML, Git, CI/CD, APIs REST, Postman, Swagger.

**Risco:** curva de aprendizado técnica muito alta para um perfil Pleno.
**Investigar:** nível real de leitura de código e familiaridade com browser DevTools.

---

## 🟡 Pontos de Atenção — Riscos médios

### 5. SQL sem evidência de profundidade

SQL aparece na lista de ferramentas (`HP PPMC SQL`, `Power Architect`), mas não há nenhum contexto de uso. Pode ser apenas consultas básicas de BI ou leitura de relatórios.

**Investigar:** se consegue escrever queries com `JOIN`, `WHERE`, `GROUP BY` para validar dados — ou se o uso foi apenas visual/ferramental.

---

### 6. Experiência de testes sempre no papel de PO/BA, não de QA

Todas as experiências de homologação e teste foram executadas **dentro do papel de Analista de Negócios ou PO**, não como QA dedicado. Isso implica:
- Os testes eram provavelmente de aceite de negócio, não de qualidade técnica.
- Não há evidência de ownership sobre qualidade de software como função principal.

**Investigar:** qual era sua responsabilidade real nos ciclos de teste vs. o time de QA formal.

---

### 7. Todas as experiências em setor de seguros (domínio muito diferente)

10+ anos concentrados em Bradesco Seguros, Prudential, Bradesco Saúde — sistemas de apólices, sinistros e seguros. O domínio de IoT, monitoramento e dashboards técnicos é completamente diferente.

**Risco:** não é eliminatório, mas exige adaptação de contexto considerável.
**Investigar:** interesse genuíno em tecnologia de monitoramento e sustentabilidade.

---

### 8. Transição de carreira não comunicada

Se há uma intenção de migrar de PO/BA para QA, ela não está documentada ou justificada no CV. Candidaturas de transição sem narrativa clara aumentam o risco de desalinhamento.

**Investigar:** se ela tem clareza sobre o que muda no dia a dia entre as duas funções.

---

### 9. Tempo médio nas empresas relativamente curto nos últimos anos

| Empresa | Duração |
|---|---|
| SysManager (atual) | ~11 meses |
| Globality-it | ~14 meses |
| Elumini | ~23 meses |
| Bradesco Seguros | ~50 meses |
| Capgemini | ~25 meses |

Os primeiros 10 anos têm estabilidade razoável (Bradesco, Capgemini). As empresas mais recentes via consultoria mostram rotatividade maior — pode ser padrão do mercado de consultorias ou insatisfação com os projetos.

**Investigar:** motivações das saídas recentes e o que busca de diferente.

---

## 🟢 O que não é red flag (mas pode parecer)

| Item | Por quê não é problema |
|---|---|
| Formação em Matemática / Educação | Base analítica sólida; background diferenciado para QA |
| Muitas pós-graduações | Demonstra investimento contínuo em aprendizado |
| Não ter trabalhado com IoT | Domínio aprendível; o que importa é base técnica |
| Foco em processos e BPMN | Útil para documentar fluxos e critérios de qualidade |

---

## Resumo de riscos

| Risco | Nível | Investigável na entrevista? |
|---|---|---|
| Objetivo de carreira desalinhado | 🔴 Alto | Sim |
| Sem automação de testes | 🔴 Alto | Parcialmente |
| Sem testes técnicos (API/backend) | 🔴 Alto | Sim |
| Stack técnica ausente | 🔴 Alto | Sim |
| SQL sem profundidade comprovada | 🟡 Médio | Sim |
| Testes sempre em papel de PO/BA | 🟡 Médio | Sim |
| Domínio muito diferente (seguros → IoT) | 🟡 Médio | Sim |
| Transição não comunicada no CV | 🟡 Médio | Sim |
| Rotatividade recente em consultorias | 🟡 Médio | Sim |
