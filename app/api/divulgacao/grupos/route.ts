import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O n8n manda aqui a lista de grupos do WhatsApp do Pedro (só leitura lá).
 * Atualiza nome e "visto_em"; NUNCA mexe no "divulgar" (quem decide é o admin).
 * Header: X-Webhook-Secret = WEBHOOK_CONFIRM_SECRET.
 */
export async function POST(req: NextRequest) {
  const esperado = process.env.WEBHOOK_CONFIRM_SECRET;
  if (!esperado || req.headers.get("x-webhook-secret") !== esperado) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { grupos?: { id?: string; nome?: string }[] } | null;
  const grupos = (body?.grupos ?? []).filter((g) => typeof g.id === "string" && g.id.endsWith("@g.us"));
  if (!grupos.length) return NextResponse.json({ ok: true, recebidos: 0 });

  const db = createAdminClient();
  const agora = new Date().toISOString();
  const { error } = await db.from("divulgacao_grupos").upsert(
    grupos.map((g) => ({ chat_id: g.id as string, nome: (g.nome ?? "").slice(0, 200) || null, visto_em: agora, atualizado_em: agora })),
    { onConflict: "chat_id", ignoreDuplicates: false },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, recebidos: grupos.length });
}
