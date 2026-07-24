// tests/deviceClassificationProfile.treeWalker.test.ts
//
// RFC-0207 v2/v3.1 — walker genérico sobre a árvore de nós.
//
// Dois goldens moram aqui:
//
//   1. EQUIVALÊNCIA v1 ↔ v2 (§J): a árvore levantada do seed (`liftProfileToTree`)
//      classifica CADA device do fixture na mesma folha que o par
//      `resolveGroup`/`resolveCategory` do v1. Diff esperado: **ZERO**. Este é o
//      teste que autoriza, num passo futuro, trocar o caminho de produção para o
//      walker — sem ele a troca seria fé.
//
//   2. ORDER-SENSITIVITY (§F): o `order` é o que torna a avaliação determinística,
//      e o fallback nunca pode sombrear um irmão real.

import { describe, it, expect } from 'vitest';
import {
  resolveGroup,
  resolveCategory,
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  type ClassificationDomain,
  type ClassifiableItem,
} from '../src/utils/devices/deviceClassificationProfile';
import {
  liftProfileToTree,
  resolveClassification,
  resolveSubcategory,
  validateTree,
  findNode,
  flattenTree,
  type ClassificationNode,
} from '../src/utils/devices/classificationNodeTree';

const PROFILE = DEFAULT_DEVICE_CLASSIFICATION_PROFILE;

// ===========================================================================
// ORÁCULO v1 — a folha que o par groups/categories produz hoje.
//
// O merge do v2 (§C) funde colunas e breakdown numa lista só de nós de topo,
// então a folha equivalente é: a COLUNA quando ela é decisiva (ocultos / lojas /
// entrada) e a CATEGORIA quando o device caiu no residual.
// ===========================================================================
function v1Leaf(item: ClassifiableItem, domain: ClassificationDomain): string {
  const g = resolveGroup(item, PROFILE, domain).group;
  if (domain !== 'energy') return g;
  if (g === 'ocultos' || g === 'lojas' || g === 'entrada') return g;
  return resolveCategory(item, PROFILE, domain).category;
}

// ===========================================================================
// FIXTURE compartilhado — cobre cada caminho do motor.
// ===========================================================================
const ENERGY_FIXTURE: ClassifiableItem[] = [
  { deviceProfile: '3F_MEDIDOR', identifier: 'L-01' },
  { deviceProfile: 'TRAFO', identifier: 'T-01' },
  { deviceProfile: 'ENTRADA', identifier: 'E-01' },
  { deviceProfile: 'RELOGIO', identifier: 'R-01' },
  { deviceProfile: 'SUBESTACAO', identifier: 'S-01' },
  { deviceProfile: 'CHILLER', identifier: 'CH-01' },
  { deviceProfile: 'AR_CONDICIONADO', identifier: 'AC-01' },
  { deviceProfile: 'HVAC', identifier: 'H-01' },
  { deviceProfile: 'FANCOIL', identifier: 'F-01' },
  { deviceProfile: 'ELEVADOR', identifier: 'CAG' }, // exato vence sinal solto
  { deviceProfile: 'ESCADA_ROLANTE', identifier: 'X' },
  { deviceProfile: 'CHILLER_SECUNDARIO', identifier: 'X' }, // profileContains
  { deviceProfile: 'ELEVADOR_SOCIAL', identifier: 'X' },
  { deviceProfile: 'ESCADAS_ROLANTES', identifier: 'X' },
  { deviceProfile: 'COMPRESSOR', identifier: 'X' },
  { deviceProfile: 'VENTILADOR', identifier: 'X' },
  { deviceProfile: 'CLIMATIZACAO_GERAL', identifier: 'X' },
  { deviceProfile: 'BOMBA', identifier: 'CAG' }, // conditional
  { deviceProfile: 'BOMBA', identifier: 'BOMBA CAG 2' },
  { deviceProfile: 'MOTOR', identifier: 'FANCOIL-3' },
  { deviceProfile: 'MOTOR', identifier: 'NADA' }, // órfão
  { deviceProfile: '', identifier: 'ELV-03' }, // só identifier
  { deviceProfile: '', identifier: 'CAG' },
  { deviceProfile: '', identifier: 'ESC-2' },
  { deviceProfile: '', identifier: 'CHILLER-9' },
  { deviceProfile: 'GENERICO', identifier: 'G-1' },
  { deviceProfile: 'BOMBA_HIDRAULICA', identifier: 'BH-1' },
  { deviceProfile: 'BOMBA_INCENDIO', identifier: 'BI-1' },
  { deviceProfile: 'BOMBA_CAG', identifier: 'CAG-01' },
  { deviceProfile: 'CHILLER_ARQUIVADO', identifier: 'X' }, // ocultos
  { deviceProfile: 'MEDIDOR_INATIVO', identifier: 'X' },
  { deviceProfile: 'X_SEM_DADOS', identifier: 'X' },
];

