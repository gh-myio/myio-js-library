🧩 MVP Prompt – Painel de Indicadores (Escadas & Elevadores)
🎯 Objetivo

Construir um Painel de Indicadores Operacionais no ThingsBoard para monitoramento de escadas rolantes e elevadores.
O painel deve ser composto por cards modulares, atualizados em tempo real, com alertas automáticos e relatórios consolidados.

🧠 Conceito Base

Cada equipamento (Escada ou Elevador) gera um card individual exibindo:

Disponibilidade (%)

MTBF (horas) – tempo médio entre falhas

MTTR (horas) – tempo médio de reparo

Status atual (Online / Offline)

Reversão de Sentido (detecção por inversão de fase)

E há também:

Visão Consolidada (média de todos os equipamentos)

Lista de Alertas Recentes

⚙️ Lógica de Cálculo

Disponibilidade (%)

Disponibilidade = MTBF / (MTBF + MTTR) \* 100

MTBF (horas)

(Tempo total de operação – tempo de manutenção) / número de paradas

MTTR (horas)

(Tempo total de manutenção) / número de paradas

⏱️ Regras de Operação

Consulta em tempo real (dados atualizados D-1)

Relatório global mensal com histórico de aferições

Janela de inatividade: entre 22h e 5h, equipamentos devem entrar em estado OFF automático

Gatilho de alerta por e-mail para @Atendentes_CME, equipe de Mecânica e CCM

Alerta adicional: variação anormal na frequência da rede elétrica

Reversão de sentido: gerada quando detectada inversão de fase

📊 Indicadores Técnicos Complementares

Frequência da Rede Elétrica – avalia qualidade da energia

Potência Demandada – compara consumo real vs carga nominal

Intensidade de Corrente – monitora fases R/S/T dos motores

Tensão Elétrica – monitora alimentação trifásica em tempo real

Consumo de Energia – consolida dados por mês / hora / dia

💌 Alertas Automáticos

Paralisação do equipamento → e-mail / mensagem

Oscilação de rede elétrica → alerta por variação configurável

Equipamento offline (10pm–5am) → e-mail automático

Inversão de fase (Reversão de sentido) → notificação prioritária

🧱 Arquitetura Visual (Lovable Cards)

Cada card modular deve seguir o padrão:

Campo Tipo Exemplo
🏷️ Nome Texto Escada 01
⚙️ Status Badge (verde/vermelho) Online
🔁 Reversão Ícone animado / alerta “Inversão detectada”
📈 Disponibilidade Gauge Circular 97%
⏳ MTBF Texto 12.4h
🔧 MTTR Texto 0.6h
⚠️ Alertas Contador 3 recentes

Cards organizados em grid responsiva, com:

Filtro por tipo de equipamento

Switch “Visão Consolidada”

Botão “📑 Exportar Relatório Mensal”

🧩 Arquitetura de Dados

Fonte: Telemetrias ThingsBoard (server scope / client scope)
Atualização: a cada 1 minuto (tempo real)
Armazenamento de histórico: atributos de telemetria consolidados por hora

📤 Relatórios Automáticos

Diário (D-1): snapshot de disponibilidade e MTTR/MTBF

Mensal: relatório global de aferições consolidado (PDF/CSV)

💡 Versão MVP – Fase 1

Cards de indicadores individuais

Cálculo automático de disponibilidade

Alerta por e-mail de offline (22h–5h)

Visão consolidada simples (média geral)

Relatório mensal com ranking

🚀 Evolução Futura

Filtros dinâmicos (Shopping, Zona, Andar, Tipo)

Integração com painel de energia e climatização

IA para predição de falhas por padrão MTBF histórico

---

Aqui está um Sumário Executivo claro e direto, pronto para inserir no topo do RFC ou apresentação do MVP dos indicadores 👇

🧭 Sumário Executivo — MVP Painel de Indicadores (Escadas & Elevadores)

O presente MVP tem como objetivo implementar um Painel de Indicadores Operacionais no ThingsBoard, voltado ao monitoramento inteligente de escadas rolantes e elevadores da Myio.
O painel fornecerá uma visão consolidada e modular de desempenho, permitindo análise em tempo real, alertas automáticos e relatórios mensais de eficiência operacional.

🎯 Objetivos Principais

Monitorar a disponibilidade operacional (%) de cada equipamento.

Calcular e acompanhar os indicadores MTBF (Tempo Médio entre Falhas) e MTTR (Tempo Médio de Reparo) em horas.

Exibir uma visão individual e consolidada de desempenho por equipamento e grupo.

Criar alertas automáticos para eventos críticos (falhas, oscilações de rede, reversão de sentido, equipamentos offline).

Disponibilizar relatórios diários (D-1) e mensais com histórico comparativo.

⚙️ Características-Chave do MVP

Atualização em tempo real via telemetria ThingsBoard.

Cards modulares exibindo indicadores e status em layout responsivo.

Automação de alertas por e-mail para equipes CME, Mecânica e CCM.

Janela de inatividade (22h–5h) com alerta automático de OFF.

Monitoramento elétrico completo: frequência, tensão, corrente, potência e consumo.

Detecção de reversão de sentido por inversão de fase.

📊 Indicadores de Desempenho

Disponibilidade (%) = MTBF / (MTBF + MTTR) × 100

MTBF (h) = (Tempo de operação – tempo de manutenção) / nº de paradas

MTTR (h) = Tempo de manutenção total / nº de paradas

🧩 Entrega Inicial (Fase 1 - MVP)

Cards individuais e consolidados (Disponibilidade, MTBF, MTTR).

Cálculo automático e atualização D-1.

Envio automático de alertas (paradas, variações de rede, reversões).

Relatório mensal consolidado em PDF/CSV.

🚀 Benefícios Esperados

Aumento da confiabilidade operacional e redução de tempo de inatividade.

Visibilidade imediata de falhas e tendências de manutenção.

Integração total com a plataforma Myio, fortalecendo a automação e a análise de dados.

---
