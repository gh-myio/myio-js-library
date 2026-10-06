// Generates showcase/inventory-panel/fixtures/devices.json — synthetic data, no customer data.
// Values follow the TB entitiesQuery contract: every value is a string; a missing key is ''.
// lastActivityTime uses the token "AGO:<hours>" so the showcase rebases it on load.
const fs = require('fs');
const path = require('path');
const out = path.resolve(process.argv[2]);

let seq = 0;
const uuid = () => {
  seq++;
  const h = seq.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${h}`;
};

const customers = [
  { id: uuid(), title: 'Shopping Alfa' },
  { id: uuid(), title: 'Shopping Beta' },
  { id: uuid(), title: 'Loja Sem Integração' },
  { id: uuid(), title: 'Cliente Antigo DESATIVAR' },
];

const devices = [];
let slave = 1;
function add(o) {
  const ownerType = o.owner ? 'CUSTOMER' : 'TENANT';
  devices.push({
    case: o.case,
    id: uuid(),
    fields: {
      name: o.name,
      label: o.label === undefined ? '' : o.label,
      type: o.type || o.profile || 'default',
      createdTime: String(Date.UTC(2025, 5, 1)),
      ownerName: o.owner || 'MYIO Tenant',
      ownerType,
    },
    attrs: {
      deviceProfile: o.profile === undefined ? '' : o.profile,
      identifier: o.identifier || '',
      ingestionId: o.ingestionId === undefined ? `ing-${seq}` : o.ingestionId,
      gcdrDeviceId: o.gcdrDeviceId === undefined ? `gcdr-${seq}` : o.gcdrDeviceId,
      centralId: o.centralId === undefined ? 'central-alfa-1' : o.centralId,
      slaveId: o.slaveId === undefined ? String(slave++) : o.slaveId,
      lifecycleStatus: o.lifecycle || '',
      active: o.active === undefined ? 'true' : o.active,
      lastActivityTime: o.ago === undefined ? 'AGO:1' : o.ago === '' ? '' : `AGO:${o.ago}`,
    },
  });
}

// --- Shopping Alfa: healthy devices across domains ---
const alfaProfiles = ['3F_MEDIDOR', '3F_MEDIDOR', '3F_MEDIDOR', 'HIDROMETRO', 'CHILLER', 'FANCOIL', 'ELEVADOR', 'ESCADA_ROLANTE', 'BOMBA_CAG', 'HIDROMETRO_AREA_COMUM'];
for (let i = 1; i <= 30; i++) {
  const p = alfaProfiles[i % alfaProfiles.length];
  add({ case: 'healthy', owner: 'Shopping Alfa', profile: p, name: `3F ALFA${String(i).padStart(3, '0')}`, label: `Loja ${i} ${p === 'HIDROMETRO' ? 'Água' : ''}`.trim(), identifier: `L${i}` });
}
add({ case: 'thermostat (no central needed)', owner: 'Shopping Alfa', profile: 'TERMOSTATO', name: 'TEMP ALFA01', label: 'Praça de Alimentação', centralId: '', slaveId: '' });

// --- Shopping Alfa: one device per rule outcome ---
add({ case: 'C2 no deviceProfile', owner: 'Shopping Alfa', profile: '', name: '3F ALFA-SEMPERFIL', label: 'Sem perfil' });
add({ case: 'C3 no ingestionId (critical)', owner: 'Shopping Alfa', profile: '3F_MEDIDOR', name: '3F ALFA-SEMING', label: 'Sem ingestion', ingestionId: '' });
add({ case: 'C4 no gcdrDeviceId (pending)', owner: 'Shopping Alfa', profile: '3F_MEDIDOR', name: '3F ALFA-SEMGCDR', label: 'Sem GCDR', gcdrDeviceId: '' });
add({ case: 'C5 unrecognized profile', owner: 'Shopping Alfa', profile: 'Park Lagos CAG', name: '3F ALFA-PERFILX', label: 'Perfil estranho' });
add({ case: 'C6 profile differs from TB type (info, off by default)', owner: 'Shopping Alfa', profile: '3F_MEDIDOR', type: 'default', name: '3F ALFA-TYPEDEFAULT', label: 'Tipo default no TB' });
add({ case: 'C7 energy device without central', owner: 'Shopping Alfa', profile: '3F_MEDIDOR', name: '3F ALFA-SEMCENTRAL', label: 'Sem central', centralId: '' });
add({ case: 'C8 duplicate ingestionId (1/2)', owner: 'Shopping Alfa', profile: 'HIDROMETRO', name: 'HIDR ALFA-DUP-A', label: 'Hidrômetro duplicado A', ingestionId: 'ing-duplicado' });
add({ case: 'C8 duplicate ingestionId (2/2)', owner: 'Shopping Alfa', profile: 'HIDROMETRO', name: 'HIDR ALFA-DUP-B', label: 'Hidrômetro duplicado B', ingestionId: 'ing-duplicado' });
add({ case: 'C8 ignored: archived twin of an active id', owner: 'Shopping Alfa', profile: '3F_MEDIDOR', name: '3F ALFA-OLD', label: 'Medidor substituído', ingestionId: 'ing-substituido', lifecycle: 'archived', active: 'false', ago: 900 });
add({ case: 'C8 ignored: active device sharing the archived id', owner: 'Shopping Alfa', profile: '3F_MEDIDOR', name: '3F ALFA-NEW', label: 'Medidor novo', ingestionId: 'ing-substituido' });
add({ case: 'A1 inactive in TB', owner: 'Shopping Alfa', profile: 'FANCOIL', name: '3F ALFA-INATIVO', label: 'Fancoil inativo', active: 'false', ago: 2 });
add({ case: 'A2 stale 3 days', owner: 'Shopping Alfa', profile: 'CHILLER', name: '3F ALFA-SILENCIO', label: 'Chiller calado', ago: 72 });
add({ case: 'A2 no lastActivityTime (Sem dado)', owner: 'Shopping Alfa', profile: 'MOTOR', name: '3F ALFA-SEMDADO', label: 'Motor sem atividade registrada', ago: '' });
add({ case: 'many failures (+N)', owner: 'Shopping Alfa', profile: 'Perfil Antigo', name: '3F ALFA-TUDOERRADO', label: 'Tudo errado', gcdrDeviceId: '', centralId: '', active: 'false', ago: 200 });
add({ case: 'label empty → name only', owner: 'Shopping Alfa', profile: '3F_MEDIDOR', name: '3F ALFA-SEMLABEL', label: '' });
add({ case: 'label equals name → no parentheses', owner: 'Shopping Alfa', profile: '3F_MEDIDOR', name: 'Loja Igual', label: 'Loja Igual' });
add({ case: 'CSV injection in label/name', owner: 'Shopping Alfa', profile: '3F_MEDIDOR', name: '=SUM(A1:A9)', label: '+55 Loja Fórmula' });
add({ case: 'accents for search (climatizacao)', owner: 'Shopping Alfa', profile: 'FANCOIL', name: '3F ALFA-CLIMA', label: 'Climatização Praça Central' });
add({ case: 'very long label', owner: 'Shopping Alfa', profile: '3F_MEDIDOR', name: '3F ALFA-LONGO', label: 'Loja com um nome comercial muito comprido que precisa de reticências na lista do inventário' });
add({ case: 'legacy hint: _ARQUIVADO_ profile', owner: 'Shopping Alfa', profile: '3F_MEDIDOR_ARQUIVADO_OFFLINE', name: '3F ALFA-ARQLEGADO', label: 'Arquivado pelo perfil', active: 'false', ago: 600 });
add({ case: 'lifecycle stock', owner: 'Shopping Alfa', profile: '3F_MEDIDOR', name: '3F ALFA-ESTOQUE', label: 'Em estoque', lifecycle: 'stock', ago: '' });

// --- Shopping Beta: mostly healthy, GCDR rollout incomplete ---
for (let i = 1; i <= 20; i++) {
  add({ case: i % 4 === 0 ? 'C4 GCDR rollout pending' : 'healthy', owner: 'Shopping Beta', profile: i % 3 ? '3F_MEDIDOR' : 'HIDROMETRO', name: `3F BETA${String(i).padStart(3, '0')}`, label: `Beta Loja ${i}`, centralId: 'central-beta-1', gcdrDeviceId: i % 4 === 0 ? '' : undefined });
}

// --- Not integrated customer: no MYIO attributes → C2–C5/C7/C8 notApplicable ---
for (let i = 1; i <= 10; i++) {
  add({ case: 'not integrated (n/a)', owner: 'Loja Sem Integração', profile: '', type: 'Obra - Chaves', name: `CHAVE ${i}`, label: `Chave seletora ${i}`, ingestionId: '', gcdrDeviceId: '', centralId: '', slaveId: '', active: i % 3 ? 'true' : 'false', ago: i % 3 ? 1 : 30 });
}

// --- Legacy customer name hint ---
for (let i = 1; i <= 3; i++) {
  add({ case: 'legacy hint: DESATIVAR customer', owner: 'Cliente Antigo DESATIVAR', profile: '3F_MEDIDOR', name: `3F ANTIGO${i}`, label: `Antigo ${i}`, centralId: 'central-antiga', active: 'false', ago: 2000 });
}

// --- Tenant-owned (no customer) ---
add({ case: 'C1 no customer', owner: null, profile: '3F_MEDIDOR', name: '3F SEMCLIENTE1', label: 'Sem cliente 1', ingestionId: '', gcdrDeviceId: '', centralId: '', ago: '' });
add({ case: 'C1 no customer', owner: null, profile: '', name: 'Device novo', label: '', ingestionId: '', gcdrDeviceId: '', centralId: '', active: 'false', ago: '' });
add({ case: 'tenant-owned stock (excluded)', owner: null, profile: '3F_MEDIDOR', name: '3F ESTOQUE-CENTRAL', label: 'Estoque da fábrica', lifecycle: 'stock', ingestionId: '', gcdrDeviceId: '', centralId: '', ago: '' });

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  JSON.stringify(
    {
      _comment: 'Synthetic inventory fixtures (RFC-0237). Values are strings as TB returns them; AGO:<h> is rebased to now - h hours by the showcase.',
      customers,
      devices,
    },
    null,
    1
  ) + '\n'
);
console.log('devices', devices.length, 'customers', customers.length, '->', out);