const WATER_FIXTURE: ClassifiableItem[] = [
  { deviceProfile: 'HIDROMETRO_SHOPPING', identifier: 'HS-1' },
  { deviceProfile: 'HIDROMETRO', identifier: 'H-1' },
  { deviceProfile: 'TANK', identifier: 'T-1' },
  { deviceProfile: 'CAIXA_DAGUA', identifier: 'C-1' },
  { deviceProfile: 'HIDROMETRO_AREA_COMUM', identifier: 'HA-1' },
  { deviceProfile: 'HIDROMETRO_ARQUIVADO', identifier: 'X' },
  { deviceProfile: 'DESCONHECIDO', identifier: 'X' },
];

const TEMPERATURE_FIXTURE: ClassifiableItem[] = [
  { deviceProfile: 'TERMOSTATO', identifier: 'T-1' },
  { deviceProfile: 'TERMOSTATO_EXTERNAL', identifier: 'TE-1' },
  { deviceProfile: 'TERMOSTATO_REMOVIDO', identifier: 'X' },
  { deviceProfile: 'OUTRO', identifier: 'X' },
];

function keyOf(i: ClassifiableItem): string {
  return `${i.deviceProfile ?? ''}|${i.identifier ?? ''}`;
}

// ===========================================================================
// GOLDEN 1 — equivalência v1 ↔ walker(árvore levantada)
// ===========================================================================
describe('RFC-0207 §J — golden de equivalência v1 ↔ árvore v2 (diff esperado: ZERO)', () => {
  it.each([
    ['energy', ENERGY_FIXTURE],
    ['water', WATER_FIXTURE],
    ['temperature', TEMPERATURE_FIXTURE],
  ] as [ClassificationDomain, ClassifiableItem[]][])(
    'domínio %s: nenhum device muda de folha',
    (domain, fixture) => {
      const tree = liftProfileToTree(PROFILE, domain);
      const diffs: string[] = [];
      for (const item of fixture) {
        const expected = v1Leaf(item, domain);
        const actual = resolveClassification(item, tree)?.key;
        if (expected !== actual) diffs.push(`${keyOf(item)}: v1=${expected} walker=${actual}`);
      }
      expect(diffs).toEqual([]);
    },
  );

  it('item nulo cai no fallback nos dois motores (nunca lança)', () => {
    const tree = liftProfileToTree(PROFILE, 'energy');
    expect(resolveClassification(null, tree)?.key).toBe('outros');
    expect(v1Leaf(null as never, 'energy')).toBe('outros');
  });

  it('a árvore levantada passa em validateTree (order explícito, 1 fallback por nível)', () => {
    for (const domain of ['energy', 'water', 'temperature'] as ClassificationDomain[]) {
      expect(validateTree(liftProfileToTree(PROFILE, domain)), domain).toEqual([]);
    }
  });

  it('todo nó da árvore levantada carrega order inteiro EXPLÍCITO (§B.1-1)', () => {
    for (const n of flattenTree(liftProfileToTree(PROFILE, 'energy'))) {
      expect(Number.isInteger(n.order), `${n.key} sem order inteiro`).toBe(true);
    }
  });

  it('areacomum vira nó COMPUTADO (residual), não um balde de devices', () => {
    const tree = liftProfileToTree(PROFILE, 'energy');
    const residual = findNode(tree, 'areacomum');
    expect(residual?.role).toBe('residual');
    expect(residual?.formula).toEqual({
      op: 'subtract',
      from: 'entrada',
      subtract: expect.arrayContaining(['lojas', 'climatizacao', 'elevadores', 'escadas_rolantes', 'outros']),
    });
    // e nenhum device é alocado nele (nós computados não classificam)
    for (const item of ENERGY_FIXTURE) {
      expect(resolveClassification(item, tree)?.key).not.toBe('areacomum');
    }
  });
});

