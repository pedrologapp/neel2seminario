import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logInscricao } from "@/lib/log-inscricao";

const bodySchema = z.object({
  inscricaoId: z.string().uuid(),
  etapa: z.string().min(1),
  sucesso: z.boolean().optional().default(true),
  mensagem: z.string().optional().nullable(),
  detalhe: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * Endpoint genérico de log pro n8n registrar qualquer etapa do fluxo.
 *
 * Headers:
 *   X-Webhook-Secret: <WEBHOOK_CONFIRM_SECRET>
 *
 * Body:
 *   {
 *     "inscricaoId": "uuid",
 *     "etapa": "asaas_cobranca_criada",
 *     "sucesso": true,
 *     "mensagem": "Cobrança PIX criada no Asaas",
 *     "detalhe": { "asaasPaymentId": "pay_..." }
 *   }
 */
export async function POST(req: NextRequest) {
  const expected = process.env.WEBHOOK_CONFIRM_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "WEBHOOK_CONFIRM_SECRET não configurado" },
      { status: 500 },
    );
  }
  if (req.headers.get("x-webhook-secret") !== expected) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await logInscricao({
    inscricaoId: parsed.data.inscricaoId,
    etapa: parsed.data.etapa,
    sucesso: parsed.data.sucesso,
    mensagem: parsed.data.mensagem ?? null,
    detalhe: parsed.data.detalhe ?? null,
    origem: "n8n",
  });

  return NextResponse.json({ ok: true });
}
