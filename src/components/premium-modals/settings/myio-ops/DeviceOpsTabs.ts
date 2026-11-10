/**
 * Abas "OSs" e "Incidentes" do SettingsModal — só para usuários @myio.com.br (gate no caller).
 *
 * - OSs: ordens de serviço do device no GCDR (`GET {gcdr}/api/v1/wo/work-orders?deviceId=<gcdrDeviceId>`,
 *   todos os tipos — inclui os chamados GCDR, tipo CHAMADO). O badge da aba conta só as OSs em
 *   aberto; chamados FreshDesk têm a aba e o badge próprios.
 * - Incidentes: incidentes do alarms-backend que envolvem o device
 *   (`GET {alarms}/incidents?device=<ingestionId>` — o alarms-backend usa o id do Ingestion;
 *   cai para o gcdrDeviceId só quando o ingestionId não veio).
 *
 * Ambas somente leitura. Auth: X-API-Key do customer (gcdrApiKey) + X-Tenant-ID, igual aos
 * alarmes. Config vem dos params ou, por padrão, de window.MyIOOrchestrator.
 */

export interface DeviceOpsApiConfig {
  gcdrDeviceId?: string | null;
  /** Ingestion device id — o alarms-backend indexa os incidentes por ele (não pelo gcdrDeviceId). */
  ingestionId?: string | null;
  /** Identifier do device (chave dos chamados FreshDesk no TicketServiceOrchestrator). */
  identifier?: string | null;
  gcdrApiBaseUrl?: string;
  alarmsApiBaseUrl?: string;
  gcdrApiKey?: string;
  gcdrTenantId?: string;
}

interface ResolvedApi {
  gcdrDeviceId: string;
  identifier: string;
  gcdrRoot: string;
  alarmsBase: string;
  headers: Record<string, string>;
}

export interface DeviceWorkOrder {
  id: string;
  code?: string;
  title?: string | null;
  type?: string;
  status?: string;
  assignedTo?: string | null;
  scheduledAt?: string | null;
  createdAt?: string;
}

export interface DeviceIncident {
  id: string;
  kind?: string;
  severity?: string;
  status?: string;
  centralName?: string | null;
  day?: string;
  description?: string | null;
  firstDetectedAt?: string;
  lastEvaluatedAt?: string;
  totals?: { devices?: number; emptySlots?: number };
}

const WO_TYPE_LABELS: Record<string, string> = {
  INSTALACAO: 'Instalação',
  MANUTENCAO: 'Manutenção',
  VISITA_TECNICA: 'Visita técnica',
  IMPLANTACAO: 'Implantação',
  RETIRADA: 'Retirada',
  CHAMADO: 'Chamado',
  GRUPO: 'Grupo de OS',
};

const WO_STATUS_LABELS: Record<string, string> = {
  PLANEJADA: 'Planejada',
  EM_ANDAMENTO: 'Em andamento',
  INTERROMPIDA: 'Interrompida',
  AGUARDANDO: 'Aguardando',
  REAGENDADA: 'Reagendada',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aberto',
  ACK: 'Reconhecido',
  ACKNOWLEDGED: 'Reconhecido',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
};

const STYLES_ID = 'myio-dops-styles';

