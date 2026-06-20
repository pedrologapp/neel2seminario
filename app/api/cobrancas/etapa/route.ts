import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  cobrancaId: z.string().uuid(),
  etapa: z.enum(["confirmacao", "link"]),
  sucesso: z.boolean(),
  erro: z.string().optional().nullable(),
});

/**
 * Endpoint chamado pelo n8n quando uma etapa de envio da cobrança
 * avulsa é concluída (com sucesso ou falha). Espelho de
 * /api/inscricoes/etapa, mas para cobrancas_avulsas.
 *
 * Headers necessários:
 *   X-Webhook-Secret: <valor de WEBHOOK_CONFIRM_SECRET no .env>
 *
 * Body JSON:
 *   {
 *     "cobrancaId": "uuid",
 *     "etapa": "confirmacao" | "link",
 *     "sucesso": true | false,
 *     "erro": "..."  // opcional, só faz sentido quando sucesso=false
 *   }
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
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { cobrancaId, etapa, sucesso, erro } = parsed.data;
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {};
  if (etapa === "confirmacao") {
    if (sucesso) {
      update.confirmacao_enviada_em = now;
      update.confirmacao_erro = null;
    } else {
      update.confirmacao_erro = erro ?? "Erro desconhecido";
    }
  } else {
    if (sucesso) {
      update.link_enviado_em = now;
      update.link_erro = null;
    } else {
      update.link_erro = erro ?? "Erro desconhecido";
    }
  }

  const { data, error } = await admin
    .from("cobrancas_avulsas")
    .update(update)
    .eq("id", cobrancaId)
    .select(
      "id, link_enviado_em, link_erro, confirmacao_enviada_em, confirmacao_erro",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cobranca: data });
}
