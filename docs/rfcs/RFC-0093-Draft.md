na GRID de Equipamentos

C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\v5.2.0\EQUIPMENTS

precisamos ter um botão na mesma linha onde fica eventualmente shoppingFilterChips, mas alinhado a direita um botão de ativação de telemetria instantanea

se ativado, iniciamos um serviço bem parecido com src\docs\rfcs\RFC-0084-Real-Time-Telemetry-Modal.md e src\docs\rfcs\RFC-0082-DemandModal-RealTime-Mode.md

implementado em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\RealTimeTelemetryModal.ts

nesse caso será um serviço que para cada CARD renderizado em equipamentos iremos ativar um LOOP de 8 segundos de check da potencia instantanea de cada devicee ficar atualizando a Potência e o status naturalmente.

O consumo que vem da API será ignorado
e podemos até fazer uma melhora sutil no card em renderCardComponentHeadOffice
para se ativarmos uma flag de realtime, o CARD se transformar e mostrar em destaque a potência, onde hoje mostra o consumo em kWh a label potência ser substituído por Últ. Atualização