// ===========================================================================
// GOLDEN 2 — order-sensitivity (§F)
// ===========================================================================
describe('RFC-0207 §F — golden order-sensitivity', () => {
  /** Dois irmãos que casam o MESMO device; só o `order` decide. */
  function ambiguousTree(fallbackOrder: number): ClassificationNode[] {
    return [
      { key: 'alfa', label: 'Alfa', role: 'consumer', order: 1, rules: { profileContains: ['BOMBA'] } },
      { key: 'beta', label: 'Beta', role: 'consumer', order: 2, rules: { profileContains: ['BOMBA'] } },
      { key: 'resto', label: 'Resto', role: 'fallback', order: fallbackOrder },
    ];
  }

  it('irmãos ambíguos: vence o menor `order` — e inverter o order inverte o resultado', () => {
    const item = { deviceProfile: 'BOMBA_HIDRAULICA' };
    const tree = ambiguousTree(9);
    expect(resolveClassification(item, tree)?.key).toBe('alfa');

    const inverted = ambiguousTree(9).map((n) =>
      n.key === 'alfa' ? { ...n, order: 5 } : n,
    ) as ClassificationNode[];
    expect(resolveClassification(item, inverted)?.key).toBe('beta');
  });

  it('a ordem do ARRAY não decide nada — só o campo `order` (§B.1-1)', () => {
    const item = { deviceProfile: 'BOMBA_HIDRAULICA' };
    const tree = ambiguousTree(9);
    const shuffled = [tree[2], tree[1], tree[0]];
    expect(resolveClassification(item, shuffled)?.key).toBe('alfa');
  });

  it('o fallback NUNCA sombreia um irmão real, mesmo com order menor', () => {
    // fallback com order 0 (antes de todos) — o walker só o consulta depois de
    // esgotar as fases exata e solta, então o irmão real continua vencendo.
    const tree = ambiguousTree(0);
    expect(resolveClassification({ deviceProfile: 'BOMBA_HIDRAULICA' }, tree)?.key).toBe('alfa');
    // e um device que não casa em ninguém cai no fallback
    expect(resolveClassification({ deviceProfile: 'NADA' }, tree)?.key).toBe('resto');
  });

  it('validateTree REJEITA um fallback que não é o maior order do nível', () => {
    const errors = validateTree(ambiguousTree(0));
    expect(errors.some((e) => /sombrearia a regra/.test(e))).toBe(true);
    expect(validateTree(ambiguousTree(9))).toEqual([]);
  });

  it('validateTree rejeita >1 fallback entre irmãos, key duplicada e formula órfã', () => {
    const bad: ClassificationNode[] = [
      { key: 'a', label: 'A', role: 'fallback', order: 1 },
      { key: 'a', label: 'A2', role: 'fallback', order: 2 },
      { key: 'c', label: 'C', role: 'total', order: 3, formula: { op: 'sum', of: ['inexistente'] } },
    ];
    const errors = validateTree(bad);
    expect(errors.some((e) => /fallback.*irmãos/.test(e))).toBe(true);
    expect(errors.some((e) => /key duplicada/.test(e))).toBe(true);
    expect(errors.some((e) => /key inexistente "inexistente"/.test(e))).toBe(true);
  });

  it('validateTree rejeita alocação não-única do mesmo deviceProfile (§R5)', () => {
    const bad: ClassificationNode[] = [
      { key: 'a', label: 'A', order: 1, rules: { deviceProfiles: ['MOTOR'] } },
      { key: 'b', label: 'B', order: 2, rules: { deviceProfiles: ['MOTOR'] } },
    ];
    expect(validateTree(bad).some((e) => /alocação não-única.*MOTOR/.test(e))).toBe(true);
  });

  it('validateTree exige order inteiro explícito', () => {
    const bad = [{ key: 'a', label: 'A' }] as unknown as ClassificationNode[];
    expect(validateTree(bad).some((e) => /order ausente ou não-inteiro/.test(e))).toBe(true);
  });
});

