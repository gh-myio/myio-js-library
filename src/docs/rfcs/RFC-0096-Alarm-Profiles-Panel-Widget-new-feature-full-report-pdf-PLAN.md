# RFC-0096: Plano de Implementação - Exportação de Relatório PDF

## Visão Geral

O cliente deseja exportar um PDF completo e diagramado com as informações do painel de Alarm Profiles.

## Requisitos do Cliente

- Relatório PDF com layout profissional
- Modal para seleção do conteúdo a exportar
- Opções de exportação:
  - [ ] Device Profiles e Regras de Alarmes
  - [ ] Mapa de Devices
  - [ ] Lista de Alarmes

---

## Plano de Implementação

### Fase 1: Infraestrutura de Geração de PDF

**1.1 - Biblioteca de PDF**
- Usar **jsPDF** + **jspdf-autotable** (leve, sem dependências externas)
- Alternativa: **pdfmake** (mais recursos de layout)
- Injetar via CDN no widget ou bundle local

**1.2 - Estrutura Base do PDF**
```
┌─────────────────────────────────────────┐
│  [LOGO]     RELATÓRIO DE ALARMES        │
│             Data: DD/MM/YYYY HH:MM      │
│             Cliente: [Nome do Customer] │
├─────────────────────────────────────────┤
│  [Seção selecionada 1]                  │
├─────────────────────────────────────────┤
│  [Seção selecionada 2]                  │
├─────────────────────────────────────────┤
│  [Seção selecionada 3]                  │
└─────────────────────────────────────────┘
```

---

### Fase 2: Modal de Exportação

**2.1 - UI do Modal**
```
┌──────────────────────────────────────────┐
│  Exportar Relatório PDF              [X] │
├──────────────────────────────────────────┤
│                                          │
│  Selecione o conteúdo do relatório:      │
│                                          │
│  [✓] Device Profiles e Regras de Alarmes │
│      └─ Inclui: nome, descrição,         │
│         regras de criação/limpeza        │
│                                          │
│  [ ] Mapa de Devices                     │
│      └─ Tabela com todos os devices,     │
│         localização, status              │
│                                          │
│  [✓] Lista de Alarmes                    │
│      └─ Alarmes ativos/histórico         │
│         conforme filtros atuais          │
│                                          │
│  ─────────────────────────────────────   │
│  Opções adicionais:                      │
│                                          │
│  [ ] Incluir gráficos de resumo          │
│  [ ] Incluir timestamp detalhado         │
│                                          │
├──────────────────────────────────────────┤
│           [Cancelar]  [Gerar PDF]        │
└──────────────────────────────────────────┘
```

**2.2 - State para Export Modal**
```javascript
state.exportModal = {
  show: false,
  options: {
    deviceProfiles: true,
    deviceMap: false,
    alarmList: true,
    includeCharts: false,
    includeTimestamps: false
  },
  generating: false
}
```

---

### Fase 3: Conteúdo das Seções do PDF

**3.1 - Seção: Device Profiles e Regras de Alarmes**

| Perfil | Devices | Regras |
|--------|---------|--------|
| Obramax - Hidrômetros | 15 | 6 |

Para cada perfil:
```
[1 - Consumo máximo em 1h atingido]
  • Criação: CRITICAL
    - Quando telemetria "hourlyConsumption" >= atributo "maxHourlyConsumption"
    - Valor padrão: 0.0
    - Agenda: Sem agenda definida
  • Clear: não configurado

[2 - Consumo máximo da madrugada]
  • Criação: CRITICAL
    - Quando telemetria "hourlyConsumption" >= atributo "maxOvernightConsumption"
    - Agenda: Segunda a Domingo, 23:00 - 05:00 (America/Sao_Paulo)
  • Clear: não configurado
```

**3.2 - Seção: Mapa de Devices**

| Device | Label | Perfil | Localização | Severidade | Status | Último Alarme |
|--------|-------|--------|-------------|------------|--------|---------------|
| Hidrômetro 01 | Entrada | Hidrômetros | Bloco A | CRITICAL | ACTIVE | 05/12/2024 14:30 |
| Bomba Diesel 1 | - | Falha Bomba | Subsolo | NONE | NORMAL | - |

**3.3 - Seção: Lista de Alarmes**

| # | Device | Tipo do Alarme | Severidade | Status | Início | Duração |
|---|--------|----------------|------------|--------|--------|---------|
| 1 | Hidrômetro 01 | Consumo máximo em 1h | CRITICAL | ACTIVE | 05/12 14:30 | 2h 15m |
| 2 | Hidrômetro 03 | Consumo acima da média | MAJOR | ACK | 05/12 10:00 | 6h 45m |

