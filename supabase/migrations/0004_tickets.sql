-- =============================================================
-- Migration 0004 — Tabela tickets (cada senha = 1 linha)
-- =============================================================
-- Cada inscrição pode gerar N tickets (uma por senha comprada).
-- Cada ticket tem token único + QR code próprio + status de uso.
--
-- Vinculação:
--   tickets.inscricao_id  → inscricoes.id (cascade no delete)
--   tickets.evento_id     → eventos.id    (restrict, pra busca rápida)
--   tickets.tipo_ingresso_id → tipos_ingresso.id (set null se tipo for removido)
-- =============================================================

-- Se já existe uma tabela 'tickets' antiga (de sistemas anteriores)
-- sem a coluna 'inscricao_id', renomeia pra preservar os dados
-- antes de criar a nova com schema diferente.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='tickets'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tickets' and column_name='inscricao_id'
  ) then
    alter table public.tickets rename to tickets_legacy;
  end if;
end $$;

create table if not exists public.tickets (
  id                uuid primary key default uuid_generate_v4(),
  inscricao_id      uuid not null references public.inscricoes(id) on delete cascade,
  evento_id         uuid not null references public.eventos(id) on delete restrict,
  tipo_ingresso_id  uuid references public.tipos_ingresso(id) on delete set null,
  nome_tipo         text not null,             -- snapshot do nome do tipo ("Senha de Mãe")
  preco_unitario    numeric(10,2) not null,    -- snapshot do preço efetivo no momento
  ordem             int not null,              -- 1..N dentro da inscrição
  token             text not null unique,      -- código único (gerado pelo n8n)
  qr_url            text,                      -- URL do QR (pode ser null até gerar)
  status            text not null default 'ativo'
                    check (status in ('ativo', 'usado', 'cancelado')),
  usado_em          timestamptz,
  aluno_nome        text,                      -- snapshot do nome do aluno
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists tickets_inscricao_idx on public.tickets(inscricao_id);
create index if not exists tickets_evento_idx    on public.tickets(evento_id);
create index if not exists tickets_token_idx     on public.tickets(token);
create index if not exists tickets_status_idx    on public.tickets(status);

-- Trigger pra atualizar updated_at automaticamente
drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.tg_set_updated_at();

-- RLS: tickets podem ser lidos publicamente (precisa pra validação de QR no portão);
-- escrita só pelo n8n/admin
alter table public.tickets enable row level security;

drop policy if exists tickets_select_public on public.tickets;
create policy tickets_select_public on public.tickets
  for select using (true);

drop policy if exists tickets_all_authenticated on public.tickets;
create policy tickets_all_authenticated on public.tickets
  for all  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
