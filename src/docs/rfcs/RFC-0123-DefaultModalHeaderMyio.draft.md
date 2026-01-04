Aqui está a comparação:

src/utils/ModalHeader.ts (RFC-0121)

API: Objeto com metodos estaticos
ModalHeader.generateHTML({ icon, title, modalId, ... })
ModalHeader.createController({ modalId, onClose, ... })

Features: Icon, Title, Theme toggle, Maximize, Close

Usado por:

- TemperatureModal.ts
- MenuView.ts (filter modal do Menu)
- TelemetryGrid filter modal (showcase)

---

src/components/ModalHeader/index.ts

API: Factory function que retorna instancia
const header = createModalHeader({ id, title, exportFormats, ... })
header.render()
header.attachListeners()
header.update({ theme, isMaximized })
header.destroy()

Features: Icon, Title, Theme toggle, Maximize, Close, + EXPORT BUTTON (CSV, XLS, PDF dropdown)

Usado por:

- createConsumptionModal.ts
- createConsumptionChartWidget.ts

---

Diferenca Principal

| Aspecto       | utils/ModalHeader | components/ModalHeader |
| ------------- | ----------------- | ---------------------- |
| Export button | NAO               | SIM (CSV, XLS, PDF)    |
| API           | Metodos estaticos | Factory + instance     |
| Complexidade  | Simples           | Mais completo          |
| Uso           | Modais simples    | Modais com exportacao  |

Conclusao: Sao complementares. O de components/ e para modais que precisam de botao de exportacao (graficos/relatorios). O de utils/ e para modais simples (filtros, configuracoes).
