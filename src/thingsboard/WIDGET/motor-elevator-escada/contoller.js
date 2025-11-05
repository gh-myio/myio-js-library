function getData(dataKeyName) {
  for (const device of self.ctx.data) {
    if (device.dataKey.name === dataKeyName) {
      return device.data[0][1]; // retorna o valor
    }
  }

  return null; // caso não encontre
}

let img; // deixar global pro widget
let MyIO = null; // Referência para MyIOLibrary

self.onInit = function () {
  // Inicializa referência ao MyIOLibrary
  MyIO = (typeof MyIOLibrary !== "undefined" && MyIOLibrary)
    ? MyIOLibrary
    : null;

  if (!MyIO) {
    console.error("[MOTOR-ELEVATOR-ESCADA] MyIOLibrary não encontrada");
  }

  const type = getData("deviceType");
  const container = document.getElementById("image-container");
  const entityId = self.ctx.datasources[0].entityId;
  const entityType = self.ctx.datasources[0].entityType;

  img = document.createElement("img");
  img.alt = "Imagem Fullscreen";
  img.classList.add("fullscreen-image");

  // Device image mapping
  const deviceImages = {
    MOTOR: "/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT",
    "3F_MEDIDOR": "/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k",
    RELOGIO: "/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB",
    HIDROMETRO: "/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4",
    ENTRADA: "/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU",
    CAIXA_DAGUA: "/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq",
    ELEVADOR: "/api/images/public/rAjOvdsYJLGah6w6BABPJSD9znIyrkJX",
    ESCADA_ROLANTE: "/api/images/public/EJ997iB2HD1AYYUHwIloyQOOszeqb2jp",
    TERMOSTATO: "/api/images/public/Q4bE6zWz4pL3u5M3rjmMt2uSis6Xe52F",
  };

  // Default image se o tipo não for encontrado
  const defaultImage = "/api/images/public/rHndQ3zHIaJHYBmHFhquFmSQtjg6at4o";

  img.src = deviceImages[type] || defaultImage;

  container.appendChild(img);

  // Handler para abrir configurações usando MyIO
  $("#svg-right").on("click", async function () {
    if (!MyIO || !MyIO.openDashboardPopupSettings) {
      console.error("[MOTOR-ELEVATOR-ESCADA] MyIO.openDashboardPopupSettings não disponível");
      return;
    }

    const jwt = localStorage.getItem("jwt_token");

    try {
      // Buscar informações do dispositivo
      const entityResponse = await fetch(`/api/device/${entityId}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${jwt}`,
        },
      });

      if (!entityResponse.ok) {
        throw new Error("Erro ao buscar informações do dispositivo");
      }

      const entity = await entityResponse.json();
      const label = entity.label || entity.name || "Sem etiqueta";

      // Abre o popup de configurações usando MyIO
      await MyIO.openDashboardPopupSettings({
        deviceId: entityId, // TB deviceId
        label: label,
        jwtToken: jwt,
        domain: "energy", // Domínio do widget
        ui: {
          title: "Configurações",
          width: 900
        },
        onSaved: (payload) => {
          console.log("[MOTOR-ELEVATOR-ESCADA] Configurações salvas:", payload);
          // Recarrega a página após salvar
          window.location.reload();
        },
        onClose: () => {
          $(".myio-settings-modal-overlay").remove();
        }
      });
    } catch (e) {
      console.error("[MOTOR-ELEVATOR-ESCADA] Erro ao abrir configurações:", e);
    }
  });
};

// sempre que o dado atualizar
self.onDataUpdated = function () {
  const consumo = getData("consumption");

  if (consumo > 500) {
    img.classList.add("blinking");
  } else {
    img.classList.remove("blinking");
  }
};
