-- =============================================================
-- Migration 0002 — Lotes de ingresso
-- =============================================================
-- Adiciona coluna `lotes` em tipos_ingresso com array de lotes:
--   [{nome, preco, valido_ate (timestamptz ISO)}]
--
-- Comportamento esperado:
--   - lotes vazio/null → usa o preço base (campo `preco`) como sempre
--   - lotes com entradas → o preço atual é o do primeiro lote com
--     valido_ate > now() (ordenado cronologicamente). Lotes com
--     valido_ate = null são considerados "sem expiração" (último lote).
--
-- Como rodar:
--   1. https://supabase.com/dashboard/project/lzqhjutknqeuhscfxald/sql/new
--   2. Cole este arquivo
--   3. Run
-- =============================================================

alter table public.tipos_ingresso
  add column if not exists lotes jsonb not null default '[]'::jsonb;

-- Comentário pra documentar a estrutura esperada
comment on column public.tipos_ingresso.lotes is
  'Array de lotes: [{nome: text, preco: numeric, valido_ate: timestamptz|null}]. Se vazio, usar o campo preco.';
