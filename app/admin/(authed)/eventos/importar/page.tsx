import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ImportarFlow } from "./importar-flow";
import { createEvento } from "../actions";

export default function ImportarEventoPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/admin/eventos"
        className="inline-flex items-center gap-1 text-sm font-semibold text-amadeus-blue hover:underline"
      >
        <ChevronLeft className="size-4" />
        Voltar para eventos
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-amadeus-blue sm:text-4xl">
        Importar evento de aviso
      </h1>
      <p className="mt-1 text-muted-foreground">
        Cole o aviso do NEEL ou faça upload do PDF. A IA extrai automaticamente
        nome, data, horário, valores, restrições e mais — em segundos.
      </p>

      <div className="mt-8">
        <ImportarFlow createAction={createEvento} />
      </div>
    </div>
  );
}
