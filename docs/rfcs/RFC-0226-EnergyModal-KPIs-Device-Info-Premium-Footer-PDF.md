# RFC-0226: EnergyModal — KPIs + Device "(i)", Premium Footer & New PDF (CSV preserved)

- Feature Name: `energymodal_kpis_device_info_premium_footer_pdf`
- Start Date: 2026-07-17
- RFC PR: (leave this empty)
- Tracking Issue: (leave this empty)
- Status: **Accept with changes — consolidated (incorporates Revisão v1, 2026-07-17)**

> **Nota de consolidação.** Versão canônica. Mantém a investigação/grounding e
> **substitui o design ingênuo** pelas correções aprovadas na Revisão v1:
> comparação exige um **dataset MyIO de primeira classe** (não UI pequena);
> `exportGridPdf` **não** é reutilizável direto (modelo `TelemetryDevice[]` ≠
> time-series); KPI **unit-aware** (temperatura = média/min/max, não soma);
> **lifecycle do footer** owned/destroyed; "(i)" com escaping/ids/foco; limites de
> **fetch/auth** na comparação; **fronteira estrita** de preservação do CSV;
> **escopo Shopping v5.2.0** primeiro (parity SIM/UNIQUE/v5.4.0 verificada); e
> **rollout faseado por risco de dados**.

## Summary

Evoluir o **EnergyModal** compartilhado (`src/components/premium-modals/energy/`,
aberto via `window.MyIOUtils.openDashboardPopupEnergy`) — usado no dashboard
**single-device** e na modal de **comparação** (botão "Comparar" do FOOTER,
Shopping v5.2.0 / HO / SIM) — para:

- **(a)** comparação ganha **KPIs** (unit-aware) + **"(i)"** listando **quais
  devices** estão sendo comparados;
- **(b)** single ganha o **"(i)"** no header (device/customer/período);
- **(c)** remover o botão **"FECHAR"** redundante (o shell já tem **×**), e
  **remover o stub de KPI** (`#show-kpis-btn` → `alert('… to be implemented')`);
- **(d)** ambos os modos ganham o **footer premium** do `AllReportModal`
  (`createModalFooter`), com **lifecycle owned/destroyed**;
- **(e)** remover o botão **"Exportar CSV"** da toolbar e mover o gatilho para o
  footer — **preservando `exportToCsv()` byte-for-byte** (clientes dependem);
- **(f)** **novo PDF** com KPIs — mas com **estratégia de tabela definida** (o
  `exportGridPdf` atual não serve direto);
- **(g)** opcional: KPIs como **sidebar direita** (precedente BAS).

EnergyModal é **componente de lib** — a mudança land uma vez em `src/` e todo
dashboard consome via bundle publicado; **mas** a comparação depende de o caller
passar labels/ids (o FOOTER v5.2.0 já passa `dataSources`).

## Grounding (verificado em código)

- **Modos:** `params.mode: 'single' | 'comparison'` (`types.ts:29`). `show()`
  branch em `EnergyModal.ts:83`. **Single** faz fetch TB + série →
  `currentEnergyData` populado (`EnergyModalView.renderEnergyData` `:788`).
  **Comparison** pula o fetch (`createComparisonContext` `:196`) e chama
  `view.tryRenderWithSDK(null)` — **sem dataset MyIO**. `loadEnergyData()`,
  `handleGranularityChange()` retornam cedo se não-single; `handleExport()` bloqueia
  export em comparação (`alert('Export não disponível no modo de comparação')`).
- **Chart = Energy Chart SDK em `<iframe>`** (`window.EnergyChartSDK.renderTelemetry*Chart`,
  `iframeBaseUrl` default `https://graphs.apps.myio-bas.com`, `EnergyModalView.ts:866/962/1046`).
  MyIO só possui o chrome (header via `ModalPremiumShell`, toolbar, footer). **KPIs
  que o SDK desenhe ficam dentro do iframe — não legíveis.**
