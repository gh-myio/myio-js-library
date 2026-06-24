## Plano: Showcase de Simulação MAIN_UNIQUE_DATASOURCE Widget

Analisando o showcase existente `energy-panel` e o widget `MAIN_UNIQUE_DATASOURCE`, aqui está o plano para criar um showcase completo de simulação do ambiente ThingsBoard:

---

### 📋 **Objetivo**

Criar um showcase interativo que simule o ambiente ThingsBoard para o widget `MAIN_UNIQUE_DATASOURCE`, permitindo:

- Renderizar HTML, CSS, JS e schemaJson do widget
- Mockar dados do ThingsBoard (ctx.data, ctx.settings, datasources)
- Manipular estado e lifecycle hooks (onInit, onDataUpdated, onDestroy)
- Testar interações e visualizar componentes rendererizados

---

### 🏗️ **Estrutura Proposta**

```javascript
showcase/main-unique-datasource/
├── index.html               # Página principal do showcase
├── start-server.bat         # Script Windows para iniciar servidor
├── start-server.sh          # Script Linux/macOS para iniciar servidor
├── stop-server.bat          # Script Windows para parar servidor
└── stop-server.sh           # Script Linux/macOS para parar servidor
```

---

### 🎯 **Componentes do Showcase**

#### **1. HTML Structure (`index.html`)**

- **Header**: Título e descrição (RFC-0111: MAIN_UNIQUE_DATASOURCE)

- **Status Display**: Indicador de carregamento/erro

- **Widget Mount Area**: Container `#mainUniqueWrap` (igual ao template.html)

- **Controls Panel**:

  - Botões: Criar Widget, Destruir, Refresh, Gerar Dados Mock
  - Toggle Theme (Dark/Light)
  - Controles de Settings

- **Event Log**: Console visual de eventos (onInit, onDataUpdated, etc.)

- **State Inspector**: Visualização do estado atual (ctx.settings, ctx.data)

- **Mock Data Panel**: Interface para gerar/editar dados mock

#### **2. Mock Context (`self.ctx`)**

```javascript
const mockCtx = {
  settings: {
    enableDebugMode: true,
    dataApiHost: 'https://api.data.apps.myio-bas.com',
    customerTB_ID: 'mock-customer-id',
    defaultThemeMode: 'dark',
    // ... todas as settings do settingsSchema.json
  },

  data: [], // Mock datasource data (AllDevices)

  datasources: [
    {
      type: 'entity',
      name: 'AllDevices',
      aliasName: 'AllDevices',
      entityAliasId: 'mock-alias-id',
      dataKeys: ['consumption', 'deviceType', 'label', ...]
    }
  ],

  $injector: {
    get: (serviceName) => {
      if (serviceName === 'authService') {
        return {
          getJwtToken: () => 'mock-jwt-token-123'
        };
      }
      return null;
    }
  },

  $scope: {
    startDateISO: new Date().toISOString(),
    endDateISO: new Date().toISOString()
  }
};
```

#### **3. Mock Data Generator**

Função para gerar dados realistas:

```javascript
function generateMockDeviceData(count = 50) {
  const devices = [];
  const shoppings = ['Mestre Álvaro', 'Mont Serrat', 'Moxuara', 'Rio Poty'];
  const deviceTypes = ['3F_MEDIDOR', 'AC_3F', 'HIDROMETRO', 'TERMOSTATO'];

  for (let i = 0; i < count; i++) {
    devices.push({
      datasource: {
        type: 'entity',
        entityId: `device-${i}`,
        entityName: `Device ${i}`,
        entityLabel: `Dispositivo ${i}`,
        aliasName: 'AllDevices',
      },
      dataKey: {
        name: 'consumption',
        type: 'timeseries',
      },
      data: [
        [Date.now(), Math.random() * 1000], // [timestamp, value]
      ],
    });
  }

  return devices;
}
```

#### **4. Lifecycle Simulation**

```javascript
// Injetar widget controller no showcase
let widgetInstance = null;

function initWidget() {
  // Carregar controller.js e executar onInit
  if (typeof self !== 'undefined' && self.onInit) {
    widgetInstance = { onInit: self.onInit, onDataUpdated: self.onDataUpdated };
    widgetInstance.onInit();
  }
}

function triggerDataUpdate() {
  if (widgetInstance && widgetInstance.onDataUpdated) {
    widgetInstance.onDataUpdated();
  }
}

function destroyWidget() {
  if (widgetInstance && typeof self.onDestroy === 'function') {
    self.onDestroy();
  }
  widgetInstance = null;
}
```

#### **5. Controls Panel Features**

- **Criar Widget**: Chama `onInit()` com mock context
- **Refresh Data**: Chama `onDataUpdated()` com novos dados
- **Gerar Dados Mock**: Popula `ctx.data` com dispositivos aleatórios
- **Toggle Theme**: Alterna entre dark/light mode
- **Edit Settings**: Modal para editar `ctx.settings` em tempo real
- **Simulate Events**: Disparar eventos customizados (myio:filter-applied, etc.)

#### **6. Debugging Features**

