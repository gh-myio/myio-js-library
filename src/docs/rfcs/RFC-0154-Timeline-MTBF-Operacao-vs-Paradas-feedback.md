Feedback – Gráfico Timeline MTBF – Operação vs Paradas
1️⃣ O gráfico é mais ilustrativo do que informativo

Hoje ele parece um mock:

Blocos “1” e “2” não significam nada para o usuário

Não há datas, horários, nem duração explícita

“MTBF: 145h” aparece solto, sem ligação clara com os eventos

👉 Resultado: o usuário olha e não aprende nada novo.

2️⃣ Falta escala de tempo real (principal problema)

Um gráfico de timeline precisa de tempo explícito.

Problemas atuais:

Eixo X só diz “HORAS”, mas:

Horas desde quando?

Em que dia ocorreu a falha?

Quanto durou cada bloco?

Sugestão objetiva:

Eixo X com:

Data + Hora (ex: 12/01 08:30 → 15/01 14:10)

Ou duração explícita em cada bloco (ex: Operando: 96h)

3️⃣ Eventos de falha estão invisíveis

“Quebra/Falha” aparece apenas como um marcador visual, mas:

Não mostra quantas falhas

Não mostra quanto tempo parado

Não mostra impacto no MTBF

Sugestões:

Tooltip obrigatório ao passar o mouse:

Falha em 18/01 03:12

Tempo parado: 2h15

Equipamento: Bomba Chiller 02

Ícone de falha mais evidente (não só um risquinho)

4️⃣ MTBF não é explicável visualmente

O valor MTBF: 145h não se conecta com os blocos.

Melhoria clara:

Mostrar:

MTBF = (Tempo total de operação) / (Número de falhas)

Visualmente:

Linha pontilhada ou bracket explicando o cálculo

Ou legenda lateral explicando como aquele número foi obtido

5️⃣ Falta legenda e semântica clara

Hoje o usuário precisa adivinhar:

Amarelo = Operação?

Azul = OFF?

Blocos numerados = ciclos?

Obrigatório:

Legenda fixa:

🟨 Operando

⛔ Parado / Falha

🔧 Manutenção (se existir)

Remover números “1” e “2” ou substituí-los por:

Ciclo 01

Ciclo 02

6️⃣ Falta conexão com os KPIs de cima

O gráfico deveria explicar os números, mas hoje não explica.

Exemplo de conexão esperada:

“MTBF Médio: 342h” (card)

Timeline mostrando:

Falha 1 após 310h

Falha 2 após 375h

Média visual clara

7️⃣ Sugestão de ouro (UX)

Se não houver dados suficientes, o gráfico não deveria aparecer assim.

Estados recomendados:

🟡 “Dados insuficientes para exibir timeline de MTBF neste período”

🔵 “Nenhuma falha registrada no período — MTBF infinito”

Isso é muito melhor do que mostrar algo “vazio”.

Resumo direto para o time (copy-paste friendly)

O gráfico Timeline MTBF hoje é ilustrativo, mas não informativo.
Falta escala temporal real, duração dos eventos, tooltips com dados, legenda clara e conexão visual com o cálculo do MTBF.
Do jeito atual, o usuário não consegue interpretar quando ocorreram falhas, quanto tempo os equipamentos ficaram operando ou parados, nem como o MTBF foi calculado.
