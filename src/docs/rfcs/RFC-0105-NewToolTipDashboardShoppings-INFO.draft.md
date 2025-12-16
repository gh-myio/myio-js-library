faça um estudo em
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY_INFO

no header temos o título

@/src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY_INFO\template.html

```
    <h2 class="info-title" id="infoTitleHeader">ℹ️ Informações de Energia</h2>

```

ali temos que ter ao lado direito do infoTitleHeader um tooltip premium muito inspierado em  
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\utils\EnergyRangeTooltip.ts

a ideia é mostrar um grande resumo geral, totalmente sincronizado com
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY\controller.js
e
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MAIN_VIEW\controller.js

mostrando total de devices de energia,
um quadro de total de devices por tipo (entrada, área comum (aqui pode mostrar uma espécie de árvore para cada categoria como elevador, escada rolante, chiller, fancoil, bomba e etc) e lojas)

e embaixo ou encima ou do lado, enfim mostrar o total de consumo do grupo e ir mostrando a soma consolidada

mostrar quantos device estão sem consumo, quantos offline, quantos em alerta, normal, falha

afinal vamos validar tudo nos showscases com mocks
em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\showcase
