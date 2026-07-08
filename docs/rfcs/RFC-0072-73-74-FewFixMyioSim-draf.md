Equipamentos
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\EQUIPMENTS

1- Os botões + e – de zoom não estão funcionando bem (revisar / remover)
2 - Modal de Filtros e Ordernação deve ocupar a tela toda está limitada no widget. Deveria ocupar a tela toda. Exemplo a modal Filtro avançado no MENU
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\MENU 
funciona bem para isso.
3 - Ajustar o handleActionSettings no widget 
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\EQUIPMENTS\controller.js
para ficar igual ao Widget
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY\controller.js
no que diz respeito para exibir centralName e etc. Ver como é parametrizada a chamada do componente openDashboardPopupSettings no v-5.2.0\WIDGET\TELEMETRY\controller.js
4 - Retirar o item no menu do card (i) mais informações
5 - Tem momentos que ao clicar submenu do card de equipamentos mostra uma modal toda desconfigurada.

Footer
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\FOOTER
1 - Comparar com 
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\FOOTER 
onde está bem visívil controlado pelo MAIN  
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MAIN_VIEW
ou seja
no MAIN 
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\MAIN
deveria exibir o footer corretamente, hoje está sem cor roxinha e também muito pequeno de altura, tem que aumentar a altura e diminur um pouco a altura da grid prinpical visível por defaul MYIO-SIM\V1.0.0\EQUIPMENTS
2 - Ao selecionar um card em Equipments, não vai a informação para o FOOTER.

Energy
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\ENERGY
1 - Gráfico de Consumo dos últimos 7 dias não está funcionando, deveria mostrar /totals para o consumo do últimos 7 dias, mas consultando dia a dia para temros as informações de consumo (claro que validando o filtro ativo, por default são todos os shoppings mas pode ter um filtro nisso.)
2 - Ainda nesse gráfico, deveria ter um label para quais shoppings foram considerados o filtro de busca dos últimos 7 dias e ter um botão de engine
para abrir uma modal premium para mudar os dados, se quero ver os últimos 7 dias total, ou 7 dias total de elevadores, ou de climatização ou de elevadores, ou de outros equipamentos, ou de lojas, ou tudo e etc. algo similiar ao select existente no card Distribuição de Energia.
3 - no card Consumo Total Lojas, Acrescentar um Label de Lojas são X% e Equipamentos são 58.1% do total
4 - Com zoom 100%, o card Consumo dos últimos 7 dias está maior que 50% da GRID e o card Distribuição de Energia está cortando.
5 - No CARD Distribuição de Energia  as seleções de Elevadores, Escada Rolantes e Climatização não estão funcionando. Devemos considerar deviceType se for diferente de 3F_MEDIDOR como correto ou se for 3F_MEDIDOR, pode ter algum BUG e considerarmos o deviceProfile = MOTOR | ESCADA_ROLANTE | ELEVADOR | 3F_MEDIDOR (aqui sim, se o deviceProfile for 3F_MEDIDOR podemos considerar)
6 - No CARD Pico de Demanda tem que revisar se filtar um shopping específico se está considerando apenas esse shopping em si. No caso aqui é chamada a api direto do thingsboard, mas devemos respeitar os filtros dos shoppings selecionados. 
