/**
 * Seed do evento "Dia das Mães 2026".
 *
 * Como rodar (a partir da raiz do projeto):
 *   node --env-file=.env.local scripts/seed-dia-das-maes.mjs
 *
 * Idempotente: pode rodar várias vezes.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "❌ Variáveis NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY faltando.",
  );
  console.error("   Rode com: node --env-file=.env.local scripts/seed-dia-das-maes.mjs");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SLUG = "dia-das-maes-2026";

const descricaoLonga = `A NEEL preparou uma tarde linda e cheia de carinho para celebrar vocês, que são tão especiais em nossas vidas!

Esperamos todas vocês para comemorarmos juntos o Dia das Mães, em um momento repleto de amor, alegria e muita emoção ao lado de seus filhos.

O que preparamos com muito carinho:
• 7 lembrancinhas especiais para as mamães
• Sorvetada deliciosa para refrescar a tarde
• Algodão doce, pipoca e churros — para mães e filhos
• Cantina aberta durante todo o evento
• Uma tarde inesquecível, harmoniosa e cheia de amor!`;

const eventoData = {
  slug: SLUG,
  nome: "Dia das Mães 2026",
  descricao_curta:
    "Uma tarde linda e cheia de carinho para celebrar nossas mães",
  descricao_longa: descricaoLonga,
  data_evento: "2026-05-16",
  hora_evento: "15:00",
  local: "Novo Auditório da NEEL",
  cor_tematica: "#EC4899",
  status: "publicado",
  metodos_pagamento: ["pix", "cartao"],
  max_parcelas: 3,
  prazo_inscricao: "2026-05-11T23:59:00-03:00",
  destinacao_valores:
    "Os valores arrecadados serão destinados às despesas da comemoração e dos itens preparados: lembrancinhas, sorvetada, algodão doce, pipoca, churros e ornamentação do espaço.",
  infos_importantes: [
    "A comemoração acontecerá em 16/05/2026 (sábado), às 15h, no Novo Auditório da NEEL.",
    "Filhos(as) dos alunos da escola são isentos — não será cobrada nenhuma taxa para participarem ao lado da mãe.",
    "A cantina estará aberta durante todo o evento.",
    "Parcelamento em até 3x no cartão (com juros do Asaas).",
    "Após o pagamento não será permitido reembolso.",
    "O prazo final para pagamento é 11/05/2026. Após essa data não receberemos pagamentos, pois as lembrancinhas estão sendo produzidas antecipadamente.",
  ],
};

const tipos = [
  {
    nome: "Senha de Mãe",
    preco: 80.0,
    descricao: "Por mãe",
    ordem: 0,
    ativo: true,
  },
  {
    nome: "Senha Extra",
    preco: 40.0,
    descricao: "Por parente convidado",
    ordem: 1,
    ativo: true,
  },
];

console.log("📝 Inserindo/atualizando evento...");

const { data: evento, error: eventoErr } = await supabase
  .from("eventos")
  .upsert(eventoData, { onConflict: "slug" })
  .select("id, slug, nome")
  .single();

if (eventoErr) {
  console.error("❌ Erro ao salvar evento:", eventoErr.message);
  process.exit(1);
}

console.log(`✅ Evento "${evento.nome}" salvo (id: ${evento.id})`);

console.log("🧹 Limpando tipos de ingresso antigos...");
const { error: delErr } = await supabase
  .from("tipos_ingresso")
  .delete()
  .eq("evento_id", evento.id);
if (delErr) {
  console.error("❌ Erro ao limpar tipos:", delErr.message);
  process.exit(1);
}

console.log("🎫 Inserindo tipos de ingresso...");
const tiposComEvento = tipos.map((t) => ({ ...t, evento_id: evento.id }));
const { error: tiposErr } = await supabase
  .from("tipos_ingresso")
  .insert(tiposComEvento);
if (tiposErr) {
  console.error("❌ Erro ao salvar tipos:", tiposErr.message);
  process.exit(1);
}

console.log("✅ Tipos de ingresso salvos.");
console.log("");
console.log("🎉 Pronto! Acesse:");
console.log("   - Home:           http://localhost:3000");
console.log(`   - Página evento: http://localhost:3000/eventos/${evento.slug}`);
console.log("   - Admin:          http://localhost:3000/admin/eventos");
