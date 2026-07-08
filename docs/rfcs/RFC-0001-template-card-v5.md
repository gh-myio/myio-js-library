# RFC 0001: Template Card v5 Component

- Feature Name: `template-card-v5`
- Start Date: 2025-10-28
- RFC PR: (to be assigned)
- Status: **Draft**

---

## Summary

Esta RFC propõe a criação de um novo componente `template-card-v5` para o dashboard v5.2.0, baseado no `template-card-v2.js` existente, com melhorias na UI/UX focadas em reduzir elementos visuais laterais e otimizar o espaçamento da imagem do dispositivo.

---

## Motivation

O componente atual `template-card-v2` apresenta alguns pontos que podem ser melhorados para a versão 5.2.0:

1. **Redução de Complexidade Visual**: O ícone de informações na lateral do card cria um elemento adicional que pode ser consolidado dentro da modal de configurações, simplificando a interface.

2. **Otimização de Espaçamento**: O gap atual da imagem do dispositivo (tanto superior quanto inferior) pode ser reduzido para melhor aproveitamento do espaço vertical do card.

3. **Consistência com a Versão 5.2.0**: Alinhar o componente de card com os padrões e diretrizes de design da nova versão do dashboard.

---

## Guide-level explanation

### Visão Geral

O `template-card-v5` será um componente de card moderno e limpo que exibe informações de dispositivos IoT no dashboard principal. Ele mantém a funcionalidade core do v2, mas com melhorias visuais estratégicas.

### Principais Mudanças

#### 1. Remoção do Ícone de Informações Lateral

**Antes (v2):**
```javascript
// Info button na lateral do card (piano-key actions)
const infoBtn = document.createElement('button');
infoBtn.className = 'card-action action-info';
infoBtn.title = 'Informações';
infoBtn.innerHTML = 'ℹ️';
actionsContainer.appendChild(infoBtn);
```

**Depois (v5):**
```javascript
// Info será integrado dentro da modal de configurações
// Não haverá botão de info na lateral
// A função handInfo será deprecada ou movida para handleActionSettings
```

**Impacto para o Usuário:**
- Interface mais limpa com menos botões laterais
- Informações de conexão e telemetria acessíveis através do botão de configurações
- Redução de 1 botão no "piano-key actions" (de 4 para 3 botões típicos)

#### 2. Redução do Gap da Imagem

**Antes (v2):**
```css
.device-card-centered .device-image {
  max-height: 47px !important;
  width: auto;
  margin: 10px 0 !important;  /* Gap de 10px superior e inferior */
}
```

**Depois (v5):**
```css
.device-card-centered .device-image {
  max-height: 47px !important;
  width: auto;
  margin: 4px 0 !important;  /* Gap reduzido para 4px */
}
```

**Impacto para o Usuário:**
- Card visualmente mais compacto
- Melhor densidade de informação
- Mais cards visíveis na viewport sem scroll

#### 3. Redução de Fontes e Compactação do Valor de Consumo

**Antes (v2):**
```css
.consumption-main {
  padding: 7px 10px;
  margin-top: 7px;
  border-radius: 10px;
}

.consumption-value {
  font-size: 0.9rem;
}

.device-title-percent {
  font-size: 0.72rem;
}

.flash-icon {
  font-size: 1rem;
  margin-right: 7px;
}
```

**Depois (v5):**
```css
.consumption-main {
  padding: 4px 8px;      /* Reduzido ~43% */
  margin-top: 5px;       /* Reduzido ~29% */
  border-radius: 8px;    /* Reduzido 20% */
}

.consumption-value {
  font-size: 0.75rem;    /* Reduzido ~17% */
}

.device-title-percent {
  font-size: 0.65rem;    /* Reduzido ~10% */
}

.flash-icon {
  font-size: 0.85rem;    /* Reduzido 15% */
  margin-right: 5px;     /* Reduzido ~29% */
}
```

**Impacto para o Usuário:**
- Quadrado verde de consumo mais compacto e discreto
- Melhor legibilidade em telas menores
- Mais espaço visual para outros elementos do card
- Hierarquia visual melhorada (título mais proeminente que valor)

---

## Reference-level explanation

### Estrutura de Arquivos

```
src/thingsboard/main-dashboard-shopping/v-5.2.0/
├── card/
│   ├── template-card-v5.js      # Novo componente principal
│   └── template-card-v5.css     # Estilos isolados (opcional)
```

### Assinatura da Função

