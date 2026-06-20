import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logInscricao } from "@/lib/log-inscricao";

const bodySchema = z.object({
  inscricaoId: z.string().uuid(),
  status: z.enum(["pago", "cancelado", "estornado"]),
  asaasPaymentId: z.string().optional(),
});

/**
 * Endpoint chamado pelo n8n quando o Asaas confirma/cancela um pagamento.
 *
 * Headers necessários:
 *   X-Webhook-Secret: <valor de WEBHOOK_CONFIRM_SECRET no .env>
 *
 * Body JSON:
 *   { "inscricaoId": "uuid", "status": "pago" | "cancelado" | "estornado", "asaasPaymentId": "..." }
 */
export async function POST(req: NextRequest) {
  const expected = process.env.WEBHOOK_CONFIRM_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "WEBHOOK_CONFIRM_SECRET não configurado no servidor" },
      { status: 500 },
    );
  }

  const provided = req.headers.get("x-webhook-secret");
  if (provided !== expected) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload inválido",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { inscricaoId, status, asaasPaymentId } = parsed.data;
  const admin = createAdminClient();

  const updatePayload: {
    status_pagamento: typeof status;
    asaas_payment_id?: string;
  } = { status_pagamento: status };
  if (asaasPaymentId) updatePayload.asaas_payment_id = asaasPaymentId;

  const { data, error } = await admin
    .from("inscricoes")
    .update(updatePayload)
    .eq("id", inscricaoId)
    .select("id, evento_id, status_pagamento")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logInscricao({
    inscricaoId,
    etapa: `pagamento_${status}`,
    sucesso: status === "pago",
    mensagem:
      status === "pago"
        ? "Pagamento confirmado pelo Asaas"
        : `Pagamento marcado como ${status}`,
    detalhe: asaasPaymentId ? { asaasPaymentId } : null,
    origem: "n8n",
  });

  return NextResponse.json({
    ok: true,
    inscricao: data,
  });
}
