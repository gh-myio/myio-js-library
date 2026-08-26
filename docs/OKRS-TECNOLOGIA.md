# OKRs — Tecnologia (espelho do painel)

> Espelho do **OKR Tracker** (okrmyio.lovable.app) · **Q3 2026** (jul–set) · dimensão **Tecnologia** · sincronizado em 2026-08-24 via engenharia reversa KR a KR (leitura direta do painel + histórico de check-ins via API, sem escrita).
> Fonte da verdade = o painel; este arquivo é gerado por engenharia reversa dos dados do painel. Status (🟢/🟠/🔴) e progresso são os valores **exibidos pelo painel**, não recalculados — cada Key Result foi conferido individualmente.

**9 objetivos · 41 Key Results · Progresso médio 30% (esperado ~59% no ponto do quarter, -29pp) · 2 No Caminho 🟢 · 1 Em Risco 🟠 · 6 Atrasados 🔴**

Ordenação: Prioridade por área (P1 → P4), igual ao painel.

## 1. [P1] Ecossistema de Autenticação MYIO

- **Status:** 🔴 Atrasado · **Progresso:** 24% · **Responsáveis:** Rodrigo Lago · André Abadesso
- **Descrição:** Desenvolvimento de um ecossistema completo usando Auth0 para gerenciar os logins de forma integrada e com controle de escopo e perfis

1. **Reunião inicial de validaçào e entendimento da demanda** — 100/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"Reunião já feita e alinhamento já estruturado."_ (2026-08-10)
2. **Implementação Inicial** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago / André
3. **Virada para Produção** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago / André
4. **Múltiplos Testes** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago / André
5. **Design inicial do sistema de autenticação** — 20/100 % · 🔴 Atrasado · responsável: Rodrigo Lago / André — _"Design inicial feito e aguardando validação de próximos passos."_ (2026-08-10)

## 2. [P1] Zerar risco de perda de dado em produção

- **Status:** 🔴 Atrasado · **Progresso:** 5% · **Responsáveis:** Rodrigo Lago
- **Descrição:** Detectar centrais instáveis, e quando voltar pensar em buscar os dados dos sensores acumulados

1. **Detecção automática de lacunas de dados por central, a cada hora** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
2. **Preenchimento automático (interpolação) das lacunas dentro da tolerância** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
3. **Módulo em operação em toda a lista de dispositivos** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
4. **Abertura automática de incidente quando a lacuna ultrapassa o limite** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
5. **Regras de tolerância por tipo de equipamento (GCDR)** — 25/100 % · 🔴 Atrasado · responsável: Rodrigo Lago — _"Design da solução feito "_ (2026-08-17)

## 3. [P2] Cockpit de auditoria de logs das aplicações

- **Status:** 🔴 Atrasado · **Progresso:** 20% · **Responsáveis:** Rodrigo Lago
- **Descrição:** Centralizar logs, alarmes, dashboards e presetup em painel único

1. **Painel único de logs de todas as aplicações** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
2. **Cockpit** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
3. **Alertas automáticos de falha/atraso por aplicação** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
4. **Reunião inicial de validação e entendimento da demanda** — 100/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"Reunião já realizada."_ (2026-08-17)
5. **Retenção e organização do histórico de logs (90 dias)** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago

## 4. [P2] Gestão de Node-RED por central

- **Status:** 🔴 Atrasado · **Progresso:** 16% · **Responsáveis:** Rodrigo Lago
- **Descrição:** Inventário de versão de runtime e contribs por central x Pipeline de update com fix e rollback versionado

1. **Inventário de versão e componentes por central** — 80/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"Inventário realizado de forma geral"_ (2026-08-17)
2. **Padronização do runtime em toda a lista de dispositivos** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
3. **Atualização com correção e reversão controladas** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
4. **Detecção de divergência entre central e versão oficial** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
5. **Implantação gradual com rollback de 1 clique** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago

## 5. [P2] Auto-construtor e auto-sync de devices no ecossistema

- **Status:** 🟠 Em Risco · **Progresso:** 35% · **Responsáveis:** Rodrigo Lago
- **Descrição:** Implementar conformidade ThingsBoard x Detecção e correção automática de divergência de cadastro

1. **Criação automática de equipamento a partir do perfil** — 25/100 % · 🔴 Atrasado · responsável: Rodrigo Lago — _"Algoritmo em validação manual"_ (2026-08-17)
2. **Verificação automática de cadastro** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
3. **Conformidade de cadastro entre plataformas** — 25/100 % · 🔴 Atrasado · responsável: Rodrigo Lago — _"Algoritmo em validação manual"_ (2026-08-17)
4. **Sincronização contínua de equipamentos** — 25/100 % · 🔴 Atrasado · responsável: Rodrigo Lago — _"Algoritmo em validação"_ (2026-08-17)
5. **Mapeamento completo de equipamentos entre plataformas** — 100/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"feito"_ (2026-08-17)