- **Event Log**: Interceptar `console.log`, `LogHelper.log` e exibir
- **State Inspector**: JSON viewer para `ctx`, `MyIOOrchestratorData`, `MyIOUtils`
- **Network Monitor**: Mock fetch/XHR responses
- **Performance Metrics**: Tempo de onInit, onDataUpdated

---

### 🔧 **Implementação Técnica**

#### **Scripts de Servidor**

Identicos ao energy-panel:

```bash
# start-server.bat / start-server.sh
npx http-server -p 3333 -c-1 --cors
```

#### **Carregamento do Widget**

```html
<!-- Carregar biblioteca MyIO -->
<script src="../../dist/myio-js-library.umd.js"></script>

<!-- Carregar template.html do widget -->
<div id="widgetTemplateMount"></div>

<!-- Carregar styles.css -->
<link rel="stylesheet" href="../../src/thingsboard/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/styles.css" />

<!-- Carregar controller.js -->
<script src="../../src/thingsboard/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js"></script>
```

#### **Mock Global Objects**

```javascript
// Mock localStorage
const mockLocalStorage = {
  jwt_token: 'mock-jwt-token-abc123',
  getItem: (key) => mockLocalStorage[key] || null,
  setItem: (key, value) => (mockLocalStorage[key] = value),
};

// Mock window.MyIOUtils (será populado pelo widget)
window.MyIOUtils = {};

// Mock window.MyIOOrchestrator (será populado pelo widget)
window.MyIOOrchestrator = {};
```

---

### 📊 **Mock Data Scenarios**

Criar presets de dados para testar diferentes cenários:

1. **Cenário: Poucos Dispositivos** (5-10 devices)
2. **Cenário: Muitos Dispositivos** (100+ devices)
3. **Cenário: Sem Dados** (array vazio)
4. **Cenário: Dados Incompletos** (faltando campos)
5. **Cenário: Múltiplos Shoppings** (4-6 shoppings)
6. **Cenário: Single Shopping** (todos devices do mesmo shopping)

---

### 🎨 **UI Controls Panel**

Organização dos controles:

```javascript
┌────────────────────────────────────────┐
│  Widget Lifecycle                      │
│  [Criar Widget] [Destruir] [Refresh]   │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  Mock Data                             │
│  [Gerar Dispositivos] [Clear Data]     │
│  Preset: [Dropdown com cenários]       │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  Theme & Settings                      │
│  [☀️ Light / 🌙 Dark]                   │
│  [⚙️ Edit Settings]                     │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  Simulate Events                       │
│  [Filter Applied] [Date Change]        │
│  [Force Refresh] [Goals Panel]         │
└────────────────────────────────────────┘
```

---

### 📝 **Checklist de Implementação**

1. **Estrutura Base**

   - [ ] Criar diretório `showcase/main-unique-datasource/`
   - [ ] Criar `index.html` com layout showcase
   - [ ] Criar scripts de servidor (start/stop)

2. **Mock Context**

   - [ ] Implementar `mockCtx` com todas propriedades
   - [ ] Mock `localStorage` e `$injector`
   - [ ] Mock `ctx.data` com structure ThingsBoard

3. **Widget Integration**

   - [ ] Carregar template.html no mount point
   - [ ] Carregar styles.css
   - [ ] Carregar controller.js com self global
   - [ ] Implementar lifecycle hooks (onInit, onDataUpdated, onDestroy)

4. **Mock Data Generator**

   - [ ] Função para gerar dispositivos aleatórios
   - [ ] Presets de cenários (poucos/muitos/sem dados)
   - [ ] Interface para editar dados manualmente

5. **Controls Panel**

   - [ ] Botões de lifecycle
   - [ ] Toggle de theme
   - [ ] Editor de settings
   - [ ] Simulador de eventos

6. **Debugging Tools**

   - [ ] Event log com filtros
   - [ ] State inspector com JSON viewer
   - [ ] Console interceptor

7. **Documentação**

   - [ ] README no diretório showcase
   - [ ] Comentários no código
   - [ ] Exemplos de uso

---

### 🚀 **Próximos Passos**

Quando você **toggle to**

**Act Mode (⌘⇧A)**, irei:

1. Criar a estrutura de arquivos
2. Implementar `index.html` completo com todos os componentes
3. Criar scripts de servidor (start/stop)
4. Implementar mock data generator
5. Integrar o widget controller
6. Adicionar ferramentas de debug
7. Documentar uso e exemplos

---

### ❓ **Dúvidas/Decisões**

Antes de implementar, preciso confirmar:

1. **Dados Mock**: Prefere gerar dados totalmente aleatórios ou usar dados fixos mais realistas baseados em shoppings reais?

2. **Componentes Visuais**: Quer que eu renderize TODOS os componentes (Header, Menu, TelemetryGrid, Footer) ou apenas a estrutura principal para testes?

3. **API Mocking**: Precisa mockar as chamadas à API de ingestão (`/api/v1/telemetry/...`) ou apenas dados estáticos do ThingsBoard?

4. **Nível de Controle**: Quer controles granulares (editar cada device) ou apenas presets de alto nível?
