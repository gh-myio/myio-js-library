# OKRs — Tecnologia (espelho do painel)

> Espelho do **OKR Tracker** (okrmyio.lovable.app) · **Q3 2026** · dimensão **Tecnologia** · sincronizado em 2026-08-10.
> Fonte da verdade = o painel; este arquivo é gerado por engenharia reversa dos dados do painel.
> KRs: unidade **%**, meta **100**, responsável **Rodrigo Lago** (salvo indicado). Todos marcados com observação **SAV**.

**13 objetivos · 57 KRs · 57/57 com SAV · progresso médio ~8%**

## 1. Ecossistema de Autenticação MYIO

- **Status:** 🟠 Em andamento · **Progresso:** 24% · **Responsável:** Rodrigo Lago, André Abadesso
- **Descrição:** Desenvolvimento de um ecossistema completo usando Auth0 para gerenciar os logins de forma integrada e com controle de escopo e perfis

1. Reunião inicial de validaçào e entendimento da demanda — 100/100 % · _SAV_
2. Implementação Inicial — 0/100 % · _SAV_
3. Múltiplos Testes — 0/100 % · _SAV_
4. Virada para Produção — 0/100 % · _SAV_
5. Design inicial do sistema de autenticação — 20/100 % · _SAV_

## 2. Cockpit de auditoria de logs das aplicações

- **Status:** ⚠️ Sem avanço · **Progresso:** 0% · **Responsável:** Rodrigo Lago
- **Descrição:** Centralizar logs, alarmes, dashboards e presetup em painel único


1. Painel único de logs de todas as aplicações — 0/100 % · _SAV_
2. Retenção e organização do histórico de logs (90 dias) — 0/100 % · _SAV_
3. Cockpit — 0/100 % · _SAV_
4. Alertas automáticos de falha/atraso por aplicação — 0/100 % · _SAV_
5. Reunião inicial de validação e entendimento da demanda — 0/100 % · _SAV_

## 3. Gestão de Node-RED por central

- **Status:** ⚠️ Sem avanço · **Progresso:** 0% · **Responsável:** Rodrigo Lago
- **Descrição:** Inventário de versão de runtime e contribs por central
x Pipeline de update com fix e rollback versionado

1. Inventário de versão e componentes por central — 0/100 % · _SAV_
2. Padronização do runtime em toda a lista de dispositivos — 0/100 % · _SAV_
3. Atualização com correção e reversão controladas — 0/100 % · _SAV_
4. Detecção de divergência entre central e versão oficial — 0/100 % · _SAV_
5. Implantação gradual com rollback de 1 clique — 0/100 % · _SAV_

## 4. Monitoramento de centrais dentro do GCDR

- **Status:** ⚠️ Sem avanço · **Progresso:** 0% · **Responsável:** Rodrigo Lago
- **Descrição:** Central como entidade de primeira classe no GCDR x Telemetria de saúde por central (uptime, versão, conectividade)


1. Central como entidade oficial no GCDR — 0/100 % · _SAV_
2. Alerta de central offline ou fora do padrão — 0/100 % · _SAV_
3. Integração ao painel de centrais + cockpit de logs — 0/100 % · _SAV_
4. Telemetria de saúde por central (disponibilidade, versão, conexão) — 0/100 % · _SAV_
5. Comandos remotos de rede (backup/restore, etc) — 0/100 % · _SAV_

## 5. Backup e restore das centrais no GCDR

- **Status:** ⚠️ Sem avanço · **Progresso:** 0% · **Responsável:** Rodrigo Lago
- **Descrição:** Runbook único de backup/restore para OrangePi/Mender

1. Restore validado (simulado) antes de aplicar em campo — 0/100 % · _SAV_
2. Backup automático e versionado por central — 0/100 % · _SAV_
3. Runbook único de backup/restore — 0/100 % · _SAV_
4. Alerta de central sem backup recente — 0/100 % · _SAV_
5. Inventário com data do último backup válido — 0/100 % · _SAV_

## 6. Ordens de Serviço integradas a todo o ecossistema

- **Status:** ⚠️ Sem avanço · **Progresso:** 0% · **Responsável:** Rodrigo Lago
- **Descrição:** OS disparada por alarme, com rastro até o device x OS refletida no app móvel e no dashboard

1. Fluxo de ciclo de vida das OS (regras automáticas) — 0/100 % · _SAV_
2. OS disparada por alarme, rastreável até o equipamento — 0/100 % · _SAV_
3. Agrupamento de ordens de serviço — 0/100 % · _SAV_
4. Abertura de OS a partir de e-mail — 0/100 % · _SAV_
5. OS visível no app e no dashboard — 0/100 % · _SAV_

