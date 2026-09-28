import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Landmark, Percent, RefreshCw, School } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ValorSensivel } from "@/components/admin/valores-sensiveis";
import { ROTULO_TIPO, carregarFinanceiro, porMes, resumir, type Categoria } from "@/lib/financeiro";

/**
 * Financeiro do NEEL: quanto entrou, quanto foi de taxa e quanto foi retirado
 * da conta do Asaas, mês a mês, e o acerto com a conta da Escola (08–28/09).
 * Só leitura: nada aqui altera o Asaas.
 */
export const metadata = { title: "Financeiro · Admin NEEL" };
export const dynamic = "force-dynamic";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
const data = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const R = ({ v }: { v: number }) => <ValorSensivel valor={formatCurrency(v)} />;
const COR: Record<Categoria, string> = {
  recebido: "text-emerald-700",
  taxa: "text-amber-700",
  retirada: "text-red-700",
  outro: "text-muted-foreground",
};

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ ano?: string; fresco?: string }> }) {
  const { ano: anoParam, fresco } = await searchParams;
  const f = await carregarFinanceiro(fresco === "1");
  const anos = [...new Set(f.movimentos.map((m) => m.data.slice(0, 4)))].sort().reverse();
  const anoAtual = new Date().getFullYear().toString();
  const ano = anoParam === "tudo" ? "tudo" : anoParam && anos.includes(anoParam) ? anoParam : anos.includes(anoAtual) ? anoAtual : anos[0] ?? anoAtual;
  const movs = ano === "tudo" ? f.movimentos : f.movimentos.filter((m) => m.data.startsWith(ano));
  const total = resumir(movs);
  const meses = porMes(movs);
  const retiradas = movs.filter((m) => m.categoria === "retirada");
  const liquido = total.recebido + total.taxas + total.outros;

  const aba = (v: string, t: string) => (
    <Link
      key={v}
      href={`/admin/financeiro?ano=${v}`}
      className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${ano === v ? "bg-neel-blue text-white" : "bg-neel-blue-50 text-neel-blue hover:bg-neel-blue-50/70"}`}
    >
      {t}
    </Link>
  );

  return (
    <div className="container mx-auto px-4 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">Financeiro</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            O que entrou, o que foi de taxa e o que foi retirado da conta do NEEL no Asaas, mês a mês. Só leitura: nada aqui mexe no Asaas.
          </p>
        </div>
        <Link href={`/admin/financeiro?ano=${ano}&fresco=1`} className="inline-flex items-center gap-2 self-start rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-neel-blue hover:bg-neel-blue-50">
          <RefreshCw className="size-4" /> Atualizar agora
        </Link>
      </header>

      {!f.ok && (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Não consegui ler o extrato da conta do NEEL: {f.erro}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {anos.map((a) => aba(a, a))}
        {anos.length > 1 && aba("tudo", "Tudo")}
      </div>

      {/* Resumo do período */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-neel-blue p-4 text-white">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest opacity-80"><Landmark className="size-3.5" /> Saldo hoje na conta</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{f.saldoAtual !== null ? <R v={f.saldoAtual} /> : "—"}</p>
          <p className="text-xs opacity-80">Conta do NEEL no Asaas</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><ArrowDownLeft className="size-3.5" /> Entrou {ano === "tudo" ? "" : `em ${ano}`}</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-700"><R v={total.recebido} /></p>
          <p className="text-xs text-muted-foreground">Recebimentos (Pix, cartão, boleto)</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Percent className="size-3.5" /> Taxas do Asaas</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-amber-700"><R v={-total.taxas} /></p>
          <p className="text-xs text-muted-foreground">Líquido depois das taxas: <R v={liquido} /></p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><ArrowUpRight className="size-3.5" /> Retirado</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-red-700"><R v={-total.retirado} /></p>
          <p className="text-xs text-muted-foreground">{retiradas.length} transferência(s) para fora da conta</p>
        </div>
      </section>

      {/* Acerto com a Escola */}
      <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <p className="flex items-center gap-2 font-bold text-amber-900"><School className="size-4" /> Na conta da Escola Amadeus (08/09 a 28/09)</p>
        {f.escola.ok ? (
          <>
            <p className="mt-1 text-sm text-amber-900">
              {f.escola.pagamentos.length} pagamento(s) do seminário caíram na conta da escola, somando <b className="tabular-nums"><R v={f.escola.total} /></b>. É o valor a acertar entre a escola e o NEEL (antes das taxas do Asaas).
            </p>
            {f.escola.pagamentos.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-semibold text-amber-900">Ver os pagamentos</summary>
                <ul className="mt-2 space-y-1">
                  {[...f.escola.pagamentos].sort((a, b) => (a.recebidoEm ?? a.previstoEm ?? "").localeCompare(b.recebidoEm ?? b.previstoEm ?? "")).map((p) => (
                    <li key={p.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white px-3 py-1.5">
                      <span>{data(p.recebidoEm ?? p.previstoEm)} · {p.descricao ?? "—"}{p.recebidoEm ? "" : " · a cair (cartão)"}</span>
                      <span className="font-semibold tabular-nums"><R v={p.valor} /></span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-amber-900">Não consegui ler a conta da escola: {f.escola.erro ?? "sem acesso"}.</p>
        )}
      </section>

      {/* Mês a mês */}
      <section className="mt-8">
        <h2 className="text-lg font-extrabold text-neel-blue">Mês a mês</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Mês</th>
                <th className="px-4 py-2 text-right">Entrou</th>
                <th className="px-4 py-2 text-right">Taxas</th>
                <th className="px-4 py-2 text-right">Retirado</th>
                <th className="px-4 py-2 text-right">Outros</th>
                <th className="px-4 py-2 text-right">Saldo no fim do mês</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes} className="border-b last:border-0">
                  <td className="px-4 py-2 font-semibold capitalize">{nomeMes(m.mes)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{m.recebido ? <R v={m.recebido} /> : "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-amber-700">{m.taxas ? <R v={-m.taxas} /> : "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-700">{m.retirado ? <R v={-m.retirado} /> : "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{m.outros ? <R v={m.outros} /> : "—"}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{m.saldoFinal !== null ? <R v={m.saldoFinal} /> : "—"}</td>
                </tr>
              ))}
              {meses.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Nenhum movimento no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">&quot;Outros&quot; são antecipações de recebíveis e estornos. Taxas incluem a do pagamento, notificações e mensagens do Asaas.</p>
      </section>

      {/* Retiradas */}
      <section className="mt-8">
        <h2 className="text-lg font-extrabold text-neel-blue">Retiradas</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Descrição no Asaas</th>
                <th className="px-4 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {retiradas.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-4 py-2 tabular-nums">{data(m.data)}</td>
                  <td className="px-4 py-2">{m.descricao || ROTULO_TIPO[m.tipo] || m.tipo}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-red-700"><R v={-m.valor} /></td>
                </tr>
              ))}
              {retiradas.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Nenhuma retirada no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Extrato completo, mês por mês */}
      <section className="mt-8">
        <h2 className="text-lg font-extrabold text-neel-blue">Extrato</h2>
        <div className="mt-3 space-y-2">
          {meses.map((m) => (
            <details key={m.mes} className="rounded-2xl border border-border/60 bg-white">
              <summary className="cursor-pointer px-4 py-3 font-semibold capitalize">
                {nomeMes(m.mes)} <span className="font-normal normal-case text-muted-foreground">· {m.n} movimento(s)</span>
              </summary>
              <ul className="divide-y border-t text-sm">
                {m.movimentos.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="tabular-nums text-muted-foreground">{data(x.data)}</span>{" "}
                      <span className="font-medium">{ROTULO_TIPO[x.tipo] ?? x.tipo}</span>
                      {x.descricao && <span className="block truncate text-xs text-muted-foreground">{x.descricao}</span>}
                    </span>
                    <span className={`font-semibold tabular-nums ${COR[x.categoria]}`}>
                      {x.valor > 0 ? "+ " : "− "}<R v={Math.abs(x.valor)} />
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
