self.onInit = function () {
  const settings = self.ctx.settings || {};
  const scope = self.ctx.$scope;

  scope.links = settings.links || [];
  scope.groupDashboardId = settings.groupDashboardId;

  scope.changeDashboardState = function (e, stateId, index) {
    e.preventDefault();

    // Marca o link selecionado e desmarca os outros
    scope.links.forEach((link, i) => link.enableLink = (i === index));

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
            break
        default:
          stateParam = undefined;
      }

      // Usa o dashboardId das configurações (se existir) ou fallback fixo
      const dashboardId = settings.dashboardId || "79111e50-9d68-11f0-afe1-175479a33d89";

      if (!stateParam) {
        console.warn(`[menu] Nenhum stateParam definido para stateId: ${stateId}`);
        main.innerHTML = `<div style="padding:20px; text-align:center; font-size:16px;">não tem</div>`;
        return;
      }

      // Monta a URL do iframe (embed ThingsBoard)
      const url = `/dashboard/${dashboardId}?embed=true&state=${stateParam}`;

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
