-- =============================================================
-- Migration 0003 — Tracking de envios das inscrições
-- =============================================================
-- Adiciona 4 colunas em `inscricoes` pra acompanhar o que o n8n
-- conseguiu (ou falhou em) enviar pro pai depois de uma inscrição:
--
--   1. Confirmação (mensagem WhatsApp confirmando a inscrição)
--   2. QR Code (ticket com QR pro evento)
--
-- Quando ok:    confirmacao_enviada_em / qrcode_enviado_em recebem timestamp
-- Quando falha: confirmacao_erro / qrcode_erro recebem a mensagem de erro
--
-- Como rodar:
--   1. https://supabase.com/dashboard/project/lzqhjutknqeuhscfxald/sql/new
--   2. Cola este arquivo
--   3. Run
-- =============================================================

alter table public.inscricoes
  add column if not exists confirmacao_enviada_em timestamptz,
  add column if not exists confirmacao_erro       text,
  add column if not exists qrcode_enviado_em      timestamptz,
  add column if not exists qrcode_erro            text;

comment on column public.inscricoes.confirmacao_enviada_em is
  'Quando o n8n enviou com sucesso a confirmação WhatsApp ao pai. Null = ainda não enviado.';
comment on column public.inscricoes.confirmacao_erro is
  'Última mensagem de erro do envio da confirmação. Null = sem erro.';
comment on column public.inscricoes.qrcode_enviado_em is
  'Quando o n8n entregou o QR Code via WhatsApp. Null = ainda não enviado.';
comment on column public.inscricoes.qrcode_erro is
  'Última mensagem de erro do envio do QR Code. Null = sem erro.';
