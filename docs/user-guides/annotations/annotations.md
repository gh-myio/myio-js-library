# Anotações

> Guia do usuário — como registrar, consultar e gerenciar anotações de dispositivos no dashboard MyIO.

## Visão geral

Anotações são registros de texto associados a um dispositivo — pendências, manutenções, atividades ou observações — que ficam salvas no histórico e podem ser consultadas a qualquer momento por qualquer pessoa com acesso ao dashboard.

### Como acessar

- **Anotações de um dispositivo específico**: abra as **Configurações** do dispositivo (ícone ⚙️ no card) e vá até a aba **Anotações**.
- **Todas as anotações do cliente**: passe o mouse sobre o botão **✏️ Anotações operacionais** no cabeçalho do dashboard para ver o painel resumido, ou clique nele para filtrar o dashboard mostrando só os dispositivos com anotações.

---

## Criando uma anotação

Clique em **+ Nova Anotação** (ou **Nova Anotação +**) e preencha:

- **Texto** — a descrição da anotação.
- **Tipo** — um dos quatro tipos abaixo.
- **Importância** — de 1 (menor) a 5 (maior).

### Tipos de anotação

| Tipo | Cor | Uso |
|---|---|---|
| 🔴 Pendência | vermelho | Algo que precisa de ação/resolução |
| 🟠 Manutenção | laranja | Atividades de manutenção, programada ou corretiva |
| 🟢 Atividade | verde | Atividades gerais, não necessariamente um problema |
| 🔵 Observação | azul | Informações e observações gerais |

---

## Ciclo de vida de uma anotação

Toda anotação tem um **status**, que muda conforme ela é trabalhada:

- **Criado** — estado inicial, ao ser registrada.
- **Modificado** — depois de qualquer edição no texto ou nos dados da anotação.
- **Arquivado** — removida da visão ativa, mas preservada no histórico (nunca é excluída de verdade).

### Quem pode editar ou arquivar

- Editar e excluir seguem as regras normais de permissão do seu perfil.
- **Arquivar é sempre permitido** para anotações com status **Criado** ou **Modificado** — mesmo que outras ações (como editar) já estejam bloqueadas para aquela anotação. Isso garante que qualquer anotação resolvida possa sempre ser tirada da visão ativa, independente do estado de aprovação.

Uma anotação já **Arquivada** não pode ser arquivada de novo (a ação já foi feita).

---

## Filtros Avançados

Clique no ícone de filtro (⚙️/🔍, conforme a tela) para abrir a modal **Filtros Avançados**. Ela tem:

### Chips de contagem por tipo

No topo, cinco indicadores clicáveis mostram quantas anotações existem de cada tipo (excluindo arquivadas, exceto o último):

- 🔴 Pendência(s) · 🟠 Manutenção(ões) · 🟢 Atividade(s) · 🔵 Observação(ões) · ⚫ **Arquivado(s)**

Clicar em um chip filtra a lista para mostrar só aquele tipo (ou, no caso de **Arquivado(s)**, só as anotações arquivadas). Clicar de novo remove o filtro.

### Filtro por Status e Importância

Dois seletores permitem marcar múltiplos valores ao mesmo tempo:

- **Status**: Todos, Criado, Modificado, Arquivado.
- **Importância**: níveis 1 a 5.

### Filtro por Período

Um seletor de intervalo de datas restringe a lista às anotações criadas dentro do período escolhido.

Use **Limpar Filtros** para voltar ao estado padrão (tudo visível).

---

## Exportando anotações

Na lista de anotações, use os botões:

- **PDF** — gera um relatório em PDF das anotações filtradas atualmente.
- **CSV** — exporta os mesmos dados em formato de planilha.

---

## Dúvidas frequentes

**Uma anotação aprovada pode ser arquivada?**
Sim. Arquivar é sempre permitido para qualquer anotação não arquivada, independente do status de edição.

**Arquivar uma anotação apaga ela?**
Não. Anotações arquivadas continuam no histórico — só saem da visão ativa por padrão. Use o filtro **Arquivado(s)** ou o Status "Arquivado" para revê-las.

**Por que não vejo mais as anotações de alguém?**
Verifique se o acesso a Anotações não foi restringido para o seu usuário em **Acesso em Funcionalidades** (veja o guia [Gestão de Perfil de Usuário](../user-profile-management/user-profile-management.md)).