```javascript
/**
 * Renders an enhanced device card component for v5.2.0 dashboard
 *
 * @param {Object} config - Configuration object
 * @param {Object} config.entityObject - Entity data
 * @param {Function} config.handleActionDashboard - Dashboard action handler
 * @param {Function} config.handleActionReport - Report action handler
 * @param {Function} config.handleActionSettings - Settings action handler (includes info)
 * @param {Function} config.handleSelect - Selection handler
 * @param {Function} config.handleClickCard - Card click handler
 * @param {boolean} [config.useNewComponents=true] - Enable new component features
 * @param {boolean} [config.enableSelection=true] - Enable selection functionality
 * @param {boolean} [config.enableDragDrop=true] - Enable drag and drop
 * @returns {Object} jQuery-like object with card element
 *
 * @deprecated config.handInfo - No longer used; info moved to settings modal
 */
export function renderCardComponentV5({
  entityObject,
  handleActionDashboard,
  handleActionReport,
  handleActionSettings,
  handleSelect,
  handleClickCard,
  useNewComponents = true,
  enableSelection = true,
  enableDragDrop = true,
}) {
  // Implementation
}
```

### Mudanças no CSS

#### Piano-Key Actions (Reduzido para 3 botões)

```css
.device-card-centered .card-actions {
  /* Mantém a estrutura atual, mas com menos height necessário */
  position: absolute;
  left: 12px;
  top: 12px;
  bottom: 12px;
  /* ... resto permanece igual ... */
}

.device-card-centered .card-action {
  width: 36px !important;
  height: 36px !important;
  /* Agora teremos tipicamente 3 botões ao invés de 4 */
}
```

#### Espaçamento da Imagem Otimizado

```css
.device-card-centered .device-image {
  max-height: 47px !important;
  width: auto;
  margin: 4px 0 !important;  /* Reduzido de 10px para 4px */
  display: block;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.1));
  transition: all 0.3s ease;
  border-radius: 7px;
}
```

#### Ajuste da Altura Mínima do Card

```css
.device-card-centered.clickable {
  /* ... */
  min-height: 114px !important;  /* Reduzido de 126px para 114px */
  /* ... */
}
```

#### Compactação do Valor de Consumo

```css
.device-card-centered .consumption-main {
  border-radius: 8px;        /* Reduzido de 10px */
  padding: 4px 8px;          /* Reduzido de 7px 10px */
  margin-top: 5px;           /* Reduzido de 7px */
}

.device-card-centered .consumption-value {
  font-size: 0.75rem !important;  /* Reduzido de 0.9rem */
}

.device-card-centered .device-title-percent {
  font-size: 0.65rem !important;  /* Reduzido de 0.72rem */
}

.device-card-centered .flash-icon {
  font-size: 0.85rem !important;  /* Reduzido de 1rem */
  margin-right: 5px;              /* Reduzido de 7px */
}
```

### Modal de Configurações Estendida

A modal de configurações deverá incluir uma nova seção "Informações de Conexão":

```javascript
function renderSettingsModal(entityObject) {
  return `
    <div class="settings-modal">
      <div class="settings-section">
        <h3>Configurações</h3>
        <!-- Configurações existentes -->
      </div>

      <div class="settings-section info-section">
        <h3>Informações de Conexão</h3>
        <div class="info-content">
          <strong>Central:</strong> ${centralName || 'N/A'}<br>
          <strong>Última Conexão:</strong> ${connectionStatusTime}<br>
          <strong>Última Telemetria:</strong> ${timeVal}<br>
        </div>
      </div>
    </div>
  `;
}
```

---

## Drawbacks

1. **Breaking Change**: A remoção do parâmetro `handInfo` pode quebrar código existente que depende dessa funcionalidade.
   - **Mitigação**: Manter compatibilidade retroativa com warning de deprecação.

2. **Menos Acesso Direto às Informações**: Usuários precisarão abrir a modal de configurações para ver informações de conexão.
   - **Mitigação**: A redução de clutter visual compensa o clique extra; informações ainda facilmente acessíveis.

3. **Espaçamento Reduzido Pode Afetar Legibilidade**: Em alguns casos, menos espaço pode prejudicar a clareza visual.
   - **Mitigação**: Testes de usabilidade devem validar que 4px é suficiente; ajustar se necessário.

---

## Rationale and alternatives

### Por que esta abordagem?

1. **Simplicidade Visual**: Remover elementos desnecessários é preferível a adicionar mais complexidade.
2. **Eficiência de Espaço**: Dashboards IoT frequentemente mostram dezenas ou centenas de cards; cada pixel conta.
3. **Consolidação Lógica**: Informações de configuração e status naturalmente pertencem à mesma interface.

### Alternativas Consideradas

#### Alternativa 1: Manter Info Button mas Reduzi-lo
- Manter o botão de info, mas torná-lo menor ou usar um ícone diferente.
- **Rejeitado**: Ainda adiciona complexidade visual; não resolve o problema core.

#### Alternativa 2: Info como Tooltip no Status Indicator
- Mostrar informações ao passar o mouse sobre o indicador de status.
- **Rejeitado**: Tooltips não são ideais para informações densas; acessibilidade limitada em mobile.

#### Alternativa 3: Criar uma Versão Expandida do Card
- Cards poderiam expandir para mostrar mais informações.
- **Rejeitado**: Aumenta complexidade de implementação; dificulta visualização geral do dashboard.

### Por que não fazer nada?

