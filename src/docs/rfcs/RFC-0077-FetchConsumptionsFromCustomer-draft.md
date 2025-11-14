no thingsboard

no customer, 

temos os attributes server_scope

standbyLimitDownConsumptionElevator
standbyLimitUpConsumptionElevator
alertLimitDownConsumptionElevator
alertLimitUpConsumptionElevator
normalLimitDownConsumptionElevator
normalLimitUpConsumptionElevator
failureLimitDownDownConsumptionElevator
failureLimitUpConsumptionElevator
standbyLimitDownConsumptionEscalator
standbyLimitUpConsumptionEscalator
alertLimitDownConsumptionEscalator
alertLimitUpConsumptionEscalator
normalLimitDownConsumptionEscalator
normalLimitUpConsumptionEscalator
failureLimitDownDownConsumptionEscalator
failureLimitUpConsumptionEscalator
standbyLimitDownConsumptionMotor
standbyLimitUpConsumptionMotor
alertLimitDownConsumptionMotor
alertLimitUpConsumptionMotor
normalLimitDownConsumptionMotor
normalLimitUpConsumptionMotor
failureLimitDownDownConsumptionMotor
failureLimitUpConsumptionMotor

e eles serão as faixas 

atualmente os valores estão hard coded

@/src\MYIO-SIM\V1.0.0\EQUIPMENTS\controller.js
```
        const deviceStatus = MyIOLibrary.calculateDeviceStatus({
          connectionStatus: mappedConnectionStatus,
          lastConsumptionValue: Number(consumptionValue) || null,
          limitOfPowerOnStandByWatts: standbyLimit,
          limitOfPowerOnAlertWatts: alertLimit,
          limitOfPowerOnFailureWatts: failureLimit
        });
```

esse trecho

@/src\MYIO-SIM\V1.0.0\EQUIPMENTS\controller.js
```
switch(deviceType) {
          case 'CHILLER':
            standbyLimit = 1000;
            alertLimit = 6000;
            failureLimit = 8000;
            break;
          case 'AR_CONDICIONADO':
          case 'AC':
            standbyLimit = 500;
            alertLimit = 3000;
            failureLimit = 5000;
            break;
          case 'ELEVADOR':
          case 'ELEVATOR':
            standbyLimit = 150;
            alertLimit = 800;
            failureLimit = 1200;
            break;
          case 'BOMBA':
          case 'PUMP':
            standbyLimit = 200;
            alertLimit = 1000;
            failureLimit = 1500;
            break;
          default:
            break;
        }
```


deve ser trocado para buscar de attributes server_scope do customer 
e o componente da LIB
calculateDeviceStatus

precisa de ajuste para lidar com faixas

C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\utils\deviceStatus.js

