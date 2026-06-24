@/src\utils\deviceInfo.js

```
    // RFC-0111: deviceType = 3F_MEDIDOR AND deviceProfile != 3F_MEDIDOR → equipments
    if (deviceType === '3F_MEDIDOR' && deviceProfile !== '3F_MEDIDOR') {
      return ContextType.EQUIPMENTS;
    }
```

Temos que melhorar o detalhamento aqui para saber qual categoria do equipamento

nas tooltips de cada shopping que mostram nos cards de welcome

Distribuicao por Categoria em energia e no componente header

C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\premium-modals\header\

Observação importante: o componente header não é MODAL, mova com cuidado para C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\ e veja o impacto e ajuste

chamada em

@/src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\controller.js

```
    headerInstance = MyIOLibrary.createHeaderComponent({

```

também precisa de ajuste, pois no HEADER a tooltips mostra apenas equipamento e lojas e precisa seguir o padrão que funciona em

no outro contexto de referência
veja em
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MAIN_VIEW\controller.js e
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY\controller.js e
src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY_INFO\controller.js

nessa TOOLTIP

@/src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY_INFO\template.html

```
    <h2 class="info-title" id="infoTitleHeader">ℹ️ Informações de Energia</h2>

```

resumo de regra a validar e usar

Categoria

Entrada (deviceType = 3F_MEDIDOR E deviceProfile = ENTRADA / RELOGIO / SUBESTACAO ) ou (deviceType = ENTRADA / RELOGIO / SUBESTACAO e não importa deviceProfile)
Área Comum (deviceType = 3F_MEDIDOR E deviceProfile = ENTRADA / RELOGIO / SUBESTACAO ) ou (deviceType = ENTRADA / RELOGIO / SUBESTACAO e não importa deviceProfile)
Elevadores (deviceType = 3F_MEDIDOR E deviceProfile = ESCADA_ROLANTE ) ou (deviceType = ESCADA_ROLANTE e não importa deviceProfile)
Esc. Rolantes (deviceType = 3F_MEDIDOR E deviceProfile = ELEVADOR ) ou (deviceType = ELEVADOR e não importa deviceProfile)
Climatização (deviceType = 3F_MEDIDOR E deviceProfile = FANCOIL / CHILLER / BOMBA_CAG / HVAC / AR_CONDICIONADO ) ou (deviceType = FANCOIL / CHILLER / BOMBA_CAG / HVAC / AR_CONDICIONADO e não importa deviceProfile) ou (deviceType = 3F_MEDIDOR, não importa deviceProfile e identifier = 'CAG' OU = 'HVAC' OU = 'AR_CONDICIONADO')
Outros (deviceType = 3F_MEDIDOR E deviceProfile not in( FANCOIL / CHILLER / BOMBA_CAG / ENTRADA / RELOGIO / SUBESTACAO / ESCADA_ROLANTE / ELEVADOR ) ou (deviceType in (BOMBA_INCENDIO, BOMBA_PRIMARIA, BOMBA_SECUNDARIA) e deviceProfile não importa deviceProfile)
Lojas (deviceType = deviceType = 3F_MEDIDOR) tem que ser exatamente assim

essa regra é usada aqui ( talvez ela precise de atualização, valide )

@/src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MAIN_VIEW\controller.js

```
const DEVICE_CLASSIFICATION_CONFIG = {

```

Crie uma função na LIB

para centralizar essa categorização e usarmos tanto em

C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\

no contexto de dashboard de shopping e
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE\
nosso contexto com foco atual MYIO-SIM

ATUALIZE O
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\.claude\CLAUDE.md
pois isso é muito importante para conhecimento do projeto
