/**
 * Renderiza em PNG (canvas) o mesmo gráfico de barras de temperatura exibido nas modais
 * de relatório — média por sensor (AllReport) ou ranking de dias/horas mais quentes
 * (DeviceReport) — com escala comum e a faixa ideal sombreada. Usado no export PDF para
 * que o arquivo reproduza o painel da tela. Retorna null sem canvas 2D (ex.: jsdom).
 */

export interface TemperatureBarItem {
  label: string;
  /** null = sem leitura (linha listada, sem barra) */
  value: number | null;
}

export interface TemperatureBarsPngOptions {
  items: TemperatureBarItem[];
  ideal?: { min: number; max: number } | null;
  /** Cor das barras dentro da faixa ideal (accent do dashboard). */
  accent?: string;
}

export function renderTemperatureBarsPng(
  opts: TemperatureBarsPngOptions
): { dataUrl: string; width: number; height: number } | null {
  if (typeof document === 'undefined' || !opts.items.length) return null;

  const W = 1400;
  const ROW = 34;
  const TOP = 56;
  const H = TOP + opts.items.length * ROW + 20;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ideal = opts.ideal && Number.isFinite(opts.ideal.min) && Number.isFinite(opts.ideal.max) ? opts.ideal : null;
  const values = opts.items.map((i) => i.value).filter((v): v is number => v !== null && Number.isFinite(v));
  const base = values.length ? values : [20, 30];
  const lo = Math.floor(Math.min(...base, ideal ? ideal.min : Infinity) - 1);
  const hi = Math.ceil(Math.max(...base, ideal ? ideal.max : -Infinity) + 1);
  const span = Math.max(1, hi - lo);

  const LABEL_W = 460;
  const VALUE_W = 120;
  const trackX = LABEL_W + 20;
  const trackW = W - trackX - VALUE_W - 20;
  const xOf = (v: number) => trackX + ((v - lo) / span) * trackW;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // legenda da escala
  ctx.fillStyle = '#6b7280';
  ctx.font = '20px Helvetica, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  const scale = `Escala ${fmt(lo)}–${fmt(hi)} °C`;
  ctx.fillText(ideal ? `${scale}   ·   faixa ideal ${fmt(ideal.min)}–${fmt(ideal.max)} °C` : scale, 16, 26);

  opts.items.forEach((item, i) => {
    const y = TOP + i * ROW;
    const cy = y + ROW / 2;

    ctx!.fillStyle = '#1f2937';
    ctx!.font = '20px Helvetica, Arial, sans-serif';
    ctx!.textAlign = 'left';
    let label = item.label;
    while (ctx!.measureText(label).width > LABEL_W - 10 && label.length > 4) label = label.slice(0, -2);
    if (label !== item.label) label = label.slice(0, -1) + '…';
    ctx!.fillText(label, 16, cy);

    if (item.value === null || !Number.isFinite(item.value)) {
      ctx!.fillStyle = '#9ca3af';
      ctx!.font = 'italic 18px Helvetica, Arial, sans-serif';
      ctx!.fillText('Sem leitura', trackX, cy);
      ctx!.textAlign = 'right';
      ctx!.fillText('—', W - 16, cy);
      return;
    }

    // trilho + faixa ideal
    ctx!.fillStyle = '#e5e7eb';
    ctx!.fillRect(trackX, cy - 9, trackW, 18);
    if (ideal) {
      ctx!.fillStyle = 'rgba(34,197,94,0.18)';
      ctx!.fillRect(xOf(ideal.min), cy - 9, xOf(ideal.max) - xOf(ideal.min), 18);
    }
    // barra (vermelho acima, azul abaixo, accent dentro)
    const v = item.value;
    ctx!.fillStyle =
      ideal && v > ideal.max ? '#ef4444' : ideal && v < ideal.min ? '#3b82f6' : opts.accent || '#3e1a7d';
    ctx!.fillRect(trackX, cy - 6, Math.max(2, xOf(v) - trackX), 12);

    ctx!.fillStyle = '#111827';
    ctx!.font = 'bold 20px Helvetica, Arial, sans-serif';
    ctx!.textAlign = 'right';
    ctx!.fillText(fmt(v), W - 16, cy);
  });

  try {
    return { dataUrl: canvas.toDataURL('image/png'), width: W, height: H };
  } catch {
    return null;
  }
}
