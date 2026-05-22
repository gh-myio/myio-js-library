# Parecer Técnico v2 — Análise do retorno do analista (BOM Central MyIO 2.0)

> Segunda passada de revisão, sob ótica **IoT / DevOps / fleet management**.
> Avalia o retorno do analista ao [parecer v1](parecer-bom-central-myio-2-0-v1.md)
> e detalha os **5 pontos remanescentes** para uma v3 do BOM.
>
> Versão: **v2** — review do retorno. Autor: revisão técnica.
> Data: 2026-05-22.

---

## 0. Nota de procedência dos arquivos

> ⚠️ **Atenção:** no momento desta análise, o conteúdo dos arquivos está
> **trocado em relação aos nomes**:
>
> - `retorno-parecer-bom-central-myio-2-0-v1.md` → contém o **"BOM v2 —
>   production-ready"** (o BOM atualizado de fato, que incorpora o parecer v1).
> - `bom-completo-central-myio-2-0-v2.md` → contém o **BOM v1 original**
>   (datado 2026-05-19, apenas reformatado).
>
> **Todas as referências de linha neste parecer apontam para o arquivo
> `retorno-parecer-bom-central-myio-2-0-v1.md`**, que é onde o BOM v2 está
> fisicamente. Recomenda-se renomear os arquivos antes de prosseguir.

---

## 1. Veredito do retorno

O analista **endereçou as 7 ressalvas do parecer v1 — todas, com profundidade**.
Resposta forte. Adicionou ainda 4 tópicos próprios pertinentes (Anatel do produto
integrado, EMC/EMI, OPEX recorrente §I, tabela de risco consolidada §J).

Restam **5 pontos** para fechar antes do "go" de produção. Nenhum bloqueia o PoC.
Dois são materiais (itens 1 e 2); três são ajustes de redação/classificação de
risco (itens 3, 4, 5).

| # | Ponto | Severidade | Tipo | Onde no BOM v2 |
|---|---|---|---|---|
| 1 | Landed cost ausente dos totais | `[ALTA]` | Material — número errado | §C (linhas 424-461), §I (614) |
| 2 | HSM + estação de provisionamento do ATECC608A não orçados | `[ALTA]` | Material — NRE faltando | §14 (386, 394), §H (554, 563-570) |
| 3 | Papel do Wi-Fi não declarado (efeito do 5 GHz-only) | `[MÉDIA]` | Redação — risco oculto | §5 (222-238), mapeamento (67) |
| 4 | CM4 vira caminho crítico único | `[MÉDIA→ALTA]` | Classificação de risco | §1 (115-124), §J R9 (630) |
| 5 | R6 (EMC) subclassificado | `[MÉDIA→ALTA]` | Classificação de risco | §J R6 (627) vs R5 (626) |

---

## 2. Item 1 — Landed cost ausente dos totais `[ALTA]`

### Onde está no BOM v2

O custo de importação é **reconhecido em texto**, mas em dois lugares:

- **Linha 50-51** (*Premissas*):
  > "Frete + impostos BR: estimar **+60% federal sobre CIF + ICMS estadual**
  > sobre itens importados via Mouser/DigiKey/Waveshare/Sixfab"
- **Linha 500-501** (*§E ressalva 3*):
  > "Importacao BR: +60% federal sobre CIF + ICMS estadual. **Landed cost real
  > pode ser +80-100% sobre USD listado** em itens importados."

### O problema

O custo é reconhecido, mas **não é aplicado na conta final**. As tabelas de
total da **§C** calculam `BRL = USD × 5,50` puro:

- **Linhas 424-441** — tabela *CM4 PRODUÇÃO*:
  `TOTAL CM4 PRODUCAO (v2) — USD ~478 — BRL ~2.650`
- **Linhas 445-461** — tabela *RPi4 PoC*:
  `TOTAL RPi4 PoC (v2) — USD ~344 — BRL ~2.275`

Nenhuma linha dessas tabelas aplica os +60-100% que as próprias Premissas e a
§E mandam aplicar. **O documento sabe do imposto, mas a conta o ignora.**

### Consequência concreta

A **linha 614** (*§I*) usa o total subestimado:

> "5 anos: R$ 150.000-360.000 — Comparar com **CAPEX de R$ 265.000**
> (lote 100 + NRE diluído)"

Com landed cost real, a unidade CM4 produção sai de ~R$ 2.650 para
**~R$ 4.000-4.800**, e o CAPEX de 100 unidades sobe para a faixa de
**~R$ 400-480k** — o que altera materialmente a comparação CAPEX×OPEX da §I.

### Correção recomendada (v3)

Adicionar uma coluna **"BRL landed"** ao lado de `BRL (5.50)` nas tabelas da §C:

```
BRL landed (importado) = USD × câmbio × (1 + frete_rateado) × (1 + impostos)
```

