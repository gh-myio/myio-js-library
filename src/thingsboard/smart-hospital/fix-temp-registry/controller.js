/* jshint esversion: 11 */
/* global self, document, window, FileReader, confirm, alert */

/**
 * Fix Temp Registry Widget — controller.js
 *
 * Replaces fix_souza_aguiar.xlsx.
 * Persists state as a SERVER_SCOPE CUSTOMER attribute:
 *   key: fix_souza_aguiar_sensores_temperatura
 *   value: JSON array of FixRow objects
 *
 * No Angular bindings — all rendering is done imperatively via direct DOM manipulation.
 */

// ── Constants ────────────────────────────────────────────────────────────────

const ATTR_KEY = 'fix_souza_aguiar_sensores_temperatura';

// Customer entity ID — Complexo Hospitalar Municipal Souza Aguiar (HMSA)
const THINGSBOARD_CUSTOMER_ID = '492387b0-a1e6-11ef-9e25-b7f6e6d4253b';

const COLUMNS = [
  { key: 'idx',                    label: '#',                         cls: 'col-idx',          type: 'idx'    },
  { key: 'os',                     label: 'OS',                        cls: 'col-os',           type: 'text'   },
  { key: 'centralName',            label: 'Central Name',             cls: 'col-central-name',  type: 'text'   },
  { key: 'thingsboard',            label: 'Thingsboard',              cls: 'col-thingsboard',   type: 'text'   },
  { key: 'appAntigo',              label: 'App Antigo',               cls: 'col-app-antigo',    type: 'text'   },
  { key: 'newNameOldDevice',       label: 'New Name to OLD DEVICE',   cls: 'col-new-name',      type: 'text'   },
  { key: 'slaveIdAntigo',          label: 'SlaveId Antigo',           cls: 'col-slave-antigo',  type: 'number' },
  { key: 'offsetAntigo',           label: 'Offset Antigo',            cls: 'col-offset-antigo', type: 'number' },
  { key: 'antesFix',               label: 'Antes FIX',                cls: 'col-antes-fix',     type: 'text'   },
  { key: 'aposFix',                label: 'Após FIX',                 cls: 'col-apos-fix',      type: 'text'   },
  { key: 'slaveIdNovo',            label: 'SlaveId Novo',             cls: 'col-slave-novo',    type: 'number' },
  { key: 'updateTemperatureHistory', label: 'Update temperature_history', cls: 'col-sql-hist',  type: 'sql'    },
  { key: 'updateOldName',          label: 'Update old name',          cls: 'col-sql-old',       type: 'sql'    },
  { key: 'updateNewName',          label: 'Update new name',          cls: 'col-sql-new',       type: 'sql'    },
  { key: 'status',                 label: 'Status',                   cls: 'col-status',        type: 'status' },
  { key: 'actions',                label: '',                         cls: 'col-actions',       type: 'actions'},
];

const STATUS_META = {
  nao_iniciado: { label: 'Not started',  bg: '#3A3A44', color: '#CCCCCC' },
  planejado:    { label: 'Planned',      bg: '#6B4ABF', color: '#FFFFFF' },
  em_execucao:  { label: 'In progress',  bg: '#F5A623', color: '#1A1A1A' },
  resolvido:    { label: 'Resolved',     bg: '#4CAF82', color: '#FFFFFF' },
};

const FILTER_TABS = [
  { key: 'all',          label: 'All'         },
  { key: 'nao_iniciado', label: 'Not started' },
  { key: 'planejado',    label: 'Planned'     },
  { key: 'em_execucao',  label: 'In progress' },
  { key: 'resolvido',    label: 'Resolved'    },
];

// ── Initial seed (29 rows) ────────────────────────────────────────────────────

