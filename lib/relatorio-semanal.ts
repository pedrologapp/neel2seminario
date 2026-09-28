import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerEstado } from "@/lib/divulgacao";
import { canal } from "@/lib/analytics/origem";

/**
 * Relatório de sexta para a diretoria (29/09/2026): ingressos de ENTRADA
 * vendidos pelo site (sem almoço), quantos na semana e quantos vieram do
 * tráfego pago. Vai para os grupos "NEEL - DIRETORIA" e "Comunicação NEEL"
 * do WhatsApp do Pedro (n8n "NEEL · Relatório de sexta").
 */

export const GRUPOS_RELATORIO = [/diretoria/i, /comunica[cç][aã]o\s*neel/i];
const FUSO = "America/Fortaleza";
const dia = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });
// A origem só começou a ser registrada em 29/09/2026.
const INICIO_ORIGEM = "29/09";

type Item = { tipo_id?: string; qtd?: number; opcional?: boolean };

export async function montarRelatorio(agora = new Date()) {
  const db = createAdminClient();
  const hojeISO = agora.toLocaleDateString("en-CA", { timeZone: FUSO });
  // Evento: o próximo publicado (o seminário, enquanto não acontecer).
  const { data: eventos } = await db
    .from("eventos")
    .select("id, nome, data_evento")
    .eq("status", "publicado")
    .gte("data_evento", hojeISO)
    .order("data_evento", { ascending: true })
    .limit(1);
  const ev = eventos?.[0];
  if (!ev) return { ok: false as const, erro: "Nenhum evento publicado com data futura." };

  const [{ data: tipos }, { data: insc }] = await Promise.all([
    db.from("tipos_ingresso").select("id, opcional").eq("evento_id", ev.id),
    db.from("inscricoes").select("id, itens, created_at, registrado_por").eq("evento_id", ev.id).eq("status_pagamento", "pago"),
  ]);
  const opcionais = new Set((tipos ?? []).filter((t) => t.opcional).map((t) => t.id));
  const doSite = (insc ?? []).filter((i) => !i.registrado_por);
  const ids = doSite.map((i) => i.id);
  const { data: logs } = ids.length
    ? await db.from("inscricao_logs").select("inscricao_id, etapa, detalhe, created_at").in("inscricao_id", ids).in("etapa", ["pagamento_pago", "origem_trafego"])
    : { data: [] };
  const pagoEm = new Map<string, string>();
  const canalDe = new Map<string, string>();
  for (const l of logs ?? []) {
    if (l.etapa === "pagamento_pago") {
      const atual = pagoEm.get(l.inscricao_id);
      if (!atual || l.created_at < atual) pagoEm.set(l.inscricao_id, l.created_at);
    } else canalDe.set(l.inscricao_id, canal(l.detalhe as never));
  }

  const entradas = (i: { itens: unknown }) =>
    ((i.itens as Item[]) ?? []).filter((it) => !it.opcional && !(it.tipo_id && opcionais.has(it.tipo_id))).reduce((s, it) => s + (Number(it.qtd) || 0), 0);
  const semana = new Date(agora.getTime() - 7 * 864e5);
  let total = 0, daSemana = 0, trafego = 0, trafegoSemana = 0;
  for (const i of doSite) {
    const n = entradas(i);
    const quando = new Date(pagoEm.get(i.id) ?? i.created_at);
    const naSemana = quando >= semana;
    total += n;
    if (naSemana) daSemana += n;
    if (canalDe.get(i.id) === "anuncio") {
      trafego += n;
      if (naSemana) trafegoSemana += n;
    }
  }

  const dataEv = new Date(`${ev.data_evento}T12:00:00-03:00`);
  const faltam = Math.max(0, Math.round((dataEv.getTime() - new Date(`${hojeISO}T12:00:00-03:00`).getTime()) / 864e5));
  const texto = [
    `*Relatório semanal · ${ev.nome}*`,
    `_${agora.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "2-digit", month: "2-digit" })}_`,
    "",
    `🎟️ *Ingressos vendidos pelo site:* ${total}`,
    `📈 *Nesta semana* (${dia(semana)} a ${dia(agora)}): ${daSemana}`,
    `📣 *Vindos do tráfego pago:* ${trafego} no total, ${trafegoSemana} nesta semana _(contados desde ${INICIO_ORIGEM})_`,
    "",
    faltam > 0 ? `⏳ Faltam *${faltam} dias* para o seminário (${dia(dataEv)}).` : "🙏 O seminário é hoje!",
  ].join("\n");

  const estado = await lerEstado();
  const grupos = GRUPOS_RELATORIO.map((re) => estado.grupos.find((g) => re.test(g.nome ?? ""))).filter(Boolean).map((g) => ({ chat_id: g!.chat_id, nome: g!.nome }));
  return { ok: true as const, texto, grupos, numeros: { total, daSemana, trafego, trafegoSemana, faltam } };
}
