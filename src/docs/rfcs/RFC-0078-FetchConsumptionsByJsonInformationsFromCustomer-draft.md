no thingsboard

no customer, 

temos no RFC 77 os attributes server_scope

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

vamos ter apenas um único atributo

chamado 

mapInstantaneousPower

cada device do tipo energia terá sempre no início do seu name 3F (exemplo para deviceType = 3F_MEDIOR, MOTOR, BOMBA, ELEVADOR, ESCADA_ROLANTE)

e as telemetrias  (InstantaneoustPowerType)

- consumption ( potência em Watts das 3 fases juntas, representa a soma as telemetrias a + b + c)
- a
- b 
- c
- fp_a
- fp_b
- fp_c
- voltage_a
- voltage_b
- voltage_c
- total_current ( potência em Watts das 3 fases juntas, representa a soma as telemetrias current_a + current_b + current_c)
- current_a
- current_b
- current_c 

exemplo:
attributes sever_scope no customer

mapInstantaneousPower = value JSON {
  version: 1.0.0,
  limitsByInstantaneoustPowerType: 
  [
	{
	  telemetryType: 'consumption',
	  itemsByDeviceType: 
	  [
		{

		  deviceType: 'ELEVADOR',
		  name: 'mapInstantaneousPowerElevator',
		  description: 'Setup de Limites de PotÊncia instantane para Elevor',
		  limitsByDeviceStatus : 
		  [
			{
			  deviceStatusName: 'standBy'
			  limitsVales: 
			  [
				{
				  baseValue: 1
				},
				{
				  topValue: 10
				}
			  ]
			},
			{
			  deviceStatusName: 'alert'
			  limitsVales: 
			  [
				{
				  baseValue: 11
				},
				{
				  topValue: 19
				}
			  ]
			},
			{
			  deviceStatusName: 'normal'
			  limitsVales: 
			  [
				{
				  baseValue: 20
				},
				{
				  topValue: 30
				}
			  ]
			},
			{
			  deviceStatusName: 'failure'
			  limitsVales: 
			  [
				{
				  baseValue: 31
				},
				{
				  topValue: 9999
				}
			  ]
			}
		  ]
		},
		{
		  deviceType: 'ESCADA_ROLANTE',
		  name: mapInstantaneousPowerEscalator,
		  description: 'Setup de Limites de PotÊncia instantane para Escada Rolante',
		  limitsByDeviceStatus : 
		  [
			{
			  deviceStatusName: 'standBy'
			  limitsVales: 
			  [
				{
				  baseValue: 1
				},
				{
				  topValue: 10
				}
			  ]
			},
			{
			  deviceStatusName: 'alert'
			  limitsVales: 
			  [
				{
				  baseValue: 11
				},
				{
				  topValue: 19
				}
			  ]
			},
			{
			  deviceStatusName: 'normal'
			  limitsVales: 
			  [
				{
				  baseValue: 20
				},
				{
				  topValue: 30
				}
			  ]
			},
			{
			  deviceStatusName: 'failure'
			  limitsVales: 
			  [
				{
				  baseValue: 31
				},
				{
				  topValue: 9999
				}
			  ]
			}
		  ]
		}
		... etc para outros deviceType como MOTOR, 3F_MEDIDOR, HIDROMETRO, TERMOSTATO, ETC.
	  ]
	},
	{
	  telemetryType: 'voltage_a',
	  itemsByDeviceType: 
	  [
		{

		  deviceType: 'ELEVADOR',
		  name: 'mapInstantaneousPowerElevator',
		  description: 'Setup de Limites de PotÊncia instantane para Elevor',
		  limitsByDeviceStatus : 
		  [
			{
			  deviceStatusName: 'standBy'
			  limitsVales: 
			  [
				{
				  baseValue: 1
				},
				{
				  topValue: 10
				}
			  ]
			},
			{
			  deviceStatusName: 'alert'
			  limitsVales: 
			  [
				{
				  baseValue: 11
				},
				{
				  topValue: 19
				}
			  ]
			},
			{
			  deviceStatusName: 'normal'
			  limitsVales: 
			  [
				{
				  baseValue: 20
				},
				{
				  topValue: 30
				}
			  ]
			},
			{
			  deviceStatusName: 'failure'
			  limitsVales: 
			  [
				{
				  baseValue: 31
				},
				{
				  topValue: 9999
				}
			  ]
			}
		  ]
		},
		{
		  deviceType: 'ESCADA_ROLANTE',
		  name: mapInstantaneousPowerEscalator,
		  description: 'Setup de Limites de PotÊncia instantane para Escada Rolante',
		  limitsByDeviceStatus : 
		  [
			{
			  deviceStatusName: 'standBy'
			  limitsVales: 
			  [
				{
				  baseValue: 1
				},
				{
				  topValue: 10
				}
			  ]
			},
			{
			  deviceStatusName: 'alert'
			  limitsVales: 
			  [
				{
				  baseValue: 11
				},
				{
				  topValue: 19
				}
			  ]
			},
			{
			  deviceStatusName: 'normal'
			  limitsVales: 
			  [
				{
				  baseValue: 20
				},
				{
				  topValue: 30
				}
			  ]
			},
			{
			  deviceStatusName: 'failure'
			  limitsVales: 
			  [
				{
				  baseValue: 31
				},
				{
				  topValue: 9999
				}
			  ]
			}
		  ]
		}
		... etc para outros deviceType como MOTOR, 3F_MEDIDOR, HIDROMETRO, TERMOSTATO, ETC.
	  ]
	},
	etc para cada InstantaneoustPowerType como fp_a, fp_b, e etc.
  ]
}

esse json deve estar salvo no Customer

e também eventualmente no device.

se exister atributos no device, ele é mandatório, caso contrário o customer é mandatório

na modal da LIB em openSettings

Configuração de Limites de Potência

precisa de um item de select para escolher o InstantaneoustPowerType (consumption é o padrão a ser exibido)

OBS
sempre validar no JSON ao salvar / editar / criar.
- consumption ( potência em Watts das 3 fases juntas, representa a soma as telemetrias a + b + c)
- total_current ( potência em Watts das 3 fases juntas, representa a soma as telemetrias current_a + current_b + current_c)

os campos não são obrigatórios nenhum

Planejar bem a mudança em 

@/src\MYIO-SIM\V1.0.0\EQUIPMENTS\controller.js
```
async function fetchDeviceConsumptionLimits(deviceId) {

```
