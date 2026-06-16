# Parecer Técnico v1 — BOM Central MyIO 2.0

> Análise crítica do documento [bom-completo-central-myio-2-0.md](bom-completo-central-myio-2-0.md),
> sob ótica de **IoT / DevOps / fleet management** (firmware Yocto + OTA Mender,
> stack `meta-myio` + `monorepo`).
>
> Versão: **v1** — primeira passada. Autor: Rodrigo Lago.
> Data: 2026-05-19.

---

## 1. Veredito resumido

O BOM está **maduro, rastreável e bem estruturado**: mapeamento exaustivo
central-atual → central-nova (seção A), 3 opções reais por item, links diretos,
e honestidade sobre preços não confirmados (`[verificar]`). É um documento de
**compras** sólido.

Como **especificação de engenharia para uma frota IoT gerenciada por OTA**,
porém, ele tem **lacunas relevantes** — descritas na seção 4. O BOM responde
"o que comprar"; ainda não responde "isso sobrevive em campo e escala?".

**Classificação geral: APROVADO COM RESSALVAS.** Pode seguir para PoC; precisa
de uma v2 antes de fechar lote de produção.

---

## 2. Pontos fortes

- **Seção A (mapeamento 1:1)** é o maior acerto: garante que nenhum componente
  da central atual fica órfão. Ótimo controle de escopo.
- **Triagem honesta do dual-SIM** (seção 4 do BOM): reconhece que HATs retail
  são single-SIM e recomenda PoC single-SIM + upgrade fase 2. Decisão correta.
- **Escolha de fonte** (Mean Well RS-25/RS-50) elimina a causa-raiz documentada
  de reboot (fonte chinesa 5V/2A). Item 14 da seção A é o fix mais importante.
- **RTC DS3231** cobre uma lacuna real (central atual é NTP-only) — crítico para
  timestamps de telemetria quando a conectividade celular cai.
- **Resumo executivo (seção D)** com critério de decisão CM4 vs RPi4 por fase
  (PoC vs escala) é pragmático e bem fundamentado.

---

## 3. Análise por subsistema

| Subsistema        | Avaliação   | Comentário                                                                  |
| ----------------- | ----------- | --------------------------------------------------------------------------- |
| SBC (CM4 vs RPi4) | OK          | CM4 é a escolha industrial correta a longo prazo; RPi4 p/ PoC é defensável. |
| Storage           | **Atenção** | Ver §4.2 — impacto direto em OTA/Mender.                                    |
| Conectividade 4G  | OK          | Single-SIM no PoC bem justificado.                                          |
| Rádio NRF24L01+   | **Atenção** | Ver §4.3 — manter reduz risco de migração, mas é grau hobby.                |
| Alimentação       | Bom         | Mean Well resolve o problema crônico.                                       |
| RTC               | Bom         | DS3231 + bateria adequado.                                                  |
| Refrigeração      | **Atenção** | Ver §4.1 — faixa térmica não tratada.                                       |
| Caixa/mecânica    | OK          | Hammond DIN-rail adequado para painel elétrico.                             |
| Cabos/fixação     | OK          | Completo.                                                                   |

---

## 4. Lacunas e riscos (ação requerida para v2)

### 4.1 — Faixa de temperatura industrial NÃO tratada `[ALTA]`

O BOM trata refrigeração (heatsink/fan) mas **não especifica faixa térmica de
operação**. CM4 e RPi4 padrão são **commercial grade (0–50 °C ambiente)**.
Centrais MyIO ficam em quadros elétricos, casas de máquinas, subsolos — onde a
temperatura interna do quadro passa fácil de 50 °C.

**Ação v2:** decidir explicitamente entre (a) aceitar derating/risco, (b) usar
SKUs industrial-temp quando existirem, (c) projetar gestão térmica do quadro.
O microSD industrial Apacer já é `-40/+85 °C` — bom; mas o SBC não.

### 4.2 — Storage vs estratégia de OTA (Mender / Yocto) `[ALTA]`

A central roda imagem Yocto com **Mender A/B (dual-partition)** — ver
`meta-myio/recipes-mender`. Isso muda a análise de storage:

- **eMMC (CM4)** — melhor caso. Particionamento A/B previsível, wear-leveling
  gerenciado, sem cartão para soltar em vibração. **Reforça a escolha CM4.**
- **microSD industrial pSLC** — aceitável, mas microSD é o ponto único de falha
  nº 1 de frotas RPi em campo. Mender em microSD funciona, mas o orçamento de
  escrita (rootfs A/B + `/data` + TimescaleDB on-device) acelera o desgaste.
- **Boot por SSD/USB (RPi4)** — **complica o layout Mender**. A opção "SSD A400
  240GB" no BOM precisa ser validada contra o layout de partições do Yocto antes
  de ser oferecida como equivalente.

**Ação v2:** adicionar uma linha "compatibilidade com layout Mender A/B" em
cada opção de storage. Quantificar TBW exigido por: rootfs OTA + logs +
retenção local de telemetria TimescaleDB.

### 4.3 — NRF24L01+ : decisão de manter precisa de justificativa explícita `[MÉDIA]`

Manter o NRF24L01+ minimiza risco de migração (a stack `erlradio`/`yggdrasil`
já fala com ele) — decisão defensável. Mas o parecer registra:

- NRF24L01+ **não tem criptografia/autenticação de hardware**; segurança fica
  100% na camada de aplicação.
- É um módulo de grau maker; variabilidade de qualidade entre lotes é alta
  (o BOM acerta ao recomendar PA+LNA com regulador 3.3V on-board).
