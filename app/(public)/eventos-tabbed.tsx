"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export interface EventoListItem {
  id: string;
  slug: string;
  nome: string;
  descricao_curta: string | null;
  data_evento: string;
  hora_evento: string | null;
  local: string | null;
  imagem_capa_url: string | null;
  cor_tematica: string | null;
}

interface Props {
  proximos: EventoListItem[];
  concluidos: EventoListItem[];
}

export function EventosTabbed({ proximos, concluidos }: Props) {
  const temAmbos = proximos.length > 0 && concluidos.length > 0;
  const [aba, setAba] = useState<"proximos" | "concluidos">(
    proximos.length > 0 ? "proximos" : "concluidos",
  );

  const lista = aba === "proximos" ? proximos : concluidos;
  const total = proximos.length + concluidos.length;

  if (total === 0) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">
          Em breve, nossos eventos por aqui
        </h2>
        <p className="mt-3 text-muted-foreground">
          Estamos preparando tudo. Volte em breve para conferir.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">
          {aba === "proximos" ? "Próximos eventos" : "Eventos concluídos"}
        </h2>
        <p className="mt-3 text-muted-foreground">
          {aba === "proximos"
            ? "Clique no evento para ver detalhes e fazer sua inscrição."
            : "Memórias dos eventos que já aconteceram."}
        </p>
      </div>

      {temAmbos && (
        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-2xl border border-border bg-white p-1 shadow-sm">
            <TabPill
              active={aba === "proximos"}
              onClick={() => setAba("proximos")}
            >
              Próximos
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  aba === "proximos"
                    ? "bg-white/25 text-white"
                    : "bg-neel-blue-50 text-neel-blue"
                }`}
              >
                {proximos.length}
              </span>
            </TabPill>
            <TabPill
              active={aba === "concluidos"}
              onClick={() => setAba("concluidos")}
            >
              Concluídos
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  aba === "concluidos"
                    ? "bg-white/25 text-white"
                    : "bg-neel-blue-50 text-neel-blue"
                }`}
              >
                {concluidos.length}
              </span>
            </TabPill>
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((evento) => (
          <EventoCard
            key={evento.id}
            evento={evento}
            concluido={aba === "concluidos"}
          />
        ))}
      </div>
    </>
  );
}

function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-xl px-5 py-2 text-sm font-semibold transition-all ${
        active
          ? "bg-neel-blue text-white shadow-float"
          : "text-neel-blue hover:bg-neel-blue-50"
      }`}
    >
      {children}
    </button>
  );
}

// Eventos que apontam para um domínio externo (link antigo que o público já
// conhece) em vez da página interna. Demais eventos seguem a rota normal.
const LINKS_EXTERNOS: Record<string, string> = {
  "2-seminario-espirita-do-neel": "https://neel2seminario.vercel.app",
};

function EventoCard({
  evento,
  concluido,
}: {
  evento: EventoListItem;
  concluido: boolean;
}) {
  const cor = evento.cor_tematica ?? "#C2410C";
  const hora = evento.hora_evento?.slice(0, 5);
  const linkExterno = LINKS_EXTERNOS[evento.slug];

  const conteudo = (
      <Card
        className={`overflow-hidden transition-all hover:-translate-y-1 hover:shadow-float-lg ${
          concluido ? "opacity-90" : ""
        }`}
      >
        <div
          className="relative grid h-44 place-items-center overflow-hidden"
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
              className={`object-cover transition-transform duration-500 group-hover:scale-105 ${
                concluido ? "grayscale-[0.4]" : ""
              }`}
            />
          ) : (
            <CalendarDays className="size-12 text-white/80" />
          )}
          {concluido ? (
            <Badge
              variant="muted"
              className="absolute right-3 top-3 bg-white/95 text-neel-blue"
            >
              <Check className="size-3" />
              Concluído
            </Badge>
          ) : (
            <Badge
              variant="muted"
              className="absolute right-3 top-3 bg-white/95"
              style={{ color: cor }}
            >
              {formatDate(evento.data_evento).split(" de ").slice(0, 2).join(" de ")}
            </Badge>
          )}
        </div>
        <CardHeader>
          <CardTitle style={{ color: cor }}>{evento.nome}</CardTitle>
          {evento.descricao_curta && (
            <CardDescription className="line-clamp-2">
              {evento.descricao_curta}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {formatDate(evento.data_evento)}
            {hora && ` · ${hora}`}
          </span>
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-1"
            style={{ color: cor }}
          />
        </CardContent>
      </Card>
  );

  return linkExterno ? (
    <a href={linkExterno} className="group">
      {conteudo}
    </a>
  ) : (
    <Link href={`/eventos/${evento.slug}`} className="group">
      {conteudo}
    </Link>
  );
}
