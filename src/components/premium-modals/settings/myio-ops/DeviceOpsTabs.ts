/**
 * Abas "OSs" e "Incidentes" do SettingsModal — só para usuários @myio.com.br (gate no caller).
 *
 * - OSs: ordens de serviço do device no GCDR (`GET {gcdr}/api/v1/wo/work-orders?deviceId=<gcdrDeviceId>`,
 *   todos os tipos — inclui os chamados GCDR, tipo CHAMADO). A contagem da aba soma, por ora,
 *   OSs + chamados FreshDesk do device (TicketServiceOrchestrator); depois separamos.
 * - Incidentes: incidentes do alarms-backend que envolvem o device
 *   (`GET {alarms}/incidents?device=<gcdrDeviceId>` — filtro por id exato do device).
 *
 * Ambas somente leitura. Auth: X-API-Key do customer (gcdrApiKey) + X-Tenant-ID, igual aos
 * alarmes. Config vem dos params ou, por padrão, de window.MyIOOrchestrator.
 */

export interface DeviceOpsApiConfig {
  gcdrDeviceId?: string | null;
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

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#f59e0b',
  MEDIUM: '#3b82f6',
  LOW: '#6b7280',
  INFO: '#6b7280',
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
export async function fetchDeviceIncidents(config: DeviceOpsApiConfig): Promise<DeviceIncident[]> {
  const api = resolveApi(config);
  if (!api.gcdrDeviceId) return [];
  const url =
    `${api.alarmsBase}/incidents?device=${encodeURIComponent(api.gcdrDeviceId)}` +
    `&sortBy=firstDetectedAt&sortDir=desc&limit=100`;
  const res = await fetch(url, { headers: api.headers });
  if (!res.ok) throw Object.assign(new Error(`Alarms incidents HTTP ${res.status}`), { status: res.status });
  const body = await res.json();
  return (Array.isArray(body?.data) ? body.data : []) as DeviceIncident[];
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
    .dops-tab { padding: 4px 2px 20px; font-family: 'Nunito', system-ui, sans-serif; }
    .dops-notice { background:#f1ecfa; color:#3e1a7d; border-radius:8px; padding:8px 12px; font-size:12px; margin-bottom:14px; }
    .dops-state { padding:28px 16px; text-align:center; color:#6b7280; font-size:13px; }
    .dops-error { color:#b91c1c; }
    .dops-summary { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
    .dops-kpi { border:1px solid #e5e7eb; border-radius:8px; padding:8px 12px; min-width:110px; background:#fff; }
    .dops-kpi b { display:block; font-size:18px; color:#111827; }
    .dops-kpi span { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:.4px; }
    .dops-table { width:100%; border-collapse:collapse; font-size:12px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; }
    .dops-table th { text-align:left; background:#f9fafb; color:#6b7280; font-weight:700; padding:8px 10px; border-bottom:1px solid #e5e7eb; white-space:nowrap; }
    .dops-table td { padding:8px 10px; border-bottom:1px solid #f1f5f9; color:#111827; vertical-align:top; }
    .dops-table tr:last-child td { border-bottom:none; }
    .dops-chip { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; background:#f3f4f6; color:#374151; white-space:nowrap; }
    .dops-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .dops-muted { color:#9ca3af; }
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

/** Aba OSs. Retorna a contagem exibida no badge da aba (OSs + chamados FreshDesk). */
export async function renderDeviceWorkOrdersTab(container: HTMLElement, config: DeviceOpsApiConfig): Promise<number> {
  injectStyles();
  const tickets = countDeviceFreshdeskTickets(config.identifier);
  if (!config.gcdrDeviceId) {
    container.innerHTML = `<div class="dops-tab">${noDeviceHTML('OSs')}</div>`;
    return tickets;
  }
  container.innerHTML = `<div class="dops-tab"><div class="dops-state">Carregando ordens de serviço…</div></div>`;
  let orders: DeviceWorkOrder[] = [];
  let errorHtml = '';
  try {
    orders = await fetchDeviceWorkOrders(config);
  } catch (e: any) {
    errorHtml =
      e?.status === 401 || e?.status === 403
        ? 'O GCDR ainda não libera a leitura de OSs com a chave do customer (as rotas /wo/work-orders exigem login de usuário GCDR).'
        : `Erro ao carregar OSs: ${esc(e?.message || e)}`;
  }
  const open = orders.filter((o) => !['FINALIZADA', 'CANCELADA'].includes(String(o.status))).length;
  const rows = orders
    .slice()
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .map(
      (o) => `<tr>
        <td class="dops-mono">${esc(o.code || o.id)}</td>
        <td>${esc(o.title || '—')}</td>
        <td>${esc(WO_TYPE_LABELS[String(o.type)] || o.type || '—')}</td>
        <td><span class="dops-chip">${esc(WO_STATUS_LABELS[String(o.status)] || o.status || '—')}</span></td>
        <td>${esc(o.assignedTo || '—')}</td>
        <td>${fmtDate(o.scheduledAt)}</td>
        <td>${fmtDate(o.createdAt)}</td>
      </tr>`
    )
    .join('');
  container.innerHTML = `
    <div class="dops-tab">
      <div class="dops-notice">🔒 Visível só para usuários MyIO. A contagem da aba soma OSs e chamados (FreshDesk) do dispositivo.</div>
      <div class="dops-summary">
        <div class="dops-kpi"><b>${errorHtml ? '—' : orders.length}</b><span>OSs</span></div>
        <div class="dops-kpi"><b>${errorHtml ? '—' : open}</b><span>OSs em aberto</span></div>
        <div class="dops-kpi"><b>${tickets}</b><span>Chamados</span></div>
      </div>
      ${
        errorHtml
          ? `<div class="dops-state dops-error">${errorHtml}</div>`
          : orders.length
          ? `<table class="dops-table"><thead><tr><th>Código</th><th>Título</th><th>Tipo</th><th>Status</th><th>Responsável</th><th>Agendada</th><th>Criada</th></tr></thead><tbody>${rows}</tbody></table>`
          : `<div class="dops-state">Nenhuma OS para este dispositivo.</div>`
      }
    </div>`;
  return (errorHtml ? 0 : orders.length) + tickets;
}

/** Aba Incidentes. Retorna a quantidade de incidentes não resolvidos (badge da aba). */
export async function renderDeviceIncidentsTab(container: HTMLElement, config: DeviceOpsApiConfig): Promise<number> {
  injectStyles();
  if (!config.gcdrDeviceId) {
    container.innerHTML = `<div class="dops-tab">${noDeviceHTML('Incidentes')}</div>`;
    return 0;
  }
  container.innerHTML = `<div class="dops-tab"><div class="dops-state">Carregando incidentes…</div></div>`;
  let incidents: DeviceIncident[] = [];
  try {
    incidents = await fetchDeviceIncidents(config);
  } catch (e: any) {
    container.innerHTML = `<div class="dops-tab"><div class="dops-state dops-error">Erro ao carregar incidentes: ${esc(
      e?.message || e
    )}</div></div>`;
    return 0;
  }
  const active = incidents.filter((i) => !['RESOLVED', 'CLOSED'].includes(String(i.status))).length;
  const rows = incidents
    .map((i) => {
      const sev = String(i.severity || '');
      return `<tr>
        <td><span class="dops-chip" style="background:${SEVERITY_COLORS[sev] || '#6b7280'};color:#fff">${esc(sev || '—')}</span></td>
        <td>${esc(i.kind || '—')}</td>
        <td><span class="dops-chip">${esc(INCIDENT_STATUS_LABELS[String(i.status)] || i.status || '—')}</span></td>
        <td>${esc(i.day || '—')}</td>
        <td>${esc(i.centralName || '—')}</td>
        <td>${fmtDate(i.firstDetectedAt)}</td>
        <td>${fmtDate(i.lastEvaluatedAt)}</td>
        <td class="dops-muted">${esc(i.description || '')}</td>
      </tr>`;
    })
    .join('');
  container.innerHTML = `
    <div class="dops-tab">
      <div class="dops-notice">🔒 Visível só para usuários MyIO. Incidentes do alarms-backend que envolvem este dispositivo.</div>
      <div class="dops-summary">
        <div class="dops-kpi"><b>${incidents.length}</b><span>Incidentes</span></div>
        <div class="dops-kpi"><b>${active}</b><span>Não resolvidos</span></div>
      </div>
      ${
        incidents.length
          ? `<table class="dops-table"><thead><tr><th>Severidade</th><th>Tipo</th><th>Status</th><th>Dia</th><th>Central</th><th>Detectado</th><th>Última avaliação</th><th>Descrição</th></tr></thead><tbody>${rows}</tbody></table>`
          : `<div class="dops-state">Nenhum incidente para este dispositivo.</div>`
      }
    </div>`;
  return active;
}
