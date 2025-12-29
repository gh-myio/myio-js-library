aqui C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\WIDGET\Pre-Setup-Constructor\v.1.0.9\controller.js

precisamos de um botão novo para UPSell

será um botão para abrir uma modal para buscar
device de um customer

essa modal deve ser vários steps

1 - escolher o customer (lista de customers com lupa de busca)
2 - escolher o device (lista de devices com lupa de busca e filtro por deviceTipe e deviceProfile)
3 - escolhido device mostra um mapa de adequação do device:
3.1 - ao mapa de attributes server_scope
temos que mostrar os atributos (se existirem),
3.1.1 - centralId - deve vir já preenchido enviado via nodered
3.1.2 - slaveId - deve vir já preenchido enviado via nodered
3.1.3 - centralName - deve vir já preenchido enviado via nodered ou criado no pre-setup ou criado no ingestion sync - se estiver nulo apresenta um warning e sugere "Central <customer name> PADRÃO"
3.1.4 - deviceType - deve vir já preenchido enviado via nodered se estiver nulo apresenta um warning e sugere uma select list assim

function handleDeviceType(name) {
const upper = (name || '').toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

// ENERGY
if (upper.includes('COMPRESSOR')) return 'COMPRESSOR';
if (upper.includes('VENT')) return 'VENTILADOR';
if (upper.includes('ESRL')) return 'ESCADA_ROLANTE';
if (upper.includes('ELEV')) return 'ELEVADOR';
if (
( upper.includes('MOTR') && !upper.includes('CHILLER') )
|| upper.includes('MOTOR')
|| upper.includes('RECALQUE')
) return 'MOTOR';

if (upper.includes('RELOGIO') || upper.includes('RELOG') || upper.includes('REL ')) return 'RELOGIO';
if (upper.includes('ENTRADA') || upper.includes('SUBESTACAO') || upper.includes('SUBESTACAO') || upper.includes('SUBEST')) return 'ENTRADA';

if (upper.includes('3F')) {
if (upper.includes('CHILLER')) {
return 'CHILLER';
} else if (upper.includes('FANCOIL')) {
return 'FANCOIL';
} else if (upper.includes('TRAFO')) {
return 'ENTRADA';
} else if (upper.includes('ENTRADA')) {
return 'ENTRADA';
} else if (upper.includes('CAG')) {
return 'BOMBA_CAG';
} else {
return '3F_MEDIDOR';
}
}

// WATER
if (upper.includes('HIDR') || upper.includes('BANHEIRO')) return 'HIDROMETRO';

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

return '3F_MEDIDOR';
}

inclusive essa função handleDeviceType deve ser uma função exposta em src\index.ts

3.1.5 - deviceProfile - deve vir já preenchido preenchido no ingestionSync e se estiver nulo apresenta um warning e sugere
se deviceType = 3F_MEDIDOR > deviceProfile só pode ser 3F_MEDIDOR(quando deviceType = deviceProfifle = 3F_MEDIDOR de fato é loja), CHILLER, TRAFO, ENTRADA, FANCOIL, BOMBA_CAG, BOMBA_INCENDIO, BOMBA_HIDRAULICA, ELEVADOR, ESCADA_ROLANTE
se deviceType = HIDROMETRO > deviceProfile só pode ser HIDROMETRO(quando deviceType = deviceProfifle = HIDROMETRO de fato é loja), HIDROMETRO, HIDROMETRO_AREA_COMUM, HIDROMETRO_SHOPPING
em outros casos, sugerir repetir o deviceType em deviceProfile

3.1.6 - identifier - deve vir já preenchido enviado via ingestionSync e se estiver nulo apresenta um warning e sugere escrever o LUC da loja ou ESCADASROLANTES, ELEVADORES, CAG, ENTRADA

3.1.7 - ingestionId - deve vir já preenchido enviado vvia ingestionSync e se estiver nulo apresenta um warning e sugere buscar no ingestion,

veja como faz o match

@/src\thingsboard\WIDGET\Pre-Setup-Constructor\v.1.0.9\controller.js

```
      const { rec, reason } = matchIngestionRecord(d, index); // strict centralId#slaveId lookup (agora com d.attributes.centralId populado)

```

vai no ingestion pega os devices do customer, e faz o match pelo slaveid e centralid. (ambos devem estar previamente preenchido), tem que ter um cache dos devices do ingestion, para nào ter que ir no ingestion toda hora, pois essa modal pode ser feita para um device e depois para outro device e etc.

3.2 - relation to
relation/to - veja em src\thingsboard\WIDGET\Pre-Setup-Constructor\v.1.0.9\KNOWLEDGE.md como buscar a relação TO do primeiro nível
em geral ou o device vai estar com relação a um ASSET de nível acima do device e necessariamente esse ASSET precisa estar abaixo do customer seja diretamente ou por outros níves de ASSET ou o device tem que estar minimanente com relação direta ao CUSTOMER, sem outroa relação, só deve existir uma relação TO (Caso não tenha mostra um warning)
3.3 - owner do device

- precisa ser necessariamente o Customer selecionado (Caso não seja mostra um warning)

essa modal deve ser toda injetada

deve receber o token do thingsboard
const tokenThingsboard = localStorage.getItem('jwt_token');

usando para relation/to , attributes server scope, buscar customers, devices, e salvar os attributes server_scope e salvar relation

via parametro

e as credenciais
do ingestion

const AUTH_URL = 'https://api.data.apps.myio-bas.com/api/v1/auth';

// ⚠️ Substitua pelos seus valores:
//const CLIENT_ID = "ADMIN_DASHBOARD_CLIENT";
//const CLIENT_SECRET = "admin_dashboard_secret_2025";

const CLIENT_ID = 'myioadmi_mekj7xw7_sccibe';
const CLIENT_SECRET = 'KmXhNZu0uydeWZ8scAi43h7P2pntGoWkdzNVMSjbVj3slEsZ5hGVXyayshgJAoqA';

também via parametro ou já mandar o token já autenticado em si, talvez melhor assim para manter o padrão igual tokenThingsboard
