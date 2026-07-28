#!/usr/bin/env node
/**
 * gen-baked-profile.mjs — RFC-0207 §B.1-3: artefato BAKED derivado do seed in-code.
 *
 * Gera `src/utils/devices/bakedProfile.generated.ts` a partir de
 * `DEFAULT_DEVICE_CLASSIFICATION_PROFILE`. O arquivo gerado carrega:
 *
 *   - `BAKED_PROFILE_VERSION` — hash sha256 (12 hex) do seed canonicalizado.
 *     Muda sempre que o seed muda → detecta "baked estanque".
 *   - `BAKED_PROFILE_KEYS`    — manifesto CANÔNICO de chaves (domínio, grupo,
 *     categoria). É a fonte do golden de key-parity (§F): `keys(engine) ===
 *     keys(baked)`. A reconciliação com o GCDR `is_system` (v3.2) é por ARQUIVO
 *     COMMITADO, nunca por rede — o build permanece hermético (§G).
 *
 * O que NÃO é gerado: uma segunda cópia da árvore. O §B.1-3 é explícito —
 * "artefato derivado, nunca editado à mão → **nunca uma 5ª cópia**". O
 * `BakedProfileSource` serve o próprio seed sob a version gerada, então o baked
 * é versionado e custa ~0 KB de bundle além do seed que já existe.
 *
 * NUNCA edite o arquivo gerado à mão. Rode:
 *   npm run gen:baked-profile
 *
 * CI: `npm run gen:baked-profile -- --check` falha se o commitado divergir do
 * que o seed produz agora (é isso que impede o artefato de apodrecer).
 */

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SEED_TS = resolve(REPO_ROOT, 'src/utils/devices/deviceClassificationProfile.ts');
const OUT_TS = resolve(REPO_ROOT, 'src/utils/devices/bakedProfile.generated.ts');

const checkOnly = process.argv.includes('--check');

/** Chaves ordenadas e estáveis (JSON canônico) para o hash não oscilar. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = canonical(value[k]);
    return out;
  }
  return value;
}

/**
 * Manifesto de chaves do seed. É deliberadamente ESTRUTURAL (domínio → grupos /
 * categorias) e não carrega valores de membership: o key-parity compara CHAVES,
 * não listas de match (§v3.2-B: "key-parity cobre baked ↔ GCDR-system, nunca
 * dado customer").
 */
function keyManifest(profile) {
  const out = [];
  for (const domain of Object.keys(profile.domains ?? {}).sort()) {
    const dom = profile.domains[domain];
    if (!dom) continue;
    out.push(`${domain}`);
    for (const r of dom.groups?.rules ?? []) out.push(`${domain}.groups.${r.name}`);
    if (dom.groups?.ocultosProfilePatterns) out.push(`${domain}.groups.ocultos`);
    if (dom.categories) {
      out.push(`${domain}.categories.lojas`);
      for (const r of dom.categories.rules ?? []) out.push(`${domain}.categories.${r.name}`);
      if (dom.categories.fallback?.name) {
        out.push(`${domain}.categories.${dom.categories.fallback.name}`);
      }
    }
  }
  return [...new Set(out)].sort();
}

async function loadSeed() {
  const dir = mkdtempSync(join(tmpdir(), 'myio-baked-'));
  const outfile = join(dir, 'seed.mjs');
  try {
    await build({
      entryPoints: [SEED_TS],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node18',
      logLevel: 'silent',
    });
    const mod = await import(pathToFileURL(outfile).href);
    return mod.DEFAULT_DEVICE_CLASSIFICATION_PROFILE;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function render(version, keys) {
  return `// AUTO-GERADO por scripts/gen-baked-profile.mjs — NÃO EDITE À MÃO.
//
// RFC-0207 §B.1-3 — artefato BAKED derivado do seed in-code
// (\`DEFAULT_DEVICE_CLASSIFICATION_PROFILE\`).
//
// Regenerar:  npm run gen:baked-profile
// Verificar:  npm run gen:baked-profile -- --check   (falha se divergir do seed)
//
// Por que não há uma cópia da árvore aqui: o §B.1-3 exige "artefato derivado,
// nunca editado à mão → nunca uma 5ª cópia". O \`BakedProfileSource\` serve o
// próprio seed sob a version abaixo; este arquivo carrega apenas a VERSION e o
// MANIFESTO DE CHAVES (a fonte de verdade do golden de key-parity, §F).

/** sha256(12) do seed canonicalizado. Muda sempre que o seed muda. */
export const BAKED_PROFILE_VERSION = ${JSON.stringify(version)};

/**
 * Manifesto canônico de chaves do seed (domínio / grupo / categoria).
 * O golden \`key-parity\` compara isto com as chaves que o MOTOR produz.
 * A reconciliação com o GCDR \`is_system\` (v3.2) é por arquivo commitado,
 * nunca por fetch em build-time — o build fica hermético.
 */
export const BAKED_PROFILE_KEYS: readonly string[] = Object.freeze([
${keys.map((k) => `  ${JSON.stringify(k)},`).join('\n')}
]);
`;
}

const seed = await loadSeed();
if (!seed) {
  console.error('[gen-baked-profile] DEFAULT_DEVICE_CLASSIFICATION_PROFILE não encontrado no seed');
  process.exit(1);
}

const version = createHash('sha256').update(JSON.stringify(canonical(seed))).digest('hex').slice(0, 12);
const keys = keyManifest(seed);
const next = render(version, keys);

if (checkOnly) {
  const current = existsSync(OUT_TS) ? readFileSync(OUT_TS, 'utf8') : '';
  if (current.replace(/\r\n/g, '\n') !== next.replace(/\r\n/g, '\n')) {
    console.error(
      '[gen-baked-profile] ✗ bakedProfile.generated.ts está DESATUALIZADO em relação ao seed.\n' +
        '                     Rode: npm run gen:baked-profile',
    );
    process.exit(1);
  }
  console.log(`[gen-baked-profile] ✓ baked em dia (version ${version}, ${keys.length} chaves)`);
  process.exit(0);
}

writeFileSync(OUT_TS, next, 'utf8');
console.log(`[gen-baked-profile] escrito ${OUT_TS} (version ${version}, ${keys.length} chaves)`);
