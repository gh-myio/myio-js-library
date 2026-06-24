@/src\components\premium-modals\energy\EnergyModal.ts

```
          title: `Comparação de ${deviceCount} Dispositivos`,

```

@/src\components\premium-modals\energy\EnergyModalView.ts

```
      return `Comparação de ${count} Dispositivos`;

```

reparei que temos mais de um lugar de comparação, enfim, preciso de um botão seletor da granularidade Dia (1d) ou Hora (1h)

@/src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\FOOTER\controller.js

```
      const granularity = this._calculateGranularity(startDate, endDate);

```

@/src\MYIO-SIM\v5.2.0\FOOTER\controller.js

```
      const granularity = this._calculateGranularity(startDate, endDate);

```

vi que temos uma espécie de cálculo e tal, mas não temos hoje 1w, até podemos fazer o cálculo para sugestão inicial, mas o usuário tem que ter a opção de trocar a granularidade se quiser