---

### Fase 4: Implementação Técnica

**4.1 - Arquivos a modificar**
```
controller.js
├── Adicionar state.exportModal
├── Adicionar função renderExportModal()
├── Adicionar função generatePDF()
├── Adicionar funções de formatação para PDF
├── Adicionar métodos no window.AlarmPanel
└── Adicionar CSS para modal de exportação
```

**4.2 - Funções principais**

```javascript
// Renderizar modal de exportação
function renderExportModal() { ... }

// Gerar PDF com jsPDF
function generatePDF() {
  var doc = new jsPDF();

  // Header
  addPDFHeader(doc);

  // Seções conforme seleção
  if (state.exportModal.options.deviceProfiles) {
    addDeviceProfilesSection(doc);
  }
  if (state.exportModal.options.deviceMap) {
    addDeviceMapSection(doc);
  }
  if (state.exportModal.options.alarmList) {
    addAlarmListSection(doc);
  }

  // Footer
  addPDFFooter(doc);

  // Download
  doc.save('relatorio-alarmes-' + formatDateForFilename() + '.pdf');
}

// Seções individuais
function addPDFHeader(doc) { ... }
function addDeviceProfilesSection(doc) { ... }
function addDeviceMapSection(doc) { ... }
function addAlarmListSection(doc) { ... }
function addPDFFooter(doc) { ... }
```

**4.3 - Métodos do AlarmPanel**
```javascript
window.AlarmPanel = {
  // ... existing methods ...

  // Export Modal
  openExportModal: function() { ... },
  closeExportModal: function() { ... },
  toggleExportOption: function(option) { ... },
  generatePDF: function() { ... }
};
```

---

### Fase 5: UI/UX

**5.1 - Botão de Exportação**
- Adicionar botão "Exportar PDF" no header do widget
- Ícone de documento/download
- Posição: ao lado do botão "Refresh"

**5.2 - Feedback durante geração**
- Mostrar loading spinner durante geração
- Mensagem de sucesso após download
- Tratamento de erros

**5.3 - Responsividade**
- Modal responsivo para diferentes tamanhos de tela
- PDF com margens adequadas para impressão

---

### Fase 6: Testes e Validação

**6.1 - Casos de teste**
- [ ] Gerar PDF apenas com Device Profiles
- [ ] Gerar PDF apenas com Mapa de Devices
- [ ] Gerar PDF apenas com Lista de Alarmes
- [ ] Gerar PDF com todas as opções
- [ ] Gerar PDF sem nenhum dado (lista vazia)
- [ ] Verificar formatação em português
- [ ] Verificar quebra de página para muitos dados
- [ ] Testar em diferentes navegadores

---

## Ordem de Implementação

1. **Sprint 1**: Infraestrutura
   - Integrar jsPDF no widget
   - Criar modal básico de exportação
   - Implementar estrutura base do PDF (header/footer)

2. **Sprint 2**: Seções do PDF
   - Implementar seção Device Profiles
   - Implementar seção Mapa de Devices
   - Implementar seção Lista de Alarmes

3. **Sprint 3**: Polish
   - Adicionar opções extras (gráficos, timestamps)
   - Melhorar layout e formatação
   - Testes e ajustes finais

---

## Dependências Externas

```html
<!-- jsPDF -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

<!-- jsPDF AutoTable (para tabelas) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js"></script>
```

Ou carregar dinamicamente no onInit:
```javascript
function loadPDFLibrary() {
  return new Promise(function(resolve, reject) {
    if (window.jspdf) return resolve();

    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = function() {
      var autoTable = document.createElement('script');
      autoTable.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js';
      autoTable.onload = resolve;
      autoTable.onerror = reject;
      document.head.appendChild(autoTable);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
```

---

## Estimativa de Esforço

| Fase | Descrição | Complexidade |
|------|-----------|--------------|
| 1 | Infraestrutura PDF | Média |
| 2 | Modal de Exportação | Baixa |
| 3 | Seção Device Profiles | Média |
| 4 | Seção Mapa de Devices | Baixa |
| 5 | Seção Lista de Alarmes | Baixa |
| 6 | Polish e Testes | Média |

---

## Próximos Passos

1. Revisar e aprovar este plano
2. Confirmar biblioteca de PDF (jsPDF vs pdfmake)
3. Definir layout visual do PDF (cores, logo, fontes)
4. Iniciar implementação da Fase 1
