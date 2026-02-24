# RFC-0180 - New Alarms Tab (Draft)

## Contexto
Na modal de configurações (`src/components/premium-modals/settings`) existem duas tabs: **Geral** e **Anotações**.  
Há uma `div.form-column` com o título **Alarmes de energia**.

## Objetivos
- Ocultar temporariamente a seção **Alarmes de energia**.
- Reorganizar o layout da tab **Geral**, ampliando o espaço da `form-column`.
- Criar a nova tab **Alarmes** com:
  - seção para carregar e exibir tipos de alarmes (bundle).
  - seção de **Parametrização de Alarme** (rules por device).

## Alterações de layout (Tab Geral)
1. Ocultar a `div.form-column` de **Alarmes de energia**.
2. Usar o espaço liberado para expandir o layout atual.
3. Novo layout proposto:

```
| ÍCONE em relação ao deviceProfile | Etiqueta (label)
| label do device (já existe)       | input da etiqueta (já existe, só muda a posição)
| Andar / Localização (label)       | input do Andar (já existe, só muda a posição)
| Identificador / LUC / SUC
```

4. Exibir o `deviceName` em fonte mais sutil ao lado do label do device.

## Nova tab: Alarmes
### Seção 1: Bundle de alarmes
Há um botão já funcional que abre a modal de bundle:

Arquivo: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/ALARM/controller.js`

```ts
MyIOLibrary.openAlarmBundleMapModal({
  customerTB_ID,
  gcdrTenantId,
  gcdrApiBaseUrl,
  themeMode: _currentTheme,
});
```

#### Proposta
Preparar os dados na **MAIN** e repassar para a modal:
- Produção do bundle na MAIN:  
  `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`
- Armazenar os dados prontos em `window.MyIOOrchestrator`.
- Passar esses dados para `openAlarmBundleMapModal`.

#### Ajustes no componente da modal
Arquivo: `src/components/premium-modals/alarm-bundle-map/openAlarmBundleMapModal.ts`

Hoje:
```ts
const bundle = await fetchBundle(
  params.customerTB_ID,
  params.gcdrTenantId,
  baseUrl
);
```

Proposta:
- Adicionar parâmetro opcional em `AlarmBundleMapParams`:
  - `dataFetched` (bundle já carregado na MAIN).
  - `forceDataFetched` (boolean) para forçar nova busca mesmo com dados existentes.
- Regra:
  - Se `dataFetched` for `null`, busca com `fetchBundle`.
  - Se existir e `forceDataFetched` for `true`, refaz a chamada de API.
  - Caso contrário, reutiliza os dados.

### Seção 2: Parametrização de Alarme (rules)
Na tab **Alarmes**, exibir:
- Tabela com rules já associadas ao device.
- Multiselect para adicionar rules específicas.
- Botão **Salvar**.

#### Fonte das rules
Documento: `C:\Projetos\GitHub\myio\gcdr-frontend.git\docs\rules-api-reference.md`

#### Parâmetros necessários
- `gcdrCustomerId`: vem de `attributes` (`server_scope`) do customer.
- `gcdrDeviceId`: vem de `attributes` (`server_scope`) do device.

Ambos já estão expostos em `dataKey` do datasource:
- `aliasName = customer`
- `All3Fs`, `AllTempDevices`, `AllHidrosDevices`

#### Regra de associação
Ao buscar as rules do customer, `result.data.items[].scope.entityIds` contém a lista de devices permitidos.

Exemplo:
```
"entityIds": [
  "9264f262-6b5c-4f7e-ac12-5760fc225e33",
  "7e3aaf6a-31e7-4c45-a70d-f978bcfe0a46",
  "cb29bc74-6531-460c-abca-98c678112388",
  "a83ebc33-25ac-4792-99ca-08a2cc86aff1",
  "463a38ed-e5b3-4aac-a4d0-f86a35cfbb77",
  "e9dce3c5-efa0-4df3-8352-8d09e60a1ea7",
  "f3d80c84-c2b0-4325-b73a-d48d2f8f8c0f"
]
```

#### Observação
Recomendado montar na MAIN um mapa de rules x devices para reutilização na tab **Alarmes**.
