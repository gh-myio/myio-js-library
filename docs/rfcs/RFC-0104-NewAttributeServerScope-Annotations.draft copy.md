implemente uma melhoria de na modal Configurações
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\premium-modals\settings

ter uma grande TAB que seria a primeira opção GERAL > mostrando tudo que já temos
e uma outra TAB de Anotações

Essa outra TAB deve ser uma nova visão

- um Header para um Input de um texto corrido com até 255 caracteres
- um botão de adicionar anotação
- Ao clicar, vai salvar num atributo no device em sever_scope com nome de log_annotations, onde será um json
  contendo em cada item de anotaçào:
  - a data e hora
  - quem fez a anotação
    veja aqui um exemplo de como pegar o nome e email do usuário logado
    @/src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MENU\controller.js
    ```
    async function fetchUserInfo()
    ```
  - a anotação em si
  - status = created, archived or modified
- uma anotação nunca pode ser deletada, apenas modificada ou arquivada pelo próprio usuário ou pelo superadmin MYIO ou superadmin HOLDING . (superadmin myio é uma feature implementada em @/src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MAIN_VIEW\controller.js

```
async function detectSuperAdmin()
```

que inclusive deveria ir para LIB e ser exposta em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\index.ts )

superadmin holding seria uma bem simular mas pegar por exemplo o attributo server scope do customer do user o campo isUserAdmin

algo feito aqui

@/src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MENU\controller.js

```
if (attr && attr.key === 'isUserAdmin') {
```

e também deveria ser uma outra function na lib exposta em indesrc\index.ts.

a tela de anotações então terá esse campo para nova anotação e preencher o campo em si com texto corrido e adicionar e
abaixo uma grid paginada de 10 em 10 com scroll vertical com todas as anotações salvas referente ao device em si,
podendo pesquisar por data e hora (devemos usar a nossa LIB C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\createDateRangePicker.ts para as datas)
filtrar texto, filtrar usuário e status (criado, modificado e arquivado)

na grid deveria exibir os primeiros 50 caracteres e uma tooltip premium mostrando toda injetada criada na hora ao passar o mouse, siga o padrão parecido de
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\utils\EnergyRangeTooltip.ts mostrando na tooltip da anotaçao o texto, data, hora, usuário, status
o detalhamento com botão de ver detalhes e abrir uma modal com o detalhamento e aí sim abrir uma modal para poder editar ou arquivar (se for o próprio usuário da anotação ou superadmin holdinhg ou superadmin myio)

em cada linha da grid podemos adicionar um campo de CHECK para dar ciência da anotação como se ela estivesse já sido resolvida

cada anotação pode ser de um tipo

- observação geral
- pendência
- manutenção
- atividade

e além da data da criação da anotação, ela pode ter uma data limite e um grau de importância (muito baixo, baixo, normal, alto, muito alto)

esse campos pode ser filtrados também e se a data limite foi atingida,

e ao fim, no card, tando em
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\card\template-card-v5.js
e
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-4.0.0\card\head-office\card-head-office.js

temos que implementar um tooltip premium flutuante sem alterar o posicionamento da imagem do card em template-card-v5.js ao lado direito um ícone de anotação
se tiver pendência fica avermelhado se tiver anotações de atividade fica verde, manutenção amarelo, e observação geral, azul, se não tiver anotação nenhuma fica 50% transparente meio que disable

e no card do card-head-office.js pode ficar o ícone flutuando ao lado direito sem deslocar o valor do consumo no meio do card.

toda essa estrutura deve ser um json e para cada item adicionado ou ajustado, deve ter um cabeçalho da versão, com data da criação, o usuário que criou e para cada alteração uma data de auditoria de log com data e hora e usuário da última alteração também e a versão sempre incrementando.

afinal vamos validar tudo nos showscases com mocks
em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\showcase
