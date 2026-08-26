<?php
/**
 * Catapult — Migration Panel + Q&A audit form.
 *
 * "Resumo" tab is a static mirror of Catapult-Migration.md (same content/behavior
 * as Catapult-Migration.html — PT/EN + Light/Dark). "Dúvidas" tab is a form of
 * generic migration questions whose answers persist as an append-only audit
 * trail in catapult-questions-responses.json next to this file. Every save is
 * a NEW entry (person + timestamp + answers) — nothing is overwritten, so the
 * same question can be answered/re-answered/commented over time by different
 * people and the full history stays visible below the form.
 *
 * Requires a PHP-capable server to actually run (persistence needs PHP) — a
 * plain file:// open will not execute this. From this directory:
 *   php -S localhost:8000
 * then open http://localhost:8000/Catapult-Migration.php
 */

$JSON_FILE = __DIR__ . '/catapult-questions-responses.json';

// ---------------------------------------------------------------------------
// Questions — generic migration/backend/infra risk checklist. Grouped by
// category; each question has a type ('yesno' | 'choice' | 'text') driving
// which input renders, and every question ALSO gets a free-text "comentário"
// field regardless of type (réplica/tréplica — a place for follow-up notes
// distinct from the primary answer).
//
// 'priority' — added after a BMAD party-mode review round (Winston/Amelia/
// Mary/John, 2026-08-25) — tags each question against the 7-phase plan in
// Catapult-Migration.md:
//   'blocking' — the specific plan phase named in 'blocksPhase' shouldn't
//                start responsibly without this answered.
//   'critical' — high risk if left unanswered, but doesn't block the START
//                of the phase (usually needed before Fase 5/6 cutover).
//   'low'      — team-process decision, low technical risk, cheap to change
//                later.
// ---------------------------------------------------------------------------
$QUESTIONS = [
  // Migração & Escopo Geral
  // (mig-1 "código já recebido/versionado?" e mig-2 "existe ambiente de
  // staging?" foram removidas — já são fatos conhecidos, registrados no .md.
  // mig-3 original ("critério de sucesso", texto livre único) foi desmembrada
  // em 4 perguntas testáveis — proposta da Amelia: uma frase solta não vira
  // AC verificável pela tarefa #11 do plano.)
  // mig-owner ("quem é o dono de produto/negócio + gatilho da migração?")
  // foi proposta pela mesa BMAD (John) mas o Rodrigo decidiu removê-la do
  // formulário — ver Catapult-Migration.md, seção "Pontos que só Rodrigo
  // pode direcionar".
  // mig-flows ("lista nomeada de fluxos críticos") e mig-pass ("critério de
  // 'passou' por fluxo") foram removidas por decisão do Rodrigo (2026-08-25)
  // — ver Catapult-Migration.md, seção "Pontos que só Rodrigo pode direcionar".
  ['id' => 'mig-tolerance', 'cat' => 'Migração & Escopo Geral', 'type' => 'text', 'priority' => 'critical', 'text' => 'Qual tolerância de divergência é aceitável entre o sistema antigo e o novo? (ex.: diffs de timestamp/ID sequencial são esperados, dado de negócio não pode divergir)'],
  ['id' => 'mig-godecision', 'cat' => 'Migração & Escopo Geral', 'type' => 'choice', 'priority' => 'critical', 'text' => 'Qual é o critério de go/no-go para o cutover final?', 'options' => ['100% dos fluxos críticos passam', '% mínimo definido (detalhar no comentário)', 'Aprovação manual de stakeholder por fluxo', 'Ainda não decidido']],

  // PHP / Backend Legado — categoria inteira (php-1 versão, php-2 framework,
  // php-3 deps obsoletas, php-secrets hardcoded) removida por decisão do
  // Rodrigo (2026-08-25): tudo isso vai ser descoberto direto ao ver o
  // código (tarefa #2 do plano), não precisa de pergunta própria no
  // checklist. Ver Catapult-Migration.md, "Pontos que só Rodrigo pode
  // direcionar". Categoria some sozinha do form (nenhuma pergunta a referencia).

  // Dados & Schema — categoria nova (Winston + Amelia convergiram nisso).
  // dat-schema e dat-charset removidas por decisão do Rodrigo (2026-08-25)
  // — serão observadas direto ao ter acesso ao banco/código, não precisam
  // de pergunta própria. Ver Catapult-Migration.md.
  // dat-size removida por decisão do Rodrigo (2026-08-25) — vai ser vista
  // direto ao ver o dump do banco. Ver Catapult-Migration.md.
  ['id' => 'dat-migrations', 'cat' => 'Dados & Schema', 'type' => 'yesno', 'priority' => 'critical', 'text' => 'Existem migrations versionadas (Flyway/Liquibase/Laravel migrations, etc.) ou o schema é só "o que está em produção agora"?'],

  // Testabilidade & Paridade de Dados — categoria nova (Amelia)
  ['id' => 'test-fixtures', 'cat' => 'Testabilidade & Paridade de Dados', 'type' => 'choice', 'priority' => 'blocking', 'blocksPhase' => 'Fase 4/5 (#9 restore e #11 validação não têm o que usar sem isso)', 'text' => 'Existe massa de dados de teste/fixtures realista, ou a validação (#11) vai rodar contra dump de produção anonimizado/copiado?', 'options' => ['Fixtures sintéticas', 'Dump de produção anonimizado', 'Dump de produção raw', 'Não existe ainda']],
  ['id' => 'test-goldenmaster', 'cat' => 'Testabilidade & Paridade de Dados', 'type' => 'text', 'priority' => 'critical', 'text' => 'Existe (ou vai existir) um método de comparação legado-vs-novo (golden master / diff de output)? Descreva como.'],
  ['id' => 'test-errorbaseline', 'cat' => 'Testabilidade & Paridade de Dados', 'type' => 'yesno', 'priority' => 'critical', 'text' => 'Existe log de erros/exceções estruturado no sistema legado que sirva de baseline ("quantidade de erro normal") para comparar com o volume pós-migração?'],

  // Jobs Assíncronos, Sessão & Storage — categoria nova (Winston)
  ['id' => 'job-cron', 'cat' => 'Jobs Assíncronos, Sessão & Storage', 'type' => 'text', 'priority' => 'blocking', 'blocksPhase' => 'Fase 2 (#2/#3 — cron/filas não aparecem em varredura de rotas web e ficam de fora do plano se não mapeados agora)', 'text' => 'Existem cron jobs / workers de fila / scripts batch fora do fluxo HTTP? Onde estão documentados?'],
  ['id' => 'job-session', 'cat' => 'Jobs Assíncronos, Sessão & Storage', 'type' => 'yesno', 'priority' => 'critical', 'text' => 'Sessão de usuário é armazenada em arquivo local no servidor (padrão PHP)? Se sim, precisa virar Redis/DB antes de deploy com múltiplos containers (#10), senão sessão quebra sem aviso.'],
  ['id' => 'job-uploads', 'cat' => 'Jobs Assíncronos, Sessão & Storage', 'type' => 'text', 'priority' => 'critical', 'text' => 'Uploads de usuário vão para disco local ou storage externo (S3, etc.)? Container = disco efêmero — se for local, perde arquivo a cada redeploy até isso ser resolvido.'],

  // Riscos do Lovable
  ['id' => 'lov-scope', 'cat' => 'Riscos do Lovable', 'type' => 'choice', 'priority' => 'critical', 'text' => 'Que parte do sistema legado o Lovable vai efetivamente tocar — é reescrita de telas, é só uma camada nova por cima, ou é decisão ainda em aberto?', 'options' => ['Reescrita de telas existentes', 'Camada nova por cima (não toca o legado)', 'Ainda em aberto']],
  ['id' => 'lov-1', 'cat' => 'Riscos do Lovable', 'type' => 'choice', 'priority' => 'critical', 'text' => 'O time interno vai editar código diretamente no Lovable em produção, ou só usar como camada de prototipagem?', 'options' => ['Só prototipagem', 'Edição direta em produção', 'Ainda não decidido']],
  ['id' => 'lov-2', 'cat' => 'Riscos do Lovable', 'type' => 'yesno', 'priority' => 'critical', 'text' => 'Existe plano de rollback caso o Lovable gere código incompatível com o backend PHP existente?'],
  ['id' => 'lov-3', 'cat' => 'Riscos do Lovable', 'type' => 'text', 'priority' => 'low', 'text' => 'Como o código gerado pelo Lovable será revisado antes de ir pra produção (code review, CI, nenhum)?'],

  // Autenticação & Autorização
  ['id' => 'auth-1', 'cat' => 'Autenticação & Autorização', 'type' => 'text', 'priority' => 'critical', 'text' => 'O sistema legado usa autenticação própria (sessão PHP) ou um provedor externo (Auth0, OAuth, SSO)?'],
  ['id' => 'auth-2', 'cat' => 'Autenticação & Autorização', 'type' => 'yesno', 'priority' => 'critical', 'text' => 'Existe MFA (autenticação multifator) habilitado para contas administrativas?'],
  ['id' => 'auth-3', 'cat' => 'Autenticação & Autorização', 'type' => 'text', 'priority' => 'critical', 'text' => 'Como as senhas/hashes de usuários existentes serão migradas sem forçar reset em massa?'],

  // CI/CD — categoria inteira removida: cicd-1 (pipeline hoje?), cicd-2
  // (cobertura de teste automatizado?) e cicd-3 (estratégia de rollout no
  // Dokploy?) — todas com resposta já conhecida (nenhum dos dois existe;
  // rollout será manual/deploy direto por ora), registradas como fato em
  // Catapult-Migration.md.

  // Infraestrutura como Código / Deploy Platform
  // iac-2 "existe state file remoto de Terraform?" foi removida — já é fato
  // conhecido (N/A, Dokploy decidido), registrado no .md (Fase 6).
  ['id' => 'iac-1', 'cat' => 'Infraestrutura como Código / Deploy Platform', 'type' => 'choice', 'priority' => 'critical', 'text' => 'Como a infraestrutura é provisionada HOJE, antes da migração (o destino já é Dokploy — esta pergunta é sobre o estado atual, não o futuro)?', 'options' => ['Terraform', 'CloudFormation', 'Pulumi', 'Provisionamento manual', 'Outro']],
  ['id' => 'iac-3', 'cat' => 'Infraestrutura como Código / Deploy Platform', 'type' => 'text', 'priority' => 'critical', 'text' => 'Quem tem acesso de deploy/apply em produção hoje, e isso vai mudar pós-migração (Dokploy)?'],

  // Hosting & DNS
  ['id' => 'host-1', 'cat' => 'Hosting & DNS', 'type' => 'text', 'priority' => 'critical', 'text' => 'Qual provedor de hosting hospeda o sistema hoje (AWS, GCP, Azure, VPS próprio, outro)?'],
  ['id' => 'host-2', 'cat' => 'Hosting & DNS', 'type' => 'choice', 'priority' => 'critical', 'text' => 'O domínio já está delegado para o Route 53, ou está em outro provedor de DNS?', 'options' => ['Route 53', 'Cloudflare', 'Outro registrador', 'Não sei']],
  ['id' => 'host-3', 'cat' => 'Hosting & DNS', 'type' => 'yesno', 'priority' => 'low', 'text' => 'Existe TTL baixo configurado nos registros DNS para permitir cutover rápido no dia da migração? (só importa perto do go-live)'],
  ['id' => 'host-ipallow', 'cat' => 'Hosting & DNS', 'type' => 'yesno', 'priority' => 'critical', 'text' => 'Algum serviço externo faz allowlist de IP para o servidor atual (gateway de pagamento, banco, etc.)? O IP novo do Dokploy precisa ser liberado ANTES do cutover, não depois.'],
  ['id' => 'host-webhooks', 'cat' => 'Hosting & DNS', 'type' => 'text', 'priority' => 'critical', 'text' => 'Existem webhooks recebidos de fora (ex.: callback de pagamento) apontando para o domínio/IP atual? Isso condiciona o timing do cutover de DNS.'],
  ['id' => 'host-email', 'cat' => 'Hosting & DNS', 'type' => 'yesno', 'priority' => 'critical', 'text' => 'SPF/DKIM/DMARC estão configurados para o domínio atual (e-mail transacional)? Trocar de hosting sem migrar isso junto derruba entrega de e-mail no primeiro dia.'],

  // Backups & Recuperação
  ['id' => 'bkp-1', 'cat' => 'Backups & Recuperação', 'type' => 'text', 'priority' => 'blocking', 'blocksPhase' => 'Fase 4 (#9 restore em staging)', 'text' => 'Qual é a frequência de backup do banco de dados hoje (contínuo, diário, manual)?'],
  ['id' => 'bkp-2', 'cat' => 'Backups & Recuperação', 'type' => 'yesno', 'priority' => 'critical', 'text' => 'Já existe um teste de restore validado (não só o backup existir, mas restaurar e confirmar integridade)?'],
  ['id' => 'bkp-3', 'cat' => 'Backups & Recuperação', 'type' => 'text', 'priority' => 'critical', 'text' => 'Qual é o RPO/RTO (perda máxima de dados aceitável / tempo máximo de indisponibilidade) esperado pelo negócio?'],

  // Trilha de Auditoria & Compliance
  ['id' => 'aud-1', 'cat' => 'Trilha de Auditoria & Compliance', 'type' => 'yesno', 'priority' => 'critical', 'text' => 'O sistema legado registra logs de auditoria (quem alterou o quê e quando)?'],
  ['id' => 'aud-2', 'cat' => 'Trilha de Auditoria & Compliance', 'type' => 'yesno', 'priority' => 'critical', 'text' => 'Há requisito legal/regulatório (ex.: LGPD) que precisa ser preservado na migração?'],
  ['id' => 'aud-3', 'cat' => 'Trilha de Auditoria & Compliance', 'type' => 'choice', 'priority' => 'critical', 'text' => 'Os logs de auditoria atuais serão migrados junto com o sistema, ou começam do zero no novo ambiente?', 'options' => ['Migrar histórico', 'Começar do zero', 'Ainda não decidido']],

  // Ambientes
  // env-1 (topologia atual) removida — resposta já conhecida: hoje só
  // existe produção. env-2 (staging vai refletir produção?) também removida
  // — decisão já tomada: inicialmente sim. Ambas registradas como
  // fato/decisão em Catapult-Migration.md (Fase 4).
  ['id' => 'env-3', 'cat' => 'Ambientes (dev/staging/prod)', 'type' => 'yesno', 'priority' => 'critical', 'text' => 'Existe isolamento de rede/credenciais entre ambientes (staging não acessa dados reais de produção, por exemplo)?'],

  // Observabilidade — categoria nova (Winston)
  ['id' => 'obs-1', 'cat' => 'Observabilidade', 'type' => 'text', 'priority' => 'critical', 'text' => 'Existe monitoramento de erro/uptime/APM hoje? O que substitui isso no ambiente novo (Dokploy nativo, Sentry, Uptime Kuma, outro)?'],
  ['id' => 'obs-2', 'cat' => 'Observabilidade', 'type' => 'text', 'priority' => 'critical', 'text' => 'Como o time vai confirmar que a instalação (#10) e a validação (#11) estão realmente saudáveis em produção, além de "subiu e não caiu na hora"?'],

  // Capacidade & Performance — categoria nova (Winston)
  ['id' => 'cap-1', 'cat' => 'Capacidade & Performance', 'type' => 'text', 'priority' => 'critical', 'text' => 'Qual o pico de tráfego/concorrência esperado? Dimensiona CPU/RAM do container que as tarefas #6/#7 vão provisionar.'],

  // Versionamento & Branching
  ['id' => 'ver-1', 'cat' => 'Versionamento & Branching', 'type' => 'choice', 'priority' => 'low', 'text' => 'Qual estratégia de branching será usada?', 'options' => ['Trunk-based', 'GitFlow', 'GitHub Flow', 'Ainda não decidido']],
  ['id' => 'ver-2', 'cat' => 'Versionamento & Branching', 'type' => 'text', 'priority' => 'low', 'text' => 'Como serão versionadas as releases (SemVer, tags, changelog) e existe convenção de nomenclatura de branches/commits já definida?'],
];

