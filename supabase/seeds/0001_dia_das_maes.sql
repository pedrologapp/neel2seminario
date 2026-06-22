-- =============================================================
-- SEED: Dia das Mães 2026
-- Recria o evento "Dia das Mães 2026" e seus tipos de ingresso.
--
-- Como rodar:
--   1. Abra https://supabase.com/dashboard/project/lzqhjutknqeuhscfxald/sql/new
--   2. Cole TODO este arquivo
--   3. Clique em "Run"
--   4. Acesse http://localhost:3000/eventos/dia-das-maes-2026
--
-- Idempotente: pode rodar várias vezes — sempre vai deixar o mesmo estado.
-- =============================================================

insert into public.eventos (
  slug, nome, descricao_curta, descricao_longa,
  data_evento, hora_evento, local,
  cor_tematica, status,
  metodos_pagamento, max_parcelas,
  prazo_inscricao, destinacao_valores, infos_importantes
) values (
  'dia-das-maes-2026',
  'Dia das Mães 2026',
  'Uma tarde linda e cheia de carinho para celebrar nossas mães',
  E'A NEEL preparou uma tarde linda e cheia de carinho para celebrar vocês, que são tão especiais em nossas vidas!\n\nEsperamos todas vocês para comemorarmos juntos o Dia das Mães, em um momento repleto de amor, alegria e muita emoção ao lado de seus filhos.\n\nO que preparamos com muito carinho:\n• 7 lembrancinhas especiais para as mamães\n• Sorvetada deliciosa para refrescar a tarde\n• Algodão doce, pipoca e churros — para mães e filhos\n• Cantina aberta durante todo o evento\n• Uma tarde inesquecível, harmoniosa e cheia de amor!',
  '2026-05-16',
  '15:00',
  'Novo Auditório da NEEL',
  '#EC4899',
  'publicado',
  '{pix,cartao}'::metodo_pagamento[],
  3,
  '2026-05-11T23:59:00-03:00',
  'Os valores arrecadados serão destinados às despesas da comemoração e dos itens preparados: lembrancinhas, sorvetada, algodão doce, pipoca, churros e ornamentação do espaço.',
  array[
    'A comemoração acontecerá em 16/05/2026 (sábado), às 15h, no Novo Auditório da NEEL.',
    'Filhos(as) dos alunos da escola são isentos — não será cobrada nenhuma taxa para participarem ao lado da mãe.',
    'A cantina estará aberta durante todo o evento.',
    'Parcelamento em até 3x no cartão (com juros do Asaas).',
    'Após o pagamento não será permitido reembolso.',
    'O prazo final para pagamento é 11/05/2026. Após essa data não receberemos pagamentos, pois as lembrancinhas estão sendo produzidas antecipadamente.'
  ]
)
on conflict (slug) do update set
  nome               = excluded.nome,
  descricao_curta    = excluded.descricao_curta,
  descricao_longa    = excluded.descricao_longa,
  data_evento        = excluded.data_evento,
  hora_evento        = excluded.hora_evento,
  local              = excluded.local,
  cor_tematica       = excluded.cor_tematica,
  status             = excluded.status,
  metodos_pagamento  = excluded.metodos_pagamento,
  max_parcelas       = excluded.max_parcelas,
  prazo_inscricao    = excluded.prazo_inscricao,
  destinacao_valores = excluded.destinacao_valores,
  infos_importantes  = excluded.infos_importantes,
  updated_at         = now();

-- Tipos de ingresso (recria do zero pra refletir alterações futuras no seed)
delete from public.tipos_ingresso
where evento_id = (select id from public.eventos where slug = 'dia-das-maes-2026');

insert into public.tipos_ingresso (evento_id, nome, preco, descricao, ordem) values
  ((select id from public.eventos where slug = 'dia-das-maes-2026'), 'Senha de Mãe',  80.00, 'Por mãe',                0),
  ((select id from public.eventos where slug = 'dia-das-maes-2026'), 'Senha Extra',   40.00, 'Por parente convidado',  1);

-- =============================================================
-- Pronto. Veja em /eventos/dia-das-maes-2026
-- =============================================================
