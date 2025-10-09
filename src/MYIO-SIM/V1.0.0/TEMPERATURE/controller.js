function makeDemo() {
  // eixo X fixo (8 pontos)
  const hours = ["00:00","03:00","06:00","09:00","12:00","15:00","18:00","21:00"];
  const mk = (arr) => arr.map((v,i)=>({ t: hours[i], v }));

  // 4 séries de exemplo no gráfico (mantém parecido com o layout)
  const series = [
    { label: "L3 – Praça de Alimentação", data: mk([22.0,21.7,21.8,22.3,23.0,23.6,23.2,22.5]) },
    { label: "Térreo – Área Comum Sul",   data: mk([22.2,22.0,22.1,22.5,23.2,23.8,23.4,22.7]) },
    { label: "L2 – Área Comum Norte",     data: mk([21.9,21.6,21.7,22.1,22.9,23.4,23.0,22.3]) },
    { label: "Estacionamento",            data: mk([15.2,15.1,15.3,18.9,22.2,22.9,22.6,21.9]) }
  ];

  // KPIs
  const avgTemp   = 22.8;
  const hvacKw    = 156.8;
  const opMinutes = 14 * 60 + 25; // 14h25

  // LISTA: 12 devices
  const list = [
    {name:"L3 – Praça de Alimentação",  code:"TH-FC-01", temperature:24.5, energyKw:15.2, opMinutes: 12*60+45, status:'ok'},
    {name:"Estacionamento",             code:"TH-PK-01", temperature:22.1, energyKw: 8.7, opMinutes: 24*60,    status:'ok'},
    {name:"Térreo – Área Comum Sul",    code:"TH-LB-01", temperature:25.8, energyKw:22.4, opMinutes: 16*60+30, status:'warn'},
    {name:"L2 – Área Comum Norte",      code:"TH-MR-03", temperature:28.2, energyKw:18.9, opMinutes:  8*60+15, status:'ok'},
    {name:"L1 – Corredor Leste",        code:"TH-CL-07", temperature:23.4, energyKw: 9.3, opMinutes: 10*60+10, status:'ok'},
    {name:"L1 – Corredor Oeste",        code:"TH-CO-05", temperature:23.9, energyKw:10.8, opMinutes:  9*60+25, status:'ok'},
    {name:"Administração 1",            code:"TH-AD-01", temperature:24.1, energyKw:11.5, opMinutes: 11*60+40, status:'ok'},
    {name:"Administração 2",            code:"TH-AD-02", temperature:24.7, energyKw:12.2, opMinutes: 12*60+ 5, status:'ok'},
    {name:"Praça Central",              code:"TH-PC-01", temperature:25.1, energyKw:13.6, opMinutes: 13*60+35, status:'warn'},
    {name:"Cinema – Lobby",             code:"TH-CN-02", temperature:22.6, energyKw: 7.9, opMinutes:  7*60+55, status:'ok'},
    {name:"Praça de Serviços",          code:"TH-PS-04", temperature:23.2, energyKw: 9.8, opMinutes:  6*60+20, status:'ok'},
    {name:"Acesso Norte",               code:"TH-AN-03", temperature:22.8, energyKw: 6.4, opMinutes:  5*60+10, status:'ok'}
  ];

  return { series, avgTemp, hvacKw, opMinutes, list };
}

/* ====== Settings esperados =========================================
settings = {
  useDemoData: true|false,     // pré-visualização sem dados reais
  targetTemp: 23,              // meta p/ subtítulo do card 1
  targetTol: 2,                // tolerância ±
  // Mapear chaves das datasources (opcional, se usar dados reais)
  ds: {
    // Timeseries para o gráfico (cada série = um label)
    // Ex.: alias 0 com keys: ["L3 Praça de Alimentação","Estacionamento","Térreo – Área Comum Sul","L2 – Área Comum Norte"]
    chartAlias: 0,

    // Últimos valores para KPIs (podem vir de atributos ou last telemetry)
    kpi: {
      avgTempAlias: 0,   avgTempKey: "avgTemp",
      hvacAlias: 0,      hvacKey: "hvacKw",
      opMinAlias: 0,     opMinKey: "opMinutes"
    },

    // Lista de sensores: pode vir de alias 1 (atributos/telemetrias last)
    // Esperado um array de objetos (via attribute JSON ou montado no controller)
    listAlias: 1,        listKey: "sensorsJson"
  }
}
==================================================================== */

