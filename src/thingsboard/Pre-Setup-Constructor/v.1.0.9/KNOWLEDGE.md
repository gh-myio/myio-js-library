# Widget Pre-Setup-Constructor v.1.0.9

**Localização:** `src/thingsboard/Pre-Setup-Constructor/v.1.0.9/`
**Arquivo Principal:** `controller.js` (6345 linhas)
**Tipo:** Widget ThingsBoard para construção de estruturas hierárquicas

## Visão Geral

Widget para construir e gerenciar estruturas hierárquicas de Clientes, Assets, Gateways e Devices no ThingsBoard. Permite criar, importar, exportar e provisionar toda a hierarquia de forma visual.

## Estrutura do Código

### 1. Helpers e Configuração Global (linhas 1-250)

**Variáveis Globais:**
- `window.currentDDD` - DDD padrão (ex: "21")
- `window.currentCNPJ` - CNPJ padrão
- `window.bypassProvisioning` - Flag para bypass de provisionamento (dev/test)
- `__globalGatewayCounter` - Contador sequencial de gateways
- `__globalFrequencyCounter` - Contador de frequência (inicia em 90, incrementa de 2 em 2)

**MyIOAuth (linhas 17-166):**
Sistema de autenticação com cache de token para API MyIO Ingestion.

```javascript
// Configuração
const AUTH_URL = "https://api.data.apps.myio-bas.com/api/v1/auth";
const CLIENT_ID = "myioadmi_mekj7xw7_sccibe";
const CLIENT_SECRET = "KmXhNZu0uydeWZ8scAi43h7P2pntGoWkdzNVMSjbVj3slEsZ5hGVXyayshgJAoqA";

// Uso
const token = await MyIOAuth.getToken();
```

### 2. Funções de Importação de Cliente (linhas 1225-1550)

#### `importedTree(tbCustomerId)` - Linha 1226

Importa estrutura hierárquica completa de um cliente existente no ThingsBoard.

**Fluxo:**
1. Mostra modal de loading
2. Busca hierarquia recursivamente:
   - CUSTOMER → CUSTOMER (filhos)
   - CUSTOMER → ASSET
   - ASSET → ASSET (sub-assets)
   - ASSET → DEVICE
   - DEVICE → DEVICE (devices filhos)
3. Armazena em `window.structure`
4. Calcula resumo (total de customers, assets, devices, gateways)
5. Hydrata assets com atributos
6. Busca atributos server-scope do customer

**Funções Auxiliares:**
- `buildTree(entityId, entityType)` - Constrói árvore de CUSTOMER
- `buildAssetTree(assetId)` - Constrói árvore de ASSET
- `buildDeviceTree(deviceId)` - Constrói árvore de DEVICE
- `fetchRelations(fromId, fromType)` - Busca relações de uma entidade
- `fetchEntity(id, type)` - Busca dados de uma entidade
- `contarResumo(estrutura)` - Conta totais e exibe no painel

### 3. Modal de Importar Cliente (linhas 3846-3887)

**Localização do Código:**
```javascript
// Linha 3746: Event handler do botão
document.getElementById("import-root").onclick = () =>
  showModal("importCustomer", null);

// Linhas 3846-3887: Criação da modal
if (type === "importCustomer") {
  const heading = document.createElement("h3");
  heading.textContent = "📥 Importar Cliente Existente";

  const select = document.createElement("select");
  select.id = "importClientSelect";

  // Carrega clientes assincronamente
  fetchAllCustomers().then((allCustomers) => {
    allCustomersGlobal = allCustomers;
    select.innerHTML = "";
    Object.entries(allCustomers).forEach(([key, client]) => {
      const opt = document.createElement("option");
      opt.value = client.id;
      opt.textContent = client.name;
      select.appendChild(opt);
    });
  });
}
```

**CSS da Modal (linhas 3699-3701):**
```css
.modal-overlay {
  position:fixed; inset:0;
  background:rgba(15,23,42,.4);
  display:flex; align-items:center; justify-content:center;
  z-index:9999;
}

.modal-content {
  background:#fff;
  padding:18px;
  border-radius:14px;
  width:340px;  /* ⚠️ LARGURA ATUAL - PRECISA SER 680px */
  box-shadow:0 10px 30px rgba(0,0,0,.15);
}

.modal-content input, .modal-content select {
  width:100%; margin-bottom:10px;
  padding:8px 10px;
  border:1px solid var(--myio-border);
  border-radius:10px;
}
```

### 4. Confirmação de Importação (linhas 4130-4142)

```javascript
if (type === "importCustomer") {
  const selectedId = modal.querySelector("#importClientSelect")?.value;
  console.log("ID selecionado:", selectedId);

  const customerEntity = {
    id: selectedId,
    entityType: "CUSTOMER",
  };

  // Chama importedTree para buscar hierarquia
  importedTree(selectedId).then(() => {
    modal.remove();
    renderTree();
  });
}
```

## Melhorias Pendentes

### 🎯 Issue 1: Ordenação Alfabética

**Problema:** Clientes não aparecem ordenados no select.

**Solução:** Ordenar array antes de popular o select (linha ~3881).

### 🎯 Issue 2: Filtro de Busca

**Problema:** Lista grande de clientes sem filtro.

**Solução:** Adicionar input de busca que filtra options em tempo real.

### 🎯 Issue 3: Largura da Modal

**Problema:** Modal muito estreita (340px) para lista de clientes.

**Solução:** Aumentar para 680px (dobro do tamanho).

## Estrutura de Dados

### Window.structure

```javascript
window.structure = [
  {
    name: "Cliente Raiz",
    gateways: [
      {
        id: "uuid...",
        name: "Gateway 01",
        label: "Central Principal",
        type: "gateway",
        children: [] // devices filhos
      }
    ],
    assets: [
      {
        name: "Prédio A",
        children: [/* sub-assets */],
        devices: [
          {
            id: "uuid...",
            name: "Device 01",
            label: "Medidor 01",
            type: "default",
            children: [/* devices filhos */]
          }
        ]
      }
    ],
    children: [/* sub-customers */]
  }
];
```

## Endpoints API

### ThingsBoard API
- `GET /api/customer/${id}` - Busca customer
- `GET /api/asset/${id}` - Busca asset
- `GET /api/device/${id}` - Busca device
- `GET /api/relations/info?fromId=${id}&fromType=${type}` - Busca relações

### MyIO Ingestion API
- `POST https://api.data.apps.myio-bas.com/api/v1/auth` - Autenticação
- `GET /api/v1/telemetry/customers` - Lista customers ingestion

## Referências

### Funções Principais
- `showModal(type, path)` - Linha 3797
- `importedTree(tbCustomerId)` - Linha 1226
- `fetchAllCustomers()` - (Precisa localizar)
- `renderTree()` - Linha 3753

### Event Handlers
- `#import-root` click → `showModal("importCustomer", null)` - Linha 3746
- `#modalConfirm` click → Importa cliente selecionado - Linha 4130

## Notas Técnicas

1. **Promises em Loading:** Modal de loading é criada antes de operações async
2. **Evitar Duplicatas:** Usa Sets (`visitedEntities`, `visitedDeviceEdges`) para evitar loops
3. **Recursão:** Suporta hierarquias profundas (CUSTOMER→CUSTOMER→ASSET→DEVICE→DEVICE...)
4. **Global State:** Usa `window.structure` para armazenar hierarquia atual
