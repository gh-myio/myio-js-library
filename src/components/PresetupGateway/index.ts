import type {
  PresetupGatewayOptions,
  PresetupGatewayInstance,
  PresetupDevice,
  GatewayInfo,
  DeviceType,
  SyncResult,
} from './types';
import { DEVICE_TYPES } from './types';
import { PresetupAuth } from './api/auth';
import { IngestionApiClient } from './api/ingestion';
import { ProvisioningApiClient } from './api/provisioning';
import {
  mapIngestionDeviceType,
  generateDeviceNameWithPrefix,
  generateLocalId,
  generateDeviceUuid,
  DEVICE_TYPE_LABELS,
} from './utils/device';
import { exportDeviceTagsPdf, type PdfLayout } from './utils/pdf';

const DEFAULT_INGESTION_API = 'https://management.myio-bas.com';
const DEFAULT_INGESTION_AUTH = 'https://api.myio-bas.com/auth/token';
const DEFAULT_PROVISIONING_API = 'https://provisioning.apps.myio-bas.com';

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: 'font-family:system-ui,sans-serif;font-size:14px;color:#111;background:#fff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;',
  header: 'padding:12px 16px;background:#f5f6fa;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:12px;',
  badge: (bg: string, fg: string) => `font-size:12px;padding:2px 8px;border-radius:9999px;background:${bg};color:${fg};`,
  tableWrap: 'overflow-x:auto;border-bottom:1px solid #e0e0e0;',
  table: 'width:100%;border-collapse:collapse;font-size:13px;',
  th: 'padding:8px 12px;text-align:left;color:#6b7280;font-weight:500;',
  td: 'padding:8px 12px;',
  formSection: 'padding:14px 16px;border-bottom:1px solid #e0e0e0;background:#fafafa;',
  formTitle: 'font-weight:600;margin-bottom:10px;font-size:13px;color:#374151;',
  formRow: 'display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;',
  input: (w: string) => `width:${w};padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;box-sizing:border-box;`,
  select: 'padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;background:#fff;',
  btn: (bg: string) => `padding:7px 16px;background:${bg};color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:500;`,
  actions: 'padding:10px 16px;display:flex;gap:10px;align-items:center;border-bottom:1px solid #e0e0e0;background:#fff;',
  log: 'padding:10px 16px;background:#0f172a;color:#94a3b8;font-family:monospace;font-size:12px;max-height:220px;overflow-y:auto;white-space:pre-wrap;',
  emptyRow: 'padding:28px;text-align:center;color:#9ca3af;',
} as const;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (style) e.style.cssText = style;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function statusStyle(status: PresetupDevice['status']): string {
  const colors: Record<PresetupDevice['status'], [string, string]> = {
    synced: ['#d1fae5', '#059669'],
    local: ['#fef3c7', '#d97706'],
    error: ['#fee2e2', '#dc2626'],
    remote: ['#f3f4f6', '#6b7280'],
  };
  const [bg, fg] = colors[status] ?? ['#f3f4f6', '#6b7280'];
  return S.badge(bg, fg);
}

// ─── Factory function ────────────────────────────────────────────────────────