self.onInit = function () {
  const ctx = self.ctx;

  // elementos
  const $avgTemp = document.getElementById('avgTemp');
  const $avgTempBar = document.getElementById('avgTempBar');
  const $avgTempTarget = document.getElementById('avgTempTarget');
  const $hvacKw = document.getElementById('hvacKw');
  const $hvacBar = document.getElementById('hvacBar');
  const $opTime = document.getElementById('opTime');
  const $opBadge = document.getElementById('opBadge');
  const $list = document.getElementById('sensorList');

  // configura alvo
  const target = Number(ctx.settings?.targetTemp ?? 23);
  const tol = Number(ctx.settings?.targetTol ?? 2);
  $avgTempTarget.textContent = `Meta: ${target}°C ± ${tol}°C`;

  // Chart.js
  let chart;
  function renderChart(series) {
    const el = document.getElementById('tempChart');
    if (chart) { chart.destroy(); chart = undefined; }
    const labels = series?.[0]?.data?.map(p => p.t) ?? [];
    chart = new Chart(el.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: series.map((s, i) => ({
          label: s.label,
          data: s.data.map(p => p.v),
          fill: false,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: 'rgba(28,39,67,0.12)', drawTicks:false } },
          y: { grid: { color: 'rgba(28,39,67,0.12)' }, suggestedMin: 15, suggestedMax: 30 }
        },
        plugins: { legend: { display: true, labels: { boxWidth: 12 } } }
      }
    });
  }

  function fmtKW(v){ return `${Number(v).toFixed(1)} kW`; }
  function fmtTemp(v){ return `${Number(v).toFixed(1)}°C`; }
  function fmtOp(min){
    min = Number(min||0);
    const h = Math.floor(min/60), m = min%60;
    return `${h}h ${String(m).padStart(2,'0')}m`;
  }

  function setKpis({avgTemp, hvacKw, opMinutes}) {
    // temperatura
    $avgTemp.textContent = fmtTemp(avgTemp);
    const span = Math.max(0, Math.min(100, ((avgTemp - (target - tol)) / (2*tol)) * 100));
    $avgTempBar.style.width = `${span}%`;

    // hvac
    $hvacKw.textContent = fmtKW(hvacKw);
    $hvacBar.style.width = `${Math.max(0, Math.min(100, (hvacKw / 300) * 100))}%`; // escala simples

    // operação
    $opTime.textContent = fmtOp(opMinutes);
    $opBadge.classList.toggle('badge-on', true);
  }

  function renderList(items) {
    $list.innerHTML = '';
    items.forEach(row => {
      const status = row.status || 'ok'; // ok|warn|off
      const el = document.createElement('div');
      el.className = 'sensor-row';
      el.innerHTML = `
        <div class="sensor-left">
          <span class="dot ${status}"></span>
          <div>
            <div class="sensor-name">${row.name}</div>
            <div class="sensor-code">${row.code || ''}</div>
          </div>
        </div>
        <div class="ft">
          <div class="label">Temperatura</div>
          <div class="value">${fmtTemp(row.temperature)}</div>
        </div>
        <div class="ft">
          <div class="label">Energia</div>
          <div class="value">${fmtKW(row.energyKw)}</div>
        </div>
        <div class="ft">
          <div class="label">Operação</div>
          <div class="value">${fmtOp(row.opMinutes)}</div>
        </div>
      `;
      $list.appendChild(el);
    });
  }

  // ====== DEMO DATA (para pré-visualização) ======
  /*
  function makeDemo() {
    const hours = ["00:00","03:00","06:00","09:00","12:00","15:00","18:00","21:00"];
    const mk = (arr) => arr.map((v,i)=>({t:hours[i], v}));
    const series = [
      { label: "L3 – Praça de Alimentação", data: mk([22.0,21.7,21.8,22.3,23.0,23.6,23.2,22.5]) },
      { label: "Térreo – Área Comum Sul",   data: mk([22.2,22.0,22.1,22.5,23.2,23.8,23.4,22.7]) },
      { label: "L2 – Área Comum Norte",     data: mk([21.9,21.6,21.7,22.1,22.9,23.4,23.0,22.3]) },
      { label: "Estacionamento",            data: mk([15.2,15.1,15.3,18.9,22.2,22.9,22.6,21.9]) }
    ];
    const avgTemp = 22.8;
    const hvacKw = 156.8;
    const opMinutes = 14*60 + 25;
    const list = [
      {name:"L3 – Praça de Alimentação", code:"TH-FC-01", temperature:24.5, energyKw:15.2, opMinutes: (12*60)+45, status:'ok'},
      {name:"Estacionamento", code:"TH-PK-01", temperature:22.1, energyKw:8.7, opMinutes: 24*60, status:'ok'},
      {name:"Térreo – Área Comum Sul", code:"TH-LB-01", temperature:25.8, energyKw:22.4, opMinutes: 16*60+30, status:'warn'},
      {name:"L2 – Área Comum Norte", code:"TH-MR-03", temperature:28.2, energyKw:18.9, opMinutes: 8*60+15, status:'ok'}
    ];
    return {series, avgTemp, hvacKw, opMinutes, list};
  }
  */

  // ====== Entrada via datasources do ThingsBoard ======
  function readFromCtx() {
    const s = ctx.settings?.ds || {};
    const data = ctx.data || [];

    // KPIs (podem vir como last value)
    const kpi = {
      avgTemp: Number(ctx.$scope?.latestTelemetry?.[s.kpi?.avgTempKey] ??
                      ctx.latestData?.[s.kpi?.avgTempAlias]?.data?.[s.kpi?.avgTempKey]?.[0]?.[1] ?? NaN),
      hvacKw: Number(ctx.$scope?.latestTelemetry?.[s.kpi?.hvacKey] ??
                     ctx.latestData?.[s.kpi?.hvacAlias]?.data?.[s.kpi?.hvacKey]?.[0]?.[1] ?? NaN),
      opMinutes: Number(ctx.$scope?.latestTelemetry?.[s.kpi?.opMinKey] ??
                        ctx.latestData?.[s.kpi?.opMinAlias]?.data?.[s.kpi?.opMinKey]?.[0]?.[1] ?? NaN)
    };

    // Chart series (timeseries de múltiplas keys)
    const chartDs = data?.[s.chartAlias];
    const series = [];
    if (chartDs?.data) {
      Object.keys(chartDs.data).forEach(key => {
        const arr = chartDs.data[key] || [];
        if (!arr.length) return;
        const points = arr.map(([ts, val]) => ({
          t: new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
          v: Number(val)
        }));
        series.push({label:key, data:points});
      });
    }

    // Lista (JSON em atributo/telemetria)
    let list = [];
    const raw = ctx.latestData?.[s.listAlias]?.data?.[s.listKey]?.[0]?.[1];
    if (raw) {
      try { list = JSON.parse(raw); } catch(e) { /* ignore */ }
    }

    // Se não houver avgTemp, calcula a média atual das últimas amostras
    if (Number.isNaN(kpi.avgTemp) && series.length) {
      const lastVals = series.map(s => s.data[s.data.length-1]?.v).filter(v=>Number.isFinite(v));
      kpi.avgTemp = lastVals.length ? (lastVals.reduce((a,b)=>a+b,0)/lastVals.length) : NaN;
    }

    return {series, ...kpi, list};
  }

  function updateAll() {
    const demo = !!ctx.settings?.useDemoData;
    const payload = demo ? makeDemo() : readFromCtx();

    // Guard rails
    if (!payload || !payload.series || !payload.series.length) {
      console.warn('[temp-widget] sem séries para o gráfico; ativando demo se permitido.');
      if (!demo) { const d = makeDemo(); renderChart(d.series); setKpis(d); renderList(d.list); return; }
    }
    renderChart(payload.series);
    setKpis(payload);
    renderList(payload.list || []);
  }

  // Ciclos do TB
  self.onDataUpdated = function() {
    updateAll();
  };
  self.onResize = function() {
    // Chart.js já é responsivo; se desejar, forçar update:
    // chart && chart.resize();
  };

  // primeira render
  updateAll();
};
