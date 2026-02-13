# Formulário de Requisitos para Migração de Dados de Telemetria

> **Versão:** 1.0.0
> **Data:** 2026-02-13
> **Objetivo:** Coletar informações necessárias para migração de dados de telemetria de água e energia para o ecossistema MYIO (ThingsBoard + Ingestion API)

---

## Instruções de Preenchimento

Este formulário deve ser preenchido pelo cliente antes do início do projeto de migração. As informações coletadas permitirão à equipe MYIO:

1. Dimensionar a infraestrutura necessária
2. Planejar a estratégia de migração
3. Mapear os dados de origem para o modelo MYIO
4. Definir cronograma realista
5. Identificar riscos e dependências

**Legenda:**
- 🔴 **Obrigatório** - Informação essencial para a migração
- 🟡 **Importante** - Informação que impacta o planejamento
- 🟢 **Opcional** - Informação complementar

---

# PARTE 1: IDENTIFICAÇÃO DO PROJETO

## 1.1 Informações do Cliente

| Campo | Valor |
|-------|-------|
| **Nome da Empresa** 🔴 | |
| **CNPJ** 🔴 | |
| **Responsável Técnico** 🔴 | |
| **E-mail** 🔴 | |
| **Telefone** 🔴 | |
| **Responsável de Negócio** 🟡 | |

## 1.2 Escopo do Projeto

| Campo | Valor |
|-------|-------|
| **Nome do Projeto** 🔴 | |
| **Data desejada de início** 🔴 | |
| **Data desejada de conclusão** 🔴 | |
| **Ambiente de destino** 🔴 | [ ] Produção [ ] Homologação [ ] Ambos |

---

# PARTE 2: REQUISITOS FUNCIONAIS

## 2.1 Tipos de Dados a Migrar

> **Instruções:** Marque todos os tipos de dados que serão migrados e preencha as informações específicas.

### 2.1.1 Dados de Energia

| Campo | Valor | Exemplo |
|-------|-------|---------|
| **Migrar dados de energia?** 🔴 | [ ] Sim [ ] Não | |
| **Tipo de medição** 🔴 | [ ] Consumo acumulado (kWh) [ ] Potência instantânea (kW) [ ] Ambos | Consumo acumulado |
| **Inclui energia reativa?** 🟡 | [ ] Sim [ ] Não | |
| **Inclui demanda?** 🟡 | [ ] Sim [ ] Não | |
| **Inclui fator de potência?** 🟡 | [ ] Sim [ ] Não | |
| **Unidade de medida** 🔴 | | kWh, MWh, Wh |
| **Precisão decimal** 🔴 | | 2 casas decimais |

**Campos adicionais de energia (listar):**
```
Exemplo:
- tensao_fase_a (V)
- tensao_fase_b (V)
- tensao_fase_c (V)
- corrente_fase_a (A)
- thd_tensao (%)
```

### 2.1.2 Dados de Água

| Campo | Valor | Exemplo |
|-------|-------|---------|
| **Migrar dados de água?** 🔴 | [ ] Sim [ ] Não | |
| **Tipo de medição** 🔴 | [ ] Volume acumulado [ ] Vazão instantânea [ ] Ambos | Volume acumulado |
| **Unidade de medida** 🔴 | | m³, litros |
| **Precisão decimal** 🔴 | | 6 casas decimais |
| **Suporta múltiplos canais?** 🟡 | [ ] Sim [ ] Não | Hidrômetros com pulso |

**Campos adicionais de água (listar):**
```
Exemplo:
- pressao (bar)
- temperatura_agua (°C)
- qualidade_agua (índice)
```

### 2.1.3 Dados de Temperatura (se aplicável)

| Campo | Valor | Exemplo |
|-------|-------|---------|
| **Migrar dados de temperatura?** 🔴 | [ ] Sim [ ] Não | |
| **Unidade de medida** 🔴 | | °C, °F |
| **Inclui setpoint?** 🟡 | [ ] Sim [ ] Não | |
| **Inclui umidade?** 🟡 | [ ] Sim [ ] Não | |

