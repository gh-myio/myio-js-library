# Report_Afericao_Souza_Aguiar_10-02-2026_v2.pdf — transcrição completa + análise

> Transcrição integral do PDF fonte (3 páginas de conteúdo: capa, tabela comparativa, evidências
> fotográficas) + os campos que o item i) do e-mail de Pedro Mendes pede (desvio apurado, status
> de tolerância). Dado estruturado equivalente em
> [`Report_Afericao_Souza_Aguiar_10-02-2026_v2.json`](./Report_Afericao_Souza_Aguiar_10-02-2026_v2.json).
> Ver contexto completo em [`INPUT-AUDITORIA-FEVEREIRO-2026.md`](./INPUT-AUDITORIA-FEVEREIRO-2026.md).

## Capa / metadados (página 1)

| Campo | Valor |
|---|---|
| Título | Verificação de Temperatura — Sensores de Monitoramento |
| Cliente | Complexo Hospitalar Municipal Souza Aguiar |
| Data da Verificação | **10/02/2026** |
| Sensores Verificados | **30** |
| Data de Emissão | **12/02/2026** |
| Sistema | Myio — Monitoramento de Temperatura Hospitalar |

Este é **o relatório-base de 10/02/2026** que o item i) do e-mail de Pedro Mendes pede pra
retificar/complementar — com todos os 30 pontos, não só o recorte de 4 pontos N/A que o
`RT-MYIO-2026-004...pdf` (Anexo 1 do input) resume.

## Tabela "Comparativo por Dispositivo" (página 2) — transcrição literal + colunas calculadas

Colunas `Dispositivo`, `Hora`, `Temp. Referência (°C)`, `Temp. Myio (°C)` são transcrição
literal do PDF. Colunas `Desvio (°C)` e `Status` são **calculadas aqui** — `|referência − myio|`,
contra o critério de **±0,5 °C** definido no Anexo 2 do input (`Procedimento_Ajuste_Sensores...`,
§2, fundamentado no datasheet do DS18B20). Não estão no PDF original — são exatamente o que o
item i) pede para acrescentar.

| # | Dispositivo | Hora | Ref. (°C) | Myio (°C) | Desvio (°C) | Status |
|---|---|---|---|---|---|---|
| 1 | Cirurgia 01 | 15:28 | 22.1 | 22.00 | 0.10 | ✅ dentro |
| 2 | Cirurgia 02 | 14:37 | 21.9 | 21.00 | **0.90** | 🔴 fora |
| 3 | Cirurgia 03 | 15:33 | 21.0 | 21.00 | 0.00 | ✅ dentro |
| 4 | Cirurgia 04 | 14:40 | 21.4 | 20.55 | **0.85** | 🔴 fora |
| 5 | Cirurgia 05 | 14:43 | 23.3 | 23.00 | 0.30 | ✅ dentro |
| 6 | Cirurgia 06 | 14:50 | 18.6 | 18.00 | **0.60** | 🔴 fora |
| 7 | Cirurgia 07 | 14:59 | 19.8 | 20.20 | 0.40 | ✅ dentro |
| 8 | Cirurgia 08 | 15:09 | 22.6 | 21.71 | **0.89** | 🔴 fora |
| 9 | Cirurgia 09 | 15:14 | 20.1 | 20.00 | 0.10 | ✅ dentro |
| 10 | Cirurgia 10 | 15:21 | 21.2 | 20.01 | **1.19** | 🔴 fora |
| 11 | RPA | 15:17 | 21.9 | 21.01 | **0.89** | 🔴 fora |
| 12 | CTI 01 | 15:47 | 20.9 | 20.00 | **0.90** | 🔴 fora |
| 13 | CTI 02 | 15:52 | 21.0 | 21.00 | 0.00 | ✅ dentro |
| 14 | CTI 03 | 15:59 | 18.3 | 18.00 | 0.30 | ✅ dentro |
| 15 | CTI 04 | 16:04 | 20.3 | 20.65 | 0.35 | ✅ dentro |
| 16 | Hemodiálise | 16:11 | 23.3 | 23.00 | 0.30 | ✅ dentro |
| 17 | Laboratório | 16:15 | 22.1 | 22.00 | 0.10 | ✅ dentro |
| 18 | Agência Transfusional | 16:25 | 24.4 | 24.00 | 0.40 | ✅ dentro |
| 19 | Farmácia Satélite | 16:29 | 22.8 | 22.00 | **0.80** | 🔴 fora |
| 20 | CAF | 16:40 | 22.2 | 21.36 | **0.84** | 🔴 fora |
| 21 | Sala Verm. Infantil | 16:47 | 22.3 | 21.59 | **0.71** | 🔴 fora |
| 22 | Sala Verm. Adulto | 16:50 | 20.7 | 19.45 | **1.25** | 🔴 fora |
| 23 | Centro Obst. 01 | 17:08 | 19.6 | N/A | — | ⚠️ indisponível |
| 24 | Centro Obst. 02 | 17:14 | 21.8 | N/A | — | ⚠️ indisponível |
| 25 | Centro Obst. 03 | 17:17 | 21.2 | N/A | — | ⚠️ indisponível |
| 26 | UTI Neonatal | 17:22 | 21.5 | N/A | — | ⚠️ indisponível |
| 27 | Medicação CER | 17:37 | 22.0 | 22.00 | 0.00 | ✅ dentro |
| 28 | Queimados | 17:51 | 23.6 | 23.00 | **0.60** | 🔴 fora |
| 29 | Lactário | 18:06 | 20.5 | 20.00 | 0.50 | ✅ dentro (não é "*superior* a 0,5") |
| 30 | CME Sala Limpa | 18:30 | 23.1 | 23.00 | 0.10 | ✅ dentro |

