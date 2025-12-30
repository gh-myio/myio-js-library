temos que fazer uma avaliação mais profunda me ajude a planejar

temos exceção para domain temperature, só manda temperature se mudar, no caso para domain termperature,
usamos como fonte de validação a telemetria connectionStatus mesmo

na verdade, para domain energy, por exemplo se for um motor, e ele estiver com potência nomimal constínua de 1000 watts,
não vai ficar mandando 1000 watts, só manda telemetria de consumption se mudar, se tiver variação

a mesma coisa para water

ao final quero dizer que connectionStatus = offline é o gatilho para validação de offline de fato aí sim podemos ver quando for a última telemetria enviada
talvez até já seja isso que você planejou mesmo ? apenas para validarmos isso.

e mais

se connectionStatus = waiting = não instalado e pronto, sem discussão

se = bad, é conexão fraca ( ou seja, não offline )

se connectionStatus = online, temos que verificar o delayTimeConnectionInMins, vai ser configurado no settings e com fallback de 1440 mins

consolide todo o seu plano e essas considerações que eu fiz num markdown md file em ingles no estilo rust rfc em

C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\docs\rfcs\RFC-0110-DeviceStatus-MAIN-RULE.md
