# Plano de testes Playwright — Conciliação Head Office × Shoppings

> Status: **plano** (nada implementado ainda) · Data: 2026-10-10 · Ambiente alvo: **produção** (somente leitura)

## 1. Objetivo

Garantir que os números que o **Head Office** (HO, widget `src/thingsboard/MYIO-SIM/v5.2.0_UNIQUE`) mostra para cada shopping batem com o que o **dashboard do próprio shopping** (widgets `src/thingsboard/main-dashboard-shopping/v-5.2.0`) mostra, no mesmo período.

Fluxo:

1. Entrar no HO e ler os 6 cards do welcome (um por shopping).
2. Entrar em cada shopping e coletar energia e água de **D-7 00:00 até D-1 23:59 (America/Sao_Paulo)**. Exemplo: hoje = 10/10, então o período é 03/10 00:00 → 09/10 23:59. Da temperatura, coletar só a quantidade de sensores e a leitura atual.
3. Voltar ao HO (`https://dashboard.myio-bas.com/dashboards/all/bf839840-7990-11f1-9875-9d92dab6711d`), aplicar o mesmo período e conciliar shopping a shopping.

Fora de escopo nesta fase: a série histórica de temperatura, alarmes, anotações e as ações de escrita (reconhecer, adiar, Limpar cache…).

## 2. Escopo — shoppings

Os IDs vêm dos atributos `data-dashboard-id` e `data-entity-id` de cada `.myio-welcome-card`. **O teste lê os IDs da tela, não do código.** A tabela abaixo serve só de referência e de sanity check.

| Shopping | dashboardId | customer (entityId) |
|---|---|---|
| Metrópole | `aaa21b80-d6e9-11f0-998e-25174baff087` | `01369a40-d6ac-11f0-998e-25174baff087` |
| Rio Poty | `d432db90-cee9-11f0-998e-25174baff087` | `0c433230-cedd-11f0-998e-25174baff087` |
| Moxuara | `4b53bbb0-b5a7-11f0-be7f-e760d1498268` | `5085bf40-b4dd-11f0-be7f-e760d1498268` |
| Shopping da Ilha | `d2754480-b668-11f0-be7f-e760d1498268` | `209424d0-b04f-11f0-9722-210aa9448abc` |
| Montserrat | `39e4ca30-b503-11f0-be7f-e760d1498268` | `bef16b70-a93c-11f0-afe1-175479a33d89` |
| Mestre Álvaro | `6c188a90-b0cc-11f0-9722-210aa9448abc` | `20b93da0-9011-11f0-a06d-e9509531b1d5` |

## 3. Pré-requisitos e configuração

| Item | Decisão |
|---|---|
| Runner | `@playwright/test` (o repo ainda não tem Playwright; ver §9) |
| Navegador | Chromium, viewport 1920×1080 |
| Timezone / locale | `timezoneId: 'America/Sao_Paulo'`, `locale: 'pt-BR'`. **Obrigatório**: o picker e o `toISO()` do HEADER usam a hora local do browser |
| Execução | `workers: 1`, `test.describe.configure({ mode: 'serial' })`, porque é produção e a ordem dos passos importa |
| Timeouts | teste 10 min · `expect` 60 s · navegação 90 s. Os dashboards carregam com toasts progressivos e podem levar 20–40 s |
| Autenticação | login no TB uma única vez num `globalSetup` → `storageState` (`.auth/tb.json`, no `.gitignore`). Credenciais em `TB_USER` / `TB_PASS` (env/CI secret), **nunca no código** |
| Retries | `0` localmente e `1` no CI (só para falhas de rede) |
| Artefatos | `trace: 'retain-on-failure'`, screenshot a cada passo-chave e o JSON de coleta por shopping em `test-results/ho-reconciliation/` |

### 3.1 Cálculo do período (D-7 → D-1, horário de Brasília)

```ts
// helpers/period.ts
export function lastSevenFullDays(now = new Date()) {
  // calcula no fuso de SP independentemente da máquina do CI
  const sp = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now); // "2026-10-10"
  const today = new Date(`${sp}T00:00:00-03:00`);
  const start = new Date(today.getTime() - 7 * 86_400_000);       // D-7 00:00
  const end = new Date(today.getTime() - 60_000);                  // D-1 23:59
  return {
    startISO: toOffsetISO(start), // 2026-10-03T00:00:00-03:00
    endISO: toOffsetISO(end),     // 2026-10-09T23:59:00-03:00
    label: `${fmt(start)} até ${fmt(end)}`, // "03/10/26 00:00 até 09/10/26 23:59"
  };
}
```

