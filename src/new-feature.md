por algum motivo em water\
 \
 src\MYIO-SIM\v5.2.0\dashboard.myio-bas.com-1767732616220-CLEAN.log\
 \
 ao inves de fazer requisição api/v1/telemetry/customers/ usando o customerIngestionId

correto e na main temos ele
@/src\MYIO-SIM\v5.2.0\MAIN\controller.js

```
        let CUSTOMER_ING_ID = '';

```

bataria usar getCredentials de MyIOOrchestrator

foi usando um id aleatório de um outro customer de device mas customer filho do CUSTOMER_ING_ID que temos em MyIOOrchestrator

e além disso o gráfico
@/src\MYIO-SIM\v5.2.0\WATER\template.html

```
    <div id="water-distribution-widget" class="chart-box chart-box-water"></div>

```

que deveria pegar dados da main igual energy não renderizou nada

veja que o haeder src\MYIO-SIM\v5.2.0\HEADER\controller.js já pegar dados de water da main src\MYIO-SIM\v5.2.0\MAIN\controller.js
para montar a tooltip

@/src\MYIO-SIM\v5.2.0\HEADER\template.html

```
          <span class="water-info-trigger" id="water-info-trigger">ℹ️</span>

```

veja o log
src\MYIO-SIM\v5.2.0\dashboard.myio-bas.com-1767732616220-CLEAN.log
