import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { conferirAsaas, type Conta, type PagamentoAsaas } from "@/lib/asaas-conferencia";
import { logInscricao } from "@/lib/log-inscricao";

/**
 * Pagos sem ingresso (29/10/2026, Pedro: "no Amadeus ele consegue puxar do Asaas e verificar
 * automaticamente; faça isso com o NEEL e envie para quem não foi enviado").
 *
 * - pagosSemIngresso: cruza o Asaas (as duas contas) com as inscrições e devolve quem PAGOU no Asaas
 *   e não recebeu a confirmação/QR (inscrição pendente/cancelada aqui, ou paga sem QR enviado).
 *   Só leitura.
 * - enviarIngresso: só com autorização do Pedro. Refaz a conferência e, se a pessoa continua paga
 *   sem ingresso, avisa o fluxo de notificação do n8n do mesmo jeito que o Asaas avisaria
 *   (PAYMENT_RECEIVED/CONFIRMED com a cobrança de verdade). O n8n marca "pago", gera os ingressos
 *   e manda a capa + o PDF no WhatsApp. Nada muda no n8n nem no Asaas.
 */

export interface PagoSemIngresso {
  inscricaoId: string;
  nome: string;
  telefone: string;
  evento: string | null;
  eventoId: string;
  statusSistema: string;
  valorSistema: number;
  criadaEm: string;
  conta: Conta;
  pagamento: { id: string; status: string; forma: string | null; valor: number; parcela: number | null; recebidoEm: string | null };
  confirmacaoEnviadaEm: string | null;
  qrcodeEnviadoEm: string | null;
  /** O que falta: o sistema não sabe que pagou, ou sabe mas o QR não saiu. */
  motivo: "nao_marcado" | "sem_qr";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A cobrança que o n8n aceita: a 1ª parcela (cartão parcelado) ou a única. */
function cobrancaPrincipal(l: PagamentoAsaas[]) {
  return [...l].sort((a, b) => (a.parcela ?? 1) - (b.parcela ?? 1))[0];
}

export async function pagosSemIngresso(opts: { eventoId?: string; fresco?: boolean } = {}): Promise<{
  lista: PagoSemIngresso[];
  contas: { conta: Conta; rotulo: string; ok: boolean; erro?: string }[];
}> {
  const { pagamentos, contas } = await conferirAsaas(opts.fresco ?? true);
  const porInscricao = new Map<string, PagamentoAsaas[]>();
  for (const p of pagamentos) {
    if (!p.referencia || !UUID.test(p.referencia)) continue;
    porInscricao.set(p.referencia, [...(porInscricao.get(p.referencia) ?? []), p]);
  }
  const ids = [...porInscricao.keys()];
  if (!ids.length) return { lista: [], contas };

  const db = createAdminClient();
  let q = db
    .from("inscricoes")
    .select("id, evento_id, responsavel_nome, telefone, valor_total, status_pagamento, created_at, confirmacao_enviada_em, qrcode_enviado_em, evento:eventos(nome)")
    .in("id", ids);
  if (opts.eventoId) q = q.eq("evento_id", opts.eventoId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const lista: PagoSemIngresso[] = [];
  for (const i of data ?? []) {
    const naoMarcado = i.status_pagamento !== "pago";
    if (!naoMarcado && i.qrcode_enviado_em) continue;
    const p = cobrancaPrincipal(porInscricao.get(i.id as string)!);
    lista.push({
      inscricaoId: i.id as string,
      nome: i.responsavel_nome as string,
      telefone: i.telefone as string,
      evento: (i.evento as unknown as { nome: string } | null)?.nome ?? null,
      eventoId: i.evento_id as string,
      statusSistema: i.status_pagamento as string,
      valorSistema: Number(i.valor_total ?? 0),
      criadaEm: i.created_at as string,
      conta: p.conta,
      pagamento: { id: p.id, status: p.status, forma: p.forma, valor: p.valor, parcela: p.parcela, recebidoEm: p.recebidoEm },
      confirmacaoEnviadaEm: (i.confirmacao_enviada_em as string | null) ?? null,
      qrcodeEnviadoEm: (i.qrcode_enviado_em as string | null) ?? null,
      motivo: naoMarcado ? "nao_marcado" : "sem_qr",
    });
  }
  lista.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  return { lista, contas };
}

export type ResultadoEnvio = { inscricaoId: string; nome: string | null; ok: boolean; erro?: string };

/** Envia a confirmação + ingressos (via fluxo de notificação do n8n) para as inscrições pedidas. */
export async function enviarIngressos(inscricaoIds: string[], quem: string): Promise<ResultadoEnvio[]> {
  const url = process.env.N8N_NOTIFICACAO_URL;
  if (!url) return inscricaoIds.map((id) => ({ inscricaoId: id, nome: null, ok: false, erro: "N8N_NOTIFICACAO_URL não configurada na Vercel." }));
  // Confere de novo, na hora: só vai para quem continua pago no Asaas e sem ingresso.
  const { lista } = await pagosSemIngresso({ fresco: true });
  const porId = new Map(lista.map((x) => [x.inscricaoId, x]));
  const res: ResultadoEnvio[] = [];
  for (const id of inscricaoIds) {
    const x = porId.get(id);
    if (!x) { res.push({ inscricaoId: id, nome: null, ok: false, erro: "Não está mais na lista (já recebeu ou não está paga no Asaas)." }); continue; }
    const confirmado = x.pagamento.status === "CONFIRMED";
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: confirmado ? "PAYMENT_CONFIRMED" : "PAYMENT_RECEIVED",
          payment: {
            id: x.pagamento.id,
            status: confirmado ? "CONFIRMED" : "RECEIVED",
            billingType: x.pagamento.forma ?? "PIX",
            value: x.pagamento.valor,
            installmentNumber: x.pagamento.parcela ?? 1,
            externalReference: x.inscricaoId,
          },
        }),
      });
      const ok = r.ok;
      await logInscricao({
        inscricaoId: id,
        etapa: "ingresso_reenviado_conferencia",
        sucesso: ok,
        mensagem: ok
          ? `Pago no Asaas (${x.conta === "escola" ? "conta Escola" : "conta NEEL"}) sem ingresso: confirmação e ingressos pedidos ao n8n por ${quem}`
          : `n8n respondeu ${r.status} ao pedir confirmação e ingressos`,
        detalhe: { asaasPaymentId: x.pagamento.id, asaasStatus: x.pagamento.status, conta: x.conta, quem },
        origem: "site",
      });
      res.push({ inscricaoId: id, nome: x.nome, ok, ...(ok ? {} : { erro: `n8n respondeu ${r.status}` }) });
    } catch (e) {
      res.push({ inscricaoId: id, nome: x.nome, ok: false, erro: (e as Error).message.slice(0, 200) });
    }
    // Um por vez, com folga, para o WhatsApp não enfileirar tudo junto.
    await new Promise((r) => setTimeout(r, 4000));
  }
  return res;
}