- Não há item de **antena/coexistência 2.4 GHz** vs Wi-Fi on-board do SBC —
  ambos disputam a banda. Em PoC isso costuma passar; em escala, não.

**Ação v2:** declarar a decisão "manter NRF24" como **explícita e datada**, com
nota de que a substituição (LoRa/Zigbee, já listados como opcionais) é um item
de roadmap, não de BOM.

### 4.4 — Identidade de dispositivo / secure boot ausente `[ALTA]`

O fluxo de bootstrap usa `CLOUD_REGISTER_JWT` + registro em
`server.myio.com.br/central`, e a plataforma tem RBAC client-side
(`MyIOAuthContext`, RFC-0199). Nada disso é seguro se a identidade do device
não tiver raiz de confiança em hardware.

O BOM **não contempla**: secure element / TPM, fuses de secure boot, ou
proteção do JWT/credencial em repouso. Hoje o segredo de registro fica no
filesystem em claro.

**Ação v2:** avaliar (a) secure element I2C (ATECC608, ~USD 1) para device
identity + armazenamento de chave, ou (b) usar OTP fuses do BCM2711/2712 +
encryption do eMMC. Decisão de produto, mas precisa entrar no BOM.

### 4.5 — Proteção elétrica subdimensionada `[MÉDIA]`

Item 26 da seção A ("TVS/proteção surto") e item da seção 13 estão como
**opcionais**. Para instalação em quadro elétrico de shopping/indústria,
proteção contra surto/transiente **não é opcional** — é o que evita RMA em
massa após uma tempestade.

**Ação v2:** promover TVS + fusível + (idealmente) DPS classe II de
"opcional" para "obrigatório" na config de produção.

### 4.6 — Provisionamento em escala não orçado `[MÉDIA]`

A seção 12 cobre bancada (1×/lote), mas para 50–100+ unidades faltam:
fixture de gravação eMMC (`rpiboot`) paralelo, processo de injeção de
identidade/JWT, teste funcional automatizado de linha (4G/NRF24/RTC), QA de
antena. Isso é custo de **NRE/ferramental**, não de unidade — mas precisa
existir no plano.

**Ação v2:** seção "custo de industrialização" separada do custo por unidade.

### 4.7 — UPS / power-loss data integrity `[MÉDIA]`

UPS HAT está como opcional. Com **TimescaleDB rodando on-device**, queda de
energia sem shutdown gracioso = risco de corrupção de banco e de FS. O RTC
sobrevive (tem bateria), o banco não.

**Ação v2:** se há escrita de telemetria local persistente, UPS HAT (ou ao
menos supercapacitor para flush + shutdown) sobe para recomendado.

---

## 5. Observações de custo

- Os totais (seção C: ~USD 387 CM4 / ~USD 345 RPi4) são **custo de componente**,
  não **custo posto-no-Brasil**. A própria seção E reconhece frete (USD 30–80) +
  ~60% federal sobre CIF + ICMS. Para uma decisão de compra real, **o total
  relevante é o landed cost** — sugiro uma coluna "BRL landed" na v2.
- A faixa "tipicamente $X–Y" em itens `[verificar]` é adequada para estimativa,
  mas o anexo G (12 itens sem preço firme) precisa ser zerado antes de fechar
  lote. Itens de maior incerteza/impacto: CM4104032, carrier Waveshare,
  modem mPCIe.

---

## 6. Recomendações para a v2 do BOM

1. **Adicionar coluna de faixa térmica** por SKU de SBC e decidir a estratégia
   (§4.1).
2. **Adicionar critério "compatível com layout Mender A/B"** em cada opção de
   storage; quantificar TBW (§4.2).
3. **Registrar a decisão "manter NRF24" como explícita**, com nota de roadmap
   de substituição (§4.3).
4. **Incluir item de identidade de hardware** (secure element / secure boot) —
   alinhado a RFC-0199 (§4.4).
5. **Promover proteção elétrica (TVS/fusível/DPS) a obrigatória** na config de
   produção (§4.5).
6. **Criar seção de custo de industrialização/NRE** separada do custo unitário
   (§4.6).
7. **Reavaliar UPS** se houver persistência local de telemetria (§4.7).
8. **Adicionar coluna "BRL landed cost"** (componente + frete + impostos) (§5).
9. **Zerar o anexo G** (preços `[verificar]`) antes de qualquer ordem de compra.
10. **Validar a opção SSD do RPi4** contra o particionamento Yocto antes de
    mantê-la como equivalente de storage.

---

## 7. Conclusão

O BOM v1 é uma **boa base de compras** e está pronto para suportar a fase de
**PoC (5–10 unidades, RPi4)** conforme recomendado na seção D do próprio
documento. Para **produção em escala**, é necessária uma **v2 do BOM** que trate
as 7 lacunas da seção 4 — em especial faixa térmica, storage×OTA e identidade
de hardware, que são as três que mais geram retrabalho/RMA se descobertas em
campo.

Nenhuma das ressalvas bloqueia o início do PoC. Todas precisam estar resolvidas
antes do "go" de produção.

---

## Referências

- [bom-completo-central-myio-2-0.md](bom-completo-central-myio-2-0.md) — documento avaliado
- [inventario-central-atual.md](inventario-central-atual.md)
- [hardware-central-myio.md](hardware-central-myio.md)
- [comparativo-cm4-rpi-vs-orangepi.md](comparativo-cm4-rpi-vs-orangepi.md)
- [mapa-mental-meta-myio-monorepo.md](mapa-mental-meta-myio-monorepo.md) — contexto Yocto/OTA
