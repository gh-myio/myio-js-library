# Mapa Mental — `meta-myio` & `monorepo`

> Visão de arquitetura IoT/DevOps dos dois projetos centrais da MyIO.
> Gerado em 2026-05-19.

## `meta-myio` — Yocto / Embedded (camada de firmware)

**Stack**: Yocto + KAS + Mender (OTA) — imagem Linux para gateways IoT MyIO
(target Orange Pi Zero, etc.).

- `meta-myio-core/` — camada BitBake com recipes:
  - `recipes-myio/` → `myio`, `myio-api`, `myio-backup`, `myio-hkbridge`,
    `myio-inventory`, `myio-metadata`, `myio-services`, `yggdrasil`, `state-scripts`
  - `recipes-dbs/` → `postgresql`, `timescaledb`
  - `recipes-bsp/`, `recipes-kernel/`, `recipes-connectivity/`,
    `recipes-mender/` (OTA), `recipes-core/`, `recipes-support/`
- `kas/base.yml` + `kas/debug.yml` — orquestração de build via kas-container (docker/podman)
- `scripts/kas-container` — wrapper para build
- Fluxo OTA: build imagem `.mender` → serve via PHP → `mender -install <url>` → `mender commit`
- Auth bootstrap: `CLOUD_REGISTER_JWT` + `CLOUD_REGISTER_URL=https://server.myio.com.br/central`

## `monorepo` — Plataforma IoT (cloud + gateway apps)

**Stack**: Nix flakes + Nx + Yarn workspaces, multi-linguagem
(Node 22, Erlang R24, Elixir 1.13, Go NIFs).

### Gateway side (`gateways/`)
- `api/` — Node-RED + Node.js (porta 1880), migrations Postgres, scheduler
- `erlradio/` — Elixir/Phoenix umbrella, NIFs C, simulator de devices, WebSocket client
- `nodered-nodes/` — 23 nodes Node-RED consolidados em 1 package
- `exporter/`, `myio-backup/`

### Cloud side (`cloud/`)
- `backend/` — Express OAuth2 provider (porta 3000), migrations próprias
- `cloud-server/` — Erlang central coordination (porta 4000)
- `app/` — React Native + Expo (Android + Dockerfile.web), CDK, Crowdin i18n
- `myio-app/` — server.js standalone com docker-compose
- Deploy: `DOKPLOY_DEPLOYMENT.md` (Dokploy)

### DevOps
- `docker/docker-compose.yml` + `.dev.yml` (Postgres + TimescaleDB + serviços)
- `nx.json` — affected detection, cache, paralelismo até 3 tasks
- `flake.nix` raiz unifica Node 22 + Erlang R24 + Elixir 1.13 (pinned do nixpkgs antigo) + Python/mkdocs
- CI: GitLab CI (prepare → lint → test → build → docker), Sonar (`sonar-project.properties` no backend)
- `mkdocs.yml` + `docs/` (RFCs, architecture, websocket tunnel)

## Como os dois se conectam

```
[gateway físico Orange Pi]
   └── imagem Yocto built em meta-myio
        └── roda artefatos do monorepo (myio-api, erlradio, etc.) empacotados via recipes-myio
             └── OTA gerenciado por Mender, registro inicial em server.myio.com.br/central
                  └── conecta no cloud-server (Erlang) + backend (OAuth2) do monorepo
```

- `meta-myio` = **como o firmware do gateway é construído e atualizado**.
- `monorepo` = **o que roda nele + na nuvem**.
