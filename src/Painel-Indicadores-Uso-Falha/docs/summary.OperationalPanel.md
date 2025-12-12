# RFC-XXXX: Painel de Indicadores Operacionais – Escadas Rolantes e Elevadores

- **Status:** Draft
- **Autor:** MYIO
- **Data:** 2025-12-12
- **Stakeholders:** Operação, CME, Mecânica, CCM, Engenharia MYIO
- **Plataforma:** ThingsBoard + MYIO
- **Tipo:** MVP Operacional

---

## 1. Summary

Este RFC propõe a criação de um **Painel de Indicadores Operacionais** para escadas rolantes e elevadores, baseado em **cards modulares no ThingsBoard**, com foco em **disponibilidade, confiabilidade, qualidade elétrica e alertas automáticos**.

O MVP visa entregar visibilidade operacional em tempo real, com métricas consolidadas (**MTBF, MTTR, Disponibilidade %**), detecção de **eventos críticos** e **relatórios automáticos**, garantindo rápida tomada de decisão e melhoria contínua da operação.

---

## 2. Motivation

Atualmente, a operação de escadas rolantes e elevadores carece de:

- Visibilidade consolidada de desempenho;
- Indicadores confiáveis de disponibilidade e manutenção;
- Alertas automáticos em horários críticos;
- Histórico comparativo mensal de desempenho;
- Detecção automática de problemas elétricos, como inversão de fase.

Este projeto endereça essas lacunas, integrando telemetria elétrica e lógica operacional dentro do ecossistema MYIO.

---

## 3. Goals

### 3.1 Objetivos Funcionais

- Monitorar **Disponibilidade (%)** por equipamento e consolidado;
- Calcular **MTBF e MTTR em horas**;
- Exibir status **Online / Offline** em tempo real;
- Detectar **reversão de sentido** por inversão de fase;
- Gerar **alertas automáticos por e-mail**;
- Disponibilizar **relatórios diários (D-1)** e **mensais**.

### 3.2 Objetivos Não Funcionais

- Arquitetura modular e escalável;
- Baixo acoplamento entre cálculo, visualização e alertas;
- Compatibilidade total com ThingsBoard;
- Evolução futura sem quebra de contratos.

---

## 4. Non-Goals

- Predição de falhas via IA (fora do MVP);
- Integração direta com CMMS/ERP;
- Automação de acionamentos físicos;
- Interface pública externa.

---

## 5. Indicators Definition

### 5.1 Indicadores Operacionais

| Indicador           | Descrição                       |
| ------------------- | ------------------------------- |
| Disponibilidade (%) | Percentual de tempo operacional |
| MTBF (h)            | Tempo médio entre falhas        |
| MTTR (h)            | Tempo médio de reparo           |
| Status              | Online / Offline                |
| Reversão de Sentido | Detecção por inversão de fase   |

### 5.2 Indicadores Elétricos

| Indicador          | Descrição                 |
| ------------------ | ------------------------- |
| Frequência         | Qualidade da energia      |
| Tensão             | Fases R, S e T            |
| Corrente           | Fases R, S e T            |
| Potência           | Consumo vs carga nominal  |
| Consumo de Energia | Diário / Horário / Mensal |

---

## 6. Business Rules

### 6.1 Cálculos

**MTBF (horas)**
