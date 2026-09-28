import { CalendarClock, Eye, MessageCircleWarning, PowerOff } from "lucide-react";
import { montarRelatorio } from "@/lib/relatorio-semanal";
import { lembretesPendentes, textoLembrete } from "@/lib/lembretes";

/**
 * Prévia das mensagens automáticas (29/09/2026): o relatório de sexta para a
 * diretoria e o lembrete de pagamento. Só mostra o que SERIA enviado — esta
 * página não envia nada. Quem envia é o n8n, e os dois fluxos só são ligados
 * com o ok do Pedro.
 */
export const metadata = { title: "Automações · Admin NEEL" };
export const dynamic = "force-dynamic";

// Situação dos fluxos no n8n (atualizar aqui quando ligar/desligar).
const FLUXOS = {
  relatorio: { nome: "NEEL · Relatório de sexta (diretoria)", ligado: false },
  lembrete: { nome: "NEEL · Lembrete de pagamento (24h)", ligado: false },
};

function Situacao({ ligado }: { ligado: boolean }) {
  return ligado ? (
    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Ligado</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground"><PowerOff className="size-3" /> Desligado · nada é enviado</span>
  );
}

/** Imita o balão do WhatsApp, com *negrito* e _itálico_. */
function Balao({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return (
    <div className="max-w-md whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-[#DCF8C6] px-4 py-3 text-[14px] leading-relaxed text-[#111B21] shadow-sm">
      {partes.map((p, i) =>
        p.startsWith("*") && p.endsWith("*") ? <b key={i}>{p.slice(1, -1)}</b> : p.startsWith("_") && p.endsWith("_") ? <i key={i}>{p.slice(1, -1)}</i> : <span key={i}>{p}</span>,
      )}
    </div>
  );
}

export default async function AutomacoesPage() {
  const [rel, lem] = await Promise.all([
    montarRelatorio().catch((e) => ({ ok: false as const, erro: (e as Error).message })),
    lembretesPendentes().catch(() => null),
  ]);

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">Automações</h1>
      <p className="mt-1 max-w-2xl text-muted-foreground">
        Prévia do que as mensagens automáticas enviariam agora, com os números de hoje. Esta página só mostra: não envia nada.
      </p>

      {/* Relatório de sexta */}
      <section className="mt-8 rounded-2xl border border-border/60 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-lg font-extrabold text-neel-blue"><CalendarClock className="size-5" /> Relatório de sexta para a diretoria</p>
          <Situacao ligado={FLUXOS.relatorio.ligado} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Toda sexta às 18h, do seu WhatsApp, para os grupos{" "}
          {rel.ok && rel.grupos.length ? rel.grupos.map((g) => <b key={g.chat_id} className="text-foreground">&quot;{g.nome?.trim()}&quot; </b>) : <b>NEEL - DIRETORIA e Comunicação NEEL</b>}.
          Conta só os ingressos de entrada vendidos pelo site (sem almoço).
        </p>
        {rel.ok ? (
          <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Eye className="size-3.5" /> Como chegaria no grupo</p>
              <Balao texto={rel.texto} />
            </div>
            <div className="grid content-start gap-3 sm:grid-cols-2">
              {[
                { t: "Ingressos vendidos pelo site", v: rel.numeros.total },
                { t: "Nos últimos 7 dias", v: rel.numeros.daSemana },
                { t: "Vindos do tráfego pago", v: rel.numeros.trafego },
                { t: "Tráfego pago nos últimos 7 dias", v: rel.numeros.trafegoSemana },
              ].map((c) => (
                <div key={c.t} className="rounded-xl bg-neel-blue-50 p-3">
                  <p className="text-xs font-semibold text-muted-foreground">{c.t}</p>
                  <p className="text-2xl font-extrabold tabular-nums text-neel-blue">{c.v}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                O tráfego pago só é contado a partir de 29/09. Para aparecer, os anúncios precisam ter os parâmetros de URL do Meta (utm_medium=pago).
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-red-700">Não consegui montar o relatório: {rel.erro}</p>
        )}
      </section>

      {/* Lembrete de pagamento */}
      <section className="mt-6 rounded-2xl border border-border/60 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-lg font-extrabold text-neel-blue"><MessageCircleWarning className="size-5" /> Lembrete de pagamento</p>
          <Situacao ligado={FLUXOS.lembrete.ligado} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Uma mensagem só, do seu WhatsApp, para quem se inscreveu há mais de 24h (até 72h) e não pagou. Antes, confere se a pessoa não comprou em outra inscrição (mesmo telefone ou CPF) nem pagou no Asaas.
        </p>
        {lem ? (
          <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Receberiam agora ({lem.itens.length})</p>
              {lem.itens.length ? (
                <ul className="space-y-1 text-sm">
                  {lem.itens.map((i) => (
                    <li key={i.inscricao_id} className="rounded-lg bg-muted/40 px-3 py-2">{i.nome} <span className="text-muted-foreground">· final {i.telefone.slice(-4)}</span></li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Ninguém na fila agora.</p>
              )}
              {lem.pulados.length > 0 && (
                <>
                  <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Não receberiam ({lem.pulados.length})</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {lem.pulados.map((p) => <li key={p.id}>{p.motivo}</li>)}
                  </ul>
                </>
              )}
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Eye className="size-3.5" /> Modelo da mensagem</p>
              <Balao
                texto={
                  lem.itens[0]
                    ? lem.itens[0].texto.replace(/https:\/\/\S+/, "[link de pagamento da pessoa]")
                    : textoLembrete("Maria", "2º Seminário Espírita do NEEL", "2026-10-31", "[link de pagamento da pessoa]")
                }
              />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-red-700">Não consegui montar a fila de lembretes agora.</p>
        )}
      </section>
    </div>
  );
}
