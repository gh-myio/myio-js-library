/* =========================
   MAPEAMENTO DOS DATAKEYS
   =========================
   Ajuste os nomes à sua realidade. Você pode usar:
   - Por alias: ctx.datasources[i].alias
   - Por entityName: ctx.datasources[i].entityName
   - Por dataKey name: dataKey.name
*/
const KEYS = {
  // TANK-001
  tank1: {
    levelPercent: ["TANK-001.levelPercent","levelPercent_tank1","nivel_percent_tank1"],
    levelCm:      ["TANK-001.levelCm","levelCm_tank1","nivel_cm_tank1"],
    flow:         ["TANK-001.flowLpm","flow_tank1","vazao_lpm_tank1"]
  },
  // TANK-002
  tank2: {
    levelPercent: ["TANK-002.levelPercent","levelPercent_tank2"],
    levelCm:      ["TANK-002.levelCm","levelCm_tank2"],
    flow:         ["TANK-002.flowLpm","flow_tank2"]
  },
  // HYD-001
  hydIn: {
    flow:  ["HYD-001.flowLpm","hyd_in_flow"],
    total: ["HYD-001.totalL","hyd_in_total"]
  },
  // HYD-002
  hydSub: {
    flow:  ["HYD-002.flowLpm","hyd_sub_flow"],
    total: ["HYD-002.totalL","hyd_sub_total"]
  },
  // Série para o gráfico (percentual do tanque principal ao longo do dia)
  series: ["TANK-001.levelPercent_series","tank1_series_percent"]
};

/* ==== Helpers para pegar valores do ctx.data ==== */
function latestFrom(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    for (const ds of (ctx.data || [])) {
      for (const d of (ds.data || [])) {
        if (d.dataKey && d.dataKey.name === key) {
          const arr = d.data || [];
          const last = arr[arr.length-1];
          if (last && Array.isArray(last)) return last[1];
        }
      }
    }
  }
  return null;
}

function seriesFrom(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    for (const ds of (ctx.data || [])) {
      for (const d of (ds.data || [])) {
        if (d.dataKey && d.dataKey.name === key) {
          return (d.data || []).map(p => ({ts:p[0], v:Number(p[1])||0}));
        }
      }
    }
  }
  return [];
}

/* ==== Bind no DOM ==== */
function setText(selector, value, suffix="") {
  const el = document.querySelector(`[data-bind="${selector}"]`);
  if (!el) return;
  el.textContent = (value ?? "--") + (value!=null ? suffix : "");
}

function setLevelBar(cardSel, pct) {
  const card = document.querySelector(cardSel);
  const fill = card?.querySelector(".levelbar .fill");
  if (fill) fill.style.setProperty("--pct", (Math.max(0,Math.min(100, Number(pct)||0))) + "%");
}

/* ==== Gráfico simples em Canvas (área preenchida) ==== */
function drawTrend(canvas, points /* array de {ts,v} [0..100] */) {
  const ctx2d = canvas.getContext("2d");
  const w = canvas.width = canvas.clientWidth * window.devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * window.devicePixelRatio;
  ctx2d.clearRect(0,0,w,h);

  // grid pontilhada
  ctx2d.strokeStyle = "rgba(28,39,67,0.2)";
  ctx2d.setLineDash([6,6]);
  for (let i=1;i<=4;i++){
    const y = (h/5)*i;
    ctx2d.beginPath(); ctx2d.moveTo(0,y); ctx2d.lineTo(w,y); ctx2d.stroke();
  }
  ctx2d.setLineDash([]);

  if (!points.length) return;

  const xs = points.map((p,i)=> i/(points.length-1));
  const ys = points.map(p => 1 - (Math.max(0,Math.min(100,p.v))/100));

  // área
  const grad = ctx2d.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,"rgba(47,125,230,0.35)");
  grad.addColorStop(1,"rgba(47,125,230,0.10)");

  ctx2d.beginPath();
  ctx2d.moveTo(0, h*ys[0]);
  xs.forEach((x,i)=> ctx2d.lineTo(w*x, h*ys[i]));
  ctx2d.lineTo(w, h);
  ctx2d.lineTo(0, h);
  ctx2d.closePath();
  ctx2d.fillStyle = grad;
  ctx2d.fill();

  // linha
  ctx2d.beginPath();
  ctx2d.moveTo(0, h*ys[0]);
  xs.forEach((x,i)=> ctx2d.lineTo(w*x, h*ys[i]));
  ctx2d.lineWidth = 2;
  ctx2d.strokeStyle = "rgba(47,125,230,0.9)";
  ctx2d.stroke();
}

