# Engenharia de Dispositivos

> Categoria do WIKI interno MyIO. Reúne hardware, firmware, OTA, provisionamento
> e certificação dos dispositivos de campo (centrais / gateways IoT).
>
> Complementa — sem sobrepor — as categorias de aplicação (`myio-js-library`,
> dashboards, app mobile). Aqui mora tudo abaixo da camada de software de produto.
>
> Atualizado: 2026-05-19.

---

## O que é esta categoria

**Engenharia de Dispositivos** é onde a MyIO documenta a camada física da
plataforma: a **central / gateway IoT** que fica instalada em campo (shoppings,
indústrias, condomínios), coleta telemetria de energia, água e temperatura, e
envia para a nuvem.

Aqui mora tudo **abaixo** do software de produto: a placa, o firmware Linux, a
atualização remota (OTA), o processo de fabricação e a certificação. As
categorias de aplicação (dashboards, app mobile, `myio-js-library`) ficam
**acima** desta camada e a consomem.

O projeto-âncora atual é a **Central MyIO 2.0** — a nova geração de hardware que
substitui a central legada baseada em Orange Pi Zero.

## Comece por aqui

Trilha de leitura recomendada para quem está chegando:

1. **[mapa-mental-meta-myio-monorepo.md](mapa-mental-meta-myio-monorepo.md)** —
   entenda a arquitetura: como o firmware (`meta-myio`) e os apps (`monorepo`)
   se encaixam no dispositivo.
2. **[bom-completo-central-myio-2-0.md](bom-completo-central-myio-2-0.md)** — a
   lista de componentes da Central 2.0 e as opções de fornecedor.
3. **[parecer-bom-central-myio-2-0-v1.md](parecer-bom-central-myio-2-0-v1.md)** —
   a análise crítica do BOM: o que está pronto e o que falta resolver.

## Estado atual do projeto

| Item | Situação |
|---|---|
| Fase | **PoC** — definição de hardware e validação de plataforma |
| Decisão de SBC | RPi 4 4GB para PoC (5–10 un.); CM4 para produção em escala |
| BOM | v1 concluído; aguarda **v2** antes de fechar lote de produção |
| Bloqueios para produção | 7 ressalvas do parecer v1 — térmica, storage×OTA, identidade de hardware (ver §4 do parecer) |
| Próximo marco | Montagem da primeira unidade PoC + v2 do BOM |

---

## Visão Geral

| Documento | Descrição | Status |
|---|---|---|
| [mapa-mental-meta-myio-monorepo.md](mapa-mental-meta-myio-monorepo.md) | Arquitetura dos repos `meta-myio` (Yocto/firmware) e `monorepo` (apps cloud+gateway) e como se conectam | Ativo |

---

## Hardware

### BOM & Componentes

| Documento | Descrição | Status |
|---|---|---|
| [bom-completo-central-myio-2-0.md](bom-completo-central-myio-2-0.md) | Bill of Materials da Central MyIO 2.0 — 3 opções reais por item, links e preços | Ativo |

### Pareceres Técnicos

| Documento | Descrição | Status |
|---|---|---|
| [parecer-bom-central-myio-2-0-v1.md](parecer-bom-central-myio-2-0-v1.md) | Análise crítica do BOM 2.0 sob ótica IoT/DevOps — APROVADO COM RESSALVAS | v1 |

### Inventário (legado)

| Documento | Descrição | Status |
|---|---|---|
| inventario-central-atual.md | Inventário físico da central atual (Orange Pi Zero) | A criar |

### Comparativos de SBC

| Documento | Descrição | Status |
|---|---|---|
| comparativo-cm4-rpi-vs-orangepi.md | Comparativo técnico CM4 vs RPi 4 vs Orange Pi | A criar |
| hardware-central-myio.md | Especificação consolidada de hardware da central | A criar |

---

## Firmware & OTA

Imagem Linux Yocto, build via KAS, atualização OTA via Mender (repo `meta-myio`).

| Tópico | Descrição | Status |
|---|---|---|
| Build Yocto / KAS | `kas/base.yml` + `kas/debug.yml`, kas-container | A documentar |
| OTA Mender (A/B) | Particionamento dual-rootfs, fluxo `mender -install` / `commit` | A documentar |
| Recipes `meta-myio-core` | `myio-api`, `erlradio`, `yggdrasil`, `timescaledb`, etc. | A documentar |

---

## Provisionamento & Fleet

| Tópico | Descrição | Status |
|---|---|---|
| Gravação inicial eMMC | `rpiboot` (CM4), fixture de linha | A documentar |
| Injeção de identidade | `CLOUD_REGISTER_JWT`, registro em `server.myio.com.br/central` | A documentar |
| QA de linha | Teste funcional 4G / NRF24 / RTC / antena por unidade | A documentar |

---

## Certificação

| Tópico | Descrição | Status |
|---|---|---|
| Anatel — módulos | Homologação de modem (EG25-G, SIM7600G-H) e rádios | A documentar |
| Anatel — produto final | Necessidade de homologar a central montada | A verificar |

---

## Apresentações

| Documento | Descrição | Status |
|---|---|---|
| apresentacao-centrais-novas/ | Apresentação executiva das centrais MyIO 2.0 | A criar |

---

## Convenções desta categoria

- **Pareceres** seguem versionamento explícito: `parecer-<assunto>-vN.md`.
- **BOMs** seguem `bom-<assunto>-<versão-produto>.md`.
- Documentos `A criar` / `A documentar` são referenciados aqui antes de existir,
  para marcar o backlog da categoria.
- Severidade em pareceres/análises: `[ALTA]` / `[MÉDIA]` / `[BAIXA]`.
