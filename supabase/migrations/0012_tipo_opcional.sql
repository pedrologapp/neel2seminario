-- =============================================================
-- Migration 0012 — Vendas opcionais (com opções) por tipo de ingresso
-- =============================================================
-- tipos_ingresso.opcional: se TRUE, este item é uma "venda opcional"
-- (ex: almoço, sobremesa). O cliente pode adicioná-lo, mas ele NÃO conta
-- como ingresso obrigatório — a inscrição exige ao menos um item NÃO opcional.
--
-- tipos_ingresso.grupo: rótulo que agrupa opções de uma mesma venda opcional.
-- Ex: "Almoço" agrupa "Frango" e "Vegetariano" (cada opção é um tipo próprio,
-- com seu preço e limite). NULL = item solto, sem agrupamento.
--
-- Como rodar:
--   1. https://supabase.com/dashboard/project/_/sql/new
--   2. Cole este arquivo
--   3. Run
-- =============================================================

alter table public.tipos_ingresso
  add column if not exists opcional boolean not null default false;

comment on column public.tipos_ingresso.opcional is
  'Se TRUE, é uma venda opcional (ex: almoço). Não conta como ingresso obrigatório na inscrição.';

alter table public.tipos_ingresso
  add column if not exists grupo text;

comment on column public.tipos_ingresso.grupo is
  'Rótulo que agrupa opções de uma mesma venda opcional (ex: "Almoço" agrupa "Frango" e "Vegetariano"). NULL = sem agrupamento.';