---

## 2.2 Hierarquia de Entidades

> **Instruções:** Descreva a estrutura organizacional dos dados. O MYIO usa a hierarquia: Customer → Asset → Device.

### 2.2.1 Estrutura Atual

**Desenhe ou descreva sua hierarquia atual:**
```
Exemplo do cliente:
├── Empresa (tenant)
│   ├── Filial São Paulo
│   │   ├── Prédio A
│   │   │   ├── Medidor 001
│   │   │   ├── Medidor 002
│   │   ├── Prédio B
│   │       ├── Medidor 003
│   ├── Filial Rio
│       ├── Prédio C
│           ├── Medidor 004
```

**Sua hierarquia:**
```
[Preencher aqui]
```

### 2.2.2 Mapeamento para MYIO

| Nível Origem | Nível MYIO | Exemplo |
|--------------|------------|---------|
| | **Customer** (cliente/shopping) | Shopping Iguatemi |
| | **Asset** (ativo/andar/área) | Torre A - Piso 1 |
| | **Device** (dispositivo/medidor) | Medidor 3F #001 |

---

## 2.3 Identificadores

> **⚠️ CRÍTICO:** Os identificadores são usados para vincular leituras aos dispositivos. Devem ser únicos e consistentes.

| Campo | Valor | Exemplo |
|-------|-------|---------|
| **Formato do ID do dispositivo** 🔴 | | UUID, código interno, serial |
| **ID é único globalmente?** 🔴 | [ ] Sim [ ] Não | |
| **ID pode mudar ao longo do tempo?** 🔴 | [ ] Sim [ ] Não | |
| **Existe ID secundário?** 🟡 | | Número de série do fabricante |

**Exemplo de IDs do sistema origem:**
```
Exemplo:
- device_id: "MED-001-SP-TORRE-A"
- gateway_id: "GW-SP-001"
- slave_id: 1 (endereço Modbus)
```

**Seus IDs:**
```
[Preencher aqui]
```

---

## 2.4 Período de Dados Históricos

| Campo | Valor | Exemplo |
|-------|-------|---------|
| **Data inicial dos dados** 🔴 | | 2023-01-01 |
| **Data final dos dados** 🔴 | | 2026-02-13 (até hoje) |
| **Período total** 🔴 | | 3 anos e 1 mês |
| **Existem gaps (lacunas)?** 🔴 | [ ] Sim [ ] Não | |
| **Se sim, períodos com gaps:** 🟡 | | Mar/2024 - sistema fora do ar |

---

## 2.5 Requisitos de Continuidade

> **Instruções:** Após a migração histórica, como os novos dados serão enviados?

| Campo | Valor |
|-------|-------|
| **Método de envio contínuo** 🔴 | [ ] API REST [ ] MQTT [ ] Ambos [ ] Não aplicável |
| **Frequência de envio** 🔴 | [ ] Real-time [ ] A cada X minutos [ ] Batch diário |
| **Se batch, horário preferencial** 🟡 | |

---

# PARTE 3: REQUISITOS NÃO FUNCIONAIS

## 3.1 Volume de Dados

> **⚠️ CRÍTICO:** O volume de dados impacta diretamente o tempo de migração e custos de armazenamento.

### 3.1.1 Quantidade de Entidades

| Métrica | Quantidade | Notas |
|---------|------------|-------|
| **Total de Customers** 🔴 | | Ex: 15 shoppings |
| **Total de Assets** 🔴 | | Ex: 150 andares/áreas |
| **Total de Devices de Energia** 🔴 | | Ex: 500 medidores |
| **Total de Devices de Água** 🔴 | | Ex: 200 hidrômetros |
| **Total de Devices de Temperatura** 🟡 | | Ex: 100 sensores |

### 3.1.2 Volume de Leituras

