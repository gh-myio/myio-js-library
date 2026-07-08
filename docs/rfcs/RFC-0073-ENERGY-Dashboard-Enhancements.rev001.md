Excelente — o RFC-0073: ENERGY Dashboard Enhancements também está completo e bem estruturado.
Ele cobre todos os 6 pontos do seu draft original (gráfico, modal premium, labels, layout, classificação e filtro de pico) com uma implementação sólida e testável.

Segue a revisão técnica e editorial para deixar o documento pronto para aprovação interna e commit:

🧩 Pontos fortes

Abordagem modular, detalhando código, template e CSS para cada problema.

Fluxo de API coerente com /totals do ThingsBoard e lógica de agregação multi-shopping.

Modal de configuração “premium” bem especificado (já segue o padrão dos widgets MYIO-SIM).

Cobertura de testes (unit, integration, manual) completa e coerente.

Clareza visual nas seções (Guide-level → Reference-level → Implementation Plan).

🧹 Recomendações de melhoria
🔸 1. Status

O escopo está consolidado; altere de Draft para Proposed:

- **Status**: Proposed

🔸 2. Título

Deixe o nome mais alinhado com a linguagem dos outros RFCs:

# RFC-0073: ENERGY Widget – Dashboard Functionality and UX Enhancements

🔸 3. Sumário mais direto

Sugestão de reformulação:

This RFC enhances the ENERGY widget by enabling accurate 7-day consumption visualization, introducing a configuration modal, refining percentage insights, improving layout stability, fixing classification logic, and ensuring shopping filter consistency across all energy metrics.

🔸 4. Motivation — origem dos achados

Adicione:

These issues were observed during QA of MYIO-SIM/V1.0.0/ENERGY, where discrepancies were found between UI behavior and API data retrieved from the /totals endpoint of the ThingsBoard integration.

🔸 5. Implementation Details — destacar paths

Logo no início da seção:

All changes are located under
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\ENERGY

🔸 6. Drawbacks — incluir cache

Caching Trade-off: Client-side caching of daily calls may desync with real-time readings if not refreshed properly.

🔸 7. Success Metrics — mais uma métrica de precisão

7-day chart numerical deviation ≤ 1% compared to direct ThingsBoard reports

🔸 8. Future Possibilities — integração com widgets correlatos

Adicionar:

7. Unified Energy Engine: Share consumption logic with EQUIPMENTS and WATER widgets for cross-utility comparisons.

✅ Versão sugerida de heading e metadados finais
# RFC-0073: ENERGY Widget – Dashboard Functionality and UX Enhancements

- **Feature Name**: `energy-dashboard-enhancements`
- **Start Date**: 2025-01-10
- **RFC PR**: #0073
- **Status**: Proposed
- **Component**: `MYIO-SIM/V1.0.0/ENERGY`
