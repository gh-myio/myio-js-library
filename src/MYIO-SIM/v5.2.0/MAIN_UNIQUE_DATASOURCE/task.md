temos una série de fix para fazermos

1. metas não está abrindo
   No menu component
   C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\menu
   o botão de metas não funciona, veja como era no widget antigo
   C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\v5.2.0\MENU
   e também no showcase
   C:\Projetos\GitHub\myio\myio-js-library-PROD.git\showcase\menu-component.html
   em MyIOLibrary.openGoalsPanel

2. filtro de shoppings
   ao abrir a modal de filtros de shoppings e selecionar pelo menos um, devemos atualizar os totalizados em
   header component C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\header

aproveite e busque se header desse path

C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\premium-modals\header

é usado ou exposto em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\index.ts

devemos manter apenas C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\header e remover 100% o path C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\header

além disso temos que filtar todos os devices em telemetrygrid component

@/src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js

```
telemetryGridInstance = MyIOLibrary.createTelemetryGridComponent({

```

3. alinhamento da barra onde tem total de equipamentos

exemplo: está mostrando
em telemetry-grid o header onde temos
Conectividade,
Total de Equipamentos,
Consumo Total Total de Equipamentos (deveria ser > Consumo Total de Equipamentos)
Consumo Zero (>deveria ser sem consumo)

4. ao selecionar os cards pelos click não aparece valor do consumo de energia
   ao selecionar um card em telemetry-grid
   vai para o footer ok.
   em src\components\footer

mas está indo o label mas não o consumo em kwh por exemplo e mostrando o total ou o total de water ou a média se for temeprature

e não está abrindo o comparativo (lembrando que se trocarmos de menu, exemplo estamos em Energia > Equipamentos e vamos para Água > Área Comum, temos que zerar o total no footer e remover os itens, isso se existir)

5. não abre o comparativo no footer component

6. não abre settings, nem relatório, nem Dashboard dos cards em telemetry-grid
   veja handleActionDashboard, handleActionReport e/ou handleActionSettings

veja no widget antigo
src\MYIO-SIM\v5.2.0\TELEMETRY\controller.js e/ou também em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\v5.2.0\MAIN

7. o filtro de data mudando período ao cicar em consultar não faz nada, deveria chamar a api do ingestion isso no menu component

8. não está funcionando nada em água e temperatura no menu component