| Métrica | Valor | Cálculo de Referência |
|---------|-------|----------------------|
| **Intervalo de coleta (energia)** 🔴 | | Ex: 15 min = 96 leituras/dia/device |
| **Intervalo de coleta (água)** 🔴 | | Ex: 1 hora = 24 leituras/dia/device |
| **Total estimado de registros** 🔴 | | Ver cálculo abaixo |

**Calculadora de Volume:**
```
Energia:
- 500 devices × 96 leituras/dia × 365 dias × 3 anos = 52.560.000 registros

Água:
- 200 devices × 24 leituras/dia × 365 dias × 3 anos = 5.256.000 registros

Total estimado: ~58 milhões de registros
```

**Seu cálculo:**
```
Energia:
- ___ devices × ___ leituras/dia × ___ dias = ___ registros

Água:
- ___ devices × ___ leituras/dia × ___ dias = ___ registros

Total estimado: ___ registros
```

### 3.1.3 Tamanho Estimado

| Métrica | Valor |
|---------|-------|
| **Tamanho atual do banco origem** 🔴 | Ex: 50 GB |
| **Tamanho dos arquivos de exportação** 🔴 | Ex: 30 GB (CSV comprimido) |
| **Taxa de crescimento mensal** 🟡 | Ex: 500 MB/mês |

---

## 3.2 Qualidade dos Dados

> **⚠️ IMPORTANTE:** Problemas de qualidade podem inviabilizar ou atrasar a migração.

| Verificação | Status | Detalhes |
|-------------|--------|----------|
| **Existem valores nulos?** 🔴 | [ ] Sim [ ] Não | Onde? |
| **Existem valores negativos?** 🔴 | [ ] Sim [ ] Não | Esperado? |
| **Existem valores absurdos?** 🔴 | [ ] Sim [ ] Não | Ex: consumo > 1 GWh/h |
| **Timestamps estão em UTC?** 🔴 | [ ] Sim [ ] Não | Qual timezone? |
| **Existem duplicatas?** 🔴 | [ ] Sim [ ] Não | Critério de identificação? |
| **Dados estão normalizados?** 🟡 | [ ] Sim [ ] Não | |

**Regras de limpeza necessárias:**
```
Exemplo:
- Remover leituras com value = NULL
- Converter timestamps de BRT para UTC
- Remover duplicatas por (device_id, timestamp)
- Ignorar valores > 10000 kWh/h (erro de medição)
```

**Suas regras:**
```
[Preencher aqui]
```

---

## 3.3 Requisitos de Performance

| Requisito | Valor Esperado |
|-----------|----------------|
| **Tempo máximo de migração** 🔴 | Ex: 72 horas |
| **Janela de manutenção disponível** 🔴 | Ex: Sábado 22h - Domingo 18h |
| **Downtime aceitável** 🔴 | Ex: 0 (migração em paralelo) |
| **Latência máxima para consultas** 🟡 | Ex: < 2 segundos |

---

## 3.4 Requisitos de Segurança

| Requisito | Resposta |
|-----------|----------|
| **Dados contêm informações sensíveis?** 🔴 | [ ] Sim [ ] Não |
| **Requer criptografia em trânsito?** 🔴 | [ ] Sim [ ] Não |
| **Requer criptografia em repouso?** 🟡 | [ ] Sim [ ] Não |
| **Requer VPN para transferência?** 🟡 | [ ] Sim [ ] Não |
| **Compliance necessário** 🟡 | [ ] LGPD [ ] ISO 27001 [ ] SOC2 [ ] Outro: |
| **Retenção mínima dos dados** 🟡 | Ex: 5 anos |

---

# PARTE 4: DICIONÁRIO DE DADOS

## 4.1 Formato de Exportação

| Campo | Valor |
|-------|-------|
| **Formato de arquivo** 🔴 | [ ] CSV [ ] JSON [ ] Parquet [ ] SQL dump [ ] Outro: |
| **Encoding** 🔴 | [ ] UTF-8 [ ] Latin1 [ ] Outro: |
| **Delimitador (se CSV)** 🔴 | [ ] Vírgula [ ] Ponto-e-vírgula [ ] Tab |
| **Compressão** 🟡 | [ ] Nenhuma [ ] GZIP [ ] ZIP [ ] Outro: |

