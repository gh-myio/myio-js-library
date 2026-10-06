# Showcase — Inventory Panel v2 (RFC-0237 · ED-1324)

Roda o widget `src/thingsboard/inventory-panel/v2.0.0/controller.js` fora do ThingsBoard,
com a lógica da biblioteca (`MyIOLibrary.inventory`, `src/utils/devices/inventory/`).
Cada etapa do RFC-0237 é conferida aqui antes de ir para o ThingsBoard.

## Rodar

```bash
npm run build                    # gera dist/myio-js-library.umd.js com o módulo inventory
showcase/inventory-panel-v2/start-server.bat   # ou ./start-server.sh — porta 3346
# abre http://localhost:3346/showcase/inventory-panel-v2/
```

Para parar: `stop-server.bat` / `stop-server.sh`.

## Como funciona

- A página carrega a lib do `dist/` e o **texto** do `controller.js`, e executa o controller
  dentro de `new Function('self', código)` — **uma closure por instância**, como o ThingsBoard
  faz. Por isso dá para montar **duas instâncias lado a lado** (AC-12).
- `self.ctx` simulado: `$container`, `settings` (defaults do `settings.schema` + `config.json`
  opcional), `stateController.openState` (só registra no log) e `http.get/post`, que devolvem
  um objeto no formato Observable (`toPromise` / `subscribe`), como o `HttpClient` do TB.
- Botões: **Montar** (`onInit`), **refresh()** e **Destruir** (`onDestroy`).

## Modos

| Modo | O que faz |
|---|---|
| **Mock** (padrão, sem login) | Responde `/api/customers` e `/api/entitiesQuery/find` a partir de `fixtures/devices.json`, paginado pelo `pageSize` da barra (padrão 25, para exercitar a paginação). Todos os valores vêm como **texto**, como o TB devolve. |
| **Real** (só leitura) | "🔑 Login TB" grava o JWT em `localStorage.jwt_token` e o `ctx.http` chama a API real do ThingsBoard. Use para repetir a calibração das regras (RFC-0237 §10, AC-11). |

Falhas simuladas (modo mock): falhar a página 2 (carga parcial), falhar a 1ª página (tela de
erro com "Tentar de novo"), falhar `/customers` (customerId vazio no export), páginas lentas
(barra de progresso) e "sem atributos MYIO" (todos os atributos vazios).

## Fixtures

`fixtures/devices.json` é **sintético** (nenhum dado de cliente) e é gerado por
`fixtures/generate.js`:

```bash
node showcase/inventory-panel-v2/fixtures/generate.js showcase/inventory-panel-v2/fixtures/devices.json
```

Cada device traz o campo `case` com o que ele exercita: dispositivos saudáveis, uma linha por
regra (C1–C8, A1, A2), cliente sem integração (regras "não se aplica"), devices do tenant,
arquivado / em estoque, sinais legados (`_ARQUIVADO_`, cliente "DESATIVAR"), `ingestionId`
duplicado (e o caso ignorado por ser de um arquivado), label vazio, label igual ao name,
nome começando com `=` (injeção de fórmula no CSV), texto com acento e label muito longo.
`lastActivityTime` usa o marcador `AGO:<horas>`, convertido para "agora − horas" ao carregar.
