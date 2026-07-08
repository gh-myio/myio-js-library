hoje no HEADER

src\MYIO-SIM\v5.2.0\HEADER

no datasource estamos adicionando um alais AllTemperatureDevices com as datakeys temperature, ownerName e connectionStatus
e também outro datasource com alais customers com dataKeys.name = minTemperature e maxTemperature.

Faça um plano de migração onde vamos mover isso para o MAIN src\MYIO-SIM\v5.2.0\MAIN e ver o impacto disso para implementar os pontos de mudança

aliais, na main já temos datasource AllTemperatureDevices inclusive com adicional de ingestionId

revise o impacto que teremos, pois no Header temos extractTemperatureRangesByShopping e dentro self.ctx.data e isso ficará no main bem como fetchTemperatureAveragesByShopping, extractTemperatureRangesByShopping

tudo que for de responsabilidade de buscar dados, vai ser migrado para a Main src\MYIO-SIM\v5.2.0\MAIN