/* ==== Atualiza UI com dados do ThingsBoard (ou mocks) ==== */
function renderAll() {
  // TANK 1
  const t1pct = Number(latestFrom(KEYS.tank1.levelPercent));
  const t1cm  = latestFrom(KEYS.tank1.levelCm);
  const t1fl  = latestFrom(KEYS.tank1.flow);
  setText("tank1.levelPercent", isFinite(t1pct)? t1pct.toFixed(0) + "%" : "--%");
  setText("tank1.levelCm", (t1cm!=null)? `${t1cm}cm` : "--cm");
  setText("tank1.flow", (t1fl!=null)? `${Number(t1fl).toFixed(1)} L/min` : "-- L/min");
  setLevelBar('[data-id="TANK_1"]', t1pct);

  // TANK 2
  const t2pct = Number(latestFrom(KEYS.tank2.levelPercent));
  const t2cm  = latestFrom(KEYS.tank2.levelCm);
  const t2fl  = latestFrom(KEYS.tank2.flow);
  setText("tank2.levelPercent", isFinite(t2pct)? t2pct.toFixed(0) + "%" : "--%");
  setText("tank2.levelCm", (t2cm!=null)? `${t2cm}cm` : "--cm");
  setText("tank2.flow", (t2fl!=null)? `${Number(t2fl).toFixed(1)} L/min` : "-- L/min");
  setLevelBar('[data-id="TANK_2"]', t2pct);

  // HYD IN
  const hin  = latestFrom(KEYS.hydIn.flow);
  const htot = latestFrom(KEYS.hydIn.total);
  setText("hydIn.flow", (hin!=null)? `${Number(hin).toFixed(1)} L/min` : "-- L/min");
  setText("hydIn.total", (htot!=null)? `${Number(htot).toLocaleString()} L` : "-- L");

  // HYD SUB
  const hsf  = latestFrom(KEYS.hydSub.flow);
  const hst  = latestFrom(KEYS.hydSub.total);
  setText("hydSub.flow", (hsf!=null)? `${Number(hsf).toFixed(1)} L/min` : "-- L/min");
  setText("hydSub.total", (hst!=null)? `${Number(hst).toLocaleString()} L` : "-- L");

  // Série para o gráfico
  let serie = seriesFrom(KEYS.series);
  if (!serie.length) {
    // MOCK: curva suave ~ 70-90%
    const now = Date.now();
    serie = Array.from({length: 32}, (_,i)=>({
      ts: now - (31-i)*1800_000,
      v: 70 + 10*Math.sin(i/6)
    }));
  }
  const canvas = document.getElementById("trendChart");
  if (canvas) drawTrend(canvas, serie);
}

/* ==== Hooks do ThingsBoard ==== */
self.onInit = function() {
  renderAll();
  window.addEventListener("resize", ()=> {
    const canvas = document.getElementById("trendChart");
    if (canvas) drawTrend(canvas, seriesFrom(KEYS.series));
  });
};

self.onDataUpdated = function() {
  renderAll();
};

self.onResize = function() {
  const canvas = document.getElementById("trendChart");
  if (canvas) drawTrend(canvas, seriesFrom(KEYS.series));
};

self.onDestroy = function() {};
