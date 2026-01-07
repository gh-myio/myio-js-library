revise
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MAIN_VIEW\controller.js
e
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY\controller.js

faça um novo plano de ação bem detalhista para a gente garantir mais robusteuz
Premissa: entrei no dashboard de um cliente chamado Mestre Álvaro
1 - acho que tanto MAIN e TELEMETRY estão mais resiliente e robusto, revise para vermos brechas em caso de race condition, de não carregar os dados corretamente e etc
2 - mas do nada entrei no widget em energia default e depois em água e de forma intermitente aconteceram 2 casos: 1 - não carregou nada e precisei forçadamente clicar em carregar no header (src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\HEADER\controller.js) e aí sim aparentemente carregou ok, ou seja, não ficou 100% funcional quando a gente carregou outro widget, saindo do widget telemetry domain energy e nagevando para outro widget domain water, só ficou certo ao pressionar em carregar. 2 - outro exemplo intermitente mais grave, alguma coisa de window.state ou outro listener, cache, etc, carregou devices de outro customer do shopping da ilha. É importante saber que eu estava navegando antes em outro dashboard no contexto src\MYIO-SIM\v5.2.0, e não sei se a MAIN src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MAIN_VIEW\controller.js ou a outra main de uma versão nova a ser lançada src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js, manipulam cache, states e etc, com mesmo nome.
