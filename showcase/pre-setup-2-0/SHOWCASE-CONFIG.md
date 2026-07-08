# Showcase — Pre-Setup 2.0: Configurações

Harness do widget **GCDR-Upsell-Setup v1.0.0** com backend real.

## Ambiente

| Variável | Valor |
|----------|-------|
| `_TB_URL` | `https://dashboard.myio-bas.com` |
| Porta do servidor | `3340` |
| Controller | `src/thingsboard/GCDR-Upsell-Setup/v.1.0.0/controller.js` |
| Build local (opcional) | `dist/myio-js-library.umd.js` |

## Autenticação

A showcase autentica automaticamente no `DOMContentLoaded` usando a conta de serviço:

| Campo | Valor |
|-------|-------|
| `_SERVICE_USER` | `alarmes@myio.com.br` |
| `_SERVICE_PASS` | `hubmyio@2025!` |
| Endpoint | `POST https://dashboard.myio-bas.com/api/auth/login` |

O token JWT é salvo em `localStorage.jwt_token` e reutilizado pelo widget.
Para renovar manualmente: botão **Re-Auth** no painel lateral.

## APIs consumidas pelo widget

| API | Host | Reescrita pelo harness? |
|-----|------|--------------------------|
| ThingsBoard | relativo `/api/*` | **Sim** → `_TB_URL` (patch de `window.fetch`) |
| MyIO Ingestion | `https://api.data.apps.myio-bas.com` | Não (URL absoluta) |
| GCDR API | `https://gcdr-api.a.myio-bas.com` | Não (URL absoluta) |

> O widget tem credenciais de ingestion e a master key do GCDR embutidas no
> próprio `controller.js` — o harness não precisa fornecê-las.

## ctx fornecido pelo harness

O widget só consome 2 campos do `ctx`:

```js
self.ctx = {
  $container: [ <div#gcdr-upsell-root> ],   // só precisa de [0] → elemento DOM
  settings: { forceClearChunkDelayMs: 5000 } // editável no painel lateral
};
```

Sem datasources (`ctx.data`), sem `MyIOOrchestrator`, sem `$scope`.

## Como Rodar

```bat
showcase\pre-setup-2-0\start-server.bat
```

Acesse: [http://localhost:3340/showcase/pre-setup-2-0/](http://localhost:3340/showcase/pre-setup-2-0/)

> A pasta é `pre-setup-2-0` (com hífen, sem ponto). O `npx serve` interpreta
> `2.0` como extensão de arquivo via `path.extname()` e deixa de servir o
> `index.html`, caindo na listagem de diretório.

## Testar `openUpsellModal` local

O botão "Abrir Upsell" do widget usa `MyIOLibrary.openUpsellModal()`. Por padrão,
o `controller.js` carrega `MyIOLibrary` do CDN (`@latest` publicado).

Para exercitar o código local de `src/components/premium-modals/upsell/openUpsellModal.ts`:

```bash
npm run build      # gera dist/myio-js-library.umd.js
```

O harness pré-carrega `dist/` se existir — o widget então usa o build local
em vez do CDN.
