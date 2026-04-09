# Candidato: Paulo Vitor Mentani

| | |
|---|---|
| **Vaga** | Engenheiro(a) DevOps — Nível Pleno / Sênior |
| **Status** | Em avaliação |
| **Data de entrada** | 2026-04-08 |

---

## Informações pessoais

| Campo | Valor |
|---|---|
| **Nome completo** | Paulo Vitor Mentani |
| **Idade** | 26 anos |
| **Nacionalidade** | Brasileiro |
| **E-mail** | pv-mentani@hotmail.com |
| **Telefone** | +55 11 94352-4712 |
| **LinkedIn** | https://www.linkedin.com/in/paulo-vitor-mentani/ |
| **Localização** | Osasco – SP |
| **Disponibilidade** | 3 semanas |
| **Regime pretendido** | CLT |

---

## Remuneração

| Campo | Valor |
|---|---|
| **Remuneração atual** | R$ 10.000,00 CLT |
| **Benefícios atuais** | A. Médica + Cartão Flash R$ 1.000,00 + Wellhub + SESC |
| **Modelo atual** | Híbrido (pontualmente) |
| **Pretensão salarial** | A partir de R$ 12.000,00 |

---

## Resumo profissional

Engenheiro de sistemas embarcados com 4+ anos de experiência em Linux embarcado (Yocto + Buildroot), firmware C/C++, protocolos IoT e gestão de frota em escala. Experiência atual na Vammo com ~4.000 motos elétricas e 500 carregadores IoT — incluindo OTA com SWUpdate, telemetria via MQTT e análise preditiva de falhas. Background sólido em MAGNAMED (criação de distro Linux do zero para ventilador hospitalar; deploy remoto de firmware para o Cazaquistão). Inglês avançado. Objetivo declarado: Technical Product Specialist / Systems Integration Engineer.

---

## Formação acadêmica

| Título | Instituição | Situação |
|---|---|---|
| Tecnólogo em Automação Industrial | FATEC Osasco | Concluído (2019–2022) |
| Engenharia de Computação | UNIVESP | Em andamento (2022–2027) |

---

## Idiomas

| Idioma | Nível |
|---|---|
| Português | Nativo |
| Inglês | Avançado |

---

## Experiência profissional

| Período | Empresa | Função |
|---|---|---|
| 11/2024 – Atual | Vammo | Embedded System Engineer |
| 06/2024 – 12/2024 | Pagmob | Firmware Developer |
| 04/2023 – 06/2024 | MAGNAMED | Software Developer |
| 09/2022 – 04/2023 | Pasquali Solution (MAGNAMED) | C++ Developer |
| 10/2021 – 09/2022 | Power2Go | Firmware and Hardware Developer |

### Vammo (11/2024 – Atual)
- C++ (boost, C++23, Qt Creator, QML) para embedded Linux; software de manutenção Windows.
- C para embedded systems com ESP32 e STM32.
- Python para embedded Linux (DBus, protobuf, alsa lib) e Data Science/ML (NumPy, Pandas, CUDA) — análise preditiva de falhas de bateria.
- Yocto: criação de pacotes e BSP files.
- Protocolos: Modbus RTU, RS485, CAN, I2C, MQTT, HTTPS, Bluetooth, LTE 4G.
- Hardware debugging e análise de circuitos a nível de componente.
- Criação de test jigs (engenharia + operações) e SOPs para time de operações.
- OTA com SWUpdate + soluções proprietárias para frota de ~4.000 motos + 500 carregadores.

### Pagmob (06/2024 – 12/2024)
- Firmware C com FreeRTOS e ESP-IDF + SQLite embarcado.
- Integração de pagamento EMV (contactless/VISA) e BLE.
- HTTP, MQTT; implementação do padrão IEC 7816-4 com TLV-BER parsing em C.

### MAGNAMED (04/2023 – 06/2024)
- Embedded Linux: drivers, criação de imagem com Yocto (distro do zero para ventilador hospitalar).
- C++ Qt Creator para aplicações Linux; firmware C para MCUs Texas Instruments.
- Python (NumPy, Matplotlib, Pandas, SciPy); testes com GoogleTest e Parasoft.
- Deploy e correção remota de firmware para produtos no Cazaquistão.

