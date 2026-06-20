import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { portariaAutenticada } from "@/lib/portaria-auth";
import { listarParticipantes } from "../actions";
import { PortariaApp } from "./portaria-app";

interface PageProps {
  params: Promise<{ eventoId: string }>;
}

export default async function PortariaEventoPage({ params }: PageProps) {
  const { eventoId } = await params;

  if (!(await portariaAutenticada())) {
    redirect("/portaria");
  }

  const admin = createAdminClient();
  const { data: evento } = await admin
    .from("eventos")
    .select("id, nome")
    .eq("id", eventoId)
    .maybeSingle();

  if (!evento) notFound();

  const participantes = await listarParticipantes(eventoId);

  return (
    <PortariaApp
      evento={{ id: evento.id, nome: evento.nome }}
      participantesIniciais={participantes}
    />
  );
}
