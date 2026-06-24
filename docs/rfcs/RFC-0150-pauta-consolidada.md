# RFC-0150: Pauta Consolidada - Roadmap Estratégico MYIO

- **Status:** Proposta
- **Criado em:** 2026-01-12
- **Autor:** Equipe MYIO
- **Contexto:** Reunião Estratégica MYIO

## Sumário

Este RFC consolida a pauta estratégica das reuniões de planejamento da plataforma MYIO, incluindo novos projetos, correções pendentes, migrações e evoluções do ecossistema.

## Motivação

A plataforma MYIO está em constante evolução e requer um documento consolidado que:

1. Centralize todas as demandas e pendências identificadas
2. Defina prioridades claras de desenvolvimento
3. Estabeleça responsabilidades e expectativas de entrega
4. Sirva como referência para acompanhamento de progresso

## Guia de Implementação

### 1. SuperVia - Novo Projeto: Dashboard de Indicadores de Falha

**Objetivo:** Desenvolvimento de painel de gestão de falhas de equipamentos.

**Escopo:**
- Entendimento da continuidade da demanda do novo painel
- Definição clara do escopo do painel de gestão de falhas
- Próximos passos, responsáveis e expectativas de entrega

**Status:** `proposta`

---

### 2. Obra Max - Revisão e Correções Pendentes

**Itens pendentes:**

| Item | Descrição | Prioridade |
|------|-----------|------------|
| Automação | Revisão das lógicas de automação de agendamento | Alta |
| Node-RED | Equalização das funções nas centrais | Alta |
| Alarmes | Revisão dos perfis de alarmes (inconsistências) | Média |
| Hidrômetros | Revisão em unidades específicas | Média |
| Rate Limit | Fila de envio para tratamento de limite de chamadas | Alta |

**Status:** `em-andamento`

---

### 3. Migração dos Painéis de Shoppings para Versão 5.2

**Pendências:**
- Regras de área comum
- Integração da API + Credenciais Argoplan (Produção)
- Adicionar escritório ARGO no Ingestion

**Status:** `em-andamento`

---

### 4. Tela de Consulta Pública / Lojas - Praia da Costa

**Requisitos:**
- Projetar solução replicável
- Implementar controle de perfil de acesso

**Status:** `proposta`

---

### 5. Desenvolvimento de Ecossistema de Alarmes

**Escopo técnico:**
- Estruturação de metadata e servidor
- Definição de regras básicas
- Revisão da arquitetura geral do painel Head Office

**Alinhamento de módulos:**

| Módulo | Status |
|--------|--------|
| Módulos prontos | Validar |
| Módulos em desenvolvimento | Documentar |
| Módulos futuros | Planejar |

**Entregáveis:**
- Validação do que foi combinado e prometido
- Consolidação de escopo, pendências e priorização

**Status:** `em-andamento`

---

### 6. BUC - Base Única de Cadastro

**Escopo:**
- Estruturação de metadata
- Desenvolvimento de servidor
- Implementação de API

**Status:** `proposta`

---

### 7. Painéis Responsivos (Shopping e Head Office)

**Problema:** Painéis não funcionam bem em dispositivos móveis.

**Solução:** Implementar design responsivo para suporte a celulares e tablets.

**Status:** `proposta`

---

### 8. Gráfico de Picos de Demanda

**Ação:** Validar implementação atual e ajustar conforme necessidade.

**Status:** `validação`

---

### 9. Alarmes de Pico de Demanda

**Ação:** Estudar viabilidade e definir regras de implementação.

**Status:** `estudo`

---

### 10. Integrações de Ingestion

| Funcionalidade | Status | Ação |
|----------------|--------|------|
| Caixa d'Água | Proposta | Planejar |
| Telemetrias Instantâneas | Proposta | Planejar |
| Temperatura (replicar para outros shoppings) | Parcial | Desenvolver chamada no painel |

---

### 11. Integrações Externas

| Sistema | Cliente | Status |
|---------|---------|--------|
| ERP Group Software | Campinas Shopping | Validar |
| Souza Aguiar | - | Alinhar |

---

### 12. Pré-Setup - Revisão Geral e Versão 2.0

**Escopo:**
- Revisão geral da ferramenta
- Desenvolvimento da versão 2.0
- Ferramenta de Pré-Setup para Upsell

**Status:** `alinhar`

---

### 13. MyIO Academy - Portal de Treinamento e Comunidade

**Objetivo:** Criar portal de treinamento e comunidade para usuários da plataforma.

**Status:** `alinhar`

---

### 14. Observabilidade e Monitoramento de Devices

**Escopo:** Painel e alertas internos/cliente com conjunto de regras e hierarquias.

**Produtos de monitoramento:**

