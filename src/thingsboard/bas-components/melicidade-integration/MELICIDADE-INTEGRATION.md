# Melicidade — Integração via Modal de iFrames (Niagara Framework)

> Documentação técnica da integração do cliente **Melicidade** com o dashboard BAS (`MAIN_BAS`).
> Cobre arquitetura, fluxo de navegação, componentes envolvidos e guia de extensão.
>
> **Screenshot de referência:** `screenshot-integracao-chiller-melicidade-2026-04-16-15-45.png`
> (capturado em 16/04/2026 — mostra tela de login Niagara com aviso de licença expirada)

---

## 1. Visão Geral

A Melicidade acessa três sistemas externos de automação (CHILLER, VRF, GERADOR) diretamente
dentro do dashboard BAS do MyIO, sem sair da interface. O acesso é feito via um modal de
tela cheia (95 vw × 95 vh) que carrega cada sistema em um `<iframe>` isolado, trocado por abas.

```
ThingsBoard Dashboard (MAIN_BAS)
  └── Sidebar Menu
        └── "(008)-Integrações"  ← asset do TB: MelicidadeAsset
              │
              ▼  click
        openIntegrationsModal()   ← MyIOLibrary (compiled)
              │
              ▼
        IntegrationsModal         ← src/components/premium-modals/integrations/
              └── IntegrationsModalView
                    ├── Header  (roxo MyIO #3e1a7d)
                    ├── TabBar  (verde escuro #245040)
                    │     ├── [CHILLER]
                    │     ├── [VRF]
                    │     └── [GERADOR]
                    └── <iframe src="URL_da_aba_ativa">
```

---

## 2. Asset no ThingsBoard

| Campo        | Valor                          |
|--------------|-------------------------------|
| Asset Name   | `MelicidadeAsset`             |
| Label        | `(008)-Integrações`           |
| Tipo         | Asset (Ambiente BAS)          |
| Prefixo      | `008` → ícone `link` no menu  |

O prefixo `(008)` é mapeado para o ícone `link` em `AMBIENTE_ICON_MAP` no `controller.js`.
A label exata `(008)-Integrações` é a chave que aciona o handler especial em `AMBIENTE_ACTION_MAP`.

---

## 3. Fluxo de Navegação (controller.js)

```
MAIN_BAS/controller.js

1. onDataUpdated() → classifica assets → monta sidebar menu
2. Item "(008)-Integrações" → getAmbienteActionHandler() → AMBIENTE_ACTION_MAP['(008)-Integrações']
3. Handler chama:
     MyIOLibrary.openIntegrationsModal({
       theme: _settings?.themeMode || 'light',
       onClose: () => { _sidebarMenu.setActiveItem('dashboard'); }
     })
4. Também verificado em handleSidebarMenuNavigation() → handleAmbienteSelected()
   com guard: if (originalLabel === '(008)-Integrações') → openIntegrationsModal(...)
```

Arquivo: `src/thingsboard/bas-components/MAIN_BAS/controller.js`
- Linha ~1041: `AMBIENTE_ICON_MAP`
- Linha ~1122: `AMBIENTE_ACTION_MAP['(008)-Integrações']`
- Linha ~4148: `handleAmbienteSelected()` com guard especial

---

## 4. Componentes da Biblioteca

### Estrutura de arquivos

```
src/components/premium-modals/integrations/
  ├── index.ts                    ← barrel export
  ├── types.ts                    ← tipos + DEFAULT_INTEGRATION_TABS (URLs hardcoded)
  ├── openIntegrationsModal.ts    ← função pública exportada pela lib
  ├── IntegrationsModal.ts        ← controller (lifecycle, focus trap, ESC)
  └── IntegrationsModalView.ts    ← view (HTML, CSS, tabs, iframe)
```

Export público: `src/index.ts` linha ~1638
```typescript
export { openIntegrationsModal } from './components/premium-modals/integrations';
```

### IntegrationsModalOptions (types.ts)

```typescript
interface IntegrationsModalOptions {
  theme?: 'light' | 'dark';      // padrão: 'light'
  defaultTab?: IntegrationTabId;  // 'chiller' | 'vrf' | 'gerador'
  onClose?: () => void;
  onTabChange?: (tabId: IntegrationTabId) => void;
}
```

### IntegrationTab (types.ts)

```typescript
interface IntegrationTab {
  id: IntegrationTabId;   // identificador único
  label: string;          // texto da aba
  url: string;            // URL carregada no iframe
}
```

---

## 5. Plataforma: Niagara Framework (Tridium)

Os três sistemas externos são instâncias do **Niagara Framework** da Tridium — plataforma
BAS/SCADA amplamente usada em automação predial (HVAC, energia, segurança).

Cada URL aponta para uma **estação Niagara** independente rodando em servidor dedicado.
A interface web do Niagara é servida diretamente pelo servidor da estação e carregada
no `<iframe>` do modal MyIO.

### 5a. CHILLER — Niagara Framework (Tridium)

