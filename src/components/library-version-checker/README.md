# LibraryVersionChecker Component

RFC-0137: Componente para exibir a versao da biblioteca e verificar atualizacoes no npm.

## Visao Geral

O `LibraryVersionChecker` exibe a versao atual da biblioteca MyIO e verifica automaticamente se ha atualizacoes disponiveis no npm registry. Fornece feedback visual e notificacoes toast quando a biblioteca esta desatualizada.

## Funcionalidades

- Exibe versao atual da biblioteca
- Verifica versao mais recente no npm registry
- Cache de 5 minutos para evitar requisicoes excessivas
- Indicadores visuais de status (checking, up-to-date, outdated, error)
- Tooltip premium com instrucoes de atualizacao (Windows e Mac)
- Toast warning periodico quando desatualizado

## Status Visuais

| Status | Icone | Cor | Descricao |
|--------|-------|-----|-----------|
| `checking` | ⟳ | Cinza (animado) | Verificando versao no npm |
| `up-to-date` | ✓ | Verde | Biblioteca atualizada |
| `outdated` | ⚠ | Amarelo (pulsando) | Atualizacao disponivel |
| `error` | ? | Cinza | Erro ao verificar |

## Instalacao

O componente e exportado pela biblioteca principal:

```javascript
import { createLibraryVersionChecker } from 'myio-js-library';
```

Ou via UMD global:

```javascript
const { createLibraryVersionChecker } = window.MyIOLibrary;
```

## Uso Basico

```javascript
const container = document.getElementById('version-display');

const checker = createLibraryVersionChecker(container, {
  packageName: 'myio-js-library',
  currentVersion: '0.1.328',
});
```

## Uso Completo

```javascript
const checker = createLibraryVersionChecker(container, {
  packageName: 'myio-js-library',
  currentVersion: MyIOLibrary.version,
  cacheTtlMs: 5 * 60 * 1000,      // 5 minutos (default)
  toastIntervalMs: 60 * 1000,     // 60 segundos (default)
  onStatusChange: (status, currentVer, latestVer) => {
    console.log(`Status: ${status}, Current: ${currentVer}, Latest: ${latestVer}`);
  },
});
```

## Opcoes (LibraryVersionCheckerOptions)

| Parametro | Tipo | Obrigatorio | Default | Descricao |
|-----------|------|-------------|---------|-----------|
| `packageName` | string | Sim | - | Nome do pacote npm para verificar |
| `currentVersion` | string | Sim | - | Versao atualmente instalada |
| `cacheTtlMs` | number | Nao | 300000 (5 min) | TTL do cache em millisegundos |
| `toastIntervalMs` | number | Nao | 60000 (60s) | Intervalo do toast warning em ms |
| `onStatusChange` | function | Nao | - | Callback quando status muda |

## Metodos da Instancia

### `destroy()`

Remove o componente do DOM e limpa intervalos.

```javascript
checker.destroy();
```

### `refresh()`

Forca nova verificacao no npm (limpa cache).

```javascript
await checker.refresh();
```

### `getStatus()`

Retorna o status atual do componente.

```javascript
const { status, currentVersion, latestVersion } = checker.getStatus();
// status: 'checking' | 'up-to-date' | 'outdated' | 'error'
```

## Toast Warning

Quando o status e `outdated`, o componente:

1. Mostra um toast warning imediatamente
2. Repete o toast a cada `toastIntervalMs` (default: 60 segundos)
3. Para automaticamente quando `destroy()` e chamado

O toast usa `MyIOToast.warning()` da biblioteca.

## Tooltip Premium

Ao clicar no icone de status, um tooltip premium aparece com:

- Versao instalada vs versao disponivel
- Instrucoes de atualizacao para Windows e Mac
- Atalhos de teclado para hard refresh

### Atalhos Mostrados

**Windows:**
- `Ctrl + Shift + R`
- `Ctrl + F5`

**Mac:**
- `⌘ + Shift + R`
- `⌘ + Option + R`

## Exemplo de Integracao no MENU Widget

```javascript
// MENU/controller.js
(function initLibraryVersionChecker() {
  const container = document.getElementById('lib-version-display');
  if (!container) return;

  const MyIOLib = window.MyIOLibrary;
  if (MyIOLib && typeof MyIOLib.createLibraryVersionChecker === 'function') {
    MyIOLib.createLibraryVersionChecker(container, {
      packageName: 'myio-js-library',
      currentVersion: MyIOLib.version || 'unknown',
      toastIntervalMs: 90 * 1000, // 90 segundos
      onStatusChange: (status, currentVer, latestVer) => {
        console.log(`[MENU] Version status: ${status}`);
      },
    });
  }
})();
```

## Cache

O componente usa `localStorage` para cachear a versao do npm:

- **Chave:** `myio:npm-version-cache:{packageName}`
- **TTL:** Configuravel via `cacheTtlMs` (default: 5 minutos)
- **Conteudo:** `{ version: string, timestamp: number }`

Para limpar o cache manualmente:

```javascript
localStorage.removeItem('myio:npm-version-cache:myio-js-library');
```

Ou use o metodo `refresh()` que limpa automaticamente.

## API do npm Registry

O componente faz requisicao para:

```
GET https://registry.npmjs.org/{packageName}/latest
```

Resposta esperada:

```json
{
  "version": "0.1.328",
  ...
}
```

## Comparacao de Versoes

Usa comparacao semantica (semver):

- `0.1.328` >= `0.1.328` = up-to-date
- `0.1.327` < `0.1.328` = outdated
- `0.2.0` > `0.1.999` = up-to-date

## Showcase

Para testar o componente localmente:

```bash
# Windows
cd showcase\library-version-checker
start-server.bat

# Mac/Linux
cd showcase/library-version-checker
./start-server.sh
```

Acesse: http://localhost:3333/showcase/library-version-checker/

## Estrutura de Arquivos

```
src/components/library-version-checker/
├── index.js          # Componente principal
└── README.md         # Esta documentacao

showcase/library-version-checker/
├── index.html        # Pagina de demonstracao
├── start-server.bat  # Script Windows para iniciar servidor
├── start-server.sh   # Script Mac/Linux para iniciar servidor
├── stop-server.bat   # Script Windows para parar servidor
└── stop-server.sh    # Script Mac/Linux para parar servidor
```

## Changelog

### v0.1.328
- Adicionado parametro `toastIntervalMs` configuravel
- Default do toast interval alterado para 60 segundos
- Toast warning periodico quando biblioteca desatualizada
- Tooltip com instrucoes para Windows e Mac

### v0.1.327
- Implementacao inicial do componente
- Verificacao de versao no npm registry
- Cache com TTL configuravel
- Tooltip premium com instrucoes de atualizacao
