-- =============================================================
-- Migration 0009 — Cobranças avulsas
-- =============================================================
-- Cobrança de qualquer coisa fora de eventos (contribuição, material etc.):
-- o admin informa o nome da pessoa, descreve o item e o valor; o sistema
-- gera o link de pagamento no Asaas e o n8n envia pelo WhatsApp.
-- Quando o Asaas confirma, só chega a mensagem de confirmação
-- (sem QR codes — não há tickets envolvidos).
--
-- Idempotente: pode rodar várias vezes sem quebrar.
-- =============================================================

create table if not exists public.cobrancas_avulsas (
  id                  uuid primary key default uuid_generate_v4(),
  descricao           text not null,
  valor               numeric(10,2) not null check (valor > 0),
  responsavel_nome    text not null,
  cpf                 text not null,
  telefone            text not null,
  status_pagamento    inscricao_status not null default 'pendente',
  payment_url         text,
  asaas_payment_id    text,
  asaas_customer_id   text,
  registrado_por      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.cobrancas_avulsas is
  'Cobranças fora de eventos (livro, material, etc.) com link de pagamento Asaas enviado por WhatsApp.';

create index if not exists cobrancas_avulsas_status_idx
  on public.cobrancas_avulsas(status_pagamento);

drop trigger if exists cobrancas_avulsas_set_updated_at on public.cobrancas_avulsas;
create trigger cobrancas_avulsas_set_updated_at
  before update on public.cobrancas_avulsas
  for each row execute function public.tg_set_updated_at();

-- RLS: só autenticado (admin) acessa; inserts/updates do servidor
-- usam a service role, que ignora RLS.
alter table public.cobrancas_avulsas enable row level security;

drop policy if exists cobrancas_avulsas_all_authenticated on public.cobrancas_avulsas;
create policy cobrancas_avulsas_all_authenticated on public.cobrancas_avulsas
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
