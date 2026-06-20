-- =============================================================
-- Migration 0007 — Venda em dinheiro (presencial)
-- =============================================================
-- 1. Adiciona 'dinheiro' como método de pagamento
-- 2. Adiciona registrado_por (email do admin que deu baixa)
--
-- ⚠️ IMPORTANTE: 'alter type ... add value' NÃO pode rodar dentro
-- de um bloco de transação com outros comandos em algumas versões.
-- Por isso este arquivo separa em 2 statements. No SQL Editor do
-- Supabase, rode TUDO de uma vez — ele executa em sequência.
-- =============================================================

-- 1. Novo valor no enum
alter type metodo_pagamento add value if not exists 'dinheiro';

-- 2. Coluna de auditoria
alter table public.inscricoes
  add column if not exists registrado_por text;

comment on column public.inscricoes.registrado_por is
  'Email do admin que registrou a venda (preenchido em vendas em dinheiro).';
