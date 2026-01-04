crie um markdowm md file em ingles
no estilo rust rfc

em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\docs\rfcs

eses RFC-0121

vai tratar da migração do widget

C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\v5.2.0\TELEMETRY

para se tornar um componente exportado em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\index.ts

a MAIN nova

src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js

nessa seção

@/src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\template.html

```
  <!-- Main Content: TELEMETRY widget via tb-dashboard-state -->
  <section id="mainViewContainer" class="myio-main-view-section" style="flex: 1; overflow: auto">
    <tb-dashboard-state class="content" [ctx]="ctx" stateId="telemetry"></tb-dashboard-state>
  </section>

```

ao invés de termos um widget, vai chamar o componente e ele vai ser todo injetado montando toda a estrutura de TELEMETRY atual,

ou seja, vai montar o

@/src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js

```
  buildHeaderDevicesGrid, createFilterModal

  vai ser montado nesse componente, pois não teremos mais o widget telemetry para a main

```

e analise o md
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\docs\rfcs\RFC-0111-Unified-Main-Single-Datasource-Architecture.md
e
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\docs\rfcs\RFC-0111-Unified-Main-Single-Datasource-Architecture-IMPLEMENTATION-DETAILED.md

para sabermos e mapeamos o impacto na main e teremos que também ajustar a main para esse novo componente TELEMETRY ao invés de widget em si

ou seja

o const cardInstance = MyIOLibrary.renderCardComponentHeadOffice agora será feito dentro do componente

mas atenção

temos um ponto relevante e muito imporante a ser mapeado

o componente MENU
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\menu

ele tem uma modal de lista de shoppings, que por default mostra todos, se mudarmos,
MENU Componente tem que enviar um evento para

MAIN
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js

avisando quem mudou o filtro de customers e main tem que sincronizar rapidamente e atualizar

os cards no componente novo TELEMETRY

Bem como atualizar os totalizadores em header componente e também sempre mostrar o valor relativo total x customers selecioandos

tudo orquestrado pela main, para isso também confira em
src\MYIO-SIM\v5.2.0\MENU\controller.js
src\MYIO-SIM\v5.2.0\MAIN\controller.js
src\MYIO-SIM\v5.2.0\EQUIPMENTS\controller.js

como que era esses custom eventos do menu para atualização e etc
