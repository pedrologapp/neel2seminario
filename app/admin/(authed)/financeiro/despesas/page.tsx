import { formatCurrency } from "@/lib/utils";
import { ValorSensivel } from "@/components/admin/valores-sensiveis";
import { EVENTO, carregarFinanceiro, somar } from "@/lib/financeiro";
import { CATEGORIAS, FORMAS, lerDespesas, linksComprovantes } from "@/lib/despesas";
import { AbasFinanceiro } from "../abas";
import { PainelDespesas } from "./painel";

/**
 * Despesas do 2º Seminário e o resultado (arrecadado − gasto) para a
 * prestação de contas. As despesas são lançadas à mão, com comprovante.
 */
export const metadata = { title: "Despesas · Admin NEEL" };
export const dynamic = "force-dynamic";

const R = ({ v }: { v: number }) => <ValorSensivel valor={formatCurrency(v)} />;

export default async function DespesasPage() {
  const [f, despesas] = await Promise.all([carregarFinanceiro(), lerDespesas().catch(() => null)]);
  const recebido = somar(f.pagamentos.filter((p) => p.recebidoEm));
  const aCair = somar(f.pagamentos.filter((p) => !p.recebidoEm));
  const lista = despesas ?? [];
  const gasto = Math.round(lista.reduce((s, d) => s + d.valor, 0) * 100) / 100;
  const resultado = recebido.liquido + aCair.liquido - gasto;
  const porCategoria = CATEGORIAS.map((c) => ({ c, total: lista.filter((d) => d.categoria === c).reduce((s, d) => s + d.valor, 0), n: lista.filter((d) => d.categoria === c).length })).filter((x) => x.n > 0);
  const links = await linksComprovantes(lista.map((d) => d.comprovante).filter(Boolean) as string[]);

  return (
    <div className="container mx-auto px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{EVENTO}</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">Despesas e resultado</h1>
      <p className="mt-1 max-w-2xl text-muted-foreground">
        Lance cada gasto do seminário com o comprovante. O resultado é o que entrou (líquido, nas duas contas) menos o que foi gasto.
      </p>
      <div className="mt-4"><AbasFinanceiro atual="despesas" /></div>

      {despesas === null && (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">Não consegui ler as despesas agora. Atualize a página.</p>
      )}

      {/* Resultado */}
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Arrecadado (líquido)</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-700"><R v={recebido.liquido + aCair.liquido} /></p>
          <p className="text-xs text-muted-foreground">
            Recebido <R v={recebido.liquido} />{aCair.n > 0 && <> + a cair <R v={aCair.liquido} /></>}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Despesas</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-red-700"><R v={gasto} /></p>
          <p className="text-xs text-muted-foreground">{lista.length} lançamento(s)</p>
        </div>
        <div className={`rounded-2xl p-4 text-white ${resultado >= 0 ? "bg-neel-blue" : "bg-red-700"}`}>
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Resultado do seminário</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums"><R v={resultado} /></p>
          <p className="text-xs opacity-80">{resultado >= 0 ? "Sobra" : "Falta"} depois das despesas lançadas</p>
        </div>
      </section>

      {porCategoria.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border/60 bg-white p-4">
          <p className="text-sm font-bold text-neel-blue">Por categoria</p>
          <ul className="mt-2 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            {porCategoria.map((x) => (
              <li key={x.c} className="flex justify-between gap-3">
                <span>{x.c} <span className="text-muted-foreground">({x.n})</span></span>
                <b className="tabular-nums"><R v={x.total} /></b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PainelDespesas
        despesas={lista.map((d) => ({ ...d, link: d.comprovante ? links.get(d.comprovante) ?? null : null }))}
        categorias={[...CATEGORIAS]}
        formas={[...FORMAS]}
      />
    </div>
  );
}
