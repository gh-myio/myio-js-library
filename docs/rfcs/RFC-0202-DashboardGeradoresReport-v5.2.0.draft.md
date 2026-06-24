bem por ora faça o seguinte
crie um widget personalizado
que vai montar um MAPA com 4 colunas definido assim
no datasource irá ter um ASSET com os Geradores na seguinte forma

um HEADER premium
com o seletor da Unidade
temos 3 opções
CER
Maternindade
Souza Aguiar

depois um logo da MYIO depois um espaço para um Title assim por exemplo
Hospital Municipal Souza Aguiar - HMSA
Telemetria de Geradores
Relatório emitido em: 04/05/2026
e um datepicker padrào da LIB MYIO inspirada em
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\smart-hospital\Tabela_Temp_V5\prod
veja o template.html, styles.css, controller.js

a ideia é que vamos ter um datasource principal apontando para um Asset chamado
GeradoresSouzaAguiarAsset
|- GeradoresSouzaAguiar-CER-Asset
|---- GeradoresSouzaAguiar-CER-QTA1-Asset
|------- Device: Gerador xxxx
|------- Device: Rede xxxx
|- GeradoresSouzaAguiar-Maternindade-Asset
|---- GeradoresSouzaAguiar-Maternindade-QTA1-Asset
|------- Device: Gerador xxxx
|------- Device: Rede xxxx
|---- GeradoresSouzaAguiar-Maternindade-QTA2-Asset
|------- Device: Gerador xxxx
|------- Device: Rede xxxx
|- GeradoresSouzaAguiar-SouzaAguiar-Asset
|---- GeradoresSouzaAguiar-SouzaAguiar-QTA1-Asset
|------- Device: Gerador xxxx
|------- Device: Rede xxxx
|---- GeradoresSouzaAguiar-SouzaAguiar-QTA2-Asset
|------- Device: Gerador xxxx
|------- Device: Rede xxxx
|---- GeradoresSouzaAguiar-SouzaAguiar-QTA3-Asset
|------- Device: Gerador xxxx
|------- Device: Rede xxxx
|---- GeradoresSouzaAguiar-SouzaAguiar-QTA4-Asset
|------- Device: Gerador xxxx
|------- Device: Rede xxxx

algo nessa linha será a a estrutura do asset a ser recuperado no ctx.data / ctx.datasource

aí iremos renderizar uma GRID com 4 colunas
1 - Mostrando ícone de um GErador com Label Ligado / Desligado + Status (OK ou OFFLINE)
veja esse widget para usarmos o mesmo padrão daqui
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\WIDGET\Generator

2 - uma tabela para Histórico de Partida do Gerador
onde teremos a coluna
Data e Hora | Tempo de Partida | Ações
Data e hora mostra no formato 2026-04-15 07:08:20
Tempo de Partida sempre será em Milic no ctx.data[] mas podemos formatar para quando por possível em hora (2hs 35mins 21segs), se for menos de uma hora para mins (3mins 57segs) ou para segundos 45 segs

o botão de ações será visível apenas para MYIO
veja em
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\bas-components\MAIN_BAS\controller.js
e também em
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\smart-hospital\Tabela_Temp_V5\prod

como gerir se o user logado é @myio.com.br

Essas ações serão para Editar o timeseries ou deletar o registro do timeseries

veja em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\WIDGET\GCDR-Upsell-Setup\v.1.0.0\controller.js
ou outros exemplos

@/src\components\premium-modals\upsell\openUpsellModal.ts

```
            `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${telemetryKeys}`

```

como pegar as telemetrias

@/src\components\premium-modals\upsell\openUpsellModal.ts

```
            `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${telemetryKeys}`

```

no caso aqui as telemetrias serão startupTime e status
3 - uma tabela para Histórico de Falha da Rede
Analogamenteo do item 2

4 - um label  
Média TP

mostrando a média de startupTime dos valores que estão em exibição

Ah no footer ter deve ter um botão para exportar PDF / XLSX e CSV

e seria bom tudo isso ser maximizável e também responsivo para celular

se inspire em

C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\smart-hospital\Tabela_Temp_V5\prod
