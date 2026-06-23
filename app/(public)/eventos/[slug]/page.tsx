import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  Phone,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  formatCurrency,
  formatDate,
  formatDateTimeBrt,
  formatProximoDiaBrt,
} from "@/lib/utils";
import { getLoteDisplay, limparPrefixoLote, type Lote } from "@/lib/lotes";
import { calcEstoquePorTipo } from "@/lib/estoque";
import { InscricaoForm } from "./inscricao-form";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("nome, descricao_curta, imagem_capa_url, data_evento")
    .eq("slug", slug)
    .in("status", ["publicado", "encerrado"])
    .maybeSingle();

  if (!evento) return {};

  const title = evento.nome;
  const description =
    evento.descricao_curta ??
    `Inscrições abertas — ${new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(evento.data_evento))}`;
  const images = evento.imagem_capa_url
    ? [{ url: evento.imagem_capa_url, alt: evento.nome }]
    : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((i) => (typeof i === "string" ? i : i.url)),
    },
  };
}

export default async function EventoPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select(
      "id, slug, nome, descricao_curta, descricao_longa, data_evento, hora_evento, local, imagem_capa_url, cor_tematica, prazo_inscricao, destinacao_valores, infos_importantes, max_parcelas, metodos_pagamento, status, mostrar_estoque_publico, palestrantes, momento_artistico, contatos, tipos_ingresso(id, nome, preco, descricao, ordem, lotes, max_ingressos, opcional, grupo)",
    )
    .eq("slug", slug)
    .in("status", ["publicado", "encerrado"])
    .maybeSingle();

  if (!evento) notFound();

  const tipos = (evento.tipos_ingresso ?? []).sort(
    (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0),
  );
  // Vitrine de preços mostra só os ingressos obrigatórios; as vendas
  // opcionais (almoço etc.) aparecem dentro do formulário de inscrição.
  const tiposVitrine = tipos.filter(
    (t) => !(t as { opcional?: boolean | null }).opcional,
  );

  // Cota / estoque por tipo (só pagas contam)
  const estoque = await calcEstoquePorTipo(supabase, evento.id);
  const mostrarEstoque = evento.mostrar_estoque_publico ?? false;

  const cor = evento.cor_tematica ?? "#C2410C";

  // Contatos do rodapé: usa os cadastrados; se não houver, cai no número
  // padrão da secretaria do NEEL.
  const contatos =
    Array.isArray(evento.contatos) && evento.contatos.length > 0
      ? (evento.contatos as string[])
      : ["(84) 9 8145-0229"];

  // Cores derivadas (rgba com transparência pra fundo suave)
  const corFundoSuave = `${cor}14`; // ~8% opacity em hex
  const corFundoChip = `${cor}1F`; // ~12%

  const hora = evento.hora_evento?.slice(0, 5);
  const prazoData = evento.prazo_inscricao
    ? new Date(evento.prazo_inscricao)
    : null;

  // ----- Estado das inscrições -----
  const agora = new Date();
  const dataEvento = new Date(`${evento.data_evento}T23:59:59`);
  const prazoExpirou = prazoData ? prazoData < agora : false;
  const eventoPassou = dataEvento < agora;
  const inscricoesEncerradas =
    evento.status === "encerrado" || prazoExpirou || eventoPassou;
  const motivoEncerramento =
    evento.status === "encerrado"
      ? "Este evento já foi encerrado pelo NEEL."
      : eventoPassou
        ? "Este evento já aconteceu."
        : "O prazo de inscrição se encerrou.";

  return (
    <>
      {/* ============ HERO ============ */}
      <section
        className="relative isolate overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${cor}, ${cor}cc 60%, ${cor}88)`,
        }}
      >
        <div className="container mx-auto grid gap-12 px-4 py-20 sm:py-28 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest backdrop-blur">
              {inscricoesEncerradas ? (
                <>
                  <AlertCircle className="size-3.5" />
                  Inscrições encerradas
                </>
              ) : (
                <>
                  <Heart className="size-3.5" fill="currentColor" />
                  Evento do NEEL
                </>
              )}
            </div>
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              {evento.nome}
            </h1>
            {evento.descricao_curta && (
              <p className="mt-6 max-w-xl text-lg text-white/90 sm:text-xl">
                {evento.descricao_curta}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-white/95">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4" />
                {formatDate(evento.data_evento)}
              </span>
              {hora && (
                <span className="inline-flex items-center gap-2">
                  <Clock className="size-4" />
                  {hora}
                </span>
              )}
              {evento.local && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-4" />
                  {evento.local}
                </span>
              )}
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              {!inscricoesEncerradas && (
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-foreground hover:bg-white/95"
                  style={{ color: cor }}
                >
                  <a href="#inscricao">
                    Fazer inscrição
                    <ArrowRight />
                  </a>
                </Button>
              )}
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="border border-white/30 text-white hover:bg-white/10 hover:text-white"
              >
                <a href="#sobre">Saiba mais</a>
              </Button>
            </div>
          </div>

          {/* Card lateral com os infos chave */}
          <Card className="hidden border-white/30 bg-white/95 backdrop-blur lg:block">
            <CardHeader>
              <CardTitle style={{ color: cor }}>Resumo do evento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoLine icon={CalendarDays} label="Data">
                {formatDate(evento.data_evento)}
              </InfoLine>
              {hora && (
                <InfoLine icon={Clock} label="Horário">
                  {hora}
                </InfoLine>
              )}
              {evento.local && (
                <InfoLine icon={MapPin} label="Local">
                  {evento.local}
                </InfoLine>
              )}
              {prazoData && (
                <InfoLine icon={AlertCircle} label="Inscrições até">
                  {formatDate(prazoData)}
                </InfoLine>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============ SOBRE ============ */}
      {evento.descricao_longa && (
        <section id="sobre" className="bg-white pt-20">
          <div className="container mx-auto max-w-3xl px-4 text-center">
            <SectionEyebrow cor={cor}>Sobre o evento</SectionEyebrow>
            <h2
              className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl"
              style={{ color: cor }}
            >
              Preparamos tudo com muito carinho
            </h2>
            <DescricaoLonga texto={evento.descricao_longa} cor={cor} />
          </div>
        </section>
      )}

      {/* ============ PALESTRANTES ============ */}
      {Array.isArray(evento.palestrantes) &&
        evento.palestrantes.length > 0 && (
          <section className="bg-white py-20">
            <div className="container mx-auto max-w-5xl px-4">
              <div className="mx-auto max-w-3xl text-center">
                <SectionEyebrow cor={cor}>Quem vai estar lá</SectionEyebrow>
                <h2
                  className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl"
                  style={{ color: cor }}
                >
                  Palestrantes
                </h2>
              </div>
              <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
                {(
                  evento.palestrantes as {
                    nome: string;
                    foto_url: string | null;
                  }[]
                ).map((p, i) => {
                  const iniciais = p.nome
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase();
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center text-center"
                    >
                      <div
                        className="relative size-28 overflow-hidden rounded-full border-4 shadow-float"
                        style={{ borderColor: `${cor}33` }}
                      >
                        {p.foto_url ? (
                          <Image
                            src={p.foto_url}
                            alt={p.nome}
                            fill
                            sizes="112px"
                            className="object-cover"
                          />
                        ) : (
                          <div
                            className="grid size-full place-items-center text-white"
                            style={{ background: cor }}
                          >
                            <span className="text-2xl font-extrabold">
                              {iniciais}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="mt-4 text-sm font-bold leading-snug text-foreground">
                        {p.nome}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

      {/* ============ MOMENTO ARTÍSTICO ============ */}
      {Array.isArray(evento.momento_artistico) &&
        evento.momento_artistico.length > 0 && (
          <section className="bg-neel-blue-50/30 py-20">
            <div className="container mx-auto max-w-5xl px-4">
              <div className="mx-auto max-w-3xl text-center">
                <SectionEyebrow cor={cor}>Apresentações</SectionEyebrow>
                <h2
                  className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl"
                  style={{ color: cor }}
                >
                  Momento Artístico
                </h2>
              </div>
              <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
                {(
                  evento.momento_artistico as {
                    nome: string;
                    foto_url: string | null;
                  }[]
                ).map((p, i) => {
                  const iniciais = p.nome
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase();
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center text-center"
                    >
                      <div
                        className="relative size-28 overflow-hidden rounded-full border-4 shadow-float"
                        style={{ borderColor: `${cor}33` }}
                      >
                        {p.foto_url ? (
                          <Image
                            src={p.foto_url}
                            alt={p.nome}
                            fill
                            sizes="112px"
                            className="object-cover"
                          />
                        ) : (
                          <div
                            className="grid size-full place-items-center text-white"
                            style={{ background: cor }}
                          >
                            <span className="text-2xl font-extrabold">
                              {iniciais}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="mt-4 text-sm font-bold leading-snug text-foreground">
                        {p.nome}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

      {/* ============ O QUE ESTÁ INCLUÍDO (antiga "destinação") ============ */}
      {evento.destinacao_valores && (
        <section
          className={evento.descricao_longa ? "bg-white pb-20 pt-8" : "bg-white py-20"}
        >
          <div className="container mx-auto max-w-3xl px-4">
            <div
              className="rounded-3xl border-2 p-6 sm:p-8"
              style={{ borderColor: `${cor}33`, background: `${cor}0D` }}
            >
              <h3
                className="text-base font-extrabold uppercase tracking-[0.18em]"
                style={{ color: cor }}
              >
                O que está incluído
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-foreground/85 sm:text-base">
                {evento.destinacao_valores}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ============ INFO CARDS ============ */}
      <section
        className="border-y border-border/60 py-16"
        style={{ background: corFundoSuave }}
      >
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow cor={cor}>Informações</SectionEyebrow>
            <h2
              className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl"
              style={{ color: cor }}
            >
              Tudo o que você precisa saber
            </h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoCard icon={CalendarDays} label="Data" cor={cor}>
              {formatDate(evento.data_evento)}
            </InfoCard>
            {hora && (
              <InfoCard icon={Clock} label="Horário" cor={cor}>
                {hora}
              </InfoCard>
            )}
            {evento.local && (
              <InfoCard icon={MapPin} label="Local" cor={cor}>
                {evento.local}
              </InfoCard>
            )}
            {prazoData && (
              <InfoCard icon={AlertCircle} label="Inscrições até" cor={cor}>
                {formatDate(prazoData)}
              </InfoCard>
            )}
          </div>
        </div>
      </section>

      {/* ============ IMPORTANTE ============ */}
      {evento.infos_importantes && evento.infos_importantes.length > 0 && (
        <section
          className="border-y border-border/60 py-20"
          style={{ background: corFundoSuave }}
        >
          <div className="container mx-auto max-w-3xl px-4">
            <SectionEyebrow cor={cor}>Importante</SectionEyebrow>
            <h2
              className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl"
              style={{ color: cor }}
            >
              Antes de se inscrever, leia
            </h2>
            <ul className="mt-8 space-y-3">
              {(evento.infos_importantes as string[]).map((info, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm"
                >
                  <CheckCircle2
                    className="mt-0.5 size-5 shrink-0"
                    style={{ color: cor }}
                  />
                  <span className="text-sm leading-relaxed">{info}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ============ INGRESSOS ============ */}
      <section id="inscricao" className="bg-white py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow cor={cor}>Inscrição</SectionEyebrow>
            <h2
              className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl"
              style={{ color: cor }}
            >
              Garanta sua presença
            </h2>
            <p className="mt-3 text-muted-foreground">
              Escolha o tipo de ingresso e faça sua inscrição em poucos
              cliques.
            </p>
          </div>

          {tiposVitrine.length > 0 ? (
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {tiposVitrine.map((tipo) => {
                const lotes = (tipo.lotes ?? []) as Lote[];
                const loteInfo = getLoteDisplay(
                  { nome: tipo.nome, preco: Number(tipo.preco), descricao: tipo.descricao, lotes },
                  agora,
                );
                const formatarDataMM = (d: Date) => formatProximoDiaBrt(d);
                const est = estoque.get(tipo.id);
                const esgotado = est?.esgotado ?? false;

                return (
                  <div
                    key={tipo.id}
                    className="rounded-3xl border-2 p-6 transition-all hover:-translate-y-0.5 hover:shadow-float-lg"
                    style={{
                      borderColor: esgotado ? "#9ca3af33" : `${cor}33`,
                      background: esgotado ? "#9ca3af14" : corFundoSuave,
                      opacity: esgotado ? 0.75 : 1,
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className="grid size-12 place-items-center rounded-2xl text-white shadow-float"
                          style={{ background: esgotado ? "#6b7280" : cor }}
                        >
                          <Ticket className="size-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="text-lg font-extrabold"
                              style={{ color: esgotado ? "#6b7280" : cor }}
                            >
                              {limparPrefixoLote(tipo.nome)}
                            </span>
                            {esgotado ? (
                              <span className="rounded-full bg-gray-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                Esgotado
                              </span>
                            ) : (
                              loteInfo.rotulo && (
                                <span
                                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                                  style={{ background: cor }}
                                >
                                  {loteInfo.rotulo}
                                </span>
                              )
                            )}
                          </div>
                          {!esgotado &&
                            mostrarEstoque &&
                            est &&
                            est.max !== null &&
                            est.restantes !== null && (
                              <div
                                className="mt-1 text-xs font-semibold"
                                style={{ color: cor }}
                              >
                                Restam {est.restantes} de {est.max}
                              </div>
                            )}
                          {tipo.descricao && (
                            <div className="text-sm text-muted-foreground">
                              {tipo.descricao}
                            </div>
                          )}
                          {loteInfo.validoAte && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              válido até{" "}
                              <strong>
                                {formatDateTimeBrt(loteInfo.validoAte)}
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>
                      <div
                        className="text-2xl font-extrabold tabular-nums"
                        style={{ color: cor }}
                      >
                        {formatCurrency(loteInfo.precoAtual)}
                      </div>
                    </div>

                    {/* Miniagenda dos próximos lotes */}
                    {loteInfo.proximos.length > 0 && (
                      <div
                        className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs"
                        style={{ borderColor: `${cor}20`, color: cor }}
                      >
                        <span className="font-semibold uppercase tracking-wider opacity-70">
                          Próximos lotes:
                        </span>
                        {loteInfo.proximos.map((p, i) => (
                          <span key={i} className="font-medium">
                            a partir de {formatarDataMM(p.quandoMuda)}:{" "}
                            <strong>{formatCurrency(p.preco)}</strong>
                            {i < loteInfo.proximos.length - 1 ? " ·" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-10 text-center text-muted-foreground">
              Tipos de ingresso ainda não cadastrados.
            </p>
          )}

          {/* Formulário de inscrição ou aviso de encerramento */}
          {inscricoesEncerradas ? (
            <div
              className="mt-10 rounded-3xl border-2 border-dashed p-10 text-center"
              style={{ borderColor: `${cor}40`, background: corFundoSuave }}
            >
              <div
                className="mx-auto grid size-14 place-items-center rounded-2xl text-white shadow-float"
                style={{ background: cor }}
              >
                <AlertCircle className="size-7" />
              </div>
              <h3
                className="mt-5 text-xl font-extrabold"
                style={{ color: cor }}
              >
                Inscrições encerradas
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {motivoEncerramento} Para mais informações, fale com a
                secretaria do NEEL pelo WhatsApp{" "}
                <strong className="font-semibold text-neel-blue" translate="no">
                  (84) 9 8145-0229
                </strong>
                .
              </p>
            </div>
          ) : (
            <InscricaoForm
              evento={{
                id: evento.id,
                slug: evento.slug,
                nome: evento.nome,
                cor_tematica: cor,
                metodos_pagamento: evento.metodos_pagamento,
                max_parcelas: evento.max_parcelas,
              }}
              tipos={tipos.map((t) => {
                const est = estoque.get(t.id);
                return {
                  id: t.id,
                  nome: t.nome,
                  preco: Number(t.preco),
                  descricao: t.descricao,
                  ordem: t.ordem,
                  lotes: (t.lotes ?? []) as Lote[],
                  opcional:
                    (t as { opcional?: boolean | null }).opcional ?? false,
                  grupo: (t as { grupo?: string | null }).grupo ?? null,
                  restantes: est?.restantes ?? null,
                  esgotado: est?.esgotado ?? false,
                  mostrar_estoque: mostrarEstoque,
                };
              })}
            />
          )}
        </div>
      </section>

      {/* ============ CONTATO ============ */}
      <section className="bg-neel-blue-50/40 py-16">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-extrabold text-neel-blue sm:text-3xl">
            Dúvidas sobre este evento?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Fale com a secretaria pelo WhatsApp
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {contatos.map((contato) => (
              <a
                key={contato}
                href={`https://wa.me/55${contato.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-4 text-lg font-extrabold text-neel-blue shadow-float transition-all hover:-translate-y-0.5 hover:shadow-float-lg"
              >
                <Phone className="size-5" />
                <span translate="no">{contato}</span>
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Horário de atendimento: 7h às 19h
          </p>
        </div>
      </section>
    </>
  );
}

// ---------- Helpers de UI ----------

function SectionEyebrow({
  children,
  cor,
}: {
  children: React.ReactNode;
  cor: string;
}) {
  return (
    <span
      className="inline-block text-xs font-semibold uppercase tracking-[0.22em]"
      style={{ color: cor }}
    >
      {children}
    </span>
  );
}

function InfoLine({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-medium text-foreground">{children}</div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  cor,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  cor: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="text-center">
      <CardHeader>
        <div
          className="mx-auto grid size-12 place-items-center rounded-2xl text-white shadow-float"
          style={{ background: cor }}
        >
          <Icon className="size-5" />
        </div>
        <CardDescription className="mt-3 text-xs font-semibold uppercase tracking-wide">
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-semibold text-foreground">{children}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Renderiza a descrição longa quebrando por \n e detectando linhas
 * que começam com "•" pra virar lista bonita.
 */
function DescricaoLonga({ texto, cor }: { texto: string; cor: string }) {
  const blocos: { tipo: "p" | "ul"; conteudo: string[] }[] = [];
  let bufferLista: string[] = [];

  const flushLista = () => {
    if (bufferLista.length) {
      blocos.push({ tipo: "ul", conteudo: bufferLista });
      bufferLista = [];
    }
  };

  for (const linha of texto.split("\n")) {
    const l = linha.trim();
    if (!l) {
      flushLista();
      continue;
    }
    if (l.startsWith("•") || l.startsWith("-")) {
      bufferLista.push(l.replace(/^[•\-]\s*/, ""));
    } else {
      flushLista();
      blocos.push({ tipo: "p", conteudo: [l] });
    }
  }
  flushLista();

  return (
    <div className="mt-6 space-y-5 text-left text-muted-foreground sm:text-center">
      {blocos.map((bloco, i) =>
        bloco.tipo === "p" ? (
          <p key={i} className="text-base leading-relaxed sm:text-lg">
            {bloco.conteudo[0]}
          </p>
        ) : (
          <ul
            key={i}
            className="mx-auto grid max-w-2xl gap-2 text-left sm:grid-cols-2"
          >
            {bloco.conteudo.map((item, j) => (
              <li
                key={j}
                className="flex items-start gap-2 rounded-2xl bg-neel-blue-50/40 p-3 text-sm"
              >
                <Heart
                  className="mt-0.5 size-4 shrink-0"
                  style={{ color: cor }}
                  fill="currentColor"
                />
                <span className="text-foreground/85">{item}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