### Pasquali Solution / MAGNAMED (09/2022 – 04/2023)
- Mesmo stack técnico do MAGNAMED (alocação via consultoria).

### Power2Go (10/2021 – 09/2022)
- Firmware C/C++ para ESP32 e Atmega (ESP-IDF, Arduino, FreeRTOS, MQTT).
- Hardware para medição de consumo de energia e comunicação IoT.
- Criação de test devices; Python com AWS SDK (Boto3) e pySerial.

---

## Ferramentas e habilidades

| Categoria | Itens |
|---|---|
| **Linux / Embarcado** | Yocto (Magnamed + Vammo), Buildroot (Vammo), drivers, BSP, systemd |
| **Linguagens** | C, C++ (boost, C++23, Qt/QML), Python, MySQL, .NET |
| **IoT / Protocolos** | MQTT, Modbus RTU, RS485, CAN, I2C, Bluetooth, BLE, LTE 4G, HTTPS |
| **OTA** | SWUpdate + soluções proprietárias (frota 4.000+ dispositivos) |
| **Microcontroladores** | ESP32, STM32, ATmega, Texas Instruments |
| **Cloud / AWS** | AWS SDK (Boto3) — uso em scripts Python |
| **Testes** | GoogleTest, Parasoft (unit + static) |
| **Data Science / ML** | NumPy, Matplotlib, Pandas, SciPy, CUDA |
| **Hardware** | Debug circuitos a nível de componente, test jigs |

---

## Avaliação técnica — Requisitos da vaga

### Obrigatórios

| Critério | Atende? | Observação |
|---|---|---|
| Linux embarcado (Yocto / Buildroot) | ✅ Pleno | Yocto (Magnamed + Vammo) + Buildroot (Vammo). Criou distro do zero e dá suporte a imagens existentes |
| Docker + orquestração de containers | ⚠️ Não evidenciado | Não mencionado no CV nem no parecer |
| CI/CD (GitLab CI / GitHub Actions) | ⚠️ Não evidenciado | Não mencionado explicitamente |
| systemd + administração Linux | ✅ Implícito | Embedded Linux profundo; systemd implícito no contexto |
| PostgreSQL em produção | ⚠️ Não evidenciado | Mencionado MySQL no CV; sem PostgreSQL explícito |
| Redes: VPN/mesh, firewall, troubleshooting remoto | ⚠️ Parcial | Debug remoto em escala real; sem VPN/mesh explícito |
| AWS | ⚠️ Parcial | AWS SDK Boto3 em scripts Python (Power2Go); sem experiência em infra cloud |
| Shell scripting + linguagem (Python / Go) | ✅ Pleno | Python avançado + C/C++ |

### Desejável

| Critério | Atende? | Observação |
|---|---|---|
| Nix / NixOS (flakes, cross-compilação) | ⚠️ Não evidenciado | — |
| OTA update (Mender / RAUC) | ⚠️ Parcial | Usa SWUpdate + soluções próprias em escala real; não cita Mender/RAUC |
| Erlang / Elixir ou Node.js | ⚠️ Não evidenciado | — |
| Prometheus + Grafana | ⚠️ Não evidenciado | — |
| Hardware embarcado (ARM, U-Boot) | ✅ Atende | ESP32 (ARM Xtensa), STM32 (ARM Cortex-M); BSP customization |

---

## Parecer preliminar

> **Perfil técnico forte, com gaps na camada DevOps/cloud.**
>
> Paulo tem excelência comprovada em Linux embarcado, OTA em produção e gestão de frota IoT em escala real — os pontos mais difíceis de encontrar no mercado. Porém, **Docker, CI/CD, PostgreSQL, VPN/mesh e AWS infra** não estão evidenciados, o que representa gaps nos requisitos obrigatórios da vaga.
>
> O risco secundário é comportamental: comunicação lenta e truncada, com feedback prévio sobre clareza técnica — relevante para time enxuto.
>
> Recomendação: **avançar para entrevista técnica** para mapear os gaps de DevOps/cloud. Se aprendível no contexto da Myio, é candidato sólido para a frente de gateways e OTA.

---

## Histórico de entrevistas

| Data | Etapa | Responsável | Resultado |
|---|---|---|---|
| — | — | — | — |

---

## Notas e observações

_Adicionar notas aqui._
