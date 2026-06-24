temos que criar um novo componente

para exportado no index

com o objetivo de substituir esse trecho aqui de forma totalmente componentizada e tudo injetado

@/src\MYIO-SIM\v5.2.0\ENERGY\template.html

```
<!-- Charts -->
  <div class="charts">
    <!-- RFC-0098: Container for createConsumptionChartWidget (widget injects its own HTML) -->
    <div id="energy-chart-widget" class="chart-box chart-box-energy"></div>

    <div class="chart-box">
      <div class="chart-header">
        <h4>Distribuição de Energia</h4>
        <div class="chart-controls">
          <label for="distributionMode" class="control-label">Visualizar:</label>
          <select id="distributionMode" class="chart-select">
            <option value="groups">Por Grupos de Equipamentos</option>
            <option value="elevators">Elevadores por Shopping</option>
            <option value="escalators">Escadas Rolantes por Shopping</option>
            <option value="hvac">Climatização por Shopping</option>
            <option value="others">Outros Equipamentos por Shopping</option>
            <option value="stores">Lojas por Shopping</option>
          </select>
        </div>
      </div>
      <canvas id="pieChart"></canvas>
    </div>
  </div>
```

se baseie em src\components\Consumption7DaysChart\createConsumptionChartWidget.ts

uma coisa importante

precisamos garantir mesma cor para os shoppings nesse widget e precisa casar com as cores em outras lugares como em
src\MYIO-SIM\v5.2.0\ENERGY\controller.js e src\MYIO-SIM\v5.2.0\WATER\controller.js

talvez faça sentido na MAIN

nesse trecho

@/src\MYIO-SIM\v5.2.0\MAIN\controller.js

```
function extractTemperatureRanges()
```

já fazer uma configuração de COLOR para cada Customer
