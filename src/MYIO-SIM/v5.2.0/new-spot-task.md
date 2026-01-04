crie em plan mode com muito cuidado ainda em relação a C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\docs\rfcs\RFC-0121-TelemetryGridComponent.md\

tanto

@/src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js

```
  const buildHeaderDevicesGrid = (config) => {

```

e também createFilterModal

poderiam ficar de alguma maneira dentro do componente TELEMETRY
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\telemetry-grid

mas de alguma maneira ou através via consulta de state com somado a listeners de customevent

os dados serem atualizados pela main
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js

e avisado ao telemetry

e com isso removermos o máximo de código de src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js

talvez criarmos um novo componente
de HeaderDevicesGrid e outro
FilterModal