const SEED_ROWS = [
  { id: 'row_001', os: 'Centro Cirúrgico 01', centralName: '', thingsboard: 'Cirurgia 01', appAntigo: 'Temp. Co2_Cirurgia1 -3', newNameOldDevice: 'OLD-T.e.m.p. Co2_Cirurgia1 -3', slaveIdAntigo: 75, offsetAntigo: -3, antesFix: 'GAS Co2_Cirurgia1 132 5000 x9.4', aposFix: '', slaveIdNovo: 76, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 76, value = value + (-3) WHERE slave_id = 75;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia1 -3' WHERE id = 75;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_Cirurgia1' WHERE id = 76;", status: 'nao_iniciado' },
  { id: 'row_002', os: 'Centro Cirúrgico 02', centralName: '', thingsboard: 'Cirurgia 02', appAntigo: 'Temp. CO2_CC02 -5', newNameOldDevice: 'OLD-T.e.m.p. CO2_CC02 -5', slaveIdAntigo: 111, offsetAntigo: -5, antesFix: 'GAS CO2_CC02 132 5000 x9.47', aposFix: '', slaveIdNovo: 110, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 110, value = value + (-5) WHERE slave_id = 111;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. CO2_CC02 -5' WHERE id = 111;", updateNewName: "UPDATE slaves SET name = 'Temp. CO2_CC02' WHERE id = 110;", status: 'nao_iniciado' },
  { id: 'row_003', os: 'Centro cirúrgico 03', centralName: '', thingsboard: 'Cirurgia 03', appAntigo: 'Temp. Co2_CC_03 -8', newNameOldDevice: 'OLD-T.e.m.p. Co2_CC_03 -8', slaveIdAntigo: 53, offsetAntigo: -8, antesFix: 'GAS Co2_CC_03 132 5000 x9.47', aposFix: '', slaveIdNovo: 52, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 52, value = value + (-8) WHERE slave_id = 53;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_CC_03 -8' WHERE id = 53;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_CC_03' WHERE id = 52;", status: 'nao_iniciado' },
  { id: 'row_004', os: 'Centro cirúrgico 05', centralName: '', thingsboard: 'Cirurgia 05', appAntigo: 'Temp. Co2_CC05 -6', newNameOldDevice: 'OLD-T.e.m.p. Co2_CC05 -6', slaveIdAntigo: 115, offsetAntigo: -6, antesFix: 'Gas Co2_CC05 132 500 x9.47', aposFix: '', slaveIdNovo: 114, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 114, value = value + (-6) WHERE slave_id = 115;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_CC05 -6' WHERE id = 115;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_CC05' WHERE id = 114;", status: 'nao_iniciado' },
  { id: 'row_005', os: 'Centro cirúrgico 06', centralName: '', thingsboard: 'Cirurgia 06', appAntigo: 'Temp. Co2_Cirurgia06 -4', newNameOldDevice: 'OLD-T.e.m.p. Co2_Cirurgia06 -4', slaveIdAntigo: 106, offsetAntigo: -4, antesFix: 'GAS Co2_Cirurgia06 132 5000 x9.47', aposFix: '', slaveIdNovo: 107, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 107, value = value + (-4) WHERE slave_id = 106;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia06 -4' WHERE id = 106;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_Cirurgia06' WHERE id = 107;", status: 'nao_iniciado' },
  { id: 'row_006', os: 'Centro cirúrgico 07', centralName: '', thingsboard: 'Cirurgia 07', appAntigo: 'Temp. Co2_Cirurgia7 -2', newNameOldDevice: 'OLD-T.e.m.p. Co2_Cirurgia7 -2', slaveIdAntigo: 63, offsetAntigo: -2, antesFix: 'GAS Co2_Cirurgia7 132 5000 x9.47', aposFix: '', slaveIdNovo: 64, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 64, value = value + (-2) WHERE slave_id = 63;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia7 -2' WHERE id = 63;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_Cirurgia7' WHERE id = 64;", status: 'nao_iniciado' },
  { id: 'row_007', os: 'Centro cirúrgico 07', centralName: '', thingsboard: 'Cirurgia 07 - Inst. 04/02/26', appAntigo: 'Temp. Co2_Cirurgia7_Apos_04_Fev_2026 -4', newNameOldDevice: 'OLD-T.e.m.p. Co2_Cirurgia7_Apos_04_Fev_2026 -4', slaveIdAntigo: 158, offsetAntigo: -4, antesFix: 'GAS Co2_Cirurgia7 132 5000 x9.47', aposFix: '', slaveIdNovo: 64, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 64, value = value + (-4) WHERE slave_id = 158;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia7_Apos_04_Fev_2026 -4' WHERE id = 158;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_Cirurgia7' WHERE id = 64;", status: 'nao_iniciado' },
  { id: 'row_008', os: 'Centro cirúrgico 08', centralName: '', thingsboard: 'Cirurgia 08', appAntigo: 'Temp. Co2_Cirurgia8 -3', newNameOldDevice: 'OLD-T.e.m.p. Co2_Cirurgia8 -3', slaveIdAntigo: 143, offsetAntigo: -3, antesFix: 'Temp. Co2_Cirurgia8', aposFix: '', slaveIdNovo: 50, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 50, value = value + (-3) WHERE slave_id = 143;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia8 -3' WHERE id = 143;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_Cirurgia8' WHERE id = 50;", status: 'nao_iniciado' },
  { id: 'row_009', os: 'Centro cirúrgico 09', centralName: '', thingsboard: 'Cirurgia 09', appAntigo: 'Temp. Co2_Cirurgia9 -3', newNameOldDevice: 'OLD-T.e.m.p. Co2_Cirurgia9 -3', slaveIdAntigo: 155, offsetAntigo: -3, antesFix: 'GAS Co2_Cirurgia9 132 5000 x9.47', aposFix: '', slaveIdNovo: 54, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 54, value = value + (-3) WHERE slave_id = 155;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia9 -3' WHERE id = 155;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_Cirurgia9' WHERE id = 54;", status: 'nao_iniciado' },
  { id: 'row_010', os: 'RPA', centralName: '', thingsboard: 'RPA', appAntigo: 'Temp. CO2_RPA -8', newNameOldDevice: 'OLD-T.e.m.p. CO2_RPA -8', slaveIdAntigo: 109, offsetAntigo: -8, antesFix: 'GAS CO2_RPA 132 500 x9.47', aposFix: '', slaveIdNovo: 108, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 108, value = value + (-8) WHERE slave_id = 109;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. CO2_RPA -8' WHERE id = 109;", updateNewName: "UPDATE slaves SET name = 'Temp. CO2_RPA' WHERE id = 108;", status: 'nao_iniciado' },
  { id: 'row_011', os: 'Centro cirúrgico 10', centralName: '', thingsboard: 'Cirurgia 10', appAntigo: 'Temp. CO2_CC10 -5', newNameOldDevice: 'OLD-T.e.m.p. CO2_CC10 -5', slaveIdAntigo: 113, offsetAntigo: -5, antesFix: 'GAS CO2_CC10 132 5000 x9.47', aposFix: '', slaveIdNovo: 112, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 112, value = value + (-5) WHERE slave_id = 113;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. CO2_CC10 -5' WHERE id = 113;", updateNewName: "UPDATE slaves SET name = 'Temp. CO2_CC10' WHERE id = 112;", status: 'nao_iniciado' },
  { id: 'row_012', os: 'Laboratório', centralName: '', thingsboard: 'Laboratorio', appAntigo: 'Temp. Co2_Laboratorio -6', newNameOldDevice: 'OLD-T.e.m.p. Co2_Laboratorio -6', slaveIdAntigo: 80, offsetAntigo: -6, antesFix: 'GAS Co2_Laboratorio 132 5000 x9.47', aposFix: '', slaveIdNovo: 79, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 79, value = value + (-6) WHERE slave_id = 80;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Laboratorio -6' WHERE id = 80;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_Laboratorio' WHERE id = 79;", status: 'nao_iniciado' },
  { id: 'row_013', os: 'CTI 03', centralName: '', thingsboard: 'CTI 03', appAntigo: 'Temp. Co2_CTI_03 -9', newNameOldDevice: 'OLD-T.e.m.p. Co2_CTI_03 -9', slaveIdAntigo: 128, offsetAntigo: -9, antesFix: 'GAS Co2_CTI_03 132 5000 x9.47', aposFix: '', slaveIdNovo: 127, updateTemperatureHistory: 'UPDATE temperature_history SET slave_id = 127, value = value + (-9) WHERE slave_id = 128;', updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_CTI_03 -9' WHERE id = 128;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_CTI_03' WHERE id = 127;", status: 'nao_iniciado' },
  { id: 'row_014', os: 'CER (sala medicação)', centralName: '', thingsboard: 'Medicação CER', appAntigo: 'Temp. Co2_Medicacao_CER -6', newNameOldDevice: 'OLD-T.e.m.p. Co2_Medicacao_CER -6', slaveIdAntigo: 10, offsetAntigo: -6, antesFix: 'GAS Co2_CTI_03 132 5000 x9.47', aposFix: 'Temp. Co2_Medicacao_CER', slaveIdNovo: 11, updateTemperatureHistory: "UPDATE temperature_history SET slave_id = 11, value = value + (-6) WHERE slave_id = 10 AND timestamp >= NOW() - INTERVAL '30 days';", updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Medicacao_CER -6' WHERE id = 10;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_Medicacao_CER' WHERE id = 11;", status: 'nao_iniciado' },
  { id: 'row_015', os: 'Centro Obstétrico 03', centralName: '', thingsboard: 'Centro Obstétrico 03', appAntigo: 'Temp. Co2_Centro_Obstetrico_03 -4', newNameOldDevice: 'OLD-T.e.m.p. Co2_Centro_Obstetrico_03 -4', slaveIdAntigo: 27, offsetAntigo: -4, antesFix: 'GAS Co2_Centro_Obstetrico_03 132 5000 x9.4', aposFix: 'Temp. Co2_Centro_Obstetrico_03', slaveIdNovo: 28, updateTemperatureHistory: "UPDATE temperature_history SET slave_id = 28, value = value + (-4) WHERE slave_id = 27 AND timestamp >= NOW() - INTERVAL '90 days';", updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Centro_Obstetrico_03 -4' WHERE id = 27;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_Centro_Obstetrico_03' WHERE id = 28;", status: 'nao_iniciado' },
  { id: 'row_016', os: 'Centro Obstétrico 02', centralName: '', thingsboard: 'Centro Obstétrico 02', appAntigo: 'Temp. Co2_Centro_Obstetrico_02 -3', newNameOldDevice: 'OLD-T.e.m.p. Co2_Centro_Obstetrico_02 -3', slaveIdAntigo: 8, offsetAntigo: -3, antesFix: 'GAS Co2_Centro_Obstetrico_02 132 5000 x9.47', aposFix: 'Temp. Co2_Centro_Obstetrico_02', slaveIdNovo: 10, updateTemperatureHistory: "UPDATE temperature_history SET slave_id = 10, value = value + (-3) WHERE slave_id = 8 AND timestamp >= NOW() - INTERVAL '90 days';", updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Centro_Obstetrico_02 -3' WHERE id = 8;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_Centro_Obstetrico_02' WHERE id = 10;", status: 'nao_iniciado' },
  { id: 'row_017', os: 'Centro Obstétrico 01', centralName: '', thingsboard: 'Centro Obstétrico 01', appAntigo: 'Temp. Co2_Centro_Obstetrico_01 -4', newNameOldDevice: 'OLD-T.e.m.p. Co2_Centro_Obstetrico_01 -4', slaveIdAntigo: 19, offsetAntigo: -4, antesFix: 'GAS Co2_Centro_Obstetrico_01 132 5000 x9.47', aposFix: 'Temp. Co2_Centro_Obstetrico_01', slaveIdNovo: 20, updateTemperatureHistory: "UPDATE temperature_history SET slave_id = 20, value = value + (-4) WHERE slave_id = 19 AND timestamp >= NOW() - INTERVAL '90 days';", updateOldName: "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Centro_Obstetrico_01 -4' WHERE id = 19;", updateNewName: "UPDATE slaves SET name = 'Temp. Co2_Centro_Obstetrico_01' WHERE id = 20;", status: 'nao_iniciado' },
  { id: 'row_018', os: 'Repetidor Centro cirúrgico', centralName: '', thingsboard: '', appAntigo: '', newNameOldDevice: '', slaveIdAntigo: '', offsetAntigo: '', antesFix: '', aposFix: '', slaveIdNovo: '', updateTemperatureHistory: '', updateOldName: '', updateNewName: '', status: 'nao_iniciado' },
  { id: 'row_019', os: 'UTI Neonatal (Maternidade)', centralName: '', thingsboard: '', appAntigo: '', newNameOldDevice: '', slaveIdAntigo: '', offsetAntigo: '', antesFix: '', aposFix: '', slaveIdNovo: '', updateTemperatureHistory: '', updateOldName: '', updateNewName: '', status: 'nao_iniciado' },
  { id: 'row_020', os: 'Centro Cirúrgico 04', centralName: '', thingsboard: '', appAntigo: '', newNameOldDevice: '', slaveIdAntigo: '', offsetAntigo: '', antesFix: '', aposFix: '', slaveIdNovo: '', updateTemperatureHistory: '', updateOldName: '', updateNewName: '', status: 'nao_iniciado' },
  { id: 'row_021', os: 'CTI 01', centralName: '', thingsboard: '', appAntigo: '', newNameOldDevice: '', slaveIdAntigo: '', offsetAntigo: '', antesFix: '', aposFix: '', slaveIdNovo: '', updateTemperatureHistory: '', updateOldName: '', updateNewName: '', status: 'nao_iniciado' },
  { id: 'row_022', os: 'CTI 02', centralName: '', thingsboard: '', appAntigo: '', newNameOldDevice: '', slaveIdAntigo: '', offsetAntigo: '', antesFix: '', aposFix: '', slaveIdNovo: '', updateTemperatureHistory: '', updateOldName: '', updateNewName: '', status: 'nao_iniciado' },
  { id: 'row_023', os: 'Raio X 04', centralName: '', thingsboard: '', appAntigo: '', newNameOldDevice: '', slaveIdAntigo: '', offsetAntigo: '', antesFix: '', aposFix: '', slaveIdNovo: '', updateTemperatureHistory: '', updateOldName: '', updateNewName: '', status: 'nao_iniciado' },
  { id: 'row_024', os: 'Raio X 01', centralName: '', thingsboard: '', appAntigo: '', newNameOldDevice: '', slaveIdAntigo: '', offsetAntigo: '', antesFix: '', aposFix: '', slaveIdNovo: '', updateTemperatureHistory: '', updateOldName: '', updateNewName: '', status: 'nao_iniciado' },
  { id: 'row_025', os: 'Tomografia 01', centralName: '', thingsboard: '', appAntigo: '', newNameOldDevice: '', slaveIdAntigo: '', offsetAntigo: '', antesFix: '', aposFix: '', slaveIdNovo: '', updateTemperatureHistory: '', updateOldName: '', updateNewName: '', status: 'nao_iniciado' },
  { id: 'row_026', os: 'Raio X 03', centralName: '', thingsboard: '', appAntigo: '', newNameOldDevice: '', slaveIdAntigo: '', offsetAntigo: '', antesFix: '', aposFix: '', slaveIdNovo: '', updateTemperatureHistory: '', updateOldName: '', updateNewName: '', status: 'nao_iniciado' },
  { id: 'row_027', os: 'Hemodiálise', centralName: '', thingsboard: '', appAntigo: '', newNameOldDevice: '', slaveIdAntigo: '', offsetAntigo: '', antesFix: '', aposFix: '', slaveIdNovo: '', updateTemperatureHistory: '', updateOldName: '', updateNewName: '', status: 'nao_iniciado' },
  { id: 'row_028', os: 'Agência Transfusional', centralName: '', thingsboard: '', appAntigo: '', newNameOldDevice: '', slaveIdAntigo: '', offsetAntigo: '', antesFix: '', aposFix: '', slaveIdNovo: '', updateTemperatureHistory: '', updateOldName: '', updateNewName: '', status: 'nao_iniciado' },
  { id: 'row_029', os: 'CTI 04', centralName: '', thingsboard: '', appAntigo: '', newNameOldDevice: '', slaveIdAntigo: '', offsetAntigo: '', antesFix: '', aposFix: '', slaveIdNovo: '', updateTemperatureHistory: '', updateOldName: '', updateNewName: '', status: 'nao_iniciado' },
];

// ── Module-level State ────────────────────────────────────────────────────────

let _rows = [];
let _filterTab = 'all';
let _customerId = null;
let _saveTimer = null;
let _root = null;
let _saveIndicatorEl = null;
let _fileInput = null;

// ── ThingsBoard API Helpers ───────────────────────────────────────────────────

function getHttp() {
  return self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));
}

function _resolveCustomerId() {
  // 0. Hardcoded — HMSA (most reliable)
  if (THINGSBOARD_CUSTOMER_ID) return THINGSBOARD_CUSTOMER_ID;

  // 1. currentUser.customerId
  try {
    var cu = self.ctx && self.ctx.currentUser && self.ctx.currentUser.customerId;
    if (cu && cu.id) return cu.id;
  } catch (_) { /* ignore */ }

  // 2. defaultSubscription datasource entityId
  try {
    var ds = self.ctx.defaultSubscription
      && self.ctx.defaultSubscription.configuredDatasources
      && self.ctx.defaultSubscription.configuredDatasources[0];
    if (ds && ds.entityId && ds.entityId.entityType === 'CUSTOMER') {
      return ds.entityId.id;
    }
  } catch (_) { /* ignore */ }

  // 3. URL query string
  try {
    var p = new URLSearchParams(window.location.search);
    var fromUrl = p.get('customerId');
    if (fromUrl) return fromUrl;
  } catch (_) { /* ignore */ }

  // 4. stateController
  try {
    var sp = self.ctx.stateController
      && self.ctx.stateController.getStateParams
      && self.ctx.stateController.getStateParams();
    if (sp && sp.customerId && sp.customerId.id) return sp.customerId.id;
  } catch (_) { /* ignore */ }

  return null;
}

async function _loadAttribute() {
  if (!_customerId) throw new Error('customerId not resolved');
  var url = '/api/plugins/telemetry/CUSTOMER/' + _customerId
    + '/values/attributes/SERVER_SCOPE?keys=' + ATTR_KEY;
  var resp = await getHttp().get(url).toPromise();
  var data = (resp && resp.data) ? resp.data : resp;
  var arr = Array.isArray(data) ? data : [];
  var found = arr.find(function(a) { return a.key === ATTR_KEY; });
  if (!found || found.value == null || found.value === '') return null;
  var val = found.value;
  if (typeof val === 'string') {
    return JSON.parse(val);
  }
  return val;
}

async function _saveAttribute(rows) {
  if (!_customerId) {
    console.error('[FTR] customerId not available — cannot save');
    return;
  }
  var url = '/api/plugins/telemetry/CUSTOMER/' + _customerId
    + '/attributes/SERVER_SCOPE';
  var body = {};
  body[ATTR_KEY] = JSON.stringify(rows);
  await getHttp().post(url, body).toPromise();
}

// ── Debounced Save ────────────────────────────────────────────────────────────

function _scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _setSaveIndicator('saving');
  _saveTimer = setTimeout(function() {
    _saveTimer = null;
    _saveAttribute(_rows).then(function() {
      _setSaveIndicator('saved');
      setTimeout(function() { _setSaveIndicator('idle'); }, 2000);
    }).catch(function(err) {
      console.error('[FTR] save failed:', err);
      _setSaveIndicator('error');
    });
  }, 500);
}

function _setSaveIndicator(state) {
  if (!_saveIndicatorEl) return;
  _saveIndicatorEl.className = 'ftr-save-indicator ' + state;
  var msgs = { idle: '', saving: '⟳ Saving…', saved: '✓ Saved', error: '✗ Save failed' };
  _saveIndicatorEl.textContent = msgs[state] || '';
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function _getFilteredRows() {
  if (_filterTab === 'all') return _rows;
  return _rows.filter(function(r) { return r.status === _filterTab; });
}

function _getCounters() {
  var total = _rows.length;
  var counts = { nao_iniciado: 0, planejado: 0, em_execucao: 0, resolvido: 0 };
  _rows.forEach(function(r) {
    if (counts[r.status] !== undefined) counts[r.status]++;
  });
  return { total: total, counts: counts };
}

function _esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _renderStatusBadge(status) {
  var meta = STATUS_META[status] || STATUS_META.nao_iniciado;
  return '<span class="ftr-badge ftr-badge-' + status + '" '
    + 'style="background:' + meta.bg + ';color:' + meta.color + '">'
    + meta.label + '</span>';
}

function _renderCellContent(col, row) {
  if (col.type === 'idx') {
    var idx = _rows.indexOf(row) + 1;
    return '<span class="ftr-num">' + idx + '</span>';
  }
  if (col.type === 'status') {
    return _renderStatusBadge(row.status);
  }
  if (col.type === 'actions') {
    return '<div class="ftr-row-actions">'
      + '<button class="ftr-row-btn" data-action="dup" data-id="' + _esc(row.id) + '" title="Duplicate">⧉</button>'
      + '<button class="ftr-row-btn danger" data-action="del" data-id="' + _esc(row.id) + '" title="Delete">✕</button>'
      + '</div>';
  }
  if (col.type === 'sql') {
    var val = row[col.key] || '';
    return '<div class="ftr-sql-cell">'
      + '<span class="ftr-sql-text">' + _esc(val) + '</span>'
      + '<button class="ftr-copy-btn" data-action="copy" data-id="' + _esc(row.id) + '" data-field="' + col.key + '" title="Copy">Copy</button>'
      + '</div>';
  }
  var v = row[col.key];
  return _esc(v == null ? '' : v);
}

function _renderTable() {
  var filtered = _getFilteredRows();
  var html = '<table class="ftr-table"><thead><tr>';

  COLUMNS.forEach(function(col) {
    html += '<th class="' + col.cls + '">' + _esc(col.label) + '</th>';
  });
  html += '</tr></thead><tbody>';

  if (filtered.length === 0) {
    html += '<tr><td colspan="' + COLUMNS.length + '" style="text-align:center;color:#888;padding:24px;">No rows match the current filter.</td></tr>';
  } else {
    filtered.forEach(function(row) {
      html += '<tr data-id="' + _esc(row.id) + '">';
      COLUMNS.forEach(function(col) {
        var extraClass = (col.type === 'number') ? ' ftr-num' : '';
        html += '<td class="' + col.cls + extraClass + '" '
          + (col.type !== 'idx' && col.type !== 'actions' ? 'data-editable="1" data-id="' + _esc(row.id) + '" data-field="' + col.key + '"' : '')
          + '>'
          + _renderCellContent(col, row)
          + '</td>';
      });
      html += '</tr>';
    });
  }

  html += '</tbody></table>';
  return html;
}

function _renderCounters() {
  var c = _getCounters();
  var sep = '<span class="ftr-counter-sep">•</span>';
  return 'Total: <span class="ftr-counter-val">' + c.total + '</span>'
    + sep + 'Resolved: <span class="ftr-counter-val">' + c.counts.resolvido + '</span>'
    + sep + 'In progress: <span class="ftr-counter-val">' + c.counts.em_execucao + '</span>'
    + sep + 'Planned: <span class="ftr-counter-val">' + c.counts.planejado + '</span>'
    + sep + 'Not started: <span class="ftr-counter-val">' + c.counts.nao_iniciado + '</span>';
}

function _renderFilterTabs() {
  return FILTER_TABS.map(function(t) {
    var active = _filterTab === t.key ? ' active' : '';
    return '<button class="ftr-tab' + active + '" data-tab="' + t.key + '">' + t.label + '</button>';
  }).join('');
}

function _buildWidget() {
  _root.innerHTML = ''
    + '<div class="ftr-header">'
    +   '<div class="ftr-title">Fix Souza Aguiar — Temperature Sensors</div>'
    +   '<div class="ftr-counters" id="ftr-counters">' + _renderCounters() + '</div>'
    +   '<div class="ftr-filter-tabs" id="ftr-filter-tabs">' + _renderFilterTabs() + '</div>'
    +   '<div class="ftr-toolbar">'
    +     '<button class="ftr-btn primary" id="ftr-add-row">+ Add row</button>'
    +     '<button class="ftr-btn" id="ftr-export">⬇ Export JSON</button>'
    +     '<button class="ftr-btn" id="ftr-import">⬆ Import JSON</button>'
    +     '<span class="ftr-save-indicator" id="ftr-save-indicator"></span>'
    +   '</div>'
    + '</div>'
    + '<div class="ftr-table-wrap" id="ftr-table-wrap">'
    +   _renderTable()
    + '</div>';

  _saveIndicatorEl = _root.querySelector('#ftr-save-indicator');
  _bindEvents();
}

function _refreshTable() {
  var wrap = _root.querySelector('#ftr-table-wrap');
  if (wrap) wrap.innerHTML = _renderTable();
  var counters = _root.querySelector('#ftr-counters');
  if (counters) counters.innerHTML = _renderCounters();
  var tabs = _root.querySelector('#ftr-filter-tabs');
  if (tabs) tabs.innerHTML = _renderFilterTabs();
  _bindTableEvents();
  _bindTabEvents();
}

function _bindEvents() {
  // Toolbar
  var addBtn = _root.querySelector('#ftr-add-row');
  if (addBtn) addBtn.addEventListener('click', _addRow);

  var exportBtn = _root.querySelector('#ftr-export');
  if (exportBtn) exportBtn.addEventListener('click', _exportJSON);

  var importBtn = _root.querySelector('#ftr-import');
  if (importBtn) importBtn.addEventListener('click', function() {
    if (_fileInput) _fileInput.click();
  });

  _bindTabEvents();
  _bindTableEvents();
}

function _bindTabEvents() {
  var tabs = _root.querySelectorAll('.ftr-tab');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      _filterTab = tab.dataset.tab;
      _refreshTable();
    });
  });
}

function _bindTableEvents() {
  var wrap = _root.querySelector('#ftr-table-wrap');
  if (!wrap) return;

  // Delegate: cell click for inline edit
  wrap.addEventListener('click', function(e) {
    var td = e.target.closest('td[data-editable]');
    if (td && !td.querySelector('input, textarea, select')) {
      _startEdit(td);
      return;
    }

    // Copy button
    var copyBtn = e.target.closest('[data-action="copy"]');
    if (copyBtn) {
      e.stopPropagation();
      var id = copyBtn.dataset.id;
      var field = copyBtn.dataset.field;
      var row = _findRowById(id);
      if (row) {
        navigator.clipboard && navigator.clipboard.writeText(row[field] || '').then(function() {
          copyBtn.textContent = 'Copied!';
          setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
        }).catch(function() {
          // fallback
          var ta = document.createElement('textarea');
          ta.value = row[field] || '';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          copyBtn.textContent = 'Copied!';
          setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
        });
      }
      return;
    }

    // Duplicate
    var dupBtn = e.target.closest('[data-action="dup"]');
    if (dupBtn) {
      e.stopPropagation();
      _duplicateRow(dupBtn.dataset.id);
      return;
    }

    // Delete
    var delBtn = e.target.closest('[data-action="del"]');
    if (delBtn) {
      e.stopPropagation();
      _showDeleteConfirm(delBtn.dataset.id);
      return;
    }

    // Note: confirm-dialog buttons are outside #ftr-table-wrap — handled via direct listeners in _showDeleteConfirm
  }, true);
}

// ── Inline Edit ───────────────────────────────────────────────────────────────

function _startEdit(td) {
  var id = td.dataset.id;
  var field = td.dataset.field;
  var row = _findRowById(id);
  if (!row) return;

  var col = COLUMNS.find(function(c) { return c.key === field; });
  if (!col) return;

  var originalContent = td.innerHTML;
  var currentVal = row[field];

  var el;

  if (col.type === 'status') {
    el = document.createElement('select');
    el.className = 'ftr-edit-select';
    Object.keys(STATUS_META).forEach(function(k) {
      var opt = document.createElement('option');
      opt.value = k;
      opt.textContent = STATUS_META[k].label;
      if (k === currentVal) opt.selected = true;
      el.appendChild(opt);
    });
  } else if (col.type === 'sql') {
    el = document.createElement('textarea');
    el.className = 'ftr-edit-textarea';
    el.value = currentVal || '';
    el.rows = Math.max(3, (String(currentVal || '').match(/\n/g) || []).length + 2);
  } else if (col.type === 'number') {
    el = document.createElement('input');
    el.type = 'number';
    el.className = 'ftr-edit-input';
    el.value = currentVal === '' || currentVal == null ? '' : currentVal;
  } else {
    el = document.createElement('input');
    el.type = 'text';
    el.className = 'ftr-edit-input';
    el.value = currentVal || '';
  }

  td.innerHTML = '';
  td.appendChild(el);
  el.focus();
  if (el.select && col.type !== 'sql') el.select();

  function commit() {
    var newVal;
    if (col.type === 'number') {
      newVal = el.value === '' ? '' : Number(el.value);
    } else {
      newVal = el.value;
    }
    row[field] = newVal;
    _scheduleSave();
    // Re-render just this cell
    if (col.type === 'status') {
      td.innerHTML = _renderStatusBadge(row.status);
      // Update counters
      var counters = _root.querySelector('#ftr-counters');
      if (counters) counters.innerHTML = _renderCounters();
      // Rebind for next click
    } else if (col.type === 'sql') {
      td.innerHTML = '<div class="ftr-sql-cell"><span class="ftr-sql-text">' + _esc(newVal) + '</span>'
        + '<button class="ftr-copy-btn" data-action="copy" data-id="' + _esc(id) + '" data-field="' + field + '" title="Copy">Copy</button></div>';
    } else {
      td.innerHTML = _esc(newVal);
    }
    td.setAttribute('data-editable', '1');
  }

  function cancel() {
    td.innerHTML = originalContent;
    td.setAttribute('data-editable', '1');
  }

  el.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && col.type !== 'sql') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      cancel();
    }
  });

  el.addEventListener('blur', function() {
    // Only commit if el is still in the td
    if (td.contains(el)) {
      commit();
    }
  });
}

// ── Row Operations ────────────────────────────────────────────────────────────

function _findRowById(id) {
  return _rows.find(function(r) { return r.id === id; }) || null;
}

function _nextId() {
  var maxN = 0;
  _rows.forEach(function(r) {
    var m = r.id.match(/^row_(\d+)$/);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n > maxN) maxN = n;
    }
  });
  return 'row_' + String(maxN + 1).padStart(3, '0');
}

function _addRow() {
  var newRow = {
    id: _nextId(),
    os: '',
    thingsboard: '',
    appAntigo: '',
    newNameOldDevice: '',
    slaveIdAntigo: '',
    offsetAntigo: '',
    antesFix: '',
    aposFix: '',
    slaveIdNovo: '',
    updateTemperatureHistory: '',
    updateOldName: '',
    updateNewName: '',
    status: 'nao_iniciado',
  };
  _rows.push(newRow);
  _scheduleSave();
  _refreshTable();
}

function _duplicateRow(id) {
  var row = _findRowById(id);
  if (!row) return;
  var copy = Object.assign({}, row, { id: _nextId() });
  var idx = _rows.indexOf(row);
  _rows.splice(idx + 1, 0, copy);
  _scheduleSave();
  _refreshTable();
}

function _showDeleteConfirm(id) {
  var row = _findRowById(id);
  if (!row) return;
  _hideDeleteConfirm();
  var overlay = document.createElement('div');
  overlay.className = 'ftr-confirm-overlay';
  overlay.id = 'ftr-confirm-overlay';
  overlay.innerHTML = ''
    + '<div class="ftr-confirm-box">'
    +   '<p class="ftr-confirm-msg">Delete row <strong>' + _esc(row.os || row.id) + '</strong>?</p>'
    +   '<p class="ftr-confirm-sub">This will remove the row and update the server attribute.</p>'
    +   '<div class="ftr-confirm-actions">'
    +     '<button class="ftr-btn ftr-confirm-btn-yes" id="ftr-confirm-yes">Delete</button>'
    +     '<button class="ftr-btn ftr-confirm-btn-no"  id="ftr-confirm-no">Cancel</button>'
    +   '</div>'
    + '</div>';
  _root.appendChild(overlay);
  // Direct listeners — overlay is outside #ftr-table-wrap so delegation doesn't reach it
  overlay.querySelector('#ftr-confirm-yes').addEventListener('click', function(e) {
    e.stopPropagation();
    _executeDelete(id);
  });
  overlay.querySelector('#ftr-confirm-no').addEventListener('click', function(e) {
    e.stopPropagation();
    _hideDeleteConfirm();
  });
}

function _hideDeleteConfirm() {
  var el = document.getElementById('ftr-confirm-overlay');
  if (el) el.parentNode.removeChild(el);
}

function _executeDelete(id) {
  _hideDeleteConfirm();
  _rows = _rows.filter(function(r) { return r.id !== id; });
  _refreshTable();
  // Show immediate "Deleted" feedback, then let _scheduleSave show saving/saved
  if (_saveIndicatorEl) {
    _saveIndicatorEl.className = 'ftr-save-indicator saved';
    _saveIndicatorEl.textContent = '✓ Row deleted';
  }
  _scheduleSave();   // posts full _rows array to SERVER_SCOPE
}

// kept for backward-compat (no longer called internally)
function _deleteRow(id) {
  _showDeleteConfirm(id);
}

// ── Export / Import ───────────────────────────────────────────────────────────

function _exportJSON() {
  var now = new Date();
  var pad = function(n) { return String(n).padStart(2, '0'); };
  var ts = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
    + '_' + pad(now.getHours()) + pad(now.getMinutes());
  var filename = 'fix_souza_aguiar_' + ts + '.json';
  var json = JSON.stringify(_rows, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _setupFileInput() {
  _fileInput = document.createElement('input');
  _fileInput.type = 'file';
  _fileInput.accept = '.json';
  _fileInput.style.display = 'none';
  document.body.appendChild(_fileInput);

  _fileInput.addEventListener('change', function() {
    var file = _fileInput.files && _fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var parsed = JSON.parse(e.target.result);
        if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
        if (!confirm('Import ' + parsed.length + ' rows from "' + file.name + '"? This will replace all current data.')) {
          _fileInput.value = '';
          return;
        }
        _rows = parsed;
        _scheduleSave();
        _refreshTable();
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
      _fileInput.value = '';
    };
    reader.onerror = function() {
      alert('Failed to read file.');
      _fileInput.value = '';
    };
    reader.readAsText(file);
  });
}

// ── Show Loading / Error states ───────────────────────────────────────────────

function _showLoading() {
  if (_root) {
    _root.innerHTML = '<div class="ftr-loading"><div class="ftr-spinner"></div> Loading data…</div>';
  }
}

function _showError(msg) {
  if (_root) {
    _root.innerHTML = '<div class="ftr-empty" style="color:#E05555;">Error: ' + _esc(msg) + '</div>';
  }
}

// ── ThingsBoard Lifecycle ─────────────────────────────────────────────────────

self.onInit = async function() {
  _root = document.getElementById('fix-temp-registry-root');
  if (!_root) {
    console.error('[FTR] Root element #fix-temp-registry-root not found');
    return;
  }

  _showLoading();
  _setupFileInput();

  // Resolve customerId
  _customerId = _resolveCustomerId();
  if (!_customerId) {
    _showError('Could not resolve customerId. Open this widget in the context of a customer dashboard.');
    return;
  }

  // Load attribute
  try {
    var loaded = await _loadAttribute();
    if (loaded && Array.isArray(loaded) && loaded.length > 0) {
      _rows = loaded;
    } else {
      // First load: seed and save
      _rows = JSON.parse(JSON.stringify(SEED_ROWS));
      await _saveAttribute(_rows);
    }
  } catch (err) {
    console.error('[FTR] Failed to load attribute:', err);
    // Render with seed as fallback — user data won't persist, but widget is usable
    _rows = JSON.parse(JSON.stringify(SEED_ROWS));
  }

  _buildWidget();
};

self.onDataUpdated = function() {
  // This widget doesn't rely on ThingsBoard datasource data — no-op.
};

self.onDestroy = function() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  if (_fileInput && _fileInput.parentNode) {
    _fileInput.parentNode.removeChild(_fileInput);
    _fileInput = null;
  }
  _root = null;
  _saveIndicatorEl = null;
};
