import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { RelatorioControls } from "./relatorio-controls";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modo?: string; senhas?: string }>;
}

interface Item {
  nome?: string;
  qtd?: number;
}

interface Linha {
  nome: string;
  qtd: number;
}

interface Grupo {
  chave: string;
  tipo: string;
  linhas: Linha[];
  totalSenhas: number;
}

export default async function RelatorioPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { modo: modoRaw, senhas: senhasRaw } = await searchParams;
  const modo: "lista" | "paginas" = modoRaw === "paginas" ? "paginas" : "lista";
  // "Versão professores": esconde a coluna de senhas e os totais,
  // pra lista circular sem expor quanto cada participante comprou.
  const mostrarSenhas = senhasRaw !== "nao";

  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nome, data_evento")
    .eq("id", id)
    .maybeSingle();

  if (!evento) notFound();

  type InscricaoRel = {
    id: string;
    responsavel_nome: string | null;
    itens: unknown;
  };

  const { data: inscricoesData } = await supabase
    .from("inscricoes")
    .select("id, responsavel_nome, itens")
    .eq("evento_id", id)
    .eq("status_pagamento", "pago");
  const inscricoes = (inscricoesData ?? []) as InscricaoRel[];

  // Agrupa por tipo de ingresso (item). Cada participante que comprou
  // aquele tipo vira uma linha dentro do grupo.
  const grupos: Grupo[] = [];
  for (const i of inscricoes) {
    const nome = (i.responsavel_nome ?? "—").trim() || "—";
    const itens = (i.itens as Item[] | null) ?? [];
    for (const it of itens) {
      const qtd = it.qtd ?? 0;
      if (qtd <= 0) continue;
      const tipo = (it.nome ?? "Senha").trim() || "Senha";
      let g = grupos.find((x) => x.tipo === tipo);
      if (!g) {
        g = { chave: tipo, tipo, linhas: [], totalSenhas: 0 };
        grupos.push(g);
      }
      g.linhas.push({ nome, qtd });
      g.totalSenhas += qtd;
    }
  }

  // Ordena tipos por nome e participantes alfabeticamente dentro do grupo.
  grupos.sort((a, b) => a.tipo.localeCompare(b.tipo, "pt-BR"));
  for (const g of grupos) {
    g.linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  const totalParticipantes = grupos.reduce((s, g) => s + g.linhas.length, 0);
  const totalSenhas = grupos.reduce((s, g) => s + g.totalSenhas, 0);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 print:max-w-none print:px-0 print:py-0">
      <RelatorioControls
        eventoId={evento.id}
        modo={modo}
        mostrarSenhas={mostrarSenhas}
      />

      <div className="mt-8 print:mt-0">
        {/* Cabeçalho geral: na impressão por tipo ele some — cada
            folha tem o próprio cabeçalho com os números DO tipo. */}
        <header
          className={`border-b-2 border-neel-blue pb-4 ${
            modo === "paginas" ? "print:hidden" : ""
          }`}
        >
          <h1 className="text-2xl font-extrabold text-neel-blue">
            {evento.nome}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Relatório de pagantes · {formatDate(evento.data_evento)}
          </p>
          <p className="mt-2 text-sm font-semibold">
            {totalParticipantes} participante(s)
            {mostrarSenhas ? ` · ${totalSenhas} senha(s) no total` : ""}
          </p>
        </header>

        {totalParticipantes === 0 ? (
          <p className="mt-8 text-center text-muted-foreground">
            Nenhum pagamento confirmado ainda.
          </p>
        ) : (
          <div
            className={
              modo === "paginas"
                ? "mt-6 space-y-6 print:space-y-0"
                : "mt-6 space-y-8"
            }
          >
            {grupos.map((g, idx) => (
              <section
                key={g.chave}
                className={[
                  modo === "paginas"
                    ? "rounded-2xl border-2 border-neel-blue/20 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
                    : "",
                  modo === "paginas" && idx < grupos.length - 1
                    ? "print:break-after-page"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {modo === "paginas" && (
                  <div className="-mt-2 mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-neel-blue/60 print:hidden">
                    <span>Página {idx + 1} de {grupos.length}</span>
                    <span>Um tipo por página</span>
                  </div>
                )}
                {modo === "paginas" && (
                  <div className="mb-3 hidden border-b-2 border-neel-blue pb-2 print:block">
                    <div className="text-lg font-extrabold text-neel-blue">
                      {evento.nome}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Relatório de pagantes · {formatDate(evento.data_evento)} ·
                      Página {idx + 1} de {grupos.length}
                    </div>
                  </div>
                )}
                <h2 className="mb-2 text-base font-extrabold text-neel-blue">
                  {g.tipo}
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    ({g.linhas.length} participante(s)
                    {mostrarSenhas ? ` · ${g.totalSenhas} senha(s)` : ""})
                  </span>
                </h2>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-border text-left">
                      <th className="py-2 pr-3 font-semibold">#</th>
                      <th className="py-2 pr-3 font-semibold">Participante</th>
                      {mostrarSenhas && (
                        <th className="py-2 font-semibold">Qtd.</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {g.linhas.map((l, i) => (
                      <tr
                        key={`${g.chave}-${i}`}
                        className="border-b border-border/60 break-inside-avoid"
                      >
                        <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="py-2 pr-3 font-medium">{l.nome}</td>
                        {mostrarSenhas && (
                          <td className="py-2 tabular-nums">{l.qtd}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
