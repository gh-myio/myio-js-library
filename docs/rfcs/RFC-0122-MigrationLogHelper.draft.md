analogamente crie um logUtils para migrar\
@/src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js

```
const LogHelper = {
```

e faça uma melhoria para ao instanciar, ter como fazer um config de maiores detalhes
exemplo:
const LogHelper = MyIOLibrary.CreateLogHelper();

const configLogHelper = {widget: "MAIN_UNIQUE_DATASOURCE", function: "fetchCredentialsFromThingsBoard"};

mas pode ser

const configLogHelper = {domain: "water", device: "3F XXXX"};

LogHelper.setConfig(configLogHelper);

E sempre que for fazer

// LogHelper utility - shared across all widgets in this context
const LogHelper = {
log: function (...args) {
if (DEBUG_ACTIVE) {
console.log(...args);
}
},
warn: function (...args) {
if (DEBUG_ACTIVE) {
console.warn(...args);
}
},
error: function (...args) {
// Errors always logged regardless of DEBUG_ACTIVE
console.error(...args);
},
};

log: function (...args) {
if (DEBUG_ACTIVE) {
console.log(...args);

será mais ou menos assim

iterar em config (se existir) e ir colcando na frente para sair um log opcionalmente quando existir config assim como exemplo

iterar em cada item de config e fazer uppercase
exemplo se tivermos
const configLogHelper = {widget: "MAIN_UNIQUE_DATASOURCE", function: "fetchCredentialsFromThingsBoard"};

      console.log("[WIDGET: MAIN_UNIQUE_DATASOURCE][FUNCTION: fetchCredentialsFromThingsBoard]" + ...args);

      UPPER case só na key: widget e function.

    }
