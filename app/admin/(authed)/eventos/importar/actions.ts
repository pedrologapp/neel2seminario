"use server";

import {
  extractEventoFromPDF,
  extractEventoFromText,
  type ExtractedEvento,
} from "@/lib/extract-evento";
import { createClient } from "@/lib/supabase/server";

export type ImportarState =
  | { ok: true; dados: ExtractedEvento }
  | { ok: false; error: string }
  | null;

export async function importarEvento(
  _prev: ImportarState,
  formData: FormData,
): Promise<ImportarState> {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sua sessão expirou. Faça login novamente." };
  }

  const tipo = formData.get("tipo")?.toString();

  try {
    let dados: ExtractedEvento;

    if (tipo === "texto") {
      const texto = formData.get("texto")?.toString() ?? "";
      if (texto.trim().length < 50) {
        return {
          ok: false,
          error: "Cole um texto com pelo menos 50 caracteres.",
        };
      }
      dados = await extractEventoFromText(texto);
    } else if (tipo === "pdf") {
      const file = formData.get("pdf") as File | null;
      if (!file || file.size === 0) {
        return { ok: false, error: "Selecione um arquivo PDF." };
      }
      if (file.type !== "application/pdf") {
        return { ok: false, error: "O arquivo precisa ser PDF." };
      }
      if (file.size > 10 * 1024 * 1024) {
        return { ok: false, error: "PDF muito grande (limite 10MB)." };
      }
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      dados = await extractEventoFromPDF(base64);
    } else {
      return { ok: false, error: "Tipo de entrada inválido." };
    }

    return { ok: true, dados };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Falha desconhecida na extração.";
    return { ok: false, error: message };
  }
}