## 7. Auto-construtor e auto-sync de devices no ecossistema

- **Status:** ⚠️ Sem avanço · **Progresso:** 0% · **Responsável:** Rodrigo Lago
- **Descrição:** Implementar conformidade ThingsBoard x Detecção e correção automática de divergência de cadastro

1. Conformidade de cadastro entre plataformas — 0/100 % · _SAV_
2. Verificação automática de cadastro — 0/100 % · _SAV_
3. Criação automática de equipamento a partir do perfil — 0/100 % · _SAV_
4. Mapeamento completo de equipamentos entre plataformas — 0/100 % · _SAV_
5. Sincronização contínua de equipamentos — 0/100 % · _SAV_

## 8. Pré-Setup totalmente migrado para o GCDR

- **Status:** ⚠️ Sem avanço · **Progresso:** 0% · **Responsável:** Rodrigo Lago
- **Descrição:** GCDR como âncora única do estado de sync

1. GCDR como fonte única do estado de sincronização — 0/100 % · _SAV_
2. Modelo de canais por dispositivos — 0/100 % · _SAV_
3. Componente de pré-setup embutível (1 gateway) — 0/100 % · _SAV_
4. Pré-setup migrado para o novo frontend — 0/100 % · _SAV_
5. Pré-setup usando a biblioteca oficial (sem versão de teste) — 0/100 % · _SAV_

## 9. Zerar risco de perda de dado em produção

- **Status:** ⚠️ Sem avanço · **Progresso:** 0% · **Responsável:** Rodrigo Lago
- **Descrição:** Detectar centrais instáveis, e quando voltar pensar em buscar os dados dos sensores acumulados

1. Detecção automática de lacunas de dados por central, a cada hora — 0/100 % · _SAV_
2. Preenchimento automático (interpolação) das lacunas dentro da tolerância — 0/100 % · _SAV_
3. Módulo em operação em toda a lista de dispositivos — 0/100 % · _SAV_
4. Regras de tolerância por tipo de equipamento (GCDR) — 0/100 % · _SAV_
5. Abertura automática de incidente quando a lacuna ultrapassa o limite — 0/100 % · _SAV_

## 10. Migração de Alarme para código

- **Status:** ⚠️ Sem avanço · **Progresso:** 0% · **Responsável:** Rodrigo Lago
- **Descrição:** Migração de Alarme para código 

1. Regras de alarme versionadas em Git (alarm-as-code), com CI/CD valida sintaxe, testes unitários e simula disparo antes do deploy — 0/100 % · _SAV_
2. Rollback auditável e diff entre versões por cliente — 0/100 % · _SAV_
3. Templates reutilizáveis por vertical (shopping, indústria, varejo) — 0/100 % · _SAV_

## 11. Anotações com upload de imagens e uso de MCP do Ingestion

- **Status:** ⚠️ Sem avanço · **Progresso:** 0% · **Responsável:** Rodrigo Lago
- **Descrição:** Anotações com upload de imagens e uso de MCP do Ingestion

1. Histórico visual vira base de conhecimento para treinamento de novos técnicos — 0/100 % · _SAV_
2. MCP Ingestion enriquece com contexto: última leitura, histórico de alarmes, manuais — 0/100 % · _SAV_
3. Técnico anexa foto do equipamento direto do celular na anotação — 0/100 % · _SAV_
4. Integração nativa com OS e chamados (foto = evidência) — 0/100 % · _SAV_

## 12. Alarme / Notificações no Whatsapp

- **Status:** 🟠 Em andamento · **Progresso:** 25% · **Responsável:** Rodrigo Lago
- **Descrição:** Alarme / Notificações no Whatsapp

1. Canal oficial Meta Business API — 25/100 % · _SAV_
2. Audit log de quem recebeu e respondeu (compliance) — 50/100 % · _SAV_
3. Gestão de Templates por tipo: crítico, aviso, recuperação ou outro tipo — 0/100 % · _SAV_

## 13. Dashboard Cliente Individual

- **Status:** 🟠 Em andamento · **Progresso:** 60% · **Responsável:** Rodrigo Lago
- **Descrição:** Dashboard Cliente Individual para clientes via API de parceiro ou acesso direto

1. Entendimento Demanda e Definição do Escopo — 70/100 % · _SAV_
2. Design do Painel de Cliente Individual — 50/100 % · _SAV_

---
*Objetivo "Melhorar a confiabilidade e monitoramento dos dados operacionais" pertence à dimensão **Suporte CS (Q2 2026)** — fora deste doc de Tecnologia; seus 4 KRs foram cadastrados no painel.*
*Regenerar: reabrir o Chrome debug (`:9222`) e rodar o pull CDP.*
