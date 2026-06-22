import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { EventoForm } from "@/components/admin/evento-form";
import { createEvento } from "../actions";

export default function NovoEventoPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/admin/eventos"
        className="inline-flex items-center gap-1 text-sm font-semibold text-neel-blue hover:underline"
      >
        <ChevronLeft className="size-4" />
        Voltar para eventos
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">
        Novo evento
      </h1>
      <p className="mt-1 text-muted-foreground">
        Preencha os dados abaixo. Você pode salvar como rascunho e publicar
        depois.
      </p>

      <div className="mt-8">
        <EventoForm submitAction={createEvento} submitLabel="Criar evento" />
      </div>
    </div>
  );
}
