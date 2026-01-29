## Feedback – Card de Equipamento (Escada Rolante / Chiller)

### Avaliação Geral

O card apresenta boas métricas técnicas (Disponibilidade, MTBF, MTTR) e status claros, porém sofre com **má utilização de espaço**, **hierarquia visual inconsistente** e **header pouco aproveitado**. O resultado é um card informativo, mas visualmente fragmentado e menos premium do que poderia ser.

---

### Pontos de Problema Identificados

#### 1. Espaço em branco mal aproveitado

- Há excesso de área vazia entre:
  - Header e métricas
  - Métricas e rodapé
- O card parece “esticado” verticalmente sem ganho informacional.
- Isso reduz densidade visual e prejudica leitura em grid com muitos cards.

#### 2. Checkbox deslocado e sem hierarquia

- O checkbox atualmente não faz parte do header.
- Ele parece flutuar sem alinhamento semântico.
- Falta associação clara com:
  - Seleção
  - Ação em lote
  - Estado do card

#### 3. Header subutilizado

- O header poderia concentrar:
  - Nome do equipamento
  - Tipo
  - Status
  - Checkbox
- Hoje essas informações estão espalhadas, quebrando leitura em “Z”.

#### 4. Falta de fidelidade ao padrão de header recortado

- O design desejado (exemplo do card do _CHILLER_032_) mostra:
  - Header visualmente destacado
  - Conteúdo claramente separado
- O card atual não respeita essa divisão conceitual.

---

### Recomendações Objetivas de Ajuste

#### 1. Header recortado (obrigatório)

- Criar um header visual distinto contendo:
  - Nome do equipamento (ex: `ESC-15`)
  - Tipo (`Escada Rolante`)
  - Status (badge ONLINE / OFFLINE)
  - Checkbox **fixado no canto superior direito**
- O header deve funcionar como uma “barra de identidade” do card.

┌───────────────────────────────┐
│ ESC-15 ☐ │
│ Escada Rolante ● ONLINE │
└───────────────────────────────┘

#### 2. Checkbox no canto superior direito

- Alinhar o checkbox:
  - Top: 8–12px
  - Right: 8–12px
- O checkbox deve:
  - Fazer parte do header
  - Não competir com métricas
  - Ser consistente com seleção em grid

#### 3. Compactação do corpo do card

- Reduzir espaçamentos verticais entre:
  - Disponibilidade
  - MTBF / MTTR
- Priorizar layout mais denso:
  - Melhor escaneabilidade
  - Melhor uso em telas com muitos equipamentos

#### 4. Hierarquia visual clara

- Ordem sugerida:
  1. Header (identidade + status + seleção)
  2. Disponibilidade (anel / percentual)
  3. MTBF / MTTR (lado a lado)
  4. Alertas (quando existirem)
  5. Localização (rodapé discreto)

#### 5. Alinhamento com card de referência (Chiller)

- Usar o card do **CHILLER_032** como referência visual:
  - Header bem definido
  - Ações claras
  - Conteúdo compacto
- O objetivo é **padronização visual entre tipos de equipamento**.

---

### Resultado Esperado

Após os ajustes:

- O card terá leitura mais rápida
- O espaço será melhor aproveitado
- A seleção em massa ficará intuitiva
- O layout ficará coerente com o padrão premium do dashboard

---

### Conclusão

O problema não é falta de informação, e sim **distribuição visual**.  
Com a centralização do header, reposicionamento do checkbox e compactação do corpo, o card passa de “informativo” para **profissional, escaneável e consistente** com o design system esperado.
