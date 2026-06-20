"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularTotal } from "@/lib/pricing";
import { validarCPF, telefoneValido } from "@/lib/validators";

const cobrancaSchema = z.object({
  descricao: z.string().min(3, "Descreva o que está sendo cobrado."),
  valor: z.number().min(1, "Valor mínimo de R$ 1,00."),
  metodo_cobranca: z.enum(["aberto", "pix", "cartao"]),
  parcelas: z.number().int().min(1).max(12),
  repassar_juros: z.boolean(),
  responsavel_nome: z.string().min(2, "Nome muito curto"),
  cpf: z.string().refine((v) => validarCPF(v), "CPF inválido"),
  telefone: z.string().refine((v) => telefoneValido(v), "Telefone inválido"),
});

export type CobrancaAvulsaState =
  | { ok: true; cobrancaId: string; paymentUrl: string }
  | { ok: false; error: string };

export async function criarCobrancaAvulsa(
  data: unknown,
): Promise<CobrancaAvulsaState> {
  const parsed = cobrancaSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const d = parsed.data;

  // Auth — só admin logado cria cobrança
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sua sessão expirou. Faça login novamente." };
  }

  const admin = createAdminClient();

  // Total calculado NO SERVIDOR (ignora o que o cliente exibiu):
  // cartão com repasse = base + taxas (mesma regra dos eventos);
  // PIX, link aberto ou cartão sem repasse = valor base.
  const parcelas = d.metodo_cobranca === "cartao" ? d.parcelas : 1;
  const valorTotal =
    d.metodo_cobranca === "cartao" && d.repassar_juros
      ? Math.round(calcularTotal(d.valor, "cartao", parcelas).valorTotal * 100) /
        100
      : d.valor;

  // 1. Insere cobrança pendente
  const { data: cobranca, error: insertErr } = await admin
    .from("cobrancas_avulsas")
    .insert({
      descricao: d.descricao.trim(),
      valor: d.valor,
      metodo_cobranca: d.metodo_cobranca,
      parcelas,
      repassar_juros: d.repassar_juros,
      valor_total: valorTotal,
      responsavel_nome: d.responsavel_nome.trim(),
      cpf: d.cpf,
      telefone: d.telefone,
      status_pagamento: "pendente",
      registrado_por: user.email ?? "admin",
    })
    .select("id")
    .single();

  if (insertErr || !cobranca) {
    return {
      ok: false,
      error: `Erro ao registrar cobrança: ${insertErr?.message ?? "desconhecido"}`,
    };
  }

  // 2. Webhook n8n: cria cobrança no Asaas e envia o link no WhatsApp
  const webhookUrl = process.env.N8N_COBRANCA_AVULSA_URL;
  if (!webhookUrl) {
    await admin
      .from("cobrancas_avulsas")
      .update({ status_pagamento: "cancelado" })
      .eq("id", cobranca.id);
    return {
      ok: false,
      error:
        "Webhook de cobrança avulsa não configurado no servidor (N8N_COBRANCA_AVULSA_URL).",
    };
  }

  let webhookData: {
    success?: boolean;
    message?: string;
    paymentUrl?: string;
    asaasPaymentId?: string;
    asaasCustomerId?: string;
  };

  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cobrancaId: cobranca.id,
        // Prefixo distingue da inscrição na notificação do Asaas
        externalReference: `avulsa_${cobranca.id}`,
        descricao: d.descricao.trim(),
        amount: d.valor,
        // O que o Asaas deve cobrar de fato (com juros, se repassados)
        valorTotal,
        // 'undefined' = link aberto (responsável escolhe PIX/cartão à vista)
        paymentMethod:
          d.metodo_cobranca === "pix"
            ? "pix"
            : d.metodo_cobranca === "cartao"
              ? "credit"
              : "undefined",
        installments: parcelas,
        // Responsável
        parentName: d.responsavel_nome.trim(),
        cpf: d.cpf,
        phone: d.telefone,
        registradoPor: user.email ?? "admin",
        timestamp: new Date().toISOString(),
      }),
    });

    const corpoTexto = await resp.text();

    if (!resp.ok) {
      console.error(
        `[criarCobrancaAvulsa] Webhook n8n retornou ${resp.status}. Corpo: ${corpoTexto.slice(0, 500)}`,
      );
      await admin
        .from("cobrancas_avulsas")
        .update({ status_pagamento: "cancelado" })
        .eq("id", cobranca.id);
      return {
        ok: false,
        error: `Erro ao gerar o link de pagamento (HTTP ${resp.status}). Tente novamente.`,
      };
    }

    try {
      webhookData = JSON.parse(corpoTexto);
    } catch {
      console.error(
        `[criarCobrancaAvulsa] Webhook respondeu 200 mas não é JSON válido. Corpo: ${corpoTexto.slice(0, 500)}`,
      );
      await admin
        .from("cobrancas_avulsas")
        .update({ status_pagamento: "cancelado" })
        .eq("id", cobranca.id);
      return {
        ok: false,
        error:
          "O servidor de pagamento respondeu num formato inesperado. Verifique se o workflow do n8n termina com um node 'Respond to Webhook'.",
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[criarCobrancaAvulsa] Falha de conexão com webhook n8n. Erro: ${msg}`,
    );
    await admin
      .from("cobrancas_avulsas")
      .update({ status_pagamento: "cancelado" })
      .eq("id", cobranca.id);
    return {
      ok: false,
      error: `Não foi possível conectar ao servidor de pagamento (${msg}). Tente novamente.`,
    };
  }

  if (webhookData.success === false) {
    await admin
      .from("cobrancas_avulsas")
      .update({ status_pagamento: "cancelado" })
      .eq("id", cobranca.id);
    return {
      ok: false,
      error: webhookData.message ?? "O servidor recusou a cobrança.",
    };
  }

  const paymentUrl = webhookData.paymentUrl;
  if (!paymentUrl) {
    return {
      ok: false,
      error:
        "Link de pagamento não foi retornado pelo servidor. Verifique o workflow do n8n.",
    };
  }

  // 3. Atualiza cobrança com payment_url + ids do Asaas
  await admin
    .from("cobrancas_avulsas")
    .update({
      payment_url: paymentUrl,
      asaas_payment_id: webhookData.asaasPaymentId ?? null,
      asaas_customer_id: webhookData.asaasCustomerId ?? null,
    })
    .eq("id", cobranca.id);

  revalidatePath("/admin/cobrancas");
  return { ok: true, cobrancaId: cobranca.id, paymentUrl };
}

// =============================================================
// EXCLUSÃO DE COBRANÇA CANCELADA
// =============================================================

export type ExcluirCobrancaState =
  | { ok: true }
  | { ok: false; error: string };

export async function excluirCobrancaCancelada(
  cobrancaId: string,
): Promise<ExcluirCobrancaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sua sessão expirou. Faça login novamente." };
  }

  const { data: cobrancaExistente, error: fetchErr } = await supabase
    .from("cobrancas_avulsas")
    .select("id, status_pagamento")
    .eq("id", cobrancaId)
    .maybeSingle();

  if (fetchErr || !cobrancaExistente) {
    return { ok: false, error: "Cobrança não encontrada." };
  }
  if (cobrancaExistente.status_pagamento !== "cancelado") {
    return { ok: false, error: "Só é possível excluir cobrança cancelada." };
  }

  const { error: delErr } = await supabase
    .from("cobrancas_avulsas")
    .delete()
    .eq("id", cobrancaId);

  if (delErr) {
    return { ok: false, error: `Erro ao excluir: ${delErr.message}` };
  }

  revalidatePath("/admin/cobrancas");
  return { ok: true };
}

export type ExcluirCobrancasEmMassaState =
  | { ok: true; excluidas: number }
  | { ok: false; error: string };

export async function excluirCobrancasCanceladas(
  cobrancaIds: string[],
): Promise<ExcluirCobrancasEmMassaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sua sessão expirou. Faça login novamente." };
  }
  if (cobrancaIds.length === 0) {
    return { ok: false, error: "Nenhuma cobrança selecionada." };
  }

  // Filtra no servidor: só as que realmente estão canceladas
  const { data: alvos, error: fetchErr } = await supabase
    .from("cobrancas_avulsas")
    .select("id")
    .in("id", cobrancaIds)
    .eq("status_pagamento", "cancelado");

  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }
  if (!alvos || alvos.length === 0) {
    return {
      ok: false,
      error: "Nenhuma cobrança cancelada entre as selecionadas.",
    };
  }

  const { error: delErr } = await supabase
    .from("cobrancas_avulsas")
    .delete()
    .in(
      "id",
      alvos.map((a) => a.id),
    );

  if (delErr) {
    return { ok: false, error: `Erro ao excluir: ${delErr.message}` };
  }

  revalidatePath("/admin/cobrancas");
  return { ok: true, excluidas: alvos.length };
}
