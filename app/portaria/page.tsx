import Link from "next/link";
import { CalendarDays, ChevronRight, LogOut, MapPin, ScanLine } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { portariaAutenticada } from "@/lib/portaria-auth";
import { formatDate } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { PortariaLogin } from "./portaria-login";
import { sairPortaria } from "./actions";

export default async function PortariaHome() {
  if (!(await portariaAutenticada())) {
    return <PortariaLogin />;
  }

  const admin = createAdminClient();
  const { data: eventos } = await admin
    .from("eventos")
    .select("id, nome, data_evento, local, status, cor_tematica")
    .neq("status", "rascunho")
    .order("data_evento", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <Logo variant="compact" />
        <form action={sairPortaria}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </form>
      </header>

      <div className="mb-6 flex items-center gap-2 text-neel-blue">
        <ScanLine className="size-6" />
        <h1 className="text-2xl font-extrabold">Escolha o evento</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Selecione qual evento você vai validar na portaria.
      </p>

      {!eventos || eventos.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border-2 border-dashed border-neel-blue/20 bg-white py-12 text-sm text-muted-foreground">
          Nenhum evento publicado no momento.
        </div>
      ) : (
        <div className="space-y-3">
          {eventos.map((ev) => (
            <Link
              key={ev.id}
              href={`/portaria/${ev.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm transition-colors hover:border-neel-blue/40 hover:bg-neel-blue-50/40"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: ev.cor_tematica || "#1e6feb" }}
                  />
                  <span className="truncate font-bold text-foreground">
                    {ev.nome}
                  </span>
                  {ev.status === "encerrado" && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      Encerrado
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  {ev.data_evento && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {formatDate(ev.data_evento)}
                    </span>
                  )}
                  {ev.local && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {ev.local}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
