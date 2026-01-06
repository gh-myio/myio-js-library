em cada card em telemetry-grid
src\components\telemetry-grid\

a grid de devices no filter

está estranha exemplo

Bomba CAG 05 / Rio Poty / power_on / 8868.0°C
Bomba CAG 06(VERIFICAR) / Rio Poty / power_on / 19298.0°C

veja 2 devices do tipo energy motrando temperatura ? e o que signifca mostrar power_on ? deveria ser a mesma badger que mostra no src\thingsboard\main-dashboard-shopping\v-4.0.0\card\head-office\card-head-office.js, e não esse texto cru em si

os dados de tempo em operação está vazio e Potência também (isso para domain energy, para domain water Leitura está mostrando sempre "L")

ao clicarmos para abrir
handleActionDashboard > está dando erro
veja como era antes em
src\MYIO-SIM\v5.2.0\EQUIPMENTS\controller.js
e
src\MYIO-SIM\v5.2.0\MAIN\controller.js
mais especificamente no MyIOLibrary.renderCardComponentHeadOffice em src\MYIO-SIM\v5.2.0\EQUIPMENTS\controller.js
installHook.js:1 [openDashboardPopupEnergy] Error opening modal: Error: startDate and endDate are required
at validateOptions (myio-js-library.umd.min.js:1:463126)
at Object.openDashboardPopupEnergy (myio-js-library.umd.min.js:1:570978)
at eval (eval at <anonymous> (chunk-CSPV6DHC.js:20:49920), <anonymous>:3261:23)

myio-js-library.umd.min.js:1 Uncaught (in promise) Error: startDate and endDate are required

handleActionReport > OK

handleActionSettings >
1 - 🌐 Referência Global (Padrão do Sistema)
está vindo vazio

2 - o botão fechar da modal de Configurações não fecha nem o X

3 - o botão salvar salva, mas não dá uma mensagem toast de sucesso e o orquestrador deveria atualzar a label na lista que está provavelmente no seu cache

---

     ☐ Fix filter modal - energy devices showing temperature values
     ☐ Fix filter modal - show proper status badge instead of power_on text
     ☐ Fix filter modal - operation time and power empty for energy
     ☐ Fix filter modal - water domain showing 'L' for Leitura
     ☐ Fix handleActionDashboard - startDate/endDate required error
     ☐ Fix handleActionSettings - empty global reference
     ☐ Fix handleActionSettings - close button not working
     ☐ Fix handleActionSettings - add toast on save and update cache

     ✽ Fixing dashboard action… (esc to interrupt · ctrl+t to hide todos · 5m 45s · ↑ 8.2k tokens · thought for 2s)

⎿ ☒ Add lastFilterModalDomain property to TelemetryGridView
☒ Fix getItemSubLabel to show customer name instead of status
☐ Fix handleActionDashboard - startDate/endDate required error
☐ Fix handleActionSettings - empty global reference
☐ Fix handleActionSettings - close button not working
☐ Fix handleActionSettings - add toast on save and update cache

acrescente o item para resolução, o card em telemetry-grid, ao arrastar para o footer não funciona
apenas o select, confira nos widgets antigos em src\MYIO-SIM\v5.2.0\EQUIPMENTS\controller.js e src\MYIO-SIM\v5.2.0\FOOTER\controller.js