// ===========================================================================
// Tier-2 group-generic (§C-4)
// ===========================================================================
describe('RFC-0207 §C-4 — tier-2 group-generic (subcategoria = DADO, sem código novo)', () => {
  /** Climatização com filhos — o exemplo do §J, expresso só como dado. */
  const treeWithChildren: ClassificationNode[] = [
    { key: 'ocultos', label: 'Ocultos', role: 'ocultos', order: 0, rules: { profileContains: ['ARQUIVADO'] } },
    { key: 'lojas', label: 'Lojas', role: 'consumer', order: 1, rules: { deviceProfiles: ['3F_MEDIDOR'] } },
    {
      key: 'climatizacao',
      label: 'Climatização',
      role: 'consumer',
      order: 2,
      rules: { profileContains: ['CHILLER', 'FANCOIL', 'BOMBA'], identifierContains: ['CAG'] },
      children: [
        { key: 'chillers', label: 'Chillers', order: 1, rules: { deviceProfiles: ['CHILLER'], identifierPrefixes: ['CHILLER-'] } },
        { key: 'fancoils', label: 'Fancoils', order: 2, rules: { deviceProfiles: ['FANCOIL'], identifierPrefixes: ['FANCOIL-'] } },
        { key: 'bombas_hidraulicas', label: 'Bombas Hidráulicas', order: 3, rules: { deviceProfiles: ['BOMBA_HIDRAULICA'], identifierContains: ['CAG'] } },
        { key: 'outros_hvac', label: 'Outros HVAC', role: 'fallback', order: 4 },
      ],
    },
    // "Outros" com filhos — prova que NÃO há caso especial de climatização
    {
      key: 'outros',
      label: 'Outros Equipamentos',
      role: 'fallback',
      order: 3,
      children: [
        { key: 'iluminacao', label: 'Iluminação', order: 1, rules: { profileContains: ['ILUMINACAO'] } },
        { key: 'incendio', label: 'Incêndio', order: 2, rules: { profileContains: ['INCENDIO'] } },
        { key: 'outros_resto', label: 'Outros', role: 'fallback', order: 3 },
      ],
    },
  ];

  it('device-testemunha do §J: BOMBA_HIDRAULICA + "CAG 01" → climatizacao/bombas_hidraulicas', () => {
    const r = resolveClassification({ deviceProfile: 'BOMBA_HIDRAULICA', identifier: 'CAG 01' }, treeWithChildren);
    expect(r?.nodePath).toEqual(['climatizacao', 'bombas_hidraulicas']);
    expect(r?.key).toBe('bombas_hidraulicas');
  });

  it('conta UMA vez, na folha mais profunda (§I.1 D-b)', () => {
    const r = resolveClassification({ deviceProfile: 'CHILLER', identifier: 'CH-1' }, treeWithChildren);
    expect(r?.nodePath).toEqual(['climatizacao', 'chillers']);
  });

  it('sem filho que case, cai no fallback DAQUELE nível', () => {
    const r = resolveClassification({ deviceProfile: 'FANCOIL_X', identifier: 'Z' }, treeWithChildren);
    // FANCOIL_X casa climatizacao por profileContains; nenhum filho casa exato/solto
    expect(r?.nodePath).toEqual(['climatizacao', 'outros_hvac']);
  });

  it('"Outros" é apenas outro grupo com filhos — zero caso especial', () => {
    expect(
      resolveClassification({ deviceProfile: 'ILUMINACAO_G1', identifier: 'X' }, treeWithChildren)?.nodePath,
    ).toEqual(['outros', 'iluminacao']);
    expect(
      // NB: um profile contendo "BOMBA" cairia em climatizacao (order 2 < 3), como
      // manda a árvore deste fixture — por isso a sonda de incêndio usa um profile
      // que não carrega o token BOMBA.
      resolveClassification({ deviceProfile: 'INCENDIO_PAINEL', identifier: 'X' }, treeWithChildren)?.nodePath,
    ).toEqual(['outros', 'incendio']);
    expect(
      resolveClassification({ deviceProfile: 'QUALQUER', identifier: 'X' }, treeWithChildren)?.nodePath,
    ).toEqual(['outros', 'outros_resto']);
  });

  it('nova subcategoria = INSERIR UM NÓ (dado), sem tocar no motor', () => {
    const withParking: ClassificationNode[] = [
      ...treeWithChildren.filter((n) => n.key !== 'outros'),
      { key: 'estacionamento', label: 'Estacionamento', role: 'consumer', order: 3, rules: { profileContains: ['ESTACIONAMENTO'] },
        children: [
          { key: 'coberto', label: 'Coberto', order: 1, rules: { identifierContains: ['COB'] } },
          { key: 'externo', label: 'Externo', role: 'fallback', order: 2 },
        ] },
      { key: 'outros', label: 'Outros', role: 'fallback', order: 9 },
    ];
    expect(validateTree(withParking)).toEqual([]);
    expect(
      resolveClassification({ deviceProfile: 'ESTACIONAMENTO_A', identifier: 'COB-1' }, withParking)?.nodePath,
    ).toEqual(['estacionamento', 'coberto']);
    expect(
      resolveClassification({ deviceProfile: 'ESTACIONAMENTO_A', identifier: 'X' }, withParking)?.nodePath,
    ).toEqual(['estacionamento', 'externo']);
  });

  it('resolveSubcategory é group-generic e devolve null quando o grupo não é subdividido', () => {
    expect(
      resolveSubcategory({ deviceProfile: 'CHILLER' }, 'climatizacao', treeWithChildren)?.nodePath,
    ).toEqual(['climatizacao', 'chillers']);
    expect(resolveSubcategory({ deviceProfile: '3F_MEDIDOR' }, 'lojas', treeWithChildren)).toBeNull();
    expect(resolveSubcategory({ deviceProfile: 'X' }, 'inexistente', treeWithChildren)).toBeNull();
  });

  it('ocultos curto-circuita a árvore inteira', () => {
    const r = resolveClassification({ deviceProfile: 'CHILLER_ARQUIVADO', identifier: 'CH-1' }, treeWithChildren);
    expect(r?.key).toBe('ocultos');
    expect(r?.matchedBy).toBe('ocultos');
  });
});
