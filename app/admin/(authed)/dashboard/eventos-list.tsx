"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Ticket } from "lucide-react";
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
import { ValorSensivel } from "@/components/admin/valores-sensiveis";

export interface DashboardEventoItem {
  id: string;
  nome: string;
  data_evento: string;
  status: "rascunho" | "publicado" | "encerrado";
  ingressos_vendidos: number;
}

interface Props {
  proximos: DashboardEventoItem[];
  concluidos: DashboardEventoItem[];
}

export function DashboardEventosList({ proximos, concluidos }: Props) {
  const initial: "proximos" | "concluidos" =
    proximos.length > 0 ? "proximos" : "concluidos";
  const [aba, setAba] = useState<"proximos" | "concluidos">(initial);

  const lista = aba === "proximos" ? proximos : concluidos;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Agenda de eventos</CardTitle>
            <CardDescription>
              {aba === "proximos"
                ? "Os mais próximos no calendário."
                : "Eventos que já aconteceram, mais recentes primeiro."}
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/eventos">
              Ver todos
              <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="mt-3 inline-flex w-fit rounded-2xl border border-border bg-white p-1 shadow-sm">
          <TabPill
            active={aba === "proximos"}
            onClick={() => setAba("proximos")}
            count={proximos.length}
          >
            Próximos
          </TabPill>
          <TabPill
            active={aba === "concluidos"}
            onClick={() => setAba("concluidos")}
            count={concluidos.length}
          >
            Concluídos
          </TabPill>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {lista.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border-2 border-dashed border-amadeus-blue/20 bg-amadeus-blue-50/30 py-10 text-sm text-muted-foreground">
            {aba === "proximos"
              ? "Nenhum evento ativo no momento."
              : "Nenhum evento concluído ainda."}
          </div>
        ) : (
          lista.map((ev) => (
            <Link
              key={ev.id}
              href={`/admin/eventos/${ev.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 p-4 transition-colors hover:border-amadeus-blue/40 hover:bg-amadeus-blue-50/40"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-amadeus-blue">
                  {ev.nome}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(ev.data_evento)}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div
                  className="inline-flex items-center gap-1.5 rounded-full bg-amadeus-blue-50 px-2.5 py-1 text-xs font-bold text-amadeus-blue"
                  title="Ingressos vendidos"
                >
                  <Ticket className="size-3.5" />
                  <span className="tabular-nums">
                    <ValorSensivel valor={String(ev.ingressos_vendidos)} />
                  </span>
                </div>
                <Badge
                  variant={
                    aba === "concluidos"
                      ? "muted"
                      : ev.status === "publicado"
                        ? "success"
                        : ev.status === "encerrado"
                          ? "warning"
                          : "muted"
                  }
                >
                  {aba === "concluidos" ? (
                    <>
                      <Check className="size-3" />
                      Concluído
                    </>
                  ) : ev.status === "publicado" ? (
                    "Publicado"
                  ) : ev.status === "encerrado" ? (
                    "Encerrado"
                  ) : (
                    "Rascunho"
                  )}
                </Badge>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
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
      className={`inline-flex items-center rounded-xl px-4 py-1.5 text-sm font-semibold transition-colors ${
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
