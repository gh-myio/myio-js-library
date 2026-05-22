# BOM completo — Central MyIO 2.0 (com links reais e 3 opcoes por item)

> Bill of Materials das duas configuracoes propostas para a nova geracao da
> central MyIO. **Cada item tem 3 opcoes reais de fornecedor com link direto
> e preco verificado** (Mouser, DigiKey, Waveshare, Sixfab, Adafruit,
> Raspberry Pi oficial, fornecedores BR).
>
> **Premissa:** mapear **todos** os componentes da central atual
> (ver [inventario-central-atual.md](inventario-central-atual.md)) para a
> nova plataforma — nenhum item da central atual fica sem equivalente.
>
> **Cambio usado:** USD 1 = BRL 5.50 (maio/2026, atualizar antes de fechar
> compra). Precos em USD sao **confirmados via WebFetch** nos sites; precos
> em BRL nos sellers brasileiros sao do site direto ou estimativa quando
> o site bloqueia crawler (marcados como `[verificar]`).
>
> Atualizado: 2026-05-19.

---

## A. Mapeamento completo: o que a central atual tem &rarr; o que precisa ter na nova

> Lista exaustiva de **tudo** que a central atual usa fisicamente
> (do `inventario-central-atual.md`). Cada linha vira um item no BOM novo.

| # | Central atual (Orange Pi Zero) | Detalhe atual | Vai para a nova como | Categoria do BOM |
|---|---|---|---|---|
| 1 | SBC Orange Pi Zero | Allwinner H2+ ARMv7 32-bit | Raspberry Pi CM4 4GB ou RPi 4B 4GB | 1. SBC |
| 2 | RAM 256 ou 512 MB DDR3 | on-board | 4 GB DDR4 | 1. SBC (incluido) |
| 3 | Storage microSD 2 GB | `/dev/mmcblk0` | eMMC 32 GB (CM4) ou SSD/microSD industrial 32 GB (RPi4) | 2. Storage |
| 4 | Wi-Fi XR819 (instavel) | on-board sun8i | CYW43455 dual-band on-board (CM4 Wi-Fi+BT / RPi4) | 1. SBC (incluido) |
| 5 | Bluetooth 4.x | nao usado | BT 5.0 on-board | 1. SBC (incluido) |
| 6 | Ethernet 100 Mbps | `end0` (sun8i-emac) | Gigabit Ethernet `eth0` (bcmgenet) | 1. SBC ou carrier |
| 7 | USB hosts | 1&times; USB-A 2.0 | 2&times; USB-A 3.0 + 2&times; USB-A 2.0 | 1. SBC ou carrier |
| 8 | LEDs `pwr`/`status` | on-board | LEDs ACT/PWR on-board | 1. SBC (incluido) |
| 9 | Console serial `ttyS0` | header GPIO | UART0 GPIO + cabo USB-TTL CP2102 | 12. Cabos/debug |
| 10 | Watchdog `sunxi_wdt` (16s) | HW | `bcm2835_wdt` HW on-board | 1. SBC (incluido) |
| 11 | NRF24L01+ via SPI | modulo externo + 5 GPIOs | **manter o modulo, mesmo NRF24L01+ PA+LNA** (idealmente) | 5. Radio NRF24 |
| 12 | Modem LTE USB externo | usb-modeswitch / cdc_ether | **HAT 4G/LTE Dual-SIM** | 4. Conectividade celular |
| 13 | (sem RTC interno) | NTP-only | **DS3231 RTC I2C** | 6. RTC |
| 14 | Fonte 5V chinesa | 5V/2A generica (causa reboot) | **Mean Well industrial 5V/5A ou 10A** | 7. Alimentacao |
| 15 | Antena Wi-Fi XR819 | PCB on-board | PCB on-board CM4/RPi4 | nao precisa adicionar |
| 16 | (sem antena 4G) | dependia de modem USB | 2&times; antena LTE 4G SMA | 8. Antenas |
| 17 | (sem antena NRF24 externa) | PCB do modulo | Antena 2.4GHz 3 dBi SMA (com PA+LNA) | 8. Antenas |
| 18 | (sem GPS) | NTP-only | Antena GPS ativa SMA (opcional) | 8. Antenas |
| 19 | Caixa generica | (sem padrao definido) | Caixa industrial / DIN-rail | 10. Caixa |
| 20 | (sem cooling ativo) | passivo | Heatsink (CM4) ou Fan HAT (RPi4) | 9. Cooling |
| 21 | microSD card SLC (futuro) | nao usado | **microSD industrial** (RPi4 boot) | 2. Storage |
| 22 | (sem UPS) | sem backup | **UPS HAT opcional** | 13. Opcionais |
| 23 | Cabo de rede | Cat 5e | Cat 6 blindado | 11. Cabos |
| 24 | Cabo USB-C/microUSB alimentacao | gambiarra | Cabo DC dedicado da fonte | 11. Cabos |
| 25 | Parafusos / fixacao | improvisado | Kit M2/M2.5 + standoffs | 11. Cabos/mecanica |

Itens **adicionais** que a central atual nao tem mas a nova precisa ter
para virar instalacao industrial:

