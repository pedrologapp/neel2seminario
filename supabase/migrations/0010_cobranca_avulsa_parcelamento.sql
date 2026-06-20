-- =============================================================
-- Migration 0010 — Parcelamento na cobrança avulsa
-- =============================================================
-- Forma de cobrança escolhida pelo admin no simulador:
--   'aberto' = link Asaas UNDEFINED (responsável escolhe PIX/cartão à vista)
--   'pix'    = só PIX
--   'cartao' = cartão parcelado (1 a 12x), com ou sem repasse de juros
-- valor       = valor base (sem taxas)
-- valor_total = o que será cobrado de fato (com juros, se repassados)
--
-- Idempotente: pode rodar várias vezes sem quebrar.
-- =============================================================

alter table public.cobrancas_avulsas
  add column if not exists metodo_cobranca text not null default 'aberto'
    check (metodo_cobranca in ('aberto', 'pix', 'cartao')),
  add column if not exists parcelas int not null default 1
    check (parcelas between 1 and 12),
  add column if not exists repassar_juros boolean not null default true,
  add column if not exists valor_total numeric(10,2);

-- Backfill: cobranças antigas eram sempre "link aberto" sem taxas
update public.cobrancas_avulsas
  set valor_total = valor
  where valor_total is null;
