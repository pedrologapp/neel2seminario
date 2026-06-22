"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLoteAtivo,
  getPrecoAtual,
  montaNomeItem,
  type Lote,
} from "@/lib/lotes";
import { logInscricao } from "@/lib/log-inscricao";
import { slugify } from "@/lib/utils";
import { calcEstoquePorTipo, validarCotaItens } from "@/lib/estoque";

const loteSchema = z.object({
  nome: z.string().min(1, "Nome do lote obrigatório"),
  preco: z.number().min(0, "Preço do lote não pode ser negativo"),
  valido_ate: z.string().nullable(),
});

const tipoIngressoSchema = z.object({
  nome: z.string().min(1, "Nome do ingresso obrigatório"),
  preco: z.number().min(0, "Preço não pode ser negativo"),
  descricao: z.string().optional().nullable(),
  max_ingressos: z.number().int().min(1).nullable().optional(),
  opcional: z.boolean().optional().default(false),
  grupo: z.string().trim().min(1).nullable().optional(),
  lotes: z.array(loteSchema).optional().default([]),
});

const createEventoSchema = z.object({
  nome: z.string().min(3, "Nome muito curto"),
  descricao_curta: z.string().optional().nullable(),
  descricao_longa: z.string().optional().nullable(),
  data_evento: z.string().min(1, "Informe a data"),
  hora_evento: z.string().optional().nullable(),
  local: z.string().optional().nullable(),
  cor_tematica: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
  metodos_pagamento: z
    .array(z.enum(["pix", "cartao"]))
    .min(1, "Selecione ao menos um método"),
  max_parcelas: z.number().min(1).max(12),
  prazo_inscricao: z.string().optional().nullable(),
  status: z.enum(["rascunho", "publicado"]),
  destinacao_valores: z.string().optional().nullable(),
  infos_importantes: z.array(z.string()),
  mostrar_estoque_publico: z.boolean().default(false),
  palestrantes: z
    .array(
      z.object({
        nome: z.string().trim().min(1, "Nome do palestrante obrigatório"),
        foto_url: z.string().nullable().optional(),
      }),
    )
    .optional()
    .default([]),
  contatos: z.array(z.string().trim().min(1)).optional().default([]),
  tipos_ingresso: z.array(tipoIngressoSchema).min(1, "Adicione ao menos um tipo de ingresso"),
});

type Palestrante = { nome: string; foto_url?: string | null };

/**
 * Sobe as fotos novas dos palestrantes (anexadas como `palestrante_foto_<i>`)
 * e devolve a lista com os foto_url atualizados. Mantém a foto existente quando
 * não há arquivo novo no índice.
 */
