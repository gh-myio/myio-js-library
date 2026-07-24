# OKRs — Tecnologia

> Extraídos das auditorias de 5 repositórios MYIO (2.093 linhas) · 2026-07-24
> Fonte: [Auditoria Consolidada](AUDITORIA-RFCS-CONSOLIDADA-MYIO.html)
> Organizados por **categoria** (sistema/produto). 🔴 = risco de produção · 🟢 = capacidade nova a construir.

---

## 🏭 Ingestion

### O1 — Zerar risco de perda de dado em produção 🔴

- Confirmar índice único de `energy_readings` e idempotência de backfill/replay
- Eliminar perda silenciosa de batch na ingestão (QoS 1 auto-ack)
- Alerta de freshness em CAgg (jobs zumbis de 96 e 358 dias)
- Ajustar orçamento de conexões (120 > `max_connections` 100)
- Confirmar shared-subscription do poller (fan-out 6×)

---

## 🔔 Alarmes & Notificações

### O2 — Fechar brechas de segurança conhecidas 🔴

- Remover `terraform.tfstate` do git e rotacionar segredos expostos
- Autenticar `/ws` e validar `tenantId` (vazamento cross-tenant)

### O3 — Ligar o que já está construído e inalcançável

- Conectar `broadcastAlarmCreated` (tempo real hoje é código morto)
- Persistir `closedBy`/`acknowledgedBy` → destravar MTTR
- Aplicar filtro `actorType` no handler (aceito e ignorado)
- Expor UI do RFC-0018 (backend entregue e inacessível)

### O4 — Central de notificações multicanal 🟢

- Plano único de dispatch para e-mail, Telegram e WhatsApp
- Adicionar canal WhatsApp
- Concluir templates GCDR do Telegram (RFC-0026 — 0/6 hoje)
- Criar templates de e-mail faltantes (`alarm.closed`, `alarm.escalated`)
- Corrigir fallback global de token que fura o kill switch por customer
- Ativar dispatch por grupo (RFC-0020 fase 2, hoje inativa)
- Motor de escalação por tempo sem ACK (RFC-0026 v2)
- Preferência de canal por customer, regra e severidade

---

## 📊 Dashboard & Head Office

### O5 — Reduzir dívida estrutural de classificação

- Consolidar classificação de dispositivos em fonte única
- Definir `saveDeviceClassificationProfile` no v-5.4.0
- Eliminar o laço circular de `labelWidget` no texto combinado
- Concluir a persistência de perfil (Phase B) nos dois controllers

### O6 — Metas financeiras e indicadores no painel do Head Office 🟢

- Destravar RFC-0054 — metas monetárias e tarifas (*APPROVED & FROZEN*, fora do `desenv`)
- Tarifa por customer e por período no cálculo da meta
- Indicadores financeiros no Metas × Consumo (R$ realizado × orçado × meta)
- Desvio financeiro por shopping e consolidado
- Exportação financeira no relatório de metas (PDF/CSV)

---

## 📱 Novo APP MYIO

### O7 — Conectar o app a backend real

- Trocar `DEMO_MODE` hard-coded por env var, default `false`
- Definir `EXPO_PUBLIC_GCDR_BASE_URL` em ambiente real
- Migrar os 15 endpoints interceptados para backend real
- Eliminar as duas cópias divergentes de estado falso
- Substituir fixtures nos 8 módulos da home

---

## 🔗 Pré-Setup, GCDR & Devices

### O8 — Pré-Setup totalmente migrado para o GCDR 🟢

- Concluir `@myio/presetup-sdk` — componente embutível de 1 gateway (RFC-0001)
- GCDR como âncora única do estado de sync (RFC-0002)
- Destravar fase 5 do modelo de canais por placa (RFC-0003)
- Concluir migração do presetup para o `gcdr-frontend`
- Fechar próximos passos de `device-types-mapping` e `presetup-import-schema-comparison`
- Remover pin de pré-release da `myio-js-library` no presetup

### O9 — Auto-construtor e auto-sync de devices no ecossistema 🟢

- Implementar conformidade ThingsBoard ↔ GCDR (RFC-0022)
- Completar mapeamento de entidades TB ↔ GCDR (RFC-0016)
- Plano de configuração do Verify Service com checkers (RFC-0027)
- Auto-sync contínuo de devices entre TB, GCDR e ingestão
- Detecção e correção automática de divergência de cadastro
- Auto-construção de device a partir do perfil e do canal da placa

---

## 🛠 Ordens de Serviço

### O10 — Ordens de Serviço integradas a todo o ecossistema 🟢

- Implementar WO Groups (RFC-0051)
- Motor de regras de ciclo de vida de OS (RFC-0041)
- Ingestão de e-mail → ticket (RFC-0045)
- Persistir atores do workflow (RFC-0028) → MTTR real
- OS disparada por alarme, com rastro até o device
- OS refletida no app móvel e no dashboard

---

## 🖥 Centrais

### O11 — Backup e restore das centrais 🟢

- Backup automático e versionado dos flows Node-RED por central
- Restore verificado (dry-run) antes de aplicar em campo
- Runbook único de backup/restore para OrangePi/Mender
- Inventário de centrais com data do último backup válido
- Alerta de central sem backup recente
- Restore de nomes e mapa de slaves sem perda de identidade

### O12 — Monitoramento de centrais dentro do GCDR 🟢

- Central como entidade de primeira classe no GCDR
- Telemetria de saúde por central (uptime, versão, conectividade)
- Destravar `signal-topology` e `central-wifi-command` (PRs parados)
- Alerta de central offline ou com flow divergente do versionado
- Painel de centrais integrado ao cockpit de logs (O15)

### O13 — Gestão de Node-RED por central 🟢

- Inventário de versão de runtime e contribs por central
- Padronizar runtime (hoje há pré-release `1.2.0-beta.1` em produção)
- Detectar drift entre flow em campo e flow versionado
- Pipeline de update com fix e rollback versionado
- Rollout controlado por central/grupo (canary)
- Rollback de um clique para estado conhecido-bom
- Concluir integração Node-RED do RFC-NodeRed (2/7 hoje)

---

## ⚙️ Plataforma & Observabilidade

### O14 — Fazer os portões de qualidade executarem

- Ligar `size-check` no pipeline de build
- Trazer bundle para dentro do limite (hoje ~218× acima)
- Mergear CI de qualidade nas branches de frontend

### O15 — Cockpit de auditoria de logs das aplicações 🟢

- Implementar o Log Cockpit / on-call (RFC-0048 — hoje só runbook)
- Centralizar logs de ingestão, alarmes, dashboards e presetup em painel único
- Particionamento e retenção de `audit_logs` (90d, pg_partman)
- Alertas de freshness e de falha silenciosa por aplicação
- Rastro de auditoria por ator, device e customer

---

## Notas de leitura

- Nenhum total foi somado entre repositórios — as unidades não são comparáveis
- Itens marcados como "possivelmente" na origem são hipóteses de alto risco, não fatos
- 5 das 7 pendências de ingestão têm severidade de incidente em produção
