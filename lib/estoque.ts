/**
 * Helpers de estoque/cota de ingressos por tipo.
 *
 * Regra: só inscrições com status_pagamento = "pago" contam.
 * Pendentes não reservam vaga (ver decisão de produto).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type EstoqueItem = {
  tipo_id: string;
  vendido: number;
  max: number | null; // null/0 = ilimitado
  restantes: number | null; // null = ilimitado, 0 = esgotado
  esgotado: boolean;
};

/**
 * Para um evento, soma `qtd` dos itens de todas as inscrições pagas
 * e cruza com o `max_ingressos` de cada tipo. Retorna um mapa por tipo_id.
 */
export async function calcEstoquePorTipo(
  supabase: SupabaseClient,
  eventoId: string,
): Promise<Map<string, EstoqueItem>> {
  const [tiposRes, inscricoesRes] = await Promise.all([
    supabase
      .from("tipos_ingresso")
      .select("id, max_ingressos")
      .eq("evento_id", eventoId),
    supabase
      .from("inscricoes")
      .select("itens")
      .eq("evento_id", eventoId)
      .eq("status_pagamento", "pago"),
  ]);

  const tipos = (tiposRes.data ?? []) as {
    id: string;
    max_ingressos: number | null;
  }[];
  const inscricoes = (inscricoesRes.data ?? []) as {
    itens: { tipo_id?: string; qtd?: number }[] | null;
  }[];

  // Soma qtd vendida por tipo a partir do JSONB
  const vendidos = new Map<string, number>();
  for (const insc of inscricoes) {
    for (const item of insc.itens ?? []) {
      if (!item.tipo_id) continue;
      const atual = vendidos.get(item.tipo_id) ?? 0;
      vendidos.set(item.tipo_id, atual + (item.qtd ?? 0));
    }
  }

  const out = new Map<string, EstoqueItem>();
  for (const t of tipos) {
    const vendido = vendidos.get(t.id) ?? 0;
    const max = t.max_ingressos && t.max_ingressos > 0 ? t.max_ingressos : null;
    const restantes = max === null ? null : Math.max(0, max - vendido);
    out.set(t.id, {
      tipo_id: t.id,
      vendido,
      max,
      restantes,
      esgotado: max !== null && vendido >= max,
    });
  }
  return out;
}

/**
 * Valida se os itens solicitados cabem na cota restante.
 * Retorna mensagem de erro pronta pra exibir, ou null se tudo ok.
 */
export function validarCotaItens(
  itens: { tipo_id: string; nome: string; qtd: number }[],
  estoque: Map<string, EstoqueItem>,
): string | null {
  for (const item of itens) {
    if (item.qtd <= 0) continue;
    const est = estoque.get(item.tipo_id);
    if (!est || est.max === null) continue;
    if (est.restantes !== null && item.qtd > est.restantes) {
      if (est.restantes === 0) {
        return `O ingresso "${item.nome}" está esgotado.`;
      }
      return `Restam apenas ${est.restantes} ingresso(s) de "${item.nome}". Ajuste a quantidade.`;
    }
  }
  return null;
}
