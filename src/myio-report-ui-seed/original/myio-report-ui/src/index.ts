import { ReportOptions, ReportRow, PremiumReportUI } from "./types";

const DEFAULTS = {
  adminPassword: "myio2025",
  defaultView: "card" as const,
  enableExports: true,
  lazyExpand: false
};

export function createPremiumReportUI(opts: ReportOptions): PremiumReportUI {
  const state = {
    options: { ...DEFAULTS, ...opts },
    rows: [] as ReportRow[],
    isCard: (opts.defaultView ?? DEFAULTS.defaultView) === "card",
    loading: { visible: false, status: "Loading…", progress: 0 },
    range: { start: new Date(), end: new Date() }
  };

  // basic skeleton (header + controls + container)
  const mount = opts.mount;
  mount.innerHTML = `
    <div id="ReportHeader" class="report-header">
      <div class="brand">
        <img id="Myio" alt="MyIO" />
        <div class="headline">
          <p>Relatório MyIO</p>
          <p><span id="issue-date"></span></p>
        </div>
      </div>
      <div class="actions">
        <button class="icon-btn" data-action="settings" title="Configurações">⚙️</button>
        <button class="icon-btn" data-action="pdf" title="Exportar PDF">📄</button>
        <button class="icon-btn" data-action="csv" title="Exportar CSV">🧾</button>
      </div>
    </div>
    <div class="view-controls">
      <div class="view-toggle">
        <button class="toggle-list">Lista</button>
        <button class="toggle-card">Cards</button>
      </div>
    </div>
    <div id="premium-loading-overlay" style="display:none">
      <div class="premium-loading-content">
        <div class="premium-spinner"></div>
        <div class="loading-status"></div>
        <div class="loading-timer">00:00</div>
        <div class="loading-progress"><div class="progress-bar" style="width:0%"></div></div>
      </div>
    </div>
    <div class="list-container" style="display:none"></div>
    <div class="card-view-container"></div>
  `;

  const els = {
    list: mount.querySelector(".list-container") as HTMLDivElement,
    cards: mount.querySelector(".card-view-container") as HTMLDivElement,
    overlay: mount.querySelector("#premium-loading-overlay") as HTMLDivElement,
    status: mount.querySelector(".loading-status") as HTMLDivElement,
    pbar: mount.querySelector(".progress-bar") as HTMLDivElement,
    toggleList: mount.querySelector(".toggle-list") as HTMLButtonElement,
    toggleCard: mount.querySelector(".toggle-card") as HTMLButtonElement,
  };

  function renderList(rows: ReportRow[]) {
    els.list.style.display = "";
    els.cards.style.display = "none";
    els.list.innerHTML = `
      <table class="fullwidth">
        <thead><tr><th>Dispositivo</th><th>${state.options.mode === "energy" ? "Consumo" : "Temperatura"}</th><th>Data</th></tr></thead>
        <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.deviceName || r.entityLabel || "-"}</td>
            <td>${state.options.mode === "energy" ? (r.consumptionKwh ?? "-") : (r.temperature ?? "-")}</td>
            <td>${r.reading_date ?? "-"}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    `;
  }

  function renderCards(rows: ReportRow[]) {
    els.cards.style.display = "grid";
    els.list.style.display = "none";
    const groups = new Map<string, ReportRow[]>();
    rows.forEach(r => {
      const k = r.deviceName || r.entityLabel || "Desconhecido";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    });
    els.cards.innerHTML = "";
    for (const [k, value] of groups) {
      const latest = value[value.length - 1];
      const chip = state.options.mode === "energy"
        ? `${latest?.consumptionKwh ?? "-"} kWh`
        : `${latest?.temperature ?? "-"}°C`;
      const card = document.createElement("div");
      card.className = "device-card";
      card.innerHTML = `
        <div class="device-card-header">
          <div class="device-info">
            <h3 class="device-name">${k}</h3>
            <div class="device-stats"><span class="stat">${chip}</span></div>
          </div>
          <div class="expand-icon">▾</div>
        </div>
        <div class="device-card-content" style="display:none">
          <div class="readings-table">
            <div class="reading-row header-row">
              <div>Valor</div><div>Data/Hora</div><div>Status</div>
            </div>
            ${value.map(v => `
              <div class="reading-row">
                <div>${state.options.mode === "energy" ? (v.consumptionKwh ?? "-") : (v.temperature ?? "-")}</div>
                <div>${v.reading_date ?? "-"}</div>
                <div>${v.interpolated ? "Interpolado" : ""}</div>
              </div>`).join("")}
          </div>
        </div>
      `;
      // Expand/collapse
      const header = card.querySelector(".device-card-header") as HTMLDivElement;
      const content = card.querySelector(".device-card-content") as HTMLDivElement;
      header.addEventListener("click", () => {
        content.style.display = content.style.display === "none" ? "" : "none";
      });
      els.cards.appendChild(card);
    }
  }

  function applyView() {
    if (state.isCard) renderCards(state.rows);
    else renderList(state.rows);
  }

  // toggles
  els.toggleList.addEventListener("click", () => { state.isCard = false; applyView(); });
  els.toggleCard.addEventListener("click", () => { state.isCard = true; applyView(); });

  function render(rows: ReportRow[]) {
    state.rows = rows.slice();
    applyView();
  }

  let timerId: number | null = null;
  function setLoading(status: string, progress: number) {
    state.loading = { visible: true, status, progress };
    els.overlay.style.display = "flex";
    els.status.textContent = status;
    els.pbar.style.width = `${progress}%`;
    if (timerId == null) {
      const start = Date.now();
      timerId = window.setInterval(() => {
        const s = Math.floor((Date.now() - start) / 1000);
        const mm = String(Math.floor(s / 60)).padStart(2, "0");
        const ss = String(s % 60).padStart(2, "0");
        const timerEl = mount.querySelector(".loading-timer") as HTMLDivElement;
        if (timerEl) timerEl.textContent = `${mm}:${ss}`;
      }, 1000);
    }
    if (progress >= 100) {
      els.overlay.style.display = "none";
      if (timerId != null) { clearInterval(timerId); timerId = null; }
    }
  }

  function setDateRange(start: Date, end: Date) {
    state.range = { start, end };
  }

  function destroy() {
    mount.innerHTML = "";
  }

  return { render, setLoading, setDateRange, destroy };
}
