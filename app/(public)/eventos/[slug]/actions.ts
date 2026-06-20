"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularTotal } from "@/lib/pricing";
import { logInscricao } from "@/lib/log-inscricao";
import { validarCPF, telefoneValido } from "@/lib/validators";
import { calcEstoquePorTipo, validarCotaItens } from "@/lib/estoque";

const itemSchema = z.object({
  tipo_id: z.string().uuid(),
  nome: z.string(),
  qtd: z.number().int().min(0),
  preco_unitario: z.number().min(0),
});

const inscricaoSchema = z.object({
  evento_id: z.string().uuid(),
  evento_slug: z.string(),
  responsavel_nome: z.string().min(2, "Nome muito curto"),
  cpf: z
    .string()
    .refine((v) => validarCPF(v), "CPF inválido"),
  email: z.string().email("E-mail inválido"),
  telefone: z
    .string()
    .refine((v) => telefoneValido(v), "Telefone inválido"),
  itens: z.array(itemSchema).min(1, "Selecione pelo menos um ingresso"),
  metodo_pagamento: z.enum(["pix", "cartao"]),
  parcelas: z.number().int().min(1).max(12),
});

export type InscricaoInput = z.infer<typeof inscricaoSchema>;

export type SubmitState =
  | { ok: true; paymentUrl: string; inscricaoId: string }
  | { ok: false; error: string };

