Pre-Setup 2.0 — GCDR Upsell Setup Showcase
============================================

Harness simulado para o widget ThingsBoard GCDR-Upsell-Setup v1.0.0
(src/thingsboard/GCDR-Upsell-Setup/v.1.0.0/controller.js).

Inspirado em showcase/main-view-shopping — usa backend REAL (auto-auth no
ThingsBoard de produção). O "simulado" é apenas o harness que dá boot no
widget fora do ThingsBoard.


COMO RODAR
----------
  showcase\pre-setup-2-0\start-server.bat      (Windows)
  showcase/pre-setup-2-0/start-server.sh       (Linux/Mac/Git Bash)

Acesse: http://localhost:3340/showcase/pre-setup-2-0/


FLUXO DE USO
------------
  1. Re-Auth (painel lateral, seção "Status & Auth")
     → Loga em dashboard.myio-bas.com com a conta de serviço
     → Salva o token em localStorage.jwt_token
     → Roda automaticamente no carregamento da página

  2. onInit (seção "Widget Lifecycle")
     → Carrega o controller.js do widget e chama self.onInit()
     → O widget renderiza no painel esquerdo (área branca)

  3. Selecione um cliente na lista do widget (painel esquerdo do widget)
     → O widget busca os clientes via TB API e mostra a lista

  4. Use os cards do widget:
     - GCDR Sync: Sincronizar, Force Update IDs, Raio X, Initial SETUP, ...
     - Upsell Setup: Force Clear, "Abrir Upsell" (wizard openUpsellModal)


COMO FUNCIONA
-------------
- O widget GCDR-Upsell-Setup foi escrito para rodar DENTRO do host do
  ThingsBoard, então usa URLs relativas (fetch('/api/customers')). O harness
  intercepta window.fetch e reescreve /api/* para https://dashboard.myio-bas.com.
  GCDR API e ingestion API já usam URL absoluta — não precisam de reescrita.

- O widget só consome ctx.$container[0] e ctx.settings.forceClearChunkDelayMs.
  O harness monta um ctx mínimo (sem datasources, sem orchestrator).

- "Abrir Upsell" chama MyIOLibrary.openUpsellModal(). O harness tenta
  pré-carregar dist/myio-js-library.umd.js (build local); se não existir,
  o widget carrega a versão publicada do CDN (guLoadMyIOLibrary).
  Para testar mudanças locais em openUpsellModal.ts: rode `npm run build`
  na raiz antes de abrir o showcase.


PARAR O SERVIDOR
----------------
  showcase\pre-setup-2-0\stop-server.bat
  showcase/pre-setup-2-0/stop-server.sh

Porta: 3340 (main-view-shopping usa 3339).

NOTA: a pasta é "pre-setup-2-0" (sem ponto). O `npx serve` trata "2.0"
como extensão de arquivo (path.extname) e não serve o index.html — por
isso o nome da pasta usa hífen.