// ---------------------------------------------------------------------------
// English translations. Kept as separate lookups (not inline in $QUESTIONS)
// so the array above stays the single source of truth for structure/order/
// priority — this only supplies display text. The submitted VALUE for
// yesno/choice questions always stays PT (canonical) regardless of which
// language was active when answering, so the audit trail never has two
// different value vocabularies for the same question.
// ---------------------------------------------------------------------------
$CAT_EN = [
  'Migração & Escopo Geral' => 'Migration & General Scope',
  'PHP / Backend Legado' => 'PHP / Legacy Backend',
  'Dados & Schema' => 'Data & Schema',
  'Testabilidade & Paridade de Dados' => 'Testability & Data Parity',
  'Jobs Assíncronos, Sessão & Storage' => 'Async Jobs, Sessions & Storage',
  'Riscos do Lovable' => 'Lovable Risks',
  'Autenticação & Autorização' => 'Authentication & Authorization',
  'CI/CD' => 'CI/CD',
  'Infraestrutura como Código / Deploy Platform' => 'Infrastructure as Code / Deploy Platform',
  'Hosting & DNS' => 'Hosting & DNS',
  'Backups & Recuperação' => 'Backups & Recovery',
  'Trilha de Auditoria & Compliance' => 'Audit Trail & Compliance',
  'Ambientes (dev/staging/prod)' => 'Environments (dev/staging/prod)',
  'Observabilidade' => 'Observability',
  'Capacidade & Performance' => 'Capacity & Performance',
  'Versionamento & Branching' => 'Versioning & Branching',
];

$YESNO_EN = ['Sim' => 'Yes', 'Não' => 'No', 'Não sei' => 'Not sure'];

