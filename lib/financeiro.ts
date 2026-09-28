import "server-only";
import { conferirAsaas, type PagamentoAsaas } from "@/lib/asaas-conferencia";

/**
 * Financeiro do 2º Seminário Espírita do NEEL (28/09/2026). SÓ LEITURA.
 *
 * Entradas: as cobranças do Asaas cuja descrição é do "2º Seminário" (inclui
 * as parcelas de cartão), nas DUAS contas — a do NEEL e a da Escola Amadeus,
 * onde as inscrições caíram por engano de 08/09 a 28/09. A descrição separa
 * do 1º Seminário (2025) e do Chocolate Musical.
 *
 * Retiradas: a conta do NEEL é uma só para todos os eventos, então o extrato
 * (/financialTransactions) mostra as transferências feitas desde o primeiro
 * pagamento do seminário, junto com o saldo de hoje.
 */

const API = "https://www.asaas.com/api/v3";
export const EVENTO = "2º Seminário Espírita do NEEL";
const DO_EVENTO = /\b2\s*[ºo°]\s*semin[aá]rio/i;
// Pagamentos de teste do Pedro (abril e junho): ficam fora dos totais e aparecem à parte.
const TESTE = /pedro luciano/i;

export interface Retirada {
  id: string;
  data: string;
  valor: number; // positivo
  descricao: string;
}

export interface FinanceiroEvento {
  pagamentos: PagamentoAsaas[]; // só do evento, nas duas contas, sem os testes
  testes: PagamentoAsaas[];
  contas: { conta: string; rotulo: string; ok: boolean; erro?: string }[];
  inicio: string | null; // primeiro pagamento do evento
  saldoAtual: number | null;
  retiradas: Retirada[];
  erroExtrato?: string;
}

async function pegar<T>(caminho: string, chave: string, fresco: boolean): Promise<T> {
  const r = await fetch(`${API}${caminho}`, {
    headers: { access_token: chave, "User-Agent": "neel-admin" },
    ...(fresco ? { cache: "no-store" as const } : { next: { revalidate: 600 } }),
  });
  if (!r.ok) throw new Error(`Asaas respondeu ${r.status}`);
  return (await r.json()) as T;
}

/** Nome de quem pagou, tirado da descrição ("Parcela 2 de 3. 2º Seminário Espírita do NEEL - Fulana"). */
export function pagante(descricao: string | null) {
  const d = descricao ?? "";
  const m = d.match(/NEEL\s*[-—]\s*(.+?)(\s*\(\d+ ingress\w*\))?\s*$/i);
  return (m?.[1] ?? d).trim();
}

export async function carregarFinanceiro(fresco = false): Promise<FinanceiroEvento> {
  const c = await conferirAsaas(fresco);
  const doEvento = c.pagamentos.filter((p) => DO_EVENTO.test(p.descricao ?? ""));
  const testes = doEvento.filter((p) => TESTE.test(p.descricao ?? ""));
  const pagamentos = doEvento.filter((p) => !TESTE.test(p.descricao ?? ""));
  const datas = pagamentos.map((p) => p.recebidoEm ?? p.previstoEm).filter(Boolean) as string[];
  const inicio = datas.length ? datas.sort()[0] : null;

  const base: FinanceiroEvento = { pagamentos, testes, contas: c.contas, inicio, saldoAtual: null, retiradas: [] };
  const chave = process.env.ASAAS_API_KEY_NEEL;
  if (!chave) return { ...base, erroExtrato: "ASAAS_API_KEY_NEEL não configurada na Vercel." };
  try {
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
    const desde = inicio ?? `${hoje.slice(0, 4)}-01-01`;
    const [saldo, mov] = await Promise.all([
      pegar<{ balance: number }>("/finance/balance", chave, fresco),
      (async () => {
        const todos: { id: string; value: number; type: string; date: string; description?: string | null }[] = [];
        for (let offset = 0; offset < 20000; offset += 100) {
          const j = await pegar<{ data: typeof todos; hasMore: boolean }>(
            `/financialTransactions?startDate=${desde}&finishDate=${hoje}&limit=100&offset=${offset}`,
            chave,
            fresco,
          );
          todos.push(...j.data);
          if (!j.hasMore) break;
        }
        return todos;
      })(),
    ]);
    const retiradas = mov
      .filter((m) => m.value < 0 && /TRANSFER|PIX_TRANSACTION_DEBIT|BILL_PAYMENT/.test(m.type) && !m.type.endsWith("_FEE"))
      .map((m) => ({ id: m.id, data: String(m.date).slice(0, 10), valor: -m.value, descricao: m.description ?? "" }))
      .sort((a, b) => b.data.localeCompare(a.data));
    return { ...base, saldoAtual: saldo.balance, retiradas };
  } catch (e) {
    return { ...base, erroExtrato: (e as Error).message };
  }
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function somar(l: PagamentoAsaas[]) {
  const bruto = r2(l.reduce((s, p) => s + p.valor, 0));
  const liquido = r2(l.reduce((s, p) => s + p.liquido, 0));
  return { bruto, liquido, taxas: r2(bruto - liquido), n: l.length };
}

/** Por mês de recebimento (as parcelas de cartão ainda a cair entram no mês previsto). */
export function porMes(l: PagamentoAsaas[]) {
  const grupos = new Map<string, PagamentoAsaas[]>();
  for (const p of l) {
    const k = (p.recebidoEm ?? p.previstoEm ?? "").slice(0, 7) || "sem data";
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  return [...grupos.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([mes, ps]) => ({ mes, pagamentos: ps, ...somar(ps) }));
}
