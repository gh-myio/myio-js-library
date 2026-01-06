no componente
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\premium-modals\settings\SettingsModalView.ts

temos que passar centralId e deviceName (está passando apenas label) como parâmetro

@/src\components\premium-modals\settings\openDashboardPopupSettings.ts

```
export async function openDashboardPopupSettings(
  params: OpenDashboardPopupSettingsParams
): Promise<void> {
```

em

@/src\components\premium-modals\settings\types.ts

```
export interface OpenDashboardPopupSettingsParams {

```

e então logo na hora que for renderizar a modal, mostra um showbusy

exemplo

window.MyIOOrchestrator?.showGlobalBusy(domain, 'Carregando dados de última telemetria...');

const $http = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get("http"));

// Use centralId from response, fallback to default if not found or empty
const centralId = response?.centralId || "45250d44-bad0-4071-aaa0-8091cfb12691";

try {
await $http.get(`https://${centralId}.y.myio.com.br/api/check_device/${deviceName}`).toPromise();
após esse passo, dar um delay de 1,5 segundo
} catch (e) {
console.error("Erro ao enviar requisição:", e);
}

window.MyIOOrchestrator?.hideGlobalBusy

esse endpoint y.myio.com.br vai ser chamando quando

ao chamar

@/src\components\premium-modals\settings\SettingsModalView.ts

```
    this.fetchLatestConsumptionTelemetry();

```

e cair no caro

@/src\components\premium-modals\settings\SettingsModalView.ts

```
        telemetryElement.innerHTML = '<span class="telemetry-no-data">Sem dados</span>';

```

---

temos que criar em
src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js

@/src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js

```
window.MyIOOrchestrator = window.MyIOOrchestrator || {};

```

copiando de

@/src\MYIO-SIM\v5.2.0\MAIN\controller.js

```
const MyIOOrchestrator = (() => {

```

teremos implementar um delay de 2segundos e
implementar até 3 tentativas espassadas com 10 segundos de uma nova requisição de fetchLatestConsumptionTelemetry

para ver se carregou última telemetria, mas jã pode chamar hideGlobalBusy e mostrar um toast de warning que estã tentando carregar a última telemetria do dispositivo e onde mostraria ^Sem dados^, mostramos "Atualizaando última telemetria. (1/5)"
