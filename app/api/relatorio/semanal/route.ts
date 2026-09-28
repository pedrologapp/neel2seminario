import { NextRequest, NextResponse } from "next/server";
import { montarRelatorio } from "@/lib/relatorio-semanal";

/**
 * O n8n ("NEEL · Relatório de sexta") pega aqui o texto do relatório e os
 * grupos para onde ele vai. Header: X-Webhook-Secret = WEBHOOK_CONFIRM_SECRET.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const esperado = process.env.WEBHOOK_CONFIRM_SECRET;
  if (!esperado || req.headers.get("x-webhook-secret") !== esperado) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    return NextResponse.json(await montarRelatorio());
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 });
  }
}