## ⚠️ Achado — 12 de 26 pontos válidos (46%) estão fora da tolerância de ±0,5 °C

Contagem: **14 dentro**, **12 fora**, **4 indisponíveis** (N/A), de 30 pontos totais.

Pontos fora da tolerância (desvio > 0,5 °C): **Cirurgia 02** (0,90), **Cirurgia 04** (0,85),
**Cirurgia 06** (0,60), **Cirurgia 08** (0,89), **Cirurgia 10** (1,19), **RPA** (0,89), **CTI 01**
(0,90), **Farmácia Satélite** (0,80), **CAF** (0,84), **Sala Verm. Infantil** (0,71), **Sala
Verm. Adulto** (1,25), **Queimados** (0,60).

Isso é relevante direto pro item i) — a coluna "ação adotada (dentro da tolerância / ajustado /
substituído)" que o Pedro pediu **não pode ser preenchida só como "dentro da tolerância" pra
todo mundo**: pelo próprio critério que a MYIO define no Anexo 2, quase metade dos pontos
verificados em 10/02 estava fora do critério ±0,5 °C na hora da aferição. O relatório original
(este PDF) não registra nenhuma ação de ajuste tomada nesses 12 pontos — não há coluna de
offset, nem menção a intervenção. **Não dá pra saber, só com este documento, se algum ajuste foi
feito depois** (teria que cruzar com o histórico de offset por canal na plataforma, que é
exatamente uma das pendências já registradas no `INPUT-AUDITORIA-FEVEREIRO-2026.md`).

Isso não significa necessariamente um problema — desvios de até ~1,25 °C ainda são plausíveis
pra um sensor de baixo custo sem calibração recente, e o próprio Anexo 2 existe justamente para
tratar esse tipo de caso via offset. Mas **é o dado que falta pra responder "ação adotada" com
honestidade** — sem ele, complementar o relatório like pedido corre o risco de simplesmente
inventar "dentro da tolerância" pra pontos que não estavam.

## Anexo — Evidências Fotográficas (páginas 3–5)

Registro fotográfico do termo-higrômetro digital **Exbom** no momento da verificação, para
**os 30 pontos**, incluindo os 4 que ficaram N/A no MYIO (Centro Obst. 01/02/03 e UTI Neonatal —
a leitura de referência desses 4 também tem foto, confirmando o valor usado na tabela).

Layout: 3 fotos por página, legenda `{Dispositivo}` + `Hora: {hh:mm} | Ref: {valor}°C` sob cada
foto — mesmo padrão de legenda em todas as 30. Nenhuma foto adicional além das 30 (uma por
ponto).

## Cruzamento com os outros documentos do input

- **RT-MYIO-2026-004...pdf** (Anexo 1 do input): é um recorte deste relatório — só os 4 pontos
  N/A, com o relato da causa (central indisponível 17:08–17:22) e a mesma referência de horário/
  valor que aparece aqui. Os valores de referência dos 4 pontos batem exatamente entre os dois
  documentos (19.6 / 21.8 / 21.2 / 21.5 °C).
- **Procedimento_Ajuste_Sensores...pdf** (Anexo 2 do input): fornece o critério ±0,5 °C usado
  pra calcular a coluna `Status` acima, e o mecanismo de offset (item ii do e-mail do Pedro) —
  mas não tem nenhum registro de offset aplicado especificamente nesta rodada de 10/02.
- **emails-from-customer.log**: contém o e-mail de Pedro Mendes com o pedido completo (item i–iv)
  e o e-mail interno do Bruno pedindo ajuda com o item i.

## Pendências que este documento não resolve sozinho

- [ ] Confirmar se algum dos 12 pontos "fora" recebeu ajuste de offset depois de 10/02 (e
      quando) — sem isso não dá pra preencher a coluna "ação adotada" do item i) com precisão.
- [ ] Obter a leitura pós-intervenção dos 4 pontos N/A (Centro Obst. 01/02/03, UTI Neonatal),
      igual já registrado no `INPUT-AUDITORIA-FEVEREIRO-2026.md`.
- [ ] Definir se os 12 pontos fora de tolerância — mas que TÊM leitura MYIO (não são N/A) —
      também precisam de nova verificação pós-ajuste, ou se o pedido do Pedro (item i) é
      focado só nos 4 N/A. O texto do e-mail fala em ambos ("mantendo as três colunas... e
      acrescentando [para todos]" + "registro dos 4 pontos que constaram como N/A" como um
      subitem específico) — vale confirmar com ele qual é o escopo exato antes de entregar.
