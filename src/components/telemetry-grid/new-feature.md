bugfix para resolver em src\components\telemetry-grid
1 - todos os cards energy equipments estão carregando por default checked
2 - ao selecionar o card ou mover para o footer não funciona
veja como era antes em
src\thingsboard\main-dashboard-shopping\v-5.2.0\card\template-card-v5.js
src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MAIN_VIEW\controller.js
src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY\controller.js
para selecionar tem que ver MyIOSelectionStore e
@/src\thingsboard\main-dashboard-shopping\v-5.2.0\card\template-card-v5.js

```
  // Handle drag and drop
  if (enableDragDrop) {
```

para arrastar para o footer
