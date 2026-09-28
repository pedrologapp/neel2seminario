-- Divulgação automática nos grupos de WhatsApp (28/09/2026).
-- A lista de grupos vem do WhatsApp do Pedro (sessão WAHA "neel") via n8n;
-- no admin (aba Divulgação) ele marca quais grupos recebem, sobe o flyer e o
-- vídeo e define horários. O envio só roda com a divulgação LIGADA.

create table if not exists public.divulgacao_grupos (
  chat_id       text primary key,          -- 1203...@g.us
  nome          text,
  divulgar      boolean not null default false,
  visto_em      timestamptz,               -- última vez que apareceu no WhatsApp
  atualizado_em timestamptz not null default now()
);

create table if not exists public.divulgacao_config (
  id            int primary key default 1 check (id = 1),
  ativo         boolean not null default false,
  ritmo         text not null default 'diario' check (ritmo in ('diario', 'alternado')),
  inicio        date,
  fim           date,
  horarios      text[] not null default '{07:00,20:00,12:30,18:00,09:00,19:30}',
  intervalo_min int not null default 3,     -- minutos entre um grupo e outro
  flyer_url     text,
  video_url     text,
  textos        text[] not null default '{}',
  link          text,
  atualizado_em timestamptz not null default now()
);
insert into public.divulgacao_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.divulgacao_envios (
  id        bigint generated always as identity primary key,
  dia       date not null,
  horario   text,
  chat_id   text,
  nome      text,
  tipo      text,          -- flyer | video
  status    text not null, -- enviado | erro
  erro      text,
  criado_em timestamptz not null default now()
);
create index if not exists divulgacao_envios_dia on public.divulgacao_envios (dia desc);

alter table public.divulgacao_grupos enable row level security;
alter table public.divulgacao_config enable row level security;
alter table public.divulgacao_envios enable row level security;
-- Sem políticas: só o servidor (service role) lê e escreve.