> Brasil sem horário de verão: o offset fixo `-03:00` é seguro. Se o horário de verão voltar, trocar o cálculo para Luxon/date-fns-tz.

## 4. Arquitetura dos testes (Page Objects)

```
tests/e2e/ho-reconciliation/
├── TEST-PLAN.md                  (este arquivo)
├── playwright.config.ts
├── global-setup.ts               login TB → storageState
├── helpers/period.ts             D-7..D-1 em America/Sao_Paulo
├── helpers/parse.ts              "1.234,567 MWh" → 1234567 (kWh) etc.
├── pages/HeadOfficePage.ts       welcome, período, leitura do classified
├── pages/ShoppingDashboardPage.ts período HEADER, menu, leitura de STATE
├── reconcile.ts                  regras de comparação + tolerâncias
├── report.ts                     tabela HTML/JSON anexada ao relatório
└── ho-reconciliation.spec.ts
```

A coleta lê **primeiro os globals da página** (`page.evaluate`), que já vêm em número, e só depois confere o texto do DOM. O DOM vem formatado em pt-BR com troca automática kWh/MWh e serve como segunda checagem.

## 5. Casos de teste

### Fase A — Head Office: welcome

| ID | Passo | Verificação |
|---|---|---|
| HO-01 | Abrir a URL do HO | `.myio-welcome-modal` visível |
| HO-02 | Esperar o welcome ficar pronto | `#welcomeCtaBtn` visível e habilitado e nenhum `.myio-welcome-card .count-spinner` (o CTA tem fallback de 15 s) |
| HO-03 | Ler os cards `.myio-welcome-card` | **6 cards**; todos com `data-dashboard-id` e `data-entity-id`, e com a classe `--clickable` |
| HO-04 | Ler os badges de cada card | `energy/water/temperature .count` (qtd. de devices), `users`, `alarms`. Guardar como `welcome[shopping]` |
| HO-05 | Normalizar o nome | `.myio-welcome-card-title` quebra linha a cada 25 caracteres e corta com "…": usar `innerText.replace(/\s+/g,' ')` |

### Fase B — Shopping a shopping (repetir para os 6)

| ID | Passo | Verificação / coleta |
|---|---|---|
| SH-01 | Navegação: no 1º shopping, **clicar no card**; nos demais, usar `goto` direto em `/dashboards/{dashboardId}?state=<base64>` (mesmo formato do `openWelcomeModal`) | A URL contém o `dashboardId`; `MyIOOrchestrator.customerTB_ID === entityId` |
| SH-02 | Esperar a carga inicial | `#myio-loading-spinner-overlay` sem `.show` **e** `MyIOOrchestratorData.energy.periodKey` presente sem o sufixo `:loading` |
| SH-03 | Aplicar o período pelo HEADER: `$('input[name="startDatetimes"]').data('daterangepicker')` → `setStartDate` / `setEndDate` → `clickApply()` (o Apply já clica em Carregar) | O input mostra `03/10/26 00:00 até 09/10/26 23:59` |
| SH-04 | **Energia**: esperar `MyIOOrchestratorData.energy.periodKey === '{customerTB}:energy:{startISO}:{endISO}:day'` | Coletar de `STATE.energy`: total da **Entrada** (`summary.entrada.summary.total`, que é o total do shopping), Lojas, Climatização, Elevadores, Esc. Rolantes, Outros, Área Comum, qtd. de devices e a lista `items[] {id=ingestionId, label, value}` |
| SH-05 | Conferir o DOM de energia | `#entradaTotal`, `#lojasTotal`, …, `#consumidoresTotal` parseados batem com o STATE (tolerância de arredondamento) |
| SH-06 | Invariante RFC-0128 | `Área Comum = max(0, Entrada − (Lojas+Climatização+Elevadores+Esc.Rolantes+Outros))`; se o resíduo der negativo, registrar **alerta** |
| SH-07 | **Água**: clicar em `a.menu-item:has-text("Água")` e esperar o periodKey de `water` | Coletar de `STATE.water`: total da **Entrada** (`summary.total`), Lojas, Banheiros, Área Comum, Pontos Não Mapeados e os itens. No DOM, o total fica em `#waterTotalConsumidores` (em modo água, `#consumidoresTotal` mostra Não Mapeados) |
| SH-08 | Invariante água | `Não Mapeados = max(0, Entrada − (Lojas+Banheiros+Área Comum))` |
| SH-09 | **Temperatura (só contagem e leitura atual)**: clicar em "Temperatura" | Coletar de `MyIOOrchestratorData.temperature.items` (**não** de `STATE.temperature`, que é sobrescrito com dados no formato de energia): qtd. de sensores, leitura atual (`temperature + offSetTemperature`), qtd. de leituras frescas / atrasadas / offline, média, mín. e máx. |
| SH-10 | Contagens × welcome | Energia, água e temperatura × badges do welcome (HO-04) |
| SH-11 | Oráculo de API (opcional, recomendado) | Dentro da página: `MyIOOrchestrator.getCredentials()` → `/telemetry/customers/{ingestionId}/summary?readingType=energy\|water&granularity=1d&startTime&endTime`. A soma de `total` **só dos ingestionIds da Entrada** deve bater com SH-04 / SH-07. As credenciais ficam só no contexto do browser e nunca vão para log ou artefato |
| SH-12 | Persistir | `test-results/ho-reconciliation/{shopping}.json` + screenshots dos painéis de energia, água e temperatura |

