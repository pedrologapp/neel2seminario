"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  MapPin,
  Users,
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
import { formatDate } from "@/lib/utils";

export interface AdminEventoItem {
  id: string;
  slug: string;
  nome: string;
  data_evento: string;
  hora_evento: string | null;
  local: string | null;
  imagem_capa_url: string | null;
  cor_tematica: string | null;
  status: "rascunho" | "publicado" | "encerrado";
  totalInscricoes: number;
}

interface Props {
  proximos: AdminEventoItem[];
  concluidos: AdminEventoItem[];
  rascunhos: AdminEventoItem[];
}

type Aba = "proximos" | "concluidos" | "rascunhos";

export function AdminEventosTabbed({ proximos, concluidos, rascunhos }: Props) {
  const initial: Aba =
    proximos.length > 0
      ? "proximos"
      : rascunhos.length > 0
        ? "rascunhos"
        : "concluidos";
  const [aba, setAba] = useState<Aba>(initial);

  const lista =
    aba === "proximos"
      ? proximos
      : aba === "rascunhos"
        ? rascunhos
        : concluidos;

  const totalGeral = proximos.length + concluidos.length + rascunhos.length;

  if (totalGeral === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-border bg-white p-1 shadow-sm w-fit">
        <TabPill
          active={aba === "proximos"}
          onClick={() => setAba("proximos")}
          count={proximos.length}
        >
          Próximos
        </TabPill>
        <TabPill
          active={aba === "rascunhos"}
          onClick={() => setAba("rascunhos")}
          count={rascunhos.length}
        >
          Rascunhos
        </TabPill>
        <TabPill
          active={aba === "concluidos"}
          onClick={() => setAba("concluidos")}
          count={concluidos.length}
        >
          Concluídos
        </TabPill>
      </div>

      {lista.length === 0 ? (
        <div className="mt-10 grid place-items-center rounded-2xl border-2 border-dashed border-amadeus-blue/20 bg-amadeus-blue-50/40 py-12 text-sm text-muted-foreground">
          {aba === "proximos"
            ? "Nenhum evento ativo no momento."
            : aba === "rascunhos"
              ? "Nenhum rascunho salvo."
              : "Nenhum evento concluído ainda."}
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((ev) => (
            <EventoCardAdmin key={ev.id} evento={ev} />
          ))}
        </div>
      )}
    </>
  );
}

function TabPill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-amadeus-blue text-white shadow-float"
          : "text-amadeus-blue hover:bg-amadeus-blue-50"
      }`}
    >
      {children}
      <span
        className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          active
            ? "bg-white/25 text-white"
            : "bg-amadeus-blue-50 text-amadeus-blue"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

const statusConfig: Record<
  string,
  { label: string; variant: "muted" | "success" | "warning" }
> = {
  rascunho: { label: "Rascunho", variant: "muted" },
  publicado: { label: "Publicado", variant: "success" },
  encerrado: { label: "Encerrado", variant: "warning" },
};

function EventoCardAdmin({ evento }: { evento: AdminEventoItem }) {
  const status = statusConfig[evento.status] ?? statusConfig.rascunho;
  const cor = evento.cor_tematica ?? "#C2410C";

  return (
    <Card className="overflow-hidden transition-all hover:-translate-y-1 hover:shadow-float-lg">
      <div
        className="relative grid h-40 place-items-center"
        style={{
          background: evento.imagem_capa_url
            ? undefined
            : `linear-gradient(135deg, ${cor}, ${cor}aa)`,
        }}
      >
        {evento.imagem_capa_url ? (
          <Image
            src={evento.imagem_capa_url}
            alt={evento.nome}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <CalendarDays className="size-12 text-white/80" />
        )}
        <Badge
          variant={status.variant}
          className="absolute right-3 top-3 bg-white/95"
        >
          {status.label}
        </Badge>
      </div>
      <CardHeader>
        <CardTitle className="line-clamp-1">{evento.nome}</CardTitle>
        <CardDescription className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {formatDate(evento.data_evento)}
            {evento.hora_evento && ` · ${evento.hora_evento.slice(0, 5)}`}
          </span>
          {evento.local && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {evento.local}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" />
          {evento.totalInscricoes}{" "}
          {evento.totalInscricoes === 1 ? "inscrição" : "inscrições"}
        </span>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/eventos/${evento.id}`}>Gerenciar</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="mt-10">
      <CardContent className="pb-10">
        <div className="grid place-items-center rounded-2xl border-2 border-dashed border-amadeus-blue/20 bg-amadeus-blue-50/40 py-16">
          <div className="max-w-md text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-amadeus-blue shadow-float">
              <CalendarPlus className="size-6" />
            </div>
            <h3 className="mt-5 text-xl font-extrabold text-amadeus-blue">
              Vamos criar o primeiro evento?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Em menos de 5 minutos você publica um evento completo: fotos,
              tipos de ingresso, valores e restrições por série.
            </p>
            <Button asChild className="mt-6">
              <Link href="/admin/eventos/novo">
                <CalendarPlus />
                Criar meu primeiro evento
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
