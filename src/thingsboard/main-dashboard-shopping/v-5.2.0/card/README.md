# Template Card v5

Componente de card otimizado para o dashboard v5.2.0 com melhorias de espaçamento e interface mais limpa.

## Visão Geral

O `template-card-v5.js` é a evolução do `template-card-v2.js`, focado em:
- **UI mais limpa**: Remoção do botão de informações lateral
- **Melhor densidade**: Espaçamento otimizado da imagem do dispositivo
- **Integração aprimorada**: Informações de conexão movidas para modal de configurações

## Principais Mudanças vs v2

### 1. Remoção do Ícone de Informações Lateral

**v2:**
```javascript
// Tinha botão de info nos piano-key actions
const infoBtn = document.createElement('button');
infoBtn.className = 'card-action action-info';
infoBtn.innerHTML = 'ℹ️';
```

**v5:**
```javascript
// Info integrado na modal de settings
handleActionSettings(entityObject, {
  includeInfo: true,
  connectionData: { centralName, connectionStatusTime, timeVal, deviceStatus }
});
```

### 2. Espaçamento Reduzido da Imagem

**v2:**
```css
.device-image {
  margin: 10px 0 !important;
}
```

**v5:**
```css
.device-image {
  margin: 4px 0 !important;  /* Reduzido 60% */
}
```

### 3. Altura Mínima Otimizada

**v2:**
```css
min-height: 126px !important;
```

**v5:**
```css
min-height: 114px !important;  /* Reduzido ~10% */
```

## Uso

### Importação

```javascript
import { renderCardComponentV5 } from './template-card-v5.js';
```

### Exemplo Básico

```javascript
const cardElement = renderCardComponentV5({
  entityObject: {
    entityId: 'device-1',
    labelOrName: 'Motor Principal',
    deviceIdentifier: 'MOTOR-001',
    deviceType: 'MOTOR',
    val: 12500,
    perc: 78.5,
    deviceStatus: 'ok',
    centralName: 'Central A',
    connectionStatusTime: new Date().toISOString(),
    timeVal: new Date().toISOString()
  },
  handleActionDashboard: (entity) => {
    console.log('Dashboard:', entity.labelOrName);
  },
  handleActionReport: (entity) => {
    console.log('Report:', entity.labelOrName);
  },
  handleActionSettings: (entity, options) => {
    // options.includeInfo === true em v5
    // options.connectionData contém dados de conexão
    console.log('Settings + Info:', entity, options);
  },
  handleSelect: (entity) => {
    console.log('Selected:', entity.labelOrName);
  },
  handleClickCard: (entity) => {
    console.log('Clicked:', entity.labelOrName);
  },
  useNewComponents: true,
  enableSelection: true,
  enableDragDrop: true
});

// Adicionar ao DOM
document.getElementById('cards-container').appendChild(cardElement.get(0));
```

## API

### Parâmetros

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `entityObject` | `Object` | **obrigatório** | Dados do dispositivo |
| `handleActionDashboard` | `Function` | - | Handler para ação de dashboard |
| `handleActionReport` | `Function` | - | Handler para ação de relatório |
| `handleActionSettings` | `Function` | - | Handler para ação de configurações (**inclui info em v5**) |
| `handleSelect` | `Function` | - | Handler para seleção do card |
| `handInfo` | `Function` | - | **DEPRECATED** - Use `handleActionSettings` |
| `handleClickCard` | `Function` | - | Handler para clique no card |
| `useNewComponents` | `Boolean` | `true` | Habilitar componentes novos |
| `enableSelection` | `Boolean` | `true` | Habilitar seleção múltipla |
| `enableDragDrop` | `Boolean` | `true` | Habilitar drag and drop |

### Estrutura do entityObject

```typescript
interface EntityObject {
  entityId: string;              // ID único do dispositivo
  labelOrName: string;           // Nome do dispositivo
  deviceIdentifier?: string;     // Identificador adicional
  deviceType: string;            // Tipo: MOTOR, 3F_MEDIDOR, HIDROMETRO, etc.
  val: number;                   // Valor atual (consumo, volume, etc.)
  perc: number;                  // Percentual (0-100)
  deviceStatus: string;          // Status: ok, warning, danger, offline
  centralName?: string;          // Nome da central
  connectionStatusTime?: string; // Timestamp da última conexão
  timeVal?: string;              // Timestamp da última telemetria
  ingestionId?: string;          // ID para ingestão de dados
}
```

### Retorno

Retorna um objeto jQuery-like com métodos de compatibilidade:

```javascript
{
  get: (index) => HTMLElement,
  find: (selector) => Object,
  on: (event, handler) => Object,
  addClass: (className) => Object,
  removeClass: (className) => Object,
  destroy: () => void,
  0: HTMLElement,
  length: 1
}
```

## Migração de v2 para v5

### Passo 1: Atualizar Importações

