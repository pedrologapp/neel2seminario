"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_COMPROVANTES, CATEGORIAS, lerDespesas, salvarDespesas, type Despesa } from "@/lib/despesas";

async function usuario() {
  const { data } = await (await createClient()).auth.getUser();
  return data.user;
}

/** URL para o navegador subir o comprovante direto no Storage (foto ou PDF, até 10 MB). */
export async function prepararComprovante(nomeArquivo: string) {
  if (!(await usuario())) return { ok: false as const, erro: "Sessão expirada." };
  const ext = (nomeArquivo.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  await admin.storage
    .createBucket(BUCKET_COMPROVANTES, { public: false, fileSizeLimit: "10MB", allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"] })
    .catch(() => null);
  const { data, error } = await admin.storage.from(BUCKET_COMPROVANTES).createSignedUploadUrl(path);
  if (error || !data) return { ok: false as const, erro: error?.message ?? "Não consegui preparar o envio do comprovante." };
  return { ok: true as const, path, token: data.token };
}

export interface EntradaDespesa {
  id?: string | null;
  data: string;
  descricao: string;
  categoria: string;
  fornecedor?: string | null;
  valor: number;
  forma?: string | null;
  comprovante?: string | null;
  obs?: string | null;
}

/** Cria ou edita uma despesa. */
export async function salvarDespesa(e: EntradaDespesa) {
  const user = await usuario();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo no admin." };
  const descricao = e.descricao?.trim();
  const valor = Math.round(Number(e.valor) * 100) / 100;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data)) return { ok: false, erro: "Informe a data." };
  if (!descricao) return { ok: false, erro: "Descreva a despesa." };
  if (!(valor > 0)) return { ok: false, erro: "Informe o valor." };
  const categoria = (CATEGORIAS as readonly string[]).includes(e.categoria) ? e.categoria : "Outros";
  try {
    const lista = await lerDespesas();
    const limpo = (v?: string | null) => (v?.trim() ? v.trim().slice(0, 300) : null);
    if (e.id) {
      const d = lista.find((x) => x.id === e.id);
      if (!d) return { ok: false, erro: "Despesa não encontrada (atualize a página)." };
      Object.assign(d, { data: e.data, descricao, categoria, fornecedor: limpo(e.fornecedor), valor, forma: limpo(e.forma), obs: limpo(e.obs), comprovante: e.comprovante ?? d.comprovante });
    } else {
      lista.push({
        id: crypto.randomUUID(), data: e.data, descricao, categoria, fornecedor: limpo(e.fornecedor), valor, forma: limpo(e.forma),
        comprovante: e.comprovante ?? null, obs: limpo(e.obs), criado_em: new Date().toISOString(), criado_por: user.email ?? null,
      } satisfies Despesa);
    }
    await salvarDespesas(lista);
    revalidatePath("/admin/financeiro/despesas");
    revalidatePath("/admin/financeiro");
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: (err as Error).message };
  }
}

export async function excluirDespesa(id: string) {
  if (!(await usuario())) return { ok: false, erro: "Sessão expirada." };
  try {
    const lista = await lerDespesas();
    const d = lista.find((x) => x.id === id);
    if (!d) return { ok: false, erro: "Despesa não encontrada." };
    await salvarDespesas(lista.filter((x) => x.id !== id));
    // O comprovante fica guardado (as versões antigas do JSON ainda apontam para ele).
    revalidatePath("/admin/financeiro/despesas");
    revalidatePath("/admin/financeiro");
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: (err as Error).message };
  }
}
