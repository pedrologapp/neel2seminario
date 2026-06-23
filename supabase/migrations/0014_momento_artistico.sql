-- =============================================================
-- Migration 0014 — Momento Artístico do evento
-- =============================================================
-- eventos.momento_artistico: lista de atrações/artistas, cada uma com nome
--   e foto (mesmo formato dos palestrantes).
--   Formato JSONB: [{ "nome": "Coral NEEL", "foto_url": "https://..." }]
--
-- Como rodar:
--   1. https://supabase.com/dashboard/project/_/sql/new
--   2. Cole este arquivo
--   3. Run
-- =============================================================

alter table public.eventos
  add column if not exists momento_artistico jsonb not null default '[]'::jsonb;

comment on column public.eventos.momento_artistico is
  'Lista do momento artístico: [{ nome, foto_url }]. foto_url pode ser null.';