- **Header + ×:** `ModalPremiumShell` (`:133-145`); título single = `buildModalTitle()`
  (`EnergyModal.ts:370-396`); título comparação = string `Comparação de N Dispositivos` (`:112`).
- **"FECHAR":** `#close-btn` em `EnergyModalView.ts:524-526` (normal) **e** `:630-632`
  (BAS), wired `:1385-1389`. (Error-panel "Fechar" `:770` — manter.)
- **"Exportar CSV":** `#export-csv-btn` `:418-420` (normal) **e** `:587-589` (BAS),
  wired `:1370-1383`. **CSV a preservar:** `exportToCsv()` `:1224-1258` + `downloadCSV()` `:1263-1276`.
- **KPI stub:** `#energy-kpi-btn`/`#show-kpis-btn` `:543-549`, handler `:1481` (alert).
- **FOOTER "Comparar":** `openComparisonModal()` (`v-5.2.0/WIDGET/FOOTER/controller.js:1296`)
  → `dataSources` com `label` por device (`:1330-1334`) →
  `openDashboardPopupEnergy({ mode:'comparison', dataSources, … })` (`:1406-1432`).
- **Footer reutilizável:** `createModalFooter` (`../footer-modal/ModalFooter.ts:75`),
  `ModalFooterInstance` (`setThemeMode`/`setCustomerName`/`setExportDisabled`/`destroy`).
  Mount em `AllReportModal.mountFooter()` (`:389-427`).
- **PDF:** `AllReportModal.computeKpis()` (`:690-723`) + `exportGridPdf(...)`
  (`telemetry-grid-shopping/export.ts:257`, `drawKpiBand()` `:376-398`,
  **rows = `TelemetryDevice[]`** via `buildRow` — name/identifier/val/perc).

## Correções obrigatórias (Revisão v1)

### P0 — Comparação exige um dataset MyIO de primeira classe
Comparação hoje não carrega dados locais. KPIs/PDF/CSV de comparação são **um novo
pipeline**, não UI pequena. **Requisitos:**
- estado `comparisonStats: ComparisonDeviceStats[]` + `partialErrors[]`, independente
  do iframe;
- fetch por-device **após** o chart do SDK começar a renderizar (não bloquear o
  chart);
- recomputar KPIs em mudança de **range** e **granularidade**;
- **desabilitar** export PDF/KPI até o agregado estar pronto;
- **falha parcial** por device (mostrar quais falharam);
- **guards de staleness/cancelamento** — fetch antigo não pode atualizar a modal
  após mudar período/gran/modo.

### P0 — `exportGridPdf` NÃO é reutilizável direto
Ele recebe `TelemetryDevice[]` e renderiza `labelOrName`/`deviceIdentifier`/`val`/`perc`.
O single exporta `EnergyData.consumption[]` por **timestamp**. Passar device sintético
perderia o time-series ou produziria linhas que não são devices. **Escolher uma:**
1. novo `exportTimeSeriesPdf()` (mesmo header/footer/KPI-band/chart-image, rows
   `timestamp/value/unit`);
2. estender `exportGridPdf` com **row-adapter** (`{ columns, rows, buildRow }`) sem
   quebrar os callers do telemetry-grid;
3. PDF de comparação = rows por-device (totais); **PDF single = time-series
   separado**.
Reutilizar só header/footer/KPI-band/document-shell. Definir o mapeamento **antes**
de codar; testar KPI band **e** rows.

### P0 — Agregação de KPI é unit-aware
O componente suporta `readingType: energy | water | tank | temperature`. **Regras no
contrato (não open question):**
- `energy`/`water`/`tank`: totais e por-device **aditivos**;
- `temperature`: **não somar** (tempo/devices) → **média, min, max, contagem/cobertura**;
- KPI "sem consumo" só para domínios aditivos;
- unidades/labels seguem o mapeamento existente: `kWh`, `m³`, `°C`.