$Q_EN = [
  'mig-tolerance' => ['text' => 'What divergence tolerance is acceptable between the old and new system? (e.g. timestamp/sequential-ID diffs are expected, business data may not diverge)'],
  'mig-godecision' => ['text' => 'What is the go/no-go criterion for the final cutover?', 'options' => ['100% of critical flows pass', 'Minimum % defined (detail in comment)', 'Manual stakeholder approval per flow', 'Not decided yet']],

  'dat-migrations' => ['text' => 'Are there versioned migrations (Flyway/Liquibase/Laravel migrations, etc.) or is the schema just "whatever is in production right now"?'],

  'test-fixtures' => ['text' => 'Is there a realistic test data set/fixtures, or will validation (#11) run against an anonymized/copied production dump?', 'options' => ['Synthetic fixtures', 'Anonymized production dump', 'Raw production dump', "Doesn't exist yet"], 'blocksPhase' => "Phase 4/5 (#9 restore and #11 validation have nothing to use without this)"],
  'test-goldenmaster' => ['text' => 'Is there (or will there be) a legacy-vs-new comparison method (golden master / output diff)? Describe how.'],
  'test-errorbaseline' => ['text' => 'Is there a structured error/exception log in the legacy system that can serve as a baseline ("normal error volume") to compare against post-migration volume?'],

  'job-cron' => ['text' => "Are there cron jobs / queue workers / batch scripts outside the HTTP flow? Where are they documented?", 'blocksPhase' => "Phase 2 (#2/#3 — cron/queues don't show up in a web-route scan and get left out of the plan if not mapped now)"],
  'job-session' => ['text' => 'Is user session stored in a local file on the server (PHP default)? If so, it needs to move to Redis/DB before deploying with multiple containers (#10), or sessions will break silently.'],
  'job-uploads' => ['text' => 'Do user uploads go to local disk or external storage (S3, etc.)? Container = ephemeral disk — if local, files are lost on every redeploy until this is resolved.'],

  'lov-scope' => ['text' => "Which part of the legacy system will Lovable actually touch — a rewrite of existing screens, a new layer on top, or is this still an open decision?", 'options' => ['Rewrite of existing screens', "New layer on top (doesn't touch the legacy)", 'Still open']],
  'lov-1' => ['text' => 'Will the internal team edit code directly in Lovable in production, or only use it as a prototyping layer?', 'options' => ['Prototyping only', 'Direct editing in production', 'Not decided yet']],
  'lov-2' => ['text' => 'Is there a rollback plan if Lovable generates code incompatible with the existing PHP backend?'],
  'lov-3' => ['text' => 'How will code generated by Lovable be reviewed before going to production (code review, CI, none)?'],

  'auth-1' => ['text' => 'Does the legacy system use its own authentication (PHP session) or an external provider (Auth0, OAuth, SSO)?'],
  'auth-2' => ['text' => 'Is MFA (multi-factor authentication) enabled for admin accounts?'],
  'auth-3' => ['text' => 'How will existing user passwords/hashes be migrated without forcing a mass reset?'],


  'iac-1' => ['text' => 'How is infrastructure provisioned TODAY, before the migration (the target is already Dokploy — this question is about the current state, not the future)?', 'options' => ['Terraform', 'CloudFormation', 'Pulumi', 'Manual provisioning', 'Other']],
  'iac-3' => ['text' => 'Who has deploy/apply access to production today, and will that change post-migration (Dokploy)?'],

  'host-1' => ['text' => 'Which hosting provider hosts the system today (AWS, GCP, Azure, own VPS, other)?'],
  'host-2' => ['text' => 'Is the domain already delegated to Route 53, or is it with another DNS provider?', 'options' => ['Route 53', 'Cloudflare', 'Other registrar', 'Not sure']],
  'host-3' => ['text' => 'Is a low TTL configured on DNS records to allow a fast cutover on migration day? (only matters close to go-live)'],
  'host-ipallow' => ['text' => "Does any external service IP-allowlist the current server (payment gateway, bank, etc.)? Dokploy's new IP needs to be allowed BEFORE cutover, not after."],
  'host-webhooks' => ['text' => 'Are there inbound webhooks (e.g. payment callback) pointing at the current domain/IP? This constrains the timing of the DNS cutover.'],
  'host-email' => ['text' => 'Are SPF/DKIM/DMARC configured for the current domain (transactional email)? Switching hosting without migrating this too breaks email delivery on day one.'],

  'bkp-1' => ['text' => 'What is the database backup frequency today (continuous, daily, manual)?', 'blocksPhase' => 'Phase 4 (#9 staging restore)'],
  'bkp-2' => ['text' => 'Has a restore test already been validated (not just that the backup exists, but actually restoring and confirming integrity)?'],
  'bkp-3' => ['text' => 'What RPO/RTO (maximum acceptable data loss / maximum downtime) does the business expect?'],

  'aud-1' => ['text' => 'Does the legacy system log audit trails (who changed what and when)?'],
  'aud-2' => ['text' => 'Is there a legal/regulatory requirement (e.g. LGPD) that must be preserved in the migration?'],
  'aud-3' => ['text' => 'Will the current audit logs be migrated along with the system, or start from scratch in the new environment?', 'options' => ['Migrate history', 'Start from scratch', 'Not decided yet']],

  'env-3' => ['text' => "Is there network/credential isolation between environments (e.g. staging can't access real production data)?"],

  'obs-1' => ['text' => 'Is there error/uptime/APM monitoring today? What replaces it in the new environment (native Dokploy, Sentry, Uptime Kuma, other)?'],
  'obs-2' => ['text' => 'How will the team confirm that the installation (#10) and validation (#11) are genuinely healthy in production, beyond "it\'s up and hasn\'t crashed yet"?'],

  'cap-1' => ['text' => 'What peak traffic/concurrency is expected? This sizes the CPU/RAM of the container that tasks #6/#7 will provision.'],

  'ver-1' => ['text' => 'What branching strategy will be used?', 'options' => ['Trunk-based', 'GitFlow', 'GitHub Flow', 'Not decided yet']],
  'ver-2' => ['text' => 'How will releases be versioned (SemVer, tags, changelog) and is there already a defined branch/commit naming convention?'],
];

$QUESTIONS_BY_ID = [];
foreach ($QUESTIONS as $q) { $QUESTIONS_BY_ID[$q['id']] = $q; }

$CATEGORIES = [];
foreach ($QUESTIONS as $q) { if (!in_array($q['cat'], $CATEGORIES, true)) $CATEGORIES[] = $q['cat']; }

