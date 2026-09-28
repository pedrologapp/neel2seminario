"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerEstado, salvarEstado } from "@/lib/divulgacao";

async function logado() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return !!data.user;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Liga/desliga a divulgação de um grupo. */
export async function marcarGrupo(chatId: string, divulgar: boolean) {
  if (!(await logado())) return { ok: false, erro: "Sessão expirada." };
  try {
    const e = await lerEstado();
    const g = e.grupos.find((x) => x.chat_id === chatId);
    if (!g) return { ok: false, erro: "Grupo não encontrado." };
    g.divulgar = divulgar;
    await salvarEstado(e);
    revalidatePath("/admin/divulgacao");
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: (err as Error).message };
  }
}

export interface ConfigForm {
  ativo: boolean;
  ritmo: "diario" | "alternado";
  inicio: string;
  fim: string;
  horarios: string;
  intervalo_min: number;
  textos: string;
  link: string;
}

/** Salva horários, período, ritmo, textos e o botão geral liga/pausa. */
export async function salvarConfig(f: ConfigForm) {
  if (!(await logado())) return { ok: false, erro: "Sessão expirada." };
  const horarios = f.horarios.split(/[\s,;]+/).map((h) => h.trim()).filter(Boolean);
  const invalidos = horarios.filter((h) => !HORA.test(h));
  if (invalidos.length) return { ok: false, erro: `Horário inválido: ${invalidos.join(", ")} (use 07:00, 20:30...)` };
  if (!horarios.length) return { ok: false, erro: "Informe pelo menos um horário." };
  // Textos separados por uma linha com ---
  const textos = f.textos.split(/\n\s*---\s*\n/).map((t) => t.trim()).filter(Boolean);
  try {
    const e = await lerEstado();
    e.config = {
      ...e.config,
      ativo: f.ativo,
      ritmo: f.ritmo,
      inicio: f.inicio || null,
      fim: f.fim || null,
      horarios,
      intervalo_min: Math.min(30, Math.max(1, Math.round(f.intervalo_min || 3))),
      textos,
      link: f.link.trim() || null,
    };
    await salvarEstado(e);
    revalidatePath("/admin/divulgacao");
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: (err as Error).message };
  }
}

/** Link para o navegador subir o flyer/vídeo direto no Storage (bucket "divulgacao-midia"). */
export async function prepararUpload(tipo: "flyer" | "video", nomeArquivo: string) {
  if (!(await logado())) return { ok: false as const, erro: "Sessão expirada." };
  const ext = (nomeArquivo.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") || (tipo === "video" ? "mp4" : "jpg");
  const path = `divulgacao/${tipo}-${Date.now()}.${ext}`;
  const admin = createAdminClient();
  // Espaço próprio da divulgação (público: o WhatsApp baixa o flyer/vídeo daqui).
  // O bucket "eventos" tem limite pensado para fotos; este aceita vídeo.
  const BUCKET = "divulgacao-midia";
  await admin.storage
    .createBucket(BUCKET, { public: true, fileSizeLimit: "50MB", allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"] })
    .catch(() => null);
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false as const, erro: error?.message ?? "Não consegui preparar o envio." };
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true as const, bucket: BUCKET, path, token: data.token, url: pub.publicUrl };
}

/** Grava a URL do material depois que o upload terminou (ou limpa com null). */
export async function salvarMaterial(tipo: "flyer" | "video", url: string | null) {
  if (!(await logado())) return { ok: false, erro: "Sessão expirada." };
  try {
    const e = await lerEstado();
    if (tipo === "flyer") e.config.flyer_url = url;
    else e.config.video_url = url;
    await salvarEstado(e);
    revalidatePath("/admin/divulgacao");
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: (err as Error).message };
  }
}

/** Pede ao n8n para ler de novo os grupos do WhatsApp (só leitura lá). */
export async function atualizarGrupos() {
  if (!(await logado())) return { ok: false, erro: "Sessão expirada." };
  const url = process.env.N8N_DIVULGACAO_GRUPOS_URL || "https://webhook.escolaamadeus.com/webhook/neel-divulgacao-grupos";
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as { recebidos?: number };
    revalidatePath("/admin/divulgacao");
    return r.ok ? { ok: true, recebidos: j.recebidos ?? null } : { ok: false, erro: `n8n respondeu ${r.status}` };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
