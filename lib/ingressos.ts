import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ingressos em PDF + capa 16:9 da confirmação (28/09/2026).
 * O link leva a inscrição e uma assinatura (HMAC com WEBHOOK_CONFIRM_SECRET):
 * só quem recebeu o link abre os ingressos daquela inscrição.
 */

const CONTATO_NEEL = "(84) 99133-5975";

function segredo() {
  const s = process.env.WEBHOOK_CONFIRM_SECRET;
  if (!s) throw new Error("WEBHOOK_CONFIRM_SECRET não configurado");
  return s;
}

export function assinar(inscricaoId: string) {
  return createHmac("sha256", segredo()).update(`ingressos:${inscricaoId}`).digest("hex").slice(0, 24);
}

export function assinaturaValida(inscricaoId: string, assinatura: string) {
  const a = Buffer.from(assinar(inscricaoId));
  const b = Buffer.from(assinatura ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function linksIngressos(origem: string, inscricaoId: string) {
  const q = `i=${inscricaoId}&s=${assinar(inscricaoId)}`;
  return {
    capa: `${origem}/api/ingressos/capa?${q}`,
    pdf: `${origem}/api/ingressos/pdf?${q}`,
  };
}

export interface Ingresso {
  token: string;
  nome: string; // "1º Lote — 2º Lote", "Almoço - Creme de Frango, arroz e batata palha."
  almoco: boolean;
  status: string;
}

export interface DadosIngressos {
  inscricaoId: string;
  pessoa: string;
  evento: { nome: string; data: string; hora: string | null; local: string | null; palestrantes: { nome: string; foto_url?: string }[] };
  ingressos: Ingresso[];
  entradas: number;
  almocos: number;
  contato: string;
}

export async function carregarIngressos(inscricaoId: string): Promise<DadosIngressos | null> {
  const db = createAdminClient();
  const { data: insc } = await db
    .from("inscricoes")
    .select("id, responsavel_nome, status_pagamento, evento:eventos(nome, data_evento, hora_evento, local, palestrantes, tipos_ingresso(id, opcional))")
    .eq("id", inscricaoId)
    .maybeSingle();
  if (!insc || insc.status_pagamento !== "pago") return null;
  const ev = insc.evento as unknown as {
    nome: string; data_evento: string; hora_evento: string | null; local: string | null;
    palestrantes: { nome: string; foto_url?: string }[] | null;
    tipos_ingresso: { id: string; opcional: boolean | null }[] | null;
  };
  const opcionais = new Set((ev.tipos_ingresso ?? []).filter((t) => t.opcional).map((t) => t.id));
  const { data: tk } = await db
    .from("tickets")
    .select("token, nome_tipo, tipo_ingresso_id, ordem, status, created_at")
    .eq("inscricao_id", inscricaoId)
    .neq("status", "cancelado")
    .order("created_at", { ascending: true })
    .order("ordem", { ascending: true });
  // Se o fluxo gerou os tickets mais de uma vez, vale o primeiro lote de cada ordem.
  const vistos = new Set<number>();
  const ingressos: Ingresso[] = [];
  for (const t of tk ?? []) {
    if (vistos.has(t.ordem as number)) continue;
    vistos.add(t.ordem as number);
    const almoco = (t.tipo_ingresso_id && opcionais.has(t.tipo_ingresso_id as string)) || /almo[cç]o/i.test(t.nome_tipo as string);
    ingressos.push({ token: t.token as string, nome: String(t.nome_tipo).trim(), almoco, status: t.status as string });
  }
  // Entradas primeiro, depois almoço.
  ingressos.sort((a, b) => Number(a.almoco) - Number(b.almoco));
  return {
    inscricaoId,
    pessoa: insc.responsavel_nome as string,
    evento: { nome: ev.nome, data: ev.data_evento, hora: ev.hora_evento, local: ev.local, palestrantes: ev.palestrantes ?? [] },
    ingressos,
    entradas: ingressos.filter((i) => !i.almoco).length,
    almocos: ingressos.filter((i) => i.almoco).length,
    contato: CONTATO_NEEL,
  };
}

export function dataPorExtenso(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const dia = d.toLocaleDateString("pt-BR", { weekday: "long" });
  const resto = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${resto}`;
}

export function horaCurta(h: string | null) {
  if (!h) return null;
  const [hh, mm] = h.split(":");
  return mm && mm !== "00" ? `${Number(hh)}h${mm}` : `${Number(hh)}h`;
}
