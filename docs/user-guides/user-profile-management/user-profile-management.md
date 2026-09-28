# Gestão de Perfil de Usuário

> Guia do usuário — como gerenciar usuários, perfis e permissões de acesso no dashboard MyIO.

## Visão geral

A tela **Gestão de Usuários** é onde administradores criam, editam e controlam o acesso de cada usuário ao dashboard. Ela reúne:

- A lista de todos os usuários do cliente (customer), com busca, filtros e ações em lote.
- O detalhe de cada usuário, com suas Funções/Papéis, Permissões Especiais e o mapa de Acesso em Funcionalidades.
- Grupos e Políticas de acesso (GCDR).

### Como acessar

1. No **Menu** lateral do dashboard, clique em **⚙️ Configurações**.
2. Na modal que abrir, escolha **Gestão de Usuários**.

> A opção **Gestão de Usuários** só aparece para usuários administradores. Se você não a vê, seu perfil pode não ter a permissão necessária — veja [Permissões Especiais](#permissões-especiais).

---

## Aba Usuários — a lista

A aba **Usuários** mostra uma tabela com todos os usuários do cliente:

| Coluna | O que mostra |
|---|---|
| Nome | Nome do usuário, com o e-mail logo abaixo em fonte menor |
| PERFIL (TB) | Perfil no ThingsBoard: **Admin** (Tenant Administrator) ou **Usuário** |
| Status | **Ativo** ou **Bloqueado** — clique no badge para alternar |
| Adm User Attr. | Toggle do atributo `isUserAdmin` (ver [Permissões Especiais](#permissões-especiais)) |
| Holding User Attr. | Toggle do atributo `isHolding` |
| Criado em | Data de criação do usuário |
| Alterado em | Estimativa da última alteração conhecida (baseada nos atributos acima) |
| GCDR | Status de sincronização com o GCDR, com botão para forçar sincronização |
| Ações | Ver Funções/Papéis, Ver Detalhes |

### Buscar, ordenar e filtrar

- **Busca**: digite nome ou e-mail no campo de busca no topo da lista.
- **Ordenar**: clique nos cabeçalhos **Nome**, **Criado em** ou **Alterado em** para ordenar a lista por essa coluna; clique de novo para inverter a direção (uma seta ▲/▼ indica a coluna e direção atuais).
- **Filtrar**: clique no botão **Filtros** (ícone de funil) para abrir a modal de filtro. Por padrão, todos os status e perfis vêm marcados (nada é escondido); desmarque o que não quiser ver. O filtro é aplicado apenas sobre a página já carregada.

### Alterando Adm User Attr. / Holding User Attr. direto na lista

Cada linha tem um toggle para `isUserAdmin` e outro para `isHolding`. Ao alternar:

1. Uma confirmação aparece perguntando se você quer aplicar a mudança.
2. Ao confirmar, a alteração é salva imediatamente e um aviso de sucesso (ou erro) aparece na tela.
3. Se você cancelar, o toggle volta ao valor anterior.

### Ações em Lote

Marque a caixa de seleção de uma ou mais linhas (ou a caixa "selecionar todos" no cabeçalho) para fazer aparecer o botão **Ações em Lote**. As ações disponíveis são:

- **Sync GCDR** — sincroniza os usuários selecionados com o GCDR.
- **Bloquear todos** / **Liberar todos** — altera o status de acesso de todos os selecionados de uma vez.
- **Habilitar Admin User Attr. para todos** — liga `isUserAdmin` para todos os selecionados.
- **Habilitar Holding User Attr. para todos** — liga `isHolding` para todos os selecionados.

Toda ação em lote pede confirmação antes de executar, e mostra um resumo do resultado (quantos tiveram sucesso, e quais falharam, se houver falhas).

---

## Detalhe do usuário

Clique no ícone **Ver Detalhes** (seta) em qualquer linha para abrir a visão completa de um usuário. Ela tem as seguintes seções:

### Dados gerais

Nome, e-mail, telefone, perfil, data de criação e descrição. Use **Habilitar Edição** para editar esses campos, **Redefinir Senha** para enviar um e-mail de redefinição, ou **Excluir** para remover o usuário.

### 🔑 Funções / Papéis

Lista as funções (roles) do GCDR atribuídas a este usuário, com escopo (global ou por cliente), status e validade. Use **+ Adicionar** para atribuir uma nova função, ou **Revogar** para remover uma existente.

### 🛡️ Permissões Especiais

Dois toggles que controlam atributos de nível de conta, usados em conjunto para conceder o status de **Holding Admin** (acesso administrativo que atravessa múltiplos clientes):

- **Usuário Administrador** (`isUserAdmin`)
- **Holding Admin** (`isHolding`)

Os dois precisam estar ligados juntos para que o usuário tenha status de Holding Admin.

> ⚠️ **Atenção — não confunda com o "Adm User Attr." da lista de usuários.** Existe também um atributo `isUserAdmin`, mas de **outro nível** (do cliente, não do usuário), que controla se o botão de Configurações aparece no Menu para usuários que não são Tenant Administrator no ThingsBoard. São dois atributos com nomes parecidos, mas escopos e efeitos diferentes.

### 🔓 Acesso em Funcionalidades

Esta seção controla **o que este usuário específico enxerga no dashboard** — itens de menu, botões do cabeçalho e o dock de comparação do rodapé. Por padrão, **tudo está liberado**; você só precisa mexer aqui para restringir algo.

Os itens são organizados em três grupos:

**Menu**
- ⚡ Energia, 💧 Água, 🌡️ Temperatura, 🔔 Alarmes, 📊 Relatórios, 🎯 Metas, ⚙️ Configurações

**Cabeçalho**
- 🔔 Notificação de Alarmes (com 4 sub-permissões, veja abaixo), ✏️ Anotações, 🎧 Chamados

**Rodapé**
- 📊 Comparar

> ✅ **Regra obrigatória**: pelo menos um item entre **Energia, Água, Temperatura, Alarmes, Relatórios e Metas** precisa continuar ativo. Se você tentar desligar o último deles, a mudança é bloqueada e um aviso explica o motivo — assim nenhum usuário fica sem enxergar nenhum conteúdo do dashboard.

**Sub-permissões de Alarmes.** Quando o toggle "Notificação de Alarmes" está ligado, quatro sub-itens aparecem logo abaixo (recuados), permitindo um controle mais fino:

- 🗺️ Editar Mapa de Alarmes GCDR
- ✅ Reconhecer alarmes
- ⏰ Adiar alarmes
- 📈 Escalar alarmes

Clique em **Salvar** para gravar as alterações. Se você desligar o toggle pai (Notificação de Alarmes), os sub-itens ficam visualmente desabilitados (não fazem mais sentido enquanto o item pai estiver oculto).

---

## Dúvidas frequentes

**Por que o usuário não vê mais o botão Configurações no Menu?**
Verifique dois lugares: (1) se `menu.settings` está desligado em **Acesso em Funcionalidades** deste usuário, e (2) se o cliente (customer) tem o atributo `isUserAdmin` configurado — usuários que não são Tenant Administrator do ThingsBoard só veem o botão Configurações se o cliente tiver esse atributo habilitado.

**Uma mudança em Acesso em Funcionalidades afeta outros usuários?**
Não. O `restrict_view` é sempre por usuário — nunca afeta o cliente inteiro nem outros usuários.

**Posso restringir um domínio que o próprio dashboard já desabilitou?**
Não. As restrições de usuário sempre estreitam o que o dashboard já permite — nunca conseguem liberar algo que o dashboard, como um todo, já tem desabilitado.
