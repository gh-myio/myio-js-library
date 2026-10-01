# Input da Auditoria — Fevereiro 2026

> Documento de entrada (input) para a auditoria. Reúne o e-mail motivador (externo, do
> cliente) + o e-mail interno que dispara o pedido de ajuda + os 2 anexos, sem análise ainda —
> a análise é o próximo passo, feito a partir deste input.

## Contexto

1 e-mail motivador da auditoria (externo, do cliente) + 1 e-mail interno de pedido de ajuda + 2
anexos, todos referentes ao Complexo Hospitalar Municipal Souza Aguiar (Smart Hospital),
registrados em `emails-from-customer.log`.

O e-mail motivador real é do **cliente** (Pedro Mendes, Gerente da Qualidade) e traz a lista
completa de itens **i) a iv)**. O e-mail do Bruno (que ele mandou pra equipe pedindo ajuda) só
cobre o **item i)** especificamente — os outros itens, segundo o próprio Bruno, "já [têm]
documentos que já explicam".

## E-mail 01 — motivador (cliente → MYIO)

**De:** Pedro Tavares Mendes `<pedro.mendes@smarthospitals.net>`
**Enviado:** sexta-feira, 28 de agosto de 2026, 11:44
**Para:** Bruno Dantas `<bruno@myio.com.br>`; João Paulo Couto `<jp@myio.com.br>`
**Cc:** Gleyce Perrout; Qualidade CHMSA; Alexandre Esteves Ribeiro (todos `@smarthospitals.net`)
**Assunto:** Solicitações VI

> Prezado Bruno, bom dia.
>
> Encaminho as solicitações do VI referente ao relatório e procedimento de ajuste via sistema.
>
> Indico que a emissão do relatório de medição mensal da concessionária está condicionada a
> este tema. Contamos com a parceria e me coloco à disposição para sanar quaisquer dúvidas.
>
> **i) Relatório de verificação por comparação — com valores pós-ajuste**
> Retificação/complemento do relatório de 10/02/2026, mantendo as três colunas atuais
> (ambiente, temperatura de referência, temperatura Myio) e acrescentando: desvio apurado,
> ação adotada (dentro da tolerância / ajustado / substituído) e leitura após a intervenção,
> aferida contra o mesmo equipamento de referência.
> Registro dos 4 pontos que constaram como "N/A" (Centros Obstétricos 01, 02 e 03 e UTI
> Neonatal), com a justificativa da indisponibilidade e a leitura obtida após a regularização.
> Se houver verificações posteriores (março a agosto/2026), encaminhar no mesmo formato — sem
> prejuízo da entrega da versão complementada de fevereiro, que é a base do período
> questionado.
>
> **ii) Descrição formal do processo de ajuste via sistema**
> Documento técnico explicando como o ajuste é aplicado na plataforma (parametrização de
> offset, alteração de fator de conversão ou substituição física), com o encadeamento:
> identificação do desvio → ajuste → nova verificação.
> Fundamentação normativa do procedimento e do critério de tolerância de ±0,5 °C, indicando se
> decorre de especificação técnica do fabricante do sensor (anexar a folha de dados/datasheet)
> ou de norma aplicável.
> Periodicidade das verificações e dos ajustes, e critérios que disparam intervenção
> extraordinária.
> Mecanismos de detecção automática de desvio ou falha ao longo do tempo (alertas de leitura
> fora de faixa, perda de comunicação, bateria, deriva do sensor) e como geram acionamento da
> manutenção.
>
> **iii) Comprovação do monitoramento contínuo pelo fornecedor**
> Declaração formal da Myio atestando que os sensores instalados no CHMSA estão sob
> monitoramento e manutenção contínuos, com verificação periódica e substituição/ajuste sempre
> que identificado desvio acima da tolerância.
> Evidência de que a validação pós-instalação inclui conferência contra instrumento de
> referência — complementando a expressão genérica "instalados e validados com leitura
> correta" com o registro dos valores efetivamente aferidos.
>
> **iv) Inventário e rastreabilidade individual dos sensores**
> Listagem dos 30 sensores com: ambiente, identificação do dispositivo (nº de série/TAG), data
> de instalação e data da última verificação.
> Histórico por dispositivo das unidades substituídas em 27/03 e 12/05/2026, indicando o
> equipamento retirado e o instalado.
> Especificação técnica do modelo (faixa de medição, resolução e exatidão declarada pelo
> fabricante) — documento que sustenta objetivamente a tolerância de ±0,5 °C.
>
> Atenciosamente,
> Pedro Mendes | 21 97941-5380 | Gerente da Qualidade

## E-mail 02 — pedido de ajuda interno (Bruno → equipe MYIO)

**De:** Bruno (MYIO)

