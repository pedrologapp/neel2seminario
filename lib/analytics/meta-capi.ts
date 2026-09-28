import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logInscricao } from "@/lib/log-inscricao";
import { META_PIXEL_ID } from "@/lib/analytics/meta-pixel";

/**
 * API de Conversões do Meta (29/09/2026): avisa o Meta quando um pagamento é
 * confirmado ("Purchase"). O pagamento acontece no Asaas, fora do site, então
 * o pixel do navegador nunca vê a compra; quem avisa é o servidor, na mesma
 * hora em que o n8n confirma o pagamento (/api/inscricoes/confirmar).
 *
 * Precisa do token em META_CAPI_TOKEN (Gerenciador de Eventos → conjunto de
 * dados do NEEL → Configurações → API de Conversões → Gerar token). Sem o
 * token, não faz nada. META_CAPI_TEST_CODE (opcional) manda para a aba
 * "Testar eventos" em vez de contar de verdade.
 */

const sha = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || META_PIXEL_ID || "2353902015011610";

export async function enviarCompraMeta(inscricaoId: string) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return;
  const db = createAdminClient();
  try {
    const [{ data: i }, { data: logs }] = await Promise.all([
      db.from("inscricoes").select("id, responsavel_nome, email, telefone, valor_total, status_pagamento, created_at, evento:eventos(nome, slug)").eq("id", inscricaoId).single(),
      db.from("inscricao_logs").select("etapa, detalhe").eq("inscricao_id", inscricaoId).in("etapa", ["origem_trafego", "meta_compra"]),
    ]);
    if (!i || i.status_pagamento !== "pago") return;
    if ((logs ?? []).some((l) => l.etapa === "meta_compra")) return; // já avisado
    const o = ((logs ?? []).find((l) => l.etapa === "origem_trafego")?.detalhe ?? {}) as Record<string, string | null>;

    const tel = String(i.telefone ?? "").replace(/\D/g, "");
    const partes = String(i.responsavel_nome ?? "").trim().split(/\s+/);
    const evento = (Array.isArray(i.evento) ? i.evento[0] : i.evento) as { nome?: string; slug?: string } | null;
    const user_data: Record<string, unknown> = {
      em: i.email ? [sha(String(i.email))] : undefined,
      ph: tel ? [sha(tel.length <= 11 ? `55${tel}` : tel)] : undefined,
      fn: partes[0] ? [sha(partes[0])] : undefined,
      ln: partes.length > 1 ? [sha(partes[partes.length - 1])] : undefined,
      country: [sha("br")],
      external_id: [sha(i.id)],
      fbp: o.fbp || undefined,
      fbc: o.fbc || (o.fbclid ? `fb.1.${new Date(i.created_at).getTime()}.${o.fbclid}` : undefined),
      client_ip_address: o.ip || undefined,
      client_user_agent: o.ua || undefined,
    };
    const corpo = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: `compra-${i.id}`,
          action_source: "website",
          event_source_url: `https://neel2seminario.vercel.app/eventos/${evento?.slug ?? ""}`,
          user_data,
          custom_data: { currency: "BRL", value: Number(i.valor_total ?? 0), content_name: evento?.nome ?? "Evento NEEL", order_id: i.id },
        },
      ],
      ...(process.env.META_CAPI_TEST_CODE ? { test_event_code: process.env.META_CAPI_TEST_CODE } : {}),
    };
    const r = await fetch(`https://graph.facebook.com/v21.0/${PIXEL}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const j = (await r.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string } };
    await logInscricao({
      inscricaoId,
      etapa: "meta_compra",
      sucesso: r.ok,
      mensagem: r.ok ? "Compra avisada ao Meta (API de Conversões)" : `Meta recusou: ${j.error?.message ?? r.status}`,
      detalhe: { status: r.status, recebidos: j.events_received ?? null, teste: !!process.env.META_CAPI_TEST_CODE },
      origem: "site",
    });
  } catch (e) {
    console.error("Falha ao avisar o Meta:", e);
  }
}
