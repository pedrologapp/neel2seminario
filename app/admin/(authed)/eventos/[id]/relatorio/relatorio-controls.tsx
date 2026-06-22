"use client";

import Link from "next/link";
import {
  ChevronLeft,
  EyeOff,
  List,
  Printer,
  StretchHorizontal,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  eventoId: string;
  modo: "lista" | "paginas";
  mostrarSenhas: boolean;
}

export function RelatorioControls({ eventoId, modo, mostrarSenhas }: Props) {
  const base = `/admin/eventos/${eventoId}/relatorio`;
  const url = (m: "lista" | "paginas", senhas: boolean) =>
    `${base}?modo=${m}&senhas=${senhas ? "sim" : "nao"}`;

  return (
    <div className="flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
      <Link
        href={`/admin/eventos/${eventoId}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-neel-blue hover:underline"
      >
        <ChevronLeft className="size-4" />
        Voltar para o evento
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-xl border border-border">
          <Link
            href={url("lista", mostrarSenhas)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors ${
              modo === "lista"
                ? "bg-neel-blue text-white"
                : "text-muted-foreground hover:bg-neel-blue-50"
            }`}
          >
            <List className="size-4" />
            Lista direta
          </Link>
          <Link
            href={url("paginas", mostrarSenhas)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors ${
              modo === "paginas"
                ? "bg-neel-blue text-white"
                : "text-muted-foreground hover:bg-neel-blue-50"
            }`}
          >
            <StretchHorizontal className="size-4" />
            Uma página por tipo
          </Link>
        </div>

        <div className="inline-flex overflow-hidden rounded-xl border border-border">
          <Link
            href={url(modo, true)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors ${
              mostrarSenhas
                ? "bg-neel-blue text-white"
                : "text-muted-foreground hover:bg-neel-blue-50"
            }`}
          >
            <Ticket className="size-4" />
            Com senhas
          </Link>
          <Link
            href={url(modo, false)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors ${
              !mostrarSenhas
                ? "bg-neel-blue text-white"
                : "text-muted-foreground hover:bg-neel-blue-50"
            }`}
          >
            <EyeOff className="size-4" />
            Sem senhas (professores)
          </Link>
        </div>

        <Button type="button" onClick={() => window.print()}>
          <Printer />
          Imprimir / Salvar PDF
        </Button>
      </div>
    </div>
  );
}
