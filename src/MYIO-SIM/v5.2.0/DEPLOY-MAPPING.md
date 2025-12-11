# Mapeamento de Deploy: v5.2.0 -> ThingsBoard

## Paths

| DE (Source) | PARA (Destination) |
|-------------|-------------------|
| `myio-js-library-PROD.git\src\MYIO-SIM\v5.2.0\` | `thingsboard_repo.git\widget_type\` |

---

## Widgets Head Office v5.2.0

| # | Fonte (MYIO-SIM/v5.2.0/) | Destino (widget_type/) |
|---|--------------------------|------------------------|
| 1 | `MAIN\` | `widget_head_office_main_v_5_2_0\` |
| 2 | `HEADER\` | `widget_head_office_header_v_5_2_0\` |
| 3 | `MENU\` | `widget_head_office_menu_v_5_2_0\` |
| 4 | `FOOTER\` | `widget_head_office_footer_v_5_2_0\` |
| 5 | `EQUIPMENTS\` | `widget_head_office_equipments_v_5_2_0\` |
| 6 | `STORES\` | `widget_head_office_stores_v_5_2_0\` |
| 7 | `ENERGY\` | `widget_head_office_energy_v_5_2_0\` |
| 8 | `WATER\` | `widget_head_office_water_v_5_2_0\` |
| 9 | `WATER_COMMON_AREA\` | `widget_head_office_water_common_area_v_5_2_0\` |
| 10 | `WATER_STORES\` | `widget_head_office_water_stores_v_5_2_0\` |
| 11 | `TEMPERATURE\` | `widget_head_office_temperature_v_5_2_0\` |
| 12 | `TEMPERATURE_SENSORS\` | `widget_head_office_temperature_sensors_v_5_2_0\` |
| 13 | `TEMPERATURE_WITHOUT_CLIMATE_CONTROL\` | `widget_head_office_temperature_without_climate_control_v_5_2_0\` |
| 14 | `WELCOME\` | `widget_head_office_welcome_v_5_2_0\` |

---

## Arquivos por Widget

Cada pasta contém tipicamente:

```
controller.js    -> actionSources.js (ou direto)
template.html    -> resources.html
settings.json    -> settingsSchema.json
```

---

## Exemplo de Deploy Completo

```
DE:
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\v5.2.0\EQUIPMENTS\controller.js

PARA:
C:\Projetos\GitHub\myio\thingsboard_repo.git\widget_type\widget_head_office_equipments_v_5_2_0\actionSources.js
```

---

## Notas

- **Versao:** v5.2.0 -> v_5_2_0 (underscores)
- **Case:** Pasta uppercase (EQUIPMENTS) -> lowercase (equipments)
- **Prefixo:** Todos widgets tem prefixo `widget_head_office_`

---

*Gerado em: 2025-12-11*