function esc(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? esc(value) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function resolveApi(config: DeviceOpsApiConfig): ResolvedApi {
  const orch = ((globalThis as any).window?.MyIOOrchestrator || {}) as Record<string, any>;
  const apiKey = config.gcdrApiKey ?? orch.gcdrApiKey ?? '';
  const tenantId = config.gcdrTenantId ?? orch.gcdrTenantId ?? '';
  const headers: Record<string, string> = { Accept: 'application/json', 'X-API-Key': apiKey };
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  return {
    gcdrDeviceId: String(config.gcdrDeviceId || ''),
    identifier: String(config.identifier || ''),
    gcdrRoot: String(config.gcdrApiBaseUrl ?? orch.gcdrApiBaseUrl ?? 'https://gcdr-api.a.myio-bas.com')
      .replace(/\/+$/, '')
      .replace(/\/api\/v1$/, ''),
    alarmsBase: String(config.alarmsApiBaseUrl ?? orch.alarmsApiBaseUrl ?? 'https://alarms-api.a.myio-bas.com/api/v1').replace(
      /\/+$/,
      ''
    ),
    headers,
  };
}

/** Lista de OSs do device no GCDR. Lança `Error` com `status` em falha HTTP. */
export async function fetchDeviceWorkOrders(config: DeviceOpsApiConfig): Promise<DeviceWorkOrder[]> {
  const api = resolveApi(config);
  if (!api.gcdrDeviceId) return [];
  const url = `${api.gcdrRoot}/api/v1/wo/work-orders?deviceId=${encodeURIComponent(api.gcdrDeviceId)}&limit=100`;
  const res = await fetch(url, { headers: api.headers });
  if (!res.ok) throw Object.assign(new Error(`GCDR work-orders HTTP ${res.status}`), { status: res.status });
  const body = await res.json();
  const data = body?.data ?? body;
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return items as DeviceWorkOrder[];
}

/** Incidentes (alarms-backend) que envolvem o device. */
/** Incidente crítico ainda aberto (OPEN ou reconhecido; resolvido/fechado fica de fora). */
export function isOpenCritical(i: DeviceIncident): boolean {
  return String(i.severity) === 'CRITICAL' && !['RESOLVED', 'CLOSED'].includes(String(i.status));
}

const WEEKDAYS_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Dia do incidente (YYYY-MM-DD, dia local da central) → "03/11/2026 · seg". */
export function fmtDay(day?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
  if (!m) return day ? String(day) : '—';
  const wd = WEEKDAYS_PT[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  return `${m[3]}/${m[2]}/${m[1]} · ${wd}`;
}

/** "há 5 min" / "há 3 h" / "há 2 dias". */
function relativeAgo(ts: number, now: number): string {
  const min = Math.max(0, Math.round((now - ts) / 60000));
  if (min < 60) return `há ${min} min`;
  if (min < 48 * 60) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} dias`;
}

/** Incidentes CRITICAL do dispositivo (a API filtra a severidade; o status é filtrado no cliente). */
export async function fetchDeviceIncidents(config: DeviceOpsApiConfig): Promise<DeviceIncident[]> {
  const api = resolveApi(config);
  const deviceKey = String(config.ingestionId || api.gcdrDeviceId || '');
  if (!deviceKey) return [];
  const url =
    `${api.alarmsBase}/incidents?device=${encodeURIComponent(deviceKey)}` +
    `&severity=CRITICAL&sortBy=firstDetectedAt&sortDir=desc&limit=100`;
  const res = await fetch(url, { headers: api.headers });
  if (!res.ok) throw Object.assign(new Error(`Alarms incidents HTTP ${res.status}`), { status: res.status });
  const body = await res.json();
  return (Array.isArray(body?.data) ? body.data : []) as DeviceIncident[];
}

export interface WorkOrderUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

/**
 * Usuários que podem ser responsáveis por OS (id → nome/e-mail). O GCDR só devolve o id em
 * `assignedTo` e a rota /users exige login; o alarms-backend expõe a mesma lista com a X-API-Key
 * (`GET {alarms}/incidents/work-order-users`). Falha → mapa vazio (a coluna cai para o id curto).
 */
export async function fetchWorkOrderUsers(config: DeviceOpsApiConfig): Promise<Map<string, WorkOrderUser>> {
  const api = resolveApi(config);
  const map = new Map<string, WorkOrderUser>();
  try {
    const res = await fetch(`${api.alarmsBase}/incidents/work-order-users`, { headers: api.headers });
    if (!res.ok) return map;
    const body = await res.json();
    const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : Array.isArray(body?.items) ? body.items : [];
    list.forEach((u: WorkOrderUser) => u?.id && map.set(String(u.id), u));
  } catch {
    // sem nomes: a coluna mostra o id curto
  }
  return map;
}

/** Célula "Responsável": nome + e-mail; sem match, id curto com o id completo no tooltip. */
export function assigneeHTML(id: string | null | undefined, users: Map<string, WorkOrderUser>): string {
  if (!id) return '<span class="dops-muted">—</span>';
  const u = users.get(String(id));
  if (u && (u.name || u.email)) {
    return `<div class="dops-person" title="${esc(id)}"><b>${esc(u.name || u.email)}</b>${
      u.name && u.email ? `<small>${esc(u.email)}</small>` : ''
    }</div>`;
  }
  return `<span class="dops-muted dops-mono" title="${esc(id)}">usuário ${esc(String(id).slice(0, 8))}…</span>`;
}

/** Chamados FreshDesk do device (TicketServiceOrchestrator, por identifier). */
export function countDeviceFreshdeskTickets(identifier: string | null | undefined): number {
  const tso = (globalThis as any).window?.TicketServiceOrchestrator;
  if (!identifier || typeof tso?.getTicketCountForDevice !== 'function') return 0;
  return Number(tso.getTicketCountForDevice(identifier)) || 0;
}

function injectStyles(): void {
  if (document.getElementById(STYLES_ID)) return;
  const style = document.createElement('style');
  style.id = STYLES_ID;
  style.textContent = `
    .dops-tab { padding: 4px 2px 20px; }
    .dops-tab, .dops-tab table, .dops-tab th, .dops-tab td, .dops-tab b, .dops-tab small, .dops-tab span {
      font-family: 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    .dops-day { white-space:nowrap; font-variant-numeric: tabular-nums; }
    /* o modal define td/th em 16px — fixa o tamanho nas próprias células (OSs e Incidentes) */
    .dops-tab .dops-table td { font-size:12px; line-height:1.45; }
    .dops-tab .dops-table th { font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
    .dops-tab .dops-table td.dops-muted { font-size:11.5px; }
    .dops-tab .dops-chip { font-size:11px; }
    .dops-tab .dops-table th.dops-col-date { width:140px; min-width:140px; }
    .dops-notice { background:#f1ecfa; color:#3e1a7d; border-radius:8px; padding:8px 12px; font-size:12px; margin-bottom:14px; }
    .dops-state { padding:28px 16px; text-align:center; color:#6b7280; font-size:13px; }
    .dops-error { color:#b91c1c; }
    .dops-summary { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
    .dops-kpi { border:1px solid #e5e7eb; border-radius:8px; padding:8px 12px; min-width:110px; background:#fff; }
    .dops-kpi b { display:block; font-size:18px; color:#111827; }
    .dops-kpi--crit b { color:#dc2626; }
    .dops-kpi span { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:.4px; }
    .dops-table { width:100%; border-collapse:collapse; font-size:12px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; }
    .dops-table th { text-align:left; background:#f9fafb; color:#6b7280; font-weight:700; padding:8px 10px; border-bottom:1px solid #e5e7eb; white-space:nowrap; }
    .dops-table td { padding:8px 10px; border-bottom:1px solid #f1f5f9; color:#111827; vertical-align:top; }
    .dops-table tr:last-child td { border-bottom:none; }
    .dops-chip { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; background:#f3f4f6; color:#374151; white-space:nowrap; }
    .dops-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .dops-muted { color:#9ca3af; }
    .dops-person { display:flex; flex-direction:column; gap:1px; min-width:0; }
    .dops-person b { font-weight:700; }
    .dops-person small { font-size:11px; color:#6b7280; }
    .theme-dark .dops-table, .theme-dark .dops-kpi { background:#111827; border-color:#374151; }
    .theme-dark .dops-table th { background:#1f2937; color:#9ca3af; border-color:#374151; }
    .theme-dark .dops-table td { color:#e5e7eb; border-color:#1f2937; }
    .theme-dark .dops-kpi b { color:#e5e7eb; }
  `;
  document.head.appendChild(style);
}

function noDeviceHTML(what: string): string {
  return `<div class="dops-state">${what} indisponíveis: o dispositivo não tem <code>gcdrDeviceId</code>.</div>`;
}

/** Aba OSs. Retorna a contagem do badge da aba: OSs em aberto do dispositivo. */
export async function renderDeviceWorkOrdersTab(container: HTMLElement, config: DeviceOpsApiConfig): Promise<number> {
  injectStyles();
  if (!config.gcdrDeviceId) {
    container.innerHTML = `<div class="dops-tab">${noDeviceHTML('OSs')}</div>`;
    return 0;
  }
  container.innerHTML = `<div class="dops-tab"><div class="dops-state">Carregando ordens de serviço…</div></div>`;
  let orders: DeviceWorkOrder[] = [];
  let errorHtml = '';
  const usersPromise = fetchWorkOrderUsers(config);
  try {
    orders = await fetchDeviceWorkOrders(config);
  } catch (e: any) {
    errorHtml =
      e?.status === 401 || e?.status === 403
        ? 'O GCDR recusou a leitura das OSs com a chave deste customer (falta o escopo wo:read na chave).'
        : `Erro ao carregar OSs: ${esc(e?.message || e)}`;
  }
  const open = orders.filter((o) => !['FINALIZADA', 'CANCELADA'].includes(String(o.status))).length;
  const users = await usersPromise;
  const rows = orders
    .slice()
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .map(
      (o) => `<tr>
        <td class="dops-mono">${esc(o.code || o.id)}</td>
        <td>${esc(o.title || '—')}</td>
        <td>${esc(WO_TYPE_LABELS[String(o.type)] || o.type || '—')}</td>
        <td><span class="dops-chip">${esc(WO_STATUS_LABELS[String(o.status)] || o.status || '—')}</span></td>
        <td>${assigneeHTML(o.assignedTo, users)}</td>
        <td>${fmtDate(o.scheduledAt)}</td>
        <td>${fmtDate(o.createdAt)}</td>
      </tr>`
    )
    .join('');
  container.innerHTML = `
    <div class="dops-tab">
      <div class="dops-notice">🔒 Visível só para usuários MyIO. Ordens de serviço do GCDR que incluem este dispositivo.</div>
      <div class="dops-summary">
        <div class="dops-kpi"><b>${errorHtml ? '—' : orders.length}</b><span>OSs</span></div>
        <div class="dops-kpi"><b>${errorHtml ? '—' : open}</b><span>OSs em aberto</span></div>
      </div>
      ${
        errorHtml
          ? `<div class="dops-state dops-error">${errorHtml}</div>`
          : orders.length
          ? `<table class="dops-table"><thead><tr><th>Código</th><th>Título</th><th>Tipo</th><th>Status</th><th>Responsável</th><th>Agendada</th><th>Criada</th></tr></thead><tbody>${rows}</tbody></table>`
          : `<div class="dops-state">Nenhuma OS para este dispositivo.</div>`
      }
    </div>`;
  return errorHtml ? 0 : open;
}

/** Aba Incidentes. Retorna o badge da aba: incidentes CRITICAL não resolvidos (a lista mostra todos). */
export async function renderDeviceIncidentsTab(container: HTMLElement, config: DeviceOpsApiConfig): Promise<number> {
  injectStyles();
  if (!config.ingestionId && !config.gcdrDeviceId) {
    container.innerHTML = `<div class="dops-tab">${noDeviceHTML('Incidentes')}</div>`;
    return 0;
  }
  container.innerHTML = `<div class="dops-tab"><div class="dops-state">Carregando incidentes críticos…</div></div>`;
  let incidents: DeviceIncident[] = [];
  try {
    incidents = (await fetchDeviceIncidents(config)).filter(isOpenCritical);
  } catch (e: any) {
    container.innerHTML = `<div class="dops-tab"><div class="dops-state dops-error">Erro ao carregar incidentes: ${esc(
      e?.message || e
    )}</div></div>`;
    return 0;
  }
  const now = Date.now();
  const unacked = incidents.filter((i) => String(i.status) === 'OPEN').length;
  const detected = incidents.map((i) => Date.parse(i.firstDetectedAt || '')).filter((t) => Number.isFinite(t));
  const oldest = detected.length ? Math.min(...detected) : null;
  const newest = detected.length ? Math.max(...detected) : null;
  const daysOpen = oldest !== null ? Math.max(1, Math.round((now - oldest) / 86400000)) : null;
  const rows = incidents
    .map(
      (i) => `<tr>
        <td class="dops-day">${esc(fmtDay(i.day))}</td>
        <td><span class="dops-chip">${esc(INCIDENT_STATUS_LABELS[String(i.status)] || i.status || '—')}</span></td>
        <td class="dops-day">${fmtDate(i.firstDetectedAt)}</td>
        <td class="dops-day">${fmtDate(i.lastEvaluatedAt)}</td>
        <td class="dops-muted">${esc(i.description || '')}</td>
      </tr>`
    )
    .join('');
  container.innerHTML = `
    <div class="dops-tab">
      <div class="dops-notice">🔒 Visível só para usuários MyIO. Incidentes <b>críticos em aberto</b> do alarms-backend que envolvem este dispositivo.</div>
      <div class="dops-summary">
        <div class="dops-kpi dops-kpi--crit"><b>${incidents.length}</b><span>Críticos abertos</span></div>
        <div class="dops-kpi"><b>${unacked}</b><span>Sem reconhecimento</span></div>
        <div class="dops-kpi"><b>${daysOpen === null ? '—' : daysOpen + (daysOpen === 1 ? ' dia' : ' dias')}</b><span>Aberto há (mais antigo)</span></div>
        <div class="dops-kpi"><b>${newest === null ? '—' : esc(relativeAgo(newest, now))}</b><span>Última detecção</span></div>
      </div>
      ${
        incidents.length
          ? `<table class="dops-table"><thead><tr><th>Dia</th><th>Status</th><th class="dops-col-date">Detectado</th><th class="dops-col-date">Última avaliação</th><th>Descrição</th></tr></thead><tbody>${rows}</tbody></table>`
          : `<div class="dops-state">Nenhum incidente crítico em aberto para este dispositivo.</div>`
      }
    </div>`;
  return incidents.length;
}
