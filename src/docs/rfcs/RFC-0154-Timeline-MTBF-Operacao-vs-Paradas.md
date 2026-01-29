# RFC — Timeline MTBF: Operação vs Paradas

## Contexto
Este documento propõe um layout ideal para o gráfico **Timeline MTBF – Operação vs Paradas**, com foco em transformar uma visualização ilustrativa em uma ferramenta gerencial clara, explicativa e acionável.

---

## Objetivo do Gráfico
O gráfico deve responder claramente às seguintes perguntas:
1. Quando ocorreram as falhas?
2. Quanto tempo os equipamentos ficaram operando vs parados?
3. Como o MTBF foi calculado no período selecionado?

---

## Estrutura Geral do Layout

```
┌────────────────────────────────────────────┐
│ Timeline MTBF – Operação vs Paradas         │
│ Período: 01/01/2026 → 31/01/2026            │
│ Equipamentos: 48 | Falhas: 3                │
├────────────────────────────────────────────┤
│                                            │
│  ON  ────────────────────────────────────  │
│      ████████████████  ████████████████    │
│      Operação (96h)     Operação (112h)     │
│          ↑ Falha 1           ↑ Falha 2      │
│                                            │
│  OFF        ▌▌                ▌             │
│           2h15              1h05            │
│                                            │
│  Tempo →  01/01   05/01   10/01   15/01      │
│                                            │
├────────────────────────────────────────────┤
│ MTBF do período: 145h                       │
│ MTBF = Tempo total operando / Nº falhas     │
└────────────────────────────────────────────┘
```

---

## Blocos de Operação (ON)

### Visual
- Cor: Amarelo ou verde suave
- Altura fixa
- Bordas arredondadas
- Representam intervalos reais de operação contínua

### Tooltip (obrigatório)
```
Operação
Início: 03/01 08:12
Fim: 07/01 16:30
Duração: 104h
Equipamentos ativos: 45/48
```

---

## Eventos de Falha / Parada (OFF)

### Visual
- Linha vertical vermelha ou ícone ⚠️
- Pequeno bloco horizontal abaixo da linha ON

### Tooltip
```
⚠️ Falha detectada
Data: 07/01 16:30
Tempo parado: 2h15
Equipamentos afetados: 3
Tipo: Elétrica
```

---

## Eixo do Tempo (X)
- Deve sempre representar tempo real
- Datas e horários claros
- Granularidade adaptativa:
  - Diário (30 dias)
  - Horário (7 dias)
  - Minuto (24h)

---

## Cálculo e Exibição do MTBF

Exibição clara e conectada visualmente ao gráfico:
```
MTBF = 435h de operação / 3 falhas
MTBF Médio do período: 145h
```

---

## Legenda Obrigatória
```
🟨 Operação
⛔ Falha / Parada
🔧 Manutenção
```

---

## Estados Especiais

### Nenhuma falha no período
```
✅ Nenhuma falha registrada neste período
MTBF tende ao infinito
```

### Dados insuficientes
```
⚠️ Dados insuficientes para calcular MTBF neste período
```

---

## Estrutura de Dados Sugerida (Frontend)

```ts
interface TimelineEvent {
  start: number; // timestamp
  end: number;   // timestamp
  type: 'ON' | 'OFF';
  durationHours: number;
  affectedEquipments?: number;
  reason?: string;
}
```

---

## Conexão com KPIs do Dashboard
Este gráfico deve explicar visualmente:
- MTBF Médio
- MTTR Médio
- Alertas ativos

Se não explicar os KPIs, o gráfico não cumpre sua função gerencial.

---

## Conclusão
O Timeline MTBF deve ser uma visualização explicativa, conectando eventos reais ao cálculo do indicador, e não apenas um elemento ilustrativo.