async function uploadPalestranteFotos(
  formData: FormData,
  palestrantes: Palestrante[],
  nomeEvento: string,
): Promise<Palestrante[]> {
  const admin = createAdminClient();
  const result: Palestrante[] = [];
  for (let i = 0; i < palestrantes.length; i++) {
    const p = palestrantes[i];
    const file = formData.get(`palestrante_foto_${i}`);
    if (file instanceof File && file.size > 0) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const fileName = `palestrantes/${Date.now()}-${i}-${slugify(nomeEvento)}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("eventos")
        .upload(fileName, file, { contentType: file.type, upsert: false });
      if (upErr) {
        // Falha de foto não derruba o evento — mantém a anterior (ou null).
        result.push({ nome: p.nome, foto_url: p.foto_url ?? null });
        continue;
      }
      const { data: pub } = admin.storage.from("eventos").getPublicUrl(fileName);
      result.push({ nome: p.nome, foto_url: pub.publicUrl });
    } else {
      result.push({ nome: p.nome, foto_url: p.foto_url ?? null });
    }
  }
  return result;
}

export type CreateEventoState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

export async function createEvento(
  _prev: CreateEventoState,
  formData: FormData,
): Promise<CreateEventoState> {
  const raw = {
    nome: formData.get("nome")?.toString() ?? "",
    descricao_curta: emptyToNull(formData.get("descricao_curta")?.toString()),
    descricao_longa: emptyToNull(formData.get("descricao_longa")?.toString()),
    data_evento: formData.get("data_evento")?.toString() ?? "",
    hora_evento: emptyToNull(formData.get("hora_evento")?.toString()),
    local: emptyToNull(formData.get("local")?.toString()),
    cor_tematica: formData.get("cor_tematica")?.toString() ?? "#C2410C",
    metodos_pagamento: parseArrayField(formData, "metodos_pagamento") ?? [],
    max_parcelas: Number(formData.get("max_parcelas") ?? 3),
    prazo_inscricao: emptyToNull(formData.get("prazo_inscricao")?.toString()),
    status: (formData.get("status")?.toString() ?? "rascunho") as
      | "rascunho"
      | "publicado",
    destinacao_valores: emptyToNull(
      formData.get("destinacao_valores")?.toString(),
    ),
    infos_importantes: parseInfosImportantes(
      formData.get("infos_importantes")?.toString(),
    ),
    mostrar_estoque_publico:
      formData.get("mostrar_estoque_publico")?.toString() === "1",
    palestrantes: parseJsonArray(formData.get("palestrantes")?.toString()),
    contatos: parseJsonArray(formData.get("contatos")?.toString()),
    tipos_ingresso: parseTiposIngresso(
      formData.get("tipos_ingresso")?.toString(),
    ),
  };

  const parsed = createEventoSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Verifique os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sua sessão expirou. Faça login novamente." };
  }

  // Upload da imagem de capa (se houver)
  let imagemCapaUrl: string | null = null;
  const capaFile = formData.get("imagem_capa") as File | null;
  if (capaFile && capaFile.size > 0) {
    const admin = createAdminClient();
    const ext = capaFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const fileName = `${Date.now()}-${slugify(data.nome)}.${ext}`;
    const { error: uploadErr } = await admin.storage
      .from("eventos")
      .upload(fileName, capaFile, {
        contentType: capaFile.type,
        upsert: false,
      });
    if (uploadErr) {
      return { error: `Erro no upload da imagem: ${uploadErr.message}` };
    }
    const { data: publicData } = admin.storage
      .from("eventos")
      .getPublicUrl(fileName);
    imagemCapaUrl = publicData.publicUrl;
  }

  // Sobe fotos novas dos palestrantes
  const palestrantes = await uploadPalestranteFotos(
    formData,
    data.palestrantes,
    data.nome,
  );

  // Gerar slug único
  const baseSlug = slugify(data.nome);
  const slug = await ensureUniqueSlug(baseSlug);

  // Insert evento
  const { data: evento, error: insertErr } = await supabase
    .from("eventos")
    .insert({
      slug,
      nome: data.nome,
      descricao_curta: data.descricao_curta,
      descricao_longa: data.descricao_longa,
      data_evento: data.data_evento,
      hora_evento: data.hora_evento,
      local: data.local,
      imagem_capa_url: imagemCapaUrl,
      cor_tematica: data.cor_tematica,
      metodos_pagamento: data.metodos_pagamento,
      max_parcelas: data.max_parcelas,
      prazo_inscricao: data.prazo_inscricao,
      status: data.status,
      destinacao_valores: data.destinacao_valores,
      infos_importantes: data.infos_importantes,
      mostrar_estoque_publico: data.mostrar_estoque_publico,
      palestrantes,
      contatos: data.contatos,
    })
    .select("id")
    .single();

  if (insertErr || !evento) {
    return {
      error: `Erro ao salvar evento: ${insertErr?.message ?? "desconhecido"}`,
    };
  }

  // Insert tipos_ingresso
  const tiposToInsert = data.tipos_ingresso.map((tipo, ordem) => ({
    evento_id: evento.id,
    nome: tipo.nome,
    preco: tipo.preco,
    descricao: tipo.descricao,
    max_ingressos: tipo.max_ingressos ?? null,
    opcional: tipo.opcional,
    grupo: tipo.grupo ?? null,
    lotes: tipo.lotes ?? [],
    ordem,
    ativo: true,
  }));

  const { error: tiposErr } = await supabase
    .from("tipos_ingresso")
    .insert(tiposToInsert);

  if (tiposErr) {
    // Se falhou os tipos, apaga o evento pra não ficar órfão
    await supabase.from("eventos").delete().eq("id", evento.id);
    return { error: `Erro ao salvar tipos de ingresso: ${tiposErr.message}` };
  }

  revalidatePath("/admin/eventos");
  revalidatePath("/");
  redirect("/admin/eventos");
}

// ---------- helpers ----------

function emptyToNull(v: string | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseArrayField(fd: FormData, key: string): string[] | null {
  const values = fd.getAll(key).map((v) => v.toString()).filter(Boolean);
  return values.length === 0 ? null : values;
}

function parseInfosImportantes(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function parseTiposIngresso(raw: string | undefined): unknown {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function parseJsonArray(raw: string | undefined): unknown {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const supabase = await createClient();
  let slug = base;
  let n = 1;
  while (true) {
    const { data } = await supabase
      .from("eventos")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    n += 1;
    slug = `${base}-${n}`;
    if (n > 50) return `${base}-${Date.now()}`;
  }
}

// =============================================================
// UPDATE / DELETE / DUPLICATE
// =============================================================

export async function updateEvento(
  eventoId: string,
  _prev: CreateEventoState,
  formData: FormData,
): Promise<CreateEventoState> {
  const raw = {
    nome: formData.get("nome")?.toString() ?? "",
    descricao_curta: emptyToNull(formData.get("descricao_curta")?.toString()),
    descricao_longa: emptyToNull(formData.get("descricao_longa")?.toString()),
    data_evento: formData.get("data_evento")?.toString() ?? "",
    hora_evento: emptyToNull(formData.get("hora_evento")?.toString()),
    local: emptyToNull(formData.get("local")?.toString()),
    cor_tematica: formData.get("cor_tematica")?.toString() ?? "#C2410C",
    metodos_pagamento: parseArrayField(formData, "metodos_pagamento") ?? [],
    max_parcelas: Number(formData.get("max_parcelas") ?? 3),
    prazo_inscricao: emptyToNull(formData.get("prazo_inscricao")?.toString()),
    status: (formData.get("status")?.toString() ?? "rascunho") as
      | "rascunho"
      | "publicado",
    destinacao_valores: emptyToNull(
      formData.get("destinacao_valores")?.toString(),
    ),
    infos_importantes: parseInfosImportantes(
      formData.get("infos_importantes")?.toString(),
    ),
    mostrar_estoque_publico:
      formData.get("mostrar_estoque_publico")?.toString() === "1",
    palestrantes: parseJsonArray(formData.get("palestrantes")?.toString()),
    contatos: parseJsonArray(formData.get("contatos")?.toString()),
    tipos_ingresso: parseTiposIngresso(
      formData.get("tipos_ingresso")?.toString(),
    ),
  };

  const parsed = createEventoSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Verifique os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sua sessão expirou. Faça login novamente." };
  }

  // Imagem: upload novo / remover / manter
  const removerImagem = formData.get("remover_imagem")?.toString() === "1";
  const capaFile = formData.get("imagem_capa") as File | null;
  const imagemUpdate: { imagem_capa_url?: string | null } = {};

  if (capaFile && capaFile.size > 0) {
    const admin = createAdminClient();
    const ext = capaFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const fileName = `${Date.now()}-${slugify(data.nome)}.${ext}`;
    const { error: uploadErr } = await admin.storage
      .from("eventos")
      .upload(fileName, capaFile, {
        contentType: capaFile.type,
        upsert: false,
      });
    if (uploadErr) {
      return { error: `Erro no upload da imagem: ${uploadErr.message}` };
    }
    const { data: pub } = admin.storage
      .from("eventos")
      .getPublicUrl(fileName);
    imagemUpdate.imagem_capa_url = pub.publicUrl;
  } else if (removerImagem) {
    imagemUpdate.imagem_capa_url = null;
  }

  // Sobe fotos novas dos palestrantes (mantém as existentes)
  const palestrantes = await uploadPalestranteFotos(
    formData,
    data.palestrantes,
    data.nome,
  );

  const { error: updateErr } = await supabase
    .from("eventos")
    .update({
      nome: data.nome,
      descricao_curta: data.descricao_curta,
      descricao_longa: data.descricao_longa,
      data_evento: data.data_evento,
      hora_evento: data.hora_evento,
      local: data.local,
      cor_tematica: data.cor_tematica,
      metodos_pagamento: data.metodos_pagamento,
      max_parcelas: data.max_parcelas,
      prazo_inscricao: data.prazo_inscricao,
      status: data.status,
      destinacao_valores: data.destinacao_valores,
      infos_importantes: data.infos_importantes,
      mostrar_estoque_publico: data.mostrar_estoque_publico,
      palestrantes,
      contatos: data.contatos,
      ...imagemUpdate,
    })
    .eq("id", eventoId);

  if (updateErr) {
    return { error: `Erro ao atualizar evento: ${updateErr.message}` };
  }

  // Substitui tipos_ingresso (delete-all + insert-all)
  await supabase.from("tipos_ingresso").delete().eq("evento_id", eventoId);

  const tiposToInsert = data.tipos_ingresso.map((tipo, ordem) => ({
    evento_id: eventoId,
    nome: tipo.nome,
    preco: tipo.preco,
    descricao: tipo.descricao,
    max_ingressos: tipo.max_ingressos ?? null,
    opcional: tipo.opcional,
    grupo: tipo.grupo ?? null,
    lotes: tipo.lotes ?? [],
    ordem,
    ativo: true,
  }));

  const { error: tiposErr } = await supabase
    .from("tipos_ingresso")
    .insert(tiposToInsert);

  if (tiposErr) {
    return { error: `Erro ao salvar tipos de ingresso: ${tiposErr.message}` };
  }

  revalidatePath("/admin/eventos");
  revalidatePath(`/admin/eventos/${eventoId}`);
  revalidatePath("/");
  redirect(`/admin/eventos/${eventoId}`);
}

export async function deleteEvento(
  eventoId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou." };

  // Não permite excluir se houver inscrições
  const { count } = await supabase
    .from("inscricoes")
    .select("id", { count: "exact", head: true })
    .eq("evento_id", eventoId);

  if (count && count > 0) {
    return {
      error: `Não dá pra excluir: já existem ${count} inscriçõe${count === 1 ? "" : "s"} neste evento. Cancele-as primeiro ou marque o evento como encerrado.`,
    };
  }

  const { error } = await supabase
    .from("eventos")
    .delete()
    .eq("id", eventoId);
  if (error) return { error: error.message };

  revalidatePath("/admin/eventos");
  revalidatePath("/");
  redirect("/admin/eventos");
}

export async function duplicateEvento(
  eventoId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou." };

  const { data: source, error: fetchErr } = await supabase
    .from("eventos")
    .select(
      "slug, nome, descricao_curta, descricao_longa, data_evento, hora_evento, local, imagem_capa_url, cor_tematica, metodos_pagamento, max_parcelas, prazo_inscricao, destinacao_valores, infos_importantes, mostrar_estoque_publico, palestrantes, contatos, tipos_ingresso(nome, preco, descricao, icone, cor, ordem, ativo, max_ingressos, opcional, grupo, lotes)",
    )
    .eq("id", eventoId)
    .maybeSingle();

  if (fetchErr || !source) {
    return { error: "Evento não encontrado." };
  }

  const newSlug = await ensureUniqueSlug(`${source.slug}-copia`);

  const { data: novo, error: insertErr } = await supabase
    .from("eventos")
    .insert({
      slug: newSlug,
      nome: `${source.nome} (cópia)`,
      descricao_curta: source.descricao_curta,
      descricao_longa: source.descricao_longa,
      data_evento: source.data_evento,
      hora_evento: source.hora_evento,
      local: source.local,
      imagem_capa_url: source.imagem_capa_url,
      cor_tematica: source.cor_tematica,
      metodos_pagamento: source.metodos_pagamento,
      max_parcelas: source.max_parcelas,
      prazo_inscricao: source.prazo_inscricao,
      status: "rascunho",
      destinacao_valores: source.destinacao_valores,
      infos_importantes: source.infos_importantes,
      mostrar_estoque_publico: source.mostrar_estoque_publico ?? false,
      palestrantes: source.palestrantes ?? [],
      contatos: source.contatos ?? [],
    })
    .select("id")
    .single();

  if (insertErr || !novo) {
    return { error: insertErr?.message ?? "Erro ao duplicar evento." };
  }

  // Clona tipos_ingresso
  const tipos = (source.tipos_ingresso ?? []) as Array<{
    nome: string;
    preco: number;
    descricao: string | null;
    icone: string | null;
    cor: string | null;
    ordem: number;
    ativo: boolean;
    max_ingressos: number | null;
    opcional: boolean | null;
    grupo: string | null;
    lotes: unknown;
  }>;

  if (tipos.length > 0) {
    await supabase.from("tipos_ingresso").insert(
      tipos.map((t) => ({
        evento_id: novo.id,
        nome: t.nome,
        preco: t.preco,
        descricao: t.descricao,
        icone: t.icone,
        cor: t.cor,
        ordem: t.ordem,
        ativo: t.ativo,
        max_ingressos: t.max_ingressos ?? null,
        opcional: t.opcional ?? false,
        grupo: t.grupo ?? null,
        lotes: t.lotes ?? [],
      })),
    );
  }

  revalidatePath("/admin/eventos");
  redirect(`/admin/eventos/${novo.id}/editar`);
}

// =============================================================
// VENDA EM DINHEIRO (presencial, registrada pelo admin)
// =============================================================

const vendaDinheiroSchema = z.object({
  evento_id: z.string().uuid(),
  responsavel_nome: z.string().min(2, "Nome muito curto"),
  telefone: z.string().min(8, "Telefone inválido"),
  email: z.string().email().optional().or(z.literal("")),
  cpf: z.string().optional().or(z.literal("")),
  quantidades: z.record(z.string(), z.number().int().min(0)),
});

export type VendaDinheiroState =
  | { ok: true; inscricaoId: string }
  | { ok: false; error: string };

export async function registrarVendaDinheiro(
  data: unknown,
): Promise<VendaDinheiroState> {
  const parsed = vendaDinheiroSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const d = parsed.data;

  // Auth — só admin logado registra venda
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sua sessão expirou. Faça login novamente." };
  }

  const admin = createAdminClient();

  // Busca os tipos do evento (com lotes) pra calcular preço NO SERVIDOR
  const { data: tipos, error: tiposErr } = await admin
    .from("tipos_ingresso")
    .select("id, nome, preco, lotes, grupo")
    .eq("evento_id", d.evento_id);

  if (tiposErr || !tipos) {
    return { ok: false, error: "Erro ao carregar tipos de ingresso." };
  }

  // Monta itens com preço do lote ativo (ignora o que vier do cliente)
  const itens: {
    tipo_id: string;
    nome: string;
    qtd: number;
    preco_unitario: number;
  }[] = [];
  for (const tipo of tipos) {
    const qtd = d.quantidades[tipo.id] ?? 0;
    if (qtd <= 0) continue;
    const lotes = (tipo.lotes ?? []) as Lote[];
    const tipoComLotes = {
      nome: tipo.nome,
      preco: Number(tipo.preco),
      descricao: null,
      lotes,
    };
    const preco = getPrecoAtual(tipoComLotes);
    // Nome final = tipo (sem prefixo "Nº Lote -") + lote ativo. Vendas
    // opcionais com grupo ganham o prefixo do grupo (ex: "Almoço - Frango").
    const nomeBase = montaNomeItem(tipo.nome, getLoteAtivo(lotes));
    const nomeFinal = tipo.grupo ? `${tipo.grupo} - ${nomeBase}` : nomeBase;
    itens.push({
      tipo_id: tipo.id,
      nome: nomeFinal,
      qtd,
      preco_unitario: preco,
    });
  }

  if (itens.length === 0) {
    return { ok: false, error: "Selecione pelo menos um ingresso." };
  }

  // Valida cota antes de gravar
  const estoque = await calcEstoquePorTipo(admin, d.evento_id);
  const erroCota = validarCotaItens(itens, estoque);
  if (erroCota) {
    return { ok: false, error: erroCota };
  }

  const valorTotal = itens.reduce(
    (sum, i) => sum + i.qtd * i.preco_unitario,
    0,
  );

  // Insere inscrição já como PAGA, método dinheiro
  const { data: inscricao, error: insertErr } = await admin
    .from("inscricoes")
    .insert({
      evento_id: d.evento_id,
      responsavel_nome: d.responsavel_nome,
      cpf: d.cpf || "",
      email: d.email || "",
      telefone: d.telefone,
      itens,
      valor_base: valorTotal,
      valor_total: valorTotal,
      metodo_pagamento: "dinheiro",
      parcelas: 1,
      status_pagamento: "pago",
      registrado_por: user.email ?? "admin",
    })
    .select("id")
    .single();

  if (insertErr || !inscricao) {
    return {
      ok: false,
      error: `Erro ao registrar venda: ${insertErr?.message ?? "desconhecido"}`,
    };
  }

  await logInscricao({
    inscricaoId: inscricao.id,
    etapa: "venda_dinheiro_registrada",
    sucesso: true,
    mensagem: `Venda em dinheiro registrada por ${user.email ?? "admin"} (R$ ${valorTotal.toFixed(2)})`,
    detalhe: { registrado_por: user.email, valor_total: valorTotal },
    origem: "site",
  });

  // Dispara o fluxo n8n de geração de tickets + WhatsApp (best-effort)
  const notifUrl = process.env.N8N_NOTIFICACAO_URL;
  if (notifUrl) {
    try {
      await fetch(notifUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "PAYMENT_RECEIVED",
          payment: {
            id: `cash_${inscricao.id}`,
            status: "RECEIVED",
            billingType: "CASH",
            value: valorTotal,
            externalReference: inscricao.id,
          },
        }),
      });
    } catch (err) {
      // best-effort — venda já está registrada, WhatsApp pode reenviar depois
      console.error("Falha ao disparar n8n pra venda em dinheiro:", err);
    }
  }

  revalidatePath(`/admin/eventos/${d.evento_id}`);
  return { ok: true, inscricaoId: inscricao.id };
}

// =============================================================
// REENVIO DE QR CODES (dispara workflow n8n dedicado)
// =============================================================

export type ReenvioQRState =
  | { ok: true; mensagem: string }
  | { ok: false; error: string };

export async function reenviarQRCodes(
  inscricaoId: string,
): Promise<ReenvioQRState> {
  // Auth — só admin logado
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sua sessão expirou. Faça login novamente." };
  }

  // Valida inscrição: deve existir e estar paga
  const adminCli = createAdminClient();
  const { data: inscricao, error: fetchErr } = await adminCli
    .from("inscricoes")
    .select("id, evento_id, status_pagamento")
    .eq("id", inscricaoId)
    .maybeSingle();

  if (fetchErr || !inscricao) {
    return { ok: false, error: "Inscrição não encontrada." };
  }
  if (inscricao.status_pagamento !== "pago") {
    return {
      ok: false,
      error: "Só é possível reenviar QR de inscrição já paga.",
    };
  }

  // Chama o webhook n8n de reenvio
  const webhookUrl = process.env.N8N_REENVIO_QR_URL;
  if (!webhookUrl) {
    return {
      ok: false,
      error: "Webhook de reenvio não configurado no servidor (N8N_REENVIO_QR_URL).",
    };
  }

  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": process.env.WEBHOOK_CONFIRM_SECRET ?? "",
      },
      body: JSON.stringify({
        inscricaoId,
        adminEmail: user.email ?? "admin",
        timestamp: new Date().toISOString(),
      }),
    });

    const corpo = await resp.text();
    if (!resp.ok) {
      await logInscricao({
        inscricaoId,
        etapa: "reenvio_qr_falhou",
        sucesso: false,
        mensagem: `n8n retornou ${resp.status}: ${corpo.slice(0, 200)}`,
        origem: "site",
      });
      return {
        ok: false,
        error: `Erro no servidor (HTTP ${resp.status}). Tente novamente em alguns segundos.`,
      };
    }

    let data: { ok?: boolean; message?: string } | null = null;
    try {
      data = JSON.parse(corpo);
    } catch {
      // Sem JSON — assumimos sucesso já que o HTTP foi ok.
    }

    if (data?.ok === false) {
      return {
        ok: false,
        error: data.message ?? "O servidor recusou o reenvio.",
      };
    }

    await logInscricao({
      inscricaoId,
      etapa: "reenvio_qr_disparado",
      sucesso: true,
      mensagem: `Reenvio de QR codes disparado por ${user.email ?? "admin"}`,
      origem: "site",
    });

    revalidatePath(`/admin/eventos/${inscricao.evento_id}`);
    return { ok: true, mensagem: "Reenvio disparado! Pode demorar alguns segundos pra chegar no WhatsApp." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Falha de conexão com o servidor de notificações (${msg}).`,
    };
  }
}