| Produto | Regra | Threshold |
|---------|-------|-----------|
| Produto 1 | Dispositivos sem comunicação | > 60 min |
| Produto 2 | Energia (3F) com comunicação, consumo = 0 | > 48h |
| Produto 3 | Água com comunicação, consumo = 0 | > 72h |
| Produto 4 | Temperatura com leitura inválida | ≥60°C ou ≤10°C |

**Status:** `proposta`

---

### 15. Mender - Gestão e Atualização Remota de Dispositivos

**Tarefas:**

- [ ] Configurar ambiente Mender para gerenciamento de dispositivos
- [ ] Definir estratégia de atualização OTA
- [ ] Garantir rollback seguro
- [ ] Integrar com provisionamento e monitoramento existentes

**Status:** `proposta`

---

### 16. Health Check com Novas Mudanças

**Tarefas:**

- [ ] Revisar endpoints e serviços monitorados
- [ ] Ajustar lógica de health check para novas integrações e ingestion
- [ ] Garantir alarmes e relatórios em falhas

**Status:** `proposta`

---

### 17. Padronização de Rule Chain / Alarmes no ThingsBoard

**Objetivos:**

- [ ] Padronizar mensagens e metadados de alarmes
- [ ] Melhorar legibilidade e clareza
- [ ] Criar guia interno de boas práticas

**Status:** `proposta`

---

### 18. Backup do ThingsBoard e Limpeza de Dados

**Tarefas:**

- [ ] Implementar rotina de backup completo do ThingsBoard
- [ ] Realizar limpeza de dados antigos ou irrelevantes
- [ ] Garantir política de retenção e restauração validada

**Status:** `proposta`

---

### 19. Validação de Dados para Relatórios Multi-Central

**Regras:**

- [ ] Verificação antes de gerar relatórios com mais de uma central
- [ ] Garantir sincronização ou dados válidos até 1h atrás
- [ ] Emitir warning ou aplicar estratégia se fora do esperado
- [ ] Aplicar regra também para APIs de terceiros

**Status:** `proposta`

---

### 20. Migração PostgreSQL para CassandraDB

**Tarefas:**

- [ ] Planejar migração com mínimo downtime
- [ ] Validar compatibilidade de dados e queries
- [ ] Realizar testes de performance e integridade

**Status:** `proposta`

---

### 21. Ambiente Isolado para Testes/Desenvolvimento/Homologação

**Tarefas:**

- [ ] Criar instância separada para testes e desenvolvimento
- [ ] Replicar dados e configurações essenciais
- [ ] Garantir isolamento de dados de produção

**Status:** `proposta`

---

### 22. Soluções com IA usando N8N

**Escopo:**

- Alertas preditivos e corretivos
- Comparação com padrões de consumo/operação

**Status:** `proposta`

---

### 23. Dashboard de Automação (Ex: BB/Obramax)

**Funcionalidades propostas:**

#### Centralização de Controle de Eficiência Operacional

- Ranking de shoppings por:
  - Consumo fora do padrão
  - Pico de demanda
  - Alarmes críticos recorrentes
- "Top 10 riscos da semana"
- Heatmap de falhas por tipo de equipamento

#### Readiness Score (Simples e Poderoso)

Cada shopping terá um "score MYIO" baseado em:

| Critério | Peso |
|----------|------|
| Qualidade de dados | Alto |
| Cobertura de equipamentos | Alto |
| Alarmes ativos/inativos/tratados | Médio |
| Consistência de ingestion | Alto |
| Chamados, auditorias, consultoria, melhorias | Médio |

**Status:** `proposta`

---

### 24. Marketplace de Integrações

**Contexto:**

- Integrações internas (Argoplan, etc.)
- Integrações externas (Tuya, etc.)

**Status:** `proposta`

---

### 25. Time DEV - Projeção de Crescimento

**Planejamento de expansão:**

- QA
- Dev recém-formado
- Infra

**Status:** `alinhar`

---

## Desvantagens

1. **Escopo extenso:** A quantidade de itens pode dificultar a priorização
2. **Dependências cruzadas:** Alguns itens dependem de outros para serem executados
3. **Recursos limitados:** Necessidade de balancear entre manutenção e novos desenvolvimentos

## Alternativas Consideradas

1. **Divisão em múltiplos RFCs:** Cada item principal poderia ter seu próprio RFC
2. **Priorização por cliente:** Agrupar itens por cliente/projeto
3. **Sprints temáticos:** Organizar em ciclos de desenvolvimento focados

## Questões em Aberto

1. Qual a ordem de prioridade definitiva dos itens?
2. Quais itens podem ser paralelizados?
3. Qual o timeline esperado para cada fase?
4. Quais recursos adicionais são necessários?
5. Como será feito o acompanhamento de progresso?

## Referências

- Reuniões estratégicas MYIO
- Documentação interna de projetos
- Backlog de desenvolvimento

---

**Changelog:**

| Versão | Data | Descrição |
|--------|------|-----------|
| 0.1.0 | 2026-01-12 | Versão inicial - consolidação da pauta |
