crie um markdowm md file em ingles
no estilo rust rfc

em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\docs\rfcs

eses RFC-0125

temos um ponto relevante e muito imporante a ser mapeado

o componente MENU
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\menu

ele tem uma modal de lista de shoppings, que por default mostra todos, se mudarmos,
MENU Componente tem que enviar um evento para

MAIN
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js

avisando quem mudou o filtro de customers e main tem que sincronizar rapidamente e atualizar

os cards no componente novo TELEMETRY
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\telemetry-grid

Bem como atualizar os totalizadores
em header componente e também sempre mostrar o valor relativo total x customers selecioandos
src\components\premium-modals\header

tudo orquestrado pela main, para isso também confira os widgets antigos em
src\MYIO-SIM\v5.2.0\MENU\controller.js
src\MYIO-SIM\v5.2.0\MAIN\controller.js
src\MYIO-SIM\v5.2.0\EQUIPMENTS\controller.js

como que era esses custom eventos do menu para atualização e etc

e temos que atualziar welcome também
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\premium-modals\welcome
