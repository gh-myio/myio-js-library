/**
 * RFC-0238 §7.2 — taxonomia da holding (pequena e comparável) derivada da classificação local.
 *
 * Mapeamento explícito e revisável por `deviceProfile` (autoridade de classificação —
 * deviceType em desuso). Nunca inferimos pelo nome do equipamento; o que não casar com
 * uma regra fica em "Não mapeado" (visível, não escondido em "Outros").
 */

import type { HoldingCategoryId } from './types';

export const HOLDING_CATEGORY_LABELS: Record<HoldingCategoryId, string> = {
  hvac: 'Climatização',
  'vertical-transport': 'Transporte vertical',
  pumping: 'Bombeamento',
  tenants: 'Lojas',
  supply: 'Entrada / medição geral',
  other: 'Outros equipamentos',
  unmapped: 'Não mapeado',
};

/** Ordem fixa de exibição (cores estáveis por ID canônico) */
export const HOLDING_CATEGORY_ORDER: HoldingCategoryId[] = [
  'hvac',
  'tenants',
  'vertical-transport',
  'pumping',
  'other',
  'supply',
  'unmapped',
];

const RULES: Array<{ id: HoldingCategoryId; match: RegExp }> = [
  { id: 'supply', match: /ENTRADA|RELOGIO|TRAFO|SUBESTACAO/ },
  { id: 'hvac', match: /CHILLER|FANCOIL|HVAC|AR_CONDICIONADO|BOMBA_CAG|\bCAG\b|_CAG|CAG_/ },
  { id: 'vertical-transport', match: /ELEVADOR|ESCADA_ROLANTE|ESCADA/ },
  { id: 'pumping', match: /BOMBA|MOTOR/ },
  { id: 'other', match: /3F_MEDIDOR|MEDIDOR/ },
];

/**
 * Categoria da holding para um device de energia.
 * @param context contexto do classified (ex.: 'stores' → lojas)
 */
export function resolveHoldingEnergyCategory(deviceProfile: string | undefined, context: string): HoldingCategoryId {
  if (context === 'stores') return 'tenants';
  if (context === 'entrada') return 'supply';
  const profile = String(deviceProfile || '').toUpperCase().trim();
  if (!profile) return 'unmapped';
  for (const rule of RULES) {
    if (rule.match.test(profile)) return rule.id;
  }
  return 'unmapped';
}
