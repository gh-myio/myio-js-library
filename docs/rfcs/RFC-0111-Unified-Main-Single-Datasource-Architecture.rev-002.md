garanta que tudo isso aqui src\MYIO-SIM\v5.2.0\WELCOME\settingsSchema.json vá para a nova main
e na chamada da modal nova da lib
src\components\premium-modals\welcome

precisamos passar os parametros

revise o markdown C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\docs\rfcs\RFC-0111-Unified-Main-Single-Datasource-Architecture.md
se está prevendo isso na chamada da LIB openWelcomeModal no onInit

aliais, enquanto está carregando os dados essa modal welcome não deveria ainda mostrar os cards dos shoppings e/ou não mostrar os indicadores

nem mesmo o botão de acessar, deveria ser aguarde...

A MAIN que depois de carregar todos os dados deveria enviar um evento para a modal dizendo que carregou os dados em si e depois
renderizar os cards dos shoppings e os indicadores da tooltip

revise isso tanto em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\docs\rfcs\RFC-0111-Unified-Main-Single-Datasource-Architecture.md
e C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\docs\rfcs\RFC-0112-WelcomeModalHeadOffice.md

a main precisa ter um controle de theme mode exposto e precisa também passar na chamada da lib openWelcomeModal para manipular lá

e veja que temos que implementar no json novos atributos

@/src\docs\rfcs\RFC-0112-WelcomeModalHeadOffice.md

```
  // Theme-specific settings
  darkMode?: WelcomeThemeConfig;
  lightMode?: WelcomeThemeConfig;
```

analogamente

agora temos os componentes

- header > src\docs\rfcs\RFC-0113-HeaderComponent.md
  ou seja,

esse trecho não existirá mais,

@/src\MYIO-SIM\v5.2.0\MAIN\template.html

```
<section style="height: 145px; min-height: 145px; max-height: 145px; overflow: none; background: transparent">
  <tb-dashboard-state class="content" [ctx]="ctx" stateId="header"></tb-dashboard-state>
</section>
```

no JS da nova main irá chamar a LIB

src\components\premium-modals\header

- menu > src\docs\rfcs\RFC-0114-MenuComponent.md

analogamente para aqui

esse trecho

@/src\MYIO-SIM\v5.2.0\MAIN\template.html

```
<section style="height: 80px; min-height: 80px; max-height: 80px; overflow: hidden; background: transparent">
  <tb-dashboard-state class="content" [ctx]="ctx" stateId="menu"></tb-dashboard-state>
</section>
```

no JS da nova main irá chamar a LIB

src\components\menu

- footer > src\docs\rfcs\RFC-0115-FooterComponent.md

e aqui também

@/src\MYIO-SIM\v5.2.0\MAIN\template.html

```
<!-- RFC-0058: Footer with device selection and comparison -->
<section>
  <tb-dashboard-state [ctx]="ctx" stateId="footer"></tb-dashboard-state>
</section>

```

no JS da nova main irá chamar a LIB

src\components\footer

---

lembrando que no menu teremos algo assim

Energia

- Equipamentos (default, quando carregar MAIN e fechar a modal de WELCOME vai entrar em Telemtery src\MYIO-SIM\v5.2.0\TELEMETRY > domain: energy > context: equipments)
- Lojas (quando clicar em Lojas no MENU, a MAIN vai atualizar TELEMETRY src\MYIO-SIM\v5.2.0\TELEMETRY > domain: energy > context: stores)
- Geral (Energia) > main precisa abrir uma modal ocupando 95% da tela chamando o componente novo do markdown src\docs\rfcs\RFC-0117-EnergyPanelComponent.md

Água?

- Ãrea Comum (default, quando carregar MAIN e fechar a modal de WELCOME vai entrar em Telemtery src\MYIO-SIM\v5.2.0\TELEMETRY > domain: water > context: hidrometro_area_comum)
- Lojas (quando clicar em Lojas no MENU, a MAIN vai atualizar TELEMETRY src\MYIO-SIM\v5.2.0\TELEMETRY > domain: water > context: hidrometro)
- Resumo > main precisa abrir uma modal ocupando 95% da tela chamando o componente novo do markdown src\docs\rfcs\RFC-0118-WaterPanelComponent.md

Temperatura?

- Sensores em Ambientes Climatizáveis (default, quando carregar MAIN e fechar a modal de WELCOME vai entrar em Telemtery src\MYIO-SIM\v5.2.0\TELEMETRY > domain: temperature > context: termostato)
- Sensores em Ambientes Não Climatizáveis (quando clicar em Lojas no MENU, a MAIN vai atualizar TELEMETRY src\MYIO-SIM\v5.2.0\TELEMETRY > domain: temperature > context: termostato_external)
- Resumo Geral > main precisa abrir uma modal ocupando 95% da tela chamando o componente novo do markdown src\docs\rfcs\RFC-0119-TemperaturePanelComponent.md
