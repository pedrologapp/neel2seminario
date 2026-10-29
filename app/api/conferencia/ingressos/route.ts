import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enviarIngressos, pagosSemIngresso } from "@/lib/conferencia-ingressos";

export const maxDuration = 300;

/**
 * Pagos no Asaas sem ingresso (lib/conferencia-ingressos).
 *   GET  → a lista (só leitura)
 *   POST { inscricaoIds: [...] } → manda confirmação + ingressos para essas (só com autorização do Pedro)
 * Header: X-Webhook-Secret = WEBHOOK_CONFIRM_SECRET
 */
function autorizado(req: NextRequest) {
  const esperado = process.env.WEBHOOK_CONFIRM_SECRET;
  return !!esperado && req.headers.get("x-webhook-secret") === esperado;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await pagosSemIngresso({ fresco: true }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

const corpo = z.object({ inscricaoIds: z.array(z.string().uuid()).min(1).max(60) });

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const p = corpo.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Envie { inscricaoIds: [...] }" }, { status: 400 });
  return NextResponse.json({ resultados: await enviarIngressos(p.data.inscricaoIds, "Claude (autorizado pelo Pedro)") });
}