> Pessoal, preciso de ajuda para responder o item i). Vou já encaminhar aqui os documentos que
> já explicam os outros itens. Foi enviado um documento no dia 12/02 pelo João, nele constam as
> temperaturas de referência e temperaturas da Myio. Porém analisando no Dashboard as
> tempraturas estão diferentes do que estão no documento mencionado. Gostaria que vocês
> pudessem dar uma olhada e me ajudar a entender e justificar. Precisamos disso para agora de
> manhã. Como eu fiquei fora do contexto, e já tem muito tempo precisava entender realmente os
> dados do relatório.

> **Nota:** "o João" aqui é o **João Paulo Couto** (`jp@myio.com.br`), colega de equipe MYIO
> cc'ado no e-mail 01 — não é ninguém do lado do cliente. Ou seja, o "documento enviado no dia
> 12/02 pelo João" é, com grande probabilidade, o próprio Anexo 1 abaixo (relatório assinado
> pela Diretoria Técnica MYIO, emitido 12/02/2026), encaminhado internamente/externamente por
> ele.

## Anexo 1 — `RT-MYIO-2026-004_Temperatura_Centro_Obstetrico_UTI_Neonatal_1.pdf`

Relatório Técnico da MYIO (assinado pela Diretoria Técnica), **Data de Emissão: 12/02/2026** —
mesma data citada no e-mail do Bruno. **É o relatório de 10/02/2026 que o item i) pede pra
retificar/complementar.**

- ⚠️ Nota: o nome do arquivo traz "004", mas o corpo do documento se autorreferencia como
  **"RT-MYIO-2026/003"** — divergência entre nome do arquivo e referência interna, vale
  confirmar qual é a numeração correta antes de citar o documento formalmente.

**Conteúdo:**
- **Objeto:** documentar indisponibilidade do sistema de registro de temperatura no Centro
  Obstétrico e UTI Neonatal (Maternidade MABH) em **10/02/2026**, intervalo aproximado das
  **17:08 às 17:22**.
- **4 pontos sem leitura automatizada** (N/A) nesse intervalo: Centro Obst. 01 (17:08), Centro
  Obst. 02 (17:14), Centro Obst. 03 (17:17), UTI Neonatal (17:22) — **exatamente os 4 pontos
  que o item i) pede pra registrar com a leitura pós-regularização**. Os demais 26 pontos foram
  registrados normalmente.
- **Causa raiz:** indisponibilidade momentânea da central de automação MYIO (não dos sensores
  de campo). Central reestabelecida em 11/02/2026.
- **Tabela comparativa atual (Anexo I do relatório) — as 3 colunas que o item i) pede pra
  manter, mais as que faltam acrescentar:**

  | Ponto | Horário | Temp. Referência | Registro MYIO | *Desvio apurado (falta)* | *Ação adotada (falta)* | *Leitura pós-intervenção (falta)* |
  |---|---|---|---|---|---|---|
  | Centro Obst. 01 | 17:08 | 19,6 °C | N/A | — | — | — |
  | Centro Obst. 02 | 17:14 | 21,8 °C | N/A | — | — | — |
  | Centro Obst. 03 | 17:17 | 21,2 °C | N/A | — | — | — |
  | UTI Neonatal | 17:22 | 21,5 °C | N/A | — | — | — |

- **Anexo II do relatório:** registro fotográfico das leituras do termo-higrômetro de
  referência certificado nos 4 ambientes, comprovando que estavam dentro dos parâmetros de
  temperatura durante a indisponibilidade.
- **Conclusão do relatório original:** falha isolada e pontual do equipamento de coleta MYIO,
  sem relação com a condição térmica real dos ambientes.

## Anexo 2 — `Procedimento_Ajuste_Sensores_Myio_com_Anexo_1.pdf`

Procedimento técnico da MYIO — **Emissão: Agosto/2026, Rev. 01**. **Cobre o item ii) quase
integralmente** — é literalmente a "descrição formal do processo de ajuste via sistema" que o
Pedro pediu.

**Cobertura do item ii), ponto a ponto:**
- ✅ "Como o ajuste é aplicado" (offset / fator de conversão / substituição física) — §3.
- ✅ Encadeamento identificação → ajuste → nova verificação — §3–4.
- ✅ Fundamentação normativa do critério ±0,5 °C — §2, com citação direta do datasheet do
  DS18B20 (Maxim Integrated, doc. 19-7487 Rev. 6, tERR = ±0,5 °C na faixa −10 °C a +85 °C) — o
  próprio Anexo A do documento já é o datasheet anexado, então esse subitem do ii) também está
  coberto.
- ✅ Periodicidade e gatilhos de intervenção extraordinária — §5.
- ✅ Mecanismos de detecção automática (fora de faixa, perda de comunicação, bateria, deriva) —
  §6.

**Conteúdo adicional relevante:**
- Exemplo real de offset aplicado: canal `Temp. Co2_CC05` com offset de **−1,67 °C**.
- Fluxo Node-RED (nó "Transform temperature reading to device update") onde o offset é tratado
  antes de publicar no ThingsBoard.