// =============================================================
// EXCLUSÃO DE INSCRIÇÃO CANCELADA
// =============================================================

export type ExcluirInscricaoState =
  | { ok: true }
  | { ok: false; error: string };

export async function excluirInscricaoCancelada(
  inscricaoId: string,
): Promise<ExcluirInscricaoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sua sessão expirou. Faça login novamente." };
  }

  const { data: inscricao, error: fetchErr } = await supabase
    .from("inscricoes")
    .select("id, evento_id, status_pagamento")
    .eq("id", inscricaoId)
    .maybeSingle();

  if (fetchErr || !inscricao) {
    return { ok: false, error: "Inscrição não encontrada." };
  }
  if (inscricao.status_pagamento !== "cancelado") {
    return {
      ok: false,
      error: "Só é possível excluir inscrição cancelada.",
    };
  }

  // tickets e inscricao_logs caem junto (FK on delete cascade)
  const { error: delErr } = await supabase
    .from("inscricoes")
    .delete()
    .eq("id", inscricaoId);

  if (delErr) {
    return { ok: false, error: `Erro ao excluir: ${delErr.message}` };
  }

  revalidatePath(`/admin/eventos/${inscricao.evento_id}`);
  return { ok: true };
}

export type ExcluirEmMassaState =
  | { ok: true; excluidas: number }
  | { ok: false; error: string };

