/**
 * RFC-0237 — pt-BR labels shared by the list (filters.ts) and the exports (exportRows.ts).
 */

import type { AtividadeLevel, CadastroLevel, LifecycleStatus } from './types';

export const CADASTRO_LABELS: Record<CadastroLevel, string> = {
  ok: 'Íntegro',
  pending: 'Pendente',
  critical: 'Crítico',
  partial: 'Parcial',
  excluded: 'Fora dos indicadores',
};

export const ATIVIDADE_LABELS: Record<AtividadeLevel, string> = {
  ok: 'Reportando',
  inactive: 'Sem atividade',
  nodata: 'Sem dado',
  excluded: 'Fora dos indicadores',
};

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  active: 'Ativo',
  stock: 'Estoque',
  archived: 'Arquivado',
};

export const DOMAIN_LABELS: Record<string, string> = {
  energy: 'Energia',
  water: 'Água',
  temperature: 'Temperatura',
  tank: 'Reservatório',
  solenoid: 'Solenoide',
  unclassified: 'Não classificado',
};
