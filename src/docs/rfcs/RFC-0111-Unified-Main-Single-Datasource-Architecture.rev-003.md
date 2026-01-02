revisando seu plano ajuste os pontos

---

1. Only 2 widgets: MAIN and TELEMETRY > fix ... from MAIN to MAIN_UNIQUE_DATASOURCE

---

NÃO MEXA EM src/MYIO-SIM/v5.2.0/MAIN/
crie novo src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE

Atenção: não mexer em

MENU/controller.js
MAIN/controller.js

isso é contexto antigo.

---

Files to Modify

| File                    | Change                                                        |
| ----------------------- | ------------------------------------------------------------- |
| TELEMETRY/controller.js | Add config change listener, update context names              |
| MENU/controller.js      | Add STATE_TO_CONFIG, dispatch functions, panel modal requests |

não é para modificar MENU/controller.js, isso é contexto antigo., Atenção não mexa

---

3.  Update MENU with STATE_TO_CONFIG and dispatch functions ????
    não é para modificar MENU/controller.js, isso é contexto antigo., Atenção não mexa