export function createPresetupGateway(opts: PresetupGatewayOptions): PresetupGatewayInstance {
  const {
    mount,
    gatewayId,
    clientId,
    clientSecret,
    ingestionApiUrl = DEFAULT_INGESTION_API,
    ingestionAuthUrl = DEFAULT_INGESTION_AUTH,
    provisioningApiUrl = DEFAULT_PROVISIONING_API,
    onSyncComplete,
    onError,
  } = opts;

  // ── State ─────────────────────────────────────────────────────────────────
  let devices: PresetupDevice[] = [];
  let gateway: GatewayInfo | null = null;
  let syncing = false;

  // ── API clients ───────────────────────────────────────────────────────────
  const auth = new PresetupAuth({
    authUrl: ingestionAuthUrl,
    clientId,
    clientSecret,
    renewSkewSeconds: 30,
    retryBaseMs: 500,
    retryMaxAttempts: 3,
  });
  const ingestion = new IngestionApiClient(ingestionApiUrl, auth);
  const provisioning = new ProvisioningApiClient(provisioningApiUrl);

  // ── Build DOM ─────────────────────────────────────────────────────────────
  mount.innerHTML = '';
  const root = el('div', S.root);
  mount.appendChild(root);

  // Header
  const header = el('div', S.header);
  const titleEl = el('span', 'font-weight:600;font-size:15px;');
  titleEl.textContent = 'PresetupGateway';
  const statusBadge = el('span', S.badge('#dbeafe', '#1d4ed8'));
  statusBadge.textContent = 'Carregando…';
  header.append(titleEl, statusBadge);
  root.appendChild(header);

  // Device table
  const tableWrap = el('div', S.tableWrap);
  const table = el('table', S.table);
  const thead = el('thead', undefined, `<tr style="background:#f9fafb;">
    <th style="${S.th}">Tipo</th>
    <th style="${S.th}">Nome Gerado</th>
    <th style="${S.th}">Slave ID</th>
    <th style="${S.th}">Addr Low</th>
    <th style="${S.th}">Addr High</th>
    <th style="${S.th}">Identifier</th>
    <th style="${S.th}">Status</th>
    <th style="${S.th}"></th>
  </tr>`);
  const tbody = el('tbody');
  table.append(thead, tbody);
  tableWrap.appendChild(table);
  root.appendChild(tableWrap);

  // Add-device form
  const formSection = el('div', S.formSection);
  const formTitle = el('div', S.formTitle);
  formTitle.textContent = 'Adicionar Dispositivo';
  const formRow = el('div', S.formRow);

  const typeSelect = el('select', S.select);
  DEVICE_TYPES.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = DEVICE_TYPE_LABELS[t] ?? t;
    typeSelect.appendChild(opt);
  });

  const nameInput = el('input', S.input('140px'));
  nameInput.placeholder = 'Nome';

  const slaveInput = el('input', S.input('70px'));
  slaveInput.placeholder = 'Slave ID';
  slaveInput.type = 'number';
  slaveInput.min = '1';

  const addrLowInput = el('input', S.input('80px'));
  addrLowInput.placeholder = 'Addr Low';

  const addrHighInput = el('input', S.input('80px'));
  addrHighInput.placeholder = 'Addr High';

  const identifierInput = el('input', S.input('100px'));
  identifierInput.placeholder = 'Identifier';

  const addBtn = el('button', S.btn('#2563eb'));
  addBtn.textContent = '+ Adicionar';

  formRow.append(typeSelect, nameInput, slaveInput, addrLowInput, addrHighInput, identifierInput, addBtn);
  formSection.append(formTitle, formRow);
  root.appendChild(formSection);

  // Actions bar
  const actionsBar = el('div', S.actions);

  const syncBtn = el('button', S.btn('#059669'));
  syncBtn.textContent = '🔄 Sincronizar';

  const pdfLayoutSelect = el('select', S.select);
  ([['grid_4x7', 'Grid 4×7'], ['grid_2x4', 'Grid 2×4'], ['per_page', 'Por Página']] as const).forEach(
    ([v, l]) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = l;
      pdfLayoutSelect.appendChild(opt);
    },
  );

  const pdfBtn = el('button', S.btn('#7c3aed'));
  pdfBtn.textContent = '📄 Exportar PDF';

  actionsBar.append(syncBtn, pdfBtn, pdfLayoutSelect);
  root.appendChild(actionsBar);

  // Progress log
  const logArea = el('div', S.log);
  logArea.style.display = 'none';
  root.appendChild(logArea);

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderTable(): void {
    tbody.innerHTML = '';

    if (devices.length === 0) {
      const tr = el('tr');
      const td = el('td', S.emptyRow);
      td.colSpan = 8;
      td.textContent = 'Nenhum dispositivo. Adicione abaixo.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    devices.forEach((d, idx) => {
      const tr = el('tr');
      tr.style.borderBottom = '1px solid #f0f0f0';

      const cells = [
        DEVICE_TYPE_LABELS[d.type] ?? d.type,
        generateDeviceNameWithPrefix(d, undefined, devices),
        String(d.slaveId),
        d.addr_low ?? String(d.slaveId),
        d.addr_high ?? String(d.slaveId),
        d.identifier ?? '—',
      ];
      cells.forEach(text => {
        const td = el('td', S.td);
        td.textContent = text;
        tr.appendChild(td);
      });

      const statusTd = el('td', S.td);
      const badge = el('span', statusStyle(d.status));
      badge.textContent = d.status + (d.statusMessage ? ` (${d.statusMessage.slice(0, 30)})` : '');
      statusTd.appendChild(badge);
      tr.appendChild(statusTd);

      const actionTd = el('td', S.td);
      if (d.status === 'local' || d.status === 'error') {
        const removeBtn = el('button', 'background:none;border:none;color:#dc2626;cursor:pointer;font-size:14px;padding:0;');
        removeBtn.textContent = '✕';
        removeBtn.title = 'Remover';
        removeBtn.onclick = () => {
          devices = devices.filter((_, i) => i !== idx);
          renderTable();
        };
        actionTd.appendChild(removeBtn);
      }
      tr.appendChild(actionTd);

      tbody.appendChild(tr);
    });
  }

  function appendLog(line: string): void {
    logArea.style.display = 'block';
    logArea.textContent += line + '\n';
    logArea.scrollTop = logArea.scrollHeight;
  }

  function setBadge(text: string, bg: string, fg: string): void {
    statusBadge.textContent = text;
    statusBadge.style.cssText = S.badge(bg, fg);
  }

  // ── Ingestion sync ────────────────────────────────────────────────────────

  async function syncIngestion(): Promise<{ created: number; updated: number; failed: number }> {
    if (!gateway) throw new Error('Gateway não carregado');

    const localDevices = devices.filter(d => d.status === 'local');
    let created = 0;
    let updated = 0;
    let failed = 0;

    // Bulk lookup for devices without a stored ingestion ID
    const lookupPairs = localDevices
      .filter(d => !d.ingestion_device_id)
      .map(d => ({ gatewayId, slaveId: d.slaveId }));

    const lookupMap: Record<number, string | null> = {};
    if (lookupPairs.length > 0) {
      try {
        const results = await ingestion.lookupDevices(lookupPairs);
        for (const r of results) lookupMap[r.slaveId] = r.deviceId;
      } catch {
        // ignore — will fall through to create
      }
    }

    for (const device of localDevices) {
      try {
        const deviceName = generateDeviceNameWithPrefix(device, undefined, devices);
        const payload: Record<string, unknown> = {
          name: deviceName,
          description: deviceName,
          deviceType: mapIngestionDeviceType(device.type),
          customerId: gateway.customerId,
          assetId: gateway.assetId,
          gatewayId,
          slaveId: device.slaveId,
          uuid: device.uuid,
        };
        if (device.multipliers) payload['multipliers'] = device.multipliers;

        if (device.ingestion_device_id) {
          // Step 1: update by stored ID
          await ingestion.updateDevice(device.ingestion_device_id, payload);
          device.status = 'synced';
          updated++;
          appendLog(`   ✅ Atualizado: ${deviceName}`);
        } else if (lookupMap[device.slaveId] != null) {
          // Step 2: found via bulk lookup
          const existingId = lookupMap[device.slaveId] as string;
          await ingestion.updateDevice(existingId, payload);
          device.ingestion_device_id = existingId;
          device.status = 'synced';
          updated++;
          appendLog(`   ✅ Atualizado (lookup): ${deviceName}`);
        } else {
          // Step 3: create new device
          const result = await ingestion.createDevice(payload);
          device.ingestion_device_id = result.data.id;
          device.status = 'synced';
          created++;
          appendLog(`   ✅ Criado: ${deviceName}`);
        }
      } catch (err: any) {
        device.status = 'error';
        device.statusMessage = String(err?.message ?? err);
        failed++;
        appendLog(`   ❌ Erro em ${device.name}: ${device.statusMessage}`);
      }
    }

    return { created, updated, failed };
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async function load(): Promise<void> {
    setBadge('Carregando…', '#dbeafe', '#1d4ed8');
    try {
      gateway = await ingestion.fetchGateway(gatewayId);
      if (!gateway) {
        setBadge('Gateway não encontrado', '#fee2e2', '#dc2626');
        return;
      }

      titleEl.textContent = `PresetupGateway — ${gateway.name}`;

      const apiDevices = await ingestion.fetchDevicesByGateway(gatewayId);
      devices = apiDevices.map(d => ({
        _localId: generateLocalId(),
        ingestion_device_id: d.id,
        uuid: d.id,
        name: d.name,
        // Ingestion API doesn't store device type; default to 3F_MEDIDOR for remote devices
        type: '3F_MEDIDOR' as DeviceType,
        slaveId: d.slaveId,
        multipliers: d.multipliers,
        status: 'remote' as const,
      }));

      setBadge(`${devices.length} dispositivo(s)`, '#d1fae5', '#059669');
    } catch (err: any) {
      setBadge('Erro ao carregar', '#fee2e2', '#dc2626');
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      renderTable();
    }
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  addBtn.onclick = () => {
    const name = nameInput.value.trim();
    const slaveId = parseInt(slaveInput.value, 10);

    nameInput.style.borderColor = !name ? '#dc2626' : '#d1d5db';
    slaveInput.style.borderColor = isNaN(slaveId) || slaveId < 1 ? '#dc2626' : '#d1d5db';

    if (!name || isNaN(slaveId) || slaveId < 1) return;

    devices.push({
      _localId: generateLocalId(),
      uuid: generateDeviceUuid(),
      name,
      type: typeSelect.value as DeviceType,
      slaveId,
      addr_low: addrLowInput.value.trim() || undefined,
      addr_high: addrHighInput.value.trim() || undefined,
      identifier: identifierInput.value.trim() || undefined,
      status: 'local',
    });

    nameInput.value = '';
    slaveInput.value = '';
    addrLowInput.value = '';
    addrHighInput.value = '';
    identifierInput.value = '';
    nameInput.style.borderColor = '#d1d5db';
    slaveInput.style.borderColor = '#d1d5db';

    renderTable();
  };

  syncBtn.onclick = async () => {
    if (syncing || !gateway) return;
    syncing = true;
    syncBtn.disabled = true;
    syncBtn.textContent = '⏳ Sincronizando…';
    logArea.textContent = '';
    logArea.style.display = 'block';

    appendLog('=== Iniciando sincronização ===');

    let ingestionResult = { created: 0, updated: 0, failed: 0 };
    let provisioningResult: SyncResult['provisioning'] = { success: false };

    try {
      // Phase 1: Ingestion API
      appendLog('\n📡 Fase 1 — Ingestion API');
      const localCount = devices.filter(d => d.status === 'local').length;
      if (localCount === 0) {
        appendLog('   Nenhum dispositivo local para sincronizar.');
      } else {
        ingestionResult = await syncIngestion();
        appendLog(`\n   Criados: ${ingestionResult.created} | Atualizados: ${ingestionResult.updated} | Erros: ${ingestionResult.failed}`);
      }
      renderTable();

      // Phase 2: Provisioning API
      appendLog('\n🔧 Fase 2 — Provisioning API');
      const blockReason = provisioning.canProvision(gateway);
      if (blockReason) {
        appendLog(`   ⚠️ Pulando provisionamento: ${blockReason}`);
        provisioningResult = { success: false, skipped: true, skipReason: blockReason };
      } else {
        const provResult = await provisioning.provision(
          gateway,
          devices,
          line => appendLog(`   ${line}`),
        );
        provisioningResult = { success: provResult.success, jobId: provResult.jobId };
      }

      const syncResult: SyncResult = {
        ingestion: { success: ingestionResult.failed === 0, ...ingestionResult },
        provisioning: provisioningResult,
      };

      appendLog('\n=== Sincronização concluída ===');
      setBadge(`${devices.length} dispositivo(s)`, '#d1fae5', '#059669');
      onSyncComplete?.(syncResult);
    } catch (err: any) {
      appendLog(`\n❌ Erro fatal: ${err?.message ?? err}`);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      syncing = false;
      syncBtn.disabled = false;
      syncBtn.textContent = '🔄 Sincronizar';
    }
  };

  pdfBtn.onclick = async () => {
    if (!gateway || !devices.length) return;
    pdfBtn.disabled = true;
    pdfBtn.textContent = '⏳ Gerando PDF…';
    try {
      await exportDeviceTagsPdf(devices, gateway, pdfLayoutSelect.value as PdfLayout);
    } catch (err: any) {
      appendLog(`\n❌ Erro ao gerar PDF: ${err?.message ?? err}`);
    } finally {
      pdfBtn.disabled = false;
      pdfBtn.textContent = '📄 Exportar PDF';
    }
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  load();

  // ── Public instance ───────────────────────────────────────────────────────
  return {
    async refresh(): Promise<void> {
      await load();
    },
    destroy(): void {
      mount.innerHTML = '';
    },
  };
}
