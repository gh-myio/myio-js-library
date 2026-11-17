# Campinas Shopping — G0 Hidrômetros Novo — slaves (via Data API)

> Fonte: Data API (`management/devices?gatewayId=b126ce91-6567-492b-96f8-b157b47e2600`), capturado 16/11/2026.
> **Não é dump do banco da central** (sem SSH em 16/11): faltam addr_low/addr_high, channels e ambients.
> Rodar `dump-cadastro.py` quando a central voltar para ter o cadastro completo.

- Central IPv6 `200:a2db:17c5:bb1c:afa1:2caa:c73:4312` · hardwareUuid `989671ae-345c-4416-90ed-20939e363ea0`
- Gateway Data API `b126ce91-6567-492b-96f8-b157b47e2600` (era o UUID da central antiga INATIVADA, hoje aponta p/ hardware novo)
- 76 devices: 64 water, 11 temperature, 1 energy
- slaveIds ausentes (1–90): 31, 35, 38, 39, 40, 50, 61, 63, 73, 74, 79, 82, 83, 88

⚠ Nomes duplicados: `Hidr. Grileto x1 0m3` → [45, 46]

| slaveId | nome | deviceType | profile | capabilities | última telemetria (UTC) |
|---|---|---|---|---|---|
| 1 | Hidr. Riachuelo x10 0m3 | water | default | energy, water | 2026-11-16T18:15 |
| 2 | Hidr. McDonald's x100 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 3 | Hidr. Cinépolis x100 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 4 | Hidr. ADM x10 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 5 | Hidr. Detran x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 6 | Hidr. Consultare x10 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 7 | Hidr. Centauro x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 8 | Hidr. Chute_ao_gol x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 9 | Hidr. Diferentes x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 10 | Hidr. Americanas x10 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 11 | Hidr. Face_Doctor x10 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 12 | Hidr. Cacau_cafe x10 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 13 | Hidr. C&A x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 14 | Hidr. KFC x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 15 | Hidr. Parmeggio x10 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 16 | Hidr. Spoleto x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 17 | Hidr. Bobs x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 18 | Hidr. Makibela x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 19 | Hidr. Chiquinho_Sorvetes x1 0m3 | water | default | energy, water | 2026-11-16T18:15 |
| 20 | Hidr. Morana x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 21 | Hidr. Drogasil x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 22 | Hidr. Agro_Bar x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 23 | Hidr. Ferracine x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 24 | Hidr. Nina_Fiori x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 25 | Hidr. GBK_Burguer x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 26 | Hidr. Usa_Flex x1 0m3 | water | default | energy, water | 2026-11-16T18:15 |
| 27 | Hidr. Hope x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 28 | Hidr. Milk Moo x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 29 | Hidr. Pernambucanas x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 30 | Hidr. Rosana_Joias x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 32 | Hidr. Natura x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 33 | Hidr. Marabraz x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 34 | Hidr. Di_gaspi x10 0m3 | water | default | energy, water | 2026-11-16T18:15 |
| 36 | Hidr. Face_Doctor x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 37 | Hidr. Achei_na_lojinha x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 41 | Hidr. Casas_Bahia x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 42 | Hidr. Leitura x1 0m3 | water | default | energy, water | 2026-11-16T18:15 |
| 43 | Hidr. Patroni x1 0m3 | water | default | energy, water | 2026-11-16T18:15 |
| 44 | Hidr. Sushi_Fan x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 45 | Hidr. Grileto x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 46 | Hidr. Grileto x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 47 | Hidr. Sucao x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 48 | Hidr. Divino Fogão x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 49 | Hidr. Maravilha_do_Lar x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 51 | Hidr. Boreli x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 52 | Hidr. Colonial x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 53 | Hidr. Panqueca x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 54 | Hidr. Fogao_Mineiro x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 55 | Hidr. Galico x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 56 | Hidr. Ja_acai x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 57 | Hidr. Kopenhagen x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 58 | Hidr. McDonald_P7_G0 x10 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 59 | Hidr. Baked_Potato x1 0m3 ⚠ sem water | water | default | energy | — |
| 60 | Hidr. Matuto x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 62 | Temperatura G1 (Ponto 02) | temperature | — | temperature | 2026-11-16T18:20 |
| 64 | Temperatura G2( Ponto 1) | temperature | — | temperature | 2026-11-16T18:20 |
| 65 | Temperatura Elevador G1( Ponto 03 ) | temperature | — | temperature | 2026-11-16T18:20 |
| 66 | Temperatura Externa Terraço ( Ponto 10) | temperature | — | temperature | 2026-11-16T18:20 |
| 67 | Temperatura Alimentação G0( Ponto 04) | temperature | — | temperature | 2026-11-16T02:05 |
| 68 | Temperatura G0( Ponto 06) | temperature | — | temperature | 2026-11-16T18:20 |
| 69 | Temperatura Átrio G0 ( Ponto 05) | temperature | — | temperature | 2026-11-16T18:20 |
| 70 | Temperatura C&A(Ponto 07) | temperature | — | temperature | 2026-11-16T18:20 |
| 71 | Temperatua RiHappy(Ponto 9) | temperature | — | temperature | 2026-11-16T18:20 |
| 72 | Temperatura Melissa ( Ponto 8) | temperature | — | temperature | 2026-11-16T18:20 |
| 75 | Hidr. Cia_da_crianca x0.2 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 76 | Hidr. Crepfy_g1 x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 77 | Hidr. Youbella x1 0m3 ⚠ sem water | water | default | energy | — |
| 78 | Hidr. BK_Q_G1 x1 0m3 | water | default | energy, water | 2026-11-16T18:15 |
| 80 | Hidr. Bk_Q_G0 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 81 | Hidr. HappyMachine x1 0m3 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 84 | Hidr. Rihappy x1 | water | default | energy, temperature, water | 2026-11-16T18:15 |
| 85 | Repetidor Rihappy | energy | default | energy | — |
| 86 | Cacau Show | water | default | temperature, water | 2026-11-16T18:15 |
| 87 | SW Reborne | temperature | — | temperature | 2026-01-23T02:40 |
| 89 | Hidr. K-hot | water | default | temperature, water | 2026-11-16T18:15 |
| 90 | Hidr. Coco Bambu | water | — | temperature, water | 2026-11-16T18:15 |
