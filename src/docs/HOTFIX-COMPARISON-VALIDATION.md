# HOTFIX: Comparison Validation Error

## 🐛 Problema

**Erro**: `"deviceId is required"` ao clicar em "Comparar" no footer

**Causa**: A biblioteca no unpkg (`https://unpkg.com/myio-js-library@0.1.100/dist/myio-js-library.umd.min.js`) ainda contém a validação antiga que não suporta modo comparison.

**Data**: 2025-10-17

---

## ✅ Solução Implementada (Local)

A validação já foi corrigida no código-fonte em:
- `src/components/premium-modals/energy/utils.ts` (linhas 8-51)
- Biblioteca compilada em: `dist/myio-js-library.umd.min.js`

### Validação Corrigida

```typescript
export function validateOptions(options: OpenDashboardPopupEnergyOptions): void {
  const mode = options.mode || 'single';

  // MODE-SPECIFIC VALIDATION
  if (mode === 'single') {
    if (!options.tbJwtToken) {
      throw new Error('tbJwtToken is required for ThingsBoard API access in single mode');
    }
    if (!options.deviceId) {
      throw new Error('deviceId is required for single mode');
    }
  } else if (mode === 'comparison') {
    if (!options.dataSources || options.dataSources.length === 0) {
      throw new Error('dataSources is required for comparison mode');
    }
    if (!options.granularity) {
      throw new Error('granularity is required for comparison mode');
    }
  }

  // ... resto da validação
}
```

---

## 🚀 Como Usar a Versão Corrigida

### Opção 1: Usar Arquivo Local (RECOMENDADO para teste)

1. **Copie o arquivo compilado**:
   ```bash
   # De:
   C:\Projetos\GitHub\myio\myio-js-library-PROD.git\dist\myio-js-library.umd.min.js

   # Para algum servidor web acessível pelo ThingsBoard
   ```

2. **Atualize o Resource no ThingsBoard**:
   - Widget Settings > Resources
   - Remova o resource do unpkg
   - Adicione o caminho local/servidor:
     ```
     http://seu-servidor/myio-js-library.umd.min.js
     ```

### Opção 2: Publicar no NPM (Para produção)

#### Passo 1: Atualizar Versão

```bash
# Bump version patch (0.1.100 -> 0.1.101)
npm version patch
```

#### Passo 2: Publicar no NPM

```bash
# Login no NPM (se necessário)
npm login

# Publicar
npm publish --access public
```

#### Passo 3: Atualizar ThingsBoard

No widget, atualizar o Resource para:
```
https://unpkg.com/myio-js-library@0.1.101/dist/myio-js-library.umd.min.js
```

### Opção 3: Usar CDN Customizado

Se você tem um CDN próprio:

1. **Upload do arquivo**:
   ```bash
   # Upload para seu CDN
   aws s3 cp dist/myio-js-library.umd.min.js s3://seu-bucket/libs/
   ```

2. **Atualizar Resource**:
   ```
   https://seu-cdn.com/libs/myio-js-library.umd.min.js
   ```

---

## 🧪 Testar Localmente Primeiro

### Via File:// Protocol (Teste Rápido)

```html
<!-- No ThingsBoard Resource -->
<script src="file:///C:/Projetos/GitHub/myio/myio-js-library-PROD.git/dist/myio-js-library.umd.min.js"></script>
```

⚠️ **NOTA**: Pode não funcionar devido a CORS. Use servidor local.

### Via Servidor Local (Melhor para teste)

```bash
# Opção 1: Python
cd C:\Projetos\GitHub\myio\myio-js-library-PROD.git\dist
python -m http.server 8000

# Opção 2: NPM http-server
npx http-server dist -p 8000

# No ThingsBoard Resource:
# http://localhost:8000/myio-js-library.umd.min.js
```

---

## 📋 Checklist de Validação

Após atualizar a biblioteca, teste:

### 1. Single Mode (Não deve quebrar)
```javascript
MyIOLibrary.openDashboardPopupEnergy({
  deviceId: 'device-123',
  tbJwtToken: 'token',
  startDate: '2025-10-01',
  endDate: '2025-10-17',
  clientId: 'id',
  clientSecret: 'secret'
});
// ✅ Deve funcionar normalmente
```

### 2. Comparison Mode (Deve funcionar agora)
```javascript
MyIOLibrary.openDashboardPopupEnergy({
  mode: 'comparison',
  dataSources: [
    { type: 'device', id: 'ing-1', label: 'Device A' },
    { type: 'device', id: 'ing-2', label: 'Device B' }
  ],
  startDate: '2025-10-01',
  endDate: '2025-10-17',
  granularity: '1d',
  clientId: 'mestreal_mfh4e642_4flnuh',
  clientSecret: 'gv0zfmdekNxYA296OcqFrnBAVU4PhbUBhBwNlMCamk2oXDHeXJqu1K6YtpVOZ5da'
});
// ✅ Não deve dar erro "deviceId is required"
```

