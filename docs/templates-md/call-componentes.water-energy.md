agora na nova main

src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE

quando no menu clicarmos no menu component (src\components\menu)
em Geral (Energia)

onde estava renderizado o componentee telemetry-grid

@/src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\template.html

```
  <!-- RFC-0121: TelemetryGrid (rendered via createTelemetryGridComponent) -->
  <section
    id="telemetryGridContainer"
    class="myio-main-view-section"
    style="flex: 1; overflow: auto"
  ></section>
```

deve renderizar o componente novo src\components\energy-panel

analogamente se clicarmos em Agua > Resumo, renderizar src\components\water-panel
