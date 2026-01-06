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