## 6. [P3] Monitoramento de centrais dentro do GCDR

- **Status:** 🟢 No Caminho · **Progresso:** 50% · **Responsáveis:** Rodrigo Lago
- **Descrição:** Central como entidade de primeira classe no GCDR x Telemetria de saúde por central (uptime, versão, conectividade)

1. **Integração ao painel de centrais + cockpit de logs** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
2. **Alerta de central offline ou fora do padrão** — 50/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"Já existe um alerta pelo SLACK só falta padronizar para todo ecossistema GCDR / Alertas Myio"_ (2026-08-17)
3. **Central como entidade oficial no GCDR** — 100/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"feito"_ (2026-08-17)
4. **Comandos remotos de rede (backup/restore, etc)** — 50/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"Interface implementada, faltam mais testes"_ (2026-08-17)
5. **Telemetria de saúde por central (disponibilidade, versão, conexão)** — 50/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"Healthy check nas centrais com novo Build OK. E nas antigas equalizar o node red"_ (2026-08-17)

## 7. [P3] Backup e restore das centrais no GCDR

- **Status:** 🔴 Atrasado · **Progresso:** 30% · **Responsáveis:** Rodrigo Lago
- **Descrição:** Runbook único de backup/restore para OrangePi/Mender

1. **Restore validado (simulado) antes de aplicar em campo** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
2. **Backup automático e versionado por central** — 100/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"Feito"_ (2026-08-17)
3. **Runbook único de backup/restore** — 50/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"Feito parcial, falta equalizar os bancos."_ (2026-08-17)
4. **Alerta de central sem backup recente** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
5. **Inventário com data do último backup válido** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago

## 8. [P4] Anotações com upload de imagens e uso de MCP do Ingestion

- **Status:** 🔴 Atrasado · **Progresso:** 31% · **Responsáveis:** Rodrigo Lago
- **Descrição:** Anotações com upload de imagens e uso de MCP do Ingestion

1. **Histórico visual vira base de conhecimento para treinamento de novos técnicos** — 0/100 % · 🔴 Atrasado · responsável: Rodrigo Lago
2. **MCP Ingestion enriquece com contexto: última leitura, histórico de alarmes, manuais** — 50/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"Versão inicial do GCDR já com MCP"_ (2026-08-17)
3. **Técnico anexa foto do equipamento direto do celular na anotação** — 25/100 % · 🔴 Atrasado · responsável: Rodrigo Lago — _"Design pronto."_ (2026-08-17)
4. **Integração nativa com OS e chamados (foto = evidência)** — 50/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"Fluxo em validação"_ (2026-08-17)

## 9. [P4] Dashboard Cliente Individual

- **Status:** 🟢 No Caminho · **Progresso:** 60% · **Responsáveis:** Rodrigo Lago
- **Descrição:** Dashboard Cliente Individual para clientes via API de parceiro ou acesso direto

1. **Design do Painel de Cliente Individual** — 50/100 % · 🟢 No Caminho · responsável: Rodrigo Lago — _"Prottótipo inicial em andamento"_ (2026-03-30)
2. **Entendimento Demanda e Definição do Escopo** — 70/100 % · 🟢 No Caminho · responsável: Rodrigo Lago / Bruno / JP — _"Alinhamento feito sobre escopo simplificado"_ (2026-03-30)

---

## Metodologia da engenharia reversa

1. **Snapshot ao vivo** via Chrome debug (porta 9222) na aba `okrmyio.lovable.app`, consultando o backend Supabase (REST, PostgREST) com o token de sessão já autenticado na aba — sem nenhuma escrita, só leitura.
2. **Contagens de topo** (Objetivos, Key Results, Progresso Médio, No Caminho/Em risco/atrasados) conferidas 1:1 contra os cards de KPI do painel antes de aceitar o snapshot.
3. **Status por objetivo e por Key Result** extraído diretamente do texto renderizado do painel (todos os 9 cards expandidos), não recalculado — os badges 🟢/🟠/🔴 são exatamente os que o painel mostra.
4. **Última observação de check-in** por KR (quando existente e substantiva — descartando marcações vazias `SAV`/`SVA` de "sem avanço/variação") extraída do histórico de `progress_updates` via API, para dar contexto do porquê do valor atual.
5. Fórmula do "Esperado" do painel confirmada: fração de dias decorridos do trimestre civil Q3 (01/jul–30/set) até a data do snapshot — bate exatamente com o "Esperado: 59%" mostrado (24/ago ≈ 59,2% do Q3 decorrido).

*Regenerar: reabrir o Chrome debug (`:9222`) na aba do painel, expandir todos os objetivos, e repetir o pull.*
