-- =============================================================
-- Migration 0006 — asaas_customer_id em inscricoes
-- =============================================================
-- Guarda o ID do cliente no Asaas (cus_...) pra rastrear o mesmo
-- CPF entre eventos, facilitar reembolsos e consultas no Asaas.
--
-- Preenchido pelo site (submitInscricao) a partir da resposta do
-- Webhook 1 do n8n, que cria/busca o cliente no Asaas.
-- =============================================================

alter table public.inscricoes
  add column if not exists asaas_customer_id text;

comment on column public.inscricoes.asaas_customer_id is
  'ID do cliente no Asaas (cus_...). Vem do Webhook 1 do n8n.';
