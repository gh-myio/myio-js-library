# Mapeamento de Deploy: Shopping Dashboard v5.2.0 -> ThingsBoard

## Paths

| DE (Source) | PARA (Destination) |
|-------------|-------------------|
| `myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\` | `thingsboard_repo.git\widget_type\` |

---

## Widgets Shopping Dashboard v5.2.0

| # | Fonte (WIDGET/) | Destino (widget_type/) |
|---|-----------------|------------------------|
| 1 | `MAIN_VIEW\` | `widget_shopping_dashboard_main_view_v_5_2_0\` |
| 2 | `HEADER\` | `widget_shopping_dashboard_header_v_5_2_0\` |
| 3 | `MENU\` | `widget_shopping_dashboard_menu_v_5_2_0\` |
| 4 | `TELEMETRY\` | `widget_shopping_dashboard_telemetry_v_5_2_0\` |
| 5 | `TELEMETRY_INFO\` | `widget_shopping_dashboard_info_v_5_2_0\` |
| 6 | `FOOTER\` | `widget_shopping_dashboard_footer_v_5_2_0\` |

---

## Arquivos por Widget

Cada pasta contém tipicamente:

```
controller.js    -> actionSources.js (ou direto)
template.html    -> resources.html
settings.schema  -> settingsSchema.json
style.css        -> (incluido no resources.html)
```

---

## Exemplo de Deploy Completo

```
DE:
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MAIN_VIEW\controller.js

PARA:
C:\Projetos\GitHub\myio\thingsboard_repo.git\widget_type\widget_shopping_dashboard_main_view_v_5_2_0\actionSources.js
```

---

## Notas

- **Versao:** v-5.2.0 -> v_5_2_0 (underscores)
- **Case:** Pasta uppercase (MAIN_VIEW) -> lowercase (main_view)
- **Prefixo:** Todos widgets tem prefixo `widget_shopping_dashboard_`
- **TELEMETRY_INFO:** Mapeado para `info` (sem telemetry_)

---

*Gerado em: 2025-12-11*