> **Não esperar** pelos eventos `myio:water-summary-ready` e `myio:energy-summary-ready`: no v-5.2.0 eles não disparam nesse fluxo. A espera confiável é o `periodKey` mais o overlay.

### Fase C — Head Office com o período

| ID | Passo | Verificação / coleta |
|---|---|---|
| HO-10 | Voltar ao HO e fechar o welcome (`#welcomeCtaBtn`) | Modal oculto |
| HO-11 | Aplicar o período: `$('#menuDateInput').data('daterangepicker')` → `setStartDate` / `setEndDate` → clicar em `.daterangepicker .applyBtn` | O input mostra o período; as requisições `…/customers/{holding}/summary?readingType=energy\|water&deep=1` (todas as páginas) saem com `startTime` / `endTime` corretos (capturar com `page.waitForResponse`). Fallback: `…/devices/totals` |
| HO-11b | Oráculo da holding: o `summary.byCustomer` da página 1 do `/summary` (total e qtd. de devices por shopping) | Guardar como `holdingByCustomer[shopping]` para a REC-10 |
| HO-12 | Esperar o reload | Toast "Dados atualizados com sucesso" ou `MyIOOrchestratorData.apiEnrichedAt` maior que o valor de antes do apply. **Atenção**: o reload por data **não** redispara `myio:data-ready`, então ler o `classified` direto |
| HO-13 | Coletar por shopping | Em `MyIOOrchestratorData.classified`, filtrar por `ownerName`/`customerId` → energia por contexto (`entrada`, `stores`, `equipments`), água por contexto (`hidrometro_entrada`, `hidrometro`, `banheiros`, `hidrometro_area_comum`) e temperatura (`termostato*`: qtd. e `temperature`) |
| HO-14 | Header do HO | `#myio-header-energy-kpi` / `#myio-header-water-kpi` parseados = soma do `classified` (o header soma equipamentos + lojas + **entrada**; ver §7) |

### Fase D — Conciliação

| ID | Regra | Tolerância | Severidade se falhar |
|---|---|---|---|
| REC-01 | Qtd. de devices por domínio: HO (`classified` por shopping) = shopping = badge do welcome | exata | erro |
| REC-02 | **Device a device** (por `ingestionId`): consumo no HO = consumo no shopping, para energia e água | máx(0,1%, 0,01 kWh / 0,001 m³) | erro (listar os N piores) |
| REC-03 | Energia — Entrada: Σ HO `entrada` do shopping = Entrada do shopping | 0,1% | erro |
| REC-04 | Energia — Lojas: Σ HO `stores` = Lojas do shopping | 0,1% | erro |
| REC-05 | Energia — demais (Climatização+Elevadores+Esc.+Outros): Σ HO `equipments` = soma das categorias do shopping | 0,5% | alerta (a categorização difere entre os widgets) |
| REC-06 | Água — Entrada: Σ HO `hidrometro_entrada` = Entrada do shopping | 0,1% | erro |
| REC-07 | Água — Lojas, Banheiros e Área Comum, grupo a grupo | 0,5% | alerta |
| REC-08 | Temperatura: qtd. de sensores do HO = shopping; média atual com diferença ≤ 0,5 °C (leituras em instantes diferentes) | ver ao lado | alerta |
| REC-09 | Oráculo da API (SH-11) = Entrada do shopping | 0,1% | erro |
| REC-10 | `byCustomer` da holding (HO-11b): qtd. de devices por shopping = devices do `/summary` do próprio shopping; o total serve de referência (soma todos os devices, entrada + sub-medidores, então **não** é comparado com a Entrada) | exata (qtd.) | alerta |

