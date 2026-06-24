# RFC-0195 — Telemetry Device Sync Job Button

**Status:** Draft
**Criado em:** 2026-03-19
**Arquivo alvo:** `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/`
**Referência API:** `C:\Projetos\GitHub\myio\gcdr.git\docs\FRONTEND-Device-Sync-Jobs.md`

---

## 1. Motivação

O WIDGET TELEMETRY já exporta o _device-map_ completo via `btnDownloadDeviceMap` (RFC-0152). O conteúdo gerado — pipe-delimited, com `tbId | deviceName | … | gcdrDeviceId | gcdrSyncAt` — é exatamente o formato exigido pelo endpoint `POST /api/v1/device-sync/jobs` da GCDR API.

Hoje o operador precisa:
1. Baixar o arquivo pelo botão "Device Map"
2. Abrir manualmente o widget **GCDR-Upsell-Setup**
3. Selecionar o customer
4. Criar um job colando o conteúdo

Com este RFC, um botão **"Sync GCDR"** ao lado de `btnDownloadDeviceMap` automatiza todo esse fluxo direto no TELEMETRY, sem sair do dashboard.

---

## 2. Escopo

| Item | Detalhe |
|------|---------|
| Widget | `TELEMETRY/controller.js` + `TELEMETRY/template.html` |
| Visibilidade | Apenas para `isSuperAdmin` (mesma regra do `btnDownloadDeviceMap`) |
| Domínios suportados | Todos (energy, water, temperature) |
| Versão dashboard | `v-5.2.0` |

---

## 3. Pré-condições

Para o sync funcionar, o **customer** deve ter o atributo `integration_setup` (SERVER_SCOPE) com a seção `gcdr` preenchida:

```json
{
  "gcdr": {
    "gcdrCustomerId": "<uuid>",
    "gcdrApiKey": "gcdr_pk_...",
    "gcdrTenantId": "<uuid>"
  }
}
```

Se `integration_setup.gcdr` não estiver disponível, o botão exibe uma mensagem de erro orientando o operador.

---

## 4. Credenciais — Resolução

A função auxiliar `_fetchGcdrCredentials()` é adicionada ao controller:

```javascript
async function _fetchGcdrCredentials() {
  const tbToken = localStorage.getItem('jwt_token');
  const customerId = window.MyIOUtils?.customerTB_ID;
  if (!tbToken || !customerId) throw new Error('JWT ou customerTB_ID não disponíveis.');

  const url = `/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE?keys=integration_setup`;
  const res = await fetch(url, { headers: { 'X-Authorization': `Bearer ${tbToken}` } });
  if (!res.ok) throw new Error(`TB attrs HTTP ${res.status}`);

  const attrs = await res.json();
  const raw = Array.isArray(attrs)
    ? attrs.find((a) => a.key === 'integration_setup')?.value
    : attrs.integration_setup;

  if (!raw) throw new Error('Atributo integration_setup não encontrado no customer.');

  const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const gcdr = cfg?.gcdr;
  if (!gcdr?.gcdrCustomerId || !gcdr?.gcdrApiKey) {
    throw new Error('integration_setup.gcdr incompleto — gcdrCustomerId e gcdrApiKey obrigatórios.');
  }

  return {
    gcdrCustomerId: gcdr.gcdrCustomerId,
    gcdrApiKey:     gcdr.gcdrApiKey,
    gcdrTenantId:   gcdr.gcdrTenantId ?? null,
  };
}
```

---

## 5. Fluxo do Botão

