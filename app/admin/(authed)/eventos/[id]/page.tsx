import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  Ticket,
  Utensils,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { calcEstoquePorTipo } from "@/lib/estoque";
import {
  getLoteAtivo,
  limparPrefixoLote,
  ordenarLotes,
  type Lote,
} from "@/lib/lotes";
import { formatDateTimeBrt } from "@/lib/utils";
import { InscricoesTable } from "./inscricoes-table";
import { SenhaGateButton } from "./senha-gate-button";

const statusConfig: Record<
  string,
  { label: string; variant: "muted" | "success" | "warning" }
> = {
  rascunho: { label: "Rascunho", variant: "muted" },
  publicado: { label: "Publicado", variant: "success" },
  encerrado: { label: "Encerrado", variant: "warning" },
};


interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select(
      "id, slug, nome, descricao_curta, data_evento, hora_evento, local, imagem_capa_url, cor_tematica, metodos_pagamento, max_parcelas, prazo_inscricao, status, mostrar_estoque_publico, tipos_ingresso(id, nome, preco, descricao, ordem, max_ingressos, opcional, grupo, lotes)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!evento) notFound();

  const { data: inscricoes } = await supabase
    .from("inscricoes")
    .select(
      "id, responsavel_nome, email, telefone, valor_total, itens, status_pagamento, metodo_pagamento, parcelas, created_at, confirmacao_enviada_em, confirmacao_erro, qrcode_enviado_em, qrcode_erro",
    )
    .eq("evento_id", id)
    .order("created_at", { ascending: false });

  const lista = inscricoes ?? [];

  // Logs de todas as inscrições deste evento, agrupados por inscricao_id
  const idsInscricoes = lista.map((i) => i.id);
  const logsPorInscricao = new Map<
    string,
    { etapa: string; sucesso: boolean; mensagem: string | null; created_at: string }[]
  >();
  if (idsInscricoes.length > 0) {
    const { data: logs } = await supabase
      .from("inscricao_logs")
      .select("inscricao_id, etapa, sucesso, mensagem, created_at")
      .in("inscricao_id", idsInscricoes)
      .order("created_at", { ascending: true });
    for (const log of logs ?? []) {
      const arr = logsPorInscricao.get(log.inscricao_id) ?? [];
      arr.push({
        etapa: log.etapa,
        sucesso: log.sucesso,
        mensagem: log.mensagem,
        created_at: log.created_at,
      });
      logsPorInscricao.set(log.inscricao_id, arr);
    }
  }

  const tipos = (evento.tipos_ingresso ?? []).sort(
    (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0),
  );

  const estoque = await calcEstoquePorTipo(supabase, evento.id);

  const totalPendentes = lista.filter(
    (i) => i.status_pagamento === "pendente",
  ).length;
  const receita = lista
    .filter((i) => i.status_pagamento === "pago")
    .reduce((sum, i) => sum + Number(i.valor_total ?? 0), 0);
  // Quais tipos são opcionais (ex: almoço) — usado p/ separar das entradas.
  const tiposOpcionais = new Set(
    tipos.filter((t) => (t as { opcional?: boolean }).opcional).map((t) => t.id),
  );
  const ehOpcional = (it: { opcional?: boolean; tipo_id?: string }) =>
    it.opcional === true || (it.tipo_id ? tiposOpcionais.has(it.tipo_id) : false);

  const pagas = lista.filter((i) => i.status_pagamento === "pago");
  const somaItens = (
    filtro: (it: { opcional?: boolean; tipo_id?: string }) => boolean,
  ) =>
    pagas.reduce((sum, i) => {
      const itens =
        (i.itens as
          | { qtd?: number; opcional?: boolean; tipo_id?: string }[]
          | null) ?? [];
      return (
        sum +
        itens.filter(filtro).reduce((s, it) => s + (it.qtd ?? 0), 0)
      );
    }, 0);
  // Entradas (senhas) x opcionais (almoço), contando só inscrições pagas.
  const ingressosVendidos = somaItens((it) => !ehOpcional(it));
  const opcionaisVendidos = somaItens((it) => ehOpcional(it));
  const temOpcionais = tiposOpcionais.size > 0;

  const status = statusConfig[evento.status] ?? statusConfig.rascunho;
  const cor = evento.cor_tematica ?? "#C2410C";
  const hora = evento.hora_evento?.slice(0, 5);

  return (
    <div className="container mx-auto px-4 py-10">
      <Link
        href="/admin/eventos"
        className="inline-flex items-center gap-1 text-sm font-semibold text-neel-blue hover:underline"
      >
        <ChevronLeft className="size-4" />
        Voltar para eventos
      </Link>

      {/* Header */}
      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">
              {evento.nome}
            </h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          {evento.descricao_curta && (
            <p className="mt-2 text-muted-foreground">
              {evento.descricao_curta}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {evento.status === "publicado" && (
            <Button asChild variant="outline">
              <a
                href={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/eventos/${evento.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink />
                Ver no site
              </a>
            </Button>
          )}
          <Button asChild variant="accent">
            <Link href={`/admin/eventos/${evento.id}/venda`}>
              <Wallet />
              Venda em dinheiro
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/eventos/${evento.id}/relatorio`}>
              <FileText />
              Relatório
            </Link>
          </Button>
          <SenhaGateButton kind="duplicar" eventoId={evento.id} />
          <SenhaGateButton kind="editar" eventoId={evento.id} />
        </div>
      </header>

      {/* Métricas */}
      <section
        className={`mt-8 grid gap-4 ${
          temOpcionais ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"
        }`}
      >
        <MetricCard
          label="Ingressos vendidos"
          value={ingressosVendidos}
          icon={Ticket}
        />
        {temOpcionais && (
          <MetricCard
            label="Almoço (opcionais)"
            value={opcionaisVendidos}
            icon={Utensils}
          />
        )}
        <MetricCard
          label="Pendentes"
          value={totalPendentes}
          icon={Clock}
        />
        <MetricCard
          label="Receita confirmada"
          value={formatCurrency(receita)}
          icon={Wallet}
        />
      </section>

      {/* Informações */}
      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informações do evento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Info label="Data" icon={CalendarDays}>
              {formatDate(evento.data_evento)}
            </Info>
            {hora && (
              <Info label="Horário" icon={Clock}>
                {hora}
              </Info>
            )}
            {evento.local && (
              <Info label="Local" icon={MapPin}>
                {evento.local}
              </Info>
            )}
            {evento.prazo_inscricao && (
              <Info label="Prazo de inscrição" icon={CalendarDays}>
                {formatDate(evento.prazo_inscricao)}
              </Info>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <KV
                label="Métodos de pagamento"
                value={(evento.metodos_pagamento as string[])
                  .map((m: string) => (m === "pix" ? "PIX" : "Cartão"))
                  .join(", ")}
              />
              <KV
                label="Parcelamento máximo"
                value={`${evento.max_parcelas}x`}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingressos</CardTitle>
            <CardDescription>{tipos.length} tipo(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tipos.map((t) => {
              const est = estoque.get(t.id);
              const vendido = est?.vendido ?? 0;
              const max = est?.max ?? null;
              const esgotado = est?.esgotado ?? false;
              const lotes = ((t as { lotes?: unknown }).lotes ?? []) as Lote[];
              const lotesOrdenados = ordenarLotes(lotes);
              const ativo = getLoteAtivo(lotes);
              const agora = new Date();
              return (
                <div
                  key={t.id}
                  className="rounded-2xl border border-border/70 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold" style={{ color: cor }}>
                          {limparPrefixoLote(t.nome)}
                        </span>
                        {esgotado && (
                          <span className="rounded-full bg-gray-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                            Esgotado
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {max !== null
                          ? `${vendido} / ${max} vendido(s)`
                          : `${vendido} vendido(s) · sem limite`}
                        {t.descricao && ` · ${t.descricao}`}
                      </div>
                    </div>
                    {lotesOrdenados.length === 0 && (
                      <div
                        className="shrink-0 font-extrabold tabular-nums"
                        style={{ color: cor }}
                      >
                        {formatCurrency(Number(t.preco))}
                      </div>
                    )}
                  </div>

                  {/* Lista de lotes (se houver) */}
                  {lotesOrdenados.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {lotesOrdenados.map((lote, idx) => {
                        const isAtivo = ativo && lote === ativo;
                        const expirado =
                          lote.valido_ate !== null &&
                          new Date(lote.valido_ate).getTime() < agora.getTime();
                        const futuro = !isAtivo && !expirado;
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
                            style={{
                              borderColor: isAtivo
                                ? `${cor}55`
                                : "rgba(0,0,0,0.08)",
                              background: isAtivo
                                ? `${cor}10`
                                : expirado
                                  ? "rgba(0,0,0,0.025)"
                                  : "transparent",
                              opacity: expirado ? 0.55 : 1,
                            }}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="font-semibold"
                                style={{
                                  color: isAtivo ? cor : "inherit",
                                }}
                              >
                                {lote.nome || `Lote ${idx + 1}`}
                              </span>
                              {isAtivo && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                                  style={{ background: cor }}
                                >
                                  Ativo agora
                                </span>
                              )}
                              {expirado && (
                                <span className="rounded-full bg-gray-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-700">
                                  Encerrado
                                </span>
                              )}
                              {futuro && (
                                <span className="rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                                  A seguir
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {lote.valido_ate
                                  ? `até ${formatDateTimeBrt(lote.valido_ate)}`
                                  : "sem prazo"}
                              </span>
                            </div>
                            <div
                              className="shrink-0 font-extrabold tabular-nums"
                              style={{ color: isAtivo ? cor : undefined }}
                            >
                              {formatCurrency(Number(lote.preco))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* Inscrições */}
      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Inscrições</CardTitle>
            <CardDescription>
              {lista.length === 0
                ? "Ainda sem inscrições."
                : `${lista.length} inscrição/inscrições registradas.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InscricoesTable
              inscricoes={lista.map((i) => {
                const itens =
                  (i.itens as
                    | { nome?: string; qtd?: number; opcional?: boolean }[]
                    | null) ?? [];
                const comQtd = itens.filter((it) => (it.qtd ?? 0) > 0);
                // Ingressos de entrada (senhas) x vendas opcionais (ex: almoço)
                const ingressos = comQtd.filter((it) => !it.opcional);
                const opcionais = comQtd.filter((it) => it.opcional);
                const totalSenhas = ingressos.reduce(
                  (s, it) => s + (it.qtd ?? 0),
                  0,
                );
                const senhasDetalhe = ingressos
                  .map((it) => `${it.qtd}x ${(it.nome ?? "Senha").trim()}`)
                  .join(", ");
                const opcionaisDetalhe = opcionais
                  .map((it) => `${it.qtd}x ${(it.nome ?? "Opcional").trim()}`)
                  .join(", ");
                return {
                  id: i.id,
                  responsavel_nome: i.responsavel_nome,
                  telefone: i.telefone,
                  valor_total: Number(i.valor_total),
                  total_senhas: totalSenhas,
                  senhas_detalhe: senhasDetalhe,
                  opcionais_detalhe: opcionaisDetalhe,
                  status_pagamento: i.status_pagamento,
                  metodo_pagamento: i.metodo_pagamento,
                  parcelas: i.parcelas,
                  created_at: i.created_at,
                  confirmacao_enviada_em: i.confirmacao_enviada_em,
                  confirmacao_erro: i.confirmacao_erro,
                  qrcode_enviado_em: i.qrcode_enviado_em,
                  qrcode_erro: i.qrcode_erro,
                  logs: logsPorInscricao.get(i.id) ?? [],
                };
              })}
            />
          </CardContent>
        </Card>
      </section>

      {/* Zona perigosa */}
      <section className="mt-12 rounded-3xl border-2 border-destructive/30 bg-destructive/5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-destructive">
              Zona perigosa
            </h3>
            <p className="text-sm text-muted-foreground">
              Excluir um evento é permanente. Eventos com inscrições não podem
              ser excluídos.
            </p>
          </div>
          <SenhaGateButton
            kind="excluir"
            eventoId={evento.id}
            eventoNome={evento.nome}
          />
        </div>
      </section>
    </div>
  );
}

// ---------- helpers UI ----------

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-2xl font-extrabold text-neel-blue">
            {value}
          </div>
        </div>
        <div className="grid size-10 place-items-center rounded-2xl bg-neel-blue-50 text-neel-blue">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function Info({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-neel-blue" />
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-neel-blue-50/30 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

