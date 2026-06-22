import {
  CalendarCheck,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/shared/logo";
import { EventosTabbed, type EventoListItem } from "./eventos-tabbed";

const beneficios = [
  {
    icone: Smartphone,
    titulo: "Tudo pelo celular",
    descricao:
      "Veja, inscreva e pague pelo Pix ou cartão sem sair de casa.",
  },
  {
    icone: CalendarCheck,
    titulo: "Sempre atualizado",
    descricao:
      "Datas, horários e detalhes dos eventos numa só página, sem grupos de WhatsApp.",
  },
  {
    icone: ShieldCheck,
    titulo: "Pagamento seguro",
    descricao:
      "Processamento via Asaas. Confirmação automática direto no seu WhatsApp.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: eventos } = await supabase
    .from("eventos")
    .select(
      "id, slug, nome, descricao_curta, data_evento, hora_evento, local, imagem_capa_url, cor_tematica",
    )
    .eq("status", "publicado")
    .order("data_evento", { ascending: true });

  // Filtra eventos passados — home pública mostra APENAS os que ainda vão acontecer
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const proximos: EventoListItem[] = (eventos ?? []).filter((ev) => {
    const dataEv = new Date(`${ev.data_evento}T00:00:00`);
    return dataEv >= hoje;
  });

  // Concluídos não aparecem na home pública — só no admin
  const concluidos: EventoListItem[] = [];

  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-neel-blue-50 via-white to-neel-yellow-50" />
        <div className="container mx-auto px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Logo
              variant="stacked"
              className="mx-auto scale-125 drop-shadow-xl sm:scale-150"
            />
            <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-neel-blue sm:text-6xl">
              Cada encontro do nosso núcleo,{" "}
              <span className="text-neel-yellow-dark">num só lugar</span>
            </h1>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="border-y border-border/60 bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
            {beneficios.map((b) => {
              const Icone = b.icone;
              return (
                <div
                  key={b.titulo}
                  className="flex flex-col items-center text-center sm:items-start sm:text-left"
                >
                  <div className="grid size-12 place-items-center rounded-2xl bg-neel-blue-50 text-neel-blue">
                    <Icone className="size-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold text-neel-blue">
                    {b.titulo}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {b.descricao}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* EVENTOS */}
      <section className="container mx-auto px-4 py-20">
        <EventosTabbed proximos={proximos} concluidos={concluidos} />
      </section>

      {/* CTA contato */}
      <section className="bg-neel-blue-50/40 py-16">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h3 className="text-2xl font-extrabold text-neel-blue">
            Dúvidas sobre algum evento?
          </h3>
          <p className="mt-3 text-muted-foreground">
            Fale com a secretaria do NEEL pelo WhatsApp{" "}
            <strong
              className="font-semibold text-neel-blue"
              translate="no"
            >
              (84) 9 8145-0229
            </strong>
            . Estamos à disposição de 7h às 19h.
          </p>
        </div>
      </section>
    </>
  );
}
