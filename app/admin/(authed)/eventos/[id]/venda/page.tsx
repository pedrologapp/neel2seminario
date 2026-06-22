import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Lote } from "@/lib/lotes";
import { calcEstoquePorTipo } from "@/lib/estoque";
import { VendaForm } from "./venda-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VendaDinheiroPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select(
      "id, nome, cor_tematica, tipos_ingresso(id, nome, preco, descricao, ordem, lotes, max_ingressos, opcional, grupo)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!evento) notFound();

  const estoque = await calcEstoquePorTipo(supabase, evento.id);

  const cor = evento.cor_tematica ?? "#C2410C";
  const tipos = (evento.tipos_ingresso ?? [])
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((t) => {
      const est = estoque.get(t.id);
      return {
        id: t.id,
        nome: t.nome,
        preco: Number(t.preco),
        descricao: t.descricao,
        lotes: (t.lotes ?? []) as Lote[],
        opcional: (t as { opcional?: boolean | null }).opcional ?? false,
        grupo: (t as { grupo?: string | null }).grupo ?? null,
        restantes: est?.restantes ?? null,
        esgotado: est?.esgotado ?? false,
      };
    });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/admin/eventos/${id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-neel-blue hover:underline"
      >
        <ChevronLeft className="size-4" />
        Voltar para o evento
      </Link>
      <h1 className="mt-4 flex items-center gap-2 text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">
        <Wallet className="size-7" />
        Venda em dinheiro
      </h1>
      <p className="mt-1 text-muted-foreground">
        Registre um pagamento presencial. A inscrição entra como{" "}
        <strong>paga</strong> e os QR Codes vão pro WhatsApp do responsável.
      </p>

      <div className="mt-8">
        <VendaForm
          eventoId={evento.id}
          eventoNome={evento.nome}
          cor={cor}
          tipos={tipos}
        />
      </div>
    </div>
  );
}
