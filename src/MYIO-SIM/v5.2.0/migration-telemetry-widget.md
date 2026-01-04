# Migração: TELEMETRY widget → TelemetryGrid Component (RFC-0121)

Referência principal: `src/docs/rfcs/RFC-0121-TelemetryGridComponent.md`  
Showcase: `showcase/telemetry-grid/index.html`

## 1) Template (MAIN_UNIQUE_DATASOURCE)

Arquivo: `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/template.html`

Remover o bloco do ThingsBoard (`tb-dashboard-state`) e substituir por um container DOM igual ao padrão do Header/Menu:

```html
<!-- RFC-0121: TelemetryGrid (rendered via createTelemetryGridComponent) -->
<section
  id="telemetryGridContainer"
  class="myio-main-view-section"
  style="flex: 1; overflow: auto"
></section>
```

## 2) Controller (MAIN_UNIQUE_DATASOURCE)

Arquivo: `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`

Criar a instância via `MyIOLibrary.createTelemetryGridComponent({ ... })`, assim como já fazemos para:
- `createHeaderComponent` (RFC-0113)
- `createMenuComponent` (RFC-0114)
- `createFooterComponent` (RFC-0115)

Pontos de integração recomendados (ver RFC e showcase):
- `onContextChange` do Menu chama `telemetryGridInstance.updateConfig(domain, context)` + `updateDevices(...)`
- `myio:filter-applied` chama `telemetryGridInstance.applyFilter([...shoppingIds])`
- `myio:theme-change` chama `telemetryGridInstance.setThemeMode(themeMode)`