### P1 — Fronteira estrita do CSV (single)
Manter o gerador; mover só o gatilho. Riscos: id `#export-csv-btn` sumir enquanto
código faz `getElementById`; botão habilitado antes de `currentEnergyData`;
comparação roteando p/ `exportToCsv()` (throw / guard de comparação). **Requisitos:**
- gerador **inalterado** (single);
- reatribuir o id `export-csv-btn` ao botão do footer **ou** atualizar todos os
  paths de enable/disable num passo só;
- **snapshot test** (BOM, linhas de metadata, célula de hora `1h`, filename);
- **CSV de comparação é feature separada** — **não** reusar o template single.

### P1 — Lifecycle do footer owned/destroyed
`private modalFooter: ModalFooterInstance | null`; mount uma vez por render, destroy
no close; tema via `setThemeMode`; enable/disable via `setExportDisabled` (**não**
`getElementById` espalhado); append no **root** da modal (como AllReportModal), não
dentro do flex do chart.

### P1 — "(i)" não pode depender só do HTML de `buildModalTitle()`
- definir dono (`EnergyModal` após `createModal` **ou** `EnergyModalView`);
- **botão real** com `aria-label`, não `(i)` texto;
- **escapar** labels/ids/customer antes de injetar no título;
- comparação usa `dataSources[]` com **ids** (não só labels);
- definir foco/close do popup.

### P1 — Custo/auth do fetch de comparação
N chamadas extras num path que já renderiza o iframe. **Requisitos:**
- max concorrência, retry, timeout;
- **um** `AuthClient`/token (não um token por device);
- comportamento acima de um threshold de devices;
- **não logar** credenciais/token (o FOOTER v5.2.0 ainda tem fallback de client
  credentials — não normalizar isso);
- confirmar paginação além de `pageSize=1000` (o `EnergyDataFetcher` não pagina).

### P1 — Parity de caller não é automática
Shopping v5.2.0 passa `dataSources[].label`. SIM v5.2.0 tem `openComparisonModal()`
próprio + fonte de creds própria; v5.4.0 resolve creds de SERVER_SCOPE/GCDR; UNIQUE
tem fluxos próprios. **Escopo de aceite = Shopping v5.2.0**; tasks explícitas de
verificação p/ SIM/UNIQUE/v5.4.0; **não** reivindicar HO parity sem verificar
labels/creds/dataApiHost/chartsBaseUrl/customerName por caller.

### P2 — Remoção do FECHAR (verificar)
Remover `#close-btn` (normal + BAS) e o listener. Aceite: shell **×** fecha; **Esc**
segue `closeOnEsc`; error-panel "Fechar" permanece.

### P2 — Substituir o stub de KPI (não coexistir)
Deletar o handler alert de `#show-kpis-btn` e não deixar `#energy-kpi-btn` morto;
substituir pela superfície escolhida (band inline / sidebar / painel pinado).

## Contrato de implementação (revisado)

### 1. Fases por risco de dados
1. **Footer + remoção do FECHAR + move do gatilho CSV** (single) — baixo risco.
2. **KPIs single + PDF single**.
3. **"(i)" single**.
4. **"(i)" comparação** (de `dataSources`).
5. **Fetch agregado de comparação + KPIs + política PDF/CSV**.
6. **Sidebar (opcional)**.

### 2. Estado de export explícito
```ts
type EnergyModalExportState =
  | { mode: 'single'; data: EnergyData }
  | { mode: 'comparison'; devices: ComparisonDeviceStats[]; partialErrors: ComparisonFetchError[] };
```
Single usa `currentEnergyData`; comparação preenche `ComparisonDeviceStats[]`.

### 3. Calculadoras unit-aware
```ts
computeSingleKpis(data: EnergyData, readingType): GridPdfKpi[]
computeComparisonKpis(stats: ComparisonDeviceStats[], readingType): GridPdfKpi[]
```
energy/water/tank → soma; temperature → média + min/max + contagem; "sem consumo" só
aditivo; formatação pt-BR existente.

### 4. Estratégia de PDF (escolher antes de codar)
generic time-series helper **ou** row-adapter em `exportGridPdf` **ou**
device-summary (comparação) + time-series (single). Com testes de KPI band + rows.

