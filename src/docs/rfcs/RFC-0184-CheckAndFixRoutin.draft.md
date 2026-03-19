Crie um novo RFC-0183 em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\docs\rfcs
em markdown md file em ingles no formato rust rfc para

termo um novo botão no step 2 que seria CHECK & FIX

esse botão faria o seguinte
iria buscar todos os devices da central e fazer as seguintes verificações

primeira coisa é garantir que todos os devices tenha o deviceType e deviceProfile preenchidos
digo especialmente os attributes em server_scope de cada devices rodando a seguinte regra

---

function handleDeviceType(name) { // também para deviceProfile
const upper = (name || '').toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

// ENERGY
if (upper.includes('COMPRESSOR')) return 'COMPRESSOR';
if (upper.includes('VENT')) return 'VENTILADOR';
if (upper.includes('ESRL')) return 'ESCADA_ROLANTE';
if (upper.includes('ELEV')) return 'ELEVADOR';
if (upper.includes('MOTR') || upper.includes('MOTOR') || upper.includes('RECALQUE')) return 'MOTOR';
if (upper.includes('RELOGIO') || upper.includes('RELOG') || upper.includes('REL ')) return 'RELOGIO';
if (upper.includes('ENTRADA') || upper.includes('SUBESTACAO') || upper.includes('SUBESTACAO') || upper.includes('SUBEST')) return 'ENTRADA';
if (upper.includes('3F')) return '3F_MEDIDOR';

// WATER
if (upper.includes('HIDR')) return 'HIDROMETRO';

// Corrige para casar com o typeMap: CAIXA_DAGUA
if (upper.includes('CAIXA DAGUA') || upper.includes('CX DAGUA') || upper.includes('CXDAGUA') || upper.includes('SCD'))
return 'CAIXA_DAGUA';

// Novo (presentes no typeMap como water)
if (upper.includes('TANK') || upper.includes('TANQUE') || upper.includes('RESERVATORIO')) return 'TANK';

// Extras (não mapeados no typeMap, mas mantidos)
if (upper.includes('AUTOMATICO')) return 'SELETOR_AUTO_MANUAL';
if (upper.includes('TERMOSTATO') || upper.includes('TERMO') || upper.includes('TEMP')) return 'TERMOSTATO';
if (upper.includes('ABRE')) return 'SOLENOIDE';
if (upper.includes('AUTOMACAO') || upper.includes('GW_AUTO')) return 'GLOBAL_AUTOMACAO';
if (upper.includes(' AC ') || upper.endsWith(' AC')) return 'CONTROLE REMOTO';

return 'UNDEFINED';
}

essa function é para termos tanto deviceType e deviceProfile de cada device

obs: o device tem um campo também type (meio redundante mas relevante), esse type em teoria deveria estar igual ao deviceProfile

mas isso primeiro seria um mapa ALVO, ou seja, como deveria estar

---

depois vamos mapear o que está em PRODUÇão, OU SEJA, pegando os dados reais, ver como está a situação real....

mapear todos os devices em domain and groups
1 - domain energy: todos os devices que tem deviceType IN
COMPRESSOR, VENTILADOR, ESCADA_ROLANTE, ELEVADOR, MOTOR, RELOGIO, ENTRADA, 3F_MEDIDOR
2 - domain water: todos os devices que tem deviceType IN
HIDROMETRO, CAIXA_DAGUA, TANK
3 - domain temperature: todos os devices que tem deviceType IN
TERMOSTATO, TERMOSTATO_EXTERNAL
4 - domain remote: todos os devices que tem deviceType IN
SOLENOIDE, GLOBAL_AUTOMACAO, CONTROLE_REMOTO, SELETOR_AUTO_MANUAL

---

agora o mapa de grupos
1.1 - domain energy > group "energy_entry" : todos os devices que já estão em domain energy e tem deviceProfile IN
ENTRADA, SUBESTACAO, RELOGIO, TRAFO

1.2 - domain energy > group "energy_common_area" : todos os devices que já estão em domain energy e tem deviceProfile IN
CHILLER, FANCOIL, BOMBA, BOMBA_HIDRAULICA, BOMBA_PRIMARIA, BOMBA_PRIMARIA, BOMBA_CAG, AR_CONDICIONADO, HVAC, COMPRESSOR, VENTILADOR, BOMBA_INCENDIO, MOTOR, ESCADA_ROLANTE, ELEVADOR

1.3 - domain energy > group "energy_store" : todos os devices que já estão em domain energy e tem deviceProfile = 3F_MEDIDOR

---

2.1 - domain water > group "water_entry" : todos os devices que já estão em domain water e tem deviceProfile IN
HIDROMETRO_SHOPPING, HIDROMETRO_ENTRADA

2.2 - domain water > group "water_common_area" : todos os devices que já estão em domain water e tem deviceProfile IN
HIDROMETRO_AREA_COMUM, TANK, CAIXA_DAGUA

2.3 - domain water > group "water_store" : todos os devices que já estão em domain water e tem deviceProfile = HIDROMETRO

---

3.1 - domain temperature > group "temperature_internal" : todos os devices que já estão em domain water e tem deviceProfile = TERMOSTATO

3.2 - domain temperature > group "temperature_external" : todos os devices que já estão em domain water e tem deviceProfile = TERMOSTATO_EXTERNAL

---

4.1 - domain remote > group "solenoid" : todos os devices que já estão em domain water e tem deviceProfile = SOLENOIDE

4.2 - domain remote > group "automation_status" : todos os devices que já estão em domain water e tem deviceProfile = GLOBAL_AUTOMACAO

4.3 - domain remote > group "lighting" : todos os devices que já estão em domain water e tem deviceProfile IN
ILUMINACAO, LAMP, LAMPADA

4.4 - domain remote > group "remote_controle" : todos os devices que já estão em domain water e tem deviceProfile IN
REMOTE, CONTROLE_REMOTO, SELETOR_AUTO_MANUAL

---

isso tudo acima em teoria parte da premissa que está tudo configurado,

a ideia final desse botão novo "CHECK & FIX"

e buscar todos os devices e fazer um raio x para ver se está tudo certo
