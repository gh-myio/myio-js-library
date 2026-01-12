em annotations

use esse padrão para a lupa de pesquisa e o ícone do filtro

@/src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY\template.html

```
      <button class="icon-btn" id="btnSearch" title="Buscar" aria-label="Buscar">
        <!-- Lupa -->
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5z"
          />
        </svg>
      </button>

      <button class="icon-btn" id="btnFilter" title="Filtros" aria-label="Filtros">
        <!-- Funil -->
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
        </svg>
      </button>
```

e ajuste para que só se clicar na lupa mostra o campo do input para digitação

na modal de filtro

aumente o height, pois por exemplo ao clicar nas opções de Importãncia está cortando a exibição do zindex.
remova o label PREMIUM do header
as opções de filtros, status, importância e período não estão alinhadas.

o botão (+) deve ser nova anotação +
