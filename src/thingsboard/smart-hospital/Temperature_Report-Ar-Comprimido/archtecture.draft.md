esse flow no node red é assim

uma API POST
/rpc/temperature_report

depois vai pro node function
src\thingsboard\smart-hospital\Temperature_Report\Get-slave-ids.js

depois roda query
src\thingsboard\smart-hospital\Temperature_Report\query.log

depois vai para function
src\thingsboard\smart-hospital\Temperature_Report\nodered.controller.js

e returno o payload com http 200
exemplo real do retorno
src\thingsboard\smart-hospital\Tabela_Temp_V5\return-endpoint.json