export async function excluirInscricoesCanceladas(
  inscricaoIds: string[],
): Promise<ExcluirEmMassaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sua sessão expirou. Faça login novamente." };
  }
  if (inscricaoIds.length === 0) {
    return { ok: false, error: "Nenhuma inscrição selecionada." };
  }

  // Filtra no servidor: só as que realmente estão canceladas
  const { data: alvos, error: fetchErr } = await supabase
    .from("inscricoes")
    .select("id, evento_id")
    .in("id", inscricaoIds)
    .eq("status_pagamento", "cancelado");

  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }
  if (!alvos || alvos.length === 0) {
    return {
      ok: false,
      error: "Nenhuma inscrição cancelada entre as selecionadas.",
    };
  }

  const { error: delErr } = await supabase
    .from("inscricoes")
    .delete()
    .in(
      "id",
      alvos.map((a) => a.id),
    );

  if (delErr) {
    return { ok: false, error: `Erro ao excluir: ${delErr.message}` };
  }

  for (const eventoId of new Set(alvos.map((a) => a.evento_id))) {
    revalidatePath(`/admin/eventos/${eventoId}`);
  }
  return { ok: true, excluidas: alvos.length };
}

// Trava de senha para ações sensíveis (editar/excluir/duplicar).
// A senha é validada no servidor para não ir no bundle do cliente.
export async function verificarSenhaAcao(senha: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const senhaCorreta = process.env.ADMIN_ACTION_PASSWORD || "Admim123";
  return senha === senhaCorreta;
}
