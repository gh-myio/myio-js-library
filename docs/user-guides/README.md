# MyIO — User Guides

Catálogo de guias do usuário para o dashboard MyIO. Cada guia existe em duas versões:

- **`.md`** — fonte, fácil de ler/editar no repositório.
- **`.html`** — versão estilizada (marca MyIO), pronta para abrir no navegador ou compartilhar.

Nomes de pasta e de arquivo em inglês; conteúdo em português (pt-BR), para o público final dos dashboards.

## Administração

| Guia | Descrição |
|---|---|
| [Gestão de Perfil de Usuário](./user-profile-management/user-profile-management.md) ([HTML](./user-profile-management/user-profile-management.html)) | Como gerenciar usuários, Funções/Papéis, Permissões Especiais e o mapa de Acesso em Funcionalidades (`restrict_view`). |

## Operação

| Guia | Descrição |
|---|---|
| [Anotações](./annotations/annotations.md) ([HTML](./annotations/annotations.html)) | Como criar, filtrar, arquivar e exportar anotações de dispositivos. |
| [Telemetria Instantânea e Pico de Demanda](./instant-telemetry-demand-peak/instant-telemetry-demand-peak.md) ([HTML](./instant-telemetry-demand-peak/instant-telemetry-demand-peak.html)) | Como consultar tensão, corrente, potência e fator de potência em tempo real, e o pico de demanda no histórico. |

---

## Convenção para novos guias

1. Crie uma pasta em `docs/user-guides/<topic-in-english>/`.
2. Adicione `<topic-in-english>.md` (conteúdo em pt-BR) e `<topic-in-english>.html` (mesma base, estilizada — veja um guia existente como referência de template).
3. Adicione uma linha na tabela da seção correspondente acima (ou crie uma nova seção, se for um tema novo).
