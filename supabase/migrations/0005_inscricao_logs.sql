-- =============================================================
-- Migration 0005 — Log de etapas das inscrições
-- =============================================================
-- Registra cada passo do ciclo de vida de uma inscrição:
-- criação, cobrança Asaas, confirmação de pagamento, envio de
-- QR Code, envio de confirmação WhatsApp, erros, etc.
--
-- Alimentado automaticamente pelos endpoints /api/inscricoes/*
-- e por chamadas explícitas do n8n em /api/inscricoes/log.
-- =============================================================

create table if not exists public.inscricao_logs (
  id            uuid primary key default uuid_generate_v4(),
  inscricao_id  uuid not null references public.inscricoes(id) on delete cascade,
  etapa         text not null,             -- ex: 'pagamento_confirmado', 'qrcode_enviado'
  sucesso       boolean not null default true,
  mensagem      text,                      -- descrição legível
  detalhe       jsonb,                     -- payload extra (ids, erros, etc)
  origem        text not null default 'n8n', -- 'site' | 'n8n' | 'asaas'
  created_at    timestamptz not null default now()
);

create index if not exists inscricao_logs_inscricao_idx
  on public.inscricao_logs(inscricao_id);
create index if not exists inscricao_logs_created_idx
  on public.inscricao_logs(created_at);

-- RLS: só autenticado lê/escreve (service role bypassa de qualquer forma)
alter table public.inscricao_logs enable row level security;

drop policy if exists inscricao_logs_all_authenticated on public.inscricao_logs;
create policy inscricao_logs_all_authenticated on public.inscricao_logs
  for all  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