- Itens importados (Mouser/DigiKey/Waveshare/Sixfab/Adafruit): aplicar fator
  **~1,8-2,0×** sobre o USD.
- Itens nacionais (RPi4 MakerHero/RoboCore, DPS Clamper): manter BRL direto.
- Recalcular o CAPEX da §I com o total landed.

---

## 3. Item 2 — HSM + estação de provisionamento do ATECC608A não orçados `[ALTA]`

### Onde está no BOM v2

A §14 (*Secure Element*) define o fluxo de bootstrap — **linhas 384-392**:

> "1. **Fabrica: provisionar slot 0 com chave privada unica (gerada pelo HSM
> da MyIO)**
> 2. Slot 0: configurar 'sign-only' (privkey nunca sai do chip)
> 3. Cloud: registrar pubkey da central no `cloud-server` ..."

E o esforço estimado — **linha 394-395**:

> "Esforço firmware: ~3-5 sprints (driver kernel ATECC608, integracao com
> `myio-cloud-reg.service`, mudanca no `cloud-server`)."

No NRE, a §H.1 orça o driver — **linha 554**:

> "Driver ATECC608A + integracao bootstrap (Secao 14) — 3-5 sprints — 30-50k"

### O problema

O fluxo da §14 **pressupõe duas coisas que não estão no BOM nem no NRE**:

1. **Um HSM da MyIO** para gerar/custodiar as chaves privadas mestras
   (linha 386: "gerada pelo HSM da MyIO"). HSM físico ou serviço cloud (AWS
   CloudHSM / KMS) tem custo de aquisição/assinatura — não aparece em lugar nenhum.
2. **Uma estação de provisionamento de fábrica** que injeta a chave única no
   slot 0 de cada ATECC608A, por unidade, com a configuração de slots travada.
   A §H.2 (*tooling*, linhas 563-570) orça fixture de `rpiboot` e bancada de
   teste funcional — **mas nenhum fixture de provisionamento de secure element**.

A §H.1 cobre o **software** (driver + integração). O **hardware/serviço de
provisionamento** (HSM + estação) é NRE faltando.

### Consequência concreta

Sem HSM e estação, o ATECC608A não pode ser provisionado em escala — o item
mais importante do parecer v1 (§4.4, identidade de hardware) fica com a ponta
de fabricação em aberto. Risco de descobrir isso só na hora de montar o lote.

### Correção recomendada (v3)

Adicionar à **§H.2 (tooling)**:

- HSM ou serviço KMS/CloudHSM — custo de aquisição ou assinatura anual.
- Estação de provisionamento de secure element (leitor I2C + software de
  injeção de chave + lock de configuração) — fixture de bancada.
- Estimar o esforço de engenharia do processo de provisionamento separado do
  driver kernel (são trabalhos distintos).

---

## 4. Item 3 — Papel do Wi-Fi não declarado `[MÉDIA]`

### Onde está no BOM v2

A mitigação do conflito 2.4 GHz está na §5 — **linhas 222-223**:

> "Conflito 2.4 GHz com Wi-Fi: mitigado **forcando Wi-Fi 5 GHz only** no
> `wpa_supplicant` / `hostapd` (CYW43455 e dual-band). Zero hardware extra."

Com a config concreta — **linhas 234-238** (`freq_list` só com canais 5 GHz).
E reforçado no mapeamento — **linha 67**: "CYW43455 dual-band; **forcar 5 GHz
only**". Aparece também na §J como R8 — **linha 629**.

### O problema

Forçar 5 GHz resolve a coexistência com o NRF24 (ambos disputariam 2.4 GHz),
mas **5 GHz penetra muito pior em concreto, alvenaria e subsolo** do que 2.4 GHz.

O BOM v2 **não declara em momento nenhum qual é o papel do Wi-Fi** na central:

- Se Wi-Fi é **uplink primário** em alguma instalação → forçar 5 GHz-only pode
  deixar a central **sem conectividade Wi-Fi** atrás de uma parede de concreto.
- Se Wi-Fi é **secundário** (uplink real = Ethernet ou 4G) → 5 GHz-only é
  aceitável e a mitigação está correta.
- Se Wi-Fi é só **comissionamento** (configuração inicial) → idem, sem problema.

A decisão técnica está tomada sem o pré-requisito declarado.

### Correção recomendada (v3)

Acrescentar à §5 uma frase declarando o **papel do Wi-Fi**:

- Se secundário/comissionamento: registrar isso explicitamente — fecha o ponto.
- Se primário em algum cenário: 5 GHz-only é risco; aí a mitigação do conflito
  2.4 GHz precisa ser outra (separação de canal/tempo, ou antena/blindagem).

---

## 5. Item 4 — CM4 vira caminho crítico único `[MÉDIA → ALTA]`

### Onde está no BOM v2

A §1 marca o RPi4 como **PoC-only** — **linhas 119-124**:

