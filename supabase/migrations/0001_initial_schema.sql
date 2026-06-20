-- =============================================================
-- NEEL — Núcleo Espírita Esperança de Luz — Schema inicial de eventos
-- =============================================================
-- Como rodar:
--   1. Abra o SQL Editor do SEU projeto Supabase:
--      https://supabase.com/dashboard/project/<SEU_PROJECT_REF>/sql/new
--   2. Cole TODO este arquivo
--   3. Clique em "Run"
--   Rode as migrations na ordem 0001 → 0011 (este projeto não usa 0012+).
--
-- Idempotente: pode rodar várias vezes sem quebrar.
-- =============================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "uuid-ossp";

-- ---------- ENUMS ----------
do $$ begin
  create type evento_status as enum ('rascunho', 'publicado', 'encerrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type inscricao_status as enum ('pendente', 'pago', 'cancelado', 'estornado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type metodo_pagamento as enum ('pix', 'cartao');
exception when duplicate_object then null; end $$;

-- ---------- TABLES ----------

create table if not exists public.eventos (
  id                  uuid primary key default uuid_generate_v4(),
  slug                text not null unique,
  nome                text not null,
  descricao_curta     text,
  descricao_longa     text,
  data_evento         date not null,
  hora_evento         time,
  local               text,
  imagem_capa_url     text,
  imagens_galeria     text[] default '{}'::text[],
  cor_tematica        text default '#1B3B7C',
  series_permitidas   text[],
  turmas_permitidas   text[],
  metodos_pagamento   metodo_pagamento[] not null default '{pix,cartao}'::metodo_pagamento[],
  max_parcelas        int not null default 3 check (max_parcelas between 1 and 12),
  prazo_inscricao     timestamptz,
  status              evento_status not null default 'rascunho',
  destinacao_valores  text,
  infos_importantes   text[] default '{}'::text[],
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.tipos_ingresso (
  id           uuid primary key default uuid_generate_v4(),
  evento_id    uuid not null references public.eventos(id) on delete cascade,
  nome         text not null,
  preco        numeric(10,2) not null check (preco >= 0),
  descricao    text,
  icone        text,
  cor          text,
  ordem        int not null default 0,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.inscricoes (
  id                  uuid primary key default uuid_generate_v4(),
  evento_id           uuid not null references public.eventos(id) on delete restrict,
  responsavel_nome    text not null,
  cpf                 text not null,
  email               text not null,
  telefone            text not null,
  itens               jsonb not null,
  valor_base          numeric(10,2) not null,
  valor_total         numeric(10,2) not null,
  metodo_pagamento    metodo_pagamento not null,
  parcelas            int not null default 1,
  status_pagamento    inscricao_status not null default 'pendente',
  asaas_payment_id    text,
  payment_url         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------- INDEXES ----------
create index if not exists eventos_status_idx        on public.eventos(status);
create index if not exists eventos_data_evento_idx   on public.eventos(data_evento);
create index if not exists tipos_ingresso_evento_idx on public.tipos_ingresso(evento_id);
create index if not exists inscricoes_evento_idx     on public.inscricoes(evento_id);
create index if not exists inscricoes_email_idx      on public.inscricoes(email);
create index if not exists inscricoes_status_idx     on public.inscricoes(status_pagamento);

-- ---------- TRIGGER updated_at ----------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists eventos_set_updated_at on public.eventos;
create trigger eventos_set_updated_at
  before update on public.eventos
  for each row execute function public.tg_set_updated_at();

drop trigger if exists inscricoes_set_updated_at on public.inscricoes;
create trigger inscricoes_set_updated_at
  before update on public.inscricoes
  for each row execute function public.tg_set_updated_at();

-- ---------- RLS ----------
alter table public.eventos        enable row level security;
alter table public.tipos_ingresso enable row level security;
alter table public.inscricoes     enable row level security;

-- EVENTOS: público lê apenas publicados; autenticado lê tudo
drop policy if exists eventos_select_public        on public.eventos;
create policy eventos_select_public on public.eventos
  for select using (status = 'publicado');

drop policy if exists eventos_all_authenticated    on public.eventos;
create policy eventos_all_authenticated on public.eventos
  for all  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- TIPOS_INGRESSO: público lê os de eventos publicados; autenticado faz tudo
drop policy if exists tipos_select_public          on public.tipos_ingresso;
create policy tipos_select_public on public.tipos_ingresso
  for select using (
    exists (
      select 1 from public.eventos e
      where e.id = evento_id and e.status = 'publicado'
    )
  );

drop policy if exists tipos_all_authenticated      on public.tipos_ingresso;
create policy tipos_all_authenticated on public.tipos_ingresso
  for all  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- INSCRICOES: público pode inserir; autenticado lê/edita/apaga
drop policy if exists inscricoes_insert_public     on public.inscricoes;
create policy inscricoes_insert_public on public.inscricoes
  for insert with check (true);

drop policy if exists inscricoes_all_authenticated on public.inscricoes;
create policy inscricoes_all_authenticated on public.inscricoes
  for all  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------- STORAGE BUCKET: 'eventos' ----------
-- Imagens de capa e galeria dos eventos.
insert into storage.buckets (id, name, public)
values ('eventos', 'eventos', true)
on conflict (id) do nothing;

drop policy if exists "eventos_public_read"   on storage.objects;
create policy "eventos_public_read" on storage.objects
  for select using (bucket_id = 'eventos');

drop policy if exists "eventos_admin_insert" on storage.objects;
create policy "eventos_admin_insert" on storage.objects
  for insert with check (bucket_id = 'eventos' and auth.role() = 'authenticated');

drop policy if exists "eventos_admin_update" on storage.objects;
create policy "eventos_admin_update" on storage.objects
  for update using (bucket_id = 'eventos' and auth.role() = 'authenticated');

drop policy if exists "eventos_admin_delete" on storage.objects;
create policy "eventos_admin_delete" on storage.objects
  for delete using (bucket_id = 'eventos' and auth.role() = 'authenticated');

-- =============================================================
-- FIM. Schema pronto.
-- =============================================================
