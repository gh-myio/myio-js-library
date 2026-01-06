na modal welcome

1. após selecionar um shoppings apenas
   @/src\components\menu\MenuView.ts

```
            <button class="myio-menu-filter-apply-btn" id="menuFilterApplyBtn">Aplicar filtro</button>

```

ao clicar aqui após selecionar um shopping e nada aconteceu

e em telemetry-grid componente mostrou

Nenhum dispositivo encontrado
Nao ha dispositivos energy para exibir no momento.

---

e também

@/src\components\menu\MenuView.ts

```
            <button class="myio-menu-filter-apply-btn" id="menuFilterApplyBtn">Aplicar filtro</button>

```

ao clicar aqui após selecionar um shopping e nada aconteceu

na modal welcome componente
src\components\premium-modals\welcome\WelcomeModalView.ts
os tooltips estão com erros
exemplo: mestre álvaro > energy

⚙️ Equipamentos - 69 - 0,00 kWh mostra zero e não desdobra por
🏪 Lojas - 196 - 0,00 kWh mostra zero

e no footer da tooltip mostra

Consumo Total 17.913,17 MWh

deveria ser assim

📥 Entrada 0,000 kWh
🏪 Lojas 14,701 MWh (73.5%)
❄️ Climatização 2,254 MWh (11.3%)
🛗 Elevadores 176,298 kWh (0.9%)
🎢 Esc. Rolantes 1,218 MWh (6.1%)
⚙️ Outros Equipamentos 1,644 MWh (8.2%)
🏢 Área Comum 5,293 MWh (26.5%)
📊 Total Consumidores 19,994 MWh (100%)

veja em
src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY_INFO

@/src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY_INFO\template.html

```
<div class="info-card
```

veja aqui também

@/.claude\CLAUDE.md

```
### 7. Energy Equipment Subcategorization (RFC-0128)

```

pois no componente header src\components\header\

também está errado , exemplo real

−
⚙️ Mestre Álvaro - 265 - 17.913,16 MWh
• Equipamentos - 69 - 796,86 MWh
🏪 Lojas - 196 - 17.116,30 MWh

e como vimos o certo seria acima

📥 Entrada 0,000 kWh
🏪 Lojas 14,701 MWh (73.5%)
❄️ Climatização 2,254 MWh (11.3%)
🛗 Elevadores 176,298 kWh (0.9%)
🎢 Esc. Rolantes 1,218 MWh (6.1%)
⚙️ Outros Equipamentos 1,644 MWh (8.2%)
🏢 Área Comum 5,293 MWh (26.5%)
📊 Total Consumidores 19,994 MWh (100%)
