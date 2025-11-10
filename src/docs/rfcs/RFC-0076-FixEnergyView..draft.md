temos que tratar essa inconsistência.

ao carregar a tela inicial default de 
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\EQUIPMENTS

e clicar no filtro 
Selecionar Equipamentos

TODOS (219)
COM CONSUMO (172)
SEM CONSUMO (47)
ELEVADORES (29)
ESC. ROLANTE (54)
CLIMATIZAÇÃO (33)
OUTROS EQUIP. (103)

esses são os dados

E ao clicar depois em ENERGY 
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\ENERGY

navegado pelo MENU
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\MENU

os dados deveriam ser mantidos (talvez verificar como o MAIN
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\MAIN, se for o caso....
 ou no próprio EQUIPMENTS estão passando os dados)
 
 fato é que carregou em ENERGY
 
No Card de Distribuição de Energia

Apenas Dados de outros equipamentos,

Deveria mostrar o Grupo de Lojas, que está sendo exibido no card Consumo Total Lojas
e os outros ELEVADORES, ESC. ROLANTE, CLIMATIZAÇÃO, OUTROS EQUIP. e eventualmente ÁREA COMUM se tiver sobra (SEMPRE DEVERIA TER)

rode o script clean-log.psi (C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\clean-log.ps1) no arquivo de log
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\dashboard.myio-bas.com-1762809149745.log

e veja o LOG se precisar para tracking de mais detalhes.

E adicionalmente, por exemplo, se no Card Distribuição de Energia, selecionamos no select Elevadores por Shopping não tras nada.
