@/src\MYIO-SIM\v5.2.0\FOOTER\controller.js

```
  async openComparisonModal() {

```

veja como abre a comparação no widget antigo e como está a nova

a nova não está abrindo

@/src\components\footer\ComparisonHandler.ts

```
    MyIOLibrary.openDashboardPopupEnergy({

```

installHook.js:1 [openDashboardPopupEnergy] Error opening modal: Error: clientId and clientSecret are required for comparison mode
at validateOptions (myio-js-library.umd.min.js:1:463523)
at Object.openDashboardPopupEnergy (myio-js-library.umd.min.js:1:570978)
at ComparisonHandler.openEnergyModal (myio-js-library.umd.min.js:1:859783)
at ComparisonHandler.openComparisonModal (myio-js-library.umd.min.js:1:858836)
at FooterController.openCompareModal (myio-js-library.umd.min.js:1:868262)
at myio-js-library.umd.min.js:1:864580
at myio-js-library.umd.min.js:1:852495
at Array.forEach (<anonymous>)
at FooterView.emit (myio-js-library.umd.min.js:1:852478)
at HTMLButtonElement.<anonymous> (myio-js-library.umd.min.js:1:851251)
overrideMethod @ installHook.js:1
openDashboardPopupEnergy @ myio-js-library.umd.min.js:1
openEnergyModal @ myio-js-library.umd.min.js:1
openComparisonModal @ myio-js-library.umd.min.js:1
openCompareModal @ myio-js-library.umd.min.js:1
(anonymous) @ myio-js-library.umd.min.js:1
(anonymous) @ myio-js-library.umd.min.js:1
emit @ myio-js-library.umd.min.js:1
(anonymous) @ myio-js-library.umd.min.js:1
invokeTask @ polyfills-5W6QH7SK.js:1
runTask @ polyfills-5W6QH7SK.js:1
invokeTask @ polyfills-5W6QH7SK.js:1
q @ polyfills-5W6QH7SK.js:1
$ @ polyfills-5W6QH7SK.js:1
x @ polyfills-5W6QH7SK.js:1Understand this error
installHook.js:1 [ComparisonHandler] Comparison modal error: {code: 'UNKNOWN_ERROR', message: 'clientId and clientSecret are required for comparison mode', cause: Error: clientId and clientSecret are required for comparison mode
at validateOptions (https://u…}
overrideMethod @ installHook.js:1
error @ myio-js-library.umd.min.js:1
onError @ myio-js-library.umd.min.js:1
openDashboardPopupEnergy @ myio-js-library.umd.min.js:1
openEnergyModal @ myio-js-library.umd.min.js:1
openComparisonModal @ myio-js-library.umd.min.js:1
openCompareModal @ myio-js-library.umd.min.js:1
(anonymous) @ myio-js-library.umd.min.js:1
(anonymous) @ myio-js-library.umd.min.js:1
emit @ myio-js-library.umd.min.js:1
(anonymous) @ myio-js-library.umd.min.js:1
invokeTask @ polyfills-5W6QH7SK.js:1
runTask @ polyfills-5W6QH7SK.js:1
invokeTask @ polyfills-5W6QH7SK.js:1
q @ polyfills-5W6QH7SK.js:1
$ @ polyfills-5W6QH7SK.js:1
x @ polyfills-5W6QH7SK.js:1Understand this error
myio-js-library.umd.min.js:1 Uncaught (in promise) Error: clientId and clientSecret are required for comparison mode
