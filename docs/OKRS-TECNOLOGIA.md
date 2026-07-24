# OKRs — Tecnologia

> Extraídos das auditorias de 5 repositórios MYIO (2.093 linhas) · 2026-07-24
> Fonte: [Auditoria Consolidada](AUDITORIA-RFCS-CONSOLIDADA-MYIO.html)

---

# Parte A — Corrigir (derivado das auditorias)

## O1 — Zerar risco de perda de dado em produção

- Confirmar índice único de `energy_readings` e idempotência de backfill/replay
- Eliminar perda silenciosa de batch na ingestão (QoS 1 auto-ack)
- Alerta de freshness em CAgg (jobs zumbis de 96 e 358 dias)
- Ajustar orçamento de conexões (120 > `max_connections` 100)
- Confirmar shared-subscription do poller (fan-out 6×)

## O2 — Fechar brechas de segurança conhecidas

- Remover `terraform.tfstate` do git e rotacionar segredos expostos
- Autenticar `/ws` e validar `tenantId` (vazamento cross-tenant)

## O3 — Tornar o status da documentação confiável

- Verificar `Status:` contra código em todos os RFCs que alegam entrega
- Corrigir `FRENTES-FUTURAS.md` (~10 entregas em produção marcadas como pendentes)
- Corrigir `FRONTEND-INTEGRATION.md` (5 contratos de rota errados)
- Atualizar os 9 RFCs implementados que ainda se declaram pendentes
- Classificar os 157 arquivos sem campo `Status` (57% do corpus)

## O4 — Ligar o que já está construído e inalcançável

- Conectar `broadcastAlarmCreated` (tempo real hoje é código morto)
- Definir `saveDeviceClassificationProfile` no v-5.4.0
- Persistir `closedBy`/`acknowledgedBy` → destravar MTTR
- Aplicar filtro `actorType` no handler (aceito e ignorado)
- Expor UI do RFC-0018 (backend entregue e inacessível)

## O5 — Fazer os portões de qualidade executarem

- Ligar `size-check` no pipeline de build
- Trazer bundle para dentro do limite (hoje ~218× acima)
- Mergear CI de qualidade nas branches de frontend

## O6 — Destravar valor pronto e parado

- Mergear os 4 PRs de feature revisados
- Reconciliar `main` × `desenv` (543 commits de divergência)
- Versionar os 3 documentos `untracked` da RFC-0004

## O7 — Conectar o app a backend real

- Trocar `DEMO_MODE` hard-coded por env var, default `false`
- Definir `EXPO_PUBLIC_GCDR_BASE_URL` em ambiente real
- Migrar os 15 endpoints interceptados para backend real
- Eliminar as duas cópias divergentes de estado falso
- Substituir fixtures nos 8 módulos da home

## O8 — Eliminar falhas silenciosas

- Instrumentar alertas onde hoje falha sem erro
- Remover ações de UI que confirmam sucesso sem persistir
- Unir intervalos de downtime sobrepostos (MTTR/disponibilidade distorcidos)
- Remover stub `alert()` de KPI da biblioteca publicada

## O9 — Reduzir dívida estrutural de classificação

- Consolidar classificação de dispositivos em fonte única
- Eliminar o laço circular de `labelWidget` no texto combinado
- Concluir a persistência de perfil (Phase B) nos dois controllers

---

# Parte B — Construir (capacidades de ecossistema)

## O10 — Pré-Setup totalmente migrado para o GCDR

- Concluir `@myio/presetup-sdk` — componente embutível de 1 gateway (RFC-0001)
- GCDR como âncora única do estado de sync (RFC-0002)
- Destravar fase 5 do modelo de canais por placa (RFC-0003)
- Concluir migração do presetup para o `gcdr-frontend`
- Fechar próximos passos de `device-types-mapping` e `presetup-import-schema-comparison`
- Remover pin de pré-release da `myio-js-library` no presetup

## O11 — Cockpit de auditoria de logs das aplicações

- Implementar o Log Cockpit / on-call (RFC-0048 — hoje só runbook)
- Centralizar logs de ingestão, alarmes, dashboards e presetup em painel único
- Particionamento e retenção de `audit_logs` (90d, pg_partman)
- Alertas de freshness e de falha silenciosa por aplicação
- Rastro de auditoria por ator, device e customer

## O12 — Auto-construtor e auto-sync de devices no ecossistema

- Implementar conformidade ThingsBoard ↔ GCDR (RFC-0022)
- Completar mapeamento de entidades TB ↔ GCDR (RFC-0016)
- Plano de configuração do Verify Service com checkers (RFC-0027)
- Auto-sync contínuo de devices entre TB, GCDR e ingestão
- Detecção e correção automática de divergência de cadastro
- Auto-construção de device a partir do perfil e do canal da placa

## O13 — Ordens de Serviço integradas a todo o ecossistema

- Implementar WO Groups (RFC-0051)
- Motor de regras de ciclo de vida de OS (RFC-0041)
- Ingestão de e-mail → ticket (RFC-0045)
- Persistir atores do workflow (RFC-0028) → MTTR real
- OS disparada por alarme, com rastro até o device
- OS refletida no app móvel e no dashboard

---

## Notas de leitura

- Nenhum total foi somado entre repositórios — as unidades não são comparáveis
- Itens marcados como "possivelmente" na origem são hipóteses de alto risco, não fatos
- 5 das 7 pendências de ingestão têm severidade de incidente em produção
