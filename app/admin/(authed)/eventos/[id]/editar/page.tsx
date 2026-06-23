import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EventoForm } from "@/components/admin/evento-form";
import { createClient } from "@/lib/supabase/server";
import { updateEvento } from "../../actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarEventoPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select(
      "id, nome, descricao_curta, descricao_longa, data_evento, hora_evento, local, imagem_capa_url, cor_tematica, metodos_pagamento, max_parcelas, prazo_inscricao, status, destinacao_valores, infos_importantes, mostrar_estoque_publico, palestrantes, momento_artistico, contatos, tipos_ingresso(id, nome, preco, descricao, ordem, lotes, max_ingressos, opcional, grupo)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!evento) notFound();

  const tipos = (evento.tipos_ingresso ?? [])
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((t) => ({
      id: t.id,
      nome: t.nome,
      preco: Number(t.preco),
      descricao: t.descricao,
      max_ingressos:
        (t as { max_ingressos?: number | null }).max_ingressos ?? null,
      opcional: (t as { opcional?: boolean | null }).opcional ?? false,
      grupo: (t as { grupo?: string | null }).grupo ?? null,
      lotes: ((t as { lotes?: unknown }).lotes ?? []) as {
        nome: string;
        preco: number;
        valido_ate: string | null;
      }[],
    }));

  // Vincula o eventoId à action — fica como (prev, formData) => Promise<state>
  const updateBound = updateEvento.bind(null, evento.id);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/admin/eventos/${evento.id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-neel-blue hover:underline"
      >
        <ChevronLeft className="size-4" />
        Voltar para o evento
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">
        Editar evento
      </h1>
      <p className="mt-1 text-muted-foreground">
        Atualize os dados do evento. As alterações aparecem imediatamente no
        site.
      </p>

      <div className="mt-8">
        <EventoForm
          initial={{
            nome: evento.nome,
            descricao_curta: evento.descricao_curta,
            descricao_longa: evento.descricao_longa,
            data_evento: evento.data_evento,
            hora_evento: evento.hora_evento,
            local: evento.local,
            imagem_capa_url: evento.imagem_capa_url,
            cor_tematica: evento.cor_tematica ?? "#C2410C",
            metodos_pagamento: evento.metodos_pagamento,
            max_parcelas: evento.max_parcelas,
            prazo_inscricao: evento.prazo_inscricao,
            status: evento.status,
            destinacao_valores: evento.destinacao_valores,
            infos_importantes: evento.infos_importantes,
            mostrar_estoque_publico: evento.mostrar_estoque_publico ?? false,
            palestrantes:
              (evento as {
                palestrantes?: { nome: string; foto_url: string | null }[] | null;
              }).palestrantes ?? [],
            momento_artistico:
              (evento as {
                momento_artistico?:
                  | { nome: string; foto_url: string | null }[]
                  | null;
              }).momento_artistico ?? [],
            contatos:
              (evento as { contatos?: string[] | null }).contatos ?? [],
          }}
          initialTipos={tipos}
          submitAction={updateBound}
          submitLabel="Salvar alterações"
          cancelHref={`/admin/eventos/${evento.id}`}
        />
      </div>
    </div>
  );
}
