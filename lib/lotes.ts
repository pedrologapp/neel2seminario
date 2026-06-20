/**
 * Sistema de lotes de ingresso.
 *
 * Um tipo_ingresso pode ter N lotes com preço e prazo distintos.
 * O lote "ativo" é o primeiro (cronologicamente) cujo valido_ate ainda
 * está no futuro. Lotes com valido_ate=null são "último lote" (sem prazo).
 */

export interface Lote {
  nome: string;
  preco: number;
  valido_ate: string | null; // ISO datetime ou null
}

export interface TipoIngressoComLotes {
  id?: string;
  nome: string;
  preco: number;
  descricao: string | null;
  lotes?: Lote[] | null;
}

/**
 * Ordena lotes cronologicamente (null = último).
 */
export function ordenarLotes(lotes: Lote[]): Lote[] {
  return [...lotes].sort((a, b) => {
    if (a.valido_ate === null && b.valido_ate === null) return 0;
    if (a.valido_ate === null) return 1; // sem prazo → fim
    if (b.valido_ate === null) return -1;
    return new Date(a.valido_ate).getTime() - new Date(b.valido_ate).getTime();
  });
}

/**
 * Retorna o lote ativo no momento atual (ou um dado timestamp).
 * Retorna null se não houver lotes configurados.
 */
export function getLoteAtivo(
  lotes: Lote[] | null | undefined,
  agora: Date = new Date(),
): Lote | null {
  if (!lotes || lotes.length === 0) return null;
  const ordenados = ordenarLotes(lotes);
  const agoraMs = agora.getTime();
  for (const lote of ordenados) {
    if (lote.valido_ate === null) return lote;
    if (new Date(lote.valido_ate).getTime() > agoraMs) return lote;
  }
  // Todos expiraram — retorna o último cronologicamente (que já expirou)
  return ordenados[ordenados.length - 1];
}

/**
 * Retorna os lotes que ainda virão (depois do ativo).
 */
export function getLotesFuturos(
  lotes: Lote[] | null | undefined,
  agora: Date = new Date(),
): Lote[] {
  if (!lotes || lotes.length === 0) return [];
  const ordenados = ordenarLotes(lotes);
  const ativo = getLoteAtivo(ordenados, agora);
  if (!ativo) return [];
  const idxAtivo = ordenados.indexOf(ativo);
  return ordenados.slice(idxAtivo + 1);
}

/**
 * Retorna o preço atual de um tipo_ingresso.
 * Se houver lotes, usa o preço do lote ativo. Senão, usa tipo.preco.
 */
export function getPrecoAtual(
  tipo: TipoIngressoComLotes,
  agora: Date = new Date(),
): number {
  const ativo = getLoteAtivo(tipo.lotes, agora);
  if (ativo) return Number(ativo.preco);
  return Number(tipo.preco);
}

/**
 * Retorna info do lote pra exibir ao pai:
 *  - rotulo: "1º Lote" ou nome custom
 *  - validoAte: data limite formatada
 *  - precoAtual: preço corrente
 *  - proximos: lista de "Depois de DD/MM: R$ X"
 */
export interface LoteDisplay {
  rotulo: string | null;
  validoAte: Date | null;
  precoAtual: number;
  proximos: { quandoMuda: Date; preco: number; nome: string }[];
}

/**
 * Remove o prefixo "Nº Lote - " do nome do tipo (convenção comum dos
 * admins). Ex: "1º Lote -  Senha (Responsáveis)" → "Senha (Responsáveis)".
 * Só remove se bater o padrão exato; nomes sem o prefixo passam inalterados.
 */
export function limparPrefixoLote(nome: string): string {
  return nome.replace(/^\d+\s*[ºo°]?\s*Lote\s*-\s*/i, "").trim();
}

/**
 * Monta o nome que vai pra `inscricoes.itens[].nome` (e pra UI):
 * tipo limpo + nome do lote ativo. Ex: "Senha (Responsáveis) — 2º Lote".
 * Se não houver lote ativo, retorna só o nome do tipo (limpo).
 */
export function montaNomeItem(
  tipoNome: string,
  lote: Lote | null | undefined,
): string {
  const base = limparPrefixoLote(tipoNome);
  if (!lote || !lote.nome) return base;
  return `${base} — ${lote.nome}`;
}

export function getLoteDisplay(
  tipo: TipoIngressoComLotes,
  agora: Date = new Date(),
): LoteDisplay {
  const ativo = getLoteAtivo(tipo.lotes, agora);
  const futuros = getLotesFuturos(tipo.lotes, agora);

  return {
    rotulo: ativo?.nome ?? null,
    validoAte: ativo?.valido_ate ? new Date(ativo.valido_ate) : null,
    precoAtual: getPrecoAtual(tipo, agora),
    proximos: futuros
      .filter((l) => l.valido_ate !== null)
      .map((l, i, arr) => {
        // O "quando muda" é o valido_ate do lote ANTERIOR (o atual ou o anterior na lista)
        // Para o primeiro futuro, é o valido_ate do lote ativo.
        const anterior = i === 0 ? ativo : arr[i - 1];
        return {
          quandoMuda: new Date(anterior!.valido_ate!),
          preco: Number(l.preco),
          nome: l.nome,
        };
      }),
  };
}
