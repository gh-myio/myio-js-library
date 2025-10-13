self.onInit = function () {
  const settings = self.ctx.settings || {};
  const scope = self.ctx.$scope;

  scope.links = settings.links || [];
  scope.groupDashboardId = settings.groupDashboardId;

  // RFC-0042: State ID to Domain mapping
  const DOMAIN_BY_STATE = {
    telemetry_content: 'energy',
    water_content: 'water',
    temperature_content: 'temperature',
    alarm_content: null // No domain for alarms
  };

  scope.changeDashboardState = function (e, stateId, index) {
    e.preventDefault();

    // Marca o link selecionado e desmarca os outros
    scope.links.forEach((link, i) => link.enableLink = (i === index));

    // RFC-0042: Notify orchestrator of tab change
    const domain = DOMAIN_BY_STATE[stateId];
    if (domain) {
      console.log(`[MENU] Tab changed to domain: ${domain}`);
      window.dispatchEvent(new CustomEvent('myio:dashboard-state', {
        detail: { tab: domain }
      }));
    }

    try {
      const main = document.getElementsByTagName("main")[0];
      if (!main) {
        console.error("[menu] Elemento <main> não encontrado.");
        return;
      }

      // Mapeia os stateId para os valores codificados
      let stateParam;
      switch (stateId) {
        case "telemetry_content":
          stateParam = "W3siaWQiOiJ0ZWxlbWV0cnlfY29udGVudCIsInBhcmFtcyI6e319XQ%253D%253D";
          break;
        case "water_content":
          stateParam = "W3siaWQiOiJ3YXRlcl9jb250ZW50IiwicGFyYW1zIjp7fX1d";
          break;
        case "temperature_content":
          stateParam = "W3siaWQiOiJ0ZW1wZXJhdHVyZV9jb250ZW50IiwicGFyYW1zIjp7fX1d";
          break;
        case "alarm_content":
          stateParam = "W3siaWQiOiJhbGFybV9jb250ZW50IiwicGFyYW1zIjp7fX1d";
          break;
        default:
          stateParam = undefined;
      }

      // Função que pega o segmento depois de 'all/'
      function getSegmentAfterAll() {
        const href = window.location.href;
        const match = href.match(/all\/([^\/?#]+)/i);
        return match ? match[1] : null; // retorna null se não achar
      }

      const dashboardId = getSegmentAfterAll(); // apenas o valor dinâmico, sem fallback

      if (!stateParam) {
        console.warn(`[menu] Nenhum stateParam definido para stateId: ${stateId}`);
        main.innerHTML = `<div style="padding:20px; text-align:center; font-size:16px;">não tem</div>`;
        return;
      }

      if (!dashboardId) {
        console.error("[menu] Nenhum dashboardId encontrado na URL atual.");
        main.innerHTML = `<div style="padding:20px; text-align:center; font-size:16px;">Dashboard inválido</div>`;
        return;
      }

      // Monta a URL do iframe (embed ThingsBoard)
      const url = `/dashboard/${dashboardId}?&state=${stateParam}`;

      // Insere o iframe dentro do <main>
      main.innerHTML = `
        <iframe 
          src="${url}" 
          width="100%" 
          height="100%" 
          frameborder="0"
          style="border:0;" 
          allowfullscreen 
          title="Dashboard ThingsBoard"
        >
          Seu navegador não suporta iframes.
        </iframe>`;
    } catch (err) {
      console.warn("[menu] Falha ao abrir estado:", err);
    }
  };
};