---

## 4.2 Schema de Dados - Energia

> **Instruções:** Preencha com os campos do seu sistema. Na coluna "Mapeamento MYIO", indicaremos o campo correspondente.

| Campo Origem | Tipo | Exemplo | Obrigatório | Mapeamento MYIO |
|--------------|------|---------|-------------|-----------------|
| | | | | `gateway_id` |
| | | | | `slave_id` |
| | | | | `timestamp` |
| | | | | `value` (kWh) |
| | | | | `value_reactive` (kVArh) |

**Exemplo preenchido:**
| Campo Origem | Tipo | Exemplo | Obrigatório | Mapeamento MYIO |
|--------------|------|---------|-------------|-----------------|
| `medidor_id` | VARCHAR(50) | "MED-001" | Sim | `gateway_id` + `slave_id` |
| `data_leitura` | DATETIME | "2025-06-15 14:30:00" | Sim | `timestamp` |
| `consumo_kwh` | DECIMAL(15,2) | 125.50 | Sim | `value` |
| `consumo_kvarh` | DECIMAL(15,2) | 45.20 | Não | `value_reactive` |
| `tenant_id` | INT | 1 | Sim | (usado para filtro) |

**Seus campos de energia:**
| Campo Origem | Tipo | Exemplo | Obrigatório | Mapeamento MYIO |
|--------------|------|---------|-------------|-----------------|
| | | | | |
| | | | | |
| | | | | |
| | | | | |

---

## 4.3 Schema de Dados - Água

| Campo Origem | Tipo | Exemplo | Obrigatório | Mapeamento MYIO |
|--------------|------|---------|-------------|-----------------|
| | | | | `gateway_id` |
| | | | | `slave_id` |
| | | | | `channel` |
| | | | | `timestamp` |
| | | | | `value` (m³) |

**Exemplo preenchido:**
| Campo Origem | Tipo | Exemplo | Obrigatório | Mapeamento MYIO |
|--------------|------|---------|-------------|-----------------|
| `hidrometro_id` | VARCHAR(50) | "HID-001" | Sim | `gateway_id` + `slave_id` |
| `canal` | INT | 1 | Não | `channel` (default: 1) |
| `data_leitura` | TIMESTAMP | "2025-06-15T14:30:00-03:00" | Sim | `timestamp` |
| `volume_m3` | DECIMAL(15,6) | 10.123456 | Sim | `value` |

**Seus campos de água:**
| Campo Origem | Tipo | Exemplo | Obrigatório | Mapeamento MYIO |
|--------------|------|---------|-------------|-----------------|
| | | | | |
| | | | | |
| | | | | |

---

## 4.4 Schema de Dados - Dispositivos (Cadastro)

> **Instruções:** Além das leituras, precisamos do cadastro dos dispositivos.

| Campo Origem | Tipo | Exemplo | Mapeamento MYIO |
|--------------|------|---------|-----------------|
| | | | `Device.id` |
| | | | `Device.name` |
| | | | `Device.deviceType` |
| | | | `Device.gatewayId` |
| | | | `Device.slaveId` |
| | | | `Asset.id` (relacionamento) |
| | | | `Customer.id` (relacionamento) |

---

## 4.5 Exemplo de Arquivo

> **Instruções:** Anexe ou cole um exemplo do arquivo de exportação (primeiras 10-20 linhas).

**Exemplo esperado (CSV energia):**
```csv
medidor_id,data_leitura,consumo_kwh,consumo_kvarh,tenant_id
MED-001,2025-06-15 14:00:00,125.50,45.20,1
MED-001,2025-06-15 14:15:00,126.10,45.50,1
MED-001,2025-06-15 14:30:00,126.80,45.80,1
MED-002,2025-06-15 14:00:00,89.30,32.10,1
MED-002,2025-06-15 14:15:00,89.90,32.40,1
```

