em
src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MAIN_VIEW\controller.js
src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY\controller.js
src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MENU

temos que incrementar a robustez e resilëncia

o caso é

entrei no dashboard e ok, tudo carregou ok

mas eventualmente eu clico no menu em água, carrega outro widget telemetry domain water tudo em branco

s[o funciona se eu clico em carregr no
]src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\HEADER

isso jamais pode acontecer, analogamente se eu clicar em temperature ou voltar para energy

☐ Analyze MAIN_VIEW controller for domain switch handling
☐ Analyze TELEMETRY controller for data loading issues
☐ Identify root cause of blank telemetry on domain switch
☐ Implement fix for resilient domain switching
