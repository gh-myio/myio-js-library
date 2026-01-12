podemos fazer upload de até 6 mídias no formato jpeg, jpg, png, de até 10MB cada,

em Annotations

C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\premium-modals\settings\annotations\AnnotationsTab.ts

crie na modal de cada anotação

abaixo de Data Limite (opcional)

um campo de mídeas para fazer upload, arrastando ou com ícone de upload

e uma grid mostrando um preview e depois excluir

ao salvar temos que ajustar em log annotations uma implementação de img_list (opcional, pode ser null / inexistente) associada para cada anotação

o swagger é

/api/image -> POST

file \* string($binary)

title (string) > seria bom um descritivo assim bem sucinto (ex: deviceLabel - Anotação <TIPO = Pendência | Manutenção | Atividade | Observação> - 1/6 (aqui no caso se for mídia 1/6, a segunda seria 2/6 e etc..) ou você pode sugerir um outro padrão também

imageSubType (string) > colocar o nome do arquivo original

retorno da api de exemplo de post nova imagem

{
"id": {
"id": "784f394c-42b6-435a-983c-b7beff2784f9",
"entityType": "TB_RESOURCE"
},
"createdTime": 1609459200000,
"tenantId": {
"id": "784f394c-42b6-435a-983c-b7beff2784f9",
"entityType": "TENANT"
},
"customerId": {
"id": "784f394c-42b6-435a-983c-b7beff2784f9",
"entityType": "CUSTOMER"
},
"title": "BinaryAppDataContainer id=19 v1.0",
"resourceType": "LWM2M_MODEL",
"resourceSubType": "IOT_SVG",
"resourceKey": "19_1.0",
"publicResourceKey": "string",
"etag": "33a64df551425fcc55e4d42a148795d9f25f89d4",
"fileName": "19.xml",
"descriptor": {},
"name": "string",
"public": true,
"link": "string",
"publicLink": "string"
}

e para mostrarmos uma nova imagem podemos ter um ícone de Mídeas dentro do card de anotação com totalizadores de mídeas e também mostramos no Histórico

e seguindo a mesma regra, se a anotação estiver ativa, pode deletar ou acrescentar nova até 6, ou o próprio usuário ou adminstrador da myio. ou superadmin

se a anotação estiver aprovada, rejeitada ou arquivada, não pode editar