O template-card-v2 funciona, mas não aproveita oportunidades de melhoria para a v5.2.0. A evolução incremental mantém o código base moderno e alinhado com as melhores práticas.

---

## Prior art

### Referências de Design

1. **Material Design Cards**: Google's Material Design usa espaçamento compacto para maximizar densidade de informação.
2. **ThingsBoard Dashboard Widgets**: Outros widgets do ThingsBoard seguem o padrão de consolidar informações em modais.
3. **Azure IoT Central**: Usa cards compactos com informações detalhadas acessíveis via clique.

### Componentes Relacionados no Projeto

- `DraggableCard.js`: Fornece funcionalidade de drag-and-drop.
- `SelectionStore.js`: Gerencia seleção múltipla de cards.
- `deviceStatus.js`: Utilitários para status de dispositivos.

---

## Unresolved questions

1. **Integração com Modal de Configurações**:
   - Como exatamente as informações de conexão serão estruturadas dentro da modal?
   - Haverá uma aba separada ou será parte da view principal?

2. **Compatibilidade Retroativa**:
   - Devemos manter `handInfo` como deprecated ou removê-lo completamente?
   - Quanto tempo de suporte para a versão antiga?

3. **Responsividade**:
   - O gap reduzido (4px) funciona bem em todas as resoluções?
   - Precisamos de breakpoints específicos para mobile?

4. **Terceira Mudança**:
   - Qual é a terceira diferença mencionada na proposta inicial?
   - Há outras melhorias visuais ou funcionais a considerar?

5. **Performance**:
   - A remoção do info panel overlay melhora a performance de renderização?
   - Há métricas específicas a serem monitoradas?

---

## Future possibilities

### Melhorias de Curto Prazo (v5.2.x)

1. **Temas Customizáveis**: Permitir que usuários escolham esquemas de cores para os cards.
2. **Layouts Alternativos**: Modo compacto vs. modo detalhado para diferentes casos de uso.
3. **Animações Melhoradas**: Transições mais suaves ao interagir com os cards.

### Melhorias de Longo Prazo (v6.0+)

1. **Cards Inteligentes**: Ajuste automático de layout baseado no tipo de dispositivo.
2. **Visualizações Inline**: Mini-gráficos ou sparklines diretamente no card.
3. **Acessibilidade Aprimorada**: Melhor suporte para leitores de tela e navegação por teclado.
4. **Customização por Usuário**: Permitir que usuários escolham quais ações aparecem nos piano-keys.

### Integração com Outros Componentes

- **Widget de Comparação**: Seleção de cards poderia alimentar automaticamente um widget de comparação.
- **Dashboard Builder**: Drag-and-drop de cards para criar dashboards personalizados.
- **Alertas Contextuais**: Cards poderiam mostrar alertas específicos do dispositivo.

---

## Implementation plan

### Fase 1: Preparação (Semana 1)
- [ ] Criar estrutura de arquivos em `v-5.2.0/card/`
- [ ] Copiar `template-card-v2.js` como base
- [ ] Configurar ambiente de desenvolvimento

### Fase 2: Implementação Core (Semanas 2-3)
- [ ] Remover lógica do info panel
- [ ] Atualizar CSS para gap reduzido da imagem
- [ ] Ajustar altura mínima do card
- [ ] Atualizar piano-key actions (remover info button)

### Fase 3: Integração com Modal (Semana 4)
- [ ] Estender `handleActionSettings` para incluir informações
- [ ] Criar UI da seção de info na modal
- [ ] Implementar formatação de dados de conexão

### Fase 4: Testes e Refinamento (Semana 5)
- [ ] Testes unitários
- [ ] Testes de integração com SelectionStore e DraggableCard
- [ ] Testes visuais em múltiplas resoluções
- [ ] Testes de acessibilidade

### Fase 5: Documentação e Migração (Semana 6)
- [ ] Documentação de API
- [ ] Guia de migração de v2 para v5
- [ ] Atualizar exemplos e demos
- [ ] Preparar release notes

---

## Open questions for discussion

1. **Naming Convention**: Devemos usar `template-card-v5.js` ou `template-card.v5.2.0.js` para melhor versionamento?

2. **CSS Strategy**: Manter estilos inline (como em v2) ou extrair para arquivo `.css` separado?

3. **Info Panel Transition**: Fornecer uma camada de compatibilidade temporária para `handInfo`?

4. **Gap Value**: O valor de 4px foi sugerido, mas devemos fazer testes A/B com 5px, 6px?

5. **Testing Strategy**: Quais métricas de performance devemos monitorar? (FCP, LCP, TTI?)

---

## References

- [Template Card v2 Source](../src/thingsboard/main-dashboard-shopping/v-4.0.0/card/template-card-v2.js)
- [MyIO DraggableCard Component](../src/components/DraggableCard.js)
- [MyIO SelectionStore](../src/components/SelectionStore.js)
- [Device Status Utilities](../src/utils/deviceStatus.js)

---

**Document History:**
- 2025-10-28: Initial draft created
- _To be updated as RFC progresses_