| # | Item novo | Por que |
|---|---|---|
| 26 | TVS / protecao surto | Rede eletrica suja em campo |
| 27 | Cabo USB-C macho-macho para `rpiboot` (CM4) | Flash inicial do eMMC |
| 28 | Adaptador SATA-USB ou NVMe HAT (RPi4) | Boot do SSD |
| 29 | Holder dual-SIM expandido | Se modem nao tiver 2 slots nativos |

---

## B. BOM detalhado — 3 opcoes reais por item

### 1. SBC + RAM 4 GB

#### Configuracao CM4 — Raspberry Pi CM4104032 (4GB / 32GB eMMC / Wi-Fi+BT)

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **Newark / Element14** (US) | [CM4104032 (DP 86AH2107)](https://www.newark.com/raspberry-pi/cm4104032/rpi-module-4-4gb-ram-32gb-emmc/dp/86AH2107) | USD `[verificar]` &mdash; tipicamente $95&ndash;110 | Revendedor oficial RPi |
| 2 | **PiShop.us** | [CM4104032](https://www.pishop.us/product/raspberry-pi-compute-module-4-wireless-4gb-32gb-cm4104032/) | USD `[verificar]` &mdash; tipicamente $90&ndash;105 | Revendedor oficial RPi US |
| 3 | **Seeed Studio** | [CM4104032](https://www.seeedstudio.com/Raspberry-Pi-Compute-Module-CM4104032-p-4722.html) | USD `[verificar]` &mdash; site lista ~$90 historico | Estoque global |
| 4 | **Amazon US** (3rd party) | [B0CTKHVYB3](https://www.amazon.com/Raspberry-CM4104032-Quad-Core-Processor-Bluetooth/dp/B0CTKHVYB3) | USD `[verificar]` | Pode ter marcacao |

#### Configuracao RPi4 — Raspberry Pi 4 Model B (4GB)

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **Raspberry Pi oficial** | [Buy RPi 4](https://www.raspberrypi.com/products/raspberry-pi-4-model-b/) | USD $55 MSRP (4GB) | "From $35" base; 4GB ~$55 |
| 2 | **DigiKey** | [SC0194(9) / RPI4-MODBP-4GB](https://www.digikey.com/en/products/detail/raspberry-pi/Raspberry-Pi-4B-4GB/10258781) | USD `[verificar]` &mdash; tipicamente $55&ndash;65 | Mesmo dia |
| 3 | **MakerHero (FilipeFlop) BR** | [RPi 4 Model B 4GB Anatel](https://www.filipeflop.com/produto/raspberry-pi-4-model-2gb-4gb/) | BRL `[verificar]` &mdash; historico R$ 600&ndash;750 | Anatel BR oficial |
| 4 | **RoboCore BR** | [RPi 4 4GB Anatel](https://www.robocore.net/placa-raspberry-pi/raspberry-pi-4-4gb) | BRL `[verificar]` &mdash; tipicamente R$ 650&ndash;800 | Anatel BR oficial |

---

### 2. Storage 32 GB

#### CM4 — eMMC ja incluida no SKU CM4104032 (R$ 0 adicional)

#### RPi4 — opcoes para 32 GB

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| **2a — microSD industrial 32GB (compacto, plug-and-play)** | | | | |
| 1 | **DigiKey** Apacer AP-MSD32GCA-1ATM | [DigiKey 1582-1118-ND](https://www.digikey.com/product-detail/en/apacer-memory-america/AP-MSD32GCA-1ATM/1582-1118-ND/5268821) | USD `[verificar]` &mdash; tipico $25&ndash;40 (MLC industrial -40&deg;C+85&deg;C) | Obsoleto em algumas regioes; ver Apacer AK6.x mais novo |
| 2 | **Mouser** Apacer industrial 32GB | [Mouser AP-MSD32GCA-1ATM](https://www.mouser.com/ProductDetail/Apacer/AP-MSD32GCA-1ATM?qs=y17bYx/8gvi6Ei0yTMm6fA%3D%3D) | USD `[verificar]` | Obsoleto, ver SoS Electronic para alternativas atuais |
| 3 | **SoS Electronic** Apacer AP-MSD32GIA-1HTM | [SoS 226617](https://www.soselectronic.com/products/apacer/ap-msd32gia-1htm-86-mdg40-8c0cb-226617) | EUR `[verificar]` | Industrial pSLC ativa |
| **2b &mdash; SSD SATA 120 GB + adaptador (32GB SSD nao existe mais)** | | | | |
| 1 | **Kabum BR** Kingston A400 240GB | [SA400S37/240G](https://www.kabum.com.br/produto/85197/ssd-kingston-a400-240gb-sata-iii-2-5-leitura-500mb-s-gravacao-350mb-s-preto-sa400s37-240g) | BRL 441,16 | Menor capacidade no mercado BR é 240GB; 120GB descontinuado |
| 2 | **Amazon US** Kingston A400 120GB | [Amazon B01N6JQS8C](https://www.amazon.com/Kingston-120GB-Solid-SA400S37-120G/dp/B01N6JQS8C) | USD `[verificar]` &mdash; historico $20&ndash;25 | Ainda disponivel US |
| 3 | **Kingston Store BR** A400 240GB | [SA400S37/240G](https://www.kingstonstore.com.br/products/sa400s37-240g) | BRL `[verificar]` | Loja oficial Kingston BR |

> **Decisao:** se quer manter exatos 32 GB, vai de **microSD industrial Apacer**.
> Se 120/240 GB e aceitavel (mais espaco util e barato), vai de SSD A400.

---

### 3. Carrier board (somente CM4)

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **Waveshare oficial** CM4-IO-BASE-B (Full) | [waveshare.com](https://www.waveshare.com/cm4-io-base-b.htm) | USD `[verificar]` &mdash; ~$45&ndash;55 historico | 5V/2.5A USB-C, mini PCIe slot |
| 2 | **Amazon US** Waveshare CM4-IO-BASE-B bundle | [Amazon B0991YLS6M](https://www.amazon.com/Waveshare-CM4-IO-BASE-B-Raspberry-Compute-Adapter/dp/B0991YLS6M) | USD `[verificar]` &mdash; tipicamente $65&ndash;85 (bundle 6-item) | Inclui USB HDMI adapter |
| 3 | **Waveshare Industrial** CM4-IO-WIRELESS-BASE-B | [waveshare.com](https://www.waveshare.com/cm4-io-wireless-base-b.htm) | USD `[verificar]` &mdash; mais caro (~$80&ndash;100) | Tem UPS + M.2 slot, ja preparado pra cellular |
| 4 | **PiShop.us** Mini Base Board B | [pishop.us](https://www.pishop.us/product/mini-base-board-b-designed-for-compute-module-4/) | USD `[verificar]` | Mesma board da Waveshare, distribuido US |

**Wiki tecnico:** [CM4-IO-BASE-B - Waveshare Wiki](https://www.waveshare.com/wiki/CM4-IO-BASE-B)

---

### 4. Conectividade celular 4G — Dual-SIM (preferencia)

> **NOTA IMPORTANTE:** apos pesquisa, **HATs com 2 slots SIM fisicos sao raros
> no mercado retail**. Sixfab Base HAT (S121) e Waveshare SIM7600G-H 4G HAT (B) sao
> ambos single-SIM. A solucao **realmente dual-SIM** exige uma das tres opcoes:
>
> 1. **Modem mPCIe com firmware dual-SIM** (Quectel EC25/EG25) + carrier com 2
>    slots fisicos &mdash; carrier custom ou industrial (raro retail)
> 2. **Switch SIM externo via GPIO** &mdash; PCB custom (engenharia extra)
> 3. **eSIM** &mdash; modem com eSIM (M.2 ou outro form factor) + 1 nano-SIM
>
> Recomendacao pragmatica: iniciar PoC com **single SIM robusto** e tratar
> dual-SIM como upgrade na fase de piloto. Listo abaixo as 3 opcoes single
> SIM mais maduras + 1 nota de como fazer dual SIM se for critico.

#### 4a — HAT/modem single SIM (recomendado para PoC)

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **Waveshare SIM7600G-H 4G HAT (B)** | [waveshare.com](https://www.waveshare.com/sim7600g-h-4g-hat-b.htm) / [Welectron 19485](https://www.welectron.com/Waveshare-19485-SIM7600G-H-4G-HAT-B_1) | **EUR 76,90** (~USD $85, ~R$ 470) | Global band, LTE Cat-4, GNSS, **inclui 2 antenas (LTE+GPS)** |
| 2 | **Sixfab 3G/4G-LTE Base HAT** (S121) + Quectel EG25-G mPCIe separado | [Base HAT S121](https://sixfab.com/product/raspberry-pi-base-hat-3g-4g-lte-minipcie-cards/) + [EG25-G module](https://sixfab.com/product/quectel-ec25-mini-pcie-4g-lte-module/) | **USD $45** + **USD $40&ndash;65** = ~$85&ndash;110 (~R$ 470&ndash;605) | HAT vazio + escolha do modem; GNSS opcional via modem |
| 3 | **Sixfab 4G/LTE Cellular Modem Kit (EG25-G)** | [Vilros / Sixfab kit](https://vilros.com/products/sixfab-raspberry-pi-4g-lte-cellular-modem-kit-eg25-g-north-america-global) | **USD $125** (~R$ 690) | Kit completo: HAT + EG25-G + antenas + SIM Sixfab $25 credit |
| 4 | **Seeed Studio LTE CAT 4 EG25-GL HAT** | [Seeed p-6325](https://www.seeedstudio.com/LTE-CAT-4-EG25-GL-HAT-for-Raspberry-Pi-p-6325.html) | USD `[verificar]` &mdash; tipicamente ~$70&ndash;90 | Plug-and-play, global bands |
| 5 | **Kiwi Electronics** RPi 4G LTE CAT4 HAT EG25-GL | [Kiwi 20302](https://www.kiwi-electronics.com/en/raspberry-pi-4g-lte-cat4-hat-with-quectel-eg25-gl-20302) | EUR `[verificar]` | Disponibilidade EU |

#### 4b — Modem mPCIe avulso (para CM4 com carrier que ja tem slot)

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **Sixfab** Quectel EG25/EC25 mPCIe | [Sixfab product](https://sixfab.com/product/quectel-ec25-mini-pcie-4g-lte-module/) | **USD $40&ndash;65** (EC25-E EU / EG25-G Global) | Mesmo modulo do kit acima, avulso |
| 2 | **Waveshare** EG25-G mPCIe | [waveshare.com](https://www.waveshare.com/eg25-g-mpcie.htm) | USD `[verificar]` | LTE Cat 4, mesmo chip |
| 3 | **Quectel oficial / Techship** EG25-G mPCIe | [Techship](https://techship.com/product/quectel-eg-25-g-mpcie/?variant=001) | EUR `[verificar]` | Quectel direto, com homologacoes |
| 4 | **Mouser** EG25-G datasheet | [Mouser PDF](https://www.mouser.com/datasheet/2/1052/Quectel_EG25-G_Mini_PCIe_LTE_Standard_Specificatio-1829960.pdf) | &mdash; (datasheet) | Para confirmar firmware dual-SIM |

**Para dual-SIM real**, a forma documentada e EC25 com firmware dual-SIM:
[EC25 Dual Sim Mode (Quectel Forums)](https://forums.quectel.com/t/ec25-dual-sim-mode/11399).
Requer carrier com 2 slots fisicos.

---

### 5. Radio NRF24L01+ (mantido da central atual)

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **SparkFun WRL-00705** NRF24L01+ com RP-SMA (sem PA+LNA) | [CanaKit / SparkFun](https://www.canakit.com/transceiver-nrf24l01-module-with-rp-sma-wrl-00705.html) | **USD $19.95** | Sem PA+LNA, alcance 100m; precisa antena 2.4GHz separada |
| 2 | **Modtronix** NRF24L01+PA+LNA com antena | [Modtronix wrl-nrf24l01-pa](https://modtronix.com/product/wrl-nrf24l01-pa/) | USD `[verificar]` &mdash; tipico $15&ndash;25 | PA+LNA, antena 2dBi SMA inclusa, ate 1km |
| 3 | **Amazon US** MakerFocus NRF24L01+PA+LNA + adapter | [Amazon B01IK78PQA](https://www.amazon.com/MakerFocus-NRF24L01-Transceiver-Antistatic-Compatible/dp/B01IK78PQA) | USD `[verificar]` &mdash; pack 2pc ~$15 | Vem com regulador 3.3V on-board, ESD protected |
| 4 | **Nordic Semi NRF24L01P-MODULE-SMA (DigiKey)** | [DigiKey 4691743](https://www.digikey.com/en/products/detail/nordic-semiconductor-asa/NRF24L01P-MODULE-SMA/4691743) | USD `[verificar]` | Kit eval oficial Nordic |

**Decisao:** **Modtronix ou Amazon MakerFocus (PA+LNA)** para alcance em
subsolo / ambientes ruidosos.

---

### 6. RTC externo I2C — DS3231

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **Adafruit DS3231 Precision RTC Breakout** (ID 3013) | [adafruit.com/3013](https://www.adafruit.com/product/3013) | **USD $17.50** | Battery CR1220 vendida separado ($0.95) |
| 2 | **Adafruit PiRTC DS3231 HAT** (ID 4282) | [adafruit.com/4282](https://www.adafruit.com/product/4282) | **USD $14.95** | Plug-and-play GPIO RPi, sem solda; bateria nao incluida |
| 3 | **Adafruit DS3231 STEMMA QT** (ID 5188) | [adafruit.com/5188](https://www.adafruit.com/product/5188) | USD `[verificar]` &mdash; ~$17 | Conectores Qwiic/STEMMA, sem solda |
| 4 | **The Pi Hut UK** DS3231 RTC | [thepihut DS3231](https://thepihut.com/products/adafruit-ds3231-precision-rtc-breakout) | GBP `[verificar]` &mdash; tipico ~£18 | Same as Adafruit 3013, BR/EU shipping |

**Decisao:** **PiRTC HAT (4282)** para ambas as configs &mdash; plug direto no
header GPIO, sem solda.

---

### 7. Alimentacao — fonte industrial 5V

#### 7a — Mean Well RS-25-5 (5V / 5A / 25W) — CM4 + perifericos

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **DigiKey** Mean Well RS-25-5 | [DigiKey 1866-4145-ND](https://www.digikey.com/en/products/detail/mean-well-usa-inc/RS-25-5/7706180) | **USD $10.60** (2,439 em estoque) | Chassis mount, 88-264 VAC, encapsulada |
| 2 | **Mouser** Mean Well RS-25-5 | [Mouser](https://www.mouser.com/ProductDetail/MEAN-WELL/RS-25-5?qs=pqZ7J9Gt%2FmqXHOzlkOY2rg%3D%3D) | USD `[verificar]` &mdash; igual ao DK | Mesmo SKU, disponivel |
| 3 | **TRC Electronics** Mean Well RS-25-5 | [TRC Electronics](https://www.trcelectronics.com/products/mean-well-rs-25-5) | USD `[verificar]` &mdash; same day ship | Distribuidor MeanWell US |
| 4 | **Jameco** RS-25-5 | [Jameco 323282](https://www.jameco.com/z/RS-25-5-MEAN-WELL-AC-to-DC-Power-Supply-Single-Output-5-Volt-5-Amp-25-Watt_323282.html) | USD `[verificar]` | Distribuidor alternativo |

[**Datasheet RS-25:**](https://www.meanwellusa.com/upload/pdf/RS-25/RS-25-spec.pdf)

#### 7b — Mean Well RS-50-5 (5V / 10A / 50W) — RPi4 + SSD/HAT

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **DigiKey** RS-50-5 | (buscar na DK [Mean Well RS-50 series](https://www.digikey.com/en/products/base-product/mean-well-usa-inc/1866/RS-25/460954)) | USD `[verificar]` &mdash; ~$15&ndash;20 | RS-50 series, 50W |
| 2 | **Mouser** RS-50-5 | (buscar no Mouser MeanWell RS-50-5) | USD `[verificar]` | Mesmo |
| 3 | **TRC Electronics** RS-50-5 | (buscar TRC) | USD `[verificar]` | Same day ship |

> Alternativa premium: **Phoenix Contact QUINT-PS/1AC/24DC/2.5** (24V industrial)
> + DC-DC step-down para 5V &mdash; ~USD $200&ndash;400 (isolamento extra para
> ambiente industrial pesado).

---

### 8. Antenas (LTE main+diversity, Wi-Fi, NRF24, GPS opt)

#### 8a — Antenas LTE 4G/5G — SMA

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **DigiKey** Pulse SPDA24617/3900 4G/5G/LTE | [DK 1837-1146-ND](https://www.digikey.com/en/products/detail/pulselarsen-antennas/SPDA24617-3900/1837-1146-ND/9838677) | USD `[verificar]` | Blade SMA Male, multi-band |
| 2 | **DigiKey** Pulse W1696 LTE Whip SMA | [DK W1696](https://www.digikey.com/en/products/detail/pulse-electronics/W1696/10125534) | USD `[verificar]` | Industrial Whip, SMA straight |
| 3 | **Data Alliance** LTE 4G 5dBi wall-mount SMA | [data-alliance](https://www.data-alliance.net/antenna-lte-4g-1710-2700mhz-5dbi-gsm-wall-mount-w-sma-male-or-n-male/) | USD `[verificar]` &mdash; ~$20&ndash;30 | 698&ndash;2700 MHz, 5dBi |
| 4 | **Mouser** [Catalogo Pulse Larsen v14](https://www.mouser.com/pdfdocs/PulseLarsenAntennas_Catalog_Version14.pdf) | (PDF catalogo) | &mdash; | Para escolher por banda/forma |

**Recomendacao:** comprar **2 antenas iguais** (main + diversity para MIMO) +
**2 pigtails IPEX-SMA**.

#### 8b — Pigtails IPEX/UFL para SMA

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **Rokland** UFL IPEX (MHF1) to SMA Female (2-pack) | [Rokland](https://store.rokland.com/products/2-pack-ufl-ipex4-mhf4-to-sma-female-pigtail-antenna-wifi-iot-dev-cable) | USD `[verificar]` | 2-pack, padrao IoT |
| 2 | **DigiKey** Generic IPEX-SMA | (buscar "IPEX to SMA" DK) | USD `[verificar]` | Variantes WiFi/LTE |
| 3 | **Amazon** RP-SMA / IPEX pigtail | (multiplos vendors) | USD `[verificar]` &mdash; ~$3&ndash;6 cada | Custo-beneficio |

#### 8c — Antena 2.4 GHz para NRF24 (se nao usar PA+LNA com antena inclusa)

Se comprar o NRF24L01+PA+LNA da Modtronix/MakerFocus, **ja vem antena inclusa**.
Caso contrario:
- **SparkFun WRL-00145** 2.4 GHz duck antenna RP-SMA &mdash; ~$8

---

### 9. Refrigeracao

#### 9a — Heatsink CM4 (passivo)

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **Waveshare** CM4 Heatsink Mini | (buscar Waveshare "CM4 heatsink") | USD `[verificar]` &mdash; ~$3&ndash;6 | Aluminio anodizado |
| 2 | **PiShop.us** CM4 heatsink kits | (pishop.us) | USD `[verificar]` | Varias opcoes |
| 3 | **Amazon** GeeekPi CM4 heatsink | (amazon search) | USD `[verificar]` | Generico, varios brands |

#### 9b — Fan PWM RPi4

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **Argon FAN HAT** | [argon40.com](https://argon40.com/products/argon-fan-hat) | **USD $10** (mas SOLD OUT no momento) | 40mm PWM + power button |
| 2 | **The Pi Hut** Argon Fan HAT | [thepihut](https://thepihut.com/products/argon-fan-hat) | GBP `[verificar]` | UK |
| 3 | **PiShop.us** Argon Fan HAT | [pishop](https://www.pishop.us/product/argon-fan-hat-for-raspberry-pi-3b-3b-4b/) | USD `[verificar]` | US distributor |
| 4 | **Amazon US** Argon Fan HAT | [Amazon B07Y9LFP1J](https://www.amazon.com/Argon-Raspberry-Provides-Shutdown-Rebooting/dp/B07Y9LFP1J) | USD `[verificar]` &mdash; ~$15&ndash;20 | Em estoque |

---

### 10. Caixa / Mecanica

#### 10a — Caixa industrial (CM4)

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **Hammond 1591 ABS** series | [Mouser 1591 series](https://www.mouser.com/c/enclosures/enclosures-boxes-cases/?m=Hammond&series=1591) / [Datasheet](https://www.mouser.com/datasheet/3/222/1/1591.pdf) | USD `[verificar]` &mdash; ~$8&ndash;15 (sem furacao) | ABS, IP54, multi-tamanho |
| 2 | **Hammond 1597KIT DIN-rail** | [Hammond 1597KIT](https://www.hammfg.com/electronics/small-case/plastic/1597kit) | USD `[verificar]` &mdash; ~$15&ndash;25 | DIN-rail clip incluido, PC-ABS |
| 3 | **DigiKey** Hammond 1591EBK | [DK HM118-ND](https://www.digikey.com/product-detail/en/hammond-manufacturing/1591EBK/HM118-ND/130913) | USD `[verificar]` | Black, multipurpose ABS |

#### 10b — Caixa Raspberry Pi 4 (com SSD se aplicar)

| # | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| 1 | **Argon ONE M.2 Case** | [argon40.com](https://argon40.com/products/argon-one-m-2-case-for-raspberry-pi-4) | **USD $45** | Aluminio fundido + SATA M.2 slot, UASP, power button |
| 2 | **Pimoroni** Argon ONE M.2 | [shop.pimoroni](https://shop.pimoroni.com/en-us/products/argon-one-m-2-case-for-raspberry-pi-4) | EUR `[verificar]` &mdash; tipico €45&ndash;55 | UK/EU |
| 3 | **PiShop.us** Argon ONE M.2 | [pishop](https://www.pishop.us/product/argon-one-m-2-case-for-raspberry-pi-4/) | USD `[verificar]` &mdash; ~$45&ndash;55 | US distributor |
| 4 | **Hammond 1597KITRBPI** DIN-rail RPi 4 | [Jameco 2569783](https://www.jameco.com/z/1597KITRBPI-Hammond-Manufacturing-Embedded-DIN-Rail-Mounted-Enclosure-for-Raspberry-Pi-B-4-70-x-3-97-x-0-89-Rail-Box_2569783.html) | USD `[verificar]` | DIN-rail industrial, mais nu |

---

### 11. Cabos e fixacao

| Item | Fornecedor | Link | Preco | Notas |
|---|---|---|---|---|
| **Cabo Ethernet Cat 6 blindado 1m** | Mouser / DigiKey / Mercado Livre | (qualquer Cat 6 STP) | USD ~$5 (~R$ 30) | Padrao |
| **Cabo USB-C macho-macho (rpiboot, CM4)** | Adafruit / Amazon | (USB-C MM 1m) | USD ~$8&ndash;12 | Para flash inicial CM4 via rpiboot |
| **Cabo USB-TTL CP2102 (debug console)** | [Adafruit 954](https://www.adafruit.com/product/954) | $9.95 USD | Vem com 4 fios pinout RPi |
| **The Pi Hut USB-TTL** (alternativa) | [thepihut](https://thepihut.com/products/usb-to-ttl-serial-cable-debug-console-cable-for-raspberry-pi) | GBP £6 (sold out) | Mesma coisa |
| **Amazon DSD TECH CP2102** | [Amazon B078W5L8W1](https://www.amazon.com/DSD-TECH-Adapter-Compatible-Windows/dp/B078W5L8W1) | USD `[verificar]` &mdash; ~$7&ndash;10 | 2-pack opcao |
| **Adaptador SATA-USB 3.0 UASP (RPi4 com SSD)** | Amazon / FilipeFlop | (Sabrent EC-SSHD ou similar) | USD ~$15&ndash;20 (~R$ 90&ndash;120) | UASP-capable obrigatorio |
| **microSD 16GB para bootloader (RPi4)** | qualquer | (SanDisk Ultra 16GB) | USD ~$8 (~R$ 45) | Apenas para 1o boot, depois boota do SSD |
| **Kit parafusos M2/M2.5 + standoffs** | Amazon / Mercado Livre | (kit generico) | USD ~$8 (~R$ 45) | |
| **Bateria CR1220 RTC** | Adafruit / Mercado Livre | (CR1220 generico) | USD ~$1 (~R$ 5) | Para DS3231 |

---

### 12. Provisionamento / diagnostico (bancada, 1x por lote)

| Item | Fornecedor | Preco | Notas |
|---|---|---|---|
| Caixa anti-estatica | Mercado Livre | R$ 5&ndash;15 | Para transporte |
| Multimetro (bancada) | Brymen / Fluke / generico | R$ 100&ndash;800 | Ja deve ter |
| Console serial (mesmo cabo CP2102 acima) | &mdash; | &mdash; | Reuso |
| Cabo de programacao USB-C (rpiboot, CM4) | Adafruit / Amazon | $8 | Reuso |

---

### 13. Opcionais (central premium)

| Item | Fornecedor | Link | Preco | Justificativa |
|---|---|---|---|---|
| **UPS HAT PiSugar 3 Plus** | [PiSugar](https://www.pisugar.com/) | USD `[verificar]` &mdash; tipico $50&ndash;80 | Backup bateria contra quedas energia |
| **Geekworm X1200 UPS HAT** | [Geekworm](https://geekworm.com/) | USD `[verificar]` &mdash; tipico $40&ndash;60 | Alternativa UPS para RPi4 |
| **TVS protecao surto AC** | DigiKey / Mouser | USD ~$5&ndash;15 | Rede eletrica suja |
| **Display OLED 0.96" I2C** | Adafruit 938 / 326 | USD ~$10&ndash;20 | Status local sem SSH |
| **Modulo ZigBee CC2530 (opcional futuro)** | Mouser / Amazon | USD ~$15&ndash;25 | Sensores ZigBee |
| **Modulo LoRa SX1276 (opcional futuro)** | Adafruit 4074 / Mouser | USD ~$20&ndash;40 | Sensores LoRa long-range |

---

## C. Totais estimados (1 unidade PoC)

### Configuracao CM4 (4GB / 32GB eMMC / Wi-Fi+BT)

| Item | Fornecedor recomendado | USD | BRL (5.50) |
|---|---|---:|---:|
| CM4104032 | Newark ou PiShop.us | 100 | 550 |
| Carrier Waveshare CM4-IO-BASE-B | Waveshare | 50 | 275 |
| Modem 4G HAT (Sixfab Base + EG25-G) | Sixfab | 95 | 525 |
| NRF24L01+ PA+LNA + antena | Modtronix | 20 | 110 |
| RTC PiRTC DS3231 + CR1220 | Adafruit 4282 + bateria | 16 | 90 |
| Fonte Mean Well RS-25-5 + cabos AC/DC | DigiKey | 15 | 85 |
| 2&times; antenas LTE + 2&times; pigtails IPEX-SMA | Data Alliance + Rokland | 35 | 195 |
| Heatsink CM4 | Waveshare | 5 | 30 |
| Caixa Hammond 1591EBK + DIN-rail | DigiKey | 18 | 100 |
| Cabos (Ethernet + USB-C MM + USB-TTL) | mix | 25 | 140 |
| Kit parafusos + standoffs | Amazon/ML | 8 | 45 |
| **TOTAL CM4** | | **USD ~387** | **BRL ~2.145** |

### Configuracao RPi4 (4GB + microSD industrial 32GB)

| Item | Fornecedor recomendado | USD | BRL |
|---|---|---:|---:|
| RPi 4 Model B 4GB | MakerHero / RoboCore BR | 60 | 700 (BR direto) |
| microSD industrial Apacer 32GB | DigiKey 1582-1118-ND | 30 | 165 |
| HAT 4G Waveshare SIM7600G-H (B) | Welectron / Waveshare | 85 | 470 |
| NRF24L01+ PA+LNA + antena | Modtronix | 20 | 110 |
| RTC PiRTC DS3231 + CR1220 | Adafruit 4282 + bateria | 16 | 90 |
| Fonte Mean Well RS-50-5 + cabos | DigiKey | 20 | 110 |
| (antenas LTE ja inclusas no HAT) | &mdash; | 0 | 0 |
| Argon Fan HAT | Amazon | 18 | 100 |
| Argon ONE M.2 Case | argon40.com | 45 | 250 |
| Cabos (Ethernet + USB-TTL + adaptador SATA-USB) | mix | 35 | 195 |
| microSD 16GB bootloader inicial | Mercado Livre | 8 | 45 |
| Kit parafusos + standoffs | Amazon/ML | 8 | 45 |
| **TOTAL RPi4 (com microSD industrial)** | | **USD ~345** | **BRL ~2.280** |

**Alternativa RPi4 com SSD 240GB ao inves de microSD industrial:**

| Substituir | Por | Diferenca |
|---|---|---|
| microSD industrial 32GB (USD 30) | Kingston A400 240GB (USD 25 US / BRL 441) + adaptador (USD 15) | +USD 10 ~ +BRL 60 |

---

## D. Resumo executivo &mdash; decisao tecnica

| Criterio | CM4 | RPi4 (microSD ind.) | Vencedor |
|---|---|---|---|
| Custo unidade PoC (1-10 un) | ~USD 387 / R$ 2.145 | ~USD 345 / R$ 2.280 | RPi4 (BR), CM4 (US) |
| Storage industrial | eMMC soldada (best) | microSD pSLC (OK) ou SSD A400 (OK) | CM4 |
| Disponibilidade BR | Importacao | Anatel local (Makerhero/RoboCore) | RPi4 |
| Footprint | Compacto (~50&times;40mm) | Maior (~85&times;56mm) | CM4 |
| Termico em caixa fechada | Heatsink passivo basta | Precisa fan ativo | CM4 |
| Tempo de setup | rpiboot + carrier | microSD ou USB plug-and-play | RPi4 |
| Escala 100+ unidades | ~USD 250 (carrier custom) | ~USD 345 | CM4 |
| Cellular dual-SIM real | Carrier industrial mPCIe + EC25 firmware | Limitado (HATs sao single-SIM) | CM4 |

**Recomendacao alinhada com [apresentacao Centrais MyIO 2.0](apresentacao-centrais-novas/index.html):**

- **PoC e piloto (5-10 unidades): RPi 4 4GB** com microSD industrial Apacer +
  Waveshare SIM7600G-H 4G HAT B (single-SIM) + Argon ONE M.2 + Mean Well RS-50-5.
  Tudo Anatel BR, disponibilidade imediata, time familiar.

- **Producao em escala (50+): CM4104032** com carrier custom desenhado
  (Waveshare CM4-IO-BASE-B serve para os primeiros prototipos), modem
  Quectel EC25/EG25 mPCIe com firmware dual-SIM, caixa Hammond industrial,
  fonte Mean Well RS-25-5.

---

## E. Ressalvas e proximos passos

1. **Precos sao a base de pesquisa de 2026-05-19.** Mouser e DigiKey bloqueiam
   crawlers automaticos (HTTP 403); precos marcados `[verificar]` precisam ser
   confirmados visitando os links com browser. Precos com numero firme foram
   coletados via WebFetch ou de paginas que retornaram dados (Welectron,
   Adafruit, Sixfab, argon40, DigiKey via API publica do Mean Well).
2. **Cambio USD&rarr;BRL varia.** Usei R$ 5,50 como referencia &mdash; ajustar antes de
   fechar compra. Importacao via Mouser/DigiKey/Adafruit/Waveshare tem custo
   adicional de frete (USD $30&ndash;80) + impostos federais (~60% sobre CIF) +
   ICMS estadual.
3. **Dual SIM real exige carrier especifico** &mdash; os HATs retail (Sixfab,
   Waveshare) sao single-SIM. Para dual-SIM, opcoes sao: (1) modem EC25 mPCIe
   com firmware dual-SIM + carrier custom com 2 slots, (2) switch SIM via
   GPIO (PCB extra), (3) eSIM + nano-SIM. Recomendo iniciar PoC com single-SIM
   e tratar dual-SIM como upgrade fase 2.
4. **Anatel:** Quectel EG25-G, SIM7600G-H e Argon ONE M.2 tem homologacao
   Anatel. Antenas LTE custom e Hammond enclosures nao precisam Anatel.
   Confirmar com Sixfab para HATs especificos importados.
5. **Estoque RPi4 e CM4** flutua. Sempre verificar disponibilidade antes de
   fechar lote. Em 2024-2025 houve escassez global; em 2026 a oferta esta
   melhor.
6. **MakerHero e revendedor oficial RPi no Brasil** (antiga FilipeFlop &mdash;
   trocou de marca em 2024-2025). Precos vao para o link da MakerHero.

---

## F. Fornecedores de referencia

| Fornecedor | Tipo | Link | Notas |
|---|---|---|---|
| **Mouser** | Distribuidor global | [mouser.com](https://www.mouser.com/) | Mean Well, Pulse Larsen, Nordic, Apacer |
| **DigiKey** | Distribuidor global | [digikey.com](https://www.digikey.com/) | Mean Well, Hammond, Apacer, Raspberry Pi |
| **Newark / Element14** | Distribuidor RPi oficial | [newark.com](https://www.newark.com/) | Raspberry Pi (RPi4, CM4) |
| **PiShop.us** | Distribuidor RPi US | [pishop.us](https://www.pishop.us/) | RPi, Waveshare, Argon, acessorios |
| **Adafruit** | Maker / oficial RPi | [adafruit.com](https://www.adafruit.com/) | RTC DS3231, cabos USB-TTL, OLEDs |
| **SparkFun** | Maker | [sparkfun.com](https://www.sparkfun.com/) | NRF24L01+, modulos |
| **Waveshare** | Fabricante (China) | [waveshare.com](https://www.waveshare.com/) | CM4 carriers, 4G HATs, perifericos |
| **Sixfab** | Fabricante (cellular) | [sixfab.com](https://sixfab.com/) | Base HAT + Quectel modules |
| **Argon 40** | Fabricante (casas RPi) | [argon40.com](https://argon40.com/) | Argon ONE M.2, FAN HAT |
| **Hammond Mfg** | Fabricante (caixas) | [hammfg.com](https://www.hammfg.com/) | 1591, 1597KIT enclosures |
| **MakerHero (FilipeFlop)** | Revendedor BR RPi oficial | [filipeflop.com](https://www.filipeflop.com/) | RPi4 Anatel BR |
| **RoboCore** | Revendedor BR | [robocore.net](https://www.robocore.net/) | RPi4 Anatel BR |
| **Eletrogate** | Revendedor BR | [eletrogate.com](https://www.eletrogate.com/) | Modulos, NRF24, RTC |
| **Welectron** | Distribuidor EU | [welectron.com](https://www.welectron.com/) | Waveshare EU pricing |
| **TRC Electronics** | Distribuidor US PSU | [trcelectronics.com](https://www.trcelectronics.com/) | Mean Well same day ship |
| **Techship** | Distribuidor EU cellular | [techship.com](https://techship.com/) | Quectel modules certificados |

---

## G. Itens cuja pesquisa **NAO consegui preco firme** (visitar link e confirmar)

Foram marcados `[verificar]` no BOM. Lista para revisao manual:

- [ ] CM4104032 preco real Newark / PiShop / Seeed
- [ ] RPi 4B 4GB preco real DigiKey / MakerHero BR / RoboCore BR
- [ ] Waveshare CM4-IO-BASE-B preco oficial atual
- [ ] Seeed LTE CAT 4 EG25-GL HAT preco
- [ ] Quectel EG25-G mPCIe preco Waveshare e Techship
- [ ] Apacer microSD industrial AP-MSD32GCA-1ATM preco DK/Mouser
- [ ] Mean Well RS-50-5 preco DK
- [ ] Pulse Larsen antenas preco DK
- [ ] Pigtails IPEX-SMA preco Rokland
- [ ] Hammond 1591EBK e 1597KIT preco DK
- [ ] Argon Fan HAT preco (esta sold out na loja oficial; ver Amazon)
- [ ] UPS HATs (PiSugar 3, Geekworm X1200) precos atuais

---

## Referencias

- [inventario-central-atual.md](inventario-central-atual.md)
- [hardware-central-myio.md](hardware-central-myio.md)
- [comparativo-cm4-rpi-vs-orangepi.md](comparativo-cm4-rpi-vs-orangepi.md)
- [apresentacao-centrais-novas/index.html](apresentacao-centrais-novas/index.html)