- Escopo: ambientes críticos do CHMSA (centros cirúrgicos, CTI, hemodiálise, laboratório,
  agência transfusional, farmácia, CME, centro obstétrico, entre outros), todos com sensor
  DS18B20.

## Anexo 3 — `Report_Afericao_Souza_Aguiar_10-02-2026_v2.pdf`

**O relatório-base completo de 10/02/2026 com os 30 pontos** (o `RT-MYIO-2026-004...pdf` do
Anexo 1 é só o recorte dos 4 N/A deste relatório). Transcrição integral + tabela com
desvio/status calculados em
[`Report_Afericao_Souza_Aguiar_10-02-2026_v2.md`](./Report_Afericao_Souza_Aguiar_10-02-2026_v2.md),
dado estruturado em
[`Report_Afericao_Souza_Aguiar_10-02-2026_v2.json`](./Report_Afericao_Souza_Aguiar_10-02-2026_v2.json).

**⚠️ Achado principal:** aplicando o critério ±0,5 °C do Anexo 2 aos 30 pontos, **12 de 26
pontos com leitura válida (46%) estão fora da tolerância** — Cirurgia 02/04/06/08/10, RPA,
CTI 01, Farmácia Satélite, CAF, Sala Verm. Infantil, Sala Verm. Adulto, Queimados (desvios de
0,60 a 1,25 °C). O relatório original não registra nenhuma ação de ajuste pra esses 12 pontos.
Isso é além (e independente) do problema dos 4 pontos N/A — muda o que a coluna "ação adotada"
do item i) pode dizer com honestidade: não dá pra marcar "dentro da tolerância" pra quase
metade dos pontos sem antes confirmar se algum ajuste foi feito depois de 10/02.

## Itens ainda sem documento (não cobertos pelos 3 anexos)

- **Item i)** — parcialmente coberto: o Anexo 3 tem a base completa (30 pontos, 3 colunas +
  desvio calculado), mas faltam "ação adotada" e "leitura pós-intervenção" pra **todos os 30
  pontos** — não só os 4 N/A, já que 12 outros também estão fora de tolerância (ver Anexo 3
  acima). Sem o histórico de offset por canal, não dá pra preencher essas 2 colunas com
  segurança pra nenhum dos 16 pontos problemáticos (12 fora + 4 N/A). Ver hipótese abaixo.
- **Item iii)** — nenhum dos 2 anexos é uma declaração formal de monitoramento contínuo. Precisa
  ser redigido do zero (MYIO atestando monitoramento/manutenção contínuos + evidência de
  validação pós-instalação contra referência).
- **Item iv)** — nenhum dos 2 anexos tem o inventário dos 30 sensores (ambiente, nº de
  série/TAG, datas de instalação/última verificação) nem o histórico de substituição de
  27/03 e 12/05/2026. Precisa ser levantado à parte (provavelmente no sistema de visita técnica
  citado no Anexo 2, Figura 4).

## Hipótese de trabalho para a divergência Dashboard × relatório de 12/02

O Anexo 1 mostra o estado **no momento da indisponibilidade** (10/02, 17:08–17:22): 4 pontos em
N/A. O Dashboard, consultado agora (fim de agosto), mostra o estado **atual** desses mesmos
pontos — já com a central reestabelecida (11/02) e possivelmente com offset de canal ajustado
desde então (o Anexo 2 confirma que isso é prática padrão, com pelo menos 1 exemplo real
registrado). Ou seja, **os dois documentos não deveriam mesmo bater** — não são a mesma
fotografia no tempo. O que o item i) pede é exatamente isso: uma tabela que já compare
"referência de 10/02" × "leitura pós-intervenção", eliminando a comparação enganosa entre um
dado histórico (relatório) e um dado corrente (Dashboard) que hoje não têm o mesmo carimbo de
tempo.

**Ainda precisa confirmar** (não é conclusão, é a linha de investigação mais direta a partir do
que já temos):

- [ ] Confirmar a numeração correta do Anexo 1 (arquivo diz "004", documento diz "RT-MYIO-2026/003").
- [ ] Obter o(s) offset(s) atualmente configurado(s) para os canais dos 4 pontos (Centro Obst.
      01/02/03, UTI Neonatal) e comparar com o que estava valendo em 12/02/2026 — inclusive se
      esses 4 canais já tiveram algum ajuste registrado desde 10/02.
- [ ] Puxar do Dashboard os valores atuais para os mesmos 4 pontos/horários e montar a tabela
      completa das 6 colunas pedidas no item i), para os 30 pontos (não só os 4 N/A).
- [ ] Levantar o inventário dos 30 sensores + histórico de substituição (27/03, 12/05/2026)
      para o item iv).
- [ ] Redigir a declaração formal de monitoramento contínuo para o item iii).
