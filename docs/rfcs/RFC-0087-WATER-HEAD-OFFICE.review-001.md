os states para o MAIN e/ou MENU renderizar são
content_water
content_water_commom_area
content_water_stores

---

no settings.schema em src\MYIO-SIM\v5.2.0\WATER_STORES
não precisamos do customerTB_ID, isso já temos no MAIN
e depois pegar dele

analogamente em src\MYIO-SIM\v5.2.0\WATER_COMMON_AREA e src\MYIO-SIM\v5.2.0\WATER

em
src\MYIO-SIM\v5.2.0\WATER_STORES
não faz sentido DOMAIN se já sabemos que é water

a não ser se
src\MYIO-SIM\v5.2.0\WATER_STORES
e
src\MYIO-SIM\v5.2.0\STORES

puderem ser o mesmo widget e com esse domain ter pouca diferença e a maioria do código ser reaproveitado

lembrando que em

@/src\MYIO-SIM\v5.2.0\MAIN\controller.js

```
async function updateTotalWaterConsumption(customersArray, startDateISO, endDateISO) {

```

já temos os dados de água, e sempre deve ser controlado pela MAIN a busca de novos dados se mudar o intervalo de datas no MENU

E após fazer o fetch, MAIN, notifica, ou atualiza os conteúdos e etc

revise e garanta se isso acontece
