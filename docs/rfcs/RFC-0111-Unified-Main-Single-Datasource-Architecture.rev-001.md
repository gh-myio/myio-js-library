veja que temos agora o RFC

- 112 - welcome
  será carregado no oninit da nova main src\MYIO-SIM\v5.2.0\MAIN_UNIQUE_DATASOURCE

- 113 - header
  será trocado isso
  @/src\MYIO-SIM\v5.2.0\MAIN\template.html

```
<section style="height: 145px; min-height: 145px; max-height: 145px; overflow: none; background: transparent">
  <tb-dashboard-state class="content" [ctx]="ctx" stateId="header"></tb-dashboard-state>
</section>
```

por chamada da lib

114 - menu
será trocado isso

@/src\MYIO-SIM\v5.2.0\MAIN\template.html

```
<section style="height: 80px; min-height: 80px; max-height: 80px; overflow: hidden; background: transparent">
  <tb-dashboard-state class="content" [ctx]="ctx" stateId="menu"></tb-dashboard-state>
</section>
```

por chamada da lib

115 - footer
será trocado isso

@/src\MYIO-SIM\v5.2.0\MAIN\template.html

```
<!-- RFC-0058: Footer with device selection and comparison -->
<section>
  <tb-dashboard-state [ctx]="ctx" stateId="footer"></tb-dashboard-state>
</section>
```

por chamada da lib
