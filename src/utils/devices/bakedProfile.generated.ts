// AUTO-GERADO por scripts/gen-baked-profile.mjs — NÃO EDITE À MÃO.
//
// RFC-0207 §B.1-3 — artefato BAKED derivado do seed in-code
// (`DEFAULT_DEVICE_CLASSIFICATION_PROFILE`).
//
// Regenerar:  npm run gen:baked-profile
// Verificar:  npm run gen:baked-profile -- --check   (falha se divergir do seed)
//
// Por que não há uma cópia da árvore aqui: o §B.1-3 exige "artefato derivado,
// nunca editado à mão → nunca uma 5ª cópia". O `BakedProfileSource` serve o
// próprio seed sob a version abaixo; este arquivo carrega apenas a VERSION e o
// MANIFESTO DE CHAVES (a fonte de verdade do golden de key-parity, §F).

/** sha256(12) do seed canonicalizado. Muda sempre que o seed muda. */
export const BAKED_PROFILE_VERSION = "d861298603d0";

/**
 * Manifesto canônico de chaves do seed (domínio / grupo / categoria).
 * O golden `key-parity` compara isto com as chaves que o MOTOR produz.
 * A reconciliação com o GCDR `is_system` (v3.2) é por arquivo commitado,
 * nunca por fetch em build-time — o build fica hermético.
 */
export const BAKED_PROFILE_KEYS: readonly string[] = Object.freeze([
  "energy",
  "energy.categories.climatizacao",
  "energy.categories.elevadores",
  "energy.categories.escadas_rolantes",
  "energy.categories.lojas",
  "energy.categories.outros",
  "energy.groups.areacomum",
  "energy.groups.entrada",
  "energy.groups.lojas",
  "energy.groups.ocultos",
  "temperature",
  "temperature.groups.climatizavel",
  "temperature.groups.nao_climatizavel",
  "temperature.groups.ocultos",
  "water",
  "water.groups.areacomum",
  "water.groups.caixadagua",
  "water.groups.entrada",
  "water.groups.lojas",
  "water.groups.ocultos",
]);