> "RPi4 marcado como **'PoC only' / 'ambiente climatizado'**. Nao tem variante
> industrial-temp. **Nao usar em quadro eletrico fechado** sem ar-condicionado."

E o changelog — **linha 20**: "abandona RPi4 para producao em quadro fechado".

O CM4 industrial tem lead time longo — **linhas 115-117**:

> "confirmar com revendedor se a variante 'T' esta em estoque BR. Se nao,
> importacao direta = lead time **4-8 semanas**."

Na §J isso aparece como R9 — **linha 630**:

> "R9 — Estoque CM4 instavel BR — **MEDIA** — Comprar lote maior; ou PoC com RPi4"

### O problema

Ao remover o RPi4 da produção, **toda a produção passa a depender de um único
SBC: o `CM4104032T`**. Não há mais plano B de placa. Logo:

- R9 não é mais MÉDIA — é **ALTA**: a indisponibilidade do CM4 não atrasa "uma
  opção", ela **trava 100% da produção**.
- A mitigação "comprar lote maior" **amarra capital** em estoque de SBC e ainda
  não cobre a janela de 4-8 semanas do primeiro lote.
- A mitigação "ou PoC com RPi4" não se aplica a R9 em produção — RPi4 foi
  justamente removido da produção.

### Correção recomendada (v3)

- Reclassificar **R9 para ALTA** na §J.
- Mitigação real: (a) qualificar **mais de um revendedor** do `CM4104032T`
  (Newark + Mouser + distribuidor BR) antecipadamente; (b) colocar o lead time
  de 4-8 semanas explicitamente no cronograma de produção; (c) decidir o
  tamanho do estoque de segurança como decisão financeira consciente, não como
  "comprar lote maior".

---

## 6. Item 5 — R6 (EMC) subclassificado `[MÉDIA → ALTA]`

### Onde está no BOM v2

Na tabela de risco consolidada §J:

- **Linha 627** — "R6 — EMC fail — **MEDIA** — NRE R$ 15-30k em laboratorio"
- **Linha 626** — "R5 — Anatel produto integrado — **ALTA** — NRE R$ 25-40k
  antes de venda"

E na §H.3, EMC/EMI e Anatel aparecem juntos como certificações legais
bloqueantes — **linhas 576-577**.

### O problema

R6 e R5 estão classificados em níveis diferentes (MÉDIA vs ALTA), mas são
**acoplados**: a homologação Anatel do produto integrado (R5) **inclui ensaios
de EMC**. Uma falha de EMC (R6) **bloqueia a homologação Anatel** (R5).

Não faz sentido o pré-requisito (R6) ter severidade menor que o resultado que
ele bloqueia (R5). Se R5 é ALTA por ser "bloqueante para vender", R6 é
igualmente bloqueante — pela transitividade.

### Consequência concreta

Subclassificar R6 faz a falha de EMC parecer um contratempo de orçamento
(R$ 15-30k de laboratório) quando na verdade é um **bloqueio de cronograma de
lançamento** — reprovar em EMC implica redesign + reteste + nova fila de
laboratório, facilmente 2-4 meses.

### Correção recomendada (v3)

- Reclassificar **R6 para ALTA** na §J.
- Anotar a dependência explícita: "R6 é pré-requisito de R5 — falha de EMC
  trava a homologação Anatel".
- Tratar R5+R6 como um único marco de cronograma na trilha de certificação
  (§H.3 / §K passo 5).

---

## 7. Conclusão

O retorno do analista é **sólido**: as 7 ressalvas do parecer v1 estão
fechadas e o BOM v2 ganhou seções relevantes (NRE, OPEX, risco consolidado).

O BOM v2 está **apto a sustentar PoC e piloto** sem ressalvas.

Para o **"go" de produção**, restam os 5 pontos acima:

- **Itens 1 e 2 são materiais** — o item 1 corrige um número que hoje subestima
  o CAPEX em ~50-80%; o item 2 fecha a ponta de fabricação do secure element.
  Ambos devem entrar numa **v3 do BOM** antes do fechamento de lote.
- **Itens 3, 4 e 5 são ajustes de redação e de classificação de risco** —
  baratos de resolver, mas importantes para o documento não esconder risco.

Recomendação: **v3 do BOM** incorporando os 5 itens; após isso, o documento
está pronto para fechamento de ordem de compra de produção (junto com o
Anexo G zerado, já listado como passo K.1 pelo próprio analista).

---

## Referências

- [parecer-bom-central-myio-2-0-v1.md](parecer-bom-central-myio-2-0-v1.md) — parecer original (7 ressalvas)
- `retorno-parecer-bom-central-myio-2-0-v1.md` — BOM v2 do analista (alvo desta análise; ver §0)
- [bom-completo-central-myio-2-0.md](bom-completo-central-myio-2-0.md) — BOM v1
- [mapa-mental-meta-myio-monorepo.md](mapa-mental-meta-myio-monorepo.md) — contexto Yocto/OTA
