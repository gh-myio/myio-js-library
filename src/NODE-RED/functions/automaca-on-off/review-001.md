temos por exemplo salvo no context data no node red

stored_schedules

Splitão 04: array[3]
0: object
type: "group"
startHour: "06:30"
endHour: "20:40"
daysWeek: object
holiday: false
retain: true
1: object
type: "group"
startHour: "08:30"
endHour: "16:30"
daysWeek: object
holiday: false
retain: true
2: object
type: "group"
startHour: "07:30"
endHour: "19:40"
daysWeek: object
holiday: true
retain: true

stored_holidays	
0: "2025-12-25"
1: "2026-01-01"
2: "2026-04-03"
3: "2026-04-21"
4: "2026-05-01"
5: "2025-11-20"

----

olha o LOG da function

20/11/2025, 07:20:26node: 91db8371.7f0d
msg : Object
object
deviceName: "Splitão 04"
shouldActivate: true
shouldShutdown: false
payload: object
currentIndex: 5
length: 52
shouldActivate: true
shouldShutdown: false
device: object
type: "lamp"
name: "Splitão 04"
channelType: "REMOTE_INPUT"
outputType: "HOLDING"
slaveId: 15
channelId: 1
deviceKind: "lamp"
deviceName: "Splitão 04"
uniqueId: "96a7ca86-c291-4d77-aa66-4706641eaa5a_15_20"
deviceName: "Splitão 04"
excludedDays: array[0]
storedHolidaysDays: array[6]
0: "2025-12-25"
1: "2026-01-01"
2: "2026-04-03"
3: "2026-04-21"
4: "2026-05-01"
5: "2025-11-20"
currDate: "2025-11-20T00:00:00.000Z"
currentTimeSP: "2025-11-20T10:20:26.110Z"
schedules: array[1]
0: object
type: "group"
startHour: "07:30"
endHour: "19:40"
daysWeek: object
mon: false
tue: false
wed: false
thu: false
fri: false
sat: false
sun: false
holiday: true
retain: true
_observability: object
logKey: "automation_log_Splitão04_1763634026114"
logData: object
device: "Splitão 04"
deviceId: "Splitão 04"
action: "ON"
shouldActivate: true
shouldShutdown: false
reason: "holiday"
schedule: object
startHour: "07:30"
endHour: "19:40"
retain: true
holiday: true
daysWeek: object
context: object
isHolidayToday: true
currentWeekDay: "thu"
holidayPolicy: "exclusive"
totalSchedules: 1
timestamp: "2025-11-20T10:20:26.110Z"
timestampMs: 1763634026114
_msgid: "4b329b5c.fe99c4"

---

entendo que está ao contrário aqui não ?

shouldActivate: true
shouldShutdown: false