agora entre no plan mode para se basear em src\MYIO-SIM\v5.2.0\MAIN
Criar um novo widget src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE
o objetivo é quase se uma cópia de main
mas os pontos importantes são

hoje nessa sessão

@/src\MYIO-SIM\v5.2.0\MAIN\template.html

```
<section id="mainView"
```

ele já renderiza vários widgets

mas agora teremos apenas um único

src\MYIO-SIM\v5.2.0\TELEMETRY

e a MAIN sincronizada com MENU

src\MYIO-SIM\v5.2.0\MENU

deverá mudar todo o conteúdo de
src\MYIO-SIM\v5.2.0\TELEMETRY dinamicamente de forma inteligente, pois na MAIN

teremos agora apenas um datasource

com aliasName = AllDevices

e dentro dele teremos todos os devices juntos e misturados e a main vai ter que mapear isso separando por domain e context quando for chamado no menu ela renderizar corretamente os dados
