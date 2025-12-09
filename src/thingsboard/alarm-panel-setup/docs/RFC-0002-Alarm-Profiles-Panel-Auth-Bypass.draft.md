temos um problema na chamada das APIs

veja um plano de implementação que possamos guardar o token e o usuario logado

veja como pegar os dados do usuário logado

@/src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MENU\controller.js

```
  // Fetch and display user info
  fetchUserInfo();

  async function fetchUserInfo()
```

e o token é

const token = localStorage.getItem('jwt_token');

precisamos fazer uma autenticação fixa como é feita aqui

@/src\thingsboard\WIDGET\Multimeter\device_card\controller.js

```
const body = { username: TB_USERNAME, password: TB_PASSWORD };
```

para poder usar as APIs

depois a ideia seria retornar o token anterior e o usuário anterior também logado

isso para as chamadas de APIs
/api/v2/alarms e /api/deviceInfos e /api/deviceProfile/ funcionarem sem depender do perfil logado
