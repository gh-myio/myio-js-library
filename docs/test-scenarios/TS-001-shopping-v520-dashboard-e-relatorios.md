# TS-001 — Dashboard Shopping v5.2.0: carregamento e relatórios

> Cenário de teste manual/assistido (Chrome DevTools via MCP, porta 9222).
> Código sob teste: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/`
> (MAIN_VIEW, HEADER, MENU, TELEMETRY, FOOTER) + lib `myio-js-library` (`openDashboardPopupAllReport`, RFC-0181/0182/0223).
>
> Cada execução gera um arquivo em [`runs/`](./runs/) copiando a seção **Registro da execução** deste template.

---

## Parâmetros da execução

| Campo | Valor |
|---|---|
| Ambiente | `https://dashboard.myio-bas.com` (produção) |
| Dashboard | `Dashboard - Shopping da Ilha - v.5.2.0` *(trocar pelo shopping alvo)* |
| Cliente | *(customer do dashboard)* |
| Versão da lib carregada | *(ver `window.MyIOLibrary.version` ou o script `myio-js-library` na aba Network)* |
| Período padrão do dashboard | *(datas exibidas no HEADER ao abrir)* |
| Navegador | Chrome com `--remote-debugging-port=9222` (perfil `C:\Users\ounic\chrome-debug-9222`) |
| Executor / data | |

---

## Passos

### 0. Pré-condição
- Sessão já autenticada em `https://dashboard.myio-bas.com/`.
- Chrome de debug aberto na porta 9222 (ver `RUNBOOK` de debug ou `--remote-debugging-port=9222`).

### 1. Lista de dashboards
- Abrir `https://dashboard.myio-bas.com/dashboards/all`.
- **Esperado:** lista carrega, sem erro no console.

### 2. Abrir o dashboard alvo
- Filtrar pelo nome e abrir o dashboard.
- Antes de abrir: limpar console e network (ou registrar o instante `t0`).

### 3. Carregamento do dashboard principal
Registrar:

| Verificação | Como medir | Critério |
|---|---|---|
| Tempo até os cards de energia/água/temperatura terem valores | `t0` → spinner/busy some e KPIs do HEADER preenchidos | anotar (s) |
| Eventos de orquestração | console: `myio:data-ready`, `myio:energy-summary-ready`, `myio:water-summary-ready`, `myio:temperature-data-ready` | todos presentes |
| Erros de console | `list_console_messages` tipo `error` | nenhum novo (listar os pré-existentes) |
| Requisições com falha | network: status ≥ 400 ou `failed` | nenhuma |
| Requisições lentas | network: as 5 mais lentas (URL, status, tempo) | anotar; > 5 s é alerta |
| Valores do dashboard (referência) | KPIs do HEADER e totais por grupo (Entrada, Área Comum, Lojas…) por domínio | anotar como **baseline** para o passo 4 |

### 4. Relatórios (MENU → 📊 Relatórios)
Abrir o picker de relatórios e executar **cada card habilitado**, um por vez, com o **mesmo período** do dashboard.

Cards possíveis (os desabilitados aparecem com 🔒 — anotar e pular):

| Domínio | Cards |
|---|---|
| ⚡ Energia | Entrada · Área Comum · Lojas · Todos Dispositivos |
| 💧 Água | Entrada · Área Comum · Lojas · Todos Dispositivos |
| 🌡️ Temperatura | Ambientes Climatizáveis · Ambientes Não Climatizáveis · Todos Ambientes |
| 🔔 Alarmes | Por Dispositivo · Por Dispositivo × Tipo · Por Tipo de Alarme |

Para **cada relatório**, registrar:

| Verificação | Critério |
|---|---|
| Abre sem erro | modal abre; nenhum erro novo no console |
| Tempo de resposta | clique em "Carregar"/abertura → tabela preenchida (s); requisição principal (URL, status, ms) |
| Requisições com falha | nenhuma (status ≥ 400 / failed) |
| Dados zerados | quantidade de linhas; quantos dispositivos com total 0; total geral ≠ 0 |
| Conferência com o dashboard | total do relatório × total do grupo correspondente no dashboard (baseline do passo 3), mesma unidade e período; diferença absoluta e % |

**Tolerância de conferência:** diferença ≤ 1% (arredondamento/fuso). Acima disso → achado.

---

## Registro da execução (copiar para `runs/AAAA-MM-DD-<shopping>.md`)

### Carregamento

| Métrica | Valor |
|---|---|
| Tempo até dashboard pronto | |
| Eventos de orquestração | |
| Erros de console | |
| Requisições com falha | |
| 5 requisições mais lentas | |

### Baseline do dashboard

| Domínio | Grupo | Valor no dashboard | Unidade |
|---|---|---|---|

### Relatórios

| # | Domínio | Relatório | Habilitado | Tempo (s) | Linhas | Zerados | Total relatório | Total dashboard | Δ % | Erros console/network | Resultado |
|---|---|---|---|---|---|---|---|---|---|---|---|

### Achados

| # | Severidade | Descrição | Evidência | Sugestão / ticket |
|---|---|---|---|---|