**Seu exemplo:**
```
[Colar exemplo aqui]
```

---

# PARTE 5: INFRAESTRUTURA E CONECTIVIDADE

## 5.1 Sistema de Origem

| Campo | Valor |
|-------|-------|
| **Tipo de banco de dados** 🔴 | [ ] PostgreSQL [ ] MySQL [ ] SQL Server [ ] Oracle [ ] MongoDB [ ] Outro: |
| **Versão** 🟡 | |
| **Hospedagem** 🔴 | [ ] On-premise [ ] AWS [ ] Azure [ ] GCP [ ] Outro: |
| **Acesso remoto disponível?** 🔴 | [ ] Sim [ ] Não |
| **Credenciais serão fornecidas?** 🔴 | [ ] Sim [ ] Não (cliente exporta) |

## 5.2 Método de Transferência

| Opção | Selecionado | Detalhes |
|-------|-------------|----------|
| **Exportação pelo cliente** | [ ] | Cliente gera arquivos e envia |
| **Acesso direto ao banco** | [ ] | MYIO conecta via VPN/SSH |
| **API do sistema origem** | [ ] | Sistema origem tem API REST |
| **Replicação de banco** | [ ] | CDC (Change Data Capture) |

## 5.3 Para Integração Contínua (pós-migração)

| Campo | Valor |
|-------|-------|
| **IP(s) de origem para whitelist** 🔴 | |
| **Protocolo preferido** 🔴 | [ ] HTTPS (API REST) [ ] MQTT [ ] MQTTS |
| **Autenticação** 🔴 | [ ] API Key [ ] OAuth2 [ ] Certificado mTLS |
| **Frequência de envio** 🔴 | |

---

# PARTE 6: PONTOS DE ATENÇÃO

## 6.1 Riscos Identificados pelo Cliente

> **Instruções:** Liste quaisquer riscos ou preocupações que você identifica.

```
Exemplo:
1. Sistema origem tem alta carga durante horário comercial
2. Alguns medidores foram substituídos e têm IDs diferentes
3. Houve mudança de fuso horário em 2024
4. Dados de Jan/2025 estão corrompidos
```

**Seus riscos:**
```
[Preencher aqui]
```

## 6.2 Dependências

> **Instruções:** Liste sistemas, pessoas ou processos dos quais a migração depende.

| Dependência | Responsável | Impacto |
|-------------|-------------|---------|
| Exemplo: Aprovação do DBA | João Silva | Bloqueante |
| Exemplo: VPN configurada | TI Cliente | Bloqueante |
| | | |
| | | |

## 6.3 Restrições

| Restrição | Detalhes |
|-----------|----------|
| **Horários proibidos para carga** | Ex: Seg-Sex 8h-18h |
| **Limite de banda** | Ex: 100 Mbps |
| **Ordem de migração obrigatória** | Ex: Primeiro energia, depois água |
| **Ambientes que não podem ser afetados** | Ex: Produção durante migração |

---

# PARTE 7: VALIDAÇÃO E ACEITE

## 7.1 Critérios de Aceite

> **Instruções:** Defina como saberemos que a migração foi bem-sucedida.

| Critério | Métrica | Aceitável |
|----------|---------|-----------|
| **Completude** | % de registros migrados | > 99.9% |
| **Integridade** | Soma de consumo origem vs destino | Diferença < 0.1% |
| **Consistência** | Contagem por device | 100% match |
| **Disponibilidade** | Dados acessíveis via API | 100% |

## 7.2 Testes de Validação

| Teste | Descrição | Responsável |
|-------|-----------|-------------|
| **Contagem de registros** | Total origem = Total destino | MYIO |
| **Soma de valores** | Σ kWh origem ≈ Σ kWh destino | MYIO |
| **Amostragem** | 100 registros aleatórios verificados | Cliente |
| **Consulta de período** | Dados de 1 mês específico conferidos | Cliente |

