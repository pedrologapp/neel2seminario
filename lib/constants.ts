/**
 * Constantes do NEEL — usadas no admin e no site público.
 * No futuro pode virar uma tabela `config` no Supabase, mas por
 * enquanto é mais simples como hardcoded.
 */

export const STATUS_LABELS = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  encerrado: "Encerrado",
} as const;