### 5. Footer via instância modal-owned
Espelhar `AllReportModal.mountFooter()`: customerName com fallback; ids legados;
habilitar CSV/PDF só com dado pronto; destroy no close; tema no toggle.

### 6. CSV de comparação separado
Single = byte-idêntico. Comparação (se entrar) = template novo (metadata + rows por
device: label/ingestionId/total/avg/min/max ou por-timestamp + seção de erro
parcial). **Nunca** chamar o `exportToCsv()` single em comparação.

## Test requirements
- CSV single snapshot **byte-idêntico** (BOM, `1h`).
- Footer renderiza CSV/PDF e roteia CSV ao gerador inalterado.
- `#close-btn` ausente (normal + BAS); error-close permanece.
- PDF single com KPIs e rows corretos.
- Row-adapter (se houver) não regride os exports do telemetry-grid.
- "(i)" single escapa labels e mostra device/customer/período.
- "(i)" comparação lista todos labels **+ ids** de `dataSources`.
- Agregado de comparação: sucesso multi-device; falha de 1 device degrada parcial;
  resultado stale ignorado após mudar range/gran; temperatura usa média/min/max.
- Botões do footer desabilitados até haver dado.

**Aceite manual:** single v5.2.0 (footer, CSV inalterado, PDF baixa, shell fecha,
sem "Fechar" na toolbar); comparação (chart imediato, popup lista devices, KPIs após
agregado, falhas visíveis sem quebrar o chart); BAS cabe com footer; tema consistente.

## Open questions
1. PDF single = time-series ou summary de um device?
2. PDF comparação = totais por device ou por-timestamp?
3. Máximo de devices para o fetch de KPI de comparação?
4. `15m` em períodos longos precisa paginação além de `pageSize=1000`?
5. CSV de comparação entra no 0226 ou é adiado?
6. O Energy Chart SDK expõe chart image/data por `postMessage`? Se não, PDF sem
   imagem do chart (documentar).
7. Superfícies em escopo de aceite: só Shopping v5.2.0, ou também SIM/UNIQUE/v5.4.0?

## Drawbacks
Comparação adiciona N fetches (latência/carga) inexistentes hoje — throttle/cache,
nunca bloquear o chart. Editar **duas toolbars** (normal + BAS). Chart em iframe →
imagem no PDF pode não existir sem hook do SDK.

## Rationale e alternativas
Reusar footer/PDF-infra do AllReportModal (temado, testado) vs bespoke → reusar (mas
com adapter de tabela). KPIs top-band vs sidebar (g): sidebar lê melhor num modal
chart-first (comparação com mais devices); band é mais simples. Mover CSV p/ footer
vs manter botão → mover, sem tocar o output.

## Prior art / referências
`AllReportModal` (RFC-0182) — footer/KPIs/PDF. `EnergySummaryTooltip` (RFC-0105) —
KPI/"(i)"/device-list. `ModalFooter`, `exportGridPdf`. Consumers:
`openDashboardPopupEnergy` (`src/index.ts:428`), FOOTER comparação
(`v-5.2.0/WIDGET/FOOTER/controller.js:1406`); SIM/UNIQUE/v5.4.0 a verificar.

## Recomendação
Aceitar com mudanças. Implementar **faseado por risco de dados** (§1): a limpeza de
UI baixo-risco (footer, FECHAR, move do CSV) separada do pipeline alto-risco da
comparação. A 1ª PR = footer + FECHAR + move do gatilho CSV (single) **com o snapshot
test do CSV**.

## Histórico
- **v0 (2026-07-17):** rascunho (chamava `exportGridPdf` direto; comparação como UI
  pequena).
- **Revisão v1 (2026-07-17):** accept with changes — dataset de comparação,
  estratégia de PDF, KPI unit-aware, lifecycle do footer, fronteira do CSV, parity
  de caller, rollout faseado. **Consolidada aqui.**
