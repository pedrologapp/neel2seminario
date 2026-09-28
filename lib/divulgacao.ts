import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Divulgação nos grupos de WhatsApp do Pedro (28/09/2026).
 * Grupos chegam do WhatsApp pelo n8n (/api/divulgacao/grupos); no admin ele
 * marca quais recebem e cuida do material. Só envia com a divulgação LIGADA.
 */

export interface GrupoDivulgacao {
  chat_id: string;
  nome: string | null;
  divulgar: boolean;
  visto_em: string | null;
}

export interface ConfigDivulgacao {
  ativo: boolean;
  ritmo: "diario" | "alternado";
  inicio: string | null;
  fim: string | null;
  horarios: string[];
  intervalo_min: number;
  flyer_url: string | null;
  video_url: string | null;
  textos: string[];
  link: string | null;
}

export interface EnvioDivulgacao {
  id: number;
  dia: string;
  horario: string | null;
  nome: string | null;
  tipo: string | null;
  status: string;
  erro: string | null;
  criado_em: string;
}

/** Grupos que parecem espíritas / do NEEL: aparecem com o selo "sugerido". */
export function sugerido(nome: string | null) {
  return /neel|crenorte|fern\b|esp[ií]rit|kardec|evangelho|seminário esp/i.test(nome ?? "");
}

export async function carregarDivulgacao() {
  const db = createAdminClient();
  const [cfg, grupos, envios] = await Promise.all([
    db.from("divulgacao_config").select("*").eq("id", 1).maybeSingle(),
    db.from("divulgacao_grupos").select("chat_id, nome, divulgar, visto_em").order("nome"),
    db.from("divulgacao_envios").select("id, dia, horario, nome, tipo, status, erro, criado_em").order("criado_em", { ascending: false }).limit(60),
  ]);
  const faltaTabela = [cfg.error, grupos.error].some((e) => e && /does not exist|relation|schema cache/i.test(e.message));
  return {
    faltaTabela,
    erro: cfg.error?.message ?? grupos.error?.message ?? null,
    config: (cfg.data as ConfigDivulgacao | null) ?? null,
    grupos: (grupos.data as GrupoDivulgacao[] | null) ?? [],
    envios: (envios.data as EnvioDivulgacao[] | null) ?? [],
  };
}