### O que aparece no iframe (tela de login Niagara)

```
┌─────────────────────────────────────┐
│  Mercado_Livre          (nome da    │  ← nome da estação Niagara configurado no servidor
│                          estação)   │
│  Username: [______________] [Login] │  ← autenticação gerenciada pelo Niagara
│                                     │
│  [⚠] Your Software Maintenance     │  ← AVISO CRÍTICO: licença de manutenção Niagara
│      Agreement has expired.         │    expirada (ver seção 13)
│                                     │
│  To connect using Niagara Web       │  ← alternativa via Java Web Launcher
│  Launcher click here                │    (requer JRE instalado no cliente)
└─────────────────────────────────────┘
```

> **Observação**: "Mercado_Livre" é o nome interno da estação Niagara (campo `Station Name`
> configurado no Niagara Workbench), não tem relação com a empresa Mercado Livre.

### 5b. VRF — Hitachi VRF Web UI

**Sistema**: Portal web proprietário da **Hitachi Air Conditioning** para gestão de sistemas
VRF (Variable Refrigerant Flow) — ar condicionado central com múltiplas unidades internas
e externas.

**Screenshot de referência:** `screenshot-integracao-vrf-melicidade-2026-04-16-15-49.png`

```
┌─────────────────────────────────────┐
│           HITACHI                   │  ← logo/marca do sistema
│                                     │
│  Username: [___________________]    │  ← autenticação própria Hitachi
│  Password: [___________________]    │
│           [🔑 Login]                │
└─────────────────────────────────────┘
```

**Características**:
- Interface web própria da Hitachi (não é Niagara)
- Autenticação com Username + Password (credenciais do sistema Hitachi, independentes do MyIO/TB)
- Sem aviso de licença expirada (sistema aparentemente com manutenção em dia)
- Página limpa e minimalista, carrega sem problemas no iframe

> **Atenção**: as credenciais de acesso ao sistema Hitachi VRF são gerenciadas
> diretamente pela equipe técnica da Melicidade — não há integração SSO com o ThingsBoard.

### 5c. GERADOR — ⚠️ Fora do Ar (502 Bad Gateway)

**Screenshot de referência:** `screenshot-integracao-gerador-melicidade-2026-04-16-15-45.png`

```
502 Bad Gateway
nginx/1.22.1
```

**Status**: servidor fora do ar em 16/04/2026 às 15:52.

**Diagnóstico**:
- O nginx (`nginx/1.22.1`) está respondendo — o servidor de proxy reverso está de pé
- O erro `502 Bad Gateway` significa que o nginx recebeu a requisição mas **não conseguiu
  alcançar o serviço upstream** (a aplicação real do GERADOR está parada ou inacessível)
- Não é problema de rede/DNS nem de bloqueio de iframe — o nginx responde normalmente

**Causa provável**: o serviço da aplicação (ex.: Niagara, SCADA ou sistema próprio do
gerador) travou, foi reiniciado, ou o servidor onde roda está desligado.

**Ação recomendada**: verificar junto à equipe de infraestrutura MyIO BAS o status do
servidor `melicidade3.myio-bas.com` — reiniciar o serviço upstream ou o servidor.

### URLs dos Sistemas Externos

Definidas em `src/components/premium-modals/integrations/types.ts` —
constante `DEFAULT_INTEGRATION_TABS`:

| Aba      | ID        | URL                                 | Plataforma             | Status (16/04/2026)              |
|----------|-----------|-------------------------------------|------------------------|----------------------------------|
| CHILLER  | `chiller` | `https://melicidade1.myio-bas.com/` | Niagara Framework      | ⚠️ Online — licença SMA expirada |
| VRF      | `vrf`     | `https://melicidade2.myio-bas.com/` | Hitachi VRF Web UI     | ✅ Online                        |
| GERADOR  | `gerador` | `https://melicidade3.myio-bas.com/` | nginx/1.22.1 (proxy)   | 🔴 502 Bad Gateway — upstream down |

---

## 6. Comportamento do iframe

- **Sandbox**: `allow-same-origin allow-scripts allow-forms allow-popups`
- **Loading**: `eager` (carrega imediatamente ao trocar de aba)
- **Transição**: spinner visível até o evento `load` do iframe disparar
- **Troca de aba**: `iframe.src` é substituído — não há cache entre abas
- **Tamanho**: ocupa 100% da área de conteúdo (modal 95 vw × 95 vh, descontando header + tabbar)

---

## 7. Comportamento do Modal

| Ação                        | Resultado                                      |
|-----------------------------|------------------------------------------------|
| Clique no backdrop          | Fecha o modal                                  |
| Botão `×` no header         | Fecha o modal                                  |
| Tecla `ESC`                 | Fecha o modal (gerenciado por `IntegrationsModal`) |
| Tab / Shift+Tab             | Focus trap dentro do modal                     |
| Fechar                      | `onClose()` → `_sidebarMenu.setActiveItem('dashboard')` |

---

## 8. Como Adicionar uma Nova Aba

