/**
 * Catálogo Segmento → Atividade dos campos comerciais do SettingsModal
 * (ABL / Contrato / Segmento / Atividade — visíveis só para @myio / superadmin).
 *
 * O host pode substituir o catálogo via `segmentCatalog` (lista ou loader async);
 * sem isso vale DEFAULT_STORE_SEGMENTS.
 *
 * DEFAULT_STORE_SEGMENTS = classificação Abrasce: Segmento = "Grupo Abrasce Nv1",
 * Atividade = "Grupo Abrasce Nv3" — valores únicos extraídos de
 * Informacoes-Contratuais-Lojas.xlsx (Sá Cavalcante, 1.588 contratos, 2026-10-22).
 * Grafia mantida exatamente como na planilha (inclusive "Feminimos", "Especias",
 * "Surfewear") para casar com importações futuras desses dados.
 */

export interface StoreSegment {
  /** Nome do segmento (valor gravado no atributo `segment`) */
  segment: string;
  /** Atividades do segmento (valor gravado no atributo `activity`) */
  activities: string[];
}

export type StoreSegmentCatalogSource = StoreSegment[] | (() => Promise<StoreSegment[]>);

export const DEFAULT_STORE_SEGMENTS: StoreSegment[] = [
  {
    segment: 'Conveniência / Serviços',
    activities: [
      'Agências De Viagens',
      'Alimentos Especias',
      'Consertos',
      'Correio',
      'Educação/Ensino',
      'Empórios',
      'Farmácias E Drogarias',
      'Foto Revelação',
      'Lavanderia',
      'Lotérica',
      'Outros Serviços',
      'Pet Shop',
      'Serviços Automotivos',
      'Serviços Estéticos',
      'Serviços Financeiros',
      'Serviços Gráficos',
      'Serviços Médicos(Clínicas/Laboratórios)',
      'Serviços Públicos',
      'Tatuagem/Piercing',
      'Venda E Locação De Veículos',
    ],
  },
  {
    segment: 'Entretenimento',
    activities: [
      'Arena Gamer',
      'Boliche',
      'Cinemas',
      'Outros(Museu,Espaço Cultural,Etc)',
      'Parques E Games',
    ],
  },
  {
    segment: 'Lojas Âncoras',
    activities: [
      'Academias',
      'Artigos Esportivos',
      'Centros Educacionais / Escolas / Faculdades / Universidades',
      'Construção E Decoração',
      'Eletrodomésticos, Eletrônicos',
      'Hipermercado / Supermercado / Atacarejo',
      'Magazines E/Ou Utensílios Para O Lar E Conveniência',
      'Moda',
      'Outros',
    ],
  },
  {
    segment: 'Lojas Satélites',
    activities: [
      'Acessórios',
      'Acessórios E Artigos Para Viagens',
      'Artigos Eletrônicos/Tecnologia Da Informação(Ti)',
      'Brinquedos',
      'Cafés, Bares E Chás',
      'Calçados Esportivos',
      'Calçados Feminimos',
      'Calçados Geral',
      'Calçados Infantis',
      'Calçados Masculinos',
      'Cama/Mesa/Banho',
      'Colchões',
      'Docerias',
      'Fast-Food',
      'Livraria',
      'Moda Esportiva',
      'Moda Feminina',
      'Moda Geral',
      'Moda Infantil',
      'Moda Íntima E Roupas Para Dormir',
      'Moda Masculina',
      'Moda Praia',
      'Moda Unissex',
      'Óticas',
      'Outros',
      'Perfumaria, Maquiagem E Cosméticos',
      'Puericultura',
      'Relojoarias, Joalherias',
      'Restaurantes Com Serviços',
      'Restaurantes Sem Serviços',
      'Surfewear / Streetwear',
      'Telefonia Geral',
      'Utensílios P/ Lar, Acessórios P/ Decoração E Presentes',
    ],
  },
  {
    segment: 'Mall E Merchandising',
    activities: [
      'Acessórios',
      'Alimentação E Bebidas',
      'Antenas De Operadoras',
      'Artigos Esportivos',
      'Artigos Para O Lar',
      'Brinquedos',
      'Calçados',
      'Conveniência / Serviços',
      'Eletrônicos',
      'Eventos',
      'Geek',
      'Livraria',
      'Mídia',
      'Óticas',
      'Outros',
      'Papelaria',
      'Perfumaria, Maquiagem E Cosméticos',
      'Relojoarias E Joalherias',
      'Telefonia E Acessórios',
      'Vending Machines',
      'Vestuário',
    ],
  },
  {
    segment: 'Megalojas',
    activities: [
      'Alimentação E Bebidas',
      'Artigos Esportivos',
      'Brinquedos',
      'Centros Educacionais / Escolas / Faculdades / Universidades',
      'Construção, Decoração',
      'Eletrodomésticos, Eletrônicos, Magazines E/Ou Utens. P/Lar',
      'Livrarias',
      'Magazines E/Ou Utensílios Para O Lar E Conveniência',
      'Material De Escritório / Papelaria / Informática',
      'Moda',
      'Outros',
      'Puericultura',
    ],
  },
  {
    segment: 'Semi-Âncoras',
    activities: [
      'Academias',
      'Alimentação E Bebidas',
      'Artigos Esportivos',
      'Brinquedos',
      'Centros Educacionais / Escolas / Faculdades / Universidades',
      'Eletrodomésticos, Eletrônicos, Magazines E/Ou Utens. P/Lar',
      'Livrarias',
      'Magazines E/Ou Utensílios Para O Lar E Conveniência',
      'Material De Escritório / Papelaria / Informática',
      'Moda',
      'Outros',
    ],
  },
];

/** Resolve o catálogo (lista direta ou loader async); falha/vazio → catálogo padrão. */
export async function loadStoreSegmentCatalog(source?: StoreSegmentCatalogSource): Promise<StoreSegment[]> {
  if (!source) return DEFAULT_STORE_SEGMENTS;
  try {
    const list = typeof source === 'function' ? await source() : source;
    return Array.isArray(list) && list.length > 0 ? list : DEFAULT_STORE_SEGMENTS;
  } catch (err) {
    console.warn('[SettingsModal] segmentCatalog loader falhou — usando catálogo padrão:', err);
    return DEFAULT_STORE_SEGMENTS;
  }
}

/** Atividades de um segmento; preserva um valor salvo que não esteja mais no catálogo. */
export function activitiesForSegment(catalog: StoreSegment[], segment: string, currentActivity?: string): string[] {
  const list = catalog.find((s) => s.segment === segment)?.activities ?? [];
  if (currentActivity && !list.includes(currentActivity)) return [...list, currentActivity];
  return list;
}
