import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logInscricao } from "@/lib/log-inscricao";

const bodySchema = z.object({
  inscricaoId: z.string().uuid(),
  etapa: z.enum(["confirmacao", "qrcode"]),
  sucesso: z.boolean(),
  erro: z.string().optional().nullable(),
});

/**
 * Endpoint chamado pelo n8n quando uma etapa de envio é concluída
 * (com sucesso ou falha).
 *
 * Headers necessários:
 *   X-Webhook-Secret: <valor de WEBHOOK_CONFIRM_SECRET no .env>
 *
 * Body JSON:
 *   {
 *     "inscricaoId": "uuid",
 *     "etapa": "confirmacao" | "qrcode",
 *     "sucesso": true | false,
 *     "erro": "..."  // opcional, só faz sentido quando sucesso=false
 *   }
 *
 * Comportamento:
 *   - sucesso=true → marca timestamp em [etapa]_enviada_em e zera o erro
 *   - sucesso=false → grava o erro em [etapa]_erro
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

  const { inscricaoId, etapa, sucesso, erro } = parsed.data;
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
      update.qrcode_enviado_em = now;
      update.qrcode_erro = null;
    } else {
      update.qrcode_erro = erro ?? "Erro desconhecido";
    }
  }

  const { data, error } = await admin
    .from("inscricoes")
    .update(update)
    .eq("id", inscricaoId)
    .select("id, evento_id, confirmacao_enviada_em, confirmacao_erro, qrcode_enviado_em, qrcode_erro")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logInscricao({
    inscricaoId,
    etapa: `${etapa}_${sucesso ? "enviado" : "falhou"}`,
    sucesso,
    mensagem: sucesso
      ? `${etapa === "confirmacao" ? "Confirmação WhatsApp" : "QR Code"} enviado com sucesso`
      : `Falha ao enviar ${etapa === "confirmacao" ? "confirmação" : "QR Code"}`,
    detalhe: erro ? { erro } : null,
    origem: "n8n",
  });

  return NextResponse.json({ ok: true, inscricao: data });
}
