@/src\components\premium-modals\welcome\WelcomeModalView.ts

```
            <h1 class="myio-welcome-hero-title" id="welcomeHeroTitle">${heroTitle}</h1>

```

verifique se heroTitle é parametrizável para termos cor em dark e light mode, é necessário que tenha essa flexibilidade bem como heroDescription e ctaLabel e também
@/src\components\premium-modals\welcome\WelcomeModalView.ts

```
            <h2 class="myio-welcome-shortcuts-title">Acesso Rápido aos Shoppings</h2>

```

ou seja, tudo mapeado no settingsSchema.json da nova MAIN e passando no config da chamada da modal em openWelcomeModal
