# RFC-0204 — Modal "Carregando dados..." esconde antes dos dados estarem carregados (Diagnóstico)

- **Status:** Diagnóstico (sem implementação — aguardando decisão)
- **Data:** 2026-06-01
- **Contexto:** Shopping v-5.2.0 (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/`)
- **Evidência:** `WIDGET/dashboard.myio-bas.com-1780331704617-CLEAN.log`
- **Arquivo central:** `WIDGET/MAIN_VIEW/controller.js` (orchestrator)

## 1. Sintoma observado

Ao entrar no dashboard:

1. Modal mostra **"Carregando contrato..."**
2. Modal muda para **"Carregando dados..."**
3. Modal **some** — como se tudo estivesse carregado
4. Mas os widgets (TELEMETRY, TELEMETRY_INFO, etc.) só populam os cards **segundos depois**

O hide acontece próximo da linha de log `[RFC-0056] Received telemetry update: type=request_refresh, source=TELEMETRY_INFO`.

## 2. Como o hide funciona hoje

O hide do modal é controlado por um contador **`activeRequests`** (por domínio) no orchestrator:

- `showGlobalBusy(domain)` → incrementa (`MAIN_VIEW/controller.js:4632`)
- `hideGlobalBusy(domain)` → decrementa, clampado em `Math.max(0, prev-1)` (`:4746`)
- Quando `getActiveTotal()` chega a **0**, `performHide()` esconde o spinner (`:4791`)

**O que esse contador realmente mede:** o ciclo de vida do **fetch HTTP** (começou a buscar → terminou de buscar/emitir). Ele **não** mede se os widgets consumidores renderizaram os cards.

## 3. Causa raiz

### 3a. Semântica errada do gate
O modal é escondido quando o **fetch + emit do orchestrator** termina, não quando os **widgets renderizam** os dados. Mesmo no caminho feliz, há um intervalo entre `emitProvide` (orchestrator emite `myio:telemetry:provide-data`) e o momento em que cada widget processa o evento e desenha os cards.

### 3b. Acerto de contas frágil (+2 / −3) com coalescing
Para uma única carga de domínio o contador é movimentado por **três** funções:

| Função | Linha | Efeito |
|--------|-------|--------|
| `requestDataWithRetry` (pré-registro) | `:5022` | `showGlobalBusy` **+1** |
| `hydrateDomain` (início) | `:6659` | `showGlobalBusy` **+1** |
| `emitProvide` (sucesso) | `:6769` | `hideGlobalBusy` **−1** |
| `hydrateDomain` (`finally`) | `:6692` | `hideGlobalBusy` **−1** |
| `requestDataWithRetry` (`finally`) | `:5041` | `hideGlobalBusy` **−1** |

Efetivamente **+2 / −3**, clampado em 0. Com **coalescing** de requests duplicados (`hydrateDomain` retorna a promise `inFlight` em `:6653` *antes* do `showGlobalBusy` da linha 6659), os `finally` das chamadas coalescidas disparam decrementos que **zeram o contador enquanto o hydrate real ainda está em voo** — antes de `emitProvide` armazenar os dados.

## 4. Evidência no log (ordem real)

```
✅ Period available on attempt 2
📡 requestDataWithRetry → hydrateDomain(energy)
hydrateDomain called for energy: {inFlight: true, force: false}
⏭️ Coalescing duplicate request for ...:energy:...
DateRangePicker: Successfully initialized with period
✅ RFC-0137: LoadingSpinner hidden          ← modal some
✅ Global busy hidden
[TELEMETRY energy] 🔁 RFC-0136: Retry #2 - Checking for stored orchestrator data...
[TELEMETRY energy] ℹ️ No stored data found for domain energy   ← dados NÃO estavam lá
[RFC-0056] ⏱️ Fallback timeout - requesting refresh            ← só agora re-busca
[RFC-0056] Received request_refresh ... domain energy, periodKey realtime
...                                                            ← widgets populam aqui
```

**Não há** `📦 MyIOOrchestratorData updated` nem `📡 Emitted provide-data` *antes* do hide — confirmando que o fetch nem havia concluído quando o modal sumiu. A população real vem pelo caminho de **fallback** do RFC-0056, segundos depois.

## 5. Opções de correção (decidir depois)

| Opção | Descrição | Risco |
|-------|-----------|-------|
| **A — Gate em dados armazenados (mínimo)** | No `performHide()`, exigir `window.MyIOOrchestratorData[domain]?.items?.length > 0` antes de esconder; se o contador zerar antes, adiar o hide até o `emitProvide` real. | Baixo. Resolve o "apagou cedo", mas ainda não espera o render do widget. |
| **B — Gate no render do widget (correto)** | Widgets já emitem `widget:ready` (`TELEMETRY/controller.js:5001`). Adicionar ack `data-applied` após renderizar os cards; orchestrator só esconde quando todos os widgets visíveis do domínio confirmarem. | Médio/alto. Toca TELEMETRY/TELEMETRY_INFO. |
| **C — Corrigir o contador +2/−3 (causa raiz)** | Acertar o acerto de contas entre `requestDataWithRetry`/`hydrateDomain`/`emitProvide` + coalescing, para o contador só zerar após o `emitProvide` real. | Médio. Mantém semântica de fetch-complete. |

## 6. Recomendação preliminar

**A + C** combinadas dão o melhor custo/benefício: A é uma rede de segurança barata (não esconde sem dados armazenados) e C remove a causa raiz da contagem. B é o ideal de UX ("espera o pixel"), mas só vale se o atraso percebido persistir após A+C.

## 7. Referências

- `WIDGET/MAIN_VIEW/controller.js` — `showGlobalBusy` (`:4632`), `hideGlobalBusy` (`:4746`), `requestDataWithRetry` (`:5006`), `hydrateDomain` (`:6641`), `emitProvide` (`:6721`)
- `WIDGET/TELEMETRY/controller.js` — `hideBusy` (`:1894`), `widget:ready` (`:5001`), `dataProvideHandler` (`:6383`), RFC-0056 fallback (`:6388`)
- RFC-0137 (LoadingSpinner), RFC-0056 (request_refresh fallback), RFC-0048 (widgetBusyMonitor), RFC-0136 (widget:ready re-emit)
