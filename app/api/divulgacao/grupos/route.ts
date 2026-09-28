import { NextRequest, NextResponse } from "next/server";
import { lerEstado, salvarEstado } from "@/lib/divulgacao";

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
  const vindos = (body?.grupos ?? []).filter((g) => typeof g.id === "string" && g.id.endsWith("@g.us"));
  if (!vindos.length) return NextResponse.json({ ok: true, recebidos: 0 });

  try {
    const estado = await lerEstado();
    const agora = new Date().toISOString();
    const porId = new Map(estado.grupos.map((g) => [g.chat_id, g]));
    for (const v of vindos) {
      const atual = porId.get(v.id as string);
      porId.set(v.id as string, {
        chat_id: v.id as string,
        nome: (v.nome ?? "").slice(0, 200) || atual?.nome || null,
        divulgar: atual?.divulgar ?? false,
        visto_em: agora,
      });
    }
    estado.grupos = [...porId.values()];
    await salvarEstado(estado);
    return NextResponse.json({ ok: true, recebidos: vindos.length, total: estado.grupos.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
