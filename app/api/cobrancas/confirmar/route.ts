import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  cobrancaId: z.string().uuid(),
  status: z.enum(["pago", "cancelado", "estornado"]),
  asaasPaymentId: z.string().optional(),
});

/**
 * Endpoint chamado pelo n8n quando o Asaas confirma/cancela o pagamento
 * de uma cobrança avulsa.
 *
 * Headers necessários:
 *   X-Webhook-Secret: <valor de WEBHOOK_CONFIRM_SECRET no .env>
 *
 * Body JSON:
 *   { "cobrancaId": "uuid", "status": "pago" | "cancelado" | "estornado", "asaasPaymentId": "..." }
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

  const { cobrancaId, status, asaasPaymentId } = parsed.data;
  const admin = createAdminClient();

  const updatePayload: {
    status_pagamento: typeof status;
    asaas_payment_id?: string;
  } = { status_pagamento: status };
  if (asaasPaymentId) updatePayload.asaas_payment_id = asaasPaymentId;

  const { data, error } = await admin
    .from("cobrancas_avulsas")
    .update(updatePayload)
    .eq("id", cobrancaId)
    .select("id, descricao, valor, status_pagamento")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    cobranca: data,
  });
}
