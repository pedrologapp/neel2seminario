-- =============================================================
-- Migration 0013 — Palestrantes e contatos do evento
-- =============================================================
-- eventos.palestrantes: lista de palestrantes, cada um com nome e foto.
--   Formato JSONB: [{ "nome": "Jorge Elarrat (RO)", "foto_url": "https://..." }]
--
-- eventos.contatos: números de telefone/WhatsApp exibidos no rodapé da
--   página pública do evento. Ex: {"(84) 9 9133-5975","(84) 9 8804-9371"}
--
-- Como rodar:
--   1. https://supabase.com/dashboard/project/_/sql/new
--   2. Cole este arquivo
--   3. Run
-- =============================================================

alter table public.eventos
  add column if not exists palestrantes jsonb not null default '[]'::jsonb;

comment on column public.eventos.palestrantes is
  'Lista de palestrantes: [{ nome, foto_url }]. foto_url pode ser null.';

alter table public.eventos
  add column if not exists contatos text[] not null default '{}'::text[];

comment on column public.eventos.contatos is
  'Números de telefone/WhatsApp exibidos no rodapé da página pública.';