// ---------------------------------------------------------------------------
// Persistence — append-only audit trail. Every save() call is a new entry;
// nothing already on disk is ever modified or removed.
// ---------------------------------------------------------------------------
function loadResponses($file) {
  if (!file_exists($file)) return [];
  $raw = @file_get_contents($file);
  if ($raw === false || trim($raw) === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function saveResponse($file, $entry) {
  // Locking lives on a dedicated .lock file, kept separate from the data
  // read/write (plain file_get_contents/file_put_contents) — simpler and
  // avoids subtle fopen-mode/file-pointer bugs with the data file itself.
  $lockFile = $file . '.lock';
  $lockFp = fopen($lockFile, 'c');
  if (!$lockFp) return false;
  flock($lockFp, LOCK_EX);

  clearstatcache(true, $file);
  $raw = file_exists($file) ? file_get_contents($file) : '';
  $data = json_decode($raw, true);
  if (!is_array($data)) $data = [];
  $data[] = $entry;

  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) {
    // Never write a failed encode — that would be `false` cast to an empty
    // string, silently truncating the whole audit trail to nothing. Bail
    // out instead and leave the existing file exactly as it was.
    flock($lockFp, LOCK_UN);
    fclose($lockFp);
    return false;
  }
  $ok = file_put_contents($file, $json) !== false;

  flock($lockFp, LOCK_UN);
  fclose($lockFp);
  return $ok;
}

$errors = [];
$justSaved = false;

// Defensive UTF-8 coercion: a malformed/mis-encoded byte sequence anywhere in
// $_POST would otherwise make json_encode() return false further down, and
// writing that false straight to disk would silently wipe the entire audit
// trail. Cleaning input here means encoding failure should never happen; the
// json_encode()===false guard in saveResponse() is the second, belt-and-
// braces layer that refuses to touch the file if it ever does anyway.
function cleanUtf8($s) {
  $s = trim((string)$s);
  if ($s === '' || mb_check_encoding($s, 'UTF-8')) return $s;
  return mb_convert_encoding($s, 'UTF-8', 'UTF-8');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_answers') {
  $person = cleanUtf8($_POST['person_name'] ?? '');
  if ($person === '') {
    $errors[] = 'Informe seu nome antes de salvar.';
  } else {
    $answers = [];
    foreach ($QUESTIONS as $q) {
      $answer = cleanUtf8($_POST['answer_' . $q['id']] ?? '');
      $comment = cleanUtf8($_POST['comment_' . $q['id']] ?? '');
      if ($answer === '' && $comment === '') continue; // skip fully-untouched questions
      $answers[] = [
        'questionId' => $q['id'],
        'answer' => $answer,
        'comment' => $comment,
      ];
    }
    if (empty($answers)) {
      $errors[] = 'Responda ou comente pelo menos uma pergunta antes de salvar.';
    } else {
      $entry = [
        'person' => $person,
        'savedAt' => date('c'),
        'answers' => $answers,
      ];
      if (saveResponse($JSON_FILE, $entry)) {
        header('Location: ' . basename(__FILE__) . '?saved=1#duvidas');
        exit;
      } else {
        $errors[] = 'Não foi possível gravar o arquivo de respostas (permissão de escrita?).';
      }
    }
  }
}

if (isset($_GET['saved'])) $justSaved = true;

$responses = loadResponses($JSON_FILE);
$responsesReversed = array_reverse($responses); // newest submission first

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

// Bilingual inline text: both languages render into the DOM, CSS shows only
// the one matching [data-active-lang] on <html> (toggled by the same JS that
// drives the Resumo tab's PT/EN switch) — no client-side re-templating of the
// Dúvidas form needed, and radio/textarea `name`/`value` attributes never
// change with language.
function bl($pt, $en) {
  return '<span class="lang-pt">' . h($pt) . '</span><span class="lang-en">' . h($en) . '</span>';
}
?>
<!doctype html>
<html lang="en" data-active-lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catapult — Migration Panel</title>
<style>
:root{
  --bg:#f5f6fa;--panel:#ffffff;--panel2:#f0f1f6;--txt:#1c1e26;--mut:#6b7280;--acc:#6c5ce7;--brd:#e2e4ea;
  --s-fg:#15803d;--s-bg:#dcfce7;--m-fg:#b45309;--m-bg:#fef3c7;--l-fg:#b91c1c;--l-bg:#fee2e2;--warn-fg:#92400e;--warn-bg:#fef3c7;
}
:root[data-theme="dark"]{
  --bg:#0f1117;--panel:#1a1d27;--panel2:#232735;--txt:#e7e9ee;--mut:#9aa0ad;--acc:#6c5ce7;--brd:#2b2f3d;
  --s-fg:#2ecc71;--s-bg:#123a26;--m-fg:#e67e22;--m-bg:#3a2814;--l-fg:#e74c3c;--l-bg:#3a1b17;--warn-fg:#f2b878;--warn-bg:#3a2814;
}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font-family:Nunito,system-ui,Segoe UI,Roboto,sans-serif;line-height:1.5;transition:background .15s,color .15s}
.wrap{max-width:1080px;margin:0 auto;padding:32px 20px 64px}
.topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
h1{font-size:26px;margin:0 0 4px}.sub{color:var(--mut);font-size:14px;margin:0 0 20px}
.sub a{color:var(--acc)}.sub code{background:var(--panel2);padding:1px 5px;border-radius:4px;font-size:12.5px}
.switches{display:flex;flex-direction:row;align-items:center;gap:8px;flex:0 0 auto;flex-wrap:wrap}
.lang-switch,.theme-switch,.view-switch{display:inline-flex;background:var(--panel);border:1px solid var(--brd);border-radius:999px;padding:3px}
.lang-switch button,.theme-switch button,.view-switch button{border:none;background:transparent;color:var(--mut);font-family:inherit;font-weight:800;font-size:12.5px;padding:6px 14px;border-radius:999px;cursor:pointer;transition:background .15s,color .15s}
.lang-switch button.active,.theme-switch button.active,.view-switch button.active{background:var(--acc);color:#fff}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:20px 0 26px}
.kpi{background:var(--panel);border:1px solid var(--brd);border-radius:14px;padding:16px}
.kpi b{display:block;font-size:26px}.kpi span{color:var(--mut);font-size:12.5px}
.kpi .mix{display:flex;gap:8px;align-items:baseline}
.kpi .mix b{font-size:20px}
.size-chip{font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap}
.size-chip.S{background:var(--s-bg);color:var(--s-fg)}
.size-chip.M{background:var(--m-bg);color:var(--m-fg)}
.size-chip.L{background:var(--l-bg);color:var(--l-fg)}
.phase,.category{background:var(--panel);border:1px solid var(--brd);border-left:4px solid var(--acc);border-radius:14px;padding:18px 20px;margin:0 0 16px}
.phase header,.category header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px}
.phase .num,.category .num{background:var(--panel2);color:var(--acc);width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:13px;font-weight:800;flex:0 0 auto}
.phase h2,.category h2{font-size:16.5px;margin:0;flex:1}
.phase .count,.category .count{color:var(--mut);font-size:12px}
ol.tasks{margin:10px 0 0;padding-left:0;list-style:none}
ol.tasks li{margin:8px 0;font-size:13.5px;padding:10px 12px;border-radius:8px;background:var(--panel2);border-left:3px solid var(--brd)}
ol.tasks li.flag{border-left-color:var(--warn-fg)}
.task-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.task-title{font-weight:600}
.task-desc{color:var(--mut);font-size:12.5px;margin-top:4px}
.task-flag{display:inline-flex;align-items:center;gap:5px;background:var(--warn-bg);color:var(--warn-fg);font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;margin-top:6px}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin:0 0 24px;font-size:12.5px;color:var(--mut)}
.legend span{display:inline-flex;align-items:center;gap:6px}
footer{color:var(--mut);font-size:12px;margin-top:26px;border-top:1px solid var(--brd);padding-top:14px}

/* Dúvidas / form */
.name-field{background:var(--panel);border:1px solid var(--brd);border-radius:14px;padding:16px 20px;margin:20px 0;display:flex;gap:20px;flex-wrap:wrap}
.name-field-col{flex:1;min-width:240px}
.name-field label{display:block;font-weight:700;font-size:13.5px;margin-bottom:8px}
.name-field .hint{font-weight:400;color:var(--mut);font-size:11.5px;margin-left:6px}
.name-field input[type=text]{width:100%;max-width:360px;padding:9px 12px;border:1px solid var(--brd);border-radius:8px;background:var(--bg);color:var(--txt);font-family:inherit;font-size:13.5px}
.q-card{background:var(--panel2);border:1px solid var(--brd);border-radius:10px;padding:12px 14px;margin:10px 0}
.q-text-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px}
.q-text{font-weight:600;font-size:13.5px}
.prio-chip{font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap;flex:0 0 auto}
.prio-chip.blocking{background:var(--l-bg);color:var(--l-fg)}
.prio-chip.critical{background:var(--m-bg);color:var(--m-fg)}
.prio-chip.low{background:var(--panel);color:var(--mut);border:1px solid var(--brd)}
.q-blocks{font-size:11px;color:var(--l-fg);margin:-4px 0 8px}

/* Bilingual toggle for the Dúvidas tab (server-rendered PHP, both languages
   emitted into the DOM — CSS shows only the active one). Default is EN,
   matching the Resumo tab's default. */