export async function submitInscricao(
  data: unknown,
): Promise<SubmitState> {
  const parsed = inscricaoSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Verifique os dados do formulário.",
    };
  }
  const d = parsed.data;

  const itensComQtd = d.itens.filter((i) => i.qtd > 0);
  if (itensComQtd.length === 0) {
    return { ok: false, error: "Selecione pelo menos um ingresso." };
  }

  const valorBase = itensComQtd.reduce(
    (sum, i) => sum + i.qtd * i.preco_unitario,
    0,
  );
  const { valorTotal } = calcularTotal(
    valorBase,
    d.metodo_pagamento,
    d.parcelas,
  );

  const admin = createAdminClient();

  // Valida cota: rejeita se algum tipo estourou o limite (só pagas contam).
  const estoque = await calcEstoquePorTipo(admin, d.evento_id);
  const erroCota = validarCotaItens(itensComQtd, estoque);
  if (erroCota) {
    return { ok: false, error: erroCota };
  }

  // 1. Insere inscrição (status pendente)
  const { data: inscricao, error: insertErr } = await admin
    .from("inscricoes")
    .insert({
      evento_id: d.evento_id,
      responsavel_nome: d.responsavel_nome,
      cpf: d.cpf,
      email: d.email,
      telefone: d.telefone,
      itens: itensComQtd,
      valor_base: valorBase,
      valor_total: valorTotal,
      metodo_pagamento: d.metodo_pagamento,
      parcelas: d.parcelas,
      status_pagamento: "pendente",
    })
    .select("id")
    .single();

  if (insertErr || !inscricao) {
    return {
      ok: false,
      error: `Erro ao registrar inscrição: ${insertErr?.message ?? "desconhecido"}`,
    };
  }

  // 2. Dados auxiliares pro payload do webhook
  const { data: eventoData } = await admin
    .from("eventos")
    .select("nome, slug")
    .eq("id", d.evento_id)
    .maybeSingle();
  const eventoNome = eventoData?.nome ?? "";

  // 3. Compatibilidade com o fluxo n8n atual (Dia das Mães):
  //    extrai "senhasMae" e "senhasExtras" se houver tipos com esses nomes.
  const senhasMae =
    itensComQtd.find((i) => /m[aã]e/i.test(i.nome))?.qtd ?? 0;
  const senhasExtras =
    itensComQtd.find((i) => /extra/i.test(i.nome))?.qtd ?? 0;
  const ticketQuantity = itensComQtd.reduce((sum, i) => sum + i.qtd, 0);

  // 4. Envia pro webhook n8n
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    await admin
      .from("inscricoes")
      .update({ status_pagamento: "cancelado" })
      .eq("id", inscricao.id);
    return { ok: false, error: "Webhook não configurado no servidor." };
  }

  let webhookData: {
    success?: boolean;
    message?: string;
    paymentUrl?: string;
    asaasPaymentId?: string;
    paymentId?: string;
    asaasCustomerId?: string;
  };

  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inscricaoId: inscricao.id,
        eventoId: d.evento_id,
        eventoSlug: d.evento_slug,
        event: eventoNome,
        // Participante (o próprio inscrito)
        studentName: d.responsavel_nome,
        studentGrade: "",
        studentClass: "",
        // Responsável (mesma pessoa)
        parentName: d.responsavel_nome,
        cpf: d.cpf,
        email: d.email,
        phone: d.telefone,
        // Pagamento
        paymentMethod: d.metodo_pagamento === "pix" ? "pix" : "credit",
        installments: d.parcelas,
        // Compat com fluxo antigo
        senhasMae,
        senhasExtras,
        ticketQuantity,
        amount: valorTotal,
        // Estrutura granular nova
        itens: itensComQtd,
        timestamp: new Date().toISOString(),
      }),
    });

    const corpoTexto = await resp.text();

    if (!resp.ok) {
      console.error(
        `[submitInscricao] Webhook n8n retornou ${resp.status}. URL: ${webhookUrl}. Corpo: ${corpoTexto.slice(0, 500)}`,
      );
      await admin
        .from("inscricoes")
        .update({ status_pagamento: "cancelado" })
        .eq("id", inscricao.id);
      return {
        ok: false,
        error: `Erro ao processar pagamento (HTTP ${resp.status}). Tente novamente.`,
      };
    }

    try {
      webhookData = JSON.parse(corpoTexto);
    } catch {
      console.error(
        `[submitInscricao] Webhook respondeu 200 mas não é JSON válido. URL: ${webhookUrl}. Corpo: ${corpoTexto.slice(0, 500)}`,
      );
      await admin
        .from("inscricoes")
        .update({ status_pagamento: "cancelado" })
        .eq("id", inscricao.id);
      return {
        ok: false,
        error:
          "O servidor de pagamento respondeu num formato inesperado. Verifique se o workflow do n8n termina com um node 'Respond to Webhook'.",
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[submitInscricao] Falha de conexão com webhook n8n. URL: ${webhookUrl}. Erro: ${msg}`,
    );
    await admin
      .from("inscricoes")
      .update({ status_pagamento: "cancelado" })
      .eq("id", inscricao.id);
    return {
      ok: false,
      error: `Não foi possível conectar ao servidor de pagamento (${msg}). Tente novamente.`,
    };
  }

  if (webhookData.success === false) {
    await admin
      .from("inscricoes")
      .update({ status_pagamento: "cancelado" })
      .eq("id", inscricao.id);
    return {
      ok: false,
      error: webhookData.message ?? "O servidor recusou a inscrição.",
    };
  }

  const paymentUrl = webhookData.paymentUrl;
  if (!paymentUrl) {
    return {
      ok: false,
      error:
        "Link de pagamento não foi retornado pelo servidor. Entre em contato com a secretaria.",
    };
  }

  // 5. Atualiza inscrição com payment_url + asaas id
  await admin
    .from("inscricoes")
    .update({
      payment_url: paymentUrl,
      asaas_payment_id:
        webhookData.asaasPaymentId ?? webhookData.paymentId ?? null,
      asaas_customer_id: webhookData.asaasCustomerId ?? null,
    })
    .eq("id", inscricao.id);

  await logInscricao({
    inscricaoId: inscricao.id,
    etapa: "inscricao_criada",
    sucesso: true,
    mensagem: `Inscrição criada e cobrança gerada (${d.metodo_pagamento.toUpperCase()})`,
    detalhe: {
      valor_total: valorTotal,
      metodo: d.metodo_pagamento,
      parcelas: d.parcelas,
      asaasPaymentId: webhookData.asaasPaymentId ?? webhookData.paymentId ?? null,
    },
    origem: "site",
  });

  return {
    ok: true,
    paymentUrl,
    inscricaoId: inscricao.id,
  };
}
