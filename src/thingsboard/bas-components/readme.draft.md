# Dashboard Operacional – Estrutura da Tela

## Visão Geral
Dashboard único para monitoramento predial integrando **água, energia e climatização**, com foco em **tempo quase real** e **acumulado do dia atual**.

Cada widget representa um **ativo físico real** do edifício.

---

## Layout Geral (Esquerda → Direita)

[ Andares ] | [ Infraestrutura Hídrica ] | [ Ambientes ] | [ Bombas e Motores ]
                  ↓
            [ Gráficos do Dia Atual ]

---

## Blocos e Widgets

### Andares (Sidebar)
- Lista de pavimentos (01º, 02º, 03º…)
- Função: **filtro de contexto**
- Impacta:
  - Ambientes
  - Equipamentos
  - Gráficos

---

### Infraestrutura Hídrica (Topo Central)

**Hidr. Entrada Geral**
- Tipo: medidor
- Métrica: m³
- Escopo: dia atual (realtime)
- widget : SvgHidrometro

**Cisterna 01 / Cisterna 02**
- Métricas:
  - Percentual (%)
  - Altura
- Visual varia conforme nível
- widget: Water Level v2


**Caixa d’Água – Torre**
- Métricas:
  - Percentual (%)
  - Altura
- widget: Water Level v2


**Solenoide**
- Estado: ligado / desligado
- Representa controle hidráulico
- widget: Solenoide Sem On/Off V.2.0.1



**Hidr. Torre / Torre Água Refrigerada**
- Métrica: m³ (dia atual)
- widget: SvgHidrometro

---

### Ambientes (Coluna Direita)
- Cards por ambiente (ex: Térreo – Ar 01)
- Dados:
  - Temperatura (°C)
  - Consumo instantâneo (kW)
- Estados:
  - Ativo / inativo
  - Sem leitura (`--`)
- widget: Blinking Air List With Consumption and Temperature - v.3



---

### Bombas e Motores (Coluna Direita)
- Lista de equipamentos eletromecânicos
- Dado principal:
  - Consumo instantâneo (kW)
- Regra:
  - `0.00 kW` = desligado
-widget: Blinking status Motor List with link v3



---

### Gráficos (Rodapé)

**Temperatura – Dia Atual**
- Série temporal
- Todos os ambientes
- Eixo X: horas do dia
-widget: Time series chart


**Consumo – Dia Atual**
- Série temporal
- Indicadores:
  - Min
  - Max
  - Avg
  - Total
  - Latest
- widget: Time series chart


---

## Conceito Técnico
- Espelho digital da operação predial
- Uso principal:
  - Diagnóstico rápido
  - Operação diária
  - Base para alarmes e automações futuras

---

## Regras Implícitas
- Filtro por andar afeta widgets relacionados
- Estados nulos devem ser exibidos visualmente (`--`, cinza, ícone)
- Widgets devem suportar dados ausentes ou offline
Recolher






Victor Hugo
  11h27