```
[Sync GCDR] clicado
     │
     ├─ Lê window[_exportKey]  (device-map em memória do widget)
     │   └─ Vazio? → alert + abort
     │
     ├─ _fetchGcdrCredentials()
     │   └─ Erro? → alert com mensagem + abort
     │
     ├─ Abre modal inline "Sync GCDR"
     │
     ├─ POST /api/v1/device-sync/jobs
     │     body: { customerId, defaultAssetId?, dryRun: false, files: [{ name, content }] }
     │     header: X-API-Key: gcdrApiKey
     │   └─ Erro? → exibe erro no modal + abort
     │
     ├─ Recebe { jobId, status: "QUEUED" }
     │
     ├─ Polling GET /api/v1/device-sync/jobs/:jobId  (a cada 2s)
     │   └─ Atualiza UI: fase atual + barra de progresso
     │   └─ Para quando status ∈ { DONE, PARTIAL, FAILED }
     │
     └─ GET /api/v1/device-sync/jobs/:jobId/log
          └─ Renderiza tabela de log com níveis coloridos
```

---

## 6. Montagem do `files[].content`

O conteúdo é gerado a partir de `window[_exportKey]` — o mesmo array usado pelo `btnDownloadDeviceMap`:

```javascript
const DEVICE_MAP_HEADER =
  'tbId|deviceName|label|identifier|deviceType|deviceProfile|slaveId|centralId|gcdrCustomerId|gcdrAssetId|gcdrDeviceId|gcdrSyncAt';

function _buildDeviceMapContent(data) {
  const rows = data.map((d) =>
    [d.tbId, d.deviceName, d.label, d.identifier,
     d.deviceType, d.deviceProfile, d.slaveId, d.centralId,
     d.gcdrCustomerId, d.gcdrAssetId, d.gcdrDeviceId, d.gcdrSyncAt].join('|')
  );
  return DEVICE_MAP_HEADER + '\n' + rows.join('\n');
}
```

Nome do arquivo (`files[].name`): `${WIDGET_DOMAIN}-${_groupSlug}` (ex: `energy-stores`).

---

## 7. Progresso por Fase

| `currentPhase` | Progresso | Label UI |
|---|---|---|
| `QUEUED` | 0% | Aguardando na fila… |
| `CHECK` | 15% | Comparando devices com GCDR… |
| `ACTION_PLAN` | 30% | Classificando ações… |
| `DETECT_RELOCATIONS` | 45% | Detectando relocações… |
| `RELOCATE` | 55% | Movendo devices… |
| `APPLY_UPDATES` | 70% | Aplicando atualizações… |
| `CONSOLIDATE_CREATES` | 85% | Criando devices novos… |
| `DONE` | 100% | Concluído |

---

## 8. Estados Visuais

| `status` | Badge | Cor |
|----------|-------|-----|
| `QUEUED` | ⏳ Aguardando... | cinza |
| `RUNNING` | 🔄 `currentPhase` | azul |
| `DONE` | ✅ Concluído | verde |
| `PARTIAL` | ⚠️ Concluído com erros | amarelo |
| `FAILED` | ❌ Falha fatal | vermelho |

---

## 9. Nível do Log — Cores

| `level` | Cor |
|---------|-----|
| `INFO` | `#6b7280` (cinza) |
| `WARN` | `#d97706` (amarelo) |
| `OK` | `#16a34a` (verde) |
| `FAIL` | `#dc2626` (vermelho) |
| `ERROR` | `#991b1b` (vermelho escuro) |

---

## 10. Mudanças em `template.html`

Adicionar o botão na `<footer class="shops-modal-footer">` ao lado do `btnDownloadDeviceMap`:

```html
<!-- RFC-0195: GCDR Device Sync Job — @myio.com.br only -->
<button
  id="btnSyncGCDR"
  class="btn btn-sync-gcdr"
  style="display:none"
  title="Sincronizar devices com GCDR"
>
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
       stroke="currentColor" stroke-width="2" aria-hidden="true"
       style="margin-right:5px;flex-shrink:0">
    <polyline points="1 4 1 10 7 10"></polyline>
    <path d="M3.51 15a9 9 0 1 0 .49-4.49"></path>
  </svg>
  Sync GCDR
</button>
```

---

## 11. Mudanças em `controller.js`

### 11.1 Visibilidade — `_applyPresetupVisibility`

```javascript
// Adicionar junto ao btnDownloadDeviceMap
const btnSync = (_filterModalElement || $root()[0])?.querySelector('#btnSyncGCDR');
if (btnSync) btnSync.style.display = isSuperAdmin ? 'inline-flex' : 'none';
```

