-- =============================================================
-- Migration 0008 — Limite de ingressos por tipo
-- =============================================================
-- 1. tipos_ingresso.max_ingressos: cota máxima de vendas (NULL = ilimitado).
-- 2. eventos.mostrar_estoque_publico: se TRUE, mostra "Restam X" pro cliente
--    na página pública. Caso contrário, mostra apenas "Esgotado" quando
--    estourar.
--
-- Como rodar:
--   1. https://supabase.com/dashboard/project/_/sql/new
--   2. Cole este arquivo
--   3. Run
-- =============================================================

alter table public.tipos_ingresso
  add column if not exists max_ingressos int;

comment on column public.tipos_ingresso.max_ingressos is
  'Cota máxima de ingressos vendidos deste tipo. NULL ou 0 = sem limite.';

alter table public.eventos
  add column if not exists mostrar_estoque_publico boolean not null default false;

comment on column public.eventos.mostrar_estoque_publico is
  'Se TRUE, a página pública mostra "Restam X" pro cliente. Caso contrário, apenas "Esgotado" quando estourar a cota.';
