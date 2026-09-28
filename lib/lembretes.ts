import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lembrete de pagamento (29/09/2026): UMA mensagem para quem se inscreveu e
 * não pagou, 24h depois da inscrição (até 72h — inscrição mais velha que isso
 * não recebe). Antes de mandar, confere que a pessoa não comprou de outro
 * jeito:
 *  - nenhuma inscrição PAGA no mesmo evento com o mesmo telefone ou CPF;
 *  - a cobrança no Asaas não está paga (RECEIVED/CONFIRMED).
 * Cada envio fica em inscricao_logs (etapa "lembrete_pagamento"), e quem já
 * recebeu nunca recebe de novo.
 */

const JANELA_MIN_H = 24;
const JANELA_MAX_H = 72;
const SITE = "https://neel2seminario.vercel.app";
const PAGO = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

const so = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const tel = (v: unknown) => {
  let d = so(v);
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3); // compara sem o 9
  return d;
};

async function statusAsaas(id: string | null): Promise<string | null> {
  const chave = process.env.ASAAS_API_KEY_NEEL;
  if (!id || !chave) return null;
  try {
    const r = await fetch(`https://www.asaas.com/api/v3/payments/${id}`, { headers: { access_token: chave, "User-Agent": "neel-admin" }, cache: "no-store" });
    if (!r.ok) return null;
    return ((await r.json()) as { status?: string }).status ?? null;
  } catch {
    return null;
  }
}

export function textoLembrete(nome: string, evento: string, dataEvento: string, link: string) {
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  const bonito = primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
  const [, m, d] = dataEvento.split("-");
  return `Olá, *${bonito}*! 💛 Aqui é do NEEL.

Vimos que a sua inscrição no *${evento}* (${d}/${m}) ainda está aguardando o pagamento.

Para garantir a sua vaga, é só concluir por aqui:
${link}

Se você já pagou, pode desconsiderar esta mensagem. Qualquer dúvida, é só responder! 🙏`;
}

export interface Lembrete {
  inscricao_id: string;
  nome: string;
  telefone: string;
  texto: string;
}

export async function lembretesPendentes(agora = new Date()): Promise<{ itens: Lembrete[]; pulados: { id: string; motivo: string }[] }> {
  const db = createAdminClient();
  const ate = new Date(agora.getTime() - JANELA_MIN_H * 36e5).toISOString();
  const desde = new Date(agora.getTime() - JANELA_MAX_H * 36e5).toISOString();
  const { data: pend } = await db
    .from("inscricoes")
    .select("id, evento_id, responsavel_nome, telefone, cpf, payment_url, asaas_payment_id, created_at, evento:eventos(nome, slug, data_evento, status)")
    .eq("status_pagamento", "pendente")
    .gte("created_at", desde)
    .lte("created_at", ate);
  const itens: Lembrete[] = [];
  const pulados: { id: string; motivo: string }[] = [];
  if (!pend?.length) return { itens, pulados };

  const ids = pend.map((p) => p.id);
  const eventos = [...new Set(pend.map((p) => p.evento_id))];
  const [{ data: ja }, { data: pagas }] = await Promise.all([
    db.from("inscricao_logs").select("inscricao_id").in("inscricao_id", ids).eq("etapa", "lembrete_pagamento"),
    db.from("inscricoes").select("evento_id, telefone, cpf").in("evento_id", eventos).eq("status_pagamento", "pago"),
  ]);
  const lembrados = new Set((ja ?? []).map((l) => l.inscricao_id));
  const pagou = new Set((pagas ?? []).flatMap((p) => [`${p.evento_id}|t${tel(p.telefone)}`, `${p.evento_id}|c${so(p.cpf)}`]));
  const telefonesNaFila = new Set<string>();
  const hoje = agora.toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });

  for (const p of pend) {
    const ev = (Array.isArray(p.evento) ? p.evento[0] : p.evento) as { nome: string; slug: string; data_evento: string; status: string } | null;
    const t = tel(p.telefone);
    if (!ev || ev.status !== "publicado" || ev.data_evento < hoje) { pulados.push({ id: p.id, motivo: "evento encerrado" }); continue; }
    if (lembrados.has(p.id)) continue;
    if (!t) { pulados.push({ id: p.id, motivo: "sem telefone" }); continue; }
    if (pagou.has(`${p.evento_id}|t${t}`) || (so(p.cpf) && pagou.has(`${p.evento_id}|c${so(p.cpf)}`))) { pulados.push({ id: p.id, motivo: "já comprou em outra inscrição" }); continue; }
    if (telefonesNaFila.has(`${p.evento_id}|${t}`)) { pulados.push({ id: p.id, motivo: "mesma pessoa já na fila" }); continue; }
    const st = await statusAsaas(p.asaas_payment_id);
    if (st && PAGO.includes(st)) { pulados.push({ id: p.id, motivo: `pago no Asaas (${st}), pendente aqui` }); continue; }
    // Cobrança ainda aberta: manda o link dela. Vencida/cancelada: a página do evento.
    const link = st === "PENDING" && p.payment_url ? p.payment_url : `${SITE}/eventos/${ev.slug}`;
    telefonesNaFila.add(`${p.evento_id}|${t}`);
    itens.push({ inscricao_id: p.id, nome: p.responsavel_nome, telefone: so(p.telefone), texto: textoLembrete(p.responsavel_nome, ev.nome, ev.data_evento, link) });
  }
  return { itens, pulados };
}
