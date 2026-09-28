import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { ValorSensivel } from "@/components/admin/valores-sensiveis";
import { CONTAS, conferirAsaas, pagasNoAsaas, type Conta } from "@/lib/asaas-conferencia";
import { AbasCobrancas } from "../abas";

/**
 * Recebimentos Asaas do NEEL: o que entrou (ou foi aprovado no cartão) nas
 * DUAS contas — a do NEEL e a da Escola Amadeus (onde as inscrições do
 * seminário caíram por engano de 08/09 a 28/09). Só leitura.
 */
export const metadata = { title: "Recebimentos Asaas · Admin NEEL" };
export const dynamic = "force-dynamic";

const FORMA: Record<string, string> = { PIX: "PIX", CREDIT_CARD: "Cartão", BOLETO: "Boleto", UNDEFINED: "—" };
const ROTULO_CONTA: Record<Conta, string> = { neel: "Conta NEEL", escola: "Conta Escola" };
const data = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

export default async function RecebimentosAsaasPage({ searchParams }: { searchParams: Promise<{ fresco?: string }> }) {
  const { fresco } = await searchParams;
  const { pagamentos, contas } = await conferirAsaas(fresco === "1");
  const pagas = pagasNoAsaas(pagamentos);

  // Quem pagou no Asaas mas está pendente/cancelado aqui (não recebeu QR).
  const supabase = await createClient();
  const refs = [...pagas.keys()].filter((r) => /^[0-9a-f-]{36}$/i.test(r));
  const { data: insc } = refs.length
    ? await supabase
        .from("inscricoes")
        .select("id, responsavel_nome, telefone, valor_total, status_pagamento, metodo_pagamento, created_at, qrcode_enviado_em, evento:eventos(id, nome)")
        .in("id", refs)
    : { data: [] };
  const divergentes = (insc ?? []).filter((i) => i.status_pagamento !== "pago" || !i.qrcode_enviado_em);

  const soma = (l: { valor: number }[]) => l.reduce((s, p) => s + p.valor, 0);
  const porConta = CONTAS.map((c) => {
    const l = pagamentos.filter((p) => p.conta === c.conta);
    return { ...c, entrou: soma(l.filter((p) => p.recebidoEm)), aCair: soma(l.filter((p) => !p.recebidoEm)), n: l.length };
  });
  const lista = [...pagamentos].sort((a, b) => (b.recebidoEm ?? b.previstoEm ?? "").localeCompare(a.recebidoEm ?? a.previstoEm ?? "")).slice(0, 300);

  return (
    <div className="container mx-auto px-4 py-10">
      <AbasCobrancas atual="asaas" />
      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">Recebimentos Asaas</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Pagamentos do NEEL nas duas contas do Asaas: a do NEEL e a da Escola Amadeus (onde as inscrições caíram de 08/09 a 28/09). Só leitura: nada aqui envia mensagem ou altera o Asaas.
          </p>
        </div>
        <Link href="/admin/cobrancas/asaas?fresco=1" className="inline-flex items-center gap-2 self-start rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-neel-blue hover:bg-neel-blue-50">
          <RefreshCw className="size-4" /> Atualizar agora
        </Link>
      </header>

      {contas.some((c) => !c.ok) && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {contas.filter((c) => !c.ok).map((c) => (
            <p key={c.conta}><b>{c.rotulo}:</b> {c.erro}</p>
          ))}
        </div>
      )}

      {/* O que precisa de ação: pagou e não está confirmado aqui */}
      <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="flex items-center gap-2 font-bold text-red-800">
          <AlertTriangle className="size-4" />
          {divergentes.length === 0
            ? "Nenhuma inscrição paga no Asaas está pendente aqui."
            : `${divergentes.length} inscrição(ões) pagas no Asaas, mas sem confirmação/QR aqui`}
        </p>
        {divergentes.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-xl bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Inscrito</th>
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Situação aqui</th>
                  <th className="px-3 py-2">Pago em</th>
                  <th className="px-3 py-2 text-right">Valor no Asaas</th>
                </tr>
              </thead>
              <tbody>
                {divergentes.map((i) => {
                  const p = pagas.get(i.id as string)!;
                  const ev = i.evento as unknown as { id: string; nome: string } | null;
                  return (
                    <tr key={i.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-semibold">{i.responsavel_nome}</div>
                        <div className="text-xs text-muted-foreground">{i.telefone}</div>
                      </td>
                      <td className="px-3 py-2">{ev ? <Link href={`/admin/eventos/${ev.id}`} className="text-neel-blue hover:underline">{ev.nome}</Link> : "—"}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{i.status_pagamento}</span>
                        {!i.qrcode_enviado_em && <span className="ml-1 text-xs text-red-700">sem QR</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${p.conta === "escola" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}`}>{ROTULO_CONTA[p.conta]}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        <ValorSensivel valor={formatCurrency(p.valor)} />
                        {p.parcelas > 1 && <div className="text-xs font-normal text-muted-foreground">{p.parcelas} parcelas no cartão</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {porConta.map((c) => (
          <div key={c.conta} className="rounded-2xl border border-border/60 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.rotulo}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-neel-blue"><ValorSensivel valor={formatCurrency(c.entrou)} /></p>
            <p className="text-xs text-muted-foreground">entrou na conta · {c.n} pagamento(s)</p>
            {c.aCair > 0 && <p className="mt-1 text-sm text-emerald-700">+ <ValorSensivel valor={formatCurrency(c.aCair)} /> no cartão, a cair</p>}
          </div>
        ))}
      </section>

      <section className="mt-8">
        <p className="font-bold text-neel-blue">Pagamentos ({pagamentos.length})</p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Conta</th>
                <th className="px-4 py-3">Descrição no Asaas</th>
                <th className="px-4 py-3">Forma</th>
                <th className="px-4 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                    {p.recebidoEm ? data(p.recebidoEm) : <span className="text-emerald-700">cai {data(p.previstoEm)}</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${p.conta === "escola" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}`}>{ROTULO_CONTA[p.conta]}</span>
                  </td>
                  <td className="max-w-[380px] truncate px-4 py-2" title={p.descricao ?? ""}>{p.descricao ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{FORMA[p.forma ?? ""] ?? p.forma}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums"><ValorSensivel valor={formatCurrency(p.valor)} /></td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum pagamento encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Da conta da Escola Amadeus aparecem só cobranças de inscrições do NEEL. Cartão parcelado: o Asaas aprova tudo na hora e cada parcela cai no seu mês.</p>
      </section>
    </div>
  );
}
