## Feedback – Gráfico “Disponibilidade por Período”

### Avaliação Geral

Embora o gráfico apresente uma série temporal de disponibilidade, ele permanece **superficial e pouco analítico**. No estado atual, mostra variação visual, mas **não explica causas, impacto ou confiabilidade**, falhando em responder perguntas operacionais e executivas essenciais.

---

### Pontos Fracos Identificados

1. **Ambiguidade conceitual da métrica**
   - Não está claro:
     - Se a disponibilidade é diária, média do período ou instantânea.
     - Se representa todos os equipamentos ou apenas um subconjunto.
   - Falta definição explícita do cálculo (% baseada em MTBF/MTTR, uptime bruto, SLA, etc.).

2. **Escala visual enganosa**
   - O eixo Y começa em ~86%, o que **amplifica visualmente pequenas variações**.
   - Oscilações aparentam ser críticas, mas podem ser estatisticamente irrelevantes.

3. **Ausência de referências de qualidade**
   - Não há:
     - Linha de SLA (ex: 95%, 99%).
     - Média do período.
     - Faixa aceitável vs faixa crítica.
   - O leitor não sabe se os valores exibidos são bons ou ruins.

4. **Dados sem contexto de causa**
   - O gráfico mostra quedas, mas não responde:
     - O que causou a queda?
     - Quantos equipamentos impactaram?
     - Foi falha pontual ou recorrente?

5. **Datas pouco informativas**
   - O eixo X exibe apenas números (31, 05, 10…).
   - Não há indicação clara de:
     - Mês
     - Ano
     - Período analisado (ex: últimos 30 dias)

6. **Não orienta ação**
   - O gráfico não ajuda a decidir:
     - Se é necessário agir agora.
     - Se a tendência é de melhora ou degradação.
     - Onde priorizar investigação.

---

### Recomendações de Evolução

#### 1. Clareza Semântica

- Adicionar subtítulo explicativo:
  > “Disponibilidade média diária (%) calculada via MTBF/MTTR — últimos 30 dias”
- Documentar a fórmula usada (ou linkar para RFC correspondente).

#### 2. Referências Visuais

- Incluir:
  - Linha de SLA/meta (ex: 95%).
  - Linha de média do período.
- Usar cores para indicar:
  - Dentro da meta
  - Fora da meta

#### 3. Contexto Operacional

- Tooltips enriquecidos com:
  - Nº de falhas no dia
  - Tempo total de indisponibilidade
  - Equipamentos afetados

#### 4. Melhor uso do eixo Y

- Avaliar:
  - Escala de 0–100% para honestidade visual, ou
  - Faixas coloridas (verde / amarelo / vermelho) para interpretação imediata.

#### 5. Correlação com eventos

- Marcar visualmente:
  - Dias com falhas relevantes
  - Eventos externos (manutenção, clima, quedas de energia)
- Possibilidade de sobrepor markers de falha.

---

### Conclusão

O gráfico apresenta **variação sem explicação**.  
Para atender o nível de maturidade esperado pelo projeto, ele deve evoluir de uma simples série temporal para um **indicador confiável de saúde operacional**, capaz de sustentar análises, justificar decisões e dialogar com métricas como MTBF, MTTR e SLA.
