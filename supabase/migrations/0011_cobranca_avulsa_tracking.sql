-- =============================================================
-- Migration 0011 — Tracking de envios da cobrança avulsa
-- =============================================================
-- Mesmo padrão da migration 0003 (inscricoes), agora para
-- cobrancas_avulsas:
--
--   1. Link de pagamento (mensagem WhatsApp com o link Asaas)
--   2. Confirmação (mensagem WhatsApp após o pagamento cair)
--
-- Quando ok:    link_enviado_em / confirmacao_enviada_em recebem timestamp
-- Quando falha: link_erro / confirmacao_erro recebem a mensagem de erro
--
-- Idempotente: pode rodar várias vezes sem quebrar.
-- =============================================================

alter table public.cobrancas_avulsas
  add column if not exists link_enviado_em        timestamptz,
  add column if not exists link_erro              text,
  add column if not exists confirmacao_enviada_em timestamptz,
  add column if not exists confirmacao_erro       text;

comment on column public.cobrancas_avulsas.link_enviado_em is
  'Quando o n8n enviou com sucesso o link de pagamento no WhatsApp. Null = ainda não enviado.';
comment on column public.cobrancas_avulsas.link_erro is
  'Última mensagem de erro do envio do link. Null = sem erro.';
comment on column public.cobrancas_avulsas.confirmacao_enviada_em is
  'Quando o n8n enviou com sucesso a confirmação de pagamento no WhatsApp. Null = ainda não enviado.';
comment on column public.cobrancas_avulsas.confirmacao_erro is
  'Última mensagem de erro do envio da confirmação. Null = sem erro.';