### 3. Validation Errors (Devem funcionar corretamente)
```javascript
// Missing dataSources
try {
  MyIOLibrary.openDashboardPopupEnergy({
    mode: 'comparison',
    startDate: '2025-10-01',
    endDate: '2025-10-17',
    granularity: '1d',
    clientId: 'id',
    clientSecret: 'secret'
  });
} catch (e) {
  console.log(e.message);
  // ✅ "dataSources is required for comparison mode"
}

// Missing granularity
try {
  MyIOLibrary.openDashboardPopupEnergy({
    mode: 'comparison',
    dataSources: [{ type: 'device', id: '1', label: 'A' }],
    startDate: '2025-10-01',
    endDate: '2025-10-17',
    clientId: 'id',
    clientSecret: 'secret'
  });
} catch (e) {
  console.log(e.message);
  // ✅ "granularity is required for comparison mode"
}
```

---

## 🔍 Debug: Como Verificar a Versão

No console do navegador:

```javascript
// Verifica se a biblioteca foi carregada
console.log('MyIOLibrary:', window.MyIOLibrary);

// Tenta abrir modal em modo comparison
try {
  MyIOLibrary.openDashboardPopupEnergy({
    mode: 'comparison',
    dataSources: [{ type: 'device', id: '1', label: 'Test' }],
    startDate: '2025-10-01',
    endDate: '2025-10-17',
    granularity: '1d',
    clientId: 'test',
    clientSecret: 'test'
  });
} catch (error) {
  console.log('Error:', error.message);

  // Se o erro for "deviceId is required" → versão antiga
  // Se o erro for válido (dataSources, granularity) → versão nova ✅
}
```

---

## 📦 Arquivos Gerados (Build Atual)

### Localização
```
dist/
├── index.js               (410.13 KB) - ESM
├── index.cjs              (414.27 KB) - CJS
├── index.d.ts             (51.69 KB)  - Types
├── index.d.cts            (51.69 KB)  - Types CJS
├── myio-js-library.umd.js              - UMD (desenvolvimento)
└── myio-js-library.umd.min.js          - UMD (produção) ← USE ESTE
```

### Hash do Arquivo (Para verificar)
```bash
# Windows
certutil -hashfile "dist/myio-js-library.umd.min.js" SHA256

# Linux/Mac
sha256sum dist/myio-js-library.umd.min.js
```

---

## 🚨 Solução Temporária (Até Publicar)

Se não puder publicar agora, adicione isto no FOOTER controller ANTES de chamar `openDashboardPopupEnergy`:

```javascript
// WORKAROUND: Bypass validation temporariamente
const originalValidate = MyIOLibrary.openDashboardPopupEnergy;
MyIOLibrary.openDashboardPopupEnergy = function(options) {
  // Remove deviceId validation for comparison mode
  if (options.mode === 'comparison') {
    delete options.deviceId; // Remove se existir
  }
  return originalValidate.call(this, options);
};
```

⚠️ **NÃO RECOMENDADO** - Use apenas para teste imediato!

---

## ✅ Resolução Permanente

### Passo a Passo Completo

1. **Build Local** (✅ Já feito)
   ```bash
   npm run build
   ```

2. **Testar Local**
   ```bash
   npx http-server dist -p 8000
   # ThingsBoard Resource: http://localhost:8000/myio-js-library.umd.min.js
   ```

3. **Publicar NPM**
   ```bash
   npm version patch  # 0.1.100 -> 0.1.101
   npm publish --access public
   ```

4. **Atualizar ThingsBoard**
   ```
   https://unpkg.com/myio-js-library@0.1.101/dist/myio-js-library.umd.min.js
   ```

5. **Validar**
   - Testar single mode
   - Testar comparison mode
   - Verificar erros de validação

---

## 📝 Notas Importantes

1. **Cache do unpkg**: Pode levar alguns minutos para atualizar após publish
2. **Cache do navegador**: Limpe o cache após atualizar (Ctrl+Shift+R)
3. **ThingsBoard cache**: Pode ser necessário recarregar o dashboard
4. **Versão**: Sempre especifique a versão exata no unpkg (`@0.1.101`, não `@latest`)

---

## 🎯 Status Atual

- [x] Código corrigido em `utils.ts`
- [x] Biblioteca compilada localmente
- [x] Build bem-sucedido
- [ ] Publicado no NPM (pendente)
- [ ] ThingsBoard atualizado (pendente)
- [ ] Teste em produção (pendente)

---

**Próximos Passos**:
1. Testar localmente com servidor HTTP
2. Publicar no NPM (bump para 0.1.101)
3. Atualizar Resource no ThingsBoard
4. Validar funcionamento completo

---

**Implementado por**: Claude Code
**Data**: 2025-10-17
**Build**: ✅ Completo
**NPM Publish**: ⏳ Pendente