[data-active-lang="pt"] .lang-en{display:none}
[data-active-lang="en"] .lang-pt{display:none}
.lang-pt,.lang-en{display:inline}
.q-options{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px}
.q-options label{display:inline-flex;align-items:center;gap:6px;font-size:13px;cursor:pointer}
.q-options input[type=radio]{accent-color:var(--acc)}
textarea{width:100%;padding:9px 12px;border:1px solid var(--brd);border-radius:8px;background:var(--bg);color:var(--txt);font-family:inherit;font-size:13px;resize:vertical}
textarea.q-answer{margin-bottom:8px}
textarea.q-comment{opacity:.9}
.q-comment-label{font-size:11px;color:var(--mut);margin:0 0 4px;display:block}
.save-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:24px 0}
.save-btn{background:var(--acc);color:#fff;border:none;font-family:inherit;font-weight:800;font-size:14px;padding:12px 26px;border-radius:10px;cursor:pointer}
.save-btn:hover{opacity:.92}
.banner{border-radius:12px;padding:12px 16px;font-size:13.5px;margin:16px 0;font-weight:600}
.banner.ok{background:var(--s-bg);color:var(--s-fg)}
.banner.err{background:var(--l-bg);color:var(--l-fg)}
.history{margin-top:32px}
.history h2{font-size:17px;margin:0 0 4px}
.history .count{color:var(--mut);font-size:12.5px;margin:0 0 14px}
details.entry{background:var(--panel);border:1px solid var(--brd);border-radius:12px;padding:10px 16px;margin:0 0 10px}
details.entry summary{cursor:pointer;font-weight:700;font-size:13.5px;list-style:none}
details.entry summary::-webkit-details-marker{display:none}
details.entry summary .when{color:var(--mut);font-weight:400;font-size:12px;margin-left:8px}
.entry-answers{margin-top:12px;padding-top:12px;border-top:1px solid var(--brd)}
.entry-row{margin:0 0 10px;font-size:13px}
.entry-row .eq{font-weight:600}
.entry-row .ea{color:var(--txt);margin-top:2px}
.entry-row .ec{color:var(--mut);font-style:italic;margin-top:2px}
.empty-state{color:var(--mut);font-size:13.5px;padding:16px 0}

/* Cronograma / Gantt — pure CSS bars, no chart library */
.gantt{background:var(--panel);border:1px solid var(--brd);border-radius:14px;padding:20px;overflow-x:auto}
.gantt-inner{min-width:720px}
.gantt-header{position:relative;height:20px;margin:0 0 6px 220px}
.gantt-week{position:absolute;top:0;font-size:10px;color:var(--mut);border-left:1px solid var(--brd);padding-left:4px;white-space:nowrap}
.gantt-phase-label{font-size:11px;font-weight:800;color:var(--acc);text-transform:uppercase;letter-spacing:.02em;margin:14px 0 4px}
.gantt-row{display:flex;align-items:center;margin:3px 0}
.gantt-label{width:220px;flex:0 0 220px;font-size:12px;padding-right:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--txt)}
.gantt-label .gnum{color:var(--acc);font-weight:800;margin-right:4px}
.gantt-track{position:relative;flex:1;height:22px;background:var(--panel2);border-radius:4px}
.gantt-bar{position:absolute;top:2px;bottom:2px;border-radius:4px;display:flex;align-items:center;justify-content:center;padding:0 6px;font-size:10px;font-weight:800;white-space:nowrap;overflow:hidden;color:#fff;min-width:3px}
.gantt-bar.S{background:var(--s-fg)}
.gantt-bar.M{background:var(--m-fg)}
.gantt-bar.L{background:var(--l-fg)}
.gantt-total{font-size:12.5px;color:var(--mut);margin-top:14px;padding-top:12px;border-top:1px solid var(--brd)}

/* Riscos */
.risk-item{background:var(--panel2);border-left:3px solid var(--l-fg);border-radius:8px;padding:10px 14px;margin:8px 0}
.risk-item .rq{font-weight:700;font-size:12.5px}
.risk-item .rd{color:var(--mut);font-size:12px;margin-top:3px}

@media (max-width: 680px){
  .topbar{flex-direction:column;align-items:stretch}
  .switches{justify-content:flex-start}
  .kpis{grid-template-columns:1fr 1fr}
  .kpi .mix{flex-wrap:wrap}
  .task-head{flex-direction:column}
  .q-options{flex-direction:column;gap:6px}
}
@media (max-width: 420px){
  .kpis{grid-template-columns:1fr}
}
</style></head>
<body><div class="wrap">

<div class="topbar">
  <div>
    <h1 id="t-title">Catapult <span style="color:var(--mut);font-weight:400;font-size:16px" id="t-titleSuffix">(migration panel)</span></h1>
    <p class="sub" id="t-intro"></p>
  </div>
  <div class="switches">
    <div class="lang-switch" role="group" aria-label="Language selector">
      <button type="button" data-lang="pt" id="btn-pt">PT</button>
      <button type="button" data-lang="en" id="btn-en">EN</button>
    </div>
    <div class="theme-switch" role="group" aria-label="Theme selector">
      <button type="button" data-theme="light" id="btn-light">☀️ Light</button>
      <button type="button" data-theme="dark" id="btn-dark">🌙 Dark</button>
    </div>
    <div class="view-switch" role="group" aria-label="View selector">
      <button type="button" data-view="resumo" id="btn-view-resumo">Summary</button>
      <button type="button" data-view="duvidas" id="btn-view-duvidas">Questions</button>
      <button type="button" data-view="cronograma" id="btn-view-cronograma">Schedule</button>
      <button type="button" data-view="riscos" id="btn-view-riscos">Risks</button>
    </div>
  </div>
</div>

<div id="view-resumo">
  <div class="kpis" id="kpis"></div>
  <div class="legend" id="legend"></div>
  <div id="phases"></div>
  <footer id="footer"></footer>
</div>

<div id="view-duvidas" style="display:none">
  <p class="sub" style="margin-top:20px" id="t-duvidasIntro"></p>

  <?php if ($justSaved): ?>
    <div class="banner ok">✅ <?= bl('Respostas salvas com sucesso na trilha de auditoria.', 'Answers saved successfully to the audit trail.') ?></div>
  <?php endif; ?>
  <?php foreach ($errors as $err):
    $errEn = ['Informe seu nome antes de salvar.' => 'Enter your name before saving.', 'Responda ou comente pelo menos uma pergunta antes de salvar.' => 'Answer or comment on at least one question before saving.', 'Não foi possível gravar o arquivo de respostas (permissão de escrita?).' => 'Could not write the responses file (write permission?).'][$err] ?? $err;
  ?>
    <div class="banner err">⚠️ <?= bl($err, $errEn) ?></div>
  <?php endforeach; ?>

  <form method="post" action="<?= h(basename(__FILE__)) ?>#duvidas">
    <input type="hidden" name="action" value="save_answers">

    <div class="name-field">
      <div class="name-field-col">
        <label for="person_name"><?= bl('Seu nome (obrigatório para salvar)', 'Your name (required to save)') ?></label>
        <input type="text" id="person_name" name="person_name" placeholder="Ex.: Rodrigo Lago" required>
      </div>
    </div>

    <?php
    $PRIO_PT = ['blocking' => 'Bloqueante', 'critical' => 'Crítica', 'low' => 'Baixa'];
    $PRIO_EN = ['blocking' => 'Blocking', 'critical' => 'Critical', 'low' => 'Low'];
    $catIndex = 0; foreach ($CATEGORIES as $cat): $catIndex++; ?>
      <div class="category">
        <header>
          <span class="num"><?= $catIndex ?></span>
          <h2><?= bl($cat, $CAT_EN[$cat] ?? $cat) ?></h2>
        </header>
        <?php foreach ($QUESTIONS as $q): if ($q['cat'] !== $cat) continue;
          $qEn = $Q_EN[$q['id']] ?? [];
        ?>
          <div class="q-card">
            <div class="q-text-row">
              <div class="q-text"><?= bl($q['text'], $qEn['text'] ?? $q['text']) ?></div>
              <span class="prio-chip <?= h($q['priority']) ?>"><?= bl($PRIO_PT[$q['priority']] ?? $q['priority'], $PRIO_EN[$q['priority']] ?? $q['priority']) ?></span>
            </div>
            <?php if (!empty($q['blocksPhase'])): ?><div class="q-blocks">🚧 <?= bl('Trava: ' . $q['blocksPhase'], 'Blocks: ' . ($qEn['blocksPhase'] ?? $q['blocksPhase'])) ?></div><?php endif; ?>
            <?php if ($q['type'] === 'yesno'): ?>
              <div class="q-options">
                <?php foreach (['Sim', 'Não', 'Não sei'] as $opt): ?>
                  <label><input type="radio" name="answer_<?= h($q['id']) ?>" value="<?= h($opt) ?>"> <?= bl($opt, $YESNO_EN[$opt] ?? $opt) ?></label>
                <?php endforeach; ?>
              </div>
            <?php elseif ($q['type'] === 'choice'): ?>
              <div class="q-options">
                <?php foreach ($q['options'] as $i => $opt): $optEn = $qEn['options'][$i] ?? $opt; ?>
                  <label><input type="radio" name="answer_<?= h($q['id']) ?>" value="<?= h($opt) ?>"> <?= bl($opt, $optEn) ?></label>
                <?php endforeach; ?>
              </div>
            <?php else: ?>
              <textarea class="q-answer" name="answer_<?= h($q['id']) ?>" rows="2" data-ph-pt="Resposta..." data-ph-en="Answer..." placeholder="Resposta..."></textarea>
            <?php endif; ?>
            <span class="q-comment-label"><?= bl('Comentário / réplica (opcional)', 'Comment / follow-up (optional)') ?></span>
            <textarea class="q-comment" name="comment_<?= h($q['id']) ?>" rows="2" data-ph-pt="Contexto adicional, discordância, link, etc." data-ph-en="Additional context, disagreement, link, etc." placeholder="Contexto adicional, discordância, link, etc."></textarea>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endforeach; ?>

    <div class="save-bar">
      <button type="submit" class="save-btn">💾 <?= bl('Salvar respostas', 'Save answers') ?></button>
      <span style="color:var(--mut);font-size:12.5px"><?= bl('Perguntas não respondidas nem comentadas são ignoradas ao salvar.', 'Questions left unanswered and uncommented are skipped when saving.') ?></span>
    </div>
  </form>

  <div class="history" id="duvidas">
    <h2><?= bl('Trilha de auditoria', 'Audit trail') ?></h2>
    <p class="count"><?= bl(
      count($responses) . ' envio(s) registrado(s)' . (count($responses) ? ' · mais recente primeiro' : ''),
      count($responses) . ' submission(s) recorded' . (count($responses) ? ' · newest first' : '')
    ) ?></p>
    <?php if (empty($responsesReversed)): ?>
      <div class="empty-state"><?= bl('Nenhuma resposta salva ainda.', 'No answers saved yet.') ?></div>
    <?php else: foreach ($responsesReversed as $entry): ?>
      <details class="entry">
        <summary>
          <?= h($entry['person'] ?? '—') ?><span class="when"><?= h($entry['savedAt'] ?? '') ?></span>
          · <?= bl(count($entry['answers'] ?? []) . ' resposta(s)', count($entry['answers'] ?? []) . ' answer(s)') ?>
        </summary>
        <div class="entry-answers">
          <?php foreach (($entry['answers'] ?? []) as $a):
            $q = $QUESTIONS_BY_ID[$a['questionId']] ?? null;
            if (!$q) continue;
            $qEn = $Q_EN[$q['id']] ?? [];
          ?>
            <div class="entry-row">
              <div class="eq"><?= bl($q['text'], $qEn['text'] ?? $q['text']) ?></div>
              <?php if (($a['answer'] ?? '') !== ''): ?><div class="ea"><?= nl2br(h($a['answer'])) ?></div><?php endif; ?>
              <?php if (($a['comment'] ?? '') !== ''): ?><div class="ec">💬 <?= nl2br(h($a['comment'])) ?></div><?php endif; ?>
            </div>
          <?php endforeach; ?>
        </div>
      </details>
    <?php endforeach; endif; ?>
  </div>
</div>

<div id="view-cronograma" style="display:none">
  <p class="sub" style="margin-top:20px" id="t-cronogramaIntro"></p>
  <div class="gantt" id="gantt"></div>
</div>

<div id="view-riscos" style="display:none">
  <p class="sub" style="margin-top:20px" id="t-riscosIntro"></p>
  <div id="riscosList"></div>
</div>

</div>

<script>
// ---------------------------------------------------------------------------
// I18N — Resumo-tab text lives here as data (PT + EN). render() reads this
// structure and builds the DOM. Task *titles* are kept identical in both
// languages on purpose — they are literal values from the source spreadsheet
// (Catapult-Migration.xlsx), not free text to translate. The Dúvidas tab is
// server-rendered PHP above and is not affected by this switch.
// ---------------------------------------------------------------------------
// Task titles — bilingual. Originally kept EN-only in both languages ("literal
// spreadsheet value"), but that read as untranslated/broken with PT selected,
// so both languages are now provided; the underlying task IDs/order still
// map 1:1 to the source spreadsheet regardless of display language.
const TASK_TITLES = {
  en: {
    1: 'Create a Git repository and make the first commit',
    2: 'Run an LLM-based code analysis',
    3: 'Create a technical installation plan',
    4: 'List all external dependencies',
    5: 'Collect credentials and access for external services',
    6: 'Provision the initial infrastructure',
    7: 'Configure the server baseline',
    8: 'Prepare the staging environment',
    9: 'Restore the database in the staging environment',
    10: 'Perform the first application installation',
    11: 'Validate critical system workflows',
    12: 'Define the automated deployment model',
    13: 'Set up the deployment pipeline',
    14: 'Define the Lovable usage strategy',
    15: 'Plan the frontend/backend separation',
    16: 'Define the Supabase strategy',
  },
  pt: {
    1: 'Criar um repositório Git e fazer o primeiro commit',
    2: 'Rodar uma análise de código baseada em LLM',
    3: 'Criar um plano técnico de instalação',
    4: 'Listar todas as dependências externas',
    5: 'Coletar credenciais e acessos dos serviços externos',
    6: 'Provisionar a infraestrutura inicial',
    7: 'Configurar a base do servidor',
    8: 'Preparar o ambiente de staging',
    9: 'Restaurar o banco de dados no ambiente de staging',
    10: 'Realizar a primeira instalação da aplicação',
    11: 'Validar os fluxos críticos do sistema',
    12: 'Definir o modelo de deploy automatizado',
    13: 'Configurar o pipeline de deploy',
    14: 'Definir a estratégia de uso do Lovable',
    15: 'Planejar a separação frontend/backend',
    16: 'Definir a estratégia do Supabase',
  },
};

const I18N = {
  pt: {
    titleSuffix: '(painel de migração)',
    intro: 'Espelho visual de <code>Catapult-Migration.xlsx</code> (aba única "Stage 1") via <a href="Catapult-Migration.md">Catapult-Migration.md</a> — 16 tarefas organizadas em 7 fases, t-shirt sizing S/M/L. Fonte da verdade = a planilha.',
    viewLabels: { resumo: 'Resumo', duvidas: 'Dúvidas', cronograma: 'Cronograma', riscos: 'Riscos' },
    duvidasIntro: 'Checklist de riscos de migração (backend PHP, dados/schema, testabilidade, jobs assíncronos, Lovable, autenticação, CI/CD, IaC/Dokploy, hosting/DNS, backups, auditoria, ambientes, observabilidade, versionamento), com tag de prioridade por pergunta (🔴 Bloqueante / 🟠 Crítica / ⚪ Baixa). Cada envio vira uma <strong>nova entrada</strong> na trilha de auditoria abaixo — nada é sobrescrito, então a mesma pergunta pode ser respondida/comentada de novo por outra pessoa mais tarde.',
    kpiLabels: { tasks: 'Tarefas', phases: 'Fases', sizeMix: 'Mix de tamanhos', finding: 'Achado sinalizado (descrição duplicada, tarefa #6)' },
    legend: { S: 'Small — esforço pontual', M: 'Medium — esforço moderado', L: 'Large — esforço alto/incerto' },
    taskCountLabel: (n) => n === 1 ? '1 tarefa' : n + ' tarefas',
    phases: [
      { title: 'Repositório & Versionamento', tasks: [
        { id: 1, desc: 'Centralizar a versão do sistema recebido no GitHub corporativo, com estrutura inicial de branches, permissões e convenções de trabalho.', size: 'S' },
      ]},
      { title: 'Descoberta & Análise de Arquitetura', tasks: [
        { id: 2, desc: 'Usar o workflow BMAD Brownfield para mapear a arquitetura do sistema, identificar módulos, dependências, integrações e riscos de instalação.', size: 'L' },
        { id: 3, desc: 'Gerar um plano técnico de instalação com ordem de execução, componentes necessários, comandos, considerações-chave e pré-requisitos de ambiente.', size: 'M' },
      ]},
      { title: 'Dependências Externas & Acessos', tasks: [
        { id: 4, desc: 'Inventariar os serviços, APIs, contas e integrações externas necessárias para o sistema operar corretamente.', size: 'S' },
        { id: 5, desc: 'Coletar os tokens, chaves, logins, contas e permissões de todos os serviços externos identificados.', size: 'S',
          flag: '⚠️ Segurança: nunca commitar credenciais reais — usar cofre de segredos apropriado' },
      ]},
      { title: 'Infraestrutura & Ambiente Base', tasks: [
        { id: 6, desc: 'Coletar os tokens, chaves, logins, contas e permissões de todos os serviços externos identificados.', size: 'M',
          flag: '⚠️ Descrição provavelmente duplicada da #5 (copy/paste error na planilha fonte) — revisar' },
        { id: 7, desc: 'Instalar e configurar o SO, servidor web, PHP, banco de dados, extensões, storage e ferramentas básicas.', size: 'M' },
        { id: 8, desc: 'Criar um ambiente separado para validação, testes e ajuste fino antes do release em produção.', size: 'S' },
        { id: 9, desc: 'Restaurar o banco de dados no ambiente de staging.', size: 'S' },
      ]},
      { title: 'Instalação & Validação da Aplicação', tasks: [
        { id: 10, desc: 'Subir a aplicação no novo ambiente com a configuração mínima necessária para funcionar.', size: 'L' },
        { id: 11, desc: 'Testar login, permissões, operações CRUD, uploads, jobs, integrações e outros fluxos de negócio centrais. Registrar erros, limitações, ajustes necessários e pontos de retrabalho encontrados durante a validação.', size: 'L' },
      ]},
      { title: 'Automação de Deploy', tasks: [
        { id: 12, desc: 'Escolher e definir o fluxo de deploy usando GitHub Actions, Docker, scripts ou um orquestrador simples.', size: 'S' },
        { id: 13, desc: 'Implementar o fluxo automatizado para publicar novas versões com segurança e rollback previsível.', size: 'M' },
      ]},
      { title: 'Estratégia de Plataforma (Lovable / Supabase)', tasks: [
        { id: 14, desc: 'Decidir se o Lovable será usado apenas como ferramenta de desenvolvimento ou também como camada de edição para o time interno.', size: 'S' },
        { id: 15, desc: 'Avaliar quais partes podem ser desacopladas e quais devem permanecer no backend atual.', size: 'M' },
        { id: 16, desc: 'Avaliar quais partes do sistema podem migrar para o Supabase, especialmente banco de dados, auth e storage.', size: 'S' },
      ]},
    ],
    footer: 'Gerado a partir de <code>docs/Catapult/Catapult-Migration.md</code> (espelho de <code>Catapult-Migration.xlsx</code>, aba "Stage 1"). Sem dados de progresso/status na fonte — a aba Resumo é organizacional (fases + tamanho), não um tracker de execução. Títulos das tarefas traduzidos para exibição; o identificador `#N` é o valor estável que mapeia de volta pra planilha fonte.',
  },
  en: {
    titleSuffix: '(migration panel)',
    intro: 'Visual mirror of <code>Catapult-Migration.xlsx</code> (single "Stage 1" sheet) via <a href="Catapult-Migration.en.md">Catapult-Migration.en.md</a> — 16 tasks organized into 7 phases, S/M/L t-shirt sizing. Source of truth = the spreadsheet.',
    viewLabels: { resumo: 'Summary', duvidas: 'Questions', cronograma: 'Schedule', riscos: 'Risks' },
    duvidasIntro: 'Migration risk checklist (PHP backend, data/schema, testability, async jobs, Lovable, authentication, CI/CD, IaC/Dokploy, hosting/DNS, backups, audit, environments, observability, versioning), each question tagged by priority (🔴 Blocking / 🟠 Critical / ⚪ Low). Every submission becomes a <strong>new entry</strong> in the audit trail below — nothing is overwritten, so the same question can be answered/commented again later by someone else.',
    kpiLabels: { tasks: 'Tasks', phases: 'Phases', sizeMix: 'Size mix', finding: 'Flagged finding (duplicated description, task #6)' },
    legend: { S: 'Small — one-off effort', M: 'Medium — moderate effort', L: 'Large — high/uncertain effort' },
    taskCountLabel: (n) => n === 1 ? '1 task' : n + ' tasks',
    phases: [
      { title: 'Repository & Version Control', tasks: [
        { id: 1, desc: 'Centralize the version of the system received into Corporate Github, with an initial structure for branches, permissions, and working conventions.', size: 'S' },
      ]},
      { title: 'Discovery & Architecture Analysis', tasks: [
        { id: 2, desc: 'Use BMAD Brownfield workflow to map the system architecture, identify modules, dependencies, integrations, and installation risks.', size: 'L' },
        { id: 3, desc: 'Generate an installation plan with execution order, required components, commands, key considerations, and environment prerequisites.', size: 'M' },
      ]},
      { title: 'External Dependencies & Access', tasks: [
        { id: 4, desc: 'Inventory the services, APIs, accounts, and external integrations required for the system to operate correctly.', size: 'S' },
        { id: 5, desc: 'Gather the tokens, keys, logins, accounts, and permissions for all identified external services.', size: 'S',
          flag: '⚠️ Security: never commit real credentials — use an appropriate secrets vault' },
      ]},
      { title: 'Infrastructure & Base Environment', tasks: [
        { id: 6, desc: 'Gather the tokens, keys, logins, accounts, and permissions for all identified external services.', size: 'M',
          flag: '⚠️ Description likely duplicated from #5 (copy/paste error in the source spreadsheet) — review' },
        { id: 7, desc: 'Install and configure the operating system, web server, PHP, database, extensions, storage, and basic tooling.', size: 'M' },
        { id: 8, desc: 'Create a separate environment for validation, testing, and fine-tuning before production release.', size: 'S' },
        { id: 9, desc: 'Restore the database in the staging environment.', size: 'S' },
      ]},
      { title: 'Application Installation & Validation', tasks: [
        { id: 10, desc: 'Bring the application up in the new environment with the minimum configuration required to run.', size: 'L' },
        { id: 11, desc: 'Test login, permissions, CRUD operations, uploads, jobs, integrations, and other core business flows. Record errors, limitations, required adjustments, and rework points found during validation.', size: 'L' },
      ]},
      { title: 'Deployment Automation', tasks: [
        { id: 12, desc: 'Choose and configure the deployment flow using GitHub Actions, Docker, scripts, or a simple orchestrator.', size: 'S' },
        { id: 13, desc: 'Implement the automated flow to publish new versions with security and predictable rollback.', size: 'M' },
      ]},
      { title: 'Platform Strategy (Lovable / Supabase)', tasks: [
        { id: 14, desc: 'Decide whether Lovable will be used only as a development tool or also as an editing layer for the internal team.', size: 'S' },
        { id: 15, desc: 'Evaluate which parts can be decoupled and which should remain in the current backend.', size: 'M' },
        { id: 16, desc: 'Assess which parts of the system can move to Supabase, especially database, auth, and storage.', size: 'S' },
      ]},
    ],
    footer: 'Generated from <code>docs/Catapult/Catapult-Migration.md</code> (mirror of <code>Catapult-Migration.xlsx</code>, "Stage 1" sheet). No progress/status data in the source — the Summary tab is organizational (phases + size), not an execution tracker. Task titles are translated for display; the `#N` identifier is the stable value that maps back to the source spreadsheet.',
  },
};

const SIZE_COUNTS = { S: 6, M: 7, L: 3 };
const TOTAL_TASKS = 16;
const TOTAL_PHASES = 7;

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function render(lang) {
  const t = I18N[lang];
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  document.documentElement.setAttribute('data-active-lang', lang); // drives the Dúvidas tab's PT/EN spans (CSS-only toggle, no re-render)
  document.title = lang === 'pt' ? 'Catapult — Painel de Migração' : 'Catapult — Migration Panel';

  document.getElementById('t-titleSuffix').textContent = t.titleSuffix;
  document.getElementById('t-intro').innerHTML = t.intro;

  document.getElementById('kpis').innerHTML = `
    <div class="kpi"><b>${TOTAL_TASKS}</b><span>${esc(t.kpiLabels.tasks)}</span></div>
    <div class="kpi"><b>${TOTAL_PHASES}</b><span>${esc(t.kpiLabels.phases)}</span></div>
    <div class="kpi">
      <div class="mix"><b>${SIZE_COUNTS.S}</b><span class="size-chip S">S</span>&nbsp;<b>${SIZE_COUNTS.M}</b><span class="size-chip M">M</span>&nbsp;<b>${SIZE_COUNTS.L}</b><span class="size-chip L">L</span></div>
      <span>${esc(t.kpiLabels.sizeMix)}</span>
    </div>
    <div class="kpi"><b>1</b><span>${esc(t.kpiLabels.finding)}</span></div>
  `;

  document.getElementById('legend').innerHTML = `
    <span><span class="size-chip S">S</span> ${esc(t.legend.S)}</span>
    <span><span class="size-chip M">M</span> ${esc(t.legend.M)}</span>
    <span><span class="size-chip L">L</span> ${esc(t.legend.L)}</span>
  `;

  document.getElementById('phases').innerHTML = t.phases.map((phase, i) => `
    <div class="phase">
      <header>
        <span class="num">${i + 1}</span>
        <h2>${esc(phase.title)}</h2>
        <span class="count">${esc(t.taskCountLabel(phase.tasks.length))}</span>
      </header>
      <ol class="tasks">
        ${phase.tasks.map((task) => `
          <li class="${task.flag ? 'flag' : ''}">
            <div class="task-head">
              <span class="task-title">#${task.id} · ${esc(TASK_TITLES[lang][task.id])}</span>
              <span class="size-chip ${task.size}">${task.size}</span>
            </div>
            <div class="task-desc">${esc(task.desc)}</div>
            ${task.flag ? `<div class="task-flag">${esc(task.flag)}</div>` : ''}
          </li>
        `).join('')}
      </ol>
    </div>
  `).join('');

  document.getElementById('footer').innerHTML = t.footer;

  // Dúvidas tab textarea placeholders — the one attribute that can't hold two
  // visible spans, so it's swapped directly instead of CSS-toggled.
  document.querySelectorAll('[data-ph-pt]').forEach((el) => {
    el.placeholder = lang === 'pt' ? el.dataset.phPt : el.dataset.phEn;
  });

  document.getElementById('btn-view-resumo').textContent = t.viewLabels.resumo;
  document.getElementById('btn-view-duvidas').textContent = t.viewLabels.duvidas;
  document.getElementById('btn-view-cronograma').textContent = t.viewLabels.cronograma;
  document.getElementById('btn-view-riscos').textContent = t.viewLabels.riscos;
  document.getElementById('t-duvidasIntro').innerHTML = t.duvidasIntro;

  document.getElementById('btn-pt').classList.toggle('active', lang === 'pt');
  document.getElementById('btn-en').classList.toggle('active', lang === 'en');

  renderGantt(lang);
  renderRiscos(lang);
}

// ---------------------------------------------------------------------------
// Cronograma / Gantt — derived from the same I18N phases/tasks data used by
// the Resumo tab (no separate data source to keep in sync). Duration per
// task is estimated from its S/M/L size; the whole schedule assumes purely
// SEQUENTIAL execution (no parallelism between tasks/phases) — it's a
// relative-scale visualization of the plan, not a committed schedule.
// ---------------------------------------------------------------------------
const GANTT_SIZE_DAYS = { S: 2, M: 4, L: 8 };

function computeSchedule(lang) {
  const t = I18N[lang];
  let cursor = 0;
  const rows = [];
  t.phases.forEach((phase, phaseIdx) => {
    phase.tasks.forEach((task) => {
      const dur = GANTT_SIZE_DAYS[task.size];
      const start = cursor;
      cursor += dur;
      rows.push({ phaseIdx, phaseTitle: phase.title, id: task.id, size: task.size, start, dur });
    });
  });
  return { rows, totalDays: cursor };
}

function renderGantt(lang) {
  const t = I18N[lang];
  const { rows, totalDays } = computeSchedule(lang);
  const weeks = Math.max(1, Math.ceil(totalDays / 5));
  const weekLabel = lang === 'pt' ? 'Sem' : 'Wk';
  const dayLabel = lang === 'pt' ? 'dias úteis' : 'business days';

  let headerHtml = '';
  for (let w = 0; w < weeks; w++) {
    const pct = (w * 5 / totalDays) * 100;
    headerHtml += `<span class="gantt-week" style="left:${pct}%">${weekLabel} ${w + 1}</span>`;
  }

  let rowsHtml = '';
  let lastPhase = -1;
  rows.forEach((r) => {
    if (r.phaseIdx !== lastPhase) {
      rowsHtml += `<div class="gantt-phase-label">${esc(r.phaseIdx + 1)}. ${esc(r.phaseTitle)}</div>`;
      lastPhase = r.phaseIdx;
    }
    const leftPct = (r.start / totalDays) * 100;
    const widthPct = (r.dur / totalDays) * 100;
    const title = TASK_TITLES[lang][r.id];
    const tip = `${title} — ${r.dur}${lang === 'pt' ? 'd' : 'd'} (${lang === 'pt' ? 'dia' : 'day'} ${r.start + 1}–${r.start + r.dur})`;
    rowsHtml += `
      <div class="gantt-row">
        <div class="gantt-label" title="${esc(title)}"><span class="gnum">#${r.id}</span>${esc(title)}</div>
        <div class="gantt-track">
          <div class="gantt-bar ${r.size}" style="left:${leftPct}%;width:${widthPct}%" title="${esc(tip)}">${r.dur}d</div>
        </div>
      </div>`;
  });

  const introPt = `Cronograma estimado a partir do tamanho de cada tarefa (S=2 dias úteis, M=4, L=8), assumindo execução <strong>sequencial</strong> — sem paralelismo entre tarefas ou fases. Duração total: <strong>${totalDays} dias úteis</strong> (~${weeks} semanas). É visualização de escala relativa, não um cronograma comprometido.`;
  const introEn = `Estimated schedule from each task's size (S=2 business days, M=4, L=8), assuming <strong>sequential</strong> execution — no parallelism between tasks or phases. Total duration: <strong>${totalDays} business days</strong> (~${weeks} weeks). This is a relative-scale visualization, not a committed schedule.`;
  document.getElementById('t-cronogramaIntro').innerHTML = lang === 'pt' ? introPt : introEn;

  const totalText = lang === 'pt'
    ? `Total: ${totalDays} ${dayLabel} (~${weeks} semanas / ~${Math.round(totalDays / 20)} meses úteis), 16 tarefas, execução sequencial.`
    : `Total: ${totalDays} ${dayLabel} (~${weeks} weeks / ~${Math.round(totalDays / 20)} working months), 16 tasks, sequential execution.`;

  document.getElementById('gantt').innerHTML = `
    <div class="gantt-inner">
      <div class="gantt-header">${headerHtml}</div>
      ${rowsHtml}
      <div class="gantt-total">${esc(totalText)}</div>
    </div>
  `;
}

// Deviation risks — tied to specific Dúvidas/Questions checklist ids. The
// Gantt/schedule tab does NOT incorporate any checklist answer, known or
// still open; this list exists to make that gap explicit rather than silent.
const RISKS = [
  { id: 'lov-scope', pt: { q: 'Lovable vai reescrever telas existentes?', d: 'Se sim, Fase 7 (hoje 8d) pode virar indeterminando. É fundamental a paralisação de alteração de fluxos, lógica, telas e etc, até total migração.' }, en: { q: 'Will Lovable rewrite existing screens?', d: 'If so, Phase 7 (currently 8d) could become indeterminate. It is essential to freeze changes to flows, logic, screens, etc., until the migration is fully complete.' } },
  { id: 'lov-scope+dat-migrations', pt: { q: 'Banco atual é MySQL, mas Supabase (Lovable) roda PostgreSQL — engines diferentes', d: 'Se a decisão for mesmo mover o banco pro Supabase, #9 e #16 deixam de ser "restore"/"definir estratégia" e viram migração de engine real: mapeamento de tipos (AUTO_INCREMENT→SERIAL, ENUM, TINYINT booleano), reescrita de queries com dialeto divergente (LIMIT, GROUP_CONCAT, funções de data, GROUP BY estrito), stored procedures/triggers que não portam 1:1, e diferença de collation/case-sensitivity que pode mudar ordenação e resultado de busca silenciosamente.' }, en: { q: 'Current DB is MySQL, but Supabase (Lovable) runs PostgreSQL — different engines', d: 'If the decision is really to move the database to Supabase, #9 and #16 stop being "restore"/"define strategy" and become a real engine migration: type mapping (AUTO_INCREMENT→SERIAL, ENUM, boolean TINYINT), query rewrites for a diverging SQL dialect (LIMIT, GROUP_CONCAT, date functions, strict GROUP BY), stored procedures/triggers that don\'t port 1:1, and collation/case-sensitivity differences that can silently change sort order and search results.' } },
  { id: 'cicd-fact', pt: { q: 'Fato confirmado: sem teste automatizado hoje', d: '#11 (já L=8d) provavelmente está subestimada — validação 100% manual tende a dobrar o esforço.' }, en: { q: 'Confirmed fact: no automated tests today', d: '#11 (already L=8d) is probably underestimated — fully manual validation tends to double the effort.' } },
  { id: 'job-session', pt: { q: 'Sessão em arquivo local no servidor?', d: 'Se sim, precisa de uma tarefa nova (migrar pra Redis/DB) antes de #10 — não está nas 16 tarefas hoje.' }, en: { q: 'Session stored in a local server file?', d: 'If so, needs a new task (migrate to Redis/DB) before #10 — not in the current 16 tasks.' } },
  { id: 'job-uploads', pt: { q: 'Uploads em disco local?', d: 'Mesma lógica — precisa tarefa nova de migração pra storage externo antes do cutover.' }, en: { q: 'Uploads on local disk?', d: 'Same logic — needs a new migration task to external storage before cutover.' } },
  { id: 'test-fixtures', pt: { q: 'Massa de teste/fixtures ainda não existe?', d: '#9 e #11 não têm o que usar sem isso — precisa de tarefa de preparo fora das 16 atuais.' }, en: { q: "Test data/fixtures don't exist yet?", d: '#9 and #11 have nothing to use without this — needs prep work outside the current 16 tasks.' } },
  { id: 'host-cutover', pt: { q: 'Allowlist de IP / webhooks / SPF-DKIM no host atual?', d: 'Cutover passa a depender de terceiros liberarem o IP novo — dias de calendário parado esperando, não de esforço.' }, en: { q: 'IP allowlist / webhooks / SPF-DKIM on current host?', d: 'Cutover depends on third parties allowing the new IP — calendar days spent waiting, not effort days.' } },
];

function renderRiscos(lang) {
  document.getElementById('t-riscosIntro').innerHTML = lang === 'pt'
    ? 'Fatores das respostas do checklist (aba Dúvidas) que podem desviar prazo/esforço em relação ao cronograma da aba Cronograma. O Gantt de hoje <strong>NÃO</strong> incorpora nenhuma dessas respostas — esta lista existe pra deixar essa lacuna explícita.'
    : "Checklist (Questions tab) factors that could shift the timeline/effort away from the Schedule tab's plan. Today's Gantt does <strong>NOT</strong> incorporate any of these answers — this list exists to make that gap explicit rather than silent.";

  document.getElementById('riscosList').innerHTML = RISKS
    .map((r) => `<div class="risk-item"><div class="rq">${esc(r[lang].q)}</div><div class="rd">${esc(r[lang].d)}</div></div>`)
    .join('');
}

function setLang(lang) {
  try { localStorage.setItem('catapult-lang', lang); } catch (e) {}
  render(lang);
}

function setTheme(theme) {
  try { localStorage.setItem('catapult-theme', theme); } catch (e) {}
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('btn-light').classList.toggle('active', theme === 'light');
  document.getElementById('btn-dark').classList.toggle('active', theme === 'dark');
}

function setView(view) {
  try { localStorage.setItem('catapult-view', view); } catch (e) {}
  applyView(view);
}

function applyView(view) {
  document.getElementById('view-resumo').style.display = view === 'resumo' ? '' : 'none';
  document.getElementById('view-duvidas').style.display = view === 'duvidas' ? '' : 'none';
  document.getElementById('view-cronograma').style.display = view === 'cronograma' ? '' : 'none';
  document.getElementById('view-riscos').style.display = view === 'riscos' ? '' : 'none';
  document.getElementById('btn-view-resumo').classList.toggle('active', view === 'resumo');
  document.getElementById('btn-view-duvidas').classList.toggle('active', view === 'duvidas');
  document.getElementById('btn-view-cronograma').classList.toggle('active', view === 'cronograma');
  document.getElementById('btn-view-riscos').classList.toggle('active', view === 'riscos');
}

document.getElementById('btn-pt').addEventListener('click', () => setLang('pt'));
document.getElementById('btn-en').addEventListener('click', () => setLang('en'));
document.getElementById('btn-light').addEventListener('click', () => setTheme('light'));
document.getElementById('btn-dark').addEventListener('click', () => setTheme('dark'));
document.getElementById('btn-view-cronograma').addEventListener('click', () => setView('cronograma'));
document.getElementById('btn-view-riscos').addEventListener('click', () => setView('riscos'));
document.getElementById('btn-view-resumo').addEventListener('click', () => setView('resumo'));
document.getElementById('btn-view-duvidas').addEventListener('click', () => setView('duvidas'));

let initialLang = 'en';
try {
  const saved = localStorage.getItem('catapult-lang');
  if (saved === 'pt' || saved === 'en') initialLang = saved;
} catch (e) {}
render(initialLang);

let initialTheme = 'light';
try {
  const savedTheme = localStorage.getItem('catapult-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') initialTheme = savedTheme;
} catch (e) {}
applyTheme(initialTheme);

// PHP just redirected here with ?saved=1#duvidas after a successful save — jump
// straight to the Dúvidas tab so the confirmation banner and updated audit
// trail are visible immediately, regardless of whatever tab was persisted.
let initialView = <?= $justSaved ? "'duvidas'" : "null" ?>;
if (!initialView) {
  try {
    const savedView = localStorage.getItem('catapult-view');
    if (['resumo', 'duvidas', 'cronograma', 'riscos'].includes(savedView)) initialView = savedView;
  } catch (e) {}
}
applyView(initialView || 'resumo');
</script>
</body></html>