**Passo 1** — Adicionar o novo ID ao tipo em `types.ts`:
```typescript
// Antes
export type IntegrationTabId = 'chiller' | 'vrf' | 'gerador';

// Depois
export type IntegrationTabId = 'chiller' | 'vrf' | 'gerador' | 'novaAba';
```

**Passo 2** — Adicionar a aba em `DEFAULT_INTEGRATION_TABS`:
```typescript
export const DEFAULT_INTEGRATION_TABS: IntegrationTab[] = [
  { id: 'chiller',  label: 'CHILLER',   url: 'https://melicidade1.myio-bas.com/' },
  { id: 'vrf',      label: 'VRF',       url: 'https://melicidade2.myio-bas.com/' },
  { id: 'gerador',  label: 'GERADOR',   url: 'https://melicidade3.myio-bas.com/' },
  { id: 'novaAba',  label: 'NOVA ABA',  url: 'https://melicidade4.myio-bas.com/' },
];
```

**Passo 3** — Fazer build e publicar a lib:
```bash
npm run build
npm version patch
npm run release
```

**Não é necessário** alterar o `controller.js` do MAIN_BAS para adicionar abas —
as abas são definidas inteiramente na biblioteca.

---

## 9. Como Alterar uma URL

Edite apenas `DEFAULT_INTEGRATION_TABS` em `types.ts`, faça build e republique.
O `controller.js` não precisa de alteração.

---

## 10. Dependências e Compatibilidade

| Componente                | Versão mínima | Observação                              |
|---------------------------|---------------|-----------------------------------------|
| `myio-js-library`         | `>= 0.1.xxx`  | `openIntegrationsModal` exportado       |
| MAIN_BAS controller.js    | RFC-0174+     | Chama `MyIOLibrary.openIntegrationsModal` |
| Navegador                 | Moderno       | Requer `iframe sandbox` + `backdrop-filter` |
| CORS / X-Frame-Options    | Configurado   | Servidores `melicidade*.myio-bas.com` devem permitir embedding |

---

## 11. Pontos de Atenção

- **X-Frame-Options / CSP**: os servidores externos precisam ter `X-Frame-Options: SAMEORIGIN`
  ou `Content-Security-Policy: frame-ancestors` configurados para permitir embedding no domínio
  do ThingsBoard. Se a URL recusar embedding, o iframe ficará em branco sem erro visível.

- **Autenticação no iframe**: cada sistema externo gerencia sua própria sessão. O iframe não
  recebe cookies ou tokens do ThingsBoard. Se o usuário não estiver logado no sistema externo,
  verá a tela de login dentro do iframe.

- **URLs hardcoded**: atualmente as URLs são fixas em `types.ts`. Se for necessário URLs
  dinâmicas por cliente/tenant, a próxima evolução seria receber `tabs` como parâmetro
  de `openIntegrationsModal()` — o `IntegrationsModalView` já suporta isso via
  `options.tabs` (campo opcional, com fallback para `DEFAULT_INTEGRATION_TABS`).

- **Troca de aba recarrega o iframe**: não há `keep-alive` entre abas. Ao voltar para
  uma aba já visitada, o sistema externo é recarregado do zero.

---

## 13. Aviso Crítico — Licença Niagara Expirada (observado em 16/04/2026)

A tela de login do CHILLER exibe o aviso:

> **"Your Software Maintenance Agreement has expired."**

### O que significa

O **Software Maintenance Agreement (SMA)** é a licença anual da Tridium que cobre:
- Atualizações de versão do Niagara Framework
- Suporte técnico Tridium
- Acesso ao portal de licenças

Quando o SMA expira, o Niagara continua funcionando normalmente para operação,
mas exibe o aviso no login e bloqueia upgrades de versão.

### Impacto atual

| Impacto                                | Nível    |
|----------------------------------------|----------|
| Sistema continua operando              | ✅ OK    |
| Login de usuários ainda funciona       | ✅ OK    |
| Atualização de versão Niagara bloqueada | ⚠️ Bloqueado |
| Suporte técnico Tridium indisponível   | ⚠️ Bloqueado |
| Aviso visível para todos os usuários   | ⚠️ Visível |

### Ação recomendada

Contato para renovação: **Tridium / distribuidor local autorizado**.
O SMA é renovado por estação Niagara. Com 3 estações (CHILLER, VRF, GERADOR)
cada uma pode ter contrato independente.

### Niagara Web Launcher (alternativa citada na tela)

A tela oferece "connect using Niagara Web Launcher" — é uma alternativa via
aplicativo Java (`.jnlp`) instalado na máquina do usuário. **Não é relevante para
a integração via iframe MyIO** — o acesso web direto pelo iframe continua funcionando.

---

## 12. RFC de Referência

| RFC      | Assunto                                              |
|----------|------------------------------------------------------|
| RFC-0174 | Integrations Modal — iFrame tabs para integrações externas |

Arquivo: `src/docs/rfcs/RFC-0174-*.md` (se existir)