Desde a troca do HO para o `/summary` da holding (2026-10-10), os dois lados usam a mesma rota com `granularity=1d`. As tolerâncias continuam porque o picker pode mandar o fim como `23:59:00` e não `23:59:59`. **Logar os `startTime` e `endTime` efetivos dos dois lados** em todo relatório.

### Saída

`report.ts` gera uma tabela por shopping (linhas = regras REC, colunas = HO | Shopping | Δ | Δ% | status), anexada com `testInfo.attach` como HTML e JSON. Erros falham o teste; alertas aparecem no relatório como anotações (`test.info().annotations`).

## 6. Esperas e sinais de prontidão (resumo)

| Onde | Sinal confiável |
|---|---|
| Welcome do HO | `#welcomeCtaBtn` habilitado + sem `.count-spinner` |
| Shopping | `MyIOOrchestratorData[domínio].periodKey === esperado` (sem `:loading`) + `#myio-loading-spinner-overlay:not(.show)` |
| HO após o período | `apiEnrichedAt` mudou + respostas `…/devices/totals` recebidas |
| Erro | listener do evento `myio:orchestrator:error` e toast de erro → falha imediata com screenshot |

Evitar `waitForTimeout` fixo. O overlay só aparece depois de 800 ms, então esperar ele **sumir** e não ele aparecer.

## 7. Riscos e particularidades conhecidas

1. **Produção**: o teste é somente leitura. Proibido clicar em "Limpar" (`#tbx-btn-force-refresh`, abre `confirm()` e limpa cache), em ações de alarme ou em qualquer coisa de Configurações.
2. **Header de energia do HO** soma `entrada` + consumidores (equipamentos + lojas), ou seja, conta a entrada duas vezes. Por isso a conciliação compara por contexto (REC-03/04/05) e não pelo total do header. Vale abrir uma discussão sobre o KPI.
3. No shopping, **`STATE.energy.summary.total` não é o total**: ele soma lojas+entrada+área comum. O total do shopping é a Entrada.
4. **`STATE.temperature`** é sobrescrito com dados no formato de energia depois da carga (bug conhecido). Usar `MyIOOrchestratorData.temperature.items`.
5. **Limites do picker**: o HO aceita no máximo 31 dias e o shopping 90; o `maxDate` é o fim de hoje. D-7..D-1 está dentro dos dois.
6. **401 ou erro de carga** podem recarregar a página sozinhos (`handleDataLoadError`, reload em 6 s). O teste precisa tolerar um reload e refazer o passo uma vez.
7. **Cache**: o shopping guarda o `/summary` por 10 min e o HO guarda o enriquecimento por 5 min. Rodar logo depois de outra execução pode trazer dado em cache, o que é aceitável porque o período é fechado (D-1).
8. **Dados do dia D-1** podem ainda estar chegando nas primeiras horas do dia. Agendar a execução para depois das 06:00 BRT.
9. **Nomes**: o welcome usa `entityLabel` ("Metrópole") e o código usa "Metrópole Pará". Casar shoppings por **customerId**, nunca por nome.

## 8. Critérios de aceite do plano

- Uma execução completa (6 shoppings + HO) gera o relatório de conciliação com status por regra.
- A execução falha só por erro de dado (REC com severidade erro) ou por falha real de carga, e nunca por espera mal calibrada.
- Duração alvo: **≤ 15 min** para os 6 shoppings.

## 9. Próximos passos de implementação

1. Adicionar `@playwright/test` como devDependency e o script `npm run e2e:ho` (fora do `vitest`; manter `tests/e2e/**` fora do include do vitest).
2. Implementar `global-setup.ts` (login) e os helpers `period` e `parse`, com testes unitários dos parsers pt-BR ("1.234,567 MWh", "8.762,51 M³").
3. Page Objects HO e Shopping, começando por **1 shopping** (Montserrat) ponta a ponta.
4. Generalizar para os 6, gerar o relatório e depois rodar agendado (CI noturno ou manual).

## 10. Pontos em aberto (decidir antes de implementar)

1. **Tolerâncias**: 0,1% está bom para energia e água, ou o critério é igualdade exata?
2. **Oráculo de API (SH-11)**: incluir já na 1ª versão ou só a conciliação HO × shopping?
3. **Onde roda**: local (Chrome do dev) ou CI com usuário de serviço só leitura? Qual conta usar?
4. **Divergência = falha?** Ou só gerar o relatório e avisar (Slack/Jira) sem quebrar a build?
5. **Também rodar contra o TESTE** (lib `@homolog`) como gate antes de publicar a `latest`?