## 7.3 Rollback

| Campo | Valor |
|-------|-------|
| **Plano de rollback necessário?** | [ ] Sim [ ] Não |
| **Backup do sistema origem obrigatório?** | [ ] Sim [ ] Não |
| **Tempo máximo para rollback** | Ex: 24 horas |

---

# PARTE 8: CRONOGRAMA SUGERIDO

## 8.1 Fases do Projeto

| Fase | Atividades | Duração Estimada |
|------|------------|------------------|
| **1. Análise** | Revisão do formulário, reunião de alinhamento | 1 semana |
| **2. Preparação** | Setup de ambiente, scripts de transformação | 1-2 semanas |
| **3. Migração Piloto** | 1 mês de dados, 10% dos devices | 1 semana |
| **4. Validação Piloto** | Testes de aceite no piloto | 3 dias |
| **5. Migração Completa** | Todos os dados históricos | 1-4 semanas* |
| **6. Validação Final** | Testes de aceite completos | 1 semana |
| **7. Go-Live** | Início da integração contínua | 1 dia |

*Depende do volume de dados

## 8.2 Disponibilidade do Cliente

| Recurso | Disponibilidade |
|---------|-----------------|
| **Responsável técnico para dúvidas** | |
| **Acesso ao sistema origem** | |
| **Janela para testes** | |

---

# PARTE 9: ASSINATURAS

## 9.1 Aprovação do Cliente

| Campo | Valor |
|-------|-------|
| **Nome** | |
| **Cargo** | |
| **Data** | |
| **Assinatura** | |

## 9.2 Aprovação MYIO

| Campo | Valor |
|-------|-------|
| **Analista Responsável** | |
| **Data de Recebimento** | |
| **Data de Análise** | |
| **Status** | [ ] Aprovado [ ] Pendências [ ] Reprovado |

**Pendências identificadas:**
```
[A ser preenchido pela equipe MYIO]
```

---

# ANEXOS

## Anexo A: Formatos de Timestamp Aceitos

| Formato | Exemplo | Status |
|---------|---------|--------|
| ISO 8601 com timezone | `2025-06-15T14:30:00-03:00` | ✅ Preferido |
| ISO 8601 UTC | `2025-06-15T17:30:00Z` | ✅ Aceito |
| ISO 8601 sem timezone | `2025-06-15T14:30:00` | ⚠️ Requer informar timezone |
| Unix timestamp (segundos) | `1718461800` | ✅ Aceito |
| Unix timestamp (milissegundos) | `1718461800000` | ✅ Aceito |
| Formato brasileiro | `15/06/2025 14:30:00` | ⚠️ Requer conversão |

## Anexo B: Limites do Sistema MYIO

| Recurso | Limite | Notas |
|---------|--------|-------|
| Registros por batch (API) | 10.000 | Dividir arquivos maiores |
| Requisições por minuto (Light) | 120 | Endpoints de device individual |
| Requisições por minuto (Heavy) | 20 | Endpoints de agregação |
| Tamanho máximo de payload | 10 MB | Comprimir se necessário |
| Retenção de dados | Ilimitada | Conforme contrato |

## Anexo C: Contatos MYIO

| Área | Contato |
|------|---------|
| **Suporte Técnico** | suporte@myio.com.br |
| **Arquitetura** | arquitetura@myio.com.br |
| **Comercial** | comercial@myio.com.br |

---

## Checklist Final

Antes de enviar, verifique:

- [ ] Todas as seções obrigatórias (🔴) foram preenchidas
- [ ] Dicionário de dados completo com exemplos
- [ ] Arquivo de exemplo anexado
- [ ] Volume de dados estimado
- [ ] Critérios de aceite definidos
- [ ] Responsáveis identificados

---

**Enviar formulário preenchido para:** migracao@myio.com.br

**Assunto:** [MIGRAÇÃO] {Nome da Empresa} - Formulário de Requisitos
