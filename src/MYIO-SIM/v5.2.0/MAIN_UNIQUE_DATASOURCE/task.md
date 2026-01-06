ao selecionar temperatura\
 está dando erro\
 src\MYIO-SIM\v5.2.0\dashboard.myio-bas.com-1767703353753.log\
 e além do mais o card renderizado não tem nada a ver, mostra eficiência e deveria mostrar última temperatura exatamente igual em
e ao passar o mouse mostra a tooltip se está na faixa o sensor e etc\
 veja em src\MYIO-SIM\v5.2.0\TEMPERATURE_SENSORS\controller.js o widget antigo\
 e ainda temos o erro na header-telemetry-grid que mostra

Consumo Total
1,18 GWh

ao invés de média de temperatura de todos sensores (TERMOSTATO E TERMOSTATO_EXTERNAL)

e para o domain water > area_comum selecionado no menu component
src\components\menu\

nesse caso telemetry-grid precisa renderizar todos cards water menos loja e entrada, ou seja, junta hidrometro_area_comum todo (seja banheiro ou não)

---

o filter do header-grid da telemetry-grid está estranho mostrando nome do shopping 2x

exemplo
Bomba Hidráulica 5 L2 / Moxuara / Moxuara / 3.00 kWh

deveria ser
Bomba Hidráulica 5 L2 / Moxuara / Moxuara / 3.00 kWh

aliais o filter de pesquisa parou de funcionar no telemetry-grid