```diff
- import { renderCardComponentV2 } from './v-4.0.0/card/template-card-v2.js';
+ import { renderCardComponentV5 } from './v-5.2.0/card/template-card-v5.js';
```

### Passo 2: Remover handInfo (Deprecated)

```diff
  renderCardComponentV5({
    entityObject,
    handleActionDashboard,
    handleActionReport,
    handleActionSettings,
    handleSelect,
-   handInfo,  // REMOVER
    handleClickCard,
  });
```

### Passo 3: Atualizar handleActionSettings

```diff
- handleActionSettings: (entity) => {
+ handleActionSettings: (entity, options) => {
    // Abrir modal de configurações
+   if (options?.includeInfo && options?.connectionData) {
+     // Mostrar também informações de conexão
+     const { centralName, connectionStatusTime, timeVal, deviceStatus } = options.connectionData;
+     // Renderizar seção de info na modal
+   }
  }
```

## Estados do Card

### Status de Dispositivo

| Estado | Cor | Descrição |
|--------|-----|-----------|
| `ok` | Verde | Dispositivo funcionando normalmente |
| `warning` | Amarelo | Alerta de atenção |
| `danger` | Vermelho | Erro crítico |
| `offline` | Cinza | Dispositivo offline (com animação pulsante) |

### Indicador de Conexão

Pequeno círculo no canto inferior direito do card:
- **Verde**: Conectado e funcionando
- **Amarelo**: Conectado com avisos
- **Vermelho**: Erro de conexão
- **Cinza**: Offline ou sem informação

## Tipos de Dispositivo Suportados

### Energia
- `MOTOR`
- `3F_MEDIDOR`
- `RELOGIO`
- `ENTRADA`
- `SUBESTACAO`
- `VENTILADOR`
- `ESCADA_ROLANTE`
- `ELEVADOR`

### Água
- `HIDROMETRO`
- `CAIXA_DAGUA`
- `TANK`

Valores de energia são formatados automaticamente usando `formatEnergy()` (Wh → kWh → MWh → GWh).

## Seleção Múltipla

O card integra com `MyIOSelectionStore` para gerenciar seleção de múltiplos dispositivos:

```javascript
// Limite de 6 dispositivos
// Toast automático quando limite é excedido
MyIOToast.show('Não é possível selecionar mais de 6 itens.', 'warning');
```

## Drag and Drop

Cards podem ser arrastados para outros componentes:

```javascript
enhancedCardElement.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('text/myio-id', entityId);
  e.dataTransfer.setData('application/json', JSON.stringify(entityObject));
});
```

## Estilos e Temas

### Classes CSS Principais

- `.myio-enhanced-card-container-v5`: Container principal
- `.device-card-centered`: Card interno
- `.card-actions`: Piano-key actions (3 botões)
- `.device-image`: Imagem do dispositivo
- `.connection-status-icon`: Indicador de status

### Dark Mode

O componente suporta dark mode via `prefers-color-scheme`:

```css
@media (prefers-color-scheme: dark) {
  .device-card-centered.clickable {
    background: linear-gradient(145deg, #1e293b 0%, #334155 100%) !important;
  }
}
```

### Responsividade

Breakpoint mobile (≤768px):
- Padding reduzido
- Imagem menor (44px)
- Altura mínima ajustada (110px)

## Demonstração

Abra o arquivo de demonstração no navegador:

```
demos/template-card-v5-demo.html
```

Ou através do comando:

```bash
start demos/template-card-v5-demo.html
```

## Documentação Adicional

- **RFC Completa**: [`docs/RFC-0001-template-card-v5.md`](../../../../docs/RFC-0001-template-card-v5.md)
- **Componente v2** (referência): `v-4.0.0/card/template-card-v2.js`

## Roadmap

### v5.1 (Próxima Release)
- [ ] Testes unitários
- [ ] Testes de integração com SelectionStore
- [ ] Documentação de acessibilidade
- [ ] Exemplos de integração

### v5.2
- [ ] Temas customizáveis
- [ ] Layouts alternativos (compacto/detalhado)
- [ ] Animações melhoradas

### v6.0 (Futuro)
- [ ] Cards inteligentes (ajuste automático por tipo)
- [ ] Visualizações inline (mini-gráficos)
- [ ] Customização por usuário

## Suporte

Para dúvidas ou problemas:
1. Consulte a [RFC-0001](../../../../docs/RFC-0001-template-card-v5.md)
2. Verifique os exemplos em `/demos`
3. Entre em contato com o MYIO Frontend Guild

## Changelog

### v5.0.0 (2025-10-28)
- ✨ Remoção do botão de info lateral
- 🎨 Gap da imagem reduzido de 10px para 4px
- 📏 Altura mínima reduzida de 126px para 114px
- 🔧 Info integrado na modal de configurações
- 📱 Responsividade melhorada
- ⚡ Performance otimizada
- 🎯 Baseado em template-card-v2.js

---

**Versão**: 5.0.0
**Autor**: MYIO Frontend Guild
**Data**: 2025-10-28
