import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Clock, Landmark, Percent, RefreshCw, School } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ValorSensivel } from "@/components/admin/valores-sensiveis";
import { EVENTO, carregarFinanceiro, pagante, porMes, somar } from "@/lib/financeiro";

/**
 * Financeiro do 2º Seminário: o que entrou (bruto, taxas, líquido) nas duas
 * contas do Asaas, mês a mês, e as retiradas da conta do NEEL desde o início
 * das vendas. Só leitura: nada aqui altera o Asaas.
 */
export const metadata = { title: "Financeiro · Admin NEEL" };
export const dynamic = "force-dynamic";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}` : m);
const data = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const R = ({ v }: { v: number }) => <ValorSensivel valor={formatCurrency(v)} />;
const FORMA: Record<string, string> = { PIX: "Pix", CREDIT_CARD: "Cartão", BOLETO: "Boleto", UNDEFINED: "—" };

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ fresco?: string }> }) {
  const { fresco } = await searchParams;
  const f = await carregarFinanceiro(fresco === "1");
  const recebidos = f.pagamentos.filter((p) => p.recebidoEm);
  const aCair = f.pagamentos.filter((p) => !p.recebidoEm);
  const tot = somar(recebidos);
  const tCair = somar(aCair);
  const naEscola = somar(f.pagamentos.filter((p) => p.conta === "escola"));
  const naNeel = somar(recebidos.filter((p) => p.conta === "neel"));
  const retirado = f.retiradas.reduce((s, r) => s + r.valor, 0);
  const meses = porMes(f.pagamentos);
  const lista = [...f.pagamentos].sort((a, b) => (b.recebidoEm ?? b.previstoEm ?? "").localeCompare(a.recebidoEm ?? a.previstoEm ?? ""));

  return (
    <div className="container mx-auto px-4 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{EVENTO}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">Financeiro</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Tudo o que entrou do seminário nas duas contas do Asaas (a do NEEL e a da Escola, de 08/09 a 28/09), as taxas e o que foi retirado. Só leitura: nada aqui mexe no Asaas.
          </p>
        </div>
        <Link href="/admin/financeiro?fresco=1" className="inline-flex items-center gap-2 self-start rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-neel-blue hover:bg-neel-blue-50">
          <RefreshCw className="size-4" /> Atualizar agora
        </Link>
      </header>

      {(f.contas.some((c) => !c.ok) || f.erroExtrato) && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {f.contas.filter((c) => !c.ok).map((c) => <p key={c.conta}><b>{c.rotulo}:</b> {c.erro}</p>)}
          {f.erroExtrato && <p><b>Extrato da conta do NEEL:</b> {f.erroExtrato}</p>}
        </div>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-neel-blue p-4 text-white">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest opacity-80"><ArrowDownLeft className="size-3.5" /> Entrou do seminário</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums"><R v={tot.bruto} /></p>
          <p className="text-xs opacity-80">{tot.n} pagamento(s) recebido(s), nas duas contas</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Percent className="size-3.5" /> Taxas do Asaas</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-amber-700"><R v={tot.taxas} /></p>
          <p className="text-xs text-muted-foreground">Líquido: <b><R v={tot.liquido} /></b></p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Clock className="size-3.5" /> A cair (cartão)</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-neel-blue"><R v={tCair.bruto} /></p>
          <p className="text-xs text-muted-foreground">{tCair.n} parcela(s) aprovada(s), ainda não creditada(s)</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><ArrowUpRight className="size-3.5" /> Retirado da conta do NEEL</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-red-700"><R v={retirado} /></p>
          <p className="text-xs text-muted-foreground">
            Desde {data(f.inicio)} · saldo hoje {f.saldoAtual !== null ? <R v={f.saldoAtual} /> : "—"}
          </p>
        </div>
      </section>

      {/* Onde está o dinheiro */}
      <section className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-white p-4">
          <p className="flex items-center gap-2 font-bold text-neel-blue"><Landmark className="size-4" /> Na conta do NEEL</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Recebido: <b className="text-foreground"><R v={naNeel.bruto} /></b> · líquido <R v={naNeel.liquido} /> ({naNeel.n} pagamento(s))
          </p>
        </div>
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 font-bold text-amber-900"><School className="size-4" /> Na conta da Escola Amadeus (08/09 a 28/09)</p>
          <p className="mt-1 text-sm text-amber-900">
            <b><R v={naEscola.bruto} /></b> · líquido <R v={naEscola.liquido} /> ({naEscola.n} pagamento(s)). É o valor a acertar entre a escola e o NEEL.
          </p>
        </div>
      </section>

      {/* Mês a mês */}
      <section className="mt-8">
        <h2 className="text-lg font-extrabold text-neel-blue">Mês a mês</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-white">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Mês</th>
                <th className="px-4 py-2 text-right">Pagamentos</th>
                <th className="px-4 py-2 text-right">Bruto</th>
                <th className="px-4 py-2 text-right">Taxas</th>
                <th className="px-4 py-2 text-right">Líquido</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes} className="border-b last:border-0">
                  <td className="px-4 py-2 font-semibold capitalize">{nomeMes(m.mes)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.n}</td>
                  <td className="px-4 py-2 text-right tabular-nums"><R v={m.bruto} /></td>
                  <td className="px-4 py-2 text-right tabular-nums text-amber-700"><R v={m.taxas} /></td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-emerald-700"><R v={m.liquido} /></td>
                </tr>
              ))}
              {meses.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhum pagamento do seminário ainda.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Parcelas de cartão ainda a cair entram no mês em que o Asaas prevê o crédito.</p>
      </section>

      {/* Retiradas */}
      <section className="mt-8">
        <h2 className="text-lg font-extrabold text-neel-blue">Retiradas da conta do NEEL</h2>
        <p className="mt-1 text-sm text-muted-foreground">Transferências feitas desde o primeiro pagamento do seminário. A conta é a mesma dos outros eventos do NEEL.</p>
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
              {f.retiradas.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-2 tabular-nums">{data(r.data)}</td>
                  <td className="px-4 py-2">{r.descricao || "Transferência"}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-red-700"><R v={r.valor} /></td>
                </tr>
              ))}
              {f.retiradas.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Nenhuma retirada no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pagamentos */}
      <section className="mt-8">
        <h2 className="text-lg font-extrabold text-neel-blue">Pagamentos do seminário</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Quem pagou</th>
                <th className="px-4 py-2">Forma</th>
                <th className="px-4 py-2">Conta</th>
                <th className="px-4 py-2 text-right">Bruto</th>
                <th className="px-4 py-2 text-right">Líquido</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-2 tabular-nums">
                    {data(p.recebidoEm ?? p.previstoEm)}
                    {!p.recebidoEm && <span className="ml-1 rounded bg-neel-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-neel-blue">a cair</span>}
                  </td>
                  <td className="px-4 py-2">
                    {pagante(p.descricao)}
                    {p.parcela ? <span className="text-xs text-muted-foreground"> · parcela {p.parcela}</span> : null}
                  </td>
                  <td className="px-4 py-2">{FORMA[p.forma ?? "UNDEFINED"] ?? p.forma}</td>
                  <td className="px-4 py-2">{p.conta === "escola" ? <span className="font-semibold text-amber-800">Escola</span> : "NEEL"}</td>
                  <td className="px-4 py-2 text-right tabular-nums"><R v={p.valor} /></td>
                  <td className="px-4 py-2 text-right tabular-nums"><R v={p.liquido} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
