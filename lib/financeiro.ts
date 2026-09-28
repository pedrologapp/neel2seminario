import "server-only";
import { conferirAsaas, type PagamentoAsaas } from "@/lib/asaas-conferencia";

/**
 * Financeiro do NEEL (28/09/2026). SÓ LEITURA.
 *
 * Conta do NEEL: o extrato do Asaas (/financialTransactions) traz TUDO o que
 * mexeu no saldo — recebimentos, taxas, saques/transferências, antecipações —
 * e o saldo depois de cada movimento. É dele que sai o "entrou × saiu".
 *
 * Conta da Escola: de 08/09 a 28/09 as inscrições do seminário caíram lá por
 * engano. Desse período só contam as cobranças do NEEL (conferirAsaas), e o
 * total é o que a escola tem a repassar ao NEEL.
 */

const API = "https://www.asaas.com/api/v3";
export const INICIO_EXTRATO = "2025-01-01";

export type Categoria = "recebido" | "taxa" | "retirada" | "outro";

export interface Movimento {
  id: string;
  data: string; // AAAA-MM-DD
  valor: number; // + entrou, − saiu
  saldo: number; // saldo da conta depois do movimento
  tipo: string;
  categoria: Categoria;
  descricao: string;
}

/** Recebimento, taxa (qualquer *_FEE), retirada (transferência/saque/pagamento de conta) ou outro. */
export function categoria(tipo: string, valor: number): Categoria {
  if (tipo === "PAYMENT_RECEIVED") return "recebido";
  if (tipo.endsWith("_FEE")) return "taxa";
  if (/TRANSFER|PIX_TRANSACTION_DEBIT|BILL_PAYMENT|DEBIT_CARD/.test(tipo) && valor < 0) return "retirada";
  return "outro";
}

export const ROTULO_TIPO: Record<string, string> = {
  PAYMENT_RECEIVED: "Recebimento",
  PAYMENT_FEE: "Taxa do pagamento",
  PAYMENT_MESSAGING_NOTIFICATION_FEE: "Taxa de notificação",
  INSTANT_TEXT_MESSAGE_FEE: "Taxa de mensagem",
  TRANSFER: "Transferência (saque)",
  TRANSFER_FEE: "Taxa de transferência",
  TRANSFER_REVERSAL: "Transferência devolvida",
  RECEIVABLE_ANTICIPATION_GROSS_CREDIT: "Antecipação (crédito)",
  RECEIVABLE_ANTICIPATION_DEBIT: "Antecipação (desconto)",
  RECEIVABLE_ANTICIPATION_FEE: "Taxa de antecipação",
  PAYMENT_REVERSAL: "Estorno",
  PAYMENT_REFUND_CANCELLED: "Estorno cancelado",
  CHARGEBACK: "Contestação",
};

interface Bruto {
  id: string;
  value: number;
  balance: number;
  type: string;
  date: string;
  description?: string | null;
}

async function pegar<T>(caminho: string, chave: string, fresco: boolean): Promise<T> {
  const r = await fetch(`${API}${caminho}`, {
    headers: { access_token: chave, "User-Agent": "neel-admin" },
    ...(fresco ? { cache: "no-store" as const } : { next: { revalidate: 600 } }),
  });
  if (!r.ok) throw new Error(`Asaas respondeu ${r.status}`);
  return (await r.json()) as T;
}

export interface Financeiro {
  ok: boolean;
  erro?: string;
  saldoAtual: number | null;
  movimentos: Movimento[]; // mais novo primeiro
  escola: { pagamentos: PagamentoAsaas[]; total: number; ok: boolean; erro?: string };
}

export async function carregarFinanceiro(fresco = false): Promise<Financeiro> {
  const chave = process.env.ASAAS_API_KEY_NEEL;
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });

  // Conta da escola: só as cobranças do NEEL (mesma regra dos Recebimentos Asaas).
  let escola: Financeiro["escola"] = { pagamentos: [], total: 0, ok: false };
  try {
    const c = await conferirAsaas(fresco);
    const e = c.contas.find((x) => x.conta === "escola");
    const pagamentos = c.pagamentos.filter((p) => p.conta === "escola");
    escola = { pagamentos, total: pagamentos.reduce((s, p) => s + p.valor, 0), ok: !!e?.ok, erro: e?.erro };
  } catch (e) {
    escola = { pagamentos: [], total: 0, ok: false, erro: (e as Error).message };
  }

  if (!chave) return { ok: false, erro: "ASAAS_API_KEY_NEEL não configurada na Vercel.", saldoAtual: null, movimentos: [], escola };
  try {
    const [saldo, movimentos] = await Promise.all([
      pegar<{ balance: number }>("/finance/balance", chave, fresco),
      (async () => {
        const todos: Bruto[] = [];
        for (let offset = 0; offset < 20000; offset += 100) {
          const j = await pegar<{ data: Bruto[]; hasMore: boolean }>(
            `/financialTransactions?startDate=${INICIO_EXTRATO}&finishDate=${hoje}&limit=100&offset=${offset}`,
            chave,
            fresco,
          );
          todos.push(...j.data);
          if (!j.hasMore) break;
        }
        return todos;
      })(),
    ]);
    const lista: Movimento[] = movimentos
      .map((m) => ({
        id: m.id,
        data: String(m.date).slice(0, 10),
        valor: m.value,
        saldo: m.balance,
        tipo: m.type,
        categoria: categoria(m.type, m.value),
        descricao: m.description ?? "",
      }))
      .sort((a, b) => b.data.localeCompare(a.data));
    return { ok: true, saldoAtual: saldo.balance, movimentos: lista, escola };
  } catch (e) {
    return { ok: false, erro: (e as Error).message, saldoAtual: null, movimentos: [], escola };
  }
}

export interface ResumoPeriodo {
  recebido: number;
  taxas: number; // negativo
  retirado: number; // negativo
  outros: number;
  saldoFinal: number | null;
  n: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Soma por categoria; saldoFinal = saldo depois do último movimento do período. */
export function resumir(movs: Movimento[]): ResumoPeriodo {
  const r: ResumoPeriodo = { recebido: 0, taxas: 0, retirado: 0, outros: 0, saldoFinal: null, n: movs.length };
  for (const m of movs) {
    if (m.categoria === "recebido") r.recebido += m.valor;
    else if (m.categoria === "taxa") r.taxas += m.valor;
    else if (m.categoria === "retirada") r.retirado += m.valor;
    else r.outros += m.valor;
  }
  // movs vem do mais novo para o mais antigo: o primeiro é o último do período.
  r.saldoFinal = movs.length ? movs[0].saldo : null;
  return { ...r, recebido: r2(r.recebido), taxas: r2(r.taxas), retirado: r2(r.retirado), outros: r2(r.outros) };
}

/** Meses (AAAA-MM) do mais novo para o mais antigo, com o resumo de cada um. */
export function porMes(movs: Movimento[]) {
  const grupos = new Map<string, Movimento[]>();
  for (const m of movs) {
    const k = m.data.slice(0, 7);
    grupos.set(k, [...(grupos.get(k) ?? []), m]);
  }
  return [...grupos.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([mes, l]) => ({ mes, movimentos: l, ...resumir(l) }));
}
