import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lembretesPendentes } from "@/lib/lembretes";
import { logInscricao } from "@/lib/log-inscricao";

/**
 * Lembrete de pagamento, chamado pelo n8n ("NEEL · Lembrete de pagamento").
 *   POST {}                                  → quem deve receber agora (e quem foi pulado e por quê)
 *   POST { registrar: { inscricaoId, status } } → grava o resultado (enviado | sem_whatsapp | erro)
 * Header: X-Webhook-Secret = WEBHOOK_CONFIRM_SECRET.
 */
export const dynamic = "force-dynamic";

const registro = z.object({ inscricaoId: z.string().uuid(), status: z.enum(["enviado", "sem_whatsapp", "erro"]), erro: z.string().optional() });

export async function POST(req: NextRequest) {
  const esperado = process.env.WEBHOOK_CONFIRM_SECRET;
  if (!esperado || req.headers.get("x-webhook-secret") !== esperado) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const corpo = (await req.json().catch(() => ({}))) as { registrar?: unknown };
  if (corpo.registrar) {
    const r = registro.safeParse(corpo.registrar);
    if (!r.success) return NextResponse.json({ error: "registrar inválido" }, { status: 400 });
    await logInscricao({
      inscricaoId: r.data.inscricaoId,
      // "lembrete_pagamento" encerra (enviado ou número sem WhatsApp); erro fica com outro nome e tenta de novo na próxima rodada.
      etapa: r.data.status === "erro" ? "lembrete_pagamento_erro" : "lembrete_pagamento",
      sucesso: r.data.status === "enviado",
      mensagem:
        r.data.status === "enviado" ? "Lembrete de pagamento enviado no WhatsApp"
        : r.data.status === "sem_whatsapp" ? "Lembrete não enviado: número sem WhatsApp"
        : `Lembrete não enviado: ${r.data.erro ?? "erro"}`,
      origem: "n8n",
    });
    return NextResponse.json({ ok: true });
  }
  try {
    return NextResponse.json({ ok: true, ...(await lembretesPendentes()) });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 });
  }
}
