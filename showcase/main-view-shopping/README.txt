O fluxo correto na showcase para testar o dashboard (energy modal) é:

  1. Re-Auth (Auth section)
  → Loga com alarmes@myio.com.br e obtém ghostAuthToken + salva no localStorage('jwt_token')
  → Obrigatório antes de qualquer coisa que use TB

  2. Create All (Components section)
  → Cria os componentes de UI (grids, header, menu, etc.)

  3. onInit (Widget Lifecycle section)
  → Executa self.onInit() do controller v5.4.0, que carrega dados, inicializa orchestrator, dispara eventos

  4. Load Real Devices (Data section)
  → Busca devices reais do TB e dispara myio:data-ready com eles

  5. Clicar no card → botão dashboard
  → Agora deve abrir openDashboardPopupEnergy com token válido

  A ordem que você fazia (Create All → onInit → Load Real Devices) estava certa, só faltava o Re-Auth primeiro. O ghostAuthToken é o 
  que o handleCardDashboard usa como tbJwtToken.