import Link from "next/link";
import { CalendarPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import {
  DashboardEventosList,
  type DashboardEventoItem,
} from "./eventos-list";
import { MetricasCompactas, type MetricaItem } from "./metricas-compactas";

const LIMITE_POR_ABA = 5;

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [publicadosRes, totalEventosRes, ingressosRes, eventosRes] =
    await Promise.all([
      supabase
        .from("eventos")
        .select("id", { count: "exact", head: true })
        .eq("status", "publicado"),
      supabase.from("eventos").select("id", { count: "exact", head: true }),
      supabase
        .from("inscricoes")
        .select("evento_id, valor_total, itens")
        .eq("status_pagamento", "pago"),
      supabase
        .from("eventos")
        .select("id, nome, data_evento, status")
        .in("status", ["publicado", "encerrado"])
        .order("data_evento", { ascending: false }),
    ]);

  const eventosPublicados = publicadosRes.count ?? 0;
  const totalEventos = totalEventosRes.count ?? 0;

  // Mapas de ingressos e receita por evento + total geral de ingressos
  const ingressosPorEvento = new Map<string, number>();
  const receitaPorEvento = new Map<string, number>();
  let ingressosVendidos = 0;
  for (const i of ingressosRes.data ?? []) {
    const itens = (i.itens as { qtd?: number }[] | null) ?? [];
    const qtdInscricao = itens.reduce((s, it) => s + (it.qtd ?? 0), 0);
    ingressosVendidos += qtdInscricao;
    if (i.evento_id) {
      ingressosPorEvento.set(
        i.evento_id,
        (ingressosPorEvento.get(i.evento_id) ?? 0) + qtdInscricao,
      );
      receitaPorEvento.set(
        i.evento_id,
        (receitaPorEvento.get(i.evento_id) ?? 0) + Number(i.valor_total ?? 0),
      );
    }
  }

  // Particiona eventos
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const proximosAll: DashboardEventoItem[] = [];
  const concluidosAll: DashboardEventoItem[] = [];

  for (const ev of eventosRes.data ?? []) {
    const item: DashboardEventoItem = {
      id: ev.id,
      nome: ev.nome,
      data_evento: ev.data_evento,
      status: ev.status as "rascunho" | "publicado" | "encerrado",
      ingressos_vendidos: ingressosPorEvento.get(ev.id) ?? 0,
    };
    const dataEv = new Date(`${ev.data_evento}T00:00:00`);
    if (dataEv < hoje || ev.status === "encerrado") {
      concluidosAll.push(item);
    } else {
      proximosAll.push(item);
    }
  }

  // Ordenação: próximos do mais cedo pro mais tarde; concluídos do mais recente pro mais antigo
  proximosAll.sort(
    (a, b) =>
      new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime(),
  );
  concluidosAll.sort(
    (a, b) =>
      new Date(b.data_evento).getTime() - new Date(a.data_evento).getTime(),
  );

  const proximos = proximosAll.slice(0, LIMITE_POR_ABA);
  const concluidos = concluidosAll.slice(0, LIMITE_POR_ABA);

  // Receita dos eventos ativos (publicados e ainda não acontecidos)
  const receitaEventosAtivos = proximosAll.reduce(
    (sum, ev) => sum + (receitaPorEvento.get(ev.id) ?? 0),
    0,
  );

  const metricas: MetricaItem[] = [
    {
      titulo: "Eventos publicados",
      valor: `${eventosPublicados} de ${totalEventos}`,
      icone: "calendario",
    },
    {
      titulo: "Ingressos vendidos",
      valor: ingressosVendidos.toString(),
      icone: "ingresso",
      sensivel: true,
    },
    {
      titulo: "Receita (eventos ativos)",
      valor: formatCurrency(receitaEventosAtivos),
      icone: "carteira",
      sensivel: true,
    },
  ];

  const semEventos = proximosAll.length === 0 && concluidosAll.length === 0;

  return (
    <div className="container mx-auto px-4 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">
            Visão geral
          </h1>
          <p className="mt-1 text-muted-foreground">
            Acompanhe os eventos, inscrições e a arrecadação do NEEL.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/eventos/importar">
              <Sparkles />
              Importar de aviso
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/eventos/novo">
              <CalendarPlus />
              Novo evento
            </Link>
          </Button>
        </div>
      </header>

      <section className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="order-last lg:order-none">
        {semEventos ? (
          <Card>
            <CardContent className="pb-10">
              <div className="grid place-items-center rounded-2xl border-2 border-dashed border-neel-blue/20 bg-neel-blue-50/40 py-16">
                <div className="max-w-md text-center">
                  <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-neel-blue shadow-float">
                    <Sparkles className="size-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold text-neel-blue">
                    Vamos criar o primeiro evento?
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Em menos de 5 minutos você publica um evento completo:
                    fotos, tipos de ingresso, valores e restrições por série.
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
        ) : (
          <DashboardEventosList
            proximos={proximos}
            concluidos={concluidos}
          />
        )}
        </div>
        <MetricasCompactas metricas={metricas} />
      </section>
    </div>
  );
}
