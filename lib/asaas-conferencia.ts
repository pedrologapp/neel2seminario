import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Conferência com o Asaas (28/09/2026). SÓ LEITURA: nada cria, altera ou
 * cancela cobrança e nada muda o status da inscrição (quem marca "pago" e
 * manda QR/confirmação é o fluxo do n8n).
 *
 * Duas contas:
 * - NEEL (ASAAS_API_KEY_NEEL): a conta do NEEL, principal de novo desde 28/09.
 * - Escola (ASAAS_API_KEY_ESCOLA): de 08/09 a 28/09 as inscrições do seminário
 *   foram cobradas por engano na conta da Escola Amadeus. Dela só entram
 *   cobranças cuja referência é uma inscrição/cobrança do NEEL — o resto da
 *   conta é da escola e não aparece aqui.
 */

const API = "https://www.asaas.com/api/v3";
const INICIO = "2026-01-01";
const STATUS_PAGO = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

export type Conta = "neel" | "escola";
export const CONTAS: { conta: Conta; rotulo: string; env: string }[] = [
  { conta: "neel", rotulo: "Conta do NEEL", env: "ASAAS_API_KEY_NEEL" },
  { conta: "escola", rotulo: "Conta da Escola Amadeus", env: "ASAAS_API_KEY_ESCOLA" },
];

export interface PagamentoAsaas {
  id: string;
  conta: Conta;
  status: string; // RECEIVED = entrou na conta; CONFIRMED = cartão aprovado, a cair
  valor: number;
  recebidoEm: string | null;
  previstoEm: string | null;
  forma: string | null;
  descricao: string | null;
  referencia: string | null;
  parcela: number | null;
}

interface Bruto {
  id: string;
  value: number;
  status: string;
  billingType?: string;
  description?: string | null;
  externalReference?: string | null;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
  estimatedCreditDate?: string | null;
  installmentNumber?: number | null;
}

async function listar(filtro: string, chave: string, fresco: boolean): Promise<Bruto[]> {
  const todos: Bruto[] = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const r = await fetch(`${API}/payments?${filtro}&limit=100&offset=${offset}`, {
      headers: { access_token: chave, "User-Agent": "neel-admin" },
      // 10 minutos de cache; "Atualizar agora" pede sem cache.
      ...(fresco ? { cache: "no-store" as const } : { next: { revalidate: 600 } }),
    });
    if (!r.ok) throw new Error(`Asaas respondeu ${r.status}`);
    const j = (await r.json()) as { data: Bruto[]; hasMore: boolean };
    todos.push(...j.data);
    if (!j.hasMore) break;
  }
  return todos;
}

export interface Conferencia {
  pagamentos: PagamentoAsaas[];
  contas: { conta: Conta; rotulo: string; ok: boolean; erro?: string }[];
}

export async function conferirAsaas(fresco = false): Promise<Conferencia> {
  const db = createAdminClient();
  const [{ data: insc }, { data: cobs }] = await Promise.all([
    db.from("inscricoes").select("id"),
    db.from("cobrancas_avulsas").select("id"),
  ]);
  const nossas = new Set<string>([
    ...(insc ?? []).map((i) => i.id as string),
    ...(cobs ?? []).map((c) => `avulsa_${c.id as string}`),
  ]);

  const pagamentos: PagamentoAsaas[] = [];
  const contas: Conferencia["contas"] = [];
  for (const c of CONTAS) {
    const chave = process.env[c.env];
    if (!chave) {
      contas.push({ conta: c.conta, rotulo: c.rotulo, ok: false, erro: `${c.env} não configurada na Vercel` });
      continue;
    }
    try {
      const brutos = (
        await Promise.all(STATUS_PAGO.map((st) => listar(`status=${st}&dateCreated[ge]=${INICIO}`, chave, fresco)))
      ).flat();
      for (const p of brutos) {
        const ref = p.externalReference ?? null;
        // Da conta da escola, só o que é do NEEL.
        if (c.conta === "escola" && !(ref && nossas.has(ref))) continue;
        pagamentos.push({
          id: p.id,
          conta: c.conta,
          status: p.status,
          valor: p.value,
          recebidoEm: p.status === "CONFIRMED" ? null : (p.paymentDate ?? p.clientPaymentDate ?? null)?.slice(0, 10) ?? null,
          previstoEm: p.status === "CONFIRMED" ? (p.estimatedCreditDate ?? p.confirmedDate ?? null)?.slice(0, 10) ?? null : null,
          forma: p.billingType ?? null,
          descricao: p.description ?? null,
          referencia: ref,
          parcela: p.installmentNumber ?? null,
        });
      }
      contas.push({ conta: c.conta, rotulo: c.rotulo, ok: true });
    } catch (e) {
      contas.push({ conta: c.conta, rotulo: c.rotulo, ok: false, erro: (e as Error).message });
    }
  }
  return { pagamentos, contas };
}

/** Inscrições com pagamento no Asaas (qualquer conta) → conta e total pago/aprovado. */
export function pagasNoAsaas(pagamentos: PagamentoAsaas[]) {
  const mapa = new Map<string, { conta: Conta; valor: number; parcelas: number; naConta: number }>();
  for (const p of pagamentos) {
    if (!p.referencia) continue;
    const atual = mapa.get(p.referencia) ?? { conta: p.conta, valor: 0, parcelas: 0, naConta: 0 };
    atual.valor += p.valor;
    atual.parcelas += 1;
    if (p.recebidoEm) atual.naConta += p.valor;
    mapa.set(p.referencia, atual);
  }
  return mapa;
}