### 11.2 Evento de clique — `bindModal()`

```javascript
$m.on('click', '#btnSyncGCDR', (ev) => {
  ev.preventDefault();
  _handleSyncGCDR();
});
```

### 11.3 Funções principais

```javascript
// ── RFC-0195: GCDR Device Sync Job ───────────────────────────
const GCDR_SYNC_BASE = 'https://gcdr-api.a.myio-bas.com';
const GCDR_PHASE_PROGRESS = {
  QUEUED: 0, CHECK: 15, ACTION_PLAN: 30, DETECT_RELOCATIONS: 45,
  RELOCATE: 55, APPLY_UPDATES: 70, CONSOLIDATE_CREATES: 85, DONE: 100,
};

async function _fetchGcdrCredentials() { /* ... ver §4 */ }

function _buildDeviceMapContent(data) { /* ... ver §6 */ }

async function _handleSyncGCDR() {
  const data = window[_exportKey];
  if (!data || data.length === 0) {
    alert('Nenhum dado disponível. Abra o painel de dados primeiro.');
    return;
  }

  let creds;
  try {
    creds = await _fetchGcdrCredentials();
  } catch (err) {
    alert(`Erro ao obter credenciais GCDR:\n${err.message}`);
    return;
  }

  _openSyncJobModal(data, creds);
}

function _openSyncJobModal(data, creds) {
  // 1. Renderiza modal com estado inicial
  // 2. POST /api/v1/device-sync/jobs
  // 3. Polling a cada 2s → atualiza fase + barra
  // 4. Ao terminar → GET /log → renderiza tabela
}
```

### 11.4 Modal inline

O modal segue o padrão inline já usado no widget (div injetada no DOM + cleanup no `destroy`).
Campos exibidos:
- **Header**: "🔗 Sync GCDR — `<customerName>`"
- **Subheader**: `gcdrCustomerId` (truncado)
- **Progresso**: barra animada + label da fase
- **Resumo final**: cards compactos com `check`, `actionPlan`, `applyUpdates`
- **Log**: tabela com colunas `Fase | Nível | Mensagem` + scroll

---

## 12. Estilo CSS (`controller.js`)

Adicionar ao bloco de estilos inline do widget:

```css
.btn-sync-gcdr {
  background: linear-gradient(180deg, #0db89e, #0a6d5e);
  color: #fff;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-sync-gcdr:hover { opacity: 0.88; }
.btn-sync-gcdr:disabled { opacity: 0.5; cursor: not-allowed; }
```

---

## 13. Considerações

- **dryRun**: na v1 sempre `false`. Pode ser adicionado um toggle no modal em versão futura.
- **defaultAssetId**: omitido na v1 — o job usa os `gcdrAssetId` já no device-map.
- **Rate limit**: polling a cada 2s; cancelado automaticamente se o modal for fechado.
- **Segurança**: botão visível apenas para `isSuperAdmin` (@myio.com.br), mesma regra do `btnDownloadDeviceMap`.
- **Multi-arquivo**: a v1 envia um único arquivo por widget. Se necessário combinar energy + water, escopo futuro.

---

## 14. Checklist de Implementação

- [ ] `template.html` — botão `#btnSyncGCDR`
- [ ] `controller.js` — `_fetchGcdrCredentials()`
- [ ] `controller.js` — `_buildDeviceMapContent()`
- [ ] `controller.js` — `_handleSyncGCDR()`
- [ ] `controller.js` — `_openSyncJobModal()` com polling + log
- [ ] `controller.js` — `_applyPresetupVisibility()` — adicionar `btnSyncGCDR`
- [ ] `controller.js` — `bindModal()` — handler de click
- [ ] `controller.js` — CSS do botão e modal
- [ ] Teste manual: customer com `integration_setup` completo
- [ ] Teste manual: customer sem `integration_setup` (deve exibir mensagem de erro clara)
