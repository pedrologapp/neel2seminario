import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface LogEntry {
  inscricaoId: string;
  etapa: string;
  sucesso?: boolean;
  mensagem?: string | null;
  detalhe?: Record<string, unknown> | null;
  origem?: "site" | "n8n" | "asaas";
}

/**
 * Grava uma linha de log pra uma inscrição. Best-effort: nunca lança
 * (um erro de log não deve quebrar o fluxo principal).
 */
export async function logInscricao(entry: LogEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("inscricao_logs").insert({
      inscricao_id: entry.inscricaoId,
      etapa: entry.etapa,
      sucesso: entry.sucesso ?? true,
      mensagem: entry.mensagem ?? null,
      detalhe: entry.detalhe ?? null,
      origem: entry.origem ?? "n8n",
    });
  } catch (err) {
    // Log silencioso — não propaga
    console.error("Falha ao gravar inscricao_log:", err);
  }
}
